import * as schema from "@razzia/socket/db/schema"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import fs from "node:fs"
import { resolve } from "node:path"

const configPath = process.env.CONFIG_PATH
  ? resolve(process.env.CONFIG_PATH)
  : resolve(process.cwd(), "../../config")

// Le dossier config peut ne pas encore exister au premier démarrage.
fs.mkdirSync(configPath, { recursive: true })

const sqlite = new Database(resolve(configPath, "msaquiz.db"))

sqlite.pragma("journal_mode = WAL")
sqlite.pragma("foreign_keys = ON")

export const db = drizzle(sqlite, { schema })

/**
 * Applique les migrations Drizzle au démarrage.
 *
 * Résolution du dossier `migrations` :
 * - bundle CJS (prod) : `__dirname` = dossier d'`index.cjs`, le Dockerfile
 *   copie `migrations/` juste à côté ;
 * - dev (tsx, ESM) : `__dirname` n'existe pas, on part du cwd du package.
 */
export const runMigrations = () => {
  const migrationsFolder =
    typeof __dirname === "undefined"
      ? resolve(process.cwd(), "src/db/migrations")
      : resolve(__dirname, "migrations")

  migrate(db, { migrationsFolder })
}
