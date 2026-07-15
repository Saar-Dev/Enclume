/**
 * charSheetService.js — Autorité unique pour la création d'une fiche personnage
 * hors Assistant de création (sidebar GM : PJ/PNJ créés d'un bloc, pas via le Wizard).
 *
 * wizard_locked_at posé dès la création : ces fiches n'ont jamais été un brouillon
 * Wizard, donc jamais soumises à la fenêtre de masquage `whereNotExists` de
 * routes/characters.js (voir migration 133_char_sheet_wizard_locked_backfill.js,
 * même règle appliquée aux fiches historiques pré-Wizard).
 */

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
