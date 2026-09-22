import AnswerChip from "@razzia/web/features/game/components/AnswerChip"
import {
  EASE_OUT_QUART,
  ENTER_DURATION,
  staggerDelay,
} from "@razzia/web/features/game/utils/motion"
import clsx from "clsx"
import { motion, type Variants } from "motion/react"
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react"
import { twMerge } from "tailwind-merge"

interface AnswerRowProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  index: number
  // The answer text; the distribution adds its « Bonne réponse » label inline.
  text: ReactNode
  size: "host" | "phone"
  // Reading time: shown dimmed and not answerable yet.
  locked?: boolean
  // Selected (multi, or the tapped single answer) or correct (distribution).
  outlined?: boolean
  // Smaller host text when an answer is long.
  dense?: boolean
  // Host only: a shorter row with a smaller chip and text, for lists longer
  // than a choice's (see isCompactList).
  compact?: boolean
  // Host only: a shorter row still, with a smaller chip and text, for lists
  // longer than a choice's five rows (a scale of up to eight levels). Takes
  // over from `compact`. It is as small as a projected row ever gets, and as
  // small as it has to be: eight of them leave about fifteen pixels above the
  // controls at 1280×650, which is why eight is also the most levels a scale
  // may hold (SCALE_LIMITS.MAX_LEVELS).
  tiny?: boolean
  // A button when true, a plain div otherwise (host display).
  interactive?: boolean
  // Checkbox (multi) or count and percentage (distribution).
  trailing?: ReactNode
  // Under the text: distribution bar and label.
  footer?: ReactNode
  // Under the whole row, across its width: the targets of an item
  // (statements, categorize). The row wraps it onto a line of its own.
  below?: ReactNode
  // Taller row with larger text (true/false on phone).
  large?: boolean
  // In place of the letter chip of `index`: the chip of another letter (an
  // ordering distribution lists its items in the correct order), or an icon.
  marker?: ReactNode
}

// A choice has four answers at most: its host rows are sized for four. Longer
// lists (an ordering has up to six items) use compact rows, so they fit a
// 1280×720 projector as four choice rows do.
const FULL_ROWS = 4

export const isCompactList = (count: number) => count > FULL_ROWS

// Past this many rows, even compact ones no longer fit a 1280×650 projector
// under a question on two lines: a scale of six levels or more uses the tiny
// ones.
const COMPACT_ROWS = 5

export const isTinyList = (count: number) => count > COMPACT_ROWS

const TEXT_SIZES = {
  host: "text-lg leading-tight md:text-2xl xl:text-3xl short:text-2xl",
  hostDense: "text-lg leading-tight md:text-xl xl:text-2xl",
  hostTiny: "text-base leading-tight md:text-lg xl:text-xl",
  phone: "text-lg leading-snug",
  phoneLarge: "text-xl leading-snug",
}

const textSize = ({
  size,
  dense,
  compact,
  tiny,
  large,
}: Pick<AnswerRowProps, "size" | "dense" | "compact" | "tiny" | "large">) => {
  if (size === "host") {
    if (tiny) {
      return TEXT_SIZES.hostTiny
    }

    return dense || compact ? TEXT_SIZES.hostDense : TEXT_SIZES.host
  }

  return large ? TEXT_SIZES.phoneLarge : TEXT_SIZES.phone
}

// The letter chip of a row, or of the marker standing in its place.
export const rowChipSize = (
  size: AnswerRowProps["size"],
  compact = false,
  tiny = false,
): "xs" | "sm" | "md" | "lg" => {
  if (tiny) {
    return "xs"
  }

  return size === "host" && !compact ? "lg" : "md"
}

// One row shell for the host list, the phone list and the distribution. The
// colour lives in the letter chip only; the row itself stays white.
const AnswerRow = ({
  index,
  text,
  size,
  locked = false,
  outlined = false,
  dense = false,
  compact = false,
  tiny = false,
  interactive = false,
  trailing,
  footer,
  below,
  large = false,
  marker,
  className,
  disabled,
  ...buttonProps
}: AnswerRowProps) => {
  const rowClassName = twMerge(
    clsx(
      "text-secondary relative flex w-full items-center rounded-2xl text-left transition-[background-color,box-shadow,opacity] duration-300 ease-out-quart motion-reduce:transition-none",
      size === "host"
        ? clsx(
            tiny ? "gap-4 px-4 xl:px-5" : "gap-5 px-5 xl:px-6",
            tiny && "min-h-11 py-1 short:min-h-7 short:py-0",
            !tiny &&
              (compact
                ? "min-h-14 py-1.5 short:min-h-12 short:py-1"
                : "min-h-20 py-3 xl:min-h-24 short:min-h-16 short:py-2"),
          )
        : "min-h-16 gap-3 px-3 py-2.5",
      {
        "min-h-20": size === "phone" && large,
        "flex-wrap": below !== undefined,
        "bg-white/70 shadow-none": locked,
        "bg-white shadow-lg shadow-black/15": !locked,
        "ring-primary ring-4": outlined,
        "active:bg-muted focus-visible:outline-serre-yellow focus-visible:outline-3 focus-visible:outline-offset-2 disabled:cursor-default":
          interactive,
      },
      className,
    ),
  )

  // Spans with display block: a button may only hold phrasing content.
  const content = (
    <>
      {marker ?? (
        <AnswerChip index={index} size={rowChipSize(size, compact, tiny)} />
      )}
      <span className="block min-w-0 flex-1">
        <span
          className={clsx(
            "block font-semibold break-words",
            textSize({ size, dense, compact, tiny, large }),
          )}
        >
          {text}
        </span>
        {footer}
      </span>
      {trailing}
      {below !== undefined && <span className="block basis-full">{below}</span>}
    </>
  )

  if (!interactive) {
    return <div className={rowClassName}>{content}</div>
  }

  return (
    <button
      type="button"
      {...buttonProps}
      disabled={locked || disabled}
      className={rowClassName}
    >
      {content}
    </button>
  )
}

// Rows enter with the reading stage, which sets the "hidden" and "visible"
// labels; mounted for answering, the stage skips the entrance.
const REVEAL: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: ENTER_DURATION,
      delay: staggerDelay(index, 0.15),
      ease: EASE_OUT_QUART,
    },
  }),
}

interface AnswerRevealProps {
  // Position in the stagger.
  index: number
  as?: "li" | "div"
  className?: string
  // The div only: lets a caller scroll the block into view.
  ref?: Ref<HTMLDivElement>
  children: ReactNode
}

export const AnswerReveal = ({
  index,
  as = "li",
  className,
  ref,
  children,
}: AnswerRevealProps) => {
  if (as === "div") {
    return (
      <motion.div
        ref={ref}
        custom={index}
        variants={REVEAL}
        className={className}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <motion.li custom={index} variants={REVEAL} className={className}>
      {children}
    </motion.li>
  )
}

export default AnswerRow
