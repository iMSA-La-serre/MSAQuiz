import {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
} from "@razzia/common/constants"
import { inviteCodeValidator } from "@razzia/common/validators/auth"
import { createInviteCode } from "@razzia/socket/utils/game"
import { describe, expect, it, vi } from "vitest"

// `utils/game` also exports `withGame`, which reaches the game registry (and
// the database behind it). `createInviteCode` is pure, so both are stubbed.
vi.mock("@razzia/socket/services/game", () => ({ default: {} }))
vi.mock("@razzia/socket/services/registry", () => ({
  default: { getInstance: () => ({ getGameById: () => null }) },
}))

describe("createInviteCode", () => {
  it("draws codes that the join validator accepts", () => {
    for (let i = 0; i < 500; i += 1) {
      const code = createInviteCode()

      expect(code).toHaveLength(INVITE_CODE_LENGTH)
      expect(
        code.split("").every((char) => INVITE_CODE_ALPHABET.includes(char)),
      ).toBe(true)
      expect(inviteCodeValidator.safeParse(code).success).toBe(true)
    }
  })

  it("draws codes that survive being read back from a URL search param", () => {
    // The web router JSON-parses search params: a code like "2E345" would come
    // back as Infinity, so the alphabet must not allow that shape at all.
    expect(INVITE_CODE_ALPHABET).not.toContain("E")

    for (let i = 0; i < 2000; i += 1) {
      const code = createInviteCode()
      let parsed: unknown = code

      try {
        parsed = JSON.parse(code)
      } catch {
        // Not valid JSON: the router keeps the raw string.
      }

      expect(String(parsed)).toBe(code)
    }
  })

  it("spreads draws over the alphabet", () => {
    const seen = new Set(
      Array.from({ length: 200 }, () => createInviteCode()).join(""),
    )

    expect(seen.size).toBeGreaterThan(INVITE_CODE_ALPHABET.length / 2)
  })
})
