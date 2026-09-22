// The editor of statements and categorize keeps one right target per item,
// aligned with the answers: UNSET while the author has not picked one, which
// the validator refuses on save.

export const UNSET = -1

interface Draft {
  answers: string[]
  expectedTargets: number[]
}

/** One right target per item, UNSET where there is none. */
export const alignedTargets = (
  expectedTargets: readonly number[] | undefined,
  count: number,
): number[] =>
  Array.from(
    { length: count },
    (_, index) => expectedTargets?.at(index) ?? UNSET,
  )

/** A new empty item at the end, with no right target yet. */
export const withItem = (
  answers: readonly string[],
  expectedTargets: readonly number[] | undefined,
): Draft => ({
  answers: [...answers, ""],
  expectedTargets: [...alignedTargets(expectedTargets, answers.length), UNSET],
})

/** The item at `index` removed, with its right target. */
export const withoutItem = (
  answers: readonly string[],
  expectedTargets: readonly number[] | undefined,
  index: number,
): Draft => ({
  answers: answers.filter((_, i) => i !== index),
  expectedTargets: alignedTargets(expectedTargets, answers.length).filter(
    (_, i) => i !== index,
  ),
})

/** The right target of the item at `index` set to `target`. */
export const withTarget = (
  expectedTargets: readonly number[],
  index: number,
  target: number,
): number[] =>
  expectedTargets.map((current, i) => (i === index ? target : current))

/**
 * The category at `index` removed: the items it held have none left, the
 * ones in the categories after it follow them.
 */
export const withoutCategory = (
  targets: readonly string[],
  expectedTargets: readonly number[],
  index: number,
): { targets: string[]; expectedTargets: number[] } => ({
  targets: targets.filter((_, i) => i !== index),
  expectedTargets: expectedTargets.map((target) => {
    if (target === index) {
      return UNSET
    }

    return target > index ? target - 1 : target
  }),
})
