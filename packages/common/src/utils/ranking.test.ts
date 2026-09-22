import {
  firstChoices,
  rankOrder,
  rankPoints,
} from "@razzia/common/utils/ranking"
import { describe, expect, it } from "vitest"

describe("rankPoints", () => {
  it("gives n - rank to each proposal of an order", () => {
    expect(rankPoints([[2, 0, 1]], 3)).toEqual([1, 0, 2])
  })

  it("adds up the orders of every player", () => {
    expect(
      rankPoints(
        [
          [0, 1, 2],
          [1, 0, 2],
          [1, 2, 0],
        ],
        3,
      ),
    ).toEqual([3, 5, 1])
  })

  it("gives nothing without an answer", () => {
    expect(rankPoints([], 3)).toEqual([0, 0, 0])
  })

  it("leaves out an index no proposal has", () => {
    expect(rankPoints([[0, 7]], 2)).toEqual([1, 0])
  })
})

describe("rankOrder", () => {
  it("puts the most points first", () => {
    expect(rankOrder([3, 5, 1])).toEqual([1, 0, 2])
  })

  it("keeps the author's order between equal proposals", () => {
    expect(rankOrder([2, 2, 2])).toEqual([0, 1, 2])
  })

  it("orders nothing without proposals", () => {
    expect(rankOrder([])).toEqual([])
  })
})

describe("firstChoices", () => {
  it("counts the players who put each proposal first", () => {
    expect(
      firstChoices(
        [
          [1, 0, 2],
          [1, 2, 0],
          [0, 1, 2],
        ],
        3,
      ),
    ).toEqual([1, 2, 0])
  })

  it("counts nothing from an empty order", () => {
    expect(firstChoices([[]], 2)).toEqual([0, 0])
  })
})
