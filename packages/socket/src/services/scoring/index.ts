import { QUESTION_TYPE_META } from "@razzia/common/constants"
import type { Question, QuestionType } from "@razzia/common/types/game"
import * as categorize from "./categorize"
import * as estimate from "./estimate"
import * as highlight from "./highlight"
import * as markers from "./markers"
import * as multi from "./multi"
import * as ordering from "./ordering"
import * as poll from "./poll"
import * as ranking from "./ranking"
import * as scale from "./scale"
import * as shortanswer from "./shortanswer"
import * as single from "./single"
import * as slide from "./slide"
import * as statements from "./statements"
import * as truefalse from "./truefalse"
import * as wordcloud from "./wordcloud"

// What the scoring reads of an answer, see Answer in the common types.
export interface ScoredAnswer {
  answerIds: number[]
  text?: string
  texts?: string[]
  value?: number
}

// Multiplier of an answer, from 0 (no credit) to 1 (full credit).
export type ScoringFn = (_question: Question, _answer: ScoredAnswer) => number

export const QUESTION_SCORING: Record<QuestionType, ScoringFn> = {
  [single.type]: single.scoring,
  [multi.type]: multi.scoring,
  [truefalse.type]: truefalse.scoring,
  [poll.type]: poll.scoring,
  [slide.type]: slide.scoring,
  [ordering.type]: ordering.scoring,
  [shortanswer.type]: shortanswer.scoring,
  [wordcloud.type]: wordcloud.scoring,
  [estimate.type]: estimate.scoring,
  [highlight.type]: highlight.scoring,
  [statements.type]: statements.scoring,
  [categorize.type]: categorize.scoring,
  [ranking.type]: ranking.scoring,
  [scale.type]: scale.scoring,
  [markers.type]: markers.scoring,
}

// Stored results may hold a type this version does not know (a later one, or
// data edited by hand): readers skip it instead of failing.
export const isKnownType = (type: unknown): type is QuestionType =>
  typeof type === "string" && Object.hasOwn(QUESTION_TYPE_META, type)
