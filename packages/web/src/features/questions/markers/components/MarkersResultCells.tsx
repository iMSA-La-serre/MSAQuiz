import ResultVerdict from "@razzia/web/features/manager/components/ResultModal/ResultVerdict"
import MarkerChip from "@razzia/web/features/questions/markers/components/MarkerChip"
import {
  markersVerdict,
  pickedMarkers,
} from "@razzia/web/features/questions/markers/utils/records"
import type { ResultCellsProps } from "@razzia/web/features/questions/types"
import { Check } from "lucide-react"
import { useTranslation } from "react-i18next"

// The markers a player tapped, numbered as on the image and each ticked when
// it was a right one, then the verdict the player saw, see markersVerdict.
const MarkersResultCells = ({ question, record }: ResultCellsProps) => {
  const { t } = useTranslation()
  const picked = pickedMarkers(record)
  const verdict = markersVerdict(question, record)

  return (
    <>
      <td className="px-4 py-2.5">
        {picked.length === 0 ? (
          <span className="text-muted-foreground text-xs">-</span>
        ) : (
          <ul className="flex flex-wrap gap-1">
            {picked.map((id) => (
              <li
                key={id}
                className="bg-muted text-foreground inline-flex items-center gap-1.5 rounded-md py-0.5 pr-2 pl-0.5 text-xs"
              >
                <MarkerChip index={id} size="sm" />
                <span className="max-w-30 truncate">
                  {question.answers.at(id) ?? "?"}
                </span>
                {question.solutions.includes(id) && (
                  <Check
                    aria-label={t("manager:result.correctMarker")}
                    className="text-success-strong size-3.5 shrink-0 stroke-3"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="px-4 py-2.5">
        <ResultVerdict
          verdict={verdict}
          label={t(`manager:result.verdict.${verdict}`)}
        />
      </td>
    </>
  )
}

export default MarkersResultCells
