import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// Regroupe les outils admin (Santé, Dice, BDD, Utilisateurs, Tickets). Protection réelle côté
// serveur (requireAdmin) pour Santé/BDD/Utilisateurs/Tickets ; AdminRoute est la seule protection
// possible pour Dice (aucune route serveur à gater, docs/Old/PLAN_ADMIN.md §2.2).
export default function AdminPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  useEffect(() => { document.title = 'Enclume — Administration' }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)', padding: '24px 32px' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <span
          onClick={() => navigate('/dashboard')}
          style={{ color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}
        >
          ← {t('admin.backToDashboard')}
        </span>
      </div>

      <h1 style={{ margin: '0 0 22px', fontSize: 18, color: 'var(--text-primary)', fontWeight: 600 }}>
        {t('admin.title')}
      </h1>

      <div className="campaign-grid">

        <div className="card campaign-card" onClick={() => navigate('/health')}>
          <div className="card-title">{t('admin.tileHealth')}</div>
        </div>

        <div className="card campaign-card" onClick={() => navigate('/dev/dice-calibration')}>
          <div className="card-title">{t('admin.tileDice')}</div>
        </div>

        <a
          href={`${import.meta.env.VITE_API_URL}/api/admin/tools/equipment`}
          className="card campaign-card"
          style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
        >
          <div className="card-title">{t('admin.tileEquipment')}</div>
        </a>

        <a
          href={`${import.meta.env.VITE_API_URL}/api/admin/tools/exo-templates`}
          className="card campaign-card"
          style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
        >
          <div className="card-title">{t('admin.tileExoTemplates')}</div>
        </a>

        <div className="card campaign-card" onClick={() => navigate('/admin/users')}>
          <div className="card-title">{t('admin.tileUsers')}</div>
        </div>

        <div className="card campaign-card" onClick={() => navigate('/admin/tickets')}>
          <div className="card-title">{t('admin.tileTickets')}</div>
        </div>

      </div>
    </div>
  )
}
