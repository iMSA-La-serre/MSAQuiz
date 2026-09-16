import AnswerChip from "@razzia/web/features/game/components/AnswerChip"
import {
  EASE_OUT_QUART,
  ENTER_DURATION,
  staggerDelay,
} from "@razzia/web/features/game/utils/motion"
import clsx from "clsx"
import { motion, type Variants } from "motion/react"
import type { ButtonHTMLAttributes, ReactNode } from "react"
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
  // A button when true, a plain div otherwise (host display).
  interactive?: boolean
  // Checkbox (multi) or count and percentage (distribution).
  trailing?: ReactNode
  // Under the text: distribution bar and label.
  footer?: ReactNode
  // Taller row with larger text (true/false on phone).
  large?: boolean
}

const TEXT_SIZES = {
  host: "text-lg leading-tight md:text-2xl xl:text-3xl",
  hostDense: "text-lg leading-tight md:text-xl xl:text-2xl",
  phone: "text-lg leading-snug",
  phoneLarge: "text-xl leading-snug",
}

const textSize = ({
  size,
  dense,
  large,
}: Pick<AnswerRowProps, "size" | "dense" | "large">) => {
  if (size === "host") {
    return dense ? TEXT_SIZES.hostDense : TEXT_SIZES.host
  }

  return large ? TEXT_SIZES.phoneLarge : TEXT_SIZES.phone
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
  interactive = false,
  trailing,
  footer,
  large = false,
  className,
  disabled,
  ...buttonProps
}: AnswerRowProps) => {
  const rowClassName = twMerge(
    clsx(
      "text-secondary relative flex w-full items-center rounded-2xl text-left transition-[background-color,box-shadow,opacity] duration-300 ease-out-quart motion-reduce:transition-none",
      size === "host"
        ? "min-h-20 gap-5 px-5 py-3 xl:min-h-24 xl:px-6"
        : "min-h-16 gap-3 px-3 py-2.5",
      {
        "min-h-20": size === "phone" && large,
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
      <AnswerChip index={index} size={size === "host" ? "lg" : "md"} />
      <span className="block min-w-0 flex-1">
        <span
          className={clsx(
            "block font-semibold break-words",
            textSize({ size, dense, large }),
          )}
        >
          {text}
        </span>
        {footer}
      </span>
      {trailing}
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
  children: ReactNode
}

export const AnswerReveal = ({
  index,
  as = "li",
  className,
  children,
}: AnswerRevealProps) => {
  if (as === "div") {
    return (
      <motion.div custom={index} variants={REVEAL} className={className}>
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
