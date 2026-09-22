import { WORDCLOUD_LIMITS } from "@razzia/common/constants"

// Sizes and colours of the words in the host's word cloud, and how many fit.
// Pure, so they can be tested without a DOM.

// Font sizes, smallest first: at least 20 px bold, large text. A tall
// projector (the xl:tall: variants of index.css) lifts the two smallest, the
// size of most words in a large room.
export const WORD_SIZES = [
  "text-xl xl:tall:text-2xl",
  "text-2xl xl:tall:text-3xl",
  "text-3xl xl:text-4xl short:text-3xl",
  "text-4xl xl:text-5xl short:text-4xl",
  "text-5xl xl:text-6xl short:text-5xl",
] as const

// Dark colours of the charte, in turn: they carry no meaning. The green
// (3:1 on white) would fade on a projector.
export const WORD_COLORS = ["text-secondary", "text-serre-deep"] as const

export interface CloudRoom {
  // Words shown at most.
  words: number
  // Room in the card, in characters of the smallest size.
  weight: number
  // Width of a character of each size, in characters of the smallest one.
  factors: readonly number[]
}

export type CloudScreen = "short" | "regular" | "tall"

// A short projector (the short: variant of index.css) shows 20 words at
// most, in the room measured on 1280×650; a regular one 30, in the room of
// 1280×900; a tall one (xl:tall:, 1280 px wide and 1000 px high or more)
// 30 too, in the room of 1920×1000 with its larger small sizes. The card is
// as wide on all three past 1072 px. Past the room, the rarest words are left
// out: the cloud never pushes the screen past its height, even when every
// word is a long expression.
export const CLOUD_ROOMS = {
  short: { words: 20, weight: 360, factors: [1, 1.2, 1.5, 1.8, 2.4] },
  regular: {
    words: WORDCLOUD_LIMITS.CLOUD_WORDS,
    weight: 480,
    factors: [1, 1.2, 1.8, 2.4, 3],
  },
  tall: {
    words: WORDCLOUD_LIMITS.CLOUD_WORDS,
    weight: 540,
    factors: [1, 1.25, 1.5, 2, 2.5],
  },
} as const satisfies Record<CloudScreen, CloudRoom>

// Padding and gap around a word, in characters.
const WORD_MARGIN = 3

/**
 * How many words, the most frequent first, fit the room of the card: each
 * takes its characters and margin at the width of its size.
 */
export const wordsInRoom = (
  texts: readonly string[],
  sizes: readonly number[],
  room: CloudRoom,
): number => {
  let used = 0

  for (const [index, text] of texts.entries()) {
    used += (Array.from(text).length + WORD_MARGIN) * room.factors[sizes[index]]

    if (index === room.words || used > room.weight) {
      return index
    }
  }

  return texts.length
}

/** How many words each projector shows. */
export const cloudCounts = (
  texts: readonly string[],
  sizes: readonly number[],
): Record<CloudScreen, number> => ({
  short: wordsInRoom(texts, sizes, CLOUD_ROOMS.short),
  regular: wordsInRoom(texts, sizes, CLOUD_ROOMS.regular),
  tall: wordsInRoom(texts, sizes, CLOUD_ROOMS.tall),
})

// Classes showing or hiding an element on each projector: a regular one
// takes the plain classes, short and tall ones never overlap.
const SCREEN_DISPLAY = {
  short: { shown: "short:block", hidden: "short:hidden" },
  tall: { shown: "xl:tall:block", hidden: "xl:tall:hidden" },
} as const

/**
 * Classes of the word at `index`: shown on the projectors whose count it is
 * under, hidden on the others (and so from screen readers there).
 */
export const wordDisplay = (
  index: number,
  counts: Record<CloudScreen, number>,
): string => {
  const inRegular = index < counts.regular
  const classes = inRegular ? [] : ["hidden"]

  for (const screen of ["short", "tall"] as const) {
    const inScreen = index < counts[screen]

    if (inScreen !== inRegular) {
      classes.push(SCREEN_DISPLAY[screen][inScreen ? "shown" : "hidden"])
    }
  }

  return classes.join(" ")
}

// Classes of the text only one projector shows, inline.
export const SCREEN_ONLY: Record<CloudScreen, string> = {
  short: "hidden short:inline",
  regular: "short:hidden xl:tall:hidden",
  tall: "hidden xl:tall:inline",
}

// Longest words, in characters, that the two largest sizes hold on one line
// of the card.
const LARGEST_SIZE_LENGTH = 14

const LARGE_SIZE_LENGTH = 22

/**
 * A size at most as large as a word can take on one line of the card: a long
 * expression given the most would not fit at the largest size.
 */
export const fitSize = (size: number, text: string): number => {
  const { length } = Array.from(text)

  if (length > LARGE_SIZE_LENGTH) {
    return Math.min(size, 2)
  }

  return length > LARGEST_SIZE_LENGTH ? Math.min(size, 3) : size
}

/**
 * Size of each word, as an index into WORD_SIZES: the square root of its
 * count (the area of a word grows with its count), from the rarest word to
 * the most frequent one. Words all given as often take the middle size.
 */
export const wordSizes = (counts: readonly number[]): number[] => {
  if (counts.length === 0) {
    return []
  }

  const roots = counts.map((count) => Math.sqrt(Math.max(0, count)))
  const min = Math.min(...roots)
  const max = Math.max(...roots)
  const top = WORD_SIZES.length - 1

  if (max === min) {
    return counts.map(() => Math.floor(top / 2))
  }

  return roots.map((root) => Math.round(((root - min) / (max - min)) * top))
}

export const wordColor = (index: number): string =>
  WORD_COLORS[index % WORD_COLORS.length]
