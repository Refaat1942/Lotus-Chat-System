import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { campaignsTable } from "./campaigns";
import { customersTable } from "./customers";

export const campaignRecipientsTable = pgTable("campaign_recipients", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id")
    .notNull()
    .references(() => campaignsTable.id, { onDelete: "cascade" }),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customersTable.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["pending", "sent", "failed"] })
    .notNull()
    .default("pending"),
  error: text("error"),
  sentAt: timestamp("sent_at"),
});

export type CampaignRecipient = typeof campaignRecipientsTable.$inferSelect;
