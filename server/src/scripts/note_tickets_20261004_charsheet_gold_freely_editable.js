// Script à usage unique — note sur CHARSHEET-GOLD-FREELY-EDITABLE après le correctif codé le
// 2026-10-04 (session de correction de bugs). Statut 'in_progress' (pas 'resolved') : codé, lint,
// build et tests de service passés, pas encore vérifié en navigateur par Saar. Idempotent (skip
// si déjà noté). Lancement manuel, local :
//   node --env-file=.env server/src/scripts/note_tickets_20261004_charsheet_gold_freely_editable.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-04 : correctif codé ---'

const NOTE = `

${MARKER}
Cause racine trouvée : PUT /char-sheet/:id/sols ne bloquait qu'une AUGMENTATION par un non-MJ,
jamais une diminution — un joueur pouvait dépenser son or en tapant directement un nombre plus
petit, sans passer par tradeService.js (seule autorité réelle sur char_sheet.sols, jamais appelée
par cette route). Vérification demandée par Saar (« est-ce que ça aggrade ? ») avant de coder :
audit exhaustif du reste du fichier pour la même classe de défaut, qui a trouvé 3 autres trous :
- PUT /chc (Chance) : AUCUNE garde du tout (pire que sols) — un joueur pouvait poser sa Chance à
  n'importe quelle valeur 1-20, contournant le plancher RAW (3) et le plafond (20) de
  chanceService.js (« autorité unique des mutations char_sheet.chc »).
- DELETE /advantages/:id : aucune garde, alors que sa sœur POST (l'octroi) est déjà MJ-only — un
  joueur pouvait retirer lui-même un Désavantage narratif sans accord du MJ.
- PUT /archetype : aucune garde, et ce champ inclut genotype_id qui modifie les attributs dérivés
  (NA) — un joueur pouvait changer son génotype après la création, avec un effet mécanique réel.

Corrigé : 4 gardes serveur !req.isGm && !req.isVaultOwner ajoutées (sols : toute valeur désormais ;
chc : nouvelle garde complète ; advantages DELETE : symétrique de son POST ; archetype : seulement
si genotype_id présent dans le body — âge/sexe/origine/formation restent narratifs, non gardés,
décision confirmée par Saar). Côté client, nouveau flag dérivé isGmOrVaultOwner
(CharacterWindow.jsx) propagé à CharacterSheet.jsx/AdvantagesPanel.jsx/InventoryBanner.jsx, qui
remplace canEdit/isGm sur ces 4 affordances précises.

Testé : node --check, eslint ciblé (0 erreur nouvelle), vite build, node --test sur
chanceService/advantageService/chanceCatastropheChoiceService (25/25, services eux-mêmes non
modifiés). Non testé : scénario réel en navigateur (un joueur ne peut plus éditer sols/Chance/
génotype ni retirer un avantage ; le MJ le peut toujours) — un seul client suffit, pas besoin de
docs/BETATEST.md. Détail complet : docs/JOURNAL8.md, docs/SYSTEME/CHARACTER.md §1.`

async function run() {
  const code = 'CHARSHEET-GOLD-FREELY-EDITABLE'
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
