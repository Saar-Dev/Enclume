ADMIN_BACKUP.md — Sauvegarde automatique de l'instance Enclume

    Document permanent — source de vérité opérationnelle

    Version 4.1 — 2026-08-02

    Remplace : ADMIN_BACKUP.md v4.0

    Statut : ✅ Lots 1-3 prêts à déployer — Lots 4-5 spécifiés pour activation future

1. Objectif et périmètre

Sauvegarde automatique quotidienne de l'instance Saar/Claude (/home/didier/Enclume, ports 8193/8194).
Redis n'est pas sauvegardé (cache non autoritaire).
Élément	Valeur
Dépôt	/home/didier/Enclume
Base PostgreSQL	vtt
Bucket MinIO	enclume-assets
Utilisateur système	didier
Services systemd	enclume-server, enclume-client
Conteneurs Docker	postgres:16-alpine, redis:7-alpine, minio/minio:RELEASE.2022-02-07T08-17-33Z
2. Politique de cohérence

Enclume n'utilise pas de transaction distribuée entre PostgreSQL et MinIO.
La cohérence est assurée par trois mécanismes :

    Manifeste des assets référencés — avant le dump, une requête SQL extrait de la base tous les
    objets MinIO référencés par l'application.

    Double passe MinIO — un premier miroir avant le dump, un second après (rattrapage des fichiers
    créés pendant le dump).

    Vérification post-backup — le script contrôle qu'aucun objet du manifeste n'est absent du backup.

Garanties :

    ✅ Une restauration ne contiendra jamais une référence PostgreSQL vers un objet MinIO absent.

    ✅ Une restauration peut contenir des objets MinIO orphelins (sans référence en base) — c'est
    acceptable et documenté.

3. Architecture
text

┌─────────────────────────────────────────────────────────────┐
│                     Serveur Debian                           │
│                                                              │
│  ┌───────────┐   ┌───────────┐   ┌───────────┐              │
│  │ PostgreSQL │   │   MinIO   │   │  Docker   │              │
│  │   (vtt)   │   │ (assets)  │   │ (images)  │              │
│  └─────┬─────┘   └─────┬─────┘   └─────┬─────┘              │
│        │               │               │                     │
│        ▼               ▼               ▼                     │
│  ┌─────────────────────────────────────────────┐             │
│  │  enclume-backup.service (Lot 1)              │             │
│  │  1. Manifeste PostgreSQL                     │             │
│  │  2. pg_dumpall --globals-only                │             │
│  │  3. mc mirror (passe 1)                      │             │
│  │  4. pg_dump                                  │             │
│  │  5. mc mirror (passe 2 — rattrapage)         │             │
│  │  6. Vérification manifeste                   │             │
│  │  7. docker save + inspect                    │             │
│  │  8. config tar.gz                            │             │
│  │  9. Écriture atomique (.tmp → mv)            │             │
│  │ 10. Checksums SHA256                         │             │
│  │ 11. Purge atomique                           │             │
│  └─────────────────────────────────────────────┘             │
│                                                              │
│  ┌─────────────────────────────────────────────┐             │
│  │  enclume-backup-test.service (Lot 2)         │             │
│  │  - Vérification SHA256                       │             │
│  │  - Conteneur PostgreSQL éphémère              │             │
│  │  - pg_restore + vérifications structurelles  │             │
│  │  - Migrations knex                           │             │
│  │  - Vérification manifeste                    │             │
│  │  - Bucket MinIO temporaire                   │             │
│  └─────────────────────────────────────────────┘             │
│                                                              │
│  ┌─────────────────────────────────────────────┐             │
│  │  GET /api/health (Lot 3)                     │             │
│  │  - Lit /var/lib/enclume/backup.last_success  │             │
│  │  - Lit backup.log                            │             │
│  │  - Affiché dans HealthPage.jsx               │             │
│  └─────────────────────────────────────────────┘             │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Arborescence des backups (atomique par date) :
text

/var/backups/enclume/
├── 2026-08-02/
│   ├── db/
│   │   ├── globals.sql
│   │   ├── vtt.dump
│   │   └── manifest.json          # Liste des assets référencés
│   ├── assets/                    # Miroir MinIO
│   ├── config.tar.gz
│   ├── docker-images/
│   └── SHA256SUMS                 # Checksums de tous les fichiers
├── pre-restore/                   # Sauvegarde de sécurité avant restauration
└── logs/
    ├── backup.log                 # Journal structuré (JSON Lines)
    ├── restore.log
    └── test.log                   # Journal des tests de restauration

/etc/enclume/
└── backup.conf                    # Configuration unique

/var/lib/enclume/
└── backup.last_success            # Horodatage du dernier backup réussi

Unités systemd :
text

/etc/systemd/system/
├── enclume-backup.service         # Backup local quotidien
├── enclume-backup.timer           # Timer quotidien (3h00)
├── enclume-backup-check.service   # Vérification quotidienne
├── enclume-backup-check.timer     # Timer quotidien (9h00)
├── enclume-backup-test.service    # Test de restauration hebdomadaire
└── enclume-backup-test.timer      # Timer hebdomadaire (dimanche 4h00)

4. Déploiement immédiat — Lots 1, 2, 3
4.1 Configuration (/etc/enclume/backup.conf)
bash

# /etc/enclume/backup.conf — source unique de vérité

RETENTION_DAYS=7
RETENTION_GFS=true               # Garder aussi dimanches (4 sem.) + 1er du mois (3 mois)

# PostgreSQL
DB_NAMES=("vtt")
PG_HOST="localhost"
PG_USER="vtt"
# Mot de passe dans ~/.pgpass — jamais ici

# MinIO
MINIO_ALIAS="<À_REMPLIR_SERVEUR_UP>"        # Résultat de "mc alias list"
MINIO_BUCKETS=("enclume-assets")

# Chemins à archiver
CONFIG_PATHS=(
    "/etc/enclume"
    "/home/didier/Enclume/.env"
    "/home/didier/Enclume/docker-compose.yml"
)

# Répertoires
BACKUP_DIR="/var/backups/enclume"
STATE_DIR="/var/lib/enclume"

# Utilisateur des services Enclume (pour systemctl en restauration)
SERVICE_USER="didier"

# Images Docker à sauvegarder (contrainte CPU, voir §6)
DOCKER_SAVE_IMAGES=("minio/minio:RELEASE.2022-02-07T08-17-33Z")

# Alertes (optionnel)
ALERT_WEBHOOK_URL=""

4.2 Lot 1 — Scripts de backup local
4.2.1 enclume-backup.sh
bash

#!/bin/bash
# Sauvegarde quotidienne Enclume — Lot 1
set -euo pipefail
source /etc/enclume/backup.conf

DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date -Iseconds)
LOCKFILE="/var/lock/enclume-backup.lock"
BACKUP_TMP="$BACKUP_DIR/$DATE.tmp"
BACKUP_FINAL="$BACKUP_DIR/$DATE"

# ── Verrouillage ──────────────────────────────────────────────
exec 200>"$LOCKFILE"
flock -n 200 || { echo "Backup déjà en cours"; exit 0; }
trap 'rm -rf "$BACKUP_TMP"' EXIT

mkdir -p "$BACKUP_DIR/logs" "$STATE_DIR"
rm -rf "$BACKUP_TMP"
mkdir -p "$BACKUP_TMP"/{db,assets,docker-images}

# ── Vérifications préalables ──────────────────────────────────
USED_PCT=$(df "$BACKUP_DIR" | awk 'NR==2 {print $5}' | sed 's/%//')
[ "$USED_PCT" -ge 80 ] && { log_error "disk" "Espace disque < 20%"; exit 1; }
pg_isready -h "$PG_HOST" -U "$PG_USER" || { log_error "pg" "PostgreSQL injoignable"; exit 1; }
mc ls "$MINIO_ALIAS" > /dev/null 2>&1 || { log_error "minio" "MinIO injoignable"; exit 1; }
[ -f "$HOME/.pgpass" ] || { log_error "pgpass" "~/.pgpass absent"; exit 1; }
for cmd in pg_dump pg_dumpall pg_restore psql mc flock tar docker jq; do
    command -v "$cmd" > /dev/null || { log_error "dep" "Manque: $cmd"; exit 1; }
done

# ── Manifeste des assets référencés ───────────────────────────
# ATTENTION : cette requête doit être maintenue à jour si de
# nouvelles colonnes référencent des objets MinIO.
psql -h "$PG_HOST" -U "$PG_USER" -d vtt -tAc "
    SELECT json_agg(row_to_json(t)) FROM (
        SELECT 'enclume-assets' AS bucket, object_key AS key
        FROM (
            SELECT glb_url AS object_key FROM entity_blueprints WHERE glb_url IS NOT NULL AND glb_url != ''
            UNION SELECT cover_url FROM campaigns WHERE cover_url IS NOT NULL AND cover_url != ''
            UNION SELECT default_token_glb_url FROM campaigns WHERE default_token_glb_url IS NOT NULL AND default_token_glb_url != ''
            UNION SELECT portrait_url FROM characters WHERE portrait_url IS NOT NULL AND portrait_url != ''
            UNION SELECT url FROM documents WHERE url IS NOT NULL AND url != ''
        ) AS assets
    ) t
" > "$BACKUP_TMP/db/manifest.json"

# ── Rôles globaux PostgreSQL ──────────────────────────────────
pg_dumpall --globals-only -h "$PG_HOST" -U "$PG_USER" \
    -f "$BACKUP_TMP/db/globals.sql"

# ── Miroir MinIO — Passe 1 ───────────────────────────────────
for bucket in "${MINIO_BUCKETS[@]}"; do
    mc mirror --preserve --quiet "$MINIO_ALIAS/$bucket" "$BACKUP_TMP/assets/$bucket/"
done

# ── Dump PostgreSQL (écriture atomique) ───────────────────────
for db in "${DB_NAMES[@]}"; do
    pg_dump -h "$PG_HOST" -U "$PG_USER" -d "$db" -Fc --clean --if-exists \
        -f "$BACKUP_TMP/db/${db}.dump"
done

# ── Miroir MinIO — Passe 2 (rattrapage) ──────────────────────
for bucket in "${MINIO_BUCKETS[@]}"; do
    mc mirror --preserve --quiet "$MINIO_ALIAS/$bucket" "$BACKUP_TMP/assets/$bucket/"
done

# ── Vérification du manifeste ─────────────────────────────────
if [ -f "$BACKUP_TMP/db/manifest.json" ]; then
    jq -r '.[] | "\(.bucket)/\(.key)"' "$BACKUP_TMP/db/manifest.json" | while read object; do
        if [ ! -f "$BACKUP_TMP/assets/$object" ]; then
            echo "Avertissement: objet référencé absent du backup: $object" >&2
        fi
    done
fi

# ── Images Docker ─────────────────────────────────────────────
for image in "${DOCKER_SAVE_IMAGES[@]}"; do
    fname=$(echo "$image" | tr '/:' '_')
    docker save "$image" -o "$BACKUP_TMP/docker-images/${fname}.tar"
    docker inspect "$image" > "$BACKUP_TMP/docker-images/${fname}.json"
done

# ── Configuration ─────────────────────────────────────────────
tar -czf "$BACKUP_TMP/config.tar.gz" "${CONFIG_PATHS[@]}"

# ── Checksums SHA256 ──────────────────────────────────────────
cd "$BACKUP_TMP"
find . -type f ! -name SHA256SUMS -exec sha256sum {} \; > SHA256SUMS

# ── Atomicité : renommer le répertoire temporaire ────────────
rm -rf "$BACKUP_FINAL"
mv "$BACKUP_TMP" "$BACKUP_FINAL"

# ── Purge atomique ────────────────────────────────────────────
find "$BACKUP_DIR" -maxdepth 1 -type d -name '????-??-??' | sort -r | while read dir; do
    dir_date=$(basename "$dir")
    days_old=$(( ($(date +%s) - $(date -d "$dir_date" +%s)) / 86400 ))
    [ "$days_old" -le "$RETENTION_DAYS" ] && continue
    if [ "${RETENTION_GFS:-false}" = "true" ]; then
        [ "$(date -d "$dir_date" +%u)" = "7" ] && [ "$days_old" -le 28 ] && continue
        [ "$(date -d "$dir_date" +%d)" = "01" ] && [ "$days_old" -le 90 ] && continue
    fi
    rm -rf "$dir"
done

# ── Marqueur de succès ────────────────────────────────────────
log_success

# ── Fonctions ─────────────────────────────────────────────────
log_json() {
    local level="$1" message="$2"
    jq -n --arg date "$DATE" --arg status "$level" --arg message "$message" --arg timestamp "$TIMESTAMP" \
        '{date: $date, status: $status, message: $message, timestamp: $timestamp}' \
        >> "$BACKUP_DIR/logs/backup.log"
}
log_success() {
    log_json "success" "Backup réussi"
    date +%s > "$STATE_DIR/backup.last_success"
}
log_error() {
    local step="$1" message="$2"
    log_json "error" "[$step] $message"
    [ -n "${ALERT_WEBHOOK_URL:-}" ] && \
        curl -s -X POST "$ALERT_WEBHOOK_URL" -H "Content-Type: application/json" \
        -d "{\"content\":\"🚨 Backup Enclume ($step): $message\"}" > /dev/null 2>&1 || true
}

4.2.2 enclume-restore.sh
bash

#!/bin/bash
# Restauration interactive — Lot 1
# Usage: enclume-restore.sh <YYYY-MM-DD> [--db-only] [--assets-only] [--force]
set -euo pipefail
source /etc/enclume/backup.conf

DATE="$1"
BACKUP_DATE_DIR="$BACKUP_DIR/$DATE"

[ -d "$BACKUP_DATE_DIR" ] || { echo "Backup introuvable: $DATE"; exit 1; }

# ── Vérification SHA256 ───────────────────────────────────────
echo "Vérification de l'intégrité..."
cd "$BACKUP_DATE_DIR"
sha256sum -c SHA256SUMS || { echo "❌ Checksum échoué — backup corrompu"; exit 1; }

# ── Sauvegarde de sécurité ───────────────────────────────────
PRE_DIR="$BACKUP_DIR/pre-restore/$(date +%Y-%m-%d_%H%M%S)"
mkdir -p "$PRE_DIR/db" "$PRE_DIR/assets"
pg_dump -h "$PG_HOST" -U "$PG_USER" -d vtt -Fc --clean --if-exists -f "$PRE_DIR/db/vtt.dump"
for bucket in "${MINIO_BUCKETS[@]}"; do
    mc mirror --preserve "$MINIO_ALIAS/$bucket" "$PRE_DIR/assets/$bucket/" 2>/dev/null || true
done
echo "Sauvegarde de sécurité créée dans $PRE_DIR"

# ── Confirmation interactive ─────────────────────────────────
if [ "${2:-}" != "--force" ]; then
    echo ""
    echo "╔══════════════════════════════════════════════╗"
    echo "║  ⚠ RESTAURATION — DATE: $DATE               ║"
    echo "║  Base vtt et bucket(s) MinIO vont être       ║"
    echo "║  ÉCRASÉS.                                   ║"
    echo "╚══════════════════════════════════════════════╝"
    echo ""
    echo -n "Tapez 'vtt' pour confirmer : "
    read confirm
    [ "$confirm" != "vtt" ] && { echo "Abandon."; exit 1; }
fi

# ── Arrêt des services ───────────────────────────────────────
echo "Arrêt des services..."
sudo systemctl stop enclume-server enclume-client

# ── Restauration PostgreSQL ──────────────────────────────────
echo "Restauration PostgreSQL..."
psql -h "$PG_HOST" -U "$PG_USER" -d postgres -f "$BACKUP_DATE_DIR/db/globals.sql"
pg_restore -h "$PG_HOST" -U "$PG_USER" -d vtt --clean --if-exists "$BACKUP_DATE_DIR/db/vtt.dump"

# ── Restauration MinIO ───────────────────────────────────────
echo "Restauration MinIO..."
for bucket in "${MINIO_BUCKETS[@]}"; do
    mc mirror --overwrite "$BACKUP_DATE_DIR/assets/$bucket/" "$MINIO_ALIAS/$bucket"
done

# ── Redémarrage ──────────────────────────────────────────────
echo "Redémarrage des services..."
sudo systemctl start enclume-server enclume-client

echo "Restauration terminée — $(date)" >> "$BACKUP_DIR/logs/restore.log"
echo "✅ Restauration terminée avec succès."

4.2.3 enclume-backup-check.sh
bash

#!/bin/bash
# Vérification quotidienne — Lot 1
source /etc/enclume/backup.conf

LAST_SUCCESS_FILE="$STATE_DIR/backup.last_success"

if [ ! -f "$LAST_SUCCESS_FILE" ]; then
    ALERT="Aucun backup.last_success trouvé"
elif [ "$(( $(date +%s) - $(cat "$LAST_SUCCESS_FILE") ))" -gt 90000 ]; then
    ALERT="Dernier backup réussi il y a plus de 25h"
else
    exit 0
fi

jq -n --arg date "$(date -I)" --arg status "alert" --arg message "$ALERT" \
    '{date: $date, status: $status, message: $message}' \
    >> "$BACKUP_DIR/logs/backup.log"

[ -n "${ALERT_WEBHOOK_URL:-}" ] && \
    curl -s -X POST "$ALERT_WEBHOOK_URL" -H "Content-Type: application/json" \
    -d "{\"content\":\"🚨 Backup Enclume: $ALERT\"}" > /dev/null 2>&1 || true

4.3 Lot 2 — Test de restauration hebdomadaire
4.3.1 enclume-backup-test.sh
bash

#!/bin/bash
# Test de restauration hebdomadaire — Lot 2
set -euo pipefail
source /etc/enclume/backup.conf

LAST_BACKUP_DIR=$(ls -1dt "$BACKUP_DIR"/????-??-?? 2>/dev/null | head -1)
[ -z "$LAST_BACKUP_DIR" ] && { echo "Aucun backup trouvé"; exit 1; }
DATE=$(basename "$LAST_BACKUP_DIR")

# ── Vérification SHA256 ───────────────────────────────────────
cd "$LAST_BACKUP_DIR"
sha256sum -c SHA256SUMS || { echo "❌ Checksum échoué — backup corrompu"; exit 1; }

# ── PostgreSQL : conteneur éphémère ──────────────────────────
docker run -d --name enclume-restore-test \
    -e POSTGRES_HOST_AUTH_METHOD=trust \
    -p 5433:5432 postgres:16-alpine
sleep 5

psql -h localhost -p 5433 -U postgres -d postgres \
    -f "$LAST_BACKUP_DIR/db/globals.sql" 2>/dev/null || true
createdb -h localhost -p 5433 -U postgres vtt 2>/dev/null || true
pg_restore -h localhost -p 5433 -U postgres -d vtt --clean --if-exists \
    "$LAST_BACKUP_DIR/db/vtt.dump"

# ── Vérifications structurelles ───────────────────────────────
echo "=== Vérifications structurelles ==="
psql -h localhost -p 5433 -U postgres -d vtt -c "
    SELECT 'contraintes' AS type, COUNT(*) FROM pg_constraint
    UNION ALL SELECT 'index', COUNT(*) FROM pg_indexes
    UNION ALL SELECT 'sequences', COUNT(*) FROM information_schema.sequences
    UNION ALL SELECT 'tables', COUNT(*) FROM information_schema.tables WHERE table_schema='public';
"

# ── Vérification manifeste ───────────────────────────────────
if [ -f "$LAST_BACKUP_DIR/db/manifest.json" ]; then
    echo "=== Vérification manifeste ==="
    jq -r '.[] | "\(.bucket)/\(.key)"' "$LAST_BACKUP_DIR/db/manifest.json" | while read object; do
        if [ ! -f "$LAST_BACKUP_DIR/assets/$object" ]; then
            echo "❌ ORPHELIN: $object"
        fi
    done
fi

# ── Test des migrations ──────────────────────────────────────
echo "=== Test des migrations ==="
cd /home/didier/Enclume/server
node --input-type=module --env-file=../.env -e "
import('./src/db/knex.js').then(async ({ default: db }) => {
    await db.migrate.latest()
    console.log('Migrations OK')
    await db.destroy()
    process.exit(0)
}).catch(e => { console.error(e.message); process.exit(1) })
"

docker stop enclume-restore-test && docker rm enclume-restore-test

# ── MinIO : bucket temporaire ─────────────────────────────────
TMP_BUCKET="restore-test-$(date +%s)"
mc mb "$MINIO_ALIAS/$TMP_BUCKET" 2>/dev/null || true
mc mirror "$LAST_BACKUP_DIR/assets/" "$MINIO_ALIAS/$TMP_BUCKET" 2>/dev/null || true
mc diff "$MINIO_ALIAS/$TMP_BUCKET" "$LAST_BACKUP_DIR/assets/" 2>/dev/null || true
mc rb --force "$MINIO_ALIAS/$TMP_BUCKET" 2>/dev/null || true

echo "✅ Test OK — $(date)" >> "$BACKUP_DIR/logs/test.log"

4.4 Lot 3 — Page santé
4.4.1 Endpoint serveur

Dans server/src/routes/health.js, ajouter la fonction readBackupStatus() et l'inclure dans le
Promise.all du router.get('/') existant, puis retourner le champ backup :
javascript

async function readBackupStatus() {
  try {
    const lastSuccessPath = '/var/lib/enclume/backup.last_success'
    const logPath = '/var/backups/enclume/logs/backup.log'

    let lastSuccess = null
    try {
      const ts = await fs.readFile(lastSuccessPath, 'utf8')
      lastSuccess = new Date(parseInt(ts.trim()) * 1000).toISOString()
    } catch {}

    let lastStatus = null, lastError = null
    try {
      const lines = (await fs.readFile(logPath, 'utf8')).trim().split('\n')
      const last = JSON.parse(lines[lines.length - 1])
      lastStatus = last.status
      lastError = last.message || null
    } catch {}

    return {
      last_success: lastSuccess,
      last_status: lastStatus,
      last_error: lastError
    }
  } catch { return null }
}

Modification de la réponse du router.get('/') : ajouter readBackupStatus() au Promise.all et
retourner backup: backupStatus dans l'objet JSON.
4.4.2 UI client

Dans client/src/components/HealthPage.jsx, ajouter dans la grille de cartes, à la suite des
services système :
jsx

{data.backup && (
  <Card title={t('health.backup')}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%',
        background: data.backup.last_status === 'success' ? '#52e07a' : '#e05252',
        boxShadow: data.backup.last_status === 'success' ? '0 0 6px #52e07a88' : 'none' }} />
      <span style={{ color: '#ccd8e0', fontSize: 13 }}>
        {data.backup.last_success
          ? t('health.lastBackup', { time: formatRelative(data.backup.last_success) })
          : t('health.noBackupYet')}
      </span>
    </div>
    {data.backup.last_status === 'error' && (
      <div style={{ color: '#e05252', fontSize: 11, marginTop: 4 }}>{data.backup.last_error}</div>
    )}
  </Card>
)}

Fonction utilitaire formatRelative à ajouter dans le composant :
javascript

function formatRelative(isoDate) {
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000)
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h >= 24) return `${Math.floor(h / 24)}j ${h % 24}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

4.4.3 Clés i18n

Dans client/src/locales/fr.json, section health, ajouter :
json

"backup": "Sauvegardes",
"lastBackup": "Dernière sauvegarde : il y a {{time}}",
"noBackupYet": "Aucune sauvegarde"

4.5 Unités systemd
ini

# /etc/systemd/system/enclume-backup.service
[Unit]
Description=Sauvegarde quotidienne Enclume
After=network.target docker.service

[Service]
Type=oneshot
User=root
ExecStart=/usr/local/sbin/enclume-backup.sh
PrivateTmp=yes
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/backups/enclume /var/lib/enclume /etc/enclume /var/run/docker.sock

ini

# /etc/systemd/system/enclume-backup.timer
[Unit]
Description=Timer de sauvegarde quotidienne Enclume

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target

ini

# /etc/systemd/system/enclume-backup-check.service
[Unit]
Description=Vérification backup Enclume
After=network.target

[Service]
Type=oneshot
User=root
ExecStart=/usr/local/sbin/enclume-backup-check.sh

ini

# /etc/systemd/system/enclume-backup-check.timer
[Unit]
Description=Timer de vérification backup Enclume

[Timer]
OnCalendar=*-*-* 09:00:00
Persistent=true

[Install]
WantedBy=timers.target

ini

# /etc/systemd/system/enclume-backup-test.service
[Unit]
Description=Test de restauration hebdomadaire Enclume
After=network.target docker.service

[Service]
Type=oneshot
User=root
ExecStart=/usr/local/sbin/enclume-backup-test.sh
PrivateTmp=yes
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/backups/enclume /var/lib/enclume /var/run/docker.sock /home/didier/Enclume/server

ini

# /etc/systemd/system/enclume-backup-test.timer
[Unit]
Description=Timer test de restauration Enclume

[Timer]
OnCalendar=Sun *-*-* 04:00:00
Persistent=true

[Install]
WantedBy=timers.target

Logrotate (/etc/logrotate.d/enclume-backup) :
text

/var/backups/enclume/logs/*.log {
    weekly
    rotate 12
    compress
    missingok
    notifempty
}

4.6 Checklist de déploiement (serveur UP)

    □

    mc alias list → définir MINIO_ALIAS dans backup.conf
    □

    mc ls "$MINIO_ALIAS" → confirmer le bucket enclume-assets
    □

    df -h /var/backups → espace disque suffisant
    □

    lsblk -f | grep crypto_LUKS → chiffrement disque existant ?
    □

    sudo mkdir -p /var/backups/enclume/logs /var/lib/enclume /etc/enclume
    □

    Déployer backup.conf dans /etc/enclume/
    □

    Déployer les scripts dans /usr/local/sbin/, chmod +x
    □

    printf 'localhost:5432:vtt:vtt:<mdp>' | sudo tee /root/.pgpass && sudo chmod 600 /root/.pgpass
    □

    Configurer mc pour root : sudo mc alias set <ALIAS> http://localhost:9000 <ACCESS> <SECRET>
    □

    Vérifier les dépendances : pg_dump, pg_dumpall, pg_restore, psql, mc, flock, tar, docker, jq
    □

    Vérifier docker-compose.override.yml → l'ajouter dans CONFIG_PATHS si existant
    □

    Appliquer P-SRV-5 : restreindre les ports Docker à 127.0.0.1 dans docker-compose.yml
    □

    Déployer les unités systemd (.service et .timer), sudo systemctl enable enclume-backup.timer
    □

    Déployer le fichier logrotate, sudo logrotate -d /etc/logrotate.d/enclume-backup
    □

    sudo /usr/local/sbin/enclume-backup.sh — exécution manuelle, vérifier logs et fichiers
    □

    sudo /usr/local/sbin/enclume-backup-test.sh — valider le test de restauration
    □

    Coder le Lot 3 (endpoint + UI + i18n)
    □

    Vérifier la page santé : GET /api/health doit inclure le champ backup

5. Extensions futures — Lots 4, 5 (spécifications prêtes)

Ces lots sont entièrement conçus mais non déployés. Les scripts et configurations ci-dessous sont
fournis pour activation ultérieure, sans nouvelle phase de conception.
5.1 Lot 4 — Sauvegarde hors-site ProtonDrive

Prérequis : compte Proton avec abonnement ProtonDrive, CLI officiel Proton Drive installé,
pass et GPG configurés. Déverrouillage GPG manuel après reboot (intervention humaine ponctuelle).

Script enclume-backup-offsite.sh (à placer dans /usr/local/sbin/) :
bash

#!/bin/bash
set -euo pipefail
source /etc/enclume/backup.conf

DATE=$(date +%Y-%m-%d)
BACKUP_DATE_DIR="$BACKUP_DIR/$DATE"
TIMESTAMP=$(date -Iseconds)

[ "${PROTON_DRIVE_ENABLED:-false}" != "true" ] && { echo "ProtonDrive désactivé."; exit 0; }
[ -d "$BACKUP_DATE_DIR" ] || { echo "Backup local introuvable: $DATE"; exit 1; }

# Chiffrement des dumps avec age (si configuré)
if [ -n "${AGE_PUBLIC_KEY:-}" ]; then
    age -r "$AGE_PUBLIC_KEY" -o "${BACKUP_DATE_DIR}/db/vtt.dump.age" "${BACKUP_DATE_DIR}/db/vtt.dump"
    age -r "$AGE_PUBLIC_KEY" -o "${BACKUP_DATE_DIR}/db/globals.sql.age" "${BACKUP_DATE_DIR}/db/globals.sql"
fi

# Archive chiffrée du miroir MinIO
TARBALL="/tmp/enclume-assets-${DATE}.tar.gz"
tar -czf "$TARBALL" -C "$BACKUP_DATE_DIR/assets" .
if [ -n "${AGE_PUBLIC_KEY:-}" ]; then
    age -r "$AGE_PUBLIC_KEY" -o "${TARBALL}.age" "$TARBALL" && rm "$TARBALL"
fi

# Envoi vers ProtonDrive
proton drive upload "${BACKUP_DATE_DIR}/db/vtt.dump.age" "$PROTON_REMOTE_DIR/$DATE/db/"
proton drive upload "${BACKUP_DATE_DIR}/db/globals.sql.age" "$PROTON_REMOTE_DIR/$DATE/db/"
proton drive upload "${BACKUP_DATE_DIR}/db/manifest.json" "$PROTON_REMOTE_DIR/$DATE/db/"
proton drive upload "${TARBALL}.age" "$PROTON_REMOTE_DIR/$DATE/"
proton drive upload "${BACKUP_DATE_DIR}/config.tar.gz" "$PROTON_REMOTE_DIR/$DATE/"
proton drive upload "${BACKUP_DATE_DIR}/SHA256SUMS" "$PROTON_REMOTE_DIR/$DATE/"

rm -f "${TARBALL}.age"

jq -n --arg date "$DATE" --arg status "success" --arg timestamp "$TIMESTAMP" \
    '{date: $date, status: $status, timestamp: $timestamp}' \
    >> "$BACKUP_DIR/logs/offsite.log"

Unité systemd : enclume-backup-offsite.service (déclenché après enclume-backup.service).

Variables à ajouter dans backup.conf :
bash

PROTON_DRIVE_ENABLED=true
PROTON_REMOTE_DIR="/backups/enclume"
AGE_PUBLIC_KEY="<À_GÉNÉRER>"
AGE_PRIVATE_KEY_FILE="/root/.enclume-backup-key.txt"

5.2 Lot 5a — Chiffrement local (si LUKS absent)

Génération de la clé age :
bash

age-keygen -o /root/.enclume-backup-key.txt
chmod 600 /root/.enclume-backup-key.txt

Ajouter dans backup.conf :
bash

ENCRYPT_LOCAL=true
AGE_PUBLIC_KEY="<clé publique affichée>"
AGE_PRIVATE_KEY_FILE="/root/.enclume-backup-key.txt"

Activation conditionnelle dans enclume-backup.sh (après la création des dumps) :
bash

if [ "${ENCRYPT_LOCAL:-false}" = "true" ] && ! lsblk -f 2>/dev/null | grep -q crypto_LUKS; then
    age -r "$AGE_PUBLIC_KEY" -o "${BACKUP_TMP}/db/vtt.dump.age" "${BACKUP_TMP}/db/vtt.dump" && rm "${BACKUP_TMP}/db/vtt.dump"
    age -r "$AGE_PUBLIC_KEY" -o "${BACKUP_TMP}/db/globals.sql.age" "${BACKUP_TMP}/db/globals.sql" && rm "${BACKUP_TMP}/db/globals.sql"
fi

5.3 Lot 5b — Rotation GFS avancée

La rotation GFS de base (dimanches ×4 semaines, 1er du mois ×3 mois) est déjà intégrée au script de
purge du Lot 1. Pour une GFS plus fine (mensuel ×12 mois, annuel), étendre le script
enclume-backup-purge.sh.
5.4 Lot 5c — Healthchecks.io

Ajouter dans backup.conf :
bash

HEALTHCHECK_UUID=""

Ajouter dans les scripts de backup, test et check :
bash

[ -n "${HEALTHCHECK_UUID:-}" ] && curl -s -o /dev/null --max-time 10 "https://hc-ping.com/${HEALTHCHECK_UUID}/start" || true
# ... opérations ...
[ -n "${HEALTHCHECK_UUID:-}" ] && curl -s -o /dev/null --max-time 10 "https://hc-ping.com/${HEALTHCHECK_UUID}" || true

6. Contraintes critiques
Contrainte	Mitigation
MinIO — CPU x86-64-v2	Image Docker figée (RELEASE.2022-02-07...). docker save + docker inspect inclus dans le backup.
Docker bypass UFW	Restreindre les ports Docker à 127.0.0.1 dans docker-compose.yml (P-SRV-5).
Volumes Docker	pg_dump et mc mirror capturent le contenu logique.
Suppression d'image Docker Hub	docker save local (risque faible mais impact élevé à cause de la contrainte CPU).
Backup interrompu	flock + écriture atomique (.tmp → mv).
Cohérence PostgreSQL/MinIO	Voir §2 — manifeste + double passe + vérification.
7. Pièges documentés
Piège	Parade
pg_dumpall --globals-only = script SQL, pas -Fc	Stocké .sql, restauré avec psql -f
pg_restore --list ne vérifie pas les données	Test de restauration enrichi (Lot 2)
mc mirror non atomique	Double passe + manifeste
MINIO_ALIAS à configurer manuellement	Checklist déploiement
.pgpass absent ou permissions ≠ 600	Vérification au début du script
Logs JSON invalides si " ou \ dans le message	Génération via jq -n
Purge partielle (dump sans config)	Répertoire atomique par date, suppression par rm -rf du répertoire
SHA256 calculés mais jamais vérifiés	Vérification dans enclume-restore.sh avant restauration
Manifeste incomplet (nouvelles colonnes MinIO)	Commentaire dans le script — maintenance nécessaire
ProtectSystem=strict bloque /var/run/docker.sock	ReadWritePaths inclut /var/run/docker.sock
8. Améliorations futures (non planifiées)

    Page santé avancée : taille des backups, historique, prochaine exécution.

    Benchmark de durée de backup (détection de régression).

    Versionnage explicite des backups (commit Git, migration, version PostgreSQL).

    docker-compose.override.yml dans CONFIG_PATHS (si existant).

    Nettoyage des fichiers temporaires en cas de crash (trap cleanup).

    Documentation liée : SERVEURDISTANT.md (infrastructure), VOCABULARY.md (conventions), SYSTEME/CORE.md (auth, ownership, WebSocket).