import { ESTIMATE_LIMITS } from "@razzia/common/constants"
import {
  type EstimateParse,
  fitsDecimals,
  parseEstimate,
} from "@razzia/common/utils/estimate"
import type { TFunction } from "i18next"
import { useState } from "react"

// A number the author types in the editor, kept as typed while it is being
// written: « 12, » is not 12 yet. Read with the most decimals any question
// takes, so a value with more decimals than the question's setting is still
// kept, and flagged.

type Refusal = Extract<EstimateParse, { ok: false }>["reason"]

/** A stored value as the author edits it: French comma, no digit groups. */
export const toDraft = (value: number | undefined): string =>
  value === undefined ? "" : String(value).replace(".", ",")

// A number that is being typed changes the question once it reads as one; a
// field emptied clears the value, unless a switch says whether it is set
// (`keepOnEmpty`): the field would vanish under the author's fingers.
export const useNumberDraft = (
  value: number | undefined,
  onChange: (_value: number | undefined) => void,
  { keepOnEmpty = false } = {},
) => {
  const [draft, setDraft] = useState(() => toDraft(value))
  const parsed = parseEstimate(draft, ESTIMATE_LIMITS.MAX_DECIMALS)
  // Empty is no number, not an error: an optional field is left out.
  const refusal: Refusal | null =
    parsed.ok || parsed.reason === "empty" ? null : parsed.reason

  const update = (next: string) => {
    setDraft(next)

    const result = parseEstimate(next, ESTIMATE_LIMITS.MAX_DECIMALS)

    if (result.ok) {
      onChange(result.value)
    } else if (result.reason === "empty" && !keepOnEmpty) {
      onChange(undefined)
    }
  }

  // Shows a value set from elsewhere (a switch), without changing it again.
  const reset = (next: number | undefined) => {
    setDraft(toDraft(next))
  }

  return { draft, update, reset, refusal }
}

/**
 * What is wrong with a number of the editor, or null: not a number, too
 * large, or more decimals than the question takes.
 */
export const draftNote = (
  t: TFunction,
  {
    refusal,
    value,
    decimals,
  }: { refusal: Refusal | null; value: number | undefined; decimals: number },
): string | null => {
  if (refusal === "tooLarge") {
    return t("quizz:estimate.tooLarge")
  }

  if (refusal !== null) {
    return t("quizz:estimate.invalid")
  }

  if (value === undefined || fitsDecimals(value, decimals)) {
    return null
  }

  return decimals === 0
    ? t("quizz:estimate.integer")
    : t("quizz:estimate.decimals", { count: decimals })
}
