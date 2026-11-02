import {
  createTemporaryPassword,
  hashPassword,
  verifyPassword,
} from "@razzia/socket/services/password"
import { describe, expect, it } from "vitest"

describe("password hashing", () => {
  it("recognizes the password it hashed, and only it", async () => {
    const hash = await hashPassword("une phrase facile à retenir")

    expect(hash).toMatch(/^scrypt\$16384\$8\$5\$[\w+/=]+\$[\w+/=]+$/u)
    expect(hash).not.toContain("phrase")
    await expect(
      verifyPassword("une phrase facile à retenir", hash),
    ).resolves.toBe(true)
    await expect(
      verifyPassword("une phrase facile à retenir ", hash),
    ).resolves.toBe(false)
  })

  it("salts each hash", async () => {
    const [first, second] = await Promise.all([
      hashPassword("même mot de passe"),
      hashPassword("même mot de passe"),
    ])

    expect(first).not.toBe(second)
  })

  it("reads an accent typed composed or decomposed alike", async () => {
    const hash = await hashPassword("café crème".normalize("NFC"))

    await expect(
      verifyPassword("café crème".normalize("NFD"), hash),
    ).resolves.toBe(true)
  })

  it.each([
    ["an empty value", ""],
    ["another scheme", "bcrypt$10$abc$def"],
    ["a missing key", "scrypt$16384$8$5$c2Fsdg==$"],
    ["an empty key", "scrypt$16384$8$5$c2Fsdg==$!!!!"],
    ["impossible settings", `scrypt$3$8$5$c2Fsdg==$${"A".repeat(88)}`],
  ])("lets nobody in with %s", async (_, stored) => {
    await expect(verifyPassword("", stored)).resolves.toBe(false)
    await expect(verifyPassword("n'importe quoi", stored)).resolves.toBe(false)
  })
})

describe("createTemporaryPassword", () => {
  it("gives three groups of four characters without look-alikes", () => {
    const passwords = Array.from({ length: 50 }, createTemporaryPassword)

    for (const password of passwords) {
      expect(password).toMatch(
        /^[a-km-np-zA-HJ-NP-Z2-9]{4}(?:-[a-km-np-zA-HJ-NP-Z2-9]{4}){2}$/u,
      )
    }

    expect(new Set(passwords).size).toBe(passwords.length)
  })
})
