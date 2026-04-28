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
 *   REA = floor((ADA_na + PER_na) / 2 + 0.4)   — arrondi Polaris 0.5→bas
 *   Seuil_Étour = floor((FOR_na + CON_na + VOL_na) / 3 + 0.4)
 *   Seuil_Incons = Seuil_Étour + 10
 *   Marche = floor((FOR_na + COO_na + ADA_na) / 3 + 0.4)
 *   Course = Marche × 2
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

// ─── Constantes métier ────────────────────────────────────────────────────────

const ATTR_IDS = ['FOR', 'CON', 'COO', 'ADA', 'PER', 'INT', 'VOL', 'PRE']

const ATTR_LABELS = {
  FOR: 'Force', CON: 'Constitution', COO: 'Coordination',
  ADA: 'Adaptation', PER: 'Perception', INT: 'Intelligence',
  VOL: 'Volonté', PRE: 'Présence',
}

// Table de correspondance na → AN (source : FichePerso_v4)
const AN_TABLE = [
  { min: 3,  max: 3,  an: -4 },
  { min: 4,  max: 4,  an: -3 },
  { min: 5,  max: 5,  an: -2 },
  { min: 6,  max: 7,  an: -1 },
  { min: 8,  max: 9,  an:  0 },
  { min: 10, max: 12, an:  1 },
  { min: 13, max: 15, an:  2 },
  { min: 16, max: 18, an:  3 },
  { min: 19, max: 21, an:  4 },
  { min: 22, max: 24, an:  5 },
  { min: 25, max: Infinity, an: 6 },
]

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

// Arrondi Polaris : 0.5 → bas (ex: 16.5 → 16)
const polarisRound = (x) => Math.floor(x + 0.4)

const calcNA = (base, pc, modGen) => Math.max(3, (base || 0) + (pc || 0) + (modGen || 0))

const calcAN = (na) => {
  const entry = AN_TABLE.find(e => na >= e.min && na <= e.max)
  return entry ? entry.an : -4
}

const calcModDom = (forNA) => {
  if (forNA > 21) return 5 + Math.floor((forNA - 21) / 2)
  const entry = MOD_DOM_TABLE.find(e => forNA >= e.min && forNA <= e.max)
  return entry ? entry.val : -6
}

const calcSecondary = (naMap) => {
  const FOR = naMap['FOR'] || 3
  const CON = naMap['CON'] || 3
  const COO = naMap['COO'] || 3
  const ADA = naMap['ADA'] || 3
  const PER = naMap['PER'] || 3
  const VOL = naMap['VOL'] || 3

  const rea           = polarisRound((ADA + PER) / 2)
  const initiative    = rea
  const seuilEtour    = polarisRound((FOR + CON + VOL) / 3)
  const seuilIncons   = seuilEtour + 10
  const vitesseMarche = polarisRound((FOR + COO + ADA) / 3)
  const vitesseCourse = vitesseMarche * 2
  const modDom        = calcModDom(FOR)

  return { rea, initiative, seuilEtour, seuilIncons, vitesseMarche, vitesseCourse, modDom }
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function CharacterSheet({ characterId, isGm, isOwner, onSaved }) {
  const { t } = useTranslation()

  // ─── État chargement ───────────────────────────────────────────────────────
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [sheetId,  setSheetId]  = useState(null)

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

  // advantages
  const [charAdvantages, setCharAdvantages] = useState([])

  // ─── XP ────────────────────────────────────────────────────────────────────
  const [xpTotal,     setXpTotal]     = useState(0)
  const [xpAvailable, setXpAvailable] = useState(0)
  // Mode Progression — toggle activé par le joueur ou le GM
  const [progressionMode, setProgressionMode] = useState(false)
  // Debounce pour la saisie XP par le GM
  const xpDebounceTimer = useRef(null)

  // ─── Calculs dérivés ───────────────────────────────────────────────────────
  const genotypeData = useMemo(
    () => genotypes.find(g => g.id === genotypeId) || {},
    [genotypes, genotypeId]
  )

  const getModGen = useCallback(
    (attrId) => genotypeData[`mod_${attrId.toLowerCase()}`] || 0,
    [genotypeData]
  )

  const naMap = useMemo(
    () => Object.fromEntries(
      ATTR_IDS.map(id => [id, calcNA(attrs[id]?.base, attrs[id]?.pc, getModGen(id))])
    ),
    [attrs, getModGen]
  )

  const anMap = useMemo(
    () => Object.fromEntries(ATTR_IDS.map(id => [id, calcAN(naMap[id])])),
    [naMap]
  )

  const secondary = useMemo(() => calcSecondary(naMap), [naMap])

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

        const { sheet, identity, archetype, attributes, skills } = sheetRes.data

        setSheetId(sheet.id)
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

      } catch (err) {
        if (!cancelled) setError('Impossible de charger la fiche')
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
            <span style={s.headerLabel}>Nom du Personnage</span>
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
            <span style={s.headerLabel}>Nom du Joueur</span>
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
            <span style={s.headerLabel}>Type Génétique</span>
          </div>

        </div>
      </div>

      {/* ══ BLOC XP — EXPÉRIENCE ══════════════════════════════════════════ */}
      <div style={s.block}>
        <div style={s.blockTitle}>{t('character.xp.title')}</div>
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
      </div>

      {/* ══ BLOC 2 — DESCRIPTION ══════════════════════════════════════════ */}
      <div style={s.block}>
        <div style={s.blockTitle}>Description du Personnage</div>
        <div style={s.descGrid}>

          <Field label="Taille (m)" style={{ gridColumn: 'span 1' }}>
            <input style={s.input} type="number" step="0.01" value={height}
              onChange={e => setHeight(e.target.value)}
              onBlur={() => saveIdentity({ height: height || null })}
              readOnly={!canEdit} />
          </Field>

          <Field label="Poids (kg)" style={{ gridColumn: 'span 1' }}>
            <input style={s.input} type="number" step="0.1" value={weight}
              onChange={e => setWeight(e.target.value)}
              onBlur={() => saveIdentity({ weight: weight || null })}
              readOnly={!canEdit} />
          </Field>

          <Field label="Peau" style={{ gridColumn: 'span 2' }}>
            <input style={s.input} value={skin}
              onChange={e => setSkin(e.target.value)}
              onBlur={() => saveIdentity({ skin })}
              readOnly={!canEdit} />
          </Field>

          <Field label="Corpulence" style={{ gridColumn: 'span 2' }}>
            <input style={s.input} value={build}
              onChange={e => setBuild(e.target.value)}
              onBlur={() => saveIdentity({ build })}
              readOnly={!canEdit} />
          </Field>

          <Field label="Yeux" style={{ gridColumn: 'span 2' }}>
            <input style={s.input} value={eyes}
              onChange={e => setEyes(e.target.value)}
              onBlur={() => saveIdentity({ eyes })}
              readOnly={!canEdit} />
          </Field>

          <Field label="Cheveux" style={{ gridColumn: 'span 2' }}>
            <input style={s.input} value={hair}
              onChange={e => setHair(e.target.value)}
              onBlur={() => saveIdentity({ hair })}
              readOnly={!canEdit} />
          </Field>

          <Field label="Main directrice" style={{ gridColumn: 'span 2' }}>
            <select style={s.select} value={handPref} disabled={!canEdit}
              onChange={e => { setHandPref(e.target.value); saveIdentity({ hand_pref: e.target.value }) }}>
              <option value="R">Droitier</option>
              <option value="L">Gaucher</option>
              <option value="A">Ambidextre</option>
            </select>
          </Field>

          <Field label="Genre" style={{ gridColumn: 'span 2' }}>
            <input style={s.input} value={sex}
              onChange={e => setSex(e.target.value)}
              onBlur={() => saveArchetype({ sex })}
              readOnly={!canEdit} />
          </Field>

          <Field label="Fécondité" style={{ gridColumn: 'span 2' }}>
            <select style={s.select} value={isFertile ? 'fertile' : 'sterile'} disabled={!canEdit}
              onChange={e => {
                const val = e.target.value === 'fertile'
                setIsFertile(val)
                saveArchetype({ is_fertile: val })
              }}>
              <option value="sterile">Stérile</option>
              <option value="fertile">Fécond(e)</option>
            </select>
          </Field>

          <Field label="Âge" style={{ gridColumn: 'span 1' }}>
            <input style={s.input} type="number" value={age}
              onChange={e => setAge(e.target.value)}
              onBlur={() => saveArchetype({ age: age || null })}
              readOnly={!canEdit} />
          </Field>

          <Field label="Origine géographique" style={{ gridColumn: 'span 3' }}>
            <input style={s.input} value={originGeo}
              onChange={e => setOriginGeo(e.target.value)}
              onBlur={() => saveArchetype({ origin_geo: originGeo })}
              readOnly={!canEdit} />
          </Field>

          <Field label="Origine sociale" style={{ gridColumn: 'span 3' }}>
            <input style={s.input} value={originSoc}
              onChange={e => setOriginSoc(e.target.value)}
              onBlur={() => saveArchetype({ origin_soc: originSoc })}
              readOnly={!canEdit} />
          </Field>

          <Field label="Formation de base" style={{ gridColumn: 'span 3' }}>
            <input style={s.input} value={trainingBase}
              onChange={e => setTrainingBase(e.target.value)}
              onBlur={() => saveArchetype({ training_base: trainingBase })}
              readOnly={!canEdit} />
          </Field>

          <Field label="Études supérieures" style={{ gridColumn: 'span 3' }}>
            <input style={s.input} value={higherEd}
              onChange={e => setHigherEd(e.target.value)}
              onBlur={() => saveArchetype({ higher_ed: higherEd })}
              readOnly={!canEdit} />
          </Field>

          <Field label="Signes particuliers" style={{ gridColumn: 'span 6' }}>
            <input style={s.input} value={distinctiveSigns}
              onChange={e => setDistinctiveSigns(e.target.value)}
              onBlur={() => saveIdentity({ distinctive_signs: distinctiveSigns })}
              readOnly={!canEdit} />
          </Field>

        </div>
      </div>

      {/* ══ BLOC 3 — ATTRIBUTS PRIMAIRES ══════════════════════════════════ */}
      <div style={s.block}>
        <div style={s.blockTitle}>Attributs</div>
        <table style={s.attrTable}>
          <thead>
            <tr>
              <th style={s.th}></th>
              {ATTR_IDS.map(id => (
                <th key={id} style={s.th}>{ATTR_LABELS[id]}</th>
              ))}
              <th style={{ ...s.th, borderLeft: '2px solid #2a2a3e' }}>Chance</th>
            </tr>
          </thead>
          <tbody>

            {/* Niveau de base */}
            <tr>
              <td style={s.tdLabel}>Niveau de base</td>
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
              <td style={s.tdLabel}>Modif. Type Gén.</td>
              {ATTR_IDS.map(id => (
                <td key={id} style={s.td}>
                  <span style={s.attrReadonly}>{getModGen(id) >= 0 ? `+${getModGen(id)}` : getModGen(id)}</span>
                </td>
              ))}
            </tr>

            {/* Modif. PC */}
            <tr>
              <td style={s.tdLabel}>Modif. PC</td>
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
              <td style={s.tdLabel}>Niveau actuel</td>
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
              <td style={s.tdLabel}>Aptitude Naturelle</td>
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
      </div>

      {/* ══ BLOC 4 — ATTRIBUTS SECONDAIRES ═══════════════════════════════ */}
      <div style={s.block}>
        <div style={s.blockTitle}>Attributs Secondaires</div>
        <div style={s.secondaryGrid}>
          <SecondaryField label="Réaction"             value={secondary.rea} />
          <SecondaryField label="Initiative"           value={secondary.initiative} />
          <SecondaryField label="Seuil Étourdissement" value={secondary.seuilEtour} />
          <SecondaryField label="Seuil Inconscience"   value={secondary.seuilIncons} />
          <SecondaryField label="Vitesse (marche)"     value={`${secondary.vitesseMarche} m/t`} />
          <SecondaryField label="Vitesse (course)"     value={`${secondary.vitesseCourse} m/t`} />
          <SecondaryField
            label="Mod. Dommages (contact)"
            value={secondary.modDom >= 0 ? `+${secondary.modDom}` : secondary.modDom}
          />
        </div>
      </div>

      {/* ══ BLOC 5 — COMPÉTENCES ══════════════════════════════════════════ */}
      <div style={s.block}>
        <div style={s.blockTitle}>Compétences</div>
        <div style={{ padding: '8px' }}>
          <SkillsPanel
            refSkills={refSkills}
            charSkills={charSkills}
            charAdvantages={charAdvantages}
            anMap={anMap}
            characterId={characterId}
            isGm={isGm}
            canEdit={canEdit}
            genotypeId={genotypeId}
            onSaved={onSaved}
            progressionMode={progressionMode}
            xpAvailable={xpAvailable}
            onSkillBought={handleSkillBought}
          />
        </div>
      </div>

      {/* ══ BLOC 6 — AVANTAGES & DÉSAVANTAGES ════════════════════════════ */}
      <div style={s.block}>
        <div style={s.blockTitle}>Avantages &amp; Désavantages</div>
        <AdvantagesPanel
          characterId={characterId}
          charAdvantages={charAdvantages}
          onAdvantagesChange={setCharAdvantages}
          canEdit={canEdit}
          onSaved={onSaved}
        />
      </div>

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

function SecondaryField({ label, value }) {
  return (
    <div style={s.secondaryItem}>
      <span style={s.secondaryValue}>{value}</span>
      <span style={s.secondaryLabel}>{label}</span>
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
  blockTitle: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#5b8dee',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    padding: '6px 10px',
    backgroundColor: '#0e0e1a',
    borderBottom: '1px solid #1e1e2e',
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

  // Attributs secondaires
  secondaryGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1px',
    padding: '8px 10px',
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
}
