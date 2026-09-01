#!/usr/bin/env node
'use strict';
/*
 * guard-git-push.js — hook PreToolUse (outil Bash) de Claude Code.
 *
 * Bloque tout `git push` qui viserait `master` / `main`, y compris les formes
 * implicites (push « nu » alors que l'upstream de HEAD est une branche protégée,
 * `--all`, `--mirror`, refspec `HEAD:master`, …).
 *
 * Contrat projet : AGENTS.md / CLAUDE.md — jamais de push direct vers master.
 * `dev/Saar` est la seule branche poussée. Un cas exceptionnel légitime : Saar le
 * fait à la main.
 *
 * Contrat hook (doc Anthropic) :
 *   - entrée : JSON sur stdin, champ `tool_input.command` pour Bash ;
 *   - `exit 2` + message sur stderr  => blocage, message renvoyé à Claude ;
 *   - `exit 0`                       => aucune décision, le flux de permission normal s'applique.
 *
 * Détection : on ne regarde `git push` que lorsqu'il est en **position de commande**
 * (début de segment, après `&&` `||` `;` `|` ou saut de ligne), jamais à l'intérieur
 * d'une chaîne (`echo "... git push origin master"`, `grep "git push ..."`).
 *
 * Fail-safe : entrée illisible => exit 0. Le retrait de `Bash(git push *)` de
 * l'allow reste le second garde-fou (un push non couvert déclenche un prompt).
 *
 * settings.json : `matcher: "Bash"` SANS `if` — le hook tourne sur chaque appel Bash
 * (~50 ms). Choix délibéré : robustesse > perf (aucune forme `git push` ne contourne
 * le filtre), et le fast-path non-git est un simple regex qui exit 0 immédiatement.
 * Tests : `bash .claude/hooks/guard-git-push.test.sh`.
 */

const fs = require('fs');
const { execFileSync } = require('child_process');

const PROTECTED = /^(master|main)$/;

function readPayload() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

/** Le segment est-il une invocation de `git push` (et pas une chaîne qui la mentionne) ? */
function gitPushArgs(segment) {
  let s = segment.trim();
  // affectations d'environnement en tête : FOO=bar BAZ="x" git push ...
  s = s.replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\S+)\s+)+/, '');
  s = s.replace(/^sudo\s+/, '');
  // git [-C <path>] [--git-dir=..] [--work-tree=..] push <args...>
  const m = s.match(
    /^git(?:\s+-C\s+(?:"[^"]*"|'[^']*'|\S+)|\s+--git-dir=\S+|\s+--work-tree=\S+)*\s+push(?:\s+(.*))?$/s,
  );
  if (!m) return null;
  return (m[1] || '').trim().split(/\s+/).filter(Boolean);
}

const payload = readPayload();
const command =
  payload && payload.tool_input && typeof payload.tool_input.command === 'string'
    ? payload.tool_input.command
    : '';

const segments = command.split(/&&|\|\||;|\||\n/);
const pushCalls = segments.map(gitPushArgs).filter((a) => a !== null);
if (pushCalls.length === 0) {
  process.exit(0);
}

let blocked = false;
for (const args of pushCalls) {
  const positional = args.filter((t) => !t.startsWith('-'));
  const flags = args.filter((t) => t.startsWith('-'));

  // `--all` / `--mirror` poussent toutes les branches => master incluse.
  if (flags.some((f) => f === '--all' || f === '--mirror')) {
    blocked = true;
    break;
  }

  // Cible explicite : un token qui se résout en master/main (refspec `src:dst` inclus).
  const explicit = positional.some((t) => {
    const dst = t.includes(':') ? t.split(':').pop() : t;
    return PROTECTED.test(dst.replace(/^refs\/heads\//, ''));
  });
  if (explicit) {
    blocked = true;
    break;
  }

  // Push « nu » : dangereux si l'upstream de HEAD est protégé.
  const hasExplicitRef = positional.length >= 2 || positional.some((t) => t.includes(':'));
  if (!hasExplicitRef) {
    try {
      const cwd = (payload && payload.cwd) || process.cwd();
      const upstream = execFileSync(
        'git',
        ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
        { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
      ).trim();
      if (PROTECTED.test(upstream.split('/').pop() || '')) {
        blocked = true;
        break;
      }
    } catch {
      // Pas d'upstream résolu : on ne peut pas conclure -> flux normal.
    }
  }
}

if (blocked) {
  process.stderr.write(
    '⛔ Push vers master/main bloque (guard-git-push.js).\n' +
      'AGENTS.md / CLAUDE.md : jamais de push direct vers master. ' +
      'dev/Saar est la seule branche poussee ; un cas exceptionnel legitime, Saar le fait a la main.\n',
  );
  process.exit(2);
}

process.exit(0);
