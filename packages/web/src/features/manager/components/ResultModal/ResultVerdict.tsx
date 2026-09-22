import clsx from "clsx"
import {
  Check,
  CircleDashed,
  type LucideIcon,
  Minus,
  Vote,
  X,
} from "lucide-react"

// Recorded: an answer to a question with no right answer (word cloud), with
// the icon of the phone's « Réponse enregistrée », not the tick of a right
// answer.
export type Verdict = "correct" | "partial" | "wrong" | "noAnswer" | "recorded"

const STYLES: Record<Verdict, { icon: LucideIcon; className: string }> = {
  correct: { icon: Check, className: "text-success-strong" },
  partial: { icon: CircleDashed, className: "text-foreground" },
  wrong: { icon: X, className: "text-danger" },
  noAnswer: { icon: Minus, className: "text-muted-foreground" },
  recorded: { icon: Vote, className: "text-foreground" },
}

interface Props {
  verdict: Verdict
  label: string
}

// The verdict cell of a player's row in the result window, for the types
// that bring their own cells (the choice types keep theirs).
const ResultVerdict = ({ verdict, label }: Props) => {
  const { icon: Icon, className } = STYLES[verdict]

  return (
    <span className={clsx("flex items-center gap-1", className)}>
      <Icon aria-hidden className="size-4 shrink-0 stroke-4" />
      {label}
    </span>
  )
}

export default ResultVerdict
