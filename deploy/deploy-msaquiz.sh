#!/usr/bin/env bash
#
# Déploie MSAQuiz sur le serveur du Studio, en une commande.
#
#   deploy-msaquiz.sh              déploie le dernier commit de la branche de release
#   deploy-msaquiz.sh <sha>        déploie ce commit précis (version antérieure)
#   deploy-msaquiz.sh --rollback   revient à la version qui tournait avant le dernier déploiement
#   deploy-msaquiz.sh --backup     sauvegarde la base et s'arrête là
#   deploy-msaquiz.sh --status     affiche l'état courant et ne touche à rien
#   deploy-msaquiz.sh --help       affiche cette aide
#
# Enchaîne : garde-fous, sauvegarde vérifiée de la base, mise à jour du clone,
# construction de l'image, redémarrage du SEUL service msaquiz, vérification du
# front et du serveur de jeu. Un échec pendant la construction laisse le site en
# ligne ; un échec au redémarrage ou à la vérification remet l'image et le code
# précédents.
#
# Ne fait JAMAIS de `up` global ni de `--remove-orphans` : les ~18 autres
# services de l'équipe tournent dans le même projet compose (~/mmsam).
#
# À installer HORS du clone (~/bin/deploy-msaquiz.sh) : git réécrirait le
# fichier pendant son exécution. Voir docs/deployment.md.
#
# Variables d'environnement : SERVICE, CONTAINER, COMPOSE_DIR, DATA_DIR,
# REPO_DIR, BRANCH, IMAGE, BACKUP_DIR, KEEP_BACKUPS, HEALTH_TIMEOUT,
# BACKUP_TIMEOUT, MIN_FREE_GB, LOCK_FILE, et FORCE=1 pour reconstruire un
# commit déjà en ligne.

set -Eeuo pipefail

SERVICE="${SERVICE:-msaquiz}"      # nom du service compose
CONTAINER="${CONTAINER:-$SERVICE}" # nom du conteneur (container_name dans ~/mmsam)
COMPOSE_DIR="${COMPOSE_DIR:-$HOME/mmsam}"
DATA_DIR="${DATA_DIR:-$COMPOSE_DIR/msaquiz/config}"
REPO_DIR="${REPO_DIR:-$HOME/projects/MSAQuiz}"
BRANCH="${BRANCH:-release/imsa-demo}"
IMAGE="${IMAGE:-mmsam-msaquiz}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/msaquiz}"
KEEP_BACKUPS="${KEEP_BACKUPS:-15}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"
BACKUP_TIMEOUT="${BACKUP_TIMEOUT:-300}"
MIN_FREE_GB="${MIN_FREE_GB:-5}"
LOCK_FILE="${LOCK_FILE:-$HOME/.deploy-msaquiz.lock}"

log() { printf '\n== %s\n' "$*"; }
info() { printf '   %s\n' "$*"; }
die() {
  printf '\nARRÊT : %s\n' "$*" >&2
  exit 1
}

# docker-compose est installé dans ~/.local/bin sur ce serveur, et une session
# ssh non interactive ne lit pas ~/.profile.
[[ -d "$HOME/.local/bin" ]] && PATH="$HOME/.local/bin:$PATH"
command -v docker >/dev/null 2>&1 || die "docker n'est pas disponible pour cet utilisateur"
if command -v docker-compose >/dev/null 2>&1; then
  compose=(docker-compose)
elif docker compose version >/dev/null 2>&1; then
  compose=(docker compose)
else
  die "ni docker-compose ni docker compose n'est disponible"
fi
run_compose() { (cd "$COMPOSE_DIR" && "${compose[@]}" "$@"); }

# Appelé un jour par une clé ssh de CI : jamais d'invite bloquante.
export GIT_TERMINAL_PROMPT=0
export GIT_SSH_COMMAND="${GIT_SSH_COMMAND:-ssh -o BatchMode=yes}"

container_state() {
  local state=""
  state="$(docker inspect -f '{{.State.Status}}' "$CONTAINER" 2>/dev/null | tail -n1)" || true
  printf '%s\n' "${state:-absent}"
}

image_id() { docker image inspect -f '{{.Id}}' "$1" 2>/dev/null || true; }
short_id() { printf '%s' "${1#sha256:}" | cut -c1-12; }

# Connexions au serveur de jeu : indicatif seulement (un onglet ouvert sur
# l'accueil compte aussi), jamais bloquant.
live_connections() {
  docker exec "$CONTAINER" sh -c "netstat -tn 2>/dev/null | grep -c ':3001 .*ESTABLISHED'" 2>/dev/null || true
}

# Sauvegarde par l'API SQLite (cohérente même si une partie écrit au même
# moment), puis relecture du fichier produit : intégrité et nombre de lignes.
# Une sauvegarde qu'on n'a pas relue n'est pas une sauvegarde.
BACKUP_JS='
const dest = process.argv[1]
const Database = require("/app/socket/node_modules/better-sqlite3")
const src = new Database("/app/config/msaquiz.db", { readonly: true, fileMustExist: true })
src.backup(dest).then(() => {
  src.close()
  const copy = new Database(dest, { readonly: true, fileMustExist: true })
  if (copy.pragma("integrity_check", { simple: true }) !== "ok") throw new Error("integrite KO")
  const count = (table) => copy.prepare("select count(*) c from " + table).get().c
  console.log("BACKUP_OK quizzes=" + count("quizzes") + " results=" + count("results"))
}).catch((error) => {
  console.error(String(error))
  process.exit(1)
})
'

show_status() {
  local commit state live
  commit="$(git -C "$REPO_DIR" log --oneline -1 2>/dev/null || echo "clone introuvable")"
  state="$(container_state)"
  log "État courant"
  info "clone       $REPO_DIR"
  info "            $commit"
  info "conteneur   $CONTAINER : $state"
  if [[ "$state" != absent ]]; then
    info "            image $(short_id "$(docker inspect -f '{{.Image}}' "$CONTAINER" 2>/dev/null)"), démarré $(docker inspect -f '{{.State.StartedAt}}' "$CONTAINER" 2>/dev/null)"
    live="$(live_connections)"
    [[ "$live" =~ ^[0-9]+$ ]] && info "            $live connexion(s) au serveur de jeu"
  fi
  info "image       :latest   $(short_id "$(image_id "$IMAGE:latest")")"
  info "            :previous $(short_id "$(image_id "$IMAGE:previous")")"
  if [[ -d "$DATA_DIR/branding" ]]; then
    info "branding    ACTIF — il écrase l'identité intégrée à l'image"
  else
    info "branding    désactivé (identité La Serre intégrée à l'image)"
  fi
  info "disque      $(df -h --output=avail "$COMPOSE_DIR" | tail -1 | tr -d ' ') libres"
  if [[ -d "$BACKUP_DIR" ]]; then
    info "sauvegardes $({ ls -1 "$BACKUP_DIR"/msaquiz-*.db 2>/dev/null || true; } | wc -l) dans $BACKUP_DIR"
  else
    info "sauvegardes aucune ($BACKUP_DIR absent)"
  fi
}

backup_file=""
backup_database() {
  local name output cid
  mkdir -p "$BACKUP_DIR"
  rm -f -- "$BACKUP_DIR"/*.part
  name="msaquiz-$(date '+%Y%m%d-%H%M%S')-${previous_commit:0:7}.db"

  if [[ "$(container_state)" == running ]]; then
    cid="$(docker inspect -f '{{.Id}}' "$CONTAINER")"
    # timeout : l'API SQLite reprend sa copie à chaque écriture concurrente, une
    # partie très active pourrait la faire tourner longtemps.
    output="$(timeout "$BACKUP_TIMEOUT" docker exec "$cid" node -e "$BACKUP_JS" /tmp/msaquiz-backup.db 2>&1)" ||
      die "sauvegarde impossible depuis le conteneur en marche : $output"
    [[ "$output" == *BACKUP_OK* ]] || die "sauvegarde refusée : $output"
    docker cp "$cid:/tmp/msaquiz-backup.db" "$BACKUP_DIR/$name.part" >/dev/null
    docker exec "$cid" rm -f /tmp/msaquiz-backup.db || true
  elif [[ -f "$DATA_DIR/msaquiz.db" ]]; then
    # Conteneur arrêté ou en boucle de redémarrage : même sauvegarde, depuis un
    # conteneur jetable. Le montage de /app/config reste en lecture-écriture :
    # SQLite doit pouvoir créer msaquiz.db-shm pour LIRE une base en mode WAL,
    # même ouverte en lecture seule. Ne jamais y ajouter « :ro ».
    output="$(docker run --rm --entrypoint node \
      -v "$DATA_DIR:/app/config" -v "$BACKUP_DIR:/backup" \
      "$IMAGE:latest" -e "$BACKUP_JS" "/backup/$name.part" 2>&1)" || {
      rm -f -- "$BACKUP_DIR/$name.part"
      die "sauvegarde impossible : $output"
    }
    [[ "$output" == *BACKUP_OK* ]] || {
      rm -f -- "$BACKUP_DIR/$name.part"
      die "sauvegarde refusée : $output"
    }
  else
    info "aucune base à sauvegarder (première installation)"
    return 0
  fi

  mv -- "$BACKUP_DIR/$name.part" "$BACKUP_DIR/$name"
  backup_file="$BACKUP_DIR/$name"
  info "${output#*BACKUP_OK }"
  info "$backup_file ($(du -h "$backup_file" | cut -f1))"

  # Ne garder que les KEEP_BACKUPS plus récentes.
  { ls -1t "$BACKUP_DIR"/msaquiz-*.db 2>/dev/null | tail -n "+$((KEEP_BACKUPS + 1))" |
    while read -r old; do rm -f -- "$old"; done; } || true
}

# Le front ET le serveur de jeu doivent répondre : la poignée de main socket.io
# traverse nginx (3000) puis le proxy /ws vers node (3001).
is_healthy() {
  [[ "$(container_state)" == running ]] || return 1
  docker exec "$CONTAINER" wget -q -O /dev/null http://127.0.0.1:3000/ 2>/dev/null || return 1
  docker exec "$CONTAINER" wget -q -O - 'http://127.0.0.1:3000/ws/?EIO=4&transport=polling' 2>/dev/null |
    grep -q '"sid"'
}

wait_healthy() {
  local deadline=$((SECONDS + $1))
  until is_healthy; do
    ((SECONDS < deadline)) || return 1
    sleep 3
  done
}

stage="init"
on_exit() {
  local status=$?
  ((status == 0)) && return
  set +e
  printf "\nÉchec à l'étape « %s ».\n" "$stage" >&2

  case "$stage" in
    checkout | build)
      # Le conteneur n'a pas été touché : le site tourne encore sur l'image
      # précédente. Le recréer ne ferait que tuer les parties en cours.
      log "Retour du clone à ${previous_commit:0:7}"
      git -C "$REPO_DIR" reset --hard --quiet "$previous_commit"
      info "le service n'a pas été redémarré : MSAQuiz reste en ligne sur la version précédente"
      ;;
    restart | verify)
      [[ "$stage" == verify ]] && run_compose logs --no-color --tail 40 "$SERVICE"
      log "Retour à la version précédente (${previous_commit:0:7})"
      git -C "$REPO_DIR" reset --hard --quiet "$previous_commit"

      if [[ -z "$previous_image" ]] || ! docker tag "$IMAGE:previous" "$IMAGE:latest"; then
        info "ATTENTION : aucune image précédente utilisable ($IMAGE:previous absente ?)"
        info "le service tourne peut-être sur l'image qui vient d'échouer. Reprendre à la main :"
        info "  cd $COMPOSE_DIR && ${compose[*]} build $SERVICE && ${compose[*]} up -d --no-deps $SERVICE"
      else
        # --force-recreate supprime le conteneur avant d'en créer un autre : si
        # la création échoue il ne reste RIEN, on réessaie sans forcer.
        run_compose up -d --no-deps --force-recreate "$SERVICE" ||
          run_compose up -d --no-deps "$SERVICE" || true
        if wait_healthy 60; then
          info "la version précédente est de nouveau en ligne"
        else
          info "SERVICE HORS LIGNE. Relancer : cd $COMPOSE_DIR && ${compose[*]} up -d --no-deps $SERVICE"
          info "puis « $0 --status » ; journaux : ${compose[*]} logs --tail 100 $SERVICE"
        fi
      fi
      ;;
  esac
  [[ -n "$backup_file" ]] && info "sauvegarde prise avant ce déploiement : $backup_file"
  exit "$status"
}

# --- Arguments ---------------------------------------------------------------

requested=""
mode="deploy"
case "${1:-}" in
  --status | status)
    show_status
    exit 0
    ;;
  -h | --help)
    awk 'NR > 2 && /^#/ { sub(/^# ?/, ""); print; next } NR > 2 { exit }' "${BASH_SOURCE[0]}"
    exit 0
    ;;
  --backup)
    mode="backup"
    ;;
  --rollback)
    [[ -r "$BACKUP_DIR/image-previous.txt" ]] ||
      die "aucune version précédente enregistrée dans $BACKUP_DIR/image-previous.txt : indiquer le commit à la main"
    requested="$(cut -d' ' -f1 "$BACKUP_DIR/image-previous.txt")"
    [[ "$requested" =~ ^[0-9a-f]{40}$ ]] || die "$BACKUP_DIR/image-previous.txt est illisible"
    ;;
  "") ;;
  *)
    requested="${1//[[:space:]]/}"
    requested="${requested,,}"
    [[ "$requested" =~ ^[0-9a-f]{7,40}$ ]] ||
      die "argument invalide : attendu un SHA de commit (7 à 40 caractères hexadécimaux), --rollback, --backup, --status ou --help"
    ;;
esac

command -v flock >/dev/null 2>&1 || die "flock est introuvable (paquet util-linux) : impossible de garantir qu'un seul déploiement tourne"
exec 9>"$LOCK_FILE" || die "impossible d'ouvrir le verrou $LOCK_FILE"
flock -n 9 || die "un autre déploiement est déjà en cours (verrou $LOCK_FILE)"

[[ -d "$REPO_DIR/.git" ]] || die "clone introuvable : $REPO_DIR"
[[ -f "$COMPOSE_DIR/docker-compose.yml" || -f "$COMPOSE_DIR/compose.yml" ]] ||
  die "projet compose introuvable : $COMPOSE_DIR"

# bash lit ce fichier au fil de l'exécution : si c'est la copie du clone, le
# « git checkout » de l'étape 3 la réécrit sous ses pieds, et bash exécute
# ensuite des octets au hasard.
self_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
if [[ "$self_dir/" == "$(cd -- "$REPO_DIR" && pwd -P)/"* ]]; then
  die "ne pas lancer ce script depuis le clone ($REPO_DIR) : git le réécrirait pendant son exécution. L'installer dans ~/bin (docs/deployment.md)."
fi

cd "$REPO_DIR"
previous_commit="$(git rev-parse HEAD)"
previous_image="$(image_id "$IMAGE:latest")"

# --- Sauvegarde seule --------------------------------------------------------

if [[ "$mode" == backup ]]; then
  log "Sauvegarde de la base (aucun déploiement)"
  backup_database
  exit 0
fi

# --- Commit à déployer -------------------------------------------------------

[[ -z "$(git status --porcelain --untracked-files=no)" ]] ||
  die "le clone contient des modifications locales. Les voir : git -C $REPO_DIR status --short"

# $IMAGE est une déduction du nom de projet compose (<projet>-<service>). Si
# elle est fausse, le retour arrière serait un coup d'épée dans l'eau.
if [[ "$(container_state)" != absent ]]; then
  declared="$(docker inspect -f '{{.Config.Image}}' "$CONTAINER" 2>/dev/null || true)"
  [[ "${declared%:latest}" == "${IMAGE%:latest}" ]] ||
    die "le conteneur $CONTAINER a été créé depuis « $declared », pas « $IMAGE ». Relancer avec IMAGE=${declared%:latest} $0"
  [[ -n "$previous_image" ]] ||
    die "$IMAGE:latest est absente du démon : aucun retour arrière ne serait possible, refus de déployer"
fi

log "Commit à déployer"
git fetch --quiet origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"
if [[ -n "$requested" ]]; then
  target="$(git rev-parse "$requested^{commit}" 2>/dev/null)" || die "commit $requested introuvable"
  git merge-base --is-ancestor "$target" "origin/$BRANCH" ||
    die "le commit $requested n'appartient pas à la branche $BRANCH"
else
  target="$(git rev-parse "origin/$BRANCH")"
fi
info "en ligne : ${previous_commit:0:7}  →  à déployer : ${target:0:7}"
info "$(git log --format='%s' -1 "$target")"

if [[ "$target" == "$previous_commit" && -n "$previous_image" && -z "${FORCE:-}" ]]; then
  info "ce commit est déjà en ligne, rien à faire"
  info "pour reconstruire quand même : FORCE=1 $0"
  exit 0
fi
if git merge-base --is-ancestor "$target" "$previous_commit"; then
  info "retour à une version antérieure ($(git log --oneline "$target..$previous_commit" | wc -l) commit(s) retirés)"
else
  info "$(git log --oneline "$previous_commit..$target" | wc -l) commit(s) à déployer"
fi

trap on_exit EXIT

# --- 1. Garde-fous -----------------------------------------------------------

stage="checks"
# La construction écrit dans le répertoire de Docker, qui n'est pas forcément
# sur le même système de fichiers que ~/mmsam.
docker_root="$(docker info -f '{{.DockerRootDir}}' 2>/dev/null || true)"
[[ -d "$docker_root" ]] || docker_root="$COMPOSE_DIR"
for dir in "$COMPOSE_DIR" "$docker_root"; do
  free_gb="$(df --output=avail -BG "$dir" | tail -1 | tr -dc '0-9')"
  ((${free_gb:-0} >= MIN_FREE_GB)) ||
    die "seulement ${free_gb:-0} Go libres sur $dir (minimum ${MIN_FREE_GB}). Libérer avec « docker builder prune » après accord de l'équipe."
  info "${free_gb} Go libres sur $dir"
done

[[ -d "$DATA_DIR/branding" ]] &&
  info "ATTENTION : $DATA_DIR/branding est actif et écrase l'identité intégrée à l'image"

live="$(live_connections)"
if [[ "$live" =~ ^[0-9]+$ ]] && ((live > 0)); then
  info "$live connexion(s) ouverte(s) au serveur de jeu : une partie est peut-être en cours"
fi
info "le redémarrage perdra les parties en cours et invalidera les codes de partie"

# --- 2. Sauvegarde de la base ------------------------------------------------

stage="backup"
log "Sauvegarde de la base"
backup_database

# L'image en ligne est conservée sous :previous pour pouvoir y revenir. Celle
# d'avant perd son dernier tag : on retient son identifiant pour la supprimer
# après vérification, sinon chaque déploiement laisse une image orpheline.
obsolete_image="$(image_id "$IMAGE:previous")"
[[ "$obsolete_image" == "$previous_image" ]] && obsolete_image=""
if [[ -n "$previous_image" ]]; then
  docker tag "$IMAGE:latest" "$IMAGE:previous"
  printf '%s %s\n' "$previous_commit" "$previous_image" >"$BACKUP_DIR/image-previous.txt"
fi

# --- 3. Code -----------------------------------------------------------------

stage="checkout"
git checkout --quiet -B "$BRANCH" "$target"

# --- 4. Image ----------------------------------------------------------------

stage="build"
log "Construction de l'image (quelques minutes, le site reste en ligne)"
run_compose build "$SERVICE"
new_image="$(image_id "$IMAGE:latest")"
[[ -n "$new_image" ]] || die "aucune image $IMAGE:latest après la construction"
[[ "$new_image" != "$previous_image" ]] ||
  info "l'image est identique à la précédente : le code n'a produit aucun changement"

# --- 5. Redémarrage ----------------------------------------------------------

stage="restart"
log "Redémarrage du service $SERVICE uniquement"
run_compose up -d --no-deps "$SERVICE"

running_image="$(docker inspect -f '{{.Image}}' "$CONTAINER" 2>/dev/null || true)"
[[ "$running_image" == "$new_image" ]] ||
  die "le conteneur tourne encore sur une autre image ($running_image)"

# --- 6. Vérification ---------------------------------------------------------

stage="verify"
log "Vérification du front et du serveur de jeu"
wait_healthy "$HEALTH_TIMEOUT" || die "MSAQuiz ne répond pas après ${HEALTH_TIMEOUT}s"
# Un conteneur qui redémarre en boucle peut répondre une fois : on revérifie.
sleep 10
is_healthy || die "MSAQuiz a cessé de répondre juste après le démarrage"

stage="done"

# Déploiement vérifié : l'avant-dernière image ne sert plus. On ne touche ni au
# cache de construction ni aux images des autres services.
if [[ -n "$obsolete_image" && "$obsolete_image" != "$new_image" ]]; then
  docker image rm "$obsolete_image" >/dev/null 2>&1 &&
    info "ménage     image $(short_id "$obsolete_image") supprimée" || true
fi

log "MSAQuiz ${target:0:7} est en ligne (${SECONDS}s)"
info "image      $(short_id "$new_image")"
info "précédente $(short_id "$previous_image")  — retour arrière : $0 --rollback"
[[ -n "$backup_file" ]] && info "sauvegarde $backup_file"
info "à faire    recharger l'écran animateur (Ctrl+Shift+R) avant de relancer un quiz"

if [[ -f "$REPO_DIR/deploy/deploy-msaquiz.sh" ]] &&
  ! cmp -s "${BASH_SOURCE[0]}" "$REPO_DIR/deploy/deploy-msaquiz.sh"; then
  info "note       deploy/deploy-msaquiz.sh a changé dans le dépôt : réinstaller ce script (docs/deployment.md)"
fi
