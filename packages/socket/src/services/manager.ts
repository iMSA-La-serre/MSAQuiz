import { EVENTS } from "@razzia/common/constants"
import type { Socket } from "@razzia/common/types/game/socket"
import type { ManagerUser } from "@razzia/common/types/manager"
import {
  normalizeLogin,
  passwordValidator,
} from "@razzia/common/validators/auth"
import { ADMIN_USER_ID } from "@razzia/socket/db/seed"
import { getQuizzMeta } from "@razzia/socket/repositories/quizz"
import { getResultsMeta } from "@razzia/socket/repositories/results"
import {
  createSession,
  deleteSession,
  deleteUserSessions,
  findSessionUser,
  findUserById,
  findUserByLogin,
  setPassword,
  toManagerUser,
  type UserRow,
} from "@razzia/socket/repositories/users"
import { getGameConfig } from "@razzia/socket/services/config"
import LoginThrottle from "@razzia/socket/services/login-throttle"
import { hashPassword, verifyPassword } from "@razzia/socket/services/password"
import { randomUUID } from "node:crypto"

interface ChangePassword {
  currentPassword?: string
  newPassword: string
}

// What initConfig writes in a new game.json: no password chosen yet.
const UNSET_MANAGER_PASSWORD = "PASSWORD"

// Checked when the identifier matches no account, so that a refusal takes as
// long either way and tells nothing about which accounts exist.
let decoyHash: Promise<string> | null = null

const getDecoyHash = () => {
  decoyHash ??= hashPassword(randomUUID())

  return decoyHash
}

const readManagerPassword = (): string | null => {
  try {
    const { managerPassword } = getGameConfig() as { managerPassword?: unknown }

    return typeof managerPassword === "string" &&
      managerPassword !== "" &&
      managerPassword !== UNSET_MANAGER_PASSWORD
      ? managerPassword
      : null
  } catch {
    return null
  }
}

/**
 * Until the admin account has a password, it takes managerPassword from
 * game.json, as a temporary one: that is how an instance moves from the
 * shared password to accounts, and how access is recovered (see
 * docs/configuration.md). False when there is none to take.
 */
const ensureAdminPassword = async (): Promise<boolean> => {
  if (findUserById(ADMIN_USER_ID)?.passwordHash) {
    return true
  }

  const managerPassword = readManagerPassword()

  if (!managerPassword) {
    return false
  }

  const hash = await hashPassword(managerPassword)

  // Another sign-in may have set it while this one was hashing.
  if (findUserById(ADMIN_USER_ID)?.passwordHash) {
    return true
  }

  return setPassword(ADMIN_USER_ID, hash, true)
}

const sendConfig = (socket: Socket, user: ManagerUser) => {
  socket.emit(EVENTS.MANAGER.CONFIG, {
    quizz: getQuizzMeta(),
    results: getResultsMeta(),
    user,
  })
}

class Manager {
  private throttle = new LoginThrottle()

  // The session each socket opened by signing in, or null once it signed
  // out. It takes over the one its handshake carried, which the browser keeps
  // between visits.
  private sessions = new WeakMap<Socket, string | null>()

  private tokenOf(socket: Socket): string | null {
    if (this.sessions.has(socket)) {
      return this.sessions.get(socket) ?? null
    }

    const token: unknown = socket.handshake.auth.sessionToken

    return typeof token === "string" && token !== "" ? token : null
  }

  // Read again on every call: a session closed elsewhere (signed out, password
  // reset, account disabled) stops at once.
  private accountOf(socket: Socket): UserRow | null {
    const token = this.tokenOf(socket)

    return token ? findSessionUser(token) : null
  }

  getUser(socket: Socket): ManagerUser | null {
    const account = this.accountOf(socket)

    return account ? toManagerUser(account) : null
  }

  async login(socket: Socket, login: string, password: string) {
    const key = normalizeLogin(login)

    if (this.throttle.isLocked(key)) {
      socket.emit(
        EVENTS.MANAGER.ERROR_MESSAGE,
        "errors:manager.tooManyAttempts",
      )

      return
    }

    if (key === ADMIN_USER_ID && !(await ensureAdminPassword())) {
      socket.emit(
        EVENTS.MANAGER.ERROR_MESSAGE,
        "errors:manager.passwordNotConfigured",
      )

      return
    }

    const account = findUserByLogin(key)
    const valid = await verifyPassword(
      password,
      account?.passwordHash ?? (await getDecoyHash()),
    )

    if (!account?.passwordHash || account.disabled || !valid) {
      this.throttle.fail(key)
      socket.emit(
        EVENTS.MANAGER.ERROR_MESSAGE,
        "errors:manager.invalidCredentials",
      )

      return
    }

    this.throttle.succeed(key)

    // Signing in again on the same browser, as the same account or not,
    // closes the session it had.
    const previous = this.tokenOf(socket)

    if (previous) {
      deleteSession(previous)
    }

    const token = createSession(account.id)
    const user = toManagerUser(account)

    this.sessions.set(socket, token)
    socket.emit(EVENTS.MANAGER.SESSION, { token, user })

    if (!user.mustChangePassword) {
      sendConfig(socket, user)
    }
  }

  logout(socket: Socket) {
    const token = this.tokenOf(socket)

    if (token) {
      deleteSession(token)
    }

    this.sessions.set(socket, null)
  }

  // The current password is asked, unless the account's is a temporary one,
  // typed just before to sign in.
  async changePassword(
    socket: Socket,
    { currentPassword, newPassword }: ChangePassword,
  ) {
    const account = this.accountOf(socket)

    if (!account?.passwordHash) {
      socket.emit(EVENTS.MANAGER.UNAUTHORIZED)

      return
    }

    const policy = passwordValidator.safeParse(newPassword)

    if (!policy.success) {
      socket.emit(EVENTS.MANAGER.ERROR_MESSAGE, policy.error.issues[0].message)

      return
    }

    if (!account.mustChangePassword) {
      const key = normalizeLogin(account.email)

      if (this.throttle.isLocked(key)) {
        socket.emit(
          EVENTS.MANAGER.ERROR_MESSAGE,
          "errors:manager.tooManyAttempts",
        )

        return
      }

      if (
        !(await verifyPassword(currentPassword ?? "", account.passwordHash))
      ) {
        this.throttle.fail(key)
        socket.emit(
          EVENTS.MANAGER.ERROR_MESSAGE,
          "errors:manager.wrongCurrentPassword",
        )

        return
      }

      this.throttle.succeed(key)
    }

    if (await verifyPassword(newPassword, account.passwordHash)) {
      socket.emit(
        EVENTS.MANAGER.ERROR_MESSAGE,
        "errors:manager.passwordUnchanged",
      )

      return
    }

    const hash = await hashPassword(newPassword)

    // Closed while hashing (account disabled, password reset): the change
    // would undo what the administrator just did.
    if (!this.accountOf(socket)) {
      socket.emit(EVENTS.MANAGER.UNAUTHORIZED)

      return
    }

    setPassword(account.id, hash, false)
    // The account's other browsers sign in again, with the new password.
    deleteUserSessions(account.id, this.tokenOf(socket))
    socket.emit(EVENTS.MANAGER.PASSWORD_CHANGED)
    sendConfig(socket, { ...toManagerUser(account), mustChangePassword: false })
  }

  // The signed-in account, or null after telling the client why there is
  // none.
  private authorize(socket: Socket): ManagerUser | null {
    const user = this.getUser(socket)

    if (!user) {
      socket.emit(EVENTS.MANAGER.UNAUTHORIZED)

      return null
    }

    if (user.mustChangePassword) {
      socket.emit(EVENTS.MANAGER.PASSWORD_CHANGE_REQUIRED)

      return null
    }

    return user
  }

  withAuth<T extends unknown[]>(
    socket: Socket,
    handler: (..._args: T) => void,
  ) {
    return (..._args: T) => {
      if (this.authorize(socket)) {
        handler(..._args)
      }
    }
  }

  // Administrators only: the handler gets the administrator's account first.
  withAdmin<T extends unknown[]>(
    socket: Socket,
    handler: (_admin: ManagerUser, ..._args: T) => void,
  ) {
    return (..._args: T) => {
      const user = this.authorize(socket)

      if (!user) {
        return
      }

      if (user.role !== "admin") {
        socket.emit(EVENTS.USERS.ERROR, "errors:users.forbidden")

        return
      }

      handler(user, ..._args)
    }
  }
}

const manager = new Manager()

export const emitConfig = (socket: Socket) => {
  const user = manager.getUser(socket)

  if (!user) {
    socket.emit(EVENTS.MANAGER.UNAUTHORIZED)

    return
  }

  sendConfig(socket, user)
}

export default manager
