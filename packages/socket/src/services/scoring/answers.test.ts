import { QUESTION_TYPES } from "@razzia/common/constants"
import type { Question, QuestionType } from "@razzia/common/types/game"
import { buildBlocklist } from "@razzia/common/utils/moderation"
import {
  answerParser,
  countResponses,
  parseAnswer,
  parseAnswerIds,
} from "@razzia/socket/services/scoring/answers"
import { describe, expect, it } from "vitest"

const question = (type: QuestionType, answers = ["A", "B", "C", "D"]) =>
  ({
    type,
    question: "Quelle est la bonne réponse ?",
    answers,
    solutions: [0, 1],
    cooldown: 5,
    time: 20,
  }) satisfies Question

describe("parseAnswerIds", () => {
  it("keeps what a regular client sends", () => {
    expect(parseAnswerIds(question(QUESTION_TYPES.SINGLE), [2])).toEqual([2])
    expect(parseAnswerIds(question(QUESTION_TYPES.MULTI), [0, 3])).toEqual([
      0, 3,
    ])
    expect(parseAnswerIds(question(QUESTION_TYPES.POLL), [1])).toEqual([1])
    expect(
      parseAnswerIds(question(QUESTION_TYPES.TRUEFALSE, ["Vrai", "Faux"]), [1]),
    ).toEqual([1])
  })

  it("drops repeated ids, which the scoring would credit once per copy", () => {
    expect(
      parseAnswerIds(question(QUESTION_TYPES.MULTI), [0, 0, 0, 0, 1, 1]),
    ).toEqual([0, 1])
    expect(parseAnswerIds(question(QUESTION_TYPES.SINGLE), [2, 2])).toEqual([2])
  })

  it("refuses ids outside the answers of the question", () => {
    expect(parseAnswerIds(question(QUESTION_TYPES.MULTI), [0, 4])).toBeNull()
    expect(parseAnswerIds(question(QUESTION_TYPES.SINGLE), [-1])).toBeNull()
    expect(
      parseAnswerIds(question(QUESTION_TYPES.TRUEFALSE, ["Vrai", "Faux"]), [2]),
    ).toBeNull()
  })

  it("refuses ids that are not integers", () => {
    expect(parseAnswerIds(question(QUESTION_TYPES.SINGLE), [1.5])).toBeNull()
    expect(parseAnswerIds(question(QUESTION_TYPES.SINGLE), ["1"])).toBeNull()
    expect(parseAnswerIds(question(QUESTION_TYPES.SINGLE), [null])).toBeNull()
  })

  it("refuses an empty answer or something that is not a list", () => {
    expect(parseAnswerIds(question(QUESTION_TYPES.MULTI), [])).toBeNull()
    expect(parseAnswerIds(question(QUESTION_TYPES.SINGLE), 1)).toBeNull()
    expect(
      parseAnswerIds(question(QUESTION_TYPES.SINGLE), undefined),
    ).toBeNull()
  })

  it("refuses several picks on a single-answer question", () => {
    expect(parseAnswerIds(question(QUESTION_TYPES.SINGLE), [0, 1])).toBeNull()
    expect(parseAnswerIds(question(QUESTION_TYPES.POLL), [0, 1])).toBeNull()
    expect(
      parseAnswerIds(
        question(QUESTION_TYPES.TRUEFALSE, ["Vrai", "Faux"]),
        [0, 1],
      ),
    ).toBeNull()
  })
})

describe("parseAnswer, choice types", () => {
  const identity = [0, 1, 2, 3]

  it("keeps the rules of parseAnswerIds", () => {
    expect(
      parseAnswer(
        question(QUESTION_TYPES.MULTI),
        { answerKeys: [0, 0, 3] },
        identity,
      ),
    ).toEqual({ answerIds: [0, 3] })
    expect(
      parseAnswer(
        question(QUESTION_TYPES.SINGLE),
        { answerKeys: [4] },
        identity,
      ),
    ).toBeNull()
  })

  it("refuses a text", () => {
    expect(
      parseAnswer(question(QUESTION_TYPES.SINGLE), { text: "A" }, identity),
    ).toBeNull()
  })
})

describe("parseAnswer, ordering", () => {
  const ordering = question(QUESTION_TYPES.ORDERING, ["Un", "Deux", "Trois"])
  // The players saw "Trois", "Un", "Deux".
  const publicOrder = [2, 0, 1]
  const parse = (payload: unknown) =>
    parseAnswer(ordering, payload, publicOrder)

  it("maps the indices of the shown list back to the original items", () => {
    // Tapped "Un", "Deux", "Trois": the correct order.
    expect(parse({ answerKeys: [1, 2, 0] })).toEqual({ answerIds: [0, 1, 2] })
    // Kept the shown order.
    expect(parse({ answerKeys: [0, 1, 2] })).toEqual({ answerIds: [2, 0, 1] })
  })

  it("refuses anything but a permutation of the shown list", () => {
    // A repeated index is refused, not dropped.
    expect(parse({ answerKeys: [0, 0, 1] })).toBeNull()
    expect(parse({ answerKeys: [0, 1] })).toBeNull()
    expect(parse({ answerKeys: [0, 1, 2, 3] })).toBeNull()
    expect(parse({ answerKeys: [0, 1, 3] })).toBeNull()
    expect(parse({ answerKeys: [0, 1, 1.5] })).toBeNull()
    expect(parse({ answerKeys: [0, 1, -1] })).toBeNull()
    expect(parse({ answerKeys: "012" })).toBeNull()
    expect(parse({ text: "Un Deux Trois" })).toBeNull()
    expect(parse(null)).toBeNull()
  })
})

describe("parseAnswer, shortanswer", () => {
  const shortanswer = (typoTolerance?: boolean): Question => ({
    ...question(QUESTION_TYPES.SHORTANSWER, []),
    solutions: [],
    accepted: ["Paris", "Lutèce"],
    ...(typoTolerance !== undefined && { options: { typoTolerance } }),
  })

  it("recognizes an accepted answer and keeps the cleaned input", () => {
    expect(parseAnswer(shortanswer(), { text: "  LUTECE  " }, [])).toEqual({
      answerIds: [1],
      text: "LUTECE",
    })
  })

  it("keeps an input that matches nothing, without answer id", () => {
    expect(parseAnswer(shortanswer(), { text: "Lyon" }, [])).toEqual({
      answerIds: [],
      text: "Lyon",
    })
  })

  it("ignores accents and punctuation, but not a typo by default", () => {
    expect(parseAnswer(shortanswer(), { text: "Lutece!" }, [])).toEqual({
      answerIds: [1],
      text: "Lutece!",
    })
    expect(
      parseAnswer(shortanswer(), { text: "Lutèc" }, [])?.answerIds,
    ).toEqual([])
  })

  it("refuses an empty or too long input", () => {
    expect(parseAnswer(shortanswer(), { text: "   " }, [])).toBeNull()
    expect(parseAnswer(shortanswer(), { text: "a".repeat(61) }, [])).toBeNull()
    expect(
      parseAnswer(shortanswer(), { text: ` ${"a".repeat(60)} ` }, []),
    ).toEqual({ answerIds: [], text: "a".repeat(60) })
  })

  it("refuses indices or a missing text", () => {
    expect(parseAnswer(shortanswer(), { answerKeys: [0] }, [])).toBeNull()
    expect(parseAnswer(shortanswer(), { text: 42 }, [])).toBeNull()
  })

  it("uses the typo tolerance of the question", () => {
    const longer: Question = {
      ...shortanswer(true),
      accepted: ["Versailles"],
    }

    expect(parseAnswer(longer, { text: "Versaille" }, [])?.answerIds).toEqual([
      0,
    ])
    expect(
      parseAnswer(
        { ...longer, options: { typoTolerance: false } },
        { text: "Versaille" },
        [],
      )?.answerIds,
    ).toEqual([])
  })
})

describe("parseAnswer, highlight", () => {
  const highlight: Question = {
    ...question(QUESTION_TYPES.HIGHLIGHT, ["sous 48 heures", "par courrier"]),
    text: "Prévenez [sous 48 heures], [par courrier].",
  }

  it("keeps the passages tapped, several at once", () => {
    expect(parseAnswer(highlight, { answerKeys: [1, 0, 1] }, [0, 1])).toEqual({
      answerIds: [1, 0],
    })
  })

  it("refuses an empty pick, an unknown passage, or a text", () => {
    expect(parseAnswer(highlight, { answerKeys: [] }, [0, 1])).toBeNull()
    expect(parseAnswer(highlight, { answerKeys: [2] }, [0, 1])).toBeNull()
    expect(parseAnswer(highlight, { text: "courrier" }, [0, 1])).toBeNull()
  })

  it("counts the players who tapped each passage", () => {
    expect(
      countResponses(highlight, [{ answerIds: [0, 1] }, { answerIds: [1] }]),
    ).toEqual({ 0: 1, 1: 2 })
  })
})

describe("parseAnswer, estimate", () => {
  const estimate: Question = {
    ...question(QUESTION_TYPES.ESTIMATE, []),
    solutions: [],
    expected: 35,
    options: { decimals: 1, min: 0, max: 100 },
  }

  it("reads the number as the phone does, and no answer id", () => {
    expect(parseAnswer(estimate, { text: " 42,5 " }, [])).toEqual({
      answerIds: [],
      value: 42.5,
    })
    expect(parseAnswer(estimate, { text: "100.0" }, [])).toEqual({
      answerIds: [],
      value: 100,
    })
  })

  it("refuses what the phone would not send", () => {
    for (const text of ["", "abc", "4,25", "-1", "100,1", "1e2"]) {
      expect(parseAnswer(estimate, { text }, []), text).toBeNull()
    }
  })

  it("refuses indices, texts or a number that is not a text", () => {
    expect(parseAnswer(estimate, { answerKeys: [0] }, [])).toBeNull()
    expect(parseAnswer(estimate, { texts: ["42"] }, [])).toBeNull()
    expect(parseAnswer(estimate, { text: 42 }, [])).toBeNull()
  })

  it("counts no response by index", () => {
    expect(countResponses(estimate, [{ answerIds: [], value: 42 }])).toEqual({})
  })
})

describe("parseAnswer, wordcloud", () => {
  const wordcloud = (wordCount?: number) =>
    ({
      ...question(QUESTION_TYPES.WORDCLOUD, []),
      solutions: [],
      ...(wordCount !== undefined && { options: { wordCount } }),
    }) satisfies Question

  it("keeps the cleaned words, and no answer id", () => {
    expect(
      parseAnswer(
        wordcloud(3),
        { texts: ["  Écoute ", "Proximité​", "Terrain"] },
        [],
      ),
    ).toEqual({ answerIds: [], texts: ["Écoute", "Proximité", "Terrain"] })
  })

  it("takes as many words as the question has fields, 1 by default", () => {
    expect(parseAnswer(wordcloud(), { texts: ["Écoute"] }, [])).not.toBeNull()
    expect(parseAnswer(wordcloud(), { texts: ["Écoute", "Terrain"] }, [])).toBe(
      null,
    )
    expect(
      parseAnswer(wordcloud(2), { texts: ["Écoute", "Terrain"] }, []),
    ).not.toBeNull()
    expect(
      parseAnswer(wordcloud(3), { texts: ["a", "b", "c", "d"] }, []),
    ).toBeNull()
  })

  it("refuses an empty, blank or too long word, or no word at all", () => {
    expect(parseAnswer(wordcloud(2), { texts: [] }, [])).toBeNull()
    expect(parseAnswer(wordcloud(2), { texts: ["Écoute", " "] }, [])).toBeNull()
    expect(
      parseAnswer(wordcloud(), { texts: ["m".repeat(30)] }, []),
    ).not.toBeNull()
    expect(parseAnswer(wordcloud(), { texts: ["m".repeat(31)] }, [])).toBeNull()
  })

  it("refuses anything but a list of texts", () => {
    expect(parseAnswer(wordcloud(), { text: "Écoute" }, [])).toBeNull()
    expect(parseAnswer(wordcloud(), { answerKeys: [0] }, [])).toBeNull()
    expect(parseAnswer(wordcloud(), { texts: "Écoute" }, [])).toBeNull()
    expect(parseAnswer(wordcloud(2), { texts: ["Écoute", 3] }, [])).toBeNull()
  })

  it("drops a word the player already gave, once normalized", () => {
    expect(
      parseAnswer(
        wordcloud(3),
        { texts: ["Écoute", "ECOUTE !", "Terrain"] },
        [],
      )?.texts,
    ).toEqual(["Écoute", "Terrain"])
  })

  it("drops a moderated word or one with nothing to compare, silently", () => {
    expect(
      parseAnswer(
        wordcloud(3),
        { texts: ["Merde", "Écoute", "06 12 34 56 78"] },
        [],
      ),
    ).toEqual({ answerIds: [], texts: ["Écoute"] })
    expect(
      parseAnswer(wordcloud(2), { texts: ["connard", "???"] }, []),
    ).toEqual({ answerIds: [], texts: [] })
  })

  it("uses the blocklist it is given", () => {
    const parse = answerParser(buildBlocklist(["patate"]))

    expect(
      parse(wordcloud(2), { texts: ["Patate", "Écoute"] }, [])?.texts,
    ).toEqual(["Écoute"])
    expect(parse(wordcloud(2), { texts: ["Merde"] }, [])?.texts).toEqual([])
    expect(parseAnswer(wordcloud(2), { texts: ["Patate"] }, [])?.texts).toEqual(
      ["Patate"],
    )
  })

  it("counts no response by index", () => {
    expect(
      countResponses(wordcloud(2), [
        { answerIds: [], texts: ["Écoute"] },
        { answerIds: [], texts: [] },
      ]),
    ).toEqual({})
  })
})

describe("countResponses", () => {
  it("counts the votes per answer of a choice question", () => {
    expect(
      countResponses(question(QUESTION_TYPES.MULTI), [
        { answerIds: [0, 2] },
        { answerIds: [0] },
      ]),
    ).toEqual({ 0: 2, 2: 1 })
  })

  it("counts the players who put each item at its place", () => {
    expect(
      countResponses(
        question(QUESTION_TYPES.ORDERING, ["Un", "Deux", "Trois"]),
        [
          { answerIds: [0, 1, 2] },
          { answerIds: [0, 2, 1] },
          { answerIds: [2, 1, 0] },
        ],
      ),
    ).toEqual({ 0: 2, 1: 2, 2: 1 })
  })

  it("counts the inputs recognized per accepted answer", () => {
    expect(
      countResponses(question(QUESTION_TYPES.SHORTANSWER, []), [
        { answerIds: [1], text: "Lutèce" },
        { answerIds: [], text: "Lyon" },
        { answerIds: [1], text: "lutece" },
      ]),
    ).toEqual({ 1: 2 })
  })
})

describe("parseAnswer, statements and categorize", () => {
  const statements: Question = {
    ...question(QUESTION_TYPES.STATEMENTS, ["Un", "Deux", "Trois"]),
    solutions: [],
    targets: ["Vrai", "Faux"],
    expectedTargets: [0, 1, 0],
  }
  const categorize: Question = {
    ...question(QUESTION_TYPES.CATEGORIZE, ["Un", "Deux"]),
    solutions: [],
    targets: ["Famille", "Retraite", "Maladie"],
    expectedTargets: [2, 0],
  }

  it("keeps a target per item, repeats included", () => {
    expect(parseAnswer(statements, { answerKeys: [0, 0, 1] }, [])).toEqual({
      answerIds: [0, 0, 1],
    })
    expect(parseAnswer(categorize, { answerKeys: [2, 2] }, [])).toEqual({
      answerIds: [2, 2],
    })
  })

  it("reads Vrai and Faux as the targets of statements, whatever is stored", () => {
    expect(
      parseAnswer(
        { ...statements, targets: ["Vrai", "Faux", "Autre"] },
        { answerKeys: [2, 0, 1] },
        [],
      ),
    ).toBeNull()
  })

  it("refuses an item left out, one too many, or an unknown target", () => {
    expect(parseAnswer(statements, { answerKeys: [0, 1] }, [])).toBeNull()
    expect(parseAnswer(statements, { answerKeys: [0, 1, 0, 1] }, [])).toBeNull()
    expect(parseAnswer(statements, { answerKeys: [0, 2, 0] }, [])).toBeNull()
    expect(parseAnswer(statements, { answerKeys: [0, -1, 0] }, [])).toBeNull()
    expect(parseAnswer(categorize, { answerKeys: [3, 0] }, [])).toBeNull()
    expect(parseAnswer(categorize, { answerKeys: [0.5, 0] }, [])).toBeNull()
    expect(parseAnswer(categorize, { answerKeys: [] }, [])).toBeNull()
    expect(parseAnswer(categorize, { text: "Famille" }, [])).toBeNull()
  })

  it("counts the players who matched each item with its right target", () => {
    expect(
      countResponses(statements, [
        { answerIds: [0, 1, 0] },
        { answerIds: [0, 0, 1] },
        { answerIds: [1, 1, 1] },
      ]),
    ).toEqual({ 0: 2, 1: 2, 2: 1 })
  })

  it("leaves out an item nobody matched, rather than counting it zero", () => {
    expect(
      countResponses(statements, [
        { answerIds: [0, 0, 1] },
        { answerIds: [0, 0, 1] },
      ]),
    ).toEqual({ 0: 2 })
  })
})

describe("parseAnswer, ranking", () => {
  const ranking = question(QUESTION_TYPES.RANKING, ["Un", "Deux", "Trois"])
  // No shuffle: the proposals are shown as written.
  const publicOrder = [0, 1, 2]
  const parse = (payload: unknown) => parseAnswer(ranking, payload, publicOrder)

  it("keeps the order the player built", () => {
    expect(parse({ answerKeys: [1, 2, 0] })).toEqual({ answerIds: [1, 2, 0] })
  })

  it("refuses anything but a full order", () => {
    expect(parse({ answerKeys: [0, 1] })).toBeNull()
    expect(parse({ answerKeys: [0, 0, 1] })).toBeNull()
    expect(parse({ answerKeys: [0, 1, 3] })).toBeNull()
    expect(parse({ text: "Un" })).toBeNull()
  })
})

describe("parseAnswer, scale", () => {
  const scale = (scaleSkip?: boolean): Question => ({
    ...question(QUESTION_TYPES.SCALE, []),
    options: { scaleMin: 1, scaleMax: 5, ...(scaleSkip && { scaleSkip }) },
  })
  const parse = (payload: unknown, scaleSkip?: boolean) =>
    parseAnswer(scale(scaleSkip), payload, [])

  it("keeps the level picked", () => {
    expect(parse({ answerKeys: [0] })).toEqual({ answerIds: [0] })
    expect(parse({ answerKeys: [4] })).toEqual({ answerIds: [4] })
  })

  it("keeps « Je préfère ne pas répondre » only when it is offered", () => {
    expect(parse({ answerKeys: [5] }, true)).toEqual({ answerIds: [5] })
    expect(parse({ answerKeys: [5] })).toBeNull()
  })

  it("refuses a level the scale has not, or several", () => {
    expect(parse({ answerKeys: [6] }, true)).toBeNull()
    expect(parse({ answerKeys: [-1] })).toBeNull()
    expect(parse({ answerKeys: [1.5] })).toBeNull()
    expect(parse({ answerKeys: [0, 1] })).toBeNull()
    expect(parse({ answerKeys: [] })).toBeNull()
    expect(parse({ text: "4" })).toBeNull()
    expect(parse(null)).toBeNull()
  })
})

describe("countResponses, ranking and scale", () => {
  it("counts the players who put each proposal first", () => {
    expect(
      countResponses(question(QUESTION_TYPES.RANKING, ["Un", "Deux"]), [
        { answerIds: [1, 0] },
        { answerIds: [1, 0] },
        { answerIds: [0, 1] },
      ]),
    ).toEqual({ 0: 1, 1: 2 })
  })

  it("counts the players of each level, and those without an opinion", () => {
    expect(
      countResponses(question(QUESTION_TYPES.SCALE, []), [
        { answerIds: [4] },
        { answerIds: [4] },
        { answerIds: [5] },
      ]),
    ).toEqual({ 4: 2, 5: 1 })
  })
})
