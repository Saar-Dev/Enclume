// Script à usage unique — note le correctif codé pour GRENADE-STACK-BY-TYPE (session de correction
// de bugs du 2026-10-06, généralisé en session au-delà des grenades/armes de jet). Régularisation
// du 2026-10-14 : Saar confirme avoir validé ce correctif en jeu réel le 2026-10-06 mais avait clos
// le ticket par une écriture directe en base (note courte, pas de script versionné — contraire à
// AGENTS.md § Clôture) au lieu de ce script-ci, jamais exécuté jusqu'ici. Statut déjà 'resolved' en
// base : ce script n'y touche pas, il complète seulement la note (idempotent, skip si déjà noté).
// Lancement manuel, local, depuis la racine :
//   node --env-file=.env server/src/scripts/note_tickets_20261006_grenade_stack_by_type.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-06 : correctif codé, règle généralisée (ITG + calibre) ---'

const NOTE = `

${MARKER}
Cause racine vérifiée en base : canStack (inventoryRules.js) refusait tout item à location
équipable, quel que soit has_integrity. Grenade et Armes de jet portent location='M' comme
n'importe quelle arme — la migration 333 (2026-09-09) leur avait déjà retiré has_integrity
(consommables sans état suivi) sans jamais toucher à ce second verrou.

Généralisée en session (Saar) au-delà des grenades : recherche faite avant de coder (patron pro
« définition vs instance » des inventaires de jeu — FoundryVTT dnd5e distingue un objet à charges
(jamais groupé) d'un consommable (toujours groupé)). Vérifié en base : seules has_integrity (ITG) et
caliber (chargeur suivi par exemplaire, resolveAmmoInit) portent un état réel par-exemplaire — ni
location ni category. 30 armes de corps à corps (sur 39) et 5 pièces d'armure basique ont déjà
has_integrity=false en catalogue ; 3 armes à distance primitives (arc/arbalète/fronde) ont un
fire_mode mais caliber=NULL. Vérifié en base réelle : zéro personnage avec chargeur chargé, nom
personnalisé ou exemplaire équipé parmi ces objets — aucun risque sur les parties en cours.

Corrigé (server/src/lib/inventoryRules.js) : canStack(ref) { return !ref?.has_integrity &&
!ref?.caliber } — liste de catégories retirée, remplacée par les deux colonnes qui comptent
réellement. S'applique désormais aussi aux armes de corps à corps basiques et à l'armure simple.
Vérifié par lecture : consumeThrownGrenade (socketCombatAoe.js) et countStowedByContainer gèrent
déjà correctement une ligne à quantity > 1 — écrits en anticipant ce correctif. Aucun changement
côté combat.

Testé : inventoryRules.test.mjs réécrit (7/7, dont le cas réel arc/arbalète/fronde) ;
inventoryService.test.mjs (grenade + arme de jet, 30/30) ; modingService.test.mjs 5/5
(non-régression croisée). Validé en jeu réel par Saar le 2026-10-06 (armes de corps à corps/armure
basiques empilables, conséquence visible de la généralisation) — confirmé de vive voix le
2026-10-14, régularisé ici faute de script à l'époque.
Détail complet : docs/JOURNAL8.md, docs/PLANS/PLAN_USURE&INTEGRITE.md §3 (2026-10-06).`

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: 'GRENADE-STACK-BY-TYPE' }).first()
  if (!ticket) { console.log('[SKIP] GRENADE-STACK-BY-TYPE — ticket introuvable'); return }
  if ((ticket.admin_notes || '').includes(MARKER)) { console.log('[SKIP] GRENADE-STACK-BY-TYPE — déjà noté'); return }
  await db('bug_tickets').where({ id: ticket.id }).update({
    admin_notes: `${ticket.admin_notes || ''}\n${NOTE}`.trim(),
    updated_at: db.fn.now(),
  })
  console.log('[OK] GRENADE-STACK-BY-TYPE — note causale ajoutée (statut déjà resolved, inchangé)')
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
