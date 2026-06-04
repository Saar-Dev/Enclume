import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'
import './quill-dark.css'
import { useParams } from 'react-router-dom'
import api from '../lib/api'
import { useLibraryStore } from '../stores/libraryStore'

// ─── Toolbar ─────────────────────────────────────────────────────────────────

const TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike', 'clean'],
  [{ script: 'super' }, { script: 'sub' }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ align: [] }],
  ['link', 'blockquote'],
  [{ color: [] }],
  ['image'],
]

// ─── Handler image ────────────────────────────────────────────────────────────
// File picker → upload MinIO via POST /upload-image → URL insérée dans Quill.

function makeImageHandler(quill, campaignId, onError) {
  return function () {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.style.display = 'none'
    document.body.appendChild(input)

    let cleaned = false
    function cleanup() {
      if (!cleaned) { cleaned = true; document.body.removeChild(input) }
    }

    input.addEventListener('cancel', cleanup)
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      cleanup()
      if (!file) return

      const fd = new FormData()
      fd.append('image', file)

      api.post(`/campaigns/${campaignId}/documents/upload-image`, fd)
        .then(res => {
          const url = `${import.meta.env.VITE_API_URL}/api/assets/${res.data.url}`
          const range = quill.getSelection(true)
          quill.insertEmbed(range.index, 'image', url)
          quill.setSelection(range.index + 1)
        })
        .catch(err => {
          onError?.(err.response?.data?.error || 'Erreur upload image')
        })
    })

    input.click()
  }
}

// ─── Permissions — helper ────────────────────────────────────────────────────

function resolvePlayerCanEdit(doc, userId) {
  if (!doc) return false
  const e = doc.editor_ids
  if (e === 'all') return true
  if (e === 'none') return false
  return Array.isArray(e) && e.includes(userId)
}

// ─── Hook Quill — StrictMode safe ────────────────────────────────────────────
// Quill insère la toolbar comme previousElementSibling du container (pas dedans).
// Guard : classList.contains('ql-container') détecte une initialisation existante.
// Cleanup : retire la toolbar sibling + réinitialise le container.

function useQuillEditor(containerRef, initialHtml, editable, campaignId, onError) {
  useEffect(() => {
    // Capturer la valeur du ref au moment de l'effect.
    // containerRef.current peut être null dans le cleanup (React 19) —
    // la variable locale `container` reste valide dans la closure.
    const container = containerRef.current
    if (!container) return
    if (container.classList.contains('ql-container')) return

    const editor = new Quill(container, {
      theme: 'snow',
      readOnly: !editable,
      modules: editable
        ? { toolbar: { container: TOOLBAR } }
        : { toolbar: false },
    })

    if (editable) {
      const toolbar = editor.getModule('toolbar')
      if (toolbar) toolbar.addHandler('image', makeImageHandler(editor, campaignId, onError))
    }

    if (initialHtml) editor.clipboard.dangerouslyPasteHTML(initialHtml)

    return () => {
      // Utilise `container` capturé — pas containerRef.current (peut être null ici)
      const prev = container.previousElementSibling
      if (prev?.classList.contains('ql-toolbar')) prev.remove()
      container.innerHTML = ''
      container.className = ''
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Lit directement dans le DOM — aucune dépendance sur un ref intermédiaire.
  // Robuste même si editorRef était null.
  return { getHTML: () => containerRef.current?.querySelector('.ql-editor')?.innerHTML ?? '' }
}

// ─── Composant ───────────────────────────────────────────────────────────────

export default function DocumentModal({ doc, isGm, members, userId, onClose }) {
  const { t } = useTranslation()
  const { campaignId } = useParams()
  const { addDocument, updateDocument, removeDocument } = useLibraryStore()

  const isNew = !doc
  const canEditContent = isGm || resolvePlayerCanEdit(doc, userId)
  const isReadOnly = !canEditContent

  // ── Formulaire ────────────────────────────────────────────────────────────

  const [name,      setName]      = useState(doc?.name       ?? '')
  const [viewerIds, setViewerIds] = useState(doc?.viewer_ids ?? 'none')
  const [editorIds, setEditorIds] = useState(doc?.editor_ids ?? 'none')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState(null)

  // ── Éditeurs Quill ────────────────────────────────────────────────────────

  const contentRef = useRef(null)
  const gmNotesRef = useRef(null)

  const { getHTML: getContent  } = useQuillEditor(contentRef,  doc?.content_html  ?? '', canEditContent, campaignId, setError)
  const { getHTML: getGmNotes  } = useQuillEditor(gmNotesRef,  doc?.gm_notes_html ?? '', isGm,            campaignId, setError)

  const playerMembers = members.filter(m => m.role !== 'gm')

  // ── Sauvegarde ────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!name.trim()) { setError(t('library.documentName') + ' requis'); return }
    setSaving(true); setError(null)
    try {
      const body = { name: name.trim(), content_html: getContent() }
      if (isGm) {
        body.gm_notes_html = getGmNotes()
        body.viewer_ids    = viewerIds
        body.editor_ids    = editorIds
      }
      if (isNew) {
        const res = await api.post(`/campaigns/${campaignId}/documents`, body)
        addDocument(res.data.document)
      } else {
        const res = await api.put(`/campaigns/${campaignId}/documents/${doc.id}`, body)
        updateDocument(res.data.document)
      }
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(t('library.deleteConfirm'))) return
    setSaving(true)
    try {
      await api.delete(`/campaigns/${campaignId}/documents/${doc.id}`)
      removeDocument(doc.id)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={s.modal}>

        {/* Header */}
        <div style={s.header}>
          {isReadOnly
            ? <span style={s.titleText}>{doc?.name}</span>
            : <input style={s.nameInput} value={name} maxLength={255}
                placeholder={t('library.namePlaceholder')}
                onChange={e => setName(e.target.value)} />
          }
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Permissions GM */}
        {isGm && (
          <div style={s.permBar}>
            <PermissionSelect
              label={t('library.visibleBy')}
              value={viewerIds}
              onChange={setViewerIds}
              players={playerMembers}
              labelNobody={t('library.nobody')}
              labelAll={t('library.allPlayers')}
            />
            <div style={s.permDivider} />
            <PermissionSelect
              label={t('library.editableBy')}
              value={editorIds}
              onChange={setEditorIds}
              players={playerMembers}
              labelNobody={t('library.nobody')}
              labelAll={t('library.allPlayers')}
            />
          </div>
        )}

        {/* Corps */}
        <div style={s.body}>
          <EditorSection
            title={t('library.descriptionNotes')}
            badge={isReadOnly ? t('library.readOnly') : null}
          >
            <div ref={contentRef} />
          </EditorSection>

          {isGm && (
            <EditorSection title={t('library.gmNotes')} gmStyle>
              <div ref={gmNotesRef} />
            </EditorSection>
          )}
        </div>

        {error && <p style={s.errMsg}>{error}</p>}

        {/* Footer */}
        <div style={s.footer}>
          <div>
            {isGm && !isNew && (
              <button style={s.btnDelete} onClick={handleDelete} disabled={saving}>
                {t('library.delete')}
              </button>
            )}
          </div>
          <div style={s.footerRight}>
            <button style={s.btnCancel} onClick={onClose} disabled={saving}>
              {t('library.cancel')}
            </button>
            {!isReadOnly && (
              <button style={s.btnSave} onClick={handleSave} disabled={saving}>
                {saving ? '…' : t('library.save')}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── PermissionControl ───────────────────────────────────────────────────────
// Chips "Personne" / "Tous" + checkboxes joueurs individuels.
// value : 'none' | 'all' | string[]

// ─── PermissionSelect ────────────────────────────────────────────────────────
// Dropdown multi-sélection style Roll20.
// Rendu via createPortal (document.body) pour éviter le clipping du modal overflow:hidden.

function PermissionSelect({ label, value, onChange, players, labelNobody, labelAll }) {
  const [open, setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const triggerRef  = useRef(null)
  const dropdownRef = useRef(null)
  const [dropPos, setDropPos] = useState(null)

  // Fermeture au clic extérieur
  useEffect(() => {
    if (!open) return
    function onMouseDown(e) {
      if (
        !triggerRef.current?.contains(e.target) &&
        !dropdownRef.current?.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  function openDropdown() {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 3, left: r.left, width: Math.max(r.width, 240) })
    }
    setSearch('')
    setOpen(o => !o)
  }

  const isNone   = value === 'none'
  const isAll    = value === 'all'
  const selected = Array.isArray(value) ? value : []

  function summaryText() {
    if (isNone) return labelNobody
    if (isAll)  return labelAll
    if (selected.length === 1) return players.find(p => p.id === selected[0])?.username ?? '1 joueur'
    return `${selected.length} joueurs`
  }

  function togglePlayer(id) {
    const next = selected.includes(id)
      ? selected.filter(x => x !== id)
      : [...selected, id]
    onChange(next.length === 0 ? 'none' : next)
  }

  const filtered = search.trim()
    ? players.filter(p => p.username.toLowerCase().includes(search.toLowerCase()))
    : players

  return (
    <div style={pc.field}>
      <span style={pc.label}>{label}</span>
      <button ref={triggerRef} style={pc.trigger} onClick={openDropdown}>
        <span>{summaryText()}</span>
        <span style={pc.arrow}>{open ? '▴' : '▾'}</span>
      </button>

      {open && dropPos && createPortal(
        <div ref={dropdownRef} style={{ ...pc.dropdown, top: dropPos.top, left: dropPos.left, width: dropPos.width }}>
          {players.length > 4 && (
            <input
              autoFocus
              style={pc.searchInput}
              placeholder="Rechercher..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          )}
          <div style={pc.optionList}>
            <div
              style={{ ...pc.option, ...(isNone ? pc.optionActive : {}) }}
              onMouseDown={e => { e.preventDefault(); onChange('none'); setOpen(false) }}
            >
              <span style={pc.check}>{isNone ? '✓' : ''}</span>
              {labelNobody}
            </div>
            <div
              style={{ ...pc.option, ...(isAll ? pc.optionActive : {}) }}
              onMouseDown={e => { e.preventDefault(); onChange('all'); setOpen(false) }}
            >
              <span style={pc.check}>{isAll ? '✓' : ''}</span>
              {labelAll}
            </div>
            {filtered.length > 0 && <div style={pc.separator} />}
            {filtered.map(p => {
              const checked = selected.includes(p.id)
              return (
                <div
                  key={p.id}
                  style={{ ...pc.option, ...(checked ? pc.optionActive : {}) }}
                  onMouseDown={e => { e.preventDefault(); togglePlayer(p.id) }}
                >
                  <span style={pc.check}>{checked ? '✓' : ''}</span>
                  {p.username}
                </div>
              )
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── EditorSection ───────────────────────────────────────────────────────────

function EditorSection({ title, badge, gmStyle, children }) {
  return (
    <div style={{ ...s.section, ...(gmStyle ? s.sectionGm : {}) }}>
      <div style={s.sectionHead}>
        <span style={{ ...s.sectionTitle, ...(gmStyle ? { color: '#c8891a' } : {}) }}>
          {title}
        </span>
        {badge && <span style={s.badge}>{badge}</span>}
      </div>
      <div>{children}</div>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.72)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#111120',
    border: '1px solid #252540',
    borderRadius: '12px',
    width: '92%', maxWidth: '860px', maxHeight: '90vh',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '14px 18px',
    borderBottom: '1px solid #252540',
    background: '#0c0c1a',
    flexShrink: 0,
  },
  titleText: { flex: 1, color: '#ddddf0', fontSize: 16, fontWeight: 600 },
  nameInput: {
    flex: 1,
    background: '#1a1a30', border: '1px solid #3a3a60',
    borderRadius: 7, color: '#ddddf0',
    fontSize: 15, fontWeight: 600,
    padding: '7px 12px', outline: 'none',
  },
  closeBtn: {
    background: 'none', border: 'none',
    color: '#44445a', fontSize: 17, cursor: 'pointer',
    padding: '2px 6px', lineHeight: 1,
  },
  permBar: {
    display: 'flex', gap: 0,
    borderBottom: '1px solid #252540',
    background: '#0e0e1c',
    flexShrink: 0,
  },
  permDivider: {
    width: 1, background: '#252540', flexShrink: 0,
  },
  body: {
    flex: 1, overflowY: 'auto',
    padding: '14px 18px',
    display: 'flex', flexDirection: 'column', gap: 14,
    background: '#111120',
  },
  section: {
    border: '1px solid #252540', borderRadius: 8,
    overflow: 'hidden',
  },
  sectionGm: { border: '1px solid #3a2800' },
  sectionHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '7px 12px',
    background: '#0c0c1a',
    borderBottom: '1px solid #252540',
  },
  sectionTitle: {
    fontSize: 10, color: '#55557a',
    textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700,
  },
  badge: {
    fontSize: 10, color: '#44445a',
    background: '#1a1a2a', padding: '2px 7px', borderRadius: 3,
  },
  errMsg: {
    color: '#dd4444', fontSize: 12,
    padding: '4px 18px', margin: 0, flexShrink: 0,
    background: '#1a0808',
  },
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '11px 18px',
    borderTop: '1px solid #252540',
    background: '#0c0c1a',
    flexShrink: 0,
  },
  footerRight: { display: 'flex', gap: 8 },
  btnSave: {
    background: '#5b8dee', border: 'none',
    borderRadius: 7, color: '#fff',
    padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  btnCancel: {
    background: 'transparent', border: '1px solid #252540',
    borderRadius: 7, color: '#66667a',
    padding: '8px 14px', fontSize: 13, cursor: 'pointer',
  },
  btnDelete: {
    background: 'transparent', border: '1px solid #4a1515',
    borderRadius: 7, color: '#bb3333',
    padding: '8px 14px', fontSize: 13, cursor: 'pointer',
  },
}

// Styles PermissionSelect
const pc = {
  field: {
    flex: 1, display: 'flex', flexDirection: 'column', gap: 6,
    padding: '10px 14px',
  },
  label: {
    fontSize: 10, color: '#44446a',
    textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700,
  },
  trigger: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%',
    background: '#181828', border: '1px solid #333355',
    borderRadius: 6, color: '#9999bb',
    fontSize: 13, padding: '6px 10px', cursor: 'pointer', outline: 'none',
    textAlign: 'left',
  },
  arrow: { fontSize: 9, color: '#55557a', marginLeft: 6 },
  // Dropdown — rendu via portal dans document.body
  dropdown: {
    position: 'fixed',
    background: '#1a1a2e',
    border: '1px solid #3a3a60',
    borderRadius: 7,
    boxShadow: '0 8px 28px rgba(0,0,0,0.65)',
    zIndex: 2000,
    maxHeight: 280,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  },
  searchInput: {
    background: '#111120', border: 'none',
    borderBottom: '1px solid #252545',
    color: '#ccc', fontSize: 13,
    padding: '8px 12px', outline: 'none', flexShrink: 0,
  },
  optionList: { overflowY: 'auto', flex: 1 },
  option: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 12px',
    color: '#9999bb', fontSize: 13, cursor: 'pointer',
    userSelect: 'none',
  },
  optionActive: { background: '#1e2a4a', color: '#7aaaff' },
  check: { width: 14, fontSize: 11, color: '#5b8dee', flexShrink: 0 },
  separator: { height: 1, background: '#252545', margin: '2px 0' },
}
