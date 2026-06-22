# JOURNALTEMP — Scratch pad analytique
> Contenu périssable — ne jamais inclure dans la lecture obligatoire. Consolider vers JOURNAL5.md en fin de session.

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

