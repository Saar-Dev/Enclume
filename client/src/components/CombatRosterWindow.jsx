import { useState, useEffect } from 'react'
import { WS } from '../../../shared/events.js'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'
import { useDraggable } from '../lib/useDraggable.js'
import api from '../lib/api'

const SLOT_LABELS = { MG: 'MG', MD: 'MD', '2M': '2M', Tr: 'Tr' }

// Chips armure : T C B J
const ARMOR_CHIPS = ['T', 'C', 'B', 'J']

// Calcule la couverture T/C/B/J depuis ref_equipment.location
function getCoverage(location) {
  if (!location) return {}
  const parts = new Set(location.split('/'))
  return { T: parts.has('T'), C: parts.has('C'), B: parts.has('B'), J: parts.has('J') }
}

// Fusionne les armurePieces d'un PNJ → coverage + tooltips par chip
function mergeArmorPieces(pieces) {
  const coverage = { T: false, C: false, B: false, J: false }
  const tips     = { T: [],    C: [],    B: [],    J: []    }
  for (const p of pieces) {
    const cov = getCoverage(p.location)
    for (const chip of ARMOR_CHIPS) {
      if (cov[chip]) { coverage[chip] = true; tips[chip].push(p.name) }
    }
  }
  return { coverage, tips }
}

// Slot char_inventory pour équiper via un chip donné
function chipToSlot(chip) {
  return { T: 'T', C: 'C', B: 'BD', J: 'JD' }[chip]
}

// Slot par défaut pour une armure sélectionnée depuis le dropdown général
function defaultArmorSlot(location) {
  if (!location) return 'C'
  const parts = location.split('/')
  if (parts.includes('C')) return 'C'
  if (parts.includes('B')) return 'BD'
  if (parts.includes('J')) return 'JD'
  if (parts.includes('T')) return 'T'
  return 'C'
}

// Filtrer les armes ref_equipment pour un dropdown
// Exclure accessoires, grenades, lanceurs pour le quick-equip
const WEAPON_FAMILIES_EXCLUDE = new Set(['Accessoires pour armes', 'Grenade', 'Lanceur'])

export default function CombatRosterWindow({ socket, battlemapId, characters }) {
  const { phase, roster, currentTurn } = useCombatStore()
  const tokens            = useTokenStore(s => s.tokens)

  const { pos, onHeaderMouseDown } = useDraggable(
    'combat-roster-pos',
    { top: 60, left: window.innerWidth - 576 },
    560,
  )

  const [surprisedIds, setSurprisedIds] = useState([])
  const [excludedIds,  setExcludedIds]  = useState([])
  const [iniPreview,   setIniPreview]   = useState({})
  const [equipment,    setEquipment]    = useState({})   // tokenId → { characterId, weapon, armorPieces }
  const [refWeapons,   setRefWeapons]   = useState([])
  const [refArmors,    setRefArmors]    = useState([])

  const inCombat = phase !== null

  // ── Fetches parallèles au montage (pré-combat uniquement) ──────────────────
  useEffect(() => {
    if (!battlemapId || inCombat) return
    Promise.all([
      api.get(`/battlemaps/${battlemapId}/combat-ini`),
      api.get(`/battlemaps/${battlemapId}/combat-equipment`),
      api.get('/equipment?family=Armes'),
      api.get('/equipment?family=Protections'),
    ]).then(([ini, equip, arms, armors]) => {
      const map = {}
      for (const { token_id, base_ini } of ini.data.iniPreview) map[token_id] = base_ini
      setIniPreview(map)
      setEquipment(equip.data.equipment ?? {})
      setRefWeapons(arms.data.items.filter(i => !WEAPON_FAMILIES_EXCLUDE.has(i.category)))
      setRefArmors(armors.data.items)
    }).catch(() => {})
  }, [battlemapId, inCombat])

  // ── Handlers sélection ─────────────────────────────────────────────────────
  const toggleSurprised = id => setSurprisedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const toggleExcluded  = id => setExcludedIds(p  => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const handleStart = () => {
    if (!socket || !battlemapId) return
    socket.emit(WS.COMBAT_START, {
      battlemap_id:      battlemapId,
      surprisedTokenIds: surprisedIds,
      excludedTokenIds:  excludedIds,
    })
  }

  const handleAnnounceStart = () => socket?.emit(WS.COMBAT_ANNOUNCE_START)

  // ── Quick equip ────────────────────────────────────────────────────────────
  const handleQuickEquip = async (tokenId, characterId, equipmentId, slot) => {
    try {
      await api.post(`/char-sheet/${characterId}/quick-equip`, { equipment_id: equipmentId, slot })
      // Rafraîchir l'équipement du token localement
      const res = await api.get(`/battlemaps/${battlemapId}/combat-equipment`)
      setEquipment(res.data.equipment ?? {})
    } catch (e) {
      console.error('[QuickEquip]', e?.response?.data?.error?.message ?? e.message)
    }
  }

  // ── Helpers identification ─────────────────────────────────────────────────
  const getCharType = tokenId => {
    const token = tokens.find(t => t.id === tokenId)
    if (!token?.character_id) return null
    return characters?.find(c => c.id === token.character_id)?.type ?? null
  }

  // ── Lignes affichées ───────────────────────────────────────────────────────
  const previewRows = inCombat
    ? roster.map(entry => {
        const token = tokens.find(t => t.id === entry.token_id)
        return { tokenId: entry.token_id, label: token?.label ?? entry.token_id, base_ini: entry.base_ini, is_surprised: entry.is_surprised, excluded: false }
      })
    : tokens.map(token => ({
        tokenId:      token.id,
        label:        token.label ?? token.id,
        base_ini:     iniPreview[token.id] ?? null,
        is_surprised: surprisedIds.includes(token.id),
        excluded:     excludedIds.includes(token.id),
      }))

  const activeRows   = inCombat ? previewRows : previewRows.filter(r => !r.excluded)
  const excludedRows = inCombat ? [] : previewRows.filter(r => r.excluded)

  // Comptages pour la bannière d'alerte
  const pnjRows      = activeRows.filter(r => getCharType(r.tokenId) === 'pnj')
  const noWeaponCnt  = pnjRows.filter(r => !equipment[r.tokenId]?.weapon).length
  const noArmorCnt   = pnjRows.filter(r => (equipment[r.tokenId]?.armorPieces ?? []).length === 0).length

  return (
    <div className="combat-win" style={{ width: 560, left: pos.left, top: pos.top }}>
      {/* HEADER */}
      <div className="combat-win-header" onMouseDown={onHeaderMouseDown}>
        <div style={S.headerLeft}>
          <span className="combat-win-title">ROSTER COMBAT</span>
          {!inCombat && <span className="combat-badge-pnj">PRÉ-COMBAT</span>}
          {inCombat  && <span className="combat-badge-pj">{phase}</span>}
        </div>
        <span style={S.participantCount}>{activeRows.length} participants</span>
      </div>

      {/* BANNIÈRE ALERTE */}
      {!inCombat && (noWeaponCnt > 0 || noArmorCnt > 0) && (
        <div className="combat-win-alert">
          <span style={S.alertIcon}>⚠</span>
          <span className="combat-win-alert-label">AVANT DÉMARRAGE</span>
          {noWeaponCnt > 0 && <span className="combat-win-alert-item">{noWeaponCnt} PNJ{noWeaponCnt > 1 ? 's' : ''} sans arme</span>}
          {noArmorCnt  > 0 && <span className="combat-win-alert-item">{noArmorCnt}  PNJ{noArmorCnt  > 1 ? 's' : ''} non protégé{noArmorCnt > 1 ? 's' : ''}</span>}
        </div>
      )}

      {/* TABLE */}
      {activeRows.length === 0 && (
        <p style={S.empty}>Aucun token sur la carte.</p>
      )}
      {activeRows.length > 0 && (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th className="combat-win-th">TOKEN</th>
                <th className="combat-win-th" style={{ textAlign: 'center' }}>INI</th>
                {!inCombat && <th className="combat-win-th">ARME</th>}
                {!inCombat && <th className="combat-win-th">ARMURE</th>}
                {phase === 'ROSTER' && <th className="combat-win-th" style={{ textAlign: 'center' }}>ÉTAT INIT</th>}
                <th className="combat-win-th" style={{ textAlign: 'center' }}>SURPRIS</th>
                {!inCombat && <th className="combat-win-th" style={{ textAlign: 'center' }}>INCLUS</th>}
              </tr>
            </thead>
            <tbody>
              {activeRows.map(row => {
                const charType      = getCharType(row.tokenId)
                const isPnj         = charType === 'pnj'
                const isDrone       = charType === 'drone'
                const eq            = equipment[row.tokenId]
                const isExcl        = row.excluded
                const rEntry        = inCombat ? roster.find(e => e.token_id === row.tokenId) : null
                const initConfirmed = rEntry?.state_character?.init_state_confirmed === true

                return (
                  <tr key={row.tokenId} style={{ opacity: isExcl ? 0.4 : 1 }}>

                    {/* TOKEN */}
                    <td className="combat-win-td">
                      <div style={S.tokenCell}>
                        {charType && (
                          <span className={isDrone ? 'combat-badge-drone' : isPnj ? 'combat-badge-pnj' : 'combat-badge-pj'}>
                            {isDrone ? 'DR' : isPnj ? 'PN' : 'PJ'}
                          </span>
                        )}
                        <span style={S.tokenLabel}>{row.label}</span>
                        {inCombat && rEntry?.state_character?.is_stunned === true && (
                          <span title="Assommé" style={{ fontSize: 9, color: '#f5c542', marginLeft: 4, fontWeight: 600 }}>
                            ☠ étourdi ({Math.max(0, (rEntry.state_character.stunned_until_turn ?? 0) - currentTurn)} t.)
                          </span>
                        )}
                      </div>
                    </td>

                    {/* INI */}
                    <td className="combat-win-td" style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 }}>
                      {row.base_ini != null ? row.base_ini : '—'}
                    </td>

                    {/* ARME */}
                    {!inCombat && (
                      <td className="combat-win-td">
                        {!charType ? null
                          : !isPnj ? (
                            // PJ — lecture seule
                            <span style={S.equippedText}>
                              {eq?.weapon ? `${eq.weapon.name} [${SLOT_LABELS[eq.weapon.slot] ?? eq.weapon.slot}]` : '— sans arme'}
                            </span>
                          ) : eq?.weapon ? (
                            // PNJ équipé
                            <span className="combat-equip-ok">
                              <span className="combat-equip-dot" />{eq.weapon.name} <span style={S.slotTag}>[{SLOT_LABELS[eq.weapon.slot] ?? eq.weapon.slot}]</span>
                            </span>
                          ) : (
                            // PNJ sans arme — dropdown
                            <div style={S.dropdownWrap}>
                              <select
                                className="combat-select-danger"
                                value=""
                                onChange={e => {
                                  if (!e.target.value) return
                                  const slot = eq?.weapon ? 'MG' : 'MD'
                                  handleQuickEquip(row.tokenId, eq?.characterId ?? equipment[row.tokenId]?.characterId, e.target.value, slot)
                                }}
                              >
                                <option value="">⚠ Choisir une arme</option>
                                {refWeapons.map(w => (
                                  <option key={w.id} value={w.id}>{w.name} ({w.category})</option>
                                ))}
                              </select>
                            </div>
                          )
                        }
                      </td>
                    )}

                    {/* ARMURE — chips T C B J */}
                    {!inCombat && (
                      <td className="combat-win-td">
                        {!charType ? null
                          : !isPnj ? (
                            <PjArmorChips armorPieces={eq?.armorPieces ?? []} />
                          ) : (eq?.armorPieces ?? []).length === 0 ? (
                            // PNJ sans armure — wrapper amber + dropdown général
                            <div style={S.dropdownWrap}>
                              <select
                                className="combat-select-warn"
                                value=""
                                onChange={e => {
                                  if (!e.target.value) return
                                  const item = refArmors.find(a => a.id === e.target.value)
                                  const slot = defaultArmorSlot(item?.location)
                                  handleQuickEquip(row.tokenId, eq?.characterId ?? equipment[row.tokenId]?.characterId, e.target.value, slot)
                                }}
                              >
                                <option value="">⚠ T C B J ▾</option>
                                {refArmors.map(a => (
                                  <option key={a.id} value={a.id}>{a.name} ({a.location ?? '?'})</option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            // PNJ avec armure — chips cliquables
                            <PnjArmorChips
                              armorPieces={eq.armorPieces}
                              refArmors={refArmors}
                              onSelect={(equipmentId, chip) => {
                                const cid = equipment[row.tokenId]?.characterId
                                handleQuickEquip(row.tokenId, cid, equipmentId, chipToSlot(chip))
                              }}
                            />
                          )
                        }
                      </td>
                    )}

                    {/* ÉTAT INIT */}
                    {phase === 'ROSTER' && (
                      <td className="combat-win-td" style={{ textAlign: 'center' }}>
                        {charType === 'pj'
                          ? (initConfirmed
                            ? <span style={S.initConfirmed}>✓</span>
                            : <span style={S.initPending}>·</span>)
                          : <span style={S.initNA}>—</span>
                        }
                      </td>
                    )}

                    {/* SURPRIS */}
                    <td className="combat-win-td" style={{ textAlign: 'center' }}>
                      {inCombat
                        ? (row.is_surprised ? '⚠' : '—')
                        : (
                          <input type="checkbox" checked={row.is_surprised}
                            onChange={() => toggleSurprised(row.tokenId)}
                            style={{ cursor: 'pointer', accentColor: '#c86030' }} />
                        )
                      }
                    </td>

                    {/* INCLUS */}
                    {!inCombat && (
                      <td className="combat-win-td" style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={!row.excluded}
                          onChange={() => toggleExcluded(row.tokenId)}
                          style={{ cursor: 'pointer', accentColor: '#5b8dee' }} />
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* EXCLUS */}
      {excludedRows.length > 0 && (
        <div style={S.excludedSection}>
          <span style={S.excludedLabel}>Exclus</span>
          {excludedRows.map(row => (
            <div key={row.tokenId} style={S.excludedRow}>
              <span style={S.excludedName}>{row.label}</span>
              <button style={S.btnReinclude} onClick={() => toggleExcluded(row.tokenId)}>+</button>
            </div>
          ))}
        </div>
      )}

      {/* FOOTER */}
      {!inCombat && (
        <button
          className="btn-tac"
          onClick={handleStart}
          disabled={activeRows.length === 0}
        >
          DÉMARRER LE COMBAT ({activeRows.length})
        </button>
      )}
      {inCombat && phase === 'ROSTER' && (
        <button className="btn-tac-confirm" onClick={handleAnnounceStart}>
          Passer en Annonce →
        </button>
      )}
    </div>
  )
}

// ─── Sous-composants chips ────────────────────────────────────────────────────

function PjArmorChips({ armorPieces }) {
  const { coverage, tips } = mergeArmorPieces(armorPieces)
  return (
    <div style={S.chips}>
      {ARMOR_CHIPS.map(chip => (
        <span
          key={chip}
          title={tips[chip]?.join(', ') || undefined}
          className={coverage[chip] ? 'combat-chip combat-chip-pj' : 'combat-chip combat-chip-pj-empty'}
        >
          {chip}
        </span>
      ))}
    </div>
  )
}

function PnjArmorChips({ armorPieces, refArmors, onSelect }) {
  const { coverage, tips } = mergeArmorPieces(armorPieces)
  const [openChip, setOpenChip] = useState(null)
  return (
    <div style={S.chips}>
      {ARMOR_CHIPS.map(chip => {
        const filteredArmors = refArmors.filter(a => a.location?.split('/').includes(chip))
        if (coverage[chip]) {
          return (
            <span key={chip} title={tips[chip]?.join(', ') || undefined}
              className="combat-chip combat-chip-pnj">
              {chip}
            </span>
          )
        }
        if (openChip === chip) {
          return (
            <select key={chip}
              className="combat-select-warn"
              style={{ width: 130, fontSize: 9, padding: '2px 4px' }}
              defaultValue=""
              autoFocus
              onChange={e => { if (e.target.value) { onSelect(e.target.value, chip); setOpenChip(null) } }}
              onBlur={() => setOpenChip(null)}
            >
              <option value="" disabled>{chip} ▾</option>
              {filteredArmors.length === 0
                ? <option disabled>Aucun item</option>
                : filteredArmors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)
              }
            </select>
          )
        }
        return (
          <span key={chip}
            className="combat-chip combat-chip-pnj-gap"
            style={{ cursor: 'pointer' }}
            onClick={() => setOpenChip(chip)}
          >
            {chip}
          </span>
        )
      })}
    </div>
  )
}

// ─── Styles résiduels (non migrés — layout local ou trop spécifiques) ─────────
const S = {
  participantCount: { fontSize: 10, color: '#3a4a5a', fontFamily: 'monospace', fontStyle: 'italic' },
  headerLeft:       { display: 'flex', alignItems: 'center', gap: 8 },
  alertIcon:        { fontSize: 11, color: '#c86030' },
  tableWrap:        { flex: 1, overflowY: 'auto', minHeight: 0 },
  table:            { width: '100%', borderCollapse: 'collapse' },
  tokenCell:        { display: 'flex', alignItems: 'center', gap: 6 },
  tokenLabel:       { fontSize: 11, color: '#c0c8d0' },
  equippedText:     { fontSize: 10, color: '#4a5a6a', fontStyle: 'italic' },
  slotTag:          { color: '#4a6a4a', fontSize: 9 },
  dropdownWrap:     { position: 'relative' },
  chips:            { display: 'flex', gap: 3, alignItems: 'center' },
  excludedSection:  { padding: '8px 14px', borderTop: '1px solid #1e2435', background: 'rgba(0,0,0,0.15)', flexShrink: 0 },
  excludedLabel:    { display: 'block', fontSize: 9, color: '#3a4a5a', letterSpacing: '0.1em', marginBottom: 5 },
  excludedRow:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0' },
  excludedName:     { fontSize: 11, color: '#3a4a5a', textDecoration: 'line-through' },
  btnReinclude:     { background: 'none', border: '1px solid #1e2435', borderRadius: 2, color: '#3a8aaa', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '1px 6px' },
  initConfirmed:    { color: '#50c878', fontWeight: 700 },
  initPending:      { color: '#3a4a5a', fontSize: 16, lineHeight: 1 },
  initNA:           { color: '#2a3a4a' },
  empty:            { padding: '14px', color: '#3a4a5a', fontSize: 12, margin: 0 },
}
