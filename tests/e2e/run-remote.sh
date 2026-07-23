#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
default_key="$(cd -- "$repo_root/../.." && pwd)/codex_enclume_staging_ed25519"
ssh_key="${ENCLUME_SSH_KEY:-$default_key}"
local_port="${ENCLUME_LOCAL_PORT:-18293}"
ssh_host="${ENCLUME_SSH_HOST:-codex@89.92.219.211}"
ssh_port="${ENCLUME_SSH_PORT:-8222}"

if [[ ! -f "$ssh_key" ]]; then
  echo "Clé SSH Enclume introuvable : $ssh_key" >&2
  exit 1
fi

ssh -N \
  -o BatchMode=yes \
  -o ExitOnForwardFailure=yes \
  -o StrictHostKeyChecking=accept-new \
  -i "$ssh_key" \
  -p "$ssh_port" \
  -L "${local_port}:127.0.0.1:8293" \
  "$ssh_host" &
tunnel_pid=$!

cleanup() {
  kill "$tunnel_pid" 2>/dev/null || true
  wait "$tunnel_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

ready=false
for _ in $(seq 1 20); do
  if ! kill -0 "$tunnel_pid" 2>/dev/null; then
    echo "Le tunnel SSH s'est arrêté avant d'être disponible." >&2
    exit 1
  fi
  if (echo >"/dev/tcp/127.0.0.1/$local_port") >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 0.25
done

if [[ "$ready" != true ]]; then
  echo "Le tunnel SSH Enclume n'est pas devenu disponible sur le port local $local_port." >&2
  exit 1
fi

ENCLUME_BASE_URL="http://127.0.0.1:$local_port" \
  "$repo_root/node_modules/.bin/playwright" test
