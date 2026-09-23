import {
  markerPercent,
  markersMultiple,
  markersOf,
  stackedMarker,
} from "@razzia/common/utils/markers"
import { describe, expect, it } from "vitest"

describe("markerPercent", () => {
  it("keeps a whole percentage of the image", () => {
    expect(markerPercent(0)).toBe(0)
    expect(markerPercent(42)).toBe(42)
    expect(markerPercent(100)).toBe(100)
  })

  it("rounds a fractional one", () => {
    expect(markerPercent(42.4)).toBe(42)
    expect(markerPercent(42.6)).toBe(43)
  })

  it("brings a position outside the image back inside", () => {
    expect(markerPercent(-10)).toBe(0)
    expect(markerPercent(140)).toBe(100)
  })

  it("falls back to the middle of the image", () => {
    expect(markerPercent(undefined)).toBe(50)
    expect(markerPercent("30")).toBe(50)
    expect(markerPercent(Number.NaN)).toBe(50)
  })
})

describe("markersOf", () => {
  it("gives one marker per label, as placed", () => {
    expect(
      markersOf({
        answers: ["Le tracteur", "La haie"],
        markers: [
          { x: 20, y: 30 },
          { x: 70, y: 80 },
        ],
      }),
    ).toEqual([
      { x: 20, y: 30 },
      { x: 70, y: 80 },
    ])
  })

  it("places a missing or broken marker in the middle", () => {
    expect(
      markersOf({
        answers: ["Le tracteur", "La haie", "Le fossé"],
        markers: [
          { x: 20, y: 30 },
          { x: 200, y: -5 },
        ],
      }),
    ).toEqual([
      { x: 20, y: 30 },
      { x: 100, y: 0 },
      { x: 50, y: 50 },
    ])
  })

  it("leaves out a marker no label has", () => {
    expect(
      markersOf({
        answers: ["Le tracteur"],
        markers: [
          { x: 20, y: 30 },
          { x: 70, y: 80 },
        ],
      }),
    ).toEqual([{ x: 20, y: 30 }])
  })
})

describe("markersMultiple", () => {
  it("is off with one right marker", () => {
    expect(markersMultiple({ solutions: [1], options: undefined })).toBe(false)
  })

  it("is on from two right markers on, as the server sees them", () => {
    expect(markersMultiple({ solutions: [0, 2], options: undefined })).toBe(
      true,
    )
  })

  it("is on from the public setting, as a player sees it", () => {
    expect(
      markersMultiple({ solutions: [], options: { multiple: true } }),
    ).toBe(true)
  })
})

describe("stackedMarker", () => {
  it("finds a marker on the spot of an earlier one", () => {
    expect(
      stackedMarker([
        { x: 20, y: 30 },
        { x: 50, y: 50 },
        { x: 50, y: 50 },
      ]),
    ).toBe(2)
  })

  it("compares the spots as they are stored, rounded", () => {
    expect(
      stackedMarker([
        { x: 20.4, y: 30 },
        { x: 19.6, y: 29.9 },
      ]),
    ).toBe(1)
  })

  it("finds none when every marker has a spot of its own", () => {
    expect(
      stackedMarker([
        { x: 20, y: 30 },
        { x: 21, y: 30 },
        { x: 20, y: 31 },
      ]),
    ).toBe(-1)
  })
})
