#!/bin/bash

ROOT="$HOME/Enclume"
SERVER="$ROOT/server"
CLIENT="$ROOT/client"

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

# --- SERVEUR ---
echo "[3] Serveur Express (port 3001)..."
if curl -s --head --request GET "http://localhost:3001/api/health" > /dev/null 2>&1; then
    echo "    Serveur déjà en ligne : OK"
else
    echo "    Serveur arrêté. Lancement en arrière-plan..."
    cd "$SERVER" && npm run dev &
    sleep 3
fi

echo ""

# --- CLIENT ---
echo "[4] Client React (port 5173)..."
if curl -s --head --request GET "http://localhost:5173" > /dev/null 2>&1; then
    echo "    Client déjà en ligne : OK"
else
    echo "    Client arrêté. Lancement en arrière-plan..."
    cd "$CLIENT" && npm run dev &
    sleep 3
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
echo "Si un service est HORS LIGNE, vérifie les logs avec 'docker logs <nom_conteneur>' ou 'npm run dev' manuellement."
echo ""
