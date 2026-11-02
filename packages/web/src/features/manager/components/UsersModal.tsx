import { EVENTS } from "@razzia/common/constants"
import type { UserAccount, UserRole } from "@razzia/common/types/manager"
import { newUserValidator } from "@razzia/common/validators/auth"
import AlertDialog from "@razzia/web/components/AlertDialog"
import Button from "@razzia/web/components/Button"
import Input from "@razzia/web/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@razzia/web/components/Select"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import ManagerModal from "@razzia/web/features/manager/components/ManagerModal"
import { useConfig } from "@razzia/web/features/manager/contexts/config-context"
import clsx from "clsx"
import { Copy, KeyRound, UserCheck, UserX } from "lucide-react"
import {
  type SubmitEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const ROLES: UserRole[] = ["creator", "admin"]

const isRole = (value: string): value is UserRole =>
  ROLES.some((role) => role === value)

interface TemporaryPassword {
  id: string
  password: string
}

interface Props {
  onClose: () => void
}

const iconButton = "shrink-0 rounded-sm p-2 hover:bg-gray-600/10"

// The administrators' list of accounts. A new account, or one whose password
// is reset, gets a temporary password shown here once, to pass on: it is
// changed at the first sign-in.
const UsersModal = ({ onClose }: Props) => {
  const { socket } = useSocket()
  const { user: me } = useConfig()
  const { t } = useTranslation()
  const [accounts, setAccounts] = useState<UserAccount[] | null>(null)
  const [temporary, setTemporary] = useState<TemporaryPassword | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<UserRole>("creator")
  // A creation sent: its form is emptied once the server confirms it.
  const creating = useRef(false)
  const passwordRef = useRef<HTMLElement>(null)

  useEffect(() => {
    socket.emit(EVENTS.USERS.LIST)
  }, [socket])

  useEvent(
    EVENTS.USERS.DATA,
    useCallback((data: UserAccount[]) => setAccounts(data), []),
  )

  useEvent(
    EVENTS.USERS.TEMPORARY_PASSWORD,
    useCallback((data: TemporaryPassword) => {
      setTemporary(data)

      if (creating.current) {
        creating.current = false
        setName("")
        setEmail("")
        setRole("creator")
      }
    }, []),
  )

  useEvent(EVENTS.USERS.ERROR, (message) => {
    creating.current = false
    toast.error(t(message))
  })

  const handleCreate = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()

    const parsed = newUserValidator.safeParse({ name, email, role })

    if (!parsed.success) {
      toast.error(t(parsed.error.issues[0].message))

      return
    }

    creating.current = true
    socket.emit(EVENTS.USERS.CREATE, parsed.data)
  }

  const update = (
    id: string,
    changes: { role?: UserRole; disabled?: boolean },
  ) => {
    socket.emit(EVENTS.USERS.UPDATE, { id, ...changes })
  }

  const resetPassword = (id: string) => () => {
    socket.emit(EVENTS.USERS.RESET_PASSWORD, id)
  }

  const handleCopy = async () => {
    if (!temporary) {
      return
    }

    try {
      await navigator.clipboard.writeText(temporary.password)
      toast.success(t("manager:users.copied"))
    } catch {
      // The browser refused (its permissions, or a page not in HTTPS): the
      // password is selected instead, for Ctrl+C.
      const selection = window.getSelection()

      if (passwordRef.current && selection) {
        selection.selectAllChildren(passwordRef.current)
      }

      toast.error(t("manager:users.copyFailed"))
    }
  }

  const temporaryAccount = accounts?.find(({ id }) => id === temporary?.id)

  const statusOf = (account: UserAccount) => {
    if (account.disabled) {
      return t("manager:users.disabled")
    }

    return account.mustChangePassword ? t("manager:users.pending") : null
  }

  return (
    <ManagerModal title={t("manager:users.title")} onClose={onClose}>
      <form className="flex flex-col gap-2" onSubmit={handleCreate}>
        <p className="text-foreground font-semibold">
          {t("manager:users.new")}
        </p>
        <Input
          variant="sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("manager:users.name")}
          aria-label={t("manager:users.name")}
        />
        <Input
          variant="sm"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("manager:users.email")}
          aria-label={t("manager:users.email")}
        />
        <div className="flex gap-2">
          <Select
            value={role}
            onValueChange={(value) => {
              if (isRole(value)) {
                setRole(value)
              }
            }}
          >
            <SelectTrigger
              className="min-w-0 flex-1"
              aria-label={t("manager:users.role")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`manager:users.roles.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" size="sm" className="shrink-0">
            {t("manager:users.create")}
          </Button>
        </div>
      </form>

      {temporary && (
        <div className="border-primary bg-primary/10 mt-4 rounded-lg border-2 p-3">
          <p className="text-foreground text-sm font-semibold">
            {t("manager:users.temporaryPassword", {
              email: temporaryAccount?.email ?? "",
            })}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code
              ref={passwordRef}
              className="bg-background text-foreground min-w-0 flex-1 rounded px-2 py-1 font-mono text-lg tracking-wider select-all"
            >
              {temporary.password}
            </code>
            <button
              className={iconButton}
              onClick={handleCopy}
              title={t("manager:users.copy")}
            >
              <Copy className="size-4" />
            </button>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            {t("manager:users.temporaryHint")}
          </p>
        </div>
      )}

      <hr className="text-muted my-4 border" />

      <div className="space-y-2">
        {accounts === null && (
          <p className="text-muted-foreground text-center">
            {t("common:loading")}
          </p>
        )}

        {accounts?.map((account) => {
          const self = account.id === me.id
          const status = statusOf(account)

          return (
            <div
              key={account.id}
              className={clsx(
                "border-accent flex items-center gap-2 rounded-md border-2 p-3",
                account.disabled && "opacity-60",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate font-medium">
                  {self
                    ? t("manager:users.you", { name: account.name })
                    : account.name}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {account.email}
                </p>
                {status && (
                  <p
                    className={clsx(
                      "text-xs font-semibold",
                      account.disabled ? "text-danger" : "text-primary",
                    )}
                  >
                    {status}
                  </p>
                )}
              </div>

              {self ? (
                <span className="text-muted-foreground shrink-0 text-sm">
                  {t(`manager:users.roles.${account.role}`)}
                </span>
              ) : (
                <>
                  <Select
                    value={account.role}
                    onValueChange={(value) => {
                      if (isRole(value)) {
                        update(account.id, { role: value })
                      }
                    }}
                  >
                    <SelectTrigger
                      className="w-36 shrink-0"
                      aria-label={t("manager:users.role")}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(`manager:users.roles.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <AlertDialog
                    trigger={
                      <button
                        className={iconButton}
                        title={t("manager:users.resetPassword")}
                      >
                        <KeyRound className="size-4" />
                      </button>
                    }
                    title={t("manager:users.resetPassword")}
                    description={t("manager:users.resetConfirm", {
                      name: account.name,
                    })}
                    confirmLabel={t("manager:users.reset")}
                    onConfirm={resetPassword(account.id)}
                  />

                  {account.disabled ? (
                    <button
                      className={iconButton}
                      onClick={() => update(account.id, { disabled: false })}
                      title={t("manager:users.enable")}
                    >
                      <UserCheck className="size-4" />
                    </button>
                  ) : (
                    <AlertDialog
                      trigger={
                        <button
                          className={clsx(iconButton, "hover:bg-danger/10")}
                          title={t("manager:users.disable")}
                        >
                          <UserX className="stroke-danger size-4" />
                        </button>
                      }
                      title={t("manager:users.disable")}
                      description={t("manager:users.disableConfirm", {
                        name: account.name,
                      })}
                      confirmLabel={t("manager:users.disable")}
                      onConfirm={() => update(account.id, { disabled: true })}
                    />
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </ManagerModal>
  )
}

export default UsersModal
