import { WORDCLOUD_LIMITS } from "@razzia/common/constants"
import type { QuestionOptions, WordCount } from "@razzia/common/types/game"
import { answerKey } from "@razzia/common/utils/text"

/** Fields a word cloud shows on the phone, 1 to 3. */
export const wordCountOf = (options: QuestionOptions | undefined): number => {
  const count = options?.wordCount

  if (count === undefined || !Number.isInteger(count)) {
    return WORDCLOUD_LIMITS.MIN_WORDS
  }

  return Math.min(
    WORDCLOUD_LIMITS.MAX_WORDS,
    Math.max(WORDCLOUD_LIMITS.MIN_WORDS, count),
  )
}

const compareText = (a: string, b: string) =>
  a.localeCompare(b, "fr", { sensitivity: "base" }) || (a < b ? -1 : 1)

// FNV-1a over the UTF-16 units of a text: a stable 32-bit hash.
const hashText = (text: string): number => {
  let hash = 0x81_1c_9d_c5

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01_00_01_93)
  }

  return hash >>> 0
}

/**
 * Words counted by key (answerKey), the most frequent first. Words given as
 * often follow an order drawn from their key and `salt` (the wording of the
 * question): the same for every screen and every game of the question,
 * unrelated to the order the answers came in, and not alphabetical, so the
 * words a long cloud leaves out are not always those at the end of the
 * alphabet. Each word shows in the form typed most often, the first
 * alphabetically on a tie. `count` defaults to 1 (one typed word); words
 * without a key are left out.
 */
export const countWords = (
  entries: Iterable<{ text: string; count?: number }>,
  salt = "",
): WordCount[] => {
  const byKey = new Map<string, { count: number; forms: Map<string, number> }>()

  for (const { text, count = 1 } of entries) {
    const key = answerKey(text)

    if (key === "" || !Number.isFinite(count) || count <= 0) {
      continue
    }

    const word = byKey.get(key) ?? {
      count: 0,
      forms: new Map<string, number>(),
    }

    word.count += count
    word.forms.set(text, (word.forms.get(text) ?? 0) + count)
    byKey.set(key, word)
  }

  // A separator no key holds keeps the salt from running into the key. Keys
  // are unique: comparing them only settles two equal hashes.
  return [...byKey.entries()]
    .map(([key, { count, forms }]) => {
      const [[text]] = [...forms.entries()].sort(
        ([textA, countA], [textB, countB]) =>
          countB - countA || compareText(textA, textB),
      )

      return { key, rank: hashText(`${salt}\n${key}`), text, count }
    })
    .sort(
      (a, b) =>
        b.count - a.count || a.rank - b.rank || (a.key < b.key ? -1 : 1),
    )
    .map(({ text, count }) => ({ text, count }))
}
