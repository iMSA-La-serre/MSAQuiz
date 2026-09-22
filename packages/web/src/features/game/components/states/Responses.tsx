import {
  MEDIA_TYPES,
  NO_TIME_LIMIT,
  QUESTION_TYPE_META,
} from "@razzia/common/constants"
import type { QuestionType } from "@razzia/common/types/game"
import type { ManagerStatusDataMap } from "@razzia/common/types/game/status"
import QuestionBand from "@razzia/web/features/game/components/question/QuestionBand"
import ResponseRow, {
  ResponseList,
} from "@razzia/web/features/game/components/question/ResponseRow"
import StageMedia from "@razzia/web/features/game/components/question/StageMedia"
import { ANSWERS_LABELS, SFX } from "@razzia/web/features/game/utils/constants"
import { REVEAL_DELAY } from "@razzia/web/features/game/utils/motion"
import { QUESTION_REGISTRY } from "@razzia/web/features/questions"
import clsx from "clsx"
import { ListChecks, type LucideIcon, Vote } from "lucide-react"
import { MotionConfig, useReducedMotion } from "motion/react"
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

const HOST_TITLE = "text-2xl md:text-4xl xl:text-5xl short:text-3xl"

// Beyond this many characters in any answer, host rows use smaller text.
const DENSE_LENGTH = 60

// Answer distribution on the projector: the answering screen stays in place
// and each row gains a neutral bar with its count and share of respondents.
const Responses = ({ data }: Props) => {
  const {
    question,
    answers,
    responses,
    solutions,
    media,
    type,
    totalAnswered,
    totalPlayers,
  } = data
  const { t } = useTranslation()
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

  const band = (
    <header className="short:pt-4 mx-auto w-full max-w-7xl px-6 pt-6">
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

  const { DistributionList, hostTopAligned } = QUESTION_REGISTRY[type]

  // Types not answered by picking choices bring their own rows, in the same
  // frame.
  const content = DistributionList ? (
    <DistributionList data={data} revealed={showCorrect} />
  ) : (
    <ResponseList
      hint={hint && { icon: hint.icon, text: t(hint.key) }}
      unanswered={unanswered}
      rows={answers.length}
    >
      {answers.map((answer, index) => (
        <ResponseRow
          key={index}
          index={index}
          text={answer}
          // Answers nobody picked have no entry.
          count={index in responses ? responses[index] : 0}
          total={totalAnswered}
          label={(figures) =>
            t("game:responses.rowLabel", {
              letter: ANSWERS_LABELS[index % ANSWERS_LABELS.length],
              ...figures,
            })
          }
          correct={scored && solutions.includes(index)}
          revealed={showCorrect}
          dense={dense}
        />
      ))}
    </ResponseList>
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
        <div
          className={clsx(
            "short:py-4 mx-auto grid w-full max-w-7xl flex-1 gap-8 px-6 py-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12",
            hostTopAligned ? "items-start" : "items-center",
          )}
        >
          <div className="flex flex-col gap-6">
            <h2 className={clsx(TITLE, HOST_TITLE, "text-left")}>{question}</h2>
            {imageBlock}
          </div>
          {content}
        </div>
      )
    }

    return (
      <div
        className={clsx(
          "short:gap-5 short:py-4 mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-8",
          hostTopAligned ? "justify-start" : "justify-center",
        )}
      >
        <h2 className={clsx(TITLE, HOST_TITLE, "text-center")}>{question}</h2>
        {content}
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
