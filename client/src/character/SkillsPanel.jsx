/**
 * SkillsPanel.jsx — Module 5 : Compétences Polaris
 *
 * Monté dans CharacterSheet.jsx en Bloc 5, après les attributs secondaires.
 *
 * Props :
 *   refSkills      — catalogue complet (ref_skills + requirements imbriqués)
 *   charSkills     — lignes char_skills du personnage (peut être vide)
 *   charAdvantages — lignes char_advantages du personnage (avantages actifs)
 *   charMutations  — lignes char_mutations du personnage (mutations actives, status='active') —
 *                     source réelle des prérequis type MUTATION (docs/PLAN_MUTATION2.md Lot 5)
 *   anMap          — { FOR: 2, CON: 1, ... } — AN précalculés depuis CharacterSheet
 *   characterId    — UUID du character Enclume
 *   canEdit        — booléen (isGm || isOwner)
 *   genotypeId     — ID du génotype du personnage (pour prérequis GENOTYPE)
 *   onSaved        — callback après sauvegarde réussie
 *   progressionMode — booléen — active le mode achat XP
 *   xpAvailable    — entier — XP disponibles (affiché + guard bouton +)
 *   onSkillBought  — callback({ skill_id, mastery, is_learned, xp_available })
 *                    appelé après achat réussi — mise à jour locale dans CharacterSheet
 *   skillPrerequisitesEnabled — booléen — option de campagne OPT-07 (settings.skill_prerequisites,
 *                    défaut true depuis WIZ9 — une campagne créée avant ce correctif peut encore
 *                    avoir false explicitement enregistré). Si !== true, le verrouillage SKILL_MIN
 *                    est ignoré (MUTATION/ADVANTAGE/GENOTYPE restent toujours actifs, non concernés
 *                    par cette option, y compris au bout d'une chaîne SKILL_MIN).
 *
 * Règles de calcul :
 *   Base  = AN(attr_1) + AN(attr_2)   — si attr_2 null : AN(attr_1) × 2 (PC4)
 *           marker='(-3)' : Base -3 (REGLECOMPETENCE.md:10-13, Q4 PLAN_XP.md close)
 *   Total = Base + mastery             — jamais clampé, peut être négatif (PC11)
 *
 * Algorithme de disponibilité (ordre strict, source CHARACTER.md — revu CHARSHEET-ADVANTAGE-SKILL-GATE
 * 2026-10-04, retour Saar) : masquer pour un verrou d'identité, jamais pour un simple niveau de
 * compétence atteignable — voir shared/skillRequirements.js pour le détail de chaque fonction citée.
 *   1. MUTATION/ADVANTAGE/GENOTYPE manquant AU BOUT de la chaîne de prérequis (directement, ou via
 *      une ligne SKILL_MIN qui mène à un verrou d'identité — ex. Pouvoirs Polaris → Maîtrise de la
 *      Force Polaris → Avantage Force Polaris ; isBlockedByIdentityChain) → masquée, quel que soit
 *      le mode. Un enfant de catégorie sans prérequis propre hérite de celui de sa catégorie
 *      (effectiveRequirements) — les 50 Pouvoirs Polaris individuels n'ont aucun prérequis à eux.
 *   2. (X) jamais appris SANS AUCUN prérequis (ni identité, ni compétence) → masquée hors mode
 *      Progression (comportement historique, non concerné par ce correctif).
 *   3. SKILL_MIN → si skillPrerequisitesEnabled === true ET Total de la prérequise < threshold →
 *      JAMAIS masquée : affichée verrouillée (non augmentable), prérequis manquant mis en avant
 *      (toujours visible, y compris hors mode Progression — retour Saar 2026-10-04).
 *   4. Toutes conditions OK → visible, non verrouillée.
 *
 * Mode Progression :
 *   Chaque compétence visible affiche un bouton "+" avec le coût en PE.
 *   Clic → POST /api/char-sheet/:characterId/skills/buy → onSkillBought()
 *   Bouton désactivé si xpAvailable < coût ou si compétence (X) déjà apprise
 *   et mastery à 0 (cas non bloquant mais coût = 1).
 *   Le coût de déblocage (X) est 1 PE (mastery → -3, affiché "Débloquer 1 PE").
 *
 * Sauvegarde directe (hors mode Progression) :
 *   Debounce 500ms par skill_id dans onChange — UPSERT via PUT /skills.
 *   La saisie directe de maîtrise reste disponible en mode normal pour le GM.
 */

import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'
import { effectiveRequirements, isBlockedByIdentityChain } from '../../../shared/skillRequirements.js'
import SkillInfoPopover, { SkillInfoButton } from '../components/SkillInfoPopover.jsx'

// ─── Barème coût XP (miroir client de charStats.js — pour l'affichage uniquement) ──
// Le serveur recalcule indépendamment. Ce calcul client n'est jamais envoyé comme
// valeur mécanique — il sert uniquement à désactiver le bouton et afficher le coût.
function getCoutAugmentation(currentMastery) {
  const target = Number(currentMastery) + 1
  if (target <= 5)   return 1
  if (target <= 10)  return 2
  if (target === 11) return 3
  if (target === 12) return 5
  if (target === 13) return 7
  if (target === 14) return 9
  if (target === 15) return 11
  return 11
}

const COUT_DEBLOCAGE_X = 1

// ─── Composant principal ──────────────────────────────────────────────────────

export default function SkillsPanel({
  refSkills,
  charSkills,
  charAdvantages,
  charMutations,
  anMap,
  characterId,
  isGm,
  canEdit,
  genotypeId,
  onSaved,
  progressionMode,
  xpAvailable,
  onSkillBought,
  skillPrerequisitesEnabled,
}) {
  const { t } = useTranslation()

  // ─── State local maîtrise ─────────────────────────────────────────────────
  const [localMastery, setLocalMastery] = useState({})
  const localMasteryRef = useRef({})
  const debounceTimers = useRef({})

  // ─── Panel description compétence ────────────────────────────────────────
  const [detailPanel, setDetailPanel] = useState(null)  // { skill, x, y } | null
  const detailPanelRef = useRef(null)

  useEffect(() => {
    if (!detailPanel) return
    const handler = (e) => {
      if (detailPanelRef.current && !detailPanelRef.current.contains(e.target)) {
        setDetailPanel(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [detailPanel])

  // ─── State achat en cours (pour désactiver le bouton pendant la requête) ──
  const [buyingSkillId, setBuyingSkillId] = useState(null)
  // Ref miroir — guard synchrone contre les double-clics rapides.
  // setBuyingSkillId est asynchrone (React batch) — isBuyingRef.current est synchrone.
  const isBuyingRef = useRef(false)

  useEffect(() => {
    const init = {}
    charSkills.forEach(s => { init[s.skill_id] = s.mastery ?? 0 })
    localMasteryRef.current = init
    setLocalMastery(init)
  }, [charSkills])

  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout)
    }
  }, [])

  // ─── Lookup is_learned ────────────────────────────────────────────────────
  const learnedSet = useMemo(() => {
    const s = new Set()
    charSkills.forEach(cs => { if (cs.is_learned) s.add(cs.skill_id) })
    return s
  }, [charSkills])

  // ─── Set des mutation_id (V2) actifs — source réelle char_mutations, pas charAdvantages ───
  const activeMutations = useMemo(() => {
    const s = new Set()
    charMutations.forEach(m => s.add(String(m.mutation_id)))
    return s
  }, [charMutations])

  // ─── Set des advantage_id actifs (ex. adv_079 "Force Polaris") ───────────
  const activeAdvantageIds = useMemo(() => {
    const s = new Set()
    charAdvantages.forEach(a => s.add(a.advantage_id))
    return s
  }, [charAdvantages])

  // ─── Calcul Base ──────────────────────────────────────────────────────────
  const calcBase = useCallback((skill) => {
    const an1 = anMap[skill.attr_1] ?? 0
    const an2 = skill.attr_2 ? (anMap[skill.attr_2] ?? 0) : an1
    // (-3) Compétence difficile — miroir de charStats.js:calcSkillTotal
    const malus = skill.marker === '(-3)' ? -3 : 0
    return an1 + an2 + malus
  }, [anMap])

  // ─── Calcul Total d'une compétence (base + mastery locale) ───────────────
  const calcTotal = useCallback((skill) => {
    const base    = calcBase(skill)
    const mastery = localMastery[skill.id] ?? 0
    return base + mastery
  }, [calcBase, localMastery])

  // ─── Vérifie une ligne de prérequis d'identité (MUTATION/ADVANTAGE/GENOTYPE) ──────────
  const isIdentityReqSatisfied = useCallback((req) => {
    if (req.type === 'MUTATION') return activeMutations.has(req.value)
    if (req.type === 'ADVANTAGE') return activeAdvantageIds.has(req.value)
    if (req.type === 'GENOTYPE') return genotypeId === req.value
    return true
  }, [activeMutations, activeAdvantageIds, genotypeId])

  // ─── Catalogue indexé par id — requis par effectiveRequirements/isBlockedByIdentityChain
  // (shared/skillRequirements.js) pour remonter un enfant de catégorie jusqu'à sa catégorie
  // parente, et une chaîne SKILL_MIN jusqu'à son éventuel verrou d'identité. ────────────────
  const skillsById = useMemo(() => new Map(refSkills.map(s => [s.id, s])), [refSkills])

  // ─── Algorithme de disponibilité (CHARACTER.md, revu CHARSHEET-ADVANTAGE-SKILL-GATE
  // 2026-10-04 — retour Saar) ──────────────────────────────────────────────────────────────
  //   1. Masquée si un Avantage/Mutation/Génotype manque AU BOUT de la chaîne de prérequis
  //      (directement, ou via un prérequis "compétence minimum" qui mène à un verrou
  //      d'identité — ex. Pouvoirs Polaris → Maîtrise de la Force Polaris → Avantage Force
  //      Polaris). Jamais affichée, quel que soit le mode : un personnage sans la Mutation
  //      Queue ne doit jamais voir Agilité Caudale, un personnage sans Polaris ne doit jamais
  //      voir un seul des 50 Pouvoirs.
  //   2. Jamais masquée pour un simple prérequis "compétence minimum" atteignable normalement
  //      (ex. Informatique → Culture générale) — affichée, verrouillée (non augmentable), avec
  //      le prérequis manquant mis en avant. Vrai aussi hors mode Progression.
  //   3. Un (X) jamais appris SANS AUCUN prérequis (ni identité, ni compétence) reste masqué
  //      hors mode Progression — comportement existant, non concerné par ce correctif : la
  //      liste ne doit pas s'remplir de centaines de compétences réservées jamais touchées.
  const getSkillGate = useCallback((skill) => {
    if (skill.attr_1 === 'CHC') return { hidden: true, locked: false, lockPrereqSkill: null }

    if (isBlockedByIdentityChain(skill, skillsById, isIdentityReqSatisfied)) {
      return { hidden: true, locked: false, lockPrereqSkill: null }
    }

    const effReqs = effectiveRequirements(skill, skillsById)
    const skillMinReqs = effReqs.filter(r => r.type === 'SKILL_MIN')

    if (skill.marker === '(X)' && !learnedSet.has(skill.id) && effReqs.length === 0 && !progressionMode) {
      return { hidden: true, locked: false, lockPrereqSkill: null }
    }

    if (skillPrerequisitesEnabled === true) {
      for (const req of skillMinReqs) {
        const prereq = refSkills.find(s => s.id === req.value)
        if (!prereq || calcTotal(prereq) < req.threshold) {
          return { hidden: false, locked: true, lockPrereqSkill: prereq ?? null }
        }
      }
    }

    return { hidden: false, locked: false, lockPrereqSkill: null }
  }, [refSkills, skillsById, learnedSet, calcTotal, progressionMode, skillPrerequisitesEnabled, isIdentityReqSatisfied])

  const isVisible = useCallback((skill) => !getSkillGate(skill).hidden, [getSkillGate])

  // ─── Groupement hiérarchique par famille ──────────────────────────────────
  const families = useMemo(() => {
    const byId = new Map(refSkills.map(s => [s.id, s]))
    const familyMap = new Map()
    refSkills.forEach(skill => {
      if (!familyMap.has(skill.family)) familyMap.set(skill.family, [])
      familyMap.get(skill.family).push(skill)
    })

    const result = new Map()
    familyMap.forEach((skills, family) => {
      const blocks = []
      skills.forEach(skill => {
        if (skill.is_category) {
          const children = skills.filter(s => s.parent === skill.id && isVisible(s))
          if (children.length > 0) {
            blocks.push({ type: 'group', group: skill, children })
          }
        } else if (!skill.parent || !byId.get(skill.parent)?.is_category) {
          if (isVisible(skill)) {
            blocks.push({ type: 'skill', skill })
          }
        }
      })
      result.set(family, blocks)
    })

    return result
  }, [refSkills, isVisible])

  // ─── Accordéon ────────────────────────────────────────────────────────────
  const [collapsedFamilies, setCollapsedFamilies] = useState(
    () => new Set(['Langues / langages'])
  )

  const toggleFamily = useCallback((family) => {
    setCollapsedFamilies(prev => {
      const next = new Set(prev)
      if (next.has(family)) next.delete(family)
      else next.add(family)
      return next
    })
  }, [])

  // ─── Achat compétence en mode Progression ─────────────────────────────────
  // isBuyingRef : guard synchrone contre les double-clics rapides.
  // buyingSkillId reste pour l'affichage UI (bouton '…' + disabled).
  const handleBuy = useCallback(async (skill) => {
    if (isBuyingRef.current) return  // guard synchrone

    const isX      = skill.marker === '(X)'
    const learned  = learnedSet.has(skill.id)
    const mastery  = localMastery[skill.id] ?? 0
    const cout     = (isX && !learned) ? COUT_DEBLOCAGE_X : getCoutAugmentation(mastery)

    if (xpAvailable < cout) return  // guard client (le serveur revérifie)

    isBuyingRef.current = true
    setBuyingSkillId(skill.id)
    try {
      const res = await api.post(`/char-sheet/${characterId}/skills/buy`, {
        skill_id: skill.id,
      })
      onSkillBought?.(res.data)
    } catch (err) {
      console.error('Erreur achat compétence :', err)
    } finally {
      isBuyingRef.current = false
      setBuyingSkillId(null)
    }
  }, [learnedSet, localMastery, xpAvailable, characterId, onSkillBought])

  // ─── Rendu d'une ligne compétence jouable ─────────────────────────────────
  // P3 : toutes les deps utilisées dans le callback sont listées
  const renderSkillRow = useCallback((skill) => {
    const base    = calcBase(skill)
    const mastery = localMastery[skill.id] ?? 0
    const total   = base + mastery
    const isDiff  = skill.marker === '(-3)'
    const isPN    = skill.marker === 'PN'
    const isX     = skill.marker === '(X)'
    const learned = learnedSet.has(skill.id)
    const { locked, lockPrereqSkill } = getSkillGate(skill)

    // Calcul du coût pour le mode Progression
    const cout         = (isX && !learned) ? COUT_DEBLOCAGE_X : getCoutAugmentation(mastery)
    const canAfford    = xpAvailable >= cout
    const isBuying     = buyingSkillId === skill.id

    return (
      <tr key={skill.id} style={s.row}>

        {/* Nom */}
        <td style={{ ...s.td, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', paddingLeft: skill.parent ? '14px' : '0' }}>
            <span style={{
              fontSize: '11px',
              color: locked ? '#6a6a80' : isDiff ? '#e08888' : isPN ? '#88c8a0' : '#b0b0c8',
              flex: 1,
              minWidth: 0,
            }}>
              {skill.label}
              {skill.marker && skill.marker !== 'S' && (
                <span style={s.marker}> {skill.marker}</span>
              )}
              {locked && lockPrereqSkill && (
                <div style={s.lockReason}>
                  {t('skillsPanel.lockedByPrereq', { prereq: lockPrereqSkill.label })}
                </div>
              )}
            </span>
            <SkillInfoButton skill={skill} setDetailPanel={setDetailPanel} />
          </div>
        </td>

        {/* Attributs */}
        <td style={s.td}>
          <span style={s.attrs}>
            {skill.attr_1}{skill.attr_2 ? `/${skill.attr_2}` : `/${skill.attr_1}`}
          </span>
        </td>

        {/* Base */}
        <td style={s.td}>
          <span style={s.readonly}>{base >= 0 ? `+${base}` : base}</span>
        </td>

        {/* Maîtrise — GM : input numérique. Joueur : valeur en lecture seule (achat via Mode Progression). */}
        <td style={s.td}>
          {isGm ? (
            <input
              style={s.masteryInput}
              type="number"
              value={mastery}
              onChange={e => {
                // PC11 amendé (CHARACTER.md §9) : plancher -3 pour une compétence (X)
                // débloquée (REGLECOMPETENCE.md:22-25), 0 pour les autres.
                const floor = isX ? -3 : 0
                const val = Math.max(floor, parseInt(e.target.value) || 0)
                const next = { ...localMasteryRef.current, [skill.id]: val }
                localMasteryRef.current = next
                setLocalMastery(next)
                if (debounceTimers.current[skill.id]) clearTimeout(debounceTimers.current[skill.id])
                debounceTimers.current[skill.id] = setTimeout(() => {
                  api.put(`/char-sheet/${characterId}/skills`, {
                    skills: [{ skill_id: skill.id, mastery: localMasteryRef.current[skill.id] ?? 0 }],
                  })
                    .then(() => onSaved?.())
                    .catch(err => console.error('Erreur save skill mastery :', err))
                }, 500)
              }}
            />
          ) : (
            <span style={s.readonly}>{mastery >= 0 ? `+${mastery}` : mastery}</span>
          )}
        </td>

        {/* Total */}
        <td style={s.td}>
          <span style={{
            ...s.total,
            color: total >= 0 ? '#5b8dee' : '#e08888',
          }}>
            {total >= 0 ? `+${total}` : total}
          </span>
        </td>

        {/* Bouton + (mode Progression uniquement) */}
        {progressionMode && (
          <td style={s.td}>
            <button
              style={{
                ...s.buyBtn,
                ...((!canAfford || isBuying || locked) ? s.buyBtnDisabled : {}),
              }}
              disabled={!canAfford || isBuying || locked}
              onClick={() => handleBuy(skill)}
              title={
                locked && lockPrereqSkill
                  ? t('skillsPanel.lockedByPrereq', { prereq: lockPrereqSkill.label })
                  : isX && !learned
                  ? t('character.xp.unlock', { count: COUT_DEBLOCAGE_X })
                  : t('character.xp.cost', { count: cout })
              }
            >
              {isBuying ? '…' : `+${cout} PE`}
            </button>
          </td>
        )}

      </tr>
    )
  }, [
    calcBase, localMastery, learnedSet, isGm, progressionMode, getSkillGate,
    xpAvailable, buyingSkillId, characterId, onSaved, handleBuy, t,
  ])

  // ─── Rendu ────────────────────────────────────────────────────────────────

  if (!refSkills || refSkills.length === 0) {
    return <div style={s.empty}>{t('skillsPanel.empty')}</div>
  }

  return (
    <>
    <div style={s.panel}>

      {Array.from(families.entries()).map(([family, blocks]) => {
        if (blocks.length === 0) return null

        const isCollapsed = collapsedFamilies.has(family)

        return (
          <div key={family} style={s.family}>

            <table style={s.table}>
              <thead>
                <tr
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggleFamily(family)}
                >
                  <th style={{ ...s.th, ...s.familyTitle, textAlign: 'left', width: '40%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{family}</span>
                      <span style={s.chevron}>{isCollapsed ? '▶' : '▼'}</span>
                    </div>
                  </th>
                  <th style={s.th}>{t('skillsPanel.colAttrs')}</th>
                  <th style={s.th}>{t('skillsPanel.colBase')}</th>
                  <th style={s.th}>{t('skillsPanel.colMastery')}</th>
                  <th style={s.th}>{t('skillsPanel.colTotal')}</th>
                  {progressionMode && (
                    <th style={s.th}>{t('character.xp.buy')}</th>
                  )}
                </tr>
              </thead>
              {!isCollapsed && (
              <tbody>
                {blocks.map(block => {
                  if (block.type === 'group') {
                    return (
                      <Fragment key={`group-${block.group.id}`}>
                        <tr style={s.groupHeader}>
                          <td colSpan={progressionMode ? 6 : 5} style={s.groupHeaderTd}>
                            {block.group.label}
                            {block.group.marker === 'PREREQ' && (
                              <span style={s.marker}> †</span>
                            )}
                          </td>
                        </tr>
                        {block.children.map(child => renderSkillRow(child))}
                      </Fragment>
                    )
                  }
                  return renderSkillRow(block.skill)
                })}
              </tbody>
              )}
            </table>

          </div>
        )
      })}

    </div>

    <SkillInfoPopover
      popover={detailPanel}
      popoverRef={detailPanelRef}
      onClose={() => setDetailPanel(null)}
    />
    </>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  empty: {
    color: '#5a5a7a',
    fontSize: '12px',
    textAlign: 'center',
    padding: '16px',
  },

  // Famille
  family: {
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  familyTitle: {
    fontWeight: '700',
    color: '#5b8dee',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  chevron: {
    fontSize: '8px',
    color: '#3a3a5e',
  },

  // Tableau
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '11px',
  },
  th: {
    padding: '5px 6px',
    color: '#5a5a7a',
    fontSize: '10px',
    fontWeight: '600',
    textAlign: 'center',
    borderBottom: '1px solid #1e1e2e',
    backgroundColor: '#0e0e1a',
  },
  td: {
    padding: '3px 6px',
    textAlign: 'center',
    borderBottom: '1px solid #1a1a2e',
    verticalAlign: 'middle',
  },
  row: {},

  // Sous-en-tête groupe CHC
  groupHeader: {},
  groupHeaderTd: {
    padding: '4px 10px',
    color: '#4a4a7a',
    fontSize: '10px',
    fontStyle: 'italic',
    fontWeight: '600',
    textAlign: 'left',
    borderBottom: '1px solid #1e1e2e',
    borderTop: '1px solid #1e1e2e',
  },

  // Cellules
  skillLabel: {
    fontSize: '11px',
    display: 'block',
  },
  marker: {
    fontSize: '10px',
    color: '#6a6a8a',
  },
  lockReason: {
    fontSize: '10px',
    color: '#8a7a5a',
    fontStyle: 'italic',
  },
  attrs: {
    fontSize: '10px',
    color: '#6a6a8a',
    fontFamily: 'monospace',
  },
  readonly: {
    display: 'inline-block',
    minWidth: '28px',
    color: '#8888a8',
    fontSize: '12px',
    fontWeight: '600',
    textAlign: 'center',
  },
  masteryInput: {
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
  total: {
    display: 'inline-block',
    minWidth: '28px',
    fontSize: '12px',
    fontWeight: '700',
    textAlign: 'center',
  },

  // Bouton achat mode Progression
  buyBtn: {
    padding: '2px 6px',
    border: '1px solid #2a4a2a',
    borderRadius: '3px',
    background: 'rgba(29,168,110,0.15)',
    color: '#1da86e',
    fontSize: '10px',
    fontWeight: '700',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  buyBtnDisabled: {
    border: '1px solid #2a2a3e',
    background: '#0c0c14',
    color: '#3a3a5e',
    cursor: 'default',
  },
}
