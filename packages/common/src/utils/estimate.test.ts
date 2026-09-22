import {
  boundedWindow,
  checkEstimate,
  decimalsOf,
  estimateRanges,
  fitsDecimals,
  formatEstimate,
  formatTolerance,
  isWithinTolerance,
  medianOf,
  nameRange,
  parseEstimate,
  toleranceSide,
  toleranceWindow,
  toPlainNumber,
  toScaled,
} from "@razzia/common/utils/estimate"
import { describe, expect, it } from "vitest"

const char = (codePoint: number) => String.fromCodePoint(codePoint)
const NO_BREAK_SPACE = char(0xa0)
const NARROW_NO_BREAK_SPACE = char(0x202f)
const MINUS_SIGN = char(0x2212)
const EN_DASH = char(0x2013)
const ZERO_WIDTH_SPACE = char(0x200b)

const valueOf = (raw: string, decimals = 0) => {
  const parsed = parseEstimate(raw, decimals)

  return parsed.ok ? parsed.value : parsed.reason
}

describe("parseEstimate", () => {
  it("reads integers, with spaces between digit groups", () => {
    expect(valueOf("35")).toBe(35)
    expect(valueOf(" 1 234 ")).toBe(1234)
    expect(valueOf(`1${NO_BREAK_SPACE}234${NARROW_NO_BREAK_SPACE}567`)).toBe(
      1_234_567,
    )
    expect(valueOf("007")).toBe(7)
  })

  it("reads a comma or a point before the decimals", () => {
    expect(valueOf("12,5", 1)).toBe(12.5)
    expect(valueOf("12.5", 1)).toBe(12.5)
    expect(valueOf(",5", 1)).toBe(0.5)
    expect(valueOf("12,", 1)).toBe(12)
    expect(valueOf("1 234,567", 3)).toBe(1234.567)
  })

  it("ignores trailing zeros of the decimals", () => {
    expect(valueOf("12,50", 1)).toBe(12.5)
    expect(valueOf("3,000")).toBe(3)
  })

  it("reads a sign, any dash standing for a minus", () => {
    expect(valueOf("-5")).toBe(-5)
    expect(valueOf(`${MINUS_SIGN}5`)).toBe(-5)
    expect(valueOf(`${EN_DASH} 5`)).toBe(-5)
    expect(valueOf("+5")).toBe(5)
    expect(Object.is(valueOf("-0"), 0)).toBe(true)
  })

  it("reads full width digits and drops invisible characters", () => {
    expect(valueOf("３５")).toBe(35)
    expect(valueOf(`3${ZERO_WIDTH_SPACE}5`)).toBe(35)
  })

  it("refuses what is not a number", () => {
    expect(valueOf("")).toBe("empty")
    expect(valueOf("   ")).toBe("empty")
    expect(valueOf("abc")).toBe("invalid")
    expect(valueOf("12 km")).toBe("invalid")
    expect(valueOf("1.234.567")).toBe("invalid")
    expect(valueOf("1,234.5", 1)).toBe("invalid")
    expect(valueOf("1e5")).toBe("invalid")
    expect(valueOf("-")).toBe("invalid")
    expect(valueOf(",")).toBe("invalid")
    expect(valueOf("--5")).toBe("invalid")
    expect(valueOf("Infinity")).toBe("invalid")
  })

  it("refuses more decimals than the question allows", () => {
    expect(valueOf("12,5")).toBe("decimals")
    expect(valueOf("1,234", 2)).toBe("decimals")
    expect(valueOf("1,23", 2)).toBe(1.23)
  })

  it("refuses 13 digits or more before the separator", () => {
    expect(valueOf("999 999 999 999")).toBe(999_999_999_999)
    expect(valueOf("1 000 000 000 000")).toBe("tooLarge")
    expect(valueOf("999999999999,999", 3)).toBe(999_999_999_999.999)
  })

  it("scales without floating point drift", () => {
    const parsed = parseEstimate("0,3", 1)

    expect(parsed).toEqual({ ok: true, value: 0.3, scaled: 3 })
  })
})

describe("checkEstimate", () => {
  const options = { decimals: 1, min: 0, max: 100 }

  it("accepts a number within the bounds, bounds included", () => {
    expect(checkEstimate("0", options)).toEqual({ ok: true, value: 0 })
    expect(checkEstimate("100", options)).toEqual({ ok: true, value: 100 })
    expect(checkEstimate("42,5", options)).toEqual({ ok: true, value: 42.5 })
  })

  it("says why a number is refused", () => {
    expect(checkEstimate("-0,1", options)).toEqual({
      ok: false,
      reason: "belowMin",
    })
    expect(checkEstimate("100,1", options)).toEqual({
      ok: false,
      reason: "aboveMax",
    })
    expect(checkEstimate("4,25", options)).toEqual({
      ok: false,
      reason: "decimals",
    })
    expect(checkEstimate("", options)).toEqual({ ok: false, reason: "empty" })
  })

  it("has no bound without min or max", () => {
    expect(checkEstimate("-12", undefined)).toEqual({ ok: true, value: -12 })
  })
})

describe("decimals", () => {
  it("defaults to 0 and clamps to 0 to 3", () => {
    expect(decimalsOf(undefined)).toBe(0)
    expect(decimalsOf({ decimals: 2 })).toBe(2)
    expect(decimalsOf({ decimals: 7 })).toBe(3)
    expect(decimalsOf({ decimals: 1.5 })).toBe(0)
  })

  it("tells whether a value fits them", () => {
    expect(fitsDecimals(1.15, 2)).toBe(true)
    expect(fitsDecimals(1.005, 2)).toBe(false)
    expect(fitsDecimals(0.3, 1)).toBe(true)
    expect(fitsDecimals(35, 0)).toBe(true)
    expect(fitsDecimals(1e12, 0)).toBe(false)
    expect(fitsDecimals(Number.NaN, 0)).toBe(false)
    expect(toScaled(0.29, 2)).toBe(29)
    expect(Object.is(toScaled(-0, 0), 0)).toBe(true)
  })
})

describe("tolerance", () => {
  const question = (options: object, expected = 35) => ({ expected, options })

  it("is exact without a tolerance, bounds of the window included", () => {
    expect(toleranceWindow(question({}))).toEqual({ low: 35, high: 35 })
    expect(isWithinTolerance(question({}), 35)).toBe(true)
    expect(isWithinTolerance(question({}), 36)).toBe(false)
  })

  it("adds an absolute margin in the unit", () => {
    const q = question({ tolerance: 2 })

    expect(isWithinTolerance(q, 33)).toBe(true)
    expect(isWithinTolerance(q, 37)).toBe(true)
    expect(isWithinTolerance(q, 32)).toBe(false)
    expect(isWithinTolerance(q, 38)).toBe(false)
  })

  it("compares decimals as scaled integers", () => {
    const q = question({ tolerance: 0.1, decimals: 1 }, 0.2)

    // 0.1 + 0.2 is not 0.3 in floating point, but is within the tolerance.
    expect(isWithinTolerance(q, 0.3)).toBe(true)
    expect(isWithinTolerance(q, 0.1)).toBe(true)
    expect(isWithinTolerance(q, 0.4)).toBe(false)
  })

  it("applies a percentage to the right value, rounded down", () => {
    const q = question({ tolerance: 10, toleranceMode: "percent" })

    // 10 % of 35 is 3.5: 32 to 38 with no decimal.
    expect(toleranceWindow(q)).toEqual({ low: 32, high: 38 })
    expect(isWithinTolerance(q, 38)).toBe(true)
    expect(isWithinTolerance(q, 39)).toBe(false)
  })

  it("applies a percentage to a negative right value", () => {
    const q = question({ tolerance: 10, toleranceMode: "percent" }, -50)

    expect(toleranceWindow(q)).toEqual({ low: -55, high: -45 })
  })

  it("keeps exact figures on large values", () => {
    const q = question(
      { tolerance: 0.5, toleranceMode: "percent", decimals: 3 },
      999_999_999_999.999,
    )
    const window = toleranceWindow(q)

    // 0.5 % of 999 999 999 999 999 thousandths, rounded down.
    expect(window?.high).toBe(999_999_999_999_999 + 4_999_999_999_999)
  })

  it("tells on which side of the tolerance a value falls", () => {
    const q = question({ tolerance: 2 })

    expect(toleranceSide(q, 32)).toBe("below")
    expect(toleranceSide(q, 33)).toBe("within")
    expect(toleranceSide(q, 38)).toBe("above")
    expect(toleranceSide(q, 35.5)).toBeNull()
  })

  it("never scores without a right value", () => {
    expect(isWithinTolerance({ options: {} }, 0)).toBe(false)
    expect(isWithinTolerance({ expected: 1.5, options: {} }, 1.5)).toBe(false)
  })

  it("cuts the scoring values to the bounds", () => {
    // Below 0 a phone sends nothing: the right values are 0 to 7.
    expect(boundedWindow(question({ tolerance: 5, min: 0 }, 2))).toEqual({
      low: 0,
      high: 7,
      min: 0,
      max: null,
    })
    expect(
      boundedWindow(question({ tolerance: 5, min: 0, max: 38 }, 35)),
    ).toEqual({ low: 30, high: 38, min: 0, max: 38 })
    expect(
      boundedWindow(question({ tolerance: 0.5, decimals: 1, max: 2 }, 2)),
    ).toEqual({ low: 15, high: 20, min: null, max: 20 })
  })

  it("ignores bounds that leave out every right value", () => {
    expect(boundedWindow(question({ tolerance: 2, min: 40 }))).toEqual({
      low: 33,
      high: 37,
      min: null,
      max: null,
    })
    expect(boundedWindow({ options: { min: 0 } })).toBeNull()
  })
})

describe("medianOf", () => {
  it("takes the middle value, or the mean of the middle two", () => {
    expect(medianOf([])).toBeNull()
    expect(medianOf([40, 30, 100])).toBe(40)
    expect(medianOf([30, 31])).toBe(30.5)
    expect(medianOf([5])).toBe(5)
  })
})

describe("estimateRanges", () => {
  const labels = (ranges: ReturnType<typeof estimateRanges>) =>
    ranges.map(({ from, to, count, correct }) =>
      [from ?? "…", to ?? "…", count, correct ? "✓" : ""].join(" "),
    )

  it("puts two ranges on each side of the right value", () => {
    const ranges = estimateRanges(
      { expected: 35, options: {} },
      [35, 30, 40, 50, 100, 12],
    )

    // A tenth of 35 rounds up to a step of 5.
    expect(labels(ranges)).toEqual([
      "… 29 1 ",
      "30 34 1 ",
      "35 35 1 ✓",
      "36 40 1 ",
      "41 … 2 ",
    ])
  })

  it("makes the other ranges as wide as the tolerance", () => {
    const ranges = estimateRanges(
      { expected: 35, options: { tolerance: 2 } },
      [33, 37, 38],
    )

    expect(labels(ranges)).toEqual([
      "… 27 0 ",
      "28 32 0 ",
      "33 37 2 ✓",
      "38 42 1 ",
      "43 … 0 ",
    ])
  })

  it("moves the ranges a bound cuts to the other side", () => {
    const ranges = estimateRanges(
      { expected: 1, options: { min: 0 } },
      [0, 1, 2, 3, 9],
    )

    expect(labels(ranges)).toEqual([
      "0 0 1 ",
      "1 1 1 ✓",
      "2 2 1 ",
      "3 3 1 ",
      "4 … 1 ",
    ])
  })

  it("ends the farthest ranges at the bounds", () => {
    const ranges = estimateRanges(
      { expected: 50, options: { min: 0, max: 100 } },
      [0, 100],
    )

    expect(labels(ranges)).toEqual([
      "0 44 1 ",
      "45 49 0 ",
      "50 50 0 ✓",
      "51 55 0 ",
      "56 100 1 ",
    ])
  })

  it("keeps only the right range when the bounds leave no other value", () => {
    const ranges = estimateRanges(
      { expected: 5, options: { min: 3, max: 7, tolerance: 2 } },
      [3, 7],
    )

    expect(labels(ranges)).toEqual(["3 7 2 ✓"])
  })

  it("steps by round figures on large values", () => {
    const ranges = estimateRanges(
      {
        expected: 1_200_000,
        options: { tolerance: 10, toleranceMode: "percent" },
      },
      [1_000_000],
    )

    expect(labels(ranges)).toEqual([
      "… 829999 0 ",
      "830000 1079999 1 ",
      "1080000 1320000 0 ✓",
      "1320001 1570000 0 ",
      "1570001 … 0 ",
    ])
  })

  it("works in the question's decimals", () => {
    const ranges = estimateRanges(
      { expected: 3.5, options: { decimals: 1 } },
      [3.4, 3.5, 4.1],
    )

    expect(labels(ranges)).toEqual([
      "… 2.9 0 ",
      "3 3.4 1 ",
      "3.5 3.5 1 ✓",
      "3.6 4 0 ",
      "4.1 … 1 ",
    ])
  })

  it("counts a value out of every range in the nearest one", () => {
    const ranges = estimateRanges(
      { expected: 50, options: { min: 40, max: 60 } },
      [10, 90],
    )

    expect(ranges[0]?.count).toBe(1)
    expect(ranges.at(-1)?.count).toBe(1)
  })

  it("is empty without a right value", () => {
    expect(estimateRanges({ options: {} }, [1, 2])).toEqual([])
  })

  it("names an open range by the bound of its neighbour", () => {
    const ranges = estimateRanges({ expected: 35, options: {} }, [])

    expect(ranges.map((_, index) => nameRange(ranges, index))).toEqual([
      { kind: "under", value: 30 },
      { kind: "between", from: 30, to: 34 },
      { kind: "exactly", value: 35 },
      { kind: "between", from: 36, to: 40 },
      { kind: "over", value: 40 },
    ])
  })
})

describe("formatEstimate", () => {
  it("writes numbers in French, with the unit", () => {
    const format = (value: number, options = {}) =>
      formatEstimate(value, options).replaceAll(NARROW_NO_BREAK_SPACE, " ")

    expect(format(1234.5, { decimals: 1 })).toBe("1 234,5")
    expect(format(35, { unit: "km" })).toBe(`35${NO_BREAK_SPACE}km`)
    expect(format(-0)).toBe("0")
    expect(formatEstimate(30.5, {}, { extraDigits: 1 })).toBe("30,5")
    expect(formatEstimate(35, { unit: "km" }, { withUnit: false })).toBe("35")
  })

  it("writes the tolerance as a percentage or in the unit", () => {
    expect(formatTolerance({ tolerance: 2.5, toleranceMode: "percent" })).toBe(
      `2,5${NO_BREAK_SPACE}%`,
    )
    expect(formatTolerance({ tolerance: 2, unit: "km" })).toBe(
      `2${NO_BREAK_SPACE}km`,
    )
  })

  it("sends a plain decimal the server reads back", () => {
    expect(toPlainNumber(1234.5, 2)).toBe("1234.50")
    expect(valueOf(toPlainNumber(1234.5, 2), 2)).toBe(1234.5)
  })
})
