import { SCORING_MODES } from "@razzia/common/constants"
import type { ScoringMode } from "@razzia/common/types/game"
import BaseConfig from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/BaseConfig"
import ScoringModeField from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ScoringModeField"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"

// The multiple choice's modes, which only apply once several markers are
// ticked: with a single right marker a player taps once, and every mode
// gives it all or nothing.
const MODES: ScoringMode[] = [
  SCORING_MODES.STRICT,
  SCORING_MODES.BALANCED,
  SCORING_MODES.LENIENT,
]

// The settings of a choice: points, speed bonus, penalty, and the scoring
// mode once the question has several right markers. The markers ticked
// decide, not a stored `options.multiple`, which the save fills in from them.
const MarkersConfig = () => {
  const { currentQuestion } = useQuizzEditor()
  const several = currentQuestion.solutions.length > 1

  return (
    <BaseConfig>{several && <ScoringModeField modes={MODES} />}</BaseConfig>
  )
}

export default MarkersConfig
