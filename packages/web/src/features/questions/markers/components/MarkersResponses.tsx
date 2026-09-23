import {
  isCompactList,
  rowChipSize,
} from "@razzia/web/features/game/components/question/AnswerRow"
import ResponseRow, {
  ResponseList,
} from "@razzia/web/features/game/components/question/ResponseRow"
import MarkerChip from "@razzia/web/features/questions/markers/components/MarkerChip"
import { creditedAnswers } from "@razzia/web/features/questions/markers/utils/records"
import type { DistributionProps } from "@razzia/web/features/questions/types"
import { MapPin } from "lucide-react"
import { useTranslation } from "react-i18next"

// Markers on the projector: the rows of a choice, one per marker, numbered
// as on the image next to them, the right ones outlined. Past four markers,
// the compact rows of an ordering: the image stands in the other column, so
// six of them fit. The hint counts the answers that earned credit, full or
// partial, as the phones called them correct.
const MarkersResponses = ({
  data,
  data: { answers, responses, solutions, totalAnswered, totalPlayers },
  revealed,
}: DistributionProps) => {
  const { t } = useTranslation()
  const compact = isCompactList(answers.length)

  return (
    <ResponseList
      hint={{
        icon: MapPin,
        text: t("game:responses.markersSummary", {
          count: creditedAnswers(data),
          total: totalAnswered,
        }),
      }}
      unanswered={Math.max(0, totalPlayers - totalAnswered)}
      label={t("game:responses.markersLabel")}
      rows={answers.length}
    >
      {answers.map((label, index) => (
        <ResponseRow
          key={index}
          index={index}
          text={label}
          // Markers nobody tapped have no entry.
          count={index in responses ? responses[index] : 0}
          total={totalAnswered}
          label={(figures) =>
            t("game:responses.markerRowLabel", {
              number: index + 1,
              label,
              ...figures,
            })
          }
          correct={solutions.includes(index)}
          revealed={revealed}
          compact={compact}
          labelled
          stacked
          marker={
            <MarkerChip index={index} size={rowChipSize("host", compact)} />
          }
        />
      ))}
    </ResponseList>
  )
}

export default MarkersResponses
