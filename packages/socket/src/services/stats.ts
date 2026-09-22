import { QUESTION_TYPE_META, QUESTION_TYPES } from "@razzia/common/constants"
import type {
  GameResult,
  PlayerAnswerRecord,
  QuestionResult,
  QuestionStats,
} from "@razzia/common/types/game"
import { placedItems } from "@razzia/common/utils/ordering"
import { isKnownType, QUESTION_SCORING } from "@razzia/socket/services/scoring"

type AnsweredRecord = PlayerAnswerRecord & { answerIds: number[] }

/**
 * Whether a record holds an answer. A shortanswer text that matched no
 * accepted answer is one too, with no answer id.
 */
export const hasAnswer = (
  record: PlayerAnswerRecord,
): record is AnsweredRecord =>
  record.answerIds !== null &&
  (record.answerIds.length > 0 || typeof record.text === "string")

/**
 * Multiplier of a recorded answer: the one saved when the question closed,
 * or computed again for results saved before it was.
 */
export const recordScore = (
  question: QuestionResult,
  record: AnsweredRecord,
): number =>
  record.score ??
  QUESTION_SCORING[question.type](question, {
    answerIds: record.answerIds,
    text: record.text ?? undefined,
  })

/**
 * Whether a recorded answer counts as correct in the statistics. The types
 * that existed before partial credit keep their rule, any credit; the others
 * need full credit.
 */
export const isCorrectRecord = (
  question: QuestionResult,
  record: AnsweredRecord,
): boolean => {
  const { scored, partialOutcome } = QUESTION_TYPE_META[question.type]

  if (!scored) {
    return false
  }

  const score = recordScore(question, record)

  return partialOutcome ? score === 1 : score > 0
}

// Wording of the correct answers. Shortanswer: every accepted answer is one.
// Ordering: every item has its place, none stands out.
const solutionLabelsOf = (question: QuestionResult): string[] => {
  if (question.type === QUESTION_TYPES.SHORTANSWER) {
    return question.accepted ?? []
  }

  if (question.type === QUESTION_TYPES.ORDERING) {
    return []
  }

  // A solution can point outside the answers of an older game: .at() says so
  // in the types, indexing does not.
  return question.solutions
    .map((index) => question.answers.at(index))
    .filter((answer): answer is string => answer !== undefined)
}

// Labels a recorded answer counts for. Ordering: the items put at their
// place. Shortanswer: the accepted answer recognized.
const answerLabels = (
  question: QuestionResult,
  answerIds: number[],
): string[] => {
  if (question.type === QUESTION_TYPES.ORDERING) {
    return placedItems(answerIds, question.answers.length).flatMap(
      (placed, index) => (placed ? [question.answers[index]] : []),
    )
  }

  const labels =
    question.type === QUESTION_TYPES.SHORTANSWER
      ? (question.accepted ?? [])
      : question.answers

  return answerIds.flatMap((id) => {
    const label = labels.at(id)

    return label === undefined ? [] : [label]
  })
}

interface Tally {
  stats: QuestionStats
  // Ordering: sum of the multipliers, for the mean.
  scoreSum: number
}

// Types whose answer ids are not picked choices: they never share a row with
// another type, even under the same wording. The choice types still merge,
// as they always did.
const OWN_ROW_TYPES = new Set<string>([
  QUESTION_TYPES.ORDERING,
  QUESTION_TYPES.SHORTANSWER,
])

const groupKey = (question: QuestionResult, label: string): string =>
  OWN_ROW_TYPES.has(question.type) ? `${question.type}\u0000${label}` : label

const newTally = (question: QuestionResult, label: string): Tally => {
  const solutionLabels = solutionLabelsOf(question)
  // Listed even when nobody picks them: seeing the expected answer next to
  // the chosen ones is the whole point. Ordering lists every item.
  const listed =
    question.type === QUESTION_TYPES.ORDERING
      ? question.answers
      : solutionLabels

  return {
    stats: {
      question: label,
      type: question.type,
      scored: QUESTION_TYPE_META[question.type].scored,
      gameCount: 0,
      answerCount: 0,
      missingCount: 0,
      correctCount: 0,
      successRate: null,
      answers: listed.map((answer) => ({ label: answer, count: 0 })),
      // Games come most recent first, so the first one seen carries the
      // wording to show.
      solutionLabels,
      ...(question.type === QUESTION_TYPES.ORDERING && { averageScore: null }),
      ...(question.type === QUESTION_TYPES.SHORTANSWER && {
        unrecognizedCount: 0,
      }),
    },
    scoreSum: 0,
  }
}

const countRecord = (
  tally: Tally,
  question: QuestionResult,
  record: PlayerAnswerRecord,
) => {
  const { stats } = tally

  if (!hasAnswer(record)) {
    stats.missingCount += 1

    return
  }

  stats.answerCount += 1

  if (isCorrectRecord(question, record)) {
    stats.correctCount += 1
  }

  if (question.type === QUESTION_TYPES.ORDERING) {
    tally.scoreSum += recordScore(question, record)
  }

  if (
    question.type === QUESTION_TYPES.SHORTANSWER &&
    stats.unrecognizedCount !== undefined &&
    record.answerIds.length === 0
  ) {
    stats.unrecognizedCount += 1
  }

  for (const answer of answerLabels(question, record.answerIds)) {
    const known = stats.answers.find((a) => a.label === answer)

    if (known) {
      known.count += 1
    } else {
      stats.answers.push({ label: answer, count: 1 })
    }
  }
}

/**
 * Aggregates the questions of several games of the same quizz.
 *
 * Questions are grouped by their text rather than by their position: a quizz
 * can be edited or reordered between two games, and merging "the same
 * question" is what makes the numbers readable. An ordering or a shortanswer
 * only merges with the same type, so the same wording can show up once more
 * under another type. Info slides never reach the history, so they never show
 * up here either, and a type this version does not know is left out.
 *
 * `successRate` counts correct answers over answers actually given: players
 * who let the timer run out are reported separately in `missingCount`, so a
 * hard question and an unread one do not look alike.
 */
export const aggregateQuestions = (games: GameResult[]): QuestionStats[] => {
  const byQuestion = new Map<string, Tally>()

  for (const game of games) {
    for (const question of game.questions) {
      if (!isKnownType(question.type)) {
        continue
      }

      const label = question.question.trim()
      const key = groupKey(question, label)
      const tally = byQuestion.get(key) ?? newTally(question, label)

      tally.stats.gameCount += 1

      for (const record of question.playerAnswers) {
        countRecord(tally, question, record)
      }

      byQuestion.set(key, tally)
    }
  }

  return [...byQuestion.values()]
    .map(({ stats, scoreSum }) => ({
      ...stats,
      successRate:
        stats.scored && stats.answerCount > 0
          ? stats.correctCount / stats.answerCount
          : null,
      ...(stats.averageScore !== undefined && {
        averageScore:
          stats.answerCount > 0 ? scoreSum / stats.answerCount : null,
      }),
    }))
    .sort((a, b) => {
      // Hardest questions first; the ones with no rate (polls, unanswered)
      // carry no lesson, so they close the list.
      if (a.successRate === null || b.successRate === null) {
        return Number(a.successRate === null) - Number(b.successRate === null)
      }

      return a.successRate - b.successRate
    })
}

/** Overall success rate of a quizz, across every scored question. */
export const overallSuccessRate = (
  questions: QuestionStats[],
): number | null => {
  const scored = questions.filter((question) => question.scored)
  const answers = scored.reduce((sum, q) => sum + q.answerCount, 0)

  if (answers === 0) {
    return null
  }

  return scored.reduce((sum, q) => sum + q.correctCount, 0) / answers
}
