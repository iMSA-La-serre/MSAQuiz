import { DEFAULT_APP_NAME, getBranding } from "@razzia/web/branding"
import {
  RAZZIA_COPYRIGHT,
  RAZZIA_LICENSE,
  RAZZIA_REPOSITORY,
} from "@razzia/web/features/legal/razzia-license"
import type { ThirdPartyLicense } from "@razzia/web/features/legal/types"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeft, ChevronRight, ExternalLink } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

const LicencesPage = () => {
  const { t } = useTranslation()
  const appName = getBranding()?.appName ?? DEFAULT_APP_NAME
  const [libraries, setLibraries] = useState<ThirdPartyLicense[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    fetch("/licenses.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        return response.json() as Promise<ThirdPartyLicense[]>
      })
      .then(setLibraries)
      .catch(() => {
        if (!controller.signal.aborted) {
          setFailed(true)
        }
      })

    return () => controller.abort()
  }, [])

  return (
    <main className="min-h-dvh px-4 py-10 text-white">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-4">
          <Link
            to="/"
            className="flex w-fit items-center gap-2 text-sm font-semibold text-white/70 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
            {t("common:licenses.back")}
          </Link>
          <h1 className="text-3xl font-bold md:text-4xl">
            {t("common:licenses.title")}
          </h1>
          <p className="max-w-prose text-white/80">
            {t("common:licenses.intro", { appName })}
          </p>
        </header>

        <section className="text-foreground flex flex-col gap-3 rounded-2xl bg-white p-5 md:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold">Razzia</h2>
            <span className="text-muted-foreground text-sm">
              {t("common:licenses.originalSoftware")} · MIT
            </span>
          </div>
          <p className="font-semibold">{RAZZIA_COPYRIGHT}</p>
          <a
            href={RAZZIA_REPOSITORY}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground decoration-primary hover:decoration-foreground flex w-fit items-center gap-1.5 text-sm font-semibold underline decoration-2 underline-offset-2"
          >
            {t("common:licenses.sourceCode")}
            <ExternalLink className="size-3.5" />
          </a>
          <pre className="bg-muted overflow-x-auto rounded-lg p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {RAZZIA_LICENSE}
          </pre>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold">
              {t("common:licenses.thirdParty")}
            </h2>
            {libraries && (
              <span className="text-sm text-white/70">
                {t("common:licenses.count", { count: libraries.length })}
              </span>
            )}
          </div>

          {failed && (
            <p className="rounded-xl bg-white/10 p-4">
              {t("common:licenses.error")}
            </p>
          )}

          {!failed && !libraries && (
            <p className="text-white/70">{t("common:loading")}</p>
          )}

          {libraries && (
            <ul className="text-foreground divide-accent divide-y overflow-hidden rounded-2xl bg-white">
              {libraries.map((library) => (
                <li key={`${library.name}@${library.version}`}>
                  <details className="group">
                    <summary className="hover:bg-muted focus-visible:bg-muted focus-visible:ring-primary flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
                      <span className="flex min-w-0 items-center gap-2 font-semibold break-all">
                        <ChevronRight
                          aria-hidden
                          className="size-4 shrink-0 transition-transform group-open:rotate-90"
                        />
                        {library.name}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {library.version} · {library.license}
                      </span>
                    </summary>
                    <div className="flex flex-col gap-3 px-4 pb-4">
                      {library.repository && (
                        <a
                          href={library.repository}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-foreground decoration-primary hover:decoration-foreground flex w-fit items-center gap-1.5 text-sm font-semibold break-all underline decoration-2 underline-offset-2"
                        >
                          {library.repository}
                          <ExternalLink className="size-3.5 shrink-0" />
                        </a>
                      )}
                      {library.notices.length === 0 && (
                        <p className="text-muted-foreground text-sm">
                          {t("common:licenses.noFile")}
                        </p>
                      )}
                      {library.notices.map((notice) => (
                        <div key={notice.file} className="flex flex-col gap-1">
                          {notice.generated && (
                            <p className="text-muted-foreground text-sm">
                              {t("common:licenses.generated")}
                            </p>
                          )}
                          <pre className="bg-muted overflow-x-auto rounded-lg p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                            {notice.text}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}

export const Route = createFileRoute("/licences")({
  component: LicencesPage,
})
