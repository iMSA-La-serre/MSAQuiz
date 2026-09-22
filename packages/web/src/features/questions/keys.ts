import { answerKey } from "@razzia/common/utils/text"

/**
 * Texts that compare equal to an earlier one once normalized (answerKey), as
 * the validator refuses them: index of each repeat, mapped to the index of
 * the first text with that key. Texts with an empty key are left out.
 */
export const duplicatesOf = (texts: readonly string[]): Map<number, number> => {
  const firstIndex = new Map<string, number>()
  const duplicates = new Map<number, number>()

  texts.forEach((text, index) => {
    const key = answerKey(text)

    if (key === "") {
      return
    }

    const first = firstIndex.get(key)

    if (first === undefined) {
      firstIndex.set(key, index)

      return
    }

    duplicates.set(index, first)
  })

  return duplicates
}
