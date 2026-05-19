import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../lib/api.js'

const CONTAINER_ORDER = ['Sac', 'Ceinture', 'Coffre']
const VALID_SLOTS     = ['T', 'C', 'BG', 'BD', 'JG', 'JD', 'MG', 'MD', '2M', 'Tr']

export default function InventoryPanel({ characterId, canEdit, isGm, onInventoryMutated = () => {} }) {
  const [items,       setItems]       = useState([])
  const [sols,        setSols]        = useState(0)
  const [totalWeight, setTotalWeight] = useState(0)
  const [iniPenalty,  setIniPenalty]  = useState(0)
  const [threshold,   setThreshold]   = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [editingSols, setEditingSols] = useState(false)
  const [solsInput,   setSolsInput]   = useState('0')

  // ── Catalogue GM ──────────────────────────────────────────────────────────
  const [addOpen,       setAddOpen]       = useState(false)
  const [catalog,       setCatalog]       = useState([])
  const [catalogLoaded, setCatalogLoaded] = useState(false)
  const [searchQuery,   setSearchQuery]   = useState('')
  const [selectedRef,   setSelectedRef]   = useState(null)  // item ref_equipment sélectionné
  const [addQty,        setAddQty]        = useState(1)
  const [addContainer,  setAddContainer]  = useState('Coffre')
  const [adding,        setAdding]        = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.get(`/char-sheet/${characterId}/inventory`)
      .then(res => {
        if (cancelled) return
        setItems(res.data.items)
        setSols(res.data.sols)
        setSolsInput(String(res.data.sols))
        setTotalWeight(res.data.total_weight)
        setIniPenalty(res.data.ini_penalty)
        setThreshold(res.data.threshold)
      })
      .catch(err => console.error('Erreur chargement inventaire :', err))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [characterId])

  const availableContainers = useMemo(() => {
    const list = ['Coffre']
    if (items.some(i => i.ref_location === 'D'))  list.unshift('Sac')
    if (items.some(i => i.ref_location === 'Ce')) {
      const idx = list.indexOf('Coffre')
      list.splice(idx, 0, 'Ceinture')
    }
    return list
  }, [items])

  // ── Handlers inventaire ───────────────────────────────────────────────────

  const handleMoveContainer = useCallback(async (itemId, newContainer) => {
    try {
      const res = await api.put(`/char-sheet/${characterId}/inventory/${itemId}`, { container: newContainer })
      const updated = res.data.item
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, container: updated.container } : i))
      onInventoryMutated()
    } catch (err) {
      console.error('Erreur déplacement container :', err)
    }
  }, [characterId, onInventoryMutated])

  const handleEquip = useCallback(async (itemId, newSlot) => {
    try {
      const res = await api.put(`/char-sheet/${characterId}/inventory/${itemId}`, { slot: newSlot })
      const updated = res.data.item
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, slot: updated.slot, container: updated.container } : i))
      onInventoryMutated()
    } catch (err) {
      console.error('Erreur équipement :', err)
    }
  }, [characterId, onInventoryMutated])

  const handleDelete = useCallback(async (itemId) => {
    try {
      await api.delete(`/char-sheet/${characterId}/inventory/${itemId}`)
      setItems(prev => prev.filter(i => i.id !== itemId))
      onInventoryMutated()
    } catch (err) {
      console.error('Erreur suppression item :', err)
    }
  }, [characterId, onInventoryMutated])

  const handleSolsSave = useCallback(async () => {
    setEditingSols(false)
    const value = parseInt(solsInput, 10)
    if (isNaN(value) || value < 0 || value === sols) { setSolsInput(String(sols)); return }
    try {
      const res = await api.put(`/char-sheet/${characterId}/sols`, { sols: value })
      setSols(res.data.sols)
      setSolsInput(String(res.data.sols))
    } catch (err) {
      console.error('Erreur sauvegarde sols :', err)
      setSolsInput(String(sols))
    }
  }, [characterId, sols, solsInput])

  // ── Handlers catalogue GM ─────────────────────────────────────────────────

  const handleToggleAdd = useCallback(async (currentAvailableContainers) => {
    if (!addOpen && !catalogLoaded) {
      try {
        const res = await api.get('/equipment')
        setCatalog(res.data.items)
        setCatalogLoaded(true)
      } catch (err) {
        console.error('Erreur chargement catalogue :', err)
      }
    }
    setAddOpen(prev => !prev)
    setSelectedRef(null)
    setSearchQuery('')
    setAddQty(1)
    setAddContainer(currentAvailableContainers[0] || 'Coffre')
  }, [addOpen, catalogLoaded])

  const handleSelectRef = useCallback((refItem) => {
    setSelectedRef(refItem)
    setAddQty(1)
    setAddContainer('Coffre')
  }, [])

  const handleConfirmAdd = useCallback(async () => {
    if (!selectedRef) return
    setAdding(true)
    try {
      const res = await api.post(`/char-sheet/${characterId}/inventory`, {
        equipment_id: selectedRef.id,
        container:    addContainer,
        quantity:     addQty,
      })
      const newItem = res.data.item
      setItems(prev => {
        const existing = prev.find(i => i.id === newItem.id)
        if (existing) return prev.map(i => i.id === newItem.id ? newItem : i)
        return [...prev, newItem]
      })
      // Recalculer les stats côté client (simple refresh)
      const inv = await api.get(`/char-sheet/${characterId}/inventory`)
      setTotalWeight(inv.data.total_weight)
      setIniPenalty(inv.data.ini_penalty)
      setThreshold(inv.data.threshold)
      setSelectedRef(null)
      setSearchQuery('')
      onInventoryMutated()
    } catch (err) {
      console.error('Erreur ajout item :', err)
    } finally {
      setAdding(false)
    }
  }, [characterId, selectedRef, addContainer, addQty, onInventoryMutated])

  // ── Filtre catalogue ──────────────────────────────────────────────────────

  const filteredCatalog = useMemo(() => {
    if (!searchQuery.trim()) return catalog.slice(0, 50)
    const q = searchQuery.toLowerCase()
    return catalog.filter(i =>
      i.name.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q) ||
      i.family.toLowerCase().includes(q)
    ).slice(0, 50)
  }, [catalog, searchQuery])

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (loading) return <div style={{ color: '#5a5a7a', fontSize: 12, padding: '16px 0' }}>Chargement inventaire…</div>

  const itemsByContainer = {}
  for (const c of CONTAINER_ORDER) itemsByContainer[c] = []
  for (const item of items) {
    const bucket = itemsByContainer[item.container] ?? (itemsByContainer[item.container] = [])
    bucket.push(item)
  }

  return (
    <div style={s.root}>
      <div style={s.separator} />

      {/* ── Header stats ───────────────────────────────────────────────── */}
      <div style={s.header}>
        <span style={s.statLabel}>
          Poids :&nbsp;
          <span style={{ color: iniPenalty > 0 ? '#FF6B6B' : '#c0c0d0' }}>
            {totalWeight.toFixed(1)} kg
          </span>
          <span style={{ color: '#4a4a60' }}> / {threshold.toFixed(1)} kg</span>
        </span>
        {iniPenalty > 0 && (
          <span style={{ ...s.statLabel, color: '#FF6B6B' }}>Malus INI : -{iniPenalty}</span>
        )}
        <span style={{ ...s.statLabel, display: 'flex', alignItems: 'center', gap: 4 }}>
          Sol :&nbsp;
          {editingSols && canEdit ? (
            <input
              style={s.solsInput}
              value={solsInput}
              onChange={e => setSolsInput(e.target.value)}
              onBlur={handleSolsSave}
              onKeyDown={e => {
                if (e.code === 'Enter')  { e.preventDefault(); handleSolsSave() }
                if (e.code === 'Escape') { setSolsInput(String(sols)); setEditingSols(false) }
              }}
              autoFocus
            />
          ) : (
            <span
              style={{ color: '#c0c0d0', cursor: canEdit ? 'pointer' : 'default', textDecoration: canEdit ? 'underline dotted' : 'none' }}
              onClick={() => { if (canEdit) { setSolsInput(String(sols)); setEditingSols(true) } }}
            >
              {sols}
            </span>
          )}
        </span>
      </div>

      {/* ── Items par container ────────────────────────────────────────── */}
      {CONTAINER_ORDER.map(container => {
        const list = itemsByContainer[container]
        if (!list?.length) return null
        return (
          <div key={container} style={{ marginBottom: 8 }}>
            <div style={s.containerLabel}>{container}</div>
            {list.map(item => (
              <ItemRow
                key={item.id}
                item={item}
                canEdit={canEdit}
                availableContainers={availableContainers}
                onMoveContainer={handleMoveContainer}
                onEquip={handleEquip}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )
      })}

      {items.length === 0 && (
        <p style={{ color: '#4a4a60', fontSize: 12, fontStyle: 'italic', textAlign: 'center', margin: '16px 0' }}>
          Inventaire vide
        </p>
      )}

      {/* ── Bloc "Ajouter" — GM uniquement ────────────────────────────── */}
      {isGm && (
        <div style={{ marginTop: 12 }}>
          <button onClick={() => handleToggleAdd(availableContainers)} style={s.addToggleBtn}>
            {addOpen ? '▲ Fermer' : '+ Ajouter un item'}
          </button>

          {addOpen && (
            <div style={s.addPanel}>
              {!catalogLoaded ? (
                <div style={{ color: '#5a5a7a', fontSize: 12 }}>Chargement du catalogue…</div>
              ) : selectedRef ? (
                /* ── Confirmation ajout ──────────────────────────────── */
                <div style={s.confirmPanel}>
                  <div style={{ color: '#c0c0d0', fontSize: 12, marginBottom: 8 }}>
                    <strong>{selectedRef.name}</strong>
                    <span style={{ color: '#4a4a60' }}> — {selectedRef.category}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={s.addLabel}>
                      Qté
                      <input
                        type="number"
                        min={1}
                        value={addQty}
                        onChange={e => setAddQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        style={s.qtyInput}
                      />
                    </label>
                    <label style={s.addLabel}>
                      Container
                      <select
                        value={addContainer}
                        onChange={e => setAddContainer(e.target.value)}
                        style={s.selectSmall}
                      >
                        {availableContainers.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <button onClick={handleConfirmAdd} disabled={adding} style={s.confirmBtn}>
                      {adding ? '…' : 'Confirmer'}
                    </button>
                    <button onClick={() => setSelectedRef(null)} style={s.cancelBtn}>
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Recherche dans le catalogue ─────────────────────── */
                <>
                  <input
                    style={s.searchInput}
                    placeholder="Rechercher un item…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                  <div style={s.catalogList}>
                    {filteredCatalog.length === 0 && (
                      <div style={{ color: '#4a4a60', fontSize: 11, padding: 8 }}>Aucun résultat</div>
                    )}
                    {filteredCatalog.map(refItem => (
                      <div
                        key={refItem.id}
                        style={s.catalogRow}
                        onClick={() => handleSelectRef(refItem)}
                      >
                        <span style={{ color: '#c0c0d0' }}>{refItem.name}</span>
                        <span style={{ color: '#4a4a60', fontSize: 10 }}>{refItem.category}</span>
                      </div>
                    ))}
                    {!searchQuery && catalog.length > 50 && (
                      <div style={{ color: '#4a4a60', fontSize: 10, padding: '4px 8px' }}>
                        {catalog.length - 50} items supplémentaires — affinez la recherche
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ItemRow({ item, canEdit, availableContainers, onMoveContainer, onEquip, onDelete }) {
  const name = item.custom_name || item.ref_name || '(sans nom)'

  const containerOptions = availableContainers.includes(item.container)
    ? availableContainers
    : [item.container, ...availableContainers]

  return (
    <div style={s.itemRow}>
      <span style={s.itemName}>
        {name}
        {item.quantity > 1 && <span style={s.itemQty}> ×{item.quantity}</span>}
        {item.slot && <span style={s.itemSlot}> [{item.slot}]</span>}
      </span>
      {item.ref_weight != null && (
        <span style={s.itemWeight}>{(item.ref_weight * item.quantity).toFixed(1)} kg</span>
      )}
      {canEdit && (
        <>
          <select
            value={item.container}
            onChange={e => onMoveContainer(item.id, e.target.value)}
            style={s.selectSmall}
          >
            {containerOptions.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {item.container === 'Sac' && (
            <select
              value={item.slot || ''}
              onChange={e => onEquip(item.id, e.target.value || null)}
              style={{ ...s.selectSmall, color: item.slot ? '#5b8dee' : '#4a4a60' }}
            >
              <option value="">— slot —</option>
              {VALID_SLOTS.map(sl => (
                <option key={sl} value={sl}>{sl}</option>
              ))}
            </select>
          )}
          <button onClick={() => onDelete(item.id)} style={s.deleteBtn} title="Supprimer">✕</button>
        </>
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  root:      { marginTop: 8 },
  separator: { height: 1, backgroundColor: '#2a2a3e', margin: '12px 0' },
  header:    { display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12, fontSize: 12 },
  statLabel: { color: '#5a5a7a' },
  solsInput: {
    width: 60, background: '#0e0e1a', border: '1px solid #5b8dee',
    borderRadius: 4, padding: '1px 4px', color: '#c0c0d0', fontSize: 12, outline: 'none',
  },
  containerLabel: {
    fontSize: 10, color: '#4a4a60', textTransform: 'uppercase',
    letterSpacing: '0.07em', marginBottom: 2, marginTop: 8,
  },
  itemRow: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '3px 0', borderBottom: '1px solid #1a1a2e', fontSize: 12,
  },
  itemName:   { flex: 1, color: '#c0c0d0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemQty:    { color: '#5a5a7a' },
  itemSlot:   { color: '#5b8dee' },
  itemWeight: { color: '#4a4a60', fontSize: 11, flexShrink: 0 },
  selectSmall: {
    background: '#16162a', border: '1px solid #2a2a3e', borderRadius: 4,
    color: '#9090a8', fontSize: 11, padding: '1px 4px', cursor: 'pointer', flexShrink: 0,
  },
  deleteBtn: {
    background: 'none', border: 'none', color: '#5a5a7a',
    cursor: 'pointer', fontSize: 11, padding: '1px 4px', flexShrink: 0,
  },

  // Bloc ajout GM
  addToggleBtn: {
    background: 'none', border: '1px solid #2a2a3e', borderRadius: 4,
    color: '#5a5a7a', cursor: 'pointer', fontSize: 11, padding: '4px 10px',
    width: '100%', textAlign: 'left',
  },
  addPanel: {
    marginTop: 6, background: '#0e0e1a', border: '1px solid #2a2a3e',
    borderRadius: 6, padding: 10,
  },
  searchInput: {
    width: '100%', background: '#16162a', border: '1px solid #2a2a3e',
    borderRadius: 4, padding: '4px 8px', color: '#c0c0d0', fontSize: 12,
    outline: 'none', boxSizing: 'border-box', marginBottom: 6,
  },
  catalogList: {
    maxHeight: 200, overflowY: 'auto', borderRadius: 4,
  },
  catalogRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '4px 8px', cursor: 'pointer', borderRadius: 3, fontSize: 12,
    gap: 8,
    ':hover': { background: '#1e1e2e' },
  },
  confirmPanel: { fontSize: 12 },
  addLabel: {
    display: 'flex', flexDirection: 'column', gap: 2,
    fontSize: 10, color: '#5a5a7a', textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  qtyInput: {
    width: 50, background: '#16162a', border: '1px solid #2a2a3e',
    borderRadius: 4, padding: '2px 4px', color: '#c0c0d0', fontSize: 12, outline: 'none',
  },
  confirmBtn: {
    padding: '4px 12px', background: 'rgba(91,141,238,0.15)',
    border: '1px solid rgba(91,141,238,0.4)', borderRadius: 4,
    color: '#5b8dee', cursor: 'pointer', fontSize: 12, alignSelf: 'flex-end',
  },
  cancelBtn: {
    padding: '4px 10px', background: 'none',
    border: '1px solid #2a2a3e', borderRadius: 4,
    color: '#5a5a7a', cursor: 'pointer', fontSize: 12, alignSelf: 'flex-end',
  },
}
