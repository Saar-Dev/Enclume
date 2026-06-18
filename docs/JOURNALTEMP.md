# JOURNALTEMP — Session 101 — Mémo REWORK-09
> 2026-06-17
> Scratch pad de session — appender progressivement. Consolider vers JOURNAL4.md en fin de session.

---

## Mission de la prochaine session

**Planifier REWORK-09** : `SessionPage.jsx` → hooks WS dédiés.
Ordre confirmé : REWORK-09 → REWORK-08 (REWORK-08 prérequis REWORK-04).

---

## Ce qui a été fait dans cette session (101)

- **REWORK-02** ✅ achevé en parallèle (damageService — par Saar, détails dans JOURNAL4.md Session 101)
- **ARCHI_REWORK.md** réorganisé : specs complètes → `ARCHI_REWORK_DONE.md`, fichier principal réduit à ~90 lignes (résumés + table prochains reworks)
- **EN_COURS.md** : DR4 + DR6 marqués ✅ Clos Session 101
- **BUGIDENTIFIE.md** : cluster I mis à jour (DR4+DR6 retirés), titres §DR4/§DR6 → ✅ CLOS Session 101
- **JOURNAL4.md** : NON appendé dans cette session (pas de code produit — session docs uniquement)

---

## Protocole début de session suivante

Appliquer le protocole complet (résumé ≠ lecture) :
1. `docs/JOURNAL4.md` — dernière session uniquement
2. `docs/ASBUILT.md`
3. `docs/EN_COURS.md`
4. Puis lire les fichiers cibles REWORK-09 (ci-dessous)

---

## Fichiers à lire pour REWORK-09

Dans cet ordre :
1. `client/src/pages/SessionPage.jsx` — identifier tous les listeners WS (`s.on(...)`) et toutes les props passées à `CombatOverlay`
2. `client/src/components/CombatOverlay.jsx` — inventaire exhaustif des props reçues

Greps utiles avant lecture :
```
grep -n "s\.on(" client/src/pages/SessionPage.jsx
grep -n "s\.off(" client/src/pages/SessionPage.jsx
grep -n "CombatOverlay" client/src/pages/SessionPage.jsx
```

---

## Ce qu'on sait déjà sur REWORK-09 (depuis ARCHI_REWORK.md)

**Problème** : 1 509 lignes. Tous les listeners WS inline dans un `useEffect` unique. 30+ props passées à `CombatOverlay`.

**Cible** : extraire en hooks dédiés :
- `useCombatSocket.js` — listeners combat (COMBAT_*)
- `useEntitySocket.js` — listeners entités/tokens
- `useTokenSocket.js` — listeners tokens spécifiques

**Format attendu de la spec** : suivre le template ARCHI_REWORK.md (Problème + État actuel + Décision + Interface cible + Périmètre + Plan + Validation + DoD).

---

## ANALYSE — SessionPage.jsx (Session 102, lu 2026-06-17)

### 1. Inventaire listeners WS (useEffect L.402–741, deps: [campaignId, reconnectTrigger, loadSession])

**Total : 47 listeners + 1 s.io.on('reconnect')**
Cleanup : `return () => s.disconnect()` — pas de `s.off()` granulaires.

| Groupe | Listeners (count) | Lignes |
|---|---|---|
| SESSION | SESSION_JOINED, SESSION_USER_JOINED, SESSION_USER_LEFT, CAMPAIGN_SETTINGS_UPDATED | 407–430 |
| TOKEN | TOKEN_MOVED, TOKEN_CREATED, TOKEN_DELETED, TOKEN_UPDATED, TOKEN_STATUS_UPDATED | 431–447 |
| CHAT/DICE | CHAT_MESSAGE, CHARACTER_UPDATED, DICE_RESULT, MACRO_ROLL_RESULT | 448–563 |
| WOUND/INVENTORY | WOUND_ADDED, WOUND_UPDATED, WOUND_REMOVED, INVENTORY_ADDED, INVENTORY_UPDATED, INVENTORY_REMOVED | 496–516 |
| COMBAT simple | COMBAT_RELOAD_RESULT, COMBAT_MELEE_DEFENSE_PROMPT, COMBAT_MELEE_RESULT, COMBAT_DAMAGE_PROMPT, COMBAT_DAMAGE_RESULT, COMBAT_STUN_PROMPT, COMBAT_ATTACK_PLAYER_RESULT, COMBAT_ATTACK_RESULT | 517–546 |
| ERROR + MAP | 'error', MAP_SWITCH (api call inline) | 566–583 |
| ENTITY | ENTITY_ACTION_PENDING, ENTITY_ACTION_RESULT, ENTITY_MOVE_RESULT | 588–636 |
| COMBAT complexe | COMBAT_STARTED, COMBAT_ENDED, COMBAT_STATE_SYNC, COMBAT_PHASE_CHANGED, COMBAT_ROSTER_UPDATED, COMBAT_SURPRISE_ROLL, COMBAT_ANNOUNCE_PREVIEW, COMBAT_ACTION_DECLARED, COMBAT_SLOT_ADVANCED, COMBAT_TURN_SKIPPED | 639–723 |
| RECONNECT | s.io.on('reconnect') → setReconnectTrigger | 730–732 |
| DOC | DOC_CREATED, DOC_UPDATED, DOC_DELETED | 735–737 |

### 2. Props CombatOverlay — inventaire complet (L.1300–1344)

**39 props** (pas 30+ comme estimé — 39 effectives).

```
socket, battlemap, isGm, user, characters, actionTimerSec, tokens,
pendingSurpriseRoll, onSurpriseRolled,
onEnterMoveMode, combatMoveMode, pendingMoveSelection, onValidateMove, onCancelPendingMove,
combatTargetMode, onEnterTargetMode, onValidateTarget,
announcementMarker, pjPreview,
damagePayload, damageResults, onDamageConfirmed,
attackResult, onAttackConfirmed,
gmAttackResult, onGmAttackResultClose,
pnjAttackResult, onPnjAttackResultClose,
reloadResult, onReloadResultClose,
meleeDefensePrompt, onMeleeDefenseConfirm ← ALERT : inline socket.emit (L.1332)
meleeResult, onMeleeResultClose,
stunPayload, onStunConfirmed,
gmSocketError, onGmSocketErrorClose,
sidebarWidth
```

**⚠ [F-R9-1] onMeleeDefenseConfirm contient un socket.emit inline (L.1332–1336)** — pas un useCallback, recréé chaque render, mais non bloquant.

### 3. Dépendances des listeners — pièges closure

**Non-stables capturées dans les closures :**
- `isGm` — dans COMBAT_ATTACK_RESULT (L.542) → routing setPnjAttackResult/setGmAttackResult selon rôle
- `user?.id` — dans MAP_SWITCH (L.572) → filtre `userIds.includes(user?.id)`
- `t` — dans 5 listeners (SESSION_USER_JOINED/LEFT, ENTITY_*, COMBAT_TURN_SKIPPED)

**Note :** `isGm` n'est PAS dans les deps du useEffect → valeur figée à la création du socket. Comportement identique dans le rework (pas de régression créée, isGm stable en session).

**Stables (store Zustand + useState setters) :** `setCombatState`, `resetCombat`, `setPhase`, `markTokenAnnounced`, `updateRoster`, `advanceSlot`, `setActions`, `addAnnouncedAction`, `resetAnnouncedActions`, `addMessage`, `updateToken`, `addToken`, `removeToken`, `upsertCharacter`, `updateCharacter`, `setWoundVersions`, `setBattlemap`, `setTokens`, `setEntities`, `clearPendingEntityId`, `addDocument`, `updateDocument`, `removeDocument`.

### 4. Pattern d'intégration retenu — `listen(s)` impératif

Les hooks exposent une fonction `listen(s)` appelée **de manière impérative** dans le `useEffect` de SessionPage, sur l'instance `s` avant `setSocket(s)`.

```js
// SessionPage useEffect (après rework)
useEffect(() => {
  const s = io(...)
  s.emit(WS.SESSION_JOIN, { campaignId })

  // Hooks dédiés — impératifs (pas dans les deps)
  combatSocket.listen(s)
  entitySocket.listen(s)
  tokenSocket.listen(s)

  // ~19 listeners simples restants inline (session/chat/dice/wound/doc/error/reconnect)

  setSocket(s)
  return () => s.disconnect()   // s.disconnect() nettoie TOUS les listeners — s.off() non nécessaire
}, [campaignId, reconnectTrigger, loadSession])
```

Pourquoi `listen` pas dans les deps ? → `listen` est une fonction ordinaire (pas useCallback) recréée à chaque render. Elle capture les setters stables. Pas besoin de stabilité — jamais utilisée comme dep.

### 5. Découpage retenu des hooks

| Hook | Listeners pris en charge | State propre | Callbacks injectés |
|---|---|---|---|
| `useCombatSocket` | 18 combat (COMBAT_*) | reloadResult, damagePayload/Results, attackResult, gmAttackResult, pnjAttackResult, meleeDefensePrompt, meleeResult, stunPayload, pendingSurpriseRoll, announcementMarker, pjPreview | `isGm`, `onModeChange`, `onCombatReset`, `onPhaseReset` |
| `useEntitySocket` | 3 entités + MAP_SWITCH | — (tout va au store ou SessionPage) | `user`, `t`, `setBattlemap`, `setTokens`, `setEntities`, `clearPendingEntityId`, `addMessage`, `setRadialMenu`, `setMoveTarget`, `addMessage` |
| `useTokenSocket` | 5 token | — (tout au tokenStore) | — |

**Listeners restant dans SessionPage : ~19** (SESSION/CHAT/DICE/WOUND/INVENTORY/DOC/ERROR/RECONNECT — tous des one-liners simples).

### 6. Analyse CombatOverlay.jsx (658 lignes, lu Session 102)

**Deux props mortes découvertes :**

**⚠ [F-R9-2] `tokens` prop — morte côté CombatOverlay**
- SessionPage L.1307 passe `tokens={tokens}`
- CombatOverlay L.20 : `tokens` n'est PAS dans le destructuring des props
- CombatOverlay L.22 : `const tokens = useTokenStore(s => s.tokens)` — lit directement depuis le store
→ La prop `tokens={tokens}` dans SessionPage est du dead code. À supprimer dans REWORK-09.

**⚠ [F-R9-3] `announcementMarker` — destructuré mais jamais utilisé dans CombatOverlay**
- Destructuré L.20, mais absent de tout JSX et appel enfant dans le fichier
- Canvas3D reçoit `announcementMarker` depuis SessionPage (correct, non touché)
→ `announcementMarker` appartient à `useCombatSocket` state. Ne pas le passer à CombatOverlay.

**CombatOverlay a ses propres listeners WS (légitimes, ne pas extraire) :**
- L.35 : `socket.on(WS.COMBAT_STUN_EXPIRED, handler)` / `socket.off` → état local `stunDialog`
- L.46 : `socket.on(WS.COMBAT_DECLARE_ERROR, handler)` / `socket.off` → état local `combatActionError`

**Découpage final des props CombatOverlay après REWORK-09 :**
- Props supprimées : `tokens` (morte), `announcementMarker` (morte) → 39 → 37 props
- Aucune autre modification CombatOverlay (hors scope)

**Périmètre final REWORK-09 :**
- Nouveaux : `client/src/lib/useCombatSocket.js`, `useEntitySocket.js`, `useTokenSocket.js` (convention : hooks dans `lib/`, pas de dossier `hooks/`)
- Modifiés : `client/src/pages/SessionPage.jsx` (listeners extraits + 2 dead props CombatOverlay nettoyées)
- Modifiés : `client/src/components/CombatOverlay.jsx` — 1 ligne : retirer `announcementMarker` du destructuring props L.20
- NON touchés : tous les stores, serveur
