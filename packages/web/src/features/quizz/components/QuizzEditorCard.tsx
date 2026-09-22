import { MEDIA_TYPES, QUESTION_TYPES } from "@razzia/common/constants"
import type { QuestionMedia } from "@razzia/common/types/game"
import { isAssociationType } from "@razzia/common/utils/association"
import { scaleRangeOf } from "@razzia/common/utils/scale"
import { wordCountOf } from "@razzia/common/utils/wordcloud"
import AlertDialog from "@razzia/web/components/AlertDialog"
import { type QuestionWithId } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { Music, Trash2, Video } from "lucide-react"
import { useTranslation } from "react-i18next"
import { twMerge } from "tailwind-merge"

const SlideMedia = ({ media }: { media?: QuestionMedia }) => {
  if (media?.type === MEDIA_TYPES.IMAGE) {
    return (
      <img src={media.url} className="mx-auto max-h-14 w-auto rounded-md" />
    )
  }

  if (media?.type === MEDIA_TYPES.VIDEO) {
    return <Video className="text-muted-foreground mx-auto size-10" />
  }

  if (media?.type === MEDIA_TYPES.AUDIO) {
    return <Music className="text-muted-foreground mx-auto size-10" />
  }

  return null
}

interface Props {
  question: QuestionWithId
  index: number
  isActive: boolean
  canDelete: boolean
  onClick: () => void
  onDelete: () => void
}

const QuizzEditorCard = ({
  question,
  index,
  isActive,
  canDelete,
  onClick,
  onDelete,
}: Props) => {
  const { t } = useTranslation()
  // One bar per answer row, green for a right answer. A short answer and an
  // estimate have one field and no public answers: one bar, green, as what
  // they accept is right. A word cloud has one grey bar per field, a scale one
  // per level: nobody is right. Statements and categorize have one bar per
  // item, green once its right target is picked.
  const isShortAnswer =
    question.type === QUESTION_TYPES.SHORTANSWER ||
    question.type === QUESTION_TYPES.ESTIMATE
  const isWordCloud = question.type === QUESTION_TYPES.WORDCLOUD
  const isScale = question.type === QUESTION_TYPES.SCALE
  let bars = question.answers

  if (isShortAnswer) {
    bars = [""]
  } else if (isWordCloud) {
    bars = Array.from({ length: wordCountOf(question.options) }, () => "")
  } else if (isScale) {
    bars = Array.from(
      { length: scaleRangeOf(question.options).count },
      () => "",
    )
  }

  // Past four bars (an ordering), thinner ones in the height of four, so the
  // title keeps its line above an image.
  const thin = bars.length > 4
  const isRight = (bar: number) => {
    if (isShortAnswer) {
      return true
    }

    return isAssociationType(question.type)
      ? (question.expectedTargets?.at(bar) ?? -1) >= 0
      : question.solutions.includes(bar)
  }

  return (
    <div
      onClick={onClick}
      className={twMerge(
        clsx(
          "group border-accent bg-background relative flex h-36 cursor-pointer flex-col justify-between gap-1 rounded-lg border-2 px-6 py-2",
          {
            "border-primary": isActive,
          },
        ),
      )}
    >
      <span className="text-muted-foreground absolute top-2 left-2 text-xs font-semibold">
        {index + 1}
      </span>
      <p className="text-foreground truncate text-center text-xs font-semibold">
        {question.question || t("quizz:noQuestionYet")}
      </p>

      <SlideMedia media={question.media} />

      <div className={clsx("flex flex-col", thin ? "gap-0.5" : "gap-1")}>
        {bars.map((_, i) => (
          <div
            key={i}
            className={clsx(
              "w-full rounded-full",
              thin ? "h-1" : "h-1.5",
              isRight(i) ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </div>

      {canDelete && (
        <AlertDialog
          trigger={
            <button
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground bg-background hover:bg-danger-subtle hover:text-danger absolute top-1.5 right-1.5 hidden rounded-sm p-1 group-hover:block"
            >
              <Trash2 className="size-3.5" />
            </button>
          }
          title={t("quizz:question.deleteQuestion")}
          description={t("quizz:question.deleteQuestionConfirm")}
          confirmLabel={t("common:delete")}
          onConfirm={onDelete}
        />
      )}
    </div>
  )
}

export default QuizzEditorCard
