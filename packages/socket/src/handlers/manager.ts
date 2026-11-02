import { EVENTS } from "@razzia/common/constants"
import type { SocketContext } from "@razzia/socket/handlers/types"
import manager, { emitConfig } from "@razzia/socket/services/manager"

export const managerSocketHandlers = ({ socket }: SocketContext) => {
  // Hashing a password is asynchronous: its failures are caught here, where
  // guardSocket would miss them.
  const reportFailure = (error: unknown) => {
    console.error("Manager sign-in failed:", error)
    socket.emit(EVENTS.MANAGER.ERROR_MESSAGE, "errors:manager.failed")
  }

  socket.on(
    EVENTS.MANAGER.GET_CONFIG,
    manager.withAuth(socket, () => {
      emitConfig(socket)
    }),
  )

  socket.on(EVENTS.MANAGER.LOGOUT, () => {
    manager.logout(socket)
  })

  socket.on(EVENTS.MANAGER.AUTH, ({ login, password }) => {
    manager.login(socket, login, password).catch(reportFailure)
  })

  socket.on(EVENTS.MANAGER.CHANGE_PASSWORD, (data) => {
    manager.changePassword(socket, data).catch(reportFailure)
  })
}
