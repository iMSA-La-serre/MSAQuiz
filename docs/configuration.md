# Configuration

The configuration lives in the `config` folder (mounted as a Docker volume, or `../../config` relative to the packages when running without Docker). Set `CONFIG_PATH` to point somewhere else.

## What the folder holds

| Path                 | Contents                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| `game.json`          | First password of the `admin` account, see below.                                              |
| `msaquiz.db`         | **The database**: accounts, quizzes and game results. `-wal` / `-shm` files sit next to it.    |
| `branding/`          | Optional theme (colors, logo, app name), see [Custom Branding](branding.md).                   |
| `moderation.txt`     | Optional words a word cloud drops, see [Word cloud moderation](quiz.md#word-cloud-moderation). |
| `quizz/`, `results/` | Legacy file storage. Kept for reference only — MSAQuiz no longer reads these files.            |

> **Back up this folder.** Since quizzes and results moved to SQLite, `msaquiz.db` is the only copy of everything the team has created. The database is in WAL mode, so a hot copy of the volume is safe.

Migrations run automatically when the server starts: there is nothing to install or administer, and the database file is created on first boot.

## Game Configuration (`config/game.json`)

```json
{
  "managerPassword": "PASSWORD"
}
```

- `managerPassword`: the first password of the `admin` account. As long as that account has no password of its own, signing in as `admin` with this one works, and asks at once for a new password. From then on this value opens nothing: leave it in place, it only serves to [recover access](#recovering-the-admin-account). With the default `"PASSWORD"`, the `admin` account cannot sign in.

## Accounts

The manager interface takes one account per person: an identifier, their email address, and a password. Players are not concerned: they still join with the game code and a nickname.

- **First start.** The `admin` account exists from the start. Sign in with the identifier `admin` and `managerPassword`, choose a new password, then create the other accounts with the **Comptes** button, at the top of the configuration card.
- **Roles.** _Administrateur_: manages the accounts, and everything an _Animateur_ does: create and run quizzes, see results and statistics. Every account sees every quiz; the account that saves or imports a quiz is recorded as its owner.
- **Temporary passwords.** A new account, or one whose password an administrator resets, gets a temporary password, shown once to the administrator, who passes it on. It must be changed at the first sign-in, before anything else.
- **Forgotten password.** An administrator resets it. There is no email: nothing to configure.
- **Password rule.** 12 characters at least, no other constraint (`AUTH_LIMITS` in `packages/common/src/constants.ts`).
- **Storage.** Passwords are stored hashed with scrypt, never in clear. A session is a random token the browser keeps (local storage); the database only holds its SHA-256, so a copy of the database opens no session.
- **Sessions.** A session ends after 12 hours unused, and at the latest 7 days after signing in. Changing a password signs the account's other browsers out; resetting it, or disabling the account, signs it out everywhere at once.
- **Failed sign-ins.** After 5 failures in a row, an identifier is refused for 15 minutes, whether an account has it or not. The count lives in memory: a restart clears it.
- **Disabling.** An account is disabled, never deleted: its quizzes and results stay. Administrators cannot disable their own account or take away its role, so one administrator always remains.

Run the interface over HTTPS only: the passwords travel in the WebSocket messages.

### Recovering the admin account

When no administrator can sign in any more, empty the `admin` account's password, then sign in as `admin` with `managerPassword` (which must not be `"PASSWORD"`). With Docker:

```sh
docker exec msaquiz node -e "require('/app/socket/node_modules/better-sqlite3')('/app/config/msaquiz.db').prepare(\"UPDATE users SET password_hash = NULL, disabled = 0, role = 'admin' WHERE id = 'admin'\").run()"
```

No restart is needed: the next sign-in as `admin` takes `managerPassword` as a temporary password, and asks for a new one.

See also: [Quizzes](quiz.md) and [Custom Branding](branding.md).
