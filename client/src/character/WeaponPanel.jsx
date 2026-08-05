import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { SLOT_TO_WOUND_LOCATION } from '../../../shared/armorConstants.js'
import { LOCATION_I18N_KEYS } from '../lib/locationI18nKeys.js'
import { DAMAGE_TYPE_BADGES } from '../lib/damageTypeBadges.js'
import { useCharacterStore } from '../stores/characterStore.js'
import { useInventoryData } from '../lib/useInventoryData.js'
import { setItemSlot } from '../lib/inventoryMutations.js'
import ContainerPanel from './ContainerPanel.jsx'
import api from '../lib/api.js'

const WEAPON_SLOTS = ['MG', 'MD', '2M', 'Tr']
// Clés i18n namespace charSheet (docs/SYSTEME/LOCALISATION.md §3.1) — le code slot lui-même reste
// la clé JS locale, seul l'affichage passe par t().
const SLOT_LABEL_KEYS = { MG: 'weaponPanel.slotLabels.MG', MD: 'weaponPanel.slotLabels.MD', '2M': 'weaponPanel.slotLabels.2M', Tr: 'weaponPanel.slotLabels.Tr' }

// Composite (Bouclier) : slots[0] n'est plus fiable pour retrouver la main (tri alphabétique côté
// serveur, ex. ['BG','C','MG']) — chercher explicitement le code main/2M/Tr.
const handSlotOf = (slots) => slots?.find(s => WEAPON_SLOTS.includes(s)) ?? slots?.[0]

// Fonction pure : `t` injecté en paramètre par l'appelant (règle des hooks, docs/SYSTEME/LOCALISATION.md §3.1).
function shieldExtraLocationLabels(refShieldExtraLocations, t) {
  if (!refShieldExtraLocations) return []
  return refShieldExtraLocations.split('/').map(code => {
    const key = LOCATION_I18N_KEYS[SLOT_TO_WOUND_LOCATION[code]]
    return key ? t(key) : code
  })
}

function parseAmmoCount(ammoCount) {
  if (!ammoCount) return 0
  const match = ammoCount.match(/\d+/)
  return match ? parseInt(match[0], 10) : 0
}

function getSlotInfo(refLocation) {
  const locs = (refLocation || '').split('/')
  if (locs.includes('M'))                          return { type: '1H',    defaultSlot: 'MG' }
  if (locs.includes('2M') && locs.includes('Tr')) return { type: '2M_Tr', defaultSlot: '2M' }
  if (locs.includes('2M'))                         return { type: '2M',    defaultSlot: '2M' }
  if (locs.includes('Tr'))                         return { type: 'Tr',    defaultSlot: 'Tr' }
  return { type: 'unknown', defaultSlot: '' }
}

// Décision Saar 2026-08-05 : plus de zone "2 Mains" séparée — équiper une arme 2 mains dans Main
// Directrice ou Secondaire l'équipe automatiquement sur le bon slot (2M/Tr), couvrant les deux mains.
// `handSlot` = zone visée par l'utilisateur (clic ou drop) ; ignoré si l'arme n'est pas 1 main.
function resolveTargetSlot(item, handSlot) {
  const info = getSlotInfo(item?.ref_location)
  return info.type === '1H' ? handSlot : info.defaultSlot
}

function WeaponCard({ weapon, canEdit, compatAmmos, ammoName, ammoSelected, onAmmoSelect,
                      onReload, onUnequip, error }) {
  const { t } = useTranslation('charSheet')
  const totalAmmoQty  = compatAmmos.reduce((acc, i) => acc + i.quantity, 0)
  const ammoCount     = parseAmmoCount(weapon.ref_ammo_count)
  const hasCompatAmmo = compatAmmos.length > 0
  const handSlot      = handSlotOf(weapon.slots)
  const slotKey       = SLOT_LABEL_KEYS[handSlot]

  // PLAN_INVENTORY_UX.md §5.2 — source draggable pour le déséquipement (drop vers Sac/Ceinture dans
  // InventoryPanel.jsx). Préfixe `weapon-` : même item.id que sa ligne dans InventoryPanel (rendue
  // simultanément), l'id dnd-kit doit être unique par contexte de rendu (cf. LocationPanel.jsx).
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `weapon-${weapon.id}`,
    data: { item: weapon },
    disabled: !canEdit,
  })
  const dragStyle = transform ? {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
  } : undefined

  return (
    <div ref={setNodeRef} style={{ ...s.weaponCard, ...dragStyle }} {...listeners} {...attributes}>
      <div style={s.weaponHeader}>
        <span style={s.slotBadge}>{slotKey ? t(slotKey) : handSlot}</span>
        <span style={s.weaponName}>{weapon.custom_name || weapon.ref_name || '—'}</span>
        {weapon.ref_description && (
          <span className="has-tooltip" data-tooltip={weapon.ref_description} style={s.infoIcon}>ⓘ</span>
        )}
        {weapon.slots?.includes('Tr') && (
          <span
            style={s.trWarning}
            title={t('weaponPanel.tripodTooltip')}
          >{t('weaponPanel.tripodBadge')}</span>
        )}
        {canEdit && (
          <button style={s.unequipBtn} onClick={() => onUnequip(weapon)} title={t('containerPanel.unequipTooltip')}>×</button>
        )}
      </div>

      <div style={s.statsRow}>
        {DAMAGE_TYPE_BADGES.map(({ key, field, className, i18nKey }) => weapon[field] && (
          <span key={key} className={`badge badge-compact ${className}`}>{t(i18nKey)} <span className="num">{weapon[field]}</span></span>
        ))}
        {weapon.ref_range     && <span style={s.stat}><span style={s.statKey}>{t('weaponPanel.statRange')}</span> {weapon.ref_range}</span>}
        {weapon.ref_fire_mode && <span style={s.stat}><span style={s.statKey}>{t('weaponPanel.statFireMode')}</span> {weapon.ref_fire_mode}</span>}
        {weapon.ref_caliber   && <span style={s.stat}><span style={s.statKey}>{t('weaponPanel.statCaliber')}</span> {weapon.ref_caliber}</span>}
        {weapon.ref_category === 'Bouclier' && (
          <>
            {weapon.ref_shield_atk_malus != null && <span style={s.stat}><span style={s.statKey}>{t('weaponPanel.statShieldAtkMalus')}</span> {weapon.ref_shield_atk_malus}</span>}
            {weapon.ref_protection != null && <span style={s.stat}><span style={s.statKey}>{t('weaponPanel.statShieldProtection')}</span> {weapon.ref_protection}</span>}
            <span style={s.stat}><span style={s.statKey}>{t('weaponPanel.statShieldCovers')}</span> {t('weaponPanel.shieldCoversArm')}{shieldExtraLocationLabels(weapon.ref_shield_extra_locations, t).map(l => `, ${l}`).join('')}</span>
          </>
        )}
      </div>

      {weapon.ref_caliber && (
        <div style={s.ammoSection}>
          <div style={s.ammoRow}>
            <span style={s.ammoLabel}>
              {weapon.current_ammo
                ? <span style={s.ammoName}>{ammoName}</span>
                : <span style={s.ammoNone}>{t('weaponPanel.ammoUnloaded')}</span>
              }
              {weapon.current_ammo && ammoCount > 0 && (() => {
                const remaining = weapon.ammo_remaining ?? ammoCount
                const isEmpty   = weapon.ammo_remaining === 0
                return (
                  <span style={{ color: isEmpty ? '#c86030' : '#4a4a60' }}>
                    {' '}— <span style={isEmpty ? { color: '#c86030', fontWeight: 600 } : {}}>{remaining}/{ammoCount}</span> {t('weaponPanel.ammoMagazineSuffix')} · {totalAmmoQty} {t('weaponPanel.ammoStockSuffix')}
                  </span>
                )
              })()}
            </span>
          </div>
          {canEdit && (
            <div style={s.ammoReloadRow}>
              {compatAmmos.length > 1 && (
                <select
                  style={s.ammoSelect}
                  value={ammoSelected || compatAmmos[0]?.id || ''}
                  onChange={e => onAmmoSelect(e.target.value)}
                >
                  {compatAmmos.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.custom_name || a.ref_name} ({a.quantity} {t('weaponPanel.ammoAvailableSuffix')})
                    </option>
                  ))}
                </select>
              )}
              <button
                style={{ ...s.reloadBtn, opacity: hasCompatAmmo ? 1 : 0.4 }}
                onClick={() => onReload(weapon)}
                title={hasCompatAmmo ? t('weaponPanel.reloadTooltip') : t('weaponPanel.reloadTooltipDisabled')}
              >
                {t('weaponPanel.reloadButton')}
              </button>
            </div>
          )}
        </div>
      )}

      {error && <div style={s.errorMsg}>{error}</div>}
    </div>
  )
}

export default function WeaponPanel({ characterId, canEdit, onOpenModing = () => {}, dragItem = null }) {
  const { t } = useTranslation('charSheet')
  const [errors,      setErrors]      = useState({})
  const [equipDir,    setEquipDir]    = useState('')
  const [equipSec,    setEquipSec]    = useState('')
  const [equipping,   setEquipping]   = useState(false)
  const [ammoSelected, setAmmoSelected] = useState({})

  // PLAN_INVENTORY_UX.md §3 — source unique de vérité, plus de fetch local à ce panneau.
  const { items, handPref, loading } = useInventoryData(characterId)
  const upsertInventoryItem = useCharacterStore(s => s.upsertInventoryItem)

  // ── Données dérivées ────────────────────────────────────────────────────────

  // Lot B (docs/PLAN_INVENTORY_SLOTS.md) : `slots` (tableau) remplace `slot` (texte) côté lecture —
  // les armes n'occupent qu'un seul slot aujourd'hui, mais `.includes`/`.some` reste correct dans
  // tous les cas plutôt qu'une égalité stricte sur une valeur qui pourrait un jour être composite.
  const equippedWeapons = useMemo(
    () => items.filter(i => i.slots?.some(s => WEAPON_SLOTS.includes(s))),
    [items],
  )

  const availableWeapons = useMemo(
    () => items.filter(i =>
      (i.ref_family === 'Armes' || i.ref_category === 'Bouclier') &&
      i.ref_location &&
      ['M', '2M', 'Tr'].some(loc => i.ref_location.split('/').includes(loc)) &&
      i.container !== 'Coffre' &&
      i.slots == null,
    ),
    [items],
  )

  const isAmbi  = handPref === 'A'
  const dirSlot = handPref === 'L' ? 'MG' : 'MD'
  const secSlot = handPref === 'L' ? 'MD' : 'MG'

  const weaponDir = equippedWeapons.find(w => w.slots?.includes(dirSlot))
  const weaponSec = equippedWeapons.find(w => w.slots?.includes(secSlot))
  const weapon2M  = equippedWeapons.find(w => w.slots?.includes('2M') || w.slots?.includes('Tr'))

  const hasTrepied = useMemo(() => items.some(i =>
    i.container !== 'Coffre' &&
    i.ref_family !== 'Armes' &&
    (i.ref_location || '').split('/').includes('Tr')
  ), [items])

  // ── Helpers ammo ────────────────────────────────────────────────────────────

  const ammoNameForRef = useCallback((refId) => {
    if (!refId) return null
    const ammoItem = items.find(i => i.equipment_id === refId)
    return ammoItem ? (ammoItem.custom_name || ammoItem.ref_name) : '(épuisée)'
  }, [items])

  const availableAmmoFor = useCallback((weapon) => {
    if (!weapon.ref_caliber) return []
    return items
      .filter(i =>
        i.ref_family === 'Munitions' &&
        i.ref_caliber === weapon.ref_caliber &&
        i.container !== 'Coffre',
      )
      .sort((a, b) => {
        const aName = (a.custom_name || a.ref_name || '').toLowerCase()
        const bName = (b.custom_name || b.ref_name || '').toLowerCase()
        const aStd = aName.includes('standard')
        const bStd = bName.includes('standard')
        if (aStd !== bStd) return aStd ? -1 : 1
        return aName.localeCompare(bName, 'fr')
      })
  }, [items])

  // ── Handlers ────────────────────────────────────────────────────────────────

  const clearError = (key) => setErrors(prev => { const n = { ...prev }; delete n[key]; return n })

  const handleUnequip = useCallback(async (weaponItem) => {
    clearError(weaponItem.id)
    try {
      await setItemSlot(characterId, weaponItem.id, null)
    } catch (err) {
      setErrors(prev => ({ ...prev, [weaponItem.id]: err.response?.data?.error?.message || t('weaponPanel.unequipError') }))
    }
  }, [characterId, t])

  const handleReload = useCallback(async (weaponItem) => {
    clearError(weaponItem.id)
    const compatAmmos = availableAmmoFor(weaponItem)
    if (compatAmmos.length === 0) return
    const selectedId = ammoSelected[weaponItem.id] || compatAmmos[0].id
    try {
      const res = await api.post(`/char-sheet/${characterId}/inventory/${weaponItem.id}/reload`, {
        ammo_item_id: selectedId,
      })
      upsertInventoryItem(characterId, res.data.item)
    } catch (err) {
      setErrors(prev => ({ ...prev, [weaponItem.id]: err.response?.data?.error?.message || t('weaponPanel.reloadError') }))
    }
  }, [characterId, upsertInventoryItem, availableAmmoFor, ammoSelected, t])

  // Pas de useCallback : availableWeapons/equippedWeapons ne sont pas mémoïsés (dérivés d'un simple
  // .filter()), React Compiler ne peut pas préserver une mémoïsation manuelle dessus (cf. LocationPanel.jsx).
  const handleEquipItem = async (itemId, handSlot) => {
    if (!itemId || !handSlot) return
    const item = availableWeapons.find(w => w.id === itemId)
    const slot = resolveTargetSlot(item, handSlot)
    const isTwoHand     = slot === '2M' || slot === 'Tr'
    const conflictSlots = isTwoHand ? ['MG', 'MD', '2M', 'Tr'] : [slot, '2M', 'Tr']
    const conflicts     = equippedWeapons.filter(w => w.id !== itemId && w.slots?.some(s => conflictSlots.includes(s)))
    setEquipping(true)
    try {
      for (const c of conflicts) {
        await setItemSlot(characterId, c.id, null)
      }
      await setItemSlot(characterId, itemId, slot)
      setEquipDir(''); setEquipSec('')
      setErrors(prev => { const n = { ...prev }; delete n.equip; return n })
    } catch (err) {
      setErrors(prev => ({ ...prev, equip: err.response?.data?.error?.message || t('weaponPanel.equipError') }))
    } finally {
      setEquipping(false)
    }
  }

  // PLAN_INVENTORY_UX.md §4.2/§5.3 — chemin drag & drop, distinct de handleEquipItem (bouton, qui
  // déséquipe silencieusement les conflits). Ici : tentative directe, et seulement SI le serveur
  // rejette (409) on propose le dialogue de confirmation avant de déséquiper.
  const handleDropEquip = async (droppedItem, handSlot) => {
    const slot = resolveTargetSlot(droppedItem, handSlot)
    try {
      await setItemSlot(characterId, droppedItem.id, slot)
      setErrors(prev => { const n = { ...prev }; delete n.equip; return n })
    } catch (err) {
      if (err.response?.status === 409) {
        const isTwoHand     = slot === '2M' || slot === 'Tr'
        const conflictSlots = isTwoHand ? ['MG', 'MD', '2M', 'Tr'] : [slot, '2M', 'Tr']
        const conflicts     = equippedWeapons.filter(w => w.id !== droppedItem.id && w.slots?.some(s => conflictSlots.includes(s)))
        const names         = conflicts.map(w => w.custom_name || w.ref_name).join(', ')
        if (conflicts.length > 0 && window.confirm(t('weaponPanel.conflictConfirm', { names }))) {
          try {
            for (const c of conflicts) await setItemSlot(characterId, c.id, null)
            await setItemSlot(characterId, droppedItem.id, slot)
            setErrors(prev => { const n = { ...prev }; delete n.equip; return n })
          } catch (err2) {
            setErrors(prev => ({ ...prev, equip: err2.response?.data?.error?.message || t('weaponPanel.equipError') }))
          }
        }
        return
      }
      setErrors(prev => ({ ...prev, equip: err.response?.data?.error?.message || t('weaponPanel.equipError') }))
    }
  }

  // Décision Saar 2026-08-05 : une arme 2 mains déposée sur Main Directrice OU Secondaire s'équipe
  // directement en 2M/Tr (resolveTargetSlot) — plus de zone "2 Mains" dédiée. `equipped2MDrop` reste
  // pour le cas où une arme 2 mains est déjà équipée (swap par drop sur sa propre carte).
  const dirDrop = useDroppable({
    id: `weapon-dir-${characterId}`,
    data: { onDrop: (item) => { if (canEdit && availableWeapons.some(i => i.id === item.id)) handleDropEquip(item, dirSlot) } },
    disabled: !canEdit,
  })
  const secDrop = useDroppable({
    id: `weapon-sec-${characterId}`,
    data: { onDrop: (item) => { if (canEdit && availableWeapons.some(i => i.id === item.id)) handleDropEquip(item, secSlot) } },
    disabled: !canEdit,
  })
  const equipped2MDrop = useDroppable({
    id: `weapon-2m-${characterId}`,
    data: { onDrop: (item) => { if (canEdit && availableWeapons.some(i => i.id === item.id)) handleDropEquip(item, dirSlot) } },
    disabled: !canEdit,
  })

  // PLAN_INVENTORY_UX.md §5.4 — bordure bleue (cible valide) vs rouge (invalide) au survol. Même
  // condition de validité pour les 3 zones désormais (n'importe quelle arme disponible peut être
  // déposée dans n'importe laquelle, resolveTargetSlot choisit le bon slot final).
  const isHandValid   = dragItem != null && availableWeapons.some(i => i.id === dragItem.id)
  const dirZoneStyle  = dirDrop.isOver && dragItem ? (isHandValid ? s.zoneDropOver : s.zoneDropInvalid) : null
  const secZoneStyle  = secDrop.isOver && dragItem ? (isHandValid ? s.zoneDropOver : s.zoneDropInvalid) : null
  const twoMZoneStyle = equipped2MDrop.isOver && dragItem ? (isHandValid ? s.zoneDropOver : s.zoneDropInvalid) : null

  // Décision Saar 2026-08-05 — "un choix après le drop" : équiper une arme 2M_Tr atterrit d'abord sur
  // 2M (resolveTargetSlot), ce bouton bascule ensuite vers/depuis Tr sur l'arme déjà équipée. Même
  // item que l'un des deux slots WEAPON_SLOTS — jamais de conflit avec un autre item (lui-même seul
  // occupant du groupe), pas besoin du flux de confirmation.
  const handleToggleTripod = async () => {
    if (!weapon2M) return
    clearError(weapon2M.id)
    const targetSlot = weapon2M.slots?.includes('Tr') ? '2M' : 'Tr'
    try {
      await setItemSlot(characterId, weapon2M.id, targetSlot)
    } catch (err) {
      setErrors(prev => ({ ...prev, [weapon2M.id]: err.response?.data?.error?.message || t('weaponPanel.equipError') }))
    }
  }

  // ── Rendu ────────────────────────────────────────────────────────────────────

  if (loading) return null

  const hasAnything = equippedWeapons.length > 0 || (canEdit && availableWeapons.length > 0)

  return (
    <div style={s.root}>
      <div style={s.separator} />

      {!hasAnything ? (
        <div style={s.emptyMsg}>{t('weaponPanel.noWeaponEquipped')}</div>
      ) : (
      <>
      <div style={s.sectionLabel}>{t('weaponPanel.equippedWeaponsTitle')}</div>

      {weapon2M ? (
        /* ── Mode DEUX MAINS ──────────────────────────────────────────────── */
        <div
          ref={equipped2MDrop.setNodeRef}
          style={{ ...s.sectionTwoHands, ...twoMZoneStyle }}
        >
          <div style={s.colHeader}>{t('weaponPanel.twoHandsSectionTitle')}</div>
          <WeaponCard
            weapon={weapon2M}
            canEdit={canEdit}
            compatAmmos={availableAmmoFor(weapon2M)}
            ammoName={ammoNameForRef(weapon2M.current_ammo)}
            ammoSelected={ammoSelected[weapon2M.id]}
            onAmmoSelect={v => setAmmoSelected(prev => ({ ...prev, [weapon2M.id]: v }))}
            onReload={handleReload}
            onUnequip={handleUnequip}
            error={errors[weapon2M.id]}
          />
          {weapon2M.slots?.includes('Tr') && !hasTrepied && (
            <div style={s.warning}>{t('weaponPanel.tripodMissingWarning')}</div>
          )}
          {canEdit && hasTrepied && getSlotInfo(weapon2M.ref_location).type === '2M_Tr' && (
            <button style={s.equipBtn} onClick={handleToggleTripod}>
              {weapon2M.slots?.includes('Tr') ? t('weaponPanel.switchToTwoHands') : t('weaponPanel.switchToTripod')}
            </button>
          )}
        </div>
      ) : (
        /* ── Mode DIR / SEC ───────────────────────────────────────────────── */
        <>
          <div style={s.twoColGrid}>

            {/* Colonne DIRECTRICE */}
            <div
              ref={dirDrop.setNodeRef}
              style={{ ...s.col, ...dirZoneStyle }}
            >
              <div style={s.colHeader}>
                {isAmbi ? t('weaponPanel.leftHandLabel') : t('weaponPanel.dirHandLabel')}
              </div>
              {weaponDir ? (
                <WeaponCard
                  weapon={weaponDir}
                  canEdit={canEdit}
                  compatAmmos={availableAmmoFor(weaponDir)}
                  ammoName={ammoNameForRef(weaponDir.current_ammo)}
                  ammoSelected={ammoSelected[weaponDir.id]}
                  onAmmoSelect={v => setAmmoSelected(prev => ({ ...prev, [weaponDir.id]: v }))}
                  onReload={handleReload}
                  onUnequip={handleUnequip}
                  error={errors[weaponDir.id]}
                />
              ) : canEdit && availableWeapons.length > 0 && (
                <div style={s.equipCol}>
                  <select
                    style={s.select}
                    value={equipDir}
                    onChange={e => setEquipDir(e.target.value)}
                  >
                    <option value="">{t('containerPanel.equipPlaceholder')}</option>
                    {availableWeapons.map(i => (
                      <option key={i.id} value={i.id}>
                        {i.custom_name || i.ref_name}
                      </option>
                    ))}
                  </select>
                  <button
                    style={s.equipBtn}
                    onClick={() => handleEquipItem(equipDir, dirSlot)}
                    disabled={!equipDir || equipping}
                  >
                    {t('weaponPanel.equipButton')}
                  </button>
                </div>
              )}
            </div>

            {/* Colonne SECONDAIRE */}
            <div
              ref={secDrop.setNodeRef}
              style={{ ...s.col, ...secZoneStyle }}
            >
              <div style={s.colHeader}>
                {isAmbi
                  ? t('weaponPanel.rightHandLabel')
                  : <>{weaponSec && <span style={s.malusNote}>{t('weaponPanel.malusNote')} </span>}{t('weaponPanel.secHandLabel')}</>
                }
              </div>
              {weaponSec ? (
                <WeaponCard
                  weapon={weaponSec}
                  canEdit={canEdit}
                  compatAmmos={availableAmmoFor(weaponSec)}
                  ammoName={ammoNameForRef(weaponSec.current_ammo)}
                  ammoSelected={ammoSelected[weaponSec.id]}
                  onAmmoSelect={v => setAmmoSelected(prev => ({ ...prev, [weaponSec.id]: v }))}
                  onReload={handleReload}
                  onUnequip={handleUnequip}
                  error={errors[weaponSec.id]}
                />
              ) : canEdit && availableWeapons.length > 0 && (
                <div style={s.equipCol}>
                  <select
                    style={s.select}
                    value={equipSec}
                    onChange={e => setEquipSec(e.target.value)}
                  >
                    <option value="">{t('containerPanel.equipPlaceholder')}</option>
                    {availableWeapons.map(i => (
                      <option key={i.id} value={i.id}>
                        {i.custom_name || i.ref_name}
                      </option>
                    ))}
                  </select>
                  <button
                    style={s.equipBtn}
                    onClick={() => handleEquipItem(equipSec, secSlot)}
                    disabled={!equipSec || equipping}
                  >
                    {t('weaponPanel.equipButton')}
                  </button>
                </div>
              )}
            </div>

          </div>
        </>
      )}

      {errors.equip && <div style={s.errorMsg}>{errors.equip}</div>}
      </>
      )}

      {/* ── Conteneurs portés (PLAN_INVENTORY_UX.md Étape 3) — migrés depuis ArmorWoundPanel.jsx ── */}
      <div style={s.separator} />
      <div style={s.sectionLabel}>{t('weaponPanel.carriedContainersTitle')}</div>
      <div style={s.containerGroup}>
        <ContainerPanel
          type="D"
          label={t('armorWoundPanel.backpackLabel')}
          items={items}
          characterId={characterId}
          canEdit={canEdit}
        />
        <ContainerPanel
          type="Ce"
          label={t('armorWoundPanel.beltLabel')}
          items={items}
          characterId={characterId}
          canEdit={canEdit}
        />
      </div>

      {/* ── Bouton "Customisation" — déplacé depuis InventoryPanel.jsx (Étape 3) ──────────── */}
      {canEdit && (
        <button onClick={onOpenModing} style={s.modingBtn}>
          {t('inventoryPanel.modingButton')}
        </button>
      )}
    </div>
  )
}

const s = {
  root:         { marginTop: 0 },
  separator:    { height: 1, backgroundColor: '#2a2a3e', margin: '12px 0' },
  sectionLabel: { fontSize: 10, color: '#4a4a60', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 },
  emptyMsg:     { fontSize: 12, color: '#3a3a5a', fontStyle: 'italic', textAlign: 'center', padding: '8px 0' },
  containerGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    marginBottom: 8,
  },
  // Survol drag & drop (PLAN_INVENTORY_UX.md §5.4) — bleu valide / rouge invalide.
  zoneDropOver: {
    outline: '1px solid #5b8dee',
    outlineOffset: 2,
    borderRadius: 4,
  },
  zoneDropInvalid: {
    outline: '1px solid #e05c5c',
    outlineOffset: 2,
    borderRadius: 4,
    cursor: 'no-drop',
  },
  modingBtn: {
    background: 'none', border: '1px solid #2a2a3e', borderRadius: 4,
    color: '#5a5a7a', cursor: 'pointer', fontSize: 11, padding: '4px 10px',
    width: '100%', textAlign: 'left',
  },

  twoColGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
    marginBottom: 6,
  },
  col: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  colHeader: {
    fontSize: 9,
    fontWeight: 700,
    color: '#4a4a60',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
  },
  malusNote: {
    fontSize: 9,
    color: '#e8a020',
  },
  sectionTwoHands: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginTop: 2,
  },
  equipCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  warning: {
    fontSize: 10,
    color: '#e8a020',
  },
  info: {
    fontSize: 10,
    color: '#4caf77',
  },

  weaponCard: {
    background: '#1a1a2e',
    border: '1px solid #2a2a3e',
    borderRadius: 6,
    padding: '8px 10px',
    marginBottom: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  weaponHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  slotBadge: {
    fontSize: 9,
    fontWeight: 700,
    color: '#5b8dee',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    background: 'rgba(91,141,238,0.12)',
    border: '1px solid rgba(91,141,238,0.25)',
    borderRadius: 3,
    padding: '1px 5px',
    flexShrink: 0,
  },
  weaponName: {
    flex: 1,
    fontSize: 12,
    color: '#c0c0d0',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  unequipBtn: {
    background: 'none', border: 'none', color: '#5a5a7a',
    cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px', flexShrink: 0,
  },
  statsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  stat: {
    fontSize: 11,
    color: '#9090a8',
  },
  statKey: {
    fontSize: 9,
    color: '#5a5a7a',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginRight: 2,
  },
  ammoSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  ammoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  ammoReloadRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  ammoSelect: {
    flex: 1,
    background: '#0e0e1a',
    border: '1px solid #2a2a3e',
    borderRadius: 4,
    color: '#7070a0',
    fontSize: 11,
    padding: '3px 4px',
    cursor: 'pointer',
    outline: 'none',
    minWidth: 0,
  },
  ammoLabel: {
    flex: 1,
    fontSize: 11,
    color: '#9090a8',
    minWidth: 0,
  },
  ammoName: {
    color: '#4caf77',
  },
  ammoNone: {
    color: '#5a5a7a',
    fontStyle: 'italic',
  },
  reloadBtn: {
    background: 'rgba(91,141,238,0.1)',
    border: '1px solid rgba(91,141,238,0.3)',
    borderRadius: 4,
    color: '#5b8dee',
    cursor: 'pointer',
    fontSize: 11,
    padding: '2px 8px',
    flexShrink: 0,
  },
  errorMsg: {
    fontSize: 10,
    color: '#e05c5c',
  },

  select: {
    background: '#0e0e1a',
    border: '1px solid #2a2a3e',
    borderRadius: 4,
    color: '#7070a0',
    fontSize: 11,
    padding: '3px 4px',
    cursor: 'pointer',
    outline: 'none',
    width: '100%',
  },
  equipBtn: {
    background: 'rgba(91,141,238,0.15)',
    border: '1px solid rgba(91,141,238,0.4)',
    borderRadius: 4,
    color: '#5b8dee',
    cursor: 'pointer',
    fontSize: 11,
    padding: '4px 10px',
    alignSelf: 'flex-start',
  },
  trWarning: {
    fontSize: 10,
    color: '#e8a020',
    cursor: 'default',
    flexShrink: 0,
  },
  infoIcon: {
    fontSize: 10,
    color: '#4a4a60',
    cursor: 'default',
    flexShrink: 0,
    lineHeight: 1,
  },
}
