// Generates MSAQuiz's original sound effects from scratch: no samples, no
// third-party material. The output is deterministic, so running this script
// again rebuilds byte-identical files and proves where the sounds come from.
//
// Usage: pnpm --filter @razzia/web sounds:generate

import { answersLoop } from "./answers-loop.ts"
import {
  type BarPartial,
  marimbaBar,
  master,
  render,
  SAMPLE_RATE,
  smoothRamp,
  struck,
} from "./sound-kit.ts"
import { writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const OUTPUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../public/sounds",
)

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
