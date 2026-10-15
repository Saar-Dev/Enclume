// Script à usage unique — clôture le ticket sans linked_bug_code "Playground : le joueur peut créer
// un item catalogue sans coût (même pouvoir que Wizard Step6)" (session du 2026-10-15). Saar a
// validé le scénario réel navigateur (bouton visible MJ only sur une fiche PJ, absent sur une fiche
// PNJ, bascule effective) le jour même — clôturé en 'resolved' directement.
// Idempotent (skip si déjà noté). Lancement manuel, local, depuis la racine :
//   node --env-file=.env server/src/scripts/note_ticket_playground_item_no_cost.js

import db from '../db/knex.js'

const TITLE = 'Playground : le joueur peut créer un item catalogue sans coût (même pouvoir que Wizard Step6)'
const MARKER = '--- 2026-10-15 : correctif codé ---'

const NOTE = `

${MARKER}
Cause confirmée par lecture : InventoryPanel.jsx est le même composant en Wizard Step6
(inWizard=true, flux "confiance" explicitement décidé, docs/Old/PLAN_WIZARD_MATERIEL_GAUGES.md §0 —
ajout libre, MJ valide ou supprime) et sur la fiche permanente en session (inWizard=false). Côté
serveur, POST /char-sheet/:id/inventory dérivait autoValidate (donc chargeAtAdd) uniquement de
req.isGm/campaign_id==null — rien ne distinguait un personnage encore en création d'un personnage
verrouillé et lancé en session. validated_by_gm n'est jamais lu comme condition d'usage/équipement
nulle part : un objet en attente est déjà pleinement fonctionnel, payé ou non.

Décision de Saar (le plus simple) : bouton MJ only sur InventoryPanel.jsx, visible seulement sur une
fiche PJ (jamais PNJ), mode « achat gratuit » (argent illimité/achat gratuit) par personnage joueur —
pas de blocage strict ni de débit silencieux.

Corrigé : migration 392+393 (char_sheet.free_purchase_mode, additive — 393 renomme la colonne du nom
provisoire picsou_mode vers un nom plus sérieux, même session) ; _chargeSols (inventoryService.js,
autorité unique du débit) lit désormais ce réglage ; nouvelle fonction testée resolveAutoValidate
étend autoValidate à "personnage verrouillé (wizard_locked_at posé) ET en campagne" — un achat payé
en session est donc aussi auto-validé (plus de double débit possible par construction, voir
JOURNAL8.md pour l'erreur de plan initiale corrigée en analyse à charge) ; nouvelle route PUT
/char-sheet/:id/free-purchase-mode (MJ only) + événement CHAR_FREE_PURCHASE_MODE_UPDATED ; store/hook/
socket client en miroir du patron sols existant ; bouton .btn-toggle MJ only (isGm && !inWizard &&
isPj, character.type === 'pj' passé par CharacterWindow.jsx).

Testé : eslint/node --check (0 erreur), build client (succès), node --env-file=.env --test
inventoryService.test.mjs 43/43 (6 tests neufs, zéro régression). Validé en jeu réel par Saar le
2026-10-15 (bouton visible MJ only sur une fiche PJ, absent sur une fiche PNJ, bascule effective).
Détail complet : docs/JOURNAL8.md (2026-10-15).`

async function run() {
  const ticket = await db('bug_tickets').where({ title: TITLE }).first()
  if (!ticket) { console.log('[SKIP] ticket introuvable (titre exact)'); return }
  if ((ticket.admin_notes || '').includes(MARKER)) { console.log('[SKIP] déjà noté'); return }
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')
  await db('bug_tickets').where({ id: ticket.id }).update({
    status: 'resolved',
    reviewed_by: admin.id,
    reviewed_at: db.fn.now(),
    admin_notes: `${ticket.admin_notes || ''}\n${NOTE}`.trim(),
    updated_at: db.fn.now(),
  })
  console.log(`[OK] ticket (id=${ticket.id}) — note ajoutée, statut -> resolved`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
