import {
  MEDIA_TYPES,
  QUESTION_TYPE_META,
  QUESTION_TYPES,
  SCORING_MODES,
} from "@razzia/common/constants"
import { z } from "zod"

export const questionMediaValidator = z.object({
  type: z
    .enum([MEDIA_TYPES.IMAGE, MEDIA_TYPES.VIDEO, MEDIA_TYPES.AUDIO])
    .optional(),
  url: z.url("errors:quizz.invalidMediaUrl"),
})

const multiOptionsValidator = z.object({
  scoringMode: z.enum(SCORING_MODES).default(SCORING_MODES.BALANCED),
})

// Backward compat: questions saved before type existed get one inferred.
// Several solutions = a real multi-select; one solution = single.
const questionValidator = z.preprocess(
  (data) => {
    if (
      typeof data === "object" &&
      data !== null &&
      !("type" in (data as Record<string, unknown>))
    ) {
      const legacy = data as Record<string, unknown>
      const isMulti =
        Array.isArray(legacy.solutions) && legacy.solutions.length > 1

      return {
        ...legacy,
        type: isMulti ? QUESTION_TYPES.MULTI : QUESTION_TYPES.SINGLE,
      }
    }

    return data
  },
  z
    .object({
      type: z.enum(QUESTION_TYPES),
      question: z.string().min(1, "errors:quizz.questionEmpty"),
      media: questionMediaValidator.optional(),
      answers: z
        .array(z.string().min(1, "errors:quizz.answerEmpty"))
        .max(4, "errors:quizz.tooManyAnswers")
        .default([]),
      solutions: z
        .union([z.number().int().min(0), z.array(z.number().int().min(0))])
        .optional()
        .transform((v) => {
          if (v === undefined) {
            return []
          }

          return Array.isArray(v) ? v : [v]
        }),
      cooldown: z.number().int().min(3).max(15),
      time: z.number().int().min(-1),
      options: multiOptionsValidator.optional(),
    })
    .superRefine((question, ctx) => {
      const meta = QUESTION_TYPE_META[question.type]

      if (meta.acceptsAnswers && question.answers.length < 2) {
        ctx.addIssue({
          code: "custom",
          message: "errors:quizz.tooFewAnswers",
          path: ["answers"],
        })
      }

      if (meta.scored && question.solutions.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "errors:quizz.noSolutions",
          path: ["solutions"],
        })
      }
    })
    .transform((question) => {
      const meta = QUESTION_TYPE_META[question.type]

      return {
        ...question,
        answers: meta.acceptsAnswers ? question.answers : [],
        solutions: meta.scored ? question.solutions : [],
      }
    }),
)

export const quizzValidator = z.object({
  subject: z.string().min(1, "errors:quizz.subjectEmpty"),
  questions: z.array(questionValidator).min(1, "errors:quizz.noQuestions"),
})

export type QuizzValidated = z.infer<typeof quizzValidator>
