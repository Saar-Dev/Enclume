/**
 * charSheetService.js — Autorité unique pour la création d'une fiche personnage
 * hors Assistant de création (sidebar GM : PJ/PNJ créés d'un bloc, pas via le Wizard ;
 * Coffre : création directe par le propriétaire, docs/EN_COURS.md 2026-08-16).
 *
 * wizard_locked_at posé dès la création (createEmptySheet) : ces fiches n'ont jamais été un
 * brouillon Wizard, donc jamais soumises à la fenêtre de masquage `whereNotExists` de
 * routes/characters.js (voir migration 133_char_sheet_wizard_locked_backfill.js, même règle
 * appliquée aux fiches historiques pré-Wizard). Sans effet sur l'accès Coffre depuis le retrait du
 * gel `wizard_locked_at` de char-sheet.js (2026-08-16) — reste posé pour la cohérence historique de
 * ce champ, plus pour un contrôle d'accès dans ce cas précis.
 */

import { WOUND_MAX_COUNTS } from '../../../shared/woundConstants.js'
import { initDamages } from '../../../shared/droneConstants.js'

const ATTR_IDS = ['FOR', 'CON', 'COO', 'ADA', 'PER', 'INT', 'VOL', 'PRE']

export async function createEmptySheet(trx, characterId) {
  const [sheet] = await trx('char_sheet')
    .insert({ character_id: characterId, wizard_locked_at: trx.fn.now() })
    .returning('*')

  await trx('char_identity').insert({ char_sheet_id: sheet.id })
  await trx('char_archetype').insert({ char_sheet_id: sheet.id })
  await trx('char_attributes').insert(
    ATTR_IDS.map(attr_id => ({
      char_sheet_id: sheet.id,
      attr_id,
      base_level: 7,
      pc_modifier: 0,
    }))
  )

  return sheet
}

// Autorité unique pour la fiche associée à un personnage créé "d'un bloc" (hors Wizard), quel que
// soit son type — extraite de routes/characters.js (POST campagne) pour être réutilisée telle
// quelle par routes/vault.js (POST Coffre, 2026-08-16) sans dupliquer le branchement par type.
export async function createCompanionSheet(trx, { characterId, type }) {
  if (type === 'drone') {
    const damages = initDamages('corps', WOUND_MAX_COUNTS)
    await trx('drone_sheet').insert({ character_id: characterId, damages: JSON.stringify(damages) })
  } else if (type === 'exo') {
    // template_id absent : aucun sélecteur de template en création, assigné plus tard via
    // PUT /:characterId/exo — état "non configurée" valide (docs/PLANS/PLAN_EXOARMURE.md §6.5).
    await trx('exo_sheet').insert({ character_id: characterId })
  } else {
    await createEmptySheet(trx, characterId)
  }
}
