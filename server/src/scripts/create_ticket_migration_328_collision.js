// Script à usage unique — crée le ticket MIGRATION-328-COLLISION.
// Lancement : node --env-file=.env server/src/scripts/create_ticket_migration_328_collision.js
// Idempotent : ne recrée pas si linked_bug_code existe déjà.

import db from '../db/knex.js'

const CODE = 'MIGRATION-328-COLLISION'

const DESCRIPTION = `
Deux fichiers de migration portent le numéro 328 sur dev/Saar (travail parallèle non resynchronisé,
piège P53) :
- server/src/db/migrations/328_characters_clear_size_category.js  (chantier « Mode modificateurs de
  combat », commit e95c9d4 — supprime characters.size_category)
- server/src/db/migrations/328_ref_equipment_grenade_energy_aoe_profile.js  (chantier grenades 3-bis,
  commit 7f3e9f7 — pose ref_equipment.aoe_profile sur « Grenade à énergie »)

Les deux sont poussées + appliquées. Fonctionnellement OK : tables distinctes (characters vs
ref_equipment), toutes deux idempotentes, knex les traite comme 2 migrations séparées (tri par nom
complet — « characters » avant « ref_equipment »), les 2 lignes sont dans knex_migrations.

Convention P55 violée (« un numéro = une migration »). NE PAS renommer : les 2 sont poussées et
appliquées (P54 — jamais retoucher une migration appliquée).

À faire : rien d'urgent. Prochaine migration = 329+ ; vérifier ls migrations/ ET knex_migrations
avant de figer un numéro (P53). Éventuellement, à la prochaine consolidation de migrations, fusionner
la numérotation. Documenté : docs/ROADMAP.md §2, docs/PLANS/PLAN_GRENADES.md §6, docs/JOURNAL8.md
(session 2026-09-09).
`.trim()

async function run() {
  const existing = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (existing) {
    console.log(`Ticket ${CODE} existe déjà (id=${existing.id}, statut=${existing.status}) — rien à faire.`)
    return
  }
  const [row] = await db('bug_tickets')
    .insert({
      origin: 'admin',
      category: 'other',
      domain: 'infra-migrations',
      title: 'Collision de numéro de migration 328 (travail parallèle)',
      description: DESCRIPTION,
      context: JSON.stringify({
        files: [
          '328_characters_clear_size_category.js (e95c9d4)',
          '328_ref_equipment_grenade_energy_aoe_profile.js (7f3e9f7)',
        ],
        impact: 'cosmétique — 2 migrations indépendantes, idempotentes, appliquées',
        action: 'aucune urgente ; prochaine migration 329+ ; vérifier knex_migrations avant (P53)',
      }),
      status: 'triaged',
      priority: 'low',
      linked_bug_code: CODE,
    })
    .returning(['id', 'status', 'priority'])
  console.log(`Ticket ${CODE} créé : id=${row.id}, statut=${row.status}, priorité=${row.priority}.`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
