import { useState, useEffect, useRef, useCallback } from 'react'
import api from './api'
import { WS } from '../../../shared/events.js'
import { useSocket } from './SocketContext'
import { sendInChunks, summarizeResults, explainConfirmRefusal } from './woundReviewGestures.js'

// Données de l'écran de revue des guérisons (PLAN_REVUE_GUERISON.md §12.3, §13). Hook MJ, monté avec l'écran (SessionPage), même patron que
// useRepairRequestSocket : la VÉRITÉ est le serveur, jamais une copie locale qui dérive.
//   - un événement ne PATCHE rien, il déclenche un rechargement de la vue entière (`GET …/review`) — pratique des pros (TkDodo,
//     « Using WebSockets with React Query » : l'événement invalide, la requête relit) : le client n'a aucune règle à répliquer ;
//   - les rafales d'événements (un lot de 30 réponses émet 30 GAME_ECHEANCE_RESOLVED + N WOUND_UPDATED) sont regroupées : UN chargement,
//     150 ms après le dernier événement ;
//   - une réponse tardive d'un ancien chargement est ignorée (compteur de requête) : elle n'écrase jamais un état plus récent ;
//   - à la (re)connexion du socket, la vue est relue (les événements manqués pendant une coupure ne reviennent pas).
const RELOAD_DELAY_MS = 150

const errorMessage = (err) => err?.response?.data?.error?.message ?? err?.message ?? String(err)

export function useWoundReview({ campaignId, isGm }) {
  const socket = useSocket()
  const [view, setView] = useState(null)
  const [busy, setBusy] = useState(false)
  // `notice` = ce que l'écran doit dire au MJ après une action (jamais une simple ligne de console) :
  // { kind: 'loadError' | 'error' | 'partial' | 'results' | 'refusal', … } — traduit par l'écran.
  const [notice, setNotice] = useState(null)

  const viewRef = useRef(null)
  const requestSeq = useRef(0)
  const reloadTimer = useRef(null)
  const busyRef = useRef(false) // garde synchrone : deux clics dans le même rendu ne doivent pas partir deux fois

  const load = useCallback(async () => {
    if (!isGm || !campaignId) return null
    clearTimeout(reloadTimer.current) // un rechargement immédiat couvre celui qui était programmé (pas de double lecture)
    const seq = ++requestSeq.current
    try {
      const { data } = await api.get(`/campaigns/${campaignId}/game-echeances/review`)
      if (seq !== requestSeq.current) return null // une requête plus récente est partie : celle-ci est périmée
      viewRef.current = data
      setView(data)
      setNotice(current => (current?.kind === 'loadError' ? null : current)) // la vue est de nouveau lisible
      return data
    } catch (err) {
      if (seq === requestSeq.current) setNotice({ kind: 'loadError', message: errorMessage(err) })
      return null
    }
  }, [campaignId, isGm])

  const scheduleLoad = useCallback(() => {
    clearTimeout(reloadTimer.current)
    reloadTimer.current = setTimeout(() => { load() }, RELOAD_DELAY_MS)
  }, [load])

  // Chargement initial (un MJ qui se connecte après l'ouverture d'une revue la retrouve). Le nettoyage invalide toute requête en vol.
  useEffect(() => {
    load()
    return () => {
      clearTimeout(reloadTimer.current)
      requestSeq.current += 1
    }
  }, [load])

  useEffect(() => {
    if (!socket || !isGm) return
    const onReviewChanged = () => scheduleLoad()
    // Une fiche qui bouge (dégât de combat, /heal…) ne concerne l'écran que pendant une avance en attente.
    const onWoundUpdated = () => { if (viewRef.current?.advance.pending) scheduleLoad() }
    // Seule une RE-connexion relit la vue : le chargement initial (au montage) couvre déjà la première connexion — sans ce garde, chaque
    // rechargement de page lisait la vue deux fois (constaté dans les traces du serveur).
    let skipNextConnect = !socket.connected
    const onConnect = () => {
      if (skipNextConnect) { skipNextConnect = false; return }
      scheduleLoad()
    }
    const reviewEvents = [WS.CAMPAIGN_ADVANCE_PENDING, WS.CAMPAIGN_ADVANCE_CANCELLED, WS.CAMPAIGN_ADVANCE_RESOLVED, WS.GAME_ECHEANCE_RESOLVED]
    for (const event of reviewEvents) socket.on(event, onReviewChanged)
    socket.on(WS.WOUND_UPDATED, onWoundUpdated)
    socket.on('connect', onConnect)
    return () => {
      for (const event of reviewEvents) socket.off(event, onReviewChanged)
      socket.off(WS.WOUND_UPDATED, onWoundUpdated)
      socket.off('connect', onConnect)
    }
  }, [socket, isGm, scheduleLoad])

  // Enveloppe commune des actions : un seul envoi à la fois, vue relue à la fin (succès OU échec — le serveur est l'autorité).
  const runAction = useCallback(async (action) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setNotice(null)
    try {
      await action()
    } catch (err) {
      setNotice({ kind: 'error', message: errorMessage(err) }) // filet : une erreur imprévue s'écrit dans l'écran, jamais une promesse rejetée muette
      await load()
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [load])

  // `groups` = { healing?: entries[], infection?: entries[] } (woundReviewGestures.js). Les lots partent l'un après l'autre ; un échec de transport
  // arrête tout et dit ce qui a été appliqué ; les entrées périmées / annulées par le serveur sont comptées et écrites.
  const answer = useCallback((groups) => runAction(async () => {
    const routes = [
      ['healing-choices', groups.healing ?? []],
      ['infection-modes', groups.infection ?? []],
    ]
    const results = []
    let sent = 0
    let failure = null
    for (const [route, entries] of routes) {
      if (entries.length === 0 || failure) continue
      const outcome = await sendInChunks(entries, async (chunk) => (
        await api.post(`/campaigns/${campaignId}/game-echeances/${route}`, { choices: chunk })
      ).data)
      results.push(...outcome.results)
      sent += outcome.sent
      failure = outcome.failure
    }
    if (failure) {
      // Le total annoncé compte aussi les entrées jamais tentées après l'échec.
      const remaining = routes.reduce((n, [, entries]) => n + entries.length, 0)
      setNotice({ kind: 'partial', sent, total: remaining, message: errorMessage(failure) })
    } else {
      const summary = summarizeResults(results)
      if (summary.stale > 0 || summary.failed > 0) setNotice({ kind: 'results', stale: summary.stale, failed: summary.failed })
    }
    // Lecture IMMÉDIATE (les boutons restent inactifs jusque-là : aucun clic possible sur une vue périmée) ; elle annule la lecture programmée par les
    // événements de cette action, arrivés avant la réponse HTTP : UNE seule lecture.
    await load()
  }), [campaignId, load, runAction])

  const confirm = useCallback(() => runAction(async () => {
    const before = viewRef.current
    try {
      await api.post(`/campaigns/${campaignId}/game-time/confirm-advance`)
      await load()
    } catch (err) {
      const after = await load() // le serveur diffuse aussi CAMPAIGN_ADVANCE_PENDING sur un 409 ; on relit tout de suite pour expliquer
      if (err?.response?.status === 409) {
        const current = after ?? viewRef.current
        setNotice({
          kind: 'refusal', reason: explainConfirmRefusal(before, current),
          count: current?.summary.answerableCount ?? 0, message: errorMessage(err),
        })
      } else {
        setNotice({ kind: 'error', message: errorMessage(err) })
      }
    }
  }), [campaignId, load, runAction])

  const cancel = useCallback(() => runAction(async () => {
    try {
      await api.post(`/campaigns/${campaignId}/game-time/cancel-advance`)
    } catch (err) {
      setNotice({ kind: 'error', message: errorMessage(err) })
    }
    await load()
  }), [campaignId, load, runAction])

  return { view, busy, notice, answer, confirm, cancel }
}
