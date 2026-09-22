import { MATCH_SCORING, QUESTION_TYPES } from "@razzia/common/constants"
import {
  countMatched,
  isAssociationType,
  matchedItems,
  matchScoringOf,
  rightTargetOf,
  scoreAssociation,
  targetsOf,
} from "@razzia/common/utils/association"
import { describe, expect, it } from "vitest"

describe("isAssociationType", () => {
  it("tells statements and categorize from the other types", () => {
    expect(isAssociationType(QUESTION_TYPES.STATEMENTS)).toBe(true)
    expect(isAssociationType(QUESTION_TYPES.CATEGORIZE)).toBe(true)
    expect(isAssociationType(QUESTION_TYPES.TRUEFALSE)).toBe(false)
    expect(isAssociationType(QUESTION_TYPES.ORDERING)).toBe(false)
    expect(isAssociationType(undefined)).toBe(false)
  })
})

describe("targetsOf", () => {
  it("gives Vrai and Faux to statements, whatever is stored", () => {
    expect(targetsOf({ type: QUESTION_TYPES.STATEMENTS })).toEqual([
      "Vrai",
      "Faux",
    ])
    expect(
      targetsOf({ type: QUESTION_TYPES.STATEMENTS, targets: ["Oui", "Non"] }),
    ).toEqual(["Vrai", "Faux"])
  })

  it("gives the categories of a categorize question", () => {
    expect(
      targetsOf({
        type: QUESTION_TYPES.CATEGORIZE,
        targets: ["Salarié", "Non-salarié"],
      }),
    ).toEqual(["Salarié", "Non-salarié"])
    expect(targetsOf({ type: QUESTION_TYPES.CATEGORIZE })).toEqual([])
  })
})

describe("rightTargetOf", () => {
  const categorize = {
    type: QUESTION_TYPES.CATEGORIZE,
    targets: ["Famille", "Retraite", "Maladie"],
    expectedTargets: [0, 1, 2],
  }

  it("names the right target of an item", () => {
    expect(rightTargetOf(categorize, 1)).toBe("Retraite")
    expect(
      rightTargetOf(
        { type: QUESTION_TYPES.STATEMENTS, targets: [], expectedTargets: [1] },
        0,
      ),
    ).toBe("Faux")
  })

  it("gives null to an item without one", () => {
    expect(
      rightTargetOf(
        { type: QUESTION_TYPES.CATEGORIZE, targets: ["A", "B"] },
        0,
      ),
    ).toBeNull()
    expect(
      rightTargetOf(
        {
          type: QUESTION_TYPES.CATEGORIZE,
          targets: ["A", "B"],
          expectedTargets: [-1],
        },
        0,
      ),
    ).toBeNull()
    // Never the last target: an item past the expected ones has none.
    expect(rightTargetOf(categorize, 5)).toBeNull()
    expect(
      rightTargetOf(
        { type: QUESTION_TYPES.STATEMENTS, expectedTargets: [0] },
        1,
      ),
    ).toBeNull()
  })
})

describe("matchedItems", () => {
  it("flags the items matched with their right target", () => {
    expect(matchedItems([0, 1, 1, 0], [0, 1, 0, 1])).toEqual([
      true,
      true,
      false,
      false,
    ])
  })

  it("reads a missing pick as not matched", () => {
    expect(matchedItems([2], [2, 0, 1])).toEqual([true, false, false])
  })

  it("counts the items matched, out of how many", () => {
    expect(countMatched([0, 1, 1], [0, 1, 0])).toEqual({ count: 2, total: 3 })
  })
})

describe("scoreAssociation", () => {
  it("gives the share of items matched, by default", () => {
    expect(scoreAssociation([0, 1, 0, 1], [0, 1, 0, 1])).toBe(1)
    expect(scoreAssociation([0, 1, 1, 0], [0, 1, 0, 1])).toBe(0.5)
    expect(scoreAssociation([1, 0], [0, 1], MATCH_SCORING.SHARE)).toBe(0)
  })

  it("gives full credit only when every item is matched, exact", () => {
    expect(scoreAssociation([2, 0, 1], [2, 0, 1], MATCH_SCORING.EXACT)).toBe(1)
    expect(scoreAssociation([2, 0, 0], [2, 0, 1], MATCH_SCORING.EXACT)).toBe(0)
  })

  it("gives nothing without items", () => {
    expect(scoreAssociation([], [])).toBe(0)
  })

  it("reads an unknown scoring as the share", () => {
    expect(matchScoringOf(undefined)).toBe(MATCH_SCORING.SHARE)
    expect(matchScoringOf(MATCH_SCORING.EXACT)).toBe(MATCH_SCORING.EXACT)
  })
})
