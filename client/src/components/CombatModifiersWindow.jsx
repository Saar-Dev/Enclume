import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDraggable } from '../lib/useDraggable.js'
import { WS } from '../../../shared/events.js'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'
import api from '../lib/api.js'
import { getTailleCible } from '../../../shared/droneConstants.js'
import { RANGED_SITUATION_MODS, isImpossibleRangedSituation } from '../../../shared/combatSituationMods.js'

// mod() — lit la valeur numérique dans la table unique partagée avec le serveur (autorité tir à
// distance, TIRIMP docs/BUGIDENTIFIE.md). Un `sitKey` absent (val 'immobile'/'cible_lente') signifie
// "pas de modificateur, pas envoyé au serveur" — jamais une valeur codée en dur ici.
const mod = (sitKey) => sitKey ? (RANGED_SITUATION_MODS[sitKey]?.mod ?? 0) : 0
const isImpossible = (sitKey) => !!sitKey && RANGED_SITUATION_MODS[sitKey]?.impossible === true

// FIRE_MODE_LABELS reutilise states.fireMode.*.label (memes libelles que StateSelector, Segment 5).
// Toutes les autres valeurs label ci-dessous = cle i18n namespace combat (docs/SYSTEME/LOCALISATION.md
// §3.1), resolue par le composant via t(), jamais affichee brute ici. TAILLES reutilise
// cacModifiers.tailles.* (memes 8 paliers que CombatCacModifiersWindow.jsx, Règle 2).
const FIRE_MODE_LABELS = { CC: 'states.fireMode.cc.label', RC: 'states.fireMode.rc.label', RL: 'states.fireMode.rl.label' }

const PORTEES = [
  { key: 'bout_portant', label: 'modifiers.portees.boutPortant', mod: 5 },
  { key: 'courte',       label: 'modifiers.portees.courte',      mod: 0 },
  { key: 'moyenne',      label: 'modifiers.portees.moyenne',     mod: -5 },
  { key: 'longue',       label: 'modifiers.portees.longue',      mod: -10 },
  { key: 'extreme',      label: 'modifiers.portees.extreme',     mod: -15 },
]

const TIREUR_ALLURES = [
  { val: 'immobile',               sitKey: null,                     label: 'modifiers.allures.immobile',           mod: mod(null) },
  { val: 'tireur_allure_lente',    sitKey: 'tireur_allure_lente',    label: 'modifiers.allures.lente',              mod: mod('tireur_allure_lente') },
  { val: 'tireur_allure_moyenne',  sitKey: 'tireur_allure_moyenne',  label: 'modifiers.allures.moyenne',            mod: mod('tireur_allure_moyenne') },
  { val: 'tireur_allure_rapide',   sitKey: 'tireur_allure_rapide',   label: 'modifiers.allures.rapide',             mod: mod('tireur_allure_rapide') },
  { val: 'tireur_allure_maximale', sitKey: 'tireur_allure_maximale', label: 'modifiers.allures.maximaleImpossible', mod: mod('tireur_allure_maximale') },
]

const CIBLE_ALLURES = [
  { val: 'cible_immobile',        sitKey: 'cible_immobile',        label: 'modifiers.allures.immobile', mod: mod('cible_immobile') },
  { val: 'cible_lente',           sitKey: null,                    label: 'modifiers.allures.lente',    mod: mod(null) },
  { val: 'cible_allure_moyenne',  sitKey: 'cible_allure_moyenne',  label: 'modifiers.allures.moyenne',  mod: mod('cible_allure_moyenne') },
  { val: 'cible_allure_rapide',   sitKey: 'cible_allure_rapide',  label: 'modifiers.allures.rapide',    mod: mod('cible_allure_rapide') },
  { val: 'cible_allure_maximale', sitKey: 'cible_allure_maximale', label: 'modifiers.allures.maximale', mod: mod('cible_allure_maximale') },
]

const COUVERTURES = [
  { key: 'couverture_partielle',  label: 'modifiers.couvertures.partielle',  mod: mod('couverture_partielle') },
  { key: 'couverture_importante', label: 'modifiers.couvertures.importante', mod: mod('couverture_importante') },
]

const OBSCURITES = [
  { key: 'obscurite_legere',     label: 'modifiers.obscurites.legere',     mod: mod('obscurite_legere') },
  { key: 'obscurite_importante', label: 'modifiers.obscurites.importante', mod: mod('obscurite_importante') },
  { key: 'obscurite_totale',     label: 'modifiers.obscurites.totale',     mod: mod('obscurite_totale') },
]

const TAILLES = [
  { key: 'minuscule',    label: 'cacModifiers.tailles.minuscule',   mod: -10 },
  { key: 'tres_petite',  label: 'cacModifiers.tailles.tresPetite',  mod: -5 },
  { key: 'petite',       label: 'cacModifiers.tailles.petite',      mod: -3 },
  { key: 'moyenne',      label: 'cacModifiers.tailles.moyenne',     mod: 0 },
  { key: 'grande',       label: 'cacModifiers.tailles.grande',      mod: 3 },
  { key: 'tres_grande',  label: 'cacModifiers.tailles.tresGrande',  mod: 5 },
  { key: 'enorme',       label: 'cacModifiers.tailles.enorme',      mod: 10 },
  { key: 'gigantesque',  label: 'cacModifiers.tailles.gigantesque', mod: 15 },
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
function fmtOpt(n, impossible = false) { return impossible ? '✗' : n > 0 ? `+${n}` : n === 0 ? '±0' : `${n}` }

export default function CombatModifiersWindow({ socket, assaultAction, activeRosterEntry, attackResult, onAttackConfirmed }) {
  const { t } = useTranslation('combat')
  const { actions } = useCombatStore()
  const tokens = useTokenStore(s => s.tokens)

  const { pos, onHeaderMouseDown } = useDraggable(
    'combat-modifiers-pos',
    { top: window.innerHeight - 540, left: window.innerWidth / 2 - 180 },
    360,
  )

  const [porteeOverride, setPorteeOverride] = useState(null)
  const [tireurAllureOverride, setTireurAllureOverride] = useState(null)
  const [cibleAllureOverride, setCibleAllureOverride] = useState(null)
  const [couvertures, setCouvertures] = useState([])
  const [obscurites, setObscurites] = useState([])
  const [taille, setTaille] = useState('moyenne')
  const [weaponSkill, setWeaponSkill] = useState(null)
  const [isRolling, setIsRolling] = useState(false)

  // Fallback tokens depuis attackResult si assaultAction est null (après avancement du slot)
  const tireurToken = tokens.find(tk => tk.id === (assaultAction?.token_id ?? attackResult?.tireurTokenId))
  const cibleToken  = tokens.find(tk => tk.id === (assaultAction?.target_token_id ?? attackResult?.cibleTokenId))
  const tireurCharId = tireurToken?.character_id ?? null
  const cibleCharId  = cibleToken?.character_id  ?? null

  // Reset quand un nouvel assaut passe en résolution
  useEffect(() => {
    setPorteeOverride(null)
    setTireurAllureOverride(null)
    setCibleAllureOverride(null)
    setCouvertures([])
    setObscurites([])
    setTaille('moyenne')
    setWeaponSkill(null)
    setIsRolling(false)
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

  // Pré-sélection taille si la cible est un drone (drone_sheet.taille en cm → clé TAILLES)
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
  }, [assaultAction?.id, cibleCharId])

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
  const isRushed          = activeRosterEntry?.state_vitesse === 'rushed'
  const tireurAllureDef   = TIREUR_ALLURES.find(a => a.val === tireurAllureVal)
  const cibleAllureDef    = CIBLE_ALLURES.find(a => a.val === cibleAllureVal)

  const porteeModComp   = PORTEES.find(p => p.key === effectivePortee)?.mod ?? 0
  const tireurAllureMod = tireurAllureDef?.mod ?? 0
  const cibleAllureMod  = cibleAllureDef?.mod ?? 0
  const couvertureMod   = couvertures.reduce((sum, k) => sum + (COUVERTURES.find(c => c.key === k)?.mod ?? 0), 0)
  const obscuriteMod    = obscurites.reduce((sum, k) => sum + (OBSCURITES.find(o => o.key === k)?.mod ?? 0), 0)
  const tailleModComp   = TAILLES.find(t => t.key === taille)?.mod ?? 0
  const totalModComp    = porteeModComp + tireurAllureMod + cibleAllureMod + couvertureMod + obscuriteMod + tailleModComp + (isRushed ? -5 : 0)
  const bonusDmg        = assaultAction?.fire_mode_bonus_dmg ?? 0

  // Situation courante (mêmes clés que celles envoyées au serveur) — construite une seule fois,
  // consultée par hasTirImpossible ET handleLancer, jamais deux logiques divergentes.
  const currentSituation = [
    ...(tireurAllureDef?.sitKey ? [tireurAllureDef.sitKey] : []),
    ...(cibleAllureDef?.sitKey  ? [cibleAllureDef.sitKey]  : []),
    ...couvertures,
    ...obscurites,
  ]
  // TIRIMP — autorité unique partagée avec le serveur (shared/combatSituationMods.js), plus de
  // sentinel -99 : le bouton se désactive sur le même flag `impossible` que le serveur rejettera.
  const hasTirImpossible = isImpossibleRangedSituation(currentSituation)

  const handleCouverture = (key) => {
    setCouvertures(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }
  const handleObscurite = (key) => {
    setObscurites(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const handleLancer = () => {
    if (!effectivePortee || hasTirImpossible || isRolling) return
    setIsRolling(true)
    socket?.emit(WS.COMBAT_ACTION_CONFIRM, {
      tokenId: activeRosterEntry.token_id,
      confirmedModifiers: { portee: effectivePortee, situation: currentSituation, taille },
    })
  }

  return (
    <div className="combat-float-win combat-float-win--gold" style={{ position: 'fixed', left: pos.left, top: pos.top, maxHeight: '80vh' }}>

      {/* Header — titre + pill */}
      <div className="combat-float-header" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }} onMouseDown={onHeaderMouseDown}>
        <span style={styles.headerTitle}>
          {t('modifiers.header', { shooter: tireurToken?.label ?? '?', target: cibleToken?.label ?? '?' })}
        </span>
        <div style={styles.pills}>
          <span style={{
            ...styles.pill,
            background: hasTirImpossible ? '#5a1010' : totalModComp >= 0 ? '#1a3a1a' : '#3a1a1a',
            color:      hasTirImpossible ? '#ff6060' : totalModComp >= 0 ? '#6dca6d' : '#ca6d6d',
          }}>
            {hasTirImpossible
              ? t('modifiers.impossibleShot')
              : weaponSkill?.skillLabel
                ? `${weaponSkill.skillLabel} ${weaponSkill.skillTotal ?? '?'} ${formatMod(totalModComp)}`
                : t('cacModifiers.compFallback', { mod: formatMod(totalModComp) })
            }
          </span>
          {bonusDmg !== 0 && (
            <span style={{ ...styles.pill, background: '#3a2a10', color: '#f5a842' }}>
              {t('modifiers.dmgTag', { mod: formatMod(bonusDmg) })}
            </span>
          )}
        </div>
      </div>

      {/* Banner résultat attaque — remplace le body après le lancer */}
      {attackResult && (
        <div style={{
          ...styles.attackBanner,
          background:   attackResult.hit ? 'rgba(91,141,238,0.12)' : 'rgba(200,60,60,0.12)',
          borderColor:  attackResult.hit ? '#5b8dee' : '#c83c3c',
          color:        attackResult.hit ? '#7ba8f0' : '#e06060',
        }}>
          <span style={styles.attackBannerResult}>
            {attackResult.hit ? t('modifiers.attackBanner.hit') : t('modifiers.attackBanner.missed')}
          </span>
          <span style={styles.attackBannerDetail}>
            {t('modifiers.attackBanner.detail', { roll: attackResult.roll, seuil: attackResult.seuil })}
          </span>
        </div>
      )}

      {/* Body — masqué après le lancer */}
      {!attackResult && (
        <div style={styles.body}>

          {/* Récapitulatif (lecture seule) */}
          <div style={styles.infoBlock}>
            {assaultAction?.fire_mode && (
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>{t('modifiers.fireModeLabel')}</span>
                <span style={styles.infoValue}>
                  {FIRE_MODE_LABELS[assaultAction.fire_mode] ? t(FIRE_MODE_LABELS[assaultAction.fire_mode]) : assaultAction.fire_mode}
                  {assaultAction.bullet_count > 1 ? ` — ${assaultAction.bullet_count}b` : ''}
                  {assaultAction.fire_mode_bonus_comp ? ` (+${assaultAction.fire_mode_bonus_comp} comp)` : ''}
                </span>
              </div>
            )}
            {isRushed && (
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>{t('modifiers.stateLabel')}</span>
                <span style={{ ...styles.infoValue, color: '#e55' }}>{t('modifiers.rushed')}</span>
              </div>
            )}
            {prefilledPortee?.distance !== undefined && (
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>{t('modifiers.distanceLabel')}</span>
                <span style={styles.infoValue}>{prefilledPortee.distance} m</span>
              </div>
            )}
          </div>

          {/* Portée */}
          <div className="combat-float-section">
            <div style={styles.sectionTitle}>{t('modifiers.porteeSection')}</div>
            <select
              value={effectivePortee ?? ''}
              onChange={e => setPorteeOverride(e.target.value || null)}
              style={styles.select}
            >
              {!effectivePortee && <option value="">{t('modifiers.choosePlaceholder')}</option>}
              {PORTEES.map(p => (
                <option key={p.key} value={p.key}>{t(p.label)} ({fmtOpt(p.mod)})</option>
              ))}
            </select>
          </div>

          {/* Allure tireur */}
          <div className="combat-float-section">
            <div style={styles.sectionTitle}>{t('modifiers.tireurAllureSection')}</div>
            <select
              value={tireurAllureVal}
              onChange={e => setTireurAllureOverride(e.target.value)}
              style={styles.select}
            >
              {TIREUR_ALLURES.map(a => (
                <option key={a.val} value={a.val}>{t(a.label)} ({fmtOpt(a.mod, isImpossible(a.sitKey))})</option>
              ))}
            </select>
          </div>

          {/* Allure cible */}
          <div className="combat-float-section">
            <div style={styles.sectionTitle}>{t('modifiers.cibleAllureSection')}</div>
            <select
              value={cibleAllureVal}
              onChange={e => setCibleAllureOverride(e.target.value)}
              style={styles.select}
            >
              {CIBLE_ALLURES.map(a => (
                <option key={a.val} value={a.val}>{t(a.label)} ({fmtOpt(a.mod)})</option>
              ))}
            </select>
          </div>

          {/* Couverture */}
          <div className="combat-float-section">
            <div style={styles.sectionTitle}>{t('modifiers.couvertureSection')}</div>
            {COUVERTURES.map(c => (
              <label key={c.key} style={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={couvertures.includes(c.key)}
                  onChange={() => handleCouverture(c.key)}
                  style={styles.checkbox}
                />
                <span style={styles.checkText}>
                  {t(c.label)}
                  <span style={{ ...styles.checkMod, color: '#ca6d6d' }}>{formatMod(c.mod)}</span>
                </span>
              </label>
            ))}
          </div>

          {/* Obscurité */}
          <div className="combat-float-section">
            <div style={styles.sectionTitle}>{t('modifiers.obscuriteSection')}</div>
            {OBSCURITES.map(o => (
              <label key={o.key} style={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={obscurites.includes(o.key)}
                  onChange={() => handleObscurite(o.key)}
                  style={styles.checkbox}
                />
                <span style={styles.checkText}>
                  {t(o.label)}
                  <span style={{ ...styles.checkMod, color: '#ca6d6d' }}>
                    {isImpossible(o.key) ? '✗' : formatMod(o.mod)}
                  </span>
                </span>
              </label>
            ))}
          </div>

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
      )}

      {/* Poignée bas */}
      <div onMouseDown={onHeaderMouseDown} style={styles.bottomHandle} />

      {/* Footer — 3 états : prêt / en cours / résultat */}
      <div className="combat-float-footer">
        {!attackResult && (
          <button
            className="btn btn-gold"
            style={{
              width: '100%',
              opacity: (effectivePortee && !hasTirImpossible && !isRolling) ? 1 : 0.4,
              cursor:  (effectivePortee && !hasTirImpossible && !isRolling) ? 'pointer' : 'not-allowed',
            }}
            onClick={handleLancer}
            disabled={!effectivePortee || hasTirImpossible || isRolling}
          >
            {isRolling ? t('cacModifiers.rolling') : t('damageWindow.rollButton')}
          </button>
        )}
        {attackResult && !attackResult.hit && (
          <button className="btn btn-ghost" style={{ width: '100%' }} onClick={onAttackConfirmed}>
            {t('damageWindow.closeButton')}
          </button>
        )}
      </div>

    </div>
  )
}

const styles = {
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
  attackBanner: {
    margin: '10px 14px',
    padding: '10px 14px',
    borderRadius: 6,
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  attackBannerResult: { fontSize: 14, fontWeight: 700 },
  attackBannerDetail: { fontSize: 11, opacity: 0.75 },
  bottomHandle: {
    height: 6, flexShrink: 0,
    background: 'rgba(90,100,120,0.12)',
    borderTop: '1px solid rgba(90,100,120,0.18)',
    cursor: 'ns-resize',
  },
}
