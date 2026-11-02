import type { GameResultMeta, QuizzMeta } from "@razzia/common/types/game"

export type UserRole = "admin" | "creator"

// The account signed in to the manager interface.
export interface ManagerUser {
  id: string
  name: string
  // The sign-in identifier: an email address, or "admin" for the account
  // created on first start.
  email: string
  role: UserRole
  // A temporary password, to change before anything else.
  mustChangePassword: boolean
}

// An account as the administrators see it.
export interface UserAccount extends ManagerUser {
  disabled: boolean
}

export interface ManagerConfig {
  quizz: QuizzMeta[]
  results: GameResultMeta[]
  user: ManagerUser
}
