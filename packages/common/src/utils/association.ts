import {
  MATCH_SCORING,
  QUESTION_TYPES,
  STATEMENT_TARGETS,
} from "@razzia/common/constants"
import type { MatchScoring, Question } from "@razzia/common/types/game"

// Statements and categorize share one engine: each item (an answer) is
// matched with one target (Vrai or Faux, or a category). A player answers
// with the index of a target per item; the right ones are the question's
// `expectedTargets`, which stay on the server.

const ASSOCIATION_TYPES = new Set<string>([
  QUESTION_TYPES.STATEMENTS,
  QUESTION_TYPES.CATEGORIZE,
])

/**
 * Whether a type is answered by matching each item with a target. Narrowed to
 * the two types it accepts, so the comparisons that follow a negative call
 * keep being checked.
 */
export const isAssociationType = (
  type: unknown,
): type is
  typeof QUESTION_TYPES.STATEMENTS | typeof QUESTION_TYPES.CATEGORIZE =>
  typeof type === "string" && ASSOCIATION_TYPES.has(type)

/**
 * The targets of a question: Vrai and Faux for statements, whatever is
 * stored, its categories for a categorize question.
 */
export const targetsOf = ({
  type,
  targets,
}: Pick<Question, "type" | "targets">): string[] =>
  type === QUESTION_TYPES.STATEMENTS ? [...STATEMENT_TARGETS] : (targets ?? [])

/**
 * The wording of the right target of an item, or null when it has none: a
 * question stored without its expected targets, or with fewer of them than it
 * has items.
 */
export const rightTargetOf = (
  question: Pick<Question, "type" | "targets" | "expectedTargets">,
  index: number,
): string | null => {
  const target = question.expectedTargets?.at(index)

  return target === undefined || target < 0
    ? null
    : (targetsOf(question).at(target) ?? null)
}

/** The scoring an association applies: share when none is set. */
export const matchScoringOf = (mode?: MatchScoring): MatchScoring =>
  mode === MATCH_SCORING.EXACT ? MATCH_SCORING.EXACT : MATCH_SCORING.SHARE

/**
 * Whether each item, in the order of the answers, was matched with its right
 * target. A pick missing or out of range is not.
 */
export const matchedItems = (
  picks: readonly number[],
  expected: readonly number[],
): boolean[] => expected.map((target, index) => picks[index] === target)

/** Items matched with their right target, out of how many. */
export const countMatched = (
  picks: readonly number[],
  expected: readonly number[],
): { count: number; total: number } => ({
  count: matchedItems(picks, expected).filter(Boolean).length,
  total: expected.length,
})

/**
 * Multiplier of an association answer: the share of items matched with their
 * right target (share), or 1 only when every item is (exact).
 */
export const scoreAssociation = (
  picks: readonly number[],
  expected: readonly number[],
  mode?: MatchScoring,
): number => {
  const { count, total } = countMatched(picks, expected)

  if (total === 0) {
    return 0
  }

  if (matchScoringOf(mode) === MATCH_SCORING.EXACT) {
    return count === total ? 1 : 0
  }

  return count / total
}
