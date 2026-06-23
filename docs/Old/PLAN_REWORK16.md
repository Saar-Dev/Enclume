# PLAN_REWORK16.md — Combat Pre-validation Gate
> Rédigé Session 116 — 2026-06-22
> Ce plan est destiné à un agent d'implémentation dans une conversation séparée.
> L'agent doit lire ce document EN ENTIER avant de toucher un seul fichier.

---

## Contexte — pourquoi ce rework existe

**Problème** : La fenêtre de modificateurs CaC (`CombatCacModifiersWindow`) s'ouvre côté client sur la seule base de l'état Zustand. Le check de portée ne s'exécute qu'après confirmation (`COMBAT_ACTION_CONFIRM`), trop tard. Conséquences :
1. La fenêtre s'ouvre même si le combattant est hors portée
2. Le slot **avance quand même** même si la validation échoue (bug RANGE1-drone)
3. Le message d'erreur est invisible (gris, `#4a4a60`) et parfois non broadcasté

**Solution** : Socket.IO ACK natif v4. Avant d'ouvrir la fenêtre, le client émet `COMBAT_ACTION_PRECHECK` avec un callback. Le serveur valide (FSM + portée) et répond `{ ok: true/false }`. La fenêtre n'ouvre que sur `ok === true`. Le serveur broadcaste `COMBAT_DECLARE_ERROR` si rejeté.

**Ce rework ne touche pas** : la logique de `CombatCacModifiersWindow`, les guards dans `COMBAT_ACTION_CONFIRM` (ils restent — défense en profondeur), les fenêtres d'assaut distance, `combatStore.js`, `combatFSM.js`.

**LOS1-drone (L.2349) : hors périmètre** — ne PAS ajouter de COMBAT_DECLARE_ERROR pour le LOS dans ce rework. On supprime juste le log [DBG-CAC] à cette ligne.

---

## Fichiers à lire AVANT de coder

Lire dans cet ordre, sans exception :

1. **`shared/events.js`** — vérifier que `COMBAT_ACTION_PRECHECK` n'existe pas encore
2. **`server/src/socket/socketCombat.js`** — sections suivantes :
   - L.838–855 : fin de `COMBAT_ANNOUNCE_PREVIEW` → c'est ici qu'on insère le nouveau handler
   - L.856–900 : début de `COMBAT_ACTION_CONFIRM` — comprendre les guards existants (NE PAS modifier)
   - L.1666–1703 : début de `resolveMeleeAction` — voir le bug L.1699 (`socket.emit` → doit être `io.to`)
   - L.2322–2358 : `resolveDroneAssaultAction` — range check drone (déjà `io.to` — NE PAS modifier) + LOS return silencieux L.2349
   - Grep pour `[DBG-CAC]` — exactement 8 occurrences à supprimer
3. **`client/src/components/CombatOverlay.jsx`** — sections :
   - L.1–60 : imports + dérivations `activeMeleeAction`, `playerActiveMeleeAction`
   - L.160–180 : conditions d'ouverture `CombatCacModifiersWindow` (GM L.162, PJ L.171)
4. **`client/src/lib/useCombatSocket.js`** — L.114–121 : `onDeclareError` — voir le `error: true` manquant
5. **`client/src/components/Sidebar.jsx`** — chercher `msgSystemText` dans les styles — voir la couleur grise

---

## Pièges critiques

**PIÈGE 1 — colonnes DB `type` vs `action_key`**
`combat_actions` a DEUX colonnes distinctes :
- `type` : utilisé côté serveur (ex: `actions.filter(a => a.type !== 'melee')` L.907)
- `action_key` : utilisé côté client (ex: `actions.find(a => a.action_key === 'melee')`)
Dans le handler PRECHECK, utiliser `type: 'melee'` (cohérent avec le serveur existant). Ne pas utiliser `action_key`.

**PIÈGE 2 — allonge XOR**
`weapon_inv_id` (humanoïde) et `drone_weapon_inv_id` (drone) sont exclusifs (contrainte migration 76).
Dans le handler PRECHECK, tester d'abord `action.weapon_inv_id`, puis `action.drone_weapon_inv_id`. Jamais les deux.

**PIÈGE 3 — `action.id` dans le store**
`pendingActions` sont envoyés via `COMBAT_PHASE_CHANGED` sans `.select()` → rows DB complètes → `id` UUID PK inclus. Valide comme dépendance `useEffect`.

**PIÈGE 4 — `socket` dans les deps du useEffect**
Le `socket` change à chaque reconnexion (SocketProvider crée une nouvelle instance). C'est voulu : le precheck doit se relancer après reconnexion. Inclure `socket` dans le dep array de `useEffect`.

**PIÈGE 5 — ne PAS supprimer les guards dans `COMBAT_ACTION_CONFIRM`**
Les guards existants (FSM, slot, ownership) dans `COMBAT_ACTION_CONFIRM` restent intacts. Le PRECHECK est une porte supplémentaire, pas un remplacement.

**PIÈGE 6 — LOS1-drone hors périmètre**
Le `return` silencieux à L.2349 (`if (los.result === 'blocked') return`) est un bug connu (LOS1-drone). Dans ce rework, on supprime UNIQUEMENT le `console.log([DBG-CAC])` à cette ligne. On n'ajoute PAS de `io.to(campaignId).emit(COMBAT_DECLARE_ERROR)` ici.

**PIÈGE 7 — Pas de garde d'ownership dans le handler PRECHECK (risque accepté)**
Le handler `COMBAT_ACTION_PRECHECK` ne vérifie pas que le `tokenId` reçu appartient bien au socket émetteur. N'importe quel client connecté à la campagne peut envoyer un PRECHECK avec n'importe quel `tokenId`. Si ce token est hors portée de sa cible, un `COMBAT_DECLARE_ERROR` est broadcasté à toute la room.
**Risque accepté** : VTT privé, 4–8 joueurs de confiance. Un client bugué ou reconnecté au mauvais moment peut générer un faux message d'erreur rouge. Pas de corruption de données. La garde d'ownership reste dans `COMBAT_ACTION_CONFIRM` (défense en profondeur). Ne PAS ajouter une garde d'ownership dans ce rework — hors périmètre.

---

## Étape 0 — Fix atomique L.1699 `socket.emit` → `io.to`

**Fichier** : `server/src/socket/socketCombat.js`

**Localisation** : L.1697–1703 dans `resolveMeleeAction`

**Avant** :
```js
    if (dist2dChk > 3 + allonge) {
      console.warn(`[WS] resolveMeleeAction — hors portée: ${dist2dChk.toFixed(1)}m max:${3 + allonge}m token:${action.token_id}`)
      socket.emit(WS.COMBAT_DECLARE_ERROR, {
        message: `Corps à corps impossible — distance : ${dist2dChk.toFixed(1)}m, portée max : ${3 + allonge}m`,
      })
      return false
    }
```

**Après** :
```js
    if (dist2dChk > 3 + allonge) {
      console.warn(`[WS] resolveMeleeAction — hors portée: ${dist2dChk.toFixed(1)}m max:${3 + allonge}m token:${action.token_id}`)
      io.to(campaignId).emit(WS.COMBAT_DECLARE_ERROR, {
        message: `Corps à corps impossible — distance : ${dist2dChk.toFixed(1)}m, portée max : ${3 + allonge}m`,
      })
      return false
    }
```

Changement : `socket.emit` → `io.to(campaignId).emit`. Une seule ligne.

**Run à vide** : `node --check server/src/socket/socketCombat.js` + SR (serveur redémarré sans erreur). Confirmer "SR" avant de passer à Étape 1.

---

## Étape 1 — `shared/events.js` + handler ACK serveur + cleanup logs

### 1a — `shared/events.js`

**Fichier** : `shared/events.js`

Ajouter après `COMBAT_ANNOUNCE_PREVIEW` (chercher cette ligne dans le fichier) :

```js
  COMBAT_ACTION_PRECHECK: 'combat:action_precheck',   // client → serveur (ACK) : { tokenId, actionKey } → callback({ ok })
```

### 1b — `server/src/socket/socketCombat.js` — nouveau handler ACK

**Position** : entre la fin de `COMBAT_ANNOUNCE_PREVIEW` (L.850, ligne `})`) et le commentaire de `COMBAT_ACTION_CONFIRM` (L.852).

Insérer ce bloc complet entre L.850 et L.852 :

```js
  // ─── COMBAT_ACTION_PRECHECK — Pre-validation gate (ACK Socket.IO v4) ─────
  // Émis par le client AVANT d'ouvrir CombatCacModifiersWindow.
  // Valide : FSM state + portée CaC. Répond { ok: boolean } via ACK natif.
  // Si !ok : broadcaste COMBAT_DECLARE_ERROR avant callback.
  socket.on(WS.COMBAT_ACTION_PRECHECK, async ({ tokenId, actionKey }, callback) => {
    try {
      // 1. FSM guard — socket.emit (pas io.to) : erreur de contexte individuel, pas un état partagé.
      // Si un joueur reconnecté envoie PRECHECK hors RESOLUTION, le reste de la room ne doit pas recevoir l'erreur.
      const state = await db('combat_state').where({ campaign_id: campaignId }).first()
      if (!canTransition(state?.phase ?? null, state?.sub_phase ?? null, 'COMBAT_ACTION_CONFIRM')) {
        socket.emit(WS.COMBAT_DECLARE_ERROR, { message: 'Action non autorisée dans cet état de combat' })
        return callback({ ok: false })
      }
      // 2. Range check CaC — colonne 'type' (cohérent L.907 serveur)
      if (actionKey === 'melee') {
        const action = await db('combat_actions')
          .where({ campaign_id: campaignId, token_id: tokenId, type: 'melee', status: 'pending' })
          .first()
        if (action?.target_token_id) {
          // allonge XOR : weapon_inv_id (humanoïde) ou drone_weapon_inv_id (drone) — contrainte migration 76
          let allonge = 0
          if (action.weapon_inv_id) {
            const w = await db('char_inventory')
              .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
              .where({ 'char_inventory.id': action.weapon_inv_id })
              .select('ref_equipment.range as ref_range')
              .first()
            allonge = parseInt(w?.ref_range) || 0
          } else if (action.drone_weapon_inv_id) {
            const w = await db('drone_weapons')
              .leftJoin('ref_equipment', 'drone_weapons.equipment_id', 'ref_equipment.id')
              .where({ 'drone_weapons.id': action.drone_weapon_inv_id })
              .select('ref_equipment.range as ref_range')
              .first()
            allonge = parseInt(w?.ref_range) || 0
          }
          const [myPos, targetPos] = await Promise.all([
            db('tokens').where({ id: tokenId }).select('pos_x', 'pos_y').first(),
            db('tokens').where({ id: action.target_token_id }).select('pos_x', 'pos_y').first(),
          ])
          const dx = (myPos?.pos_x ?? 0) - (targetPos?.pos_x ?? 0)
          const dz = (myPos?.pos_y ?? 0) - (targetPos?.pos_y ?? 0)
          const dist = Math.sqrt(dx * dx + dz * dz)
          if (dist > 3 + allonge) {
            io.to(campaignId).emit(WS.COMBAT_DECLARE_ERROR, {
              message: `Corps à corps impossible — distance : ${dist.toFixed(1)}m, portée max : ${3 + allonge}m`,
            })
            return callback({ ok: false })
          }
        }
      }
      callback({ ok: true })
    } catch (err) {
      console.error('[WS] COMBAT_ACTION_PRECHECK erreur:', err)
      callback({ ok: false })
    }
  })

```

### 1c — `server/src/socket/socketCombat.js` — suppression des 8 logs [DBG-CAC]

⚠️ **Les numéros de lignes ci-dessous sont valides avant l'insertion de l'Étape 1b.** Après insertion du handler ACK (~56 lignes), toutes les lignes après L.850 sont décalées de +56. Ne pas utiliser ces numéros après l'insertion — utiliser **grep uniquement** pour localiser les occurrences.

Grep `[DBG-CAC]` dans le fichier. Exactement 8 occurrences aux lignes suivantes (vérifier avec grep avant de supprimer) :

| Ligne approx. | Contenu à supprimer (ligne entière) |
|---|---|
| L.866 | `console.log(\`[DBG-CAC] return@phase...`)` |
| L.878 | `console.log(\`[DBG-CAC] return@slot...`)` |
| L.885 | `console.log(\`[DBG-CAC] return@token...`)` |
| L.889 | `console.log(\`[DBG-CAC] return@char_id...`)` |
| L.894 | `console.log(\`[DBG-CAC] return@character...`)` |
| L.2324 | `console.log(\`[DBG-CAC] resolveDroneAssaultAction...`)` |
| L.2337 | `console.log(\`[DBG-CAC] range check REJETÉ...`)` |
| L.2349 | `console.log(\`[DBG-CAC] LOS bloquée...`)` ← UNIQUEMENT ce log, ne PAS toucher le `return` à L.2350 |

⚠️ Supprimer UNIQUEMENT la ligne `console.log`. Ne pas toucher le `return` ni le code environnant.

**Run à vide** : `node --check server/src/socket/socketCombat.js` + SR. Confirmer "SR" avant Étape 2.

---

## Étape 2 — `CombatOverlay.jsx` : gate precheckOk

**Fichier** : `client/src/components/CombatOverlay.jsx`

### 2a — Imports — rien à ajouter

- `import { WS }` : déjà présent L.2 ✅
- `import { useSocket }` : **ne pas ajouter** — `socket` est une prop (voir L.18, confirmé à la lecture)

### 2b — Ajouter les états et l'effet de pre-validation

Lire l'en-tête de la fonction (L.18 environ) pour localiser les `useState` existants (`showGmPanel`, `stunDialog`, `stunDialogDuration`).

Ajouter APRÈS les `useState` existants et APRÈS les dérivations `activeMeleeAction` / `playerActiveMeleeAction` (L.44–58), AVANT le `return (` :

```js
  // Pre-validation CaC — REWORK-16
  const meleePrecheckId = activeMeleeAction?.id ?? playerActiveMeleeAction?.id ?? null
  const [precheckOk, setPrecheckOk] = useState(null) // null=en attente | true=ok | false=rejeté

  useEffect(() => {
    setPrecheckOk(null)
    if (!meleePrecheckId || !socket) return
    let cancelled = false
    const tokenId = activeMeleeAction?.token_id ?? playerActiveMeleeAction?.token_id
    socket.timeout(5000).emit(WS.COMBAT_ACTION_PRECHECK, { tokenId, actionKey: 'melee' }, (err, { ok } = {}) => {
      if (cancelled) return
      setPrecheckOk(err ? false : (ok ?? false))
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meleePrecheckId, socket])
```

**⚠️ Warning lint attendu** : `activeMeleeAction` et `playerActiveMeleeAction` sont lus dans l'effet mais absents des deps. Ce n'est pas un bug : `meleePrecheckId = activeMeleeAction?.id ?? playerActiveMeleeAction?.id` — quand ces actions changent, `meleePrecheckId` change et l'effet re-tourne. Ne pas ajouter ces variables aux deps (les objets sont reconstruits à chaque rendu → boucle infinie). Le `eslint-disable-next-line` documente ce choix intentionnel.

**Deux autres ajouts par rapport à la version initiale :**
- `socket.timeout(5000)` : si le serveur ne répond pas (déconnexion, crash), l'ACK expire après 5s avec `err` non null → `setPrecheckOk(false)` au lieu de rester bloqué à `null`. Comportement fail-closed : la fenêtre n'ouvre pas, les guards de `COMBAT_ACTION_CONFIRM` restent le dernier filet.
- Flag `cancelled` + cleanup `return () => { cancelled = true }` : si le slot change rapidement (V7), l'ACK en vol du slot précédent est ignoré — pas de mise à jour stale de `precheckOk`.

### 2c — Ajouter `&& precheckOk === true` sur les conditions des fenêtres CaC

**Condition GM** (chercher dans le fichier : `activeMeleeAction && gmActiveCharacter?.type !== 'pj'`) :

Avant :
```jsx
      {isGm && phase === 'RESOLUTION' && activeMeleeAction && gmActiveCharacter?.type !== 'pj' && (
        <CombatCacModifiersWindow
```

Après :
```jsx
      {isGm && phase === 'RESOLUTION' && activeMeleeAction && gmActiveCharacter?.type !== 'pj' && precheckOk === true && (
        <CombatCacModifiersWindow
```

**Condition PJ** (chercher dans le fichier : `playerActiveMeleeAction && (`) :

Avant :
```jsx
      {!isGm && phase === 'RESOLUTION' && playerActiveMeleeAction && (
        <CombatCacModifiersWindow
```

Après :
```jsx
      {!isGm && phase === 'RESOLUTION' && playerActiveMeleeAction && precheckOk === true && (
        <CombatCacModifiersWindow
```

**Run à vide** : `npm run build` depuis `Enclume/client/`. Confirmer build ✅ avant Étape 3.

---

## Étape 3 — Message d'erreur rouge

### 3a — `client/src/lib/useCombatSocket.js`

**Localisation** : chercher `onDeclareError` dans le fichier.

Avant :
```js
    const onDeclareError = ({ message }) => {
      addMessage({
        id: `combat-error-${Date.now()}`,
        system: true,
        text: `⚠ ${message}`,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      })
    }
```

Après :
```js
    const onDeclareError = ({ message }) => {
      addMessage({
        id: `combat-error-${Date.now()}`,
        system: true,
        error: true,
        text: `⚠ ${message}`,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      })
    }
```

Changement : ajout de `error: true,` sur une nouvelle ligne.

### 3b — `client/src/components/Sidebar.jsx`

**Étape 3b-1** : Trouver le rendu des messages système.

Chercher dans le fichier : `msg.system` pour trouver la condition de rendu. Il y aura une ligne du type :
```jsx
<span style={styles.msgSystemText}>{msg.text}</span>
```

Remplacer par :
```jsx
<span style={msg.error ? styles.msgSystemErrorText : styles.msgSystemText}>{msg.text}</span>
```

**Étape 3b-2** : Ajouter le style `msgSystemErrorText`.

Chercher `msgSystemText:` dans le fichier (dans l'objet `styles`). Ajouter APRÈS l'entrée `msgSystemText` :

```js
    msgSystemErrorText: {
      fontSize: '11px',
      color: '#e05252',
      fontStyle: 'italic',
      fontWeight: 600,
    },
```

⚠️ **Convention CSS** : ce style est un objet JS inline (`style={}`), pas une classe `index.css`. C'est délibéré — il est cohérent avec l'entrée `msgSystemText` déjà existante dans ce même objet `styles` de `Sidebar.jsx`. Ne pas le déplacer dans `index.css`, ne pas créer une classe partagée (ce style est local à ce composant).

**Run à vide** : `npm run build` depuis `Enclume/client/`. Confirmer build ✅.

---

## Validation complète

Démarrer le projet (`.\start.ps1`). Monter un combat avec au moins 1 drone et 1 PNJ CaC.

| # | Scénario | Comment tester | Résultat attendu |
|---|---|---|---|
| V1 | Drone CaC, cible hors portée (> 3m) | Phase RESOLUTION, slot drone, cible à > 3m. **Prérequis** : cible déclarée pendant l'ANNONCE (`target_token_id` non-null en DB) | Fenêtre NE s'ouvre PAS. Message rouge dans chat (⚠ Corps à corps impossible...) visible par tous |
| V2 | Drone CaC, cible en portée (≤ 3m) | Idem, cible à ≤ 3m. **Prérequis** : même que V1 | Precheck ok → fenêtre s'ouvre normalement |
| V3 | PNJ humanoïde CaC, cible hors portée | Slot PNJ CaC, cible éloignée | Message rouge broadcasté à tous — fenêtre ne s'ouvre pas |
| V4 | PJ CaC, cible hors portée | Slot PJ avec action melee déclarée, cible éloignée | Idem V3 |
| V5 | CaC en portée avec allonge | Arme avec allonge (ref_range > 0) | Portée max = 3 + allonge respectée |
| V6 | Slot non-CaC (assaut distance, reload, move) | Slot quelconque sans action melee | Comportement inchangé — pas de precheck émis |
| V7 | Avance de slot vers nouveau slot melee | Slot suivant a aussi une action melee | Nouveau precheck lancé automatiquement |
| V8 | Avance de slot vers slot non-melee | Slot suivant n'a pas d'action melee | precheckOk → null → fenêtre fermée |
| V9 | Reconnexion pendant slot CaC | Reload page pendant RESOLUTION slot melee | Precheck relancé → fenêtre rouvre si en portée |
| V10 | Message système normal (skip, join) | Observer un message skip pendant RESOLUTION | Style gris inchangé |
| V11 | Race condition post-ACK | Non reproductible en dev — noter **Non testé** |  — |
| V12 | Slot avance correctement après action CaC valide | Compléter une action CaC normalement | Slot avance, prochain slot activé |

---

## Definition of done

- [ ] `COMBAT_ACTION_PRECHECK: 'combat:action_precheck'` dans `shared/events.js`
- [ ] Fix étape 0 : `resolveMeleeAction` — `socket.emit` → `io.to(campaignId).emit` (1 ligne)
- [ ] Handler ACK `COMBAT_ACTION_PRECHECK` dans `socketCombat.js` (entre L.850 et L.852)
- [ ] 8 logs `[DBG-CAC]` supprimés de `socketCombat.js` — grep confirme 0 résultat
- [ ] `precheckOk` useState + `useEffect` avec `socket.timeout(5000)` + flag `cancelled` dans `CombatOverlay.jsx`
- [ ] `&& precheckOk === true` sur les deux `CombatCacModifiersWindow` (conditions GM + PJ)
- [ ] Guards `COMBAT_ACTION_CONFIRM` existants intacts (non modifiés)
- [ ] `error: true` dans `useCombatSocket.onDeclareError`
- [ ] `msg.error → msgSystemErrorText` dans `Sidebar.jsx`
- [ ] Style `msgSystemErrorText` { fontSize: '11px', color: '#e05252', fontStyle: 'italic', fontWeight: 600 }
- [ ] `node --check server/src/socket/socketCombat.js` ✓
- [ ] `npm run build` ✓ (zéro warning TypeScript non existant, zéro erreur)
- [ ] SR ✓ (serveur redémarré sans erreur dans les logs)
- [ ] V1–V10, V12 validés — V11 noté **Non testé**
- [ ] Après validation : appender `docs/JOURNAL5.md` (session + ce qui a été fait + Testé/Non testé)
- [ ] Après validation : mettre à jour `docs/EN_COURS.md` (REWORK-16 ✅ clos)
- [ ] Après validation : mettre à jour `docs/ARCHI_REWORK.md` (REWORK-16 → section "Reworks achevés")
- [ ] Rappeler le push Git :
```powershell
git add .
git commit -m "Session 116 — REWORK-16 : Combat Pre-validation Gate (ACK Socket.IO)"
git push origin master
```

---

## Notes pour l'agent — protocole CLAUDE.md

- Lire chaque fichier avant de le modifier. Jamais de mémoire.
- Un bug à la fois. Un seul plan, pas de corrections opportunistes en passant.
- "Je code ?" une seule fois — plan complet avant.
- Run à vide entre chaque étape (node --check ou npm run build ou SR).
- Si une ligne ne correspond pas à la description ci-dessus, STOP — signaler l'écart avant de continuer.
- La confirmation "SR" ou "build ✅" de l'utilisateur est requise avant chaque étape suivante.
- `node --check` valide la syntaxe JS, pas les noms de tables DB. Un nom de table erroné dans le handler PRECHECK (ex: `drone_weapons` mal orthographié) ne sera pas détecté par `node --check` ni par SR — seul un test fonctionnel V1 ou V2 avec drone valide le handler complet côté drone.
