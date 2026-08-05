import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { DAMAGE_TYPE_BADGES } from '../lib/damageTypeBadges.js'
import { useCharacterStore } from '../stores/characterStore.js'
import { useInventoryData } from '../lib/useInventoryData.js'
import { setItemSlot, setItemContainer, deleteItem } from '../lib/inventoryMutations.js'
import { refreshDerivedTotals } from '../lib/inventoryDataSync.js'
import api from '../lib/api.js'

const CONTAINER_ORDER = ['Sac', 'Ceinture', 'Coffre']
const VALID_SLOTS     = ['T', 'C', 'BG', 'BD', 'JG', 'JD', 'MG', 'MD', '2M', 'Tr']

// Libellé affiché (clé i18n namespace charSheet) pour chaque code container — le code lui-même
// (`item.container`, envoyé tel quel à l'API) ne change jamais, seul l'affichage passe par t().
const CONTAINER_LABEL_KEYS = { Sac: 'inventoryPanel.container.Sac', Ceinture: 'inventoryPanel.container.Ceinture', Coffre: 'inventoryPanel.container.Coffre' }

export default function InventoryPanel({ characterId, canEdit, isGm }) {
  const { t } = useTranslation('charSheet')
  // PLAN_INVENTORY_UX.md §3 — source unique de vérité, plus de fetch local à ce panneau.
  // poids/sols/malus INI sont affichés par InventoryBanner.jsx (Étape 1), pas ici.
  const { items, loading } = useInventoryData(characterId)
  const upsertInventoryItem = useCharacterStore(s => s.upsertInventoryItem)

  // ── Catalogue GM ──────────────────────────────────────────────────────────
  const [addOpen,       setAddOpen]       = useState(false)
  const [catalog,       setCatalog]       = useState([])
  const [catalogLoaded, setCatalogLoaded] = useState(false)
  const [searchQuery,   setSearchQuery]   = useState('')
  const [selectedRef,   setSelectedRef]   = useState(null)  // item ref_equipment sélectionné
  const [addQty,        setAddQty]        = useState(1)
  const [addContainer,  setAddContainer]  = useState('Coffre')
  const [adding,        setAdding]        = useState(false)

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
      await setItemContainer(characterId, itemId, newContainer)
    } catch (err) {
      console.error('Erreur déplacement container :', err)
    }
  }, [characterId])

  const handleEquip = useCallback(async (itemId, newSlot) => {
    try {
      await setItemSlot(characterId, itemId, newSlot)
    } catch (err) {
      console.error('Erreur équipement :', err)
    }
  }, [characterId])

  const handleDelete = useCallback(async (itemId) => {
    try {
      await deleteItem(characterId, itemId)
    } catch (err) {
      console.error('Erreur suppression item :', err)
    }
  }, [characterId])

  // PLAN_INVENTORY_UX.md §4.3/§5.3 — zone cible Sac/Ceinture : déplacement entre conteneurs (item non
  // équipé) ET déséquipement (item équipé, LocationPanel/WeaponCard/ContainerPanel) en un seul geste —
  // le drop détermine l'état final voulu (déséquipé, dans ce conteneur). Pas de useCallback : voir
  // LocationPanel.jsx (React Compiler ne préserve pas une mémoïsation manuelle sur des valeurs non
  // mémoïsées comme `items`).
  const handleDropToContainer = async (droppedItem, targetContainer) => {
    try {
      if (droppedItem.slots?.length > 0) {
        await setItemSlot(characterId, droppedItem.id, null)
      }
      if (droppedItem.container !== targetContainer) {
        await setItemContainer(characterId, droppedItem.id, targetContainer)
      }
    } catch (err) {
      console.error('Erreur drag & drop conteneur :', err)
    }
  }

  const sacDrop = useDroppable({
    id: `container-Sac-${characterId}`,
    data: { onDrop: (item) => { if (canEdit) handleDropToContainer(item, 'Sac') } },
    disabled: !canEdit,
  })
  const ceintureDrop = useDroppable({
    id: `container-Ceinture-${characterId}`,
    data: { onDrop: (item) => { if (canEdit) handleDropToContainer(item, 'Ceinture') } },
    disabled: !canEdit,
  })

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
      const newItems = res.data.items || [res.data.item]
      for (const newItem of newItems) upsertInventoryItem(characterId, newItem)
      refreshDerivedTotals(characterId) // item ajouté → poids porté affecté (shared/inventoryMath.js)
      setSelectedRef(null)
      setSearchQuery('')
    } catch (err) {
      console.error('Erreur ajout item :', err)
    } finally {
      setAdding(false)
    }
  }, [characterId, selectedRef, addContainer, addQty, upsertInventoryItem])

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

  if (loading) return <div style={{ color: '#5a5a7a', fontSize: 12, padding: '16px 0' }}>{t('inventoryPanel.loading')}</div>

  const itemsByContainer = {}
  for (const c of CONTAINER_ORDER) itemsByContainer[c] = []
  for (const item of items) {
    const bucket = itemsByContainer[item.container] ?? (itemsByContainer[item.container] = [])
    bucket.push(item)
  }

  return (
    <div style={s.root}>
      <div style={s.separator} />

      {/* ── Items par container ────────────────────────────────────────── */}
      {CONTAINER_ORDER.map(container => {
        const list = itemsByContainer[container]
        // Sac/Ceinture restent visibles vides (conteneur possédé mais rien dedans) — sinon aucune
        // zone où déposer un premier item par drag & drop (PLAN_INVENTORY_UX.md §4.3/§5.3). Coffre
        // inchangé : n'apparaît que s'il contient quelque chose.
        const drop = container === 'Sac' ? sacDrop : container === 'Ceinture' ? ceintureDrop : null
        const showEmpty = drop && availableContainers.includes(container)
        if (!list?.length && !showEmpty) return null
        return (
          <div
            key={container}
            ref={drop?.setNodeRef}
            style={{ marginBottom: 8, ...(drop?.isOver && canEdit ? s.containerDropOver : null) }}
          >
            <div style={s.containerLabel}>{t(CONTAINER_LABEL_KEYS[container])}</div>
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
          {t('inventoryPanel.emptyInventory')}
        </p>
      )}

      {/* ── Bloc "Ajouter" — GM uniquement ────────────────────────────── */}
      {isGm && (
        <div style={{ marginTop: 12 }}>
          <button onClick={() => handleToggleAdd(availableContainers)} style={s.addToggleBtn}>
            {addOpen ? t('inventoryPanel.closeAddPanel') : t('inventoryPanel.openAddPanel')}
          </button>

          {addOpen && (
            <div style={s.addPanel}>
              {!catalogLoaded ? (
                <div style={{ color: '#5a5a7a', fontSize: 12 }}>{t('inventoryPanel.loadingCatalog')}</div>
              ) : selectedRef ? (
                /* ── Confirmation ajout ──────────────────────────────── */
                <div style={s.confirmPanel}>
                  <div style={{ color: '#c0c0d0', fontSize: 12, marginBottom: 8 }}>
                    <strong>{selectedRef.name}</strong>
                    <span style={{ color: '#4a4a60' }}> — {selectedRef.category}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={s.addLabel}>
                      {t('inventoryPanel.qtyLabel')}
                      <input
                        type="number"
                        min={1}
                        value={addQty}
                        onChange={e => setAddQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        style={s.qtyInput}
                      />
                    </label>
                    <label style={s.addLabel}>
                      {t('inventoryPanel.containerLabel')}
                      <select
                        value={addContainer}
                        onChange={e => setAddContainer(e.target.value)}
                        style={s.selectSmall}
                      >
                        {availableContainers.map(c => (
                          <option key={c} value={c}>{t(CONTAINER_LABEL_KEYS[c])}</option>
                        ))}
                      </select>
                    </label>
                    <button onClick={handleConfirmAdd} disabled={adding} style={s.confirmBtn}>
                      {adding ? '…' : t('inventoryPanel.confirmButton')}
                    </button>
                    <button onClick={() => setSelectedRef(null)} style={s.cancelBtn}>
                      {t('inventoryPanel.cancelButton')}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Recherche dans le catalogue ─────────────────────── */
                <>
                  <input
                    style={s.searchInput}
                    placeholder={t('inventoryPanel.searchPlaceholder')}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                  <div style={s.catalogList}>
                    {filteredCatalog.length === 0 && (
                      <div style={{ color: '#4a4a60', fontSize: 11, padding: 8 }}>{t('inventoryPanel.noResult')}</div>
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
                        {t('inventoryPanel.moreItemsHint', { count: catalog.length - 50 })}
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
  const { t } = useTranslation('charSheet')
  const name = item.custom_name || item.ref_name || t('inventoryPanel.unnamedItem')

  const containerOptions = availableContainers.includes(item.container)
    ? availableContainers
    : [item.container, ...availableContainers]

  // Même filtre que WeaponPanel.jsx (`availableWeapons`) — les colonnes ref_damage_h/ref_shock
  // existent sur toute la table ref_equipment, pas seulement les armes ; ne pas afficher le badge
  // sur un objet non-arme dont ces champs seraient renseignés par erreur de saisie catalogue.
  const isWeaponLike = item.ref_family === 'Armes' || item.ref_category === 'Bouclier'

  // PLAN_INVENTORY_UX.md §5.2 — l'item entier (icône + nom + stats) est la source draggable ; les
  // <select>/bouton restent cliquables normalement grâce au seuil de distance du sensor (CharacterWindow.jsx).
  // Préfixe `inv-` : un item équipé apparaît AUSSI ici (avec son slot entre crochets, ligne ci-dessous)
  // en plus de LocationPanel/WeaponCard/ContainerPanel — même item.id, deux nœuds draggables distincts
  // rendus simultanément, l'id dnd-kit doit donc être unique par contexte de rendu, pas juste par item.
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `inv-${item.id}`,
    data: { item },
    disabled: !canEdit,
  })
  const dragStyle = transform ? {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
  } : undefined

  return (
    <div ref={setNodeRef} style={{ ...s.itemRow, ...dragStyle }} {...listeners} {...attributes}>
      <span style={s.itemName}>
        {name}
        {item.quantity > 1 && <span style={s.itemQty}> ×{item.quantity}</span>}
        {item.slots?.length > 0 && <span style={s.itemSlot}> [{item.slots.join('/')}]</span>}
      </span>
      {isWeaponLike && DAMAGE_TYPE_BADGES.map(({ key, field, className, i18nKey }) => item[field] && (
        <span key={key} className={`badge badge-compact ${className}`} style={s.itemDamageBadge}>{t(i18nKey)} <span className="num">{item[field]}</span></span>
      ))}
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
              <option key={c} value={c}>{t(CONTAINER_LABEL_KEYS[c])}</option>
            ))}
          </select>
          {item.container === 'Sac' && (
            <select
              value={item.slots?.length === 1 ? item.slots[0] : ''}
              onChange={e => onEquip(item.id, e.target.value || null)}
              style={{ ...s.selectSmall, color: item.slots?.length > 0 ? '#5b8dee' : '#4a4a60' }}
            >
              <option value="">{t('inventoryPanel.slotPlaceholder')}</option>
              {VALID_SLOTS.map(sl => (
                <option key={sl} value={sl}>{sl}</option>
              ))}
            </select>
          )}
          <button onClick={() => onDelete(item.id)} style={s.deleteBtn} title={t('inventoryPanel.deleteTooltip')}>✕</button>
        </>
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  root:      { marginTop: 8 },
  separator: { height: 1, backgroundColor: '#2a2a3e', margin: '12px 0' },
  containerLabel: {
    fontSize: 10, color: '#4a4a60', textTransform: 'uppercase',
    letterSpacing: '0.07em', marginBottom: 2, marginTop: 8,
  },
  // Survol drag & drop valide (PLAN_INVENTORY_UX.md §5.4, polish complet en sous-lot 6).
  containerDropOver: {
    outline: '1px solid #5b8dee',
    outlineOffset: 2,
    borderRadius: 4,
  },
  itemRow: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '3px 0', borderBottom: '1px solid #1a1a2e', fontSize: 12,
  },
  itemName:   { flex: 1, color: '#c0c0d0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemQty:    { color: '#5a5a7a' },
  itemSlot:   { color: '#5b8dee' },
  itemDamageBadge: { flexShrink: 0 },
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
