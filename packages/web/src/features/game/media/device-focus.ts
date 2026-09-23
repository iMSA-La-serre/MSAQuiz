/**
 * On a phone, where the keyboard focus goes once the control that had it is
 * gone: replaced by what it asked for (« Regarder ici » gives it to the
 * player's controls; « Non, je regarde l'écran » and « Ne plus regarder
 * ici » to what points to the projected screen), or moved to the next
 * screen of the question (the answers opening, the waiting screen), where
 * the same block shows again. Set within the tap, or as the block goes;
 * taken once by what shows in its place; forgotten if nothing does at once.
 */
export type FocusTarget = "offer" | "player" | "screen"

export interface HandedFocus {
  target: FocusTarget
  // Which control of the block had it (data-device-control), if any.
  control?: string
  at: number
}

// Milliseconds within which what shows in the control's place takes the
// focus: the next render, never a later screen.
const HAND_OFF_WITHIN = 1000

let handed: HandedFocus | null = null

const fresh = (current: HandedFocus | null): current is HandedFocus =>
  current !== null && performance.now() - current.at <= HAND_OFF_WITHIN

/** Within the tap: `target` takes the focus when it shows. */
export const handFocusTo = (target: FocusTarget, control?: string): void => {
  handed = { target, control, at: performance.now() }
}

/**
 * A block that had the focus goes (the next screen of the question shows it
 * again): its copy takes it, unless a tap already said where it goes.
 */
export const keepFocus = (target: FocusTarget, control?: string): void => {
  if (!fresh(handed)) {
    handFocusTo(target, control)
  }
}

/** What `target`, which just showed, takes the focus for: once, or null. */
export const takeFocus = (target: FocusTarget): HandedFocus | null => {
  const current = handed

  if (!fresh(current) || current.target !== target) {
    return null
  }

  handed = null

  return current
}
