// Script à usage unique — crée le ticket « modificateurs situationnels de zone d'effet à nettoyer »
// (constats 2026-09-09, chantier Mode modificateurs de combat / D7).
// Lancement manuel : node --env-file=.env server/src/scripts/note_ticket_aoe_situational_mods.js

import db from '../db/knex.js'

async function run() {
  const title = 'Zone d\'effet (AOE) — modificateurs situationnels à nettoyer (taille + allure)'
  const existing = await db('bug_tickets').where({ title }).first()
  if (existing) {
    console.log(`Ticket déjà présent (${existing.id}) — rien à faire.`)
    return
  }

  const [row] = await db('bug_tickets')
    .insert({
      origin: 'gm',
      category: 'bug',
      domain: 'combat',
      title,
      description:
        'À traiter avec D7 (retrait du modificateur de taille en zone d\'effet, docs/PLANS/PLAN_TAILLE.md) ' +
        'et/ou le refacto de socketCombatAoe.js.\n\n' +
        '1. runAoePhaseA (socketCombatAoe.js) lit confirmedModifiers.situation. La fenêtre AOE envoie ' +
        'cible_immobile (+3) en dur pour un tir de zone : target_token_id est null → la détection ' +
        'client d\'allure cible retourne "cible_immobile". Un jet unique couvre tout le cône, il ne ' +
        'peut pas porter une taille/allure par cible (même parti que la grenade).\n\n' +
        '2. isAoeAction (CombatModifiersWindow.jsx = !!assaultAction.modifiers.aoe) est truthy pour un ' +
        'tir de zone tiré en cible unique (l\'arme porte son profil aoe même hors mode gerbe) → la ' +
        'section Portée est masquée à tort et l\'allure a longtemps été laissée éditable (corrigé côté ' +
        'éditabilité, mais la détection de "vrai tir de zone" reste bancale). Distinguer ' +
        'modifiers.aoe (profil de l\'arme) de "cette action EST un tir de zone" (modifiers.aoe.mode / ' +
        'isAoeMode côté annonce).\n\n' +
        'Décision d\'architecture : l\'AOE n\'applique AUCUN modificateur situationnel par cible ' +
        '(taille, allure). Le retirer de runAoePhaseA + de la fenêtre AOE.',
      status: 'new',
      priority: 'medium',
      context: JSON.stringify({ chantier: 'PLAN_MODE_MODIFICATEURS_COMBAT.md / D7', fichiers: ['server/src/socket/socketCombatAoe.js', 'client/src/components/CombatModifiersWindow.jsx'] }),
    })
    .returning(['id'])

  console.log(`Ticket créé : ${row.id}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
