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
| `single`      | 2-4 answers, one tap submits                               | yes    | one or more accepted, others may earn a share |
| `multi`       | 2-4 answers, select several then **Valider**               | yes    | one or more                                   |
| `truefalse`   | two fixed answers, one tap submits                         | yes    | exactly one                                   |
| `poll`        | 2-4 answers, one tap (or several), no right answer         | no     | none                                          |
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
| `markers`     | 2-6 numbered markers on the question's image, one tap      | yes    | one or more markers                           |

A slide has no answers, so players stay on it until the manager moves on: give it `time: -1` and use the Skip button, or set a timer.

A true/false question carries its two answers for you: the editor fills them in, keeps them read-only, and lets you pick which one is correct. Only the statement is yours to write.

Unscored types (`poll`, `slide`, `wordcloud`, `ranking`, `scale`) ignore `solutions`, `maxPoints` and `penalty` — the validator strips those fields on save, and the editor hides them. A poll vote, a word cloud answer, a ranking or a level on a scale never awards points, never costs points, and never interrupts a run of correct answers; slides are skipped in the players' answer history and in the exported report.

### Poll with several answers

A poll takes one answer, as it always did, unless its author switches on « Plusieurs choix possibles » in the editor: `options.multiple` is then `true`, public, and players tick as many answers as they want, then « Valider » sends them, as on a `multi` (the same rows, ticks, button and help line « Cochez au moins une réponse »). The hint above the answers reads « Sondage : plusieurs choix », short enough for one line on a 320 px phone. `options.multiple` is dropped on save when it is not `true`, and on every type but `poll` and `markers`, unchecked.

Once the question closes, each row of the projected screen counts the players who ticked that answer, **out of every player who answered**, as a poll's rows always did: the shares may add up to more than 100 %, and the hint, worded as during the question, says so (« Sondage : plusieurs choix · en % des répondants »). Nobody is right or wrong: the result card reads « Vote enregistré ». The result window lists each player's answers and « Plusieurs choix » next to the time; as for every poll, with one answer or several, it puts neither tick nor cross by the answers, and each player's verdict reads « Réponse enregistrée » (« Sans réponse » without one), never « Incorrect »; the statistics count each answer ticked, out of the players who answered; the exported report counts each answer ticked, then « Ont répondu », the players who answered.

### Single choice with partial credit

In the editor, « Crédit partiel » in the scoring settings of a `single` gives each wrong answer a share of the points, 0, 25, 50 or 75 %, from a menu next to its « Bonne réponse » box: `options.credits` lists the credit of each answer, in percent, in the order of `answers`. A right answer always earns 100: the validator stores 100 for every answer in `solutions`, 0 for a missing credit, drops the extra ones, and refuses another value for a wrong answer. `options.credits` is **secret**, as `solutions`: the server leaves it out of the settings players receive, with the scoring mode stored along, so the question reaches them exactly as a `single` without credits, with no settings; only the manager's screen gets the credits, once the question closes. On any other type, `truefalse` included, it is dropped on save, unchecked.

When at least one wrong answer earns more than 0, the multiplier of a wrong answer is its credit (50 % gives 0.5) and such an answer is a **partial** outcome, as on an `ordering`: « En partie juste », its points shown and counted, never penalised, ending a run of correct answers, and the result card says what it was worth (« Cette réponse rapporte 50 % des points »). A right answer then reads « correct » from its multiplier, whatever its points. With every credit at 0, or without `options.credits`, the question plays, scores and shows exactly as a `single` always did.

The phone and the answering screen do not change. Once the question closes, the projected screen labels each answer earning part of the points with its credit (« 50 % ») where a right answer is labelled « Bonne réponse », without its outline, and a note under the rows says what the labels stand for (« Crédit partiel selon la réponse »), in place of a hint above them that would move the title and the rows, as no hint shows while the question is asked. The result window gives « Crédit partiel » next to the time (nothing when « Crédit partiel » was left on with every credit at 0, rather than a scoring mode a single choice never reads), the credit of each answer earning part of the points in place of its cross, and « En partie juste (50 %) » as the verdict of a partly right answer; the statistics count full credit only as correct, list the answers earning part of the points with their credit and give the mean score; the exported report writes each credit in the « Correcte » column (« 50 % ») and adds the mean score.

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

### Markers

Labelled « Repères » in the editor and on the screens (short enough for the phone band). The question carries an **image** (`media.type` is `"image"`), and the author places 2 to 6 numbered markers on it: `markers[i]` is `{ x, y }`, a whole percentage of the image's width and height, and `answers[i]` the marker's label, 40 characters at most. Two markers on the same spot are refused: only the top one could be tapped. Two labels that only differ by case, accents or punctuation are refused, as an ordering's items. `solutions` lists the right markers, at least one; the markers themselves are public, which of them are right is not.

The question plays as a **single choice**: one tap sends the answer. When the author ticks several markers, the question turns into a multiple choice — `options.multiple` is filled in on save, so the phone knows it may take several markers, and `options.scoringMode` applies as it does on a [multiple choice](#multi-answer-scoring-modes) (the editor then shows the setting). Ticking a single marker again drops `options.multiple`; the `scoringMode` stays stored, ready for a second right marker, but no longer changes anything: one right marker scores 1 or 0 in every mode.

The phone shows the image with its markers (the image keeps its shape, as high as the media block allows, narrower when the screen is), and under it the same markers as rows, numbered and labelled. The rows are the answer for the keyboard and the screen reader; the markers on the image, 44 px wide, answer under the thumb, and both fill the same selection. A marker picked gets the green ring of a picked row, between two white edges so it shows on a green picture, and a tick: never its colour alone. A marker placed at the very edge of the image keeps its chip inside it. The projected screen shows the image with its markers and the same rows, never answered, compact past four markers as an ordering's. The waiting screen keeps the numbers sent.

Once the question closes, the projected screen keeps the image, its right markers outlined and ticked, and each row gains a bar with the players who tapped that marker, as a choice's rows do; the hint above counts the answers that earned credit, full or partial, which the phones call correct. The result window shows the image with its markers, the right ones ticked, and lists the markers with their counts and each player's own, numbered as on the image; its « Bonnes réponses » figure counts the answers that earned credit, as its rows do; the statistics list every marker, numbered, with the players who tapped it; the exported report gives one row per marker, numbered, the right ones ticked.

In the editor, a click on the image places a marker where the pointer is; the « Ajouter un repère » button, or the keyboard on the image, places one on a free spot, never on another marker. The editor's image is larger than a phone's: under it, a warning names the markers whose chips would overlap on a phone, where a thumb could tap the wrong one. It does not prevent saving.

## Media

A question can carry one media: an image, a video, a sound or a YouTube video (`media.type` is `"image"`, `"video"`, `"audio"` or `"youtube"`, see [YouTube videos](#youtube-videos)). The projected screen loads it itself from its address, `media.url`, and so does every phone for an image (a video, a sound or a YouTube video plays on the projected screen only, see below, unless a video is set to play on every device, see [A video on every device](#a-video-on-every-device)). The address of a file must be one of:

- a **direct link to the file**, a web address starting with `http://` or `https://` (`https://intranet.example/films/consignes.mp4`), that the devices showing it can reach (the projected screen's computer for a video or a sound, every phone too for an image and for a video set to play on every device): a file on the intranet is only seen on the intranet, and a file behind a sign-in page is not seen on the phones;
- a **path on the quiz's own server**, starting with `/` (`/branding/logo.png`), for a file served next to the application;
- a small image pasted as a `data:` address, 500 KB at most (the quiz goes to every phone).

A file of the computer (`C:\…`, `file:///…`) is refused on save, with « Collez une adresse web (https://…) vers le fichier »: nobody else can read it. So is an address with a tab or a line break in it, which a browser would read as another one. A link to a page that plays a video, chosen as a video or a sound, is refused too: it opens a page, not the file, and a player cannot read it. That is any link of Dailymotion, Vimeo or Stream, and the sharing links of Google Drive, SharePoint and OneDrive (`…/file/d/…/view`, `…/:v:/…`, `stream.aspx`); their download links (`uc?export=download`, `download.aspx`, `?download=1`) give the file and are accepted. A file stored on one of those sites is accepted when its address ends with its extension (`…/film.mp4`). A YouTube video's link is a YouTube video, played by YouTube's own player: chosen as a video, a sound or an image, it is refused with « C'est le lien d'une vidéo YouTube : choisissez le type YouTube » (as an image, every phone would contact YouTube). No other page of YouTube's is an image either (a channel's page chosen as an image is refused as a page, « Ce lien ouvre une page… »); YouTube's thumbnails (`img.youtube.com/vi/…/0.jpg`, `i.ytimg.com`) are images.

In the editor, the address comes first, with its label, and the preview under it, so the field never moves while it is typed. Paste the address: the type is picked from its extension — `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif` and `.svg` for an image, `.mp4`, `.webm` and `.mov` for a video, `.mp3`, `.wav`, `.ogg` and `.m4a` for a sound —, « YouTube » for a YouTube link, or by hand when the address does not tell (a shared drive's link, which may hold an image as well as a video); it can be changed, to play only the sound of a video file for instance, and that choice holds while the address is edited, until a new address tells another type. Why a save would refuse the address shows under it at once when it is pasted, and after a short pause when it is typed (« h » is not yet an address). The preview loads the address once it has not changed for half a second; it never plays by itself (the browser is only asked for the length of a video or a sound until play is pressed), and it is 15rem high at most, so the answers stay near. « Média introuvable ou format non lu » under the field means the browser could not load the address: check that it is a direct link to the file, then « Réessayer » (typing the address again tries it again too, a file put in place since included). Clearing the address, or the bin next to it, removes the media; the focus goes back to the field. A media without a type is refused on save. In the list of questions, an image that does not load is shown as a red crossed-out picture, and a YouTube video that will not play as a red crossed-out camera (see [YouTube videos](#youtube-videos)).

A save refused over one question names it (« Question 3 : … »), whatever the rule, and the editor opens that question.

A JSON import reads the file as a stored quiz is read, not as a save: whatever this instance or another one exported imports again as it was, a media the editor would now refuse included (a YouTube link saved as a video file, a Windows path, an address without a type). The import then says which questions have such a media (« Les médias des questions 2 et 4 sont à corriger dans l'éditeur »): the editor shows why under the media's address, and asks for the fix on the next save. A file that a stored quiz could not be either (a question without a title…) is refused, naming the question of the file to fix (« Import refusé, question 2 du fichier : … »).

Formats that play everywhere: MP4 with H.264 video and AAC sound (WebM does not play on older iPhones), MP3 for a sound. Images are loaded by every phone: resize them for a screen, under 1 MB.

In the game, an image shows from the reading time on, on the projected screen and on the phones. A video or a sound plays **on the projected screen only** (unless a video is set to play on every device, see [A video on every device](#a-video-on-every-device)), driven by the host: the phones never get its address nor load the file, and show « Regardez l'écran » (a video) or « Écoutez » (a sound) in its place, from the reading time on; on a slide, the slide's own card says it instead (« Suivez la diapo et la vidéo à l'écran »), so a phone never shows two cards. The projected screen loads it while the question is read (a video shows its first picture, paused) and starts it when answers open; a slide's starts as soon as the slide shows. The question's jingles are left out, so they never cover its sound, and the background music stays off.

Under a video are the host's controls, never over it, in the style of the dock's buttons: « Revenir au début » (back to 0:00, playing on or paused as it was), « Lire » or « Pause » (the K key too; the button keeps its width, so nothing moves under the pointer), where it is (« 0:12 / 0:40 ») and « Plein écran » (the F key too, Échap or F to leave it). A click on the picture plays or pauses it too. The controls take one row next to the bar when the video's column is wide enough, two rows otherwise, and the video's frame, in 16:9, takes the height the title, the controls, the band and the dock leave: a long title makes the video smaller rather than pushing the dock off the screen. A sound has nothing to show: its controls are in the dock, on the left of « Passer » and « Suivant », so it takes no room from the question. The volume is the computer's. The player has no browser controls: after a click on one of these, the presentation remote (right arrow, page down) still moves the game on. The video or the sound stays when answers close (the last answer in, the timer out, « Passer »): the distribution shows it at the same place, playing on or paused where it was, in full screen still if it was, until « Suivant »; so does a slide. The player is never taken out of the page from one screen to the next (moved in place where the browser can, Chromium since version 133), which is what an embedded site's player will need; the control that had the keyboard focus keeps it. A screen too long for the projector (long answers by a video, for instance) never hides the dock: it stays at the bottom of the screen, « Passer » and « Suivant » in view and clickable; held over the rows, the sound's controls and « Passer » take the navy of the phone's band instead of their veil, so they stay legible over a white row (Chromium since version 133).

A reload of the projected screen picks the video or the sound up where it was (the position is kept in the browser tab, not on the server). A browser does not play a sound by itself right after a reload, before a click on the page: the screen then says « Lecture automatique bloquée par le navigateur », read out once by screen readers, and « Reprendre la vidéo » (« Reprendre le son ») plays it on from there, or « Lancer la vidéo » (« Lancer le son ») when it had not played yet. A video or a sound that does not load shows « Vidéo indisponible » (« Son indisponible »), also read out, with « Réessayer ». On a slide, a video takes the width its height limit allows, in 16:9, whatever the size of its file, never under 200 px high (the smallest player a video site allows), with its controls under it; its title is a size smaller on a short projected screen, and a slide's media gets smaller when its title takes two or three lines, so the slide still fits a 1280×650 projector. An image that does not load leaves a neutral « Image indisponible » block of the same size, larger on a large projected screen; a markers question keeps its markers over it, with the label small at the bottom of the block, out of the markers' way, and the result window shows the same block. Each screen that shows the block tries the address again behind it (the next stage of the question, the next question, the result window): a network hiccup or a file put in place since shows the picture again.

In the editor, under the type of a video (a file or a YouTube video), « Où joue la vidéo » offers « Sur l'écran projeté seulement », the default, and « Sur tous les appareils, pilotée par l'animateur » (see [A video on every device](#a-video-on-every-device)); a line under it says what the choice means (« La vidéo passe sur l'écran projeté… »). A sound always plays on the projected screen: it has no such choice, and a video turned into a sound loses it. Where it plays is kept in `media.playback`: `"devices"` for every device, nothing for the projected screen (every quiz saved before the choice existed). A stored quiz whose `playback` is a value the game does not know is read as the screen, never refused; a save refuses it.

Quizzes stored before these rules still open and play: the rules apply when they are saved again from the editor. A media stored without a type (the editor once saved the address alone) is read with the type its file's extension tells, or as a YouTube video for a YouTube video's link, so the game shows it; one whose address tells none is not shown until a type is picked. A YouTube video's link stored as a video file or as an image (an editor or an import let it through before these rules) plays as the YouTube video it is: the server sends it as one (`"youtube"`) to the projected screen, which plays it in YouTube's player, and to the phones, which get its type alone and show « Regardez l'écran »; the result window and the report give its link. The editor asks for the YouTube type on the next save. Any other page of YouTube's stored as an image is shown nowhere, and never reaches a phone.

### YouTube videos

Paste the link of a YouTube video, as YouTube's « Partager » button gives it or as the browser shows it: `https://www.youtube.com/watch?v=…`, `https://m.youtube.com/watch?v=…`, `https://youtu.be/…`, a short (`/shorts/…`), a live stream or its recording (`/live/…`), a player's address (`/embed/…`, `youtube-nocookie.com`). The editor picks the « YouTube » type at once; the link is kept as pasted (`media.url`), and the game reads from it the video's identifier (11 letters, digits, `-` or `_`) and where it starts: `t=` or `start=`, in seconds (`t=90`) or as YouTube writes it (`t=1m30s`). A YouTube link that names no video (a channel, a channel's live stream player `/embed/live_stream?channel=…`, a playlist, a search) is refused with « Ce lien ne mène pas à une vidéo YouTube : copiez l'adresse de la vidéo avec le bouton Partager de YouTube ». Links of other video sites (Dailymotion, Vimeo, Stream, Google Drive, SharePoint…) are still refused: only YouTube's player is supported.

The editor's preview is YouTube's own player, from where the link starts, loaded as soon as the link settles and never playing by itself: a video YouTube will not play is found before the game, with a message under the field. « Vidéo introuvable sur YouTube : supprimée, privée ou lien mal copié » (a removed, private or mis-copied video) and « Son propriétaire ne permet pas de lire cette vidéo hors de YouTube (intégration désactivée ou vidéo privée) » (its owner unticked « Autoriser l'intégration »): YouTube's player gives the same code (150) for both, so the editor asks YouTube's page of the video (oEmbed, without cookies) which one it is; when that page does not tell, « YouTube ne permet pas de lire cette vidéo hors de son site… » covers both. « YouTube refuse le lecteur : le site du quiz ne lui transmet pas son adresse (en-tête Referer) » means a server or a proxy strips the `Referer` header, which YouTube requires (error 153); « YouTube ne répond pas » means this computer does not reach YouTube: its script did not load, or its player's page never came within 20 seconds (a proxy that lets `www.youtube.com` through but blocks `www.youtube-nocookie.com`). Choose another video, or put the file on the intranet and use a direct link to it.

The list of questions points out each YouTube video that will not play with a red crossed-out camera, read out as « Vidéo indisponible » and the reason: before the author opens its question, the editor asks YouTube's page of every YouTube video of the quiz once (oEmbed, without cookies: a removed, private or mis-copied video, one whose owner keeps it to YouTube), and it adds what the preview's player found for the open question. A network that does not reach YouTube is not blamed on a video: only the open question says so. « Réessayer » asks again. The page of a video does not tell everything (an age-restricted video, for instance): open the question to be sure.

In the game, a YouTube video plays like a video file (see above), **on the projected screen only**: YouTube's official player (IFrame Player API, from `youtube-nocookie.com`, YouTube's privacy-enhanced mode), inline, suggesting no other channel's video at the end, its interface and its captions in French when the video has them. It is loaded while the question is read, starts when answers open (a slide's, as soon as the slide shows) and stays through the distribution, playing on or paused, until « Suivant ». Under it, never over it (YouTube's rules forbid anything in front of the player), the same controls as for a video file: « Revenir au début » (back to where the link starts), « Lire » or « Pause » (K), where it is, « Plein écran » (F). They come first for the keyboard: from the page, Tab reaches « Revenir au début » before YouTube's bar, and a Tab from « Plein écran » goes into the player. By the answers, the player is never under 200 px high (the smallest YouTube allows, as on a slide): on a short projected screen it comes a little closer to the title, and a title of five lines still leaves the dock its room at 1024×680; a longer one makes the page scroll, the dock staying in view. YouTube's own bar stays in the player, for the captions (« CC »), the volume and the settings; its own full screen button is left out, full screen goes through the host's control. After a click in the player, the keyboard comes back to the page, so the presentation remote (right arrow, page down) still moves the game on; a Tab into the player leaves the focus there, to reach its bar from the keyboard. While the focus is in YouTube's bar, the remote, K and F do nothing (the keys go to YouTube's player): a click on the page, outside the player, gives them back. The player is moved in place from one screen to the next (Chromium since version 133); a browser that cannot (Firefox, Safari) reloads YouTube's player at each screen change, and the video picks up where it was, playing if it was, after a second of loading. YouTube then no longer tells the page when the video plays or stops: the quiz asks the player four times a second, so the host's controls, the clock and K still follow it. A reload of the projected screen picks it up where it was, with « Reprendre la vidéo » when the browser asks for a click first. A video YouTube will not play shows « Vidéo indisponible » in its place and, in a few words for the room, why: « YouTube inaccessible depuis cet ordinateur », « Vidéo introuvable sur YouTube », « YouTube ne permet pas de la lire ici », « Lecteur refusé par YouTube »…; screen readers hear the full reason, as the editor gives it. As in the editor, when YouTube's player gives the code it uses both for a removed video and for one kept to YouTube (101, 150), the projected screen asks the video's page (oEmbed, without cookies): a removed, private or nonexistent video then reads « Vidéo introuvable sur YouTube », without « Ouvrir sur YouTube ». A player whose page never comes says « YouTube inaccessible depuis cet ordinateur » after 20 seconds. « Réessayer » tries again; « Ouvrir sur YouTube » (in a new tab) shows only where YouTube's own site would play the video (a video kept to YouTube, a refused player, a player error), never when YouTube does not answer nor for a video YouTube does not have.

The phones show « Regardez l'écran » (on a slide, « Suivez la diapo et la vidéo à l'écran ») and never contact YouTube, unless the video is set to play on every device and the participant asks for it (see [A video on every device](#a-video-on-every-device)): they never get the link, and never load YouTube's script or player (no request to `youtube.com` nor `googlevideo.com`). For a question with answers, the result window shows « Ouvrir sur YouTube », a link to the video's page from where the link starts, and the exported report gives the same link under the question's title (« Vidéo YouTube : https://www.youtube.com/watch?v=… »); a YouTube video's link stored as a video file or an image too. A slide is never in the results nor in the report: its video is not either.

Limits:

- **Advertising**: YouTube may show ads before or during a video, in privacy-enhanced mode too (they are then not personalised). The quiz can neither block nor skip them. A video of an institutional channel (such as the MSA's) usually has none.
- **Videos that will not play**: a video whose owner turned off embedding, an age-restricted video (YouTube sends it back to its site), a private or removed video. The editor's preview tells before the game.
- **Internet access of the projected screen's computer**: it loads YouTube's script (`www.youtube.com`), its player (`www.youtube-nocookie.com`) and the video (`*.googlevideo.com`), none of which it can do without; the player's page also loads its font and icons (`fonts.gstatic.com`, `www.gstatic.com`) and pictures (`i.ytimg.com`, `yt3.ggpht.com`), and contacts `www.google.com` and `jnn-pa.googleapis.com`. A proxy's allow list needs every one of these hosts. Without `www.youtube.com` or `www.youtube-nocookie.com`, the screen says « Vidéo indisponible. YouTube inaccessible depuis cet ordinateur » within 20 seconds, with « Réessayer » (the editor says « YouTube ne répond pas »). Without `*.googlevideo.com`, YouTube's player loads but never plays: it shows its own loading wheel, and the host's controls say « Pause » at 0:00; the quiz cannot tell that from a slow start or an ad, so check beforehand, from the projected screen's computer, that a video plays in the editor's preview. The phones need none of it.
- **Company proxy**: a proxy may block these addresses, or force YouTube's restricted mode (`YouTube-Restrict` header, or DNS), which makes some videos unavailable in the player too. The quality cannot be chosen (YouTube adapts it to the connection). Never set `Referrer-Policy: no-referrer` on the quiz's pages (YouTube then refuses the player, error 153): the quiz's address is sent to YouTube with each video. If a Content-Security-Policy is ever added, it needs `script-src https://www.youtube.com`, `frame-src https://www.youtube-nocookie.com` and, for the checks of a video's page (the editor, the projected screen), `connect-src https://www.youtube.com`.
- **MSA**: loading YouTube's player sends to Google (YouTube) the projected screen's IP address and the quiz's intranet address, and YouTube may store data on that computer once the video plays. Before using YouTube videos in MSA sessions, check from a professional computer that the proxy lets YouTube through (and whether it forces restricted mode), and get the opinion of the DPO and of the RSSI. Participants' phones are not concerned. Where YouTube is not an option, host the file on the intranet and use a direct link to it.
- A video during a timed question plays while the timer runs: for a video to be watched whole, prefer a slide « Sans limite de temps », then the questions.

### A video on every device

For participants who cannot see or hear the projected screen (remote, in a video call, a room without sound), a video (a file or a YouTube video) can play on each participant's phone too, in step with the projected screen and driven by the host: in the editor, « Où joue la vidéo » → « Sur tous les appareils, pilotée par l'animateur » (`media.playback: "devices"`). The projected screen plays it as any video (see above), with the same controls; everything the host does there (« Lire », « Pause », K, « Revenir au début ») applies to every phone that shows it.

On each phone, in the video's place (on a slide, above the slide's card), a card asks first: « Regarder la vidéo ici ? » (« Pilotée par l'animateur »), with two buttons of the same weight, one above the other, « Regarder ici » and « Non, je regarde l'écran »: both show with the card, without scrolling, on a 320×568 phone. Nothing loads before the choice: no file, no YouTube. For a file, the card says it then loads on the phone, with its sound. For a YouTube video, it says beforehand that the phone then connects to YouTube (Google), which may store trackers on it (advertising, statistics) and show ads, with a link to Google's privacy policy (« Règles de confidentialité de Google », a new tab); the tap on « Regarder ici » is the participant's consent, asked each time a question has such a video. « Non, je regarde l'écran » keeps the card that points to the screen (« Regardez l'écran », or on a slide « Suivez la diapo et la vidéo à l'écran »), and the phone never contacts YouTube. While the answers are open (a question with answers), the card folds to its title, one row, so the answers stay in view (on a 320×568 phone, answers A and B with it); its title unfolds it, and folds it again (`aria-expanded`). The keyboard focus goes to « Couper le son » after « Regarder ici », and to the card that points to the screen after « Non, je regarde l'écran » (on a slide, to the slide's card).

After « Regarder ici », the video shows in a 16:9 frame (never under 200 px high for YouTube's player), brought fully into view, and plays where the projected screen is, playing or paused as it is; under it, never over it, « Couper le son » (« Remettre le son »), « Plein écran » (see Limits) and « Ne plus regarder ici ». While the host has it paused, a line under them says « En attente de l'animateur » (the state is read out as it changes, « En lecture » included). There is no pause on the phone: the host plays and pauses for everyone, and a video paused by anything else (a tap on YouTube's player, the phone's media keys) plays again at once; a browser that refused to play it without a tap shows « Lancer la vidéo » only while the host plays it. « Ne plus regarder ici » drops the player (YouTube's frame with it: the phone loads nothing more from YouTube, nor the file) and brings back the card that points to the screen, which takes the focus: withdrawing is as simple as accepting. The offer comes back with the next question that has such a video (or after a reload). While a YouTube video shows on the phone, the band at the top of the phone (name and score) scrolls away with the page instead of staying in view: nothing may cover YouTube's player, and the answers under it are reached by scrolling. A phone keeps in step by itself: beyond a second apart, it jumps to where the host is; closer, a file plays a little faster or slower (5 or 10 %) until back in step, while YouTube's player only jumps (its speeds do not allow a smooth catch-up). Measured with simulated phones on one computer: a file within a few hundredths of a second of the projected screen (up to about 0.15 s for a moment after it starts again, while it catches up), a YouTube video within about a quarter of a second (up to 0.55 s just after a phone starts watching); a phone whose connection drops and comes back, its clock 7 s off the server's, stays within 0.06 s, without a jump. A participant who answers keeps the video on the waiting screen, in the place of the wheel, and on their result, above it: the projected screen keeps it on the distribution, and the host still plays and pauses it for everyone there, until « Suivant », which stops it on every phone (on the phones still on a slide too). A participant who answers before choosing finds the card on the waiting screen, unfolded, and on the result, folded.

Next to the video's controls, the projected screen shows how many phones show it, never who: a phone and the number in a pill, apart from the clock, « 2 regardent » where the row has room (a slide's video), and « 2 appareils regardent la vidéo » for screen readers and on hover. A phone that cannot load the video (« Indisponible ici »: a file out of its reach, YouTube blocked) is not counted, nor one that stopped watching.

The phones follow the host, whatever happens:

- A participant who taps « Regarder ici » while the video plays, a phone that reconnects (the page reloaded, a network drop) and a participant who joins the game while such a video plays (they get the question at once, until its results, or until « Suivant » on a slide; other questions start for them with the next one) all start where the projected screen is. A reloaded phone asks again (« Regarder ici »), on the waiting screen and on its result too (the server's state names the video), and counts again once the participant taps it. After a network drop, the phone measures the server's clock again; until the first answer it keeps its last measure (never its own clock, which may be seconds off) and leaves its player as it is: no jump.
- When the projected screen disconnects (its page reloads, its network drops), the video pauses on every phone, where it was. The projected screen picks it up where it was once back; a browser that refuses to play by itself shows « Reprendre la vidéo », and the phones start again with it.
- A phone whose page is hidden (another app, the screen locked) pauses its video, and catches up once shown again, after measuring the server's clock again (a phone's clock may stop counting while it sleeps). YouTube forbids playing in the background.
- Only the host moves the video: the server ignores the same command from a participant's phone.

Limits:

- **Network**: each phone that shows the video loads it itself, about 1 Mbit/s for a 480p video, some 300 Mbit/s for 300 phones. A file must be reachable from the phones (a file on the intranet is not, from a phone on a mobile network or a guest Wi-Fi); a YouTube video needs Internet access on each phone. At the MSA, phones rarely reach both the intranet (the quiz) and YouTube: prefer a file hosted on the intranet, or the projected screen only.
- **iOS**: an iPhone plays a video with its sound only after a tap. The tap on « Regarder ici » is that one for a file. YouTube's player may still wait for a tap on the video itself: the phone then shows « Lancer la vidéo » under it, « Si elle ne démarre toujours pas, touchez la vidéo ». In a browser that cannot move the player in place (only those based on Chromium can, since version 133), YouTube's player is also reloaded when the answers open after being started during the reading time: it picks up where the host is, and an iPhone may ask for a tap again. « Plein écran » puts the video's box full screen on Android and on an iPad; on an iPhone, which puts nothing but a video full screen, a file opens in Safari's own player (its pause button there changes nothing: the phone follows the host), and a YouTube video has no « Plein écran » (the phone may be turned sideways instead). Tested on simulated Android phones only; try it on a real iPhone before a session.
- **Consent (RGPD, CNIL)**: YouTube's player on a phone stores trackers, which is why the phone asks first and loads nothing without « Regarder ici »; refusing is a button of the same weight, and « Ne plus regarder ici » withdraws the consent at any time (the player and YouTube's frame go). The privacy-enhanced mode (`youtube-nocookie.com`) is kept. The wording of the card (« … qui peut y déposer des traceurs (publicité, statistiques) et afficher des publicités ») is to be checked by the DPO; at the MSA, get the DPO's opinion before using a YouTube video on every device. A file on the intranet involves no third party.
- **Advertising on YouTube**: each phone may get its own ad, of its own length, which the quiz can neither block nor skip; that phone catches up with the host once its ad is over. The captions of the video are shown when it has some (YouTube's bar, where they are turned on, is left out on the phones).
- **Sound in the room**: phones a few hundredths of a second apart still echo each other in the same room; this mode is meant for participants who are not in the room, or with headphones. « Couper le son » keeps the picture only.
- A sound (`"audio"`) always plays on the projected screen, and so does a video on the screen only, as before: the phones then never load it.

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

| Field                         | Type                   | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `subject`                     | string                 | Quiz title, cannot be empty.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `questions`                   | array                  | At least one question.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `questions[].type`            | one of the types above | See the table above. Optional in legacy files, see [Legacy quizzes](#legacy-quizzes).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `questions[].question`        | string                 | The question text (or the slide text). Cannot be empty.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `questions[].answers`         | string[]               | 2 to 4 non-empty answers. Always empty for `slide`, `shortanswer`, `wordcloud`, `estimate` and `scale`, exactly two for `truefalse`, 3 to 6 items in the correct order for `ordering`, 3 to 6 proposals in the order they are shown for `ranking`, the passages of `text` for `highlight` (read from it on save), 2 to 5 items of 50 characters at most for `statements` and `categorize`, 2 to 6 marker labels of 40 characters at most for `markers`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `questions[].media`           | object                 | Optional: `type` is `"image"`, `"video"`, `"audio"` or `"youtube"`; when missing, it is read from the extension of `url`, or is `"youtube"` for a YouTube video's link (see [YouTube videos](#youtube-videos)). `url` is a web address (`http` or `https`), a path on the quiz server starting with `/`, or an image pasted as a `data:` address of 500 KB at most, see [Media](#media); for `"youtube"`, the video's link as pasted (`watch?v=`, `youtu.be/`, `/shorts/`, `/live/`, `/embed/`…, with `t=` or `start=`). An empty `url` removes the media. `playback`, for a video or a YouTube video: where it plays, `"screen"` (on the projected screen only, driven by the host, the default when absent) or `"devices"` (on every device too, in step with the projected screen and driven by the host, see [A video on every device](#a-video-on-every-device)); a sound always plays on the projected screen, and loses the setting. Required, and an image, for `markers`.                                                                                                           |
| `questions[].solutions`       | number[]               | 0-based indices into `answers`. Required for `single`, `multi`, `truefalse`, `highlight` and `markers`; a bare number is accepted too. Emptied for the other types.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `questions[].accepted`        | string[]               | `shortanswer` only: 1 to 10 answers that score, 60 characters at most, distinct once normalized. Dropped from the other types. Never sent to players.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `questions[].text`            | string                 | `highlight` only, required: the text, its 2 to 5 passages between `[brackets]`, 300 characters at most without them. Dropped from the other types. Public.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `questions[].targets`         | string[]               | `statements` and `categorize` only: what each item is matched with. Always `["Vrai", "Faux"]` for `statements`; 2 to 4 categories of 24 characters at most, distinct once normalized, for `categorize`. Dropped from the other types. Public.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `questions[].expectedTargets` | number[]               | `statements` and `categorize` only, required: the right target of each item, as an index into `targets`, in the order of `answers`. Dropped from the other types. Never sent to players.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `questions[].markers`         | object[]               | `markers` only, required: where each marker sits on the image, `{ x, y }` as whole percentages of its width and height, in the order of `answers`. Dropped from the other types. Public.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `questions[].expected`        | number                 | `estimate` only, required: the right value, under 10^12, with no more decimals than `options.decimals`, within `options.min` and `options.max`. Dropped from the other types. Never sent to players.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `questions[].cooldown`        | integer 3-15           | Seconds the question is displayed before answers open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `questions[].time`            | integer                | Seconds to answer, or `-1` for no time limit. 5 minimum in the editor, enforced on save for `ordering`, `shortanswer`, `wordcloud`, `estimate`, `highlight`, `statements`, `categorize`, `ranking`, `scale` and `markers`. Spreadsheet imports are clamped to 5-120.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `questions[].maxPoints`       | integer >= 0           | Points for a perfect answer. Default `1000`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `questions[].penalty`         | integer >= 0           | Deducted on a wrong answer. Default none, see below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `questions[].speedBonus`      | boolean                | Whether a faster answer earns more, see below. Default `true` for the first five types and for `markers`, `false` for `ordering`, `shortanswer`, `estimate`, `highlight`, `statements` and `categorize`. Meaningless on `wordcloud`, `ranking` and `scale`, which score nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `questions[].options`         | object                 | `multi`: `{ "scoringMode": "strict" \| "balanced" \| "lenient" }`, default `balanced`; `highlight`: `strict` or `balanced`, default `balanced` (`lenient` is stored as `balanced`). `ordering`: `{ "orderScoring": "position" \| "exact" }`, default `position`. `statements` and `categorize`: `{ "matchScoring": "share" \| "exact" }`, default `share`. `poll`: `{ "multiple": true }` to take several answers, see [Poll with several answers](#poll-with-several-answers). `single`: `credits`, the share of the points of each answer, secret, see [Single choice with partial credit](#single-choice-with-partial-credit). `shortanswer`: `{ "typoTolerance": boolean }`, default `false`. `wordcloud`: `{ "wordCount": 1 \| 2 \| 3 }`, default `1`. `estimate`: `decimals`, `tolerance`, `toleranceMode`, `min`, `max`, `unit`, see [Estimate](#estimate). `scale`: `scaleMin`, `scaleMax`, `scaleLow`, `scaleHigh`, `scaleSkip`, see [Scale](#scale). `markers`: `multiple`, filled in on save, and the `multi` modes it then applies, see [Markers](#markers). `ranking` has none. |

> **Note:** ids are assigned by the database. Importing the same file twice creates two quizzes.

> **Note:** whenever `options` is given, the validator fills in `scoringMode` (`balanced`) whatever the type, as it always did. Only `multi` reads it.

## How points are computed

1. **Base points**:
   - with the speed bonus (`speedBonus`, on by default for the first five types) and a time limit: `maxPoints - (maxPoints / time) x secondsElapsed`, never below 0;
   - with the speed bonus and without time limit (`time: -1`): by answer order, from `maxPoints` for the first player down to `maxPoints / 2` for the last;
   - without the speed bonus (the default for `ordering`, `shortanswer`, `estimate`, `highlight`, `statements` and `categorize`): `maxPoints`, whatever the time or the answer order.
2. **Multiplier**, from 0 to 1, from the question type: `single` and `truefalse` give 1 for the right answer and 0 otherwise (a `single` with partial credit gives a wrong answer its credit, see [Single choice with partial credit](#single-choice-with-partial-credit)), `multi` and `highlight` follow their mode (see below), `ordering`, `statements` and `categorize` their scoring (see below), `markers` follows the multiple choice's modes, which give 1 or 0 while a single marker is right, `shortanswer` gives 1 for a recognized answer and 0 otherwise, `estimate` 1 for a number within the tolerance and 0 otherwise, `poll`, `slide`, `wordcloud`, `ranking` and `scale` always give 0.
3. **Final score** = `round(base x multiplier)`, then `penalty` is subtracted if the question is scored, the player answered, and the outcome is "wrong" (see below). A player's total never goes below 0, and an unanswered question is never penalised.

**Outcome.** A player sees "correct", "wrong" or "no answer" on a scored question, and on a `poll`, a `wordcloud`, a `ranking` or a `scale` that their answer was recorded, or that they gave none. `single`, `multi` and `truefalse` keep their rule: any point earned is "correct", including a partial `multi` answer, and no point is "wrong" — but a `single` with partial credit follows its multiplier, 1 being "correct", a credit "partial" and 0 "wrong"; a `markers` answer reads the same way, any credit earned being "correct". `ordering`, `shortanswer`, `estimate`, `highlight`, `statements` and `categorize` follow the multiplier alone, whatever the points: 1 is "correct" and 0 is "wrong", so a recognized short answer worth 0 points (`maxPoints` 0, or the speed bonus run out) is still correct and never penalised. On an `ordering`, a `highlight`, `statements` or a `categorize`, a multiplier strictly between 0 and 1 is a **partial** outcome: its points are shown and counted, it is never penalised, but it ends a run of correct answers (only full credit keeps the run going).

## Multi-answer scoring modes

For `multi` and `highlight` questions (a highlight's passages stand for the answers, and it has no `lenient` mode), and for a `markers` question with several right markers (its markers stand for the answers). With `s` = number of solutions, `x` = correct answers selected, `y` = wrong answers selected:

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

The importer only creates `single` and `multi` questions: add media, true/false questions, polls, slides, ordering, short answer, word cloud, estimate, highlight, statements, categorize, ranking, scale and markers questions afterwards in the editor. There is no spreadsheet format for `ordering`, `shortanswer`, `wordcloud`, `estimate`, `highlight`, `statements`, `categorize`, `ranking`, `scale` and `markers`.

> **Trademark note**: Kahoot! is a trademark of its owner, which is not affiliated with MSAQuiz and does not endorse or sponsor it. The name is only used to say which spreadsheet files the importer can read.

## Legacy quizzes

Questions saved before the type system existed have no `type` field. On import, one is inferred: several `solutions` means `multi`, otherwise `single`. Old Razzia files therefore import as-is, their media too: a JSON import applies the rules a stored quiz is read with, not the stricter ones of a save, see [Media](#media).
