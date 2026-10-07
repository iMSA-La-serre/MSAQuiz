// Load test: how many players a running server takes before it lags.
//
// For each step (e.g. 50, 100, 200 players) it plays a real game against the
// server, over the same protocol as the web client: a bot host creates the
// game, bot players join it at a set rate and answer every question, and a
// probe socket times the server's answer to game:clock all along. A step
// passes while the server answers quickly, every player gets every status
// within a short spread and nobody drops.
//
// The host never shows the final leaderboard: the game is left before its
// end, so no result is saved and the statistics stay clean.
//
// The probe's round trip with no player in the game is the network's share of
// it: a step is judged on what it adds, so a test run over a VPN is judged on
// the server alone.
//
//   pnpm load-test --url http://localhost:3001 --players 50,100,200
//
// The Docker image ships it bundled, next to the server:
//
//   node /app/socket/load-test.cjs --url http://localhost:3000
//
// See `--help` for every option.

import { EVENTS } from "@razzia/common/constants"
import { STATUS } from "@razzia/common/types/game/status"
import { randomUUID } from "node:crypto"
import fs from "node:fs"
import { resolve } from "node:path"
import { monitorEventLoopDelay, performance } from "node:perf_hooks"
import { parseArgs } from "node:util"
import { io, type Socket } from "socket.io-client"

const HELP = `Test de charge MSAQuiz

Joue une vraie partie par palier de joueurs et mesure la latence du serveur.

Options :
  --url <url>          Serveur à tester (défaut http://localhost:3001).
                       Dans le conteneur : http://localhost:3000
                       À distance : https://<domaine de l'application>
  --players <n,n,...>  Paliers de joueurs (défaut 25,50,100,200,400)
  --quiz <id>          Identifiant du quiz joué (défaut : le premier)
  --questions <n>      Questions jouées par palier (défaut 3)
  --join-rate <n>      Joueurs qui se connectent par seconde (défaut 50)
  --think <ms>         Délai de réponse maximal d'un joueur (défaut 3000)
  --websocket          WebSocket direct, sans passer par le polling HTTP
  --no-stop            Continuer les paliers suivants après un échec
  --out <fichier>      Écrire le détail des mesures en JSON

Mot de passe animateur : variable MANAGER_PASSWORD, sinon lu dans game.json
(dossier CONFIG_PATH, config/ du dépôt, ou /app/config dans le conteneur).

La latence de la sonde avant l'arrivée des joueurs est celle du réseau : les
seuils portent sur ce que chaque palier y ajoute.`

// Thresholds of a step. Server RTT is the probe's game:clock round trip; the
// spread is the time between the first and the last player getting the same
// status; the answer delay is from sending an answer to its acknowledgement.
// RTT and answer delay count above the network's own round trip.
const LIMITS = {
  ok: { rtt: 100, answer: 250, spread: 300 },
  degraded: { rtt: 300, answer: 1000, spread: 1000 },
}

const { values: args } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3001" },
    players: { type: "string", default: "25,50,100,200,400" },
    quiz: { type: "string" },
    questions: { type: "string", default: "3" },
    "join-rate": { type: "string", default: "50" },
    think: { type: "string", default: "3000" },
    websocket: { type: "boolean", default: false },
    "no-stop": { type: "boolean", default: false },
    out: { type: "string" },
    help: { type: "boolean", default: false },
  },
})

// The HTTP polling transport calls url.parse(): its deprecation warning, in
// the middle of the report, would only puzzle the reader.
process.noDeprecation = true

if (args.help) {
  console.log(HELP)
  process.exit(0)
}

const URL_ = args.url
const STEPS = args.players.split(",").map((n) => Number.parseInt(n, 10))
const MAX_QUESTIONS = Number.parseInt(args.questions, 10)
const JOIN_RATE = Number.parseInt(args["join-rate"], 10)
const THINK_MS = Number.parseInt(args.think, 10)
const PROBE_EVERY_MS = 100
const BASELINE_MS = 2000

const readPassword = (): string => {
  if (process.env.MANAGER_PASSWORD) {
    return process.env.MANAGER_PASSWORD
  }

  // Where the server finds it (services/config.ts): CONFIG_PATH, the repo's
  // config folder from packages/socket, or the image's volume, which
  // `docker compose exec` runs without CONFIG_PATH.
  const dirs = [
    process.env.CONFIG_PATH,
    resolve(process.cwd(), "../../config"),
    "/app/config",
  ]

  for (const dir of dirs) {
    if (!dir) {
      continue
    }

    try {
      const file = resolve(dir, "game.json")
      const config = JSON.parse(fs.readFileSync(file, "utf-8")) as {
        managerPassword?: string
      }

      if (config.managerPassword) {
        return config.managerPassword
      }
    } catch {
      // Next folder.
    }
  }

  console.error(
    "Mot de passe animateur introuvable : définir MANAGER_PASSWORD.",
  )
  process.exit(1)
}

const PASSWORD = readPassword()

// ── Helpers ────────────────────────────────────────────────────────────────

const now = () => performance.now()

const wait = (ms: number) =>
  new Promise<void>((r) => {
    setTimeout(r, ms)
  })

const randomInt = (max: number) => Math.floor(Math.random() * max)

const percentile = (values: number[], p: number): number => {
  if (values.length === 0) {
    return Number.NaN
  }

  const sorted = [...values].sort((a, b) => a - b)

  return sorted[
    Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  ]
}

const ms = (value: number) =>
  Number.isNaN(value) ? "-" : `${Math.round(value)}`

const connect = (clientId: string): Socket =>
  io(URL_, {
    path: "/ws",
    auth: { clientId },
    // One connection per bot: socket.io-client would share one by default.
    forceNew: true,
    reconnection: false,
    transports: args.websocket ? ["websocket"] : ["polling", "websocket"],
  })

interface SelectAnswerData {
  questionType: string
  answers: string[]
  targets?: string[]
  options?: {
    multiple?: boolean
    min?: number
    max?: number
    scaleMin?: number
    scaleMax?: number
  }
}

const shuffledKeys = (count: number) => {
  const keys = Array.from({ length: count }, (_, i) => i)

  for (let i = keys.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1)
    ;[keys[i], keys[j]] = [keys[j], keys[i]]
  }

  return keys
}

// A valid answer for each question type, as a player would send it; null for
// a slide, which takes none.
const answerFor = (question: SelectAnswerData): object | null => {
  const { questionType, answers, targets, options } = question

  if (questionType === "slide") {
    return null
  }

  if (questionType === "ordering" || questionType === "ranking") {
    return { answerKeys: shuffledKeys(answers.length) }
  }

  if (questionType === "statements" || questionType === "categorize") {
    return {
      answerKeys: answers.map(() => randomInt(targets?.length ?? 2)),
    }
  }

  if (questionType === "scale") {
    const levels = (options?.scaleMax ?? 5) - (options?.scaleMin ?? 1) + 1

    return { answerKeys: [randomInt(levels)] }
  }

  if (questionType === "estimate") {
    const { min, max } = options ?? {}
    const value =
      min !== undefined && max !== undefined
        ? Math.round((min + max) / 2)
        : (min ?? max ?? 0)

    return { text: String(value) }
  }

  if (questionType === "shortanswer") {
    return { text: "test" }
  }

  if (questionType === "wordcloud") {
    return { texts: ["test"] }
  }

  return { answerKeys: [randomInt(Math.max(answers.length, 1))] }
}

// ── One step ───────────────────────────────────────────────────────────────

interface StepResult {
  players: number
  joined: number
  joinSeconds: number
  questionsPlayed: number
  // The probe's round trip before any player came.
  network: { p50: number; p95: number }
  rtt: { p50: number; p95: number; max: number }
  answer: { sent: number; acked: number; p50: number; p95: number; max: number }
  spread: { worst: number; worstStatus: string }
  missedStatuses: number
  disconnects: number
  errors: string[]
  generatorLagP99: number
  verdict: "OK" | "DÉGRADÉ" | "KO"
}

interface Host {
  socket: Socket
  gameId: string
  inviteCode: string
}

const startHost = (): Promise<Host> =>
  new Promise((resolvePromise, reject) => {
    const socket = connect(randomUUID())
    const timeout = setTimeout(() => {
      reject(
        new Error("l'animateur n'a pas pu créer de partie (délai dépassé)"),
      )
    }, 15_000)

    const fail = (message: string) => {
      clearTimeout(timeout)
      socket.disconnect()
      reject(new Error(message))
    }

    socket.on("connect_error", (error) => {
      fail(`connexion impossible à ${URL_} : ${error.message}`)
    })
    socket.on("connect", () => {
      socket.emit(EVENTS.MANAGER.AUTH, PASSWORD)
    })
    socket.on(EVENTS.MANAGER.ERROR_MESSAGE, (key: string) => {
      fail(`authentification refusée (${key})`)
    })
    socket.on(
      EVENTS.MANAGER.CONFIG,
      (config: { quizz: Array<{ id: string; subject: string }> }) => {
        const quiz = args.quiz
          ? config.quizz.find((q) => q.id === args.quiz)
          : config.quizz[0]

        if (!quiz) {
          fail(
            `quiz introuvable. Disponibles : ${config.quizz.map((q) => q.id).join(", ")}`,
          )

          return
        }

        socket.emit(EVENTS.GAME.CREATE, quiz.id)
      },
    )
    socket.on(EVENTS.GAME.ERROR_MESSAGE, (key: string) => {
      fail(`création de partie refusée (${key})`)
    })
    socket.on(
      EVENTS.MANAGER.GAME_CREATED,
      ({ gameId, inviteCode }: { gameId: string; inviteCode: string }) => {
        clearTimeout(timeout)
        resolvePromise({ socket, gameId, inviteCode })
      },
    )
  })

const runStep = async (playerCount: number): Promise<StepResult> => {
  const errors: string[] = []
  const rtts: number[] = []
  const answerDelays: number[] = []
  // First and last arrival, and how many players got each status, keyed by
  // question number and status name.
  const arrivals = new Map<
    string,
    { first: number; last: number; count: number }
  >()
  let answersSent = 0
  let disconnects = 0
  let questionsPlayed = 0
  let measuring = false

  const lag = monitorEventLoopDelay({ resolution: 10 })
  lag.enable()

  const host = await startHost()

  // The probe joins no game: it only asks the server for the time. Before
  // any player comes, its round trip is the network's alone.
  const probe = connect(randomUUID())
  const idleRtts: number[] = []
  let idle = true
  const probeTimer = setInterval(() => {
    if (!probe.connected) {
      return
    }

    const sentAt = now()
    probe.emit(EVENTS.GAME.CLOCK, Date.now(), () => {
      if (idle) {
        idleRtts.push(now() - sentAt)
      } else if (measuring) {
        rtts.push(now() - sentAt)
      }
    })
  }, PROBE_EVERY_MS)

  await wait(BASELINE_MS)
  idle = false

  const baseline = {
    p50: idleRtts.length ? percentile(idleRtts, 50) : 0,
    p95: idleRtts.length ? percentile(idleRtts, 95) : 0,
  }

  // ── Players ──
  const bots: Socket[] = []
  let joined = 0
  let allJoined: () => void = () => undefined
  const joinedPromise = new Promise<void>((r) => {
    allJoined = r
  })
  const joinStart = now()
  let joinEnd = joinStart

  const record = (key: string) => {
    const t = now()
    const entry = arrivals.get(key)

    if (entry) {
      entry.last = t
      entry.count += 1
    } else {
      arrivals.set(key, { first: t, last: t, count: 1 })
    }
  }

  const startBot = (index: number) => {
    const socket = connect(randomUUID())
    let gameId = ""
    let question = 0
    let answeredAt = 0
    let answerTimer: NodeJS.Timeout | undefined = undefined

    bots.push(socket)

    socket.on("connect", () => {
      socket.emit(EVENTS.PLAYER.JOIN, host.inviteCode)
    })
    socket.on("connect_error", (error) => {
      errors.push(`joueur ${index} : ${error.message}`)
    })
    socket.on("disconnect", (reason) => {
      if (measuring) {
        disconnects += 1
        errors.push(`joueur ${index} déconnecté : ${reason}`)
      }
    })
    socket.on(EVENTS.GAME.ERROR_MESSAGE, (key: string) => {
      errors.push(`joueur ${index} : ${key}`)
    })
    socket.on(EVENTS.GAME.SUCCESS_ROOM, (id: string) => {
      gameId = id
      socket.emit(EVENTS.PLAYER.LOGIN, {
        gameId,
        data: { username: `bot-${String(index).padStart(4, "0")}` },
      })
    })
    socket.on(EVENTS.GAME.SUCCESS_JOIN, () => {
      joined += 1
      joinEnd = now()

      if (joined === playerCount) {
        allJoined()
      }
    })
    socket.on(
      EVENTS.GAME.STATUS,
      ({ name, data }: { name: string; data: Record<string, unknown> }) => {
        if (name === STATUS.SHOW_PREPARED) {
          question = data.questionNumber as number
        }

        record(`${question}:${name}`)

        if (name === STATUS.SELECT_ANSWER) {
          const answer = answerFor(data as unknown as SelectAnswerData)

          if (answer) {
            answerTimer = setTimeout(() => {
              answersSent += 1
              answeredAt = now()
              socket.emit(EVENTS.PLAYER.SELECTED_ANSWER, {
                gameId,
                data: answer,
              })
            }, randomInt(THINK_MS))
          }
        }

        if (name === STATUS.WAIT && answeredAt > 0) {
          answerDelays.push(now() - answeredAt)
          answeredAt = 0
        }

        if (name === STATUS.SHOW_RESULT) {
          clearTimeout(answerTimer)
          answeredAt = 0
        }
      },
    )
  }

  for (let i = 0; i < playerCount; i += 1) {
    startBot(i + 1)

    if ((i + 1) % JOIN_RATE === 0) {
      // Paced on purpose: players arrive at the join rate.
      // oxlint-disable-next-line no-await-in-loop
      await wait(1000)
    }
  }

  await Promise.race([
    joinedPromise,
    wait(20_000 + (playerCount / JOIN_RATE) * 1000),
  ])

  const joinSeconds = (joinEnd - joinStart) / 1000

  // ── The game, driven by the bot host ──
  measuring = true

  const gameOver = new Promise<void>((resolveGame) => {
    let total = MAX_QUESTIONS
    let fallback: NodeJS.Timeout | undefined = undefined
    const deadline = setTimeout(
      () => {
        errors.push("partie interrompue : délai global dépassé")
        resolveGame()
      },
      MAX_QUESTIONS * (THINK_MS + 60_000),
    )

    host.socket.on(
      EVENTS.GAME.UPDATE_QUESTION,
      ({ total: count }: { total: number }) => {
        total = Math.min(MAX_QUESTIONS, count)
      },
    )
    host.socket.on(
      EVENTS.GAME.STATUS,
      ({ name, data }: { name: string; data: Record<string, unknown> }) => {
        if (name === STATUS.SELECT_ANSWER) {
          // A slide waits for the host, as may an answer the server ignores
          // on a question without time limit: close it after a while.
          const delay = data.questionType === "slide" ? 1000 : THINK_MS + 5000

          fallback = setTimeout(() => {
            host.socket.emit(EVENTS.MANAGER.ABORT_QUIZ, { gameId: host.gameId })
          }, delay)
        }

        if (name === STATUS.SHOW_RESPONSES) {
          clearTimeout(fallback)
          questionsPlayed += 1

          if (questionsPlayed >= total) {
            clearTimeout(deadline)
            // Let the last results reach every player.
            setTimeout(resolveGame, 1500)

            return
          }

          setTimeout(() => {
            host.socket.emit(EVENTS.MANAGER.SHOW_LEADERBOARD, {
              gameId: host.gameId,
            })
          }, 1000)
        }

        if (name === STATUS.SHOW_LEADERBOARD) {
          setTimeout(() => {
            host.socket.emit(EVENTS.MANAGER.NEXT_QUESTION, {
              gameId: host.gameId,
            })
          }, 1000)
        }
      },
    )
  })

  if (joined === 0) {
    errors.push("aucun joueur n'a pu rejoindre la partie")
  } else {
    host.socket.emit(EVENTS.MANAGER.START_GAME, { gameId: host.gameId })
    await gameOver
  }

  measuring = false
  clearInterval(probeTimer)
  lag.disable()

  // ── Clean up: the host leaves first, so the game is dropped unsaved ──
  host.socket.emit(EVENTS.MANAGER.LEAVE, { gameId: host.gameId })
  await wait(200)
  host.socket.disconnect()
  probe.disconnect()
  bots.forEach((socket) => {
    socket.disconnect()
  })

  // ── Figures ──
  let worstSpread = 0
  let worstStatus = "-"
  let missedStatuses = 0

  for (const [key, { first, last, count }] of arrivals) {
    const [, name] = key.split(":")

    // WAIT goes to each player when they answer: not one broadcast.
    if (name === STATUS.WAIT) {
      continue
    }

    if (last - first > worstSpread) {
      worstSpread = last - first
      worstStatus = key
    }

    missedStatuses += Math.max(0, joined - count)
  }

  const rtt = {
    p50: percentile(rtts, 50),
    p95: percentile(rtts, 95),
    max: rtts.length ? Math.max(...rtts) : Number.NaN,
  }
  const answer = {
    sent: answersSent,
    acked: answerDelays.length,
    p50: percentile(answerDelays, 50),
    p95: percentile(answerDelays, 95),
    max: answerDelays.length ? Math.max(...answerDelays) : Number.NaN,
  }

  const failed =
    joined < playerCount ||
    disconnects > 0 ||
    missedStatuses > 0 ||
    questionsPlayed === 0

  // What the step adds to the network's own round trip.
  const within = (limit: { rtt: number; answer: number; spread: number }) =>
    rtt.p95 - baseline.p95 <= limit.rtt &&
    (Number.isNaN(answer.p95) || answer.p95 - baseline.p95 <= limit.answer) &&
    worstSpread <= limit.spread

  let verdict: StepResult["verdict"] = "KO"

  if (!failed && within(LIMITS.ok)) {
    verdict = "OK"
  } else if (!failed && within(LIMITS.degraded)) {
    verdict = "DÉGRADÉ"
  }

  return {
    players: playerCount,
    joined,
    joinSeconds,
    questionsPlayed,
    network: baseline,
    rtt,
    answer,
    spread: { worst: worstSpread, worstStatus },
    missedStatuses,
    disconnects,
    errors,
    generatorLagP99: lag.percentile(99) / 1e6,
    verdict,
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

const printStep = (r: StepResult) => {
  console.log(
    [
      `  joueurs connectés   ${r.joined}/${r.players} en ${r.joinSeconds.toFixed(1)} s`,
      `  questions jouées    ${r.questionsPlayed}`,
      `  réseau seul         p50 ${ms(r.network.p50)} ms · p95 ${ms(r.network.p95)} ms (sonde avant l'arrivée des joueurs)`,
      `  latence serveur     p50 ${ms(r.rtt.p50)} ms · p95 ${ms(r.rtt.p95)} ms · max ${ms(r.rtt.max)} ms`,
      `  réponse → accusé    p50 ${ms(r.answer.p50)} ms · p95 ${ms(r.answer.p95)} ms · max ${ms(r.answer.max)} ms (${r.answer.acked}/${r.answer.sent})`,
      `  écart de diffusion  ${ms(r.spread.worst)} ms au pire (question:statut ${r.spread.worstStatus})`,
      `  statuts manqués     ${r.missedStatuses} · déconnexions ${r.disconnects}`,
      `  → ${r.verdict}`,
    ].join("\n"),
  )

  if (r.errors.length > 0) {
    const shown = r.errors.slice(0, 5)
    console.log(`  erreurs (${r.errors.length}) :\n    ${shown.join("\n    ")}`)
  }

  if (r.generatorLagP99 > 50) {
    console.log(
      `  ⚠ le générateur lui-même rame (boucle p99 ${Math.round(r.generatorLagP99)} ms) : mesures faussées, répartir les joueurs sur plusieurs machines`,
    )
  }
}

const main = async () => {
  console.log(
    `Serveur ${URL_} · paliers ${STEPS.join(", ")} · ${MAX_QUESTIONS} questions · ${JOIN_RATE} connexions/s · transport ${args.websocket ? "websocket" : "polling → websocket"}\n`,
  )

  const results: StepResult[] = []

  for (const players of STEPS) {
    console.log(`▶ ${players} joueurs`)

    try {
      // One step after the other: they would load the server together.
      // oxlint-disable-next-line no-await-in-loop
      const result = await runStep(players)

      results.push(result)
      printStep(result)

      if (result.verdict === "KO" && !args["no-stop"]) {
        console.log("\nArrêt au premier palier KO (--no-stop pour continuer).")

        break
      }
    } catch (error) {
      console.error(`  ✖ ${(error as Error).message}`)

      break
    }

    // Let the server drop the last game's sockets before the next step.
    // oxlint-disable-next-line no-await-in-loop
    await wait(3000)
    console.log()
  }

  if (results.length > 0) {
    console.log("\nRésumé")
    console.table(
      results.map((r) => ({
        joueurs: r.players,
        "réseau seul p95 (ms)": Math.round(r.network.p95),
        "latence p95 (ms)": Math.round(r.rtt.p95),
        "réponse p95 (ms)": Number.isNaN(r.answer.p95)
          ? "-"
          : Math.round(r.answer.p95),
        "écart diffusion (ms)": Math.round(r.spread.worst),
        verdict: r.verdict,
      })),
    )

    const lastOk = results.filter((r) => r.verdict === "OK").at(-1)
    console.log(
      lastOk
        ? `Sans lag jusqu'à ${lastOk.players} joueurs au moins.`
        : "Aucun palier sans lag.",
    )
  }

  if (args.out) {
    fs.writeFileSync(args.out, JSON.stringify(results, null, 2))
    console.log(`Détail écrit dans ${args.out}`)
  }

  process.exit(0)
}

void main()
