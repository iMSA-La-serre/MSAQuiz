import {
  crowdedMarkers,
  freeSpot,
  phonePicture,
} from "@razzia/web/features/questions/markers/utils/layout"
import { describe, expect, it } from "vitest"

const SQUARE = 1

const WIDE = 2

// Markers all over the picture, every 20 %.
const GRID = [10, 30, 50, 70, 90]

const EVERYWHERE = GRID.flatMap((y) => GRID.map((x) => ({ x, y })))

describe("phonePicture", () => {
  it("fills the phone's column with a wide picture", () => {
    expect(phonePicture(WIDE)).toEqual({ width: 328, height: 164 })
  })

  it("keeps the media block's height for a narrower one", () => {
    expect(phonePicture(SQUARE)).toEqual({ width: 176, height: 176 })
  })
})

describe("crowdedMarkers", () => {
  it("finds markers apart in the editor that overlap on a phone", () => {
    // 15 % of a 176 px picture: 26 px between the centres of 48 px chips.
    expect(
      crowdedMarkers(
        [
          { x: 40, y: 50 },
          { x: 55, y: 50 },
        ],
        SQUARE,
      ),
    ).toEqual([[0, 1]])
  })

  it("finds markers on the same spot", () => {
    expect(
      crowdedMarkers(
        [
          { x: 20, y: 30 },
          { x: 80, y: 70 },
          { x: 20, y: 30 },
        ],
        WIDE,
      ),
    ).toEqual([[0, 2]])
  })

  it("places a chip at an edge inside the picture, as the screens do", () => {
    // 0 % and 10 %: both chips end up against the left edge.
    expect(
      crowdedMarkers(
        [
          { x: 0, y: 50 },
          { x: 10, y: 50 },
        ],
        SQUARE,
      ),
    ).toEqual([[0, 1]])
  })

  it("leaves markers a thumb can tell apart", () => {
    expect(
      crowdedMarkers(
        [
          { x: 20, y: 50 },
          { x: 50, y: 50 },
          { x: 80, y: 50 },
        ],
        SQUARE,
      ),
    ).toEqual([])
  })
})

describe("freeSpot", () => {
  it("starts in the middle of the picture", () => {
    expect(freeSpot([], WIDE)).toEqual({ x: 50, y: 50 })
  })

  it("never puts a marker on another one", () => {
    const first = freeSpot([], WIDE)
    const second = freeSpot([first], WIDE)
    const third = freeSpot([first, second], WIDE)

    expect(second).toEqual({ x: 25, y: 50 })
    expect(crowdedMarkers([first, second, third], WIDE)).toEqual([])
  })

  it("keeps the room a thumb needs on a narrower picture", () => {
    const markers = [{ x: 50, y: 50 }]

    expect(
      crowdedMarkers([...markers, freeSpot(markers, SQUARE)], SQUARE),
    ).toEqual([])
  })

  it("falls back to the spot farthest from the others", () => {
    const spot = freeSpot(EVERYWHERE, SQUARE)

    expect(EVERYWHERE).not.toContainEqual(spot)
  })
})
