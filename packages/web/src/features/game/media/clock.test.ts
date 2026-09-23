import { formatClock, progressOf } from "@razzia/web/features/game/media/clock"
import { describe, expect, it } from "vitest"

describe("formatClock", () => {
  it("writes minutes and seconds, hours past an hour", () => {
    expect(formatClock(0)).toBe("0:00")
    expect(formatClock(7.9)).toBe("0:07")
    expect(formatClock(725)).toBe("12:05")
    expect(formatClock(3723)).toBe("1:02:03")
  })

  it("writes --:-- for a length not known yet", () => {
    expect(formatClock(null)).toBe("--:--")
    expect(formatClock(Number.POSITIVE_INFINITY)).toBe("--:--")
    expect(formatClock(Number.NaN)).toBe("--:--")
  })
})

describe("progressOf", () => {
  it("gives the share played, within 0 and 1", () => {
    expect(progressOf(10, 40)).toBe(0.25)
    expect(progressOf(50, 40)).toBe(1)
    expect(progressOf(-1, 40)).toBe(0)
    expect(progressOf(10, null)).toBe(0)
    expect(progressOf(10, 0)).toBe(0)
  })
})
