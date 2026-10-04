// Script à usage unique — note de suivi sur COMBAT-RANGE-PLAYER-EDITABLE : audit complet de
// CombatModifiersWindow.jsx demandé par Saar (« il n'y a pas d'autres champs à régler/harmoniser ? »)
// après les correctifs Portée puis Taille, le même jour (2026-10-04). Idempotent (skip si déjà noté).
// Lancement manuel, local :
//   node --env-file=.env server/src/scripts/note_tickets_20261004_combat_range_player_editable_allure.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-04 (audit) : Allure tireur/cible, Couverture, Obscurité ---'

const NOTE = `

${MARKER}
Audit demandé par Saar après les correctifs Portée/Taille : en élargissant la fenêtre MJ à l'assaut
d'un PJ, Allure tireur, Allure cible, Couverture et Obscurité étaient devenus éditables pour le MJ
en supervision sans qu'aucun n'écrive plus nulle part (même symptôme que Taille avant son propre
correctif).

Hypothèse de départ : traiter Allure comme Taille (canal de surcharge MJ à construire). Corrigée
après lecture du code réel (socketCombatResolution.js, shared/combatSituationMods.js) : contrairement
à taille (GM_ONLY_CONFIRMED_MODIFIER_KEYS, consultée en priorité), l'Allure n'a aucun canal de
surcharge MJ, même latent — le serveur écrase systématiquement l'allure soumise par un joueur avec
celle réellement dérivée du mouvement déclaré, par choix RAW explicite (« un joueur ne peut ni
masquer ni fausser son Allure »). Construire un canal ici aurait été une capacité nouvelle, jamais
demandée, contredisant cette protection.

Décision (validée par Saar) : Allure tireur/cible rejoint Couverture/Obscurité — lecture seule pour
le MJ en supervision, aucun nouveau pouvoir. Seules Portée et Taille gardent COMBAT_RESOLUTION_OVERRIDE.

Correctif : CombatModifiersWindow.jsx (constante gmReadOnlyInOversight, Allure tireur/cible gagnent
la condition !gmReadOnlyInOversight, Couverture/Obscurité remplacées par une note en supervision) +
combat.json (clé modifiers.gmOversightNote). Testé : build, lint (0 nouvelle erreur), shared/**/*.test.mjs
(941/941), les 4 suites DB-backed qui exercent resolveAssaultAction (105/105). Non testé : scénario à
deux clients (docs/BETATEST.md mis à jour). Détail complet : docs/JOURNAL8.md.`

async function run() {
  const code = 'COMBAT-RANGE-PLAYER-EDITABLE'
  const ticket = await db('bug_tickets').where({ linked_bug_code: code }).first()
  if (!ticket) { console.log(`[SKIP] ${code} — ticket introuvable`); return }
  if ((ticket.admin_notes || '').includes(MARKER)) { console.log(`[SKIP] ${code} — déjà noté`); return }
  await db('bug_tickets').where({ id: ticket.id }).update({
    admin_notes: `${ticket.admin_notes || ''}\n${NOTE}`.trim(),
    updated_at: db.fn.now(),
  })
  console.log(`[OK] ${code} — note de suivi ajoutée`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
