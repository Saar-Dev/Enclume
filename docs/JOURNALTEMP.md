# JOURNALTEMP — Scratch pad analytique
> Contenu périssable — ne jamais inclure dans la lecture obligatoire. Consolider vers JOURNAL5.md en fin de session.

---

## Session 117 — 2026-06-23 — Vérification PLAN_REWORK17 (audit fichier réel)

### Résultats grep socketCombat.js post-REWORK-16 (3027L)

**Handlers — lignes réelles (plan était pré-REWORK-16, ~+59L partout dans Resolution) :**
| Handler | Ligne réelle | Ligne plan |
|---|---|---|
| COMBAT_START | 80 | 80 ✓ |
| COMBAT_END | 214 | 214 ✓ |
| COMBAT_ANNOUNCE_START | 271 | 271 ✓ |
| COMBAT_INIT_STATE | 311 | 311 ✓ |
| COMBAT_SURPRISE_RESULT | 349 | 349 ✓ |
| COMBAT_ACTION_DECLARE | 436 | 436 ✓ |
| COMBAT_SKIP_PLAYER | 815 | 815 ✓ |
| COMBAT_ANNOUNCE_PREVIEW | 838 | 838 ✓ |
| **COMBAT_ACTION_PRECHECK** | **856** | "après L.850" ✓ |
| COMBAT_ACTION_CONFIRM | 920 | 856 ⚠️ décalé |
| COMBAT_DAMAGE_CONFIRM | 1035 | 976 ⚠️ décalé |
| COMBAT_MELEE_DEFENSE_CONFIRM | 1200 | 1141 ⚠️ décalé |
| COMBAT_STUN_CONFIRM | 1420 | 1361 ⚠️ décalé |
| COMBAT_APPLY_STUN | 1455 | 1396 ⚠️ décalé |

**Helpers/resolve — lignes réelles (+59L partout) :**
| Fonction | Ligne réelle | Ligne plan |
|---|---|---|
| startAnnouncementTimers | 1475 | 1416 |
| skipPlayer | 1496 | 1437 |
| startResolutionPhase | 1548 | 1489 |
| advanceSlot | 1591 | 1532 |
| endTurn | 1612 | 1553 |
| multiAdversaryMalus | 1703 | 1644 |
| countAdversaires | 1710 | 1651 |
| resolveMeleeAction | 1725 | 1666 |
| resolveReloadAction | 2217 | 2157 |
| resolveDroneAssaultAction | 2354 | 2294 |
| resolveAssaultAction | 2652 | 2594 |
| calcDroneRD | 2976 | 2918 |
| resolveDroneIntegrityLoss | 2983 | 2925 |

**⚠️ AMENDEMENT IMPORT CRITIQUE — socketCombatResolution.js :**
Le plan ne liste pas `losService` dans les imports de `socketCombatResolution.js`.
Mais `checkLOSForPrecheck` (ajouté REWORK-16) est utilisé à L.906 dans PRECHECK → Resolution.
`checkCombatLOS` (L.2406, L.2662) reste dans Helpers uniquement.
**Correction à appliquer :** ajouter dans `socketCombatResolution.js` :
```js
import { checkLOSForPrecheck } from '../lib/losService.js'
```

**Vérifications import conformes :**
- `calcAttributeNA` + `calcREA` → L.138-140 (COMBAT_START → State) ✓
- `calcSkillTotal` → L.1257 (MELEE_DEFENSE_CONFIRM → Resolution) + Helpers ✓
- `parseDice` → L.368 (SURPRISE_RESULT → State) + L.1061/1235/1349/1435 (Resolution) + Helpers ✓
- `isCaseOccupied`/`collisionMoveToken` → L.977/983 (ACTION_CONFIRM → Resolution) ✓
- `getMrTable`/`getModifier` → L.1066-67 (DAMAGE_CONFIRM → Resolution) + Helpers ✓
- `getUserColor` → à vérifier (plan dit Helpers)
- `woundService` → à vérifier (plan dit Helpers)
- `statusService` → plan dit State + Resolution — à vérifier

**Vérifications complémentaires — confirmées :**
- `registerCombatHandlers` ferme à **L.1471**. Helpers démarrent à L.1473/1475.
- `statusService` → L.249 (COMBAT_END → State ✓), L.1116/1135/1360/1378/1449/1464 (Resolution ✓), L.1661/2112/2125/2135/2572/2600/2918/2936 (Helpers ✓)
- `woundService` → L.2112 uniquement (resolveMeleeAction → Helpers ✓)
- `calcAttributeNA` → L.138-140 (State ✓) + L.1816/1967/2512/2739 (Helpers ✓) — absent de Resolution ✓

**⚠️ AMENDEMENT IMPORT 2 — socketCombatHelpers.js :**
`getUserColor` n'est utilisé qu'à L.374 (COMBAT_SURPRISE_RESULT → State).
Il est ABSENT de tous les Helpers (grep complet confirmé).
**Correction :** retirer `import { getUserColor } from '../lib/socketUtils.js'` de `socketCombatHelpers.js`.
`getUserColor` reste dans `socketCombatState.js` uniquement.

### Bilan amendements PLAN_REWORK17.md (Session 117)

| # | Amendement | Impact |
|---|---|---|
| A1 | Fichier = 3027L (pas 2969L) | Info seulement — +58L REWORK-16 |
| A2 | Lignes Resolution décalées ~+64L | Info seulement — grep à refaire avant copier-coller |
| A3 | Lignes Helpers décalées ~+59L | Info seulement — grep à refaire avant copier-coller |
| **A4** | `socketCombatResolution.js` : ajouter `import { checkLOSForPrecheck } from '../lib/losService.js'` | **BLOQUANT si absent — PRECHECK plante runtime** |
| **A5** | `socketCombatHelpers.js` : supprimer `import { getUserColor }` (dead import) | Non-bloquant mais incorrect |

---

## Session 117 — 2026-06-23 — REWORK-17 : Plan d'implémentation (Étapes 1-5)

### Lecture complète socketCombat.js confirmée — 3027L

**Splits exacts (grep 1-based) :**
- State handlers : lignes **73–431** (context destructure L.73, 5 handlers)
- Announcement handlers : lignes **432–850** (3 handlers, débute blank+comment ACTION_DECLARE)
- Resolution handlers : lignes **851–1470** (6 handlers, PRECHECK inclus, finit `  })` APPLY_STUN)
- Helpers block : lignes **1473–3024** (13 fonctions, débute comment startAnnouncementTimers)

**fetchCibleNA** : définie locale L.2503 INSIDE resolveDroneAssaultAction → NO special handling, incluse automatiquement dans la copie Helpers.

**Boundaries vérifiées :**
- L.1471 = `}` fermeture registerCombatHandlers — PAS inclus dans Helpers
- L.3024 = dernière `}` (resolveDroneIntegrityLoss) — incluse dans Helpers
- COMBAT_ANNOUNCE_PREVIEW ferme L.850, PRECHECK démarre commentaires L.852

### Commandes bash Étape 1 — socketCombatHelpers.js

```bash
{
  sed -n '1,4p' server/src/socket/socketCombat.js
  sed -n '6,9p' server/src/socket/socketCombat.js
  echo "import { checkCombatLOS } from '../lib/losService.js'"
  sed -n '11,18p' server/src/socket/socketCombat.js
  echo ""
  sed -n '20,70p' server/src/socket/socketCombat.js | sed "s/^const COMBAT_MODE_LABELS/export const COMBAT_MODE_LABELS/"
  echo ""
  sed -n '1473,3024p' server/src/socket/socketCombat.js | sed "s/^async function /export async function /;s/^function /export function /"
} > server/src/socket/socketCombatHelpers.js
node --check server/src/socket/socketCombatHelpers.js
```

### Commandes bash Étape 2 — socketCombatState.js

```bash
{
  printf 'import { WS } from '"'"'../../../shared/events.js'"'"'\nimport db from '"'"'../db/knex.js'"'"'\nimport { canTransition } from '"'"'../lib/combatFSM.js'"'"'\nimport { parseDice } from '"'"'../lib/diceParser.js'"'"'\nimport { calcAttributeNA, calcREA } from '"'"'../lib/charStats.js'"'"'\nimport { getUserColor } from '"'"'../lib/socketUtils.js'"'"'\nimport * as statusService from '"'"'../lib/statusService.js'"'"'\nimport { startAnnouncementTimers, startResolutionPhase } from '"'"'./socketCombatHelpers.js'"'"'\n\nexport function registerStateHandlers(io, socket, context, pendingMaps) {\n'
  sed -n '73,431p' server/src/socket/socketCombat.js
  echo "}"
} > server/src/socket/socketCombatState.js
node --check server/src/socket/socketCombatState.js
```

### Commandes bash Étape 3 — socketCombatAnnouncement.js

```bash
{
  printf 'import { WS } from '"'"'../../../shared/events.js'"'"'\nimport db from '"'"'../db/knex.js'"'"'\nimport { canTransition } from '"'"'../lib/combatFSM.js'"'"'\nimport { skipPlayer, startResolutionPhase } from '"'"'./socketCombatHelpers.js'"'"'\n\nexport function registerAnnouncementHandlers(io, socket, context, pendingMaps) {\n  const { campaignId, user, isGm } = context\n'
  sed -n '432,850p' server/src/socket/socketCombat.js
  echo "}"
} > server/src/socket/socketCombatAnnouncement.js
node --check server/src/socket/socketCombatAnnouncement.js
```

### Commandes bash Étape 4 — socketCombatResolution.js

```bash
{
  printf 'import { WS } from '"'"'../../../shared/events.js'"'"'\nimport db from '"'"'../db/knex.js'"'"'\nimport { canTransition, setFSMSubPhase } from '"'"'../lib/combatFSM.js'"'"'\nimport { checkLOSForPrecheck } from '"'"'../lib/losService.js'"'"'\nimport { parseDice } from '"'"'../lib/diceParser.js'"'"'\nimport { getMrTable, getModifier } from '"'"'../lib/mrTable.js'"'"'\nimport * as statusService from '"'"'../lib/statusService.js'"'"'\nimport * as damageService from '"'"'../lib/damageService.js'"'"'\nimport { calcSkillTotal } from '"'"'../lib/charStats.js'"'"'\nimport { isCaseOccupied, collisionMoveToken } from '"'"'../lib/redis.js'"'"'\nimport { LOCATION_LABELS } from '"'"'../../../shared/armorConstants.js'"'"'\nimport { SEVERITY_COLORS } from '"'"'../../../shared/woundConstants.js'"'"'\nimport {\n  advanceSlot, endTurn,\n  resolveMeleeAction, resolveReloadAction,\n  resolveDroneAssaultAction, resolveAssaultAction,\n  COMBAT_MODE_LABELS,\n} from '"'"'./socketCombatHelpers.js'"'"'\n\nexport function registerResolutionHandlers(io, socket, context, pendingMaps) {\n  const { campaignId, user, isGm } = context\n'
  sed -n '851,1470p' server/src/socket/socketCombat.js
  echo "}"
} > server/src/socket/socketCombatResolution.js
node --check server/src/socket/socketCombatResolution.js
```

### Commandes bash Étape 5 — réécriture socketCombat.js

```bash
cat > server/src/socket/socketCombat.js << 'ENDOFFILE'
import { registerStateHandlers }        from './socketCombatState.js'
import { registerAnnouncementHandlers } from './socketCombatAnnouncement.js'
import { registerResolutionHandlers }   from './socketCombatResolution.js'

export function registerCombatHandlers(io, socket, context, pendingMaps) {
  registerStateHandlers(io, socket, context, pendingMaps)
  registerAnnouncementHandlers(io, socket, context, pendingMaps)
  registerResolutionHandlers(io, socket, context, pendingMaps)
}
ENDOFFILE
node --check server/src/socket/socketCombat.js
```

---

## Session 116 suite — 2026-06-22 — Analyse architecture + REWORK-16/17

### État de la session

**Rôle de cette conversation** : chef d'orchestre — analyse, planification, specs pour agents délégués.
**Pas de code ici.** Implémentation déléguée via PLAN_REWORK16.md → autre agent.

---

### Analyse architecture système combat (complète)

#### Niveau Meta
- FSM (`combatFSM.js`) = solide, 91L, fonctions pures — niveau professionnel
- `combatStore.js` = clean, 61L
- `useCombatSocket.js` = correct, setup/teardown propre
- **PROBLÈME 1** : `socketCombat.js` monolithe 2969L — REWORK-08 a fait le déménagement, pas le rangement
- **PROBLÈME 2** : 3 canaux d'erreur incompatibles (socket.emit('error'), socket.emit(DECLARE_ERROR), io.to.emit(DECLARE_ERROR))
- **PROBLÈME 3** : Validation post-confirmation — la fenêtre UI ouvre avant check serveur

#### Niveau Fonctionnel
- Pipeline principal opérationnel (ROSTER→ANNOUNCEMENT→RESOLUTION→loop)
- RANGE1-drone : slot avance même en erreur portée (bug actif)
- LOS1-drone : return silencieux, pas de COMBAT_DECLARE_ERROR (bug actif)
- Ordre ANNOUNCEMENT non forcé (⚠️ MANUELSYSCOMBAT §2)
- current_initiative ≤ 0 non géré (⚠️ MANUELSYSCOMBAT §3)
- §6.3/6.4/6.5 non implémentés (dette V1 connue)

#### Niveau Ligne de code
- resolveMeleeAction : 491L — computation + emission mélangées
- resolveAssaultAction : 324L — idem
- resolveDroneAssaultAction : 300L — idem
- Helpers émettent socket events directement → impossible à tester unitairement, impossible à extraire
- CombatActionWindow.jsx : 1436L — prochaine candidate extraction

#### Comparaison pro (boardgame.io / Colyseus)
- Colyseus : handlers déclaratifs `messages = { ...combatHandlers }` spread de modules
- boardgame.io : typed error codes, un seul canal, erreur → requérant, état → broadcast
- **Principe clé** : computation séparée de l'émission — les helpers retournent { ok, error, result }, le handler parent émet

---

### Décisions prises

1. **REWORK-16** (bug actif) = Scénario A étendu avec Scénario B partiel
   - Pre-validation gate ACK Socket.IO natif v4
   - Fix canal d'erreur (`resolveMeleeAction` L.1699 broadcast)
   - Message rouge Sidebar
   - Spec complète dans ARCHI_REWORK.md + PLAN_REWORK16.md (en cours)

2. **REWORK-17** (architectural) = à spécifier après analyse PLAN_REWORK16
   - Split `socketCombat.js` en 4 modules
   - `combatResolveService.js` : helpers retournent { ok, error } — zéro socket.emit
   - Principes Scénario D sans changer de framework

3. **Séquence** : REWORK-16 (implémenté par agent autre conversation) → REWORK-17 (spec ici, implémenté ailleurs)

---

### Tâches en cours (cette session)

- [x] ARCHI_REWORK.md : REWORK-16 spec ajoutée
- [x] CLAUDE.md : état courant mis à jour Session 116 suite
- [x] EN_COURS.md : item 18 REWORK-16 ajouté
- [x] **FAIT** : PLAN_REWORK16.md — plan d'implémentation pour agent délégué (docs/PLAN_REWORK16.md)
- [x] **BILAN REÇU** : 4 amendements appliqués (8 logs pas 7, timeout 5s, flag cancelled, FSM guard socket.emit individuel)
- [x] **FAIT** : REWORK-17 spec (ARCHI_REWORK.md §REWORK-17 + docs/PLAN_REWORK17.md)
- [ ] LOS1-drone : micro-sprint autonome (2 lignes, L.2349 resolveDroneAssaultAction) — AVANT REWORK-17

---

### Points critiques à ne PAS perdre

**Bug L.1699** : `socket.emit(WS.COMBAT_DECLARE_ERROR, ...)` dans `resolveMeleeAction` → doit être `io.to(campaignId).emit`
**Colonnes DB** : `type` (serveur) ≠ `action_key` (client) — deux colonnes, valeurs identiques pour 'melee'
**action.id** : UUID PK (migration 54), présent dans le store en RESOLUTION (rows complètes, pas de .select())
**meleePrecheckId** : `activeMeleeAction?.id ?? playerActiveMeleeAction?.id ?? null` — stable en RESOLUTION
**socket dep** : useEffect [meleePrecheckId, socket] — re-tourne à chaque reconnexion (SocketProvider crée nouvelle instance)
**7 logs [DBG-CAC]** : à supprimer de socketCombat.js en même temps que REWORK-16
**allonge XOR** : weapon_inv_id (humanoïde) OU drone_weapon_inv_id (drone) — contrainte migration 76

