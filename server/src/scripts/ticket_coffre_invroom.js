// Script à usage unique (patron importBugIdentifie.js) — un seul ticket, trouvé en auditant
// resolveInventoryBroadcastRoom (char-sheet.js) pendant le chantier Coffre (docs/EN_COURS.md,
// 2026-08-16). Idempotent via linked_bug_code, ré-exécutable sans doublon.
//
// Lancement manuel : node --env-file=.env server/src/scripts/ticket_coffre_invroom.js

import db from '../db/knex.js'

const CODE = 'COFFRE-INVROOM1'

async function run() {
  const existing = await db('bug_tickets').where({ linked_bug_code: CODE }).first('id')
  if (existing) {
    console.log(`Ticket ${CODE} déjà présent (id=${existing.id}) — rien à faire.`)
    return
  }

  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé — bootstrap requis avant création du ticket.')

  const [ticket] = await db('bug_tickets').insert({
    reporter_id: admin.id,
    origin: 'admin',
    category: 'bug',
    linked_bug_code: CODE,
    domain: 'personnage',
    title: 'resolveInventoryBroadcastRoom replie vers une room "wizard:" inobservée pour un Coffre-natif direct',
    description:
      'resolveInventoryBroadcastRoom (server/src/routes/character/char-sheet.js) replie vers ' +
      '`wizard:${sheet.id}` dès que char_sheet.wizard_locked_at est NULL — pensé pour le Wizard ' +
      'collaboratif (un MJ observe un brouillon en session). Le chantier Coffre (docs/EN_COURS.md, ' +
      '2026-08-16) rend un personnage "direct" (construit à la main, sans Wizard) NULL en permanence ' +
      'par conception : ses routes inventaire (POST/PUT/reload/quick-equip) répliqueront donc ' +
      'systématiquement vers cette room "wizard:" que personne n\'observe. Pas un crash (room sans ' +
      'socket, emit silencieux), mais l\'auteur de l\'action ne reçoit jamais la confirmation par ' +
      'retour socket de son propre changement — défaut de rafraîchissement temps réel probable côté ' +
      'InventoryPanel.jsx pour un personnage du Coffre. Trouvé par audit de code, pas encore reproduit ' +
      'en navigateur (aucun outil de création directe Coffre-native codé à ce jour).',
    status: 'triaged',
    priority: 'low',
    cluster_label: 'Coffre',
    admin_notes:
      'Différé volontairement : aucune route inventaire touchée par le Lot 1 (char-sheet.js, ' +
      'isVaultOwner) — pertinent seulement quand le chantier Coffre attaquera l\'inventaire/' +
      'quick-equip pour un personnage direct. PUT /sols avait le même défaut en pire (room=NULL au ' +
      'lieu de "wizard:...", corrigé au Lot 1 : emit conditionné à campaign_id non NULL).',
  }).returning(['id'])

  console.log(`Ticket ${CODE} créé (id=${ticket.id}).`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
