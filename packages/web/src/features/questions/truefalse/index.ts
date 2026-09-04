// A true/false question plays exactly like a single-choice one with two fixed
// answers: reuse the single answer grid and config rather than duplicating them.
export { default as AnswerComponent } from "@razzia/web/features/questions/single/components/SingleAnswers"

export { default as ConfigComponent } from "@razzia/web/features/questions/single/components/SingleConfig"

export { default as SolutionPicker } from "@razzia/web/features/questions/truefalse/components/TrueFalsePicker"

export const labelKey = "quizz:questionType.truefalse"

// Filled in by the editor when the author picks this type; the answers are
// read-only afterwards (see QUESTION_TYPE_META.answersCount).
export const defaultAnswerKeys = ["quizz:trueAnswer", "quizz:falseAnswer"]
