# PLAN_LOS.md — Plan historique LOS & Couverture Combat
> Session 113 — 2026-06-21
> Statut : ⚠️ ARCHITECTURE OBSOLÈTE — `shared/losUtils.js` (raycast voxel décrit ici) n'existe plus,
> remplacé par `shared/world/visibility.js`. Objectifs 1-2 refaits ailleurs et fonctionnels ; objectif 3
> (localisation contrainte) et Phase 2 (postures) jamais faits — repris dans `docs/ROADMAP.md`.
> Détail complet : `docs/JOURNAL6.md` "Session 149".
> Archivé dans `docs/Old/` — Session 149
> Voir aussi `docs/SYSTEME/MOTEUR_MONDE.md` et `docs/SYSTEME/COMBAT.md`.

---

## 1. Objectif final

Implanter un système de LOS serveur capable de :
1. Vérifier si la cible est visible (LOS binaire) — **FEAT2-B ✅ DONE Session 113**
2. Calculer le % de couverture → modifier au jet d'attaque
3. Contraindre la table de localisation D20 aux zones géométriquement exposées
4. Feedback visuel client (caméra épaule) — **FEAT2-A ✅ DONE Session 112**

---

## 2. Tables Polaris de référence

### Table de localisation D20 (distance)

| D20 | Zone |
|---|---|
| 1–2 | Tête |
| 3–8 | Corps |
| 9–11 | Bras droit |
| 12–14 | Bras gauche |
| 15–17 | Jambe droite |
| 18–20 | Jambe gauche |

### Modificateurs de couverture

| % corps masqué | Label Polaris | Modificateur |
|---|---|---|
| 0–49% | Aucune couverture | 0 |
| 50% | Couverture partielle | −3 |
| 75% | Couverture importante | −5 |
| 100% | Couverture totale | Tir en aveugle ✅ implémenté |

---

## 3. Architecture multi-ray

### Principe

4 rayons verticaux depuis l'œil de l'attaquant vers la cible.
Chaque rayon cible une hauteur proportionnelle à la posture du token cible.
Si le rayon est bloqué par un voxel → la zone correspondante est couverte.

### Mapping rayon → zone D20 (token Debout)

| Rayon | Offset Y cible | Zone si bloqué | D20 exclu |
|---|---|---|---|
| R1 | pos_z + 1.80 | Tête | 1–2 |
| R2 | pos_z + 1.30 | Corps haut | 3–8 (partiel) |
| R3 | pos_z + 0.80 | Corps bas | 3–8 (partiel) |
| R4 | pos_z + 0.30 | Jambes | 15–20 |

**Bras (9–14) :** toujours dans la table (V1). Contrainte latérale = V2 sprint futur (nécessite rotation token + 2 rayons latéraux).

### Calcul couverture

```
blockedCount = nombre de rayons bloqués parmi {R1, R2, R3, R4}

0/4 →   0% → modifier  0
2/4 →  50% → modifier −3
3/4 →  75% → modifier −5
4/4 → 100% → Tir en aveugle (resolveAssaultAction non appelé)
```

Note : 1/4 bloqué (25%) → pas de modifier (non défini dans les règles Polaris).

### Table de localisation contrainte

À partir des rayons bloqués, on exclut les zones correspondantes du D20 :

| Condition | Zones retirées |
|---|---|
| R1 bloqué | Tête (1–2) |
| R2 ET R3 bloqués | Corps (3–8) |
| R2 OU R3 bloqué (pas les deux) | Corps reste dans la table |
| R4 bloqué | Jambes (15–20) |
| Aucun rayon bloqué | Table complète |

Roll sur la sous-table des zones exposées uniquement (re-roll si résultat dans zone exclue, ou re-normalisation).

---

## 4. Paramètres par posture

Les offsets Y des rayons sont proportionnels à la hauteur totale du token.
La posture de l'ATTAQUANT affecte aussi la hauteur de son œil.

| Posture | Hauteur token | R1 tête | R2 corps H | R3 corps B | R4 jambes | Œil attaquant |
|---|---|---|---|---|---|---|
| Debout | 2.0 | +1.80 | +1.30 | +0.80 | +0.30 | pos_z + 2.50 |
| Accroupi | 1.0 | +0.85 | +0.65 | +0.40 | +0.15 | pos_z + 1.70 |
| Couché | 0.3 | +0.25 | +0.18 | +0.12 | +0.05 | pos_z + 1.20 |

Note : offsets = hauteurs au-dessus des pieds. Pieds = pos_z + 1.0 (surface voxel). Code : `pos_z + SURFACE + feetOffset`.

⚠️ L'œil de l'attaquant est actuellement fixé à `pos_z + 2.5` dans `losService.js` (Session 112).
À revoir quand les postures seront implémentées (Phase 2).

---

## 5. Séquence combat complète (Phase 1 cible)

```
Phase RÉSOLUTION — COMBAT_ACTION_CONFIRM :

  1. checkCombatLOS (existant ✅)
       → 4/4 bloqué : émettre "Tir en aveugle" → return

  2. checkCombatCoverage (nouveau Phase 1)
       → { modifier, blockedRays, exposedZones }

  3. rollHitLocation(exposedZones) (nouveau Phase 1)
       → localisation (cachée côté serveur)

  4. resolveAssaultAction(... , options = { coverageModifier, hitLocation })
       → roll D20 ≤ Seuil + modifier

  5. si touche → DICE_RESULT { localisation, dégâts, ... }
     si raté   → DICE_RESULT { raté } — localisation non révélée
```

---

## 6. Postures tokens (Phase 2 — sprint dédié)

### Ce qui change en DB
- Migration : `tokens.posture` ENUM('debout', 'accroupi', 'couche') DEFAULT 'debout'
- Migration : `tokens.height` NUMERIC ou dérivé automatiquement de posture

### Impact LOS
- `checkCombatCoverage` lit `tgtToken.posture` pour choisir la table d'offsets
- `checkCombatLOS` lit `srcToken.posture` pour l'hauteur d'œil de l'attaquant
- Table d'offsets centralisée dans `shared/losUtils.js`

### Non planifié encore
- Mécanique de changement de posture en combat (action ?)
- Impact posture sur portée de déplacement / initiatives
- Rendu 3D (différents modèles ou scale Y)
- Nouvelles règles de couverture (token couché = toujours 75% pour tirs debout ?)

---

## 7. Phases d'implémentation

### Phase 0 — LOS binaire ✅ DONE Session 113
- `shared/losUtils.js` : `checkLOS` + `findInterceptingTokens`
- `server/src/lib/losService.js` : `checkCombatLOS` + `_spendAmmo`
- `server/src/socket/socketCombat.js` : injection `resolveAssaultAction` + `resolveDroneAssaultAction`
- Migration 82 : `campaigns.allow_los_cancel`
- Logs `[DBG-LOS]` actifs

### Phase 1 — Couverture + localisation contrainte
- [ ] `shared/losUtils.js` : `checkCoverage(voxels, srcToken, tgtToken)` → `{ modifier, blockedRays, exposedZones }`
- [ ] `shared/losUtils.js` : `rollHitLocation(exposedZones)` → D20 contraint
- [ ] `server/src/lib/losService.js` : étendre ou créer `checkCombatCoverage`
- [ ] `server/src/socket/socketCombat.js` : séquence coverage → rollLoc → resolveAssault
- [ ] Décision : re-roll ou re-normalisation pour la table contrainte

### Phase 2 — Postures tokens (sprint dédié)
- [ ] Migration `tokens.posture` + `tokens.height`
- [ ] Table paramètres posture dans `shared/losUtils.js`
- [ ] `checkCombatLOS` + `checkCombatCoverage` : lire `token.posture`
- [ ] Rendu 3D (spec séparée)

### Phase 3 — Feedback visuel couverture (sprint dédié)
- [ ] Caméra épaule : 4 rayons colorés par zone (vert = exposé, rouge = couvert)
- [ ] Overlay % couverture dans SessionPage
- [ ] S'appuie sur l'architecture `useCameraLOS.js` existante (FEAT2-A ✅)

---

## 8. Décisions ouvertes

| ID | Question | Décision |
|---|---|---|
| LOS-D1 | R2 OU R3 bloqué (pas les deux) → Corps dans la table ? | **Oui** — partiel = exposé |
| LOS-D2 | Bras — contrainte latérale (rotation token) | **V1 : ignoré** — sprint V2 futur |
| LOS-D3 | 1/4 bloqué (25%) → modifier ? | **Non** — non défini Polaris |
| LOS-D4 | `allow_los_cancel` — joueur peut forcer tir en aveugle | Sprint futur |
| LOS-D5 | Posture attaquant → hauteur œil | **Oui** — implémenté Phase 2 |
| LOS-D6 | Table contrainte : re-roll ou re-normalisation | **À décider Phase 1** |
| LOS-D7 | Token couché — règle couverture spéciale ? | **À vérifier règles Polaris** |

---

## 9. Fichiers concernés

| Fichier | Rôle | Phase |
|---|---|---|
| `shared/losUtils.js` | Fonctions pures LOS + coverage + table postures | 0✅ / 1 / 2 |
| `server/src/lib/losService.js` | Orchestration DB + émission WS | 0✅ / 1 |
| `server/src/socket/socketCombat.js` | Injection dans resolveAssaultAction | 0✅ / 1 |
| `server/src/db/migrations/82_*.js` | `campaigns.allow_los_cancel` | 0✅ |
| `server/src/db/migrations/8X_*.js` | `tokens.posture` + `tokens.height` | 2 |
| `client/src/lib/useCameraLOS.js` | Feedback visuel couverture | 3 |
| `server/check_voxels.mjs` | Script diagnostic temporaire — **À supprimer** | — |
