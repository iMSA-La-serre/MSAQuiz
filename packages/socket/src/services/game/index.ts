import { EVENTS } from "@razzia/common/constants"
import type {
  AnswerPayload,
  MediaControl,
  Player,
  QuizzWithId,
} from "@razzia/common/types/game"
import type { Server, Socket } from "@razzia/common/types/game/socket"
import {
  STATUS,
  type Status,
  type StatusDataMap,
} from "@razzia/common/types/game/status"
import { saveResult } from "@razzia/socket/repositories/results"
import { CooldownTimer } from "@razzia/socket/services/game/cooldown-timer"
import { MediaSync } from "@razzia/socket/services/game/media-sync"
import { PlayerManager } from "@razzia/socket/services/game/player-manager"
import { RoundManager } from "@razzia/socket/services/game/round-manager"
import { getModerationWords } from "@razzia/socket/services/moderation"
import Registry from "@razzia/socket/services/registry"
import { createInviteCode } from "@razzia/socket/utils/game"
import { getClientId } from "@razzia/socket/utils/socket"
import { v7 as uuid } from "uuid"

const registry = Registry.getInstance()

class Game {
  readonly gameId: string
  readonly inviteCode: string

  private readonly io: Server
  private readonly _manager: {
    id: string
    clientId: string
    connected: boolean
  }
  private readonly playerManager: PlayerManager
  private readonly round: RoundManager
  private readonly cooldown: CooldownTimer
  // The question's video when it plays on every device.
  private readonly media: MediaSync

  private lastBroadcastStatus: {
    name: Status
    data: StatusDataMap[Status]
  } | null = null
  private managerStatus: {
    name: Status
    data: StatusDataMap[Status]
  } | null = null
  private playerStatus = new Map<
    string,
    { name: Status; data: StatusDataMap[Status] }
  >()

  constructor(io: Server, socket: Socket, quizz: QuizzWithId) {
    const clientId = getClientId(socket)

    this.io = io
    this.gameId = uuid()

    // Two live games must never share a code: draw again on the rare clash.
    let inviteCode = createInviteCode()

    while (registry.getGameByInviteCode(inviteCode)) {
      inviteCode = createInviteCode()
    }

    this.inviteCode = inviteCode
    this._manager = {
      id: socket.id,
      clientId,
      connected: true,
    }

    this.cooldown = new CooldownTimer(io, this.gameId)

    this.playerManager = new PlayerManager(
      io,
      this.gameId,
      () => this._manager.id,
    )

    this.media = new MediaSync({
      io,
      gameId: this.gameId,
      getManagerId: () => this._manager.id,
      isConnected: (id) =>
        this.playerManager.findByClientId(id)?.connected ?? false,
    })

    this.round = new RoundManager({
      quizz,
      players: this.playerManager,
      cooldown: this.cooldown,
      io,
      gameId: this.gameId,
      getManagerId: () => this._manager.id,
      broadcast: this.broadcastStatus.bind(this),
      send: this.sendStatus.bind(this),
      onNewQuestion: (current, question) => {
        this.playerStatus.clear()
        this.managerStatus = null
        this.media.begin(current, question.media)
      },
      onQuestionOver: () => {
        this.media.end()
      },
      onGameFinished: saveResult,
      moderationWords: getModerationWords,
    })

    socket.join(this.gameId)
    socket.emit(EVENTS.MANAGER.GAME_CREATED, {
      gameId: this.gameId,
      inviteCode: this.inviteCode,
    })

    console.log(
      `New game created: ${this.inviteCode} subject: ${quizz.subject}`,
    )
  }

  get manager() {
    return this._manager
  }

  get players(): Player[] {
    return this.playerManager.getAll()
  }

  get started(): boolean {
    return this.round.isStarted()
  }

  // ── Status broadcasting ──────────────────────────────────────────────────

  // To the whole room. With `managerData`, the manager gets it instead of
  // `data`, and gets it again on reconnecting; the players, `data`. Either
  // way, the manager reconnects to the last status it was sent.
  private broadcastStatus<T extends Status>(
    status: T,
    data: StatusDataMap[T],
    managerData?: StatusDataMap[T],
  ) {
    const statusData = { name: status, data }
    this.lastBroadcastStatus = statusData

    if (managerData === undefined) {
      this.managerStatus = null
      this.io.to(this.gameId).emit(EVENTS.GAME.STATUS, statusData)

      return
    }

    const managerStatus = { name: status, data: managerData }
    this.managerStatus = managerStatus
    this.io
      .to(this.gameId)
      .except(this._manager.id)
      .emit(EVENTS.GAME.STATUS, statusData)
    this.io.to(this._manager.id).emit(EVENTS.GAME.STATUS, managerStatus)
  }

  private sendStatus<T extends Status>(
    target: string,
    status: T,
    data: StatusDataMap[T],
  ) {
    const statusData = { name: status, data }

    if (this._manager.id === target) {
      this.managerStatus = statusData
    } else {
      this.playerStatus.set(target, statusData)
    }

    this.io.to(target).emit(EVENTS.GAME.STATUS, statusData)
  }

  // Player actions

  join(socket: Socket, username: string) {
    this.playerManager.join(socket, username)

    if (this.started && this.playerManager.findById(socket.id)) {
      this.catchUp(socket)
    }
  }

  // A player who arrives while the question's video plays on every device
  // gets the question, as the room got it, and where the video stands, so
  // it can watch it too: while the question is on the players' screens (a
  // question until its results, a slide until the host moves on). Any other
  // question starts for them with the next. Never kept as their own status:
  // once the room moves on (the answers open), a reconnection gives them the
  // room's current one (lastBroadcastStatus), as to every other player.
  private catchUp(socket: Socket) {
    const status = this.lastBroadcastStatus

    if (
      !this.media.getState() ||
      !this.round.isOpen() ||
      (status?.name !== STATUS.SHOW_QUESTION &&
        status?.name !== STATUS.SELECT_ANSWER)
    ) {
      return
    }

    this.io
      .to(socket.id)
      .emit(EVENTS.GAME.UPDATE_QUESTION, this.round.getReconnectInfo())
    this.io.to(socket.id).emit(EVENTS.GAME.STATUS, status)
    this.media.sendStateTo(socket.id)
  }

  kickPlayer(socket: Socket, playerId: string) {
    if (this.playerManager.kick(socket, playerId)) {
      this.playerStatus.delete(playerId)
      this.media.refreshViewers()
    }
  }

  // Reconnect

  reconnect(socket: Socket) {
    const { clientId } = socket.handshake.auth

    if (this._manager.clientId === clientId) {
      this.reconnectManager(socket)

      return
    }

    this.reconnectPlayer(socket)
  }

  private reconnectManager(socket: Socket) {
    if (this._manager.connected) {
      socket.emit(EVENTS.GAME.RESET, "errors:game.managerAlreadyConnected")

      return
    }

    socket.join(this.gameId)
    this._manager.id = socket.id
    this._manager.connected = true

    const status = this.managerStatus ??
      this.lastBroadcastStatus ?? {
        name: STATUS.WAIT,
        data: { text: "game:waitingForPlayers" },
      }

    socket.emit(EVENTS.MANAGER.SUCCESS_RECONNECT, {
      gameId: this.gameId,
      currentQuestion: this.round.getReconnectInfo(),
      status,
      players: this.playerManager.getAll(),
    })
    socket.emit(EVENTS.GAME.TOTAL_PLAYERS, this.playerManager.count())
    this.media.managerBack()

    registry.reactivateGame(this.gameId)
    console.log(`Manager reconnected to game ${this.inviteCode}`)
  }

  private reconnectPlayer(socket: Socket) {
    const clientId = getClientId(socket)
    const player = this.playerManager.findByClientId(clientId)

    if (!player) {
      return
    }

    if (player.connected) {
      socket.emit(EVENTS.GAME.RESET, "errors:game.playerAlreadyConnected")

      return
    }

    socket.join(this.gameId)

    const oldSocketId = player.id
    this.playerManager.updateSocketId(oldSocketId, socket.id)
    this.round.remapPlayer(oldSocketId, socket.id)
    player.connected = true

    const status = this.playerStatus.get(oldSocketId) ??
      this.lastBroadcastStatus ?? {
        name: STATUS.WAIT,
        data: { text: "game:waitingForPlayers" },
      }

    const oldStatus = this.playerStatus.get(oldSocketId)

    if (oldStatus) {
      this.playerStatus.delete(oldSocketId)
      this.playerStatus.set(socket.id, oldStatus)
    }

    socket.emit(EVENTS.PLAYER.SUCCESS_RECONNECT, {
      gameId: this.gameId,
      currentQuestion: this.round.getReconnectInfo(),
      status,
      player: { username: player.username, points: player.points },
    })
    socket.emit(EVENTS.GAME.TOTAL_PLAYERS, this.playerManager.count())
    this.media.playerBack(clientId, socket.id)

    console.log(
      `Player ${player.username} reconnected to game ${this.inviteCode}`,
    )
  }

  // Disconnect helpers

  // The host's screen went away: its video pauses for everyone.
  setManagerDisconnected() {
    this._manager.connected = false
    this.media.pause()
  }

  removePlayer(socketId: string): Player | undefined {
    const player = this.playerManager.remove(socketId)

    if (player) {
      this.io.to(this._manager.id).emit(EVENTS.MANAGER.REMOVE_PLAYER, player.id)
      this.playerManager.broadcastCount()
      this.media.refreshViewers()
    }

    return player
  }

  setPlayerDisconnected(socketId: string) {
    this.playerManager.setDisconnected(socketId)
    this.playerManager.broadcastCount()
    this.media.refreshViewers()
  }

  // Game flow

  abortCooldown() {
    this.cooldown.abort()
  }

  async start(socket: Socket) {
    await this.round.start(socket)
  }

  selectAnswer(socket: Socket, payload: AnswerPayload) {
    this.round.selectAnswer(socket, payload)
  }

  nextRound(socket: Socket) {
    this.round.nextQuestion(socket)
  }

  abortRound(socket: Socket) {
    this.round.abortQuestion(socket)
  }

  showLeaderboard(socket: Socket) {
    this.round.showLeaderboard(socket)
  }

  // The video that plays on every device

  // The host alone moves it (see MediaSync.control).
  controlMedia(socket: Socket, control: MediaControl) {
    this.media.control(socket, control)
  }

  // A player's phone shows it, or no longer does.
  watchMedia(socket: Socket, watching: boolean) {
    const player = this.playerManager.findById(socket.id)

    if (player) {
      this.media.watch(player.clientId, socket.id, watching)
    }
  }
}

export default Game
