import AnswerChip, {
  Chip,
} from "@razzia/web/features/game/components/AnswerChip"
import {
  isCompactList,
  rowChipSize,
} from "@razzia/web/features/game/components/question/AnswerRow"
import ResponseRow, {
  ResponseList,
} from "@razzia/web/features/game/components/question/ResponseRow"
import { answerLetter } from "@razzia/web/features/game/utils/constants"
import { shownPosition } from "@razzia/web/features/questions/ordering/utils/sequence"
import type { DistributionProps } from "@razzia/web/features/questions/types"
import { ListOrdered } from "lucide-react"
import { useTranslation } from "react-i18next"

// Beyond this many characters in any item, host rows use smaller text.
const DENSE_LENGTH = 60

// Ordering on the projector: the choice distribution, its rows in the correct
// order. Each item keeps the letter the phones showed it with, and its bar
// counts the players who put it at its place.
const OrderingResponses = ({
  data: {
    answers,
    responses,
    publicOrder,
    totalAnswered,
    totalPlayers,
    correctCount = 0,
  },
  revealed,
}: DistributionProps) => {
  const { t } = useTranslation()
  const dense = answers.some((answer) => answer.length > DENSE_LENGTH)
  // Same rows as the answering screen: compact past four items.
  const compact = isCompactList(answers.length)
  const chipSize = rowChipSize("host", compact)

  return (
    <ResponseList
      hint={{
        icon: ListOrdered,
        text: t("game:responses.orderingSummary", {
          count: correctCount,
          total: totalAnswered,
        }),
      }}
      unanswered={Math.max(0, totalPlayers - totalAnswered)}
      label={t("game:responses.correctOrder")}
      rows={answers.length}
    >
      {answers.map((item, index) => {
        const shown = shownPosition(publicOrder, index)
        const figures = { position: index + 1, item }

        return (
          <ResponseRow
            key={index}
            index={index}
            text={item}
            // Items nobody placed have no entry.
            count={index in responses ? responses[index] : 0}
            total={totalAnswered}
            label={(numbers) =>
              shown === null
                ? t("game:responses.placedRowLabelNoLetter", {
                    ...figures,
                    ...numbers,
                  })
                : t("game:responses.placedRowLabel", {
                    ...figures,
                    letter: answerLetter(shown),
                    ...numbers,
                  })
            }
            revealed={revealed}
            dense={dense}
            compact={compact}
            marker={
              // Without the list the phones showed, no letter rather than a
              // wrong one.
              shown === null ? (
                <Chip aria-hidden size={chipSize} className="bg-muted" />
              ) : (
                <AnswerChip index={shown} size={chipSize} />
              )
            }
          />
        )
      })}
    </ResponseList>
  )
}

export default OrderingResponses
