import { MEDIA_TYPES } from "@razzia/common/constants"
import type { TimedMediaType } from "@razzia/common/types/game"
import Button from "@razzia/web/components/Button"
import { formatClock, progressOf } from "@razzia/web/features/game/media/clock"
import type { MediaPlaybackState } from "@razzia/web/features/game/media/controller"
import {
  fullscreenElement,
  subscribeFullscreen,
  toggleFullscreen,
} from "@razzia/web/features/game/media/fullscreen"
import {
  FULLSCREEN_KEY,
  hostMedia,
  TOGGLE_KEY,
  useMediaViewers,
} from "@razzia/web/features/game/media/host-media"
import { useQuestionStore } from "@razzia/web/features/game/stores/question"
import { REMOTE_SAFE_ATTRIBUTE } from "@razzia/web/features/game/utils/keys"
import clsx from "clsx"
import {
  ExternalLink,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCw,
  SkipBack,
  Smartphone,
} from "lucide-react"
import { useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"

// The shape and focus ring of the dock's buttons (HostDock), smaller.
const CONTROL =
  "focus-visible:outline-serre-yellow min-h-11 rounded-full py-2 text-base font-bold focus-visible:outline-3 focus-visible:outline-offset-2 lg:text-lg"

const QUIET = "bg-white/15 text-white hover:bg-white/25"

// Tells the remote to move the game on from here (HostDock), and names the
// control, so the next screen of the question gives it the focus back.
const controlProps = (name: string) => ({
  [REMOTE_SAFE_ATTRIBUTE]: "",
  "data-media-control": name,
})

interface StateProps {
  kind: TimedMediaType
  state: MediaPlaybackState
  ready: boolean
}

// A video file or a YouTube video: « la vidéo ».
const isVideo = (kind: TimedMediaType) => kind !== MEDIA_TYPES.AUDIO

/**
 * Play and pause. As wide playing as paused (« Lire », « Pause »), so the
 * controls after it stay where the pointer is. When the browser refused to
 * play on its own: « Lancer » a media that never played, « Reprendre » one
 * that did, in the colour of the next step.
 */
export const MediaToggle = ({ kind, state, ready }: StateProps) => {
  const { t } = useTranslation()
  const { playing, blocked, played } = state
  const video = isVideo(kind)

  const blockedLabel = () => {
    if (played) {
      return t(video ? "game:media.resumeVideo" : "game:media.resumeAudio")
    }

    return t(video ? "game:media.startVideo" : "game:media.startAudio")
  }

  const name = () => {
    if (blocked) {
      return blockedLabel()
    }

    if (playing) {
      return t(video ? "game:media.pauseVideo" : "game:media.pauseAudio")
    }

    return t(video ? "game:media.playVideo" : "game:media.playAudio")
  }

  return (
    <Button
      {...controlProps("toggle")}
      type="button"
      disabled={!ready}
      aria-label={name()}
      aria-keyshortcuts={TOGGLE_KEY}
      onClick={() => {
        hostMedia.toggle()
      }}
      className={clsx(
        CONTROL,
        "px-4 disabled:opacity-60",
        blocked ? "bg-primary text-white" : QUIET,
      )}
    >
      {blocked ? (
        <>
          <Play aria-hidden className="size-5" />
          {blockedLabel()}
        </>
      ) : (
        // Both labels in the same cell, one of them hidden: the width of
        // the wider.
        <span className="grid">
          <span
            className={clsx(
              "col-start-1 row-start-1 flex items-center gap-2",
              playing && "invisible",
            )}
          >
            <Play aria-hidden className="size-5" />
            {t("game:media.play")}
          </span>
          <span
            className={clsx(
              "col-start-1 row-start-1 flex items-center gap-2",
              !playing && "invisible",
            )}
          >
            <Pause aria-hidden className="size-5" />
            {t("game:media.pause")}
          </span>
        </span>
      )}
    </Button>
  )
}

// A round button with an icon only, named for assistive technologies and on
// hover.
const IconControl = ({
  name,
  label,
  icon: Icon,
  disabled,
  shortcut,
  onClick,
}: {
  name: string
  label: string
  icon: typeof SkipBack
  disabled?: boolean
  shortcut?: string
  onClick: () => void
}) => (
  <Button
    {...controlProps(name)}
    type="button"
    disabled={disabled}
    aria-label={label}
    aria-keyshortcuts={shortcut}
    title={label}
    onClick={onClick}
    className={clsx(CONTROL, QUIET, "w-11 px-0 disabled:opacity-60")}
  >
    <Icon aria-hidden className="size-5" />
  </Button>
)

/** Back to the start, playing on or paused as it was. First, as on a player. */
export const RestartControl = ({ ready }: { ready: boolean }) => {
  const { t } = useTranslation()

  return (
    <IconControl
      name="restart"
      label={t("game:media.restart")}
      icon={SkipBack}
      disabled={!ready}
      onClick={() => {
        hostMedia.restart()
      }}
    />
  )
}

/**
 * The video full screen: its box (MediaDriver.element), which the next
 * screen of the question takes over still full screen where the browser
 * moves it in place (see stage.ts). Left with Échap, or F.
 */
export const FullscreenControl = ({
  element,
}: {
  element: HTMLElement | null
}) => {
  const { t } = useTranslation()
  const current = useSyncExternalStore(subscribeFullscreen, fullscreenElement)

  if (!document.fullscreenEnabled) {
    return null
  }

  const full = current !== null && current === element

  return (
    <IconControl
      name="fullscreen"
      label={t(full ? "game:media.exitFullscreen" : "game:media.fullscreen")}
      icon={full ? Minimize : Maximize}
      disabled={element === null}
      shortcut={FULLSCREEN_KEY}
      onClick={() => {
        toggleFullscreen(element)
      }}
    />
  )
}

/**
 * Where it is: a bar and the clock. Or, when the browser refused to play on
 * its own, why it waits (read out by HostMediaStatus).
 */
export const MediaTimeline = ({
  state,
  ready,
  className,
}: {
  state: MediaPlaybackState
  ready: boolean
  className?: string
}) => {
  const { t } = useTranslation()
  const position = formatClock(ready ? state.position : 0)
  const duration = formatClock(ready ? state.duration : null)
  const progress = ready ? progressOf(state.position, state.duration) : 0

  return (
    <div className={clsx("flex min-h-6 items-center gap-3", className)}>
      {state.blocked ? (
        <p aria-hidden className="text-sm font-semibold text-white">
          {t("game:media.blocked")}
        </p>
      ) : (
        <>
          <div
            aria-hidden
            className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-white/20"
          >
            <div
              className="h-full origin-left rounded-full bg-white"
              style={{ transform: `scaleX(${progress})` }}
            />
          </div>
          {/* On one line: a row too narrow for it wraps, never overlaps. */}
          <p className="shrink-0 text-sm font-semibold whitespace-nowrap text-white/80 tabular-nums lg:text-base">
            <span aria-hidden>
              {position} / {duration}
            </span>
            <span className="sr-only">
              {t("game:media.elapsed", { position, duration })}
            </span>
          </p>
        </>
      )}
    </div>
  )
}

/** Loads a media that did not load again. */
export const RetryControl = () => {
  const { t } = useTranslation()

  return (
    <Button
      {...controlProps("retry")}
      type="button"
      onClick={() => {
        hostMedia.retry()
      }}
      className={clsx(CONTROL, QUIET, "px-4")}
    >
      <RotateCw aria-hidden className="size-5" />
      {t("game:media.retry")}
    </Button>
  )
}

/**
 * The video on YouTube, in a new tab: a video its owner keeps to YouTube
 * still plays there. A link, as a control of the host's.
 */
export const OpenOnYoutubeControl = ({ url }: { url: string }) => {
  const { t } = useTranslation()

  return (
    <a
      {...controlProps("youtube")}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        CONTROL,
        QUIET,
        "inline-flex items-center justify-center gap-2 px-4",
      )}
    >
      <ExternalLink aria-hidden className="size-5" />
      {t("game:media.openOnYoutube")}
      <span className="sr-only">{t("game:media.newTab")}</span>
    </a>
  )
}

/**
 * How many phones show the video that plays on every device, as the server
 * counts them: a pill apart from the clock (the look of a HintChip), a phone,
 * the number and, where the row has room (a slide's wide video), « 2
 * regardent »; named in full for assistive technologies and on hover. Read
 * out as it changes? No: a room where phones join one by one would chatter.
 */
export const ViewersCount = () => {
  const { t } = useTranslation()
  const question = useQuestionStore((state) => state.questionStates?.current)
  const count = useMediaViewers(question)
  const label = t("game:media.devices.viewers", { count })

  return (
    <p
      title={label}
      className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-white tabular-nums lg:text-base"
    >
      <Smartphone aria-hidden className="size-4 lg:size-5" />
      <span aria-hidden className="@xl:hidden">
        {count}
      </span>
      <span aria-hidden className="hidden @xl:inline">
        {t("game:media.devices.viewersShort", { count })}
      </span>
      <span className="sr-only">{label}</span>
    </p>
  )
}
