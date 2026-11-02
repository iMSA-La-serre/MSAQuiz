import {
  AUTH_LIMITS,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
} from "@razzia/common/constants"
import z from "zod"

export const usernameValidator = z
  .string()
  .min(1, "errors:auth.usernameTooShort")
  .max(20, "errors:auth.usernameTooLong")

const inviteCodePattern = new RegExp(
  `^[${INVITE_CODE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`,
  "u",
)

// Case and surrounding spaces don't matter: "7k2px " is read as "7K2PX".
export const inviteCodeValidator = z
  .string()
  .trim()
  .toUpperCase()
  .regex(inviteCodePattern, "errors:auth.invalidInviteCode")

// A password an account chooses. Its length alone is required: no mix of
// character kinds, which makes passwords harder to remember, not to guess.
export const passwordValidator = z
  .string()
  .min(AUTH_LIMITS.PASSWORD_MIN_LENGTH, "errors:manager.passwordTooShort")
  .max(AUTH_LIMITS.PASSWORD_MAX_LENGTH, "errors:manager.passwordTooLong")

// The sign-in identifier, as stored: an email address in lower case, or
// "admin".
export const normalizeLogin = (login: string) => login.trim().toLowerCase()

export const userRoleValidator = z.enum(["admin", "creator"])

// An account an administrator creates.
export const newUserValidator = z.object({
  name: z
    .string()
    .trim()
    .min(1, "errors:users.invalidName")
    .max(AUTH_LIMITS.NAME_LENGTH, "errors:users.invalidName"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(AUTH_LIMITS.EMAIL_LENGTH, "errors:users.invalidEmail")
    .pipe(z.email("errors:users.invalidEmail")),
  role: userRoleValidator,
})

export type NewUser = z.infer<typeof newUserValidator>
