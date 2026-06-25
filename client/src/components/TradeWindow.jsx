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
  player_sell:     'Revente',
}

export default function TradeWindow({ campaignId, socket, onClose, isGm = true, myCharId = null, characters = [], initialContext = null }) {
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

  // ── Vue GM — Reventes ─────────────────────────────────────────────────────

  const [sellRequests, setSellRequests] = useState([])
  const [sellPrices,   setSellPrices]   = useState({})
  const [sellsLoading, setSellsLoading] = useState(false)
  const [counterMode,  setCounterMode]  = useState({}) // { [offerId]: bool }

  const loadSellRequests = useCallback(async () => {
    setSellsLoading(true)
    try {
      const res = await api.get(`/campaigns/${campaignId}/merchants/sell-offers`)
      setSellRequests(res.data)
    } catch (err) {
      console.error('[TradeWindow] sell-offers load:', err.message)
    } finally {
      setSellsLoading(false)
    }
  }, [campaignId])

  useEffect(() => {
    if (isGm && tab === 'reventes') loadSellRequests()
  }, [isGm, tab, loadSellRequests])

  // ── Vue Joueur — état ─────────────────────────────────────────────────────

  const [playerTab,       setPlayerTab]       = useState('catalogue')

  const [selMerchantId,   setSelMerchantId]   = useState(null)
  const [catalog,         setCatalog]         = useState([])
  const [catLoading,      setCatLoading]      = useState(false)
  const [selFamily,       setSelFamily]       = useState(null)
  const [selItem,         setSelItem]         = useState(null)
  const [cart,            setCart]            = useState([])
  const [checkoutMsg,     setCheckoutMsg]     = useState(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  // ── Vue Joueur — Vente PJ→GM ──────────────────────────────────────────────

  const [sellItems,        setSellItems]        = useState([])
  const [sellSolsProposed, setSellSolsProposed] = useState(0)
  // null | 'pending' | { accepted, sols? } | { counterOffer: true, counterSols }
  const [sellStatus,       setSellStatus]       = useState(null)
  const [sellOfferId,      setSellOfferId]      = useState(null)
  const [sellExpiresAt,    setSellExpiresAt]    = useState(null)
  const [sellTimeLeft,     setSellTimeLeft]     = useState(null)

  // ── Vue Joueur — Échange PJ↔PJ (state/callbacks conservés pour RadialMenu futur) ──

  const [exTargetId,    setExTargetId]    = useState(null)
  const [myInventory,   setMyInventory]   = useState([])
  const [invLoading,    setInvLoading]    = useState(false)
  const [offerItems,    setOfferItems]    = useState([])
  const [offerSols,     setOfferSols]     = useState(0)
  const [outboundOffer, setOutboundOffer] = useState(null)
  const [incomingOffer, setIncomingOffer] = useState(null)
  const [exStatusMsg,   setExStatusMsg]   = useState(null)
  const [timeLeft,      setTimeLeft]      = useState(null)

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

  const addToCart = (item, qty = 1) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id)
      if (existing) return prev.map(c => c.item.id === item.id ? { ...c, qty: c.qty + qty } : c)
      return [...prev, { item, qty }]
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
      const msg = err.response?.data?.error?.message || err.message
      const text = msg === 'INSUFFICIENT_FUNDS'  ? t('trade.window.cart_insufficient')
                 : msg === 'MERCHANT_CLOSED'      ? t('trade.window.cart_merchant_closed')
                 : msg
      setCheckoutMsg({ ok: false, text })
    } finally {
      setCheckoutLoading(false)
    }
  }

  // ── Échange — callbacks (gardés pour RadialMenu futur) ────────────────────

  const loadInventory = useCallback(async () => {
    if (!myCharId) return
    setInvLoading(true)
    try {
      const res = await api.get(`/char-sheet/${myCharId}/inventory`)
      setMyInventory(res.data.items ?? [])
    } catch (err) { console.error('[TradeWindow] inventory load:', err.message) }
    finally { setInvLoading(false) }
  }, [myCharId])

  useEffect(() => {
    if ((playerTab === 'exchange' || playerTab === 'sell') && myInventory.length === 0 && !invLoading) loadInventory()
  }, [playerTab, myInventory.length, invLoading, loadInventory])

  // Timer sell expiry
  useEffect(() => {
    if (!sellExpiresAt) { setSellTimeLeft(null); return }
    const calc = () => Math.max(0, Math.round((new Date(sellExpiresAt) - Date.now()) / 1000))
    setSellTimeLeft(calc())
    const iv = setInterval(() => {
      const secs = calc()
      setSellTimeLeft(secs)
      if (secs === 0) {
        setSellStatus({ accepted: false, expired: true })
        setSellOfferId(null)
        clearInterval(iv)
      }
    }, 1000)
    return () => clearInterval(iv)
  }, [sellExpiresAt])

  // Timer échange outbound/incoming
  useEffect(() => {
    const expiry = incomingOffer?.expiresAt ?? outboundOffer?.expiresAt
    if (!expiry) { setTimeLeft(null); return }
    const calc = () => Math.max(0, Math.round((new Date(expiry) - Date.now()) / 1000))
    setTimeLeft(calc())
    const iv = setInterval(() => { const secs = calc(); setTimeLeft(secs); if (secs === 0) clearInterval(iv) }, 1000)
    return () => clearInterval(iv)
  }, [incomingOffer?.expiresAt, outboundOffer?.expiresAt])

  // WS listeners échange
  useEffect(() => {
    if (!socket) return
    const onReceived  = (data) => { setIncomingOffer(data); setPlayerTab('exchange'); setExStatusMsg(null) }
    const onAccepted  = () => {
      setOutboundOffer(null); setIncomingOffer(null)
      setExStatusMsg({ ok: true, text: t('trade.window.ex_accepted') })
      setOfferItems([]); setOfferSols(0)
      loadInventory()
    }
    const onDeclined  = () => { setOutboundOffer(null); setExStatusMsg({ ok: false, text: t('trade.window.ex_declined') }) }
    const onCancelled = () => { setIncomingOffer(null); setExStatusMsg({ ok: false, text: t('trade.window.ex_cancelled') }) }
    const onError     = ({ code }) => setExStatusMsg({ ok: false, text: code })
    socket.on(WS.TRADE_OFFER_RECEIVED,  onReceived)
    socket.on(WS.TRADE_OFFER_ACCEPTED,  onAccepted)
    socket.on(WS.TRADE_OFFER_DECLINED,  onDeclined)
    socket.on(WS.TRADE_OFFER_CANCELLED, onCancelled)
    socket.on(WS.TRADE_ERROR,           onError)
    return () => {
      socket.off(WS.TRADE_OFFER_RECEIVED,  onReceived)
      socket.off(WS.TRADE_OFFER_ACCEPTED,  onAccepted)
      socket.off(WS.TRADE_OFFER_DECLINED,  onDeclined)
      socket.off(WS.TRADE_OFFER_CANCELLED, onCancelled)
      socket.off(WS.TRADE_ERROR,           onError)
    }
  }, [socket, t, loadInventory])

  // WS listeners revente PJ (TRADE_SELL_REQUEST est dans useEntitySocket)
  useEffect(() => {
    if (!socket) return
    const onSellResult = ({ accepted, sols }) => {
      setSellStatus(accepted ? { accepted: true, sols } : { accepted: false })
      setSellOfferId(null)
      setSellExpiresAt(null)
      if (accepted) { setSellItems([]); setSellSolsProposed(0); loadInventory() }
    }
    const onCounterReceived = ({ offerId, counterSols }) => {
      setSellOfferId(offerId)
      setSellStatus({ counterOffer: true, counterSols })
      setPlayerTab('sell')
    }
    // WS revente GM — demande arrivée en temps réel (si TradeWindow est déjà ouvert)
    const onSellRequest = (data) => setSellRequests(prev => {
      if (prev.some(r => r.offerId === data.offerId)) return prev
      return [...prev, data]
    })
    socket.on(WS.TRADE_SELL_RESULT,           onSellResult)
    socket.on(WS.TRADE_SELL_COUNTER_RECEIVED, onCounterReceived)
    socket.on(WS.TRADE_SELL_REQUEST,          onSellRequest)
    return () => {
      socket.off(WS.TRADE_SELL_RESULT,           onSellResult)
      socket.off(WS.TRADE_SELL_COUNTER_RECEIVED, onCounterReceived)
      socket.off(WS.TRADE_SELL_REQUEST,          onSellRequest)
    }
  }, [socket, loadInventory])

  // Restauration depuis DB au montage — si PJ a une offre PENDING ou COUNTER_OFFERED
  useEffect(() => {
    if (!myCharId || isGm) return
    api.get(`/campaigns/${campaignId}/merchants/my-sell-offer?charId=${myCharId}`)
      .then(res => {
        const offer = res.data
        if (!offer) return
        if (offer.status === 'PENDING') {
          setSellOfferId(offer.offerId)
          setSellExpiresAt(offer.expiresAt)
          setSellItems(offer.items)
          setSellSolsProposed(offer.solsProposed)
          if (offer.merchantId) setSelMerchantId(offer.merchantId)
          setSellStatus('pending')
          setPlayerTab('sell')
        } else if (offer.status === 'COUNTER_OFFERED') {
          setSellOfferId(offer.offerId)
          setSellItems(offer.items)
          setSellExpiresAt(offer.expiresAt)
          setSellStatus({ counterOffer: true, counterSols: offer.counterSols })
          setPlayerTab('sell')
        }
      })
      .catch(() => {})
  }, [campaignId, myCharId, isGm])

  // initialContext — pré-remplissage (RadialMenu ou notification chat)
  useEffect(() => {
    if (!initialContext) return
    if (initialContext.mode === 'exchange') {
      setPlayerTab('exchange')
      if (initialContext.toCharId) setExTargetId(initialContext.toCharId)
    }
    if (initialContext.mode === 'reventes') {
      setTab('reventes')
    }
  }, [initialContext])

  const toggleOfferItem = (item) => {
    const name = item.custom_name || item.ref_name || '?'
    setOfferItems(prev => {
      const ex = prev.find(o => o.invId === item.id)
      if (ex) return prev.filter(o => o.invId !== item.id)
      return [...prev, { invId: item.id, equipId: item.equipment_id, name, qty: 1 }]
    })
  }

  const handleProposeOffer = useCallback(() => {
    if (!socket || !myCharId || !exTargetId || (offerItems.length === 0 && offerSols === 0)) return
    const toChar = characters.find(c => c.id === exTargetId)
    socket.emit(WS.TRADE_TRANSFER_OFFER, {
      fromCharId: myCharId,
      toCharId:   exTargetId,
      items:      offerItems.map(o => ({ char_inventory_id: o.invId, equipment_id: o.equipId, name: o.name, qty: o.qty })),
      solsOffer:  offerSols,
    }, (ack) => {
      if (ack?.ok) {
        setOutboundOffer({ offerId: ack.offerId, toCharName: toChar?.name ?? '?', expiresAt: ack.expiresAt })
        setExStatusMsg(null)
      } else {
        setExStatusMsg({ ok: false, text: t('trade.window.ex_send_error') })
      }
    })
  }, [socket, myCharId, exTargetId, offerItems, offerSols, characters, t])

  const handleCancelOffer = useCallback(() => {
    if (!socket || !outboundOffer || !myCharId) return
    socket.emit(WS.TRADE_TRANSFER_CANCELLED, { offerId: outboundOffer.offerId, fromCharId: myCharId })
    setOutboundOffer(null)
    setExStatusMsg({ ok: false, text: t('trade.window.ex_cancelled') })
  }, [socket, myCharId, outboundOffer, t])

  const handleAcceptOffer = useCallback(() => {
    if (!socket || !incomingOffer || !myCharId || timeLeft === 0) return
    socket.emit(WS.TRADE_TRANSFER_ACCEPTED, { offerId: incomingOffer.offerId, acceptingCharId: myCharId })
  }, [socket, myCharId, incomingOffer, timeLeft])

  const handleDeclineOffer = useCallback(() => {
    if (!socket || !incomingOffer) return
    socket.emit(WS.TRADE_TRANSFER_DECLINED, { offerId: incomingOffer.offerId })
    setIncomingOffer(null)
  }, [socket, incomingOffer])

  // ── Callbacks revente PJ→GM ───────────────────────────────────────────────

  const toggleSellItem = (item) => {
    const name = item.custom_name || item.ref_name || '?'
    setSellItems(prev => {
      const ex = prev.find(o => o.char_inventory_id === item.id)
      if (ex) return prev.filter(o => o.char_inventory_id !== item.id)
      const catEntry = catalog.find(c => c.id === item.equipment_id)
      return [...prev, {
        char_inventory_id: item.id,
        name,
        qty: 1,
        ref_price:     item.ref_price ?? null,
        catalog_price: catEntry?.catalog_price ?? null,
      }]
    })
  }

  const handleProposeSell = useCallback(() => {
    if (!socket || !myCharId || !selMerchantId || sellItems.length === 0) return
    socket.emit(WS.TRADE_SELL_PROPOSED, {
      fromCharId:   myCharId,
      merchantId:   selMerchantId,
      items:        sellItems,
      solsProposed: sellSolsProposed,
    }, (ack) => {
      if (ack?.ok) {
        setSellOfferId(ack.offerId)
        setSellExpiresAt(ack.expiresAt)
        setSellStatus('pending')
      } else {
        setSellStatus({ accepted: false, error: ack?.code })
      }
    })
  }, [socket, myCharId, selMerchantId, sellItems, sellSolsProposed])

  const handleAcceptCounter = useCallback(() => {
    if (!socket || !myCharId || !sellOfferId) return
    socket.emit(WS.TRADE_SELL_COUNTER_ACCEPTED, { fromCharId: myCharId, offerId: sellOfferId })
  }, [socket, myCharId, sellOfferId])

  const handleDeclineCounter = useCallback(() => {
    if (!socket || !myCharId || !sellOfferId) return
    socket.emit(WS.TRADE_SELL_COUNTER_DECLINED, { fromCharId: myCharId, offerId: sellOfferId })
    setSellStatus({ accepted: false })
    setSellOfferId(null)
    setSellExpiresAt(null)
  }, [socket, myCharId, sellOfferId])

  // ── Callbacks revente GM ──────────────────────────────────────────────────

  const handleAcceptSell = useCallback((offerId) => {
    if (!socket) return
    const req = sellRequests.find(r => r.offerId === offerId)
    const solsFinal = sellPrices[offerId] ?? req?.solsProposed ?? 0
    socket.emit(WS.TRADE_SELL_ACCEPTED, { offerId, solsFinal })
    setSellRequests(prev => prev.filter(r => r.offerId !== offerId))
    setSellPrices(p => { const n = { ...p }; delete n[offerId]; return n })
  }, [socket, sellPrices, sellRequests])

  const handleDeclineSell = useCallback((offerId) => {
    if (!socket) return
    socket.emit(WS.TRADE_SELL_DECLINED, { offerId })
    setSellRequests(prev => prev.filter(r => r.offerId !== offerId))
  }, [socket])

  const handleSendCounter = useCallback((offerId) => {
    if (!socket) return
    const counterSols = sellPrices[offerId] ?? 0
    socket.emit(WS.TRADE_SELL_COUNTER, { offerId, counterSols }, (ack) => {
      if (ack?.ok) {
        setSellRequests(prev => prev.filter(r => r.offerId !== offerId))
        setCounterMode(m => { const n = { ...m }; delete n[offerId]; return n })
        setSellPrices(p => { const n = { ...p }; delete n[offerId]; return n })
      }
    })
  }, [socket, sellPrices])

  // ── Valeurs calculées ─────────────────────────────────────────────────────

  const families      = [...new Set(catalog.map(i => i.family))].filter(Boolean).sort()
  const filteredItems = selFamily ? catalog.filter(i => i.family === selFamily) : catalog
  const cartTotal     = cart.reduce((sum, c) => sum + c.item.catalog_price * c.qty, 0)
  const sellBadge     = sellRequests.length

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
          {/* TABS GM */}
          <div style={S.tabs}>
            <button
              className={tab === 'marchands' ? 'btn btn-gold' : 'btn btn-ghost'}
              style={S.tabBtn}
              onClick={() => setTab('marchands')}
            >{t('trade.window.tab_merchants')}</button>
            <button
              className={tab === 'journal' ? 'btn btn-gold' : 'btn btn-ghost'}
              style={S.tabBtn}
              onClick={() => setTab('journal')}
            >{t('trade.window.tab_journal')}</button>
            <button
              className={tab === 'reventes' ? 'btn btn-gold' : 'btn btn-ghost'}
              style={{ ...S.tabBtn, position: 'relative' }}
              onClick={() => setTab('reventes')}
            >
              {t('trade.window.tab_sells')}
              {sellBadge > 0 && <span style={S.sellBadge}>{sellBadge}</span>}
            </button>
          </div>

          {/* ── TAB MARCHANDS ─────────────────────────────────────────── */}
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
                      onClick={() => patchDraft(merchant.id, { status: draft.status === 'OPEN' ? 'CLOSED' : 'OPEN' })}
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

          {/* ── TAB JOURNAL ───────────────────────────────────────────── */}
          {tab === 'journal' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div style={S.filters}>
                {[null, 'merchant_buy', 'player_transfer', 'gm_grant', 'player_sell'].map(f => (
                  <button
                    key={f ?? 'all'}
                    className={logFilter === f ? 'btn btn-gold' : 'btn btn-ghost'}
                    style={S.filterBtn}
                    onClick={() => { setLogFilter(f); setLogPage(1) }}
                  >
                    {f === null              ? t('trade.window.filter_all')      :
                     f === 'merchant_buy'    ? t('trade.window.filter_buy')      :
                     f === 'player_transfer' ? t('trade.window.filter_transfer') :
                     f === 'player_sell'     ? t('trade.window.filter_sell')     :
                                              t('trade.window.filter_grant')}
                  </button>
                ))}
              </div>
              <div style={S.logList}>
                {logLoading && <p style={S.empty}>{t('common.loading')}</p>}
                {!logLoading && logRows.length === 0 && <p style={S.empty}>{t('trade.window.log_empty')}</p>}
                {logRows.map(entry => (
                  <div key={entry.id} style={S.logEntry}>
                    <span style={S.logType}>{LOG_TYPE_LABEL[entry.type] ?? entry.type}</span>
                    <span style={S.logDate}>
                      {new Date(entry.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {entry.sols_delta !== 0 && (
                      <span style={{ ...S.logSols, color: entry.sols_delta > 0 ? '#3aaa6a' : '#c86030' }}>
                        {entry.sols_delta > 0 ? `+${entry.sols_delta}` : entry.sols_delta} S
                      </span>
                    )}
                    {Array.isArray(entry.items_json) && entry.items_json.length > 0 && (
                      <span style={S.logItems}>{entry.items_json.length} objet{entry.items_json.length > 1 ? 's' : ''}</span>
                    )}
                  </div>
                ))}
              </div>
              {logTotal > PAGE_SIZE && (
                <div style={S.pagination}>
                  <button className="btn btn-ghost" style={S.pageBtn} disabled={logPage <= 1} onClick={() => setLogPage(p => p - 1)}>←</button>
                  <span style={S.pageInfo}>{logPage} / {totalPages}</span>
                  <button className="btn btn-ghost" style={S.pageBtn} disabled={logPage >= totalPages} onClick={() => setLogPage(p => p + 1)}>→</button>
                </div>
              )}
            </div>
          )}

          {/* ── TAB REVENTES (fenêtre récap) ─────────────────────────── */}
          {tab === 'reventes' && (
            <div style={S.body}>
              {sellsLoading && <p style={S.empty}>{t('common.loading')}</p>}
              {!sellsLoading && sellRequests.length === 0 && <p style={S.empty}>{t('trade.window.sells_empty')}</p>}
              {sellRequests.map(req => (
                <div key={req.offerId} style={S.sellRow}>

                  {/* En-tête : vendeur + marchand + timer */}
                  <div style={S.sellHeader}>
                    <div>
                      <span style={S.sellFromName}>{req.fromCharName}</span>
                      {req.merchantName && (
                        <span style={{ fontSize: '11px', color: '#888', marginLeft: '6px' }}>
                          → {req.merchantName}
                        </span>
                      )}
                    </div>
                    <span style={S.exTimer}>
                      {Math.max(0, Math.round((new Date(req.expiresAt) - Date.now()) / 1000))}s
                    </span>
                  </div>

                  {/* Statut si COUNTER_OFFERED */}
                  {req.status === 'COUNTER_OFFERED' && (
                    <p style={{ fontSize: '11px', color: '#c8a84b', margin: '2px 0 4px' }}>
                      Contre-offre envoyée : {req.counterSols} S — en attente PJ
                    </p>
                  )}

                  {/* Items avec prix ref + boutique */}
                  {Array.isArray(req.items) && req.items.map((it, i) => (
                    <div key={i} style={{ ...S.exOfferRow, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{it.name} ×{it.qty}</span>
                      <span style={{ fontSize: '11px', color: '#888' }}>
                        {it.ref_price != null && `réf: ${it.ref_price} S`}
                        {it.catalog_price != null && ` · boutique: ${it.catalog_price} S`}
                      </span>
                    </div>
                  ))}

                  {/* Prix demandé */}
                  <div style={{ ...S.modRow, marginTop: '6px' }}>
                    <span style={S.modLabel}>{t('trade.window.sells_proposed')} :</span>
                    <span style={{ fontSize: '13px', color: '#c8a84b', fontWeight: 600, marginLeft: '4px' }}>
                      {req.solsProposed} S
                    </span>
                  </div>

                  {/* Boutons Accepter / Contre-offre / Refuser */}
                  {req.status !== 'COUNTER_OFFERED' && (
                    <div style={{ marginTop: '8px' }}>
                      {!counterMode[req.offerId] ? (
                        <div style={S.exBtnRow}>
                          <button
                            className="btn btn-gold"
                            style={{ fontSize: '12px', padding: '4px 10px' }}
                            onClick={() => handleAcceptSell(req.offerId)}
                          >
                            {t('trade.window.sells_accept')}
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ fontSize: '12px', padding: '4px 10px' }}
                            onClick={() => setCounterMode(m => ({ ...m, [req.offerId]: true }))}
                          >
                            {t('trade.window.sell_counter_btn')}
                          </button>
                          <button
                            className="btn btn-danger"
                            style={{ fontSize: '12px', padding: '4px 10px' }}
                            onClick={() => handleDeclineSell(req.offerId)}
                          >
                            {t('trade.window.sells_decline')}
                          </button>
                        </div>
                      ) : (
                        <div style={S.sellPriceRow}>
                          <input
                            type="number"
                            min="0"
                            style={{ ...S.modInput, width: '72px' }}
                            value={sellPrices[req.offerId] ?? req.solsProposed}
                            onChange={e => setSellPrices(p => ({
                              ...p,
                              [req.offerId]: Math.max(0, parseInt(e.target.value) || 0),
                            }))}
                          />
                          <span style={S.modUnit}>S</span>
                          <button
                            className="btn btn-gold"
                            style={{ fontSize: '12px', padding: '4px 10px' }}
                            onClick={() => handleSendCounter(req.offerId)}
                          >
                            {t('trade.window.sell_counter_send')}
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ fontSize: '12px', padding: '4px 8px' }}
                            onClick={() => setCounterMode(m => ({ ...m, [req.offerId]: false }))}
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── VUE JOUEUR ───────────────────────────────────────────────────── */}
      {!isGm && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

          <div style={S.tabs}>
            <button
              className={playerTab === 'catalogue' ? 'btn btn-gold' : 'btn btn-ghost'}
              style={S.tabBtn}
              onClick={() => setPlayerTab('catalogue')}
            >{t('trade.window.tab_catalogue')}</button>
            <button
              className={playerTab === 'exchange' ? 'btn btn-gold' : 'btn btn-ghost'}
              style={S.tabBtn}
              onClick={() => setPlayerTab('exchange')}
            >{t('trade.window.tab_exchange')}</button>
            <button
              className={playerTab === 'sell' ? 'btn btn-gold' : 'btn btn-ghost'}
              style={S.tabBtn}
              onClick={() => setPlayerTab('sell')}
            >{t('trade.window.tab_sell')}</button>
          </div>

          {/* ── CATALOGUE ─────────────────────────────────────────────────── */}
          {playerTab === 'catalogue' && <>

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
              {merchants.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          {catalog.length > 0 && (
            <div style={S.filters}>
              <button className={selFamily === null ? 'btn btn-gold' : 'btn btn-ghost'} style={S.filterBtn} onClick={() => { setSelFamily(null); setSelItem(null) }}>
                {t('trade.window.filter_all')}
              </button>
              {families.map(fam => (
                <button key={fam} className={selFamily === fam ? 'btn btn-gold' : 'btn btn-ghost'} style={S.filterBtn} onClick={() => { setSelFamily(fam); setSelItem(null) }}>
                  {fam}
                </button>
              ))}
            </div>
          )}

          <div style={S.catalogList}>
            {!selMerchantId && <p style={S.empty}>{t('trade.window.no_merchant')}</p>}
            {selMerchantId && catLoading && <p style={S.empty}>{t('trade.window.catalog_loading')}</p>}
            {selMerchantId && !catLoading && filteredItems.length === 0 && <p style={S.empty}>{t('trade.window.catalog_empty')}</p>}
            {filteredItems.map(item => {
              const cartEntry  = cart.find(c => c.item.id === item.id)
              const isSelected = selItem?.id === item.id
              return (
                <div key={item.id} style={{ ...S.catalogItem, background: isSelected ? '#1a1a2e' : 'transparent' }}>
                  <div style={S.catalogItemHeader} onClick={() => setSelItem(isSelected ? null : item)}>
                    <span style={S.catalogItemName}>{item.name}</span>
                    <span style={S.catalogItemPrice}>{item.catalog_price} S</span>
                    <button className="btn btn-ghost" style={S.cartAddBtn} onClick={e => { e.stopPropagation(); addToCart(item) }}>+</button>
                    {item.family === 'Munitions' && (
                      <button className="btn btn-ghost" style={{ ...S.cartAddBtn, fontSize: '11px' }} onClick={e => { e.stopPropagation(); addToCart(item, 10) }}>+10</button>
                    )}
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

          </>}{/* fin catalogue */}

          {/* ── VENTE PJ→GM ─────────────────────────────────────────────── */}
          {playerTab === 'sell' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

              {/* Cas A — Contre-offre du GM reçue */}
              {sellStatus?.counterOffer && (
                <div style={S.exPanel}>
                  <p style={{ ...S.exFromName, color: '#c8a84b' }}>
                    {t('trade.window.sell_counter_received', { sols: sellStatus.counterSols })}
                  </p>
                  <p style={S.exTimer}>
                    {sellTimeLeft !== null && sellTimeLeft > 0 ? `${sellTimeLeft}s` : t('trade.window.ex_expired')}
                  </p>
                  <div style={S.exOfferList}>
                    {sellItems.map((it, i) => (
                      <div key={i} style={S.exOfferRow}>
                        {it.name} ×{it.qty}
                        {it.catalog_price != null && (
                          <span style={{ color: '#666', marginLeft: '8px', fontSize: '11px' }}>
                            boutique: {it.catalog_price} S
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={S.exBtnRow}>
                    <button
                      className="btn btn-gold"
                      disabled={sellTimeLeft === 0}
                      onClick={handleAcceptCounter}
                    >{t('trade.window.sell_counter_accept')}</button>
                    <button
                      className="btn btn-danger"
                      onClick={handleDeclineCounter}
                    >{t('trade.window.sell_counter_decline')}</button>
                  </div>
                </div>
              )}

              {/* Cas B — Résultat final de la vente */}
              {sellStatus && sellStatus !== 'pending' && !sellStatus?.counterOffer && (
                <div style={S.exPanel}>
                  {sellStatus.accepted ? (
                    <p style={{ ...S.exFromName, color: '#3aaa6a' }}>
                      {t('trade.window.sell_accepted', { sols: sellStatus.sols })}
                    </p>
                  ) : (
                    <p style={{ ...S.exFromName, color: '#c86030' }}>
                      {sellStatus.expired ? t('trade.window.sell_expired') : t('trade.window.sell_declined')}
                    </p>
                  )}
                  <button
                    className="btn btn-ghost"
                    style={{ alignSelf: 'flex-start', marginTop: '4px' }}
                    onClick={() => { setSellStatus(null); setSellItems([]); setSellSolsProposed(0) }}
                  >
                    {t('trade.window.sell_new')}
                  </button>
                </div>
              )}

              {/* Cas C — En attente de réponse GM */}
              {sellStatus === 'pending' && (
                <div style={S.exPanel}>
                  <p style={S.exFromName}>{t('trade.window.sell_pending')}</p>
                  <p style={S.exTimer}>
                    {sellTimeLeft !== null && sellTimeLeft > 0 ? `${sellTimeLeft}s` : t('trade.window.ex_expired')}
                  </p>
                  <div style={S.exOfferList}>
                    {sellItems.map((it, i) => (
                      <div key={i} style={S.exOfferRow}>
                        {it.name} ×{it.qty}
                        {it.catalog_price != null && (
                          <span style={{ color: '#666', marginLeft: '8px', fontSize: '11px' }}>
                            boutique: {it.catalog_price} S
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {sellSolsProposed > 0 && <div style={S.exSolsReceived}>{sellSolsProposed} S</div>}
                </div>
              )}

              {/* Cas D — Composer une proposition de vente */}
              {!sellStatus && (
                <>
                  {/* Sélecteur marchand */}
                  <div style={S.playerSection}>
                    <div style={{ ...S.modRow, marginBottom: '4px' }}>
                      <span style={S.modLabel}>{t('trade.window.sell_merchant_label')} :</span>
                    </div>
                    <select
                      style={S.merchantSelect}
                      value={selMerchantId ?? ''}
                      onChange={e => {
                        const id = e.target.value || null
                        setSelMerchantId(id)
                        if (id) loadCatalog(id)
                      }}
                    >
                      <option value="">{t('trade.window.no_merchant')}</option>
                      {merchants.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>

                  {/* Inventaire */}
                  <div style={S.catalogList}>
                    {invLoading && <p style={S.empty}>{t('trade.window.ex_loading_inv')}</p>}
                    {!invLoading && myInventory.length === 0 && <p style={S.empty}>{t('trade.window.sell_no_items')}</p>}
                    {myInventory.map(item => {
                      const name       = item.custom_name || item.ref_name || '?'
                      const isSelected = sellItems.some(o => o.char_inventory_id === item.id)
                      const catEntry   = catalog.find(c => c.id === item.equipment_id)
                      return (
                        <div
                          key={item.id}
                          style={{ ...S.catalogItem, background: isSelected ? '#1a1a2e' : 'transparent', cursor: 'pointer' }}
                          onClick={() => toggleSellItem(item)}
                        >
                          <div style={S.catalogItemHeader}>
                            <span style={S.catalogItemName}>{name}</span>
                            <span style={{ fontSize: '11px', color: '#666', flexShrink: 0 }}>
                              {item.ref_price != null && `réf: ${item.ref_price} S`}
                              {catEntry?.catalog_price != null && ` · boutique: ${catEntry.catalog_price} S`}
                            </span>
                            {item.quantity > 1 && <span style={{ fontSize: '12px', color: '#888' }}>×{item.quantity}</span>}
                            {isSelected && <span style={{ color: '#3aaa6a', fontSize: '13px', flexShrink: 0 }}>✓</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Prix + bouton */}
                  <div style={S.cartSection}>
                    <div style={S.modRow}>
                      <span style={S.modLabel}>{t('trade.window.sell_price_label')}</span>
                      <input
                        type="number"
                        min="0"
                        style={{ ...S.modInput, width: '80px' }}
                        value={sellSolsProposed}
                        onChange={e => setSellSolsProposed(Math.max(0, parseInt(e.target.value) || 0))}
                      />
                      <span style={S.modUnit}>S</span>
                    </div>
                    {sellItems.length > 0 && (
                      <div style={{ marginTop: '4px', marginBottom: '4px' }}>
                        {sellItems.map(o => (
                          <div key={o.char_inventory_id} style={S.cartRow}>
                            <span style={S.cartItemName}>{o.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      className="btn btn-gold"
                      style={{ ...S.checkoutBtn, marginTop: '6px', width: '100%' }}
                      disabled={!selMerchantId || sellItems.length === 0}
                      onClick={handleProposeSell}
                    >
                      {t('trade.window.sell_propose')}
                    </button>
                  </div>
                </>
              )}

            </div>
          )}

          {/* ── ÉCHANGE PJ↔PJ ─────────────────────────────────────────── */}
          {playerTab === 'exchange' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

              {/* Cas A — Offre envoyée (outbound) */}
              {outboundOffer && !exStatusMsg && (
                <div style={S.exPanel}>
                  <p style={S.exFromName}>{t('trade.window.ex_offer_sent')} {outboundOffer.toCharName}</p>
                  <p style={S.exTimer}>
                    {timeLeft !== null && timeLeft > 0 ? `${timeLeft}s` : t('trade.window.ex_expired')}
                  </p>
                  {offerItems.length > 0 && (
                    <div style={S.exOfferList}>
                      {offerItems.map((o, i) => (
                        <div key={i} style={S.exOfferRow}>{o.name} ×{o.qty}</div>
                      ))}
                    </div>
                  )}
                  {offerSols > 0 && <div style={S.exSolsReceived}>{offerSols} S</div>}
                  <button
                    className="btn btn-danger"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={handleCancelOffer}
                  >{t('trade.window.ex_cancel')}</button>
                </div>
              )}

              {/* Cas B — Offre reçue (incoming) */}
              {incomingOffer && !exStatusMsg && (
                <div style={S.exPanel}>
                  <p style={S.exFromName}>{t('trade.window.ex_offer_from')} {incomingOffer.fromCharName}</p>
                  <p style={S.exTimer}>
                    {timeLeft !== null && timeLeft > 0 ? `${timeLeft}s` : t('trade.window.ex_expired')}
                  </p>
                  {Array.isArray(incomingOffer.items) && incomingOffer.items.length > 0 && (
                    <div style={S.exOfferList}>
                      {incomingOffer.items.map((o, i) => (
                        <div key={i} style={S.exOfferRow}>{o.name} ×{o.qty}</div>
                      ))}
                    </div>
                  )}
                  {incomingOffer.solsOffer > 0 && <div style={S.exSolsReceived}>{incomingOffer.solsOffer} S</div>}
                  <div style={S.exBtnRow}>
                    <button
                      className="btn btn-gold"
                      disabled={timeLeft === 0}
                      onClick={handleAcceptOffer}
                    >{t('trade.window.ex_accept')}</button>
                    <button
                      className="btn btn-danger"
                      onClick={handleDeclineOffer}
                    >{t('trade.window.ex_decline')}</button>
                  </div>
                </div>
              )}

              {/* Cas C — Résultat final */}
              {exStatusMsg && !outboundOffer && !incomingOffer && (
                <div style={S.exPanel}>
                  <p style={{ ...S.exFromName, color: exStatusMsg.ok ? '#3aaa6a' : '#c86030', margin: 0 }}>
                    {exStatusMsg.text}
                  </p>
                  <button
                    className="btn btn-ghost"
                    style={{ alignSelf: 'flex-start', marginTop: '4px' }}
                    onClick={() => { setExStatusMsg(null); setOfferItems([]); setOfferSols(0); setExTargetId(null) }}
                  >{t('trade.window.sell_new')}</button>
                </div>
              )}

              {/* Cas D — Formulaire composition */}
              {!outboundOffer && !incomingOffer && !exStatusMsg && (
                <>
                  <div style={S.playerSection}>
                    <select
                      style={S.merchantSelect}
                      value={exTargetId ?? ''}
                      onChange={e => setExTargetId(e.target.value || null)}
                    >
                      <option value="">{t('trade.window.ex_no_target')}</option>
                      {characters.filter(c => c.id !== myCharId).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={S.catalogList}>
                    {invLoading && <p style={S.empty}>{t('trade.window.ex_loading_inv')}</p>}
                    {!invLoading && myInventory.length === 0 && <p style={S.empty}>{t('trade.window.ex_no_items')}</p>}
                    {myInventory.map(item => {
                      const name = item.custom_name || item.ref_name || '?'
                      const isSelected = offerItems.some(o => o.invId === item.id)
                      return (
                        <div
                          key={item.id}
                          style={{ ...S.catalogItem, background: isSelected ? '#1a1a2e' : 'transparent', cursor: 'pointer' }}
                          onClick={() => toggleOfferItem(item)}
                        >
                          <div style={S.catalogItemHeader}>
                            <span style={S.catalogItemName}>{name}</span>
                            {item.quantity > 1 && <span style={{ fontSize: '12px', color: '#888' }}>×{item.quantity}</span>}
                            {isSelected && <span style={{ color: '#3aaa6a', fontSize: '13px', flexShrink: 0 }}>✓</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div style={S.cartSection}>
                    <div style={S.modRow}>
                      <span style={S.modLabel}>{t('trade.window.ex_sols_label')}</span>
                      <input
                        type="number"
                        min="0"
                        style={{ ...S.modInput, width: '80px' }}
                        value={offerSols}
                        onChange={e => setOfferSols(Math.max(0, parseInt(e.target.value) || 0))}
                      />
                      <span style={S.modUnit}>S</span>
                    </div>
                    <button
                      className="btn btn-gold"
                      style={{ ...S.checkoutBtn, marginTop: '6px', width: '100%' }}
                      disabled={!exTargetId || (offerItems.length === 0 && offerSols === 0)}
                      onClick={handleProposeOffer}
                    >{t('trade.window.ex_propose')}</button>
                  </div>
                </>
              )}

            </div>
          )}

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

  merchantRow: { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 2px', borderBottom: '1px solid #1e1e2e', flexWrap: 'wrap' },
  merchantName:{ flex: '1 1 110px', fontSize: '13px', color: '#ddd', fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  statusBtn:   { flexShrink: 0, fontSize: '11px', padding: '3px 8px' },
  modRow:      { display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 },
  modLabel:    { fontSize: '11px', color: '#777', whiteSpace: 'nowrap' },
  modInput:    { width: '52px', textAlign: 'center', fontSize: '12px', padding: '3px 4px' },
  modUnit:     { fontSize: '11px', color: '#777' },
  saveBtn:     { flexShrink: 0, fontSize: '11px', padding: '3px 8px' },

  filters:     { display: 'flex', gap: '4px', padding: '6px 8px', borderBottom: '1px solid #2a2a3a', flexShrink: 0, flexWrap: 'wrap' },
  filterBtn:   { fontSize: '11px', padding: '2px 8px' },
  logList:     { flex: 1, overflowY: 'auto', padding: '4px 8px' },
  logEntry:    { display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid #1e1e2e', fontSize: '12px' },
  logType:     { flex: '0 0 64px', color: '#aaa', fontWeight: 500 },
  logDate:     { flex: '0 0 96px', color: '#666', fontSize: '11px' },
  logSols:     { flex: '0 0 56px', fontWeight: 600 },
  logItems:    { flex: 1, color: '#888', fontSize: '11px' },

  pagination:  { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '6px', borderTop: '1px solid #2a2a3a', flexShrink: 0 },
  pageBtn:     { padding: '2px 10px' },
  pageInfo:    { fontSize: '12px', color: '#aaa' },

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

  // Reventes GM
  sellRow:       { padding: '10px 8px', borderBottom: '1px solid #1e1e2e' },
  sellHeader:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' },
  sellFromName:  { fontSize: '13px', color: '#ddd', fontWeight: 600 },
  sellPriceRow:  { display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', flexWrap: 'wrap' },
  sellBadge:     { position: 'absolute', top: '4px', right: '4px', background: '#c86030', color: '#fff', borderRadius: '50%', fontSize: '10px', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 },

  // Échange / Vente (panneaux état)
  exPanel:        { padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '10px' },
  exFromName:     { fontSize: '13px', color: '#ddd', fontWeight: 600, margin: 0 },
  exOfferList:    { display: 'flex', flexDirection: 'column', gap: '2px' },
  exOfferRow:     { fontSize: '12px', color: '#bbb', padding: '2px 0' },
  exSolsReceived: { fontSize: '14px', color: '#c8a84b', fontWeight: 600 },
  exTimer:        { fontSize: '12px', color: '#888', margin: 0 },
  exBtnRow:       { display: 'flex', gap: '8px' },
}
