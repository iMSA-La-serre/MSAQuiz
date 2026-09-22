import {
  buildBlocklist,
  hasContactDetails,
  isBlocked,
  parseModerationList,
} from "@razzia/common/utils/moderation"
import { describe, expect, it } from "vitest"

describe("isBlocked, built-in list", () => {
  it("drops common swear words and insults, whatever the case and accents", () => {
    expect(isBlocked("merde")).toBe(true)
    expect(isBlocked("MERDE !")).toBe(true)
    expect(isBlocked("Connard")).toBe(true)
    expect(isBlocked("encule")).toBe(true)
    expect(isBlocked("Enculé")).toBe(true)
    expect(isBlocked("pédé")).toBe(true)
  })

  it("catches a word inside an expression, and its plural", () => {
    expect(isBlocked("gros con")).toBe(true)
    expect(isBlocked("fils de pute")).toBe(true)
    expect(isBlocked("des connards")).toBe(true)
    expect(isBlocked("bande de cons")).toBe(true)
    expect(isBlocked("l'enculé")).toBe(true)
  })

  it("catches the listed expressions as a sequence of words", () => {
    expect(isBlocked("Ta gueule")).toBe(true)
    expect(isBlocked("trou-du-cul")).toBe(true)
    expect(isBlocked("tête de nœud")).toBe(true)
  })

  it("reads a letter typed three times or more once or twice", () => {
    expect(isBlocked("merdeeee")).toBe(true)
    expect(isBlocked("connnnnard")).toBe(true)
  })

  it("keeps words that only contain a listed one", () => {
    expect(isBlocked("Consultation")).toBe(false)
    expect(isBlocked("Technique")).toBe(false)
    expect(isBlocked("Unique")).toBe(false)
    expect(isBlocked("Contact")).toBe(false)
    expect(isBlocked("Cul-de-sac")).toBe(false)
  })

  it("keeps words with an innocent meaning left out of the list", () => {
    expect(isBlocked("Fumier")).toBe(false)
    expect(isBlocked("File d'attente")).toBe(false)
    expect(isBlocked("Queue")).toBe(false)
  })

  it("keeps ordinary answers", () => {
    for (const text of ["Solidarité", "Proximité", "Écoute", "MSA", "2025"]) {
      expect(isBlocked(text), text).toBe(false)
    }
  })
})

describe("isBlocked, contact details", () => {
  it("drops e-mail addresses", () => {
    expect(isBlocked("jean.dupont@msa.fr")).toBe(true)
    expect(isBlocked("écrire à a@b.co")).toBe(true)
  })

  it("drops links and bare domain names", () => {
    expect(isBlocked("https://exemple.org")).toBe(true)
    expect(isBlocked("www.exemple")).toBe(true)
    expect(isBlocked("msa.fr")).toBe(true)
    expect(isBlocked("Voir EXEMPLE.COM/page")).toBe(true)
  })

  it("drops phone numbers, spaced or not", () => {
    expect(isBlocked("06 12 34 56 78")).toBe(true)
    expect(isBlocked("0612345678")).toBe(true)
    expect(isBlocked("+33 6 12 34 56 78")).toBe(true)
    expect(isBlocked("06.12.34.56.78")).toBe(true)
  })

  it("keeps numbers that are not phone numbers", () => {
    expect(hasContactDetails("2025-2026")).toBe(false)
    expect(hasContactDetails("35 caisses")).toBe(false)
    expect(hasContactDetails("1 000 000")).toBe(false)
    expect(hasContactDetails("M.S.A.")).toBe(false)
    expect(hasContactDetails("@MSA")).toBe(false)
  })
})

describe("buildBlocklist", () => {
  it("adds the words and expressions of moderation.txt to the built-in list", () => {
    const blocklist = buildBlocklist(["Patate", "vieille branche"])

    expect(isBlocked("PATATES", blocklist)).toBe(true)
    expect(isBlocked("Ma vieille branche", blocklist)).toBe(true)
    expect(isBlocked("branche", blocklist)).toBe(false)
    expect(isBlocked("merde", blocklist)).toBe(true)
    expect(isBlocked("Patate")).toBe(false)
  })

  it("ignores entries with nothing to compare", () => {
    const blocklist = buildBlocklist(["", "!!!", "  "])

    expect(isBlocked("!!!", blocklist)).toBe(false)
    expect(isBlocked("Écoute", blocklist)).toBe(false)
  })
})

describe("parseModerationList", () => {
  it("reads one entry per line, without blank lines and comments", () => {
    expect(
      parseModerationList(
        "# Caisse de l'Ain\r\npatate\n\n  vieille branche  \n#fin",
      ),
    ).toEqual(["patate", "vieille branche"])
  })
})
