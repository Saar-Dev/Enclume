// server/src/lib/combatantContextService.js — Résout le contexte de Test combat (Seuil, malus,
// ModDom) d'un combattant, quel que soit son type (pj/pnj/exo) et quel que soit le site appelant.
// Extraction Strangler Fig depuis resolveMeleeAction (socketCombatHelpers.js, site attaquant) —
// chaîne déjà écrite 7 fois avec des variations mineures, jamais un point d'écriture unique jusqu'ici.
// docs/PLANS/PLAN_COMBATANT_CONTEXT.md §3.2-3.4 — Lot G : dispatcher resolveCombatantTestContext +
// branche exo assemblés ici, seul point d'entrée que socketCombatHelpers.js doit appeler désormais
// (jamais resolveHumanoidTestContext directement, sauf ce fichier lui-même et ses tests).
import { calcSkillTotal, calcAttributeNA, getModDom, calcLimitedSkillTotal } from './charStats.js'
import { calcActiveMalus } from './activeMalusRegistry.js'
import { getCampaignSettings } from './campaignSettingsService.js'
import { getMutationEffects } from '../services/mutationService.js'
import { fetchCibleNA } from './damageService.js'
import { computeExoStats } from '../../../shared/exoStats.js'

// skillId=null → palier NA seul (cibles Tir/Drone, PLAN_COMBATANT_CONTEXT.md §2 palier 2) : pas de
// fetch ref_skills/char_skills, { for_na, con_na, vol_na, sheetId } seulement. Délègue à
// damageService.fetchCibleNA — autorité unique pour ce calcul déjà en place depuis le 2026-07-30
// (docs/PLAN_FATIGUE_DOMMAGES.md §9, antérieur à ce plan), jamais réimplémenté ici (Règle 2
// documentaire). Trouvé en scopant le Lot E, corrigé avant qu'un site réel n'utilise ce palier — ne
// l'a jamais fait jusqu'ici, Lots B-D n'ont utilisé que le palier complet ci-dessous.
// skillId fourni → palier complet (attaquant CaC, défenseur CaC, tireur, §2 palier 1) : { skillTotal,
// effectiveMalus, modDom, for_na, con_na, vol_na, sheetId, mastery }. Garde son propre fetch
// attrs/archetype/mutationEffects (pas de délégation à fetchCibleNA ici) : calcSkillTotal a besoin
// des attributs bruts pour la Compétence testée (attr_1/attr_2 quelconques, pas seulement FOR/CON/
// VOL) — réutiliser fetchCibleNA forcerait un second aller-retour DB pour les 3 mêmes tables.
// null si le personnage n'a pas de char_sheet (jamais d'exception — comportement gracieux repris
// des 6 sites qui l'implémentaient déjà chacun séparément).
// `forNAOverride` (interne, réservé à resolveExoTestContext ci-dessous) : substitue l'Exo-Force du
// pilote à sa Force propre, uniquement pour `for_na`/`modDom`/l'encombrement de `effectiveMalus`
// (MANUEL_EXOARMURE.md §4.1 — « La FOR du pilote est ignorée pour les dommages au contact et la
// capacité de port. On utilise l'EXF. ») — jamais pour `skillTotal` (calcSkillTotal recalcule
// l'Attribut directement depuis `attrs`, indépendamment de ce paramètre : la Force PROPRE du pilote
// reste utilisée pour toute Compétence qui la testerait, §0.2 PLAN_COMBATANT_CONTEXT.md, "jamais aux
// autres calculs d'Attribut"). `undefined` par défaut : aucun changement de comportement pour un
// appelant humanoïde direct.
// `limitingSkillId` (interne, réservé au plafond de Compétence de Manœuvre d'armure ci-dessous, mais
// générique — REGLECOMPETENCE.md:29-34 "Compétence limitative" — donc réutilisable un jour par un
// appelant humanoïde direct, ex. Acrobatie/Équilibre en v2) : quand fourni, `skillTotal` est plafonné
// via `calcLimitedSkillTotal` au niveau de cette Compétence limitative, recalculée depuis les mêmes
// `attrs`/`geno`/`mutationEffects` déjà chargés — seuls `charSkill`/`refSkill` de la limitative sont
// fetchés en plus (2 requêtes, même `Promise.all`), jamais un second fetch complet wounds/inventory/
// settings (superflu : la Compétence limitative n'a pas besoin de son propre `effectiveMalus`/
// `modDom`, seul son `skillTotal` sert de plafond).
export async function resolveHumanoidTestContext(db, character, skillId, { forNAOverride, limitingSkillId } = {}) {
  const sheet = await db('char_sheet').where({ character_id: character.id }).first()
  if (!sheet) return null

  if (skillId == null) {
    const { for_na, con_na, vol_na } = await fetchCibleNA(db, character.id, sheet.id)
    return { sheetId: sheet.id, for_na: forNAOverride ?? for_na, con_na, vol_na }
  }

  const [
    attrs, archetype, mutationEffects, charSkill, refSkill, wounds, inventory, settings,
    limitingCharSkill, limitingRefSkill,
  ] = await Promise.all([
    db('char_attributes').where({ char_sheet_id: sheet.id }),
    db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
    getMutationEffects(sheet.id),
    db('char_skills').where({ char_sheet_id: sheet.id, skill_id: skillId }).first(),
    db('ref_skills').where({ id: skillId }).first(),
    db('character_wounds').where({ char_sheet_id: sheet.id }),
    db('char_inventory')
      .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
      .where({ 'char_inventory.character_id': character.id })
      .select('char_inventory.container', 'char_inventory.quantity', 'ref_equipment.weight as ref_weight'),
    getCampaignSettings(db, character.campaign_id),
    limitingSkillId ? db('char_skills').where({ char_sheet_id: sheet.id, skill_id: limitingSkillId }).first() : null,
    limitingSkillId ? db('ref_skills').where({ id: limitingSkillId }).first() : null,
  ])
  const geno = archetype?.genotype_id
    ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
    : null

  const for_na = forNAOverride ?? calcAttributeNA(attrs, 'FOR', geno, mutationEffects)
  const con_na = calcAttributeNA(attrs, 'CON', geno, mutationEffects)
  const vol_na = calcAttributeNA(attrs, 'VOL', geno, mutationEffects)

  let skillTotal = refSkill ? calcSkillTotal(attrs, charSkill, refSkill, geno, mutationEffects) : 0
  const mastery = charSkill?.mastery ?? 0

  if (limitingSkillId) {
    if (!limitingRefSkill) throw new Error(`Compétence limitative introuvable dans ref_skills : ${limitingSkillId}`)
    const limitingSkillTotal = calcSkillTotal(attrs, limitingCharSkill, limitingRefSkill, geno, mutationEffects)
    skillTotal = calcLimitedSkillTotal(skillTotal, limitingSkillTotal)
  }

  const totalWeight = inventory.reduce((sum, i) =>
    (i.container === 'Coffre' || i.ref_weight == null) ? sum : sum + i.ref_weight * i.quantity, 0
  )
  const effectiveMalus = calcActiveMalus({
    wounds, fatiguePoints: sheet.fatigue_points, totalWeight, forNA: for_na, settings,
  })
  const modDom = getModDom(for_na)

  return { skillTotal, effectiveMalus, modDom, for_na, con_na, vol_na, sheetId: sheet.id, mastery }
}

// PLAN_COMBATANT_CONTEXT.md §3.4 (Lot G) — Contexte de Test d'un pilote d'exo-armure. L'exo-armure
// est un personnage à part entière (MANUEL_EXOARMURE.md §3.1 : « Elle possède une fiche, peut être
// sélectionnée dans le roster de combat, et reçoit un token sur la carte »), distinct du pilote —
// jamais fusionnés, jamais de stats copiées de l'un vers l'autre (§0.3 du plan). `exoCharacter` est
// donc le personnage qui agit réellement en combat (celui dont le token attaque) ; il n'a jamais de
// `char_sheet` (il a une `exo_sheet`) — c'est pour ça que resolveHumanoidTestContext(exoCharacter, ...)
// renverrait toujours null. Le pilote (PJ/PNJ, référencé par exo_sheet.pilot_character_id) a lui une
// `char_sheet` normale — ses attributs/Compétences sont utilisés tels quels (MANUEL_EXOARMURE.md
// §4.1), sauf la Force, remplacée par l'Exo-Force de l'armure pour les dommages au contact/port
// (même §4.1 — seule substitution actée à ce jour, docs/PLANS/PLAN_COMBATANT_CONTEXT.md §0.2).
// Une seule autorité pour « comment retrouver le pilote d'un exo » — resolveExoTestContext (contexte
// de Test complet) et resolveCombatantSheetId (identité seule, plus bas) en ont toutes deux besoin ;
// jamais deux copies de ce fetch exo_sheet→characters.
async function resolvePilot(db, exoCharacter) {
  const exoSheet = await db('exo_sheet').where({ character_id: exoCharacter.id }).first()
  if (!exoSheet?.pilot_character_id) return { pilot: null, exoSheet }  // pas de pilote assigné
  const pilot = await db('characters').where({ id: exoSheet.pilot_character_id }).first()
  // pilot peut être null si la ligne characters a disparu entre les deux lectures (FK ON DELETE
  // SET NULL couvre la suppression déjà commitée ; garde explicite pour la fenêtre de concurrence,
  // même raison que Lot B, resolveMeleeAction : « garde explicite plutôt qu'une confiance aveugle »).
  return { pilot, exoSheet }
}

// Manœuvre d'armure — 4 spécialités RAW (REGLEARMURE.md p.325, texte complet PLAN_EXOARMURE.md §7.2),
// indexées sur `ref_exo_templates.environment`. La colonne DB a 6 valeurs possibles
// (233_exo_sheet.js:51-52 — chk_exo_template_environment), 2 de plus que les spécialités RAW :
// - `industrial` : pas un milieu au sens Manœuvre d'armure (RAW ne le nomme pas), plutôt un usage —
//   tranché "en suspens" par Saar (2026-08-15, aucun template industriel n'existe encore, table
//   `ref_exo_templates` vide) — pas de repli silencieux (même doctrine que computeExoStats §7.1 point
//   3 : rejeter explicitement plutôt que deviner une spécialité).
// - `hybrid` : "de nombreuses armures hybrides peuvent être utilisées dans plusieurs milieux
//   différents [...] le personnage doit développer la Compétence qui correspond à chaque milieu"
//   (REGLEARMURE.md, cité PLAN_EXOARMURE.md §7.2) — RAW veut la spécialité du milieu où le pilote se
//   bat RÉELLEMENT à cet instant ("se retrouve à la surface... utilisera Armure externe"), information
//   que le moteur monde n'expose pas en temps réel (même lacune EAU1 que `getExoMovementBudget`,
//   movementBudgetService.js §7.4). **Ce qui suit n'approxime PAS "où est le pilote maintenant"** —
//   ça vérifie seulement si ce template peut au moins bouger en surface (`surface_movement_mode`,
//   colonne dont la valeur par défaut est `'vit'`, jamais `'blocked'` sauf réglage explicite) : en
//   pratique, la quasi-totalité des templates hybrides résoudront donc toujours vers Armures externes,
//   quel que soit le milieu réel du combat. Choix délibéré par défaut (documenté, pas caché) tant que
//   le signal d'immersion temps réel n'existe pas — à corriger le jour où il existera, un seul point
//   de bascule ci-dessous.
const EXO_MANEUVER_SKILL_BY_ENVIRONMENT = {
  submarine: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES',
  surface: 'MANOEUVRE_DARMURE__ARMURES_EXTERNES',
  atmospheric: 'MANOEUVRE_DARMURE__ARMURES_ATMOSPHERIQUES',
  spatial: 'MANOEUVRE_DARMURE__ARMURES_SPATIALES',
}

function resolveManeuverSkillId(template) {
  if (template.environment === 'industrial') {
    throw new Error(
      "ref_exo_templates.environment='industrial' n'a pas de spécialité Manœuvre d'armure RAW " +
      "définie (décision Saar 2026-08-15 : en suspens) — trancher le mapping avant d'utiliser ce " +
      'template dans un Test de combat au contact.'
    )
  }
  if (template.environment === 'hybrid') {
    return template.surface_movement_mode === 'blocked'
      ? EXO_MANEUVER_SKILL_BY_ENVIRONMENT.submarine
      : EXO_MANEUVER_SKILL_BY_ENVIRONMENT.surface
  }
  const skillId = EXO_MANEUVER_SKILL_BY_ENVIRONMENT[template.environment]
  if (!skillId) {
    throw new Error(`ref_exo_templates.environment='${template.environment}' non géré par resolveManeuverSkillId`)
  }
  return skillId
}

// `meleeSkillCap` (booléen, fourni par l'appelant — resolveCombatantTestContext/socketCombatHelpers.js
// sait, lui, s'il résout un Test de combat au contact ou non ; ce fichier ne classe pas les
// `skillId` par nature) : PLAN_EXOARMURE.md §7.2, RAW "le niveau de Manœuvre d'armure limite [...] les
// Compétences de combat [...] au contact. Les Compétences de combat à distance ne sont, elles, pas
// limitées." — jamais activé pour un tireur ni pour les sites Acrobatie/Équilibre (v2, hors périmètre
// de ce Lot 2).
async function resolveExoTestContext(db, exoCharacter, skillId, { meleeSkillCap } = {}) {
  const { pilot, exoSheet } = await resolvePilot(db, exoCharacter)
  if (!pilot) return null

  const template = exoSheet.template_id
    ? await db('ref_exo_templates').where({ id: exoSheet.template_id }).first()
    : null
  // computeExoStats (shared/exoStats.js) est synchrone et pure — le join exo_sheet → ref_exo_templates
  // reste à la charge de cet appelant (contrat fixé PLAN_EXOARMURE.md §7.1 point 1). `null` si aucun
  // template n'est assigné ("armure non configurée", MANUEL_EXOARMURE.md/PLAN_EXOARMURE.md §6.5) —
  // dans ce cas aucun Test n'est possible : ne jamais laisser passer les stats du pilote sans
  // l'override EXF, ce serait une violation silencieuse de la substitution FOR→EXF (§7.1 point 3,
  // "jamais un NaN/undefined silencieux").
  const exoStats = computeExoStats(exoSheet, template)
  if (!exoStats) return null

  // template est garanti non-null ici (computeExoStats retourne null sans template, ci-dessus).
  const limitingSkillId = meleeSkillCap ? resolveManeuverSkillId(template) : undefined

  // forNAOverride propage l'EXF à for_na/modDom/l'encombrement de effectiveMalus, calculés depuis le
  // départ avec l'EXF plutôt que rafistolés après coup (un `modDom`/`effectiveMalus` déjà calculés
  // avec la FOR du pilote puis simplement écrasés en surface resterait faux — trouvé en relisant ce
  // fichier, corrigé avant qu'un vrai combat n'en dépende). skillTotal n'est affecté que si
  // `limitingSkillId` est fourni (plafond de Compétence, sinon comportement RAW voulu, pas un oubli).
  return resolveHumanoidTestContext(db, pilot, skillId, { forNAOverride: exoStats.exf, limitingSkillId })
}

// PLAN_COMBATANT_CONTEXT.md §3.2 (Lot G) — Point d'entrée unique : socketCombatHelpers.js ne doit
// plus jamais appeler resolveHumanoidTestContext directement, toujours ce dispatcher. Guard clauses,
// pas de table (§1 du plan, doctrine Fowler déjà appliquée dans ce fichier) — seulement 2 branches
// réelles aujourd'hui (pj/pnj traités identiquement, exo). Les drones n'appellent jamais ce point
// d'entrée (§3.5 du plan — drone_programs.level sert directement de Seuil, aucun char_sheet impliqué).
export async function resolveCombatantTestContext(db, character, skillId, { meleeSkillCap } = {}) {
  if (character.type === 'exo') return resolveExoTestContext(db, character, skillId, { meleeSkillCap })
  return resolveHumanoidTestContext(db, character, skillId)
}

// Identité seule (sheetId), sans le reste du contexte de Test — pour les appelants qui ont besoin de
// savoir « quelle fiche représente ce combattant » avant même de connaître le skillId à tester (ex.
// défenseur CaC : la main directrice, lue sur cette fiche, sert à choisir l'arme équipée donc la
// Compétence à tester — ordre imposé, pas un choix). Coût minimal pour un humain : 1 requête
// (`char_sheet`), identique au fetch direct qu'il remplace — seul le cas exo paie le coût réel
// (exo_sheet + pilote + char_sheet du pilote). Ne pas utiliser ceci quand skillId est déjà connu :
// resolveCombatantTestContext(db, character, skillId) fait tout en un seul appel, moins coûteux au
// total qu'un appel ici suivi d'un second appel complet.
export async function resolveCombatantSheetId(db, character) {
  if (character.type === 'exo') {
    const { pilot } = await resolvePilot(db, character)
    if (!pilot) return null
    const sheet = await db('char_sheet').where({ character_id: pilot.id }).first()
    return sheet?.id ?? null
  }
  const sheet = await db('char_sheet').where({ character_id: character.id }).first()
  return sheet?.id ?? null
}
