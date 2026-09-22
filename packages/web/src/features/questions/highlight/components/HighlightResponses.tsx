import { isCompactList } from "@razzia/web/features/game/components/question/AnswerRow"
import ResponseRow, {
  ResponseList,
} from "@razzia/web/features/game/components/question/ResponseRow"
import { answerLetter } from "@razzia/web/features/game/utils/constants"
import type { DistributionProps } from "@razzia/web/features/questions/types"
import { Highlighter } from "lucide-react"
import { useTranslation } from "react-i18next"

// Beyond this many characters in any passage, host rows use smaller text.
const DENSE_LENGTH = 60

// Highlight on the projector: the rows of a multiple choice, one per passage
// in the order of the text, each lettered as the phones showed it, the ones
// to spot outlined and labelled. Five passages take compact rows, as the five
// ranges of an estimate, which keep the label of each passage to spot; on a
// short screen, the labels of rows that follow one another straddle the gap
// between them, as on a multiple choice's rows.
const HighlightResponses = ({
  data: {
    answers,
    responses,
    solutions,
    totalAnswered,
    totalPlayers,
    correctCount = 0,
  },
  revealed,
}: DistributionProps) => {
  const { t } = useTranslation()
  const dense = answers.some((answer) => answer.length > DENSE_LENGTH)
  const compact = isCompactList(answers.length)

  return (
    <ResponseList
      hint={{
        icon: Highlighter,
        text: t("game:responses.highlightSummary", {
          count: correctCount,
          total: totalAnswered,
        }),
      }}
      unanswered={Math.max(0, totalPlayers - totalAnswered)}
      rows={answers.length}
    >
      {answers.map((passage, index) => (
        <ResponseRow
          key={index}
          index={index}
          text={passage}
          // Passages nobody tapped have no entry.
          count={index in responses ? responses[index] : 0}
          total={totalAnswered}
          label={(figures) =>
            t("game:responses.passageRowLabel", {
              letter: answerLetter(index),
              passage,
              ...figures,
            })
          }
          correct={solutions.includes(index)}
          revealed={revealed}
          dense={dense}
          compact={compact}
          labelled
          stacked
        />
      ))}
    </ResponseList>
  )
}

export default HighlightResponses
