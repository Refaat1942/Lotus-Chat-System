import { Router } from "express";
import { db } from "@workspace/db";
import {
  customersTable,
  conversationsTable,
  messagesTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { requirePermission } from "../middlewares/permissions";

const router = Router();

async function buildCustomerContext(customerId: number) {
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, customerId));

  if (!customer) return null;

  const conversations = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.customerId, customerId))
    .orderBy(desc(conversationsTable.lastMessageAt))
    .limit(5);

  const snippets: string[] = [];
  for (const conv of conversations) {
    const msgs = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conv.id))
      .orderBy(desc(messagesTable.createdAt))
      .limit(6);
    const lines = msgs
      .reverse()
      .map((m) => `${m.senderType}: ${m.body}`)
      .join("\n");
    snippets.push(`Conversation #${conv.id} (${conv.status}):\n${lines}`);
  }

  return { customer, snippets };
}

router.post(
  "/customers/:id/ai-brief",
  requireAuth,
  requirePermission("canManageCustomers"),
  async (req: AuthRequest, res) => {
    const customerId = Number(req.params.id);
    const ctx = await buildCustomerContext(customerId);
    if (!ctx) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    const { customer, snippets } = ctx;
    const hasOpenAi =
      !!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL &&
      !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

    if (!hasOpenAi) {
      res.json({
        source: "deterministic",
        profile: `${customer.name} · ${customer.phone}${customer.branch ? ` · ${customer.branch}` : ""}`,
        clinical: customer.prescriptionNotes || "No prescription notes on file.",
        communication: customer.notes || "No general notes on file.",
        nextAction:
          snippets.length > 0
            ? "Review recent conversations and follow up on any open items."
            : "No conversation history yet — initiate outreach.",
        risk: customer.isBlocked
          ? `Customer is blocked${customer.blockedReason ? `: ${customer.blockedReason}` : "."}`
          : "No active block on record.",
        generatedAt: new Date().toISOString(),
      });
      return;
    }

    try {
      const { openai } = await import("@workspace/integrations-openai-ai-server");
      const prompt = `You are a pharmacy CRM assistant. Summarize this customer for staff in JSON with keys: profile, clinical, communication, nextAction, risk. Keep each value to 1-2 sentences.

Customer: ${customer.name}, phone ${customer.phone}, branch ${customer.branch ?? "n/a"}, address ${customer.address ?? "n/a"}
Tags: ${(customer.tags ?? []).join(", ") || "none"}
Notes: ${customer.notes ?? "none"}
Prescription: ${customer.prescriptionNotes ?? "none"}

Recent chats:
${snippets.join("\n\n") || "none"}`;

      const completion = await openai.chat.completions.create({
        model: process.env.AI_BRIEF_MODEL ?? "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as Record<string, string>;

      res.json({
        source: "ai",
        profile: parsed.profile ?? "",
        clinical: parsed.clinical ?? "",
        communication: parsed.communication ?? "",
        nextAction: parsed.nextAction ?? "",
        risk: parsed.risk ?? "",
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      res.status(502).json({
        error: "AI brief generation failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  },
);

export default router;
