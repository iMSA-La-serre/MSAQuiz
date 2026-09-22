import { rangeIcon } from "@razzia/web/features/questions/estimate/utils/range-icon"
import {
  Check,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  ChevronUp,
} from "lucide-react"
import { describe, expect, it } from "vitest"

describe("rangeIcon", () => {
  it("ticks the right range, single chevrons next to it, doubled past", () => {
    expect([-2, -1, 0, 1, 2].map(rangeIcon)).toEqual([
      ChevronsDown,
      ChevronDown,
      Check,
      ChevronUp,
      ChevronsUp,
    ])
    expect(rangeIcon(-4)).toBe(ChevronsDown)
  })
})
