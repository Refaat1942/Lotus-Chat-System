import { Router } from "express";
import { db } from "@workspace/db";
import {
  customersTable,
  conversationsTable,
  messagesTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

// POST /api/customers/:id/ai-brief — generates a multi-discipline summary for
// the patient using their profile, tags, prescription notes, and the latest
// conversation snippets. Stateless: result is returned to the client; no
// persistence (kept simple — UI shows it in a card with a "Refresh" button).
router.post("/customers/:id/ai-brief", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id));
  if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }

  // Pull the 5 most recent conversations + last 6 messages each. This caps the
  // context window we send to the model and keeps cost predictable.
  const recentConvs = await db
    .select({
      id: conversationsTable.id,
      status: conversationsTable.status,
      channel: conversationsTable.channel,
      lastMessageAt: conversationsTable.lastMessageAt,
      tags: conversationsTable.tags,
    })
    .from(conversationsTable)
    .where(eq(conversationsTable.customerId, id))
    .orderBy(desc(conversationsTable.lastMessageAt))
    .limit(5);

  const convSummaries: string[] = [];
  for (const c of recentConvs) {
    const msgs = await db
      .select({
        senderType: messagesTable.senderType,
        body: messagesTable.body,
        createdAt: messagesTable.createdAt,
        isNote: messagesTable.isNote,
      })
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, c.id))
      .orderBy(desc(messagesTable.createdAt))
      .limit(6);
    const lines = msgs.reverse().map(
      (m) => `  [${m.senderType}${m.isNote ? "/note" : ""}] ${m.body}`,
    ).join("\n");
    convSummaries.push(
      `Conversation #${c.id} (${c.channel}, ${c.status})\n${lines || "  (no messages)"}`,
    );
  }

  const profileBlock = [
    `Name: ${customer.name}`,
    `Phone: ${customer.phone}`,
    customer.branch ? `Home branch: ${customer.branch}` : null,
    customer.address ? `Address: ${customer.address}` : null,
    customer.tags?.length ? `Tags: ${customer.tags.join(", ")}` : null,
    customer.prescriptionNotes ? `Clinical / Prescription notes:\n${customer.prescriptionNotes}` : null,
    customer.notes ? `General notes:\n${customer.notes}` : null,
    customer.isBlocked
      ? `STATUS: BLOCKED${customer.blockedReason ? ` — ${customer.blockedReason}` : ""}`
      : null,
  ].filter(Boolean).join("\n");

  const userPrompt = [
    "You are a pharmacy CRM assistant. Produce a concise patient brief in English.",
    "Cover these disciplines, each as a short bulleted section (skip a section if there is no relevant info):",
    "1. Profile snapshot (who they are, where they shop)",
    "2. Clinical & prescription context (medications, allergies, conditions)",
    "3. Communication & behaviour patterns (channels used, sentiment, recurring requests)",
    "4. Open issues / next best action for the agent",
    "5. Risk flags (blocked status, complaints, urgent clinical concerns)",
    "Keep it under 220 words. Plain text with bullets, no markdown headings.",
    "",
    "=== PATIENT PROFILE ===",
    profileBlock,
    "",
    "=== RECENT CONVERSATIONS ===",
    convSummaries.length ? convSummaries.join("\n\n") : "(none)",
  ].join("\n");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      max_completion_tokens: 600,
      messages: [
        {
          role: "system",
          content: "You are a careful pharmacy CRM analyst. Be factual, concise, and actionable. Never invent diagnoses or medications.",
        },
        { role: "user", content: userPrompt },
      ],
    });
    const brief = completion.choices[0]?.message?.content?.trim() ?? "";
    res.json({
      brief,
      generatedAt: new Date().toISOString(),
      model: "gpt-5",
      conversationCount: recentConvs.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI request failed";
    res.status(502).json({ error: msg });
  }
});

export default router;
