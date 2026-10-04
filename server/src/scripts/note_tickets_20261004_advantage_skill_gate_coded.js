// Script à usage unique — note sur CHARSHEET-ADVANTAGE-SKILL-GATE et CHARSHEET-SKILL-PREREQ-HIDDEN
// après le correctif codé le 2026-10-04 (session de correction de bugs). Statut 'in_progress' (pas
// 'resolved') : codé et testé en isolation, pas encore validé en navigateur par Saar.
// Idempotent (skip si déjà noté). Lancement manuel, local :
//   node --env-file=.env server/src/scripts/note_tickets_20261004_advantage_skill_gate_coded.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-04 : correctif codé ---'

const NOTE = `

${MARKER}
Cause racine trouvée : les 50 Pouvoirs Polaris individuels (enfants de la catégorie
POUVOIRS_POLARIS) n'ont aucun prérequis à eux — seule la catégorie exige SKILL_MIN(Maîtrise de la
Force Polaris), qui exige elle-même l'Avantage adv_079. Ni le client ni POST /skills/buy ne
remontaient cette chaîne. Corrigé (partagé client/serveur, shared/skillRequirements.js :
effectiveRequirements + isBlockedByIdentityChain) : masque uniquement sur un verrou Avantage/
Mutation/Génotype, jamais sur un simple prérequis de compétence (Informatique → Culture générale),
désormais affiché verrouillé avec le prérequis manquant au lieu d'être masqué. Testé par
node --test (14/14 + 941/941 shared, aucune régression), eslint, vite build. Non testé : achat réel
en navigateur (Onde Polaris sans/avec l'Avantage, Cartographie sans Culture générale) — Saar peut
le reproduire seul. Détail complet : docs/JOURNAL8.md, commit e6da0d82.`

async function run() {
  for (const code of ['CHARSHEET-ADVANTAGE-SKILL-GATE', 'CHARSHEET-SKILL-PREREQ-HIDDEN']) {
    const ticket = await db('bug_tickets').where({ linked_bug_code: code }).first()
    if (!ticket) { console.log(`[SKIP] ${code} — ticket introuvable`); continue }
    if ((ticket.admin_notes || '').includes(MARKER)) { console.log(`[SKIP] ${code} — déjà noté`); continue }
    await db('bug_tickets').where({ id: ticket.id }).update({
      status: 'in_progress',
      admin_notes: `${ticket.admin_notes || ''}\n${NOTE}`.trim(),
      updated_at: db.fn.now(),
    })
    console.log(`[OK] ${code} — note ajoutée, statut -> in_progress`)
  }
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
