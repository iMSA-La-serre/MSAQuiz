// The order a player builds on the phone: indices of the list shown, in the
// order they were tapped. An item's position is its rank in this sequence.

/** Position of an item, from 1, or null while it has none. */
export const positionOf = (
  sequence: readonly number[],
  item: number,
): number | null => {
  const index = sequence.indexOf(item)

  return index === -1 ? null : index + 1
}

/**
 * The sequence after a tap: an item without a position takes the next one;
 * an item with a position loses it, and every item after it moves up one.
 */
export const toggleItem = (
  sequence: readonly number[],
  item: number,
): number[] =>
  sequence.includes(item)
    ? sequence.filter((entry) => entry !== item)
    : [...sequence, item]

/** Whether each of the `length` items has a position. */
export const isComplete = (
  sequence: readonly number[],
  length: number,
): boolean => length > 0 && new Set(sequence).size === length

/**
 * Where an item of the correct order stood in the shuffled list the players
 * were shown (publicOrder[shown] = item), which gives its letter. Null when
 * that list is unknown or lacks the item: any letter would be a guess.
 */
export const shownPosition = (
  publicOrder: readonly number[] | undefined,
  item: number,
): number | null => {
  const shown = publicOrder?.indexOf(item) ?? -1

  return shown === -1 ? null : shown
}
