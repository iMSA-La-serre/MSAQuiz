import type { MediaPlaybackState } from "@razzia/web/features/game/media/controller"
import { PlaybackRelay } from "@razzia/web/features/game/media/relay"
import { describe, expect, it } from "vitest"

const state = (over: Partial<MediaPlaybackState>): MediaPlaybackState => ({
  key: "game/1/film.mp4",
  source: { kind: "video", url: "film.mp4" },
  element: null,
  playing: false,
  position: 0,
  duration: 60,
  ended: false,
  blocked: false,
  failed: false,
  failure: null,
  started: false,
  played: false,
  muted: false,
  ...over,
})

const setup = () => {
  let now = 0
  const sent: Array<[boolean, number]> = []
  const relay = new PlaybackRelay(
    (playing, position) => {
      sent.push([playing, position])
    },
    () => now,
  )

  return {
    relay,
    sent,
    wait: (ms: number) => {
      now += ms
    },
  }
}

describe("PlaybackRelay", () => {
  it("tells where a video stands once loaded, then when it really plays and when it pauses", () => {
    const { relay, sent, wait } = setup()

    relay.update(state({}))
    relay.update(state({ playing: true, position: 0 }))
    wait(250)
    relay.update(state({ playing: true, position: 0.2 }))
    wait(3000)
    relay.update(state({ playing: true, position: 3.25 }))
    relay.update(state({ playing: false, position: 3.26 }))

    expect(sent).toEqual([
      [false, 0],
      [true, 0.2],
      [false, 3.26],
    ])
  })

  it("never tells a play that does not start: a player that buffers, or that the browser refuses to start", () => {
    const { relay, sent, wait } = setup()

    relay.update(state({ position: 10 }))
    relay.update(state({ playing: true, position: 10 }))
    wait(1000)
    relay.update(state({ playing: true, position: 10 }))
    relay.update(state({ blocked: true, position: 10 }))

    expect(sent).toEqual([[false, 10]])
  })

  it("tells nothing while the video plays where the phones count it", () => {
    const { relay, sent, wait } = setup()

    relay.update(state({ playing: true, position: 5 }))

    for (let second = 1; second <= 20; second += 1) {
      wait(1000)
      relay.update(state({ playing: true, position: 5 + second + 0.05 }))
    }

    expect(sent).toEqual([[true, 6.05]])
  })

  it("tells where it is once it drifts: a jump, back to the start, a video that buffers", () => {
    const { relay, sent, wait } = setup()

    relay.update(state({ playing: true, position: 5 }))
    wait(1000)
    relay.update(state({ playing: true, position: 40 }))
    wait(1000)
    // Buffering: the host's video stands still for most of a second.
    relay.update(state({ playing: true, position: 40.2 }))
    wait(500)
    relay.update(state({ playing: true, position: 40.65 }))
    relay.update(state({ playing: true, position: 0 }))

    expect(sent).toEqual([
      [true, 40],
      [true, 40.2],
      [true, 0],
    ])
  })

  it("tells a move made while paused", () => {
    const { relay, sent } = setup()

    relay.update(state({ position: 30 }))
    relay.update(state({ position: 30.05 }))
    relay.update(state({ position: 0 }))

    expect(sent).toEqual([
      [false, 30],
      [false, 0],
    ])
  })

  it("tells the next video's state, and everything again once reset", () => {
    const { relay, sent } = setup()
    const next = "game/2/film.mp4"

    relay.update(state({ playing: true, position: 5 }))
    relay.update(state({ playing: true, position: 5.3 }))
    relay.update(state({ key: null, playing: false }))
    relay.update(state({ key: next, playing: true, position: 5 }))
    relay.update(state({ key: next, playing: true, position: 5.2 }))
    relay.reset()
    relay.update(state({ key: next, playing: true, position: 5.5 }))
    relay.update(state({ key: next, playing: true, position: 5.8 }))

    expect(sent).toEqual([
      [true, 5.3],
      [true, 5.2],
      [true, 5.8],
    ])
  })
})
