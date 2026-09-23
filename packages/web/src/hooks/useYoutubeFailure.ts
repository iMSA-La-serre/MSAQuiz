import { youtubeVideoOf, youtubeWatchUrl } from "@razzia/common/utils/youtube"
import {
  YOUTUBE_FAILURES,
  type YoutubeFailure,
  youtubeFailureOfPage,
  youtubePageStatus,
} from "@razzia/web/features/game/media/youtube-api"
import { useEffect, useSyncExternalStore } from "react"

// What a video itself tells: never the network (unreachable), the quiz's
// site (refused) nor a link (invalid), which the open question says.
const OF_THE_VIDEO = new Set<YoutubeFailure>([
  YOUTUBE_FAILURES.NOT_FOUND,
  YOUTUBE_FAILURES.NOT_EMBEDDABLE,
  YOUTUBE_FAILURES.EMBED_DISABLED,
  YOUTUBE_FAILURES.PLAYER,
])

// The answers of YouTube's page of a video that tell it will not play:
// removed, private or mis-copied (400, 404), kept to YouTube (401, 403).
const REFUSED_PAGES = new Set([400, 401, 403, 404])

const failures = new Map<string, YoutubeFailure>()

// The videos whose page was asked, once per page of the editor.
const asked = new Set<string>()

const listeners = new Set<() => void>()

const notify = () => {
  listeners.forEach((listener) => {
    listener()
  })
}

/**
 * YouTube videos that will not play, by their identifier, on this page of
 * the editor: what the preview's player said of the open question, or what
 * YouTube's page of the video said of every question (see askYoutubePage).
 * The list of questions points them out, as it does a broken image.
 */
export const youtubeFailures = {
  get: (id: string) => failures.get(id),
  fail: (id: string, failure: YoutubeFailure) => {
    if (OF_THE_VIDEO.has(failure) && failures.get(id) !== failure) {
      failures.set(id, failure)
      notify()
    }
  },
  // « Réessayer »: its page is asked again, and the preview tells anew.
  forget: (id: string) => {
    asked.delete(id)

    if (failures.delete(id)) {
      notify()
    }
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener)

    return () => {
      listeners.delete(listener)
    }
  },
}

/**
 * Asks YouTube's page of a video (oEmbed, without cookies) whether it will
 * play, once per video on this page of the editor: before the author opens
 * its question. No answer, or any other, tells nothing.
 */
export const askYoutubePage = async (
  id: string,
  pageStatus: (_watchUrl: string) => Promise<number | null> = youtubePageStatus,
) => {
  if (asked.has(id)) {
    return
  }

  asked.add(id)

  const status = await pageStatus(youtubeWatchUrl({ id, start: 0 }))

  if (status !== null && REFUSED_PAGES.has(status) && asked.has(id)) {
    youtubeFailures.fail(id, youtubeFailureOfPage(status))
  }
}

/**
 * Why the YouTube video of `url` will not play, once known; undefined for
 * anything else. Its page is asked as soon as a question shows it.
 */
const useYoutubeFailure = (url: string | undefined) => {
  const id = url === undefined ? undefined : youtubeVideoOf(url)?.id

  useEffect(() => {
    if (id !== undefined) {
      void askYoutubePage(id)
    }
  }, [id])

  return useSyncExternalStore(youtubeFailures.subscribe, () =>
    id === undefined ? undefined : youtubeFailures.get(id),
  )
}

export default useYoutubeFailure
