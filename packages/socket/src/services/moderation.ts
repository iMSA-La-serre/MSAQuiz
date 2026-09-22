import { parseModerationList } from "@razzia/common/utils/moderation"
import fs from "node:fs"
import { resolve } from "node:path"

// Beyond this size, moderation.txt is ignored rather than read at every word
// cloud question.
const MAX_BYTES = 1_000_000

// The config folder, found as db/client.ts and services/config.ts find it.
const moderationFile = () =>
  resolve(
    process.env.CONFIG_PATH
      ? resolve(process.env.CONFIG_PATH)
      : resolve(process.cwd(), "../../config"),
    "moderation.txt",
  )

/**
 * Optional moderation.txt in the config folder: words and expressions, one
 * per line (# starts a comment), that a word cloud drops on top of its
 * built-in list. Missing, unreadable or too large, nothing is added. Lstat,
 * so a symlink is not followed.
 */
export const getModerationWords = (): string[] => {
  const filePath = moderationFile()

  try {
    const stats = fs.lstatSync(filePath)

    if (!stats.isFile()) {
      return []
    }

    if (stats.size > MAX_BYTES) {
      console.warn("moderation.txt is larger than 1 MB: ignored")

      return []
    }

    return parseModerationList(fs.readFileSync(filePath, "utf-8"))
  } catch {
    return []
  }
}
