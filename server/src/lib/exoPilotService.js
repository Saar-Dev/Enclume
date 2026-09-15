// server/src/lib/exoPilotService.js — Résolution du pilote d'une exo-armure. Extrait de
// combatantContextService.js (2026-09-12, chantier Chance L5) pour casser un cycle d'import :
// combatantContextService.js importe damageService.js (fetchCibleNA), qui importe lui-même
// woundService.js (applyWound) — un woundService.js qui aurait dû importer resolveExoContext
// depuis combatantContextService.js aurait donc bouclé (woundService → combatantContextService →
// damageService → woundService). Ce fichier n'a AUCUNE dépendance (feuille du graphe d'import) :
// `db` est toujours reçu en paramètre, jamais importé — combatantContextService.js réexporte
// resolveExoContext depuis ici pour que ses propres appelants n'aient rien à changer.
export async function resolvePilot(db, exoCharacter) {
  const exoSheet = await db('exo_sheet').where({ character_id: exoCharacter.id }).first()
  if (!exoSheet?.pilot_character_id) return { pilot: null, exoSheet }  // pas de pilote assigné
  const pilot = await db('characters').where({ id: exoSheet.pilot_character_id }).first()
  // pilot peut être null si la ligne characters a disparu entre les deux lectures (FK ON DELETE
  // SET NULL couvre la suppression déjà commitée ; garde explicite pour la fenêtre de concurrence,
  // même raison que Lot B, resolveMeleeAction : « garde explicite plutôt qu'une confiance aveugle »).
  return { pilot, exoSheet }
}

// `pilot` reste `null` si aucun pilote n'est assigné (état valide, PLAN_EXOARMURE.md Lot 1 §6.5) —
// jamais un throw ici, la garde revient à chaque appelant.
export async function resolveExoContext(db, exoCharacter) {
  const { pilot, exoSheet } = await resolvePilot(db, exoCharacter)
  return { pilot, exoSheet }
}

// resolveChanceRecipientCharacterId — id du personnage dont le char_sheet doit recevoir un choix
// Chance, à partir de l'id ET du type d'un combattant quelconque (PLAN_CHANCE.md L3e-4d).
// - pj/pnj : le personnage a son propre char_sheet, retourné tel quel.
// - exo : aucun char_sheet propre — la Chance appartient au PILOTE.
// - drone : aucun char_sheet, jamais de Chance possible (combatantContextService.js:283-287, même
//   exclusion que drone_attack) — retourne null, l'appelant doit alors sauter openChanceChoice.
export async function resolveChanceRecipientCharacterId(db, characterId, characterType) {
  if (characterType === 'drone') return null
  if (characterType === 'exo') {
    const exoCharacter = await db('characters').where({ id: characterId }).first()
    if (!exoCharacter) return null
    const { pilot } = await resolveExoContext(db, exoCharacter)
    return pilot?.id ?? null
  }
  return characterId
}
