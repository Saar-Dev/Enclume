import { useTranslation } from 'react-i18next'

// Extrait de Sidebar.jsx (PLAN_REFACTOR_SIDEBAR.md, lot 4a) — comportement inchangé.
// showHelp/setShowHelp restent dans Sidebar.jsx : le bouton qui ouvre cette modale
// vit dans la barre d'outils permanente de Sidebar.jsx, pas dans la modale elle-même.
export default function SidebarHelpModal({ mode, open, onClose }) {
  const { t } = useTranslation()
  if (!open) return null
  return (
    <div className="sidebar-help-overlay" onClick={onClose}>
      <div className="sidebar-help-modal" onClick={e => e.stopPropagation()}>
        <div className="sidebar-help-header">
          <span className="sidebar-help-title">{t('sidebar.helpTitle')}</span>
          <button className="sidebar-help-close-btn" onClick={onClose}>×</button>
        </div>

        {mode !== 'edit' && (
          <>
            <div className="sidebar-help-section">{t('sidebar.helpSectionPlay')}</div>
            <div className="sidebar-help-row"><kbd className="sidebar-kbd">Alt</kbd><span>{t('sidebar.helpAlt')}</span></div>
            <div className="sidebar-help-row"><kbd className="sidebar-kbd">/r formule</kbd><span>{t('sidebar.helpDiceRoll')}</span></div>
            <div className="sidebar-help-row"><kbd className="sidebar-kbd">Drag</kbd><span>{t('sidebar.helpDrag')}</span></div>
          </>
        )}

        {mode === 'edit' && (
          <>
            <div className="sidebar-help-section">{t('sidebar.helpSectionEdit')}</div>
            <div className="sidebar-help-row"><kbd className="sidebar-kbd">Clic gauche</kbd><span>{t('sidebar.helpVoxelPlace')}</span></div>
            <div className="sidebar-help-row"><kbd className="sidebar-kbd">Clic droit</kbd><span>{t('sidebar.helpVoxelErase')}</span></div>
            <div className="sidebar-help-row"><kbd className="sidebar-kbd">R</kbd><span>{t('sidebar.helpVoxelRotate')}</span></div>
            <div className="sidebar-help-row"><kbd className="sidebar-kbd">1</kbd><span>{t('sidebar.helpGeoCube')}</span></div>
            <div className="sidebar-help-row"><kbd className="sidebar-kbd">2</kbd><span>{t('sidebar.helpGeoDalleB')}</span></div>
            <div className="sidebar-help-row"><kbd className="sidebar-kbd">3</kbd><span>{t('sidebar.helpGeoDalleH')}</span></div>
            <div className="sidebar-help-row"><kbd className="sidebar-kbd">4</kbd><span>{t('sidebar.helpGeoSlope')}</span></div>
            <div className="sidebar-help-row"><kbd className="sidebar-kbd">5</kbd><span>{t('sidebar.helpGeoWedge')}</span></div>
            <div className="sidebar-help-row"><kbd className="sidebar-kbd">Ctrl+Z</kbd><span>{t('sidebar.helpUndo')}</span></div>
            <div className="sidebar-help-row"><kbd className="sidebar-kbd">Ctrl+Y</kbd><span>{t('sidebar.helpRedo')}</span></div>
            <div className="sidebar-help-row"><kbd className="sidebar-kbd">Suppr</kbd><span>{t('sidebar.helpDelete')}</span></div>
            <div className="sidebar-help-row"><kbd className="sidebar-kbd">Alt</kbd><span>{t('sidebar.helpEntitiesHighlight')}</span></div>
          </>
        )}
      </div>
    </div>
  )
}
