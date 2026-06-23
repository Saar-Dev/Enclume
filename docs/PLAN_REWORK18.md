# PLAN_REWORK18.md — socketCombatHelpers.js : séparation computation / émission
> Rédigé Session 117 — 2026-06-23 | Spec complète Session 118 — 2026-06-23
> Plan COMPLET — prêt à implémenter après validation par Saar.
> **Prérequis : REWORK-17 ✅ validé.**

---

## Objectif

`socketCombatHelpers.js` contient 3 fonctions resolve qui mélangent computation et émission socket :

| Fonction | Lignes | Émissions directes |
|---|---|---|
| `resolveMeleeAction` | L.323–810 (~490L) | 11 |
| `resolveDroneAssaultAction` | L.952–1248 (~296L) | 12 |
| `resolveAssaultAction` | L.1250–1567 (~317L) | 7 |

Conséquence : ces fonctions sont impossibles à tester unitairement sans mocker `io` + `socket`, et les émissions sont éparpillées dans la logique de calcul.

**État actuel** : `server/src/socket/socketCombatHelpers.js` — 3 fonctions exportées, mélange computation + émission. Cartographie complète des émissions et points de sortie → section dédiée ci-dessous.

---

## Pattern retenu : Effect Queue (Functional Core / Imperative Shell — partiel)

**Références pro :**
- **boardgame.io** `ctx.events` — les moves accumulent des effets dans une file pendant leur exécution ; le flush se fait après le retour de la fonction, par la couche master (jamais dans la move elle-même).
- **Colyseus Command Pattern** — `execute()` retourne une structure ; le Dispatcher est le seul responsable du transport.
- **Game Programming Patterns §Event Queue** — computation accumule `{ to, event, data }` ; dispatch séparé après calcul complet.

**Raison du "partiel" :**
Les 3 fonctions délèguent également des émissions à 5 services qui prennent `io` en paramètre :

| Service | Call sites dans les 3 fonctions |
|---|---|
| `woundService.applyWound(io, db, ...)` | resolveMeleeAction |
| `damageService.resolveTargetHit(io, db, ...)` | resolveAssaultAction |
| `statusService.applyStun(io, db, ...)` | resolveMeleeAction, resolveAssaultAction |
| `statusService.emitShockDiceResult(io, ...)` | resolveMeleeAction, resolveAssaultAction |
| `resolveDroneIntegrityLoss(io, ...)` | resolveMeleeAction, resolveDroneAssaultAction, resolveAssaultAction |

Ces services sont **hors périmètre**. `io` reste en paramètre des 3 fonctions pour délégation aux services uniquement.

**Changement concret :**
- `socket` supprimé des 3 signatures — jamais passé aux services, seulement utilisé dans `socket.emit()` direct
- Tous les `io.to(campaignId).emit()` et `socket.emit()` **directs** → descripteurs d'émission `{ to, event, data }`
- `io.fetchSockets()` → déplacé dans `flushEmissions` (handler), supprimé des helpers
- DB writes (`combat_pending`, `setFSMSubPhase`) restent dans les helpers (inchangés)

**Alternatives écartées :**
- **Full FCIS (refactorer les 5 services)** — cascade trop large pour un seul rework. `io` resterait en signature même refactoré : les services sont réseau par nature.
- **Callback injection** `emit(event, data)` passé en paramètre — non sérialisable, plus complexe à tester que des descripteurs littéraux.
- **EventEmitter local par appel** — overhead inutile pour un usage jetable, ne produit pas de liste inspectable après coup.
- **Statu quo** — 30 émissions éparpillées dans le calcul, testabilité unitaire impossible sans mocker `io` + `socket`.

---

## Ce que ce rework NE fait PAS

- Refactorer `woundService`, `damageService`, `statusService`, `resolveDroneIntegrityLoss`
- Changer les règles de résolution combat
- Toucher au client
- Modifier `advanceSlot`, `endTurn`, `resolveReloadAction`, `skipPlayer`, `startResolutionPhase`
- Regrouper avec un autre rework

---

## Interface cible

### Signatures

```js
// AVANT:
resolveMeleeAction(io, socket, campaignId, action, character, remainingMeleeActions, totalMeleeCount, confirmedModifiers, pendingMaps)
// APRÈS:
resolveMeleeAction(io, campaignId, action, character, remainingMeleeActions, totalMeleeCount, confirmedModifiers, pendingMaps)
// Retourne: { suspend: bool, emissions: [] }
// suspend: true  = PJ défenseur → slot bloqué (AWAITING_DEFENSE)
// suspend: false = PNJ/drone/entité → advanceSlot

// AVANT:
resolveDroneAssaultAction(io, socket, campaignId, action, confirmedModifiers, character, pendingMaps, options)
// APRÈS:
resolveDroneAssaultAction(io, campaignId, action, confirmedModifiers, character, pendingMaps, options)
// Retourne: { suspend: false, emissions: [] }

// AVANT:
resolveAssaultAction(io, socket, campaignId, action, confirmedModifiers, character, pendingMaps, options)
// APRÈS:
resolveAssaultAction(io, campaignId, action, confirmedModifiers, character, pendingMaps, options)
// Retourne: { suspend: false, emissions: [] }
// Toujours false — FSM gère AWAITING_DAMAGE séparément via setFSMSubPhase
```

### Structure d'un descripteur d'émission

```js
// Broadcast room :
{ to: 'room', event: WS.DICE_RESULT, data: { ... } }

// Socket de l'attaquant (anciennement socket.emit) :
{ to: 'socket', event: WS.COMBAT_ATTACK_PLAYER_RESULT, data: { ... } }

// Socket ciblé par userId (anciennement io.fetchSockets + userSocket.emit) :
{ to: 'user', userId: defenderCharacter.user_id, event: WS.COMBAT_MELEE_DEFENSE_PROMPT, data: prompt, fallback: 'room' }
// fallback: 'room'   → broadcast si socket introuvable (GM remplaçant)
// fallback: 'socket' → socket attaquant si socket introuvable (drone damage prompt)
```

### flushEmissions — nouveau helper local dans socketCombatResolution.js

```js
async function flushEmissions(io, socket, campaignId, emissions, preloadedSockets = null) {
  const needsLookup = emissions.some(e => e.to === 'user')
  const allSockets = needsLookup ? (preloadedSockets ?? await io.fetchSockets()) : []
  for (const e of emissions) {
    if (e.to === 'room') {
      io.to(campaignId).emit(e.event, e.data)
    } else if (e.to === 'socket') {
      socket.emit(e.event, e.data)
    } else if (e.to === 'user') {
      const s = allSockets.find(s => s.user?.id === e.userId && s.campaignId === campaignId)
      if (s) {
        s.emit(e.event, e.data)
      } else if (e.fallback === 'room') {
        io.to(campaignId).emit(e.event, e.data)
      } else {
        socket.emit(e.event, e.data)
      }
    }
  }
}
```

`preloadedSockets` — évite un double `io.fetchSockets()` dans `COMBAT_MELEE_DEFENSE_CONFIRM` qui en a déjà besoin pour retrouver `attackerSocket` (voir A7).

### Call sites mis à jour dans socketCombatResolution.js

```js
// ── COMBAT_ACTION_CONFIRM ────────────────────────────────────────────────────

// L.170 — AVANT:
await resolveAssaultAction(io, socket, campaignId, action, confirmedModifiers, character, pendingMaps)
// APRÈS:
const assaultResult = await resolveAssaultAction(io, campaignId, action, confirmedModifiers, character, pendingMaps)
if (assaultResult) await flushEmissions(io, socket, campaignId, assaultResult.emissions)

// L.187 — AVANT:
await resolveDroneAssaultAction(io, socket, campaignId, meleeActions[0], confirmedModifiers, character, pendingMaps)
// APRÈS:
const droneResult = await resolveDroneAssaultAction(io, campaignId, meleeActions[0], confirmedModifiers, character, pendingMaps)
if (droneResult) await flushEmissions(io, socket, campaignId, droneResult.emissions)

// L.189 — AVANT:
needsDefenseWait = await resolveMeleeAction(
  io, socket, campaignId, meleeActions[0], character,
  meleeActions.slice(1), meleeActions.length, confirmedModifiers, pendingMaps
)
// APRÈS:
const meleeResult = await resolveMeleeAction(
  io, campaignId, meleeActions[0], character,
  meleeActions.slice(1), meleeActions.length, confirmedModifiers, pendingMaps
)
if (meleeResult) {
  await flushEmissions(io, socket, campaignId, meleeResult.emissions)
  needsDefenseWait = meleeResult.suspend
}

// ── COMBAT_MELEE_DEFENSE_CONFIRM ─────────────────────────────────────────────

// L.560-568 — AVANT:
const allSockets = await io.fetchSockets()
const attackerSocket = allSockets.find(
  s => s.campaignId === meleeCampaignId && s.user?.id === attackerCharacter.user_id
) || socket
const waitForNext = await resolveMeleeAction(
  io, attackerSocket, meleeCampaignId,
  nextAction, attackerCharacter,
  restActions, pendingTotalMeleeCount, pendingConfirmedModifiers, pendingMaps
)
// APRÈS:
const allSockets = await io.fetchSockets()   // conservé — attackerSocket toujours nécessaire
const attackerSocket = allSockets.find(
  s => s.campaignId === meleeCampaignId && s.user?.id === attackerCharacter.user_id
) || socket
const nextMeleeResult = await resolveMeleeAction(
  io, meleeCampaignId,
  nextAction, attackerCharacter,
  restActions, pendingTotalMeleeCount, pendingConfirmedModifiers, pendingMaps
)
const waitForNext = nextMeleeResult?.suspend ?? false
if (nextMeleeResult) {
  await flushEmissions(io, attackerSocket, meleeCampaignId, nextMeleeResult.emissions, allSockets)
  // allSockets passé en preloadedSockets → évite un 2e io.fetchSockets() dans flushEmissions
}
```

---

## Cartographie complète des émissions

### resolveMeleeAction (L.323–810) — 11 émissions directes

| # | Ligne | Type | Avant | Après descripteur |
|---|---|---|---|---|
| 1 | L.356 | early return | `io.to(campaignId).emit(WS.COMBAT_DECLARE_ERROR, ...)` | `{ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {...} }` |
| 2 | L.421 | early return | `socket.emit(WS.COMBAT_DECLARE_ERROR, ...)` | `{ to: 'socket', event: WS.COMBAT_DECLARE_ERROR, data: {...} }` |
| 3 | L.484 | normal | `io.to(campaignId).emit(WS.DICE_RESULT, ...)` | `{ to: 'room', event: WS.DICE_RESULT, data: {...} }` |
| 4 | L.502 | early return | `io.to(campaignId).emit(WS.COMBAT_MELEE_RESULT, ...)` | `{ to: 'room', event: WS.COMBAT_MELEE_RESULT, data: {...} }` |
| 5 | L.657 | normal | `io.to(campaignId).emit(WS.DICE_RESULT, ...)` | `{ to: 'room', ... }` |
| 6 | L.671 | normal | `io.to(campaignId).emit(WS.COMBAT_MELEE_RESULT, ...)` | `{ to: 'room', ... }` |
| 7 | L.726 | normal | `io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, ...)` | `{ to: 'room', ... }` |
| 8 | L.752 | normal | `io.to(campaignId).emit(WS.COMBAT_MELEE_RESULT, ...)` | `{ to: 'room', ... }` |
| 9 | L.766 | normal | `io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, ...)` | `{ to: 'room', ... }` |
| 10 | L.799 | terminal | `defSocket?.emit(WS.COMBAT_MELEE_DEFENSE_PROMPT, prompt)` | `{ to: 'user', userId: defenderCharacter.user_id, event: WS.COMBAT_MELEE_DEFENSE_PROMPT, data: prompt, fallback: 'room' }` |
| 11 | L.802 | fallback | `io.to(campaignId).emit(WS.COMBAT_MELEE_DEFENSE_PROMPT, { ...prompt, allPlayers: true })` | **SUPPRIMÉ** — fusionné dans `fallback: 'room'` du descripteur #10. Flag `allPlayers` non exploité côté client (vérifié). |

**Services conservés (hors périmètre) :**
- L.710 : `woundService.applyWound(io, db, ...)` — PNJ cible blessée
- L.723 : `statusService.emitShockDiceResult(io, ...)`
- L.733 : `statusService.applyStun(io, ...)`
- L.765 : `resolveDroneIntegrityLoss(io, ...)` — drone défenseur CaC

**Récursion (multi-attaque) :**
Deux points — L.742–746 (branche PNJ défenseur) **et** L.774–776 (branche drone défenseur) — même accumulation obligatoire sur les deux :
```js
const nextResult = await resolveMeleeAction(io, campaignId, remaining[0], ...)
return { ...nextResult, emissions: [...emissions, ...nextResult.emissions] }
```
L'ordre est préservé : émissions de l'attaque N précèdent celles de l'attaque N+1. **⚠️ L.774 est la même récursion — ne pas l'oublier.**

**Mapping des `return` :**

| Branche | Avant | Après |
|---|---|---|
| Guard targetTokenId (L.327) | `return false` | `return { suspend: false, emissions }` |
| Guard sheetAttaquant (L.331) | `return false` | `return { suspend: false, emissions }` |
| Distance fail (L.356) | `return false` | `return { suspend: false, emissions }` |
| Charge fail (L.421) | `return false` | `return { suspend: false, emissions }` |
| Entité décor (L.502) | `return false` | `return { suspend: false, emissions }` |
| Guard defenderCharacter (L.510) | `return false` | `return { suspend: false, emissions }` |
| Récursion PNJ multi-attaque (L.742) ⚠️ | `return await resolveMeleeAction(io, socket, ...)` | `const nr = await ...; return { ...nr, emissions: [...emissions, ...nr.emissions] }` |
| PNJ défenseur — no remaining (L.748) | `return false` | `return { suspend: false, emissions }` |
| Récursion drone multi-attaque (L.774) ⚠️ | `return await resolveMeleeAction(io, socket, ...)` | `const nr = await ...; return { ...nr, emissions: [...emissions, ...nr.emissions] }` |
| Drone défenseur — no remaining (L.778) | `return false` | `return { suspend: false, emissions }` |
| PJ défenseur (L.805) | `return true` | `return { suspend: true, emissions }` |
| catch (L.807) | `return false` | `return { suspend: false, emissions: [] }` |

---

### resolveDroneAssaultAction (L.952–1248) — 12 émissions directes

| # | Ligne | Avant | Après descripteur |
|---|---|---|---|
| 1 | L.969 | `io.to(campaignId).emit(WS.DICE_RESULT, ...)` early return | `{ to: 'room', event: WS.DICE_RESULT, data: {...} }` |
| 2 | L.994 | `io.to(campaignId).emit(WS.COMBAT_DECLARE_ERROR, ...)` early return | `{ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {...} }` |
| 3 | L.1024 | `io.to(campaignId).emit(WS.DICE_RESULT, ...)` | `{ to: 'room', ... }` |
| 4 | L.1072 | `io.to(campaignId).emit(WS.DICE_RESULT, ...)` | `{ to: 'room', ... }` |
| 5 | L.1085 | `io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, ...)` | `{ to: 'room', ... }` |
| 6 | L.1129 | `io.to(campaignId).emit(WS.DICE_RESULT, ...)` | `{ to: 'room', ... }` |
| 7 | L.1141 | `io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, ...)` | `{ to: 'room', ... }` |
| 8 | L.1175 | `io.to(campaignId).emit(WS.DICE_RESULT, ...)` | `{ to: 'room', ... }` |
| 9 | L.1183 | `io.to(campaignId).emit(WS.DICE_RESULT, ...)` | `{ to: 'room', ... }` |
| 10 | L.1192 | `io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, ...)` | `{ to: 'room', ... }` |
| 11 | L.1240 | `cibleSocket?.emit(WS.COMBAT_DAMAGE_PROMPT, ...)` | `{ to: 'user', userId: cibleCharacter.user_id, event: WS.COMBAT_DAMAGE_PROMPT, data: {...}, fallback: 'socket' }` |
| 12 | L.1242 | `socket.emit(WS.COMBAT_DAMAGE_PROMPT, ...)` fallback | **SUPPRIMÉ** — fusionné dans `fallback: 'socket'` du descripteur #11 |

**Services conservés :** `resolveDroneIntegrityLoss(io, ...)` (CaC vs PNJ + distance vs PNJ).

**Supprimé :** `io.fetchSockets()` + `cibleSocket = allSockets.find(...)` (L.1237–1238) → `userId` dans le descripteur.

**Mapping des `return` :**

| Branche | Avant | Après |
|---|---|---|
| Arme sans formule (L.977) | `return` *(void)* | `return { suspend: false, emissions }` |
| Distance CaC trop grande (L.998) | `return` *(void)* | `return { suspend: false, emissions }` |
| LOS bloqué (L.1006) | `return` *(void)* | `return { suspend: false, emissions }` |
| LOS intercepté (L.1009) | `return resolveDroneAssaultAction(io, socket, ...)` | `return resolveDroneAssaultAction(io, campaignId, ...)` — propage `{ suspend, emissions }` |
| Programme manquant (L.1032) | `return` *(void)* | `return { suspend: false, emissions }` |
| Tous les autres points de sortie | `return` | `return { suspend: false, emissions }` |
| catch (L.1245) | *(void — pas de return)* | `return { suspend: false, emissions: [] }` |

---

### resolveAssaultAction (L.1250–1567) — 7 émissions directes

| # | Ligne | Avant | Après descripteur |
|---|---|---|---|
| 1 | L.1372 | `io.to(campaignId).emit(WS.DICE_RESULT, ...)` | `{ to: 'room', event: WS.DICE_RESULT, data: {...} }` |
| 2 | L.1441 | `socket.emit(WS.COMBAT_ATTACK_PLAYER_RESULT, ...)` | `{ to: 'socket', event: WS.COMBAT_ATTACK_PLAYER_RESULT, data: {...} }` |
| 3 | L.1472 | `socket.emit(WS.COMBAT_DAMAGE_PROMPT, ...)` | `{ to: 'socket', event: WS.COMBAT_DAMAGE_PROMPT, data: {...} }` |
| 4 | L.1494 | `io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, ...)` | `{ to: 'room', ... }` |
| 5 | L.1519 | `io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, ...)` | `{ to: 'room', ... }` |
| 6 | L.1541 | `socket.emit(WS.COMBAT_ATTACK_PLAYER_RESULT, ...)` | `{ to: 'socket', ... }` |
| 7 | L.1549 | `io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, ...)` | `{ to: 'room', ... }` |

**Services conservés :** `resolveDroneIntegrityLoss(io, ...)`, `damageService.resolveTargetHit(io, ...)`, `statusService.emitShockDiceResult(io, ...)`, `statusService.applyStun(io, ...)`.

**Call interne L.1253–1254 :**
```js
// AVANT:
return resolveDroneAssaultAction(io, socket, campaignId, ...)
// APRÈS:
return resolveDroneAssaultAction(io, campaignId, ...)
// Le return propage directement { suspend: false, emissions: [...] } au caller
```

**Mapping des `return` :**

| Branche | Avant | Après |
|---|---|---|
| Branchement drone (L.1253) | `return resolveDroneAssaultAction(io, socket, ...)` | `return resolveDroneAssaultAction(io, campaignId, ...)` — propage `{ suspend, emissions }` |
| Guard weapon/target (L.1256) | `return` *(void)* | `return { suspend: false, emissions }` |
| LOS bloqué (L.1261) | `return` *(void)* | `return { suspend: false, emissions }` |
| LOS intercepté (L.1263) | `return resolveAssaultAction(io, socket, ...)` | `return resolveAssaultAction(io, campaignId, ...)` — propage `{ suspend, emissions }` |
| Tous les autres points de sortie | `return` | `return { suspend: false, emissions }` |
| catch (L.1564) | *(void — pas de return)* | `return { suspend: false, emissions: [] }` |

---

## Avertissements

**A1 — `allPlayers: true` flag — SUPPRIMÉ ✅**
L.802 : le flag `allPlayers: true` dans le broadcast fallback DEFENSE_PROMPT n'est pas exploité côté client (`grep allPlayers client/src/` → DocumentModal uniquement, sans lien). Le fallback `{ to: 'user', ..., fallback: 'room' }` émet `prompt` sans ce flag.

**A2 — Récursion resolveMeleeAction**
Voir cartographie. Accumulation obligatoire : `{ ...nextResult, emissions: [...emissions, ...nextResult.emissions] }`. Ne pas `return nextResult` directement — les émissions de l'attaque en cours seraient perdues.

**A3 — resolveAssaultAction appelle resolveDroneAssaultAction**
L.1253 : `return resolveDroneAssaultAction(io, campaignId, ...)`. Le `return` propage `{ suspend: false, emissions }` au caller — pas d'accumulation supplémentaire à faire.

**A4 — Tous les `return` doivent retourner `{ suspend, emissions }`**
Les early returns actuels (`return`, `return false`, `return undefined`) cassent le handler si non convertis. Vérifier systématiquement chaque point de sortie des 3 fonctions.

**A5 — resolveDroneIntegrityLoss conserve `io`**
Hors périmètre. Les 3 fonctions lui passent toujours `io` directement — aucun changement.

**A6 — L.1263 récursion LOS intercepté dans resolveAssaultAction — non détectable par `node --check`**
`return resolveAssaultAction(io, socket, campaignId, ...)` : supprimer `socket` est invisible au vérificateur syntaxique — JS accepte silencieusement un argument en trop, mais ici `socket` est le 2e arg de l'ancienne signature, donc sans correction **`campaignId` reçoit `socket`** et tous les args suivants sont décalés. Même risque sur `resolveDroneAssaultAction` L.1009. **Corriger manuellement à l'Étape 3 step 5.**

**A7 — `attackerSocket` dans COMBAT_MELEE_DEFENSE_CONFIRM (L.560–568)**
`attackerSocket` est trouvé via `io.fetchSockets()` dans le handler, puis passé comme `socket` à `flushEmissions`. Ce lookup reste nécessaire — `socket` dans ce handler est le socket du **défenseur**, mais les émissions `{ to: 'socket' }` de `resolveMeleeAction` doivent aller à l'**attaquant**. `allSockets` est passé en `preloadedSockets` à `flushEmissions` pour éviter un double `fetchSockets()`.

---

## Périmètre

**Fichiers touchés :**
- `server/src/socket/socketCombatHelpers.js` — signatures + corps des 3 fonctions
- `server/src/socket/socketCombatResolution.js` — ajout `flushEmissions` + 4 call sites (L.170, L.187, L.189, L.564)

**Fichiers NON touchés :**
- `server/src/socket/socketCombatState.js` — aucun appel des 3 fonctions
- `server/src/socket/socketCombatAnnouncement.js` — idem
- `server/src/socket/socketCombat.js` — orchestrateur 9L, inchangé
- `server/src/socket/index.js` — inchangé
- `server/src/lib/woundService.js` / `damageService.js` / `statusService.js` — hors périmètre
- `client/` — inchangé
- `shared/events.js` — aucun nouvel event

---

## Plan

> **Segmentation mémoire :** 4 blocs indépendants — chaque bloc se termine par SR valide. Commencer chaque session de code par la lecture des fichiers impactés depuis zéro (plages indiquées).

---

### Bloc 1 — Baseline + resolveDroneAssaultAction + flushEmissions + call site L.187

> **Lire avant de coder :** `socketCombatHelpers.js` L.952–1248 + `socketCombatResolution.js` L.1–30 + L.182–195.
> **SR cible :** drone assault fonctionnel. melee/assault encore avec ancienne signature — attendu.

**0 — Vérifications préalables**
- `node --check server/src/socket/socketCombatHelpers.js`
- `node --check server/src/socket/socketCombatResolution.js`

**1 — resolveDroneAssaultAction (L.952–1248)**

1. Supprimer `socket` de la signature
2. Déclarer `const emissions = []` en début du bloc `try`
3. Convertir les 12 émissions directes → `emissions.push({ to: ..., event: ..., data: ... })`
4. Supprimer `io.fetchSockets()` + `cibleSocket` lookup (L.1237–1238)
   - Remplacer par `{ to: 'user', userId: cibleCharacter.user_id, ..., fallback: 'socket' }`
4b. ⚠️ Mettre à jour L.1009 : supprimer `socket` des args de la récursion LOS intercepté — non détectable par `node --check` — même piège que A6
5. Mettre à jour tous les `return` → `return { suspend: false, emissions }` (inclut L.977, L.998, L.1006, L.1032)
6. `node --check server/src/socket/socketCombatHelpers.js`

**1b — socketCombatHelpers.js : fix L.1253 dans resolveAssaultAction**

> V10 (drone distance) passe par `resolveAssaultAction` → L.1253, pas par L.187. Sans ce fix, après Bloc 1 `campaignId` reçoit le socket objet → émissions dans une room invalide. `resolveAssaultAction` garde son ancienne signature complète — `socket` reste disponible dans son corps.

```js
// AVANT (L.1253) :
return resolveDroneAssaultAction(io, socket, campaignId, action, confirmedModifiers, character, pendingMaps, options)
// APRÈS :
return resolveDroneAssaultAction(io, campaignId, action, confirmedModifiers, character, pendingMaps, options)
```
`node --check server/src/socket/socketCombatHelpers.js`

**2 — socketCombatResolution.js : flushEmissions + call site L.187**

1. Ajouter `flushEmissions` en haut du module (après les imports, avant `registerResolutionHandlers`)
2. Mettre à jour L.187 (drone melee) :
   ```js
   const droneResult = await resolveDroneAssaultAction(io, campaignId, meleeActions[0], confirmedModifiers, character, pendingMaps)
   if (droneResult) await flushEmissions(io, socket, campaignId, droneResult.emissions)
   ```
3. `node --check server/src/socket/socketCombatResolution.js`
4. SR complet → **V9, V10**

---

### Bloc 2 — resolveMeleeAction + call sites L.189 + L.564

> **Lire avant de coder :** `socketCombatHelpers.js` L.323–810 + `socketCombatResolution.js` L.182–200 + L.555–590.
> **SR cible :** melee fonctionnel. resolveAssaultAction encore avec ancienne signature — attendu.

**3 — resolveMeleeAction (L.323–810)**

1. Supprimer `socket` de la signature
2. Déclarer `const emissions = []` en début du bloc `try` — avant L.325 (`const weaponInvId`)
3. Convertir les 10 émissions directes → descripteurs
4. Supprimer L.802 (fallback broadcast) — fusionné dans `fallback: 'room'` du descripteur #10
5. Supprimer `io.fetchSockets()` + `defSocket` lookup (L.786–788)
6. Mettre à jour **les deux récursions** — ⚠️ ne pas en oublier une :
   - L.742–746 (branche PNJ défenseur)
   - L.774–776 (branche drone défenseur)
   ```js
   const nextResult = await resolveMeleeAction(io, campaignId, remaining[0], ...)
   return { ...nextResult, emissions: [...emissions, ...nextResult.emissions] }
   ```
7. Mettre à jour tous les `return` → mapping complet (tableau ci-dessus) — inclut L.327, L.331, L.510
8. `node --check server/src/socket/socketCombatHelpers.js`

**4 — socketCombatResolution.js : call sites L.189 + L.564**

1. Mettre à jour L.189 (melee depuis COMBAT_ACTION_CONFIRM) :
   ```js
   const meleeResult = await resolveMeleeAction(
     io, campaignId, meleeActions[0], character,
     meleeActions.slice(1), meleeActions.length, confirmedModifiers, pendingMaps
   )
   if (meleeResult) {
     await flushEmissions(io, socket, campaignId, meleeResult.emissions)
     needsDefenseWait = meleeResult.suspend
   }
   ```
2. Mettre à jour L.564 (melee depuis COMBAT_MELEE_DEFENSE_CONFIRM) — conserver le lookup `attackerSocket`, passer `allSockets` en `preloadedSockets`
3. `node --check server/src/socket/socketCombatResolution.js`
4. SR complet → **V1–V5**

---

### Bloc 3 — resolveAssaultAction + call site L.170

> **Lire avant de coder :** `socketCombatHelpers.js` L.1250–1567 + `socketCombatResolution.js` L.162–178.
> **SR cible :** tous les handlers fonctionnels — REWORK-18 complet.

**5 — resolveAssaultAction (L.1250–1567)**

1. Supprimer `socket` de la signature
2. Déclarer `const emissions = []` en début du bloc `try`
3. Convertir les 7 émissions directes → descripteurs
4. Mettre à jour L.1253 : `resolveDroneAssaultAction(io, campaignId, ...)` — supprimer `socket`
5. ⚠️ Mettre à jour L.1263 : `resolveAssaultAction(io, campaignId, ...)` — supprimer `socket` — non détectable par `node --check` (voir A6)
6. Mettre à jour tous les `return` → mapping complet (tableau ci-dessus)
7. `node --check server/src/socket/socketCombatHelpers.js`

**6 — socketCombatResolution.js : call site L.170**

1. Mettre à jour L.170 (assault depuis COMBAT_ACTION_CONFIRM) :
   ```js
   const assaultResult = await resolveAssaultAction(io, campaignId, action, confirmedModifiers, character, pendingMaps)
   if (assaultResult) await flushEmissions(io, socket, campaignId, assaultResult.emissions)
   ```
2. `node --check server/src/socket/socketCombatResolution.js`
3. SR complet → **V6–V8**

---

### Bloc 4 — Validation finale

`node --check` ×2 — SR — V1–V11 complets.

---

## Validation

| # | Scénario | Résultat attendu |
|---|---|---|
| V1 | CaC PJ vs PNJ | DICE_RESULT + COMBAT_MELEE_RESULT broadcast. Slot avance. |
| V2 | CaC PJ vs PJ — défense requise | DICE_RESULT broadcast. COMBAT_MELEE_DEFENSE_PROMPT → socket défenseur uniquement. Slot bloqué. |
| V3 | CaC PJ vs PJ — défenseur offline | COMBAT_MELEE_DEFENSE_PROMPT broadcast (fallback room). |
| V4 | CaC PJ multi-attaque (2 PNJ) | 2× (DICE_RESULT + COMBAT_MELEE_RESULT) dans l'ordre. Slot avance. |
| V5 | CaC charge impossible — distance ≤ 3m | COMBAT_DECLARE_ERROR → socket attaquant. Slot avance. |
| V6 | Assaut PJ distance — touché | DICE_RESULT broadcast + COMBAT_ATTACK_PLAYER_RESULT → socket attaquant + COMBAT_DAMAGE_PROMPT → socket attaquant. Slot avance. AWAITING_DAMAGE (FSM). |
| V7 | Assaut PNJ distance — touché PJ | DICE_RESULT + COMBAT_ATTACK_RESULT broadcast. Slot avance. COMBAT_DAMAGE_CONFIRM requis. |
| V8 | Assaut PNJ distance — raté | DICE_RESULT + COMBAT_ATTACK_RESULT broadcast (isSuccess: false). Slot avance. |
| V9 | Assaut drone CaC vs PNJ | Émissions drone broadcast correctes. Slot avance. |
| V10 | Assaut drone distance vs PJ | DICE_RESULT broadcast + COMBAT_DAMAGE_PROMPT → socket cible PJ. Slot avance. |
| V11 | SR complet | `node --check` × 2. SR sans erreur. |

---

## Definition of done

- [ ] `resolveDroneAssaultAction` : `socket` supprimé — 12 émissions → descripteurs — `io.fetchSockets()` supprimé — L.1009 récursion LOS args mis à jour — tous les `return` → `{ suspend: false, emissions }`
- [ ] `resolveMeleeAction` : `socket` supprimé — 10 émissions → descripteurs (11e supprimée) — `io.fetchSockets()` supprimé — **deux récursions** (L.742 + L.774) accumulent les émissions — tous les `return` → `{ suspend: bool, emissions }` (inclut L.327, L.331, L.510)
- [ ] `resolveAssaultAction` : `socket` supprimé — 7 émissions → descripteurs — call L.1253 mis à jour (⚠️ Bloc 1, pas Bloc 3) — call L.1263 mis à jour (⚠️ non détectable `node --check`) — tous les `return` → `{ suspend: false, emissions }`
- [ ] `flushEmissions(io, socket, campaignId, emissions, preloadedSockets?)` créé dans `socketCombatResolution.js`
- [ ] 4 call sites mis à jour dans `socketCombatResolution.js` (L.170, L.187, L.189, L.564)
- [ ] L.564 : `attackerSocket` toujours résolu, `allSockets` passé en `preloadedSockets`
- [ ] `node --check` × 2 — zéro erreur
- [ ] SR sans erreur
- [ ] Scénarios V1–V11 validés
- [ ] `docs/ARCHI_REWORK.md` mis à jour — REWORK-18 ajouté dans "Prochains reworks"
- [ ] `docs/JOURNAL5.md` appended
- [ ] `docs/EN_COURS.md` mis à jour
