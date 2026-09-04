import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// The packages import each other through the `@razzia/*` aliases declared in
// tsconfig.json; mirror them here so tests resolve the same files.
const src = (pkg: string) =>
  fileURLToPath(new URL(`./packages/${pkg}/src/`, import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@razzia\/common\//u, replacement: src("common") },
      { find: /^@razzia\/socket\//u, replacement: src("socket") },
    ],
  },
  test: {
    environment: "node",
    include: ["packages/{common,socket}/src/**/*.test.ts"],
  },
})
