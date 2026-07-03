import type { QuizzValidated } from "@razzia/common/validators/quizz"
import { sql } from "drizzle-orm"
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  // Rempli par le SSO Entra ID (null tant que l'utilisateur ne s'est pas
  // connecté via Microsoft).
  entraOid: text("entra_oid").unique(),
  role: text("role", { enum: ["admin", "creator"] })
    .notNull()
    .default("creator"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const quizzes = sqliteTable("quizzes", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  // Structure du quiz validée (mêmes données qu'un fichier quizz/*.json).
  data: text("data", { mode: "json" }).notNull().$type<QuizzValidated>(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const quizShares = sqliteTable(
  "quiz_shares",
  {
    quizzId: text("quizz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    permission: text("permission", { enum: ["read", "edit"] })
      .notNull()
      .default("read"),
  },
  (table) => [primaryKey({ columns: [table.quizzId, table.userId] })],
)
