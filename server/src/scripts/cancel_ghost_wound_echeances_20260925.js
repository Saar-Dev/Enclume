// Script à usage unique — annule les échéances de guérison / d'infection « fantômes » : leur blessure (`payload.woundId`) n'existe plus
// (supprimée par /heal, un retrait du MJ, une promotion, une réduction de la Chance…) mais l'échéance est restée vivante et s'affiche
// sans blessure dans l'écran de revue MJ (ticket WOUND-ECHEANCE-GHOSTS, docs/PLANS/PLAN_REVUE_GUERISON.md §5 Lot 0 / §9 A6).
// Nettoyage des DONNÉES existantes seulement : la cause (le cycle de vie de l'échéance) se corrige dans le code, Lot 0.
//
// Lancement manuel, local, depuis la racine :
//   node --env-file=.env server/src/scripts/cancel_ghost_wound_echeances_20260925.js            (rapport seul — n'écrit RIEN)
//   node --env-file=.env server/src/scripts/cancel_ghost_wound_echeances_20260925.js --apply    (annule, dans UNE transaction)
// Écrit dans la base locale (`game_echeances`) avec --apply — à lancer par Saar.
// Garanties : ne touche que des échéances vivantes (active / pending_mj_review / awaiting_player_roll) dont la blessure est absente ; passe
// leur statut à `cancelled` (statut déjà prévu par la contrainte, traçable — aucune ligne supprimée) ; REFUSE toute campagne qui a une
// avance de temps en attente (annule d'abord l'avance dans l'écran de revue) ; idempotent (une 2ᵉ exécution ne trouve plus rien).

import db from '../db/knex.js'

const WOUND_TYPES = ['wound_healing_check', 'wound_infection_check']
const LIVE_STATUSES = ['active', 'pending_mj_review', 'awaiting_player_roll']
const apply = process.argv.includes('--apply')

async function findGhosts(trx) {
  return trx('game_echeances as e')
    .join('campaigns as c', 'c.id', 'e.campaign_id')
    .whereIn('e.condition_type', WOUND_TYPES)
    .whereIn('e.status', LIVE_STATUSES)
    .whereRaw("e.payload->>'woundId' is not null")
    .whereRaw("not exists (select 1 from character_wounds w where w.id::text = e.payload->>'woundId')")
    .select('e.id', 'e.campaign_id', 'e.condition_type', 'e.status', 'c.name as campaign_name', 'c.pending_advance_delta_minutes as pending_advance')
}

function summarize(rows) {
  const groups = new Map()
  for (const r of rows) {
    const key = `${r.campaign_name} | ${r.condition_type} | ${r.status}`
    groups.set(key, (groups.get(key) ?? 0) + 1)
  }
  return [...groups.entries()].map(([label, count]) => ({ groupe: label, echeances: count }))
}

async function run() {
  await db.transaction(async (trx) => {
    const ghosts = await findGhosts(trx)
    console.log(`Échéances fantômes trouvées : ${ghosts.length}`)
    if (ghosts.length > 0) console.table(summarize(ghosts))
    if (ghosts.length === 0) return

    const blocked = ghosts.filter(g => g.pending_advance !== null)
    const blockedCampaigns = [...new Set(blocked.map(g => g.campaign_name))]
    const cancellable = ghosts.filter(g => g.pending_advance === null)

    if (blockedCampaigns.length > 0) {
      console.log(`⚠️  Avance de temps EN ATTENTE sur : ${blockedCampaigns.join(', ')} — ${blocked.length} échéance(s) intouchées.`)
      console.log('    Annule d\'abord l\'avance (bouton « Annuler » de l\'écran de revue), puis relance ce script.')
    }
    if (!apply) {
      console.log(`Rapport seul (aucune écriture). ${cancellable.length} échéance(s) seraient annulées avec --apply.`)
      return
    }
    if (cancellable.length === 0) {
      console.log('Rien à annuler pour l\'instant.')
      return
    }

    const cancelled = await trx('game_echeances')
      .whereIn('id', cancellable.map(g => g.id))
      .whereIn('status', LIVE_STATUSES)
      .update({ status: 'cancelled', updated_at: trx.fn.now() })
    console.log(`Annulées : ${cancelled} échéance(s) (statut « cancelled »).`)
  })
}

run().then(() => db.destroy()).then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
