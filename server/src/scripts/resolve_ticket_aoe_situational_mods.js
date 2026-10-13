// Script à usage unique — clôture le ticket « Zone d'effet (AOE) — modificateurs situationnels à
// nettoyer (taille + allure) » (pas de linked_bug_code, créé par note_ticket_aoe_situational_mods.js
// — recherche par titre, comme la création). Détail complet : JOURNAL8.md, session du 2026-10-13.
// Validé en jeu réel par Saar le 2026-10-13.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/resolve_ticket_aoe_situational_mods.js

import db from '../db/knex.js'

const TITLE = 'Zone d\'effet (AOE) — modificateurs situationnels à nettoyer (taille + allure)'

async function run() {
  const ticket = await db('bug_tickets').where({ title: TITLE }).first()
  if (!ticket) throw new Error(`Ticket "${TITLE}" introuvable.`)
  if (ticket.status === 'resolved') { console.log('Déjà résolu.'); return }
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : clôturé, validé en jeu réel par Saar ---\n' +
    'Fix A (serveur) : runAoePhaseA (socketCombatAoe.js) filtre désormais les clés situationnelles ' +
    '"cible_*" (même filtre déjà en place pour le jet de lancer de grenade, throwerSituation). ' +
    'Fix B (client) : CombatModifiersWindow.jsx masque les sections Allure cible et Taille en zone ' +
    'd\'effet (même garde que Portée) et neutralise leur contribution au total affiché. Détection ' +
    'isAoeAction (3e volet du ticket) laissée en l\'état : semble déjà correcte ' +
    '(buildDeclarePayload.js n\'attache aoe que sur visée explicite), aucune repro trouvée. Détail ' +
    'complet : docs/JOURNAL8.md, session du 2026-10-13.'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'resolved',
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
