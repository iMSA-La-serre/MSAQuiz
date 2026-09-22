import { hasAnswer } from "@razzia/web/features/manager/utils/records"
import { describe, expect, it } from "vitest"

describe("hasAnswer", () => {
  it("reads a record with answer ids as answered", () => {
    expect(hasAnswer({ playerName: "Alice", answerIds: [1] })).toBe(true)
  })

  it("reads a missing answer as such", () => {
    expect(hasAnswer({ playerName: "Alice", answerIds: null })).toBe(false)
    expect(
      hasAnswer({ playerName: "Alice", answerIds: null, text: null }),
    ).toBe(false)
  })

  it("reads a text that matched nothing as answered", () => {
    expect(
      hasAnswer({ playerName: "Alice", answerIds: [], text: "Lyon" }),
    ).toBe(true)
  })

  it("keeps an empty id list without text unanswered, as before", () => {
    expect(hasAnswer({ playerName: "Alice", answerIds: [] })).toBe(false)
  })
})
