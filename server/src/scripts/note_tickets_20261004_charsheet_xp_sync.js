// Script à usage unique — note sur CHARSHEET-XP-SYNC-PJMJ après le correctif codé le 2026-10-04
// (session de correction de bugs). Statut 'in_progress' (pas 'resolved') : codé et testé en
// isolation (build, lint, tests partagés), pas encore validé avec un vrai second client (scénario
// ajouté à docs/BETATEST.md). Idempotent (skip si déjà noté). Lancement manuel, local :
//   node --env-file=.env server/src/scripts/note_tickets_20261004_charsheet_xp_sync.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-04 : correctif codé ---'

const NOTE = `

${MARKER}
Cause racine trouvée : dans char-sheet.js, toutes les routes de mutation avant la section
Blessures (identité, archétype, attributs, achat PC d'attribut, compétences, Pouvoirs Polaris,
achat de compétence, Chance, XP, avantages, notes « Autres », mutations — 15 routes) n'émettaient
rien — contrairement aux routes à partir de Blessures (WOUND_*/INVENTORY_*/SOLS_UPDATED/
GAUGE_UPDATED) qui diffusent déjà correctement. Un MJ et un joueur sur la même fiche en même temps
voyaient des valeurs différentes jusqu'à fermer/rouvrir la fenêtre.

Recherche demandée par Saar (« comment font les pros ? ») avant de coder : le premier jet (un seul
événement signal + refetch complet, patron MAP_UPDATED du même jour) a été écarté après relecture —
ce fichier résout déjà ce problème 3 fois différemment (SOLS_UPDATED, GAUGE_UPDATED,
FATIGUE_TEST_RESULT), un payload direct portant la valeur déjà calculée par la réponse REST, jamais
un refetch complet (qui aurait écrasé un champ texte en cours de frappe ailleurs sur la même
fiche). C'est aussi le patron standard pour ce problème (Firestore field-level, GraphQL à delta).

Corrigé : 11 événements CHAR_* ciblés (shared/events.js), émis par une fonction partagée
(notifyCharSheetEvent, char-sheet.js, 17 points d'émission aux 15 routes) qui réutilise
resolveInventoryBroadcastRoom (déjà existant pour l'inventaire, COFFRE-INVROOM1) pour ne jamais
diffuser un brouillon Wizard à toute la campagne. Écouté par CharacterSheet.jsx (champs locaux) et
AdvantagesPanel.jsx (sa propre copie de charMutations/advantageNotes, duplication préexistante non
introduite ni consolidée ici). Testé : node --check, eslint ciblé (0 erreur nouvelle), vite build,
shared/**/*.test.mjs (941/941). Non testé : scénario réel à deux clients simultanés — ajouté à
docs/BETATEST.md, nécessite plusieurs clients que Saar ne peut pas réunir seul. Hors périmètre
noté : PossessionNotes.jsx (Wizard, catégorie possession) n'a pas cette écoute — gap distinct,
chantier Wizard-collab déjà clos séparément. Détail complet : docs/JOURNAL8.md,
docs/SYSTEME/ARCHITECTURE_SOCKET.md, docs/SYSTEME/CHARACTER.md.`

async function run() {
  const code = 'CHARSHEET-XP-SYNC-PJMJ'
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
