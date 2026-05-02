import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { customersTable } from "./customers";

export const conversationsTable = pgTable("conversations", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customersTable.id),
  assignedAgentId: integer("assigned_agent_id").references(
    () => usersTable.id,
  ),
  status: text("status", { enum: ["open", "resolved", "pending"] })
    .notNull()
    .default("open"),
  tags: text("tags").array().notNull().default([]),
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at"),
  unreadCount: integer("unread_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  queuedAt: timestamp("queued_at"),
});

export const insertConversationSchema = createInsertSchema(
  conversationsTable,
).omit({ id: true, createdAt: true });
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversationsTable.$inferSelect;
