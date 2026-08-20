/**
 * exoTemplateService.js — Application d'un modèle de catalogue (`ref_exo_templates`) à une exo-armure
 *
 * PLAN_EXOARMURE.md §13.3 (Lot B — Base éditable). Extrait en fonction dédiée plutôt qu'inline dans la
 * route `PUT /:characterId/exo` (analyse à charge 2026-08-20) : §12.2 point 2 est tranché depuis —
 * choisir un modèle pré-remplit aussi le loadout Systèmes/Armement (Lot C, §13.4.4) — Lot C n'a donc
 * qu'à ÉTENDRE `applyExoTemplate` d'une étape, jamais rouvrir la route déjà livrée par ce Lot B.
 *
 * Toujours une copie COMPLÈTE, jamais une fusion intelligente : choisir un nouveau modèle écrase les
 * 19 champs ci-dessous avec les valeurs du modèle choisi, y compris s'ils avaient été personnalisés
 * avant — comportement prévisible, pas de logique de fusion à deviner (§13.3).
 */

import { AppError } from './AppError.js'

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
    return updated
  })
}
