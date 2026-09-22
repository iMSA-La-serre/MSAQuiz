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
| `wordcloud`   | no answers: the player types 1 to 3 words                  | no     | none                                          |
| `estimate`    | no answers: the player types a number                      | yes    | none: `expected` holds the right value        |
| `highlight`   | a short text: tap its passages to spot, then **Valider**   | yes    | one or more passages of `text`                |
| `statements`  | 2-5 statements, Vrai or Faux for each, then **Valider**    | yes    | none: `expectedTargets` holds the right ones  |
| `categorize`  | 2-5 elements, a category for each, then **Valider**        | yes    | none: `expectedTargets` holds the right ones  |
| `ranking`     | 3-6 proposals to rank by priority, then **Valider**        | no     | none: `answers` holds the proposals           |
| `scale`       | no answers: the player picks a level of the scale          | no     | none: the levels are in `options`             |

A slide has no answers, so players stay on it until the manager moves on: give it `time: -1` and use the Skip button, or set a timer.

A true/false question carries its two answers for you: the editor fills them in, keeps them read-only, and lets you pick which one is correct. Only the statement is yours to write.

Unscored types (`poll`, `slide`, `wordcloud`, `ranking`, `scale`) ignore `solutions`, `maxPoints` and `penalty` — the validator strips those fields on save, and the editor hides them. A poll vote, a word cloud answer, a ranking or a level on a scale never awards points, never costs points, and never interrupts a run of correct answers; slides are skipped in the players' answer history and in the exported report.

### Ordering

Labelled « Mise en ordre » in the editor and on the screens. `answers` lists the items **in the correct order**, 3 to 6 of them, 80 characters at most each. Two items that only differ by case, accents or punctuation are refused: players could not tell them apart. `solutions` is not used and is emptied on save.

When the question starts, the server shuffles the items once, with at most one item left at its correct place, and every screen (the players' phones and the projected screen, including after a reconnection) shows that same shuffled list. The correct order only reaches the manager's screen once the question closes. See [Ordering scoring](#ordering-scoring).

### Short answer

Labelled « Réponse courte » in the editor and on the screens. The player types a word or a short phrase, 60 characters at most. `answers` and `solutions` are not used and are emptied on save; `accepted` lists the answers that score, 1 to 10 of them, 60 characters at most each. `accepted` is never sent to a player: the manager's screen shows it once the question closes. See [Short answer matching](#short-answer-matching).

### Word cloud

Labelled « Nuage de mots » in the editor and on the screens. Each player types 1 to 3 words or short expressions (`options.wordCount`, 1 by default), 30 characters at most each; `answers` and `solutions` are not used and are emptied on save. Nobody is right or wrong: the player's result card reads « Réponse enregistrée », or « Pas de réponse » without an answer.

Answers are **not linked to the username**. Once the question closes, the history keeps, for each player, only whether they answered, and for the question, how many players gave each word. It keeps the words only when at least 3 players had a word kept: with fewer, who answered would tell who typed what, so the result window, the statistics and the exported report read « Trop peu de réponses pour afficher les mots » instead (the room still saw them live). Neither the result window, the statistics, the exported report nor the server logs can tell who typed which word. The phone says so above the fields: « Réponse non associée à votre pseudo ».

Once the question closes, the projected screen shows the 30 most frequent words (20 on a projector under 820 px high), the most frequent first and the largest. Words given as often come in an order drawn from the words and the question, the same on every screen: not alphabetical, so a long cloud does not always leave out the end of the alphabet. When long expressions leave no room for them all, the rarest are left out and « + n autres mots » under the card says how many. On a projector 1000 px high or more (a full-screen 1080p one), the smaller words are larger. Clicking a word hides it from the room, a second click shows it again; « Tout masquer » and « Tout afficher » act on every word. Hidden words stay hidden when the page is reloaded in the same tab. Hiding a word only changes that screen, not the results. See [Word cloud moderation](#word-cloud-moderation).

### Estimate

Labelled « Estimation » in the editor and on the screens. The player types a number, which is right when it is within a tolerance of the right value, `expected`, bounds included; `answers` and `solutions` are not used and are emptied on save. `expected` is never sent to a player: the manager's screen shows it once the question closes. The settings are in `options`, public, as the phone needs them to read and bound the number:

- `decimals`: 0 to 3, 0 by default. Players may type that many decimals, and `expected`, the tolerance and the bounds may not have more.
- `tolerance` and `toleranceMode`: how far from `expected` an answer is still right, in the unit (`"absolute"`, the default) or as a percentage of `expected` (`"percent"`, 100 at most, one decimal), rounded down to the question's decimals. 0 or absent: only the exact value is right.
- `min` and `max`: the numbers a player may send, bounds included, each optional. `expected` must be within them, and they cut the tolerance: with `expected` 2, a tolerance of 5 and `min` 0, the right numbers are 0 to 7, as the editor, the projected screen and the report say. With a `min` of 0 or more, phones show their numeric keypad (which has no minus sign on every phone).
- `unit`: shown after every number (`km`, `€`, `adhérents`), 20 characters at most.

On any other type, `expected` and these six settings are dropped on save, unchecked.

The phone shows the unit at the end of the field and, under « Valider », the number as it will be sent (« Votre estimation : 1 234,5 km »), or why it cannot be sent yet (not a number, too many decimals, out of the bounds). The hint above the field gives the bounds and the tolerance (« Nombre entre 0 et 100 km, à 5 % près »); a lone `min` of 0 is left out of it. See [Reading a number](#reading-a-number).

Once the question closes, the projected screen gives the right value and the median of the numbers sent (« Bonne réponse : 35 km · médiane 40 km »), and counts the numbers by range, the smallest first: the values within the tolerance, labelled « Bonne réponse », and two ranges on each side of it (four on one side when a bound leaves no room on the other). The ranges are as wide as the tolerance or a tenth of the right value, whichever is larger, rounded up to 1, 2, 2.5 or 5 times a power of ten; the farthest one on each side is open (« Moins de 30 km », « Plus de 40 km »), or ends at the bound.

The result window lists each player's number, its gap to the right value and the verdict, then the same ranges and the median. The statistics count, across the games, the answers within, below and above the tolerance of their game, and the median of every number sent; the exported report gives the right value, the ranges and the median.

### Highlight

Labelled « Repérage » in the editor and on the screens (short enough for the phone band). The author writes a short text in `text`, 300 characters at most once the brackets are left out, and sets between `[brackets]` the 2 to 5 passages players may tap, 80 characters at most each: `Prévenez [votre employeur] et envoyez l'arrêt [sous 48 heures].` Brackets are reserved: every `[` must be closed by a `]`, a passage holds no bracket and is not empty, and two passages may not be written the same (they may differ by an accent only: `[a]` and `[à]` are two passages). `answers` is read from `text` on save, the passages in the order they come, whatever was sent along; `solutions` lists the passages to spot, one at least, as indices into `answers`. The text is stored cleaned (spaces collapsed, each passage trimmed) and is public: it goes to the phones with the question, the passages to spot never do.

It scores as a `multi`, the passages standing for its answers: `options.scoringMode`, `strict` or `balanced` (the default), picks the multiplier, see [Multi-answer scoring modes](#multi-answer-scoring-modes). There is no `lenient` highlight: with wrong picks free, tapping every passage would earn full credit, so `lenient` is stored as `balanced`. Full credit therefore always means every passage to spot and no other. Any credit short of full credit is a **partial** outcome, as on an `ordering`, and the result card says how many passages to spot the player found, and how many others they tapped (« 1 passage trouvé sur 2 · 1 en trop »).

The phone shows the text in a card, each passage in the flow of the words, tinted, with a small letter: a tap ticks it (each passage is a checkbox, named by its letter and words), a second tap unticks it, then « Valider » sends them all. The projected screen shows the same text, each passage after its letter chip. Once the question closes, it shows the passages as the rows of a `multi`, in the order of the text, the ones to spot outlined and labelled « Bonne réponse », and in the hint how many answers had every passage to spot and no other (« 3 réponses sans faute sur 12 »). Five passages at most: the distribution has a row per passage, and five compact rows are what fits a 1280×650 projector under a question on two lines.

The editor has one field for the text and lists the passages under it, each with its « Bonne réponse » box; « Entourer la sélection de [crochets] » sets the words selected in the field between brackets, and the eraser of a row takes its brackets out, the words staying in the text. When a passage is added or removed, the ticks follow the passages still written the same. On any other type, `text` is dropped on save, unchecked.

The result window gives the text, then each passage with the players who tapped it, and for each player the passages tapped, the ones to spot ticked, and the verdict (partial with its share). The statistics list every passage with the players who tapped it, the answers with full credit and the mean score; the exported report gives the text, the passages as the rows of a choice, the answers without a fault and the mean score.

### Statements and categorize

Labelled « Affirmations » and « Catégories » in the editor and on the screens (short enough for the phone band). Both match each item with one **target**:

- `statements`, a series of true or false statements: `answers` lists 2 to 5 statements, and the targets are « Vrai » and « Faux », imposed: `targets` is always stored as `["Vrai", "Faux"]`, whatever was sent.
- `categorize`, elements to sort: `answers` lists 2 to 5 elements, and `targets` 2 to 4 categories, 24 characters at most each, stored cleaned (spaces collapsed and trimmed), public.

Items are 50 characters at most, so that each row of the distribution holds on one line of a projector up to 1366 px wide; two items, or two categories, that only differ by case, accents or punctuation are refused. `expectedTargets` gives the right target of each item, as an index into `targets`, in the order of `answers`: `[0, 1, 0]` reads Vrai, Faux, Vrai. It is required for every item, never sent to a player (the manager's screen gets it once the question closes), and extra entries are dropped on save. `solutions` is not used and is emptied. See [Statements and categorize scoring](#statements-and-categorize-scoring). On any other type, `targets`, `expectedTargets` and `options.matchScoring` are dropped on save, unchecked.

The phone shows the rows of a multiple choice, one per item with its letter, and under each the targets as buttons across the row (native radio buttons, named by the item's letter and words): a tap picks one, another tap on another one changes it. « Valider » sends them all once every item has one, as an ordering once every item has its number. The hint above the rows reads « Vrai ou faux par affirmation », or « Une catégorie par élément ». The projected screen shows the items only, in the order of the author, with the same hint, which names the categories on a `categorize` (« Classez : Santé, Famille ou Retraite »). The waiting screen shows each item's letter with the target picked, across the line as a word cloud shows its words.

Once the question closes, the projected screen keeps the rows, each labelled with its right target where a choice's right answer is labelled « Bonne réponse » (« VRAI », « FAMILLE »), its bar counting the players who matched it; the hint counts the answers with every item matched (« 3 réponses sans faute sur 12 »). Five items at most, each on one line: five compact rows are what fits a 1280×650 projector under a question on two lines.

The result window lists each item with its right target and the players who matched it, and for each player the target picked for each item, the right ones ticked, and the verdict (partial with its share). The statistics list every item with its right target and the share of players who matched it, the answers with every item matched and the mean score; the exported report gives the categories, each item with its right target and the players who matched it, the answers without a fault and the mean score.

The editor lists the items in the rows of the choice editor, each with its right target where a choice has its « Bonne réponse » box: « Vrai » and « Faux » buttons for a statement, a menu of the categories for an element to sort, whose categories are listed first, as the answers of a poll. Removing a category leaves its elements without one.

### Ranking

Labelled « Priorités » in the editor and on the screens (short enough for the phone band). `answers` lists 3 to 6 proposals, 80 characters at most each, in the order the phones show them: unlike an `ordering` they are **not** shuffled, and the order the author writes is only a display order. Two proposals that only differ by case, accents or punctuation are refused, as an ordering's items. `solutions` is not used and is emptied on save: nobody is right or wrong, and the player's result card reads « Priorités enregistrées », or « Pas de réponse » without an answer.

Players answer exactly as they do an ordering: each tap gives a proposal the next place, a second tap takes it back, and « Valider » sends them all once every proposal has a place. Only the words change — a screen reader hears « proposition » and « priorité » where an ordering says « élément » and « position » — and the waiting screen keeps the letters in the order sent, as an ordering's does. Answers **are** linked to the username, as a poll's votes: the result window lists each player's order.

Once the question closes, the room's order comes from **rank points**: in an answer of n proposals, the one put first scores n - 1 and the one put last 0 (a Borda count). The projected screen keeps the rows of the answering screen, in that order, each with the letter the phones showed it with, and each bar counts the players who put that proposal **first**; the hint above says so (« Trié par priorité · part de premiers choix »). Proposals with as many points keep the author's order.

The result window lists the proposals in the room's order with the players who put each one first, and each player's own order. The statistics list the proposals in the order of the rank points of every game, with the players who put each one first; the exported report gives the proposals by priority with their points and their first choices.

### Scale

Labelled « Échelle » in the editor and on the screens. The player picks one level of a scale set in `options`, public; `answers` and `solutions` are not used and are emptied on save. Nobody is right or wrong: the player's result card reads « Réponse enregistrée », or « Pas de réponse » without an answer.

- `scaleMin` and `scaleMax`: the first and the last level, both included, 1 and 5 by default. A scale starts at 0 or at 1, ends at 8 at the latest and holds 3 to 8 levels: past eight, the distribution has more rows than a 1280×650 projector holds under a question on two lines.
- `scaleLow` and `scaleHigh`: what each end of the scale stands for (« Pas du tout », « Tout à fait »), 24 characters at most, stored cleaned (spaces collapsed and trimmed) and dropped when empty.
- `scaleSkip`: offer « Je préfère ne pas répondre » under the levels. Off when absent.

On any other type, these five settings are dropped on save, unchecked.

Answers are **not linked to the username**, as a word cloud's words. Once the question closes, the history keeps, for each player, only whether they answered, and for the question, how many players picked each level and how many preferred not to answer. It keeps those counts only when at least 3 players answered — a level picked or « Je préfère ne pas répondre » — since with fewer, who answered would tell who picked what, and two players who both preferred not to answer would be named by the count alone. With fewer, the result window, the statistics and the exported report read « Trop peu de réponses pour afficher la répartition » instead, with no level and no « Sans avis » under it (the room still saw them live). The phone says so above the levels: « Réponse non associée à votre pseudo ».

The phone shows the levels as buttons in a white card, a grid of equal columns: up to five on one line, then six as 3 + 3, seven as 4 + 3 and eight as 4 + 4 (native radio buttons, named « Niveau 4 sur 5 »), what each end stands for under them, and « Je préfère ne pas répondre » last when the author offers it; « Valider » sends the level picked. The projected screen shows the same card, never answered, so the room and the host read the same levels in the same places. The waiting screen reads the level sent (« 4 sur 5 »).

Once the question closes, the projected screen shows one row per level, the lowest first, with the level in its chip and what each end stands for next to it; each bar counts the players who picked that level, out of every player who answered, as a poll's rows do. The hint above gives the mean and the median of the levels picked (« Moyenne 4,2 · médiane 4 »), and « Sans avis : 2 » under the rows counts the players who preferred not to answer. Six levels or more take thinner rows, so eight still fit a 1280×650 projector.

The result window lists the levels with their counts, then « Sans avis », the mean and the median; each player's row only says that their answer was recorded. The statistics count the levels of every game, widening the list when a game was played on another scale, with the mean and the median across the games; the exported report gives the levels, « Sans avis », the mean, the median and who answered, never who picked what.

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
    },
    {
      "type": "wordcloud",
      "question": "In one word, what do you expect from this training?",
      "options": { "wordCount": 2 },
      "cooldown": 5,
      "time": 40
    },
    {
      "type": "estimate",
      "question": "How long is the Loire, in kilometres?",
      "expected": 1006,
      "options": {
        "tolerance": 10,
        "toleranceMode": "percent",
        "min": 0,
        "unit": "km"
      },
      "cooldown": 5,
      "time": 30
    },
    {
      "type": "highlight",
      "question": "Spot the two deadlines",
      "text": "Tell [your employer] and send the form to [your MSA office] [within 48 hours]. Benefits are paid [after 3 waiting days].",
      "solutions": [2, 3],
      "options": { "scoringMode": "balanced" },
      "cooldown": 5,
      "time": 45
    },
    {
      "type": "statements",
      "question": "True or false?",
      "answers": [
        "The MSA covers farm employees",
        "The MSA pays unemployment benefits",
        "Farmers pay their pension contributions to the MSA"
      ],
      "targets": ["Vrai", "Faux"],
      "expectedTargets": [0, 1, 0],
      "options": { "matchScoring": "share" },
      "cooldown": 5,
      "time": 30
    },
    {
      "type": "categorize",
      "question": "Which branch pays each benefit?",
      "answers": ["Family allowance", "Survivor's pension", "Sick pay"],
      "targets": ["Health", "Family", "Pension"],
      "expectedTargets": [1, 2, 0],
      "options": { "matchScoring": "exact" },
      "cooldown": 5,
      "time": 30
    }
  ]
}
```

## Field reference

| Field                         | Type                          | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `subject`                     | string                        | Quiz title, cannot be empty.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `questions`                   | array                         | At least one question.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `questions[].type`            | one of the twelve types above | See the table above. Optional in legacy files, see [Legacy quizzes](#legacy-quizzes).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `questions[].question`        | string                        | The question text (or the slide text). Cannot be empty.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `questions[].answers`         | string[]                      | 2 to 4 non-empty answers. Always empty for `slide`, `shortanswer`, `wordcloud`, `estimate` and `scale`, exactly two for `truefalse`, 3 to 6 items in the correct order for `ordering`, 3 to 6 proposals in the order they are shown for `ranking`, the passages of `text` for `highlight` (read from it on save), 2 to 5 items of 50 characters at most for `statements` and `categorize`.                                                                                                                                                                                                                                                                                                                  |
| `questions[].media`           | object                        | Optional: `type` is `"image"`, `"video"` or `"audio"`, `url` must be a valid URL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `questions[].solutions`       | number[]                      | 0-based indices into `answers`. Required for `single`, `multi`, `truefalse` and `highlight`; a bare number is accepted too. Emptied for the other types.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `questions[].accepted`        | string[]                      | `shortanswer` only: 1 to 10 answers that score, 60 characters at most, distinct once normalized. Dropped from the other types. Never sent to players.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `questions[].text`            | string                        | `highlight` only, required: the text, its 2 to 5 passages between `[brackets]`, 300 characters at most without them. Dropped from the other types. Public.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `questions[].targets`         | string[]                      | `statements` and `categorize` only: what each item is matched with. Always `["Vrai", "Faux"]` for `statements`; 2 to 4 categories of 24 characters at most, distinct once normalized, for `categorize`. Dropped from the other types. Public.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `questions[].expectedTargets` | number[]                      | `statements` and `categorize` only, required: the right target of each item, as an index into `targets`, in the order of `answers`. Dropped from the other types. Never sent to players.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `questions[].expected`        | number                        | `estimate` only, required: the right value, under 10^12, with no more decimals than `options.decimals`, within `options.min` and `options.max`. Dropped from the other types. Never sent to players.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `questions[].cooldown`        | integer 3-15                  | Seconds the question is displayed before answers open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `questions[].time`            | integer                       | Seconds to answer, or `-1` for no time limit. 5 minimum in the editor, enforced on save for `ordering`, `shortanswer`, `wordcloud`, `estimate`, `highlight`, `statements`, `categorize`, `ranking` and `scale`. Spreadsheet imports are clamped to 5-120.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `questions[].maxPoints`       | integer >= 0                  | Points for a perfect answer. Default `1000`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `questions[].penalty`         | integer >= 0                  | Deducted on a wrong answer. Default none, see below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `questions[].speedBonus`      | boolean                       | Whether a faster answer earns more, see below. Default `true` for the first five types, `false` for `ordering`, `shortanswer`, `estimate`, `highlight`, `statements` and `categorize`. Meaningless on `wordcloud`, `ranking` and `scale`, which score nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `questions[].options`         | object                        | `multi`: `{ "scoringMode": "strict" \| "balanced" \| "lenient" }`, default `balanced`; `highlight`: `strict` or `balanced`, default `balanced` (`lenient` is stored as `balanced`). `ordering`: `{ "orderScoring": "position" \| "exact" }`, default `position`. `statements` and `categorize`: `{ "matchScoring": "share" \| "exact" }`, default `share`. `shortanswer`: `{ "typoTolerance": boolean }`, default `false`. `wordcloud`: `{ "wordCount": 1 \| 2 \| 3 }`, default `1`. `estimate`: `decimals`, `tolerance`, `toleranceMode`, `min`, `max`, `unit`, see [Estimate](#estimate). `scale`: `scaleMin`, `scaleMax`, `scaleLow`, `scaleHigh`, `scaleSkip`, see [Scale](#scale). `ranking` has none. |

> **Note:** ids are assigned by the database. Importing the same file twice creates two quizzes.

> **Note:** whenever `options` is given, the validator fills in `scoringMode` (`balanced`) whatever the type, as it always did. Only `multi` reads it.

## How points are computed

1. **Base points**:
   - with the speed bonus (`speedBonus`, on by default for the first five types) and a time limit: `maxPoints - (maxPoints / time) x secondsElapsed`, never below 0;
   - with the speed bonus and without time limit (`time: -1`): by answer order, from `maxPoints` for the first player down to `maxPoints / 2` for the last;
   - without the speed bonus (the default for `ordering`, `shortanswer`, `estimate`, `highlight`, `statements` and `categorize`): `maxPoints`, whatever the time or the answer order.
2. **Multiplier**, from 0 to 1, from the question type: `single` and `truefalse` give 1 for the right answer and 0 otherwise, `multi` and `highlight` follow their mode (see below), `ordering`, `statements` and `categorize` their scoring (see below), `shortanswer` gives 1 for a recognized answer and 0 otherwise, `estimate` 1 for a number within the tolerance and 0 otherwise, `poll`, `slide`, `wordcloud`, `ranking` and `scale` always give 0.
3. **Final score** = `round(base x multiplier)`, then `penalty` is subtracted if the question is scored, the player answered, and the outcome is "wrong" (see below). A player's total never goes below 0, and an unanswered question is never penalised.

**Outcome.** A player sees "correct", "wrong" or "no answer" on a scored question, and on a `poll`, a `wordcloud`, a `ranking` or a `scale` that their answer was recorded, or that they gave none. `single`, `multi` and `truefalse` keep their rule: any point earned is "correct", including a partial `multi` answer, and no point is "wrong". `ordering`, `shortanswer`, `estimate`, `highlight`, `statements` and `categorize` follow the multiplier alone, whatever the points: 1 is "correct" and 0 is "wrong", so a recognized short answer worth 0 points (`maxPoints` 0, or the speed bonus run out) is still correct and never penalised. On an `ordering`, a `highlight`, `statements` or a `categorize`, a multiplier strictly between 0 and 1 is a **partial** outcome: its points are shown and counted, it is never penalised, but it ends a run of correct answers (only full credit keeps the run going).

## Multi-answer scoring modes

For `multi` and `highlight` questions (a highlight's passages stand for the answers, and it has no `lenient` mode). With `s` = number of solutions, `x` = correct answers selected, `y` = wrong answers selected:

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

## Statements and categorize scoring

For `statements` and `categorize` questions, set with `options.matchScoring`. With `n` = number of items and `k` = items the player matched with their right target:

| Scoring           | Multiplier           | Behaviour                                   |
| ----------------- | -------------------- | ------------------------------------------- |
| `share` (default) | `k / n`              | Partial credit, one share per item matched. |
| `exact`           | 1 if `k = n`, else 0 | Every item right, or no points at all.      |

A partial answer's result card says how many items were right (« 3 réponses justes sur 4 »).

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

## Reading a number

An estimate is read the same way on the phone and on the server (`checkEstimate` in [utils/estimate.ts](../packages/common/src/utils/estimate.ts)), after the cleaning of a short answer:

- spaces anywhere are dropped, so digit groups can be spaced (`1 234`, also with no-break spaces);
- a comma or a point stands before the decimals (`12,5` = `12.5`), once only: `1.234.567` and `1,234.5` are refused;
- trailing zeros of the decimals do not count (`12,50` is `12,5`, and is a whole number when written `12,0`);
- a leading `+` or `-` is read, and any dash stands for a minus sign (`−5`);
- anything else is refused: letters (`12 km`), exponents (`1e5`), more decimals than the question takes, 13 digits or more before the separator, a number out of `min` and `max`.

Values are compared as whole numbers of the smallest step (`10^-decimals`): with one decimal, `0.1 + 0.2` is exactly `0.3`. A percentage tolerance is taken from the right value and rounded down to that step: 10 % of 35 with no decimal is 3, so 32 to 38 are right.

## Word cloud moderation

What players type reaches the projector, so the server drops a word, without telling the player, when:

- once compared as a [short answer key](#short-answer-matching) (case, accents and punctuation ignored), it holds a common French swear word or insult of the built-in list, one of its words being that word or its plural (`gros con`, `connards`), or a letter typed three times or more (`merdeee`). A word that only contains one (`consultation`) is kept, and so are words with a common innocent meaning (`queue`, `fumier`);
- it holds an e-mail address, a link or a domain name (`msa.fr`), or a phone number (nine digits or more, spaced or not);
- the player already gave the same word in another field, once compared.

The player's answer still counts, even when every word is dropped. A caisse can add its own entries in a `moderation.txt` file in the config folder (next to `msaquiz.db`): one word or expression per line, `#` for a comment. The file is read again at each word cloud, so an edit applies without a restart; beyond 1 MB it is ignored. The host can still hide any word live on the projected screen.

## Importing a spreadsheet

The importer reads the **first worksheet** of a `.xlsx` file (2 MB max) and uses the file name as the quiz title. Two layouts are supported:

- **any sheet with a header row**: it is looked for in the first 30 rows and must contain a `Question` column, at least two `Answer` columns (`Réponse`, `Respuesta`, `Antwort` and `Risposta` are recognised too) and a `Correct` column; a `Time` column (`Temps`, `Tiempo`, `Zeit`) is optional. Data starts on the next row.
- **the fixed template layout** (the layout of the Kahoot! quiz spreadsheet template): columns B to H, data from row 9. Used as a fallback when no header row is found.

Conversion rules:

- the `Correct` cell holds 1-based answer numbers separated by `,` or `;` (e.g. `1,3`). Blank answer cells are handled without shifting the correct answers.
- more than one correct answer becomes a `multi` question in `strict` mode, otherwise `single`.
- `Time` is clamped to 5-120 seconds (20 by default), and `cooldown` is set to 5 seconds.
- rows without a question, with fewer than 2 answers, or without a usable `Correct` value are skipped. If nothing usable is left, the import fails and nothing is saved.

The importer only creates `single` and `multi` questions: add media, true/false questions, polls, slides, ordering, short answer, word cloud, estimate, highlight, statements, categorize, ranking and scale questions afterwards in the editor. There is no spreadsheet format for `ordering`, `shortanswer`, `wordcloud`, `estimate`, `highlight`, `statements`, `categorize`, `ranking` and `scale`.

> **Trademark note**: Kahoot! is a trademark of its owner, which is not affiliated with MSAQuiz and does not endorse or sponsor it. The name is only used to say which spreadsheet files the importer can read.

## Legacy quizzes

Questions saved before the type system existed have no `type` field. On import, one is inferred: several `solutions` means `multi`, otherwise `single`. Old Razzia files therefore import as-is.
