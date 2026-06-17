# ARCHI_REWORK.md — Reworks architecturaux
> Créé Session 96 — 2026-06-16 | Mis à jour Session 100b — 2026-06-17
> Rédigé par Claude Sonnet 4.6 à destination des agents Claude futurs.
> Objectif : remplacer le bricolage incrémental par des reworks structurés, complets, et non régressifs.

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

## REWORK-01 — Status Service (étourdissement)

### Problème

`resolveShockBlock` dans `server/src/socket/index.js` (~ligne 3130) fait trois choses simultanément :
1. Test de choc D20 (calcul mécanique pur)
2. Lancer le D6 durée (résolution aléatoire)
3. Écriture en base + broadcast WS (effets de bord)

**Couplage accidentel :** il est appelé en séquence bloquante AVANT l'émission de `COMBAT_DAMAGE_RESULT` (appel ligne ~2484, émission résultat ligne ~2495). Toute exception dans ce bloc empêche le joueur de voir ses propres dégâts — fenêtre bloquée en "Calcul en cours...".

**Duplication :** 5 call sites identiques dans le même fichier.

**Absence de logique PJ/PNJ :** le D6 durée est toujours résolu côté serveur, même quand la cible est un PJ connecté dont le joueur devrait lancer lui-même le dé (règle Polaris).

**Call sites exacts de resolveShockBlock — à vérifier par grep avant de coder :**
```
grep -n "resolveShockBlock" server/src/socket/index.js
```
Attendu : 5 lignes (~2484, ~2745, ~3600, ~4032, ~4382) + la définition (~3130)

### État actuel

**Fonctions dans `server/src/socket/index.js` :**
- `emitTokenStatusUpdated(io, campaignId, tokenId)` (~ligne 3102) — query token_statuses + broadcast TOKEN_STATUS_UPDATED
- `applyStunWithDuration(io, campaignId, tokenId, outcome, stunDuration, currentTurn)` (~ligne 3112) — INSERT/MERGE token_statuses + appel emitTokenStatusUpdated
- `resolveShockBlock(io, campaignId, { finalSeverity, localisation, is_lethal, for_na, con_na, vol_na, targetTokenId, userId, username, color })` (~ligne 3130) — le bloc problématique à supprimer

**Fonctions utilitaires pures utilisées par resolveShockBlock (à réutiliser dans le service) :**
- `isShockTestRequired(severity, location)` → `boolean` — dans `server/src/lib/woundUtils.js` ligne 4
- `calcSeuils(for_na, con_na, vol_na)` → `{ etourdissement, inconscience }` — dans `server/src/lib/charStats.js` ligne 238
- `getShockMalus(severity, location, is_lethal)` → `number` — dans `server/src/lib/charStats.js` ligne 400

**Événements WS dans `shared/events.js` (état post-revert session 95-5b) :**
- `COMBAT_STUN_EXPIRED` (ligne 109) — existe déjà
- `COMBAT_STUN_PROMPT` — absent, à créer
- `COMBAT_STUN_CONFIRM` — absent, à créer

**Maps globales dans `server/src/socket/index.js` (~ligne 45-47) :**
```js
const pendingEntityActions = new Map()
const pendingDamageActions = new Map()
const pendingMeleeDefense  = new Map()
// pendingStunActions absent — à ajouter
```

### Décision architecturale

**Option retenue : Service Module**

Nouveau fichier `server/src/lib/statusService.js` encapsulant toute la logique stun. Les callers appellent une fonction simple — ils ne savent pas si la cible est PJ ou PNJ, ils ne lancent pas de dés, ils n'écrivent pas en base.

**Options écartées :**
- Bus d'événements interne : sur-ingénierie — un seul système réagit au shock pour l'instant. Pertinent quand N systèmes indépendants réagiront au même événement.
- State machine complète : hors scope — nécessite réécriture du combat entier.

### Interface cible du module

```js
// server/src/lib/statusService.js

// Résolution pure du test de choc D20.
// Lance le D20, calcule l'outcome. Aucune query DB. Aucun broadcast.
// Retourne null si le test n'est pas requis pour cette blessure.
export async function resolveShockTest({
  finalSeverity,   // string : 'legere'|'moyenne'|'grave'|'critique'|'mortelle'
  localisation,    // string : slot ('T','C','BD','BG','JD','JG')
  is_lethal,       // boolean
  for_na,          // number
  con_na,          // number
  vol_na,          // number
})
// → null si pas de test requis
// → { triggered: true, outcome: 'ok'|'etourdi'|'inconscient', roll: number,
//     shockMalus: number, seuilEtourdi: number, seuilIncons: number }

// Application complète du stun après outcome ≠ 'ok'.
// Gère PJ (prompt interactif via WS) et PNJ (D6 auto).
// Pour PJ offline → fallback automatique identique à PNJ.
export async function applyStun(io, db, campaignId, pendingStunActions, {
  targetTokenId,   // string UUID
  outcome,         // 'etourdi' | 'inconscient'
  userId,          // string : identité broadcaster pour DICE_RESULT
  username,        // string
  color,           // string hex
})
// → void (tous les effets passent par io et db)
```

**Usage dans chaque call site (remplace l'appel à resolveShockBlock) :**
```js
// AVANT (à supprimer) :
shockResult = await resolveShockBlock(io, campaignId, { ... }) ?? null

// APRÈS :
const shockTestResult = await resolveShockTest({ finalSeverity, localisation, is_lethal, for_na, con_na, vol_na })
shockResult = shockTestResult   // passé dans COMBAT_DAMAGE_RESULT / COMBAT_ATTACK_RESULT tel quel
if (shockTestResult?.outcome && shockTestResult.outcome !== 'ok') {
  await applyStun(io, db, campaignId, pendingStunActions, {
    targetTokenId, outcome: shockTestResult.outcome, userId, username, color,
  })
}
```

**Important :** `shockResult` retourné par `resolveShockTest` remplace l'ancien retour de `resolveShockBlock`. Vérifier que les payloads `COMBAT_DAMAGE_RESULT` et `COMBAT_ATTACK_RESULT` restent compatibles (champs : `triggered`, `roll`, `outcome`, `shockMalus`, `seuilEtourdi`, `seuilIncons`). Les champs `stun_applied`, `stun_duration`, `stunned_until_turn` disparaissent de shockResult — ils sont désormais gérés en interne par `applyStun`.

### Types d'entité supportés

| Type | Stun | Source |
|---|---|---|
| Humanoïde (PJ + PNJ) | ✅ | MANUELSYSCOMBAT §5 |
| Drone | ❌ N/A — jamais appelé | MANUELSYSCOMBAT §7.6 |
| Exo-armure | 🔜 futur | — |

### V1 / V2 — shock_auto_stun (migration 69 existante)

`campaigns.shock_auto_stun BOOLEAN DEFAULT true` — déjà en base.

| Valeur | Comportement `applyStun` |
|---|---|
| `false` | GM gère TOUS les D6 — PJ et PNJ reçoivent le prompt via `gmSocket` (aucun joueur ne lance) |
| `true` (défaut) | PJ → fenêtre interactive (`pjSocket`) / PNJ → auto D6 serveur (aucune fenêtre GM) |

**⚠ Implémentation actuelle (Session 96) — PARTIELLE :**
- `false` + PNJ → GM reçoit le prompt ✅
- `false` + PJ → **BUG SHK5** — PJ reçoit la fenêtre à tort (devrait aller au GM). Sprint futur.
- `true` + PJ → fenêtre interactive PJ ✅
- `true` + PNJ → auto D6 serveur ✅

**Détection socket :** PJ → `io.in(campaignId).fetchSockets()` → `s.data.userId === character.user_id` / GM → `s.data.role === 'gm'`

### Logique interne de applyStun

```
1. Charger les données de la cible :
   db('tokens').where({ id: targetTokenId })
     .join('characters', 'characters.id', 'tokens.character_id')
     .select('characters.type', 'characters.user_id')
     .first()
   → isPJ = character?.type === 'pj'

2. Charger le tour courant :
   db('combat_state').where({ campaign_id: campaignId }).select('current_turn').first()

3a. Si PNJ (ou character null — entité décor) :
    parseDice('1d6') → d6Raw
    stunDuration = outcome === 'inconscient' ? d6Raw * 10 : d6Raw
    io.to(campaignId).emit(WS.DICE_RESULT, { ...payload D6... })
    applyStunWithDuration(io, db, campaignId, targetTokenId, outcome, stunDuration, currentTurn)

3b. Si PJ :
    Chercher le socket connecté :
      const sockets = await io.fetchSockets()
      const pjSocket = sockets.find(s => s.user?.id === character.user_id && s.data?.campaignId === campaignId)
    Si pjSocket trouvé :
      pendingStunActions.set(targetTokenId, {
        campaignId, targetTokenId, outcome,
        targetUserId: character.user_id,
        userId, username, color,
        currentTurn,
      })
      pjSocket.emit(WS.COMBAT_STUN_PROMPT, { tokenId: targetTokenId, outcome })
    Si pjSocket non trouvé (offline) :
      → fallback identique à 3a
```

### Handler COMBAT_STUN_CONFIRM (à ajouter dans initSocket)

```js
socket.on(WS.COMBAT_STUN_CONFIRM, async ({ tokenId }) => {
  const pending = pendingStunActions.get(tokenId)
  if (!pending) return
  if (pending.targetUserId !== socket.user.id) return
  pendingStunActions.delete(tokenId)

  const { total: d6Raw, rolls: d6Rolls, seed: d6Seed } = await parseDice('1d6')
  const stunDuration = pending.outcome === 'inconscient' ? d6Raw * 10 : d6Raw

  io.to(pending.campaignId).emit(WS.DICE_RESULT, {
    userId: pending.userId, username: pending.username, color: pending.color,
    formula: '1d6', rolls: d6Rolls, total: stunDuration,
    isCriticalSuccess: false, isCriticalFail: false,
    seed: d6Seed, timestamp: new Date().toISOString(),
    skillLabel: 'Durée étourdissement',
    mechanicalTotal: d6Raw,
    diffLabel: pending.outcome === 'inconscient' ? ' ×10 (min→tours)' : ' tour(s)',
    chancesDeReussite: stunDuration,
    isSuccess: true,
  })
  await applyStunWithDuration(io, db, pending.campaignId, tokenId, pending.outcome, stunDuration, pending.currentTurn)
})
```

### Séquençage résolu

```
AVANT (problématique) :
  COMBAT_DAMAGE_CONFIRM
    → resolveShockBlock (DB × 3 queries + D6 + broadcast)   ← bloquant
    → COMBAT_DAMAGE_RESULT                                   ← bloqué si erreur ci-dessus

APRÈS :
  COMBAT_DAMAGE_CONFIRM
    → resolveShockTest (pur : 1 parseDice, zéro DB)          ← ultra-rapide, sans risque
    → COMBAT_DAMAGE_RESULT                                    ← émis immédiatement
    → applyStun (async indépendant : PJ prompt ou PNJ auto)  ← si applyStun plante, les dégâts sont déjà affichés
```

### Composant client CombatStunWindow.jsx

Fichier `client/src/components/CombatStunWindow.jsx` — à créer.

**Interface minimale :**
- Badge coloré outcome (jaune = étourdi / `outcome === 'etourdi'`, rouge = inconscient)
- Bouton "Lancer 1D6" → `socket.emit(WS.COMBAT_STUN_CONFIRM, { tokenId: payload.tokenId })` → ferme la fenêtre immédiatement
- Le résultat D6 s'affiche dans la sidebar via DICE_RESULT (pas de deuxième écran dans cette fenêtre)
- CSS : suivre convention `combat-float-win` (voir `client/src/index.css` Section 11)
- Pas de `style={}` visuel — uniquement classes CSS système

**Montage dans SessionPage.jsx :**
```js
const [stunPayload, setStunPayload] = useState(null)
// dans useEffect socket :
s.on(WS.COMBAT_STUN_PROMPT, (data) => setStunPayload(data))
// dans cleanup :
s.off(WS.COMBAT_STUN_PROMPT)
// props vers CombatOverlay :
stunPayload={stunPayload}
onStunConfirmed={() => setStunPayload(null)}
```

**Render dans CombatOverlay.jsx :**
```jsx
{stunPayload && (
  <CombatStunWindow
    payload={stunPayload}
    socket={socket}
    onClose={() => onStunConfirmed()}
  />
)}
```

### Périmètre

**⚠ Note CombatOverlay.jsx :** `stunDialog` (ligne 23) et `stunDialogDuration` (ligne 24) existent déjà — c'est le dialog GM manuel (COMBAT_APPLY_STUN). Ne pas confondre avec `stunPayload` qui est le prompt PJ interactif. Ce sont deux mécanismes distincts.

**Fichiers modifiés — numéros de ligne exacts (vérifier par grep avant de coder) :**

| Fichier | Ligne | Changement |
|---|---|---|
| `shared/events.js` | après ligne 109 | +`COMBAT_STUN_PROMPT` et `COMBAT_STUN_CONFIRM` |
| `server/src/lib/statusService.js` | NOUVEAU | module complet |
| `server/src/socket/index.js` | ~47 | +`const pendingStunActions = new Map()` |
| `server/src/socket/index.js` | ~3102 | supprimer `emitTokenStatusUpdated` (migré) |
| `server/src/socket/index.js` | ~3110 | supprimer `applyStunWithDuration` (migré) |
| `server/src/socket/index.js` | ~3127 | supprimer `resolveShockBlock` (remplacé) |
| `server/src/socket/index.js` | ~2484, ~2745, ~3600, ~4032, ~4382 | 5 call sites — remplacer `resolveShockBlock` par `resolveShockTest` + `applyStun` |
| `server/src/socket/index.js` | après handler MELEE_DEFENSE_CONFIRM (~2563) | +handler `COMBAT_STUN_CONFIRM` |
| `client/src/components/CombatStunWindow.jsx` | NOUVEAU | composant PJ prompt D6 |
| `client/src/pages/SessionPage.jsx` | après ligne 118 | +`const [stunPayload, setStunPayload] = useState(null)` |
| `client/src/pages/SessionPage.jsx` | après ligne 530 | +`s.on(WS.COMBAT_STUN_PROMPT, (data) => setStunPayload(data))` |
| `client/src/pages/SessionPage.jsx` | après ligne 1328 | +`stunPayload={stunPayload}` et `onStunConfirmed={() => setStunPayload(null)}` |
| `client/src/components/CombatOverlay.jsx` | ligne 12 | +`import CombatStunWindow from './CombatStunWindow'` |
| `client/src/components/CombatOverlay.jsx` | ligne 19 (signature) | +`stunPayload, onStunConfirmed` dans les props |
| `client/src/components/CombatOverlay.jsx` | après ligne 242 | +render conditionnel `{stunPayload && <CombatStunWindow ... />}` |

**Fichiers NON touchés :**
- `server/src/lib/charStats.js` — `calcSeuils`, `getShockMalus` réutilisés tels quels
- `server/src/lib/woundUtils.js` — `isShockTestRequired` réutilisé tel quel
- `shared/woundConstants.js`, `shared/armorConstants.js` — inchangés
- Toute logique interne de `resolveAssaultAction`, `resolveMeleeAction`, `resolveDroneAssaultAction` — seul le call site `resolveShockBlock` est remplacé, rien d'autre

### Plan d'implémentation — ordre obligatoire

L'ordre est contraint par les dépendances. Ne pas l'inverser.

**Étape 1 — Lecture obligatoire avant tout code**
Lire dans cette session (pas depuis la mémoire) :
- `server/src/socket/index.js` : focus `resolveShockBlock` + `applyStunWithDuration` + `emitTokenStatusUpdated` + les 5 call sites (grep `resolveShockBlock`)
- `shared/events.js` : vérifier l'absence de `COMBAT_STUN_PROMPT`/`COMBAT_STUN_CONFIRM`
- `server/src/lib/charStats.js` : signatures exactes `calcSeuils` et `getShockMalus`
- `server/src/lib/woundUtils.js` : signature exacte `isShockTestRequired`

**Étape 2 — shared/events.js**
Ajouter après `COMBAT_STUN_EXPIRED` (ligne 109) :
```js
COMBAT_STUN_PROMPT:  'combat:stun_prompt',
COMBAT_STUN_CONFIRM: 'combat:stun_confirm',
```
Run à vide : vérifier que le fichier est syntaxiquement valide (pas de virgule manquante).

**Étape 3 — server/src/lib/statusService.js**
Créer le module complet :
- Imports : `parseDice` depuis `../lib/diceParser.js`, `isShockTestRequired` depuis `./woundUtils.js`, `calcSeuils`/`getShockMalus` depuis `./charStats.js`, `WS` depuis `../../../shared/events.js`
- Exports : `resolveShockTest`, `applyStun`, `applyStunWithDuration`, `emitTokenStatusUpdated`
- `applyStunWithDuration` et `emitTokenStatusUpdated` : copier depuis index.js, ajouter `db` en paramètre (était capturé par fermeture)
Run à vide : `node --check server/src/lib/statusService.js`

**Étape 4 — server/src/socket/index.js**
Dans l'ordre strict :
1. Ajouter import stunService (en haut du fichier avec les autres imports)
2. Ajouter `const pendingStunActions = new Map()` ligne ~48
3. Supprimer `emitTokenStatusUpdated` (migré dans stunService)
4. Supprimer `applyStunWithDuration` (migré dans stunService)
5. Supprimer `resolveShockBlock` (remplacé)
6. Mettre à jour les 5 call sites (grep pour ne pas en oublier)
7. Ajouter handler `COMBAT_STUN_CONFIRM` après `COMBAT_MELEE_DEFENSE_CONFIRM`
8. Vérifier que `COMBAT_APPLY_STUN` handler (GM manuel, ~ligne 2816) importe et utilise `applyStunWithDuration` depuis stunService
Run à vide : `node --check server/src/socket/index.js`

**Étape 5 — client/src/components/CombatStunWindow.jsx**
Créer le composant minimal.
Run à vide : vérifier syntaxe JSX.

**Étape 6 — client/src/pages/SessionPage.jsx**
Ajouter state + listener. Ne rien changer d'autre.
Run à vide : `npm run build` côté client (vérifier Vite 200).

**Étape 7 — client/src/components/CombatOverlay.jsx**
Ajouter import + props + render conditionnel.
Run à vide : `npm run build`.

**Étape 8 — SR (Serveur Redémarré)**
Démarrer avec `.\start.ps1`. Vérifier absence d'erreur dans les logs.

### Validation

**Scénario 1 — PNJ cible, shock requis**
Setup : assaut distance PJ → PNJ, infliger ≥ 10 dégâts nets (blessure moyenne ou pire)
Résultat attendu :
- Fenêtre GESTION DES DÉGÂTS s'affiche et se résout normalement pour le tireur PJ
- DICE_RESULT D20 (choc) visible dans le chat de tous les joueurs
- Si outcome ≠ 'ok' : DICE_RESULT D6 (durée) visible dans le chat, badge statut apparu sur le token cible
- Pas de blocage de la fenêtre dégâts

**Scénario 2 — PJ cible, shock requis**
Setup : assaut PNJ → PJ, blessure ≥ grave corps/tête ou ≥ critique
Résultat attendu :
- Fenêtre GESTION DES DÉGÂTS se résout côté tireur normalement
- CombatStunWindow apparaît chez le joueur ciblé avec badge outcome coloré
- Bouton "Lancer 1D6" présent et cliquable
- Au clic : fenêtre se ferme, DICE_RESULT D6 visible dans le chat, badge statut posé sur le token

**Scénario 3 — Shock non requis (non-régression)**
Setup : blessure légère (< 10 dégâts) ou localisation membre avec gravité < critique
Résultat attendu :
- Aucune fenêtre stun côté cible
- Aucun DICE_RESULT D6 dans le chat
- Flux dégâts normal inchangé

**Scénario 4 — PJ cible offline (fallback)**
Setup : PJ cible déconnecté au moment de l'assaut
Résultat attendu : comportement identique à Scénario 1 (auto D6, pas de prompt)

**Scénario 5 — Assaut CaC avec shock (non-régression)**
Setup : CaC PJ → PNJ, blessure critique
Résultat attendu : même comportement que Scénario 1, via le call site `resolveMeleeAction`

### Définition of done

- [ ] `node --check server/src/lib/statusService.js` — aucune erreur
- [ ] `node --check server/src/socket/index.js` — aucune erreur
- [ ] `grep -c "resolveShockBlock" server/src/socket/index.js` → retourne 0 (supprimé de partout)
- [ ] SR sans erreur dans les logs
- [ ] Scénario 1 validé fonctionnellement
- [ ] Scénario 2 validé fonctionnellement
- [ ] Scénario 3 validé (non-régression)
- [ ] JOURNAL4.md appendé
- [ ] EN_COURS.md mis à jour : ST2 ✅ complet

---

## REWORK-05 — Panneaux d'action partagés (tir / CaC / drone)

### Problème

3 panneaux droits (Tir, CaC, Drone) et 1 bloc log (`DeclareLogContent`) copiés-collés entre `CombatGmDeclareWindow.jsx` (~1214 lignes) et `CombatActionWindow.jsx` (~1878 lignes). ~370 lignes dupliquées. Toute correction devait être appliquée deux fois manuellement.

Bug COM5 (symptôme) : le handler GM dans le panneau CaC appelait `handleStartMelee()` sur click chip mode — le handler Joueur ne le faisait pas. Bug impossible à détecter sans lire les deux fichiers en parallèle.

Trigger ARCHI_REWORK : même bloc dupliqué N ≥ 3 fois (compte les futurs FenetreDrone, FenetreExoArmure).

### État actuel au moment du rework (Session 97)

- `CombatGmDeclareWindow.jsx` L.779-916 : panneau CaC inline
- `CombatGmDeclareWindow.jsx` L.919-1062 : panneau tir inline
- `CombatGmDeclareWindow.jsx` L.593-648 : panneau drone inline
- `CombatActionWindow.jsx` L.1177-1383 : panneau CaC inline
- `CombatActionWindow.jsx` L.1440-1593 : panneau tir humanoid inline
- `CombatActionWindow.jsx` L.1386-1436 : panneau tir drone inline
- `CombatActionWindow.jsx` L.683-736 : `declareLogSection` inline — rendu légèrement divergent du GM

### Décision architecturale

Extraire 3 sous-composants partagés + 1 export de contenu log + migration de constantes vers `combatSections.js`. Les deux fenêtres parentes deviennent des orchestrateurs qui montent les panneaux.

**Rejeté :** fusion GM+Joueur en un seul composant — différence structurelle réelle (navigation de slots, multi-phases, preview temps réel).

### Interface cible (Session 98 — implémentée)

```js
// combatSections.js — nouveaux exports
export const ACTION_LABELS   = { assault, melee, reload, micro, move_short, ... }
export const PURE_MOVE_TYPES = new Set([...])
export const COMBAT_MODE_DEFS = [{ k, l, tooltip }]  // tooltips canoniques version Joueur
export function computeFireVariant(fireMode, rawBulletCount, variantAB, { defaultCcCount = null } = {})
// → { variant, effectiveBulletCount }
// defaultCcCount=1 pour GM (PNJ default tir simple) / null pour Joueur (forçage sélection explicite)

// CombatDeclareLog.jsx
export function DeclareLogContent({ maxHeight })
// Corps seul — pas de titre (GM a titre draggable, Joueur titre inline)

// AssaultRangedPanel.jsx   — couleur #e07070
// MeleeCombatPanel.jsx     — couleur #70c070 — fix COM5 : onModeChange ne déclenche plus target mode
// DroneWeaponPanel.jsx     — couleur #30aaaa
```

### Périmètre

**Fichiers modifiés :**

| Fichier | Modification |
|---|---|
| `combatSections.js` | +`ACTION_LABELS`, `PURE_MOVE_TYPES`, `COMBAT_MODE_DEFS`, `computeFireVariant` |
| `CombatDeclareLog.jsx` | +`export DeclareLogContent({ maxHeight })` |
| `AssaultRangedPanel.jsx` | NOUVEAU — panneau tir CC/RC/RL partagé |
| `MeleeCombatPanel.jsx` | NOUVEAU — panneau CaC partagé (COM5 corrigé) |
| `DroneWeaponPanel.jsx` | NOUVEAU — panneau drone partagé |
| `CombatGmDeclareWindow.jsx` | Panneaux droits → 3 imports partagés. Fix COM5 : `onModeChange` ≠ `handleStartMelee`. |
| `CombatActionWindow.jsx` | `declareLogSection` inline → `<DeclareLogContent>` (fix CL2). Panneaux droits → imports partagés. |

**Fichiers NON touchés :** `server/`, `shared/events.js`, `SessionPage.jsx`, `CombatOverlay.jsx`, stores.

### Pièges documentés (7)

- **P1** — `DeclareLogContent` = corps seul, pas de titre
- **P2** — `styles` prop supprimée : panneaux définissent leurs styles internes
- **P3** — `isWeaponDrawn` ajouté à `MeleeCombatPanel` (grisage armes Joueur). ⚠ GM passait `true` hardcodé (hypothèse fausse — PNJ peut avoir arme rangée) — voir P7
- **P4** — `chargeMoveDest` normalisé : GM passe `chargeSelection?.move ?? null`, Joueur passe `moveSelection ?? null`
- **P5** — `handleStartMelee()` déplacée (pas supprimée) → appelée via bouton "Cibler" explicite
- **P6** — `COMBAT_MODE_DEFS` tooltips : version Joueur = source canonique (plus complète)
- **P7** — `state_weapon` : 3 états (`holstered`/`ready`/`drawn`), coûts INI asymétriques (holstered→drawn = −5, holstered→ready = −3, drawn→holstered = −10). Tooltip "−3 INI" dans `MeleeCombatPanel` L.138 est FAUX. → REWORK-06

### computeFireVariant — subtilité GM vs Joueur

**GM** passe `{ defaultCcCount: 1 }` → variant `cc_1` auto si assaultBulletCount=null (PNJ a un tir par défaut).
**Joueur** passe rien (default null) → variant=null si assaultBulletCount=null → `rangeValid=false` (force sélection explicite).
Joueur passe `effectiveBulletCount={effectiveBulletCount ?? 1}` au panel pour le radio visuel "Tir simple" pré-sélectionné (comportement conservé).

### Validation (Session 98 — clos partiel)

- **Scénario 1** — Tir GM PNJ, mode CC : non testé
- **Scénario 2** — COM5 : mode chip GM ne déclenche plus visée auto : non testé
- **Scénario 3** — CL2 : log Joueur = rendu identique GM : non testé
- **Scénario 4** — Non-régression CaC Joueur mode Charge : non testé
- **Scénario 5** — Non-régression Drone GM tir : non testé

### Definition of done

- [x] `npm run build` — 0 erreur Vite ✅ Session 98
- [x] SR 0 erreur ✅ Session 98
- [x] `grep -c "currentFireMode === 'CC'" CombatGmDeclareWindow.jsx` → 0 ✅ Session 99
- [x] `grep -c "currentFireMode === 'CC'" CombatActionWindow.jsx` → 0 ✅ Session 99
- [ ] Scénario 1 validé
- [ ] Scénario 2 validé (COM5)
- [ ] Scénario 3 validé (CL2)
- [ ] Scénario 4 validé (non-régression)
- [ ] Scénario 5 validé (non-régression)

---

## REWORK-07 — Socket utilities (getUserColor + checkTokenOwnership)

### Problème

Deux patterns copiés-collés dans `server/src/socket/index.js`, sans abstraction.

**Pattern A — couleur utilisateur** (N≥6 occurrences) :
```js
let color = '#5b8dee'
try {
  const userRow = await db('users').where({ id: socket.user.id }).select('color').first()
  if (userRow?.color) color = userRow.color
} catch (_) {}
```
Call sites connus : `DICE_ROLL`, `MACRO_ROLL`, `ENTITY_ACTION_RESOLVE`, `ENTITY_MOVE_REQUEST`, `COMBAT_SURPRISE_RESULT` — et probablement d'autres dans le bloc combat.
Vérifier par grep avant de coder :
```
grep -n "select('color')" server/src/socket/index.js
```

**Pattern B — ownership token** (N≥4 occurrences) :
```js
const isGm = socket.role === 'gm'
let isOwner = false
if (token.character_id) {
  const character = await db('characters').where({ id: token.character_id }).first()
  isOwner = character?.user_id === socket.user.id
}
if (!isOwner && !isGm) return
```
Call sites : `TOKEN_MOVE`, `TOKEN_ROTATE`, `TOKEN_SET_ROTATION`, `TOKEN_STATUS_TOGGLE`.
Vérifier :
```
grep -n "isOwner" server/src/socket/index.js
```

**Bonus — LOC_TABLE / LOC_TABLE_CONTACT (lignes 51–67)** :
Les deux tables sont identiques. `LOC_TABLE_CONTACT` est dead code.

### État actuel

Inline dans chaque handler — aucune abstraction.

### Décision

Nouveau fichier `server/src/lib/socketUtils.js` — 2 exports synchrones + 1 correctif dead code.
Pas de nouvelle architecture — extraction pure.

### Interface cible

```js
// server/src/lib/socketUtils.js

// Retourne la couleur hex de l'utilisateur.
// Fallback '#5b8dee' si absent ou erreur DB.
export async function getUserColor(db, userId)
// → string

// Vérifie l'ownership d'un token par rapport à un socket.
// token doit être déjà chargé par le caller (pas de nouvelle query DB sur token).
// Charge characters si token.character_id présent.
export async function checkTokenOwnership(db, token, userId, role)
// → { isGm: boolean, isOwner: boolean }
```

### Périmètre

**Fichiers modifiés :**

| Fichier | Modification |
|---|---|
| `server/src/lib/socketUtils.js` | NOUVEAU — 2 exports |
| `server/src/socket/index.js` | +import, remplacement patterns A + B + suppression `LOC_TABLE_CONTACT` |

**Fichiers NON touchés :** tout le reste — client, shared, autres lib, routes REST.

### Plan

**Étape 1 — Grep obligatoire avant tout code**
```
grep -n "select('color')" server/src/socket/index.js
grep -n "isOwner" server/src/socket/index.js
grep -n "LOC_TABLE_CONTACT" server/src/socket/index.js
```

**Étape 2 — Créer `server/src/lib/socketUtils.js`**
Run à vide : `node --check server/src/lib/socketUtils.js`

**Étape 3 — Remplacer Pattern A (`getUserColor`) dans tous les call sites**
Run à vide : `node --check server/src/socket/index.js`

**Étape 4 — Remplacer Pattern B (`checkTokenOwnership`) dans tous les call sites**
Run à vide : `node --check server/src/socket/index.js`

**Étape 5 — Supprimer `LOC_TABLE_CONTACT`, remplacer ses usages par `LOC_TABLE`**
Run à vide : `node --check server/src/socket/index.js`

**Étape 6 — SR**

### Validation

- DICE_ROLL : couleur correcte visible dans le chat (non-régression)
- TOKEN_MOVE : joueur ne peut pas déplacer le token d'un autre joueur
- SR sans erreur dans les logs

### Definition of done

- [x] `node --check server/src/lib/socketUtils.js` — 0 erreur ✅ Session 100
- [x] `node --check server/src/socket/index.js` — 0 erreur ✅ Session 100
- [x] `grep -c "select('color')" server/src/socket/index.js` → 0 ✅ Session 100
- [x] `grep -c "LOC_TABLE_CONTACT" server/src/socket/index.js` → 0 ✅ Session 100
- [x] SR sans erreur ✅ Session 100
- [x] JOURNAL4.md appendé ✅ Session 100

---

## REWORK-02 — damageService (résolution hit distance + melee PJ)

### Problème

Le bloc "résolution cible" (localisation D20 → armure → dégâts nets → sévérité → blessure → shock test) est dupliqué quasi-identiquement dans deux endroits :

1. `COMBAT_DAMAGE_CONFIRM` L.~2344–2437 (~94 lignes) — PJ lance ses dés ; couvre assault ET melee via `pendingType`
2. `resolveAssaultAction` branche PNJ L.~4234–4305 (~72 lignes) — PNJ auto, assault uniquement

**Différences légitimes entre les deux :**
- `degautsBruts` : calculé différemment AVANT le bloc (MR table + modDegatsMode pour assault, modDom + combatModeBonus pour melee) → le caller calcule `degautsBruts`, la fonction le reçoit en param
- Emits : DAMAGE_CONFIRM émet `COMBAT_DAMAGE_RESULT` (socket privé) + `DICE_RESULT` ×3 ; resolveAssaultAction PNJ émet `COMBAT_ATTACK_RESULT` uniquement → emits restent dans les callers
- `emitShockDiceResult` : 3 lignes identiques dans les deux callers — tolérable, reste dans les callers (évite de passer userId/username/color dans l'interface)

**Grep de vérification avant de coder :**
```
grep -n "rollLoc\|parseDice('1d20')" server/src/socket/index.js
grep -n "calcResistanceDommages" server/src/socket/index.js
grep -n "finalSeverity = woundResult" server/src/socket/index.js
```

### État actuel

Inline dans :
- `COMBAT_DAMAGE_CONFIRM` handler (~L.2344–2437)
- `resolveAssaultAction` PNJ branch (~L.4234–4305)

Fonctions utilitaires déjà disponibles (réutilisées, non touchées) :
- `calcResistanceArmure(armuresSlot)` — `charStats.js`
- `calcResistanceDommages(for_na, con_na)` — `charStats.js`
- `woundService.applyWound(io, db, campaignId, {...})` — `woundService.js` (REWORK-03)
- `statusService.resolveShockTest({...})` — `statusService.js` (REWORK-01)

### Décision architecturale

**Option retenue : Service Module**

Nouveau fichier `server/src/lib/damageService.js`. Les callers calculent `degautsBruts` eux-mêmes (contexte MR/modDom varie), puis délèguent toute la résolution cible.

**Rejeté :** déplacer les emits dans le service — les patterns PJ et PNJ divergent trop (COMBAT_DAMAGE_RESULT vs COMBAT_ATTACK_RESULT). Chaque caller garde ses emits.

### Interface cible

```js
// server/src/lib/damageService.js

// Résolution complète côté cible : localisation + armure + résistance + sévérité + blessure + shock.
// degautsBruts calculé avant l'appel par le caller (dépend du contexte MR/modDom).
// Retourne null si cibleType === 'drone' — caller gère resolveDroneIntegrityLoss lui-même.
// Émet WOUND_ADDED via woundService (effet DB+WS inclus).
export async function resolveTargetHit(io, db, campaignId, {
  degautsBruts,          // number — calculé par le caller
  characterIdCible,      // UUID | null
  cibleType,             // 'pj' | 'pnj' | 'drone' | null
  char_sheet_id_cible,   // UUID | null
  for_na_cible,          // number
  con_na_cible,          // number
  vol_na_cible,          // number
})
// → null si cibleType === 'drone'
// → {
//     rollLoc,         // number  — D20 localisation
//     locRolls,        // array   — pour DICE_RESULT (caller)
//     locSeed,         // string
//     slotCode,        // 'T'|'C'|'BD'|'BG'|'JD'|'JG'
//     localisation,    // 'tete'|'corps'|'bras_droit'|...
//     etq,             // number | null
//     rd,              // number
//     degatsNets,      // number
//     severity,        // string | null
//     is_lethal,       // boolean
//     finalSeverity,   // string | null (après promotion woundService)
//     shockResult,     // objet resolveShockTest | null
//   }
```

**Usage dans chaque caller :**
```js
// AVANT (à remplacer) :
// ~94 lignes / ~72 lignes de calcul inline

// APRÈS :
const hitResult = await damageService.resolveTargetHit(io, db, campaignId, {
  degautsBruts, characterIdCible, cibleType, char_sheet_id_cible,
  for_na_cible, con_na_cible, vol_na_cible,
})
if (hitResult === null) {
  // cible drone — caller gère resolveDroneIntegrityLoss + return
}
const { rollLoc, locRolls, locSeed, localisation, etq, rd, degatsNets,
        severity, is_lethal, finalSeverity, shockResult } = hitResult

if (shockResult) {
  statusService.emitShockDiceResult(io, campaignId, shockResult, userId, tireurUsername, tireurColor)
}
// puis emits spécifiques au caller (COMBAT_DAMAGE_RESULT / COMBAT_ATTACK_RESULT / DICE_RESULT)
```

### Types d'entité supportés

| Type | Supporté | Note |
|---|---|---|
| Humanoïde (PJ + PNJ) | ✅ | Calcul complet |
| Drone | ❌ retourne null | Caller gère resolveDroneIntegrityLoss |
| Exo-armure | 🔜 futur | — |

### Périmètre

**Fichiers modifiés :**

| Fichier | Modification |
|---|---|
| `server/src/lib/damageService.js` | NOUVEAU — `resolveTargetHit` |
| `server/src/socket/index.js` | +import, 2 sites remplacés (DAMAGE_CONFIRM + resolveAssaultAction PNJ) |

**Fichiers NON touchés :**
- `woundService.js`, `statusService.js`, `charStats.js` — réutilisés tels quels
- `client/`, `shared/`, routes REST — inchangés
- `resolveMeleeAction` — hors périmètre (duplication distincte, sprint futur)

### Plan d'implémentation — ordre obligatoire

**Étape 1 — Lecture obligatoire avant tout code**
Lire (pas depuis la mémoire) :
- `COMBAT_DAMAGE_CONFIRM` complet (L.~2325–2520) — vérifier le bloc exact à extraire
- Branche PNJ de `resolveAssaultAction` (L.~4233–4327) — idem
- Greps de vérification (ci-dessus §Problème)
- `server/src/lib/woundService.js` — signature exacte `applyWound`

**Étape 2 — Créer `server/src/lib/damageService.js`**
Copier le bloc DAMAGE_CONFIRM comme base (plus complet : locRolls/locSeed exposés).
Run à vide : `node --check server/src/lib/damageService.js`

**Étape 3 — Patcher `COMBAT_DAMAGE_CONFIRM` dans `index.js`**
Remplacer le bloc L.~2344–2437 par l'appel `resolveTargetHit`.
Conserver le drone branch existant AVANT l'appel (ou laisser `resolveTargetHit` retourner null et le caller revient sur la branche drone — vérifier l'ordre exact à la lecture).
Run à vide : `node --check server/src/socket/index.js`

**Étape 4 — Patcher `resolveAssaultAction` branche PNJ dans `index.js`**
Remplacer le bloc L.~4234–4305 par l'appel `resolveTargetHit`.
Run à vide : `node --check server/src/socket/index.js`

**Étape 5 — SR**

### Validation

**Scénario 1 — Assault PNJ → PNJ (auto)**
Setup : PNJ déclaré, slot activé — `resolveAssaultAction` appelle `resolveTargetHit`
Attendu : `COMBAT_ATTACK_RESULT` broadcast avec dégâts, sévérité, shockResult si applicable

**Scénario 2 — Assault PJ → PNJ (interactif)**
Setup : PJ tire, touche → `COMBAT_DAMAGE_PROMPT` → PJ confirme → `COMBAT_DAMAGE_CONFIRM` appelle `resolveTargetHit`
Attendu : `COMBAT_DAMAGE_RESULT` affiché PJ, `DICE_RESULT` ×3 broadcast, `COMBAT_ATTACK_RESULT` broadcast

**Scénario 3 — Cible drone (non-régression)**
Setup : assault vers drone
Attendu : `resolveTargetHit` retourne null, `resolveDroneIntegrityLoss` appelé, pas de crash

**Scénario 4 — Shock sur blessure grave (non-régression REWORK-01)**
Setup : blessure grave corps/tête
Attendu : `shockResult` non null, `emitShockDiceResult` diffusé, `applyStun` déclenché si outcome ≠ 'ok'

**Scénario 5 — Melee PJ (non-régression DAMAGE_CONFIRM)**
Setup : CaC PJ, `pendingType === 'melee'` — `degautsBruts = rawDice + modDom + combatModeBonus`
Attendu : résolution identique à avant le rework

### Definition of done

- [ ] `node --check server/src/lib/damageService.js` — 0 erreur
- [ ] `node --check server/src/socket/index.js` — 0 erreur
- [ ] `grep -c "calcResistanceDommages" server/src/socket/index.js` → 0 (extrait partout)
- [ ] `grep -c "finalSeverity = woundResult" server/src/socket/index.js` → 0
- [ ] SR sans erreur
- [ ] Scénario 1 validé
- [ ] Scénario 2 validé
- [ ] Scénario 3 validé (non-régression drone)
- [ ] JOURNAL4.md appendé

---

## Prochains reworks identifiés (non planifiés)

Ces blocs sont candidats à un rework futur selon les mêmes principes :

| ID | Bloc | Signal |
|---|---|---|
| REWORK-02 | Calcul dégâts distance | ✅ Spec complète Session 100 — voir section REWORK-02 ci-dessus |
| REWORK-03 | Résolution blessure + wound insertion | ✅ Clos Session 97 — `woundService.applyWound` |
| REWORK-04 | Système de combat complet | Migration vers State Machine (FSM) — sprint long terme. **Prérequis : REWORK-08** |
| REWORK-06 | combatDeclarationStore | Staging state déclaration fragmenté en local React state (GM+Joueur). Auto-draw, default mains nues non implémentables sans débat archi. Voir REWORK-05.md §REWORK-06 |
| REWORK-08 | Modularisation `socket/index.js` | 4 462 lignes — fichier dieu. Découper en `socketToken.js`, `socketVoxel.js`, `socketEntity.js`, `socketCombat.js`, `socketDice.js`. `initSocket()` devient coordinateur. **Prérequis de REWORK-04.** |
| REWORK-09 | `SessionPage.jsx` → hooks WS dédiés | 1 509 lignes. Tous les listeners WS inline dans un `useEffect` unique. 30+ props passées à `CombatOverlay`. Cible : `useCombatSocket.js`, `useEntitySocket.js`, `useTokenSocket.js`. |
