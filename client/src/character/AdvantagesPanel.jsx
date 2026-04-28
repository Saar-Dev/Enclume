/**
 * AdvantagesPanel.jsx — Module 6 : Avantages & Désavantages
 *
 * Monté dans CharacterSheet.jsx en Bloc 6, après les compétences.
 *
 * Props :
 *   characterId        — UUID du character Enclume
 *   charAdvantages     — lignes char_advantages (état géré par CharacterSheet)
 *   onAdvantagesChange — callback(newList) — met à jour l'état dans CharacterSheet
 *                        → déclenche aussi le recalcul de visibilité dans SkillsPanel
 *   canEdit            — booléen (isGm || isOwner)
 *   onSaved            — callback après opération réussie (feedback ✓ CharacterWindow)
 *
 * Flux modale :
 *   Étape 1 : choix du type → [Mutations] [Force Polaris*] [Autres]
 *             * grisé si muta_029 absente de charAdvantages
 *   Étape 2A (Mutations)     : liste ref_mutations scrollable
 *   Étape 2B (Force Polaris) : liste POUVOIRS_POLARIS depuis refSkillsPolaris
 *   Étape 2C (Autres)        : textarea 255 chars
 *
 * Affichage liste :
 *   Badge MUT (orange) | POL (bleu) | ATR (gris) + nom + level si >1 + bouton ×
 *   Ordre chronologique (created_at asc — garanti par l'API)
 *
 * Force Polaris :
 *   Sélectionner un pouvoir Polaris → upsert dans char_skills (is_learned=true)
 *   Re-sélectionner un pouvoir déjà appris → is_learned=false (masquage)
 *   Stocké dans char_skills, pas dans char_advantages.
 *   Les entrées Force Polaris dans la liste UI sont construites depuis refSkillsPolaris
 *   filtrées sur les char_skills avec is_learned=true.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../lib/api.js'

// ─── Constante : ID mutation Sensibilité au Polaris ───────────────────────────
const MUTA_POLARIS = 'muta_029'

// ─── Composant principal ──────────────────────────────────────────────────────

export default function AdvantagesPanel({
  characterId,
  charAdvantages,
  onAdvantagesChange,
  canEdit,
  onSaved,
}) {

  // ─── Données de référence ─────────────────────────────────────────────────
  const [refMutations,     setRefMutations]     = useState([])
  const [refSkillsPolaris, setRefSkillsPolaris] = useState([])
  const [charSkillsPolaris, setCharSkillsPolaris] = useState([])
  const [loadingRef, setLoadingRef] = useState(false)

  // ─── État modale ──────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false)
  // 'type' | 'mutations' | 'polaris' | 'other'
  const [step, setStep] = useState('type')
  const [otherLabel, setOtherLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // ─── Calculer si muta_029 est active ─────────────────────────────────────
  const hasMuta029 = useMemo(
    () => charAdvantages.some(a => a.type === 'MUTATION' && a.muta_numero === MUTA_POLARIS),
    [charAdvantages]
  )

  // ─── Charger refMutations au montage ─────────────────────────────────────
  // Chargé immédiatement — nécessaire pour résoudre mutation_nom dans handleAddMutation
  // même si la modale n'a pas encore été ouverte.
  useEffect(() => {
    let cancelled = false
    api.get('/char-ref/mutations')
      .then(res => { if (!cancelled) setRefMutations(res.data.mutations || []) })
      .catch(err => console.error('Erreur chargement ref_mutations :', err))
    return () => { cancelled = true }
  }, [])

  // ─── Charger skills Polaris + char_skills à l'ouverture de la modale ─────
  // Chargé à la demande — uniquement quand la modale s'ouvre.
  useEffect(() => {
    if (!modalOpen) return
    if (refSkillsPolaris.length > 0) return // déjà chargé

    setLoadingRef(true)
    Promise.all([
      api.get('/char-ref/skills'),
      api.get(`/char-sheet/${characterId}`),
    ])
      .then(([skillsRes, sheetRes]) => {
        const polaris = (skillsRes.data.skills || []).filter(
          s => s.parent === 'POUVOIRS_POLARIS'
        )
        setRefSkillsPolaris(polaris)
        setCharSkillsPolaris(sheetRes.data.skills || [])
      })
      .catch(err => {
        console.error('Erreur chargement ref modale :', err)
        setError('Impossible de charger les données')
      })
      .finally(() => setLoadingRef(false))
  }, [modalOpen, characterId, refSkillsPolaris.length])

  // ─── Set des pouvoirs Polaris appris ──────────────────────────────────────
  const learnedPolarisSet = useMemo(() => {
    const s = new Set()
    charSkillsPolaris.forEach(cs => { if (cs.is_learned) s.add(cs.skill_id) })
    return s
  }, [charSkillsPolaris])

  // ─── Ouvrir / fermer modale ───────────────────────────────────────────────
  const openModal = () => {
    setStep('type')
    setOtherLabel('')
    setError(null)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setStep('type')
    setOtherLabel('')
    setError(null)
  }

  // ─── Ajouter une mutation ─────────────────────────────────────────────────
  const handleAddMutation = useCallback(async (muta_numero) => {
    setSaving(true)
    setError(null)
    try {
      const res = await api.post(`/char-sheet/${characterId}/advantages`, {
        type: 'MUTATION',
        muta_numero,
      })
      // Le serveur retourne la ligne char_advantages sans le join ref_mutations.
      // On enrichit localement depuis refMutations (déjà chargé) pour avoir mutation_nom
      // et linked_skill_id sans second appel réseau.
      const raw = res.data.advantage
      const refMut = refMutations.find(m => m.muta_numero === raw.muta_numero)
      const updated = {
        ...raw,
        mutation_nom:     refMut?.nom             ?? raw.muta_numero,
        linked_skill_id:  refMut?.linked_skill_id ?? null,
      }
      onAdvantagesChange(prev => {
        const idx = prev.findIndex(a => a.id === updated.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = updated
          return next
        }
        return [...prev, updated]
      })
      onSaved?.()
      closeModal()
    } catch (err) {
      setError('Erreur lors de l\'ajout')
      console.error('Erreur add mutation :', err)
    } finally {
      setSaving(false)
    }
  }, [characterId, onAdvantagesChange, onSaved])

  // ─── Toggle pouvoir Polaris (is_learned dans char_skills) ────────────────
  const handleTogglePolaris = useCallback(async (skillId) => {
    setSaving(true)
    setError(null)
    const isCurrentlyLearned = learnedPolarisSet.has(skillId)
    try {
      await api.put(`/char-sheet/${characterId}/skills`, {
        skills: [{ skill_id: skillId, is_learned: !isCurrentlyLearned }],
      })
      // Mettre à jour le state local charSkillsPolaris
      setCharSkillsPolaris(prev => {
        const idx = prev.findIndex(cs => cs.skill_id === skillId)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx], is_learned: !isCurrentlyLearned }
          return next
        }
        // Pas encore dans char_skills — ajouter
        return [...prev, { skill_id: skillId, mastery: 0, is_learned: true }]
      })
      onSaved?.()
    } catch (err) {
      setError('Erreur lors de la mise à jour')
      console.error('Erreur toggle polaris :', err)
    } finally {
      setSaving(false)
    }
  }, [characterId, learnedPolarisSet, onSaved])

  // ─── Ajouter un texte libre ───────────────────────────────────────────────
  const handleAddOther = useCallback(async () => {
    if (!otherLabel.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await api.post(`/char-sheet/${characterId}/advantages`, {
        type: 'OTHER',
        label: otherLabel.trim(),
      })
      onAdvantagesChange(prev => [...prev, res.data.advantage])
      onSaved?.()
      closeModal()
    } catch (err) {
      setError('Erreur lors de l\'ajout')
      console.error('Erreur add other :', err)
    } finally {
      setSaving(false)
    }
  }, [characterId, otherLabel, onAdvantagesChange, onSaved])

  // ─── Supprimer / décrémenter ──────────────────────────────────────────────
  const handleRemove = useCallback(async (advantage) => {
    setSaving(true)
    try {
      const res = await api.delete(`/char-sheet/${characterId}/advantages/${advantage.id}`)
      if (res.data.deleted) {
        // Suppression complète
        onAdvantagesChange(prev => prev.filter(a => a.id !== advantage.id))
      } else {
        // Décrémentation level
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

  // ─── Rendu liste ──────────────────────────────────────────────────────────

  return (
    <div style={s.panel}>

      {/* ── Liste des entrées existantes ─────────────────────────────────── */}
      <div style={s.list}>
        {charAdvantages.length === 0 && (
          <div style={s.empty}>Aucun avantage ou désavantage enregistré.</div>
        )}

        {charAdvantages.map(adv => (
          <div key={adv.id} style={s.row}>
            <span style={{
              ...s.badge,
              ...(adv.type === 'MUTATION' ? s.badgeMut : s.badgeAtr),
            }}>
              {adv.type === 'MUTATION' ? 'MUT' : 'ATR'}
            </span>

            <span style={s.entryLabel}>
              {adv.type === 'MUTATION'
                ? adv.mutation_nom || adv.muta_numero
                : adv.label}
            </span>

            {adv.type === 'MUTATION' && adv.level > 1 && (
              <span style={s.level}>×{adv.level}</span>
            )}

            {canEdit && (
              <button
                style={s.removeBtn}
                onClick={() => handleRemove(adv)}
                disabled={saving}
                title="Retirer"
              >
                ×
              </button>
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
                {step === 'type'      && 'Ajouter'}
                {step === 'mutations' && 'Choisir une mutation'}
                {step === 'polaris'   && 'Pouvoirs Polaris'}
                {step === 'other'     && 'Texte libre'}
              </span>
              <button style={s.closeBtn} onClick={closeModal}>×</button>
            </div>

            {error && <div style={s.errorMsg}>{error}</div>}

            {/* ── Étape 1 : choix du type ──────────────────────────────── */}
            {step === 'type' && (
              <div style={s.typeGrid}>
                <button style={s.typeBtn} onClick={() => setStep('mutations')}>
                  <span style={s.typeBtnLabel}>Mutations</span>
                  <span style={s.typeBtnSub}>Capacités biologiques</span>
                </button>

                <button
                  style={{ ...s.typeBtn, ...(hasMuta029 ? {} : s.typeBtnDisabled) }}
                  onClick={() => hasMuta029 && setStep('polaris')}
                  disabled={!hasMuta029}
                  title={hasMuta029 ? undefined : 'Requiert : Sensibilité au Polaris (muta_029)'}
                >
                  <span style={s.typeBtnLabel}>Force Polaris</span>
                  <span style={s.typeBtnSub}>
                    {hasMuta029 ? 'Pouvoirs psioniques' : 'Nécessite muta_029'}
                  </span>
                </button>

                <button style={s.typeBtn} onClick={() => setStep('other')}>
                  <span style={s.typeBtnLabel}>Autres</span>
                  <span style={s.typeBtnSub}>Titre, ennemi, implant…</span>
                </button>
              </div>
            )}

            {/* ── Étape 2A : liste mutations ───────────────────────────── */}
            {step === 'mutations' && (
              <div style={s.listStep}>
                {loadingRef
                  ? <div style={s.loadingMsg}>Chargement…</div>
                  : refMutations.map(mut => {
                      const existing = charAdvantages.find(
                        a => a.type === 'MUTATION' && a.muta_numero === mut.muta_numero
                      )
                      return (
                        <button
                          key={mut.muta_numero}
                          style={{ ...s.mutRow, ...(existing ? s.mutRowExisting : {}) }}
                          onClick={() => handleAddMutation(mut.muta_numero)}
                          disabled={saving}
                          title={mut.description || ''}
                        >
                          <span style={s.mutName}>{mut.nom}</span>
                          {existing && (
                            <span style={s.mutLevel}>Niveau {existing.level} → {existing.level + 1}</span>
                          )}
                        </button>
                      )
                    })
                }
              </div>
            )}

            {/* ── Étape 2B : pouvoirs Polaris ──────────────────────────── */}
            {step === 'polaris' && (
              <div style={s.listStep}>
                {loadingRef
                  ? <div style={s.loadingMsg}>Chargement…</div>
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
                            {isLearned ? '✓ Affiché' : 'Masqué'}
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
                  placeholder="Ex : Cicatrice au visage, Ennemi : Clan Rykker, Implant neural…"
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
                  Ajouter
                </button>
              </div>
            )}

            {/* Bouton retour si pas à l'étape 1 */}
            {step !== 'type' && (
              <button style={s.backBtn} onClick={() => setStep('type')}>
                ← Retour
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
  badgeMut: {
    background: 'rgba(220,140,60,0.18)',
    color: '#dc8c3c',
    border: '1px solid rgba(220,140,60,0.3)',
  },
  badgeAtr: {
    background: 'rgba(107,114,128,0.18)',
    color: '#9ca3af',
    border: '1px solid rgba(107,114,128,0.3)',
  },
  entryLabel: {
    fontSize: '12px',
    color: '#b0b0c8',
    flex: 1,
  },
  level: {
    fontSize: '10px',
    color: '#dc8c3c',
    fontWeight: '600',
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
  // On utilise un overlay inline dans le flux du composant
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
