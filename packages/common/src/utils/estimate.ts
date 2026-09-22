import { ESTIMATE_LIMITS, ESTIMATE_TOLERANCE } from "@razzia/common/constants"
import type {
  EstimateRange,
  EstimateTolerance,
  Question,
  QuestionOptions,
} from "@razzia/common/types/game"
import { cleanInput } from "@razzia/common/utils/text"

// Number helpers shared by the server (parsing, scoring, distribution) and
// the web client (phone field, editor, result views), so both sides read and
// compare a number alike. Values are compared as integers scaled by
// 10^decimals: 0.1 + 0.2 never meets 0.3 there.

// Every dash a keyboard may give for a minus sign.
const MINUS_SIGNS = /[\u2010-\u2015\u2212]/gu

const SPACES = /\s/gu

// A sign, digits, then one decimal separator (comma or point) and digits.
const NUMBER = /^([+-]?)(\d*)(?:[.,](\d*))?$/u

const LEADING_ZEROS = /^0+/u

const TRAILING_ZEROS = /0+$/u

// One decimal for a percentage, whatever the question's decimals.
const PERCENT_SCALE = 10 ** ESTIMATE_LIMITS.PERCENT_DECIMALS

const PERCENT_BASE = 100n * BigInt(PERCENT_SCALE)

const LOCALE = "fr-FR"

// Between a number and its unit, as French typography wants.
const NO_BREAK_SPACE = "\u00a0"

// Values strictly under this, in absolute value.
const MAX_MAGNITUDE = 10 ** ESTIMATE_LIMITS.INTEGER_DIGITS

/** Decimals of an estimate, 0 to 3, 0 when absent or invalid. */
export const decimalsOf = (options: QuestionOptions | undefined): number => {
  const decimals = options?.decimals

  if (decimals === undefined || !Number.isInteger(decimals)) {
    return 0
  }

  return Math.min(ESTIMATE_LIMITS.MAX_DECIMALS, Math.max(0, decimals))
}

/** The tolerance, 0 when absent or invalid. */
export const toleranceOf = (options: QuestionOptions | undefined): number => {
  const tolerance = options?.tolerance

  return tolerance !== undefined && Number.isFinite(tolerance) && tolerance > 0
    ? tolerance
    : 0
}

export const toleranceModeOf = (
  options: QuestionOptions | undefined,
): EstimateTolerance =>
  options?.toleranceMode === ESTIMATE_TOLERANCE.PERCENT
    ? ESTIMATE_TOLERANCE.PERCENT
    : ESTIMATE_TOLERANCE.ABSOLUTE

/** The unit shown after the numbers, cleaned, empty when none. */
export const unitOf = (options: QuestionOptions | undefined): string =>
  typeof options?.unit === "string" ? cleanInput(options.unit) : ""

const factorOf = (decimals: number) => 10 ** decimals

/**
 * A value as a whole number of steps of 10^-decimals, or null when it has
 * more decimals, is not finite, or reaches 10^12.
 */
export const toScaled = (value: number, decimals: number): number | null => {
  if (!Number.isFinite(value) || Math.abs(value) >= MAX_MAGNITUDE) {
    return null
  }

  const factor = factorOf(decimals)
  const scaled = Math.round(value * factor)

  // The nearest double to a decimal with at most `decimals` decimals comes
  // back unchanged; any other value does not.
  return scaled / factor === value ? scaled + 0 : null
}

export const fromScaled = (scaled: number, decimals: number): number =>
  scaled / factorOf(decimals)

/** Whether a value has at most `decimals` decimals and fits the limits. */
export const fitsDecimals = (value: number, decimals: number): boolean =>
  toScaled(value, decimals) !== null

export type EstimateParse =
  | { ok: true; value: number; scaled: number }
  | { ok: false; reason: "empty" | "invalid" | "decimals" | "tooLarge" }

/**
 * A number as typed in French or English: spaces anywhere (1 234,5), a comma
 * or a point before the decimals, a leading sign, any dash for a minus.
 * Trailing zeros of the decimals do not count (12,50 is 12,5). Refused: no
 * digit, another character, more decimals than allowed, 13 digits or more
 * before the separator.
 */
export const parseEstimate = (raw: string, decimals: number): EstimateParse => {
  const text = cleanInput(raw).replace(MINUS_SIGNS, "-").replace(SPACES, "")

  if (text === "") {
    return { ok: false, reason: "empty" }
  }

  const match = NUMBER.exec(text)

  if (!match) {
    return { ok: false, reason: "invalid" }
  }

  const [, sign, integer, fraction = ""] = match

  if (integer === "" && fraction === "") {
    return { ok: false, reason: "invalid" }
  }

  const integerDigits = integer.replace(LEADING_ZEROS, "")
  const fractionDigits = fraction.replace(TRAILING_ZEROS, "")

  if (integerDigits.length > ESTIMATE_LIMITS.INTEGER_DIGITS) {
    return { ok: false, reason: "tooLarge" }
  }

  if (fractionDigits.length > decimals) {
    return { ok: false, reason: "decimals" }
  }

  // At most 15 digits: an exact double.
  const magnitude = Number(
    `${integerDigits}${fractionDigits.padEnd(decimals, "0")}`,
  )
  const scaled = sign === "-" && magnitude !== 0 ? -magnitude : magnitude

  return { ok: true, value: fromScaled(scaled, decimals), scaled }
}

export type EstimateCheck =
  | { ok: true; value: number }
  | {
      ok: false
      reason:
        "empty" | "invalid" | "decimals" | "tooLarge" | "belowMin" | "aboveMax"
    }

/**
 * What a player typed, checked against the question: a number with no more
 * decimals than allowed, within the bounds. The phone and the server both
 * read an answer through it.
 */
export const checkEstimate = (
  raw: string,
  options: QuestionOptions | undefined,
): EstimateCheck => {
  const parsed = parseEstimate(raw, decimalsOf(options))

  if (!parsed.ok) {
    return parsed
  }

  const { value } = parsed

  // Values and bounds of at most 3 decimals under 10^12 are distinct doubles:
  // comparing them is exact.
  if (options?.min !== undefined && value < options.min) {
    return { ok: false, reason: "belowMin" }
  }

  if (options?.max !== undefined && value > options.max) {
    return { ok: false, reason: "aboveMax" }
  }

  return { ok: true, value }
}

/**
 * The values within the tolerance, as scaled integers, bounds included, or
 * null without a usable right value. A percentage applies to the right
 * value, rounded down to the question's decimals.
 */
export const toleranceWindow = ({
  expected,
  options,
}: Pick<Question, "expected" | "options">): {
  low: number
  high: number
} | null => {
  const decimals = decimalsOf(options)
  const center = expected === undefined ? null : toScaled(expected, decimals)

  if (center === null) {
    return null
  }

  const tolerance = toleranceOf(options)
  let margin = 0

  if (toleranceModeOf(options) === ESTIMATE_TOLERANCE.PERCENT) {
    const tenths = Math.round(
      Math.min(tolerance, ESTIMATE_LIMITS.MAX_PERCENT) * PERCENT_SCALE,
    )

    // Up to 10^15 x 1000: past the safe integers, hence BigInt.
    margin = Number((BigInt(Math.abs(center)) * BigInt(tenths)) / PERCENT_BASE)
  } else {
    margin =
      toScaled(tolerance, decimals) ??
      Math.floor(tolerance * factorOf(decimals))
  }

  return { low: center - margin, high: center + margin }
}

export type ToleranceSide = "below" | "within" | "above"

/**
 * Where a value falls against the tolerance of the right value, or null
 * without a right value or with a value of more decimals than the question's.
 */
export const toleranceSide = (
  question: Pick<Question, "expected" | "options">,
  value: number,
): ToleranceSide | null => {
  const window = toleranceWindow(question)
  const scaled = toScaled(value, decimalsOf(question.options))

  if (window === null || scaled === null) {
    return null
  }

  if (scaled < window.low) {
    return "below"
  }

  return scaled > window.high ? "above" : "within"
}

/** Whether a value is within the tolerance of the right value. */
export const isWithinTolerance = (
  question: Pick<Question, "expected" | "options">,
  value: number,
): boolean => toleranceSide(question, value) === "within"

/** Median of the values, the mean of the middle two for an even count. */
export const medianOf = (values: readonly number[]): number | null => {
  if (values.length === 0) {
    return null
  }

  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 1) {
    return sorted[middle]
  }

  return (sorted[middle - 1] + sorted[middle]) / 2
}

// The smallest of 1, 2, 2.5 and 5 times a power of ten reaching `span`,
// whole numbers only: range bounds stay round.
const niceStep = (span: number): number => {
  let power = 1

  while (power * 5 < span) {
    power *= 10
  }

  return (
    [power, 2 * power, 2.5 * power, 5 * power]
      .filter(Number.isInteger)
      .find((step) => step >= span) ?? 5 * power
  )
}

// How many ranges of `step` values fit the `room` values of one side.
const capacity = (room: number, step: number): number =>
  Number.isFinite(room) ? Math.ceil(Math.max(0, room) / step) : Infinity

// Ranges on each side of the right one: two and two, the spare ones going to
// the side that still has room when a bound cuts the other.
const allot = (below: number, above: number) => {
  const half = ESTIMATE_LIMITS.OTHER_RANGES / 2
  const belowCount = Math.min(half, below)
  const aboveCount = Math.min(half, above)
  const spare = ESTIMATE_LIMITS.OTHER_RANGES - belowCount - aboveCount
  const extraBelow = Math.min(spare, below - belowCount)

  return {
    below: belowCount + extraBelow,
    above: aboveCount + Math.min(spare - extraBelow, above - aboveCount),
  }
}

interface ScaledRange {
  from: number | null
  to: number | null
  correct: boolean
}

const scaledBound = (value: number | undefined, decimals: number) =>
  value === undefined ? null : toScaled(value, decimals)

/**
 * The values that score, as scaled integers: the tolerance cut to the
 * bounds, past which no number can be sent, with the bounds that cut it.
 * Bounds that leave out every value of the tolerance are ignored (the
 * validator refuses them), as are bounds with more decimals than the
 * question's. Null without a usable right value.
 */
export const boundedWindow = (
  question: Pick<Question, "expected" | "options">,
): {
  low: number
  high: number
  min: number | null
  max: number | null
} | null => {
  const window = toleranceWindow(question)

  if (window === null) {
    return null
  }

  const decimals = decimalsOf(question.options)
  const min = scaledBound(question.options?.min, decimals)
  const max = scaledBound(question.options?.max, decimals)
  const low = Math.max(window.low, min ?? -Infinity)
  const high = Math.min(window.high, max ?? Infinity)

  return low <= high
    ? { low, high, min, max }
    : { ...window, min: null, max: null }
}

/**
 * The distribution of an estimate: the values within the tolerance, then two
 * ranges below and two above (four on one side when a bound leaves no room
 * on the other), as wide as the tolerance or a tenth of the right value,
 * rounded up to 1, 2, 2.5 or 5 times a power of ten. The farthest range on
 * each side is open, or ends at the bound. Values outside every range (a
 * bound changed since) count in the nearest one. Empty without a right
 * value.
 */
export const estimateRanges = (
  question: Pick<Question, "expected" | "options">,
  values: readonly number[],
): EstimateRange[] => {
  const window = toleranceWindow(question)
  const right = boundedWindow(question)

  if (window === null || right === null) {
    return []
  }

  const decimals = decimalsOf(question.options)
  const center = (window.low + window.high) / 2
  const { low, high, min: lowest, max: highest } = right
  const step = niceStep(
    Math.max(high - low + 1, Math.round(Math.abs(center) / 10), 1),
  )
  const counts = allot(
    capacity(lowest === null ? Infinity : low - lowest, step),
    capacity(highest === null ? Infinity : highest - high, step),
  )

  const below = Array.from(
    { length: counts.below },
    (_, index): ScaledRange => ({
      from: index === counts.below - 1 ? lowest : low - (index + 1) * step,
      to: low - 1 - index * step,
      correct: false,
    }),
  ).reverse()
  const above = Array.from(
    { length: counts.above },
    (_, index): ScaledRange => ({
      from: high + 1 + index * step,
      to: index === counts.above - 1 ? highest : high + (index + 1) * step,
      correct: false,
    }),
  )
  const ranges = [...below, { from: low, to: high, correct: true }, ...above]
  const tally = ranges.map(() => 0)

  for (const value of values) {
    const scaled =
      toScaled(value, decimals) ?? Math.round(value * 10 ** decimals)
    const found = ranges.findIndex(
      ({ from, to }) =>
        (from === null || scaled >= from) && (to === null || scaled <= to),
    )
    const [first] = ranges
    let index = found

    if (found === -1) {
      index = first.from !== null && scaled < first.from ? 0 : ranges.length - 1
    }

    tally[index] += 1
  }

  return ranges.map(({ from, to, correct }, index) => ({
    from: from === null ? null : fromScaled(from, decimals),
    to: to === null ? null : fromScaled(to, decimals),
    count: tally[index],
    correct,
  }))
}

/**
 * How to name a range: under or over a value for an open one (the bound of
 * its neighbour), a single value, or two bounds.
 */
export type RangeName =
  | { kind: "under"; value: number }
  | { kind: "over"; value: number }
  | { kind: "exactly"; value: number }
  | { kind: "between"; from: number; to: number }

export const nameRange = (
  ranges: readonly EstimateRange[],
  index: number,
): RangeName => {
  const { from, to } = ranges[index]

  if (from === null) {
    return { kind: "under", value: ranges.at(index + 1)?.from ?? to ?? 0 }
  }

  if (to === null) {
    return { kind: "over", value: ranges.at(index - 1)?.to ?? from }
  }

  return from === to
    ? { kind: "exactly", value: from }
    : { kind: "between", from, to }
}

const numberFormat = (fractionDigits: number) =>
  new Intl.NumberFormat(LOCALE, { maximumFractionDigits: fractionDigits })

/**
 * A value as shown in French (1 234,5), with the question's unit after a
 * no-break space. `extraDigits` shows more decimals than the question's (a
 * median between two values).
 */
export const formatEstimate = (
  value: number,
  options: QuestionOptions | undefined,
  { extraDigits = 0, withUnit = true } = {},
): string => {
  // -0 would print with its sign.
  const number = numberFormat(decimalsOf(options) + extraDigits).format(
    value || 0,
  )
  const unit = unitOf(options)

  return withUnit && unit !== "" ? `${number}${NO_BREAK_SPACE}${unit}` : number
}

/** The tolerance as shown: « 5 % », or in the unit (« 2 km »). */
export const formatTolerance = (
  options: QuestionOptions | undefined,
): string => {
  const tolerance = toleranceOf(options)

  if (toleranceModeOf(options) === ESTIMATE_TOLERANCE.PERCENT) {
    return `${numberFormat(ESTIMATE_LIMITS.PERCENT_DECIMALS).format(tolerance)}${NO_BREAK_SPACE}%`
  }

  return formatEstimate(tolerance, options)
}

/** A plain decimal string (1234.5), as a phone sends a number. */
export const toPlainNumber = (value: number, decimals: number): string =>
  value.toFixed(decimals)
