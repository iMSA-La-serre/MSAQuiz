import { EVENTS } from "@razzia/common/constants"
import Card from "@razzia/web/components/Card"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import ChangePasswordForm from "@razzia/web/features/manager/components/ChangePasswordForm"
import ManagerLogin from "@razzia/web/features/manager/components/ManagerLogin"
import {
  clearSessionToken,
  PASSWORD_RULE,
  saveSessionToken,
} from "@razzia/web/features/manager/utils/account"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const ManagerAuthPage = () => {
  const { setConfig } = useManagerStore()
  const navigate = useNavigate()
  const { socket, isConnected } = useSocket()
  const { t } = useTranslation()
  // Signed in with a temporary password: the account chooses its own before
  // going any further.
  const [temporary, setTemporary] = useState(false)

  useEffect(() => {
    if (!isConnected) {
      return
    }

    socket.emit(EVENTS.MANAGER.GET_CONFIG)
    // oxlint-disable-next-line
  }, [isConnected])

  useEvent(EVENTS.MANAGER.CONFIG, (data) => {
    setConfig(data)
    navigate({ to: "/manager/config" })
  })

  useEvent(EVENTS.MANAGER.SESSION, ({ token, user }) => {
    saveSessionToken(token)
    setTemporary(user.mustChangePassword)
  })

  useEvent(EVENTS.MANAGER.PASSWORD_CHANGE_REQUIRED, () => {
    setTemporary(true)
  })

  // No session, or one that ended: the token kept no longer opens anything.
  useEvent(EVENTS.MANAGER.UNAUTHORIZED, () => {
    clearSessionToken()
    setTemporary(false)
  })

  useEvent(EVENTS.MANAGER.PASSWORD_CHANGED, () => {
    toast.success(t("manager:account.passwordChanged"))
  })

  useEvent(EVENTS.MANAGER.ERROR_MESSAGE, (message) => {
    toast.error(t(message, PASSWORD_RULE))
  })

  const handleAuth = (login: string, password: string) => {
    socket.emit(EVENTS.MANAGER.AUTH, { login, password })
  }

  const handleLogout = () => {
    socket.emit(EVENTS.MANAGER.LOGOUT)
    clearSessionToken()
    setTemporary(false)
  }

  if (temporary) {
    return (
      <Card>
        <h2 className="text-foreground text-lg font-semibold">
          {t("manager:account.chooseTitle")}
        </h2>
        <p className="text-muted-foreground mb-4 text-sm">
          {t("manager:account.chooseHint")}
        </p>
        <ChangePasswordForm temporary />
        <button
          className="text-muted-foreground hover:text-foreground mt-3 text-sm underline"
          onClick={handleLogout}
        >
          {t("manager:logout")}
        </button>
      </Card>
    )
  }

  return <ManagerLogin onSubmit={handleAuth} />
}

export const Route = createFileRoute("/(auth)/manager/")({
  component: ManagerAuthPage,
})
