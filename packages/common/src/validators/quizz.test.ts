import {
  ASSOCIATION_LIMITS,
  EXAMPLE_QUIZZ,
  HIGHLIGHT_LIMITS,
  MATCH_SCORING,
  ORDER_SCORING,
  QUESTION_TYPES,
  SCORING_MODES,
} from "@razzia/common/constants"
import { quizzValidator } from "@razzia/common/validators/quizz"
import { describe, expect, it } from "vitest"

const SINGLE_QUESTION = {
  type: QUESTION_TYPES.SINGLE,
  question: "Quelle est la bonne réponse ?",
  answers: ["A", "B", "C", "D"],
  solutions: [0],
  cooldown: 5,
  time: 20,
}

const parse = (question: Record<string, unknown>) =>
  quizzValidator.parse({ subject: "Quiz", questions: [question] }).questions[0]

const isValid = (question: Record<string, unknown>) =>
  quizzValidator.safeParse({ subject: "Quiz", questions: [question] }).success

// A question written before the type system existed: no `type` field.
const { type: _type, ...LEGACY_QUESTION } = SINGLE_QUESTION

describe("legacy questions", () => {
  it("infers multi when several solutions are listed", () => {
    expect(parse({ ...LEGACY_QUESTION, solutions: [0, 2] }).type).toBe(
      QUESTION_TYPES.MULTI,
    )
  })

  it("infers single when only one solution is listed", () => {
    expect(parse(LEGACY_QUESTION).type).toBe(QUESTION_TYPES.SINGLE)
  })

  it("keeps an explicit type", () => {
    expect(parse({ ...SINGLE_QUESTION, type: QUESTION_TYPES.MULTI }).type).toBe(
      QUESTION_TYPES.MULTI,
    )
  })

  it("wraps a scalar solution into an array", () => {
    expect(parse({ ...SINGLE_QUESTION, solutions: 2 }).solutions).toEqual([2])
  })
})

describe("unscored types", () => {
  it("strips solutions and points tuning from a poll", () => {
    const poll = parse({
      ...SINGLE_QUESTION,
      type: QUESTION_TYPES.POLL,
      maxPoints: 1500,
      penalty: 200,
    })

    expect(poll.answers).toHaveLength(4)
    expect(poll.solutions).toEqual([])
    expect(poll.maxPoints).toBeUndefined()
    expect(poll.penalty).toBeUndefined()
  })

  it("drops the answers of a slide", () => {
    const slide = parse({ ...SINGLE_QUESTION, type: QUESTION_TYPES.SLIDE })

    expect(slide.answers).toEqual([])
    expect(slide.solutions).toEqual([])
  })

  it("accepts a slide without any answer", () => {
    expect(
      isValid({
        ...SINGLE_QUESTION,
        type: QUESTION_TYPES.SLIDE,
        answers: [],
        solutions: [],
      }),
    ).toBe(true)
  })
})

describe("fixed-answer types", () => {
  const trueFalse = {
    ...SINGLE_QUESTION,
    type: QUESTION_TYPES.TRUEFALSE,
    answers: ["Vrai", "Faux"],
    solutions: [0],
  }

  it("accepts exactly two answers", () => {
    expect(parse(trueFalse).answers).toEqual(["Vrai", "Faux"])
  })

  it("rejects a third answer", () => {
    expect(
      isValid({ ...trueFalse, answers: ["Vrai", "Faux", "Peut-être"] }),
    ).toBe(false)
  })

  it("still requires a solution", () => {
    expect(isValid({ ...trueFalse, solutions: [] })).toBe(false)
  })
})

describe("scoring options", () => {
  it("defaults the multi scoring mode to balanced", () => {
    const multi = parse({
      ...SINGLE_QUESTION,
      type: QUESTION_TYPES.MULTI,
      solutions: [0, 1],
      options: {},
    })

    expect(multi.options?.scoringMode).toBe(SCORING_MODES.BALANCED)
  })

  it("keeps an explicit scoring mode", () => {
    const multi = parse({
      ...SINGLE_QUESTION,
      type: QUESTION_TYPES.MULTI,
      solutions: [0, 1],
      options: { scoringMode: SCORING_MODES.STRICT },
    })

    expect(multi.options?.scoringMode).toBe(SCORING_MODES.STRICT)
  })
})

describe("rejected quizzes", () => {
  it("rejects a scored question without a solution", () => {
    expect(isValid({ ...SINGLE_QUESTION, solutions: [] })).toBe(false)
  })

  it("rejects fewer than two answers", () => {
    expect(isValid({ ...SINGLE_QUESTION, answers: ["A"] })).toBe(false)
  })

  it("rejects more than four answers", () => {
    expect(
      isValid({ ...SINGLE_QUESTION, answers: ["A", "B", "C", "D", "E"] }),
    ).toBe(false)
  })

  it("rejects an empty answer", () => {
    expect(isValid({ ...SINGLE_QUESTION, answers: ["A", ""] })).toBe(false)
  })

  it("rejects an empty question text", () => {
    expect(isValid({ ...SINGLE_QUESTION, question: "" })).toBe(false)
  })

  it("rejects a cooldown outside 3-15 seconds", () => {
    expect(isValid({ ...SINGLE_QUESTION, cooldown: 2 })).toBe(false)
    expect(isValid({ ...SINGLE_QUESTION, cooldown: 16 })).toBe(false)
  })

  it("rejects an unknown question type", () => {
    expect(isValid({ ...SINGLE_QUESTION, type: "buzzer" })).toBe(false)
  })

  it("rejects an invalid media url", () => {
    expect(
      isValid({
        ...SINGLE_QUESTION,
        media: { type: "image", url: "not-a-url" },
      }),
    ).toBe(false)
  })

  it("rejects an empty subject", () => {
    expect(
      quizzValidator.safeParse({ subject: "", questions: [SINGLE_QUESTION] })
        .success,
    ).toBe(false)
  })

  it("rejects a quiz without questions", () => {
    expect(
      quizzValidator.safeParse({ subject: "Quiz", questions: [] }).success,
    ).toBe(false)
  })
})

describe("accepted edge cases", () => {
  it("accepts -1 as no time limit", () => {
    expect(parse({ ...SINGLE_QUESTION, time: -1 }).time).toBe(-1)
  })

  it("accepts a media url", () => {
    const media = { type: "image", url: "https://example.org/image.png" }

    expect(parse({ ...SINGLE_QUESTION, media }).media?.url).toBe(media.url)
  })
})

describe("example quiz", () => {
  // The first-start seed silently skips a quiz that does not validate.
  it("passes validation", () => {
    expect(quizzValidator.safeParse(EXAMPLE_QUIZZ).success).toBe(true)
  })
})

// Messages of every issue, in order: the editor shows the first one.
const issuesOf = (question: Record<string, unknown>) =>
  quizzValidator
    .safeParse({ subject: "Quiz", questions: [question] })
    .error?.issues.map((issue) => issue.message) ?? []

describe("bounds read from the type", () => {
  it("reports fixed answers first on a true/false with many answers", () => {
    expect(
      issuesOf({
        ...SINGLE_QUESTION,
        type: QUESTION_TYPES.TRUEFALSE,
        answers: ["A", "B", "C", "D", "E"],
      }),
    ).toEqual(["errors:quizz.fixedAnswers"])
  })

  it("drops the answers of a slide whatever their number", () => {
    expect(
      parse({
        ...SINGLE_QUESTION,
        type: QUESTION_TYPES.SLIDE,
        answers: ["A", "B", "C", "D", "E"],
      }).answers,
    ).toEqual([])
  })

  it("still rejects an unknown type, with a single issue", () => {
    expect(issuesOf({ ...SINGLE_QUESTION, type: "buzzer" })).toHaveLength(1)
  })
})

describe("new optional fields on the existing types", () => {
  it("keeps the speed bonus switch", () => {
    expect(parse({ ...SINGLE_QUESTION, speedBonus: false }).speedBonus).toBe(
      false,
    )
  })

  it("drops accepted answers", () => {
    expect(
      parse({ ...SINGLE_QUESTION, accepted: ["Paris"] }),
    ).not.toHaveProperty("accepted")
  })

  it("drops the right value of an estimate, unchecked", () => {
    expect(parse({ ...SINGLE_QUESTION, expected: 35 })).not.toHaveProperty(
      "expected",
    )
    expect(parse({ ...SINGLE_QUESTION, expected: "35" })).not.toHaveProperty(
      "expected",
    )
    expect(
      parse({ ...LEGACY_QUESTION, expected: Number.NaN }),
    ).not.toHaveProperty("expected")
  })

  it("drops the settings of an estimate, unchecked", () => {
    const question = {
      ...SINGLE_QUESTION,
      options: {
        scoringMode: SCORING_MODES.STRICT,
        decimals: 9,
        tolerance: -5,
        toleranceMode: "relative",
        min: 1,
        max: 0,
        unit: "x".repeat(5000),
      },
    }

    expect(parse(question).options).toEqual({
      scoringMode: SCORING_MODES.STRICT,
    })
    expect(
      parse({ ...LEGACY_QUESTION, options: { unit: "km" } }).options,
    ).toEqual({ scoringMode: SCORING_MODES.BALANCED })
    expect(
      parse({
        ...SINGLE_QUESTION,
        type: QUESTION_TYPES.POLL,
        options: { min: 3 },
      }).options,
    ).toEqual({ scoringMode: SCORING_MODES.BALANCED })
  })

  it("drops the text of a highlight, unchecked", () => {
    expect(
      parse({ ...SINGLE_QUESTION, text: "Un [passage] et [un autre]" }),
    ).not.toHaveProperty("text")
    expect(parse({ ...SINGLE_QUESTION, text: 42 })).not.toHaveProperty("text")
    expect(
      parse({ ...LEGACY_QUESTION, text: "[".repeat(5000) }),
    ).not.toHaveProperty("text")
  })

  it("drops the targets of statements and categorize, unchecked", () => {
    const foreign = parse({
      ...SINGLE_QUESTION,
      targets: ["Vrai", "Faux"],
      expectedTargets: [0, 1],
    })

    expect(foreign).not.toHaveProperty("targets")
    expect(foreign).not.toHaveProperty("expectedTargets")
    expect(
      parse({ ...LEGACY_QUESTION, targets: 42, expectedTargets: ["x"] }),
    ).not.toHaveProperty("targets")
  })

  it("drops the scoring of statements and categorize, unchecked", () => {
    expect(
      parse({
        ...SINGLE_QUESTION,
        type: QUESTION_TYPES.ORDERING,
        answers: ["A", "B", "C"],
        options: { orderScoring: ORDER_SCORING.EXACT, matchScoring: "chains" },
      }).options,
    ).toEqual({
      scoringMode: SCORING_MODES.BALANCED,
      orderScoring: ORDER_SCORING.EXACT,
    })
  })

  it("keeps the old minimum time", () => {
    expect(isValid({ ...SINGLE_QUESTION, time: 1 })).toBe(true)
  })
})

describe("ordering", () => {
  const ORDERING = {
    ...SINGLE_QUESTION,
    type: QUESTION_TYPES.ORDERING,
    question: "Remettez les étapes dans l'ordre",
    answers: ["Accueil", "Diagnostic", "Orientation"],
    solutions: [],
  }

  it("keeps the items in the given order and no solutions", () => {
    const ordering = parse({ ...ORDERING, solutions: [2, 1] })

    expect(ordering.answers).toEqual(["Accueil", "Diagnostic", "Orientation"])
    expect(ordering.solutions).toEqual([])
  })

  it("keeps its scoring options and points tuning", () => {
    const ordering = parse({
      ...ORDERING,
      options: { orderScoring: ORDER_SCORING.EXACT },
      maxPoints: 2000,
      penalty: 100,
      speedBonus: true,
      accepted: ["Accueil"],
    })

    expect(ordering.options).toEqual({
      scoringMode: SCORING_MODES.BALANCED,
      orderScoring: ORDER_SCORING.EXACT,
    })
    expect(ordering).toMatchObject({
      maxPoints: 2000,
      penalty: 100,
      speedBonus: true,
    })
    expect(ordering).not.toHaveProperty("accepted")
  })

  it("takes 3 to 6 items", () => {
    const items = ["A", "B", "C", "D", "E", "F", "G"]

    expect(issuesOf({ ...ORDERING, answers: items.slice(0, 2) })).toEqual([
      "errors:quizz.tooFewAnswers",
    ])
    expect(isValid({ ...ORDERING, answers: items.slice(0, 6) })).toBe(true)
    expect(issuesOf({ ...ORDERING, answers: items })).toEqual([
      "errors:quizz.tooManyAnswers",
    ])
  })

  it("rejects a blank or too long item", () => {
    expect(issuesOf({ ...ORDERING, answers: ["A", "  ", "C"] })).toEqual([
      "errors:quizz.answerEmpty",
    ])
    expect(isValid({ ...ORDERING, answers: ["A", "B", "c".repeat(80)] })).toBe(
      true,
    )
    expect(
      issuesOf({ ...ORDERING, answers: ["A", "B", "c".repeat(81)] }),
    ).toEqual(["errors:quizz.orderItemTooLong"])
  })

  it("rejects a long tail hidden behind padding", () => {
    // Stored raw, but counted once cleaned: without a raw bound, only "Un"
    // would be counted.
    const padded = `Un${" ".repeat(198)}${"x".repeat(5000)}`

    expect(issuesOf({ ...ORDERING, answers: ["A", "B", padded] })).toEqual([
      "errors:quizz.orderItemTooLong",
    ])
    expect(
      isValid({ ...ORDERING, answers: ["A", "B", `Un${" ".repeat(198)}`] }),
    ).toBe(true)
  })

  it("rejects two items a player cannot tell apart", () => {
    expect(
      issuesOf({
        ...ORDERING,
        answers: ["Étape un", "Étape deux", "etape UN !"],
      }),
    ).toEqual(["errors:quizz.orderItemDuplicate"])
  })

  it("rejects an unknown scoring", () => {
    expect(isValid({ ...ORDERING, options: { orderScoring: "chains" } })).toBe(
      false,
    )
  })

  it("needs 5 seconds at least, or no limit", () => {
    expect(issuesOf({ ...ORDERING, time: 4 })).toEqual([
      "errors:quizz.timeTooShort",
    ])
    expect(isValid({ ...ORDERING, time: 5 })).toBe(true)
    expect(isValid({ ...ORDERING, time: -1 })).toBe(true)
  })
})

describe("shortanswer", () => {
  const SHORTANSWER = {
    type: QUESTION_TYPES.SHORTANSWER,
    question: "Quelle est la capitale de la France ?",
    accepted: ["Paris", "Lutèce"],
    cooldown: 5,
    time: 30,
  }

  it("keeps the accepted answers and no public answers", () => {
    const shortanswer = parse({
      ...SHORTANSWER,
      answers: ["Paris", "Lyon"],
      solutions: [0],
      options: { typoTolerance: true },
    })

    expect(shortanswer.accepted).toEqual(["Paris", "Lutèce"])
    expect(shortanswer.answers).toEqual([])
    expect(shortanswer.solutions).toEqual([])
    expect(shortanswer.options?.typoTolerance).toBe(true)
  })

  it("needs 1 to 10 accepted answers", () => {
    const accepted = Array.from(
      { length: 11 },
      (_, index) => `Réponse ${index}`,
    )

    expect(issuesOf({ ...SHORTANSWER, accepted: undefined })).toEqual([
      "errors:quizz.acceptedMissing",
    ])
    expect(issuesOf({ ...SHORTANSWER, accepted: [] })).toEqual([
      "errors:quizz.acceptedMissing",
    ])
    expect(isValid({ ...SHORTANSWER, accepted: accepted.slice(0, 10) })).toBe(
      true,
    )
    expect(issuesOf({ ...SHORTANSWER, accepted })).toEqual([
      "errors:quizz.tooManyAccepted",
    ])
  })

  it("rejects a blank or too long accepted answer", () => {
    expect(issuesOf({ ...SHORTANSWER, accepted: ["Paris", " "] })).toEqual([
      "errors:quizz.acceptedEmpty",
    ])
    expect(isValid({ ...SHORTANSWER, accepted: ["p".repeat(60)] })).toBe(true)
    expect(issuesOf({ ...SHORTANSWER, accepted: ["p".repeat(61)] })).toEqual([
      "errors:quizz.acceptedTooLong",
    ])
  })

  it("rejects a long tail hidden behind padding", () => {
    const padded = `Paris${" ".repeat(195)}${"y".repeat(3000)}`

    expect(issuesOf({ ...SHORTANSWER, accepted: [padded] })).toEqual([
      "errors:quizz.acceptedTooLong",
    ])
  })

  it("rejects an accepted answer made of punctuation only", () => {
    expect(issuesOf({ ...SHORTANSWER, accepted: ["Paris", "?!"] })).toEqual([
      "errors:quizz.acceptedNoKey",
    ])
  })

  it("rejects two accepted answers equal once normalized", () => {
    expect(
      issuesOf({ ...SHORTANSWER, accepted: ["Lutèce", "Paris", "LUTECE !"] }),
    ).toEqual(["errors:quizz.acceptedDuplicate"])
  })

  it("needs 5 seconds at least, or no limit", () => {
    expect(issuesOf({ ...SHORTANSWER, time: 3 })).toEqual([
      "errors:quizz.timeTooShort",
    ])
    expect(isValid({ ...SHORTANSWER, time: -1 })).toBe(true)
  })
})

describe("wordcloud", () => {
  const WORDCLOUD = {
    type: QUESTION_TYPES.WORDCLOUD,
    question: "En un mot, qu'attendez-vous de votre caisse ?",
    options: { wordCount: 3 },
    cooldown: 5,
    time: 40,
  }

  it("keeps its fields per player and nothing to score", () => {
    const wordcloud = parse({
      ...WORDCLOUD,
      answers: ["Écoute", "Proximité"],
      solutions: [0],
      accepted: ["Écoute"],
      maxPoints: 2000,
      penalty: 100,
    })

    expect(wordcloud.options?.wordCount).toBe(3)
    expect(wordcloud.answers).toEqual([])
    expect(wordcloud.solutions).toEqual([])
    expect(wordcloud).not.toHaveProperty("accepted")
    expect(wordcloud.maxPoints).toBeUndefined()
    expect(wordcloud.penalty).toBeUndefined()
  })

  it("takes 1 to 3 fields, 1 when absent", () => {
    expect(isValid({ ...WORDCLOUD, options: undefined })).toBe(true)
    expect(isValid({ ...WORDCLOUD, options: { wordCount: 1 } })).toBe(true)

    for (const wordCount of [0, 4, 1.5]) {
      expect(issuesOf({ ...WORDCLOUD, options: { wordCount } })).toEqual([
        "errors:quizz.wordCountRange",
      ])
    }
  })

  it("needs 5 seconds at least, or no limit", () => {
    expect(issuesOf({ ...WORDCLOUD, time: 3 })).toEqual([
      "errors:quizz.timeTooShort",
    ])
    expect(isValid({ ...WORDCLOUD, time: -1 })).toBe(true)
  })
})

describe("estimate", () => {
  const ESTIMATE = {
    type: QUESTION_TYPES.ESTIMATE,
    question: "Combien de caisses régionales compte la MSA ?",
    expected: 35,
    options: { tolerance: 2 },
    cooldown: 5,
    time: 30,
  }

  it("keeps the right value apart and no public answers", () => {
    const estimate = parse({
      ...ESTIMATE,
      answers: ["35", "40"],
      solutions: [0],
      accepted: ["35"],
      options: {
        tolerance: 10,
        toleranceMode: "percent",
        decimals: 1,
        min: 0,
        max: 100,
        unit: "  caisses ",
      },
    })

    expect(estimate.expected).toBe(35)
    expect(estimate.answers).toEqual([])
    expect(estimate.solutions).toEqual([])
    expect(estimate).not.toHaveProperty("accepted")
    expect(estimate.options).toMatchObject({
      tolerance: 10,
      toleranceMode: "percent",
      decimals: 1,
      min: 0,
      max: 100,
      unit: "caisses",
    })
  })

  it("drops an empty unit and keeps no options when none are given", () => {
    expect(
      parse({ ...ESTIMATE, options: { unit: " " } }).options,
    ).not.toHaveProperty("unit")
    expect(parse({ ...ESTIMATE, options: undefined }).options).toBeUndefined()
  })

  it("needs a right value within 12 digits and the question's decimals", () => {
    expect(issuesOf({ ...ESTIMATE, expected: undefined })).toEqual([
      "errors:quizz.estimateExpectedMissing",
    ])
    expect(issuesOf({ ...ESTIMATE, expected: 35.5 })).toEqual([
      "errors:quizz.estimateDecimals",
    ])
    expect(
      isValid({ ...ESTIMATE, expected: 35.5, options: { decimals: 1 } }),
    ).toBe(true)
    expect(issuesOf({ ...ESTIMATE, expected: 1e12 })).toEqual([
      "errors:quizz.estimateTooLarge",
    ])
  })

  it("takes 0 to 3 decimals", () => {
    for (const decimals of [-1, 4, 1.5]) {
      expect(issuesOf({ ...ESTIMATE, options: { decimals } })).toEqual([
        "errors:quizz.decimalsRange",
      ])
    }
  })

  it("checks the tolerance in the unit or as a percentage", () => {
    expect(issuesOf({ ...ESTIMATE, options: { tolerance: -1 } })).toEqual([
      "errors:quizz.estimateTolerance",
    ])
    expect(issuesOf({ ...ESTIMATE, options: { tolerance: 0.5 } })).toEqual([
      "errors:quizz.estimateDecimals",
    ])
    expect(
      isValid({
        ...ESTIMATE,
        options: { tolerance: 2.5, toleranceMode: "percent" },
      }),
    ).toBe(true)

    for (const tolerance of [101, 2.55]) {
      expect(
        issuesOf({
          ...ESTIMATE,
          options: { tolerance, toleranceMode: "percent" },
        }),
      ).toEqual(["errors:quizz.estimatePercent"])
    }

    expect(
      isValid({ ...ESTIMATE, options: { toleranceMode: "relative" } }),
    ).toBe(false)
  })

  it("needs ordered bounds around the right value", () => {
    expect(isValid({ ...ESTIMATE, options: { min: 35, max: 36 } })).toBe(true)
    expect(issuesOf({ ...ESTIMATE, options: { min: 50, max: 10 } })).toEqual([
      "errors:quizz.estimateBounds",
    ])
    expect(issuesOf({ ...ESTIMATE, options: { min: 36 } })).toEqual([
      "errors:quizz.estimateExpectedOutOfBounds",
    ])
    expect(issuesOf({ ...ESTIMATE, options: { max: 34 } })).toEqual([
      "errors:quizz.estimateExpectedOutOfBounds",
    ])
    expect(issuesOf({ ...ESTIMATE, options: { min: 0.5 } })).toEqual([
      "errors:quizz.estimateDecimals",
    ])
  })

  it("keeps the unit short", () => {
    expect(isValid({ ...ESTIMATE, options: { unit: "u".repeat(20) } })).toBe(
      true,
    )
    expect(
      issuesOf({ ...ESTIMATE, options: { unit: "u".repeat(21) } }),
    ).toEqual(["errors:quizz.estimateUnitTooLong"])
  })

  it("needs 5 seconds at least, or no limit", () => {
    expect(issuesOf({ ...ESTIMATE, time: 3 })).toEqual([
      "errors:quizz.timeTooShort",
    ])
    expect(isValid({ ...ESTIMATE, time: -1 })).toBe(true)
  })
})

describe("highlight", () => {
  const HIGHLIGHT = {
    type: QUESTION_TYPES.HIGHLIGHT,
    question: "Repérez les deux délais à respecter",
    text: "Prévenez votre employeur [sous 48 heures] et envoyez l'arrêt à la MSA [sous 48 heures aussi], [par courrier] ou [en ligne].",
    solutions: [0, 1],
    cooldown: 5,
    time: 45,
  }

  it("reads its answers from the passages of the text", () => {
    const highlight = parse({
      ...HIGHLIGHT,
      answers: ["Autre", "Chose"],
      accepted: ["sous 48 heures"],
      expected: 48,
    })

    expect(highlight.answers).toEqual([
      "sous 48 heures",
      "sous 48 heures aussi",
      "par courrier",
      "en ligne",
    ])
    expect(highlight.solutions).toEqual([0, 1])
    expect(highlight).not.toHaveProperty("accepted")
    expect(highlight).not.toHaveProperty("expected")
  })

  it("stores the text cleaned, and each passage to spot once", () => {
    const highlight = parse({
      ...HIGHLIGHT,
      text: "  Un [ premier ]\n passage et [un second ]. ",
      solutions: [1, 0, 1],
    })

    expect(highlight.text).toBe("Un [premier] passage et [un second].")
    expect(highlight.solutions).toEqual([0, 1])
  })

  it("keeps the multi scoring modes and points tuning", () => {
    const highlight = parse({
      ...HIGHLIGHT,
      options: { scoringMode: SCORING_MODES.STRICT },
      maxPoints: 2000,
      penalty: 100,
      speedBonus: true,
    })

    expect(highlight.options).toEqual({ scoringMode: SCORING_MODES.STRICT })
    expect(highlight).toMatchObject({
      maxPoints: 2000,
      penalty: 100,
      speedBonus: true,
    })
  })

  it("stores the lenient mode as balanced, where a multi keeps it", () => {
    const lenient = { scoringMode: SCORING_MODES.LENIENT }

    expect(parse({ ...HIGHLIGHT, options: lenient }).options).toEqual({
      scoringMode: SCORING_MODES.BALANCED,
    })
    expect(
      parse({
        ...HIGHLIGHT,
        answers: ["a", "b"],
        type: QUESTION_TYPES.MULTI,
        options: lenient,
      }).options,
    ).toEqual(lenient)
    expect(parse(HIGHLIGHT)).not.toHaveProperty("options")
  })

  it("needs a text", () => {
    expect(issuesOf({ ...HIGHLIGHT, text: undefined })).toEqual([
      "errors:quizz.highlightTextMissing",
    ])
    expect(issuesOf({ ...HIGHLIGHT, text: " " })).toEqual([
      "errors:quizz.highlightTextMissing",
    ])
    expect(isValid({ ...HIGHLIGHT, text: 42 })).toBe(false)
  })

  it("needs 2 to 5 passages", () => {
    expect(
      issuesOf({ ...HIGHLIGHT, text: "Un seul [passage].", solutions: [0] }),
    ).toEqual(["errors:quizz.highlightTooFewPassages"])

    const passages = (count: number) =>
      Array.from({ length: count }, (_, index) => `[mot ${index}]`).join(" ")

    expect(isValid({ ...HIGHLIGHT, text: passages(5) })).toBe(true)
    expect(issuesOf({ ...HIGHLIGHT, text: passages(6) })).toEqual([
      "errors:quizz.highlightTooManyPassages",
    ])
  })

  it("refuses brackets that do not pair and empty passages", () => {
    expect(
      issuesOf({ ...HIGHLIGHT, text: `${HIGHLIGHT.text} [en trop` }),
    ).toEqual(["errors:quizz.highlightBrackets"])
    expect(
      issuesOf({ ...HIGHLIGHT, text: `${HIGHLIGHT.text} en trop]` }),
    ).toEqual(["errors:quizz.highlightBrackets"])
    expect(issuesOf({ ...HIGHLIGHT, text: `${HIGHLIGHT.text} [ ]` })).toEqual([
      "errors:quizz.highlightPassageEmpty",
    ])
  })

  it("keeps the text and each passage short", () => {
    const filler = "a".repeat(HIGHLIGHT_LIMITS.TEXT_LENGTH)

    expect(
      issuesOf({ ...HIGHLIGHT, text: `${HIGHLIGHT.text} ${filler}` }),
    ).toEqual(["errors:quizz.highlightTextTooLong"])
    // Short once cleaned, but longer than a text is read raw.
    expect(
      issuesOf({
        ...HIGHLIGHT,
        text: `[a] [b]${" ".repeat(HIGHLIGHT_LIMITS.RAW_LENGTH)}`,
      }),
    ).toEqual(["errors:quizz.highlightTextTooLong"])
    expect(
      issuesOf({
        ...HIGHLIGHT,
        text: `[${"a".repeat(HIGHLIGHT_LIMITS.PASSAGE_LENGTH + 1)}] [b]`,
      }),
    ).toEqual(["errors:quizz.highlightPassageTooLong"])
    expect(
      isValid({
        ...HIGHLIGHT,
        text: `[${"a".repeat(HIGHLIGHT_LIMITS.PASSAGE_LENGTH)}] [b]`,
      }),
    ).toBe(true)
  })

  it("refuses two passages written the same, not two that differ", () => {
    expect(
      issuesOf({ ...HIGHLIGHT, text: "[la] maison et [la] voiture" }),
    ).toEqual(["errors:quizz.highlightPassageDuplicate"])
    expect(isValid({ ...HIGHLIGHT, text: "Il [a] mangé [à] midi" })).toBe(true)
  })

  it("needs a passage to spot, among the passages", () => {
    expect(issuesOf({ ...HIGHLIGHT, solutions: [] })).toEqual([
      "errors:quizz.highlightNoSolution",
    ])
    expect(issuesOf({ ...HIGHLIGHT, solutions: [0, 4] })).toEqual([
      "errors:quizz.highlightSolutionRange",
    ])
  })

  it("needs 5 seconds at least, or no limit", () => {
    expect(issuesOf({ ...HIGHLIGHT, time: 3 })).toEqual([
      "errors:quizz.timeTooShort",
    ])
    expect(isValid({ ...HIGHLIGHT, time: -1 })).toBe(true)
  })
})

describe("statements", () => {
  const STATEMENTS = {
    type: QUESTION_TYPES.STATEMENTS,
    question: "Vrai ou faux ?",
    answers: [
      "La MSA couvre les salariés agricoles",
      "La MSA verse les allocations chômage",
      "La MSA gère la retraite des exploitants",
    ],
    expectedTargets: [0, 1, 0],
    cooldown: 5,
    time: 30,
  }

  it("imposes Vrai and Faux, and keeps the right one of each apart", () => {
    const statements = parse({
      ...STATEMENTS,
      targets: ["Oui", "Non", "Peut-être"],
      solutions: [1],
      accepted: ["Vrai"],
      expected: 3,
      text: "[Vrai]",
    })

    expect(statements.targets).toEqual(["Vrai", "Faux"])
    expect(statements.expectedTargets).toEqual([0, 1, 0])
    expect(statements.answers).toEqual(STATEMENTS.answers)
    expect(statements.solutions).toEqual([])
    expect(statements).not.toHaveProperty("accepted")
    expect(statements).not.toHaveProperty("expected")
    expect(statements).not.toHaveProperty("text")
  })

  it("keeps its scoring and points tuning", () => {
    const statements = parse({
      ...STATEMENTS,
      options: { matchScoring: MATCH_SCORING.EXACT },
      maxPoints: 2000,
      penalty: 100,
      speedBonus: true,
    })

    expect(statements.options).toEqual({
      scoringMode: SCORING_MODES.BALANCED,
      matchScoring: MATCH_SCORING.EXACT,
    })
    expect(statements).toMatchObject({
      maxPoints: 2000,
      penalty: 100,
      speedBonus: true,
    })
    expect(isValid({ ...STATEMENTS, options: { matchScoring: "most" } })).toBe(
      false,
    )
  })

  it("takes 2 to 5 statements", () => {
    const items = ["Un", "Deux", "Trois", "Quatre", "Cinq", "Six"]
    const withItems = (count: number) => ({
      ...STATEMENTS,
      answers: items.slice(0, count),
      expectedTargets: Array.from({ length: count }, () => 0),
    })

    expect(issuesOf(withItems(1))).toEqual(["errors:quizz.statementsCount"])
    expect(isValid(withItems(ASSOCIATION_LIMITS.MAX_ITEMS))).toBe(true)
    expect(issuesOf(withItems(6))).toEqual(["errors:quizz.statementsCount"])
  })

  it("rejects a blank, too long or repeated statement", () => {
    expect(issuesOf({ ...STATEMENTS, answers: ["Un", " ", "Trois"] })).toEqual([
      "errors:quizz.answerEmpty",
    ])
    expect(
      issuesOf({
        ...STATEMENTS,
        answers: ["Un", "Deux", "x".repeat(ASSOCIATION_LIMITS.ITEM_LENGTH + 1)],
      }),
    ).toEqual(["errors:quizz.statementTooLong"])
    expect(
      issuesOf({ ...STATEMENTS, answers: ["Un", "Deux", "deux !"] }),
    ).toEqual(["errors:quizz.statementDuplicate"])
  })

  it("needs Vrai or Faux for every statement", () => {
    expect(issuesOf({ ...STATEMENTS, expectedTargets: [0, 1] })).toEqual([
      "errors:quizz.statementUnanswered",
    ])
    expect(issuesOf({ ...STATEMENTS, expectedTargets: [0, -1, 0] })).toEqual([
      "errors:quizz.statementUnanswered",
    ])
    expect(issuesOf({ ...STATEMENTS, expectedTargets: [0, 2, 0] })).toEqual([
      "errors:quizz.statementUnanswered",
    ])
    expect(issuesOf({ ...STATEMENTS, expectedTargets: undefined })).toEqual([
      "errors:quizz.statementUnanswered",
    ])
    expect(isValid({ ...STATEMENTS, expectedTargets: [0, 0.5, 0] })).toBe(false)
  })

  it("keeps one right target per statement", () => {
    expect(
      parse({ ...STATEMENTS, expectedTargets: [1, 1, 0, 1, 1] })
        .expectedTargets,
    ).toEqual([1, 1, 0])
  })

  it("needs 5 seconds at least, or no limit", () => {
    expect(issuesOf({ ...STATEMENTS, time: 3 })).toEqual([
      "errors:quizz.timeTooShort",
    ])
    expect(isValid({ ...STATEMENTS, time: -1 })).toBe(true)
  })
})

describe("categorize", () => {
  const CATEGORIZE = {
    type: QUESTION_TYPES.CATEGORIZE,
    question: "Quelle branche verse chaque prestation ?",
    answers: [
      "Allocations familiales",
      "Pension de retraite",
      "Indemnités journalières",
    ],
    targets: ["Famille", "Retraite", "Maladie"],
    expectedTargets: [0, 1, 2],
    cooldown: 5,
    time: 30,
  }

  it("keeps its categories, cleaned, and the right one of each item", () => {
    const categorize = parse({
      ...CATEGORIZE,
      targets: ["  Famille ", "Retraite", "Mala\u200Bdie"],
      solutions: [0],
    })

    expect(categorize.targets).toEqual(["Famille", "Retraite", "Maladie"])
    expect(categorize.expectedTargets).toEqual([0, 1, 2])
    expect(categorize.solutions).toEqual([])
  })

  it("takes 2 to 5 items", () => {
    expect(
      issuesOf({ ...CATEGORIZE, answers: ["Un"], expectedTargets: [0] }),
    ).toEqual(["errors:quizz.categorizeItemsCount"])
    expect(
      issuesOf({
        ...CATEGORIZE,
        answers: ["Un", "Deux", "Trois", "Quatre", "Cinq", "Six"],
        expectedTargets: [0, 0, 0, 0, 0, 0],
      }),
    ).toEqual(["errors:quizz.categorizeItemsCount"])
  })

  it("rejects a too long or repeated item", () => {
    expect(
      issuesOf({
        ...CATEGORIZE,
        answers: ["Un", "Deux", "x".repeat(ASSOCIATION_LIMITS.ITEM_LENGTH + 1)],
      }),
    ).toEqual(["errors:quizz.categorizeItemTooLong"])
    expect(
      issuesOf({ ...CATEGORIZE, answers: ["Un", "Deux", "DEUX"] }),
    ).toEqual(["errors:quizz.categorizeItemDuplicate"])
  })

  it("takes 2 to 4 categories, each short and told apart", () => {
    expect(
      issuesOf({
        ...CATEGORIZE,
        targets: ["Famille"],
        expectedTargets: [0, 0, 0],
      }),
    ).toEqual(["errors:quizz.categorizeTargetsCount"])
    expect(
      issuesOf({ ...CATEGORIZE, targets: ["A", "B", "C", "D", "E"] }),
    ).toEqual(["errors:quizz.categorizeTargetsCount"])
    expect(
      issuesOf({ ...CATEGORIZE, targets: ["Famille", " ", "Maladie"] }),
    ).toEqual(["errors:quizz.categorizeTargetEmpty"])
    expect(
      issuesOf({
        ...CATEGORIZE,
        targets: [
          "Famille",
          "x".repeat(ASSOCIATION_LIMITS.TARGET_LENGTH + 1),
          "Maladie",
        ],
      }),
    ).toEqual(["errors:quizz.categorizeTargetTooLong"])
    expect(
      issuesOf({ ...CATEGORIZE, targets: ["Famille", "Retraite", "famille"] }),
    ).toEqual(["errors:quizz.categorizeTargetDuplicate"])
    expect(issuesOf({ ...CATEGORIZE, targets: undefined })).toEqual([
      "errors:quizz.categorizeTargetsCount",
      "errors:quizz.categorizeUnsorted",
    ])
  })

  it("needs a category for every item", () => {
    expect(issuesOf({ ...CATEGORIZE, expectedTargets: [0, 3, 2] })).toEqual([
      "errors:quizz.categorizeUnsorted",
    ])
    expect(issuesOf({ ...CATEGORIZE, expectedTargets: [0, 1] })).toEqual([
      "errors:quizz.categorizeUnsorted",
    ])
  })
})
