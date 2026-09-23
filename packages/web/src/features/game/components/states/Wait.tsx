import { QUESTION_TYPES } from "@razzia/common/constants"
import type { PlayerStatusDataMap } from "@razzia/common/types/game/status"
import { isAssociationType } from "@razzia/common/utils/association"
import Loader from "@razzia/web/components/Loader"
import AnswerChip from "@razzia/web/features/game/components/AnswerChip"
import { DevicesAside } from "@razzia/web/features/game/components/question/DevicesMedia"
import { useDeviceMedia } from "@razzia/web/features/game/media/phone-media"
import MarkerChip from "@razzia/web/features/questions/markers/components/MarkerChip"
import {
  type SentAnswer,
  useQuestionStore,
} from "@razzia/web/features/game/stores/question"
import clsx from "clsx"
import { useRef } from "react"
import { useTranslation } from "react-i18next"

interface Props {
  data: PlayerStatusDataMap["WAIT"]
}

// A white tray: the deep green C chip would vanish on the navy background.
const TRAY = "rounded-2xl bg-white p-2 shadow-lg shadow-black/15"

// The letters of the answers picked, or the text typed. An ordering and a
// ranking keep their letters in the order chosen, which is the answer itself,
// in smaller chips: six must fit a 320 px phone. Every tray is as tall as the
// tray of one large letter chip, so the screen keeps its layout from one type
// to the next; a long text wraps. Word cloud words share the line of a typed
// text, apart from each other.
// Statements and categorize pair each item's letter with the target picked,
// across the line as word cloud words do, in chips smaller still: they wrap
// once at most, where one item to a line would push the title down the
// screen. A scale reads as the level picked, as a text does.
const SentAnswerTray = ({ sent }: { sent: SentAnswer }) => {
  const { answer, questionType, display, targets } = sent

  if (questionType === QUESTION_TYPES.SCALE) {
    return (
      <p
        className={clsx(
          TRAY,
          "text-secondary max-w-full px-5 py-4.5 text-xl leading-7 font-bold break-words",
        )}
      >
        {display}
      </p>
    )
  }

  if (isAssociationType(questionType) && "answerKeys" in answer) {
    return (
      <ul
        className={clsx(
          TRAY,
          "text-secondary flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-2 px-4 py-3 text-xl leading-7 font-bold",
        )}
      >
        {answer.answerKeys.map((key, index) => (
          <li key={index} className="flex min-w-0 items-center gap-1.5">
            <AnswerChip index={index} size="sm" />
            <span className="min-w-0 break-words">
              {targets?.at(key) ?? "?"}
            </span>
          </li>
        ))}
      </ul>
    )
  }

  if ("texts" in answer) {
    return (
      <ul
        className={clsx(
          TRAY,
          "text-secondary flex max-w-full flex-wrap justify-center gap-x-2 px-5 py-4.5 text-xl leading-7 font-bold break-words",
        )}
      >
        {answer.texts.map((text, index) => (
          <li key={index} className="min-w-0">
            {text}
            {index < answer.texts.length - 1 && (
              <span aria-hidden className="text-secondary/50 ml-2">
                ·
              </span>
            )}
          </li>
        ))}
      </ul>
    )
  }

  if ("text" in answer) {
    return (
      <p
        className={clsx(
          TRAY,
          "text-secondary max-w-full px-5 py-4.5 text-xl leading-7 font-bold break-words",
        )}
      >
        {display ?? answer.text}
      </p>
    )
  }

  // The markers tapped, by their numbers, as the image showed them.
  if (questionType === QUESTION_TYPES.MARKERS) {
    return (
      <div className={clsx(TRAY, "flex gap-2")}>
        {[...answer.answerKeys]
          .sort((a, b) => a - b)
          .map((key) => (
            <MarkerChip key={key} index={key} size="lg" />
          ))}
      </div>
    )
  }

  if (
    questionType === QUESTION_TYPES.ORDERING ||
    questionType === QUESTION_TYPES.RANKING
  ) {
    return (
      <div className={clsx(TRAY, "flex gap-1.5 py-3")}>
        {answer.answerKeys.map((key) => (
          <AnswerChip key={key} index={key} size="md" />
        ))}
      </div>
    )
  }

  return (
    <div className={clsx(TRAY, "flex gap-2")}>
      {[...answer.answerKeys]
        .sort((a, b) => a - b)
        .map((key) => (
          <AnswerChip key={key} index={key} size="lg" />
        ))}
    </div>
  )
}

const Wait = ({ data: { text } }: Props) => {
  const { t } = useTranslation()
  const lastAnswer = useQuestionStore((state) => state.lastAnswer)
  const { plan, choice } = useDeviceMedia()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const answered = text === "game:waitingForAnswers"
  const sent = answered ? lastAnswer : null
  // The question's video that plays on every device goes on here, in the
  // place of the wheel, once its player answered: the player, or the offer
  // to watch it here for a participant who has not chosen (who answered
  // first, or whose page reloaded).
  const video = answered && plan !== null && choice !== "decline"

  return (
    <section className="anim-show mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-4 text-center">
      {answered && <DevicesAside fallbackFocus={headingRef} />}
      {!video && <Loader className="size-16 md:size-20" />}

      {sent && (
        <>
          <p className="text-sm font-semibold tracking-[0.2em] text-white/70 uppercase">
            {t("game:wait.sent")}
          </p>
          <SentAnswerTray sent={sent} />
        </>
      )}

      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-bold text-balance text-white outline-none md:text-4xl"
      >
        {t(text)}
      </h2>
    </section>
  )
}

export default Wait
