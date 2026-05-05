import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const chatReasonCategoriesTable = pgTable("chat_reason_categories", {
  id: serial("id").primaryKey(),
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ChatReasonCategory = typeof chatReasonCategoriesTable.$inferSelect;
