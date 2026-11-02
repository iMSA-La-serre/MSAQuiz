import { AUTH_LIMITS } from "@razzia/common/constants"

const LOCK_MS = AUTH_LIMITS.LOCK_MINUTES * 60_000
// Identifiers followed at once: past this, the oldest are forgotten, so a
// flood of made-up identifiers cannot fill the memory.
const MAX_ENTRIES = 10_000

interface Failures {
  count: number
  last: number
  lockedUntil: number
}

/**
 * Failed sign-ins, by identifier: after MAX_FAILED_LOGINS in a row, the
 * identifier is refused for LOCK_MINUTES, password unchecked. Identifiers
 * that match no account are counted the same, so a refusal tells nothing
 * about which accounts exist. Kept in memory: a restart clears it.
 */
export default class LoginThrottle {
  private failures = new Map<string, Failures>()

  isLocked(key: string, now = Date.now()): boolean {
    return (this.failures.get(key)?.lockedUntil ?? 0) > now
  }

  fail(key: string, now = Date.now()): void {
    const previous = this.failures.get(key)
    // Failures spread over a longer time than a lock are not a series.
    const count =
      previous && now - previous.last < LOCK_MS ? previous.count + 1 : 1
    const locked = count >= AUTH_LIMITS.MAX_FAILED_LOGINS

    // Deleted first so the entry moves to the end of the insertion order.
    this.failures.delete(key)
    this.failures.set(key, {
      count: locked ? 0 : count,
      last: now,
      lockedUntil: locked ? now + LOCK_MS : 0,
    })

    if (this.failures.size > MAX_ENTRIES) {
      const oldest = this.failures.keys().next().value

      if (oldest !== undefined) {
        this.failures.delete(oldest)
      }
    }
  }

  succeed(key: string): void {
    this.failures.delete(key)
  }
}
