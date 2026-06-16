# REWORK-01-CLOSURE.md — Clôture propre de REWORK-01 (statusService)
> Créé : 2026-06-16 — Session 95-7
> Objectif : documenter tout ce que l'on sait, toutes les zones d'ombre, toutes les décisions,
> AVANT de toucher un seul fichier. Ce document s'appended progressivement.

---

## Contexte — Pourquoi ce journal

REWORK-01 a été livré en Session 96 avec les Scénarios 1-5 validés. Deux bugs résiduels ont été
identifiés mais différés :

- **SHK4** — D20 Test de Choc non visible en chat (règle publique violée)
- **SHK5** — `shock_auto_stun=false` : PJ routé vers sa propre fenêtre au lieu du GM

Ces deux bugs sont dans le même module (`statusService.js`) et ont une cause racine documentée.
Les corriger sans précipitation garantit qu'on ne casse pas ce qui a été validé.

---

## Fichiers lus dans cette session (obligatoire avant tout code)

- [x] `docs/BUGIDENTIFIE.md` — descriptions SHK4 + SHK5 [VÉRIFIÉ]
- [x] `server/src/lib/statusService.js` — code complet du module
- [x] `shared/events.js` — COMBAT_STUN_PROMPT/CONFIRM présents ✅
- [x] `server/src/socket/index.js` — handler COMBAT_STUN_CONFIRM + 5 call sites resolveShockTest/applyStun
- [x] `client/src/components/CombatStunWindow.jsx` — composant complet
- [x] `client/src/pages/SessionPage.jsx` — listener COMBAT_STUN_PROMPT + stunPayload state
- [x] `client/src/components/CombatOverlay.jsx` — rendu CombatStunWindow
- [x] `client/src/components/Sidebar.jsx` — rendu DICE_RESULT (champs mechanicalTotal/diffLabel/chancesDeReussite)
- [x] `client/src/locales/fr.json` — i18n entityActionDetail/droneActionDetail
- [x] `server/src/lib/charStats.js` — getShockMalus : retourne ≤ 0 ✅ (Z7 résolu)

## Fichiers à relire en début de session post-compact (AVANT DE CODER)

Ces fichiers ont été analysés dans cette session mais doivent être relus intégralement après
compact pour valider le code exact aux endroits modifiés.

| Fichier | Pourquoi relire |
|---|---|
| `server/src/lib/statusService.js` | Écrire M1 + M2 + M3 — code exact requis |
| `server/src/socket/index.js` (5 zones) | Noms variables exacts à chaque call site |
| `client/src/index.css` §11 | Z14 — vérifier classes existantes avant .combat-stun-* |
| `client/src/components/CombatStunWindow.jsx` | Réécriture conventions CSS [A1] |
| `client/src/components/Sidebar.jsx` (zone ternaire) | Ligne exacte à modifier |
| `client/src/locales/fr.json` | Emplacement exact dans section sidebar |
| `client/src/locales/fr.json.test` | Z10 — même clé à dupliquer |

---

## BUG SHK4 — D20 Test de Choc non visible en chat

### Cause racine [VÉRIFIÉ]

`resolveShockTest` dans `statusService.js` ligne 41 :
```js
const { total: roll } = await parseDice('1d20')
```
Seul `total` est capturé. `rolls` (tableau des dés) et `seed` sont perdus.
Conséquence : pas de `DICE_RESULT` émis → D20 silencieux pour tous.

La fonction est intentionnellement pure (zéro IO). Le broadcast DICE_RESULT manque dans le flux,
pas dans la fonction elle-même.

### Où émettre le DICE_RESULT D20

5 call sites dans `index.js` appellent `resolveShockTest` :
- ~L.2486 — COMBAT_DAMAGE_CONFIRM (PJ tireur → cible PNJ/PJ)
- ~L.2753 — COMBAT_MELEE_DEFENSE_CONFIRM (PNJ auto défense)
- ~L.3565 — resolveMeleeAction (PNJ auto, branche PNJ dmg)
- ~L.4001 — resolveDroneAssaultAction branch 8b (drone → PNJ)
- ~L.4356 — resolveAssaultAction (PNJ auto, branche PNJ dmg)

Le broadcast doit se faire **POUR TOUT résultat non-null**, y compris `outcome='ok'` (test déclenché
mais personnage résiste → information publique selon §7.2 MANUELSYSCOMBAT). Les call sites actuels
n'appellent `applyStun` que si `outcome !== 'ok'`. L'émission D20 doit être indépendante du stun.

### Solution retenue

**Option A — Nouveau helper `statusService.emitShockDiceResult(...)`** ← retenue

```js
// À exporter depuis statusService.js — SYNCHRONE (pas async, emit seul)
export function emitShockDiceResult(io, campaignId, shockResult, userId, username, color) {
  io.to(campaignId).emit(WS.DICE_RESULT, {
    userId, username, color,
    formula:           '1d20',
    rolls:             shockResult.rolls,      // nouveau champ dans le return de resolveShockTest
    total:             shockResult.roll,
    isCriticalSuccess: false,
    isCriticalFail:    false,
    seed:              shockResult.seed,       // nouveau champ dans le return de resolveShockTest
    timestamp:         new Date().toISOString(),
    skillLabel:        'Test de Choc',
    mechanicalTotal:   shockResult.seuilEtourdi,  // seuilEtourdi inclut déjà le shockMalus
    diffLabel:         '',                        // non utilisé — seuils déjà baked
    chancesDeReussite: shockResult.seuilIncons,   // seuilIncons inclut déjà le shockMalus
    isSuccess:         shockResult.outcome === 'ok',
    cardType:          'shock_test',              // nouveau type → i18n dédiée
  })
}
```

**Option B — Incorporer dans applyStun** — Écarté. `applyStun` n'est pas appelé quand outcome='ok'.
Il faudrait restructurer le call pattern pour toujours appeler applyStun, ce qui change la sémantique.

**Option C — Intégrer directement dans les 5 call sites** — Écarté. Duplication ×5, contraire à
l'esprit du rework.

### Modifications nécessaires — SHK4

1. **`statusService.js` — `resolveShockTest`** : capturer `rolls` et `seed` de `parseDice`,
   les inclure dans le retour.

2. **`statusService.js`** : ajouter `emitShockDiceResult` (sync, non async — emit seul, pas d'IO db).

3. **`index.js` — 5 call sites** : après `resolveShockTest`, si non-null → appeler
   `statusService.emitShockDiceResult(io, campaignId, shockResult, userId, username, color)`.

4. **`client/src/locales/fr.json`** : ajouter `"shockTestDetail"`.

5. **`client/src/components/Sidebar.jsx`** : ajouter routing `cardType === 'shock_test'`.

### Format carte Sidebar

`entityActionDetail` actuel : `"Compétence : {{skill}} · Dif.{{dif}} · Seuil : {{seuil}}"`

Nouveau `shockTestDetail` proposé :
```json
"shockTestDetail": "Étourd. ≤ {{skill}} · Inconsc. ≤ {{seuil}}"
```

`{{dif}}` n'est pas utilisé (les seuils incluent déjà le malus). Le template l'ignore.

Exemple rendu : `Étourd. ≤ 15 · Inconsc. ≤ 18`
Carte complète : titre "Test de Choc", D20=13 en grand, détail "Étourd. ≤ 15 · Inconsc. ≤ 18",
badge vert (RÉSISTÉ) ou rouge (ÉTOURDI / INCONSCIENT).

---

## BUG SHK5 — shock_auto_stun=false : PJ routé vers lui-même

### Cause racine [VÉRIFIÉ]

`applyStun` dans `statusService.js` lignes 95-108 :
```js
if (isPJ) {
  const sockets  = await io.in(campaignId).fetchSockets()
  const pjSocket = sockets.find(s => s.data.userId === tokenRow.user_id)
  if (pjSocket) {
    pendingStunActions.set(targetTokenId, { ..., isGmPrompt: false })
    pjSocket.emit(WS.COMBAT_STUN_PROMPT, ...)
    return
  }
}
```

`shock_auto_stun` n'est LU que dans la branche PNJ (lignes 111-130). La branche PJ l'ignore
complètement.

### Solution retenue

Dans la branche PJ, lire `shock_auto_stun` depuis la DB **avant** de décider du socket cible.
Si `false` → socket = gmSocket, `isGmPrompt: true`.
Si `true` → socket = pjSocket, `isGmPrompt: false`.

Code cible :
```js
if (isPJ) {
  const campaign      = await db('campaigns').where({ id: campaignId }).select('shock_auto_stun').first()
  const shockAutoStun = campaign?.shock_auto_stun ?? true
  const sockets       = await io.in(campaignId).fetchSockets()

  const targetSocket  = shockAutoStun
    ? sockets.find(s => s.data.userId === tokenRow.user_id)  // pjSocket
    : sockets.find(s => s.data.role === 'gm')                // gmSocket

  if (targetSocket) {
    pendingStunActions.set(targetTokenId, {
      campaignId, targetTokenId, outcome,
      targetUserId:  shockAutoStun ? tokenRow.user_id : null,
      userId, username, color, currentTurn,
      isGmPrompt:    !shockAutoStun,
    })
    targetSocket.emit(WS.COMBAT_STUN_PROMPT, { tokenId: targetTokenId, outcome })
    return
  }
  // offline/no-GM → fallback auto (inchangé)
}
```

### Vérification chaîne complète SHK5

**Serveur COMBAT_STUN_CONFIRM** (~L.2818-2845 index.js) :
```js
const isAuthorized = pending.isGmPrompt
  ? (socket.data?.role === 'gm')   // GM confirme ← ✅ déjà en place
  : (pending.targetUserId === socket.user.id)
```
Aucune modification nécessaire. Le handler gère déjà `isGmPrompt: true`.

**Client SessionPage.jsx** (L.532-534) :
```js
s.on(WS.COMBAT_STUN_PROMPT, (data) => setStunPayload(data))
```
Listener agnostique du rôle → GM recevra le prompt et verra `CombatStunWindow` ✅

**Client CombatOverlay.jsx** (L.246-252) :
```js
{stunPayload && (
  <CombatStunWindow payload={stunPayload} socket={socket} onClose={() => onStunConfirmed()} />
)}
```
Rendu conditionnel global → visible pour GM et PJ indifféremment ✅

**Conclusion SHK5** : la correction est UNIQUEMENT dans `statusService.js` — une dizaine de lignes.
Aucun changement client, aucun changement handler index.js.

---

## VIOLATIONS DE CONVENTIONS — CombatStunWindow.jsx

Documentées dans ARCHI_REWORK.md §Analyse qualité [A1] — à corriger dans ce sprint.

| Violation | Ligne | Règle violée | Correction |
|---|---|---|---|
| `style={}` visuels statiques | overlay, combat-float-win, badge, btn | `style={}` = layout uniquement | Créer classes CSS dans `index.css §11` |
| Bouton sans `className="btn"` | L.33-39 | Convention CSS Session 76 | `className="btn"` |

**Classes CSS à créer dans `index.css §11` :**
- `.combat-stun-outcome` — badge coloré (fond + bordure) → utiliser CSS custom property `--stun-color`
- `.combat-stun-btn` → ou simplement `className="btn"` avec `style={{ borderColor: col, color: col }}`

⚠ Attention piège CSS custom properties : la couleur `col` est dynamique (dépend de `outcome`).
Options :
- A) `style={{ '--stun-color': col }}` sur le container + `.combat-stun-outcome { color: var(--stun-color); }` ← conforme conventions
- B) garder `style={{ borderColor: col, color: col }}` pour la partie couleur dynamique uniquement ← moins conforme mais acceptable si la classe gère le layout

→ Option A retenue pour le badge. Pour le bouton : `className="btn"` + `style={{ borderColor: col, color: col }}` (couleur dynamique = OK en style inline selon conventions).

---

## ZONES D'OMBRE / PIÈGES IDENTIFIÉS

### Piège Z1 — `io.in(campaignId).fetchSockets()` vs `io.fetchSockets()`

Dans `applyStun`, la branche PNJ utilise `io.in(campaignId).fetchSockets()` (filtré par room).
La branche PJ actuelle aussi. Cohérent. Ne pas changer.

Comparaison COMBAT_STUN_CONFIRM handler : utilise `io.fetchSockets()` (non filtré) à L.2788 dans
un contexte melee. Potentiellement moins correct mais hors scope ici.

### Piège Z2 — Ordre des champs `rolls` dans DICE_RESULT

`parseDice` retourne `{ total, rolls, seed }`. Dans `_applyAutoStun` (D6), les trois sont
utilisés. Dans `resolveShockTest`, seul `total` est pris. Vérifier que la modification du
destructuring n'a pas d'effet de bord sur le return de parseDice :
```js
// Avant :
const { total: roll } = await parseDice('1d20')
// Après :
const { total: roll, rolls: d20Rolls, seed: d20Seed } = await parseDice('1d20')
```
Aucun effet de bord — on capture plus, on n'ignore plus.

### Piège Z3 — `emitShockDiceResult` est SYNCHRONE

Cette fonction ne fait qu'un `io.to(...).emit(...)` — elle n'a pas besoin d'être `async`.
Ne pas la déclarer `async` pour ne pas créer une promise non-attendue.
Elle doit quand même être appelée AVANT `COMBAT_ATTACK_RESULT` / `COMBAT_DAMAGE_RESULT` dans
les call sites — pour que le D20 apparaisse dans le chat avant le résultat de l'attaque.

**Ordre cible dans chaque call site :**
```js
shockResult = await statusService.resolveShockTest({...})
if (shockResult) {
  statusService.emitShockDiceResult(io, campaignId, shockResult, userId, username, color)  // D20 en chat
}
// [... broadcast COMBAT_ATTACK_RESULT / COMBAT_DAMAGE_RESULT ...]
if (shockResult?.outcome && shockResult.outcome !== 'ok') {
  statusService.applyStun(...).catch(...)                                                   // stun
}
```

### Piège Z4 — variables `userId`, `username`, `color` aux 5 call sites

Ces variables ont des noms différents selon le contexte. À vérifier par lecture du contexte de
chaque call site avant de coder les 5 modifications.

| Site | `userId` | `username` | `color` |
|---|---|---|---|
| ~2486 COMBAT_DAMAGE_CONFIRM | `userId` | `tireurUsername` | `tireurColor` |
| ~2753 COMBAT_MELEE_DEFENSE_CONFIRM | `userId` | `attackerUsername` | `attackerColor` |
| ~3565 resolveMeleeAction PNJ | `character.user_id` | `attackerUsername` | `attackerColor` |
| ~4001 resolveDroneAssaultAction 8b | `userId` | `tireurUsername` | `tireurColor` |
| ~4356 resolveAssaultAction PNJ | `character.user_id` | `tireurUsername` | `tireurColor` |

**⚠ À VÉRIFIER au moment du code** : confirmer que ces variables sont bien en scope à chaque
endroit AVANT de coder. Ne pas supposer.

### Piège Z5 — `shockResult.outcome` peut être 'ok' mais `shockResult` non-null

La condition actuelle d'appel à `applyStun` :
```js
if (shockResult?.outcome && shockResult.outcome !== 'ok') { applyStun(...) }
```

La condition correcte pour l'émission D20 :
```js
if (shockResult) { emitShockDiceResult(...) }  // ← même si outcome='ok'
```

Ne pas copier-coller la condition `outcome !== 'ok'` pour l'émission D20 — c'est une erreur
facile à commettre.

### Piège Z6 — Sidebar.jsx: condition ternaire emboîtée pour cardType

Code actuel Sidebar.jsx :
```js
{t(msg.cardType === 'drone_damage' ? 'sidebar.droneActionDetail' : 'sidebar.entityActionDetail', {...})}
```

Modification à apporter :
```js
{t(msg.cardType === 'drone_damage'
  ? 'sidebar.droneActionDetail'
  : msg.cardType === 'shock_test'
  ? 'sidebar.shockTestDetail'
  : 'sidebar.entityActionDetail',
  { skill: msg.mechanicalTotal, dif: msg.diffLabel, seuil: msg.chancesDeReussite }
)}
```

Risque : oublier la virgule entre le t() call et le `{...}` objet d'interpolation. Lire le code
entier de la section avant de l'éditer.

### Piège Z7 — shockMalus dans diffLabel : RÉSOLU [VÉRIFIÉ]

`getShockMalus` dans `charStats.js:400` retourne toujours des valeurs **≤ 0** (ex: -5, -10, -15).

Dans `resolveShockTest`, `seuilEtourdi` et `seuilIncons` sont DÉJÀ calculés avec le malus intégré :
```js
seuilEtourdi: seuils.etourdissement + shockMalus,  // ex: 20 + (-5) = 15
seuilIncons:  seuils.inconscience   + shockMalus,
```

**Conséquence** : afficher directement `seuilEtourdi` et `seuilIncons` — pas besoin de `diffLabel`.
Le malus est déjà baked dans les seuils affichés. Format i18n simplifié :
```json
"shockTestDetail": "Étourd. ≤ {{skill}} · Inconsc. ≤ {{seuil}}"
```
- `mechanicalTotal: seuilEtourdi` → "Étourd. ≤ 15"
- `chancesDeReussite: seuilIncons` → "Inconsc. ≤ 18"
- `diffLabel: ''` → non utilisé dans ce template (ignoré par i18next)

Design carte : "Test de Choc · [D20=13] · Étourd. ≤ 15 · Inconsc. ≤ 18 → [badge ÉTOURDI]"

### Piège Z8 — Site 2 (COMBAT_MELEE_DEFENSE_CONFIRM) : `meleeCampaignId`, pas `campaignId` ⚠ CRITIQUE

Confirmé par grep. Ce call site passe `meleeCampaignId` à `applyStun`, pas `campaignId`.
Copier le pattern des 4 autres sites avec `campaignId` = bug silencieux (D20 dans la mauvaise room).
```js
// CORRECT pour site 2 :
statusService.emitShockDiceResult(io, meleeCampaignId, shockResult, userId, attackerUsername, attackerColor)
```

### Piège Z9 — Site 1 : ordre chat D20 choc avant D20 localisation

Au site 1 (COMBAT_DAMAGE_CONFIRM), la DICE_RESULT localisation est émise à l'étape 7 (APRÈS le
shockResult). Si on émet le D20 choc à l'étape 5.5 (après resolveShockTest), la sidebar affiche :
[Test de Choc] → [D20 localisation] → [D6 stun].
Ordre contre-intuitif mais non régressif — c'est l'ordre actuel du code existant, pas introduit
par ce fix. Décision : placement uniforme (avant COMBAT_ATTACK_RESULT) à tous les sites. Note
UX sprint futur.

### Piège Z10 — `fr.json.test` à mettre à jour aussi

Par précédent Session 93-5 : `sidebar.droneActionDetail` ajouté dans `fr.json` ET `fr.json.test`.
La nouvelle `sidebar.shockTestDetail` doit être ajoutée dans les DEUX fichiers.

### Piège Z11 — JSDoc `applyStun` à mettre à jour (SHK5)

Commentaire ligne 78 statusService.js : "PNJ + shock_auto_stun=false → COMBAT_STUN_PROMPT au
socket GM." Après SHK5 fix, doit aussi mentionner : "PJ + shock_auto_stun=false → idem."

### Piège Z12 — `stunPayload` état unique : limitation pré-existante

Si deux COMBAT_STUN_PROMPT arrivent rapidement (deux PJ ciblés simultanément), le second écrase
le premier. La pending action du premier reste en mémoire serveur (Map non consommée).
**Pré-existant, non introduit par SHK5.** Ne pas corriger maintenant — documenter.

### Piège Z13 — Champs `rolls`/`seed` dans shockResult passé à COMBAT_ATTACK_RESULT

Après M1, shockResult contient deux nouveaux champs. Ils apparaissent dans le payload de
COMBAT_ATTACK_RESULT/COMBAT_DAMAGE_RESULT. Les consommateurs connus (ShockBlock dans
CombatResultPanels.jsx) ne lisent que triggered/roll/outcome/shockMalus/seuilEtourdi/seuilIncons.
Extra champs ignorés. Pas de breaking change. À vérifier en cas de doute par grep sur shockResult.

### Piège Z14 — `index.css §11` à lire avant de coder CombatStunWindow

Non lu dans cette session. Vérifier avant de créer `.combat-stun-*` :
- Ces classes n'existent pas déjà
- Pattern des classes similaires pour la cohérence

### Piège Z15 — `parseDice` retourne bien `{ total, rolls, seed }`

Confirmé via `_applyAutoStun` (D6) : `{ total: d6Raw, rolls: d6Rolls, seed: d6Seed }`.
Le D20 suit le même schéma. Destructuring sûr.

---

## PLAN D'IMPLÉMENTATION — Ordre obligatoire

**Régle : vérifier les variables en scope à chaque call site AVANT de coder chaque modification.**

### Étape 1 — statusService.js (deux modifications)

**M1 — resolveShockTest** : capturer `rolls` et `seed`, les inclure dans le retour.
```js
// Avant :
const { total: roll } = await parseDice('1d20')
// Après :
const { total: roll, rolls: d20Rolls, seed: d20Seed } = await parseDice('1d20')
// Return ajout :
return {
  triggered: true, roll, rolls: d20Rolls, seed: d20Seed,
  outcome, shockMalus, seuilEtourdi: ..., seuilIncons: ...,
}
```

**M2 — applyStun (SHK5)** : lire `shock_auto_stun` dans la branche PJ, router vers GM si false.
Code cible documenté ci-dessus (§BUG SHK5).

**M3 — emitShockDiceResult (SHK4)** : nouvelle fonction exportée SYNCHRONE.
Code cible documenté ci-dessus (§BUG SHK4 §Solution retenue).

Run à vide après Étape 1 : `node --check server/src/lib/statusService.js`

### Étape 2 — socket/index.js (5 call sites SHK4)

Pour chaque call site, ajouter après `resolveShockTest` :
```js
if (shockResult) {
  statusService.emitShockDiceResult(io, campaignId, shockResult, <userId>, <username>, <color>)
}
```

**Vérifier les noms de variables exacts en lisant le contexte de chaque call site.**

Run à vide après Étape 2 : `node --check server/src/socket/index.js`

### Étape 3 — fr.json + fr.json.test (DEUX fichiers)

Ajouter dans section `sidebar` des deux fichiers :
`"shockTestDetail": "Étourd. ≤ {{skill}} · Inconsc. ≤ {{seuil}}"`
(sans `{{dif}}` — les seuils incluent déjà le malus)

### Étape 4 — Sidebar.jsx

Ajouter routing `cardType === 'shock_test'` → `sidebar.shockTestDetail` dans la ternaire.

### Étape 5 — CombatStunWindow.jsx (corrections conventions)

**Lire `client/src/index.css` Section 11 AVANT de coder (Z14)** — vérifier classes existantes.
Corriger violations [A1] : CSS custom property `--stun-color` pour le badge, `className="btn"` sur le bouton.
Supprimer `styles.headerTitle` et `styles.actionBtn` du styles-object (visuels statiques → CSS classes).

Run à vide après Étapes 3-5 : `npm run build` (client) → Vite 200 sans warnings.

### Étape 6 — SR

Démarrer `.\start.ps1`, vérifier logs propres.

---

## SCÉNARIOS DE VALIDATION — Extension des scénarios REWORK-01

### SHK4 — D20 visible en chat

- Déclencher une blessure Grave/Tête ou Mortelle/Corps sur un PNJ
- Attendu : carte `DICE_RESULT` "Test de Choc" dans la sidebar **avant** la carte résultat d'attaque
- Vérifier les champs : D20 roll visible, seuils étourdi/inconscient affichés, outcome (badge vert/rouge)
- Tester les 3 outcomes : ok / étourdi / inconscient

### SHK5 — GM reçoit le prompt quand shock_auto_stun=false

- Mettre `campaigns.shock_auto_stun = false` (UPDATE en DB ou via Settings campagne)
- Déclencher une blessure requérant shock sur un **PJ** connecté
- Attendu : `CombatStunWindow` apparaît chez le **GM**, pas chez le PJ
- Cliquer "Lancer 1D6" côté GM → DICE_RESULT D6 visible, badge stun posé
- Non-régression : `shock_auto_stun=true` → PJ reçoit toujours la fenêtre

### Non-régression Scénarios 1-5

Re-valider les 5 scénarios originaux REWORK-01 après la modification.
Particulièrement : Scénario 2 (PJ cible + shock) et Scénario 3 (non-régression blessure légère).

---

## DÉCISIONS ARCHITECTURALES

| Décision | Raison |
|---|---|
| `emitShockDiceResult` synchrone (non async) | Emit seul, pas de DB — ne pas créer une promise orpheline |
| Émission D20 **avant** COMBAT_ATTACK_RESULT | Ordre cohérent avec la narration : le test survient avant de savoir l'impact |
| `cardType: 'shock_test'` + i18n dédiée | Évite de déforcer `entityActionDetail` — chaque type a ses labels sémantiques |
| Correction conventions CombatStunWindow dans ce sprint | [A1] documenté comme "dette sprint futur" — ce sprint EST le sprint futur logique |

---

## RÉCAP PÉRIMÈTRE — 8 fichiers touchés

| # | Fichier | Modification | Bug |
|---|---|---|---|
| 1 | `server/src/lib/statusService.js` | M1 resolveShockTest : rolls+seed | SHK4 |
| 2 | `server/src/lib/statusService.js` | M2 applyStun : shock_auto_stun PJ | SHK5 |
| 3 | `server/src/lib/statusService.js` | M3 emitShockDiceResult (nouvelle export) | SHK4 |
| 4 | `server/src/socket/index.js` | 5 call sites : +emitShockDiceResult | SHK4 |
| 5 | `client/src/locales/fr.json` | +shockTestDetail | SHK4 |
| 6 | `client/src/locales/fr.json.test` | +shockTestDetail (Z10) | SHK4 |
| 7 | `client/src/components/Sidebar.jsx` | +cardType shock_test routing | SHK4 |
| 8 | `client/src/components/CombatStunWindow.jsx` | Conventions CSS [A1] | —  |

**Fichiers NON touchés :** `shared/events.js` ✅ (COMBAT_STUN_PROMPT/CONFIRM présents),
`SessionPage.jsx` ✅ (listener correct), `CombatOverlay.jsx` ✅ (rendu correct),
`charStats.js` ✅, `woundUtils.js` ✅.

---

## ÉTAT DU JOURNAL

> Mise à jour : Run à vide complet — 2026-06-16 Session 95-7
> 15 pièges documentés — 8 fichiers ciblés — prêt pour implémentation post-compact
> Prochaine mise à jour : après implémentation Étape 1
