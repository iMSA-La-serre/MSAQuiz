// Lists every open-source package installed for the app's production
// dependencies, with its licence and the licence/notice files it ships, so the
// licences page can reproduce them as MIT, ISC, BSD and Apache 2.0 require.
//
// The walk follows `dependencies` and `optionalDependencies` (never
// `devDependencies`) from the workspace packages. It errs on the side of listing
// too much: attributing a package that ends up unused is harmless, forgetting
// one that ships is not.
//
// A few packages ship no licence file. For those, the text comes from the
// "License" section of their README when it holds the notice, or is rebuilt
// from the licence they declare (standard wording, author from package.json).

import type {
  LicenseNotice,
  ThirdPartyLicense,
} from "../src/features/legal/types"
import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs"
import { basename, dirname, join } from "node:path"

interface PackageJson {
  name?: string
  version?: string
  author?: string | { name?: string }
  license?: string | { type?: string }
  licenses?: Array<{ type?: string }>
  repository?: string | { url?: string }
  homepage?: string
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

interface PendingPackage {
  entry: ThirdPartyLicense
  pkg: PackageJson
  dir: string
}

const NOTICE_FILE = /^(?:licen[cs]e|copying|notice)(?:[.-].*)?$/iu
const README_FILE = /^readme(?:[.-].*)?$/iu
const MAX_NOTICE_BYTES = 100_000
const WORKSPACE_SCOPE = "@razzia/"
const APACHE_2_MARKER = "Version 2.0, January 2004"

const MIT_TEXT = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`

const ISC_TEXT = `Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`

const readPackageJson = (dir: string): PackageJson =>
  JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as PackageJson

const readText = (file: string): string =>
  readFileSync(file, "utf8").replace(/\r\n/gu, "\n").trim()

// Resolves an installed package the way Node does: in a node_modules folder
// next to or above the package that requires it. pnpm keeps a package's own
// dependencies as siblings inside the same node_modules folder.
const findPackageDir = (name: string, fromDir: string): string | null => {
  let dir = fromDir

  for (;;) {
    const candidates = [join(dir, "node_modules", name)]

    if (basename(dir) === "node_modules") {
      candidates.push(join(dir, name))
    }

    const found = candidates.find((candidate) =>
      existsSync(join(candidate, "package.json")),
    )

    if (found) {
      return realpathSync(found)
    }

    const parent = dirname(dir)

    if (parent === dir) {
      return null
    }

    dir = parent
  }
}

const licenseOf = (pkg: PackageJson): string => {
  if (typeof pkg.license === "string") {
    return pkg.license
  }

  const declared =
    pkg.license?.type ??
    pkg.licenses
      ?.map((entry) => entry.type)
      .filter(Boolean)
      .join(" OR ")

  if (!declared) {
    return "UNKNOWN"
  }

  return declared
}

const repositoryOf = (pkg: PackageJson): string | null => {
  const raw =
    typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url

  if (!raw) {
    return pkg.homepage ?? null
  }

  if (/^[\w.-]+\/[\w.-]+$/u.test(raw)) {
    return `https://github.com/${raw}`
  }

  return raw
    .replace(/^git\+/u, "")
    .replace(/^git:\/\//u, "https://")
    .replace(/^github:/u, "https://github.com/")
    .replace(/^ssh:\/\/git@/u, "https://")
    .replace(/^git@([^:]+):/u, "https://$1/")
    .replace(/\.git$/u, "")
}

// "Jane Doe <jane@example.com> (https://example.com)" -> "Jane Doe"
const holderOf = (pkg: PackageJson): string => {
  const raw = typeof pkg.author === "string" ? pkg.author : pkg.author?.name
  const name = raw
    ?.replace(/<[^>]*>/gu, "")
    .replace(/\([^)]*\)/gu, "")
    .trim()

  if (!name) {
    return `The ${pkg.name ?? "package"} authors`
  }

  return name
}

const noticesOf = (dir: string): LicenseNotice[] =>
  readdirSync(dir)
    .filter((file) => NOTICE_FILE.test(file))
    .filter((file) => {
      const stats = statSync(join(dir, file))

      return stats.isFile() && stats.size <= MAX_NOTICE_BYTES
    })
    .sort()
    .map((file) => ({ file, text: readText(join(dir, file)) }))

// The "License" section of a README, when it actually holds a notice rather
// than just the licence name.
const readmeLicenseSection = (dir: string): LicenseNotice | null => {
  const readmes = readdirSync(dir)
    .filter((file) => README_FILE.test(file))
    .sort()

  for (const file of readmes) {
    const text = readText(join(dir, file))
    const heading = /^#{1,6}\s*licen[cs]e\b.*$/imu.exec(text)

    if (!heading) {
      continue
    }

    const body = text.slice(heading.index + heading[0].length)
    const nextHeading = /^#{1,6}\s/mu.exec(body)
    const section = (nextHeading ? body.slice(0, nextHeading.index) : body)
      .replace(/&lt;/gu, "<")
      .replace(/&gt;/gu, ">")
      .replace(/&amp;/gu, "&")
      .trim()

    if (/copyright|permission is hereby granted/iu.test(section)) {
      return { file: `${file} (License)`, text: section }
    }
  }

  return null
}

const generatedNotice = (
  pkg: PackageJson,
  license: string,
  apacheText: string | null,
): LicenseNotice | null => {
  const spdx = license.replace(/^\(|\)$/gu, "")

  if (spdx === "MIT" || spdx === "MIT/X11") {
    return {
      file: "MIT",
      text: `MIT License\n\nCopyright (c) ${holderOf(pkg)}\n\n${MIT_TEXT}`,
      generated: true,
    }
  }

  if (spdx === "ISC") {
    return {
      file: "ISC",
      text: `ISC License\n\nCopyright (c) ${holderOf(pkg)}\n\n${ISC_TEXT}`,
      generated: true,
    }
  }

  if (spdx === "Apache-2.0" && apacheText) {
    return { file: "Apache-2.0", text: apacheText, generated: true }
  }

  return null
}

export const collectThirdPartyLicenses = (
  workspaceDirs: string[],
): ThirdPartyLicense[] => {
  const packages = new Map<string, ThirdPartyLicense>()
  const pending: PendingPackage[] = []
  const visited = new Set<string>()

  const visit = (dir: string) => {
    if (visited.has(dir)) {
      return
    }

    visited.add(dir)

    const pkg = readPackageJson(dir)
    const isWorkspace = pkg.name?.startsWith(WORKSPACE_SCOPE) ?? true

    if (!isWorkspace && pkg.name && pkg.version) {
      const key = `${pkg.name}@${pkg.version}`

      if (!packages.has(key)) {
        const entry: ThirdPartyLicense = {
          name: pkg.name,
          version: pkg.version,
          license: licenseOf(pkg),
          repository: repositoryOf(pkg),
          notices: noticesOf(dir),
        }

        packages.set(key, entry)

        if (entry.notices.length === 0) {
          pending.push({ entry, pkg, dir })
        }
      }
    }

    const dependencies = {
      ...pkg.dependencies,
      ...pkg.optionalDependencies,
    }

    for (const name of Object.keys(dependencies)) {
      const dependencyDir = findPackageDir(name, dir)

      // An optional dependency for another platform is simply not installed.
      if (dependencyDir) {
        visit(dependencyDir)
      }
    }
  }

  for (const dir of workspaceDirs) {
    visit(realpathSync(dir))
  }

  const sorted = [...packages.values()].sort(
    (a, b) =>
      a.name.localeCompare(b.name, "en") ||
      a.version.localeCompare(b.version, "en", { numeric: true }),
  )

  // The Apache 2.0 text is taken from a package that ships it verbatim.
  const apacheText =
    sorted
      .flatMap((entry) => entry.notices)
      .find((notice) => notice.text.includes(APACHE_2_MARKER))?.text ?? null

  for (const { entry, pkg, dir } of pending) {
    const notice =
      readmeLicenseSection(dir) ??
      generatedNotice(pkg, entry.license, apacheText)

    if (notice) {
      entry.notices.push(notice)
    } else {
      console.warn(
        `[licences] ${entry.name}@${entry.version}: no licence text found (declared: ${entry.license})`,
      )
    }
  }

  return sorted
}
