import { EVENTS } from "@razzia/common/constants"
import type { QuizzStats, QuizzStatsMeta } from "@razzia/common/types/game"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import StatsModal from "@razzia/web/features/manager/components/StatsModal"
import { formatRate } from "@razzia/web/features/manager/utils/stats"
import { useCallback, useEffect, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const ConfigStats = () => {
  const { socket } = useSocket()
  const { t } = useTranslation()
  const [quizzes, setQuizzes] = useState<QuizzStatsMeta[]>([])
  const [selected, setSelected] = useState<QuizzStats | null>(null)

  useEffect(() => {
    socket.emit(EVENTS.STATS.LIST)
  }, [socket])

  useEvent(
    EVENTS.STATS.LIST_DATA,
    useCallback((data) => setQuizzes(data), []),
  )

  useEvent(
    EVENTS.STATS.DATA,
    useCallback((data) => setSelected(data), []),
  )

  useEvent(
    EVENTS.STATS.ERROR,
    useCallback((message) => toast.error(t(message)), [t]),
  )

  const handleOpen = (quizzId: string) => () => {
    socket.emit(EVENTS.STATS.GET, quizzId)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-0.5">
        {quizzes.map((quizz) => (
          <button
            key={quizz.quizzId}
            className="border-accent flex h-14 w-full items-center justify-between rounded-md border-2 p-3 text-left"
            onClick={handleOpen(quizz.quizzId)}
          >
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate font-medium">
                {quizz.subject}
              </p>
              <p className="text-muted-foreground text-xs">
                {t("manager:stats.gameCount", { count: quizz.gameCount })} ·{" "}
                {t("manager:stats.playerCount", { count: quizz.playerCount })}
              </p>
            </div>
            <span className="text-primary ml-2 shrink-0 text-sm font-semibold">
              {formatRate(quizz.successRate)}
            </span>
          </button>
        ))}

        {quizzes.length === 0 && (
          <p className="text-muted-foreground my-8 text-center">
            {t("manager:stats.none")}
          </p>
        )}
      </div>

      {selected && (
        <StatsModal stats={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

export default ConfigStats
