// The MIT licence of Razzia, the open-source project MSAQuiz is built on. The
// licence requires its copyright line and full text to ship with every copy of
// the software, so both are read from the repository's LICENSE file at build
// time instead of being copied by hand.
import license from "../../../../../LICENSE?raw"

export const RAZZIA_LICENSE = license.replace(/\r\n/gu, "\n").trim()

export const RAZZIA_COPYRIGHT =
  /^Copyright .*$/mu.exec(license)?.[0] ?? "Copyright (c) 2024 Ralex"

export const RAZZIA_REPOSITORY = "https://github.com/Ralex91/Razzia"
