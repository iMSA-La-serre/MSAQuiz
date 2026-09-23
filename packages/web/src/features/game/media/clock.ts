const twoDigits = (value: number) => String(value).padStart(2, "0")

/**
 * A position in a media as a player's clock shows it: 0:07, 12:05, 1:02:03.
 * Not known yet: --:--.
 */
export const formatClock = (seconds: number | null): string => {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return "--:--"
  }

  const whole = Math.floor(seconds)
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const rest = twoDigits(whole % 60)

  return hours > 0
    ? `${hours}:${twoDigits(minutes)}:${rest}`
    : `${minutes}:${rest}`
}

/** How far into the media, from 0 to 1; 0 while its length is not known. */
export const progressOf = (position: number, duration: number | null) =>
  duration !== null && duration > 0
    ? Math.min(1, Math.max(0, position / duration))
    : 0
