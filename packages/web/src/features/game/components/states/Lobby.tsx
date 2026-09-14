import * as AlertDialog from "@radix-ui/react-alert-dialog"
import { EVENTS } from "@razzia/common/constants"
import type { Player } from "@razzia/common/types/game"
import type { ManagerStatusDataMap } from "@razzia/common/types/game/status"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import { useOnClickOutside } from "@razzia/web/hooks/useOnClickOutside"
import { Maximize2, UsersRound, X } from "lucide-react"
import { motion, MotionConfig } from "motion/react"
import { QRCodeSVG } from "qrcode.react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

interface Props {
  data: ManagerStatusDataMap["SHOW_ROOM"]
}

// First visible character of a username, emoji included.
const initial = (username: string) =>
  String.fromCodePoint(username.trim().codePointAt(0) ?? 63).toUpperCase()

const Lobby = ({ data: { inviteCode = "" } }: Props) => {
  const { gameId, players } = useManagerStore()
  const { socket } = useSocket()
  const [playerList, setPlayerList] = useState<Player[]>(players)
  const [qrOpen, setQrOpen] = useState(false)
  const qrContentRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()

  const joinUrl = `${window.location.origin}?code=${inviteCode}`

  useOnClickOutside({ ref: qrContentRef, handler: () => setQrOpen(false) })

  useEvent(EVENTS.MANAGER.NEW_PLAYER, (player) => {
    setPlayerList([...playerList, player])
  })

  useEvent(EVENTS.MANAGER.REMOVE_PLAYER, (playerId) => {
    setPlayerList(playerList.filter((p) => p.id !== playerId))
  })

  useEvent(EVENTS.MANAGER.PLAYER_KICKED, (playerId) => {
    setPlayerList(playerList.filter((p) => p.id !== playerId))
  })

  const handleKick = (playerId: string) => () => {
    if (!gameId) {
      return
    }

    socket.emit(EVENTS.MANAGER.KICK_PLAYER, {
      gameId,
      playerId,
    })
  }

  return (
    <MotionConfig reducedMotion="user">
      <section className="relative mx-auto grid w-full max-w-6xl flex-1 items-center gap-6 px-4 pb-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="text-foreground flex flex-col items-center gap-5 rounded-3xl bg-white p-6 text-center shadow-2xl md:p-8">
          <h2 className="text-2xl font-bold md:text-3xl">
            {t("game:lobby.title")}
          </h2>

          <AlertDialog.Root open={qrOpen} onOpenChange={setQrOpen}>
            <AlertDialog.Trigger asChild>
              <button
                type="button"
                aria-label={t("game:lobby.enlargeQr")}
                className="group border-accent focus-visible:border-primary focus-visible:ring-primary relative rounded-2xl border-2 p-3 outline-none focus-visible:ring-2"
              >
                <QRCodeSVG className="size-48 md:size-60" value={joinUrl} />
                <span className="absolute right-2 bottom-2 rounded-md bg-black/70 p-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Maximize2 className="size-5 text-white" />
                </span>
              </button>
            </AlertDialog.Trigger>

            <AlertDialog.Portal>
              <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
              <AlertDialog.Content
                ref={qrContentRef}
                className="fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6"
              >
                <AlertDialog.Title className="sr-only">
                  {t("game:lobby.enlargeQr")}
                </AlertDialog.Title>
                <AlertDialog.Description className="sr-only">
                  {joinUrl}
                </AlertDialog.Description>
                <button
                  type="button"
                  onClick={() => setQrOpen(false)}
                  aria-label={t("common:close")}
                  className="hover:bg-muted absolute -top-3 -right-3 rounded-full bg-white p-1.5 shadow-md"
                >
                  <X className="text-foreground size-6" />
                </button>
                <QRCodeSVG
                  className="size-56 md:size-70 lg:size-95"
                  value={joinUrl}
                />
              </AlertDialog.Content>
            </AlertDialog.Portal>
          </AlertDialog.Root>

          <div>
            <p className="text-lg font-semibold">{t("game:lobby.scan")}</p>
            <p className="text-muted-foreground">
              {t("game:lobby.orVisit")}{" "}
              <span className="text-foreground font-bold break-all">
                {window.location.host}
              </span>
            </p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <p className="text-muted-foreground text-sm font-semibold tracking-[0.15em] uppercase">
              {t("game:codeLabel")}
            </p>
            <p className="sr-only">{inviteCode}</p>
            <div aria-hidden className="flex gap-2">
              {inviteCode.split("").map((char, index) => (
                <span
                  key={index}
                  className="bg-secondary flex size-12 items-center justify-center rounded-lg text-3xl font-extrabold text-white md:size-14 md:text-4xl xl:size-16 xl:text-5xl"
                >
                  {char}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex min-h-72 flex-col rounded-3xl bg-black/25 p-5 text-white backdrop-blur-sm md:p-6 lg:max-h-[calc(100dvh-7rem)] lg:self-stretch">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold md:text-3xl">
              {t("game:lobby.participants")}
            </h2>
            <span
              aria-live="polite"
              className="bg-primary min-w-10 rounded-full px-3 py-1 text-center text-xl font-bold tabular-nums"
            >
              {playerList.length}
              <span className="sr-only"> {t("game:lobby.participants")}</span>
            </span>
          </div>

          {playerList.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-white/70">
              <UsersRound className="size-10" />
              <p className="text-lg">{t("game:lobby.empty")}</p>
            </div>
          ) : (
            // The list scrolls inside the panel, so a crowded lobby never
            // pushes the QR code and the game code off the projected screen.
            <ul className="grid min-h-0 content-start gap-2 overflow-y-auto sm:grid-cols-2">
              {playerList.map((player) => (
                <motion.li
                  key={player.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="flex items-center gap-3 rounded-xl bg-white/10 p-2"
                >
                  <span
                    aria-hidden
                    className="bg-primary flex size-9 shrink-0 items-center justify-center rounded-full text-lg font-bold"
                  >
                    {initial(player.username)}
                  </span>
                  <span
                    title={player.username}
                    className="min-w-0 flex-1 truncate text-lg font-semibold"
                  >
                    {player.username}
                  </span>
                  <button
                    type="button"
                    onClick={handleKick(player.id)}
                    aria-label={t("game:lobby.kick", {
                      name: player.username,
                    })}
                    title={t("game:lobby.kick", { name: player.username })}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white/60 outline-none hover:bg-white/15 hover:text-white focus-visible:bg-white/15 focus-visible:text-white focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <X className="size-5" />
                  </button>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </MotionConfig>
  )
}

export default Lobby
