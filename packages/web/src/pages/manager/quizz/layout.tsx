import { EVENTS } from "@razzia/common/constants"
import GameBackground from "@razzia/web/components/GameBackground"
import Loader from "@razzia/web/components/Loader"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

export const Route = createFileRoute("/manager/quizz")({
  component: RouteComponent,
})

function RouteComponent() {
  const { socket, isConnected } = useSocket()
  const { config, setConfig } = useManagerStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (isConnected && !config) {
      socket.emit(EVENTS.MANAGER.GET_CONFIG)
    }
  }, [isConnected, config, socket])

  useEvent(EVENTS.MANAGER.CONFIG, (data) => {
    setConfig(data)
  })

  useEvent(EVENTS.MANAGER.UNAUTHORIZED, () => {
    navigate({ to: "/manager" })
  })

  if (!isConnected || !config) {
    return (
      <div className="relative flex h-svh items-center justify-center">
        <GameBackground />
        <Loader className="text-background relative max-h-23" />
      </div>
    )
  }

  return <Outlet />
}
