import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import fs from "node:fs"
import type { IncomingMessage, ServerResponse } from "node:http"
import path from "node:path"
import { fileURLToPath } from "url"
import { defineConfig, type Plugin } from "vite"
import { version } from "../../package.json"
import { collectThirdPartyLicenses } from "./scripts/third-party-licenses"

const brandingDir = fileURLToPath(
  new URL("../../config/branding", import.meta.url),
)

const brandingMimeTypes: Record<string, string> = {
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".css": "text/css",
  ".woff2": "font/woff2",
}

const serveBranding = (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
): void => {
  if (!req.url?.startsWith("/branding/")) {
    next()

    return
  }

  const [relative] = req.url.replace(/^\/branding\//, "").split("?")
  const filePath = path.join(brandingDir, relative)

  if (!filePath.startsWith(brandingDir) || !fs.existsSync(filePath)) {
    res.statusCode = 404
    res.end()

    return
  }

  res.setHeader(
    "Content-Type",
    brandingMimeTypes[path.extname(filePath)] ?? "application/octet-stream",
  )

  fs.createReadStream(filePath).pipe(res)
}

/** Serves the optional `config/branding` folder at `/branding/` in `vite dev` and `vite preview` (nginx does this in prod). */
const brandingServer = (): Plugin => ({
  name: "razzia-branding-server",
  configureServer(server) {
    server.middlewares.use(serveBranding)
  },
  configurePreviewServer(server) {
    server.middlewares.use(serveBranding)
  },
})

/**
 * Serves `/licenses.json`, the licences of every open-source package the app
 * depends on, read by the licences page. Emitted as a static file at build time
 * and computed on request in `vite dev`.
 */
const thirdPartyLicenses = (): Plugin => {
  let json: string | null = null

  const getJson = () => {
    json ??= JSON.stringify(
      collectThirdPartyLicenses(
        ["./", "../socket", "../common"].map((dir) =>
          fileURLToPath(new URL(dir, import.meta.url)),
        ),
      ),
    )

    return json
  }

  return {
    name: "msaquiz-third-party-licenses",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== "/licenses.json") {
          next()

          return
        }

        res.setHeader("Content-Type", "application/json")
        res.end(getJson())
      })
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "licenses.json",
        source: getJson(),
      })
    },
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    tanstackRouter({
      target: "react",
      routeToken: "layout",
      routesDirectory: "./src/pages",
      generatedRouteTree: "./src/route.gen.ts",
    }),
    react(),
    tailwindcss(),
    brandingServer(),
    thirdPartyLicenses(),
  ],
  resolve: {
    alias: {
      "@razzia/web": fileURLToPath(new URL("./src", import.meta.url)),
      "@razzia/common": fileURLToPath(
        new URL("../common/src", import.meta.url),
      ),
      "@razzia/socket": fileURLToPath(
        new URL("../socket/src", import.meta.url),
      ),
    },
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
    proxy: {
      "/ws": {
        target: "http://localhost:3001",
        ws: true,
      },
    },
  },
  preview: {
    port: 3000,
    host: "0.0.0.0",
  },
  build: {
    chunkSizeWarningLimit: 2000,
  },
})
