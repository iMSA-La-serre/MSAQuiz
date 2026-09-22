import { WORDCLOUD_LIMITS } from "@razzia/common/constants"
import { wordCountOf } from "@razzia/common/utils/wordcloud"
import { Chip } from "@razzia/web/features/game/components/AnswerChip"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import {
  Cloud,
  Link2Off,
  type LucideIcon,
  ShieldBan,
  TextCursorInput,
} from "lucide-react"
import { useId } from "react"
import { useTranslation } from "react-i18next"

// The rows of the answers block, with an icon in the chip's box and what
// players will do in place of an answer.
const Row = ({ icon: Icon, text }: { icon: LucideIcon; text: string }) => (
  <li className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 py-2.5">
    <Chip aria-hidden size="sm" className="bg-muted text-secondary">
      <Icon className="size-4" />
    </Chip>
    <p className="text-sm">{text}</p>
  </li>
)

// No answers to write: the answers block says how the word cloud works.
const WordCloudEditor = () => {
  const { currentQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const titleId = useId()
  const wordCount = wordCountOf(currentQuestion.options)

  return (
    <section
      aria-labelledby={titleId}
      className="bg-background text-foreground z-10 rounded-2xl p-4 shadow-sm md:p-6"
    >
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-3">
          <h3 id={titleId} className="text-lg font-bold">
            {t("quizz:answers.title")}
          </h3>
          <span className="text-muted-foreground text-sm font-semibold tabular-nums">
            {t("quizz:wordcloud.perPlayer", { count: wordCount })}
          </span>
        </div>
        <p className="text-muted-foreground text-sm">
          {t("quizz:answers.hint.wordcloud")}
        </p>
      </header>

      <ul className="divide-muted flex flex-col divide-y">
        <Row
          icon={TextCursorInput}
          text={t("quizz:wordcloud.fields", {
            count: wordCount,
            max: WORDCLOUD_LIMITS.WORD_LENGTH,
          })}
        />
        <Row icon={Link2Off} text={t("quizz:wordcloud.unlinked")} />
        <Row icon={ShieldBan} text={t("quizz:wordcloud.moderation")} />
        <Row icon={Cloud} text={t("quizz:wordcloud.display")} />
      </ul>
    </section>
  )
}

export default WordCloudEditor
