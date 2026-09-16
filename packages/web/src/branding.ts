import type { ReactEventHandler } from "react"
import { z } from "zod"

// Name shown when no theme overrides it (page title, logo alt text, footer,
// licences page). The Razzia attribution is kept separately in features/legal.
export const DEFAULT_APP_NAME = "MSAQuiz"

const brandingSchema = z.object({
  appName: z.string().optional(),
  colors: z.record(z.string(), z.string()).optional(),
  answerColors: z.array(z.string()).optional(),
  font: z.object({ family: z.string(), url: z.string().optional() }).optional(),
  logo: z.string().optional(),
  favicon: z.string().optional(),
  background: z.string().optional(),
})

export type BrandingTheme = z.infer<typeof brandingSchema>

let current: BrandingTheme | null = null

export const getBranding = (): BrandingTheme | null => current

// The default --color-secondary and its WCAG relative luminance.
const DEFAULT_NAVY = "#2a3d5d"

const NAVY_LUMINANCE = 0.0462

// The chips index.css draws when the theme sets no answerColors. The first
// one follows --color-primary, whose default is this green.
const DEFAULT_CHIPS = ["#19a96a", "#ffd661", "#005153", "#1799ff"]

const WHITE_LUMINANCE = 1

const HEX_COLOR = /^#(?:[\da-f]{3}|[\da-f]{6})$/iu

const linearise = (channel: number): number => {
  const value = channel / 255

  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

// WCAG relative luminance of a #rgb / #rrggbb colour, null for anything else.
const luminance = (hex: string): number | null => {
  const color = hex.trim()

  if (!HEX_COLOR.test(color)) {
    return null
  }

  // #rgb is shorthand for #rrggbb.
  const digits = color.slice(1).replace(/^(.)(.)(.)$/u, "$1$1$2$2$3$3")
  const [red, green, blue] = [0, 2, 4].map((start) =>
    linearise(Number.parseInt(digits.slice(start, start + 2), 16)),
  )

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

const contrast = (a: number, b: number) =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

// Navy or white, whichever reads better on the chip colour. `secondary` is
// the theme's --color-secondary when it overrides the navy.
export const answerForeground = (
  color: string,
  secondary?: string,
): string | null => {
  const value = luminance(color)

  if (value === null) {
    return null
  }

  const secondaryLuminance =
    secondary === undefined ? null : luminance(secondary)
  const navy = secondaryLuminance ?? NAVY_LUMINANCE

  if (contrast(value, WHITE_LUMINANCE) > contrast(value, navy)) {
    return "#ffffff"
  }

  // A secondary that is not hex was measured as the default navy, so the
  // letter uses that navy rather than a colour nobody measured.
  return secondary === undefined || secondaryLuminance !== null
    ? "var(--color-secondary)"
    : DEFAULT_NAVY
}

export const loadBranding = async (): Promise<BrandingTheme | null> => {
  try {
    const response = await fetch("/branding/theme.json", {
      cache: "no-cache",
      signal: AbortSignal.timeout(2000),
    })

    if (!response.ok) {
      return null
    }

    const parsed = brandingSchema.safeParse(await response.json())
    current = parsed.success ? parsed.data : null

    return current
  } catch {
    return null
  }
}

export const applyBranding = (theme: BrandingTheme | null): void => {
  if (!theme) {
    return
  }

  const root = document.documentElement

  if (theme.colors) {
    for (const [name, value] of Object.entries(theme.colors)) {
      root.style.setProperty(`--color-${name}`, value)
    }
  }

  const { colors, answerColors } = theme

  answerColors?.forEach((color, index) => {
    root.style.setProperty(`--color-answer-${index + 1}`, color)
  })

  // The default letter colours only suit the default chips and navy: once
  // primary, secondary or a chip changes, every chip is measured again.
  if (
    colors?.primary !== undefined ||
    colors?.secondary !== undefined ||
    answerColors
  ) {
    const chips = [
      colors?.primary ?? DEFAULT_CHIPS[0],
      ...DEFAULT_CHIPS.slice(1),
    ]

    answerColors?.forEach((color, index) => {
      chips[index] = color
    })

    chips.forEach((chip, index) => {
      const foreground = answerForeground(chip, colors?.secondary)

      if (foreground) {
        root.style.setProperty(
          `--color-answer-${index + 1}-foreground`,
          foreground,
        )
      }
    })
  }

  if (theme.font) {
    if (theme.font.url) {
      const link = document.createElement("link")
      link.rel = "stylesheet"
      link.href = theme.font.url
      document.head.appendChild(link)
    }

    root.style.setProperty(
      "--font-display",
      `"${theme.font.family}", sans-serif`,
    )
  }

  if (theme.appName) {
    document.title = theme.appName
  }

  if (theme.favicon) {
    const favicon = document.querySelector<HTMLLinkElement>("link#favicon")

    if (favicon) {
      favicon.href = theme.favicon
    }
  }
}

export const imageFallback =
  (fallback: string): ReactEventHandler<HTMLImageElement> =>
  (event) => {
    event.currentTarget.onerror = null
    event.currentTarget.src = fallback
  }
