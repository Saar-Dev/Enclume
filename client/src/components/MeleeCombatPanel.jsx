import { useTranslation } from 'react-i18next'
import { COMBAT_MODE_DEFS } from './combatSections.js'

const P = {
  section: {
    padding: '8px 14px',
    borderBottom: '1px solid var(--decl-sep, #1e1e2e)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--decl-acc, #8aa0b8)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 0',
    cursor: 'pointer',
    userSelect: 'none',
    borderBottom: '1px solid var(--decl-sep, #1e1e2e)',
  },
  optionLabel: { fontSize: 12, color: 'var(--decl-text, #c0c0d0)', fontWeight: 500 },
  optionSub:   { fontSize: 10, color: 'var(--decl-text-dim, #5b5b7a)', marginTop: 2 },
  radio: {
    width: 14, height: 14,
    borderRadius: '50%',
    border: '2px solid var(--decl-line, #3a3a5a)',
    flexShrink: 0,
    boxSizing: 'border-box',
    transition: 'border-color 0.1s, background 0.1s',
  },
  radioActive:       { borderColor: 'var(--decl-acc, #8aa0b8)', background: 'var(--decl-acc, #8aa0b8)' },
  chooseBtn: {
    padding: '6px 10px',
    background: 'var(--decl-acc-bg, rgba(255,255,255,0.05))',
    border: '1px solid var(--decl-acc-line, #4a5568)',
    borderRadius: 4,
    color: 'var(--decl-acc, #8aa0b8)',
    fontSize: 11,
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  },
  changeBtn: {
    padding: '3px 8px',
    background: 'none',
    border: '1px solid var(--decl-line, #3a3a5a)',
    borderRadius: 4,
    color: 'var(--decl-text-dim, #7070a0)',
    fontSize: 10,
    cursor: 'pointer',
    flexShrink: 0,
  },
  targetName: { fontSize: 12, color: 'var(--decl-acc, #8aa0b8)', fontWeight: 600, flex: 1 },
  readyText:  { fontSize: 11, color: 'var(--decl-acc, #8aa0b8)', fontWeight: 600, fontStyle: 'italic' },
}

// Chips inline pour les boutons de nombre d'attaques
function CountChip({ label, tooltip, selected, onClick }) {
  return (
    <div
      title={tooltip}
      onClick={onClick}
      style={{
        padding: '4px 8px', borderRadius: 3, cursor: 'pointer', fontSize: 10,
        border: `1px solid ${selected ? 'var(--decl-acc, #8aa0b8)' : 'var(--decl-line, #2a2a3e)'}`,
        background: selected ? 'var(--decl-acc-bg, rgba(255,255,255,0.06))' : 'rgba(255,255,255,0.02)',
        color: selected ? 'var(--decl-acc, #8aa0b8)' : 'var(--decl-text, #9aa4b0)',
        fontWeight: selected ? 600 : 400,
      }}
    >{label}</div>
  )
}

export default function MeleeCombatPanel({
  // Sélection arme — faite en col. 1 (CombatDeclareActionList, D5). Ce panneau ne reçoit plus que
  // l'arme choisie, pour la section « deux armes » ; il n'a plus de sélecteur (retiré 2026-08-30).
  availableWeapons,    // [{ id, label, ... }] — lookup du libellé de l'arme choisie
  selectedWeaponId,    // string | null (null = mains nues)

  // Mode de combat — FIX COM5 : onModeChange seul, pas de target auto
  combatMode,          // 'normal'|'offensif'|'charge'|'defensif'|'retraite'
  onModeChange,        // (mode) => void
  onStartCharge,       // () => void — parent gère le flow complet
  onStartRetraite,     // () => void | null — null = pas de recul (GM)

  // Feedback déplacement charge/retraite
  chargeMoveDest,      // { targetPosX, targetPosY } | null (P4 : normalisé)
  chargeTargetLabel,   // string | null

  // Nombre d'attaques
  meleeCount,          // 1 | 2 | 3
  effectiveMeleeCount, // 1 | 2 | 3 (charge → 1)
  onMeleeCountChange,  // (n, prevN) => void

  // Combat à deux armes (COM24, docs/BUGIDENTIFIE.md) — miroir du dual-wield Tir (AssaultRangedPanel)
  showDualWieldSection, // bool — hasTwoWeapons && arme en main sélectionnée (pas mains nues/naturelle)
  isDualWield,          // bool
  onDualWieldChange,    // (bool) => void
  offhandWeaponDisplay, // string | null — nom de l'arme en main non directrice, null = masqué

  // Cibles
  perSlotTargeting,    // bool — true=Joueur (bouton par slot) / false=GM (Cibler unique)
  targetIds,           // string[] — cibles sélectionnées
  isInTargetMode,      // bool — "⚔ Cliquez sur la cible" (GM target mode actif)
  tokens,              // pour label lookup
  onChooseTarget,      // (index) => void

  // Readiness
  showReadyBadge,      // bool
}) {
  const { t } = useTranslation('combat')
  const meleeDefensif = combatMode === 'defensif' || combatMode === 'retraite'

  return (
    <>
      {/* Section Mode de combat — FIX COM5 : onModeChange ne déclenche PAS de target auto */}
      <div style={P.section}>
        <div style={P.sectionTitle}>{t('meleeCombatPanel.modeSectionTitle')}</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {COMBAT_MODE_DEFS.map(m => {
            const isDefensif = m.k === 'defensif' || m.k === 'retraite'
            return (
              <div
                key={m.k}
                title={t(m.tooltip)}
                onClick={() => {
                  if (m.k === 'charge') {
                    onStartCharge()
                  } else {
                    onModeChange(m.k)
                  }
                }}
                className={combatMode === m.k
                  ? (isDefensif ? 'badge badge-mode badge-mode-defensif' : 'badge badge-mode')
                  : 'badge badge-mode-off'}
              >{t(m.l)}</div>
            )
          })}
        </div>
        {combatMode === 'charge' && !chargeMoveDest && (
          <div style={{ fontSize: 9, color: 'var(--decl-warn, #c8a030)', marginTop: 4 }}>
            {t('meleeCombatPanel.chargeNeedsMove')}
          </div>
        )}
        {combatMode === 'charge' && chargeMoveDest && !chargeTargetLabel && (
          <div style={{ fontSize: 9, color: 'var(--decl-acc, #8aa0b8)', marginTop: 4 }}>
            {t('meleeCombatPanel.chargeMoveSelected')}
          </div>
        )}
        {combatMode === 'defensif' && (
          <div style={{ fontSize: 9, color: 'var(--decl-acc, #8aa0b8)', marginTop: 4 }}>
            {t('meleeCombatPanel.defensifHint')}
          </div>
        )}
        {combatMode === 'retraite' && (
          <div style={{ fontSize: 9, color: 'var(--decl-acc, #8aa0b8)', marginTop: 4 }}>
            {t('meleeCombatPanel.retraiteHint')}
          </div>
        )}
      </div>

      {/* Section Recul — Retraite avec déplacement optionnel (Joueur uniquement) */}
      {combatMode === 'retraite' && onStartRetraite && (
        <div style={P.section}>
          <div style={P.sectionTitle}>{t('meleeCombatPanel.retreatSection')}</div>
          <button style={P.chooseBtn} onClick={onStartRetraite}>
            {chargeMoveDest
              ? t('meleeCombatPanel.retreatSelected')
              : t('meleeCombatPanel.retreatSelectButton')}
          </button>
        </div>
      )}

      {/* Section Nombre d'attaques — masqué Défensif/Retraite/Charge */}
      {!meleeDefensif && combatMode !== 'charge' && (
        <div style={P.section}>
          <div style={P.sectionTitle}>{t('meleeCombatPanel.attackCountSection')}</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <CountChip label={t('meleeCombatPanel.chip1.label')} tooltip={t('meleeCombatPanel.chip1.tooltip')} selected={meleeCount === 1} onClick={() => onMeleeCountChange(1, meleeCount)} />
            <CountChip label={t('meleeCombatPanel.chip2.label')} tooltip={t('meleeCombatPanel.chip2.tooltip')} selected={meleeCount === 2} onClick={() => onMeleeCountChange(2, meleeCount)} />
            <CountChip label={t('meleeCombatPanel.chip3.label')} tooltip={t('meleeCombatPanel.chip3.tooltip')} selected={meleeCount === 3} onClick={() => onMeleeCountChange(3, meleeCount)} />
          </div>
        </div>
      )}

      {/* Section Combat à deux armes — COM24, même emplacement/garde que Nombre d'attaques
          (jamais visible quand aucune attaque n'est déclarable ce Tour) */}
      {!meleeDefensif && combatMode !== 'charge' && showDualWieldSection && (
        <div style={P.section}>
          <div style={P.sectionTitle}>{t('meleeCombatPanel.dualWieldSection')}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="seg-opt"
              data-active={!isDualWield}
              style={{ flex: 1 }}
              onClick={() => onDualWieldChange(false)}
            >{t('meleeCombatPanel.dualWieldSimple')}</button>
            <button
              className="seg-opt"
              data-active={isDualWield}
              style={{ flex: 1 }}
              onClick={() => onDualWieldChange(true)}
            >{t('meleeCombatPanel.dualWieldDouble', { bonus: 3 })}</button>
          </div>
          {isDualWield && offhandWeaponDisplay && (
            <div style={P.optionSub}>{'+ '}{offhandWeaponDisplay}</div>
          )}
        </div>
      )}

      {/* Section Cibles — masquée en Défensif/Retraite */}
      {!meleeDefensif && (
        <div style={P.section}>
          <div style={P.sectionTitle}>
            {effectiveMeleeCount === 1 ? t('common.targetSection') : t('meleeCombatPanel.targetsCount', { count: targetIds.length, total: effectiveMeleeCount })}
          </div>

          {perSlotTargeting ? (
            // Mode Joueur : bouton par slot
            Array.from({ length: effectiveMeleeCount }, (_, i) => {
              const tgt = targetIds[i] ? tokens.find(tk => tk.id === targetIds[i]) : null
              return (
                <div key={i} style={{ marginBottom: i < effectiveMeleeCount - 1 ? 4 : 0 }}>
                  {tgt ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {effectiveMeleeCount > 1 && (
                        <span style={{ fontSize: 9, color: 'var(--decl-text-dim, #6a7280)', minWidth: 12 }}>{i + 1}.</span>
                      )}
                      <span style={P.targetName}>{tgt.label}</span>
                      <button style={P.changeBtn} onClick={() => onChooseTarget(i)}>{t('common.changeButton')}</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {effectiveMeleeCount > 1 && (
                        <span style={{ fontSize: 9, color: 'var(--decl-text-dim, #6a7280)', minWidth: 12 }}>{i + 1}.</span>
                      )}
                      <button style={P.chooseBtn} onClick={() => onChooseTarget(i)}>
                        {t('meleeCombatPanel.chooseAdversaryButton')}
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            // Mode GM : liste cibles + bouton "Cibler" unique
            <>
              {isInTargetMode && (
                <div style={{ fontSize: 9, color: 'var(--decl-acc, #8aa0b8)' }}>{t('meleeCombatPanel.targetModeHint')}</div>
              )}
              {targetIds.length > 0 && (
                <div>
                  {targetIds.map((tgtId, i) => {
                    const tgtToken = tokens.find(tk => tk.id === tgtId)
                    const weaponLabel = selectedWeaponId
                      ? (availableWeapons.find(w => w.id === selectedWeaponId)?.label ?? t('meleeCombatPanel.weaponFallback'))
                      : t('meleeCombatPanel.bareHandsFallback')
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                        {targetIds.length > 1 && (
                          <span style={{ fontSize: 8, color: 'var(--decl-text-dim, #6a7280)', minWidth: 10 }}>{i + 1}.</span>
                        )}
                        <span style={{ fontSize: 11, color: 'var(--decl-acc, #c8d4e0)', fontWeight: 600 }}>{tgtToken?.label ?? '?'}</span>
                        <span style={{ fontSize: 8, color: 'var(--decl-text-dim, #6a7280)', fontFamily: 'monospace' }}>{weaponLabel}</span>
                      </div>
                    )
                  })}
                </div>
              )}
              {!isInTargetMode && (
                <button style={P.chooseBtn} onClick={() => onChooseTarget(0)}>
                  {targetIds.length > 0 ? t('meleeCombatPanel.rechooseTargetsButton') : t('meleeCombatPanel.targetButton')}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Charge status */}
      {combatMode === 'charge' && (
        <div style={{ ...P.section, borderBottom: 'none' }}>
          <div style={{ fontSize: 9, color: 'var(--decl-label, #8aa0b8)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('meleeCombatPanel.chargeSection')}</div>
          <div style={{ fontSize: 10, color: 'var(--decl-acc, #c8d4e0)' }}>
            {chargeMoveDest ? t('meleeCombatPanel.destinationSet') : t('meleeCombatPanel.destinationPending')}
          </div>
          {chargeTargetLabel ? (
            <div style={{ fontSize: 11, color: 'var(--decl-acc, #c8d4e0)', fontWeight: 600 }}>→ {chargeTargetLabel}</div>
          ) : (
            <div style={{ fontSize: 9, color: 'var(--decl-text-dim, #6a7280)' }}>{t('meleeCombatPanel.targetPending')}</div>
          )}
        </div>
      )}

      {/* Readiness */}
      {showReadyBadge && !meleeDefensif && (
        <div style={{ padding: '8px 14px' }}>
          <div style={P.readyText}>{t('droneWeaponPanel.ready')}</div>
        </div>
      )}
    </>
  )
}
