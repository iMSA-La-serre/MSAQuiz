// A true/false question plays exactly like a single-choice one with two fixed
// answers: reuse the single answer grid rather than duplicating it. Its
// settings are the shared ones, without the single choice's partial credit.
export { default as AnswerComponent } from "@razzia/web/features/questions/single/components/SingleAnswers"

export { default as ConfigComponent } from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/BaseConfig"

export { default as SolutionPicker } from "@razzia/web/features/questions/truefalse/components/TrueFalsePicker"

export const labelKey = "quizz:questionType.truefalse"

// Filled in by the editor when the author picks this type; the answers are
// read-only afterwards (see QUESTION_TYPE_META.answersCount).
export const defaultAnswerKeys = ["quizz:trueAnswer", "quizz:falseAnswer"]
