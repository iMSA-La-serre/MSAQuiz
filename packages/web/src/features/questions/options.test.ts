import { SCORING_MODES } from "@razzia/common/constants"
import {
  scoringModeLabelKey,
  withoutOption,
} from "@razzia/web/features/questions/options"
import { describe, expect, it } from "vitest"

describe("scoringModeLabelKey", () => {
  it("names the scoring mode, or nothing", () => {
    expect(scoringModeLabelKey({ scoringMode: SCORING_MODES.STRICT })).toBe(
      "quizz:question.config.scoringMode.strict",
    )
    expect(scoringModeLabelKey(undefined)).toBeNull()
  })
})

describe("withoutOption", () => {
  it("drops the setting and keeps the others", () => {
    expect(
      withoutOption(
        { scoringMode: SCORING_MODES.BALANCED, multiple: true, unit: "km" },
        "multiple",
      ),
    ).toEqual({ scoringMode: SCORING_MODES.BALANCED, unit: "km" })
  })

  it("leaves no settings when the scoring mode alone is left", () => {
    expect(
      withoutOption(
        { scoringMode: SCORING_MODES.BALANCED, credits: [0, 100] },
        "credits",
      ),
    ).toBeUndefined()
    expect(withoutOption({ multiple: true }, "multiple")).toBeUndefined()
    expect(withoutOption(undefined, "multiple")).toBeUndefined()
  })
})
