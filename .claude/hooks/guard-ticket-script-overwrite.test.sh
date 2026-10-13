#!/bin/bash
# Test de guard-ticket-script-overwrite.js. Lancer depuis n'importe où :
#   bash .claude/hooks/guard-ticket-script-overwrite.test.sh
# Ne touche jamais le disque (le hook ne fait que lire, jamais écrire).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
HOOK="$HERE/guard-ticket-script-overwrite.js"
# pwd -W (pas pwd) : le node Windows natif appelé par le hook ne comprend pas les chemins
# style Git Bash (/c/Users/...), il faut le format Windows à lettre de lecteur (C:/Users/...).
REPO="$(cd "$HERE/../.." && pwd -W)"
pass=0
fail=0

check() { # $1 = code attendu (0|2), $2 = libellé, $3 = file_path JSON-échappé
  local out ec
  out=$(printf '{"tool_name":"Write","tool_input":{"file_path":"%s","content":"x"}}' "$3" | node "$HOOK" 2>/dev/null)
  ec=$?
  if [ "$ec" = "$1" ]; then
    echo "  OK   [$ec] $2"; pass=$((pass + 1))
  else
    echo "  FAIL [got $ec want $1] $2"; fail=$((fail + 1))
  fi
}

EXISTING="$REPO/server/src/scripts/resolve_ticket_melee_mr.js"
EXISTING_NOTE="$REPO/server/src/scripts/note_tickets_20261003_skill_prerequisites_default_verified.js"
EXISTING_NON_TICKET="$REPO/server/src/scripts/import_beta_test_20260905.js"
CREATE_TICKETS="$REPO/server/src/scripts/create_tickets_20261003_beta_findings.js"
NEW_PATH="$REPO/server/src/scripts/resolve_ticket_does_not_exist_yet_12345.js"
OUTSIDE_SCRIPTS="$REPO/server/src/services/resolve_ticket_foo.js"

echo "-- doit BLOQUER (exit 2) : fichier de ticket deja existant --"
check 2 "resolve_ticket_melee_mr.js (existe)"            "${EXISTING//\\/\\\\}"
check 2 "note_tickets_...skill_prereq.js (existe)"       "${EXISTING_NOTE//\\/\\\\}"

echo "-- doit PASSER (exit 0) --"
check 0 "resolve_ticket_*.js inexistant (nouvelle cloture)" "${NEW_PATH//\\/\\\\}"
check 0 "create_tickets_*.js (categorie distincte, existe)" "${CREATE_TICKETS//\\/\\\\}"
check 0 "script existant mais pas un ticket resolve/note"   "${EXISTING_NON_TICKET//\\/\\\\}"
check 0 "resolve_ticket_*.js hors server/src/scripts/"       "${OUTSIDE_SCRIPTS//\\/\\\\}"

echo "-- fail-safe (entree illisible/absente -> exit 0) --"
printf '' | node "$HOOK"; echo "  vide -> exit $?"
printf 'pas du json' | node "$HOOK"; echo "  non-json -> exit $?"
printf '{"tool_name":"Write","tool_input":{}}' | node "$HOOK"; echo "  sans file_path -> exit $?"

echo
echo "pass=$pass fail=$fail"
[ "$fail" = 0 ]
