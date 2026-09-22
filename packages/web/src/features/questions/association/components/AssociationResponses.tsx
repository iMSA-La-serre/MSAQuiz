import { QUESTION_TYPES } from "@razzia/common/constants"
import { rightTargetOf } from "@razzia/common/utils/association"
import { isCompactList } from "@razzia/web/features/game/components/question/AnswerRow"
import ResponseRow, {
  ResponseList,
} from "@razzia/web/features/game/components/question/ResponseRow"
import { answerLetter } from "@razzia/web/features/game/utils/constants"
import type { DistributionProps } from "@razzia/web/features/questions/types"
import { Scale, Tags } from "lucide-react"
import { useTranslation } from "react-i18next"

// Beyond this many characters in any item, host rows use smaller text.
const DENSE_LENGTH = 60

// Statements and categorize on the projector: the answering rows, one per
// item, each labelled with its right target where a right answer is labelled
// « Bonne réponse », its bar counting the players who matched it. Five items
// take compact rows, which keep their label; on a short screen, the labels
// straddle the gap to the row above, as on a multiple choice's rows.
const AssociationResponses = ({
  data: {
    type,
    answers,
    responses,
    targets,
    expectedTargets,
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
        // The icon of the answering screen's hint.
        icon: type === QUESTION_TYPES.CATEGORIZE ? Tags : Scale,
        text: t("game:responses.associationSummary", {
          count: correctCount,
          total: totalAnswered,
        }),
      }}
      unanswered={Math.max(0, totalPlayers - totalAnswered)}
      rows={answers.length}
    >
      {answers.map((item, index) => {
        const target =
          rightTargetOf({ type, targets, expectedTargets }, index) ?? undefined

        return (
          <ResponseRow
            key={index}
            index={index}
            text={item}
            // Items nobody matched have no entry.
            count={index in responses ? responses[index] : 0}
            total={totalAnswered}
            label={(figures) =>
              t("game:responses.matchRowLabel", {
                letter: answerLetter(index),
                item,
                target: target ?? "?",
                ...figures,
              })
            }
            answerLabel={target}
            revealed={revealed}
            dense={dense}
            compact={compact}
            labelled
            stacked
          />
        )
      })}
    </ResponseList>
  )
}

export default AssociationResponses
