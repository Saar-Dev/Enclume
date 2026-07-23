// shared/careerAdvantages.js — Wizard Step4 Lot 4 — allocation des Avantages professionnels
// (REGLE_CREATION.txt:1151-1159 : 5 points/an par métier, à répartir librement dans les
// catégories listées par ce métier — pas de plafond par catégorie contrairement aux compétences).
// Fonction pure, réutilisée client (board) + serveur (validation reconcileCreation).

/**
 * @param {Record<string, number>} allocations — { category: pts } pour UN métier
 * @param {{ categories: string[], years: number, randomBudgetDelta?: number }} ctx — catégories
 *   valides de ce métier + années + delta du tirage 1D10 (Lot 6, défaut 0)
 * @returns {{ budget: number, totalSpent: number, remaining: number, perCategory: {category:string,pts:number}[], errors: object[] }}
 */
export function computeProAdvantageAllocation(allocations, ctx) {
  const { categories, years, randomBudgetDelta = 0 } = ctx
  // Un métier sans catégorie listée (ex. Chasseur de primes, LdB p.156) n'accorde aucun avantage
  // professionnel automatique — budget nul, pas 5×années invendables. randomBudgetDelta ignoré dans
  // ce cas : sans budget de base, il n'y a rien à échanger contre un jet (le jet reste possible pour
  // ce métier, mais uniquement narratif — cf. computeRandomBudgetDelta).
  const budget = categories.length === 0 ? 0 : 5 * years + randomBudgetDelta
  const validCategories = new Set(categories)
  const perCategory = []
  const errors = []
  let totalSpent = 0

  for (const [category, pts] of Object.entries(allocations || {})) {
    if (!validCategories.has(category)) {
      errors.push({ code: 'invalid_category', category })
      continue
    }
    if (!Number.isInteger(pts) || pts < 0) {
      errors.push({ code: 'invalid_points', category, pts })
      continue
    }
    if (pts === 0) continue
    totalSpent += pts
    perCategory.push({ category, pts })
  }

  if (totalSpent > budget) errors.push({ code: 'over_budget', budget, totalSpent })

  return { budget, totalSpent, remaining: budget - totalSpent, perCategory, errors }
}

// shared/careerAdvantages.js — Lot 6 — Tirage 1D10 (REGLE_PROFESSION.md, table « Avantages
// professionnels aléatoires » de chaque métier). Choisir de lancer 1D10 pour une tranche de 5 ans
// retire 5 pts du budget automatique de cette tranche ; si le résultat tiré a points_alt non nul
// (roll=10 : « ...ou 7 points à répartir ») et que le joueur choisit explicitement cette option
// plutôt que le bénéfice narratif, la tranche rend points_alt pts au lieu de 5 (net +2 sur roll=10).
// Fonction pure sans accès DB, réutilisée client (UI live) + serveur (validation reconcileCreation).

/**
 * @param {{blockIndex:number, roll:number, useAsPoints?:boolean}[]} picks — tirages d'UN métier
 * @param {{roll:number, points_alt:number|null}[]} benefitRows — ref_career_random_benefits de ce métier
 * @returns {number} delta à additionner au budget 5×années (négatif ou nul)
 */
export function computeRandomBudgetDelta(picks, benefitRows) {
  const rowByRoll = new Map((benefitRows ?? []).map(r => [r.roll, r]))
  let delta = 0
  for (const pick of picks ?? []) {
    delta -= 5
    if (pick.useAsPoints) {
      const row = rowByRoll.get(pick.roll)
      if (row?.points_alt != null) delta += row.points_alt
    }
  }
  return delta
}

// Mécanisation des tirages 1D10 (effets réels, pas seulement narratifs) — fonction pure, appelée
// à chaque reconcileCreation (rejouable) : le total renvoyé est recalculé intégralement à partir
// des picks courants, jamais accumulé entre deux appels. Un pick avec useAsPoints=true est exclu :
// le joueur a choisi les points du budget plutôt que l'effet de cette ligne (jamais les deux).
//
// Types d'effets supportés (ref_career_random_benefits.effects, JSONB) :
//   attribute      { target: 'FOR'|'CON'|'COO'|'ADA'|'PER'|'INT'|'VOL'|'PRE', value }
//   celebrity      { value }
//   skill_points   { value }
//   category       { target: string (catégorie d'avantage pro, ex. 'Matériel'), value }
//   income_percent { value }   — pourcentage additif, appliqué sur l'ensemble des économies du métier
//   income_multiplier { value } — multiplicateur (ex. 2 pour "doublé"), composé par multiplication
//   income_multiplier_permanent { value } — permanent mais plafonné (jamais recomposé si le même
//     résultat retombe) ; Lot 1 : composition par tranche différée au Lot 2 (calcul par bloc de 5
//     ans) — ici, simple prise du maximum sur l'ensemble des picks de CETTE carrière.
//   trait          { trait_type: 'ally'|'contact'|'enemy'|'opponent'|'employer', op:
//                    'gauge_delta'|'gauge_set', value?, note? } — accumulé en liste brute, jamais
//                    fusionné ici (l'upsert char_traits et la conversion Opposant→Ennemi sont la
//                    responsabilité de l'appelant, §8.4 du plan — cette fonction n'a pas accès DB)
//   celebrity_reward { multiplier } — montant = (Célébrité déjà accumulée avant cette carrière +
//                    Célébrité déjà gagnée plus tôt dans CETTE résolution) × multiplier ; calculé
//                    au moment où l'effet est rencontré dans le tableau, donc après les `celebrity`
//                    qui le précèdent sur la même ligne. Le doublement "Mise à prix" sur un résultat
//                    déjà obtenu à une tranche antérieure est une règle de l'appelant (Lot 2), pas
//                    de cette fonction.
//   money_reward   { die, multiplier } — ne lance jamais de dé (fonction pure, sans I/O) : lit
//                    `pick.moneyRoll` (déjà déterminé côté client via DICE_ROLL/DICE_RESULT avant
//                    soumission), montant = moneyRoll × multiplier.
//   grant_mutation { mutation_id, subtype_id? } — instruction inerte, accumulée en liste ; l'appelant
//                    exécute addMutation() après le wipe STEP4 dédié (§14 du plan).
//   choice         { key, options: [{effects:[...], label?}, {effects:[...], label?}] } — une seule
//                    branche résolue, celle dont l'index correspond à `pick.choice` ; `label`
//                    optionnel (Lot 6), lu par getPendingCareerPickStep (Lot 5, UI) pour l'affichage,
//                    jamais utilisé par cette fonction elle-même. Ses effets sont
//                    résolus récursivement (peuvent eux-mêmes contenir n'importe lequel des types
//                    ci-dessus, jamais un `choice` imbriqué dans ce corpus).
//   narrative      { key } — aucune conséquence mécanique (fréquent : "Secret", etc.), reconnu
//                    explicitement pour ne jamais lever une erreur sur ces lignes.
//   add_skill      { skill_id } — ajoute une compétence FIXE (pas un choix joueur) à la liste
//                    professionnelle, ex. Prêtre du Trident résultat 4 ("Acrobatie/Équilibre,
//                    Combat armé"), seul cas parmi les 37 métiers avec des compétences déjà
//                    déterminées par la donnée elle-même. Instruction inerte, accumulée dans
//                    `totals.grantedSkills` — même traitement que `skill_choice` côté appelant
//                    (ajouté à la liste de compétences de cette carrière), jamais de validation
//                    supplémentaire nécessaire (valeur fixe, jamais fournie par le client).
//   skill_choice   {} (aucun champ) — "Formation : ajoute une Compétence au choix à sa liste
//                    professionnelle" (Lot 6, 20 métiers sur 37). La liste des compétences éligibles
//                    vient de `ref_career_skills` pour ce métier (connue par l'appelant, jamais
//                    figée dans le JSONB — même principe que money_reward/choice pour les champs
//                    déjà déterminés côté client). Ne lit jamais lui-même quelle compétence choisir :
//                    exige `pick.chosenSkillId` (nouveau champ, à côté de `choice`/`moneyRoll`/
//                    `useAsPoints`), lève une erreur explicite si absent (même patron que money_reward/
//                    choice, jamais un silence). Accumulé dans `totals.chosenSkills` — l'appelant
//                    (creationService.js) l'ajoute à la liste de compétences de cette carrière,
//                    validée par le budget Q2 déjà existant (computeSkillAllocation), sans nouveau
//                    sous-système.
// Types non couverts par cette étape (grant_advantage, manual_grant_choice, points_cap) :
// n'apparaissent dans aucune des 37 tables de métiers (vérifié) — réservés au résolveur de Revers
// (Lot 3). Un type totalement inconnu lève une erreur explicite, jamais un silence (§8.4).
export function resolveCareerRandomEffects(picks, benefitRows, celebrityBefore = 0, extraEffects = []) {
  const rowByRoll = new Map((benefitRows ?? []).map(r => [r.roll, r]))
  const totals = {
    attributes: {},
    celebrity: 0,
    skillPoints: 0,
    categories: {},
    incomePercent: 0,
    incomeMultiplier: 1,
    incomeMultiplierPermanent: 1,
    traits: [],
    grantedMutations: [],
    // Séparés : la règle "Mise à prix" (Lot 2, doublement si le même résultat retombe dans une
    // tranche ultérieure de la même carrière) ne cible QUE celebrity_reward, jamais money_reward
    // (Marchand itinérant, Pirate résultat 3) — les fusionner en un seul total ferait doubler à
    // tort un money_reward si son numéro de tirage revenait par coïncidence.
    celebrityRewardSols: 0,
    moneyRewardSols: 0,
    chosenSkills: [],
    grantedSkills: [],
  }

  const applyEffect = (effect, pick) => {
    switch (effect.type) {
      case 'attribute':
        totals.attributes[effect.target] = (totals.attributes[effect.target] ?? 0) + effect.value
        break
      case 'celebrity':
        totals.celebrity += effect.value
        break
      case 'skill_points':
        totals.skillPoints += effect.value
        break
      case 'category':
        totals.categories[effect.target] = (totals.categories[effect.target] ?? 0) + effect.value
        break
      case 'income_percent':
        totals.incomePercent += effect.value
        break
      case 'income_multiplier':
        totals.incomeMultiplier *= effect.value
        break
      case 'income_multiplier_permanent':
        totals.incomeMultiplierPermanent = Math.max(totals.incomeMultiplierPermanent, effect.value)
        break
      case 'trait':
        totals.traits.push({
          trait_type: effect.trait_type,
          op: effect.op,
          value: effect.value ?? null,
          note: effect.note ?? null,
        })
        break
      case 'celebrity_reward':
        totals.celebrityRewardSols += (celebrityBefore + totals.celebrity) * effect.multiplier
        break
      case 'money_reward':
        if (!Number.isInteger(pick?.moneyRoll)) {
          throw new Error(`money_reward sans pick.moneyRoll déjà déterminé (roll ${pick?.roll})`)
        }
        totals.moneyRewardSols += pick.moneyRoll * effect.multiplier
        break
      case 'grant_mutation':
        totals.grantedMutations.push({ mutation_id: effect.mutation_id, subtype_id: effect.subtype_id ?? null })
        break
      case 'skill_choice':
        if (!pick?.chosenSkillId) {
          throw new Error(`skill_choice sans pick.chosenSkillId déjà déterminé (roll ${pick?.roll})`)
        }
        totals.chosenSkills.push(pick.chosenSkillId)
        break
      case 'add_skill':
        totals.grantedSkills.push(effect.skill_id)
        break
      case 'choice': {
        const chosen = effect.options?.[pick?.choice]
        if (!chosen) throw new Error(`choice sans pick.choice valide (roll ${pick?.roll})`)
        for (const sub of chosen.effects ?? []) applyEffect(sub, pick)
        break
      }
      case 'narrative':
        // Aucune conséquence mécanique (Assassin/3, Barman/9, Espion/3, Diplomate/9, etc. —
        // fréquent dans les 37 métiers) — reconnu explicitement, jamais un silence non testé ni
        // une erreur : le texte narratif est affiché tel quel côté client, effect.key n'a rien à
        // accumuler ici. `[CORRIGÉ 2026-07-22]` type oublié du switch initial du Lot 1.
        break
      default:
        throw new Error(`Type d'effet inconnu ou hors périmètre carrière : ${effect.type}`)
    }
  }

  for (const pick of picks ?? []) {
    if (pick.useAsPoints) continue
    const row = rowByRoll.get(pick.roll)
    for (const effect of row?.effects ?? []) applyEffect(effect, pick)
  }
  // extraEffects : injection externe (Lot 4, Revers — Renvoi/income_multiplier rattaché à ce bloc
  // précis, PLAN_WIZARD_AVANTAGES.md §17). Seuls des types déjà gérés ici doivent y transiter
  // (income_percent/income_multiplier/income_multiplier_permanent) — l'appelant route tout le reste
  // (trait, grant_advantage, points_cap...) directement vers characterEffectTotals, jamais ici.
  for (const effect of extraEffects ?? []) applyEffect(effect, null)
  return totals
}

// Lot 5 (UI, PLAN_WIZARD_AVANTAGES_IMPLANTATION.md §4bis) — détecte si UN pick de tirage carrière a
// encore besoin d'une réponse du joueur (choice : quelle branche : money_reward : jet de détail)
// avant que resolveCareerRandomEffects puisse le traiter sans lever d'erreur. Contrairement à
// resolveSetbackEffects (Lot 3, résolution récursive multi-étapes), les effets de carrière sont
// TOUJOURS plats — jamais un choice/money_reward imbriqué dans un autre effet — donc pas besoin
// d'une boucle de résolution générique ici, juste une détection de présence au premier niveau.
// Fonction pure, réutilisée client (ProAdvantagesAndSetbacks.jsx) uniquement — le serveur valide via
// resolveCareerRandomEffects lui-même (qui lève une erreur si la réponse manque encore, §17).
/**
 * @param {{roll:number, effects: object[]}|undefined} rolledRow — ligne de ref_career_random_benefits
 *   correspondant au roll du pick (déjà résolue par l'appelant, ex. via benefitByRoll.get(pick.roll))
 * @param {{choice?:number, moneyRoll?:number, useAsPoints?:boolean, chosenSkillId?:string}} pick
 * @returns {{type:'choice', key:string, options:{label:string|null}[]} | {type:'money_reward', die:string} | {type:'skill_choice'} | null}
 */
export function getPendingCareerPickStep(rolledRow, pick) {
  if (!rolledRow || pick?.useAsPoints) return null
  for (const effect of rolledRow.effects ?? []) {
    if (effect.type === 'choice' && pick?.choice == null) {
      return { type: 'choice', key: effect.key, options: (effect.options ?? []).map(o => ({ label: o.label ?? null })) }
    }
    if (effect.type === 'money_reward' && !Number.isInteger(pick?.moneyRoll)) {
      return { type: 'money_reward', die: effect.die }
    }
    if (effect.type === 'skill_choice' && !pick?.chosenSkillId) {
      return { type: 'skill_choice' }
    }
  }
  return null
}

// Lot 2 (PLAN_WIZARD_AVANTAGES.md §Lot E) — économies calculées tranche de 5 ans par tranche,
// pas en un seul total plat sur toute la carrière. Fonction pure, réutilisable client (aperçu live
// pendant le Wizard) + serveur (reconcileCreation), même principe que resolveCareerRandomEffects.
//
// miseAPrixHistory : Map(roll -> montant sols de la dernière occurrence) SCOPÉE À CETTE CARRIÈRE
// (l'appelant gère la partition par career_id s'il traite plusieurs carrières — cette fonction ne
// connaît qu'une carrière à la fois, salary/years sont déjà les siens). Reçue et retournée à
// chaque appel plutôt que mutée en place : reste une fonction pure, pas d'effet de bord caché.
//
// extraEffectsByBlock : Map(blockIndex -> effect[]) — injection externe (Lot 4, Revers rattaché à
// une tranche précise de CETTE carrière via mapSetbackToCareerBlock, careerSetbacks.js). Seuls des
// types déjà gérés par resolveCareerRandomEffects doivent y transiter (income_percent/
// income_multiplier/income_multiplier_permanent) — jamais trait/grant_advantage/points_cap, qui
// n'ont rien à faire dans ce calcul (§17).
export function computeCareerBlockSavings(
  randomPicks, benefitRows,
  { salary, years, celebrityBefore = 0, miseAPrixHistory = new Map(), extraEffectsByBlock = new Map() }
) {
  const maxBlocks = Math.floor(years / 5)
  const blockYears = Array(maxBlocks).fill(5)
  const remainderYears = years - maxBlocks * 5
  if (remainderYears > 0) blockYears.push(remainderYears)
  const pickByBlock = new Map((randomPicks ?? []).filter(p => !p.useAsPoints).map(p => [p.blockIndex, p]))

  let cumulIncomePercent = 0
  let cumulIncomeMultiplierPermanent = 1
  let savings = 0
  const attributes = {}
  const categories = {}
  let celebrity = 0
  let skillPoints = 0
  const traits = []
  const grantedMutations = []
  const chosenSkills = []
  const grantedSkills = []
  const updatedHistory = new Map(miseAPrixHistory)

  for (let blockIndex = 0; blockIndex < blockYears.length; blockIndex++) {
    const pick = pickByBlock.get(blockIndex)
    const blockEffects = resolveCareerRandomEffects(
      pick ? [pick] : [], benefitRows, celebrityBefore + celebrity, extraEffectsByBlock.get(blockIndex)
    )

    // "Mise à prix" (celebrity_reward uniquement, jamais money_reward, §8.1) : si ce résultat de
    // tirage est déjà apparu à une tranche antérieure de cette carrière, double le montant réel
    // obtenu à cette occurrence précédente — jamais recalculé depuis la Célébrité actuelle.
    let celebrityRewardThisBlock = blockEffects.celebrityRewardSols
    if (pick && celebrityRewardThisBlock > 0) {
      const previous = updatedHistory.get(pick.roll)
      if (previous != null) celebrityRewardThisBlock = previous * 2
      updatedHistory.set(pick.roll, celebrityRewardThisBlock)
    }

    // income_percent s'additionne à partir de la tranche où il est gagné (permanent) ;
    // income_multiplier_permanent est plafonné (maximum, jamais recomposé) — mis à jour AVANT le
    // calcul de cette tranche : son propre gain s'applique dès cette même tranche (§Lot E point 2).
    cumulIncomePercent += blockEffects.incomePercent
    cumulIncomeMultiplierPermanent = Math.max(cumulIncomeMultiplierPermanent, blockEffects.incomeMultiplierPermanent)

    savings += Math.round(
      salary * blockYears[blockIndex] * blockEffects.incomeMultiplier * cumulIncomeMultiplierPermanent
        * (1 + cumulIncomePercent / 100)
    ) + celebrityRewardThisBlock + blockEffects.moneyRewardSols

    for (const [attr, delta] of Object.entries(blockEffects.attributes)) {
      attributes[attr] = (attributes[attr] ?? 0) + delta
    }
    for (const [cat, delta] of Object.entries(blockEffects.categories)) {
      categories[cat] = (categories[cat] ?? 0) + delta
    }
    celebrity += blockEffects.celebrity
    skillPoints += blockEffects.skillPoints
    traits.push(...blockEffects.traits)
    grantedMutations.push(...blockEffects.grantedMutations)
    chosenSkills.push(...blockEffects.chosenSkills)
    grantedSkills.push(...blockEffects.grantedSkills)
  }

  return {
    savings, attributes, categories, celebrity, skillPoints, traits, grantedMutations, chosenSkills, grantedSkills,
    miseAPrixHistory: updatedHistory,
  }
}
