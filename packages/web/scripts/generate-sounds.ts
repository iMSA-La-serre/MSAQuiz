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

writeWav("answer-received.wav", answerReceived())
writeWav("countdown-tick.wav", countdownTick())
writeWav("finale.wav", finale())
