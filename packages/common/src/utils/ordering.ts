import { ORDER_SCORING } from "@razzia/common/constants"
import type { OrderScoring } from "@razzia/common/types/game"

// Whether each item is at its place. `order` lists original indices in the
// order the player chose: item i is at its place when order[i] === i.
export const placedItems = (order: readonly number[], length: number) =>
  Array.from({ length }, (_, index) => order[index] === index)

/**
 * Multiplier of an ordering answer: the share of items at their place
 * (position), or 1 only when every item is (exact).
 */
export const scoreOrdering = (
  order: readonly number[],
  length: number,
  mode: OrderScoring,
): number => {
  if (length === 0) {
    return 0
  }

  const placed = placedItems(order, length).filter(Boolean).length

  if (mode === ORDER_SCORING.EXACT) {
    return placed === length ? 1 : 0
  }

  return placed / length
}
