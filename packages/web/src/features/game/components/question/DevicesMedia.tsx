import { MEDIA_TYPES } from "@razzia/common/constants"
import MediaUnavailable from "@razzia/web/components/MediaUnavailable"
import ScreenMediaCard from "@razzia/web/features/game/components/question/ScreenMediaCard"
import {
  type FocusTarget,
  handFocusTo,
  keepFocus,
  takeFocus,
} from "@razzia/web/features/game/media/device-focus"
import type { DevicePlan } from "@razzia/web/features/game/media/device-media"
import {
  fullscreenElement,
  subscribeFullscreen,
  toggleFullscreen,
} from "@razzia/web/features/game/media/fullscreen"
import {
  deviceMedia,
  useDeviceMedia,
  useDevicePlayer,
} from "@razzia/web/features/game/media/phone-media"
import {
  parkMediaElement,
  placeMediaElement,
} from "@razzia/web/features/game/media/stage"
import clsx from "clsx"
import {
  ChevronDown,
  ExternalLink,
  EyeOff,
  Maximize,
  Minimize,
  MonitorPlay,
  Play,
  Smartphone,
  Volume2,
  VolumeX,
} from "lucide-react"
import {
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { useTranslation } from "react-i18next"

// Google's privacy policy, which YouTube's player follows.
export const GOOGLE_PRIVACY_URL = "https://policies.google.com/privacy?hl=fr"

const FOCUS_RING =
  "focus-visible:outline-serre-yellow focus-visible:outline-3 focus-visible:outline-offset-2"

// The shape and focus ring of the host's controls (HostMediaControls), on a
// phone: 44 px high at least.
const CONTROL = clsx(
  FOCUS_RING,
  "flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2 text-base font-bold",
)

const QUIET = "bg-white/15 text-white hover:bg-white/25"

// The same, a round icon: its name for assistive technologies and on hover.
const ICON_CONTROL = clsx(
  FOCUS_RING,
  QUIET,
  "flex size-11 shrink-0 items-center justify-center rounded-full",
)

// The two answers to « Regarder ici ? », of the same weight, one above the
// other, both in view with the card: refusing is as easy as accepting.
const CHOICE = clsx(
  FOCUS_RING,
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white/15 px-4 py-2 text-base font-bold text-white hover:bg-white/25",
)

interface OfferProps {
  plan: DevicePlan
  // Folded to its title, which unfolds it: while the answers are open, and
  // on the result, where the rest of the screen comes first.
  folded?: boolean
}

// Set by « Regarder ici »: the player that comes in the card's place is
// brought fully into view, never left under the phone's band.
let revealNext = false

// Names a control, so the same block on the next screen of the question
// (the answers opening, the waiting screen) gives it the focus back.
const controlProps = (name: string) => ({ "data-device-control": name })

/**
 * The keyboard focus of a block that goes from one screen of the question
 * to the next (the stage remounts when the answers open): taken back on
 * mount, by the control that had it, or `fallbackRef`, or the block itself;
 * kept as the block goes.
 */
const useFocusAcross = (
  target: FocusTarget,
  rootRef: RefObject<HTMLElement | null>,
  fallbackRef: RefObject<HTMLElement | null>,
) => {
  useLayoutEffect(() => {
    const root = rootRef.current
    const handed = takeFocus(target)

    if (handed && root) {
      const named = handed.control
        ? root.querySelector<HTMLElement>(
            `[data-device-control="${handed.control}"]`,
          )
        : null
      const next = named ?? fallbackRef.current ?? root

      next.focus({ preventScroll: true })
    }

    return () => {
      const active = document.activeElement

      if (root && active instanceof HTMLElement && root.contains(active)) {
        keepFocus(target, active.dataset.deviceControl)
      }
    }
  }, [target, rootRef, fallbackRef])
}

/**
 * Before anything loads: « Regarder ici » or « Non, je regarde l'écran ».
 * The tap on the first is the one iOS asks for before a video plays with its
 * sound; for a YouTube video it is also the participant's consent to
 * YouTube's trackers, which the card tells about first (with Google's
 * privacy policy). Refusing loads nothing, and keeps the card that points
 * to the screen. Its title unfolds and folds it (a disclosure), so it
 * takes one row while the answers are open.
 */
export const DevicesOffer = ({ plan, folded = false }: OfferProps) => {
  const { t } = useTranslation()
  const titleId = useId()
  const bodyId = useId()
  const [open, setOpen] = useState(!folded)
  const rootRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLButtonElement>(null)
  const youtube = plan.source.kind === MEDIA_TYPES.YOUTUBE

  useFocusAcross("offer", rootRef, headerRef)

  return (
    <section
      ref={rootRef}
      aria-labelledby={titleId}
      className="flex flex-col rounded-2xl bg-black/25 text-left text-white backdrop-blur-sm"
    >
      <h3 id={titleId}>
        <button
          ref={headerRef}
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => {
            setOpen(!open)
          }}
          className={clsx(
            FOCUS_RING,
            "flex min-h-11 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left",
          )}
        >
          <Smartphone aria-hidden className="size-8 shrink-0 text-white/70" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-lg font-semibold text-balance">
              {t("game:media.devices.offer")}
            </span>
            {/* Folded, the title alone: one row by the answers. */}
            {open && (
              <span className="text-sm text-white/80">
                {t("game:media.devices.offerHint")}
              </span>
            )}
          </span>
          <ChevronDown
            aria-hidden
            className={clsx(
              "size-6 shrink-0 text-white/80 transition-transform motion-reduce:transition-none",
              open && "rotate-180",
            )}
          />
        </button>
      </h3>
      <div id={bodyId} hidden={!open} className="flex flex-col gap-3 px-4 pb-3">
        <p className="text-sm text-white/80">
          {t(
            youtube
              ? "game:media.devices.youtubeConsent"
              : "game:media.devices.fileNotice",
          )}
          {youtube && (
            <>
              {" "}
              <a
                {...controlProps("privacy")}
                href={GOOGLE_PRIVACY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={clsx(
                  FOCUS_RING,
                  "font-semibold text-white underline underline-offset-2",
                )}
              >
                {t("game:media.devices.googlePrivacy")}
                <ExternalLink
                  aria-hidden
                  className="ml-1 inline size-3.5 align-[-0.125em]"
                />
                <span className="sr-only">{t("game:media.newTab")}</span>
              </a>
            </>
          )}
        </p>
        <div className="flex flex-col gap-2">
          <button
            {...controlProps("watch")}
            type="button"
            className={CHOICE}
            onClick={() => {
              revealNext = true
              handFocusTo("player")
              deviceMedia.watch(plan)
            }}
          >
            <Play aria-hidden className="size-5" />
            {t("game:media.devices.watchHere")}
          </button>
          <button
            {...controlProps("decline")}
            type="button"
            className={CHOICE}
            onClick={() => {
              handFocusTo("screen")
              deviceMedia.decline(plan)
            }}
          >
            <MonitorPlay aria-hidden className="size-5" />
            {t("game:media.devices.watchScreen")}
          </button>
        </div>
      </div>
    </section>
  )
}

type FullscreenVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void }

// How the phone's player goes full screen: its box (Android, an iPad), or on
// an iPhone, which puts no element but a video full screen, a file's own
// <video> (with Safari's controls: the phone plays it on in step). YouTube's
// player on an iPhone cannot: none then.
const fullscreenOf = (element: HTMLElement | null): (() => void) | null => {
  if (!element) {
    return null
  }

  if (document.fullscreenEnabled) {
    return () => {
      toggleFullscreen(element)
    }
  }

  const video = element.querySelector<FullscreenVideo>("video")
  const enter = video?.webkitEnterFullscreen?.bind(video)

  return enter ?? null
}

/**
 * The phone's player, in step with the host's screen: a 16:9 frame (never
 * under 200 px high for YouTube's), and under it, never over it, « Couper le
 * son », « Plein écran », « Ne plus regarder ici » (the player goes, and the
 * card that points to the screen comes), and, while the host has it paused,
 * that the host starts it again. No pause of its own: the host plays and
 * pauses it for everyone. When the browser keeps it from playing while the
 * host plays it, « Lancer la vidéo »; for YouTube, touching the video works
 * too.
 */
export const DevicesPlayer = ({ plan }: { plan: DevicePlan }) => {
  const { t } = useTranslation()
  const player = useDevicePlayer()
  const { hostPlaying, stuck } = useDeviceMedia()
  const full = useSyncExternalStore(subscribeFullscreen, fullscreenElement)
  const slotRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const groupRef = useRef<HTMLDivElement>(null)
  const muteRef = useRef<HTMLButtonElement>(null)
  const element = player.key === plan.key ? player.element : null
  const youtube = plan.source.kind === MEDIA_TYPES.YOUTUBE
  // Only while the host plays it: paused, a tap would play it on this phone
  // alone.
  const needsTap = (player.blocked || stuck) && hostPlaying && !player.failed
  const fullscreen = player.failed ? null : fullscreenOf(element)
  const isFull = full !== null && full === element

  // Taken over from the previous screen's block within the same commit
  // (see stage.ts): it plays on.
  useLayoutEffect(() => {
    const slot = slotRef.current

    if (!slot || !element) {
      return
    }

    placeMediaElement(element, slot)

    return () => {
      if (element.parentNode === slot) {
        parkMediaElement(element)
      }
    }
  }, [element])

  // « Regarder ici »: in view, and the focus on its first control, the one
  // that tapped being gone; the control that had it on the previous screen
  // of the question.
  useLayoutEffect(() => {
    if (revealNext) {
      revealNext = false
      frameRef.current?.scrollIntoView({ block: "nearest" })
    }
  }, [])

  // Failed, the group itself (no « Couper le son » then).
  useFocusAcross("player", groupRef, muteRef)

  const status = () => {
    if (player.failed) {
      return t("game:media.devices.failed")
    }

    return t(
      hostPlaying ? "game:media.devices.playing" : "game:media.devices.paused",
    )
  }

  return (
    <div className="flex w-full flex-col gap-2 text-left">
      {/* Clear of the phone's band (PlayerBand) once brought into view. */}
      <div
        ref={frameRef}
        className={clsx(
          "relative aspect-video w-full scroll-mt-18 overflow-hidden rounded-2xl bg-black/40",
          youtube && "min-h-50",
        )}
      >
        {/* A player that failed is hidden, never covered. */}
        <div
          ref={slotRef}
          className={clsx("size-full", player.failed && "invisible")}
        />
        {player.failed && (
          <MediaUnavailable
            kind="video"
            detail={t("game:media.devices.failedHint")}
            className="absolute inset-0 rounded-2xl"
          />
        )}
      </div>
      <div
        ref={groupRef}
        tabIndex={-1}
        role="group"
        aria-label={t("game:media.devices.controls")}
        className="flex flex-wrap items-center gap-x-3 gap-y-2 outline-none"
      >
        {needsTap && (
          <button
            {...controlProps("start")}
            type="button"
            className={clsx(CONTROL, "bg-primary text-white")}
            onClick={() => {
              deviceMedia.resume()
              // The button goes once it plays: the focus stays in the group.
              muteRef.current?.focus()
            }}
          >
            <Play aria-hidden className="size-5" />
            {t("game:media.startVideo")}
          </button>
        )}
        {!player.failed && (
          <button
            {...controlProps("mute")}
            ref={muteRef}
            type="button"
            className={clsx(CONTROL, QUIET)}
            onClick={() => {
              deviceMedia.toggleMute()
            }}
          >
            {player.muted ? (
              <VolumeX aria-hidden className="size-5" />
            ) : (
              <Volume2 aria-hidden className="size-5" />
            )}
            {t(
              player.muted
                ? "game:media.devices.unmute"
                : "game:media.devices.mute",
            )}
          </button>
        )}
        {fullscreen && (
          <button
            {...controlProps("fullscreen")}
            type="button"
            aria-label={t(
              isFull ? "game:media.exitFullscreen" : "game:media.fullscreen",
            )}
            title={t(
              isFull ? "game:media.exitFullscreen" : "game:media.fullscreen",
            )}
            className={ICON_CONTROL}
            onClick={fullscreen}
          >
            {isFull ? (
              <Minimize aria-hidden className="size-5" />
            ) : (
              <Maximize aria-hidden className="size-5" />
            )}
          </button>
        )}
        <button
          {...controlProps("stop")}
          type="button"
          className={clsx(CONTROL, QUIET)}
          onClick={() => {
            handFocusTo("screen")
            deviceMedia.decline(plan)
          }}
        >
          <EyeOff aria-hidden className="size-5" />
          {t("game:media.devices.stop")}
        </button>
        {/* Read out as it changes; shown while the host has it paused,
        which the video cannot say (it plays, or its frame says it failed). */}
        <p
          aria-live="polite"
          className={clsx(
            "text-sm font-semibold text-white/80",
            hostPlaying || player.failed ? "sr-only" : "basis-full",
          )}
        >
          {status()}
        </p>
        {needsTap && youtube && (
          <p className="basis-full text-sm text-white/80">
            {t("game:media.devices.touchVideo")}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * On a phone, in the place of a video that plays on every device, driven by
 * the host: first the choice (DevicesOffer), then the player in step with
 * the host's screen (DevicesPlayer), or the card that points to the screen
 * for a participant who would rather watch it there.
 */
const DevicesMedia = ({ plan, folded }: OfferProps) => {
  const { key, choice } = useDeviceMedia()
  // Another question's choice until the page follows this one.
  const chosen = key === plan.key ? choice : null

  if (chosen === "decline") {
    return <ScreenMediaCard type={plan.source.kind} />
  }

  if (chosen === "watch") {
    return <DevicesPlayer plan={plan} />
  }

  return <DevicesOffer key={plan.key} plan={plan} folded={folded} />
}

/**
 * The question's video that plays on every device, on the screens after its
 * answers (the waiting screen once answered, the result), as long as the
 * projected screen shows it: the player goes on there, or the offer comes
 * again (after a reload). Nothing once its participant chose the screen:
 * that screen's heading, `fallbackFocus`, then takes the focus from « Ne
 * plus regarder ici ».
 */
export const DevicesAside = ({
  folded,
  fallbackFocus,
}: {
  folded?: boolean
  fallbackFocus: RefObject<HTMLElement | null>
}) => {
  const { plan, choice } = useDeviceMedia()
  const declined = choice === "decline"

  useEffect(() => {
    if (declined && takeFocus("screen")) {
      fallbackFocus.current?.focus()
    }
  }, [declined, fallbackFocus])

  if (!plan || declined) {
    return null
  }

  if (choice === "watch") {
    return <DevicesPlayer plan={plan} />
  }

  return <DevicesOffer key={plan.key} plan={plan} folded={folded} />
}

export default DevicesMedia
