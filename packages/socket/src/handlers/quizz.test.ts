import { EVENTS, QUESTION_TYPES } from "@razzia/common/constants"
import type { Socket } from "@razzia/common/types/game/socket"
import { quizzSocketHandlers } from "@razzia/socket/handlers/quizz"
import { beforeEach, describe, expect, it, vi } from "vitest"

// One table of rows, as the quizzes table holds them: enough of drizzle's
// chains for the repository.
const rows = vi.hoisted(() => new Map<string, { id: string; data: unknown }>())

vi.mock("@razzia/socket/db/client", () => {
  const upsert = (row: { id: string; data: unknown }) => ({
    onConflictDoUpdate: () => ({
      run: () => rows.set(row.id, { id: row.id, data: row.data }),
    }),
  })

  return {
    db: {
      insert: () => ({ values: upsert }),
      select: () => ({
        from: () => ({
          all: () => [...rows.values()],
          where: () => ({ get: () => [...rows.values()][0] }),
        }),
      }),
      update: () => ({
        set: ({ data }: { data: unknown }) => ({
          where: () => ({
            run: () => {
              const row = [...rows.values()].at(0)

              if (!row) {
                return { changes: 0 }
              }

              rows.set(row.id, { ...row, data })

              return { changes: 1 }
            },
          }),
        }),
      }),
    },
  }
})
vi.mock("@razzia/socket/db/seed", () => ({ ADMIN_USER_ID: "admin" }))
vi.mock("@razzia/socket/services/manager", () => ({
  default: { withAuth: (_socket: unknown, handler: unknown) => handler },
  emitConfig: () => undefined,
}))
vi.mock("@razzia/socket/services/quizz-import", () => ({
  parseQuizzXlsx: () => undefined,
}))

const QUESTION = {
  type: QUESTION_TYPES.SINGLE,
  question: "Quelle est la bonne réponse ?",
  answers: ["A", "B"],
  solutions: [0],
  cooldown: 5,
  time: 20,
}

const connect = () => {
  const handlers = new Map<string, (..._args: unknown[]) => void>()
  const emitted: Array<{ event: string; data: unknown }> = []
  const socket = {
    on: (event: string, handler: (..._args: unknown[]) => void) => {
      handlers.set(event, handler)
    },
    emit: (event: string, data: unknown) => {
      emitted.push({ event, data })
    },
  } as unknown as Socket

  quizzSocketHandlers({ socket, io: {} as never })

  const send = (event: string, data: unknown) => {
    emitted.length = 0
    handlers.get(event)?.(data)

    return emitted
  }

  return { send }
}

describe("quizz handlers", () => {
  beforeEach(() => {
    rows.clear()
    vi.spyOn(console, "error").mockImplementation(() => undefined)
  })

  it("names the question a save is refused over", () => {
    const { send } = connect()
    const media = { type: "video", url: String.raw`C:\Users\maman\jeu.mp4` }

    expect(
      send(EVENTS.QUIZZ.SAVE, {
        subject: "Quiz",
        questions: [QUESTION, { ...QUESTION, media }],
      }),
    ).toEqual([
      {
        event: EVENTS.QUIZZ.ERROR,
        data: { message: "errors:quizz.mediaUrlNotWeb", questionIndex: 1 },
      },
    ])
    expect(rows.size).toBe(0)
  })

  it("names the question of an update refused over it", () => {
    const { send } = connect()

    send(EVENTS.QUIZZ.SAVE, { subject: "Quiz", questions: [QUESTION] })
    const [{ id }] = [...rows.values()]

    expect(
      send(EVENTS.QUIZZ.UPDATE, {
        id,
        subject: "Quiz",
        questions: [
          {
            ...QUESTION,
            media: { url: "https://youtu.be/aqz-KE-bpKQ" },
          },
        ],
      }),
    ).toEqual([
      {
        event: EVENTS.QUIZZ.ERROR,
        data: { message: "errors:quizz.mediaPageLink", questionIndex: 0 },
      },
    ])
  })

  it("still sends a bare key for an error about the whole quiz", () => {
    const { send } = connect()

    expect(
      send(EVENTS.QUIZZ.SAVE, { subject: "", questions: [QUESTION] }),
    ).toEqual([
      { event: EVENTS.QUIZZ.ERROR, data: "errors:quizz.subjectEmpty" },
    ])
  })

  it("stores the address trimmed, with the type it tells", () => {
    const { send } = connect()

    expect(
      send(EVENTS.QUIZZ.SAVE, {
        subject: "Quiz",
        questions: [
          { ...QUESTION, media: { url: " https://msa.example/plan.png " } },
          { ...QUESTION, media: { type: "image", url: "" } },
        ],
      }).map(({ event }) => event),
    ).toEqual([EVENTS.QUIZZ.SAVE_SUCCESS])

    const [{ data }] = [...rows.values()]
    const { questions } = data as {
      questions: Array<{ media?: unknown }>
    }

    expect(questions[0].media).toEqual({
      type: "image",
      url: "https://msa.example/plan.png",
    })
    expect(questions[1]).not.toHaveProperty("media")
  })

  it("still opens a stored quiz whose media a save would now refuse", () => {
    const { send } = connect()
    const media = {
      type: "video",
      url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
    }

    rows.set("ancien", {
      id: "ancien",
      data: { subject: "Ancien", questions: [{ ...QUESTION, media }] },
    })

    const [{ event, data }] = send(EVENTS.QUIZZ.GET, "ancien")

    expect(event).toBe(EVENTS.QUIZZ.DATA)
    expect(
      (data as { questions: Array<{ media: unknown }> }).questions[0].media,
    ).toEqual(media)
  })

  it("imports again what it exported, naming the media to fix", () => {
    const { send } = connect()
    const youtube = {
      type: "video",
      url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
    }
    // Saved by the old editor: an address alone, which tells no type.
    const untyped = { url: "https://images.example/photo-1500?w=800" }

    rows.set("ancien", {
      id: "ancien",
      data: {
        subject: "Ancien",
        questions: [
          QUESTION,
          { ...QUESTION, media: youtube },
          { ...QUESTION, media: untyped },
          { ...QUESTION, media: { url: "https://msa.example/plan.png" } },
        ],
      },
    })

    const [{ data: exported }] = send(EVENTS.QUIZZ.GET, "ancien")
    const { id: _id, ...file } = exported as { id: string }

    rows.clear()

    const emitted = send(
      EVENTS.QUIZZ.IMPORT,
      JSON.parse(JSON.stringify(file)) as unknown,
    )
    const [{ id, data }] = [...rows.values()]

    expect(emitted).toEqual([
      {
        event: EVENTS.QUIZZ.SAVE_SUCCESS,
        data: {
          id,
          warnings: [
            { message: "errors:quizz.mediaPageLink", questionIndex: 1 },
            { message: "errors:quizz.mediaTypeMissing", questionIndex: 2 },
          ],
        },
      },
    ])

    const { questions } = data as { questions: Array<{ media?: unknown }> }

    expect(questions.map(({ media }) => media)).toEqual([
      undefined,
      youtube,
      untyped,
      { type: "image", url: "https://msa.example/plan.png" },
    ])
  })

  it("imports a file whose media are all fine without a warning", () => {
    const { send } = connect()

    const emitted = send(EVENTS.QUIZZ.IMPORT, {
      subject: "Quiz",
      questions: [
        {
          ...QUESTION,
          media: { type: "video", url: "https://msa.example/film.mp4" },
        },
      ],
    })
    const [{ id }] = [...rows.values()]

    expect(emitted).toEqual([
      { event: EVENTS.QUIZZ.SAVE_SUCCESS, data: { id } },
    ])
  })

  it("still refuses a file a stored quiz could not be", () => {
    const { send } = connect()

    expect(
      send(EVENTS.QUIZZ.IMPORT, {
        subject: "Quiz",
        questions: [QUESTION, { ...QUESTION, question: "" }],
      }),
    ).toEqual([
      {
        event: EVENTS.QUIZZ.ERROR,
        data: { message: "errors:quizz.questionEmpty", questionIndex: 1 },
      },
    ])
    expect(rows.size).toBe(0)
  })

  it("keeps the editor's save strict", () => {
    const { send } = connect()

    expect(
      send(EVENTS.QUIZZ.SAVE, {
        subject: "Quiz",
        questions: [
          {
            ...QUESTION,
            media: { type: "video", url: "https://youtu.be/aqz-KE-bpKQ" },
          },
        ],
      }),
    ).toEqual([
      {
        event: EVENTS.QUIZZ.ERROR,
        data: { message: "errors:quizz.mediaPageLink", questionIndex: 0 },
      },
    ])
  })
})
