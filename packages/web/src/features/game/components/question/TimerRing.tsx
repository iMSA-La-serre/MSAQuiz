import clsx from "clsx"
import type { ReactNode } from "react"

type Tone = "reading" | "answer" | "warning"

interface Props {
  size: "host" | "phone"
  // Share of the time left, from 1 (full ring) to 0 (empty); null without a
  // time limit, where only the track is drawn.
  fraction: number | null
  tone: Tone
  children?: ReactNode
}

const RADIUS = 28

const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const TONES: Record<Tone, string> = {
  reading: "stroke-white/70",
  answer: "stroke-primary",
  warning: "stroke-serre-yellow",
}

// The ring drains as time runs out: a stroke around a transparent centre,
// never a filled disc. The svg is decorative; the content in the centre (a
// number or an icon) carries the value. Without a time limit only the track
// is drawn, so the slot keeps its size with nothing to count down.
const TimerRing = ({ size, fraction, tone, children }: Props) => {
  const strokeWidth = size === "host" ? 6 : 7
  const filled = fraction === null ? null : Math.min(1, Math.max(0, fraction))

  return (
    <div
      className={clsx(
        "relative shrink-0",
        size === "host" ? "size-16 xl:size-20" : "size-10",
      )}
    >
      {/* The svg itself is rotated so the arc starts at the top: rotating the
      circle would depend on its transform box. */}
      <svg aria-hidden viewBox="0 0 64 64" className="size-full -rotate-90">
        <circle
          cx={32}
          cy={32}
          r={RADIUS}
          strokeWidth={strokeWidth}
          className="fill-none stroke-white/15"
        />
        {filled !== null && (
          <circle
            cx={32}
            cy={32}
            r={RADIUS}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            style={{ strokeDashoffset: CIRCUMFERENCE * (1 - filled) }}
            className={clsx(
              "fill-none transition-[stroke-dashoffset,stroke] duration-1000 ease-linear motion-reduce:transition-none",
              TONES[tone],
            )}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

export default TimerRing
