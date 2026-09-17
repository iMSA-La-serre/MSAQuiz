import { EVENTS } from "@razzia/common/constants"
import type {
  ClientToServerEvents,
  Socket,
} from "@razzia/common/types/game/socket"
import z from "zod"

export const getClientId = (socket: Socket): string =>
  socket.handshake.auth.clientId as string

type ClientEvent = Exclude<keyof ClientToServerEvents, "disconnect">

const MAX_ANSWER_KEYS = 100

const id = z.string()
const gameMessage = z.object({ gameId: z.string() })
const optionalGameMessage = z.object({ gameId: z.string().optional() })

// Checked without walking the elements first: zod would inspect all of them
// before the length limit, and a single 5 MB packet would block the server
// for seconds. The ids themselves are checked by parseAnswerIds.
const answerKeys = z.custom<number[]>(
  (value) =>
    Array.isArray(value) &&
    value.length <= MAX_ANSWER_KEYS &&
    value.every((key) => typeof key === "number"),
)

// Expected shape of the first argument of every event a client may send.
// Anything else (unknown event, missing or malformed payload) is dropped
// before it reaches a handler. Only the structure the handlers read directly
// is checked here: contents (quizz body, invite code, username, answer ids)
// are still validated where they are used.
const CLIENT_EVENT_PAYLOADS: Record<ClientEvent, z.ZodType> = {
  [EVENTS.GAME.CREATE]: id,
  [EVENTS.MANAGER.AUTH]: z.string(),
  [EVENTS.MANAGER.RECONNECT]: gameMessage,
  [EVENTS.MANAGER.LEAVE]: gameMessage,
  [EVENTS.MANAGER.KICK_PLAYER]: gameMessage.extend({ playerId: z.string() }),
  [EVENTS.MANAGER.START_GAME]: optionalGameMessage,
  [EVENTS.MANAGER.ABORT_QUIZ]: optionalGameMessage,
  [EVENTS.MANAGER.NEXT_QUESTION]: optionalGameMessage,
  [EVENTS.MANAGER.SHOW_LEADERBOARD]: optionalGameMessage,
  // No payload: whatever comes along is ignored by the handler.
  [EVENTS.MANAGER.GET_CONFIG]: z.unknown(),
  [EVENTS.MANAGER.LOGOUT]: z.unknown(),
  [EVENTS.QUIZZ.GET]: id,
  // The quizz body is validated by the repository, inside the handler's
  // try/catch, so it can report which field is wrong.
  [EVENTS.QUIZZ.SAVE]: z.unknown(),
  [EVENTS.QUIZZ.IMPORT_XLSX]: z.object({
    name: z.string(),
    buffer: z.unknown(),
  }),
  [EVENTS.QUIZZ.UPDATE]: z.object({ id }),
  [EVENTS.QUIZZ.DELETE]: id,
  [EVENTS.PLAYER.CHECK_CODE]: z.string(),
  [EVENTS.PLAYER.JOIN]: z.string(),
  [EVENTS.PLAYER.LOGIN]: optionalGameMessage.extend({
    data: z.object({ username: z.string() }),
  }),
  [EVENTS.PLAYER.RECONNECT]: gameMessage,
  [EVENTS.PLAYER.LEAVE]: gameMessage,
  [EVENTS.PLAYER.SELECTED_ANSWER]: optionalGameMessage.extend({
    data: z.object({ answerKeys }),
  }),
  [EVENTS.RESULTS.GET]: id,
  [EVENTS.RESULTS.DELETE]: id,
  [EVENTS.RESULTS.EXPORT]: id,
  [EVENTS.STATS.LIST]: z.unknown(),
  [EVENTS.STATS.GET]: id,
}

export const isValidClientEvent = (event: unknown, payload: unknown) =>
  typeof event === "string" &&
  Object.hasOwn(CLIENT_EVENT_PAYLOADS, event) &&
  CLIENT_EVENT_PAYLOADS[event as ClientEvent].safeParse(payload).success

// Listeners are called by socket.io outside any try/catch: a handler that
// throws would stop the process and lose every game held in memory. Call this
// before registering the handlers of a new connection.
// Only synchronous exceptions are caught: the handlers don't return the
// promises of the game rounds, which must handle their own errors.
export const guardSocket = (socket: Socket) => {
  // The event name is typed as a string, but the protocol also allows numbers.
  socket.use((packet: unknown[], next) => {
    const [event, payload] = packet

    if (isValidClientEvent(event, payload)) {
      next()

      return
    }

    // Not calling next() drops the packet.
    console.warn(
      `Ignored malformed "${String(event).slice(0, 50)}" event from socket ${socket.id}`,
    )
  })

  const on = socket.on.bind(socket)

  socket.on = ((event: string, listener: (..._args: unknown[]) => void) =>
    on(
      event as never,
      ((..._args: unknown[]) => {
        try {
          listener(..._args)
        } catch (error) {
          console.error(
            `Handler for "${event}" failed (socket ${socket.id}):`,
            error,
          )
        }
      }) as never,
    )) as Socket["on"]
}
