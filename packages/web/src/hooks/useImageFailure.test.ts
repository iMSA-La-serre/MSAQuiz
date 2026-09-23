import { imageFailures } from "@razzia/web/hooks/useImageFailure"
import { describe, expect, it, vi } from "vitest"

describe("imageFailures", () => {
  it("forgets an address once it loads again", () => {
    const url = "https://intranet.example/plan.png"
    const listener = vi.fn()
    const unsubscribe = imageFailures.subscribe(listener)

    imageFailures.fail(url)
    expect(imageFailures.has(url)).toBe(true)
    // A second failure of the same address changes nothing.
    imageFailures.fail(url)
    expect(listener).toHaveBeenCalledTimes(1)

    // Tried again behind the neutral block, and loaded: every screen that
    // shows it is told, and shows the picture.
    imageFailures.recover(url)
    expect(imageFailures.has(url)).toBe(false)
    expect(listener).toHaveBeenCalledTimes(2)

    // Nothing to tell for an address that never failed.
    imageFailures.recover(url)
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    imageFailures.fail(url)
    expect(listener).toHaveBeenCalledTimes(2)
    imageFailures.recover(url)
  })
})
