# PLAN_ALLURE — Allure tireur / cible ⇄ mouvement déclaré

> Créé 2026-09-09. Statut : **CLOS**. A1–A3 (mécanisme serveur) commit `12c12e1`, validé jeu réel.
> A4 (fenêtre joueur lecture seule) + A5 (doc) faits dans `PLAN_MODE_MODIFICATEURS_COMBAT.md`
> M3/M4/M5 — l'allure n'est dérivée/lecture-seule qu'en mode `auto`, `<select>` libre en `libre`.

## 1. Objectif

Le malus RAW d'allure (`REGLESYSCOMBAT.md:1439-1448` + Écran du MJ, **Tir seul**) était
calculé et envoyé par le client dans `confirmedModifiers.situation`, en confiance totale
serveur :

- **Trou d'autorité** : `tireur_allure_maximale` = *Tir impossible* (RAW) contournable — un
  client qui omet la clé tire quand même.
- Malus falsifiable (`-7` → `0`).
- Allure d'une **cible ennemie** inconnue du store d'un joueur (annonce non diffusée).

Donnée autoritaire déjà en base : `combat_actions.movement_gait` (`lente`/`moyenne`/`rapide`/
`max`) + `turn_number`, jamais lue par les résolveurs.

## 2. Principe

Extension exacte du pattern Taille (`PLAN_TAILLE.md` S1→S5, validé jeu) : source serveur →
préselect via `COMBAT_ACTION_PRECHECK` → gate non-MJ central → MJ garde le `<select>`, joueur
lecture seule. Précédents : Foundry VTT (état dérivé, pas de flag libre), PF2e (conditions
dérivées du game-state).

**Spécificité** : les clés d'allure vivent *dans* `confirmedModifiers.situation` (mêlées à
couverture/obscurité, elles légitimement libres). Le gate non-MJ **filtre les clés dérivées du
mouvement et réinjecte celles du serveur**, pas un `delete` de clé de premier niveau.

## 3. Table RAW

| | mod |
|---|---|
| Cible : allure moyenne / rapide / maximale | −3 / −5 / −7 |
| Cible : immobile | **+3** (Écran du MJ — confirmé RAW par Saar 2026-09-09) |
| Cible : allure lente | 0 |
| Tireur : allure lente / moyenne / rapide | −3 / −5 / −7 |
| Tireur : allure maximale | **Tir impossible** |
| Tireur : immobile | 0 |

## 4. Segments

| Seg | Fichiers | Statut |
|---|---|---|
| **A1** | `shared/combatSituationMods.js` (+`.test.mjs`) — `rangedAllureKeyForGait(gait, role)`, `MOVEMENT_DERIVED_SITUATION_KEYS`, `applyDerivedAllureToSituation`, garde de chargement | **fait** (`node --test` 23/23 ; découplé de `combatMovement.js` — pas de `world/` dans le bundle client) |
| **A2** | `server/src/lib/combatAllureService.js` (+`.test.mjs`) — `resolveMovementGait(db, campaignId, tokenId, turnNumber)`, `resolveRangedAllureKeys(...)` | **fait** (11/11 base locale ; `targetTokenId == null` ⇒ `targetAllureKey: null`, jamais `cible_immobile`) |
| **A3** | `socketCombatResolution.js` (PRECHECK non-AOE renvoie `shooterAllureKey`/`targetAllureKey` ; rewrite central `!isGm ∧ assault ∧ !aoe`) + `socketCombatHelpers.js` (label `tireur_allure_maximale`) | **fait, validé jeu réel** (Saar 2026-09-09 : `PRECHECK … allure:tireur_allure_lente/cible_allure_rapide` → `CONFIRM situation:[…]`) |
| **A4** | Fenêtres de combat lecture seule joueur | **→ chantier Mode LIBRE/AUTO** |
| **A5** | Doc (`COMBAT.md`, `COMBAT_FLUX.md`) + ticket AOE | **→ chantier Mode LIBRE/AUTO** |

## 5. Redirection Saar 2026-09-09 — option de campagne LIBRE / AUTO

Saar ne veut **pas** de champ « Taille (combat) » sur la fiche (retrait de `PLAN_TAILLE.md`
S5). À la place : **réglage de campagne** `combat_modifiers_mode` (défaut **AUTO**) :

- **AUTO** : taille + allure dérivées + préselect ; joueur lecture seule (A3/A4 + Taille S3/S4).
- **LIBRE** : modificateurs de combat tous libres — `PRECHECK` renvoie `null`, fenêtres =
  `<select>` fallback 0, sélection manuelle pour tous (comportement pré-chantiers).

Couvre **taille + allure** (la portée reste dérivée de la distance avec override, inchangée).
Détail : `docs/PLANS/PLAN_MODE_MODIFICATEURS_COMBAT.md` (à créer). Ce chantier-là :
retire S5, ajoute le réglage, garde `PRECHECK`/résolution selon le mode, finit A4, écrit A5.

## 6. Analyses à charge (2 passes) — corrections retenues

- **C1** : ne pas supprimer la détection client `detectedTireurAllure`/`detectedCibleAllure`
  (repli MJ/AOE ; A4 la garde).
- **C2** : AOE strictement hors périmètre. `runAoePhaseA` lit `confirmedModifiers.situation` et
  reçoit aujourd'hui `cible_immobile` (+3) en dur (`target_token_id` null). → **ticket**,
  résolu avec D7 / refacto `socketCombatAoe.js`. `PRECHECK` ne dérive pas l'allure en AOE.
- **C3** : pur → `shared/combatSituationMods.js` ; DB → `combatAllureService.js`.
- **R1** : `campaignId` en 1er arg du service (index `idx_actions_campaign` + isolation).
- **R2** : lignes de test `combat_actions` en `status:'resolved'` (contourne
  `chk_combat_world_plan_for_move`).
- **R3** : 2 points de transformation de `confirmedModifiers` dans `socketCombatResolution.js`
  (`gatedModifiers` l.316 portée handler ; allure l.~462 portée pas-de-l'échelle, besoin de
  `action`) — assumé, commenté ; un « pipeline modificateurs de résolution » est un chantier à
  part s'il gagne sa place.
- **R4** : la Charge (`combat_mode: 'charge'`) crée bien une ligne `move_*` avec `movement_gait`
  → pas de trou.
- **R5** : dériver d'un `move` déclaré mais annulé ensuite applique quand même le malus (= état
  pré-chantier, RAW-défendable). Assumé.
