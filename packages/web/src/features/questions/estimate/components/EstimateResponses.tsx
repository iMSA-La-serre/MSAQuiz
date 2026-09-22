import { Chip } from "@razzia/web/features/game/components/AnswerChip"
import {
  isCompactList,
  rowChipSize,
} from "@razzia/web/features/game/components/question/AnswerRow"
import ResponseRow, {
  ResponseList,
} from "@razzia/web/features/game/components/question/ResponseRow"
import {
  rangeText,
  summaryText,
} from "@razzia/web/features/questions/estimate/utils/format"
import { rangeIcon } from "@razzia/web/features/questions/estimate/utils/range-icon"
import type { DistributionProps } from "@razzia/web/features/questions/types"
import clsx from "clsx"
import { type LucideIcon, Target } from "lucide-react"
import { useTranslation } from "react-i18next"

// The chip box of a range, holding its mark (rangeIcon): the tick of the
// short answer for the right values, a neutral chevron for the others.
const RangeChip = ({
  icon: Icon,
  right,
  compact,
}: {
  icon: LucideIcon
  right: boolean
  compact: boolean
}) => (
  <Chip
    aria-hidden
    size={rowChipSize("host", compact)}
    className={clsx(
      "bg-muted",
      right ? "text-success-strong" : "text-secondary",
    )}
  >
    <Icon
      className={clsx(
        compact ? "size-5" : "size-6 xl:size-7",
        right && "stroke-3",
      )}
    />
  </Chip>
)

// Estimate on the projector: the choice distribution, one row per range of
// values, the smallest first, the right one outlined and labelled. The hint
// gives the right value and the median of the numbers sent.
const EstimateResponses = ({
  data: { expected, options, ranges = [], median, totalAnswered, totalPlayers },
  revealed,
}: DistributionProps) => {
  const { t } = useTranslation()
  // Same rows as a long ordering: compact past four.
  const compact = isCompactList(ranges.length)
  const rightIndex = ranges.findIndex(({ correct }) => correct)
  const hint = summaryText(
    t,
    { expected, median, options },
    {
      expected: "game:responses.estimateExpected",
      summary: "game:responses.estimateSummary",
    },
  )

  return (
    <ResponseList
      hint={hint === null ? undefined : { icon: Target, text: hint }}
      unanswered={Math.max(0, totalPlayers - totalAnswered)}
      rows={ranges.length}
    >
      {ranges.map((range, index) => {
        const text = rangeText(t, ranges, { index, options })

        return (
          <ResponseRow
            key={index}
            index={index}
            text={text}
            count={range.count}
            total={totalAnswered}
            label={(figures) =>
              t("game:responses.rangeRowLabel", { range: text, ...figures })
            }
            correct={range.correct}
            revealed={revealed}
            compact={compact}
            labelled
            marker={
              <RangeChip
                icon={rangeIcon(index - rightIndex)}
                right={range.correct}
                compact={compact}
              />
            }
          />
        )
      })}
    </ResponseList>
  )
}

export default EstimateResponses
