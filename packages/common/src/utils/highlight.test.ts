import { HIGHLIGHT_LIMITS, SCORING_MODES } from "@razzia/common/constants"
import {
  foundPassages,
  formatHighlight,
  highlightLength,
  highlightScoringMode,
  parseHighlight,
  scoreHighlight,
} from "@razzia/common/utils/highlight"
import { describe, expect, it } from "vitest"

describe("parseHighlight", () => {
  it("splits plain text and passages, in order", () => {
    expect(
      parseHighlight("Le salarié doit [prévenir sa caisse] sous [48 heures]."),
    ).toEqual({
      parts: [
        { text: "Le salarié doit " },
        { text: "prévenir sa caisse", passage: 0 },
        { text: " sous " },
        { text: "48 heures", passage: 1 },
        { text: "." },
      ],
      passages: ["prévenir sa caisse", "48 heures"],
      issue: null,
    })
  })

  it("reads passages at both ends and side by side", () => {
    expect(parseHighlight("[Un][deux] trois [quatre]")).toEqual({
      parts: [
        { text: "Un", passage: 0 },
        { text: "deux", passage: 1 },
        { text: " trois " },
        { text: "quatre", passage: 2 },
      ],
      passages: ["Un", "deux", "quatre"],
      issue: null,
    })
  })

  it("cleans the text and trims each passage", () => {
    const parsed = parseHighlight("  Un​\n[ premier  passage ]\tici ")

    expect(parsed.passages).toEqual(["premier passage"])
    expect(parsed.parts).toEqual([
      { text: "Un " },
      { text: "premier passage", passage: 0 },
      { text: " ici" },
    ])
  })

  it("keeps a text without brackets as plain text", () => {
    expect(parseHighlight("Aucun passage.")).toEqual({
      parts: [{ text: "Aucun passage." }],
      passages: [],
      issue: null,
    })
    expect(parseHighlight("   ")).toEqual({
      parts: [],
      passages: [],
      issue: null,
    })
  })

  it("flags a bracket left open, and keeps it as text", () => {
    const parsed = parseHighlight("Un [passage] et [un autre")

    expect(parsed.issue).toBe("brackets")
    expect(parsed.passages).toEqual(["passage"])
    expect(parsed.parts.at(-1)).toEqual({ text: " et [un autre" })
  })

  it("flags a bracket closed without being opened", () => {
    const parsed = parseHighlight("Un] [passage]")

    expect(parsed.issue).toBe("brackets")
    expect(parsed.passages).toEqual(["passage"])
    expect(parsed.parts[0]).toEqual({ text: "Un] " })
  })

  it("flags a bracket opened inside a passage, and reads the inner one", () => {
    const parsed = parseHighlight("[un [deux] trois]")

    expect(parsed.issue).toBe("brackets")
    expect(parsed.passages).toEqual(["deux"])
    expect(formatHighlight(parsed)).toBe("[un [deux] trois]")
  })

  it("flags an empty passage, and keeps it as text", () => {
    const parsed = parseHighlight("Un [ ] et [deux]")

    expect(parsed.issue).toBe("emptyPassage")
    expect(parsed.passages).toEqual(["deux"])
    expect(parsed.parts[0]).toEqual({ text: "Un [ ] et " })
  })

  it("reports the first issue only", () => {
    expect(parseHighlight("[] puis ]").issue).toBe("emptyPassage")
    expect(parseHighlight("] puis []").issue).toBe("brackets")
  })

  it("never cuts a character made of two UTF-16 units", () => {
    expect(parseHighlight("[🌾] blé").passages).toEqual(["🌾"])
  })

  it("reads no further than the raw length", () => {
    const text = `[a] ${"b".repeat(HIGHLIGHT_LIMITS.RAW_LENGTH)} [c]`

    expect(parseHighlight(text).passages).toEqual(["a"])
  })
})

describe("highlightLength", () => {
  it("counts what a reader sees, without the brackets", () => {
    expect(highlightLength(parseHighlight("Un [deux] trois"))).toBe(13)
    expect(highlightLength(parseHighlight("[é] 🌾"))).toBe(3)
  })
})

describe("formatHighlight", () => {
  it("writes the text back with trimmed passages", () => {
    expect(formatHighlight(parseHighlight(" Un [ deux ]  trois "))).toBe(
      "Un [deux] trois",
    )
  })
})

describe("foundPassages", () => {
  it("counts the passages found and the others tapped", () => {
    expect(foundPassages([0, 2, 3], [0, 1, 2])).toEqual({
      count: 2,
      total: 3,
      extra: 1,
    })
  })

  it("counts a repeated pick once", () => {
    expect(foundPassages([1, 1], [1])).toEqual({ count: 1, total: 1, extra: 0 })
  })
})

describe("scoreHighlight", () => {
  const { STRICT, BALANCED, LENIENT } = SCORING_MODES

  it("gives full credit to every passage to spot and no other", () => {
    for (const mode of [STRICT, BALANCED, LENIENT, undefined]) {
      expect(scoreHighlight([4, 2], [2, 4], mode)).toBe(1)
    }
  })

  it("gives nothing short of the exact passages in the strict mode", () => {
    expect(scoreHighlight([2], [2, 4], STRICT)).toBe(0)
    expect(scoreHighlight([2, 3, 4], [2, 4], STRICT)).toBe(0)
  })

  it("takes the other passages off the ones found in the balanced mode", () => {
    expect(scoreHighlight([2], [2, 4], BALANCED)).toBe(0.5)
    expect(scoreHighlight([2, 3, 4], [2, 4], BALANCED)).toBe(0.5)
    expect(scoreHighlight([0, 1, 2], [2, 4], BALANCED)).toBe(0)
  })

  it("reads the lenient mode, or none, as balanced", () => {
    expect(highlightScoringMode(LENIENT)).toBe(BALANCED)
    expect(highlightScoringMode(undefined)).toBe(BALANCED)
    expect(highlightScoringMode(STRICT)).toBe(STRICT)
    // Tapping every passage is not full credit.
    expect(scoreHighlight([0, 1, 2, 3, 4], [0, 1], LENIENT)).toBe(0)
    expect(scoreHighlight([0, 1, 2], [0, 1])).toBe(0.5)
  })

  it("gives nothing without a passage to spot", () => {
    expect(scoreHighlight([0], [], BALANCED)).toBe(0)
  })
})
