import {
  CLOCK_MAX_AGE,
  CLOCK_SAMPLES,
  measureServerClock,
  ServerClock,
} from "@razzia/web/features/game/media/server-clock"
import { describe, expect, it } from "vitest"

const setup = () => {
  let local = 1000
  const clock = new ServerClock({
    local: () => local,
    epoch: () => 1_790_000_000_000,
  })

  return {
    clock,
    local: () => local,
    advance: (ms: number) => {
      local += ms
    },
  }
}

describe("ServerClock", () => {
  it("guesses the phone's own time until the server answered", () => {
    const { clock } = setup()

    expect(clock.now()).toBe(1_790_000_000_000)
    expect(clock.isStale()).toBe(true)
  })

  it("places the server's time halfway through the round trip", () => {
    const { clock, advance } = setup()

    // Asked at 1000, answered at 1100: the server said 5000 in between.
    clock.record(1000, 5000, 1100)
    expect(clock.rtt).toBe(100)
    expect(clock.now()).toBe(1000 + 3950)
    advance(2000)
    expect(clock.now()).toBe(3000 + 3950)
  })

  it("keeps the shortest round trip, which tells it best", () => {
    const { clock } = setup()

    clock.record(1000, 5000, 1400)
    clock.record(2000, 5980, 2040)
    clock.record(3000, 7100, 3300)

    expect(clock.rtt).toBe(40)
    expect(clock.now() - 1000).toBe(5980 - 2020)
  })

  it("takes a new measure once the kept one is old", () => {
    const { clock, advance, local } = setup()

    clock.record(1000, 5000, 1010)
    advance(CLOCK_MAX_AGE + 20)
    expect(clock.isStale()).toBe(true)

    // A longer round trip than the old measure's, which it replaces.
    clock.record(local(), 90_000, local() + 300)
    expect(clock.rtt).toBe(300)
    expect(clock.isStale()).toBe(false)
  })

  it("keeps its measure in doubt after a change, until the next round trip replaces it", () => {
    const { clock, advance, local } = setup()

    clock.record(1000, 5000, 1100)
    clock.doubt()

    expect(clock.pending).toBe(true)
    expect(clock.isStale()).toBe(true)
    // Still the measure's time, never the phone's own.
    expect(clock.now()).toBe(1000 + 3950)

    // The next round trip, whatever its length.
    advance(1000)
    clock.record(local(), 6100, local() + 400)
    expect(clock.pending).toBe(false)
    expect(clock.isStale()).toBe(false)
    expect(clock.rtt).toBe(400)
    expect(clock.now()).toBe(local() + 6100 - (local() + 200))
  })

  it("follows the kept measure again when no round trip answered, as an old one", () => {
    const { clock } = setup()

    clock.record(1000, 5000, 1100)
    clock.doubt()
    clock.settle()

    expect(clock.pending).toBe(false)
    expect(clock.now()).toBe(1000 + 3950)
    expect(clock.isStale()).toBe(true)
  })
})

describe("measureServerClock", () => {
  it("asks CLOCK_SAMPLES times, skipping a request with no answer", async () => {
    const { clock, local, advance } = setup()
    let asked = 0
    let recorded = 0

    await measureServerClock({
      clock,
      ask: () => {
        asked += 1
        advance(asked === 3 ? 20 : 80)

        return asked === 2
          ? Promise.reject(new Error("timeout"))
          : Promise.resolve(local() + 10_000)
      },
      local,
      wait: (ms) => {
        advance(ms)

        return Promise.resolve()
      },
      onRecord: () => {
        recorded += 1
      },
    })

    expect(asked).toBe(CLOCK_SAMPLES)
    expect(recorded).toBe(CLOCK_SAMPLES - 1)
    expect(clock.rtt).toBe(20)
  })
})
