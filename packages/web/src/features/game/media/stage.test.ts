import { moveInto, type StageNode } from "@razzia/web/features/game/media/stage"
import { describe, expect, it } from "vitest"

interface FakeNode extends StageNode {
  parentNode: FakeNode | null
  isConnected: boolean
  children: FakeNode[]
  // What happened to the node: moved in the page, or taken out of it.
  log: string[]
}

// A node of a page, with or without Element.moveBefore; appending a node
// takes it out of the page first, as the DOM does.
const node = (name: string, { connected = true, canMove = true } = {}) => {
  const self: FakeNode = {
    parentNode: null,
    isConnected: connected,
    children: [],
    log: [],
    append: (child: never) => {
      const moved = child as FakeNode

      moved.parentNode?.children.splice(
        moved.parentNode.children.indexOf(moved),
        1,
      )
      moved.log.push(`removed, appended to ${name}`)
      moved.parentNode = self
      moved.isConnected = self.isConnected
      self.children.push(moved)
    },
  }

  if (canMove) {
    self.moveBefore = (child: never) => {
      const moved = child as FakeNode

      moved.parentNode?.children.splice(
        moved.parentNode.children.indexOf(moved),
        1,
      )
      moved.log.push(`moved to ${name}`)
      moved.parentNode = self
      self.children.push(moved)
    }
  }

  return self
}

describe("moveInto", () => {
  it("hands a player from one screen to the next without taking it out of the page", () => {
    const question = node("question")
    const parking = node("parking")
    const answers = node("answers")
    const player = node("player", { connected: false })

    // Created: appended once.
    moveInto(question, player)
    // The question's screen goes away, the answers' takes it over.
    moveInto(parking, player)
    moveInto(answers, player)

    expect(player.log).toEqual([
      "removed, appended to question",
      "moved to parking",
      "moved to answers",
    ])
    expect(player.parentNode).toBe(answers)
    expect(question.children).toEqual([])
  })

  it("does nothing where the player already is", () => {
    const slot = node("slot")
    const player = node("player")

    moveInto(slot, player)
    moveInto(slot, player)

    expect(player.log).toEqual(["moved to slot"])
  })

  it("appends where the browser cannot move a node", () => {
    const slot = node("slot", { canMove: false })
    const player = node("player")

    moveInto(slot, player)

    expect(player.log).toEqual(["removed, appended to slot"])
  })

  it("appends a node out of the page, or one the browser refuses to move", () => {
    const detached = node("detached", { connected: false })
    const player = node("player")

    moveInto(detached, player)
    expect(player.log).toEqual(["removed, appended to detached"])

    const slot = node("slot")
    const other = node("player")

    slot.moveBefore = () => {
      throw new Error("HierarchyRequestError")
    }
    moveInto(slot, other)
    expect(other.log).toEqual(["removed, appended to slot"])
  })
})
