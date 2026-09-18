// server/src/lib/reactionService.js
//
// computeCharacterBaseIni(db, characterId) — Réaction / Initiative de base (calcREA, LdB
// REGLESYSCOMBAT.md:110 « le score d'Initiative de base d'un personnage est tout simplement égal à
// son niveau de Réaction »), autorité unique pour les appelants qui n'ont pas déjà un contexte
// attrs/avantages en main (COMBAT_START branche humanoïde, GET /battlemaps/:id/combat-ini — aperçu
// roster hors combat). Les sites qui partagent déjà un contexte multi-valeurs (loadCharacterTestContext,
// socketDice.js MACRO_ROLL / char-sheet.js) continuent d'appeler calcREA directement avec leur `na`/
// `advantages` déjà chargés — les faire passer par ici dupliquerait le fetch, pas l'inverse.
//
// Module FEUILLE délibérément séparé de combatantContextService.js : ce dernier importe déjà
// damageService.js, qui importe woundService.js — woundService.js doit pouvoir appeler cette fonction
// (INI2, recalcul d'Initiative après blessure) sans fermer ce cycle d'import (même contrainte déjà
// documentée dans combatantContextService.js pour resolveExoContext/exoPilotService.js).
import { calcAttributeNA } from './charStats.js'
import { calcREA, getAdvantageModForAttr } from '../../../shared/polarisUtils.js'
import { getAdvantages } from '../services/advantageService.js'

// null si le personnage n'a pas de char_sheet (drone/exo — pas de repli générique ici, chaque
// appelant sait déjà traiter ces types séparément, cf. COMBAT_START). Mutations non prises en compte,
// à l'identique des 2 sites remplacés par cette fonction (comportement préexistant, pas une régression).
export async function computeCharacterBaseIni(db, characterId) {
  const sheet = await db('char_sheet').where({ character_id: characterId }).first()
  if (!sheet) return null

  const [attrs, archetype, advantages] = await Promise.all([
    db('char_attributes').where({ char_sheet_id: sheet.id }),
    db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
    getAdvantages(sheet.id),
  ])
  const genotypeRow = archetype?.genotype_id
    ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
    : null

  const ada_na = calcAttributeNA(attrs, 'ADA', genotypeRow)
  const per_na = calcAttributeNA(attrs, 'PER', genotypeRow)
  return calcREA(ada_na, per_na, getAdvantageModForAttr(advantages, 'reaction'))
}
