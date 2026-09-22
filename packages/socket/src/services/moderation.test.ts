import { getModerationWords } from "@razzia/socket/services/moderation"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// A fresh config folder for each test, read through CONFIG_PATH.
let dir = ""

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "msaquiz-moderation-"))
  vi.stubEnv("CONFIG_PATH", dir)
  vi.spyOn(console, "warn").mockImplementation(() => undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe("getModerationWords", () => {
  it("adds nothing without a moderation.txt", () => {
    expect(getModerationWords()).toEqual([])
  })

  it("reads one word or expression per line, without comments", () => {
    fs.writeFileSync(
      path.join(dir, "moderation.txt"),
      "# Caisse de l'Ain\r\npatate\n\nvieille branche\n",
    )

    expect(getModerationWords()).toEqual(["patate", "vieille branche"])
  })

  it("reads an edited file again", () => {
    const file = path.join(dir, "moderation.txt")

    fs.writeFileSync(file, "patate\n")
    expect(getModerationWords()).toEqual(["patate"])

    fs.writeFileSync(file, "tomate\n")
    expect(getModerationWords()).toEqual(["tomate"])
  })

  it("ignores a folder in place of the file, and a file too large", () => {
    const file = path.join(dir, "moderation.txt")

    fs.mkdirSync(file)
    expect(getModerationWords()).toEqual([])

    fs.rmdirSync(file)
    fs.writeFileSync(file, "a\n".repeat(600_000))
    expect(getModerationWords()).toEqual([])
    expect(console.warn).toHaveBeenCalled()
  })
})
