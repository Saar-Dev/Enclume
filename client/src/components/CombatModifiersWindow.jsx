import { useState, useMemo, useEffect } from 'react'
import { WS } from '../../../shared/events.js'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'
import api from '../lib/api.js'

const FIRE_MODE_LABELS = { CC: 'Coup par coup', RC: 'Rafale courte', RL: 'Rafale longue' }

const PORTEES = [
  { key: 'bout_portant', label: 'Bout portant', mod: 5 },
  { key: 'courte',       label: 'Courte',        mod: 0 },
  { key: 'moyenne',      label: 'Moyenne',        mod: -5 },
  { key: 'longue',       label: 'Longue',         mod: -10 },
  { key: 'extreme',      label: 'Extrême',        mod: -15 },
]

const TIREUR_ALLURES = [
  { val: 'immobile',               sitKey: null,                     label: 'Immobile',              mod: 0 },
  { val: 'tireur_allure_lente',    sitKey: 'tireur_allure_lente',    label: 'Allure lente',          mod: -3 },
  { val: 'tireur_allure_moyenne',  sitKey: 'tireur_allure_moyenne',  label: 'Allure moyenne',        mod: -5 },
  { val: 'tireur_allure_rapide',   sitKey: 'tireur_allure_rapide',   label: 'Allure rapide',         mod: -7 },
  { val: 'tireur_allure_maximale', sitKey: 'tireur_allure_maximale', label: 'Allure maximale (✗)',   mod: -99 },
]

const CIBLE_ALLURES = [
  { val: 'cible_immobile',        sitKey: 'cible_immobile',        label: 'Immobile',          mod: 3 },
  { val: 'cible_lente',           sitKey: null,                    label: 'Allure lente',      mod: 0 },
  { val: 'cible_allure_moyenne',  sitKey: 'cible_allure_moyenne',  label: 'Allure moyenne',    mod: -3 },
  { val: 'cible_allure_rapide',   sitKey: 'cible_allure_rapide',   label: 'Allure rapide',     mod: -5 },
  { val: 'cible_allure_maximale', sitKey: 'cible_allure_maximale', label: 'Allure maximale',   mod: -7 },
]

const COUVERTURES = [
  { key: 'couverture_partielle',  label: 'Couverture partielle (50%)',  mod: -3 },
  { key: 'couverture_importante', label: 'Couverture importante (75%)', mod: -5 },
]

const OBSCURITES = [
  { key: 'obscurite_legere',     label: 'Obscurité légère',              mod: -3 },
  { key: 'obscurite_importante', label: 'Obscurité importante',          mod: -5 },
  { key: 'obscurite_totale',     label: 'Obscurité totale (impossible)', mod: -99 },
]

const TAILLES = [
  { key: 'minuscule',    label: 'Minuscule (~30 cm)',    mod: -10 },
  { key: 'tres_petite',  label: 'Très petite (~50 cm)', mod: -5 },
  { key: 'petite',       label: 'Petite (~1 m)',         mod: -3 },
  { key: 'moyenne',      label: 'Moyenne (humaine)',     mod: 0 },
  { key: 'grande',       label: 'Grande (~3 m)',         mod: 3 },
  { key: 'tres_grande',  label: 'Très grande (~5 m)',    mod: 5 },
  { key: 'enorme',       label: 'Énorme (~7 m)',         mod: 10 },
  { key: 'gigantesque',  label: 'Gigantesque (10 m+)',   mod: 15 },
]

const MOVE_ACTION_KEYS = ['move_lente', 'move_moyenne', 'move_rapide', 'move_max']

// PC37 + PC38 : parsing portée depuis ref_equipment.range
function parseRange(rangeStr) {
  if (!rangeStr) return null
  const extremeMatch = rangeStr.match(/\(([^)]+)\)/)
  const extreme = extremeMatch ? parseInt(extremeMatch[1].replace(/\s/g, ''), 10) : null
  const main = rangeStr.replace(/\([^)]*\)/, '').trim()
  const parts = main.split('/').map(s => parseInt(s.replace(/\s/g, ''), 10)).filter(n => !isNaN(n))
  if (parts.length === 0) return null
  if (parts.length === 1) return { bp: parts[0], courte: null, moyenne: null, longue: null, extreme: null, isContact: true }
  return { bp: parts[0] ?? null, courte: parts[1] ?? null, moyenne: parts[2] ?? null, longue: parts[3] ?? null, extreme }
}

function calcPorteePalier(distance, rangeData) {
  if (!rangeData) return null
  if (rangeData.isContact) return 'bout_portant'
  if (rangeData.bp !== null && distance <= rangeData.bp) return 'bout_portant'
  if (rangeData.courte !== null && distance <= rangeData.courte) return 'courte'
  if (rangeData.moyenne !== null && distance <= rangeData.moyenne) return 'moyenne'
  if (rangeData.longue !== null && distance <= rangeData.longue) return 'longue'
  if (rangeData.extreme !== null && distance <= rangeData.extreme) return 'extreme'
  return null
}

function formatMod(n) { return n > 0 ? `+${n}` : `${n}` }
function fmtOpt(n) { return n > 0 ? `+${n}` : n === 0 ? '±0' : n === -99 ? '✗' : `${n}` }

export default function CombatModifiersWindow({ socket, assaultAction, activeRosterEntry }) {
  const { actions } = useCombatStore()
  const tokens = useTokenStore(s => s.tokens)

  const [porteeOverride, setPorteeOverride] = useState(null)
  const [tireurAllureOverride, setTireurAllureOverride] = useState(null)
  const [cibleAllureOverride, setCibleAllureOverride] = useState(null)
  const [couvertures, setCouvertures] = useState([])
  const [obscurites, setObscurites] = useState([])
  const [taille, setTaille] = useState('moyenne')
  const [weaponSkill, setWeaponSkill] = useState(null)

  const tireurToken = assaultAction ? tokens.find(t => t.id === assaultAction.token_id) : null
  const cibleToken  = assaultAction ? tokens.find(t => t.id === assaultAction.target_token_id) : null
  const tireurCharId = tireurToken?.character_id ?? null

  // Reset quand un nouvel assaut passe en résolution
  useEffect(() => {
    setPorteeOverride(null)
    setTireurAllureOverride(null)
    setCibleAllureOverride(null)
    setCouvertures([])
    setObscurites([])
    setTaille('moyenne')
    setWeaponSkill(null)
  }, [assaultAction?.id])

  // Fetch compétence liée à l'arme (pour la pill)
  useEffect(() => {
    if (!tireurCharId || !assaultAction?.weapon_inv_id) return
    let cancelled = false
    api.get(`/char-sheet/${tireurCharId}/weapon-skill/${assaultAction.weapon_inv_id}`)
      .then(res => { if (!cancelled) setWeaponSkill(res.data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [assaultAction?.id, tireurCharId])

  // Détection allure tireur depuis les actions annoncées
  const detectedTireurAllure = useMemo(() => {
    const mv = actions.find(a =>
      a.token_id === assaultAction?.token_id && MOVE_ACTION_KEYS.includes(a.action_key)
    )
    if (!mv) return 'immobile'
    const map = { move_lente: 'tireur_allure_lente', move_moyenne: 'tireur_allure_moyenne', move_rapide: 'tireur_allure_rapide', move_max: 'tireur_allure_maximale' }
    return map[mv.action_key] ?? 'immobile'
  }, [actions, assaultAction?.token_id])

  // Détection allure cible depuis les actions annoncées
  const detectedCibleAllure = useMemo(() => {
    const mv = actions.find(a =>
      a.token_id === assaultAction?.target_token_id && MOVE_ACTION_KEYS.includes(a.action_key)
    )
    if (!mv) return 'cible_immobile'
    const map = { move_lente: 'cible_lente', move_moyenne: 'cible_allure_moyenne', move_rapide: 'cible_allure_rapide', move_max: 'cible_allure_maximale' }
    return map[mv.action_key] ?? 'cible_immobile'
  }, [actions, assaultAction?.target_token_id])

  const tireurAllureVal = tireurAllureOverride ?? detectedTireurAllure
  const cibleAllureVal  = cibleAllureOverride  ?? detectedCibleAllure

  // Pré-calcul portée depuis la distance réelle (PE14 + PC35 + PC37 + PC38)
  const prefilledPortee = useMemo(() => {
    if (!assaultAction || !tireurToken || !cibleToken) return null
    // PE14 : pos_y DB = Z Three.js (profondeur), pos_z DB = Y Three.js (altitude)
    const dx = tireurToken.pos_x - cibleToken.pos_x
    const dy = tireurToken.pos_z - cibleToken.pos_z
    const dz = tireurToken.pos_y - cibleToken.pos_y
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) // voxel_scale = 1.0 (PC35)
    const rangeData = parseRange(assaultAction.modifiers?.ref_range)
    return { porteeKey: calcPorteePalier(distance, rangeData), distance: Math.round(distance * 10) / 10 }
  }, [assaultAction, tireurToken, cibleToken])

  const effectivePortee   = porteeOverride ?? prefilledPortee?.porteeKey ?? null
  const isRushed          = activeRosterEntry?.state_character?.is_rushed
  const tireurAllureDef   = TIREUR_ALLURES.find(a => a.val === tireurAllureVal)
  const cibleAllureDef    = CIBLE_ALLURES.find(a => a.val === cibleAllureVal)

  const porteeModComp   = PORTEES.find(p => p.key === effectivePortee)?.mod ?? 0
  const tireurAllureMod = tireurAllureDef?.mod ?? 0
  const cibleAllureMod  = cibleAllureDef?.mod ?? 0
  const couvertureMod   = couvertures.reduce((sum, k) => sum + (COUVERTURES.find(c => c.key === k)?.mod ?? 0), 0)
  const obscuriteMod    = obscurites.reduce((sum, k) => sum + (OBSCURITES.find(o => o.key === k)?.mod ?? 0), 0)
  const tailleModComp   = TAILLES.find(t => t.key === taille)?.mod ?? 0
  const totalModComp    = porteeModComp + tireurAllureMod + cibleAllureMod + couvertureMod + obscuriteMod + tailleModComp
  const bonusDmg        = assaultAction?.fire_mode_bonus_dmg ?? 0

  const hasTirImpossible = tireurAllureMod === -99 || obscurites.some(k => OBSCURITES.find(o => o.key === k)?.mod === -99)

  const handleCouverture = (key) => {
    setCouvertures(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }
  const handleObscurite = (key) => {
    setObscurites(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const handleValider = () => {
    if (!effectivePortee || hasTirImpossible) return
    const tireurSitKey = tireurAllureDef?.sitKey
    const cibleSitKey  = cibleAllureDef?.sitKey
    const situation = [
      ...(tireurSitKey ? [tireurSitKey] : []),
      ...(cibleSitKey  ? [cibleSitKey]  : []),
      ...couvertures,
      ...obscurites,
    ]
    socket?.emit(WS.COMBAT_ACTION_CONFIRM, {
      tokenId: activeRosterEntry.token_id,
      confirmedModifiers: { portee: effectivePortee, situation, taille },
    })
  }

  return (
    <div style={styles.window}>

      {/* Header — titre + pill */}
      <div style={styles.header}>
        <span style={styles.headerTitle}>
          {tireurToken?.label ?? '?'} — Assaut — {cibleToken?.label ?? '?'}
        </span>
        <div style={styles.pills}>
          <span style={{
            ...styles.pill,
            background: hasTirImpossible ? '#5a1010' : totalModComp >= 0 ? '#1a3a1a' : '#3a1a1a',
            color:      hasTirImpossible ? '#ff6060' : totalModComp >= 0 ? '#6dca6d' : '#ca6d6d',
          }}>
            {hasTirImpossible
              ? 'Tir impossible'
              : weaponSkill?.skillLabel
                ? `${weaponSkill.skillLabel} ${weaponSkill.skillTotal ?? '?'} ${formatMod(totalModComp)}`
                : `Comp ${formatMod(totalModComp)}`
            }
          </span>
          {bonusDmg !== 0 && (
            <span style={{ ...styles.pill, background: '#3a2a10', color: '#f5a842' }}>
              Dmg {formatMod(bonusDmg)}
            </span>
          )}
        </div>
      </div>

      <div style={styles.body}>

        {/* Récapitulatif (lecture seule) */}
        <div style={styles.infoBlock}>
          {assaultAction?.fire_mode && (
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Mode de tir</span>
              <span style={styles.infoValue}>
                {FIRE_MODE_LABELS[assaultAction.fire_mode] ?? assaultAction.fire_mode}
                {assaultAction.bullet_count > 1 ? ` — ${assaultAction.bullet_count}b` : ''}
                {assaultAction.fire_mode_bonus_comp ? ` (+${assaultAction.fire_mode_bonus_comp} comp)` : ''}
              </span>
            </div>
          )}
          {isRushed && (
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>État</span>
              <span style={{ ...styles.infoValue, color: '#e55' }}>⚠ Précipité (−5 comp)</span>
            </div>
          )}
          {prefilledPortee?.distance !== undefined && (
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Distance</span>
              <span style={styles.infoValue}>{prefilledPortee.distance} m</span>
            </div>
          )}
        </div>

        {/* Portée */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Portée</div>
          <select
            value={effectivePortee ?? ''}
            onChange={e => setPorteeOverride(e.target.value || null)}
            style={styles.select}
          >
            {!effectivePortee && <option value="">— choisir —</option>}
            {PORTEES.map(p => (
              <option key={p.key} value={p.key}>{p.label} ({fmtOpt(p.mod)})</option>
            ))}
          </select>
        </div>

        {/* Allure tireur */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Allure tireur</div>
          <select
            value={tireurAllureVal}
            onChange={e => setTireurAllureOverride(e.target.value)}
            style={styles.select}
          >
            {TIREUR_ALLURES.map(a => (
              <option key={a.val} value={a.val}>{a.label} ({fmtOpt(a.mod)})</option>
            ))}
          </select>
        </div>

        {/* Allure cible */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Allure cible</div>
          <select
            value={cibleAllureVal}
            onChange={e => setCibleAllureOverride(e.target.value)}
            style={styles.select}
          >
            {CIBLE_ALLURES.map(a => (
              <option key={a.val} value={a.val}>{a.label} ({fmtOpt(a.mod)})</option>
            ))}
          </select>
        </div>

        {/* Couverture */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Couverture</div>
          {COUVERTURES.map(c => (
            <label key={c.key} style={styles.checkLabel}>
              <input
                type="checkbox"
                checked={couvertures.includes(c.key)}
                onChange={() => handleCouverture(c.key)}
                style={styles.checkbox}
              />
              <span style={styles.checkText}>
                {c.label}
                <span style={{ ...styles.checkMod, color: '#ca6d6d' }}>{formatMod(c.mod)}</span>
              </span>
            </label>
          ))}
        </div>

        {/* Obscurité */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Obscurité</div>
          {OBSCURITES.map(o => (
            <label key={o.key} style={styles.checkLabel}>
              <input
                type="checkbox"
                checked={obscurites.includes(o.key)}
                onChange={() => handleObscurite(o.key)}
                style={styles.checkbox}
              />
              <span style={styles.checkText}>
                {o.label}
                <span style={{ ...styles.checkMod, color: '#ca6d6d' }}>
                  {o.mod === -99 ? '✗' : formatMod(o.mod)}
                </span>
              </span>
            </label>
          ))}
        </div>

        {/* Taille cible */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Taille cible</div>
          <select
            value={taille}
            onChange={e => setTaille(e.target.value)}
            style={styles.select}
          >
            {TAILLES.map(t => (
              <option key={t.key} value={t.key}>{t.label} ({fmtOpt(t.mod)})</option>
            ))}
          </select>
        </div>

      </div>

      {/* Footer — Valider */}
      <div style={styles.footer}>
        <button
          style={{
            ...styles.btnValider,
            opacity: (effectivePortee && !hasTirImpossible) ? 1 : 0.4,
            cursor:  (effectivePortee && !hasTirImpossible) ? 'pointer' : 'not-allowed',
          }}
          onClick={handleValider}
          disabled={!effectivePortee || hasTirImpossible}
        >
          Valider
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
    width: 360,
    maxHeight: '80vh',
    background: '#16162a',
    border: '1px solid #f5c542',
    borderRadius: 8,
    boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
    pointerEvents: 'auto',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    position: 'sticky',
    top: 0,
    background: '#16162a',
    borderBottom: '1px solid #2a2a3e',
    padding: '8px 14px',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    flexShrink: 0,
    zIndex: 1,
    flexWrap: 'wrap',
  },
  headerTitle: { fontSize: 12, fontWeight: 700, color: '#f5c542', flex: 1, minWidth: 0 },
  pills: { display: 'flex', gap: 4, flexShrink: 0 },
  pill: { fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap' },
  body: { overflowY: 'auto', flex: 1, padding: '4px 0' },
  infoBlock: {
    padding: '6px 14px 8px',
    borderBottom: '1px solid #2a2a3e',
    marginBottom: 2,
  },
  infoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' },
  infoLabel: { fontSize: 11, color: '#5b5b7a' },
  infoValue: { fontSize: 11, color: '#c0c0d0' },
  section: { padding: '6px 14px', borderBottom: '1px solid #1e1e2e' },
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
  checkMod: { fontSize: 10, fontWeight: 700, minWidth: 24, textAlign: 'right' },
  footer: { padding: '8px 14px', borderTop: '1px solid #2a2a3e', flexShrink: 0 },
  btnValider: {
    width: '100%',
    padding: '8px 0',
    background: 'rgba(245,197,66,0.15)',
    border: '1px solid #f5c542',
    borderRadius: 4,
    color: '#f5c542',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
}
