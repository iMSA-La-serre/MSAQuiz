// First visible character of a username, emoji included.
export const initial = (username: string) =>
  String.fromCodePoint(username.trim().codePointAt(0) ?? 63).toUpperCase()
