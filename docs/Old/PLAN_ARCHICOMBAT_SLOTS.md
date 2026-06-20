# PLAN — Architecture Combat : correction split-brain slots
> Session 92-4 — 2026-06-14
> Statut : **PRÊT À CODER** — plan validé, non encore appliqué

---

## Cause racine

**Deux sources de vérité pour "qui est le slot actif" :**

| | Source | Calcul |
|---|---|---|
| Serveur (`COMBAT_ACTION_CONFIRM`) | `combat_roster WHERE has_announced=true ORDER BY initiative DESC` | index `active_slot_idx` dans cette liste filtrée |
| Client (`CombatOverlay`) | `[...roster].sort(...)` | index `activeSlotIdx` dans le roster COMPLET (non filtré) |

Si un token non-annoncé a une INI plus haute que les annoncés, il apparaît en tête du roster client. L'index 0 pointe alors vers le mauvais token. Tout ce qui en découle (quelle fenêtre s'affiche, quel `tokenId` est envoyé dans CONFIRM) est faux.

**Problème secondaire :** `startResolutionPhase` envoie le roster complet + TOUTES les `combat_actions` (y compris données périmées). Des tokens fantômes de tours précédents peuvent polluer la résolution.

**Problème tertiaire :** `COMBAT_ACTION_DECLARE` set `has_announced=true` même si aucune action valide n'a été insérée (ex. : déclaration CaC sans cible). Token annoncé sans action en DB → CONFIRM accepté, rien ne se passe.

---

## Solution

**Principe :** le serveur envoie un `tokenId` absolu. Le client cherche par `token_id`, pas par index.

---

## Correction 1 — `CombatOverlay.jsx`

**Fichier :** `client/src/components/CombatOverlay.jsx`

### 1a — Ligne 20 : ajouter `activeTokenId` au destructuring

```jsx
// AVANT
const { phase, roster, activeSlotIdx, actions } = useCombatStore()

// APRÈS
const { phase, roster, activeSlotIdx, activeTokenId, actions } = useCombatStore()
```

### 1b — Ligne 39 : `gmActiveEntry` par tokenId, pas par index

```jsx
// AVANT
const gmActiveEntry = sortedRoster[activeSlotIdx]

// APRÈS
const gmActiveEntry = roster.find(e => e.token_id === activeTokenId) ?? null
```

> `sortedRoster` reste inchangé — il sert à l'ordre visuel de la timeline, plus à la logique du slot actif.

### 1c — Lignes 56 et 60 : conditions joueur par tokenId

```jsx
// AVANT (lignes 56 et 60, identiques)
(phase === 'RESOLUTION' && sortedRoster[activeSlotIdx]?.token_id === playerToken?.id)

// APRÈS (les deux lignes)
(phase === 'RESOLUTION' && activeTokenId === playerToken?.id)
```

### Ce qui ne change pas dans ce fichier
- Ligne 38 : `sortedRoster = [...roster].sort(...)` — inchangé
- Ligne 55 : `playerRosterEntry = sortedRoster.find(e => e.token_id === playerToken.id)` — déjà correct
- Toute la section rendu JSX (lignes 64+) — inchangée

---

## Correction 2 — `startResolutionPhase` dans `server/src/socket/index.js`

**Lignes concernées : 2998–3016**

### 2a — Remplacer les 2 queries par 3 queries filtrées

```js
// AVANT
const [roster, actions] = await Promise.all([
  db('combat_roster').where({ campaign_id: campaignId }).orderBy('initiative', 'desc'),
  db('combat_actions').where({ campaign_id: campaignId }).orderBy('sequence', 'asc'),
])

// APRÈS
const [announcedRoster, pendingActions, fullRoster] = await Promise.all([
  db('combat_roster')
    .where({ campaign_id: campaignId, status: 'active', has_announced: true })
    .orderBy('initiative', 'desc'),
  db('combat_actions')
    .where({ campaign_id: campaignId, status: 'pending' })
    .orderBy('sequence', 'asc'),
  db('combat_roster')
    .where({ campaign_id: campaignId })
    .orderBy('initiative', 'desc'),
])
```

### 2b — Utiliser les données propres dans les émissions

```js
// AVANT
const broadcastRoster = roster.map(({ surprise_roll: _sr, ...rest }) => rest)
combatPreviews.delete(campaignId)
io.to(campaignId).emit(WS.COMBAT_PHASE_CHANGED, {
  phase: 'RESOLUTION',
  roster: broadcastRoster,
  actions,
})
io.to(campaignId).emit(WS.COMBAT_SLOT_ADVANCED, {
  activeSlotIdx: 0,
  tokenId: broadcastRoster[0]?.token_id ?? null,
})

// APRÈS
const broadcastRoster = fullRoster.map(({ surprise_roll: _sr, ...rest }) => rest)
combatPreviews.delete(campaignId)
io.to(campaignId).emit(WS.COMBAT_PHASE_CHANGED, {
  phase: 'RESOLUTION',
  roster: broadcastRoster,      // roster complet → timeline affiche les 6 tokens
  actions: pendingActions,      // seulement pending → pas de données périmées
})
io.to(campaignId).emit(WS.COMBAT_SLOT_ADVANCED, {
  activeSlotIdx: 0,
  tokenId: announcedRoster[0]?.token_id ?? null,  // depuis liste filtrée has_announced
})
```

### Ce qui ne change pas dans cette fonction
- `active_slot_idx: 0` en DB (ligne 2996) — inchangé
- Le log ligne 3018 — inchangé
- `advanceSlot` — inchangé (envoie déjà le bon `tokenId`)

---

## Correction 3 — `COMBAT_ACTION_DECLARE` dans `server/src/socket/index.js`

**Position : avant le roster UPDATE (actuellement ligne 2155)**

### Ajouter le guard melee sans cible

```js
// Insérer AVANT le bloc "UPDATE combat_roster" (avant ligne 2155)

// Guard : CaC déclaré sans cible → has_announced non settée, erreur explicite
if (Array.isArray(mapActions?.melee)
    && mapActions.melee.length > 0
    && !mapActions.melee.some(m => m.targetTokenId)) {
  socket.emit(WS.COMBAT_DECLARE_ERROR, { message: 'Corps à corps : sélectionner une cible avant de valider.' })
  return
}
```

### Pourquoi ce guard est nécessaire

Sans lui, un token peut avoir `has_announced=true` (visible dans les slots) sans aucune ligne dans `combat_actions` (CONFIRM accepté mais rien à résoudre). L'UX est muette et le slot est consommé pour rien.

### Ce qui ne change pas dans COMBAT_ACTION_DECLARE
- Ligne 2173 : `if (actionRows.length > 0) await db('combat_actions').insert(actionRows)` — inchangé
- Toute la logique assault / move / reload / phrase — inchangée
- Le broadcast `COMBAT_ACTION_DECLARED` — inchangé

---

## Récapitulatif

| Fichier | Section | Lignes | Nature |
|---|---|---|---|
| `CombatOverlay.jsx` | Destructuring store | 20 | +`activeTokenId` |
| `CombatOverlay.jsx` | gmActiveEntry | 39 | `roster.find` → tokenId |
| `CombatOverlay.jsx` | Conditions joueur | 56, 60 | `activeTokenId ===` |
| `index.js` | startResolutionPhase | 2998–3001 | 3 queries filtrées |
| `index.js` | startResolutionPhase | 3007–3016 | pendingActions + announcedRoster[0] |
| `index.js` | COMBAT_ACTION_DECLARE | avant 2155 | guard melee sans cible |

**Nouveaux composants :** aucun  
**Nouveaux events WS :** aucun  
**Migrations DB :** aucune  
**Fichiers non touchés :** `combatStore.js`, `CombatCacModifiersWindow.jsx`, `CombatTimeline.jsx`, `resolveMeleeAction`, `resolveAssaultAction`, `COMBAT_ACTION_CONFIRM`, `advanceSlot`, `endTurn`

---

## Procédure de validation

1. SR (redémarrer serveur)
2. Démarrer un combat avec 6 tokens, dont au moins 1 avec INI naturelle haute (non annoncé)
3. Faire déclarer 4 tokens seulement
4. Vérifier que `startResolutionPhase` → log montre uniquement les 4 tokens annoncés dans `COMBAT_SLOT_ADVANCED`
5. Vérifier que `CombatCacModifiersWindow` s'affiche pour CHAQUE slot CaC annoncé (plus de `mods:null` pour des tokens qui ont déclaré)
6. Vérifier que les tokens non-annoncés n'apparaissent pas dans la résolution
7. Tenter de déclarer un CaC sans cible → vérifier le `COMBAT_DECLARE_ERROR`
8. Cycle complet : 4 déclarations → 4 résolutions → endTurn (aucun fantôme)
