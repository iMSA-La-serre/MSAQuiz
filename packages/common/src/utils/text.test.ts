import {
  answerKey,
  cleanInput,
  countInputChars,
  matchAccepted,
} from "@razzia/common/utils/text"
import { describe, expect, it } from "vitest"

// Invisible or look-alike characters, spelled by code point to stay readable.
const char = (codePoint: number) => String.fromCodePoint(codePoint)
const ZERO_WIDTH_SPACE = char(0x200b)
const ZERO_WIDTH_JOINER = char(0x200d)
const SOFT_HYPHEN = char(0xad)
const BOM = char(0xfeff)
const NO_BREAK_SPACE = char(0xa0)
const NARROW_NO_BREAK_SPACE = char(0x202f)
const COMBINING_ACUTE = char(0x301)
const RIGHT_QUOTE = char(0x2019)
const MODIFIER_APOSTROPHE = char(0x2bc)
const ACUTE_ACCENT = char(0xb4)
const EN_DASH = char(0x2013)
const EM_DASH = char(0x2014)
const MINUS_SIGN = char(0x2212)

describe("cleanInput", () => {
  it("collapses and trims spaces, tabs and line breaks", () => {
    expect(cleanInput("  Paris \t la\n\nbelle  ")).toBe("Paris la belle")
  })

  it("removes zero width characters, soft hyphens and BOM", () => {
    expect(
      cleanInput(
        `${BOM}Pa${ZERO_WIDTH_SPACE}ri${SOFT_HYPHEN}s${ZERO_WIDTH_JOINER}`,
      ),
    ).toBe("Paris")
  })

  it("applies NFKC: full width letters, ligatures, no-break spaces", () => {
    expect(cleanInput("ＰＡＲＩＳ")).toBe("PARIS")
    expect(cleanInput("ﬁn")).toBe("fin")
    expect(cleanInput(`la${NO_BREAK_SPACE}fin`)).toBe("la fin")
  })

  it("keeps case, accents and emoji", () => {
    expect(cleanInput("Élysée 🎉")).toBe("Élysée 🎉")
  })

  it("cuts the raw text before any processing", () => {
    expect(cleanInput("a".repeat(250))).toHaveLength(200)
    expect(cleanInput(`${" ".repeat(200)}Paris`)).toBe("")
  })

  it("drops the half emoji a cut can leave behind", () => {
    expect(cleanInput(`${"a".repeat(199)}😀`)).toBe("a".repeat(199))
  })
})

describe("countInputChars", () => {
  it("counts what the player sees once cleaned", () => {
    expect(countInputChars("  Paris  ")).toBe(5)
    expect(countInputChars(`Pa${ZERO_WIDTH_SPACE}ris`)).toBe(5)
  })

  it("counts an accented letter once, even typed as two code points", () => {
    expect(countInputChars(`E${COMBINING_ACUTE}lyse${COMBINING_ACUTE}e`)).toBe(
      6,
    )
  })

  it("counts an emoji once", () => {
    expect(countInputChars("🎉")).toBe(1)
  })
})

describe("answerKey", () => {
  it("ignores case and accents", () => {
    expect(answerKey("ÉLYSÉE")).toBe("elysee")
    expect(answerKey("España")).toBe("espana")
  })

  it("only strips the combining marks of Latin accents", () => {
    expect(answerKey("Москва")).toBe("москва")
    expect(answerKey("東京")).toBe("東京")
  })

  it("reads every apostrophe alike", () => {
    const key = answerKey("l'eau")

    expect(key).toBe("l eau")
    expect(answerKey(`l${RIGHT_QUOTE}eau`)).toBe(key)
    expect(answerKey(`l${MODIFIER_APOSTROPHE}eau`)).toBe(key)
    expect(answerKey("l`eau")).toBe(key)
    expect(answerKey(`l${ACUTE_ACCENT}eau`)).toBe(key)
  })

  it("reads every dash alike, and as a space between words", () => {
    const key = answerKey("Saint-Étienne")

    expect(key).toBe("saint etienne")
    expect(answerKey(`Saint${EN_DASH}Etienne`)).toBe(key)
    expect(answerKey(`Saint${EM_DASH}Etienne`)).toBe(key)
    expect(answerKey("saint etienne")).toBe(key)
  })

  it("spells out œ and æ", () => {
    expect(answerKey("Cœur")).toBe("coeur")
    expect(answerKey("Œuvre")).toBe("oeuvre")
    expect(answerKey("Ægypte")).toBe("aegypte")
  })

  it("drops punctuation", () => {
    expect(answerKey("« Paris ! »")).toBe("paris")
    expect(answerKey("Paris...")).toBe("paris")
  })

  it("keeps a separator between two digits", () => {
    expect(answerKey("1/2")).toBe("1/2")
    expect(answerKey("1/2")).not.toBe(answerKey("12"))
    expect(answerKey("1.5")).not.toBe(answerKey("15"))
    expect(answerKey("1,5")).toBe("1,5")
    expect(answerKey("10:30")).toBe("10:30")
    expect(answerKey("3.14.")).toBe("3.14")
    expect(answerKey("1, 2")).toBe("1 2")
  })

  it("keeps a leading minus sign", () => {
    expect(answerKey("-5")).toBe("-5")
    expect(answerKey("-5")).not.toBe(answerKey("5"))
    expect(answerKey(`${MINUS_SIGN}5`)).toBe("-5")
  })

  it("joins digit groups", () => {
    expect(answerKey("1 000")).toBe("1000")
    expect(answerKey("1 000 000 €")).toBe("1000000 €")
    expect(answerKey(`1${NO_BREAK_SPACE}000`)).toBe("1000")
    expect(answerKey(`1${NARROW_NO_BREAK_SPACE}000`)).toBe("1000")
  })

  it("ignores zero width characters", () => {
    expect(answerKey(`Pa${ZERO_WIDTH_SPACE}ris`)).toBe("paris")
  })

  it("keeps emoji, which are not punctuation", () => {
    expect(answerKey("🎉")).toBe("🎉")
    expect(answerKey("Paris 🎉")).toBe("paris 🎉")
  })

  it("is empty for punctuation or spaces only", () => {
    expect(answerKey("?! …")).toBe("")
    expect(answerKey("   ")).toBe("")
  })
})

describe("matchAccepted", () => {
  const CITIES = ["Paris", "Lutèce"]

  it("finds the accepted answer with the same key", () => {
    expect(matchAccepted(CITIES, "  PARIS ! ")).toBe(0)
    expect(matchAccepted(CITIES, "lutece")).toBe(1)
    expect(matchAccepted(CITIES, "Lyon")).toBe(-1)
  })

  it("never matches an empty key", () => {
    expect(matchAccepted(["?"], "!")).toBe(-1)
    expect(matchAccepted([""], "")).toBe(-1)
    expect(matchAccepted(["?", "Paris"], "...")).toBe(-1)
  })

  it("tolerates no typo unless asked", () => {
    expect(matchAccepted(["Versailles"], "Versaille")).toBe(-1)
    expect(
      matchAccepted(["Versailles"], "Versaille", { typoTolerance: true }),
    ).toBe(0)
  })

  it("prefers an exact match to an earlier close one", () => {
    expect(
      matchAccepted(["Versailes", "Versailles"], "Versailles", {
        typoTolerance: true,
      }),
    ).toBe(1)
  })

  describe("with typoTolerance", () => {
    const match = (accepted: string[], input: string) =>
      matchAccepted(accepted, input, { typoTolerance: true })

    it("tolerates nothing under 6 characters", () => {
      expect(match(["Rouen"], "Rouan")).toBe(-1)
      expect(match(["Paris"], "Pari")).toBe(-1)
    })

    it("tolerates one typo from 6 to 11 characters", () => {
      expect(match(["Madrid"], "Madird")).toBe(0)
      expect(match(["Montpellier"], "Montpelier")).toBe(0)
      expect(match(["Montpellier"], "Monpelier")).toBe(-1)
    })

    it("tolerates two typos from 12 characters", () => {
      expect(match(["Montparnasse"], "Mnotparnase")).toBe(0)
      expect(match(["Montparnasse"], "Mnotparnas")).toBe(-1)
    })

    it("counts a swap of two neighbours as one typo", () => {
      expect(match(["Bordeaux"], "Bordeuax")).toBe(0)
    })

    it("never approximates an answer holding a digit", () => {
      expect(match(["1914"], "1915")).toBe(-1)
      expect(match(["Mai 1968 à Paris"], "Mai 1969 à Paris")).toBe(-1)
    })

    it("never approximates an answer holding a Roman numeral", () => {
      expect(match(["Henri IV"], "Henri VI")).toBe(-1)
      expect(match(["Louis XIV"], "Louis XV")).toBe(-1)
      expect(match(["Louis XIV"], "Louis XVI")).toBe(-1)
      expect(match(["XIXe siècle"], "XXe siècle")).toBe(-1)
      expect(match(["XIXe siècle"], "XIVe siècle")).toBe(-1)
      expect(match(["François Ier"], "François Iier")).toBe(-1)
      expect(match(["Louis XIVème"], "Louis XVème")).toBe(-1)
      expect(match(["Ve République"], "IVe République")).toBe(-1)
      // An exact match still counts, whatever the case.
      expect(match(["Louis XIV"], "louis xiv")).toBe(0)
    })

    it("still approximates capitals that are not numerals", () => {
      // Elided articles, and capitals inside a word.
      expect(match(["L'Arc de Triomphe"], "L'Arc de Triomph")).toBe(0)
      expect(match(["D'Artagnan"], "D'Artagnam")).toBe(0)
      expect(match(["Montmartre"], "Montmatre")).toBe(0)
      expect(match(["MIMOSA"], "MIMOZA")).toBe(0)
      // A lone L, C, D or M with a suffix is a word, not an ordinal.
      expect(match(["Le Havre"], "Le Havr")).toBe(0)
      expect(match(["De Gaulle"], "De Gaule")).toBe(0)
      expect(match(["Mer Noire"], "Mer Noir")).toBe(0)
    })

    it("picks the closest answer, the first one on a tie", () => {
      expect(match(["Marseilles", "Marseille"], "Marseile")).toBe(1)
      expect(match(["Nantes", "Mantes"], "Lantes")).toBe(0)
    })
  })
})
