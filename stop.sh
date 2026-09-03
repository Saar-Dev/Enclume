#!/bin/bash
# Arrêt propre de la stack de dev Enclume (contrepartie de start.sh / `npm run dev`).
# Tue le groupe de processus du superviseur concurrently, puis libère les ports par
# filet de sécurité.

ROOT="$HOME/Enclume"
PIDFILE="$ROOT/.dev-stack.pid"

if [ -f "$PIDFILE" ]; then
    PID="$(cat "$PIDFILE")"
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        echo "Arrêt du groupe de processus $PID..."
        kill -TERM -- "-$PID" 2>/dev/null || kill -TERM "$PID" 2>/dev/null
        sleep 2
        kill -KILL -- "-$PID" 2>/dev/null || true
    fi
    rm -f "$PIDFILE"
fi

# Filet : libérer les ports même sans pidfile valide.
for port in 3001 5173; do
    pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
    if [ -n "$pids" ]; then
        echo "Port $port encore tenu par $pids -> kill."
        # shellcheck disable=SC2086
        kill -KILL $pids 2>/dev/null || true
    fi
done

echo "Stack arrêtée."
