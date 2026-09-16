import clsx from "clsx"
import { twMerge } from "tailwind-merge"

interface Props {
  rank: number
  large?: boolean
  className?: string
}

const RankChip = ({ rank, large, className }: Props) => (
  <span
    className={twMerge(
      clsx(
        "flex shrink-0 items-center justify-center rounded-lg font-bold tabular-nums",
        large
          ? "text-primary size-14 bg-white text-3xl md:size-16 md:text-4xl"
          : "size-10 bg-white/15 text-xl",
        className,
      ),
    )}
  >
    {rank}
  </span>
)

export default RankChip
