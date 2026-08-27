import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
export const attempts = sqliteTable("exam_attempts", {
  id: text("id").primaryKey(), owner: text("owner").notNull(), role: text("role").notNull(),
  created: integer("created").notNull(), deadline: integer("deadline").notNull(), finished: integer("finished"),
  status: text("status").notNull().default("active"), openKey: text("open_key"),
  questions: text("questions").notNull(), answers: text("answers").notNull().default("{}"),
  marked: text("marked").notNull().default("[]"), essay: text("essay").notNull().default(""),
  essayTheme: integer("essay_theme").notNull().default(0), repeated: integer("repeated").notNull().default(0),
  revision: integer("revision").notNull().default(0),
}, (t) => [index("attempts_owner_created").on(t.owner, t.created), uniqueIndex("one_active_attempt").on(t.openKey)]);
