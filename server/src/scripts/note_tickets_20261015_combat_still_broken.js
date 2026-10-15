// Script à usage unique — audit 2026-10-15, domaine combat : tickets vérifiés en lecture de code
// réel et confirmés TOUJOURS non corrigés. Statut inchangé, note factuelle "À corriger, vérifié
// <date>" ajoutée pour que le prochain agent ne reparte pas de zéro sur le diagnostic.
// Idempotent (MARKER en note).
//   node --env-file=.env server/src/scripts/note_tickets_20261015_combat_still_broken.js

import db from '../db/knex.js'

const MARKER = 'À corriger, vérifié 2026-10-15'

const STILL_BROKEN = [
  { code: 'MODING4-ATI', note: `${MARKER} : aucune interface de configuration cible/mode pour l'A.T.I. — grep sur le client ne trouve aucun composant de config, seul le hook shared/mods/ati.js existe (jamais invoqué, voir MODING4-INTEGRATION).` },
  { code: 'MODING4-MEMOIRE', note: `${MARKER} : aucune interface d'enregistrement de cibles pour "Mémoire de cibles" — seul shared/mods/memoire.js existe (jamais invoqué, voir MODING4-INTEGRATION).` },
  { code: 'MODING4-PROJECTEUR', note: `${MARKER} : shared/mods/projecteur.js dit lui-même en commentaire "[HORS PÉRIMÈTRE Phase 4 — intégration non câblée] ... ce handler est un no-op" — context.targetIsMoving/targetMovementIsErratic/targetMovementMalus ne sont jamais fournis par resolveAssaultAction.` },
  { code: 'MODING4-INTEGRATION', note: `${MARKER} : shared/weaponModRegistry.js enregistre bien les hooks onBeforeAttack (ati/memoire/projecteur) mais aucun appelant de onBeforeAttack n'existe dans server/src (grep vide) — le Groupe 4 n'est effectivement jamais invoqué en résolution réelle.` },
  { code: 'DR2', note: `${MARKER} : aucune mécanique de déplacement de drone — server/src/socket/socketCombatDrone.js ne contient aucune référence à un déplacement/position (grep vide), seules les mécaniques d'interception/armement/télépilotage existent (droneInterceptionService.js, droneTelepilotState.js).` },
  { code: 'WOUND-STABILIZATION-UNMODELED', note: `${MARKER} : character_wounds.is_stabilized n'est toujours lu/écrit que par woundUtils.js#insertWoundRow (recopie) et char-sheet.js:1068 (route PUT .../stabilize) — aucune règle de dégradation/hémorragie ne teste cette colonne (grep is_stabilized/isStabilized exhaustif sur server/src, rien d'autre).` },
  { code: 'COMBAT-DRONES-ONLY-LOOP', note: `${MARKER} : combatTurnEngine.js:190 confirme toujours en commentaire que les drones drone_auto "ne comptent pas comme acteurs" dans le garde-fou anti-boucle — un combat composé uniquement de tels drones peut donc toujours enchaîner les Tours sans fin. Non reproduit en session réelle, mais le code n'a pas changé depuis le signalement.` },
  { code: 'COMBAT-FLUX-DOC-STALE-TIMELINE', note: `${MARKER} : docs/SYSTEME/COMBAT_FLUX.md §7 (lignes ~419-543) décrit toujours "remainingMeleeActions"/"resolveMeleeAction récursif" — mécanisme retiré du code (confirmé par commit f478b341, qui a corrigé les commentaires de code mais pas ce document).` },
  { code: 'PERMUTER-DUALWIELD-OFFHAND-E2E', note: `${MARKER} : server/src/socket/socketCombatHandWeaponAbsence.test.mjs couvre le cas général "arme non en main" mais aucun test ne couvre spécifiquement le scénario à deux armes (tir/CaC) où seule la seconde arme manque à la résolution — plusieurs tests du fichier sont d'ailleurs marqués { skip }.` },
]

async function run() {
  for (const { code, note } of STILL_BROKEN) {
    const t = await db('bug_tickets').where({ linked_bug_code: code }).first()
    if (!t) { console.log(`[SKIP] ${code} — introuvable`); continue }
    if ((t.admin_notes || '').includes(MARKER)) { console.log(`[SKIP] ${code} — déjà noté`); continue }
    await db('bug_tickets').where({ id: t.id }).update({
      admin_notes: `${t.admin_notes || ''}\n\n--- 2026-10-15 ---\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    console.log(`[OK] ${code} — note ajoutée, statut inchangé (${t.status})`)
  }
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
