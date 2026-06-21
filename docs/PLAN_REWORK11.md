# PLAN_REWORK11.md — useSessionSocket
> Session 113b — 2026-06-21

---

## ⚠️ INSTRUCTIONS DE RÉCUPÉRATION POST-COMPACT

Si tu reprends depuis un résumé ou un compact :
1. Lire `CLAUDE.md` (instructions + méthode de travail)
2. Lire `docs/ARCHI_REWORK.md` §REWORK-11 (spec complète quand elle y sera intégrée)
3. Lire ce fichier en entier
4. Aller à la section **REPRENDRE ICI** en bas → étape courante + fichiers à lire
5. NE PAS re-planifier. NE PAS poser de questions. Coder directement après "Je code ?".

---

## CONTEXTE

Fusion frontend imminente : un confrère refond le playground (SessionPage) + éditeur (Editor3D).
Audit merge-readiness Session 113 → 28 useState locaux, 18 WS listeners inline, socket prop-drillé à 8 composants.

**REWORK-15 est un prérequis absolu.** `useSessionSocket` utilise `useSocket()` — ce contexte n'existe qu'après REWORK-15.

**Ce que REWORK-11 change :**
- 12 handlers WS inline extraits de SessionContent → `useSessionSocket.js`
- `lastDiceRoll` + `gmSocketError` sortent de SessionContent → gérés dans le hook, exposés en retour
- Ces fonctions migrent du destructuring SessionContent vers l'intérieur du hook :
  - `useSessionStore()` : `setOnlineUsers`, `addOnlineUser`, `removeOnlineUser`, `addMessage`
  - `useCharacterStore()` : `upsertCharacter`
  - `useLibraryStore()` : `addDocument`, `updateDocument`, `removeDocument`

**Ce que REWORK-11 ne change PAS :**
- `campaign` reste un `useState` dans SessionContent (aussi setté par `loadSession` REST)
- `useSessionStore()` dans SessionContent : `setActiveCampaign` et `setPendingEntityId` restent
- `useCharacterStore()` dans SessionContent : `characters, isGm, setCharacters, setMembers, updateCharacter` restent
- `useLibraryStore()` dans SessionContent : `setDocuments` reste (utilisé par `loadSession` REST)
- `updateCharacter` reste dans SessionContent jusqu'à REWORK-12 (WOUND_* handlers)
- 6 handlers WOUND_*/INVENTORY_* restent inline → périmètre REWORK-12
- Tout le code serveur
- Les stores (sessionStore, characterStore, libraryStore) — non modifiés

---

## ÉTAT ACTUEL (lu Session 113b — SessionPage.jsx)

### Handlers inline dans le grand `useEffect` (L.387–529)

Les 12 handlers du périmètre REWORK-11 (lignes actuelles **avant** REWORK-15 — décalées après) :

```js
// L.396-398 — SESSION_JOINED
s.on(WS.SESSION_JOINED, ({ userId, onlineUserIds = [] }) => {
  setOnlineUsers(new Set([userId, ...onlineUserIds]))
})

// L.399-407 — SESSION_USER_JOINED
s.on(WS.SESSION_USER_JOINED, ({ userId, username }) => {
  addOnlineUser(userId)
  addMessage({
    id: `sys-join-${userId}-${Date.now()}`,
    system: true,
    text: t('session.userJoined', { username }),
    time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  })
})

// L.408-416 — SESSION_USER_LEFT
s.on(WS.SESSION_USER_LEFT, ({ userId, username }) => {
  removeOnlineUser(userId)
  addMessage({
    id: `sys-left-${userId}-${Date.now()}`,
    system: true,
    text: t('session.userLeft', { username }),
    time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  })
})

// L.417-419 — CAMPAIGN_SETTINGS_UPDATED
s.on(WS.CAMPAIGN_SETTINGS_UPDATED, ({ campaign: updated }) => {
  setCampaign(prev => ({ ...prev, ...updated }))
})

// L.420-427 — CHAT_MESSAGE
s.on(WS.CHAT_MESSAGE, ({ userId, username, color, text, timestamp }) => {
  addMessage({
    id: `${userId}-${timestamp}`,
    user: username,
    color,
    text,
    time: new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  })
})

// L.429-431 — CHARACTER_UPDATED
s.on(WS.CHARACTER_UPDATED, (updatedCharacter) => {
  upsertCharacter(updatedCharacter)
})

// L.432-466 — DICE_RESULT (~35 lignes)
s.on(WS.DICE_RESULT, ({ userId, username, color, formula, rolls, total,
  isCriticalSuccess, isCriticalFail, seed, timestamp, skillLabel, mechanicalTotal,
  chancesDeReussite, diffLabel, isSuccess, interactionType, mr, targetName,
  localisation, severity, severityColor, secret, breakdown }) => {
  addMessage({
    id: `dice-${userId}-${timestamp}`,
    type: 'dice',
    user: username,
    color,
    formula,
    rolls,
    total,
    isCriticalSuccess,
    isCriticalFail,
    time: new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    skillLabel,
    mechanicalTotal,
    chancesDeReussite,
    diffLabel,
    isSuccess,
    interactionType,
    mr,
    targetName,
    localisation,
    severity,
    severityColor,
    secret: secret || false,
    breakdown,
  })
  if (skillLabel === undefined) {
    setLastDiceRoll({ rolls, dieType: formula.replace(/^\d+/, '').split('+')[0].split('-')[0], seed, timestamp, color })
  }
})

// L.489-506 — MACRO_ROLL_RESULT
s.on(WS.MACRO_ROLL_RESULT, ({ characterName, color, sourceLabel, rollResult,
  threshold, isSuccess, isCriticalSuccess, isCriticalFail, formattedMessage,
  secret, timestamp }) => {
  addMessage({
    id:               `macro-${timestamp}`,
    type:             'dice',
    interactionType:  'macro_result',
    characterName,
    color,
    sourceLabel,
    rollResult,
    threshold,
    isSuccess,
    isCriticalSuccess,
    isCriticalFail,
    formattedMessage,
    secret: secret || false,
    time: new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  })
})

// L.508-512 — 'error'
s.on('error', (err) => {
  const msg = err?.message ?? String(err)
  console.error('[WS] Erreur serveur:', msg)
  setGmSocketError(msg)
})

// L.523-525 — DOC_*
s.on(WS.DOC_CREATED, (doc) => addDocument(doc))
s.on(WS.DOC_UPDATED, (doc) => updateDocument(doc))
s.on(WS.DOC_DELETED, ({ id }) => removeDocument(id))
```

### États locaux liés uniquement au WS (à migrer dans le hook)

```js
// L.97-101 — bloc complet à supprimer (commentaire + useState + useCallback)
// ─── Animation dés (Dice Rework) ────────────────────────────────────────────
// null = pas d'animation, sinon payload DICE_RESULT du dernier jet normal.
// Jets d'entité (skillLabel défini) → exclus, pas d'animation.
const [lastDiceRoll, setLastDiceRoll] = useState(null)
const handleDiceDone = useCallback(() => setLastDiceRoll(null), [])
// Utilisé : dicePayload={lastDiceRoll} → Canvas3D (L.818)
//           onDiceDone={handleDiceDone} → Canvas3D (L.819)

// L.108-109 — bloc complet à supprimer (commentaire + useState)
// gmSocketError : erreur serveur visible GM (PC22, etc.)
const [gmSocketError, setGmSocketError] = useState(null)
// Utilisé : gmSocketError={gmSocketError} → CombatOverlay (L.1176)
//           onGmSocketErrorClose={() => setGmSocketError(null)} → CombatOverlay (L.1177)
```

### État partagé REST + WS (reste dans SessionContent)

```js
// L.51 — campaign
const [campaign, setCampaign] = useState(null)
// Setté par loadSession REST (L.151) ET par CAMPAIGN_SETTINGS_UPDATED WS
// Utilisé : campaign?.name (title L.56), campaign?.default_token_glb_url (L.828),
//           campaign?.action_timer_sec (L.1143)
// → setCampaign passé en param au hook
```

### Destructurings à nettoyer dans SessionContent

```js
// L.44-46 — useSessionStore : 4 fonctions migrent vers le hook
const {
  setOnlineUsers, addOnlineUser, removeOnlineUser, addMessage, // ← MIGRENT dans le hook
  setActiveCampaign,    // ← reste (useEffect([campaignId]) séparé — REWORK-15 §P-R15-5)
  setPendingEntityId,   // ← reste (utilisé dans les callbacks entity)
} = useSessionStore()
// Après REWORK-11 :
// const { setActiveCampaign, setPendingEntityId } = useSessionStore()

// L.37 — useCharacterStore : upsertCharacter migre
const { characters, isGm, setCharacters, setMembers, upsertCharacter, updateCharacter } = useCharacterStore()
// upsertCharacter → migre dans le hook (CHARACTER_UPDATED)
// updateCharacter → reste jusqu'à REWORK-12 (WOUND_* handlers)
// Après REWORK-11 :
// const { characters, isGm, setCharacters, setMembers, updateCharacter } = useCharacterStore()

// L.49 — useLibraryStore : 3 fonctions migrent
const { setDocuments, addDocument, updateDocument, removeDocument } = useLibraryStore()
// addDocument/updateDocument/removeDocument → migrent dans le hook (DOC_*)
// setDocuments → reste pour loadSession REST
// Après REWORK-11 :
// const { setDocuments } = useLibraryStore()
```

---

## PIÈGES IDENTIFIÉS (run à vide Session 113b)

**P-R11-1 — `handleDiceDone` est un hook (useCallback) — doit être DÉPLACÉ**
`handleDiceDone` est déclaré à L.101 avec `useCallback` — c'est un appel de hook.
Après REWORK-11, `setLastDiceRoll` vient du retour de `useSessionSocket(...)` (déclaré plus bas).
Deux contraintes simultanées :
1. `setLastDiceRoll` n'est pas encore en scope à L.101 après suppression du `useState` → erreur runtime
2. React suit l'ordre des hooks : déplacer `useCallback` change cet ordre → c'est intentionnel et acceptable dans une migration (on réécrit le fichier), mais il faut que le NOUVEAU fichier soit cohérent
→ Étape 2b supprime le bloc L.97-101 (commentaire + useState + useCallback) en entier.
→ Étape 2g recrée `handleDiceDone` après `useSessionSocket(...)`.

**P-R11-2 — Vérifier les 3 fonctions useLibraryStore avant de les retirer**
Grep `addDocument|updateDocument|removeDocument` dans SessionPage.jsx avant l'Étape 2f.
Attendu : uniquement aux L.523-525 (handlers DOC_*). Confirmer avant de retirer du destructuring.

**P-R11-3 — Vérifier les 4 fonctions useSessionStore avant de les retirer**
Grep `addMessage|setOnlineUsers|addOnlineUser|removeOnlineUser` dans SessionPage.jsx avant l'Étape 2e.
Si `addMessage` est appelé dans un callback REST (ex. message d'erreur local) ou ailleurs → ne pas le retirer.
Attendu : uniquement dans les 12 handlers WS. Confirmer avant de retirer du destructuring.

**P-R11-4 — `DICE_RESULT` double handler (coexistence `useEntitySocket`)**
`useEntitySocket` enregistre déjà un `onDiceResult` (filtre `type !== 'entity_action'`).
Après REWORK-11, `useSessionSocket` enregistre un second `onDiceResult`.
Deux handlers nommés distincts sur le même event → comportement correct (socket.io les appelle tous les deux).
Cleanup symétrique obligatoire : `socket.off(WS.DICE_RESULT, namedFn)` cible uniquement son propre handler.
(P-R15-4 — déjà documenté dans PLAN_REWORK15.md)

**P-R11-5 — `'error'` string brut, pas `WS.ERROR`**
`socket.on('error', onError)` et `socket.off('error', onError)` — string littéral, non dans `shared/events.js`.
Code source confirmé L.508 : `s.on('error', ...)`. Pas de constante WS à utiliser ici.

**P-R11-6 — Ne pas commencer sans REWORK-15 terminé**
`useSocket()` n'existe que si `SocketContext.jsx` est créé et `SocketProvider` wrap SessionContent.
Tenter REWORK-11 sans REWORK-15 → import `useSocket` non résolu → build échoue.
Vérifier : `client/src/lib/SocketContext.jsx` existe avant de démarrer l'Étape 1.

---

## ASYMÉTRIES À PRÉSERVER IMPÉRATIVEMENT

| Event | Condition | Actions |
|---|---|---|
| `DICE_RESULT` | `skillLabel === undefined` | `addMessage` **ET** `setLastDiceRoll` |
| `DICE_RESULT` | `skillLabel !== undefined` (jet entité) | `addMessage` **uniquement** — pas de `setLastDiceRoll` |
| `'error'` | toujours | `console.error` **ET** `setGmSocketError` |
| `WOUND_*` / `INVENTORY_*` | — | **hors périmètre** REWORK-11 — ne pas toucher |

---

## DÉCISION

Pattern `useSocket()` interne — idem `useTokenSocket` / `useEntitySocket` / `useCombatSocket` après REWORK-15.

- `setCampaign` passé en param : état partagé REST + WS — ne peut pas vivre dans le hook
- `lastDiceRoll` + `gmSocketError` : uniquement settés par WS → `useState` internes au hook, exposés en retour (idem `reloadResult`/`damagePayload` dans `useCombatSocket`)
- `useTranslation()` : appelé directement dans le hook — `t` stable au sein d'une langue (convention projet : pas dans les deps)
- Deps `useEffect` : `[socket, setCampaign]` — setters Zustand et `t` traités comme stables

**Alternatives écartées :**
- `campaign` dans le hook : impossible — `loadSession` REST appelle aussi `setCampaign`. Nécessiterait d'exposer deux setters distincts (REST vs WS) — couplage inutile
- `chatStore` Zustand pour les messages : surdimensionné — `addMessage` dans `sessionStore` suffit, pattern établi

---

## INTERFACE CIBLE

```js
// client/src/lib/useSessionSocket.js

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { WS } from '../../../shared/events.js'
import { useSocket } from './SocketContext'
import { useSessionStore } from '../stores/sessionStore'
import { useCharacterStore } from '../stores/characterStore'
import { useLibraryStore } from '../stores/libraryStore'

export function useSessionSocket({ setCampaign }) {
  const socket = useSocket()
  const { setOnlineUsers, addOnlineUser, removeOnlineUser, addMessage } = useSessionStore()
  const { upsertCharacter } = useCharacterStore()
  const { addDocument, updateDocument, removeDocument } = useLibraryStore()
  const { t } = useTranslation()

  const [lastDiceRoll, setLastDiceRoll] = useState(null)
  const [gmSocketError, setGmSocketError] = useState(null)

  useEffect(() => {
    if (!socket) return

    const onSessionJoined = ({ userId, onlineUserIds = [] }) =>
      setOnlineUsers(new Set([userId, ...onlineUserIds]))
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
    const onCampaignUpdated = ({ campaign: updated }) =>
      setCampaign(prev => ({ ...prev, ...updated }))
    const onChatMessage = ({ userId, username, color, text, timestamp }) =>
      addMessage({ id: `${userId}-${timestamp}`, user: username, color, text,
        time: new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) })
    const onCharacterUpdated = (updatedCharacter) => upsertCharacter(updatedCharacter)
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
    const onMacroRollResult = ({ characterName, color, sourceLabel, rollResult, threshold,
      isSuccess, isCriticalSuccess, isCriticalFail, formattedMessage, secret, timestamp }) =>
      addMessage({ id: `macro-${timestamp}`, type: 'dice', interactionType: 'macro_result',
        characterName, color, sourceLabel, rollResult, threshold, isSuccess,
        isCriticalSuccess, isCriticalFail, formattedMessage, secret: secret || false,
        time: new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) })
    const onError = (err) => {
      const msg = err?.message ?? String(err)
      console.error('[WS] Erreur serveur:', msg)
      setGmSocketError(msg)
    }
    const onDocCreated = (doc) => addDocument(doc)
    const onDocUpdated = (doc) => updateDocument(doc)
    const onDocDeleted = ({ id }) => removeDocument(id)

    socket.on(WS.SESSION_JOINED,            onSessionJoined)
    socket.on(WS.SESSION_USER_JOINED,       onUserJoined)
    socket.on(WS.SESSION_USER_LEFT,         onUserLeft)
    socket.on(WS.CAMPAIGN_SETTINGS_UPDATED, onCampaignUpdated)
    socket.on(WS.CHAT_MESSAGE,              onChatMessage)
    socket.on(WS.CHARACTER_UPDATED,         onCharacterUpdated)
    socket.on(WS.DICE_RESULT,               onDiceResult)
    socket.on(WS.MACRO_ROLL_RESULT,         onMacroRollResult)
    socket.on('error',                      onError)
    socket.on(WS.DOC_CREATED,              onDocCreated)
    socket.on(WS.DOC_UPDATED,              onDocUpdated)
    socket.on(WS.DOC_DELETED,              onDocDeleted)

    return () => {
      socket.off(WS.SESSION_JOINED,            onSessionJoined)
      socket.off(WS.SESSION_USER_JOINED,       onUserJoined)
      socket.off(WS.SESSION_USER_LEFT,         onUserLeft)
      socket.off(WS.CAMPAIGN_SETTINGS_UPDATED, onCampaignUpdated)
      socket.off(WS.CHAT_MESSAGE,              onChatMessage)
      socket.off(WS.CHARACTER_UPDATED,         onCharacterUpdated)
      socket.off(WS.DICE_RESULT,               onDiceResult)
      socket.off(WS.MACRO_ROLL_RESULT,         onMacroRollResult)
      socket.off('error',                      onError)
      socket.off(WS.DOC_CREATED,              onDocCreated)
      socket.off(WS.DOC_UPDATED,              onDocUpdated)
      socket.off(WS.DOC_DELETED,              onDocDeleted)
    }
  }, [socket, setCampaign])

  return { lastDiceRoll, setLastDiceRoll, gmSocketError, setGmSocketError }
}
```

### SessionContent après REWORK-11 — vue d'ensemble des changements

```js
// ── Imports ──────────────────────────────────────────────────────────────────
import { useSessionSocket } from '../lib/useSessionSocket'   // ← AJOUTER

// ── Stores (zone haute de SessionContent) ────────────────────────────────────
// AVANT :
const { setOnlineUsers, addOnlineUser, removeOnlineUser, addMessage,
        setActiveCampaign, setPendingEntityId } = useSessionStore()
// APRÈS :
const { setActiveCampaign, setPendingEntityId } = useSessionStore()

// AVANT :
const { characters, isGm, setCharacters, setMembers, upsertCharacter, updateCharacter } = useCharacterStore()
// APRÈS :
const { characters, isGm, setCharacters, setMembers, updateCharacter } = useCharacterStore()

// AVANT :
const { setDocuments, addDocument, updateDocument, removeDocument } = useLibraryStore()
// APRÈS :
const { setDocuments } = useLibraryStore()

// ── useState supprimés (L.97-109) ────────────────────────────────────────────
// SUPPRIMER tout ce bloc (commentaire + useState + useCallback) :
// ─── Animation dés (Dice Rework) ───
// const [lastDiceRoll, setLastDiceRoll] = useState(null)
// const handleDiceDone = useCallback(() => setLastDiceRoll(null), [])
// SUPPRIMER :
// // gmSocketError : erreur serveur visible GM (PC22, etc.)
// const [gmSocketError, setGmSocketError] = useState(null)

// ── Zone hooks WS (après tous les useState, L.379+) ──────────────────────────
// Ordre inchangé :
useTokenSocket()
useEntitySocket({ setRadialMenu, setMoveTarget })
const handleModeReset = useCallback(() => { ... }, [])
const combatSocket = useCombatSocket({ isGm, setMode, onModeReset: handleModeReset })
// ← AJOUTER ICI (après combatSocket) :
const { lastDiceRoll, setLastDiceRoll, gmSocketError, setGmSocketError } =
  useSessionSocket({ setCampaign })
// ← AJOUTER ICI (handleDiceDone déplacé depuis L.101 — voir P-R11-1) :
const handleDiceDone = useCallback(() => setLastDiceRoll(null), [setLastDiceRoll])

// ── useEffect([socket]) de SessionContent ────────────────────────────────────
// Supprimer les 12 handlers nommés + leurs 12 socket.off symétriques :
// onSessionJoined, onUserJoined, onUserLeft, onCampaignUpdated, onChatMessage,
// onCharacterUpdated, onDiceResult, onMacroRollResult, onError,
// onDocCreated, onDocUpdated, onDocDeleted
```

---

## PÉRIMÈTRE

**Fichiers touchés :**
- `client/src/lib/useSessionSocket.js` — **créé**
- `client/src/pages/SessionPage.jsx` (SessionContent, post-REWORK-15) :
  - Bloc L.97-101 supprimé (commentaire + `lastDiceRoll` useState + `handleDiceDone` useCallback)
  - Bloc L.108-109 supprimé (commentaire + `gmSocketError` useState)
  - `useSessionStore()` : `setOnlineUsers, addOnlineUser, removeOnlineUser, addMessage` retirés
  - `useCharacterStore()` : `upsertCharacter` retiré
  - `useLibraryStore()` : `addDocument, updateDocument, removeDocument` retirés
  - `useSessionSocket({ setCampaign })` déclaré après `combatSocket`
  - `handleDiceDone` recréé après `useSessionSocket`
  - 12 handlers + 12 `socket.off` supprimés du `useEffect([socket])`

**Fichiers NON touchés :**
- `shared/events.js` — aucun event nouveau
- `client/src/stores/sessionStore.js` — non modifié
- `client/src/stores/characterStore.js` — non modifié
- `client/src/stores/libraryStore.js` — non modifié
- `useTokenSocket.js`, `useEntitySocket.js`, `useCombatSocket.js` — non touchés
- `CharacterWindow`, `Canvas3D`, `CombatOverlay` — mêmes props, source déplacée
- Tout le code serveur

**Prérequis :** REWORK-15 terminé et validé — `SocketContext.jsx` + `useSocket()` doivent exister.

---

## PLAN D'IMPLÉMENTATION

### Étape 1 — Créer `client/src/lib/useSessionSocket.js`

Contenu exact : interface cible ci-dessus.
Aucun fichier existant modifié à cette étape.
Run à vide : `npm run build` — zéro erreur, zéro warning.

---

### Étape 2 — Intégrer dans `SessionPage.jsx` (SessionContent)

**Lire SessionPage.jsx avant de coder** — vérifier que les lignes correspondent (post-REWORK-15, numéros décalés).

**2a — Import** (après les imports hooks existants) :
```js
import { useSessionSocket } from '../lib/useSessionSocket'
```

**2b — Supprimer le bloc `lastDiceRoll` + `handleDiceDone`** (L.97-101 actuels, chercher par contenu) :
```js
// SUPPRIMER tout ce bloc :
// ─── Animation dés (Dice Rework) ────────────────────────────────────────────
// null = pas d'animation, sinon payload DICE_RESULT du dernier jet normal.
// Jets d'entité (skillLabel défini) → exclus, pas d'animation.
const [lastDiceRoll, setLastDiceRoll] = useState(null)
const handleDiceDone = useCallback(() => setLastDiceRoll(null), [])
```
⚠️ `handleDiceDone` sera recréé en 2g — ne pas oublier la 2e ligne.

**2c — Supprimer le bloc `gmSocketError`** (L.108-109 actuels) :
```js
// SUPPRIMER :
// gmSocketError : erreur serveur visible GM (PC22, etc.)
const [gmSocketError, setGmSocketError] = useState(null)
```

**2d — `useSessionStore` — retirer les 4 fonctions devenues inutiles** :
Grep `addMessage|setOnlineUsers|addOnlineUser|removeOnlineUser` dans SessionPage.jsx — confirmer qu'ils n'apparaissent que dans les 12 handlers (P-R11-3). Puis :
```js
// AVANT :
const { setOnlineUsers, addOnlineUser, removeOnlineUser, addMessage,
        setActiveCampaign, setPendingEntityId } = useSessionStore()
// APRÈS :
const { setActiveCampaign, setPendingEntityId } = useSessionStore()
```

**2e — `useCharacterStore` — retirer `upsertCharacter`** :
```js
// AVANT :
const { characters, isGm, setCharacters, setMembers, upsertCharacter, updateCharacter } = useCharacterStore()
// APRÈS (REWORK-12 non encore fait) :
const { characters, isGm, setCharacters, setMembers, updateCharacter } = useCharacterStore()
```

**2f — `useLibraryStore` — retirer les 3 fonctions** :
Grep `addDocument|updateDocument|removeDocument` dans SessionPage.jsx — confirmer qu'ils n'apparaissent que dans les 12 handlers (P-R11-2). Puis :
```js
// AVANT :
const { setDocuments, addDocument, updateDocument, removeDocument } = useLibraryStore()
// APRÈS :
const { setDocuments } = useLibraryStore()
```

**2g — Déclarer le hook + rétablir `handleDiceDone`** (après `combatSocket`) :
```js
// Après :  const combatSocket = useCombatSocket({ isGm, setMode, onModeReset: handleModeReset })
// Ajouter :
const { lastDiceRoll, setLastDiceRoll, gmSocketError, setGmSocketError } =
  useSessionSocket({ setCampaign })
const handleDiceDone = useCallback(() => setLastDiceRoll(null), [setLastDiceRoll])
```

**2h — `useEffect([socket])` de SessionContent** — supprimer les 12 handlers nommés + leurs 12 `socket.off` symétriques :
`onSessionJoined`, `onUserJoined`, `onUserLeft`, `onCampaignUpdated`, `onChatMessage`,
`onCharacterUpdated`, `onDiceResult`, `onMacroRollResult`, `onError`,
`onDocCreated`, `onDocUpdated`, `onDocDeleted`

Run à vide : SR + `npm run build` — ouvrir une session, envoyer un message, faire un jet de dé.

---

## VALIDATION

| # | Scénario | Résultat attendu |
|---|---|---|
| V1 | Ouverture session | `SESSION_JOINED` → `onlineUsers` peuplé dans sessionStore |
| V2 | Joueur rejoint | `SESSION_USER_JOINED` → message système affiché dans chat |
| V3 | Joueur quitte | `SESSION_USER_LEFT` → message système affiché dans chat |
| V4 | GM change timer campagne | `CAMPAIGN_SETTINGS_UPDATED` → `campaign.action_timer_sec` à jour dans CombatOverlay |
| V5 | Message chat | `CHAT_MESSAGE` → affiché dans Sidebar |
| V6 | Fiche PJ mise à jour (WS) | `CHARACTER_UPDATED` → characterStore mis à jour, CharacterWindow rafraîchit |
| V7 | Jet de dé normal | `DICE_RESULT` → message ajouté **et** animation dés déclenchée (Canvas3D) |
| V8 | Jet d'entité (skillLabel défini) | `DICE_RESULT` → message ajouté, **pas** d'animation dés |
| V9 | Jet de macro | `MACRO_ROLL_RESULT` → message `type='dice'` `interactionType='macro_result'` dans chat |
| V10 | Erreur serveur WS | `'error'` → `gmSocketError` visible dans CombatOverlay |
| V11 | Fermer erreur GM | `onGmSocketErrorClose` → `setGmSocketError(null)` → overlay fermé |
| V12 | Document créé/modifié/supprimé | `DOC_*` → libraryStore mis à jour |

---

## DEFINITION OF DONE

- [ ] `client/src/lib/useSessionSocket.js` créé — 12 handlers nommés + `useSocket()` + retour `{ lastDiceRoll, setLastDiceRoll, gmSocketError, setGmSocketError }`
- [ ] Handlers nommés — `socket.off(event, namedFn)` symétrique pour les 12 (dont `'error'` string brut)
- [ ] `setCampaign` en param + dans deps `[socket, setCampaign]`
- [ ] `lastDiceRoll` + `gmSocketError` en `useState` internes au hook
- [ ] Asymétrie DICE_RESULT préservée : `setLastDiceRoll` uniquement si `skillLabel === undefined`
- [ ] Bloc L.97-101 (commentaire + `lastDiceRoll` useState + `handleDiceDone` useCallback) supprimé de SessionContent
- [ ] Bloc L.108-109 (commentaire + `gmSocketError` useState) supprimé de SessionContent
- [ ] `useSessionStore()` dans SessionContent : uniquement `{ setActiveCampaign, setPendingEntityId }`
- [ ] `useCharacterStore()` dans SessionContent : `upsertCharacter` retiré
- [ ] `useLibraryStore()` dans SessionContent : uniquement `{ setDocuments }`
- [ ] `useSessionSocket({ setCampaign })` déclaré après `combatSocket`
- [ ] `handleDiceDone = useCallback(() => setLastDiceRoll(null), [setLastDiceRoll])` déclaré après `useSessionSocket`
- [ ] 12 handlers + 12 `socket.off` supprimés du `useEffect([socket])` de SessionContent
- [ ] `npm run build` — zéro erreur, zéro warning
- [ ] Scénarios V1–V12 validés
- [ ] `docs/ARCHI_REWORK.md` — entrée REWORK-11 ajoutée dans "Reworks achevés" + spec intégrée
- [ ] `docs/JOURNAL5.md` appended

---

## REPRENDRE ICI — POST-COMPACT

**État courant : planification Session 113b — plan corrigé (v2). En attente de validation Saar.**

Fichiers lus en session 113b (ne pas relire sauf si lignes décalées après REWORK-15) :
- `docs/ARCHI_REWORK.md` — spec REWORK-15 + table prochains reworks
- `docs/PLAN_REWORK15.md` — plan implémentation REWORK-15 (lignes clés documentées)
- `docs/PLAN_REWORK12.md` — plan REWORK-12 (marqué obsolète — interface cible à mettre à jour post-REWORK-15)
- `client/src/pages/SessionPage.jsx` — 1296 lignes, lignes clés documentées ci-dessus

Prochaine étape : **validation Saar → "Je code ?" → Étape 1 (créer useSessionSocket.js)**
