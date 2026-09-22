import clsx from "clsx"

interface Props {
  // From 1.
  position: number
  size: "xs" | "sm"
}

// Same footprint as the letter chip, in navy: a place in the correct order.
const SIZES: Record<Props["size"], string> = {
  xs: "size-5 rounded text-xs",
  sm: "size-8 rounded-lg text-base",
}

// Decorative: the row's accessible name, or the list it sits in, carries the
// position.
const PositionBadge = ({ position, size }: Props) => (
  <span
    aria-hidden
    className={clsx(
      "bg-secondary inline-flex shrink-0 items-center justify-center leading-none font-bold text-white tabular-nums",
      SIZES[size],
    )}
  >
    {position}
  </span>
)

export default PositionBadge
