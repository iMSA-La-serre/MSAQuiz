import type {
  QuizzError,
  QuizzMeta,
  QuizzWithId,
} from "@razzia/common/types/game"
import { mediaIssuesOf } from "@razzia/common/utils/media"
import {
  quizzErrorOf,
  quizzSaveValidator,
  quizzValidator,
  type QuizzValidated,
} from "@razzia/common/validators/quizz"
import { db } from "@razzia/socket/db/client"
import { ADMIN_USER_ID } from "@razzia/socket/db/seed"
import { createQuizzId } from "@razzia/socket/db/quizz-id"
import { quizzes } from "@razzia/socket/db/schema"
import { eq } from "drizzle-orm"

// A quiz refused on save, with the question it is about when it is about one.
export class QuizzValidationError extends Error {
  readonly quizzError: QuizzError

  constructor(quizzError: QuizzError) {
    super(quizzError.message)
    this.quizzError = quizzError
  }
}

export const getQuizz = (): QuizzWithId[] =>
  db
    .select()
    .from(quizzes)
    .all()
    .flatMap((row) => {
      // Rows can be edited outside the app (drizzle studio, SQL, older
      // versions): re-validate on read, like the file storage used to.
      const result = quizzValidator.safeParse(row.data)

      if (!result.success) {
        console.warn(`Invalid quizz "${row.id}":`, result.error.issues)

        return []
      }

      return [{ id: row.id, ...result.data }]
    })

export const getQuizzMeta = (): QuizzMeta[] =>
  db.select({ id: quizzes.id, subject: quizzes.subject }).from(quizzes).all()

export const getQuizzById = (id: string): QuizzWithId => {
  const row = db.select().from(quizzes).where(eq(quizzes.id, id)).get()

  if (!row) {
    throw new Error(`Quizz "${id}" not found`)
  }

  const result = quizzValidator.safeParse(row.data)

  if (!result.success) {
    throw new Error(`Invalid quizz "${id}"`)
  }

  return { id: row.id, ...result.data }
}

const insertQuizz = (quizz: QuizzValidated): { id: string } => {
  const id = createQuizzId(quizz.subject)

  db.insert(quizzes)
    .values({
      id,
      ownerId: ADMIN_USER_ID,
      subject: quizz.subject,
      data: quizz,
    })
    .onConflictDoUpdate({
      target: quizzes.id,
      set: {
        subject: quizz.subject,
        data: quizz,
        updatedAt: new Date(),
      },
    })
    .run()

  return { id }
}

export const saveQuizz = (data: unknown): { id: string } => {
  const result = quizzSaveValidator.safeParse(data)

  if (!result.success) {
    throw new QuizzValidationError(quizzErrorOf(result.error))
  }

  return insertQuizz(result.data)
}

/**
 * A quiz file imported: an export of this instance or of another one, an old
 * Razzia file. Read as a stored quiz is, so whatever was exported imports
 * again as it was; the media a save would now refuse are kept, and returned
 * with their question for the author to fix them in the editor, whose save
 * requires it.
 */
export const importQuizz = (
  data: unknown,
): { id: string; warnings: QuizzError[] } => {
  const result = quizzValidator.safeParse(data)

  if (!result.success) {
    throw new QuizzValidationError(quizzErrorOf(result.error))
  }

  return {
    ...insertQuizz(result.data),
    warnings: mediaIssuesOf(result.data.questions),
  }
}

export const updateQuizz = (id: string, data: unknown): { id: string } => {
  const result = quizzSaveValidator.safeParse(data)

  if (!result.success) {
    throw new QuizzValidationError(quizzErrorOf(result.error))
  }

  const { changes } = db
    .update(quizzes)
    .set({
      subject: result.data.subject,
      data: result.data,
      updatedAt: new Date(),
    })
    .where(eq(quizzes.id, id))
    .run()

  if (changes === 0) {
    throw new Error(`Quizz "${id}" not found`)
  }

  return { id }
}

export const deleteQuizz = (id: string): void => {
  const { changes } = db.delete(quizzes).where(eq(quizzes.id, id)).run()

  if (changes === 0) {
    throw new Error(`Quizz "${id}" not found`)
  }
}
