import { EVENTS } from "@razzia/common/constants"
import { STATUS } from "@razzia/common/types/game/status"
import GameBackground from "@razzia/web/components/GameBackground"
import GameWrapper from "@razzia/web/features/game/components/GameWrapper"
import {
  socketClient,
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useDeviceMediaSync } from "@razzia/web/features/game/media/phone-media"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { useQuestionStore } from "@razzia/web/features/game/stores/question"
import {
  ANSWER_CONFIRM_TIMEOUT_MS,
  answerToResend,
  statusKey,
} from "@razzia/web/features/game/utils/answer-delivery"
import {
  GAME_CODE_STORAGE_KEY,
  GAME_STATE_COMPONENTS,
  isKeyOf,
} from "@razzia/web/features/game/utils/constants"
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router"
import { useEffect } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const PlayerGamePage = () => {
  const navigate = useNavigate()
  const { socket, reconnect } = useSocket()
  const { gameId: gameIdParam } = useParams({ from: "/party/$gameId" })
  const { status, gameId, setPlayer, setGameId, setStatus, reset } =
    usePlayerStore()
  const { questionStates, setQuestionStates, pendingAnswer, setPendingAnswer } =
    useQuestionStore()
  const { t } = useTranslation()

  // The question's video when it plays on every device: offered, then in
  // step with the projected screen.
  useDeviceMediaSync(status, gameId, questionStates?.current)

  useEvent("connect", () => {
    if (gameIdParam) {
      socket.emit(EVENTS.PLAYER.RECONNECT, { gameId: gameIdParam })
    }
  })

  useEvent(
    EVENTS.PLAYER.SUCCESS_RECONNECT,
    ({
      gameId: reconnectGameId,
      status: reconnectStatus,
      player,
      currentQuestion,
    }) => {
      setGameId(reconnectGameId)
      setStatus(reconnectStatus.name, reconnectStatus.data)
      setPlayer(player)
      setQuestionStates(currentQuestion)

      // An answer lost in the network cut goes again, its question still
      // open; once confirmed (WAIT) or over, there is nothing left to send.
      const resend = answerToResend(
        useQuestionStore.getState().pendingAnswer,
        reconnectStatus,
      )

      if (resend) {
        socket.emit(EVENTS.PLAYER.SELECTED_ANSWER, {
          gameId: reconnectGameId,
          data: resend,
        })
      } else {
        setPendingAnswer(null)
      }
    },
  )

  useEvent(EVENTS.GAME.STATUS, ({ name, data }) => {
    if (name in GAME_STATE_COMPONENTS) {
      setStatus(name, data)
    }

    // The answer confirmed (WAIT), or its question over.
    if (name !== STATUS.SELECT_ANSWER) {
      setPendingAnswer(null)
    }
  })

  // No confirmation of the answer sent: the connection is likely dead. A new
  // one, opened once, sends it again (SUCCESS_RECONNECT above).
  useEffect(() => {
    if (!pendingAnswer) {
      return
    }

    const timer = setTimeout(() => {
      if (
        useQuestionStore.getState().pendingAnswer === pendingAnswer &&
        socket.connected
      ) {
        reconnect()
      }
    }, ANSWER_CONFIRM_TIMEOUT_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [pendingAnswer, reconnect, socket])

  useEvent(EVENTS.GAME.RESET, (message) => {
    localStorage.removeItem(GAME_CODE_STORAGE_KEY)
    navigate({ to: "/" })
    reset()
    setQuestionStates(null)
    setPendingAnswer(null)
    toast.error(t(message))
  })

  if (!gameIdParam) {
    return null
  }

  const CurrentComponent =
    status && isKeyOf(GAME_STATE_COMPONENTS, status.name)
      ? GAME_STATE_COMPONENTS[status.name]
      : null

  if (!status) {
    return <GameBackground />
  }

  return (
    <GameWrapper statusName={status.name}>
      {CurrentComponent && (
        <CurrentComponent key={statusKey(status)} data={status.data as never} />
      )}
    </GameWrapper>
  )
}

export const Route = createFileRoute("/party/$gameId")({
  component: PlayerGamePage,
  onLeave: ({ params: { gameId } }) => {
    socketClient.emit(EVENTS.PLAYER.LEAVE, { gameId })
  },
})
