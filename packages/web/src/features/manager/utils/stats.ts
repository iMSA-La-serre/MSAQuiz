/** A success rate as a percentage, or a dash when there is nothing to rate. */
export const formatRate = (rate: number | null): string =>
  rate === null ? "—" : `${Math.round(rate * 100)} %`

/** Green when the question went well, amber in between, red when it hurt. */
export const rateColor = (rate: number | null): string => {
  if (rate === null) {
    return "bg-neutral-mark"
  }

  if (rate >= 0.7) {
    return "bg-success"
  }

  return rate >= 0.4 ? "bg-warning" : "bg-danger"
}
