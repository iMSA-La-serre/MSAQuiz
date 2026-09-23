import type { MediaSyncState } from "@razzia/common/types/game"
import {
  type CreateDriver,
  MediaController,
  type MediaSource,
  type PlaybackMemory,
} from "@razzia/web/features/game/media/controller"
import {
  FOLLOW,
  followAction,
  type FollowedKind,
  targetOf,
} from "@razzia/web/features/game/media/follow"

/** What a phone's screen shows: a video that plays on every device. */
export interface DevicePlan {
  // Tells one question's video from another's (deviceMediaKey).
  key: string
  // The question, as GameUpdateQuestion.current counts them: the server's
  // word about another question is not followed.
  question: number
  source: MediaSource & { kind: FollowedKind }
  // Names the player: the question's wording.
  label: string
}

// « Regarder ici », or « Non, je regarde l'écran ».
export type DeviceChoice = "watch" | "decline"

export interface DeviceMediaSnapshot {
  // The video of the screen shown, and what its user chose; null until
  // they choose.
  key: string | null
  plan: DevicePlan | null
  choice: DeviceChoice | null
  // The host plays it, as the server last said.
  hostPlaying: boolean
  // Asked to play a while ago and still not playing, though the browser said
  // nothing: iOS may keep a player from playing until it is touched.
  stuck: boolean
}

export interface DeviceMediaDeps {
  createDriver: CreateDriver
  // The server's time now, in milliseconds since 1970 (ServerClock.now).
  serverNow: () => number
  // A monotonic local clock, in milliseconds.
  local: () => number
  // Whether the page is shown.
  visible: () => boolean
  // Measures the server's clock again when its measure is old.
  syncClock?: () => void
  // The server's clock in doubt until its next measure (ServerClock.pending):
  // the player stays as it is meanwhile.
  clockPending?: () => boolean
}

// Milliseconds after which a player asked to play and still not playing
// counts as stuck.
export const STUCK_AFTER = 4000

// A phone keeps nothing across a reload: the server says where the video
// stands.
const NO_MEMORY: PlaybackMemory = {
  read: () => null,
  write: () => undefined,
  clear: () => undefined,
}

const NONE: DeviceMediaSnapshot = {
  key: null,
  plan: null,
  choice: null,
  hostPlaying: false,
  stuck: false,
}

/**
 * A phone's copy of the video that plays on every device, which follows the
 * host's screen. Nothing loads until its user taps « Regarder ici »: the
 * player is then created within the tap (iOS plays a video only after one),
 * moved to where the host is, and played if the host plays it. The server's
 * word (MediaSyncState) moves it from then on, and a check every
 * FOLLOW.TICK keeps it in step (followAction). Its user may cut its sound,
 * never pause it. « Non, je regarde l'écran » loads nothing, and « Ne plus
 * regarder ici » drops the player.
 */
export class DeviceMedia {
  readonly controller: MediaController
  private readonly deps: DeviceMediaDeps
  private plan: DevicePlan | null = null
  private choice: DeviceChoice | null = null
  private state: MediaSyncState | null = null
  private rate = 1
  private lastSeek = Number.NEGATIVE_INFINITY
  // When the phone last asked its player to play, while it did not.
  private askedAt: number | null = null
  private timer: ReturnType<typeof setInterval> | undefined = undefined
  private snapshot: DeviceMediaSnapshot = NONE
  private readonly listeners = new Set<() => void>()

  constructor(deps: DeviceMediaDeps) {
    this.deps = deps
    this.controller = new MediaController(deps.createDriver, NO_MEMORY)
  }

  getSnapshot = (): DeviceMediaSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * The video the phone's screen shows now, or none. Another one drops the
   * player and what its user chose.
   */
  show(plan: DevicePlan | null): void {
    if (plan?.key === this.plan?.key) {
      if (plan) {
        this.plan = plan
        this.controller.setLabel(plan.label)
        this.update()
      }

      return
    }

    this.stop()
    this.plan = plan
    this.choice = null

    // Measured while its participant reads the card: in step from the tap
    // on « Regarder ici ».
    if (plan) {
      this.deps.syncClock?.()
    }

    this.update()
  }

  /**
   * « Regarder ici », within its tap: the player comes, where the host is,
   * playing if the host plays it (or allowed to play later, for iOS).
   */
  watch(plan: DevicePlan): void {
    this.show(plan)
    this.choice = "watch"
    this.controller.setLabel(plan.label)
    this.controller.load(plan.key, plan.source)
    this.deps.syncClock?.()
    this.follow(true)
    this.timer ??= setInterval(() => {
      this.refresh()
    }, FOLLOW.TICK)
    this.update()
  }

  /**
   * « Non, je regarde l'écran »: nothing loads. « Ne plus regarder ici »
   * once it plays: its player goes, YouTube's with its frame, so nothing
   * more loads (for YouTube, its user takes the consent back).
   */
  decline(plan: DevicePlan): void {
    if (this.watching && this.plan?.key === plan.key) {
      this.stop()
    }

    this.show(plan)
    this.choice = "decline"
    this.update()
  }

  /** The server's word: where the video stands. */
  receive(state: MediaSyncState): void {
    if (this.state && state.seq <= this.state.seq) {
      return
    }

    this.state = state
    this.follow(false)
    this.update()
  }

  /**
   * Within a tap, when the browser refused to play without one: plays it,
   * from where the host is, when the host plays it. Paused by the host
   * meanwhile, it stays paused, no longer waiting for a tap (the tap let it
   * play later, see follow): it starts again with the host.
   */
  resume(): void {
    this.askedAt = null
    this.follow(true)

    if (this.current()?.playing) {
      void this.controller.play()
    } else {
      this.controller.pause()
    }

    this.update()
  }

  /** Cuts the sound, or gives it back: its user's choice. */
  toggleMute(): void {
    this.controller.setMuted(!this.controller.getState().muted)
  }

  /** Checks at once (the page shown again). */
  refresh(): void {
    this.follow(false)
    this.update()
  }

  /** The server's last word, whatever the question (null before any). */
  lastState(): MediaSyncState | null {
    return this.state
  }

  /** Leaving the game: forgets its video and the server's word about it. */
  reset(): void {
    this.show(null)
    this.state = null
    this.update()
  }

  /** Whether the phone shows the video now. */
  get watching(): boolean {
    return this.choice === "watch" && this.plan !== null
  }

  private stop(): void {
    clearInterval(this.timer)
    this.timer = undefined
    this.rate = 1
    this.lastSeek = Number.NEGATIVE_INFINITY
    this.askedAt = null
    this.controller.finish()
  }

  // The server's word about the question shown, if any.
  private current(): MediaSyncState | null {
    const { plan, state } = this

    return plan && state?.question === plan.question ? state : null
  }

  private follow(gesture: boolean): void {
    const { plan } = this
    const state = this.current()

    if (!plan || this.choice !== "watch") {
      return
    }

    // No word yet, or the server's clock in doubt (but within a tap, which
    // cannot wait): it stays as it is, allowed to play.
    if (!state || (!gesture && this.deps.clockPending?.())) {
      if (gesture) {
        this.controller.unlock()
      }

      return
    }

    const player = this.controller.read()
    const now = this.deps.local()
    const action = followAction({
      kind: plan.source.kind,
      target: targetOf(state, this.deps.serverNow(), player.duration),
      playing: state.playing,
      paused: !player.playing && !player.ended,
      ended: player.ended,
      position: player.position,
      duration: player.duration,
      blocked: player.blocked,
      failed: player.failed,
      rate: this.rate,
      sinceSeek: now - this.lastSeek,
      visible: this.deps.visible(),
    })

    if (action.rate !== undefined) {
      this.rate = action.rate
      this.controller.setRate(action.rate)
    }

    if (action.seek !== undefined) {
      this.lastSeek = now
      this.controller.seek(action.seek)
    }

    if (action.pause) {
      this.controller.pause()
    }

    if (action.play) {
      // Counted once the player is loaded (its length known): a slow
      // network is not a refusal.
      if (player.duration !== null) {
        this.askedAt ??= now
      }

      void this.controller.play()
    } else if (gesture) {
      this.controller.unlock()
    }

    if (player.playing || !state.playing) {
      this.askedAt = null
    }
  }

  private update(): void {
    const state = this.current()
    const next: DeviceMediaSnapshot = {
      key: this.plan?.key ?? null,
      plan: this.plan,
      choice: this.choice,
      hostPlaying: state?.playing ?? false,
      stuck:
        this.askedAt !== null &&
        this.deps.local() - this.askedAt >= STUCK_AFTER,
    }
    const previous = this.snapshot

    if (
      next.plan === previous.plan &&
      next.choice === previous.choice &&
      next.hostPlaying === previous.hostPlaying &&
      next.stuck === previous.stuck
    ) {
      return
    }

    this.snapshot = next
    this.listeners.forEach((listener) => {
      listener()
    })
  }
}
