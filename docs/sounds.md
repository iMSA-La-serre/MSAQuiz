# 🔊 Sounds

Every sound shipped in `packages/web/public/sounds/` must have a known author and a licence that allows us to redistribute it. This page is the register: a sound that is not listed here, with its origin, must not be added to the app.

## Register

| File                  | Played when                            | Origin                                                                          | Status        |
| --------------------- | -------------------------------------- | ------------------------------------------------------------------------------- | ------------- |
| `answer-received.wav` | An answer comes in (host screen)       | Original, synthesised by `packages/web/scripts/generate-sounds.ts` (iMSA, 2026) | ✅ Owned      |
| `countdown-tick.wav`  | Each second of the pre-game countdown  | Original, synthesised by `packages/web/scripts/generate-sounds.ts` (iMSA, 2026) | ✅ Owned      |
| `answersMusic.mp3`    | Looping music while players answer     | Inherited from Razzia, author unknown                                           | ⚠️ To replace |
| `show.mp3`            | The question appears                   | Inherited from Razzia, author unknown                                           | ⚠️ To replace |
| `results.mp3`         | Result and answer-distribution screens | Inherited from Razzia, author unknown                                           | ⚠️ To replace |
| `three.mp3`           | Podium, 3rd place                      | Inherited from Razzia, author unknown                                           | ⚠️ To replace |
| `second.mp3`          | Podium, 2nd place                      | Inherited from Razzia, author unknown                                           | ⚠️ To replace |
| `snearRoll.mp3`       | Podium, before 1st place               | Inherited from Razzia, author unknown                                           | ⚠️ To replace |
| `first.mp3`           | Podium, 1st place                      | Inherited from Razzia, author unknown                                           | ⚠️ To replace |

## Adding or replacing a sound

- **Synthesised sounds** live in `packages/web/scripts/generate-sounds.ts`. The script uses no samples and is deterministic: run `pnpm --filter @razzia/web sounds:generate` and it rebuilds the exact same files, which is our proof of authorship.
- **Recorded or downloaded sounds** are only accepted with a licence that allows redistribution (e.g. CC0). Keep a copy of the licence page and fill in the author, source URL and date in the table above.
- Strip metadata before committing (`ffmpeg -i in.wav -map_metadata -1 out.wav`), so files carry no leftover tags from another tool or library.
