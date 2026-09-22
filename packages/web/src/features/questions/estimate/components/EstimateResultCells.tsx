import {
  decimalsOf,
  formatEstimate,
  fromScaled,
  toScaled,
} from "@razzia/common/utils/estimate"
import ResultVerdict from "@razzia/web/features/manager/components/ResultModal/ResultVerdict"
import {
  isRightValue,
  valueOf,
} from "@razzia/web/features/questions/estimate/utils/records"
import type { ResultCellsProps } from "@razzia/web/features/questions/types"
import { useTranslation } from "react-i18next"

// The number sent, how far it was from the right value, and the verdict.
const EstimateResultCells = ({ question, record }: ResultCellsProps) => {
  const { t } = useTranslation()
  const { expected, options } = question
  const value = valueOf(record)
  const decimals = decimalsOf(options)
  // Counted in steps of the question's decimals: 0.3 - 0.1 is 0.2 there.
  const sent = value === null ? null : toScaled(value, decimals)
  const right = expected === undefined ? null : toScaled(expected, decimals)
  const gap = sent === null || right === null ? 0 : sent - right

  const renderVerdict = () => {
    if (value === null) {
      return (
        <ResultVerdict
          verdict="noAnswer"
          label={t("manager:result.verdict.noAnswer")}
        />
      )
    }

    return isRightValue(question, record) ? (
      <ResultVerdict
        verdict="correct"
        label={t("manager:result.verdict.correct")}
      />
    ) : (
      <ResultVerdict
        verdict="wrong"
        label={t("manager:result.verdict.wrong")}
      />
    )
  }

  return (
    <>
      <td className="px-4 py-2.5">
        {value === null ? (
          <span className="text-muted-foreground text-xs">-</span>
        ) : (
          <span className="flex flex-col text-xs">
            <span className="text-foreground font-semibold tabular-nums">
              {formatEstimate(value, options)}
            </span>
            {gap !== 0 && (
              <span className="text-muted-foreground tabular-nums">
                {t("manager:result.gap", {
                  gap: `${gap > 0 ? "+" : ""}${formatEstimate(fromScaled(gap, decimals), options)}`,
                })}
              </span>
            )}
          </span>
        )}
      </td>
      <td className="px-4 py-2.5">{renderVerdict()}</td>
    </>
  )
}

export default EstimateResultCells
