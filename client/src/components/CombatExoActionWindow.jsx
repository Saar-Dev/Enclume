import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { WS } from '../../../shared/events.js'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'
import { useAutoMoveMode } from '../lib/useAutoMoveMode.js'
import { useDraggable } from '../lib/useDraggable.js'
import api from '../lib/api.js'

// PLAN_EXOARMURE.md Lot 2bis §8.5/§9 — fenêtre dédiée exo-armure, réutilisée à l'identique côté
// joueur (CombatOverlay.jsx, place de CombatActionWindow) ET côté MJ (place de CombatGmDeclareWindow)
// quand le slot d'Annonce actif est une exo-armure. Même vocabulaire visuel que CombatActionWindow
// (Palette B, `combat-float-*` — CombatActionWindow l'utilise aussi bien pour le PJ que pour le drone
// qu'elle héberge, c'est la palette "fenêtre de déclaration partagée joueur/GM") : tuile ACTION
// (`W.item`/`itemSelected`, cf. MAP_ACTIONS `isZoneSelect`) + footer `.btn-tac` DÉCLARER, jamais des
// `<button className="btn">` génériques.
// §16.3 (2026-08-26) ajoute le Déplacement — moteur déjà générique côté serveur
// (movementBudgetService.js#getExoMovementBudget, consommé par /world-move), seul le survol/preview
// carte manquait ici. Armement/hardpoints (Tir/CaC) restent hors périmètre — Étape B, §16.4.
export default function CombatExoActionWindow({
  socket, user, characters, isGm = false,
  onEnterMoveMode, combatMoveMode,
}) {
  const { t } = useTranslation('combat')
  const { roster, phase, activeTokenId } = useCombatStore()
  const tokens = useTokenStore(s => s.tokens)
  const [isDeclaring, setIsDeclaring] = useState(false)
  const [declareError, setDeclareError] = useState(null)
  const [allures, setAllures] = useState(null)
  const [alluresError, setAlluresError] = useState(null)
  const [moveSelection, setMoveSelection] = useState(null)

  const { pos, onHeaderMouseDown } = useDraggable(
    'combat-exo-action-pos',
    { top: Math.max(80, window.innerHeight - 420), left: window.innerWidth / 2 - 170 },
    340,
  )

  // Le slot actif (activeTokenId) tranche quel exo afficher — jamais "le premier possédé" : côté
  // joueur comme côté MJ, CombatOverlay.jsx ne monte ce composant que si le slot actif EST déjà une
  // exo-armure (isActiveExoForPlayer / gmActiveCharacter?.type==='exo').
  const playerToken = activeTokenId ? tokens.find(tk => tk.id === activeTokenId) : null
  const playerChar  = playerToken ? characters.find(c => c.id === playerToken.character_id) : null
  const rosterEntry = playerToken ? roster.find(r => r.token_id === playerToken.id) : null

  // ALLURE-TURNGATE1/CLICKATTACK-TURNGATE1 (docs/BUGIDENTIFIE.md) — calculées AVANT tout hook pour
  // servir de garde `enabled` complète (useAutoMoveMode s'exécute à chaque rendu, y compris ceux où
  // le JSX ci-dessous retourne finalement null) : sans ce calcul en amont, le survol/preview carte
  // pourrait s'armer pour un token que ce composant ne serait pas censé piloter.
  const isAuthorized  = !!(playerToken && playerChar && rosterEntry) && (isGm || playerChar.user_id === user?.id)
  const isProne       = rosterEntry?.state_position === 'prone'
  const canDeclareNow = isAuthorized && phase === 'ANNOUNCEMENT' && !rosterEntry?.has_announced

  // Écoute COMBAT_DECLARE_ERROR — même patron que CombatActionWindow/CombatGmDeclareWindow.
  useEffect(() => {
    if (!socket) return
    const handler = ({ message }) => {
      setDeclareError(message)
      setTimeout(() => setDeclareError(null), 4000)
    }
    socket.on(WS.COMBAT_DECLARE_ERROR, handler)
    return () => socket.off(WS.COMBAT_DECLARE_ERROR, handler)
  }, [socket])

  // fetch allures — suit l'exo actif. Le calcul VIT/3-modes (surface/sous-marine, délégation pilote,
  // milieu bloqué) reste entièrement côté serveur (getExoMovementBudget) — jamais réimplémenté ici
  // (CLAUDE.md §7), contrairement à CombatActionWindow (PJ humain) qui calcule ses allures en local.
  useEffect(() => {
    const charId = playerChar?.id
    setAllures(null)
    setAlluresError(null)
    if (!charId) return
    let cancelled = false
    api.get(`/char-sheet/${charId}/exo/movement`)
      .then(r => { if (!cancelled) setAllures(r.data.allures) })
      .catch(e => {
        if (cancelled) return
        setAllures(null)
        // Catch auparavant totalement silencieux (bug trouvé en jeu réel, 2026-08-26 : une exo sans
        // pilote/catégorie configurée passait son tour sans aucune explication, la tuile Déplacement
        // restant grisée sans dire pourquoi). getExoMovementBudget (movementBudgetService.js) rejette
        // par une Error générique (ni TypeError ni RangeError) dès que l'armure n'a ni pilote assigné
        // ni catégorie/modèle configuré — le serveur répond alors 500, jamais 400 (server/src/routes/
        // character/char-sheet.js, route /exo/movement) : message affiché tel quel, pas reformulé ici.
        console.error('[CombatExoActionWindow] erreur fetch allures :', e)
        setAlluresError(e.response?.data?.error?.message || e.response?.data?.message || e.message)
      })
    return () => { cancelled = true }
  }, [playerChar?.id])

  // Reset de la sélection en attente au changement de slot actif ou nouveau tour (has_announced retombe
  // à false) — même discipline que CombatActionWindow (reset des états tactiques sur ces deux événements).
  useEffect(() => {
    setMoveSelection(null)
  }, [rosterEntry?.token_id, rosterEntry?.has_announced])

  // Déplacement : survol/preview ambiant par défaut, même patron que CombatActionWindow (PJ)/
  // useDroneDeclare (COMBAT-DEPLACEMENT-HOVER) — désactivé à terre (§9.4, seule "Tenter de se relever"
  // ou "Passer le tour" sont proposés dans ce cas).
  const { rearm: rearmMove } = useAutoMoveMode({
    enabled: canDeclareNow && !isProne && allures !== null,
    allures,
    tokenId: playerToken?.id ?? null,
    tokenPos: playerToken ? { x: playerToken.pos_x, z: playerToken.pos_y } : null,
    combatMoveMode,
    onEnterMoveMode,
    onMoveSelected: (sel) => setMoveSelection(sel),
    onCancel: () => setMoveSelection(null),
  })

  if (!playerToken || !playerChar || !rosterEntry) return null
  // Vérification indépendante (pas seulement confiance au montage conditionnel de CombatOverlay.jsx)
  // — même discipline que CombatActionWindow, qui filtre aussi par user_id de son côté. Le MJ n'est
  // pas forcément characters.user_id de l'exo (propriétaire brut) ni son pilote — même autorité que
  // le serveur (isExoActorAuthorized, combatantContextService.js : GM/propriétaire/pilote), le
  // serveur revalide de toute façon (core.md).
  if (!isGm && playerChar.user_id !== user?.id) return null
  if (phase !== 'ANNOUNCEMENT') return null
  if (rosterEntry.has_announced) return null

  // Tuile "Déplacement" — même toggle que CombatActionWindow#handleZoneSelectClick : efface une
  // sélection déjà posée ET réarme le survol s'il a été désarmé par un "Annuler" explicite (COM-MOVEUI1).
  const handleZoneSelectClick = () => {
    if (allures === null) return
    if (moveSelection) setMoveSelection(null)
    rearmMove()
  }

  // "Tenter de se relever" reste une action immédiate et exclusive (RAW "se redresser", pas de choix
  // intermédiaire crouching/kneeling, §9.4) — jamais mise en attente derrière le bouton DÉCLARER,
  // contrairement au Déplacement.
  const handleStandUp = () => {
    if (!socket || isDeclaring) return
    setIsDeclaring(true)
    socket.emit(WS.COMBAT_ACTION_DECLARE, {
      tokenId: playerToken.id,
      state: { position: 'standing' },
      mapActions: {},
      quick: {},
    })
  }

  // DÉCLARER — même sémantique que le bouton footer PJ/GM : déclare la sélection en attente
  // (mapActions.move si un déplacement est posé), ou déclare un tour vide ("Passer le tour", même
  // mécanisme que useDroneDeclare#hasPassed — socketCombatAnnouncement.js laisse chaque state_*
  // inchangé quand le payload ne le fournit pas, pose seulement has_announced:true). Toujours
  // disponible, y compris à terre (alternative à "Tenter de se relever" ce Tour-là).
  const handleDeclare = () => {
    if (!socket || isDeclaring) return
    setIsDeclaring(true)
    socket.emit(WS.COMBAT_ACTION_DECLARE, {
      tokenId: playerToken.id,
      state: {},
      mapActions: {
        move: moveSelection
          ? {
              targetPosX: moveSelection.targetPosX,
              targetPosY: moveSelection.targetPosY,
              targetPosZ: moveSelection.targetPosZ ?? 0,
              ini_mod: moveSelection.ini_mod ?? 0,
              action_key: moveSelection.action_key,
            }
          : null,
      },
      quick: {},
    })
  }

  return (
    <div className="combat-float-win" style={{ position: 'fixed', width: 340, left: pos.left, top: pos.top, maxHeight: 'calc(100vh - 80px)' }}>
      <div className="combat-float-header" onMouseDown={onHeaderMouseDown}>
        {t('exoActionWindow.title', { name: playerToken.label ?? playerChar.name })}
      </div>

      <div className="combat-win-body" style={{ flexDirection: 'column' }}>
        <div style={S.hint}>{isProne ? t('exoActionWindow.proneHint') : t('exoActionWindow.normalHint')}</div>

        <div className="combat-win-section" style={{ padding: '0 0 4px 0' }}>
          <div style={S.sectionTitle}>{t('sectionTitles.action')}</div>
          <div style={S.itemsGrid}>
            {isProne && (
              <div
                style={{ ...S.item, gridColumn: 'span 2', ...(isDeclaring ? S.itemDisabled : {}) }}
                onClick={handleStandUp}
              >
                <span style={S.itemLabel}>{isDeclaring ? t('exoActionWindow.sending') : t('exoActionWindow.standUpButton')}</span>
              </div>
            )}
            {!isProne && (
              <div
                style={{
                  ...S.item,
                  ...(moveSelection ? S.itemSelected : {}),
                  gridColumn: 'span 2',
                  ...(allures === null ? S.itemDisabled : {}),
                }}
                onClick={handleZoneSelectClick}
              >
                <span style={S.itemLabel}>{t('mapActions.move.label')}</span>
                <span style={{ ...S.itemMod, ...(moveSelection ? { color: '#5b8dee' } : {}) }}>
                  {moveSelection ? `${moveSelection.ini_mod}` : t('actionWindow.chooseZone')}
                </span>
              </div>
            )}
          </div>
          {alluresError && !isProne && (
            <div style={S.errorBanner}>⚠ {t('exoActionWindow.movementUnavailable', { reason: alluresError })}</div>
          )}
        </div>
      </div>

      <div className="combat-float-footer">
        {declareError && (
          <div style={S.errorBanner}>⚠ {declareError}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={S.footerLeft}>
            {moveSelection && (
              <span style={S.destination}>[{moveSelection.targetPosX}, {moveSelection.targetPosY}]</span>
            )}
          </div>
          <button className="btn-tac" onClick={handleDeclare} disabled={isDeclaring}>
            {isDeclaring ? t('exoActionWindow.sending') : t('actionWindow.declareActionButton')}
          </button>
        </div>
      </div>
    </div>
  )
}

// Mêmes valeurs que W (CombatActionWindow.jsx) — non exporté par ce module, donc redéclaré ici plutôt
// qu'importé, mais visuellement identique (même vocabulaire de tuile ACTION partout).
const S = {
  hint: {
    padding: '8px 10px 2px',
    fontSize: 11,
    color: 'var(--combat-field, #8a94a6)',
  },
  sectionTitle: {
    padding: '7px 10px 3px',
    fontSize: 8,
    fontWeight: 700,
    color: 'var(--combat-section)',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  },
  itemsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    padding: '0 4px',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '5px 8px',
    margin: '1px 2px',
    borderRadius: 3,
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid transparent',
  },
  itemSelected: {
    background: 'rgba(91,141,238,0.15)',
    borderColor: '#5b8dee',
  },
  itemDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  itemLabel: {
    fontSize: 11,
    color: '#c0c0d0',
    flex: 1,
    marginRight: 4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemMod: {
    fontSize: 10,
    color: '#5b5b7a',
    flexShrink: 0,
    minWidth: 28,
    textAlign: 'right',
  },
  footerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  destination: {
    fontSize: 10,
    color: '#5b8dee',
    fontWeight: 600,
  },
  errorBanner: {
    fontSize: 10,
    color: '#c83030',
    background: 'rgba(200,48,48,0.08)',
    border: '1px solid #c8303044',
    borderRadius: 3,
    padding: '4px 8px',
    marginBottom: 4,
  },
}
