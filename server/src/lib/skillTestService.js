// skillTestService.js — docs/PLANS/PLAN_CHAT_COMMANDES.md §6.
//
// Résolution de /t : jet de compétence immédiat, sans validation MJ (décision Saar — écarte
// gmArbitratedTestService.js, réservé aux Tests arbitrés existants comme ENTITY_ACTION_RESOLVE).
// Réutilise loadCharacterTestContext (characterTestContext.js, même contexte que MACRO_ROLL) et
// resolvePolarisTest (même moteur que tout le reste du projet) — aucun second moteur de calcul.
//
// Cible toujours un personnage du joueur qui tape la commande (characters.where({user_id, campaign_id})
// — jamais un ciblage tiers). Un exo/drone n'a pas user_id (piloté via exo_sheet.pilot_character_id,
// characters.user_id reste NULL) : cette requête l'exclut déjà naturellement, aucun filtre de type
// nécessaire — vérifié dans combatantContextService.js avant de coder.
import { calcSkillTotal } from './charStats.js'
import { getCriticalSuccessBonus } from '../../../shared/polarisTestResolution.js'
import { resolvePolarisTest } from './polarisTestService.js'
import { loadCharacterTestContext } from './characterTestContext.js'
import { maybeTriggerCatastrophe } from './catastropheService.js'
import { getUserColor } from './socketUtils.js'
import { WS } from '../../../shared/events.js'

// Insensible casse/accents — matching exact uniquement (pas de flou/préfixe, décision Saar
// 2026-09-04) : l'autocomplétion client garantit déjà qu'un usage normal tape un nom réel.
function normalizeSkillName(value) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export async function resolveSkillTestCommand(io, db, campaignId, user, { targetName, skillName, difficulty }) {
  // 1. Résoudre le personnage cible parmi ceux du joueur — jamais parmi ceux des autres (brèche sinon).
  const ownCharacters = await db('characters').where({ user_id: user.id, campaign_id: campaignId })
  let character
  if (targetName) {
    const normalizedTarget = normalizeSkillName(targetName)
    character = ownCharacters.find((c) => normalizeSkillName(c.name) === normalizedTarget)
    if (!character) return { error: 'chat.commands.t.characterNotFound', params: { name: targetName } }
  } else if (ownCharacters.length === 1) {
    character = ownCharacters[0]
  } else if (ownCharacters.length === 0) {
    return { error: 'chat.commands.t.noCharacter' }
  } else {
    // Techniquement possible (rien ne l'empêche), n'arrive jamais en pratique (Saar 2026-09-04) —
    // jamais de choix arbitraire silencieux : le joueur précise avec /t @<personnage> ...
    return { error: 'chat.commands.t.multipleCharacters', params: { names: ownCharacters.map((c) => c.name).join(', ') } }
  }

  // 2. Contexte de stats — mêmes requêtes que MACRO_ROLL (characterTestContext.js).
  const context = await loadCharacterTestContext(db, campaignId, character.id)
  if (!context) return { error: 'chat.commands.t.noSheet' }
  const { sheet, attrs, genotypeRow, mutationEffects, activeMalus } = context

  // 3. Résolution exacte de la compétence — contre tout le référentiel (pas seulement les compétences
  // "connues" du personnage) : cohérent avec MACRO_ROLL, qui ne valide jamais qu'une source référence
  // une compétence effectivement apprise (calcSkillTotal dégrade proprement avec charSkill absent).
  // ref_skills.label est le champ d'affichage (pas .name — vérifié dans refI18n.js:27, ref_skills
  // n'a même pas de colonne name ; .label est déjà l'autorité FR, la même valeur que localizeRefRows
  // renverrait au client en locale par défaut, cf. resolveRefField).
  const refSkills = await db('ref_skills')
  const normalizedInput = normalizeSkillName(skillName)
  const refSkill = refSkills.find((s) => normalizeSkillName(s.label) === normalizedInput)
  if (!refSkill) return { error: 'chat.commands.t.skillNotFound', params: { skillName } }
  const charSkill = await db('char_skills').where({ char_sheet_id: sheet.id, skill_id: refSkill.id }).first()

  // 4. Seuil + jet — même convention de signe que le reste du projet (positif = bonus, négatif =
  // malus, ajouté directement au Seuil, socketEntity.js:322-323).
  const skillTotal = calcSkillTotal(attrs, charSkill, refSkill, genotypeRow, mutationEffects)
  const threshold = skillTotal + activeMalus + difficulty
  const criticalSuccessBonus = getCriticalSuccessBonus({ masteryLevel: charSkill?.mastery ?? 0 })
  const { roll, seed, isCriticalSuccess, isCriticalFail, catastropheRisk } =
    await resolvePolarisTest(threshold, criticalSuccessBonus)

  // 5. Broadcast — réutilise DICE_RESULT (même patron que WOUND_INFECTION_ROLL, socketDice.js), pas de
  // nouvel événement WS pour un jet à un seul d20.
  const color = await getUserColor(db, user.id)
  io.to(campaignId).emit(WS.DICE_RESULT, {
    userId: user.id, username: user.username, color,
    formula: `1d20 (${refSkill.label} — ${character.name})`,
    rolls: [roll], total: roll,
    isCriticalSuccess, isCriticalFail, seed, timestamp: new Date().toISOString(), secret: false,
  })

  // 6. Catastrophe automatique obligatoire (décision Saar 2026-09-04) — même garde combat actif que
  // MACRO_ROLL (7ᵉ site RAW, maybeTriggerCatastrophe applique sa propre garde, jamais dupliquée ici).
  const actorToken = await db('tokens').where({ character_id: character.id }).first()
  if (actorToken) {
    await maybeTriggerCatastrophe(io, campaignId, actorToken.id, catastropheRisk, {
      site: 't_command', actorTokenId: actorToken.id, targetTokenId: null,
    })
  }

  return {}
}
