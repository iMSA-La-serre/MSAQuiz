import { QUESTION_TYPES } from "@razzia/common/constants"
import type { StatusMedia } from "@razzia/common/types/game"
import { STATUS, type StatusDataMap } from "@razzia/common/types/game/status"
import { isTimedMedia } from "@razzia/common/utils/media"
import type { MediaSource } from "@razzia/web/features/game/media/controller"
import type { Status } from "@razzia/web/features/game/utils/createStatus"

export interface HostMediaPlan {
  source: MediaSource
  // Whether this screen starts it (once, see MediaController.autoplay).
  autoplay: boolean
  // Names the player: the question's wording.
  label: string
}

// A video or a sound with its address, which only the host gets.
const sourceOf = ({ media }: { media?: StatusMedia }): MediaSource | null =>
  media?.url !== undefined && isTimedMedia(media.type)
    ? { kind: media.type, url: media.url }
    : null

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
