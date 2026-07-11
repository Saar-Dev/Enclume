# PLAN_MOVE.md — Bug COM21 : Feedback déplacement bloqué
> Rédigé Session 127 — 2026-06-26

---

## Contexte

**Bug COM21** : En phase RÉSOLUTION, deux tokens ont déclaré un déplacement vers la même case.
Le token avec l'initiative la plus haute bouge en premier. Le second est bloqué (case occupée) mais
ne reçoit aucun feedback. Son slot s'avance normalement, son token reste en place sans explication.

**Cause racine [VÉRIFIÉ]** :
```js
// socketCombatResolution.js L.213–230
const occupied = await isCaseOccupied(token.battlemap_id, tx, ty, tz + 1, [tokenId])
if (!occupied) {
  // → déplace + TOKEN_MOVED broadcast ✅
} else {
  console.log(`[WS] COMBAT_ACTION_CONFIRM — déplacement bloqué (case occupée) token:${tokenId}`)
  // ← aucun WS envoyé → silence client ❌
}
```

La collision map Redis (`isCaseOccupied`) fait son travail. Le rejet est correct.
Ce qui manque : notifier le client du rejet.

---

## Architecture choisie

**Option B** (choisie par Saar) — Nouvel event `COMBAT_RESOLVE_MOVE_BLOCKED` dédié.

Pourquoi pas Option A (réutiliser `COMBAT_DECLARE_ERROR`) :
- `COMBAT_DECLARE_ERROR` = "erreur de validation déclaration (ex: hors portée)" — phase ANNONCE
- Réutiliser pour une erreur de RÉSOLUTION = couplage sémantique incorrect
- L.190 du même handler le fait pour le stun (dette reconnue, pas une référence)

**Précédent dans le code** (pattern à reproduire exactement) :
- `COMBAT_RELOAD_RESULT` = event dédié rechargement → handler → addMessage → Sidebar
- `COMBAT_MELEE_RESULT` = event dédié CaC → handler → addMessage → Sidebar

---

## Fichiers touchés — 4 fichiers, 4 étapes séquentielles

```
shared/events.js                        (+1 constante)
server/src/socket/socketCombatResolution.js  (+3 lignes dans else existant)
client/src/lib/useCombatSocket.js       (+1 handler + on/off)
client/src/components/Sidebar.jsx       (+1 bloc rendu)
```

---

## Étape 1 — `shared/events.js`

**Insertion après L.106** (`COMBAT_DECLARE_ERROR`) :

```js
  COMBAT_DECLARE_ERROR:          'combat:declare_error',           // serveur → socket : erreur de validation déclaration (ex: hors portée)
  COMBAT_RESOLVE_MOVE_BLOCKED:   'combat:resolve_move_blocked',    // serveur → socket : déplacement refusé en résolution (case occupée)
```

**Ce qui ne change pas** : tous les autres events.

---

## Étape 2 — `server/src/socket/socketCombatResolution.js`

**Dans le bloc `else` L.228–230**, ajouter après le `console.log` existant :

```js
} else {
  console.log(`[WS] COMBAT_ACTION_CONFIRM — déplacement bloqué (case occupée) token:${tokenId}`)
  socket.emit(WS.COMBAT_RESOLVE_MOVE_BLOCKED, { tokenLabel: token.label })
}
```

**Payload** : `{ tokenLabel: token.label }` — `token` déjà disponible (L.159 `db('tokens').where({ id: tokenId }).first()`).

**Émetteur** : `socket.emit` (pas broadcast room) — cohérent avec `COMBAT_DECLARE_ERROR`.
Seul l'émetteur du `COMBAT_ACTION_CONFIRM` reçoit le message :
- Joueur confirme son propre slot → joueur reçoit ✅
- GM confirme pour PNJ/drone GM-managed → GM reçoit ✅
- Joueur confirme pour drone (user_id = lui) → joueur reçoit ✅ (guard L.170–172)

**`WS` déjà importé** : L.1 `import { WS } from '../../../shared/events.js'` ✅

**Ce qui ne change pas** : tout le reste du handler.

---

## Étape 3 — `client/src/lib/useCombatSocket.js`

**3a. Ajouter handler** après `onDeclareError` (L.128) :

```js
    const onResolveMoveBlocked = ({ tokenLabel }) => {
      addMessage({
        id: `combat-move-blocked-${Date.now()}`,
        type: 'resolve_move_blocked',
        text: 'Déplacement bloqué — case déjà occupée',
        username: tokenLabel,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      })
    }
```

**3b. Enregistrer** après `socket.on(WS.COMBAT_DECLARE_ERROR, onDeclareError)` (L.148) :

```js
    socket.on(WS.COMBAT_RESOLVE_MOVE_BLOCKED, onResolveMoveBlocked)
```

**3c. Désenregistrer** après `socket.off(WS.COMBAT_DECLARE_ERROR, onDeclareError)` (L.169) :

```js
      socket.off(WS.COMBAT_RESOLVE_MOVE_BLOCKED, onResolveMoveBlocked)
```

**`addMessage` déjà disponible** : `const { addMessage } = useSessionStore()` (L.13) ✅

**Ce qui ne change pas** : tous les autres handlers, deps array `[socket, isGm, setMode, onModeReset]`.

---

## Étape 4 — `client/src/components/Sidebar.jsx`

**Insertion après le bloc `declare_error` (L.1086), avant `msg.type === 'dice'` (L.1087)** :

```jsx
                if (msg.type === 'resolve_move_blocked') {
                  return (
                    <div key={msg.id} style={{ ...styles.messageDice, background: 'rgba(224,92,92,0.07)', border: '1px solid rgba(224,92,92,0.2)' }}>
                      <div style={styles.diceHeader}>
                        <span style={{ ...styles.diceIcon, color: '#c05050' }}>⊗</span>
                        {msg.username && <span style={{ ...styles.msgUser, color: '#c05050' }}>{msg.username}</span>}
                        <span style={styles.msgTime}>{msg.username ? ` · ${msg.time}` : msg.time}</span>
                      </div>
                      <div style={{ paddingLeft: '2px', fontSize: 12, color: '#c0c0d0' }}>{msg.text}</div>
                      <div style={{ paddingLeft: '2px' }}>
                        <span className="badge badge-fail">BLOQUÉ</span>
                      </div>
                    </div>
                  )
                }
```

**Styles réutilisés** : `styles.messageDice`, `styles.diceHeader`, `styles.diceIcon`, `styles.msgUser`,
`styles.msgTime` — déjà utilisés par `declare_error` dans le même composant ✅

**Ce qui ne change pas** : le bloc `declare_error`, le bloc `dice`, tout le reste.

---

## Ce qui NE change pas

- Redis collision map (`isCaseOccupied`) — inchangée
- `COMBAT_DECLARE_ERROR` et son handler — inchangés
- Logique de résolution des actions — inchangée
- `advanceSlot` après le bloc `else` — inchangé (le slot avance même si bloqué — comportement voulu)

---

## Scénario de test

1. SR
2. Session combat — ANNONCE : deux tokens déclarent `move_short` vers la même case
3. RÉSOLUTION : confirmer le slot du token prioritaire → `TOKEN_MOVED` ✅
4. Confirmer le slot du token bloqué → token ne bouge pas
5. **Résultat attendu** : message rouge dans Sidebar "⊗ [nom token] · Déplacement bloqué — case déjà occupée" + badge BLOQUÉ
6. **Non testé** : cas drone GM-managed (pas de session dédiée)

---

## Note architecture

Le `advanceSlot` s'exécute après le bloc `else` (code non modifié L.243+).
Le slot avance même si le déplacement est bloqué — comportement voulu : le tour du token
est consommé même s'il n'a pas pu bouger (règle générale des systèmes tactiques).
