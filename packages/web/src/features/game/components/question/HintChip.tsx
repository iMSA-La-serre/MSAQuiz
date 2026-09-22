import clsx from "clsx"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { twMerge } from "tailwind-merge"

interface Props {
  icon: LucideIcon
  children: ReactNode
  className?: string
}

// A short note on how to answer ("Plusieurs réponses possibles"), on the dark
// stage. On one line, the radius makes a pill; a note that wraps on a narrow
// phone keeps rounded corners and even lines instead of an oval.
const HintChip = ({ icon: Icon, children, className }: Props) => (
  <span
    className={twMerge(
      clsx(
        "inline-flex items-center gap-2 rounded-2xl bg-white/15 px-3 py-1 text-sm font-semibold text-balance text-white md:text-base",
        className,
      ),
    )}
  >
    <Icon aria-hidden className="size-4 shrink-0 md:size-5" />
    {children}
  </span>
)

export default HintChip
