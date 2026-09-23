import type { TimedMediaType } from "@razzia/common/types/game"

/** A media the host plays: a video or a sound file, by its address. */
export interface MediaSource {
  kind: TimedMediaType
  url: string
}

/**
 * One player of one media: the <video> or <audio> element of a file
 * (file-driver.ts). Another kind of player (an embedded video site's) only
 * needs to be another driver: the controller, the controls and the screens
 * stay the same.
 */
export interface MediaDriver {
  // What the stage shows: a box holding the player, created once, which the
  // screens of the question hand over to one another (see stage.ts): moved,
  // never taken out of the page, so a <video> plays on, and an <iframe> (an
  // embedded video site's player) keeps its page, where the browser can
  // move an element without reloading it (Element.moveBefore). The box goes
  // full screen, not the player in it.
  readonly element: HTMLElement
  readonly paused: boolean
  readonly ended: boolean
  // Seconds from the start.
  readonly position: number
  // Seconds, null until known.
  readonly duration: number | null
  // The media could not be loaded or read.
  readonly failed: boolean
  // Resolves once playing; rejects with a NotAllowedError when the browser
  // refuses to play without a gesture on the page (autoplay policy).
  play: () => Promise<void>
  pause: () => void
  seek: (_seconds: number) => void
  // Names the player for assistive technologies.
  setLabel: (_label: string) => void
  destroy: () => void
}

// A driver tells the controller whenever its player changes (position, play,
// pause, end, length known, failure).
export type CreateDriver = (
  _source: MediaSource,
  _onChange: () => void,
) => MediaDriver

/**
 * Where the host was in a media, whether it was playing, and whether it ever
 * played: a media that never did still starts with the answers.
 */
export interface PlaybackMemoryEntry {
  position: number
  playing: boolean
  played: boolean
}

/**
 * Keeps where the host was in the media of the current question, so a reload
 * of the projected screen picks it up where it was (sessionMemory).
 */
export interface PlaybackMemory {
  read: (_key: string) => PlaybackMemoryEntry | null
  write: (_key: string, _entry: PlaybackMemoryEntry) => void
  clear: () => void
}

export interface MediaPlaybackState {
  // The media loaded, and the question it belongs to; null when none is.
  key: string | null
  source: MediaSource | null
  // The player the stage shows, see MediaDriver.element.
  element: HTMLElement | null
  playing: boolean
  position: number
  duration: number | null
  ended: boolean
  // The browser refused to play without a gesture (a reload of the projected
  // screen): the host has to press play.
  blocked: boolean
  failed: boolean
  // Started at least once, by the host or when its screen started it (the
  // browser may have refused): a later screen of the same question never
  // starts it again.
  started: boolean
  // Actually played at least once: « Reprendre » rather than « Lancer ».
  played: boolean
}

const IDLE: MediaPlaybackState = {
  key: null,
  source: null,
  element: null,
  playing: false,
  position: 0,
  duration: null,
  ended: false,
  blocked: false,
  failed: false,
  started: false,
  played: false,
}

// How far the position moves before it is kept again while playing.
const MEMORY_STEP = 1

const isNotAllowed = (error: unknown) =>
  error instanceof Error && error.name === "NotAllowedError"

/**
 * The one media the projected screen plays, driven by the host: play, pause,
 * back to the start, from the reading time to the distribution of its
 * question, whatever screen shows it. Every command goes through here, and
 * every change of the player comes back through `subscribe`, which is what a
 * copy of the playback elsewhere (the phones) would follow.
 */
export class MediaController {
  private readonly createDriver: CreateDriver
  private readonly memory: PlaybackMemory
  private driver: MediaDriver | null = null
  private state: MediaPlaybackState = IDLE
  private readonly listeners = new Set<() => void>()
  // Whether the host wants the media playing: kept, with the position, for a
  // reload. A play the browser blocked still counts.
  private intent = false
  private keptPosition = 0
  // The question's wording, which names the player.
  private label = ""

  constructor(createDriver: CreateDriver, memory: PlaybackMemory) {
    this.createDriver = createDriver
    this.memory = memory
  }

  getState = (): MediaPlaybackState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Loads the media of a question, nothing if it is loaded already. Where the
   * host was in it before a reload is picked up: the same position, playing
   * again if it was (the browser may refuse, see `blocked`).
   */
  load(key: string, source: MediaSource): void {
    if (this.state.key === key && this.driver) {
      return
    }

    this.drop()

    const saved = this.memory.read(key)
    const driver = this.createDriver(source, this.sync)

    driver.setLabel(this.label)
    this.driver = driver
    this.intent = saved?.playing ?? false
    this.keptPosition = saved?.position ?? 0
    this.state = {
      ...IDLE,
      key,
      source,
      element: driver.element,
      position: saved?.position ?? 0,
      // Only a media that really played is never started again: a click on
      // « Revenir au début » before it ever did keeps it starting with the
      // answers after a reload.
      started: saved?.played ?? false,
      played: saved?.played ?? false,
    }

    if (saved && saved.position > 0) {
      driver.seek(saved.position)
    }

    this.emit()

    if (saved?.playing) {
      void this.play()
    }
  }

  /** Starts the media, once: never after the host or a screen played it. */
  autoplay(): void {
    if (this.driver && !this.state.started) {
      void this.play()
    }
  }

  async play(): Promise<void> {
    const { driver } = this

    if (!driver) {
      return
    }

    this.intent = true
    this.set({ started: true, blocked: false })
    this.remember()

    try {
      await driver.play()
    } catch (error) {
      // Released or replaced meanwhile: nothing to tell.
      if (driver !== this.driver) {
        return
      }

      // Anything else (a pause that came first, a file that cannot be read)
      // shows through the driver's own state.
      if (isNotAllowed(error)) {
        this.set({ blocked: true })
      }
    }

    this.sync()
  }

  pause(): void {
    if (!this.driver) {
      return
    }

    this.intent = false
    this.driver.pause()
    this.set({ blocked: false })
    this.sync()
    this.remember()
  }

  toggle(): void {
    if (this.state.playing) {
      this.pause()
    } else {
      void this.play()
    }
  }

  /** Moves to `seconds` from the start, playing on or paused as it was. */
  seek(seconds: number): void {
    if (!this.driver) {
      return
    }

    this.driver.seek(Math.max(0, seconds))
    this.sync()
    this.remember()
  }

  restart(): void {
    this.seek(0)
  }

  /** Names the player for assistive technologies: the question's wording. */
  setLabel(label: string): void {
    this.label = label
    this.driver?.setLabel(label)
  }

  /** Loads the same media again, after it failed to load. */
  retry(): void {
    const { key, source } = this.state

    if (key && source) {
      this.drop()
      this.load(key, source)
    }
  }

  /**
   * Drops the player, but keeps where the host was: the screen is going away
   * (leaving the game's page), or mounting again (a development re-render).
   */
  release(): void {
    this.drop()
    this.emit()
  }

  /** The question's media is over: drops the player and forgets it. */
  finish(): void {
    if (this.state.key !== null) {
      this.memory.clear()
    }

    this.release()
  }

  private drop(): void {
    this.driver?.destroy()
    this.driver = null
    this.intent = false
    this.state = IDLE
  }

  private set(change: Partial<MediaPlaybackState>): void {
    this.state = { ...this.state, ...change }
    this.emit()
  }

  private emit(): void {
    this.listeners.forEach((listener) => {
      listener()
    })
  }

  // Keeps where the host is and whether it wants the media playing.
  private remember(): void {
    const { key, position, played } = this.state

    if (key === null) {
      return
    }

    this.keptPosition = position
    this.memory.write(key, { position, playing: this.intent, played })
  }

  // Reads the driver after any change of its player.
  private readonly sync = (): void => {
    const { driver } = this

    if (!driver) {
      return
    }

    const playing = !driver.paused && !driver.ended
    const previous = this.state
    const next: MediaPlaybackState = {
      ...previous,
      playing,
      position: driver.position,
      duration: driver.duration,
      ended: driver.ended,
      failed: driver.failed,
      // Playing at last (a click on the page, a second try): no longer
      // blocked.
      blocked: previous.blocked && !playing,
      started: previous.started || playing,
      played: previous.played || playing,
    }

    // Stopped on its own (its end, the browser's media keys): the host no
    // longer wants it playing. Playing on its own: the host does.
    const stopped = previous.playing && !playing
    const intentChanged = (stopped && this.intent) || (playing && !this.intent)

    if (intentChanged) {
      this.intent = playing
    }

    const unchanged =
      next.playing === previous.playing &&
      next.position === previous.position &&
      next.duration === previous.duration &&
      next.ended === previous.ended &&
      next.failed === previous.failed &&
      next.blocked === previous.blocked &&
      next.started === previous.started &&
      next.played === previous.played

    if (!unchanged) {
      this.state = next
      this.emit()
    }

    if (
      intentChanged ||
      next.played !== previous.played ||
      Math.abs(next.position - this.keptPosition) >= MEMORY_STEP
    ) {
      this.remember()
    }
  }
}
