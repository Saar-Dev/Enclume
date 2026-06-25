import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { WS } from '../../../shared/events.js'
import api from '../lib/api'
import { useDraggable } from '../lib/useDraggable.js'

const PANEL_W   = 480
const PAGE_SIZE = 50

const LOG_TYPE_LABEL = {
  merchant_buy:    'Achat',
  player_transfer: 'Échange',
  gm_grant:        'Don GM',
}

export default function TradeWindow({ campaignId, socket, onClose, isGm = true, myCharId = null }) {
  const { t } = useTranslation()
  const { pos, onHeaderMouseDown } = useDraggable(
    'trade-window-pos',
    { top: 80, left: window.innerWidth - PANEL_W - 30 },
    PANEL_W,
  )

  const [tab, setTab] = useState('marchands')

  // ── Tab Marchands ──────────────────────────────────────────────────────────

  const [merchants, setMerchants] = useState([])
  const [drafts,    setDrafts]    = useState({})
  const [saving,    setSaving]    = useState({})

  useEffect(() => {
    api.get(`/campaigns/${campaignId}/merchants`)
      .then(res => setMerchants(res.data))
      .catch(err => console.error('[TradeWindow] merchants load:', err.message))
  }, [campaignId])

  const getDraft = useCallback((merchant) => ({
    status:     drafts[merchant.id]?.status     ?? merchant.status,
    mod_global: drafts[merchant.id]?.mod_global ?? merchant.mod_global,
  }), [drafts])

  const patchDraft = (merchantId, patch) => {
    setDrafts(d => {
      const base = merchants.find(m => m.id === merchantId) ?? {}
      const current = d[merchantId] ?? { status: base.status, mod_global: base.mod_global }
      return { ...d, [merchantId]: { ...current, ...patch } }
    })
  }

  const saveMerchant = async (merchant) => {
    const draft = getDraft(merchant)
    setSaving(s => ({ ...s, [merchant.id]: true }))
    try {
      await api.put(`/campaigns/${campaignId}/merchants/${merchant.id}`, {
        ...merchant,
        status:     draft.status,
        mod_global: draft.mod_global,
      })
      setMerchants(prev => prev.map(m => m.id === merchant.id ? { ...m, ...draft } : m))
      setDrafts(d => { const n = { ...d }; delete n[merchant.id]; return n })
    } catch (err) {
      console.error('[TradeWindow] save:', err.message)
    } finally {
      setSaving(s => ({ ...s, [merchant.id]: false }))
    }
  }

  // ── Tab Journal ────────────────────────────────────────────────────────────

  const [logRows,    setLogRows]    = useState([])
  const [logFilter,  setLogFilter]  = useState(null)
  const [logPage,    setLogPage]    = useState(1)
  const [logTotal,   setLogTotal]   = useState(0)
  const [logLoading, setLogLoading] = useState(false)

  const loadLog = useCallback(async (page, filter) => {
    setLogLoading(true)
    try {
      const params = new URLSearchParams({ page })
      if (filter) params.set('type', filter)
      const res = await api.get(`/campaigns/${campaignId}/trade-log?${params}`)
      setLogRows(res.data.rows)
      setLogTotal(res.data.total)
    } catch (err) {
      console.error('[TradeWindow] log load:', err.message)
    } finally {
      setLogLoading(false)
    }
  }, [campaignId])

  useEffect(() => {
    if (tab === 'journal') loadLog(logPage, logFilter)
  }, [tab, logPage, logFilter, loadLog])

  useEffect(() => {
    if (!socket) return
    const handler = ({ entry }) => setLogRows(prev => [entry, ...prev])
    socket.on(WS.TRADE_LOG_UPDATED, handler)
    return () => socket.off(WS.TRADE_LOG_UPDATED, handler)
  }, [socket])

  const totalPages = Math.max(1, Math.ceil(logTotal / PAGE_SIZE))

  // ── Vue Joueur — état ─────────────────────────────────────────────────────

  const [selMerchantId,   setSelMerchantId]   = useState(null)
  const [catalog,         setCatalog]         = useState([])
  const [catLoading,      setCatLoading]      = useState(false)
  const [selFamily,       setSelFamily]       = useState(null)
  const [selItem,         setSelItem]         = useState(null)
  const [cart,            setCart]            = useState([])
  const [checkoutMsg,     setCheckoutMsg]     = useState(null)  // { ok: bool, text: string } | null
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const loadCatalog = useCallback(async (merchantId) => {
    if (!merchantId) { setCatalog([]); return }
    setCatLoading(true)
    try {
      const params = new URLSearchParams()
      if (myCharId) params.set('charId', myCharId)
      const res = await api.get(`/campaigns/${campaignId}/merchants/${merchantId}/catalog?${params}`)
      setCatalog(res.data)
      setSelFamily(null)
      setSelItem(null)
      setCart([])
      setCheckoutMsg(null)
    } catch (err) {
      console.error('[TradeWindow] catalog load:', err.message)
    } finally {
      setCatLoading(false)
    }
  }, [campaignId, myCharId])

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id)
      if (existing) return prev.map(c => c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { item, qty: 1 }]
    })
  }

  const removeFromCart = (itemId) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === itemId)
      if (!existing) return prev
      if (existing.qty <= 1) return prev.filter(c => c.item.id !== itemId)
      return prev.map(c => c.item.id === itemId ? { ...c, qty: c.qty - 1 } : c)
    })
  }

  const handleCheckout = async () => {
    if (!selMerchantId || cart.length === 0 || checkoutLoading || !myCharId) return
    setCheckoutLoading(true)
    setCheckoutMsg(null)
    try {
      await api.post(`/campaigns/${campaignId}/merchants/${selMerchantId}/buy`, {
        charId: myCharId,
        items:  cart.map(c => ({ equipmentId: c.item.id, qty: c.qty })),
      })
      setCheckoutMsg({ ok: true, text: t('trade.window.cart_success') })
      setCart([])
    } catch (err) {
      const msg = err.response?.data?.error || err.message
      const text = msg === 'INSUFFICIENT_FUNDS'  ? t('trade.window.cart_insufficient')
                 : msg === 'MERCHANT_CLOSED'      ? t('trade.window.cart_merchant_closed')
                 : msg
      setCheckoutMsg({ ok: false, text })
    } finally {
      setCheckoutLoading(false)
    }
  }

  // Vue joueur — valeurs calculées
  const families      = [...new Set(catalog.map(i => i.family))].filter(Boolean).sort()
  const filteredItems = selFamily ? catalog.filter(i => i.family === selFamily) : catalog
  const cartTotal     = cart.reduce((sum, c) => sum + c.item.catalog_price * c.qty, 0)

  // ── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <div className="combat-win" style={{ width: PANEL_W, left: pos.left, top: pos.top }}>

      {/* HEADER */}
      <div className="combat-win-header" onMouseDown={onHeaderMouseDown}>
        <span className="combat-win-title">{t('trade.window.title')}</span>
        <button className="btn btn-icon" onClick={onClose} title={t('common.close')}>✕</button>
      </div>

      {/* ── VUE GM ────────────────────────────────────────────────────────── */}
      {isGm && (
        <>
          {/* TABS */}
          <div style={S.tabs}>
            <button
              className={tab === 'marchands' ? 'btn btn-gold' : 'btn btn-ghost'}
              style={S.tabBtn}
              onClick={() => setTab('marchands')}
            >
              {t('trade.window.tab_merchants')}
            </button>
            <button
              className={tab === 'journal' ? 'btn btn-gold' : 'btn btn-ghost'}
              style={S.tabBtn}
              onClick={() => setTab('journal')}
            >
              {t('trade.window.tab_journal')}
            </button>
          </div>

          {/* ── TAB MARCHANDS ───────────────────────────────────────────── */}
          {tab === 'marchands' && (
            <div style={S.body}>
              {merchants.length === 0 && (
                <p style={S.empty}>{t('trade.merchants.noMerchants')}</p>
              )}
              {merchants.map(merchant => {
                const draft   = getDraft(merchant)
                const isDirty = draft.status !== merchant.status || draft.mod_global !== merchant.mod_global
                return (
                  <div key={merchant.id} style={S.merchantRow}>

                    <span style={S.merchantName} title={merchant.name}>{merchant.name}</span>

                    <button
                      className={draft.status === 'OPEN' ? 'btn btn-gold' : 'btn btn-ghost'}
                      style={S.statusBtn}
                      onClick={() => patchDraft(merchant.id, {
                        status: draft.status === 'OPEN' ? 'CLOSED' : 'OPEN',
                      })}
                    >
                      {draft.status === 'OPEN' ? t('trade.window.status_open') : t('trade.window.status_closed')}
                    </button>

                    <div style={S.modRow}>
                      <span style={S.modLabel}>{t('trade.window.mod_label')}</span>
                      <input
                        type="number"
                        style={S.modInput}
                        value={draft.mod_global}
                        onChange={e => patchDraft(merchant.id, { mod_global: parseInt(e.target.value) || 0 })}
                      />
                      <span style={S.modUnit}>%</span>
                    </div>

                    <button
                      className="btn btn-ghost"
                      style={{ ...S.saveBtn, opacity: isDirty ? 1 : 0.35 }}
                      disabled={!isDirty || saving[merchant.id]}
                      onClick={() => saveMerchant(merchant)}
                    >
                      {saving[merchant.id] ? '...' : t('trade.window.btn_save')}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── TAB JOURNAL ─────────────────────────────────────────────── */}
          {tab === 'journal' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

              {/* Filtres */}
              <div style={S.filters}>
                {[null, 'merchant_buy', 'player_transfer', 'gm_grant'].map(f => (
                  <button
                    key={f ?? 'all'}
                    className={logFilter === f ? 'btn btn-gold' : 'btn btn-ghost'}
                    style={S.filterBtn}
                    onClick={() => { setLogFilter(f); setLogPage(1) }}
                  >
                    {f === null              ? t('trade.window.filter_all')      :
                     f === 'merchant_buy'    ? t('trade.window.filter_buy')      :
                     f === 'player_transfer' ? t('trade.window.filter_transfer') :
                                              t('trade.window.filter_grant')}
                  </button>
                ))}
              </div>

              {/* Liste */}
              <div style={S.logList}>
                {logLoading && <p style={S.empty}>{t('common.loading')}</p>}
                {!logLoading && logRows.length === 0 && (
                  <p style={S.empty}>{t('trade.window.log_empty')}</p>
                )}
                {logRows.map(entry => (
                  <div key={entry.id} style={S.logEntry}>
                    <span style={S.logType}>{LOG_TYPE_LABEL[entry.type] ?? entry.type}</span>
                    <span style={S.logDate}>
                      {new Date(entry.created_at).toLocaleString('fr-FR', {
                        day: '2-digit', month: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                    {entry.sols_delta !== 0 && (
                      <span style={{ ...S.logSols, color: entry.sols_delta > 0 ? '#3aaa6a' : '#c86030' }}>
                        {entry.sols_delta > 0 ? `+${entry.sols_delta}` : entry.sols_delta} S
                      </span>
                    )}
                    {Array.isArray(entry.items_json) && entry.items_json.length > 0 && (
                      <span style={S.logItems}>
                        {entry.items_json.length} objet{entry.items_json.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {logTotal > PAGE_SIZE && (
                <div style={S.pagination}>
                  <button
                    className="btn btn-ghost"
                    style={S.pageBtn}
                    disabled={logPage <= 1}
                    onClick={() => setLogPage(p => p - 1)}
                  >
                    ←
                  </button>
                  <span style={S.pageInfo}>{logPage} / {totalPages}</span>
                  <button
                    className="btn btn-ghost"
                    style={S.pageBtn}
                    disabled={logPage >= totalPages}
                    onClick={() => setLogPage(p => p + 1)}
                  >
                    →
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── VUE JOUEUR ───────────────────────────────────────────────────── */}
      {!isGm && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

          {/* Sélecteur marchand */}
          <div style={S.playerSection}>
            <select
              style={S.merchantSelect}
              value={selMerchantId ?? ''}
              onChange={e => {
                const id = e.target.value || null
                setSelMerchantId(id)
                loadCatalog(id)
              }}
            >
              <option value="">{t('trade.window.no_merchant')}</option>
              {merchants.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Filtres famille */}
          {catalog.length > 0 && (
            <div style={S.filters}>
              <button
                className={selFamily === null ? 'btn btn-gold' : 'btn btn-ghost'}
                style={S.filterBtn}
                onClick={() => { setSelFamily(null); setSelItem(null) }}
              >
                {t('trade.window.filter_all')}
              </button>
              {families.map(fam => (
                <button
                  key={fam}
                  className={selFamily === fam ? 'btn btn-gold' : 'btn btn-ghost'}
                  style={S.filterBtn}
                  onClick={() => { setSelFamily(fam); setSelItem(null) }}
                >
                  {fam}
                </button>
              ))}
            </div>
          )}

          {/* Liste items */}
          <div style={S.catalogList}>
            {!selMerchantId && <p style={S.empty}>{t('trade.window.no_merchant')}</p>}
            {selMerchantId && catLoading && <p style={S.empty}>{t('trade.window.catalog_loading')}</p>}
            {selMerchantId && !catLoading && filteredItems.length === 0 && (
              <p style={S.empty}>{t('trade.window.catalog_empty')}</p>
            )}
            {filteredItems.map(item => {
              const cartEntry  = cart.find(c => c.item.id === item.id)
              const isSelected = selItem?.id === item.id
              return (
                <div
                  key={item.id}
                  style={{ ...S.catalogItem, background: isSelected ? '#1a1a2e' : 'transparent' }}
                >
                  <div style={S.catalogItemHeader} onClick={() => setSelItem(isSelected ? null : item)}>
                    <span style={S.catalogItemName}>{item.name}</span>
                    <span style={S.catalogItemPrice}>{item.catalog_price} S</span>
                    <button
                      className="btn btn-ghost"
                      style={S.cartAddBtn}
                      onClick={e => { e.stopPropagation(); addToCart(item) }}
                    >+</button>
                  </div>
                  {isSelected && (
                    <div style={S.itemDetail}>
                      {item.weight     != null && <span>{t('trade.window.detail_weight')}: {item.weight} kg</span>}
                      {item.tech_level != null && <span>{t('trade.window.detail_nt')}: {item.tech_level}</span>}
                      {item.generation != null && <span>{t('trade.window.detail_gen')}: {item.generation}</span>}
                      {item.rarity               && <span>{t('trade.window.detail_rarity')}: {item.rarity}</span>}
                      {cartEntry && (
                        <div style={S.qtyRow}>
                          <button className="btn btn-ghost" style={S.qtyBtn} onClick={() => removeFromCart(item.id)}>−</button>
                          <span style={S.qtyVal}>{cartEntry.qty}</span>
                          <button className="btn btn-ghost" style={S.qtyBtn} onClick={() => addToCart(item)}>+</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Panier */}
          <div style={S.cartSection}>
            {cart.length === 0 ? (
              <p style={{ ...S.empty, padding: '8px 0' }}>{t('trade.window.cart_empty')}</p>
            ) : (
              <>
                {cart.map(c => (
                  <div key={c.item.id} style={S.cartRow}>
                    <span style={S.cartItemName}>{c.item.name} ×{c.qty}</span>
                    <span style={S.cartItemPrice}>{c.item.catalog_price * c.qty} S</span>
                  </div>
                ))}
                <div style={S.cartTotalRow}>
                  <span style={S.cartTotalLabel}>{t('trade.window.cart_total')}</span>
                  <span style={S.cartTotalVal}>{cartTotal} S</span>
                  <button
                    className="btn btn-gold"
                    style={S.checkoutBtn}
                    disabled={checkoutLoading || !myCharId}
                    onClick={handleCheckout}
                  >
                    {checkoutLoading ? '...' : t('trade.window.cart_checkout')}
                  </button>
                </div>
              </>
            )}
            {checkoutMsg && (
              <p style={{ ...S.empty, padding: '4px 0', color: checkoutMsg.ok ? '#3aaa6a' : '#c86030' }}>
                {checkoutMsg.text}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const S = {
  tabs:        { display: 'flex', borderBottom: '1px solid #2a2a3a', flexShrink: 0 },
  tabBtn:      { flex: 1, borderRadius: 0, fontSize: '12px' },
  body:        { flex: 1, overflowY: 'auto', padding: '6px 8px' },
  empty:       { color: '#888', textAlign: 'center', padding: '20px 0', fontSize: '13px', margin: 0 },

  merchantRow: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '6px 2px', borderBottom: '1px solid #1e1e2e', flexWrap: 'wrap',
  },
  merchantName: {
    flex: '1 1 110px', fontSize: '13px', color: '#ddd', fontWeight: 500,
    minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  statusBtn:  { flexShrink: 0, fontSize: '11px', padding: '3px 8px' },
  modRow:     { display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 },
  modLabel:   { fontSize: '11px', color: '#777', whiteSpace: 'nowrap' },
  modInput:   { width: '52px', textAlign: 'center', fontSize: '12px', padding: '3px 4px' },
  modUnit:    { fontSize: '11px', color: '#777' },
  saveBtn:    { flexShrink: 0, fontSize: '11px', padding: '3px 8px' },

  filters:    { display: 'flex', gap: '4px', padding: '6px 8px', borderBottom: '1px solid #2a2a3a', flexShrink: 0, flexWrap: 'wrap' },
  filterBtn:  { fontSize: '11px', padding: '2px 8px' },
  logList:    { flex: 1, overflowY: 'auto', padding: '4px 8px' },
  logEntry:   { display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid #1e1e2e', fontSize: '12px' },
  logType:    { flex: '0 0 64px', color: '#aaa', fontWeight: 500 },
  logDate:    { flex: '0 0 96px', color: '#666', fontSize: '11px' },
  logSols:    { flex: '0 0 56px', fontWeight: 600 },
  logItems:   { flex: 1, color: '#888', fontSize: '11px' },

  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '6px', borderTop: '1px solid #2a2a3a', flexShrink: 0 },
  pageBtn:    { padding: '2px 10px' },
  pageInfo:   { fontSize: '12px', color: '#aaa' },

  // Vue Joueur
  playerSection:     { padding: '8px 8px 4px', flexShrink: 0 },
  merchantSelect:    { width: '100%', fontSize: '13px', padding: '5px 8px', background: '#12121c', color: '#ddd', border: '1px solid #2a2a3a', borderRadius: '4px' },
  catalogList:       { overflowY: 'auto', maxHeight: '260px', padding: '4px 8px' },
  catalogItem:       { borderBottom: '1px solid #1e1e2e', borderRadius: '3px' },
  catalogItemHeader: { display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 4px', cursor: 'pointer' },
  catalogItemName:   { flex: 1, fontSize: '13px', color: '#ddd' },
  catalogItemPrice:  { flex: '0 0 56px', fontSize: '12px', color: '#c8a84b', textAlign: 'right' },
  cartAddBtn:        { flexShrink: 0, fontSize: '14px', padding: '1px 8px' },
  itemDetail:        { padding: '4px 8px 8px', display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '11px', color: '#999' },
  qtyRow:            { display: 'flex', alignItems: 'center', gap: '6px', width: '100%', marginTop: '2px' },
  qtyBtn:            { padding: '1px 8px', fontSize: '14px' },
  qtyVal:            { fontSize: '13px', color: '#ddd', minWidth: '20px', textAlign: 'center' },
  cartSection:       { borderTop: '1px solid #2a2a3a', padding: '6px 8px', flexShrink: 0 },
  cartRow:           { display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '2px 0', color: '#bbb' },
  cartItemName:      { flex: 1 },
  cartItemPrice:     { color: '#c8a84b', fontWeight: 500 },
  cartTotalRow:      { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', paddingTop: '4px', borderTop: '1px solid #1e1e2e' },
  cartTotalLabel:    { fontSize: '12px', color: '#aaa' },
  cartTotalVal:      { flex: 1, fontSize: '13px', color: '#c8a84b', fontWeight: 600 },
  checkoutBtn:       { flexShrink: 0, fontSize: '12px', padding: '4px 12px' },
}
