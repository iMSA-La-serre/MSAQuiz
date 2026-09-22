import OrderingAnswers from "@razzia/web/features/questions/ordering/components/OrderingAnswers"
import { ANSWER_WORDING } from "@razzia/web/features/questions/ordering/utils/wording"
import type { AnswerComponentProps } from "@razzia/web/features/questions/types"

// The rows of an ordering, tap after tap, for proposals to put in order of
// priority. Only the words change: the screen reader hears « proposition »
// and « priorité », as the screen prints them.
const RankingAnswers = (props: AnswerComponentProps) => (
  <OrderingAnswers {...props} words={ANSWER_WORDING.ranking} />
)

export default RankingAnswers
