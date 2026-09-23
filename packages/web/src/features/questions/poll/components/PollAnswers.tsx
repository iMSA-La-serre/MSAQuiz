import { QUESTION_TYPES } from "@razzia/common/constants"
import { pollMultiple } from "@razzia/common/utils/choice"
import MultiAnswers from "@razzia/web/features/questions/multi/components/MultiAnswers"
import SingleAnswers from "@razzia/web/features/questions/single/components/SingleAnswers"
import type { AnswerComponentProps } from "@razzia/web/features/questions/types"

// A poll plays as a single choice, one tap being one vote, or, when its
// author allows several answers, as a multiple choice: ticks, then
// « Valider ».
const PollAnswers = (props: AnswerComponentProps) =>
  pollMultiple({ type: QUESTION_TYPES.POLL, options: props.options }) ? (
    <MultiAnswers {...props} />
  ) : (
    <SingleAnswers {...props} />
  )

export default PollAnswers
