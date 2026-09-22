import {
  countScale,
  scaleEndLabel,
  scaleRangeOf,
  scaleSkipAllowed,
  scaleSkipIndex,
  scaleSummary,
  scaleValues,
} from "@razzia/common/utils/scale"
import { describe, expect, it } from "vitest"

describe("scaleRangeOf", () => {
  it("goes from 1 to 5 without settings", () => {
    expect(scaleRangeOf(undefined)).toEqual({ min: 1, max: 5, count: 5 })
  })

  it("reads the levels the author set", () => {
    expect(scaleRangeOf({ scaleMin: 0, scaleMax: 7 })).toEqual({
      min: 0,
      max: 7,
      count: 8,
    })
  })

  it("brings a scale stored out of bounds back within them", () => {
    expect(scaleRangeOf({ scaleMin: 4, scaleMax: 40 })).toEqual({
      min: 1,
      max: 8,
      count: 8,
    })
    expect(scaleRangeOf({ scaleMin: 1, scaleMax: 1 })).toEqual({
      min: 1,
      max: 3,
      count: 3,
    })
  })

  it("ignores a setting that is no whole number", () => {
    expect(scaleRangeOf({ scaleMax: 5.5 })).toEqual({
      min: 1,
      max: 5,
      count: 5,
    })
  })
})

describe("scaleValues", () => {
  it("lists every level, the lowest first", () => {
    expect(scaleValues(scaleRangeOf({ scaleMin: 0, scaleMax: 3 }))).toEqual([
      0, 1, 2, 3,
    ])
  })
})

describe("scaleSkipIndex", () => {
  it("stands just past the last level", () => {
    expect(scaleSkipIndex(scaleRangeOf(undefined))).toBe(5)
  })

  it("is only offered when the author says so", () => {
    expect(scaleSkipAllowed(undefined)).toBe(false)
    expect(scaleSkipAllowed({ scaleSkip: true })).toBe(true)
  })
})

describe("scaleEndLabel", () => {
  it("cleans what each end stands for", () => {
    expect(scaleEndLabel({ scaleLow: "  Pas   du tout " }, "low")).toBe(
      "Pas du tout",
    )
    expect(scaleEndLabel({ scaleHigh: "Tout à fait" }, "high")).toBe(
      "Tout à fait",
    )
  })

  it("gives an empty text when unset", () => {
    expect(scaleEndLabel(undefined, "low")).toBe("")
  })
})

describe("countScale", () => {
  const range = scaleRangeOf({ scaleMin: 1, scaleMax: 5 })

  it("counts the players of each level", () => {
    expect(countScale([[0], [4], [4], [2]], range)).toEqual({
      counts: [1, 0, 1, 0, 2],
      skipped: 0,
    })
  })

  it("counts apart those who preferred not to answer", () => {
    expect(countScale([[5], [5], [1]], range)).toEqual({
      counts: [0, 1, 0, 0, 0],
      skipped: 2,
    })
  })

  it("leaves out an answer that is no level", () => {
    expect(countScale([[], [9], [-1]], range)).toEqual({
      counts: [0, 0, 0, 0, 0],
      skipped: 0,
    })
  })
})

describe("scaleSummary", () => {
  it("gives the mean and the median of the levels picked", () => {
    expect(scaleSummary([1, 0, 2, 0, 1], 1)).toEqual({
      answers: 4,
      mean: 3,
      median: 3,
    })
  })

  it("averages the two middle levels on an even count", () => {
    expect(scaleSummary([1, 1], 1)).toEqual({
      answers: 2,
      mean: 1.5,
      median: 1.5,
    })
  })

  it("reads a scale that starts at 0", () => {
    expect(scaleSummary([1, 0, 0, 0, 0, 0, 0, 1], 0)).toEqual({
      answers: 2,
      mean: 3.5,
      median: 3.5,
    })
  })

  it("gives nothing without an answer", () => {
    expect(scaleSummary([0, 0, 0], 1)).toEqual({
      answers: 0,
      mean: null,
      median: null,
    })
  })
})
