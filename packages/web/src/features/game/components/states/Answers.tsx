import { EVENTS, MEDIA_TYPES, NO_TIME_LIMIT } from "@razzia/common/constants"
import type {
  AnswerPayload,
  QuestionMediaType,
} from "@razzia/common/types/game"
import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import { isTimedMedia } from "@razzia/common/utils/media"
import QuestionStage from "@razzia/web/features/game/components/question/QuestionStage"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { useQuestionStore } from "@razzia/web/features/game/stores/question"
import { SFX } from "@razzia/web/features/game/utils/constants"
import { QUESTION_REGISTRY } from "@razzia/web/features/questions"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import useSound from "use-sound"

interface Props {
  data: CommonStatusDataMap["SELECT_ANSWER"]
}

const Answers = ({
  data: {
    question,
    answers,
    media,
    time,
    totalPlayer,
    questionType,
    options,
    text,
    targets,
    markers,
  },
}: Props) => {
  const { t } = useTranslation()
  const { socket } = useSocket()
  const { player, gameId } = usePlayerStore()
  const setLastAnswer = useQuestionStore((state) => state.setLastAnswer)

  // Follows the server's game:cooldown ticks (time - 1 down to 1).
  const [remaining, setRemaining] = useState(time)
  const [answered, setAnswered] = useState(0)

  const [sfxPop] = useSound(SFX.ANSWERS.SOUND, {
    volume: 0.1,
  })

  const [playMusic, { stop: stopMusic }] = useSound(SFX.ANSWERS.MUSIC, {
    volume: 0.2,
    interrupt: true,
    loop: true,
  })

  const handleSubmit = (answer: AnswerPayload) => {
    if (!player || !gameId) {
      return
    }

    socket.emit(EVENTS.PLAYER.SELECTED_ANSWER, {
      gameId,
      data: answer,
    })
    setLastAnswer({
      questionType,
      answer,
      display: QUESTION_REGISTRY[questionType].sentText?.(t, answer, options),
      targets,
    })
    sfxPop()
  }

  useEffect(() => {
    const disabledMusicMedia: QuestionMediaType[] = [
      MEDIA_TYPES.AUDIO,
      MEDIA_TYPES.VIDEO,
    ]

    // The music plays on the host screen only: players' phones stay quiet,
    // and a question with its own audio or video keeps the room silent.
    if (player || disabledMusicMedia.includes(media?.type)) {
      return
    }

    playMusic()

    return () => {
      stopMusic()
    }
    // oxlint-disable-next-line
  }, [playMusic])

  useEvent(EVENTS.GAME.COOLDOWN, (sec) => {
    setRemaining(sec)
  })

  useEvent(EVENTS.GAME.PLAYER_ANSWER, (count) => {
    setAnswered(count)

    // A pop per answer would cover the question's video or sound.
    if (!isTimedMedia(media?.type)) {
      sfxPop()
    }
  })

  return (
    <QuestionStage
      phase="answering"
      question={question}
      answers={answers}
      questionType={questionType}
      media={media}
      time={time}
      totalPlayers={totalPlayer}
      answered={answered}
      remaining={time === NO_TIME_LIMIT ? null : remaining}
      options={options}
      text={text}
      targets={targets}
      markers={markers}
      onSubmit={handleSubmit}
      isHost={!player}
    />
  )
}

export default Answers
