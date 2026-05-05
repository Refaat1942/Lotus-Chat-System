import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Marketing campaigns — "ready to connect" placeholder.
 *
 * Campaigns are stored as drafts. Sending is a no-op stub today: when the
 * admin clicks "Send", we mark status='sent' and record sentAt + a synthetic
 * recipientCount, but no real provider call is made. This keeps the UI and
 * data model in place so a real WhatsApp/SMS/Messenger provider can be wired
 * up later without changing the schema or the front-end.
 */
export const campaignsTable = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  channel: text("channel", {
    enum: ["whatsapp", "messenger", "instagram", "sms"],
  })
    .notNull()
    .default("whatsapp"),
  message: text("message").notNull(),
  audience: text("audience").notNull().default("all"),
  status: text("status", { enum: ["draft", "sent"] })
    .notNull()
    .default("draft"),
  recipientCount: integer("recipient_count").notNull().default(0),
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
