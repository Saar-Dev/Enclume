import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  WOUND_PENALTIES, isTestBlockingWound, isMortalWoundImmobilized, WOUND_HEALING, WOUND_INFECTION, woundSeverityForDamage,
  WOUND_SEVERITIES, WOUND_LOCATIONS, WOUND_MAX_COUNTS, SEVERITY_COLORS, BLESSURE_SEUILS_TABLE, TEST_BLOCKING_SEVERITIES,
  isWoundLineFull, isSuddenDeathLocation, getWoundEffects, isFatalWound, hasFatalWound,
  getWoundHealing, WOUND_IMPROVEMENT_TARGET, DUREE_GUERISON_SOINS_TABLE,
  WOUND_CHANCE_STEP_COST, chanceCostOfStep, maxNormalChanceDegrees,
  CARE_KIT_TYPES, SOINS_CONSTANTS_INTERVAL_MINUTES, getHealingTotalTests, isFirstHealingTest, getCareKits, defaultCareKits, sumCareKits,
} from './woundConstants.js'

test('woundSeverityForDamage - la plus haute ligne dont le seuil est atteint (LdB p.234)', () => {
  assert.equal(woundSeverityForDamage(0), null)
  assert.equal(woundSeverityForDamage(4), null)
  assert.equal(woundSeverityForDamage(5), 'legere')
  assert.equal(woundSeverityForDamage(9), 'legere')
  assert.equal(woundSeverityForDamage(10), 'moyenne')
  assert.equal(woundSeverityForDamage(14), 'moyenne')
  assert.equal(woundSeverityForDamage(15), 'grave')
  assert.equal(woundSeverityForDamage(20), 'critique')
  assert.equal(woundSeverityForDamage(24), 'critique')
  assert.equal(woundSeverityForDamage(25), 'mortelle')
  assert.equal(woundSeverityForDamage(29), 'mortelle')
  assert.equal(woundSeverityForDamage(30), 'mort_subite')
  assert.equal(woundSeverityForDamage(99), 'mort_subite')
})

test('WOUND_PENALTIES.mortelle - plus de sentinel numérique (LdB : "non applicable")', () => {
  assert.equal(WOUND_PENALTIES.mortelle, 0)
})

test('isTestBlockingWound - détecte une blessure mortelle', () => {
  assert.equal(isTestBlockingWound([{ severity: 'critique' }, { severity: 'mortelle', location: 'corps' }]), true)
})

test('isTestBlockingWound - grave/critique seuls ne bloquent pas', () => {
  assert.equal(isTestBlockingWound([{ severity: 'grave' }, { severity: 'critique' }]), false)
})

test('isTestBlockingWound - tableau vide/absent -> false', () => {
  assert.equal(isTestBlockingWound([]), false)
  assert.equal(isTestBlockingWound(), false)
})

test('isMortalWoundImmobilized - jambe mortelle bloque même le déplacement', () => {
  assert.equal(isMortalWoundImmobilized([{ severity: 'mortelle', location: 'jambe_gauche' }]), true)
  assert.equal(isMortalWoundImmobilized([{ severity: 'mortelle', location: 'jambe_droite' }]), true)
})

test('isMortalWoundImmobilized - bras/corps/tête mortelle laisse le déplacement lente possible', () => {
  assert.equal(isMortalWoundImmobilized([{ severity: 'mortelle', location: 'bras_droit' }]), false)
  assert.equal(isMortalWoundImmobilized([{ severity: 'mortelle', location: 'corps' }]), false)
  assert.equal(isMortalWoundImmobilized([{ severity: 'mortelle', location: 'tete' }]), false)
})

test('WOUND_HEALING - durées RAW en minutes (REGLEBLESSURES.md:420-433, vérifiées contre le LdB p.238)', () => {
  assert.equal(WOUND_HEALING.moyenne.durationMinutes, 3 * 1440)
  assert.equal(WOUND_HEALING.grave.durationMinutes, 7 * 1440)
  assert.equal(WOUND_HEALING.critique.durationMinutes, 21 * 1440)
  assert.equal(WOUND_HEALING.mortelle.durationMinutes, 35 * 1440)
  assert.equal(WOUND_HEALING.legere, undefined) // guérit seule, jamais d'échéance
})

test('WOUND_HEALING - soinsConstants distingue les échéances uniques des récurrentes', () => {
  assert.equal(WOUND_HEALING.moyenne.soinsConstants, false)
  assert.equal(WOUND_HEALING.grave.soinsConstants, false)
  assert.equal(WOUND_HEALING.critique.soinsConstants, true)
  assert.equal(WOUND_HEALING.mortelle.soinsConstants, true)
})

test('WOUND_INFECTION - modificateurs de base RAW (REGLEBLESSURES.md:436-472, vérifiés p.239-240)', () => {
  assert.equal(WOUND_INFECTION.moyenne.baseModifier, 5)
  assert.equal(WOUND_INFECTION.grave.baseModifier, 0)
  assert.equal(WOUND_INFECTION.critique.baseModifier, -5)
  assert.equal(WOUND_INFECTION.mortelle.baseModifier, -10)
  assert.equal(WOUND_INFECTION.legere, undefined)
})

test('WOUND_INFECTION - caseMalus absent uniquement pour Moyenne (relecture RAW attentive)', () => {
  assert.equal(WOUND_INFECTION.moyenne.caseMalus, false)
  assert.equal(WOUND_INFECTION.grave.caseMalus, true)
  assert.equal(WOUND_INFECTION.critique.caseMalus, true)
  assert.equal(WOUND_INFECTION.mortelle.caseMalus, true)
})

test('WOUND_INFECTION - infectsOnSuccess vrai uniquement pour Critique/Mortelle', () => {
  assert.equal(WOUND_INFECTION.moyenne.infectsOnSuccess, false)
  assert.equal(WOUND_INFECTION.grave.infectsOnSuccess, false)
  assert.equal(WOUND_INFECTION.critique.infectsOnSuccess, true)
  assert.equal(WOUND_INFECTION.mortelle.infectsOnSuccess, true)
})

// ─── 6ᵉ ligne (mort_subite) — cohérence des tables, promotion, Choc, Test interdit ────────────────────────

test('6 lignes : chaque gravité a une capacité par localisation, une couleur, un malus et un seuil (aucune table en retard)', () => {
  assert.deepEqual(WOUND_SEVERITIES, ['legere', 'moyenne', 'grave', 'critique', 'mortelle', 'mort_subite'])
  for (const loc of WOUND_LOCATIONS) {
    assert.deepEqual(Object.keys(WOUND_MAX_COUNTS[loc]), WOUND_SEVERITIES, `capacités de ${loc}`)
    assert.equal(WOUND_MAX_COUNTS[loc].mort_subite, 1, `la 6ᵉ ligne n'a qu'une case (${loc})`)
  }
  assert.deepEqual(Object.keys(SEVERITY_COLORS), WOUND_SEVERITIES)
  assert.deepEqual(Object.keys(WOUND_PENALTIES), WOUND_SEVERITIES)
  assert.deepEqual(BLESSURE_SEUILS_TABLE.map(r => r.key), WOUND_SEVERITIES)
  assert.deepEqual(BLESSURE_SEUILS_TABLE.map(r => r.seuil), [5, 10, 15, 20, 25, 30])
})

test('capacités du compteur : identiques à la fiche papier (capture vérifiée 2026-09-24)', () => {
  const papier = {
    tete:         [3, 3, 2, 2, 1],
    corps:        [4, 3, 3, 2, 2],
    bras_droit:   [3, 3, 2, 2, 1],
    bras_gauche:  [3, 3, 2, 2, 1],
    jambe_droite: [3, 3, 2, 2, 1],
    jambe_gauche: [3, 3, 2, 2, 1],
  }
  for (const [loc, counts] of Object.entries(papier)) {
    assert.deepEqual(WOUND_SEVERITIES.slice(0, 5).map(s => WOUND_MAX_COUNTS[loc][s]), counts, loc)
  }
})

// Réécrit le 2026-09-26 (PLAN_GUERISON_RAW, Lot A) : les 2 tests `isWoundLinePromoted` encodaient « la case qui remplirait la
// dernière convertit » (seuil max-1, exception Mortelle) ; le livre (REGLEBLESSURES.md:47-53) dit « toutes les cases cochées PUIS une nouvelle blessure ».
test('isWoundLineFull - le livre : la ligne est pleine quand TOUTES ses cases sont cochées ; c\'est la blessure SUIVANTE qui convertit', () => {
  // Légère à 3 cases (Tête) : 2 présentes → la 3ᵉ se coche (pas de conversion) ; 3 présentes → pleine, la 4ᵉ convertit.
  assert.equal(isWoundLineFull(2, 3), false)
  assert.equal(isWoundLineFull(3, 3), true)
  assert.equal(isWoundLineFull(1, 2), false) // Grave à 2 cases : la 2ᵉ Grave tient
  assert.equal(isWoundLineFull(2, 2), true)
  assert.equal(isWoundLineFull(0, 3), false)
})

test('isWoundLineFull - une seule règle pour toutes les lignes : la ligne Mortelle n\'est plus une exception', () => {
  // Tête/bras/jambes (1 case) : la 1ʳᵉ Mortelle se coche, la 2ᵉ convertit.
  assert.equal(isWoundLineFull(0, 1), false)
  assert.equal(isWoundLineFull(1, 1), true)
  // Corps (2 cases) : 2 Mortelles tiennent, la 3ᵉ convertit.
  assert.equal(isWoundLineFull(1, 2), false)
  assert.equal(isWoundLineFull(2, 2), true)
})

test('isWoundLineFull - une ligne déjà au-dessus de sa capacité (ancien défaut de guérison) reste pleine', () => {
  assert.equal(isWoundLineFull(5, 3), true)
})

test('isWoundLineFull - appliquée à la capacité réelle de chaque ligne : jamais pleine à vide, toujours pleine à la capacité', () => {
  for (const loc of WOUND_LOCATIONS) {
    for (const sev of WOUND_SEVERITIES) {
      const max = WOUND_MAX_COUNTS[loc][sev]
      assert.equal(isWoundLineFull(max - 1, max), false, `${loc}/${sev} : ${max - 1}/${max}`)
      assert.equal(isWoundLineFull(max, max), true, `${loc}/${sev} : ${max}/${max}`)
    }
  }
})

test('isSuddenDeathLocation - Mort en Tête/Corps, Membre détruit sur un bras ou une jambe', () => {
  assert.equal(isSuddenDeathLocation('tete'), true)
  assert.equal(isSuddenDeathLocation('corps'), true)
  for (const loc of ['bras_droit', 'bras_gauche', 'jambe_droite', 'jambe_gauche']) assert.equal(isSuddenDeathLocation(loc), false, loc)
})

// Copie FIGÉE de l'ancien `getShockMalus` de charStats.js (avant la 6ᵉ ligne) : la table BLESSURE_EFFETS_TABLE,
// désormais autorité du malus au Choc, doit rendre exactement les mêmes valeurs sur les 5 gravités historiques.
function legacyShockMalus(severity, location, isLethal) {
  const MEMBERS = ['bras_droit', 'bras_gauche', 'jambe_droite', 'jambe_gauche']
  if (isLethal && MEMBERS.includes(location)) return -10
  if (severity === 'grave') return location === 'tete' ? -5 : 0
  if (severity === 'critique') {
    if (location === 'tete')  return -10
    if (location === 'corps') return -5
    return 0
  }
  if (severity === 'mortelle') {
    if (location === 'tete')  return -15
    if (location === 'corps') return -10
    return -5
  }
  return 0
}

test('getWoundEffects - malus de Choc identique à l\'ancienne fonction sur les 5 gravités × 6 localisations', () => {
  for (const sev of WOUND_SEVERITIES.slice(0, 5)) {
    for (const loc of WOUND_LOCATIONS) {
      assert.equal(getWoundEffects(sev, loc)?.malusChoc ?? 0, legacyShockMalus(sev, loc, false), `${sev} / ${loc}`)
    }
  }
})

test('getWoundEffects - la 6ᵉ ligne : Membre détruit -10 sur un bras/une jambe (ex-is_lethal), aucun Effet en Tête/Corps', () => {
  for (const loc of ['bras_droit', 'bras_gauche', 'jambe_droite', 'jambe_gauche']) {
    assert.equal(getWoundEffects('mort_subite', loc).malusChoc, -10, loc)
    assert.equal(getWoundEffects('mort_subite', loc).malusChoc, legacyShockMalus('mortelle', loc, true), `${loc} (ancien is_lethal)`)
  }
  assert.equal(getWoundEffects('mort_subite', 'jambe_gauche').allure, 'impossible')
  assert.equal(getWoundEffects('mort_subite', 'bras_droit').allure, 'lente')
  assert.equal(getWoundEffects('mort_subite', 'tete'), null)
  assert.equal(getWoundEffects('mort_subite', 'corps'), null)
  assert.equal(getWoundEffects('legere', 'tete'), null)
})

test('6ᵉ ligne - interdit tout Test (RAW : Mortelle ET Membre détruit) et immobilise une jambe', () => {
  assert.deepEqual(TEST_BLOCKING_SEVERITIES, ['mortelle', 'mort_subite'])
  assert.equal(isTestBlockingWound([{ severity: 'mort_subite', location: 'tete' }]), true)
  assert.equal(isMortalWoundImmobilized([{ severity: 'mort_subite', location: 'jambe_droite' }]), true)
  assert.equal(isMortalWoundImmobilized([{ severity: 'mort_subite', location: 'bras_gauche' }]), false)
})

test('isMortalWoundImmobilized - lit `location` (le nom réel de la colonne character_wounds), jamais `wound_location`', () => {
  assert.equal(isMortalWoundImmobilized([{ severity: 'mortelle', wound_location: 'jambe_gauche' }]), false)
})

test('WOUND_INFECTION - extraCase : une case en plus pour Moyenne/Grave/Critique, JAMAIS pour Mortelle (survie en heures)', () => {
  assert.equal(WOUND_INFECTION.moyenne.extraCase, true)
  assert.equal(WOUND_INFECTION.grave.extraCase, true)
  assert.equal(WOUND_INFECTION.critique.extraCase, true)
  assert.equal(WOUND_INFECTION.mortelle.extraCase, false)
})

test('isFatalWound / hasFatalWound - seule la 6ᵉ gravité en Tête ou au Corps tue (un Membre détruit ne tue pas)', () => {
  assert.equal(isFatalWound({ severity: 'mort_subite', location: 'tete' }), true)
  assert.equal(isFatalWound({ severity: 'mort_subite', location: 'corps' }), true)
  for (const location of ['bras_droit', 'bras_gauche', 'jambe_droite', 'jambe_gauche']) {
    assert.equal(isFatalWound({ severity: 'mort_subite', location }), false, location)
  }
  for (const severity of WOUND_SEVERITIES.filter(s => s !== 'mort_subite')) {
    assert.equal(isFatalWound({ severity, location: 'tete' }), false, severity)
  }
  assert.equal(isFatalWound(null), false)
  assert.equal(isFatalWound(undefined), false)
  assert.equal(hasFatalWound([]), false)
  assert.equal(hasFatalWound(null), false)
  assert.equal(hasFatalWound([{ severity: 'mortelle', location: 'tete' }, { severity: 'mort_subite', location: 'bras_gauche' }]), false)
  assert.equal(hasFatalWound([{ severity: 'legere', location: 'corps' }, { severity: 'mort_subite', location: 'corps' }]), true)
})

test('getWoundHealing - Légère : aucune guérison à suivre ; Mort (Tête/Corps) : aucune échéance ; Membre détruit : 3 semaines, soins constants', () => {
  assert.equal(getWoundHealing('legere', 'bras_droit'), null)
  assert.equal(getWoundHealing('mort_subite', 'tete'), null)
  assert.equal(getWoundHealing('mort_subite', 'corps'), null)
  for (const location of ['bras_droit', 'bras_gauche', 'jambe_droite', 'jambe_gauche']) {
    const healing = getWoundHealing('mort_subite', location)
    assert.equal(healing, WOUND_HEALING.membreDetruit, location)
    assert.equal(healing.durationMinutes, 21 * 1440, location)
    assert.equal(healing.soinsConstants, true, location)
  }
  // Les autres gravités ne dépendent pas de la localisation (Mortelle : 5 semaines partout, Tête/Corps compris).
  for (const location of WOUND_LOCATIONS) {
    assert.equal(getWoundHealing('mortelle', location), WOUND_HEALING.mortelle, location)
    assert.equal(getWoundHealing('critique', location), WOUND_HEALING.critique, location)
  }
})

test('WOUND_HEALING.membreDetruit reste cohérent avec la table RAW de l\'Encyclopédie (DUREE_GUERISON_SOINS_TABLE)', () => {
  assert.equal(DUREE_GUERISON_SOINS_TABLE.membreDetruit.duree, '3 semaines')
  assert.equal(WOUND_HEALING.membreDetruit.durationMinutes, 3 * 7 * 1440)
  assert.equal(WOUND_HEALING.membreDetruit.soinsConstants, DUREE_GUERISON_SOINS_TABLE.membreDetruit.soinsConstants)
})

test('WOUND_INFECTION.mort_subite - même ligne RAW que la Mortelle (« Mortelles/Membres détruits »), survie en heures, jamais une case en plus', () => {
  assert.equal(WOUND_INFECTION.mort_subite, WOUND_INFECTION.mortelle, 'règle partagée, jamais recopiée')
  assert.equal(WOUND_INFECTION.mort_subite.baseModifier, -10)
  assert.equal(WOUND_INFECTION.mort_subite.extraCase, false)
  assert.equal(WOUND_INFECTION.mort_subite.survivalHours, true)
  for (const severity of ['moyenne', 'grave', 'critique']) assert.equal(WOUND_INFECTION[severity].survivalHours, undefined, severity)
})

test('WOUND_IMPROVEMENT_TARGET - un Membre détruit (ou une Mort rachetée) devient une Critique (REGLEBLESSURES.md:368, REGLE_CHANCE.md:122)', () => {
  assert.deepEqual(WOUND_IMPROVEMENT_TARGET, { mort_subite: 'critique' })
})

test('chanceCostOfStep — 1 point par cran, 3 pour ramener la 6ᵉ ligne à une Critique (décision Saar, écart RAW)', () => {
  assert.deepEqual(WOUND_CHANCE_STEP_COST, { mort_subite: 3 })
  for (const severity of ['grave', 'critique', 'mortelle']) assert.equal(chanceCostOfStep(severity), 1, severity)
  assert.equal(chanceCostOfStep('mort_subite'), 3)
})

test('maxNormalChanceDegrees — 2 degrés « normaux » (RAW), un seul pour la 6ᵉ ligne', () => {
  for (const severity of ['grave', 'critique', 'mortelle']) assert.equal(maxNormalChanceDegrees(severity), 2, severity)
  assert.equal(maxNormalChanceDegrees('mort_subite'), 1)
})

// ─── Kits de soin (PLAN_REVUE_GUERISON.md §10) ──────────────────────────────────────────────────────────────────────────────────────────

test('WOUND_HEALING.kits — la table décidée par Saar (Q6-Q10) : Moyenne/Grave premiers soins OU médecine, Critique médecine, Mortelle/Membre détruit chirurgie + médecine au 1er Test puis médecine', () => {
  const premiersOuMedecine = [['premiersSoins'], ['medecine']]
  assert.deepEqual(WOUND_HEALING.moyenne.kits, { first: premiersOuMedecine, following: premiersOuMedecine })
  assert.deepEqual(WOUND_HEALING.grave.kits, { first: premiersOuMedecine, following: premiersOuMedecine })
  assert.deepEqual(WOUND_HEALING.critique.kits, { first: [['medecine']], following: [['medecine']] })
  assert.deepEqual(WOUND_HEALING.mortelle.kits, { first: [['chirurgie', 'medecine']], following: [['medecine']] })
  assert.deepEqual(WOUND_HEALING.membreDetruit.kits, { first: [['chirurgie', 'medecine']], following: [['medecine']] })
  // Les types de kit utilisés existent tous dans CARE_KIT_TYPES.
  for (const healing of Object.values(WOUND_HEALING)) {
    for (const kit of [...healing.kits.first, ...healing.kits.following].flat()) assert.ok(CARE_KIT_TYPES.includes(kit), kit)
  }
})

test('WOUND_HEALING.kits — anti-dérive : dit la même chose que « Soins nécessaires » de DUREE_GUERISON_SOINS_TABLE (texte d\'Encyclopédie)', () => {
  const kitsMentionedIn = (text) => new Set([
    ...(/chirurgie/i.test(text) ? ['chirurgie'] : []),
    ...(/m[ée]decine/i.test(text) ? ['medecine'] : []),
    ...(/premiers soins/i.test(text) ? ['premiersSoins'] : []),
  ])
  for (const [key, healing] of Object.entries(WOUND_HEALING)) {
    const text = DUREE_GUERISON_SOINS_TABLE[key].soinsNecessaires
    assert.deepEqual(new Set(healing.kits.first.flat()), kitsMentionedIn(text), `${key} : kits du premier Test ⇔ « ${text} »`)
    // « … ou … » ⇔ plusieurs alternatives ; « … + … » ⇔ une seule alternative à plusieurs kits.
    if (/ ou /i.test(text)) assert.equal(healing.kits.first.length, 2, `${key} : « ou » = 2 alternatives`)
    else assert.equal(healing.kits.first.length, 1, `${key} : une seule alternative`)
    if (text.includes('+')) assert.equal(healing.kits.first[0].length, 2, `${key} : « + » = 2 kits ensemble`)
  }
  assert.equal(DUREE_GUERISON_SOINS_TABLE.legere.soinsNecessaires, 'Aucune') // Légère : aucune entrée `kits` (absente de WOUND_HEALING)
  assert.equal(WOUND_HEALING.legere, undefined)
})

test('getHealingTotalTests / SOINS_CONSTANTS_INTERVAL_MINUTES — autorité unique du nombre de Tests hebdomadaires (Critique 3, Mortelle 5, Membre détruit 3)', () => {
  assert.equal(SOINS_CONSTANTS_INTERVAL_MINUTES, 7 * 1440)
  assert.equal(getHealingTotalTests('critique', 'corps'), 3)
  assert.equal(getHealingTotalTests('mortelle', 'tete'), 5)
  assert.equal(getHealingTotalTests('mort_subite', 'bras_droit'), 3)
  assert.equal(getHealingTotalTests('moyenne', 'corps'), null, 'échéance unique')
  assert.equal(getHealingTotalTests('grave', 'corps'), null)
  assert.equal(getHealingTotalTests('legere', 'corps'), null)
  assert.equal(getHealingTotalTests('mort_subite', 'tete'), null, 'Mort en Tête/Corps : ne guérit pas')
})

test('isFirstHealingTest / getCareKits — le premier Test d\'une blessure lourde mobilise la Chirurgie, pas les suivants ; Légère et Mort n\'ont aucun kit', () => {
  assert.equal(isFirstHealingTest('mortelle', 'corps', 5), true)
  assert.equal(isFirstHealingTest('mortelle', 'corps', 4), false)
  assert.equal(isFirstHealingTest('mortelle', 'corps', 1), false, 'une nouvelle tentative est le dernier Test')
  assert.equal(isFirstHealingTest('moyenne', 'corps', null), true, 'échéance unique : un seul rang')

  assert.deepEqual(getCareKits('mortelle', 'corps', 5), [['chirurgie', 'medecine']])
  assert.deepEqual(getCareKits('mortelle', 'corps', 4), [['medecine']])
  assert.deepEqual(getCareKits('mort_subite', 'bras_droit', 3), [['chirurgie', 'medecine']])
  assert.deepEqual(getCareKits('critique', 'corps', 1), [['medecine']])
  assert.deepEqual(getCareKits('moyenne', 'corps', null), [['premiersSoins'], ['medecine']])
  assert.equal(getCareKits('legere', 'corps', null), null)
  assert.equal(getCareKits('mort_subite', 'corps', 1), null)
})

test('defaultCareKits / sumCareKits — première alternative par défaut ; décompte par type de kit', () => {
  assert.deepEqual(defaultCareKits([['premiersSoins'], ['medecine']]), ['premiersSoins'])
  assert.deepEqual(defaultCareKits(null), [])
  assert.deepEqual(sumCareKits([]), { premiersSoins: 0, medecine: 0, chirurgie: 0 })
  assert.deepEqual(sumCareKits([['premiersSoins'], ['chirurgie', 'medecine'], ['medecine']]), { premiersSoins: 1, medecine: 2, chirurgie: 1 })
})
