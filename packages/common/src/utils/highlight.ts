import { HIGHLIGHT_LIMITS, SCORING_MODES } from "@razzia/common/constants"
import type { ScoringMode } from "@razzia/common/types/game"
import { cleanText } from "@razzia/common/utils/text"

// Highlight: the author writes a short text and sets the passages players may
// tap between [brackets]. Shared by the validator, the server and the web
// client, so every screen reads a text the same way.

/** A piece of a highlight text: plain text, or a passage. */
export interface HighlightPart {
  text: string
  // Index of the passage among the question's answers; absent on plain text.
  passage?: number
}

// The first problem met in a text: a bracket left open, closed without being
// opened or opened inside a passage, or a passage holding nothing but spaces.
export type HighlightIssue = "brackets" | "emptyPassage"

export interface ParsedHighlight {
  parts: HighlightPart[]
  // The passages in the order they come: the question's answers.
  passages: string[]
  // Null for a well-formed text. Otherwise the parts and passages keep what
  // could be read, a stray bracket staying in the plain text.
  issue: HighlightIssue | null
}

const OPEN = "["

const CLOSE = "]"

/**
 * Splits a text into plain text and passages. The text is cleaned first (see
 * cleanText) and each passage trimmed.
 */
export const parseHighlight = (source: string): ParsedHighlight => {
  // By code point, so no passage cuts a character in two.
  const chars = Array.from(
    cleanText(source.slice(0, HIGHLIGHT_LIMITS.RAW_LENGTH)),
  )
  const parts: HighlightPart[] = []
  const passages: string[] = []
  let issue: HighlightIssue | null = null
  // Plain text since the last passage, and where the pending passage opened.
  let plain = ""
  let open = -1

  const note = (found: HighlightIssue) => {
    issue ??= found
  }

  for (const [index, char] of chars.entries()) {
    if (char === OPEN) {
      if (open !== -1) {
        note("brackets")
        plain += chars.slice(open, index).join("")
      }

      open = index

      continue
    }

    if (open === -1) {
      if (char === CLOSE) {
        note("brackets")
      }

      plain += char

      continue
    }

    if (char !== CLOSE) {
      continue
    }

    const content = chars
      .slice(open + 1, index)
      .join("")
      .trim()

    if (content === "") {
      note("emptyPassage")
      plain += chars.slice(open, index + 1).join("")
      open = -1

      continue
    }

    if (plain !== "") {
      parts.push({ text: plain })
    }

    parts.push({ text: content, passage: passages.length })
    passages.push(content)
    plain = ""
    open = -1
  }

  if (open !== -1) {
    note("brackets")
    plain += chars.slice(open).join("")
  }

  if (plain !== "") {
    parts.push({ text: plain })
  }

  return { parts, passages, issue }
}

/** Characters a reader sees, brackets left out, counted by code point. */
export const highlightLength = ({ parts }: ParsedHighlight): number =>
  parts.reduce((sum, part) => sum + Array.from(part.text).length, 0)

/** The text as stored: cleaned, each passage trimmed within its brackets. */
export const formatHighlight = ({ parts }: ParsedHighlight): string =>
  parts
    .map((part) =>
      part.passage === undefined ? part.text : `${OPEN}${part.text}${CLOSE}`,
    )
    .join("")

/**
 * What a player's picks come to against the passages to spot: the ones found,
 * out of how many, and the ones picked that are not to spot.
 */
export const foundPassages = (
  answerIds: readonly number[],
  solutions: readonly number[],
): { count: number; total: number; extra: number } => {
  const picked = new Set(answerIds)
  const count = solutions.filter((solution) => picked.has(solution)).length

  return {
    count,
    total: solutions.length,
    extra: [...picked].filter((id) => !solutions.includes(id)).length,
  }
}

/**
 * The scoring mode a highlight applies: strict, or balanced when none is set.
 * The lenient mode of a multi would give full credit for tapping every
 * passage, so a highlight reads it as balanced.
 */
export const highlightScoringMode = (mode?: ScoringMode): ScoringMode =>
  mode === SCORING_MODES.STRICT ? SCORING_MODES.STRICT : SCORING_MODES.BALANCED

/**
 * Multiplier of the passages tapped, as a multi scores its answers. Strict:
 * 1 for every passage to spot and no other, 0 otherwise. Balanced: the
 * passages found less the others tapped, over the passages to spot, never
 * below 0. Either way, full credit means every passage to spot and no other.
 */
export const scoreHighlight = (
  answerIds: readonly number[],
  solutions: readonly number[],
  mode?: ScoringMode,
): number => {
  const { count, total, extra } = foundPassages(answerIds, solutions)

  if (total === 0) {
    return 0
  }

  if (highlightScoringMode(mode) === SCORING_MODES.STRICT) {
    return count === total && extra === 0 ? 1 : 0
  }

  return Math.max((count - extra) / total, 0)
}
