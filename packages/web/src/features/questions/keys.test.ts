import { duplicatesOf } from "@razzia/web/features/questions/keys"
import { describe, expect, it } from "vitest"

describe("duplicatesOf", () => {
  it("finds nothing in distinct texts", () => {
    expect(duplicatesOf(["Paris", "Lyon", "Marseille"]).size).toBe(0)
  })

  it("maps each repeat to the first text with the same key", () => {
    const duplicates = duplicatesOf(["Paris", "Lyon", "paris", "PARIS !"])

    expect([...duplicates]).toEqual([
      [2, 0],
      [3, 0],
    ])
  })

  it("ignores case, accents and punctuation like the validator", () => {
    expect(duplicatesOf(["Saint-Étienne", "saint etienne"]).get(1)).toBe(0)
  })

  it("leaves out texts without a key", () => {
    expect(duplicatesOf(["", "  ", "?!", "..."]).size).toBe(0)
  })
})
