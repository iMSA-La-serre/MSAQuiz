import Background from "@razzia/web/components/Background"
import Loader from "@razzia/web/components/Loader"
import { useSocket } from "@razzia/web/features/game/contexts/socket-context"
import { createFileRoute, Outlet } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { z } from "zod"

const searchSchema = z.object({
  pin: z.coerce.string().optional(),
})

const AuthLayout = () => {
  const { isConnected } = useSocket()
  const { t } = useTranslation()

  if (!isConnected) {
    return (
      <Background>
        <Loader className="h-23" />
        <h2 className="mt-2 text-center text-2xl font-bold text-white drop-shadow-lg md:text-3xl">
          {t("common:loading")}
        </h2>
      </Background>
    )
  }

  return (
    <Background>
      <Outlet />
    </Background>
  )
}

export const Route = createFileRoute("/(auth)")({
  component: AuthLayout,
  validateSearch: searchSchema,
})
