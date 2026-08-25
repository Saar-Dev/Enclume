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
// de Test complet) et resolveCombatantIdentity (identité seule, plus bas) en ont toutes deux besoin ;
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

// PLAN_EXOARMURE.md Lot 2bis §9.3 (analyse à charge 2026-08-18, optimisation retenue) — extrait de
// resolveExoTestContext ci-dessous, qui faisait ce même fetch pilote+template inline. Un second
// appelant (resolveExoStandUpAction, Lot 2bis) a besoin des mêmes valeurs — `exoSheet` pour
// resolveManeuverSkillId, `pilot`/`exoStats` pour le Seuil du Test.
// Lot B (§13.3, 2026-08-20) — le JOIN vers `ref_exo_templates` disparaît : `exoSheet` porte désormais
// sa propre base éditable (category/base_exoforce/base_blindage/malus_init_*/...), copiée une fois
// par `applyExoTemplate` au moment de la sélection du modèle. `template_id` reste sur `exo_sheet`
// comme simple référence d'origine, plus une dépendance de calcul — un appelant qui a encore besoin
// du nom du modèle pour affichage (ex. "pré-rempli depuis : Armure Mentor") fait son propre fetch
// séparé, jamais réintroduit ici (fonction partagée par tous les sites de combat, chemin chaud).
// `pilot` reste `null` si aucun pilote n'est assigné (état valide, PLAN_EXOARMURE.md Lot 1 §6.5) —
// jamais un throw ici, la garde revient à chaque appelant.
export async function resolveExoContext(db, exoCharacter) {
  const { pilot, exoSheet } = await resolvePilot(db, exoCharacter)
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

// Exportée (PLAN_EXOARMURE.md Lot 2bis §9.3, analyse à charge 2026-08-18) — resolveExoStandUpAction
// (socketCombatHelpers.js) en a besoin directement pour calculer le Seuil du Test de Manœuvre
// d'armure lui-même, pas seulement pour plafonner une autre Compétence (resolveExoTestContext ci-dessous).
// Lit `exoSheet.environment`/`exoSheet.surface_movement_mode` depuis le Lot B (§13.3, 2026-08-20) —
// plus un `template` séparé, ces champs vivent directement sur exo_sheet.
export function resolveManeuverSkillId(exoSheet) {
  if (exoSheet.environment === 'industrial') {
    throw new Error(
      "exo_sheet.environment='industrial' n'a pas de spécialité Manœuvre d'armure RAW définie " +
      "(décision Saar 2026-08-15 : en suspens) — trancher le mapping avant d'utiliser cette armure " +
      'dans un Test de combat au contact.'
    )
  }
  if (exoSheet.environment === 'hybrid') {
    // PLAN_EXOARMURE.md §16.2.5 (2026-08-23, corrigé le même jour — Saar) — RAW ("le personnage doit
    // développer la Compétence qui correspond à chaque milieu") : une armure hybride peut couvrir 2, 3
    // ou 4 des milieux RAW dans N'IMPORTE QUELLE combinaison, jamais forcément la surface, propre à
    // chaque exo-armure — rien de générique n'est déductible de `environment='hybrid'` seul. **Aucun
    // repli automatique** (tranché explicitement par Saar : "pas de fallback, c'est vraiment
    // spécifique à chaque exo-armure") — une ancienne heuristique surface/sous-marine basée sur
    // `surface_movement_mode` a été retirée d'ici le jour même de son introduction, avant tout usage
    // réel (aucune exo n'a encore combattu) : elle supposait à tort que "hybrid" signifiait toujours
    // "sous-marine ou surface", alors que la règle n'impose aucune paire fixe. Le pilote/MJ DOIT poser
    // `active_maneuver_environment` explicitement (aucune détection temps réel du moteur monde,
    // chantier séparé) — sans ce choix, le Test est impossible, jamais une supposition silencieuse.
    if (!exoSheet.active_maneuver_environment) {
      throw new Error(
        "exo_sheet.environment='hybrid' sans exo_sheet.active_maneuver_environment posé — aucun " +
        "repli automatique (armure hybride, milieu actif spécifique à chaque exo-armure, RAW ne " +
        'permet aucune déduction générique) — le pilote/MJ doit choisir le milieu actif avant ce Test.'
      )
    }
    const chosenSkillId = EXO_MANEUVER_SKILL_BY_ENVIRONMENT[exoSheet.active_maneuver_environment]
    if (!chosenSkillId) {
      throw new Error(
        `exo_sheet.active_maneuver_environment='${exoSheet.active_maneuver_environment}' non géré ` +
        'par resolveManeuverSkillId'
      )
    }
    return chosenSkillId
  }
  const skillId = EXO_MANEUVER_SKILL_BY_ENVIRONMENT[exoSheet.environment]
  if (!skillId) {
    throw new Error(`exo_sheet.environment='${exoSheet.environment}' non géré par resolveManeuverSkillId`)
  }
  return skillId
}

// PLAN_EXOARMURE.md §16.2.1 (2026-08-23, analyse à charge post-Lot G) — RAW (REGLEARMURE.md:202-207,
// "Armures mécanisées — Actions") : "le niveau de la Compétence Manœuvre d'armure [...] limite
// notamment le niveau des Compétences de combat, ainsi que toute autre Compétence servant à
// accomplir une action physique." Aucune distinction Tir/CaC dans le texte source — contrairement à
// l'ancienne doctrine de ce fichier (paramètre `meleeSkillCap`, retiré), qui ne plafonnait que 2 des 6
// appelants réels (CaC) et jamais le tireur ni les 3 sites Acrobatie/Équilibre défensive. Le
// plafonnement est donc désormais inconditionnel pour tout `skillId`, sauf l'exception §16.2.2
// ci-dessous — plus un choix laissé à l'appelant, une seule doctrine, un seul endroit qui la connaît.
async function resolveExoTestContext(db, exoCharacter, skillId) {
  // Fetch unique pilote+exoSheet (resolveExoContext ci-dessus, Lot 2bis §9.3). Depuis le Lot B
  // (§13.3), exoSheet porte déjà sa propre base éditable — plus de JOIN ref_exo_templates à charge
  // de l'appelant.
  const { pilot, exoSheet } = await resolveExoContext(db, exoCharacter)
  if (!pilot) return null

  // computeExoStats (shared/exoStats.js) est synchrone et pure. `null` si exoSheet.category est NULL
  // ("armure non configurée", nouvelle sentinelle Lot B, remplace l'ancien template_id IS NULL du Lot
  // 1 §6.5) — dans ce cas aucun Test n'est possible : ne jamais laisser passer les stats du pilote
  // sans l'override EXF, ce serait une violation silencieuse de la substitution FOR→EXF (§7.1 point
  // 3, "jamais un NaN/undefined silencieux").
  const exoStats = computeExoStats(exoSheet)
  if (!exoStats) return null

  // PLAN_EXOARMURE.md §16.2.2 (2026-08-23) — armures assistées (RAW, REGLEARMURE.md:186-198,
  // "ARMURES ASSISTÉES" p.325) : "dans tous les cas, on n'utilise pas la Compétence Manœuvre
  // d'armure." `exo_sheet.category` couvre déjà `exo-alpha`/`exo-0` (2 templates seedés, Explora/
  // Typhon) — discriminant suffisant, aucune fiche dédiée nécessaire. Le pilote teste alors sa
  // Compétence propre, non plafonnée, exactement comme s'il n'était pas en armure.
  const isAssistedArmor = exoSheet.category === 'exo-alpha' || exoSheet.category === 'exo-0'

  // exoSheet.category (donc les champs de base) est garanti non-null ici (computeExoStats retourne
  // null sinon, ci-dessus).
  let limitingSkillId
  if (!isAssistedArmor) {
    try {
      limitingSkillId = resolveManeuverSkillId(exoSheet)
    } catch (err) {
      // environment='industrial' (aucun template ref_exo_templates ne l'utilise à ce jour, Saar
      // 2026-08-15 "en suspens") ou valeur non mappée — Test impossible, même contrat que "pas de
      // pilote"/"armure non configurée" ci-dessus (retour null, jamais une exception qui remonte
      // jusqu'au socket handler). Avant §16.2.1, seuls 2 appelants passaient par ce chemin
      // (`meleeSkillCap: true`) et un try/catch englobant (socketCombatResolution.js) suffisait ;
      // le plafonnement étant maintenant inconditionnel pour tout Test exo, la garde doit vivre ici,
      // au seul endroit qui connaît la doctrine, pas dupliquée dans chacun des 6 appelants.
      // console.warn plutôt qu'un catch muet (analyse à charge, 2026-08-23) : les 2 seules causes
      // documentées (industrial, active_maneuver_environment invalide) sont couvertes par les CHECK
      // en base (chk_exo_sheet_category exclut 'industrial' de tout template existant tant qu'aucun
      // n'est créé ; chk_exo_sheet_active_maneuver_environment restreint aux 4 valeurs mappées) — ce
      // catch ne devrait donc jamais capturer autre chose qu'elles en usage réel ; le garder générique
      // sans trace masquerait silencieusement un futur bug distinct (ex. faute de frappe dans
      // EXO_MANEUVER_SKILL_BY_ENVIRONMENT) derrière le même "Test impossible" que les cas RAW attendus.
      console.warn(`[combatantContextService] resolveExoTestContext — resolveManeuverSkillId a levé, Test traité comme impossible : ${err.message}`)
      return null
    }
  }

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
export async function resolveCombatantTestContext(db, character, skillId) {
  if (character.type === 'exo') return resolveExoTestContext(db, character, skillId)
  return resolveHumanoidTestContext(db, character, skillId)
}

// Identité de l'acteur EFFECTIF derrière un combattant, sans le reste du contexte de Test — pour les
// appelants qui ont besoin de savoir « quelle fiche / quel utilisateur / quel type de branchement
// combat représente ce combattant » avant même de connaître le skillId à tester (ex. défenseur CaC :
// la main directrice, lue sur cette fiche, sert à choisir l'arme équipée donc la Compétence à tester
// — ordre imposé, pas un choix). Coût minimal pour un humain : 1 requête (`char_sheet`), identique au
// fetch direct qu'il remplace — seul le cas exo paie le coût réel (exo_sheet + pilote + char_sheet du
// pilote), un seul fetch `resolvePilot`, jamais dupliqué avec resolveExoTestContext (§ci-dessus). Ne
// pas utiliser ceci quand skillId est déjà connu : resolveCombatantTestContext(db, character, skillId)
// fait tout en un seul appel, moins coûteux au total qu'un appel ici suivi d'un second appel complet.
//
// `effectiveType` — PLAN_EXOARMURE.md Lot 2 §7.7 (routage de la confirmation de défense pour un
// `type='exo'`, trou trouvé en clôturant ce Lot). Pour un humain, c'est `character.type` tel quel.
// Pour une exo-armure, c'est le type du PILOTE, jamais `'exo'` (qui n'est pas une branche exploitable
// par un appelant qui dispatche pj/pnj/drone) : un exo piloté par un PNJ doit s'auto-résoudre comme
// n'importe quel PNJ (le pilote ne "clique" jamais un bouton de confirmation), un exo piloté par un
// PJ doit prompter CE pilote — jamais le propriétaire brut de la fiche exo, qui peut être quelqu'un
// d'autre (le MJ qui a créé l'armure, un joueur qui ne la pilote plus). Exo sans pilote assigné :
// repli `'pnj'` (auto-résolution — cohérent avec `skillTotal` qui reste à son défaut 0 côté appelant,
// une armure inhabitée ne doit jamais bloquer la FSM en attendant une confirmation qui ne viendra
// jamais). `userId` : `null` chaque fois qu'il n'est pas exploitable (exo sans pilote) — jamais
// `undefined` silencieux.
export async function resolveCombatantIdentity(db, character) {
  if (character.type === 'exo') {
    const { pilot } = await resolvePilot(db, character)
    if (!pilot) return { sheetId: null, userId: null, effectiveType: 'pnj' }
    const sheet = await db('char_sheet').where({ character_id: pilot.id }).first()
    return { sheetId: sheet?.id ?? null, userId: pilot.user_id ?? null, effectiveType: pilot.type }
  }
  const sheet = await db('char_sheet').where({ character_id: character.id }).first()
  return { sheetId: sheet?.id ?? null, userId: character.user_id ?? null, effectiveType: character.type }
}

// Permission « peut agir pour cet exo » — GM, propriétaire (`characters.user_id`) OU pilote lié
// (`exo_sheet.pilot_character_id` → `characters.user_id`). Décision Saar 2026-07-30, tranchée à
// l'origine pour l'édition de fiche (`char-sheet.js:exoIsGmOrOwnerOrPilot`, PLAN_EXOARMURE.md Lot 1
// §6.3) — même autorité étendue ici à la déclaration de combat (Lot 2bis §9.3, trouvée en câblant le
// côté MJ : sans elle, un pilote ≠ propriétaire ne pourrait jamais déclarer d'action pour l'exo qu'il
// pilote, la garde générique de `socketCombatAnnouncement.js` traitant 'exo' comme 'pj' — propriétaire
// brut seul — par défaut de code, pas par décision). Fonction agnostique du framework (`db`/booléens
// nus, pas `req`) — `char-sheet.js` délègue à celle-ci plutôt que de garder sa propre copie (Règle 2
// documentaire, une seule autorité). Réutilise `resolveExoContext` (un seul fetch pilote), jamais un
// second aller-retour DB rien que pour cette vérification.
export async function isExoActorAuthorized(db, exoCharacter, { isGm, userId }) {
  if (isGm) return true
  if (exoCharacter.user_id && exoCharacter.user_id === userId) return true
  const { pilot } = await resolveExoContext(db, exoCharacter)
  return !!(pilot?.user_id && pilot.user_id === userId)
}
