import { useTranslation } from 'react-i18next'
import { CC_REPS_STEPS, RL_BUTTONS } from './combatSections.js'
import { AIM_MAX_TRANCHES, getAimBonusComp, getAimIniCost } from '../../../shared/combatExclusiveActions.js'
import AimedLocationPicker from './AimedLocationPicker.jsx'

// Chips inline pour le nombre de tirs. D4b : la sélection = accent de famille (`--decl-acc`),
// jamais un rouge (réservé à l'erreur). Fallbacks pour un rendu hors `[data-decl]`.
function ShotCountChip({ label, tooltip, selected, disabled, onClick }) {
  return (
    <div
      title={tooltip}
      onClick={disabled ? undefined : onClick}
      style={{
        padding: '4px 8px', borderRadius: 3, cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 10,
        border: `1px solid ${selected ? 'var(--decl-acc, #8aa0b8)' : 'var(--decl-line, #2a2a3e)'}`,
        background: selected ? 'var(--decl-acc-bg, rgba(255,255,255,0.06))' : 'rgba(255,255,255,0.02)',
        color: disabled ? 'var(--decl-text-dim, #5b5b7a)' : (selected ? 'var(--decl-acc, #c8d4e0)' : 'var(--decl-text, #9aa4b0)'),
        fontWeight: selected ? 600 : 400,
        opacity: disabled ? 0.5 : 1,
      }}
    >{label}</div>
  )
}

// D4b : rouge/vert réservés à erreur/succès. Ici, sélection + états actifs = accent de famille
// (`--decl-acc`) ; libellés = tokens neutres `--decl-*`. Fallbacks = gris neutres (rendu hors teinte).
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
    color: 'var(--decl-label, #8aa0b8)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  infoText: { fontSize: 12, color: 'var(--decl-text, #c0c0d0)' },
  infoSub:  { fontSize: 10, color: 'var(--decl-text-dim, #5b5b7a)' },
  noWeapon: { fontSize: 11, color: 'var(--decl-text-dim, #5b5b7a)', fontStyle: 'italic' },
  targetName: { fontSize: 12, color: 'var(--decl-acc, #c8d4e0)', fontWeight: 600, flex: 1 },
  chooseBtn: {
    padding: '6px 10px',
    background: 'var(--decl-acc-bg, rgba(255,255,255,0.05))',
    border: '1px solid var(--decl-acc-line, #4a5568)',
    borderRadius: 4,
    color: 'var(--decl-acc, #c8d4e0)',
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
  option: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 0',
    cursor: 'pointer',
    userSelect: 'none',
  },
  optionLabel: { fontSize: 12, color: 'var(--decl-text, #c0c0d0)', fontWeight: 500 },
  optionSub:   { fontSize: 10, color: 'var(--decl-text-dim, #5b5b7a)' },
  radio: {
    width: 14, height: 14,
    borderRadius: '50%',
    border: '2px solid var(--decl-line, #3a3a5a)',
    flexShrink: 0,
    boxSizing: 'border-box',
    transition: 'border-color 0.1s, background 0.1s',
  },
  radioActive: { borderColor: 'var(--decl-acc, #8aa0b8)', background: 'var(--decl-acc, #8aa0b8)' },
  slider:      { width: '100%', accentColor: 'var(--decl-acc, #8aa0b8)', cursor: 'pointer' },
  summaryText: { fontSize: 11, color: 'var(--decl-acc, #c8d4e0)', fontWeight: 600, fontStyle: 'italic' },
  optionDisabled: { opacity: 0.4, cursor: 'not-allowed' },
}

export default function AssaultRangedPanel({
  weaponDisplay,        // string | null — gate d'affichage (l'arme est nommée en col. 1, plus rendue ici)
  targetIds,            // string[] — cibles sélectionnées, une par tir de la série (docs/PLAN_TIRMULTI.md)
  getLabel,             // (tokenId) => string
  onChooseTarget,       // (index) => void
  showDualWieldSection, // bool — hasTwoWeapons && sameFirMode && effectiveAssaultCount === 1 (D10)
  isDualWield,          // bool — état réel, câblé identique PJ (CombatActionWindow) et MJ (CombatGmDeclareWindow)
  currentFireMode,      // 'CC' | 'RC' | 'RL'
  availableFireModes,   // string[] ex ['cc','rc'] — modes que l'arme supporte (D7, sélecteur en col. 2)
  onFireModeChange,     // (v: 'cc'|'rc'|'rl') => void
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
  aimedLocation,        // string | null — Viser une Localisation précise (COM9, docs/PLAN_TIRVISE v2.md)
  onAimedLocationChange, // (loc | null) => void
  // Tir Multi (docs/PLAN_TIRMULTI.md) — série de 1 à 3 tirs, malus -5/2 tirs ou -7/3 tirs (LdB p.218)
  // assaultCount (brut) volontairement non déstructuré ici — seul effectiveAssaultCount (calculé par
  // le parent) pilote ce panneau, cf. I18N-LINT2. Le parent continue de le passer sans effet.
  effectiveAssaultCount,    // 1 | 2 | 3 — 1 si currentFireMode !== 'CC' (D6, calculé par le parent)
  onAssaultCountChange,     // (n) => void
  multiShotIneligibilityReasons, // string[] — vide = éligible (shared/combatExclusiveActions.js)
  // Zone d'effet (PLAN_ARMES_SPECIALES.md §1.6) — `isAoeEligible` ne dépend que de l'arme équipée,
  // calculé par le parent via `shared/combatAoe.js#isAoeWeapon(weapon.ref_aoe_profile)` (donnée
  // catalogue). Voir le early return juste après la déstructuration.
  isAoeEligible,   // bool — calculé par le parent
  isAoeMode,       // bool — assaultDecl.isAoeMode (aoeDirection posé)
  aoeDirection,    // number | null — degrés, convention aoeShapes.js (0° = +X, trigo → +Z)
  onStartAoeDirection, // () => void — arme combatAoeTargetMode (Canvas3D)
}) {
  const { t } = useTranslation('combat')
  const aimSliderMax = Math.max(AIM_MAX_TRANCHES, lunetteNiveau ?? 0)
  const fireModeLabelKey = { CC: 'states.fireMode.cc.label', RC: 'states.fireMode.rc.label', RL: 'states.fireMode.rl.label' }[currentFireMode]
  const fireModeLabel = fireModeLabelKey ? t(fireModeLabelKey) : currentFireMode
  const multiShotDisabled = multiShotIneligibilityReasons.length > 0

  // Zone d'effet fusil à pompe (PLAN_AOE.md §8 étape 9, redesign 2026-09-02) — RAW : le Klauss n'a
  // AUCUN mode de tir normal, la dispersion est obligatoire à chaque tir, jamais un choix parmi
  // d'autres (retour Saar, corrigeant la v1 "Zone = option à côté du ciblage classique"). Une arme
  // éligible bascule donc TOUTE la colonne Tir sur la seule section Zone d'effet ci-dessous — Tir
  // Multi/Type de tir/détail CC-RC-RL/Localisation visée n'ont pas de sens pour elle et ne s'affichent
  // simplement plus, ce n'est pas une exclusivité à arbitrer (pas de bouton grisé, pas de raisons).
  if (isAoeEligible) {
    return (
      <div style={P.section}>
        <div style={{ ...P.sectionTitle, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="decl-inline-glyph" style={{ '--glyph': 'url(/assets/status/target.svg)' }} />
          {t('assaultPanel.aoeSection')}
        </div>
        {isAoeMode ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={P.targetName}>{t('assaultPanel.aoeDirectionValue', { deg: Math.round(aoeDirection) })}</span>
            <button style={P.changeBtn} onClick={onStartAoeDirection}>{t('common.changeButton')}</button>
          </div>
        ) : (
          <button style={{ ...P.chooseBtn, width: 'auto', alignSelf: 'flex-start' }} onClick={onStartAoeDirection}>
            {t('assaultPanel.aimAoeButton')}
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Rappel d'arme retiré (D5 : l'arme sélectionnée est déjà en tête de la col. 1). */}

      {/* Section Nombre de tirs — Tir Multi (docs/PLAN_TIRMULTI.md), CC uniquement (D6) */}
      {currentFireMode === 'CC' && (
        <div style={P.section}>
          <div style={P.sectionTitle}>{t('assaultPanel.shotCountSection')}</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <ShotCountChip label={t('assaultPanel.chip1.label')} tooltip={t('assaultPanel.chip1.tooltip')} selected={effectiveAssaultCount === 1} onClick={() => onAssaultCountChange(1)} />
            <ShotCountChip label={t('assaultPanel.chip2.label')} tooltip={multiShotDisabled ? t('assaultPanel.unavailableReasons', { reasons: multiShotIneligibilityReasons.join(', ') }) : t('assaultPanel.chip2.tooltip')} selected={effectiveAssaultCount === 2} disabled={multiShotDisabled} onClick={() => onAssaultCountChange(2)} />
            <ShotCountChip label={t('assaultPanel.chip3.label')} tooltip={multiShotDisabled ? t('assaultPanel.unavailableReasons', { reasons: multiShotIneligibilityReasons.join(', ') }) : t('assaultPanel.chip3.tooltip')} selected={effectiveAssaultCount === 3} disabled={multiShotDisabled} onClick={() => onAssaultCountChange(3)} />
          </div>
        </div>
      )}

      {/* Section Cible(s) — une par tir de la série. Tant qu'aucune cible n'a encore été choisie, un
          seul bouton suffit : le premier choix remplit toute la série (comportement par défaut demandé
          par Saar — ne pas forcer N clics sur la même cible pour le cas courant). Une fois au moins une
          cible posée, chaque tir affiche son propre slot avec "Changer" pour permettre de diverger. */}
      <div style={P.section}>
        <div style={{ ...P.sectionTitle, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="decl-inline-glyph" style={{ '--glyph': 'url(/assets/status/target.svg)' }} />
          {effectiveAssaultCount === 1 ? t('common.targetSection') : t('meleeCombatPanel.targetsCount', { count: targetIds.filter(Boolean).length, total: effectiveAssaultCount })}
        </div>
        {targetIds.filter(Boolean).length === 0 ? (
          <button style={{ ...P.chooseBtn, width: 'auto', alignSelf: 'flex-start' }} onClick={() => onChooseTarget(0)}>{t('common.chooseTargetButton')}</button>
        ) : (
          Array.from({ length: effectiveAssaultCount }, (_, i) => {
            const tgtId = targetIds[i] ?? null
            return (
              <div key={i} style={{ marginBottom: i < effectiveAssaultCount - 1 ? 4 : 0 }}>
                {tgtId ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {effectiveAssaultCount > 1 && (
                      <span style={{ fontSize: 9, color: 'var(--decl-text-dim, #705050)', minWidth: 12 }}>{i + 1}.</span>
                    )}
                    <span style={P.targetName}>{getLabel(tgtId)}</span>
                    <button style={P.changeBtn} onClick={() => onChooseTarget(i)}>{t('common.changeButton')}</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {effectiveAssaultCount > 1 && (
                      <span style={{ fontSize: 9, color: 'var(--decl-text-dim, #705050)', minWidth: 12 }}>{i + 1}.</span>
                    )}
                    <button style={P.chooseBtn} onClick={() => onChooseTarget(i)}>{t('common.chooseTargetButton')}</button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Section Type de tir — dual wield Joueur uniquement, exclusif avec Tir Multi (D10) */}
      {showDualWieldSection && effectiveAssaultCount === 1 && (
        <div style={P.section}>
          <div style={P.sectionTitle}>{t('assaultPanel.fireTypeSection')}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="seg-opt"
              data-active={!isDualWield}
              style={{ flex: 1 }}
              onClick={() => onDualWieldChange(false)}
            >{t('assaultPanel.simple')}</button>
            <button
              className="seg-opt"
              data-active={isDualWield}
              style={{ flex: 1 }}
              onClick={() => onDualWieldChange(true)}
            >{t('assaultPanel.double', { bonus: currentFireMode === 'RL' ? 5 : 3 })}</button>
          </div>
        </div>
      )}

      {/* Section mode de tir — sélecteur CC / RC / RL (D7 : au corps de la col. 2) + détail du mode */}
      {weaponDisplay && currentFireMode && (
        <div style={P.section}>
          {Array.isArray(availableFireModes) && availableFireModes.length > 1 && (
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              {['cc', 'rc', 'rl'].filter(m => availableFireModes.includes(m)).map(m => (
                <button
                  key={m}
                  className="seg-opt"
                  data-active={currentFireMode === m.toUpperCase()}
                  style={{ flex: 1 }}
                  onClick={() => onFireModeChange?.(m)}
                >{t(`states.fireMode.${m}.label`)}</button>
              ))}
            </div>
          )}
          <div style={P.sectionTitle}>{fireModeLabel}</div>

          {currentFireMode === 'CC' && (
            <>
              <div
                style={P.option}
                onClick={() => { onBulletCountChange(1); onVariantABChange('A'); onAimTranchesChange(0) }}
              >
                <div>
                  <div style={P.optionLabel}>{t('assaultPanel.simpleShot.label')}</div>
                  <div style={P.optionSub}>{t('assaultPanel.simpleShot.detail')}</div>
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
                    title={aimDisabled ? t('assaultPanel.aimedShot.impossibleTitle', { reasons: aimIneligibilityReasons.join(', ') }) : undefined}
                    onClick={() => {
                      if (aimDisabled) return
                      onBulletCountChange(1); onVariantABChange('A')
                      onAimTranchesChange(aimTranches > 0 ? aimTranches : 1)
                    }}
                  >
                    <div>
                      <div style={P.optionLabel}>{t('assaultPanel.aimedShot.label')}</div>
                      <div style={P.optionSub}>
                        {t('assaultPanel.aimedShot.detail')}
                        {lunetteNiveau > 0 ? t('assaultPanel.aimedShot.scopeDetail', { level: lunetteNiveau }) : ''}
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
                    {t('assaultPanel.aimedShot.summary', { count: aimTranches, cost: getAimIniCost(aimTranches, { lunetteNiveau }), bonus: getAimBonusComp(aimTranches, { lunetteNiveau }) })}
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
                <div style={P.optionLabel}>{t('assaultPanel.repeatShot')}</div>
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
                      >{t('assaultPanel.variantComp', { comp: assaultBulletCount === 7 ? 4 : 5 })}</button>
                      <button
                        className="seg-opt"
                        data-active={assaultVariantAB === 'B'}
                        style={{ flex: 1 }}
                        onClick={() => onVariantABChange('B')}
                      >{t('assaultPanel.variantCompDmg', { comp: assaultBulletCount === 7 ? 3 : 4 })}</button>
                    </div>
                  )}
                </>
              )}
              {assaultBulletCount && assaultBulletCount !== 1 && currentVariant && (
                <div style={P.summaryText}>
                  {t('assaultPanel.repeatSummary', { count: effectiveBulletCount, comp: currentVariant.bonusComp + dualWieldBonusComp })}
                  {currentVariant.bonusDmg > 0 ? t('assaultPanel.dmgSuffix', { dmg: currentVariant.bonusDmg }) : ''}
                </div>
              )}
            </>
          )}

          {currentFireMode === 'RC' && (
            <>
              <div style={P.option}>
                <div>
                  <div style={P.optionLabel}>{t('states.fireMode.rc.label')}</div>
                  <div style={P.optionSub}>{t('assaultPanel.rcDetail')}</div>
                </div>
                <span style={{ ...P.radio, ...P.radioActive }} />
              </div>
              <div style={P.summaryText}>
                {t('assaultPanel.rcSummary', { comp: 3 + dualWieldBonusComp })}
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
                  >{t(btn.label)}</button>
                ))}
              </div>
              {currentVariant && (
                <div style={P.summaryText}>
                  {assaultBulletCount === 'multi'
                    ? t('assaultPanel.rlMultiTarget')
                    : t('assaultPanel.rlSummary', { count: assaultBulletCount, comp: currentVariant.bonusComp + dualWieldBonusComp, dmg: currentVariant.bonusDmg })
                  }
                </div>
              )}
              {!assaultBulletCount && (
                <div style={{ fontSize: 9, color: 'var(--decl-text-dim, #706050)', fontStyle: 'italic' }}>{t('assaultPanel.selectVolume')}</div>
              )}
            </>
          )}
        </div>
      )}

      {/* Section Viser une localisation (LdB p.229-230, COM9, docs/PLAN_TIRVISE v2.md) — malus au
          Test pour choisir la zone au lieu du 1D20 aléatoire. Pas de condition d'éligibilité propre
          (contrairement à Tir visé), mais exclusif avec Tir Multi (docs/PLAN_TIRMULTI.md D10,
          tranché Saar) : masqué tant qu'une série de plusieurs tirs est active. */}
      {weaponDisplay && effectiveAssaultCount === 1 && (
        <div style={P.section}>
          <div style={P.sectionTitle}>{t('assaultPanel.aimedLocationSection')}</div>
          <AimedLocationPicker aimedLocation={aimedLocation} onChange={onAimedLocationChange} />
        </div>
      )}
    </>
  )
}
