import {
  handFocusTo,
  keepFocus,
  takeFocus,
} from "@razzia/web/features/game/media/device-focus"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  // Nothing handed stays for the next test, whose clock starts again.
  handFocusTo("screen")
  takeFocus("screen")
  vi.useRealTimers()
})

describe("the phone's focus, handed over", () => {
  it("goes once to what the tap asked for", () => {
    handFocusTo("screen")

    expect(takeFocus("player")).toBeNull()
    expect(takeFocus("screen")).toMatchObject({ target: "screen" })
    expect(takeFocus("screen")).toBeNull()
  })

  it("is forgotten when nothing takes it at once", () => {
    handFocusTo("player")
    vi.advanceTimersByTime(1500)

    expect(takeFocus("player")).toBeNull()
  })

  it("follows a block to the next screen with the control that had it, unless a tap said otherwise", () => {
    keepFocus("player", "mute")
    expect(takeFocus("player")).toMatchObject({ control: "mute" })

    // « Ne plus regarder ici »: the player goes, the card takes the focus.
    handFocusTo("screen")
    keepFocus("player", "stop")
    expect(takeFocus("player")).toBeNull()
    expect(takeFocus("screen")).not.toBeNull()
  })
})
