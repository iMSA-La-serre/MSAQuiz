import {
  MATCH_SCORING,
  QUESTION_TYPES,
  SCORING_MODES,
} from "@razzia/common/constants"
import type {
  GameResult,
  PlayerAnswerRecord,
  QuestionResult,
} from "@razzia/common/types/game"
import {
  aggregateQuestions,
  overallSuccessRate,
} from "@razzia/socket/services/stats"
import { describe, expect, it } from "vitest"

const answers = (
  ...records: Array<[string, number[] | null]>
): PlayerAnswerRecord[] =>
  records.map(([playerName, answerIds]) => ({ playerName, answerIds }))

const question = (over: Partial<QuestionResult> = {}): QuestionResult => ({
  type: QUESTION_TYPES.SINGLE,
  question: "Capitale de la France ?",
  answers: ["Paris", "Lyon", "Marseille", "Nice"],
  solutions: [0],
  cooldown: 5,
  time: 20,
  playerAnswers: [],
  ...over,
})

const game = (
  questions: QuestionResult[],
  date = "2026-09-01",
): GameResult => ({
  id: `game-${date}`,
  subject: "Quiz",
  date,
  players: [],
  questions,
})

describe("aggregateQuestions", () => {
  it("merges the same question across games", () => {
    const stats = aggregateQuestions([
      game([question({ playerAnswers: answers(["Alex", [0]]) })], "2026-09-02"),
      game([question({ playerAnswers: answers(["Bea", [1]]) })], "2026-09-01"),
    ])

    expect(stats).toHaveLength(1)
    expect(stats[0]).toMatchObject({
      gameCount: 2,
      answerCount: 2,
      correctCount: 1,
      missingCount: 0,
      successRate: 0.5,
    })
  })

  it("counts players who did not answer apart from the rate", () => {
    const stats = aggregateQuestions([
      game([
        question({
          playerAnswers: answers(["Alex", [0]], ["Bea", null], ["Cyd", []]),
        }),
      ]),
    ])

    expect(stats[0]).toMatchObject({
      answerCount: 1,
      missingCount: 2,
      correctCount: 1,
      successRate: 1,
    })
  })

  it("scores a multi question with its own mode", () => {
    const stats = aggregateQuestions([
      game([
        question({
          type: QUESTION_TYPES.MULTI,
          question: "Couleurs primaires ?",
          solutions: [0, 2],
          options: { scoringMode: SCORING_MODES.STRICT },
          // Exact set, partial set, wrong set: only the first one counts.
          playerAnswers: answers(
            ["Alex", [0, 2]],
            ["Bea", [0]],
            ["Cyd", [1, 3]],
          ),
        }),
      ]),
    ])

    expect(stats[0]).toMatchObject({ answerCount: 3, correctCount: 1 })
    expect(stats[0].successRate).toBeCloseTo(1 / 3)
  })

  it("leaves a poll unrated but keeps its distribution", () => {
    const stats = aggregateQuestions([
      game([
        question({
          type: QUESTION_TYPES.POLL,
          question: "Quel créneau ?",
          answers: ["Matin", "Soir"],
          solutions: [],
          playerAnswers: answers(["Alex", [1]], ["Bea", [1]], ["Cyd", [0]]),
        }),
      ]),
    ])

    expect(stats[0]).toMatchObject({
      scored: false,
      successRate: null,
      correctCount: 0,
      answerCount: 3,
    })
    expect(stats[0].answers).toEqual([
      { label: "Soir", count: 2 },
      { label: "Matin", count: 1 },
    ])
  })

  it("reports the wording of the correct answers", () => {
    const stats = aggregateQuestions([
      game([question({ playerAnswers: answers(["Alex", [1]]) })]),
    ])

    expect(stats[0].solutionLabels).toEqual(["Paris"])
    // The expected answer stays listed even though nobody picked it.
    expect(stats[0].answers).toEqual([
      { label: "Paris", count: 0 },
      { label: "Lyon", count: 1 },
    ])
  })

  it("puts the hardest questions first and the unrated ones last", () => {
    const stats = aggregateQuestions([
      game([
        question({
          question: "Facile",
          playerAnswers: answers(["Alex", [0]], ["Bea", [0]]),
        }),
        question({
          question: "Difficile",
          playerAnswers: answers(["Alex", [1]], ["Bea", [0]]),
        }),
        question({
          type: QUESTION_TYPES.POLL,
          question: "Sondage",
          solutions: [],
          playerAnswers: answers(["Alex", [0]]),
        }),
      ]),
    ])

    expect(stats.map((s) => s.question)).toEqual([
      "Difficile",
      "Facile",
      "Sondage",
    ])
  })
})

describe("overallSuccessRate", () => {
  it("averages over the answers given to scored questions", () => {
    const stats = aggregateQuestions([
      game([
        question({
          question: "Facile",
          playerAnswers: answers(["Alex", [0]], ["Bea", [0]]),
        }),
        question({
          question: "Difficile",
          playerAnswers: answers(["Alex", [1]], ["Bea", [1]]),
        }),
      ]),
    ])

    expect(overallSuccessRate(stats)).toBe(0.5)
  })

  it("has nothing to average when no scored question was answered", () => {
    const stats = aggregateQuestions([
      game([
        question({
          type: QUESTION_TYPES.POLL,
          solutions: [],
          playerAnswers: answers(["Alex", [0]]),
        }),
      ]),
    ])

    expect(overallSuccessRate(stats)).toBeNull()
  })
})

describe("aggregateQuestions, saved multipliers", () => {
  it("reads the existing types the same with or without a saved score", () => {
    const multi = (withScore: boolean) =>
      question({
        type: QUESTION_TYPES.MULTI,
        question: "Couleurs primaires ?",
        solutions: [0, 2],
        options: { scoringMode: SCORING_MODES.BALANCED },
        playerAnswers: [
          { playerName: "Alex", answerIds: [0, 2] },
          { playerName: "Bea", answerIds: [0] },
          { playerName: "Cyd", answerIds: [1, 3] },
          { playerName: "Dan", answerIds: null },
        ].map((record, index) =>
          withScore ? { ...record, score: [1, 0.5, 0, 0][index] } : record,
        ),
      })

    expect(aggregateQuestions([game([multi(true)])])).toStrictEqual(
      aggregateQuestions([game([multi(false)])]),
    )
  })
})

describe("aggregateQuestions, ordering", () => {
  const ordering = (withScore: boolean) =>
    question({
      type: QUESTION_TYPES.ORDERING,
      question: "Dans l'ordre ?",
      answers: ["Un", "Deux", "Trois"],
      solutions: [],
      playerAnswers: [
        { playerName: "Alex", answerIds: [0, 1, 2], score: 1 },
        { playerName: "Bea", answerIds: [0, 2, 1], score: 1 / 3 },
        { playerName: "Cyd", answerIds: [2, 1, 0], score: 1 / 3 },
        { playerName: "Dan", answerIds: null, score: 0 },
      ].map(({ score, ...record }) =>
        withScore ? { ...record, score } : record,
      ),
    })

  it("reports each item placed, the exact orders and the mean score", () => {
    const [stats] = aggregateQuestions([game([ordering(true)])])

    expect(stats).toMatchObject({
      type: QUESTION_TYPES.ORDERING,
      scored: true,
      answerCount: 3,
      missingCount: 1,
      correctCount: 1,
      solutionLabels: [],
      answers: [
        { label: "Un", count: 2 },
        { label: "Deux", count: 2 },
        { label: "Trois", count: 1 },
      ],
    })
    expect(stats.successRate).toBeCloseTo(1 / 3)
    expect(stats.averageScore).toBeCloseTo(5 / 9)
  })

  it("scores the order again when no multiplier was saved", () => {
    expect(aggregateQuestions([game([ordering(false)])])).toEqual(
      aggregateQuestions([game([ordering(true)])]),
    )
  })
})

describe("aggregateQuestions, highlight", () => {
  const highlight = (withScore: boolean) =>
    question({
      type: QUESTION_TYPES.HIGHLIGHT,
      question: "Repérez les délais",
      text: "[Un] [Deux] [Trois] [Quatre] [Cinq]",
      answers: ["Un", "Deux", "Trois", "Quatre", "Cinq"],
      solutions: [0, 4],
      options: { scoringMode: SCORING_MODES.BALANCED },
      playerAnswers: [
        { playerName: "Alex", answerIds: [0, 4], score: 1 },
        { playerName: "Bea", answerIds: [4], score: 0.5 },
        { playerName: "Cyd", answerIds: [1], score: 0 },
        { playerName: "Dan", answerIds: null, score: 0 },
      ].map(({ score, ...record }) =>
        withScore ? { ...record, score } : record,
      ),
    })

  it("lists every passage, counts full credit only and the mean score", () => {
    const [stats] = aggregateQuestions([game([highlight(true)])])

    expect(stats).toMatchObject({
      type: QUESTION_TYPES.HIGHLIGHT,
      scored: true,
      answerCount: 3,
      missingCount: 1,
      correctCount: 1,
      solutionLabels: ["Un", "Cinq"],
      answers: [
        { label: "Un", count: 1 },
        { label: "Deux", count: 1 },
        { label: "Trois", count: 0 },
        { label: "Quatre", count: 0 },
        { label: "Cinq", count: 2 },
      ],
    })
    expect(stats.successRate).toBeCloseTo(1 / 3)
    expect(stats.averageScore).toBeCloseTo(0.5)
  })

  it("scores the passages again when no multiplier was saved", () => {
    expect(aggregateQuestions([game([highlight(false)])])).toEqual(
      aggregateQuestions([game([highlight(true)])]),
    )
  })

  it("scores a lenient highlight as balanced: every passage is not flawless", () => {
    const [stats] = aggregateQuestions([
      game([
        question({
          ...highlight(false),
          options: { scoringMode: SCORING_MODES.LENIENT },
          playerAnswers: answers(["Alex", [0, 1, 2, 3, 4]], ["Bea", [0, 4]]),
        }),
      ]),
    ])

    expect(stats).toMatchObject({ answerCount: 2, correctCount: 1 })
    expect(stats.averageScore).toBeCloseTo(0.5)
  })

  it("keeps a highlight apart from a multi of the same wording", () => {
    const multi = question({
      type: QUESTION_TYPES.MULTI,
      question: "Repérez les délais",
      answers: ["Un", "Deux"],
      solutions: [0],
      playerAnswers: answers(["Alex", [0]]),
    })

    expect(
      aggregateQuestions([game([highlight(true), multi])]).map(
        ({ type }) => type,
      ),
    ).toEqual(
      expect.arrayContaining([QUESTION_TYPES.HIGHLIGHT, QUESTION_TYPES.MULTI]),
    )
  })
})

describe("aggregateQuestions, statements and categorize", () => {
  const categorize = (withScore: boolean) =>
    question({
      type: QUESTION_TYPES.CATEGORIZE,
      question: "Quelle branche verse chaque prestation ?",
      answers: ["Allocations familiales", "Pension", "Indemnités journalières"],
      solutions: [],
      targets: ["Famille", "Retraite", "Maladie"],
      expectedTargets: [0, 1, 2],
      playerAnswers: [
        { playerName: "Alex", answerIds: [0, 1, 2], score: 1 },
        { playerName: "Bea", answerIds: [0, 2, 2], score: 2 / 3 },
        { playerName: "Cyd", answerIds: [1, 0, 0], score: 0 },
        { playerName: "Dan", answerIds: null, score: 0 },
      ].map(({ score, ...record }) =>
        withScore ? { ...record, score } : record,
      ),
    })

  it("lists every item with its right target, and the mean score", () => {
    const [stats] = aggregateQuestions([game([categorize(true)])])

    expect(stats).toMatchObject({
      type: QUESTION_TYPES.CATEGORIZE,
      scored: true,
      answerCount: 3,
      missingCount: 1,
      correctCount: 1,
      solutionLabels: ["Famille", "Retraite", "Maladie"],
      answers: [
        { label: "Allocations familiales", count: 2 },
        { label: "Pension", count: 1 },
        { label: "Indemnités journalières", count: 2 },
      ],
    })
    expect(stats.successRate).toBeCloseTo(1 / 3)
    expect(stats.averageScore).toBeCloseTo(5 / 9)
  })

  it("scores the items again when no multiplier was saved", () => {
    expect(aggregateQuestions([game([categorize(false)])])).toEqual(
      aggregateQuestions([game([categorize(true)])]),
    )
  })

  it("names Vrai and Faux the targets of statements", () => {
    const [stats] = aggregateQuestions([
      game([
        question({
          type: QUESTION_TYPES.STATEMENTS,
          question: "Vrai ou faux ?",
          answers: ["Un", "Deux"],
          solutions: [],
          targets: ["Vrai", "Faux"],
          expectedTargets: [1, 0],
          options: {
            scoringMode: SCORING_MODES.BALANCED,
            matchScoring: MATCH_SCORING.EXACT,
          },
          playerAnswers: answers(["Alex", [1, 0]], ["Bea", [1, 1]]),
        }),
      ]),
    ])

    expect(stats).toMatchObject({
      solutionLabels: ["Faux", "Vrai"],
      answers: [
        { label: "Un", count: 2 },
        { label: "Deux", count: 1 },
      ],
      correctCount: 1,
      averageScore: 0.5,
    })
  })

  it("leaves an item without a right target blank, never the last one", () => {
    const [stats] = aggregateQuestions([
      game([
        question({
          ...categorize(true),
          // Saved before the targets were recorded, or short of one.
          expectedTargets: [0],
        }),
      ]),
    ])

    expect(stats.solutionLabels).toEqual(["Famille", "", ""])
  })

  it("keeps statements apart from categorize of the same wording", () => {
    const statements = question({
      ...categorize(true),
      type: QUESTION_TYPES.STATEMENTS,
      targets: ["Vrai", "Faux"],
      expectedTargets: [0, 0, 0],
    })

    expect(
      aggregateQuestions([game([categorize(true), statements])]).map(
        ({ type }) => type,
      ),
    ).toEqual(
      expect.arrayContaining([
        QUESTION_TYPES.CATEGORIZE,
        QUESTION_TYPES.STATEMENTS,
      ]),
    )
  })
})

describe("aggregateQuestions, shortanswer", () => {
  it("counts the inputs per accepted answer and the unrecognized ones", () => {
    const [stats] = aggregateQuestions([
      game([
        question({
          type: QUESTION_TYPES.SHORTANSWER,
          question: "Ancien nom de Paris ?",
          answers: [],
          solutions: [],
          accepted: ["Lutèce", "Lutetia"],
          playerAnswers: [
            { playerName: "Alex", answerIds: [0], text: "lutece", score: 1 },
            { playerName: "Bea", answerIds: [], text: "Paname", score: 0 },
            { playerName: "Cyd", answerIds: [1], text: "Lutetia", score: 1 },
            { playerName: "Dan", answerIds: null, text: null, score: 0 },
            { playerName: "Eve", answerIds: [0], text: "Lutece", score: 1 },
          ],
        }),
      ]),
    ])

    expect(stats).toEqual({
      question: "Ancien nom de Paris ?",
      type: QUESTION_TYPES.SHORTANSWER,
      scored: true,
      gameCount: 1,
      answerCount: 4,
      missingCount: 1,
      correctCount: 3,
      successRate: 0.75,
      answers: [
        { label: "Lutèce", count: 2 },
        { label: "Lutetia", count: 1 },
      ],
      solutionLabels: ["Lutèce", "Lutetia"],
      unrecognizedCount: 1,
    })
  })
})

describe("aggregateQuestions, a wording reused under another type", () => {
  it("keeps a shortanswer apart from a choice question", () => {
    const stats = aggregateQuestions([
      game(
        [
          question({
            type: QUESTION_TYPES.SHORTANSWER,
            question: "Capitale de l'Australie ?",
            answers: [],
            solutions: [],
            accepted: ["Canberra"],
            playerAnswers: [
              { playerName: "Alex", answerIds: [0], text: "canberra" },
              { playerName: "Bea", answerIds: [], text: "Sydney" },
            ],
          }),
        ],
        "2026-09-02",
      ),
      game(
        [
          question({
            question: "Capitale de l'Australie ?",
            answers: ["Sydney", "Canberra", "Melbourne", "Perth"],
            solutions: [1],
            playerAnswers: answers(["Cyd", [0]], ["Dan", [2]]),
          }),
        ],
        "2026-09-01",
      ),
    ])

    expect(stats).toHaveLength(2)
    expect(stats.find((s) => s.type === QUESTION_TYPES.SHORTANSWER)).toEqual({
      question: "Capitale de l'Australie ?",
      type: QUESTION_TYPES.SHORTANSWER,
      scored: true,
      gameCount: 1,
      answerCount: 2,
      missingCount: 0,
      correctCount: 1,
      successRate: 0.5,
      answers: [{ label: "Canberra", count: 1 }],
      solutionLabels: ["Canberra"],
      unrecognizedCount: 1,
    })
    expect(stats.find((s) => s.type === QUESTION_TYPES.SINGLE)).toMatchObject({
      gameCount: 1,
      answerCount: 2,
      correctCount: 0,
      answers: [
        { label: "Canberra", count: 0 },
        { label: "Sydney", count: 1 },
        { label: "Melbourne", count: 1 },
      ],
    })
  })

  it("keeps an ordering apart from a choice question", () => {
    const [ordering, single] = [QUESTION_TYPES.ORDERING, QUESTION_TYPES.SINGLE]
    const stats = aggregateQuestions([
      game(
        [
          question({
            type: ordering,
            question: "Ordre ?",
            answers: ["A", "B", "C"],
            solutions: [],
            playerAnswers: [
              { playerName: "Alex", answerIds: [0, 1, 2], score: 1 },
              { playerName: "Bea", answerIds: [0, 1, 2], score: 1 },
            ],
          }),
        ],
        "2026-09-02",
      ),
      game(
        [
          question({
            question: "Ordre ?",
            answers: ["A", "B", "C"],
            solutions: [0],
            playerAnswers: answers(["Cyd", [0]], ["Dan", [0]]),
          }),
        ],
        "2026-09-01",
      ),
    ])

    expect(stats.find((s) => s.type === ordering)).toMatchObject({
      answerCount: 2,
      correctCount: 2,
      successRate: 1,
      averageScore: 1,
      answers: [
        { label: "A", count: 2 },
        { label: "B", count: 2 },
        { label: "C", count: 2 },
      ],
    })
    expect(stats.find((s) => s.type === single)).toMatchObject({
      answerCount: 2,
      correctCount: 2,
    })
  })

  it("still merges the choice types under the same wording", () => {
    const stats = aggregateQuestions([
      game([
        question({
          type: QUESTION_TYPES.MULTI,
          solutions: [0, 1],
          playerAnswers: answers(["Alex", [0, 1]]),
        }),
      ]),
      game([question({ playerAnswers: answers(["Bea", [0]]) })]),
    ])

    expect(stats).toHaveLength(1)
    expect(stats[0]).toMatchObject({
      type: QUESTION_TYPES.MULTI,
      gameCount: 2,
      answerCount: 2,
    })
  })
})

describe("aggregateQuestions, unknown types", () => {
  it("leaves out a type it does not know", () => {
    const stats = aggregateQuestions([
      game([
        question({
          type: "buzzer" as QuestionResult["type"],
          question: "Buzzer ?",
          playerAnswers: answers(["Alex", [0]]),
        }),
        question({ playerAnswers: answers(["Alex", [0]]) }),
      ]),
    ])

    expect(stats.map((s) => s.question)).toEqual(["Capitale de la France ?"])
    expect(overallSuccessRate(stats)).toBe(1)
  })
})

describe("aggregateQuestions, wordcloud", () => {
  const wordcloud = (over: Partial<QuestionResult>): QuestionResult =>
    question({
      type: QUESTION_TYPES.WORDCLOUD,
      question: "Un mot pour la MSA ?",
      answers: [],
      solutions: [],
      ...over,
    })

  it("counts who answered and the words of every game, never per player", () => {
    const [stats] = aggregateQuestions([
      game(
        [
          wordcloud({
            playerAnswers: [
              { playerName: "Alex", answerIds: [], answered: true, score: 0 },
              { playerName: "Bea", answerIds: [], answered: true, score: 0 },
              { playerName: "Cyd", answerIds: null, answered: false, score: 0 },
            ],
            words: [
              { text: "Écoute", count: 2 },
              { text: "Terrain", count: 2 },
            ],
          }),
        ],
        "2026-09-02",
      ),
      game([
        wordcloud({
          playerAnswers: [
            { playerName: "Dan", answerIds: [], answered: true, score: 0 },
          ],
          words: [
            { text: "écoute", count: 1 },
            { text: "Proximité", count: 1 },
          ],
        }),
      ]),
    ])

    expect(stats).toEqual({
      question: "Un mot pour la MSA ?",
      type: QUESTION_TYPES.WORDCLOUD,
      scored: false,
      gameCount: 2,
      answerCount: 3,
      missingCount: 1,
      correctCount: 0,
      successRate: null,
      answers: [
        { label: "Écoute", count: 3 },
        { label: "Terrain", count: 2 },
        { label: "Proximité", count: 1 },
      ],
      solutionLabels: [],
    })
  })

  it("says when no game kept its words, too few players having typed any", () => {
    const withheld = wordcloud({
      playerAnswers: [
        { playerName: "Alex", answerIds: [], answered: true, score: 0 },
      ],
      wordsWithheld: true,
    })

    const [alone] = aggregateQuestions([game([withheld])])

    expect(alone).toMatchObject({ answerCount: 1, wordsWithheld: true })
    expect(alone.answers).toEqual([])

    // Another game kept its words: they are listed, with no flag.
    const [mixed] = aggregateQuestions([
      game([withheld]),
      game([
        wordcloud({
          playerAnswers: [
            { playerName: "Bea", answerIds: [], answered: true, score: 0 },
          ],
          words: [{ text: "Écoute", count: 3 }],
        }),
      ]),
    ])

    expect(mixed.answers).toEqual([{ label: "Écoute", count: 3 }])
    expect(mixed).not.toHaveProperty("wordsWithheld")
  })

  it("keeps a word cloud apart from a poll with the same wording", () => {
    const stats = aggregateQuestions([
      game([
        wordcloud({
          question: "Votre avis ?",
          playerAnswers: [
            { playerName: "Alex", answerIds: [], answered: true, score: 0 },
          ],
          words: [{ text: "Utile", count: 1 }],
        }),
        question({
          type: QUESTION_TYPES.POLL,
          question: "Votre avis ?",
          answers: ["Utile", "Inutile"],
          solutions: [],
          playerAnswers: answers(["Alex", [0]]),
        }),
      ]),
    ])

    expect(stats.map(({ type }) => type).sort()).toEqual([
      QUESTION_TYPES.POLL,
      QUESTION_TYPES.WORDCLOUD,
    ])
  })

  it("skips words edited by hand into something else", () => {
    const [stats] = aggregateQuestions([
      game([
        wordcloud({
          words: [
            { text: "Écoute", count: 1 },
            { text: 3, count: 1 },
            null,
            { text: "Terrain", count: "2" },
          ] as unknown as QuestionResult["words"],
        }),
      ]),
    ])

    expect(stats.answers).toEqual([{ label: "Écoute", count: 1 }])
  })
})

describe("aggregateQuestions, estimate", () => {
  const estimate = (over: Partial<QuestionResult>): QuestionResult =>
    question({
      type: QUESTION_TYPES.ESTIMATE,
      question: "Combien de caisses compte la MSA ?",
      answers: [],
      solutions: [],
      expected: 35,
      options: { tolerance: 2, unit: "caisses" },
      ...over,
    })

  it("counts each value against the tolerance of its game, and the median", () => {
    const [stats] = aggregateQuestions([
      game(
        [
          estimate({
            playerAnswers: [
              { playerName: "Alex", answerIds: [], value: 35, score: 1 },
              { playerName: "Bea", answerIds: [], value: 30, score: 0 },
              { playerName: "Cyd", answerIds: null, value: null, score: 0 },
            ],
          }),
        ],
        "2026-09-02",
      ),
      // An older game, before the right value was corrected: 36 was right.
      game(
        [
          estimate({
            expected: 40,
            options: { tolerance: 5 },
            playerAnswers: [
              { playerName: "Dan", answerIds: [], value: 36, score: 1 },
              { playerName: "Eve", answerIds: [], value: 50 },
            ],
          }),
        ],
        "2026-09-01",
      ),
    ])

    expect(stats).toEqual({
      question: "Combien de caisses compte la MSA ?",
      type: QUESTION_TYPES.ESTIMATE,
      scored: true,
      gameCount: 2,
      answerCount: 4,
      missingCount: 1,
      correctCount: 2,
      successRate: 0.5,
      answers: [],
      solutionLabels: [],
      estimate: {
        below: 1,
        within: 2,
        above: 1,
        median: 35.5,
        expected: 35,
        options: { tolerance: 2, unit: "caisses" },
      },
    })
  })

  it("scores a value again when no multiplier was saved", () => {
    const [stats] = aggregateQuestions([
      game([
        estimate({
          playerAnswers: [{ playerName: "Alex", answerIds: [], value: 37 }],
        }),
      ]),
    ])

    expect(stats.correctCount).toBe(1)
  })

  it("keeps an estimate apart from a choice question with the same wording", () => {
    const stats = aggregateQuestions([
      game([
        estimate({
          playerAnswers: [{ playerName: "Alex", answerIds: [], value: 35 }],
        }),
        question({
          question: "Combien de caisses compte la MSA ?",
          answers: ["35", "50"],
          playerAnswers: answers(["Bea", [0]]),
        }),
      ]),
    ])

    expect(stats.map(({ type }) => type).sort()).toEqual([
      QUESTION_TYPES.ESTIMATE,
      QUESTION_TYPES.SINGLE,
    ])
  })
})

describe("aggregateQuestions, ranking", () => {
  const ranking = (over: Partial<QuestionResult>): QuestionResult =>
    question({
      type: QUESTION_TYPES.RANKING,
      question: "Classez ces chantiers",
      answers: ["Accueil", "Délais", "Numérique"],
      solutions: [],
      ...over,
    })

  it("lists the proposals in the order of the rank points of every game", () => {
    const [stats] = aggregateQuestions([
      game(
        [
          ranking({
            playerAnswers: answers(
              ["Alex", [1, 0, 2]],
              ["Bea", [1, 2, 0]],
              ["Cyd", null],
            ),
          }),
        ],
        "2026-09-02",
      ),
      game([ranking({ playerAnswers: answers(["Dan", [0, 1, 2]]) })]),
    ])

    expect(stats).toMatchObject({
      type: QUESTION_TYPES.RANKING,
      scored: false,
      gameCount: 2,
      answerCount: 3,
      missingCount: 1,
      successRate: null,
      // Délais: 4 + 1 points, Accueil: 1 + 2, Numérique: 1 + 0.
      answers: [
        { label: "Délais", count: 2 },
        { label: "Accueil", count: 1 },
        { label: "Numérique", count: 0 },
      ],
    })
  })

  it("keeps the author's order when nobody ranked the proposals", () => {
    const [stats] = aggregateQuestions([
      game([ranking({ playerAnswers: answers(["Alex", null]) })]),
    ])

    expect(stats.answers.map(({ label }) => label)).toEqual([
      "Accueil",
      "Délais",
      "Numérique",
    ])
  })
})

describe("aggregateQuestions, scale", () => {
  const scale = (over: Partial<QuestionResult>): QuestionResult =>
    question({
      type: QUESTION_TYPES.SCALE,
      question: "Cette journée répond-elle à vos attentes ?",
      answers: [],
      solutions: [],
      options: { scaleMin: 1, scaleMax: 5, scaleLow: "Pas du tout" },
      ...over,
    })

  const record = (playerName: string, answered: boolean): PlayerAnswerRecord =>
    answered
      ? { playerName, answerIds: [], answered: true, score: 0 }
      : { playerName, answerIds: null, answered: false, score: 0 }

  it("counts the levels of every game, never per player", () => {
    const [stats] = aggregateQuestions([
      game(
        [
          scale({
            playerAnswers: [
              record("Alex", true),
              record("Bea", true),
              record("Cyd", false),
            ],
            scale: { counts: [0, 0, 0, 1, 1], skipped: 0 },
          }),
        ],
        "2026-09-02",
      ),
      game([
        scale({
          playerAnswers: [record("Dan", true), record("Eve", true)],
          scale: { counts: [1, 0, 0, 0, 0], skipped: 1 },
        }),
      ]),
    ])

    expect(stats).toMatchObject({
      type: QUESTION_TYPES.SCALE,
      scored: false,
      gameCount: 2,
      answerCount: 4,
      missingCount: 1,
      successRate: null,
      answers: [
        { label: "1", count: 1 },
        { label: "2", count: 0 },
        { label: "3", count: 0 },
        { label: "4", count: 1 },
        { label: "5", count: 1 },
      ],
      scale: {
        min: 1,
        max: 5,
        low: "Pas du tout",
        skipped: 1,
        mean: 10 / 3,
        median: 4,
      },
    })
  })

  it("widens the list when a game was played on another scale", () => {
    const [stats] = aggregateQuestions([
      game(
        [
          scale({
            options: { scaleMin: 1, scaleMax: 3 },
            playerAnswers: [record("Alex", true)],
            scale: { counts: [0, 0, 1], skipped: 0 },
          }),
        ],
        "2026-09-02",
      ),
      game([
        scale({
          options: { scaleMin: 0, scaleMax: 7 },
          playerAnswers: [record("Bea", true)],
          scale: { counts: [0, 0, 0, 0, 0, 0, 0, 1], skipped: 0 },
        }),
      ]),
    ])

    expect(stats.answers).toHaveLength(8)
    expect(stats.scale).toMatchObject({ min: 0, max: 7, median: 5 })
  })

  it("says so when no game kept its counts", () => {
    const [stats] = aggregateQuestions([
      game([
        scale({
          playerAnswers: [record("Alex", true), record("Bea", true)],
          scaleWithheld: true,
        }),
      ]),
    ])

    expect(stats.scale?.withheld).toBe(true)
    expect(stats.answers.every(({ count }) => count === 0)).toBe(true)
    expect(stats.answerCount).toBe(2)
  })
})

describe("aggregateQuestions, markers", () => {
  const markers = (over: Partial<QuestionResult> = {}): QuestionResult =>
    question({
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
      ...over,
    })

  it("lists every marker with the players who tapped it", () => {
    const [stats] = aggregateQuestions([
      game([
        markers({
          playerAnswers: answers(
            ["Alex", [1]],
            ["Bea", [2]],
            ["Cyd", [1]],
            ["Dan", null],
          ),
        }),
      ]),
    ])

    expect(stats).toMatchObject({
      type: QUESTION_TYPES.MARKERS,
      scored: true,
      answerCount: 3,
      missingCount: 1,
      correctCount: 2,
      successRate: 2 / 3,
      answers: [
        { label: "Le hangar", count: 0 },
        { label: "La cour", count: 2 },
        { label: "Le portail", count: 1 },
      ],
      solutionLabels: ["La cour"],
    })
  })

  it("keeps its own row under a wording a choice question also uses", () => {
    const stats = aggregateQuestions([
      game([
        markers({ playerAnswers: answers(["Alex", [1]]) }),
        question({
          question: "Où se trouve le point de rassemblement ?",
          answers: ["Le hangar", "La cour", "Le portail"],
          playerAnswers: answers(["Bea", [1]]),
        }),
      ]),
    ])

    expect(stats).toHaveLength(2)
    expect(stats.map(({ type }) => type)).toContain(QUESTION_TYPES.MARKERS)
  })
})

describe("aggregateQuestions, single choice with partial credits", () => {
  const credited = (over: Partial<QuestionResult> = {}): QuestionResult =>
    question({
      options: {
        scoringMode: SCORING_MODES.BALANCED,
        credits: [100, 50, 0, 0],
      },
      ...over,
    })

  it("counts full credit only as correct, and gives the mean score", () => {
    const [stats] = aggregateQuestions([
      game([
        credited({
          playerAnswers: [
            { playerName: "Alex", answerIds: [0], score: 1 },
            { playerName: "Bea", answerIds: [1], score: 0.5 },
            { playerName: "Cyd", answerIds: [2], score: 0 },
            { playerName: "Dan", answerIds: null, score: 0 },
          ],
        }),
      ]),
    ])

    expect(stats).toMatchObject({
      answerCount: 3,
      missingCount: 1,
      correctCount: 1,
      successRate: 1 / 3,
      averageScore: 0.5,
      credits: [{ label: "Lyon", credit: 50 }],
      solutionLabels: ["Paris"],
    })
  })

  it("lists the partly right answers even when nobody picked them", () => {
    const [stats] = aggregateQuestions([
      game([
        credited({
          playerAnswers: [{ playerName: "Alex", answerIds: [0], score: 1 }],
        }),
      ]),
    ])

    expect(stats.answers).toEqual([
      { label: "Paris", count: 1 },
      { label: "Lyon", count: 0 },
    ])
  })

  it("scores an answer again when no multiplier was saved", () => {
    const [stats] = aggregateQuestions([
      game([credited({ playerAnswers: answers(["Alex", [1]], ["Bea", [3]]) })]),
    ])

    expect(stats).toMatchObject({ correctCount: 0, averageScore: 0.25 })
  })

  it("keeps a single choice without partial credit as it was", () => {
    const [stats] = aggregateQuestions([
      game([
        credited({
          options: {
            scoringMode: SCORING_MODES.BALANCED,
            credits: [100, 0, 0, 0],
          },
          playerAnswers: answers(["Alex", [0]], ["Bea", [1]]),
        }),
      ]),
    ])

    expect(stats).not.toHaveProperty("averageScore")
    expect(stats).not.toHaveProperty("credits")
    expect(stats.answers).toEqual([
      { label: "Paris", count: 1 },
      { label: "Lyon", count: 1 },
    ])
  })
})

describe("aggregateQuestions, poll with several answers", () => {
  it("counts every answer ticked, out of the players who answered", () => {
    const [stats] = aggregateQuestions([
      game([
        question({
          type: QUESTION_TYPES.POLL,
          solutions: [],
          options: { scoringMode: SCORING_MODES.BALANCED, multiple: true },
          playerAnswers: answers(["Alex", [0, 1]], ["Bea", [1]], ["Cyd", null]),
        }),
      ]),
    ])

    expect(stats).toMatchObject({
      scored: false,
      answerCount: 2,
      missingCount: 1,
      successRate: null,
      answers: [
        { label: "Paris", count: 1 },
        { label: "Lyon", count: 2 },
      ],
    })
  })
})
