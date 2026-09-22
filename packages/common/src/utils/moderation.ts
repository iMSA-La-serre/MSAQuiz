import { answerKey, cleanInput } from "@razzia/common/utils/text"

// Word cloud moderation: what a player types shows on the projector, so a
// word is dropped when it is a common French swear word or insult, or when it
// holds contact details (e-mail address, URL, phone number). Pure, shared by
// the server (which filters) and the tests.

// Compared on their key (answerKey): case, accents and punctuation ignored.
// A single word is looked for among the words of the input, so it also
// catches the expressions built on it (« fils de pute »), and its plural (s or
// x); feminine forms are listed. Several words are looked for as a sequence.
// Words with a common innocent meaning are left out (queue, chatte, baiser,
// fumier, tare...): the host can still hide a word live, and a caisse can add
// its own list in moderation.txt.
const BUILTIN_WORDS = [
  "abruti",
  "abrutie",
  "asshole",
  "baltringue",
  "bâtard",
  "bâtarde",
  "bicot",
  "bitch",
  "bite",
  "bordel",
  "bougnoul",
  "bougnoule",
  "branleur",
  "branleuse",
  "branlette",
  "cassos",
  "chiant",
  "chiante",
  "chier",
  "chieur",
  "chieuse",
  "chiottes",
  "con",
  "conne",
  "connard",
  "connasse",
  "connerie",
  "couille",
  "couillon",
  "couillonne",
  "crétin",
  "crétine",
  "débile",
  "emmerdement",
  "emmerder",
  "emmerdeur",
  "emmerdeuse",
  "enculé",
  "enculée",
  "enculer",
  "enfoiré",
  "enfoirée",
  "fdp",
  "feignasse",
  "foutre",
  "fuck",
  "fucking",
  "glandeur",
  "glandeuse",
  "gogol",
  "gouine",
  "grognasse",
  "idiot",
  "idiote",
  "imbécile",
  "merde",
  "merdeuse",
  "merdeux",
  "merdique",
  "motherfucker",
  "nègre",
  "négresse",
  "nichon",
  "nique",
  "niquer",
  "ntm",
  "pd",
  "pédé",
  "pétasse",
  "pouffiasse",
  "poufiasse",
  "pute",
  "putain",
  "raclure",
  "salaud",
  "salop",
  "salopard",
  "salope",
  "saloperie",
  "shit",
  "ta gueule",
  "tafiole",
  "tarlouze",
  "teub",
  "tête de nœud",
  "tg",
  "trou du cul",
  "trouduc",
  "wtf",
  "youpin",
  "youpine",
  "zob",
]

// An e-mail address, even without a known domain.
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]{2,}/u

// A link, or a bare domain name (msa.fr, exemple.com).
const URL_PATTERN =
  /(?:https?:\/\/|www\.)|(?<![\p{L}\p{N}])[\p{L}\p{N}-]+\.(?:fr|com|net|org|eu|info|io|be|ch|ca|biz|me|co|tv|app|xyz|gouv)(?![\p{L}\p{N}])/iu

// Nine digits or more, spaced or not (06 12 34 56 78, +33 6...): a phone
// number, not a year or a range of years (2025-2026).
const PHONE = /\p{Nd}(?:[\s.\-/()]*\p{Nd}){8,}/u

// A letter repeated three times or more (« merdeee »), read once and twice.
const LONG_RUN = /(\p{L})\1{2,}/gu

export interface Blocklist {
  // Keys of one word, compared with each word of the input.
  words: ReadonlySet<string>
  // Keys of several words, looked for as a sequence of whole words.
  phrases: readonly string[]
}

/**
 * The words refused by a word cloud: the built-in list plus `extra` (the
 * lines of moderation.txt), all compared on their key.
 */
export const buildBlocklist = (extra: readonly string[] = []): Blocklist => {
  const words = new Set<string>()
  const phrases = new Set<string>()

  for (const entry of [...BUILTIN_WORDS, ...extra]) {
    const key = answerKey(entry)

    if (key === "") {
      continue
    }

    if (key.includes(" ")) {
      phrases.add(key)
    } else {
      words.add(key)
    }
  }

  return { words, phrases: [...phrases] }
}

export const BUILTIN_BLOCKLIST = buildBlocklist()

/** The lines of a moderation.txt: one entry per line, # starts a comment. */
export const parseModerationList = (content: string): string[] =>
  content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))

// The forms a word of the input is compared as: itself, without a plural
// mark, and with its long letter runs shortened.
const variantsOf = (word: string): string[] => {
  const variants = [
    word,
    word.replace(LONG_RUN, "$1"),
    word.replace(LONG_RUN, "$1$1"),
  ]

  return variants.flatMap((variant) =>
    variant.length > 3 && /[sx]$/u.test(variant)
      ? [variant, variant.slice(0, -1)]
      : [variant],
  )
}

/** Whether a contact detail shows in a text: e-mail, URL or phone number. */
export const hasContactDetails = (text: string): boolean => {
  const cleaned = cleanInput(text)

  return EMAIL.test(cleaned) || URL_PATTERN.test(cleaned) || PHONE.test(cleaned)
}

/**
 * Whether a word cloud entry must be dropped: it holds a word or a phrase of
 * the blocklist, or contact details.
 */
export const isBlocked = (
  text: string,
  blocklist: Blocklist = BUILTIN_BLOCKLIST,
): boolean => {
  if (hasContactDetails(text)) {
    return true
  }

  const words = answerKey(text).split(" ")

  if (
    words.some((word) =>
      variantsOf(word).some((variant) => blocklist.words.has(variant)),
    )
  ) {
    return true
  }

  const padded = ` ${words.join(" ")} `

  return blocklist.phrases.some((phrase) => padded.includes(` ${phrase} `))
}
