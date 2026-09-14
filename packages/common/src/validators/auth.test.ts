import { inviteCodeValidator } from "@razzia/common/validators/auth"
import { describe, expect, it } from "vitest"

describe("inviteCodeValidator", () => {
  it("accepts a code from the alphabet, ignoring case and spaces", () => {
    expect(inviteCodeValidator.parse("7K2PX")).toBe("7K2PX")
    expect(inviteCodeValidator.parse(" 7k2px ")).toBe("7K2PX")
  })

  it.each([
    ["a look-alike zero", "7K2P0"],
    ["a look-alike letter O", "7K2PO"],
    ["a look-alike letter I", "7K2PI"],
    ["a look-alike letter L", "7K2PL"],
    ["a look-alike one", "7K2P1"],
    ["the letter E, which a URL parser can read as an exponent", "2E345"],
    ["too few characters", "7K2P"],
    ["too many characters", "7K2PXM"],
    ["the old 6-digit PIN format", "482707"],
    ["an empty string", ""],
  ])("rejects %s", (_, code) => {
    const result = inviteCodeValidator.safeParse(code)

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe(
      "errors:auth.invalidInviteCode",
    )
  })
})
