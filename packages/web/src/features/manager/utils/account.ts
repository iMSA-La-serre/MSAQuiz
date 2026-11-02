import { AUTH_LIMITS } from "@razzia/common/constants"

// The manager's session token, kept between visits and sent with every
// connection (socket-context).
const SESSION_TOKEN_KEY = "manager_session"

export const readSessionToken = (): string | null => {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY)
  } catch {
    return null
  }
}

export const saveSessionToken = (token: string) => {
  try {
    localStorage.setItem(SESSION_TOKEN_KEY, token)
  } catch {
    // Storage refused: the session lasts as long as the connection.
  }
}

export const clearSessionToken = () => {
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY)
  } catch {
    // Nothing was stored.
  }
}

// What the password rules' messages count.
export const PASSWORD_RULE = {
  min: AUTH_LIMITS.PASSWORD_MIN_LENGTH,
  max: AUTH_LIMITS.PASSWORD_MAX_LENGTH,
}
