import { MARKERS_LIMITS, MEDIA_TYPES } from "@razzia/common/constants"
import type { QuestionMarker } from "@razzia/common/types/game"
import { markerPercent, markersOf } from "@razzia/common/utils/markers"
import { duplicatesOf } from "@razzia/web/features/questions/keys"
import MarkerChip from "@razzia/web/features/questions/markers/components/MarkerChip"
import MarkersFrame, {
  FALLBACK_RATIO,
  markerStyle,
} from "@razzia/web/features/questions/markers/components/MarkersFrame"
import MarkersPicker from "@razzia/web/features/questions/markers/components/MarkersPicker"
import {
  crowdedMarkers,
  freeSpot,
} from "@razzia/web/features/questions/markers/utils/layout"
import { markerName as nameOf } from "@razzia/web/features/questions/markers/utils/names"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { ImageOff, Plus, Trash2 } from "lucide-react"
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

const WHITE_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"

// The columns of the choice editor: chip, label, correct-answer box, delete.
const COLUMNS = "sm:grid-cols-[2rem_minmax(0,1fr)_8rem_2.25rem]"

const ROW = clsx(
  "grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 py-2.5",
  COLUMNS,
)

// A marker moves by a percentage of the image at a time, five with Shift.
const STEP = 1

const BIG_STEP = 5

const ARROW_STEPS: Partial<Record<string, { x: number; y: number }>> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
}

// Markers: the question's image, where the author places 2 to 6 numbered
// markers, then one row per marker with its label and its box, as the answers
// of a choice. A marker is placed by clicking the image, moved by dragging it
// or with the arrow keys once it has focus. The picture here is larger than
// a phone's: markers whose chips would overlap on a phone are pointed out
// under it.
const MarkersEditor = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const titleId = useId()
  const duplicateId = useId()
  const hintId = useId()
  const labels = currentQuestion.answers
  const markers = markersOf(currentQuestion)
  const { media } = currentQuestion
  const image = media?.type === MEDIA_TYPES.IMAGE ? media : undefined
  const frameRef = useRef<HTMLDivElement>(null)
  const inputs = useRef<Array<HTMLInputElement | null>>([])
  const addButton = useRef<HTMLButtonElement>(null)
  // Row whose field gets focus after an add or a delete; the add button when
  // that row no longer exists.
  const pendingFocus = useRef<number | null>(null)
  const [dragged, setDragged] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState("")
  // The picture's shape, once loaded: where the markers land on a phone.
  const [ratio, setRatio] = useState(FALLBACK_RATIO)

  useEffect(() => {
    const target = pendingFocus.current

    if (target === null) {
      return
    }

    pendingFocus.current = null
    const input = inputs.current[target]

    if (input) {
      input.focus()

      return
    }

    addButton.current?.focus()
  })

  const canAdd = labels.length < MARKERS_LIMITS.MAX_MARKERS
  const canRemove = labels.length > MARKERS_LIMITS.MIN_MARKERS
  const duplicates = duplicatesOf(labels)
  const crowded = image ? crowdedMarkers(markers, ratio) : []

  const markerName = (index: number) => nameOf(t, index, labels.at(index))

  const setMarkers = (next: QuestionMarker[]) => {
    updateQuestion(currentIndex, { markers: next })
  }

  const place = (index: number, position: QuestionMarker, tell = false) => {
    const next = markers.map((marker, key) =>
      key === index
        ? { x: markerPercent(position.x), y: markerPercent(position.y) }
        : marker,
    )

    setMarkers(next)

    if (tell) {
      setAnnouncement(
        t("quizz:markers.moved", {
          marker: markerName(index),
          ...next[index],
        }),
      )
    }
  }

  // Where a pointer landed on the image, as a percentage of it: measured on
  // the frame that wraps it exactly, which keeps its size when the image
  // does not load.
  const positionOf = (clientX: number, clientY: number): QuestionMarker => {
    const box = frameRef.current?.getBoundingClientRect()

    if (!box || box.width === 0 || box.height === 0) {
      return { x: 50, y: 50 }
    }

    return {
      x: markerPercent(((clientX - box.left) / box.width) * 100),
      y: markerPercent(((clientY - box.top) / box.height) * 100),
    }
  }

  // Without a pointer (the add button, the keyboard on the image), a new
  // marker goes to a free spot, never on top of another one.
  const addMarker = (position: QuestionMarker = freeSpot(markers, ratio)) => {
    if (!canAdd) {
      return
    }

    pendingFocus.current = labels.length
    updateQuestion(currentIndex, {
      answers: [...labels, ""],
      markers: [...markers, position],
    })
  }

  const removeMarker = (index: number) => {
    if (!canRemove) {
      return
    }

    const solutions = currentQuestion.solutions
      .filter((solution) => solution !== index)
      .map((solution) => (solution > index ? solution - 1 : solution))

    pendingFocus.current = index
    updateQuestion(currentIndex, {
      answers: labels.filter((_, key) => key !== index),
      markers: markers.filter((_, key) => key !== index),
      solutions: solutions.length > 0 ? solutions : [0],
    })
  }

  const updateLabel = (index: number, value: string) => {
    updateQuestion(currentIndex, {
      answers: labels.map((label, key) => (key === index ? value : label)),
    })
  }

  const handleKeyDown =
    (index: number) => (event: KeyboardEvent<HTMLButtonElement>) => {
      const step = ARROW_STEPS[event.key]

      if (!step) {
        return
      }

      event.preventDefault()
      const size = event.shiftKey ? BIG_STEP : STEP
      const marker = markers[index]

      place(
        index,
        { x: marker.x + step.x * size, y: marker.y + step.y * size },
        true,
      )
    }

  return (
    <section
      aria-labelledby={titleId}
      className="bg-background text-foreground z-10 rounded-2xl p-4 shadow-sm md:p-6"
    >
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-3">
          <h3 id={titleId} className="text-lg font-bold">
            {t("quizz:markers.title")}
          </h3>
          <span className="text-muted-foreground text-sm font-semibold tabular-nums">
            {t("quizz:answers.count", {
              count: labels.length,
              max: MARKERS_LIMITS.MAX_MARKERS,
            })}
          </span>
        </div>
        <p className="text-muted-foreground text-sm">
          {t("quizz:answers.hint.markers")}
        </p>
      </header>

      {image ? (
        <div className="mb-4 flex flex-col gap-2">
          <MarkersFrame
            url={image.url}
            alt=""
            heightClassName="[--frame-h:14rem] [--marker-half:20px] sm:[--frame-h:20rem]"
            imageClassName="border-accent rounded-xl border-2"
            frameRef={frameRef}
            onRatio={setRatio}
            tone="card"
          >
            {/* The image itself places a marker: a click puts one where the
            pointer is, a keyboard press on a free spot, to be moved from
            there. */}
            <button
              type="button"
              disabled={!canAdd}
              aria-label={t("quizz:markers.add")}
              aria-describedby={hintId}
              onClick={(event) => {
                addMarker(
                  event.detail === 0
                    ? undefined
                    : positionOf(event.clientX, event.clientY),
                )
              }}
              className={clsx(
                "absolute inset-0 cursor-copy rounded-xl disabled:cursor-default",
                WHITE_FOCUS,
              )}
            />
            {markers.map((marker, index) => (
              <button
                key={index}
                type="button"
                aria-label={t("quizz:markers.pin", {
                  marker: markerName(index),
                  ...marker,
                })}
                // Kept inside the picture, as the screens of the game keep it.
                style={markerStyle(marker)}
                className={clsx(
                  "absolute flex -translate-x-1/2 -translate-y-1/2 touch-none rounded-full bg-white p-0.5 shadow-lg shadow-black/30",
                  dragged === index ? "cursor-grabbing" : "cursor-grab",
                  WHITE_FOCUS,
                )}
                onKeyDown={handleKeyDown(index)}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId)
                  setDragged(index)
                }}
                onPointerMove={(event) => {
                  if (dragged === index) {
                    place(index, positionOf(event.clientX, event.clientY))
                  }
                }}
                onPointerUp={() => {
                  if (dragged === index) {
                    setDragged(null)
                    setAnnouncement(
                      t("quizz:markers.moved", {
                        marker: markerName(index),
                        ...markers[index],
                      }),
                    )
                  }
                }}
              >
                <MarkerChip
                  index={index}
                  size="sm"
                  className="size-9 rounded-full"
                />
              </button>
            ))}
          </MarkersFrame>
          <p id={hintId} className="text-muted-foreground text-sm">
            {t("quizz:markers.placeHint")}
          </p>
          {/* A warning, not an error: the question still saves. */}
          <p aria-live="polite" className="text-danger text-sm font-semibold">
            {crowded.length > 0 &&
              t("quizz:markers.crowded", {
                pairs: crowded
                  .map(([first, second]) =>
                    t("quizz:markers.crowdedPair", {
                      first: first + 1,
                      second: second + 1,
                    }),
                  )
                  .join(", "),
              })}
          </p>
        </div>
      ) : (
        <div className="bg-muted/40 text-muted-foreground mb-4 flex items-center gap-3 rounded-xl p-4 text-sm font-medium">
          <ImageOff className="size-6 shrink-0" aria-hidden />
          <p>{t("quizz:markers.noImage")}</p>
        </div>
      )}

      <div
        aria-hidden
        className={clsx(
          "text-muted-foreground hidden gap-x-3 px-1 pb-2 text-xs font-semibold tracking-[0.15em] uppercase sm:grid",
          COLUMNS,
        )}
      >
        <span />
        <span>{t("quizz:markers.columnLabel")}</span>
        <span className="text-center">{t("quizz:answers.columnCorrect")}</span>
        <span />
      </div>

      <ol className="divide-muted flex flex-col divide-y">
        {labels.map((label, index) => {
          const isDuplicate = duplicates.has(index)

          return (
            <li key={index} className={ROW}>
              <MarkerChip index={index} size="sm" />
              <input
                ref={(element) => {
                  inputs.current[index] = element
                }}
                className="border-muted-foreground/80 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary aria-invalid:border-danger w-full rounded-lg border bg-white px-3 py-2.5 text-base font-semibold outline-none focus:ring-2"
                placeholder={t("quizz:markers.placeholder", {
                  number: index + 1,
                })}
                aria-label={t("quizz:markers.placeholder", {
                  number: index + 1,
                })}
                aria-invalid={isDuplicate}
                aria-describedby={isDuplicate ? duplicateId : undefined}
                maxLength={MARKERS_LIMITS.LABEL_LENGTH}
                autoComplete="off"
                value={label}
                onChange={(event) => updateLabel(index, event.target.value)}
              />
              <div className="col-span-2 flex items-center justify-end gap-3 sm:contents">
                {/* A label, so a tap on the visible « Bonne réponse » below sm
                toggles the box too. */}
                <label className="flex cursor-pointer items-center justify-center gap-2">
                  <span
                    aria-hidden
                    className="text-muted-foreground text-xs font-semibold sm:hidden"
                  >
                    {t("quizz:answers.columnCorrect")}
                  </span>
                  <MarkersPicker
                    index={index}
                    isSelected={currentQuestion.solutions.includes(index)}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeMarker(index)}
                  disabled={!canRemove}
                  aria-label={t("quizz:markers.remove", {
                    marker: markerName(index),
                  })}
                  className={clsx(
                    "text-muted-foreground enabled:hover:bg-danger-subtle enabled:hover:text-danger flex size-11 items-center justify-center rounded-lg disabled:opacity-40 sm:size-9",
                    WHITE_FOCUS,
                  )}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          )
        })}
      </ol>

      {labels.length === 0 && (
        <p className="text-muted-foreground py-2 text-sm">
          {t("quizz:markers.empty")}
        </p>
      )}

      {duplicates.size > 0 && (
        <p id={duplicateId} className="text-danger mt-2 text-sm font-semibold">
          {t("errors:quizz.markerLabelDuplicate")}
        </p>
      )}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <button
        ref={addButton}
        type="button"
        onClick={() => addMarker()}
        disabled={!canAdd}
        className={clsx(
          "border-accent text-muted-foreground enabled:hover:border-primary enabled:hover:text-foreground mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed py-3 text-sm font-semibold disabled:opacity-40",
          WHITE_FOCUS,
        )}
      >
        <Plus className="size-4" aria-hidden />
        {t("quizz:markers.add")}
      </button>
    </section>
  )
}

export default MarkersEditor
