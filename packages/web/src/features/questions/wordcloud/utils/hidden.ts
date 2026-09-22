// Words the host hid from the room, kept for the browser tab: reloading the
// projector page (F5, a crash, waking from sleep) must not show them again.
// Storage can be blocked: the words then stay hidden until a reload.

const PREFIX = "msaquiz_wordcloud_hidden"

/** Storage key of a question of a game, null while either is unknown. */
export const hiddenWordsKey = (
  gameId: string | null,
  questionNumber: number | undefined,
): string | null =>
  gameId && questionNumber ? `${PREFIX}:${gameId}:${questionNumber}` : null

export const readHiddenWords = (key: string | null): Set<string> => {
  if (!key) {
    return new Set()
  }

  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(key) ?? "[]")

    return new Set(
      Array.isArray(stored)
        ? stored.filter((word): word is string => typeof word === "string")
        : [],
    )
  } catch {
    return new Set()
  }
}

export const saveHiddenWords = (
  key: string | null,
  words: ReadonlySet<string>,
): void => {
  if (!key) {
    return
  }

  try {
    if (words.size === 0) {
      sessionStorage.removeItem(key)
    } else {
      sessionStorage.setItem(key, JSON.stringify([...words]))
    }
  } catch {
    // Blocked or full: nothing to keep.
  }
}
