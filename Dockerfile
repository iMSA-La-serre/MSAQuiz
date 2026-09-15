# ---- BASE ----
# Node 24 LTS: prebuilds natifs (better-sqlite3) garantis, et même ABI
# entre le builder et le runner (le module natif est copié de l'un à l'autre).
FROM node:24-alpine AS base

# Réseau d'entreprise dont le proxy intercepte le TLS : le certificat racine du
# proxy (format PEM, .crt ou .pem) déposé dans docker/certs/ est ajouté au
# magasin système, pour qu'apk, npm et pnpm lui fassent confiance. Sans
# certificat dans ce dossier, cette étape ne change rien.
RUN --mount=type=bind,source=docker/certs,target=/tmp/certs \
    for cert in /tmp/certs/*.crt /tmp/certs/*.pem; do \
      if [ -f "$cert" ]; then \
        grep -q "BEGIN CERTIFICATE" "$cert" \
          || { echo "$cert n'est pas au format PEM (Base-64)" >&2; exit 1; }; \
        { echo; cat "$cert"; } >> /etc/ssl/certs/ca-certificates.crt; \
      fi; \
    done
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

RUN npm install -g pnpm

# ---- BUILDER ----
FROM base AS builder
WORKDIR /app

# Outils de compilation, au cas où un prebuild natif ne serait pas disponible.
RUN apk add --no-cache python3 make g++

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/common/package.json ./packages/common/
COPY packages/web/package.json ./packages/web/
COPY packages/socket/package.json ./packages/socket/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

# better-sqlite3 est `external` du bundle esbuild (module natif) : on le
# copie dans le runner AVEC ses dépendances runtime (bindings,
# file-uri-to-path), résolues en chaîne depuis le vrai chemin .pnpm.
RUN node -e "const fs=require('fs'),p=require('path'); \
    const out='/app/socket-deps'; fs.mkdirSync(out,{recursive:true}); \
    const req=(name,from)=>p.dirname(require.resolve(name+'/package.json',{paths:[from]})); \
    const bs3=req('better-sqlite3','/app/packages/socket'); \
    const bindings=req('bindings',bs3); \
    const futp=req('file-uri-to-path',bindings); \
    for (const [n,src] of [['better-sqlite3',bs3],['bindings',bindings],['file-uri-to-path',futp]]) \
      fs.cpSync(src,p.join(out,n),{recursive:true,dereference:true});"

# ---- RUNNER ----
FROM base AS runner

RUN apk add --no-cache nginx supervisor

COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisord.conf

# Licence MIT de Razzia : elle doit accompagner chaque copie du logiciel. Son
# texte est aussi affiché dans l'application (page /licences, avec les
# licences des bibliothèques tierces générées au build dans licenses.json).
COPY --from=builder /app/LICENSE /app/LICENSE
COPY --from=builder /app/packages/web/dist /app/web
COPY --from=builder /app/packages/socket/dist/index.cjs /app/socket/index.cjs
COPY --from=builder /app/packages/socket/src/db/migrations /app/socket/migrations
COPY --from=builder /app/socket-deps /app/socket/node_modules

EXPOSE 3000

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
