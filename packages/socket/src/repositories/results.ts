import type { GameResult, GameResultMeta } from "@razzia/common/types/game"
import { db } from "@razzia/socket/db/client"
import { resultPlayers, results } from "@razzia/socket/db/schema"
import { desc, eq } from "drizzle-orm"

export const saveResult = (data: GameResult): void => {
  try {
    db.transaction((tx) => {
      tx.insert(results)
        .values({
          id: data.id,
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

export const deleteResult = (id: string): void => {
  const { changes } = db.delete(results).where(eq(results.id, id)).run()

  if (changes === 0) {
    throw new Error(`Result "${id}" not found`)
  }
}
