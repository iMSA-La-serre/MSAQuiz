import {
  ANSWER_WORDING,
  EDITOR_WORDING,
} from "@razzia/web/features/questions/ordering/utils/wording"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

// The wording of a list type is a set of i18n keys, one per sentence. A key
// whose text asks for a variable the component does not pass is read out with
// its raw `{{placeholder}}`, which no render test would catch here (the tests
// run without a DOM): compare the variables instead.

const load = (namespace: string): Record<string, unknown> =>
  JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(`../../../../locales/fr/${namespace}.json`, import.meta.url),
      ),
      "utf8",
    ),
  ) as Record<string, unknown>

const namespaces: Record<string, Record<string, unknown>> = {
  game: load("game"),
  quizz: load("quizz"),
}

/** The French text of a `namespace:a.b` key. */
const textOf = (key: string): string => {
  const [namespace, path] = key.split(":")
  const value = path
    .split(".")
    .reduce<unknown>(
      (node, step) => (node as Record<string, unknown> | undefined)?.[step],
      namespaces[namespace],
    )

  expect(typeof value, `missing ${key}`).toBe("string")

  return value as string
}

/** The names the text interpolates, `{{item}}` and the like. */
const variablesOf = (key: string): string[] =>
  [...textOf(key).matchAll(/\{\{\s*([\w.]+)\s*\}\}/gu)]
    .map(([, name]) => name)
    .sort()

describe("list wording", () => {
  // OrderingEditor passes { item, number, letter } and nothing else.
  it.each(Object.entries(EDITOR_WORDING))(
    "announces a %s move with the variables the editor passes",
    (_type, words) => {
      expect(variablesOf(words.moved)).not.toHaveLength(0)
      expect(variablesOf(words.moved)).toEqual(expect.arrayContaining(["item"]))

      for (const key of [
        words.moved,
        words.placeholder,
        words.remove,
        words.moveUp,
        words.moveDown,
      ]) {
        for (const name of variablesOf(key)) {
          expect(["item", "number", "letter"], `${key} → ${name}`).toContain(
            name,
          )
        }
      }
    },
  )

  // OrderingAnswers passes { item, position } on the announcements and
  // { letter, item, position } on a row's name.
  it.each(Object.entries(ANSWER_WORDING))(
    "names a %s row with the variables the answering screen passes",
    (_type, words) => {
      expect(variablesOf(words.placed)).toEqual(["item", "position"])
      expect(variablesOf(words.removed)).toEqual(["item"])
      expect(variablesOf(words.complete)).toEqual([])
      expect(variablesOf(words.itemLabel)).toEqual([
        "item",
        "letter",
        "position",
      ])
      expect(variablesOf(words.empty)).toEqual([])
    },
  )

  it("says « proposition » to a ranking and « élément » to an ordering", () => {
    expect(textOf(ANSWER_WORDING.ranking.complete)).toContain("proposition")
    expect(textOf(ANSWER_WORDING.ordering.complete)).toContain("élément")
    // « Classement » is the leaderboard: a ranking never borrows the word.
    expect(textOf("game:rankingAnswered").toLowerCase()).not.toContain(
      "classement",
    )
  })
})
