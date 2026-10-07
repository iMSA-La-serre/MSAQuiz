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

// The load test as one file, which the image ships next to the server: it
// runs where only Node is, in the container or on any machine.
await esbuild.build({
  entryPoints: ["scripts/load-test.ts"],
  bundle: true,
  minify: true,
  platform: "node",
  outfile: "dist/load-test.cjs",
})

// Ship the migrations next to the bundle (runMigrations resolves them via
// __dirname), so `pnpm build && pnpm start` works outside Docker too.
// oxlint-disable-next-line no-unsafe-call
cpSync("src/db/migrations", "dist/migrations", { recursive: true })
