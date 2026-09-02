// characterExportService.js — Agrégation des données Wizard pour l'export Excel
// (docs/PLANS/PLAN_EXPORTEXCEL.md, Lot 1).
//
// Ne recalcule rien qu'Excel recalcule déjà lui-même (§1.3bis) et ne duplique aucun calcul
// métier existant (getGenotypeModForAttr/getMutationModForAttr, shared/polarisUtils.js ;
// getAdvantages, advantageService.js ; getInventory, inventoryService.js). Les décisions
// propres au classeur Excel (fusion mod_mutation dans ATTBase{X}, table de correspondance
// génotype -> libellé exact attendu par le classeur, mapping vers les plages nommées) restent
// du ressort du Lot 2 — cette fonction expose des données Enclume propres, pas déjà pliées à
// la forme du fichier cible.
//
// Périmètre exclu (docs/PLANS/PLAN_EXPORTEXCEL.md §2.0/§2.4/§1.2, aucune destination dans le
// classeur "Vierge") : description physique, carrières, mutations, blessures/munitions/bourses.

import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { resolveRefField } from '../lib/refI18n.js'
import { getGenotypeModForAttr, getMutationModForAttr } from '../../../shared/polarisUtils.js'
import { getAdvantages } from './advantageService.js'
import { getMutationEffects } from './mutationService.js'
import { getInventory } from './inventoryService.js'

/**
 * Agrège les données d'un personnage nécessaires à l'export Wizard -> Excel.
 * @param {string} characterId
 * @param {string} campaignId - requis par getInventory (options de campagne, encombrement)
 */
export async function getCharacterExportData(characterId, campaignId) {
  const sheet = await db('char_sheet').where({ character_id: characterId }).first()
  if (!sheet) throw new AppError(404, 'Sheet not found')

  const [identity, archetype, attributeRows, skillRows, advantageRows, mutationEffects, inventory] = await Promise.all([
    db('char_identity').where({ char_sheet_id: sheet.id }).first(),
    db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
    db('char_attributes').where({ char_sheet_id: sheet.id }).select('*'),
    // Catalogue complet (`ref_skills`), pas seulement les lignes `char_skills` déjà investies — la
    // fiche Excel doit lister toute compétence utilisable, y compris à maîtrise 0 (comme la fiche
    // papier RAW), pas seulement celles où le joueur a mis un point (régression trouvée par Saar sur
    // l'export Baboulinet : 5 compétences visibles au lieu du catalogue complet). Deux exclusions
    // demandées par Saar, RAW p.188 (`REGLECOMPETENCE.md:14-25`) + schéma `ref_skills` :
    //   - « réservée » : marker='(X)' non apprise (`cs.is_learned` absent ou false) — RAW : inutilisable
    //     tant qu'un niveau n'a pas été acheté (`SkillsPanel.jsx` applique la même règle, PC15).
    //   - « nulle » : `attr_1 IS NULL` — 5 lignes catégorie sans attribut propre (ex. `PILOTAGE`,
    //     `ARME_SPECIALE_CONTACT`), aucune Base calculable (migration 105).
    // Ne reproduit PAS l'algorithme complet de visibilité de `SkillsPanel.jsx` (SKILL_MIN/MUTATION/
    // GENOTYPE, CHARACTER.md §"Algorithme de visibilité") : non demandé, hors périmètre de cette
    // demande précise.
    db('ref_skills as rs')
      .leftJoin('char_skills as cs', function () {
        this.on('cs.skill_id', '=', 'rs.id').andOn(db.raw('cs.char_sheet_id = ?', [sheet.id]))
      })
      .leftJoin('ref_skills as parent_rs', 'parent_rs.id', 'rs.parent')
      .whereNotNull('rs.attr_1')
      .where(function () {
        this.whereNot('rs.marker', '(X)').orWhereNull('rs.marker').orWhere('cs.is_learned', true)
      })
      .select(
        'rs.id as skill_id', 'cs.mastery', 'cs.is_learned',
        'rs.family', 'rs.family_i18n', 'rs.label', 'rs.label_i18n', 'rs.parent',
        'rs.attr_1', 'rs.attr_2', 'rs.marker', 'rs.description', 'rs.description_i18n',
        'rs.is_category', 'parent_rs.label as parent_label', 'parent_rs.label_i18n as parent_label_i18n',
      ),
    getAdvantages(sheet.id),
    getMutationEffects(sheet.id),
    getInventory(characterId, campaignId),
  ])

  const genotypeRow = archetype?.genotype_id
    ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
    : null

  const attributes = attributeRows.map((attr) => ({
    attr_id: attr.attr_id,
    base_level: attr.base_level,
    pc_modifier: attr.pc_modifier,
    mod_genotype: getGenotypeModForAttr(genotypeRow, attr.attr_id),
    mod_mutation: getMutationModForAttr(mutationEffects, attr.attr_id),
  }))

  const skills = skillRows.map((s) => ({
    skill_id: s.skill_id,
    family: resolveRefField('ref_skills', s, 'family'),
    label: resolveRefField('ref_skills', s, 'label'),
    parent: s.parent,
    parent_label: resolveRefField('ref_skills', { label: s.parent_label, label_i18n: s.parent_label_i18n }, 'label'),
    attr_1: s.attr_1,
    attr_2: s.attr_2,
    marker: s.marker,
    description: resolveRefField('ref_skills', s, 'description'),
    is_category: s.is_category,
    mastery: s.mastery ?? 0,
    is_learned: s.is_learned ?? false,
  }))

  return {
    identity: identity ? { player_name: identity.player_name, char_name: identity.char_name } : null,
    archetype: { genotype_id: archetype?.genotype_id ?? null },
    attributes,
    skills,
    advantages: advantageRows.filter((a) => a.type === 'advantage').map((a) => ({ name: a.name })),
    desavantages: advantageRows.filter((a) => a.type === 'disadvantage').map((a) => ({ name: a.name })),
    inventory: inventory.items,
    sols: sheet.sols,
  }
}
