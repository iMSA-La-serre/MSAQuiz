import { ORDER_SCORING } from "@razzia/common/constants"
import { placedItems, scoreOrdering } from "@razzia/common/utils/ordering"
import { describe, expect, it } from "vitest"

describe("placedItems", () => {
  it("flags the items at their place", () => {
    expect(placedItems([0, 2, 1, 3], 4)).toEqual([true, false, false, true])
  })

  it("reads a missing position as misplaced", () => {
    expect(placedItems([0], 3)).toEqual([true, false, false])
  })
})

describe("scoreOrdering, position", () => {
  const score = (order: number[]) =>
    scoreOrdering(order, order.length, ORDER_SCORING.POSITION)

  it("gives full credit for the correct order", () => {
    expect(score([0, 1, 2, 3])).toBe(1)
  })

  it("gives the share of items at their place", () => {
    expect(score([1, 0, 2, 3])).toBe(0.5)
    expect(score([0, 2, 1])).toBeCloseTo(1 / 3)
  })

  it("gives nothing when no item is at its place", () => {
    expect(score([1, 2, 3, 0])).toBe(0)
  })
})

describe("scoreOrdering, exact", () => {
  const score = (order: number[]) =>
    scoreOrdering(order, order.length, ORDER_SCORING.EXACT)

  it("gives full credit for the correct order only", () => {
    expect(score([0, 1, 2])).toBe(1)
    expect(score([0, 2, 1])).toBe(0)
  })
})

describe("scoreOrdering, degenerate input", () => {
  it("gives nothing without items", () => {
    expect(scoreOrdering([], 0, ORDER_SCORING.POSITION)).toBe(0)
  })

  it("only credits the positions given", () => {
    expect(scoreOrdering([0], 4, ORDER_SCORING.POSITION)).toBe(0.25)
  })
})
