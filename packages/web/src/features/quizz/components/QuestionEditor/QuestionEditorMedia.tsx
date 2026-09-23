import { MEDIA_PLAYBACK, MEDIA_TYPES } from "@razzia/common/constants"
import type {
  QuestionMedia as Media,
  MediaPlayback,
  QuestionMediaType,
} from "@razzia/common/types/game"
import {
  isTimedMedia,
  isVideoMedia,
  MEDIA_ISSUES,
} from "@razzia/common/utils/media"
import { youtubeVideoOf } from "@razzia/common/utils/youtube"
import Card from "@razzia/web/components/Card"
import Input from "@razzia/web/components/Input"
import QuestionMedia from "@razzia/web/components/QuestionMedia"
import type { YoutubeFailure } from "@razzia/web/features/game/media/youtube-api"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import useImageFailure, {
  imageFailures,
} from "@razzia/web/hooks/useImageFailure"
import { youtubeFailures } from "@razzia/web/hooks/useYoutubeFailure"
import {
  keepsPick,
  mediaDraftOf,
  mediaForUrl,
  mediaWithPlayback,
  mediaWithType,
  pickOf,
  type TypePick,
} from "@razzia/web/features/quizz/utils/media"
import clsx from "clsx"
import {
  Image,
  ImageOff,
  type LucideIcon,
  MonitorPlay,
  Music,
  RotateCcw,
  Smartphone,
  SquarePlay,
  Trash2,
  Video,
} from "lucide-react"
import { type ChangeEvent, useEffect, useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

const TYPE_CHOICES: Array<{
  type: NonNullable<QuestionMediaType>
  icon: LucideIcon
}> = [
  { type: MEDIA_TYPES.IMAGE, icon: Image },
  { type: MEDIA_TYPES.VIDEO, icon: Video },
  { type: MEDIA_TYPES.AUDIO, icon: Music },
  { type: MEDIA_TYPES.YOUTUBE, icon: SquarePlay },
]

// Where a video plays: the projected screen, the default, or every device.
const PLAYBACK_CHOICES: Array<{ playback: MediaPlayback; icon: LucideIcon }> = [
  { playback: MEDIA_PLAYBACK.SCREEN, icon: MonitorPlay },
  { playback: MEDIA_PLAYBACK.DEVICES, icon: Smartphone },
]

// A choice among a few, as a button: picked, or not; before an address, not
// yet.
const choiceClass = (picked: boolean, enabled = true) =>
  clsx(
    "has-focus-visible:outline-primary flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-base font-semibold has-focus-visible:outline-2 has-focus-visible:outline-offset-2",
    picked
      ? "bg-primary/15 text-foreground ring-primary ring-2 ring-inset"
      : "bg-accent text-accent-foreground",
    enabled ? "cursor-pointer" : "cursor-default opacity-40",
  )

// How long the address must stay the same, while it is typed, before the
// preview loads it: never a preview, and never a failure, per keystroke.
const SETTLE_DELAY = 500

const WHITE_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"

// Where a video plays, the projected screen when not set (or set to a value
// the game does not know, read so).
const playbackOf = (media: Media | undefined): MediaPlayback =>
  media?.playback === MEDIA_PLAYBACK.DEVICES
    ? MEDIA_PLAYBACK.DEVICES
    : MEDIA_PLAYBACK.SCREEN

// While the author types: the question, and the media the preview keeps
// showing until the address settles.
interface Typing {
  index: number
  shown: Media | undefined
}

// The type the author picked, kept across the keystrokes of an address (see
// keepsPick), for the question and the address it was last seen with.
interface HeldPick {
  index: number
  url: string
  pick: TypePick | undefined
}

// The question's media: its address, always visible and editable, above the
// preview so the field never moves under the cursor; the type it is shown as
// (picked from the address when it tells, see mediaForUrl); why a save would
// refuse it, or that the preview did not load, under the field; and a preview
// that never plays by itself. Clearing the address, or the bin, removes it.
const QuestionEditorMedia = () => {
  const { updateQuestion, currentIndex, currentQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const inputId = useId()
  const typeName = useId()
  const playbackName = useId()
  const playbackLabelId = useId()
  const playbackHintId = useId()
  const messageId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<number>(undefined)
  const pasting = useRef(false)
  const heldPick = useRef<HeldPick>(undefined)
  const [typing, setTyping] = useState<Typing>()
  // Each settled address loads the preview anew: an address typed again
  // after a failure, or « Réessayer », tries it once more.
  const [attempt, setAttempt] = useState(0)
  // For a YouTube video, why its player refuses it.
  const [failure, setFailure] = useState<{
    attempt: number
    key: string
    youtube?: YoutubeFailure
  }>()
  // Read out once the media is removed.
  const [notice, setNotice] = useState("")
  const { media } = currentQuestion
  const draft = media && mediaDraftOf(media)
  const isTyping = typing?.index === currentIndex
  const shown = isTyping ? typing.shown : media
  const preview = shown && mediaDraftOf(shown)
  const canPreview = preview?.type !== undefined && preview.issue === undefined
  const previewKey =
    preview && `${currentIndex}|${preview.type ?? ""}|${preview.url}`
  // An image's outcome is shared with the sidebar and the markers' frame
  // (see useImageFailure): once it loads in one of them, the preview loads
  // it again too.
  const shared = useImageFailure(
    preview?.type === MEDIA_TYPES.IMAGE ? preview.url : undefined,
  )
  const failed =
    canPreview &&
    failure?.attempt === attempt &&
    failure.key === previewKey &&
    (preview.type !== MEDIA_TYPES.IMAGE || shared.failed)
  // « h » is not an address yet, nor « https://intranet/film.mp » a type,
  // nor « https://youtu.be/ » a video: those wait until the author pauses,
  // leaves the field or pastes. A video page's link or a pasted image too
  // large show at once.
  const waits =
    draft?.issue === MEDIA_ISSUES.NOT_WEB ||
    draft?.issue === MEDIA_ISSUES.TYPE_MISSING ||
    draft?.issue === MEDIA_ISSUES.YOUTUBE_LINK
  const issue = waits && isTyping ? undefined : draft?.issue
  let message = ""

  if (issue) {
    message = t(issue)
  } else if (failed) {
    message = failure.youtube
      ? t(`game:media.youtube.${failure.youtube}`)
      : t("quizz:question.mediaFailed")
  }

  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
    },
    [],
  )

  const settle = () => {
    window.clearTimeout(timer.current)
    setTyping(undefined)
    setAttempt((count) => count + 1)
  }

  const pickFor = (): TypePick | undefined => {
    const held = heldPick.current

    return held?.index === currentIndex && held.url === (media?.url ?? "")
      ? held.pick
      : pickOf(media)
  }

  const handleChangeUrl = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target
    const pick = pickFor()
    const next = mediaForUrl(media, value, pick)

    heldPick.current = {
      index: currentIndex,
      url: next?.url ?? "",
      pick: keepsPick(pick, value) ? pick : undefined,
    }
    setNotice("")
    updateQuestion(currentIndex, { media: next })

    // A paste, or the field cleared: at once.
    if (pasting.current || next === undefined) {
      pasting.current = false
      settle()

      return
    }

    if (!isTyping) {
      setTyping({ index: currentIndex, shown: media })
    }

    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(settle, SETTLE_DELAY)
  }

  const handlePaste = () => {
    pasting.current = true
    // A paste that changes nothing fires no change.
    window.setTimeout(() => {
      pasting.current = false
    }, 0)
  }

  const handleBlur = () => {
    if (isTyping) {
      settle()
    }
  }

  const handlePickType = (type: NonNullable<QuestionMediaType>) => () => {
    if (!media) {
      return
    }

    const next = mediaWithType(media, type)

    heldPick.current = {
      index: currentIndex,
      url: media.url,
      pick: pickOf(next),
    }
    updateQuestion(currentIndex, { media: next })
    settle()
  }

  const handlePickPlayback = (playback: MediaPlayback) => () => {
    if (media) {
      updateQuestion(currentIndex, {
        media: mediaWithPlayback(media, playback),
      })
    }
  }

  // The bin goes with the media: the focus goes back to the field, which
  // stays, and the removal is read out.
  const handleRemove = () => {
    heldPick.current = undefined
    updateQuestion(currentIndex, { media: undefined })
    settle()
    setNotice(t("quizz:question.mediaRemoved"))
    inputRef.current?.focus()
  }

  const renderPreview = () => {
    if (!preview?.type || !canPreview || failed || !previewKey) {
      return null
    }

    const isImage = preview.type === MEDIA_TYPES.IMAGE

    // An image's outcome is shared with the sidebar and the markers' frame
    // (see useImageFailure): all say the same.
    return (
      <QuestionMedia
        key={`${attempt}|${previewKey}`}
        media={{ type: preview.type, url: preview.url }}
        alt={t("quizz:question.mediaPreview")}
        onError={(youtube) => {
          setFailure({ attempt, key: previewKey, youtube })

          if (isImage) {
            imageFailures.fail(preview.url)
          }

          // The list of questions points it out too.
          const video = youtube && youtubeVideoOf(preview.url)

          if (youtube && video) {
            youtubeFailures.fail(video.id, youtube)
          }
        }}
        onLoad={() => {
          if (isImage) {
            imageFailures.recover(preview.url)
          }
        }}
      />
    )
  }

  return (
    <div
      className={clsx(
        "relative z-10 flex flex-col items-center gap-3 p-4",
        !media && "flex-1",
      )}
    >
      <Card
        className={clsx("w-full max-w-xl gap-3", !media && "max-h-100 flex-1")}
      >
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={inputId}
            className="text-foreground text-sm font-semibold"
          >
            {t("quizz:question.mediaUrlLabel")}
          </label>
          {/* As high as the bin, with or without it: the field stays put. */}
          <div className="flex min-h-11 items-center gap-2">
            <Input
              ref={inputRef}
              id={inputId}
              variant="sm"
              className="min-w-0 flex-1"
              placeholder={t("quizz:question.mediaUrlPlaceholder")}
              value={media?.url ?? ""}
              onChange={handleChangeUrl}
              onPaste={handlePaste}
              onBlur={handleBlur}
              aria-invalid={message !== ""}
              aria-describedby={message ? messageId : undefined}
              autoComplete="off"
              spellCheck={false}
            />
            {media && (
              <button
                type="button"
                onClick={handleRemove}
                aria-label={t("quizz:question.removeMedia")}
                title={t("quizz:question.removeMedia")}
                className={clsx(
                  "text-muted-foreground hover:bg-danger-subtle hover:text-danger-strong flex size-11 shrink-0 items-center justify-center rounded-lg",
                  WHITE_FOCUS,
                )}
              >
                <Trash2 className="size-5" aria-hidden />
              </button>
            )}
          </div>
          <div className="flex items-start gap-2">
            {/* Read out as it changes; empty while the media can be saved
            and its preview loads. */}
            <p
              id={messageId}
              aria-live="polite"
              className="text-danger-strong flex-1 text-sm font-semibold"
            >
              {message}
            </p>
            {/* Goes with the failure: the focus goes back to the field. */}
            {failed && !issue && (
              <button
                type="button"
                onClick={() => {
                  const video =
                    preview.type === MEDIA_TYPES.YOUTUBE
                      ? youtubeVideoOf(preview.url)
                      : undefined

                  if (video) {
                    youtubeFailures.forget(video.id)
                  }

                  setAttempt((count) => count + 1)
                  inputRef.current?.focus()
                }}
                className={clsx(
                  "bg-accent text-foreground flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold",
                  WHITE_FOCUS,
                )}
              >
                <RotateCcw className="size-4" aria-hidden />
                {t("quizz:question.mediaRetry")}
              </button>
            )}
          </div>
          <p aria-live="polite" className="sr-only">
            {notice}
          </p>
        </div>

        {/* Native radios, hidden, whose labels look like buttons: picked
        from the address, or by the author. No type to pick before there is
        an address. */}
        <div
          role="radiogroup"
          aria-label={t("quizz:question.mediaType")}
          className="flex flex-wrap gap-2"
        >
          {TYPE_CHOICES.map(({ type, icon: Icon }) => {
            const picked = draft?.type === type

            return (
              <label key={type} className={choiceClass(picked, Boolean(media))}>
                <input
                  type="radio"
                  className="sr-only"
                  name={typeName}
                  value={type}
                  checked={picked}
                  disabled={!media}
                  onChange={handlePickType(type)}
                />
                <Icon className="size-5" aria-hidden />
                {t(`quizz:question.media.${type}`)}
              </label>
            )
          })}
        </div>

        {/* Where a video (a file or YouTube's) plays: the projected screen
        only, the default, or every device too, in step with it and driven
        by the host. A sound plays on the screen. */}
        {isVideoMedia(draft?.type) && (
          <div className="flex flex-col gap-1.5">
            <p
              id={playbackLabelId}
              className="text-foreground text-sm font-semibold"
            >
              {t("quizz:question.mediaPlayback")}
            </p>
            <div
              role="radiogroup"
              aria-labelledby={playbackLabelId}
              className="flex flex-wrap gap-2"
            >
              {PLAYBACK_CHOICES.map(({ playback, icon: Icon }) => (
                <label
                  key={playback}
                  className={choiceClass(playbackOf(media) === playback)}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    name={playbackName}
                    value={playback}
                    // What the choice means, read with it as it changes.
                    aria-describedby={playbackHintId}
                    checked={playbackOf(media) === playback}
                    onChange={handlePickPlayback(playback)}
                  />
                  <Icon className="size-5" aria-hidden />
                  {t(`quizz:question.mediaPlaybackChoice.${playback}`)}
                </label>
              ))}
            </div>
          </div>
        )}
        {isTimedMedia(draft?.type) && (
          <p id={playbackHintId} className="text-accent-foreground text-sm">
            {playbackOf(media) === MEDIA_PLAYBACK.DEVICES &&
            isVideoMedia(draft.type)
              ? t(`quizz:question.mediaPlaysOnDevices.${draft.type}`)
              : t(`quizz:question.mediaPlaysOnScreen.${draft.type}`)}
          </p>
        )}

        {/* Where the preview will be. */}
        {!media && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-2">
            <ImageOff
              className="stroke-accent-foreground size-16"
              aria-hidden
            />
            <p className="text-accent-foreground text-center text-sm">
              {t("quizz:question.addMediaHint")}
            </p>
          </div>
        )}
      </Card>

      {renderPreview()}
    </div>
  )
}

export default QuestionEditorMedia
