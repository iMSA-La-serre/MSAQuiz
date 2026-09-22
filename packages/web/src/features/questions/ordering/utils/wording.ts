// The two types answered by numbering a list: an ordering, whose rows are
// numbered by the correct order, and a ranking, whose rows keep the letters
// the phones show and whose order is only the one the room reads. Each set
// names what its screens name — « élément » or « proposition » — so a screen
// reader hears the words the editor and the phone print.

export interface ListEditorWords {
  title: string
  hint: string
  columnItem: string
  columnAction: string
  placeholder: string
  add: string
  remove: string
  moveUp: string
  moveDown: string
  // Announced after a move. Takes `item` and the marks of the row it went to:
  // `number` and `letter`, never `position`.
  moved: string
}

export interface ListAnswerWords {
  // Help line under « Valider » until every row has its number.
  empty: string
  // Accessible name of a row once numbered: `letter`, `item`, `position`.
  itemLabel: string
  // Announced after a tap: `item` and `position`, or `item` alone.
  placed: string
  removed: string
  complete: string
}

export const EDITOR_WORDING: Record<"ordering" | "ranking", ListEditorWords> = {
  ordering: {
    title: "quizz:ordering.title",
    hint: "quizz:answers.hint.ordering",
    columnItem: "quizz:ordering.columnItem",
    columnAction: "quizz:ordering.columnPosition",
    placeholder: "quizz:ordering.placeholder",
    add: "quizz:ordering.add",
    remove: "quizz:ordering.remove",
    moveUp: "quizz:ordering.moveUp",
    moveDown: "quizz:ordering.moveDown",
    moved: "quizz:ordering.moved",
  },
  ranking: {
    title: "quizz:ranking.title",
    hint: "quizz:answers.hint.ranking",
    columnItem: "quizz:ranking.columnItem",
    columnAction: "quizz:ranking.columnOrder",
    placeholder: "quizz:ranking.placeholder",
    add: "quizz:ranking.add",
    remove: "quizz:ranking.remove",
    moveUp: "quizz:ranking.moveUp",
    moveDown: "quizz:ranking.moveDown",
    moved: "quizz:ranking.moved",
  },
}

export const ANSWER_WORDING: Record<"ordering" | "ranking", ListAnswerWords> = {
  ordering: {
    empty: "game:answer.orderingEmpty",
    itemLabel: "game:ordering.itemLabel",
    placed: "game:ordering.placed",
    removed: "game:ordering.removed",
    complete: "game:ordering.complete",
  },
  ranking: {
    empty: "game:answer.rankingEmpty",
    itemLabel: "game:ranking.itemLabel",
    placed: "game:ranking.placed",
    removed: "game:ranking.removed",
    complete: "game:ranking.complete",
  },
}
