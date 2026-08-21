import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { conversationsTable } from "./conversations";
import { usersTable } from "./users";

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversationsTable.id),
  senderId: integer("sender_id").references(() => usersTable.id),
  senderType: text("sender_type", {
    enum: ["agent", "customer", "system"],
  }).notNull(),
  body: text("body").notNull(),
  attachments: text("attachments").array().notNull().default([]),
  externalId: text("external_id"),
  status: text("status", { enum: ["sent", "delivered", "read", "failed"] })
    .notNull()
    .default("sent"),
  isNote: boolean("is_note").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
