import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const notReadyReasonsTable = pgTable("not_ready_reasons", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type NotReadyReason = typeof notReadyReasonsTable.$inferSelect;
