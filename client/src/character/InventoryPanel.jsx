import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { DAMAGE_TYPE_BADGES } from '../lib/damageTypeBadges.js'
import { LOCATION_I18N_KEYS } from '../lib/locationI18nKeys.js'
import { SLOT_TO_WOUND_LOCATION } from '../../../shared/armorConstants.js'
import { useCharacterStore } from '../stores/characterStore.js'
import { useInventoryData } from '../lib/useInventoryData.js'
import { setItemSlot, setItemContainer, deleteItem, validateItem } from '../lib/inventoryMutations.js'
import { refreshDerivedTotals } from '../lib/inventoryDataSync.js'
import api from '../lib/api.js'

const CONTAINER_ORDER = ['Sac', 'Ceinture', 'Coffre']
// Sous-ensemble affiché dans la boucle accordéon — Coffre est rendu séparément (§10 point 3 du plan :
// stockage distant, jamais mélangé au Sac/Ceinture portés).
const CARRIED_CONTAINERS = ['Sac', 'Ceinture']
// Message affiché quand le conteneur n'est ni équipé ni occupé (PLAN_INVENTORY_UX.md §1.1 point 4).
const CONTAINER_EMPTY_MESSAGE_KEYS = { Sac: 'inventoryPanel.noSacMessage', Ceinture: 'inventoryPanel.noCeintureMessage' }
const VALID_SLOTS     = ['T', 'C', 'BG', 'BD', 'JG', 'JD', 'MG', 'MD', '2M', 'Tr']
// Libellés traduits pour les codes de slot cryptiques (PLAN_INVENTORY_UX.md problème #3) — armures :
// SLOT_TO_WOUND_LOCATION + LOCATION_I18N_KEYS (mêmes clés que WeaponPanel/LocationPanel) ; armes :
// clés `weaponPanel.slotLabels.*` déjà définies, réutilisées telles quelles (une info = un endroit).
const SLOT_LABEL_I18N_KEYS = {
  ...Object.fromEntries(Object.entries(SLOT_TO_WOUND_LOCATION).map(([code, loc]) => [code, LOCATION_I18N_KEYS[loc]])),
  MG: 'weaponPanel.slotLabels.MG', MD: 'weaponPanel.slotLabels.MD',
  '2M': 'weaponPanel.slotLabels.2M', Tr: 'weaponPanel.slotLabels.Tr',
}
const CATALOG_PAGE_SIZE = 20

// Slots réellement proposables pour un item donné, dérivés de `ref_location` (même parsing que
// getSlotInfo dans WeaponPanel.jsx) — le menu déroulant ne doit jamais offrir un code hors sujet
// (armure sur une arme, arme sur une localisation corporelle). Bug corrigé Saar 2026-08-05 : le
// Breather (arme 2 mains) s'équipait sur "Tête" faute de filtre.
function slotOptionsForItem(item) {
  const locs = (item.ref_location || '').split('/').filter(Boolean)
  if (locs.length === 0) return []
  if (locs.includes('M')) return ['MG', 'MD'] // arme une main : main directrice ou secondaire
  if (locs.includes('2M')) {
    // Arme 2 mains, compatible trépied ou non : seul 2M est proposé ici — le trépied se choisit
    // après équipement via le bouton dédié de WeaponPanel (switchToTripod), jamais depuis ce menu.
    // "Tr" reste réservé à l'item Trépied lui-même (branche ci-dessous, demande Saar 2026-08-05).
    return ['2M']
  }
  return locs.filter(l => VALID_SLOTS.includes(l))
}

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
  const [filterFamily,   setFilterFamily]   = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterRarity,   setFilterRarity]   = useState('')
  const [filterMaxWeight, setFilterMaxWeight] = useState('')
  const [catalogPage,    setCatalogPage]    = useState(1)
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

  const handleValidate = useCallback(async (itemId) => {
    try {
      await validateItem(characterId, itemId)
    } catch (err) {
      console.error('Erreur validation item :', err)
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

  // Bouton "Ranger dans le Coffre" (ItemRow) — même logique que le drop Sac/Ceinture : déséquiper
  // d'abord si nécessaire (aucune zone de drop Coffre n'existe, §5.3 ne définit que Sac/Ceinture).
  const handleSendToVault = (item) => handleDropToContainer(item, 'Coffre')

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
  // Coffre — stockage distant mais toujours disponible (pas de condition d'équipement comme
  // Sac/Ceinture) : cible de drop symétrique, manquante jusqu'ici (§5.3 du plan ne définissait que
  // Sac/Ceinture comme cibles, trouvé en clôturant PLAN_INVENTORY_UX.md).
  const coffreDrop = useDroppable({
    id: `container-Coffre-${characterId}`,
    data: { onDrop: (item) => { if (canEdit) handleDropToContainer(item, 'Coffre') } },
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
    setFilterFamily('')
    setFilterCategory('')
    setFilterRarity('')
    setFilterMaxWeight('')
    setCatalogPage(1)
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

  // ── Filtres catalogue ────────────────────────────────────────────────────
  // Facettes déduites du catalogue chargé (même pattern que `families` dans TradeWindow.jsx:484),
  // pas d'appel serveur dédié — le catalogue est déjà entièrement chargé en une requête.
  const catalogFamilies   = useMemo(() => [...new Set(catalog.map(i => i.family))].filter(Boolean).sort(), [catalog])
  const catalogCategories = useMemo(() => [...new Set(catalog.map(i => i.category))].filter(Boolean).sort(), [catalog])
  const catalogRarities   = useMemo(() => [...new Set(catalog.map(i => i.rarity))].filter(Boolean).sort(), [catalog])

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const maxWeight = filterMaxWeight === '' ? null : parseFloat(filterMaxWeight)
    return catalog.filter(i => {
      if (q && !(i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q) || i.family.toLowerCase().includes(q))) return false
      if (filterFamily && i.family !== filterFamily) return false
      if (filterCategory && i.category !== filterCategory) return false
      if (filterRarity && i.rarity !== filterRarity) return false
      if (maxWeight != null && !isNaN(maxWeight) && (i.weight == null || i.weight > maxWeight)) return false
      return true
    })
  }, [catalog, searchQuery, filterFamily, filterCategory, filterRarity, filterMaxWeight])

  const catalogPageCount = Math.max(1, Math.ceil(filteredCatalog.length / CATALOG_PAGE_SIZE))
  const pagedCatalog = useMemo(() => {
    const safePage = Math.min(catalogPage, catalogPageCount)
    return filteredCatalog.slice((safePage - 1) * CATALOG_PAGE_SIZE, safePage * CATALOG_PAGE_SIZE)
  }, [filteredCatalog, catalogPage, catalogPageCount])

  // Toute mutation d'un filtre ou de la recherche ramène à la page 1 — sinon une page 3 vide reste
  // affichée après un filtre qui réduit le nombre de résultats.
  const handleFilterChange = useCallback((setter) => (value) => {
    setter(value)
    setCatalogPage(1)
  }, [])

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

      {/* ── Sac / Ceinture portés ─────────────────────────────────────── */}
      {CARRIED_CONTAINERS.map(container => {
        const list = itemsByContainer[container]
        // Sac/Ceinture restent visibles vides tant qu'ils sont équipés (conteneur possédé mais rien
        // dedans) — sinon aucune zone où déposer un premier item par drag & drop
        // (PLAN_INVENTORY_UX.md §4.3/§5.3).
        const drop = container === 'Sac' ? sacDrop : ceintureDrop
        const isAvailable = availableContainers.includes(container)
        if (!list?.length && !isAvailable) {
          // Conteneur ni équipé ni occupé — message explicite plutôt que section absente
          // (PLAN_INVENTORY_UX.md §1.1 point 4).
          return (
            <div key={container} style={{ marginBottom: 8 }}>
              <div style={s.containerLabel}>{t(CONTAINER_LABEL_KEYS[container])}</div>
              <p style={s.emptyContainerMsg}>{t(CONTAINER_EMPTY_MESSAGE_KEYS[container])}</p>
            </div>
          )
        }
        return (
          <div
            key={container}
            ref={drop.setNodeRef}
            style={{ marginBottom: 8, ...(drop.isOver && canEdit ? s.containerDropOver : null) }}
          >
            <div style={s.containerLabel}>{t(CONTAINER_LABEL_KEYS[container])}</div>
            {list.map(item => (
              <ItemRow
                key={item.id}
                item={item}
                canEdit={canEdit}
                isGm={isGm}
                availableContainers={availableContainers}
                onMoveContainer={handleMoveContainer}
                onSendToVault={handleSendToVault}
                onEquip={handleEquip}
                onDelete={handleDelete}
                onValidate={handleValidate}
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

      {/* ── Coffre — stockage distant, séparé visuellement du Sac/Ceinture porté
          (PLAN_INVENTORY_UX.md §10 point 3). Toujours rendu (pas de condition d'équipement, à la
          différence de Sac/Ceinture) : cible de drop permanente, même vide — sinon aucune zone où
          déposer un premier item par drag & drop. ──────────────────────────────── */}
      <div
        ref={coffreDrop.setNodeRef}
        style={{ marginTop: 12, ...(coffreDrop.isOver && canEdit ? s.containerDropOver : null) }}
      >
        <div style={s.separator} />
        <div className="has-tooltip" data-tooltip={t('inventoryPanel.vaultTooltip')} style={s.containerLabel}>
          {t(CONTAINER_LABEL_KEYS.Coffre)}
        </div>
        {itemsByContainer.Coffre?.length > 0 ? (
          itemsByContainer.Coffre.map(item => (
            <ItemRow
              key={item.id}
              item={item}
              canEdit={canEdit}
              availableContainers={availableContainers}
              onMoveContainer={handleMoveContainer}
              onSendToVault={handleSendToVault}
              onEquip={handleEquip}
              onDelete={handleDelete}
            />
          ))
        ) : (
          <p style={s.emptyContainerMsg}>{t('inventoryPanel.emptyVaultMessage')}</p>
        )}
      </div>

      {/* ── Bloc "Ajouter" — owner ou MJ (PLAN_WIZARD_MATERIEL_GAUGES.md §0.1/§4 : le joueur a
          les mêmes droits d'ajout que le MJ, seule la validation par item reste MJ only) ──── */}
      {canEdit && (
        <div style={{ marginTop: 12 }}>
          {/* Mis en avant (feedback Saar 2026-08-12, "le bouton Ajouter... je ne l'avais pas du tout
              vu") — était un bouton fantôme (fond transparent, texte gris 11px), quasi invisible en
              bas de panneau alors que c'est l'action principale du joueur en Step6. `.btn.btn-gold`
              (index.css) : même classe que "Suivant" en Step6 (StepMaterielEtBiens.jsx), déjà le
              standard du projet pour une action principale (react.md : bouton = className, jamais un
              style ad hoc). */}
          <button className="btn btn-gold" onClick={() => handleToggleAdd(availableContainers)} style={{ width: '100%' }}>
            {addOpen ? t('inventoryPanel.closeAddPanel') : t('inventoryPanel.openAddPanel')}
          </button>

          {addOpen && (
            <div style={s.addPanel}>
              {!catalogLoaded ? (
                <div style={{ color: '#5a5a7a', fontSize: 12 }}>{t('inventoryPanel.loadingCatalog')}</div>
              ) : selectedRef ? (
                /* ── Confirmation ajout ──────────────────────────────── */
                <div style={s.confirmPanel}>
                  <div style={{ color: '#c0c0d0', fontSize: 12, marginBottom: 4 }}>
                    <strong>{selectedRef.name}</strong>
                    <span style={{ color: '#4a4a60' }}> — {selectedRef.category}</span>
                    {selectedRef.caliber != null && (
                      <span style={{ color: '#5b8dee' }}> · {t('inventoryPanel.caliberLabel')} {selectedRef.caliber}</span>
                    )}
                  </div>
                  {selectedRef.description && (
                    <p style={{ color: '#6a6a8a', fontSize: 11, margin: '0 0 8px' }}>{selectedRef.description}</p>
                  )}
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
                /* ── Recherche + filtres dans le catalogue ───────────── */
                <>
                  <input
                    style={s.searchInput}
                    placeholder={t('inventoryPanel.searchPlaceholder')}
                    value={searchQuery}
                    onChange={e => handleFilterChange(setSearchQuery)(e.target.value)}
                    autoFocus
                  />
                  <div style={s.filterRow}>
                    <select value={filterFamily} onChange={e => handleFilterChange(setFilterFamily)(e.target.value)} style={s.selectSmall}>
                      <option value="">{t('inventoryPanel.filterAllFamily')}</option>
                      {catalogFamilies.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <select value={filterCategory} onChange={e => handleFilterChange(setFilterCategory)(e.target.value)} style={s.selectSmall}>
                      <option value="">{t('inventoryPanel.filterAllCategory')}</option>
                      {catalogCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={filterRarity} onChange={e => handleFilterChange(setFilterRarity)(e.target.value)} style={s.selectSmall}>
                      <option value="">{t('inventoryPanel.filterAllRarity')}</option>
                      {catalogRarities.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      placeholder={t('inventoryPanel.filterMaxWeightPlaceholder')}
                      value={filterMaxWeight}
                      onChange={e => handleFilterChange(setFilterMaxWeight)(e.target.value)}
                      style={s.weightInput}
                    />
                  </div>
                  <div style={s.catalogList}>
                    {filteredCatalog.length === 0 && (
                      <div style={{ color: '#4a4a60', fontSize: 11, padding: 8 }}>{t('inventoryPanel.noResult')}</div>
                    )}
                    {pagedCatalog.map(refItem => (
                      <div
                        key={refItem.id}
                        style={s.catalogRow}
                        onClick={() => handleSelectRef(refItem)}
                      >
                        <span style={{ color: '#c0c0d0' }}>{refItem.name}</span>
                        <span style={{ color: '#4a4a60', fontSize: 10 }}>{refItem.category}</span>
                      </div>
                    ))}
                  </div>
                  {filteredCatalog.length > 0 && (
                    <div style={s.paginationRow}>
                      <button
                        onClick={() => setCatalogPage(p => Math.max(1, p - 1))}
                        disabled={catalogPage <= 1}
                        style={s.pageBtn}
                      >
                        {t('inventoryPanel.pagePrev')}
                      </button>
                      <span style={{ color: '#5a5a7a' }}>
                        {t('inventoryPanel.pageIndicator', { page: Math.min(catalogPage, catalogPageCount), total: catalogPageCount, count: filteredCatalog.length })}
                      </span>
                      <button
                        onClick={() => setCatalogPage(p => Math.min(catalogPageCount, p + 1))}
                        disabled={catalogPage >= catalogPageCount}
                        style={s.pageBtn}
                      >
                        {t('inventoryPanel.pageNext')}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ItemRow({ item, canEdit, isGm, availableContainers, onMoveContainer, onSendToVault, onEquip, onDelete, onValidate }) {
  const { t } = useTranslation('charSheet')
  const name = item.custom_name || item.ref_name || t('inventoryPanel.unnamedItem')

  // Même filtre que WeaponPanel.jsx (`availableWeapons`) — les colonnes ref_damage_h/ref_shock
  // existent sur toute la table ref_equipment, pas seulement les armes ; ne pas afficher le badge
  // sur un objet non-arme dont ces champs seraient renseignés par erreur de saisie catalogue.
  const isWeaponLike = item.ref_family === 'Armes' || item.ref_category === 'Bouclier'

  // Slots réellement compatibles avec cet item (bug Saar 2026-08-05 : le Breather, arme 2 mains,
  // s'équipait sur "Tête" — le menu proposait tous les codes sans filtrer par ref_location).
  const slotOptions = slotOptionsForItem(item)

  // PLAN_INVENTORY_UX.md §5.2 — l'item entier (icône + nom + stats) est la source draggable ; les
  // <select>/bouton restent cliquables normalement grâce à InteractiveAwarePointerSensor
  // (CharacterWindow.jsx, ignore le pointerdown sur les éléments interactifs imbriqués).
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
      <span
        style={s.itemName}
        className={item.ref_description ? 'has-tooltip' : undefined}
        data-tooltip={item.ref_description || undefined}
      >
        {name}
        {item.quantity > 1 && <span style={s.itemQty}> ×{item.quantity}</span>}
        {item.slots?.length > 0 && (
          <span style={s.itemSlot}> [{item.slots.map(sl => SLOT_LABEL_I18N_KEYS[sl] ? t(SLOT_LABEL_I18N_KEYS[sl]) : sl).join('/')}]</span>
        )}
      </span>
      {isWeaponLike && DAMAGE_TYPE_BADGES.map(({ key, field, className, i18nKey }) => item[field] && (
        <span key={key} className={`badge badge-compact ${className}`} style={s.itemDamageBadge}>{t(i18nKey)} <span className="num">{item[field]}</span></span>
      ))}
      {item.ref_caliber != null && (
        <span style={s.itemWeight}>{t('inventoryPanel.caliberLabel')} {item.ref_caliber}</span>
      )}
      {item.ref_weight != null && (
        <span style={s.itemWeight}>{(item.ref_weight * item.quantity).toFixed(1)} kg</span>
      )}
      {/* PLAN_WIZARD_MATERIEL_GAUGES.md §4 — bouton actionnable MJ only, uniquement sur les items en
          attente ; un item déjà validé affiche un badge statique (pas la peine de refaire cliquer le
          MJ sur ses propres ajouts, déjà validated_by_gm=true dès l'insertion côté serveur). */}
      {isGm && !item.validated_by_gm && (
        <button onClick={() => onValidate(item.id)} style={s.validateBtn} title={t('inventoryPanel.validateTooltip')}>
          {t('inventoryPanel.validateButton')}
        </button>
      )}
      {item.validated_by_gm && (
        <span className="badge badge-compact" style={s.validatedBadge}>{t('inventoryPanel.validatedBadge')}</span>
      )}
      {canEdit && (
        <>
          {item.container === 'Sac' && slotOptions.length > 0 && (
            <select
              value={item.slots?.length === 1 ? item.slots[0] : ''}
              onChange={e => onEquip(item.id, e.target.value || null)}
              style={{ ...s.selectSmall, color: item.slots?.length > 0 ? '#5b8dee' : '#4a4a60' }}
            >
              <option value="">{t('inventoryPanel.slotPlaceholder')}</option>
              {slotOptions.map(sl => (
                <option key={sl} value={sl}>{t(SLOT_LABEL_I18N_KEYS[sl])}</option>
              ))}
            </select>
          )}
          {/* PLAN_INVENTORY_UX.md §4.4 — Coffre → Sac en un clic, PUT container:'Sac'. */}
          {item.container === 'Coffre' && availableContainers.includes('Sac') && (
            <button onClick={() => onMoveContainer(item.id, 'Sac')} style={s.takeToSacBtn} title={t('inventoryPanel.takeToSacTooltip')}>
              {t('inventoryPanel.takeToSacButton')}
            </button>
          )}
          {/* Symétrique de "Prendre dans le Sac" — remplace le <select> container retiré (demande
              Saar 2026-08-05). Seule voie restante vers Coffre : aucune zone de drop Coffre n'existe
              (PLAN_INVENTORY_UX.md §5.3 ne définit que Sac/Ceinture comme cibles de drop). Réutilise
              handleDropToContainer (déséquipe d'abord si l'item est équipé, comme le drag & drop). */}
          {item.container !== 'Coffre' && (
            <button onClick={() => onSendToVault(item)} style={s.takeToSacBtn} title={t('inventoryPanel.sendToVaultTooltip')}>
              {t('inventoryPanel.sendToVaultButton')}
            </button>
          )}
          <button
            onClick={() => { if (window.confirm(t('inventoryPanel.deleteConfirm', { name }))) onDelete(item.id) }}
            style={s.deleteBtn}
            title={t('inventoryPanel.deleteTooltip')}
          >✕</button>
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
  emptyContainerMsg: {
    fontSize: 11, color: '#4a4a60', fontStyle: 'italic', margin: '4px 0',
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
  takeToSacBtn: {
    background: 'rgba(91,141,238,0.1)', border: '1px solid rgba(91,141,238,0.3)', borderRadius: 4,
    color: '#5b8dee', cursor: 'pointer', fontSize: 10, padding: '1px 6px', flexShrink: 0, whiteSpace: 'nowrap',
  },
  validateBtn: {
    background: 'rgba(90,200,120,0.12)', border: '1px solid rgba(90,200,120,0.35)', borderRadius: 4,
    color: '#5ac878', cursor: 'pointer', fontSize: 10, padding: '1px 6px', flexShrink: 0, whiteSpace: 'nowrap',
  },
  validatedBadge: {
    color: '#5ac878', borderColor: 'rgba(90,200,120,0.35)', flexShrink: 0, fontSize: 10,
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
  filterRow: {
    display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6,
  },
  weightInput: {
    width: 70, background: '#16162a', border: '1px solid #2a2a3e',
    borderRadius: 4, padding: '1px 4px', color: '#9090a8', fontSize: 11, outline: 'none',
  },
  catalogList: {
    maxHeight: 200, overflowY: 'auto', borderRadius: 4,
  },
  paginationRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginTop: 6, fontSize: 11,
  },
  pageBtn: {
    background: 'none', border: '1px solid #2a2a3e', borderRadius: 4,
    color: '#9090a8', cursor: 'pointer', fontSize: 11, padding: '2px 8px',
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
