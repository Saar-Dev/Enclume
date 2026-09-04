import { useEffect, useState, useReducer } from 'react'
import { useTranslation } from 'react-i18next'
import { WS } from '../../../shared/events.js'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'
import { useAutoMoveMode } from '../lib/useAutoMoveMode.js'
import { useExoDeclare } from '../lib/useExoDeclare.js'
import { useDraggable } from '../lib/useDraggable.js'
import { calcIniDelta, calcIniBreakdown } from './combatSections.js'
import CombatDeclareErrorBanner from './CombatDeclareErrorBanner.jsx'
import CombatDeclareFooter from './CombatDeclareFooter.jsx'
import CombatDeclareStatePanel from './CombatDeclareStatePanel.jsx'
import CombatDeclareHeader from './CombatDeclareHeader.jsx'
import CombatDeclareActionList from './CombatDeclareActionList.jsx'
import { buildWeaponList } from '../lib/weaponList.js'
import { declarationReducer, DECLARATION_INITIAL, snapFromRosterEntry } from '../lib/declarationReducer.js'
import { assaultCheck, buildBlockReason } from '../lib/declareChecks.js'
import { isAoeWeapon } from '../../../shared/combatAoe.js'
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
  battlemapId, onEnterTargetMode, onEnterAoeTargetMode,
  registerAmbientAttackHandler, showTargetRecap,
}) {
  const { t } = useTranslation('combat')
  const { roster, phase, activeTokenId } = useCombatStore()
  const tokens = useTokenStore(s => s.tokens)
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

  // État tactique (posture / vitesse / arme) — satellite d'état, module 3. L'exo réutilise le
  // reducer partagé (declarationReducer) et `snapFromRosterEntry` comme le PJ/MJ ; handleDeclare
  // repasse `state: {position, weapon, vitesse}` (passe-plat, pas d'assemblage — pas de fonction
  // pure neuve). Le gate « pas d'attaque avec arme rangée » côté exo est traité au module 4.
  const [decl, dispatch] = useReducer(declarationReducer, DECLARATION_INITIAL)
  // Snapshot de l'état persisté au début du tour. Pas de ref à figer comme le PJ : l'exo n'émet
  // aucun aperçu et son `rosterEntry.state_*` ne bouge pas pendant la phase ANNONCE de son tour
  // (il change à la résolution, où `has_announced` bascule et la fenêtre disparaît).
  const initialStates = snapFromRosterEntry(rosterEntry)

  // COMBAT_DECLARE_ERROR : écouté par useCombatSocket (hook central) → sessionStore →
  // <CombatDeclareErrorBanner>. Plus de socket.on local (REACT.md P57, module 3).
  // Plus de verrou d'envoi « ENVOI… » (`isDeclaring`) — module 5 (§5.10) : l'exo était la seule
  // fenêtre à en avoir un ; le garde serveur `has_announced === false` est idempotent (un
  // double-clic sur DÉCLARER émet 2 fois, la 2ᵉ est rejetée), PJ/MJ n'en ont pas et n'ont aucun
  // problème.

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
    dispatch({ type: 'RESET', payload: snapFromRosterEntry(rosterEntry) })
  }, [rosterEntry?.token_id, rosterEntry?.has_announced])  // eslint-disable-line react-hooks/exhaustive-deps

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
    onEnterAoeTargetMode,
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
    if (!socket) return
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
    if (!socket || !exoDeclare.canDeclare) return
    socket.emit(WS.COMBAT_ACTION_DECLARE, {
      tokenId: playerToken.id,
      // Passe-plat des 3 axes du satellite (module 3). Identiques aux valeurs persistées tant que
      // le joueur n'a rien changé → le serveur ré-écrit la même chose (state.X ?? entry.state_X).
      state: { position: decl.position, weapon: decl.weapon, vitesse: decl.vitesse },
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

  // Initiative projetée (pastille du pied). Le déplacement + les transitions d'état déclarées au
  // satellite (posture / arme / vitesse, module 3) pèsent — `initialStates` vs `decl`.
  const exoMapActions = { move: moveSelection ? { ini_mod: moveSelection.ini_mod ?? 0 } : null }
  const iniDelta     = calcIniDelta(initialStates, decl, exoMapActions, null)
  const iniBreakdown = calcIniBreakdown(initialStates, decl, exoMapActions, null, t)

  // Pied unifié (module 5). L'exo n'a qu'un seul motif de blocage : arme sélectionnée sans cible.
  const exoAttack = assaultCheck({
    started:       !!exoDeclare.selectedExoWeaponId,
    hasWeapon:     !!exoDeclare.selectedExoWeaponId,
    // aoeDirection compte comme cible remplie (Segment 2a AOE) — hasVariant/aimActive restent
    // inconditionnellement true/false ci-dessous, PAS le bug du Segment 1 (assaultCheckInputs
    // humanoïde) : ici les deux sont déjà des constantes, jamais dérivées d'un état de mode de tir
    // qui existerait pour une exo (elle n'en a aucun).
    targetsFilled: (exoDeclare.assaultTargetId || exoDeclare.aoeDirection != null) ? 1 : 0,
    targetsNeeded: 1,
    hasVariant:    true,   // mode de tir exo fixe, jamais à configurer
    aimActive:     false,  // pas de Tir visé pour une exo
  })
  const hasCompleteAction = exoDeclare.canDeclareAttack || moveSelection != null

  // Liste d'armes groupée (module 4, D5) — une exo n'a ni mains nues ni dual-wield.
  const exoWeaponGroups = buildWeaponList({
    rangedWeapons: exoDeclare.exoWeapons.filter(w => w.ref_category !== 'Arme de contact'),
    meleeWeapons:  exoDeclare.exoWeapons.filter(w => w.ref_category === 'Arme de contact'),
    includeBareHands: false,
  })
  const selectedExoWeapon = exoDeclare.exoWeapons.find(w => w.id === exoDeclare.selectedExoWeaponId) ?? null
  const exoExpanded = !isProne && !!exoDeclare.selectedExoWeaponId
  // Zone d'effet (Segment 2a AOE, PLAN_ARMES_SPECIALES.md §1.4bis) — même autorité que côté humanoïde
  // (shared/combatAoe.js#isAoeWeapon, donnée catalogue ref_aoe_profile). Une arme éligible bascule
  // toute la section cible sur « Viser une zone » au lieu de « Choisir une cible » — même principe que
  // AssaultRangedPanel.jsx (pas un choix parmi d'autres, l'arme n'a pas de mode de tir normal).
  const isAoeEligible = isAoeWeapon(selectedExoWeapon?.ref_aoe_profile)

  return (
    <>
      <CombatDeclareStatePanel
        pos={pos}
        windowWidth={340}
        family="exo"
        isNew
        decl={decl}
        initial={initialStates}
        onChange={(axis, value) => dispatch({ type: 'SET_FIELD', key: axis, value })}
        axes={isProne ? ['position'] : ['position', 'vitesse', 'weapon']}
        onPositionClick={isProne ? handleStandUp : null}
        hidden={isSelectingOnMap}
      />
    <div className="combat-float-win" data-decl data-family="exo"
      data-narrow={!exoExpanded || undefined}
      style={{
      position: 'fixed', width: exoExpanded ? 560 : 340, left: pos.left, top: pos.top, maxHeight: 'calc(100vh - 80px)',
      opacity: isSelectingOnMap ? 0 : 1, pointerEvents: isSelectingOnMap ? 'none' : 'auto',
    }}>
      <CombatDeclareHeader
        name={playerToken.label ?? playerChar.name}
        declared={roster.filter(r => r.has_announced).length}
        total={roster.length}
        onMouseDown={onHeaderMouseDown}
      />

      <div className="combat-win-body">
        <div className="decl-col1">
          <div style={S.hint}>{isProne ? t('exoActionWindow.proneHint') : t('exoActionWindow.normalHint')}</div>

          {/* À terre : « Tenter de se relever » vit sur la puce Posture du satellite (module 3). Sinon :
              move-line + liste d'armes groupée (module 4, D5) — une seule arme, pas de dual-wield exo. */}
          {!isProne && (
            <CombatDeclareActionList
              move={{
                on: !!moveSelection,
                disabled: allures === null,
                valueLabel: moveSelection ? `${moveSelection.ini_mod}` : t('declareList.moveDefine'),
                tooltip: t('mapActions.move.tooltip'),
                onToggle: handleZoneSelectClick,
              }}
              groups={exoWeaponGroups}
              selectedRowId={exoDeclare.selectedExoWeaponId}
              onPick={row => { if (!row.disabled) exoDeclare.selectWeapon(row.id) }}
            />
          )}
          {!isProne && exoDeclare.exoWeapons.length === 0 && (
            <div style={{ ...S.itemLabel, padding: '6px 12px', opacity: 0.5 }}>{t('exoActionWindow.noWeapon')}</div>
          )}
          {alluresError && !isProne && (
            <div style={S.errorBanner}>⚠ {t('exoActionWindow.movementUnavailable', { reason: alluresError })}</div>
          )}
        </div>

        {/* Colonne 2 — détail de l'arme choisie (D6). Minimale pour une exo : cible + rappel « 1 attaque / Tour ». */}
        {exoExpanded && (
          <div className="decl-col2">
            <div className="decl-c2head">
              <span className="decl-c2head__arw">→</span> {selectedExoWeapon?.display_name}
            </div>
            {isAoeEligible ? (
              <div className="decl-c2sec">
                <div className="decl-c2sec__title">
                  <span className="decl-inline-glyph" style={{ '--glyph': 'url(/assets/status/target.svg)' }} />
                  {t('assaultPanel.aoeSection')}
                </div>
                {exoDeclare.aoeDirection != null ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{t('assaultPanel.aoeDirectionValue', { deg: Math.round(exoDeclare.aoeDirection) })}</span>
                    <button type="button" className="btn-tac-ghost" onClick={exoDeclare.handleStartAoeDirection}>
                      {t('common.changeButton')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-tac-ghost"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={exoDeclare.handleStartAoeDirection}
                  >
                    {t('assaultPanel.aimAoeButton')}
                  </button>
                )}
              </div>
            ) : (
              <div className="decl-c2sec">
                <div className="decl-c2sec__title">
                  <span className="decl-inline-glyph" style={{ '--glyph': 'url(/assets/status/target.svg)' }} />
                  {t('common.targetSection')}
                </div>
                <button
                  type="button"
                  className="btn-tac-ghost"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => exoDeclare.handleChooseTarget(playerToken)}
                >
                  {exoDeclare.assaultTargetId
                    ? `${tokens.find(tk => tk.id === exoDeclare.assaultTargetId)?.label ?? '?'} · ${t('common.changeButton')}`
                    : t('common.chooseTargetButton')}
                </button>
              </div>
            )}
            <div className="decl-c2note">{t('exoActionWindow.singleAttackNote')}</div>
          </div>
        )}
      </div>

      <div className="combat-float-footer">
        <CombatDeclareErrorBanner />
        <CombatDeclareFooter
          currentInitiative={rosterEntry.initiative}
          iniDelta={iniDelta}
          iniBreakdown={iniBreakdown}
          hasCompleteAction={hasCompleteAction}
          canDeclare={exoDeclare.canDeclare}
          blockReason={buildBlockReason({ assault: exoAttack })}
          moveDestination={moveSelection ? { x: moveSelection.targetPosX, y: moveSelection.targetPosY } : null}
          onDeclare={handleDeclare}
          onPassTurn={() => socket?.emit(WS.COMBAT_ACTION_DECLARE, { tokenId: playerToken.id, state: {}, mapActions: {} })}
        />
      </div>
    </div>
    </>
  )
}

const S = {
  hint: {
    padding: '8px 12px 2px',
    fontSize: 11,
    color: 'var(--combat-field, #8a94a6)',
  },
  itemLabel: {
    fontSize: 11,
    color: 'var(--decl-text-dim, #5b5b7a)',
  },
  errorBanner: {
    fontSize: 10,
    color: 'var(--decl-danger, #c83030)',
    background: 'rgba(200,48,48,0.08)',
    border: '1px solid #c8303044',
    borderRadius: 3,
    padding: '4px 8px',
    margin: '4px 12px',
  },
}
