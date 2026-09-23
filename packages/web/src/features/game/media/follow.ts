import { MEDIA_TYPES } from "@razzia/common/constants"
import type { MediaSyncState } from "@razzia/common/types/game"

// How a phone keeps its player in step with the host's screen.
export const FOLLOW = {
  // Milliseconds between two checks.
  TICK: 500,
  // Seconds apart, playing, beyond which the phone jumps to where the host
  // is.
  SEEK_DRIFT: 1,
  // Seconds apart, paused, beyond which it jumps too: a file stops where the
  // host's did; YouTube's player may stop a little off where it was sent,
  // and would be sent there again and again.
  PAUSED_DRIFT: { video: 0.05, youtube: 0.25 },
  // A file: seconds apart beyond which it plays a little faster or slower,
  // and a little more beyond the second.
  RATE_DRIFT: 0.05,
  FAST_DRIFT: 0.25,
  SLIGHT_RATE: 0.05,
  FAST_RATE: 0.1,
  // Milliseconds between two jumps: the player needs a moment to play from
  // there (YouTube longer, and an ad on a phone would keep it anyway).
  SEEK_COOLDOWN: { video: 1500, youtube: 4000 },
  // Seconds a jump lands ahead of where the host is: YouTube's player takes
  // about that long to play from there.
  SEEK_LEAD: { video: 0, youtube: 0.3 },
  // Seconds before its end within which the host's video counts as over.
  END_MARGIN: 0.25,
} as const

export type FollowedKind = (typeof MEDIA_TYPES)["VIDEO" | "YOUTUBE"]

/**
 * Where the video should be on a phone, in seconds, at `serverNow` on the
 * server's clock: where the host last put it, plus the time gone by since
 * while it plays; never past its end once known.
 */
export const targetOf = (
  state: Pick<MediaSyncState, "playing" | "position" | "at">,
  serverNow: number,
  duration: number | null = null,
): number => {
  const position = state.playing
    ? state.position + Math.max(0, serverNow - state.at) / 1000
    : state.position

  return duration === null ? position : Math.min(position, duration)
}

export interface FollowInput {
  kind: FollowedKind
  // Where the video should be (targetOf), and whether it should play.
  target: number
  playing: boolean
  // The phone's player.
  paused: boolean
  ended: boolean
  position: number
  duration: number | null
  // The browser refused to play it without a tap: its user has to.
  blocked: boolean
  failed: boolean
  // Its speed now.
  rate: number
  // Milliseconds since the phone last moved it.
  sinceSeek: number
  // The page is shown: a hidden page plays nothing (YouTube forbids playing
  // in the background), and catches up once shown again.
  visible: boolean
}

export interface FollowAction {
  play?: true
  pause?: true
  seek?: number
  rate?: number
}

const rateFor = (drift: number): number => {
  const gap = Math.abs(drift)

  if (gap <= FOLLOW.RATE_DRIFT) {
    return 1
  }

  const change = gap > FOLLOW.FAST_DRIFT ? FOLLOW.FAST_RATE : FOLLOW.SLIGHT_RATE

  // Ahead: slower; behind: faster.
  return drift > 0 ? 1 - change : 1 + change
}

/**
 * What the phone does to its player to follow the host's screen: play or
 * pause as the host does, from where the host is; playing, beyond
 * FOLLOW.SEEK_DRIFT apart, jump to where the host is (not more often than
 * FOLLOW.SEEK_COOLDOWN); a file closer than that plays a little faster or
 * slower until it is back in step, YouTube's player only jumps. Its user
 * never pauses it: a player paused by anything else plays again, unless the
 * browser refused to play it without a tap.
 */
export const followAction = (input: FollowInput): FollowAction => {
  const action: FollowAction = {}

  if (input.failed) {
    return action
  }

  const end =
    input.duration === null
      ? null
      : Math.max(0, input.duration - FOLLOW.END_MARGIN)
  const goal =
    input.duration === null
      ? input.target
      : Math.min(input.target, input.duration)
  const drift = input.position - goal
  // The host's video is over, or about to be where the phone's already is:
  // played again, a video over would start from the beginning.
  const over =
    end !== null &&
    (input.target >= end || (input.ended && drift <= FOLLOW.SEEK_DRIFT))

  if (!input.playing || !input.visible || over) {
    if (!input.paused && !input.ended) {
      action.pause = true
    }

    if (input.rate !== 1) {
      action.rate = 1
    }

    // Hidden, it catches up once shown. Over, a player at its end stays.
    const still = !input.visible || (over && input.ended)

    if (!still && Math.abs(drift) > FOLLOW.PAUSED_DRIFT[input.kind]) {
      action.seek = goal
    }

    return action
  }

  const canSeek = input.sinceSeek >= FOLLOW.SEEK_COOLDOWN[input.kind]
  // Paused, it starts: from where the host is, as when paused.
  const starting = (input.paused || input.ended) && !input.blocked
  const apart = starting ? FOLLOW.PAUSED_DRIFT[input.kind] : FOLLOW.SEEK_DRIFT

  if (Math.abs(drift) > apart && canSeek) {
    const lead = FOLLOW.SEEK_LEAD[input.kind]

    action.seek = end === null ? goal + lead : Math.min(goal + lead, end)

    if (input.rate !== 1) {
      action.rate = 1
    }
  } else if (input.kind === MEDIA_TYPES.VIDEO) {
    const rate = rateFor(drift)

    if (rate !== input.rate) {
      action.rate = rate
    }
  }

  if (starting) {
    action.play = true
  }

  return action
}
