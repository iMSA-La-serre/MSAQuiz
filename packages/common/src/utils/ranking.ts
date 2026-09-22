// A ranking answer lists the proposals by priority: original indices, the
// most important first, every proposal exactly once. Nobody is right or
// wrong; the room's order comes from rank points, as a Borda count.

/**
 * Rank points of each proposal: a proposal put at rank r (from 1) in an
 * order of n scores n - r, so the first one scores n - 1 and the last one 0.
 * Indices outside the proposals are left out.
 */
export const rankPoints = (
  orders: Iterable<readonly number[]>,
  itemCount: number,
): number[] => {
  const points = Array.from({ length: itemCount }, () => 0)

  for (const order of orders) {
    order.forEach((item, rank) => {
      if (Number.isInteger(item) && item >= 0 && item < itemCount) {
        points[item] += itemCount - 1 - rank
      }
    })
  }

  return points
}

/**
 * The proposals in the room's order: the most points first, and the author's
 * order between proposals with as many.
 */
export const rankOrder = (points: readonly number[]): number[] =>
  points
    .map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value || a.index - b.index)
    .map(({ index }) => index)

/** Players who put each proposal first. */
export const firstChoices = (
  orders: Iterable<readonly number[]>,
  itemCount: number,
): number[] => {
  const counts = Array.from({ length: itemCount }, () => 0)

  for (const order of orders) {
    const first = order.at(0)

    if (first !== undefined && first >= 0 && first < itemCount) {
      counts[first] += 1
    }
  }

  return counts
}
