import { MEDIA_TYPES } from "@razzia/common/constants"
import type { QuestionMedia as QuestionMediaType } from "@razzia/common/types/game"
import YoutubePreview from "@razzia/web/components/YoutubePreview"
import type { YoutubeFailure } from "@razzia/web/features/game/media/youtube-api"

interface Props {
  media?: QuestionMediaType
  alt?: string
  // The address did not load (not found, not a media file); for a YouTube
  // video, why its player refuses it.
  onError?: (_failure?: YoutubeFailure) => void
  // An image loaded.
  onLoad?: () => void
}

// The editor's preview, under the media's settings: nothing plays by itself,
// and the browser is only asked for the length of a video or a sound (preload
// metadata) until the author presses play; a YouTube video shows in
// YouTube's player. 15rem high at most, so the answers stay near.
const QuestionMedia = ({ media, alt = "", onError, onLoad }: Props) => {
  if (media?.type === MEDIA_TYPES.IMAGE) {
    return (
      <img
        alt={alt}
        src={media.url}
        onError={() => {
          onError?.()
        }}
        onLoad={onLoad}
        className="max-h-60 w-auto max-w-full rounded-md"
      />
    )
  }

  if (media?.type === MEDIA_TYPES.VIDEO) {
    return (
      <video
        src={media.url}
        aria-label={alt}
        controls
        playsInline
        preload="metadata"
        onError={() => {
          onError?.()
        }}
        className="aspect-video w-full max-w-[calc(15rem*16/9)] rounded-md bg-black"
      />
    )
  }

  if (media?.type === MEDIA_TYPES.YOUTUBE) {
    return (
      <YoutubePreview
        url={media.url}
        label={alt}
        onError={(failure) => {
          onError?.(failure)
        }}
      />
    )
  }

  if (media?.type === MEDIA_TYPES.AUDIO) {
    return (
      <audio
        src={media.url}
        aria-label={alt}
        controls
        preload="metadata"
        onError={() => {
          onError?.()
        }}
        className="w-full max-w-xl"
      />
    )
  }

  return null
}

export default QuestionMedia
