/**
 * Marks a control of the host's screen that has no use for the arrow and page
 * keys (a media control): while it has the focus, the presentation remote
 * still moves the game on (see HostDock).
 */
export const REMOTE_SAFE_ATTRIBUTE = "data-host-control"

// Where a key is typed: a shortcut must leave it alone.
export const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.closest("input, textarea, select") !== null)
