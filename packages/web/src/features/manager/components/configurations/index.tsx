import { EVENTS } from "@razzia/common/constants"
import type { ManagerConfig } from "@razzia/common/types/manager"
import Card from "@razzia/web/components/Card"
import { useSocket } from "@razzia/web/features/game/contexts/socket-context"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import ConfigManageQuizz from "@razzia/web/features/manager/components/configurations/ConfigManageQuizz"
import ConfigResults from "@razzia/web/features/manager/components/configurations/ConfigResults"
import ConfigSelectQuizz from "@razzia/web/features/manager/components/configurations/ConfigSelectQuizz"
import ConfigStats from "@razzia/web/features/manager/components/configurations/ConfigStats"
import ConfigTabButton from "@razzia/web/features/manager/components/configurations/ConfigTabButton"
import PasswordModal from "@razzia/web/features/manager/components/PasswordModal"
import UsersModal from "@razzia/web/features/manager/components/UsersModal"
import { ConfigProvider } from "@razzia/web/features/manager/contexts/config-context"
import { clearSessionToken } from "@razzia/web/features/manager/utils/account"
import { KeyRound, LogOut, Users } from "lucide-react"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"

const headerButton =
  "text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-sm p-1.5"

const tabs = [
  {
    nameKey: "manager:tabs.play",
    component: ConfigSelectQuizz,
  },
  {
    nameKey: "manager:tabs.quizz",
    component: ConfigManageQuizz,
  },
  {
    nameKey: "manager:tabs.results",
    component: ConfigResults,
  },
  {
    nameKey: "manager:tabs.stats",
    component: ConfigStats,
  },
]

interface Props {
  data: ManagerConfig
}

const Configurations = ({ data }: Props) => {
  const [selectedTab, setSelectedTab] = useState(0)
  const [modal, setModal] = useState<"password" | "users" | null>(null)
  const { reset } = useManagerStore()
  const { socket } = useSocket()
  const { t } = useTranslation()
  const TabComponent = tabs[selectedTab].component

  const handleSelect = (index: number) => () => {
    setSelectedTab(index)
  }

  const closeModal = useCallback(() => setModal(null), [])

  const handleLogout = () => {
    socket.emit(EVENTS.MANAGER.LOGOUT)
    clearSessionToken()
    reset()
  }

  return (
    <ConfigProvider data={data}>
      <Card className="max-h-[80svh] w-full max-w-md">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-lg font-semibold">
              {t("manager:configurationsTitle")}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {t("manager:account.signedInAs", { name: data.user.name })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {data.user.role === "admin" && (
              <button
                className={headerButton}
                onClick={() => setModal("users")}
                title={t("manager:users.title")}
              >
                <Users className="size-4" />
              </button>
            )}
            <button
              className={headerButton}
              onClick={() => setModal("password")}
              title={t("manager:account.changePassword")}
            >
              <KeyRound className="size-4" />
            </button>
            <button
              className={headerButton}
              onClick={handleLogout}
              title={t("manager:logout")}
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
        <div className="bg-muted flex shrink-0 overflow-hidden rounded-lg">
          {tabs.map((tab, index) => (
            <ConfigTabButton
              key={tab.nameKey}
              active={index === selectedTab}
              onClick={handleSelect(index)}
            >
              {t(tab.nameKey)}
            </ConfigTabButton>
          ))}
        </div>
        <hr className="text-muted my-4 border" />
        <div className="flex min-h-0 flex-1 flex-col">
          <TabComponent />
        </div>
      </Card>
      {modal === "users" && <UsersModal onClose={closeModal} />}
      {modal === "password" && <PasswordModal onClose={closeModal} />}
    </ConfigProvider>
  )
}

export default Configurations
