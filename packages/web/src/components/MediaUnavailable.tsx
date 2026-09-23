import type { ImageRetry } from "@razzia/web/hooks/useImageFailure"
import clsx from "clsx"
import { ImageOff } from "lucide-react"
import { useTranslation } from "react-i18next"

interface Props {
  // The size of the media it stands in for.
  className?: string
  // On the game's background, or on a white card (the editor, the result
  // window).
  tone?: "stage" | "card"
  // In the middle of the block; or small, at its bottom, under markers that
  // are placed over it (the middle is where a marker often is).
  placement?: "center" | "bottom"
  // The address tried again behind the block, once per mount: the picture
  // comes back as soon as it loads (see useImageFailure).
  retry?: ImageRetry
}

/**
 * Stands in for an image that did not load, at the place it would take: a
 * neutral block rather than a broken-image icon. Its icon and its label grow
 * with the projected screen.
 */
const MediaUnavailable = ({
  className,
  tone = "stage",
  placement = "center",
  retry,
}: Props) => {
  const { t } = useTranslation()
  const label = t("game:media.imageUnavailable")

  return (
    <div
      role="img"
      aria-label={label}
      className={clsx(
        "flex text-center font-semibold",
        placement === "center"
          ? "flex-col items-center justify-center gap-2 text-sm"
          : "flex-row items-end justify-center gap-1.5 pb-2 text-xs",
        tone === "stage"
          ? clsx(
              "bg-black/25 text-white/70",
              placement === "center" ? "lg:text-xl 2xl:text-2xl" : "lg:text-sm",
            )
          : "bg-muted text-accent-foreground",
        className,
      )}
    >
      <ImageOff
        className={clsx(
          "shrink-0",
          placement === "center" ? "size-[2em]" : "size-[1.5em]",
        )}
        aria-hidden
      />
      <span aria-hidden>{label}</span>
      {retry && (
        <img src={retry.url} alt="" aria-hidden hidden onLoad={retry.onLoad} />
      )}
    </div>
  )
}

export default MediaUnavailable
