import { resolve } from "node:path"
import { defineConfig } from "drizzle-kit"

// Same resolution as src/db/client.ts, so `db:studio` opens the right file.
const configPath = process.env.CONFIG_PATH
  ? resolve(process.env.CONFIG_PATH)
  : resolve(process.cwd(), "../../config")

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    url: resolve(configPath, "msaquiz.db"),
  },
})
