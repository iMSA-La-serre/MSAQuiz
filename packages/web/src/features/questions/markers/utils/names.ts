import type { TFunction } from "i18next"

/**
 * How the editor names a marker to a screen reader: its number, and its
 * label once it has one, never an empty pair of quotes.
 */
export const markerName = (
  t: TFunction,
  index: number,
  label: string | undefined,
): string => {
  const trimmed = label?.trim() ?? ""

  return trimmed === ""
    ? t("quizz:markers.markerUnnamed", { number: index + 1 })
    : t("quizz:markers.marker", { number: index + 1, label: trimmed })
}
