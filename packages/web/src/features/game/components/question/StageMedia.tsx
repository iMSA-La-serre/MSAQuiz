import { MEDIA_TYPES } from "@razzia/common/constants"
import type { QuestionMedia } from "@razzia/common/types/game"
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

const maxHeight = (variant: Props["variant"], slide = false) => {
  if (variant === "phone") {
    return "max-h-44"
  }

  return slide
    ? "max-h-80 lg:max-h-[32rem] short:max-h-80"
    : "max-h-80 lg:max-h-[26rem] short:max-h-56"
}

// Game-only media block. The editor keeps components/QuestionMedia.tsx.
const StageMedia = ({ media, upcomingMedia, alt, variant, slide }: Props) => {
  const height = maxHeight(variant, slide)

  if (media?.type === MEDIA_TYPES.IMAGE) {
    return (
      <img
        alt={alt}
        src={media.url}
        className={clsx("w-full rounded-2xl object-contain", height)}
      />
    )
  }

  if (media?.type === MEDIA_TYPES.VIDEO) {
    return (
      <video
        src={media.url}
        autoPlay
        controls
        className={clsx("aspect-video w-full rounded-2xl bg-black/40", height)}
      />
    )
  }

  if (media?.type === MEDIA_TYPES.AUDIO) {
    return <audio src={media.url} autoPlay controls className="w-full" />
  }

  if (upcomingMedia === MEDIA_TYPES.VIDEO) {
    return (
      <div
        aria-hidden
        className={clsx(
          "grid aspect-video w-full place-items-center rounded-2xl bg-black/25",
          height,
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
