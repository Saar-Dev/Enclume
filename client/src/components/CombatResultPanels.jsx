/* Panneaux de résultat de combat — design Claude Design "VTT Enclume Combat Result"
   CombatResultGM   : vue GM, bottom-left, ton neutre
   CombatResultPlayer : vue Joueur, bottom-center, 2e personne dramatique
*/
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const C = {
  bg:         'var(--bg-session-raised)',
  bgInner:    'var(--bg-session)',
  border:     'var(--border-session-2)',
  text:       'var(--text-session-hi)',
  textDim:    'var(--text-session-mid)',
  textBright: 'var(--text-primary)',
  gold:       'var(--color-gold)',
  red:        '#c83030',
  green:      '#3aaa6a',
}

// label = cle i18n namespace combat (docs/SYSTEME/LOCALISATION.md §3.1), resolue par le composant
// via t(), jamais affichee brute ici.
const SEVERITY = {
  legere:   { col: '#FFD700', label: 'resultPanels.severity.legere'   },
  moyenne:  { col: '#FFA500', label: 'resultPanels.severity.moyenne'  },
  grave:    { col: '#FF6B6B', label: 'resultPanels.severity.grave'    },
  critique: { col: '#FF0000', label: 'resultPanels.severity.critique' },
  mortelle: { col: '#8B0000', label: 'resultPanels.severity.mortelle' },
}

const LOC = {
  tete:         'resultPanels.location.tete',
  corps:        'resultPanels.location.corps',
  bras_droit:   'resultPanels.location.brasDroit',
  bras_gauche:  'resultPanels.location.brasGauche',
  jambe_droite: 'resultPanels.location.jambeDroite',
  jambe_gauche: 'resultPanels.location.jambeGauche',
}

function RollSeuilLine({ roll, seuil, isSuccess }) {
  const { t } = useTranslation('combat')
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 6,
      padding: '6px 10px',
      background: C.bgInner,
      border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${isSuccess ? C.green : C.red}`,
    }}>
      <span style={{ fontSize: 10, color: C.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{t('resultPanels.rollLine.roll')}</span>
      <span style={{ fontSize: 18, color: isSuccess ? C.green : C.red, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{roll}</span>
      <span style={{ fontSize: 11, color: C.textDim, margin: '0 2px' }}>/</span>
      <span style={{ fontSize: 10, color: C.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{t('resultPanels.rollLine.threshold')}</span>
      <span style={{ fontSize: 14, color: C.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{seuil}</span>
    </div>
  )
}

function DamageLine({ degatsBruts, degatsNets, localisation }) {
  const { t } = useTranslation('combat')
  const absorbed = (degatsBruts ?? 0) - (degatsNets ?? 0)
  const locKey = LOC[localisation]
  return (
    <div style={{
      padding: '6px 10px',
      background: C.bgInner,
      border: `1px solid ${C.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: absorbed > 0 ? 3 : 0 }}>
        <span style={{ fontSize: 10, color: C.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{t('resultPanels.damageLine.label')}</span>
        <span style={{ fontSize: 20, color: C.textBright, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{degatsNets ?? 0}</span>
        <span style={{ fontSize: 11, color: C.text, letterSpacing: '0.02em', marginLeft: 'auto' }}>
          {locKey ? t(locKey) : localisation}
        </span>
      </div>
      {absorbed > 0 && (
        <div style={{ fontSize: 10, color: C.textDim, fontVariantNumeric: 'tabular-nums' }}>
          {t('resultPanels.damageLine.absorbed', { gross: degatsBruts, absorbed })}
        </div>
      )}
    </div>
  )
}

function SeverityBlock({ severity, is_lethal }) {
  const { t } = useTranslation('combat')
  const sev = SEVERITY[severity]
  if (!sev) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '5px 9px',
      background: sev.col + '14',
      border: `1px solid ${sev.col}66`,
      borderLeft: `3px solid ${sev.col}`,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: sev.col, flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: sev.col, fontWeight: 600, letterSpacing: '0.02em' }}>{t(sev.label)}</span>
      {is_lethal && (
        <span style={{ fontSize: 9, color: C.red, marginLeft: 'auto', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{t('resultPanels.severityBlock.lethal')}</span>
      )}
    </div>
  )
}

function ShockBlock({ shockResult, onApplyStun }) {
  const { t } = useTranslation('combat')
  const [stunApplied, setStunApplied] = useState(shockResult?.stun_applied ?? true)
  if (!shockResult?.triggered) return null
  // etourdi/inconscient/ok reutilisent stunWindow.outcomes.*/damageWindow.shockOutcomes.ok (Règle 2,
  // docs/RegleDocumentaire.md — meme texte que CombatStunWindow.jsx/CombatDamageWindow.jsx).
  const OUTCOME = {
    ok:          { labelKey: 'damageWindow.shockOutcomes.ok',      col: '#3aaa6a' },
    etourdi:     { labelKey: 'stunWindow.outcomes.etourdi.label',     col: '#f5c542' },
    inconscient: { labelKey: 'stunWindow.outcomes.inconscient.label', col: '#c83030' },
  }
  const outcome = OUTCOME[shockResult.outcome]
  const label = outcome ? t(outcome.labelKey) : shockResult.outcome
  const col   = outcome?.col ?? C.textDim
  const canApply = onApplyStun && shockResult.outcome !== 'ok' && !stunApplied
  return (
    <div style={{
      padding: '5px 9px',
      background: col + '14',
      border: `1px solid ${col}66`,
      borderLeft: `3px solid ${col}`,
    }}>
      <div style={{ fontSize: 9, color: C.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 3 }}>
        {t('damageWindow.shockTest')}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 16, color: col, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{shockResult.roll}</span>
        <span style={{ fontSize: 10, color: C.textDim }}>/ {t('resultPanels.rollLine.threshold').toLowerCase()} {shockResult.seuilEtourdi}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: col, fontWeight: 600 }}>{label}</span>
      </div>
      {shockResult.stun_duration != null && shockResult.outcome !== 'ok' && (
        <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>
          {t('resultPanels.shockBlock.duration', { count: shockResult.stun_duration })}
        </div>
      )}
      {canApply && (
        <button
          className="btn btn-danger"
          style={{ marginTop: 6, width: '100%', fontSize: 11 }}
          onClick={() => { onApplyStun(); setStunApplied(true) }}
        >
          {t('resultPanels.shockBlock.applyButton')}
        </button>
      )}
      {!canApply && onApplyStun && shockResult.outcome !== 'ok' && (
        <div style={{ marginTop: 5, fontSize: 10, color: C.textDim, textAlign: 'center' }}>{t('resultPanels.shockBlock.applied')}</div>
      )}
    </div>
  )
}

function CloseButton({ onClose }) {
  const { t } = useTranslation('combat')
  return (
    <div style={{ textAlign: 'center', marginTop: 10 }}>
      <button
        onClick={onClose}
        style={{
          background: 'transparent',
          border: `1px solid ${C.border}`,
          color: C.textDim,
          padding: '5px 18px',
          fontSize: 11,
          fontFamily: 'inherit',
          letterSpacing: '0.06em',
          cursor: 'pointer',
        }}
      >{t('damageWindow.closeButton')}</button>
    </div>
  )
}

/* ── Vue Rechargement — bottom-center, joueur rechargeur uniquement ────── */
export function CombatResultReload({ result, onClose }) {
  const { t } = useTranslation('combat')
  if (!result) return null
  const success = result.success
  const accent  = success ? C.green : C.red

  return (
    <div style={{
      position: 'absolute', bottom: 24, left: '50%',
      transform: 'translateX(-50%)',
      width: 220,
      background: C.bg,
      border: `1px solid ${accent}55`,
      borderTop: `3px solid ${accent}`,
      padding: '14px 12px 12px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
      color: C.text,
      pointerEvents: 'auto',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{ fontSize: 9, color: C.textDim, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>
        {t('actionLabels.reload')}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: accent, letterSpacing: '0.01em' }}>
        {success ? t('resultPanels.reload.success') : t('resultPanels.reload.impossible')}
      </div>
      {success ? (
        <div style={{
          padding: '6px 10px',
          background: C.bgInner,
          border: `1px solid ${C.border}`,
          borderLeft: `3px solid ${C.green}`,
          display: 'flex', alignItems: 'baseline', gap: 4,
        }}>
          <span style={{ fontSize: 20, color: C.textBright, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{result.newAmmo}</span>
          <span style={{ fontSize: 11, color: C.textDim }}>{t('resultPanels.reload.clipDisplay', { clipSize: result.clipSize })}</span>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: C.textDim, fontStyle: 'italic' }}>
          {t('resultPanels.reload.noAmmo', { caliber: result.caliber })}
        </div>
      )}
      {onClose && <CloseButton onClose={onClose} />}
    </div>
  )
}

/* ── Vue Corps à corps — bottom-right, jets en opposition ───────────────── */
export function CombatResultMelee({ attaquant, defenseur, rollAttaque, chancesAttaque, rollDefense, chanceDefense, hit, multiMalusAttaquant, multiMalusDefenseur, onClose }) {
  const { t } = useTranslation('combat')
  const accent = hit ? C.red : C.green
  const malusAtk = multiMalusAttaquant ?? 0
  const malusDef = multiMalusDefenseur ?? 0

  return (
    <div style={{
      position: 'absolute', bottom: 24, right: 24,
      width: 240,
      background: C.bg,
      border: `1px solid ${accent}55`,
      borderTop: `3px solid ${accent}`,
      padding: '12px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
      color: C.text,
      pointerEvents: 'auto',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 9, color: C.textDim, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 3 }}>
          {t('iniBreakdown.melee')}
        </div>
        <div style={{ fontSize: 13, color: C.textBright, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}>
          <span>{attaquant}</span>
          <span style={{ color: C.textDim, fontSize: 11 }}>→</span>
          <span>{defenseur}</span>
        </div>
      </div>

      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: accent, letterSpacing: '0.02em' }}>
        {hit ? t('resultPanels.melee.hit') : t('resultPanels.melee.dodged')}
      </div>

      {/* Malus encerclement */}
      {(malusAtk !== 0 || malusDef !== 0) && (
        <div style={{ fontSize: 10, color: '#e0a040', background: 'rgba(224,160,64,0.08)', border: '1px solid rgba(224,160,64,0.25)', borderRadius: 3, padding: '4px 7px', marginBottom: 8 }}>
          {malusAtk !== 0 && <div>{t('resultPanels.melee.surrounded', { name: attaquant, malus: malusAtk })}</div>}
          {malusDef !== 0 && <div>{t('resultPanels.melee.surrounded', { name: defenseur, malus: malusDef })}</div>}
        </div>
      )}

      {/* Jet attaquant */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 9, color: C.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 2 }}>{t('resultPanels.melee.attackLabel')}</div>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 6,
          padding: '5px 8px',
          background: C.bgInner,
          border: `1px solid ${C.border}`,
          borderLeft: `3px solid ${rollAttaque <= chancesAttaque ? C.green : C.red}`,
        }}>
          <span style={{ fontSize: 16, color: rollAttaque <= chancesAttaque ? C.green : C.red, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{rollAttaque}</span>
          <span style={{ fontSize: 10, color: C.textDim }}>/</span>
          <span style={{ fontSize: 12, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{chancesAttaque}</span>
        </div>
      </div>

      {/* Jet défenseur */}
      {rollDefense != null && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: C.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 2 }}>{t('resultPanels.melee.defenseLabel')}</div>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 6,
            padding: '5px 8px',
            background: C.bgInner,
            border: `1px solid ${C.border}`,
            borderLeft: `3px solid ${rollDefense <= chanceDefense ? C.green : C.red}`,
          }}>
            <span style={{ fontSize: 16, color: rollDefense <= chanceDefense ? C.green : C.red, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{rollDefense}</span>
            <span style={{ fontSize: 10, color: C.textDim }}>/</span>
            <span style={{ fontSize: 12, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{chanceDefense}</span>
          </div>
        </div>
      )}

      {onClose && <CloseButton onClose={onClose} />}
    </div>
  )
}

/* ── Vue GM — bottom-left, ton neutre, tireur → cible ──────────────────── */
export function CombatResultGM({ attaquant, cible, isSuccess, roll, seuil, localisation, degatsBruts, degatsNets, severity, is_lethal, shockResult, onClose, onApplyStun }) {
  const { t } = useTranslation('combat')
  const sevData = severity ? SEVERITY[severity] : null
  const accent  = isSuccess ? (sevData?.col || C.gold) : C.textDim

  return (
    <div style={{
      position: 'absolute', bottom: 24, left: 24,
      width: 220,
      background: C.bg,
      border: `1px solid ${C.border}`,
      borderTop: `3px solid ${accent}`,
      padding: '12px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
      color: C.text,
      pointerEvents: 'auto',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 9, color: C.textDim, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 3 }}>
          {t('resultPanels.gm.title')}
        </div>
        <div style={{ fontSize: 13, color: C.textBright, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <span>{attaquant}</span>
          <span style={{ color: C.textDim, fontSize: 11 }}>→</span>
          <span>{cible}</span>
        </div>
      </div>

      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: isSuccess ? C.text : C.textDim, letterSpacing: '0.02em' }}>
        {isSuccess ? t('resultPanels.melee.hit') : t('resultPanels.gm.missed')}
      </div>

      {roll !== undefined && (
        <div style={{ marginBottom: 8 }}>
          <RollSeuilLine roll={roll} seuil={seuil} isSuccess={isSuccess} />
        </div>
      )}

      {isSuccess && (
        <div style={{ marginBottom: 8 }}>
          <DamageLine degatsBruts={degatsBruts} degatsNets={degatsNets} localisation={localisation} />
        </div>
      )}

      {isSuccess && <SeverityBlock severity={severity} is_lethal={is_lethal} />}
      {isSuccess && <ShockBlock shockResult={shockResult} onApplyStun={onApplyStun} />}

      {onClose && <CloseButton onClose={onClose} />}
    </div>
  )
}

/* ── Vue Joueur — bottom-center, 2e personne, dramatique ───────────────── */
export function CombatResultPlayer({ attaquant, isSuccess, roll, seuil, localisation, degatsBruts, degatsNets, severity, is_lethal, shockResult, onClose }) {
  const { t } = useTranslation('combat')
  const sevData = severity ? SEVERITY[severity] : null
  const accent  = isSuccess ? (sevData?.col || C.red) : C.green

  return (
    <div style={{
      position: 'absolute', bottom: 24, left: '50%',
      transform: 'translateX(-50%)',
      width: 220,
      background: C.bg,
      border: `1px solid ${accent}55`,
      borderTop: `3px solid ${accent}`,
      padding: '14px 12px 12px',
      boxShadow: isSuccess
        ? `0 0 30px ${accent}44, 0 10px 30px rgba(0,0,0,0.6)`
        : '0 10px 30px rgba(0,0,0,0.6)',
      color: C.text,
      pointerEvents: 'auto',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: isSuccess ? accent : C.text, letterSpacing: '0.01em', lineHeight: 1.2 }}>
        {isSuccess
          ? (is_lethal ? t('resultPanels.player.lethallyHit') : t('resultPanels.player.hit'))
          : t('resultPanels.player.dodged')
        }
      </div>

      <div style={{ fontSize: 11, color: C.textDim, marginBottom: 10 }}>
        {isSuccess ? t('resultPanels.player.byPrefix') : t('resultPanels.player.fromPrefix')}
        <span style={{ color: C.text, fontWeight: 600 }}>{attaquant}</span>
      </div>

      <div style={{ marginBottom: 8 }}>
        <RollSeuilLine roll={roll} seuil={seuil} isSuccess={isSuccess} />
      </div>

      {isSuccess && (
        <div style={{ marginBottom: 8 }}>
          <DamageLine degatsBruts={degatsBruts} degatsNets={degatsNets} localisation={localisation} />
        </div>
      )}

      {isSuccess && <SeverityBlock severity={severity} is_lethal={is_lethal} />}
      {isSuccess && <ShockBlock shockResult={shockResult} />}

      {onClose && <CloseButton onClose={onClose} />}
    </div>
  )
}
