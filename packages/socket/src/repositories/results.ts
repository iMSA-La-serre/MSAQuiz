import type {
  GameResult,
  GameResultMeta,
  QuizzStats,
  QuizzStatsMeta,
} from "@razzia/common/types/game"
import { db } from "@razzia/socket/db/client"
import { resultPlayers, results } from "@razzia/socket/db/schema"
import {
  aggregateQuestions,
  overallSuccessRate,
} from "@razzia/socket/services/stats"
import { desc, eq, isNotNull } from "drizzle-orm"

export const saveResult = (data: GameResult): void => {
  try {
    db.transaction((tx) => {
      tx.insert(results)
        .values({
          id: data.id,
          quizzId: data.quizzId ?? null,
          subject: data.subject,
          date: data.date,
          playerCount: data.players.length,
          data,
        })
        .run()

      if (data.players.length > 0) {
        // Two players may share a username (only clientId is unique):
        // never let a PK conflict void the whole result.
        tx.insert(resultPlayers)
          .values(
            data.players.map((player) => ({
              resultId: data.id,
              username: player.username,
              points: player.points,
              rank: player.rank,
            })),
          )
          .onConflictDoNothing()
          .run()
      }
    })

    console.log(`Saved result for "${data.subject}"`)
  } catch (error) {
    console.error("Failed to save result:", error)
  }
}

export const getResultsMeta = (): GameResultMeta[] =>
  db
    .select({
      id: results.id,
      subject: results.subject,
      date: results.date,
      playerCount: results.playerCount,
    })
    .from(results)
    .orderBy(desc(results.date))
    .all()

export const getResultById = (id: string): GameResult => {
  const row = db.select().from(results).where(eq(results.id, id)).get()

  if (!row) {
    throw new Error(`Result "${id}" not found`)
  }

  return row.data
}

/** Games grouped by quizz, most recently played first. */
const gamesByQuizz = (): Map<string, GameResult[]> => {
  const rows = db
    .select({
      quizzId: results.quizzId,
      data: results.data,
    })
    .from(results)
    .where(isNotNull(results.quizzId))
    .orderBy(desc(results.date))
    .all()

  const games = new Map<string, GameResult[]>()

  for (const row of rows) {
    if (row.quizzId === null) {
      continue
    }

    const played = games.get(row.quizzId) ?? []

    played.push(row.data)
    games.set(row.quizzId, played)
  }

  return games
}

export const getQuizzStatsMeta = (): QuizzStatsMeta[] =>
  [...gamesByQuizz().entries()].map(([quizzId, games]) => ({
    quizzId,
    // The quizz may have been renamed between two games: show the latest name.
    subject: games[0].subject,
    gameCount: games.length,
    playerCount: games.reduce((sum, game) => sum + game.players.length, 0),
    successRate: overallSuccessRate(aggregateQuestions(games)),
  }))

export const getQuizzStats = (quizzId: string): QuizzStats => {
  const games = gamesByQuizz().get(quizzId)

  if (!games || games.length === 0) {
    throw new Error(`No result for quizz "${quizzId}"`)
  }

  return {
    quizzId,
    subject: games[0].subject,
    gameCount: games.length,
    playerCount: games.reduce((sum, game) => sum + game.players.length, 0),
    questions: aggregateQuestions(games),
  }
}

export const deleteResult = (id: string): void => {
  const { changes } = db.delete(results).where(eq(results.id, id)).run()

  if (changes === 0) {
    throw new Error(`Result "${id}" not found`)
  }
}
