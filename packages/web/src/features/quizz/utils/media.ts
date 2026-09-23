import { MEDIA_PLAYBACK } from "@razzia/common/constants"
import type {
  MediaPlayback,
  QuestionMedia,
  QuestionMediaType,
} from "@razzia/common/types/game"
import {
  isVideoMedia,
  mediaIssue,
  mediaTypeOf,
} from "@razzia/common/utils/media"

type MediaType = NonNullable<QuestionMediaType>

// The type the author picked against the one the address told (the sound of
// a video file), and what the address told then.
export interface TypePick {
  type: MediaType
  told: QuestionMediaType
}

/**
 * The pick a media carries: its type, when its address tells another one or
 * none. Undefined when the address tells the media's type.
 */
export const pickOf = (media?: QuestionMedia): TypePick | undefined => {
  if (media?.type === undefined) {
    return undefined
  }

  const told = mediaTypeOf(media.url)

  return media.type === told ? undefined : { type: media.type, told }
}

/**
 * Whether a pick still holds for a new address: while the address tells the
 * same type as when it was picked, or nothing (an address being typed tells
 * nothing for a moment); not once it tells another one.
 */
export const keepsPick = (
  pick: TypePick | undefined,
  url: string,
): pick is TypePick => {
  if (pick === undefined) {
    return false
  }

  const told = mediaTypeOf(url)

  return told === undefined || told === pick.told
}

/**
 * The media once the author types or pastes an address: none when the field
 * is cleared, so the question saves without one; otherwise the type the
 * author picked while it holds (see keepsPick), else the type the new
 * address tells, else the one it had. The pick is the media's own by
 * default; the editor passes the one it keeps across the keystrokes. Where a
 * video plays stays as it was; a sound and an image play on the screen.
 */
export const mediaForUrl = (
  current: QuestionMedia | undefined,
  url: string,
  pick: TypePick | undefined = pickOf(current),
): QuestionMedia | undefined => {
  if (url.trim() === "") {
    return undefined
  }

  const type =
    (keepsPick(pick, url) ? pick.type : undefined) ??
    mediaTypeOf(url) ??
    current?.type
  const playback =
    current?.playback !== undefined && isVideoMedia(type)
      ? { playback: current.playback }
      : {}

  return type === undefined ? { url } : { type, url, ...playback }
}

/**
 * The media once the author picks its type: where it plays stays with a
 * video (a file or YouTube's), never with a sound or an image, which play on
 * the projected screen.
 */
export const mediaWithType = (
  { playback, ...media }: QuestionMedia,
  type: MediaType,
): QuestionMedia =>
  playback !== undefined && isVideoMedia(type)
    ? { ...media, type, playback }
    : { ...media, type }

/**
 * Where a video plays, as the author picks it: on every device is kept; the
 * projected screen, the default, is kept as no setting at all, as every quiz
 * saved before the choice existed.
 */
export const mediaWithPlayback = (
  { playback: _playback, ...media }: QuestionMedia,
  playback: MediaPlayback,
): QuestionMedia =>
  playback === MEDIA_PLAYBACK.DEVICES ? { ...media, playback } : media

export interface MediaDraft {
  // The type the media is shown and saved with: the one picked, else the one
  // its address tells, as a save fills it in.
  type: QuestionMediaType
  // Why the save would refuse it, as an error key.
  issue?: string
  // The address the preview loads.
  url: string
}

export const mediaDraftOf = (media: QuestionMedia): MediaDraft => {
  const type = media.type ?? mediaTypeOf(media.url)

  return {
    type,
    issue: mediaIssue({ type, url: media.url }),
    url: media.url.trim(),
  }
}
