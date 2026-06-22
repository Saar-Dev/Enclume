# PLAN_REWORK13.md — useBattlemapManager + campaignStore
> Session 113b — 2026-06-21 | En cours de rédaction

---

## ⚠️ INSTRUCTIONS DE RÉCUPÉRATION POST-COMPACT

Si tu reprends depuis un résumé ou un compact :
1. Lire `CLAUDE.md` (instructions + méthode de travail)
2. Lire `docs/ARCHI_REWORK.md` §REWORK-13 (quand la spec y sera intégrée)
3. Lire ce fichier en entier
4. Aller à la section **REPRENDRE ICI** en bas → étape courante + fichiers à lire
5. NE PAS re-planifier. NE PAS poser de questions. Coder directement après "Je code ?".

---

## CONTEXTE

Fusion frontend imminente : un confrère refond le playground (SessionPage) + éditeur (Editor3D).
Audit merge-readiness Session 113 → extraction des blocs extractables de `SessionPage.jsx`.

**Ce que REWORK-13 change :**
- `campaign` objet extrait de `useState` local → `campaignStore` Zustand (nouveau fichier)
- 8 handlers CRUD carte + 7 useStates UI + 1 useRef + 1 useEffect extraits → `useBattlemapManager` (nouveau fichier)
- `SessionContent` : ~40 lignes de callbacks + ~20 lignes de useState supprimées

**Prérequis : REWORK-15 (`SocketProvider`) livré et validé** — `useSocket()` disponible pour MAP_SWITCH.
REWORK-15 prérequis car `useBattlemapManager` utilise `useSocket()` pour émettre `MAP_SWITCH`.

**Impact sur REWORK-11 (`useSessionSocket`) :**
Créer `campaignStore` avant REWORK-11 évite le param `{ setCampaign }` dans `useSessionSocket`.
Le handler `CAMPAIGN_SETTINGS_UPDATED` appellera `updateCampaign()` du store directement.
→ Si REWORK-13 passe AVANT REWORK-11 : PLAN_REWORK11.md doit être mis à jour (voir §Impact REWORK-11).
→ Si REWORK-11 passe AVANT REWORK-13 : REWORK-13 devra modifier `useSessionSocket.js` pour retirer le param `setCampaign`.

**Recommandation : REWORK-13 (Étape 1 — campaignStore) avant REWORK-11.**

---

## ÉTAT ACTUEL (lu Session 113b — SessionPage.jsx)

### `campaign` useState (à migrer vers campaignStore)

```js
// SessionPage.jsx L.51
const [campaign, setCampaign] = useState(null)

// Setté par :
// L.151 — loadSession REST : setCampaign(campaignData)
// L.417-419 — CAMPAIGN_SETTINGS_UPDATED WS : setCampaign(prev => ({ ...prev, ...updated }))
// L.294 — handleSetDefault : setCampaign(prev => ({ ...prev, default_battlemap_id: bm.id }))

// Consommé par :
// L.56 — document.title = campaign?.name ? `Enclume — ${campaign.name}` : 'Enclume — Session'
// L.828-830 — Canvas3D prop defaultTokenGlbUrl — campaign?.default_token_glb_url
// L.1143 — CombatOverlay prop actionTimerSec — campaign?.action_timer_sec ?? 0
```

### UI state battlemap (à migrer vers useBattlemapManager)

```js
// SessionPage.jsx L.135-141
const [mapContextMenu, setMapContextMenu] = useState(null)     // { bm, x, y } | null
const mapContextMenuRef = useRef(null)
const [showRenameModal, setShowRenameModal] = useState(false)
const [renameTarget, setRenameTarget] = useState(null)         // bm à renommer
const [renameValue, setRenameValue] = useState('')
const [showCreateModal, setShowCreateModal] = useState(false)
const [createMapName, setCreateMapName] = useState('')
```

### Handlers battlemap (8 — à migrer vers useBattlemapManager)

```js
// L.232-248 — loadMap(battlemapId) — REST GET battlemap + tokens + entities
//   → setBattlemap, setTokens, setEntities
//   → appelé par: handleMapSwitch, handleMapDelete, gmBar buttons
//   → DOIT être exposé par le hook (gmBar : onClick={() => loadMap(bm.id)})

// L.253-256 — handleMapSwitch(battlemapId) — loadMap + socket.emit(MAP_SWITCH)
//   → INTERNE au hook (appelé uniquement par handleGroupMove)

// L.278-288 — handleMapRename() — REST PUT + renameBattlemap + close modal
//   → deps: [renameTarget, renameValue]

// L.291-299 — handleSetDefault(bm) — REST PUT + updateCampaign({ default_battlemap_id })
//   → deps: [campaignId]

// L.302-305 — handleGroupMove(bm) — wrapper handleMapSwitch
//   → deps: [handleMapSwitch]

// L.308-316 — handleMapDuplicate(bm) — REST POST + addBattlemap
//   → deps: []

// L.319-339 — handleMapDelete(bm) — REST DELETE + removeBattlemap
//   → lit battlemaps et battlemap du store pour décider le fallback
//   → deps: [battlemap?.id, battlemaps, loadMap, t]

// L.342-352 — handleMapCreate() — REST POST + addBattlemap + close modal
//   → deps: [createMapName, campaignId]
```

### Effet à migrer (1)

```js
// SessionPage.jsx L.265-275 — fermeture mapContextMenu sur clic extérieur
useEffect(() => {
  if (!mapContextMenu) return
  const handleMouseDown = (e) => {
    if (mapContextMenuRef.current && !mapContextMenuRef.current.contains(e.target)) {
      setMapContextMenu(null)
    }
  }
  document.addEventListener('mousedown', handleMouseDown)
  return () => document.removeEventListener('mousedown', handleMouseDown)
}, [mapContextMenu])
```

### Consommation dans le JSX (garde dans SessionContent — ne crée pas de composant)

```
gmBar (L.760-790)      → loadMap + setMapContextMenu
mapContextMenu (L.969-1012) → ref=mapContextMenuRef + handlers CRUD + setRenameTarget/Value + setShowRenameModal + setMapContextMenu + openCreateModal
showRenameModal (L.1014-1036) → setShowRenameModal + renameValue/setRenameValue + handleMapRename
showCreateModal (L.1037-1060) → setShowCreateModal + createMapName/setCreateMapName + handleMapCreate
```

### Stores existants utilisés par ces handlers

| Action store | Source | Utilisée par |
|---|---|---|
| `setBattlemap` | `useMapStore` | `loadMap`, `handleMapDelete` fallback vide |
| `setBattlemaps` | `useMapStore` | `loadSession` (hors scope) |
| `renameBattlemap` | `useMapStore` | `handleMapRename` |
| `addBattlemap` | `useMapStore` | `handleMapDuplicate`, `handleMapCreate` |
| `removeBattlemap` | `useMapStore` | `handleMapDelete` |
| `setTokens` | `useTokenStore` | `loadMap`, `handleMapDelete` fallback vide |
| `setEntities` | `useEntityStore` | `loadMap` |
| `updateCampaign` | `useCampaignStore` (à créer) | `handleSetDefault` |

---

## ARCHITECTURE — DÉCISIONS

### Partie A — `campaignStore`

**Décision : store Zustand séparé.**
Justification : Zustand recommande des stores par domaine (discussions pmndrs/zustand #2496).
`campaign` (name, default_token_glb_url, action_timer_sec, default_battlemap_id) est orthogonal
aux cartes (mapStore) et à la session (sessionStore). La séparation évite les couplages accidentels.

Alternative écartée — ajouter à `mapStore` : les deux pourraient co-évoluer si une campagne change
de cartes, mais dans ce codebase, `mapStore` est reset par `loadSession` indépendamment de `campaign`.
Alternative écartée — ajouter à `sessionStore` : `sessionStore` gère chat + users — pas les métadonnées.

**API du store :**
```js
// client/src/stores/campaignStore.js
{
  campaign: null,
  setCampaign: (campaign) => set({ campaign }),
  // Merge partiel — CAMPAIGN_SETTINGS_UPDATED + handleSetDefault
  // null guard : si campaign pas encore chargé, updateCampaign est no-op
  updateCampaign: (partial) => set(state => ({
    campaign: state.campaign ? { ...state.campaign, ...partial } : state.campaign
  })),
}
```

### Partie B — `useBattlemapManager`

**Décision : hook React gérant CRUD + UI state + ref outside-click.**
Justification recherche : React docs + shadcn + Zustand patterns valident qu'un custom hook
peut gérer à la fois la logique CRUD et les états UI des modaux déclencheurs.
La ref `mapContextMenuRef` est retournée par le hook — pattern `useClickOutside` validé par
sergeyleschev/react-custom-hooks et la documentation React officielle.

**Params du hook : `{ campaignId, isGm }`**
- `campaignId` : UUID string — nécessaire pour REST `/campaigns/${campaignId}/battlemaps`
- `isGm` : boolean — guard dans `loadMap`
- `socket` NON passé en param — obtenu via `useSocket()` interne (post-REWORK-15)

**Orchestration cross-store dans le hook** (pattern validé par pmndrs/zustand discussion #630) :
`loadMap` appelle `setBattlemap + setTokens + setEntities` depuis 3 stores distincts.
L'orchestration reste dans le hook, jamais dans un store action.

**Helpers internes exposés au lieu d'exposer les setters bruts :**
Au lieu de `setShowRenameModal + setRenameTarget + setRenameValue + setMapContextMenu`
→ exposer `openRenameModal(bm)` qui encapsule la séquence (voir §Interface cible).

---

## INTERFACE CIBLE

### Part A — `client/src/stores/campaignStore.js` (nouveau)

```js
import { create } from 'zustand'

export const useCampaignStore = create((set) => ({
  campaign: null,

  // Remplacement complet — loadSession REST (SessionContent) + changement de campagne
  setCampaign: (campaign) => set({ campaign }),

  // Merge partiel — CAMPAIGN_SETTINGS_UPDATED WS + handleSetDefault
  // No-op si campaign pas encore chargé (null guard).
  updateCampaign: (partial) => set((state) => ({
    campaign: state.campaign ? { ...state.campaign, ...partial } : state.campaign,
  })),
}))
```

### Part B — `client/src/lib/useBattlemapManager.js` (nouveau)

```js
import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { WS } from '../../../shared/events.js'
import { useSocket } from './SocketContext'
import { useMapStore } from '../stores/mapStore'
import { useTokenStore } from '../stores/tokenStore'
import { useEntityStore } from '../stores/entityStore'
import { useCampaignStore } from '../stores/campaignStore'
import api from './api'

export function useBattlemapManager({ campaignId, isGm }) {
  const socket = useSocket()
  const { t } = useTranslation()
  const { battlemap, battlemaps, setBattlemap, renameBattlemap, addBattlemap, removeBattlemap } = useMapStore()
  const { setTokens } = useTokenStore()
  const { setEntities } = useEntityStore()
  const { updateCampaign } = useCampaignStore()

  // ─── UI state ────────────────────────────────────────────────────────────────
  const [mapContextMenu, setMapContextMenu] = useState(null)  // { bm, x, y } | null
  const mapContextMenuRef = useRef(null)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [renameTarget, setRenameTarget] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createMapName, setCreateMapName] = useState('')

  // ─── Fermeture mapContextMenu sur clic extérieur ──────────────────────────
  useEffect(() => {
    if (!mapContextMenu) return
    const handleMouseDown = (e) => {
      if (mapContextMenuRef.current && !mapContextMenuRef.current.contains(e.target)) {
        setMapContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [mapContextMenu])

  // ─── Helpers ouverture modaux ────────────────────────────────────────────────
  // Encapsule la séquence multi-setters → JSX SessionContent plus lisible
  const openRenameModal = useCallback((bm) => {
    setRenameTarget(bm)
    setRenameValue(bm.name)
    setShowRenameModal(true)
    setMapContextMenu(null)
  }, [])

  const openCreateModal = useCallback(() => {
    setMapContextMenu(null)
    setCreateMapName('')
    setShowCreateModal(true)
  }, [])

  // ─── loadMap — REST GET battlemap + tokens + entités ───────────────────────
  const loadMap = useCallback(async (battlemapId) => {
    if (!isGm) return
    try {
      const mapRes = await api.get(`/battlemaps/${battlemapId}`)
      setBattlemap(mapRes.data.battlemap)
      setTokens(mapRes.data.tokens || [])
      try {
        const entitiesRes = await api.get(`/battlemaps/${battlemapId}/entities`)
        setEntities(entitiesRes.data.entities || [])
      } catch (err) {
        console.error('Erreur chargement entités :', err)
        setEntities([])
      }
    } catch (err) {
      console.error('Erreur chargement carte :', err)
    }
  }, [isGm])

  // ─── handleMapSwitch — interne (appelé par handleGroupMove uniquement) ──────
  const handleMapSwitch = useCallback(async (battlemapId) => {
    await loadMap(battlemapId)
    socket?.emit(WS.MAP_SWITCH, { battlemapId, userIds: [] })
  }, [loadMap, socket])

  // ─── CRUD handlers ────────────────────────────────────────────────────────────
  const handleMapRename = useCallback(async () => {
    if (!renameTarget || !renameValue.trim()) return
    try {
      await api.put(`/battlemaps/${renameTarget.id}`, { name: renameValue.trim() })
      renameBattlemap(renameTarget.id, renameValue.trim())
      setShowRenameModal(false)
      setRenameTarget(null)
    } catch (err) {
      console.error('Erreur renommage carte :', err)
    }
  }, [renameTarget, renameValue, renameBattlemap])

  const handleSetDefault = useCallback(async (bm) => {
    try {
      await api.put(`/campaigns/${campaignId}`, { default_battlemap_id: bm.id })
      updateCampaign({ default_battlemap_id: bm.id })
    } catch (err) {
      console.error('Erreur définition page d\'accueil :', err)
    }
    setMapContextMenu(null)
  }, [campaignId, updateCampaign])

  const handleGroupMove = useCallback(async (bm) => {
    setMapContextMenu(null)
    await handleMapSwitch(bm.id)
  }, [handleMapSwitch])

  const handleMapDuplicate = useCallback(async (bm) => {
    setMapContextMenu(null)
    try {
      const res = await api.post(`/battlemaps/${bm.id}/duplicate`)
      addBattlemap(res.data.battlemap)
    } catch (err) {
      console.error('Erreur duplication carte :', err)
    }
  }, [addBattlemap])

  const handleMapDelete = useCallback(async (bm) => {
    setMapContextMenu(null)
    if (!window.confirm(t('session.deleteMapConfirm', { name: bm.name }))) return
    try {
      await api.delete(`/battlemaps/${bm.id}`)
      const remaining = battlemaps.filter(m => m.id !== bm.id)
      removeBattlemap(bm.id)
      if (battlemap?.id === bm.id) {
        if (remaining.length > 0) {
          await loadMap(remaining[0].id)
        } else {
          setBattlemap(null)
          setTokens([])
        }
      }
    } catch (err) {
      console.error('Erreur suppression carte :', err)
    }
  }, [battlemap?.id, battlemaps, loadMap, t])

  const handleMapCreate = useCallback(async () => {
    if (!createMapName.trim()) return
    try {
      const res = await api.post(`/campaigns/${campaignId}/battlemaps`, { name: createMapName.trim() })
      addBattlemap(res.data.battlemap)
      setCreateMapName('')
      setShowCreateModal(false)
    } catch (err) {
      console.error('Erreur création carte :', err)
    }
  }, [createMapName, campaignId, addBattlemap])

  return {
    // Chargement — exposé pour gmBar (onClick={() => loadMap(bm.id)})
    loadMap,
    // Context menu
    mapContextMenu,
    setMapContextMenu,
    mapContextMenuRef,
    // Helpers modaux (remplacent les séquences multi-setters inline)
    openRenameModal,
    openCreateModal,
    // Handlers CRUD (utilisés dans le menu contextuel)
    handleSetDefault,
    handleGroupMove,
    handleMapDuplicate,
    handleMapDelete,
    // Rename modal
    showRenameModal,
    setShowRenameModal,
    renameValue,
    setRenameValue,
    handleMapRename,
    // Create modal
    showCreateModal,
    setShowCreateModal,
    createMapName,
    setCreateMapName,
    handleMapCreate,
  }
}
```

### SessionContent après REWORK-13 — vue d'ensemble des changements

```js
// ── Imports ──────────────────────────────────────────────────────────────────
import { useCampaignStore } from '../stores/campaignStore'         // ← AJOUTER
import { useBattlemapManager } from '../lib/useBattlemapManager'   // ← AJOUTER

// ── Stores (zone haute de SessionContent) ────────────────────────────────────
// AVANT :
const { battlemap, battlemaps, setBattlemap, setBattlemaps, renameBattlemap, addBattlemap, removeBattlemap } = useMapStore()
// APRÈS :
const { battlemap, battlemaps, setBattlemap, setBattlemaps } = useMapStore()
// (renameBattlemap, addBattlemap, removeBattlemap → internes au hook)

// AVANT :
const [campaign, setCampaign] = useState(null)
// APRÈS :
const { campaign, setCampaign } = useCampaignStore()

// ── useState supprimés (L.135-141) ───────────────────────────────────────────
// SUPPRIMER :
// const [mapContextMenu, setMapContextMenu] = useState(null)
// const mapContextMenuRef = useRef(null)
// const [showRenameModal, setShowRenameModal] = useState(false)
// const [renameTarget, setRenameTarget] = useState(null)
// const [renameValue, setRenameValue] = useState('')
// const [showCreateModal, setShowCreateModal] = useState(false)
// const [createMapName, setCreateMapName] = useState('')

// ── Callbacks supprimés ───────────────────────────────────────────────────────
// SUPPRIMER : loadMap, handleMapSwitch, handleMapRename, handleSetDefault,
//             handleGroupMove, handleMapDuplicate, handleMapDelete, handleMapCreate

// ── useEffect supprimé ────────────────────────────────────────────────────────
// SUPPRIMER : useEffect mapContextMenu outside-click (L.265-275)

// ── Zone hooks WS (après tous les useState) ───────────────────────────────────
// AJOUTER après combatSocket (ou après useSessionSocket si REWORK-11 déjà fait) :
const {
  loadMap,
  mapContextMenu, setMapContextMenu, mapContextMenuRef,
  openRenameModal, openCreateModal,
  handleSetDefault, handleGroupMove, handleMapDuplicate, handleMapDelete,
  showRenameModal, setShowRenameModal, renameValue, setRenameValue, handleMapRename,
  showCreateModal, setShowCreateModal, createMapName, setCreateMapName, handleMapCreate,
} = useBattlemapManager({ campaignId, isGm })

// ── JSX — context menu et modaux ─────────────────────────────────────────────
// Changer dans le menu contextuel :
// AVANT :
onClick={() => {
  setRenameTarget(mapContextMenu.bm)
  setRenameValue(mapContextMenu.bm.name)
  setShowRenameModal(true)
  setMapContextMenu(null)
}}
// APRÈS :
onClick={() => openRenameModal(mapContextMenu.bm)}

// AVANT :
onClick={() => {
  setMapContextMenu(null)
  setCreateMapName('')
  setShowCreateModal(true)
}}
// APRÈS :
onClick={() => openCreateModal()}

// Toutes les autres références (showRenameModal, renameValue, handleMapRename, etc.)
// gardent le même nom — proviennent du hook au lieu du useState local.
```

---

## IMPACT SUR REWORK-11 (useSessionSocket)

**Problème :** PLAN_REWORK11.md a été rédigé en supposant que `campaign` reste un `useState` dans SessionContent.
Le hook `useSessionSocket` reçoit `{ setCampaign }` en param et l'utilise dans `onCampaignUpdated`.

**Si REWORK-13 passe AVANT REWORK-11 :**
`CAMPAIGN_SETTINGS_UPDATED` est encore inline dans SessionContent au moment de REWORK-13.
À migrer : le handler inline appelle `updateCampaign(updated)` au lieu de `setCampaign(prev => ({...prev, ...updated}))`.
Puis PLAN_REWORK11.md doit être mis à jour :
```js
// AVANT (PLAN_REWORK11.md interface cible) :
export function useSessionSocket({ setCampaign }) {
  // ...
  const onCampaignUpdated = ({ campaign: updated }) =>
    setCampaign(prev => ({ ...prev, ...updated }))

// APRÈS (corrigé post-REWORK-13) :
export function useSessionSocket() {  // plus de param
  const { updateCampaign } = useCampaignStore()
  // ...
  const onCampaignUpdated = ({ campaign: updated }) => updateCampaign(updated)
```
Deps useEffect : `[socket]` au lieu de `[socket, setCampaign]`.

**Si REWORK-11 passe AVANT REWORK-13 :**
`useSessionSocket.js` existe avec le param `{ setCampaign }`.
REWORK-13 devra modifier `useSessionSocket.js` :
- Ajouter `import { useCampaignStore }` + `const { updateCampaign } = useCampaignStore()`
- Remplacer `setCampaign(prev => ({...prev, ...updated}))` par `updateCampaign(updated)`
- Retirer `setCampaign` des params + des deps useEffect

**Et dans SessionContent :**
`useSessionSocket()` appelé sans args au lieu de `useSessionSocket({ setCampaign })`.

---

## PIÈGES IDENTIFIÉS (run à vide)

**P-R13-1 — `useEntitySocket` a déjà un handler `MAP_SWITCH` entrant (coexistence intentionnelle)**
`useEntitySocket.js` L.19-30 enregistre `s.on(WS.MAP_SWITCH, ...)` qui fetch indépendamment
le battlemap + tokens + entités via `api.get` + stores directs (`setBattlemap`, `setTokens`, `setEntities`).
Ce handler est déclenché par le broadcast serveur (ex : GM déplace le groupe → tous les joueurs basculent).
`loadMap` dans `useBattlemapManager` est déclenché par le GM cliquant un bouton (REST, local uniquement).
**Les deux coexistent volontairement — flux distincts, pas de duplication à éliminer dans ce rework.**
Dette identifiée : les deux font le même fetch — extract `fetchBattlemapData(id)` utilitaire = sprint futur.

**P-R13-2 — `window.confirm` dans `handleMapDelete`**
`handleMapDelete` appelle `window.confirm(...)`. Acceptable dans ce hook car le codebase utilise
déjà ce pattern (code original L.321). Hook pas pur (side effect UI) — documenté, non bloquant.

**P-R13-3 — `battlemaps` réactif dans `handleMapDelete` deps**
`battlemaps` (tableau) vient de `useMapStore()`. Zustand garantit l'égalité référentielle par mutation
des champs seulement. `handleMapDelete` se recrée si `battlemaps` change — comportement attendu
(la liste doit être à jour pour calculer `remaining` après suppression).

**P-R13-4 — `handleMapRename` et `handleMapCreate` sans `renameBattlemap`/`addBattlemap` dans SessionContent**
Après Étape 4b, `renameBattlemap` et `addBattlemap` sont retirés du destructuring `useMapStore()`
dans SessionContent. Mais `handleMapRename` et `handleMapCreate` sont dans le hook — ils ont accès
aux actions via le `useMapStore()` interne au hook. Aucun impact sur le reste de SessionContent.

**P-R13-5 — `updateCampaign` reste nécessaire dans SessionContent après Étape 4**
`handleSetDefault` (toujours inline à l'Étape 2) doit appeler `updateCampaign` au lieu de `setCampaign`.
Il faudra l'ajouter au destructuring `useCampaignStore()` dès l'Étape 2.
À l'Étape 4, `handleSetDefault` migre dans le hook — mais `CAMPAIGN_SETTINGS_UPDATED` reste encore inline
dans SessionContent (REWORK-11 non fait). Ce handler appelle `updateCampaign(updated)` directement.
Donc `updateCampaign` reste dans le destructuring de SessionContent après REWORK-13.
Il ne sera retiré que quand REWORK-11 migre `CAMPAIGN_SETTINGS_UPDATED` vers `useSessionSocket`.

---

## PÉRIMÈTRE

**Fichiers touchés :**
- `client/src/stores/campaignStore.js` — **créé** (Étape 1)
- `client/src/lib/useBattlemapManager.js` — **créé** (Étape 3)
- `client/src/pages/SessionPage.jsx` (SessionContent, post-REWORK-15) :
  - Étape 2 : `campaign` useState → `useCampaignStore`, `loadSession` + handler `CAMPAIGN_SETTINGS_UPDATED` mis à jour
  - Étape 4 : 7 useState + 1 useRef + 8 callbacks + 1 useEffect supprimés, hook déclaré, JSX adapté

**Fichiers NON touchés :**
- `client/src/stores/mapStore.js` — inchangé (ses actions sont utilisées en interne par le hook)
- `client/src/stores/tokenStore.js` — inchangé
- `client/src/stores/entityStore.js` — inchangé
- `shared/events.js` — aucun event nouveau
- `useTokenSocket.js`, `useEntitySocket.js`, `useCombatSocket.js` — non touchés
- Tout le code serveur — non touché

**Fichiers mis à jour selon l'ordre d'exécution :**
- `docs/PLAN_REWORK11.md` — interface cible `useSessionSocket` à corriger (retirer `{ setCampaign }`)
  → si REWORK-13 avant REWORK-11
- `client/src/lib/useSessionSocket.js` — retirer `{ setCampaign }` + utiliser `useCampaignStore`
  → si REWORK-11 avant REWORK-13

---

## PLAN D'IMPLÉMENTATION

> Préférable de faire les Étapes 1–4 en une même session pour éviter la confusion entre états intermédiaires.
> Test runtime uniquement après Étape 4.

### Étape 1 — Créer `client/src/stores/campaignStore.js`

Contenu exactement conforme à l'interface cible §campaignStore.
Aucun fichier existant modifié à cette étape.
Run à vide : `npm run build` — zéro erreur.

---

### Étape 2 — Migrer `campaign` dans SessionContent

**Lire `SessionPage.jsx` avant de coder — vérifier les lignes exactes (post-REWORK-15, décalées).**

**2a — Import** :
```js
import { useCampaignStore } from '../stores/campaignStore'
```

**2b — Supprimer le `useState` campaign** (chercher par contenu) :
```js
// SUPPRIMER :
const [campaign, setCampaign] = useState(null)
```
Ajouter à la place, groupé avec les autres stores en haut de SessionContent :
```js
const { campaign, setCampaign } = useCampaignStore()
```

**2c — `loadSession` — aucune modification** :
`setCampaign(campaignData)` à L.151 reste identique — l'action du store a la même signature.

**2d — Handler `CAMPAIGN_SETTINGS_UPDATED` inline** (dans `useEffect([socket]`) :
```js
// AVANT :
const onCampaignUpdated = ({ campaign: updated }) =>
  setCampaign(prev => ({ ...prev, ...updated }))

// APRÈS :
const onCampaignUpdated = ({ campaign: updated }) =>
  updateCampaign(updated)
```
Nécessite d'ajouter `updateCampaign` au destructuring `useCampaignStore()` :
```js
const { campaign, setCampaign, updateCampaign } = useCampaignStore()
```

**2e — `handleSetDefault`** : remplacer la ligne inline :
```js
// AVANT :
setCampaign(prev => ({ ...prev, default_battlemap_id: bm.id }))
// APRÈS :
updateCampaign({ default_battlemap_id: bm.id })
```
(Sera ensuite supprimé à l'Étape 4 quand `handleSetDefault` migre dans le hook.)

Run à vide : `npm run build` — zéro erreur, zéro warning.

---

### Étape 3 — Créer `client/src/lib/useBattlemapManager.js`

Contenu exactement conforme à l'interface cible §useBattlemapManager.
Aucun fichier existant modifié à cette étape.
Run à vide : `npm run build` — zéro erreur.

---

### Étape 4 — Intégrer `useBattlemapManager` dans SessionContent

**Lire `SessionPage.jsx` avant de coder — vérifier les lignes exactes post-REWORK-15 (+Étape 2).**

**4a — Import** :
```js
import { useBattlemapManager } from '../lib/useBattlemapManager'
```

**4b — `useMapStore` : retirer les 3 actions devenues internes au hook** :
```js
// AVANT :
const { battlemap, battlemaps, setBattlemap, setBattlemaps,
        renameBattlemap, addBattlemap, removeBattlemap } = useMapStore()
// APRÈS :
const { battlemap, battlemaps, setBattlemap, setBattlemaps } = useMapStore()
```

**4c — Supprimer les 7 useState + 1 useRef** (chercher par contenu) :
```js
// SUPPRIMER (L.135-141 actuels — chercher par contenu) :
const [mapContextMenu, setMapContextMenu] = useState(null)
const mapContextMenuRef = useRef(null)
const [showRenameModal, setShowRenameModal] = useState(false)
const [renameTarget, setRenameTarget] = useState(null)
const [renameValue, setRenameValue] = useState('')
const [showCreateModal, setShowCreateModal] = useState(false)
const [createMapName, setCreateMapName] = useState('')
```

**4d — Supprimer les 8 callbacks** (chercher par nom) :
`loadMap`, `handleMapSwitch`, `handleMapRename`, `handleSetDefault`,
`handleGroupMove`, `handleMapDuplicate`, `handleMapDelete`, `handleMapCreate`

**4e — Supprimer l'useEffect outside-click** (chercher par contenu `mapContextMenu`) :
```js
// SUPPRIMER le bloc useEffect L.265-275 :
useEffect(() => {
  if (!mapContextMenu) return
  const handleMouseDown = ...
  document.addEventListener(...)
  return () => document.removeEventListener(...)
}, [mapContextMenu])
```

**4f — Déclarer le hook** (après les autres hooks WS, règle TDZ) :
```js
const {
  loadMap,
  mapContextMenu, setMapContextMenu, mapContextMenuRef,
  openRenameModal, openCreateModal,
  handleSetDefault, handleGroupMove, handleMapDuplicate, handleMapDelete,
  showRenameModal, setShowRenameModal, renameValue, setRenameValue, handleMapRename,
  showCreateModal, setShowCreateModal, createMapName, setCreateMapName, handleMapCreate,
} = useBattlemapManager({ campaignId, isGm })
```

**4g — JSX : 2 séquences multi-setters → helpers** (chercher par contenu) :

Dans le menu contextuel — renommage :
```jsx
// AVANT :
onClick={() => {
  setRenameTarget(mapContextMenu.bm)
  setRenameValue(mapContextMenu.bm.name)
  setShowRenameModal(true)
  setMapContextMenu(null)
}}
// APRÈS :
onClick={() => openRenameModal(mapContextMenu.bm)}
```

Dans le menu contextuel — création :
```jsx
// AVANT :
onClick={() => {
  setMapContextMenu(null)
  setCreateMapName('')
  setShowCreateModal(true)
}}
// APRÈS :
onClick={() => openCreateModal()}
```

Toutes les autres références aux états et handlers (showRenameModal, renameValue,
handleMapRename, showCreateModal, createMapName, handleMapCreate, handleSetDefault, etc.)
gardent le même nom et n'ont pas besoin de modification dans le JSX.

Run à vide : SR + `npm run build` — ouvrir une session, tester la barre GM.

---

## VALIDATION

| # | Scénario | Résultat attendu |
|---|---|---|
| V1 | Ouverture session | `campaign` chargé dans `useCampaignStore`, titre onglet correct |
| V2 | `CAMPAIGN_SETTINGS_UPDATED` WS | `campaign` mis à jour dans le store, `action_timer_sec` reflété dans CombatOverlay |
| V3 | Clic carte dans la barre GM | `loadMap` → battlemap + tokens + entités chargés |
| V4 | Clic droit sur bouton carte → menu contextuel | Ouvre menu, se ferme sur clic extérieur |
| V5 | "Renommer" → modal → save | REST PUT, `renameBattlemap` → nom mis à jour dans la liste |
| V6 | "Définir comme accueil" | REST PUT `/campaigns/`, `updateCampaign({ default_battlemap_id })` |
| V7 | "Déplacer le groupe" | `loadMap` + `MAP_SWITCH` émis, todos les joueurs basculent |
| V8 | "Dupliquer" | REST POST, nouvelle carte ajoutée dans la barre GM |
| V9 | "Supprimer" carte non active | Confirmation → REST DELETE → retirée de la liste |
| V10 | "Supprimer" carte active (avec cartes restantes) | REST DELETE → `loadMap(remaining[0].id)` |
| V11 | "Supprimer" dernière carte | REST DELETE → `setBattlemap(null)` + `setTokens([])` |
| V12 | "Créer" → modal → save | REST POST → nouvelle carte dans la barre GM |
| V13 | `defaultTokenGlbUrl` Canvas3D | `campaign?.default_token_glb_url` lu depuis le store |
| V14 | `actionTimerSec` CombatOverlay | `campaign?.action_timer_sec ?? 0` lu depuis le store |

---

## DEFINITION OF DONE

### campaignStore

- [x] `client/src/stores/campaignStore.js` créé — `{ campaign, setCampaign, updateCampaign }`
- [x] `updateCampaign` : no-op si `campaign` est null (null guard)
- [x] `campaign` `useState` (L.51) supprimé de SessionContent
- [x] `useCampaignStore()` destructuré dans SessionContent : `{ campaign, setCampaign, updateCampaign }`
- [x] `loadSession` : `setCampaign(campaignData)` inchangé (signature compatible)
- [x] Handler inline `CAMPAIGN_SETTINGS_UPDATED` : `updateCampaign(updated)` au lieu de `setCampaign(prev => ...)`
- [x] `handleSetDefault` inline (avant migration Étape 4) : `updateCampaign({ default_battlemap_id: bm.id })`
- [x] `npm run build` — zéro erreur après Étape 2

### useBattlemapManager

- [ ] `client/src/lib/useBattlemapManager.js` créé — conforme à l'interface cible
- [ ] `useSocket()` utilisé en interne (pas de `socket` en param)
- [ ] `mapContextMenuRef` créé dans le hook, retourné, attaché au DOM dans SessionContent
- [ ] `useEffect` outside-click dans le hook (pas dans SessionContent)
- [ ] `openRenameModal(bm)` et `openCreateModal()` encapsulent les séquences multi-setters
- [ ] `handleMapSwitch` INTERNE au hook — non exposé dans le return
- [ ] `handleMapDelete` : `battlemaps` et `battlemap?.id` lus depuis `useMapStore()` interne
- [ ] 7 `useState` + 1 `useRef` supprimés de SessionContent
- [ ] 8 callbacks (`loadMap`, `handleMapSwitch`, `handleMapRename`, `handleSetDefault`, `handleGroupMove`, `handleMapDuplicate`, `handleMapDelete`, `handleMapCreate`) supprimés de SessionContent
- [ ] 1 `useEffect` outside-click supprimé de SessionContent
- [ ] `useMapStore()` : uniquement `{ battlemap, battlemaps, setBattlemap, setBattlemaps }` dans SessionContent
- [ ] `useBattlemapManager({ campaignId, isGm })` déclaré après tous les useState (règle TDZ)
- [ ] JSX : 2 séquences multi-setters → `openRenameModal` + `openCreateModal`
- [ ] Toutes autres références JSX au même nom (non impactées)
- [ ] `npm run build` — zéro erreur après Étape 4
- [ ] SR — zéro erreur

### Coordination REWORK-11

- [ ] Si REWORK-13 avant REWORK-11 : `docs/PLAN_REWORK11.md` mis à jour (retirer `{ setCampaign }` param)
- [ ] Si REWORK-11 avant REWORK-13 : `client/src/lib/useSessionSocket.js` mis à jour (retirer param, utiliser `useCampaignStore`)

### Documentation

- [ ] Scénarios V1–V14 validés
- [ ] `docs/ARCHI_REWORK.md` — entrée REWORK-13 ajoutée dans "Reworks achevés" + spec intégrée
- [ ] `docs/JOURNAL5.md` appended

---

## REPRENDRE ICI — POST-COMPACT

**État courant : Session 115 suite 2 — Étapes 1+2 ✅ — Étape 3 suivante.**

### ✅ Étape 1 — `campaignStore.js` créé (Session 115 suite 2)
- `client/src/stores/campaignStore.js` — conforme §Interface cible — build ✅

### ✅ Étape 2 — `campaign` migré dans SessionContent (Session 115 suite 2)
- Import ajouté, `useState(null)` supprimé, `useCampaignStore()` destructuré
- `onCampaignUpdated` → `updateCampaign(updated)` ✅
- `handleSetDefault` → `updateCampaign({ default_battlemap_id: bm.id })` ✅
- build ✅

### Prochaine étape : **Étape 3 — Créer `useBattlemapManager.js`**
→ Contenu exact dans §Interface cible §useBattlemapManager ci-dessus.
→ Aucun fichier existant modifié à cette étape — créer le fichier, `npm run build`.
→ Puis Étape 4 : lire SessionPage.jsx avant de coder (lignes décalées post-Étapes 1+2).
