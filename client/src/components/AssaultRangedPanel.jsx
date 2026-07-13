import { CC_REPS_STEPS, RL_BUTTONS } from './combatSections.js'
import { AIM_MAX_TRANCHES, getAimBonusComp, getAimIniCost } from '../../../shared/combatExclusiveActions.js'

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
    color: '#e07070',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  infoText: { fontSize: 12, color: '#c0c0d0' },
  infoSub:  { fontSize: 10, color: '#5b5b7a' },
  noWeapon: { fontSize: 11, color: '#5b5b7a', fontStyle: 'italic' },
  targetName: { fontSize: 12, color: '#e07070', fontWeight: 600, flex: 1 },
  chooseBtn: {
    padding: '6px 10px',
    background: 'rgba(180,80,80,0.1)',
    border: '1px solid #c05050',
    borderRadius: 4,
    color: '#e07070',
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
  option: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 0',
    cursor: 'pointer',
    userSelect: 'none',
  },
  optionLabel: { fontSize: 12, color: '#c0c0d0', fontWeight: 500 },
  optionSub:   { fontSize: 10, color: '#5b5b7a' },
  radio: {
    width: 14, height: 14,
    borderRadius: '50%',
    border: '2px solid #3a3a5a',
    flexShrink: 0,
    boxSizing: 'border-box',
    transition: 'border-color 0.1s, background 0.1s',
  },
  radioActive: { borderColor: '#e07070', background: '#e07070' },
  slider:      { width: '100%', accentColor: '#e07070', cursor: 'pointer' },
  summaryText: { fontSize: 11, color: '#e07070', fontWeight: 600, fontStyle: 'italic' },
  optionDisabled: { opacity: 0.4, cursor: 'not-allowed' },
}

export default function AssaultRangedPanel({
  weaponDisplay,        // string | null — ex: "Glock-17 (MG)"
  weaponMdDisplay,      // string | null — dual wield 2nd weapon, null = masqué
  assaultTargetId,      // string | null
  getLabel,             // (tokenId) => string
  onChooseTarget,       // () => void
  showDualWieldSection, // bool — hasTwoWeapons && sameFirMode
  isDualWield,          // bool — état réel, câblé identique PJ (CombatActionWindow) et MJ (CombatGmDeclareWindow)
  currentFireMode,      // 'CC' | 'RC' | 'RL'
  onDualWieldChange,    // (bool) => void — setter réel des deux côtés
  assaultBulletCount,   // number | 'multi' | null
  effectiveBulletCount, // number — assaultBulletCount ?? 1 (calculé par le parent)
  assaultVariantAB,     // 'A' | 'B'
  ccSliderDisplayIdx,   // number (index dans CC_REPS_STEPS)
  currentVariant,       // { bulletCount, bonusComp, bonusDmg } | null — calculé par le parent
  dualWieldBonusComp,   // number (0 pour GM)
  onBulletCountChange,  // (count) => void
  onVariantABChange,    // (ab) => void
  aimTranches,          // number 0-5 (ou plus avec une Lunette) — Tir visé (0 = non utilisé)
  onAimTranchesChange,  // (n) => void
  aimIneligibilityReasons, // string[] — vide = éligible (shared/combatExclusiveActions.js)
  lunetteNiveau,        // number — niveau de la Lunette installée sur l'arme sélectionnée (0/undefined = aucune)
}) {
  const aimSliderMax = Math.max(AIM_MAX_TRANCHES, lunetteNiveau ?? 0)
  const fireModeLabel = { CC: 'Coup par coup', RC: 'Rafale courte', RL: 'Rafale longue' }[currentFireMode] ?? currentFireMode

  return (
    <>
      {/* Section Arme */}
      <div style={P.section}>
        <div style={P.sectionTitle}>Arme</div>
        {weaponDisplay ? (
          <div style={P.infoText}>
            {weaponDisplay}
            {weaponMdDisplay && (
              <span style={P.infoSub}>{' + '}{weaponMdDisplay}</span>
            )}
          </div>
        ) : (
          <div style={P.noWeapon}>Aucune arme équipée (MG/MD)</div>
        )}
      </div>

      {/* Section Cible */}
      <div style={P.section}>
        <div style={P.sectionTitle}>Cible</div>
        {assaultTargetId ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={P.targetName}>{getLabel(assaultTargetId)}</span>
            <button style={P.changeBtn} onClick={onChooseTarget}>Changer</button>
          </div>
        ) : (
          <button style={P.chooseBtn} onClick={onChooseTarget}>Choisir une cible</button>
        )}
      </div>

      {/* Section Type de tir — dual wield Joueur uniquement */}
      {showDualWieldSection && (
        <div style={P.section}>
          <div style={P.sectionTitle}>Type de tir</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="seg-opt"
              data-active={!isDualWield}
              style={{ flex: 1 }}
              onClick={() => onDualWieldChange(false)}
            >Simple</button>
            <button
              className="seg-opt"
              data-active={isDualWield}
              style={{ flex: 1 }}
              onClick={() => onDualWieldChange(true)}
            >Double +{currentFireMode === 'RL' ? 5 : 3}</button>
          </div>
        </div>
      )}

      {/* Section mode de tir — CC / RC / RL */}
      {weaponDisplay && currentFireMode && (
        <div style={P.section}>
          <div style={P.sectionTitle}>{fireModeLabel}</div>

          {currentFireMode === 'CC' && (
            <>
              <div
                style={P.option}
                onClick={() => { onBulletCountChange(1); onVariantABChange('A'); onAimTranchesChange(0) }}
              >
                <div>
                  <div style={P.optionLabel}>Tir simple</div>
                  <div style={P.optionSub}>1 balle : +0</div>
                </div>
                <span style={{ ...P.radio, ...(effectiveBulletCount === 1 && !aimTranches ? P.radioActive : {}) }} />
              </div>

              {/* Tir visé (LdB p.227-228, docs/PLAN_TIRVISE.md) — action exclusive, immobile,
                  1 balle. Grisé + tooltip listant les raisons tant qu'inéligible
                  (shared/combatExclusiveActions.js, source unique client + serveur). */}
              {(() => {
                const aimDisabled = aimIneligibilityReasons.length > 0
                return (
                  <div
                    style={{ ...P.option, ...(aimDisabled ? P.optionDisabled : {}) }}
                    title={aimDisabled ? `Action impossible car : ${aimIneligibilityReasons.join(', ')}` : undefined}
                    onClick={() => {
                      if (aimDisabled) return
                      onBulletCountChange(1); onVariantABChange('A')
                      onAimTranchesChange(aimTranches > 0 ? aimTranches : 1)
                    }}
                  >
                    <div>
                      <div style={P.optionLabel}>Tir visé</div>
                      <div style={P.optionSub}>
                        1 balle, immobile — +1 test / 2 INI sacrifiés (max +5)
                        {lunetteNiveau > 0 ? ` — Lunette niv.${lunetteNiveau} : +1 test / 1 INI (max +${lunetteNiveau})` : ''}
                      </div>
                    </div>
                    <span style={{ ...P.radio, ...(aimTranches > 0 ? P.radioActive : {}) }} />
                  </div>
                )
              })()}
              {aimTranches > 0 && (
                <>
                  <input
                    type="range" min={1} max={aimSliderMax} step={1}
                    value={aimTranches}
                    style={P.slider}
                    onChange={e => onAimTranchesChange(Number(e.target.value))}
                  />
                  <div style={P.summaryText}>
                    {aimTranches} tranche{aimTranches > 1 ? 's' : ''} ({getAimIniCost(aimTranches, { lunetteNiveau })} INI) : +{getAimBonusComp(aimTranches, { lunetteNiveau })} test
                  </div>
                </>
              )}

              <div
                style={P.option}
                onClick={() => {
                  if (!assaultBulletCount || assaultBulletCount === 1) onBulletCountChange(2)
                  onAimTranchesChange(0)
                }}
              >
                <div style={P.optionLabel}>Tir à répétition</div>
                <span style={{ ...P.radio, ...(assaultBulletCount && assaultBulletCount !== 1 ? P.radioActive : {}) }} />
              </div>
              {assaultBulletCount && assaultBulletCount !== 1 && (
                <>
                  <input
                    type="range" min={0} max={CC_REPS_STEPS.length - 1} step={1}
                    value={ccSliderDisplayIdx}
                    style={P.slider}
                    onChange={e => {
                      const count = CC_REPS_STEPS[Number(e.target.value)]
                      onBulletCountChange(count)
                      if (count !== 7 && count !== 10) onVariantABChange('A')
                    }}
                  />
                  {(assaultBulletCount === 7 || assaultBulletCount === 10) && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        className="seg-opt"
                        data-active={assaultVariantAB === 'A'}
                        style={{ flex: 1 }}
                        onClick={() => onVariantABChange('A')}
                      >+{assaultBulletCount === 7 ? 4 : 5} comp</button>
                      <button
                        className="seg-opt"
                        data-active={assaultVariantAB === 'B'}
                        style={{ flex: 1 }}
                        onClick={() => onVariantABChange('B')}
                      >+{assaultBulletCount === 7 ? 3 : 4} comp / +3 dég</button>
                    </div>
                  )}
                </>
              )}
              {assaultBulletCount && assaultBulletCount !== 1 && currentVariant && (
                <div style={P.summaryText}>
                  {effectiveBulletCount} balle{effectiveBulletCount > 1 ? 's' : ''} : +{currentVariant.bonusComp + dualWieldBonusComp} test
                  {currentVariant.bonusDmg > 0 ? ` / +${currentVariant.bonusDmg} dég` : ''}
                </div>
              )}
            </>
          )}

          {currentFireMode === 'RC' && (
            <>
              <div style={P.option}>
                <div>
                  <div style={P.optionLabel}>Rafale courte</div>
                  <div style={P.optionSub}>3 balles : +3 test / +5 dég (courte portée)</div>
                </div>
                <span style={{ ...P.radio, ...P.radioActive }} />
              </div>
              <div style={P.summaryText}>
                3 balles : +{3 + dualWieldBonusComp} test (ou +5 dég à courte portée)
              </div>
            </>
          )}

          {currentFireMode === 'RL' && (
            <>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {RL_BUTTONS.map(btn => (
                  <button
                    key={btn.value}
                    className="seg-opt"
                    data-active={assaultBulletCount === btn.value}
                    style={{ flex: 1 }}
                    onClick={() => onBulletCountChange(btn.value)}
                  >{btn.label}</button>
                ))}
              </div>
              {currentVariant && (
                <div style={P.summaryText}>
                  {assaultBulletCount === 'multi'
                    ? 'Multi-cibles : +0 test / zone 3m'
                    : `${assaultBulletCount} balles : +${currentVariant.bonusComp + dualWieldBonusComp} test / +${currentVariant.bonusDmg} dég`
                  }
                </div>
              )}
              {!assaultBulletCount && (
                <div style={{ fontSize: 9, color: '#706050', fontStyle: 'italic' }}>Sélectionnez un volume de tir</div>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}
