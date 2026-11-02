# Load test

How many players a running server takes before it lags. The load test plays real games against it, over the same protocol as the web client: a bot host creates a game, bot players join it and answer every question, and a probe socket times the server's answers all along. It runs step after step (25 players, then 50, then 100…) and stops at the first step that lags.

The host never shows the final leaderboard: each game is left before its end, so **no result is saved** and the statistics stay clean.

## Running it

The bot host signs in with a manager account: its identifier in `MANAGER_LOGIN` (`admin` by default) and its password in `MANAGER_PASSWORD`. The password must not be a temporary one: sign in once in the interface to change it first. Typing it with `read -rs` keeps it out of the shell history:

```sh
read -rs MANAGER_PASSWORD && export MANAGER_PASSWORD
```

**In the container**, the server's own capacity, with no network in between. The image ships the test as a single file next to the server:

```sh
docker compose exec -e MANAGER_PASSWORD msaquiz node /app/socket/load-test.cjs --url http://localhost:3000 --players 25,50,100,150
```

(`msaquiz` is the Compose service name; check yours with `docker compose ps`. Add `-e MANAGER_LOGIN=…` for another account than `admin`.)

**From another machine**, what a participant goes through: network, reverse proxy, HTTPS. Copy the file out of the container (`docker ps` gives its name), then run it with Node 18 or later, nothing else to install:

```sh
docker cp <container>:/app/socket/load-test.cjs .
node load-test.cjs --url https://quiz.example.com --players 25,50,100,150
```

On Windows PowerShell, set the account with `$env:MANAGER_LOGIN='…'` and `$env:MANAGER_PASSWORD='…'` first.

**From the repo**, against a local server (`pnpm dev:socket`, or the built one with `pnpm --filter socket start`):

```sh
pnpm load-test --players 25,50,100,200
```

`--help` lists every option: the quiz played (`--quiz`, the first one by default), the number of questions per step, how many players connect per second, how long a player takes to answer, and a JSON report (`--out`).

## Before running it on a live server

- **No real game during the test.** A step that lags makes every game on the server lag.
- **A shared host feels it too.** While a step runs, the server process takes up to a whole CPU core. Keep the steps to what you need, a bit above the largest game you expect.
- The bots don't load the web page or its images, and they don't go through the participants' Wi-Fi: a room's access point is often the real limit, well before the server.

## Reading the results

For each step:

| Line                              | What it measures                                                     |
| --------------------------------- | -------------------------------------------------------------------- |
| `réseau seul`                     | The probe's round trip before any player joins: the network's share. |
| `latence serveur`                 | The probe's round trip during the game.                              |
| `réponse → accusé`                | From a player sending an answer to the server acknowledging it.      |
| `écart de diffusion`              | Between the first and the last player getting the same screen.       |
| `statuts manqués`, `déconnexions` | Screens a player never got, players dropped.                         |

A step is **OK** when the server latency and the answer delay stay within 100 ms and 250 ms (95th percentile) above the network's own round trip, the spread within 300 ms, and no player misses a screen or drops. It is **DÉGRADÉ** within 300 ms, 1 s and 1 s, and **KO** beyond, or when a player is lost.

If the report warns that the generator itself lags, its figures are skewed: the machine running the bots is saturated, not the server.

## Known limit

Every answer is broadcast to the whole room (the count of players who answered, and the player count), so the messages a question sends grow with the square of the players. On a developer machine, with every player answering within 3 seconds, the server stays fluid up to 200 players and lags from 400 on.
