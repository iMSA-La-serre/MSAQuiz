import type {
  PlayerAnswerRecord,
  QuestionResult,
  WordCount,
} from "@razzia/common/types/game"

// A word cloud keeps no answer per player: each record only says whether the
// player answered, and the words are counted on the question.

/** Whether the player answered the word cloud. */
export const hasAnswered = ({ answerIds, answered }: PlayerAnswerRecord) =>
  answerIds !== null && answered === true

/**
 * The words the result window names, the most frequent first; past `max`,
 * the rest are summed in `others` (how many words, how many times given).
 */
export const namedWords = (
  { words = [] }: QuestionResult,
  max: number,
): { named: WordCount[]; others: { words: number; count: number } } => {
  const named = words.slice(0, max)
  const rest = words.slice(max)

  return {
    named,
    others: {
      words: rest.length,
      count: rest.reduce((sum, { count }) => sum + count, 0),
    },
  }
}
