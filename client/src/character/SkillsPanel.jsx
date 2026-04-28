/**
 * SkillsPanel.jsx — Module 5 : Compétences Polaris
 *
 * Monté dans CharacterSheet.jsx en Bloc 5, après les attributs secondaires.
 *
 * Props :
 *   refSkills      — catalogue complet (ref_skills + requirements imbriqués)
 *   charSkills     — lignes char_skills du personnage (peut être vide)
 *   charAdvantages — lignes char_advantages du personnage (mutations actives)
 *   anMap          — { FOR: 2, CON: 1, ... } — AN précalculés depuis CharacterSheet
 *   characterId    — UUID du character Enclume
 *   canEdit        — booléen (isGm || isOwner)
 *   genotypeId     — ID du génotype du personnage (pour prérequis GENOTYPE)
 *   onSaved        — callback après sauvegarde réussie
 *   progressionMode — booléen — active le mode achat XP
 *   xpAvailable    — entier — XP disponibles (affiché + guard bouton +)
 *   onSkillBought  — callback({ skill_id, mastery, is_learned, xp_available })
 *                    appelé après achat réussi — mise à jour locale dans CharacterSheet
 *
 * Règles de calcul :
 *   Base  = AN(attr_1) + AN(attr_2)   — si attr_2 null : AN(attr_1) × 2 (PC4)
 *   Total = Base + mastery             — jamais clampé, peut être négatif (PC11)
 *
 * Algorithme de visibilité (ordre strict, source CHARACTER.md) :
 *   1. marker === '(X)' ET is_learned === false → masquée
 *      SAUF si mutation débloquante satisfaite
 *   2. SKILL_MIN → Total de la prérequise < threshold → masquée
 *   3. MUTATION → muta_numero absent de charAdvantages → masquée
 *   4. GENOTYPE → genotypeId !== value → masquée
 *   5. Toutes conditions OK → visible
 *
 * Mode Progression :
 *   Chaque compétence visible affiche un bouton "+" avec le coût en PE.
 *   Clic → POST /api/char-sheet/:characterId/skills/buy → onSkillBought()
 *   Bouton désactivé si xpAvailable < coût ou si compétence (X) déjà apprise
 *   et mastery à 0 (cas non bloquant mais coût = 1).
 *   Le coût de déblocage (X) est 3 PE (affiché "Débloquer 3 PE").
 *
 * Sauvegarde directe (hors mode Progression) :
 *   Debounce 500ms par skill_id dans onChange — UPSERT via PUT /skills.
 *   La saisie directe de maîtrise reste disponible en mode normal pour le GM.
 */

import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'

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

const COUT_DEBLOCAGE_X = 3

// ─── Composant principal ──────────────────────────────────────────────────────

export default function SkillsPanel({
  refSkills,
  charSkills,
  charAdvantages,
  anMap,
  characterId,
  canEdit,
  genotypeId,
  onSaved,
  progressionMode,
  xpAvailable,
  onSkillBought,
}) {
  const { t } = useTranslation()

  // ─── State local maîtrise ─────────────────────────────────────────────────
  const [localMastery, setLocalMastery] = useState({})
  const localMasteryRef = useRef({})
  const debounceTimers = useRef({})

  // ─── State achat en cours (pour désactiver le bouton pendant la requête) ──
  const [buyingSkillId, setBuyingSkillId] = useState(null)

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

  // ─── Set des muta_numero actifs ───────────────────────────────────────────
  const activeMutations = useMemo(() => {
    const s = new Set()
    if (!charAdvantages) return s
    charAdvantages.forEach(a => {
      if (a.type === 'MUTATION' && a.muta_numero) s.add(a.muta_numero)
    })
    return s
  }, [charAdvantages])

  // ─── Calcul Base ──────────────────────────────────────────────────────────
  const calcBase = useCallback((skill) => {
    const an1 = anMap[skill.attr_1] ?? 0
    const an2 = skill.attr_2 ? (anMap[skill.attr_2] ?? 0) : an1
    return an1 + an2
  }, [anMap])

  // ─── Calcul Total d'une compétence (base + mastery locale) ───────────────
  const calcTotal = useCallback((skill) => {
    const base    = calcBase(skill)
    const mastery = localMastery[skill.id] ?? 0
    return base + mastery
  }, [calcBase, localMastery])

  // ─── Algorithme de visibilité ─────────────────────────────────────────────
  const isVisible = useCallback((skill) => {
    if (skill.attr_1 === 'CHC') return false

    const mutationReqs = skill.requirements.filter(r => r.type === 'MUTATION')
    const mutationsSatisfied = mutationReqs.length > 0
      && mutationReqs.every(r => activeMutations.has(r.value))

    if (skill.marker === '(X)' && !learnedSet.has(skill.id) && !mutationsSatisfied) {
      return false
    }

    for (const req of skill.requirements) {
      if (req.type === 'SKILL_MIN') {
        const prereq = refSkills.find(s => s.id === req.value)
        if (!prereq) return false
        if (calcTotal(prereq) < req.threshold) return false
      }
      if (req.type === 'MUTATION') {
        if (!activeMutations.has(req.value)) return false
      }
      if (req.type === 'GENOTYPE') {
        if (genotypeId !== req.value) return false
      }
    }

    return true
  }, [refSkills, learnedSet, calcTotal, genotypeId, activeMutations])

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
        if (skill.attr_1 === 'CHC') {
          const children = skills.filter(s => s.parent === skill.id && isVisible(s))
          if (children.length > 0) {
            blocks.push({ type: 'group', group: skill, children })
          }
        } else if (!skill.parent || byId.get(skill.parent)?.attr_1 !== 'CHC') {
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
  // P3 : onSkillBought dans les deps car utilisé dans le callback
  const handleBuy = useCallback(async (skill) => {
    if (buyingSkillId) return  // achat déjà en cours

    const isX      = skill.marker === '(X)'
    const learned  = learnedSet.has(skill.id)
    const mastery  = localMastery[skill.id] ?? 0
    const cout     = (isX && !learned) ? COUT_DEBLOCAGE_X : getCoutAugmentation(mastery)

    if (xpAvailable < cout) return  // guard client (le serveur revérifie)

    setBuyingSkillId(skill.id)
    try {
      const res = await api.post(`/char-sheet/${characterId}/skills/buy`, {
        skill_id: skill.id,
      })
      onSkillBought?.(res.data)
    } catch (err) {
      console.error('Erreur achat compétence :', err)
    } finally {
      setBuyingSkillId(null)
    }
  }, [buyingSkillId, learnedSet, localMastery, xpAvailable, characterId, onSkillBought])

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

    // Calcul du coût pour le mode Progression
    const cout         = (isX && !learned) ? COUT_DEBLOCAGE_X : getCoutAugmentation(mastery)
    const canAfford    = xpAvailable >= cout
    const isBuying     = buyingSkillId === skill.id

    return (
      <tr key={skill.id} style={s.row}>

        {/* Nom */}
        <td style={{ ...s.td, textAlign: 'left' }}>
          <span style={{
            ...s.skillLabel,
            paddingLeft: skill.parent ? '14px' : '0',
            color: isDiff ? '#e08888' : isPN ? '#88c8a0' : '#b0b0c8',
          }}>
            {skill.label}
            {skill.marker && skill.marker !== 'S' && (
              <span style={s.marker}> {skill.marker}</span>
            )}
          </span>
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

        {/* Maîtrise — input éditable en mode normal, readonly en mode Progression */}
        <td style={s.td}>
          <input
            style={s.masteryInput}
            type="number"
            value={mastery}
            readOnly={!canEdit || progressionMode}
            onChange={e => {
              if (progressionMode) return
              const val = Math.max(0, parseInt(e.target.value) || 0)
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
                ...((!canAfford || isBuying) ? s.buyBtnDisabled : {}),
              }}
              disabled={!canAfford || isBuying}
              onClick={() => handleBuy(skill)}
              title={
                isX && !learned
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
    calcBase, localMastery, learnedSet, canEdit, progressionMode,
    xpAvailable, buyingSkillId, characterId, onSaved, handleBuy, t,
  ])

  // ─── Rendu ────────────────────────────────────────────────────────────────

  if (!refSkills || refSkills.length === 0) {
    return <div style={s.empty}>Catalogue de compétences non chargé.</div>
  }

  return (
    <div style={s.panel}>

      {Array.from(families.entries()).map(([family, blocks]) => {
        if (blocks.length === 0) return null

        const isCollapsed = collapsedFamilies.has(family)

        return (
          <div key={family} style={s.family}>

            <div
              style={{ ...s.familyTitle, cursor: 'pointer', userSelect: 'none' }}
              onClick={() => toggleFamily(family)}
            >
              <span>{family}</span>
              <span style={s.chevron}>{isCollapsed ? '▶' : '▼'}</span>
            </div>

            {!isCollapsed && (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={{ ...s.th, textAlign: 'left', width: '40%' }}>Compétence</th>
                  <th style={s.th}>Attributs</th>
                  <th style={s.th}>Base</th>
                  <th style={s.th}>Maîtrise</th>
                  <th style={s.th}>Total</th>
                  {progressionMode && (
                    <th style={s.th}>{t('character.xp.buy')}</th>
                  )}
                </tr>
              </thead>
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
            </table>
            )}

          </div>
        )
      })}

    </div>
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
    fontSize: '10px',
    fontWeight: '700',
    color: '#5b8dee',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    padding: '6px 10px',
    backgroundColor: '#0e0e1a',
    borderBottom: '1px solid #1e1e2e',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  groupHeader: {
    backgroundColor: '#12121f',
  },
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
