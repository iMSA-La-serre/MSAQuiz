import esbuild from "esbuild"
import { cpSync } from "node:fs"

export const config = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  minify: true,
  platform: "node",
  outfile: "dist/index.cjs",
  sourcemap: true,
  external: ["better-sqlite3"],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
}

await esbuild.build(config)

// Ship the migrations next to the bundle (runMigrations resolves them via
// __dirname), so `pnpm build && pnpm start` works outside Docker too.
// oxlint-disable-next-line no-unsafe-call
cpSync("src/db/migrations", "dist/migrations", { recursive: true })
