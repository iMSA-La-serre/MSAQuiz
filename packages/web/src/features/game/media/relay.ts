import type { MediaPlaybackState } from "@razzia/web/features/game/media/controller"

// Seconds apart beyond which the host's player no longer stands where the
// phones think: it buffered, played an ad, or was moved. A file on a phone
// keeps within a few hundredths of the host's (see follow.ts).
export const RELAY_DRIFT = 0.1

// Seconds the host's video moves before it counts as playing: « Lire »
// first makes a player load, or buffer, and the browser may still refuse
// to play it (a reload of the projected screen).
export const RELAY_MOVED = 0.05

interface Told {
  key: string
  playing: boolean
  position: number
  // When, on the local clock (milliseconds).
  at: number
}

/**
 * Tells the server where the host's video stands, for the phones that follow
 * it: when it pauses, when it really plays (it moved since « Lire », so the
 * phones start where it is, never for a player that only buffers or that the
 * browser refuses to start), and when its position is no longer where the
 * last word said it would be (moved, back to the start, or late: a video
 * that buffers). Nothing in between: the phones count the time themselves.
 */
export class PlaybackRelay {
  private told: Told | null = null
  // Where the host's video stood when it was asked to play, until it moves.
  private starting: { key: string; position: number } | null = null
  private readonly send: (_playing: boolean, _position: number) => void
  private readonly now: () => number

  constructor(
    send: (_playing: boolean, _position: number) => void,
    now: () => number,
  ) {
    this.send = send
    this.now = now
  }

  /** Reads the host's player, after any change of it. */
  update({ key, playing, position }: MediaPlaybackState): void {
    if (key === null) {
      return
    }

    const { told } = this
    const now = this.now()
    const same = told?.key === key && told.playing === playing

    if (playing && !same && !this.moved(key, position)) {
      return
    }

    if (!playing) {
      this.starting = null
    }

    if (same) {
      const expected = playing
        ? told.position + (now - told.at) / 1000
        : told.position

      if (Math.abs(position - expected) <= RELAY_DRIFT) {
        return
      }
    }

    this.told = { key, playing, position, at: now }
    this.send(playing, position)
  }

  /** The next reading is told whatever it says (the connection came back). */
  reset(): void {
    this.told = null
    this.starting = null
  }

  // Whether the video asked to play moved since, where it stood first kept.
  private moved(key: string, position: number): boolean {
    if (this.starting?.key !== key) {
      this.starting = { key, position }

      return false
    }

    if (Math.abs(position - this.starting.position) < RELAY_MOVED) {
      return false
    }

    this.starting = null

    return true
  }
}
