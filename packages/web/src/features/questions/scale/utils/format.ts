import type { QuestionOptions } from "@razzia/common/types/game"
import {
  scaleEndLabel,
  type ScaleRange,
  scaleSummary,
} from "@razzia/common/utils/scale"
import type { TFunction } from "i18next"

// How the levels of a scale read on the screens and in the result window.

/** A mean or a median: one decimal at most, in the reader's language. */
export const formatLevel = (value: number, language: string): string =>
  new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value)

/** What an end of the scale stands for, or an empty text in between. */
export const endLabelOf = (
  options: QuestionOptions | undefined,
  range: ScaleRange,
  value: number,
): string => {
  if (value === range.min) {
    return scaleEndLabel(options, "low")
  }

  return value === range.max ? scaleEndLabel(options, "high") : ""
}

/**
 * The mean and the median of the levels picked, for the hint above the rows,
 * or null when nobody picked one.
 */
export const summaryText = (
  t: TFunction,
  language: string,
  { counts, min }: { counts: readonly number[]; min: number },
): string | null => {
  const { mean, median } = scaleSummary(counts, min)

  if (mean === null || median === null) {
    return null
  }

  return t("game:responses.scaleSummary", {
    mean: formatLevel(mean, language),
    median: formatLevel(median, language),
  })
}
