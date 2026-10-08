// client/src/character/EquipmentInfoPopover.jsx
// Bouton (i) + détail complet d'un objet d'inventaire déjà possédé (MARCHAND-UX-REVIEW,
// 2026-10-08) — même coquille que SkillInfoPopover.jsx (InfoPopover.jsx), même source de champs
// que le Marchand/Catalogue équipement (lib/equipmentFields.js). La description (déjà chargée avec
// l'inventaire, `item.ref_description`/`custom_desc`) s'affiche tout de suite ; le reste des
// statistiques est chargé à la demande via GET /equipment/:id (equipmentDetailCache.js) — jamais
// embarqué dans la requête d'inventaire, qui n'en a pas besoin pour gérer l'équipement en jeu.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import InfoPopover, { InfoButton } from '../components/InfoPopover.jsx'
import { openInfoPanel } from '../lib/infoPopover.js'
import { fetchEquipmentDetail } from '../lib/equipmentDetailCache.js'
import { equipmentDisplayFields } from '../lib/equipmentFields.js'

const PANEL_WIDTH = 320
const PANEL_HEIGHT = 460

// item vient de useInventoryData (getInventory, champs préfixés ref_*) — un item custom
// (sans equipment_id) n'a rien à charger en plus de ce qu'il porte déjà (custom_desc).
export function EquipmentInfoButton({ item, setDetailPanel }) {
  const { t } = useTranslation('charSheet')
  const hasContent = Boolean(item?.equipment_id || item?.custom_desc)
  if (!hasContent) return null
  return (
    <InfoButton
      title={t('inventoryPanel.infoPopover.buttonTitle')}
      onOpen={(e) => openInfoPanel(item, e, setDetailPanel, { width: PANEL_WIDTH, height: PANEL_HEIGHT })}
    />
  )
}

export default function EquipmentInfoPopover({ popover, popoverRef, onClose }) {
  const { t } = useTranslation('charSheet')
  const item = popover?.data
  const equipmentId = item?.equipment_id ?? null
  const [full, setFull] = useState(null)
  const [loadError, setLoadError] = useState(false)

  // Pas de reset manuel ici : InventoryPanel remonte ce composant (key=item.id) à chaque ouverture
  // sur un objet différent, donc full/loadError repartent déjà à leur valeur initiale — l'effet n'a
  // qu'à s'abonner au résultat du chargement (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!equipmentId) return undefined
    let cancelled = false
    fetchEquipmentDetail(equipmentId)
      .then(detail => { if (!cancelled) setFull(detail) })
      .catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [equipmentId])

  if (!popover || !item) return null

  const name = item.custom_name || item.ref_name || t('inventoryPanel.unnamedItem')
  const description = item.ref_description || item.custom_desc || null

  return (
    <InfoPopover panel={popover} popoverRef={popoverRef} onClose={onClose} title={name}>
      <div style={s.body}>
        {description && <p style={s.description}>{description}</p>}
        {equipmentId && !full && !loadError && <p style={s.note}>{t('inventoryPanel.infoPopover.loading')}</p>}
        {loadError && <p style={s.note}>{t('inventoryPanel.infoPopover.loadError')}</p>}
        {full && (
          <div style={s.grid}>
            {equipmentDisplayFields(full).map(({ key, label, value }) => (
              <div key={key} style={s.row}>
                <span style={s.label}>{label}</span>
                <span style={s.value}>{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </InfoPopover>
  )
}

const s = {
  body: {
    padding: '6px 12px 12px',
    fontSize: '11px',
    color: '#9090a8',
    overflowY: 'auto',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  description: { margin: 0, color: '#7a7a9a', lineHeight: '1.6', fontStyle: 'italic' },
  note: { margin: 0, color: '#5a5a7a', fontStyle: 'italic' },
  grid: { display: 'flex', flexDirection: 'column', gap: '4px' },
  row: { display: 'flex', justifyContent: 'space-between', gap: '10px', borderTop: '1px solid #1e1e2e', paddingTop: '4px' },
  label: { color: '#5a5a7a', flexShrink: 0 },
  value: { color: '#c0c0d0', textAlign: 'right' },
}
