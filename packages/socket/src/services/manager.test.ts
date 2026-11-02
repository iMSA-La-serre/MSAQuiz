import { AUTH_LIMITS, EVENTS } from "@razzia/common/constants"
import type { Socket } from "@razzia/common/types/game/socket"
import type { ManagerUser, UserAccount } from "@razzia/common/types/manager"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, describe, expect, it, vi } from "vitest"

// A real database, in a folder of its own: sessions, hashes and the admin
// account's first password are checked end to end, as the server runs them.
const dir = mkdtempSync(join(tmpdir(), "msaquiz-accounts-"))
const SHARED_PASSWORD = "ancien mot de passe partagé"

vi.stubEnv("CONFIG_PATH", dir)
writeFileSync(
  join(dir, "game.json"),
  JSON.stringify({ managerPassword: SHARED_PASSWORD }),
)

const { db } = await import("@razzia/socket/db/client")
const { sessions, users } = await import("@razzia/socket/db/schema")
const { migrate } = await import("drizzle-orm/better-sqlite3/migrator")
const { seedDatabase } = await import("@razzia/socket/db/seed")
const { default: manager } = await import("@razzia/socket/services/manager")
const { usersSocketHandlers } = await import("@razzia/socket/handlers/users")

migrate(db, {
  migrationsFolder: fileURLToPath(new URL("../db/migrations", import.meta.url)),
})
seedDatabase()

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
  vi.unstubAllEnvs()
})

interface Session {
  token: string
  user: ManagerUser
}

// Just enough of a socket.io socket: what the server sends it is recorded,
// and the account handlers are registered on it.
const connect = (sessionToken?: string) => {
  const emitted: Array<{ event: string; data: unknown }> = []
  const handlers = new Map<string, (..._args: unknown[]) => void>()
  const socket = {
    handshake: { auth: { clientId: "client", sessionToken } },
    emit: (event: string, data?: unknown) => {
      emitted.push({ event, data })
    },
    on: (event: string, handler: (..._args: unknown[]) => void) => {
      handlers.set(event, handler)
    },
  } as unknown as Socket

  usersSocketHandlers({ socket, io: {} as never })

  return {
    socket,
    events: () => emitted.map(({ event }) => event),
    last: (event: string) => emitted.findLast((e) => e.event === event)?.data,
    // Clears what was recorded before, so the next answer stands alone.
    send: (event: string, data?: unknown) => {
      emitted.length = 0
      handlers.get(event)?.(data)
    },
  }
}

type Client = ReturnType<typeof connect>

const sessionOf = (client: Client) =>
  client.last(EVENTS.MANAGER.SESSION) as Session | undefined

const errorOf = (client: Client) => client.last(EVENTS.MANAGER.ERROR_MESSAGE)

const signIn = async (login: string, password: string) => {
  const client = connect()

  await manager.login(client.socket, login, password)

  return client
}

// Waits for the answer of an account action, which hashes a password first.
const answer = async (client: Client, event: string) => {
  await vi.waitFor(() => expect(client.last(event)).toBeDefined(), {
    timeout: 3000,
  })

  return client.last(event)
}

let adminPassword = "le nouveau mot de passe de l'admin"
const camille = { password: "la phrase de passe de Camille", id: "" }

describe("manager accounts", () => {
  it("opens the admin account with managerPassword, as a temporary one", async () => {
    const client = await signIn(" Admin ", SHARED_PASSWORD)

    expect(client.events()).toEqual([EVENTS.MANAGER.SESSION])
    expect(sessionOf(client)?.user).toMatchObject({
      id: "admin",
      role: "admin",
      mustChangePassword: true,
    })

    const handler = vi.fn()

    manager.withAuth(client.socket, handler)()
    expect(handler).not.toHaveBeenCalled()
    expect(client.events()).toContain(EVENTS.MANAGER.PASSWORD_CHANGE_REQUIRED)

    await manager.changePassword(client.socket, { newPassword: adminPassword })
    expect(client.events()).toContain(EVENTS.MANAGER.PASSWORD_CHANGED)
    expect(client.last(EVENTS.MANAGER.CONFIG)).toMatchObject({
      user: { id: "admin", mustChangePassword: false },
    })

    expect(errorOf(await signIn("admin", SHARED_PASSWORD))).toBe(
      "errors:manager.invalidCredentials",
    )
    expect((await signIn("admin", adminPassword)).events()).toEqual([
      EVENTS.MANAGER.SESSION,
      EVENTS.MANAGER.CONFIG,
    ])
  })

  it("tells nothing of which identifiers exist", async () => {
    expect(errorOf(await signIn("personne@msa.fr", adminPassword))).toBe(
      "errors:manager.invalidCredentials",
    )
    expect(errorOf(await signIn("admin", "pas le bon"))).toBe(
      "errors:manager.invalidCredentials",
    )
  })

  it("keeps a session across reconnections, until it is signed out", async () => {
    const first = await signIn("admin", adminPassword)
    const reconnected = connect(sessionOf(first)?.token)

    expect(manager.getUser(reconnected.socket)?.id).toBe("admin")
    expect(manager.getUser(connect("forged-token").socket)).toBeNull()

    manager.logout(first.socket)

    expect(manager.getUser(first.socket)).toBeNull()
    expect(manager.getUser(reconnected.socket)).toBeNull()
  })

  it("stores neither a password nor a session token in clear", async () => {
    const client = await signIn("admin", adminPassword)
    const token = sessionOf(client)?.token ?? ""
    const stored = JSON.stringify([
      db.select().from(users).all(),
      db.select().from(sessions).all(),
    ])

    expect(token).toHaveLength(43)
    expect(stored).not.toContain(token)
    expect(stored).not.toContain(adminPassword)
    expect(stored).not.toContain(SHARED_PASSWORD)
  })

  it("asks the current password to change it, and signs out the other browsers", async () => {
    const client = await signIn("admin", adminPassword)
    const other = await signIn("admin", adminPassword)
    const newPassword = "encore un autre mot de passe"

    await manager.changePassword(client.socket, { newPassword })
    expect(errorOf(client)).toBe("errors:manager.wrongCurrentPassword")

    await manager.changePassword(client.socket, {
      currentPassword: adminPassword,
      newPassword: "trop court",
    })
    expect(errorOf(client)).toBe("errors:manager.passwordTooShort")

    await manager.changePassword(client.socket, {
      currentPassword: adminPassword,
      newPassword: adminPassword,
    })
    expect(errorOf(client)).toBe("errors:manager.passwordUnchanged")

    await manager.changePassword(client.socket, {
      currentPassword: adminPassword,
      newPassword,
    })
    expect(client.events()).toContain(EVENTS.MANAGER.PASSWORD_CHANGED)
    expect(manager.getUser(client.socket)?.id).toBe("admin")
    expect(manager.getUser(other.socket)).toBeNull()

    adminPassword = newPassword
  })

  it("lets administrators create an account, with a temporary password", async () => {
    const admin = await signIn("admin", adminPassword)

    admin.send(EVENTS.USERS.CREATE, {
      name: "Camille Martin",
      email: " Camille.Martin@MSA.fr ",
      role: "creator",
    })

    const { id, password } = (await answer(
      admin,
      EVENTS.USERS.TEMPORARY_PASSWORD,
    )) as { id: string; password: string }

    camille.id = id
    expect(admin.last(EVENTS.USERS.DATA)).toContainEqual({
      id,
      name: "Camille Martin",
      email: "camille.martin@msa.fr",
      role: "creator",
      mustChangePassword: true,
      disabled: false,
    })

    admin.send(EVENTS.USERS.CREATE, {
      name: "Homonyme",
      email: "camille.martin@msa.fr",
      role: "creator",
    })
    expect(await answer(admin, EVENTS.USERS.ERROR)).toBe(
      "errors:users.emailTaken",
    )

    const client = await signIn("camille.martin@msa.fr", password)

    expect(sessionOf(client)?.user.mustChangePassword).toBe(true)

    await manager.changePassword(client.socket, {
      newPassword: camille.password,
    })
    expect(client.last(EVENTS.MANAGER.CONFIG)).toMatchObject({
      user: { id, role: "creator", mustChangePassword: false },
    })
  })

  it("keeps account management to administrators", async () => {
    const client = await signIn("camille.martin@msa.fr", camille.password)

    client.send(EVENTS.USERS.LIST)
    expect(client.last(EVENTS.USERS.ERROR)).toBe("errors:users.forbidden")

    client.send(EVENTS.USERS.CREATE, {
      name: "Intrus",
      email: "intrus@msa.fr",
      role: "admin",
    })
    expect(client.last(EVENTS.USERS.ERROR)).toBe("errors:users.forbidden")
  })

  it("never lets administrators change their own account from the list", async () => {
    const admin = await signIn("admin", adminPassword)

    admin.send(EVENTS.USERS.UPDATE, { id: "admin", role: "creator" })
    expect(await answer(admin, EVENTS.USERS.ERROR)).toBe(
      "errors:users.cannotChangeSelf",
    )

    admin.send(EVENTS.USERS.RESET_PASSWORD, "admin")
    expect(await answer(admin, EVENTS.USERS.ERROR)).toBe(
      "errors:users.cannotChangeSelf",
    )
  })

  it("signs out everywhere an account disabled, or whose password is reset", async () => {
    const admin = await signIn("admin", adminPassword)
    const client = await signIn("camille.martin@msa.fr", camille.password)

    admin.send(EVENTS.USERS.UPDATE, { id: camille.id, disabled: true })
    await answer(admin, EVENTS.USERS.DATA)

    expect(manager.getUser(client.socket)).toBeNull()
    expect(
      errorOf(await signIn("camille.martin@msa.fr", camille.password)),
    ).toBe("errors:manager.invalidCredentials")

    admin.send(EVENTS.USERS.UPDATE, { id: camille.id, disabled: false })
    await answer(admin, EVENTS.USERS.DATA)

    const again = await signIn("camille.martin@msa.fr", camille.password)

    expect(manager.getUser(again.socket)?.id).toBe(camille.id)

    admin.send(EVENTS.USERS.RESET_PASSWORD, camille.id)

    const { password } = (await answer(
      admin,
      EVENTS.USERS.TEMPORARY_PASSWORD,
    )) as { password: string }

    expect(manager.getUser(again.socket)).toBeNull()
    expect(
      errorOf(await signIn("camille.martin@msa.fr", camille.password)),
    ).toBe("errors:manager.invalidCredentials")
    expect(
      sessionOf(await signIn("camille.martin@msa.fr", password))?.user
        .mustChangePassword,
    ).toBe(true)
    expect(
      (admin.last(EVENTS.USERS.DATA) as UserAccount[]).map(({ role }) => role),
    ).toEqual(["admin", "creator"])
  })

  it("refuses an identifier for a while after repeated failures", async () => {
    const attempts = Array.from({ length: AUTH_LIMITS.MAX_FAILED_LOGINS }, () =>
      signIn("admin", "toujours pas le bon"),
    )

    await Promise.all(attempts)

    expect(errorOf(await signIn("admin", adminPassword))).toBe(
      "errors:manager.tooManyAttempts",
    )
    expect(errorOf(await signIn("intrus@msa.fr", "peu importe"))).toBe(
      "errors:manager.invalidCredentials",
    )
  })
})
