import { parseHighlight } from "@razzia/common/utils/highlight"
import { answerLetter } from "@razzia/web/features/game/utils/constants"
import ChoiceSummary from "@razzia/web/features/manager/components/ResultModal/ChoiceSummary"
import type { ResultSummaryProps } from "@razzia/web/features/questions/types"
import { Fragment } from "react"

// The text, each passage in bold after its letter, then the passages as the
// answers of a multiple choice: the ones to spot ticked, and the players who
// tapped each.
const HighlightResultSummary = ({
  question,
  noAnswerCount,
}: ResultSummaryProps) => {
  const { parts } = parseHighlight(question.text ?? "")

  return (
    <>
      <p className="text-muted-foreground mb-1 text-sm leading-relaxed">
        {parts.map((part, key) =>
          part.passage === undefined ? (
            <Fragment key={key}>{part.text}</Fragment>
          ) : (
            <span key={key} className="text-foreground font-semibold">
              <span className="text-muted-foreground text-xs font-bold">
                {answerLetter(part.passage)}{" "}
              </span>
              {part.text}
            </span>
          ),
        )}
      </p>
      <ChoiceSummary question={question} noAnswerCount={noAnswerCount} />
    </>
  )
}

export default HighlightResultSummary
