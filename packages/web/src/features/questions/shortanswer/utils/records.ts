import type {
  PlayerAnswerRecord,
  QuestionResult,
} from "@razzia/common/types/game"

// A recorded shortanswer holds the index of the accepted answer recognized,
// or nothing when the text matched none; answerIds is null without an answer.

/** Whether the player's text was recognized as an accepted answer. */
export const isRecognized = ({ answerIds }: PlayerAnswerRecord): boolean =>
  answerIds !== null && answerIds.length > 0

/** Players whose text each accepted answer recognized. */
export const acceptedCounts = ({
  accepted = [],
  playerAnswers,
}: QuestionResult): number[] =>
  accepted.map(
    (_, index) =>
      playerAnswers.filter(({ answerIds }) => answerIds?.includes(index))
        .length,
  )

/** Players who typed a text that matched no accepted answer. */
export const unrecognizedCount = ({ playerAnswers }: QuestionResult): number =>
  playerAnswers.filter(({ answerIds }) => answerIds?.length === 0).length

/** Indices of `counts`, the largest count first; ties keep their order. */
export const rankByCount = (counts: readonly number[]): number[] =>
  counts.map((_, index) => index).sort((a, b) => counts[b] - counts[a] || a - b)

/**
 * The accepted answers the host distribution names, the largest count first:
 * those that recognized a text, and the first one in any case, so the
 * expected answer shows even when nobody typed it. Past `max`, the last named
 * row gives way to one summing the rest (`others`).
 */
export const namedAccepted = (
  counts: readonly number[],
  max: number,
): { named: number[]; others: number[] } => {
  const listed = rankByCount(counts).filter(
    (index) => index === 0 || counts[index] > 0,
  )

  if (listed.length <= max) {
    return { named: listed, others: [] }
  }

  return { named: listed.slice(0, max - 1), others: listed.slice(max - 1) }
}
