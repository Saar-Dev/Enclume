import { useTranslation } from 'react-i18next'
import { COMBAT_MODE_DEFS } from './combatSections.js'
import { getNaturalWeaponIneligibilityReasons, isNaturalWeaponEligible } from '../../../shared/naturalWeapons.js'

const P = {
  section: {
    padding: '8px 14px',
    borderBottom: '1px solid #1e1e2e',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: '#70c070',
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
    borderBottom: '1px solid #1e1e2e',
  },
  optionLabel: { fontSize: 12, color: '#c0c0d0', fontWeight: 500 },
  optionSub:   { fontSize: 10, color: '#5b5b7a', marginTop: 2 },
  radio: {
    width: 14, height: 14,
    borderRadius: '50%',
    border: '2px solid #3a3a5a',
    flexShrink: 0,
    boxSizing: 'border-box',
    transition: 'border-color 0.1s, background 0.1s',
  },
  radioActive:       { borderColor: '#70c070', background: '#70c070' },
  chooseBtn: {
    padding: '6px 10px',
    background: 'rgba(80,180,80,0.1)',
    border: '1px solid #507050',
    borderRadius: 4,
    color: '#70c070',
    fontSize: 11,
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  },
  changeBtn: {
    padding: '3px 8px',
    background: 'none',
    border: '1px solid #3a3a5a',
    borderRadius: 4,
    color: '#7070a0',
    fontSize: 10,
    cursor: 'pointer',
    flexShrink: 0,
  },
  targetName: { fontSize: 12, color: '#70c070', fontWeight: 600, flex: 1 },
  readyText:  { fontSize: 11, color: '#70c070', fontWeight: 600, fontStyle: 'italic' },
}

// Chips inline pour les boutons de nombre d'attaques
function CountChip({ n, label, tooltip, selected, onClick }) {
  return (
    <div
      title={tooltip}
      onClick={onClick}
      style={{
        padding: '4px 8px', borderRadius: 3, cursor: 'pointer', fontSize: 10,
        border: `1px solid ${selected ? '#70c070' : '#2a3a2a'}`,
        background: selected ? 'rgba(112,192,112,0.15)' : 'rgba(255,255,255,0.02)',
        color: selected ? '#70c070' : '#7a9a7a',
        fontWeight: selected ? 600 : 400,
      }}
    >{label}</div>
  )
}

export default function MeleeCombatPanel({
  // Sélection arme — normalisée par le parent
  availableWeapons,    // [{ id, label, slot, damage, allonge }]
  selectedWeaponId,    // string | null (mains nues)
  isWeaponDrawn,       // bool — pour grisage (true pour GM car PNJ auto-géré)
  hasMeleeInInventory, // bool — hint Joueur (false pour GM)
  onWeaponChange,      // (id | null) => void

  // Arme naturelle (mutation) — docs/PLAN_MUTATION2.md Lot 4 sous-lot B. Exclusive avec
  // selectedWeaponId (radio group commun), gérée séparément par le parent.
  naturalWeapons = [],       // [{ id, label, formula, requiresGrapple }]
  selectedNaturalWeaponId,   // uuid | null
  onNaturalWeaponChange,     // (id | null) => void
  targetIsGrappled = false,  // bool — statut réel de la 1ʳᵉ cible sélectionnée (indicatif client)

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
      {/* Section Arme */}
      <div style={P.section}>
        <div style={P.sectionTitle}>{t('meleeCombatPanel.weaponSection')}</div>
        {/* Mains nues */}
        <div
          onClick={() => onWeaponChange(null)}
          style={{ ...P.option, cursor: 'pointer' }}
        >
          <div style={{ flex: 1 }}>
            <div style={P.optionLabel}>{t('meleeCombatPanel.bareHands')}</div>
            <div style={P.optionSub}>{t('meleeCombatPanel.bareHandsFormula')}</div>
          </div>
          <div style={{ ...P.radio, ...(selectedWeaponId === null ? P.radioActive : {}) }} />
        </div>
        {/* Armes de contact */}
        {availableWeapons.map(item => {
          const isSelected  = item.id === selectedWeaponId
          const weaponUsable = isWeaponDrawn
          return (
            <div
              key={item.id}
              title={weaponUsable ? undefined : t('meleeCombatPanel.weaponNotDrawnTitle')}
              onClick={() => weaponUsable && onWeaponChange(isSelected ? null : item.id)}
              style={{
                ...P.option,
                cursor: weaponUsable ? 'pointer' : 'not-allowed',
                opacity: weaponUsable ? 1 : 0.35,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={P.optionLabel}>{item.label}</div>
                <div style={P.optionSub}>
                  {item.slot}{item.damage ? ` · ${item.damage}` : ''}
                  {item.allonge > 0 ? ` · +${item.allonge}m allonge` : ''}
                </div>
              </div>
              <div style={{
                ...P.radio,
                ...(isSelected && weaponUsable ? P.radioActive : {}),
              }} />
            </div>
          )
        })}
        {availableWeapons.length === 0 && (
          <div style={{ fontSize: 11, color: '#70a070', fontStyle: 'italic', marginTop: 4 }}>
            {hasMeleeInInventory
              ? t('meleeCombatPanel.bareHandsOnlyStored')
              : t('meleeCombatPanel.bareHandsOnlyNone')}
          </div>
        )}
        {/* Armes naturelles (mutations) — docs/PLAN_MUTATION2.md Lot 4 sous-lot B */}
        {naturalWeapons.map(item => {
          const isSelected = item.id === selectedNaturalWeaponId
          const eligibilityArgs = { mutation: { natural_weapon_requires_grapple: item.requiresGrapple }, targetIsGrappled }
          const reasons  = getNaturalWeaponIneligibilityReasons(eligibilityArgs)
          const eligible = isNaturalWeaponEligible(eligibilityArgs)
          return (
            <div
              key={item.id}
              title={eligible ? undefined : t('meleeCombatPanel.actionImpossibleTitle', { reasons: reasons.join(', ') })}
              onClick={() => eligible && onNaturalWeaponChange(isSelected ? null : item.id)}
              style={{
                ...P.option,
                cursor: eligible ? 'pointer' : 'not-allowed',
                opacity: eligible ? 1 : 0.35,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={P.optionLabel}>{item.label}</div>
                <div style={P.optionSub}>{item.formula}</div>
              </div>
              <div style={{
                ...P.radio,
                ...(isSelected && eligible ? P.radioActive : {}),
              }} />
            </div>
          )
        })}
      </div>

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
          <div style={{ fontSize: 9, color: '#c8a030', marginTop: 4 }}>
            {t('meleeCombatPanel.chargeNeedsMove')}
          </div>
        )}
        {combatMode === 'charge' && chargeMoveDest && !chargeTargetLabel && (
          <div style={{ fontSize: 9, color: '#70c070', marginTop: 4 }}>
            {t('meleeCombatPanel.chargeMoveSelected')}
          </div>
        )}
        {combatMode === 'defensif' && (
          <div style={{ fontSize: 9, color: '#70c070', marginTop: 4 }}>
            {t('meleeCombatPanel.defensifHint')}
          </div>
        )}
        {combatMode === 'retraite' && (
          <div style={{ fontSize: 9, color: '#70c070', marginTop: 4 }}>
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
            <CountChip n={1} label={t('meleeCombatPanel.chip1.label')} tooltip={t('meleeCombatPanel.chip1.tooltip')} selected={meleeCount === 1} onClick={() => onMeleeCountChange(1, meleeCount)} />
            <CountChip n={2} label={t('meleeCombatPanel.chip2.label')} tooltip={t('meleeCombatPanel.chip2.tooltip')} selected={meleeCount === 2} onClick={() => onMeleeCountChange(2, meleeCount)} />
            <CountChip n={3} label={t('meleeCombatPanel.chip3.label')} tooltip={t('meleeCombatPanel.chip3.tooltip')} selected={meleeCount === 3} onClick={() => onMeleeCountChange(3, meleeCount)} />
          </div>
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
                        <span style={{ fontSize: 9, color: '#507050', minWidth: 12 }}>{i + 1}.</span>
                      )}
                      <span style={P.targetName}>{tgt.label}</span>
                      <button style={P.changeBtn} onClick={() => onChooseTarget(i)}>{t('common.changeButton')}</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {effectiveMeleeCount > 1 && (
                        <span style={{ fontSize: 9, color: '#507050', minWidth: 12 }}>{i + 1}.</span>
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
                <div style={{ fontSize: 9, color: '#70c070' }}>{t('meleeCombatPanel.targetModeHint')}</div>
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
                          <span style={{ fontSize: 8, color: '#3a6a3a', minWidth: 10 }}>{i + 1}.</span>
                        )}
                        <span style={{ fontSize: 11, color: '#70c870', fontWeight: 600 }}>{tgtToken?.label ?? '?'}</span>
                        <span style={{ fontSize: 8, color: '#507050', fontFamily: 'monospace' }}>{weaponLabel}</span>
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
          <div style={{ fontSize: 9, color: '#6a3a7a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('meleeCombatPanel.chargeSection')}</div>
          <div style={{ fontSize: 10, color: '#c890e8' }}>
            {chargeMoveDest ? t('meleeCombatPanel.destinationSet') : t('meleeCombatPanel.destinationPending')}
          </div>
          {chargeTargetLabel ? (
            <div style={{ fontSize: 11, color: '#c890e8', fontWeight: 600 }}>→ {chargeTargetLabel}</div>
          ) : (
            <div style={{ fontSize: 9, color: '#705070' }}>{t('meleeCombatPanel.targetPending')}</div>
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
