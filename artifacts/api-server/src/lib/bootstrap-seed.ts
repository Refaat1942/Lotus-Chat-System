/**
 * Idempotent startup seed.
 *
 * Runs once on every API-server boot:
 *   - Always ensures the singleton settings row exists.
 *   - If the `users` table is empty, seeds 6 demo users + 6 tags +
 *     8 quick replies + 22 customers + 22 conversations + 44 messages.
 *
 * Safe in production: never overwrites existing data. Logs and continues
 * on error so a seed failure cannot prevent the server from starting.
 */
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  conversationsTable,
  customersTable,
  messagesTable,
  quickRepliesTable,
  settingsTable,
  tagsTable,
  usersTable,
} from "@workspace/db";
import { logger } from "./logger";

const USERS = [
  ["layla@lotuspharmacies.com", "Layla Hassan",   "admin", "admin123"],
  ["omar@lotuspharmacies.com",  "Omar Khalil",    "admin", "admin123"],
  ["sara@lotuspharmacies.com",  "Sara Ahmed",     "agent", "agent123"],
  ["youssef@lotuspharmacies.com","Youssef Nabil", "agent", "agent123"],
  ["hana@lotuspharmacies.com",  "Hana Mostafa",   "agent", "agent123"],
  ["kareem@lotuspharmacies.com","Kareem Farouk",  "agent", "agent123"],
] as const;

const TAGS = [
  ["VIP",            "#FFD700"],
  ["Urgent",         "#DC2626"],
  ["Diabetic",       "#2563EB"],
  ["Delivery",       "#16A34A"],
  ["Insurance",      "#9333EA"],
  ["Follow-up",      "#F59E0B"],
] as const;

const REPLIES = [
  ["Greeting",          "Hello! Welcome to Lotus Pharmacies. How can I help you today?"],
  ["Out of stock",      "I'm sorry, that item is currently out of stock. We expect a restock within 2–3 business days."],
  ["Delivery times",    "We deliver between 9 AM and 9 PM. Same-day delivery is available for orders placed before 6 PM."],
  ["Insurance accepted","We accept most major insurance providers. Please share your card and I'll verify coverage."],
  ["Prescription pickup","Your prescription is ready for pickup. Please bring a valid ID."],
  ["Refill reminder",   "Hi! This is a friendly reminder that it's time to refill your prescription."],
  ["Payment options",   "We accept cash, credit/debit cards, and digital wallets. Insurance copays are calculated at checkout."],
  ["Thank you",         "Thank you for choosing Lotus Pharmacies. We're here whenever you need us."],
] as const;

const CUSTOMER_NAMES = [
  "Mariam Ahmed", "Khaled Mahmoud", "Fatma Saleh", "Mohamed Hany",
  "Aya Farouk", "Tamer Wahid", "Hana Magdy", "Karim Reda",
  "Salma Nabil", "Hassan Yousry", "Reem Adel", "Bassem Saad",
  "Dina Elsayed", "Mostafa Osman", "Lina Zaki", "Sherif Anwar",
  "Yara Hossam", "Ramy Fouad", "Heba Sami", "Tarek Ali",
  "Rana Hisham", "Ehab Galal",
];
const CUSTOMER_TAGS: string[][] = [
  ["VIP"], ["Diabetic"], ["Delivery"], ["VIP", "Insurance"],
  ["Urgent"], ["Follow-up"], ["Diabetic", "Delivery"], [],
  ["Insurance"], ["VIP", "Delivery"], ["Follow-up"], ["Urgent", "VIP"],
  ["Delivery"], ["Diabetic"], [], ["Insurance", "Follow-up"],
  ["VIP"], ["Delivery"], ["Urgent"], ["Diabetic"],
  ["Follow-up"], ["VIP", "Diabetic"],
];
const SNIPPETS = [
  "Hi, I need to refill my prescription for metformin.",
  "When will my order be delivered?",
  "Can you check if you have insulin in stock?",
  "Thanks for the quick response!",
  "I have a question about my insurance coverage.",
  "Is the pharmacy open on Friday?",
  "Could you confirm the delivery address?",
  "I'd like to schedule a refill reminder.",
  "Do you offer home blood pressure monitors?",
  "I'm following up on my last order.",
];
const STATUSES = ["open", "open", "open", "pending", "resolved"] as const;
const BRANCHES = ["Downtown", "Westside", "North"];

export async function bootstrapSeed(): Promise<void> {
  try {
    // 1) Settings singleton
    await db.insert(settingsTable).values({ id: 1 }).onConflictDoNothing();

    // 2) Users — only if table empty
    const [{ count: userCount }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(usersTable);

    if (userCount > 0) {
      logger.info({ userCount }, "bootstrap-seed: users already present, skipping demo data");
      return;
    }

    logger.warn("bootstrap-seed: empty database detected, seeding demo data…");

    for (const [email, name, role, pwd] of USERS) {
      const passwordHash = await bcrypt.hash(pwd, 10);
      await db
        .insert(usersTable)
        .values({ email, name, role: role as "admin" | "agent", passwordHash })
        .onConflictDoNothing();
    }

    for (const [name, color] of TAGS) {
      await db
        .insert(tagsTable)
        .values({ name, color })
        .onConflictDoNothing();
    }

    for (const [title, body] of REPLIES) {
      await db
        .insert(quickRepliesTable)
        .values({ title, body })
        .onConflictDoNothing();
    }

    // Customers
    const customerIds: number[] = [];
    for (let i = 0; i < CUSTOMER_NAMES.length; i++) {
      const name = CUSTOMER_NAMES[i];
      const phone = `+2010${String(10000000 + i * 137).padStart(8, "0")}`;
      const branch = BRANCHES[i % BRANCHES.length];
      const tags = CUSTOMER_TAGS[i] ?? [];
      const notes = i % 3 === 0 ? "Prefers SMS notifications." : null;
      const rxNotes = i % 4 === 0 ? "Allergic to penicillin." : null;

      const [row] = await db
        .insert(customersTable)
        .values({
          name,
          phone,
          branch,
          tags,
          notes: notes ?? undefined,
          prescriptionNotes: rxNotes ?? undefined,
        })
        .returning({ id: customersTable.id });
      customerIds.push(row.id);
    }

    // Lookup agent ids
    const agentRows = await db
      .select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable);
    const agentIdByEmail = Object.fromEntries(
      agentRows.filter((r) => r.email !== "layla@lotuspharmacies.com" && r.email !== "omar@lotuspharmacies.com").map((r) => [r.email, r.id]),
    );
    const agentEmails = Object.keys(agentIdByEmail);

    // Conversations + 2 messages each
    for (let i = 0; i < customerIds.length; i++) {
      const customerId = customerIds[i];
      const agentEmail = agentEmails[i % agentEmails.length];
      const agentId = agentIdByEmail[agentEmail];
      const status = STATUSES[i % STATUSES.length];
      const lastMsg = SNIPPETS[i % SNIPPETS.length];
      const cTags = i % 2 === 0 ? ["Follow-up"] : [];
      const minutesAgo = (i + 1) * 17;
      const lastAt = new Date(Date.now() - minutesAgo * 60 * 1000);

      const [conv] = await db
        .insert(conversationsTable)
        .values({
          customerId,
          assignedAgentId: agentId,
          status,
          tags: cTags,
          lastMessage: lastMsg,
          lastMessageAt: lastAt,
          unreadCount: i % 3,
          resolvedAt: status === "resolved" ? new Date() : null,
        })
        .returning({ id: conversationsTable.id });

      await db.insert(messagesTable).values([
        {
          conversationId: conv.id,
          senderId: null,
          senderType: "customer",
          body: SNIPPETS[(i + 3) % SNIPPETS.length],
          status: "delivered",
          createdAt: new Date(Date.now() - (minutesAgo + 5) * 60 * 1000),
        },
        {
          conversationId: conv.id,
          senderId: agentId,
          senderType: "agent",
          body: lastMsg,
          status: "sent",
          createdAt: lastAt,
        },
      ]);
    }

    logger.info(
      { users: USERS.length, customers: customerIds.length },
      "bootstrap-seed: demo data created",
    );
  } catch (err) {
    // Never block server startup on seed failure
    logger.error({ err }, "bootstrap-seed failed (continuing without seed)");
  }
}
