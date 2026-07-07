import i18n, { type Resource, type ResourceKey } from "i18next"
import { initReactI18next } from "react-i18next"

// MSAQuiz est une application interne francophone : le français est la seule
// langue chargée (les autres locales upstream restent dans le dépôt mais ne
// sont ni chargées ni proposées).
const modules = import.meta.glob("./locales/fr/*.json", { eager: true })

const resources = Object.entries(modules).reduce<Resource>(
  (acc, [path, mod]) => {
    const match = /\.\/locales\/(\w+)\/(\w+)\.json$/u.exec(path)

    if (!match) {
      return acc
    }

    const [, lang, ns] = match
    acc[lang] ??= {}
    acc[lang][ns] = (mod as { default: ResourceKey }).default

    return acc
  },
  {},
)

i18n.use(initReactI18next).init({
  lng: "fr",
  fallbackLng: "fr",
  defaultNS: "common",
  resources,
  interpolation: { escapeValue: false },
})

export default i18n
