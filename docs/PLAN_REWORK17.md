# PLAN_REWORK17.md — socketCombat.js Modularisation
> Rédigé Session 116 — 2026-06-22
> Ce plan est destiné à un agent d'implémentation dans une conversation séparée.
> L'agent doit lire ce document EN ENTIER avant de toucher un seul fichier.
> **Prérequis : REWORK-16 validé et mergé.**

---

## Contexte — pourquoi ce rework existe

`socketCombat.js` est un monolithe de 2969 lignes créé par REWORK-08 (qui a sorti le combat de `index.js`). Ce rework n'a fait que déplacer le code — il ne l'a pas structuré. Résultat :
- 12 handlers socket + 12 helpers + 4 resolve functions (1200L de logique) dans une seule fonction
- Non navigable : trouver `COMBAT_DAMAGE_CONFIRM` demande `Ctrl+F` dans 2969L
- Non assignable : impossible de confier un domaine à un développeur sans conflit
- Non testable : les resolve functions sont enfouies dans la closure

**Ce rework ne change aucune interface.** Déplacement pur du code. Les signatures des handlers et des helpers sont **identiques** avant et après. Si une ligne de logique change, c'est un bug.

**Ce rework ne fait PAS** : changer les signatures des resolve functions, séparer computation et émission socket (c'est REWORK-18), toucher au client, modifier des règles de combat.

---

## Structure cible

```
server/src/socket/
├── index.js                          (143L — INCHANGÉ)
├── socketCombat.js                   (35L  — orchestrateur, RÉÉCRIT)
├── socketCombatState.js              (NEW ~350L)
├── socketCombatAnnouncement.js       (NEW ~450L)
├── socketCombatResolution.js         (NEW ~600L)
└── socketCombatHelpers.js            (NEW ~1600L)
```

`socketCombat.js` après rework :
```js
import { registerStateHandlers }        from './socketCombatState.js'
import { registerAnnouncementHandlers } from './socketCombatAnnouncement.js'
import { registerResolutionHandlers }   from './socketCombatResolution.js'

export function registerCombatHandlers(io, socket, context, pendingMaps) {
  registerStateHandlers(io, socket, context, pendingMaps)
  registerAnnouncementHandlers(io, socket, context, pendingMaps)
  registerResolutionHandlers(io, socket, context, pendingMaps)
}
```

---

## Fichiers à lire AVANT de coder

Dans cet ordre, sans exception :

1. **`server/src/socket/socketCombat.js`** — lire en entier. Cartographier :
   - Lignes de chaque `socket.on(...)` (grep : `socket.on(WS.COMBAT`)
   - Lignes de chaque fonction helper/resolve déclarée hors `registerCombatHandlers`
   - Les imports au début du fichier (L.1–19) — noter lesquels sont utilisés par handlers vs helpers
2. **`server/src/socket/index.js`** — vérifier la ligne d'import `registerCombatHandlers` (ne doit pas changer)
3. **`docs/ARCHI_REWORK.md`** §REWORK-17 — spec complète + périmètre

---

## Pièges critiques

**PIÈGE 1 — Les helpers sont HORS de la closure `registerCombatHandlers`**
Les 13 fonctions (`startAnnouncementTimers`, `skipPlayer`, `startResolutionPhase`, `advanceSlot`, `endTurn`, `multiAdversaryMalus`, `countAdversaires`, `resolveMeleeAction`, `resolveReloadAction`, `resolveDroneAssaultAction`, `resolveAssaultAction`, `calcDroneRD`, `resolveDroneIntegrityLoss`) sont déclarées après la fermeture du `registerCombatHandlers`. Elles ne capturent rien par closure — elles reçoivent tout en paramètre. Ce sont des candidats naturels à l'extraction.

**PIÈGE 2 — `db` est importé, pas injecté**
`db` vient de `import db from '../db/knex.js'` au niveau module. Quand les fichiers sont séparés, chaque nouveau fichier qui utilise `db` doit avoir son propre `import db from '../db/knex.js'`. Ne pas passer `db` en paramètre — utiliser l'import direct.

**PIÈGE 3 — Les constants (L.21–70) sont utilisées par les resolve functions ET par les handlers**
Les 7 constantes locales (`PORTEE_MOD_COMP`, `SITUATION_MODS`, `TAILLE_MODS`, `SITUATION_LABELS`, `PORTEE_LABELS`, `TAILLE_LABELS`, `COMBAT_MODE_LABELS`) vont dans `socketCombatHelpers.js`. Seule `COMBAT_MODE_LABELS` est utilisée dans un handler file (Resolution) — elle doit être exportée et importée depuis `socketCombatHelpers.js`. Les 6 autres restent non-exportées (usage intra-Helpers uniquement).
Ne pas confondre avec les constantes shared (`LOCATION_LABELS`, `SEVERITY_COLORS`, `SLOT_TO_WOUND_LOCATION`, etc.) qui s'importent directement depuis `shared/` dans chaque fichier qui en a besoin — elles ne transitent pas par `socketCombatHelpers.js`.

**PIÈGE 4 — `calcDroneRD` et `resolveDroneIntegrityLoss` sont appelés depuis `resolveDroneAssaultAction`**
Ces deux fonctions (en fin de fichier) doivent être dans le même fichier que `resolveDroneAssaultAction` → `socketCombatHelpers.js`. Ne pas les oublier.

**PIÈGE 5 — `COMBAT_SKIP_PLAYER` est valide en ANNOUNCEMENT et en RESOLUTION**
Un seul handler gère les deux phases (L.815). Il appelle `skipPlayer()`. Le mettre dans `socketCombatAnnouncement.js` est correct — le handler vérifie lui-même la phase via FSM.

**PIÈGE 6 — `COMBAT_ACTION_PRECHECK` est un handler REWORK-16 (nouveau)**
Il doit aller dans `socketCombatResolution.js` avec les autres handlers de résolution (c'est la pre-validation gate de résolution).

**PIÈGE 7 — Ne rien changer à la logique**
Si pendant la migration une ligne semble "améliorable", ne pas la toucher. REWORK-17 = déménagement pur. Toute amélioration logique = un bug potentiel non détectable à la validation.

**PIÈGE 8 — Vérifier les imports pour chaque fichier**
Après création de chaque fichier, vérifier que tous les symboles utilisés sont importés. Un symbole manquant = erreur runtime silencieuse si le chemin n'est pas testé.

---

## Mapping des handlers

Vérifier avec grep dans `socketCombat.js` avant de commencer :
```powershell
grep -n "socket.on(WS" server/src/socket/socketCombat.js
```

Distribution attendue (vérifier les lignes réelles avant migration) :

**→ `socketCombatState.js`** (5 handlers)
| Handler | Ligne approx. |
|---|---|
| `COMBAT_START` | L.80 |
| `COMBAT_END` | L.214 |
| `COMBAT_ANNOUNCE_START` | L.271 |
| `COMBAT_INIT_STATE` | L.311 |
| `COMBAT_SURPRISE_RESULT` | L.349 |

**→ `socketCombatAnnouncement.js`** (3 handlers)
| Handler | Ligne approx. |
|---|---|
| `COMBAT_ACTION_DECLARE` | L.436 |
| `COMBAT_SKIP_PLAYER` | L.815 |
| `COMBAT_ANNOUNCE_PREVIEW` | L.838 |

**→ `socketCombatResolution.js`** (6 handlers)
| Handler | Ligne approx. |
|---|---|
| `COMBAT_ACTION_PRECHECK` | après L.850 (REWORK-16) |
| `COMBAT_ACTION_CONFIRM` | L.856 |
| `COMBAT_DAMAGE_CONFIRM` | L.976 |
| `COMBAT_MELEE_DEFENSE_CONFIRM` | L.1141 |
| `COMBAT_STUN_CONFIRM` | L.1361 |
| `COMBAT_APPLY_STUN` | L.1396 |

**→ `socketCombatHelpers.js`** (tout le reste)
- Constants : L.21–70
- `startAnnouncementTimers` : L.1416
- `skipPlayer` : L.1437
- `startResolutionPhase` : L.1489
- `advanceSlot` : L.1532
- `endTurn` : L.1553
- `multiAdversaryMalus` : L.1644
- `countAdversaires` : L.1651
- `resolveMeleeAction` : L.1666
- `resolveReloadAction` : L.2157
- `resolveDroneAssaultAction` : L.2294
- `resolveAssaultAction` : L.2594
- `calcDroneRD` : L.2918
- `resolveDroneIntegrityLoss` : L.2925

⚠️ Les lignes ci-dessus sont APPROXIMATIVES (basées sur le fichier avant REWORK-16). Vérifier avec grep avant migration.

---

## Imports par fichier

### `socketCombatHelpers.js` — tous les imports du fichier original
```js
import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'
import { parseDice } from '../lib/diceParser.js'
import { getMrTable, getModifier } from '../lib/mrTable.js'
import * as woundService from '../lib/woundService.js'
import * as statusService from '../lib/statusService.js'
import * as damageService from '../lib/damageService.js'
import { canTransition, setFSMSubPhase } from '../lib/combatFSM.js'
import { checkCombatLOS } from '../lib/losService.js'
import {
  calcSkillTotal, calcAttributeNA, calcREA,
  calcWoundPenalty, calcEncumbrancePenalty,
  calcResistanceDommages, calcResistanceArmure, calcCarenceArmure,
  getModDom, RD_TABLE, lookupTable,
} from '../lib/charStats.js'
import { isCaseOccupied, collisionMoveToken } from '../lib/redis.js'
import { SLOT_TO_WOUND_LOCATION, LOCATION_LABELS, LOC_TABLE } from '../../../shared/armorConstants.js'
import { SEVERITY_COLORS } from '../../../shared/woundConstants.js'
```
Exporter (13 fonctions + 1 constante = 14 exports) :
`export function startAnnouncementTimers(...)`, `export function skipPlayer(...)`, `export function startResolutionPhase(...)`, `export function advanceSlot(...)`, `export function endTurn(...)`, `export function multiAdversaryMalus(...)`, `export function countAdversaires(...)`, `export async function resolveMeleeAction(...)`, `export async function resolveReloadAction(...)`, `export async function resolveDroneAssaultAction(...)`, `export async function resolveAssaultAction(...)`, `export function calcDroneRD(...)`, `export async function resolveDroneIntegrityLoss(...)`, `export const COMBAT_MODE_LABELS`.

Exporter uniquement `COMBAT_MODE_LABELS` parmi les constants — seule constante utilisée dans un handler file (L.1214 COMBAT_MELEE_DEFENSE_CONFIRM → socketCombatResolution.js, vérifié session 117). Les 6 autres constants (`PORTEE_MOD_COMP`, `SITUATION_MODS`, `TAILLE_MODS`, `SITUATION_LABELS`, `PORTEE_LABELS`, `TAILLE_LABELS`) restent non-exportées — utilisées uniquement dans les resolve functions (intra-Helpers).

Note session 117 : `getUserColor` n'est PAS utilisé dans les Helpers (seul usage : L.374 SURPRISE_RESULT → State). Import retiré de socketCombatHelpers.js.

### `socketCombatState.js`
```js
import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'
import { canTransition } from '../lib/combatFSM.js'
import { parseDice } from '../lib/diceParser.js'
import { calcAttributeNA, calcREA } from '../lib/charStats.js'
import { getUserColor } from '../lib/socketUtils.js'
import * as statusService from '../lib/statusService.js'
import { startAnnouncementTimers, startResolutionPhase } from './socketCombatHelpers.js'
// parseDice        : COMBAT_SURPRISE_RESULT (jet 1d20 — L.368 vérifié session 117)
// calcAttributeNA  : COMBAT_START (calcul base_ini — L.138 vérifié session 117)
// statusService    : COMBAT_END (emitTokenStatusUpdated — L.249 vérifié session 117)
```

### `socketCombatAnnouncement.js`
```js
import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'
import { canTransition } from '../lib/combatFSM.js'
import { skipPlayer, startResolutionPhase } from './socketCombatHelpers.js'
// Aucun import service supplémentaire — DECLARE/SKIP/PREVIEW n'appellent pas de services (vérifié session 117)
```

### `socketCombatResolution.js`
```js
import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'
import { canTransition, setFSMSubPhase } from '../lib/combatFSM.js'
import { checkLOSForPrecheck } from '../lib/losService.js'
import { parseDice } from '../lib/diceParser.js'
import { getMrTable, getModifier } from '../lib/mrTable.js'
import * as statusService from '../lib/statusService.js'
import * as damageService from '../lib/damageService.js'
import { calcSkillTotal } from '../lib/charStats.js'
import { isCaseOccupied, collisionMoveToken } from '../lib/redis.js'
import { LOCATION_LABELS } from '../../../shared/armorConstants.js'
import { SEVERITY_COLORS } from '../../../shared/woundConstants.js'
import {
  advanceSlot, endTurn,
  resolveMeleeAction, resolveReloadAction,
  resolveDroneAssaultAction, resolveAssaultAction,
  COMBAT_MODE_LABELS,
} from './socketCombatHelpers.js'
// parseDice            : DAMAGE_CONFIRM (L.1002), MELEE_DEFENSE_CONFIRM (L.1177, L.1291), STUN_CONFIRM (L.1377)
// getMrTable, getModifier : DAMAGE_CONFIRM (L.1007, L.1008 — vérifié session 117)
// statusService        : DAMAGE_CONFIRM (applyStun L.1077, emitShockDiceResult L.1058)
//                        MELEE_DEFENSE_CONFIRM (applyStun L.1320, emitShockDiceResult L.1302)
//                        STUN_CONFIRM (applyStunWithDuration L.1391), APPLY_STUN (L.1406)
// damageService        : DAMAGE_CONFIRM (resolveTargetHit L.1048), MELEE_DEFENSE_CONFIRM (L.1293)
// calcSkillTotal       : MELEE_DEFENSE_CONFIRM (L.1199)
// isCaseOccupied       : ACTION_CONFIRM déplacement (L.918)
// collisionMoveToken   : ACTION_CONFIRM déplacement (L.924)
// LOCATION_LABELS      : DAMAGE_CONFIRM (L.1065, L.1091, L.1099, L.1116)
// SEVERITY_COLORS      : DAMAGE_CONFIRM (L.1060)
// COMBAT_MODE_LABELS   : MELEE_DEFENSE_CONFIRM (L.1214)
// Tous vérifiés session 117 par grep awk NR>=856 && NR<=1415
```

---

## Étapes d'implémentation

### Étape 1 — Créer `socketCombatHelpers.js`

1. Créer le fichier
2. Coller tous les imports listés dans §Imports
3. Coller les constants (L.21–70 de socketCombat.js original)
4. Coller toutes les fonctions helper et resolve listées dans §Mapping
5. Ajouter `export` devant chaque `function` (ou `async function`) **et `export const` devant `COMBAT_MODE_LABELS`** — les 6 autres constants restent sans `export`
6. **Run à vide** : `node --check server/src/socket/socketCombatHelpers.js`
7. Confirmer "node --check OK" avant Étape 2

### Étape 2 — Créer `socketCombatState.js`

1. Créer le fichier
2. Ajouter imports de §Imports > socketCombatState.js
3. Coller les 5 handlers d'état depuis `registerCombatHandlers` dans socketCombat.js
4. Les wrapper dans `export function registerStateHandlers(io, socket, context, pendingMaps) { const { campaignId, user, isGm } = context ... }`
5. **Run à vide** : `node --check server/src/socket/socketCombatState.js`
6. Confirmer "node --check OK" avant Étape 3

### Étape 3 — Créer `socketCombatAnnouncement.js`

1. Créer le fichier
2. Ajouter imports de §Imports > socketCombatAnnouncement.js
3. Coller les 3 handlers d'annonce
4. Wrapper dans `export function registerAnnouncementHandlers(io, socket, context, pendingMaps) { const { campaignId, user, isGm } = context ... }` — `isGm` et `user.id` utilisés dans COMBAT_ACTION_DECLARE (vérifié session 117)
5. **Run à vide** : `node --check server/src/socket/socketCombatAnnouncement.js`
6. Confirmer "node --check OK" avant Étape 4

### Étape 4 — Créer `socketCombatResolution.js`

1. Créer le fichier
2. Ajouter imports de §Imports > socketCombatResolution.js
3. Coller les 6 handlers de résolution (PRECHECK inclus)
4. Wrapper dans `export function registerResolutionHandlers(io, socket, context, pendingMaps) { const { campaignId, user, isGm } = context ... }` — `isGm` utilisé dans COMBAT_APPLY_STUN, `campaignId` partout (vérifié session 117)
5. **Run à vide** : `node --check server/src/socket/socketCombatResolution.js`
6. Confirmer "node --check OK" avant Étape 5

### Étape 5 — Réécrire `socketCombat.js`

Remplacer le contenu ENTIER du fichier par :

```js
import { registerStateHandlers }        from './socketCombatState.js'
import { registerAnnouncementHandlers } from './socketCombatAnnouncement.js'
import { registerResolutionHandlers }   from './socketCombatResolution.js'

export function registerCombatHandlers(io, socket, context, pendingMaps) {
  registerStateHandlers(io, socket, context, pendingMaps)
  registerAnnouncementHandlers(io, socket, context, pendingMaps)
  registerResolutionHandlers(io, socket, context, pendingMaps)
}
```

**Run à vide** :
- `node --check server/src/socket/socketCombat.js`
- `node --check server/src/socket/socketCombatState.js`
- `node --check server/src/socket/socketCombatAnnouncement.js`
- `node --check server/src/socket/socketCombatResolution.js`
- `node --check server/src/socket/socketCombatHelpers.js`
- SR (serveur redémarré sans erreur)

Confirmer "SR" avant Étape 6.

### Étape 6 — Validation fonctionnelle

Démarrer `.\start.ps1`. Rejouer un combat complet.

---

## Vérifications post-migration

```powershell
# Zéro handler résiduel dans l'orchestrateur
grep -c "socket.on(WS" server/src/socket/socketCombat.js
# Résultat attendu : 0

# Tous les handlers présents dans les 3 nouveaux fichiers
grep -c "socket.on(WS.COMBAT" server/src/socket/socketCombatState.js
grep -c "socket.on(WS.COMBAT" server/src/socket/socketCombatAnnouncement.js
grep -c "socket.on(WS.COMBAT" server/src/socket/socketCombatResolution.js
# Résultats attendus : 5, 3, 6 (ou valeurs proches selon REWORK-16)

# Import index.js inchangé
grep "registerCombatHandlers" server/src/socket/index.js
# Résultat attendu : exactement la même ligne qu'avant
```

---

## Validation complète

| # | Scénario | Résultat attendu |
|---|---|---|
| V1 | SR sans erreur | Aucune erreur dans les logs serveur |
| V2 | `http://localhost:3001/api/health` | 200 OK |
| V3 | COMBAT_START | Combat démarre, roster visible côté GM et PJs |
| V4 | COMBAT_ANNOUNCE_START | Phase ANNOUNCEMENT active |
| V5 | COMBAT_ACTION_DECLARE | Annonce enregistrée, timeline mise à jour |
| V6 | COMBAT_SKIP_PLAYER | Slot passé, prochain slot actif |
| V7 | COMBAT_ACTION_CONFIRM slot move | Slot avance |
| V8 | COMBAT_ACTION_CONFIRM slot melee | Precheck → fenêtre CaC → résolution |
| V9 | COMBAT_ACTION_CONFIRM slot assault PJ | Résolution assaut distance |
| V10 | COMBAT_MELEE_DEFENSE_CONFIRM | Défense résolue |
| V11 | COMBAT_DAMAGE_CONFIRM | Dégâts calculés, blessures appliquées |
| V12 | COMBAT_END | Combat terminé, état client reset |
| V13 | Reconnexion pendant RESOLUTION | STATE_SYNC → état restauré |

---

## Definition of done

- [ ] `socketCombatHelpers.js` créé — `node --check` ✓
- [ ] `socketCombatState.js` créé — `node --check` ✓ — 5 handlers
- [ ] `socketCombatAnnouncement.js` créé — `node --check` ✓ — 3 handlers
- [ ] `socketCombatResolution.js` créé — `node --check` ✓ — 6 handlers (dont PRECHECK)
- [ ] `socketCombat.js` réduit à ~35L — `node --check` ✓
- [ ] `server/src/socket/index.js` inchangé — vérification visuelle
- [ ] `grep -c "socket.on(WS" socketCombat.js` = 0
- [ ] `grep -c "^export " server/src/socket/socketCombatHelpers.js` ≥ 14 (13 fonctions + COMBAT_MODE_LABELS)
- [ ] SR ✓ — zéro erreur dans les logs
- [ ] V1–V13 validés (session combat complète avec GM + au moins 1 PJ)
- [ ] Après validation : appender `docs/JOURNAL5.md`
- [ ] Après validation : mettre à jour `docs/EN_COURS.md` (REWORK-17 ✅ clos)
- [ ] Après validation : mettre à jour `docs/ARCHI_REWORK.md` (REWORK-17 → "Reworks achevés")
- [ ] Rappeler le push Git :
```powershell
git add .
git commit -m "Session N — REWORK-17 : socketCombat.js split (State/Announcement/Resolution/Helpers)"
git push origin master
```

---

## Notes pour l'agent — protocole CLAUDE.md

- Lire `socketCombat.js` EN ENTIER avant de créer le premier fichier. Jamais de mémoire.
- Créer les fichiers dans l'ordre des étapes. Valider chaque étape avant la suivante.
- Si un symbole manque à l'import, STOP — chercher dans socketCombat.js avant d'inventer.
- Ne rien "améliorer" pendant la migration — copier exactement.
- La logique de combat est complexe (resolveMeleeAction = 491L). Ne pas y toucher.
- Si un `node --check` échoue, copier l'erreur complète avant de tenter de corriger.
- Confirmer "SR" ou "node --check OK" avec l'utilisateur avant chaque étape suivante.
