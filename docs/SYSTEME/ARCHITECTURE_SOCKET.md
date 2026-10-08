SYSTEME/ARCHITECTURE_SOCKET.md — Architecture de communication temps réel

    Dernière mise à jour : 2026-10-08 (SOCKET-STRICTMODE-RECONNECT-HANG, ticket bug_tickets
    9f6c2a6e) — SocketContext.jsx recréait un socket neuf (io(...)) à CHAQUE montage de
    SocketProvider ; sous StrictMode (toujours actif en dev, main.jsx), l'effet montait deux fois
    de suite (connect → disconnect → connect, mêmes deps) et la 2ᵉ connexion arrivait parfois sur
    une session engine.io déjà fermée côté serveur (400 Bad Request / upgrade WebSocket refusé,
    observé en journal réseau). Corrigé selon le patron officiel socket.io (how-to/use-with-react) :
    un seul Socket/Manager créé HORS du composant (module-level, `autoConnect: false`), l'effet ne
    fait plus que connect()/disconnect() sur ce même objet. Conséquence : `socket` (valeur de
    useSocket()) est désormais STABLE pour toute la durée de l'onglet — les sections 5/6/Piège P3
    ci-dessous sont corrigées en consequence. N'a pas résolu, à lui seul, un trou de chargement de
    20-40 s par ailleurs observé (cause externe au code suspectée, voir le ticket).
    Dernière mise à jour précédente : 2026-10-04 — CHAR_XP_UPDATED/CHAR_ATTRIBUTES_UPDATED/CHAR_SKILLS_UPDATED/
    CHAR_CHC_UPDATED/CHAR_IDENTITY_UPDATED/CHAR_ARCHETYPE_UPDATED/CHAR_ADVANTAGE_ADDED/REMOVED/
    CHAR_ADVANTAGE_NOTE_ADDED/REMOVED/CHAR_MUTATIONS_UPDATED ajoutés (CHARSHEET-XP-SYNC-PJMJ) : 15
    routes de char-sheet.js (identité, archétype, attributs, achat PC, compétences, Pouvoirs Polaris,
    achat compétence, Chance, XP, avantages, notes, mutations) n'émettaient rien — un MJ et un joueur
    sur la même fiche en même temps voyaient des valeurs différentes jusqu'à rouvrir la fenêtre. Voir
    §1bis ci-dessous pour le détail (payload direct, pas un signal+refetch).
    MAP_UPDATED ajouté (MAP-UPDATE-NOT-PROPAGATED-TO-PLAYERS) :
    PUT /:id/surface, /:id/voxels et /:id (battlemaps.js) n'émettaient rien du tout à la sauvegarde —
    un joueur déjà en session ne voyait une carte éditée qu'en rechargeant la page. Émis directement
    depuis la route REST (patron identique à WORLD_RUNTIME_UPDATED, pas de module socketXxx.js dédié),
    écouté par useEntitySocket.js (ignore si ce n'est pas la carte actuellement affichée).
    Audit de compréhension approfondie 2026-08-26 (suite) : référence à "SYSTEME/FSM_COMBAT.md"
    corrigée (fichier inexistant, la vraie doc de combatFSM.js vit dans SERVICES_COMBAT.md §6) ;
    double enregistrement spécial-casé de registerWizardHandlers (Coffre-native hors campagne +
    avant SESSION_JOINED) documenté, absent jusqu'ici ; comptage useCombatSocket corrigé (21, pas 18).
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
 ├── socketBattlemap.js     — MAP_SWITCH (registerBattlemapHandlers, index.js:256 — créé, voir correction ci-dessous)
 ├── socketTrade.js         — TRADE_*
 ├── socketWizard.js        — WIZARD_* (registerWizardHandlers — corrigé 2026-08-26, appelé à
 │                            index.js:63 ET :101, pas une seule fois à ":254", voir §2)
 └── socketCatastrophe.js   — Catastrophe (registerCatastropheHandlers, index.js:260) — les deux absents du reste de ce document jusqu'à cette correction

**Résolu (ticket `bug_tickets`/`AUDIT-SYSTEME`, corrigé après l'audit du 2026-08-26)** : les handlers
VOXEL_ADD/REMOVE/UPDATE et MAP_SWITCH/MAP_VIEWPORT avaient été **entièrement supprimés** au commit
`d0ee0af` (destruction du système voxel terrain, remplacé par le builder Kiwi) sans être recréés, alors
que le client continuait d'émettre — deux traitements distincts appliqués :
- **VOXEL_ADD/REMOVE/UPDATE** : l'unique émetteur (`EditorScene`, fonction locale à `Editor3D.jsx`)
  n'était lui-même jamais rendu dans l'arbre JSX (voir `docs/SYSTEME/EDITEUR.md` §1) — code mort des
  deux côtés. Supprimé côté client (fonction + helpers exclusifs + les 6 constantes `VOXEL_*` de
  `shared/events.js`), aucun handler serveur recréé : plus aucune trace nulle part.
- **MAP_SWITCH** : émetteur réel et atteignable (`useBattlemapManager.js:handleMapSwitch`, bouton GM
  "Déplacer le groupe") et auditeur client déjà en place (`useEntitySocket.js:onMapSwitch`) — seul le
  relai serveur manquait. Handler recréé dans `socketBattlemap.js` : vérifie `isGm` et l'appartenance
  du battlemap à la campagne, puis `socket.to(campaignId).emit(WS.MAP_SWITCH, ...)` (le GM a déjà
  rafraîchi sa propre vue via le GET REST de `handleMapSwitch` — patron identique à
  `WORLD_RUNTIME_UPDATED`, §7.1 `EDITEUR.md`).
- **MAP_VIEWPORT** : aucune émission trouvée nulle part, ni client ni serveur — pas un handler manquant,
  une constante déclarée et jamais utilisée. Rien à corriger côté code.

**MAP_UPDATED (ajouté 2026-10-04, MAP-UPDATE-NOT-PROPAGATED-TO-PLAYERS)** : `PUT /:id/surface`
mettait déjà à jour la base et le cache serveur du `WorldSnapshot` sans jamais notifier les clients
connectés — `/:id/voxels` et `PUT /:id` (métadonnées) avaient le même trou dans le même fichier.
Un seul point d'émission (`notifyMapUpdated(io, battlemap)`, `battlemaps.js`) appelé par les 3
routes plutôt que 3 appels `io.emit` recopiés — pour qu'une 4ᵉ route ajoutée plus tard ne puisse
pas reproduire le même oubli silencieusement. `useEntitySocket.js::onMapUpdated` ignore l'événement
si la carte concernée n'est pas celle actuellement affichée (elle sera à jour à son prochain
affichage, pas la peine de la pousser maintenant) ; sinon, même requête `GET /battlemaps/:id` que
`onMapSwitch`.

**Fiche personnage — identité/archétype/attributs/compétences/chc/xp/avantages/mutations (ajouté
2026-10-04, CHARSHEET-XP-SYNC-PJMJ)** : char-sheet.js n'émettait rien pour toutes les routes avant la
section Blessures (seules WOUND_*/INVENTORY_*/SOLS_UPDATED/GAUGE_UPDATED, déjà listées ci-dessous,
émettaient). Même cause que MAP_UPDATED (une partie d'un fichier diffusée, l'autre jamais) mais sur un
périmètre plus large : 15 routes au lieu de 3. Choix d'architecture délibérément différent de
MAP_UPDATED : des événements granulés avec le payload déjà calculé par la réponse REST de chaque
route (`notifyCharSheetEvent(io, characterId, campaignId, event, payload)`, `char-sheet.js`), jamais
un signal + refetch complet — cohérent avec SOLS_UPDATED/GAUGE_UPDATED/FATIGUE_TEST_RESULT déjà en
place dans ce même fichier, pas avec MAP_UPDATED (le `WorldSnapshot` est trop volumineux pour un
payload direct, raison absente ici ; un refetch complet aurait en plus écrasé un champ texte en
cours de frappe ailleurs sur la même fiche, debounce identité/attributs/chc/xp). Salle résolue via
`resolveInventoryBroadcastRoom` (réutilisée telle quelle, `lib/inventoryBroadcast.js`) : brouillon
Wizard → `wizard:<sheetId>`, personnage fini → `campaign_id`, Coffre → aucune diffusion — même
invariant de confidentialité que l'inventaire (COFFRE-INVROOM1), pas vérifié par le premier jet du
correctif, retrouvé en relisant ce fichier avant de coder. Écouté par deux endroits distincts, pas
`useCharacterSocket.js` : `CharacterSheet.jsx` (identité/archétype/attributs/compétences/chc/xp/
avantages — état local du composant, pas le store `characterStore`) et `AdvantagesPanel.jsx` (sa
propre copie locale de `charMutations`/`advantageNotes`, déjà dupliquée avec celle de
`CharacterSheet.jsx` avant ce correctif — pas une duplication introduite ici, les deux copies
préexistantes reçoivent chacune leur propre écoute). `CHAR_MUTATIONS_UPDATED` est un signal seul
(pas de valeur) : il rappelle `CharacterSheet.jsx::handleMutationsChanged`, déjà existant.
Hors périmètre, noté sans être corrigé : `PossessionNotes.jsx` (notes de possession pendant le
Wizard, catégorie `possession`) n'a aucune écoute socket — gap côté collaboration Wizard, chantier
distinct et déjà clos séparément (`docs/Old/PLAN_WIZARDCOLLAB.md`), pas élargi ici sans demande.

Client :
SocketProvider (créé dans SessionPage)
 ├── useTokenSocket()        — écoute TOKEN_MOVED, TOKEN_CREATED, TOKEN_DELETED, TOKEN_UPDATED, TOKEN_STATUS_UPDATED
 ├── useEntitySocket()       — écoute MAP_SWITCH, MAP_UPDATED, ENTITY_ACTION_PENDING, ENTITY_ACTION_RESULT, ENTITY_MOVE_RESULT
 ├── useCombatSocket()       — écoute 21 événements COMBAT_* (corrigé 2026-08-26, comptage réel
 │                            `socket.on(WS...)`, était 18) ; expose des états UI (reloadResult,
 │                            damagePayload, etc.)
 ├── useSessionSocket()      — écoute SESSION_*, CHAT_MESSAGE, DICE_RESULT, MACRO_ROLL_RESULT, DOC_*, 'error'
 ├── useCharacterSocket()    — écoute WOUND_ADDED/UPDATED/REMOVED, INVENTORY_ADDED/UPDATED/REMOVED,
 │                            SOLS_UPDATED, GAUGE_UPDATED ; expose woundVersions
 ├── CharacterSheet.jsx (écoute locale, pas un hook partagé) — CHAR_XP_UPDATED, CHAR_ATTRIBUTES_UPDATED,
 │                            CHAR_SKILLS_UPDATED, CHAR_CHC_UPDATED, CHAR_IDENTITY_UPDATED,
 │                            CHAR_ARCHETYPE_UPDATED, CHAR_ADVANTAGE_ADDED/REMOVED, CHAR_MUTATIONS_UPDATED
 ├── AdvantagesPanel.jsx (écoute locale) — CHAR_MUTATIONS_UPDATED (sa propre copie), CHAR_ADVANTAGE_NOTE_ADDED/REMOVED
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

        Appelle tous les register* (token, battlemap, dice, entity, combat, trade) en leur passant io, socket et context (et pendingEntityActions pour entity, pendingMaps pour combat).

    Le handler disconnect est enregistré à l'intérieur de SESSION_JOIN, après les appels register*.

**Ajouté (audit 2026-08-26) — `registerWizardHandlers` est spécial-casé, deux fois, pas dans le lot
`register*` générique décrit ci-dessus :**
- **Sans `campaignId`** (`index.js:62-73`, création Coffre-native `/vault/creation`, aucune campagne) :
  branche dédiée qui retourne avant tout le reste — `registerWizardHandlers` posé avec
  `campaignId: null`, plus `registerDiceRollHandler` **seul** (pas `registerDiceHandlers` en entier)
  pour que les jets 1D10/1D100 de l'étape Avantages & Revers fonctionnent hors campagne (bug réel
  corrigé, `docs/EN_COURS.md` WIZ28 — sans ce handler ciblé, `DICE_ROLL` partait dans le vide).
- **Avec `campaignId`** (`index.js:101`) : posé délibérément **avant** l'émission de `SESSION_JOINED`,
  alors que tous les autres `register*` restent après (§ci-dessous) — sinon une fenêtre réelle existe
  où `WIZARD_JOIN`/`WIZARD_LOCK_UPDATE` arrivent avant que le serveur ait un listener, verrous MJ
  inertes en silence (bug réel trouvé en test navigateur, `docs/PLAN_WIZARDCOLLAB.md`).

Il n'y a pas de module socketVoxel.js — **plus aucun événement `VOXEL_*` n'existe nulle part dans le
code** (client et serveur, résolu ticket `bug_tickets`/`AUDIT-SYSTEME`, voir §2 ci-dessus) : pas une
dette de modularisation, rien à modulariser. `socketBattlemap.js` existe en revanche depuis cette même
correction, pour `MAP_SWITCH`.
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

Piège [R8-11] : Si SESSION_JOIN est émis deux fois sur le même socket (reconnexion), les register* enregistrent les listeners en double → double DB write. Mitigation côté client — corrigée 2026-10-08 (SOCKET-STRICTMODE-RECONNECT-HANG) : le socket n'est plus détruit au démontage (il est désormais un singleton module-level, réutilisé pour toute la durée de l'onglet) ; la protection vient maintenant du retrait explicite des handlers nommés (`socket.off('connect', handleConnect)` etc.) dans le nettoyage de l'effet avant tout nouveau `socket.connect()`, sur ce même objet.
5. SocketProvider client

client/src/lib/SocketContext.jsx :
jsx

<SocketProvider campaignId={campaignId}>
  <SessionContent />
</SocketProvider>

    Crée le socket UNE SEULE FOIS, hors du composant (module-level, io(url, { withCredentials: true,
    autoConnect: false })) — corrigé 2026-10-08, voir l'en-tête de ce document. L'effet de
    SocketProvider appelle connect()/disconnect() sur ce même objet à chaque montage/démontage ou
    changement de campaignId/context ; il n'en crée plus jamais un nouveau.

    Sur l'événement connect (connexion initiale ET reconnexion automatique), émet SESSION_JOIN.

    Le socket (la référence stable, pas un état) est fourni via useSocket().

    useSocket() ne retourne jamais null À L'INTÉRIEUR d'un SocketProvider (le socket existe dès le
    premier rendu, avant même le premier connect()) — il retourne le `null` par défaut du Contexte
    seulement pour un composant rendu HORS de tout SocketProvider. Le signal « prêt à émettre des
    événements de domaine » reste useSocketReady() (passe à true sur SESSION_JOINED), jamais la
    simple non-nullité du socket.

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

Piège P3 — **mis à jour 2026-10-08 (SOCKET-STRICTMODE-RECONNECT-HANG)** : avant cette date, `socket`
n'était pas stable (`SocketProvider` créait une nouvelle instance à chaque reconnexion), d'où
l'exigence stricte de garder `socket` dans les dépendances. Depuis le correctif, `socket` est un
singleton module-level qui ne change plus JAMAIS de référence, même après reconnexion — cette raison
précise n'existe plus. **Garder `[socket]` dans les dépendances reste sans risque** (un singleton
stable dans un tableau de deps ne redéclenche simplement jamais l'effet pour cette raison) et évite
de réécrire 20+ fichiers sans bénéfice ; ne pas le retirer par souci de « nettoyage » — mais ne plus
invoquer l'ancienne justification (« callback figé après reconnexion ») si la question revient, elle
ne s'applique plus.
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

    socketVoxel.js n'existe pas et n'a plus lieu d'exister — plus aucun événement VOXEL_* nulle part
    dans le code (résolu, ticket bug_tickets/AUDIT-SYSTEME, voir §2/§3 ci-dessus).

    CORE.md liste les événements WS actifs mais omet plusieurs domaines entiers présents ici
    (Wizard, Catastrophe) — à recouper si ce document est retouché.

    socketTrade.js existe mais n'a pas suivi le même pattern de modularisation fine ; son contenu est plus monolithique.

    Les anciens modules pendingMeleeDefense / pendingDamageActions / pendingStunActions ont été supprimés.

    Le module combatFSM.js est documenté séparément dans SYSTEME/SERVICES_COMBAT.md §6 — corrigé
    2026-08-26, citait "SYSTEME/FSM_COMBAT.md", fichier qui n'existe pas (vérifié : aucun fichier
    docs/SYSTEME/*FSM* sur le disque).

Document généré depuis ARCHI_REWORK_DONE.md (REWORK-08, REWORK-09, REWORK-15, REWORK-11, REWORK-12, REWORK-14, REWORK-17).