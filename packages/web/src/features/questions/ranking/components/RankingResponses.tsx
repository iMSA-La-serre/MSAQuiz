import { rankOrder } from "@razzia/common/utils/ranking"
import AnswerChip from "@razzia/web/features/game/components/AnswerChip"
import {
  isCompactList,
  rowChipSize,
} from "@razzia/web/features/game/components/question/AnswerRow"
import ResponseRow, {
  ResponseList,
} from "@razzia/web/features/game/components/question/ResponseRow"
import { answerLetter } from "@razzia/web/features/game/utils/constants"
import type { DistributionProps } from "@razzia/web/features/questions/types"
import { ListOrdered } from "lucide-react"
import { useTranslation } from "react-i18next"

// Beyond this many characters in any proposal, host rows use smaller text.
const DENSE_LENGTH = 60

// Ranking on the projector: the choice distribution, its rows in the order
// the room put the proposals (rank points). Each proposal keeps the letter
// the phones showed it with, and its bar counts the players who put it
// first.
const RankingResponses = ({
  data: { answers, responses, rankPoints, totalAnswered, totalPlayers },
  revealed,
}: DistributionProps) => {
  const { t } = useTranslation()
  const dense = answers.some((answer) => answer.length > DENSE_LENGTH)
  // Same rows as the answering screen: compact past four proposals.
  const compact = isCompactList(answers.length)
  // Proposals nobody ranked keep the author's order.
  const order = rankOrder(rankPoints ?? answers.map(() => 0))

  return (
    <ResponseList
      hint={{
        icon: ListOrdered,
        text: t("game:responses.rankingSummary"),
      }}
      unanswered={Math.max(0, totalPlayers - totalAnswered)}
      label={t("game:responses.rankingOrder")}
      rows={answers.length}
    >
      {order.map((item, position) => (
        <ResponseRow
          key={item}
          index={position}
          text={answers[item]}
          // Proposals nobody put first have no entry.
          count={item in responses ? responses[item] : 0}
          total={totalAnswered}
          label={(numbers) =>
            t("game:responses.rankingRowLabel", {
              position: position + 1,
              letter: answerLetter(item),
              item: answers[item],
              ...numbers,
            })
          }
          revealed={revealed}
          dense={dense}
          compact={compact}
          marker={
            <AnswerChip index={item} size={rowChipSize("host", compact)} />
          }
        />
      ))}
    </ResponseList>
  )
}

export default RankingResponses
