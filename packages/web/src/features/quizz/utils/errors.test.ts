import {
  faultyQuestionOf,
  quizzErrorText,
} from "@razzia/web/features/quizz/utils/errors"
import type { TFunction } from "i18next"
import { describe, expect, it } from "vitest"

// Returns the key and its values, as i18next would fill them in.
const t = ((key: string, values?: Record<string, unknown>) =>
  values ? `${key} ${JSON.stringify(values)}` : key) as unknown as TFunction

describe("quizzErrorText", () => {
  it("reads a bare key, as the server sent every error before", () => {
    expect(quizzErrorText(t, "errors:quizz.subjectEmpty")).toBe(
      "errors:quizz.subjectEmpty",
    )
    expect(quizzErrorText(t, { message: "errors:quizz.noQuestions" })).toBe(
      "errors:quizz.noQuestions",
    )
  })

  it("puts the number of the question at fault first, from 1", () => {
    expect(
      quizzErrorText(t, {
        message: "errors:quizz.mediaUrlNotWeb",
        questionIndex: 2,
      }),
    ).toBe(
      'errors:quizz.inQuestion {"number":3,"message":"errors:quizz.mediaUrlNotWeb"}',
    )
  })
})

describe("quizzErrorText for an import", () => {
  it("names the question of the imported file", () => {
    expect(
      quizzErrorText(
        t,
        { message: "errors:quizz.questionEmpty", questionIndex: 1 },
        "errors:quizz.inImportedQuestion",
      ),
    ).toBe(
      'errors:quizz.inImportedQuestion {"number":2,"message":"errors:quizz.questionEmpty"}',
    )
  })
})

describe("faultyQuestionOf", () => {
  it("gives the question to open, if any", () => {
    expect(
      faultyQuestionOf({
        message: "errors:quizz.questionEmpty",
        questionIndex: 0,
      }),
    ).toBe(0)
    expect(faultyQuestionOf("errors:quizz.subjectEmpty")).toBeUndefined()
    expect(
      faultyQuestionOf({ message: "errors:quizz.subjectEmpty" }),
    ).toBeUndefined()
  })
})
