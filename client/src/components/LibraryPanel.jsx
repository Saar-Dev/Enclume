import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../stores/authStore'
import { useCharacterStore } from '../stores/characterStore'
import { useLibraryStore } from '../stores/libraryStore'
import DocumentModal from './DocumentModal'

// ─── Icônes SVG ──────────────────────────────────────────────────────────────

const IconEye = ({ color = '#5b8dee' }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)

const IconEyeOff = ({ color = '#44445a' }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)

const IconPin = ({ color = '#9090a8' }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill={color} stroke="none">
    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
  </svg>
)

// ─── Indicateur de partage ────────────────────────────────────────────────────

function ShareIndicator({ doc, characters }) {
  const { viewer_ids } = doc

  if (viewer_ids === 'none') {
    return (
      <span title="Non partagé (MJ uniquement)">
        <IconEyeOff />
      </span>
    )
  }

  if (viewer_ids === 'all') {
    return (
      <span title="Partagé à tous les joueurs">
        <IconEye />
      </span>
    )
  }

  if (Array.isArray(viewer_ids) && viewer_ids.length > 0) {
    // Couleur du premier joueur via ses personnages
    const firstChar = characters.find(c => c.user_id === viewer_ids[0])
    const pinColor  = firstChar?.color ?? '#9090a8'
    const count     = viewer_ids.length
    const label     = `Partagé à ${count} joueur${count > 1 ? 's' : ''}`

    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }} title={label}>
        <IconPin color={pinColor} />
        {count > 1 && <span style={styles.pinCount}>{count}</span>}
      </span>
    )
  }

  return null
}

// ─── Composant principal ─────────────────────────────────────────────────────

export default function LibraryPanel() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { isGm, members, characters } = useCharacterStore()
  const { documents } = useLibraryStore()

  const [selectedDoc, setSelectedDoc] = useState(null)
  const [isCreating,  setIsCreating]  = useState(false)

  function canEdit(doc) {
    if (isGm) return true
    const e = doc.editor_ids
    if (e === 'all') return true
    if (e === 'none') return false
    return Array.isArray(e) && e.includes(user?.id)
  }

  function handleNewDocument() { setSelectedDoc(null); setIsCreating(true)  }
  function handleOpenDocument(doc) { setSelectedDoc(doc); setIsCreating(false) }
  function handleClose() { setSelectedDoc(null); setIsCreating(false) }

  return (
    <div style={styles.container}>

      {isGm && (
        <button className="btn" style={{ width: '100%' }} onClick={handleNewDocument}>
          {t('library.newDocument')}
        </button>
      )}

      {documents.length === 0 ? (
        <p style={styles.empty}>
          {isGm ? t('library.emptyState') : t('library.emptyStatePlayer')}
        </p>
      ) : (
        <div style={styles.list}>
          {documents.map(doc => (
            <button key={doc.id} className="doc-row" onClick={() => handleOpenDocument(doc)}>
              <span style={styles.docName}>{doc.name}</span>
              <span style={styles.docIcons}>
                <ShareIndicator doc={doc} characters={characters} />
                {canEdit(doc) && (
                  <span title={t('library.editableIcon')} style={styles.editDot}>✎</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      {(isCreating || selectedDoc) && (
        <DocumentModal
          doc={selectedDoc}
          isGm={isGm}
          members={members}
          userId={user?.id}
          onClose={handleClose}
        />
      )}
    </div>
  )
}

const styles = {
  container: {
    display: 'flex', flexDirection: 'column', gap: '8px',
    padding: '10px', height: '100%',
  },
  empty: {
    color: '#555', fontSize: '13px', textAlign: 'center', marginTop: '20px',
  },
  list: {
    display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto',
  },
  docName: {
    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  docIcons: {
    display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px',
  },
  editDot: {
    fontSize: '11px', color: '#5b5b7a',
  },
  pinCount: {
    fontSize: '9px', color: '#888', lineHeight: 1,
  },
}
