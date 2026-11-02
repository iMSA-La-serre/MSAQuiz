import { EVENTS } from "@razzia/common/constants"
import {
  newUserValidator,
  userRoleValidator,
} from "@razzia/common/validators/auth"
import type { SocketContext } from "@razzia/socket/handlers/types"
import {
  createUser,
  deleteUserSessions,
  listUsers,
  setPassword,
  updateUser,
} from "@razzia/socket/repositories/users"
import manager from "@razzia/socket/services/manager"
import {
  createTemporaryPassword,
  hashPassword,
} from "@razzia/socket/services/password"

// Only error keys reach the client, never what the database said.
const errorKeyOf = (error: unknown) =>
  error instanceof Error && error.message.startsWith("errors:")
    ? error.message
    : "errors:users.failed"

export const usersSocketHandlers = ({ socket }: SocketContext) => {
  const sendList = () => {
    socket.emit(EVENTS.USERS.DATA, listUsers())
  }

  // Runs an action, sync or not, and reports its failure: guardSocket only
  // catches what a handler throws synchronously.
  const run = (action: () => Promise<void> | void) => {
    Promise.resolve()
      .then(action)
      .catch((error: unknown) => {
        console.error("Account action failed:", error)
        socket.emit(EVENTS.USERS.ERROR, errorKeyOf(error))
      })
  }

  socket.on(
    EVENTS.USERS.LIST,
    manager.withAdmin(socket, () => {
      sendList()
    }),
  )

  // The account gets a temporary password, shown once to the administrator,
  // who passes it on.
  socket.on(
    EVENTS.USERS.CREATE,
    manager.withAdmin(socket, (_admin, data) => {
      run(async () => {
        const parsed = newUserValidator.safeParse(data)

        if (!parsed.success) {
          throw new Error(parsed.error.issues[0].message)
        }

        const password = createTemporaryPassword()
        const { id } = createUser(parsed.data, await hashPassword(password))

        socket.emit(EVENTS.USERS.TEMPORARY_PASSWORD, { id, password })
        sendList()
      })
    }),
  )

  // A new temporary password, and the account's open sessions closed.
  socket.on(
    EVENTS.USERS.RESET_PASSWORD,
    manager.withAdmin(socket, (admin, id) => {
      run(async () => {
        // Their own goes through "change my password", which asks for the
        // current one.
        if (id === admin.id) {
          throw new Error("errors:users.cannotChangeSelf")
        }

        const password = createTemporaryPassword()

        if (!setPassword(id, await hashPassword(password), true)) {
          throw new Error("errors:users.notFound")
        }

        deleteUserSessions(id)
        socket.emit(EVENTS.USERS.TEMPORARY_PASSWORD, { id, password })
        sendList()
      })
    }),
  )

  socket.on(
    EVENTS.USERS.UPDATE,
    manager.withAdmin(socket, (admin, { id, role, disabled }) => {
      run(() => {
        // Administrators never take away their own rights: one at least is
        // always left.
        if (id === admin.id) {
          throw new Error("errors:users.cannotChangeSelf")
        }

        const changes = {
          role: role === undefined ? undefined : userRoleValidator.parse(role),
          disabled,
        }

        if (!updateUser(id, changes)) {
          throw new Error("errors:users.notFound")
        }

        if (disabled) {
          deleteUserSessions(id)
        }

        sendList()
      })
    }),
  )
}
