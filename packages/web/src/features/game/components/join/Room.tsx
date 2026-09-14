import { EVENTS } from "@razzia/common/constants"
import Button from "@razzia/web/components/Button"
import Card from "@razzia/web/components/Card"
import CodeInput from "@razzia/web/components/CodeInput"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { GAME_CODE_STORAGE_KEY } from "@razzia/web/features/game/utils/constants"
import { useSearch } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

const Room = () => {
  const { socket, isConnected } = useSocket()
  const { join } = usePlayerStore()
  const [invitation, setInvitation] = useState("")
  const { code } = useSearch({ from: "/(auth)/" })
  const hasJoinedRef = useRef(false)
  const { t } = useTranslation()

  const handleJoin = () => {
    socket.emit(EVENTS.PLAYER.JOIN, invitation.replace(/\s/gu, ""))
  }

  useEvent(EVENTS.GAME.SUCCESS_ROOM, (gameId) => {
    const codeToSave = (invitation.replace(/\s/gu, "") || code)?.toUpperCase()

    if (codeToSave) {
      localStorage.setItem(GAME_CODE_STORAGE_KEY, codeToSave)
    }

    join(gameId)
  })

  useEffect(() => {
    if (!isConnected || !code || hasJoinedRef.current) {
      return
    }

    socket.emit(EVENTS.PLAYER.JOIN, code)
    hasJoinedRef.current = true
  }, [code, isConnected, socket])

  return (
    <Card>
      <p className="mb-2 text-lg font-semibold">{t("game:codeLabel")}</p>
      <CodeInput
        value={invitation}
        onChange={setInvitation}
        ariaLabel={t("game:codeLabel")}
      />
      <Button className="mt-4" onClick={handleJoin}>
        {t("common:submit")}
      </Button>
    </Card>
  )
}

export default Room
