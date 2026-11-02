import { EVENTS } from "@razzia/common/constants"
import { passwordValidator } from "@razzia/common/validators/auth"
import Button from "@razzia/web/components/Button"
import Input from "@razzia/web/components/Input"
import { useSocket } from "@razzia/web/features/game/contexts/socket-context"
import { PASSWORD_RULE } from "@razzia/web/features/manager/utils/account"
import { type SubmitEvent, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

interface Props {
  // A temporary password, typed just before to sign in, is not asked again.
  temporary?: boolean
}

// The server's answer (manager:passwordChanged, or an error message) is
// handled by the page that shows the form.
const ChangePasswordForm = ({ temporary = false }: Props) => {
  const { socket } = useSocket()
  const { t } = useTranslation()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()

    const policy = passwordValidator.safeParse(newPassword)

    if (!policy.success) {
      toast.error(t(policy.error.issues[0].message, PASSWORD_RULE))

      return
    }

    if (newPassword !== confirmation) {
      toast.error(t("errors:manager.passwordMismatch"))

      return
    }

    socket.emit(
      EVENTS.MANAGER.CHANGE_PASSWORD,
      temporary ? { newPassword } : { currentPassword, newPassword },
    )
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      {!temporary && (
        <Input
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder={t("manager:account.currentPassword")}
          aria-label={t("manager:account.currentPassword")}
        />
      )}
      <Input
        type="password"
        autoComplete="new-password"
        autoFocus={temporary}
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder={t("manager:account.newPassword")}
        aria-label={t("manager:account.newPassword")}
      />
      <Input
        type="password"
        autoComplete="new-password"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        placeholder={t("manager:account.confirmPassword")}
        aria-label={t("manager:account.confirmPassword")}
      />
      <p className="text-muted-foreground text-sm">
        {t("manager:account.passwordRule", PASSWORD_RULE)}
      </p>
      <Button type="submit">{t("manager:account.savePassword")}</Button>
    </form>
  )
}

export default ChangePasswordForm
