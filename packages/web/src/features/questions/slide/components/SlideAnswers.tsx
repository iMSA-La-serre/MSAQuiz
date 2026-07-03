import { useTranslation } from "react-i18next"

// An info slide has nothing to answer: show a subtle hint instead of buttons.
const SlideAnswers = () => {
  const { t } = useTranslation()

  return (
    <div className="mx-auto mb-4 flex w-full max-w-7xl justify-center px-2">
      <span className="rounded-full bg-black/40 px-4 py-1.5 text-sm font-semibold text-white/80">
        {t("game:slideInfo")}
      </span>
    </div>
  )
}

export default SlideAnswers
