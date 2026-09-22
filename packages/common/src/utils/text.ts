import { SHORTANSWER_LIMITS } from "@razzia/common/constants"

// Text helpers shared by the server (shortanswer matching) and the web client
// (input counter, editor preview), so both sides count and compare alike.

// Tab and line breaks stand for a space.
const CONTROL_SPACES = /[\t\n\v\f\r\u0085]/gu

// Controls, format characters (zero width space and joiners, soft hyphen,
// BOM...) and the lone surrogate a cut at RAW_LENGTH can leave behind.
const INVISIBLES = /[\p{Cc}\p{Cf}\p{Cs}]/gu

const SPACES = /\s+/gu

const APOSTROPHES = /[\u2019\u02bc`\u00b4]/gu

const DASHES = /[\u2010-\u2014\u2212]/gu

const ACCENTS = /[\u0300-\u036f]/gu

// "1 000" is "1000".
const DIGIT_GROUP_SPACE = /(?<=\p{Nd}) (?=\p{Nd})/gu

// Punctuation becomes a space, except a separator between two digits (1/2 is
// not 12, 1.5 is not 15) and a leading minus sign (-5 is not 5).
const PUNCTUATION = /(?!(?<=\p{Nd})[.,/:-](?=\p{Nd})|^-(?=\p{Nd}))\p{P}/gu

const DIGIT = /\p{Nd}/u

// A number written in capital Roman numerals, alone or as an ordinal (IV,
// XIV, XIXe, Ve, Ier, XXème). Read on the cleaned text, before the key
// lowercases it. Not numerals: a capital followed by an apostrophe, an elided
// article (L', D'), and a lone L, C, D or M followed by a suffix, a word (Le,
// De, Ce, Mer).
const ROMAN_NUMERAL =
  /(?<![\p{L}\p{N}])(?:I(?:er|re)|(?:[IVX]|[IVXLCDM]{2,})(?:e|ème)|[IVXLCDM]+)(?![\p{L}\p{N}'’ʼ`´])/u

// Accepted answers shorter than this never tolerate a typo, then one typo up
// to the next threshold, two beyond.
const ONE_TYPO_FROM = 6

const TWO_TYPOS_FROM = 12

// Lengths and typos are counted in code points: once composed by NFKC, an
// accented letter is one character, as a player sees it.
const codePoints = (text: string): string[] => Array.from(text)

/**
 * What a player typed, as stored and shown: raw length bounded first, then
 * NFKC, invisible characters removed, spaces collapsed and trimmed.
 */
export const cleanInput = (raw: string): string =>
  raw
    .slice(0, SHORTANSWER_LIMITS.RAW_LENGTH)
    .normalize("NFKC")
    .replace(CONTROL_SPACES, " ")
    .replace(INVISIBLES, "")
    .replace(SPACES, " ")
    .trim()

/** Length of an input as the phone counter and the server count it. */
export const countInputChars = (raw: string): number =>
  codePoints(cleanInput(raw)).length

/**
 * Comparison key of a text: case, accents, apostrophe and dash variants and
 * punctuation are ignored. An empty key never matches anything.
 */
export const answerKey = (text: string): string => {
  const folded = cleanInput(text)
    .toLowerCase()
    .replace(APOSTROPHES, "'")
    .replace(DASHES, "-")
    .replaceAll("œ", "oe")
    .replaceAll("æ", "ae")
    .normalize("NFD")
    .replace(ACCENTS, "")
    .replace(DIGIT_GROUP_SPACE, "")

  return folded.replace(PUNCTUATION, " ").replace(SPACES, " ").trim()
}

// Restricted Damerau-Levenshtein (optimal string alignment): insertions,
// deletions, substitutions and swaps of two neighbours, each costing 1.
const typoDistance = (source: string, target: string): number => {
  const a = codePoints(source)
  const b = codePoints(target)
  const rows: number[][] = []

  for (let i = 0; i <= a.length; i += 1) {
    const row = [i]

    for (let j = 1; j <= b.length; j += 1) {
      if (i === 0) {
        row.push(j)

        continue
      }

      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let distance = Math.min(
        rows[i - 1][j] + 1,
        row[j - 1] + 1,
        rows[i - 1][j - 1] + cost,
      )

      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        distance = Math.min(distance, rows[i - 2][j - 2] + 1)
      }

      row.push(distance)
    }

    rows.push(row)
  }

  return rows[a.length][b.length]
}

// Typos tolerated against an accepted answer, given with its key. A number is
// never approximated: 1914 must not accept 1915, nor Henri IV Henri VI.
const allowedTypos = (accepted: string, key: string): number => {
  const { length } = codePoints(key)

  if (
    DIGIT.test(key) ||
    ROMAN_NUMERAL.test(cleanInput(accepted)) ||
    length < ONE_TYPO_FROM
  ) {
    return 0
  }

  return length < TWO_TYPOS_FROM ? 1 : 2
}

/**
 * Index of the accepted answer an input matches, or -1. An exact key match
 * wins; otherwise, with typoTolerance, the closest accepted answer within its
 * allowance, the first one on a tie.
 */
export const matchAccepted = (
  accepted: readonly string[],
  input: string,
  { typoTolerance = false }: { typoTolerance?: boolean } = {},
): number => {
  const key = answerKey(input)

  if (key === "") {
    return -1
  }

  const keys = accepted.map(answerKey)
  const exact = keys.indexOf(key)

  if (exact !== -1 || !typoTolerance) {
    return exact
  }

  let best = -1
  let bestDistance = Number.POSITIVE_INFINITY

  for (const [index, candidate] of keys.entries()) {
    const allowed = allowedTypos(accepted[index], candidate)

    // Cheap bound first: each typo changes the length by one at most.
    if (
      allowed === 0 ||
      Math.abs(codePoints(candidate).length - codePoints(key).length) > allowed
    ) {
      continue
    }

    const distance = typoDistance(candidate, key)

    if (distance <= allowed && distance < bestDistance) {
      best = index
      bestDistance = distance
    }
  }

  return best
}
