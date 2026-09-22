import { countWords, wordCountOf } from "@razzia/common/utils/wordcloud"
import { describe, expect, it } from "vitest"

const typed = (...texts: string[]) => texts.map((text) => ({ text }))

describe("countWords", () => {
  it("counts the same word once normalized as one", () => {
    expect(
      countWords(typed("Écoute", "écoute", "ECOUTE !", "Proximité")),
    ).toEqual([
      { text: "Écoute", count: 3 },
      { text: "Proximité", count: 1 },
    ])
  })

  it("shows each word in the form typed most often", () => {
    expect(countWords(typed("écoute", "Écoute", "Écoute"))).toEqual([
      { text: "Écoute", count: 3 },
    ])
  })

  it("breaks a tie between forms alphabetically, not by arrival", () => {
    expect(countWords(typed("Écoute", "écoute"))).toEqual(
      countWords(typed("écoute", "Écoute")),
    )
  })

  it("puts the most frequent words first", () => {
    expect(
      countWords(
        typed(
          "Terrain",
          "Solidarité",
          "Accueil",
          "Solidarité",
          "Écoute",
          "Accueil",
          "Solidarité",
        ),
      ),
    ).toEqual([
      { text: "Solidarité", count: 3 },
      { text: "Accueil", count: 2 },
      expect.objectContaining({ count: 1 }),
      expect.objectContaining({ count: 1 }),
    ])
  })

  it("gives the same result whatever the order the answers came in", () => {
    const words = ["Terrain", "Écoute", "écoute", "Accueil", "Proximité"]

    expect(countWords(typed(...words), "Q")).toEqual(
      countWords(typed(...[...words].reverse()), "Q"),
    )
  })

  // Words given once, A to Z: a cloud cut after the first ones must not keep
  // the start of the alphabet every time.
  const ALPHABET = Array.from(
    { length: 26 },
    (_, index) => `Mot ${String.fromCodePoint(65 + index)}`,
  )
  const order = (salt: string) =>
    countWords(typed(...ALPHABET), salt).map(({ text }) => text)

  it("does not break ties in alphabetical order", () => {
    const first = order("En un mot ?")

    expect([...first].sort()).toEqual(ALPHABET)
    expect(first).not.toEqual(ALPHABET)
    expect(first.slice(0, 13).sort()).not.toEqual(ALPHABET.slice(0, 13))
  })

  it("breaks ties the same way for the same question, not for every one", () => {
    expect(order("En un mot ?")).toEqual(order("En un mot ?"))
    expect(order("En un mot ?")).not.toEqual(order("Et en deux mots ?"))
  })

  it("adds up counts already made, as the statistics do across games", () => {
    expect(
      countWords([
        { text: "Écoute", count: 3 },
        { text: "écoute", count: 5 },
        { text: "Terrain", count: 2 },
      ]),
    ).toEqual([
      { text: "écoute", count: 8 },
      { text: "Terrain", count: 2 },
    ])
  })

  it("leaves out words with nothing to compare and counts that are not", () => {
    expect(
      countWords([
        { text: "!!!" },
        { text: "Écoute", count: 0 },
        { text: "Terrain", count: Number.NaN },
      ]),
    ).toEqual([])
  })
})

describe("wordCountOf", () => {
  it("reads the fields of a word cloud, 1 by default", () => {
    expect(wordCountOf(undefined)).toBe(1)
    expect(wordCountOf({})).toBe(1)
    expect(wordCountOf({ wordCount: 2 })).toBe(2)
    expect(wordCountOf({ wordCount: 3 })).toBe(3)
  })

  it("keeps a stored value within 1 to 3", () => {
    expect(wordCountOf({ wordCount: 0 })).toBe(1)
    expect(wordCountOf({ wordCount: 9 })).toBe(3)
    expect(wordCountOf({ wordCount: 1.5 })).toBe(1)
  })
})
