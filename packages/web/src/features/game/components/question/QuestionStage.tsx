import { MEDIA_TYPES } from "@razzia/common/constants"
import type {
  AnswerPayload,
  QuestionMedia,
  QuestionOptions,
  QuestionType,
} from "@razzia/common/types/game"
import HintChip from "@razzia/web/features/game/components/question/HintChip"
import QuestionBand from "@razzia/web/features/game/components/question/QuestionBand"
import StageMedia from "@razzia/web/features/game/components/question/StageMedia"
import { enter } from "@razzia/web/features/game/utils/motion"
import { QUESTION_REGISTRY } from "@razzia/web/features/questions"
import clsx from "clsx"
import {
  Keyboard,
  ListChecks,
  ListOrdered,
  type LucideIcon,
  Vote,
} from "lucide-react"
import { motion, MotionConfig } from "motion/react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

interface Props {
  phase: "reading" | "answering"
  question: string
  answers: string[]
  questionType: QuestionType
  media?: QuestionMedia
  upcomingMedia?: "video" | "audio"
  time: number
  cooldown?: number
  totalPlayers: number
  answered: number
  remaining: number | null
  options?: QuestionOptions
  onSubmit: (_answer: AnswerPayload) => void
  isHost: boolean
}

const HINTS: Partial<Record<QuestionType, { icon: LucideIcon; key: string }>> =
  {
    multi: { icon: ListChecks, key: "game:answer.multiHint" },
    poll: { icon: Vote, key: "game:answer.pollHint" },
    ordering: { icon: ListOrdered, key: "game:answer.orderingHint" },
    shortanswer: { icon: Keyboard, key: "game:answer.shortanswerHint" },
  }

const TITLE = "font-bold text-balance text-white drop-shadow-lg"

const HOST_TITLE = "text-2xl md:text-4xl xl:text-5xl"

// Question, media and answers in the same boxes during reading and answering.
// Question and Answers are different components, so the whole stage remounts
// at SELECT_ANSWER: only identical boxes keep everything in place.
const QuestionStage = ({
  phase,
  question,
  answers,
  questionType,
  media,
  upcomingMedia,
  time,
  cooldown,
  totalPlayers,
  answered,
  remaining,
  options,
  onSubmit,
  isHost,
}: Props) => {
  const { t } = useTranslation()
  const isReading = phase === "reading"
  const [opened, setOpened] = useState(false)

  // Answering mounts with the rows still locked and opens them two frames
  // later, so the 300 ms colour change reads as unlocking.
  useEffect(() => {
    if (isReading) {
      return
    }

    let secondFrame = 0
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        setOpened(true)
      })
    })

    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
    }
  }, [isReading])

  const variant = isHost ? "host" : "phone"
  const isSlide = questionType === "slide"
  const hint = HINTS[questionType]
  const hasMedia = Boolean(media ?? upcomingMedia)
  const hasVisualMedia =
    media?.type === MEDIA_TYPES.IMAGE ||
    media?.type === MEDIA_TYPES.VIDEO ||
    upcomingMedia === MEDIA_TYPES.VIDEO
  const { AnswerComponent, hostTopAligned } = QUESTION_REGISTRY[questionType]

  // Reading: each block fades and rises in. Answering: already in place.
  const appear = (delay: number) => (isReading ? enter(delay) : {})

  const band = (
    <motion.div {...appear(0)}>
      <QuestionBand
        variant={variant}
        questionType={questionType}
        phase={phase}
        time={time}
        cooldown={cooldown}
        remaining={remaining}
        answered={answered}
        totalPlayers={totalPlayers}
      />
    </motion.div>
  )

  const mediaBlock = hasMedia && (
    <motion.div {...appear(0.1)}>
      <StageMedia
        media={media}
        upcomingMedia={upcomingMedia}
        alt={question}
        variant={variant}
        slide={isSlide}
      />
    </motion.div>
  )

  const hintChip = hint && (
    <motion.div {...appear(0.12)} className="self-start">
      <HintChip icon={hint.icon}>{t(hint.key)}</HintChip>
    </motion.div>
  )

  const answerList = (
    <AnswerComponent
      answers={answers}
      options={options}
      onSubmit={onSubmit}
      readOnly={isHost}
      locked={isReading || !opened}
      size={variant}
      large={questionType === "truefalse"}
    />
  )

  if (!isHost) {
    return (
      <MotionConfig reducedMotion="user">
        <motion.section
          initial={isReading ? "hidden" : false}
          animate="visible"
          className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 pt-3 pb-4"
        >
          {band}
          <motion.h2 {...appear(0.05)} className={clsx(TITLE, "text-2xl")}>
            {question}
          </motion.h2>
          {mediaBlock}
          {/* Anchored at the bottom, in the thumb zone. */}
          <div className="mt-auto flex flex-col gap-2">
            {hintChip}
            {answerList}
          </div>
        </motion.section>
      </MotionConfig>
    )
  }

  const renderHostBody = () => {
    if (isSlide) {
      return (
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-8 px-6 py-8">
          <motion.h2
            {...appear(0.05)}
            className={clsx(
              TITLE,
              "text-center text-3xl md:text-5xl xl:text-6xl",
            )}
          >
            {question}
          </motion.h2>
          {mediaBlock}
        </div>
      )
    }

    if (hasVisualMedia) {
      return (
        <div
          className={clsx(
            "mx-auto grid w-full max-w-7xl flex-1 gap-8 px-6 py-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12",
            hostTopAligned ? "items-start" : "items-center",
          )}
        >
          <div className="flex flex-col gap-6">
            <motion.h2
              {...appear(0.05)}
              className={clsx(TITLE, HOST_TITLE, "text-left")}
            >
              {question}
            </motion.h2>
            {mediaBlock}
          </div>
          <div className="flex flex-col gap-4">
            {hintChip}
            {answerList}
          </div>
        </div>
      )
    }

    return (
      <div
        className={clsx(
          "mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-8",
          hostTopAligned ? "justify-start" : "justify-center",
        )}
      >
        <motion.h2
          {...appear(0.05)}
          className={clsx(TITLE, HOST_TITLE, "text-center")}
        >
          {question}
        </motion.h2>
        {mediaBlock}
        <div className="flex flex-col gap-4">
          {hintChip}
          {answerList}
        </div>
      </div>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={isReading ? "hidden" : false}
        animate="visible"
        className="flex flex-1 flex-col"
      >
        <header className="mx-auto w-full max-w-7xl px-6 pt-6">{band}</header>
        {renderHostBody()}
      </motion.div>
    </MotionConfig>
  )
}

export default QuestionStage
