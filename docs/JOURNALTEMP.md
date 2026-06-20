# JOURNALTEMP — Session 110 (2026-06-20) — REWORK-04 Planning + Audit C3
> Scratch pad analytique — périssable. Consolider vers JOURNAL5.md en fin de session.

---

## Fichiers lus cette session

- `docs/ARCHI_REWORK.md` — bible reworks (REWORK-04 = FSM Combat, long terme)
- `docs/EN_COURS.md` — prochaine étape = REWORK-04, spec avant tout code
- `docs/ASBUILT.md` — architecture complète projet
- `server/src/socket/socketCombat.js` — 2824 lignes, lu en entier
- `client/src/stores/combatStore.js` — 56 lignes
- `shared/events.js` — 30+ COMBAT_* events
- Recherche web : XState v5, FSM game servers, persistent state patterns

---

## FSM implicite actuelle (socketCombat.js)

```
ROSTER → ANNOUNCEMENT → RESOLUTION → (ANNOUNCEMENT tour N+1) → ...
```

Sous-états RESOLUTION (in-memory uniquement) :
- `SLOT_ACTIVE` — slot libre, attend COMBAT_ACTION_CONFIRM
- `AWAITING_DEFENSE` → `pendingMeleeDefense` Map
- `AWAITING_DAMAGE`  → `pendingDamageActions` Map
- `AWAITING_STUN`    → `pendingStunActions` Map (non-bloquant)

pendingMaps déclarées dans `index.js`, passées à `registerCombatHandlers()`.

---

## Problèmes identifiés (lus dans le code)

**P1 — Split-brain RESOLUTION** (dette active)
`COMBAT_STATE_SYNC` existe dans events.js mais ne restaure PAS le pending state.
Joueur reconnecte pendant slot bloqué (défense/dégâts) → combat figé.

**P2 — Guards dispersés**
`if (phase !== 'ANNOUNCEMENT') return` dupliqué dans chaque handler. Aucune source de vérité.

**P3 — Sous-états invisibles**
DB `combat_state.phase = 'RESOLUTION'` que le slot soit libre ou bloqué.
`combatStore` client ignore AWAITING_DEFENSE / AWAITING_DAMAGE.

**P4 — Handlers qui savent trop**
`COMBAT_MELEE_DEFENSE_CONFIRM` gère : résolution opposition + dégâts + advanceSlot + multi-melee.

---

## Décision architecturale (recherche pro)

**XState écarté** — dépendance externe, restructuration complète, overkill single-server Raspberry Pi.

**Architecture retenue : FSM custom module + DB persistence**
(pattern pro unanime : "server authority, serializable state, restore on reconnect")

---

## Segmentation REWORK-04 (3 paliers)

### Palier 04-A — `combatFSM.js` (fonctions pures, zéro I/O)

Nouveau fichier : `server/src/lib/combatFSM.js`

```
canTransition(phase, subPhase, event, context) → bool
nextState(phase, subPhase, event) → { phase, subPhase }
```

États explicites :
```
null          null               Pas de combat
ROSTER        null               après COMBAT_START
ANNOUNCEMENT  null               après COMBAT_ANNOUNCE_START
ANNOUNCEMENT  AWAITING_SURPRISE  joueur surpris non résolu
RESOLUTION    SLOT_ACTIVE        slot libre
RESOLUTION    AWAITING_DEFENSE   PJ défenseur → COMBAT_MELEE_DEFENSE_CONFIRM
RESOLUTION    AWAITING_DAMAGE    PJ tireur → COMBAT_DAMAGE_CONFIRM
RESOLUTION    AWAITING_STUN      prompt D6 (non-bloquant)
```

socketCombat.js : `combatFSM.canTransition()` injecté en guard. Logique résolution intouchée.

### Palier 04-B — Migration `combat_pending` (remplace Maps in-memory)

```sql
combat_pending (
  campaign_id  UUID
  token_id     UUID
  type         TEXT CHECK ('melee_defense','damage','stun')
  payload      JSONB
  created_at   TIMESTAMPTZ
  PRIMARY KEY (campaign_id, token_id)
)
```

Remplace : `pendingMeleeDefense` + `pendingDamageActions` + `pendingStunActions`
`pendingMaps.combatTimers` et `combatPreviews` : restent en mémoire (intentionnel).

### Palier 04-C — Fix `COMBAT_STATE_SYNC` reconnexion RESOLUTION

```
SESSION_JOIN → phase=RESOLUTION ?
  → SELECT * FROM combat_pending WHERE campaign_id AND token_id = user's token
  → réémettre prompt ciblé (COMBAT_MELEE_DEFENSE_PROMPT / COMBAT_DAMAGE_PROMPT / COMBAT_STUN_PROMPT)
  → broadcast COMBAT_STATE_SYNC avec { phase, subPhase, activeSlotIdx, actions }
```

---

## Ce qui NE change PAS

- `socketCombat.js` : 13 handlers conservés — injection guard uniquement
- `shared/events.js` : aucun nouvel event
- `combatStore.js` : reçoit `subPhase` dans COMBAT_PHASE_CHANGED (ajout champ)
- Toute la logique résolution (assault/melee/reload/drones) : intouchée
- `useCombatSocket.js` : modifications mineures (sub-state dans setCombatState)

---

## État spec REWORK-04 — Session 110

Spec validée et affinée. Tous les amendements appliqués dans `docs/ARCHI_REWORK.md`.

### Gaps résolus cette session

**[R4-1] melee_defense + PNJ → FAUX POSITIF clos**
`resolveMeleeAction` L.1874 : PNJ = auto-résolution, jamais de `COMBAT_MELEE_DEFENSE_PROMPT`.
`combat_pending type=melee_defense` = PJ défenseurs uniquement (user_id non-null). C3 lookup correct.

**[R4-2] damage distance + cible → RÉSOLU**
`COMBAT_DAMAGE_CONFIRM` L.924 : clé lookup = token attaquant (impossible à changer sans toucher client).
Fix : double lookup C3 — `WHERE payload->>'targetUserId' = user.id` (targetUserId déjà en L.2451).
Prompt reconstruit : `{ tokenId: row.token_id, formula: row.payload.formula, targetName: row.payload.targetName }`.
⚠️ `combat_pending.payload` = objet résolution complet ≠ prompt client → C3 reconstruit chaque type.

**[R4-3] stun + shock_auto_stun=false + GM → DOCUMENTÉ mineur**
`statusService.js` L.127-134. Non-bloquant, cas non-défaut. Acceptable.

### Autres amendements appliqués

- GAP-4 : race condition B3/B4 non-exploitable (guard bloque AWAITING_DEFENSE)
- GAP-2 : palier 04-C atomique (C1+C2+C3+C4 en même déploiement)
- GAP-3 : grep COMBAT_STATE_SYNC obligatoire avant C4 → JOURNALTEMP
- GAP-5 : rollback hors périmètre (Polaris pas de previousTurn)

### Fichiers lus session 110

- `docs/ARCHI_REWORK.md` — spec REWORK-04 complète
- `server/src/socket/socketCombat.js` L.1586–2071 (`resolveMeleeAction`)
- `server/src/socket/socketCombat.js` L.923–987 (`COMBAT_DAMAGE_CONFIRM`)
- `server/src/socket/socketCombat.js` L.1190–1220, L.2420–2466 (sites DAMAGE_PROMPT)
- `server/src/lib/statusService.js` L.70–146 (`applyStun`)
- `server/src/db/migrations/20260331_15_characters.js` — `user_id nullable` confirmé

### État final Session 110 — spec REWORK-04 complète

**C3 finalisée (Session 110, 2e partie) :**
Code block C3 réécrit dans ARCHI_REWORK.md avec :
- Lookup 1 : `SELECT * FROM combat_pending WHERE campaign_id AND token_id = userTokenId` → itération sur toutes les lignes → reconstruction prompt type par type
  - `melee_defense` : shape lue socketCombat.js L.2049 + commonPending L.1842
  - `damage` CaC/assaut PJ standard : `{ tokenId, formula, targetName }` — L.1210, L.2670
  - `stun` : `{ tokenId, outcome }` — statusService.js L.114
- Lookup 2 : `WHERE type='damage' AND payload->>'targetUserId' = user.id` → drone assault uniquement
  - [R4-2] précisé : uniquement `resolveDroneAssaultAction` (L.2437) émet le prompt à la cible. Assaut PJ standard (L.2652) émet à l'attaquant → Lookup 1.
  - `targetUserId` stocké uniquement dans drone assault payload (L.2451), pas dans assaut PJ standard.

**Fichiers lus Session 110 (2e partie) :**
- `socketCombat.js` L.1180–1230 (CaC damage prompt + payload shape)
- `socketCombat.js` L.2020–2070 (melee_defense pending + commonPending)
- `socketCombat.js` L.1842–1871 (commonPending definition — 24 champs)
- `socketCombat.js` L.2420–2466 (drone assault damage prompt + payload)
- `socketCombat.js` L.2640–2680 (assaut PJ standard — confirme pas de targetUserId)

**Grep COMBAT_STATE_SYNC — fait Session 110 (2e partie) :**
```
server/src/socket/index.js:109  socket.emit(WS.COMBAT_STATE_SYNC, { combatState: activeCombat, roster, actions })
```
**1 seul site.** `activeCombat = db('combat_state').first()` = row DB entière → après migration B2, `sub_phase` dans `combatState.sub_phase` automatiquement. C4 serveur = no-op. C2 lit `combatState.sub_phase ?? null`.

**useCombatSocket.js L.69–88 lu :**
Handler existant : `setCombatState({ phase, roster, actions, currentTurn, activeSlotIdx, activeTokenId })` — pas de `subPhase`. C2 ajoute `subPhase: combatState.sub_phase ?? null`.

**Spec ARCHI_REWORK.md complète — prête pour implémentation.**
Ordre : A1 → B1 → B2 → A2 → B3 → B4 → B5 → B6 → C1 → C2 → C3 → C4(no-op serveur).

⚠️ Lire `docs/REGLESYSCOMBAT.md` avant tout code combat (rule combat.md).
