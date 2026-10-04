// Script à usage unique — note sur COMBAT-RANGE-PLAYER-EDITABLE après le correctif codé le
// 2026-10-04 (session de correction de bugs). Statut 'in_progress' (pas 'resolved') : codé, lint,
// build et tests existants passés, pas encore vérifié avec un vrai second client. Idempotent (skip
// si déjà noté). Lancement manuel, local :
//   node --env-file=.env server/src/scripts/note_tickets_20261004_combat_range_player_editable.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-04 : correctif codé ---'

const NOTE = `

${MARKER}
Découverte qui a changé le périmètre : confirmedModifiers.portee (envoyé par le client à
COMBAT_ACTION_CONFIRM) n'était lu nulle part dans resolveAssaultAction — le serveur recalcule
toujours sa propre authoritativeRangeBand depuis la distance réelle. Le sélecteur du joueur n'a
donc jamais permis de tricher, c'est un problème de confiance/UX : un contrôle qui affiche une
valeur que personne ne regarde côté serveur. Second constat : le MJ n'a même aucune fenêtre
ouverte quand un PJ résout son propre assaut distance (CombatOverlay.jsx excluait
gmActiveCharacter?.type !== 'pj'), donc aucune correction n'était possible de toute façon.

Recherche demandée par Saar (« as-tu consulté ce que font les pros ? ») : confirmation que le
mécanisme déjà présent (combatPreviews, slot éphémère par campagne, relayé à la room, resynchronisé
à la reconnexion) est le patron standard pour ce cas (vérifié en pratique professionnelle externe) —
étendu plutôt que dupliqué.

Corrigé : nouvel événement COMBAT_RESOLUTION_OVERRIDE (MJ → serveur → room), nouveau slot éphémère
combatResolutionOverrides (combatTurnEngine.js, consommé une fois par resolveAssaultAction puis
supprimé), nouveau handler MJ-only (socketCombatResolution.js, valide contre RANGE_BANDS),
authoritativeRangeBand lit la surcharge en priorité si présente pour ce token (y compris pour
contourner un rejet "hors de portée", jugement MJ assumé). Côté client : Portée n'est plus jamais
éditable par le joueur (affichage pur, reflète la surcharge MJ en direct via le même événement) ;
la fenêtre MJ s'affiche désormais aussi pour l'assaut distance d'un PJ (nouvelle prop
gmOversightOnly masque le bouton "Lancer" dans ce cas — seul le joueur lance ses propres dés).

Scope resserré à Portée seule : Taille pour un PJ en mode 'auto' a le même trou (MJ ne peut pas non
plus surcharger la carrure cible pour un PJ aujourd'hui) mais n'a pas été inclus ici pour ne pas
mélanger deux systèmes de surcharge dans un seul correctif — gap distinct, non corrigé, à ticketer
séparément si Saar le souhaite.

Testé : node --check (5 fichiers), eslint ciblé (0 erreur nouvelle), vite build, shared tests
(941/941), 4 suites DB-backed exerçant resolveAssaultAction (105/105, aucune régression sur le
chemin par défaut). Non testé : scénario réel à deux clients (MJ surcharge en direct pendant que le
joueur a sa fenêtre ouverte) — nécessite plusieurs clients. Détail complet : docs/JOURNAL8.md.`

async function run() {
  const code = 'COMBAT-RANGE-PLAYER-EDITABLE'
  const ticket = await db('bug_tickets').where({ linked_bug_code: code }).first()
  if (!ticket) { console.log(`[SKIP] ${code} — ticket introuvable`); return }
  if ((ticket.admin_notes || '').includes(MARKER)) { console.log(`[SKIP] ${code} — déjà noté`); return }
  await db('bug_tickets').where({ id: ticket.id }).update({
    status: 'in_progress',
    admin_notes: `${ticket.admin_notes || ''}\n${NOTE}`.trim(),
    updated_at: db.fn.now(),
  })
  console.log(`[OK] ${code} — note ajoutée, statut -> in_progress`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
