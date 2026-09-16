import {
  MEDIA_TYPES,
  NO_TIME_LIMIT,
  QUESTION_TYPE_META,
} from "@razzia/common/constants"
import type { QuestionType } from "@razzia/common/types/game"
import type { ManagerStatusDataMap } from "@razzia/common/types/game/status"
import AnswerRow from "@razzia/web/features/game/components/question/AnswerRow"
import HintChip from "@razzia/web/features/game/components/question/HintChip"
import QuestionBand from "@razzia/web/features/game/components/question/QuestionBand"
import StageMedia from "@razzia/web/features/game/components/question/StageMedia"
import { ANSWERS_LABELS, SFX } from "@razzia/web/features/game/utils/constants"
import {
  EASE_OUT_QUART,
  ENTER_DURATION,
  staggerDelay,
} from "@razzia/web/features/game/utils/motion"
import { shareOf } from "@razzia/web/features/game/utils/score"
import clsx from "clsx"
import { ListChecks, type LucideIcon, Vote } from "lucide-react"
import { motion, MotionConfig, useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import useSound from "use-sound"

interface Props {
  data: ManagerStatusDataMap["SHOW_RESPONSES"]
}

const HINTS: Partial<Record<QuestionType, { icon: LucideIcon; key: string }>> =
  {
    multi: { icon: ListChecks, key: "game:answer.multiHint" },
    poll: { icon: Vote, key: "game:answer.pollHint" },
  }

const TITLE = "font-bold text-balance text-white drop-shadow-lg"

const HOST_TITLE = "text-2xl md:text-4xl xl:text-5xl"

// Beyond this many characters in any answer, host rows use smaller text.
const DENSE_LENGTH = 60

// The bars start growing this long after the screen appears. The correct
// answer's outline and label appear with them, when the phones show their
// result cards.
const REVEAL_DELAY = 0.2

const BAR_DURATION = 0.6

// Opacity only: MotionConfig's reduced motion leaves opacity animated, so
// without motion the element is shown as it ends.
const fadeIn = (delay: number, reduceMotion: boolean | null) =>
  reduceMotion
    ? { initial: false as const }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: ENTER_DURATION, delay, ease: EASE_OUT_QUART },
      }

// Answer distribution on the projector: the answering screen stays in place
// and each row gains a neutral bar with its count and share of respondents.
const Responses = ({
  data: {
    question,
    answers,
    responses,
    solutions,
    media,
    type,
    totalAnswered,
    totalPlayers,
  },
}: Props) => {
  const { t, i18n } = useTranslation()
  const reduceMotion = useReducedMotion()
  const [revealed, setRevealed] = useState(false)
  const [sfxReveal] = useSound(SFX.SHOW_SOUND, { volume: 0.2 })

  useEffect(() => {
    sfxReveal()
  }, [sfxReveal])

  useEffect(() => {
    if (reduceMotion) {
      return
    }

    const timer = setTimeout(() => {
      setRevealed(true)
    }, REVEAL_DELAY * 1000)

    return () => {
      clearTimeout(timer)
    }
  }, [reduceMotion])

  const { scored } = QUESTION_TYPE_META[type]
  const isSlide = type === "slide"
  const hint = HINTS[type]
  const image = media?.type === MEDIA_TYPES.IMAGE ? media : undefined
  const dense = answers.some((answer) => answer.length > DENSE_LENGTH)
  const showCorrect = revealed || Boolean(reduceMotion)
  const unanswered = Math.max(0, totalPlayers - totalAnswered)
  const numberFormat = new Intl.NumberFormat(i18n.language)
  const percentFormat = new Intl.NumberFormat(i18n.language, {
    style: "percent",
    maximumFractionDigits: 0,
  })

  const band = (
    <header className="mx-auto w-full max-w-7xl px-6 pt-6">
      <QuestionBand
        variant="host"
        questionType={type}
        phase="results"
        time={NO_TIME_LIMIT}
        remaining={null}
        answered={totalAnswered}
        totalPlayers={totalPlayers}
      />
    </header>
  )

  // Same wrapper as the answering stage, so the image does not move.
  const imageBlock = image && (
    <div>
      <StageMedia media={image} alt={question} variant="host" slide={isSlide} />
    </div>
  )

  const renderRow = (answer: string, index: number) => {
    // Answers nobody picked have no entry.
    const count = index in responses ? responses[index] : 0
    const share = shareOf(count, totalAnswered)
    const percent = percentFormat.format(share)
    const isCorrect = scored && solutions.includes(index)
    const delay = staggerDelay(index, REVEAL_DELAY)
    const rowLabel = t("game:responses.rowLabel", {
      letter: ANSWERS_LABELS[index % ANSWERS_LABELS.length],
      count,
      total: totalAnswered,
      percent,
    })

    // On the row's top edge, out of the flow: inline after the text, the label
    // wraps to a second line in the narrow image column and every row moves.
    const correctLabel = isCorrect && (
      <motion.span
        {...fadeIn(REVEAL_DELAY, reduceMotion)}
        className="bg-serre-deep pointer-events-none absolute -top-2.5 right-5 rounded-full px-3 py-0.5 text-sm leading-4 font-bold tracking-[0.15em] whitespace-nowrap text-white uppercase xl:-top-3.5 xl:right-6 xl:py-1 xl:text-base xl:leading-5"
      >
        {t("game:responses.correct")}
      </motion.span>
    )

    // The same neutral tint on every row, the correct one included.
    const bar = (
      <span
        aria-hidden
        className="bg-secondary/10 mt-2 block h-3 overflow-hidden rounded-full xl:h-4"
      >
        <motion.span
          initial={reduceMotion ? false : { width: "0%" }}
          animate={{ width: `${share * 100}%` }}
          transition={{ duration: BAR_DURATION, delay, ease: EASE_OUT_QUART }}
          className="bg-secondary/70 block h-full rounded-full"
        />
      </span>
    )

    // A minimum width keeps every bar track the same length.
    const numbers = (
      <motion.span
        {...fadeIn(delay, reduceMotion)}
        className="flex min-w-40 shrink-0 items-baseline justify-end gap-3 tabular-nums xl:min-w-48"
      >
        <span className="text-3xl font-bold xl:text-4xl">
          {numberFormat.format(count)}
        </span>
        <span className="text-secondary/75 text-xl font-semibold xl:text-2xl">
          {percent}
        </span>
      </motion.span>
    )

    return (
      <li
        key={index}
        aria-label={
          isCorrect ? `${rowLabel}, ${t("game:responses.correct")}` : rowLabel
        }
      >
        <AnswerRow
          index={index}
          text={answer}
          size="host"
          dense={dense}
          outlined={isCorrect && showCorrect}
          footer={bar}
          trailing={
            <>
              {correctLabel}
              {numbers}
            </>
          }
        />
      </li>
    )
  }

  const list = (
    <div className="flex flex-col gap-4">
      {hint && (
        <div className="self-start">
          <HintChip icon={hint.icon}>{t(hint.key)}</HintChip>
        </div>
      )}
      {/* The count of missing answers hangs under the list, out of the flow,
      so the centred rows stay where the answering screen put them. */}
      <div className="relative">
        <ol
          aria-label={t("game:responses.label")}
          className="flex flex-col gap-3 xl:gap-4"
        >
          {answers.map(renderRow)}
        </ol>
        {unanswered > 0 && (
          <p className="absolute top-full right-0 mt-4 text-right text-xl whitespace-nowrap text-white/80 xl:text-2xl">
            {t("game:responses.noAnswer", { count: unanswered })}
          </p>
        )}
      </div>
    </div>
  )

  const renderBody = () => {
    // Nobody answers a slide: title and image at the slide-stage sizes.
    if (isSlide) {
      return (
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-8 px-6 py-8">
          <h2
            className={clsx(
              TITLE,
              "text-center text-3xl md:text-5xl xl:text-6xl",
            )}
          >
            {question}
          </h2>
          {imageBlock}
        </div>
      )
    }

    // Video and audio are not replayed: without an image, one column.
    if (imageBlock) {
      return (
        <div className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-8 px-6 py-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
          <div className="flex flex-col gap-6">
            <h2 className={clsx(TITLE, HOST_TITLE, "text-left")}>{question}</h2>
            {imageBlock}
          </div>
          {list}
        </div>
      )
    }

    return (
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 px-6 py-8">
        <h2 className={clsx(TITLE, HOST_TITLE, "text-center")}>{question}</h2>
        {list}
      </div>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-1 flex-col">
        {band}
        {renderBody()}
      </div>
    </MotionConfig>
  )
}

export default Responses
