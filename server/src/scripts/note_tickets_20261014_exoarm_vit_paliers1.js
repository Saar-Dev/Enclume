// Script à usage unique — note de suivi sur EXOARM-VIT-PALIERS1. Idempotent.
// Lancement manuel, local (Saar — écriture en base, hors autorisation d'auto-lancement de l'agent) :
//   node --env-file=.env server/src/scripts/note_tickets_20261014_exoarm_vit_paliers1.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-14 : correctif codé ---'

const NOTE = `

${MARKER}
Correctif : getExoMovementBudget (server/src/services/movementBudgetService.js) applique désormais
la réduction de Vitesse due aux paliers d'Intégrité Exosquelette (REGLEARMURE.md:566-568), jusqu'ici
absente — seuls l'EXF et le Blindage passaient par cette table (computeExoStats, shared/exoStats.js).
integrityFactor exportée depuis shared/exoStats.js et réutilisée telle quelle (même table, aucune
formule dupliquée), appliquée APRÈS calcAllures (sur les 4 Allures déjà calculées), jamais sur
l'attribut speed en amont — calcAllureMoy est une table par palier conçue pour un attribut humain
(COO) : calcAllureMoy(0) vaut 6, pas 0 ; réduire l'entrée aurait produit une fausse Allure à
Exosquelette détruit au lieu d'une armure immobile. Patron vérifié contre le code source réel de
Eranziel/foundryvtt-lancer (recherche externe) : un modificateur de statut se compose sur la valeur
dérivée déjà calculée, jamais sur un attribut intermédiaire en amont d'une formule — même principe
déjà appliqué dans ce fichier à l'encombrement humain.

Clause Générateur « Vitesse réduite si propulseur dorsal » (REGLEARMURE.md:589-590,595-596) confirmée
hors périmètre par lecture : elle concerne la vitesse du propulseur narratif (speeds_extra),
volontairement non consommée par cette fonction (RAW p.249 : seul le déplacement naturel compte pour
le mouvement de combat) — rien à coder ici.

Testé : node --check (4 fichiers touchés). shared/exoStats.test.mjs 20/20 (2 nouveaux tests sur
integrityFactor). shared/**/*.test.mjs 949/949, aucune régression. movementBudgetService.test.mjs
contre la base locale 8/8 (4 nouveaux tests d'intégration, fixture exo_sheet réelle) couvrant les 3
paliers RAW + Exosquelette détruit (0 Allure valide, pas une erreur — même doctrine que le drone sans
Vitesse déjà testé). Résidu de fixtures vérifié par lecture directe en base après coup : aucun.
git diff --check propre.
Non testé : scénario réel navigateur (survol de déplacement d'une exo-armure endommagée en combat).
Détail complet : docs/JOURNAL8.md.`

async function run() {
  const code = 'EXOARM-VIT-PALIERS1'
  const ticket = await db('bug_tickets').where({ linked_bug_code: code }).first()
  if (!ticket) { console.log(`[SKIP] ${code} — ticket introuvable`); return }
  if ((ticket.admin_notes || '').includes(MARKER)) { console.log(`[SKIP] ${code} — déjà noté`); return }
  await db('bug_tickets').where({ id: ticket.id }).update({
    admin_notes: `${ticket.admin_notes || ''}\n${NOTE}`.trim(),
    status: 'in_progress',
    updated_at: db.fn.now(),
  })
  console.log(`[OK] ${code} — note de suivi ajoutée, statut -> in_progress`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
