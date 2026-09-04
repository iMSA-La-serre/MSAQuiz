import type { Question, QuestionType } from "@razzia/common/types/game"
import * as multi from "./multi"
import * as poll from "./poll"
import * as single from "./single"
import * as slide from "./slide"
import * as truefalse from "./truefalse"

export type ScoringFn = (_question: Question, _answerIds: number[]) => number

export const QUESTION_SCORING: Record<QuestionType, ScoringFn> = {
  [single.type]: single.scoring,
  [multi.type]: multi.scoring,
  [truefalse.type]: truefalse.scoring,
  [poll.type]: poll.scoring,
  [slide.type]: slide.scoring,
}
