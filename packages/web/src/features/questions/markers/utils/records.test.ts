import type { PlayerAnswerRecord } from "@razzia/common/types/game"
import {
  creditedAnswers,
  isMarkersCorrect,
  markersVerdict,
  pickedMarkers,
} from "@razzia/web/features/questions/markers/utils/records"
import { describe, expect, it } from "vitest"

const record = (
  answerIds: number[] | null,
  score?: number,
): PlayerAnswerRecord => ({
  playerName: "Alice",
  answerIds,
  ...(score !== undefined && { score }),
})

describe("pickedMarkers", () => {
  it("lists the markers tapped by their numbers", () => {
    expect(pickedMarkers(record([2, 0]))).toEqual([0, 2])
  })

  it("lists nothing without an answer", () => {
    expect(pickedMarkers(record(null))).toEqual([])
  })

  it("does not change the record", () => {
    const tapped = record([2, 0])

    pickedMarkers(tapped)

    expect(tapped.answerIds).toEqual([2, 0])
  })
})

describe("markersVerdict", () => {
  const single = { solutions: [1] }
  const several = { solutions: [0, 2] }

  it("is correct for the right marker, wrong for another", () => {
    expect(markersVerdict(single, record([1], 1))).toBe("correct")
    expect(markersVerdict(single, record([0], 0))).toBe("wrong")
  })

  it("counts any credit earned as correct, as on a multiple choice", () => {
    expect(markersVerdict(several, record([0], 0.5))).toBe("correct")
  })

  it("follows the saved multiplier when a wrong marker cost it all", () => {
    expect(markersVerdict(several, record([0, 1], 0))).toBe("wrong")
  })

  it("credits a right marker tapped when no multiplier was saved", () => {
    expect(markersVerdict(several, record([0, 1]))).toBe("correct")
    expect(markersVerdict(several, record([1]))).toBe("wrong")
  })

  it("tells a missing answer apart", () => {
    expect(markersVerdict(single, record(null))).toBe("noAnswer")
    expect(markersVerdict(single, record([]))).toBe("noAnswer")
  })
})

describe("isMarkersCorrect", () => {
  const several = { solutions: [1, 4] }

  it("follows the saved multiplier, as the rows and the server do", () => {
    // Strict: one right marker out of two is worth nothing.
    expect(isMarkersCorrect(several, record([1], 0))).toBe(false)
    // Balanced: a wrong marker cancels the right one.
    expect(isMarkersCorrect(several, record([1, 0], 0))).toBe(false)
    // Balanced: one right marker out of two, half the credit.
    expect(isMarkersCorrect(several, record([1], 0.5))).toBe(true)
    expect(isMarkersCorrect(several, record([1, 4], 1))).toBe(true)
  })

  it("never counts a missing answer", () => {
    expect(isMarkersCorrect(several, record(null))).toBe(false)
  })
})

describe("creditedAnswers", () => {
  it("counts full and partial credit alike, as the phones say correct", () => {
    expect(creditedAnswers({ correctCount: 2, partialCount: 1 })).toBe(3)
  })

  it("reads missing counts as none", () => {
    expect(creditedAnswers({ correctCount: 2 })).toBe(2)
    expect(creditedAnswers({})).toBe(0)
  })
})
