# JOURNALTEMP — Session 93-2 — Correction CaC
> 2026-06-14
> Scratch pad de session — appender progressivement. Consolider vers JOURNAL4.md en fin de session.

---

## Contexte

Sprint CaC livré sur 3 étapes (Sessions 92tier / 92-4) :
- **Étape 1** (B1/B2/B8/B9/LOC) — validé fonctionnellement ✅
- **Étape 2** (B3/B6/B7 drone assault) — validé fonctionnellement ✅
- **Étape 3** (CombatCacModifiersWindow + 6 mods SITUATION + terrain instable + deux armes auto) — SR + Vite 200 ✅ — **validation fonctionnelle requise**
- **Session 93** (fix split-brain slot detection) — SR ✅ — **validation fonctionnelle requise**

**Session 93-2 — Correction CaC** : bug "aucun jet, aucun dégât" diagnostiqué + plan FIX-A établi.

---

## Fichiers lus cette session

- `CLAUDE.md` ✅
- `MANUELSYSCOMBAT.md` ✅
- `docs/EN_COURS.md` ✅
- `docs/JOURNAL4.md` (Session 93) ✅
- `docs/REWORK_CONTACT.md` (complet, audit inclus) ✅

---

## Findings — Rapport session précédente (analyse post-Session 93)

### Ce qui est sain ✅
- Corrections 1+2+3 de Session 93 en place et cohérentes
- `advanceSlot` — n'était PAS cassé (slots re-queryé avec `has_announced=true, status:'active'` aux 3 call sites lignes 2367/2838/2846)
- `COMBAT_ACTION_CONFIRM` slots — propre depuis l'origine (lignes 2286–2289)
- Guard DECLARE melee sans cible — ligne 2155–2160, avant tout write DB ✅

### FIX-A — CombatCacModifiersWindow : aucun listener COMBAT_DECLARE_ERROR

**Scénario :** RESOLUTION, GM clique "Lancer les dés" pour PNJ melee → `resolveMeleeAction` échoue (distance check) → émet `COMBAT_DECLARE_ERROR` → **silence**.

- `CombatGmDeclareWindow` a un listener (lignes 133–141) — actif en ANNOUNCEMENT seulement
- `CombatActionWindow` a un listener (lignes 222–230) — actif PJ, inactif pour GM mode melee
- `CombatCacModifiersWindow` — **aucun listener** → `isRolling` reste `true`, bouton "Lancer les dés" bloqué indéfiniment

**Fix requis :** ajouter `useEffect` listener `COMBAT_DECLARE_ERROR` dans `CombatCacModifiersWindow` → reset `isRolling = false` + affichage erreur.

### Résiduel documenté (dette future, pas cette session)
- `COMBAT_STATE_SYNC` reconnexion en RESOLUTION : envoie `activeSlotIdx` (index entier) pas `activeTokenId` absolu → split-brain persiste pour les reconnexions. Sprint dédié futur.

### Erreurs à éviter (E1-E4)
- **E1** : guard ligne 2155 doit rester AVANT le `db('combat_actions').insert()`
- **E2** : `mapActions.melee = []` → guard inactif → token annoncé sans action melee (acceptable V1 mais edge case)
- **E3** : `announcedRoster[0]` undefined si tous non-annoncés → `activeTokenId = null` → pas de crash mais UI morte
- **E4** : `fullRoster` sans filtre `status='active'` → tokens 'fled' futurs dans timeline (mine future)

### Fichiers lus ✅
- `docs/JREWORKCAC.md` — Phase 1 analyse + verdict, Phase 2 non encore faite
- `client/src/components/CombatCacModifiersWindow.jsx` — 258 lignes, aucun listener COMBAT_DECLARE_ERROR confirmé
- `CombatActionWindow.jsx` lignes 222–231 — pattern confirmé :
  ```js
  useEffect(() => {
    if (!socket) return
    const handler = ({ message }) => { setDeclareError(message); setTimeout(() => setDeclareError(null), 4000) }
    socket.on(WS.COMBAT_DECLARE_ERROR, handler)
    return () => socket.off(WS.COMBAT_DECLARE_ERROR, handler)
  }, [socket])
  ```
  → Différence avec CombatCacModifiersWindow : il faut AUSSI `setIsRolling(false)` dans le handler

### Décision architecturale FIX-A — lu COMBAT_ACTION_CONFIRM lignes 2270-2368 + CombatOverlay

**Comportement serveur confirmé (légalement correct) :**
- Actions melee marquées `resolved` AVANT `resolveMeleeAction` (ligne 2356-2358)
- Si distance échoue → `return false` → `needsDefenseWait = false` → `advanceSlot` appelé (ligne 2366-2368)
- Slot avance systématiquement → comportement LdB correct (action perdue)

**FIX-A : écouter `COMBAT_DECLARE_ERROR` dans `CombatOverlay` (pas `CombatCacModifiersWindow`)**
- CombatOverlay toujours monté → survit au changement de slot
- `styles.gmError` existant réutilisé (bannière top, fermeture manuelle + timeout 6s)
- `CombatCacModifiersWindow` : zéro changement — `isRolling` reset naturellement via reset effect ou unmount
- `CombatActionWindow` garde son propre listener (ANNOUNCEMENT) — coexistence propre

**Plan : 3 touches dans CombatOverlay.jsx seulement (T1 state, T2 useEffect, T3 bannière JSX)**

### État des fixes

| ID | Statut | Description |
|---|---|---|
| **FIX-A** | ⏳ CODÉ — validation fonctionnelle requise | `CombatOverlay.jsx` : state + useEffect + bannière JSX. Test impossible pour l'instant — dette validée. |
| FIX-B | ⬇️ Hors scope | Log COMBAT_ACTION_CONFIRM ligne 2278 EXISTE DÉJÀ — inutile |
| **FIX-D** | ⏸ Bloqué PLAN 14 | Lifecycle `is_surprised` incorrect. Architecture statuts à trancher (JSONB vs token_statuses+expires_at_turn). Voir ROADMAP.md PLAN 14. |
| FIX-E | 🔲 À confirmer | Carence armure défenseur — lire BLESSURES.md d'abord |
| FIX-C | 🔲 Basse | 403 drone endpoint |

### Prochaine action (mise à jour Session 93-3)

- FIX-A : confirmé présent dans le code (3 touches CombatOverlay.jsx L.25/38-47/252-258). **Validation fonctionnelle requise.** Scénario : CaC PNJ à >3m → "Lancer les dés" → bannière rouge "hors portée: X.Xm max:3m".
- FIX-D : **bloqué Sprint 14-3** — nécessite Sprint 14-0 (migration 79 `token_statuses.expires_at_turn` + refactor `is_surprised`/`is_stunned`). Non codable maintenant.
- **FIX-E** : prochaine action. Lire `docs/SYSTEME/BLESSURES.md` + section défenseur `resolveMeleeAction` (lignes 3467-3623). Ajouter `calcCarenceArmure` au `chanceDefense` PNJ.

---

## Session 93-3 — 2026-06-15 — Audit mémoire + Correction CaC (FIX-E)

### Fichiers lus cette session

- `CLAUDE.md` ✅
- `MANUELSYSCOMBAT.md` ✅
- `docs/EN_COURS.md` ✅
- `docs/ASBUILT.md` ✅
- `docs/JOURNAL4.md` (Session 93) ✅
- `docs/JOURNALTEMP.md` ✅
- `docs/JREWORKCAC.md` ✅ (complet)
- `docs/ROADMAP.md` (§PLAN 14) ✅
- `client/src/components/CombatOverlay.jsx` (L.1-80 + L.220-270) ✅

### Confirmations

- **FIX-A** : présent et complet dans `CombatOverlay.jsx`. Les 3 touches sont en place. Validation fonctionnelle requise.
- **FIX-D** : blocker architectural confirmé. ROADMAP PLAN 14 Sprint 14-3 = FIX-D, prérequis Sprint 14-0. Non codable sans migration 79.

### Nettoyage mémoire

- Supprimé `project_state.md` (Session 85, périmé)
- Supprimé `TAMPON.md` (Session 65, périmé)
- Supprimé `feedback_journal.md` (référençait JOURNAL2.md, mort)
- Mis à jour `user_profile.md` (45+ → 93+ sessions)
- Mis à jour `MEMORY.md` (index cohérent)

---

## Session 93-4 — 2026-06-15 — Correction CaC (drone déclaration bug)

### Fichiers lus cette session

- `CLAUDE.md` ✅
- `docs/EN_COURS.md` ✅
- `docs/JOURNALTEMP.md` ✅
- `client/src/stores/characterStore.js` ✅
- `client/src/stores/tokenStore.js` ✅
- `client/src/stores/combatStore.js` ✅
- `client/src/components/CombatGmDeclareWindow.jsx` ✅ (complet)
- `client/src/components/CombatRosterWindow.jsx` ✅
- `client/src/components/CombatOverlay.jsx` ✅ (début)
- `client/src/pages/SessionPage.jsx` ✅ (sections pertinentes)
- `server/src/socket/index.js` ✅ (COMBAT_START + COMBAT_ACTION_DECLARE)
- `server/src/routes/battlemaps.js` ✅ (token query)
- `server/src/routes/characters.js` ✅
- `server/src/routes/tokens.js` ✅

### Test CaC Étape 3 — résultats

1. Humanoid CaC avec mods situation ✅ — validé fonctionnellement
2. Portée hors 3m — pathfinding transparent (pas de bannière rouge) — comportement acceptable ✅
3. Drone CaC — **KO** — aucune fenêtre de déclaration

### Bug Drone-Déclaration — Diagnostic

**Symptôme :** En phase ANNONCE, avec seulement des drones GM dans le roster → `CombatGmDeclareWindow` retourne `null` immédiatement (line 192 : `if (allGmManaged.length === 0) return null`).

**Chaîne :** `allGmManaged = roster.filter(r => r.status === 'active').filter(isGmManaged)` → 0 entrées.

**Cause racine confirmée :** `isDroneGmManaged` (ligne 171-176) retourne `false` à cause de `!char.user_id`.

```js
// AVANT (bugué)
const isDroneGmManaged = (entry) => {
  const token = tokens.find(t => t.id === entry.token_id)
  if (!token?.character_id) return false
  const char = characters.find(c => c.id === token.character_id)
  return char?.type === 'drone' && !char.user_id  // ← FAIL si user_id non-null
}
```

`CombatRosterWindow.getCharType` (même chaîne token→char, mais vérifie seulement `char.type`) affiche badge 'DR' → confirme que token ET char sont bien présents dans leurs stores respectifs.

La différence : `&& !char.user_id`. Si le GM a assigné le drone à son propre compte via Sidebar (onglet Paramètres → dropdown owner), `char.user_id` est non-null → `!char.user_id = false` → `isDroneGmManaged = false`.

**Correction appliquée :** `CombatGmDeclareWindow.jsx` ligne 175 — suppression de `&& !char.user_id`.

```js
// APRÈS (corrigé)
return char?.type === 'drone'
```

**Justification :** Le serveur (`COMBAT_ACTION_DECLARE` ligne 1899-1901) autorise le GM à déclarer pour TOUT drone (quel que soit le `user_id`). La restriction client-side était inutilement stricte.

**Effet :** Les drones joueur apparaîtraient aussi dans la fenêtre GM si mélangés — acceptable car GM/joueur sont des sessions distinctes, pas de conflit à l'écran. Sprint 3 (Télépilotage) tranchera la UX définitive.

### État fixes session 93-4

| ID | Statut |
|---|---|
| **Bug Drone-Déclaration** | ✅ VALIDÉ FONCTIONNELLEMENT — SR + fenêtre ouvre |
| **Sprint CaC Étape 3 — humanoid** | ✅ VALIDÉ FONCTIONNELLEMENT |
| **B6** | 🔲 À coder (prochain) |
| **B7** | ✅ Déjà implémenté (resolveDroneIntegrityLoss appelé dans branch 8a) |

### Nouveaux bugs identifiés lors du test (→ BUGIDENTIFIE.md)

- **UI1** — Design fenêtre déclaration : tout blanc / dégueulasse
- **COM1** — Recharger : action ne fait rien (humanoïde)
- **COM2** — Vérification statut arme non copiée pour PNJ GM
- **COM3** — Jet de défense CaC déclenché même si assaillant échoué
- **COM4** — CaC exige "Arme au clair" alors que mains nues possibles
- **COM5** — Fenêtre Annonce GM, CaC : clic mode combat sélectionne aussi la cible
- **COM6** — Arme CaC non sélectionnée par défaut (GM et joueur)
- **COM7** — Multi-attaque CaC : duplicata / "Déclarer" grisé
- **COM8** — Fenêtre annonce non masquée lors de sélection cible
- **DR1** — Drone : arme non sélectionnée par défaut
- **DR2** — Drone : aucune action de déplacement disponible
- **DR3** — Drone CaC : fenêtre modificateurs "Distance" à tort (= DC1+DC3)

