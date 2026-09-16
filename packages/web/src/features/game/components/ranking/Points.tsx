import clsx from "clsx"
import { useTranslation } from "react-i18next"
import { twMerge } from "tailwind-merge"

interface Props {
  value: number
  large?: boolean
  className?: string
  // White/75 fails on a green surface, which needs a solid unit.
  unitClassName?: string
}

const Points = ({ value, large, className, unitClassName }: Props) => {
  const { t, i18n } = useTranslation()

  return (
    <p
      className={twMerge(
        clsx(
          "shrink-0 font-bold tabular-nums",
          large ? "text-3xl md:text-5xl" : "text-xl md:text-2xl",
          className,
        ),
      )}
    >
      {new Intl.NumberFormat(i18n.language).format(value)}
      <span
        className={twMerge(
          clsx(
            "ml-1 font-semibold text-white/75",
            large ? "text-lg md:text-2xl" : "text-base",
            unitClassName,
          ),
        )}
      >
        {t("game:finale.points")}
      </span>
    </p>
  )
}

export default Points
