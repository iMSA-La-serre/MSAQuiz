// "Funk sous la serre": the music heard while players answer, on the host
// screen only. An 8-bar funk groove at 110 BPM in A minor / dorian: drums with
// a backbeat and ghost notes, a syncopated bass, electric piano stabs, then
// shaker, congas and a short wooden answer phrase in the second half, and a
// tom fill that relaunches the loop.
//
// Everything is synthesised and deterministic: noise comes from a seeded
// table, and every note that rings past the end wraps back to the start.

import {
  addToLoop,
  type BarPartial,
  dbToGain,
  master,
  midiToFrequency,
  SAMPLE_RATE,
  smoothRamp,
  struck,
} from "./sound-kit.ts"

type Voice = (_time: number) => number

interface MembraneOptions {
  frequency: number
  drop: number
  decay: number
  level: number
}

// [step, interval above the root, length in sixteenths]
type BassNote = [number, number, number]

// [step, length in seconds]
type Stab = [number, number]

interface BarPatterns<T> {
  even: T
  odd: T
  fill: T
}

const TAU = 2 * Math.PI

// ------------------------------------------------------------------ noise ---

const mulberry32 = (seed: number) => {
  let state = seed >>> 0

  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0

    let t = state

    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NOISE_LENGTH = 1 << 18

const NOISE = (() => {
  const random = mulberry32(0x5e77e)
  const table = new Float64Array(NOISE_LENGTH)

  for (let i = 0; i < NOISE_LENGTH; i += 1) {
    table[i] = random() * 2 - 1
  }

  return table
})()

let noiseCursor = 0

// Each hit reads its own stretch of the seeded noise table.
const noiseReader = (): Voice => {
  const offset = noiseCursor

  noiseCursor = (noiseCursor + 12347) % NOISE_LENGTH

  return (t) => NOISE[(offset + Math.round(t * SAMPLE_RATE)) % NOISE_LENGTH]
}

const onePole = (cutoff: number): number =>
  1 - Math.exp((-TAU * cutoff) / SAMPLE_RATE)

// ----------------------------------------------------------------- timing ---

const BPM = 110
const BEAT = 60 / BPM
const BAR = BEAT * 4
const SIXTEENTH = BEAT / 4
const SWING = 0.17
const BARS = 8
const LOOP_SECONDS = BAR * BARS

const at = (bar: number, step: number): number =>
  bar * BAR + step * SIXTEENTH + (step % 2 === 1 ? SWING * SIXTEENTH : 0)

const forBar = <T>(bar: number, patterns: BarPatterns<T>): T => {
  if (bar === BARS - 1) {
    return patterns.fill
  }

  return bar % 2 === 0 ? patterns.even : patterns.odd
}

// ------------------------------------------------------------ instruments ---

const kick = (level: number): Voice => {
  let phase = 0
  const click = noiseReader()

  return (t) => {
    const frequency = 45 + 80 * Math.exp(-t / 0.028)

    phase += (TAU * frequency) / SAMPLE_RATE

    const body = Math.sin(phase) * Math.exp(-t / 0.12) * smoothRamp(t / 0.001)
    const tick =
      0.35 * smoothRamp(t / 0.0003) * click(t) * Math.exp(-t / 0.0025)

    return level * (body + tick)
  }
}

const snare = (level: number): Voice => {
  const noise = noiseReader()
  let low = 0
  let low2 = 0
  const aHigh = onePole(900)
  const aLow = onePole(7000)
  let phase = 0

  return (t) => {
    const n = noise(t)

    low += aHigh * (n - low)

    const high = n - low

    low2 += aLow * (high - low2)
    phase += (TAU * (190 + 40 * Math.exp(-t / 0.01))) / SAMPLE_RATE

    const tone = 0.45 * Math.sin(phase) * Math.exp(-t / 0.04)
    const rattle = 1.25 * low2 * Math.exp(-t / 0.12)

    return level * smoothRamp(t / 0.0008) * (tone + rattle)
  }
}

const hat = (level: number, decay: number): Voice => {
  const noise = noiseReader()
  let low = 0
  let low2 = 0
  const aHigh = onePole(6500)
  const aHigh2 = onePole(9000)

  return (t) => {
    const n = noise(t)

    low += aHigh * (n - low)

    const high = n - low

    low2 += aHigh2 * (high - low2)

    const brighter = high - low2 * 0.4

    return level * smoothRamp(t / 0.0006) * brighter * Math.exp(-t / decay)
  }
}

const shaker = (level: number): Voice => {
  const noise = noiseReader()
  let low = 0
  const aHigh = onePole(4500)

  return (t) => {
    const n = noise(t)

    low += aHigh * (n - low)

    const envelope = smoothRamp(t / 0.012) * Math.exp(-t / 0.035)

    return level * (n - low) * envelope
  }
}

// A drum skin: a sine with a small pitch drop plus a noise transient (congas,
// toms).
const membrane = ({
  frequency,
  drop,
  decay,
  level,
}: MembraneOptions): Voice => {
  let phase = 0
  const noise = noiseReader()

  return (t) => {
    phase += (TAU * frequency * (1 + drop * Math.exp(-t / 0.02))) / SAMPLE_RATE

    const body = Math.sin(phase) * Math.exp(-t / decay)
    const slap = 0.25 * noise(t) * Math.exp(-t / 0.004)

    return level * smoothRamp(t / 0.001) * (body + slap)
  }
}

// An additive saw with a decaying low-pass (per-harmonic roll-off) and a sub
// sine.
const bass = (note: number, length: number, level: number): Voice => {
  const f = midiToFrequency(note)
  const harmonics = Math.min(40, Math.floor(5000 / f))

  return (t) => {
    const cutoff = 180 + 1400 * Math.exp(-t / 0.07)
    let sum = 0

    for (let k = 1; k <= harmonics; k += 1) {
      const fk = f * k
      const weight = 1 / Math.sqrt(1 + (fk / cutoff) ** 4)

      sum += (weight / k) * Math.sin(TAU * fk * t)
    }

    const sub = 0.25 * Math.sin(TAU * f * t)
    const envelope =
      smoothRamp(t / 0.004) *
      smoothRamp((length - t) / 0.03) *
      (0.55 + 0.45 * Math.exp(-t / 0.18))

    return level * envelope * (0.7 * sum + sub)
  }
}

// A two-operator FM electric piano (rhodes-like), for short stabs.
const electricPiano = (note: number, length: number, level: number): Voice => {
  const f = midiToFrequency(note)

  return (t) => {
    const index = 2.2 * Math.exp(-t / 0.06) + 0.5
    const modulator = index * Math.sin(TAU * f * t)
    const carrier = Math.sin(TAU * f * t + modulator)
    const bark = 0.12 * Math.sin(TAU * f * 7 * t) * Math.exp(-t / 0.012)
    const envelope =
      smoothRamp(t / 0.003) *
      smoothRamp((length - t) / 0.06) *
      Math.exp(-t / 0.5)

    return level * envelope * (carrier + bark)
  }
}

// ------------------------------------------------------------------ score ---

// Bass root and electric piano voicing per bar (MIDI notes): Am9, Am9, D9,
// Am9, Fmaj9, E7#9, Am9, E7#9.
const CHORDS: Array<{ root: number; voicing: number[] }> = [
  { root: 45, voicing: [55, 59, 60, 64] },
  { root: 45, voicing: [55, 59, 60, 64] },
  { root: 50, voicing: [54, 57, 60, 64] },
  { root: 45, voicing: [55, 59, 60, 64] },
  { root: 53, voicing: [57, 60, 64, 67] },
  { root: 52, voicing: [56, 62, 67] },
  { root: 45, voicing: [55, 59, 60, 64] },
  { root: 52, voicing: [56, 62, 67] },
]

// Sixteenth-note steps of the kick, bar by bar.
const KICKS = [
  [0, 7, 10],
  [0, 3, 10, 13],
  [0, 7, 10],
  [0, 3, 7, 10, 14],
  [0, 7, 10],
  [0, 3, 10, 13],
  [0, 6, 10, 11],
  [0, 7],
]

// Quiet snare ghost notes, bar by bar.
const GHOSTS = [
  [7, 9],
  [9, 15],
  [7, 9, 14],
  [9, 15],
  [7, 9],
  [6, 9, 15],
  [7, 9, 14],
  [],
]

const BASS: BarPatterns<BassNote[]> = {
  even: [
    [0, 0, 2],
    [3, 12, 1],
    [6, 10, 1],
    [7, 12, 1],
    [10, 0, 2],
    [13, 7, 1],
    [14, 12, 1],
  ],
  odd: [
    [0, 0, 1],
    [2, 12, 1],
    [3, 0, 1],
    [6, 3, 1],
    [7, 5, 1],
    [8, 7, 2],
    [11, 12, 1],
    [14, 10, 1],
    [15, 12, 1],
  ],
  fill: [
    [0, 0, 2],
    [3, 12, 1],
    [6, 10, 1],
    [8, 7, 1],
    [10, 3, 1],
    [11, 0, 1],
    [14, 12, 1],
    [15, 10, 1],
  ],
}

const STABS: BarPatterns<Stab[]> = {
  even: [
    [2, 0.2],
    [7, 0.1],
    [10, 0.26],
  ],
  odd: [
    [3, 0.12],
    [6, 0.12],
    [11, 0.22],
    [14, 0.1],
  ],
  fill: [
    [2, 0.2],
    [6, 0.12],
  ],
}

// The wooden answer phrase in bars 5 and 6: [bar, step, MIDI note].
const MARIMBA: Array<[number, number, number]> = [
  [4, 2, 76],
  [4, 3, 79],
  [4, 6, 81],
  [4, 10, 84],
  [4, 11, 83],
  [4, 14, 81],
  [5, 2, 79],
  [5, 6, 76],
  [5, 7, 74],
  [5, 10, 76],
  [5, 13, 71],
]

const WOOD: BarPartial[] = [
  { ratio: 1, amplitude: 1, decay: 0.18 },
  { ratio: 3.93, amplitude: 0.2, decay: 0.03 },
  { ratio: 9.2, amplitude: 0.04, decay: 0.008 },
]

const hatLevel = (step: number, open: boolean): number => {
  if (open) {
    return 0.3
  }

  if (step % 4 === 2) {
    return 0.34
  }

  return step % 2 === 0 ? 0.24 : 0.13
}

const addDrums = (drums: Float64Array, bar: number): void => {
  const isFill = bar === BARS - 1

  for (const step of KICKS[bar]) {
    addToLoop(drums, {
      start: at(bar, step),
      duration: 0.6,
      sampleAt: kick(step === 0 ? 0.72 : 0.6),
    })
  }

  for (const step of [4, 12]) {
    addToLoop(drums, {
      start: at(bar, step),
      duration: 0.5,
      sampleAt: snare(0.8),
    })
  }

  for (const step of GHOSTS[bar]) {
    addToLoop(drums, {
      start: at(bar, step),
      duration: 0.3,
      sampleAt: snare(0.16),
    })
  }

  // Swung sixteenth hats, with an open hat on the "and" of 4 in odd bars.
  for (let step = 0; step < 16; step += 1) {
    if (isFill && step >= 10) {
      break
    }

    const open = bar % 2 === 1 && step === 14

    if (bar % 2 === 1 && step === 15) {
      continue
    }

    addToLoop(drums, {
      start: at(bar, step),
      duration: open ? 0.5 : 0.15,
      sampleAt: hat(hatLevel(step, open), open ? 0.16 : 0.022),
    })
  }

  // Second half: the shaker and the congas join.
  if (bar >= 4) {
    for (let step = 0; step < 16; step += 2) {
      if (isFill && step >= 10) {
        break
      }

      addToLoop(drums, {
        start: at(bar, step + 1),
        duration: 0.2,
        sampleAt: shaker(step % 4 === 2 ? 0.2 : 0.12),
      })
    }

    const congas: Array<[number, number, number]> = isFill
      ? [
          [3, 330, 0.3],
          [6, 220, 0.35],
        ]
      : [
          [3, 330, 0.3],
          [6, 220, 0.35],
          [11, 330, 0.28],
          [14, 220, 0.32],
          [15, 330, 0.18],
        ]

    for (const [step, frequency, level] of congas) {
      addToLoop(drums, {
        start: at(bar, step),
        duration: 0.4,
        sampleAt: membrane({ frequency, drop: 0.12, decay: 0.09, level }),
      })
    }
  }

  // Bar 8: toms and a snare build up to the loop point.
  if (isFill) {
    const fill: Array<[number, "high" | "low" | "snare", number]> = [
      [10, "high", 0.55],
      [11, "high", 0.45],
      [13, "low", 0.6],
      [14, "snare", 0.5],
      [15, "snare", 0.7],
    ]

    for (const [step, kind, level] of fill) {
      const voice =
        kind === "snare"
          ? snare(level)
          : membrane({
              frequency: kind === "high" ? 196 : 131,
              drop: 0.25,
              decay: 0.16,
              level,
            })

      addToLoop(drums, { start: at(bar, step), duration: 0.5, sampleAt: voice })
    }
  }
}

const addMusic = (music: Float64Array, bar: number): void => {
  const { root, voicing } = CHORDS[bar]

  for (const [step, interval, steps] of forBar(bar, BASS)) {
    const noteLength = steps * SIXTEENTH * 0.85

    addToLoop(music, {
      start: at(bar, step),
      duration: noteLength,
      sampleAt: bass(root + interval, noteLength, interval >= 12 ? 0.21 : 0.25),
    })
  }

  for (const [step, stabLength] of forBar(bar, STABS)) {
    voicing.forEach((note, i) => {
      addToLoop(music, {
        start: at(bar, step) + i * 0.004,
        duration: stabLength,
        sampleAt: electricPiano(note, stabLength, 0.15),
      })
    })
  }

  // A soft pad from bar 3, pumped by the kick on every beat.
  if (bar >= 2) {
    for (const note of voicing) {
      const f = midiToFrequency(note - 12)
      const start = bar * BAR
      const padLength = BAR + 0.15

      addToLoop(music, {
        start,
        duration: padLength,
        sampleAt: (t) => {
          const position = (start + t) % BEAT
          const pump = 1 - 0.75 * Math.exp(-position / 0.13)
          const envelope =
            smoothRamp(t / 0.15) * smoothRamp((padLength - t) / 0.15)
          const tone =
            Math.sin(TAU * f * t) +
            0.25 * Math.sin(TAU * f * 2.003 * t) +
            0.12 * Math.sin(TAU * f * 3 * t)

          return 0.018 * envelope * pump * tone
        },
      })
    }
  }
}

export const answersLoop = (): Float64Array => {
  const length = Math.round(LOOP_SECONDS * SAMPLE_RATE)
  const drums = new Float64Array(length)
  const music = new Float64Array(length)

  noiseCursor = 0

  for (let bar = 0; bar < BARS; bar += 1) {
    addDrums(drums, bar)
    addMusic(music, bar)
  }

  for (const [bar, step, note] of MARIMBA) {
    addToLoop(music, {
      start: at(bar, step),
      duration: 1.2,
      sampleAt: struck(note, WOOD, 0.18),
    })
  }

  const mix = new Float64Array(length)

  for (let i = 0; i < length; i += 1) {
    mix[i] = drums[i] + music[i]
  }

  // A 40 Hz high-pass removes DC and inaudible rumble. It runs twice over the
  // loop and keeps the second pass, so its state is continuous at the seam.
  const aDc = onePole(40)
  let lowState = 0
  const filtered = new Float64Array(length)

  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = 0; i < length; i += 1) {
      lowState += aDc * (mix[i] - lowState)
      filtered[i] = mix[i] - lowState
    }
  }

  // A gentle tanh soft knee above -6 dBFS, iterated with RMS normalisation.
  const knee = dbToGain(-6)
  const ceiling = dbToGain(-1.1)
  let signal = filtered

  for (let iteration = 0; iteration < 6; iteration += 1) {
    const rms = Math.sqrt(signal.reduce((sum, v) => sum + v * v, 0) / length)
    const gain = dbToGain(-17) / rms

    signal = signal.map((value) => {
      const x = value * gain
      const magnitude = Math.abs(x)

      if (magnitude <= knee) {
        return x
      }

      return (
        Math.sign(x) *
        (knee +
          (ceiling - knee) * Math.tanh((magnitude - knee) / (ceiling - knee)))
      )
    })
  }

  return master(signal, { rmsDb: -17, peakCeilingDb: -1, fadeOut: 0 })
}
