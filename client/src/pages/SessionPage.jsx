import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../stores/authStore'
import api from '../lib/api'
import Canvas3D from '../components/Canvas3D'
import Sidebar from '../components/Sidebar'

export default function SessionPage() {
  const { campaignId } = useParams()
  const { user } = useAuthStore()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [campaign, setCampaign] = useState(null)
  const [battlemap, setBattlemap] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [mode, setMode] = useState('play')
  const [layer, setLayer] = useState('token')
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(300)
  const [activeMaterial, setActiveMaterial] = useState(1)
  const [availableMaterials, setAvailableMaterials] = useState([])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/campaigns/${campaignId}`)
        setCampaign(res.data.campaign)
        const mapId = res.data.campaign.default_battlemap_id
        if (mapId) {
          const mapRes = await api.get(`/battlemaps/${mapId}`)
          setBattlemap(mapRes.data.battlemap)
        }
      } catch (err) {
        setError(t('session.connectionError'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [campaignId])

  if (loading) return (
    <div style={styles.loading}>
      <p>{t('session.loading')}</p>
    </div>
  )

  if (error) return (
    <div style={styles.loading}>
      <p>{error}</p>
      <button onClick={() => navigate('/dashboard')}>← Dashboard</button>
    </div>
  )

  return (
    <div style={styles.container}>
      <div style={styles.canvas}>
        <Canvas3D
          battlemap={battlemap}
          mode={mode}
          activeMaterial={activeMaterial}
          onVoxelDataChange={(data) => setBattlemap(prev => ({ ...prev, voxel_data: data }))}
          onPackLoaded={setAvailableMaterials}
          socket={null}
        />
      </div>

      {sidebarVisible && (
        <Sidebar
          mode={mode}
          onModeChange={setMode}
          layer={layer}
          onLayerChange={setLayer}
          width={sidebarWidth}
          onWidthChange={setSidebarWidth}
          onClose={() => setSidebarVisible(false)}
          activeMaterial={activeMaterial}
          onMaterialChange={setActiveMaterial}
          availableMaterials={availableMaterials}
        />
      )}

      {!sidebarVisible && (
        <button
          onClick={() => setSidebarVisible(true)}
          title="Ouvrir la sidebar"
          style={styles.reopenBtn}
        >
          ‹
        </button>
      )}
    </div>
  )
}

const styles = {
  container: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    background: '#0a0a0f',
    overflow: 'hidden',
  },
  canvas: {
    flex: 1,
    height: '100%',
    minWidth: 0,
  },
  loading: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0a0f',
    color: '#9090a8',
    fontFamily: 'monospace',
    gap: '16px',
  },
  reopenBtn: {
    position: 'fixed',
    right: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 9999,
    background: '#16162a',
    border: '1px solid #5b8dee',
    borderRight: 'none',
    borderRadius: '8px 0 0 8px',
    color: '#5b8dee',
    cursor: 'pointer',
    padding: '14px 8px',
    fontSize: '18px',
    lineHeight: 1,
    boxShadow: '-4px 0 12px rgba(0,0,0,0.4)',
  },
}