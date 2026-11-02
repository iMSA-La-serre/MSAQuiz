import { randomBytes, scrypt, timingSafeEqual } from "node:crypto"
import { customAlphabet } from "nanoid"

interface ScryptSettings {
  N: number
  r: number
  p: number
  keyLength: number
}

// One of the scrypt settings OWASP recommends (N=2^14, r=8, p=5: 16 MiB,
// about a quarter of a second). It runs off the event loop, so a sign-in
// never holds up the games in progress.
const SETTINGS: ScryptSettings = { N: 2 ** 14, r: 8, p: 5, keyLength: 64 }
const SALT_LENGTH = 16

const derive = (
  password: string,
  salt: Buffer,
  { keyLength, ...params }: ScryptSettings,
) =>
  new Promise<Buffer>((resolve, reject) => {
    // The same password typed with a composed or a decomposed accent gives
    // the same key.
    scrypt(
      password.normalize("NFKC"),
      salt,
      keyLength,
      params,
      (error, key) => {
        if (error) {
          reject(error)

          return
        }

        resolve(key)
      },
    )
  })

// Stored as "scrypt$N$r$p$salt$key", in base64: each hash keeps the settings
// it was made with, so they can be raised later without locking anyone out.
export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(SALT_LENGTH)
  const key = await derive(password, salt, SETTINGS)

  return [
    "scrypt",
    SETTINGS.N,
    SETTINGS.r,
    SETTINGS.p,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$")
}

// False for a malformed hash too: a row edited by hand never lets anyone in.
export const verifyPassword = async (
  password: string,
  stored: string,
): Promise<boolean> => {
  const [scheme, n, r, p, salt, key] = stored.split("$")

  if (scheme !== "scrypt" || !salt || !key) {
    return false
  }

  const expected = Buffer.from(key, "base64")

  // An empty key would equal any other empty key.
  if (expected.length < SETTINGS.keyLength / 2) {
    return false
  }

  try {
    const actual = await derive(password, Buffer.from(salt, "base64"), {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      keyLength: expected.length,
    })

    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

// Read off a screen or over the phone: no look-alikes (0/O, 1/l/I), in three
// groups of four. About 70 bits, and it only lasts until the first sign-in.
const temporaryGroup = customAlphabet(
  "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789",
  4,
)

export const createTemporaryPassword = () =>
  [temporaryGroup(), temporaryGroup(), temporaryGroup()].join("-")
