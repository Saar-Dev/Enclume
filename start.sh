#!/bin/bash

ROOT="$HOME/Enclume"

echo ""
echo "========================================"
echo "   ENCLUME - Démarrage intelligent"
echo "========================================"
echo ""

# --- DOCKER ---
echo "[1] Docker..."
if ! docker info > /dev/null 2>&1; then
    echo "    Docker non détecté. Vérifie que Docker est installé et démarré."
    exit 1
else
    echo "    Docker : OK"
fi

# --- CONTENEURS ---
echo "[2] Conteneurs Docker..."
cd "$ROOT"
if docker compose ps --status running 2>/dev/null | grep -qE "postgres|redis|minio"; then
    echo "    Conteneurs déjà actifs : OK"
else
    echo "    Conteneurs arrêtés. Démarrage..."
    docker compose up -d
    sleep 5
    echo "    Conteneurs lancés."
fi

echo ""

# --- STACK APPLICATIVE (serveur 3001 + client 5173) ---
# Un seul superviseur : `npm run dev` (concurrently) lance serveur + client dans sa
# propre session (setsid). Arrêt propre du groupe via stop.sh — jamais d'orphelin.
echo "[3] Stack applicative (serveur 3001 + client 5173)..."
srv_ok=false; cli_ok=false
curl -s --head --request GET "http://localhost:3001/api/health" > /dev/null 2>&1 && srv_ok=true
curl -s --head --request GET "http://localhost:5173" > /dev/null 2>&1 && cli_ok=true

if $srv_ok && $cli_ok; then
    echo "    Stack déjà en ligne : OK"
else
    if $srv_ok || $cli_ok; then
        echo "    Stack partielle détectée. Arrêt avant relance..."
        [ -x "$ROOT/stop.sh" ] && "$ROOT/stop.sh"
    fi
    echo "    Démarrage de la stack (session détachée, logs -> dev-stack.log)..."
    cd "$ROOT"
    # setsid crée une nouvelle session : le bash devient chef de groupe, `exec` garde
    # son PID -> .dev-stack.pid contient le PGID, que stop.sh tue en bloc.
    setsid bash -c 'echo $$ > "'"$ROOT"'/.dev-stack.pid"; exec npm run dev' \
        > "$ROOT/dev-stack.log" 2>&1 &
    sleep 5
fi

echo ""

# --- VÉRIFICATION FINALE ---
echo "Vérification finale dans 8 secondes..."
sleep 8
echo ""
echo "========================================"
echo "   ÉTAT FINAL"
echo "========================================"

if curl -s --head --request GET "http://localhost:3001/api/health" > /dev/null 2>&1; then
    echo "    Serveur  http://localhost:3001  [OK]"
else
    echo "    Serveur  http://localhost:3001  [HORS LIGNE]"
fi

if curl -s --head --request GET "http://localhost:5173" > /dev/null 2>&1; then
    echo "    Client   http://localhost:5173  [OK]"
else
    echo "    Client   http://localhost:5173  [HORS LIGNE]"
fi

echo ""
echo "Logs de la stack : dev-stack.log   |   Arrêt propre : ./stop.sh"
echo "Si un service est HORS LIGNE, vérifie dev-stack.log ou 'docker logs <nom_conteneur>'."
echo ""
