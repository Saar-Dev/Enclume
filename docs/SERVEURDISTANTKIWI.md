# SERVEUR DISTANT — Documentation déploiement Enclume
> Créé : 2026-06-01 — Session 68/69
> Mis à jour : 2026-06-01 — Session 69

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

Ces fichiers ont des valeurs spécifiques au serveur. **Ne pas écraser avec git pull.**

```bash
# Déjà appliqué — skip-worktree actif sur les 3 fichiers
# Vérifier : git ls-files -v | grep "^S"
```

| Fichier | Différence serveur |
|---|---|
| `docker-compose.yml` | Passwords forts + MinIO version 2022 |
| `server/src/lib/redis.js` | Approche REDIS_PASSWORD (pas buildRedisConfig) |
| `client/vite.config.js` | `port: 8193` + `host: true` (vs local `port: 5173`) |
| `client/src/lib/api.js` | `VITE_API_URL` pointe vers `http://89.92.219.211:8194` |
| `.env` | Non tracké git — spécifique au serveur |

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

## Procédure git pull (mise à jour du serveur)

```bash
cd /home/didier/Enclume
git pull
# Les 3 fichiers divergents sont protégés par skip-worktree — pas écrasés
sudo systemctl restart enclume-server enclume-client
# Si nouvelles migrations : lancer la commande migrations ci-dessus
```

## Dettes ouvertes

- [ ] Restreindre ports Docker à `127.0.0.1` (P-SRV-5)
- [ ] Page santé serveur — températures, statut services, uptime (sprint dédié)
- [ ] WireGuard VPN — option pour restreindre l'accès aux appareils connus
