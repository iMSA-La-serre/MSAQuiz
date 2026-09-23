import { EVENTS } from "@razzia/common/constants"
import { inviteCodeValidator } from "@razzia/common/validators/auth"
import type { SocketContext } from "@razzia/socket/handlers/types"
import { getQuizzById } from "@razzia/socket/repositories/quizz"
import Game from "@razzia/socket/services/game"
import manager from "@razzia/socket/services/manager"
import Registry from "@razzia/socket/services/registry"
import { withGame } from "@razzia/socket/utils/game"
import { getClientId } from "@razzia/socket/utils/socket"

export const gameSocketHandlers = ({ io, socket }: SocketContext) => {
  const registry = Registry.getInstance()
  const clientId = getClientId(socket)

  const handleManagerLeave = (game: Game) => {
    game.setManagerDisconnected()
    registry.markGameAsEmpty(game)

    if (!game.started) {
      game.abortCooldown()
      io.to(game.gameId).emit(
        EVENTS.GAME.RESET,
        "errors:game.managerDisconnected",
      )
      registry.removeGame(game.gameId)
    }
  }

  const handlePlayerLeave = (game: Game) => {
    if (!game.started) {
      const player = game.removePlayer(socket.id)

      if (player) {
        console.log(`Player ${player.username} left game ${game.gameId}`)
      }

      return
    }

    game.setPlayerDisconnected(socket.id)
  }

  socket.on(EVENTS.PLAYER.RECONNECT, ({ gameId }) => {
    const game = registry.getPlayerGame(gameId, clientId)

    if (game) {
      game.reconnect(socket)

      return
    }

    socket.emit(EVENTS.GAME.RESET, "errors:game.notFound")
  })

  socket.on(EVENTS.MANAGER.RECONNECT, ({ gameId }) => {
    const game = registry.getManagerGame(gameId, clientId)

    if (game) {
      game.reconnect(socket)

      return
    }

    socket.emit(EVENTS.GAME.RESET, "errors:game.expired")
  })

  socket.on(
    EVENTS.GAME.CREATE,
    manager.withAuth(socket, (quizzId: string) => {
      try {
        const quizz = getQuizzById(quizzId)
        const game = new Game(io, socket, quizz)
        registry.addGame(game)
      } catch {
        socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:quizz.notFound")
      }
    }),
  )

  socket.on(EVENTS.PLAYER.CHECK_CODE, (inviteCode) => {
    const result = inviteCodeValidator.safeParse(inviteCode)
    const game = result.success
      ? registry.getGameByInviteCode(result.data)
      : undefined

    socket.emit(EVENTS.PLAYER.CHECK_CODE_RESULT, { valid: Boolean(game) })
  })

  socket.on(EVENTS.PLAYER.JOIN, (inviteCode) => {
    const result = inviteCodeValidator.safeParse(inviteCode)

    if (result.error) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, result.error.issues[0].message)

      return
    }

    const game = registry.getGameByInviteCode(result.data)

    if (!game) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:game.notFound")

      return
    }

    if (game.manager.clientId === clientId) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:game.managerCannotJoin")

      return
    }

    if (game.players.some((p) => p.clientId === clientId)) {
      game.reconnect(socket)

      return
    }

    socket.emit(EVENTS.GAME.SUCCESS_ROOM, game.gameId)
  })

  socket.on(EVENTS.PLAYER.LOGIN, ({ gameId, data }) =>
    withGame(gameId, socket, (game) => game.join(socket, data.username)),
  )

  socket.on(EVENTS.MANAGER.KICK_PLAYER, ({ gameId, playerId }) =>
    withGame(gameId, socket, (game) => game.kickPlayer(socket, playerId)),
  )

  socket.on(EVENTS.MANAGER.START_GAME, ({ gameId }) =>
    withGame(gameId, socket, (game) => game.start(socket)),
  )

  socket.on(EVENTS.PLAYER.SELECTED_ANSWER, ({ gameId, data }) =>
    withGame(gameId, socket, (game) => game.selectAnswer(socket, data)),
  )

  socket.on(EVENTS.MANAGER.ABORT_QUIZ, ({ gameId }) =>
    withGame(gameId, socket, (game) => game.abortRound(socket)),
  )

  socket.on(EVENTS.MANAGER.NEXT_QUESTION, ({ gameId }) =>
    withGame(gameId, socket, (game) => game.nextRound(socket)),
  )

  socket.on(EVENTS.MANAGER.SHOW_LEADERBOARD, ({ gameId }) =>
    withGame(gameId, socket, (game) => game.showLeaderboard(socket)),
  )

  // The game's own host alone moves the video (checked by the game).
  socket.on(EVENTS.MANAGER.MEDIA_CONTROL, (control) =>
    withGame(control.gameId, socket, (game) =>
      game.controlMedia(socket, control),
    ),
  )

  socket.on(EVENTS.PLAYER.MEDIA_WATCH, ({ gameId, watching }) =>
    withGame(gameId, socket, (game) => game.watchMedia(socket, watching)),
  )

  // Anyone may ask the time: a phone measures how far its clock is from the
  // server's, which the video's state counts in.
  socket.on(EVENTS.GAME.CLOCK, (_sentAt, ack) => {
    if (typeof ack === "function") {
      ack(Date.now())
    }
  })

  socket.on(EVENTS.MANAGER.LEAVE, ({ gameId }) => {
    const game = registry.getManagerGame(gameId, clientId)

    if (game) {
      console.log(`Manager left game ${game.inviteCode}`)
      handleManagerLeave(game)
    }
  })

  socket.on(EVENTS.PLAYER.LEAVE, ({ gameId }) => {
    const game = registry.getPlayerGame(gameId, clientId)

    if (game) {
      handlePlayerLeave(game)
    }
  })

  socket.on("disconnect", () => {
    console.log(`A user disconnected : ${socket.id}`)

    const managerGame = registry.getGameByManagerSocketId(socket.id)

    if (managerGame) {
      console.log(`Manager disconnected from game ${managerGame.inviteCode}`)
      handleManagerLeave(managerGame)

      return
    }

    const playerGame = registry.getGameByPlayerSocketId(socket.id)

    if (playerGame) {
      handlePlayerLeave(playerGame)
    }
  })
}
