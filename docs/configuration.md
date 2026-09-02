# Configuration

The configuration lives in the `config` folder (mounted as a Docker volume, or `../../config` relative to the packages when running without Docker). Set `CONFIG_PATH` to point somewhere else.

## What the folder holds

| Path                 | Contents                                                                            |
| -------------------- | ----------------------------------------------------------------------------------- |
| `game.json`          | Manager password, see below.                                                        |
| `msaquiz.db`         | **The database**: quizzes and game results. `-wal` / `-shm` files sit next to it.   |
| `branding/`          | Optional theme (colors, logo, app name), see [Custom Branding](branding.md).        |
| `quizz/`, `results/` | Legacy file storage. Kept for reference only — MSAQuiz no longer reads these files. |

> **Back up this folder.** Since quizzes and results moved to SQLite, `msaquiz.db` is the only copy of everything the team has created. The database is in WAL mode, so a hot copy of the volume is safe.

Migrations run automatically when the server starts: there is nothing to install or administer, and the database file is created on first boot.

## Game Configuration (`config/game.json`)

Main game settings:

```json
{
  "managerPassword": "PASSWORD"
}
```

Options:

- `managerPassword`: The master password for accessing the manager interface. **Must be changed from the default `"PASSWORD"` value**, otherwise manager access is blocked.

See also: [Quizzes](quiz.md) and [Custom Branding](branding.md).
