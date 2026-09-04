import { QUESTION_TYPE_META } from "@razzia/common/constants"
import type { GameResult, QuestionStats } from "@razzia/common/types/game"
import { QUESTION_SCORING } from "@razzia/socket/services/scoring"

/**
 * Aggregates the questions of several games of the same quizz.
 *
 * Questions are grouped by their text rather than by their position: a quizz
 * can be edited or reordered between two games, and merging "the same
 * question" is what makes the numbers readable. Info slides never reach the
 * history, so they never show up here either.
 *
 * `successRate` counts correct answers over answers actually given: players
 * who let the timer run out are reported separately in `missingCount`, so a
 * hard question and an unread one do not look alike.
 */
export const aggregateQuestions = (games: GameResult[]): QuestionStats[] => {
  const byQuestion = new Map<string, QuestionStats>()

  for (const game of games) {
    for (const question of game.questions) {
      const label = question.question.trim()
      const { scored } = QUESTION_TYPE_META[question.type]

      // A solution nobody picked still belongs in the distribution: seeing
      // the expected answer next to the chosen ones is the whole point.
      const solutionLabels = question.solutions
        // A solution can point outside the answers of an older game: .at()
        // says so in the types, indexing does not.
        .map((index) => question.answers.at(index))
        .filter((answer): answer is string => answer !== undefined)

      const stats = byQuestion.get(label) ?? {
        question: label,
        type: question.type,
        scored,
        gameCount: 0,
        answerCount: 0,
        missingCount: 0,
        correctCount: 0,
        successRate: null,
        answers: solutionLabels.map((solution) => ({
          label: solution,
          count: 0,
        })),
        // Games come most recent first, so the first one seen carries the
        // wording to show.
        solutionLabels,
      }

      stats.gameCount += 1

      for (const record of question.playerAnswers) {
        if (record.answerIds === null || record.answerIds.length === 0) {
          stats.missingCount += 1

          continue
        }

        stats.answerCount += 1

        if (
          scored &&
          QUESTION_SCORING[question.type](question, record.answerIds) > 0
        ) {
          stats.correctCount += 1
        }

        for (const answerId of record.answerIds) {
          const answer = question.answers.at(answerId)

          if (answer === undefined) {
            continue
          }

          const known = stats.answers.find((a) => a.label === answer)

          if (known) {
            known.count += 1
          } else {
            stats.answers.push({ label: answer, count: 1 })
          }
        }
      }

      byQuestion.set(label, stats)
    }
  }

  return [...byQuestion.values()]
    .map((stats) => ({
      ...stats,
      successRate:
        stats.scored && stats.answerCount > 0
          ? stats.correctCount / stats.answerCount
          : null,
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
