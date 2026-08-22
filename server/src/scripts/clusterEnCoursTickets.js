// Script à usage unique — regroupe sous un cluster_label les tickets migrés par
// importEnCoursDettes.js qui partagent une cause/mécanique racine commune (repérés lors du tri
// demandé par Saar le 2026-08-22 : "Tri des bugs en cluster... puis sélection d'un cluster/bug
// dans l'ordre décroissant de criticité"). Ré-exécutable sans doublon : ne touche que les lignes
// dont cluster_label est encore NULL pour le code visé (ne casse jamais un label déjà posé
// manuellement dans /admin/tickets).
//
// Regroupements retenus (mécanique/feature racine identique, pas juste même domaine) :
//  - Blessure mortelle : WNDMORT + WNDMORT-UI + WNDMORT-HORSCOMBAT
//  - Initiative        : INI1 + INI2 + INI4 + INI5
//  - Marqueur compétence (X)/(-3) : WIZ38 (dépend explicitement de WIZ39) + WIZ39
//  - Step6 Matériel (wizard)      : WIZ40 + WIZ41 + WIZ42 + WIZ44
//  - Diffusion live MJ→PJ (wizard) : WIZ11 + WIZ32 + WIZ33 + WIZ34
//
// Lancement manuel : node --env-file=.env server/src/scripts/clusterEnCoursTickets.js

import db from '../db/knex.js'

const GROUPS = [
  { label: 'Blessure mortelle', codes: ['WNDMORT', 'WNDMORT-UI', 'WNDMORT-HORSCOMBAT'] },
  { label: 'Initiative', codes: ['INI1', 'INI2', 'INI4', 'INI5'] },
  { label: 'Marqueur compétence (X)/(-3)', codes: ['WIZ38', 'WIZ39'] },
  { label: 'Step6 Matériel (wizard)', codes: ['WIZ40', 'WIZ41', 'WIZ42', 'WIZ44'] },
  { label: 'Diffusion live MJ→PJ (wizard)', codes: ['WIZ11', 'WIZ32', 'WIZ33', 'WIZ34'] },
]

let updated = 0
let skipped = 0

for (const { label, codes } of GROUPS) {
  for (const code of codes) {
    const n = await db('bug_tickets')
      .where({ linked_bug_code: code })
      .whereNull('cluster_label')
      .update({ cluster_label: label })
    if (n > 0) updated += n
    else skipped += 1
  }
}

console.log(`cluster_label posé sur ${updated} ticket(s), ${skipped} déjà labellisé(s) ou introuvable(s) — ignoré(s).`)
process.exit(0)
