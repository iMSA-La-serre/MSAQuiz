import { MEDIA_TYPES } from "@razzia/common/constants"
import type { StatusMedia } from "@razzia/common/types/game"
import { isTimedMedia, isVideoMedia } from "@razzia/common/utils/media"
import MediaUnavailable from "@razzia/web/components/MediaUnavailable"
import DevicesMedia from "@razzia/web/features/game/components/question/DevicesMedia"
import HostMediaPlayer from "@razzia/web/features/game/components/question/HostMediaPlayer"
import ScreenMediaCard from "@razzia/web/features/game/components/question/ScreenMediaCard"
import { isDevicesMedia } from "@razzia/web/features/game/media/plan"
import type { DevicePlan } from "@razzia/web/features/game/media/device-media"
import useImageFailure from "@razzia/web/hooks/useImageFailure"
import clsx from "clsx"

interface Props {
  // Whole on the projected screen; on a phone, a video (a YouTube video too)
  // or a sound comes as its type only (it plays on the projected screen). On
  // the projected screen, a sound shows nothing here: see HostSoundBar.
  media?: StatusMedia
  alt: string
  variant: "host" | "phone"
  // Slide stage: one centred column, so the media may be taller.
  slide?: boolean
  // A phone: the video that plays on every device, as it follows it
  // (devicePlanOf), and whether its offer shows folded (DevicesOffer).
  devicePlan?: DevicePlan | null
  foldOffer?: boolean
}

// A slide's image on the projector: 20rem high at most (32rem on a large
// screen), less when the title, the band and the dock leave less (--title-h,
// set by the stage, see useTitleHeight: 16rem of chrome on a short screen,
// 20rem otherwise), never under 8rem. A video sizes its own frame, its
// controls under it (HostMediaPlayer).
const SLIDE_MEDIA_H =
  "[--slide-media-h:max(8rem,min(20rem,calc(100dvh_-_20rem_-_var(--title-h,4rem))))] lg:[--slide-media-h:max(8rem,min(32rem,calc(100dvh_-_20rem_-_var(--title-h,4rem))))] short:[--slide-media-h:max(8rem,min(20rem,calc(100dvh_-_16rem_-_var(--title-h,4rem))))]"

const SLIDE_HEIGHT = `${SLIDE_MEDIA_H} max-h-(--slide-media-h)`

const maxHeight = (variant: Props["variant"], slide = false) => {
  if (variant === "phone") {
    return "max-h-44"
  }

  return slide ? SLIDE_HEIGHT : "max-h-80 lg:max-h-[26rem] short:max-h-56"
}

// A 16:9 frame (a video, an image that did not load). On a slide, as wide as
// its height allows and centred, so the video fills it whatever the size of
// its file.
const frame = (variant: Props["variant"], slide = false) =>
  clsx(
    "aspect-video w-full rounded-2xl",
    maxHeight(variant, slide),
    slide &&
      variant === "host" &&
      "mx-auto max-w-[calc(var(--slide-media-h)*16/9)]",
  )

// Game-only media block. The editor keeps components/QuestionMedia.tsx.
const StageMedia = ({
  media,
  alt,
  variant,
  slide,
  devicePlan,
  foldOffer,
}: Props) => {
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

  if (!media || !isTimedMedia(media.type)) {
    return null
  }

  // It plays on every device: the phone offers to show it, and loads it
  // once its user asks.
  if (variant === "phone" && devicePlan) {
    return <DevicesMedia plan={devicePlan} folded={foldOffer} />
  }

  // It plays on the projected screen: the phone says so, and loads nothing.
  if (variant === "phone" || media.url === undefined) {
    return <ScreenMediaCard type={media.type} />
  }

  // A sound has nothing to show: its controls are in the host's dock
  // (HostSoundBar). A video file and a YouTube video show the same way.
  if (!isVideoMedia(media.type)) {
    return null
  }

  return (
    <HostMediaPlayer
      url={media.url}
      layout={slide ? "slide" : "side"}
      devices={isDevicesMedia(media)}
    />
  )
}

export default StageMedia
