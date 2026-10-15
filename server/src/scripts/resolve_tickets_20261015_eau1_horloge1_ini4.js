// Script à usage unique — audit du 2026-10-15 (tickets ouverts/in_progress sans note dont le code
// apparaît déjà dans git log). 3 tickets trouvés, tous des commits de SAAR lui-même, jamais reflétés
// en base :
//   - EAU1 (commit 1ca8f587, 2026-07-29) : le commit dit lui-même "confirmé fonctionnel en jeu par
//     Saar" — preuve écrite suffisante, clôturé en 'resolved' directement.
//   - HORLOGE1 (commit 1b2bfb06, 2026-07-29) : "codé", aucune confirmation en jeu écrite dans le
//     commit — laissé 'in_progress'.
//   - INI4 (commit 08eed26b, 2026-07-19) : "codé, non testé : scénario réel navigateur (aucune
//     connexion PostgreSQL disponible dans cet environnement)" — laissé 'in_progress'.
// Idempotent (skip si déjà noté/résolu). Lancement manuel, local :
//   node --env-file=.env server/src/scripts/resolve_tickets_20261015_eau1_horloge1_ini4.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-15 : audit git log, correctif déjà commité par Saar ---'

async function run() {
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  // EAU1 — preuve écrite de validation en jeu dans le commit lui-même.
  {
    const t = await db('bug_tickets').where({ linked_bug_code: 'EAU1' }).first()
    if (!t) console.log('[SKIP] EAU1 — introuvable')
    else if ((t.admin_notes || '').includes(MARKER)) console.log('[SKIP] EAU1 — déjà noté')
    else {
      const note = `${MARKER}\nCommit 1ca8f587 (Session 185, Saar, 2026-07-29) : retrait de la nappe d'eau ambiante côté client (computeSurfaceWaterCells/WaterSheets supprimés), l'eau visible en jeu passe désormais exclusivement par le mécanisme canonique déjà construit (compartiments + runtimeEffectRegions). Le commit dit explicitement : "confirmé fonctionnel en jeu par Saar". Détail : docs/SYSTEME/SURFACES_SALLES.md.`
      await db('bug_tickets').where({ id: t.id }).update({
        status: 'resolved', reviewed_by: admin.id, reviewed_at: db.fn.now(),
        admin_notes: `${t.admin_notes || ''}\n\n${note}`.trim(), updated_at: db.fn.now(),
      })
      console.log('[OK] EAU1 -> resolved')
    }
  }

  // HORLOGE1 — codé par Saar, pas de confirmation écrite trouvée.
  {
    const t = await db('bug_tickets').where({ linked_bug_code: 'HORLOGE1' }).first()
    if (!t) console.log('[SKIP] HORLOGE1 — introuvable')
    else if ((t.admin_notes || '').includes(MARKER)) console.log('[SKIP] HORLOGE1 — déjà noté')
    else {
      const note = `${MARKER}\nCommit 1b2bfb06 (Session 186, Saar, 2026-07-29) : Horloge de campagne (GameTimeWidget) masquée en mode Combat et Édition, gate sur la prop mode déjà disponible dans Sidebar.jsx. Aucune confirmation de validation en jeu écrite dans le commit — reste in_progress tant que Saar ne confirme pas.`
      await db('bug_tickets').where({ id: t.id }).update({
        status: 'in_progress',
        admin_notes: `${t.admin_notes || ''}\n\n${note}`.trim(), updated_at: db.fn.now(),
      })
      console.log('[OK] HORLOGE1 -> in_progress (note ajoutée)')
    }
  }

  // INI4 — codé par Saar, le commit dit lui-même "non testé : scénario réel navigateur".
  {
    const t = await db('bug_tickets').where({ linked_bug_code: 'INI4' }).first()
    if (!t) console.log('[SKIP] INI4 — introuvable')
    else if ((t.admin_notes || '').includes(MARKER)) console.log('[SKIP] INI4 — déjà noté')
    else {
      const note = `${MARKER}\nCommit 08eed26b (Session 166, Saar, 2026-07-19, cluster COMPARATIF) : reset de l'initiative à base_ini ajouté à endTurn. Le commit dit lui-même "Non testé : scénario réel navigateur (aucune connexion PostgreSQL disponible dans cet environnement)" — reste in_progress tant que Saar ne confirme pas.`
      await db('bug_tickets').where({ id: t.id }).update({
        status: 'in_progress',
        admin_notes: `${t.admin_notes || ''}\n\n${note}`.trim(), updated_at: db.fn.now(),
      })
      console.log('[OK] INI4 -> in_progress (note ajoutée)')
    }
  }
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
