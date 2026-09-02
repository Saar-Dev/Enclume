import { useRef, useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useCharacterStore } from '../stores/characterStore'
import { useSessionStore } from '../stores/sessionStore'
import { WS } from '../../../shared/events.js'
import LibraryPanel from './LibraryPanel.jsx'
import GameTimeWidget from './GameTimeWidget.jsx'
import BlessuresReviewPanel from './BlessuresReviewPanel.jsx'
import PendingRollsPanel from './PendingRollsPanel.jsx'
import {
  IconEdit, IconPlay, IconEye, IconEyeOff, IconRuler, IconPlus,
} from './SidebarIcons.jsx'
import { styles } from './Sidebar.styles.js'
import DiceBreakdownPopover from './DiceBreakdownPopover.jsx'
import SidebarHelpModal from './SidebarHelpModal.jsx'
import SidebarCharactersTab from './SidebarCharactersTab.jsx'
import SidebarProfileTab from './SidebarProfileTab.jsx'
import SidebarChatTab from './SidebarChatTab.jsx'
import SurfaceEditorPanel from './SurfaceEditorPanel.jsx'
import { useChatSocket } from '../lib/useChatSocket.js'
import { useDiceBreakdownPopover } from '../lib/useDiceBreakdownPopover.js'
import { useSidebarPendingActionsBadge } from '../lib/useSidebarPendingActionsBadge.js'

const SIDEBAR_MIN = 220
const SIDEBAR_MAX = 500
const SIDEBAR_CLOSE_THRESHOLD = 160

// ─── Sidebar principale ───────────────────────────────────────────────────────
export default function Sidebar({
  mode, onModeChange, renderMode2D,
  activeEditorTab, onEditorTabChange,
  layer, onLayerChange,
  width, onWidthChange,
  onClose,
  activeMaterial, onMaterialChange, availableBlocks = [],
  activeBlueprint, onBlueprintSelect,
  surfaceTool, onSurfaceToolChange,
  canSurfaceUndo,
  canSurfaceRedo,
  onSurfaceUndo,
  onSurfaceRedo,
  campaignId,
  battlemapId,
  socket,
  onReconnectSocket,
  onOpenCharacter,
  onEntityActionResolve,
  onConnectorActionResolve,
  onOpenTrade,
  onOpenExchange,
}) {
  const { t } = useTranslation()
  const { isGm } = useCharacterStore()
  const { messagesByCampaign, activeCampaignId } = useSessionStore()
  const messages = useMemo(
    () => messagesByCampaign[activeCampaignId] || [],
    [activeCampaignId, messagesByCampaign],
  )
  // PLAN_CHAT.md Phase 3e — historique persisté + temps réel (chat:message_created/_deleted).
  // loadOlderMessages/hasMore/loadingOlder descendus vers SidebarChatTab (CHAT-SCROLL1) — un seul
  // appel du hook ici, ne jamais le rappeler dans SidebarChatTab (double fetch/listeners socket).
  const { loadOlderMessages, hasMore: hasMoreMessages, loadingOlder } = useChatSocket(campaignId)
  const [activeTab, setActiveTab] = useState('chat')
  const [toolsOpen, setToolsOpen] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  // Contrôlé ici (pas dans SurfaceEditorPanel) car Sidebar reste monté tant que la sidebar est
  // visible, contrairement à SurfaceEditorPanel qui se démonte hors mode édition — un useState local
  // à ce dernier perdrait la recherche en cours ou le brouillon d'effet MJ à chaque aller-retour
  // Édition ↔ Jeu (PLAN_REFACTOR_SIDEBAR.md Lot 5).
  const [objectSearch, setObjectSearch] = useState('')
  const [refreshingObjects, setRefreshingObjects] = useState(false)
  const [customEffectOpen, setCustomEffectOpen] = useState(false)
  const [customEffectDraft, setCustomEffectDraft] = useState({ key: '', label: '', movementMultiplier: 1, note: '' })

  // Modale character — déléguée à SessionPage via onOpenCharacter

  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const { pendingActionCount, setPendingActionCount } = useSidebarPendingActionsBadge(messages, isGm)
  const { breakdownPopover, popoverRef, handleOpenBreakdown } = useDiceBreakdownPopover()

  // ─── RESIZE ─────────────────────────────────────────────────────────────
  const onMouseDown = (e) => {
    isDragging.current = true
    startX.current = e.clientX
    startWidth.current = width
    e.preventDefault()
  }

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isDragging.current) return
      const delta = startX.current - e.clientX
      const newWidth = startWidth.current + delta
      if (newWidth < SIDEBAR_CLOSE_THRESHOLD) {
        isDragging.current = false
        onClose()
      } else {
        onWidthChange(Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, newWidth)))
      }
    }
    const onMouseUp = () => { isDragging.current = false }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onClose, onWidthChange])

  return (
    <div className="sidebar-panel" style={{ ...styles.sidebar, width }}>

      {/* Keyframes animation dé — toujours dans le DOM, indépendant de l'onglet actif */}
      <style>{`
        @keyframes diceRoll {
          0%   { transform: rotate(0deg) scale(1); }
          25%  { transform: rotate(120deg) scale(1.25); }
          60%  { transform: rotate(300deg) scale(0.9); }
          100% { transform: rotate(360deg) scale(1); }
        }
        .dice-icon-animating {
          animation: diceRoll 0.8s ease-out;
        }
      `}</style>

      {/* Poignée de redimensionnement */}
      <div style={styles.resizeHandle} onMouseDown={onMouseDown} />

      {/* Bouton fermeture */}
      <button className="btn-icon" onClick={onClose} title={t('common.close')} style={{ position:'absolute', top:'8px', right:'8px', zIndex:10, fontSize:'18px' }}>›</button>

      {/* Bouton aide raccourcis */}
      <button
        className="btn-icon sidebar-help-btn"
        onClick={() => setShowHelp(v => !v)}
        title={t('sidebar.helpTitle')}
      >?</button>

      {/* ─── HORLOGE DE CAMPAGNE (docs/PLAN_FATIGUE_DOMMAGES.md §7, Lot 1) ────────── */}
      {/* Masquée en mode Combat et Édition — décision Saar 2026-07-29, distraction non désirée */}
      {mode !== 'combat' && mode !== 'edit' && <GameTimeWidget campaignId={campaignId} />}

      {/* ─── BLESSURES : revue MJ + jets en attente (docs/PLAN_BLESSURES_GUERISON.md §6.1) ────── */}
      {/* Jamais masqués par le mode — une revue/un jet déjà ouvert avant un changement de mode reste
          actionnable ; contrairement à l'horloge, rien ici n'en déclenche de nouveaux depuis ces modes. */}
      <BlessuresReviewPanel campaignId={campaignId} />
      <PendingRollsPanel campaignId={campaignId} />

      {/* ─── OUTILS ─────────────────────────────────────────────────────── */}
      <div style={styles.toolsRow}>
        {isGm && !renderMode2D && (
          <button
            className="btn-tool"
            data-active={mode === 'edit'}
            onClick={() => onModeChange(mode === 'edit' ? 'play' : 'edit')}
            title={mode === 'edit' ? t('session.modePlay') : t('session.modeEdit')}
          >
            {mode === 'edit' ? <IconPlay /> : <IconEdit />}
            <span style={{ fontSize:'9px', letterSpacing:'0.5px', textTransform:'uppercase' }}>{mode === 'edit' ? 'Mode jeu' : 'Édition'}</span>
          </button>
        )}

        {isGm && mode !== 'edit' && (
          <button
            className="btn-tool"
            data-active={layer === 'gm'}
            onClick={() => onLayerChange(layer === 'gm' ? 'token' : 'gm')}
            title={layer === 'gm' ? t('session.layerToken') : t('session.layerGM')}
          >
            {layer === 'gm' ? <IconEyeOff /> : <IconEye />}
            <span style={{ fontSize:'9px', letterSpacing:'0.5px', textTransform:'uppercase' }}>{layer === 'gm' ? t('session.layerGM') : t('session.layerToken')}</span>
          </button>
        )}

        {mode !== 'edit' && <div style={{ position: 'relative' }}>
          <button
            className="btn-tool"
            onClick={() => setToolsOpen(v => !v)}
            title={t('session.tools')}
          >
            <IconRuler />
            <span style={{ fontSize:'9px', letterSpacing:'0.5px', textTransform:'uppercase' }}>{t('session.tools')}</span>
          </button>
          {toolsOpen && (
            <div className="sidebar-tools-dropdown">
              <button className="sidebar-tools-dropdown-item" disabled>
                {t('session.toolRuler')}
              </button>
              <button className="sidebar-tools-dropdown-item enabled" onClick={() => { setToolsOpen(false); onOpenTrade?.() }}>
                {t('session.commerce')}
              </button>
            </div>
          )}
        </div>}
      </div>

      {/* ─── PALETTE TEXTURES (mode édition) ─────────────────────────────── */}
      {mode === 'edit' && (
        <SurfaceEditorPanel
          activeEditorTab={activeEditorTab}
          onEditorTabChange={onEditorTabChange}
          activeMaterial={activeMaterial}
          onMaterialChange={onMaterialChange}
          availableBlocks={availableBlocks}
          activeBlueprint={activeBlueprint}
          onBlueprintSelect={onBlueprintSelect}
          surfaceTool={surfaceTool}
          onSurfaceToolChange={onSurfaceToolChange}
          canSurfaceUndo={canSurfaceUndo}
          canSurfaceRedo={canSurfaceRedo}
          onSurfaceUndo={onSurfaceUndo}
          onSurfaceRedo={onSurfaceRedo}
          battlemapId={battlemapId}
          objectSearch={objectSearch}
          setObjectSearch={setObjectSearch}
          refreshingObjects={refreshingObjects}
          setRefreshingObjects={setRefreshingObjects}
          customEffectOpen={customEffectOpen}
          setCustomEffectOpen={setCustomEffectOpen}
          customEffectDraft={customEffectDraft}
          setCustomEffectDraft={setCustomEffectDraft}
        />
      )}

      <div className="sidebar-separator" />

      {/* ─── ONGLETS — masqués en mode édition ───────────────────────────── */}
      {mode !== 'edit' && (
      <div className="sidebar-tabs">
        <button
          className="sidebar-tab"
          data-active={activeTab === 'chat'}
          onClick={() => setActiveTab('chat')}
        >
          {t('sidebar.chat')}
          {isGm && pendingActionCount > 0 && (
            <span className="sidebar-pending-badge">{pendingActionCount}</span>
          )}
        </button>
        <button
          className="sidebar-tab"
          data-active={activeTab === 'persos'}
          onClick={() => setActiveTab('persos')}
        >
          {t('sidebar.characters')}
        </button>
        <button
          className="sidebar-tab"
          data-active={activeTab === 'biblio'}
          onClick={() => setActiveTab('biblio')}
        >
          {t('sidebar.library')}
        </button>
        <button
          className="sidebar-tab"
          data-active={activeTab === 'profil'}
          onClick={() => setActiveTab('profil')}
        >
          {t('sidebar.profil')}
        </button>
      </div>
      )}

      {/* ─── CONTENU — masqué en mode édition ───────────────────────────── */}
      {mode !== 'edit' && (
      <div style={styles.tabContent}>

        {/* ── Chat ── */}
        {activeTab === 'chat' && (
          <SidebarChatTab
            socket={socket}
            breakdownPopover={breakdownPopover}
            onOpenBreakdown={handleOpenBreakdown}
            setPendingActionCount={setPendingActionCount}
            onEntityActionResolve={onEntityActionResolve}
            onConnectorActionResolve={onConnectorActionResolve}
            onOpenTrade={onOpenTrade}
            onOpenExchange={onOpenExchange}
            loadOlderMessages={loadOlderMessages}
            hasMoreMessages={hasMoreMessages}
            loadingOlder={loadingOlder}
          />
        )}

        {/* ── Persos ── */}
        {activeTab === 'persos' && (
          <SidebarCharactersTab campaignId={campaignId} onOpenCharacter={onOpenCharacter} />
        )}

        {/* ── Biblio ── */}
        {activeTab === 'biblio' && (
          <LibraryPanel />
        )}

        {/* ── Profil — réglages compte + séparateur + liste connectés ── */}
        {activeTab === 'profil' && (
          <SidebarProfileTab onReconnectSocket={onReconnectSocket} />
        )}

      </div>
      )}

      {/* ─── Modale aide raccourcis ───────────────────────────────────────── */}
      <SidebarHelpModal mode={mode} open={showHelp} onClose={() => setShowHelp(false)} />
      <DiceBreakdownPopover popover={breakdownPopover} popoverRef={popoverRef} />
    </div>
  )
}
