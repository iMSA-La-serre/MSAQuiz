import {
  ANSWERS_COLORS,
  ANSWERS_LABELS,
} from "@razzia/web/features/game/utils/constants"
import clsx from "clsx"
import { twMerge } from "tailwind-merge"

type Size = "sm" | "md" | "lg"

interface Props {
  index: number
  size?: Size
  className?: string
}

// Every size keeps the letter at 20 px bold or more: navy on the green and
// blue chips is 3.6:1, which only passes AA as large text.
const SIZES: Record<Size, string> = {
  sm: "size-8 rounded-lg text-xl leading-none",
  md: "size-10 rounded-xl text-xl leading-none",
  lg: "size-12 rounded-xl text-2xl leading-none xl:size-14 xl:text-3xl",
}

// The letter is not aria-hidden: it is part of the row's accessible name.
const AnswerChip = ({ index, size = "md", className }: Props) => (
  <span
    className={twMerge(
      clsx(
        "inline-flex shrink-0 items-center justify-center font-bold ring-1 ring-black/10 ring-inset",
        SIZES[size],
        ANSWERS_COLORS[index % ANSWERS_COLORS.length],
        className,
      ),
    )}
  >
    {ANSWERS_LABELS[index % ANSWERS_LABELS.length]}
  </span>
)

export default AnswerChip
