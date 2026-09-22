import {
  alignedTargets,
  UNSET,
  withItem,
  withoutCategory,
  withoutItem,
  withTarget,
} from "@razzia/web/features/questions/association/utils/draft"
import { describe, expect, it } from "vitest"

describe("alignedTargets", () => {
  it("gives one right target per item, unset where there is none", () => {
    expect(alignedTargets([1, 0], 3)).toEqual([1, 0, UNSET])
    expect(alignedTargets(undefined, 2)).toEqual([UNSET, UNSET])
    expect(alignedTargets([1, 0, 1], 2)).toEqual([1, 0])
  })
})

describe("items", () => {
  it("adds an empty item with no right target", () => {
    expect(withItem(["Un", "Deux"], [0, 1])).toEqual({
      answers: ["Un", "Deux", ""],
      expectedTargets: [0, 1, UNSET],
    })
  })

  it("removes an item with its right target", () => {
    expect(withoutItem(["Un", "Deux", "Trois"], [0, 1, 0], 1)).toEqual({
      answers: ["Un", "Trois"],
      expectedTargets: [0, 0],
    })
  })

  it("sets the right target of one item", () => {
    expect(withTarget([0, UNSET, UNSET], 1, 1)).toEqual([0, 1, UNSET])
  })
})

describe("withoutCategory", () => {
  it("unsets its items and moves the later categories up", () => {
    expect(
      withoutCategory(["Famille", "Retraite", "Maladie"], [0, 1, 2, 1], 1),
    ).toEqual({
      targets: ["Famille", "Maladie"],
      expectedTargets: [0, UNSET, 1, UNSET],
    })
  })
})
