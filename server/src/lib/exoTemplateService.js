/**
 * exoTemplateService.js — Application d'un modèle de catalogue (`ref_exo_templates`) à une exo-armure
 *
 * PLAN_EXOARMURE.md §13.3 (Lot B — Base éditable) + §13.4.4 (Lot C — loadout Systèmes/Armement/
 * Ordinateur, extension 2026-08-21). Extrait en fonction dédiée plutôt qu'inline dans la route
 * `PUT /:characterId/exo` (analyse à charge 2026-08-20) : choisir un modèle pré-remplit aussi le
 * loadout (tranché par Saar, "armement et armes sont des paramètres d'usine. Modifiable mais
 * pré-made") — Lot C étend `applyExoTemplate` d'une étape, jamais ne rouvre la route déjà livrée par
 * ce Lot B.
 *
 * Toujours une copie COMPLÈTE, jamais une fusion intelligente : choisir un nouveau modèle écrase les
 * 19 champs de base ET le loadout entier (exo_systems/exo_weapons/exo_computers) avec ceux du modèle
 * choisi, y compris s'ils avaient été personnalisés avant — comportement prévisible, pas de logique
 * de fusion à deviner (§13.3, étendu §13.4.4).
 *
 * Intégrité de départ du loadout — deux règles RAW distinctes, jamais unifiées à tort :
 *   - `exo_systems`/`exo_weapons` : fixe à 20 (matériel neuf — décision Saar 2026-08-21, une armure
 *     prémade RAW sort d'usine, pas de l'occasion). Pas de jet : la règle générale du catalogue
 *     (SEEDEXO.md intro, "Intégrité = 2D6+6" pour du matériel d'occasion) ne s'applique pas ici.
 *   - `exo_computers` : un JET par ligne, formule dépendant de la Génération
 *     (`resolveOrdinateurIntegrityFormula`, shared/computerStats.js) — règle RAW propre aux
 *     ordinateurs (docs/REGLES/REGLE_ORDINATEUR.md:91-93), sans alternative "neuf" dans le texte
 *     source, donc non concernée par la décision ci-dessus.
 */

import { AppError } from './AppError.js'
import { parseDice } from './diceParser.js'
import { resolveOrdinateurIntegrityFormula } from '../../../shared/computerStats.js'

// Matériel neuf (décision Saar 2026-08-21, §13.4.4) — jamais un jet pour exo_systems/exo_weapons
// copiés depuis un loadout de modèle, contrairement à exo_computers ci-dessous.
const LOADOUT_NEW_INTEGRITY = 20

// Même liste que `COPIED_FROM_TEMPLATE_COLUMNS` dans la migration 254 (server/src/db/migrations/
// 254_exo_sheet_base_stats.js) — dupliquée volontairement, pas importée : une migration déjà appliquée
// ne se retouche jamais (CLAUDE.md §5), donc son fichier reste un instantané figé de ce qui a été
// backfillé à l'époque. Ce fichier-ci, lui, évolue (Lot C y ajoutera ordinateur_gen/nt, §13.4.2) — les
// deux listes divergeront un jour par construction, jamais par accident silencieux (mirroré comme les
// contraintes CHECK de 233/243, jamais réinventées).
const COPIED_FROM_TEMPLATE_COLUMNS = [
  'category', 'environment', 'depth_operational', 'depth_limit', 'depth_crush',
  'base_exoforce', 'base_blindage', 'base_speed_underwater', 'base_speed_surface',
  'underwater_movement_mode', 'surface_movement_mode', 'speeds_extra',
  'malus_init_underwater', 'malus_init_surface',
  'manufacturer', 'price', 'rarity', 'tech_level', 'autonomy',
]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Copie les 19 champs de base d'un modèle du catalogue sur l'exo_sheet d'un personnage.
 *
 * @returns {object|null} la ligne exo_sheet mise à jour (`.returning('*')`), ou `null` si
 *   `templateId` ne résout aucune ligne `ref_exo_templates` (mirror la convention "retour null sur
 *   introuvable" déjà en place, `applyExoAvarie`/`removeExoAvarie`) — ou si `characterId` n'a pas
 *   d'exo_sheet du tout (garde symétrique, même valeur de retour).
 * @throws {AppError} 400 si `templateId` n'est pas un UUID syntaxiquement valide — sans cette garde,
 *   Postgres planterait sur "invalid input syntax for type uuid" (500 brut), même trouvaille qu'au
 *   Lot A pour `severity` (§13.2).
 */
export async function applyExoTemplate(db, characterId, templateId) {
  if (!UUID_RE.test(templateId)) {
    throw new AppError(400, 'template_id must be a valid UUID')
  }

  // Transactionnel avec verrou de ligne dès ce Lot B, pas seulement l'écriture (analyse à charge
  // 2026-08-20) : une seule UPDATE suffirait aujourd'hui sans verrou, mais le Lot C y ajoutera un
  // remplacement complet du loadout (DELETE puis INSERT dans exo_systems/exo_weapons, §13.4.4) — sans
  // verrou, deux sélections de modèle concurrentes sur la même exo-armure pourraient intercaler leurs
  // DELETE/INSERT respectifs et produire un loadout mélangé des deux modèles. Le SELECT ... FOR UPDATE
  // ci-dessous sérialise automatiquement cette extension future sans qu'elle ait à reposer son propre
  // verrou (même patron que `.forUpdate()` dans exoAvarieService.js#removeExoAvarie).
  return db.transaction(async (trx) => {
    const exoSheet = await trx('exo_sheet').where({ character_id: characterId }).forUpdate().first()
    if (!exoSheet) return null

    const template = await trx('ref_exo_templates').where({ id: templateId }).first()
    if (!template) return null

    const copiedFields = Object.fromEntries(
      COPIED_FROM_TEMPLATE_COLUMNS.map(col => [col, template[col]])
    )
    // pg/knex renvoie déjà `speeds_extra` désérialisé (jsonb → tableau JS) depuis le SELECT ci-dessus
    // — le réinjecter tel quel dans l'UPDATE fait sérialiser le driver en littéral tableau Postgres
    // ("{...}"), pas en JSON, et Postgres rejette ("invalid input syntax for type json"). Même
    // ré-encodage que 252_seed_ref_exo_templates.js:238 pour la même raison (colonne jsonb ronde-
    // trippée, jamais un simple passe-plat).
    copiedFields.speeds_extra = JSON.stringify(copiedFields.speeds_extra)

    const [updated] = await trx('exo_sheet')
      .where({ character_id: characterId })
      .update({ template_id: templateId, ...copiedFields })
      .returning('*')

    // Écrasement complet du loadout — même sémantique que les champs de base ci-dessus (§13.3),
    // étendue au Lot C (§13.4.4). Le verrou FOR UPDATE posé sur exo_sheet plus haut sérialise déjà
    // deux applications concurrentes du même personnage (toute requête concurrente bloque avant
    // d'atteindre ces DELETE/INSERT), pas besoin d'un second verrou sur les tables enfants.
    await trx('exo_systems').where({ character_id: characterId }).delete()
    await trx('exo_weapons').where({ character_id: characterId }).delete()
    await trx('exo_computers').where({ character_id: characterId }).delete()

    const equipmentRows = await trx('ref_exo_template_equipment')
      .where({ template_id: templateId })
      .orderBy('sort_order', 'asc')
    const systemsToInsert = equipmentRows
      .filter(row => row.family === 'systeme')
      .map(row => ({
        character_id: characterId,
        ref_equipment_id: row.ref_equipment_id,
        label_override: row.label_override,
        level: row.level,
        integrite_max: LOADOUT_NEW_INTEGRITY,
        integrite_current: LOADOUT_NEW_INTEGRITY,
        sort_order: row.sort_order,
      }))
    const weaponsToInsert = equipmentRows
      .filter(row => row.family === 'arme')
      .map(row => ({
        character_id: characterId,
        ref_equipment_id: row.ref_equipment_id,
        label_override: row.label_override,
        integrite_max: LOADOUT_NEW_INTEGRITY,
        integrite_current: LOADOUT_NEW_INTEGRITY,
        sort_order: row.sort_order,
      }))
    if (systemsToInsert.length > 0) await trx('exo_systems').insert(systemsToInsert)
    if (weaponsToInsert.length > 0) await trx('exo_weapons').insert(weaponsToInsert)

    // Ordinateur(s) — un jet d'Intégrité PAR LIGNE, formule dépendant de SA PROPRE génération : un
    // principal et un secours n'ont presque jamais la même génération (ex. Nymph 1-A : Gén. V vs
    // Gén. II, deux formules RAW différentes) — jamais un seul jet réutilisé pour les deux.
    const computerRows = await trx('ref_exo_template_computers')
      .where({ template_id: templateId })
      .orderBy('sort_order', 'asc')
    for (const row of computerRows) {
      const formula = resolveOrdinateurIntegrityFormula(row.gen)
      const roll = await parseDice(formula)
      await trx('exo_computers').insert({
        character_id: characterId,
        role: row.role,
        gen: row.gen,
        nt: row.nt,
        integrite_max: roll.total,
        integrite_current: roll.total,
        sort_order: row.sort_order,
      })
    }

    return updated
  })
}
