import { categorizeHint } from "@razzia/web/features/questions/categorize/utils/hint"
import type { TFunction } from "i18next"
import { describe, expect, it } from "vitest"

// Returns the key and its values, as i18next would fill them in.
const t = ((key: string, values?: Record<string, unknown>) =>
  values ? `${key} ${JSON.stringify(values)}` : key) as unknown as TFunction

const hint = (targets: string[], size: "host" | "phone" = "host") =>
  categorizeHint(t, undefined, { targets, size })

describe("categorizeHint", () => {
  it("names the categories on the projector, the last one after « ou »", () => {
    expect(hint(["Famille", "Retraite", "Maladie"])).toBe(
      'game:answer.categorizeHint {"targets":"Famille, Retraite ou Maladie"}',
    )
    expect(hint(["Salarié", " Non-salarié "])).toBe(
      'game:answer.categorizeHint {"targets":"Salarié ou Non-salarié"}',
    )
  })

  it("keeps the phone's hint short: its rows show the categories", () => {
    expect(hint(["Famille", "Retraite"], "phone")).toBe(
      "game:answer.categorizeHintAny",
    )
  })

  it("falls back on a general hint without categories", () => {
    expect(hint([])).toBe("game:answer.categorizeHintAny")
    expect(hint(["  "])).toBe("game:answer.categorizeHintAny")
  })
})
