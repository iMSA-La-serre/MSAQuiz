import { EXAMPLE_QUIZZ } from "@razzia/common/constants"
import { quizzValidator } from "@razzia/common/validators/quizz"
import { describe, expect, it } from "vitest"

// Frozen output of the validator for the question types that existed before
// ordering and shortanswer: quizzes already stored must keep parsing to the
// exact same data, key for key (undefined keys included).

// The example of docs/quiz.md, verbatim.
const DOCS_EXAMPLE = {
  subject: "Example Quiz",
  questions: [
    {
      type: "single",
      question: "What is the correct answer?",
      answers: ["No", "Yes", "No", "No"],
      solutions: [1],
      cooldown: 5,
      time: 15,
    },
    {
      type: "multi",
      question: "Which of these are primary colors?",
      answers: ["Red", "Green", "Blue", "Yellow"],
      solutions: [0, 2, 3],
      options: { scoringMode: "balanced" },
      cooldown: 5,
      time: 20,
      maxPoints: 1500,
      penalty: 200,
    },
    {
      type: "truefalse",
      question: "Paris est la capitale de la France.",
      answers: ["Vrai", "Faux"],
      solutions: [0],
      cooldown: 3,
      time: 15,
    },
    {
      type: "poll",
      question: "Which session time suits you best?",
      answers: ["Morning", "Noon", "Afternoon", "Evening"],
      cooldown: 3,
      time: 20,
    },
    {
      type: "slide",
      question: "Next section: safety rules",
      media: { type: "image", url: "https://placehold.co/600x400.png" },
      cooldown: 3,
      time: 15,
    },
  ],
}

const BASE = {
  question: "Quelle est la bonne réponse ?",
  answers: ["A", "B", "C", "D"],
  solutions: [0],
  cooldown: 5,
  time: 20,
}

const parseOne = (question: Record<string, unknown>) =>
  quizzValidator.parse({ subject: "Quiz", questions: [question] }).questions[0]

const issuesOf = (question: Record<string, unknown>) =>
  quizzValidator
    .safeParse({ subject: "Quiz", questions: [question] })
    .error?.issues.map((issue) => issue.message)

describe("validator output of the existing types", () => {
  it("keeps the docs example as is", () => {
    expect(quizzValidator.parse(DOCS_EXAMPLE)).toMatchInlineSnapshot(`
      {
        "questions": [
          {
            "answers": [
              "No",
              "Yes",
              "No",
              "No",
            ],
            "cooldown": 5,
            "question": "What is the correct answer?",
            "solutions": [
              1,
            ],
            "time": 15,
            "type": "single",
          },
          {
            "answers": [
              "Red",
              "Green",
              "Blue",
              "Yellow",
            ],
            "cooldown": 5,
            "maxPoints": 1500,
            "options": {
              "scoringMode": "balanced",
            },
            "penalty": 200,
            "question": "Which of these are primary colors?",
            "solutions": [
              0,
              2,
              3,
            ],
            "time": 20,
            "type": "multi",
          },
          {
            "answers": [
              "Vrai",
              "Faux",
            ],
            "cooldown": 3,
            "question": "Paris est la capitale de la France.",
            "solutions": [
              0,
            ],
            "time": 15,
            "type": "truefalse",
          },
          {
            "answers": [
              "Morning",
              "Noon",
              "Afternoon",
              "Evening",
            ],
            "cooldown": 3,
            "maxPoints": undefined,
            "penalty": undefined,
            "question": "Which session time suits you best?",
            "solutions": [],
            "time": 20,
            "type": "poll",
          },
          {
            "answers": [],
            "cooldown": 3,
            "maxPoints": undefined,
            "media": {
              "type": "image",
              "url": "https://placehold.co/600x400.png",
            },
            "penalty": undefined,
            "question": "Next section: safety rules",
            "solutions": [],
            "time": 15,
            "type": "slide",
          },
        ],
        "subject": "Example Quiz",
      }
    `)
  })

  it("keeps the seeded example quiz as is", () => {
    expect(quizzValidator.parse(EXAMPLE_QUIZZ)).toMatchInlineSnapshot(`
      {
        "questions": [
          {
            "answers": [
              "8 secondes",
              "8 minutes",
              "8 heures",
              "8 jours",
            ],
            "cooldown": 5,
            "question": "Combien de temps met la lumière du Soleil pour atteindre la Terre ?",
            "solutions": [
              1,
            ],
            "time": 20,
            "type": "single",
          },
          {
            "answers": [
              "Vrai",
              "Faux",
            ],
            "cooldown": 5,
            "question": "D'un point de vue botanique, la tomate est un fruit.",
            "solutions": [
              0,
            ],
            "time": 15,
            "type": "truefalse",
          },
          {
            "answers": [
              "Jupiter",
              "Mars",
              "Saturne",
              "Vénus",
            ],
            "cooldown": 5,
            "options": {
              "scoringMode": "balanced",
            },
            "question": "Lesquelles de ces planètes sont des géantes gazeuses ?",
            "solutions": [
              0,
              2,
            ],
            "time": 20,
            "type": "multi",
          },
          {
            "answers": [
              "En équipe",
              "En solo",
              "Les deux",
            ],
            "cooldown": 5,
            "maxPoints": undefined,
            "penalty": undefined,
            "question": "Quel format préférez-vous pour les prochains quiz ?",
            "solutions": [],
            "time": 15,
            "type": "poll",
          },
        ],
        "subject": "Quiz d'exemple",
      }
    `)
  })

  it("infers the type of a legacy question", () => {
    expect(parseOne(BASE)).toMatchInlineSnapshot(`
      {
        "answers": [
          "A",
          "B",
          "C",
          "D",
        ],
        "cooldown": 5,
        "question": "Quelle est la bonne réponse ?",
        "solutions": [
          0,
        ],
        "time": 20,
        "type": "single",
      }
    `)
    expect(parseOne({ ...BASE, solutions: [0, 2] })).toMatchInlineSnapshot(`
      {
        "answers": [
          "A",
          "B",
          "C",
          "D",
        ],
        "cooldown": 5,
        "question": "Quelle est la bonne réponse ?",
        "solutions": [
          0,
          2,
        ],
        "time": 20,
        "type": "multi",
      }
    `)
  })

  it("wraps a scalar solution", () => {
    expect(parseOne({ ...BASE, type: "single", solutions: 3 }))
      .toMatchInlineSnapshot(`
      {
        "answers": [
          "A",
          "B",
          "C",
          "D",
        ],
        "cooldown": 5,
        "question": "Quelle est la bonne réponse ?",
        "solutions": [
          3,
        ],
        "time": 20,
        "type": "single",
      }
    `)
  })

  it("strips the scoring fields of a poll and the answers of a slide", () => {
    expect(
      parseOne({
        ...BASE,
        type: "poll",
        maxPoints: 1500,
        penalty: 200,
        options: { scoringMode: "strict" },
      }),
    ).toMatchInlineSnapshot(`
      {
        "answers": [
          "A",
          "B",
          "C",
          "D",
        ],
        "cooldown": 5,
        "maxPoints": undefined,
        "options": {
          "scoringMode": "strict",
        },
        "penalty": undefined,
        "question": "Quelle est la bonne réponse ?",
        "solutions": [],
        "time": 20,
        "type": "poll",
      }
    `)
    expect(parseOne({ ...BASE, type: "slide", maxPoints: 10 }))
      .toMatchInlineSnapshot(`
      {
        "answers": [],
        "cooldown": 5,
        "maxPoints": undefined,
        "penalty": undefined,
        "question": "Quelle est la bonne réponse ?",
        "solutions": [],
        "time": 20,
        "type": "slide",
      }
    `)
  })

  it("fills in the scoring mode of any type given options", () => {
    expect(parseOne({ ...BASE, type: "multi", solutions: [0, 1], options: {} }))
      .toMatchInlineSnapshot(`
      {
        "answers": [
          "A",
          "B",
          "C",
          "D",
        ],
        "cooldown": 5,
        "options": {
          "scoringMode": "balanced",
        },
        "question": "Quelle est la bonne réponse ?",
        "solutions": [
          0,
          1,
        ],
        "time": 20,
        "type": "multi",
      }
    `)
    expect(
      parseOne({ ...BASE, type: "single", options: { scoringMode: "strict" } }),
    ).toMatchInlineSnapshot(`
      {
        "answers": [
          "A",
          "B",
          "C",
          "D",
        ],
        "cooldown": 5,
        "options": {
          "scoringMode": "strict",
        },
        "question": "Quelle est la bonne réponse ?",
        "solutions": [
          0,
        ],
        "time": 20,
        "type": "single",
      }
    `)
  })

  it("keeps no time limit", () => {
    expect(parseOne({ ...BASE, type: "single", time: -1 }))
      .toMatchInlineSnapshot(`
      {
        "answers": [
          "A",
          "B",
          "C",
          "D",
        ],
        "cooldown": 5,
        "question": "Quelle est la bonne réponse ?",
        "solutions": [
          0,
        ],
        "time": -1,
        "type": "single",
      }
    `)
  })

  it("drops unknown keys", () => {
    expect(parseOne({ ...BASE, type: "single", color: "red", accepted: ["A"] }))
      .toMatchInlineSnapshot(`
      {
        "answers": [
          "A",
          "B",
          "C",
          "D",
        ],
        "cooldown": 5,
        "question": "Quelle est la bonne réponse ?",
        "solutions": [
          0,
        ],
        "time": 20,
        "type": "single",
      }
    `)
  })
})

describe("validator errors of the existing types", () => {
  it("reports the same error keys", () => {
    expect({
      oneAnswer: issuesOf({ ...BASE, type: "single", answers: ["A"] }),
      fiveAnswers: issuesOf({
        ...BASE,
        type: "single",
        answers: ["A", "B", "C", "D", "E"],
      }),
      emptyAnswer: issuesOf({ ...BASE, type: "multi", answers: ["A", ""] }),
      noSolution: issuesOf({ ...BASE, type: "single", solutions: [] }),
      trueFalseThree: issuesOf({
        ...BASE,
        type: "truefalse",
        answers: ["Vrai", "Faux", "Peut-être"],
      }),
      trueFalseOne: issuesOf({ ...BASE, type: "truefalse", answers: ["Vrai"] }),
      pollOneAnswer: issuesOf({
        ...BASE,
        type: "poll",
        answers: ["A"],
        solutions: [],
      }),
      emptyQuestion: issuesOf({ ...BASE, type: "single", question: "" }),
      badTime: issuesOf({ ...BASE, type: "single", time: -2 }),
      badCooldown: issuesOf({ ...BASE, type: "single", cooldown: 20 }),
      badMedia: issuesOf({ ...BASE, media: { url: "nope" } }),
    }).toMatchInlineSnapshot(`
      {
        "badCooldown": [
          "Too big: expected number to be <=15",
        ],
        "badMedia": [
          "errors:quizz.invalidMediaUrl",
        ],
        "badTime": [
          "Too small: expected number to be >=-1",
        ],
        "emptyAnswer": [
          "errors:quizz.answerEmpty",
        ],
        "emptyQuestion": [
          "errors:quizz.questionEmpty",
        ],
        "fiveAnswers": [
          "errors:quizz.tooManyAnswers",
        ],
        "noSolution": [
          "errors:quizz.noSolutions",
        ],
        "oneAnswer": [
          "errors:quizz.tooFewAnswers",
        ],
        "pollOneAnswer": [
          "errors:quizz.tooFewAnswers",
        ],
        "trueFalseOne": [
          "errors:quizz.tooFewAnswers",
          "errors:quizz.fixedAnswers",
        ],
        "trueFalseThree": [
          "errors:quizz.fixedAnswers",
        ],
      }
    `)
  })
})
