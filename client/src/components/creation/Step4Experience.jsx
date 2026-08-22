import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AgeSelector from './AgeSelector'
import BackgroundSelector from './BackgroundSelector'
import CareersAllocator from './CareersAllocator'
import ProAdvantagesAndSetbacks from './ProAdvantagesAndSetbacks'
import { BG_META } from './backgroundMeta'
import Step4Summary from './Step4Summary'
import { useCreationStore } from '../../stores/creationStore'
import { getSetbackBlockCount } from '../../../../shared/careerSetbacks.js'
import { originGeoOptionKey, originSocOptionKey, trainingOptionKey } from '../../../../shared/wizardOptionKeys.js'
import { SUB_STEPS, SUB_STEP_ORDER } from '../../../../shared/wizardStep4SubSteps.js'
import api from '../../lib/api'

const enrichBg = (bg) => ({ ...bg, ...(BG_META[bg.code] ?? {}) })

const HIGHER_ED_TRAINING_CODE = 'education_scolaire'

// Bug réel (docs/EN_COURS.md, 2026-08-12) : getStep4State (creationService.js) ne renvoie jamais
// `null` — `age` a un défaut (16), les autres champs valent `null`/`[]`/`{}` — donc `initialData` est
// TOUJOURS un objet pour toute reprise ayant dépassé Step0, même sans aucun choix réel sur Step4.
// L'ancien `initialData ? SUMMARY : AGE` atterrissait donc systématiquement sur Récap, qui plantait
// au clic sur "Terminer" (resolveStep4Backgrounds rejette origine/formation null, message qui ne
// disait rien de plus). Remplacé par la première sous-étape réellement incomplète, dans l'ordre
// énuméré par Saar (origine, milieu, formation, étude, profession).
// Avantages & Revers ajoutés après coup (docs/EN_COURS.md, 2026-08-12, suite du bug jauges vides) :
// exclus une première fois (état conditionnel, aucun champ "visité" persisté), mais une reprise avec
// carrières déjà choisies sautait alors TOUJOURS cette sous-étape en atterrissant direct sur Récap —
// aucune jauge de matériel ne pouvait plus jamais être semée pour un personnage repris (confirmé en
// base : carrière avec `pro_advantages: {}`, aucune ligne `char_gauges`). Heuristique de base : si
// aucune carrière ne porte de Pro-Avantage choisi ET qu'aucun tirage de Revers n'existe, ambigu entre
// "jamais visité" et "visité, rien à choisir" (carrière sans Pro-Avantage réel, ou reversEnabled=false)
// — irréductible par chaînage (dernière sous-étape avant Récap, rien après elle à vérifier). Tranché
// par `initialData.highestSubStep` (migration 248, char_sheet.wizard_progress) quand disponible ;
// fiches créées avant cette migration retombent sur l'ancien défaut ("jamais visité").
//
// `higherEd` (null aussi bien "non visité" qu'"explicitement sauté", handleSkipHigherEd) résolu par
// chaînage plutôt que par un marqueur dédié : `careers.length > 0` ne peut être vrai que si le joueur
// a déjà dépassé cette sous-étape (navigation linéaire), donc renvoyer sur HIGHER_ED seulement tant
// qu'aucune carrière n'a été ajoutée — même principe que WIZ5/computeHighestStep (creationStore.js).
function computeInitialSubStep(initialData) {
  if (!initialData) return SUB_STEPS.AGE
  if (initialData.originGeo == null) return SUB_STEPS.GEO_ORIGIN
  if (initialData.originSoc == null) return SUB_STEPS.SOCIAL_ORIGIN
  if (initialData.training == null) return SUB_STEPS.TRAINING
  const noCareerYet = !initialData.careers || initialData.careers.length === 0
  if (initialData.training === HIGHER_ED_TRAINING_CODE && initialData.higherEd == null && noCareerYet) return SUB_STEPS.HIGHER_ED
  if (noCareerYet) return SUB_STEPS.CAREERS
  const hasAnyProAdvantage = initialData.careers.some(
    c => c.proAdvantages && Object.keys(c.proAdvantages).length > 0
  )
  const hasAnySetbackRoll = (initialData.setbackRolls?.length ?? 0) > 0
  if (!hasAnyProAdvantage && !hasAnySetbackRoll) {
    const persistedIdx = initialData.highestSubStep ? SUB_STEP_ORDER.indexOf(initialData.highestSubStep) : -1
    const advIdx = SUB_STEP_ORDER.indexOf(SUB_STEPS.ADVANTAGES_AND_SETBACKS)
    return persistedIdx >= advIdx ? SUB_STEPS.SUMMARY : SUB_STEPS.ADVANTAGES_AND_SETBACKS
  }
  return SUB_STEPS.SUMMARY
}

// WIZ15 (docs/EN_COURS.md, 2026-08-11) : Step4ExperienceInner porte `key={gmSyncKey}` — remonté à
// chaque écho WIZARD_STATE_SYNC côté MJ (WizardCreation.jsx) pour que ses ~15 useState(initialData)
// se resynchronisent avec les données fraîches du joueur (patron nécessaire : recommandation React
// officielle contre un useEffect qui listerait chaque champ à la main — cf. bug #13/#14 cette même
// session, une dépendance oubliée redevient un bug de désynchronisation silencieuse).
//
// Mais subStep/highestSubStep (sous-navigation Âge/Origines/Carrières/Récap) sont un état 100% local
// à l'UI, sans rapport avec les données synchronisées — les remonter avec le reste envoyait le MJ sur
// Récap à chaque modification du joueur, quelle que soit la sous-étape qu'il regardait (bug remonté
// par Saar). Solution retenue après vérification de la doc React officielle
// (react.dev/learn/preserving-and-resetting-state, "Option 1 : séparer le composant en deux") : ce
// wrapper NON remonté porte l'état de navigation, Step4ExperienceInner (remonté) porte les données.
// Aucune logique déplacée — subStep/setSubStep/highestSubStep/setHighestSubStep gardent les mêmes
// noms partout dans Step4ExperienceInner, juste reçus en props au lieu d'un useState local.
export default function Step4Experience({ gmSyncKey, initialData, ...rest }) {
  // WIZ21 (docs/EN_COURS.md, 2026-08-11) : un MJ qui rejoint une fiche déjà avancée atterrissait
  // systématiquement sur Récap (choix ci-dessous, correct pour un joueur qui reprend son propre
  // brouillon, pas pour un MJ observateur). Uniquement côté MJ (gmSyncKey non nul — même signal que
  // `isGmView` côté WizardCreation.jsx), on suit la sous-étape réellement affichée chez le joueur via
  // le canal de diffusion live déjà existant (`subStep` ajouté à onLiveChange plus bas dans
  // Step4ExperienceInner) — jamais côté joueur, dont la saisie locale reste toujours prioritaire
  // (§2.5, même règle que le reste de la diffusion live). `WIZARD_LIVE_UPDATE` (WizardLockSync.jsx)
  // est un flux purement direct (le serveur ne rejoue rien à l'arrivée) : `liveSubStep` peut déjà
  // être présent au montage (le joueur était actif juste avant), d'où son utilisation dès l'état
  // initial et pas seulement pour les mises à jour suivantes.
  const liveSubStep = gmSyncKey != null ? initialData?.subStep : undefined
  const liveSubStepValid = liveSubStep && SUB_STEP_ORDER.includes(liveSubStep)
  const initialSubStep = liveSubStepValid ? liveSubStep : computeInitialSubStep(initialData)
  const [subStep, setSubStep] = useState(initialSubStep)
  const [highestSubStep, setHighestSubStep] = useState(initialSubStep)

  // Pattern "adjusting state during render" (react.dev/learn/you-might-not-need-an-effect), déjà
  // utilisé ailleurs dans le projet (SidebarChatTab.jsx) — évite un setState synchrone en corps
  // d'effet (react-hooks/set-state-in-effect) : comparaison à une copie précédente en state, ajustée
  // pendant le rendu plutôt qu'après coup.
  const [prevLiveSubStep, setPrevLiveSubStep] = useState(liveSubStep)
  if (liveSubStep !== prevLiveSubStep) {
    setPrevLiveSubStep(liveSubStep)
    if (liveSubStepValid) {
      setSubStep(liveSubStep)
      setHighestSubStep(prev => (
        SUB_STEP_ORDER.indexOf(liveSubStep) > SUB_STEP_ORDER.indexOf(prev) ? liveSubStep : prev
      ))
    }
  }

  return (
    <Step4ExperienceInner
      key={gmSyncKey}
      initialData={initialData}
      subStep={subStep}
      setSubStep={setSubStep}
      highestSubStep={highestSubStep}
      setHighestSubStep={setHighestSubStep}
      {...rest}
    />
  )
}

function Step4ExperienceInner({
  initialData, pcDispo, onNext, onPrev, onLiveChange,
  subStep, setSubStep, highestSubStep, setHighestSubStep,
}) {
  const { t } = useTranslation('creation')
  const { sheetId, step1Data, step2Data, step5Data, randomProAdvantagesEnabled, reversEnabled, skillMaxLevelEnabled, youngPenaltyEnabled, setStep4Data } = useCreationStore()
  const [age, setAge] = useState(initialData?.age ?? 16)
  const [originGeo, setOriginGeo] = useState(initialData?.originGeo ?? null)
  const [originSoc, setOriginSoc] = useState(initialData?.originSoc ?? null)
  const [training, setTraining] = useState(initialData?.training ?? null)
  const [autodidacteAllocations, setAutodidacteAllocations] = useState(initialData?.autodidacteAllocations ?? {})
  const [higherEd, setHigherEd] = useState(initialData?.higherEd ?? null)
  const [geoName, setGeoName] = useState(initialData?.geoName ?? '')
  const [geoNation, setGeoNation] = useState(initialData?.geoNation ?? '')
  const [socNation, setSocNation] = useState(initialData?.socNation ?? '')
  const [conditionalChoices, setConditionalChoices] = useState(initialData?.conditionalChoices ?? {})
  const [careers, setCareers] = useState(initialData?.careers ?? [])
  const [skillAllocations, setSkillAllocations] = useState(initialData?.skillAllocations ?? {})
  // proAdvantages/randomPicks : jamais envoyés à plat (buildPayload/getStep4State les imbriquent
  // tous les deux sous careers[].proAdvantages/randomPicks, par carrière) — initialData?.proAdvantages
  // était donc toujours undefined ici, quelle que soit la source (brouillon live ou état committé),
  // remis à {} à chaque montage/remontage. Un MJ observateur (remontage sur WIZARD_STATE_SYNC/
  // WIZARD_LIVE_UPDATE) ou un rechargement de page perdait donc systématiquement l'affichage des
  // points déjà placés, alors même que la donnée réelle existait dans careers[]. Reconstruit ici la
  // forme à plat attendue par ProAdvantagesAndSetbacks (clé career_id), à partir de la même source
  // que buildPayload lit en sens inverse à la soumission.
  const [proAdvantages, setProAdvantages] = useState(() => Object.fromEntries(
    (initialData?.careers ?? []).map(c => [c.career_id, c.proAdvantages ?? {}])
  ))
  const [openedSkills, setOpenedSkills] = useState(initialData?.openedSkills ?? [])
  const [randomPicks, setRandomPicks] = useState(() => Object.fromEntries(
    (initialData?.careers ?? []).map(c => [c.career_id, c.randomPicks ?? []])
  ))
  const [setbackRolls, setSetbackRolls] = useState(initialData?.setbackRolls ?? [])
  // Résolution de Revers EN COURS (cascade chained_setback/subroll/choice pas encore committée dans
  // setbackRolls) — remontée ici pour survivre à une navigation entre sous-étapes (ex. Carrières
  // puis retour sur Avantages & Revers, qui démonte/remonte ProAdvantagesAndSetbacks), même patron
  // que randomPicks/setbackRolls ci-dessus. Jamais envoyée au serveur (buildPayload ne la reprend
  // pas) : purement un confort UI local à cette sous-étape, incomplète par nature.
  const [setbackResolution, setSetbackResolution] = useState(initialData?.setbackResolution ?? null)
  const [refData, setRefData] = useState({ loading: true, geoOrigins: [], socialOrigins: [], trainings: [], higherEds: [], careers: [], setbacks: [] })
  const [refSkills, setRefSkills] = useState([])
  // Catalogue des avantages (Lot 5, 2026-07-23) : réutilisé tel quel depuis Step5 (même endpoint,
  // /creation/:sheetId/step5/ref) pour afficher un nom lisible sur la note manual_grant_choice
  // (Choc psychologique, Fugitif...) au lieu des codes advantage_id bruts (adv_044...).
  const [advantagesCatalog, setAdvantagesCatalog] = useState([])

  const handleSkillAllocationsChange = useCallback((next) => setSkillAllocations(next), [])
  const handleProAdvantagesChange = useCallback((next) => setProAdvantages(next), [])
  const handleOpenedSkillsChange = useCallback((next) => setOpenedSkills(next), [])
  const handleRandomPicksChange = useCallback((next) => setRandomPicks(next), [])
  const handleSetbackRollsChange = useCallback((next) => setSetbackRolls(next), [])
  const handleSetbackResolutionChange = useCallback((next) => setSetbackResolution(next), [])

  useEffect(() => {
    if (!sheetId) return
    api.get(`/creation/${sheetId}/step4/ref`)
      .then(res => setRefData({
        loading: false,
        geoOrigins: res.data.geoOrigins ?? [],
        socialOrigins: res.data.socialOrigins ?? [],
        trainings: res.data.trainings ?? [],
        higherEds: res.data.higherEds ?? [],
        careers: res.data.careers ?? [],
        setbacks: res.data.setbacks ?? [],
      }))
      .catch(() => setRefData({ loading: false, geoOrigins: [], socialOrigins: [], trainings: [], higherEds: [], careers: [], setbacks: [] }))
    api.get('/char-ref/skills')
      .then(res => setRefSkills(res.data.skills ?? []))
      .catch(() => setRefSkills([]))
    api.get(`/creation/${sheetId}/step5/ref`)
      .then(res => setAdvantagesCatalog(res.data ?? []))
      .catch(() => setAdvantagesCatalog([]))
  }, [sheetId])

  // ─── Données filtrées ──────────────────────────────────────────
  // Mémoïsés (WIZ38-CRASH1) : non mémoïsés, ces 4 tableaux/4 items recréaient de nouveaux objets à
  // CHAQUE rendu (même sans changement d'origine/formation), rendant `baseMastery`/`boardSkillIds`
  // (CareersAllocator.jsx, dépendent de selectedXItem) instables à leur tour — l'effet
  // PRUNE_ALLOCATIONS (deps [boardSkillIds]) se redéclenchait alors à chaque rendu, remontait un
  // nouvel objet skillAllocations au parent via onSkillAllocationsChange, qui re-render ce
  // composant : boucle "Maximum update depth exceeded" confirmée en navigateur (stack
  // [DBG-WIZCRASH], CareersAllocator.jsx:367).
  const enrichedGeoOrigins = useMemo(() => refData.geoOrigins.map(enrichBg), [refData.geoOrigins])
  const filteredSocialOrigins = useMemo(() => refData.socialOrigins
    .filter(s => s.parent_code === originGeo || s.parent_code === null)
    .map(enrichBg), [refData.socialOrigins, originGeo])
  const filteredTrainings = useMemo(() => refData.trainings
    .filter(t => t.parent_code === originSoc || t.parent_code === null)
    .map(enrichBg), [refData.trainings, originSoc])
  const showHigherEd = training === HIGHER_ED_TRAINING_CODE
  const filteredHigherEds = useMemo(
    () => (showHigherEd ? refData.higherEds.map(enrichBg) : []),
    [refData.higherEds, showHigherEd]
  )

  // ─── Éléments sélectionnés (avec détails) ──────────────────────
  const selectedGeoItem = useMemo(
    () => enrichedGeoOrigins.find(g => g.code === originGeo) || null,
    [enrichedGeoOrigins, originGeo]
  )
  const selectedSocItem = useMemo(
    () => filteredSocialOrigins.find(s => s.code === originSoc) || null,
    [filteredSocialOrigins, originSoc]
  )
  const selectedTrainingItem = useMemo(
    () => filteredTrainings.find(t => t.code === training) || null,
    [filteredTrainings, training]
  )
  const selectedHigherEdItem = useMemo(
    () => filteredHigherEds.find(h => h.code === higherEd) || null,
    [filteredHigherEds, higherEd]
  )

  // ─── PC calculés ───────────────────────────────────────────────
  const totalCareerYears = careers.reduce((sum, c) => sum + c.years, 0)
  const totalPC = (higherEd ? 1 : 0) + totalCareerYears
  const finalAge = age + (selectedHigherEdItem?.years_added ?? 0) + totalCareerYears

  // ─── OPT-06 (revers) — total cumulé, pas par carrière (shared/careerSetbacks.js) ───
  const setbackBlockCount = getSetbackBlockCount(totalCareerYears)
  const showSetbacks = !!reversEnabled && setbackBlockCount > 0
  // Dérivé (pas d'effet + setState) : si le joueur revient sur Carrières et réduit le total
  // d'années, une tranche déjà jetée peut devenir hors bornes — filtrée ici plutôt que purgée en
  // état, ProAdvantagesAndSetbacks se remonte avec cette valeur à chaque retour sur la sous-step.
  // Mémoïsé (useMemo, pas un .filter() nu) — sans ça, un nouveau tableau à chaque rendu redéclenche
  // l'effet de diffusion live plus bas (dépendance instable), cause racine confirmée d'un "Maximum
  // update depth exceeded" trouvé par Saar en test réel (combiné à l'effet liveYears juste en dessous,
  // qui écrit dans le store à chaque montage de cette étape).
  const validSetbackRolls = useMemo(
    () => setbackRolls.filter(r => r.blockIndex < setbackBlockCount),
    [setbackRolls, setbackBlockCount]
  )
  // Même garde pour la résolution en cours (même raison : une tranche redevenue hors bornes ne doit
  // pas rester "en cascade" indéfiniment côté UI).
  const validSetbackResolution = setbackResolution && setbackResolution.blockIndex < setbackBlockCount ? setbackResolution : null

  // Force Polaris (adv_077/078/079) — condition du palier 2 du Revers Polaris (§8.2). Choisie
  // exclusivement en Step5 (jamais accordée en Step2) : lors d'un 1er passage linéaire, step5Data
  // est encore null, donc faux — cohérent avec le serveur qui interroge char_advantages à cet
  // instant. Ne redevient pertinent que si le joueur revient sur Step4 après avoir déjà fait Step5.
  const forcePolaris = !!step5Data?.advantages?.some(id => ['adv_077', 'adv_078', 'adv_079'].includes(id))

  // ─── Handlers ──────────────────────────────────────────────────
  const handleSelectGeoOrigin = (code) => {
  if (code === originGeo) return
  setOriginGeo(code)
  setOriginSoc(null)
  setTraining(null)
  setHigherEd(null)
  setGeoName('')
  setGeoNation('')
  setSocNation('')
  setConditionalChoices({})
  setAutodidacteAllocations({})
}

  const handleRandomGeoOrigin = () => {
    if (enrichedGeoOrigins.length === 0) return
    const idx = Math.floor(Math.random() * enrichedGeoOrigins.length)
    handleSelectGeoOrigin(enrichedGeoOrigins[idx].code)
  }

  const handleSelectSocialOrigin = (code) => {
  if (code === originSoc) return
  setOriginSoc(code)
  setTraining(null)
  setHigherEd(null)
  setSocNation('')
  setConditionalChoices({})
  setAutodidacteAllocations({})
}

  const handleRandomSocialOrigin = () => {
    if (filteredSocialOrigins.length === 0) return
    const idx = Math.floor(Math.random() * filteredSocialOrigins.length)
    handleSelectSocialOrigin(filteredSocialOrigins[idx].code)
  }

  const handleSelectTraining = (code) => {
  if (code === training) return
  setTraining(code)
  setHigherEd(null)
  setConditionalChoices({})
  setAutodidacteAllocations({})
}

  const handleRandomTraining = () => {
    if (filteredTrainings.length === 0) return
    const idx = Math.floor(Math.random() * filteredTrainings.length)
    handleSelectTraining(filteredTrainings[idx].code)
  }

  const handleSelectHigherEd = (code) => {
    setHigherEd(code)
  }

  const handleSkipHigherEd = () => {
    setHigherEd(null)
  }
  
  const handleConditionalChoice = (compositeKey, skillId) => {
  setConditionalChoices(prev => {
    const next = { ...prev }
    if (skillId === null) {
      delete next[compositeKey]
    } else {
      next[compositeKey] = skillId
    }
    return next
  })
}

  const handleAddCareer = (careerId, careerName, careerTitles, years) => {
    setCareers(prev => [...prev, {
      career_id: careerId,
      career_name: careerName,
      titles: careerTitles,
      years,
    }])
  }

  // WIZ4 (docs/EN_COURS.md) — isReachable (rendu plus bas) ne se fiait qu'à highestSubStep (position
  // la plus loin jamais atteinte), jamais revalidé après coup : retirer sa seule carrière laissait
  // Récap "reachable" par la sous-navigation, cliquable directement, alors que CAREERS redevient la
  // sous-étape la plus loin réellement valide (même règle que noCareerYet dans
  // computeInitialSubStep ci-dessus). Aucune perte de donnée possible dans les deux cas (le filet
  // serveur reconcileCreation rejette déjà tout Step4 sans carrière) — seul le blocage passe
  // d'un rejet tardif à l'ajout non-immédiat.
  const handleRemoveCareer = (index) => {
    const next = careers.filter((_, i) => i !== index)
    setCareers(next)
    if (next.length === 0 && SUB_STEP_ORDER.indexOf(SUB_STEPS.CAREERS) < SUB_STEP_ORDER.indexOf(highestSubStep)) {
      setHighestSubStep(SUB_STEPS.CAREERS)
    }
  }

  // useCallback (pas une fonction nue) : sa propre liste de deps est vérifiable par ESLint
  // (react-hooks/exhaustive-deps) contre le corps de la fonction elle-même — bug #13/#14
  // (docs/BUG WIZARD.md) : proAdvantages/randomPicks étaient lus ici mais absents de la liste de
  // deps *manuellement dupliquée* sur l'ancien useEffect plus bas, qui ne pouvait pas être vérifiée
  // par lint contre ce corps. En centralisant la liste ici, tout futur champ ajouté à buildPayload
  // et oublié dans ces deps redeviendra un warning ESLint, pas un bug de diffusion silencieux.
  const buildPayload = useCallback(() => {
    const careerEntries = careers.map(c => ({
      career_id: c.career_id,
      years: c.years,
      proAdvantages: proAdvantages[c.career_id] || {},
      randomPicks: randomPicks[c.career_id] || [],
    }))
    return {
      age,
      finalAge,
      originGeo,
      originSoc,
      training,
      higherEd,
      geoName,
      geoNation,
      socNation,
      careers: careerEntries,
      skillAllocations,
      openedSkills,
      autodidacteAllocations,
      setbackRolls: validSetbackRolls,
      pcSpent: totalPC,
      appliedSkills: Object.values(conditionalChoices),
    }
  }, [
    age, finalAge, originGeo, originSoc, training, higherEd, geoName, geoNation, socNation,
    careers, proAdvantages, randomPicks, skillAllocations, openedSkills, autodidacteAllocations,
    validSetbackRolls, totalPC, conditionalChoices,
  ])

  // highestSubStep (migration 248, char_sheet.wizard_progress) : même exception que `subStep` sur
  // onLiveChange ci-dessous (WIZ21) — ajouté ici, jamais dans buildPayload lui-même, qui reste
  // ignorant de la navigation UI. Le serveur (reconcileCreation) ne l'avance jamais en arrière.
  const handleSubmit = () => {
    onNext?.({ ...buildPayload(), highestSubStep })
  }

  // Diffusion live (Lot A4, docs/PLAN_WIZARDCOLLAB.md §2.5/§6.4bis) au MJ, ET commit continu dans le
  // store (WIZ45, docs/EN_COURS.md) — réutilise buildPayload (même forme que la soumission finale).
  // buildPayload est stable (useCallback ci-dessus) : ne se recrée que si l'une de ses propres deps
  // change réellement, donc pas de risque de boucle à la lister ici (cf. l'incident "Maximum update
  // depth exceeded" documenté sur validSetbackRolls plus haut, qui reste mémoïsé via useMemo).
  // Remplace l'ancien effet `liveYears` (qui ne committait que le coût PC en direct, pour le seul
  // header) : celui-ci committait déjà un fragment de step4Data avant que "Suivant" ne soit cliqué,
  // précisément pour éviter la classe de bug que WIZ45 a trouvée ailleurs (Précédent/stepper perdant
  // les champs non validés) — généralisé ici à la totalité du payload plutôt que ce seul champ.
  //
  // WIZ21 (docs/EN_COURS.md, 2026-08-11) : `subStep` ajouté UNIQUEMENT à la diffusion live, jamais au
  // commit local — buildPayload reste ignorant de la navigation UI (le serveur ne l'avance jamais en
  // arrière), même séparation que handleSubmit (onNext) ci-dessus.
  useEffect(() => {
    const payload = buildPayload()
    onLiveChange?.({ ...payload, subStep })
    setStep4Data(payload)
  }, [buildPayload, subStep, onLiveChange, setStep4Data])

  // ─── Navigation ────────────────────────────────────────────────
  const advanceSubStep = (next) => {
    setSubStep(next)
    setHighestSubStep(prev => {
      const nextIdx = SUB_STEP_ORDER.indexOf(next)
      const prevIdx = SUB_STEP_ORDER.indexOf(prev)
      return nextIdx > prevIdx ? next : prev
    })
  }

  const handleSubNext = () => {
    const idx = SUB_STEP_ORDER.indexOf(subStep)
    if (subStep === SUB_STEPS.TRAINING && !showHigherEd) {
      advanceSubStep(SUB_STEPS.CAREERS)
      return
    }

    if (idx < SUB_STEP_ORDER.length - 1) {
      advanceSubStep(SUB_STEP_ORDER[idx + 1])
    }
  }

  const handleSubPrev = () => {
    const idx = SUB_STEP_ORDER.indexOf(subStep)
    if (subStep === SUB_STEPS.CAREERS && !showHigherEd) {
      setSubStep(SUB_STEPS.TRAINING)
      return
    }
    if (subStep === SUB_STEPS.SUMMARY) {
  setSubStep(SUB_STEPS.ADVANTAGES_AND_SETBACKS)
  return
}
    if (idx > 0) {
      setSubStep(SUB_STEP_ORDER[idx - 1])
    } else {
      onPrev()
    }
  }

  // ─── Rendu ─────────────────────────────────────────────────────
  return (
    <div style={s.container}>
      <div style={s.subSteps}>
        {SUB_STEP_ORDER.map(ss => {
          const isActive = subStep === ss
          const isReachable = SUB_STEP_ORDER.indexOf(ss) <= SUB_STEP_ORDER.indexOf(highestSubStep)
          const isClickable = isReachable && !isActive
            && (ss !== SUB_STEPS.HIGHER_ED || showHigherEd)
          return (
            <span
              key={ss}
              style={{
                ...s.subStep,
                ...(isActive ? s.subStepActive : isReachable ? s.subStepDone : {}),
                cursor: isClickable ? 'pointer' : 'default',
              }}
              onClick={isClickable ? () => setSubStep(ss) : undefined}
            >
              {t(`step4.sub_${ss}`)}
            </span>
          )
        })}
      </div>

      {subStep === SUB_STEPS.AGE && (
        <AgeSelector
          age={age}
          onChange={setAge}
          attributes={step1Data?.attributes}
          youngPenaltyEnabled={youngPenaltyEnabled}
          onNext={handleSubNext}
          onPrev={handleSubPrev}
        />
      )}

      {subStep === SUB_STEPS.GEO_ORIGIN && (
        <BackgroundSelector
          title={t('step4.geo_origin_title')}
          items={enrichedGeoOrigins}
          selected={originGeo}
          selectedItem={selectedGeoItem}
          onSelect={handleSelectGeoOrigin}
          onRandom={handleRandomGeoOrigin}
          onNext={handleSubNext}
          onPrev={handleSubPrev}
          canNext={!!originGeo}
          randomLabel={t('step4.geo_random')}
          customName={geoName}
          onNameChange={setGeoName}
          nation={geoNation}
          onNationChange={setGeoNation}
		  conditionalChoices={conditionalChoices}
		  onConditionalChoice={handleConditionalChoice}
          optionKeyFor={originGeoOptionKey}
        />
      )}

      {subStep === SUB_STEPS.SOCIAL_ORIGIN && (
        <BackgroundSelector
          title={t('step4.social_origin_title')}
          items={filteredSocialOrigins}
          selected={originSoc}
          selectedItem={selectedSocItem}
          onSelect={handleSelectSocialOrigin}
          onRandom={handleRandomSocialOrigin}
          onNext={handleSubNext}
          onPrev={handleSubPrev}
          canNext={!!originSoc}
          randomLabel={t('step4.social_random')}
          nation={socNation}
          onNationChange={setSocNation}
          defaultNation={geoNation}
		  conditionalChoices={conditionalChoices}
		  onConditionalChoice={handleConditionalChoice}
          optionKeyFor={originSocOptionKey}
        />
      )}

      {subStep === SUB_STEPS.TRAINING && (
        <BackgroundSelector
          title={t('step4.training_title')}
          items={filteredTrainings}
          selected={training}
          selectedItem={selectedTrainingItem}
          onSelect={handleSelectTraining}
          onRandom={handleRandomTraining}
          onNext={handleSubNext}
          onPrev={handleSubPrev}
          canNext={!!training}
          randomLabel={t('step4.training_random')}
		  conditionalChoices={conditionalChoices}
		  onConditionalChoice={handleConditionalChoice}
          refSkills={refSkills}
          autodidacteAllocations={autodidacteAllocations}
          onAutodidacteAllocationsChange={setAutodidacteAllocations}
          optionKeyFor={trainingOptionKey}
        />
      )}

      {subStep === SUB_STEPS.HIGHER_ED && (
        showHigherEd ? (
          <BackgroundSelector
            title={t('step4.higher_ed_title')}
            items={filteredHigherEds}
            selected={higherEd}
            selectedItem={selectedHigherEdItem}
            onSelect={handleSelectHigherEd}
            onNext={handleSubNext}
            onPrev={handleSubPrev}
            canNext={true}
            extraInfo={t('step4.higher_ed_cost')}
            skipLabel={t('step4.higher_ed_skip')}
            onSkip={handleSkipHigherEd}
			conditionalChoices={conditionalChoices}
		    onConditionalChoice={handleConditionalChoice}
          />
        ) : (
          <div style={s.placeholder}>
            <p style={s.placeholderText}>{t('step4.higher_ed_unavailable')}</p>
            <div style={s.placeholderNav}>
              <button style={s.backBtn} onClick={handleSubPrev}>
                {t('step4.prev')}
              </button>
              <button style={s.nextBtn} onClick={handleSubNext}>
                {t('step4.next')}
              </button>
            </div>
          </div>
        )
      )}

{subStep === SUB_STEPS.CAREERS && (
  <CareersAllocator
    // pcDispo (prop) est getStepBudget(step) côté WizardCreation — exclut explicitement la
    // dépense déjà committed de CETTE étape (bug #4, docs/BUG WIZARD.md : sans l'exclusion, un
    // retour sur l'étape déjà validée la double-comptait). CareersAllocator soustrait lui-même son
    // propre totalPC (somme des années déjà choisies) : aucune compensation supplémentaire ici.
    pcDispo={pcDispo - (higherEd ? 1 : 0)}
    selectedCareers={careers}
    careers={refData.careers}
    onAdd={handleAddCareer}
    onRemove={handleRemoveCareer}
    onNext={handleSubNext}
    onPrev={handleSubPrev}
    selectedGeoItem={selectedGeoItem}
    selectedSocItem={selectedSocItem}
    selectedTrainingItem={selectedTrainingItem}
    selectedHigherEdItem={selectedHigherEdItem}
    baseAge={age + (selectedHigherEdItem?.years_added ?? 0)}
    attributes={step1Data?.attributes}
    genotypeId={step2Data?.genotypeId}
    higherEd={higherEd}
    refSkills={refSkills}
    initialSkillAllocations={skillAllocations}
    onSkillAllocationsChange={handleSkillAllocationsChange}
    initialOpenedSkills={openedSkills}
    onOpenedSkillsChange={handleOpenedSkillsChange}
    skillMaxLevelEnabled={skillMaxLevelEnabled}
  />
)}

{subStep === SUB_STEPS.ADVANTAGES_AND_SETBACKS && (
  <ProAdvantagesAndSetbacks
    selectedCareers={careers}
    careers={refData.careers}
    totalYears={totalCareerYears}
    setbackRows={refData.setbacks}
    advantagesCatalog={advantagesCatalog}
    initialProAdvantages={proAdvantages}
    initialRandomPicks={randomPicks}
    initialSetbackRolls={setbackRolls}
    initialSetbackResolution={validSetbackResolution}
    onProAdvantagesChange={handleProAdvantagesChange}
    onRandomPicksChange={handleRandomPicksChange}
    onSetbackRollsChange={handleSetbackRollsChange}
    onSetbackResolutionChange={handleSetbackResolutionChange}
    randomProAdvantagesEnabled={randomProAdvantagesEnabled}
    reversEnabled={reversEnabled}
    forcePolaris={forcePolaris}
    onNext={handleSubNext}
    onPrev={handleSubPrev}
  />
)}

      {subStep === SUB_STEPS.SUMMARY && (
  <Step4Summary
    age={finalAge}
    originGeo={originGeo}
    originSoc={originSoc}
    training={training}
    higherEd={higherEd}
    careers={careers}
    geoName={geoName}
    geoNation={geoNation}
    socNation={socNation}
    selectedGeoItem={selectedGeoItem}
    selectedSocItem={selectedSocItem}
    selectedTrainingItem={selectedTrainingItem}
    selectedHigherEdItem={selectedHigherEdItem}
    onPrev={handleSubPrev}
    onSubmit={handleSubmit}
  />
)}
    </div>
  )
}

const s = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    // WIZ19 (docs/BUG WIZARD.md #22) : minHeight:0 nécessaire pour que le scroll interne de
    // BackgroundSelector.jsx (flex:1/overflowY:auto) se déclenche réellement — sans ça, un flex
    // item hérite d'un min-height:auto qui le fait grandir avec son contenu au lieu de se borner à
    // l'espace disponible, et c'est alors WizardCreation.jsx (body: overflow:hidden) qui coupe tout
    // au lieu de laisser défiler.
    minHeight: 0,
  },
  subSteps: {
    display: 'flex',
    justifyContent: 'center',
    gap: '4px',
    padding: '12px 20px',
    borderBottom: '1px solid #1e1e2e',
    backgroundColor: '#0a0a18',
    flexWrap: 'wrap',
  },
  subStep: {
    padding: '4px 10px',
    borderRadius: '3px',
    color: '#5a5a7a',
    fontSize: '11px',
    fontWeight: '600',
    backgroundColor: 'transparent',
    border: '1px solid transparent',
    transition: 'all 0.15s ease',
  },
  subStepActive: {
    color: '#c8c8f0',
    backgroundColor: '#1a1a2e',
    borderColor: '#3a3a5e',
  },
  subStepDone: {
    color: '#7a8ab8',
    backgroundColor: 'rgba(91,141,238,0.06)',
    borderColor: 'rgba(91,141,238,0.22)',
  },
  placeholder: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '24px',
    padding: '60px 20px',
  },
  placeholderText: {
    color: '#e0a85c',
    fontSize: '16px',
    fontWeight: '600',
  },
  placeholderNav: {
    display: 'flex',
    gap: '16px',
  },
  backBtn: {
    padding: '8px 18px',
    backgroundColor: 'transparent',
    border: '1px solid #2a2a3e',
    borderRadius: '4px',
    color: '#8080a0',
    cursor: 'pointer',
    fontSize: '13px',
  },
}