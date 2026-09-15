// Building blocks shared by MSAQuiz's sound generators. Every sound is
// computed from these functions: no samples, no third-party material.

export const SAMPLE_RATE = 44100

export interface BarPartial {
  ratio: number
  amplitude: number
  decay: number
}

interface MasterOptions {
  rmsDb: number
  peakCeilingDb: number
  fadeOut?: number
}

interface LoopSound {
  start: number
  duration: number
  sampleAt: (_time: number) => number
}

export const dbToGain = (db: number): number => 10 ** (db / 20)

// Smooth 0 -> 1 ramp, avoids the click a hard attack or cut would produce.
export const smoothRamp = (x: number): number => {
  const clamped = Math.min(Math.max(x, 0), 1)

  return Math.sin((clamped * Math.PI) / 2) ** 2
}

export const render = (
  duration: number,
  sampleAt: (_time: number) => number,
): Float64Array => {
  const length = Math.round(duration * SAMPLE_RATE)
  const samples = new Float64Array(length)

  for (let i = 0; i < length; i += 1) {
    samples[i] = sampleAt(i / SAMPLE_RATE)
  }

  return samples
}

// Scales the sound to a target RMS level, without letting the peak go above
// the ceiling, then fades the last milliseconds to silence.
export const master = (
  samples: Float64Array,
  { rmsDb, peakCeilingDb, fadeOut = 0.01 }: MasterOptions,
): Float64Array => {
  const sumSquares = samples.reduce((sum, value) => sum + value * value, 0)
  const rms = Math.sqrt(sumSquares / samples.length)
  const peak = samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0)
  const gain = Math.min(dbToGain(rmsDb) / rms, dbToGain(peakCeilingDb) / peak)
  const fadeLength = Math.round(fadeOut * SAMPLE_RATE)

  return samples.map((value, i) => {
    // A loop must not fade: its end joins its start.
    if (fadeLength === 0) {
      return value * gain
    }

    const remaining = samples.length - 1 - i

    return value * gain * smoothRamp(remaining / fadeLength)
  })
}

// A tuned wooden bar: its partials follow a marimba (about 1 : 3.9 : 9.2),
// each decaying faster than the one below it.
export const marimbaBar = (
  t: number,
  fundamental: number,
  partials: BarPartial[],
): number =>
  partials.reduce(
    (sum, { ratio, amplitude, decay }) =>
      sum +
      amplitude *
        Math.sin(2 * Math.PI * fundamental * ratio * t) *
        Math.exp(-t / decay),
    0,
  )

export const midiToFrequency = (note: number): number =>
  440 * 2 ** ((note - 69) / 12)

// A struck wooden bar, ready to be placed anywhere in time.
export const struck =
  (note: number, partials: BarPartial[], level: number) =>
  (t: number): number =>
    level *
    smoothRamp(t / 0.002) *
    marimbaBar(t, midiToFrequency(note), partials)

// Adds a sound into a looping buffer: whatever rings past the end wraps back
// to the start, so the loop joins without a click or a gap.
export const addToLoop = (
  buffer: Float64Array,
  { start, duration, sampleAt }: LoopSound,
): void => {
  const first = Math.round(start * SAMPLE_RATE)
  const count = Math.round(duration * SAMPLE_RATE)

  for (let i = 0; i < count; i += 1) {
    const index = (first + i) % buffer.length

    buffer[index] += sampleAt(i / SAMPLE_RATE)
  }
}
