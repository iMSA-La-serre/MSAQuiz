import { EVENTS } from "@razzia/common/constants"
import { useEvent } from "@razzia/web/features/game/contexts/socket-context"
import ChangePasswordForm from "@razzia/web/features/manager/components/ChangePasswordForm"
import ManagerModal from "@razzia/web/features/manager/components/ManagerModal"
import { PASSWORD_RULE } from "@razzia/web/features/manager/utils/account"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

interface Props {
  onClose: () => void
}

// The signed-in account changes its password. Its other browsers are signed
// out by the server.
const PasswordModal = ({ onClose }: Props) => {
  const { t } = useTranslation()

  useEvent(EVENTS.MANAGER.ERROR_MESSAGE, (message) => {
    toast.error(t(message, PASSWORD_RULE))
  })

  useEvent(EVENTS.MANAGER.PASSWORD_CHANGED, () => {
    toast.success(t("manager:account.passwordChanged"))
    onClose()
  })

  return (
    <ManagerModal
      title={t("manager:account.changePassword")}
      onClose={onClose}
      className="max-w-sm"
    >
      <ChangePasswordForm />
    </ManagerModal>
  )
}

export default PasswordModal
