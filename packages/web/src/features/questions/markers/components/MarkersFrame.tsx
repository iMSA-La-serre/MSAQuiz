import type { QuestionMarker } from "@razzia/common/types/game"
import MediaUnavailable from "@razzia/web/components/MediaUnavailable"
import useImageFailure from "@razzia/web/hooks/useImageFailure"
import clsx from "clsx"
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

// The shape of each image already seen, so a screen that mounts again (the
// answering stage after the reading one) places its markers at once.
const RATIOS = new Map<string, number>()

// Until the image tells its shape: a landscape picture, the usual plan or
// photo.
export const FALLBACK_RATIO = 4 / 3

const ratioOf = (image: HTMLImageElement): number | undefined =>
  image.naturalWidth > 0 && image.naturalHeight > 0
    ? image.naturalWidth / image.naturalHeight
    : undefined

// Past this, a chip would stick out of the picture: half of it, set as
// --marker-half by each screen for its chip.
const inside = (percent: number) =>
  `clamp(var(--marker-half), ${percent}%, calc(100% - var(--marker-half)))`

/**
 * Where a marker's chip is centred on the picture: on its spot, but never so
 * close to an edge that the chip would stick out of the picture, over the
 * title above it or past the side of a phone's screen. The screen sets
 * --marker-half, half the width of its chip.
 */
export const markerStyle = ({ x, y }: QuestionMarker): CSSProperties => ({
  left: inside(x),
  top: inside(y),
})

interface Props {
  url: string
  alt: string
  // Sets --frame-h, the height the image takes when the width allows it,
  // per screen: the heights of the media block; and --marker-half, half the
  // width of the screen's chips, see markerStyle.
  heightClassName: string
  imageClassName?: string
  // The editor reads where a click landed on the picture: the box that wraps
  // it exactly, the same whether the image loaded or not.
  frameRef?: RefObject<HTMLDivElement | null>
  // The editor learns the picture's shape, to place markers as a phone will.
  onRatio?: (_ratio: number) => void
  // An image that does not load leaves a neutral block in its place, on the
  // game's background or on a white card (the editor, the result window).
  tone?: "stage" | "card"
  // The markers, placed against the picture.
  children: ReactNode
}

/**
 * The question's image at the size the media block gives it, and a box that
 * wraps the picture exactly: the markers are placed against it, as a
 * percentage of the picture, never of a box it is letterboxed in. The image
 * keeps its shape: as high as the media block allows, narrower when the
 * column is, as the plain media block shows it.
 */
const MarkersFrame = ({
  url,
  alt,
  heightClassName,
  imageClassName,
  frameRef,
  onRatio,
  tone = "stage",
  children,
}: Props) => {
  // Kept with the image it belongs to: the next question may show another
  // one in the same frame.
  const [learned, setLearned] = useState<{ url: string; ratio: number }>()
  const ratio = learned?.url === url ? learned.ratio : RATIOS.get(url)
  const ownRef = useRef<HTMLImageElement>(null)
  const shown = ratio ?? FALLBACK_RATIO
  // An image that does not load: its frame stays, with the markers over it.
  const { failed, fail, retry } = useImageFailure(url)

  const learn = (image: HTMLImageElement) => {
    const found = ratioOf(image)

    if (found !== undefined) {
      RATIOS.set(url, found)
      setLearned({ url, ratio: found })
    }
  }

  // An image already in the cache may be complete before React listens to
  // its load: read its shape before the first paint.
  useLayoutEffect(() => {
    const image = ownRef.current

    if (ratio === undefined && image?.complete) {
      learn(image)
    }
  })

  useEffect(() => {
    if (ratio !== undefined) {
      onRatio?.(ratio)
    }
  }, [ratio, onRatio])

  return (
    <div className={clsx("flex w-full justify-center", heightClassName)}>
      <div
        ref={frameRef}
        className="relative"
        style={{
          width: `min(100%, calc(var(--frame-h) * ${shown}))`,
          aspectRatio: shown,
        }}
      >
        {failed ? (
          <MediaUnavailable
            tone={tone}
            placement="bottom"
            retry={retry}
            className={clsx("size-full", imageClassName)}
          />
        ) : (
          <img
            ref={ownRef}
            alt={alt}
            src={url}
            onLoad={(event: SyntheticEvent<HTMLImageElement>) => {
              learn(event.currentTarget)
            }}
            onError={fail}
            className={clsx("block size-full", imageClassName)}
          />
        )}
        {children}
      </div>
    </div>
  )
}

export default MarkersFrame
