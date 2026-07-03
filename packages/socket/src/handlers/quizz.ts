import { EVENTS } from "@razzia/common/constants"
import type { SocketContext } from "@razzia/socket/handlers/types"
import {
  deleteQuizz,
  getQuizzById,
  saveQuizz,
  updateQuizz,
} from "@razzia/socket/repositories/quizz"
import manager, { emitConfig } from "@razzia/socket/services/manager"
import { parseQuizzXlsx } from "@razzia/socket/services/quizz-import"

const MAX_IMPORT_BYTES = 2_000_000

export const quizzSocketHandlers = ({ socket }: SocketContext) => {
  socket.on(
    EVENTS.QUIZZ.GET,
    manager.withAuth(socket, (id) => {
      try {
        const quizz = getQuizzById(id)

        socket.emit(EVENTS.QUIZZ.DATA, quizz)
      } catch (error) {
        console.error("Failed to get quizz:", error)
        socket.emit(EVENTS.QUIZZ.ERROR, "errors:quizz.notFound")
      }
    }),
  )

  socket.on(
    EVENTS.QUIZZ.SAVE,
    manager.withAuth(socket, (data) => {
      try {
        const { id } = saveQuizz(data)

        socket.emit(EVENTS.QUIZZ.SAVE_SUCCESS, { id })
        emitConfig(socket)
      } catch (error) {
        console.error("Failed to save quizz:", error)
        const message =
          error instanceof Error ? error.message : "errors:quizz.failedToSave"
        socket.emit(EVENTS.QUIZZ.ERROR, message)
      }
    }),
  )

  socket.on(
    EVENTS.QUIZZ.IMPORT_XLSX,
    manager.withAuth(socket, (payload) => {
      const importQuizz = async () => {
        try {
          // The payload comes from the network: never trust its shape
          // (destructuring outside the try would crash the process).
          const raw = payload as { name?: unknown; buffer?: unknown } | null
          const name = typeof raw?.name === "string" ? raw.name : ""
          const buffer = raw?.buffer

          if (!name || !buffer) {
            throw new Error("errors:quizz.invalidImport")
          }

          const data = Buffer.isBuffer(buffer)
            ? buffer
            : Buffer.from(buffer as ArrayBuffer)

          if (data.byteLength === 0 || data.byteLength > MAX_IMPORT_BYTES) {
            throw new Error("errors:quizz.invalidImport")
          }

          const quizz = await parseQuizzXlsx(data, name)
          const { id } = saveQuizz(quizz)

          socket.emit(EVENTS.QUIZZ.SAVE_SUCCESS, { id })
          emitConfig(socket)
        } catch (error) {
          console.error("Failed to import quizz:", error)
          const message =
            error instanceof Error
              ? error.message
              : "errors:quizz.invalidImport"
          socket.emit(EVENTS.QUIZZ.ERROR, message)
        }
      }

      void importQuizz()
    }),
  )

  socket.on(
    EVENTS.QUIZZ.DELETE,
    manager.withAuth(socket, (id) => {
      try {
        deleteQuizz(id)

        emitConfig(socket)
      } catch (error) {
        console.error("Failed to delete quizz:", error)
        socket.emit(EVENTS.QUIZZ.ERROR, "errors:quizz.failedToDelete")
      }
    }),
  )

  socket.on(
    EVENTS.QUIZZ.UPDATE,
    manager.withAuth(socket, ({ id, ...data }) => {
      try {
        const { id: newId } = updateQuizz(id, data)

        socket.emit(EVENTS.QUIZZ.UPDATE_SUCCESS, { id: newId })
        emitConfig(socket)
      } catch (error) {
        console.error("Failed to update quizz:", error)
        const message =
          error instanceof Error ? error.message : "errors:quizz.failedToUpdate"
        socket.emit(EVENTS.QUIZZ.ERROR, message)
      }
    }),
  )
}
