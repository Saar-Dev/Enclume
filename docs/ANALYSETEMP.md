# ANALYSETEMP.md — Analyse critique REWORK-08 (première passe)
> Session 109 — 2026-06-18 | Document périssable — ne pas inclure dans lecture obligatoire
> **Session 109b** — analyse item-par-item complète — tous items résolus/confirmés

---

## RÉSULTATS — 30 items traités

| Item | Sévérité | Statut | Action ARCHI_REWORK.md |
|---|---|---|---|
| A01 | 🔴 | ✅ RÉSOLU | Warning ajouté en tête Interface cible |
| A02 | 🟡 | ✅ RÉSOLU | Couvert par le warning Interface cible |
| A03 | 🟡 | ✅ RÉSOLU | ~120L → ≤200L dans Périmètre |
| A04 | 🔴 | ✅ RÉSOLU | Signature Interface cible corrigée (context + pendingMaps, pas destructuration) |
| A05 | 🟡 | ✅ RÉSOLU | [R8-3] note comportement change ajoutée |
| A06 | 🟡 | ✅ CONFIRMÉ CRITIQUE | SESSION_JOIN ne contient aucun appel à checkTokenOwnership (lu L.146-227) → retiré de "À CONSERVER" Étape 7 |
| A07 | 🟡 | ✅ RÉSOLU | `user` non local dans SESSION_JOIN — forme `user: socket.user` confirmée dans Étape 2, note dans Interface cible |
| A08 | 🟡 | ✅ CONFIRMÉ | parseDice utilisé dans resolveMeleeAction (~L.3168, 3322, 3388, 3405, 3469) + helpers assaut → import nécessaire |
| A09 | 🟡 | ✅ CONFIRMÉ | isCaseOccupied utilisé dans COMBAT_ACTION_CONFIRM (~L.2261) → import nécessaire |
| A10 | 🟡 | ✅ CONFIRMÉ | collisionMoveToken utilisé dans COMBAT_ACTION_CONFIRM (~L.2267) → import nécessaire |
| A11 | 🟡 | ✅ CONFIRMÉ | getUserColor utilisé dans COMBAT_ACTION_DECLARE (~L.1742) → import nécessaire |
| A12 | 🔴 | ✅ CONFIRMÉ ABSENT | pendingDamageActions ABSENT de resolveMeleeAction L.3033-3517. [R8-26] mis à jour : destructuring = `{ pendingMeleeDefense, pendingStunActions }` |
| A13 | 🟡 | ✅ RÉSOLU (mineur) | Note "limitation connue" ajoutée au code mrTable — comportement identique à l'original |
| A14 | 🟡 | ✅ RÉSOLU | Référence L.220/222 supprimée dans Étape 2, remplacée par pattern de localisation |
| A15 | 🟡 | ✅ RÉSOLU | "Supprimer L.229-360" → "localiser par event name" dans Étape 2 |
| A16 | 🟢 | ✅ DÉJÀ DOCUMENTÉ | [R8-9] couvre MAP_VIEWPORT synchrone — pas de changement |
| A17 | 🟡 | ✅ RÉSOLU | [R8-13] mis à jour : copier le commentaire "relique" avec le handler |
| A18 | 🟡 | ✅ CONFIRMÉ | getUserColor dans socketEntity.js confirmé : L.972 (ENTITY_ACTION_RESOLVE) + L.1252 (ENTITY_MOVE_REQUEST) |
| A19 | 🟡 | ✅ INTENTIONNEL | Asymétrie io param / db import dans resolveEntityState — déjà documentée, pas de changement |
| A20 | 🔴 | ✅ RÉSOLU | [R8-28] ajouté (attackerSocket ≠ socket courant) + [R8-25] enrichi |
| A21 | 🟡 | ✅ RÉSOLU | startResolutionPhase ×3 explicités : (1) COMBAT_SURPRISE_RESULT, (2) COMBAT_ACTION_DECLARE, (3) skipPlayer |
| A22 | 🟡 | ✅ RÉSOLU (note) | Note ajoutée Étape 6 : constantes combat non grep-confirmées dans token/voxel/entity mais sémantiquement exclusives |
| A23 | 🟡 | ✅ RÉSOLU | [R8-3] note double-inscription disconnect ajoutée (mitigation = [R8-11]) |
| A24 | 🟡 | ✅ RÉSOLU | COMBAT_TURN_SKIPPED existe dans shared/events.js L.93 — nom correct |
| A25 | 🟡 | ✅ RÉSOLU | Scénario 12 : `resolveShockTest` → `statusService.resolveShockTest` |
| A26 | 🟢 | ✅ RÉSOLU | Scénario 17 ajouté : COMBAT_APPLY_STUN GM manuel |
| A27 | 🟢 | ✅ RÉSOLU | DoD mis à jour : scénarios 1-7 re-testés à Étape 7 comme non-régression |
| A28 | 🟢 | ✅ OK | Pas de changement |
| A29 | 🟢 | ✅ RÉSOLU | DoD mis à jour : "copier l'intégralité de la section REWORK-08" |
| A30 | 🔴 | ✅ RÉSOLU | [R8-27] ajouté : socket.campaignId/role/user préservés dans SESSION_JOIN (utilisés dans fetchSockets L.3494) |
| A31 | 🟡 | ✅ RÉSOLU | Note ajoutée Étape 6 step 4 : disconnect à L.2732 à supprimer si encore présent |
| A32 | 🟡 | ⚠️ [INCONNU] | Note ajoutée [R8-3] : emplacement timeout 60s à vérifier en lisant ENTITY_ACTION_REQUEST (Étape 5) |
| A33 | 🟡 | ✅ RÉSOLU | COMBAT_APPLY_STUN confirmé simple : appelle applyStunWithDuration (pas applyStun), aucun pendingMaps |

---

## BILAN

| Sévérité | Total | Résolus | Inconnus |
|---|---|---|---|
| 🔴 Bloquant | 5 (A01, A04, A12, A20, A30) | 5 | 0 |
| 🟡 Ambigu | 21 | 20 | 1 (A32) |
| 🟢 Mineur | 5 | 5 | 0 |
| **Total** | **31** | **30** | **1** |

**[A32 — INCONNU]** : emplacement du timeout 60s de `pendingEntityActions` — à résoudre lors de l'Étape 5 en lisant ENTITY_ACTION_REQUEST.

---

## ARCHI_REWORK.md — Modifications appliquées (Session 109b)

1. Interface cible : warning préliminaire + signature registerCombatHandlers corrigée
2. Périmètre : ~120L → ≤200L
3. Étape 2 : références lignes L.220/229-360 remplacées par patterns de localisation
4. Étape 6 : note imports confirmés (parseDice, getUserColor, isCaseOccupied, collisionMoveToken)
5. Étape 6 : startResolutionPhase ×3 explicité
6. Étape 6 step 4 : note disconnect à supprimer
7. Étape 7 : checkTokenOwnership retiré de "À CONSERVER" + note explicative
8. [R8-3] : changement comportemental A05 + double-inscription A23
9. [R8-13] : copier commentaire relique
10. [R8-25] : sémantique attackerSocket précisée
11. [R8-26] : pendingDamageActions CONFIRMÉ ABSENT — destructuring corrigé
12. [R8-27] ajouté : propriétés custom socket SESSION_JOIN à préserver
13. [R8-28] ajouté : attackerSocket ≠ context.user
14. mrTable : note limitation rejection cachée (A13)
15. Scénario 12 : statusService.resolveShockTest (prefix)
16. Scénario 17 ajouté : COMBAT_APPLY_STUN
17. DoD : scénarios 1-17, note re-test non-régression, contenu ARCHI_REWORK_DONE précisé
