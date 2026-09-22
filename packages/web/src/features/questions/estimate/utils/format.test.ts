import { checkEstimate, estimateRanges } from "@razzia/common/utils/estimate"
import {
  checkMessage,
  estimateHint,
  rangeText,
  summaryText,
} from "@razzia/web/features/questions/estimate/utils/format"
import type { TFunction } from "i18next"
import { describe, expect, it } from "vitest"

// The key and its values, the spaces of French numbers made plain.
const SPACES = new RegExp(
  `[${String.fromCodePoint(0xa0)}${String.fromCodePoint(0x202f)}]`,
  "gu",
)
const t = ((key: string, values?: Record<string, unknown>) =>
  `${key}${values ? ` ${JSON.stringify(values)}` : ""}`.replace(
    SPACES,
    " ",
  )) as unknown as TFunction

describe("estimateHint", () => {
  it("names the bounds, then the tolerance", () => {
    expect(estimateHint(t, { min: 0, max: 100, unit: "km" })).toBe(
      'game:estimate.hintRange {"min":"0","max":"100 km"}',
    )
    expect(estimateHint(t, { max: 100 })).toBe(
      'game:estimate.hintUpTo {"max":"100"}',
    )
    expect(estimateHint(t, { min: 10 })).toBe(
      'game:estimate.hintFrom {"min":"10"}',
    )
    expect(estimateHint(t, { tolerance: 5, toleranceMode: "percent" })).toBe(
      'game:estimate.hintTolerance {"bounds":"game:estimate.hintAny","tolerance":"5 %"}',
    )
  })

  it("leaves out a lone minimum of 0", () => {
    expect(estimateHint(t, { min: 0 })).toBe("game:estimate.hintAny")
  })
})

describe("checkMessage", () => {
  const message = (raw: string, options = {}) =>
    checkMessage(t, checkEstimate(raw, options), options)

  it("shows the number as it will be sent", () => {
    expect(message("1234,5", { decimals: 1, unit: "km" })).toEqual({
      text: 'game:estimate.read {"value":"1 234,5 km"}',
      refused: false,
    })
  })

  it("says why a number is refused, but not an empty field", () => {
    expect(message("")).toEqual({
      text: "game:estimate.empty",
      refused: false,
    })
    expect(message("12,5").text).toBe("game:estimate.integer")
    expect(message("1,234", { decimals: 2 }).text).toBe(
      'game:estimate.decimals {"count":2}',
    )
    expect(message("-1", { min: 0 })).toEqual({
      text: 'game:estimate.belowMin {"min":"0"}',
      refused: true,
    })
    expect(message("abc").refused).toBe(true)
  })
})

describe("rangeText", () => {
  it("names each range with the unit", () => {
    const options = { unit: "km" }
    const ranges = estimateRanges({ expected: 35, options }, [])

    expect(
      ranges.map((_, index) =>
        rangeText(t, ranges, { index, options }).replace(SPACES, " "),
      ),
    ).toEqual([
      'game:estimate.under {"value":"30 km"}',
      'game:estimate.between {"from":"30","to":"34 km"}',
      "35 km",
      'game:estimate.between {"from":"36","to":"40 km"}',
      'game:estimate.over {"value":"40 km"}',
    ])
  })
})

describe("summaryText", () => {
  const keys = { expected: "expected", summary: "summary" }

  it("gives the right value and the median", () => {
    expect(
      summaryText(t, { expected: 35, median: 30.5, options: {} }, keys),
    ).toBe('summary {"expected":"35","median":"30,5"}')
    expect(
      summaryText(t, { expected: 35, median: null, options: {} }, keys),
    ).toBe('expected {"expected":"35","median":""}')
    expect(
      summaryText(t, { expected: undefined, median: 3, options: {} }, keys),
    ).toBeNull()
  })
})
