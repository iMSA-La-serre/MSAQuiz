import { ResponseFrame } from "@razzia/web/features/game/components/question/ResponseRow"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import { useQuestionStore } from "@razzia/web/features/game/stores/question"
import {
  EASE_OUT_QUART,
  ENTER_DURATION,
  REVEAL_DELAY,
  STAGGER_STEP,
} from "@razzia/web/features/game/utils/motion"
import type { DistributionProps } from "@razzia/web/features/questions/types"
import {
  cloudCounts,
  type CloudScreen,
  fitSize,
  SCREEN_ONLY,
  WORD_SIZES,
  wordColor,
  wordDisplay,
  wordSizes,
} from "@razzia/web/features/questions/wordcloud/utils/cloud"
import {
  hiddenWordsKey,
  readHiddenWords,
  saveHiddenWords,
} from "@razzia/web/features/questions/wordcloud/utils/hidden"
import clsx from "clsx"
import { Cloud, EyeOff } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

// Focus ring on the white card, as in the editor.
const WHITE_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"

// On the dark stage, as the answer rows.
const STAGE_FOCUS =
  "focus-visible:outline-serre-yellow focus-visible:outline-3 focus-visible:outline-offset-2"

const SCREENS: CloudScreen[] = ["short", "regular", "tall"]

// Word cloud on the projector: in the white card of an answer row, the words
// typed, the most frequent first and the largest, each on one line. A click
// on a word hides it from the room (live moderation) and a second one shows
// it again, even after a reload of the page; what players typed is never
// linked to who typed it.
const WordCloudResponses = ({
  data: { words = [], distinctWords, totalAnswered, totalPlayers },
}: DistributionProps) => {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const gameId = useManagerStore((state) => state.gameId)
  const questionNumber = useQuestionStore(
    (state) => state.questionStates?.current,
  )
  const storageKey = hiddenWordsKey(gameId, questionNumber)
  const [stored, setStored] = useState(() => ({
    key: storageKey,
    words: readHiddenWords(storageKey),
  }))

  // After a reload, the game and the question are known once the
  // reconnection lands: read what the tab kept for them then.
  if (stored.key !== storageKey) {
    setStored({ key: storageKey, words: readHiddenWords(storageKey) })
  }

  const hidden: ReadonlySet<string> = stored.words
  const texts = words.map(({ text }) => text)
  const sizes = wordSizes(words.map(({ count }) => count)).map((size, index) =>
    fitSize(size, texts[index]),
  )
  // The words past the room of the card on this projector are left out, for
  // screen readers too; the note under the card says how many.
  const counts = cloudCounts(texts, sizes)
  const shown = words.slice(0, Math.max(...SCREENS.map((s) => counts[s])))
  const total = distinctWords ?? words.length
  const allHidden = shown.every(({ text }) => hidden.has(text))

  const setHidden = (next: ReadonlySet<string>) => {
    setStored({ key: storageKey, words: new Set(next) })
    saveHiddenWords(storageKey, next)
  }

  const toggle = (text: string) => {
    const next = new Set(hidden)

    if (!next.delete(text)) {
      next.add(text)
    }

    setHidden(next)
  }

  // Aria-disabled rather than disabled: the button keeps the focus once
  // clicked, and says it has nothing left to do.
  const actionClassName = clsx(
    "-my-2 min-h-11 rounded-full px-3 text-sm font-semibold text-white/80 hover:bg-white/15 hover:text-white aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-transparent aria-disabled:hover:text-white/80 md:text-base",
    STAGE_FOCUS,
  )

  const actions = words.length > 0 && (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        aria-disabled={allHidden}
        onClick={() => setHidden(new Set(shown.map(({ text }) => text)))}
        className={actionClassName}
      >
        {t("game:wordcloud.hideAll")}
      </button>
      <button
        type="button"
        aria-disabled={hidden.size === 0}
        onClick={() => setHidden(new Set())}
        className={actionClassName}
      >
        {t("game:wordcloud.showAll")}
      </button>
    </div>
  )

  // The words this projector leaves out, once per projector height.
  const leftOut = SCREENS.filter((screen) => total > counts[screen])
  const aside = leftOut.length > 0 && (
    <>
      {leftOut.map((screen) => (
        <span key={screen} className={SCREEN_ONLY[screen]}>
          {t("game:wordcloud.moreWords", { count: total - counts[screen] })}
        </span>
      ))}
    </>
  )

  return (
    <ResponseFrame
      hint={{
        icon: Cloud,
        text: `${t("game:wordcloud.wordCount", {
          count: total,
        })} · ${t("game:wordcloud.answerCount", { count: totalAnswered })}`,
      }}
      actions={actions}
      aside={aside}
      unanswered={Math.max(0, totalPlayers - totalAnswered)}
    >
      <div className="short:px-5 short:py-3 rounded-2xl bg-white px-6 py-5 shadow-lg shadow-black/15 xl:px-8 xl:py-6">
        {words.length === 0 ? (
          <p className="text-secondary/75 py-2 text-center text-xl font-semibold xl:text-2xl">
            {t("game:wordcloud.empty")}
          </p>
        ) : (
          <ul
            aria-label={t("game:wordcloud.listLabel")}
            className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 xl:gap-x-6"
          >
            {shown.map(({ text, count }, index) => {
              const isHidden = hidden.has(text)

              return (
                <motion.li
                  key={text}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: ENTER_DURATION,
                    // Half steps: thirty words in under a second.
                    delay: REVEAL_DELAY + (index * STAGGER_STEP) / 2,
                    ease: EASE_OUT_QUART,
                  }}
                  className={clsx("min-w-0", wordDisplay(index, counts))}
                >
                  {/* The count is in the name only: a title would read it
                  twice, and show a tooltip to the room. */}
                  <button
                    type="button"
                    aria-pressed={isHidden}
                    aria-label={t("game:wordcloud.toggle", {
                      word: text,
                      count,
                    })}
                    onClick={() => toggle(text)}
                    className={clsx(
                      "relative flex min-h-11 max-w-full min-w-11 items-center justify-center rounded-lg px-2 leading-tight font-bold whitespace-nowrap transition-colors duration-200 motion-reduce:transition-none",
                      WORD_SIZES[sizes[index]],
                      // A dashed outline and an eye, both past 3:1, tell a
                      // hidden word from a gap in the cloud.
                      isHidden
                        ? "bg-secondary/10 outline-secondary/50 text-transparent outline-1 -outline-offset-1 outline-dashed"
                        : clsx(wordColor(index), "hover:bg-secondary/5"),
                      WHITE_FOCUS,
                    )}
                  >
                    <span className="truncate">{text}</span>
                    {isHidden && (
                      <EyeOff
                        aria-hidden
                        className="text-secondary/70 absolute inset-0 m-auto size-5"
                      />
                    )}
                  </button>
                </motion.li>
              )
            })}
          </ul>
        )}
      </div>
    </ResponseFrame>
  )
}

export default WordCloudResponses
