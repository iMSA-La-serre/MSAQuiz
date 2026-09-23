/**
 * The DOM a player is handed over in, reduced to what the hand-over uses, so
 * it can be told apart from React's own nodes (and tested without a DOM).
 */
export interface StageNode {
  readonly parentNode: unknown
  readonly isConnected: boolean
  append: (_node: never) => void
  // Moves a node without taking it out of the page (Chromium since 133):
  // an <iframe> keeps its page, a full-screen element stays full screen.
  moveBefore?: (_node: never, _child: null) => void
}

/**
 * Puts `node` last in `parent`, moving it without taking it out of the page
 * when the browser can (Element.moveBefore) and both are in it. Otherwise,
 * or if the browser refuses the move, a plain append: a <video> or an
 * <audio> plays on, an <iframe> reloads its page.
 */
export const moveInto = (parent: StageNode, node: StageNode): void => {
  if (node.parentNode === parent) {
    return
  }

  if (
    typeof parent.moveBefore === "function" &&
    parent.isConnected &&
    node.isConnected
  ) {
    try {
      parent.moveBefore(node as never, null)

      return
    } catch {
      // Another document, or a node the browser will not move: appended.
    }
  }

  parent.append(node as never)
}

let parking: HTMLElement | null = null

// A node of the page that no screen owns, where a player waits between two
// screens of its question.
const parkingNode = (): HTMLElement => {
  if (!parking?.isConnected) {
    parking = document.createElement("div")
    parking.hidden = true
    parking.dataset.mediaParking = ""
    document.body.append(parking)
  }

  return parking
}

/** Shows the player in the frame of the screen that shows it now. */
export const placeMediaElement = (element: HTMLElement, slot: HTMLElement) => {
  moveInto(slot, element)
}

/**
 * Takes the player out of a screen that is going away, into the page: React
 * removes the screen's nodes only after this (a layout effect's cleanup), so
 * the player never leaves the page, and the next screen takes it from here
 * in the same commit (placeMediaElement).
 */
export const parkMediaElement = (element: HTMLElement) => {
  moveInto(parkingNode(), element)
}
