import { youtubeVideoOf, youtubeWatchUrl } from "@razzia/common/utils/youtube"
import {
  loadYoutubeApi,
  YOUTUBE_FAILURES,
  YOUTUBE_PLAYER_HOST,
  type YoutubeFailure,
  youtubeFailureOf,
  youtubeFailureOfPage,
  youtubePageStatus,
  type YoutubePlayer,
  youtubePlayerVars,
  watchReady,
} from "@razzia/web/features/game/media/youtube-api"
import { useEffect, useRef } from "react"

interface Props {
  url: string
  // Names the player for assistive technologies.
  label: string
  // The player cannot play the video, and why (YOUTUBE_FAILURES).
  onError: (_failure: YoutubeFailure) => void
}

/**
 * The editor's preview of a YouTube video: YouTube's own player, from
 * youtube-nocookie.com, where the link says the video starts, never playing
 * by itself. Loaded as soon as the link is pasted, so a video its player
 * refuses is found before the game: a video its owner keeps to YouTube, one
 * removed or private, a player YouTube refuses. YouTube says the same of a
 * removed video and of one kept to YouTube: its page tells which. A player
 * whose page never comes (a proxy that blocks youtube-nocookie.com) says
 * YouTube does not answer.
 */
const YoutubePreview = ({ url, label, onError }: Props) => {
  const hostRef = useRef<HTMLDivElement>(null)
  const errorRef = useRef(onError)
  const labelRef = useRef(label)
  const video = youtubeVideoOf(url)
  const id = video?.id
  const start = video?.start ?? 0

  useEffect(() => {
    errorRef.current = onError
    labelRef.current = label
  })

  useEffect(() => {
    const host = hostRef.current

    if (!host || id === undefined) {
      return
    }

    const controller = new AbortController()
    const mount = document.createElement("div")
    let player: YoutubePlayer | null = null
    let stopWatchingReady: (() => void) | undefined = undefined

    const fail = async (failure: YoutubeFailure) => {
      const told =
        failure === YOUTUBE_FAILURES.NOT_EMBEDDABLE
          ? youtubeFailureOfPage(
              await youtubePageStatus(
                youtubeWatchUrl({ id, start: 0 }),
                controller.signal,
              ),
            )
          : failure

      if (!controller.signal.aborted) {
        errorRef.current(told)
      }
    }

    host.append(mount)
    loadYoutubeApi()
      .then((api) => {
        if (controller.signal.aborted) {
          return
        }

        player = new api.Player(mount, {
          host: YOUTUBE_PLAYER_HOST,
          videoId: id,
          width: "100%",
          height: "100%",
          playerVars: youtubePlayerVars(start, { projected: false }),
          events: {
            onReady: () => {
              stopWatchingReady?.()

              if (player && !controller.signal.aborted) {
                player.getIframe().title = labelRef.current
              }
            },
            onError: ({ data }) => {
              void fail(youtubeFailureOf(data))
            },
          },
        })
        stopWatchingReady = watchReady(
          () => host.isConnected,
          () => {
            void fail(YOUTUBE_FAILURES.UNREACHABLE)
          },
        )
      })
      .catch(() => {
        void fail(YOUTUBE_FAILURES.UNREACHABLE)
      })

    return () => {
      controller.abort()
      stopWatchingReady?.()

      try {
        player?.destroy()
      } catch {
        // Its page already gone.
      }

      host.replaceChildren()
    }
  }, [id, start])

  return (
    <div
      ref={hostRef}
      className="aspect-video w-full max-w-[calc(15rem*16/9)] overflow-hidden rounded-md bg-black [&_iframe]:block"
    />
  )
}

export default YoutubePreview
