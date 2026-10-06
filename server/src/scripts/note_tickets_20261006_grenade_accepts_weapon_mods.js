// Script à usage unique — note le correctif codé pour GRENADE-ACCEPTS-WEAPON-MODS (session de
// correction de bugs du 2026-10-06) : statut reste 'in_progress' (pas 'resolved'), la validation en
// jeu par Saar reste à faire (AGENTS.md § Clôture).
// Idempotent (skip si déjà noté). Lancement manuel, local, depuis la racine :
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
sur une vraie arme à feu, absence de la grenade dans la liste des cibles modables). Non testé :
scénario réel en navigateur (tentative d'installation depuis l'écran Modding) — à faire par Saar
avant de clore. Détail complet : docs/JOURNAL8.md, docs/SYSTEME/MODING.md §2bis (2026-10-06).`

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: 'GRENADE-ACCEPTS-WEAPON-MODS' }).first()
  if (!ticket) { console.log('[SKIP] GRENADE-ACCEPTS-WEAPON-MODS — ticket introuvable'); return }
  if ((ticket.admin_notes || '').includes(MARKER)) { console.log('[SKIP] GRENADE-ACCEPTS-WEAPON-MODS — déjà noté'); return }
  await db('bug_tickets').where({ id: ticket.id }).update({
    status: 'in_progress',
    admin_notes: `${ticket.admin_notes || ''}\n${NOTE}`.trim(),
    updated_at: db.fn.now(),
  })
  console.log('[OK] GRENADE-ACCEPTS-WEAPON-MODS — note ajoutée, statut -> in_progress')
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
