// vaultService.js — PLAN_VAULT.md Étapes 3+. Couche DB pure (pas de req/res, pas d'émission
// socket — un Vault n'a pas de room à notifier, personne d'autre n'y a accès). Pattern trx-or-db
// identique à advantageService.addAdvantage partout où c'est pertinent.

import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { getOrCreateVault } from './vaultCoreService.js'

// ─── Registre par type de compagnon (PLAN_VAULT.md "Registre par type de compagnon") ───────────
// Groupe A (pj/pnj) : arbre char_sheet, deux niveaux d'indirection. La plupart des tables sont
// keyées par char_sheet_id, mais char_inventory/character_macros le sont directement par
// character_id (vérifié Étape 0) — d'où deux listes distinctes, pas une seule.

const CHAR_SHEET_KEYED_TABLES = [
  'char_identity', 'char_archetype', 'char_attributes', 'char_skills', 'char_mutations',
  'char_polaris', 'char_personal_advantages', 'char_careers', 'char_traits', 'char_pc_ledger',
  'char_advantages', 'char_advantage_notes', 'character_wounds', 'char_gauges',
]
// char_inventory sort de cette liste (ci-dessous, VAULT-REGISTRY-DRIFT1) : char_inventory_slots
// référence à la fois character_id ET char_inventory_id, le clonage générique cloneRows() ne
// remappe qu'une seule colonne FK à la fois — nécessite cloneInventoryWithSlots dédiée.
const CHARACTER_KEYED_TABLES_GROUP_A = ['character_macros']

// Ancien nom lockClonedWizard — renommée (docs/EN_COURS.md, 2026-08-16) : n'appelle plus
// lockWizard() (creationService.js), dont la précondition creation_state==='complete' n'a plus
// lieu d'être ici (Piège P6 retiré, voir cloneCharacterDeep). Un clone est toujours un personnage
// "réel" dès sa création, quel que soit l'état d'avancement de la source — poser wizard_locked_at
// directement, sans passer par le contrat (plus applicable) de lockWizard(). wizard_locks n'est
// jamais cloné (absent du registre par conception, verrous MJ propres au Wizard collaboratif) —
// rien à nettoyer sur le nouveau char_sheet, contrairement à lockWizard().
async function stampClonedAsFinal(trx, { newSheetId }) {
  if (!newSheetId) return
  await trx('char_sheet').where({ id: newSheetId }).update({ wizard_locked_at: trx.fn.now() })
}

async function resetDroneIntegrity(trx, { newCharacterId }) {
  const sheet = await trx('drone_sheet').where({ character_id: newCharacterId }).first()
  if (!sheet) return
  await trx('drone_sheet').where({ character_id: newCharacterId })
    .update({ integrite_actuelle: sheet.integrite_max, damages: '{}' })
}

// VAULT-REGISTRY-DRIFT1 — exo_sheet n'a jamais eu d'entrée (COMPANION_REGISTRY disait "futur : exo"
// depuis PLAN_VAULT.md sans jamais être construit). Clone + remise à neuf en UNE seule insertion,
// jamais un cloneRows générique suivi d'un UPDATE correctif : exo_sheet_pilot_unique (index unique
// partiel sur pilot_character_id) rejette l'insertion d'entrée si on copie le pilote de la source
// tel quel (constaté : "duplicate key value violates unique constraint exo_sheet_pilot_unique" —
// l'ancienne fiche existe encore avec ce même pilote au moment du clonage). pilot_character_id doit
// être NULL dès l'INSERT, jamais un état transitoire. Même philosophie que resetDroneIntegrity côté
// intégrité/avaries : un export reste un "modèle réutilisable", pas un instantané endommagé.
async function cloneExoSheet(trx, { sourceCharacterId, newCharacterId }) {
  const sheet = await trx('exo_sheet').where({ character_id: sourceCharacterId }).first()
  if (!sheet) return
  const { character_id: _oldCharacterId, ...rest } = sheet
  await trx('exo_sheet').insert({
    ...rest,
    character_id: newCharacterId,
    itg_structure_current: sheet.itg_structure_max,
    itg_exosquelette_current: sheet.itg_exosquelette_max,
    itg_generator_current: sheet.itg_generator_max,
    avaries_legeres: 0,
    avaries_moyennes: 0,
    avaries_graves: 0,
    avaries_critiques: 0,
    avaries_catastrophiques: 0,
    pilot_character_id: null,
  })
}

// VAULT-REGISTRY-DRIFT1 — char_inventory_slots a deux FK réelles (char_inventory_id ET
// character_id) : cloneRows() générique ne peut remapper qu'une seule colonne. Clone char_inventory
// d'abord (une seule requête, ordre défini par le tableau d'insertion — PostgreSQL préserve l'ordre
// d'un INSERT...VALUES...RETURNING multi-lignes, garantie documentée, pas une coïncidence dont on
// dépend à l'aveugle), construit la correspondance ancien id → nouveau id par position, puis clone
// les slots en remappant les deux colonnes via cette correspondance.
async function cloneInventoryWithSlots(trx, { oldCharacterId, newCharacterId }) {
  const oldItems = await trx('char_inventory').where({ character_id: oldCharacterId })
  if (oldItems.length === 0) return

  const toInsert = oldItems.map(({ id, ...rest }) => ({ ...rest, character_id: newCharacterId }))
  const newItems = await trx('char_inventory').insert(toInsert).returning('*')

  const idMap = new Map(oldItems.map((old, i) => [old.id, newItems[i].id]))

  const oldSlots = await trx('char_inventory_slots').where({ character_id: oldCharacterId })
  if (oldSlots.length === 0) return

  const slotsToInsert = oldSlots.map(({ char_inventory_id, slot_code }) => ({
    char_inventory_id: idMap.get(char_inventory_id),
    character_id: newCharacterId,
    slot_code,
  }))
  await trx('char_inventory_slots').insert(slotsToInsert)
}

const COMPANION_REGISTRY = {
  pj: {
    hasCharSheet: true,
    charSheetKeyed: CHAR_SHEET_KEYED_TABLES,
    characterKeyed: CHARACTER_KEYED_TABLES_GROUP_A,
    hasInventory: true,
    onClone: stampClonedAsFinal,
  },
  pnj: {
    hasCharSheet: true,
    charSheetKeyed: CHAR_SHEET_KEYED_TABLES,
    characterKeyed: CHARACTER_KEYED_TABLES_GROUP_A,
    hasInventory: true,
    onClone: stampClonedAsFinal,
  },
  drone: {
    hasCharSheet: false,
    charSheetKeyed: [],
    characterKeyed: ['drone_sheet', 'drone_programs', 'drone_weapons'],
    onClone: resetDroneIntegrity,
  },
  exo: {
    hasCharSheet: false,
    charSheetKeyed: [],
    // exo_sheet n'est PAS dans characterKeyed : cloneExoSheet la clone elle-même (voir sa
    // documentation — piège exo_sheet_pilot_unique), extraTables la garde couverte par le
    // garde-fou anti-dérive sans repasser par le cloneRows générique. Les 4 tables ci-dessous
    // (PLAN_EXOARMURE.md §13.4.3, migration 257) n'ont pas ce piège — character_id-keyed simple,
    // clonées par le mécanisme générique comme drone_programs/drone_weapons ci-dessus.
    characterKeyed: ['exo_systems', 'exo_weapons', 'exo_programs', 'exo_computers'],
    extraTables: ['exo_sheet'],
    onClone: cloneExoSheet,
  },
  // futur : vaisseau: {...} — une entrée de plus, jamais une modification du reste de ce fichier
  // (voir PLAN_VAULT.md "Registre par type de compagnon").
}

// Tables qui référencent characters/char_sheet mais décrivent un état de session/campagne ou une
// transaction, pas le personnage lui-même — jamais clonées (PLAN_VAULT.md Étape 0).
// wizard_locks/game_echeances/chat_messages ajoutées VAULT-REGISTRY-DRIFT1 (2026-08-16) — verrous MJ
// du Wizard collaboratif, échéances de jeu liées à une campagne précise, historique de chat : les
// trois décrivent un état de session/workflow, jamais le personnage lui-même.
const EXCLUDED_TABLES = new Set([
  'tokens', 'trade_log', 'trade_offers', 'vault_transfer_requests',
  'wizard_locks', 'game_echeances', 'chat_messages',
])

// ─── Garde-fou anti-dérive (PLAN_VAULT.md "Garde-fou anti-dérive") ──────────────────────────────
// Vérifie, à chaque clonage, que toute table ayant une vraie FK vers characters/char_sheet est soit
// dans le registre ci-dessus, soit explicitement exclue — jamais oubliée en silence. Recherche par
// contrainte FK réelle (information_schema), pas par nom de colonne : un premier jet de cette idée
// ne cherchait que des colonnes nommées littéralement character_id/char_sheet_id et aurait raté
// vault_transfer_requests (colonnes vault_character_id/created_character_id) — corrigé au Run à
// vide 2026-07-10.
async function assertRegistryUpToDate(trx) {
  const registered = new Set()
  for (const entry of Object.values(COMPANION_REGISTRY)) {
    if (entry.hasCharSheet) registered.add('char_sheet')
    entry.charSheetKeyed.forEach(t => registered.add(t))
    entry.characterKeyed.forEach(t => registered.add(t))
    // hasInventory : char_inventory/char_inventory_slots clonées par cloneInventoryWithSlots
    // (double FK, hors du tableau characterKeyed générique) — toujours couvertes par le registre.
    if (entry.hasInventory) { registered.add('char_inventory'); registered.add('char_inventory_slots') }
    // extraTables : tables clonées par une fonction onClone dédiée plutôt que characterKeyed
    // générique (ex. exo_sheet) — toujours couvertes par le registre.
    entry.extraTables?.forEach(t => registered.add(t))
  }

  const { rows } = await trx.raw(`
    SELECT DISTINCT tc.table_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name IN ('characters', 'char_sheet')
  `)

  const missing = rows.map(r => r.table_name).filter(t => !registered.has(t) && !EXCLUDED_TABLES.has(t))
  if (missing.length > 0) {
    throw new AppError(500, `Vault : table(s) liée(s) à un personnage non couverte(s) par le registre ni la liste d'exclusion : ${missing.join(', ')}`)
  }
}

// Duplique toutes les lignes de `table` où `fkColumn` = oldFkValue, en réattribuant fkColumn à
// newFkValue. Omet systématiquement une éventuelle colonne `id` (regénérée par la base via
// defaultTo(gen_random_uuid()) — vérifié sur les 9 tables concernées) ; sans effet sur les tables
// sans colonne `id` séparée (PK = la FK elle-même ou PK composite, vérifié Étape 0). Retourne les
// lignes clonées (utile pour char_sheet, dont le nouvel `id` sert de pivot aux tables filles).
async function cloneRows(trx, table, fkColumn, oldFkValue, newFkValue) {
  const rows = await trx(table).where({ [fkColumn]: oldFkValue })
  if (rows.length === 0) return []
  const cloned = rows.map(({ id, ...rest }) => ({ ...rest, [fkColumn]: newFkValue }))
  return trx(table).insert(cloned).returning('*')
}

// ─── Vault (une par compte) ──────────────────────────────────────────────────────────────────
// getOrCreateVault vit dans vaultCoreService.js, pas ici (cycle d'import avec creationService.js
// — voir commentaire de ce module), importé ci-dessus pour l'usage interne de cloneToVault et
// réexporté tel quel : la surface publique de vaultService.js ne change pas pour ses appelants
// existants.

export { getOrCreateVault }

export async function listVaultCharacters(userId) {
  const vault = await db('vaults').where({ user_id: userId }).first()
  if (!vault) return []
  const characters = await db('characters').where({ vault_id: vault.id }).orderBy('created_at', 'asc')
  if (characters.length === 0) return characters

  // Étape 7 Lot 3 — un personnage avec une demande 'pending' (n'importe quelle campagne cible,
  // voir index partiel Étape 2) affiche un badge "en attente" côté client plutôt que le bouton de
  // demande, pour éviter le spam visuel/fonctionnel de demandes multiples simultanées en v1.
  const pending = await db('vault_transfer_requests')
    .whereIn('vault_character_id', characters.map(c => c.id))
    .where({ status: 'pending' })
    .select('vault_character_id')
  const pendingIds = new Set(pending.map(p => p.vault_character_id))

  return characters.map(c => ({ ...c, hasPendingRequest: pendingIds.has(c.id) }))
}

// ─── Clonage profond (cœur du mécanisme) ────────────────────────────────────────────────────

/**
 * @param {string} sourceCharacterId
 * @param {{campaignId?: string, vaultId?: string}} destination — exactement l'un des deux
 * @param {import('knex').Knex.Transaction} [trxOpt] — permet l'appel depuis une transaction externe
 *   (ex. approveImport, qui doit clôturer la demande dans la même transaction que le clonage)
 */
export async function cloneCharacterDeep(sourceCharacterId, { campaignId, vaultId }, trxOpt) {
  if (!campaignId === !vaultId) {
    throw new AppError(500, 'cloneCharacterDeep : exactement une destination (campaignId XOR vaultId) attendue')
  }

  const exec = async (trx) => {
    await assertRegistryUpToDate(trx)

    const source = await trx('characters').where({ id: sourceCharacterId }).first()
    if (!source) throw new AppError(404, 'Personnage introuvable')

    const entry = COMPANION_REGISTRY[source.type]
    if (!entry) throw new AppError(500, `Vault : type de personnage non pris en charge : ${source.type}`)

    let sourceSheet = null
    if (entry.hasCharSheet) {
      sourceSheet = await trx('char_sheet').where({ character_id: sourceCharacterId }).first()
      if (!sourceSheet) throw new AppError(500, 'Fiche personnage introuvable — incohérence')
      // Ancien Piège P6 (PLAN_VAULT.md) retiré (docs/EN_COURS.md, 2026-08-16) : un brouillon Wizard
      // inachevé pouvait rester bloqué dans le Coffre faute de mécanisme de reprise hors contexte —
      // n'a plus lieu d'être, le Coffre n'exige plus wizard_locked_at pour rester éditable
      // (char-sheet.js), et "fini" n'est plus un flag technique à valider ici mais un jugement du MJ
      // cible à l'approbation du transfert (philosophie "confiance à la frontière").
    }

    const { id: _oldCharId, ...charRest } = source
    const [newChar] = await trx('characters').insert({
      ...charRest,
      campaign_id: campaignId ?? null,
      vault_id: vaultId ?? null,
      visible: false, // Piège P5 : neutralisé explicitement, jamais copié tel quel (pas de sens hors campagne/Vault vivant)
      // `type` n'est PAS réécrit (Piège P5) — préservé tel quel via charRest.
    }).returning('*')

    let newSheetId = null
    if (entry.hasCharSheet) {
      const [newSheet] = await cloneRows(trx, 'char_sheet', 'character_id', sourceCharacterId, newChar.id)
      newSheetId = newSheet.id
      for (const table of entry.charSheetKeyed) {
        await cloneRows(trx, table, 'char_sheet_id', sourceSheet.id, newSheetId)
      }
    }
    for (const table of entry.characterKeyed) {
      await cloneRows(trx, table, 'character_id', sourceCharacterId, newChar.id)
    }
    if (entry.hasInventory) {
      await cloneInventoryWithSlots(trx, { oldCharacterId: sourceCharacterId, newCharacterId: newChar.id })
    }

    await entry.onClone?.(trx, { sourceCharacterId, newCharacterId: newChar.id, newSheetId })

    return newChar
  }

  return trxOpt ? exec(trxOpt) : db.transaction(exec)
}

export async function cloneToVault(characterId, userId) {
  const source = await db('characters').where({ id: characterId }).first()
  if (!source) throw new AppError(404, 'Personnage introuvable')
  if (source.user_id !== userId) throw new AppError(403, 'Accès refusé')

  const vault = await getOrCreateVault(userId)
  return cloneCharacterDeep(characterId, { vaultId: vault.id })
}

// ─── Demandes de transfert Vault → campagne (Décision 3, asymétrie de permission) ──────────────

export async function requestImport(vaultCharacterId, targetCampaignId, userId) {
  const character = await db('characters').where({ id: vaultCharacterId }).first()
  if (!character) throw new AppError(404, 'Personnage introuvable')
  if (character.user_id !== userId) throw new AppError(403, 'Accès refusé')
  if (!character.vault_id) throw new AppError(400, "Ce personnage n'est pas dans un Vault")

  const membership = await db('campaign_members')
    .where({ campaign_id: targetCampaignId, user_id: userId }).first()
  if (!membership) throw new AppError(403, "Vous ne faites pas partie de cette campagne")

  try {
    const [request] = await db('vault_transfer_requests').insert({
      vault_character_id: vaultCharacterId,
      target_campaign_id: targetCampaignId,
      requested_by: userId,
    }).returning('*')
    return request
  } catch (err) {
    if (err.code === '23505') throw new AppError(409, 'Une demande est déjà en attente pour ce personnage vers cette campagne')
    throw err
  }
}

export async function approveImport(requestId, gmUserId) {
  return db.transaction(async (trx) => {
    const request = await trx('vault_transfer_requests').where({ id: requestId }).first()
    if (!request) throw new AppError(404, 'Demande introuvable')
    if (request.status !== 'pending') throw new AppError(400, 'Demande déjà traitée')

    const gmMembership = await trx('campaign_members')
      .where({ campaign_id: request.target_campaign_id, user_id: gmUserId, role: 'gm' }).first()
    if (!gmMembership) throw new AppError(403, 'Seul le MJ de cette campagne peut approuver')

    // Piège P2 : revalider l'appartenance du DEMANDEUR à la campagne cible à l'approbation, pas
    // seulement à la création de la requête — il a pu quitter la campagne entre-temps.
    if (!request.requested_by) throw new AppError(400, 'Demandeur introuvable (compte supprimé depuis)')
    const requesterMembership = await trx('campaign_members')
      .where({ campaign_id: request.target_campaign_id, user_id: request.requested_by }).first()
    if (!requesterMembership) throw new AppError(400, 'Le demandeur ne fait plus partie de cette campagne')

    const newChar = await cloneCharacterDeep(request.vault_character_id, { campaignId: request.target_campaign_id }, trx)

    await trx('vault_transfer_requests').where({ id: requestId }).update({
      status: 'approved', reviewed_by: gmUserId, reviewed_at: trx.fn.now(), created_character_id: newChar.id,
    })

    return newChar
  })
}

export async function rejectImport(requestId, gmUserId) {
  return db.transaction(async (trx) => {
    const request = await trx('vault_transfer_requests').where({ id: requestId }).first()
    if (!request) throw new AppError(404, 'Demande introuvable')
    if (request.status !== 'pending') throw new AppError(400, 'Demande déjà traitée')

    const gmMembership = await trx('campaign_members')
      .where({ campaign_id: request.target_campaign_id, user_id: gmUserId, role: 'gm' }).first()
    if (!gmMembership) throw new AppError(403, 'Seul le MJ de cette campagne peut refuser')

    await trx('vault_transfer_requests').where({ id: requestId })
      .update({ status: 'rejected', reviewed_by: gmUserId, reviewed_at: trx.fn.now() })
    return { ok: true }
  })
}

// ─── Vue MJ (PLAN_VAULT.md Étape 7, Lot 4) ──────────────────────────────────────────────────

// Demandes en attente pour une campagne — réservé au MJ de cette campagne (même vérification
// que approveImport/rejectImport, mais en lecture seule).
export async function listPendingRequestsForCampaign(campaignId, gmUserId) {
  const gmMembership = await db('campaign_members')
    .where({ campaign_id: campaignId, user_id: gmUserId, role: 'gm' }).first()
  if (!gmMembership) throw new AppError(403, 'Seul le MJ de cette campagne peut voir ces demandes')

  return db('vault_transfer_requests as vtr')
    .join('characters as c', 'c.id', 'vtr.vault_character_id')
    .leftJoin('users as u', 'u.id', 'vtr.requested_by')
    .where({ 'vtr.target_campaign_id': campaignId, 'vtr.status': 'pending' })
    .select(
      'vtr.id',
      'vtr.created_at',
      'c.name as character_name',
      'c.type as character_type',
      'u.username as requested_by_username',
    )
    .orderBy('vtr.created_at', 'asc')
}
