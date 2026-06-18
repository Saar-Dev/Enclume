# ARCHI_REWORK_DONE.md — Spécifications des reworks achevés
> Créé Session 101 — 2026-06-17
> Archive des specs complètes (problème, décision, interface, plan, validation).
> Pour la liste active et les reworks en cours → [ARCHI_REWORK.md](ARCHI_REWORK.md)

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

### État actuel au moment du rework

**Fonctions dans `server/src/socket/index.js` :**
- `emitTokenStatusUpdated(io, campaignId, tokenId)` (~ligne 3102) — query token_statuses + broadcast TOKEN_STATUS_UPDATED
- `applyStunWithDuration(io, campaignId, tokenId, outcome, stunDuration, currentTurn)` (~ligne 3112) — INSERT/MERGE token_statuses + appel emitTokenStatusUpdated
- `resolveShockBlock(io, campaignId, { finalSeverity, localisation, is_lethal, for_na, con_na, vol_na, targetTokenId, userId, username, color })` (~ligne 3130) — le bloc problématique supprimé

**Fonctions utilitaires pures réutilisées dans le service :**
- `isShockTestRequired(severity, location)` → `boolean` — `server/src/lib/woundUtils.js` ligne 4
- `calcSeuils(for_na, con_na, vol_na)` → `{ etourdissement, inconscience }` — `server/src/lib/charStats.js` ligne 238
- `getShockMalus(severity, location, is_lethal)` → `number` — `server/src/lib/charStats.js` ligne 400

### Décision architecturale

**Option retenue : Service Module**

Nouveau fichier `server/src/lib/statusService.js` encapsulant toute la logique stun. Les callers appellent une fonction simple — ils ne savent pas si la cible est PJ ou PNJ, ils ne lancent pas de dés, ils n'écrivent pas en base.

**Options écartées :**
- Bus d'événements interne : sur-ingénierie — un seul système réagit au shock pour l'instant.
- State machine complète : hors scope — nécessite réécriture du combat entier.

### Interface cible du module

```js
// server/src/lib/statusService.js

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

export async function applyStun(io, db, campaignId, pendingStunActions, {
  targetTokenId,   // string UUID
  outcome,         // 'etourdi' | 'inconscient'
  userId,          // string
  username,        // string
  color,           // string hex
})
// → void (tous les effets passent par io et db)
```

### Types d'entité supportés

| Type | Stun | Source |
|---|---|---|
| Humanoïde (PJ + PNJ) | ✅ | MANUELSYSCOMBAT §5 |
| Drone | ❌ N/A — jamais appelé | MANUELSYSCOMBAT §7.6 |
| Exo-armure | 🔜 futur | — |

### V1 / V2 — shock_auto_stun

`campaigns.shock_auto_stun BOOLEAN DEFAULT true`

| Valeur | Comportement `applyStun` |
|---|---|
| `false` | GM gère TOUS les D6 — PJ et PNJ reçoivent le prompt via `gmSocket` |
| `true` (défaut) | PJ → fenêtre interactive (`pjSocket`) / PNJ → auto D6 serveur |

**⚠ Implémentation partielle :**
- `false` + PJ → **BUG SHK5** — PJ reçoit la fenêtre à tort (devrait aller au GM). Sprint futur.

### Séquençage résolu

```
AVANT : COMBAT_DAMAGE_CONFIRM → resolveShockBlock (bloquant) → COMBAT_DAMAGE_RESULT (bloqué)
APRÈS : COMBAT_DAMAGE_CONFIRM → resolveShockTest (pur) → COMBAT_DAMAGE_RESULT → applyStun (async)
```

### Definition of done ✅ Clos Session 96

- [x] `node --check server/src/lib/statusService.js` — 0 erreur
- [x] `node --check server/src/socket/index.js` — 0 erreur
- [x] `grep -c "resolveShockBlock" server/src/socket/index.js` → 0
- [x] SR sans erreur
- [x] Scénario 1 validé (PNJ cible)
- [x] Scénario 2 validé (PJ cible)
- [x] Scénario 3 validé (non-régression)
- [x] JOURNAL4.md appendé

---

## REWORK-02 — damageService (résolution hit distance + melee PJ)

### Problème

Le bloc "résolution cible" (localisation D20 → armure → dégâts nets → sévérité → blessure → shock test) était dupliqué quasi-identiquement dans :

1. `COMBAT_DAMAGE_CONFIRM` L.~2344–2437 (~94 lignes) — PJ lance ses dés ; couvre assault ET melee via `pendingType`
2. `resolveAssaultAction` branche PNJ L.~4234–4305 (~72 lignes) — PNJ auto, assault uniquement

**Différences légitimes entre les deux :**
- `degautsBruts` : calculé différemment AVANT le bloc (MR table + modDegatsMode pour assault, modDom + combatModeBonus pour melee) → le caller calcule `degautsBruts`, la fonction le reçoit en param
- Emits : DAMAGE_CONFIRM émet `COMBAT_DAMAGE_RESULT` (socket privé) + `DICE_RESULT` ×3 ; resolveAssaultAction PNJ émet `COMBAT_ATTACK_RESULT` uniquement → emits restent dans les callers

### Décision architecturale

**Option retenue : Service Module**

Nouveau fichier `server/src/lib/damageService.js`. Les callers calculent `degautsBruts` eux-mêmes (contexte MR/modDom varie), puis délèguent toute la résolution cible. Emits restent dans les callers (patterns PJ et PNJ divergent : COMBAT_DAMAGE_RESULT vs COMBAT_ATTACK_RESULT).

**Scope final : 4 sites** (1, 2, 4, 5) — `resolveMeleeAction` (site 3) exclu définitivement.

**LOC_TABLE → Option A** : déplacée dans `shared/armorConstants.js`.

### Interface cible du module

```js
// server/src/lib/damageService.js

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
//     rollLoc, locRolls, locSeed,
//     slotCode,        // 'T'|'C'|'BD'|'BG'|'JD'|'JG'
//     localisation,    // 'tete'|'corps'|'bras_droit'|...
//     etq, rd, degatsNets,
//     severity, is_lethal, finalSeverity,
//     shockResult,     // objet resolveShockTest | null
//   }
```

### Types d'entité supportés

| Type | Supporté | Note |
|---|---|---|
| Humanoïde (PJ + PNJ) | ✅ | Calcul complet |
| Drone | ❌ retourne null | Caller gère resolveDroneIntegrityLoss |
| Exo-armure | 🔜 futur | — |

### Pièges documentés (Session 101)

- **[F2]** `resolveDroneAssaultAction` — 3 branches (8a drone cible, 8b PNJ cible = Site 4, 8c PJ cible → DAMAGE_CONFIRM)
- **[F3]** `cibleType: null` quand drone attaque PJ → pas de risque de déclenchement de la guard
- **[F4]** Guard `cibleType === 'drone'` nécessaire même si jamais déclenchée (protection char_sheet absent)
- **[F5]** Label DICE_RESULT incohérent entre sites (`ETQ:` vs `Armure:`) — hors périmètre, laissé tel quel
- **[F9]** Pas de dépendance circulaire — `damageService` importe `woundService`+`statusService`, jamais l'inverse

### Definition of done ✅ Clos Session 101

- [x] `node --check server/src/lib/damageService.js` — 0 erreur
- [x] `node --check server/src/socket/index.js` — 0 erreur
- [x] `grep -c "calcResistanceDommages" server/src/socket/index.js` → **2** (L.13 import + resolveMeleeAction exclu)
- [x] `grep -c "finalSeverity = woundResult" server/src/socket/index.js` → **1**
- [x] SR sans erreur
- [x] Scénario 1 validé (assault PNJ auto)
- [ ] Scénario 2 non testé (COMBAT_DAMAGE_CONFIRM PJ interactif)
- [ ] Scénario 3 non testé (non-régression drone)
- [x] JOURNAL4.md appendé

---

## REWORK-05 — Panneaux d'action partagés (tir / CaC / drone)

### Problème

3 panneaux droits (Tir, CaC, Drone) et 1 bloc log (`DeclareLogContent`) copiés-collés entre `CombatGmDeclareWindow.jsx` (~1214 lignes) et `CombatActionWindow.jsx` (~1878 lignes). ~370 lignes dupliquées. Toute correction devait être appliquée deux fois manuellement.

Bug COM5 (symptôme) : le handler GM dans le panneau CaC appelait `handleStartMelee()` sur click chip mode — le handler Joueur ne le faisait pas. Bug impossible à détecter sans lire les deux fichiers en parallèle.

### Décision architecturale

Extraire 3 sous-composants partagés + 1 export de contenu log + migration de constantes vers `combatSections.js`. Les deux fenêtres parentes deviennent des orchestrateurs qui montent les panneaux.

**Rejeté :** fusion GM+Joueur en un seul composant — différence structurelle réelle (navigation de slots, multi-phases, preview temps réel).

### Interface cible

```js
// combatSections.js
export const ACTION_LABELS   = { assault, melee, reload, micro, move_short, ... }
export const PURE_MOVE_TYPES = new Set([...])
export const COMBAT_MODE_DEFS = [{ k, l, tooltip }]
export function computeFireVariant(fireMode, rawBulletCount, variantAB, { defaultCcCount = null } = {})
// → { variant, effectiveBulletCount }
// defaultCcCount=1 pour GM (PNJ default tir simple) / null pour Joueur (forçage sélection explicite)

// CombatDeclareLog.jsx
export function DeclareLogContent({ maxHeight })
// Corps seul — pas de titre

// AssaultRangedPanel.jsx   — couleur #e07070
// MeleeCombatPanel.jsx     — couleur #70c070 — fix COM5
// DroneWeaponPanel.jsx     — couleur #30aaaa
```

### Pièges documentés (7)

- **P1** — `DeclareLogContent` = corps seul, pas de titre
- **P2** — `styles` prop supprimée : panneaux définissent leurs styles internes
- **P3** — `isWeaponDrawn` ajouté à `MeleeCombatPanel`. GM passait `true` hardcodé (hypothèse fausse — PNJ peut avoir arme rangée)
- **P4** — `chargeMoveDest` normalisé : GM passe `chargeSelection?.move ?? null`, Joueur passe `moveSelection ?? null`
- **P5** — `handleStartMelee()` déplacée (pas supprimée) → appelée via bouton "Cibler" explicite
- **P6** — `COMBAT_MODE_DEFS` tooltips : version Joueur = source canonique
- **P7** — `state_weapon` : 3 états (`holstered`/`ready`/`drawn`), coûts INI asymétriques. Tooltip "−3 INI" dans `MeleeCombatPanel` L.138 est FAUX → REWORK-06

### computeFireVariant — subtilité GM vs Joueur

**GM** passe `{ defaultCcCount: 1 }` → variant `cc_1` auto si assaultBulletCount=null.
**Joueur** passe rien → variant=null si assaultBulletCount=null → `rangeValid=false` (force sélection explicite).

### Definition of done ✅ Clos complet Session 99

- [x] `npm run build` — 0 erreur Vite
- [x] SR 0 erreur
- [x] `grep -c "currentFireMode === 'CC'" CombatGmDeclareWindow.jsx` → 0
- [x] `grep -c "currentFireMode === 'CC'" CombatActionWindow.jsx` → 0
- [x] Scénario 1 validé (tir GM PNJ mode CC)
- [x] Scénario 2 validé (COM5 : mode chip GM ne déclenche plus visée)
- [x] Scénario 3 validé (CL2 : log Joueur = GM)
- [x] Scénario 4 validé (non-régression CaC Joueur Charge)
- [x] Scénario 5 validé (non-régression Drone GM)

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

**Bonus :** `LOC_TABLE_CONTACT` (lignes 51–67) = dead code identique à `LOC_TABLE`.

### Décision

Nouveau fichier `server/src/lib/socketUtils.js` — extraction pure, pas de nouvelle architecture.

### Interface cible

```js
// server/src/lib/socketUtils.js

export async function getUserColor(db, userId)
// → string (fallback '#5b8dee')

export async function checkTokenOwnership(db, token, userId, role)
// → { isGm: boolean, isOwner: boolean }
```

### Definition of done ✅ Clos complet Session 100

- [x] `node --check server/src/lib/socketUtils.js` — 0 erreur
- [x] `node --check server/src/socket/index.js` — 0 erreur
- [x] `grep -c "select('color')" server/src/socket/index.js` → 0
- [x] `grep -c "LOC_TABLE_CONTACT" server/src/socket/index.js` → 0
- [x] SR sans erreur
- [x] JOURNAL4.md appendé
