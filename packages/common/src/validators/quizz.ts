import {
  ESTIMATE_LIMITS,
  ESTIMATE_TOLERANCE,
  MEDIA_TYPES,
  NO_TIME_LIMIT,
  ORDER_SCORING,
  ORDERING_ITEM_MAX_LENGTH,
  QUESTION_TYPE_META,
  QUESTION_TYPES,
  SCORING_MODES,
  SHORTANSWER_LIMITS,
  WORDCLOUD_LIMITS,
} from "@razzia/common/constants"
import type { Question, QuestionOptions } from "@razzia/common/types/game"
import { decimalsOf, fitsDecimals } from "@razzia/common/utils/estimate"
import {
  answerKey,
  cleanInput,
  countInputChars,
} from "@razzia/common/utils/text"
import { z } from "zod"

export const questionMediaValidator = z.object({
  type: z
    .enum([MEDIA_TYPES.IMAGE, MEDIA_TYPES.VIDEO, MEDIA_TYPES.AUDIO])
    .optional(),
  url: z.url("errors:quizz.invalidMediaUrl"),
})

// Shared by every type: the scoring mode is filled in whenever options are
// given, as it always was, so stored quizzes parse to the same data.
const optionsValidator = z.object({
  scoringMode: z.enum(SCORING_MODES).default(SCORING_MODES.BALANCED),
  orderScoring: z.enum(ORDER_SCORING).optional(),
  typoTolerance: z.boolean().optional(),
  wordCount: z
    .number()
    .int("errors:quizz.wordCountRange")
    .min(WORDCLOUD_LIMITS.MIN_WORDS, "errors:quizz.wordCountRange")
    .max(WORDCLOUD_LIMITS.MAX_WORDS, "errors:quizz.wordCountRange")
    .optional(),
  // Estimate. Checked against each other and the right value below.
  decimals: z
    .number()
    .int("errors:quizz.decimalsRange")
    .min(0, "errors:quizz.decimalsRange")
    .max(ESTIMATE_LIMITS.MAX_DECIMALS, "errors:quizz.decimalsRange")
    .optional(),
  tolerance: z.number().optional(),
  toleranceMode: z.enum(ESTIMATE_TOLERANCE).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  unit: z.string().optional(),
})

// Types added after quizzes were first stored: the stricter rules below only
// apply to them, so no stored quiz becomes invalid.
const NEWER_TYPES = new Set<string>([
  QUESTION_TYPES.ORDERING,
  QUESTION_TYPES.SHORTANSWER,
  QUESTION_TYPES.WORDCLOUD,
  QUESTION_TYPES.ESTIMATE,
])

const MIN_TIME = 5

type IssueFn = (_message: string, _path: Array<string | number>) => void

// Index of the first text whose key was already seen: two texts equal once
// normalized cannot be told apart by a player. Empty keys never compare.
const firstDuplicateKey = (texts: string[]): number => {
  const seen = new Set<string>()

  return texts.findIndex((text) => {
    const key = answerKey(text)

    if (key === "") {
      return false
    }

    if (seen.has(key)) {
      return true
    }

    seen.add(key)

    return false
  })
}

// The text is stored raw, but counted once cleaned, and cleaning first cuts it
// at RAW_LENGTH: a longer raw text would hide an uncounted tail.
const isTooLong = (text: string, max: number): boolean =>
  text.length > SHORTANSWER_LIMITS.RAW_LENGTH || countInputChars(text) > max

const checkOrderingItems = (items: string[], issue: IssueFn) => {
  items.forEach((item, index) => {
    // An empty string is already reported by the answers schema.
    if (item !== "" && cleanInput(item) === "") {
      issue("errors:quizz.answerEmpty", ["answers", index])
    }

    if (isTooLong(item, ORDERING_ITEM_MAX_LENGTH)) {
      issue("errors:quizz.orderItemTooLong", ["answers", index])
    }
  })

  const duplicate = firstDuplicateKey(items)

  if (duplicate !== -1) {
    issue("errors:quizz.orderItemDuplicate", ["answers", duplicate])
  }
}

const checkAccepted = (accepted: string[], issue: IssueFn) => {
  if (accepted.length === 0) {
    issue("errors:quizz.acceptedMissing", ["accepted"])
  }

  if (accepted.length > SHORTANSWER_LIMITS.ACCEPTED_COUNT) {
    issue("errors:quizz.tooManyAccepted", ["accepted"])
  }

  accepted.forEach((text, index) => {
    if (cleanInput(text) === "") {
      issue("errors:quizz.acceptedEmpty", ["accepted", index])

      return
    }

    if (isTooLong(text, SHORTANSWER_LIMITS.ACCEPTED_LENGTH)) {
      issue("errors:quizz.acceptedTooLong", ["accepted", index])
    }

    if (answerKey(text) === "") {
      issue("errors:quizz.acceptedNoKey", ["accepted", index])
    }
  })

  const duplicate = firstDuplicateKey(accepted)

  if (duplicate !== -1) {
    issue("errors:quizz.acceptedDuplicate", ["accepted", duplicate])
  }
}

// A number of an estimate: at most the question's decimals, under 10^12.
const checkNumber = (
  value: number,
  decimals: number,
  { issue, path }: { issue: IssueFn; path: Array<string | number> },
) => {
  if (Math.abs(value) >= 10 ** ESTIMATE_LIMITS.INTEGER_DIGITS) {
    issue("errors:quizz.estimateTooLarge", path)
  } else if (!fitsDecimals(value, decimals)) {
    issue("errors:quizz.estimateDecimals", path)
  }
}

const checkTolerance = (
  options: QuestionOptions,
  decimals: number,
  issue: IssueFn,
) => {
  const { tolerance } = options
  const path = ["options", "tolerance"]

  if (tolerance === undefined) {
    return
  }

  if (tolerance < 0) {
    issue("errors:quizz.estimateTolerance", path)

    return
  }

  if (options.toleranceMode !== ESTIMATE_TOLERANCE.PERCENT) {
    checkNumber(tolerance, decimals, { issue, path })

    return
  }

  if (
    tolerance > ESTIMATE_LIMITS.MAX_PERCENT ||
    !fitsDecimals(tolerance, ESTIMATE_LIMITS.PERCENT_DECIMALS)
  ) {
    issue("errors:quizz.estimatePercent", path)
  }
}

const checkEstimate = (
  { expected, options = {} }: Pick<Question, "expected" | "options">,
  issue: IssueFn,
) => {
  const decimals = decimalsOf(options)
  const { min, max, unit } = options

  if (expected === undefined) {
    issue("errors:quizz.estimateExpectedMissing", ["expected"])
  } else {
    checkNumber(expected, decimals, { issue, path: ["expected"] })
  }

  checkTolerance(options, decimals, issue)

  if (min !== undefined) {
    checkNumber(min, decimals, { issue, path: ["options", "min"] })
  }

  if (max !== undefined) {
    checkNumber(max, decimals, { issue, path: ["options", "max"] })
  }

  if (min !== undefined && max !== undefined && min >= max) {
    issue("errors:quizz.estimateBounds", ["options", "max"])
  } else if (
    expected !== undefined &&
    ((min !== undefined && expected < min) ||
      (max !== undefined && expected > max))
  ) {
    issue("errors:quizz.estimateExpectedOutOfBounds", ["expected"])
  }

  if (unit !== undefined && isTooLong(unit, ESTIMATE_LIMITS.UNIT_LENGTH)) {
    issue("errors:quizz.estimateUnitTooLong", ["options", "unit"])
  }
}

// The unit is stored cleaned, and dropped when empty.
const estimateOptions = (options: QuestionOptions): QuestionOptions => {
  const { unit, ...rest } = options
  const cleaned = unit === undefined ? "" : cleanInput(unit)

  return cleaned === "" ? rest : { ...rest, unit: cleaned }
}

// The settings only an estimate reads.
const ESTIMATE_OPTION_KEYS = new Set<string>([
  "decimals",
  "tolerance",
  "toleranceMode",
  "min",
  "max",
  "unit",
] satisfies Array<keyof QuestionOptions>)

// The other types have the right value and the settings of an estimate
// dropped before any check, as zod dropped them before the estimate existed:
// they are neither refused nor stored, nor sent to the players.
const withoutEstimateFields = (question: Record<string, unknown>) => {
  if (question.type === QUESTION_TYPES.ESTIMATE) {
    return question
  }

  const { expected: _expected, ...rest } = question
  const { options } = rest

  if (
    typeof options !== "object" ||
    options === null ||
    Array.isArray(options)
  ) {
    return rest
  }

  return {
    ...rest,
    options: Object.fromEntries(
      Object.entries(options).filter(([key]) => !ESTIMATE_OPTION_KEYS.has(key)),
    ),
  }
}

// Backward compat: questions saved before type existed get one inferred.
// Several solutions = a real multi-select; one solution = single.
const questionValidator = z.preprocess(
  (data) => {
    if (typeof data !== "object" || data === null) {
      return data
    }

    const question = data as Record<string, unknown>

    if ("type" in question) {
      return withoutEstimateFields(question)
    }

    const isMulti =
      Array.isArray(question.solutions) && question.solutions.length > 1

    return withoutEstimateFields({
      ...question,
      type: isMulti ? QUESTION_TYPES.MULTI : QUESTION_TYPES.SINGLE,
    })
  },
  z
    .object({
      type: z.enum(QUESTION_TYPES),
      question: z.string().min(1, "errors:quizz.questionEmpty"),
      media: questionMediaValidator.optional(),
      // Bounds depend on the type, see QUESTION_TYPE_META.
      answers: z
        .array(z.string().min(1, "errors:quizz.answerEmpty"))
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
      maxPoints: z.number().int().min(0).optional(),
      penalty: z.number().int().min(0).optional(),
      options: optionsValidator.optional(),
      // Shortanswer only, dropped from the other types.
      accepted: z.array(z.string()).optional(),
      // Estimate only, dropped from the other types.
      expected: z.number().optional(),
      speedBonus: z.boolean().optional(),
    })
    .superRefine((question, ctx) => {
      const meta = QUESTION_TYPE_META[question.type]
      const count = question.answers.length
      const issue: IssueFn = (message, path) => {
        ctx.addIssue({ code: "custom", message, path })
      }

      // Fixed answers (true/false) are reported as such rather than as too
      // many; a type without answers (slide, shortanswer, wordcloud) has them
      // dropped.
      if (meta.answersCount !== undefined) {
        if (count < meta.minAnswers) {
          issue("errors:quizz.tooFewAnswers", ["answers"])
        }

        if (count !== meta.answersCount) {
          issue("errors:quizz.fixedAnswers", ["answers"])
        }
      } else if (meta.maxAnswers > 0) {
        if (count < meta.minAnswers) {
          issue("errors:quizz.tooFewAnswers", ["answers"])
        }

        if (count > meta.maxAnswers) {
          issue("errors:quizz.tooManyAnswers", ["answers"])
        }
      }

      // Ordering and shortanswer do not score against `solutions`; the newer
      // unscored types do not score at all.
      if (
        meta.scored &&
        !NEWER_TYPES.has(question.type) &&
        question.solutions.length === 0
      ) {
        issue("errors:quizz.noSolutions", ["solutions"])
      }

      if (question.type === QUESTION_TYPES.ORDERING) {
        checkOrderingItems(question.answers, issue)
      }

      if (question.type === QUESTION_TYPES.SHORTANSWER) {
        checkAccepted(question.accepted ?? [], issue)
      }

      if (question.type === QUESTION_TYPES.ESTIMATE) {
        checkEstimate(question, issue)
      }

      if (
        NEWER_TYPES.has(question.type) &&
        question.time !== NO_TIME_LIMIT &&
        question.time < MIN_TIME
      ) {
        issue("errors:quizz.timeTooShort", ["time"])
      }
    })
    // Typed as the shared Question, so the schema output always fits it.
    .transform(({ accepted, expected, ...question }): Question => {
      const meta = QUESTION_TYPE_META[question.type]

      // What a shortanswer scores against stays out of `answers`, which is
      // public.
      if (question.type === QUESTION_TYPES.SHORTANSWER) {
        return { ...question, accepted, answers: [], solutions: [] }
      }

      // The right value of an estimate has its own field, kept secret.
      if (question.type === QUESTION_TYPES.ESTIMATE) {
        return {
          ...question,
          expected,
          options: question.options && estimateOptions(question.options),
          answers: [],
          solutions: [],
        }
      }

      // The items are stored in the correct order: no solutions to keep.
      if (question.type === QUESTION_TYPES.ORDERING) {
        return { ...question, solutions: [] }
      }

      if (meta.scored) {
        return question
      }

      // Unscored types: no solutions, no points tuning; slides and word clouds
      // have no answers.
      return {
        ...question,
        answers:
          meta.acceptsAnswers && meta.maxAnswers > 0 ? question.answers : [],
        solutions: [],
        maxPoints: undefined,
        penalty: undefined,
      }
    }),
)

export const quizzValidator = z.object({
  subject: z.string().min(1, "errors:quizz.subjectEmpty"),
  questions: z.array(questionValidator).min(1, "errors:quizz.noQuestions"),
})

export type QuizzValidated = z.infer<typeof quizzValidator>
