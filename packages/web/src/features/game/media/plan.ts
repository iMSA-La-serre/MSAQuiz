import { MEDIA_TYPES, QUESTION_TYPES } from "@razzia/common/constants"
import type { StatusMedia } from "@razzia/common/types/game"
import { STATUS, type StatusDataMap } from "@razzia/common/types/game/status"
import { isTimedMedia, youtubeOfMedia } from "@razzia/common/utils/media"
import type { MediaSource } from "@razzia/web/features/game/media/controller"
import type { Status } from "@razzia/web/features/game/utils/createStatus"

export interface HostMediaPlan {
  source: MediaSource
  // Whether this screen starts it (once, see MediaController.autoplay).
  autoplay: boolean
  // Names the player: the question's wording.
  label: string
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
        }
      )
    }

    case STATUS.SELECT_ANSWER: {
      const source = sourceOf(status.data)

      return source && { source, autoplay: true, label: status.data.question }
    }

    case STATUS.SHOW_RESPONSES: {
      const source = sourceOf(status.data)

      return source && { source, autoplay: false, label: status.data.question }
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
