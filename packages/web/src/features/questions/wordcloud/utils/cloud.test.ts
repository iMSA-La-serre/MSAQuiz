import {
  cloudCounts,
  fitSize,
  WORD_COLORS,
  WORD_SIZES,
  wordColor,
  wordDisplay,
  wordSizes,
  wordsInRoom,
} from "@razzia/web/features/questions/wordcloud/utils/cloud"
import { describe, expect, it } from "vitest"

describe("wordSizes", () => {
  it("gives the most frequent word the largest size, the rarest the smallest", () => {
    expect(wordSizes([9, 4, 1])).toEqual([4, 2, 0])
  })

  it("follows the square root of the counts, as an area would", () => {
    // Square roots 4, 3, 2, 1 → shares 1, 2/3, 1/3, 0 of the four steps.
    expect(wordSizes([16, 9, 4, 1])).toEqual([4, 3, 1, 0])
  })

  it("gives the middle size to words all given as often", () => {
    expect(wordSizes([2, 2, 2])).toEqual([2, 2, 2])
    expect(wordSizes([1])).toEqual([2])
  })

  it("stays within the sizes available", () => {
    const sizes = wordSizes([100, 50, 10, 3, 1, 1])

    expect(Math.max(...sizes)).toBe(WORD_SIZES.length - 1)
    expect(Math.min(...sizes)).toBe(0)
  })

  it("has nothing to size without words", () => {
    expect(wordSizes([])).toEqual([])
  })
})

describe("wordColor", () => {
  it("cycles through the colours of the charte", () => {
    expect(
      Array.from({ length: WORD_COLORS.length + 1 }, (_, i) => wordColor(i)),
    ).toEqual([...WORD_COLORS, WORD_COLORS[0]])
  })
})

describe("wordsInRoom", () => {
  const room = { words: 4, weight: 40, factors: [1, 2] }

  it("keeps the words that fit, the most frequent first", () => {
    // (4 + 3) × 2 = 14, then (3 + 3) × 1 = 6 each.
    expect(wordsInRoom(["Aaaa", "Bbb", "Ccc", "Ddd"], [1, 0, 0, 0], room)).toBe(
      4,
    )
    // (10 + 3) × 2 = 26, then 26 again: past 40.
    expect(
      wordsInRoom(["Aaaaaaaaaa", "Bbbbbbbbbb", "Cc"], [1, 1, 0], room),
    ).toBe(1)
  })

  it("never keeps more words than the room holds", () => {
    const texts = ["A", "B", "C", "D", "E", "F"]

    expect(
      wordsInRoom(
        texts,
        texts.map(() => 0),
        room,
      ),
    ).toBe(4)
  })

  it("counts characters, not UTF-16 units", () => {
    // (6 + 3) × 1 = 9 each: 18 fits exactly.
    expect(
      wordsInRoom(["Écoute", "Équité"], [0, 0], { ...room, weight: 18 }),
    ).toBe(2)
  })

  it("keeps thirty short words on a regular or tall projector, twenty on a short one", () => {
    const texts = Array.from({ length: 40 }, (_, index) => `Mot ${index}`)
    const sizes = texts.map(() => 0)

    expect(cloudCounts(texts, sizes)).toEqual({
      short: 20,
      regular: 30,
      tall: 30,
    })
  })

  it("keeps fewer long expressions, the most on a tall projector", () => {
    const texts = Array.from({ length: 30 }, () => "e".repeat(30))
    const sizes = texts.map(() => 0)

    // 33 characters each.
    expect(cloudCounts(texts, sizes)).toEqual({
      short: 10,
      regular: 14,
      tall: 16,
    })
  })
})

describe("wordDisplay", () => {
  const counts = { short: 2, regular: 4, tall: 6 }

  it("hides the words past the room of each projector", () => {
    expect(
      [0, 1, 2, 3, 4, 5].map((index) => wordDisplay(index, counts)),
    ).toEqual([
      "",
      "",
      "short:hidden",
      "short:hidden",
      "hidden xl:tall:block",
      "hidden xl:tall:block",
    ])
  })

  it("shows on one projector a word the regular one leaves out", () => {
    expect(wordDisplay(3, { short: 4, regular: 3, tall: 2 })).toBe(
      "hidden short:block",
    )
    expect(wordDisplay(2, { short: 4, regular: 3, tall: 2 })).toBe(
      "xl:tall:hidden",
    )
  })
})

describe("fitSize", () => {
  it("keeps the largest sizes for words short enough to fit a line", () => {
    expect(fitSize(4, "Proximité")).toBe(4)
    expect(fitSize(4, "Accompagnement")).toBe(4)
    expect(fitSize(4, "Dématérialisation")).toBe(3)
    expect(fitSize(4, "Accompagnement personnalisé")).toBe(2)
    expect(fitSize(3, "Accompagnement personnalisé")).toBe(2)
  })

  it("never makes a word larger", () => {
    expect(fitSize(0, "Accompagnement personnalisé")).toBe(0)
    expect(fitSize(1, "Écoute")).toBe(1)
  })
})
