# Quizzes

> **MSAQuiz fork**: quizzes live in the SQLite database (`config/msaquiz.db`), **not** in `config/quizz/*.json`. Files dropped in that folder are no longer read at runtime — import them once through the manager instead. The JSON shape below is still the exchange format: it is what the editor exports, and what the importer accepts.

## Creating a quiz

Everything happens in the manager dashboard, **Quizz** tab:

- **Quiz editor** (recommended): build the questions in the browser, saved straight to the database.
- **JSON import**: the upload button accepts a `.json` file in the format described below. This is what the export button produces (minus the `id`, which the database assigns on import).
- **Kahoot import**: the same button accepts a `.xlsx` file exported from Kahoot, see [Importing from Kahoot](#importing-from-kahoot).

You can keep as many quizzes as you like; you pick one when starting a game.

## Question types

| Type        | What players see                             | Scored | Solutions            |
| ----------- | -------------------------------------------- | ------ | -------------------- |
| `single`    | 2-4 answers, one tap submits                 | yes    | one or more accepted |
| `multi`     | 2-4 answers, select several then **Valider** | yes    | one or more          |
| `truefalse` | two fixed answers, one tap submits           | yes    | exactly one          |
| `poll`      | 2-4 answers, one tap, no right answer        | no     | none                 |
| `slide`     | an information screen, no answers to pick    | no     | none                 |

A slide has no answers, so players stay on it until the manager moves on: give it `time: -1` and use the Skip button, or set a timer.

A true/false question carries its two answers for you: the editor fills them in, keeps them read-only, and lets you pick which one is correct. Only the statement is yours to write.

Unscored types (`poll`, `slide`) ignore `solutions`, `maxPoints` and `penalty` — the validator strips those fields on save, and the editor hides them. A poll vote never awards points, never costs points, and never breaks a correct-answer streak; slides are skipped in the players' answer history and in the exported report.

## Example

```json
{
  "subject": "Example Quiz",
  "questions": [
    {
      "type": "single",
      "question": "What is the correct answer?",
      "answers": ["No", "Yes", "No", "No"],
      "solutions": [1],
      "cooldown": 5,
      "time": 15
    },
    {
      "type": "multi",
      "question": "Which of these are primary colors?",
      "answers": ["Red", "Green", "Blue", "Yellow"],
      "solutions": [0, 2, 3],
      "options": { "scoringMode": "balanced" },
      "cooldown": 5,
      "time": 20,
      "maxPoints": 1500,
      "penalty": 200
    },
    {
      "type": "truefalse",
      "question": "Paris est la capitale de la France.",
      "answers": ["Vrai", "Faux"],
      "solutions": [0],
      "cooldown": 3,
      "time": 15
    },
    {
      "type": "poll",
      "question": "Which session time suits you best?",
      "answers": ["Morning", "Noon", "Afternoon", "Evening"],
      "cooldown": 3,
      "time": 20
    },
    {
      "type": "slide",
      "question": "Next section: safety rules",
      "media": { "type": "image", "url": "https://placehold.co/600x400.png" },
      "cooldown": 3,
      "time": 15
    }
  ]
}
```

## Field reference

| Field                   | Type                        | Notes                                                                                                             |
| ----------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `subject`               | string                      | Quiz title, cannot be empty.                                                                                      |
| `questions`             | array                       | At least one question.                                                                                            |
| `questions[].type`      | one of the five types above | See the table above. Optional in legacy files, see [Legacy quizzes](#legacy-quizzes).                             |
| `questions[].question`  | string                      | The question text (or the slide text). Cannot be empty.                                                           |
| `questions[].answers`   | string[]                    | 2 to 4 non-empty answers. Always empty for `slide`, exactly two for `truefalse`.                                  |
| `questions[].media`     | object                      | Optional: `type` is `"image"`, `"video"` or `"audio"`, `url` must be a valid URL.                                 |
| `questions[].solutions` | number[]                    | 0-based indices into `answers`. Required for scored types; a bare number is accepted too.                         |
| `questions[].cooldown`  | integer 3-15                | Seconds the question is displayed before answers open.                                                            |
| `questions[].time`      | integer                     | Seconds to answer (5 minimum in the editor), or `-1` for no time limit. Spreadsheet imports are clamped to 5-120. |
| `questions[].maxPoints` | integer >= 0                | Points for a perfect answer. Default `1000`.                                                                      |
| `questions[].penalty`   | integer >= 0                | Deducted on a wrong answer. Default none, see below.                                                              |
| `questions[].options`   | object                      | `multi` only: `{ "scoringMode": "strict" \| "balanced" \| "lenient" }`, default `balanced`.                       |

> **Note:** ids are assigned by the database. Importing the same file twice creates two quizzes.

## How points are computed

1. **Base points**, from how fast the player answered:
   - with a time limit: `maxPoints - (maxPoints / time) x secondsElapsed`, never below 0;
   - without one (`time: -1`): by answer order, from `maxPoints` for the first player down to `maxPoints / 2` for the last.
2. **Multiplier**, from the question type (see the modes below): `single` gives 1 for the right answer and 0 otherwise, `poll` and `slide` always give 0.
3. **Final score** = `round(base x multiplier)`, then `penalty` is subtracted if the question is scored, the player answered, and the answer earned nothing. A player's total never goes below 0, and an unanswered question is never penalised.

## Multi-answer scoring modes

For `multi` questions only. With `s` = number of solutions, `x` = correct answers selected, `y` = wrong answers selected:

| Mode                 | Multiplier            | Behaviour                                                     |
| -------------------- | --------------------- | ------------------------------------------------------------- |
| `strict`             | 1 if exact, else 0    | All solutions selected and nothing else, or no points at all. |
| `balanced` (default) | `max((x - y) / s, 0)` | Partial credit, wrong picks cancel out correct ones.          |
| `lenient`            | `x / s`               | Partial credit, wrong picks are free.                         |

## Importing from Kahoot

The importer reads the **first worksheet** of a `.xlsx` file (2 MB max) and uses the file name as the quiz title. Two layouts are supported:

- **any sheet with a header row**: it is looked for in the first 30 rows and must contain a `Question` column, at least two `Answer` columns (`Réponse`, `Respuesta`, `Antwort` and `Risposta` are recognised too) and a `Correct` column; a `Time` column (`Temps`, `Tiempo`, `Zeit`) is optional. Data starts on the next row.
- **the official Kahoot template**: columns B to H, data from row 9. Used as a fallback when no header row is found.

Conversion rules:

- the `Correct` cell holds 1-based answer numbers separated by `,` or `;` (e.g. `1,3`). Blank answer cells are handled without shifting the correct answers.
- more than one correct answer becomes a `multi` question in `strict` mode, otherwise `single`.
- `Time` is clamped to 5-120 seconds (20 by default), and `cooldown` is set to 5 seconds.
- rows without a question, with fewer than 2 answers, or without a usable `Correct` value are skipped. If nothing usable is left, the import fails and nothing is saved.

Media, polls and slides are not part of the Kahoot format: add them afterwards in the editor.

## Legacy quizzes

Questions saved before the type system existed have no `type` field. On import, one is inferred: several `solutions` means `multi`, otherwise `single`. Old Razzia files therefore import as-is.
