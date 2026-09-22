import AssociationAnswers from "@razzia/web/features/questions/association/components/AssociationAnswers"
import type { AnswerComponentProps } from "@razzia/web/features/questions/types"

// The categories under each element to sort.
const CategorizeAnswers = (props: AnswerComponentProps) => (
  <AssociationAnswers {...props} emptyKey="game:answer.categorizeEmpty" />
)

export default CategorizeAnswers
