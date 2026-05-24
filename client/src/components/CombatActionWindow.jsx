import { useState, useEffect } from 'react'
import { WS } from '../../../shared/events.js'
import { calcAN, calcAllures } from '../../../shared/polarisUtils.js'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'
import api from '../lib/api.js'
import { KEY_MOD, SECTIONS, MOVE_ZONE_DEFS, formatMod } from './combatSections.js'

// Variants de mode de tir — source : Polaris LdB p.227-228
const FIRE_MODE_VARIANTS = {
  CC: [
    { id: 'cc_1',   bulletCount: 1,  bonusComp: 0, bonusDmg: 0 },
    { id: 'cc_2',   bulletCount: 2,  bonusComp: 1, bonusDmg: 0 },
    { id: 'cc_3',   bulletCount: 3,  bonusComp: 2, bonusDmg: 0 },
    { id: 'cc_4',   bulletCount: 4,  bonusComp: 3, bonusDmg: 0 },
    { id: 'cc_7a',  bulletCount: 7,  bonusComp: 4, bonusDmg: 0 },
    { id: 'cc_7b',  bulletCount: 7,  bonusComp: 3, bonusDmg: 3 },
    { id: 'cc_10a', bulletCount: 10, bonusComp: 5, bonusDmg: 0 },
    { id: 'cc_10b', bulletCount: 10, bonusComp: 4, bonusDmg: 3 },
  ],
  RC: [
    { id: 'rc_3',   bulletCount: 3,  bonusComp: 3, bonusDmg: 5 },
  ],
  RL: [
    { id: 'rl_5',   bulletCount: 5,  bonusComp: 2, bonusDmg: 2 },
    { id: 'rl_10',  bulletCount: 10, bonusComp: 4, bonusDmg: 4 },
    { id: 'rl_15',  bulletCount: 15, bonusComp: 6, bonusDmg: 6 },
    { id: 'rl_20',  bulletCount: 20, bonusComp: 8, bonusDmg: 8 },
    { id: 'rl_mc',  bulletCount: 5,  bonusComp: 0, bonusDmg: 0 },
  ],
}

// Libellés modes de tir (pour l'en-tête section cadence)
const FIRE_MODE_LABELS = {
  CC: 'Coup par coup',
  RC: 'Rafale courte',
  RL: 'Rafale longue',
}

// Valeurs discrètes pour le slider CC "Tir à répétition"
const CC_REPS_STEPS = [2, 3, 4, 7, 10]

// Valeurs discrètes pour les boutons RL
const RL_BUTTONS = [
  { value: 5,       label: '5b' },
  { value: 10,      label: '10b' },
  { value: 15,      label: '15b' },
  { value: 20,      label: '20b' },
  { value: 'multi', label: 'Multi' },
]

export default function CombatActionWindow({ socket, user, characters, pendingSurpriseRoll, onSurpriseRolled, onEnterMoveMode, onEnterTargetMode }) {
  const { roster, phase, activeSlotIdx, actions } = useCombatStore()
  const tokens = useTokenStore(s => s.tokens)
  const [selectedKeys, setSelectedKeys] = useState(new Set())
  const [allures, setAllures] = useState(null)
  const [inMoveMode, setInMoveMode] = useState(false)
  const [moveSelection, setMoveSelection] = useState(null)

  // État sous-panneau assaut
  const [assaultWeapons, setAssaultWeapons] = useState([])
  const [assaultPendingTokenId, setAssaultPendingTokenId] = useState(null)
  const [assaultBulletCount, setAssaultBulletCount] = useState(null)  // number | 'multi' | null
  const [assaultVariantAB, setAssaultVariantAB] = useState('A')       // 'A' | 'B' — pour cc_7/cc_10
  const [isDualWield, setIsDualWield] = useState(false)
  const [inTargetMode, setInTargetMode] = useState(false)

  const playerChar = characters.find(c => c.user_id === user?.id)
  const playerToken = tokens.find(t => t.character_id === playerChar?.id)
  const rosterEntry = playerToken ? roster.find(r => r.token_id === playerToken.id) : null

  // Fetch allures dès que playerChar est disponible
  useEffect(() => {
    if (!playerChar?.id) return
    let cancelled = false
    const load = async () => {
      try {
        const [sheetRes, genoRes] = await Promise.all([
          api.get(`/char-sheet/${playerChar.id}`),
          api.get('/char-ref/genotypes'),
        ])
        if (cancelled) return
        const { archetype, attributes, skills } = sheetRes.data
        const genotype = genoRes.data.genotypes?.find(g => g.id === archetype?.genotype_id) || {}
        const findAttr = (id) => attributes?.find(a => a.attr_id === id) || {}
        const calcNA = (id, modField) => Math.max(3,
          (findAttr(id).base_level ?? 7) + (findAttr(id).pc_modifier ?? 0) + (genotype[modField] || 0)
        )
        const coo_na = calcNA('COO', 'mod_coo')
        const for_na = calcNA('FOR', 'mod_for')
        const mastery = skills?.find(s => s.skill_id === 'ATHLETISME')?.mastery ?? 0
        const athletisme_total = calcAN(for_na) + calcAN(coo_na) + mastery
        setAllures(calcAllures(coo_na, athletisme_total))
      } catch (e) {
        console.error('[CombatActionWindow] erreur fetch allures :', e)
      }
    }
    load()
    return () => { cancelled = true }
  }, [playerChar?.id])

  // Fetch armes équipées (MG/MD) pour le sous-panneau assaut
  useEffect(() => {
    if (!playerChar?.id) return
    let cancelled = false
    api.get(`/char-sheet/${playerChar.id}/inventory`).then(res => {
      if (cancelled) return
      const weapons = (res.data.items || []).filter(
        item => (item.slot === 'MG' || item.slot === 'MD') && item.ref_fire_mode
      )
      setAssaultWeapons(weapons)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [playerChar?.id])

  // Armes rechargées → reset état assaut
  useEffect(() => {
    setAssaultBulletCount(null)
    setAssaultVariantAB('A')
    setIsDualWield(false)
  }, [assaultWeapons])

  if (!playerToken || !rosterEntry) return null

  // Phase Résolution — tri identique CombatTimeline (initiative DESC)
  const sorted = [...roster].sort((a, b) => b.initiative - a.initiative)
  const isMyTurnInResolution = phase === 'RESOLUTION' && sorted[activeSlotIdx]?.token_id === playerToken.id
  const myActions = actions.filter(a => a.token_id === playerToken.id)

  // ─── Dérivés assaut ────────────────────────────────────────────────────────
  const weaponMg = assaultWeapons.find(w => w.slot === 'MG') || null
  const weaponMd = assaultWeapons.find(w => w.slot === 'MD') || null
  const hasTwoWeapons = !!(weaponMg && weaponMd)
  const sameFirMode = hasTwoWeapons && weaponMg.ref_fire_mode === weaponMd.ref_fire_mode
  const forceCC = hasTwoWeapons && !sameFirMode
  const selectedWeapon = weaponMg || weaponMd || null
  const assaultWeaponId = selectedWeapon?.id ?? null

  // Mode actuel — dérivé du ref_fire_mode de l'arme (premier mode)
  // forceCC = 2 armes modes différents → on impose CC (LdB p.228)
  // "Changer le mode de tir" remplacera ce défaut dans un sprint futur
  const fireModes = (selectedWeapon?.ref_fire_mode || '').split('/').map(s => s.trim()).filter(Boolean)
  const currentFireMode = forceCC ? 'CC' : (fireModes[0] || null)

  // Variant sélectionné selon le mode + bullet count + A/B
  let currentVariant = null
  if (currentFireMode === 'RC') {
    currentVariant = FIRE_MODE_VARIANTS.RC[0]  // unique option — auto-sélectionné
  } else if (currentFireMode === 'CC' && assaultBulletCount) {
    if (assaultBulletCount === 7) {
      currentVariant = FIRE_MODE_VARIANTS.CC.find(v => v.id === (assaultVariantAB === 'B' ? 'cc_7b' : 'cc_7a'))
    } else if (assaultBulletCount === 10) {
      currentVariant = FIRE_MODE_VARIANTS.CC.find(v => v.id === (assaultVariantAB === 'B' ? 'cc_10b' : 'cc_10a'))
    } else {
      currentVariant = FIRE_MODE_VARIANTS.CC.find(v => v.bulletCount === assaultBulletCount)
    }
  } else if (currentFireMode === 'RL' && assaultBulletCount) {
    currentVariant = assaultBulletCount === 'multi'
      ? FIRE_MODE_VARIANTS.RL.find(v => v.id === 'rl_mc')
      : FIRE_MODE_VARIANTS.RL.find(v => v.bulletCount === assaultBulletCount)
  }

  // Bonus tir double : +3 CC/RC, +5 RL (LdB p.228)
  const dualWieldBonusComp = (isDualWield && hasTwoWeapons && sameFirMode)
    ? (currentFireMode === 'RL' ? 5 : 3)
    : 0

  const pendingTargetToken = assaultPendingTokenId
    ? tokens.find(t => t.id === assaultPendingTokenId)
    : null

  const handleToggle = (key) => {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
        if (key === 'assault') {
          setAssaultPendingTokenId(null)
          setAssaultBulletCount(null)
          setAssaultVariantAB('A')
          setIsDualWield(false)
          setInTargetMode(false)
        }
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleVarChange = (oldKey, newKey) => {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (oldKey) next.delete(oldKey)
      next.add(newKey)
      return next
    })
  }

  const handleZoneSelectClick = (item) => {
    if (moveSelection?.sourceKey === item.key) { setMoveSelection(null); return }
    const zones = item.staticZones !== null
      ? item.staticZones
      : MOVE_ZONE_DEFS.map(def => ({
          radius: allures[def.allureKey],
          action_key: def.action_key,
          ini_mod: def.ini_mod,
          color: def.color,
          label: def.label,
        }))
    const onSelected = (sel) => { setMoveSelection({ ...sel, sourceKey: item.key }); setInMoveMode(false) }
    const onCancel = () => { setInMoveMode(false) }
    setInMoveMode(true)
    setMoveSelection(null)
    onEnterMoveMode(zones, playerToken.id, { x: playerToken.pos_x, z: playerToken.pos_y }, onSelected, onCancel)
  }

  const handleChooseTarget = () => {
    setInTargetMode(true)
    setAssaultPendingTokenId(null)
    onEnterTargetMode(
      playerToken.id,
      { x: playerToken.pos_x, z: playerToken.pos_y },
      (tokenId) => { setAssaultPendingTokenId(tokenId); setInTargetMode(false) },
      () => { setInTargetMode(false) }
    )
  }

  const totalMod = [...selectedKeys].reduce((sum, k) => sum + (KEY_MOD[k] ?? 0), 0)
    + (moveSelection?.ini_mod ?? 0)

  const assaultSelected = selectedKeys.has('assault')
  const assaultValid = !assaultSelected || (
    assaultWeaponId != null &&
    assaultPendingTokenId != null &&
    currentVariant != null
  )
  const canDeclare = (selectedKeys.size > 0 || moveSelection !== null) && assaultValid

  const handleDeclare = () => {
    if (!socket || !playerToken || !canDeclare) return
    socket.emit(WS.COMBAT_ACTION_DECLARE, {
      tokenId:             playerToken.id,
      selectedKeys:        Array.from(selectedKeys),
      moveAction:          moveSelection ?? undefined,
      weaponInvId:         assaultWeaponId ?? null,
      targetTokenId:       assaultPendingTokenId ?? null,
      fireMode:            currentFireMode ?? null,
      bulletCount:         currentVariant?.bulletCount ?? null,
      fireModeBonusComp:   currentVariant ? (currentVariant.bonusComp + dualWieldBonusComp) : null,
      fireModeBonusDmg:    currentVariant?.bonusDmg ?? null,
      isDualWield:         isDualWield && hasTwoWeapons && sameFirMode,
      dualWieldBonusComp:  dualWieldBonusComp,
    })
  }

  // Mode jet de surprise
  if (pendingSurpriseRoll?.tokenId === playerToken.id) {
    return (
      <div style={styles.window}>
        <div style={styles.header}>⚠ Surprise !</div>
        <p style={styles.surpriseText}>
          Vous êtes surpris. Lancez 1d20 pour déterminer votre initiative.
        </p>
        <button style={styles.btnRoll} onClick={onSurpriseRolled}>
          Lancer le dé d'initiative
        </button>
      </div>
    )
  }

  // Surprise échouée
  if (rosterEntry.is_surprised && rosterEntry.has_announced && rosterEntry.initiative === 0) {
    return (
      <div style={styles.window}>
        <div style={styles.header}>⚠ Surprise !</div>
        <p style={styles.surpriseText}>
          Vous êtes surpris — vous ne pouvez pas agir ce tour.
        </p>
      </div>
    )
  }

  // Phase 2 — Résolution : slot actif = c'est mon tour d'agir
  if (isMyTurnInResolution) {
    return (
      <div style={styles.window}>
        <div style={styles.header}>Phase 2 - Résolution</div>
        <div style={styles.body}>
          <div style={styles.leftPanel}>
            {myActions.map(a => (
              <div key={a.id} style={{ padding: '6px 14px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e1e2e' }}>
                <span style={styles.itemLabel}>{a.action_key}</span>
                <span style={styles.itemMod}>{a.modifiers?.ini_mod ?? ''}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={styles.footer}>
          <button
            style={styles.btnDeclare}
            onClick={() => socket?.emit(WS.COMBAT_ACTION_CONFIRM, { tokenId: playerToken.id })}
          >
            Agir
          </button>
        </div>
      </div>
    )
  }

  // Déjà déclaré (ANNOUNCEMENT) ou en attente de son slot (RESOLUTION)
  if (rosterEntry.has_announced) {
    return (
      <div style={styles.window}>
        <div style={styles.header}>Phase 1 - Déclaration d'intention</div>
        <p style={styles.waitText}>
          Action déclarée. En attente des autres participants…
        </p>
      </div>
    )
  }

  const isHidden = inMoveMode || inTargetMode

  // Slider CC : index → bullet count
  const ccSliderIdx = assaultBulletCount && assaultBulletCount !== 1
    ? CC_REPS_STEPS.indexOf(assaultBulletCount)
    : 0
  const ccSliderDisplayIdx = ccSliderIdx === -1 ? 0 : ccSliderIdx

  return (
    <div style={{
      ...styles.window,
      width: assaultSelected ? 720 : 360,
      opacity: isHidden ? 0 : 1,
      pointerEvents: isHidden ? 'none' : 'auto',
    }}>
      <div style={styles.header}>Phase 1 - Déclaration d'intention</div>

      <div style={styles.body}>

        {/* Panneau gauche — liste des actions */}
        <div style={styles.leftPanel}>
          {SECTIONS.map(section => (
            <div key={section.key} style={styles.section}>
              <div style={styles.sectionTitle}>{section.label}</div>
              <div style={styles.itemsGrid}>
                {section.items.map(item => {
                  if (!item.active) {
                    const modStr = formatMod(item)
                    return (
                      <div key={item.key} style={styles.itemGreyed}>
                        <span style={styles.itemLabel}>{item.label}</span>
                        {modStr && <span style={styles.itemMod}>{modStr}</span>}
                      </div>
                    )
                  }
                  if (item.isZoneSelect) {
                    const isSelected = moveSelection?.sourceKey === item.key
                    const canActivate = item.staticZones !== null || allures !== null
                    return (
                      <div
                        key={item.key}
                        style={{
                          ...styles.item,
                          ...(isSelected ? styles.itemSelected : {}),
                          gridColumn: 'span 2',
                          ...(!canActivate ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
                        }}
                        onClick={canActivate ? () => handleZoneSelectClick(item) : undefined}
                      >
                        <span style={styles.itemLabel}>{item.label}</span>
                        <span style={{ ...styles.itemMod, ...(isSelected ? styles.itemModSelected : {}) }}>
                          {isSelected ? `${moveSelection.ini_mod}` : '→'}
                        </span>
                      </div>
                    )
                  }
                  if (item.range) {
                    const selectedKey = [...selectedKeys].find(k => k.startsWith(item.key + '_'))
                    const isSelected = !!selectedKey
                    const currentMod = selectedKey ? KEY_MOD[selectedKey] : item.range.max
                    const sliderPos = item.range.max - currentMod
                    return (
                      <div
                        key={item.key}
                        style={{ ...styles.item, ...(isSelected ? styles.itemSelected : {}), gridColumn: 'span 2' }}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedKeys(prev => {
                              const next = new Set(prev)
                              ;[...next].filter(k => k.startsWith(item.key + '_')).forEach(k => next.delete(k))
                              return next
                            })
                          } else {
                            handleVarChange(null, `${item.key}_${Math.abs(item.range.max)}`)
                          }
                        }}
                      >
                        <span style={styles.itemLabel}>{item.label}</span>
                        <div style={styles.sliderRow} onClick={isSelected ? e => e.stopPropagation() : undefined}>
                          <input
                            type="range"
                            min={0}
                            max={item.range.max - item.range.min}
                            step={item.range.step}
                            value={sliderPos}
                            disabled={!isSelected}
                            style={{ ...styles.slider, opacity: isSelected ? 1 : 0.35 }}
                            onChange={e => {
                              const newMod = item.range.max - Number(e.target.value)
                              handleVarChange(selectedKey, `${item.key}_${Math.abs(newMod)}`)
                            }}
                          />
                          <span style={{ ...styles.sliderVal, ...(isSelected ? styles.sliderValSelected : {}) }}>
                            {currentMod}
                          </span>
                        </div>
                      </div>
                    )
                  }
                  const isSelected = selectedKeys.has(item.key)
                  const modStr = formatMod(item)
                  return (
                    <div
                      key={item.key}
                      style={{ ...styles.item, ...(isSelected ? styles.itemSelected : {}) }}
                      onClick={() => handleToggle(item.key)}
                    >
                      <span style={styles.itemLabel}>{item.label}</span>
                      <span style={{ ...styles.itemMod, ...(isSelected ? styles.itemModSelected : {}) }}>
                        {modStr}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Panneau droit — sous-panneau assaut (Kiwi-style) */}
        {assaultSelected && (
          <div style={styles.assaultPanel}>

            {/* Arme — auto-sélectionnée */}
            <div style={styles.assaultSection}>
              <div style={styles.assaultSectionTitle}>Arme</div>
              {selectedWeapon ? (
                <div style={styles.assaultInfoText}>
                  {selectedWeapon.custom_name || selectedWeapon.ref_name || 'Arme'}
                  <span style={styles.assaultInfoSub}> ({selectedWeapon.slot})</span>
                  {hasTwoWeapons && weaponMd && (
                    <span style={styles.assaultInfoSub}>
                      {' + '}{weaponMd.custom_name || weaponMd.ref_name || 'Arme'} ({weaponMd.slot})
                    </span>
                  )}
                </div>
              ) : (
                <div style={styles.assaultNoWeapon}>Aucune arme équipée (MG/MD)</div>
              )}
            </div>

            {/* Cible — sélection par clic canvas 3D */}
            <div style={styles.assaultSection}>
              <div style={styles.assaultSectionTitle}>Cible</div>
              {pendingTargetToken ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={styles.assaultTargetName}>{pendingTargetToken.label ?? '?'}</span>
                  <button style={styles.changeTargetBtn} onClick={handleChooseTarget}>Changer</button>
                </div>
              ) : (
                <button style={styles.chooseTargetBtn} onClick={handleChooseTarget}>
                  Choisir une cible →
                </button>
              )}
            </div>

            {/* Tir double — si 2 armes même mode de tir */}
            {hasTwoWeapons && sameFirMode && (
              <div style={styles.assaultSection}>
                <div style={styles.assaultSectionTitle}>Type de tir</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    style={{ ...styles.assaultToggleBtn, ...(!isDualWield ? styles.assaultToggleBtnActive : {}) }}
                    onClick={() => setIsDualWield(false)}
                  >Simple</button>
                  <button
                    style={{ ...styles.assaultToggleBtn, ...(isDualWield ? styles.assaultToggleBtnActive : {}) }}
                    onClick={() => setIsDualWield(true)}
                  >Double +{currentFireMode === 'RL' ? 5 : 3}</button>
                </div>
              </div>
            )}

            {/* Cadence — Kiwi-style, basé sur le mode actuel de l'arme */}
            {selectedWeapon && currentFireMode && (
              <div style={styles.assaultSection}>
                <div style={styles.assaultSectionTitle}>{FIRE_MODE_LABELS[currentFireMode] ?? currentFireMode}</div>

                {/* CC — Tir simple + Tir à répétition + slider */}
                {currentFireMode === 'CC' && (
                  <>
                    {/* Radio Tir simple */}
                    <div style={styles.assaultOption} onClick={() => {
                      setAssaultBulletCount(1)
                      setAssaultVariantAB('A')
                    }}>
                      <div>
                        <div style={styles.assaultOptionLabel}>Tir simple</div>
                        <div style={styles.assaultOptionSub}>1 balle : +0</div>
                      </div>
                      <div style={{
                        ...styles.assaultRadio,
                        ...(assaultBulletCount === 1 ? styles.assaultRadioActive : {}),
                      }} />
                    </div>

                    {/* Radio Tir à répétition */}
                    <div style={styles.assaultOption} onClick={() => {
                      if (!assaultBulletCount || assaultBulletCount === 1) setAssaultBulletCount(2)
                    }}>
                      <div style={styles.assaultOptionLabel}>Tir à répétition</div>
                      <div style={{
                        ...styles.assaultRadio,
                        ...(assaultBulletCount && assaultBulletCount !== 1 ? styles.assaultRadioActive : {}),
                      }} />
                    </div>

                    {/* Slider — visible si Tir à répétition sélectionné */}
                    {assaultBulletCount && assaultBulletCount !== 1 && (
                      <>
                        <input
                          type="range"
                          min={0}
                          max={CC_REPS_STEPS.length - 1}
                          step={1}
                          value={ccSliderDisplayIdx}
                          style={styles.assaultSlider}
                          onChange={e => {
                            const count = CC_REPS_STEPS[Number(e.target.value)]
                            setAssaultBulletCount(count)
                            if (count !== 7 && count !== 10) setAssaultVariantAB('A')
                          }}
                        />

                        {/* A/B pour 7 et 10 balles */}
                        {(assaultBulletCount === 7 || assaultBulletCount === 10) && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              style={{ ...styles.assaultVariantBtn, ...(assaultVariantAB === 'A' ? styles.assaultVariantBtnActive : {}) }}
                              onClick={() => setAssaultVariantAB('A')}
                            >
                              +{assaultBulletCount === 7 ? 4 : 5} comp
                            </button>
                            <button
                              style={{ ...styles.assaultVariantBtn, ...(assaultVariantAB === 'B' ? styles.assaultVariantBtnActive : {}) }}
                              onClick={() => setAssaultVariantAB('B')}
                            >
                              +{assaultBulletCount === 7 ? 3 : 4} comp / +3 dég
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {/* Résumé */}
                    {assaultBulletCount && currentVariant && (
                      <div style={styles.assaultSummaryText}>
                        {assaultBulletCount} balle{assaultBulletCount > 1 ? 's' : ''} tirée{assaultBulletCount > 1 ? 's' : ''}{' '}
                        : +{currentVariant.bonusComp + dualWieldBonusComp} au test de tir
                        {currentVariant.bonusDmg > 0 ? ` / +${currentVariant.bonusDmg} aux dommages` : ''}
                      </div>
                    )}
                  </>
                )}

                {/* RC — auto-sélectionné, juste affiché */}
                {currentFireMode === 'RC' && (
                  <>
                    <div style={styles.assaultOption}>
                      <div>
                        <div style={styles.assaultOptionLabel}>Rafale courte</div>
                        <div style={styles.assaultOptionSub}>3 balles : +3 test OU +5 dommages (courte portée)</div>
                      </div>
                      <div style={{ ...styles.assaultRadio, ...styles.assaultRadioActive }} />
                    </div>
                    <div style={styles.assaultSummaryText}>
                      3 balles : +{3 + dualWieldBonusComp} au test de tir (ou +5 dommages à courte portée)
                    </div>
                  </>
                )}

                {/* RL — boutons toggle pour les 5 cadences */}
                {currentFireMode === 'RL' && (
                  <>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {RL_BUTTONS.map(btn => (
                        <button
                          key={btn.value}
                          style={{
                            ...styles.assaultVariantBtn,
                            ...(assaultBulletCount === btn.value ? styles.assaultVariantBtnActive : {}),
                          }}
                          onClick={() => setAssaultBulletCount(btn.value)}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                    {currentVariant && (
                      <div style={styles.assaultSummaryText}>
                        {assaultBulletCount === 'multi'
                          ? `Multi-cibles : +0 test / zone 3m`
                          : `${assaultBulletCount} balles : +${currentVariant.bonusComp + dualWieldBonusComp} test / +${currentVariant.bonusDmg} dommages`
                        }
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={styles.footer}>
        <div style={styles.footerLeft}>
          <span style={styles.totalMod}>
            INI total : {totalMod > 0 ? `+${totalMod}` : totalMod}
          </span>
          {moveSelection && (
            <span style={styles.destination}>
              → [{moveSelection.targetPosX}, {moveSelection.targetPosY}]
            </span>
          )}
        </div>
        <button
          style={{ ...styles.btnDeclare, ...(!canDeclare ? styles.btnDeclareDisabled : {}) }}
          onClick={handleDeclare}
          disabled={!canDeclare}
        >
          Déclarer l'action
        </button>
      </div>
    </div>
  )
}

const styles = {
  window: {
    position: 'absolute',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    maxHeight: 'calc(100vh - 80px)',
    background: '#16162a',
    border: '1px solid #2a2a3e',
    borderRadius: 8,
    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
    pointerEvents: 'auto',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'opacity 0.15s ease, width 0.2s ease',
  },
  header: {
    padding: '10px 14px',
    borderBottom: '1px solid #2a2a3e',
    background: '#0e0e1a',
    fontSize: 13,
    color: '#c0c0d0',
    fontWeight: 600,
    flexShrink: 0,
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  leftPanel: {
    flex: '0 0 360px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  section: {
    borderBottom: '1px solid #1e1e2e',
    paddingBottom: 4,
  },
  sectionTitle: {
    padding: '8px 14px 4px',
    fontSize: 10,
    fontWeight: 700,
    color: '#5b5b7a',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  itemsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 10px',
    margin: '1px 6px',
    borderRadius: 4,
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid transparent',
  },
  itemSelected: {
    background: 'rgba(91,141,238,0.15)',
    borderColor: '#5b8dee',
  },
  itemGreyed: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 10px',
    margin: '1px 6px',
    opacity: 0.3,
    cursor: 'not-allowed',
  },
  itemLabel: {
    fontSize: 11,
    color: '#c0c0d0',
    flex: 1,
    marginRight: 6,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemMod: {
    fontSize: 10,
    color: '#5b5b7a',
    flexShrink: 0,
    minWidth: 30,
    textAlign: 'right',
  },
  itemModSelected: {
    color: '#5b8dee',
  },
  sliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  slider: {
    width: 70,
    accentColor: '#5b8dee',
    cursor: 'pointer',
  },
  sliderVal: {
    fontSize: 10,
    color: '#5b5b7a',
    minWidth: 26,
    textAlign: 'right',
  },
  sliderValSelected: {
    color: '#5b8dee',
  },
  footer: {
    padding: '10px 14px',
    borderTop: '1px solid #2a2a3e',
    background: '#0e0e1a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
    gap: 8,
  },
  footerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  totalMod: {
    fontSize: 12,
    color: '#8888a8',
    fontWeight: 600,
  },
  destination: {
    fontSize: 10,
    color: '#5b8dee',
    fontWeight: 600,
  },
  btnDeclare: {
    padding: '7px 14px',
    background: 'rgba(91,141,238,0.15)',
    border: '1px solid #5b8dee',
    borderRadius: 4,
    color: '#5b8dee',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
  btnDeclareDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  surpriseText: {
    padding: '14px 14px 0',
    fontSize: 12,
    color: '#c0c0d0',
    lineHeight: '1.5',
    margin: 0,
  },
  waitText: {
    padding: '14px',
    fontSize: 12,
    color: '#5a5a7a',
    margin: 0,
    fontStyle: 'italic',
  },
  btnRoll: {
    margin: '14px',
    padding: '10px 20px',
    background: 'rgba(91,141,238,0.15)',
    border: '1px solid #5b8dee',
    borderRadius: 4,
    color: '#5b8dee',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    width: 'calc(100% - 28px)',
  },

  // ─── Panneau assaut droit (Kiwi-style) ──────────────────────────────────────
  assaultPanel: {
    flex: '0 0 360px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    borderLeft: '1px solid #2a2a3e',
    background: 'rgba(180,80,80,0.04)',
  },
  assaultSection: {
    padding: '10px 14px',
    borderBottom: '1px solid #1e1e2e',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  assaultSectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#e07070',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  assaultInfoText: {
    fontSize: 12,
    color: '#c0c0d0',
  },
  assaultInfoSub: {
    fontSize: 10,
    color: '#5b5b7a',
  },
  assaultNoWeapon: {
    fontSize: 11,
    color: '#5b5b7a',
    fontStyle: 'italic',
  },
  assaultTargetName: {
    fontSize: 12,
    color: '#e07070',
    fontWeight: 600,
    flex: 1,
  },
  chooseTargetBtn: {
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
  changeTargetBtn: {
    padding: '3px 8px',
    background: 'none',
    border: '1px solid #3a3a5a',
    borderRadius: 4,
    color: '#7070a0',
    fontSize: 10,
    cursor: 'pointer',
    flexShrink: 0,
  },
  assaultToggleBtn: {
    flex: 1,
    padding: '5px 0',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid #2a2a3e',
    borderRadius: 4,
    color: '#8888a8',
    fontSize: 11,
    cursor: 'pointer',
    textAlign: 'center',
    fontWeight: 600,
  },
  assaultToggleBtnActive: {
    background: 'rgba(180,80,80,0.2)',
    borderColor: '#c05050',
    color: '#e07070',
  },
  assaultOption: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 0',
    cursor: 'pointer',
    userSelect: 'none',
  },
  assaultOptionLabel: {
    fontSize: 12,
    color: '#c0c0d0',
    fontWeight: 500,
  },
  assaultOptionSub: {
    fontSize: 10,
    color: '#5b5b7a',
    marginTop: 2,
  },
  assaultRadio: {
    width: 14,
    height: 14,
    borderRadius: '50%',
    border: '2px solid #3a3a5a',
    flexShrink: 0,
    boxSizing: 'border-box',
    transition: 'border-color 0.1s, background 0.1s',
  },
  assaultRadioActive: {
    borderColor: '#e07070',
    background: '#e07070',
  },
  assaultSlider: {
    width: '100%',
    accentColor: '#e07070',
    cursor: 'pointer',
  },
  assaultVariantBtn: {
    flex: 1,
    padding: '4px 6px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid #2a2a3e',
    borderRadius: 4,
    color: '#8888a8',
    fontSize: 10,
    cursor: 'pointer',
    textAlign: 'center',
  },
  assaultVariantBtnActive: {
    background: 'rgba(180,80,80,0.2)',
    borderColor: '#c05050',
    color: '#e07070',
  },
  assaultSummaryText: {
    fontSize: 11,
    color: '#e07070',
    fontWeight: 600,
    fontStyle: 'italic',
  },
}
