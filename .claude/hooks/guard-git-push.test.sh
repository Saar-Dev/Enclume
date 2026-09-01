#!/bin/bash
# Test de guard-git-push.js. Lancer depuis n'importe où :  bash .claude/hooks/guard-git-push.test.sh
# Ne touche jamais le dépôt (le hook exit avant toute exécution git).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
HOOK="$HERE/guard-git-push.js"
REPO="$(cd "$HERE/../.." && pwd)"
pass=0
fail=0

check() { # $1 = code attendu (0|2), $2 = libellé, $3 = commande (chaîne JSON)
  local out ec
  out=$(printf '{"cwd":"%s","tool_name":"Bash","tool_input":{"command":%s}}' "$REPO" "$3" | node "$HOOK" 2>/dev/null)
  ec=$?
  if [ "$ec" = "$1" ]; then
    echo "  OK   [$ec] $2"; pass=$((pass + 1))
  else
    echo "  FAIL [got $ec want $1] $2"; fail=$((fail + 1))
  fi
}

echo "-- doit BLOQUER (exit 2) --"
check 2 "push origin master"             '"git push origin master"'
check 2 "push origin main"               '"git push origin main"'
check 2 "push -f origin master"          '"git push -f origin master"'
check 2 "push --force-with-lease master" '"git push origin master --force-with-lease"'
check 2 "push HEAD:master"               '"git push origin HEAD:master"'
check 2 "push HEAD:refs/heads/master"    '"git push origin HEAD:refs/heads/master"'
check 2 "push --all"                     '"git push --all origin"'
check 2 "push --mirror"                  '"git push --mirror"'
check 2 "env-prefixe push master"        '"GIT_TRACE=1 git push origin master"'
check 2 "git -C path push master"        '"git -C /some/repo push origin master"'
check 2 "chaine apres cd"                '"cd /x && git push origin master"'
check 2 "push master via pipe"           '"git push origin master 2>&1 | tee log"'

echo "-- doit PASSER (exit 0) --"
check 0 "push origin dev/Saar"           '"git push origin dev/Saar"'
check 0 "push nu (upstream != protege)"  '"git push"'
check 0 "push --dry-run dev/Saar"        '"git push --dry-run origin dev/Saar"'
check 0 "push -u origin dev/Saar"        '"git push -u origin dev/Saar"'
check 0 "git status"                     '"git status"'
check 0 "git fetch origin master"        '"git fetch origin master"'
check 0 "git log origin/master"          '"git log origin/master"'
check 0 "commit msg mentionne master"    '"git commit -m \"fix push to master\""'
check 0 "echo mentionne la commande"     '"echo \"ne pas: git push origin master\""'
check 0 "grep mentionne la commande"     '"grep -rn \"git push origin master\" ."'
check 0 "npm run build"                  '"npm run build"'

echo "-- fail-safe (entree illisible -> exit 0) --"
printf '' | node "$HOOK"; echo "  vide -> exit $?"
printf 'pas du json' | node "$HOOK"; echo "  non-json -> exit $?"

echo
echo "pass=$pass fail=$fail"
[ "$fail" = 0 ]
