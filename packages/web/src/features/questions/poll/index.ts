// A poll plays exactly like a single-choice question (one tap = one vote):
// reuse the single answer grid rather than duplicating it.
export { default as AnswerComponent } from "@razzia/web/features/questions/single/components/SingleAnswers"

export { default as ConfigComponent } from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/BaseConfig"

export { default as SolutionPicker } from "@razzia/web/features/questions/poll/components/PollPicker"

export const labelKey = "quizz:questionType.poll"
