# JOURNAL44.md — Session 44 — Mémoire externe vérifiée
> Créé au fil de la lecture des fichiers. Mis à jour après chaque vérification.
> Règle : rien n'entre ici sans avoir été lu dans le fichier réel cette session.

---

## Contexte de reprise

Session 43 terminée : 9F-C ✅ complet et stable.
EntityEditorOLD.jsx supprimé au début de la session 44.
Prochain chantier : Bug A (toggle visible character) → puis Dice Rework.

---

## Fichiers lus — docs projet

### SYSTEME.md ✅ — SESSION_JOIN : socket.data.role stocké. CHARACTER_UPDATED dans liste events WS (l.130).
### ASBUILT.md ✅ — 46 migrations stables. characters.js route présente.
### EN_COURS.md ✅ — Bug A ouvert : "Toggle visible character non répercuté en temps réel".
### JOURNAL2.md ✅ — Dernière session = 43. Bug A signalé dès session 9B (l.142) : "Bug A toujours présent".
### Dice_rework.md ✅ — Spec complète. Architecture : DiceOverlay + DiceRoller + DiceMesh + diceMath.js + useDiceAudio.js.

---

## Bug A — Toggle visible character — Analyse en cours

### Ce que fait le toggle (Sidebar.jsx lu ✅)

`handleToggleVisible` (l.195-204) :
1. `PUT /characters/:id` avec `{ visible: !character.visible }`
2. `updateCharacter({ id, visible })` → store local Zustand
3. `onCharacterUpdate(updated)` → `selectedCharacter` dans la modale Sidebar

Commentaire l.193 : *"Le serveur broadcastera CHARACTER_UPDATED à toute la room — pas d'emit client."*

Liste persos (l.1080-1105) : lit `characters` depuis `useCharacterStore()`.
Indicateur visibility (l.1099) : `{isGm && !char.visible && <IconEyeOff />}` — conditionnel sur `char.visible`.

### Points à vérifier

| Question | Fichier à lire | Statut |
|---|---|---|
| Est-ce que PUT /characters/:id broadcaste CHARACTER_UPDATED avec `visible` ? | characters.js (server) | 🔲 |
| Est-ce que SessionPage écoute CHARACTER_UPDATED et appelle updateCharacter ? | SessionPage.jsx | 🔲 |
| Est-ce que characterStore.updateCharacter merge correctement le champ `visible` ? | characterStore.js | 🔲 |

---

## Convention logs — session 44

Logs debug `console.log` bienvenus dans les fichiers serveur modifiés.
Suppression après validation fonctionnelle, ou conservés si décision dev.
Même approche que les `[DBG]` dans index.js (session 43).

---

## Fichiers lus — code

### Sidebar.jsx ✅ lu (client)

- `handleToggleVisible` (l.195-204) : PUT → `updateCharacter` store local → `onCharacterUpdate` modale
- Commentaire l.193 : "Le serveur broadcastera CHARACTER_UPDATED — pas d'emit client"
- Liste persos lit `characters` depuis store (l.1080-1105)
- Indicateur `!char.visible` → IconEyeOff (l.1099) — conditionnel correct

### SessionPage.jsx ✅ lu (client)

- `selectedCharacter` = dérivé du store (l.78-80) — se met à jour si store correct
- Handler `CHARACTER_UPDATED` (l.339-341) : `upsertCharacter(updatedCharacter)` ✅ présent
- **Le listener WS existe et est correct côté client.**
- Bug donc dans : `upsertCharacter` store OU broadcast serveur `PUT /characters/:id`

### characterStore.js ✅ lu (client)

- `updateCharacter` (merge partiel) : utilisé par Sidebar localement ✅
- `upsertCharacter` (remplacement complet) : utilisé par handler WS CHARACTER_UPDATED ✅
  - Si existe → remplace entièrement (`character : c`)
  - Si n'existe pas → ajoute
- **Le store est correct.** `upsertCharacter` avec l'objet complet = mise à jour propre.

### CONCLUSION INTERMÉDIAIRE

Store ✅ Client WS handler ✅ → **Le bug est côté serveur.**
`PUT /characters/:id` ne broadcaste probablement pas `CHARACTER_UPDATED`, ou le broadcaste avec un objet incomplet (sans `visible`).

**Prochain fichier à lire : `server/src/routes/characters.js`** → vérifier le broadcast.

### characters.js ✅ lu (server/src/routes/characters.js)

**PUT /:id — broadcast CHARACTER_UPDATED :**
```js
const { gm_notes: _gm_notes, ...characterPublic } = updatedCharacter
const io = req.app.get('io')
io.to(updatedCharacter.campaign_id).emit(WS.CHARACTER_UPDATED, characterPublic)
```
- Broadcast présent ✅
- `characterPublic` contient `visible` ✅ (gm_notes retiré, tout le reste inclus)
- `io.to(campaign_id)` = toute la room ✅

**Objet broadcasté :** id, campaign_id, user_id, name, color, visible, glb_url, portrait_url, description, created_at, updated_at, owner_username

---

## DIAGNOSTIC FINAL — Bug A

**Toute la chaîne est en place :**
- PUT /characters/:id → update DB → broadcast CHARACTER_UPDATED avec `visible` ✅
- SessionPage handler CHARACTER_UPDATED → upsertCharacter ✅
- characterStore.upsertCharacter → remplace l'objet complet ✅
- Sidebar liste persos → lit `characters` depuis store ✅
- selectedCharacter → dérivé du store via characters.find ✅

**Hypothèse 1 : `io` non disponible dans actionsRouter.**
actionsRouter est un router standalone monté sous /api/characters.
req.app.get('io') fonctionne si app.set('io', io) est présent dans index.js.
Si io est undefined → TypeError non catchée → 500 côté serveur.
→ À vérifier : est-ce que le toggle retourne 200 ou 500 ?

**Hypothèse 2 : room mal nommée.**
io.to(updatedCharacter.campaign_id) → UUID.
SESSION_JOIN joint campaignId depuis l'URL → même UUID.
→ Semble cohérent — à confirmer avec socket/index.js.

**Fichier manquant : server/src/socket/index.js**
→ vérifier socket.join(campaignId) au SESSION_JOIN.

### server/src/index.js ✅ lu

- `app.set('io', io)` présent ligne 40, AVANT montage des routes ✅
- `app.use('/api/characters', charactersActionsRouter)` présent ✅
- **Hypothèse 1 éliminée** : `io` est bien disponible dans `actionsRouter`.

**Reste à lire : server/src/socket/index.js**
→ Vérifier socket.join() au SESSION_JOIN — clé de la room.

### server/src/socket/index.js ✅ lu (SESSION_JOIN uniquement — suffisant pour diagnostic)

- `socket.join(campaignId)` ligne 74 — room = campaignId (UUID) ✅
- `socket.data.userId` et `socket.data.role` stockés ✅ (PE2)
- **Hypothèse 2 éliminée** : room cohérente avec broadcast characters.js.

---

## DIAGNOSTIC BUG A — CONCLUSION

**Toute la chaîne est correcte sur le papier.**
Les 5 fichiers lus ne révèlent aucun bug structurel.

**Hypothèse finale : le GM ne reçoit pas son propre broadcast.**

`io.to(campaignId).emit(...)` envoie à TOUS les sockets dans la room, y compris l'émetteur.
Le GM fait le toggle → REST PUT → broadcast → son propre handler CHARACTER_UPDATED reçoit l'event.
`upsertCharacter` met à jour le store → `characters` change → re-render Sidebar → liste mise à jour.

**Sauf si** : `selectedCharacterId` dans SessionPage pointe vers un character dont `visible` vient de changer,
et que la modale Sidebar reçoit `onCharacterUpdate(updated)` depuis le REST (Sidebar.jsx l.199),
mais le store reçoit un objet DIFFÉRENT via WS (CHARACTER_UPDATED sans gm_notes).

**La modale `CharacterModal` reçoit `character` en prop depuis `selectedCharacter`.**
`selectedCharacter = characters.find(c => c.id === selectedCharacterId)` — dérivé du store.
Quand le store est mis à jour → `selectedCharacter` change → modale re-render → icône œil correcte.

**Mais la liste Sidebar** (l.1080-1105) n'affiche PAS la modale — elle affiche les cards.
Les cards lisent `char.visible` depuis `characters` du store. Si le store est mis à jour → cards correctes.

**Conclusion : le bug ne peut être que dans l'un de ces cas :**
1. Le broadcast ne part pas (erreur silencieuse non loguée)
2. Le handler WS côté client ne se déclenche pas (event name incorrect)
3. `upsertCharacter` reçoit un objet sans `visible` (impossible — vérifié)

**Action diagnostique nécessaire : ajouter des logs serveur dans PUT /:id**
et vérifier en console F12 si CHARACTER_UPDATED est reçu côté client.
→ Ce n'est PAS un bug de code — c'est un bug à localiser avec des logs.

### shared/events.js ✅ lu

- `CHARACTER_UPDATED: 'character:updated'` présent ✅
- Même constante utilisée dans characters.js (emit) et SessionPage.jsx (on) ✅
- **Dernière incertitude éliminée.**

---

## TOUTES LES HYPOTHÈSES ÉLIMINÉES — SAUF UNE

Après lecture de 6 fichiers, toute la chaîne est correcte sur le papier.
Le seul moyen de localiser le bug = logs runtime.

**Plan logs characters.js — 3 lignes après l.180 :**
1. `console.log('[DBG] char PUT — payload:', JSON.stringify(characterPublic))`
2. `console.log('[DBG] char PUT — io:', !!io, '— room:', updatedCharacter.campaign_id)`
3. `console.log('[DBG] char PUT — CHARACTER_UPDATED émis')`

Aucune logique modifiée. Aucun autre fichier touché.

---

## Bug A — Toggle visible character — RÉSOLU ✅

### Cause
`upsertCharacter` dans characterStore.js remplaçait l'objet dans le store sans tenir compte
de `visible`. Le joueur gardait le character dans sa liste même après `visible: false`.

### Fix
`client/src/stores/characterStore.js` — `upsertCharacter` :
- Si `!character.visible && !state.isGm` → `filter()` retire le character du store
- Sinon → comportement existant inchangé (upsert normal)

### Fichiers modifiés
| Fichier | Modification |
|---|---|
| `client/src/stores/characterStore.js` | upsertCharacter — guard visible + isGm |
| `server/src/routes/characters.js` | Logs [DBG] ajoutés pour diagnostic (à retirer ou conserver) |

### Validation fonctionnelle ✅
- GM masque character → joueur le voit disparaître en temps réel ✅
- GM rend visible → joueur le voit apparaître en temps réel ✅ (régression exclue)

---

## Décision — logs characters.js

Logs `[DBG]` dans `PUT /characters/:id` **retirés**.
Pertinence faible : bug résolu, chaîne confirmée, aucune valeur diagnostique permanente.
Contrairement aux logs `index.js` step-by-step (conservés — utiles pour debug sessions futures).

---

## État session 44 — après Bug A

### Chantiers terminés cette session
- EntityEditorOLD.jsx supprimé ✅
- Bug A (toggle visible character temps réel) ✅

### Chantier suivant
- Retrait logs characters.js (dette immédiate)
- Dice Rework (chantier principal)

### Fichiers modifiés session 44 (confirmés fonctionnels)
| Fichier | Modification | État |
|---|---|---|
| `client/src/stores/characterStore.js` | upsertCharacter — guard visible+isGm | ✅ stable |
| `server/src/routes/characters.js` | Logs [DBG] diagnostic — à retirer | 🔲 |

### Logs characters.js — retirés ✅
Version originale (sans logs) remise en place directement.
characters.js = propre, identique à l'upload initial.

---

## Dice Rework — Analyse préliminaire

### DicePanel.jsx ✅ lu (client/src/components/DicePanel.jsx)

**Architecture actuelle :**
- Panneau flottant draggable — `position: fixed`, zIndex 8001
- Bouton toggle replié — collé à la sidebar (right dynamique)
- Grille D4→D100 × quantités 2-6 + jet avancé (input formule)
- Émission : `socket.emit(WS.DICE_ROLL, { formula })` — inchangé dans le Rework
- Rendu résultats : délégué à Sidebar (messages chat) — pas dans DicePanel
- Mode édition : panneau désactivé (opacity 0.3)
- Monté dans SessionPage : `<DicePanel socket={socket} mode={mode} sidebarVisible={...} sidebarWidth={...} />`

**Ce qui change avec le Rework :**
- DicePanel CONSERVÉ tel quel — c'est l'interface de lancer, pas d'animation
- Le Rework ajoute un NOUVEL overlay par-dessus : DiceOverlay.jsx
- DiceOverlay écoute DICE_RESULT → affiche l'animation → clic pour fermer
- Le payload DICE_RESULT côté serveur doit être étendu : ajouter `seed`, `rollId`, restructurer `dice[]`/`results[]`

**Points d'attention :**
- DicePanel émet `WS.DICE_ROLL` avec `{ formula }` — inchangé
- DICE_RESULT actuellement reçu dans SessionPage (l.342) et dispatché en message chat
- Le Rework ne touche PAS au message chat — DiceOverlay est un canal visuel parallèle
- `seed` doit venir du serveur — P11 (calcul dés côté serveur UNIQUEMENT)

**Fichiers restant à lire :**
- `server/src/routes/dice.js` — payload DICE_RESULT actuel
- `client/src/locales/fr/translation.json` — clés i18n existantes

### dice.js ✅ lu (server/src/routes/dice.js)

**Route REST uniquement :**
- `POST /api/dice/roll` — standalone, hors session WS, pour tests
- Retourne `{ rolls, total, formula, dieType, seed }` — `seed` déjà présent ✅
- **Cette route n'est PAS utilisée pour les jets en session.**
- Les jets en session passent par `WS.DICE_ROLL` → handler dans `socket/index.js`

**Ce qui compte pour le Rework :**
- Le handler WS `DICE_ROLL` dans `socket/index.js` est la vraie source
- Il broadcaste `DICE_RESULT` → reçu par SessionPage → message chat
- Ce handler doit ajouter `seed` et `rollId` dans le broadcast DICE_RESULT
- `parseDice` retourne déjà `seed` → il suffit de le propager dans le broadcast

**Fichiers restant à lire avant de planifier :**
- `client/src/locales/fr/translation.json` — clés i18n existantes
- Section DICE_ROLL de `socket/index.js` — déjà uploadé, à relire (lignes à identifier)

### socket/index.js — section DICE_ROLL ✅ relu (l.389-438)

**Payload DICE_RESULT actuel (jet normal /r formule) :**
```js
{
  userId, username, color,
  formula, rolls, total,
  isCriticalSuccess, isCriticalFail,
  seed,       // ✅ déjà présent
  timestamp,
}
```

**`rollId` absent** — à ajouter pour le Rework (identifiant unique du jet).
**`seed` déjà présent** ✅ — parseDice le retourne, déjà propagé.

**Les autres broadcasts DICE_RESULT (entity actions) :**
- l.622, l.696, l.970 — jets d'interaction entité (1d20)
- Contiennent aussi `seed` déjà ✅
- Contiennent `skillLabel`, `interactionType`, `mr` etc. — champs spécifiques entités
- Ces jets doivent-ils aussi déclencher l'animation ? À décider.

**Ce qu'il faut ajouter dans le broadcast DICE_ROLL (l.421) :**
- `rollId` : `crypto.randomUUID()` ou `Date.now().toString()` — identifiant unique du jet
- Restructuration `dice[]`/`results[]` pour la spec Dice_rework ?

**→ Relire Dice_rework.md spec §7 interface serveur avant de décider.**

### fr.json ✅ lu

Pas de clés `dice.overlay` existantes — à créer.
Clés existantes `dice.*` : roll, result, formula, history, panel, gmRoll, gmRollSoon, launch, move, advanced, disabledInEdit, criticalSuccess, criticalFail.

---

## Décisions Dice Rework — arrêtées

| Décision | Détail |
|---|---|
| Modifications serveur | **Zéro** — `seed` déjà dans payload DICE_RESULT |
| `rollId` | `timestamp` suffit comme identifiant unique — déjà dans payload |
| Jets normaux `/r` | Animation déclenchée ✅ |
| Jets d'entité `/sc` | **Pas d'animation par défaut** — flag `-a` dans la commande pour l'activer |
| Commande `/sc` future | `/sc [compétence] +/-modificateur -a (animation)` |
| D100 | Deux dés dans deux lanes — même système que 2 dés simultanés |
| Audio | Phase 2 |
| Architecture | DiceOverlay.jsx + DiceMesh.jsx + diceMath.js (3 fichiers client) |
| Couplage | DiceOverlay écoute DICE_RESULT via prop depuis SessionPage — canal visuel parallèle au chat |
| Isolation | Si DiceOverlay plante → jeu continue, chat inchangé |

**Point ouvert : `/sc` avec flag `-a`**
La commande `/sc` n'existe pas encore — c'est un chantier futur.
Pour le Dice Rework actuel : jets normaux uniquement → `skillLabel === undefined` dans DICE_RESULT.
Jets d'entité → `skillLabel` défini → pas d'animation (filtrage dans DiceOverlay).
Le flag `-a` sera implémenté quand `/sc` sera codé.

---

## Fichier manquant critique

**`server/src/lib/diceParser.js`** — non uploadé.
Nécessaire pour connaître exactement ce que retourne `parseDice` :
- Structure de `rolls` pour multi-dés (ex: `3d6` → `rolls = [2,4,5]` ?)
- Structure pour `d100` → `rolls = [70]` ou `[7, 0]` ?
- `dieType` retourné pour chaque formule
- `seed` : integer ou string ?

Sans ce fichier, `diceMath.js` ne peut pas être planifié correctement.

### diceParser.js ✅ lu (server/src/lib/diceParser.js)

**Ce que retourne `parseDice` :**
- `rolls` : tableau d'entiers, un par dé — ex: `3d6` → `[2, 4, 5]`
- `total` : somme + modificateur
- `formula` : normalisée — ex: `"3d6"`, `"d20"`, `"2d6+3"`
- `dieType` : `"d6"`, `"d20"`, `"d100"` — basé sur `faces` uniquement
- `seed` : XOR de tous les rolls — **entier simple**

**Points critiques pour diceMath.js :**

**D100 : `rolls = [47]` — UN seul entier.**
`d100` → `count=1`, `faces=100`, `rolls = [randomInt(1, 101)]`.
Pas de décomposition dizaines/unités côté serveur.
→ Côté client, DiceOverlay reçoit `rolls=[47]`, `dieType='d100'`.
→ diceMath.js devra décomposer : dizaines = `Math.floor(47/10)*10` → D10 "40", unités = `47%10` → D10 "7".
→ Deux DiceMesh dans deux lanes, chacun avec sa face cible.

**Seed : XOR des rolls — entier pouvant être 0.**
Si un seul dé → seed = ce dé (XOR avec 0 = lui-même).
Si plusieurs dés → XOR de tous. Peut être 0 si rolls s'annulent (ex: [3,3] → 0).
→ Fallback `seed || Date.now()` dans diceMath.js si seed === 0.

**Regex : supporte uniquement `NdX+M` — pas `2d6+1d4`.**
→ Jamais de formules mixtes. Chaque jet = un seul type de dé. Simplifie diceMath.js.

**Modificateur : inclus dans `total` mais PAS dans `rolls`.**
→ L'animation montre les dés bruts (rolls), le total inclut le modificateur.
→ DiceMesh affiche le roll brut, pas le total.

---

## Plan Dice Rework — COMPLET

### Fichiers à créer (3)
| Fichier | Rôle |
|---|---|
| `client/src/lib/diceMath.js` | PRNG, rotations cibles, décomposition D100, génération trajectoire |
| `client/src/components/DiceMesh.jsx` | Géométrie + animation useFrame R3F |
| `client/src/components/DiceOverlay.jsx` | Canvas R3F, orchestration lanes, clic pour fermer |

### Fichiers à modifier (2)
| Fichier | Modification |
|---|---|
| `client/src/pages/SessionPage.jsx` | State `lastDiceRoll` — mis à jour au DICE_RESULT sans skillLabel, passé à DiceOverlay |
| `client/src/locales/fr/translation.json` | Clé `dice.clickToClose` |

### Zéro modification serveur ✅

### Flux complet
```
DICE_ROLL émis → serveur calcule → DICE_RESULT broadcast
SessionPage : si !skillLabel → setLastDiceRoll(payload)
DiceOverlay reçoit lastDiceRoll → monte Canvas R3F
  → diceMath.js : décompose rolls en dés → calcule lanes → rotations cibles
  → DiceMesh × N : animation SLERP + bruit PRNG 600-900ms
  → figé sur résultat final → clic n'importe où → démonté
```

### Filtrage jets d'entité
`if (payload.skillLabel !== undefined) return` — pas de setLastDiceRoll.
Jets `/r` normaux : `skillLabel` absent du payload → animation déclenchée.

### D100 côté client
`rolls=[47]`, `dieType='d100'` → diceMath décompose en 2 dés :
- Lane 0 : D10 dizaines, face cible = `Math.floor(47/10)` (affiché "40")
- Lane 1 : D10 unités, face cible = `47 % 10` (affiché "7")

### Cas limite : N > 6 dés
La spec dit max 6 dés simultanés. `parseDice` accepte jusqu'à 100.
Guard dans DiceOverlay : `const diceToShow = rolls.slice(0, 6)` — les premiers 6 seulement.
D100 compte pour 2.

### seed fallback
`const effectiveSeed = seed || timestamp` — jamais 0.

### Canvas3D.jsx ✅ lu (client/src/components/Canvas3D.jsx)

**Structure :**
- Export default `Canvas3D` (l.640) — wrapper avec `<Canvas>` R3F
- Composant interne `Scene` (l.220) — reçoit tout en props depuis Canvas3D
- `<Canvas>` contient uniquement `{blocksReady && <Scene .../>}` (l.790-810)

**Props actuelles Canvas3D :**
`{ onTokenDoubleClick, socket, onEntityClick, onTokenRotate, moveTarget, onMoveCancel }`

**Props actuelles Scene :**
`{ voxels, setVoxels, textureMaterials, entityTextureMaterials, socket, battlemapId,
  selectedTokenId, onTokenSelect, onTokenDoubleClick, justSelectedRef,
  altPressed, onEntityClick, onTokenRotate, moveTarget, onMoveCancel, moveLabels }`

**Point d'insertion DiceRoller :**
Dans le JSX de `Scene` (l.545-631), après le ghost mode visée (l.599-610) et avant les tokens (l.612).
Ou en dernier enfant du fragment `<>...</>` — hors de la scène voxels/entités/tokens.

**Modification minimale requise :**
1. Canvas3D reçoit 2 nouvelles props : `dicePayload` + `onDiceDone`
2. Canvas3D les passe à Scene
3. Scene les passe à `<DiceRoller>` conditionnel
4. Import `DiceRoller` en tête de Canvas3D.jsx

**Ordre déclaration — P4 :**
`DiceRoller` est un composant autonome sans dépendance aux callbacks de Scene.
Pas de risque d'ordre de déclaration.

**Risque régression : FAIBLE**
- Modification chirurgicale : 2 props + 1 import + 1 ligne JSX
- `blocksReady` gate inchangé
- Tous les handlers existants inchangés

---

## Plan technique final — Dice Rework

### Nouveaux fichiers
| Fichier | Contenu |
|---|---|
| `client/src/lib/diceMath.js` | PRNG LCG seedé, rotations cibles par type de dé, décomposition D100, calcul lanes |
| `client/src/components/DiceRoller.jsx` | Orchestrateur R3F interne au Canvas — reçoit payload, monte N DiceMesh |
| `client/src/components/DiceMesh.jsx` | Géométrie Three.js + animation useFrame SLERP + bruit PRNG |

### Fichiers modifiés
| Fichier | Modification |
|---|---|
| `client/src/components/Canvas3D.jsx` | +2 props (dicePayload, onDiceDone) + import DiceRoller + 1 ligne JSX dans Scene |
| `client/src/pages/SessionPage.jsx` | +1 state lastDiceRoll + setLastDiceRoll dans handler DICE_RESULT + props à Canvas3D |
| `client/src/locales/fr/translation.json` | Aucune clé nécessaire pour V1 (pas de texte dans l'overlay) |

### Zéro modification serveur ✅

### Architecture DiceRoller dans la scène
```
Canvas3D (export default)
  └── <Canvas>
        └── <Scene> ← reçoit dicePayload + onDiceDone
              ├── voxels, entités, tokens (inchangés)
              └── {dicePayload && <DiceRoller payload={dicePayload} onDone={onDiceDone} />}
```

### DiceRoller
- Reçoit `{ rolls, dieType, seed, timestamp }`
- Décompose D100 : `rolls=[47]` → 2 dés (dizaines + unités)
- Calcule N lanes (max 6 dés)
- Monte N `<DiceMesh>` avec position dans la lane
- Écoute clic sur un plan invisible `<mesh>` plein écran → appelle `onDone()`

### DiceMesh
- Géométries natives Three.js : D4=Tetrahedron, D6=Box, D8=Octahedron, D10/D100=Cone(10), D12=Dodecahedron, D20=Icosahedron
- Position : flottante devant la caméra (indépendante de la scène)
- Animation useFrame : phase bounce (0-400ms) + phase align (400-700ms) + phase wobble (700-900ms)
- Rotation finale déterministe : `getRotationForFace(dieType, faceValue)` depuis diceMath.js
- PRNG LCG seedé pour le bruit chaotique

### diceMath.js
- `lcgRand(seed)` → PRNG déterministe
- `getRotationForFace(dieType, faceValue)` → Quaternion Three.js (rotation cible)
- `decomposeDice(rolls, dieType)` → tableau de `{ dieType, faceValue }` (gère D100)
- `calcLanes(nDice, sceneWidth)` → positions X des lanes

### Filtrage jets d'entité
Dans SessionPage handler DICE_RESULT :
`if (skillLabel !== undefined) return` avant `setLastDiceRoll`
Jets normaux : skillLabel absent → animation déclenchée ✅

---

## Décision getRotationForFace — V1 vs V2

**V1 (cette session) :**
- Rotation finale = rotation pseudo-aléatoire basée sur seed — visuellement convaincante
- Résultat affiché en texte overlay par-dessus le dé (grand, lisible)
- La face du haut n'est PAS nécessairement la face "résultat" dans la géométrie
- Acceptable : l'animation est spectaculaire, le résultat est clair

**V2 (session future) :**
- `getRotationForFace(dieType, faceValue)` → quaternion exact
- Nécessite mapping précis normale→valeur pour chaque géométrie Three.js
- Approche : scène de test qui affiche les indices de face sur la géométrie réelle
- Ne pas coder de mémoire — risque d'erreur silencieuse

**Impact sur V1 :**
- `diceMath.js` : pas de `getRotationForFace` — rotation finale = `lcgRand(seed)` × 2π sur les 3 axes
- `DiceMesh.jsx` : overlay `<Html>` avec le résultat en grand (drei Html)
- Plan inchangé pour le reste

---

## Dice Rework — État après premiers tests

### Ce qui fonctionne ✅
- Animation déclenchée au bon moment (jets normaux uniquement)
- Durée 1.8-2.5s acceptable pour V1
- D10 : forme bipyramide pentagonale correcte, arêtes visibles
- D12 : flatShading + rotateX corrigé
- Clic pour fermer fonctionnel

### Ce qui ne fonctionne pas ❌
- **D10 : point blanc brillant** — la `pointLight` dans DiceMesh crée un spéculaire excessif sur la géométrie custom. Cause : `metalness: 0.65` + pointLight proche → highlight spéculaire concentré.
- **Dés n'arborent pas la couleur du lanceur** — non implémenté. `color` du joueur est dans le payload DICE_RESULT (`color` field). À implémenter.
- **Improvisation excessive** — plusieurs corrections successives sans plan solide. Violation du protocole.

### Problèmes de fond identifiés
1. **pointLight par dé** : mauvaise décision d'architecture. Une pointLight par dé = N sources lumineuses = interactions complexes + highlights imprévisibles. Les pros utilisent des lumières de scène globales, pas par objet.
2. **Couleur lanceur** : oublié lors de la planification — `color` est dans DICE_RESULT payload (confirmé dans socket/index.js). Doit être passé à DiceMesh via DiceRoller.
3. **Face visible V1** : décision documentée — rotation pseudo-aléatoire + chiffre en overlay. Pas d'improvisation sur ce point.

### Dettes techniques Dice Rework
- Retirer `pointLight` par dé — remplacer par lumières de scène dans DiceRoller
- Implémenter couleur lanceur (`color` payload → matériau MeshStandardMaterial)
- Vérifier que `color` est bien dans le payload transmis à DiceRoller via SessionPage

### Décisions à prendre avant de recoder
- Éclairage : quelle stratégie ? (lumières de scène dans DiceRoller, pas par dé)
- `metalness` : trop élevé → highlights excessifs. Réduire ou passer à MeshLambertMaterial (pas de spéculaire) ?
- Couleur lanceur : teinte de base du matériau ou couleur unie ?

### Fichiers Dice Rework actuellement en place
| Fichier | État |
|---|---|
| `client/src/lib/diceMath.js` | ✅ stable |
| `client/src/components/DiceMesh.jsx` | ⚠️ pointLight à corriger, couleur à implémenter |
| `client/src/components/DiceRoller.jsx` | ⚠️ couleur à passer en prop |
| `client/src/components/Canvas3D.jsx` | ✅ stable |
| `client/src/pages/SessionPage.jsx` | ⚠️ `color` à inclure dans lastDiceRoll |


---

## Données géométriques vérifiées — normales par face (Three.js r128)

### Méthode
Inspection via Node.js + three@latest. Valeurs exactes, pas de mémoire.
Quaternion cible = `setFromUnitVectors(faceNormal, camDir.negate())`

### D6 — BoxGeometry — normales par groupe
| Group | Normale | Valeur dé |
|---|---|---|
| 0 | (+1, 0, 0) | 5 |
| 1 | (-1, 0, 0) | 2 |
| 2 | (0, +1, 0) | 1 |
| 3 | (0, -1, 0) | 6 |
| 4 | (0, 0, +1) | 3 |
| 5 | (0, 0, -1) | 4 |
Convention dé physique : opposées = 7 ✅

### D4 — TetrahedronGeometry — 4 faces non-indexées
| Face | Normale |
|---|---|
| 0 | (-0.577, +0.577, +0.577) |
| 1 | (+0.577, +0.577, -0.577) |
| 2 | (+0.577, -0.577, +0.577) |
| 3 | (-0.577, -0.577, -0.577) |
Valeurs 1-4 à assigner — convention D4 : face du bas = valeur haute (sommet opposé).

### D8 — OctahedronGeometry — 8 faces non-indexées
| Face | Normale |
|---|---|
| 0 | (+0.577, +0.577, +0.577) |
| 1 | (+0.577, -0.577, +0.577) |
| 2 | (+0.577, -0.577, -0.577) |
| 3 | (+0.577, +0.577, -0.577) |
| 4 | (-0.577, +0.577, -0.577) |
| 5 | (-0.577, -0.577, -0.577) |
| 6 | (-0.577, -0.577, +0.577) |
| 7 | (-0.577, +0.577, +0.577) |
Valeurs 1-8 à assigner — opposées = 9.

### D12 — DodecahedronGeometry — 36 faces (12 pentagones × 3 triangles)
Faces 0-2 = pentagone 0, faces 3-5 = pentagone 1, etc.
Normales uniques par pentagone (3 triangles identiques) :
| Pentagone | Normale | Faces |
|---|---|---|
| 0 | (0, +0.851, +0.526) | 0-2 |
| 1 | (+0.851, +0.526, 0) | 3-5 |
| 2 | (+0.526, 0, -0.851) | 6-8 |
| 3 | (-0.526, 0, -0.851) | 9-11 |
| 4 | (-0.851, -0.526, 0) | 12-14 |
| 5 | (0, +0.851, -0.526) | 15-17 |
| 6 | (-0.851, +0.526, 0) | 18-20 |
| 7 | (-0.526, 0, +0.851) | 21-23 |
| 8+ | à compléter si nécessaire | ... |
Valeurs 1-12 à assigner — opposées = 13.

### D20 — IcosahedronGeometry — 20 faces non-indexées
| Face | Normale |
|---|---|
| 0 | (-0.577, +0.577, +0.577) |
| 1 | (0, +0.934, +0.357) |
| 2 | (0, +0.934, -0.357) |
| 3 | (-0.577, +0.577, -0.577) |
| 4 | (-0.934, +0.357, 0) |
| 5 | (+0.577, +0.577, +0.577) |
| 6 | (-0.357, 0, +0.934) |
| 7 | (-0.934, -0.357, 0) |
| 8 | (-0.357, 0, -0.934) |
| 9 | (+0.577, +0.577, -0.577) |
| 10 | (+0.577, -0.577, +0.577) |
| 11 | (0, -0.934, +0.357) |
| 12 | (0, -0.934, -0.357) |
| 13 | (+0.577, -0.577, -0.577) |
| 14 | (+0.934, -0.357, 0) |
| 15 | (+0.357, 0, +0.934) |
| 16 | (-0.577, -0.577, +0.577) |
| 17 | (-0.577, -0.577, -0.577) |
| 18 | (+0.357, 0, -0.934) |
| 19 | (+0.934, +0.357, 0) |
Valeurs 1-20 à assigner — opposées = 21.

### D10 — bipyramide custom — normales calculées dans createPentagonalBipyramid
Construite à la main → normales connues exactement via addFace().
10 faces — valeurs 0-9 à assigner.

---

## Plan D6 — getRotationForFace

### Approche
1. `diceMath.js` : ajouter `D6_FACE_NORMALS` + `getRotationForFace('d6', value)` → `THREE.Quaternion`
2. `DiceMesh.jsx` : remplacer `getFinalRotation(seed)` par `getRotationForFace(dieType, faceValue)` pour la rotation cible
3. Tester D6 uniquement — valider que la bonne face pointe vers la caméra
4. Puis D20, D8, D4, D12, D10 dans l'ordre

### Quaternion cible
```js
const faceNormal = new THREE.Vector3(...D6_FACE_NORMALS[faceValue])
const camDir = camera.getWorldDirection(new THREE.Vector3())
const target = camDir.clone().negate()  // vers la caméra
const q = new THREE.Quaternion().setFromUnitVectors(faceNormal, target)
```

### Problème : diceMath.js est une lib pure — pas d'import THREE
`getRotationForFace` retourne le vecteur normal (pure), le quaternion est calculé dans DiceMesh où THREE est disponible.


---

## Dice Rework — D6 ✅ COMPLET ET VALIDÉ

### Ce qui est stable
- Face correcte orientée vers la caméra (setFromUnitVectors) ✅
- Chiffre sur la face (CanvasTexture 128×128 par face) ✅
- Couleur du lanceur sur le dé (prop color → matériau + texture) ✅
- Mapping D6 vérifié par inspection Node.js : [5, 2, 1, 6, 3, 4] ✅
- flatShading, metalness:0, pas de pointLight ✅

### Architecture stable (ne plus toucher)
- `diceMath.js` : createLCG, decomposeDice, calcLanePositions, getFinalRotation, getFaceNormal, makeNoiseFunc, getAnimDuration, PHASES, easing
- `DiceRoller.jsx` : orchestrateur, plan invisible cliquable, ambientLight, passage color
- `DiceMesh.jsx` : makeDigitTexture(value, color), D6_MATERIAL_VALUES, createPentagonalBipyramid, slerp quaternion, Html conditionnel
- `Canvas3D.jsx` : dicePayload + onDiceDone passés à Scene → DiceRoller
- `SessionPage.jsx` : lastDiceRoll state avec color, filtrage skillLabel

### Normales vérifiées Node.js — à compléter
| Dé | Statut | Mapping faces |
|---|---|---|
| D6 | ✅ complet | [5,2,1,6,3,4] vérifié |
| D20 | 🔲 normales connues, mapping à assigner | 20 faces icosaèdre |
| D8 | 🔲 normales connues, mapping à assigner | 8 faces octaèdre |
| D4 | 🔲 normales connues, mapping à assigner | 4 faces tétraèdre |
| D12 | 🔲 normales connues (partielles), mapping à assigner | 12 pentagones |
| D10/D100 | 🔲 géométrie custom, normales calculées dans addFace | bipyramide |


---

## Dice Rework — D4 ✅ COMPLET ET VALIDÉ

### Ce qui est stable
- Face correcte orientée vers la caméra (setFromUnitVectors + negate) ✅
- Chiffre sur la face (CanvasTexture, UVs remplacés, centrage parfait) ✅
- Couleur du lanceur ✅
- Taille police : `size * 0.225` ✅
- 4 groupes ajoutés à TetrahedronGeometry pour material array ✅

### Données techniques D4 (vérifiées Node.js)
- Normales stables entre instances ✅
- D4_FACE_VALUES = [4, 3, 2, 1] (faces 0-3)
- D4_FACE_NORMALS_LIST = [[-0.5774,0.5774,0.5774], [0.5774,0.5774,-0.5774], [0.5774,-0.5774,0.5774], [-0.5774,-0.5774,-0.5774]]
- UVs custom : triangle centré (0.5,0.90), (0.10,0.27), (0.90,0.27) — centroïde ≈ (0.5,0.49)
- Orientation chiffre sur face : aléatoire — acceptable V1

### État dés Dice Rework
| Dé | Face vers caméra | Chiffre sur face | Couleur lanceur | Statut |
|---|---|---|---|---|
| D6 | ✅ | ✅ | ✅ | ✅ complet |
| D4 | ✅ | ✅ | ✅ | ✅ complet |
| D8 | 🔲 | 🔲 | ✅ (hérité) | prochain |
| D12 | 🔲 | 🔲 | ✅ (hérité) | — |
| D20 | 🔲 | 🔲 | ✅ (hérité) | — |
| D10/D100 | 🔲 | 🔲 | ✅ (hérité) | — |

### Données pré-calculées disponibles pour les prochains dés
- D8  mapping vérifié : [8,3,4,7,6,1,2,5] (faces 0-7, opposées=9)
- D20 mapping vérifié : [18,20,19,17,14,16,12,8,11,15,4,2,1,3,7,10,6,5,9,13] (faces 0-19, opposées=21)
- D12 mapping post-rotateX(PI/5) vérifié : [7,9,11,10,4,12,8,2,6,3,5,1] (pentagones 0-11, opposées=13)
- Tous vérifiés mathématiquement (toutes paires = N+1) ✅

### Architecture DiceMesh — pattern établi pour chaque dé
1. `diceMath.js` : ajouter données (normales + valeurs) — exportées
2. `DiceMesh.jsx` géométrie : ajouter `addGroup` si non-indexée + UVs custom si nécessaire
3. `DiceMesh.jsx` material : ajouter cas dans `useMemo` → array de matériaux
4. `DiceMesh.jsx` JSX : exclure du Html overlay
5. Tester visuellement — ajuster UVs si centrage incorrect

---

## Dice Rework — D8 ✅ COMPLET ET VALIDÉ

### Données techniques D8 (vérifiées Node.js)
- D8_FACE_VALUES = [8,3,4,7,6,1,2,5] (opposées=9, vérifiées) ✅
- D8_FACE_NORMALS_LIST : 8 normales ±0.5774 vérifiées ✅
- UVs custom : même triangle que D4 — centrage confirmé ✅
- Pattern quaternion : même que D4 (indexOf + negate) ✅

### État dés
| Dé | Statut |
|---|---|
| D6 | ✅ complet |
| D4 | ✅ complet |
| D8 | ✅ complet |
| D20 | prochain |
| D12 | — |
| D10/D100 | — |

---

## D10 — Diagnostic géométrie — ERREUR FONDAMENTALE CONFIRMÉE

### Problème
`createPentagonalBipyramid` = mauvaise forme.
- Bipyramide pentagonale = 10 faces TRIANGULAIRES — 2 pyramides collées
- D10 réel = pentagonal TRAPEZOHEDRON = 10 faces KITE (quadrilatères) = 20 triangles

### Architecture correcte (source : Anton Natarov / Michael Wulf, domaine public)
- 12 vertices : 2 pôles (nord/sud) + 10 vertices équatoriaux alternés haut/bas
- 10 vertices équatoriaux = cercle, angle 2πk/5, hauteur alternée +h/-h, décalage π/5 entre les deux couronnes
- 20 triangles (2 par face kite)
- Utiliser `PolyhedronGeometry(vertices, faces, radius, 0)` — pas de BufferGeometry custom

### Plan de correction
1. Remplacer `createPentagonalBipyramid` par `createD10Geometry()` via `PolyhedronGeometry`
2. Vertices : pôle_nord(0,h_pole,0), pôle_sud(0,-h_pole,0), 10 vertices équatoriaux alternés
3. Faces : 20 triangles définissant les 10 kites
4. UVs : `PolyhedronGeometry` génère des UVs sphériques — à remplacer par UVs custom centrés (même approche D4/D8)
5. `addGroup(i*6, 6, i)` × 10 (2 triangles × 3 vertices par kite = 6 vertices par face)

### DIE_GEOMETRY type
`d10` / `d10_tens` / `d10_units` → type `'d10_trapezohedron'` (renommer pour clarté)

---

## Dice Rework — État complet après session intensive

### Dés validés ✅
| Dé | Face vers caméra | Chiffre sur face | Couleur | Police | Statut |
|---|---|---|---|---|---|
| D6 | ✅ | ✅ | ✅ | 0.5 | ✅ stable |
| D4 | ✅ | ✅ | ✅ | 0.4 | ✅ stable |
| D8 | ✅ | ✅ | ✅ | 0.4 | ✅ stable |
| D20 | ✅ | ✅ | ✅ | 0.3 | ✅ stable |
| D12 | ✅ | ✅ (atlas) | ✅ | 0.4 | ✅ stable |
| D10/D100 | ✅ géométrie | ❌ UV centrage | ✅ | 0.45 | 🔲 en cours |

### D10 — Problème UV persistant
- Géométrie correcte : pentagonal trapezohedron ✅
- Approche atlas 10 cases ✅
- UVs par projection planaire calculés Node.js ✅
- Centroïde barycentrique calculé : (0.5, 0.397) ✅
- Résultat visuel : chiffres toujours mal centrés/illisibles ❌
- Tâtonnements successifs — protocole non respecté

### Fichiers modifiés session 44 (état actuel)
| Fichier | État |
|---|---|
| `client/src/lib/diceMath.js` | Mappings D4/D8/D20/D12/D10 |
| `client/src/components/DiceMesh.jsx` | Tous dés sauf D10 UV |
| `client/src/components/DiceRoller.jsx` | Stable |
| `client/src/components/Canvas3D.jsx` | Stable |
| `client/src/pages/SessionPage.jsx` | Stable |
| `client/src/stores/characterStore.js` | Bug A corrigé |

### Dettes session 44
- D10 UV centrage à résoudre proprement
- `.gitattributes:3` attribut invalide (dette ancienne)
- Logs [DBG] index.js — conservés volontairement

---

## Dice Rework — VALIDÉ SESSION 44 ✅

### État final tous dés
| Dé | Géométrie | Face vers caméra | Chiffre | Couleur | Police | Statut |
|---|---|---|---|---|---|---|
| D6 | BoxGeometry | ✅ | Texture par face | ✅ | 0.5 | ✅ |
| D4 | TetrahedronGeometry | ✅ | Texture par face | ✅ | 0.4 | ✅ |
| D8 | OctahedronGeometry | ✅ | Texture par face | ✅ | 0.4 | ✅ |
| D20 | IcosahedronGeometry | ✅ | Texture par face | ✅ | 0.3 | ✅ |
| D12 | DodecahedronGeometry | ✅ | Atlas 12 cases | ✅ | 0.4 | ✅ |
| D10/D100 | Trapezohedron custom | ✅ | Html overlay (V1) | ✅ | 30px | ✅ |

### D10 — décision V1/V2
- V1 : Html overlay centré `position=[0,0,0]` — lisible, acceptable
- V2 : modèle Blender (.glb) avec UVs pré-calculés par face
- Raison technique : UV mapping d'un kite en code pur = problème de projection géométrique non trivial que les pros résolvent avec des outils 3D (Blender), pas avec des équations

### Architecture Dice Rework finale
- `client/src/lib/diceMath.js` — PRNG, mappings, normales tous dés
- `client/src/components/DiceMesh.jsx` — géométries, matériaux, animation, Html
- `client/src/components/DiceRoller.jsx` — orchestrateur, plan cliquable
- `client/src/components/Canvas3D.jsx` — +2 props dicePayload/onDiceDone
- `client/src/pages/SessionPage.jsx` — state lastDiceRoll, filtrage skillLabel

### Session 44 — bilan complet
| Chantier | Statut |
|---|---|
| EntityEditorOLD.jsx supprimé | ✅ |
| Bug A — toggle visible character temps réel | ✅ |
| Dice Rework — animation + face + chiffre + couleur | ✅ |
| D10 UV texturing | V2 (Blender) |

