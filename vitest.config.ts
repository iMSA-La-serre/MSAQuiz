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
      { find: /^@razzia\/web\//u, replacement: src("web") },
    ],
  },
  test: {
    environment: "node",
    // Web tests cover pure logic only (.ts, no DOM): the environment stays
    // node.
    include: ["packages/{common,socket,web}/src/**/*.test.ts"],
  },
})
