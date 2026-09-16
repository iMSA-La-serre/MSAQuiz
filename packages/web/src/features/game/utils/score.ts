// Share of one answer among the players who answered, from 0 to 1. On a multi
// question a player can tick several answers, so the shares of all answers may
// add up to more than 1.
export const shareOf = (count: number, total: number): number => {
  if (total <= 0) {
    return 0
  }

  return Math.min(1, Math.max(0, count / total))
}
