# REWORK-03 — Wound Service (résolution blessure + broadcast)
> Créé Session 95-8 — 2026-06-16
> Mis à jour progressivement pendant l'analyse. Ne pas traiter comme source stable avant la section §Plan.
> Ce fichier est le journal de tout ce qui est trouvé, bon ou mauvais, certain ou incertain.

---

## Contexte et motivation

**Signal déclencheur** : `resolveWoundInsertion` est appelé identiquement dans 6 endroits du code avec des divergences silencieuses entre les sites. Même pattern que REWORK-01 (`resolveShockBlock` ×5). REWORK-01 nous a appris que ce pattern produit des bugs de divergence détectés tard (SHOCK1 = bloc entier absent d'une copie).

**Note fondatrice** (Saar, Session 95-8) : les bugs existent en grande partie parce qu'on n'a pas pris suffisamment de temps pour réfléchir à l'architecture. REWORK-03 est l'occasion de corriger ça proprement, pas juste de patcher les symptômes.

---

## §1 — INVENTAIRE DES CALL SITES

Résultat de `grep -n "resolveWoundInsertion" server/src/socket/index.js` + `char-sheet.js` :

| # | Ligne | Contexte | Qui attaque | Qui est touché |
|---|---|---|---|---|
| CS1 | 2476 | `COMBAT_DAMAGE_CONFIRM` | PJ (confirme ses dés dégâts) | Humanoid (PNJ ou PJ) |
| CS2 | 2744 | `COMBAT_MELEE_DEFENSE_CONFIRM` | PNJ CaC (auto après défense) | PJ |
| CS3 | 3557 | `resolveMeleeAction` (PNJ auto) | PNJ CaC | PJ ou PNJ |
| CS4 | 3995 | `resolveDroneAssaultAction` branche 8b | Drone auto | PNJ humanoid |
| CS5 | 4347 | `resolveAssaultAction` (PNJ auto) | PNJ ranged | Humanoid |
| CS6 | 668 | REST `POST /char-sheet/:characterId/wounds` | GM manuel | N'importe qui |

**Total : 6 call sites** (ARCHI_REWORK.md disait "5+" — il y a bien 6, le 6ème est le REST qui était considéré séparé).

---

## §2 — ANALYSE DE LA FONCTION CIBLE

### `resolveWoundInsertion` — `server/src/lib/woundUtils.js` L.16

```js
export async function resolveWoundInsertion(trx, char_sheet_id, location, severity) {
  const maxCount = WOUND_MAX_COUNTS[location]?.[severity]
  if (!maxCount) throw new AppError(400, `Gravité "${severity}" invalide pour "${location}"`)

  const { count } = await trx('character_wounds')
    .where({ char_sheet_id, location, severity }).count('* as count').first()
  const currentCount = parseInt(count)
  const next = nextSeverity(severity)

  if (next && currentCount >= maxCount - 1) {
    await trx('character_wounds').where({ char_sheet_id, location, severity }).del()
    const result = await resolveWoundInsertion(trx, char_sheet_id, location, next)
    return { ...result, promoted: true }
  }

  if (currentCount >= maxCount) {
    throw new AppError(400, 'Ligne pleine — gravité maximale atteinte pour cette localisation')
  }

  const [wound] = await trx('character_wounds')
    .insert({ char_sheet_id, location, severity, is_stabilized: false })
    .returning('*')
  return { wound, promoted: false }
}
```

**Comportement** : récursive dans une transaction knex. Si la ligne de sévérité est pleine → supprime toute la ligne, insère à la sévérité suivante (plus grave). Retourne `{ wound, promoted }`.

**Throws AppError dans deux cas :**
1. `location` ou `severity` invalide → 400
2. Ligne pleine à la sévérité maximale (aucun `next`) → 400

**Point P49 (piège documenté dans CLAUDE.md)** : si `promoted === true`, `result.wound.severity` est la sévérité APRÈS promotion — plus grave que `severity` initial. Le `finalSeverity` doit être mis à jour avec `result.wound.severity`. C'est le comportement correct pour `isShockTestRequired` et `resolveShockTest`.

---

## §3 — DIVERGENCES ENTRE CALL SITES

### DIV-1 — `worst_wound_severity` absent des 5 call sites WS [CRITIQUE]

**Constat** : le REST CS6 émet dans `WOUND_ADDED` :
```js
{ characterId, wound, promoted, shock_test_required, worst_wound_severity }  // CS6 REST
```
Les 5 call sites WS (CS1–CS5) émettent :
```js
{ characterId, wound, promoted, shock_test_required }  // pas de worst_wound_severity
```

**Impact** : `SessionPage.jsx` ligne 496-498 :
```js
s.on(WS.WOUND_ADDED, ({ characterId, worst_wound_severity }) => {
  updateCharacter({ id: characterId, worst_wound_severity })
})
```
→ En combat, `worst_wound_severity` reçu = `undefined`. `updateCharacter` est appelé avec `undefined`.
→ `CombatTimeline.jsx` L.47 et L.67 : `char?.worst_wound_severity ?? null` → null.
→ `TokenRadialMenu.jsx` L.163 : même chose.
**Résultat : l'anneau de sévérité du token et la bordure timeline ne se mettent PAS à jour pendant le combat.** Bug actif, non encore identifié dans BUGIDENTIFIE.md.

**Cause** : `getWorstWoundSeverity` est une fonction **privée** de `char-sheet.js` (non exportée, non importable dans socket/index.js). Les call sites WS ne peuvent pas l'appeler sans refactoring.

**Priorité DIV-1** : Haute — impacte l'UI de tous les combats.

---

### DIV-2 — try/catch incohérent [HAUTE]

| Site | try/catch local | catch externe | Comportement si wound throw |
|---|---|---|---|
| CS1 | ❌ aucun | ✅ L.2570 handler outer | Log + pas de COMBAT_DAMAGE_RESULT → fenêtre PJ bloquée |
| CS2 | ✅ L.2757 local | — | Wound error loggée, COMBAT_ATTACK_RESULT émis sans blessure |
| CS3 | ✅ L.3569 local | — | Idem CS2 |
| CS4 | ❌ aucun | ✅ L.4089 fonction outer | Log + pas de COMBAT_ATTACK_RESULT → aucun résultat affiché |
| CS5 | ✅ L.4360 local | — | Idem CS2 |
| CS6 | Via Express next(err) | — | HTTP 400 correctement retourné |

**Impact de la divergence :**
- CS2, CS3, CS5 (try/catch local) : si la wound throw, le résultat de l'attaque est quand même émis avec `severity: null` — comportement dégradé mais non bloquant pour le joueur.
- CS1, CS4 (catch externe seulement) : si la wound throw, l'event résultat N'EST PAS émis. CS1 → fenêtre PJ bloquée en "Calcul en cours...". CS4 → aucun feedback côté client (timeout silencieux).

**Quand throw en pratique ?**
- Cas 1 (location/severity invalide) : théoriquement impossible si le pipeline LOC_TABLE est correct. Risque réel lors de futures refactorings qui passeraient une mauvaise valeur.
- Cas 2 (ligne pleine sévérité max) : possible en jeu → PNJ avec toutes les cases mortelles remplies → `AppError('Ligne pleine')`. Rare mais non impossible (PNJ très résistant, combat long).

---

### DIV-3 — `getWorstWoundSeverity` enfouie dans char-sheet.js [STRUCTUREL]

La fonction existe en L.630–638 de `char-sheet.js` :
```js
async function getWorstWoundSeverity(charSheetId) {
  const ORDER = ['mortelle', 'critique', 'grave', 'moyenne', 'legere']
  const wounds = await db('character_wounds').where({ char_sheet_id: charSheetId }).select('severity')
  if (!wounds.length) return null
  wounds.sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity))
  return wounds[0].severity
}
```

- Déclarée localement, pas exportée.
- `db` capturé par fermeture depuis le module `char-sheet.js`.
- Pour l'exporter, il faudra passer `db` en paramètre (comme `applyStunWithDuration` dans REWORK-01).
- Elle doit migrer dans `woundUtils.js` et prendre `db` en paramètre.

---

### DIV-4 — Séquençage WOUND_ADDED → résultat combat [À SURVEILLER]

Dans tous les sites, `WOUND_ADDED` est émis **avant** `COMBAT_ATTACK_RESULT` / `COMBAT_DAMAGE_RESULT`. Ce séquençage est intentionnel : le client apprend la blessure avant de voir le résultat de l'attaque.

→ La fonction `applyWound` centralisée doit émettre `WOUND_ADDED` EN INTERNE. Le caller n'émet que son propre event résultat (COMBAT_DAMAGE_RESULT ou COMBAT_ATTACK_RESULT) après le retour de `applyWound`. Ce séquençage est préservé.

---

### DIV-5 — Nommage variable `characterId` dans WOUND_ADDED [COSMÉTIQUE]

| Site | Variable passée |
|---|---|
| CS1 | `characterIdCible` |
| CS2 | `characterIdCible` |
| CS3 | `defenderCharacter.id` |
| CS4 | `cibleCharacter.id` |
| CS5 | `cibleToken.character_id` |
| CS6 | `req.params.characterId` |

Tous pointent vers le même concept (character_id de la cible humanoid). La fonction `applyWound` recevra un paramètre `characterId` explicite — chaque caller le fournit sous le bon nom.

---

### DIV-6 — Différences intentionnelles (NON des bugs) [À PRÉSERVER]

Les call sites diffèrent sur la **formule de calcul dégâts** :
- CS1 (PJ tire, melee) : `rawDice + modDom + combatModeBonus`
- CS1 (PJ tire, ranged) : `rawDice + modDomAttaque + fire_mode_bonus_dmg`
- CS2/CS3 (PNJ CaC auto) : `rawDice + modDom + combatModeBonus`
- CS4 (drone auto) : `rawDice + modDomAttaque` (MR table)
- CS5 (PNJ ranged auto) : `rawDice + modDomAttaque + modDegatsMode`

Ces différences sont architecturalement correctes — chaque contexte a ses modificateurs propres. `applyWound` ne touche pas ce calcul : il reçoit `degatsNets` déjà calculé (ou mieux : `severity` et `isLethal` déjà déterminés).

De même, la table de localisation varie (`LOC_TABLE` vs `LOC_TABLE_CONTACT`) — ce n'est pas une divergence bug, c'est le bon comportement.

---

## §4 — ZONES D'OMBRE (à confirmer avant de coder)

### ZO-1 — `updateCharacter` avec `worst_wound_severity = undefined` [RÉSOLU — CRITIQUE]

`characterStore.js` — `updateCharacter` L.30-34 :
```js
updateCharacter: (partial) => set((state) => ({
  characters: state.characters.map(c =>
    c.id !== partial.id ? c : { ...c, ...partial }
  ),
})),
```

`{ ...c, ...partial }` avec `partial = { id, worst_wound_severity: undefined }` → le spread **écrase** `c.worst_wound_severity` avec `undefined`.

**DIV-1 est plus grave que prévu : chaque blessure en combat RESET activement `worst_wound_severity` à `undefined` dans le store.** Avant la blessure, le token peut avoir une sévérité correcte (chargée à l'init). Après la blessure, la sévérité disparaît du store, même si la blessure existait déjà.

Conséquence : pendant tout un combat, à chaque blessure reçue, `CombatTimeline` et `TokenRadialMenu` perdent la couleur de sévérité du token blessé. Bug actif depuis les premières versions du système de blessures en combat.

### ZO-2 — Transaction knex dans `applyWound`

`resolveWoundInsertion` prend `trx` (transaction knex passée par le caller). Dans la version centralisée, `applyWound` fera `db.transaction(trx => resolveWoundInsertion(trx, ...))`. Vérifier que knex supporte les transactions imbriquées (ou que la nouvelle fonction ne sera jamais appelée depuis une transaction existante).

Actuellement : tous les call sites initient la transaction eux-mêmes (`db.transaction(trx => resolveWoundInsertion(trx, ...))`). `applyWound` prendra cette responsabilité. Aucun site n'appelle `resolveWoundInsertion` depuis une transaction parente — pas de risque d'imbrication.

### ZO-3 — `worst_wound_severity` race condition

Après `resolveWoundInsertion` (qui insère dans la transaction), la transaction est committée avant `getWorstWoundSeverity`. La query `getWorstWoundSeverity` voit donc la nouvelle blessure. OK — mais si deux blessures arrivent simultanément (rare, CaC 4b multi-attaque), la deuxième peut lire la DB avant que la première soit committée.

**Impact** : `worst_wound_severity` pourrait être légèrement stale pour la 2ème attaque simultanée. Acceptable V1 — ce serait le même problème avec le code actuel et ne sera jamais fixé sans locking transactionnel complet.

### ZO-4 — `char-sheet.js` : `getWorstWoundSeverity` appelée aussi dans PUT /stabilize et DELETE

```
L.703 : PUT /:characterId/wounds/:woundId/stabilize → getWorstWoundSeverity
L.727 : DELETE /:characterId/wounds/:woundId → getWorstWoundSeverity
```

Si `getWorstWoundSeverity` migre dans `woundUtils.js` avec signature `(db, charSheetId)`, ces appels existants dans `char-sheet.js` doivent aussi être mis à jour (passer `db`). Le fichier `char-sheet.js` importe `db` directement donc la migration est simple.

**Action** : vérifier que les 3 usages dans `char-sheet.js` fonctionnent avec le nouveau paramètre.

### ZO-5 — `isShockTestRequired` dans WOUND_ADDED : paramètre location

`shock_test_required` dans le payload `WOUND_ADDED` utilise `result.wound.location`. Après promotion, `result.wound.location` = location initiale (non modifiée par la promotion — seule la sévérité change). La promotion est intra-localisation (tête mortelle → prochaine mortelle tête ou crash). OK.

---

## §5 — PIÈGES IDENTIFIÉS

### PIEGE-1 — AppError "ligne pleine" : comportement attendu en jeu

Un PNJ peut littéralement avoir toutes ses cases mortelles remplies. Dans ce cas, `resolveWoundInsertion` throw `AppError(400, 'Ligne pleine')`. Ce n'est pas un bug de code — c'est une règle de jeu (PNJ mort). La fonction `applyWound` doit catcher cette erreur et la traiter comme "blessure impossible à appliquer" → retourner `null` avec un log explicite, sans crasher le handler.

**Attention** : ne pas swallow silencieusement — logger avec `[WS] applyWound — ligne pleine : ${charSheetId} ${localisation} ${severity}`.

### PIEGE-2 — `promoted: true` et P49

Après promotion, `result.wound.severity` ≠ `severity` initial. Le `finalSeverity` retourné par `applyWound` DOIT être `result.wound.severity` (post-promotion). Les callers doivent utiliser `finalSeverity` (retour de applyWound) pour `resolveShockTest` et pour le payload résultat. Ne jamais utiliser `severity` original après cet appel.

### PIEGE-3 — `resolveShockTest` reste chez le caller

`applyWound` ne doit PAS appeler `statusService.resolveShockTest`. Raison : cela créerait une dépendance `woundService → statusService → woundUtils`. Si on veut garder les modules indépendants, `applyWound` retourne `{ finalSeverity }` et le caller fait `resolveShockTest` lui-même. 

Avantage : `woundService.js` reste sans dépendance à `statusService.js`. Inconvénient : le caller doit toujours faire `resolveShockTest` — mais c'est déjà le cas actuellement.

### PIEGE-4 — `io.to(campaignId)` vs `io.to(meleeCampaignId)` en CS2

Dans `COMBAT_MELEE_DEFENSE_CONFIRM`, la variable de scope est `meleeCampaignId` (pas `campaignId`). La fonction `applyWound` recevra `campaignId` en paramètre — le caller passe `meleeCampaignId` à la place. Pas de bug possible si le paramètre est bien nommé, mais à documenter.

### PIEGE-5 — Transaction knex : `db` disponible dans `woundUtils.js` ?

`woundUtils.js` n'importe pas `db` actuellement. `resolveWoundInsertion` reçoit `trx` (passé par le caller). `getWorstWoundSeverity` dans la version migrée prendra `db` en paramètre. OK — pas de db import nécessaire dans `woundUtils.js` lui-même.

### PIEGE-7 — `getWorstWoundSeverity` : ordre du tri hardcodé risque de désynchronisation

Dans `char-sheet.js` L.631 :
```js
const ORDER = ['mortelle', 'critique', 'grave', 'moyenne', 'legere']
```
C'est `WOUND_SEVERITIES.slice().reverse()` — mais écrit à la main. `WOUND_SEVERITIES` dans `woundConstants.js` = `['legere', 'moyenne', 'grave', 'critique', 'mortelle']`.

**Risque** : si `WOUND_SEVERITIES` est modifié dans le futur (nouvelle sévérité intermédiaire), `ORDER` dans `getWorstWoundSeverity` devient incorrect silencieusement. La migration dans `woundUtils.js` doit utiliser `WOUND_SEVERITIES.slice().reverse()` — `woundConstants.js` étant déjà importé dans `woundUtils.js`.

### PIEGE-8 — `nextSeverity` et `getWorstWoundSeverity` : directions opposées du même tableau

`nextSeverity(severity)` utilise `WOUND_SEVERITIES.indexOf(severity)` — index croissant = sévérité croissante (legere→mortelle).
`getWorstWoundSeverity` trie en ordre décroissant pour trouver le pire — index 0 = mortelle.

Ces deux fonctions sont cohérentes entre elles mais opèrent dans des directions opposées. Les mélanger (ex : trier avec indexOf au lieu du ORDER inversé) produirait le bug inverse : retourner la sévérité LA MOINS grave. À documenter dans woundUtils.js en commentaire.

### PIEGE-6 — `woundUtils.js` vs nouveau `woundService.js`

Option A : tout dans `woundUtils.js` (ajouter `applyWound` + `getWorstWoundSeverity`)
Option B : `woundUtils.js` reste pur (fonctions pures + `resolveWoundInsertion`) et on crée `woundService.js` pour les fonctions avec effets (io + db)

**Recommandation** : Option B. Convention du projet (ARCHI_REWORK.md) : fonctions pures dans les libs, effets dans les services. `woundService.js` suit la même convention que `statusService.js`.

---

## §6 — ARCHITECTURE CIBLE

### Nouveaux exports de `server/src/lib/woundUtils.js`

```js
// Nouvelle fonction exportée (migrée depuis char-sheet.js, db en paramètre)
export async function getWorstWoundSeverity(db, charSheetId) {
  const ORDER = ['mortelle', 'critique', 'grave', 'moyenne', 'legere']
  const wounds = await db('character_wounds').where({ char_sheet_id: charSheetId }).select('severity')
  if (!wounds.length) return null
  wounds.sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity))
  return wounds[0].severity
}
```

### Nouveau fichier `server/src/lib/woundService.js`

```js
// Bloc complet blessure : transaction + worst_wound_severity + WOUND_ADDED broadcast
// Appelé par tous les flux combat (WS) en remplacement du bloc inline.
// resolveShockTest reste côté caller (indépendance statusService).
// Retourne null si severity === null ou charSheetId === null.
// → { finalSeverity: string, wound: object, promoted: boolean, worst_wound_severity: string|null }
export async function applyWound(io, db, campaignId, {
  charSheetId,    // UUID char_sheet.id de la cible
  characterId,    // UUID character.id de la cible (pour WOUND_ADDED.characterId)
  localisation,   // wound_location ('tete', 'corps', ...)
  severity,       // gravité entrante
  isLethal,       // boolean — non utilisé dans applyWound, passé en retour pour le caller
})
// Retourne : { finalSeverity, wound, promoted, worst_wound_severity }
// Ou null si severity === null || !charSheetId
```

**Séquence interne de applyWound :**
```
1. Guard: if (!severity || !charSheetId) return null
2. db.transaction(trx => resolveWoundInsertion(trx, charSheetId, localisation, severity))
   → catch AppError("ligne pleine") → log + return null
3. finalSeverity = result.wound.severity  // P49 : post-promotion
4. worst_wound_severity = await getWorstWoundSeverity(db, charSheetId)
5. io.to(campaignId).emit(WS.WOUND_ADDED, {
     characterId, wound: result.wound, promoted: result.promoted,
     shock_test_required: isShockTestRequired(result.wound.severity, result.wound.location),
     worst_wound_severity,
   })
6. return { finalSeverity, wound: result.wound, promoted: result.promoted, worst_wound_severity }
```

### Pattern remplacement dans chaque call site WS (CS1–CS5)

**AVANT :**
```js
let finalSeverity = severity, shockResult = null
if (severity && char_sheet_id_cible) {
  try {
    const result = await db.transaction(trx =>
      resolveWoundInsertion(trx, char_sheet_id_cible, localisation, severity)
    )
    finalSeverity = result.wound.severity
    io.to(campaignId).emit(WS.WOUND_ADDED, {
      characterId: characterIdCible, wound: result.wound,
      promoted: result.promoted,
      shock_test_required: isShockTestRequired(result.wound.severity, result.wound.location),
    })
    shockResult = await statusService.resolveShockTest({...})
  } catch (woundErr) { console.error(...) }
}
```

**APRÈS :**
```js
let finalSeverity = severity, shockResult = null
const woundResult = await woundService.applyWound(io, db, campaignId, {
  charSheetId: char_sheet_id_cible, characterId: characterIdCible,
  localisation, severity, isLethal: is_lethal,
})
if (woundResult) {
  finalSeverity = woundResult.finalSeverity
  shockResult = await statusService.resolveShockTest({
    finalSeverity, localisation, is_lethal,
    for_na: for_na_cible, con_na: con_na_cible, vol_na: vol_na_cible,
  })
}
```

### char-sheet.js CS6 — REST route

`getWorstWoundSeverity` est remplacée par l'import depuis `woundUtils.js`. Les 3 appels dans char-sheet.js passent `db` en premier paramètre. `applyWound` n'est PAS utilisé dans le REST (la route REST a sa propre logique — pas de resolveShockTest, pas de statusService). La route REST ne change que par rapport à `getWorstWoundSeverity`.

---

## §6b — SCOPE DIV-1 CONFIRMÉ

`WOUND_UPDATED` et `WOUND_REMOVED` sont émis **uniquement** dans `char-sheet.js` (REST routes stabilize + delete). Ces deux routes incluent déjà `worst_wound_severity` correctement via `getWorstWoundSeverity`.

**DIV-1 est confiné aux 5 émissions `WOUND_ADDED` dans `socket/index.js`** — pas dans les routes REST. Périmètre borné.

---

## §6c — SUBSTITUTION PAR CALL SITE (carte exacte)

Pour chaque call site, les variables exactes à passer à `applyWound` :

| Site | `charSheetId` | `characterId` | `campaignId` | `is_lethal` |
|---|---|---|---|---|
| CS1 L.2476 | `char_sheet_id_cible` | `characterIdCible` | `campaignId` | `is_lethal` |
| CS2 L.2744 | `char_sheet_id_cible` | `characterIdCible` | `meleeCampaignId` ⚠️ | `is_lethal` |
| CS3 L.3557 | `char_sheet_id_cible` | `defenderCharacter.id` | `campaignId` | `is_lethal` |
| CS4 L.3995 | `cibleSheet.id` | `cibleCharacter.id` | `campaignId` | `is_lethal` |
| CS5 L.4347 | `char_sheet_id_cible` | `cibleToken.character_id` | `campaignId` | `is_lethal` |

**⚠️ CS2** : utilise `meleeCampaignId` (pas `campaignId`) — variable locale au handler `COMBAT_MELEE_DEFENSE_CONFIRM`. À ne pas confondre.

**Pattern exact après substitution (identique pour CS1–CS5 sauf noms de variables) :**
```js
// REMPLACE le bloc if(severity && char_sheet_id_cible) { ... }
let finalSeverity = severity, shockResult = null
const woundResult = await woundService.applyWound(io, db, campaignId, {
  charSheetId: char_sheet_id_cible,   // ← nom variable selon le site
  characterId: characterIdCible,       // ← nom variable selon le site
  localisation, severity,
})
if (woundResult) {
  finalSeverity = woundResult.finalSeverity
  shockResult = await statusService.resolveShockTest({
    finalSeverity, localisation, is_lethal,
    for_na: for_na_cible, con_na: con_na_cible, vol_na: vol_na_cible,
  })
}
// Suite inchangée : emit résultat + applyStun fire-and-forget
```

---

## §6d — CHANGEMENTS D'IMPORT dans `socket/index.js`

**Ligne 25 — à remplacer :**
```js
// AVANT :
import { resolveWoundInsertion, isShockTestRequired } from '../lib/woundUtils.js'

// APRÈS :
import * as woundService from '../lib/woundService.js'
```

`resolveWoundInsertion` et `isShockTestRequired` n'ont **aucun usage restant** dans `socket/index.js` après le rework (vérifié par grep — uniquement utilisés dans les 5 call sites et leurs `shock_test_required` inline, qui migrent dans `applyWound`). L'import peut être entièrement supprimé.

`statusService` (ligne 26) reste inchangé — `resolveShockTest` et `applyStun` restent appelés par les callers.

**Commentaire L.3806 à mettre à jour :**
```js
// AVANT : // Blessures : resolveWoundInsertion (promotions en cascade) + test choc si requis.
// APRÈS : // Blessures : woundService.applyWound (résolution + WOUND_ADDED) + resolveShockTest caller.
```

---

## §7 — PÉRIMÈTRE

### Fichiers touchés — détail précis

| Fichier | Changement |
|---|---|
| `server/src/lib/woundUtils.js` | +export `getWorstWoundSeverity(db, charSheetId)` — utiliser `WOUND_SEVERITIES.slice().reverse()` (PIEGE-7) |
| `server/src/lib/woundService.js` | NOUVEAU — imports : `woundUtils`, `WS from shared/events.js`, `WOUND_SEVERITY_COLORS` si besoin. Export unique : `applyWound` |
| `server/src/socket/index.js` | L.25 : remplacer import woundUtils par `import * as woundService from '../lib/woundService.js'`. 5 call sites remplacés. Commentaire L.3806 mis à jour. |
| `server/src/routes/character/char-sheet.js` | L.41 : ajouter `getWorstWoundSeverity` à l'import woundUtils. L.630–638 : supprimer la fonction locale. L.672, 703, 727 : `getWorstWoundSeverity(sheet.id)` → `getWorstWoundSeverity(db, sheet.id)` |

**Note `characters.js`** : `worst_wound_severity` à L.55 est une sous-requête SQL inline dans un GET — indépendant de `getWorstWoundSeverity`, non touché.

### `woundService.js` — imports requis

```js
import db from '../db/knex.js'  // NON — db est passé en paramètre, pas importé
import { resolveWoundInsertion, isShockTestRequired, getWorstWoundSeverity } from './woundUtils.js'
import { WS } from '../../../shared/events.js'
```
`io` et `db` sont des paramètres de fonction — pas importés au module level. Même convention que `statusService.js`.

### Interface finale de `applyWound` (simplifiée)

```js
// Retourne { finalSeverity: string } si blessure appliquée, null sinon.
// Ne retourne PAS wound/promoted/worst_wound_severity — déjà broadcastés dans WOUND_ADDED.
// Le caller n'a besoin que de finalSeverity pour resolveShockTest.
export async function applyWound(io, db, campaignId, {
  charSheetId, characterId, localisation, severity,
})
```

### Fichiers NON touchés

- `shared/woundConstants.js`, `shared/armorConstants.js` — inchangés
- `server/src/lib/charStats.js` — inchangé
- `server/src/lib/statusService.js` — inchangé (resolveShockTest reste appelé par le caller)
- `client/` — aucun changement (le fix DIV-1 est côté serveur uniquement — WOUND_ADDED aura maintenant `worst_wound_severity`)
- Toute logique de calcul dégâts (formules, tables localisation) — inchangée

---

## §8 — VALIDATION

### Test à écrire (avant de coder)

**T1 — Blessure en combat distance (CS1) :**
PJ tire sur PNJ → blessure grave → vérifier dans les logs serveur que `WOUND_ADDED` inclut `worst_wound_severity`. Vérifier côté joueur que la timeline combat met à jour la sévérité du token.

**T2 — Blessure en combat CaC PNJ auto (CS3) :**
PNJ attaque PJ → blessure → vérifier `WOUND_ADDED.worst_wound_severity`.

**T3 — Promotion (P49) :**
Infliger une blessure sur une case déjà pleine → vérifier que `finalSeverity` est la sévérité promue, pas la sévérité initiale. Vérifier que `shock_test_required` et `shockResult` utilisent la bonne sévérité.

**T4 — Ligne pleine sévérité max (PIEGE-1) :**
Remplir toutes les cases mortelles d'un PNJ → infliger une blessure mortelle → vérifier que le serveur log "[applyWound — ligne pleine]" et ne crash pas. Vérifier que COMBAT_ATTACK_RESULT est quand même émis.

**T5 — Non-régression (CS6 REST) :**
GM ajoute manuellement une blessure via `POST /char-sheet/:id/wounds` → vérifier que le comportement est identique à avant (worst_wound_severity présent dans WOUND_ADDED).

---

## §9 — PLAN D'IMPLÉMENTATION (à valider avec Saar avant de coder)

> Chaque étape = run à vide avant de passer à la suivante.

**Étape 1 — Lire les fichiers requis dans la même session**
- `server/src/lib/woundUtils.js` ✅ (lu)
- `server/src/socket/index.js` CS1–CS5 ✅ (lu)
- `server/src/routes/character/char-sheet.js` L.625–684 ✅ (lu)
- `client/src/stores/characterStore.js` → ZO-1 (à lire — updateCharacter avec undefined)
- `shared/woundConstants.js` → vérifier WOUND_SEVERITIES + WOUND_MAX_COUNTS

**Étape 2 — `server/src/lib/woundUtils.js`**
Ajouter export `getWorstWoundSeverity(db, charSheetId)`.
Run à vide : `node --check server/src/lib/woundUtils.js`

**Étape 3 — `server/src/lib/woundService.js`**
Créer le module avec `applyWound`.
Run à vide : `node --check server/src/lib/woundService.js`

**Étape 4 — `server/src/routes/character/char-sheet.js`**
Remplacer les 3 appels `getWorstWoundSeverity(charSheetId)` → `woundUtils.getWorstWoundSeverity(db, charSheetId)`.
Run à vide : `node --check server/src/routes/character/char-sheet.js`

**Étape 5 — `server/src/socket/index.js`**
Ajouter import woundService. Remplacer CS1–CS5 (dans l'ordre des lignes, de bas en haut pour ne pas décaler les numéros).
Run à vide : `node --check server/src/socket/index.js`

**Étape 6 — SR (Serveur Redémarré)**
`.\start.ps1`. Vérifier absence d'erreur dans les logs.

**Étape 7 — Validation T1–T5**

---

## §10 — QUESTIONS OUVERTES / À DÉCIDER

**Q1** : Faut-il corriger DIV-1 (`worst_wound_severity`) en même temps que le rework ? → OUI — c'est exactement ce que REWORK-03 corrige. Le bug DIV-1 sera résolu comme effet de bord du rework.

**Q2** : Faut-il ajouter `worst_wound_severity` dans `BUGIDENTIFIE.md` ? → OUI (bug actif non documenté). À faire avant le sprint fix.

**Q3** : `applyWound` doit-il retourner `isLethal` ? → Non nécessaire — le caller connaît déjà `isLethal`. `applyWound` n'a pas besoin de le retourner.

**Q4** : Nommer le nouveau service `woundService.js` ou `damageService.js` ? → `woundService.js` : le périmètre est la gestion des blessures (wound), pas du calcul dégâts total. `damageService` serait REWORK-02 (calcul dégâts distance).

---

## §11 — PROTOCOLE POST-COMPACT (à lire en premier après reprise)

> Ce bloc est écrit pour un Claude qui reprend à froid après compaction du contexte. Il ne remplace pas la lecture des fichiers — il indique quoi lire et dans quel ordre.

### Contexte résumé
REWORK-03 = extraction de `resolveWoundInsertion` + WOUND_ADDED broadcast hors des 5 call sites WS inline → nouveau module `server/src/lib/woundService.js`.

**Motivation** : 5 copies divergentes, bug DIV-1 actif (worst_wound_severity absent → reset store client), DIV-2 (try/catch incohérent → fenêtre bloquée sur erreur).

### Fichiers à lire AVANT de coder (dans cet ordre)

1. Ce fichier `docs/REWORK-03.md` — complet ✅
2. `server/src/lib/woundUtils.js` — fonction `resolveWoundInsertion` + `isShockTestRequired` + `nextSeverity` (43 lignes, rapide)
3. `server/src/socket/index.js` — uniquement les 5 blocs aux lignes exactes : **2474–2490, 2741–2758, 3553–3572, 3992–4005, 4344–4360**
4. `server/src/routes/character/char-sheet.js` — uniquement lignes **628–684** (`getWorstWoundSeverity` + 3 routes wounds)
5. `shared/woundConstants.js` — 23 lignes, pour vérifier WOUND_SEVERITIES (ordre)

### Ce qui a déjà été analysé et validé

- ✅ 6 call sites identifiés et lus (§1)
- ✅ `resolveWoundInsertion` lue et comprise (§2)
- ✅ 6 divergences documentées (§3)
- ✅ `updateCharacter` vérifié — spread écrase `worst_wound_severity: undefined` (ZO-1 résolu)
- ✅ Structure try/catch par site vérifiée (DIV-2 confirmée)
- ✅ `WOUND_UPDATED`/`WOUND_REMOVED` REST-only → déjà corrects (§6b)
- ✅ `resolveWoundInsertion` + `isShockTestRequired` : 0 usage restant dans socket/index.js hors CS1–CS5
- ✅ Variables exactes par call site documentées (§6c)
- ✅ Imports socket/index.js documentés (§6d)

### Décisions architecturales prises (ne pas réouvrir)

- `applyWound` dans `woundService.js` (pas dans `woundUtils.js`) — fonctions à effets séparées des pures
- `resolveShockTest` reste chez le caller — `woundService` sans dépendance à `statusService`
- `getWorstWoundSeverity` migre dans `woundUtils.js` (export) avec `db` en paramètre
- L'import `woundUtils` dans `socket/index.js` est entièrement remplacé par `woundService`

### Ce qui N'est PAS dans le périmètre de REWORK-03

- Calcul de dégâts (formules, tables LOC) — inchangé
- `statusService.js` — inchangé
- `WOUND_UPDATED`, `WOUND_REMOVED` — REST uniquement, déjà corrects
- Routes REST `char-sheet.js` blessures — `getWorstWoundSeverity` seule change (signature)
- Client — aucun changement (fix DIV-1 est server-side uniquement)

### Checklist de démarrage du sprint

1. Lire les 5 fichiers listés ci-dessus dans la session
2. Confirmer : `node --check server/src/lib/woundUtils.js` → 0 erreur (état initial)
3. Confirmer : `grep -c "resolveWoundInsertion" server/src/socket/index.js` → 5 (avant rework)
4. Coder dans l'ordre §9 — Étape 2, 3, 4, 5, 6, 7

---

## §CHANGELOG

| Date | Session | Mise à jour |
|---|---|---|
| 2026-06-16 | 95-8 | Création — analyse complète des 6 call sites, 6 divergences, 6 pièges, architecture cible |
| 2026-06-16 | 95-8 | ZO-1 résolu : updateCharacter spread écrase worst_wound_severity → DIV-1 actif depuis S71 |
| 2026-06-16 | 95-8 | woundConstants.js lu — 6 locations, 5 severities, maxCount tête mortelle=1 → PIEGE-1 confirmé |
| 2026-06-16 | 95-8 | Structure try/catch vérifiée — CS1/CS4 : catch externe → event résultat jamais émis → DIV-2 plus grave que prévu |
| 2026-06-16 | 95-8 | PIEGE-7/8 ajoutés — ordre tri getWorstWoundSeverity hardcodé, risk désync avec WOUND_SEVERITIES |
| 2026-06-16 | 95-8 | §6b/6c/6d ajoutés — scope DIV-1 confirmé REST-only correct, carte substitution exacte, imports socket/index.js |
| 2026-06-16 | 95-8 | §7 complété — imports woundService.js détaillés, interface applyWound simplifiée (retourne uniquement finalSeverity) |
| 2026-06-16 | 95-8 | characters.js L.55 vérifié — worst_wound_severity SQL inline, indépendant du rework |
| 2026-06-16 | 95-8 | §11 ajouté — protocole post-compact complet avec fichiers à lire, décisions prises, checklist |
| 2026-06-16 | 97 | Implémentation complète — woundUtils + woundService + char-sheet + socket/index (5 CS) + BUGIDENTIFIE DIV-1 ✅ |
| 2026-06-16 | 97 | T1 validé (blessure mortelle distance + couleurs sévérité ✅) — ⚠️ clos partiel (T2–T5 non testés) |

