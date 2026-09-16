import type { QuestionOptions } from "@razzia/common/types/game"

export interface AnswerComponentProps {
  answers: string[]
  options?: QuestionOptions
  onSubmit: (_answerKeys: number[]) => void
  // Host display: the rows are shown, never answered.
  readOnly?: boolean
  // Reading time: the rows are visible but do not accept answers yet.
  locked?: boolean
  size: "host" | "phone"
  // Taller rows with larger text (true/false on phone).
  large?: boolean
}

export interface SolutionPickerProps {
  index: number
  isSelected: boolean
}
