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

## QUESTIONS OUVERTES (à résoudre avant Phase 2)

**Q1** : Le bug "aucun jet" — après ajout des logs DIAG-1 et DIAG-2, que voit-on dans la console serveur ?
→ Bloque Phase 2 pour la correction C.

**Q2** : Est-ce que `is_stunned`/`is_surprised` sont testés AVANT la résolution melee dans le flux actuel ?
→ À vérifier dans COMBAT_ACTION_CONFIRM avant `resolveMeleeAction`.

**Q3** : La carence armure défenseur est-elle volontairement absente (LdB ne la mentionne pas pour la défense CaC) ?
→ À vérifier dans REGLES_Contact.md.

---

## PLAN PHASE 2 (simulation — après réponse à Q1)

Selon le résultat des logs :

**Si DIAG-1 absent** → le handler ne reçoit pas l'event → bug client (socket, WS key)
**Si DIAG-1 présent, DIAG-2 = 0** → melee action non trouvée en DB (status résolu ?) → vérifier DB
**Si DIAG-2 présent (N≥1), pas de "[WS] melee attaque"** → exception dans resolveMeleeAction → lire `[WS] resolveMeleeAction error` dans console
**Si "[WS] melee attaque" présent** → bug en aval (DICE_RESULT émis mais non reçu côté client)

Simulation des corrections [D-BUG-1] et [E1-BUG-1] en run à vide avant Phase 3.
