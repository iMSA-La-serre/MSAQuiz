import { EVENTS } from "@razzia/common/constants"
import { STATUS, type Status } from "@razzia/common/types/game/status"
import Button from "@razzia/web/components/Button"
import GameBackground from "@razzia/web/components/GameBackground"
import Loader from "@razzia/web/components/Loader"
import HostDock from "@razzia/web/features/game/components/HostDock"
import PlayerBand from "@razzia/web/features/game/components/PlayerBand"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useQuestionStore } from "@razzia/web/features/game/stores/question"
import { MANAGER_SKIP_BTN } from "@razzia/web/features/game/utils/constants"
import clsx from "clsx"
import { type PropsWithChildren, useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

type Props = PropsWithChildren & {
  statusName: Status | undefined
  onNext?: () => void
  onBack?: () => void
  manager?: boolean
}

const GameWrapper = ({
  children,
  statusName,
  onNext,
  onBack,
  manager,
}: Props) => {
  const { isConnected } = useSocket()
  const setQuestionStates = useQuestionStore((state) => state.setQuestionStates)
  const { t } = useTranslation()
  const [isDisabled, setIsDisabled] = useState(false)
  // Set on the first press, before React renders again: a second Enter, Space
  // or clicker press in the same instant must not send the action twice (the
  // server would skip a question).
  const isDisabledRef = useRef(false)
  const next = statusName ? MANAGER_SKIP_BTN[statusName] : null
  const isLobby = statusName === STATUS.SHOW_ROOM

  useEvent(EVENTS.GAME.UPDATE_QUESTION, ({ current, total }) => {
    setQuestionStates({
      current,
      total,
    })
  })

  useEvent(EVENTS.GAME.ERROR_MESSAGE, (message) => {
    toast.error(t(message))
    console.log(t(message))
    isDisabledRef.current = false
    setIsDisabled(false)
  })

  useEffect(() => {
    isDisabledRef.current = false
    setIsDisabled(false)
  }, [statusName])

  const handleNext = () => {
    if (isDisabledRef.current) {
      return
    }

    isDisabledRef.current = true
    setIsDisabled(true)
    onNext?.()
  }

  return (
    <section className="relative flex min-h-dvh">
      <GameBackground />

      <div className="z-10 flex w-full flex-1 flex-col">
        {!isConnected && !statusName ? (
          <div className="flex h-full w-full flex-1 flex-col items-center justify-center">
            <Loader className="h-30" />
            <h1 className="text-4xl font-bold text-white">
              {t("common:connecting")}
            </h1>
          </div>
        ) : (
          <>
            {!manager && <PlayerBand />}

            {manager && isLobby && (
              <div className="flex w-full justify-between p-4">
                {next && (
                  <Button
                    className={clsx(
                      "hover:bg-accent bg-white px-4 text-black",
                      {
                        "pointer-events-none": isDisabled,
                      },
                    )}
                    onClick={handleNext}
                  >
                    {t(next)}
                  </Button>
                )}

                {onBack && (
                  <Button
                    onClick={onBack}
                    className="hover:bg-accent bg-white px-4 text-black"
                  >
                    {t("common:exit")}
                  </Button>
                )}
              </div>
            )}

            <div className="flex flex-1 flex-col">{children}</div>

            {manager && !isLobby && (
              <HostDock
                statusName={statusName}
                disabled={isDisabled}
                onNext={handleNext}
              />
            )}
          </>
        )}
      </div>
    </section>
  )
}

export default GameWrapper
