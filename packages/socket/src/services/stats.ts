import {
  QUESTION_TYPE_META,
  QUESTION_TYPES,
  WORDCLOUD_LIMITS,
} from "@razzia/common/constants"
import type {
  GameResult,
  PlayerAnswerRecord,
  QuestionResult,
  QuestionStats,
  ScaleCounts,
  WordCount,
} from "@razzia/common/types/game"
import {
  isAssociationType,
  matchedItems,
  rightTargetOf,
} from "@razzia/common/utils/association"
import { partialCredits, partialOutcomeOf } from "@razzia/common/utils/choice"
import { medianOf, toleranceSide } from "@razzia/common/utils/estimate"
import { placedItems } from "@razzia/common/utils/ordering"
import { rankOrder, rankPoints } from "@razzia/common/utils/ranking"
import {
  scaleEndLabel,
  scaleRangeOf,
  scaleSummary,
} from "@razzia/common/utils/scale"
import { countWords } from "@razzia/common/utils/wordcloud"
import { isKnownType, QUESTION_SCORING } from "@razzia/socket/services/scoring"

type AnsweredRecord = PlayerAnswerRecord & { answerIds: number[] }

/**
 * Whether a record holds an answer. A shortanswer text that matched no
 * accepted answer is one too, with no answer id, so is an estimate value, and
 * so is the answer of a type that is not nominative (wordcloud, scale), which
 * only says it was given.
 */
export const hasAnswer = (
  record: PlayerAnswerRecord,
): record is AnsweredRecord =>
  record.answerIds !== null &&
  (record.answerIds.length > 0 ||
    typeof record.text === "string" ||
    typeof record.value === "number" ||
    record.answered === true)

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
    value: record.value ?? undefined,
  })

/**
 * Whether a recorded answer counts as correct in the statistics. The types
 * that existed before partial credit keep their rule, any credit; the others
 * need full credit, and so does a single choice with partial credits, whose
 * partly right answers the phones did not call right.
 */
export const isCorrectRecord = (
  question: QuestionResult,
  record: AnsweredRecord,
): boolean => {
  if (!QUESTION_TYPE_META[question.type].scored) {
    return false
  }

  const score = recordScore(question, record)

  return partialOutcomeOf(question) ? score === 1 : score > 0
}

/**
 * The answers of a single choice with partial credits that are not right but
 * earn part of the points, with their credit in percent. Empty otherwise.
 */
export const creditedLabels = (
  question: QuestionResult,
): Array<{ label: string; credit: number }> =>
  (partialCredits(question) ?? []).flatMap((credit, index) => {
    const label = question.answers.at(index)

    return label !== undefined &&
      credit > 0 &&
      !question.solutions.includes(index)
      ? [{ label, credit }]
      : []
  })

// Wording of the correct answers. Shortanswer: every accepted answer is one.
// Statements and categorize: the right target of each item, in the order of
// the items. Ordering: every item has its place, none stands out. Estimate:
// the right value is a number, given apart.
const solutionLabelsOf = (question: QuestionResult): string[] => {
  if (question.type === QUESTION_TYPES.SHORTANSWER) {
    return question.accepted ?? []
  }

  if (isAssociationType(question.type)) {
    return question.answers.map(
      (_, index) => rightTargetOf(question, index) ?? "",
    )
  }

  if (
    question.type === QUESTION_TYPES.ORDERING ||
    question.type === QUESTION_TYPES.ESTIMATE
  ) {
    return []
  }

  // A solution can point outside the answers of an older game: .at() says so
  // in the types, indexing does not.
  return question.solutions
    .map((index) => question.answers.at(index))
    .filter((answer): answer is string => answer !== undefined)
}

// The items flagged right, as labels.
const itemLabels = (question: QuestionResult, flags: boolean[]): string[] =>
  flags.flatMap((right, index) => {
    const label = question.answers.at(index)

    return right && label !== undefined ? [label] : []
  })

// Labels a recorded answer counts for. Ordering: the items put at their
// place. Statements and categorize: the items matched with their right
// target. Ranking: the proposal put first. Shortanswer: the accepted answer
// recognized.
const answerLabels = (
  question: QuestionResult,
  answerIds: number[],
): string[] => {
  if (question.type === QUESTION_TYPES.RANKING) {
    const first = answerIds.at(0)
    const label = first === undefined ? undefined : question.answers.at(first)

    return label === undefined ? [] : [label]
  }

  if (question.type === QUESTION_TYPES.ORDERING) {
    return itemLabels(question, placedItems(answerIds, question.answers.length))
  }

  if (isAssociationType(question.type)) {
    return itemLabels(
      question,
      matchedItems(answerIds, question.expectedTargets ?? []),
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

// Types whose statistics give the mean multiplier: a partial answer is not
// counted correct, the mean tells how close the answers came. A single choice
// with partial credits gives it too, see newTally.
const AVERAGE_SCORE_TYPES = new Set<string>([
  QUESTION_TYPES.ORDERING,
  QUESTION_TYPES.HIGHLIGHT,
  QUESTION_TYPES.STATEMENTS,
  QUESTION_TYPES.CATEGORIZE,
])

// Types that list every answer, picked or not: all the items of an ordering,
// of statements, of categorize or of a ranking, all the passages of a
// highlight, all the markers of an image.
const LIST_ALL_TYPES = new Set<string>([
  QUESTION_TYPES.ORDERING,
  QUESTION_TYPES.HIGHLIGHT,
  QUESTION_TYPES.STATEMENTS,
  QUESTION_TYPES.CATEGORIZE,
  QUESTION_TYPES.RANKING,
  QUESTION_TYPES.MARKERS,
])

interface Tally {
  stats: QuestionStats
  // Ordering, highlight, statements and categorize, and a single choice with
  // partial credits: sum of the multipliers, for the mean.
  scoreSum: number
  // Wordcloud: the words of every game, counted together at the end, and
  // whether a game kept none (too few authors).
  words: WordCount[]
  withheld: boolean
  // Estimate: every value given, for the median.
  values: number[]
  // Ranking: the rank points of each proposal, by label, across the games.
  points: Map<string, number>
  // Scale: the players of each level, by value, across the games, and those
  // who preferred not to answer.
  levels: Map<number, number>
  skipped: number
}

// Types whose answer ids are not picked choices, the highlight, whose
// passages come from its text, and the markers, whose answers are the labels
// of spots on an image: they never share a row with another type, even under
// the same wording. The choice types still merge, as they always did.
const OWN_ROW_TYPES = new Set<string>([
  QUESTION_TYPES.ORDERING,
  QUESTION_TYPES.SHORTANSWER,
  QUESTION_TYPES.WORDCLOUD,
  QUESTION_TYPES.ESTIMATE,
  QUESTION_TYPES.HIGHLIGHT,
  QUESTION_TYPES.STATEMENTS,
  QUESTION_TYPES.CATEGORIZE,
  QUESTION_TYPES.RANKING,
  QUESTION_TYPES.SCALE,
  QUESTION_TYPES.MARKERS,
])

const groupKey = (question: QuestionResult, label: string): string =>
  OWN_ROW_TYPES.has(question.type) ? `${question.type}\u0000${label}` : label

const newTally = (question: QuestionResult, label: string): Tally => {
  const solutionLabels = solutionLabelsOf(question)
  const credits = creditedLabels(question)
  // Listed even when nobody picks them: seeing the expected answer next to
  // the chosen ones is the whole point. Ordering lists every item, highlight
  // every passage; a single choice the answers earning part of the points
  // after the right ones.
  const listed = LIST_ALL_TYPES.has(question.type)
    ? question.answers
    : [...solutionLabels, ...credits.map((entry) => entry.label)]

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
      ...((AVERAGE_SCORE_TYPES.has(question.type) || credits.length > 0) && {
        averageScore: null,
      }),
      ...(credits.length > 0 && { credits }),
      ...(question.type === QUESTION_TYPES.SHORTANSWER && {
        unrecognizedCount: 0,
      }),
      ...(question.type === QUESTION_TYPES.SCALE && {
        scale: scaleLevels(question),
      }),
      ...(question.type === QUESTION_TYPES.ESTIMATE && {
        estimate: {
          below: 0,
          within: 0,
          above: 0,
          median: null,
          expected: question.expected ?? null,
          ...(question.options && { options: question.options }),
        },
      }),
    },
    scoreSum: 0,
    words: [],
    withheld: false,
    values: [],
    points: new Map<string, number>(),
    levels: new Map<number, number>(),
    skipped: 0,
  }
}

// The scale of a question, as its most recent game had it: a later game may
// have been played on another one, whose answers still count.
const scaleLevels = (question: QuestionResult) => {
  const { min, max } = scaleRangeOf(question.options)
  const low = scaleEndLabel(question.options, "low")
  const high = scaleEndLabel(question.options, "high")

  return {
    min,
    max,
    ...(low !== "" && { low }),
    ...(high !== "" && { high }),
    skipped: 0,
    mean: null,
    median: null,
  }
}

/**
 * The counts of a stored scale, skipping an entry edited into something else
 * by hand.
 */
export const storedScale = ({ scale }: QuestionResult): ScaleCounts => {
  const counts: unknown = scale?.counts
  const skipped: unknown = scale?.skipped

  return {
    counts: Array.isArray(counts)
      ? (counts as unknown[]).map((count) =>
          typeof count === "number" && Number.isFinite(count) ? count : 0,
        )
      : [],
    skipped:
      typeof skipped === "number" && Number.isFinite(skipped) ? skipped : 0,
  }
}

/**
 * The words of a stored word cloud, skipping any entry edited into something
 * else by hand.
 */
export const storedWords = ({ words }: QuestionResult): WordCount[] => {
  const entries: unknown = words

  if (!Array.isArray(entries)) {
    return []
  }

  return entries.filter(
    (word: unknown): word is WordCount =>
      typeof word === "object" &&
      word !== null &&
      typeof (word as WordCount).text === "string" &&
      Number.isFinite((word as WordCount).count),
  )
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

  if (stats.averageScore !== undefined) {
    tally.scoreSum += recordScore(question, record)
  }

  if (
    question.type === QUESTION_TYPES.SHORTANSWER &&
    stats.unrecognizedCount !== undefined &&
    record.answerIds.length === 0
  ) {
    stats.unrecognizedCount += 1
  }

  // Each value against the tolerance of its own game.
  if (typeof record.value === "number" && stats.estimate) {
    const side = toleranceSide(question, record.value)

    tally.values.push(record.value)

    if (side) {
      stats.estimate[side] += 1
    }
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
 * The levels of a scale across the games: every value played, listed from the
 * lowest, with their mean and their median. A game played on another scale
 * widens the list rather than losing its answers.
 */
const scaleAggregate = (
  scale: NonNullable<QuestionStats["scale"]>,
  { levels, skipped, withheld }: Pick<Tally, "levels" | "skipped" | "withheld">,
): Pick<QuestionStats, "answers" | "scale"> => {
  const played = [...levels.keys()]
  const min = Math.min(scale.min, ...played)
  const max = Math.max(scale.max, ...played)
  const counts = Array.from(
    { length: Math.max(0, max - min + 1) },
    (_, index) => levels.get(min + index) ?? 0,
  )
  const { mean, median } = scaleSummary(counts, min)

  return {
    answers: counts.map((count, index) => ({
      label: String(min + index),
      count,
    })),
    scale: {
      ...scale,
      min,
      max,
      skipped,
      mean,
      median,
      ...(withheld &&
        counts.every((count) => count === 0) && { withheld: true }),
    },
  }
}

/**
 * Aggregates the questions of several games of the same quizz.
 *
 * Questions are grouped by their text rather than by their position: a quizz
 * can be edited or reordered between two games, and merging "the same
 * question" is what makes the numbers readable. A type newer than the choice
 * types only merges with the same type, so the same wording can show
 * up once more under another type. A word cloud counts its words across the
 * games that kept them, never per player. Info slides never reach the history, so they never show
 * up here either, and a type this version does not know is left out. A scale
 * counts its levels the same way, never per player.
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

      if (question.type === QUESTION_TYPES.WORDCLOUD) {
        tally.words.push(...storedWords(question))
        tally.withheld ||= question.wordsWithheld === true
      }

      if (question.type === QUESTION_TYPES.RANKING) {
        const orders = question.playerAnswers.flatMap(({ answerIds }) =>
          answerIds === null ? [] : [answerIds],
        )

        rankPoints(orders, question.answers.length).forEach((value, index) => {
          const item = question.answers[index]

          tally.points.set(item, (tally.points.get(item) ?? 0) + value)
        })
      }

      if (question.type === QUESTION_TYPES.SCALE) {
        const { min } = scaleRangeOf(question.options)
        const { counts, skipped } = storedScale(question)

        counts.forEach((count, index) => {
          const value = min + index

          tally.levels.set(value, (tally.levels.get(value) ?? 0) + count)
        })
        tally.skipped += skipped
        tally.withheld ||= question.scaleWithheld === true
      }

      byQuestion.set(key, tally)
    }
  }

  return [...byQuestion.values()]
    .map(
      ({
        stats,
        scoreSum,
        words,
        withheld,
        values,
        points,
        levels,
        skipped,
      }) => ({
        ...stats,
        ...(stats.estimate && {
          estimate: { ...stats.estimate, median: medianOf(values) },
        }),
        ...(stats.type === QUESTION_TYPES.RANKING && {
          // The proposals in the order the games ranked them, as on the
          // projector.
          answers: rankOrder(
            stats.answers.map(({ label }) => points.get(label) ?? 0),
          ).map((index) => stats.answers[index]),
        }),
        ...(stats.scale &&
          scaleAggregate(stats.scale, { levels, skipped, withheld })),
        ...(stats.type === QUESTION_TYPES.WORDCLOUD && {
          // Salted as in the game: words given as often keep its order.
          answers: countWords(words, stats.question)
            .slice(0, WORDCLOUD_LIMITS.CLOUD_WORDS)
            .map(({ text, count }) => ({ label: text, count })),
          ...(words.length === 0 && withheld && { wordsWithheld: true }),
        }),
        successRate:
          stats.scored && stats.answerCount > 0
            ? stats.correctCount / stats.answerCount
            : null,
        ...(stats.averageScore !== undefined && {
          averageScore:
            stats.answerCount > 0 ? scoreSum / stats.answerCount : null,
        }),
      }),
    )
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
