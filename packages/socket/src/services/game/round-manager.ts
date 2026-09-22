// oxlint-disable typescript/no-unnecessary-condition
import {
  EVENTS,
  MAX_POINTS,
  MEDIA_TYPES,
  NO_TIME_LIMIT,
  QUESTION_TYPE_META,
  QUESTION_TYPES,
  WORDCLOUD_LIMITS,
} from "@razzia/common/constants"
import type {
  Answer,
  AnswerPayload,
  GameResult,
  PublicPlayer,
  Question,
  QuestionResult,
  QuestionType,
  QuizzWithId,
  WordCount,
} from "@razzia/common/types/game"
import type { Server, Socket } from "@razzia/common/types/game/socket"
import {
  type LeaderboardEntry,
  type ResultOutcome,
  type Status,
  STATUS,
  type StatusDataMap,
} from "@razzia/common/types/game/status"
import { estimateRanges, medianOf } from "@razzia/common/utils/estimate"
import {
  BUILTIN_BLOCKLIST,
  type Blocklist,
  buildBlocklist,
} from "@razzia/common/utils/moderation"
import { placedItems } from "@razzia/common/utils/ordering"
import { countWords } from "@razzia/common/utils/wordcloud"
import { CooldownTimer } from "@razzia/socket/services/game/cooldown-timer"
import { PlayerManager } from "@razzia/socket/services/game/player-manager"
import {
  type PublicAnswers,
  toPublicAnswers,
} from "@razzia/socket/services/game/public-answers"
import { QUESTION_SCORING } from "@razzia/socket/services/scoring"
import {
  answerParser,
  countResponses,
} from "@razzia/socket/services/scoring/answers"
import { orderToPoint, timeToPoint } from "@razzia/socket/utils/game"
import sleep from "@razzia/socket/utils/sleep"
import { nanoid } from "nanoid"

type BroadcastFn = <T extends Status>(
  _status: T,
  _data: StatusDataMap[T],
) => void
type SendFn = <T extends Status>(
  _target: string,
  _status: T,
  _data: StatusDataMap[T],
) => void

export interface RoundManagerOptions {
  quizz: QuizzWithId
  players: PlayerManager
  cooldown: CooldownTimer
  io: Server
  gameId: string
  getManagerId: () => string
  broadcast: BroadcastFn
  send: SendFn
  onNewQuestion: () => void
  onGameFinished: (_result: GameResult) => void
  // Words a word cloud drops besides the built-in list (moderation.txt),
  // read when such a question starts.
  moderationWords?: () => readonly string[]
}

// Heading shown on the player's result screen, as an i18n key.
const RESULT_MESSAGES: Record<ResultOutcome, string> = {
  correct: "game:correct",
  partial: "game:partial",
  wrong: "game:wrong",
  noAnswer: "game:noAnswer",
  voted: "game:pollAnswered",
  noVote: "game:pollNoVote",
}

// Types with their own heading for some outcomes.
const TYPE_RESULT_MESSAGES: Partial<
  Record<QuestionType, Partial<Record<ResultOutcome, string>>>
> = {
  wordcloud: { voted: "game:wordcloudAnswered", noVote: "game:noAnswer" },
}

// Scored types that existed before partial credit: their outcome keeps
// following the points earned. The others follow the multiplier alone, so a
// recognized answer worth 0 points (maxPoints 0, speed bonus run out) is still
// correct and never penalized.
const POINTS_OUTCOME_TYPES = new Set<QuestionType>([
  QUESTION_TYPES.SINGLE,
  QUESTION_TYPES.MULTI,
  QUESTION_TYPES.TRUEFALSE,
])

// How the round ended for one player.
const roundOutcome = (
  type: QuestionType,
  {
    answered,
    score,
    points,
  }: { answered: boolean; score: number; points: number },
): ResultOutcome => {
  const { scored, partialOutcome } = QUESTION_TYPE_META[type]

  // Unscored types (poll, wordcloud): confirm the vote, or flag the missing
  // one, never claim a vote that was not cast.
  if (!scored) {
    return answered ? "voted" : "noVote"
  }

  if (!answered) {
    return "noAnswer"
  }

  if (POINTS_OUTCOME_TYPES.has(type)) {
    return points > 0 ? "correct" : "wrong"
  }

  if (score === 1 || (score > 0 && !partialOutcome)) {
    return "correct"
  }

  return score > 0 ? "partial" : "wrong"
}

// The final top goes to every player: only what a ranking row shows, never
// the clientId that lets its holder take over a seat.
const toPublicPlayer = ({
  id,
  connected,
  username,
  points,
  correctInARow,
}: PublicPlayer): PublicPlayer => ({
  id,
  connected,
  username,
  points,
  correctInARow,
})

export class RoundManager {
  private readonly opts: RoundManagerOptions
  private started = false
  private currentQuestion = 0
  private playersAnswers: Answer[] = []
  // The answer list of the current question as players see it.
  private publicAnswers: PublicAnswers = { answers: [], order: [] }
  // Words the current word cloud drops.
  private blocklist: Blocklist = BUILTIN_BLOCKLIST
  private startTime = 0
  // Answers only count while SELECT_ANSWER is on screen: not during the
  // reading time, and not once the results are out.
  private acceptingAnswers = false
  private leaderboard: LeaderboardEntry[] = []
  private questionsHistory: QuestionResult[] = []

  constructor(opts: RoundManagerOptions) {
    this.opts = opts
  }

  isStarted(): boolean {
    return this.started
  }

  getReconnectInfo() {
    return {
      current: this.currentQuestion + 1,
      total: this.opts.quizz.questions.length,
    }
  }

  async start(socket: Socket): Promise<void> {
    if (this.opts.getManagerId() !== socket.id) {
      return
    }

    if (this.started) {
      return
    }

    if (this.opts.players.count() === 0) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:game.noPlayersConnected")

      return
    }

    this.started = true

    this.opts.broadcast(STATUS.SHOW_START, {
      time: 3,
      subject: this.opts.quizz.subject,
    })

    await sleep(3)

    this.opts.io.to(this.opts.gameId).emit(EVENTS.GAME.START_COOLDOWN)
    await this.opts.cooldown.start(3)

    void this.newQuestion()
  }

  async newQuestion(): Promise<void> {
    if (!this.started) {
      return
    }

    const question = this.opts.quizz.questions[this.currentQuestion]

    // Drawn once: every screen, and any reconnection, shows this same list.
    this.publicAnswers = toPublicAnswers(question)
    const { answers } = this.publicAnswers

    // Read at each word cloud, so an edited moderation.txt applies to the
    // next one without a restart.
    if (question.type === QUESTION_TYPES.WORDCLOUD) {
      this.blocklist = buildBlocklist(this.opts.moderationWords?.() ?? [])
    }

    this.opts.onNewQuestion()

    this.opts.io.to(this.opts.gameId).emit(EVENTS.GAME.UPDATE_QUESTION, {
      current: this.currentQuestion + 1,
      total: this.opts.quizz.questions.length,
    })

    this.opts.broadcast(STATUS.SHOW_PREPARED, {
      totalAnswers: answers.length,
      questionNumber: this.currentQuestion + 1,
      questionType: question.type,
    })

    await sleep(2)

    if (!this.started) {
      return
    }

    const imageMedia =
      question.media?.type === MEDIA_TYPES.IMAGE ? question.media : undefined
    const upcomingMedia =
      question.media?.type === MEDIA_TYPES.VIDEO ||
      question.media?.type === MEDIA_TYPES.AUDIO
        ? question.media.type
        : undefined

    // The answers are shown during the reading time, but never the solutions
    // (nor the accepted answers, nor the correct order): those only go to the
    // manager with SHOW_RESPONSES.
    this.opts.broadcast(STATUS.SHOW_QUESTION, {
      question: question.question,
      media: imageMedia,
      upcomingMedia,
      cooldown: question.cooldown,
      answers,
      questionType: question.type,
      time: question.time,
      totalPlayer: this.opts.players.count(),
      options: question.options,
    })

    await sleep(question.cooldown)

    if (!this.started) {
      return
    }

    this.startTime = Date.now()
    this.acceptingAnswers = true

    this.opts.broadcast(STATUS.SELECT_ANSWER, {
      question: question.question,
      answers,
      media: question.media,
      time: question.time,
      totalPlayer: this.opts.players.count(),
      questionType: question.type,
      options: question.options,
    })

    await this.opts.cooldown.start(question.time)

    if (!this.started) {
      return
    }

    this.showResults(question)
  }

  private showResults(question: Question): void {
    this.acceptingAnswers = false

    const { scored, acceptsAnswers, nominative } =
      QUESTION_TYPE_META[question.type]
    const scoring = QUESTION_SCORING[question.type]
    const currentPlayers = this.opts.players.getAll()

    // What the question came to for each player, before the totals move.
    const rounds = currentPlayers.map((player) => {
      const answer = this.playersAnswers.find((a) => a.playerId === player.id)
      const score = answer ? scoring(question, answer) : 0
      const points = Math.round((answer?.points ?? 0) * score)
      const outcome = roundOutcome(question.type, {
        answered: Boolean(answer),
        score,
        points,
      })

      return { player, answer, score, points, outcome }
    })

    const outcomes = new Map(
      rounds.map(({ player, outcome }) => [player.id, outcome]),
    )

    // Ordering, partial outcome only: the items put at their place, shown on
    // the player's result card to explain the partial points.
    const placedCounts = new Map(
      question.type === QUESTION_TYPES.ORDERING
        ? rounds.flatMap(({ player, answer, outcome }) =>
            answer && outcome === "partial"
              ? [
                  [
                    player.id,
                    placedItems(
                      answer.answerIds,
                      question.answers.length,
                    ).filter(Boolean).length,
                  ] as const,
                ]
              : [],
          )
        : [],
    )

    const sortedPlayers = rounds
      .map(({ player, answer, points, outcome }) => {
        const credited = outcome === "correct" || outcome === "partial"
        // Only an answer that earned nothing is penalized: never a vote on an
        // unscored type, never a partial answer.
        const penalty =
          scored && !credited && answer ? (question.penalty ?? 0) : 0
        const previousPoints = player.points

        player.points = Math.max(0, player.points + points - penalty)

        // Unscored types must not break a run of correct answers either; a
        // partial answer does.
        if (scored) {
          player.correctInARow =
            outcome === "correct" ? player.correctInARow + 1 : 0
        }

        // The change actually applied: the floor at 0 can absorb part of a
        // penalty, and the player must not be shown a larger loss.
        const gain = player.points - previousPoints

        return {
          ...player,
          lastCorrect: credited,
          lastPoints: gain,
          lastAnswered: Boolean(answer),
          gain,
        }
      })
      .sort((a, b) => b.points - a.points)

    this.opts.players.replace(sortedPlayers)

    // Answerless types (slide): players keep the screen until next question.
    if (acceptsAnswers) {
      sortedPlayers.forEach((player, index) => {
        const outcome = outcomes.get(player.id) ?? "noAnswer"
        const placed = placedCounts.get(player.id)

        this.opts.send(player.id, STATUS.SHOW_RESULT, {
          outcome,
          correct: scored ? player.lastCorrect : player.lastAnswered,
          message:
            TYPE_RESULT_MESSAGES[question.type]?.[outcome] ??
            RESULT_MESSAGES[outcome],
          points: player.lastPoints,
          myPoints: player.points,
          rank: index + 1,
          totalPlayers: sortedPlayers.length,
          ...(placed !== undefined && {
            placed: { count: placed, total: question.answers.length },
          }),
        })
      })
    }

    // Over every answer given, like totalAnswered and responses.
    const answeredScores = this.playersAnswers.map((answer) =>
      scoring(question, answer),
    )

    // Wordcloud: the words of every answer, counted together. They leave the
    // answers here, which are dropped once the question closes.
    const words: WordCount[] | undefined =
      question.type === QUESTION_TYPES.WORDCLOUD
        ? countWords(
            this.playersAnswers.flatMap(({ texts = [] }) =>
              texts.map((text) => ({ text })),
            ),
            question.question.trim(),
          )
        : undefined
    // Players with at least one word kept: with too few of them, the history
    // keeps no word, or who answered would tell who typed what.
    const authors = this.playersAnswers.filter(
      ({ texts = [] }) => texts.length > 0,
    ).length
    const historyWords =
      words &&
      (words.length > 0 && authors < WORDCLOUD_LIMITS.MIN_AUTHORS
        ? { wordsWithheld: true }
        : { words })

    // Estimate: the values sent, counted by range around the right value for
    // the manager's screen, which also gets the right value.
    const values =
      question.type === QUESTION_TYPES.ESTIMATE
        ? this.playersAnswers.flatMap(({ value }) =>
            value === undefined ? [] : [value],
          )
        : undefined

    this.opts.send(this.opts.getManagerId(), STATUS.SHOW_RESPONSES, {
      ...question,
      responses: countResponses(question, this.playersAnswers),
      totalAnswered: this.playersAnswers.length,
      totalPlayers: currentPlayers.length,
      ...(question.type === QUESTION_TYPES.ORDERING && {
        publicOrder: this.publicAnswers.order,
      }),
      ...(words && {
        words: words.slice(0, WORDCLOUD_LIMITS.CLOUD_WORDS),
        distinctWords: words.length,
      }),
      ...(values && {
        ranges: estimateRanges(question, values),
        median: medianOf(values),
      }),
      ...(scored && {
        correctCount: answeredScores.filter((score) => score === 1).length,
        partialCount: answeredScores.filter((score) => score > 0 && score < 1)
          .length,
      }),
    })

    // Answerless types carry nothing to report: keep them out of history.
    // A type that is not nominative keeps whether each player answered, and
    // its answers at the question level only (none from too few authors).
    if (acceptsAnswers) {
      this.questionsHistory.push({
        ...question,
        playerAnswers: rounds.map(({ player, answer, score }) => ({
          playerName: player.username,
          answerIds: answer?.answerIds ?? null,
          ...(question.type === QUESTION_TYPES.SHORTANSWER && {
            text: answer?.text ?? null,
          }),
          ...(question.type === QUESTION_TYPES.ESTIMATE && {
            value: answer?.value ?? null,
          }),
          ...(!nominative && { answered: Boolean(answer) }),
          score,
        })),
        ...historyWords,
      })
    }

    this.leaderboard = sortedPlayers
    this.playersAnswers = []
  }

  // Points of an answer before its multiplier. Without the speed bonus, a
  // player who scores gets the base points whatever the time or the order.
  private basePoints(question: Question): number {
    const speedBonus =
      question.speedBonus ?? QUESTION_TYPE_META[question.type].speedBonus

    if (!speedBonus) {
      return question.maxPoints ?? MAX_POINTS
    }

    if (question.time === NO_TIME_LIMIT) {
      return orderToPoint(
        this.playersAnswers.length,
        this.opts.players.count(),
        question.maxPoints,
      )
    }

    return timeToPoint(this.startTime, question)
  }

  selectAnswer(socket: Socket, payload: AnswerPayload): void {
    if (!this.acceptingAnswers) {
      return
    }

    const player = this.opts.players.findById(socket.id)
    const question = this.opts.quizz.questions[this.currentQuestion]

    if (!player) {
      return
    }

    if (!QUESTION_TYPE_META[question.type].acceptsAnswers) {
      return
    }

    if (this.playersAnswers.find((a) => a.playerId === socket.id)) {
      return
    }

    const answer = answerParser(this.blocklist)(
      question,
      payload,
      this.publicAnswers.order,
    )

    if (!answer) {
      return
    }

    this.playersAnswers.push({
      playerId: player.id,
      ...answer,
      points: this.basePoints(question),
    })

    this.opts.send(socket.id, STATUS.WAIT, {
      text: "game:waitingForAnswers",
    })

    socket
      .to(this.opts.gameId)
      .emit(EVENTS.GAME.PLAYER_ANSWER, this.playersAnswers.length)
    this.opts.players.broadcastCount()

    if (this.playersAnswers.length === this.opts.players.count()) {
      this.opts.cooldown.abort()
    }
  }

  // A reconnecting player gets a new socket id: the answer already given must
  // follow, or it would be lost and a second answer accepted.
  remapPlayer(oldId: string, newId: string): void {
    for (const answer of this.playersAnswers) {
      if (answer.playerId === oldId) {
        answer.playerId = newId
      }
    }
  }

  nextQuestion(socket: Socket): void {
    if (!this.started) {
      return
    }

    if (socket.id !== this.opts.getManagerId()) {
      return
    }

    if (!this.opts.quizz.questions[this.currentQuestion + 1]) {
      return
    }

    this.currentQuestion += 1
    void this.newQuestion()
  }

  abortQuestion(socket: Socket): void {
    if (!this.started) {
      return
    }

    if (socket.id !== this.opts.getManagerId()) {
      return
    }

    this.opts.cooldown.abort()
  }

  showLeaderboard(socket: Socket): void {
    if (socket.id !== this.opts.getManagerId()) {
      return
    }

    const isLastRound =
      this.currentQuestion + 1 === this.opts.quizz.questions.length

    if (isLastRound) {
      this.started = false

      const top = this.leaderboard.slice(0, 5).map(toPublicPlayer)

      this.opts.onGameFinished({
        id: `${Date.now()}-${nanoid(8)}`,
        quizzId: this.opts.quizz.id,
        subject: this.opts.quizz.subject,
        date: new Date().toISOString(),
        players: this.leaderboard.map((player, index) => ({
          username: player.username,
          points: player.points,
          rank: index + 1,
        })),
        questions: this.questionsHistory,
      })

      this.opts.send(this.opts.getManagerId(), STATUS.FINISHED, {
        subject: this.opts.quizz.subject,
        top,
      })

      this.leaderboard.forEach((player, index) => {
        this.opts.send(player.id, STATUS.FINISHED, {
          subject: this.opts.quizz.subject,
          top,
          rank: index + 1,
          totalPlayers: this.leaderboard.length,
        })
      })

      return
    }

    this.opts.send(this.opts.getManagerId(), STATUS.SHOW_LEADERBOARD, {
      leaderboard: this.leaderboard.slice(0, 5),
    })
  }
}
