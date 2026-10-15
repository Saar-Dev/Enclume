// Script à usage unique, ALIMENTÉ PROGRESSIVEMENT — audit du 2026-10-15 (lecture du code réel,
// demande explicite de Saar) : tickets vérifiés et trouvés PAS corrigés malgré une note existante
// qui le laissait croire. Statut laissé tel quel (ne jamais passer en 'resolved' pour un bug réel) —
// seule une note factuelle "Non corrigé à <date>" est ajoutée, pour que le prochain agent ne
// reparte pas de zéro sur le diagnostic (déjà fait ici).
// Idempotent (skip par entrée déjà notée). Lancement manuel, local :
//   node --env-file=.env server/src/scripts/note_tickets_20261015_audit_not_fixed.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-15 : vérifié par lecture du code réel — NON CORRIGÉ ---'

// { code, note } — preuve factuelle (fichier/ligne/requête), jamais une supposition.
const NOT_FIXED = [
  {
    code: 'MUT-SRC-UNIQ1',
    note: "Vérifié en base réelle (pg_indexes) : uq_char_mut_no_sub = (char_sheet_id, mutation_id) WHERE subtype_id IS NULL — `source` n'est PAS dans la contrainte (migration 115_char_mutations_constraints.js, aucune migration ultérieure ne la touche). Un personnage ne peut toujours pas avoir la même mutation depuis deux sources différentes (ex. chosen + revers) : le second insert serait rejeté. Bug réel, pas un oubli de clôture.",
  },
  {
    code: 'WIZ29',
    note: "Pas corrigé — le commit 86b86b8c dit lui-même : « Pour l'écran blanc signalé au même endroit (cause non identifiée en lecture statique), un ErrorBoundary est posé... reste ouvert (WIZ29) en attente de repro. » Seul un filet de sécurité existe (logue la stack au lieu de vider l'écran) ; la cause racine n'a jamais été trouvée. Vérifié : ErrorBoundary toujours en place autour du corps des étapes Wizard, mais ça n'est pas un correctif de ce ticket.",
  },
  {
    code: 'TEXTUREPACKS-IMPORT-ERROR-OBJECT',
    note: "PARTIELLEMENT corrigé seulement. Le correctif du 2026-10-13 (commit 9b31958e) a été appliqué à client/src/pages/TexturePacksPage.jsx — qui s'est avéré être du code déjà mort (remplacé depuis longtemps par WorkshopPage.jsx, supprimé le 2026-10-14 par le chantier Purge Voxel Lot 4, commit 7ac47943) : le correctif a disparu avec le fichier mort, jamais appliqué à la vraie page. Vérifié : WorkshopPage.jsx (6 sites, ex. ligne 97/121/134/147/157) utilise encore err.response?.data?.error || ... — or errorHandler.js:7-9 renvoie error comme un OBJET {status, message, i18nKey?}, jamais une chaîne : [object Object] s'affiche toujours en pratique. apiError.js#extractErrorMessage (déjà correct, lit .error.message) existe mais n'est importé nulle part dans WorkshopPage.jsx. Volet serveur (export Content-Disposition assaini, texture-packs.js:321-325) reste lui bien en place et correct, indépendant de la page. Reste à corriger : appliquer extractErrorMessage aux 6 sites de WorkshopPage.jsx.",
  },
]

async function run() {
  for (const { code, note } of NOT_FIXED) {
    const t = await db('bug_tickets').where({ linked_bug_code: code }).first()
    if (!t) { console.log(`[SKIP] ${code} — introuvable`); continue }
    if ((t.admin_notes || '').includes(MARKER)) { console.log(`[SKIP] ${code} — déjà noté`); continue }
    await db('bug_tickets').where({ id: t.id }).update({
      admin_notes: `${t.admin_notes || ''}\n\n${MARKER}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    console.log(`[OK] ${code} — note "non corrigé" ajoutée, statut inchangé (${t.status})`)
  }
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
