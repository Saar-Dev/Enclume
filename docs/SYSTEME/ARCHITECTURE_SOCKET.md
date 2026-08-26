SYSTEME/ARCHITECTURE_SOCKET.md — Architecture de communication temps réel

    Dernière mise à jour : 2026-07-18
    Lire pour : toute modification des flux WebSocket, du cycle de vie du socket, des hooks client ou des modules serveur.

1. Vue d'ensemble

La communication temps réel repose sur Socket.io. Le serveur expose un coordinateur léger (server/src/socket/index.js, 283 lignes au 2026-08-26 — corrigé, était ~140 lignes au moment du commit REWORK-08 d0ee0af d'origine, a grossi depuis avec la restauration combat_pending, Wizard et Catastrophe) qui délègue chaque domaine à un module dédié. Côté client, un SocketProvider React fournit le socket via Contexte, et des hooks spécialisés consomment ce socket.
text

Serveur :
index.js (coordinateur)
 ├── socketToken.js         — TOKEN_MOVE, TOKEN_ROTATE, TOKEN_SET_ROTATION, TOKEN_STATUS_TOGGLE
 ├── socketDice.js          — DICE_ROLL, MACRO_ROLL, CHAT_MESSAGE, CHARACTER_UPDATED
 ├── socketEntity.js        — ENTITY_ACTION_REQUEST, ENTITY_ACTION_RESOLVE, ENTITY_ACTION_GM_DIRECT,
 │                            ENTITY_CREATED, ENTITY_DELETED, ENTITY_MOVED, ENTITY_MOVE_REQUEST
 ├── socketCombat.js        — orchestrateur combat (9 lignes)
 │   ├── socketCombatState.js       — COMBAT_START, COMBAT_END, COMBAT_ANNOUNCE_START, COMBAT_INIT_STATE, COMBAT_SURPRISE_RESULT
 │   ├── socketCombatAnnouncement.js— COMBAT_ACTION_DECLARE, COMBAT_SKIP_PLAYER, COMBAT_ANNOUNCE_PREVIEW
 │   ├── socketCombatResolution.js  — COMBAT_ACTION_CONFIRM, COMBAT_DAMAGE_CONFIRM, COMBAT_MELEE_DEFENSE_CONFIRM,
 │   │                                COMBAT_STUN_CONFIRM, COMBAT_APPLY_STUN, COMBAT_ACTION_PRECHECK
 │   └── socketCombatHelpers.js     — resolveMeleeAction, resolveAssaultAction, resolveDroneAssaultAction, etc.
 ├── socketTrade.js         — TRADE_*
 ├── socketWizard.js        — WIZARD_* (registerWizardHandlers, index.js:254)
 └── socketCatastrophe.js   — Catastrophe (registerCatastropheHandlers, index.js:260) — les deux absents du reste de ce document jusqu'à cette correction

**Corrigé (audit 2026-08-26) — pas une dette de modularisation, un vide fonctionnel** : les handlers
VOXEL_ADD/REMOVE/UPDATE et MAP_SWITCH/MAP_VIEWPORT ne sont ni dans un module dédié ni "encore inline
dans index.js" comme l'affirmait ce document — ils ont été **entièrement supprimés** au commit
`d0ee0af` (destruction du système voxel terrain, remplacé par le builder Kiwi) et jamais recréés.
Zéro occurrence dans tout `server/src/socket/`. Le client, lui, **continue d'émettre** ces événements
(`Editor3D.jsx` pour VOXEL_*, `useBattlemapManager.js` pour MAP_SWITCH) — ce sont des émissions no-op
silencieuses en production. Ticket créé (`bug_tickets`, cluster `AUDIT-SYSTEME`).

Client :
SocketProvider (créé dans SessionPage)
 ├── useTokenSocket()        — écoute TOKEN_MOVED, TOKEN_CREATED, TOKEN_DELETED, TOKEN_UPDATED, TOKEN_STATUS_UPDATED
 ├── useEntitySocket()       — écoute MAP_SWITCH, ENTITY_ACTION_PENDING, ENTITY_ACTION_RESULT, ENTITY_MOVE_RESULT
 ├── useCombatSocket()       — écoute les 18 événements COMBAT_* ; expose 12 états UI (reloadResult, damagePayload, etc.)
 ├── useSessionSocket()      — écoute SESSION_*, CHAT_MESSAGE, DICE_RESULT, MACRO_ROLL_RESULT, DOC_*, 'error'
 ├── useCharacterSocket()    — écoute WOUND_ADDED/UPDATED/REMOVED, INVENTORY_ADDED/UPDATED/REMOVED,
 │                            SOLS_UPDATED, GAUGE_UPDATED ; expose woundVersions
 └── useCombatUIState()      — état UI combat sans socket : combatMoveMode, combatTargetMode, etc.

2. Point d'entrée serveur

server/src/socket/index.js est la seule fonction exportée initSocket(io). Elle :

    Applique le middleware socketAuth.

    Écoute les connexions.

    Sur SESSION_JOIN :

        Vérifie l'appartenance à la campagne.

        Définit socket.campaignId, socket.role, socket.data.userId, socket.data.role.

        Rejoint la room Socket.io.

        Émet SESSION_JOINED + SESSION_USER_JOINED.

        Synchronise l'état combat (COMBAT_STATE_SYNC) et restaure les éventuels prompts combat_pending (REWORK-04).

        Construit un objet context = { campaignId, user: socket.user, isGm: socket.role === 'gm' }.

        Appelle tous les register* (token, dice, entity, combat, trade) en leur passant io, socket et context (et pendingEntityActions pour entity, pendingMaps pour combat).

    Le handler disconnect est enregistré à l'intérieur de SESSION_JOIN, après les appels register*.

Important — **corrigé (audit 2026-08-26)** : il n'y a pas de module socketVoxel.js, mais ce n'est
plus parce que ces handlers "résident encore dans index.js" — ils ont été supprimés au commit
`d0ee0af` et n'existent nulle part côté serveur aujourd'hui, alors que le client les émet toujours
(voir §2 ci-dessus, ticket `bug_tickets`/`AUDIT-SYSTEME`). Si vous devez toucher VOXEL_*/MAP_SWITCH,
vérifiez d'abord si un handler doit être recréé ou si l'émission client doit être retirée comme code
mort — ne partez pas du principe qu'un handler existe déjà quelque part.
3. Maps globales persistantes

Déclarées hors initSocket pour être partagées entre toutes les connexions :
js

const pendingEntityActions = new Map()  // timeout 60s, nettoyé à la résolution
const combatTimers       = new Map()    // timers d'annonce (in-memory, perdu au restart)
const combatPreviews     = new Map()    // previews d'annonce éphémères

Les anciennes Maps pendingMeleeDefense, pendingDamageActions et pendingStunActions ont été supprimées (REWORK-04). L'état bloquant est désormais persisté dans la table combat_pending et restauré au SESSION_JOIN.
4. Modules serveur

Chaque module exporte une fonction register* :
js

registerTokenHandlers(io, socket, context)
registerDiceHandlers(io, socket, context)
registerEntityHandlers(io, socket, context, pendingEntityActions)
registerCombatHandlers(io, socket, context, pendingMaps)
registerTradeHandlers(io, socket, context)

Règles :

    context contient { campaignId, user, isGm }.

    Toute référence à socket.campaignId dans les handlers est remplacée par campaignId du contexte.

    Toute référence à socket.user.id est remplacée par user.id.

    Les guards if (!campaignId) restent présents mais sont théoriquement inutiles (handlers enregistrés après SESSION_JOIN). Ne les supprimez pas sauf rework dédié.

    pendingMaps pour le combat est un objet { combatTimers, combatPreviews }.

Piège [R8-8] : Ne jamais se repérer aux numéros de ligne pour localiser un handler. Utiliser le nom d'événement (socket.on(WS.XXX, ...)).

Piège [R8-11] : Si SESSION_JOIN est émis deux fois sur le même socket (reconnexion), les register* enregistrent les listeners en double → double DB write. Mitigation côté client : le socket est détruit au démontage.
5. SocketProvider client

client/src/lib/SocketContext.jsx :
jsx

<SocketProvider campaignId={campaignId}>
  <SessionContent />
</SocketProvider>

    Crée le socket avec io(url, { withCredentials: true }).

    Sur l'événement connect (connexion initiale ET reconnexion automatique), émet SESSION_JOIN.

    Le socket est stocké dans un état useState, puis fourni via useSocket().

    useSocket() retourne null tant que le socket n'est pas prêt.

6. Hooks socket client

Chaque hook suit ce pattern :
js

export function useMonHook() {
  const socket = useSocket()
  // ... états et stores nécessaires ...
  useEffect(() => {
    if (!socket) return
    const onX = (...) => { ... }
    socket.on(WS.X, onX)
    return () => { socket.off(WS.X, onX) }
  }, [socket])
}

Obligatoire : les handlers sont nommés (const onX = ...) pour permettre un cleanup ciblé. socket.off(WS.X) sans handler supprimerait TOUS les listeners de cet événement.

Piège P3 — **corrigé (audit 2026-08-26), ce document se trompait, `docs/SYSTEME/REACT.md` a la bonne
version** : `socket` n'est **pas** stable (`SocketProvider` crée une nouvelle instance à chaque
reconnexion) — `socket` **doit** rester dans les dépendances de tout `useCallback`/`useEffect` qui
émet ou écoute. Vérifié dans le code réel : `handleEntityActionResolve`, `handleTokenSetRotation`,
`handleSurpriseRolled` (`SessionPage.jsx:561-575`) incluent tous `[socket]`. Ne pas retirer `socket`
d'un tableau de dépendances sous prétexte de ce piège — l'inverse causerait une régression
(callback figé sur un ancien socket après reconnexion).
7. Ordre d'enregistrement client

Dans SessionContent, l'ordre est contraint :

    useTokenSocket()

    useEntitySocket({ setRadialMenu, setMoveTarget })

    useSessionSocket()

    useCharacterSocket()

    useCombatUIState() — après useEntitySocket (dépend de entitySocket.moveTarget)

    useCombatSocket({ isGm, setMode, onModeReset }) — après useCombatUIState (dépend de combatMoveMode)

Violer cet ordre provoque des erreurs TDZ ou des références à des callbacks non encore définis.
8. État actuel et dettes

    socketVoxel.js n'existe pas — corrigé (audit 2026-08-26) : pas parce que les handlers sont
    encore inline dans index.js, mais parce qu'ils ont été supprimés (voir §2/§3 ci-dessus). Le
    client émet toujours ces événements dans le vide — ticket bug_tickets/AUDIT-SYSTEME.

    CORE.md liste les événements WS actifs mais omet plusieurs domaines entiers présents ici
    (Wizard, Catastrophe) — à recouper si ce document est retouché.

    socketTrade.js existe mais n'a pas suivi le même pattern de modularisation fine ; son contenu est plus monolithique.

    Les anciens modules pendingMeleeDefense / pendingDamageActions / pendingStunActions ont été supprimés.

    Le module combatFSM.js est documenté séparément dans SYSTEME/FSM_COMBAT.md.

Document généré depuis ARCHI_REWORK_DONE.md (REWORK-08, REWORK-09, REWORK-15, REWORK-11, REWORK-12, REWORK-14, REWORK-17).