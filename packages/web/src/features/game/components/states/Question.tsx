import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import QuestionStage from "@razzia/web/features/game/components/question/QuestionStage"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { useQuestionStore } from "@razzia/web/features/game/stores/question"
import { SFX } from "@razzia/web/features/game/utils/constants"
import { useEffect, useState } from "react"
import useSound from "use-sound"

interface Props {
  data: CommonStatusDataMap["SHOW_QUESTION"]
}

const ignoreSubmit = () => {
  // The rows are locked during the reading time: nothing can be sent.
}

// Reading time: the question and its answers show at once, the answers locked
// until SELECT_ANSWER.
const Question = ({
  data: {
    question,
    media,
    upcomingMedia,
    cooldown,
    answers,
    questionType,
    time,
    totalPlayer,
  },
}: Props) => {
  const player = usePlayerStore((state) => state.player)
  const setLastAnswer = useQuestionStore((state) => state.setLastAnswer)
  const [remaining, setRemaining] = useState(cooldown)
  const [sfxShow] = useSound(SFX.SHOW_SOUND, { volume: 0.5 })

  useEffect(() => {
    sfxShow()
  }, [sfxShow])

  // A new question: the waiting screen no longer shows the previous answer.
  useEffect(() => {
    setLastAnswer(null)
  }, [setLastAnswer])

  // The server waits `cooldown` seconds: count down locally to 1, then
  // SELECT_ANSWER replaces this screen.
  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((value) => Math.max(1, value - 1))
    }, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [])

  return (
    <QuestionStage
      phase="reading"
      question={question}
      answers={answers}
      questionType={questionType}
      media={media}
      upcomingMedia={upcomingMedia}
      time={time}
      cooldown={cooldown}
      totalPlayers={totalPlayer}
      answered={0}
      remaining={remaining}
      onSubmit={ignoreSubmit}
      isHost={!player}
    />
  )
}

export default Question
