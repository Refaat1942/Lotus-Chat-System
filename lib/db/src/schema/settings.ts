import { pgTable, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Single-row configuration table (id always = 1).
 * Holds chat-distribution settings.
 */
export const settingsTable = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  maxChatsPerAgent: integer("max_chats_per_agent").notNull().default(5),
  autoAssign: boolean("auto_assign").notNull().default(true),
  assignmentStrategy: text("assignment_strategy", {
    enum: ["round_robin", "least_busy"],
  })
    .notNull()
    .default("least_busy"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Settings = typeof settingsTable.$inferSelect;
