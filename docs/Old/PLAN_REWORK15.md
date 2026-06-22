# PLAN_REWORK15.md — SocketProvider (fondation architecture socket)
> Session 113 — 2026-06-20
> Spec complète → docs/ARCHI_REWORK.md §REWORK-15

---

## ⚠️ INSTRUCTIONS DE RÉCUPÉRATION POST-COMPACT

Si tu reprends depuis un résumé ou un compact :
1. Lire `CLAUDE.md` (instructions + méthode de travail)
2. Lire `docs/ARCHI_REWORK.md` §REWORK-15 (spec complète)
3. Lire ce fichier en entier
4. Aller à la section **REPRENDRE ICI** en bas → étape courante + fichiers à lire
5. NE PAS re-planifier. NE PAS poser de questions. Coder directement après "Je code ?".

---

## CONTEXTE

Fusion frontend imminente : un confrère refond le playground (SessionPage) + éditeur (Editor3D).
Audit merge-readiness Session 113 → 28 useState locaux, 12 WS listeners inline, socket prop-drillé à 8 composants.

REWORK-15 est la **fondation** — résout l'architecture socket avant les reworks d'extraction (11/12/13/14).
Sans REWORK-15 d'abord : REWORK-12 (`useCharacterSocket`) serait écrit avec `listen(s)` puis réécrit → double travail.

**Ce que REWORK-15 change :**
- Socket lifecycle extrait dans `SocketProvider` (cycle de vie, reconnexion native via `connect`)
- `reconnectTrigger` workaround supprimé — socket.io `connect` event gère la reconnexion
- `listen(s)` anti-pattern éliminé dans les 3 hooks existants
- P3 résolu implicitement : `socket = useSocket()` est stable → les useCallback avec `socket` en deps ne re-créent plus

**Ce que REWORK-15 ne change PAS :**
- SessionContent = corps actuel de SessionPage (~1285 lignes)
- 18 listeners inline restent dans SessionContent (REWORK-11/12/13 les extrairont)
- 8 composants reçoivent encore `socket` en prop (transitoire — migrés dans REWORK-11 à 14)
- Deps `socket` dans les useCallback existants — inoffensifs (stable), non nettoyés dans ce rework

---

## PIÈGES IDENTIFIÉS (run à vide session 113 — SessionPage.jsx lu)

**P-R15-1 — CRITIQUE : app cassée entre Étapes 2 et 5**
Après Étape 2, `useTokenSocket()` ne retourne plus `{ listen }`.
SessionContent appelle encore `tokenSocket.listen(s)` → TypeError runtime.
`npm run build` passe (Vite ne type-check pas) mais l'app crashe à runtime.
→ **Étapes 1–5 en une seule session de travail sans test runtime intermédiaire.**
→ `npm run build` entre étapes 1–4 = vérification syntaxe uniquement.
→ SR + test runtime uniquement après Étape 5.

**P-R15-5 — `setActiveCampaign` doit quitter le socket useEffect**
SessionPage.jsx L.388 : `setActiveCampaign(campaignId)` est en tête du grand useEffect
dont les deps sont `[campaignId, reconnectTrigger, loadSession]`.
Après migration, le socket useEffect a des deps `[socket]` — `setActiveCampaign` ne
serait plus déclenché au changement de campaignId.
→ Extraire dans un useEffect séparé `[campaignId]` pendant l'Étape 5.

**P-R15-3 — `user` hors deps dans useEntitySocket (acceptable)**
`user?.id` utilisé dans `onMapSwitch` mais `user` absent des deps `[socket, setRadialMenu, setMoveTarget]`.
User stable pendant une session → stale closure théorique uniquement. Documenté, non bloquant.

**P-R15-4 — DICE_RESULT multi-handler (non-problème)**
`useEntitySocket` (`onDiceResult` filtre `type !== 'entity_action'`) + handler inline dans SessionContent.
Deux handlers sur le même event → ok avec handlers nommés, cleanup ciblé.

---

## ÉTAT COURANT DES FICHIERS (lu session 113)

### `client/src/lib/useTokenSocket.js` (18 lignes)
- `function listen(s)` — 5 handlers nommés par event
- `return { listen }` — pas d'état exposé
- **Après migration :** `useEffect([socket])` + 5 handlers nommés + cleanup — pas de return

### `client/src/lib/useEntitySocket.js` (85 lignes)
- `function listen(s)` — 5 handlers
- Params `{ setRadialMenu, setMoveTarget }` — setters useState → stables
- `return { listen }` — pas d'état exposé
- **Après migration :** `useEffect([socket, setRadialMenu, setMoveTarget])` + cleanup — pas de return

### `client/src/lib/useCombatSocket.js` (149 lignes)
- `function listen(s)` — 17 handlers
- 12 `useState` exposés
- Params `{ isGm, setMode: setter useState stable, onModeReset: handleModeReset useCallback([]) stable }`
- `return { listen, reloadResult, ..., pjPreview }` — 12 paires état/setter
- **Après migration :** `useEffect([socket, isGm, setMode, onModeReset])` + 17 handlers nommés + cleanup
  — return conserve les 12 paires **sans** `listen`

### `client/src/pages/SessionPage.jsx` (1296 lignes — lu session 113)

Lignes clés identifiées :
- L.3 : `import { io } from 'socket.io-client'` → **supprimer**
- L.203 : `const [socket, setSocket] = useState(null)` → **supprimer**
- L.204 : `const [reconnectTrigger, setReconnectTrigger] = useState(0)` → **supprimer**
- L.207-215 : `handleCombatToggle` — `socket` dans deps useCallback (P3) — garder tel quel (socket stable après migration = inoffensif)
- L.379 : `const tokenSocket = useTokenSocket()` → **changer en** `useTokenSocket()` (no assignment)
- L.380 : `const entitySocket = useEntitySocket({...})` → **changer en** `useEntitySocket({...})` (no assignment)
- L.382-384 : `handleModeReset = useCallback(() => {...}, [])` → stable, **ne pas toucher**
- L.385 : `const combatSocket = useCombatSocket({...})` → **conserver** (retourne les 12 paires)
- L.387-529 : grand `useEffect([campaignId, reconnectTrigger, loadSession])` → **refactorer** (voir Étape 5)

Handlers inline dans le grand useEffect (18 au total) :
```
SESSION_JOINED, SESSION_USER_JOINED, SESSION_USER_LEFT          (3)
CAMPAIGN_SETTINGS_UPDATED, CHAT_MESSAGE, CHARACTER_UPDATED      (3)
DICE_RESULT                                                      (1 — handler long ~30L)
WOUND_ADDED, WOUND_UPDATED, WOUND_REMOVED                       (3)
INVENTORY_ADDED, INVENTORY_UPDATED, INVENTORY_REMOVED           (3)
MACRO_ROLL_RESULT                                                (1)
'error'                                                          (1)
DOC_CREATED, DOC_UPDATED, DOC_DELETED                           (3)
```
Tous deviennent des named functions + `socket.off` en cleanup.

---

## PLAN D'IMPLÉMENTATION

### Étape 1 — Créer `client/src/lib/SocketContext.jsx` (nouveau fichier)

Contenu exact :
```js
import { createContext, useContext, useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { WS } from '../../../shared/events.js'

const SocketContext = createContext(null)

export function SocketProvider({ campaignId, children }) {
  const [socket, setSocket] = useState(null)

  useEffect(() => {
    const s = io(import.meta.env.VITE_API_URL, { withCredentials: true })
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

Aucun fichier existant modifié.
Run à vide : `npm run build` — zéro erreur

---

### Étape 2 — Migrer `client/src/lib/useTokenSocket.js`

Fichier entier réécrit (18 → ~30 lignes) :

```js
import { useEffect } from 'react'
import { useSocket } from './SocketContext'
import { useTokenStore } from '../stores/tokenStore'
import { WS } from '../../../shared/events.js'

export function useTokenSocket() {
  const socket = useSocket()
  const { addToken, removeToken, updateToken } = useTokenStore()

  useEffect(() => {
    if (!socket) return

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
  // Pas de return — aucun état exposé
}
```

⚠️ P-R15-1 actif : app cassée à runtime jusqu'à Étape 5.
Run à vide : `npm run build` — zéro erreur

---

### Étape 3 — Migrer `client/src/lib/useEntitySocket.js`

Changements (85 lignes → ~65 lignes) :
- Ajouter `import { useEffect } from 'react'`
- Ajouter `import { useSocket } from './SocketContext'`
- Ajouter `const socket = useSocket()` en tête du corps
- Supprimer `function listen(s) { ... }` → remplacer par `useEffect` avec 5 handlers nommés
  (corps identiques à l'existant — lire useEntitySocket.js avant de coder)
- Deps : `[socket, setRadialMenu, setMoveTarget]`
- Cleanup symétrique : `socket.off(event, namedFn)` pour chacun
- Supprimer `return { listen }` — pas de return

Run à vide : `npm run build` — zéro erreur

---

### Étape 4 — Migrer `client/src/lib/useCombatSocket.js`

Changements (149 lignes → ~170 lignes) :
- L.1 : `import { useState }` → `import { useState, useEffect }`
- Ajouter `import { useSocket } from './SocketContext'`
- Après les 12 `useState` : ajouter `const socket = useSocket()`
- Supprimer `function listen(s) { ... }` (L.28–131) → remplacer par `useEffect` avec 17 handlers nommés
  (corps identiques à l'existant — lire useCombatSocket.js avant de coder)
- Deps : `[socket, isGm, setMode, onModeReset]`
- Cleanup symétrique pour les 17 handlers
- Return : supprimer `listen,` — conserver les 12 paires `(state, setter)`

Run à vide : `npm run build` — zéro erreur

---

### Étape 5 — Modifier `client/src/pages/SessionPage.jsx`

Lire SessionPage.jsx avant de coder — confirmer les lignes exactes ci-dessous (lues session 113).

**5a — Imports (L.1-16)**
- Supprimer `import { io } from 'socket.io-client'` (L.3)
- Ajouter `import { SocketProvider, useSocket } from '../lib/SocketContext'`

**5b — Créer `SessionPage` wrapper + `SessionContent`**

`SessionPage` (exportée) :
```jsx
export default function SessionPage() {
  const { campaignId } = useParams()
  return (
    <SocketProvider campaignId={campaignId}>
      <SessionContent campaignId={campaignId} />
    </SocketProvider>
  )
}
```

`SessionContent` (non exportée, dans le même fichier, sous SessionPage) :
```jsx
function SessionContent({ campaignId }) {
  // Tout le code actuel de SessionPage — sauf les changements 5c à 5f
}
```

`useParams`, `useNavigate`, `useTranslation` restent dans SessionContent (pas le wrapper).

**5c — Supprimer `socket` et `reconnectTrigger` state (L.203-204)**
```js
// SUPPRIMER :
const [socket, setSocket] = useState(null)
const [reconnectTrigger, setReconnectTrigger] = useState(0)
```
Ajouter à la place (après les autres useState, avant `loadSession`) :
```js
const socket = useSocket()
```

**5d — Hooks WS (L.379-385)**
```js
// AVANT :
const tokenSocket = useTokenSocket()
const entitySocket = useEntitySocket({ setRadialMenu, setMoveTarget })
const handleModeReset = useCallback(() => { ... }, [])
const combatSocket = useCombatSocket({ isGm, setMode, onModeReset: handleModeReset })

// APRÈS :
useTokenSocket()   // no assignment — ne retourne rien
useEntitySocket({ setRadialMenu, setMoveTarget })   // no assignment
const handleModeReset = useCallback(() => { ... }, [])   // inchangé
const combatSocket = useCombatSocket({ isGm, setMode, onModeReset: handleModeReset })   // inchangé
```

**5e — Refactorer le grand useEffect (L.387-529)**

Remplacer la totalité du bloc L.387-529 par :

```js
// setActiveCampaign — indépendant du socket (déclenché par changement de campagne)
useEffect(() => {
  setActiveCampaign(campaignId)
}, [campaignId])

// Listeners inline — 18 handlers, tous nommés pour cleanup ciblé
useEffect(() => {
  if (!socket) return

  const onSessionJoined = ({ userId, onlineUserIds = [] }) => {
    setOnlineUsers(new Set([userId, ...onlineUserIds]))
  }
  const onUserJoined = ({ userId, username }) => {
    addOnlineUser(userId)
    addMessage({ id: `sys-join-${userId}-${Date.now()}`, system: true,
      text: t('session.userJoined', { username }),
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) })
  }
  const onUserLeft = ({ userId, username }) => {
    removeOnlineUser(userId)
    addMessage({ id: `sys-left-${userId}-${Date.now()}`, system: true,
      text: t('session.userLeft', { username }),
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) })
  }
  const onCampaignUpdated = ({ campaign: updated }) => {
    setCampaign(prev => ({ ...prev, ...updated }))
  }
  const onChatMessage = ({ userId, username, color, text, timestamp }) => {
    addMessage({ id: `${userId}-${timestamp}`, user: username, color, text,
      time: new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) })
  }
  const onCharacterUpdated = (updatedCharacter) => { upsertCharacter(updatedCharacter) }
  const onDiceResult = ({ userId, username, color, formula, rolls, total,
    isCriticalSuccess, isCriticalFail, seed, timestamp, skillLabel, mechanicalTotal,
    chancesDeReussite, diffLabel, isSuccess, interactionType, mr, targetName,
    localisation, severity, severityColor, secret, breakdown }) => {
    addMessage({
      id: `dice-${userId}-${timestamp}`, type: 'dice', user: username, color,
      formula, rolls, total, isCriticalSuccess, isCriticalFail,
      time: new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      skillLabel, mechanicalTotal, chancesDeReussite, diffLabel, isSuccess,
      interactionType, mr, targetName, localisation, severity, severityColor,
      secret: secret || false, breakdown,
    })
    if (skillLabel === undefined) {
      setLastDiceRoll({ rolls, dieType: formula.replace(/^\d+/, '').split('+')[0].split('-')[0], seed, timestamp, color })
    }
  }
  const onWoundAdded = ({ characterId, worst_wound_severity }) => {
    setWoundVersions(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
    updateCharacter({ id: characterId, worst_wound_severity })
  }
  const onWoundUpdated = ({ characterId, worst_wound_severity }) => {
    if (characterId) setWoundVersions(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
    updateCharacter({ id: characterId, worst_wound_severity })
  }
  const onWoundRemoved = ({ characterId, worst_wound_severity }) => {
    if (characterId) setWoundVersions(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
    updateCharacter({ id: characterId, worst_wound_severity })
  }
  const onInventoryAdded   = ({ characterId }) => {
    if (characterId) setWoundVersions(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
  }
  const onInventoryUpdated = ({ characterId }) => {
    if (characterId) setWoundVersions(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
  }
  const onInventoryRemoved = ({ characterId }) => {
    if (characterId) setWoundVersions(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
  }
  const onMacroRollResult = ({ characterName, color, sourceLabel, rollResult, threshold,
    isSuccess, isCriticalSuccess, isCriticalFail, formattedMessage, secret, timestamp }) => {
    addMessage({ id: `macro-${timestamp}`, type: 'dice', interactionType: 'macro_result',
      characterName, color, sourceLabel, rollResult, threshold, isSuccess,
      isCriticalSuccess, isCriticalFail, formattedMessage, secret: secret || false,
      time: new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) })
  }
  const onError = (err) => {
    const msg = err?.message ?? String(err)
    console.error('[WS] Erreur serveur:', msg)
    setGmSocketError(msg)
  }
  const onDocCreated = (doc) => addDocument(doc)
  const onDocUpdated = (doc) => updateDocument(doc)
  const onDocDeleted = ({ id }) => removeDocument(id)

  socket.on(WS.SESSION_JOINED,              onSessionJoined)
  socket.on(WS.SESSION_USER_JOINED,         onUserJoined)
  socket.on(WS.SESSION_USER_LEFT,           onUserLeft)
  socket.on(WS.CAMPAIGN_SETTINGS_UPDATED,   onCampaignUpdated)
  socket.on(WS.CHAT_MESSAGE,                onChatMessage)
  socket.on(WS.CHARACTER_UPDATED,           onCharacterUpdated)
  socket.on(WS.DICE_RESULT,                 onDiceResult)
  socket.on(WS.WOUND_ADDED,                 onWoundAdded)
  socket.on(WS.WOUND_UPDATED,              onWoundUpdated)
  socket.on(WS.WOUND_REMOVED,              onWoundRemoved)
  socket.on(WS.INVENTORY_ADDED,            onInventoryAdded)
  socket.on(WS.INVENTORY_UPDATED,          onInventoryUpdated)
  socket.on(WS.INVENTORY_REMOVED,          onInventoryRemoved)
  socket.on(WS.MACRO_ROLL_RESULT,          onMacroRollResult)
  socket.on('error',                        onError)
  socket.on(WS.DOC_CREATED,               onDocCreated)
  socket.on(WS.DOC_UPDATED,               onDocUpdated)
  socket.on(WS.DOC_DELETED,               onDocDeleted)

  return () => {
    socket.off(WS.SESSION_JOINED,            onSessionJoined)
    socket.off(WS.SESSION_USER_JOINED,       onUserJoined)
    socket.off(WS.SESSION_USER_LEFT,         onUserLeft)
    socket.off(WS.CAMPAIGN_SETTINGS_UPDATED, onCampaignUpdated)
    socket.off(WS.CHAT_MESSAGE,              onChatMessage)
    socket.off(WS.CHARACTER_UPDATED,         onCharacterUpdated)
    socket.off(WS.DICE_RESULT,               onDiceResult)
    socket.off(WS.WOUND_ADDED,               onWoundAdded)
    socket.off(WS.WOUND_UPDATED,             onWoundUpdated)
    socket.off(WS.WOUND_REMOVED,             onWoundRemoved)
    socket.off(WS.INVENTORY_ADDED,           onInventoryAdded)
    socket.off(WS.INVENTORY_UPDATED,         onInventoryUpdated)
    socket.off(WS.INVENTORY_REMOVED,         onInventoryRemoved)
    socket.off(WS.MACRO_ROLL_RESULT,         onMacroRollResult)
    socket.off('error',                      onError)
    socket.off(WS.DOC_CREATED,              onDocCreated)
    socket.off(WS.DOC_UPDATED,              onDocUpdated)
    socket.off(WS.DOC_DELETED,              onDocDeleted)
  }
}, [socket])
```

Run à vide : SR + `npm run build` + scénarios V1–V7

---

## VALIDATION

| # | Scénario | Résultat attendu |
|---|---|---|
| V1 | Ouverture session normale | Session charge, tokens présents, chat connecté |
| V2 | Déconnexion réseau + reconnexion | socket.io reconnecte, `connect` ré-émet SESSION_JOIN, état restauré |
| V3 | Token déplacé par un joueur | TOKEN_MOVED reçu, token se déplace dans le canvas |
| V4 | Message chat envoyé | CHAT_MESSAGE reçu, affiché dans la sidebar |
| V5 | Assaut combat complet | Scénarios REWORK-04 V1–V12 non régressés |
| V6 | Changement de campagne (navigation) | Ancien socket déconnecté, nouveau socket créé |
| V7 | `setActiveCampaign` au montage | campagne active correcte dans sessionStore |

---

## DEFINITION OF DONE

Reprendre depuis ARCHI_REWORK.md §REWORK-15 DoD (17 items), plus :
- [ ] P-R15-5 : `setActiveCampaign` dans `useEffect([campaignId])` séparé
- [ ] `useTokenSocket()` et `useEntitySocket({...})` sans assignment dans SessionContent
- [ ] 18 handlers nommés + 18 `socket.off` dans le nouveau `useEffect([socket])` de SessionContent
- [ ] `import { io }` supprimé de SessionPage.jsx
- [ ] `docs/PLAN_REWORK15.md` mis à jour — section REPRENDRE ICI complétée
- [ ] `docs/PLAN_REWORK12.md` — décision section mise à jour : interface cible post-REWORK-15 utilise `useSocket()` (déjà fait)

---

## REPRENDRE ICI — POST-COMPACT

**État courant : Session 114 — Étape 5 ✅ terminée. P-R15-1 levé. SR + V1–V7 requis.**

- ✅ Étape 1 — `client/src/lib/SocketContext.jsx` créé — build ✅
- ✅ Étape 2 — `client/src/lib/useTokenSocket.js` migré — build ✅
- ✅ Étape 3 — `client/src/lib/useEntitySocket.js` migré — build ✅
- ✅ Étape 4 — `client/src/lib/useCombatSocket.js` migré — build ✅ (18 handlers, pas 17)
- ✅ Étape 5 — `client/src/pages/SessionPage.jsx` migré — build ✅

Notes Étape 5 :
- `SessionPage` wrapper (export default) : useParams → SocketProvider → SessionContent
- `SessionContent({ campaignId })` : tout le code existant
- `socket = useSocket()` en remplacement des 2 useState supprimés
- `useTokenSocket()` + `useEntitySocket({...})` sans assignment
- Grand useEffect (L.387-529) → 2 useEffects : `[campaignId]` + `[socket]` 18 handlers nommés
- `onReconnectSocket={() => {}}` — noop (reconnexion native socket.io)
- Fichier SessionPage.jsx : 1345 → ~1370 lignes après migration

Prochaine étape : **SR + validation V1–V7 (voir section VALIDATION ci-dessus)**
→ P-R15-1 levé — premier SR autorisé.
→ Après validation : docs (ARCHI_REWORK.md, JOURNAL5.md, EN_COURS.md, ASBUILT.md, CHANGELOG.md)
