// How many round trips a measure makes, and how far apart: the shortest
// tells the most.
export const CLOCK_SAMPLES = 5

export const CLOCK_GAP = 150

// A measure older than this is made again before a video is followed: two
// clocks drift apart by a fraction of a second over an hour.
export const CLOCK_MAX_AGE = 60_000

interface Sample {
  // Server time minus the local clock, in milliseconds.
  offset: number
  // The round trip it was measured on.
  rtt: number
  // When, on the local clock.
  at: number
}

export interface ServerClockDeps {
  // A monotonic local clock, in milliseconds (performance.now).
  local: () => number
  // The local clock in milliseconds since 1970 (Date.now): the guess until
  // the server answered.
  epoch: () => number
}

/**
 * The server's clock as a phone estimates it: the server answers with its
 * time, which stood between the moment the phone asked and the moment the
 * answer came, halfway on average. The round trip with the shortest time
 * tells it best (NTP's way): its error is half that round trip at most.
 * Counted on the page's monotonic clock, so a change of the phone's time
 * does not move it.
 */
export class ServerClock {
  private readonly deps: ServerClockDeps
  private best: Sample | null = null
  // The measure is kept but in doubt (see `doubt`), until the next round
  // trip replaces it or a measure ends without an answer.
  private doubtful = false

  constructor(deps: ServerClockDeps) {
    this.deps = deps
  }

  /** One round trip: asked at `sentAt`, answered at `receivedAt`. */
  record(sentAt: number, serverNow: number, receivedAt: number): void {
    const rtt = Math.max(0, receivedAt - sentAt)
    const sample = {
      offset: serverNow - (sentAt + receivedAt) / 2,
      rtt,
      at: receivedAt,
    }

    // A sample as good as the best, or better, replaces it: the newest. The
    // first one after a doubt replaces it whatever its round trip.
    if (!this.best || rtt <= this.best.rtt || this.isStale()) {
      this.best = sample
    }

    this.doubtful = false
  }

  /**
   * The server's time now, in milliseconds since 1970: from the measure,
   * kept while in doubt, or the phone's own time before any.
   */
  now(): number {
    return this.best ? this.deps.local() + this.best.offset : this.deps.epoch()
  }

  /** The round trip of the measure, null before any. */
  get rtt(): number | null {
    return this.best?.rtt ?? null
  }

  /** No measure yet, an old one, or one in doubt: to be made again. */
  isStale(): boolean {
    return (
      this.best === null ||
      this.doubtful ||
      this.deps.local() - this.best.at > CLOCK_MAX_AGE
    )
  }

  /**
   * Whether the measure is in doubt until the next round trip: a phone
   * following the host then keeps its player as it is, rather than move it
   * on a wrong guess.
   */
  get pending(): boolean {
    return this.doubtful && this.best !== null
  }

  /**
   * The connection changed, or the page shows again (a phone's monotonic
   * clock may stop while it sleeps): the measure is kept, still the best
   * guess, and replaced by the next round trip. Never forgotten: the
   * phone's own time may be seconds off the server's.
   */
  doubt(): void {
    this.doubtful = true
  }

  /**
   * A measure ended without any answer: the kept one is followed again, as
   * an old one, which the next measure replaces.
   */
  settle(): void {
    if (this.doubtful && this.best) {
      this.best = { ...this.best, at: Number.NEGATIVE_INFINITY }
    }

    this.doubtful = false
  }
}

export interface ClockMeasure {
  clock: ServerClock
  // Resolves with the server's time.
  ask: () => Promise<number>
  local: () => number
  wait: (_ms: number) => Promise<void>
  // After each answer, recorded.
  onRecord?: () => void
}

/**
 * Measures the server's clock: CLOCK_SAMPLES round trips (`left`),
 * CLOCK_GAP apart, one after the other. A request with no answer is
 * skipped.
 */
export const measureServerClock = async (
  measure: ClockMeasure,
  left: number = CLOCK_SAMPLES,
): Promise<void> => {
  const { clock, ask, local, wait, onRecord } = measure
  const sentAt = local()
  let answered = false

  try {
    const serverNow = await ask()

    clock.record(sentAt, serverNow, local())
    answered = true
  } catch {
    // No answer in time: the other round trips tell.
  }

  if (answered) {
    onRecord?.()
  }

  if (left > 1) {
    await wait(CLOCK_GAP)
    await measureServerClock(measure, left - 1)
  }
}
