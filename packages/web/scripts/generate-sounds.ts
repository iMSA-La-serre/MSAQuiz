// Generates MSAQuiz's original sound effects from scratch: no samples, no
// third-party material. The output is deterministic, so running this script
// again rebuilds byte-identical files and proves where the sounds come from.
//
// Usage: pnpm --filter @razzia/web sounds:generate

import { writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const SAMPLE_RATE = 44100
const OUTPUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../public/sounds",
)

interface MasterOptions {
  rmsDb: number
  peakCeilingDb: number
  fadeOut?: number
}

interface BarPartial {
  ratio: number
  amplitude: number
  decay: number
}

const dbToGain = (db: number): number => 10 ** (db / 20)

// Smooth 0 -> 1 ramp, avoids the click a hard attack or cut would produce.
const smoothRamp = (x: number): number => {
  const clamped = Math.min(Math.max(x, 0), 1)

  return Math.sin((clamped * Math.PI) / 2) ** 2
}

const render = (
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
const master = (
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

const writeWav = (fileName: string, samples: Float64Array): void => {
  const dataSize = samples.length * 2
  const buffer = Buffer.alloc(44 + dataSize)

  buffer.write("RIFF", 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write("WAVE", 8)
  buffer.write("fmt ", 12)
  buffer.writeUInt32LE(16, 16)
  // PCM, mono, 16 bits
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(SAMPLE_RATE, 24)
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write("data", 36)
  buffer.writeUInt32LE(dataSize, 40)

  samples.forEach((value, i) => {
    const clamped = Math.min(Math.max(value, -1), 1)

    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2)
  })

  writeFileSync(join(OUTPUT_DIR, fileName), buffer)
  console.log(`${fileName}: ${samples.length} samples, ${buffer.length} bytes`)
}

// "Goutte": a water drop, played on the host screen each time an answer
// comes in. A sine whose pitch rises quickly, over a short low "plop".
const answerReceived = (): Float64Array => {
  let phase = 0

  const samples = render(0.14, (t) => {
    const sweep = Math.min(t / 0.04, 1)
    const frequency = 620 * (1450 / 620) ** sweep

    phase += (2 * Math.PI * frequency) / SAMPLE_RATE

    const attack = smoothRamp(t / 0.003)
    const drop = Math.sin(phase) * Math.exp(-t / 0.035)
    const body = 0.25 * Math.sin(2 * Math.PI * 320 * t) * Math.exp(-t / 0.012)

    return attack * (drop + body)
  })

  return master(samples, { rmsDb: -12, peakCeilingDb: -1 })
}

// A tuned wooden bar: its partials follow a marimba (about 1 : 3.9 : 9.2),
// each decaying faster than the one below it.
const marimbaBar = (
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

// "Tok": a soft wooden mallet on a tuned bar, one per countdown second,
// with a very short mallet transient on top.
const countdownTick = (): Float64Array => {
  const fundamental = 523.25
  const partials: BarPartial[] = [
    { ratio: 1, amplitude: 1, decay: 0.08 },
    { ratio: 3.93, amplitude: 0.3, decay: 0.02 },
    { ratio: 9.2, amplitude: 0.08, decay: 0.008 },
  ]

  const samples = render(0.3, (t) => {
    const attack = smoothRamp(t / 0.0015)
    const bar = marimbaBar(t, fundamental, partials)
    const mallet =
      0.15 * Math.sin(2 * Math.PI * 2500 * t) * Math.exp(-t / 0.003)

    return attack * (bar + mallet)
  })

  return master(samples, { rmsDb: -17, peakCeilingDb: -4 })
}

// "Floraison": played once, when the final ranking appears. The same wooden
// bar as the countdown, struck as a quick rolled chord and left to ring. The
// voicing (C, G, D, E) is open and airy on purpose: a closing chord, not a
// victory fanfare.
const finale = (): Float64Array => {
  const notes = [523.25, 783.99, 1174.66, 1318.51]
  const strikeGap = 0.07
  const partials: BarPartial[] = [
    { ratio: 1, amplitude: 1, decay: 0.45 },
    { ratio: 3.93, amplitude: 0.22, decay: 0.07 },
    { ratio: 9.2, amplitude: 0.05, decay: 0.018 },
  ]

  const samples = render(1.6, (t) =>
    notes.reduce((sum, fundamental, index) => {
      const local = t - index * strikeGap

      if (local < 0) {
        return sum
      }

      return (
        sum +
        smoothRamp(local / 0.0015) * marimbaBar(local, fundamental, partials)
      )
    }, 0),
  )

  return master(samples, { rmsDb: -18, peakCeilingDb: -3, fadeOut: 0.15 })
}

const midiToFrequency = (note: number): number => 440 * 2 ** ((note - 69) / 12)

// A struck wooden bar, ready to be placed anywhere in time.
const struck =
  (note: number, partials: BarPartial[], level: number) =>
  (t: number): number =>
    level *
    smoothRamp(t / 0.002) *
    marimbaBar(t, midiToFrequency(note), partials)

// A few struck notes, each starting at its own time.
const strikes = (
  duration: number,
  notes: Array<{ note: number; at: number }>,
  partials: BarPartial[],
): Float64Array =>
  render(duration, (t) =>
    notes.reduce((sum, { note, at }) => {
      const local = t - at

      if (local < 0) {
        return sum
      }

      return sum + struck(note, partials, 1)(local)
    }, 0),
  )

// Adds a sound into a looping buffer: whatever rings past the end wraps back
// to the start, so the loop joins without a click or a gap.
const addToLoop = (
  buffer: Float64Array,
  {
    start,
    duration,
    sampleAt,
  }: { start: number; duration: number; sampleAt: (_time: number) => number },
): void => {
  const first = Math.round(start * SAMPLE_RATE)
  const count = Math.round(duration * SAMPLE_RATE)

  for (let i = 0; i < count; i += 1) {
    const index = (first + i) % buffer.length

    buffer[index] += sampleAt(i / SAMPLE_RATE)
  }
}

// "Sous la serre": the calm loop heard while players answer, on the host
// screen only. Four chords of two bars each at 96 BPM, which makes a 20 s
// loop: a soft pad, a marimba arpeggio and a low wooden bass. Acoustic and
// unhurried on purpose, nothing like an electronic countdown track.
const answersLoop = (): Float64Array => {
  const beat = 60 / 96
  const bar = beat * 4
  // Fmaj7, Dm7, Bbmaj7 and C6, as MIDI note numbers.
  const chords = [
    [53, 57, 60, 64],
    [50, 53, 57, 60],
    [46, 50, 53, 57],
    [48, 52, 55, 57],
  ]
  // Which chord tone each eighth note of the arpeggio plays, bar by bar.
  const patterns = [
    [0, 1, 2, 3, 4, 3, 2, 1],
    [4, 2, 3, 1, 2, 0, 1, 2],
  ]
  const arpeggio: BarPartial[] = [
    { ratio: 1, amplitude: 1, decay: 0.3 },
    { ratio: 3.93, amplitude: 0.18, decay: 0.05 },
    { ratio: 9.2, amplitude: 0.04, decay: 0.012 },
  ]
  const bass: BarPartial[] = [
    { ratio: 1, amplitude: 1, decay: 0.7 },
    { ratio: 3.93, amplitude: 0.1, decay: 0.08 },
  ]
  const buffer = new Float64Array(
    Math.round(bar * 2 * chords.length * SAMPLE_RATE),
  )

  chords.forEach((chord, chordIndex) => {
    const chordStart = chordIndex * bar * 2
    const padLength = bar * 2 + 0.6

    // The pad holds the chord for two bars and fades into the next one.
    for (const note of chord) {
      const frequency = midiToFrequency(note)

      addToLoop(buffer, {
        start: chordStart,
        duration: padLength,
        sampleAt: (t) => {
          const envelope =
            smoothRamp(t / 0.5) * smoothRamp((padLength - t) / 0.8)

          return (
            0.05 *
            envelope *
            (Math.sin(2 * Math.PI * frequency * t) +
              0.3 * Math.sin(4 * Math.PI * frequency * t))
          )
        },
      })
    }

    const tones = [...chord.map((note) => note + 24), chord[0] + 36]

    patterns.forEach((pattern, barIndex) => {
      const barStart = chordStart + barIndex * bar

      pattern.forEach((toneIndex, step) => {
        const level = step % 4 === 0 ? 0.55 : 0.35

        addToLoop(buffer, {
          start: barStart + (step * beat) / 2,
          duration: 1.5,
          sampleAt: struck(tones[toneIndex], arpeggio, level),
        })
      })

      // The bass plays the root on beats 1 and 3.
      for (const beatIndex of [0, 2]) {
        addToLoop(buffer, {
          start: barStart + beatIndex * beat,
          duration: 2.5,
          sampleAt: struck(chord[0] - 12, bass, 0.5),
        })
      }
    })
  })

  return master(buffer, { rmsDb: -17, peakCeilingDb: -3, fadeOut: 0 })
}

// "Éclosion": a question appears. Two soft notes a fifth apart, the second
// just after the first.
const questionReveal = (): Float64Array =>
  master(
    strikes(
      0.8,
      [
        { note: 72, at: 0 },
        { note: 79, at: 0.09 },
      ],
      [
        { ratio: 1, amplitude: 1, decay: 0.25 },
        { ratio: 3.93, amplitude: 0.2, decay: 0.04 },
        { ratio: 9.2, amplitude: 0.05, decay: 0.01 },
      ],
    ),
    { rmsDb: -24, peakCeilingDb: -4, fadeOut: 0.1 },
  )

// A right answer: a quick rising A major arpeggio, bright and short.
const resultCorrect = (): Float64Array =>
  master(
    strikes(
      1,
      [
        { note: 81, at: 0 },
        { note: 85, at: 0.06 },
        { note: 88, at: 0.12 },
      ],
      [
        { ratio: 1, amplitude: 1, decay: 0.35 },
        { ratio: 3.93, amplitude: 0.2, decay: 0.05 },
        { ratio: 9.2, amplitude: 0.05, decay: 0.012 },
      ],
    ),
    { rmsDb: -21, peakCeilingDb: -2, fadeOut: 0.12 },
  )

// A wrong answer: two low, muted notes falling a fourth. Gentle, never a
// buzzer.
const resultIncorrect = (): Float64Array =>
  master(
    strikes(
      0.6,
      [
        { note: 62, at: 0 },
        { note: 57, at: 0.12 },
      ],
      [
        { ratio: 1, amplitude: 1, decay: 0.12 },
        { ratio: 3.93, amplitude: 0.12, decay: 0.02 },
      ],
    ),
    { rmsDb: -22, peakCeilingDb: -4, fadeOut: 0.1 },
  )

writeWav("answer-received.wav", answerReceived())
writeWav("countdown-tick.wav", countdownTick())
writeWav("finale.wav", finale())
writeWav("answers-loop.wav", answersLoop())
writeWav("question-reveal.wav", questionReveal())
writeWav("result-correct.wav", resultCorrect())
writeWav("result-incorrect.wav", resultIncorrect())
