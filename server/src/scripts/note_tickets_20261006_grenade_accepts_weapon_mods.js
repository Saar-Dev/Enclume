// Script à usage unique — note le correctif codé pour GRENADE-ACCEPTS-WEAPON-MODS (session de
// correction de bugs du 2026-10-06). Régularisation du 2026-10-14 : Saar confirme avoir validé ce
// correctif en jeu réel le 2026-10-06 mais avait clos le ticket par une écriture directe en base
// (note courte, pas de script versionné — contraire à AGENTS.md § Clôture) au lieu de ce script-ci,
// jamais exécuté jusqu'ici. Statut déjà 'resolved' en base : ce script n'y touche pas, il complète
// seulement la note (idempotent, skip si déjà noté) pour que le détail causal réel soit tracé.
// Lancement manuel, local, depuis la racine :
//   node --env-file=.env server/src/scripts/note_tickets_20261006_grenade_accepts_weapon_mods.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-06 : correctif codé ---'

const NOTE = `

${MARKER}
Cause racine vérifiée par lecture + requête en base : getModingState (liste des cibles proposées)
et installMod (garde serveur) ne filtraient que family = 'Armes' et category != 'Accessoires pour
armes' — ni l'un ni l'autre n'excluait Grenade, Arme de contact ou Armes de jet. Ces trois
catégories partagent fire_mode = NULL, le même champ déjà établi (rules/combat.md) pour distinguer
Tir de Corps à corps. Les 25 accessoires du catalogue (lunettes, silencieux, logiciels de visée...)
sont tous conçus pour une arme qui tire.

Corrigé (server/src/services/modingService.js) : AND re.fire_mode IS NOT NULL ajouté à la requête
SQL de getModingState, et weaponRef.fire_mode == null ajouté à la garde de installMod — réutilise
une colonne déjà faisant autorité ailleurs, aucune nouvelle donnée. Vérifié en base locale avant
correctif : zéro mod déjà installé sur une arme fire_mode NULL, aucune donnée existante affectée.

Testé : node --test modingService.test.mjs (5/5 — rejet d'une grenade comme cible, non-régression
sur une vraie arme à feu, absence de la grenade dans la liste des cibles modables). Validé en jeu
réel par Saar le 2026-10-06 (tentative d'installation depuis l'écran Modding) — confirmé de vive
voix le 2026-10-14, régularisé ici faute de script à l'époque. Détail complet : docs/JOURNAL8.md,
docs/SYSTEME/MODING.md §2bis (2026-10-06).`

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: 'GRENADE-ACCEPTS-WEAPON-MODS' }).first()
  if (!ticket) { console.log('[SKIP] GRENADE-ACCEPTS-WEAPON-MODS — ticket introuvable'); return }
  if ((ticket.admin_notes || '').includes(MARKER)) { console.log('[SKIP] GRENADE-ACCEPTS-WEAPON-MODS — déjà noté'); return }
  await db('bug_tickets').where({ id: ticket.id }).update({
    admin_notes: `${ticket.admin_notes || ''}\n${NOTE}`.trim(),
    updated_at: db.fn.now(),
  })
  console.log('[OK] GRENADE-ACCEPTS-WEAPON-MODS — note causale ajoutée (statut déjà resolved, inchangé)')
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
