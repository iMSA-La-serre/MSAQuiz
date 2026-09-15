# 🔊 Sounds

Every sound shipped in `packages/web/public/sounds/` must have a known author and a licence that allows us to redistribute it. This page is the register: a sound that is not listed here, with its origin, must not be added to the app.

## Register

| File                   | Played when                                                                                 | Origin                                                                          | Status   |
| ---------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------- |
| `answer-received.wav`  | An answer comes in (host screen)                                                            | Original, synthesised by `packages/web/scripts/generate-sounds.ts` (iMSA, 2026) | ✅ Owned |
| `countdown-tick.wav`   | Each second of the pre-game countdown                                                       | Original, synthesised by `packages/web/scripts/generate-sounds.ts` (iMSA, 2026) | ✅ Owned |
| `finale.wav`           | The final ranking appears (host screen)                                                     | Original, synthesised by `packages/web/scripts/generate-sounds.ts` (iMSA, 2026) | ✅ Owned |
| `answers-loop.wav`     | Looping music while players answer (host screen only)                                       | Original, synthesised by `packages/web/scripts/generate-sounds.ts` (iMSA, 2026) | ✅ Owned |
| `question-reveal.wav`  | A question appears; answer distribution on the host screen; a poll vote on a player's phone | Original, synthesised by `packages/web/scripts/generate-sounds.ts` (iMSA, 2026) | ✅ Owned |
| `result-correct.wav`   | A player's answer was right                                                                 | Original, synthesised by `packages/web/scripts/generate-sounds.ts` (iMSA, 2026) | ✅ Owned |
| `result-incorrect.wav` | A player's answer was wrong                                                                 | Original, synthesised by `packages/web/scripts/generate-sounds.ts` (iMSA, 2026) | ✅ Owned |

Every sound in the app is now original. None of the sounds inherited from Razzia remain.

## Adding or replacing a sound

- **Synthesised sounds** live in `packages/web/scripts/`: `generate-sounds.ts` writes the files, `sound-kit.ts` holds the shared building blocks, and `answers-loop.ts` composes the answer-time music. The scripts use no samples and are deterministic: run `pnpm --filter @razzia/web sounds:generate` and it rebuilds the exact same files, which is our proof of authorship.
- **Recorded or downloaded sounds** are only accepted with a licence that allows redistribution (e.g. CC0). Keep a copy of the licence page and fill in the author, source URL and date in the table above.
- Strip metadata before committing (`ffmpeg -i in.wav -map_metadata -1 out.wav`), so files carry no leftover tags from another tool or library.
