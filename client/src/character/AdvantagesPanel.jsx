/**
 * AdvantagesPanel.jsx — Module 6 : Avantages & Désavantages
 *
 * Monté dans CharacterSheet.jsx en Bloc 6, après les compétences.
 *
 * Props :
 *   characterId          — UUID du character Enclume
 *   charAdvantages       — lignes char_advantages (état géré par CharacterSheet)
 *   onAdvantagesChange   — callback(newList) — met à jour l'état dans CharacterSheet
 *                          → déclenche aussi le recalcul de visibilité dans SkillsPanel
 *   canEdit              — booléen (isGm || isOwner)
 *   isGm                 — booléen — gate l'ajout/retrait de mutations (MJ uniquement, Lot D :
 *                          octroi narratif, pas un choix libre du joueur)
 *   onSaved              — callback après opération réussie (feedback ✓ CharacterWindow)
 *   charSkills           — lignes char_skills (source de vérité — géré par CharacterSheet)
 *   refSkillsPolaris     — compétences Polaris de référence (filtré depuis CharacterSheet.refSkills)
 *   onSkillLearnedChange — callback(skill_id, is_learned) après toggle pouvoir Polaris
 *
 * Flux modale :
 *   Étape 1 : choix du type → [Mutations*] [Force Polaris**] [Autres]
 *             * grisé si !isGm (octroi MJ uniquement, lecture seule pour le joueur)
 *             ** grisé si l'avantage adv_079 "Force Polaris" absent de charAdvantages
 *   Étape 2A (Mutations)     : liste ref_mutations scrollable → POST .../mutations (char_mutations,
 *                              table dédiée, source='campaign', aucun coût PC — voir Lot D)
 *   Étape 2B (Force Polaris) : liste POUVOIRS_POLARIS depuis refSkillsPolaris (prop)
 *   Étape 2C (Autres)        : textarea 255 chars → char_advantage_notes (table dédiée, pas
 *                              char_advantages — aucun coût PC, voir Lot C)
 *
 * Affichage liste :
 *   Liste fusionnée charAdvantages (catalogue, badge AVA/DÉS) + charMutations (badge MUT, retrait
 *   MJ uniquement) + advantageNotes (texte libre, badge AUT), triée par ordre chronologique
 *
 * Force Polaris :
 *   Sélectionner un pouvoir Polaris → PUT /skills/toggle-learned (is_learned=true)
 *   Re-sélectionner un pouvoir déjà appris → is_learned=false (masquage)
 *   Stocké dans char_skills (source de vérité : CharacterSheet.charSkills).
 *   refSkillsPolaris et charSkills reçus en props — aucun état local char_skills ici.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'

// ─── Composant principal ──────────────────────────────────────────────────────

export default function AdvantagesPanel({
  characterId,
  charAdvantages,
  onAdvantagesChange,
  canEdit,
  isGm,
  onSaved,
  charSkills,
  refSkillsPolaris,
  onSkillLearnedChange,
}) {
  const { t } = useTranslation()

  // ─── Données de référence ─────────────────────────────────────────────────
  const [refMutations, setRefMutations] = useState([])

  // ─── État modale ──────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false)
  // 'type' | 'mutations' | 'mutation-subtype' | 'polaris' | 'other'
  const [step, setStep] = useState('type')
  const [otherLabel, setOtherLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  // Mutation en cours de sélection de sous-type (ex. "Caractère génétique animal" →
  // félin/canin/reptilien/simiesque) — null hors de l'étape 'mutation-subtype'.
  const [subtypeParent, setSubtypeParent] = useState(null)

  // ─── Calculer si l'avantage Force Polaris (adv_079) est possédé ──────────
  const hasForcePolaris = useMemo(
    () => charAdvantages.some(a => a.advantage_id === 'adv_079'),
    [charAdvantages]
  )

  // ─── Charger refMutations au montage ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    api.get('/char-ref/mutations')
      .then(res => { if (!cancelled) setRefMutations(res.data.mutations || []) })
      .catch(err => console.error('Erreur chargement ref_mutations :', err))
    return () => { cancelled = true }
  }, [])

  // ─── Notes "Autres" (texte libre, table dédiée) ──────────────────────────
  const [advantageNotes, setAdvantageNotes] = useState([])

  // Dépend de characterId : CharacterSheet n'est jamais remonté au changement de
  // personnage (pas de key={characterId}), donc sans cette dépendance les notes du
  // personnage précédent resteraient affichées.
  useEffect(() => {
    let cancelled = false
    api.get(`/char-sheet/${characterId}/advantage-notes`)
      .then(res => { if (!cancelled) setAdvantageNotes(res.data.notes || []) })
      .catch(err => console.error('Erreur chargement advantage-notes :', err))
    return () => { cancelled = true }
  }, [characterId])

  // ─── Mutations octroyées en jeu (char_mutations, table dédiée) ───────────
  const [charMutations, setCharMutations] = useState([])

  useEffect(() => {
    let cancelled = false
    api.get(`/char-sheet/${characterId}/mutations`)
      .then(res => { if (!cancelled) setCharMutations(res.data.mutations || []) })
      .catch(err => console.error('Erreur chargement mutations :', err))
    return () => { cancelled = true }
  }, [characterId])

  // ─── Set des pouvoirs Polaris appris (dérivé de charSkills prop) ─────────
  const learnedPolarisSet = useMemo(() => {
    const s = new Set()
    charSkills.forEach(cs => { if (cs.is_learned) s.add(cs.skill_id) })
    return s
  }, [charSkills])

  // ─── Ouvrir / fermer modale ───────────────────────────────────────────────
  const openModal = () => {
    setStep('type')
    setOtherLabel('')
    setError(null)
    setSubtypeParent(null)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setStep('type')
    setOtherLabel('')
    setError(null)
    setSubtypeParent(null)
  }

  // ─── Ajouter une mutation (MJ uniquement — serveur revalide aussi req.isGm) ─
  const handleAddMutation = useCallback(async (mutationId, subtypeId = null) => {
    setSaving(true)
    setError(null)
    try {
      const res = await api.post(`/char-sheet/${characterId}/mutations`, {
        mutation_id: mutationId,
        subtype_id: subtypeId,
      })
      const mutation = res.data.mutation
      setCharMutations(prev => {
        const idx = prev.findIndex(m => m.id === mutation.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = mutation
          return next
        }
        return [...prev, mutation]
      })
      onSaved?.()
      closeModal()
    } catch (err) {
      setError(t('advantages.errorAdd'))
      console.error('Erreur add mutation :', err)
    } finally {
      setSaving(false)
    }
  }, [characterId, onSaved, t])

  // ─── Choisir une mutation dans la liste — drill-down si sous-types ───────
  // Déclarée après handleAddMutation (P4/P48, .claude/rules/react.md) : appelle handleAddMutation.
  const handleSelectMutation = useCallback((mut) => {
    if (mut.subtable?.length > 0) {
      setSubtypeParent(mut)
      setStep('mutation-subtype')
    } else {
      handleAddMutation(mut.mutation_id)
    }
  }, [handleAddMutation])

  // ─── Toggle pouvoir Polaris (is_learned dans char_skills) ────────────────
  const handleTogglePolaris = useCallback(async (skillId) => {
    setSaving(true)
    setError(null)
    const isCurrentlyLearned = learnedPolarisSet.has(skillId)
    try {
      await api.put(`/char-sheet/${characterId}/skills/toggle-learned`, {
        skill_id: skillId,
        is_learned: !isCurrentlyLearned,
      })
      onSkillLearnedChange?.(skillId, !isCurrentlyLearned)
      onSaved?.()
    } catch (err) {
      setError(t('advantages.errorUpdate'))
      console.error('Erreur toggle polaris :', err)
    } finally {
      setSaving(false)
    }
  }, [characterId, learnedPolarisSet, onSaved, onSkillLearnedChange, t])

  // ─── Ajouter un texte libre (table char_advantage_notes) ─────────────────
  const handleAddOther = useCallback(async () => {
    if (!otherLabel.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await api.post(`/char-sheet/${characterId}/advantage-notes`, {
        label: otherLabel.trim(),
      })
      setAdvantageNotes(prev => [...prev, res.data.note])
      onSaved?.()
      closeModal()
    } catch (err) {
      setError(t('advantages.errorAdd'))
      console.error('Erreur add note :', err)
    } finally {
      setSaving(false)
    }
  }, [characterId, otherLabel, onSaved, t])

  // ─── Supprimer un avantage/désavantage catalogué ──────────────────────────
  const handleRemove = useCallback(async (advantage) => {
    setSaving(true)
    try {
      const res = await api.delete(`/char-sheet/${characterId}/advantages/${advantage.id}`)
      if (res.data.deleted) {
        onAdvantagesChange(prev => prev.filter(a => a.id !== advantage.id))
      } else {
        const updated = res.data.advantage
        onAdvantagesChange(prev => prev.map(a => a.id === updated.id ? updated : a))
      }
      onSaved?.()
    } catch (err) {
      console.error('Erreur remove advantage :', err)
    } finally {
      setSaving(false)
    }
  }, [characterId, onAdvantagesChange, onSaved])

  // ─── Supprimer une note "Autre" ────────────────────────────────────────────
  const handleRemoveNote = useCallback(async (note) => {
    setSaving(true)
    try {
      await api.delete(`/char-sheet/${characterId}/advantage-notes/${note.id}`)
      setAdvantageNotes(prev => prev.filter(n => n.id !== note.id))
      onSaved?.()
    } catch (err) {
      console.error('Erreur remove note :', err)
    } finally {
      setSaving(false)
    }
  }, [characterId, onSaved])

  // ─── Supprimer une mutation (MJ uniquement — soft-delete status='removed') ─
  const handleRemoveMutation = useCallback(async (mutation) => {
    setSaving(true)
    try {
      await api.delete(`/char-sheet/${characterId}/mutations/${mutation.id}`)
      setCharMutations(prev => prev.filter(m => m.id !== mutation.id))
      onSaved?.()
    } catch (err) {
      console.error('Erreur remove mutation :', err)
    } finally {
      setSaving(false)
    }
  }, [characterId, onSaved])

  // ─── Liste fusionnée : avantages + mutations + notes "Autres", tri chrono ─
  const combinedEntries = useMemo(() => {
    const advEntries = charAdvantages.map(a => ({ kind: 'advantage', sortAt: a.acquired_at, data: a }))
    const mutEntries = charMutations.map(m => ({ kind: 'mutation', sortAt: m.created_at, data: m }))
    const noteEntries = advantageNotes.map(n => ({ kind: 'note', sortAt: n.created_at, data: n }))
    return [...advEntries, ...mutEntries, ...noteEntries].sort((a, b) => new Date(a.sortAt) - new Date(b.sortAt))
  }, [charAdvantages, charMutations, advantageNotes])

  // ─── Rendu liste ──────────────────────────────────────────────────────────

  return (
    <div style={s.panel}>

      {/* ── Liste des entrées existantes ─────────────────────────────────── */}
      <div style={s.list}>
        {combinedEntries.length === 0 && (
          <div style={s.empty}>{t('advantages.empty')}</div>
        )}

        {combinedEntries.map(entry => (
          <div key={entry.data.id} style={s.row}>
            {entry.kind === 'advantage' && (
              <>
                <span style={{
                  ...s.badge,
                  ...(entry.data.type === 'advantage' ? s.badgeAdvantage : s.badgeDisadvantage),
                }}>
                  {entry.data.type === 'advantage' ? t('advantages.badgeAdvantage') : t('advantages.badgeDisadvantage')}
                </span>
                <span style={s.entryLabel}>{entry.data.name}</span>
                {canEdit && (
                  <button
                    style={s.removeBtn}
                    onClick={() => handleRemove(entry.data)}
                    disabled={saving}
                    title={t('advantages.removeTitle')}
                  >
                    ×
                  </button>
                )}
              </>
            )}

            {entry.kind === 'mutation' && (
              <>
                <span style={{ ...s.badge, ...s.badgeMutation }}>{t('advantages.badgeMutation')}</span>
                <span style={s.entryLabel}>
                  {entry.data.name}
                  {entry.data.subtype_name && ` — ${entry.data.subtype_name}`}
                  {entry.data.count > 1 && <span style={s.mutLevel}> ×{entry.data.count}</span>}
                </span>
                {isGm && (
                  <button
                    style={s.removeBtn}
                    onClick={() => handleRemoveMutation(entry.data)}
                    disabled={saving}
                    title={t('advantages.removeTitle')}
                  >
                    ×
                  </button>
                )}
              </>
            )}

            {entry.kind === 'note' && (
              <>
                <span style={{ ...s.badge, ...s.badgeNote }}>{t('advantages.badgeNote')}</span>
                <span style={s.entryLabel}>{entry.data.label}</span>
                {canEdit && (
                  <button
                    style={s.removeBtn}
                    onClick={() => handleRemoveNote(entry.data)}
                    disabled={saving}
                    title={t('advantages.removeTitle')}
                  >
                    ×
                  </button>
                )}
              </>
            )}
          </div>
        ))}

        {/* ── Bouton + ─────────────────────────────────────────────────── */}
        {canEdit && (
          <button style={s.addBtn} onClick={openModal} disabled={saving}>
            +
          </button>
        )}
      </div>

      {/* ── Modale ───────────────────────────────────────────────────────── */}
      {modalOpen && (
        <div style={s.overlay} onClick={closeModal}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>

            {/* En-tête modale */}
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>
                {step === 'type'            && t('advantages.add')}
                {step === 'mutations'       && t('advantages.stepMutations')}
                {step === 'mutation-subtype' && (subtypeParent?.name ?? t('advantages.stepMutationSubtype'))}
                {step === 'polaris'         && t('advantages.stepPolaris')}
                {step === 'other'           && t('advantages.stepOther')}
              </span>
              <button style={s.closeBtn} onClick={closeModal}>×</button>
            </div>

            {error && <div style={s.errorMsg}>{error}</div>}

            {/* ── Étape 1 : choix du type ──────────────────────────────── */}
            {step === 'type' && (
              <div style={s.typeGrid}>
                <button
                  style={{ ...s.typeBtn, ...(isGm ? {} : s.typeBtnDisabled) }}
                  onClick={() => isGm && setStep('mutations')}
                  disabled={!isGm}
                  title={isGm ? undefined : t('advantages.mutationsGmOnly')}
                >
                  <span style={s.typeBtnLabel}>{t('advantages.typeMutations')}</span>
                  <span style={s.typeBtnSub}>
                    {isGm ? t('advantages.typeMutationsSub') : t('advantages.mutationsGmOnly')}
                  </span>
                </button>

                <button
                  style={{ ...s.typeBtn, ...(hasForcePolaris ? {} : s.typeBtnDisabled) }}
                  onClick={() => hasForcePolaris && setStep('polaris')}
                  disabled={!hasForcePolaris}
                  title={hasForcePolaris ? undefined : t('advantages.polarisRequired')}
                >
                  <span style={s.typeBtnLabel}>{t('advantages.typePolaris')}</span>
                  <span style={s.typeBtnSub}>
                    {hasForcePolaris ? t('advantages.typePolarisSub') : t('advantages.typePolarisDisabled')}
                  </span>
                </button>

                <button style={s.typeBtn} onClick={() => setStep('other')}>
                  <span style={s.typeBtnLabel}>{t('advantages.typeOther')}</span>
                  <span style={s.typeBtnSub}>{t('advantages.typeOtherSub')}</span>
                </button>
              </div>
            )}

            {/* ── Étape 2A : liste mutations ───────────────────────────── */}
            {step === 'mutations' && (
              <div style={s.listStep}>
                {refMutations.length === 0
                  ? <div style={s.loadingMsg}>{t('common.loading')}</div>
                  : refMutations.map(mut => {
                      const existing = charMutations.find(m => m.mutation_id === mut.mutation_id)
                      const hasSubtable = mut.subtable?.length > 0
                      return (
                        <button
                          key={mut.mutation_id}
                          style={{ ...s.mutRow, ...(existing ? s.mutRowExisting : {}) }}
                          onClick={() => handleSelectMutation(mut)}
                          disabled={saving}
                          title={mut.description || ''}
                        >
                          <span style={s.mutName}>{mut.name}{hasSubtable ? ' ›' : ''}</span>
                          {existing && (
                            <span style={s.mutLevel}>
                              {t('advantages.mutLevel', { current: existing.count, next: existing.count + 1 })}
                            </span>
                          )}
                        </button>
                      )
                    })
                }
              </div>
            )}

            {/* ── Étape 2A-bis : sous-type de mutation (ex. Caractère génétique animal) ── */}
            {step === 'mutation-subtype' && subtypeParent && (
              <div style={s.listStep}>
                {subtypeParent.subtable.map(sub => (
                  <button
                    key={sub.subtype_id}
                    style={s.mutRow}
                    onClick={() => handleAddMutation(subtypeParent.mutation_id, sub.subtype_id)}
                    disabled={saving}
                    title={sub.skill_bonus || ''}
                  >
                    <span style={s.mutName}>{sub.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* ── Étape 2B : pouvoirs Polaris ──────────────────────────── */}
            {step === 'polaris' && (
              <div style={s.listStep}>
                {refSkillsPolaris.length === 0
                  ? <div style={s.loadingMsg}>{t('common.loading')}</div>
                  : refSkillsPolaris.map(skill => {
                      const isLearned = learnedPolarisSet.has(skill.id)
                      return (
                        <button
                          key={skill.id}
                          style={{ ...s.mutRow, ...(isLearned ? s.polarisActive : {}) }}
                          onClick={() => handleTogglePolaris(skill.id)}
                          disabled={saving}
                          title={skill.description || ''}
                        >
                          <span style={s.mutName}>{skill.label}</span>
                          <span style={s.mutLevel}>
                            {isLearned ? t('advantages.polarisVisible') : t('advantages.polarisHidden')}
                          </span>
                        </button>
                      )
                    })
                }
              </div>
            )}

            {/* ── Étape 2C : texte libre ───────────────────────────────── */}
            {step === 'other' && (
              <div style={s.otherStep}>
                <textarea
                  style={s.textarea}
                  placeholder={t('advantages.placeholderOther')}
                  maxLength={255}
                  value={otherLabel}
                  onChange={e => setOtherLabel(e.target.value)}
                  autoFocus
                />
                <div style={s.charCount}>{otherLabel.length}/255</div>
                <button
                  style={{ ...s.confirmBtn, ...(otherLabel.trim() ? {} : s.confirmBtnDisabled) }}
                  onClick={handleAddOther}
                  disabled={!otherLabel.trim() || saving}
                >
                  {t('advantages.add')}
                </button>
              </div>
            )}

            {/* Bouton retour si pas à l'étape 1 — 'mutation-subtype' revient à 'mutations' */}
            {step !== 'type' && (
              <button
                style={s.backBtn}
                onClick={() => {
                  if (step === 'mutation-subtype') {
                    setSubtypeParent(null)
                    setStep('mutations')
                  } else {
                    setStep('type')
                  }
                }}
              >
                {t('advantages.back')}
              </button>
            )}

          </div>
        </div>
      )}

    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  panel: {
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },

  // Liste
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  empty: {
    fontSize: '11px',
    color: '#5a5a7a',
    padding: '8px 4px',
    fontStyle: 'italic',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 8px',
    background: '#0e0e1a',
    borderRadius: '4px',
    border: '1px solid #1e1e2e',
  },
  badge: {
    fontSize: '9px',
    fontWeight: '700',
    padding: '2px 5px',
    borderRadius: '3px',
    letterSpacing: '0.05em',
    flexShrink: 0,
  },
  badgeAdvantage: {
    background: 'rgba(220,140,60,0.18)',
    color: '#dc8c3c',
    border: '1px solid rgba(220,140,60,0.3)',
  },
  badgeDisadvantage: {
    background: 'rgba(107,114,128,0.18)',
    color: '#9ca3af',
    border: '1px solid rgba(107,114,128,0.3)',
  },
  badgeNote: {
    background: 'rgba(91,141,238,0.18)',
    color: '#5b8dee',
    border: '1px solid rgba(91,141,238,0.3)',
  },
  badgeMutation: {
    background: 'rgba(96,192,96,0.18)',
    color: '#60c060',
    border: '1px solid rgba(96,192,96,0.3)',
  },
  entryLabel: {
    fontSize: '12px',
    color: '#b0b0c8',
    flex: 1,
    whiteSpace: 'pre-wrap',
  },
  removeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#4a4a60',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
    flexShrink: 0,
  },
  addBtn: {
    alignSelf: 'flex-start',
    background: 'transparent',
    border: '1px dashed #3a3a5e',
    borderRadius: '4px',
    color: '#5b8dee',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '2px 12px',
    marginTop: '4px',
    lineHeight: 1.4,
  },

  // Overlay modale — pas de position:fixed (interdit dans le contexte iframe)
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    borderRadius: '6px',
  },
  modal: {
    background: '#0e0e1a',
    border: '1px solid #2a2a3e',
    borderRadius: '8px',
    width: '360px',
    maxHeight: '480px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderBottom: '1px solid #1e1e2e',
    flexShrink: 0,
  },
  modalTitle: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#c0c0d0',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#5a5a7a',
    fontSize: '18px',
    cursor: 'pointer',
    lineHeight: 1,
    padding: 0,
  },
  errorMsg: {
    fontSize: '11px',
    color: '#e05c5c',
    padding: '6px 14px',
    background: 'rgba(224,92,92,0.08)',
  },

  // Étape 1 — 3 boutons type
  typeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
    padding: '16px',
  },
  typeBtn: {
    background: '#13161b',
    border: '1px solid #2a2a3e',
    borderRadius: '6px',
    padding: '12px 8px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    transition: 'border-color 0.15s',
  },
  typeBtnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  typeBtnLabel: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#c0c0d0',
  },
  typeBtnSub: {
    fontSize: '10px',
    color: '#5a5a7a',
    textAlign: 'center',
  },

  // Étapes 2A et 2B — liste scrollable
  listStep: {
    overflowY: 'auto',
    flex: 1,
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  loadingMsg: {
    fontSize: '11px',
    color: '#5a5a7a',
    textAlign: 'center',
    padding: '16px',
  },
  mutRow: {
    background: '#13161b',
    border: '1px solid #1e1e2e',
    borderRadius: '4px',
    padding: '7px 10px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    textAlign: 'left',
  },
  mutRowExisting: {
    borderColor: 'rgba(220,140,60,0.4)',
    background: 'rgba(220,140,60,0.06)',
  },
  polarisActive: {
    borderColor: 'rgba(91,141,238,0.4)',
    background: 'rgba(91,141,238,0.06)',
  },
  mutName: {
    fontSize: '12px',
    color: '#b0b0c8',
    flex: 1,
  },
  mutLevel: {
    fontSize: '10px',
    color: '#6a6a8a',
    flexShrink: 0,
  },

  // Étape 2C — texte libre
  otherStep: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  textarea: {
    background: '#13161b',
    border: '1px solid #2a2a3e',
    borderRadius: '4px',
    color: '#c0c0d0',
    fontSize: '12px',
    padding: '8px',
    resize: 'vertical',
    minHeight: '80px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  charCount: {
    fontSize: '10px',
    color: '#5a5a7a',
    textAlign: 'right',
  },
  confirmBtn: {
    background: '#5b8dee',
    border: 'none',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '700',
    padding: '8px 16px',
    cursor: 'pointer',
    alignSelf: 'flex-end',
  },
  confirmBtnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },

  // Bouton retour
  backBtn: {
    background: 'transparent',
    border: 'none',
    color: '#5a5a7a',
    fontSize: '11px',
    cursor: 'pointer',
    padding: '8px 14px',
    textAlign: 'left',
    flexShrink: 0,
  },
}
