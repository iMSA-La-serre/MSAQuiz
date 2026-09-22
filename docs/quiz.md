# Quizzes

> **MSAQuiz fork**: quizzes live in the SQLite database (`config/msaquiz.db`), **not** in `config/quizz/*.json`. Files dropped in that folder are no longer read at runtime — import them once through the manager instead. The JSON shape below is still the exchange format: it is what the editor exports, and what the importer accepts.

## Creating a quiz

Everything happens in the manager dashboard, **Quizz** tab:

- **Quiz editor** (recommended): build the questions in the browser, saved straight to the database.
- **JSON import**: the upload button accepts a `.json` file in the format described below. This is what the export button produces (minus the `id`, which the database assigns on import).
- **Spreadsheet import**: the same button accepts a `.xlsx` file, see [Importing a spreadsheet](#importing-a-spreadsheet).

You can keep as many quizzes as you like; you pick one when starting a game.

## Question types

| Type          | What players see                                           | Scored | Solutions                                     |
| ------------- | ---------------------------------------------------------- | ------ | --------------------------------------------- |
| `single`      | 2-4 answers, one tap submits                               | yes    | one or more accepted                          |
| `multi`       | 2-4 answers, select several then **Valider**               | yes    | one or more                                   |
| `truefalse`   | two fixed answers, one tap submits                         | yes    | exactly one                                   |
| `poll`        | 2-4 answers, one tap, no right answer                      | no     | none                                          |
| `slide`       | an information screen, no answers to pick                  | no     | none                                          |
| `ordering`    | 3-6 items, shuffled, to put back in order then **Valider** | yes    | none: `answers` holds the items in order      |
| `shortanswer` | no answers: the player types a word or a short phrase      | yes    | none: `accepted` lists the answers that score |

A slide has no answers, so players stay on it until the manager moves on: give it `time: -1` and use the Skip button, or set a timer.

A true/false question carries its two answers for you: the editor fills them in, keeps them read-only, and lets you pick which one is correct. Only the statement is yours to write.

Unscored types (`poll`, `slide`) ignore `solutions`, `maxPoints` and `penalty` — the validator strips those fields on save, and the editor hides them. A poll vote never awards points, never costs points, and never interrupts a run of correct answers; slides are skipped in the players' answer history and in the exported report.

### Ordering

Labelled « Mise en ordre » in the editor and on the screens. `answers` lists the items **in the correct order**, 3 to 6 of them, 80 characters at most each. Two items that only differ by case, accents or punctuation are refused: players could not tell them apart. `solutions` is not used and is emptied on save.

When the question starts, the server shuffles the items once, with at most one item left at its correct place, and every screen (the players' phones and the projected screen, including after a reconnection) shows that same shuffled list. The correct order only reaches the manager's screen once the question closes. See [Ordering scoring](#ordering-scoring).

### Short answer

Labelled « Réponse courte » in the editor and on the screens. The player types a word or a short phrase, 60 characters at most. `answers` and `solutions` are not used and are emptied on save; `accepted` lists the answers that score, 1 to 10 of them, 60 characters at most each. `accepted` is never sent to a player: the manager's screen shows it once the question closes. See [Short answer matching](#short-answer-matching).

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
    },
    {
      "type": "ordering",
      "question": "Put the steps of a request in order",
      "answers": ["Reception", "Review", "Decision", "Notification"],
      "options": { "orderScoring": "position" },
      "cooldown": 5,
      "time": 30
    },
    {
      "type": "shortanswer",
      "question": "What was the name of Paris under the Roman Empire?",
      "accepted": ["Lutèce", "Lutetia"],
      "options": { "typoTolerance": true },
      "cooldown": 5,
      "time": 40,
      "speedBonus": false
    }
  ]
}
```

## Field reference

| Field                    | Type                         | Notes                                                                                                                                                                                                                               |
| ------------------------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `subject`                | string                       | Quiz title, cannot be empty.                                                                                                                                                                                                        |
| `questions`              | array                        | At least one question.                                                                                                                                                                                                              |
| `questions[].type`       | one of the seven types above | See the table above. Optional in legacy files, see [Legacy quizzes](#legacy-quizzes).                                                                                                                                               |
| `questions[].question`   | string                       | The question text (or the slide text). Cannot be empty.                                                                                                                                                                             |
| `questions[].answers`    | string[]                     | 2 to 4 non-empty answers. Always empty for `slide` and `shortanswer`, exactly two for `truefalse`, 3 to 6 items in the correct order for `ordering`.                                                                                |
| `questions[].media`      | object                       | Optional: `type` is `"image"`, `"video"` or `"audio"`, `url` must be a valid URL.                                                                                                                                                   |
| `questions[].solutions`  | number[]                     | 0-based indices into `answers`. Required for `single`, `multi` and `truefalse`; a bare number is accepted too. Emptied for the other types.                                                                                         |
| `questions[].accepted`   | string[]                     | `shortanswer` only: 1 to 10 answers that score, 60 characters at most, distinct once normalized. Dropped from the other types. Never sent to players.                                                                               |
| `questions[].cooldown`   | integer 3-15                 | Seconds the question is displayed before answers open.                                                                                                                                                                              |
| `questions[].time`       | integer                      | Seconds to answer, or `-1` for no time limit. 5 minimum in the editor, enforced on save for `ordering` and `shortanswer`. Spreadsheet imports are clamped to 5-120.                                                                 |
| `questions[].maxPoints`  | integer >= 0                 | Points for a perfect answer. Default `1000`.                                                                                                                                                                                        |
| `questions[].penalty`    | integer >= 0                 | Deducted on a wrong answer. Default none, see below.                                                                                                                                                                                |
| `questions[].speedBonus` | boolean                      | Whether a faster answer earns more, see below. Default `true` for the first five types, `false` for `ordering` and `shortanswer`.                                                                                                   |
| `questions[].options`    | object                       | `multi`: `{ "scoringMode": "strict" \| "balanced" \| "lenient" }`, default `balanced`. `ordering`: `{ "orderScoring": "position" \| "exact" }`, default `position`. `shortanswer`: `{ "typoTolerance": boolean }`, default `false`. |

> **Note:** ids are assigned by the database. Importing the same file twice creates two quizzes.

> **Note:** whenever `options` is given, the validator fills in `scoringMode` (`balanced`) whatever the type, as it always did. Only `multi` reads it.

## How points are computed

1. **Base points**:
   - with the speed bonus (`speedBonus`, on by default for the first five types) and a time limit: `maxPoints - (maxPoints / time) x secondsElapsed`, never below 0;
   - with the speed bonus and without time limit (`time: -1`): by answer order, from `maxPoints` for the first player down to `maxPoints / 2` for the last;
   - without the speed bonus (the default for `ordering` and `shortanswer`): `maxPoints`, whatever the time or the answer order.
2. **Multiplier**, from 0 to 1, from the question type: `single` and `truefalse` give 1 for the right answer and 0 otherwise, `multi` follows its mode (see below), `ordering` its scoring (see below), `shortanswer` gives 1 for a recognized answer and 0 otherwise, `poll` and `slide` always give 0.
3. **Final score** = `round(base x multiplier)`, then `penalty` is subtracted if the question is scored, the player answered, and the outcome is "wrong" (see below). A player's total never goes below 0, and an unanswered question is never penalised.

**Outcome.** A player sees "correct", "wrong" or "no answer" on a scored question. `single`, `multi` and `truefalse` keep their rule: any point earned is "correct", including a partial `multi` answer, and no point is "wrong". `ordering` and `shortanswer` follow the multiplier alone, whatever the points: 1 is "correct" and 0 is "wrong", so a recognized short answer worth 0 points (`maxPoints` 0, or the speed bonus run out) is still correct and never penalised. On an `ordering`, a multiplier strictly between 0 and 1 is a **partial** outcome: its points are shown and counted, it is never penalised, but it ends a run of correct answers (only a full order keeps the run going).

## Multi-answer scoring modes

For `multi` questions only. With `s` = number of solutions, `x` = correct answers selected, `y` = wrong answers selected:

| Mode                 | Multiplier            | Behaviour                                                     |
| -------------------- | --------------------- | ------------------------------------------------------------- |
| `strict`             | 1 if exact, else 0    | All solutions selected and nothing else, or no points at all. |
| `balanced` (default) | `max((x - y) / s, 0)` | Partial credit, wrong picks cancel out correct ones.          |
| `lenient`            | `x / s`               | Partial credit, wrong picks are free.                         |

## Ordering scoring

For `ordering` questions only, set with `options.orderScoring`. With `n` = number of items and `k` = items the player put at their correct place:

| Scoring              | Multiplier           | Behaviour                                        |
| -------------------- | -------------------- | ------------------------------------------------ |
| `position` (default) | `k / n`              | Partial credit, one share per item at its place. |
| `exact`              | 1 if `k = n`, else 0 | The whole order, or no points at all.            |

Examples with 4 items, `maxPoints` 1000, `penalty` 100, no speed bonus:

| Player's order (correct: A B C D) | `k` | `position`    | `exact`       |
| --------------------------------- | --- | ------------- | ------------- |
| A B C D                           | 4   | 1000, correct | 1000, correct |
| A B D C                           | 2   | 500, partial  | -100, wrong   |
| B C D A                           | 0   | -100, wrong   | -100, wrong   |

With the speed bonus switched on and `time` 20, the second player answering after 5 seconds gets `round((1000 - 50 x 5) x 0.5) = 375` points.

Since the shuffle leaves at most one item at its place, sending the list as shown is worth `1 / n` at most in `position` mode.

## Short answer matching

The input is cleaned when it arrives (Unicode NFKC, invisible characters such as zero width spaces removed, spaces collapsed and trimmed) and must then hold 1 to 60 characters, or it is ignored. It is compared to each accepted answer through a **key** where:

- case is ignored, and accents are dropped (`Élysée` = `elysee`);
- every apostrophe (`'`, `’`, `ʼ`, `` ` ``, `´`) and every dash (`-`, `‐`, `–`, `—`, `−`) reads the same;
- `œ` reads `oe` and `æ` reads `ae` (`cœur` = `coeur`);
- punctuation reads as a space (`Saint-Étienne` = `saint etienne`, `l'eau` = `l eau`, `Paris !` = `Paris`);
- except a `.`, `,`, `/`, `-` or `:` between two digits, which is kept (`1/2` is not `12`, `1.5` is not `15`, and `1,5` is not `1.5` either: accept both if both are right), and a leading minus sign (`-5` is not `5`);
- spaces between digit groups are dropped (`1 000` = `1000`).

An input or an accepted answer whose key is empty (punctuation only) never matches; the editor refuses such an accepted answer, and two accepted answers with the same key.

With `options.typoTolerance`, an input that matches no key exactly may still match the closest accepted answer within a number of typos (insertion, deletion, substitution, or two neighbours swapped) that depends on the length of the accepted key:

| Accepted key length                                       | Typos tolerated | Example                              |
| --------------------------------------------------------- | --------------- | ------------------------------------ |
| under 6                                                   | none            | `Rouen` does not accept `Rouan`      |
| 6 to 11                                                   | 1               | `Versailles` accepts `Versaille`     |
| 12 and more                                               | 2               | `Montparnasse` accepts `Mnotparnase` |
| holding a digit                                           | none            | `1914` never accepts `1915`          |
| holding a Roman numeral in capitals (`IV`, `XIXe`, `Ier`) | none            | `Henri IV` never accepts `Henri VI`  |

Roman numerals are looked for in the accepted answer as written: capitals only (write `Louis XIV`, not `louis xiv`). A capital followed by an apostrophe (`L'`, `D'`) is an elided article, and a lone `L`, `C`, `D` or `M` followed by a suffix is a word (`Le Havre`, `De Gaulle`, `Mer Noire`), not a numeral.

An exact match always wins; between two close answers, the one with fewer typos wins, then the first listed.

## Importing a spreadsheet

The importer reads the **first worksheet** of a `.xlsx` file (2 MB max) and uses the file name as the quiz title. Two layouts are supported:

- **any sheet with a header row**: it is looked for in the first 30 rows and must contain a `Question` column, at least two `Answer` columns (`Réponse`, `Respuesta`, `Antwort` and `Risposta` are recognised too) and a `Correct` column; a `Time` column (`Temps`, `Tiempo`, `Zeit`) is optional. Data starts on the next row.
- **the fixed template layout** (the layout of the Kahoot! quiz spreadsheet template): columns B to H, data from row 9. Used as a fallback when no header row is found.

Conversion rules:

- the `Correct` cell holds 1-based answer numbers separated by `,` or `;` (e.g. `1,3`). Blank answer cells are handled without shifting the correct answers.
- more than one correct answer becomes a `multi` question in `strict` mode, otherwise `single`.
- `Time` is clamped to 5-120 seconds (20 by default), and `cooldown` is set to 5 seconds.
- rows without a question, with fewer than 2 answers, or without a usable `Correct` value are skipped. If nothing usable is left, the import fails and nothing is saved.

The importer only creates `single` and `multi` questions: add media, true/false questions, polls, slides, ordering and short answer questions afterwards in the editor. There is no spreadsheet format for `ordering` and `shortanswer`.

> **Trademark note**: Kahoot! is a trademark of its owner, which is not affiliated with MSAQuiz and does not endorse or sponsor it. The name is only used to say which spreadsheet files the importer can read.

## Legacy quizzes

Questions saved before the type system existed have no `type` field. On import, one is inferred: several `solutions` means `multi`, otherwise `single`. Old Razzia files therefore import as-is.
