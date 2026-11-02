import clsx from "clsx"
import { X } from "lucide-react"
import { type PropsWithChildren, useEffect } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import { twMerge } from "tailwind-merge"

type Props = PropsWithChildren & {
  title: string
  onClose: () => void
  className?: string
}

// A panel over the configuration card, closed by its button only: a click
// beside it would lose what was typed. Rendered in the body, under the menus
// and confirmations it opens (z-50), which the card's own layer would hide.
const ManagerModal = ({ title, onClose, className, children }: Props) => {
  const { t } = useTranslation()

  useEffect(() => {
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={twMerge(
          clsx(
            "bg-background flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-xl shadow-2xl",
            className,
          ),
        )}
      >
        <div className="border-accent flex shrink-0 items-center gap-3 border-b-2 px-5 py-3">
          <h2 className="text-foreground flex-1 truncate text-base font-bold">
            {title}
          </h2>
          <button
            onClick={onClose}
            title={t("common:close")}
            className="text-muted-foreground hover:bg-muted hover:text-accent-foreground rounded p-1"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export default ManagerModal
