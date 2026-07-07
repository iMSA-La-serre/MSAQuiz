import { EXAMPLE_QUIZZ } from "@razzia/common/constants"
import { quizzValidator } from "@razzia/common/validators/quizz"
import { db } from "@razzia/socket/db/client"
import { createQuizzId } from "@razzia/socket/db/quizz-id"
import { quizzes, users } from "@razzia/socket/db/schema"

/** Propriétaire par défaut des quiz, en attendant le SSO / les comptes. */
export const ADMIN_USER_ID = "admin"

export const seedDatabase = () => {
  db.insert(users)
    .values({
      id: ADMIN_USER_ID,
      email: "admin@msaquiz.local",
      name: "Admin",
      role: "admin",
    })
    .onConflictDoNothing()
    .run()

  const hasQuizz = db.select({ id: quizzes.id }).from(quizzes).limit(1).all()

  if (hasQuizz.length === 0) {
    // Sujet francisé (l'EXAMPLE_QUIZZ upstream s'appelle "Example Quizz").
    const parsed = quizzValidator.safeParse({
      ...EXAMPLE_QUIZZ,
      subject: "Quiz d'exemple",
    })

    if (parsed.success) {
      db.insert(quizzes)
        .values({
          id: createQuizzId(parsed.data.subject),
          ownerId: ADMIN_USER_ID,
          subject: parsed.data.subject,
          data: parsed.data,
        })
        .onConflictDoNothing()
        .run()
    }
  }
}
