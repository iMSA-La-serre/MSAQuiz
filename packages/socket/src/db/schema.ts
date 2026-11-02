import type { GameResult } from "@razzia/common/types/game"
import type { QuizzValidated } from "@razzia/common/validators/quizz"
import { sql } from "drizzle-orm"
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core"

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  // Identifiant de connexion : l'adresse e-mail en minuscules, ou « admin »
  // pour le compte créé au premier démarrage.
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  // Rempli par le SSO Entra ID (null tant que l'utilisateur ne s'est pas
  // connecté via Microsoft).
  entraOid: text("entra_oid").unique(),
  role: text("role", { enum: ["admin", "creator"] })
    .notNull()
    .default("creator"),
  // Empreinte scrypt du mot de passe (services/password.ts), null tant que
  // le compte n'en a pas.
  passwordHash: text("password_hash"),
  // Mot de passe provisoire (création, réinitialisation, premier démarrage) :
  // à changer avant toute autre action.
  mustChangePassword: integer("must_change_password", { mode: "boolean" })
    .notNull()
    .default(false),
  // Un compte désactivé ne peut plus se connecter ; ses quiz restent.
  disabled: integer("disabled", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
})

// Sessions de l'interface animateur. L'identifiant est l'empreinte SHA-256 du
// jeton remis au navigateur : une copie de la base (une sauvegarde) n'ouvre
// aucune session.
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
)

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

export const results = sqliteTable("results", {
  id: text("id").primaryKey(),
  // Renseigné à la fin de la partie, null pour les résultats enregistrés
  // avant l'ajout de la colonne. Volontairement sans clé étrangère : SQLite
  // ne sait pas ajouter un ON DELETE à une colonne existante, et supprimer un
  // quiz ne doit ni échouer ni effacer l'historique de ses parties.
  quizzId: text("quizz_id"),
  subject: text("subject").notNull(),
  // ISO 8601, même valeur que GameResult.date (tri lexicographique OK).
  date: text("date").notNull(),
  playerCount: integer("player_count").notNull(),
  // GameResult complet (questions, réponses par joueur, classement).
  data: text("data", { mode: "json" }).notNull().$type<GameResult>(),
})

// Lignes par joueur pour les requêtes d'historique/statistiques
// (suivi d'un joueur dans le temps) sans scanner les JSON.
export const resultPlayers = sqliteTable(
  "result_players",
  {
    resultId: text("result_id")
      .notNull()
      .references(() => results.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    points: integer("points").notNull(),
    rank: integer("rank").notNull(),
  },
  (table) => [primaryKey({ columns: [table.resultId, table.username] })],
)

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
