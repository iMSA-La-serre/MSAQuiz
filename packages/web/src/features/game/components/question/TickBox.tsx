import clsx from "clsx"
import type { ReactNode } from "react"

interface Props {
  checked: boolean
  // Inside the filled box: the tick, or an ordering's position.
  children?: ReactNode
}

// The square at the end of a phone row that is toggled (multi, ordering).
// Decorative: the row's role and name carry the state.
const TickBox = ({ checked, children }: Props) => (
  <span
    aria-hidden
    className={clsx(
      "flex size-7 shrink-0 items-center justify-center rounded-lg",
      checked ? "bg-primary text-white" : "border-secondary/60 border-2",
    )}
  >
    {checked && children}
  </span>
)

export default TickBox
