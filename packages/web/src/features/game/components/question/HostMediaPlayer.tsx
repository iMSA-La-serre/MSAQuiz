import { MEDIA_TYPES } from "@razzia/common/constants"
import { youtubeVideoOf, youtubeWatchUrl } from "@razzia/common/utils/youtube"
import MediaUnavailable from "@razzia/web/components/MediaUnavailable"
import {
  FullscreenControl,
  MediaTimeline,
  MediaToggle,
  OpenOnYoutubeControl,
  RestartControl,
  RetryControl,
  ViewersCount,
} from "@razzia/web/features/game/components/question/HostMediaControls"
import {
  hostMedia,
  useHostMediaState,
} from "@razzia/web/features/game/media/host-media"
import {
  YOUTUBE_FAILURES,
  type YoutubeFailure,
} from "@razzia/web/features/game/media/youtube-api"
import {
  parkMediaElement,
  placeMediaElement,
} from "@razzia/web/features/game/media/stage"
import clsx from "clsx"
import { useLayoutEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

interface Props {
  url: string
  // By the answers (the image's column), or in a slide's centred column.
  layout: "side" | "slide"
  // It plays on every device too: how many phones show it.
  devices?: boolean
}

// The frame's height, 16:9 as wide as it allows: what the projected screen
// leaves once the title (--title-h, see useTitleHeight), the controls under
// it (--media-controls-h), the band and the dock are placed. By the answers,
// at most the height an image gets there, never under 8rem; on a slide, the
// sizes of a slide's image, never under 12.5rem, the smallest player YouTube
// allows (200 px): so is YouTube's player by the answers, nearer the title
// on a short screen (see QuestionStage).
const SIDE_MEDIA_H =
  "[--media-h:max(8rem,min(20rem,calc(100dvh_-_20rem_-_var(--title-h,4rem)_-_var(--media-controls-h))))] lg:[--media-h:max(8rem,min(26rem,calc(100dvh_-_20rem_-_var(--title-h,4rem)_-_var(--media-controls-h))))] short:[--media-h:max(8rem,min(14rem,calc(100dvh_-_15.5rem_-_var(--title-h,4rem)_-_var(--media-controls-h))))]"

const SIDE_YOUTUBE_H =
  "[--media-h:max(12.5rem,min(20rem,calc(100dvh_-_20rem_-_var(--title-h,4rem)_-_var(--media-controls-h))))] lg:[--media-h:max(12.5rem,min(26rem,calc(100dvh_-_20rem_-_var(--title-h,4rem)_-_var(--media-controls-h))))] short:[--media-h:max(12.5rem,min(14rem,calc(100dvh_-_15rem_-_var(--title-h,4rem)_-_var(--media-controls-h))))]"

const SLIDE_MEDIA_H =
  "[--media-h:max(12.5rem,min(20rem,calc(100dvh_-_20rem_-_var(--title-h,4rem)_-_var(--media-controls-h))))] lg:[--media-h:max(12.5rem,min(32rem,calc(100dvh_-_20rem_-_var(--title-h,4rem)_-_var(--media-controls-h))))] short:[--media-h:max(12.5rem,min(20rem,calc(100dvh_-_16rem_-_var(--title-h,4rem)_-_var(--media-controls-h))))]"

// The height the controls take under the video, the gap above them
// included: one row of 2.75rem buttons with the bar in it, once the block is
// 28rem wide; below, or while the browser refuses to play on its own (its
// message on a row of its own), the bar or the message (1.5rem) over the
// buttons.
const ONE_ROW = "[--media-controls-h:3.5rem]"
const TWO_ROWS = "[--media-controls-h:5.5rem]"

// With the count of the phones that show the video (ViewersCount), the one
// row needs 30rem, and a slide's block is 32rem wide at least, so the bar
// and the clock keep their room beside it.
const INLINE_TIMELINE = "@md:order-none @md:flex-1 @md:basis-0"
const INLINE_TIMELINE_DEVICES =
  "@min-[30rem]:order-none @min-[30rem]:flex-1 @min-[30rem]:basis-0"
const SIDE_ONE_ROW = "@md:[--media-controls-h:3.5rem]"
const SIDE_ONE_ROW_DEVICES = "@min-[30rem]:[--media-controls-h:3.5rem]"
const SLIDE_WIDTH = "max-w-[max(min(100%,28rem),calc(var(--media-h)*16/9))]"
const SLIDE_WIDTH_DEVICES =
  "max-w-[max(min(100%,32rem),calc(var(--media-h)*16/9))]"

// The control that had the focus when a screen of the question went away:
// the same control of the next screen takes it (a remote, a keyboard).
let handedFocus: { key: string; control: string } | null = null

// Where opening the video on YouTube's site helps: YouTube plays it there,
// not in a player of another site. Not when YouTube does not answer, nor for
// a video it does not have.
const OPENS_ON_YOUTUBE = new Set<YoutubeFailure>([
  YOUTUBE_FAILURES.NOT_EMBEDDABLE,
  YOUTUBE_FAILURES.EMBED_DISABLED,
  YOUTUBE_FAILURES.REFUSED,
  YOUTUBE_FAILURES.PLAYER,
])

const isYoutubeFailure = (value: string | null): value is YoutubeFailure =>
  value !== null &&
  (Object.values(YOUTUBE_FAILURES) as string[]).includes(value)

/**
 * The video of the question on the projected screen, a file or a YouTube
 * video, with the host's controls under it, never over it: back to the
 * start, play or pause, where it is, full screen. A click on the picture
 * plays or pauses a file; YouTube's player takes its own clicks (its bar).
 * The player itself belongs to hostMedia: this block only lends it its
 * frame, and the next screen of the question takes it over where it was.
 * A video that does not play says why, in its place, never over the player,
 * in a few words for the room (the editor and the live region tell how to
 * fix it): « Réessayer », and « Ouvrir sur YouTube » when YouTube's own site
 * would play it. The controls come first for the keyboard, under the player
 * on screen: a Tab reaches them before YouTube's own bar.
 */
const HostMediaPlayer = ({ url, layout, devices = false }: Props) => {
  const { t } = useTranslation()
  const state = useHostMediaState()
  const rootRef = useRef<HTMLDivElement>(null)
  const slotRef = useRef<HTMLDivElement>(null)
  // Only the player of this very media: never the previous question's for a
  // frame.
  const element = state.source?.url === url ? state.element : null
  const key = element ? state.key : null
  const ready = element !== null
  const { blocked, failed } = state
  const slide = layout === "slide"
  const youtubeVideo = youtubeVideoOf(url)
  const youtube =
    ready && state.source
      ? state.source.kind === MEDIA_TYPES.YOUTUBE
      : youtubeVideo !== undefined
  const clickable = ready && !failed && !youtube
  const failure =
    youtube && failed && isYoutubeFailure(state.failure)
      ? state.failure
      : undefined
  const opensOnYoutube =
    youtubeVideo !== undefined &&
    failure !== undefined &&
    OPENS_ON_YOUTUBE.has(failure)

  // Taken over from the previous screen's block within the same commit,
  // which left it in the page (see stage.ts): it never stops.
  useLayoutEffect(() => {
    const slot = slotRef.current

    if (!slot || !element) {
      return
    }

    placeMediaElement(element, slot)

    return () => {
      if (element.parentNode === slot) {
        parkMediaElement(element)
      }
    }
  }, [element])

  // The focus goes on from one screen of the question to the next.
  useLayoutEffect(() => {
    const root = rootRef.current

    if (!root || key === null) {
      return
    }

    if (handedFocus?.key === key) {
      root
        .querySelector<HTMLElement>(
          `[data-media-control="${handedFocus.control}"]`,
        )
        ?.focus({ preventScroll: true })
    }

    handedFocus = null

    return () => {
      const active = document.activeElement

      handedFocus =
        active instanceof HTMLElement &&
        root.contains(active) &&
        active.dataset.mediaControl
          ? { key, control: active.dataset.mediaControl }
          : null
    }
  }, [key])

  // By the answers, the width of the column tells: one row or two.
  const sideControlsHeight = blocked
    ? TWO_ROWS
    : clsx(TWO_ROWS, devices ? SIDE_ONE_ROW_DEVICES : SIDE_ONE_ROW)

  return (
    <div
      ref={rootRef}
      className={clsx(
        "@container flex w-full flex-col gap-3",
        slide &&
          clsx(
            SLIDE_MEDIA_H,
            blocked ? TWO_ROWS : ONE_ROW,
            "mx-auto",
            devices ? SLIDE_WIDTH_DEVICES : SLIDE_WIDTH,
          ),
      )}
    >
      {failed ? (
        <div className="flex flex-wrap items-center gap-3">
          <RetryControl />
          {opensOnYoutube && (
            <OpenOnYoutubeControl url={youtubeWatchUrl(youtubeVideo)} />
          )}
        </div>
      ) : (
        <div
          role="group"
          aria-label={t("game:media.videoControls")}
          className="flex flex-wrap items-center gap-x-3 gap-y-2"
        >
          <RestartControl ready={ready} />
          <MediaToggle kind="video" state={state} ready={ready} />
          <MediaTimeline
            state={state}
            ready={ready}
            className={clsx(
              "order-first basis-full",
              !blocked && (devices ? INLINE_TIMELINE_DEVICES : INLINE_TIMELINE),
            )}
          />
          <div className="ml-auto flex items-center gap-3">
            {devices && <ViewersCount />}
            <FullscreenControl element={element} />
          </div>
        </div>
      )}
      {/* First on screen, after the controls for the keyboard. */}
      <div
        onClick={
          clickable
            ? () => {
                hostMedia.toggle()
              }
            : undefined
        }
        className={clsx(
          "relative order-first aspect-video max-h-(--media-h) w-full max-w-[calc(var(--media-h)*16/9)] overflow-hidden rounded-2xl bg-black/40",
          slide
            ? "mx-auto"
            : clsx(
                // No player left once it failed: the message and its
                // buttons take the room.
                youtube && !failed ? SIDE_YOUTUBE_H : SIDE_MEDIA_H,
                sideControlsHeight,
              ),
          clickable && "cursor-pointer",
        )}
      >
        {/* A player that failed is hidden, never covered. */}
        <div
          ref={slotRef}
          className={clsx("size-full", failed && "invisible")}
        />
        {failed && (
          <MediaUnavailable
            kind="video"
            detail={
              failure ? t(`game:media.youtubeScreen.${failure}`) : undefined
            }
            className="absolute inset-0 rounded-2xl"
          />
        )}
      </div>
    </div>
  )
}

export default HostMediaPlayer
