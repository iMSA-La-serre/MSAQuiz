import type {
  AnswerPayload,
  GameUpdateQuestion,
  QuestionType,
} from "@razzia/common/types/game"
import { create } from "zustand"

// An answer as this player sent it: answer keys, or the typed text, and how
// the text reads when its type words it (an estimate's number and unit).
export interface SentAnswer {
  questionType: QuestionType
  answer: AnswerPayload
  display?: string
}

interface QuestionStore {
  questionStates: GameUpdateQuestion | null
  // Answer this player sent for the current question, shown while the others
  // answer. Cleared when the next question is read.
  lastAnswer: SentAnswer | null
  setQuestionStates: (_state: GameUpdateQuestion | null) => void
  setLastAnswer: (_answer: SentAnswer | null) => void
}

export const useQuestionStore = create<QuestionStore>((set) => ({
  questionStates: null,
  lastAnswer: null,
  setQuestionStates: (state) => set({ questionStates: state }),
  setLastAnswer: (answer) => set({ lastAnswer: answer }),
}))
