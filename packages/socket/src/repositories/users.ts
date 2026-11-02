import { AUTH_LIMITS } from "@razzia/common/constants"
import type {
  ManagerUser,
  UserAccount,
  UserRole,
} from "@razzia/common/types/manager"
import type { NewUser } from "@razzia/common/validators/auth"
import { db } from "@razzia/socket/db/client"
import { sessions, users } from "@razzia/socket/db/schema"
import { and, asc, eq, gt, lte, ne, or } from "drizzle-orm"
import { nanoid } from "nanoid"
import { createHash, randomBytes } from "node:crypto"

export type UserRow = typeof users.$inferSelect

const IDLE_MS = AUTH_LIMITS.SESSION_IDLE_HOURS * 3_600_000
const MAX_AGE_MS = AUTH_LIMITS.SESSION_MAX_DAYS * 86_400_000
// How often a session in use has its end pushed back: one write at most
// every few minutes, not one per click.
const EXTEND_EVERY_MS = 5 * 60_000

export const toManagerUser = ({
  id,
  name,
  email,
  role,
  mustChangePassword,
}: UserRow): ManagerUser => ({ id, name, email, role, mustChangePassword })

const toAccount = (row: UserRow): UserAccount => ({
  ...toManagerUser(row),
  disabled: row.disabled,
})

export const listUsers = (): UserAccount[] =>
  db.select().from(users).orderBy(asc(users.name)).all().map(toAccount)

export const findUserById = (id: string): UserRow | undefined =>
  db.select().from(users).where(eq(users.id, id)).get()

// The identifier as normalizeLogin leaves it.
export const findUserByLogin = (login: string): UserRow | undefined =>
  db.select().from(users).where(eq(users.email, login)).get()

// With a temporary password, to change at the first sign-in.
export const createUser = (
  user: NewUser,
  passwordHash: string,
): { id: string } => {
  if (findUserByLogin(user.email)) {
    throw new Error("errors:users.emailTaken")
  }

  const id = nanoid()

  db.insert(users)
    .values({ id, ...user, passwordHash, mustChangePassword: true })
    .run()

  return { id }
}

export const setPassword = (
  id: string,
  passwordHash: string,
  mustChangePassword: boolean,
): boolean =>
  db
    .update(users)
    .set({ passwordHash, mustChangePassword })
    .where(eq(users.id, id))
    .run().changes > 0

export const updateUser = (
  id: string,
  changes: { role?: UserRole; disabled?: boolean },
): boolean => {
  if (changes.role === undefined && changes.disabled === undefined) {
    return findUserById(id) !== undefined
  }

  return db.update(users).set(changes).where(eq(users.id, id)).run().changes > 0
}

// What the database keeps of a session token.
const digest = (token: string) =>
  createHash("sha256").update(token).digest("base64url")

// Returns the token for the browser to keep. Sessions past their end are
// cleared on the way.
export const createSession = (userId: string): string => {
  const token = randomBytes(32).toString("base64url")
  const now = Date.now()

  db.delete(sessions)
    .where(
      or(
        lte(sessions.expiresAt, new Date(now)),
        lte(sessions.createdAt, new Date(now - MAX_AGE_MS)),
      ),
    )
    .run()
  db.insert(sessions)
    .values({
      id: digest(token),
      userId,
      expiresAt: new Date(now + IDLE_MS),
    })
    .run()

  return token
}

// The account of an open session: none once the session ended, was closed or
// its account disabled. Using a session pushes its end back, up to its
// maximum age.
export const findSessionUser = (token: string): UserRow | null => {
  const id = digest(token)
  const now = Date.now()
  const row = db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.id, id),
        gt(sessions.expiresAt, new Date(now)),
        gt(sessions.createdAt, new Date(now - MAX_AGE_MS)),
        eq(users.disabled, false),
      ),
    )
    .get()

  if (!row) {
    return null
  }

  if (row.expiresAt.getTime() < now + IDLE_MS - EXTEND_EVERY_MS) {
    db.update(sessions)
      .set({ expiresAt: new Date(now + IDLE_MS) })
      .where(eq(sessions.id, id))
      .run()
  }

  return row.user
}

export const deleteSession = (token: string): void => {
  db.delete(sessions)
    .where(eq(sessions.id, digest(token)))
    .run()
}

// Every session of the account, but the one kept.
export const deleteUserSessions = (
  userId: string,
  keptToken?: string | null,
): void => {
  db.delete(sessions)
    .where(
      keptToken
        ? and(eq(sessions.userId, userId), ne(sessions.id, digest(keptToken)))
        : eq(sessions.userId, userId),
    )
    .run()
}
