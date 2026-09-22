import { parseHighlight } from "@razzia/common/utils/highlight"
import {
  passageBounds,
  remapSolutions,
  splitFirstWord,
  unwrapPassage,
  wrapSelection,
} from "@razzia/web/features/questions/highlight/utils/passages"
import { describe, expect, it } from "vitest"

const TEXT = "Prévenez [sous 48 heures] votre employeur."

describe("passageBounds", () => {
  it("finds the brackets of each passage", () => {
    expect(passageBounds(TEXT)).toEqual([[9, 24]])
  })

  it("reads a text as parseHighlight does", () => {
    for (const text of [
      "[un [deux] trois] [quatre]",
      "] [ ] [un] [",
      "[a] [​] [b]",
    ]) {
      expect(passageBounds(text).length, text).toBe(
        parseHighlight(text).passages.length,
      )
    }
  })
})

describe("wrapSelection", () => {
  it("sets the words selected between brackets, spaces left out", () => {
    // « votre employeur » with the space before it.
    expect(wrapSelection(TEXT, 25, 41)).toEqual({
      text: "Prévenez [sous 48 heures] [votre employeur].",
      caret: 43,
    })
    expect(wrapSelection("Un mot", 6, 3)).toEqual({
      text: "Un [mot]",
      caret: 8,
    })
  })

  it("refuses spaces only, a bracket, or a passage already", () => {
    expect(wrapSelection(TEXT, 3, 3)).toBeNull()
    expect(wrapSelection("Un  mot", 2, 4)).toBeNull()
    expect(wrapSelection(TEXT, 5, 12)).toBeNull()
    expect(wrapSelection(TEXT, 11, 15)).toBeNull()
  })
})

describe("unwrapPassage", () => {
  it("takes the brackets of one passage out, the caret after its words", () => {
    expect(unwrapPassage("[un] et [deux]", 1)).toEqual({
      text: "[un] et deux",
      caret: 12,
    })
    expect(unwrapPassage("[un] et [ ] [deux]", 1)).toEqual({
      text: "[un] et [ ] deux",
      caret: 16,
    })
  })

  it("finds no unknown passage", () => {
    expect(unwrapPassage(TEXT, 3)).toBeNull()
  })
})

describe("remapSolutions", () => {
  it("keeps the ticks when a passage is edited in place", () => {
    expect(remapSolutions(["un", "deux"], [1], ["un", "deu"])).toEqual([1])
  })

  it("follows the passages when one is added or removed", () => {
    expect(remapSolutions(["un", "deux"], [1], ["zéro", "un", "deux"])).toEqual(
      [2],
    )
    expect(
      remapSolutions(["un", "deux", "trois"], [0, 2], ["un", "trois"]),
    ).toEqual([0, 1])
    expect(remapSolutions(["un", "deux"], [1], ["un"])).toEqual([])
  })
})

describe("splitFirstWord", () => {
  it("cuts a passage after its first word", () => {
    expect(splitFirstWord("sous 48 heures")).toEqual(["sous", " 48 heures"])
    expect(splitFirstWord("MSA")).toEqual(["MSA", ""])
  })
})
