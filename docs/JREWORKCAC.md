# JREWORKCAC — Journal de rework Combat CaC
> Session 92-4 (continued) — 2026-06-14
> Scratch pad : analyses, verdicts, plans. Périssable. À consolider dans JOURNAL4.md en fin de session.
> Source de vérité : MANUELSYSCOMBAT.md §6.2 + Old/REGLES_Contact.md

---

## CONTEXTE

Bug signalé après livraison Étape 3 :
> "Possible de faire un tour de combat et apparition de la fenêtre de modificateur mais c'est tout. Aucun jet, aucun dégat, rien."

L'utilisateur peut déclencher CombatCacModifiersWindow mais "Lancer les dés" ne produit rien.

**Méthode imposée :** Phase 1 (analyse) → Phase 2 (simulation) → Phase 3 (code).

---

## PHASE 1 — ANALYSE SÉQUENCÉE PAR PHASE DE TOUR

### Séquence complète d'un tour CaC

```
[A] Annonce melee (ANNOUNCEMENT)
  ↓
[B] Transition → RÉSOLUTION (startResolutionPhase)
  ↓
[C] Déclenchement (COMBAT_ACTION_CONFIRM + CombatCacModifiersWindow)
  ↓
[D] Jets attaque (resolveMeleeAction → DICE_RESULT attaquant)
  ↓
[E] Défense :
      E1 — PNJ auto (DICE_RESULT défenseur, interne)
      E2 — PJ (COMBAT_MELEE_DEFENSE_PROMPT → COMBAT_MELEE_DEFENSE_CONFIRM)
  ↓
[F] Résultat (COMBAT_MELEE_RESULT)
  ↓
[G] Dégâts si touché (localisation + dommages + COMBAT_ATTACK_RESULT)
  ↓
[H] Blessures + Test de Choc
  ↓
[I] Avance slot (advanceSlot)
```

---

### [A] ANNONCE — COMBAT_ACTION_DECLARE melee

**Implémentation :**
- PJ : `CombatActionWindow` → sélection cible → émet `COMBAT_ACTION_DECLARE { melee: [{ targetTokenId, weaponInvId }] }`
- GM/PNJ : `CombatGmDeclareWindow` → sélection cible → idem
- Serveur (ligne 2097-2110) : insère `combat_actions` row : `action_key='melee', type='melee', sequence=3, target_token_id=meleeTargetId, status='pending'`
- Guard : `if (meleeTargetId)` — pas d'insertion sans cible

**Conforme MANUELSYSCOMBAT.md §6.2 ?** ✅ (distance vérifiée en Phase 2, pas Phase 1)

**Issues identifiées :** aucune connue. `target_token_id` est bien stocké.

---

### [B] TRANSITION → RÉSOLUTION — startResolutionPhase

**Implémentation (lignes 2991-3020) :**
1. DB : `combat_state.phase = 'RESOLUTION'`, `active_slot_idx = 0`
2. Queries : `roster` (toutes entrées, ORDER BY `initiative` DESC) + `actions` (toutes actions, ORDER BY `sequence`)
3. Émet `COMBAT_PHASE_CHANGED { phase: 'RESOLUTION', roster, actions }` → client store reçoit les actions
4. Émet `COMBAT_SLOT_ADVANCED { activeSlotIdx: 0, tokenId: broadcastRoster[0].token_id }`

**Problème clé — DIVERGENCE ROSTER :**
- `broadcastRoster` = TOUTES les entrées (pas de filtre `has_announced`)
- `slots` (dans COMBAT_ACTION_CONFIRM, ligne 2278-2281) = entrées filtrées `status='active' AND has_announced=true`

→ Si une entrée est dans `broadcastRoster` mais PAS dans `slots` (ex: drone `has_announced=false` non résolu), les indices divergent.
→ Conséquence : `slots[state.active_slot_idx].token_id ≠ tokenId` → early return SILENCIEUX.

**Sévérité :** HAUTE si des drones autonomes non marqués sont présents. Faible sinon (en combat pur humanoïde).

---

### [C] DÉCLENCHEMENT — COMBAT_ACTION_CONFIRM (côté client + serveur)

**Côté client (CombatCacModifiersWindow) :**
```js
const handleLancer = () => {
  if (isRolling || !activeRosterEntry) return
  setIsRolling(true)
  socket?.emit(WS.COMBAT_ACTION_CONFIRM, {
    tokenId: activeRosterEntry.token_id,
    confirmedModifiers: { situation, situationDef, taille },
  })
}
```

**Côté serveur (lignes 2270-2364), guards dans l'ordre :**
1. `state.phase !== 'RESOLUTION'` → return silencieux
2. `slots[state.active_slot_idx].token_id !== tokenId` → return silencieux ← **SUSPECT PRINCIPAL**
3. `!token || !token.character_id || !character` → return silencieux
4. Auth : `socket.role !== 'gm' && character.user_id !== socket.user.id` → return silencieux
5. `meleeActions.length > 0` → branche melee

**BUG SUSPECT [C-BUG-1] — Early return silencieux au guard #2**

Le guard `activeSlot.token_id !== tokenId` peut échouer si :
- L'ordering `initiative DESC` du serveur diverge du tri client `b.initiative - a.initiative`
- Des entrées de roster ont `has_announced=false` mais sont dans `sortedRoster` côté client

→ **Diagnostic requis** : ajouter un log `console.log('[DBG] COMBAT_ACTION_CONFIRM received — tokenId:...')` AVANT les guards pour confirmer que l'event est bien reçu.

**BUG SUSPECT [C-BUG-2] — Exception silencieuse dans resolveMeleeAction**

Si S3 (ajout `ref_equipment.category`) cause une erreur SQL ou si un autre query échoue, le try/catch à la ligne 3680 log l'erreur (`console.error`) mais ne l'émet pas au client. → "rien" côté UI.

---

### [D] JETS ATTAQUE — resolveMeleeAction

**Implémentation (lignes 3180-3351) :**

1. Guard `!targetTokenId` → return false silencieux ← (si pas de cible)
2. Fetch sheet attaquant → if null, return false silencieux
3. Distance check : `dist2dChk > 3 + allonge` → émet `COMBAT_DECLARE_ERROR` + return false
4. Fetch données attaquant (Promise.all parallèle)
5. Calculs : `chancesAttaque = attackerSkillTotal + effectiveMalusAttaquant - carenceAttaquant + isRushedMod + attackModeBonus + multiMalusAttaquant + multiAttackMalus + situationModComp + tailleMod + terrainInstableMod + deuxArmesBonus`
6. Roll `1d20`, émet `WS.DICE_RESULT` ← premier indicateur visible

**Issues §6.2 identifiées :**

| Issue | Sévérité | Source |
|---|---|---|
| Modes de combat défenseur non appliqués côté PNJ auto (Offensif=-5, Charge=-7, Défensif=+3, Retraite=+5) | ✅ IMPLÉMENTÉ (ligne 3473-3476) | — |
| `deuxArmesBonus` : +3 si 2 armes de contact en MG+MD. V1 correct. | ✅ IMPLÉMENTÉ | — |
| Terrain instable : compétence limitative ACROBATIE_EQUILIBRE. `Math.min` = `terrainInstableMod = min(0, acroTotal - skillTotal)` | ✅ IMPLÉMENTÉ | — |
| Multi-adversaires : malus attaque ET défense | ✅ IMPLÉMENTÉ | — |
| **Cible sans défense (surprise/inconscient) : test SIMPLE avec +5** | ❌ NON VÉRIFIÉ — `is_stunned`/`is_surprised` non checkés dans resolveMeleeAction | REGLES_Contact.md p.88 |
| **Deux armes côté défenseur : +3 (Arts martiaux requis LdB p.223)** | Hors scope V1 — non implémenté | — |

**[D-BUG-1] — Cible sans défense non gérée**
Si la cible est `is_stunned = true` (choquée) ou `is_surprised = true`, le test devrait être SIMPLE (+5) sans test d'opposition. Actuellement, un test d'opposition est toujours fait.

Correction :
```js
const rosterCible = await db('combat_roster').where({ campaign_id: campaignId, token_id: targetTokenId }).first()
const isDefenderUnable = rosterCible?.state_character?.is_stunned || rosterCible?.state_character?.is_surprised
```
→ Si `isDefenderUnable` : test simple avec `chancesAttaque + 5`, pas de test d'opposition.

---

### [E1] DÉFENSE PNJ AUTO

**Implémentation (lignes 3467-3623) :**

1. Roll `1d20` défenseur (DICE_RESULT)
2. `chanceDefense = defenderSkillTotal + defenderEffectiveMalus + multiMalusDefenseur`
3. Modes combat défenseur : offensif -5, charge -7, défensif +3, retraite +5 ✅
4. Terrain instable défenseur (re-fetch conditionnel, CORR-S15) ✅
5. `hit = attackSuccess && (!defenseSuccess || mrAttaque > mrDefense)` ✅

**Issues :**

| Issue | Sévérité |
|---|---|
| Même bug cible sans défense : test d'opposition systématique même si PNJ étourdi | ❌ (voir D-BUG-1) |
| Carence armure défenseur : non appliquée (`defenderEffectiveMalus` inclut blessures/encomb mais pas carence armure) | A VÉRIFIER |

**[E1-BUG-1] — Carence armure défenseur PNJ non calculée**

Vérification : `defenderEffectiveMalus = woundPenaltyDef - calcEncumbrancePenalty(totalWeightDef, forValueDef)`. 
→ `calcEncumbrancePenalty` = encombrement. `calcCarenceArmure` = carence armure (force minimale non atteinte). Ces deux sont distincts.
→ `carenceAttaquant` est calculé pour l'attaquant (ligne 3272) mais PAS pour le défenseur PNJ.

→ Correction : calculer `carenceDef = calcCarenceArmure(equippedCible, for_na_cible)` et `chanceDefense -= carenceDef`.

---

### [E2] DÉFENSE PJ — COMBAT_MELEE_DEFENSE_PROMPT + CONFIRM

**Implémentation (lignes 3656-3679) :**
1. `pendingMeleeDefense.set(targetTokenId, commonPending)` ✅
2. `io.fetchSockets()` → trouve socket PJ → `defSocket.emit(WS.COMBAT_MELEE_DEFENSE_PROMPT, prompt)` ✅
3. Fallback broadcast si socket non trouvé ✅

**MELEE_DEFENSE_CONFIRM handler :** à lire séparément (non inclus dans cette session).

---

### [F] RÉSULTAT — COMBAT_MELEE_RESULT

```js
io.to(campaignId).emit(WS.COMBAT_MELEE_RESULT, {
  attaquantId, defenseurId, rollAttaque, chancesAttaque, rollDefense, chanceDefense, hit, ...
})
```

Conforme ✅ — affichage dans `CombatResultMelee`.

---

### [G] DÉGÂTS — si touché (hit = true)

**Implémentation PNJ auto (lignes 3532-3612) :**
1. Localisation : `LOC_TABLE_CONTACT` (1d20) ✅
2. `etq = calcResistanceArmure(armures localisées)` ✅
3. `degautsBruts = rawDice + modDom + combatModeBonus` ✅
4. `rd = calcResistanceDommages(for_na_cible, con_na_cible)` ✅
5. `degatsNets = max(0, degautsBruts - etq - rd)` ✅
6. Gravité par tranche de 5 pts ✅
7. `resolveWoundInsertion` + WOUND_ADDED ✅
8. Test de Choc si gravité suffisante ✅

**Issue [G-BUG-1] — MR non inclus dans dégâts (dette Session 67)**
MANUELSYSCOMBAT.md §6.2 : `Dommages_Bruts = rawDice + ModDom(FOR_attaquant)` — note "dette Session 67 : Arme + MR + ModDom".
→ Le MR (marge de réussite attaquant) DEVRAIT s'ajouter aux dégâts selon le LdB p.229. Actuellement non inclus.
→ Décision : dette connue, hors scope Étape 3.

---

### [H] BLESSURES + TEST DE CHOC

Implémentation existante, non touchée par Étape 3. ✅

---

### [I] AVANCE SLOT — advanceSlot

Appelé si `!needsDefenseWait`. Conforme ✅.

---

## RÉSUMÉ PHASE 1 — LISTE DES CORRECTIONS

### CRITIQUE — Bug "aucun jet" (diagnostic requis)

| ID | Description | Fichier | Action |
|---|---|---|---|
| **C-DIAG-1** | Ajouter log `[DBG] COMBAT_ACTION_CONFIRM received tokenId:X` AU DÉBUT du handler (avant guards) | `server/src/socket/index.js` ligne ~2273 | Diagnostic |
| **C-DIAG-2** | Ajouter log `[DBG] COMBAT_ACTION_CONFIRM — melee found: N` après ligne 2303 | idem | Diagnostic |

Ces 2 logs permettront de savoir :
- Si le handler est atteint (DIAG-1)
- Si les melee actions sont trouvées (DIAG-2)
- Combiné avec le log existant `[WS] melee attaque —` (ligne 3338), la chaîne sera complète

### HAUTE PRIORITÉ

| ID | Description | Fichier | Spec |
|---|---|---|---|
| **[D-BUG-1]** | Cible sans défense (is_stunned / is_surprised) → test simple +5 au lieu d'opposition | `resolveMeleeAction` | LdB p.88, MANUELSYSCOMBAT §6.2 |
| **[E1-BUG-1]** | Carence armure non calculée pour le défenseur PNJ | `resolveMeleeAction` bloc PNJ auto | PC51/BLESSURES.md |

### BASSE PRIORITÉ (hors scope Étape 3)

| ID | Description |
|---|---|
| [G-BUG-1] | MR non inclus dans dégâts — dette Session 67 |
| [B-NOTE-1] | Divergence roster potentielle si drones has_announced=false — hors scope |

---

---

## PHASE 1 — VERDICT (après logs serveur)

**Log analysé :**
```
[WS] resolveMeleeAction — hors portée: 3.6m max:3m token:ce71acbb-...
[WS] resolveMeleeAction — hors portée: 3.6m max:3m token:ddb4b217-...
```

**Cause exacte du bug "aucun jet" :**
1. Tokens positionnés à 3.6m (> 3m portée contact)
2. `resolveMeleeAction` CORRECTEMENT rejette (LdB p.12 : ≤3m)
3. `COMBAT_DECLARE_ERROR` émis vers le socket GM
4. `CombatCacModifiersWindow` n'a PAS de listener `COMBAT_DECLARE_ERROR` → erreur invisible
5. `isRolling = true` reste → bouton bloqué "En cours…" sans feedback
6. `needsDefenseWait = false` → `advanceSlot` → tour avance sans jet

**Ce N'EST PAS un bug dans la logique melee.** La logique de distance est correcte.

**Issues confirmées à corriger :**

| ID | Type | Description | Priorité |
|---|---|---|---|
| **[FIX-A]** | UX critique | `CombatCacModifiersWindow` : ajouter listener `COMBAT_DECLARE_ERROR` + afficher message + reset `isRolling` | CRITIQUE |
| **[FIX-B]** | Logging serveur | Ajouter logs dans `COMBAT_ACTION_CONFIRM` pour traçabilité | HAUTE (demandé) |
| **[FIX-D]** | Spec §6.2 | Cible sans défense (is_stunned/is_surprised) → test simple +5 | HAUTE |
| **[FIX-E]** | Spec à vérifier | Carence armure défenseur PNJ non calculée | À confirmer |
| [FIX-C] | Cosmétique | 403 drone endpoint pour cibles non-drone | BASSE |

---

## PHASE 2 — ANALYSE ARCHITECTURALE (Session 93-2 — 2026-06-14)

### Q1 résolue — Cause confirmée, logs inutiles

**Log confirmé Session 93-2 (analyse post-implémentation) :**
```
[WS] resolveMeleeAction — hors portée: 3.6m max:3m token:...
```
→ C'est exactement le point 3 du verdict. Q1 résolue sans logs supplémentaires.

**FIX-B (logs DIAG) :** inutile pour le diagnostic — cause identifiée. Hors scope.

### Q2 résolue — COMBAT_ACTION_CONFIRM lu (lignes 2277-2372)

Handler lu intégralement. Points clés :
- Ligne 2278 : log `[DBG] COMBAT_ACTION_CONFIRM` déjà présent ✅
- Lignes 2354-2358 : melee actions marquées `status='resolved'` **AVANT** `resolveMeleeAction`
- Ligne 2359-2362 : `needsDefenseWait = await resolveMeleeAction(...)`
- Lignes 2366-2368 : `if (!needsDefenseWait) await advanceSlot(...)` → **slot avance même si distance échoue**

**Conséquence architecturale :** comportement serveur LÉGALEMENT CORRECT (LdB : action perdue si hors portée). Pas un bug serveur. Pas de fix serveur nécessaire pour FIX-A.

### Décision architecturale FIX-A — RÉVISÉE

**Ancien plan (incorrect) :** ajouter listener dans `CombatCacModifiersWindow` + afficher erreur locale.
**Problème :** slot avance quasi-simultanément → reset effect efface l'erreur avant que l'utilisateur la lise. Bricolage de timing.

**Nouveau plan (correct) :** listener dans `CombatOverlay` (parent toujours monté).
- `CombatOverlay` est monté pendant toute la durée du combat — indépendant du cycle de vie des enfants
- `styles.gmError` + `styles.gmErrorMsg` + `styles.gmErrorClose` existent déjà dans `CombatOverlay` (bannière `gmSocketError` lignes 232-238)
- `CombatCacModifiersWindow` : **ZÉRO changement** — `isRolling` reset naturellement (slot advance → unmount ou reset effect)
- `CombatActionWindow` garde son listener (ANNOUNCEMENT) — coexistence propre, sans conflit

### Q3 — Carence armure défenseur (FIX-E)

Non analysée cette session. À traiter dans une session dédiée (lire `docs/SYSTEME/BLESSURES.md` + code `resolveMeleeAction`).

---

## PHASE 3 — PLAN D'IMPLÉMENTATION COMPLET (prêt à coder)

> Plan auto-suffisant — lisible après compact de contexte.
> Source des numéros de ligne : lecture directe `CombatOverlay.jsx` (258 lignes) Session 93-2.

---

### [FIX-A] — `client/src/components/CombatOverlay.jsx` — 3 touches

**Contexte fichier :**
- Ligne 1 : `import { useState, useEffect } from 'react'` — déjà importés ✅
- Ligne 3 : `import { WS } from '../../../shared/events.js'` — déjà importé ✅
- Lignes 22-24 : états locaux existants (`showGmPanel`, `stunDialog`, `stunDialogDuration`)
- Lignes 27-35 : useEffect `COMBAT_STUN_EXPIRED` — **modèle exact à réutiliser**
- Lignes 232-238 : bannière `gmSocketError` existante avec `styles.gmError` — **CSS à réutiliser**
- Lignes 609-638 : styles `gmError`, `gmErrorMsg`, `gmErrorClose` — **inchangés, réutilisés**

---

**T1 — Ligne 24 — ajouter état `combatActionError` après `stunDialogDuration` :**

Avant (lignes 22-24) :
```js
const [showGmPanel, setShowGmPanel] = useState(false)
const [stunDialog, setStunDialog] = useState(null)
const [stunDialogDuration, setStunDialogDuration] = useState('')
```

Après :
```js
const [showGmPanel, setShowGmPanel] = useState(false)
const [stunDialog, setStunDialog] = useState(null)
const [stunDialogDuration, setStunDialogDuration] = useState('')
const [combatActionError, setCombatActionError] = useState(null)
```

---

**T2 — Après ligne 35 — ajouter useEffect listener `COMBAT_DECLARE_ERROR` :**

Insérer après la fermeture du useEffect `COMBAT_STUN_EXPIRED` (après le `}, [socket, tokens])` de la ligne 35) :

```js
// Écoute COMBAT_DECLARE_ERROR en phase Résolution — bannière persistante (survit aux changements de slot)
useEffect(() => {
  if (!socket) return
  const handler = ({ message }) => {
    setCombatActionError(message)
    setTimeout(() => setCombatActionError(null), 6000)
  }
  socket.on(WS.COMBAT_DECLARE_ERROR, handler)
  return () => socket.off(WS.COMBAT_DECLARE_ERROR, handler)
}, [socket])
```

**Pourquoi `[socket]` et pas `[]` :** socket peut changer à la reconnexion — le listener doit être réenregistré.

---

**T3 — Après ligne 238 — ajouter bannière `combatActionError` :**

La bannière `gmSocketError` existante (lignes 232-238) :
```jsx
{/* Bannière d'erreur serveur — GM uniquement */}
{gmSocketError && (
  <div style={styles.gmError}>
    <span style={styles.gmErrorMsg}>⚠ {gmSocketError}</span>
    <button style={styles.gmErrorClose} onClick={onGmSocketErrorClose}>✕</button>
  </div>
)}
```

Ajouter APRÈS ce bloc :
```jsx
{/* Bannière erreur action combat — hors portée CaC, etc. — survit aux changements de slot */}
{combatActionError && (
  <div style={styles.gmError}>
    <span style={styles.gmErrorMsg}>⚠ {combatActionError}</span>
    <button style={styles.gmErrorClose} onClick={() => setCombatActionError(null)}>✕</button>
  </div>
)}
```

**Note :** les deux bannières utilisent `styles.gmError` — si elles apparaissent simultanément, elles se superposent (position: absolute top:52). Cas pratiquement impossible (l'une est erreur socket, l'autre erreur domaine). Acceptable.

---

### Ce qui NE change PAS

| Fichier | Statut |
|---|---|
| `CombatCacModifiersWindow.jsx` | Inchangé — zéro touche |
| `CombatActionWindow.jsx` | Inchangé — son listener COMBAT_DECLARE_ERROR coexiste |
| `CombatGmDeclareWindow.jsx` | Inchangé |
| `server/src/socket/index.js` | Inchangé pour FIX-A |
| `styles.gmError` / `styles.gmErrorMsg` / `styles.gmErrorClose` | Inchangés — réutilisés |

---

### Validation post-implémentation

1. SR sans erreur
2. Vite 200
3. Scénario test : lancer un combat, ANNOUNCEMENT → 1 PNJ annonce melee sur une cible à > 3m → RESOLUTION → slot PNJ actif → GM voit `CombatCacModifiersWindow` → clique "Lancer les dés"
4. **Attendu :** bannière rouge "⚠ hors portée: X.Xm max:3m" apparaît en haut de l'écran, disparaît après 6s ou clic ✕
5. **Attendu :** slot avance normalement (comportement inchangé)
6. **Attendu :** aucun régression sur les autres chemins (tir distance, CaC qui réussit, défense PJ)

---

### Fixes restants après FIX-A

| ID | Priorité | Description | Prérequis lecture |
|---|---|---|---|
| **[FIX-D]** | HAUTE — bloqué PLAN 14 | Cible sans défense → test simple +5. `rosterDef` déjà fetché ligne 3486. `is_surprised` lifecycle incorrect (jamais effacé). Architecture statuts à trancher avant de coder. Voir ROADMAP.md PLAN 14. | `resolveMeleeAction` lignes 3482-3670 |
| **[FIX-E]** | À confirmer | Carence armure défenseur PNJ non calculée | `docs/SYSTEME/BLESSURES.md` + `resolveMeleeAction` |
| [FIX-B] | BASSE | Logs COMBAT_ACTION_CONFIRM (log existe déjà ligne 2278) | Vérifier si utile |
| [FIX-C] | BASSE | 403 drone endpoint non-drone | — |
