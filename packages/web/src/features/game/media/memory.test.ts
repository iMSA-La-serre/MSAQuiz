import {
  MEMORY_STORAGE_KEY,
  readMemoryEntry,
  sessionMemory,
} from "@razzia/web/features/game/media/memory"
import { describe, expect, it } from "vitest"

const mapStorage = () => {
  const items = new Map<string, string>()

  return {
    items,
    storage: {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => {
        items.set(key, value)
      },
      removeItem: (key: string) => {
        items.delete(key)
      },
    } as unknown as Storage,
  }
}

describe("readMemoryEntry", () => {
  it("reads the entry of the question asked for", () => {
    const raw = JSON.stringify({
      key: "q1",
      position: 12.5,
      playing: true,
      played: true,
    })

    expect(readMemoryEntry(raw, "q1")).toEqual({
      position: 12.5,
      playing: true,
      played: true,
    })
    expect(readMemoryEntry(raw, "q2")).toBeNull()
  })

  it("reads an entry kept before it said whether the media played", () => {
    expect(
      readMemoryEntry(
        JSON.stringify({ key: "q1", position: 0, playing: false }),
        "q1",
      ),
    ).toEqual({ position: 0, playing: false, played: false })
    expect(
      readMemoryEntry(
        JSON.stringify({ key: "q1", position: 4, playing: false }),
        "q1",
      ),
    ).toEqual({ position: 4, playing: false, played: true })
  })

  it("reads nothing from what it cannot trust", () => {
    for (const raw of [
      null,
      "",
      "{",
      "null",
      "12",
      JSON.stringify({ key: "q1", position: "12", playing: true }),
      JSON.stringify({ key: "q1", position: -1, playing: true }),
      JSON.stringify({ key: "q1", position: 3, playing: "yes" }),
      JSON.stringify({ key: "q1", position: 3, playing: true, played: 1 }),
    ]) {
      expect(readMemoryEntry(raw, "q1")).toBeNull()
    }
  })
})

describe("sessionMemory", () => {
  it("keeps one entry, and forgets it", () => {
    const { items, storage } = mapStorage()
    const memory = sessionMemory(() => storage)

    memory.write("q1", { position: 4, playing: false, played: true })
    memory.write("q2", { position: 9, playing: true, played: true })

    expect(items.size).toBe(1)
    expect(memory.read("q1")).toBeNull()
    expect(memory.read("q2")).toEqual({
      position: 9,
      playing: true,
      played: true,
    })
    expect(JSON.parse(items.get(MEMORY_STORAGE_KEY) ?? "")).toMatchObject({
      key: "q2",
    })

    memory.clear()
    expect(memory.read("q2")).toBeNull()
  })

  it("does without a storage that refuses", () => {
    const memory = sessionMemory(() => {
      throw new Error("SecurityError")
    })

    expect(() => {
      memory.write("q1", { position: 1, playing: true, played: true })
      memory.clear()
    }).not.toThrow()
    expect(memory.read("q1")).toBeNull()
  })
})
