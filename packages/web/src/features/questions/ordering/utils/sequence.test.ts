import {
  isComplete,
  positionOf,
  shownPosition,
  toggleItem,
} from "@razzia/web/features/questions/ordering/utils/sequence"
import { describe, expect, it } from "vitest"

const tapAll = (items: number[]) =>
  items.reduce<number[]>((sequence, item) => toggleItem(sequence, item), [])

describe("toggleItem", () => {
  it("gives the next position to an item without one", () => {
    expect(toggleItem([], 2)).toEqual([2])
    expect(toggleItem([2], 0)).toEqual([2, 0])
  })

  it("takes the position back from a numbered item", () => {
    expect(toggleItem([2, 0], 0)).toEqual([2])
  })

  it("moves the items after a removed one up by one", () => {
    const sequence = toggleItem([3, 1, 0, 2], 1)

    expect(sequence).toEqual([3, 0, 2])
    expect(positionOf(sequence, 0)).toBe(2)
    expect(positionOf(sequence, 2)).toBe(3)
  })

  it("leaves the items before a removed one in place", () => {
    expect(positionOf(toggleItem([3, 1, 0], 0), 3)).toBe(1)
  })

  it("gives a removed item the last position when tapped again", () => {
    expect(tapAll([0, 1, 2, 0])).toEqual([1, 2])
    expect(tapAll([0, 1, 2, 0, 0])).toEqual([1, 2, 0])
  })

  it("does not change the sequence it is given", () => {
    const sequence = [1, 0]

    toggleItem(sequence, 2)
    toggleItem(sequence, 1)

    expect(sequence).toEqual([1, 0])
  })
})

describe("positionOf", () => {
  it("counts positions from 1", () => {
    expect(positionOf([4, 2], 4)).toBe(1)
    expect(positionOf([4, 2], 2)).toBe(2)
  })

  it("gives null to an item without a position", () => {
    expect(positionOf([4, 2], 0)).toBeNull()
    expect(positionOf([], 0)).toBeNull()
  })
})

describe("isComplete", () => {
  it("needs every item numbered", () => {
    expect(isComplete([], 3)).toBe(false)
    expect(isComplete([2, 0], 3)).toBe(false)
    expect(isComplete([2, 0, 1], 3)).toBe(true)
  })

  it("is complete again once a removed item is tapped back", () => {
    const sequence = tapAll([0, 1, 2, 1])

    expect(isComplete(sequence, 3)).toBe(false)
    expect(isComplete(toggleItem(sequence, 1), 3)).toBe(true)
  })

  it("is never complete without items", () => {
    expect(isComplete([], 0)).toBe(false)
  })
})

describe("shownPosition", () => {
  it("finds where an item of the correct order was shown", () => {
    // Shown: item 2, then item 0, then item 1.
    expect([0, 1, 2].map((item) => shownPosition([2, 0, 1], item))).toEqual([
      1, 2, 0,
    ])
  })

  it("gives no place when the shown list is unknown or lacks the item", () => {
    expect(shownPosition(undefined, 3)).toBeNull()
    expect(shownPosition([1, 0], 4)).toBeNull()
  })
})
