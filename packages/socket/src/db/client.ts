import * as schema from "@razzia/socket/db/schema"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import fs from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

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
 * NB déploiement : dans le bundle esbuild, le dossier `migrations` doit être
 * copié à côté de `index.cjs` (il est résolu via `import.meta.url`).
 */
export const runMigrations = () => {
  migrate(db, {
    migrationsFolder: fileURLToPath(new URL("./migrations", import.meta.url)),
  })
}
