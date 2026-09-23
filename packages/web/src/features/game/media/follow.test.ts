import {
  FOLLOW,
  type FollowInput,
  followAction,
  targetOf,
} from "@razzia/web/features/game/media/follow"
import { describe, expect, it } from "vitest"

// A file in step with the host, playing.
const input = (over: Partial<FollowInput> = {}): FollowInput => ({
  kind: "video",
  target: 10,
  playing: true,
  paused: false,
  ended: false,
  position: 10,
  duration: 60,
  blocked: false,
  failed: false,
  rate: 1,
  sinceSeek: 60_000,
  visible: true,
  ...over,
})

describe("targetOf", () => {
  it("counts the time gone by since the server's word while it plays", () => {
    expect(
      targetOf({ playing: true, position: 12, at: 1_000_000 }, 1_003_500),
    ).toBe(15.5)
    expect(
      targetOf({ playing: false, position: 12, at: 1_000_000 }, 1_003_500),
    ).toBe(12)
  })

  it("never goes past the end, nor back for a clock a little behind", () => {
    expect(targetOf({ playing: true, position: 58, at: 0 }, 5000, 60)).toBe(60)
    expect(targetOf({ playing: true, position: 12, at: 5000 }, 4900)).toBe(12)
  })
})

describe("followAction, playing", () => {
  it("does nothing while in step", () => {
    expect(followAction(input())).toEqual({})
    expect(followAction(input({ position: 10.04 }))).toEqual({})
  })

  it("jumps to where the host is beyond a second apart", () => {
    expect(followAction(input({ position: 7 }))).toEqual({ seek: 10 })
    expect(followAction(input({ position: 11.5 }))).toEqual({ seek: 10 })
  })

  it("lands a YouTube video a little ahead, its player being slower to start", () => {
    expect(followAction(input({ kind: "youtube", position: 3 }))).toEqual({
      seek: 10 + FOLLOW.SEEK_LEAD.youtube,
    })
  })

  it("does not jump again before the player had time to play from there", () => {
    expect(followAction(input({ position: 7, sinceSeek: 1000 }))).toEqual({
      rate: 1 + FOLLOW.FAST_RATE,
    })
    expect(
      followAction(input({ kind: "youtube", position: 3, sinceSeek: 3000 })),
    ).toEqual({})
  })

  it("catches up a file under a second apart with its speed", () => {
    expect(followAction(input({ position: 9.9 }))).toEqual({
      rate: 1 + FOLLOW.SLIGHT_RATE,
    })
    expect(followAction(input({ position: 10.1 }))).toEqual({
      rate: 1 - FOLLOW.SLIGHT_RATE,
    })
    expect(followAction(input({ position: 10.6 }))).toEqual({
      rate: 1 - FOLLOW.FAST_RATE,
    })
    // Back in step: its own speed again.
    expect(followAction(input({ position: 10.02, rate: 0.95 }))).toEqual({
      rate: 1,
    })
  })

  it("never changes a YouTube video's speed: it only jumps", () => {
    expect(followAction(input({ kind: "youtube", position: 9.4 }))).toEqual({})
  })

  it("plays a player paused by anything but the host, not one the browser keeps from playing", () => {
    expect(followAction(input({ paused: true }))).toEqual({ play: true })
    expect(followAction(input({ paused: true, blocked: true }))).toEqual({})
  })

  it("starts from where the host is, a little apart too", () => {
    expect(followAction(input({ paused: true, position: 9.7 }))).toEqual({
      seek: 10,
      play: true,
    })
    expect(
      followAction(input({ kind: "youtube", paused: true, position: 9.9 })),
    ).toEqual({ play: true })
    expect(
      followAction(input({ kind: "youtube", paused: true, position: 9.6 })),
    ).toEqual({ seek: 10 + FOLLOW.SEEK_LEAD.youtube, play: true })
  })

  it("plays from where the host is, after a jump", () => {
    expect(followAction(input({ paused: true, position: 0 }))).toEqual({
      seek: 10,
      play: true,
    })
  })
})

describe("followAction, paused", () => {
  it("pauses where the host paused", () => {
    expect(followAction(input({ playing: false, position: 10.04 }))).toEqual({
      pause: true,
    })
    // Paused a little later than the host: back where it paused.
    expect(
      followAction(input({ playing: false, position: 10.12, rate: 1.05 })),
    ).toEqual({ pause: true, rate: 1, seek: 10 })
    // YouTube's player, only beyond a quarter of a second.
    expect(
      followAction(input({ kind: "youtube", playing: false, position: 10.2 })),
    ).toEqual({ pause: true })
    expect(
      followAction(input({ kind: "youtube", playing: false, position: 10.3 })),
    ).toEqual({ pause: true, seek: 10 })
  })

  it("follows the host back to the start, at once", () => {
    expect(
      followAction(
        input({ playing: false, paused: true, target: 0, sinceSeek: 10 }),
      ),
    ).toEqual({ seek: 0 })
  })

  it("stays at its end once the host's video is over", () => {
    expect(
      followAction(input({ target: 60, position: 60, ended: true })),
    ).toEqual({})
    // Over on the phone a moment before the host: it does not start again.
    expect(
      followAction(input({ target: 59.4, position: 60, ended: true })),
    ).toEqual({})
    // The host went back: it plays again from there.
    expect(
      followAction(input({ target: 2, position: 60, ended: true })),
    ).toEqual({ seek: 2, play: true })
  })

  it("plays nothing in a hidden page, and catches up once shown", () => {
    expect(followAction(input({ visible: false, position: 4 }))).toEqual({
      pause: true,
    })
    expect(
      followAction(input({ visible: true, paused: true, position: 4 })),
    ).toEqual({ seek: 10, play: true })
  })

  it("leaves a player that failed alone", () => {
    expect(followAction(input({ failed: true, position: 0 }))).toEqual({})
  })
})
