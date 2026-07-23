# SERVEUR DISTANT — Documentation déploiement Enclume
> Créé : 2026-06-01 — Session 68/69
> Mis à jour : 2026-07-23

---

## Infos serveur

| | |
|---|---|
| IP publique | `89.92.219.211` |
| IP locale | `192.168.1.46` |
| OS | Debian 13 (trixie) |
| Node.js | v24.15.0 (`/usr/bin/node`) |
| SSH externe | port 8222 |
| Dossier app | `/home/didier/Enclume/` |
| Box | Bouygues — ports autorisés : plage 8000–16000 uniquement |

## Ports de l'application

| Service | Port | Notes |
|---|---|---|
| Express (API) | **8194** | `PORT=8194` dans `.env` |
| Vite (client) | **8193** | `server.port` dans `vite.config.js` |
| Accès navigateur | `http://89.92.219.211:8193` | Box forward 8193 et 8194 → 192.168.1.46 |

## Infrastructure Docker

```yaml
# docker-compose.yml — versions pinnées côté serveur
postgres:  image: postgres:16-alpine        # port 5432
redis:     image: redis:7-alpine            # port 6379, requirepass activé
minio:     image: minio/minio:RELEASE.2022-02-07T08-17-33Z  # port 9000/9001
```

**⚠ MinIO : NE PAS mettre à jour.** Le CPU du serveur ne supporte pas x86-64-v2 requis par glibc des images récentes (Rocky Linux 9+). Les images post-mai 2022 crashent avec :
```
Fatal glibc error: CPU does not support x86-64-v2
```

## Démarrage via systemd (plus de terminaux ouverts)

Les deux services sont gérés par systemd — ils démarrent au boot et redémarrent en cas de crash.

```bash
# Statut
sudo systemctl status enclume-server enclume-client

# Démarrer
sudo systemctl start enclume-server enclume-client

# Arrêter
sudo systemctl stop enclume-server enclume-client

# Redémarrer
sudo systemctl restart enclume-server enclume-client

# Logs temps réel
journalctl -u enclume-server -f
journalctl -u enclume-client -f
```

Fichiers service : `/etc/systemd/system/enclume-server.service` et `enclume-client.service`

```ini
# enclume-server.service
[Unit]
Description=Enclume API Server
After=network.target docker.service

[Service]
Type=simple
User=didier
WorkingDirectory=/home/didier/Enclume/server
ExecStart=/usr/bin/node --env-file=../.env --es-module-specifier-resolution=node src/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```ini
# enclume-client.service
[Unit]
Description=Enclume Vite Client
After=network.target enclume-server.service

[Service]
Type=simple
User=didier
WorkingDirectory=/home/didier/Enclume/client
ExecStart=/home/didier/Enclume/client/node_modules/.bin/vite --host --port 8193
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## Migrations (après chaque git pull avec nouvelles migrations)

```bash
cd /home/didier/Enclume/server && node --input-type=module --env-file=../.env -e "
import('./src/db/knex.js').then(async ({ default: db }) => {
  const result = await db.migrate.latest()
  console.log('Migrations OK :', result)
  await db.destroy()
  process.exit(0)
}).catch(e => { console.error(e.message); process.exit(1) })
"
```

## Créer le bucket MinIO (première install uniquement)

```bash
cd /home/didier/Enclume/server && node --input-type=module --env-file=../.env -e "
import('./src/lib/minio.js').then(async ({ default: getMinioClient, BUCKET }) => {
  const client = getMinioClient()
  const bucket = BUCKET()
  const exists = await client.bucketExists(bucket)
  if (exists) { console.log('Bucket existe:', bucket) }
  else { await client.makeBucket(bucket); console.log('Bucket créé:', bucket) }
  process.exit(0)
}).catch(e => { console.error(e.message); process.exit(1) })
"
```

## Pièges critiques découverts

### P-SRV-1 — ESM + dotenv : timing
Les `import` statiques ESM s'évaluent **avant** `dotenv.config()` dans `index.js`. Tout module qui lit `process.env` à l'initialisation (ex: `redis.js`) obtient `undefined`.

**Fix appliqué** : systemd utilise `--env-file=../.env` natif Node.js dans `ExecStart`. Charge `.env` avant toute évaluation de module.

### P-SRV-2 — Redis requirepass + REDIS_PASSWORD
Ne pas utiliser `REDIS_URL=redis://:password@host` avec ioredis v5 (parsing URL instable).
Utiliser une variable dédiée dans `.env` :
```
REDIS_PASSWORD=<hex_password>
```
Et dans `redis.js` :
```js
const redis = new Redis({ host: 'localhost', port: 6379, password: process.env.REDIS_PASSWORD || undefined })
```

### P-SRV-3 — PostgreSQL volume persistant
`docker compose down` **ne supprime pas** les volumes. Changer `POSTGRES_PASSWORD` dans `docker-compose.yml` n'a aucun effet si la base existe déjà.

**Fix** : changer le mot de passe depuis l'intérieur du container :
```bash
docker exec enclume-postgres-1 psql -U vtt -d vtt -c "ALTER USER vtt WITH PASSWORD 'nouveau_mdp';"
```

### P-SRV-4 — Vite non accessible de l'extérieur
Par défaut Vite n'écoute que sur `127.0.0.1`. Ajouter dans `vite.config.js` :
```js
server: { host: true, port: 8193 }
```

### P-SRV-5 — Docker bypass UFW
Docker modifie iptables directement, contournant UFW. Les ports Docker (`5432`, `6379`, `9000`, `9001`) sont potentiellement publics.

**Fix** : restreindre les ports Docker au localhost dans `docker-compose.yml` :
```yaml
ports:
  - "127.0.0.1:5432:5432"
  - "127.0.0.1:6379:6379"
  - "127.0.0.1:9000:9000"
  - "127.0.0.1:9001:9001"
```
⚠ **Non encore appliqué** — à faire.

### P-SRV-6 — api.js : baseURL hardcodée
`client/src/lib/api.js` avait `baseURL: 'http://localhost:3001/api'` — hardcodé, inutilisable depuis un navigateur distant.

**Fix appliqué** (local + serveur) :
```js
baseURL: `${import.meta.env.VITE_API_URL}/api`,
```
Compatible local (`VITE_API_URL=http://localhost:3001`) et Kiwi (`VITE_API_URL=http://89.92.219.211:8194`).

### P-SRV-7 — Déconnexions SSH par inactivité
Deux fixes appliqués :
- **Serveur** (`/etc/ssh/sshd_config`) : `ClientAliveInterval 120` + `ClientAliveCountMax 10` + `sudo systemctl restart ssh`
- **Client local** (`~/.ssh/config`) : `ServerAliveInterval 60` + `ServerAliveCountMax 5`

### P-SRV-8 — Claude Code : SIGILL sur ce serveur
Le CPU ne supporte pas x86-64-v2. Le binaire Claude Code crashe avec `SIGILL`. Même cause que MinIO récent. Pas de solution — Claude Code ne peut pas tourner sur ce serveur.

## Fichiers qui divergent entre local et serveur

**Un seul fichier** a une vraie raison de diverger. Tous les autres sont pilotés par `.env`.

```bash
# État actuel — skip-worktree actif sur UN seul fichier (session 82)
# Vérifier : git ls-files -v | grep "^S"
# Résultat attendu : S docker-compose.yml
```

| Fichier | Statut | Raison |
|---|---|---|
| `docker-compose.yml` | **skip-worktree** | Passwords forts + MinIO version 2022 pinné |
| `client/vite.config.js` | identique au repo | systemd passe `--host --port 8193` en CLI — pas de divergence fichier nécessaire |
| `server/src/lib/redis.js` | identique au repo | `REDIS_PASSWORD \|\| undefined` fonctionne local + serveur |
| `client/src/lib/api.js` | identique au repo | `VITE_API_URL` dans `.env` suffit |
| `client/package.json` | identique au repo | doit toujours rester identique — ne jamais mettre en skip-worktree |
| `client/package-lock.json` | identique au repo | idem |
| `.env` | non tracké git | spécifique au serveur — source de vérité pour toute la config |

**Règle : si une valeur peut aller dans `.env`, elle va dans `.env`. skip-worktree = dernier recours.**

**⚠ Piège session 82 — `client/package.json` en skip-worktree**
La version serveur avait `quill`/`motion` mais pas `socket.io-client` → crash après `rm -rf node_modules`. Fix appliqué : `socket.io-client@^4.8.3` ajouté au repo (commit e4f80ef), skip-worktree retiré.

## Seeds (première install uniquement)

`ref_equipment` doit être peuplé via le seed après les migrations :

```bash
cd /home/didier/Enclume/server/src/db/seeds

# Dry run d'abord — attendu : ~715 "À insérer", 2 rejections non bloquantes
node 2_seed_equipment.js

# Si rapport cohérent → insert réel
node 2_seed_equipment.js --insert
```

Le script charge lui-même le `.env` via dotenv — pas besoin de `--env-file`.

**✅ Appliqué session 70 (2026-06-01) :** 715 items insérés, 2 rejections non bloquantes (`Oxyma` + `Poing Kryss` — `init_mod` invalide dans la source). `client/src/lib/api.js` ajouté au skip-worktree.

## Procédure git pull (mise à jour du serveur)

```bash
cd /home/didier/Enclume
git pull
# docker-compose.yml est protégé par skip-worktree — pas écrasé
# Si nouvelles dépendances npm : cd client && npm install && cd ..
sudo systemctl restart enclume-server enclume-client
# Si nouvelles migrations : lancer la commande migrations ci-dessus
```

## Autres dépôts sur ce même serveur

Ce serveur physique héberge **trois instances** de l'application, pas seulement
`/home/didier/Enclume`. Topologie et cycle de fusion complets : `docs/WORKFLOW_FUSION.md`.

| Dépôt | Branche | Propriétaire système | Ports |
|---|---|---|---|
| `/home/didier/Enclume` | `dev/Saar` | `didier` | 8193/8194 |
| `/home/codex/Enclume-integrated` | `dev/monde` | `codex` | 8293/8294 |
| `/home/codex/Enclume-fusion` | `integration` | `codex` | 8393/8394 |

### Accès aux dépôts `codex` depuis le compte `didier`

Git refuse d'opérer sur un dépôt appartenant à un autre utilisateur système
(`fatal: dubious ownership`). Débloquer avant toute inspection :

```bash
git config --global --add safe.directory /home/codex/Enclume-integrated
git config --global --add safe.directory /home/codex/Enclume-fusion
```

### Kiwi refuse GitHub — `dev/monde` et `integration` n'existent que sur ce serveur

Confirmé (session 2026-07-23) : Kiwi refuse d'utiliser GitHub, ce n'est pas une simple
authentification manquante à corriger. `dev/monde` et `integration` n'ont donc **jamais** été
poussées sur `origin`, même une version ancienne (`git branch -r` ne montre aucune trace).

Conséquence : toute synchronisation impliquant ces deux branches passe **exclusivement** par des
commandes lancées à la main sur ce serveur, jamais par un `git push`/`fetch` vers `origin` pour
elles. Pour rapatrier du contenu vers un dépôt qui, lui, est publié sur GitHub (`dev/Saar`), la
méthode qui fonctionne est de pousser une branche temporaire depuis le dépôt source :

```bash
cd /home/didier/Enclume
git push origin dev/Saar:refs/heads/tmp/<nom-descriptif>-<date>
```

### Claude Code ne peut pas se connecter en SSH à ce serveur depuis une session distante

Testé le 2026-07-23 (clé publique et mot de passe via `plink`) : la connexion SSH initiée
directement par l'agent reste bloquée sans réponse — probablement un blocage réseau sortant de
l'environnement d'exécution de l'agent, pas un problème côté serveur. **Toute commande serveur doit
être copiée-collée et exécutée par l'utilisateur dans son propre terminal SSH**, jamais lancée
directement par l'agent.

## Dettes ouvertes

- [ ] Restreindre ports Docker à `127.0.0.1` (P-SRV-5)
- [ ] Page santé serveur — températures, statut services, uptime (sprint dédié)
- [ ] WireGuard VPN — option pour restreindre l'accès aux appareils connus
