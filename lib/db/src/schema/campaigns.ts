import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Marketing campaigns — supports draft, scheduling, and provider-ready send.
 * Real delivery requires provider env vars; without them send runs in stub mode.
 */
export const campaignsTable = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  channel: text("channel", {
    enum: ["whatsapp", "messenger", "instagram", "sms", "email"],
  })
    .notNull()
    .default("whatsapp"),
  message: text("message").notNull(),
  audience: text("audience").notNull().default("all"),
  status: text("status", {
    enum: ["draft", "scheduled", "sending", "sent", "partial", "failed"],
  })
    .notNull()
    .default("draft"),
  recipientCount: integer("recipient_count").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  scheduledAt: timestamp("scheduled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  sentAt: timestamp("sent_at"),
});

export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({
  id: true,
  createdAt: true,
  sentAt: true,
  status: true,
  recipientCount: true,
});
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaignsTable.$inferSelect;
