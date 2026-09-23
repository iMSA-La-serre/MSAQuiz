/** Tells a listener when an element goes full screen, or leaves it. */
export const subscribeFullscreen = (listener: () => void) => {
  document.addEventListener("fullscreenchange", listener)

  return () => {
    document.removeEventListener("fullscreenchange", listener)
  }
}

export const fullscreenElement = () => document.fullscreenElement

/**
 * Puts the player's box full screen, or leaves full screen. The browser asks
 * for a gesture on the page (a click, a key): refused otherwise, silently.
 */
export const toggleFullscreen = (element: HTMLElement | null) => {
  if (document.fullscreenElement) {
    void document.exitFullscreen().catch(() => undefined)

    return
  }

  void element?.requestFullscreen().catch(() => undefined)
}
