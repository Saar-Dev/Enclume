import { useState, useEffect, useRef } from 'react'
import { WS } from '../../../shared/events.js'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'
import api from '../lib/api'

// Slots arme — identiques à WEAPON_SLOTS serveur
const WEAPON_SLOTS = new Set(['MG', 'MD', '2M', 'Tr'])
const SLOT_LABELS  = { MG: 'MG', MD: 'MD', '2M': '2M', Tr: 'Tr' }

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
  const { phase, roster } = useCombatStore()
  const tokens            = useTokenStore(s => s.tokens)

  const [surprisedIds, setSurprisedIds] = useState([])
  const [excludedIds,  setExcludedIds]  = useState([])
  const [iniPreview,   setIniPreview]   = useState({})
  const [equipment,    setEquipment]    = useState({})   // tokenId → { characterId, weapon, armorPieces }
  const [refWeapons,   setRefWeapons]   = useState([])
  const [refArmors,    setRefArmors]    = useState([])
  const [openDropdown, setOpenDropdown] = useState(null) // { tokenId, kind:'weapon'|'armor', chip:null|'T'|'C'|'B'|'J' }

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
    setOpenDropdown(null)
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

  // ── Fermer dropdown au clic extérieur ──────────────────────────────────────
  const windowRef = useRef(null)
  useEffect(() => {
    if (!openDropdown) return
    const handler = e => { if (windowRef.current && !windowRef.current.contains(e.target)) setOpenDropdown(null) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openDropdown])

  return (
    <div ref={windowRef} style={S.window}>
      {/* HEADER */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <span style={S.title}>ROSTER COMBAT</span>
          {!inCombat && <span style={S.badge}>PRÉ-COMBAT</span>}
          {inCombat  && <span style={{ ...S.badge, background: '#1a2a1a', color: '#50c878', borderColor: '#50c878' }}>{phase}</span>}
        </div>
        <span style={S.participantCount}>{activeRows.length} participants</span>
      </div>

      {/* BANNIÈRE ALERTE */}
      {!inCombat && (noWeaponCnt > 0 || noArmorCnt > 0) && (
        <div style={S.alertBanner}>
          <span style={S.alertIcon}>⚠</span>
          <span style={S.alertLabel}>AVANT DÉMARRAGE</span>
          {noWeaponCnt > 0 && <span style={S.alertItem}>{noWeaponCnt} PNJ{noWeaponCnt > 1 ? 's' : ''} sans arme</span>}
          {noArmorCnt  > 0 && <span style={S.alertItem}>{noArmorCnt}  PNJ{noArmorCnt  > 1 ? 's' : ''} non protégé{noArmorCnt > 1 ? 's' : ''}</span>}
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
                <th style={S.th}>TOKEN</th>
                <th style={{ ...S.th, textAlign: 'center' }}>INI</th>
                {!inCombat && <th style={S.th}>ARME</th>}
                {!inCombat && <th style={S.th}>ARMURE</th>}
                <th style={{ ...S.th, textAlign: 'center' }}>SURPRIS</th>
                {!inCombat && <th style={{ ...S.th, textAlign: 'center' }}>INCLUS</th>}
              </tr>
            </thead>
            <tbody>
              {activeRows.map(row => {
                const charType = getCharType(row.tokenId)
                const isPnj    = charType === 'pnj'
                const eq       = equipment[row.tokenId]
                const isExcl   = row.excluded

                return (
                  <tr key={row.tokenId} style={{ opacity: isExcl ? 0.4 : 1 }}>

                    {/* TOKEN */}
                    <td style={S.td}>
                      <div style={S.tokenCell}>
                        {charType && (
                          <span style={{ ...S.badge, ...(isPnj ? S.badgePnj : S.badgePj) }}>
                            {isPnj ? 'PN' : 'PJ'}
                          </span>
                        )}
                        <span style={S.tokenLabel}>{row.label}</span>
                      </div>
                    </td>

                    {/* INI */}
                    <td style={{ ...S.td, textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 }}>
                      {row.base_ini != null ? row.base_ini : '—'}
                    </td>

                    {/* ARME */}
                    {!inCombat && (
                      <td style={S.td}>
                        {!charType ? null
                          : !isPnj ? (
                            // PJ — lecture seule
                            <span style={S.equippedText}>
                              {eq?.weapon ? `${eq.weapon.name} [${SLOT_LABELS[eq.weapon.slot] ?? eq.weapon.slot}]` : '— sans arme'}
                            </span>
                          ) : eq?.weapon ? (
                            // PNJ équipé
                            <span style={S.equippedGreen}>
                              <span style={S.dot}>●</span>{eq.weapon.name} <span style={S.slotTag}>[{SLOT_LABELS[eq.weapon.slot] ?? eq.weapon.slot}]</span>
                            </span>
                          ) : (
                            // PNJ sans arme — dropdown
                            <div style={S.dropdownWrap}>
                              <select
                                style={S.selectDanger}
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
                      <td style={S.td}>
                        {!charType ? null
                          : !isPnj ? (
                            <PjArmorChips armorPieces={eq?.armorPieces ?? []} />
                          ) : (eq?.armorPieces ?? []).length === 0 ? (
                            // PNJ sans armure — wrapper amber + dropdown général
                            <div style={S.dropdownWrap}>
                              <select
                                style={S.selectWarn}
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
                              openDropdown={openDropdown?.tokenId === row.tokenId ? openDropdown : null}
                              onChipClick={chip => setOpenDropdown({ tokenId: row.tokenId, chip })}
                              onSelect={(equipmentId, chip) => {
                                const cid = equipment[row.tokenId]?.characterId
                                handleQuickEquip(row.tokenId, cid, equipmentId, chipToSlot(chip))
                              }}
                            />
                          )
                        }
                      </td>
                    )}

                    {/* SURPRIS */}
                    <td style={{ ...S.td, textAlign: 'center' }}>
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
                      <td style={{ ...S.td, textAlign: 'center' }}>
                        <input type="checkbox" checked={!row.excluded}
                          onChange={() => toggleExcluded(row.tokenId)}
                          style={{ cursor: isExcl ? 'pointer' : 'pointer', accentColor: '#5b8dee' }} />
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
          style={{ ...S.btnStart, ...(activeRows.length === 0 ? S.btnDisabled : {}) }}
          onClick={handleStart}
          disabled={activeRows.length === 0}
        >
          DÉMARRER LE COMBAT ({activeRows.length})
        </button>
      )}
      {inCombat && phase === 'ROSTER' && (
        <button style={S.btnAnnounce} onClick={handleAnnounceStart}>
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
          style={{ ...S.chip, ...(coverage[chip] ? S.chipPjFilled : S.chipPjEmpty) }}
        >
          {chip}
        </span>
      ))}
    </div>
  )
}

function PnjArmorChips({ armorPieces, refArmors, openDropdown, onChipClick, onSelect }) {
  const { coverage, tips } = mergeArmorPieces(armorPieces)
  return (
    <div style={S.chips}>
      {ARMOR_CHIPS.map(chip => {
        const isOpen = openDropdown?.chip === chip
        const filteredArmors = refArmors.filter(a => a.location?.split('/').includes(chip))
        return (
          <div key={chip} style={{ position: 'relative' }}>
            <span
              title={tips[chip]?.join(', ') || undefined}
              style={{
                ...S.chip,
                ...(coverage[chip] ? S.chipPnjFilled : S.chipPnjGap),
                cursor: coverage[chip] ? 'default' : 'pointer',
              }}
              onClick={() => !coverage[chip] && onChipClick(chip)}
            >
              {chip}
            </span>
            {isOpen && (
              <div style={S.chipDropdown}>
                {filteredArmors.length === 0
                  ? <div style={S.chipDropdownEmpty}>Aucun item disponible</div>
                  : filteredArmors.map(a => (
                      <div key={a.id} style={S.chipDropdownItem}
                        onClick={() => onSelect(a.id, chip)}>
                        {a.name}
                      </div>
                    ))
                }
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  window: {
    position: 'absolute', top: 60, right: 16,
    width: 560,
    background: '#0d0f18',
    border: '1px solid #1e2435',
    borderRadius: 6,
    boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
    pointerEvents: 'auto',
    maxHeight: 'calc(100vh - 80px)',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: 'Inter, system-ui',
  },

  // Header
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #1e2435', background: '#080a12', flexShrink: 0 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  title: { fontSize: 11, letterSpacing: '0.15em', fontWeight: 700, color: '#3a8aaa' },
  badge: { fontSize: 9, letterSpacing: '0.08em', padding: '2px 6px', borderRadius: 2, border: '1px solid #aa6030', color: '#e8a060', background: '#1a1008', fontWeight: 600 },
  badgePj:  { background: '#0a1a0a', color: '#50c878', borderColor: '#50c878', letterSpacing: '0.05em' },
  badgePnj: { background: '#1a0a08', color: '#c86030', borderColor: '#c86030', letterSpacing: '0.05em' },
  participantCount: { fontSize: 10, color: '#3a4a5a', fontFamily: 'monospace', fontStyle: 'italic' },

  // Alert banner
  alertBanner: { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', background: '#1a1008', borderBottom: '1px solid #aa6030', flexShrink: 0 },
  alertIcon:   { fontSize: 11, color: '#c86030' },
  alertLabel:  { fontSize: 9, letterSpacing: '0.12em', color: '#6a4a20', fontWeight: 700 },
  alertItem:   { fontSize: 10, color: '#e8a060', fontWeight: 600 },

  // Table
  tableWrap: { flex: 1, overflowY: 'auto', minHeight: 0 },
  table:     { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '6px 10px', fontSize: 9, color: '#3a8aaa', letterSpacing: '0.1em', textAlign: 'left', borderBottom: '1px solid #1e2435', background: '#080a12', position: 'sticky', top: 0, zIndex: 1, whiteSpace: 'nowrap' },
  td: { padding: '6px 10px', fontSize: 11, color: '#c0c8d0', borderBottom: '1px solid #10141e', verticalAlign: 'middle' },

  // Token cell
  tokenCell:   { display: 'flex', alignItems: 'center', gap: 6 },
  tokenLabel:  { fontSize: 11, color: '#c0c8d0' },

  // Equipment text
  equippedText:  { fontSize: 10, color: '#4a5a6a', fontStyle: 'italic' },
  equippedGreen: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#90c090' },
  dot:           { color: '#50c878', fontSize: 8 },
  slotTag:       { color: '#4a6a4a', fontSize: 9 },

  // Dropdown
  dropdownWrap: { position: 'relative' },
  selectDanger: {
    width: '100%', padding: '3px 6px', fontSize: 10,
    background: '#1a0808', border: '1px solid #aa3030', borderRadius: 2,
    color: '#e08080', cursor: 'pointer', outline: 'none',
  },
  selectWarn: {
    width: '100%', padding: '3px 6px', fontSize: 10,
    background: '#1a1208', border: '1px solid #aa6030', borderRadius: 2,
    color: '#e0a060', cursor: 'pointer', outline: 'none',
  },

  // Armor chips
  chips: { display: 'flex', gap: 3, alignItems: 'center' },
  chip:  { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, fontSize: 9, fontWeight: 700, borderRadius: 2, fontFamily: 'monospace', userSelect: 'none' },
  chipPjFilled:  { background: '#1a2030', color: '#5a6a7a', border: '1px solid #2a3a4a' },
  chipPjEmpty:   { background: 'transparent', color: '#2a3a4a', border: '1px solid #1a2030' },
  chipPnjFilled: { background: '#0a2010', color: '#50c878', border: '1px solid #2a6040' },
  chipPnjGap:    { background: 'transparent', color: '#4a2020', border: '1px solid #6a2020' },

  // Chip dropdown custom
  chipDropdown: { position: 'absolute', top: 22, left: 0, zIndex: 10, background: '#0d1018', border: '1px solid #2a3a4a', borderRadius: 3, minWidth: 180, maxHeight: 160, overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.6)' },
  chipDropdownEmpty: { padding: '6px 10px', fontSize: 10, color: '#4a5a6a', fontStyle: 'italic' },
  chipDropdownItem:  { padding: '5px 10px', fontSize: 10, color: '#aaccdd', cursor: 'pointer', borderBottom: '1px solid #1a2030' },

  // Exclus
  excludedSection: { padding: '8px 14px', borderTop: '1px solid #1e2435', background: 'rgba(0,0,0,0.15)', flexShrink: 0 },
  excludedLabel:   { display: 'block', fontSize: 9, color: '#3a4a5a', letterSpacing: '0.1em', marginBottom: 5 },
  excludedRow:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0' },
  excludedName:    { fontSize: 11, color: '#3a4a5a', textDecoration: 'line-through' },
  btnReinclude:    { background: 'none', border: '1px solid #1e2435', borderRadius: 2, color: '#3a8aaa', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '1px 6px' },

  // Boutons footer
  btnStart:   { display: 'block', width: '100%', padding: '11px 14px', background: 'rgba(58,138,170,0.1)', border: 'none', borderTop: '1px solid #1e2435', color: '#3a8aaa', fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.1em', flexShrink: 0 },
  btnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  btnAnnounce: { display: 'block', width: '100%', padding: '11px 14px', background: 'rgba(80,200,120,0.1)', border: 'none', borderTop: '1px solid #1e2435', color: '#50c878', fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.1em', flexShrink: 0 },

  empty: { padding: '14px', color: '#3a4a5a', fontSize: 12, margin: 0 },
}
