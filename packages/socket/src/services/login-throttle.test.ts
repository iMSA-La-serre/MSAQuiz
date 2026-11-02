import { AUTH_LIMITS } from "@razzia/common/constants"
import LoginThrottle from "@razzia/socket/services/login-throttle"
import { describe, expect, it } from "vitest"

const MINUTE = 60_000
const LOCK = AUTH_LIMITS.LOCK_MINUTES * MINUTE

const failTimes = (throttle: LoginThrottle, key: string, times: number) => {
  for (let i = 0; i < times; i += 1) {
    throttle.fail(key, i * 1000)
  }
}

describe("LoginThrottle", () => {
  it("refuses an identifier after a series of failures, for a while", () => {
    const throttle = new LoginThrottle()

    failTimes(throttle, "camille@msa.fr", AUTH_LIMITS.MAX_FAILED_LOGINS - 1)
    expect(throttle.isLocked("camille@msa.fr", 5000)).toBe(false)

    throttle.fail("camille@msa.fr", 5000)
    expect(throttle.isLocked("camille@msa.fr", 5000)).toBe(true)
    expect(throttle.isLocked("camille@msa.fr", 5000 + LOCK - 1)).toBe(true)
    expect(throttle.isLocked("camille@msa.fr", 5000 + LOCK)).toBe(false)
  })

  it("leaves the other identifiers alone", () => {
    const throttle = new LoginThrottle()

    failTimes(throttle, "camille@msa.fr", AUTH_LIMITS.MAX_FAILED_LOGINS)

    expect(throttle.isLocked("dominique@msa.fr", 5000)).toBe(false)
  })

  it("starts the count again after a success", () => {
    const throttle = new LoginThrottle()

    failTimes(throttle, "camille@msa.fr", AUTH_LIMITS.MAX_FAILED_LOGINS - 1)
    throttle.succeed("camille@msa.fr")
    throttle.fail("camille@msa.fr", 10_000)

    expect(throttle.isLocked("camille@msa.fr", 10_000)).toBe(false)
  })

  it("does not add up failures far apart", () => {
    const throttle = new LoginThrottle()

    for (let i = 0; i < AUTH_LIMITS.MAX_FAILED_LOGINS; i += 1) {
      throttle.fail("camille@msa.fr", i * (LOCK + MINUTE))
    }

    expect(
      throttle.isLocked(
        "camille@msa.fr",
        (AUTH_LIMITS.MAX_FAILED_LOGINS - 1) * (LOCK + MINUTE),
      ),
    ).toBe(false)
  })

  it("forgets the oldest identifiers past its size", () => {
    const throttle = new LoginThrottle()

    failTimes(throttle, "first@msa.fr", AUTH_LIMITS.MAX_FAILED_LOGINS)

    for (let i = 0; i < 10_000; i += 1) {
      throttle.fail(`made-up-${i}@msa.fr`, 5000)
    }

    expect(throttle.isLocked("first@msa.fr", 5000)).toBe(false)
  })
})
