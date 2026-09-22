import AssociationAnswers from "@razzia/web/features/questions/association/components/AssociationAnswers"
import type { AnswerComponentProps } from "@razzia/web/features/questions/types"

// Vrai or Faux under each statement.
const StatementsAnswers = (props: AnswerComponentProps) => (
  <AssociationAnswers {...props} emptyKey="game:answer.statementsEmpty" />
)

export default StatementsAnswers
