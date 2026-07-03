import type { QuizzMeta, QuizzWithId } from "@razzia/common/types/game"
import { quizzValidator } from "@razzia/common/validators/quizz"
import { db } from "@razzia/socket/db/client"
import { ADMIN_USER_ID } from "@razzia/socket/db/seed"
import { createQuizzId } from "@razzia/socket/db/quizz-id"
import { quizzes } from "@razzia/socket/db/schema"
import { eq } from "drizzle-orm"

export const getQuizz = (): QuizzWithId[] =>
  db
    .select()
    .from(quizzes)
    .all()
    .map((row) => ({ id: row.id, ...row.data }))

export const getQuizzMeta = (): QuizzMeta[] =>
  db.select({ id: quizzes.id, subject: quizzes.subject }).from(quizzes).all()

export const getQuizzById = (id: string): QuizzWithId => {
  const row = db.select().from(quizzes).where(eq(quizzes.id, id)).get()

  if (!row) {
    throw new Error(`Quizz "${id}" not found`)
  }

  return { id: row.id, ...row.data }
}

export const saveQuizz = (data: unknown): { id: string } => {
  const result = quizzValidator.safeParse(data)

  if (!result.success) {
    throw new Error(result.error.issues[0].message)
  }

  const id = createQuizzId(result.data.subject)

  db.insert(quizzes)
    .values({
      id,
      ownerId: ADMIN_USER_ID,
      subject: result.data.subject,
      data: result.data,
    })
    .onConflictDoUpdate({
      target: quizzes.id,
      set: {
        subject: result.data.subject,
        data: result.data,
        updatedAt: new Date(),
      },
    })
    .run()

  return { id }
}

export const updateQuizz = (id: string, data: unknown): { id: string } => {
  const result = quizzValidator.safeParse(data)

  if (!result.success) {
    throw new Error(result.error.issues[0].message)
  }

  const existing = db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(eq(quizzes.id, id))
    .get()

  if (!existing) {
    throw new Error(`Quizz "${id}" not found`)
  }

  db.update(quizzes)
    .set({
      subject: result.data.subject,
      data: result.data,
      updatedAt: new Date(),
    })
    .where(eq(quizzes.id, id))
    .run()

  return { id }
}

export const deleteQuizz = (id: string): void => {
  const existing = db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(eq(quizzes.id, id))
    .get()

  if (!existing) {
    throw new Error(`Quizz "${id}" not found`)
  }

  db.delete(quizzes).where(eq(quizzes.id, id)).run()
}
