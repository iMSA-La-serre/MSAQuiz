export const EVENTS = {
  GAME: {
    STATUS: "game:status",
    SUCCESS_ROOM: "game:successRoom",
    SUCCESS_JOIN: "game:successJoin",
    TOTAL_PLAYERS: "game:totalPlayers",
    ERROR_MESSAGE: "game:errorMessage",
    START_COOLDOWN: "game:startCooldown",
    COOLDOWN: "game:cooldown",
    RESET: "game:reset",
    UPDATE_QUESTION: "game:updateQuestion",
    PLAYER_ANSWER: "game:playerAnswer",
    CREATE: "game:create",
  },
  PLAYER: {
    SUCCESS_RECONNECT: "player:successReconnect",
    UPDATE_LEADERBOARD: "player:updateLeaderboard",
    JOIN: "player:join",
    LOGIN: "player:login",
    RECONNECT: "player:reconnect",
    LEAVE: "player:leave",
    SELECTED_ANSWER: "player:selectedAnswer",
    CHECK_CODE: "player:checkCode",
    CHECK_CODE_RESULT: "player:checkCodeResult",
  },
  MANAGER: {
    SUCCESS_RECONNECT: "manager:successReconnect",
    CONFIG: "manager:config",
    GAME_CREATED: "manager:gameCreated",
    STATUS_UPDATE: "manager:statusUpdate",
    NEW_PLAYER: "manager:newPlayer",
    REMOVE_PLAYER: "manager:removePlayer",
    ERROR_MESSAGE: "manager:errorMessage",
    PLAYER_KICKED: "manager:playerKicked",
    AUTH: "manager:auth",
    RECONNECT: "manager:reconnect",
    LEAVE: "manager:leave",
    KICK_PLAYER: "manager:kickPlayer",
    START_GAME: "manager:startGame",
    ABORT_QUIZ: "manager:abortQuiz",
    NEXT_QUESTION: "manager:nextQuestion",
    SHOW_LEADERBOARD: "manager:showLeaderboard",
    GET_CONFIG: "manager:getConfig",
    LOGOUT: "manager:logout",
    UNAUTHORIZED: "manager:unauthorized",
  },
  QUIZZ: {
    GET: "quizz:get",
    DATA: "quizz:data",
    SAVE: "quizz:save",
    SAVE_SUCCESS: "quizz:saveSuccess",
    IMPORT_XLSX: "quizz:importXlsx",
    UPDATE: "quizz:update",
    UPDATE_SUCCESS: "quizz:updateSuccess",
    DELETE: "quizz:delete",
    ERROR: "quizz:error",
  },
  RESULTS: {
    GET: "results:get",
    DATA: "results:data",
    DELETE: "results:delete",
    EXPORT: "results:export",
    EXPORT_DATA: "results:exportData",
  },
  STATS: {
    LIST: "stats:list",
    LIST_DATA: "stats:listData",
    GET: "stats:get",
    DATA: "stats:data",
    ERROR: "stats:error",
  },
} as const

export const NO_TIME_LIMIT = -1

export const MAX_POINTS = 1000

/**
 * Game codes players type to join: 5 characters from an alphabet without
 * look-alikes (no 0/O, no 1/I/L), so a code read aloud or off a projector is
 * never ambiguous. There is no E either: the join link carries the code as a
 * URL search param, and the router would read a code like "2E345" as a number.
 */
export const INVITE_CODE_LENGTH = 5

export const INVITE_CODE_ALPHABET = "ABCDFGHJKMNPQRSTUVWXYZ23456789"

// Highlight: a short text whose passages between [brackets] are the answers
// players tap.
export const HIGHLIGHT_LIMITS = {
  MIN_PASSAGES: 2,
  // The distribution has a row per passage: five compact rows fit a 1280×650
  // projector under a question on two lines, as the ranges of an estimate;
  // six no longer do.
  MAX_PASSAGES: 5,
  // Characters of the text once cleaned, brackets left out, counted by code
  // point (highlightLength): two or three sentences, which a phone shows
  // without a long scroll.
  TEXT_LENGTH: 300,
  // Characters of each passage, as counted by countInputChars.
  PASSAGE_LENGTH: 80,
  // Raw UTF-16 length of the text, bounded before it is parsed.
  RAW_LENGTH: 2000,
} as const

// Statements and categorize: items, each matched with one of the targets
// (Vrai or Faux, or one of the categories).
export const ASSOCIATION_LIMITS = {
  MIN_ITEMS: 2,
  // The distribution has a row per item, each labelled with its right
  // target: five compact rows fit a 1280×650 projector, as the passages of
  // a highlight.
  MAX_ITEMS: 5,
  // Characters of each item, as counted by countInputChars: one line on the
  // distribution rows, next to the figures, up to a 1366 px wide projector.
  // Five rows of two lines would not fit a 1280×650 one.
  ITEM_LENGTH: 50,
  // Categories of a categorize question.
  MIN_TARGETS: 2,
  MAX_TARGETS: 4,
  // Characters of each category, as counted by countInputChars: four of them
  // share a phone row.
  TARGET_LENGTH: 24,
} as const

// Markers: numbered spots the author places on the question's image, one per
// answer, which carries the marker's label.
export const MARKERS_LIMITS = {
  MIN_MARKERS: 2,
  // The distribution has a row per marker: six compact rows fit a 1280×650
  // projector under the image, as the levels of a scale do under a question
  // on two lines.
  MAX_MARKERS: 6,
  // Characters of each label, as counted by countInputChars: one line on the
  // distribution rows, next to the figures, and one line on a 360 px phone
  // row next to the number.
  LABEL_LENGTH: 40,
  // A position is a percentage of the image, rounded to a whole one: the
  // screens place the markers from it, so nothing depends on the size the
  // image is shown at.
  MIN_PERCENT: 0,
  MAX_PERCENT: 100,
} as const

// Scale: levels from `scaleMin` to `scaleMax`, one row each in the
// distribution.
export const SCALE_LIMITS = {
  // The scale starts at 0 or at 1, and ends at 8 at the latest.
  MIN_START: 0,
  MAX_START: 1,
  MAX_END: 8,
  // Levels a scale may hold: under three nothing is being graded, and past
  // eight the distribution has more rows than a 1280×650 projector holds
  // under a question on two lines, even at its thinnest (isTinyList).
  MIN_LEVELS: 3,
  MAX_LEVELS: 8,
  // Characters of each end label, as counted by countInputChars: the two of
  // them share a phone line under the levels.
  LABEL_LENGTH: 24,
  // Players who had to answer the scale — a level picked or « Je préfère ne
  // pas répondre » — for the history to keep the counts: with fewer, who
  // answered would tell who picked what. The room still sees them live.
  MIN_ANSWERS: 3,
} as const

// The scale a new question starts from.
export const SCALE_DEFAULTS = { START: 1, END: 5 } as const

// The targets of a statements question, imposed.
export const STATEMENT_TARGETS = ["Vrai", "Faux"] as const

export const QUESTION_TYPES = {
  SINGLE: "single",
  MULTI: "multi",
  TRUEFALSE: "truefalse",
  POLL: "poll",
  SLIDE: "slide",
  ORDERING: "ordering",
  SHORTANSWER: "shortanswer",
  WORDCLOUD: "wordcloud",
  ESTIMATE: "estimate",
  HIGHLIGHT: "highlight",
  STATEMENTS: "statements",
  CATEGORIZE: "categorize",
  RANKING: "ranking",
  SCALE: "scale",
  MARKERS: "markers",
} as const

/**
 * Per-type capabilities, consumed by the validator, the game engine and the
 * editor. Adding a question type = add its entry here + registry entries.
 *
 * `answersCount` marks a type whose answers are fixed (both in number and in
 * wording): the validator enforces the count, and the editor renders them
 * read-only instead of the add/remove controls.
 *
 * `minAnswers` and `maxAnswers` bound the public `answers` list; a type with
 * a maximum of 0 has its answers dropped on save.
 *
 * `speedBonus` is the default of the per-question switch: when off, a player
 * who scores gets the base points whatever the time or answer order.
 *
 * `partialOutcome` reports a multiplier strictly between 0 and 1 as a
 * "partial" outcome instead of "correct".
 *
 * `nominative` keeps each player's answer in the history. Without it, the
 * history keeps whether each player answered and, at the question level, a
 * count of the answers: nothing links an answer to a username, neither in the
 * results, the statistics, the export nor the logs.
 */
export const QUESTION_TYPE_META: Record<
  (typeof QUESTION_TYPES)[keyof typeof QUESTION_TYPES],
  {
    scored: boolean
    acceptsAnswers: boolean
    answersCount?: number
    minAnswers: number
    maxAnswers: number
    speedBonus: boolean
    partialOutcome: boolean
    nominative: boolean
  }
> = {
  single: {
    scored: true,
    acceptsAnswers: true,
    minAnswers: 2,
    maxAnswers: 4,
    speedBonus: true,
    partialOutcome: false,
    nominative: true,
  },
  multi: {
    scored: true,
    acceptsAnswers: true,
    minAnswers: 2,
    maxAnswers: 4,
    speedBonus: true,
    partialOutcome: false,
    nominative: true,
  },
  truefalse: {
    scored: true,
    acceptsAnswers: true,
    answersCount: 2,
    minAnswers: 2,
    maxAnswers: 2,
    speedBonus: true,
    partialOutcome: false,
    nominative: true,
  },
  poll: {
    scored: false,
    acceptsAnswers: true,
    minAnswers: 2,
    maxAnswers: 4,
    speedBonus: true,
    partialOutcome: false,
    nominative: true,
  },
  slide: {
    scored: false,
    acceptsAnswers: false,
    minAnswers: 0,
    maxAnswers: 0,
    speedBonus: true,
    partialOutcome: false,
    nominative: true,
  },
  // Answers are the items, stored in the correct order.
  ordering: {
    scored: true,
    acceptsAnswers: true,
    minAnswers: 3,
    maxAnswers: 6,
    speedBonus: false,
    partialOutcome: true,
    nominative: true,
  },
  // No public answers: the player types a text, compared to `accepted`.
  shortanswer: {
    scored: true,
    acceptsAnswers: true,
    minAnswers: 0,
    maxAnswers: 0,
    speedBonus: false,
    partialOutcome: false,
    nominative: true,
  },
  // No public answers: each player types 1 to 3 words (options.wordCount),
  // only counted at the question level.
  wordcloud: {
    scored: false,
    acceptsAnswers: true,
    minAnswers: 0,
    maxAnswers: 0,
    speedBonus: false,
    partialOutcome: false,
    nominative: false,
  },
  // No public answers: the player types a number, right within a tolerance
  // of `expected`, which stays secret.
  estimate: {
    scored: true,
    acceptsAnswers: true,
    minAnswers: 0,
    maxAnswers: 0,
    speedBonus: false,
    partialOutcome: false,
    nominative: true,
  },
  // Answers are the passages of `text`, set between [brackets], in the order
  // they come; the ones to spot are `solutions`, scored as a multi.
  highlight: {
    scored: true,
    acceptsAnswers: true,
    minAnswers: HIGHLIGHT_LIMITS.MIN_PASSAGES,
    maxAnswers: HIGHLIGHT_LIMITS.MAX_PASSAGES,
    speedBonus: false,
    partialOutcome: true,
    nominative: true,
  },
  // Answers are the statements, each true or false (STATEMENT_TARGETS); the
  // right one of each is in `expectedTargets`, which stays secret.
  statements: {
    scored: true,
    acceptsAnswers: true,
    minAnswers: ASSOCIATION_LIMITS.MIN_ITEMS,
    maxAnswers: ASSOCIATION_LIMITS.MAX_ITEMS,
    speedBonus: false,
    partialOutcome: true,
    nominative: true,
  },
  // Answers are the items to sort into `targets`, the categories; the right
  // category of each is in `expectedTargets`, which stays secret.
  categorize: {
    scored: true,
    acceptsAnswers: true,
    minAnswers: ASSOCIATION_LIMITS.MIN_ITEMS,
    maxAnswers: ASSOCIATION_LIMITS.MAX_ITEMS,
    speedBonus: false,
    partialOutcome: true,
    nominative: true,
  },
  // Answers are the proposals, in the order the author wrote them; players
  // rank them all, and nobody is right or wrong.
  ranking: {
    scored: false,
    acceptsAnswers: true,
    minAnswers: 3,
    maxAnswers: 6,
    speedBonus: false,
    partialOutcome: false,
    nominative: true,
  },
  // No public answers: the player picks one level of the scale set in the
  // options, only counted at the question level.
  scale: {
    scored: false,
    acceptsAnswers: true,
    minAnswers: 0,
    maxAnswers: 0,
    speedBonus: false,
    partialOutcome: false,
    nominative: false,
  },
  // Answers are the labels of the markers placed on the question's image,
  // whose positions are in `markers`; the right ones are `solutions`, as on a
  // single choice, or as on a multiple choice from two of them on.
  markers: {
    scored: true,
    acceptsAnswers: true,
    minAnswers: MARKERS_LIMITS.MIN_MARKERS,
    maxAnswers: MARKERS_LIMITS.MAX_MARKERS,
    // One tap, as on a single choice.
    speedBonus: true,
    partialOutcome: false,
    nominative: true,
  },
}

export const SCORING_MODES = {
  STRICT: "strict",
  BALANCED: "balanced",
  LENIENT: "lenient",
} as const

// Ordering: share of items at their place, or all or nothing.
export const ORDER_SCORING = {
  POSITION: "position",
  EXACT: "exact",
} as const

// Statements and categorize: share of items matched with their right target,
// or all or nothing.
export const MATCH_SCORING = {
  SHARE: "share",
  EXACT: "exact",
} as const

// Longest ordering or ranking item, in characters as counted by
// countInputChars.
export const ORDERING_ITEM_MAX_LENGTH = 80

export const SHORTANSWER_LIMITS = {
  // Characters a player may type, as counted by countInputChars.
  INPUT_LENGTH: 60,
  // Accepted answers per question, and characters in each one.
  ACCEPTED_COUNT: 10,
  ACCEPTED_LENGTH: 60,
  // Raw UTF-16 length cut before any processing, and cap of the socket
  // payload: keeps the normalization cost bounded whatever a client sends.
  RAW_LENGTH: 200,
} as const

export const WORDCLOUD_LIMITS = {
  // Fields on the phone, set per question with options.wordCount.
  MIN_WORDS: 1,
  MAX_WORDS: 3,
  // Characters in each word or expression, as counted by countInputChars.
  WORD_LENGTH: 30,
  // Raw UTF-16 length of each text in the socket payload, the cut cleanInput
  // makes anyway.
  RAW_LENGTH: SHORTANSWER_LIMITS.RAW_LENGTH,
  // Words the host screen shows, the most frequent first.
  CLOUD_WORDS: 30,
  // Players whose words the history needs to keep them: with fewer, who
  // answered would tell who typed which word. The room still sees them live.
  MIN_AUTHORS: 3,
} as const

// Estimate: the tolerance is in the question's unit, or a share of the right
// value.
export const ESTIMATE_TOLERANCE = {
  ABSOLUTE: "absolute",
  PERCENT: "percent",
} as const

export const ESTIMATE_LIMITS = {
  // Digits before the decimal separator: 999 999 999 999 at most, so a value
  // scaled by 10^MAX_DECIMALS stays a safe integer.
  INTEGER_DIGITS: 12,
  MAX_DECIMALS: 3,
  // A percent tolerance: 100 at most, one decimal.
  MAX_PERCENT: 100,
  PERCENT_DECIMALS: 1,
  // Characters of the unit shown after the numbers, as counted by
  // countInputChars.
  UNIT_LENGTH: 20,
  // Ranges of the distribution besides the one within the tolerance.
  OTHER_RANGES: 4,
} as const

export const MEDIA_TYPES = {
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
} as const

// Seeded on first start: one question of each answerable type, so a new
// instance can run a full game straight away.
export const EXAMPLE_QUIZZ = {
  subject: "Quiz d'exemple",
  questions: [
    {
      type: QUESTION_TYPES.SINGLE,
      question:
        "Combien de temps met la lumière du Soleil pour atteindre la Terre ?",
      answers: ["8 secondes", "8 minutes", "8 heures", "8 jours"],
      solutions: [1],
      cooldown: 5,
      time: 20,
    },
    {
      type: QUESTION_TYPES.TRUEFALSE,
      question: "D'un point de vue botanique, la tomate est un fruit.",
      answers: ["Vrai", "Faux"],
      solutions: [0],
      cooldown: 5,
      time: 15,
    },
    {
      type: QUESTION_TYPES.MULTI,
      question: "Lesquelles de ces planètes sont des géantes gazeuses ?",
      answers: ["Jupiter", "Mars", "Saturne", "Vénus"],
      solutions: [0, 2],
      options: { scoringMode: SCORING_MODES.BALANCED },
      cooldown: 5,
      time: 20,
    },
    {
      type: QUESTION_TYPES.POLL,
      question: "Quel format préférez-vous pour les prochains quiz ?",
      answers: ["En équipe", "En solo", "Les deux"],
      cooldown: 5,
      time: 15,
    },
  ],
} as const
