import { EVENTS } from "@razzia/common/constants"
import type {
  AnswerPayload,
  GameResult,
  GameUpdateQuestion,
  MediaControl,
  MediaSyncState,
  MediaViewers,
  Player,
  QuizzStats,
  QuizzError,
  QuizzStatsMeta,
  QuizzWithId,
} from "@razzia/common/types/game"
import type { Status, StatusDataMap } from "@razzia/common/types/game/status"
import type { ManagerConfig } from "@razzia/common/types/manager"
import { Server as ServerIO, Socket as SocketIO } from "socket.io"

export type Server = ServerIO<ClientToServerEvents, ServerToClientEvents>

export type Socket = SocketIO<ClientToServerEvents, ServerToClientEvents>

export interface Message<K extends keyof StatusDataMap = keyof StatusDataMap> {
  gameId?: string
  status: K
  data: StatusDataMap[K]
}

export interface MessageWithoutStatus<T = unknown> {
  gameId?: string
  data: T
}

export interface MessageGameId {
  gameId?: string
}

export interface ServerToClientEvents {
  connect: () => void

  // Game events
  [EVENTS.GAME.STATUS]: (_data: {
    name: Status
    data: StatusDataMap[Status]
  }) => void
  [EVENTS.GAME.SUCCESS_ROOM]: (_data: string) => void
  [EVENTS.GAME.SUCCESS_JOIN]: (_gameId: string) => void
  [EVENTS.GAME.TOTAL_PLAYERS]: (_count: number) => void
  [EVENTS.GAME.ERROR_MESSAGE]: (_message: string) => void
  [EVENTS.GAME.START_COOLDOWN]: () => void
  [EVENTS.GAME.COOLDOWN]: (_count: number) => void
  [EVENTS.GAME.RESET]: (_message: string) => void
  [EVENTS.GAME.UPDATE_QUESTION]: (_data: {
    current: number
    total: number
  }) => void
  [EVENTS.GAME.PLAYER_ANSWER]: (_count: number) => void
  // To the players: where the video that plays on every device stands.
  [EVENTS.GAME.MEDIA_STATE]: (_state: MediaSyncState) => void

  // Player events
  [EVENTS.PLAYER.CHECK_CODE_RESULT]: (_data: { valid: boolean }) => void
  [EVENTS.PLAYER.SUCCESS_RECONNECT]: (_data: {
    gameId: string
    status: { name: Status; data: StatusDataMap[Status] }
    player: { username: string; points: number }
    currentQuestion: GameUpdateQuestion
  }) => void
  [EVENTS.PLAYER.UPDATE_LEADERBOARD]: (_data: { leaderboard: Player[] }) => void

  // Manager events
  [EVENTS.MANAGER.SUCCESS_RECONNECT]: (_data: {
    gameId: string
    status: { name: Status; data: StatusDataMap[Status] }
    players: Player[]
    currentQuestion: GameUpdateQuestion
  }) => void
  [EVENTS.MANAGER.CONFIG]: (_config: ManagerConfig) => void
  [EVENTS.QUIZZ.DATA]: (_quizz: QuizzWithId) => void
  [EVENTS.MANAGER.GAME_CREATED]: (_data: {
    gameId: string
    inviteCode: string
  }) => void
  [EVENTS.MANAGER.STATUS_UPDATE]: (_data: {
    status: Status
    data: StatusDataMap[Status]
  }) => void
  [EVENTS.MANAGER.NEW_PLAYER]: (_player: Player) => void
  [EVENTS.MANAGER.REMOVE_PLAYER]: (_playerId: string) => void
  [EVENTS.MANAGER.ERROR_MESSAGE]: (_message: string) => void
  [EVENTS.MANAGER.PLAYER_KICKED]: (_playerId: string) => void
  [EVENTS.MANAGER.UNAUTHORIZED]: () => void
  // How many phones show the video that plays on every device.
  [EVENTS.MANAGER.MEDIA_VIEWERS]: (_viewers: MediaViewers) => void

  // Quizz events
  // After an import, the media a save would refuse, kept for the author to
  // fix in the editor, each with its question.
  [EVENTS.QUIZZ.SAVE_SUCCESS]: (_data: {
    id: string
    warnings?: QuizzError[]
  }) => void
  [EVENTS.QUIZZ.UPDATE_SUCCESS]: (_data: { id: string }) => void
  // An error key, or, when a save is refused over one question, the key and
  // that question.
  [EVENTS.QUIZZ.ERROR]: (_error: string | QuizzError) => void

  // Results events
  [EVENTS.RESULTS.DATA]: (_result: GameResult) => void
  [EVENTS.RESULTS.EXPORT_DATA]: (_data: {
    filename: string
    buffer: ArrayBuffer
  }) => void

  // Statistics events
  [EVENTS.STATS.LIST_DATA]: (_data: QuizzStatsMeta[]) => void
  [EVENTS.STATS.DATA]: (_data: QuizzStats) => void
  [EVENTS.STATS.ERROR]: (_message: string) => void
}

export interface ClientToServerEvents {
  // Manager actions
  [EVENTS.GAME.CREATE]: (_quizzId: string) => void
  [EVENTS.MANAGER.AUTH]: (_password: string) => void
  [EVENTS.MANAGER.RECONNECT]: (_message: { gameId: string }) => void
  [EVENTS.MANAGER.LEAVE]: (_message: { gameId: string }) => void
  [EVENTS.MANAGER.KICK_PLAYER]: (_message: {
    gameId: string
    playerId: string
  }) => void
  [EVENTS.MANAGER.START_GAME]: (_message: MessageGameId) => void
  [EVENTS.MANAGER.ABORT_QUIZ]: (_message: MessageGameId) => void
  [EVENTS.MANAGER.NEXT_QUESTION]: (_message: MessageGameId) => void
  [EVENTS.MANAGER.SHOW_LEADERBOARD]: (_message: MessageGameId) => void
  [EVENTS.MANAGER.GET_CONFIG]: () => void
  [EVENTS.MANAGER.LOGOUT]: () => void
  // The host plays, pauses or moves the video that plays on every device.
  [EVENTS.MANAGER.MEDIA_CONTROL]: (_control: MediaControl) => void

  // Quizz actions
  [EVENTS.QUIZZ.GET]: (_id: string) => void
  [EVENTS.QUIZZ.SAVE]: (_quizz: unknown) => void
  // A quiz file (an export), read as a stored quiz is.
  [EVENTS.QUIZZ.IMPORT]: (_quizz: unknown) => void
  [EVENTS.QUIZZ.IMPORT_XLSX]: (_data: {
    name: string
    buffer: ArrayBuffer
  }) => void
  [EVENTS.QUIZZ.UPDATE]: (_data: QuizzWithId) => void
  [EVENTS.QUIZZ.DELETE]: (_id: string) => void

  // Player actions
  [EVENTS.PLAYER.CHECK_CODE]: (_inviteCode: string) => void
  [EVENTS.PLAYER.JOIN]: (_inviteCode: string) => void
  [EVENTS.PLAYER.LOGIN]: (
    _message: MessageWithoutStatus<{ username: string }>,
  ) => void
  [EVENTS.PLAYER.RECONNECT]: (_message: { gameId: string }) => void
  [EVENTS.PLAYER.LEAVE]: (_message: { gameId: string }) => void
  [EVENTS.PLAYER.SELECTED_ANSWER]: (
    _message: MessageWithoutStatus<AnswerPayload>,
  ) => void
  // The phone starts or stops showing the video that plays on every device.
  [EVENTS.PLAYER.MEDIA_WATCH]: (_message: {
    gameId: string
    watching: boolean
  }) => void

  // Results actions
  [EVENTS.RESULTS.GET]: (_id: string) => void
  [EVENTS.RESULTS.DELETE]: (_id: string) => void
  [EVENTS.RESULTS.EXPORT]: (_id: string) => void

  // Statistics actions
  [EVENTS.STATS.LIST]: () => void
  [EVENTS.STATS.GET]: (_quizzId: string) => void

  // Common
  // The server's clock, in milliseconds since 1970, sent back at once: a
  // phone measures how far its own is from it.
  [EVENTS.GAME.CLOCK]: (
    _sentAt: number,
    _ack: (_serverNow: number) => void,
  ) => void
  disconnect: () => void
}
