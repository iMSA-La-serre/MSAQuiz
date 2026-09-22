import { QUESTION_TYPE_META, QUESTION_TYPES } from "@razzia/common/constants"
import type {
  GameResult,
  PlayerAnswerRecord,
  QuestionResult,
} from "@razzia/common/types/game"
import {
  isAssociationType,
  matchedItems,
  rightTargetOf,
  targetsOf,
} from "@razzia/common/utils/association"
import {
  estimateRanges,
  formatEstimate,
  formatTolerance,
  medianOf,
  nameRange,
  type RangeName,
  toleranceOf,
  unitOf,
} from "@razzia/common/utils/estimate"
import { rankOrder, rankPoints } from "@razzia/common/utils/ranking"
import {
  scaleEndLabel,
  scaleRangeOf,
  scaleSummary,
  scaleValues,
} from "@razzia/common/utils/scale"
import { isKnownType } from "@razzia/socket/services/scoring"
import {
  hasAnswer,
  isCorrectRecord,
  recordScore,
  storedScale,
  storedWords,
} from "@razzia/socket/services/stats"
import type Excel from "exceljs"

type AnsweredRecord = PlayerAnswerRecord & { answerIds: number[] }

interface QuestionRows {
  sheet: Excel.Worksheet
  question: QuestionResult
  answered: AnsweredRecord[]
}

// Choice types: one row per answer, the correct ones ticked.
const addChoiceRows = ({ sheet, question, answered }: QuestionRows) => {
  question.answers.forEach((label, answerIndex) => {
    sheet.addRow({
      answer: label,
      correct: question.solutions.includes(answerIndex) ? "✓" : "",
      votes: answered.filter((record) => record.answerIds.includes(answerIndex))
        .length,
    })
  })
}

// The mean multiplier of the answers given, as a percentage.
const addMeanScoreRow = ({ sheet, question, answered }: QuestionRows) => {
  const scoreSum = answered.reduce(
    (sum, record) => sum + recordScore(question, record),
    0,
  )
  const meanRow = sheet.addRow({
    answer: "Score moyen",
    votes: answered.length > 0 ? scoreSum / answered.length : null,
  })

  meanRow.getCell("votes").numFmt = "0%"
}

// Highlight: the text, its passages between brackets, then one row per
// passage as a choice, the ones to spot ticked, then the answers with every
// passage to spot and no other, and the mean score.
const addHighlightRows = (rows: QuestionRows) => {
  const { sheet, question, answered } = rows

  sheet.addRow({ answer: `Texte : ${question.text ?? ""}` }).font = {
    italic: true,
  }

  addChoiceRows(rows)

  sheet.addRow({
    answer: "Réponses sans faute",
    votes: answered.filter((record) => isCorrectRecord(question, record))
      .length,
  })

  addMeanScoreRow(rows)
}

// Statements and categorize: the categories, then one row per item with its
// right target and the players who matched it, then the answers with every
// item matched, and the mean score.
const addAssociationRows = (rows: QuestionRows) => {
  const { sheet, question, answered } = rows
  const targets = targetsOf(question)
  const expected = question.expectedTargets ?? []

  if (question.type === QUESTION_TYPES.CATEGORIZE) {
    sheet.addRow({ answer: `Catégories : ${targets.join(", ")}` }).font = {
      italic: true,
    }
  }

  sheet.addRow({
    answer:
      question.type === QUESTION_TYPES.STATEMENTS ? "Affirmations" : "Éléments",
    correct: "Réponse",
    votes: "Justes",
  }).font = { italic: true }

  question.answers.forEach((label, itemIndex) => {
    sheet.addRow({
      answer: label,
      correct: rightTargetOf(question, itemIndex) ?? "",
      votes: answered.filter(
        (record) => matchedItems(record.answerIds, expected)[itemIndex],
      ).length,
    })
  })

  sheet.addRow({
    answer: "Réponses sans faute",
    votes: answered.filter((record) => isCorrectRecord(question, record))
      .length,
  })

  addMeanScoreRow(rows)
}

// Ordering: the items in the correct order, with the players who put each
// one at its place, then the exact orders and the mean score.
const addOrderingRows = (rows: QuestionRows) => {
  const { sheet, question, answered } = rows

  sheet.addRow({
    answer: "Éléments dans l'ordre correct",
    votes: "Bien placés",
  }).font = { italic: true }

  question.answers.forEach((label, itemIndex) => {
    sheet.addRow({
      answer: `${itemIndex + 1}. ${label}`,
      votes: answered.filter(
        (record) => record.answerIds[itemIndex] === itemIndex,
      ).length,
    })
  })

  sheet.addRow({
    answer: "Ordres exacts",
    votes: answered.filter((record) => isCorrectRecord(question, record))
      .length,
  })

  addMeanScoreRow(rows)
}

// Ranking: the proposals in the order the room put them, with the rank points
// they scored and the players who put each one first.
const addRankingRows = ({ sheet, question, answered }: QuestionRows) => {
  const orders = answered.map(({ answerIds }) => answerIds)
  const points = rankPoints(orders, question.answers.length)

  sheet.addRow({
    answer: "Propositions par priorité",
    correct: "Points",
    votes: "1ers choix",
  }).font = { italic: true }

  for (const [rank, item] of rankOrder(points).entries()) {
    sheet.addRow({
      answer: `${rank + 1}. ${question.answers[item]}`,
      correct: points[item],
      votes: orders.filter((order) => order.at(0) === item).length,
    })
  }
}

// Scale: the players of each level, then those who preferred not to answer,
// then the mean and the median. No level is linked to a player; too few
// answers and the counts were not kept.
const addScaleRows = ({ sheet, question, answered }: QuestionRows) => {
  const range = scaleRangeOf(question.options)
  const { counts, skipped } = storedScale(question)
  const low = scaleEndLabel(question.options, "low")
  const high = scaleEndLabel(question.options, "high")
  const { mean, median } = scaleSummary(counts, range.min)

  sheet.addRow({ answer: "Niveaux", votes: "Réponses" }).font = {
    italic: true,
  }

  // Withheld, the levels and « Sans avis » are left out rather than printed
  // at zero, which would read as nobody having picked or skipped.
  if (question.scaleWithheld === true) {
    sheet.addRow({
      answer: "Trop peu de réponses pour afficher la répartition",
    })
  } else {
    for (const [index, value] of scaleValues(range).entries()) {
      const end = (index === 0 && low) || (value === range.max && high) || ""

      sheet.addRow({
        answer: end === "" ? String(value) : `${value} — ${end}`,
        votes: counts[index] ?? 0,
      })
    }

    sheet.addRow({ answer: "Sans avis", votes: skipped })
    sheet.addRow({ answer: "Moyenne", votes: mean })
    sheet.addRow({ answer: "Médiane", votes: median })
  }

  sheet.addRow({ answer: "Ont répondu", votes: answered.length })
}

// Shortanswer: the accepted answers with the inputs each one recognized,
// then how many inputs matched none (their text stays out of the report).
const addShortAnswerRows = ({ sheet, question, answered }: QuestionRows) => {
  for (const [acceptedIndex, label] of (question.accepted ?? []).entries()) {
    sheet.addRow({
      answer: label,
      correct: "✓",
      votes: answered.filter((record) =>
        record.answerIds.includes(acceptedIndex),
      ).length,
    })
  }

  sheet.addRow({
    answer: "Non reconnues",
    votes: answered.filter((record) => record.answerIds.length === 0).length,
  })
}

// Estimate: a range as the manager's screen names it.
const rangeText = (name: RangeName, question: QuestionResult): string => {
  const format = (value: number) => formatEstimate(value, question.options)

  switch (name.kind) {
    case "under": {
      return `Moins de ${format(name.value)}`
    }

    case "over": {
      return `Plus de ${format(name.value)}`
    }

    case "exactly": {
      return format(name.value)
    }

    default: {
      return `${formatEstimate(name.from, question.options, { withUnit: false })} à ${format(name.to)}`
    }
  }
}

// Estimate: the right value and its tolerance, then the values given by
// range around it, as on the manager's screen, then their median. Each
// player's value is in the result window.
const addEstimateRows = ({ sheet, question, answered }: QuestionRows) => {
  const { expected, options } = question
  const values = answered.flatMap(({ value }) =>
    typeof value === "number" ? [value] : [],
  )
  const ranges = estimateRanges(question, values)
  const tolerance =
    toleranceOf(options) > 0 ? `, à ${formatTolerance(options)} près` : ""

  sheet.addRow({
    answer:
      expected === undefined
        ? "Bonne réponse inconnue"
        : `Bonne réponse : ${formatEstimate(expected, options)}${tolerance}`,
  }).font = { italic: true }

  for (const [index, range] of ranges.entries()) {
    sheet.addRow({
      answer: rangeText(nameRange(ranges, index), question),
      ...(range.correct && { correct: "✓" }),
      votes: range.count,
    })
  }

  const unit = unitOf(options)
  const median = medianOf(values)

  sheet.addRow({
    answer: unit === "" ? "Médiane" : `Médiane (${unit})`,
    votes: median,
  })
}

// Wordcloud: the words and how many players typed each, never who did, then
// how many players answered (each gives 1 to 3 words, or none once moderated).
// Words typed by too few players were not kept: the report says so.
const addWordCloudRows = ({ sheet, question, answered }: QuestionRows) => {
  const words = storedWords(question)

  sheet.addRow({ answer: "Mots proposés", votes: "Nombre" }).font = {
    italic: true,
  }

  if (question.wordsWithheld === true) {
    sheet.addRow({ answer: "Trop peu de réponses pour afficher les mots" })
  } else if (words.length === 0) {
    sheet.addRow({ answer: "Aucun mot" })
  }

  for (const { text, count } of words) {
    sheet.addRow({ answer: text, votes: count })
  }

  sheet.addRow({ answer: "Ont répondu", votes: answered.length })
}

// The questions whose answers are not linked to a username (word clouds,
// scales): one column each, saying whether the player answered, and nothing
// more.
const addParticipationSheet = (
  workbook: Excel.Workbook,
  result: GameResult,
) => {
  const unlinked = [...result.questions.entries()].filter(
    ([, question]) =>
      isKnownType(question.type) &&
      !QUESTION_TYPE_META[question.type].nominative,
  )

  if (unlinked.length === 0) {
    return
  }

  const sheet = workbook.addWorksheet("Participation")

  sheet.columns = [
    { header: "Joueur", key: "username", width: 30 },
    ...unlinked.map(([index]) => ({
      header: `Q${index + 1}`,
      key: `q${index}`,
      width: 8,
    })),
  ]
  sheet.getRow(1).font = { bold: true }

  // Records are matched by username, and two players may share one: each
  // record is taken once, so the « Oui » add up to the players who answered.
  const pools = unlinked.map(([, question]) => [...question.playerAnswers])

  for (const player of result.players) {
    sheet.addRow({
      username: player.username,
      ...Object.fromEntries(
        unlinked.map(([index], column) => {
          const pool = pools[column]
          const at = pool.findIndex(
            ({ playerName }) => playerName === player.username,
          )
          const record = at === -1 ? undefined : pool.splice(at, 1)[0]

          return [`q${index}`, record && hasAnswer(record) ? "Oui" : "Non"]
        }),
      ),
    })
  }
}

/** Builds an Excel report (ranking + per-question details) for a game result. */
export const buildResultWorkbook = async (
  result: GameResult,
): Promise<Buffer> => {
  // Lazy-loaded: keeps exceljs out of the server boot path.
  const { default: ExcelJS } = await import("exceljs")
  const workbook = new ExcelJS.Workbook()

  const ranking = workbook.addWorksheet("Classement")

  ranking.columns = [
    { header: "Rang", key: "rank", width: 8 },
    { header: "Joueur", key: "username", width: 30 },
    { header: "Points", key: "points", width: 12 },
  ]
  ranking.getRow(1).font = { bold: true }

  for (const player of result.players) {
    ranking.addRow({
      rank: player.rank,
      username: player.username,
      points: player.points,
    })
  }

  const questions = workbook.addWorksheet("Questions")

  questions.columns = [
    { header: "Question", key: "question", width: 50 },
    { header: "Réponse", key: "answer", width: 40 },
    { header: "Correcte", key: "correct", width: 10 },
    { header: "Votes", key: "votes", width: 8 },
  ]
  questions.getRow(1).font = { bold: true }

  const totalPlayers = result.players.length

  for (const [index, question] of result.questions.entries()) {
    // A type this version does not know is left out, numbering unchanged.
    if (!isKnownType(question.type)) {
      continue
    }

    const answered = question.playerAnswers.filter(hasAnswer)

    const titleRow = questions.addRow({
      question: `Q${index + 1} — ${question.question}`,
    })
    titleRow.font = { bold: true }

    const rows = { sheet: questions, question, answered }

    if (question.type === QUESTION_TYPES.ORDERING) {
      addOrderingRows(rows)
    } else if (question.type === QUESTION_TYPES.SHORTANSWER) {
      addShortAnswerRows(rows)
    } else if (question.type === QUESTION_TYPES.WORDCLOUD) {
      addWordCloudRows(rows)
    } else if (question.type === QUESTION_TYPES.RANKING) {
      addRankingRows(rows)
    } else if (question.type === QUESTION_TYPES.SCALE) {
      addScaleRows(rows)
    } else if (question.type === QUESTION_TYPES.ESTIMATE) {
      addEstimateRows(rows)
    } else if (question.type === QUESTION_TYPES.HIGHLIGHT) {
      addHighlightRows(rows)
    } else if (isAssociationType(question.type)) {
      addAssociationRows(rows)
    } else {
      addChoiceRows(rows)
    }

    questions.addRow({
      answer: "Sans réponse",
      votes: totalPlayers - answered.length,
    })
    questions.addRow({})
  }

  addParticipationSheet(workbook, result)

  // In Node, exceljs already returns a Buffer: no extra copy needed
  // (its declared type is a browser polyfill, hence the double cast).
  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer
}

export const exportFilename = (result: GameResult): string => {
  const date = result.date.slice(0, 10)
  const subject = result.subject.replace(/[^\p{L}\p{N} _-]/gu, "").trim()

  return `${subject || "resultat"} - ${date}.xlsx`
}
