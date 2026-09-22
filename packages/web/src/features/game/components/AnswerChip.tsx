import {
  ANSWERS_COLORS,
  answerLetter,
} from "@razzia/web/features/game/utils/constants"
import clsx from "clsx"
import type { HTMLAttributes, ReactNode } from "react"
import { twMerge } from "tailwind-merge"

type Size = "sm" | "md" | "lg"

// Every size keeps the letter at 20 px bold or more: navy on the green and
// blue chips is 3.6:1, which only passes AA as large text.
const SIZES: Record<Size, string> = {
  sm: "size-8 rounded-lg text-xl leading-none",
  md: "size-10 rounded-xl text-xl leading-none",
  lg: "size-12 rounded-xl text-2xl leading-none xl:size-14 xl:text-3xl short:size-12 short:text-2xl",
}

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  size?: Size
  children?: ReactNode
}

// The letter chip's box, for what stands in the same place: a position
// number, an icon, nothing. The caller gives the colours.
export const Chip = ({
  size = "md",
  className,
  children,
  ...spanProps
}: ChipProps) => (
  <span
    {...spanProps}
    className={twMerge(
      clsx(
        "inline-flex shrink-0 items-center justify-center font-bold ring-1 ring-black/10 ring-inset",
        SIZES[size],
        className,
      ),
    )}
  >
    {children}
  </span>
)

interface Props {
  index: number
  size?: Size
  className?: string
}

// The letter is not aria-hidden: it is part of the row's accessible name.
const AnswerChip = ({ index, size = "md", className }: Props) => (
  <Chip
    size={size}
    className={clsx(ANSWERS_COLORS[index % ANSWERS_COLORS.length], className)}
  >
    {answerLetter(index)}
  </Chip>
)

export default AnswerChip
