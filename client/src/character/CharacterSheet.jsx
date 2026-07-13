/**
 * CharacterSheet.jsx — Fiche personnage Polaris (Modules 1 à 6 + XP)
 *
 * Monté dans l'onglet "Fiche" de CharacterWindow.
 * Charge et sauvegarde les données via l'API char-sheet.
 *
 * Modules couverts :
 *   Module 1 — Identité : nom, description physique, main, signes
 *   Module 2 — Archétype : génotype, âge, sexe, fécondité, origines, formations
 *   Module 3 — Attributs primaires : base, pc, modif génotype, niveau actuel, AN
 *   Module 4 — Attributs secondaires : REA, Initiative, seuils, vitesses, Mod_Dom
 *   Module 5 — Compétences : affichage par famille, calcul Base/Total, saisie maîtrise
 *   Module 6 — Avantages & Désavantages : mutations, Force Polaris, texte libre
 *   Module XP — Section Expérience : xp_total, xp_available, mode Progression
 *
 * Règles de calcul (source : journal chantier + FichePerso_v4) :
 *   na  = base + pc + mod_gen  (plancher 3)
 *   AN  = table de correspondance na → AN
 *   REA = floor((ADA_na + PER_na) / 2 + 0.4) + mod_avantage   — arrondi Polaris 0.5→bas
 *   Seuil_Étour = floor((FOR_na + CON_na + VOL_na) / 3 + 0.4)
 *   Seuil_Incons = Seuil_Étour + 10
 *   Allures (LdB p.221) : lookup table par COO_na (Lente/Moyenne/Rapide) et Athlétisme total (Max)
 *   Mod_Dom : table fixe si FOR_na ≤ 21, sinon 5 + floor((FOR_na - 21) / 2)
 *
 * Sauvegarde : au blur de chaque champ (pas à chaque frappe).
 * TOTAL_MALUS = 0 en V1 (modules armures/blessures futurs).
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'
import SkillsPanel from './SkillsPanel.jsx'
import AdvantagesPanel from './AdvantagesPanel.jsx'
import {
  calcAN, calcAllureMoy, calcAllures,
  calcNA, getGenotypeModForAttr, getMutationModForAttr,
  calcREA, getAdvantageModForAttr, getAdvantageModForResistance, getMutationModForResistance,
  getAdvantageRowsForAttr, getAdvantageRowsForResistance, getNaturalArmorMod,
  calcResistanceDommages, calcResistanceNaturelle, calcResistanceDroguesInput, calcSouffle, calcSeuils,
} from '../../../shared/polarisUtils.js'

// ─── Constantes métier ────────────────────────────────────────────────────────

const ATTR_IDS = ['FOR', 'CON', 'COO', 'ADA', 'PER', 'INT', 'VOL', 'PRE']

const ATTR_DESCRIPTIONS = {
  FOR: "La Force est une mesure de la puissance brute d'un individu, sa capacité musculaire.",
  CON: "La Constitution caractérise l'endurance d'un individu, sa santé, sa résistance à l'effort physique, aux poisons, aux maladies, aux traumatismes, aux conditions extrêmes.",
  COO: "La Coordination détermine la coordination neuromusculaire du personnage, mais aussi plus largement son agilité physique, son sens de l'équilibre, la fluidité et la précision de ses gestes, de ses mouvements et de ses déplacements.",
  ADA: "L'Adaptation représente la capacité du personnage à s'adapter à son environnement, et notamment à une situation qui change brutalement, les réflexes issus de son instinct de survie et la rapidité de sa réflexion.",
  PER: "La Perception détermine l'acuité des cinq sens du personnage, mais aussi sa vigilance, l'attention qu'il porte à son environnement ou au comportement des gens, sa capacité à remarquer les petits détails du monde qui l'entoure.",
  INT: "L'Intelligence mesure les capacités mentales d'un individu. C'est aussi sa faculté d'assimilation de nouvelles connaissances.",
  VOL: "La Volonté détermine la résistance mentale d'une personne, sa capacité à maîtriser ses réactions en situation de stress et le temps pendant lequel elle peut maintenir sa concentration sur une action quelconque. C'est aussi sa persévérance, sa force de caractère et sa volonté de survivre face à l'adversité.",
  PRE: "La Présence est une mesure de l'aura dégagée par une personne, de son charisme. Son importance est vitale dans toutes les actions relationnelles : séduire, impressionner, commander, intimider… Plus largement, cet attribut est utile pour s'intégrer dans un groupe, engager le dialogue avec des inconnus ou se faire de nouvelles relations.",
  CHC: "La Chance est un Attribut particulier, qui représente la capacité du personnage à bénéficier de temps à autre d'un coup de pouce du destin. Utiliser sa Chance permet d'éviter certains événements malheureux, de relancer des dés lors de tests malchanceux, de réduire la gravité de certaines blessures ou même d'obtenir des indices et des petits bonus supplémentaires de la part du MJ. Le score de Chance est exprimé par un niveau, sur 20.",
}

// Labels attributs Polaris — voir fr.json charSheet.attr.* pour les traductions

// AN_TABLE, calcAN, calcAllureMoy, calcAllures — importés depuis shared/polarisUtils.js

// Table Mod_Dom (FOR_na 1–21)
const MOD_DOM_TABLE = [
  { min: 1,  max: 2,  val: -6 },
  { min: 3,  max: 4,  val: -4 },
  { min: 5,  max: 6,  val: -2 },
  { min: 7,  max: 8,  val: -1 },
  { min: 9,  max: 11, val:  0 },
  { min: 12, max: 13, val:  1 },
  { min: 14, max: 15, val:  2 },
  { min: 16, max: 17, val:  3 },
  { min: 18, max: 19, val:  4 },
  { min: 20, max: 21, val:  5 },
]

// ─── Fonctions de calcul ──────────────────────────────────────────────────────
// calcNA/getGenotypeModForAttr/getMutationModForAttr importées depuis shared/polarisUtils.js —
// source de calcul unique partagée avec le serveur (docs/PLAN_MUTATION2.md Lot 1).

const calcModDom = (forNA) => {
  if (forNA > 21) return 5 + Math.floor((forNA - 21) / 2)
  const entry = MOD_DOM_TABLE.find(e => forNA >= e.min && forNA <= e.max)
  return entry ? entry.val : -6
}

// Résistance aux Dommages + Choc (Seuils) + Résistances naturelles : attribut (table LdB p.114) +
// mutation + avantage, même pipeline que le serveur (docs/PLAN_RESNAT.md, docs/PLAN_MUTATION2.md
// Lot 3). RD/Choc désormais rebranchés à la résolution de combat réelle (resolveTargetHit via
// damageService.js) dans la même passe que la fiche — plus d'écart fiche/résolution.
const calcSecondary = (naMap, charAdvantages, mutationEffects) => {
  const FOR = naMap['FOR'] || 3
  const CON = naMap['CON'] || 3
  const ADA = naMap['ADA'] || 3
  const PER = naMap['PER'] || 3
  const VOL = naMap['VOL'] || 3

  const rea    = calcREA(ADA, PER, getAdvantageModForAttr(charAdvantages, 'reaction'))
  const initiative = rea
  const seuils = calcSeuils(FOR, CON, VOL, getMutationModForResistance(mutationEffects, 'shock'), getAdvantageModForResistance(charAdvantages, 'shock'))
  const seuilEtour  = seuils.etourdissement
  const seuilIncons = seuils.inconscience
  const modDom      = calcModDom(FOR)
  const resistanceDommages = calcResistanceDommages(FOR, CON, getMutationModForResistance(mutationEffects, 'damage') + getNaturalArmorMod(mutationEffects), getAdvantageModForResistance(charAdvantages, 'damage'))
  const resistancePoison    = calcResistanceNaturelle(CON) + getMutationModForResistance(mutationEffects, 'poison') + getAdvantageModForResistance(charAdvantages, 'poison')
  const resistanceMaladie   = calcResistanceNaturelle(CON) + getMutationModForResistance(mutationEffects, 'disease') + getAdvantageModForResistance(charAdvantages, 'disease')
  const resistanceRadiation = calcResistanceNaturelle(CON) + getMutationModForResistance(mutationEffects, 'radiation') + getAdvantageModForResistance(charAdvantages, 'radiation')
  const resistanceDrogues   = calcResistanceNaturelle(calcResistanceDroguesInput(CON, VOL)) + getMutationModForResistance(mutationEffects, 'drugs') + getAdvantageModForResistance(charAdvantages, 'drugs')
  const souffle = calcSouffle(CON, VOL, getAdvantageModForAttr(charAdvantages, 'breath'))

  return {
    rea, initiative, seuilEtour, seuilIncons, modDom, resistanceDommages,
    resistancePoison, resistanceMaladie, resistanceRadiation, resistanceDrogues, souffle,
  }
}

// Détail de calcul en tooltip (Base / avantages nommés / mutations en total / Total) — même pattern
// que iniTooltip (useMemo dans le composant, plus bas). Mutations affichées en total agrégé
// (char_mutation_effects_view ne conserve pas le détail par mutation côté client, contrairement aux
// avantages qui sont déjà des lignes individuelles nommées). Description conservée telle quelle si
// aucun avantage/mutation actif (pas de breakdown trivial Base=Total).
const formatMod = (v) => (v > 0 ? `+${v}` : `${v}`)

function attrBreakdownTooltip(description, base, advantageRows, total, t) {
  if (!advantageRows.length) return description
  const lines = [description, '', `${t('charSheet.tooltip.breakdownBase')} ${base}`]
  for (const row of advantageRows) lines.push(`${row.name} : ${formatMod(row.mod_value)}`)
  lines.push(`${t('charSheet.tooltip.breakdownTotal')} ${total}`)
  return lines.join('\n')
}

function resistanceBreakdownTooltip(description, base, advantageRows, mutationMod, total, t) {
  if (!advantageRows.length && !mutationMod) return description
  const lines = [description, '', `${t('charSheet.tooltip.breakdownBase')} ${base}`]
  for (const row of advantageRows) lines.push(`${row.name} : ${formatMod(row.mod_res_value)}`)
  if (mutationMod) lines.push(`${t('charSheet.tooltip.breakdownMutations')} ${formatMod(mutationMod)}`)
  lines.push(`${t('charSheet.tooltip.breakdownTotal')} ${total}`)
  return lines.join('\n')
}

function buildSecondaryTooltips(naMap, charAdvantages, mutationEffects, secondary, t) {
  const FOR = naMap['FOR'] || 3
  const CON = naMap['CON'] || 3
  const ADA = naMap['ADA'] || 3
  const PER = naMap['PER'] || 3
  const VOL = naMap['VOL'] || 3

  const reaBase     = calcREA(ADA, PER, 0)
  const souffleBase = calcSouffle(CON, VOL, 0)
  const seuilsBase  = calcSeuils(FOR, CON, VOL, 0, 0)
  const rdBase      = calcResistanceDommages(FOR, CON, 0, 0)

  return {
    reaction: attrBreakdownTooltip(t('charSheet.tooltip.reaction'), reaBase, getAdvantageRowsForAttr(charAdvantages, 'reaction'), secondary.rea, t),
    souffle:  attrBreakdownTooltip(t('charSheet.tooltip.souffle'), souffleBase, getAdvantageRowsForAttr(charAdvantages, 'breath'), secondary.souffle, t),
    seuilEtour:  resistanceBreakdownTooltip(t('charSheet.tooltip.seuilEtour'), seuilsBase.etourdissement, getAdvantageRowsForResistance(charAdvantages, 'shock'), getMutationModForResistance(mutationEffects, 'shock'), secondary.seuilEtour, t),
    seuilIncons: resistanceBreakdownTooltip(t('charSheet.tooltip.seuilIncons'), seuilsBase.inconscience, getAdvantageRowsForResistance(charAdvantages, 'shock'), getMutationModForResistance(mutationEffects, 'shock'), secondary.seuilIncons, t),
    resistanceDommages: resistanceBreakdownTooltip(t('charSheet.tooltip.resistanceDommages'), rdBase, getAdvantageRowsForResistance(charAdvantages, 'damage'), getMutationModForResistance(mutationEffects, 'damage') + getNaturalArmorMod(mutationEffects), secondary.resistanceDommages, t),
    resistancePoison:    resistanceBreakdownTooltip(t('charSheet.tooltip.resistancePoison'), calcResistanceNaturelle(CON), getAdvantageRowsForResistance(charAdvantages, 'poison'), getMutationModForResistance(mutationEffects, 'poison'), secondary.resistancePoison, t),
    resistanceMaladie:   resistanceBreakdownTooltip(t('charSheet.tooltip.resistanceMaladie'), calcResistanceNaturelle(CON), getAdvantageRowsForResistance(charAdvantages, 'disease'), getMutationModForResistance(mutationEffects, 'disease'), secondary.resistanceMaladie, t),
    resistanceRadiation: resistanceBreakdownTooltip(t('charSheet.tooltip.resistanceRadiation'), calcResistanceNaturelle(CON), getAdvantageRowsForResistance(charAdvantages, 'radiation'), getMutationModForResistance(mutationEffects, 'radiation'), secondary.resistanceRadiation, t),
    resistanceDrogues:   resistanceBreakdownTooltip(t('charSheet.tooltip.resistanceDrogues'), calcResistanceNaturelle(calcResistanceDroguesInput(CON, VOL)), getAdvantageRowsForResistance(charAdvantages, 'drugs'), getMutationModForResistance(mutationEffects, 'drugs'), secondary.resistanceDrogues, t),
  }
}

// ─── Accordéon des blocs ────────────────────────────────────────────────────
// Mémorisation par TYPE de fiche (propriétaire vs autres), pas par personnage — demande explicite
// Saar : "mes fiches perso ne s'affichent pas pareil que les autres". Le composant ne remonte pas
// entre deux personnages (pas de key={characterId}, dette connue depuis Session 141 suite 9) —
// l'état est donc rechargé via useEffect([isOwner, characterId]), pas seulement à l'init.
const ACCORDION_BLOCK_IDS = ['xp', 'description', 'attributes', 'secondary', 'skills', 'advantages']
const DEFAULT_ACCORDION_STATE = Object.fromEntries(ACCORDION_BLOCK_IDS.map(id => [id, true]))

function getAccordionStorageKey(isOwner) {
  return isOwner ? 'charSheetAccordion:owned' : 'charSheetAccordion:other'
}

function loadAccordionState(isOwner) {
  try {
    const raw = localStorage.getItem(getAccordionStorageKey(isOwner))
    if (!raw) return { ...DEFAULT_ACCORDION_STATE }
    return { ...DEFAULT_ACCORDION_STATE, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_ACCORDION_STATE }
  }
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function CharacterSheet({ characterId, isGm, isOwner, onSaved }) {
  const { t } = useTranslation()

  // ─── État chargement ───────────────────────────────────────────────────────
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [sheetId,  setSheetId]  = useState(null)

  // ─── Accordéon ─────────────────────────────────────────────────────────────
  const [blockOpen, setBlockOpen] = useState(() => loadAccordionState(isOwner))
  useEffect(() => {
    setBlockOpen(loadAccordionState(isOwner))
  }, [isOwner, characterId])
  const toggleBlock = (id) => {
    setBlockOpen(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem(getAccordionStorageKey(isOwner), JSON.stringify(next)) } catch { /* stockage indisponible — état en mémoire seul */ }
      return next
    })
  }

  // ─── Données référence ─────────────────────────────────────────────────────
  const [genotypes,  setGenotypes]  = useState([])
  const [refSkills,  setRefSkills]  = useState([])

  // ─── Données fiche ─────────────────────────────────────────────────────────
  // identity
  const [playerName,       setPlayerName]       = useState('')
  const [charName,         setCharName]         = useState('')
  const [height,           setHeight]           = useState('')
  const [weight,           setWeight]           = useState('')
  const [skin,             setSkin]             = useState('')
  const [eyes,             setEyes]             = useState('')
  const [hair,             setHair]             = useState('')
  const [build,            setBuild]            = useState('')
  const [distinctiveSigns, setDistinctiveSigns] = useState('')
  const [handPref,         setHandPref]         = useState('R')

  // archetype
  const [genotypeId,    setGenotypeId]    = useState('HUMAIN')
  const [age,           setAge]           = useState('')
  const [sex,           setSex]           = useState('')
  const [isFertile,     setIsFertile]     = useState(false)
  const [originGeo,     setOriginGeo]     = useState('')
  const [originSoc,     setOriginSoc]     = useState('')
  const [trainingBase,  setTrainingBase]  = useState('')
  const [higherEd,      setHigherEd]      = useState('')

  // attributes — objet { FOR: { base, pc }, ... }
  const [attrs, setAttrs] = useState(() =>
    Object.fromEntries(ATTR_IDS.map(id => [id, { base: 7, pc: 0 }]))
  )
  // Ref miroir de attrs — mise à jour synchrone dans onChange et au chargement.
  const attrsRef = useRef(
    Object.fromEntries(ATTR_IDS.map(id => [id, { base: 7, pc: 0 }]))
  )
  const attrDebounceTimer = useRef(null)

  // chc
  const [chc, setChc] = useState(11)
  const chcRef = useRef(11)
  const chcDebounceTimer = useRef(null)

  // skills — lignes char_skills du personnage
  const [charSkills, setCharSkills] = useState([])

  // options de campagne — settings mergés defaults (getCampaignSettings), utilisées pour gater
  // des mécaniques optionnelles côté fiche (ex. skill_prerequisites, OPT-07)
  const [campaignSettings, setCampaignSettings] = useState(null)

  // advantages
  const [charAdvantages, setCharAdvantages] = useState([])

  // Agrégat mod_FOR..PRE des mutations actives (char_mutation_effects_view, chargé avec le sheet) —
  // null si aucune mutation active. Voir docs/PLAN_MUTATION2.md Lot 1.
  const [mutationEffects, setMutationEffects] = useState(null)

  // Lignes char_mutations actives (status='active') — source réelle des prérequis type MUTATION
  // dans SkillsPanel, distincte de l'agrégat mutationEffects. Voir docs/PLAN_MUTATION2.md Lot 5.
  const [charMutations, setCharMutations] = useState([])

  // ─── XP ────────────────────────────────────────────────────────────────────
  const [xpTotal,     setXpTotal]     = useState(0)
  const [xpAvailable, setXpAvailable] = useState(0)
  // Mode Progression — toggle activé par le joueur ou le GM
  const [progressionMode, setProgressionMode] = useState(false)
  const [woundPenalty,       setWoundPenalty]       = useState(0)
  const [encumbrancePenalty, setEncumbrancePenalty] = useState(0)
  // Debounce pour la saisie XP par le GM
  const xpDebounceTimer = useRef(null)

  // ─── Calculs dérivés ───────────────────────────────────────────────────────
  const genotypeData = useMemo(
    () => genotypes.find(g => g.id === genotypeId) || {},
    [genotypes, genotypeId]
  )

  const getModGen = useCallback(
    (attrId) => getGenotypeModForAttr(genotypeData, attrId),
    [genotypeData]
  )

  const getModMut = useCallback(
    (attrId) => getMutationModForAttr(mutationEffects, attrId),
    [mutationEffects]
  )

  const naMap = useMemo(
    () => Object.fromEntries(
      ATTR_IDS.map(id => [id, calcNA(attrs[id]?.base, attrs[id]?.pc, getModGen(id), getModMut(id))])
    ),
    [attrs, getModGen, getModMut]
  )

  const anMap = useMemo(
    () => Object.fromEntries(ATTR_IDS.map(id => [id, calcAN(naMap[id])])),
    [naMap]
  )

  const secondary = useMemo(
    () => calcSecondary(naMap, charAdvantages, mutationEffects),
    [naMap, charAdvantages, mutationEffects]
  )

  const secondaryTooltips = useMemo(
    () => buildSecondaryTooltips(naMap, charAdvantages, mutationEffects, secondary, t),
    [naMap, charAdvantages, mutationEffects, secondary, t]
  )

  const effectiveMalus = woundPenalty - encumbrancePenalty

  const iniTooltip = useMemo(() => {
    const malus = woundPenalty - encumbrancePenalty
    const ini   = secondary.rea + malus
    if (malus === 0) {
      return t('charSheet.tooltip.iniBase')
    }
    const lines = [`${t('charSheet.tooltip.reaBase')} ${secondary.rea}`]
    if (woundPenalty < 0)       lines.push(`${t('charSheet.tooltip.malusBlessures')} ${woundPenalty}`)
    if (encumbrancePenalty > 0) lines.push(`${t('charSheet.tooltip.malusEncombrement')}${encumbrancePenalty}`)
    lines.push(`${t('charSheet.tooltip.iniEffective')} ${ini}`)
    return lines.join('\n')
  }, [woundPenalty, encumbrancePenalty, secondary.rea, t])

  const iniValue = secondary.rea + effectiveMalus

  const refSkillsPolaris = useMemo(
    () => refSkills.filter(s => s.parent === 'POUVOIRS_POLARIS'),
    [refSkills]
  )

  const athletismeTotal = useMemo(() => {
    const an1     = calcAN(naMap['FOR'])
    const an2     = calcAN(naMap['COO'])
    const mastery = charSkills.find(s => s.skill_id === 'ATHLETISME')?.mastery ?? 0
    return an1 + an2 + mastery
  }, [naMap, charSkills])

  const allures = useMemo(
    () => calcAllures(naMap['COO'] || 3, athletismeTotal),
    [naMap, athletismeTotal]
  )

  // ─── Tooltip hover attribut (même pattern que SecondaryField) ────────────
  const [attrTooltip, setAttrTooltip] = useState(null)  // { description, top, left } | null

  // Cleanup timers debounce au démontage
  useEffect(() => {
    return () => {
      if (attrDebounceTimer.current) clearTimeout(attrDebounceTimer.current)
      if (chcDebounceTimer.current)  clearTimeout(chcDebounceTimer.current)
      if (xpDebounceTimer.current)   clearTimeout(xpDebounceTimer.current)
    }
  }, [])

  // ─── Chargement initial ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [refGenoRes, refSkillsRes] = await Promise.all([
          api.get('/char-ref/genotypes'),
          api.get('/char-ref/skills'),
        ])
        if (!cancelled) {
          setGenotypes(refGenoRes.data.genotypes || [])
          setRefSkills(refSkillsRes.data.skills   || [])
        }

        let sheetRes = await api.get(`/char-sheet/${characterId}`)

        if (!sheetRes.data.sheet) {
          sheetRes = await api.post(`/char-sheet/${characterId}`)
          sheetRes = await api.get(`/char-sheet/${characterId}`)
        }

        if (cancelled) return

        const { sheet, identity, archetype, attributes, skills, settings, mutationEffects } = sheetRes.data

        setSheetId(sheet.id)
        setCampaignSettings(settings ?? null)
        setMutationEffects(mutationEffects ?? null)
        setChc(sheet.chc ?? 11)
        chcRef.current = sheet.chc ?? 11

        // Charger les XP depuis sheet
        setXpTotal(sheet.xp_total ?? 0)
        setXpAvailable(sheet.xp_available ?? 0)

        if (identity) {
          setPlayerName(identity.player_name     || '')
          setCharName(identity.char_name         || '')
          setHeight(identity.height              ?? '')
          setWeight(identity.weight              ?? '')
          setSkin(identity.skin                  || '')
          setEyes(identity.eyes                  || '')
          setHair(identity.hair                  || '')
          setBuild(identity.build                || '')
          setDistinctiveSigns(identity.distinctive_signs || '')
          setHandPref(identity.hand_pref         || 'R')
        }

        if (archetype) {
          setGenotypeId(archetype.genotype_id    || 'HUMAIN')
          setAge(archetype.age                   ?? '')
          setSex(archetype.sex                   || '')
          setIsFertile(archetype.is_fertile      ?? false)
          setOriginGeo(archetype.origin_geo      || '')
          setOriginSoc(archetype.origin_soc      || '')
          setTrainingBase(archetype.training_base || '')
          setHigherEd(archetype.higher_ed        || '')
        }

        if (attributes?.length > 0) {
          const newAttrs = { ...Object.fromEntries(ATTR_IDS.map(id => [id, { base: 7, pc: 0 }])) }
          attributes.forEach(a => {
            if (newAttrs[a.attr_id] !== undefined) {
              newAttrs[a.attr_id] = { base: a.base_level, pc: a.pc_modifier }
            }
          })
          attrsRef.current = newAttrs
          setAttrs(newAttrs)
        }

        setCharSkills(skills || [])

        try {
          const advRes = await api.get(`/char-sheet/${characterId}/advantages`)
          if (!cancelled) setCharAdvantages(advRes.data.advantages || [])
        } catch (advErr) {
          console.error('Erreur chargement advantages :', advErr)
        }

        try {
          const mutRes = await api.get(`/char-sheet/${characterId}/mutations`)
          if (!cancelled) setCharMutations(mutRes.data.mutations || [])
        } catch (mutErr) {
          console.error('Erreur chargement mutations :', mutErr)
        }

        try {
          const [woundsRes, invRes] = await Promise.all([
            api.get(`/char-sheet/${characterId}/wounds`),
            api.get(`/char-sheet/${characterId}/inventory`),
          ])
          if (!cancelled) {
            setWoundPenalty(woundsRes.data.wound_penalty ?? 0)
            setEncumbrancePenalty(invRes.data.ini_penalty ?? 0)
          }
        } catch (penaltyErr) {
          console.error('Erreur fetch pénalités INI :', penaltyErr)
        }

      } catch (err) {
        if (!cancelled) setError(t('charSheet.errorLoad'))
        console.error('Erreur chargement CharacterSheet :', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [characterId])

  // ─── Sauvegarde ───────────────────────────────────────────────────────────

  const saveIdentity = useCallback(async (patch) => {
    try {
      await api.put(`/char-sheet/${characterId}/identity`, patch)
      onSaved?.()
    } catch (err) { console.error('Erreur save identity :', err) }
  }, [characterId, onSaved])

  const saveArchetype = useCallback(async (patch) => {
    try {
      await api.put(`/char-sheet/${characterId}/archetype`, patch)
      onSaved?.()
    } catch (err) { console.error('Erreur save archetype :', err) }
  }, [characterId, onSaved])

  const saveAttributes = useCallback(async (newAttrs) => {
    try {
      const payload = ATTR_IDS.map(id => ({
        attr_id:    id,
        base_level: newAttrs[id]?.base ?? 7,
        pc_modifier: newAttrs[id]?.pc  ?? 0,
      }))
      await api.put(`/char-sheet/${characterId}/attributes`, { attributes: payload })
      onSaved?.()
    } catch (err) { console.error('Erreur save attributes :', err) }
  }, [characterId, onSaved])

  const saveChc = useCallback(async (val) => {
    const clamped = Math.max(1, Math.min(20, Number(val) || 1))
    try {
      await api.put(`/char-sheet/${characterId}/chc`, { chc: clamped })
      onSaved?.()
    } catch (err) { console.error('Erreur save chc :', err) }
  }, [characterId, onSaved])

  // Sauvegarde XP disponibles — GM uniquement, debounce 500ms
  // xp_total est une valeur mémoire (XP dépensés cumulés) — jamais modifiée ici.
  const saveXp = useCallback(async (available) => {
    try {
      await api.put(`/char-sheet/${characterId}/xp`, {
        xp_available: available,
      })
      onSaved?.()
    } catch (err) { console.error('Erreur save XP :', err) }
  }, [characterId, onSaved])

  // Callback appelé par AdvantagesPanel après ajout/retrait d'une mutation (Lot D) — recharge
  // mutationEffects (endpoint léger dédié) ET charMutations (liste brute, consommée par SkillsPanel
  // pour les prérequis type MUTATION, Lot 5). Sans ça, l'un ou l'autre reste périmé tant que la
  // fenêtre n'est pas fermée/réouverte (docs/PLAN_MUTATION2.md Lot 1/5).
  const handleMutationsChanged = useCallback(async () => {
    try {
      const [effectsRes, mutRes] = await Promise.all([
        api.get(`/char-sheet/${characterId}/mutation-effects`),
        api.get(`/char-sheet/${characterId}/mutations`),
      ])
      setMutationEffects(effectsRes.data.mutationEffects ?? null)
      setCharMutations(mutRes.data.mutations || [])
    } catch (err) { console.error('Erreur rechargement mutations :', err) }
  }, [characterId])

  // Callback appelé par SkillsPanel après un achat réussi.
  // Met à jour charSkills et xpAvailable localement — pas de rechargement réseau.
  const handleSkillBought = useCallback(({ skill_id, mastery, is_learned, xp_available }) => {
    setCharSkills(prev => {
      const existing = prev.find(s => s.skill_id === skill_id)
      if (existing) {
        return prev.map(s =>
          s.skill_id === skill_id ? { ...s, mastery, is_learned } : s
        )
      }
      // Nouvelle entrée (compétence pas encore dans char_skills)
      return [...prev, { skill_id, mastery, is_learned }]
    })
    setXpAvailable(xp_available)
    onSaved?.()
  }, [onSaved])

  const handlePolarisToggled = useCallback((skill_id, is_learned) => {
    setCharSkills(prev => {
      const existing = prev.find(s => s.skill_id === skill_id)
      if (existing) {
        return prev.map(s => s.skill_id === skill_id ? { ...s, is_learned } : s)
      }
      return [...prev, { skill_id, mastery: 0, is_learned }]
    })
  }, [])

  const canEdit = isGm || isOwner

  // ─── Rendu ─────────────────────────────────────────────────────────────────

  if (loading) return <div style={s.loading}>{t('common.loading')}</div>
  if (error)   return <div style={s.error}>{error}</div>

  return (
    <div style={s.sheet}>

      {/* ══ BLOC 1 — EN-TÊTE ══════════════════════════════════════════════ */}
      <div style={s.headerBlock}>
        <div style={s.headerRow}>

          <div style={s.headerField}>
            <input
              style={s.headerInput}
              value={charName}
              onChange={e => setCharName(e.target.value)}
              onBlur={() => saveIdentity({ char_name: charName })}
              placeholder="—"
              readOnly={!canEdit}
            />
            <span style={s.headerLabel}>{t('charSheet.headerCharName')}</span>
          </div>

          <div style={s.headerField}>
            <input
              style={s.headerInput}
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              onBlur={() => saveIdentity({ player_name: playerName })}
              placeholder="—"
              readOnly={!canEdit}
            />
            <span style={s.headerLabel}>{t('charSheet.headerPlayerName')}</span>
          </div>

          <div style={s.headerField}>
            <select
              style={s.headerSelect}
              value={genotypeId}
              disabled={!canEdit}
              onChange={e => {
                setGenotypeId(e.target.value)
                saveArchetype({ genotype_id: e.target.value })
              }}
            >
              {genotypes.map(g => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>
            <span style={s.headerLabel}>{t('charSheet.headerGenotype')}</span>
          </div>

        </div>
      </div>

      {/* ══ BLOC XP — EXPÉRIENCE ══════════════════════════════════════════ */}
      <CollapsibleBlock id="xp" title={t('character.xp.title')} open={blockOpen.xp} onToggle={toggleBlock}>
        <div style={s.xpBlock}>

          {/* XP total reçus — lecture seule pour tous (valeur mémoire cumulée) */}
          <div style={s.xpField}>
            <span style={s.xpLabel}>{t('character.xp.total')}</span>
            <span style={s.xpValue}>{xpTotal}</span>
          </div>

          {/* XP disponibles — éditable GM uniquement */}
          <div style={s.xpField}>
            <span style={s.xpLabel}>{t('character.xp.available')}</span>
            {isGm ? (
              <input
                style={{ ...s.xpInput, color: xpAvailable > 0 ? '#5b8dee' : '#c0c0d0' }}
                type="number"
                min="0"
                value={xpAvailable}
                onChange={e => {
                  const val = Math.max(0, parseInt(e.target.value) || 0)
                  setXpAvailable(val)
                  if (xpDebounceTimer.current) clearTimeout(xpDebounceTimer.current)
                  xpDebounceTimer.current = setTimeout(() => saveXp(val), 500)
                }}
              />
            ) : (
              <span style={{ ...s.xpValue, color: xpAvailable > 0 ? '#5b8dee' : '#c0c0d0' }}>
                {xpAvailable}
              </span>
            )}
          </div>

          {/* Bouton toggle Mode Progression — visible par tous, cliquable owner et GM */}
          <button
            style={{
              ...s.xpBtn,
              ...(progressionMode ? s.xpBtnActive : {}),
            }}
            disabled={!canEdit}
            onClick={() => setProgressionMode(m => !m)}
          >
            {t('character.xp.progression')}
          </button>

        </div>
      </CollapsibleBlock>

      {/* ══ BLOC 2 — DESCRIPTION ══════════════════════════════════════════ */}
      <CollapsibleBlock id="description" title={t('charSheet.sectionDesc')} open={blockOpen.description} onToggle={toggleBlock}>
        <div style={s.descGrid}>

          <Field label={t('charSheet.descHeight')} style={{ gridColumn: 'span 1' }}>
            <input style={s.input} type="number" step="0.01" value={height}
              onChange={e => setHeight(e.target.value)}
              onBlur={() => saveIdentity({ height: height || null })}
              readOnly={!canEdit} />
          </Field>

          <Field label={t('charSheet.descWeight')} style={{ gridColumn: 'span 1' }}>
            <input style={s.input} type="number" step="0.1" value={weight}
              onChange={e => setWeight(e.target.value)}
              onBlur={() => saveIdentity({ weight: weight || null })}
              readOnly={!canEdit} />
          </Field>

          <Field label={t('charSheet.descSkin')} style={{ gridColumn: 'span 2' }}>
            <input style={s.input} value={skin}
              onChange={e => setSkin(e.target.value)}
              onBlur={() => saveIdentity({ skin })}
              readOnly={!canEdit} />
          </Field>

          <Field label={t('charSheet.descBuild')} style={{ gridColumn: 'span 2' }}>
            <input style={s.input} value={build}
              onChange={e => setBuild(e.target.value)}
              onBlur={() => saveIdentity({ build })}
              readOnly={!canEdit} />
          </Field>

          <Field label={t('charSheet.descEyes')} style={{ gridColumn: 'span 2' }}>
            <input style={s.input} value={eyes}
              onChange={e => setEyes(e.target.value)}
              onBlur={() => saveIdentity({ eyes })}
              readOnly={!canEdit} />
          </Field>

          <Field label={t('charSheet.descHair')} style={{ gridColumn: 'span 2' }}>
            <input style={s.input} value={hair}
              onChange={e => setHair(e.target.value)}
              onBlur={() => saveIdentity({ hair })}
              readOnly={!canEdit} />
          </Field>

          <Field label={t('charSheet.descHand')} style={{ gridColumn: 'span 2' }}>
            <select style={s.select} value={handPref} disabled={!canEdit}
              onChange={e => { setHandPref(e.target.value); saveIdentity({ hand_pref: e.target.value }) }}>
              <option value="R">{t('charSheet.handRight')}</option>
              <option value="L">{t('charSheet.handLeft')}</option>
              <option value="A">{t('charSheet.handAmbi')}</option>
            </select>
          </Field>

          <Field label={t('charSheet.descGender')} style={{ gridColumn: 'span 2' }}>
            <input style={s.input} value={sex}
              onChange={e => setSex(e.target.value)}
              onBlur={() => saveArchetype({ sex })}
              readOnly={!canEdit} />
          </Field>

          <Field label={t('charSheet.descFertility')} style={{ gridColumn: 'span 2' }}>
            <select style={s.select} value={isFertile ? 'fertile' : 'sterile'} disabled={!canEdit}
              onChange={e => {
                const val = e.target.value === 'fertile'
                setIsFertile(val)
                saveArchetype({ is_fertile: val })
              }}>
              <option value="sterile">{t('charSheet.fertileSterile')}</option>
              <option value="fertile">{t('charSheet.fertileFertile')}</option>
            </select>
          </Field>

          <Field label={t('charSheet.descAge')} style={{ gridColumn: 'span 1' }}>
            <input style={s.input} type="number" value={age}
              onChange={e => setAge(e.target.value)}
              onBlur={() => saveArchetype({ age: age || null })}
              readOnly={!canEdit} />
          </Field>

          <Field label={t('charSheet.descOriginGeo')} style={{ gridColumn: 'span 3' }}>
            <input style={s.input} value={originGeo}
              onChange={e => setOriginGeo(e.target.value)}
              onBlur={() => saveArchetype({ origin_geo: originGeo })}
              readOnly={!canEdit} />
          </Field>

          <Field label={t('charSheet.descOriginSoc')} style={{ gridColumn: 'span 3' }}>
            <input style={s.input} value={originSoc}
              onChange={e => setOriginSoc(e.target.value)}
              onBlur={() => saveArchetype({ origin_soc: originSoc })}
              readOnly={!canEdit} />
          </Field>

          <Field label={t('charSheet.descTrainingBase')} style={{ gridColumn: 'span 3' }}>
            <input style={s.input} value={trainingBase}
              onChange={e => setTrainingBase(e.target.value)}
              onBlur={() => saveArchetype({ training_base: trainingBase })}
              readOnly={!canEdit} />
          </Field>

          <Field label={t('charSheet.descHigherEd')} style={{ gridColumn: 'span 3' }}>
            <input style={s.input} value={higherEd}
              onChange={e => setHigherEd(e.target.value)}
              onBlur={() => saveArchetype({ higher_ed: higherEd })}
              readOnly={!canEdit} />
          </Field>

          <Field label={t('charSheet.descSigns')} style={{ gridColumn: 'span 6' }}>
            <input style={s.input} value={distinctiveSigns}
              onChange={e => setDistinctiveSigns(e.target.value)}
              onBlur={() => saveIdentity({ distinctive_signs: distinctiveSigns })}
              readOnly={!canEdit} />
          </Field>

        </div>
      </CollapsibleBlock>

      {/* ══ BLOC 3 — ATTRIBUTS PRIMAIRES ══════════════════════════════════ */}
      <CollapsibleBlock id="attributes" title={t('charSheet.sectionAttrs')} open={blockOpen.attributes} onToggle={toggleBlock}>
        <table style={s.attrTable}>
          <thead>
            <tr>
              <th style={s.th}></th>
              {ATTR_IDS.map(id => (
                <th
                  key={id}
                  style={{ ...s.th, cursor: 'help' }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    setAttrTooltip({ description: ATTR_DESCRIPTIONS[id], top: rect.top, left: rect.left + rect.width / 2 })
                  }}
                  onMouseLeave={() => setAttrTooltip(null)}
                >
                  {t(`charSheet.attr.${id}`)}
                </th>
              ))}
              <th
                style={{ ...s.th, borderLeft: '2px solid #2a2a3e', cursor: 'help' }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setAttrTooltip({ description: ATTR_DESCRIPTIONS.CHC, top: rect.top, left: rect.left + rect.width / 2 })
                }}
                onMouseLeave={() => setAttrTooltip(null)}
              >
                {t('charSheet.attrChance')}
              </th>
            </tr>
          </thead>
          <tbody>

            {/* Niveau de base */}
            <tr>
              <td style={s.tdLabel}>{t('charSheet.attrRowBase')}</td>
              {ATTR_IDS.map(id => (
                <td key={id} style={s.td}>
                  <input
                    style={s.attrInput}
                    type="number"
                    min="1"
                    value={attrs[id]?.base ?? 7}
                    readOnly={!canEdit}
                    onChange={e => {
                      const val = parseInt(e.target.value) || 1
                      const next = { ...attrsRef.current, [id]: { ...attrsRef.current[id], base: val } }
                      attrsRef.current = next
                      setAttrs(next)
                      if (attrDebounceTimer.current) clearTimeout(attrDebounceTimer.current)
                      attrDebounceTimer.current = setTimeout(() => saveAttributes(attrsRef.current), 500)
                    }}
                  />
                </td>
              ))}
              <td style={{ ...s.td, borderLeft: '2px solid #2a2a3e' }} rowSpan={5}>
                <div style={s.chcCell}>
                  <input
                    style={{ ...s.attrInput, width: '48px' }}
                    type="number"
                    min="1"
                    max="20"
                    value={chc}
                    readOnly={!canEdit}
                    onChange={e => {
                      const val = parseInt(e.target.value) || 1
                      chcRef.current = val
                      setChc(val)
                      if (chcDebounceTimer.current) clearTimeout(chcDebounceTimer.current)
                      chcDebounceTimer.current = setTimeout(() => saveChc(chcRef.current), 500)
                    }}
                  />
                </div>
              </td>
            </tr>

            {/* Modif. Type Génétique */}
            <tr>
              <td style={s.tdLabel}>{t('charSheet.attrRowModGen')}</td>
              {ATTR_IDS.map(id => (
                <td key={id} style={s.td}>
                  <span style={s.attrReadonly}>{getModGen(id) >= 0 ? `+${getModGen(id)}` : getModGen(id)}</span>
                </td>
              ))}
            </tr>

            {/* Modif. PC */}
            <tr>
              <td style={s.tdLabel}>{t('charSheet.attrRowModPc')}</td>
              {ATTR_IDS.map(id => (
                <td key={id} style={s.td}>
                  <input
                    style={s.attrInput}
                    type="number"
                    value={attrs[id]?.pc ?? 0}
                    readOnly={!canEdit}
                    onChange={e => {
                      const val = parseInt(e.target.value) || 0
                      const next = { ...attrsRef.current, [id]: { ...attrsRef.current[id], pc: val } }
                      attrsRef.current = next
                      setAttrs(next)
                      if (attrDebounceTimer.current) clearTimeout(attrDebounceTimer.current)
                      attrDebounceTimer.current = setTimeout(() => saveAttributes(attrsRef.current), 500)
                    }}
                  />
                </td>
              ))}
            </tr>

            {/* Niveau actuel */}
            <tr style={{ backgroundColor: 'rgba(91,141,238,0.08)' }}>
              <td style={s.tdLabel}>{t('charSheet.attrRowCurrent')}</td>
              {ATTR_IDS.map(id => (
                <td key={id} style={s.td}>
                  <span style={{ ...s.attrReadonly, color: '#5b8dee', fontWeight: '700' }}>
                    {naMap[id]}
                  </span>
                </td>
              ))}
            </tr>

            {/* Aptitude Naturelle */}
            <tr style={{ backgroundColor: 'rgba(91,141,238,0.04)' }}>
              <td style={s.tdLabel}>{t('charSheet.attrRowAN')}</td>
              {ATTR_IDS.map(id => (
                <td key={id} style={s.td}>
                  <span style={{ ...s.attrReadonly, color: '#9090c8' }}>
                    {calcAN(naMap[id]) >= 0 ? `+${calcAN(naMap[id])}` : calcAN(naMap[id])}
                  </span>
                </td>
              ))}
            </tr>

          </tbody>
        </table>
      </CollapsibleBlock>

      {/* ══ BLOC 4 — ATTRIBUTS SECONDAIRES ═══════════════════════════════ */}
      <CollapsibleBlock id="secondary" title={t('charSheet.sectionSecondary')} open={blockOpen.secondary} onToggle={toggleBlock}>

        <div style={s.secondaryCards}>
          <SecondaryField label={t('charSheet.secondary.reaction')} value={secondary.rea} tooltip={secondaryTooltips.reaction} />
          <SecondaryField
            label={t('charSheet.secondary.initiative')}
            value={iniValue}
            tooltip={iniTooltip}
            valueStyle={effectiveMalus < 0 ? { color: '#e05c5c' } : undefined}
          />
          <SecondaryField separator label={t('charSheet.secondary.allureLente')}   value={`${allures.lente} m/t`}   tooltip={t('charSheet.tooltip.allureLente')} />
          <SecondaryField label={t('charSheet.secondary.allureMoyenne')} value={`${allures.moyenne} m/t`} tooltip={t('charSheet.tooltip.allureMoyenne')} />
          <SecondaryField label={t('charSheet.secondary.allureRapide')}  value={`${allures.rapide} m/t`}  tooltip={t('charSheet.tooltip.allureRapide')} />
          <SecondaryField label={t('charSheet.secondary.allureMax')}     value={`${allures.max} m/t`}     tooltip={t('charSheet.tooltip.allureMax')} />
        </div>

        <div style={s.secondaryColumns}>
          <div style={s.secondaryList}>
            <SecondaryListRow headerOnly label={t('charSheet.secondary.choc')} />
            <SecondaryListRow sub label={t('charSheet.secondary.seuilEtour')}  value={secondary.seuilEtour}  tooltip={secondaryTooltips.seuilEtour} />
            <SecondaryListRow sub label={t('charSheet.secondary.seuilIncons')} value={secondary.seuilIncons} tooltip={secondaryTooltips.seuilIncons} />
            <SecondaryListRow
              label={t('charSheet.secondary.modDom')}
              value={secondary.modDom >= 0 ? `+${secondary.modDom}` : secondary.modDom}
              tooltip={t('charSheet.tooltip.modDom')}
            />
            <SecondaryListRow
              label={t('charSheet.secondary.resistanceDommages')}
              value={secondary.resistanceDommages >= 0 ? `+${secondary.resistanceDommages}` : secondary.resistanceDommages}
              tooltip={secondaryTooltips.resistanceDommages}
            />
          </div>

          <div style={s.secondaryList}>
            <SecondaryListRow headerOnly label={t('charSheet.secondary.resistancesNaturelles')} />
            <SecondaryListRow
              sub label={t('charSheet.secondary.resistancePoison')}
              value={secondary.resistancePoison >= 0 ? `+${secondary.resistancePoison}` : secondary.resistancePoison}
              tooltip={secondaryTooltips.resistancePoison}
            />
            <SecondaryListRow
              sub label={t('charSheet.secondary.resistanceMaladie')}
              value={secondary.resistanceMaladie >= 0 ? `+${secondary.resistanceMaladie}` : secondary.resistanceMaladie}
              tooltip={secondaryTooltips.resistanceMaladie}
            />
            <SecondaryListRow
              sub label={t('charSheet.secondary.resistanceRadiation')}
              value={secondary.resistanceRadiation >= 0 ? `+${secondary.resistanceRadiation}` : secondary.resistanceRadiation}
              tooltip={secondaryTooltips.resistanceRadiation}
            />
            <SecondaryListRow
              sub label={t('charSheet.secondary.resistanceDrogues')}
              value={secondary.resistanceDrogues >= 0 ? `+${secondary.resistanceDrogues}` : secondary.resistanceDrogues}
              tooltip={secondaryTooltips.resistanceDrogues}
            />
            <SecondaryListRow
              label={t('charSheet.secondary.souffle')}
              value={secondary.souffle}
              tooltip={secondaryTooltips.souffle}
            />
          </div>
        </div>
      </CollapsibleBlock>

      {/* ══ BLOC 5 — COMPÉTENCES ══════════════════════════════════════════ */}
      <CollapsibleBlock id="skills" title={t('charSheet.sectionSkills')} open={blockOpen.skills} onToggle={toggleBlock}>
        <div style={{ padding: '8px' }}>
          <SkillsPanel
            refSkills={refSkills}
            charSkills={charSkills}
            charAdvantages={charAdvantages}
            charMutations={charMutations}
            anMap={anMap}
            characterId={characterId}
            isGm={isGm}
            canEdit={canEdit}
            genotypeId={genotypeId}
            onSaved={onSaved}
            progressionMode={progressionMode}
            xpAvailable={xpAvailable}
            onSkillBought={handleSkillBought}
            skillPrerequisitesEnabled={campaignSettings?.skill_prerequisites === true}
          />
        </div>
      </CollapsibleBlock>

      {/* ══ BLOC 6 — AVANTAGES & DÉSAVANTAGES ════════════════════════════ */}
      <CollapsibleBlock id="advantages" title={t('charSheet.sectionAdvantages')} open={blockOpen.advantages} onToggle={toggleBlock}>
        <AdvantagesPanel
          characterId={characterId}
          charAdvantages={charAdvantages}
          onAdvantagesChange={setCharAdvantages}
          canEdit={canEdit}
          isGm={isGm}
          onSaved={onSaved}
          onMutationsChanged={handleMutationsChanged}
          charSkills={charSkills}
          refSkillsPolaris={refSkillsPolaris}
          onSkillLearnedChange={handlePolarisToggled}
        />
      </CollapsibleBlock>

      {/* ─── Tooltip hover attribut ───────────────────────────────────────── */}
      {attrTooltip && (
        <div style={{
          ...s.tooltip,
          top: attrTooltip.top,
          left: attrTooltip.left,
          transform: 'translate(-50%, calc(-100% - 8px))',
        }}>
          {attrTooltip.description}
        </div>
      )}

    </div>
  )
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function Field({ label, children, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', ...style }}>
      {children}
      <span style={s.fieldLabel}>{label}</span>
    </div>
  )
}

// Bloc repliable (accordéon) — en-tête cliquable + chevron, contenu masqué si fermé.
// `open`/`onToggle` viennent de l'état `blockOpen` du composant principal (mémorisé par type de
// fiche, owned/autres — voir loadAccordionState).
function CollapsibleBlock({ id, title, open, onToggle, children }) {
  return (
    <div style={s.block}>
      <div style={s.blockHeadRow} onClick={() => onToggle(id)}>
        <span style={s.blockTitle}>{title}</span>
        <span style={{ ...s.blockChevron, transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
      </div>
      {open && children}
    </div>
  )
}

// Position/affichage de tooltip partagés par SecondaryField (cartes) et SecondaryListRow (liste).
function useSecondaryTooltip(tooltip) {
  const ref = useRef(null)
  const [tipPos, setTipPos] = useState(null)
  const handleMouseEnter = () => {
    if (!tooltip || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setTipPos({ top: rect.top, left: rect.left + rect.width / 2 })
  }
  return { ref, tipPos, handleMouseEnter, handleMouseLeave: () => setTipPos(null) }
}

function SecondaryTooltip({ tipPos, tooltip }) {
  if (!tipPos) return null
  return (
    <div style={{
      ...s.tooltip,
      top: tipPos.top,
      left: tipPos.left,
      transform: 'translate(-50%, calc(-100% - 8px))',
    }}>
      {tooltip}
    </div>
  )
}

// `separator` = trait discret à gauche de la carte, pour marquer un sous-groupe (ex. Allures) dans
// une même rangée sans casser la mise en page si le flex-wrap renvoie la carte à la ligne.
function SecondaryField({ label, value, tooltip, valueStyle, separator }) {
  const { ref, tipPos, handleMouseEnter, handleMouseLeave } = useSecondaryTooltip(tooltip)
  return (
    <div
      ref={ref}
      style={{ ...s.secondaryItem, ...(separator ? s.secondaryItemSeparator : null), cursor: tooltip ? 'help' : 'default' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span style={{ ...s.secondaryValue, ...valueStyle }}>{value}</span>
      <span style={s.secondaryLabel}>{label}</span>
      <SecondaryTooltip tipPos={tipPos} tooltip={tooltip} />
    </div>
  )
}

// Ligne de la liste dense (Choc/Résistances/Souffle) — `headerOnly` = ligne de catégorie sans valeur,
// `sub` = sous-valeur indentée (ex. Seuil d'étourdissement sous "Choc").
function SecondaryListRow({ label, value, tooltip, sub, headerOnly, valueStyle }) {
  const { ref, tipPos, handleMouseEnter, handleMouseLeave } = useSecondaryTooltip(tooltip)
  const nameStyle = headerOnly ? s.listNameHeader : sub ? s.listNameSub : s.listName
  return (
    <div
      ref={ref}
      style={{
        ...s.listRow,
        ...(sub ? s.listRowSub : null),
        ...(headerOnly ? s.listRowHeader : null),
        cursor: tooltip ? 'help' : 'default',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span style={nameStyle}>{sub ? '— ' : ''}{label}</span>
      {!headerOnly && <span style={{ ...s.listValue, ...valueStyle }}>{value}</span>}
      <SecondaryTooltip tipPos={tipPos} tooltip={tooltip} />
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  sheet: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    paddingBottom: '16px',
  },
  loading: {
    color: '#5a5a7a',
    fontSize: '12px',
    textAlign: 'center',
    padding: '32px',
  },
  error: {
    color: '#e05c5c',
    fontSize: '12px',
    textAlign: 'center',
    padding: '32px',
  },

  // Blocs
  block: {
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  blockHeadRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 10px',
    backgroundColor: '#0e0e1a',
    borderBottom: '1px solid #1e1e2e',
    cursor: 'pointer',
  },
  blockTitle: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#5b8dee',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  blockChevron: {
    fontSize: '9px',
    color: '#6a6a88',
    transition: 'transform 0.15s ease',
  },
  secondaryColumns: {
    display: 'flex',
    gap: '8px',
    margin: '0 10px 8px',
  },

  // Bloc en-tête
  headerBlock: {
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
    padding: '10px 12px',
    backgroundColor: '#0e0e1a',
  },
  headerRow: {
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-end',
  },
  headerField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    flex: 1,
  },
  headerInput: {
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid #3a3a5e',
    color: '#c0c0d0',
    fontSize: '14px',
    fontWeight: '600',
    padding: '2px 0',
    outline: 'none',
    width: '100%',
  },
  headerSelect: {
    background: '#0e0e1a',
    border: 'none',
    borderBottom: '1px solid #3a3a5e',
    color: '#c0c0d0',
    fontSize: '13px',
    padding: '2px 0',
    outline: 'none',
    cursor: 'pointer',
    width: '100%',
  },
  headerLabel: {
    fontSize: '9px',
    color: '#3a3a5e',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },

  // Bloc XP
  xpBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '8px 12px',
    flexWrap: 'wrap',
  },
  xpField: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  xpLabel: {
    fontSize: '10px',
    color: '#5a5a7a',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    whiteSpace: 'nowrap',
  },
  xpValue: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#c0c0d0',
    minWidth: '32px',
    textAlign: 'center',
  },
  xpInput: {
    width: '56px',
    background: '#0e0e1a',
    border: '1px solid #2a2a3e',
    borderRadius: '3px',
    color: '#c0c0d0',
    fontSize: '13px',
    fontWeight: '600',
    textAlign: 'center',
    padding: '2px 4px',
    outline: 'none',
  },
  xpBtn: {
    marginLeft: 'auto',
    padding: '4px 12px',
    border: '1px solid #2a2a3e',
    borderRadius: '4px',
    background: '#0e0e1a',
    color: '#5a5a7a',
    fontSize: '11px',
    fontWeight: '700',
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    transition: 'all 0.1s ease',
  },
  xpBtnActive: {
    borderColor: '#5b8dee',
    color: '#5b8dee',
    background: 'rgba(91,141,238,0.10)',
  },

  // Grille description
  descGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '6px 10px',
    padding: '10px 12px',
  },
  fieldLabel: {
    fontSize: '9px',
    color: '#3a3a5e',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  input: {
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid #2a2a3e',
    color: '#b0b0c8',
    fontSize: '12px',
    padding: '2px 0',
    outline: 'none',
    width: '100%',
  },
  select: {
    background: '#0e0e1a',
    border: '1px solid #2a2a3e',
    borderRadius: '4px',
    color: '#b0b0c8',
    fontSize: '12px',
    padding: '2px 4px',
    outline: 'none',
    cursor: 'pointer',
    width: '100%',
  },

  // Tableau attributs
  attrTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '11px',
  },
  th: {
    padding: '5px 4px',
    color: '#5a5a7a',
    fontSize: '10px',
    fontWeight: '600',
    textAlign: 'center',
    borderBottom: '1px solid #1e1e2e',
    backgroundColor: '#0e0e1a',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '70px',
  },
  td: {
    padding: '3px 2px',
    textAlign: 'center',
    borderBottom: '1px solid #1a1a2e',
  },
  tdLabel: {
    padding: '4px 10px',
    color: '#6a6a8a',
    fontSize: '11px',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid #1a1a2e',
    borderRight: '1px solid #1e1e2e',
  },
  attrInput: {
    width: '44px',
    background: '#0e0e1a',
    border: '1px solid #2a2a3e',
    borderRadius: '3px',
    color: '#c0c0d0',
    fontSize: '12px',
    fontWeight: '600',
    textAlign: 'center',
    padding: '2px',
    outline: 'none',
  },
  attrReadonly: {
    display: 'inline-block',
    minWidth: '28px',
    color: '#8888a8',
    fontSize: '12px',
    fontWeight: '600',
    textAlign: 'center',
  },
  chcCell: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '4px',
    padding: '4px',
  },

  // Attributs secondaires — cartes (Réaction/Initiative, Allures)
  secondaryCards: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    padding: '8px 10px',
  },
  // Attributs secondaires — liste dense (Choc, Dommages, Résistances naturelles, Souffle)
  secondaryList: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    background: '#1c1c38',
    border: '1px solid #1c1c38',
    borderRadius: '5px',
    overflow: 'hidden',
  },
  listRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 10px',
    gap: '12px',
    background: '#0e0e1a',
  },
  listRowSub: {
    paddingLeft: '22px',
    background: '#14152a',
  },
  listRowHeader: {
    background: '#14152a',
    paddingTop: '5px',
    paddingBottom: '5px',
  },
  listName: {
    fontSize: '11.5px',
    color: '#c8c8e0',
    fontWeight: '600',
  },
  listNameSub: {
    fontSize: '11px',
    color: '#9494b8',
    fontWeight: '400',
  },
  listNameHeader: {
    fontSize: '9.5px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#6a6a88',
    fontWeight: '700',
  },
  listValue: {
    fontSize: '13.5px',
    fontWeight: '700',
    color: '#5b8dee',
    minWidth: '22px',
    textAlign: 'right',
  },
  secondaryItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    padding: '6px 12px',
    background: '#0e0e1a',
    borderRadius: '4px',
    minWidth: '80px',
  },
  secondaryItemSeparator: {
    marginLeft: '8px',
    paddingLeft: '18px',
    borderLeft: '1px solid #2a2a4e',
  },
  secondaryValue: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#5b8dee',
  },
  secondaryLabel: {
    fontSize: '9px',
    color: '#4a4a60',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    textAlign: 'center',
  },
  tooltip: {
    position: 'fixed',
    backgroundColor: '#0a0a14',
    border: '1px solid #2a2a4e',
    borderRadius: '4px',
    padding: '8px 10px',
    fontSize: '10px',
    color: '#b0b0c8',
    whiteSpace: 'pre-line',
    width: '240px',
    zIndex: 1000,
    lineHeight: '1.6',
    pointerEvents: 'none',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
  },

}
