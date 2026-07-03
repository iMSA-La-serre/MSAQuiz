import { EVENTS } from "@razzia/common/constants"
import type { SocketContext } from "@razzia/socket/handlers/types"
import {
  deleteResult,
  getResultById,
} from "@razzia/socket/repositories/results"
import manager, { emitConfig } from "@razzia/socket/services/manager"
import {
  buildResultWorkbook,
  exportFilename,
} from "@razzia/socket/services/results-export"

export const resultsSocketHandlers = ({ socket }: SocketContext) => {
  socket.on(
    EVENTS.RESULTS.GET,
    manager.withAuth(socket, (id) => {
      try {
        socket.emit(EVENTS.RESULTS.DATA, getResultById(id))
      } catch (error) {
        console.error("Failed to get result:", error)
      }
    }),
  )

  socket.on(
    EVENTS.RESULTS.EXPORT,
    manager.withAuth(socket, (id) => {
      const exportResult = async () => {
        try {
          const result = getResultById(id)
          const buffer = await buildResultWorkbook(result)

          // The Node Buffer is serialized as binary by socket.io; the
          // browser receives an ArrayBuffer (matching the shared type).
          socket.emit(EVENTS.RESULTS.EXPORT_DATA, {
            filename: exportFilename(result),
            buffer: buffer as unknown as ArrayBuffer,
          })
        } catch (error) {
          console.error("Failed to export result:", error)
        }
      }

      void exportResult()
    }),
  )

  socket.on(
    EVENTS.RESULTS.DELETE,
    manager.withAuth(socket, (id) => {
      try {
        deleteResult(id)
        emitConfig(socket)
      } catch (error) {
        console.error("Failed to delete result:", error)
      }
    }),
  )
}
