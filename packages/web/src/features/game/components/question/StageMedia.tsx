import { MEDIA_TYPES } from "@razzia/common/constants"
import type { QuestionMedia } from "@razzia/common/types/game"
import MediaUnavailable from "@razzia/web/components/MediaUnavailable"
import useImageFailure from "@razzia/web/hooks/useImageFailure"
import clsx from "clsx"
import { Music, Play } from "lucide-react"

interface Props {
  media?: QuestionMedia
  // Video or audio that starts with the answers: its space is reserved while
  // the question is read, so nothing moves when answering opens.
  upcomingMedia?: "video" | "audio"
  alt: string
  variant: "host" | "phone"
  // Slide stage: one centred column, so the media may be taller.
  slide?: boolean
}

// A slide's media on the projector: 20rem high at most (32rem on a large
// screen), less when the title, the band and the dock leave less (--title-h,
// set by the stage, see useTitleHeight: 16rem of chrome on a short screen,
// 20rem otherwise), never under 8rem.
const SLIDE_HEIGHT =
  "[--slide-media-h:max(8rem,min(20rem,calc(100dvh_-_20rem_-_var(--title-h,4rem))))] lg:[--slide-media-h:max(8rem,min(32rem,calc(100dvh_-_20rem_-_var(--title-h,4rem))))] short:[--slide-media-h:max(8rem,min(20rem,calc(100dvh_-_16rem_-_var(--title-h,4rem))))] max-h-(--slide-media-h)"

const maxHeight = (variant: Props["variant"], slide = false) => {
  if (variant === "phone") {
    return "max-h-44"
  }

  return slide ? SLIDE_HEIGHT : "max-h-80 lg:max-h-[26rem] short:max-h-56"
}

// A 16:9 frame (a video, its reserved space, an image that did not load). On
// a slide, as wide as its height allows and centred, so the video fills it
// whatever the size of its file, in the same box as the space reserved while
// the slide is read.
const frame = (variant: Props["variant"], slide = false) =>
  clsx(
    "aspect-video w-full rounded-2xl",
    maxHeight(variant, slide),
    slide &&
      variant === "host" &&
      "mx-auto max-w-[calc(var(--slide-media-h)*16/9)]",
  )

// Game-only media block. The editor keeps components/QuestionMedia.tsx.
const StageMedia = ({ media, upcomingMedia, alt, variant, slide }: Props) => {
  const image = media?.type === MEDIA_TYPES.IMAGE ? media : undefined
  const { failed, fail, retry } = useImageFailure(image?.url)
  const height = maxHeight(variant, slide)

  if (image) {
    if (failed) {
      return (
        <MediaUnavailable className={frame(variant, slide)} retry={retry} />
      )
    }

    return (
      <img
        alt={alt}
        src={image.url}
        onError={fail}
        className={clsx(
          "rounded-2xl",
          height,
          // A slide shows the picture at its own size at most, centred.
          slide && variant === "host"
            ? "mx-auto block h-auto w-auto max-w-full"
            : "w-full object-contain",
        )}
      />
    )
  }

  if (media?.type === MEDIA_TYPES.VIDEO) {
    return (
      <video
        src={media.url}
        aria-label={alt}
        autoPlay
        controls
        playsInline
        className={clsx("bg-black/40", frame(variant, slide))}
      />
    )
  }

  if (media?.type === MEDIA_TYPES.AUDIO) {
    return (
      <audio
        src={media.url}
        aria-label={alt}
        autoPlay
        controls
        className="w-full"
      />
    )
  }

  if (upcomingMedia === MEDIA_TYPES.VIDEO) {
    return (
      <div
        aria-hidden
        className={clsx(
          "grid place-items-center bg-black/25",
          frame(variant, slide),
        )}
      >
        <Play className="size-10 text-white/60" />
      </div>
    )
  }

  if (upcomingMedia === MEDIA_TYPES.AUDIO) {
    return (
      <div
        aria-hidden
        className="grid h-14 w-full place-items-center rounded-xl bg-black/25"
      >
        <Music className="size-6 text-white/60" />
      </div>
    )
  }

  return null
}

export default StageMedia
