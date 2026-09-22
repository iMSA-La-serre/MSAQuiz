import {
  QUESTION_TYPES,
  SHORTANSWER_LIMITS,
  WORDCLOUD_LIMITS,
} from "@razzia/common/constants"
import type { Question } from "@razzia/common/types/game"
import {
  isAssociationType,
  matchedItems,
  targetsOf,
} from "@razzia/common/utils/association"
import { checkEstimate } from "@razzia/common/utils/estimate"
import {
  BUILTIN_BLOCKLIST,
  type Blocklist,
  isBlocked,
} from "@razzia/common/utils/moderation"
import { placedItems } from "@razzia/common/utils/ordering"
import {
  answerKey,
  cleanInput,
  countInputChars,
  matchAccepted,
} from "@razzia/common/utils/text"
import { wordCountOf } from "@razzia/common/utils/wordcloud"
import type { ScoredAnswer } from "@razzia/socket/services/scoring"

// Types whose players may pick several answers at once.
const SEVERAL_PICKS = new Set<string>([
  QUESTION_TYPES.MULTI,
  QUESTION_TYPES.HIGHLIGHT,
])

// Answer ids as sent by a player, checked against the question before they
// are stored. The scoring counts matching ids, so a repeated id would be
// credited once per copy: duplicates are dropped, and anything a regular
// client cannot send (unknown answer, several picks on a single choice) is
// refused with null. A highlight's answers are its passages.
export const parseAnswerIds = (
  question: Question,
  answerIds: unknown,
): number[] | null => {
  if (!Array.isArray(answerIds)) {
    return null
  }

  const ids = [...new Set<unknown>(answerIds)]
  const inRange = ids.every(
    (id) =>
      Number.isInteger(id) &&
      (id as number) >= 0 &&
      (id as number) < question.answers.length,
  )

  if (ids.length === 0 || !inRange) {
    return null
  }

  if (!SEVERAL_PICKS.has(question.type) && ids.length > 1) {
    return null
  }

  return ids as number[]
}

// Ordering: indices into the public list, in the order the player chose. Only
// an exact permutation of that list is kept, remapped to the original
// indices; a repeated index is refused rather than dropped, it would place one
// item twice.
const parseOrder = (
  answerKeys: unknown,
  publicOrder: readonly number[],
): number[] | null => {
  if (!Array.isArray(answerKeys)) {
    return null
  }

  const keys: unknown[] = answerKeys
  const { length } = publicOrder
  const isPermutation =
    keys.length === length &&
    new Set(keys).size === length &&
    keys.every(
      (key) =>
        Number.isInteger(key) &&
        (key as number) >= 0 &&
        (key as number) < length,
    )

  if (!isPermutation) {
    return null
  }

  return (keys as number[]).map((key) => publicOrder[key])
}

// Statements and categorize: the index of a target for each item, in the
// order of the answers. Only a full answer is kept, as sent: an item left
// out, or a target that does not exist, and the whole answer is refused.
const parseMatches = (
  question: Question,
  answerKeys: unknown,
): number[] | null => {
  if (!Array.isArray(answerKeys)) {
    return null
  }

  const keys: unknown[] = answerKeys
  const targets = targetsOf(question).length
  const isComplete =
    keys.length === question.answers.length &&
    keys.length > 0 &&
    keys.every(
      (key) =>
        Number.isInteger(key) &&
        (key as number) >= 0 &&
        (key as number) < targets,
    )

  return isComplete ? (keys as number[]) : null
}

// Shortanswer: the text is cleaned and matched right away, only the cleaned
// input is kept. An empty or too long input is refused.
const parseText = (question: Question, text: unknown): ScoredAnswer | null => {
  if (typeof text !== "string") {
    return null
  }

  const length = countInputChars(text)

  if (length === 0 || length > SHORTANSWER_LIMITS.INPUT_LENGTH) {
    return null
  }

  const cleaned = cleanInput(text)
  const index = matchAccepted(question.accepted ?? [], cleaned, {
    typoTolerance: question.options?.typoTolerance,
  })

  return { answerIds: index === -1 ? [] : [index], text: cleaned }
}

// Wordcloud: 1 to wordCount texts, each cleaned and 1 to 30 characters long,
// or the whole answer is refused. A word the player already gave (same key),
// a word with no key, and a word the blocklist refuses are then dropped
// without a word to the player: the answer still counts, maybe with no word.
const parseWords = (
  question: Question,
  texts: unknown,
  blocklist: Blocklist,
): ScoredAnswer | null => {
  if (
    !Array.isArray(texts) ||
    texts.length === 0 ||
    texts.length > wordCountOf(question.options)
  ) {
    return null
  }

  const words: unknown[] = texts
  const valid = words.every((text) => {
    if (typeof text !== "string") {
      return false
    }

    const length = countInputChars(text)

    return length > 0 && length <= WORDCLOUD_LIMITS.WORD_LENGTH
  })

  if (!valid) {
    return null
  }

  const seen = new Set<string>()
  const kept = (words as string[]).map(cleanInput).filter((text) => {
    const key = answerKey(text)

    if (key === "" || seen.has(key)) {
      return false
    }

    seen.add(key)

    return !isBlocked(text, blocklist)
  })

  return { answerIds: [], texts: kept }
}

// Estimate: the number typed, read as the phone reads it (checkEstimate). A
// text that is no number, has too many decimals or is out of the bounds is
// refused.
const parseNumber = (
  question: Question,
  text: unknown,
): ScoredAnswer | null => {
  if (typeof text !== "string") {
    return null
  }

  const checked = checkEstimate(text, question.options)

  return checked.ok ? { answerIds: [], value: checked.value } : null
}

const payloadField = (payload: unknown, field: string): unknown =>
  typeof payload === "object" &&
  payload !== null &&
  Object.hasOwn(payload, field)
    ? (payload as Record<string, unknown>)[field]
    : undefined

/**
 * The answer parser of a game, given the words a word cloud drops: the
 * built-in list plus the lines of moderation.txt.
 */
export const answerParser =
  (blocklist: Blocklist) =>
  (
    question: Question,
    payload: unknown,
    publicOrder: readonly number[],
  ): ScoredAnswer | null => {
    if (question.type === QUESTION_TYPES.SHORTANSWER) {
      return parseText(question, payloadField(payload, "text"))
    }

    if (question.type === QUESTION_TYPES.WORDCLOUD) {
      return parseWords(question, payloadField(payload, "texts"), blocklist)
    }

    if (question.type === QUESTION_TYPES.ESTIMATE) {
      return parseNumber(question, payloadField(payload, "text"))
    }

    const answerKeys = payloadField(payload, "answerKeys")

    if (isAssociationType(question.type)) {
      const answerIds = parseMatches(question, answerKeys)

      return answerIds && { answerIds }
    }

    const answerIds =
      question.type === QUESTION_TYPES.ORDERING
        ? parseOrder(answerKeys, publicOrder)
        : parseAnswerIds(question, answerKeys)

    return answerIds && { answerIds }
  }

/**
 * An answer payload checked against the question, ready to be stored, or
 * null to ignore it. `publicOrder` maps each index of the list players were
 * shown to its original index (identity except for an ordering). A word cloud
 * drops the words of the built-in list, see answerParser.
 */
export const parseAnswer = answerParser(BUILTIN_BLOCKLIST)

// The indices of the items an answer got right: the items put at their
// place (ordering), matched with their right target (statements,
// categorize).
const rightItems = (flags: boolean[]): number[] =>
  flags.flatMap((right, index) => (right ? [index] : []))

/**
 * Tally shown with SHOW_RESPONSES, keyed by index. Choice types: votes per
 * answer. Ordering: players who put item i (original index) at its place.
 * Statements and categorize: players who matched item i with its right
 * target. Shortanswer: inputs recognized per accepted answer. Wordcloud and
 * estimate: nothing, their words and values are counted apart (countWords,
 * estimateRanges).
 */
export const countResponses = (
  question: Question,
  answers: readonly ScoredAnswer[],
): Record<number, number> => {
  const idsOf = ({ answerIds }: ScoredAnswer): number[] => {
    if (question.type === QUESTION_TYPES.ORDERING) {
      return rightItems(placedItems(answerIds, question.answers.length))
    }

    if (isAssociationType(question.type)) {
      return rightItems(matchedItems(answerIds, question.expectedTargets ?? []))
    }

    return answerIds
  }
  const ids = answers.flatMap(idsOf)

  return ids.reduce<Record<number, number>>((acc, id) => {
    acc[id] = (acc[id] ?? 0) + 1

    return acc
  }, {})
}
