# PLAN_REWORK12.md — useCharacterSocket
> Session 113 — 2026-06-20 | Archivé Session 113 — 2026-06-21

---

> ✅ **SPEC COMPLÈTE RÉDIGÉE — `docs/ARCHI_REWORK.md` §REWORK-12**
>
> Architecture post-REWORK-15 : `useSocket()` + `useEffect([socket])` + handlers nommés + cleanup. Pas de `listen(s)`.
>
> **Ce fichier archivé.** Les sections §État actuel et §Asymétries ci-dessous restent lisibles comme contexte historique.
> Spec active → `docs/ARCHI_REWORK.md` §REWORK-12

---

---

### REWORK-12 — `useCharacterSocket` (blessures + inventaire)

**Problème** :
6 listeners WS (`WOUND_ADDED/UPDATED/REMOVED`, `INVENTORY_ADDED/UPDATED/REMOVED`) + le `useState` `woundVersions` sont inline dans `SessionPage.jsx` L.103–487. Le nouveau frontend (fusion imminente) doit recréer intégralement ce bloc plutôt que de l'importer — même problème que REWORK-09 réglait pour les tokens/entités/combat.

Preuves :
- `woundVersions` useState — `client/src/pages/SessionPage.jsx` L.106
- 6 listeners `s.on(WS.WOUND_*)` / `s.on(WS.INVENTORY_*)` — `SessionPage.jsx` L.468–487
- `woundReloadKey={woundVersions[selectedCharacter?.id] ?? 0}` — `SessionPage.jsx` L.1068

**État actuel** :
```js
// SessionPage.jsx L.103–106
const [woundVersions, setWoundVersions] = useState({})

// SessionPage.jsx L.468–487 (dans le useEffect socket)
s.on(WS.WOUND_ADDED, ({ characterId, worst_wound_severity }) => {
  setWoundVersions(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
  updateCharacter({ id: characterId, worst_wound_severity })
})
s.on(WS.WOUND_UPDATED, ({ characterId, worst_wound_severity }) => {
  if (characterId) setWoundVersions(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
  updateCharacter({ id: characterId, worst_wound_severity })
})
s.on(WS.WOUND_REMOVED, ({ characterId, worst_wound_severity }) => {
  if (characterId) setWoundVersions(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
  updateCharacter({ id: characterId, worst_wound_severity })
})
s.on(WS.INVENTORY_ADDED, ({ characterId }) => {
  if (characterId) setWoundVersions(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
})
s.on(WS.INVENTORY_UPDATED, ({ characterId }) => {
  if (characterId) setWoundVersions(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
})
s.on(WS.INVENTORY_REMOVED, ({ characterId }) => {
  if (characterId) setWoundVersions(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
})

// SessionPage.jsx L.1068 (render CharacterWindow)
woundReloadKey={woundVersions[selectedCharacter?.id] ?? 0}
```

**Asymétries à préserver impérativement** :

| Event | `setWoundVersions` guard `if (characterId)` | `updateCharacter` appelé |
|---|---|---|
| `WOUND_ADDED` | ❌ pas de guard | ✅ oui |
| `WOUND_UPDATED` | ✅ guard | ✅ oui |
| `WOUND_REMOVED` | ✅ guard | ✅ oui |
| `INVENTORY_ADDED` | ✅ guard | ❌ non |
| `INVENTORY_UPDATED` | ✅ guard | ❌ non |
| `INVENTORY_REMOVED` | ✅ guard | ❌ non |

Note : `updateCharacter` dans `WOUND_UPDATED` et `WOUND_REMOVED` est appelé **sans** guard même si `setWoundVersions` a le guard — comportement existant, à reproduire fidèlement.

**Décision** :
Pattern identique aux hooks REWORK-09 (`useTokenSocket`, `useEntitySocket`, `useCombatSocket`) :
- `listen(s)` impérative — fonction ordinaire, pas un `useCallback` (non dans les deps du useEffect socket)
- `woundVersions` reste un `useState` local au hook — exposé comme valeur de retour
- Le hook accède à `useCharacterStore` en interne (comme `useCombatSocket` accède à `useCombatStore`)
- Le hook expose `{ listen, woundVersions }`

Alternative écartée — nouveau store `woundVersionStore` Zustand : surdimensionné pour un compteur éphémère de UI state.

Alternative identifiée mais hors périmètre — supprimer `woundVersions` entièrement (voir §Dettes) : les pros utilisent des subscriptions Zustand directes plutôt qu'un compteur passé en prop. Applicable partiellement ici, mais nécessite de modifier `CharacterWindow` — hors périmètre REWORK-12.

Alternative écartée — socket Context/Provider : pattern recommandé officiellement par Socket.io pour React (les pros ne passent pas le socket en paramètre). Applicable uniquement via un REWORK-15 dédié — refonte complète de l'architecture socket de `SessionPage`.

**Interface cible** :

```js
// client/src/lib/useCharacterSocket.js

import { useState } from 'react'
import { WS } from '../../../shared/events.js'
import { useCharacterStore } from '../stores/characterStore'

export function useCharacterSocket() {
  const { updateCharacter } = useCharacterStore()
  const [woundVersions, setWoundVersions] = useState({})

  function listen(s) {
    s.on(WS.WOUND_ADDED, ({ characterId, worst_wound_severity }) => {
      setWoundVersions(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
      updateCharacter({ id: characterId, worst_wound_severity })
    })
    s.on(WS.WOUND_UPDATED, ({ characterId, worst_wound_severity }) => {
      if (characterId) setWoundVersions(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
      updateCharacter({ id: characterId, worst_wound_severity })
    })
    s.on(WS.WOUND_REMOVED, ({ characterId, worst_wound_severity }) => {
      if (characterId) setWoundVersions(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
      updateCharacter({ id: characterId, worst_wound_severity })
    })
    s.on(WS.INVENTORY_ADDED, ({ characterId }) => {
      if (characterId) setWoundVersions(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
    })
    s.on(WS.INVENTORY_UPDATED, ({ characterId }) => {
      if (characterId) setWoundVersions(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
    })
    s.on(WS.INVENTORY_REMOVED, ({ characterId }) => {
      if (characterId) setWoundVersions(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
    })
  }

  return { listen, woundVersions }
}
```

**Périmètre** :

Fichiers touchés :
- `client/src/lib/useCharacterSocket.js` — **créé**
- `client/src/pages/SessionPage.jsx` — 6 listeners supprimés du useEffect, 1 useState supprimé, `updateCharacter` retiré du destructuring, 1 hook ajouté, 1 prop mise à jour

Fichiers NON touchés :
- `client/src/character/CharacterWindow.jsx` — prop `woundReloadKey` inchangée
- `shared/events.js` — aucun event nouveau
- `client/src/stores/characterStore.js` — inchangé
- `useTokenSocket.js`, `useEntitySocket.js`, `useCombatSocket.js` — non touchés
- Tout le code serveur — non touché

**Plan** :

#### Étape 1 — Créer `client/src/lib/useCharacterSocket.js`

Créer le fichier avec exactement l'interface cible ci-dessus.
Aucune modification de SessionPage à cette étape.
Run à vide : `npm run build` (client) — zéro erreur, zéro warning.

#### Étape 2 — Intégrer dans `SessionPage.jsx`

Modifications exactes dans cet ordre :

**2a — Import** (L.17, après les imports hooks existants) :
```js
import { useCharacterSocket } from '../lib/useCharacterSocket'
```

**2b — Supprimer `woundVersions` useState** (L.103–106) :
```js
// SUPPRIMER intégralement ce bloc :
// ─── Reload blessures — déclenché par WOUND_ADDED (socket) ───────────────
// Map { characterId → counter } — incrémenté à chaque blessure reçue.
// Passé à CharacterWindow → bumpInventoryVersion() → ArmorWoundPanel reload.
const [woundVersions, setWoundVersions] = useState({})
```

**2c — Retirer `updateCharacter` du destructuring** (L.37) :
```js
// AVANT :
const { characters, isGm, setCharacters, setMembers, upsertCharacter, updateCharacter } = useCharacterStore()
// APRÈS :
const { characters, isGm, setCharacters, setMembers, upsertCharacter } = useCharacterStore()
```

**2d — Déclarer `characterSocket`** après `combatSocket` (L.385) :
```js
const characterSocket = useCharacterSocket()
```
Règle TDZ : déclaré après tous les `useState` de SessionPage.

**2e — Dans le useEffect socket** — ajouter `characterSocket.listen(s)` groupé avec les 3 autres appels `.listen` en tête du useEffect (pattern canonique REWORK-09, rule react.md) :
```js
// L.392–394 — AVANT :
tokenSocket.listen(s)
entitySocket.listen(s)
combatSocket.listen(s)
// APRÈS :
tokenSocket.listen(s)
entitySocket.listen(s)
combatSocket.listen(s)
characterSocket.listen(s)   // ← ajout ici, PAS à L.468
```
Puis supprimer les 6 `s.on(WS.WOUND_*)` / `s.on(WS.INVENTORY_*)` inline (L.468–487) sans les remplacer.

**2f — Render CharacterWindow** (L.1068) :
```js
// AVANT :
woundReloadKey={woundVersions[selectedCharacter?.id] ?? 0}
// APRÈS :
woundReloadKey={characterSocket.woundVersions[selectedCharacter?.id] ?? 0}
```

Run à vide : `npm run build` client — zéro erreur, zéro warning.

**Validation** :

| # | Scénario | Résultat attendu |
|---|---|---|
| V1 | GM inflige une blessure à un PJ (flow normal) | `CharacterWindow` PJ recharge `ArmorWoundPanel` automatiquement |
| V2 | GM stabilise une blessure (`WOUND_UPDATED`) | `CharacterWindow` recharge, `worst_wound_severity` mis à jour dans le store |
| V3 | GM supprime une blessure (`WOUND_REMOVED`) | `CharacterWindow` recharge, `worst_wound_severity` mis à jour dans le store |
| V4 | GM ajoute un item inventaire au PJ | `CharacterWindow` ouverte sur ce PJ recharge |
| V5 | Item inventaire modifié ou supprimé | `CharacterWindow` recharge |
| V6 | Deux `CharacterWindow` ouvertes (PJ A + PJ B) | Seule la fenêtre du PJ concerné recharge (clé par characterId) |
| V7 | `CharacterWindow` fermée au moment du `WOUND_ADDED` | Pas de crash — `woundVersions` mis à jour silencieusement |
| V8 | Reconnexion socket (`reconnectTrigger` incrémente) | `woundVersions` persiste dans le hook (le useState ne remonte pas) — nouveaux événements incrémentent normalement |

**Definition of done** :

- [ ] `client/src/lib/useCharacterSocket.js` créé — `listen(s)` + `{ listen, woundVersions }` exporté
- [ ] Asymétries du tableau préservées : `WOUND_ADDED` sans guard / `WOUND_UPDATED`+`WOUND_REMOVED`+`INVENTORY_*` avec guard
- [ ] `WOUND_*` (3) appellent `updateCharacter` — `INVENTORY_*` (3) n'appellent **pas** `updateCharacter`
- [ ] `updateCharacter` dans `WOUND_UPDATED` et `WOUND_REMOVED` appelé **sans** guard (même si `setWoundVersions` a le guard)
- [ ] `woundVersions` useState (L.103–106) supprimé de `SessionPage.jsx`
- [ ] `updateCharacter` retiré du destructuring `useCharacterStore()` L.37
- [ ] 6 listeners inline (L.468–487) supprimés du useEffect de `SessionPage.jsx`
- [ ] `characterSocket.listen(s)` ajouté en tête du useEffect avec les 3 autres `.listen(s)` — PAS à L.468
- [ ] `characterSocket = useCharacterSocket()` déclaré après tous les useState (règle TDZ)
- [ ] `woundReloadKey={characterSocket.woundVersions[...] ?? 0}` dans le render
- [ ] `npm run build` client — zéro erreur
- [ ] Scénarios V1–V8 validés
- [ ] `docs/ARCHI_REWORK.md` — entrée REWORK-12 ✅ ajoutée dans "Reworks achevés"
- [ ] `docs/JOURNAL5.md` appended

---

## Dettes identifiées — hors périmètre REWORK-12

**Dette D12-1 — `woundVersions` → subscription Zustand directe**
Les pros utilisent des subscriptions Zustand plutôt que des compteurs passés en prop (pattern "direct store dispatch"). Simplification possible : `CharacterWindow` regarde `character.worst_wound_severity` directement via `useEffect` au lieu de recevoir `woundReloadKey`. Bloqué par les `INVENTORY_*` qui ne touchent pas `worst_wound_severity` — nécessite d'ajouter un champ `reloadVersion` dans `characterStore` ou un signal séparé. Touche `CharacterWindow` et `characterStore` — sprint dédié.

**Dette D12-2 — Socket Context/Provider (futur REWORK-15)**
Socket.io recommande officiellement un Provider React pour éviter de passer le socket en paramètre aux hooks. `listen(s)` est un anti-pattern documenté. Refonte de l'architecture socket de `SessionPage` — périmètre complet, sprint dédié post-fusion.
