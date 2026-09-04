import { EVENTS } from "@razzia/common/constants"
import type { SocketContext } from "@razzia/socket/handlers/types"
import {
  getQuizzStats,
  getQuizzStatsMeta,
} from "@razzia/socket/repositories/results"
import manager from "@razzia/socket/services/manager"

export const statsSocketHandlers = ({ socket }: SocketContext) => {
  socket.on(
    EVENTS.STATS.LIST,
    manager.withAuth(socket, () => {
      try {
        socket.emit(EVENTS.STATS.LIST_DATA, getQuizzStatsMeta())
      } catch (error) {
        console.error("Failed to list quizz stats:", error)
        socket.emit(EVENTS.STATS.ERROR, "errors:stats.failed")
      }
    }),
  )

  socket.on(
    EVENTS.STATS.GET,
    manager.withAuth(socket, (quizzId) => {
      try {
        socket.emit(EVENTS.STATS.DATA, getQuizzStats(quizzId))
      } catch (error) {
        console.error("Failed to get quizz stats:", error)
        socket.emit(EVENTS.STATS.ERROR, "errors:stats.notFound")
      }
    }),
  )
}
