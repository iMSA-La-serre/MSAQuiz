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

export const QUESTION_TYPES = {
  SINGLE: "single",
  MULTI: "multi",
  TRUEFALSE: "truefalse",
  POLL: "poll",
  SLIDE: "slide",
  ORDERING: "ordering",
  SHORTANSWER: "shortanswer",
  WORDCLOUD: "wordcloud",
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

// Longest ordering item, in characters as counted by countInputChars.
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
