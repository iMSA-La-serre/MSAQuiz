import type { EstimateRange, QuestionOptions } from "@razzia/common/types/game"
import {
  type EstimateCheck,
  decimalsOf,
  formatEstimate,
  formatTolerance,
  nameRange,
  toleranceOf,
} from "@razzia/common/utils/estimate"
import type { TFunction } from "i18next"

// Wording of the estimate numbers on every screen, from the pure helpers of
// the common package: the phone, the projector and the result views name a
// number, a range or a refusal alike.

const bare = (value: number, options: QuestionOptions | undefined) =>
  formatEstimate(value, options, { withUnit: false })

/**
 * The hint above the field and on the projector: the bounds, then the
 * tolerance. A lone minimum of 0 is left out: it only turns negative numbers
 * away, which the help line then says.
 */
export const estimateHint = (
  t: TFunction,
  options: QuestionOptions | undefined,
): string => {
  const { min, max } = options ?? {}
  const format = (value: number) => formatEstimate(value, options)
  let bounds = t("game:estimate.hintAny")

  if (min !== undefined && max !== undefined) {
    bounds = t("game:estimate.hintRange", {
      min: bare(min, options),
      max: format(max),
    })
  } else if (max !== undefined) {
    bounds = t("game:estimate.hintUpTo", { max: format(max) })
  } else if (min !== undefined && min !== 0) {
    bounds = t("game:estimate.hintFrom", { min: format(min) })
  }

  return toleranceOf(options) > 0
    ? t("game:estimate.hintTolerance", {
        bounds,
        tolerance: formatTolerance(options),
      })
    : bounds
}

/**
 * The help line under « Valider »: why a number cannot be sent yet, or the
 * number as it will be sent, so a player sees how « 1.500 » was read.
 */
export const checkMessage = (
  t: TFunction,
  check: EstimateCheck,
  options: QuestionOptions | undefined,
): { text: string; refused: boolean } => {
  if (check.ok) {
    return {
      text: t("game:estimate.read", {
        value: formatEstimate(check.value, options),
      }),
      refused: false,
    }
  }

  const decimals = decimalsOf(options)
  const texts: Record<typeof check.reason, () => string> = {
    empty: () => t("game:estimate.empty"),
    invalid: () => t("game:estimate.invalid"),
    decimals: () =>
      decimals === 0
        ? t("game:estimate.integer")
        : t("game:estimate.decimals", { count: decimals }),
    tooLarge: () => t("game:estimate.tooLarge"),
    belowMin: () =>
      t("game:estimate.belowMin", {
        min: formatEstimate(options?.min ?? 0, options),
      }),
    aboveMax: () =>
      t("game:estimate.aboveMax", {
        max: formatEstimate(options?.max ?? 0, options),
      }),
  }

  return { text: texts[check.reason](), refused: check.reason !== "empty" }
}

/**
 * A range of the distribution: « Moins de 30 km », « 30 à 34 km », « 35 km »,
 * « Plus de 40 km ».
 */
export const rangeText = (
  t: TFunction,
  ranges: readonly EstimateRange[],
  { index, options }: { index: number; options: QuestionOptions | undefined },
): string => {
  const name = nameRange(ranges, index)
  const format = (value: number) => formatEstimate(value, options)

  switch (name.kind) {
    case "under": {
      return t("game:estimate.under", { value: format(name.value) })
    }

    case "over": {
      return t("game:estimate.over", { value: format(name.value) })
    }

    case "exactly": {
      return format(name.value)
    }

    default: {
      return t("game:estimate.between", {
        from: bare(name.from, options),
        to: format(name.to),
      })
    }
  }
}

/** The right value, and the median with one more decimal when between two. */
export const summaryText = (
  t: TFunction,
  {
    expected,
    median,
    options,
  }: {
    expected?: number | null
    median?: number | null
    options?: QuestionOptions
  },
  keys: { expected: string; summary: string },
): string | null => {
  if (expected === undefined || expected === null) {
    return null
  }

  const values = {
    expected: formatEstimate(expected, options),
    median:
      median === undefined || median === null
        ? ""
        : formatEstimate(median, options, { extraDigits: 1 }),
  }

  return t(values.median === "" ? keys.expected : keys.summary, values)
}
