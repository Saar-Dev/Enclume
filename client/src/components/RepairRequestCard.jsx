import { useState } from 'react'
import { styles } from './Sidebar.styles.js'

// docs/PLANS/PLAN_USURE&INTEGRITE.md §8 (L6c-A) — carte d'action « demande de réparation » dans le
// chat du MJ. Même habillage que renderSellRequest / renderEntityAction (sidebar-msg-action), mais un
// vrai composant : le <select> de compétence a besoin d'un useState, impossible dans un renderer-
// fonction appelé en boucle (règle des Hooks). Enregistré dans MessageRendererRegistry via
//   repair_request: (msg, ctx) => <RepairRequestCard msg={msg} ctx={ctx} key={msg.id} />
//
// msg : { id, echeanceId, playerName, itemName, suggestedSkillId, suggestedSkillLabel,
//         repairSkillOptions: [{id,label}], time }  (injecté par useRepairRequestSocket)
// ctx : { t, isGm, onRepairDecision(echeanceId, 'approve'|'reject', skillId?), setPendingActionCount }
//
// Le retrait de la carte n'est PAS fait ici : useRepairRequestSocket l'enlève sur
// EQUIPMENT_REPAIR_UPDATED / GAME_ECHEANCE_RESOLVED (source = statut serveur de l'échéance).
export default function RepairRequestCard({ msg, ctx }) {
  const { t } = ctx
  const options = msg.repairSkillOptions?.length
    ? msg.repairSkillOptions
    : (msg.suggestedSkillId ? [{ id: msg.suggestedSkillId, label: msg.suggestedSkillLabel ?? msg.suggestedSkillId }] : [])
  const [skillId, setSkillId] = useState(msg.suggestedSkillId ?? options[0]?.id ?? '')
  const [busy, setBusy] = useState(false)

  if (!ctx.isGm) return null

  const decide = (decision) => {
    if (busy) return
    setBusy(true)
    ctx.setPendingActionCount(p => Math.max(0, p - 1))
    ctx.onRepairDecision?.(msg.echeanceId, decision, decision === 'approve' ? skillId : undefined)
  }

  return (
    <div key={msg.id} className="sidebar-msg-action" style={styles.messageAction}>
      <div style={styles.actionHeader}>
        <span style={styles.actionIcon}>🔧</span>
        <span style={styles.actionTitle}>
          {t('sidebar.repairRequestTitle', { playerName: msg.playerName, itemName: msg.itemName })}
        </span>
        <span style={styles.msgTime}>{msg.time}</span>
      </div>
      <label style={styles.actionMeta}>
        {t('sidebar.repairRequestSkill')}
        <select value={skillId} onChange={e => setSkillId(e.target.value)} disabled={busy} style={styles.select}>
          {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      <div style={styles.actionBtns}>
        <button className="btn btn-success" style={styles.btnAccept} disabled={busy || !skillId}
          onClick={() => decide('approve')}>
          {t('sidebar.repairApprove')}
        </button>
        <button className="btn btn-danger" style={styles.btnRefuse} disabled={busy}
          onClick={() => decide('reject')}>
          {t('sidebar.repairReject')}
        </button>
      </div>
    </div>
  )
}
