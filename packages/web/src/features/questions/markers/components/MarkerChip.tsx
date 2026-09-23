import { Chip } from "@razzia/web/features/game/components/AnswerChip"
import { ANSWERS_COLORS } from "@razzia/web/features/game/utils/constants"
import clsx from "clsx"

interface Props {
  index: number
  size?: "xs" | "sm" | "md" | "lg"
  className?: string
}

// Where a choice shows its letter chip, a markers question shows the number
// of the marker: the number is what the image carries, and the colours cycle
// through the four answer tints as the letters do.
const MarkerChip = ({ index, size = "md", className }: Props) => (
  <Chip
    size={size}
    className={clsx(
      ANSWERS_COLORS[index % ANSWERS_COLORS.length],
      "tabular-nums",
      className,
    )}
  >
    {index + 1}
  </Chip>
)

export default MarkerChip
