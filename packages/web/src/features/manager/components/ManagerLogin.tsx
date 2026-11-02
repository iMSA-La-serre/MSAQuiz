import Button from "@razzia/web/components/Button"
import Card from "@razzia/web/components/Card"
import Input from "@razzia/web/components/Input"
import { type SubmitEvent, useState } from "react"
import { useTranslation } from "react-i18next"

interface Props {
  onSubmit: (_login: string, _password: string) => void
}

// A form, so that Enter sends it and the browser offers to fill and save the
// password.
const ManagerLogin = ({ onSubmit }: Props) => {
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const { t } = useTranslation()

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit(login, password)
  }

  return (
    <Card>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <Input
          autoComplete="username"
          autoFocus
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          placeholder={t("manager:login.identifier")}
          aria-label={t("manager:login.identifier")}
        />
        <Input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("manager:passwordPlaceholder")}
          aria-label={t("manager:passwordPlaceholder")}
        />
        <Button type="submit" className="mt-1">
          {t("manager:login.submit")}
        </Button>
      </form>
    </Card>
  )
}

export default ManagerLogin
