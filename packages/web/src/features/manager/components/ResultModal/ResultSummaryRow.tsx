import clsx from "clsx"
import { X } from "lucide-react"
import type { PropsWithChildren, ReactNode } from "react"

interface Props {
  // Chip or badge at the start; a crossed box when absent.
  mark?: ReactNode
  label: string
  // A second line under the label, in the same cell: an association's right
  // target. It shares the width of the label rather than taking a column of
  // its own, which would leave the label a few characters.
  note?: ReactNode
  count: string
  // Rows that are not an answer (« Sans réponse »).
  muted?: boolean
}

// One row of the answers block in the result window, for the types that
// bring their own block. Lives in a three-column grid: mark, label, count.
const ResultSummaryRow = ({
  mark,
  label,
  note,
  count,
  muted = false,
}: Props) => (
  <div className="contents">
    {mark ?? (
      <div className="border-accent flex size-6 shrink-0 items-center justify-center rounded-md border-2 bg-white">
        <X aria-hidden className="text-muted-foreground size-3 stroke-4" />
      </div>
    )}
    <div className="min-w-0">
      <span
        className={clsx("block truncate text-sm font-medium", {
          "text-muted-foreground": muted,
        })}
      >
        {label}
      </span>
      {note}
    </div>
    <span className="text-accent-foreground text-right text-sm font-semibold whitespace-nowrap">
      {count}
    </span>
  </div>
)

export const ResultSummaryGrid = ({ children }: PropsWithChildren) => (
  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 md:gap-y-2">
    {children}
  </div>
)

export default ResultSummaryRow
