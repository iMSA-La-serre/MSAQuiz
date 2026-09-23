import type {
  PlaybackMemory,
  PlaybackMemoryEntry,
} from "@razzia/web/features/game/media/controller"

// One entry, for the media of the current question, per browser tab.
export const MEMORY_STORAGE_KEY = "msaquiz_host_media"

/**
 * The entry kept for `key`, read from what the storage holds: null for
 * another question's, or for anything unreadable.
 */
export const readMemoryEntry = (
  raw: string | null,
  key: string,
): PlaybackMemoryEntry | null => {
  if (raw === null) {
    return null
  }

  try {
    const entry: unknown = JSON.parse(raw)

    if (typeof entry !== "object" || entry === null) {
      return null
    }

    const {
      key: kept,
      position,
      playing,
      played,
    } = entry as Record<string, unknown>

    if (
      kept !== key ||
      typeof position !== "number" ||
      !Number.isFinite(position) ||
      position < 0 ||
      typeof playing !== "boolean" ||
      (played !== undefined && typeof played !== "boolean")
    ) {
      return null
    }

    // Kept before `played` was: it played if it went anywhere.
    return { position, playing, played: played ?? position > 0 }
  } catch {
    return null
  }
}

/**
 * Where the host was, kept in the tab's session storage: it outlives a reload
 * of the projected screen, not the tab. Without storage (private browsing
 * that refuses it), a reload starts the media from the beginning.
 */
export const sessionMemory = (
  storage: () => Storage = () => window.sessionStorage,
): PlaybackMemory => ({
  read: (key) => {
    try {
      return readMemoryEntry(storage().getItem(MEMORY_STORAGE_KEY), key)
    } catch {
      return null
    }
  },
  write: (key, entry) => {
    try {
      storage().setItem(MEMORY_STORAGE_KEY, JSON.stringify({ key, ...entry }))
    } catch {
      // Nothing kept: a reload starts from the beginning.
    }
  },
  clear: () => {
    try {
      storage().removeItem(MEMORY_STORAGE_KEY)
    } catch {
      // Nothing was kept.
    }
  },
})
