import type {
  PlayerAnswerRecord,
  QuestionResult,
} from "@razzia/common/types/game"

// A recorded markers answer lists the markers tapped, as indices into the
// question's answers (their labels); the right markers are its solutions.

/** The markers a player tapped, in the order of their numbers. */
export const pickedMarkers = ({ answerIds }: PlayerAnswerRecord): number[] =>
  [...(answerIds ?? [])].sort((a, b) => a - b)

/**
 * How the answer went, as the player was told: any credit earned is correct,
 * as on a multiple choice. The multiplier saved with the answer decides, so a
 * wrong marker tapped next to a right one can cost it all; an answer saved
 * without one is credited for a right marker tapped.
 */
export const markersVerdict = (
  question: Pick<QuestionResult, "solutions">,
  record: PlayerAnswerRecord,
): "correct" | "wrong" | "noAnswer" => {
  const picked = pickedMarkers(record)

  if (picked.length === 0) {
    return "noAnswer"
  }

  const credited =
    record.score === undefined
      ? picked.some((id) => question.solutions.includes(id))
      : record.score > 0

  return credited ? "correct" : "wrong"
}

/**
 * Whether a recorded answer counts among the right ones: the verdict of its
 * row, so the result window's figure, its rows, the statistics and the export
 * all agree.
 */
export const isMarkersCorrect = (
  question: Pick<QuestionResult, "solutions">,
  record: PlayerAnswerRecord,
): boolean => markersVerdict(question, record) === "correct"

/**
 * The answers that earned credit, full or partial, as the projector's hint
 * counts them: any credit is a right answer on a markers question, as the
 * phones said.
 */
export const creditedAnswers = ({
  correctCount = 0,
  partialCount = 0,
}: {
  correctCount?: number
  partialCount?: number
}): number => correctCount + partialCount
