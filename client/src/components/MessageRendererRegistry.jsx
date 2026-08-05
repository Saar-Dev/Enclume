import { styles } from './Sidebar.styles.js'
import { IconDice } from './SidebarIcons.jsx'
import { formatMrDegreeTitle } from '../lib/mrDegreeTitle.js'

// Extrait de Sidebar.jsx (PLAN_CHAT.md §8.3, Phase 3d) — remplace la cascade if/else de rendu des
// messages. Déplacement fidèle du JSX existant (comportement inchangé pour tous les types déjà en
// jeu), plus deux renderers nouveaux (TEXT/WHISPER) pour le format persisté (chat_messages).
//
// Deux formes de message cohabitent (§16 discuté en session — pas dans le texte du plan) :
//  - Ancienne (dés, actions, système...) : champs plats construits par les hooks socket existants
//    (useSessionSocket/useEntitySocket/useCombatSocket), addMessage() direct, jamais en base.
//  - Nouvelle (TEXT/WHISPER) : { id, channelId, type, payload, author, character, createdAt },
//    telle que renvoyée par chatService.toClientMessage (historique + chat:message_created).
// renderMessage() dispatche sur les deux sans les fusionner — chaque forme garde ses champs propres.
//
// ctx (dépendances non portées par le message lui-même, fournies par le composant appelant) :
//   t, tCombat, isGm, animatingDiceId, breakdownPopoverMsgId, onOpenBreakdown,
//   setPendingActionCount, onEntityActionResolve, onOpenTrade, onOpenExchange

const formatTime = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

function renderSystem(msg) {
  return (
    <div key={msg.id} style={styles.messageSystem}>
      <span style={msg.error ? styles.msgSystemErrorText : styles.msgSystemText}>{msg.text}</span>
      <span style={styles.msgTime}>{msg.time}</span>
    </div>
  )
}

function renderEntityAction(msg, ctx) {
  // Visible uniquement par le GM
  if (!ctx.isGm) return null
  return (
    <div key={msg.id} className="sidebar-msg-action" style={styles.messageAction}>
      <div style={styles.actionHeader}>
        <span style={styles.actionIcon}>⚔</span>
        <span style={styles.actionTitle}>
          {ctx.t('sidebar.actionPending', { playerName: msg.playerName, interactionLabel: msg.interactionLabel })}
        </span>
        <span style={styles.msgTime}>{msg.time}</span>
      </div>
      <span style={styles.actionSub}>{ctx.t('sidebar.actionOn', { entityLabel: msg.entityLabel })}</span>
      {msg.skillId && (
        <div style={styles.actionMeta}>
          <span>{ctx.t('sidebar.actionSkill')} : <strong>{msg.skillId}</strong></span>
          <span>{ctx.t('sidebar.actionDC')} : <strong>{msg.defaultDifficulty}</strong></span>
        </div>
      )}
      <div style={styles.actionBtns}>
        <button className="btn btn-success" style={styles.btnAccept} onClick={() => { ctx.setPendingActionCount(p => Math.max(0, p - 1)); ctx.onEntityActionResolve?.(msg.requestId, true, false, 0) }}>
          {ctx.t('sidebar.actionAccept')}
        </button>
        <button className="btn" style={styles.btnAuto} onClick={() => { ctx.setPendingActionCount(p => Math.max(0, p - 1)); ctx.onEntityActionResolve?.(msg.requestId, true, true, 0) }}>
          {ctx.t('sidebar.actionAuto')}
        </button>
        <button className="btn btn-danger" style={styles.btnRefuse} onClick={() => { ctx.setPendingActionCount(p => Math.max(0, p - 1)); ctx.onEntityActionResolve?.(msg.requestId, false, false, 0) }}>
          {ctx.t('sidebar.actionRefuse')}
        </button>
      </div>
    </div>
  )
}

function renderSellRequest(msg, ctx) {
  if (!ctx.isGm) return null
  return (
    <div key={msg.id} className="sidebar-msg-action" style={styles.messageAction}>
      <div style={styles.actionHeader}>
        <span style={styles.actionIcon}>🏪</span>
        <span style={styles.actionTitle}>
          {ctx.t('sidebar.sellRequest', {
            charName: msg.fromCharName,
            merchant: msg.merchantName || 'GM',
          })}
        </span>
        <span style={styles.msgTime}>{msg.time}</span>
      </div>
      <div style={styles.actionSub}>
        {msg.itemCount} objet{msg.itemCount !== 1 ? 's' : ''} — {msg.solsProposed} S
      </div>
      <div style={styles.actionBtns}>
        <button
          className="btn btn-success" style={styles.btnAccept}
          onClick={() => {
            ctx.setPendingActionCount(p => Math.max(0, p - 1))
            ctx.onOpenTrade?.({ mode: 'reventes' })
          }}
        >
          {ctx.t('sidebar.sellRequestView')}
        </button>
      </div>
    </div>
  )
}

function renderExchangeOffer(msg, ctx) {
  return (
    <div key={msg.id} className="sidebar-msg-action" style={styles.messageAction}>
      <div style={styles.actionHeader}>
        <span style={styles.actionIcon}>🔄</span>
        <span style={styles.actionTitle}>
          {ctx.t('sidebar.exchangeOffer', { charName: msg.fromCharName })}
        </span>
        <span style={styles.msgTime}>{msg.time}</span>
      </div>
      <div style={styles.actionSub}>
        {msg.itemCount} objet{msg.itemCount !== 1 ? 's' : ''}{msg.solsOffer > 0 ? ` — ${msg.solsOffer} S` : ''}
      </div>
      <div style={styles.actionBtns}>
        <button
          className="btn btn-success" style={styles.btnAccept}
          onClick={() => {
            ctx.setPendingActionCount(p => Math.max(0, p - 1))
            ctx.onOpenExchange?.({ incomingOffer: { offerId: msg.offerId, fromCharName: msg.fromCharName, items: msg.items, solsOffer: msg.solsOffer, expiresAt: msg.expiresAt, toCharId: msg.toCharId } })
          }}
        >
          {ctx.t('sidebar.exchangeOfferView')}
        </button>
      </div>
    </div>
  )
}

function renderDeclareError(msg) {
  return (
    <div key={msg.id} className="sidebar-glass" style={{ ...styles.messageDice, background: 'rgba(224,92,92,0.07)', border: '1px solid rgba(224,92,92,0.2)' }}>
      <div style={styles.diceHeader}>
        <span style={{ ...styles.diceIcon, color: '#c05050' }}>⊗</span>
        {msg.username && <span style={{ ...styles.msgUser, color: '#c05050' }}>{msg.username}</span>}
        <span style={styles.msgTime}>{msg.username ? ` · ${msg.time}` : msg.time}</span>
      </div>
      <div style={{ paddingLeft: '2px', fontSize: 12, color: '#c0c0d0' }}>{msg.text}</div>
      <div style={{ paddingLeft: '2px' }}>
        <span className="badge badge-fail">ÉCHEC</span>
      </div>
    </div>
  )
}

function renderResolveMoveBlocked(msg) {
  return (
    <div key={msg.id} className="sidebar-glass" style={{ ...styles.messageDice, background: 'rgba(224,92,92,0.07)', border: '1px solid rgba(224,92,92,0.2)' }}>
      <div style={styles.diceHeader}>
        <span style={{ ...styles.diceIcon, color: '#c05050' }}>⊗</span>
        {msg.username && <span style={{ ...styles.msgUser, color: '#c05050' }}>{msg.username}</span>}
        <span style={styles.msgTime}>{msg.username ? ` · ${msg.time}` : msg.time}</span>
      </div>
      <div style={{ paddingLeft: '2px', fontSize: 12, color: '#c0c0d0' }}>{msg.text}</div>
      <div style={{ paddingLeft: '2px' }}>
        <span className="badge badge-fail">{msg.partial ? 'PARTIEL' : 'BLOQUÉ'}</span>
      </div>
    </div>
  )
}

// Une seule entrée de registre pour 'dice' — les sous-branches (macro/combat_damage/déplacement/
// skillcheck/jet normal) restent internes, comme dans la cascade d'origine. Les séparer en entrées
// de registre distinctes exigerait d'inventer une clé de discrimination qui n'existe pas dans la
// donnée (pas de champ unique propre) — indirection sans bénéfice réel.
function renderDice(msg, ctx) {
  const isAnimating = ctx.animatingDiceId === msg.id

  // ── Macro favori (PLAN 13) ─────────────────────────────────
  if (msg.interactionType === 'macro_result') {
    const successStyle = msg.isSuccess
      ? { background: 'rgba(76,175,119,0.07)', border: '1px solid rgba(76,175,119,0.2)' }
      : { background: 'rgba(224,92,92,0.07)', border: '1px solid rgba(224,92,92,0.2)' }
    return (
      <div key={msg.id} className="sidebar-glass" style={{ ...styles.messageDice, ...successStyle }}>
        <div style={styles.diceHeader}>
          <span style={{ ...styles.diceIcon, color: msg.color || '#aa8a30' }}>★</span>
          <span style={{ ...styles.msgUser, color: msg.color || '#aa8a30' }}>{msg.characterName}</span>
          <span style={styles.msgTime}> · {msg.time}</span>
          {msg.secret && <span style={{ fontSize: 9, marginLeft: 4 }}>🔒</span>}
        </div>
        <div style={{ paddingLeft: '2px', fontSize: '12px', color: '#c0c0d0', lineHeight: 1.4 }}>
          {msg.formattedMessage}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: '2px', marginTop: 3 }}>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 14, fontWeight: 700, color: '#dde7ee' }}>
            {msg.rollResult}
          </span>
          <span style={{ fontSize: 10, color: '#456575' }}>/ {msg.threshold}</span>
          <span className={msg.isSuccess ? 'badge badge-success' : 'badge badge-fail'}>
            {msg.isSuccess ? ctx.t('sidebar.macroSuccess') : ctx.t('sidebar.macroFail')}
            {msg.isCriticalSuccess ? ` ${ctx.t('sidebar.macroCritical')}` : msg.isCriticalFail ? ` ${ctx.t('sidebar.macroFumble')}` : ''}
          </span>
        </div>
      </div>
    )
  }

  // ── Jet d'interaction entité — affichage structuré ──────────
  if (msg.skillLabel !== undefined) {
    const successStyle = msg.isSuccess
      ? { background: 'rgba(76,175,119,0.07)', border: '1px solid rgba(76,175,119,0.2)' }
      : { background: 'rgba(224,92,92,0.07)', border: '1px solid rgba(224,92,92,0.2)' }

    // ── Dégâts combat (PJ confirme) ─────────────────────────
    if (msg.interactionType === 'combat_damage') {
      return (
        <div key={msg.id} className="sidebar-glass" style={{
          ...styles.messageDice,
          background: (msg.severityColor ?? '#FF6B6B') + '18',
          border: `1px solid ${(msg.severityColor ?? '#FF6B6B')}44`,
        }}>
          <div style={styles.diceHeader}>
            <span style={{ ...styles.diceIcon, color: msg.severityColor ?? msg.color }}>⚔</span>
            <span style={{ ...styles.msgUser, color: msg.severityColor ?? msg.color }}>{msg.user}</span>
            <span style={styles.msgTime}> · {msg.time}</span>
          </div>
          <div style={{ paddingLeft: '2px', fontSize: '13px', color: '#c0c0d0' }}>
            <strong style={{ color: msg.severityColor ?? '#c0c0d0' }}>{msg.total}</strong> dégâts
            {' '}à <strong>{msg.localisation}</strong>
            {' '}de <strong>{msg.targetName}</strong>
          </div>
          {msg.severity && (
            <span className="badge" style={{ color: msg.severityColor, background: msg.severityColor + '22', boxShadow: `inset 0 0 0 1px ${msg.severityColor}66` }}>
              {msg.severity}
            </span>
          )}
        </div>
      )
    }

    // ── Déplacement d'entité ────────────────────────────────
    if (msg.interactionType === 'displacement') {
      return (
        <div key={msg.id} className="sidebar-glass" style={{ ...styles.messageDice, ...successStyle }}>
          {/* En-tête : icône + nom + heure */}
          <div style={styles.diceHeader}>
            <span style={{ ...styles.diceIcon, color: msg.color || '#5b8dee' }}>
              <IconDice />
            </span>
            <span style={{ ...styles.msgUser, color: msg.color || '#5b8dee' }}>{msg.user}</span>
            <span style={styles.msgTime}> · {msg.time}</span>
            {msg.breakdown && (
              <button onClick={(e) => ctx.onOpenBreakdown(e, msg)} title="Détail du calcul" style={{ marginLeft: 'auto', background: ctx.breakdownPopoverMsgId === msg.id ? 'rgba(91,141,238,0.2)' : 'none', border: '1px solid rgba(91,141,238,0.25)', borderRadius: 3, padding: '1px 5px', cursor: 'pointer', color: '#5b8dee', fontSize: 10, lineHeight: 1 }}>⊞</button>
            )}
          </div>
          {/* Corps : "Jet de Force" + résultat du dé en grand */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', paddingLeft: '2px' }}>
            <span style={styles.diceFormula}>{ctx.t('sidebar.displacementJet', { attr: msg.skillLabel })}</span>
            <span style={styles.diceTotal}>{msg.total}</span>
          </div>
          {/* Détail : difficulté · seuil */}
          <div style={{ paddingLeft: '2px', fontSize: '11px', color: '#64748b' }}>
            {ctx.t('sidebar.displacementDetail', {
              dif: msg.diffLabel,
              seuil: msg.chancesDeReussite,
            })}
          </div>
          {/* Badge résultat avec marge de réussite */}
          <div style={{ paddingLeft: '2px' }}>
            <span className={msg.isSuccess ? 'badge badge-success' : 'badge badge-fail'} title={formatMrDegreeTitle(ctx.tCombat, msg.mr, msg.cardType)}>
              {msg.isSuccess
                ? ctx.t('sidebar.displacementSuccess', { mr: msg.mr })
                : ctx.t('sidebar.displacementFail', { mr: msg.mr })
              }
            </span>
          </div>
        </div>
      )
    }

    // ── Skillcheck ──────────────────────────────────────────
    return (
      <div key={msg.id} className="sidebar-glass" style={{ ...styles.messageDice, ...successStyle }}>
        {/* En-tête : icône + nom + heure */}
        <div style={styles.diceHeader}>
          <span style={{ ...styles.diceIcon, color: msg.color || '#5b8dee' }}>
            <IconDice />
          </span>
          <span style={{ ...styles.msgUser, color: msg.color || '#5b8dee' }}>{msg.user}</span>
          <span style={styles.msgTime}> · {msg.time}</span>
          {msg.breakdown && (
            <button onClick={(e) => ctx.onOpenBreakdown(e, msg)} title="Détail du calcul" style={{ marginLeft: 'auto', background: ctx.breakdownPopoverMsgId === msg.id ? 'rgba(91,141,238,0.2)' : 'none', border: '1px solid rgba(91,141,238,0.25)', borderRadius: 3, padding: '1px 5px', cursor: 'pointer', color: '#5b8dee', fontSize: 10, lineHeight: 1 }}>⊞</button>
          )}
        </div>
        {/* Corps : nom compétence + résultat du dé en grand */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', paddingLeft: '2px' }}>
          <span style={styles.diceFormula}>{msg.skillLabel}</span>
          <span style={styles.diceTotal}>{msg.total}</span>
        </div>
        {/* Détail : compétence · difficulté · seuil */}
        <div style={{ paddingLeft: '2px', fontSize: '11px', color: '#64748b' }}>
          {ctx.t(msg.cardType === 'drone_damage'
            ? 'sidebar.droneActionDetail'
            : msg.cardType === 'shock_test'
            ? 'sidebar.shockTestDetail'
            : 'sidebar.entityActionDetail',
          {
            skill: msg.mechanicalTotal,
            dif: msg.diffLabel,
            seuil: msg.chancesDeReussite,
          })}
        </div>
        {/* Badge résultat */}
        <div style={{ paddingLeft: '2px' }}>
          <span className={msg.isSuccess ? 'badge badge-success' : 'badge badge-fail'} title={formatMrDegreeTitle(ctx.tCombat, msg.mr, msg.cardType)}>
            {msg.isSuccess ? ctx.t('sidebar.entityActionSuccess') : ctx.t('sidebar.entityActionFail')}
          </span>
        </div>
      </div>
    )
  }

  // ── Jet normal (/r formule) ─────────────────────────────────
  const critAttr = msg.isCriticalSuccess ? 'success' : msg.isCriticalFail ? 'fail' : undefined
  return (
    <div key={msg.id} className="sidebar-glass" data-crit={critAttr} style={styles.messageDice}>
      {/* En-tête : icône animée + nom + heure */}
      <div style={styles.diceHeader}>
        <span
          className={isAnimating ? 'dice-icon-animating' : undefined}
          style={{
            ...styles.diceIcon,
            color: msg.color || '#5b8dee',
          }}
        >
          <IconDice />
        </span>
        <span style={{ ...styles.msgUser, color: msg.color || '#5b8dee' }}>{msg.user}</span>
        <span style={styles.msgTime}> · {msg.time}</span>
        {/* Jet secret — visible uniquement par lanceur + GM */}
        {msg.secret && (
          <span style={{ fontSize: 11, opacity: 0.8 }} title="Jet au MJ — invisible aux autres joueurs">🔒</span>
        )}
        {/* Badge critique — affiché uniquement si configuré */}
        {msg.isCriticalSuccess && (
          <span className="badge badge-success">{ctx.t('dice.criticalSuccess')}</span>
        )}
        {msg.isCriticalFail && (
          <span className="badge badge-fail">{ctx.t('dice.criticalFail')}</span>
        )}
      </div>
      {/* Corps : formule + rolls individuels + total */}
      <div style={styles.diceBody}>
        <span style={styles.diceFormula}>{msg.formula}</span>
        <span style={styles.diceRolls}>
          {'['}{msg.rolls.join(', ')}{']'}
        </span>
        <span style={styles.diceEquals}>=</span>
        <span style={styles.diceTotal}>{msg.total}</span>
      </div>
    </div>
  )
}

// Ancien format de chat simple — { user, color, text, time } construit par useSessionSocket.js,
// jamais persisté (CHAT_MESSAGE, jusqu'à la bascule 3e). Reste actif tant que 3e n'est pas posé.
function renderLegacyText(msg) {
  return (
    <div key={msg.id} style={styles.message}>
      <span style={{ ...styles.msgUser, color: msg.color || '#5b8dee' }}>{msg.user}</span>
      <span style={styles.msgTime}> · {msg.time}</span>
      <p style={styles.msgText}>{msg.text}</p>
    </div>
  )
}

// Nouveau format persisté — { id, type, payload, author, character, createdAt } (chatService.js).
// Même habillage visuel que renderLegacyText (aucune raison de faire différent pour un message texte
// normal), adapté aux nouveaux noms de champs.
function renderText(msg) {
  return (
    <div key={msg.id} style={styles.message}>
      <span style={{ ...styles.msgUser, color: msg.author?.color || '#5b8dee' }}>{msg.author?.username}</span>
      <span style={styles.msgTime}> · {formatTime(msg.createdAt)}</span>
      <p style={styles.msgText}>{msg.payload?.text}</p>
    </div>
  )
}

// Whisper — même corps que TEXT + indicateur privé (🔒, même patron que le jet secret existant).
function renderWhisper(msg) {
  return (
    <div key={msg.id} style={styles.message}>
      <span style={{ ...styles.msgUser, color: msg.author?.color || '#5b8dee' }}>{msg.author?.username}</span>
      <span style={{ fontSize: 11, opacity: 0.8, marginLeft: 4 }} title="Message privé">🔒</span>
      <span style={styles.msgTime}> · {formatTime(msg.createdAt)}</span>
      <p style={styles.msgText}>{msg.payload?.text}</p>
    </div>
  )
}

const registry = {
  entity_action: renderEntityAction,
  sell_request: renderSellRequest,
  exchange_offer: renderExchangeOffer,
  declare_error: renderDeclareError,
  resolve_move_blocked: renderResolveMoveBlocked,
  dice: renderDice,
  TEXT: renderText,
  WHISPER: renderWhisper,
}

export function renderMessage(msg, ctx) {
  if (msg.system) return renderSystem(msg)
  const renderer = registry[msg.type]
  if (renderer) return renderer(msg, ctx)
  return renderLegacyText(msg)
}
