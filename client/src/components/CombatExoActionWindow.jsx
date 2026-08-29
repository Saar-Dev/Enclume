import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { WS } from '../../../shared/events.js'
import { useCombatStore } from '../stores/combatStore'
import { useSessionStore } from '../stores/sessionStore'
import { useTokenStore } from '../stores/tokenStore'
import { useAutoMoveMode } from '../lib/useAutoMoveMode.js'
import { useExoDeclare } from '../lib/useExoDeclare.js'
import { firstFireMode } from '../../../shared/fireModes.js'
import { useDraggable } from '../lib/useDraggable.js'
import { calcIniDelta, calcIniBreakdown } from './combatSections.js'
import CombatDeclareIniWidget from './CombatDeclareIniWidget.jsx'
import CombatDeclareErrorBanner from './CombatDeclareErrorBanner.jsx'
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
// carte manquait ici. §16.4 (2026-08-26) ajoute Tir/CaC (useExoDeclare.js, mirroir useDroneDeclare.js
// — une seule arme sélectionnable, Tir Multi/CaC-multiple bloqués côté serveur pour une exo).
export default function CombatExoActionWindow({
  socket, user, characters, isGm = false,
  onEnterMoveMode, combatMoveMode, pendingMoveSelection,
  battlemapId, onEnterTargetMode,
  registerAmbientAttackHandler, showTargetRecap,
}) {
  const { t } = useTranslation('combat')
  const { roster, phase, activeTokenId } = useCombatStore()
  const declareError = useSessionStore(s => s.declareError)
  const tokens = useTokenStore(s => s.tokens)
  const [isDeclaring, setIsDeclaring] = useState(false)
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

  // COMBAT_DECLARE_ERROR : écouté par useCombatSocket (hook central) → sessionStore →
  // <CombatDeclareErrorBanner>. Plus de socket.on local (REACT.md P57, module 3).
  // Reste ici, spécifique à l'exo : un refus serveur doit lever le verrou "ENVOI…" (isDeclaring),
  // sinon le bouton et toute la fenêtre restent figés — la fenêtre ne se démonte que sur
  // has_announced=true (succès), jamais sur un refus (PC23, portée, munitions, se relever inéligible…).
  // Ajustement pendant le rendu (react.dev « adjusting state on prop change », même patron que
  // SidebarChatTab.jsx / creation/Step4Experience.jsx) plutôt qu'un setState en corps d'effet
  // (react-hooks/set-state-in-effect). Gardé sur `declareError.id` : ne se redéclenche pas si
  // l'utilisateur reclique DÉCLARER pendant que la bannière du refus précédent est encore affichée.
  const [handledDeclareErrorId, setHandledDeclareErrorId] = useState(null)
  if (declareError && declareError.id !== handledDeclareErrorId) {
    setHandledDeclareErrorId(declareError.id)
    if (isDeclaring) setIsDeclaring(false)
  }

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
    setIsDeclaring(false)
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

  const exoDeclare = useExoDeclare({
    charId: playerChar?.id ?? null,
    tokenId: playerToken?.id ?? null,
    tokenPos: playerToken ? { x: playerToken.pos_x, z: playerToken.pos_y } : null,
    enabled: canDeclareNow && !isProne,
    moveSelection,
    onEnterTargetMode,
    battlemapId,
    registerAmbientAttackHandler,
    showTargetRecap,
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
    if (!socket || isDeclaring || !exoDeclare.canDeclare) return
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
        ...exoDeclare.buildMapActions(),
      },
      quick: {},
    })
  }

  // Masquage pendant la sélection de destination (COM-MOVEUI1/CombatGmDeclareWindow#hasPendingPlainMove)
  // — bug trouvé en jeu réel (2026-08-26, Saar) : sans ce masquage, rien ne guide le joueur vers le
  // panneau flottant global (légende déplacement, bouton "Valider") une fois une case cliquée sur la
  // carte — il reste sur cette fenêtre, ne valide jamais, et la sélection se perd silencieusement au
  // clic sur DÉCLARER (mapActions.move: null, tour passé). Cache seulement une fois qu'une destination
  // est réellement en attente (pendingMoveSelection), jamais pendant le simple survol ambiant.
  //
  // RETIRÉ (2026-08-27) : masquage identique branché sur combatTargetMode (ciblage Tir/CaC explicite)
  // — régression réelle en jeu (Saar : "l'armure n'émet plus aucune action"), cause probable : ce
  // gate n'a qu'une sortie normale (bouton Annuler générique, CombatOverlay.jsx:444) ; toute sélection
  // de cible interrompue sans passer par ce bouton laisse combatTargetMode bloqué sur le token de
  // l'exo — état partagé (useCombatUIState), pas remis à zéro entre deux Tours ni deux combats tant
  // que la page n'est pas rechargée — rendant la fenêtre invisible ET non cliquable en permanence.
  // Ajout fait de ma propre initiative pendant l'analyse à charge, pour un bug purement cosmétique
  // (légende "Assaut" au lieu de "Corps à corps") — rapport bénéfice/risque plus tenable, retiré
  // plutôt que patché à chaud. Root cause de fond (comment combatTargetMode doit s'auto-nettoyer)
  // pas encore investiguée — à reprendre séparément si le besoin de masquage revient.
  const isSelectingOnMap = combatMoveMode?.tokenId === playerToken.id && !!pendingMoveSelection

  // Initiative projetée (pastille du pied, PLAN_RW_DECLARE_WINDOWS module 2). Une exo ne change pas
  // d'état en déclaration (posture/arme/couverture) — seul le déplacement pèse aujourd'hui ; quand
  // les sélecteurs d'état exo arriveront (ROADMAP §4), il suffira de les passer ici, le widget suit.
  const exoMapActions = { move: moveSelection ? { ini_mod: moveSelection.ini_mod ?? 0 } : null }
  const iniDelta     = calcIniDelta({}, {}, exoMapActions, null)
  const iniBreakdown = calcIniBreakdown({}, {}, exoMapActions, null, t)

  return (
    <div className="combat-float-win" style={{
      position: 'fixed', width: 340, left: pos.left, top: pos.top, maxHeight: 'calc(100vh - 80px)',
      opacity: isSelectingOnMap ? 0 : 1, pointerEvents: isSelectingOnMap ? 'none' : 'auto',
    }}>
      <div className="combat-float-header" onMouseDown={onHeaderMouseDown}>
        {t('exoActionWindow.title', { name: playerToken.label ?? playerChar.name })}
      </div>

      <div className="combat-win-body">
        {/* .combat-win-body est display:flex sans flex-direction (row par défaut, CSS partagée avec
            CombatActionWindow/CombatDamageWindow/CombatCacModifiersWindow/CombatModifiersWindow/
            CombatStunWindow) — jamais surchargée en dur ici (repéré à charge, Saar 2026-08-26 : la
            fenêtre exo était la seule à le faire). L'empilement vertical passe par ce panneau
            interne (S.panel), mirroir exact de W.leftPanel (CombatActionWindow.jsx:1546, colonne
            unique 360px) — même technique, jamais une deuxième façon de faire la même chose. */}
        <div style={S.panel}>
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

        {/* ARMEMENT — Tir/CaC exo (§16.4). Une seule arme sélectionnable (pas de dual-wield hardpoint),
            jamais affiché à terre (isProne, mirroir de la tuile Déplacement ci-dessus). */}
        {!isProne && (
          <div className="combat-win-section" style={{ padding: '0 0 4px 0' }}>
            <div style={S.sectionTitle}>{t('exoActionWindow.weaponSectionTitle')}</div>
            <div style={S.itemsGrid}>
              {exoDeclare.exoWeapons.length === 0 && (
                <div style={{ ...S.itemLabel, gridColumn: 'span 2', padding: '5px 8px', opacity: 0.5 }}>
                  {t('exoActionWindow.noWeapon')}
                </div>
              )}
              {exoDeclare.exoWeapons.map(w => {
                const isSelected = w.id === exoDeclare.selectedExoWeaponId
                const isCaC = w.ref_category === 'Arme de contact'
                // Vide = munitions suivies (ammo_remaining non NULL, §16.2.3) ET épuisées — même garde
                // que socketCombatAnnouncement.js:314 (hasEnoughAmmo, bulletCount toujours 1 pour une
                // exo, Tir Multi bloqué serveur). NULL = tracking désactivé, jamais grisé (mirroir
                // DroneWeaponPanel#isEmpty, seule fenêtre d'armement à griser une arme vide ce jour).
                const isEmpty = !isCaC && w.ammo_remaining != null && w.ammo_remaining <= 0
                // Mode de tir par défaut de l'arme (une exo ne bascule jamais de mode, §16.4) —
                // affiché à la place du libellé générique "Assaut (tir)" (demande Saar 2026-08-27) ;
                // même autorité de parsing que le gate PC23 serveur (shared/fireModes.js).
                const fireMode = isCaC ? null : (firstFireMode(w.ref_fire_mode) ?? t('actionLabels.assault'))
                return (
                  <div
                    key={w.id}
                    title={isEmpty ? t('exoActionWindow.emptyWeaponTitle') : undefined}
                    style={{
                      ...S.item, gridColumn: 'span 2',
                      ...(isSelected ? S.itemSelected : {}), ...(isEmpty ? S.itemDisabled : {}),
                    }}
                    onClick={() => !isEmpty && exoDeclare.selectWeapon(w.id)}
                  >
                    <span style={S.itemLabel}>{w.display_name}</span>
                    <span style={S.itemMod}>
                      {isCaC
                        ? t('actionLabels.melee')
                        : (w.ammo_remaining != null
                            ? `${fireMode} · ${t('exoActionWindow.ammoCount', { count: w.ammo_remaining })}`
                            : fireMode)}
                    </span>
                  </div>
                )
              })}
            </div>
            {exoDeclare.selectedExoWeaponId && (
              <div
                style={{ ...S.item, margin: '1px 6px' }}
                onClick={() => exoDeclare.handleChooseTarget(playerToken)}
              >
                <span style={{ ...S.itemLabel, ...(exoDeclare.assaultTargetId ? { color: '#5b8dee' } : {}) }}>
                  {exoDeclare.assaultTargetId
                    ? `→ ${tokens.find(tk => tk.id === exoDeclare.assaultTargetId)?.label ?? '?'}`
                    : t('common.chooseTargetButton')}
                </span>
                {exoDeclare.assaultTargetId && <span style={S.itemMod}>{t('common.changeButton')}</span>}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      <div className="combat-float-footer">
        <CombatDeclareErrorBanner />
        {moveSelection && (
          <div style={S.footerLeft}>
            <span style={S.destination}>[{moveSelection.targetPosX}, {moveSelection.targetPosY}]</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
          <CombatDeclareIniWidget
            currentInitiative={rosterEntry.initiative}
            delta={iniDelta}
            breakdown={iniBreakdown}
          />
          <button
            className="btn-tac"
            style={{ flex: 1, opacity: exoDeclare.canDeclare ? 1 : 0.4, cursor: exoDeclare.canDeclare ? 'pointer' : 'not-allowed' }}
            onClick={handleDeclare}
            disabled={isDeclaring || !exoDeclare.canDeclare}
          >
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
  // Mirroir W.leftPanel (CombatActionWindow.jsx:1546) — flex '0 0 <largeur fenêtre>' au lieu de 360,
  // seule valeur qui diffère (fenêtre exo = colonne unique 340px, jamais de rightPanel).
  panel: {
    flex: '0 0 340px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
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
