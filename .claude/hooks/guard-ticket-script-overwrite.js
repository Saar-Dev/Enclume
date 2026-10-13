#!/usr/bin/env node
'use strict';
/*
 * guard-ticket-script-overwrite.js — hook PreToolUse (outil Write) de Claude Code.
 *
 * Bloque tout `Write` qui ciblerait un script de cloture de ticket deja existant sur
 * disque : server/src/scripts/{resolve,note}_ticket(s)_*.js. Ces fichiers restent
 * committes comme compte rendu historique de ce qui a reellement ete execute (le script
 * du correctif initial) ; un `Write` ecrase silencieusement ce compte rendu sans toucher
 * la base si le script n'a pas encore ete relance (vecu deux fois : WIZ38 2026-10-10,
 * INI2 2026-10-13 — tous deux rattrapes a la derniere minute par un `git status`, jamais
 * par la relecture de l'instruction elle-meme).
 *
 * Contrat projet : memoire feedback_git_tests_and_tooling.md + AGENTS.md. Ne couvre pas
 * `Edit` : cet outil exige deja une lecture prealable en session (mecanisme du harnais),
 * c'est la voie correcte pour modifier un script existant. Ne couvre pas non plus
 * `create_tickets_*.js` (categorie distincte, idempotente, volontairement hors perimetre).
 *
 * Contrat hook (doc Anthropic) :
 *   - entree : JSON sur stdin, champ `tool_input.file_path` pour Write ;
 *   - `exit 2` + message sur stderr  => blocage, message renvoye a Claude ;
 *   - `exit 0`                       => aucune decision, le flux normal s'applique.
 *
 * Fail-safe : entree illisible, chemin absent, ou fichier absent du disque => exit 0.
 */

const fs = require('fs');

const TICKET_SCRIPT_RE = /\/server\/src\/scripts\/(resolve|note)_tickets?_.*\.js$/i;

function readPayload() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

const payload = readPayload();
const filePath =
  payload && payload.tool_input && typeof payload.tool_input.file_path === 'string'
    ? payload.tool_input.file_path
    : '';

if (!filePath) {
  process.exit(0);
}

const normalized = filePath.replace(/\\/g, '/');

if (!TICKET_SCRIPT_RE.test(normalized)) {
  process.exit(0);
}

let exists = false;
try {
  exists = fs.existsSync(filePath);
} catch {
  process.exit(0);
}

if (exists) {
  process.stderr.write(
    '⛔ Write bloque sur un script de ticket deja existant (guard-ticket-script-overwrite.js).\n' +
      `Chemin : ${filePath}\n` +
      'Ces scripts restent committes comme compte rendu historique — un Write les ecrase sans ' +
      'avertissement si le script n\'a pas encore ete relance. Lire le fichier (Read) puis le ' +
      'modifier avec Edit si une correction est reellement necessaire ; pour une NOUVELLE cloture, ' +
      'creer un fichier nomme distinctement (..._v2.js, ..._close.js), jamais ecraser l\'original.\n',
  );
  process.exit(2);
}

process.exit(0);
