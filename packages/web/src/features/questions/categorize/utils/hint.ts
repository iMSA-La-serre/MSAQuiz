import { cleanText } from "@razzia/common/utils/text"
import type { TFunction } from "i18next"

// « Famille, Retraite ou Maladie ».
const CATEGORY_LIST = new Intl.ListFormat("fr-FR", {
  style: "long",
  type: "disjunction",
})

/**
 * The hint above the elements to sort. The projector names the categories to
 * sort them into; the phone, which shows them under each element, says one
 * is expected for each, as the projector does when there are none to name.
 */
export const categorizeHint = (
  t: TFunction,
  _options: unknown,
  {
    targets = [],
    size,
  }: { targets?: readonly string[]; size: "host" | "phone" },
): string => {
  const names = targets.map(cleanText).filter((name) => name !== "")

  return size === "host" && names.length > 0
    ? t("game:answer.categorizeHint", { targets: CATEGORY_LIST.format(names) })
    : t("game:answer.categorizeHintAny")
}
