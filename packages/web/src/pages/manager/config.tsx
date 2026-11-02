import { EVENTS } from "@razzia/common/constants"
import { STATUS } from "@razzia/common/types/game/status"
import Background from "@razzia/web/components/Background"
import Loader from "@razzia/web/components/Loader"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import Configurations from "@razzia/web/features/manager/components/configurations"
import { clearSessionToken } from "@razzia/web/features/manager/utils/account"
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const ManagerConfigPage = () => {
  const { isConnected } = useSocket()
  const { setGameId, setStatus, setConfig, config, reset } = useManagerStore()
  const navigate = useNavigate()
  const { t } = useTranslation()

  useEvent(EVENTS.MANAGER.CONFIG, (data) => {
    setConfig(data)
  })

  // The session ended (unused for long, signed out elsewhere, account
  // disabled): back to the sign-in form, which an empty config leads to.
  useEvent(EVENTS.MANAGER.UNAUTHORIZED, () => {
    clearSessionToken()
    toast.error(t("errors:manager.sessionExpired"))
    reset()
  })

  useEvent(EVENTS.MANAGER.PASSWORD_CHANGE_REQUIRED, () => {
    reset()
  })

  useEvent(EVENTS.MANAGER.GAME_CREATED, ({ gameId, inviteCode }) => {
    setGameId(gameId)
    setStatus(STATUS.SHOW_ROOM, {
      text: "game:waitingForPlayers",
      inviteCode,
    })
    navigate({ to: "/party/manager/$gameId", params: { gameId } })
  })

  if (!isConnected) {
    return (
      <Background>
        <Loader className="h-23" />
      </Background>
    )
  }

  // Signed out, or the session ended. Navigating from an effect: a navigation
  // started while rendering suspends the page, blank until it completes.
  if (!config) {
    return <Navigate to="/manager" />
  }

  return (
    <Background>
      <Configurations data={config} />
    </Background>
  )
}

export const Route = createFileRoute("/manager/config")({
  component: ManagerConfigPage,
})
