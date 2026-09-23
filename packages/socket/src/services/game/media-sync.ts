import { EVENTS, MEDIA_SYNC } from "@razzia/common/constants"
import type {
  MediaControl,
  MediaSyncState,
  QuestionMedia,
} from "@razzia/common/types/game"
import type { Server, Socket } from "@razzia/common/types/game/socket"
import { devicesMediaOf, mediaStartOf } from "@razzia/common/utils/media"

export interface MediaSyncOptions {
  io: Server
  gameId: string
  getManagerId: () => string
  // Whether the player of this clientId is in the game and connected now.
  isConnected: (_clientId: string) => boolean
  now?: () => number
}

interface Throttle {
  // At once, or once the interval since the last is over, as it stands then.
  run: () => void
  // At once, whatever came before.
  flush: () => void
  cancel: () => void
}

// Runs `send` at once, then at most once per `interval`: what comes within
// it is sent once the interval is over, as it stands then.
const throttle = (
  interval: number,
  now: () => number,
  send: () => void,
): Throttle => {
  let last = Number.NEGATIVE_INFINITY
  let timer: ReturnType<typeof setTimeout> | undefined = undefined

  const flush = () => {
    clearTimeout(timer)
    timer = undefined
    last = now()
    send()
  }

  return {
    run: () => {
      const wait = last + interval - now()

      if (wait <= 0) {
        flush()

        return
      }

      timer ??= setTimeout(flush, wait)
    },
    flush,
    cancel: () => {
      clearTimeout(timer)
      timer = undefined
    },
  }
}

/**
 * The video of the current question when it plays on every device
 * (playsOnDevices): where it stands, which the host alone moves, and the
 * players whose phone shows it. The server keeps one state per question,
 * sends it to the players on every change, to a phone that starts showing
 * it, and to a player who comes back or arrives late; it pauses the video
 * for everyone when the host's screen goes away. The host gets how many
 * phones show it, never who.
 */
export class MediaSync {
  private readonly opts: MediaSyncOptions
  private readonly now: () => number
  private state: MediaSyncState | null = null
  // Once the host moved past the question's distribution: nothing moves it
  // any more.
  private over = false
  private seq = 0
  // The players whose phone shows the video, by clientId: a player keeps it
  // from one socket to the next, and says again once back.
  private readonly watchers = new Set<string>()
  private sentViewers: { question: number; count: number } | null = null
  private readonly stateThrottle: Throttle
  private readonly viewersThrottle: Throttle

  constructor(opts: MediaSyncOptions) {
    this.opts = opts
    this.now = opts.now ?? Date.now
    this.stateThrottle = throttle(MEDIA_SYNC.STATE_INTERVAL, this.now, () => {
      this.broadcastState()
    })
    this.viewersThrottle = throttle(
      MEDIA_SYNC.VIEWERS_INTERVAL,
      this.now,
      () => {
        this.sendViewers(false)
      },
    )
  }

  /** Where it stands, or null when the question plays no video everywhere. */
  getState(): MediaSyncState | null {
    return this.state
  }

  /**
   * A question starts (`question` counted from 1): its video, when it plays
   * on every device, stands paused where it starts; any other drops the
   * previous question's.
   */
  begin(question: number, media: QuestionMedia | undefined): void {
    this.watchers.clear()
    this.over = false
    this.stateThrottle.cancel()
    this.viewersThrottle.cancel()

    // As the players get it (publicMedia).
    const shared = devicesMediaOf(media)

    if (!shared) {
      this.state = null

      return
    }

    this.state = {
      question,
      media: shared,
      playing: false,
      position: mediaStartOf(media),
      at: this.now(),
      seq: this.next(),
    }
    this.stateThrottle.flush()
    this.sendViewers(true)
  }

  /** Where the video is at `at`, on the server's clock. */
  positionAt(at: number): number {
    const { state } = this

    if (!state) {
      return 0
    }

    return state.playing
      ? state.position + Math.max(0, at - state.at) / 1000
      : state.position
  }

  /**
   * The host plays, pauses or moves the video: its socket alone, while the
   * question's video can still move.
   */
  control(socket: Socket, { playing, position }: MediaControl): void {
    if (socket.id !== this.opts.getManagerId() || !this.state || this.over) {
      return
    }

    this.set(playing, position)
  }

  /** The host's screen went away: paused for everyone, where it stands. */
  pause(): void {
    if (this.state?.playing) {
      this.set(false, this.positionAt(this.now()))
    }
  }

  /**
   * The host moved past the question's distribution, where its screen drops
   * the video: paused for everyone, for good.
   */
  end(): void {
    this.pause()
    this.over = true
  }

  /**
   * A player's phone starts or stops showing the video: one that starts gets
   * where it stands at once.
   */
  watch(clientId: string, socketId: string, watching: boolean): void {
    if (!this.state) {
      return
    }

    if (watching) {
      this.watchers.add(clientId)
      this.sendStateTo(socketId)
    } else {
      this.watchers.delete(clientId)
    }

    this.viewersThrottle.run()
  }

  /**
   * A player came back on a new socket: where the video stands. Not counted
   * until its phone says it shows the video again (a reloaded page asks its
   * user first).
   */
  playerBack(clientId: string, socketId: string): void {
    this.watchers.delete(clientId)
    this.sendStateTo(socketId)
    this.viewersThrottle.run()
  }

  /** A player left, dropped or was removed: counted again. */
  refreshViewers(): void {
    if (this.state) {
      this.viewersThrottle.run()
    }
  }

  /** The host's screen came back: how many phones show the video. */
  managerBack(): void {
    if (this.state) {
      this.sendViewers(true)
    }
  }

  /** Where the video stands, to one socket (a player who arrives late). */
  sendStateTo(socketId: string): void {
    if (this.state) {
      this.opts.io.to(socketId).emit(EVENTS.GAME.MEDIA_STATE, this.state)
    }
  }

  private next(): number {
    this.seq += 1

    return this.seq
  }

  private set(playing: boolean, position: number): void {
    if (!this.state) {
      return
    }

    this.state = {
      ...this.state,
      playing,
      position: Math.max(0, position),
      at: this.now(),
      seq: this.next(),
    }
    this.stateThrottle.run()
  }

  // To the players, the host aside: its screen is where the state comes
  // from.
  private broadcastState(): void {
    if (this.state) {
      this.opts.io
        .to(this.opts.gameId)
        .except(this.opts.getManagerId())
        .emit(EVENTS.GAME.MEDIA_STATE, this.state)
    }
  }

  private count(): number {
    let count = 0

    this.watchers.forEach((clientId) => {
      if (this.opts.isConnected(clientId)) {
        count += 1
      }
    })

    return count
  }

  // To the host, when the count changed, or whatever it is (`always`).
  private sendViewers(always: boolean): void {
    if (!this.state) {
      return
    }

    const viewers = { question: this.state.question, count: this.count() }
    const sent = this.sentViewers

    if (
      !always &&
      sent?.question === viewers.question &&
      sent.count === viewers.count
    ) {
      return
    }

    this.sentViewers = viewers
    this.opts.io
      .to(this.opts.getManagerId())
      .emit(EVENTS.MANAGER.MEDIA_VIEWERS, viewers)
  }
}
