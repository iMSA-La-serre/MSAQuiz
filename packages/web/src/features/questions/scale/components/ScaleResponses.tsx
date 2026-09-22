import {
  scaleRangeOf,
  scaleSkipIndex,
  scaleValues,
} from "@razzia/common/utils/scale"
import { Chip } from "@razzia/web/features/game/components/AnswerChip"
import {
  isCompactList,
  isTinyList,
  rowChipSize,
} from "@razzia/web/features/game/components/question/AnswerRow"
import ResponseRow, {
  ResponseList,
} from "@razzia/web/features/game/components/question/ResponseRow"
import {
  endLabelOf,
  summaryText,
} from "@razzia/web/features/questions/scale/utils/format"
import type { DistributionProps } from "@razzia/web/features/questions/types"
import { Gauge } from "lucide-react"
import { useTranslation } from "react-i18next"

// Scale on the projector: the choice distribution, one row per level, the
// lowest first, with what each end stands for next to its number. Shares are
// read out of every player who answered, as on a poll. The hint gives the
// mean and the median of the levels picked; the players who preferred not to
// answer are noted under the rows.
const ScaleResponses = ({
  data: { options, responses, totalAnswered, totalPlayers },
  revealed,
}: DistributionProps) => {
  const { t, i18n } = useTranslation()
  const range = scaleRangeOf(options)
  const values = scaleValues(range)
  const counts = values.map((_, index) =>
    index in responses ? responses[index] : 0,
  )
  const skipped = responses[scaleSkipIndex(range)] ?? 0
  const compact = isCompactList(values.length)
  const tiny = isTinyList(values.length)
  const summary = summaryText(t, i18n.language, {
    counts,
    min: range.min,
  })

  return (
    <ResponseList
      hint={{
        icon: Gauge,
        text: summary ?? t("game:responses.scaleEmpty"),
      }}
      aside={
        skipped > 0
          ? t("game:responses.scaleSkipped", { count: skipped })
          : null
      }
      unanswered={Math.max(0, totalPlayers - totalAnswered)}
      label={t("game:responses.scaleLabel")}
      rows={values.length}
      tiny={tiny}
    >
      {values.map((value, index) => {
        const end = endLabelOf(options, range, value)
        const figures = { value, max: range.max, label: end }

        return (
          <ResponseRow
            key={value}
            index={index}
            text={end}
            count={counts[index]}
            // Out of every player who answered, those who preferred not to
            // pick a level included, as every other type reads its shares.
            total={totalAnswered}
            label={(numbers) =>
              end === ""
                ? t("game:responses.scaleRowLabel", { ...figures, ...numbers })
                : t("game:responses.scaleRowLabelEnd", {
                    ...figures,
                    ...numbers,
                  })
            }
            revealed={revealed}
            compact={compact}
            tiny={tiny}
            marker={
              <Chip
                aria-hidden
                size={rowChipSize("host", compact, tiny)}
                className="bg-muted text-secondary tabular-nums"
              >
                {value}
              </Chip>
            }
          />
        )
      })}
    </ResponseList>
  )
}

export default ScaleResponses
