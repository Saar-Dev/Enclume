// 365_game_echeances_infection_per_location.js — l'infection d'une blessure appartient à une LOCALISATION (Lot B1 de docs/PLANS/PLAN_GUERISON_RAW.md).
//
// Le livre joue l'infection « pour chaque Localisation » (REGLEBLESSURES.md:439-442) : UN Test de Constitution par personnage et par localisation. Jusqu'ici
// chaque case avait sa propre échéance `wound_infection_check` (`payload.woundId`) : trois cases en Échec lançaient trois jets. Désormais l'échéance porte
// `payload.location` (jamais `woundId`) et il n'en existe qu'une vivante par (personnage, localisation) — l'unicité est posée par la migration suivante.
//
// CONVERSION des échéances d'infection VIVANTES (`active`, `pending_mj_review`, `awaiting_player_roll`) :
//   - sa blessure n'existe plus, ou n'est pas susceptible de s'infecter (Légère, Mort en Tête/Corps) → annulée (`cancelled`, comme une échéance qui meurt avec sa case) ;
//   - sinon regroupée par (personnage, localisation) : on GARDE une échéance — celle dont l'état est le plus avancé (jet du joueur attendu > revue du MJ > programmée),
//     puis la blessure la plus grave, puis la plus ancienne — les autres sont annulées ; la gardée prend l'échéance la plus proche, le cycle récurrent s'il y en
//     a un (avec le plus d'occurrences restantes) et le plus grand nombre de périodes sans soin. Les infections TERMINÉES ou annulées gardent leur ancien payload
//     (historique, jamais relu).
// Le code d'avant ne sait pas lire `payload.location` : cette migration s'applique avec le code qui l'accompagne (même commit).
//
// Idempotente : une infection déjà convertie n'a plus de `payload.woundId`. down() : meilleur effort — chaque infection vivante repart sur la pire blessure susceptible
// de s'infecter de sa localisation (les doublons fusionnés ne sont pas recréés).

const LIVE_STATUSES = ['active', 'pending_mj_review', 'awaiting_player_roll']
const STATUS_PRIORITY = { awaiting_player_roll: 0, pending_mj_review: 1, active: 2 }
// Gravités susceptibles de s'infecter, de la moins grave à la plus grave (`mort_subite` = Membre détruit sur un membre ; une Mort en Tête/Corps ne s'infecte pas).
const INFECTABLE_RANK = { moyenne: 1, grave: 2, critique: 3, mortelle: 4, mort_subite: 5 }
const isInfectable = (wound) => INFECTABLE_RANK[wound.severity] !== undefined
  && !(wound.severity === 'mort_subite' && (wound.location === 'tete' || wound.location === 'corps'))

const compareRows = (a, b) => STATUS_PRIORITY[a.row.status] - STATUS_PRIORITY[b.row.status]
  || INFECTABLE_RANK[b.wound.severity] - INFECTABLE_RANK[a.wound.severity]
  || new Date(a.row.created_at) - new Date(b.row.created_at)
  || String(a.row.id).localeCompare(String(b.row.id))

// PURE — décide de la conversion sans toucher la base (testée seule). `rows` : les échéances d'infection vivantes à `payload.woundId` ; `woundsById` : leurs blessures.
// Retourne `{ cancelIds, keeps }` — `keeps` : { id, cancelIds, patch } (`patch` = colonnes à écrire sur l'échéance gardée).
export function planLocationInfections(rows, woundsById) {
  const cancelIds = []
  const groups = new Map()
  for (const row of rows) {
    const wound = woundsById[row.payload?.woundId]
    if (!wound || !isInfectable(wound)) { cancelIds.push(row.id); continue }
    const key = `${row.character_id}|${wound.location}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({ row, wound })
  }

  const keeps = []
  for (const group of groups.values()) {
    group.sort(compareRows)
    const [keep, ...others] = group
    const recurring = group.filter(({ row }) => row.interval_minutes !== null)
    const { woundId: _legacy, ...payloadWithoutWound } = keep.row.payload
    keeps.push({
      id: keep.row.id,
      cancelIds: others.map(({ row }) => row.id),
      patch: {
        payload: { ...payloadWithoutWound, location: keep.wound.location, periodesSansSoin: Math.max(...group.map(({ row }) => row.payload?.periodesSansSoin ?? 0)) },
        next_due_minutes: Math.min(...group.map(({ row }) => row.next_due_minutes)),
        interval_minutes: recurring.length > 0 ? (keep.row.interval_minutes ?? recurring[0].row.interval_minutes) : null,
        occurrences_remaining: recurring.length > 0 ? Math.max(...recurring.map(({ row }) => row.occurrences_remaining ?? 0)) : null,
      },
    })
  }
  return { cancelIds, keeps }
}

const cancel = (knex, ids) => ids.length === 0
  ? null
  : knex('game_echeances').whereIn('id', ids).update({ status: 'cancelled', updated_at: knex.fn.now() })

export const up = async (knex) => {
  const rows = await knex('game_echeances')
    .where({ condition_type: 'wound_infection_check' })
    .whereIn('status', LIVE_STATUSES)
    .whereRaw("payload->>'woundId' is not null")
    .select('*')
  if (rows.length === 0) return

  const woundIds = [...new Set(rows.map(r => r.payload.woundId))]
  const wounds = await knex('character_wounds').whereIn('id', woundIds).select('id', 'location', 'severity')
  const { cancelIds, keeps } = planLocationInfections(rows, Object.fromEntries(wounds.map(w => [w.id, w])))

  await cancel(knex, cancelIds)
  for (const { id, cancelIds: merged, patch } of keeps) {
    await knex('game_echeances').where({ id }).update({ ...patch, payload: JSON.stringify(patch.payload), updated_at: knex.fn.now() })
    await cancel(knex, merged)
  }
  console.log(`[365] infections converties par localisation : ${keeps.length} gardée(s), ${cancelIds.length + keeps.reduce((n, k) => n + k.cancelIds.length, 0)} annulée(s)`)
}

export const down = async (knex) => {
  const rows = await knex('game_echeances')
    .where({ condition_type: 'wound_infection_check' })
    .whereIn('status', LIVE_STATUSES)
    .whereRaw("payload->>'location' is not null")
    .select('*')
  for (const row of rows) {
    const sheet = await knex('char_sheet').where({ character_id: row.character_id }).first('id')
    const wounds = sheet ? await knex('character_wounds').where({ char_sheet_id: sheet.id, location: row.payload.location }).select('id', 'location', 'severity') : []
    const worst = wounds.filter(isInfectable).sort((a, b) => INFECTABLE_RANK[b.severity] - INFECTABLE_RANK[a.severity])[0]
    if (!worst) { await cancel(knex, [row.id]); continue }
    const { location: _location, ...payload } = row.payload
    await knex('game_echeances').where({ id: row.id }).update({ payload: JSON.stringify({ ...payload, woundId: worst.id }), updated_at: knex.fn.now() })
  }
}
