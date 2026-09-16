import type { GameUpdateQuestion } from "@razzia/common/types/game"
import { create } from "zustand"

interface QuestionStore {
  questionStates: GameUpdateQuestion | null
  // Answer keys this player sent for the current question, shown while the
  // others answer. Cleared when the next question is read.
  lastAnswer: number[] | null
  setQuestionStates: (_state: GameUpdateQuestion | null) => void
  setLastAnswer: (_answer: number[] | null) => void
}

export const useQuestionStore = create<QuestionStore>((set) => ({
  questionStates: null,
  lastAnswer: null,
  setQuestionStates: (state) => set({ questionStates: state }),
  setLastAnswer: (answer) => set({ lastAnswer: answer }),
}))
