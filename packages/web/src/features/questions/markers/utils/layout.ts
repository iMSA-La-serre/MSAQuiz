import type { QuestionMarker } from "@razzia/common/types/game"

// Where the markers land on the smallest screen that shows them, a phone:
// the editor's picture is larger, and markers well apart there can overlap
// in the game.

// The phone's picture: as high as its media block, 11rem, and at most as wide
// as the column of a 360 px screen, 16 px each side.
const PHONE_PICTURE = { width: 328, height: 176 }

// A phone chip with its white edge (MarkersImage), 44 px + 2 × 2 px.
const PHONE_CHIP = 48

// Room between two chips a new marker is given, so a thumb tells them apart.
const SPACING = PHONE_CHIP + 8

/** The size, in pixels, a picture of this shape takes on a phone. */
export const phonePicture = (
  ratio: number,
): { width: number; height: number } => {
  const width = Math.min(PHONE_PICTURE.width, PHONE_PICTURE.height * ratio)

  return { width, height: width / ratio }
}

// Where a chip's centre lands along one side of the picture: on its spot,
// kept inside the picture as markerStyle keeps it.
const centreOf = (percent: number, length: number): number => {
  const half = PHONE_CHIP / 2

  return Math.max(half, Math.min((percent / 100) * length, length - half))
}

const distanceOn =
  (ratio: number) =>
  (first: QuestionMarker, second: QuestionMarker): number => {
    const { width, height } = phonePicture(ratio)

    return Math.hypot(
      centreOf(first.x, width) - centreOf(second.x, width),
      centreOf(first.y, height) - centreOf(second.y, height),
    )
  }

/**
 * The markers whose chips overlap on a phone, as pairs of indices, each pair
 * in order: the top chip would hide part of the other, and a thumb could tap
 * the wrong one.
 */
export const crowdedMarkers = (
  markers: QuestionMarker[],
  ratio: number,
): Array<[number, number]> => {
  const distance = distanceOn(ratio)
  const pairs: Array<[number, number]> = []

  markers.forEach((marker, index) => {
    markers.slice(index + 1).forEach((other, offset) => {
      if (distance(marker, other) < PHONE_CHIP) {
        pairs.push([index, index + 1 + offset])
      }
    })
  })

  return pairs
}

// The spots a new marker may take, the middle of the picture first, then
// outwards, in reading order.
const STEPS = [50, 25, 75, 10, 90]

const CANDIDATES: QuestionMarker[] = STEPS.flatMap((y) =>
  STEPS.map((x) => ({ x, y })),
)

/**
 * Where a marker added without a pointer goes (the add button, the keyboard
 * on the image): the first spot, from the middle outwards, clear of every
 * other marker on a phone; failing that, the spot farthest from them. The
 * author moves it from there.
 */
export const freeSpot = (
  markers: QuestionMarker[],
  ratio: number,
): QuestionMarker => {
  const distance = distanceOn(ratio)
  const room = (spot: QuestionMarker) =>
    Math.min(Infinity, ...markers.map((marker) => distance(spot, marker)))

  const clear = CANDIDATES.find((spot) => room(spot) >= SPACING)

  if (clear) {
    return clear
  }

  return CANDIDATES.reduce((best, spot) =>
    room(spot) > room(best) ? spot : best,
  )
}
