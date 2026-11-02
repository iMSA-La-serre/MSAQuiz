import {
  inviteCodeValidator,
  newUserValidator,
  normalizeLogin,
  passwordValidator,
} from "@razzia/common/validators/auth"
import { describe, expect, it } from "vitest"

describe("passwordValidator", () => {
  it("asks for a length, not a mix of character kinds", () => {
    expect(passwordValidator.safeParse("une phrase facile").success).toBe(true)
    expect(passwordValidator.safeParse("aaaaaaaaaaaa").success).toBe(true)
  })

  it.each([
    ["too short", "Court!1", "errors:manager.passwordTooShort"],
    ["too long", "x".repeat(129), "errors:manager.passwordTooLong"],
  ])("refuses a password %s", (_, password, message) => {
    expect(passwordValidator.safeParse(password).error?.issues[0].message).toBe(
      message,
    )
  })
})

describe("newUserValidator", () => {
  it("keeps the address as it is signed in with: trimmed, lower case", () => {
    expect(
      newUserValidator.parse({
        name: " Camille Martin ",
        email: " Camille.Martin@MSA.fr ",
        role: "creator",
      }),
    ).toEqual({
      name: "Camille Martin",
      email: "camille.martin@msa.fr",
      role: "creator",
    })
  })

  it.each([
    ["an empty name", { name: " " }, "errors:users.invalidName"],
    ["a name too long", { name: "x".repeat(61) }, "errors:users.invalidName"],
    ["admin as an address", { email: "admin" }, "errors:users.invalidEmail"],
    [
      "an address without a domain",
      { email: "a@b" },
      "errors:users.invalidEmail",
    ],
  ])("refuses %s", (_, change, message) => {
    const result = newUserValidator.safeParse({
      name: "Camille",
      email: "camille@msa.fr",
      role: "creator",
      ...change,
    })

    expect(result.error?.issues[0].message).toBe(message)
  })

  it("refuses a role that does not exist", () => {
    expect(
      newUserValidator.safeParse({
        name: "Camille",
        email: "camille@msa.fr",
        role: "owner",
      }).success,
    ).toBe(false)
  })
})

describe("normalizeLogin", () => {
  it("signs in whatever the case and surrounding spaces", () => {
    expect(normalizeLogin(" Admin ")).toBe("admin")
    expect(normalizeLogin("Camille.Martin@MSA.fr")).toBe(
      "camille.martin@msa.fr",
    )
  })
})

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
