import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

// docs/PLAN_BATTLEMAP2D.md §9 (Lot 4) — sélecteur de cartes façon Roll20 : arbre de dossiers à
// gauche, grille de vignettes (sous-dossiers + cartes du dossier courant) à droite. Modale plein
// cadre par-dessus la session (pas un mode plein écran équivalent à Editor3D) — fermeture au clic
// "Fermer"/Échap, la session reste chargée derrière.

// Liste plate {id, parent_folder_id, name} → arbre {..., children: [...]}, trié alphabétiquement à
// chaque niveau (V1 : pas de tri manuel, cf. plan §9).
function buildFolderTree(folders) {
  const byParent = new Map()
  for (const folder of folders) {
    const key = folder.parent_folder_id || null
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(folder)
  }
  for (const list of byParent.values()) list.sort((a, b) => a.name.localeCompare(b.name))

  const attach = (parentId) => (byParent.get(parentId) || []).map(folder => ({
    ...folder,
    children: attach(folder.id),
  }))
  return attach(null)
}

function FolderTreeNode({ node, depth, currentFolderId, onNavigate }) {
  const isActive = node.id === currentFolderId
  return (
    <>
      <div
        style={{ ...styles.treeRow, paddingLeft: 12 + depth * 14, ...(isActive ? styles.treeRowActive : {}) }}
        onClick={() => onNavigate(node.id)}
        title={node.name}
      >
        {'📁 '}{node.name}
      </div>
      {node.children.map(child => (
        <FolderTreeNode key={child.id} node={child} depth={depth + 1} currentFolderId={currentFolderId} onNavigate={onNavigate} />
      ))}
    </>
  )
}

export default function BattlemapSelectorPanel({
  isOpen, onClose,
  battlemaps, folders, battlemap,
  currentFolderId, onNavigateFolder,
  search, onSearchChange,
  onSelectMap, onMapContextMenu,
  onCreateMap, onCreateFolder, onRenameFolder, onDeleteFolder,
}) {
  const { t } = useTranslation()

  useEffect(() => {
    if (!isOpen) return undefined
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  const tree = useMemo(() => buildFolderTree(folders), [folders])

  if (!isOpen) return null

  const searchTerm = search.trim().toLowerCase()
  const childFolders = folders
    .filter(f => (f.parent_folder_id || null) === currentFolderId)
    .filter(f => !searchTerm || f.name.toLowerCase().includes(searchTerm))
    .sort((a, b) => a.name.localeCompare(b.name))
  const childMaps = battlemaps
    .filter(bm => (bm.folder_id || null) === currentFolderId)
    .filter(bm => !searchTerm || bm.name.toLowerCase().includes(searchTerm))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div style={styles.overlay} onMouseDown={onClose}>
      <div style={styles.panel} onMouseDown={e => e.stopPropagation()}>
        <div style={styles.header}>
          <strong style={styles.title}>{t('session.selectorTitle')}</strong>
          <input
            style={styles.search}
            placeholder={t('session.selectorSearchPlaceholder')}
            value={search}
            onChange={e => onSearchChange(e.target.value)}
          />
          <button className="btn" onClick={onCreateMap}>{t('session.mapCreate')}</button>
          <button className="btn btn-ghost" onClick={onClose}>{t('common.close')}</button>
        </div>
        <div style={styles.body}>
          <div style={styles.treePane}>
            <div
              style={{ ...styles.treeRow, ...(currentFolderId === null ? styles.treeRowActive : {}) }}
              onClick={() => onNavigateFolder(null)}
            >
              {t('session.foldersRoot')}
            </div>
            {tree.map(node => (
              <FolderTreeNode
                key={node.id}
                node={node}
                depth={1}
                currentFolderId={currentFolderId}
                onNavigate={onNavigateFolder}
              />
            ))}
            <button className="btn btn-ghost" style={styles.newFolderBtn} onClick={() => onCreateFolder(currentFolderId)}>
              {t('session.folderCreate')}
            </button>
          </div>
          <div style={styles.gridPane}>
            {childFolders.length === 0 && childMaps.length === 0 && (
              <p style={styles.emptyHint}>{t('session.selectorEmpty')}</p>
            )}
            <div style={styles.grid}>
              {childFolders.map(folder => (
                <div key={folder.id} style={styles.tile} onDoubleClick={() => onNavigateFolder(folder.id)}>
                  <div style={styles.tileIcon}>📁</div>
                  <div style={styles.tileName} title={folder.name}>{folder.name}</div>
                  <div style={styles.tileActions}>
                    <button
                      className="btn-icon"
                      title={t('session.folderRename')}
                      onClick={(e) => { e.stopPropagation(); onRenameFolder(folder) }}
                    >
                      ✎
                    </button>
                    <button
                      className="btn-icon"
                      title={t('session.folderDelete')}
                      onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder) }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
              {childMaps.map(bm => (
                <div
                  key={bm.id}
                  style={{ ...styles.tile, ...(bm.id === battlemap?.id ? styles.tileActive : {}) }}
                  onClick={() => onSelectMap(bm)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    onMapContextMenu(bm, e.clientX, e.clientY)
                  }}
                >
                  {bm.render_mode === '2d' && bm.image_url ? (
                    <img
                      src={`${import.meta.env.VITE_API_URL}/api/assets/${bm.image_url}`}
                      alt={bm.name}
                      style={styles.tileImage}
                    />
                  ) : (
                    <div style={styles.tileIcon}>{bm.render_mode === '2d' ? '🖼' : '🧊'}</div>
                  )}
                  <div style={styles.tileName} title={bm.name}>{bm.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    // En-dessous des modales ponctuelles (créer/renommer/paramètres/déplacer, SessionPage.jsx
    // styles.modalOverlay = 10000) : ces modales s'ouvrent PAR-DESSUS ce panneau (ex. "Nouvelle
    // carte" ou clic droit → "Déplacer vers…" depuis une vignette), jamais dessous.
    zIndex: 9500,
  },
  panel: {
    backgroundColor: '#16162a',
    border: '1px solid #2a2a3e',
    borderRadius: '10px',
    width: '90vw',
    maxWidth: '1100px',
    height: '80vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 18px',
    borderBottom: '1px solid #2a2a3e',
  },
  title: {
    fontSize: '15px',
    color: '#c0c0d0',
    flexShrink: 0,
  },
  search: {
    flex: 1,
    backgroundColor: '#0e0e1a',
    border: '1px solid #2a2a3e',
    borderRadius: '6px',
    padding: '8px 12px',
    color: '#c0c0d0',
    fontSize: '13px',
  },
  body: {
    flex: 1,
    display: 'flex',
    minHeight: 0,
  },
  treePane: {
    width: '220px',
    flexShrink: 0,
    borderRight: '1px solid #2a2a3e',
    overflowY: 'auto',
    padding: '10px 0',
    display: 'flex',
    flexDirection: 'column',
  },
  treeRow: {
    padding: '7px 12px',
    fontSize: '13px',
    color: '#c0c0d0',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  treeRowActive: {
    backgroundColor: '#2a2a3e',
    color: '#fff',
  },
  newFolderBtn: {
    margin: '10px 12px 0',
    fontSize: '12px',
  },
  gridPane: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
  emptyHint: {
    color: '#6a6a80',
    fontSize: '13px',
    textAlign: 'center',
    marginTop: '40px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '14px',
  },
  tile: {
    position: 'relative',
    backgroundColor: '#0e0e1a',
    border: '1px solid #2a2a3e',
    borderRadius: '8px',
    padding: '10px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  tileActive: {
    borderColor: '#46c6e6',
  },
  tileIcon: {
    fontSize: '32px',
    lineHeight: 1,
  },
  tileImage: {
    width: '100%',
    height: '80px',
    objectFit: 'cover',
    borderRadius: '4px',
  },
  tileName: {
    fontSize: '12px',
    color: '#c0c0d0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
  },
  tileActions: {
    position: 'absolute',
    top: '4px',
    right: '4px',
    display: 'flex',
    gap: '2px',
  },
}
