// MSAQuiz motion language: fade in with a short rise, never scale or bounce.
export const EASE_OUT_QUART: [number, number, number, number] = [
  0.25, 1, 0.5, 1,
]

export const ENTER_DURATION = 0.3

export const STAGGER_STEP = 0.06

export const enter = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: ENTER_DURATION, delay, ease: EASE_OUT_QUART },
})

export const staggerDelay = (index: number, base = 0.12) =>
  base + index * STAGGER_STEP
