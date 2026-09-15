import defaultBackground from "@razzia/web/assets/background.svg"
import { getBranding, imageFallback } from "@razzia/web/branding"

const GameBackground = () => {
  const background = getBranding()?.background ?? defaultBackground

  return (
    <div className="bg-secondary pointer-events-none fixed inset-0">
      <img
        className="pointer-events-none h-full w-full object-cover select-none"
        src={background}
        onError={imageFallback(defaultBackground)}
        alt=""
      />
    </div>
  )
}

export default GameBackground
