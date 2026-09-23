import { markersOf } from "@razzia/common/utils/markers"
import MarkerChip from "@razzia/web/features/questions/markers/components/MarkerChip"
import MarkersFrame, {
  markerStyle,
} from "@razzia/web/features/questions/markers/components/MarkersFrame"
import { useMarkersPicking } from "@razzia/web/features/questions/markers/context"
import type { QuestionMediaProps } from "@razzia/web/features/questions/types"
import clsx from "clsx"
import { Check } from "lucide-react"

// Per screen: the heights of the media block (StageMedia), which the image
// takes when the column is wide enough for its shape; the chip, 44 px on a
// phone, the letter chip's projected size on a screen, a row's own in the
// result window; half of it with its white edge, which keeps it inside the
// picture (markerStyle); and the tick of a picked or right marker.
const VARIANTS = {
  phone: {
    frame: "[--frame-h:11rem] [--marker-half:24px]",
    image: "rounded-2xl",
    chip: "md",
    chipClassName: "size-11",
    tick: "size-5",
    check: "size-3.5",
  },
  host: {
    frame:
      "[--frame-h:20rem] lg:[--frame-h:26rem] short:[--frame-h:14rem] [--marker-half:26px] xl:[--marker-half:30px] short:[--marker-half:26px]",
    image: "rounded-2xl",
    chip: "lg",
    chipClassName: undefined,
    tick: "size-6",
    check: "size-4",
  },
  result: {
    frame: "[--frame-h:8rem] md:[--frame-h:14.5rem] [--marker-half:18px]",
    image: "rounded-md",
    chip: "sm",
    chipClassName: undefined,
    tick: "size-4",
    check: "size-3",
  },
} as const

/**
 * The question's image with its markers over it: the media block of a
 * markers question, plus one round chip per marker, holding its number.
 *
 * On a phone the chips are a second way to answer, next to the numbered rows
 * under the image: they are hidden from screen readers and skipped by the
 * keyboard, which the rows carry.
 */
const MarkersImage = ({
  media,
  alt,
  answers,
  markers,
  variant,
  locked = false,
  readOnly = false,
  correct = [],
}: QuestionMediaProps) => {
  const { selected, submitted, pick } = useMarkersPicking()
  const places = markersOf({ answers, markers })
  const sizes = VARIANTS[variant]

  if (!media) {
    return null
  }

  return (
    <MarkersFrame
      url={media.url}
      alt={alt}
      heightClassName={sizes.frame}
      imageClassName={clsx(sizes.image, locked && "opacity-90")}
      tone={variant === "result" ? "card" : "stage"}
    >
      {places.map((marker, index) => {
        const outlined = selected.includes(index) || correct.includes(index)
        const chip = (
          <MarkerChip
            index={index}
            size={sizes.chip}
            className={clsx("rounded-full", sizes.chipClassName)}
          />
        )
        // A white edge keeps every chip off the picture, whatever its
        // colours. A marker picked, or a right one once revealed, adds the
        // green ring of a picked row, between two white edges so it reads on
        // a green picture too, and the tick of a ticked box: the picked
        // marker never tells itself by its colour alone.
        const className = clsx(
          "ease-out-quart absolute flex -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-0.5 shadow-lg shadow-black/30 transition-[box-shadow,opacity] duration-300 motion-reduce:transition-none",
          outlined &&
            "ring-primary ring-4 outline-2 outline-offset-4 outline-white",
          locked && "opacity-70",
        )
        const content = (
          <>
            {chip}
            {outlined && (
              <span
                className={clsx(
                  "bg-primary absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white ring-2 ring-white",
                  sizes.tick,
                )}
              >
                <Check className={clsx("stroke-3", sizes.check)} />
              </span>
            )}
          </>
        )

        if (readOnly) {
          return (
            <span
              key={index}
              aria-hidden
              style={markerStyle(marker)}
              className={className}
            >
              {content}
            </span>
          )
        }

        return (
          <button
            key={index}
            type="button"
            // The numbered rows under the image carry the same markers with
            // their labels: these chips repeat them for the thumb only.
            aria-hidden
            tabIndex={-1}
            disabled={locked || submitted}
            style={markerStyle(marker)}
            className={clsx(className, "disabled:cursor-default")}
            onClick={() => {
              pick(index)
            }}
          >
            {content}
          </button>
        )
      })}
    </MarkersFrame>
  )
}

export default MarkersImage
