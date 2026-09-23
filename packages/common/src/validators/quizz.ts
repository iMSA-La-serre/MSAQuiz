import {
  ASSOCIATION_LIMITS,
  ESTIMATE_LIMITS,
  ESTIMATE_TOLERANCE,
  HIGHLIGHT_LIMITS,
  MARKERS_LIMITS,
  MATCH_SCORING,
  MEDIA_PLAYBACK,
  MEDIA_TYPES,
  NO_TIME_LIMIT,
  ORDER_SCORING,
  ORDERING_ITEM_MAX_LENGTH,
  QUESTION_TYPE_META,
  QUESTION_TYPES,
  SCALE_DEFAULTS,
  SCALE_LIMITS,
  SCORING_MODES,
  SHORTANSWER_LIMITS,
  WORDCLOUD_LIMITS,
} from "@razzia/common/constants"
import type {
  Question,
  QuestionOptions,
  QuizzError,
} from "@razzia/common/types/game"
import { isAssociationType, targetsOf } from "@razzia/common/utils/association"
import { isCreditStep, storedCredits } from "@razzia/common/utils/choice"
import { decimalsOf, fitsDecimals } from "@razzia/common/utils/estimate"
import { markersOf, stackedMarker } from "@razzia/common/utils/markers"
import {
  impliedMediaTypeOf,
  isSameServerPath,
  MEDIA_ISSUES,
  mediaIssue,
} from "@razzia/common/utils/media"
import {
  formatHighlight,
  highlightLength,
  highlightScoringMode,
  parseHighlight,
} from "@razzia/common/utils/highlight"
import {
  answerKey,
  cleanInput,
  countInputChars,
} from "@razzia/common/utils/text"
import { z } from "zod"

const anyUrl = z.url()

// How a stored media is read: any address a save ever let through, a path on
// the quiz's own server included. What a save requires now is stricter, see
// quizzSaveValidator: a stored quiz never becomes unreadable.
export const questionMediaValidator = z.object({
  type: z
    .enum(
      [
        MEDIA_TYPES.IMAGE,
        MEDIA_TYPES.VIDEO,
        MEDIA_TYPES.AUDIO,
        MEDIA_TYPES.YOUTUBE,
      ],
      { error: "errors:quizz.invalidMediaType" },
    )
    .optional(),
  url: z
    .string()
    .refine(
      (url) => isSameServerPath(url) || anyUrl.safeParse(url).success,
      MEDIA_ISSUES.NOT_WEB,
    ),
  // Absent from every quiz stored before it existed: the projected screen.
  // Read with tolerance, a value it does not know (a later version's, a hand
  // edit) as the screen: a save refuses it, see quizzSaveValidator.
  playback: z.enum(MEDIA_PLAYBACK).optional().catch(undefined),
})

// A media without an address is no media: clearing the field removes it, and
// a draft or a file saved that way still opens. The address is kept without
// the spaces around it. A media without a type (the editor once saved an
// address alone) gets the one its address tells for sure, its file's
// extension or a YouTube video's link, when read as when saved, so the game
// shows it: the author's intent, never a quiz made unreadable.
const withCleanMedia = (question: Record<string, unknown>) => {
  const { media, ...rest } = question

  if (media === null) {
    return rest
  }

  if (typeof media !== "object" || Array.isArray(media)) {
    return question
  }

  const { type, url } = media as Record<string, unknown>

  if (typeof url !== "string") {
    return question
  }

  const address = url.trim()

  if (address === "") {
    return rest
  }

  const found = type === undefined ? impliedMediaTypeOf(address) : undefined

  return {
    ...question,
    media: {
      ...media,
      url: address,
      ...(found === undefined ? {} : { type: found }),
    },
  }
}

// Shared by every type: the scoring mode is filled in whenever options are
// given, as it always was, so stored quizzes parse to the same data.
const optionsValidator = z.object({
  scoringMode: z.enum(SCORING_MODES).default(SCORING_MODES.BALANCED),
  orderScoring: z.enum(ORDER_SCORING).optional(),
  // Statements and categorize.
  matchScoring: z.enum(MATCH_SCORING).optional(),
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
  // Scale. Checked against each other below.
  scaleMin: z.number().int("errors:quizz.scaleStart").optional(),
  scaleMax: z.number().int("errors:quizz.scaleEnd").optional(),
  scaleLow: z.string().optional(),
  scaleHigh: z.string().optional(),
  scaleSkip: z.boolean().optional(),
  // Markers, filled in on save from the markers ticked; poll, set by the
  // author.
  multiple: z.boolean().optional(),
  // Single. Checked against the answers below.
  credits: z.array(z.number()).optional(),
})

// Types added after quizzes were first stored: the stricter rules below only
// apply to them, so no stored quiz becomes invalid.
const NEWER_TYPES = new Set<string>([
  QUESTION_TYPES.ORDERING,
  QUESTION_TYPES.SHORTANSWER,
  QUESTION_TYPES.WORDCLOUD,
  QUESTION_TYPES.ESTIMATE,
  QUESTION_TYPES.HIGHLIGHT,
  QUESTION_TYPES.STATEMENTS,
  QUESTION_TYPES.CATEGORIZE,
  QUESTION_TYPES.RANKING,
  QUESTION_TYPES.SCALE,
  QUESTION_TYPES.MARKERS,
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

// Scale: levels from 0 or 1 up to 8 at most (SCALE_LIMITS, whose note says
// why eight), three of them at least, and end labels short enough to share a
// phone line.
const checkScale = (
  { options = {} }: Pick<Question, "options">,
  issue: IssueFn,
) => {
  const { scaleMin, scaleMax } = options

  if (
    scaleMin !== undefined &&
    (scaleMin < SCALE_LIMITS.MIN_START || scaleMin > SCALE_LIMITS.MAX_START)
  ) {
    issue("errors:quizz.scaleStart", ["options", "scaleMin"])
  }

  if (scaleMax !== undefined && scaleMax > SCALE_LIMITS.MAX_END) {
    issue("errors:quizz.scaleEnd", ["options", "scaleMax"])
  }

  const start = scaleMin ?? SCALE_DEFAULTS.START
  const levels = scaleMax === undefined ? undefined : scaleMax - start + 1

  if (
    levels !== undefined &&
    (levels < SCALE_LIMITS.MIN_LEVELS || levels > SCALE_LIMITS.MAX_LEVELS)
  ) {
    issue("errors:quizz.scaleLevels", ["options", "scaleMax"])
  }

  for (const end of ["scaleLow", "scaleHigh"] as const) {
    const label = options[end]

    if (label !== undefined && isTooLong(label, SCALE_LIMITS.LABEL_LENGTH)) {
      issue("errors:quizz.scaleLabelTooLong", ["options", end])
    }
  }
}

// The end labels are stored cleaned, and dropped when empty.
const scaleOptions = (options: QuestionOptions): QuestionOptions =>
  (["scaleLow", "scaleHigh"] as const).reduce((current, end) => {
    const { [end]: label, ...rest } = current
    const cleaned = label === undefined ? "" : cleanInput(label)

    return cleaned === "" ? rest : { ...rest, [end]: cleaned }
  }, options)

// Highlight: a short text with 2 to 5 passages, each told apart from the
// others, and at least one of them to spot.
const checkHighlight = (
  { text, solutions }: Pick<Question, "text" | "solutions">,
  issue: IssueFn,
) => {
  if (text === undefined || text.trim() === "") {
    issue("errors:quizz.highlightTextMissing", ["text"])

    return
  }

  const parsed = parseHighlight(text)
  const { passages } = parsed

  if (
    text.length > HIGHLIGHT_LIMITS.RAW_LENGTH ||
    highlightLength(parsed) > HIGHLIGHT_LIMITS.TEXT_LENGTH
  ) {
    issue("errors:quizz.highlightTextTooLong", ["text"])
  }

  if (parsed.issue === "brackets") {
    issue("errors:quizz.highlightBrackets", ["text"])
  } else if (parsed.issue === "emptyPassage") {
    issue("errors:quizz.highlightPassageEmpty", ["text"])
  }

  if (passages.length < HIGHLIGHT_LIMITS.MIN_PASSAGES) {
    issue("errors:quizz.highlightTooFewPassages", ["text"])
  } else if (passages.length > HIGHLIGHT_LIMITS.MAX_PASSAGES) {
    issue("errors:quizz.highlightTooManyPassages", ["text"])
  }

  const tooLong = passages.findIndex(
    (passage) => countInputChars(passage) > HIGHLIGHT_LIMITS.PASSAGE_LENGTH,
  )

  if (tooLong !== -1) {
    issue("errors:quizz.highlightPassageTooLong", ["answers", tooLong])
  }

  // Told apart as written: « a » and « à » may well be the point.
  const duplicate = passages.findIndex(
    (passage, index) => passages.indexOf(passage) !== index,
  )

  if (duplicate !== -1) {
    issue("errors:quizz.highlightPassageDuplicate", ["answers", duplicate])
  }

  if (solutions.length === 0) {
    issue("errors:quizz.highlightNoSolution", ["solutions"])
  } else if (solutions.some((solution) => solution >= passages.length)) {
    issue("errors:quizz.highlightSolutionRange", ["solutions"])
  }
}

// The wording of the issues of a statements or a categorize question, whose
// items are statements or elements to sort.
const ASSOCIATION_ISSUES = {
  statements: {
    itemsCount: "errors:quizz.statementsCount",
    itemTooLong: "errors:quizz.statementTooLong",
    itemDuplicate: "errors:quizz.statementDuplicate",
    unmatched: "errors:quizz.statementUnanswered",
  },
  categorize: {
    itemsCount: "errors:quizz.categorizeItemsCount",
    itemTooLong: "errors:quizz.categorizeItemTooLong",
    itemDuplicate: "errors:quizz.categorizeItemDuplicate",
    unmatched: "errors:quizz.categorizeUnsorted",
  },
} as const

// Categorize: 2 to 4 categories, each told apart from the others. The
// targets of statements are imposed, see withStatementTargets.
const checkCategories = (targets: string[], issue: IssueFn) => {
  if (
    targets.length < ASSOCIATION_LIMITS.MIN_TARGETS ||
    targets.length > ASSOCIATION_LIMITS.MAX_TARGETS
  ) {
    issue("errors:quizz.categorizeTargetsCount", ["targets"])
  }

  targets.forEach((target, index) => {
    if (cleanInput(target) === "") {
      issue("errors:quizz.categorizeTargetEmpty", ["targets", index])
    } else if (isTooLong(target, ASSOCIATION_LIMITS.TARGET_LENGTH)) {
      issue("errors:quizz.categorizeTargetTooLong", ["targets", index])
    }
  })

  const duplicate = firstDuplicateKey(targets)

  if (duplicate !== -1) {
    issue("errors:quizz.categorizeTargetDuplicate", ["targets", duplicate])
  }
}

// Statements and categorize: 2 to 5 items, each told apart from the others
// and matched with one of the targets.
const checkAssociation = (
  {
    type,
    answers,
    targets = [],
    expectedTargets = [],
  }: Pick<Question, "type" | "answers" | "targets" | "expectedTargets">,
  issue: IssueFn,
) => {
  const wording =
    type === QUESTION_TYPES.STATEMENTS
      ? ASSOCIATION_ISSUES.statements
      : ASSOCIATION_ISSUES.categorize

  if (
    answers.length < ASSOCIATION_LIMITS.MIN_ITEMS ||
    answers.length > ASSOCIATION_LIMITS.MAX_ITEMS
  ) {
    issue(wording.itemsCount, ["answers"])
  }

  answers.forEach((item, index) => {
    // An empty string is already reported by the answers schema.
    if (item !== "" && cleanInput(item) === "") {
      issue("errors:quizz.answerEmpty", ["answers", index])
    }

    if (isTooLong(item, ASSOCIATION_LIMITS.ITEM_LENGTH)) {
      issue(wording.itemTooLong, ["answers", index])
    }
  })

  const duplicate = firstDuplicateKey(answers)

  if (duplicate !== -1) {
    issue(wording.itemDuplicate, ["answers", duplicate])
  }

  if (type === QUESTION_TYPES.CATEGORIZE) {
    checkCategories(targets, issue)
  }

  const unmatched = answers.findIndex((_, index) => {
    const target = expectedTargets.at(index)

    return target === undefined || target < 0 || target >= targets.length
  })

  if (unmatched !== -1) {
    issue(wording.unmatched, ["expectedTargets", unmatched])
  }
}

// Markers: an image to place them on, 2 to 6 markers within it, each with a
// label of its own, and at least one of them right.
const checkMarkers = (
  {
    media,
    answers,
    markers = [],
    solutions,
  }: Pick<Question, "media" | "answers" | "markers" | "solutions">,
  issue: IssueFn,
) => {
  if (media?.type !== MEDIA_TYPES.IMAGE) {
    issue("errors:quizz.markersImageMissing", ["media"])
  }

  if (
    answers.length < MARKERS_LIMITS.MIN_MARKERS ||
    answers.length > MARKERS_LIMITS.MAX_MARKERS
  ) {
    issue("errors:quizz.markersCount", ["answers"])
  }

  answers.forEach((label, index) => {
    // An empty string is already reported by the answers schema.
    if (label !== "" && cleanInput(label) === "") {
      issue("errors:quizz.answerEmpty", ["answers", index])
    }

    if (isTooLong(label, MARKERS_LIMITS.LABEL_LENGTH)) {
      issue("errors:quizz.markerLabelTooLong", ["answers", index])
    }
  })

  const duplicate = firstDuplicateKey(answers)

  if (duplicate !== -1) {
    issue("errors:quizz.markerLabelDuplicate", ["answers", duplicate])
  }

  const inImage = (value: number | undefined) =>
    value !== undefined &&
    Number.isFinite(value) &&
    value >= MARKERS_LIMITS.MIN_PERCENT &&
    value <= MARKERS_LIMITS.MAX_PERCENT

  const misplaced = answers.findIndex((_, index) => {
    const marker = markers.at(index)

    return !inImage(marker?.x) || !inImage(marker?.y)
  })

  if (misplaced !== -1) {
    issue("errors:quizz.markerPosition", ["markers", misplaced])
  } else {
    // Two markers on the same spot: only the top one could be tapped.
    const stacked = stackedMarker(markers.slice(0, answers.length))

    if (stacked !== -1) {
      issue("errors:quizz.markerOverlap", ["markers", stacked])
    }
  }

  if (solutions.length === 0) {
    issue("errors:quizz.markersNoSolution", ["solutions"])
  } else if (solutions.some((solution) => solution >= answers.length)) {
    issue("errors:quizz.markersSolutionRange", ["solutions"])
  }
}

// Single: the credit of each answer that is not right, one of CREDIT_STEPS.
// A right answer earns 100 whatever is stored, and an entry past the last
// answer is dropped on save.
const checkCredits = (
  {
    answers,
    solutions,
    options,
  }: Pick<Question, "answers" | "solutions" | "options">,
  issue: IssueFn,
) => {
  options?.credits?.forEach((credit, index) => {
    if (
      index < answers.length &&
      !solutions.includes(index) &&
      !isCreditStep(credit)
    ) {
      issue("errors:quizz.creditStep", ["options", "credits", index])
    }
  })
}

// The settings of a poll: several answers only when the author allows them,
// `multiple` being dropped otherwise, as before polls could take several.
const pollOptions = ({
  multiple,
  ...rest
}: QuestionOptions): QuestionOptions =>
  multiple === true ? { ...rest, multiple } : rest

// The settings of a markers question: whether several markers are right, so
// the phone knows how many it may accept, next to the scoring mode it then
// applies.
const markersOptions = (
  options: QuestionOptions | undefined,
  several: boolean,
): QuestionOptions | undefined => {
  const { multiple: _ticked, ...rest } = options ?? {}

  if (!several) {
    return options && rest
  }

  return {
    ...rest,
    scoringMode: rest.scoringMode ?? SCORING_MODES.BALANCED,
    multiple: true,
  }
}

// The settings only a scale reads.
const SCALE_OPTION_KEYS = [
  "scaleMin",
  "scaleMax",
  "scaleLow",
  "scaleHigh",
  "scaleSkip",
] satisfies Array<keyof QuestionOptions>

// The settings only an estimate reads.
const ESTIMATE_OPTION_KEYS = [
  "decimals",
  "tolerance",
  "toleranceMode",
  "min",
  "max",
  "unit",
] satisfies Array<keyof QuestionOptions>

// The fields and the settings only some types read.
const OWNED_FIELDS: Array<{
  types: ReadonlySet<string>
  fields: ReadonlySet<string>
  options: ReadonlySet<string>
}> = [
  {
    types: new Set([QUESTION_TYPES.ESTIMATE]),
    fields: new Set(["expected"]),
    options: new Set(ESTIMATE_OPTION_KEYS),
  },
  {
    types: new Set([QUESTION_TYPES.STATEMENTS, QUESTION_TYPES.CATEGORIZE]),
    fields: new Set(["targets", "expectedTargets"]),
    options: new Set(["matchScoring"] satisfies Array<keyof QuestionOptions>),
  },
  {
    types: new Set([QUESTION_TYPES.SCALE]),
    fields: new Set<string>(),
    options: new Set(SCALE_OPTION_KEYS),
  },
  {
    types: new Set([QUESTION_TYPES.MARKERS]),
    fields: new Set(["markers"]),
    options: new Set<string>(),
  },
  // Several answers at once: a markers question with several right markers,
  // a poll whose author allows them.
  {
    types: new Set([QUESTION_TYPES.MARKERS, QUESTION_TYPES.POLL]),
    fields: new Set<string>(),
    options: new Set(["multiple"] satisfies Array<keyof QuestionOptions>),
  },
  {
    types: new Set([QUESTION_TYPES.SINGLE]),
    fields: new Set<string>(),
    options: new Set(["credits"] satisfies Array<keyof QuestionOptions>),
  },
]

const withoutKeys = (
  object: Record<string, unknown>,
  keys: ReadonlySet<string>,
): Record<string, unknown> =>
  Object.fromEntries(Object.entries(object).filter(([key]) => !keys.has(key)))

// The other types have the fields and the settings of an estimate, of
// statements or of categorize dropped before any check, as zod dropped them
// before those types existed: they are neither refused nor stored, nor sent
// to the players.
const withoutForeignFields = (question: Record<string, unknown>) =>
  OWNED_FIELDS.reduce((current, { types, fields, options }) => {
    if (typeof question.type === "string" && types.has(question.type)) {
      return current
    }

    const rest = withoutKeys(current, fields)
    const { options: settings } = rest

    if (
      typeof settings !== "object" ||
      settings === null ||
      Array.isArray(settings)
    ) {
      return rest
    }

    return {
      ...rest,
      options: withoutKeys(settings as Record<string, unknown>, options),
    }
  }, question)

// The targets of statements are Vrai and Faux, whatever was sent along.
const withStatementTargets = (question: Record<string, unknown>) =>
  question.type === QUESTION_TYPES.STATEMENTS
    ? { ...question, targets: targetsOf({ type: QUESTION_TYPES.STATEMENTS }) }
    : question

// A highlight's answers are the passages of its text, whatever was sent
// along: the text is the one source. The other types have the text dropped
// before any check, as the settings of an estimate.
const withHighlightFields = (question: Record<string, unknown>) => {
  const { text, ...rest } = question

  if (question.type !== QUESTION_TYPES.HIGHLIGHT) {
    return rest
  }

  return {
    ...question,
    answers: typeof text === "string" ? parseHighlight(text).passages : [],
  }
}

// Backward compat: questions saved before type existed get one inferred.
// Several solutions = a real multi-select; one solution = single.
const questionValidator = z.preprocess(
  (data) => {
    if (typeof data !== "object" || data === null) {
      return data
    }

    const question = withCleanMedia(data as Record<string, unknown>)

    if ("type" in question) {
      return withStatementTargets(
        withHighlightFields(withoutForeignFields(question)),
      )
    }

    const isMulti =
      Array.isArray(question.solutions) && question.solutions.length > 1

    return withHighlightFields(
      withoutForeignFields({
        ...question,
        type: isMulti ? QUESTION_TYPES.MULTI : QUESTION_TYPES.SINGLE,
      }),
    )
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
      // Highlight only, dropped from the other types.
      text: z.string().optional(),
      // Statements and categorize only, dropped from the other types.
      targets: z.array(z.string()).optional(),
      expectedTargets: z.array(z.number().int()).optional(),
      // Markers only, dropped from the other types. Bounds and count are
      // checked against the answers, see checkMarkers.
      markers: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
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
      // dropped; a highlight counts the passages of its text, see
      // checkHighlight, statements and categorize their items, see
      // checkAssociation, markers their labels, see checkMarkers.
      if (question.type === QUESTION_TYPES.HIGHLIGHT) {
        checkHighlight(question, issue)
      } else if (isAssociationType(question.type)) {
        checkAssociation(question, issue)
      } else if (question.type === QUESTION_TYPES.MARKERS) {
        checkMarkers(question, issue)
      } else if (meta.answersCount !== undefined) {
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

      // Ordering, shortanswer, statements and categorize do not score against
      // `solutions`, a highlight checks its own; the newer unscored types do
      // not score at all.
      if (
        meta.scored &&
        !NEWER_TYPES.has(question.type) &&
        question.solutions.length === 0
      ) {
        issue("errors:quizz.noSolutions", ["solutions"])
      }

      if (
        question.type === QUESTION_TYPES.ORDERING ||
        question.type === QUESTION_TYPES.RANKING
      ) {
        checkOrderingItems(question.answers, issue)
      }

      if (question.type === QUESTION_TYPES.SCALE) {
        checkScale(question, issue)
      }

      if (question.type === QUESTION_TYPES.SINGLE) {
        checkCredits(question, issue)
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

      // The text is stored as the screens read it; the answers are its
      // passages, and each passage to spot is listed once, in order. The
      // scoring mode is stored as it applies: no lenient mode.
      if (question.type === QUESTION_TYPES.HIGHLIGHT) {
        const { options } = question

        return {
          ...question,
          text: question.text && formatHighlight(parseHighlight(question.text)),
          solutions: [...new Set(question.solutions)].sort((a, b) => a - b),
          ...(options && {
            options: {
              ...options,
              scoringMode: highlightScoringMode(options.scoringMode),
            },
          }),
        }
      }

      // The right target of each item has its own field, kept secret, one per
      // item. Categories are stored cleaned, as the screens show them.
      if (isAssociationType(question.type)) {
        return {
          ...question,
          targets: question.targets?.map(cleanInput),
          expectedTargets: question.expectedTargets?.slice(
            0,
            question.answers.length,
          ),
          solutions: [],
        }
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

      // One marker per label, within the image; each right marker is listed
      // once, in order, and whether there are several is stored in the
      // options, which players read.
      if (question.type === QUESTION_TYPES.MARKERS) {
        const solutions = [...new Set(question.solutions)].sort((a, b) => a - b)

        // The markers ticked are the one source: a stored `multiple` that no
        // longer matches them is dropped.
        return {
          ...question,
          markers: markersOf(question),
          solutions,
          options: markersOptions(question.options, solutions.length > 1),
        }
      }

      // The levels of a scale are its settings, not answers; the end labels
      // are stored as the screens show them.
      if (question.type === QUESTION_TYPES.SCALE) {
        return {
          ...question,
          options: question.options && scaleOptions(question.options),
          answers: [],
          solutions: [],
          maxPoints: undefined,
          penalty: undefined,
        }
      }

      // One credit per answer, a right one earning 100, as the screens read
      // them.
      if (
        question.type === QUESTION_TYPES.SINGLE &&
        question.options?.credits !== undefined
      ) {
        return {
          ...question,
          options: {
            ...question.options,
            credits: storedCredits(question) ?? [],
          },
        }
      }

      if (meta.scored) {
        return question
      }

      // Unscored types: no solutions, no points tuning; slides and word clouds
      // have no answers.
      return {
        ...question,
        ...(question.type === QUESTION_TYPES.POLL &&
          question.options && { options: pollOptions(question.options) }),
        answers:
          meta.acceptsAnswers && meta.maxAnswers > 0 ? question.answers : [],
        solutions: [],
        maxPoints: undefined,
        penalty: undefined,
      }
    }),
)

// Reads a stored quiz, and checks what a save sends before the rules below.
export const quizzValidator = z.object({
  subject: z.string().min(1, "errors:quizz.subjectEmpty"),
  questions: z.array(questionValidator).min(1, "errors:quizz.noQuestions"),
})

export type QuizzValidated = z.infer<typeof quizzValidator>

const PLAYBACKS: ReadonlySet<unknown> = new Set(Object.values(MEDIA_PLAYBACK))

// Where a video or a sound plays, as a save sends it: read with tolerance
// (questionMediaValidator), never saved unless it is one the game knows.
const checkSavedPlayback = (input: unknown, ctx: z.RefinementCtx) => {
  const questions =
    typeof input === "object" && input !== null && "questions" in input
      ? input.questions
      : undefined

  if (!Array.isArray(questions)) {
    return
  }

  questions.forEach((question: unknown, index) => {
    const media =
      typeof question === "object" && question !== null && "media" in question
        ? question.media
        : undefined

    if (
      typeof media === "object" &&
      media !== null &&
      "playback" in media &&
      media.playback !== undefined &&
      !PLAYBACKS.has(media.playback)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "errors:quizz.invalidMediaPlayback",
        path: ["questions", index, "media", "playback"],
      })
    }
  })
}

/**
 * What a save from the editor accepts: the rules of quizzValidator, then
 * those added since for new content, which stored quizzes (and the files
 * they were exported to, see the import) are never read against. A media
 * must be a web address, a path on the quiz's own server or a small pasted
 * image, never a video page's link (a YouTube video's link is a YouTube
 * media), and have a type (see mediaIssue); where a video or a sound plays
 * must be one the game knows.
 */
export const quizzSaveValidator = z
  .unknown()
  .superRefine(checkSavedPlayback)
  .pipe(quizzValidator)
  .superRefine(({ questions }, ctx) => {
    questions.forEach((question, index) => {
      // A question that failed its own checks may not be parsed.
      const media = (question as Partial<Question> | undefined)?.media

      if (typeof media?.url !== "string") {
        return
      }

      const message = mediaIssue(media)

      if (message) {
        ctx.addIssue({
          code: "custom",
          message,
          path: [
            "questions",
            index,
            "media",
            message === MEDIA_ISSUES.TYPE_MISSING ? "type" : "url",
          ],
        })
      }
    })
  })

/**
 * The first issue of a quiz refused on save, and the question it is about
 * (0-based) when it is about one, so the editor can name and open it.
 */
export const quizzErrorOf = (error: z.ZodError): QuizzError => {
  const [{ message, path }] = error.issues
  const [field, index] = path

  return field === "questions" && typeof index === "number"
    ? { message, questionIndex: index }
    : { message }
}
