import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { createSearchMatcher } from '../../../../shared/textSearch.js'
import { useEntityStore } from '../../stores/entityStore'
import Object3DPreview from '../Object3DPreview.jsx'
import { styles } from '../Sidebar.styles.js'

const blueprintPlacementMode = (blueprint) => blueprint?.geometry?.placementMode || blueprint?.geometry?.placement_mode || 'free'

// Palette de l'onglet Objets 3D — extrait de SurfaceEditorPanel.jsx (§16, PLAN_WORLD_BUILDER_REWORK.md).
export default function EntityPalettePanelSection({
  activeBlueprint,
  onBlueprintSelect,
  objectSearch,
  setObjectSearch,
  refreshingObjects,
  setRefreshingObjects,
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { blueprints, refreshBuiltinModels } = useEntityStore()

  const matchesObjectQuery = createSearchMatcher(objectSearch)
  const bpList = Object.values(blueprints)
    .filter(bp => !bp.deprecated)
    .filter(bp => blueprintPlacementMode(bp) !== 'connector')
    .filter(bp => matchesObjectQuery(bp.label, bp.category))
  const grouped = bpList.reduce((groups, bp) => {
    const category = bp.category || t('sidebar.customObjects')
    if (!groups[category]) groups[category] = []
    groups[category].push(bp)
    return groups
  }, {})

  return (
    <div style={{ marginTop: '6px' }}>
      <div style={{ ...styles.paletteTitle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span>{t('sidebar.paletteEntities')}</span>
        <button
          type="button"
          className="btn"
          disabled={refreshingObjects}
          onClick={async () => {
            setRefreshingObjects(true)
            try {
              await refreshBuiltinModels()
            } catch (err) {
              console.error('[Bibliothèque 3D] Échec du rafraîchissement :', err)
            } finally {
              setRefreshingObjects(false)
            }
          }}
          title={t('sidebar.refreshObjectsHint')}
          style={{ padding: '3px 7px', fontSize: '10px' }}
        >
          {refreshingObjects ? '…' : t('sidebar.refreshObjects')}
        </button>
      </div>
      <input
        value={objectSearch}
        onChange={event => setObjectSearch(event.target.value)}
        placeholder={t('sidebar.searchObjects')}
        className="sidebar-tool-field"
        style={{ margin: '7px 0 9px' }}
      />
      {activeBlueprint?.glb_url && <Object3DPreview blueprint={activeBlueprint} />}
      {bpList.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '8px' }}>
          {t('sidebar.noBlueprints')}
        </p>
      )}
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} style={{ marginBottom: '10px' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '6px 8px 3px' }}>
            {category} <span style={{ opacity: 0.55 }}>({items.length})</span>
          </div>
          {items.sort((a, b) => a.label.localeCompare(b.label)).map(bp => {
            const isActive = activeBlueprint?.id === bp.id
            return (
              <button
                key={bp.id}
                onClick={() => onBlueprintSelect?.(isActive ? null : bp)}
                title={t('sidebar.clickThenPlace')}
                style={{ display: 'block', width: '100%', padding: '7px 10px', background: isActive ? 'var(--color-primary-muted)' : 'none', border: 'none', borderBottom: '1px solid var(--wiz-glass-border)', borderLeft: isActive ? '2px solid var(--color-primary)' : '2px solid transparent', color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)', fontSize: '12px', textAlign: 'left', cursor: 'pointer', transition: 'background 0.1s' }}
              >
                {blueprintPlacementMode(bp) === 'wall' ? '▥ ' : ''}{bp.label}
              </button>
            )
          })}
        </div>
      ))}
      <button className="btn" style={{ width: '100%', marginTop: '4px' }} onClick={() => navigate('/workshop')}>
        {t('sidebar.importCustomObject')}
      </button>
    </div>
  )
}
