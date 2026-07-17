import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { WS } from '../../../shared/events.js'
import api from '../lib/api'
import { useDraggable } from '../lib/useDraggable.js'

const PANEL_W = 400

export default function ExchangeWindow({ socket, onClose, isGm = false, myCharId = null, characters = [], initialContext = null }) {
  const { t } = useTranslation()
  const { pos, onHeaderMouseDown } = useDraggable(
    'exchange-window-pos',
    { top: 80, left: Math.max(8, window.innerWidth / 2 - PANEL_W / 2) },
    PANEL_W,
  )

  const [exTargetId,    setExTargetId]    = useState(null)
  const [gmActingAsId,  setGmActingAsId]  = useState(null)
  const [myInventory,   setMyInventory]   = useState([])
  const [invLoading,    setInvLoading]    = useState(false)
  const [offerItems,    setOfferItems]    = useState([])
  const [offerSols,     setOfferSols]     = useState(0)
  const [outboundOffer, setOutboundOffer] = useState(null)
  const [incomingOffer, setIncomingOffer] = useState(null)
  const [exStatusMsg,   setExStatusMsg]   = useState(null)
  const [timeLeft,      setTimeLeft]      = useState(null)
  const [searchText,      setSearchText]      = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const comboRef = useRef(null)

  // MJ : agit au nom d'un PJ choisi dans la fenêtre (gmActingAsId) — n'a pas de personnage propre.
  // Joueur : agit toujours en tant que lui-même (myCharId fixe). Seule autorité d'identité de la
  // fenêtre, substituée à myCharId partout où l'ancien code lisait l'acteur courant.
  const effectiveCharId = isGm ? gmActingAsId : myCharId

  const loadInventory = useCallback(async () => {
    if (!effectiveCharId) return
    setInvLoading(true)
    try {
      const res = await api.get(`/char-sheet/${effectiveCharId}/inventory`)
      setMyInventory(res.data.items ?? [])
    } catch (err) { console.error('[ExchangeWindow] inventory load:', err.message) }
    finally { setInvLoading(false) }
  }, [effectiveCharId])

  // Rechargement à chaque changement d'identité agissante (montage inclus) — pas seulement quand
  // l'inventaire est vide, sinon un changement de effectiveCharId après un 1er chargement (MJ change
  // de personnage) ne relancerait jamais loadInventory.
  useEffect(() => {
    setMyInventory([])
    if (effectiveCharId) loadInventory()
  }, [effectiveCharId, loadInventory])

  // Timer expiration
  useEffect(() => {
    const expiry = incomingOffer?.expiresAt ?? outboundOffer?.expiresAt
    if (!expiry) { setTimeLeft(null); return }
    const calc = () => Math.max(0, Math.round((new Date(expiry) - Date.now()) / 1000))
    setTimeLeft(calc())
    const iv = setInterval(() => { const secs = calc(); setTimeLeft(secs); if (secs === 0) clearInterval(iv) }, 1000)
    return () => clearInterval(iv)
  }, [incomingOffer?.expiresAt, outboundOffer?.expiresAt])

  // WS listeners
  useEffect(() => {
    if (!socket) return
    const onReceived  = (data) => { setIncomingOffer(data); setExStatusMsg(null) }
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

  // Fermer suggestions au clic extérieur
  useEffect(() => {
    const handler = (e) => { if (comboRef.current && !comboRef.current.contains(e.target)) setShowSuggestions(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Pré-remplissage depuis initialContext (RadialMenu ou notification chat)
  useEffect(() => {
    if (!initialContext) return
    if (initialContext.toCharId) {
      setExTargetId(initialContext.toCharId)
      const targetC = characters.find(c => c.id === initialContext.toCharId)
      if (targetC) setSearchText(targetC.name)
    }
    if (initialContext.incomingOffer) setIncomingOffer(initialContext.incomingOffer)
  }, [initialContext, characters])

  const toggleOfferItem = (item) => {
    const name = item.custom_name || item.ref_name || '?'
    setOfferItems(prev => {
      const ex = prev.find(o => o.invId === item.id)
      if (ex) return prev.filter(o => o.invId !== item.id)
      return [...prev, { invId: item.id, equipId: item.equipment_id, name, qty: 1 }]
    })
  }

  const handleProposeOffer = useCallback(() => {
    if (!socket || !effectiveCharId || !exTargetId || exTargetId === effectiveCharId) return
    const targetC = characters.find(c => c.id === exTargetId)
    if (targetC?.type === 'drone') {
      if (offerItems.length === 0) return
      socket.emit(WS.TRADE_DRONE_TRANSFER,
        { fromCharId: effectiveCharId, droneCharId: exTargetId, items: offerItems.map(o => o.invId) },
        (ack) => {
          if (ack?.ok) {
            setExStatusMsg({ ok: true, text: t('trade.window.drone_transferred') })
            setOfferItems([])
            loadInventory()
          } else {
            setExStatusMsg({ ok: false, text: t('trade.window.ex_send_error') })
          }
        })
      return
    }
    if (offerItems.length === 0 && offerSols === 0) return
    socket.emit(WS.TRADE_TRANSFER_OFFER, {
      fromCharId: effectiveCharId,
      toCharId:   exTargetId,
      items:      offerItems.map(o => ({ char_inventory_id: o.invId, equipment_id: o.equipId, name: o.name, qty: o.qty })),
      solsOffer:  offerSols,
    }, (ack) => {
      if (ack?.ok) {
        setOutboundOffer({ offerId: ack.offerId, toCharName: targetC?.name ?? '?', expiresAt: ack.expiresAt })
        setExStatusMsg(null)
      } else {
        setExStatusMsg({ ok: false, text: t('trade.window.ex_send_error') })
      }
    })
  }, [socket, effectiveCharId, exTargetId, offerItems, offerSols, characters, t, loadInventory])

  const handleCancelOffer = useCallback(() => {
    if (!socket || !outboundOffer || !myCharId) return
    socket.emit(WS.TRADE_TRANSFER_CANCELLED, { offerId: outboundOffer.offerId, fromCharId: myCharId })
    setOutboundOffer(null)
    setExStatusMsg({ ok: false, text: t('trade.window.ex_cancelled') })
  }, [socket, myCharId, outboundOffer, t])

  const handleAcceptOffer = useCallback(() => {
    if (!socket || !incomingOffer || timeLeft === 0) return
    const acceptingCharId = incomingOffer.toCharId ?? effectiveCharId
    if (!acceptingCharId) return
    socket.emit(WS.TRADE_TRANSFER_ACCEPTED, { offerId: incomingOffer.offerId, acceptingCharId })
  }, [socket, effectiveCharId, incomingOffer, timeLeft])

  const handleDeclineOffer = useCallback(() => {
    if (!socket || !incomingOffer) return
    socket.emit(WS.TRADE_TRANSFER_DECLINED, { offerId: incomingOffer.offerId })
    setIncomingOffer(null)
  }, [socket, incomingOffer])

  return (
    <div className="combat-win" style={{ width: PANEL_W, left: pos.left, top: pos.top }}>

      <div className="combat-win-header" onMouseDown={onHeaderMouseDown}>
        <span className="combat-win-title">{t('trade.window.tab_exchange').toUpperCase()}</span>
        <button className="btn btn-icon" onClick={onClose} title={t('common.close')}>✕</button>
      </div>

      {isGm && !gmActingAsId && (() => {
        const gmPjOptions = characters.filter(c => c.type === 'pj' && c.id !== exTargetId)
        return (
          <div style={S.gmActingAsRow}>
            <span style={S.modLabel}>{t('trade.window.ex_acting_as_select')}</span>
            {gmPjOptions.length > 0 ? (
              <div style={{ flex: 1 }}>
                <select
                  style={S.merchantSelect}
                  value=""
                  onChange={e => { if (e.target.value) setGmActingAsId(e.target.value) }}
                >
                  <option value="">{t('trade.window.ex_acting_as_placeholder')}</option>
                  {gmPjOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            ) : (
              <span style={S.exTimer}>{t('trade.window.ex_no_other_pj')}</span>
            )}
          </div>
        )
      })()}
      {isGm && gmActingAsId && (
        <p style={S.gmActingAs}>
          {t('trade.window.ex_acting_as', { name: characters.find(c => c.id === gmActingAsId)?.name ?? '—' })}
        </p>
      )}

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
                {offerItems.map((o, i) => <div key={i} style={S.exOfferRow}>{o.name} ×{o.qty}</div>)}
              </div>
            )}
            {offerSols > 0 && <div style={S.exSolsReceived}>{offerSols} S</div>}
            <button className="btn btn-danger" style={{ alignSelf: 'flex-start' }} onClick={handleCancelOffer}>
              {t('trade.window.ex_cancel')}
            </button>
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
                {incomingOffer.items.map((o, i) => <div key={i} style={S.exOfferRow}>{o.name} ×{o.qty}</div>)}
              </div>
            )}
            {incomingOffer.solsOffer > 0 && <div style={S.exSolsReceived}>{incomingOffer.solsOffer} S</div>}
            <div style={S.exBtnRow}>
              <button className="btn btn-gold" disabled={timeLeft === 0} onClick={handleAcceptOffer}>
                {t('trade.window.ex_accept')}
              </button>
              <button className="btn btn-danger" onClick={handleDeclineOffer}>
                {t('trade.window.ex_decline')}
              </button>
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
            >
              {t('trade.window.ex_new')}
            </button>
          </div>
        )}

        {/* Cas D — Formulaire composition */}
        {!outboundOffer && !incomingOffer && !exStatusMsg && (() => {
          const myUserId   = characters.find(c => c.id === effectiveCharId)?.user_id ?? null
          const targetChar = exTargetId ? characters.find(c => c.id === exTargetId) : null
          const isDrone    = targetChar?.type === 'drone'
          const actorReady = !isGm || !!gmActingAsId
          // Un item équipé (slots non null) n'est pas échangeable tel quel — même convention que
          // ContainerPanel.jsx (items disponibles = slots == null, en container).
          const availableItems = myInventory.filter(item => item.slots == null)
          return (
          <>
            <div style={S.playerSection}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={S.modLabel}>{t('trade.window.ex_target_label')}</span>
                <div style={{ position: 'relative', flex: 1 }} ref={comboRef}>
                  <input
                    type="text"
                    style={S.merchantSelect}
                    placeholder={t('trade.window.ex_no_target')}
                    value={searchText}
                    onChange={e => {
                      const v = e.target.value
                      setSearchText(v)
                      setExTargetId(null)
                      setShowSuggestions(v.length >= 3)
                    }}
                  />
                  {showSuggestions && (() => {
                    const suggestions = characters
                      .filter(c => c.id !== effectiveCharId
                               && (c.type !== 'drone' || c.user_id === myUserId)
                               && c.name.toLowerCase().includes(searchText.toLowerCase()))
                      .slice(0, 3)
                    return suggestions.length > 0 ? (
                      <div style={S.suggestions}>
                        {suggestions.map(c => (
                          <div
                            key={c.id}
                            style={S.suggestionItem}
                            onMouseDown={() => { setExTargetId(c.id); setSearchText(c.name); setShowSuggestions(false) }}
                          >
                            {c.name}
                          </div>
                        ))}
                      </div>
                    ) : null
                  })()}
                </div>
              </div>
            </div>

            {actorReady ? (
              <>
                <div style={S.catalogList}>
                  {invLoading && <p style={S.empty}>{t('trade.window.ex_loading_inv')}</p>}
                  {!invLoading && availableItems.length === 0 && <p style={S.empty}>{t('trade.window.ex_no_items')}</p>}
                  {availableItems.map(item => {
                    const name       = item.custom_name || item.ref_name || '?'
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
                  {!isDrone && (
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
                  )}
                  <button
                    className="btn btn-gold"
                    style={{ ...S.checkoutBtn, marginTop: '6px', width: '100%' }}
                    disabled={!exTargetId || exTargetId === effectiveCharId
                      || (isDrone ? offerItems.length === 0 : (offerItems.length === 0 && offerSols === 0))}
                    onClick={handleProposeOffer}
                  >
                    {isDrone ? t('trade.window.drone_transfer') : t('trade.window.ex_propose')}
                  </button>
                </div>
              </>
            ) : (
              <p style={S.empty}>{t('trade.window.ex_select_actor_first')}</p>
            )}
          </>
          )
        })()}

      </div>
    </div>
  )
}

const S = {
  gmActingAs:        { margin: '4px 8px 0', fontSize: '11px', color: '#c8a84b', fontWeight: 600 },
  gmActingAsRow:     { display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 8px 0' },
  empty:             { color: '#888', textAlign: 'center', padding: '20px 0', fontSize: '13px', margin: 0 },
  playerSection:     { padding: '8px 8px 4px', flexShrink: 0 },
  merchantSelect:    { width: '100%', fontSize: '13px', padding: '5px 8px', background: '#12121c', color: '#ddd', border: '1px solid #2a2a3a', borderRadius: '4px' },
  catalogList:       { overflowY: 'auto', maxHeight: '300px', padding: '4px 8px' },
  catalogItem:       { borderBottom: '1px solid #1e1e2e', borderRadius: '3px' },
  catalogItemHeader: { display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 4px' },
  catalogItemName:   { flex: 1, fontSize: '13px', color: '#ddd' },
  cartSection:       { borderTop: '1px solid #2a2a3a', padding: '6px 8px', flexShrink: 0 },
  modRow:            { display: 'flex', alignItems: 'center', gap: '4px' },
  modLabel:          { fontSize: '11px', color: '#777', whiteSpace: 'nowrap' },
  modInput:          { textAlign: 'center', fontSize: '12px', padding: '3px 4px' },
  modUnit:           { fontSize: '11px', color: '#777' },
  checkoutBtn:       { flexShrink: 0, fontSize: '12px', padding: '4px 12px' },
  exPanel:           { padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '10px' },
  exFromName:        { fontSize: '13px', color: '#ddd', fontWeight: 600, margin: 0 },
  exOfferList:       { display: 'flex', flexDirection: 'column', gap: '2px' },
  exOfferRow:        { fontSize: '12px', color: '#bbb', padding: '2px 0' },
  exSolsReceived:    { fontSize: '14px', color: '#c8a84b', fontWeight: 600 },
  exTimer:           { fontSize: '12px', color: '#888', margin: 0 },
  exBtnRow:          { display: 'flex', gap: '8px' },
  suggestions:       { position: 'absolute', top: '100%', left: 0, right: 0, background: '#12121c', border: '1px solid #2a2a3a', borderTop: 'none', borderRadius: '0 0 4px 4px', zIndex: 100, maxHeight: '160px', overflowY: 'auto' },
  suggestionItem:    { padding: '6px 8px', fontSize: '13px', color: '#ddd', cursor: 'pointer' },
}
