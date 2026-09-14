import {
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
