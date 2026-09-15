import defaultLogo from "@razzia/web/assets/logo.svg"
import {
  DEFAULT_APP_NAME,
  getBranding,
  imageFallback,
} from "@razzia/web/branding"
import {
  RAZZIA_COPYRIGHT,
  RAZZIA_REPOSITORY,
} from "@razzia/web/features/legal/razzia-license"
import { Link } from "@tanstack/react-router"
import type { PropsWithChildren } from "react"
import { useTranslation } from "react-i18next"

const Background = ({ children }: PropsWithChildren) => {
  const branding = getBranding()
  const logo = branding?.logo ?? defaultLogo
  const appName = branding?.appName ?? DEFAULT_APP_NAME
  const { t } = useTranslation()

  return (
    <section className="relative flex min-h-dvh flex-col items-center">
      <div className="absolute h-full max-h-svh w-full overflow-hidden">
        <div className="bg-primary/15 absolute top-[-70vmin] left-[-50vmin] min-h-[120vmin] min-w-[120vmin] rotate-20 rounded-4xl" />
        <div className="bg-primary/15 absolute right-[-10vmin] bottom-[-45vmin] min-h-[75vmin] min-w-[75vmin] rotate-20 rounded-4xl" />
      </div>

      <div className="relative flex w-full flex-1 flex-col items-center justify-center py-8">
        <img
          src={logo}
          onError={imageFallback(defaultLogo)}
          className="mb-10 h-16"
          alt={appName}
        />
        {children}
      </div>

      {/* The MIT licence of Razzia requires its copyright notice and licence
      text to accompany the app: the notice is shown here, the full text on
      the licences page. The footer stays in the page flow so a tall card can
      never cover it. */}
      <footer className="relative flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 pb-4 text-center text-sm font-semibold text-white/70">
        {/* oxlint-disable-next-line no-undef */}
        <span>{`${appName} v${__APP_VERSION__}`}</span>
        <span aria-hidden>·</span>
        <span>
          {t("common:footer.poweredBy")}{" "}
          <a
            href={RAZZIA_REPOSITORY}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-white/40 underline-offset-2 transition-colors hover:text-white hover:decoration-white focus-visible:text-white"
          >
            Razzia
          </a>
        </span>
        <span aria-hidden>·</span>
        <span>
          {t("common:footer.license")} · {RAZZIA_COPYRIGHT}
        </span>
        <span aria-hidden>·</span>
        <Link
          to="/licences"
          className="underline decoration-white/40 underline-offset-2 transition-colors hover:text-white hover:decoration-white focus-visible:text-white"
        >
          {t("common:footer.allLicenses")}
        </Link>
      </footer>
    </section>
  )
}

export default Background
