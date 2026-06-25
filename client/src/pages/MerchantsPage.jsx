import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'

// ─── MerchantsPage ────────────────────────────────────────────────────────────
// Dashboard GM — gestion des marchands d'une campagne.
// Route : /campaigns/:campaignId/merchants
export default function MerchantsPage() {
  const { campaignId } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [merchants, setMerchants]             = useState([])
  const [loading, setLoading]                 = useState(true)
  const [error, setError]                     = useState(null)
  const [selected, setSelected]               = useState(null)
  const [form, setForm]                       = useState(null)
  const [activeTab, setActiveTab]             = useState('params')
  const [saving, setSaving]                   = useState(false)
  const [savedMsg, setSavedMsg]               = useState(false)

  const [showCreate, setShowCreate]           = useState(false)
  const [createName, setCreateName]           = useState('')
  const [creating, setCreating]               = useState(false)

  const [deleteConfirm, setDeleteConfirm]     = useState(null)
  const [deleting, setDeleting]               = useState(false)

  const [equipment, setEquipment]             = useState([])
  const [catalogLoading, setCatalogLoading]   = useState(false)

  const [characters, setCharacters]           = useState([])

  // ─── Chargement ─────────────────────────────────────────────────────────────
  const loadMerchants = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get(`/campaigns/${campaignId}/merchants`)
      setMerchants(res.data)
    } catch { setError(t('trade.merchants.errorLoad')) }
    finally { setLoading(false) }
  }, [campaignId, t])

  useEffect(() => { document.title = 'Enclume — Marchands' }, [])
  useEffect(() => { loadMerchants() }, [loadMerchants])

  const loadEquipment = useCallback(async () => {
    if (equipment.length > 0) return
    setCatalogLoading(true)
    try {
      const res = await api.get('/equipment')
      setEquipment(res.data.items ?? res.data)
    } catch { setError(t('trade.merchants.errorLoad')) }
    finally { setCatalogLoading(false) }
  }, [equipment, t])

  const loadCharacters = useCallback(async () => {
    if (characters.length > 0) return
    try {
      const res = await api.get(`/campaigns/${campaignId}/characters`)
      setCharacters(res.data.characters ?? [])
    } catch { /* non bloquant */ }
  }, [campaignId, characters])

  useEffect(() => {
    if (activeTab === 'catalog') loadEquipment()
    if (activeTab === 'players') loadCharacters()
  }, [activeTab, loadEquipment, loadCharacters])

  // ─── Sélection marchand ──────────────────────────────────────────────────────
  const handleSelect = useCallback((m) => {
    setSelected(m)
    setForm({
      ...m,
      rules: Array.isArray(m.rules) ? [...m.rules] : [],
      allowed_char_ids: Array.isArray(m.allowed_char_ids) ? [...m.allowed_char_ids] : [],
    })
    setActiveTab('params')
    setSavedMsg(false)
  }, [])

  // ─── CRUD marchands ──────────────────────────────────────────────────────────
  const handleCreate = useCallback(async () => {
    if (!createName.trim()) return
    setCreating(true)
    try {
      const res = await api.post(`/campaigns/${campaignId}/merchants`, { name: createName.trim() })
      setMerchants(prev => [...prev, res.data])
      setShowCreate(false)
      setCreateName('')
      handleSelect(res.data)
    } catch (err) { setError(err.response?.data?.error || err.message) }
    finally { setCreating(false) }
  }, [campaignId, createName, handleSelect])

  const handleSave = useCallback(async () => {
    if (!form) return
    setSaving(true)
    try {
      const res = await api.put(`/campaigns/${campaignId}/merchants/${form.id}`, form)
      setMerchants(prev => prev.map(m => m.id === res.data.id ? res.data : m))
      setSelected(res.data)
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 2000)
    } catch (err) { setError(err.response?.data?.error || t('trade.merchants.errorSave')) }
    finally { setSaving(false) }
  }, [campaignId, form, t])

  const handleDelete = useCallback(async (merchantId) => {
    setDeleting(true)
    try {
      await api.delete(`/campaigns/${campaignId}/merchants/${merchantId}`)
      setMerchants(prev => prev.filter(m => m.id !== merchantId))
      if (selected?.id === merchantId) { setSelected(null); setForm(null) }
      setDeleteConfirm(null)
    } catch (err) { setError(err.response?.data?.error || t('trade.merchants.errorDelete')) }
    finally { setDeleting(false) }
  }, [campaignId, selected, t])

  // ─── Règles catalogue ────────────────────────────────────────────────────────
  const getRuleFor = useCallback((level, fam, cat, name) => {
    if (!form) return null
    if (level === 'FAM')  return form.rules.find(r => r.level === 'FAM' && r.fam === fam) ?? null
    if (level === 'CAT')  return form.rules.find(r => r.level === 'CAT' && r.fam === fam && r.cat === cat) ?? null
    if (level === 'ITEM') return form.rules.find(r => r.level === 'ITEM' && r.name === name) ?? null
    return null
  }, [form])

  const toggleRule = useCallback((level, fam, cat, name) => {
    if (!form) return
    const existing = getRuleFor(level, fam, cat, name)
    const withoutThis = form.rules.filter(r => {
      if (level === 'FAM')  return !(r.level === 'FAM' && r.fam === fam)
      if (level === 'CAT')  return !(r.level === 'CAT' && r.fam === fam && r.cat === cat)
      if (level === 'ITEM') return !(r.level === 'ITEM' && r.name === name)
      return true
    })
    if (!existing) {
      setForm(f => ({ ...f, rules: [...withoutThis, { mode: 'INCLUDE', level, fam, cat: cat ?? null, name: name ?? null }] }))
    } else if (existing.mode === 'INCLUDE') {
      setForm(f => ({ ...f, rules: [...withoutThis, { ...existing, mode: 'EXCLUDE' }] }))
    } else {
      setForm(f => ({ ...f, rules: withoutThis }))
    }
  }, [form, getRuleFor])

  const getEffectiveInherited = useCallback((level, fam, cat) => {
    if (level === 'CAT') {
      return getRuleFor('FAM', fam)?.mode ?? null
    }
    if (level === 'ITEM') {
      const catRule = getRuleFor('CAT', fam, cat)
      if (catRule) return catRule.mode
      return getRuleFor('FAM', fam)?.mode ?? null
    }
    return null
  }, [getRuleFor])

  // ─── Arbre catalogue ─────────────────────────────────────────────────────────
  const catalogTree = (() => {
    const tree = {}
    for (const item of equipment) {
      if (!tree[item.family]) tree[item.family] = {}
      if (!tree[item.family][item.category]) tree[item.family][item.category] = []
      tree[item.family][item.category].push(item)
    }
    return tree
  })()

  // ─── Badge tri-state ─────────────────────────────────────────────────────────
  function RuleBadge({ mode, inherited }) {
    if (!mode) {
      if (inherited === 'INCLUDE') return <span style={S.badgeInheritedIncl}>INCL↑</span>
      if (inherited === 'EXCLUDE') return <span style={S.badgeInheritedExcl}>EXCL↑</span>
      return <span style={S.badgeHerited}>{t('trade.merchants.ruleHerited')}</span>
    }
    if (mode === 'INCLUDE') return <span style={S.badgeInclude}>{t('trade.merchants.ruleInclude')}</span>
    return <span style={S.badgeExclude}>{t('trade.merchants.ruleExclude')}</span>
  }

  // ─── Rendu ───────────────────────────────────────────────────────────────────
  if (loading) return <div style={S.loadingScreen}><p style={S.muted}>{t('common.loading')}</p></div>

  return (
    <div style={S.container}>

      {/* Header */}
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate('/dashboard')}>{t('trade.merchants.back')}</button>
        <h1 style={S.pageTitle}>{t('trade.merchants.pageTitle')}</h1>
        <div />
      </div>

      {error && <div style={S.errorBanner} onClick={() => setError(null)}>{error} ✕</div>}

      <div style={S.body}>

        {/* Colonne marchands */}
        <div style={S.leftCol}>
          <div style={S.colHeader}>
            <button style={S.btnPrimary} onClick={() => setShowCreate(true)}>
              {t('trade.merchants.newMerchant')}
            </button>
          </div>
          {merchants.length === 0 && <p style={S.muted}>{t('trade.merchants.noMerchants')}</p>}
          {merchants.map(m => (
            <div key={m.id}
              style={{ ...S.merchantItem, ...(selected?.id === m.id ? S.merchantItemActive : {}) }}
              onClick={() => handleSelect(m)}
            >
              <div style={S.merchantRow}>
                <span style={S.merchantName}>{m.name}</span>
                <span style={{ ...S.statusDot, backgroundColor: m.status === 'OPEN' ? '#4caf77' : '#888' }} />
              </div>
              <span style={S.merchantMeta}>{m.status === 'OPEN' ? t('trade.merchants.statusOpen') : t('trade.merchants.statusClosed')}</span>
            </div>
          ))}
        </div>

        {/* Zone détail */}
        <div style={S.detail}>
          {!selected && (
            <div style={S.emptyDetail}><p style={S.muted}>{t('trade.merchants.noSelection')}</p></div>
          )}

          {selected && form && (
            <>
              <div style={S.detailHeader}>
                <h2 style={S.detailTitle}>{selected.name}</h2>
                <button style={S.btnDanger} onClick={() => setDeleteConfirm(selected.id)}>
                  {t('trade.merchants.delete')}
                </button>
              </div>

              {/* Onglets */}
              <div style={S.tabs}>
                {['params', 'catalog', 'players'].map(tab => (
                  <button key={tab}
                    style={{ ...S.tab, ...(activeTab === tab ? S.tabActive : {}) }}
                    onClick={() => setActiveTab(tab)}
                  >
                    {t(`trade.merchants.tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`)}
                  </button>
                ))}
              </div>

              {/* ─── Paramètres ─────────────────────────────────────────────── */}
              {activeTab === 'params' && (
                <div style={S.tabContent}>
                  <div style={S.fieldRow}>
                    <label style={S.fieldLabel}>Statut</label>
                    <button
                      style={{ ...S.toggleBtn, ...(form.status === 'OPEN' ? S.toggleOpen : S.toggleClosed) }}
                      onClick={() => setForm(f => ({ ...f, status: f.status === 'OPEN' ? 'CLOSED' : 'OPEN' }))}
                    >
                      {form.status === 'OPEN' ? t('trade.merchants.statusOpen') : t('trade.merchants.statusClosed')}
                    </button>
                  </div>
                  {[
                    { key: 'mod_global', label: t('trade.merchants.modGlobal') },
                    { key: 'nt_max',     label: t('trade.merchants.ntMax') },
                    { key: 'niv_max',    label: t('trade.merchants.nivMax') },
                    { key: 'gen_max',    label: t('trade.merchants.genMax') },
                    { key: 'dispo_min',  label: t('trade.merchants.dispoMin') },
                  ].map(({ key, label }) => (
                    <div key={key} style={S.fieldRow}>
                      <label style={S.fieldLabel}>{label}</label>
                      <input
                        type="number"
                        style={S.input}
                        value={form[key] ?? ''}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value === '' ? null : Number(e.target.value) }))}
                      />
                    </div>
                  ))}
                  <div style={S.saveRow}>
                    <button style={S.btnPrimary} onClick={handleSave} disabled={saving}>
                      {saving ? t('trade.merchants.saving') : savedMsg ? t('trade.merchants.savedOk') : t('trade.merchants.save')}
                    </button>
                  </div>
                </div>
              )}

              {/* ─── Catalogue ──────────────────────────────────────────────── */}
              {activeTab === 'catalog' && (
                <div style={S.tabContent}>
                  <div style={S.saveRow}>
                    <button style={S.btnPrimary} onClick={handleSave} disabled={saving}>
                      {saving ? t('trade.merchants.saving') : savedMsg ? t('trade.merchants.savedOk') : t('trade.merchants.save')}
                    </button>
                  </div>
                  {catalogLoading && <p style={S.muted}>{t('trade.merchants.catalogLoading')}</p>}
                  {!catalogLoading && Object.entries(catalogTree).sort(([a], [b]) => a.localeCompare(b)).map(([fam, cats]) => {
                    const famRule = getRuleFor('FAM', fam)
                    return (
                      <div key={fam} style={S.famBlock}>
                        <div style={S.famHeader}>
                          <button style={S.ruleBtn} onClick={() => toggleRule('FAM', fam, null, null)}>
                            <RuleBadge mode={famRule?.mode} />
                          </button>
                          <span style={S.famName}>{fam}</span>
                        </div>
                        {Object.entries(cats).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => {
                          const catRule = getRuleFor('CAT', fam, cat)
                          const catInherited = !catRule ? getEffectiveInherited('CAT', fam) : null
                          return (
                            <div key={cat} style={S.catBlock}>
                              <div style={S.catHeader}>
                                <button style={S.ruleBtn} onClick={() => toggleRule('CAT', fam, cat, null)}>
                                  <RuleBadge mode={catRule?.mode} inherited={catInherited} />
                                </button>
                                <span style={S.catName}>{cat}</span>
                                <span style={S.itemCount}>({items.length})</span>
                              </div>
                              {items.sort((a, b) => a.name.localeCompare(b.name)).map(item => {
                                const itemRule = getRuleFor('ITEM', fam, cat, item.name)
                                const itemInherited = !itemRule ? getEffectiveInherited('ITEM', fam, cat) : null
                                return (
                                  <div key={item.id} style={S.itemRow}>
                                    <button style={S.ruleBtn} onClick={() => toggleRule('ITEM', fam, cat, item.name)}>
                                      <RuleBadge mode={itemRule?.mode} inherited={itemInherited} />
                                    </button>
                                    <span style={S.itemName}>{item.name}</span>
                                    <span style={S.itemMeta}>NT{item.tech_level}</span>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                  {!catalogLoading && Object.keys(catalogTree).length > 0 && (
                    <div style={S.saveRow}>
                      <button style={S.btnPrimary} onClick={handleSave} disabled={saving}>
                        {saving ? t('trade.merchants.saving') : savedMsg ? t('trade.merchants.savedOk') : t('trade.merchants.save')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ─── Joueurs autorisés ───────────────────────────────────────── */}
              {activeTab === 'players' && (
                <div style={S.tabContent}>
                  <p style={S.muted}>{t('trade.merchants.playersAll')}</p>
                  {characters.length === 0 && <p style={S.muted}>{t('trade.merchants.playersNone')}</p>}
                  {characters.map(char => (
                    <label key={char.id} style={S.checkRow}>
                      <input
                        type="checkbox"
                        checked={(form.allowed_char_ids ?? []).includes(char.id)}
                        onChange={e => {
                          const ids = form.allowed_char_ids ?? []
                          setForm(f => ({
                            ...f,
                            allowed_char_ids: e.target.checked
                              ? [...ids, char.id]
                              : ids.filter(id => id !== char.id),
                          }))
                        }}
                      />
                      <span style={S.checkLabel}>{char.name}</span>
                    </label>
                  ))}
                  {characters.length > 0 && (
                    <div style={S.saveRow}>
                      <button style={S.btnPrimary} onClick={handleSave} disabled={saving}>
                        {saving ? t('trade.merchants.saving') : savedMsg ? t('trade.merchants.savedOk') : t('trade.merchants.save')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal création */}
      {showCreate && (
        <div style={S.overlay} onClick={() => setShowCreate(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <h2 style={S.modalTitle}>{t('trade.merchants.newMerchant')}</h2>
            <input
              style={S.input}
              autoFocus
              value={createName}
              onChange={e => setCreateName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder={t('trade.merchants.namePlaceholder')}
            />
            <div style={S.modalFooter}>
              <button style={S.btnGhost} onClick={() => setShowCreate(false)}>{t('common.cancel')}</button>
              <button style={S.btnPrimary} onClick={handleCreate} disabled={creating || !createName.trim()}>
                {creating ? t('common.loading') : t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal suppression */}
      {deleteConfirm && (
        <div style={S.overlay} onClick={() => setDeleteConfirm(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <h2 style={S.modalTitle}>{t('trade.merchants.delete')}</h2>
            <p style={S.modalText}>{t('trade.merchants.deleteConfirm', { name: selected?.name })}</p>
            <div style={S.modalFooter}>
              <button style={S.btnGhost} onClick={() => setDeleteConfirm(null)}>{t('common.cancel')}</button>
              <button style={S.btnDanger} onClick={() => handleDelete(deleteConfirm)} disabled={deleting}>
                {deleting ? t('common.loading') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  container:    { minHeight: '100vh', backgroundColor: 'var(--bg-app)', display: 'flex', flexDirection: 'column' },
  loadingScreen:{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-app)' },
  header:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: '52px', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 },
  backBtn:      { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' },
  pageTitle:    { fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)', margin: 0 },
  errorBanner:  { backgroundColor: 'rgba(224,92,92,0.12)', border: '1px solid var(--color-danger)', borderRadius: '6px', padding: '8px 16px', color: 'var(--color-danger)', fontSize: '13px', margin: '8px 24px 0', cursor: 'pointer' },
  body:         { display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 },

  leftCol:      { width: '220px', flexShrink: 0, borderRight: '1px solid var(--border-subtle)', padding: '12px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' },
  colHeader:    { marginBottom: '10px' },
  merchantItem: { padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', border: '1px solid transparent' },
  merchantItemActive: { backgroundColor: 'rgba(91,141,238,0.1)', border: '1px solid rgba(91,141,238,0.3)' },
  merchantRow:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  merchantName: { fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' },
  statusDot:    { width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0 },
  merchantMeta: { fontSize: '10px', color: 'var(--text-muted)' },

  detail:       { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 },
  emptyDetail:  { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 },
  detailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 },
  detailTitle:  { fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 },

  tabs:         { display: 'flex', padding: '0 20px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 },
  tab:          { background: 'none', border: 'none', borderBottomWidth: '2px', borderBottomStyle: 'solid', borderBottomColor: 'transparent', padding: '8px 14px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '-1px' },
  tabActive:    { color: '#5b8dee', borderBottomColor: '#5b8dee', fontWeight: '500' },
  tabContent:   { padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' },

  fieldRow:     { display: 'flex', alignItems: 'center', gap: '12px' },
  fieldLabel:   { fontSize: '12px', color: 'var(--text-secondary)', width: '200px', flexShrink: 0 },
  input:        { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '6px 10px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', width: '100px' },
  toggleBtn:    { padding: '5px 14px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: '600', cursor: 'pointer', letterSpacing: '0.04em' },
  toggleOpen:   { backgroundColor: 'rgba(76,175,119,0.15)', color: '#4caf77', border: '1px solid #4caf77' },
  toggleClosed: { backgroundColor: 'rgba(136,136,136,0.15)', color: '#888', border: '1px solid #555' },
  saveRow:      { display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' },

  famBlock:     { border: '1px solid var(--border-subtle)', borderRadius: '6px', overflow: 'hidden' },
  famHeader:    { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', backgroundColor: 'var(--bg-elevated)', cursor: 'default' },
  famName:      { fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' },
  catBlock:     { borderTop: '1px solid var(--border-subtle)' },
  catHeader:    { display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px 5px 20px', backgroundColor: 'var(--bg-surface)' },
  catName:      { fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' },
  itemCount:    { fontSize: '10px', color: 'var(--text-muted)' },
  itemRow:      { display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 10px 3px 36px', borderTop: '1px solid rgba(255,255,255,0.04)' },
  itemName:     { fontSize: '12px', color: 'var(--text-primary)', flex: 1 },
  itemMeta:     { fontSize: '10px', color: 'var(--text-muted)' },

  ruleBtn:      { background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 },
  badgeHerited:        { fontSize: '9px', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(136,136,136,0.2)', color: '#888', display: 'inline-block' },
  badgeInclude:        { fontSize: '9px', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(76,175,119,0.2)', color: '#4caf77', display: 'inline-block' },
  badgeExclude:        { fontSize: '9px', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(224,92,92,0.2)', color: 'var(--color-danger)', display: 'inline-block' },
  badgeInheritedIncl:  { fontSize: '9px', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(76,175,119,0.07)', color: 'rgba(76,175,119,0.5)', border: '1px dashed rgba(76,175,119,0.35)', display: 'inline-block' },
  badgeInheritedExcl:  { fontSize: '9px', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(224,92,92,0.07)', color: 'rgba(224,92,92,0.5)', border: '1px dashed rgba(224,92,92,0.35)', display: 'inline-block' },

  checkRow:     { display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0', cursor: 'pointer' },
  checkLabel:   { fontSize: '13px', color: 'var(--text-primary)' },

  overlay:      { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:        { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '24px', width: '360px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '14px' },
  modalTitle:   { fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 },
  modalText:    { fontSize: '13px', color: 'var(--text-secondary)', margin: 0 },
  modalFooter:  { display: 'flex', justifyContent: 'flex-end', gap: '8px' },

  btnPrimary:   { backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '6px', padding: '7px 14px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' },
  btnDanger:    { backgroundColor: 'rgba(224,92,92,0.15)', border: '1px solid var(--color-danger)', borderRadius: '6px', padding: '6px 12px', color: 'var(--color-danger)', fontSize: '13px', cursor: 'pointer' },
  btnGhost:     { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', padding: '7px', cursor: 'pointer' },
  muted:        { color: 'var(--text-muted)', fontSize: '12px', margin: 0 },
}
