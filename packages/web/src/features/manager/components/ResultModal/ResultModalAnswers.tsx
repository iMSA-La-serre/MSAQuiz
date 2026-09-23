import { MEDIA_TYPES, NO_TIME_LIMIT } from "@razzia/common/constants"
import type { QuestionMedia } from "@razzia/common/types/game"
import ChoiceSummary from "@razzia/web/features/manager/components/ResultModal/ChoiceSummary"
import { useResultModal } from "@razzia/web/features/manager/contexts/result-modal-context"
import { QUESTION_REGISTRY } from "@razzia/web/features/questions"
import { scoringModeLabelKey } from "@razzia/web/features/questions/options"
import { Clock, ImageOff, Music, Video } from "lucide-react"
import { useTranslation } from "react-i18next"

const MediaPreview = ({ media }: { media?: QuestionMedia }) => {
  if (media?.type === MEDIA_TYPES.IMAGE) {
    return (
      <img
        src={media.url}
        alt=""
        className="h-16 w-auto rounded-md object-contain md:h-full"
      />
    )
  }

  if (media?.type === MEDIA_TYPES.VIDEO) {
    return (
      <div className="bg-accent flex h-16 w-24 items-center justify-center rounded-lg md:h-38 md:w-full">
        <Video className="text-muted-foreground size-6 md:size-10" />
      </div>
    )
  }

  if (media?.type === MEDIA_TYPES.AUDIO) {
    return (
      <div className="bg-accent flex h-16 w-24 items-center justify-center rounded-lg md:h-38 md:w-full">
        <Music className="text-muted-foreground size-6 md:size-10" />
      </div>
    )
  }

  return (
    <div className="bg-accent flex h-16 w-24 items-center justify-center rounded-lg md:h-38 md:w-full">
      <ImageOff className="text-muted-foreground size-6 md:size-10" />
    </div>
  )
}

const ResultModalAnswers = () => {
  const { questionResult, totalPlayers, answeredCount } = useResultModal()
  const { t } = useTranslation()

  const noAnswerCount = totalPlayers - answeredCount
  const { ResultSummary, MediaComponent, optionsLabelKey, optionsLabel } =
    QUESTION_REGISTRY[questionResult.type]
  const { options } = questionResult
  // By default, the multi scoring mode, whatever the type it was saved with.
  const optionsKey = optionsLabelKey
    ? optionsLabelKey(options, questionResult)
    : scoringModeLabelKey(options)
  const optionsText = optionsLabel
    ? optionsLabel(t, options)
    : optionsKey && t(optionsKey)

  return (
    <div className="border-accent flex flex-col border-b-2 md:flex-row">
      <div className="border-accent bg-muted/30 flex shrink-0 flex-row items-center gap-4 border-b-2 p-4 md:w-66 md:flex-col md:justify-center md:border-r-2 md:border-b-0">
        {/* A type that draws the image itself (markers) shows its layer
        over it, the right markers ticked: the numbers of the answers block
        point at a spot. */}
        {MediaComponent && questionResult.media?.type === MEDIA_TYPES.IMAGE ? (
          <div className="w-40 shrink-0 md:w-full">
            <MediaComponent
              media={questionResult.media}
              alt=""
              variant="result"
              answers={questionResult.answers}
              markers={questionResult.markers}
              correct={questionResult.solutions}
              readOnly
            />
          </div>
        ) : (
          <MediaPreview media={questionResult.media} />
        )}
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <Clock className="size-3.5" />
          <span>
            {questionResult.time === NO_TIME_LIMIT
              ? "∞"
              : `${questionResult.time}${t("manager:result.timeLimitSuffix")}`}
          </span>
          {optionsText && (
            <div className="bg-accent text-accent-foreground rounded-md px-2 py-0.5 font-semibold">
              {optionsText}
            </div>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-hidden px-4 py-3 md:gap-2 md:px-5 md:py-4">
        <p className="text-md text-foreground mb-1 font-semibold">
          {questionResult.question}
        </p>

        {ResultSummary ? (
          <ResultSummary
            question={questionResult}
            noAnswerCount={noAnswerCount}
          />
        ) : (
          <ChoiceSummary
            question={questionResult}
            noAnswerCount={noAnswerCount}
          />
        )}
      </div>
    </div>
  )
}

export default ResultModalAnswers
