import { Chip } from "@razzia/web/features/game/components/AnswerChip"
import ResponseRow, {
  ResponseList,
} from "@razzia/web/features/game/components/question/ResponseRow"
import KeyboardChip from "@razzia/web/features/questions/shortanswer/components/KeyboardChip"
import { namedAccepted } from "@razzia/web/features/questions/shortanswer/utils/records"
import type { DistributionProps } from "@razzia/web/features/questions/types"
import { Check, Keyboard } from "lucide-react"
import { useTranslation } from "react-i18next"

// Rows for accepted answers: with « Non reconnues », four rows, as a choice.
const ACCEPTED_ROWS = 3

// Every accepted answer is a right one.
const CORRECT_CHIP = (
  <Chip aria-hidden size="lg" className="bg-muted text-success-strong">
    <Check className="size-6 stroke-3 xl:size-7" />
  </Chip>
)

// Short answer on the projector: the choice distribution, one row per
// accepted answer typed, the most typed first, then one neutral row for the
// texts that matched none. What players typed never shows: it is only
// counted.
const ShortAnswerResponses = ({
  data: {
    accepted = [],
    responses,
    totalAnswered,
    totalPlayers,
    correctCount = 0,
  },
  revealed,
}: DistributionProps) => {
  const { t } = useTranslation()
  // Answers nobody's text matched have no entry.
  const counts = accepted.map((_, index) =>
    index in responses ? responses[index] : 0,
  )
  const { named, others } = namedAccepted(counts, ACCEPTED_ROWS)
  const othersCount = others.reduce((sum, index) => sum + counts[index], 0)
  const acceptedRows = named.length + (others.length > 0 ? 1 : 0)

  return (
    <ResponseList
      hint={{
        icon: Keyboard,
        text: t("game:responses.shortanswerSummary", {
          count: correctCount,
          total: totalAnswered,
        }),
      }}
      unanswered={Math.max(0, totalPlayers - totalAnswered)}
      rows={acceptedRows + 1}
    >
      {named.map((index, rank) => (
        <ResponseRow
          key={index}
          index={rank}
          text={accepted[index]}
          count={counts[index]}
          total={totalAnswered}
          label={(figures) =>
            t("game:responses.acceptedRowLabel", {
              answer: accepted[index],
              ...figures,
            })
          }
          correct
          revealed={revealed}
          marker={CORRECT_CHIP}
        />
      ))}
      {others.length > 0 && (
        <ResponseRow
          index={named.length}
          text={t("game:responses.otherAccepted")}
          count={othersCount}
          total={totalAnswered}
          label={(figures) =>
            t("game:responses.otherAcceptedRowLabel", figures)
          }
          correct
          revealed={revealed}
          marker={CORRECT_CHIP}
        />
      )}
      <ResponseRow
        index={acceptedRows}
        text={t("game:responses.unrecognized")}
        count={Math.max(0, totalAnswered - correctCount)}
        total={totalAnswered}
        label={(figures) => t("game:responses.unrecognizedRowLabel", figures)}
        revealed={revealed}
        marker={<KeyboardChip />}
      />
    </ResponseList>
  )
}

export default ShortAnswerResponses
