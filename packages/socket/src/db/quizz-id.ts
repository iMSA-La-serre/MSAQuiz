import { nanoid } from "nanoid"

/**
 * Same id format as upstream's `normalizeFilename` (utils/game.ts), duplicated
 * here so the db layer does not pull in the game engine (whose registry starts
 * a cleanup interval on import).
 */
export const createQuizzId = (subject: string) => {
  const slug = subject
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/gu, "-")
    .replace(/[^a-z0-9-]/gu, "")
    .slice(0, 10)

  const shortId = nanoid(8)

  return `${slug}-${shortId}`
}
