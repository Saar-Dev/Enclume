import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDraggable } from '../lib/useDraggable.js'
import { WS } from '../../../shared/events.js'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'
import api from '../lib/api.js'
import { getTailleCible } from '../../../shared/droneConstants.js'

// CaC §6.2 — modificateurs situation attaquant (préfixe cac_). label = cle i18n namespace combat
// (docs/SYSTEME/LOCALISATION.md §3.1), resolue par le composant via t(), jamais affichee brute ici.
const SITUATION_ATK = [
  { key: 'cac_attaquant_cote',          label: 'cacModifiers.situationAtk.atkFlank',    mod: -3 },
  { key: 'cac_attaquant_au_sol',        label: 'cacModifiers.situationAtk.atkProne',    mod: -5 },
  { key: 'cac_espace_confine',          label: 'cacModifiers.situationAtk.confined',    mod: -3 },
  { key: 'cac_espace_tres_confine',     label: 'cacModifiers.situationAtk.veryConfined', mod: -5 },
  { key: 'cac_position_avantageuse',    label: 'cacModifiers.situationAtk.advantageous', mod: 3  },
  { key: 'cac_main_non_directrice',     label: 'cacModifiers.situationAtk.offhand',      mod: -5 },
  { key: 'cac_terrain_instable',        label: 'cacModifiers.situationAtk.unstableGround', mod: null },
]

const TAILLES = [
  { key: 'minuscule',   label: 'cacModifiers.tailles.minuscule',   mod: -10 },
  { key: 'tres_petite', label: 'cacModifiers.tailles.tresPetite',  mod: -5  },
  { key: 'petite',      label: 'cacModifiers.tailles.petite',      mod: -3  },
  { key: 'moyenne',     label: 'cacModifiers.tailles.moyenne',     mod: 0   },
  { key: 'grande',      label: 'cacModifiers.tailles.grande',      mod: 3   },
  { key: 'tres_grande', label: 'cacModifiers.tailles.tresGrande',  mod: 5   },
  { key: 'enorme',      label: 'cacModifiers.tailles.enorme',      mod: 10  },
  { key: 'gigantesque', label: 'cacModifiers.tailles.gigantesque', mod: 15  },
]

function formatMod(n) { return n > 0 ? `+${n}` : `${n}` }
function fmtOpt(n)    { return n > 0 ? `+${n}` : n === 0 ? '±0' : `${n}` }

export default function CombatCacModifiersWindow({ socket, activeRosterEntry, isDrone }) {
  const { t } = useTranslation('combat')
  const { actions } = useCombatStore()
  const tokens = useTokenStore(s => s.tokens)

  const { pos, onHeaderMouseDown } = useDraggable(
    'combat-cac-modifiers-pos',
    { top: window.innerHeight - 540, left: window.innerWidth / 2 - 180 },
    360,
  )

  const [situationAtk, setSituationAtk]   = useState([])
  const [situationDef, setSituationDef]   = useState([])
  const [taille, setTaille]               = useState('moyenne')
  const [weaponSkill, setWeaponSkill]     = useState(null)
  const [isRolling, setIsRolling]         = useState(false)

  const meleeOrAssaultAction = useMemo(() => {
    if (!activeRosterEntry) return null
    return actions.find(a =>
      a.token_id === activeRosterEntry.token_id && a.action_key === 'melee'
    ) ?? null
  }, [actions, activeRosterEntry])

  const attaquantToken = tokens.find(t => t.id === activeRosterEntry?.token_id)
  const cibleToken     = tokens.find(t => t.id === meleeOrAssaultAction?.target_token_id)
  const cibleCharId    = cibleToken?.character_id ?? null

  // Reset quand un nouveau slot CaC devient actif
  useEffect(() => {
    setSituationAtk([])
    setSituationDef([])
    setTaille('moyenne')
    setWeaponSkill(null)
    setIsRolling(false)
  }, [meleeOrAssaultAction?.id])

  // Fetch compétence liée à l'arme attaquant (pour la pill)
  useEffect(() => {
    const charId = attaquantToken?.character_id
    const weaponInvId = meleeOrAssaultAction?.weapon_inv_id
    if (!charId || !weaponInvId) return
    let cancelled = false
    api.get(`/char-sheet/${charId}/weapon-skill/${weaponInvId}`)
      .then(res => { if (!cancelled) setWeaponSkill(res.data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [meleeOrAssaultAction?.id, attaquantToken?.character_id])

  // Pré-sélection taille si la cible est un drone
  useEffect(() => {
    if (!cibleCharId) return
    let cancelled = false
    api.get(`/char-sheet/${cibleCharId}/drone`)
      .then(res => {
        if (cancelled) return
        const tailleCm = res.data?.drone?.taille
        if (tailleCm != null) setTaille(getTailleCible(tailleCm))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [meleeOrAssaultAction?.id, cibleCharId])

  const handleToggleAtk = (key) => {
    setSituationAtk(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }
  const handleToggleDef = (key) => {
    setSituationDef(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  // Calcul total côté client (indicatif — terrain_instable calculé serveur)
  const atkFixedMod = situationAtk
    .filter(k => k !== 'cac_terrain_instable')
    .reduce((sum, k) => sum + (SITUATION_ATK.find(s => s.key === k)?.mod ?? 0), 0)
  const tailleDef = TAILLES.find(t => t.key === taille)
  const tailleModComp = tailleDef?.mod ?? 0
  const hasTerrainInstableAtk = situationAtk.includes('cac_terrain_instable')
  const totalModComp = atkFixedMod + tailleModComp

  const handleLancer = () => {
    if (isRolling || !activeRosterEntry) return
    setIsRolling(true)
    socket?.emit(WS.COMBAT_ACTION_CONFIRM, {
      tokenId: activeRosterEntry.token_id,
      confirmedModifiers: {
        situation:    situationAtk,
        situationDef: situationDef,
        taille,
      },
    })
  }

  return (
    <div className="combat-float-win combat-float-win--gold" style={{ position: 'fixed', left: pos.left, top: pos.top, maxHeight: '80vh' }}>

      {/* Header */}
      <div className="combat-float-header" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }} onMouseDown={onHeaderMouseDown}>
        <span style={styles.headerTitle}>
          {t('cacModifiers.header', { attacker: attaquantToken?.label ?? '?', target: cibleToken?.label ?? '?' })}
        </span>
        <div style={styles.pills}>
          <span style={{
            ...styles.pill,
            background: totalModComp >= 0 ? '#1a3a1a' : '#3a1a1a',
            color:      totalModComp >= 0 ? '#6dca6d' : '#ca6d6d',
          }}>
            {weaponSkill?.skillLabel
              ? `${weaponSkill.skillLabel} ${weaponSkill.skillTotal ?? '?'} ${formatMod(totalModComp)}`
              : t('cacModifiers.compFallback', { mod: formatMod(totalModComp) })
            }
            {hasTerrainInstableAtk && <span style={{ marginLeft: 4, opacity: 0.7 }}>{t('cacModifiers.acroTag')}</span>}
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={styles.body}>

        {/* Section Attaquant */}
        <div className="combat-float-section">
          <div style={styles.sectionTitle}>{t('cacModifiers.attackerSection')}</div>
          {SITUATION_ATK.map(s => (
            <label key={s.key} style={styles.checkLabel}>
              <input
                type="checkbox"
                checked={situationAtk.includes(s.key)}
                onChange={() => handleToggleAtk(s.key)}
                style={styles.checkbox}
              />
              <span style={styles.checkText}>
                {t(s.label)}
                <span style={{ ...styles.checkMod, color: s.mod != null && s.mod < 0 ? '#ca6d6d' : s.mod != null && s.mod > 0 ? '#6dca6d' : '#8888a0' }}>
                  {s.mod == null ? t('cacModifiers.acroDown') : formatMod(s.mod)}
                </span>
              </span>
            </label>
          ))}
        </div>

        {/* Section Défenseur — terrain instable uniquement (V1) */}
        {!isDrone && (
          <div className="combat-float-section">
            <div style={styles.sectionTitle}>{t('cacModifiers.defenderSection')}</div>
            <label style={styles.checkLabel}>
              <input
                type="checkbox"
                checked={situationDef.includes('cac_terrain_instable')}
                onChange={() => handleToggleDef('cac_terrain_instable')}
                style={styles.checkbox}
              />
              <span style={styles.checkText}>
                {t('cacModifiers.situationAtk.unstableGround')}
                <span style={{ ...styles.checkMod, color: '#8888a0' }}>{t('cacModifiers.acroDown')}</span>
              </span>
            </label>
          </div>
        )}

        {/* Taille cible */}
        <div className="combat-float-section">
          <div style={styles.sectionTitle}>{t('cacModifiers.targetSizeSection')}</div>
          <select
            value={taille}
            onChange={e => setTaille(e.target.value)}
            style={styles.select}
          >
            {TAILLES.map(opt => (
              <option key={opt.key} value={opt.key}>{t(opt.label)} ({fmtOpt(opt.mod)})</option>
            ))}
          </select>
        </div>

      </div>

      {/* Poignée bas */}
      <div onMouseDown={onHeaderMouseDown} style={styles.bottomHandle} />

      {/* Footer */}
      <div className="combat-float-footer">
        <button
          className="btn btn-gold"
          style={{
            width: '100%',
            opacity: (!isRolling) ? 1 : 0.4,
            cursor:  (!isRolling) ? 'pointer' : 'not-allowed',
          }}
          onClick={handleLancer}
          disabled={isRolling}
        >
          {isRolling ? t('cacModifiers.rolling') : t('damageWindow.rollButton')}
        </button>
      </div>

    </div>
  )
}

const styles = {
  headerTitle: { fontSize: 12, fontWeight: 700, color: '#f5c542', flex: 1, minWidth: 0 },
  pills: { display: 'flex', gap: 4, flexShrink: 0 },
  pill: { fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap' },
  body: { overflowY: 'auto', flex: 1, padding: '4px 0' },
  sectionTitle: {
    fontSize: 10, fontWeight: 700, color: '#5b5b7a',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
  },
  select: {
    width: '100%',
    background: '#0e0e1e',
    border: '1px solid #2a2a3e',
    borderRadius: 4,
    color: '#c0c0d0',
    fontSize: 11,
    padding: '4px 6px',
    cursor: 'pointer',
  },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '2px 0' },
  checkbox: { accentColor: '#f5c542', cursor: 'pointer', flexShrink: 0 },
  checkText: { fontSize: 11, color: '#c0c0d0', flex: 1, display: 'flex', justifyContent: 'space-between' },
  checkMod: { fontSize: 10, fontWeight: 700, minWidth: 32, textAlign: 'right' },
  bottomHandle: {
    height: 6, flexShrink: 0,
    background: 'rgba(90,100,120,0.12)',
    borderTop: '1px solid rgba(90,100,120,0.18)',
    cursor: 'ns-resize',
  },
}
