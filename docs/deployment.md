# Deployment (iMSA)

MSAQuiz runs on the Studio team's server, behind the Traefik reverse proxy it shares with the team's other sites. A deployment is one command, [`deploy/deploy-msaquiz.sh`](../deploy/deploy-msaquiz.sh), run over SSH on that server.

```sh
~/bin/deploy-msaquiz.sh            # deploy the latest commit of release/imsa-demo
~/bin/deploy-msaquiz.sh <sha>      # deploy one specific commit
~/bin/deploy-msaquiz.sh --rollback # go back to the version that ran before the last deployment
~/bin/deploy-msaquiz.sh --backup   # back the database up and stop there
~/bin/deploy-msaquiz.sh --status   # print the current state, change nothing
```

Two things a deployment always costs: **every running game is lost and its join code dies** (game state lives in memory, and an unfinished game saves no result), and **the host must hard-refresh** (Ctrl+Shift+R) before starting a quiz again, otherwise that tab keeps the old front-end code. `--status` prints how many connections the game server currently has — a rough hint that someone is playing, since an idle tab on the home page counts too.

## Prerequisites

- SSH access to the server as `studio` (member of the `docker` group).
- The clone `~/projects/MSAQuiz` on branch `release/imsa-demo`. **Only the script ever touches it**: it refuses to deploy if the clone has local changes.
- The `msaquiz` service in the shared Compose project `~/mmsam`, its container named `msaquiz`, and the data volume `~/mmsam/msaquiz/config`.
- `deploy/deploy-msaquiz.sh` **committed and pushed** to `release/imsa-demo` — the install command below fetches it from there.
- `docker-compose` lives in `~/.local/bin`, which a non-login SSH shell does not add to `PATH`. The script prepends it itself; the manual commands further down spell out the full path.

## Installing it on the server

```sh
mkdir -p ~/bin && git -C ~/projects/MSAQuiz fetch origin && git -C ~/projects/MSAQuiz show origin/release/imsa-demo:deploy/deploy-msaquiz.sh > ~/bin/deploy-msaquiz.sh.new && chmod 755 ~/bin/deploy-msaquiz.sh.new && mv ~/bin/deploy-msaquiz.sh.new ~/bin/deploy-msaquiz.sh
```

It writes to a temporary name and only then moves it into place, so a failed fetch cannot leave an empty, executable script behind.

Then check that it reads the server correctly — `--status` modifies nothing:

```sh
~/bin/deploy-msaquiz.sh --status
```

It prints the clone's commit, the container and its image, the state of the branding folder, free disk space and the number of backups.

Installing **outside** the clone is not a style preference: Bash reads a script as it runs it, so the `git checkout` of a deployment would rewrite the file under the running shell. The script refuses to start from inside `~/projects/MSAQuiz`. For the same reason a deployment never updates the installed copy — when `deploy/deploy-msaquiz.sh` changes in the repository, the end of a successful deployment prints a `note` line; review the change, then re-run the install command.

## What a deployment does, in order

1. **Checks the ground**: no other deployment running (lock), clone present and clean, the commit really on `release/imsa-demo`, the running container really built from the expected image name, enough free disk **on both** the `~/mmsam` filesystem and Docker's own, a warning if a `config/branding/` folder is overriding the identity built into the image.
2. **Backs the database up** through the SQLite backup API, then reopens the copy to check its integrity and row counts — a backup nobody read is not a backup. Files land in `~/backups/msaquiz/`, the 15 most recent are kept, and a copy that fails is removed instead of being left under a plausible name.
3. **Keeps the online image** as `<image>:previous` and records the commit it came from in `~/backups/msaquiz/image-previous.txt`.
4. **Moves the clone** to the exact commit asked for.
5. **Builds the image** while the current version stays online.
6. **Recreates the `msaquiz` container only** — never a project-wide `up`, since the team's ~18 other services live in the same Compose project — and checks that the container really runs the new image.
7. **Verifies** that nginx serves the page and that the socket.io handshake answers through `/ws`, then checks again ten seconds later to catch a container that restarts in a loop.
8. **Tidies up**: the image that `:previous` pointed to before this deployment has lost its last tag, so it is deleted. Nothing else is pruned.

## If something fails

| Failure during                | What happens                                                                                                                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the checks, the backup        | Nothing was deployed and nothing was changed. The site keeps running.                                                                                                                          |
| the code update, the build    | The clone is reset to the previous commit and **the service is not restarted**: the site is still online on the previous version, no game lost.                                                |
| the restart, the verification | The previous image and commit are put back, the container recreated, and its health rechecked for a minute. The log says whether it is back online, or prints the command to run if it is not. |

The database backup is only ever read, never restored automatically.

## Rolling back

```sh
~/bin/deploy-msaquiz.sh --rollback
```

This rebuilds the commit that was online before the last deployment, read from `~/backups/msaquiz/image-previous.txt`. If that file is missing, the script says so rather than deploying the tip by mistake. After a deployment that already rolled itself back, that commit **is** the running one, so the answer is `ce commit est déjà en ligne, rien à faire`.

To go back further, pass a commit: `~/bin/deploy-msaquiz.sh <sha>` (it must be an ancestor of `release/imsa-demo`).

In a hurry, put the previous image back without a build:

```sh
docker tag mmsam-msaquiz:previous mmsam-msaquiz:latest && cd ~/mmsam && ~/.local/bin/docker-compose up -d --no-deps --force-recreate msaquiz
```

The clone then sits on a newer commit than the running image; the next deployment fixes that.

> **Never run `docker image prune -a` or `docker system prune -a` on this box.** No container uses `mmsam-msaquiz:previous`, so they would delete it — and with it the quick rollback. `docker builder prune` only clears the build cache, which is shared with the other services: agree it with the team first.

## Restoring the database

Only when a deployment damaged the data — a bad migration, typically. Everything written since the backup is lost, so take a fresh backup of the current state first:

```sh
~/bin/deploy-msaquiz.sh --backup
```

Then pick the file to restore in `~/backups/msaquiz/` (its name carries the date and the commit that was online) and run these three commands in order. **Never run the middle one while the container is up**: restoring under a live writer corrupts the file.

```sh
cd ~/mmsam && ~/.local/bin/docker-compose stop msaquiz
docker run --rm --entrypoint sh -v ~/mmsam/msaquiz/config:/config -v ~/backups/msaquiz:/backups:ro mmsam-msaquiz -c 'for f in /config/msaquiz.db /config/msaquiz.db-wal /config/msaquiz.db-shm; do [ -f "$f" ] && cp "$f" "$f.before-restore"; done; cp /backups/<BACKUP_FILE> /config/msaquiz.db && rm -f /config/msaquiz.db-wal /config/msaquiz.db-shm'
cd ~/mmsam && ~/.local/bin/docker-compose start msaquiz
```

Check what you restored:

```sh
docker exec msaquiz node -e 'const d = new (require("/app/socket/node_modules/better-sqlite3"))("/app/config/msaquiz.db", { readonly: true, fileMustExist: true }); console.log(d.pragma("integrity_check", { simple: true }), d.prepare("select count(*) c from quizzes").get().c + " quizzes", d.prepare("select count(*) c from results").get().c + " results")'
```

The code does **not** need to be rolled back with the database: migrations run at every start, so the current code brings a restored file forward by itself. The reverse direction is the risky one — there are no down-migrations, so deploying an older commit runs old code against a newer schema. Today's migrations are purely additive and the old code tolerates them, but check `packages/socket/src/db/migrations/` before rolling back across one.

## Keeping a record

The script only writes to the terminal. To keep a trace of who deployed what and when:

```sh
~/bin/deploy-msaquiz.sh 2>&1 | tee -a ~/backups/msaquiz/deploy.log
```

## Troubleshooting

| Message                                                         | Meaning                                                                                                                                       |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `ne pas lancer ce script depuis le clone`                       | You ran the copy inside `~/projects/MSAQuiz`. Use `~/bin/deploy-msaquiz.sh` (see Installing it, above).                                       |
| `le clone contient des modifications locales`                   | Someone edited files in `~/projects/MSAQuiz`. Show them with `git -C ~/projects/MSAQuiz status --short`, then discard or commit them.         |
| `untracked working tree files would be overwritten by checkout` | A file placed there by hand now also exists in git. `git -C ~/projects/MSAQuiz clean -nd` lists it; remove it. The service was not restarted. |
| `un autre déploiement est déjà en cours`                        | The lock is held by another run. Wait for it rather than forcing.                                                                             |
| `ce commit est déjà en ligne, rien à faire`                     | Nothing to do. `FORCE=1 ~/bin/deploy-msaquiz.sh` rebuilds anyway.                                                                             |
| `le commit ... n'appartient pas à la branche`                   | The commit was never pushed, or lives on another branch. A deployable commit must be an ancestor of `release/imsa-demo`.                      |
| `sauvegarde impossible` / `sauvegarde refusée`                  | The backup failed, so nothing was deployed and the site is untouched. The message carries the real error. Never deploy around it.             |
| `seulement N Go libres`                                         | The server is shared. See the prune warning above before freeing anything.                                                                    |
| `MSAQuiz ne répond pas après 120s` (`HEALTH_TIMEOUT`)           | The new version does not start. The container log is printed and the previous version is back online.                                         |
| `MSAQuiz a cessé de répondre juste après le démarrage`          | The container answers once, then restarts in a loop. Same handling as above.                                                                  |
| `le conteneur tourne encore sur une autre image`                | Compose did not recreate the container. Check `~/mmsam` for an `image:` key pinned on the `msaquiz` service.                                  |
| `le conteneur ... a été créé depuis « ... », pas « ... »`       | The image name does not match what the script assumes. Re-run it with the `IMAGE=` value the message gives.                                   |
| `branding est actif et écrase l'identité`                       | A branding folder in the data volume is overriding the La Serre identity built into the image. See [Branding](branding.md).                   |
| `deploy/deploy-msaquiz.sh a changé dans le dépôt`               | Not an error: re-install the script (see Installing it, above).                                                                               |

## Limits worth knowing

- **A page already open keeps the version it loaded** until it is reloaded. Browsers ask for the page again at each visit (nginx sends `Cache-Control: no-cache`), but a tab opened before the deployment runs the previous code. Reload it (F5) before checking a change.
- **Environment variables** (defaults match this server): `SERVICE`, `CONTAINER`, `COMPOSE_DIR`, `DATA_DIR`, `REPO_DIR`, `BRANCH`, `IMAGE`, `BACKUP_DIR`, `KEEP_BACKUPS`, `HEALTH_TIMEOUT`, `BACKUP_TIMEOUT`, `MIN_FREE_GB`, `LOCK_FILE`, plus `FORCE=1`.
- `DATA_DIR` is only the **host** side of the volume. The container paths (`/app/config/msaquiz.db`, `/app/socket/node_modules`) are hardcoded in the script, so changing `CONFIG_PATH` on the service would break the backup.
- `MIN_FREE_GB` defaults to 5 GB, which is a floor, not the cost of a cold build. Measure one with `docker system df` before and after, then raise it above that.
- Do not switch the Docker daemon to the containerd image store without revisiting the script: it compares a container's image id with the tagged image's id, and those two stop matching under that store.

## Going further: deploying from GitHub

This script is what a CI deployment would call. That means letting GitHub Actions reach the server over SSH with a key restricted to this one script (`restrict,command="..."` in `authorized_keys`), its private key stored in a `production` environment of the repository. It needs the agreement of whoever runs the server, since it is shared with other projects. A self-hosted GitHub runner is not an option: the repository is public, and the runner would need Docker access on that shared machine.
