# ARCHI_REWORK.md — Reworks architecturaux
> ⚠️ **Journal de rework — valeur historique uniquement.**
> Ces fichiers décrivent les problèmes, alternatives et plans d'exécution des reworks.
> Pour la documentation canonique, voir :
> - `docs/SYSTEME/ARCHITECTURE_SOCKET.md` — architecture socket client/serveur
> - `docs/SYSTEME/SERVICES_COMBAT.md` — services métier combat

---

## Philosophie

Un **rework** n'est pas un correctif. C'est le remplacement complet d'un bloc fonctionnel par une implémentation propre, indépendante, et testable en isolation. Le reste du codebase n'apprend pas comment le bloc fonctionne — il l'appelle avec une interface minimale.

**Règle absolue pendant un rework :** le périmètre est figé dès la phase de planification. Aucune amélioration opportuniste. Aucun bug adjacent corrigé en passant. Un rework = un bloc = une PR.

**Déclencheurs légitimes d'un rework :**
- Le même bloc de code est dupliqué N ≥ 3 fois
- Un bug dans un flux bloque un flux logiquement indépendant (couplage accidentel)
- L'implémentation actuelle empêche d'ajouter une fonctionnalité sans risque de régression
- Le bloc est impossible à tester sans déclencher des effets de bord dans d'autres systèmes

---

## Conventions des modules de service

Toutes les fonctions exportées par un service respectent ces conventions sans exception.

**Signature standard :**
```js
async function verbNoun(io, db, campaignId, pendingMap, params)
// io          — instance Socket.io server (pour les broadcasts)
// db          — instance Knex (pour les queries)
// campaignId  — UUID string (scope de la room)
// pendingMap  — Map globale du handler concerné (passée par référence depuis index.js)
//               null si la fonction n'a pas besoin de pending state
// params      — objet destructuré, jamais de paramètres positionnels au-delà de 4
```

**Règles de retour :**
- Fonctions pures (calcul) → retournent un objet de résultat ou `null`
- Fonctions à effets (DB + WS) → retournent `void`, tous les effets passent par `io` et `db`
- Jamais de `throw` non catchée — les erreurs sont loggées et absorbées dans les fonctions à effets

**Règle protocole (interopérabilité multi-client) :**
Chaque `io.emit` ou `socket.emit` produit un payload documenté dans ce fichier. Aucun event n'est émis sans documentation de son payload. `shared/events.js` est le registre de tous les events — tout event non listé là n'existe pas.

**Règle types d'entité :**
Chaque module documente quels types d'entité il supporte : `humanoïde` / `drone` / `exo-armure (futur)`. Si un type n'est pas supporté, le module retourne `null` silencieusement (jamais d'erreur).
Source règle drone : MANUELSYSCOMBAT.md §7.6 — "Pas de Test de Choc. Pas de blessures résiduelles." → `statusService.applyStun` n'est jamais appelé pour un drone.

---

## Template obligatoire

Chaque rework ajouté à ce fichier respecte cette structure. Pas de section manquante.

```
### REWORK-XX — Titre court

**Problème** : description factuelle + preuves (fichier:ligne)
**État actuel** : localisation exacte du code existant
**Décision** : quelle architecture, pourquoi, alternatives écartées
**Interface cible** : signatures exactes des fonctions publiques
**Périmètre** : fichiers touchés / fichiers NON touchés (les deux)
**Plan** : étapes ordonnées, une par une, avec run à vide entre chaque
**Validation** : scénarios de test avec résultat attendu précis
**Definition of done** : checklist explicite — case à cocher
```

---

## Reworks achevés

> Specs complètes → [ARCHI_REWORK_DONE.md](ARCHI_REWORK_DONE.md)

**REWORK-01 ✅ Clos Session 96 — statusService (étourdissement)**
`server/src/lib/statusService.js` : `resolveShockTest` (pur D20, zéro DB) + `applyStun` (PJ → prompt interactif, PNJ → D6 auto). Découple le stun du flux dégâts — `COMBAT_DAMAGE_RESULT` n'est plus bloqué.

**REWORK-02 ✅ Clos Session 101 — damageService (résolution hit)**
`server/src/lib/damageService.js` : `resolveTargetHit` — loc+armure+résistance+sévérité+blessure+shock. 4 sites patché. `LOC_TABLE` déplacée dans `shared/armorConstants.js`. `resolveMeleeAction` (site 3) exclu définitivement.

**REWORK-03 ✅ Clos complet Session 97/109 — woundService**
`server/src/lib/woundService.js` : `applyWound` centralisée — 5 call sites WS + fix `worst_wound_severity` dans WOUND_ADDED. Scénarios validés Session 109 (confirmation Saar) : CaC PNJ auto ✓ / promotion cascade ✓ / ligne pleine ✓ / REST GM ✓.

**REWORK-05 ✅ Clos complet Session 99 — Panneaux d'action partagés**
`AssaultRangedPanel.jsx` + `MeleeCombatPanel.jsx` + `DroneWeaponPanel.jsx` + `DeclareLogContent`. `computeFireVariant` dans `combatSections.js`. Fix COM5 + CL2. P7 (tooltip `state_weapon`) → REWORK-06.

**REWORK-07 ✅ Clos complet Session 100 — socketUtils**
`server/src/lib/socketUtils.js` : `getUserColor` (6 sites) + `checkTokenOwnership` (4 sites) + suppression `LOC_TABLE_CONTACT`.

**REWORK-08 ✅ Clos complet Session 108 — Modularisation socket/index.js**
`server/src/socket/` découpé en 5 modules (`socketToken`, `socketVoxel`, `socketDice`, `socketEntity`, `socketCombat`) + `lib/mrTable.js`. `index.js` : 4 266 → 143 lignes. Pattern `registerXxxHandlers(io, socket, context[, pendingMaps])`. Spec complète → `ARCHI_REWORK_DONE.md`.

**REWORK-09 ✅ Clos Session 103 — SessionPage hooks WS dédiés**
`client/src/lib/useTokenSocket.js` + `useEntitySocket.js` + `useCombatSocket.js`. `SessionPage.jsx` : 1 509 → 1 296 lignes — useEffect socket réduit de 340L à ~100L. Spec complète → `ARCHI_REWORK_DONE.md`.

**REWORK-04 ✅ Clos complet Session 110/111 — FSM Combat (State Machine + DB persistence)**
`server/src/lib/combatFSM.js` créé. Migrations 80 (`combat_pending`) + 81 (`sub_phase`). Guards `canTransition` dans 10 handlers `socketCombat.js`. 3 Maps in-memory remplacées par DB. `statusService.applyStun` nettoyé. `combatStore.js` + `useCombatSocket.js` propagent `subPhase`. `SESSION_JOIN` restaure les prompts sur reconnexion RESOLUTION. Spec complète → `ARCHI_REWORK_DONE.md`.

**REWORK-10 ✅ Clos complet Session 106c — DeclareLogContent intégré Sidebar**
`DeclareLogContent` intégré dans le tab chat de `Sidebar.jsx` (haut zone messages, collapsible, GM + joueurs). Ancienne approche sidebar fixe gauche (`CombatDeclareLogSidebar`) abandonnée. Dead code `CombatDeclareLogSidebar` + classes `.cdl-window*` — nettoyage sprint futur.

**REWORK-06 ✅ Clos complet Session 113/114 — declarationReducer (déclaration combat)**
`client/src/lib/declarationReducer.js` créé — reducer pur, 6 actions (`SET_FIELD`, `SET_COMBAT_MODE`, `SET_QUICK`, `SELECT_ATTACK`, `RESET`, `RESET_NEW_TURN`). `CombatGmDeclareWindow.jsx` + `CombatActionWindow.jsx` : 3 useState chacun → 1 `useReducer` partagé. Auto-draw `SELECT_ATTACK` unifié. Mains nues par défaut (suppression auto-sélection). V1–V15 validés.

**REWORK-15 ✅ Clos complet Session 115 — SocketProvider (fondation architecture socket)**
`client/src/lib/SocketContext.jsx` créé — `SocketProvider` + `useSocket()`. `useTokenSocket` / `useEntitySocket` / `useCombatSocket` migrés — `listen(s)` anti-pattern supprimé. `SessionPage.jsx` splitté — `SessionPage` (wrapper) + `SessionContent`. `reconnectTrigger` supprimé — reconnexion native socket.io. V1–V7 validés.

**REWORK-12 ✅ Clos complet Session 116 — useCharacterSocket (blessures + inventaire)**
`client/src/lib/useCharacterSocket.js` créé — `useSocket()` + `useEffect([socket])` + 6 handlers nommés + cleanup. Asymétries préservées (`WOUND_ADDED` sans guard, `INVENTORY_*` sans `updateCharacter`). `woundVersions` useState + `updateCharacter` destructuring + `useEffect([socket])` WOUND/INVENTORY supprimés de `SessionContent`. V1–V8 validés.

**REWORK-13 ✅ Clos complet Session 115 suite 2 — useBattlemapManager + campaignStore**
`client/src/stores/campaignStore.js` créé (`setCampaign` + `updateCampaign` null-guard). `client/src/lib/useBattlemapManager.js` créé — 8 CRUD handlers + 7 useState + 1 useRef + outside-click useEffect + helpers `openRenameModal`/`openCreateModal`. `SessionContent` : 8 callbacks + 7 useState + 1 useRef + 1 useEffect supprimés ; `renameBattlemap`/`addBattlemap`/`removeBattlemap`/`updateCampaign` retirés des destructurings. Spec complète → `docs/PLAN_REWORK13.md`.

**REWORK-11 ✅ Clos complet Session 115 suite 2 — useSessionSocket (handlers session + chat + dés)**
`client/src/lib/useSessionSocket.js` créé — 12 handlers WS extraits de `SessionContent` (SESSION_*, CHAT_MESSAGE, DICE_RESULT, MACRO_ROLL_RESULT, CHARACTER_UPDATED, DOC_*). `lastDiceRoll` + `gmSocketError` gérés dans le hook. Asymétrie DICE_RESULT préservée (`skillLabel === undefined`). `useEffect([socket])` de SessionContent réduit à 6 handlers WOUND_*/INVENTORY_*. V1–V12 validés.

**REWORK-14 ✅ Clos complet Session 116 — useCombatUIState (combat UI state hook)**
`client/src/lib/useCombatUIState.js` créé — 4 `useState` + 6 `useCallback`. `combatMoveMode`, `combatTargetMode`, `pendingMoveSelection`, `combatCameraCenter` extraits de `SessionContent`. `handleModeReset` + 5 handlers supprimés de SessionContent (~60 lignes). Ordre P-R14-1 respecté : `useEntitySocket` → `useCombatUIState` → `useCombatSocket`. Hook UI pur — zéro socket, zéro store. `combatCameraCenter` non reset dans `handleModeReset` (comportement source préservé). V1–V13 validés.

**REWORK-16 ✅ Clos complet Session 116 suite — Combat Pre-validation Gate (ACK Socket.IO)**
`COMBAT_ACTION_PRECHECK: 'combat:action_precheck'` ajouté dans `shared/events.js`. Handler ACK dans `socketCombat.js` : FSM guard + range check CaC (allonge XOR humanoïde/drone). Fix `resolveMeleeAction` L.1699 `socket.emit` → `io.to(campaignId).emit`. Gate `precheckOk` dans `CombatOverlay.jsx` (`socket.timeout(5000)` + flag `cancelled`). Message rouge `error: true` + style `#e05252` dans `Sidebar.jsx`. 8 logs `[DBG-CAC]` supprimés. V1–V10, V12 validés — V11 Non testé (race condition LAN). Spec complète → `ARCHI_REWORK_DONE.md`.

**REWORK-17 ✅ Clos complet Session 117 — socketCombat.js modularisation**
`socketCombat.js` (3027L monolithe post-REWORK-16) découpé en 4 modules : `socketCombatState.js` (5 handlers — ROSTER+ANNOUNCEMENT), `socketCombatAnnouncement.js` (3 handlers — DECLARATION), `socketCombatResolution.js` (6 handlers — RESOLUTION+PRECHECK), `socketCombatHelpers.js` (13 fonctions + COMBAT_MODE_LABELS). `socketCombat.js` réduit à 9L (orchestrateur pur). `index.js` inchangé. Zéro changement logique — déménagement pur. V1–V13 validés. Spec complète → `docs/Old/PLAN_REWORK17.md`.

**REWORK-18 ⚠️ Clos partiel Session 119 — socketCombatHelpers.js : Effect Queue (séparation computation/émission)**
Pattern boardgame.io / Colyseus : `resolveMeleeAction`, `resolveDroneAssaultAction`, `resolveAssaultAction` — `socket` supprimé des 3 signatures. 30 émissions directes (`io.to().emit()` / `socket.emit()`) → descripteurs `{ to, event, data }` accumulés dans `const emissions = []`. `flushEmissions(io, socket, campaignId, emissions, preloadedSockets?)` créé dans `socketCombatResolution.js` — lookup `io.fetchSockets()` lazy (seulement si descripteur `to:'user'`). 4 call sites mis à jour. Services hors périmètre (`woundService`, `damageService`, `statusService`, `resolveDroneIntegrityLoss`) conservent `io` direct — régression ordering documentée (Bug RW18-1). `node --check` ×2 ✅. Spec complète → `docs/PLAN_REWORK18.md`. **⚠️ Partiel** : COMBAT_DAMAGE_CONFIRM bloqué par Bug RW17-1 (`calcDroneRD` non importée) — fix sprint suivant.

---

## Prochains reworks

> Reworks 11–14 identifiés Session 113 — audit merge-readiness complet de `SessionPage.jsx`.
> Déclencheur : fusion frontend imminente (confrère refond playground + éditeur).
> Objectif commun : extraire de `SessionPage` tout ce qui peut être importé indépendamment.
>
> **Session 113 — décision architecture** : REWORK-15 (`SocketProvider`) réalisé EN PREMIER.
> `listen(s)` est un anti-pattern documenté (Socket.io officiel). REWORK-11/12/13 construits sur cette fondation utilisent `useSocket()` dès le départ — pas de refonte en cascade.

| ID | Bloc | Problème | Ordre |
|---|---|---|---|
| ~~**REWORK-15**~~ ✅ | `SocketProvider` | Socket créé inline `SessionPage`, `listen(s)` anti-pattern, `socket` prop-drillé 8 composants, P3 partout, `reconnectTrigger` workaround. | **Clos Session 115** |
| ~~**REWORK-11**~~ ✅ | `useSessionSocket` | SESSION_*, CHAT_MESSAGE, DICE_RESULT, MACRO_ROLL_RESULT, CHARACTER_UPDATED, DOC_* encore inline dans `SessionPage.jsx`. | **Clos Session 115 suite 2** |
| ~~**REWORK-12**~~ ✅ | `useCharacterSocket` | WOUND_ADDED/UPDATED/REMOVED + INVENTORY_* inline dans `SessionPage.jsx`. `woundVersions` Map locale. | **Clos Session 116** |
| ~~**REWORK-13**~~ ✅ | `useBattlemapManager` + `campaignStore` | 8 handlers CRUD carte inline. `campaign` objet complet en `useState` local — pas de store, pas de hook. ⚠️ Plus complexe que REWORK-11 : les callbacks font REST + WS + mutations multi-store (ex: `handleMapSwitch` appelle `loadMap`). Dépendances en cascade (ordre P4). | ✅ Session 115 suite 2 — Étapes 1+2 (`campaignStore` + migration SessionContent) + Étapes 3+4 (`useBattlemapManager` — V1–V14 validés) |
| ~~**REWORK-14**~~ ✅ | `useCombatUIState` | `combatMoveMode`, `combatTargetMode`, `pendingMoveSelection`, `combatCameraCenter` en `useState` local — `CombatOverlay` reçoit 28 props dont 16 viennent de `SessionPage`. | **Clos Session 116** |

---

### REWORK-15 ✅ — SocketProvider (fondation architecture socket) — spec complète → ARCHI_REWORK_DONE.md

**Problème** :
Le socket est créé et géré inline dans `SessionPage.jsx` — 1 seul `useEffect` de ~140 lignes qui crée le socket, enregistre 20+ listeners, gère la reconnexion via un `useState reconnectTrigger` artificiel, et passe le socket en prop à 8 composants. Conséquences directes lues dans le code :

- `listen(s)` — anti-pattern officiel Socket.io : les hooks ne doivent pas recevoir le socket en paramètre, ils doivent y accéder via contexte. Les pros passent toujours le socket via un Provider React.
- `socket` prop-drillé à 8 composants (`Sidebar`, `Canvas3D`, `Editor3D`, `DroneWindow`, `DicePanel`, `TokenStatusPanel`, `EntityInstancePanel`, `CombatOverlay`) — couplage inutile, difficile à tracer.
- **P3** (CLAUDE.md) : tout `useCallback` qui émet via socket doit inclure `socket` dans ses deps — 10+ occurrences dans `SessionPage.jsx`. Avec un contexte, la référence est stable : P3 disparaît.
- `reconnectTrigger` useState (L.204) : workaround pour forcer la recréation du socket sur reconnexion. socket.io gère la reconnexion nativement via l'event `connect` — ce workaround est inutile.
- **Bloquant pour REWORK-11/12/13** : si ces hooks sont écrits avec `listen(s)`, ils devront être réécrits quand REWORK-15 arrivera. REWORK-15 en premier évite le travail en double.

Preuves :
- `const [socket, setSocket] = useState(null)` — `SessionPage.jsx` L.203
- `const [reconnectTrigger, setReconnectTrigger] = useState(0)` — `SessionPage.jsx` L.204
- `tokenSocket.listen(s)` + `entitySocket.listen(s)` + `combatSocket.listen(s)` — `SessionPage.jsx` L.392–394
- `socket={socket}` prop — 8 occurrences dans le JSX de `SessionPage.jsx`

**Décision** :
Architecture retenue : **React Context + Provider** — pattern officiel Socket.io pour React.

```
SocketProvider (crée et gère le socket — ~40 lignes)
  └── SessionContent (tout le reste — appelle useSocket())
        ├── useTokenSocket()     → useSocket() interne
        ├── useEntitySocket()    → useSocket() interne
        ├── useCombatSocket()    → useSocket() interne
        ├── useCharacterSocket() → useSocket() interne  (REWORK-12)
        └── composants           → useSocket() interne  (REWORK-11 à 14)
```

Alternatives écartées :
- **Singleton module** (`socketClient.js` exporté) — pas de cycle de vie React, pas de cleanup au démontage, ne fonctionne pas avec plusieurs campagnes.
- **Zustand store** contenant le socket — les sockets ne sont pas de la state sérialisable ; les stores Zustand sont pour la domain state, pas pour les ressources réseau.
- **Garder `listen(s)`** et ajouter un Provider qui l'appelle — hybride incohérent, résout le prop drilling mais pas l'anti-pattern.

**Interface cible** :

```js
// client/src/lib/SocketContext.jsx

import { createContext, useContext, useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { WS } from '../../../shared/events.js'

const SocketContext = createContext(null)

export function SocketProvider({ campaignId, children }) {
  const [socket, setSocket] = useState(null)

  useEffect(() => {
    const s = io(import.meta.env.VITE_API_URL, { withCredentials: true })

    // 'connect' se déclenche à la connexion initiale ET à chaque reconnexion automatique.
    // Remplace le workaround reconnectTrigger + création d'un nouveau socket.
    s.on('connect', () => {
      s.emit(WS.SESSION_JOIN, { campaignId })
    })

    setSocket(s)
    return () => s.disconnect()
  }, [campaignId])

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  return useContext(SocketContext)
}
```

```js
// Pattern hook après migration (exemple useTokenSocket) :
export function useTokenSocket() {
  const socket = useSocket()
  const { addToken, removeToken, updateToken } = useTokenStore()

  useEffect(() => {
    if (!socket) return

    // Handlers nommés obligatoires — socket.off(event, handler) cible ce handler uniquement.
    // socket.off(event) sans handler supprimerait TOUS les listeners de cet event.
    const onMoved   = ({ tokenId, pos_x, pos_y, pos_z, updated_at }) =>
      updateToken({ id: tokenId, pos_x, pos_y, pos_z, updated_at })
    const onCreated = ({ token }) => addToken(token)
    const onDeleted = ({ tokenId }) => removeToken(tokenId)
    const onUpdated = ({ token }) => updateToken(token)
    const onStatus  = ({ tokenId, statuses, statusExpiries }) =>
      updateToken({ id: tokenId, statuses, statusExpiries: statusExpiries ?? {} })

    socket.on(WS.TOKEN_MOVED,          onMoved)
    socket.on(WS.TOKEN_CREATED,        onCreated)
    socket.on(WS.TOKEN_DELETED,        onDeleted)
    socket.on(WS.TOKEN_UPDATED,        onUpdated)
    socket.on(WS.TOKEN_STATUS_UPDATED, onStatus)

    return () => {
      socket.off(WS.TOKEN_MOVED,          onMoved)
      socket.off(WS.TOKEN_CREATED,        onCreated)
      socket.off(WS.TOKEN_DELETED,        onDeleted)
      socket.off(WS.TOKEN_UPDATED,        onUpdated)
      socket.off(WS.TOKEN_STATUS_UPDATED, onStatus)
    }
  }, [socket])
  // Pas de return — le hook ne gère pas d'état UI (contrairement à useCombatSocket)
}
```

```jsx
// SessionPage.jsx après REWORK-15 — structure cible :

export default function SessionPage() {
  const { campaignId } = useParams()
  // loadSession + loading/error restent ici (REST, pas socket)
  return (
    <SocketProvider campaignId={campaignId}>
      <SessionContent campaignId={campaignId} />
    </SocketProvider>
  )
}

function SessionContent({ campaignId }) {
  // Tout le code actuel de SessionPage — accède au socket via useSocket()
  const socket = useSocket()  // stable — plus besoin de socket dans les deps useCallback (P3 résolu)
  useTokenSocket()            // auto-enregistrement interne
  useEntitySocket(...)
  useCombatSocket(...)
  // ... listeners inline restants (extraits dans REWORK-11 à 14)
}
```

**Périmètre** :

Fichiers touchés :
- `client/src/lib/SocketContext.jsx` — **créé**
- `client/src/lib/useTokenSocket.js` — `function listen(s)` → `useEffect([socket])` interne avec handlers nommés + cleanup
- `client/src/lib/useEntitySocket.js` — idem (params `{ setRadialMenu, setMoveTarget }` conservés)
- `client/src/lib/useCombatSocket.js` — idem (params `{ isGm, setMode, onModeReset }` conservés, `useState` exportés conservés)
- `client/src/pages/SessionPage.jsx` — split `SessionPage` (wrapper) + `SessionContent` (inline même fichier) ; `const [socket, setSocket]` supprimé ; `reconnectTrigger` supprimé ; `tokenSocket.listen(s)` / `entitySocket.listen(s)` / `combatSocket.listen(s)` supprimés

Fichiers NON touchés — migration déférée aux REWORK-11 à 14 :
- `Sidebar.jsx`, `Canvas3D.jsx`, `Editor3D.jsx`, `DroneWindow.jsx`, `DicePanel.jsx`, `TokenStatusPanel.jsx`, `EntityInstancePanel.jsx`, `CombatOverlay.jsx` — reçoivent encore `socket` en prop transitoirement via `const socket = useSocket()` dans `SessionContent`
- Listeners inline restants dans `SessionContent` (`SESSION_JOINED`, `CHAT_MESSAGE`, `DICE_RESULT`, `WOUND_*`, etc.) — extraits dans REWORK-11/12/13
- `shared/events.js` — aucun event nouveau
- Tout le code serveur — non touché
- Les stores Zustand — non touchés

**Plan** :

#### Étape 1 — Créer `client/src/lib/SocketContext.jsx`
- `SocketProvider` + `useSocket()` exactement comme l'interface cible
- Aucun fichier existant modifié à cette étape
- Run à vide : `npm run build` — zéro erreur

#### Étape 2 — Migrer `useTokenSocket.js`
- Supprimer `function listen(s) { ... }` et `return { listen }`
- Ajouter `const socket = useSocket()` en tête
- Ajouter `useEffect([socket])` avec handlers nommés et cleanup
- `return` supprimé (pas d'état UI exposé)
- Run à vide : `npm run build`

#### Étape 3 — Migrer `useEntitySocket.js`
- Même pattern. Params `{ setRadialMenu, setMoveTarget }` restent — ils alimentent l'état UI de `SessionContent`
- Vérifier que les handlers qui appellent `setRadialMenu` / `setMoveTarget` sont dans les deps du `useEffect`
- Run à vide : `npm run build`

#### Étape 4 — Migrer `useCombatSocket.js`
- Même pattern. `useState` exposés (`reloadResult`, `damagePayload`, etc.) restent — renvoyés par le hook
- Params `{ isGm, setMode, onModeReset }` restent dans les deps du `useEffect`
- Run à vide : `npm run build`

#### Étape 5 — Modifier `SessionPage.jsx`
- Créer `SessionContent({ campaignId })` dans le même fichier (sous `SessionPage`)
- Déplacer tout le corps actuel de `SessionPage` dans `SessionContent`
- `SessionPage` devient un wrapper : charge `loadSession` + loading/error + rend `<SocketProvider><SessionContent /></SocketProvider>`
- Dans `SessionContent` :
  - Supprimer `const [socket, setSocket] = useState(null)` et `const [reconnectTrigger, ...] = useState(0)`
  - Ajouter `const socket = useSocket()` (transitoire — pour prop drilling vers les 8 composants non encore migrés)
  - Supprimer `tokenSocket.listen(s)`, `entitySocket.listen(s)`, `combatSocket.listen(s)`
  - Remplacer le grand `useEffect([campaignId, reconnectTrigger, loadSession])` par un `useEffect([socket])` ne contenant que les listeners inline restants (avec handlers nommés + cleanup)
  - Supprimer `s.io.on('reconnect', ...)` (géré par `SocketProvider`)
  - Supprimer `setSocket(s)` et `return () => s.disconnect()`
- Run à vide : SR + `npm run build` — vérifier que la session s'ouvre, que les tokens bougent, que le chat fonctionne

**Validation** :

| # | Scénario | Résultat attendu |
|---|---|---|
| V1 | Ouverture session normale | Session charge, tokens présents, chat connecté |
| V2 | Déconnexion réseau + reconnexion | socket.io reconnecte, `connect` ré-émet `SESSION_JOIN`, état restauré |
| V3 | Token déplacé par un joueur | `TOKEN_MOVED` reçu, token se déplace dans le canvas |
| V4 | Message chat envoyé | `CHAT_MESSAGE` reçu, affiché dans la sidebar |
| V5 | Assaut combat complet | Scénarios REWORK-04 V1–V12 non régressés |
| V6 | Changement de campagne (navigation) | Ancien socket déconnecté, nouveau socket créé pour la nouvelle campagneId |
| V7 | `useCallback` sur une émission socket | Plus de `socket` dans les deps — aucun warning React |

**Definition of done** :

- [ ] `client/src/lib/SocketContext.jsx` créé — `SocketProvider` + `useSocket()` — `connect` handler émet `SESSION_JOIN`
- [ ] `useTokenSocket.js` migré — `listen(s)` supprimé, `useEffect([socket])` avec handlers nommés + cleanup
- [ ] `useEntitySocket.js` migré — idem
- [ ] `useCombatSocket.js` migré — idem, `useState` exposés conservés
- [ ] `SessionPage.jsx` splitté — `SessionPage` (wrapper REST + SocketProvider) + `SessionContent` (logique socket)
- [ ] `const [socket, setSocket] = useState(null)` supprimé de `SessionContent`
- [ ] `const [reconnectTrigger, ...] = useState(0)` supprimé de `SessionContent`
- [ ] `s.io.on('reconnect', ...)` supprimé — remplacé par `connect` dans SocketProvider
- [ ] `tokenSocket.listen(s)` / `entitySocket.listen(s)` / `combatSocket.listen(s)` supprimés
- [ ] `const socket = useSocket()` dans `SessionContent` — prop drilling maintenu vers les 8 composants (transitoire)
- [ ] Listeners inline restants dans un `useEffect([socket])` avec handlers nommés + cleanup
- [ ] `npm run build` — zéro erreur, zéro warning
- [ ] Scénarios V1–V7 validés
- [ ] `docs/ARCHI_REWORK.md` — REWORK-15 déplacé dans "Reworks achevés"
- [ ] `docs/PLAN_REWORK12.md` — archivé (spec complète dans `ARCHI_REWORK.md` §REWORK-12)
- [ ] `docs/JOURNAL5.md` appended

### REWORK-12 ✅ — useCharacterSocket — spec complète → ARCHI_REWORK_DONE.md

---

### REWORK-04 ✅ — FSM Combat — spec complète → ARCHI_REWORK_DONE.md

**Problème** :
La FSM de combat est implicite et fragmentée en trois couches disjointes :
1. `combat_state.phase` en DB (`ROSTER` / `ANNOUNCEMENT` / `RESOLUTION`) — seule information persistée
2. Sous-états `AWAITING_DEFENSE` / `AWAITING_DAMAGE` / `AWAITING_STUN` — uniquement dans les Maps in-memory de `socketCombat.js`
3. `combatStore.js` client — aucun `subPhase`, combat figé si reconnexion en slot bloqué

Conséquences directes lues dans le code :
- **Split-brain RESOLUTION** (`socketCombat.js` — dette active) : si un joueur reconnecte pendant un slot bloqué (`needsDefenseWait = true`), `COMBAT_STATE_SYNC` ne peut pas restaurer le prompt (`pendingMeleeDefense` Map vide au restart). Combat figé.
- **Guards dispersés** : `if (phase !== 'ANNOUNCEMENT') return` dupliqué dans 13 handlers sans source de vérité centrale (`socketCombat.js` L.1–2824).
- **Sous-états invisibles** : `combat_state.phase = 'RESOLUTION'` que le slot soit libre (`SLOT_ACTIVE`) ou bloqué (`AWAITING_DEFENSE`). Impossible de monitorer ou déboguer l'état réel sans lire les Maps.
- **Handlers trop couplés** : `COMBAT_MELEE_DEFENSE_CONFIRM` gère résolution opposition + dégâts + `advanceSlot` + multi-melee chaining dans un seul handler.

**État actuel** :
- `server/src/socket/socketCombat.js` — 2824 lignes, 13 handlers, 13 helpers
- `pendingMaps` : 5 Maps déclarées dans `index.js`, passées à `registerCombatHandlers(io, socket, context, pendingMaps)`
  - `combatTimers` — timers annonce (reste in-memory intentionnellement)
  - `combatPreviews` — ghosts déplacement (reste in-memory intentionnellement)
  - `pendingMeleeDefense` — slot bloqué défense CaC → perd à restart
  - `pendingDamageActions` — slot bloqué dégâts → perd à restart
  - `pendingStunActions` — prompt D6 étourdissement → perd à restart
- `client/src/stores/combatStore.js` — 56 lignes, `phase` uniquement, pas de `subPhase`
- `shared/events.js` — `COMBAT_STATE_SYNC` existe mais ne transporte pas `subPhase`

**Décision** :
Architecture retenue : **module FSM pur + table `combat_pending` en DB**.

Alternatives écartées :
- **XState v5** — dépendance externe lourde, restructuration complète des 13 handlers, overkill single-server Raspberry Pi, incompatible avec le pattern `registerXxxHandlers` de REWORK-08.
- **Redux Toolkit FSM** — idem, côté client uniquement, ne résout pas le split-brain serveur.
- **In-memory Map améliorée** — ne résout pas le split-brain après restart serveur.

Pattern retenu (consensus pro game servers) : *"server authority, serializable state, restore on reconnect"*.
- FSM = fonctions pures sans I/O → testable en isolation sans DB ni socket
- État pending = persisté en DB → survive au restart serveur
- Reconnexion = requête DB → réémet les prompts ciblés

**Interface cible** :

```js
// server/src/lib/combatFSM.js
//
// Les clés de TRANSITIONS sont les noms bruts des events (WS) ou pseudo-events internes (INT).
// La distinction WS/INT est documentée en commentaire — elle n'est PAS dans la clé,
// pour éviter les typos à l'appel de canTransition().
//
// Events WS (client → serveur via socket.on) :
//   COMBAT_START, COMBAT_END, COMBAT_ANNOUNCE_START, COMBAT_ACTION_DECLARE,
//   COMBAT_SURPRISE_RESULT, COMBAT_SKIP_PLAYER, COMBAT_ACTION_CONFIRM,
//   COMBAT_MELEE_DEFENSE_CONFIRM, COMBAT_DAMAGE_CONFIRM
//
// Pseudo-events internes (déclenchés dans les helpers serveur) :
//   START_RESOLUTION, NEEDS_DEFENSE, NEEDS_DAMAGE, END_TURN
//
// COMBAT_INIT_STATE (WS) : hors FSM — mise à jour roster uniquement, pas de changement de phase. Pas de guard.
// COMBAT_ANNOUNCE_PREVIEW (WS) : relay éphémère combatPreviews — aucune transition. Pas de guard.
// COMBAT_APPLY_STUN (WS) : action GM administrative sans transition. Pas de guard.
// COMBAT_SURPRISE_RESULT (WS) : par joueur — pas de changement de phase globale.
// AWAITING_STUN : non-bloquant — sub_phase reste SLOT_ACTIVE, stun tracké via combat_pending.
// COMBAT_STUN_CONFIRM : dans SLOT_ACTIVE uniquement — aucun changement de sub_phase (stun non-bloquant).
//
// COMBAT_ACTION_CONFIRM : la transition dans TRANSITIONS sert de GUARD UNIQUEMENT.
//   nextState() n'est pas applicable ici — l'état final (SLOT_ACTIVE ou AWAITING_DEFENSE
//   ou AWAITING_DAMAGE) est décidé par la logique résolution dans les helpers, puis écrit
//   directement via setFSMSubPhase(). Ne pas appeler nextState() pour cet event.
//
// COMBAT_END : autorisé depuis tous les états RESOLUTION (y compris AWAITING_*)
//   pour permettre au GM de terminer le combat d'urgence.

const TRANSITIONS = {
  'null|null': {
    'COMBAT_START':                { phase: 'ROSTER',       subPhase: null },
  },
  'ROSTER|null': {
    'COMBAT_ANNOUNCE_START':       { phase: 'ANNOUNCEMENT', subPhase: null },
    'COMBAT_END':                  { phase: null,            subPhase: null }, // GM peut annuler avant annonce
  },
  'ANNOUNCEMENT|null': {
    'COMBAT_ACTION_DECLARE':       { phase: 'ANNOUNCEMENT', subPhase: null }, // reste jusqu'à count(has_announced=false)=0
    'COMBAT_SURPRISE_RESULT':      { phase: 'ANNOUNCEMENT', subPhase: null }, // par joueur surpris
    'COMBAT_SKIP_PLAYER':          { phase: 'ANNOUNCEMENT', subPhase: null },
    'START_RESOLUTION':            { phase: 'RESOLUTION',   subPhase: 'SLOT_ACTIVE' }, // INT — startResolutionPhase()
    'COMBAT_END':                  { phase: null,            subPhase: null }, // GM peut annuler pendant l'annonce
  },
  'RESOLUTION|SLOT_ACTIVE': {
    'COMBAT_ACTION_CONFIRM':       { phase: 'RESOLUTION',   subPhase: 'SLOT_ACTIVE' }, // guard only — état réel fixé par helpers
    'COMBAT_SKIP_PLAYER':          { phase: 'RESOLUTION',   subPhase: 'SLOT_ACTIVE' },
    'NEEDS_DEFENSE':               { phase: 'RESOLUTION',   subPhase: 'AWAITING_DEFENSE' }, // INT — resolveMeleeAction
    'NEEDS_DAMAGE':                { phase: 'RESOLUTION',   subPhase: 'AWAITING_DAMAGE' },  // INT — resolveAssaultAction
    'END_TURN':                    { phase: 'ANNOUNCEMENT', subPhase: null },               // INT — endTurn()
    'COMBAT_END':                  { phase: null,            subPhase: null },
    'COMBAT_STUN_CONFIRM':         { phase: 'RESOLUTION',   subPhase: 'SLOT_ACTIVE' }, // stun non-bloquant — aucun changement de sub_phase
  },
  'RESOLUTION|AWAITING_DEFENSE': {
    'COMBAT_MELEE_DEFENSE_CONFIRM': { phase: 'RESOLUTION',  subPhase: 'SLOT_ACTIVE' },
    'COMBAT_END':                   { phase: null,           subPhase: null }, // GM peut forcer fin de combat
  },
  'RESOLUTION|AWAITING_DAMAGE': {
    'COMBAT_DAMAGE_CONFIRM':        { phase: 'RESOLUTION',  subPhase: 'SLOT_ACTIVE' },
    'COMBAT_END':                   { phase: null,           subPhase: null }, // GM peut forcer fin de combat
  },
}

/**
 * Vérifie si la transition est autorisée depuis (phase, subPhase) pour cet event.
 * @param {string|null} phase
 * @param {string|null} subPhase  — toujours normalisé via `?? null` avant appel
 * @param {string}      event     — nom brut de l'event (ex: 'COMBAT_ACTION_CONFIRM', 'NEEDS_DEFENSE')
 * @returns {boolean}
 */
export function canTransition(phase, subPhase, event) { ... }

/**
 * Retourne le prochain état après la transition.
 * NE PAS utiliser pour COMBAT_ACTION_CONFIRM — état final non-déterministe (voir commentaire table).
 * @returns {{ phase: string|null, subPhase: string|null } | null}
 */
export function nextState(phase, subPhase, event) { ... }

/**
 * Écrit sub_phase dans combat_state.
 * Nommé setFSMSubPhase pour éviter la confusion avec l'action Zustand setCombatSubPhase (client).
 * Fonction à effets — async, void.
 */
export async function setFSMSubPhase(db, campaignId, subPhase) {
  await db('combat_state')
    .where({ campaign_id: campaignId })
    .update({ sub_phase: subPhase, updated_at: db.fn.now() })
}

/**
 * Debug uniquement — jamais utilisé comme guard.
 */
export function allowedEvents(phase, subPhase) { ... }
```

```sql
-- Migration 80 — combat_pending
CREATE TABLE combat_pending (
  campaign_id  UUID         NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  token_id     UUID         NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  type         TEXT         NOT NULL CHECK (type IN ('melee_defense', 'damage', 'stun')),
  payload      JSONB        NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY  (campaign_id, token_id, type)
);
-- PK sur (campaign_id, token_id, type) : un token peut avoir simultanément un stun pending
-- (non-bloquant, slot avancé) ET une melee_defense pending (slot N+1 le cible en CaC).
-- ON DELETE CASCADE : nettoyage automatique si token ou campagne supprimés.
-- Nettoyage fin de combat : DELETE WHERE campaign_id = ? dans handler COMBAT_END (voir A2).
```

```sql
-- Migration 81 — colonne sub_phase dans combat_state
ALTER TABLE combat_state ADD COLUMN sub_phase TEXT DEFAULT NULL
  CHECK (sub_phase IN ('SLOT_ACTIVE','AWAITING_DEFENSE','AWAITING_DAMAGE'));
-- AWAITING_STUN retiré : stun non-bloquant, sub_phase reste SLOT_ACTIVE.
-- sub_phase = NULL uniquement pour ROSTER et ANNOUNCEMENT.
-- startResolutionPhase() doit toujours écrire sub_phase='SLOT_ACTIVE' à l'entrée de RESOLUTION.
```

**Périmètre** :

Fichiers touchés :
- `server/src/lib/combatFSM.js` — **créé** (Palier 04-A)
- `server/src/socket/socketCombat.js` — guard `canTransition()` injecté en tête de chaque handler (Palier 04-A). Logique résolution intouchée.
- `server/src/socket/index.js` — `pendingMeleeDefense` / `pendingDamageActions` / `pendingStunActions` remplacés par appels DB (Palier 04-B)
- `server/src/socket/socketCombat.js` — remplace Map lookups par `SELECT FROM combat_pending` (Palier 04-B) + `COMBAT_STUN_CONFIRM` handler (B5)
- `server/src/lib/statusService.js` — `applyStun` : retrait param `pendingStunActions`, insert `combat_pending` (Palier 04-B étape B5)
- `server/src/socket/index.js` (SESSION_JOIN) — restauration `combat_pending` + réémettre prompts (Palier 04-C)
- `client/src/stores/combatStore.js` — ajout `subPhase: null` + `setSubPhase` (Palier 04-C)
- `client/src/lib/useCombatSocket.js` — propagation `subPhase` depuis `COMBAT_STATE_SYNC` (Palier 04-C)
- `docs/ASBUILT.md` — migration 80 + 81, nouveau module
- `docs/EN_COURS.md` — mise à jour prochaine étape

Fichiers NON touchés :
- `shared/events.js` — aucun nouvel event (`COMBAT_STATE_SYNC` reçoit `subPhase` dans son payload existant)
- Toute la logique résolution dans `socketCombat.js` (assault, melee, reload, drones) — intouchée
- `useCombatSocket.js` — modifications mineures seulement (propagation `subPhase`)
- `socketToken.js` / `socketVoxel.js` / `socketDice.js` / `socketEntity.js` — non touchés

Hors périmètre :
- Rollback de tour (`previousTurn` / `previousRound`) — les règles Polaris ne prévoient pas de retour arrière en combat. Pas de tracking `previous` state (contrairement à Foundry VTT). Toute régression de phase passe par le GM via `COMBAT_END` + relance.

**Plan** :

> **Ordre impératif** : A1 → B1 → B2 → A2 → B3 → B4 → B5 → B6 → C1 → C2 → C3 → C4.
> A2 (injection guards) dépend de B2 (migration `sub_phase`) : sans la colonne en DB, `combat?.sub_phase` retourne `undefined` → clé `'RESOLUTION|undefined'` absente des TRANSITIONS → guard bloque tous les handlers RESOLUTION silencieusement.

#### Palier 04-A — `combatFSM.js` (fonctions pures, zéro I/O)

**Étape A1** — Créer `server/src/lib/combatFSM.js`
- Table `TRANSITIONS` exactement telle que définie dans Interface cible (clés = noms bruts d'events)
- `canTransition(phase, subPhase, event)` — clé `${phase}|${subPhase ?? null}`, lookup dans TRANSITIONS
- `nextState(phase, subPhase, event)` → `{ phase, subPhase } | null`
- `setFSMSubPhase(db, campaignId, subPhase)` — async, écrit `sub_phase` en DB (nom distinct de l'action Zustand)
- `allowedEvents(phase, subPhase)` → `string[]` (debug uniquement — jamais utilisé comme guard)
- Run à vide : `node --check server/src/lib/combatFSM.js`

#### Palier 04-B — Migrations + guards + remplacement Maps

**Étape B1** — Migration 80 : table `combat_pending`
- Fichier `server/src/db/migrations/80_combat_pending.js` (chemin vérifié — pattern migration 79)
- Run à vide : `node -e "require('./server/src/db').migrate.latest()"` (ou équivalent projet)

**Étape B2** — Migration 81 : colonne `sub_phase` dans `combat_state`
- Fichier `server/src/db/migrations/81_combat_state_subphase.js`
- Run à vide : vérifier colonne présente en DB

**Étape A2** — Injecter `canTransition()` dans `socketCombat.js` (dépend de B2)
- Import `{ canTransition, setFSMSubPhase }` depuis `../lib/combatFSM.js`
- Pour chaque handler WS : lire `combat_state` (retourne `sub_phase` grâce à B2), puis :
  ```js
  const { phase, sub_phase: subPhase } = await db('combat_state').where({ campaign_id: campaignId }).first() ?? {}
  if (!canTransition(phase ?? null, subPhase ?? null, 'NOM_EVENT_BRUT')) {
    console.warn(`[FSM] guard bloqué : ${phase}|${subPhase} + NOM_EVENT_BRUT`)
    return
  }
  ```
  Remplacer `NOM_EVENT_BRUT` par le nom exact de la clé TRANSITIONS (ex: `'COMBAT_ACTION_CONFIRM'`).
- Handler `COMBAT_END` : ajouter après la logique existante :
  ```js
  await db('combat_pending').where({ campaign_id: campaignId }).delete()
  await setFSMSubPhase(db, campaignId, null)
  ```
- Les helpers internes (`startResolutionPhase`, `advanceSlot`, `endTurn`) n'utilisent PAS `canTransition` — ils appellent directement `setFSMSubPhase()` après leur logique
- `startResolutionPhase` : ajouter `await setFSMSubPhase(db, campaignId, 'SLOT_ACTIVE')` à l'entrée de RESOLUTION
- `endTurn` : ajouter `await setFSMSubPhase(db, campaignId, null)` avant d'émettre la transition vers ANNOUNCEMENT
- Run à vide : SR + scénario lancement combat (ROSTER → ANNOUNCEMENT → RESOLUTION)

**Étape B3** — Remplacer `pendingMeleeDefense` Map dans `socketCombat.js`
- `pendingMeleeDefense.set(tokenId, payload)` →
  ```js
  await db('combat_pending').insert({ campaign_id: campaignId, token_id: tokenId, type: 'melee_defense', payload })
  await setFSMSubPhase(db, campaignId, 'AWAITING_DEFENSE')
  ```
- `pendingMeleeDefense.get(tokenId)` →
  ```js
  const row = await db('combat_pending').where({ campaign_id: campaignId, token_id: tokenId, type: 'melee_defense' }).first()
  // row?.payload
  ```
- `pendingMeleeDefense.delete(tokenId)` →
  ```js
  await db('combat_pending').where({ campaign_id: campaignId, token_id: tokenId, type: 'melee_defense' }).delete()
  await setFSMSubPhase(db, campaignId, 'SLOT_ACTIVE')
  ```
- Run à vide : SR + scénario CaC PJ → défense requise → confirmation défenseur

> **Race condition B3/B4 — non-exploitable.** Entre `DELETE combat_pending` (await 1) et `setFSMSubPhase(SLOT_ACTIVE)` (await 2), un 2e handler concurrent lirait encore `sub_phase='AWAITING_DEFENSE'` en DB. Mais `canTransition('RESOLUTION','AWAITING_DEFENSE', X)` n'autorise que `COMBAT_MELEE_DEFENSE_CONFIRM` — qui ne peut pas arriver une 2e fois pour le même token (payload unique). Guard bloque toute autre transition. Race non-exploitable.

**Étape B4** — Remplacer `pendingDamageActions` Map (même pattern, `type='damage'`, `AWAITING_DAMAGE`)
- Delete : `WHERE type='damage'`, puis `setFSMSubPhase(db, campaignId, 'SLOT_ACTIVE')`
- Run à vide : SR + scénario assaut distance → résolution dégâts

**Étape B5** — Remplacer `pendingStunActions` Map (`type='stun'`)
- **Différence** : stun non-bloquant → `setFSMSubPhase` NON appelé au insert (sub_phase reste `SLOT_ACTIVE`)
- `setFSMSubPhase` NON appelé au delete non plus (slot déjà avancé, sub_phase inchangé)
- Delete : `WHERE type='stun'` uniquement (ne touche pas les éventuelles lignes melee_defense/damage)

**Périmètre B5 — deux fichiers touchés :**

`server/src/lib/statusService.js` — `applyStun` :
- Retirer `pendingStunActions` de la signature (4e paramètre)
- Remplacer les 2 appels `pendingStunActions.set(targetTokenId, { ... })` (L.107 et L.127) par :
  ```js
  await db('combat_pending').insert({
    campaign_id: campaignId,
    token_id:    targetTokenId,
    type:        'stun',
    payload:     { outcome, targetUserId: ..., userId, username, color, currentTurn, isGmPrompt: ... },
  })
  ```

`server/src/socket/socketCombat.js` :
- `COMBAT_STUN_CONFIRM` handler (L.1289–1315) :
  - `pendingStunActions.get(tokenId)` → `await db('combat_pending').where({ campaign_id: campaignId, token_id: tokenId, type: 'stun' }).first()` — lire `row.payload` pour `isGmPrompt`, `targetUserId`, `outcome`, `userId`, `username`, `color`, `currentTurn`
  - `pendingStunActions.delete(tokenId)` → `await db('combat_pending').where({ campaign_id: campaignId, token_id: tokenId, type: 'stun' }).delete()`
- 5 call sites `applyStun` (L.1017, 1247, 1995, 2422, 2732) : supprimer l'argument `pendingMaps.pendingStunActions`

- Run à vide : SR + scénario étourdissement → D6 prompt

**Étape B6** — Nettoyer `index.js`
- Supprimer `pendingMeleeDefense`, `pendingDamageActions`, `pendingStunActions` de `pendingMaps`
- `pendingMaps` conserve uniquement `{ combatTimers, combatPreviews }`
- Mettre à jour la signature passée à `registerCombatHandlers`
- Run à vide : SR

**Validation palier 04-B :**
- [ ] SR sans erreur
- [ ] Scénarios CaC 1–17 non régressés
- [ ] Guard bloque `COMBAT_ACTION_CONFIRM` en phase `ROSTER` → log warn, aucun crash, aucun effet
- [ ] Restart serveur pendant `AWAITING_DEFENSE` → ligne `combat_pending` toujours en DB
- [ ] Fin de slot → `combat_pending` vidé + `sub_phase = 'SLOT_ACTIVE'`
- [ ] Stun : `sub_phase` reste `SLOT_ACTIVE` pendant D6 pending

#### Palier 04-C — Fix `COMBAT_STATE_SYNC` reconnexion RESOLUTION

**Étape C1** — `combatStore.js` : ajouter `subPhase: null` + action `setCombatSubPhase`
- Nommée `setCombatSubPhase` (pas `setSubPhase`) — évite la confusion avec `setFSMSubPhase` du module serveur
- Run à vide : `npm run build` client

**Étape C2** — `useCombatSocket.js` : lire `subPhase` dans `COMBAT_STATE_SYNC` payload
- `COMBAT_STATE_SYNC` payload = `{ combatState, roster, actions }` — `combatState` est la row DB entière (snake_case)
- Ajouter `subPhase: combatState.sub_phase ?? null` dans le `setCombatState({ ... })` existant (L.79–86)
- Run à vide : `npm run build` client

**Étape C3** — `SESSION_JOIN` dans `index.js` : restauration pending
```js
// Après chargement combat_state (phase + sub_phase disponibles depuis migration 81) :
if (phase === 'RESOLUTION') {
  // Trouver le token du joueur qui reconnecte dans cette campagne
  const userToken = await db('tokens')
    .join('characters', 'tokens.character_id', 'characters.id')
    .where({ 'tokens.campaign_id': campaignId, 'characters.user_id': user.id })
    .select('tokens.id as token_id')
    .first()
  const userTokenId = userToken?.token_id

  // Lookup 1 — melee_defense (PJ défenseur), damage CaC/assaut PJ (attaquant), stun PJ
  // pending.payload ≠ prompt client — reconstruction type par type obligatoire
  if (userTokenId) {
    const rows = await db('combat_pending')
      .where({ campaign_id: campaignId, token_id: userTokenId })
    for (const row of rows) {
      const p = row.payload
      if (row.type === 'melee_defense') {
        // Prompt shape : socketCombat.js L.2049 — commonPending lu en L.1842
        socket.emit(WS.COMBAT_MELEE_DEFENSE_PROMPT, {
          attackerName:        p.attackerUsername,
          attackerTokenId:     p.attackerTokenId,
          defenderTokenId:     row.token_id,
          rollAttaque:         p.rollAttaque,
          chancesAttaque:      p.chancesAttaque,
          chanceDefenseBase:   p.defenderSkillTotal + p.defenderEffectiveMalus + p.multiMalusDefenseur,
          multiMalusDefenseur: p.multiMalusDefenseur,
        })
      } else if (row.type === 'damage') {
        // CaC (L.1210) et assaut PJ standard (L.2670) : prompt → attaquant, formula+targetName dans payload
        socket.emit(WS.COMBAT_DAMAGE_PROMPT, {
          tokenId:    row.token_id,
          formula:    p.formula,
          targetName: p.targetName,
        })
      } else if (row.type === 'stun') {
        // Prompt shape : statusService.js L.114
        socket.emit(WS.COMBAT_STUN_PROMPT, {
          tokenId: row.token_id,
          outcome: p.outcome,
        })
      }
    }
  }

  // Lookup 2 — [R4-2] drone assault : key=token drone (attaquant), prompt→cible PJ
  // resolveDroneAssaultAction (L.2437) : seul site qui émet COMBAT_DAMAGE_PROMPT à cibleSocket
  // et seul site qui stocke targetUserId dans le payload (L.2451).
  // Assaut PJ standard (L.2652) : pas de targetUserId dans payload, prompt → attaquant (Lookup 1).
  const pendingDmgDrone = await db('combat_pending')
    .where({ campaign_id: campaignId, type: 'damage' })
    .whereRaw("payload->>'targetUserId' = ?", [user.id])
    .first()
  if (pendingDmgDrone) {
    socket.emit(WS.COMBAT_DAMAGE_PROMPT, {
      tokenId:    pendingDmgDrone.token_id,
      formula:    pendingDmgDrone.payload.formula,
      targetName: pendingDmgDrone.payload.targetName,
    })
  }
}
```
- Note : si le joueur n'a pas de token dans cette campagne (GM pur sans PJ), `userToken` est null → Lookup 1 skipé, Lookup 2 seul s'exécute. `melee_defense` ne cible que des PJ défenseurs (PNJ/drone = auto-résolution `socketCombat.js` L.1874 + L.2011) → lookup correct pour ce type.
- **[R4-2] résolu — drone assault uniquement : key=token drone, prompt→cible PJ.** `resolveDroneAssaultAction` (L.2437) est le seul site qui émet `COMBAT_DAMAGE_PROMPT` à `cibleSocket` (pas à l'attaquant). C'est aussi le seul qui stocke `targetUserId: cibleCharacter.user_id` dans le payload (L.2451). `COMBAT_DAMAGE_CONFIRM` (L.924) reçoit `{ tokenId }` = token drone → Lookup 1 ne trouve rien pour la cible. Lookup 2 : `WHERE type='damage' AND payload->>'targetUserId' = user.id` → reconstruit prompt `{ tokenId: token_drone, formula, targetName }`.
- **[R4-3] mineur — `type=stun` + `shock_auto_stun=false` : GM ne retrouve pas le prompt.** `pendingStunActions.set(targetTokenId, { isGmPrompt: true })` avec `targetTokenId = PNJ token` (user_id=NULL, `statusService.js` L.127–134). GM reconnecte → `userToken = null` → prompt non réémi. Non-bloquant : stun non-bloquant, sub_phase reste SLOT_ACTIVE, combat continue. Acceptable pour un paramètre non-défaut (`shock_auto_stun` = true par défaut).
- Run à vide : SR

**Étape C4** — `COMBAT_STATE_SYNC` : vérification sites d'émission (grep fait — Session 110)
- **Grep résultat : 1 seul site** — `server/src/socket/index.js` L.109 : `socket.emit(WS.COMBAT_STATE_SYNC, { combatState: activeCombat, roster, actions })`
- **C4 serveur = no-op** : `activeCombat = await db('combat_state').where({ campaign_id }).first()` retourne la row DB entière. Après migration B2, `sub_phase` est automatiquement dans `combatState.sub_phase`. Aucun ajout serveur nécessaire.
- Seule modification : C2 lit `combatState.sub_phase ?? null` côté client (déjà documenté en C2).
- Run à vide : SR + reconnexion en slot bloqué → vérifier `combatStore.subPhase` peuplé côté client

**Validation palier 04-C :**
- [ ] SR sans erreur
- [ ] Reconnexion hors combat → aucun prompt émis
- [ ] Reconnexion en `ANNOUNCEMENT` → `COMBAT_STATE_SYNC` avec `subPhase: null` reçu côté client
- [ ] Reconnexion en `AWAITING_DEFENSE` → prompt `COMBAT_MELEE_DEFENSE_PROMPT` réémet au socket du joueur (pas broadcast)
- [ ] Reconnexion en `AWAITING_DAMAGE` → prompt `COMBAT_DAMAGE_PROMPT` réémet au socket du joueur
- [ ] Reconnexion en `SLOT_ACTIVE` avec stun pending → prompt `COMBAT_STUN_PROMPT` réémet
- [ ] GM sans token dans la campagne → aucun prompt émis (`userToken` null)
- [ ] Scénarios 1–17 non régressés

**Validation globale REWORK-04** :

| # | Scénario | Résultat attendu |
|---|---|---|
| V1 | `COMBAT_START` → ROSTER | `phase='ROSTER'`, `sub_phase=null` en DB |
| V2 | `COMBAT_ANNOUNCE_START` → ANNOUNCEMENT | `phase='ANNOUNCEMENT'`, `sub_phase=null` |
| V3 | Tous déclarent → `startResolutionPhase` | `phase='RESOLUTION'`, `sub_phase='SLOT_ACTIVE'` |
| V4 | CaC PJ→PNJ, `needsDefenseWait=true` | `sub_phase='AWAITING_DEFENSE'`, INSERT `combat_pending type=melee_defense` |
| V5 | PNJ confirme défense | `sub_phase='SLOT_ACTIVE'`, DELETE `combat_pending`, advanceSlot |
| V6 | Assaut distance → dégâts requis | `sub_phase='AWAITING_DAMAGE'`, INSERT `combat_pending type=damage` |
| V7 | Confirmation dégâts | `sub_phase='SLOT_ACTIVE'`, DELETE `combat_pending`, advanceSlot |
| V8 | Étourdissement → D6 prompt | `sub_phase='SLOT_ACTIVE'` (inchangé), INSERT `combat_pending type=stun` |
| V9 | Restart serveur pendant V4 | `combat_pending` toujours en DB après restart |
| V10 | Joueur reconnecte pendant V4 | `COMBAT_MELEE_DEFENSE_PROMPT` réémet au socket uniquement |
| V11 | Event invalide en ROSTER | guard bloque, log `[FSM] guard bloqué`, aucun crash |
| V12 | `endTurn()` → ANNOUNCEMENT | `setSubPhase(db, id, null)` + `phase='ANNOUNCEMENT'`, timers redémarrés |

**Definition of done** :

- [ ] `server/src/lib/combatFSM.js` créé — `node --check` OK — `canTransition` + `nextState` + `setFSMSubPhase` + `allowedEvents`
- [ ] Table TRANSITIONS : clés = noms bruts d'events, COMBAT_END présent dans AWAITING_DEFENSE + AWAITING_DAMAGE
- [ ] Migration 80 (`combat_pending`) appliquée — PK `(campaign_id, token_id, type)`
- [ ] Migration 81 (`sub_phase` dans `combat_state`) appliquée — **avant** l'étape A2
- [ ] Guard `canTransition('NOM_BRUT')` injecté dans **10 des 13 handlers** WS de `socketCombat.js` :
  - Avec guard (10) : `COMBAT_START` (L.78), `COMBAT_END` (L.207), `COMBAT_ANNOUNCE_START` (L.258), `COMBAT_SURPRISE_RESULT` (L.331), `COMBAT_ACTION_DECLARE` (L.413), `COMBAT_SKIP_PLAYER` (L.787), `COMBAT_ACTION_CONFIRM` (L.823), `COMBAT_DAMAGE_CONFIRM` (L.924), `COMBAT_MELEE_DEFENSE_CONFIRM` (L.1082), `COMBAT_STUN_CONFIRM` (L.1289)
  - Sans guard (3) : `COMBAT_INIT_STATE` (L.293, hors FSM — roster uniquement), `COMBAT_ANNOUNCE_PREVIEW` (L.805, relay éphémère sans transition), `COMBAT_APPLY_STUN` (L.1318, action GM administrative)
- [ ] `COMBAT_END` handler : `DELETE FROM combat_pending WHERE campaign_id` + `setFSMSubPhase(null)` ajoutés
- [ ] `statusService.applyStun` : param `pendingStunActions` retiré — 2 appels `.set()` remplacés par `db('combat_pending').insert()` — 5 call sites `socketCombat.js` mis à jour (L.1017, 1247, 1995, 2422, 2732)
- [ ] `COMBAT_STUN_CONFIRM` handler (L.1289–1315) : `pendingStunActions.get/delete` → DB lookup/delete depuis `combat_pending`
- [ ] `setFSMSubPhase()` appelé dans `startResolutionPhase` (→ SLOT_ACTIVE), `endTurn` (→ null), B3, B4 (pas B5)
- [ ] `pendingMeleeDefense` / `pendingDamageActions` / `pendingStunActions` Maps supprimées de `index.js`
- [ ] `pendingMaps` réduit à `{ combatTimers, combatPreviews }` dans `index.js`
- [ ] `combatStore.js` : `subPhase: null` + action `setCombatSubPhase` ajoutés
- [ ] `COMBAT_STATE_SYNC` transporte `subPhase` dans tous ses sites d'émission (grep vérifié avant C4)
- [ ] `useCombatSocket.js` : `subPhase` propagé dans `setCombatState`
- [ ] `SESSION_JOIN` : requête `userToken` (join characters) + lookup `combat_pending` + `socket.emit` ciblé
- [ ] Scénarios V1–V12 validés
- [ ] [R8-3] (fuite Maps combat disconnect) clos — `ON DELETE CASCADE` + cleanup `COMBAT_END`
- [ ] `docs/ASBUILT.md` mis à jour (migrations 80+81, `combatFSM.js`)
- [ ] `docs/EN_COURS.md` mis à jour
- [ ] `docs/JOURNAL5.md` appended
- [ ] Palier 04-C déployé atomiquement — C1+C2+C3+C4 en même déploiement. Entre A2 et C4, `sub_phase` existe en DB mais pas dans le payload `COMBAT_STATE_SYNC` : `combatStore.subPhase` reste null côté client. Déploiement partiel 04-C = désynchro client garantie.
