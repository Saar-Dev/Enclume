import { MINUTES_PER_DAY } from './gameTime.js'

export const WOUND_LOCATIONS = [
  'tete', 'corps', 'bras_droit', 'bras_gauche', 'jambe_droite', 'jambe_gauche',
]

// Les 6 lignes du compteur RAW (REGLEBLESSURES.md:20-26, capture de la fiche vérifiée 2026-09-24), de la
// plus légère à la plus grave — l'ORDRE de ce tableau est l'autorité de la promotion (`nextSeverity`), du
// « pire » (`getWorstWoundSeverity`, client) et du tri SQL (`woundSeverityRankSql`). `mort_subite` est la
// 6ᵉ ligne « Mort subite / Membre détruit » (seuil 30) : UNE seule gravité stockée, dont le libellé dépend de
// la localisation — « Mort » en Tête/Corps (`isSuddenDeathLocation`), « Membre détruit » sur un bras/une jambe.
export const WOUND_SEVERITIES = ['legere', 'moyenne', 'grave', 'critique', 'mortelle', 'mort_subite']

// Capacité de chaque ligne (cases de la fiche). La 6ᵉ ligne a UNE case partout (Saar : une seule case pour
// les 6 localisations, affichée comme un mot ; la fiche papier montre « Mort » en Tête/Corps et une case sur
// chaque membre).
export const WOUND_MAX_COUNTS = {
  tete:          { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1, mort_subite: 1 },
  corps:         { legere: 4, moyenne: 3, grave: 3, critique: 2, mortelle: 2, mort_subite: 1 },
  bras_droit:    { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1, mort_subite: 1 },
  bras_gauche:   { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1, mort_subite: 1 },
  jambe_droite:  { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1, mort_subite: 1 },
  jambe_gauche:  { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1, mort_subite: 1 },
}

// « Ligne pleine » — AUTORITÉ UNIQUE (REGLEBLESSURES.md:47-53 : « lorsque toutes les cases d'une ligne sont cochées
// et que le personnage subit une nouvelle blessure de cette gravité » → cocher une case au degré supérieur, effacer la
// ligne). Une ligne est pleine quand TOUTES ses cases sont cochées ; c'est la blessure SUIVANTE qui la convertit, jamais
// celle qui remplit la dernière case. Lue par la pose d'une blessure (aggravation, guérison, infection) et par la Chance
// (`hasSeverityRoom` = « pas pleine ») : aucune autre définition ne doit exister. `>=` et non `===` : une ligne déjà
// au-dessus de sa capacité (ancien défaut de guérison) reste pleine.
export function isWoundLineFull(currentCount, maxCount) {
  return currentCount >= maxCount
}

// Gravités qu'un joueur ne pose ni ne retire à la main sur sa fiche : MJ seul (route `char-sheet` + panneau). La 6ᵉ
// ligne tue (Tête/Corps) ou détruit un membre — comme le statut `dead` (`gmOnly`, tokenStatusRegistry.js), ce n'est
// pas une auto-déclaration de joueur ; sans cette garde, cliquer « Mort » sur sa propre fiche contournerait le registre.
export const GM_ONLY_WOUND_SEVERITIES = ['mort_subite']

// Localisations où la 6ᵉ ligne est une MORT (Tête, Corps) ; ailleurs (bras, jambes) c'est un Membre détruit.
export const SUDDEN_DEATH_LOCATIONS = ['tete', 'corps']

export function isSuddenDeathLocation(location) {
  return SUDDEN_DEATH_LOCATIONS.includes(location)
}

// Une blessure « Mort » : la 6ᵉ gravité en Tête ou au Corps (« le personnage meurt sur le coup », REGLEBLESSURES.md:164-167).
// Un Membre détruit (même gravité sur un bras/une jambe) ne tue pas. Autorité unique de « cette blessure tue-t-elle ? » :
// elle décide du statut `dead` (server/src/lib/statusService.js:reconcileWoundDeath). Pure, donc testable sans base.
export function isFatalWound(wound) {
  return wound?.severity === 'mort_subite' && isSuddenDeathLocation(wound.location)
}

export function hasFatalWound(wounds) {
  return (wounds ?? []).some(isFatalWound)
}

// WNDMORT (docs/BUGIDENTIFIE.md) — REGLEBLESSURES.md, Blessures mortelles : « Malus aux Tests : non
// applicable, le blessé ne peut entreprendre aucune action demandant un Test. » `mortelle` n'a donc
// jamais de vraie valeur numérique (le -20 précédent était une extrapolation jamais confirmée par le
// LdB) — 0 ici uniquement en défense en profondeur (si un appelant futur oublie le garde
// `isTestBlockingWound`, il n'ajoute aucun malus fantôme, il n'en ajoute simplement aucun).
// `mort_subite` : même raison que `mortelle` (RAW « Malus aux Tests : non applicable » pour Mortelle ET Membre détruit).
export const WOUND_PENALTIES = {
  legere: -1, moyenne: -3, grave: -5, critique: -10, mortelle: 0, mort_subite: 0,
}

// Couleur de chaque gravité — gris pour la 6ᵉ ligne (Saar : le membre détruit est barré et grisé).
export const SEVERITY_COLORS = {
  legere: '#FFD700', moyenne: '#FFA500', grave: '#FF6B6B', critique: '#FF0000', mortelle: '#8B0000',
  mort_subite: '#5c5c66',
}

// Sévérités qui interdisent tout Test (predicate séparé du malus numérique — même principe que
// `shared/combatSituationMods.js` RANGED_SITUATION_MODS.impossible, TIRIMP docs/BUGIDENTIFIE.md). RAW : Mortelle
// ET Membre détruit (REGLEBLESSURES.md:154, 175) — « le blessé ne peut entreprendre aucune action demandant un Test ».
export const TEST_BLOCKING_SEVERITIES = ['mortelle', 'mort_subite']

export function isTestBlockingWound(wounds) {
  return (wounds ?? []).some(w => TEST_BLOCKING_SEVERITIES.includes(w.severity))
}

// Localisations où même le Déplacement (Allure lente) reste impossible pour une Blessure mortelle —
// LdB « Effets » : Jambes = déplacement impossible ; Bras/Corps/Tête = déplacement Allure lente
// maximum autorisé. Décision Saar (2026-07-19) : seules Déplacement (Allure lente) et Passer le tour
// restent des actions valides pour un personnage mortellement blessé (aucune des deux ne demande de
// Test) — tout le reste (attaque, corps à corps, interaction, rechargement) reste interdit.
export const MORTAL_WOUND_IMMOBILE_LOCATIONS = ['jambe_droite', 'jambe_gauche']

export function isMortalWoundImmobilized(wounds) {
  return (wounds ?? []).some(w => TEST_BLOCKING_SEVERITIES.includes(w.severity) && MORTAL_WOUND_IMMOBILE_LOCATIONS.includes(w.location))
}

// ─── Kits de soin ────────────────────────────────────────────────────────────────────────────────────────────────
// Les KITS DE SOIN mobilisés par UN Test de guérison (colonne « Soins nécessaires » de la table RAW ci-dessous). Règle maison (décision de Saar,
// 2026-09-25, docs/PLANS/PLAN_REVUE_GUERISON.md §6 Q6-Q8/Q10) : le RAW décrit trois trousses comme un équipement à niveaux (First Aid, ChiriaT,
// Medi 1 000), jamais comme un consommable — le décompte est un écart assumé (docs/JOURNAL8.md). Un kit par Test et par ligne du compteur (le RAW soigne
// « Localisation par Localisation »). `first` = le premier Test d'une blessure, `following` = les suivants : la Chirurgie est l'opération « avant toute
// phase de soins médicaux », une seule fois ; le Test hebdomadaire des soins constants est un Test de Médecine (`REGLEBLESSURES.md:374-375, 391-392`).
// Chaque liste = des ALTERNATIVES ; chaque alternative = les kits requis ENSEMBLE.
export const CARE_KIT_TYPES = ['premiersSoins', 'medecine', 'chirurgie']
const PREMIERS_SOINS_OU_MEDECINE = [['premiersSoins'], ['medecine']]
const MEDECINE_SEULE = [['medecine']]

// Période des « soins constants » : un Test de Médecine chaque semaine (`REGLEBLESSURES.md:391-392`). Autorité unique de cet intervalle,
// lue par le moteur d'échéances (server/src/lib/woundHealingSchedule.js) et par le décompte des kits.
export const SOINS_CONSTANTS_INTERVAL_MINUTES = 7 * MINUTES_PER_DAY

// Table RAW « Durée de guérison et soins nécessaires » (REGLEBLESSURES.md:413-433, vérifiée
// 2026-07-30 contre Polaris 3ème édition p.238 — voir docs/PLAN_BLESSURES_GUERISON.md §3.2).
// `legere` volontairement absente : guérit seule, sans Test, jamais d'échéance `wound_healing_check`.
// soinsConstants=true -> échéance récurrente hebdomadaire (Test de Médecine chaque semaine) ;
// false -> échéance unique, ponctuelle, à la fin de la durée.
// Les clés sont des gravités, sauf `membreDetruit` : la 6ᵉ gravité `mort_subite` SUR UN BRAS OU UNE JAMBE (RAW : ligne
// « Membres détruits », 3 semaines, Chirurgie + Médecine, soins constants). Ne se lit pas par `WOUND_HEALING[severity]` :
// passer par `getWoundHealing(severity, location)`, qui choisit la bonne ligne (et n'en renvoie aucune pour une Mort).
//
// `kits` : voir « Kits de soin » ci-dessus (les kits mobilisés par UN Test).
export const WOUND_HEALING = {
  moyenne:  { durationMinutes: 3 * MINUTES_PER_DAY,  soinsConstants: false, kits: { first: PREMIERS_SOINS_OU_MEDECINE, following: PREMIERS_SOINS_OU_MEDECINE } },
  grave:    { durationMinutes: 7 * MINUTES_PER_DAY,  soinsConstants: false, kits: { first: PREMIERS_SOINS_OU_MEDECINE, following: PREMIERS_SOINS_OU_MEDECINE } },
  critique: { durationMinutes: 21 * MINUTES_PER_DAY, soinsConstants: true,  kits: { first: MEDECINE_SEULE, following: MEDECINE_SEULE } },
  mortelle: { durationMinutes: 35 * MINUTES_PER_DAY, soinsConstants: true,  kits: { first: [['chirurgie', 'medecine']], following: MEDECINE_SEULE } },
  membreDetruit: { durationMinutes: 21 * MINUTES_PER_DAY, soinsConstants: true, kits: { first: [['chirurgie', 'medecine']], following: MEDECINE_SEULE } },
}

// Ligne de WOUND_HEALING d'une blessure (gravité stockée + localisation moteur), ou null si elle n'a pas d'échéance de
// guérison : Légère (guérit seule) ; Mort en Tête/Corps (« le personnage meurt sur le coup » : aucune guérison, la
// résurrection reste une décision du MJ). Autorité unique de « cette blessure guérit-elle, et en combien de temps ? ».
export function getWoundHealing(severity, location) {
  if (severity === 'mort_subite') return isSuddenDeathLocation(location) ? null : WOUND_HEALING.membreDetruit
  return WOUND_HEALING[severity] ?? null
}

// Nombre de Tests d'une guérison à soins constants (durée ÷ 1 semaine : Critique 3, Mortelle 5, Membre détruit 3) ; null pour une
// échéance UNIQUE (Moyenne/Grave) ou une blessure qui ne guérit pas. Autorité unique, lue par le moteur d'échéances (occurrences) et le décompte des kits.
export function getHealingTotalTests(severity, location) {
  const healing = getWoundHealing(severity, location)
  return healing?.soinsConstants ? Math.round(healing.durationMinutes / SOINS_CONSTANTS_INTERVAL_MINUTES) : null
}

// « Premier Test » d'une blessure ⇔ l'échéance n'a encore consommé aucune occurrence (`occurrences_remaining` = total). Une échéance unique n'a qu'un
// rang : ses kits sont les mêmes au premier Test et aux suivants. Une nouvelle tentative après un échec (`occurrences_remaining` = 1) est le dernier Test.
export function isFirstHealingTest(severity, location, occurrencesRemaining) {
  const total = getHealingTotalTests(severity, location)
  return total === null ? true : occurrencesRemaining === total
}

// Alternatives de kits d'UN Test de cette blessure (voir `WOUND_HEALING.kits`), ou null : Légère (guérit seule) et Mort en Tête/Corps n'en ont pas.
export function getCareKits(severity, location, occurrencesRemaining) {
  const healing = getWoundHealing(severity, location)
  if (!healing) return null
  return isFirstHealingTest(severity, location, occurrencesRemaining) ? healing.kits.first : healing.kits.following
}

// Kits retenus par défaut pour une liste d'alternatives : la PREMIÈRE (« premiers soins » avant « médecine » : la moins chère). Le MJ pourra en choisir une autre.
export function defaultCareKits(alternatives) {
  return alternatives?.[0] ?? []
}

// Décompte par type de kit d'une suite de listes de kits (une liste = les kits d'un Test) — `{ premiersSoins, medecine, chirurgie }`.
// Une seule implémentation, lue par le serveur (vue de revue) et par le client (quand le MJ change d'alternative).
export function sumCareKits(kitLists) {
  const totals = Object.fromEntries(CARE_KIT_TYPES.map(type => [type, 0]))
  for (const kits of kitLists) for (const kit of kits) if (kit in totals) totals[kit] += 1
  return totals
}

// Gravité qui REMPLACE une blessure quand elle s'améliore d'un cran, si ce n'est pas la gravité juste en dessous dans
// WOUND_SEVERITIES. RAW (REGLEBLESSURES.md:368) : « un Membre détruit devient une Blessure critique » ; REGLE_CHANCE.md:122 :
// racheter une Mort subite par la Chance donne aussi une Blessure critique. Autorité unique de la cible d'amélioration
// (server/src/lib/woundUtils.js:improvedSeverity), lue par la guérison et, au Lot 3, par la Chance.
export const WOUND_IMPROVEMENT_TARGET = {
  mort_subite: 'critique',
}

// Coût en points de Chance d'UN cran de réduction, selon la gravité de départ. RAW : 1 point par degré
// (REGLE_CHANCE.md:117-119) ; la 6ᵉ ligne n'y est pas chiffrée — DÉCISION de Saar (2026-09-23, écart RAW journalisé) : 3 points
// pour la ramener à une Blessure critique (« 2 semblait peu vu la blessure »), soit au-delà de la limite générale de 2 points
// d'un coup. Ce coût est celui du premier cran seulement : si la Critique est pleine, l'exception « palier plein »
// (REGLE_CHANCE.md:125-131) ajoute 1 point par cran supplémentaire. Autorité unique, lue par `computeAvailableSeverityReductions`.
export const WOUND_CHANCE_STEP_COST = {
  mort_subite: 3,
}

export function chanceCostOfStep(fromSeverity) {
  return WOUND_CHANCE_STEP_COST[fromSeverity] ?? 1
}

// Nombre de degrés proposés « normalement » (avant l'exception du palier plein) : 2 (REGLE_CHANCE.md:119) ; un seul pour la
// 6ᵉ ligne, dont le rachat coûte déjà 3 points.
export function maxNormalChanceDegrees(severity) {
  return severity === 'mort_subite' ? 1 : 2
}

// Table RAW « Infection » (REGLEBLESSURES.md:436-472, vérifiée 2026-07-30 contre Polaris 3ème
// édition p.239-240, docs/PLAN_BLESSURES_GUERISON.md §3.3). `legere` absente : jamais concernée.
// caseMalus : -2 au Test par case déjà cochée sur la ligne (localisation/gravité), en plus de la
// première — RAW explicite sur Grave/Critique/Mortelle, absent du texte pour Moyenne (relecture
// attentive : la ligne Moyenne ne mentionne aucun malus de ce type, contrairement aux trois autres).
// periodMalus : -2 cumulatif par période de 2 jours passée sans soins corrects — RAW explicite
// seulement pour Grave (réussite) et Critique (échec) ; ni Moyenne ni Mortelle ne le mentionnent
// (Mortelle : la conséquence est un compte à rebours en heures, aucune "période suivante" réaliste).
// extraCase : l'infection COCHE une case supplémentaire sur la ligne — RAW explicite pour Moyenne, Grave et Critique
// (« le joueur doit cocher une case de blessure supplémentaire »). Pas pour Mortelle/Membre détruit : le RAW dit « le
// blessé survit pendant un nombre d'heures égal à sa Constitution, puis meurt d'une septicémie » (REGLEBLESSURES.md:473-485),
// jamais une case en plus. Cocher une Mortelle de plus serait faux, et avec la 6ᵉ ligne ferait mourir/détruire un membre
// par simple infection (Mortelle pleine → débordement). Le délai de survie reste affiché au MJ, jamais appliqué
// (décision du 2026-07-30, woundEvolutionService.js:woundInfectionCheckHandler).
//
// survivalHours : la conséquence est un délai de survie en heures (NA(CON), ou la moitié sur un échec) affiché au MJ.
// `mort_subite` = « Membres détruits » du RAW (même ligne que les Mortelles, REGLEBLESSURES.md:470-485) : la règle est
// PARTAGÉE, jamais recopiée. Une Mort (Tête/Corps) n'a ni guérison ni infection (getWoundHealing = null : aucune
// échéance, donc cette ligne n'y est jamais lue).
const MORTAL_INFECTION_RULE = {
  baseModifier: -10, caseMalus: true, periodMalus: false, infectsOnSuccess: true, extraCase: false, survivalHours: true,
}

export const WOUND_INFECTION = {
  moyenne:  { baseModifier: 5,   caseMalus: false, periodMalus: false, infectsOnSuccess: false, extraCase: true },
  grave:    { baseModifier: 0,   caseMalus: true,  periodMalus: true,  infectsOnSuccess: false, extraCase: true },
  critique: { baseModifier: -5,  caseMalus: true,  periodMalus: true,  infectsOnSuccess: true,  extraCase: true },
  mortelle: MORTAL_INFECTION_RULE,
  mort_subite: MORTAL_INFECTION_RULE,
}

// Blessure « susceptible de s'infecter » (REGLEBLESSURES.md:439-441) : celle qui a une guérison à suivre (`getWoundHealing`) — Moyenne et
// plus, Membre détruit compris ; ni la Légère (guérit seule) ni une Mort en Tête/Corps.
export function isInfectableWound(wound) {
  return getWoundHealing(wound.severity, wound.location) !== null && WOUND_INFECTION[wound.severity] !== undefined
}

// CIBLE du Test d'infection d'une localisation (REGLEBLESSURES.md:439-442 : « pour chaque Localisation … un Test de Constitution » ; décision de Saar,
// 2026-09-26, Q5/Q6) : la PIRE blessure susceptible de s'infecter fixe le modificateur du Test, la ligne où une case s'ajoute, et les cases
// « en plus de la première » ne sont comptées que sur SA ligne. `wounds` : les blessures d'UNE localisation (`{ severity, location }`).
// Retourne `{ severity, cases }` (cases = cases cochées sur la ligne de cette gravité) ou null si rien n'est susceptible de s'infecter.
export function findInfectionTarget(wounds) {
  const infectable = wounds.filter(isInfectableWound)
  if (infectable.length === 0) return null
  const severity = infectable.reduce((worst, wound) => (
    WOUND_SEVERITIES.indexOf(wound.severity) > WOUND_SEVERITIES.indexOf(worst) ? wound.severity : worst
  ), infectable[0].severity)
  return { severity, cases: infectable.filter(wound => wound.severity === severity).length }
}
// Table RAW « Seuils de blessures » (LdB p.234) — seuil de Dommages à partir duquel
// une blessure d'une gravité donnée est infligée. La gravité retenue est la plus
// haute dont le seuil est atteint ou dépassé.
//
// `key` reprend l'énumération WOUND_SEVERITIES (legere / moyenne / grave / critique /
// mortelle / mort_subite) — les libellés français vivent dans terms.json (domaine graviteBlessure).
//
// AUTORITÉ UNIQUE des seuils, pour l'humain (damageService.js:resolveTargetHit) ET le drone (via
// `woundSeverityForDamage`, resolveDroneIntegrityLoss). La 6ᵉ ligne (30, « Mort subite / Membre détruit ») en
// fait partie : un coup net ≥ 30 écrit directement `mort_subite`.
export const BLESSURE_SEUILS_TABLE = [
  { key: 'legere',      seuil: 5  },
  { key: 'moyenne',     seuil: 10 },
  { key: 'grave',       seuil: 15 },
  { key: 'critique',    seuil: 20 },
  { key: 'mortelle',    seuil: 25 },
  { key: 'mort_subite', seuil: 30 },
]

// Gravité correspondant à des Dommages nets : la plus haute ligne de BLESSURE_SEUILS_TABLE dont le seuil est
// atteint, ou null sous le premier seuil (aucune blessure). Un drone détruit dès 30 (DRONE_DESTROYED_DAMAGE,
// règle propre au drone) est traité AVANT cet appel par resolveDroneIntegrityLoss : il ne voit jamais `mort_subite`.
export function woundSeverityForDamage(degatsNets) {
  let severity = null
  for (const { key, seuil } of BLESSURE_SEUILS_TABLE) {
    if (degatsNets >= seuil) severity = key
  }
  return severity
}

// Table RAW « Effets » (LdB p.235-236, article Description et effets des blessures) — pour les
// blessures Graves et plus sévères : Allure de déplacement maximum autorisée, et malus au Test de
// résistance au Choc (donnée distincte de WOUND_PENALTIES, qui porte le malus aux Tests général).
//
// Absente pour Légères/Moyennes (le RAW ne liste aucun Effet à ces degrés) et pour Mort subite (mort
// instantanée, aucun Test n'a lieu). `membreDetruit` ne porte que bras/jambes (par définition, un
// Membre détruit ne peut toucher que ces Localisations).
//
// Localisations RAW génériques (tete/corps/bras/jambes) — le RAW ne distingue pas gauche/droite ici,
// contrairement à WOUND_LOCATIONS (moteur, 6 localisations). `allure` : palier RAW ('lente' /
// 'moyenne' / 'impossible'). `malusChoc` : `0` = Test de Choc requis, RAW indique explicitement
// « aucun malus » (donnée réelle, pas une absence) ; `null` = aucun Test de Choc mentionné par le
// RAW à cette Localisation pour cette gravité (ex. Jambes/Grave : Allure réduite mais pas de Test).
//
// Bras absent en Grave — le RAW ne liste aucun Effet Bras à ce palier (Jambes/Corps/Tête seulement).
//
// Ajouté pour l'Encyclopédie ; le champ `malusChoc` est aussi l'AUTORITÉ du malus au Test de Choc du moteur
// (`getWoundEffects` ci-dessous, lu par charStats.js:getShockMalus) — plus de copie codée en dur.
export const BLESSURE_EFFETS_TABLE = {
  grave: {
    jambes: { allure: 'moyenne', malusChoc: null },
    corps:  { allure: 'moyenne', malusChoc: 0 },
    tete:   { allure: 'moyenne', malusChoc: -5 },
  },
  critique: {
    bras:   { allure: 'moyenne', malusChoc: 0 },
    jambes: { allure: 'impossible', malusChoc: 0 },
    corps:  { allure: 'lente', malusChoc: -5 },
    tete:   { allure: 'lente', malusChoc: -10 },
  },
  mortelle: {
    bras:   { allure: 'lente', malusChoc: -5 },
    jambes: { allure: 'impossible', malusChoc: -5 },
    corps:  { allure: 'lente', malusChoc: -10 },
    tete:   { allure: 'lente', malusChoc: -15 },
  },
  membreDetruit: {
    bras:   { allure: 'lente', malusChoc: -10 },
    jambes: { allure: 'impossible', malusChoc: -10 },
  },
}

// Localisation du moteur (6, gauche/droite) → clé générique du RAW (4) des tables ci-dessus.
export const WOUND_LOCATION_EFFECT_KEY = {
  tete: 'tete', corps: 'corps',
  bras_droit: 'bras', bras_gauche: 'bras',
  jambe_droite: 'jambes', jambe_gauche: 'jambes',
}

// Ligne de BLESSURE_EFFETS_TABLE d'une blessure (gravité stockée + localisation moteur), ou null si le RAW n'en
// liste pas (Légère/Moyenne, Bras en Grave, Mort subite en Tête/Corps : mort immédiate, aucun Effet). La 6ᵉ
// gravité `mort_subite` lit la colonne RAW `membreDetruit` (Bras/Jambes seulement).
export function getWoundEffects(severity, location) {
  const column = severity === 'mort_subite' ? 'membreDetruit' : severity
  return BLESSURE_EFFETS_TABLE[column]?.[WOUND_LOCATION_EFFECT_KEY[location]] ?? null
}

// Table RAW « Étourdissement, inconscience et catastrophes » (LdB p.237, article Choc) — durée des
// effets d'un Test de Choc raté, selon la gravité de la blessure qui l'a déclenché et sa Localisation.
//
// Trois colonnes RAW : `etourdissement` (durée avant de reprendre ses esprits si simplement Étourdi),
// `inconscience` (durée du coma si Inconscient), `catastrophe` (conséquence si le Test de Choc est
// raté sur une Catastrophe — parfois une durée aggravée, parfois un cas spécial).
//
// Valeurs en notation de dés ou « N TC » (Tour de combat) — texte RAW reproduit tel quel, pas de
// valeur numérique isolée à calculer (aucune consommation moteur, comme BLESSURE_EFFETS_TABLE).
// « Coma léger », « Coma profond » et « Stabilisation nécessaire » sont des cas spéciaux, pas des
// durées : ils renvoient aux paragraphes déjà présents dans l'article Choc (« Durée du Choc »), pas
// besoin de les redéfinir ici.
//
// Localisations génériques (tete/corps/brasJambes) — le RAW regroupe Bras et Jambes en une seule
// ligne dans cette table (contrairement à BLESSURE_EFFETS_TABLE, qui les distingue). `membreDetruit`
// ne porte que brasJambes (par définition).
export const CHOC_DUREE_TABLE = {
  grave: {
    tete:  { etourdissement: '2 TC',    inconscience: '2 minutes',   catastrophe: '1D6 minutes' },
    corps: { etourdissement: '1 TC',    inconscience: '1 minute',    catastrophe: '1 minute' },
  },
  critique: {
    tete:       { etourdissement: '3D6 TC', inconscience: '3D6 minutes', catastrophe: 'Coma léger' },
    corps:      { etourdissement: '2D6 TC', inconscience: '2D6 minutes', catastrophe: '3D6 minutes' },
    brasJambes: { etourdissement: '1D6 TC', inconscience: '1D6 minutes', catastrophe: '2D6 minutes' },
  },
  mortelle: {
    tete:       { etourdissement: '3D6 minutes', inconscience: 'Coma léger',           catastrophe: 'Coma profond' },
    corps:      { etourdissement: '2D6 minutes', inconscience: '3D6 minutes',          catastrophe: 'Stabilisation nécessaire' },
    brasJambes: { etourdissement: '1D6 minutes', inconscience: '2D6 minutes',          catastrophe: 'Stabilisation nécessaire' },
  },
  membreDetruit: {
    brasJambes: { etourdissement: '2D6 minutes', inconscience: '3D6 minutes', catastrophe: 'Stabilisation nécessaire' },
  },
}

// Table RAW « Durée de guérison et soins nécessaires » (LdB p.238, article Durée de guérison et
// soins) — vue complète pour l'Encyclopédie. Recoupe partiellement `WOUND_HEALING` (durée +
// soins constants, moyenne→mortelle) mais porte 2 colonnes que `WOUND_HEALING` n'a pas (soins
// nécessaires, Difficulté) et 2 lignes qu'il n'a pas non plus (`legere`, `membreDetruit` — absentes
// de `WOUND_HEALING` par choix moteur documenté sur sa propre déclaration, pas un oubli ici).
//
// Représentation parallèle assumée, pas une duplication silencieuse : `duree` est le texte RAW
// d'affichage (« 3 jours »), quand `WOUND_HEALING` porte la même durée en minutes pour le calcul
// moteur — même relation que DISTANCES_DEPLACEMENT_SOL/EAU vis-à-vis de calcAllureMoy/calcAllures
// (dataSources.js). Si `WOUND_HEALING` change un jour, vérifier ici aussi (même RAW p.238).
//
// `difficulte` : nombre, ou objet { brasJambe, corps, tete } pour `mortelle` (seule ligne où le RAW
// distingue la Localisation). `null` = pas de Test (Légères, guérison sans soins).
//
// Ajouté pour l'Encyclopédie : aucune consommation moteur à ce jour pour les champs propres à cette
// table (soinsNecessaires, difficulte) — même statut que BLESSURE_EFFETS_TABLE.
export const DUREE_GUERISON_SOINS_TABLE = {
  legere: {
    duree: '1 jour', guerisonNaturelle: true,
    soinsNecessaires: 'Aucune', difficulte: null, soinsConstants: false,
  },
  moyenne: {
    duree: '3 jours', guerisonNaturelle: true,
    soinsNecessaires: 'Médecine ou Premiers soins', difficulte: 5, soinsConstants: false,
  },
  grave: {
    duree: '1 semaine', guerisonNaturelle: true,
    soinsNecessaires: 'Médecine ou Premiers soins', difficulte: 3, soinsConstants: false,
  },
  critique: {
    duree: '3 semaines', guerisonNaturelle: false,
    soinsNecessaires: 'Médecine', difficulte: 0, soinsConstants: true,
  },
  mortelle: {
    duree: '5 semaines', guerisonNaturelle: false,
    soinsNecessaires: 'Chirurgie + Médecine',
    difficulte: { brasJambe: -3, corps: -5, tete: -7 },
    soinsConstants: true,
  },
  membreDetruit: {
    duree: '3 semaines', guerisonNaturelle: false,
    soinsNecessaires: 'Chirurgie + Médecine', difficulte: -3, soinsConstants: true,
  },
}

// Nombre maximal d'entrées d'une réponse GROUPÉE de l'écran de revue (`POST …/healing-choices`, `…/infection-modes`). Autorité unique : le serveur
// refuse au-delà, le client découpe ses envois à cette taille (PLAN_REVUE_GUERISON.md §13 B7).
export const REVIEW_BATCH_MAX_ENTRIES = 200

// Réponses possibles du MJ à un Test de guérison (`payload.mjChoice`, lu par `woundHealingCheckHandler`) et modes d'un Test d'infection
// (`auto` = jet serveur, `player` = le joueur lance son dé). Lues par le serveur (validation) ET par l'écran de revue (boutons).
export const HEALING_OUTCOMES = ['amelioration', 'echec', 'catastrophe']
export const INFECTION_MODES = ['auto', 'player']
