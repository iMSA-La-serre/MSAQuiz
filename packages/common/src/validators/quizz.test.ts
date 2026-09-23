import {
  ASSOCIATION_LIMITS,
  EXAMPLE_QUIZZ,
  HIGHLIGHT_LIMITS,
  MATCH_SCORING,
  ORDER_SCORING,
  QUESTION_TYPES,
  SCORING_MODES,
} from "@razzia/common/constants"
import {
  quizzErrorOf,
  quizzSaveValidator,
  quizzValidator,
} from "@razzia/common/validators/quizz"
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

  // An author may edit it and save it again.
  it("passes the rules of a save", () => {
    expect(quizzSaveValidator.safeParse(EXAMPLE_QUIZZ).success).toBe(true)
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

describe("ranking", () => {
  const RANKING = {
    type: QUESTION_TYPES.RANKING,
    question: "Classez ces chantiers par priorité",
    answers: ["Accueil", "Délais", "Numérique"],
    cooldown: 5,
    time: 30,
  }

  it("keeps its proposals and nothing to score", () => {
    const ranking = parse({
      ...RANKING,
      solutions: [0],
      maxPoints: 2000,
      penalty: 100,
    })

    expect(ranking.answers).toEqual(["Accueil", "Délais", "Numérique"])
    expect(ranking.solutions).toEqual([])
    expect(ranking.maxPoints).toBeUndefined()
    expect(ranking.penalty).toBeUndefined()
  })

  it("takes 3 to 6 proposals", () => {
    expect(issuesOf({ ...RANKING, answers: ["A", "B"] })).toEqual([
      "errors:quizz.tooFewAnswers",
    ])
    expect(
      issuesOf({ ...RANKING, answers: ["A", "B", "C", "D", "E", "F", "G"] }),
    ).toEqual(["errors:quizz.tooManyAnswers"])
  })

  it("refuses two proposals a player could not tell apart", () => {
    expect(
      issuesOf({ ...RANKING, answers: ["Accueil", "ACCUEIL !", "Délais"] }),
    ).toEqual(["errors:quizz.orderItemDuplicate"])
  })

  it("refuses a proposal longer than an ordering item", () => {
    expect(
      issuesOf({ ...RANKING, answers: ["A".repeat(81), "B", "C"] }),
    ).toEqual(["errors:quizz.orderItemTooLong"])
  })

  it("needs 5 seconds at least, or no limit", () => {
    expect(issuesOf({ ...RANKING, time: 3 })).toEqual([
      "errors:quizz.timeTooShort",
    ])
    expect(isValid({ ...RANKING, time: -1 })).toBe(true)
  })
})

describe("scale", () => {
  const SCALE = {
    type: QUESTION_TYPES.SCALE,
    question: "Cette formation répond-elle à vos attentes ?",
    options: { scaleMin: 1, scaleMax: 5, scaleSkip: true },
    cooldown: 5,
    time: 20,
  }

  it("keeps its levels and nothing to score", () => {
    const scale = parse({
      ...SCALE,
      answers: ["1", "2"],
      solutions: [0],
      maxPoints: 2000,
      penalty: 100,
    })

    expect(scale.options?.scaleMin).toBe(1)
    expect(scale.options?.scaleMax).toBe(5)
    expect(scale.options?.scaleSkip).toBe(true)
    expect(scale.answers).toEqual([])
    expect(scale.solutions).toEqual([])
    expect(scale.maxPoints).toBeUndefined()
    expect(scale.penalty).toBeUndefined()
  })

  it("stores the end labels cleaned, and drops the empty ones", () => {
    const scale = parse({
      ...SCALE,
      options: {
        ...SCALE.options,
        scaleLow: "  Pas   du tout ",
        scaleHigh: " ",
      },
    })

    expect(scale.options?.scaleLow).toBe("Pas du tout")
    expect(scale.options).not.toHaveProperty("scaleHigh")
  })

  it("starts at 0 or at 1 and ends at 8 at the latest", () => {
    expect(isValid({ ...SCALE, options: { scaleMin: 0, scaleMax: 7 } })).toBe(
      true,
    )
    expect(
      issuesOf({ ...SCALE, options: { scaleMin: 2, scaleMax: 6 } }),
    ).toEqual(["errors:quizz.scaleStart"])
    // Past the last level, the count of levels is over too.
    expect(
      issuesOf({ ...SCALE, options: { scaleMin: 1, scaleMax: 9 } }),
    ).toEqual(["errors:quizz.scaleEnd", "errors:quizz.scaleLevels"])
  })

  it("counts 3 to 8 levels", () => {
    expect(
      issuesOf({ ...SCALE, options: { scaleMin: 1, scaleMax: 2 } }),
    ).toEqual(["errors:quizz.scaleLevels"])
    expect(isValid({ ...SCALE, options: { scaleMin: 1, scaleMax: 3 } })).toBe(
      true,
    )
  })

  it("refuses an end label longer than a category", () => {
    expect(
      issuesOf({
        ...SCALE,
        options: { ...SCALE.options, scaleLow: "A".repeat(25) },
      }),
    ).toEqual(["errors:quizz.scaleLabelTooLong"])
  })

  it("drops the levels of the other types", () => {
    const single = parse({ ...SINGLE_QUESTION, options: { scaleMax: 7 } })

    expect(single.options).not.toHaveProperty("scaleMax")
  })

  it("needs 5 seconds at least, or no limit", () => {
    expect(issuesOf({ ...SCALE, time: 3 })).toEqual([
      "errors:quizz.timeTooShort",
    ])
    expect(isValid({ ...SCALE, time: -1 })).toBe(true)
  })
})

describe("markers", () => {
  const MARKERS = {
    type: QUESTION_TYPES.MARKERS,
    question: "Où se trouve le point de rassemblement ?",
    media: { type: "image", url: "https://msa.example/plan.png" },
    answers: ["Le hangar", "La cour", "Le portail"],
    markers: [
      { x: 20, y: 30 },
      { x: 55, y: 60 },
      { x: 80, y: 15 },
    ],
    solutions: [1],
    cooldown: 5,
    time: 20,
  }

  it("keeps its labels, its markers and what it scores", () => {
    const markers = parse({ ...MARKERS, maxPoints: 1500, penalty: 100 })

    expect(markers.answers).toEqual(["Le hangar", "La cour", "Le portail"])
    expect(markers.markers).toEqual(MARKERS.markers)
    expect(markers.solutions).toEqual([1])
    expect(markers.maxPoints).toBe(1500)
    expect(markers.penalty).toBe(100)
  })

  it("stores every position as a whole percentage inside the image", () => {
    expect(
      parse({
        ...MARKERS,
        markers: [
          { x: 20.4, y: 30.6 },
          { x: 55, y: 60 },
          { x: 80, y: 15 },
        ],
      }).markers,
    ).toEqual([
      { x: 20, y: 31 },
      { x: 55, y: 60 },
      { x: 80, y: 15 },
    ])
  })

  it("needs an image to place the markers on", () => {
    const { media: _image, ...noImage } = MARKERS

    expect(issuesOf(noImage)).toEqual(["errors:quizz.markersImageMissing"])
    expect(
      issuesOf({
        ...MARKERS,
        media: { type: "video", url: "https://msa.example/film.mp4" },
      }),
    ).toEqual(["errors:quizz.markersImageMissing"])
  })

  it("counts 2 to 6 markers", () => {
    expect(
      issuesOf({
        ...MARKERS,
        answers: ["Le hangar"],
        markers: [{ x: 20, y: 30 }],
        solutions: [0],
      }),
    ).toEqual(["errors:quizz.markersCount"])
    expect(
      issuesOf({
        ...MARKERS,
        answers: ["A", "B", "C", "D", "E", "F", "G"],
        markers: Array.from({ length: 7 }, (_, index) => ({
          x: 10 + index * 10,
          y: 10,
        })),
      }),
    ).toEqual(["errors:quizz.markersCount"])
  })

  it("refuses a label longer than a row, or repeated", () => {
    expect(
      issuesOf({
        ...MARKERS,
        answers: ["A".repeat(41), "La cour", "Le portail"],
      }),
    ).toEqual(["errors:quizz.markerLabelTooLong"])
    expect(
      issuesOf({ ...MARKERS, answers: ["La cour", "la  cour", "Le portail"] }),
    ).toEqual(["errors:quizz.markerLabelDuplicate"])
  })

  it("refuses a marker missing or outside the image", () => {
    expect(
      issuesOf({ ...MARKERS, markers: MARKERS.markers.slice(0, 2) }),
    ).toEqual(["errors:quizz.markerPosition"])
    expect(
      issuesOf({
        ...MARKERS,
        markers: [
          { x: 20, y: 30 },
          { x: 101, y: 60 },
          { x: 80, y: 15 },
        ],
      }),
    ).toEqual(["errors:quizz.markerPosition"])
  })

  it("refuses two markers on the same spot, once rounded", () => {
    expect(
      issuesOf({
        ...MARKERS,
        markers: [
          { x: 20, y: 30 },
          { x: 55, y: 60 },
          { x: 20.3, y: 29.8 },
        ],
      }),
    ).toEqual(["errors:quizz.markerOverlap"])
    expect(
      isValid({
        ...MARKERS,
        markers: [
          { x: 20, y: 30 },
          { x: 21, y: 30 },
          { x: 80, y: 15 },
        ],
      }),
    ).toBe(true)
  })

  it("needs a right marker, which must exist", () => {
    expect(issuesOf({ ...MARKERS, solutions: [] })).toEqual([
      "errors:quizz.markersNoSolution",
    ])
    expect(issuesOf({ ...MARKERS, solutions: [3] })).toEqual([
      "errors:quizz.markersSolutionRange",
    ])
  })

  it("tells players when several markers are right, and only then", () => {
    expect(parse({ ...MARKERS, solutions: [2, 0, 2] })).toMatchObject({
      solutions: [0, 2],
      options: { multiple: true, scoringMode: SCORING_MODES.BALANCED },
    })
    expect(
      parse({ ...MARKERS, options: { multiple: true } }).options,
    ).not.toHaveProperty("multiple")
  })

  it("keeps the scoring mode chosen when a single marker is right again", () => {
    // It no longer changes anything, one right marker scoring 1 or 0 in every
    // mode, and is there again if a second marker is ticked.
    expect(
      parse({
        ...MARKERS,
        solutions: [0],
        options: { scoringMode: SCORING_MODES.STRICT, multiple: true },
      }).options,
    ).toEqual({ scoringMode: SCORING_MODES.STRICT })
  })

  it("drops the markers and the setting of the other types", () => {
    const single = parse({
      ...SINGLE_QUESTION,
      markers: [{ x: 20, y: 30 }],
      options: { multiple: true },
    })

    expect(single).not.toHaveProperty("markers")
    expect(single.options).not.toHaveProperty("multiple")
  })

  it("needs 5 seconds at least, or no limit", () => {
    expect(issuesOf({ ...MARKERS, time: 3 })).toEqual([
      "errors:quizz.timeTooShort",
    ])
    expect(isValid({ ...MARKERS, time: -1 })).toBe(true)
  })
})

describe("poll with several answers", () => {
  const POLL = { ...SINGLE_QUESTION, type: QUESTION_TYPES.POLL }

  it("keeps the setting of the author", () => {
    expect(parse({ ...POLL, options: { multiple: true } }).options).toEqual({
      scoringMode: SCORING_MODES.BALANCED,
      multiple: true,
    })
  })

  it("drops it when off, as before polls could take several", () => {
    expect(parse({ ...POLL, options: { multiple: false } }).options).toEqual({
      scoringMode: SCORING_MODES.BALANCED,
    })
    expect(parse(POLL)).not.toHaveProperty("options")
  })

  it("keeps the rules of a poll: no solutions, 2 to 4 answers", () => {
    const poll = parse({
      ...POLL,
      solutions: [0, 1],
      options: { multiple: true },
    })

    expect(poll.solutions).toEqual([])
    expect(
      issuesOf({ ...POLL, answers: ["A"], options: { multiple: true } }),
    ).toEqual(["errors:quizz.tooFewAnswers"])
  })

  it("drops the setting from a single or a multiple choice", () => {
    expect(
      parse({ ...SINGLE_QUESTION, options: { multiple: true } }).options,
    ).toEqual({ scoringMode: SCORING_MODES.BALANCED })
    expect(
      parse({
        ...SINGLE_QUESTION,
        type: QUESTION_TYPES.MULTI,
        options: { multiple: true },
      }).options,
    ).toEqual({ scoringMode: SCORING_MODES.BALANCED })
  })
})

describe("single choice with partial credits", () => {
  const CREDITED = {
    ...SINGLE_QUESTION,
    solutions: [1],
    options: { credits: [50, 100, 0, 25] },
  }

  it("keeps a credit per answer, a right answer earning 100", () => {
    expect(parse(CREDITED).options).toEqual({
      scoringMode: SCORING_MODES.BALANCED,
      credits: [50, 100, 0, 25],
    })
  })

  it("fills in the right answers and the missing credits, drops the extra ones", () => {
    expect(
      parse({ ...CREDITED, solutions: [1, 3], options: { credits: [75, 0] } })
        .options?.credits,
    ).toEqual([75, 100, 0, 100])
    expect(
      parse({ ...CREDITED, options: { credits: [25, 100, 0, 0, 50, 75] } })
        .options?.credits,
    ).toEqual([25, 100, 0, 0])
  })

  it("keeps credits that are all 0: the author turned partial credit on", () => {
    expect(
      parse({ ...CREDITED, options: { credits: [0, 100, 0, 0] } }).options
        ?.credits,
    ).toEqual([0, 100, 0, 0])
  })

  it("refuses a credit that is not a step, or a full one for a wrong answer", () => {
    expect(
      issuesOf({ ...CREDITED, options: { credits: [30, 100, 0, 0] } }),
    ).toEqual(["errors:quizz.creditStep"])
    expect(
      issuesOf({ ...CREDITED, options: { credits: [100, 100, 0, -25] } }),
    ).toEqual(["errors:quizz.creditStep", "errors:quizz.creditStep"])
    expect(isValid({ ...CREDITED, options: { credits: ["50"] } })).toBe(false)
  })

  it("leaves a single choice without credits as it was", () => {
    expect(parse(SINGLE_QUESTION)).not.toHaveProperty("options")
    expect(
      parse({ ...SINGLE_QUESTION, options: { scoringMode: "strict" } }).options,
    ).toEqual({ scoringMode: SCORING_MODES.STRICT })
  })

  it("drops the credits of the other types, unchecked", () => {
    for (const type of [
      QUESTION_TYPES.MULTI,
      QUESTION_TYPES.POLL,
      QUESTION_TYPES.MARKERS,
    ]) {
      expect(
        parse({
          ...SINGLE_QUESTION,
          type,
          ...(type === QUESTION_TYPES.MARKERS && {
            media: { type: "image", url: "https://example.org/plan.png" },
            markers: [
              { x: 10, y: 10 },
              { x: 30, y: 30 },
              { x: 50, y: 50 },
              { x: 70, y: 70 },
            ],
          }),
          options: { credits: [30, "x"] },
        }).options,
        type,
      ).not.toHaveProperty("credits")
    }
    expect(
      parse({
        ...SINGLE_QUESTION,
        type: QUESTION_TYPES.TRUEFALSE,
        answers: ["Vrai", "Faux"],
        options: { credits: [100, 50] },
      }).options,
    ).not.toHaveProperty("credits")
  })

  it("keeps the credits of a legacy question read as a single choice", () => {
    expect(
      parse({ ...LEGACY_QUESTION, options: { credits: [100, 50, 0, 0] } })
        .options?.credits,
    ).toEqual([100, 50, 0, 0])
  })
})

describe("media", () => {
  const save = (...questions: Array<Record<string, unknown>>) =>
    quizzSaveValidator.safeParse({ subject: "Quiz", questions })
  const saved = (question: Record<string, unknown>) => {
    const result = save(question)

    if (!result.success) {
      throw new Error(result.error.issues[0].message)
    }

    return result.data.questions[0]
  }
  const refusal = (...questions: Array<Record<string, unknown>>) => {
    const result = save(...questions)

    return result.success ? undefined : quizzErrorOf(result.error)
  }
  const withMedia = (media: unknown) => ({ ...SINGLE_QUESTION, media })
  const WINDOWS_PATH = String.raw`C:\Users\maman\Videos\jeu.mp4`

  it("drops a media whose address is empty, when read as when saved", () => {
    for (const media of [{ url: "" }, { type: "image", url: "   " }, null]) {
      expect(parse(withMedia(media))).not.toHaveProperty("media")
      expect(saved(withMedia(media))).not.toHaveProperty("media")
    }
  })

  it("keeps the address without the spaces around it", () => {
    expect(
      saved(withMedia({ type: "image", url: " https://msa.example/a.png " }))
        .media,
    ).toEqual({ type: "image", url: "https://msa.example/a.png" })
  })

  it("still reads a stored media the save now refuses", () => {
    for (const url of [
      WINDOWS_PATH,
      "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      "file:///C:/jeu.mp4",
    ]) {
      expect(parse(withMedia({ type: "video", url })).media?.url).toBe(url)
    }
    // No type, and an address that tells none: kept as it is.
    expect(
      parse(withMedia({ url: "https://msa.example/image?id=3" })).media,
    ).toEqual({ url: "https://msa.example/image?id=3" })
  })

  it("reads a media stored without a type as the type of its file", () => {
    // The editor once saved the address alone: the game showed nothing.
    expect(
      parse(withMedia({ url: "https://intranet.msa.fr/plan.png" })).media,
    ).toEqual({ type: "image", url: "https://intranet.msa.fr/plan.png" })
    expect(parse(withMedia({ url: "/media/film.mp4" })).media?.type).toBe(
      "video",
    )
    // A video site's page is not a file: no type, as before, never a player
    // with nothing to play.
    expect(
      parse(withMedia({ url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ" }))
        .media,
    ).toEqual({ url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ" })
  })

  it("reads and saves a path on the quiz's own server", () => {
    const media = { type: "video", url: "/media/film.mp4" }

    expect(parse(withMedia(media)).media).toEqual(media)
    expect(saved(withMedia(media)).media).toEqual(media)
  })

  it("names an unknown media type in French", () => {
    expect(
      issuesOf(withMedia({ type: "youtube", url: "https://a.fr/x" })),
    ).toEqual(["errors:quizz.invalidMediaType"])
  })

  it("fills in the type the address tells on save too", () => {
    expect(
      saved(withMedia({ url: "https://msa.example/plan.png" })).media,
    ).toEqual({ type: "image", url: "https://msa.example/plan.png" })
    expect(saved(withMedia({ url: "/media/son.mp3" })).media?.type).toBe(
      "audio",
    )
    // A type chosen by the author stays: the sound of a video file.
    expect(
      saved(withMedia({ type: "audio", url: "https://msa.example/clip.mp4" }))
        .media?.type,
    ).toBe("audio")
  })

  it("gives a markers question the image type its address tells", () => {
    expect(
      saved({
        type: QUESTION_TYPES.MARKERS,
        question: "Où ?",
        media: { url: "https://msa.example/plan.png" },
        answers: ["A", "B"],
        markers: [
          { x: 20, y: 20 },
          { x: 70, y: 70 },
        ],
        solutions: [0],
        cooldown: 5,
        time: 20,
      }).media?.type,
    ).toBe("image")
  })

  it("refuses on save what the screens cannot load, naming the question", () => {
    expect(
      refusal(SINGLE_QUESTION, withMedia({ type: "video", url: WINDOWS_PATH })),
    ).toEqual({ message: "errors:quizz.mediaUrlNotWeb", questionIndex: 1 })
    expect(
      refusal(
        withMedia({ type: "video", url: "https://youtu.be/aqz-KE-bpKQ" }),
      ),
    ).toEqual({ message: "errors:quizz.mediaPageLink", questionIndex: 0 })
    expect(
      refusal(
        withMedia({ url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ" }),
      ),
    ).toEqual({ message: "errors:quizz.mediaPageLink", questionIndex: 0 })
    expect(
      refusal(withMedia({ url: "https://msa.example/image?id=3" })),
    ).toEqual({ message: "errors:quizz.mediaTypeMissing", questionIndex: 0 })
    expect(
      refusal(
        withMedia({
          type: "image",
          url: `data:image/png;base64,${"A".repeat(700_000)}`,
        }),
      ),
    ).toEqual({ message: "errors:quizz.mediaDataTooLarge", questionIndex: 0 })
  })

  it("points a missing type at the type, the rest at the address", () => {
    const pathOf = (media: unknown) =>
      save(withMedia(media)).error?.issues.at(-1)?.path

    expect(pathOf({ url: "https://msa.example/x" })).toEqual([
      "questions",
      0,
      "media",
      "type",
    ])
    expect(pathOf({ type: "video", url: "file:///x.mp4" })).toEqual([
      "questions",
      0,
      "media",
      "url",
    ])
  })

  it("names the question of any refusal, not only a media's", () => {
    expect(
      refusal(SINGLE_QUESTION, { ...SINGLE_QUESTION, question: "" }),
    ).toEqual({ message: "errors:quizz.questionEmpty", questionIndex: 1 })

    const noSubject = quizzSaveValidator.safeParse({
      subject: "",
      questions: [SINGLE_QUESTION],
    })

    expect(noSubject.success).toBe(false)
    expect(noSubject.error && quizzErrorOf(noSubject.error)).toEqual({
      message: "errors:quizz.subjectEmpty",
    })
  })

  it("saves valid media as they are read", () => {
    const quizz = {
      subject: "Quiz",
      questions: [
        withMedia({ type: "image", url: "https://msa.example/a.png" }),
        withMedia({ type: "video", url: "https://msa.example/film.mp4" }),
        withMedia({ type: "audio", url: "https://msa.example/son.mp3" }),
      ],
    }

    expect(quizzSaveValidator.parse(quizz)).toEqual(quizzValidator.parse(quizz))
  })
})
