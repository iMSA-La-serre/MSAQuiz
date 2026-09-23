import { STATUS, type Status } from "@razzia/common/types/game/status"
import Button from "@razzia/web/components/Button"
import HostMediaStatus from "@razzia/web/features/game/components/question/HostMediaStatus"
import HostSoundBar from "@razzia/web/features/game/components/question/HostSoundBar"
import { MANAGER_SKIP_BTN } from "@razzia/web/features/game/utils/constants"
import { REMOTE_SAFE_ATTRIBUTE } from "@razzia/web/features/game/utils/keys"
import clsx from "clsx"
import { ArrowRight, LogOut, type LucideIcon, SkipForward } from "lucide-react"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"

interface Props {
  statusName: Status | undefined
  disabled: boolean
  onNext: () => void
}

interface DockAction {
  icon: LucideIcon
  className: string
  // Whether a presentation clicker (right arrow, page down) triggers it.
  presenterKeys: boolean
}

// Held over a screen too long for it, over a white row, it takes the navy of
// the phone's band (the stuck variant, see index.css).
const QUIET =
  "bg-white/15 text-white hover:bg-white/25 stuck:bg-secondary stuck:shadow-lg stuck:shadow-black/20"

const ACTIONS: Partial<Record<Status, DockAction>> = {
  [STATUS.SELECT_ANSWER]: {
    icon: SkipForward,
    className: QUIET,
    presenterKeys: true,
  },
  [STATUS.SHOW_RESPONSES]: {
    icon: ArrowRight,
    className: "bg-primary text-white",
    presenterKeys: true,
  },
  [STATUS.SHOW_LEADERBOARD]: {
    icon: ArrowRight,
    className: "bg-primary text-white",
    presenterKeys: true,
  },
  // Leaving the final ranking is not a "next": a clicker must not do it.
  [STATUS.FINISHED]: { icon: LogOut, className: QUIET, presenterKeys: false },
}

const PRESENTER_KEYS = new Set(["ArrowRight", "PageDown"])

// Where the arrow keys already mean something (typing, choosing, seeking).
const OWN_KEYS_SELECTOR = "input, textarea, select, button, video, audio"

const DOCK_BUTTON_ATTRIBUTE = "data-host-dock"

const hasOwnKeys = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  // The dock button itself stays focused after a mouse click, and so does a
  // media control (play, pause): the clicker must keep working then.
  if (
    target.hasAttribute(DOCK_BUTTON_ATTRIBUTE) ||
    target.closest(`[${REMOTE_SAFE_ATTRIBUTE}]`) !== null
  ) {
    return false
  }

  return target.isContentEditable || target.closest(OWN_KEYS_SELECTOR) !== null
}

// Host controls at the bottom right of every in-game screen but the lobby.
// Always rendered, even empty, so content never jumps when a button appears.
// On the left, the controls of the question's sound, which has nothing to
// show (HostSoundBar). Held at the bottom of the screen, over a screen too
// long for it, so « Passer » and « Suivant » stay in view and clickable,
// and legible over its rows (stuck, see QUIET).
const HostDock = ({ statusName, disabled, onNext }: Props) => {
  const { t } = useTranslation()
  const label = statusName ? MANAGER_SKIP_BTN[statusName] : null
  const action = statusName ? ACTIONS[statusName] : undefined
  const listensToKeys = Boolean(label && action?.presenterKeys) && !disabled

  useEffect(() => {
    if (!listensToKeys) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const modified =
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey

      if (
        !PRESENTER_KEYS.has(event.key) ||
        event.repeat ||
        modified ||
        event.defaultPrevented ||
        hasOwnKeys(event.target)
      ) {
        return
      }

      event.preventDefault()
      onNext()
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [listensToKeys, onNext])

  const Icon = action?.icon

  return (
    <footer className="short:min-h-16 short:pb-4 [container-type:scroll-state] pointer-events-none sticky bottom-0 z-10 mx-auto flex min-h-22 w-full max-w-7xl items-end justify-end gap-6 px-6 pb-6">
      <HostSoundBar />
      <HostMediaStatus />
      {label && action && Icon && (
        <Button
          size="lg"
          {...{ [DOCK_BUTTON_ATTRIBUTE]: "" }}
          aria-disabled={disabled}
          onClick={onNext}
          className={clsx(
            "focus-visible:outline-serre-yellow pointer-events-auto ml-auto shrink-0 rounded-full px-6 py-3 text-xl font-bold focus-visible:outline-3 focus-visible:outline-offset-2",
            action.className,
            { "pointer-events-none opacity-70": disabled },
          )}
        >
          {t(label)}
          <Icon aria-hidden className="size-5" />
        </Button>
      )}
    </footer>
  )
}

export default HostDock
