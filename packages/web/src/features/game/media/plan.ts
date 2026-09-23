import {
  MEDIA_PLAYBACK,
  MEDIA_TYPES,
  QUESTION_TYPES,
} from "@razzia/common/constants"
import type { MediaSyncState, StatusMedia } from "@razzia/common/types/game"
import { STATUS, type StatusDataMap } from "@razzia/common/types/game/status"
import {
  isTimedMedia,
  isVideoMedia,
  youtubeOfMedia,
} from "@razzia/common/utils/media"
import type { MediaSource } from "@razzia/web/features/game/media/controller"
import type { DevicePlan } from "@razzia/web/features/game/media/device-media"
import type { FollowedKind } from "@razzia/web/features/game/media/follow"
import type { Status } from "@razzia/web/features/game/utils/createStatus"

export interface HostMediaPlan {
  source: MediaSource
  // Whether this screen starts it (once, see MediaController.autoplay).
  autoplay: boolean
  // Names the player: the question's wording.
  label: string
  // A video that plays on every device too, in step with this screen.
  devices: boolean
}

/**
 * A video or a sound with its address, which only the host gets. A YouTube
 * video starts where its link says. A YouTube video's link stored as a video
 * file (the editor once let it through) plays as the YouTube video it is
 * (youtubeOfMedia; the server sends it as one, see playedMedia).
 */
export const sourceOf = ({
  media,
}: {
  media?: StatusMedia
}): MediaSource | null => {
  if (media?.url === undefined || !isTimedMedia(media.type)) {
    return null
  }

  const youtube = youtubeOfMedia(media)

  if (media.type === MEDIA_TYPES.YOUTUBE || youtube) {
    return {
      kind: MEDIA_TYPES.YOUTUBE,
      url: media.url,
      start: youtube?.start ?? 0,
    }
  }

  return { kind: media.type, url: media.url }
}

/**
 * Whether a status's media is a video that plays on every device, driven by
 * the host: the host's copy and the phones' say so alike.
 */
export const isDevicesMedia = (media: StatusMedia | undefined): boolean =>
  media?.playback === MEDIA_PLAYBACK.DEVICES && isVideoMedia(media.type)

/**
 * What the projected screen does with the video or the sound of the status it
 * shows. Loaded while the question is read, it starts when answers open, as
 * soon as it shows on a slide; it stays, playing or paused where it was, on
 * the distribution, until the host moves on. Null on any other screen, or
 * without such a media: the player is then dropped.
 */
export const hostMediaPlan = (
  status: Status<StatusDataMap> | null,
): HostMediaPlan | null => {
  switch (status?.name) {
    case STATUS.SHOW_QUESTION: {
      const source = sourceOf(status.data)

      return (
        source && {
          source,
          autoplay: status.data.questionType === QUESTION_TYPES.SLIDE,
          label: status.data.question,
          devices: isDevicesMedia(status.data.media),
        }
      )
    }

    case STATUS.SELECT_ANSWER: {
      const source = sourceOf(status.data)

      return (
        source && {
          source,
          autoplay: true,
          label: status.data.question,
          devices: isDevicesMedia(status.data.media),
        }
      )
    }

    case STATUS.SHOW_RESPONSES: {
      const source = sourceOf(status.data)

      return (
        source && {
          source,
          autoplay: false,
          label: status.data.question,
          devices: isDevicesMedia(status.data.media),
        }
      )
    }

    default:
      return null
  }
}

/**
 * Tells one question of one game from another: the same file on two questions
 * plays anew, a reload of the same question picks it up where it was.
 */
export const hostMediaKey = (
  gameId: string | null,
  questionNumber: number | undefined,
  url: string,
) => `${gameId ?? ""}/${questionNumber ?? 0}/${url}`

// The waiting screen of a player who answered (RoundManager.selectAnswer).
const ANSWER_SENT = "game:waitingForAnswers"

/** Tells one question's video from another's, on a phone. */
export const deviceMediaKey = (
  gameId: string | null,
  question: number | undefined,
  url: string,
) => `${gameId ?? ""}/${question ?? 0}/${url}`

/**
 * What a phone shows of a status's media when it is a video that plays on
 * every device: a file by its address, a YouTube video from where its link
 * starts. Null for any other media.
 */
export const devicePlanOf = (
  media: StatusMedia | undefined,
  {
    gameId,
    question,
    label,
  }: { gameId: string | null; question: number | undefined; label: string },
): DevicePlan | null => {
  const source = isDevicesMedia(media) ? sourceOf({ media }) : null

  if (!source || !isVideoMedia(source.kind)) {
    return null
  }

  return {
    key: deviceMediaKey(gameId, question, source.url),
    question: question ?? 0,
    source: { ...source, kind: source.kind as FollowedKind },
    label,
  }
}

/** What a phone knows, besides its screen, to follow the video. */
export interface DevicePlanContext {
  gameId: string | null
  // The question, as GameUpdateQuestion.current counts them.
  question: number | undefined
  // What the phone showed so far.
  previous: DevicePlan | null
  // The server's last word, and the name of a player found there.
  state: MediaSyncState | null
  label: string
}

/**
 * What a phone shows of the video that plays on every device, from the
 * status it shows: the question's, from the reading time on; still on the
 * waiting screen once its player answered, and on its result, as the
 * projected screen keeps it on the distribution, until the host moves on.
 * Those two screens do not carry the media: the one the phone had
 * (`previous`, while the question is the same), or else, after a reload,
 * the one the server's word carries (`state`), named `label`. Null anywhere
 * else: the player is then dropped.
 */
export const devicePlan = (
  status: Status<StatusDataMap> | null,
  { gameId, question, previous, state, label }: DevicePlanContext,
): DevicePlan | null => {
  if (
    status?.name === STATUS.SHOW_QUESTION ||
    status?.name === STATUS.SELECT_ANSWER
  ) {
    return devicePlanOf(status.data.media, {
      gameId,
      question,
      label: status.data.question,
    })
  }

  const after =
    status?.name === STATUS.SHOW_RESULT ||
    (status?.name === STATUS.WAIT && status.data.text === ANSWER_SENT)

  if (!after || question === undefined) {
    return null
  }

  if (previous?.question === question) {
    return previous
  }

  return state?.question === question
    ? devicePlanOf(state.media, { gameId, question, label })
    : null
}
