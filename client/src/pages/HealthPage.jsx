import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import api from '../lib/api'

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}j ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function ProgressBar({ percent, color = '#3a8aaa' }) {
  const fill = percent > 80 ? '#e05252' : percent > 60 ? '#e0a052' : color
  return (
    <div style={{ background: '#0f1a24', borderRadius: 4, height: 10, overflow: 'hidden', margin: '6px 0' }}>
      <div style={{ width: `${Math.min(percent, 100)}%`, height: '100%', background: fill, borderRadius: 4, transition: 'width 0.5s ease' }} />
    </div>
  )
}

function Card({ title, children, style }) {
  return (
    <div style={{ background: '#1a2535', border: '1px solid #2a3a4a', borderRadius: 8, padding: '14px 18px', ...style }}>
      <div style={{ color: '#7a9aaa', fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )
}

function ServiceBadge({ name, status }) {
  const active = status === 'active'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: active ? '#52e07a' : '#e05252', boxShadow: active ? '0 0 6px #52e07a88' : 'none', flexShrink: 0 }} />
      <span style={{ color: '#ccd8e0', fontSize: 13, flex: 1 }}>{name}</span>
      <span style={{ color: active ? '#52e07a' : '#e05252', fontSize: 11 }}>{status}</span>
    </div>
  )
}

export default function HealthPage() {
  const { t } = useTranslation()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const intervalRef = useRef(null)

  const fetchHealth = async () => {
    try {
      const res = await api.get('/health/detailed')
      setData(res.data)
      setLastUpdate(new Date())
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    fetchHealth()
    intervalRef.current = setInterval(fetchHealth, 5000)
    return () => clearInterval(intervalRef.current)
  }, [])

  const memPercent = data ? Math.round(data.memory.usedMb / data.memory.totalMb * 100) : 0
  const diskPercent = data?.disk?.percent ?? 0

  const temps = data?.hwmon?.filter(s => s.celsius !== undefined) ?? []
  const fans = data?.hwmon?.filter(s => s.rpm !== undefined) ?? []
  const hasHwmon = temps.length > 0 || fans.length > 0

  return (
    <div style={{ minHeight: '100vh', background: '#111820', color: '#e0e8f0', fontFamily: 'monospace', padding: '24px 32px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Link to="/dashboard" style={{ color: '#7a9aaa', textDecoration: 'none', fontSize: 13 }}>
          ← {t('health.backToDashboard')}
        </Link>
        <div style={{ flex: 1 }} />
        {lastUpdate && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#52e07a', animation: 'hpulse 2s infinite' }} />
            <span style={{ color: '#52e07a', fontSize: 11, fontWeight: 600 }}>LIVE</span>
            <span style={{ color: '#445566', fontSize: 11 }}>— {t('health.updatedAt')} {lastUpdate.toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      <h1 style={{ margin: '0 0 22px', fontSize: 18, color: '#e0e8f0', fontWeight: 600 }}>{t('health.title')}</h1>

      {error && (
        <div style={{ background: '#2a1010', border: '1px solid #e05252', borderRadius: 6, padding: '10px 14px', marginBottom: 20, color: '#e05252', fontSize: 13 }}>
          {t('common.error')} : {error}
        </div>
      )}

      {!data && !error && (
        <div style={{ color: '#7a9aaa', fontSize: 13 }}>{t('common.loading')}</div>
      )}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 14, marginBottom: 14 }}>

            {/* Système */}
            <Card title={t('health.system')}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#e0e8f0', marginBottom: 2 }}>{formatUptime(data.uptime)}</div>
              <div style={{ color: '#7a9aaa', fontSize: 11, marginBottom: 12 }}>{t('health.uptime')}</div>
              <div style={{ color: '#99aabb', fontSize: 12, lineHeight: 1.7 }}>
                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.cpu.model}</div>
                <div>{data.cpu.count} {t('health.cores')} · {data.cpu.speedMhz} MHz</div>
              </div>
            </Card>

            {/* Charge CPU */}
            <Card title={t('health.load')}>
              <div style={{ display: 'flex', gap: 24 }}>
                {[['1m', data.loadAvg[0]], ['5m', data.loadAvg[1]], ['15m', data.loadAvg[2]]].map(([label, val]) => {
                  const ratio = val / data.cpu.count
                  const col = ratio > 0.8 ? '#e05252' : ratio > 0.5 ? '#e0a052' : '#52e07a'
                  return (
                    <div key={label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: col }}>{val.toFixed(2)}</div>
                      <div style={{ color: '#7a9aaa', fontSize: 11, marginTop: 2 }}>{label}</div>
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* Mémoire */}
            <Card title={t('health.memory')}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                <span style={{ fontSize: 20, fontWeight: 700 }}>{memPercent}%</span>
                <span style={{ color: '#7a9aaa', fontSize: 12 }}>{data.memory.usedMb} / {data.memory.totalMb} Mo</span>
              </div>
              <ProgressBar percent={memPercent} />
              <div style={{ color: '#7a9aaa', fontSize: 11, marginTop: 2 }}>{data.memory.freeMb} Mo {t('health.free')}</div>
            </Card>

            {/* Disque */}
            {data.disk && (
              <Card title={t('health.disk')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                  <span style={{ fontSize: 20, fontWeight: 700 }}>{diskPercent}%</span>
                  <span style={{ color: '#7a9aaa', fontSize: 12 }}>{data.disk.usedMb} / {data.disk.totalMb} Mo</span>
                </div>
                <ProgressBar percent={diskPercent} color="#7a52e0" />
                <div style={{ color: '#7a9aaa', fontSize: 11, marginTop: 2 }}>{data.disk.availMb} Mo {t('health.free')}</div>
              </Card>
            )}

            {/* Services */}
            {data.services && (
              <Card title={t('health.services')}>
                {Object.entries(data.services).map(([name, status]) => (
                  <ServiceBadge key={name} name={name} status={status} />
                ))}
              </Card>
            )}

            {/* Températures + ventilateurs */}
            {hasHwmon && (
              <Card title={t('health.temperature')} style={{ gridColumn: 'span 2' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
                  {temps.map((s, i) => (
                    <div key={i}>
                      <div style={{ color: '#7a9aaa', fontSize: 10, marginBottom: 2 }}>{s.adapter} · {s.label}</div>
                      <div style={{
                        fontSize: 20, fontWeight: 700,
                        color: s.crit && s.celsius > s.crit * 0.9 ? '#e05252' : s.celsius > 70 ? '#e0a052' : '#52e07a',
                      }}>
                        {s.celsius.toFixed(1)}°C
                      </div>
                      {s.crit && <div style={{ color: '#445566', fontSize: 10 }}>crit {s.crit}°C</div>}
                    </div>
                  ))}
                  {fans.map((s, i) => (
                    <div key={`fan${i}`}>
                      <div style={{ color: '#7a9aaa', fontSize: 10, marginBottom: 2 }}>{s.adapter} · {s.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: s.rpm === 0 ? '#e05252' : '#99aabb' }}>
                        {s.rpm} RPM
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

          </div>

          {/* Table processus */}
          {data.processes?.length > 0 && (
            <Card title={t('health.processes')}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: '#7a9aaa', borderBottom: '1px solid #2a3a4a' }}>
                    {['PID', 'USER', '%CPU', '%MEM', t('health.command')].map((h, i) => (
                      <th key={i} style={{ textAlign: i > 1 && i < 4 ? 'right' : 'left', padding: '4px 10px', fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.processes.map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #151f2a', color: '#ccd8e0' }}>
                      <td style={{ padding: '5px 10px', color: '#7a9aaa' }}>{p.pid}</td>
                      <td style={{ padding: '5px 10px' }}>{p.user}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', color: p.cpu > 5 ? '#e0a052' : '#ccd8e0' }}>{p.cpu.toFixed(1)}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right' }}>{p.mem.toFixed(1)}</td>
                      <td style={{ padding: '5px 10px', color: '#99aabb', maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.command}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}

      <style>{`@keyframes hpulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  )
}
