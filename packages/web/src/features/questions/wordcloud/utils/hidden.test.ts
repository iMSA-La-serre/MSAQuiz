import {
  hiddenWordsKey,
  readHiddenWords,
  saveHiddenWords,
} from "@razzia/web/features/questions/wordcloud/utils/hidden"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The sessionStorage of a browser tab, as a map.
const tabStorage = () => {
  const items = new Map<string, string>()

  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value)
    },
    removeItem: (key: string) => {
      items.delete(key)
    },
    items,
  }
}

describe("hiddenWordsKey", () => {
  it("names a question of a game, once both are known", () => {
    expect(hiddenWordsKey("game-1", 3)).toBe(
      "msaquiz_wordcloud_hidden:game-1:3",
    )
    expect(hiddenWordsKey(null, 3)).toBeNull()
    expect(hiddenWordsKey("game-1", undefined)).toBeNull()
  })
})

describe("hidden words of a tab", () => {
  let storage = tabStorage()

  beforeEach(() => {
    storage = tabStorage()
    vi.stubGlobal("sessionStorage", storage)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("reads again the words hidden before a reload", () => {
    const key = hiddenWordsKey("game-1", 2)

    saveHiddenWords(key, new Set(["Merde", "Terrain"]))

    expect(readHiddenWords(key)).toEqual(new Set(["Merde", "Terrain"]))
    // Another question starts with every word shown.
    expect(readHiddenWords(hiddenWordsKey("game-1", 3))).toEqual(new Set())
  })

  it("forgets the question once every word is shown again", () => {
    const key = hiddenWordsKey("game-1", 2)

    saveHiddenWords(key, new Set(["Terrain"]))
    saveHiddenWords(key, new Set())

    expect(storage.items.size).toBe(0)
  })

  it("keeps only words from what the tab holds", () => {
    storage.setItem("k", JSON.stringify(["Écoute", 3, null]))

    expect(readHiddenWords("k")).toEqual(new Set(["Écoute"]))

    storage.setItem("k", "{not json")

    expect(readHiddenWords("k")).toEqual(new Set())
  })

  it("does nothing without a key or a storage", () => {
    vi.stubGlobal("sessionStorage", undefined)

    expect(() => saveHiddenWords("k", new Set(["Écoute"]))).not.toThrow()
    expect(readHiddenWords("k")).toEqual(new Set())
    expect(readHiddenWords(null)).toEqual(new Set())
  })
})
