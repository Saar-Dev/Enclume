// Crée un ticket pour un bug signalé par Saar (2026-09-17) pendant le test de
// PLAN_DIFFICULTE_INTERACTIONS_ENTITES.md L1/L2 : le changement de couleurs du modèle 3D (section
// "Apparence", EntityInstancePanel.jsx) ne fonctionne pas. Sans lien avec ce chantier (Difficulté)
// — code de ce chantier vérifié non touché (git diff 6b3bacc..HEAD sur EntityInstancePanel.jsx, la
// section Apparence/updateMaterialSlot/clearMaterialSlot n'a aucun hunk). Pas d'hypothèse de cause
// posée ici, faute de repro/lecture de code dédiée (hors périmètre de la session en cours) —
// juste noté pour ne pas perdre la trouvaille (feedback_note_or_fix_every_finding).
//
// Idempotent (skip si un ticket au titre identique existe déjà).
//
// Lancer depuis la racine : node --env-file=.env server/src/scripts/note_ticket_entity_material_color_broken_20260917.js

import db from '../db/knex.js'

const TITLE = 'Entité — changement de couleur du modèle 3D (Apparence) sans effet'
const REPORTER_ID = 'aba6a66b-9cfd-4909-951b-9971ccee402f' // même reporter que les tickets auto-notés existants

async function main() {
  const existing = await db('bug_tickets').where({ title: TITLE }).first()
  if (existing) {
    console.log('[SKIP] ticket déjà présent :', existing.id)
    await db.destroy()
    return
  }

  await db('bug_tickets').insert({
    reporter_id: REPORTER_ID,
    origin: 'admin',
    category: 'bug',
    domain: 'editeur',
    title: TITLE,
    description: `Signalé par Saar (2026-09-17) en testant PLAN_DIFFICULTE_INTERACTIONS_ENTITES.md (L1/L2, sans
lien de cause avec ce chantier) : dans EntityInstancePanel.jsx, section "Apparence" (slots
matériau GLB, updateMaterialSlot/clearMaterialSlot), changer une couleur n'a aucun effet visible.

Vérifié : le code de ce chantier ne touche pas cette section (git diff 6b3bacc..HEAD sur
EntityInstancePanel.jsx — aucun hunk sur materialOverrides/updateMaterialSlot/le rendu Apparence).
Bug pré-existant ou révélé à cette occasion, pas de diagnostic fait (pas de repro ni lecture de
code menée dans cette session — hors périmètre du plan en cours).

À faire : reproduire (quel type de blueprint — GLB avec materialSlots, quelle entité), puis lire
modelMaterialSlots.js (setMaterialSlotOverride/materialSlotDisplayValue) et EntityMesh.jsx (lecture
de state.materialOverrides à l'affichage) avant tout correctif.`,
    status: 'new',
  })
  console.log('[OK] ticket créé')
  await db.destroy()
}

main().catch(err => {
  console.error('ERREUR', err)
  process.exit(1)
})
