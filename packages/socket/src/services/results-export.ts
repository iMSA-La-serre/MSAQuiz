import type { GameResult } from "@razzia/common/types/game"

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
    const answered = question.playerAnswers.filter(
      (pa) => pa.answerIds !== null && pa.answerIds.length > 0,
    ).length

    const titleRow = questions.addRow({
      question: `Q${index + 1} — ${question.question}`,
    })
    titleRow.font = { bold: true }

    question.answers.forEach((label, answerIndex) => {
      questions.addRow({
        answer: label,
        correct: question.solutions.includes(answerIndex) ? "✓" : "",
        votes: question.playerAnswers.filter((pa) =>
          pa.answerIds?.includes(answerIndex),
        ).length,
      })
    })

    questions.addRow({
      answer: "Sans réponse",
      votes: totalPlayers - answered,
    })
    questions.addRow({})
  }

  // In Node, exceljs already returns a Buffer: no extra copy needed
  // (its declared type is a browser polyfill, hence the double cast).
  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer
}

export const exportFilename = (result: GameResult): string => {
  const date = result.date.slice(0, 10)
  const subject = result.subject.replace(/[^\p{L}\p{N} _-]/gu, "").trim()

  return `${subject || "resultat"} - ${date}.xlsx`
}
