import { HIGHLIGHT_LIMITS } from "@razzia/common/constants"
import { cleanText } from "@razzia/common/utils/text"

// Editing a highlight text: the author works on the raw text of the field,
// the passages being read from it as the screens read them (parseHighlight).

const OPEN = "["

const CLOSE = "]"

const SPACE = /\s/u

/**
 * Where each passage of a raw text opens and closes, in UTF-16 indices, the
 * way parseHighlight reads it: a bracket opened again restarts the passage,
 * a stray closing bracket and an empty passage are skipped.
 */
export const passageBounds = (text: string): Array<[number, number]> => {
  const bounds: Array<[number, number]> = []
  const end = Math.min(text.length, HIGHLIGHT_LIMITS.RAW_LENGTH)
  let open = -1

  for (let index = 0; index < end; index += 1) {
    const char = text[index]

    if (char === OPEN) {
      open = index
    } else if (char === CLOSE && open !== -1) {
      if (cleanText(text.slice(open + 1, index)) !== "") {
        bounds.push([open, index])
      }

      open = -1
    }
  }

  return bounds
}

/**
 * The text with the words from `start` to `end` set between brackets, and
 * where the caret goes, after the closing bracket. The spaces around the
 * words stay out. Null when nothing but spaces is selected, or when the
 * selection holds a bracket or lies inside a passage already.
 */
export const wrapSelection = (
  text: string,
  start: number,
  end: number,
): { text: string; caret: number } | null => {
  let from = Math.min(start, end)
  let to = Math.max(start, end)

  while (from < to && SPACE.test(text[from])) {
    from += 1
  }

  while (to > from && SPACE.test(text[to - 1])) {
    to -= 1
  }

  const selected = text.slice(from, to)
  const before = text.slice(0, from)

  if (
    selected === "" ||
    selected.includes(OPEN) ||
    selected.includes(CLOSE) ||
    before.lastIndexOf(OPEN) > before.lastIndexOf(CLOSE)
  ) {
    return null
  }

  return {
    text: `${before}${OPEN}${selected}${CLOSE}${text.slice(to)}`,
    caret: to + 2,
  }
}

/**
 * The text with the brackets of passage `index` taken out, and where the
 * caret goes, after its words. Null for an unknown passage.
 */
export const unwrapPassage = (
  text: string,
  index: number,
): { text: string; caret: number } | null => {
  const bounds = passageBounds(text).at(index)

  if (!bounds) {
    return null
  }

  const [open, close] = bounds

  return {
    text: `${text.slice(0, open)}${text.slice(open + 1, close)}${text.slice(close + 1)}`,
    caret: close - 1,
  }
}

/**
 * The passages to spot once the text changed. The same number of passages:
 * a passage was edited in place, each keeps its tick. Otherwise a passage
 * was added or removed: the ticks follow the passages that are still
 * written the same.
 */
export const remapSolutions = (
  passages: readonly string[],
  solutions: readonly number[],
  nextPassages: readonly string[],
): number[] => {
  if (passages.length === nextPassages.length) {
    return solutions.filter((solution) => solution < nextPassages.length)
  }

  const taken = new Set<number>()

  for (const solution of solutions) {
    const passage = passages.at(solution)
    const next = nextPassages.findIndex(
      (candidate, index) => candidate === passage && !taken.has(index),
    )

    if (next !== -1) {
      taken.add(next)
    }
  }

  return [...taken].sort((a, b) => a - b)
}

/**
 * A passage cut after its first word, so the letter set before it never
 * ends a line alone.
 */
export const splitFirstWord = (passage: string): [string, string] => {
  const space = passage.search(SPACE)

  return space === -1
    ? [passage, ""]
    : [passage.slice(0, space), passage.slice(space)]
}
