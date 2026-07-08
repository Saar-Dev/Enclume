import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AUTODIDACTE_TOTAL_POINTS,
  AUTODIDACTE_MAX_PER_SKILL,
  isAutodidacteEligible,
} from '../../../../shared/autodidacte.js'

// Formation "Autodidacte" (Step4Experience, sous-étape Formation) — répartition libre de 7 points
// sur les compétences éligibles (hors (X), hors compétences à prérequis SKILL_MIN — voir
// shared/autodidacte.js). Monté par BackgroundSelector quand selectedItem.isAutodidacte.
export default function AutodidacteAllocator({ refSkills, allocations, onChange }) {
  const { t } = useTranslation('creation')

  const groupedEligible = useMemo(() => {
    const eligible = (refSkills || []).filter(isAutodidacteEligible)
    const byFamily = {}
    for (const sk of eligible) (byFamily[sk.family] ??= []).push(sk)
    return Object.entries(byFamily).sort(([a], [b]) => a.localeCompare(b))
  }, [refSkills])

  if (!refSkills || refSkills.length === 0) {
    return <p className="wiz4-note">{t('step4.autodidacte_loading')}</p>
  }

  const spent = Object.values(allocations || {}).reduce((sum, n) => sum + n, 0)
  const remaining = AUTODIDACTE_TOTAL_POINTS - spent

  const handleInc = (skillId) => {
    const current = allocations[skillId] ?? 0
    if (current >= AUTODIDACTE_MAX_PER_SKILL || remaining <= 0) return
    onChange({ ...allocations, [skillId]: current + 1 })
  }

  const handleDec = (skillId) => {
    const current = allocations[skillId] ?? 0
    if (current <= 0) return
    const next = { ...allocations }
    if (current === 1) delete next[skillId]
    else next[skillId] = current - 1
    onChange(next)
  }

  return (
    <div className="wiz4-block">
      <div className="wiz4-boardhead">
        <span className="wiz4-h">{t('step4.autodidacte_title')}</span>
        <span className={`wiz4-poolrem${remaining === 0 ? ' ok' : ''}`}>
          <span className="wiz4-mono">{remaining}</span> {t('step4.autodidacte_points_remaining')}
        </span>
      </div>
      <p className="wiz4-note">{t('step4.autodidacte_rule')}</p>
      {groupedEligible.map(([family, skills]) => (
        <div key={family}>
          <div className="wiz4-grplbl">{family}</div>
          {skills.map(sk => {
            const pts = allocations[sk.id] ?? 0
            return (
              <div key={sk.id} className="wiz4-skill">
                <div className="wiz4-skmain">
                  <span className="wiz4-sklabel">{sk.label}</span>
                </div>
                <div className="wiz4-ctl">
                  <button
                    className={`wiz4-sbtn${pts <= 0 ? ' dis' : ''}`}
                    onClick={() => handleDec(sk.id)}
                    disabled={pts <= 0}
                  >−</button>
                  <span className="wiz4-val">{pts}</span>
                  <button
                    className={`wiz4-sbtn${(pts >= AUTODIDACTE_MAX_PER_SKILL || remaining <= 0) ? ' dis' : ''}`}
                    onClick={() => handleInc(sk.id)}
                    disabled={pts >= AUTODIDACTE_MAX_PER_SKILL || remaining <= 0}
                  >＋</button>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
