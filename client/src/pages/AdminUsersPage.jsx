import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'

// Panneau Lot 3 (docs/PLANS/PLAN_ADMIN.md) — liste des comptes, promotion/rétrogradation avec
// confirmation. Le client ne prédit jamais le rejet "dernier admin" (server/src/services/
// adminUserService.js) : le serveur reste seul autoritaire, l'erreur 409 s'affiche telle quelle si
// elle survient — pas d'heuristique client dupliquant une logique déjà en base.
export default function AdminUsersPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pendingChange, setPendingChange] = useState(null) // { id, username, newRole }
  const [saving, setSaving] = useState(false)

  useEffect(() => { document.title = 'Enclume — Utilisateurs' }, [])

  useEffect(() => {
    api.get('/admin/users')
      .then(res => setUsers(res.data.users))
      .catch(() => setError(t('adminUsers.errorLoad')))
      .finally(() => setLoading(false))
  }, [t])

  const confirmChange = async () => {
    if (!pendingChange) return
    setSaving(true)
    try {
      const res = await api.patch(`/admin/users/${pendingChange.id}/role`, { role: pendingChange.newRole })
      setUsers(prev => prev.map(u => u.id === res.data.user.id ? { ...u, role: res.data.user.role } : u))
      setPendingChange(null)
      setError(null)
    } catch (err) {
      setError(err.response?.data?.error?.message || t('adminUsers.errorSave'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={S.container}>

      <div style={S.header}>
        <span onClick={() => navigate('/admin')} style={S.backBtn}>← {t('adminUsers.backToAdmin')}</span>
      </div>

      <div style={S.body}>
        <h1 style={S.pageTitle}>{t('adminUsers.title')}</h1>

        {error && <div style={S.errorBanner} onClick={() => setError(null)}>{error}</div>}

        {loading ? (
          <p style={S.muted}>{t('common.loading')}</p>
        ) : (
          <div style={S.list}>
            {users.map(u => (
              <div key={u.id} style={S.row}>
                <div style={S.rowMain}>
                  <span style={S.rowName}>{u.username}</span>
                  <span style={S.muted}>{u.email}</span>
                  <span className={u.role === 'admin' ? 'badge badge-gm' : 'badge'}>
                    {u.role === 'admin' ? t('adminUsers.roleAdmin') : t('adminUsers.roleUser')}
                  </span>
                </div>
                <div style={S.rowActions}>
                  <button
                    style={S.btnSecondary}
                    onClick={() => setPendingChange({
                      id: u.id,
                      username: u.username,
                      newRole: u.role === 'admin' ? 'user' : 'admin',
                    })}
                  >
                    {u.role === 'admin' ? t('adminUsers.demote') : t('adminUsers.promote')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {pendingChange && (
        <div style={S.overlay} onClick={() => setPendingChange(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <h2 style={S.modalTitle}>
              {pendingChange.newRole === 'admin'
                ? t('adminUsers.confirmPromoteTitle')
                : t('adminUsers.confirmDemoteTitle')}
            </h2>
            <p style={S.modalText}>
              {t('adminUsers.confirmText', { username: pendingChange.username })}
            </p>
            <div style={S.modalFooter}>
              <button style={S.btnGhost} onClick={() => setPendingChange(null)}>{t('common.cancel')}</button>
              <button
                style={pendingChange.newRole === 'user' ? S.btnDanger : S.btnPrimary}
                onClick={confirmChange}
                disabled={saving}
              >
                {saving ? t('common.loading') : t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Styles (même patron que VaultPage.jsx) ───────────────────────────────────
const S = {
  container: { minHeight: '100vh', backgroundColor: 'var(--bg-app)', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', padding: '0 24px', height: '52px', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 },
  backBtn: { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' },
  pageTitle: { fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 22px' },
  errorBanner: { backgroundColor: 'rgba(224,92,92,0.12)', border: '1px solid var(--color-danger)', borderRadius: '6px', padding: '8px 16px', color: 'var(--color-danger)', fontSize: '13px', margin: '0 0 16px', cursor: 'pointer' },

  body: { flex: 1, maxWidth: '640px', width: '100%', margin: '0 auto', padding: '24px' },
  muted: { color: 'var(--text-muted)', fontSize: '13px' },

  list: { display: 'flex', flexDirection: 'column', gap: '8px' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '10px 14px', flexWrap: 'wrap', gap: '8px' },
  rowMain: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 },
  rowName: { fontSize: '14px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowActions: { display: 'flex', gap: '8px', flexShrink: 0 },

  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '24px', width: '380px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '14px' },
  modalTitle: { fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 },
  modalText: { fontSize: '13px', color: 'var(--text-secondary)', margin: 0 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '8px' },

  btnSecondary: { background: 'none', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '6px 12px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' },
  btnPrimary: { backgroundColor: 'var(--bg-button-primary)', border: 'none', borderRadius: '6px', padding: '6px 12px', color: '#fff', fontSize: '13px', cursor: 'pointer' },
  btnDanger: { backgroundColor: 'rgba(224,92,92,0.15)', border: '1px solid var(--color-danger)', borderRadius: '6px', padding: '6px 12px', color: 'var(--color-danger)', fontSize: '13px', cursor: 'pointer' },
  btnGhost: { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', padding: '7px', cursor: 'pointer' },
}
