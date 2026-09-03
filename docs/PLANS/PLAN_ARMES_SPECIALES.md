# PLAN_ARMES_SPECIALES.md — Armes spéciales (lance-flammes, grenades/mines, fouets/chaînes)

> Rédigé 2026-09-03 (Claude/Saar). Débloqué par le pipeline AOE (`PLAN_AOE.md`, fusil à pompe clos
> PNJ + PJ). RAW : `docs/REGLES/REGLES_ARMES_SPECIALES.md` + le RAW grenades transcrit dans
> `PLAN_AOE.md` §1. **Autorité : Livre de Base Polaris > ce PLAN.** Tout écart RAW est une décision
> écrite dans `docs/JOURNAL8.md` (invariant AGENTS.md #5), jamais un raccourci silencieux.
>
> **Scindé en lots** : **Lot 1 lance-flammes** (le moins bloqué, prochain) · **Lot 2 grenades/mines**
> (partiellement bloqué — RAW manquant + migration catalogue) · **Fouets/chaînes** : hors périmètre,
> rejoint Arts martiaux (voir §5).

---

## 1. Lot 1 — Lance-flammes

### 1.1 RAW rencontrée [VÉRIFIÉ]

`REGLES_ARMES_SPECIALES.md:53-66` + ligne `ref_equipment` `Lance-flammes`
(`303_ref_equipment_seed.js`, `category='Lanceur'`) :

| Champ catalogue | Valeur |
|---|---|
| `damage_h` | `2D10` |
| `shock` | `2D6` |
| `range` | `3/7/15/30 (40)` |
| `fire_mode` | `RL` (rafale longue) |
| `min_str` | 10 · `weight` 14 |

- **Aire d'effet** : toutes les cibles exposées au tir sont atteintes. Échec au Test de tir → cibles
  touchées quand même, le modificateur d'échec réduit les dégâts (identique au fusil à pompe — UN
  seul jet, aucune branche « raté », `resolveAoeAttackRoll` déjà écrit).
- **2D10 points de Dommages physiques dus au feu, sur 1D3 Localisations** (impact initial).
- **+2D6 Dommages de Choc** — "la douleur insupportable liée à l'intensité de la brûlure" ; "à tenir
  en compte que si l'arme affecte directement le personnage". **Impact initial uniquement** (le RAW
  du feu continu, `REGLEBLESSURES.md:647-658`, ne mentionne aucun Choc pour les Tours suivants).
- **Feu continu** : "le liquide qui a aspergé la cible continue de brûler, causant 2D10 points de
  dommages pendant 2D6 Tours de combat ou jusqu'à ce qu'on l'éteigne". Recoupe le RAW « **grand feu** »
  (`REGLEBLESSURES.md:654`) : *"2D10/Tour, sur 1D3 Localisation(s). Un personnage aspergé de liquide
  inflammable auquel on met le feu subit ce genre de dommages (c'est, de plus, **un feu très difficile
  à étouffer**)."* Donc le tick continu est aussi **1D3 Localisations/Tour**, pas 1.
- **Protections simples : niveau de protection réduit de moitié.**
- **Les dégâts ne décroissent PAS avec la portée** (contrairement au fusil à pompe — RAW explicite).
- **Distance minimale ~3 m** d'une cible, sinon le tireur "risque d'être lui-même éclaboussé".
- **Tir continu** (couvre une zone plus large) = **Action exclusive**. Le lance-flammes est en
  `fire_mode` RL — il est *toujours* en tir continu, pas de mode « coup unique ».

### 1.2 Ce qui existe déjà et sera réutilisé, jamais dupliqué [VÉRIFIÉ]

| Brique | Où | Réutilisation |
|---|---|---|
| Identification lance-flammes | Aujourd'hui `combatExclusiveActions.js:162` (`ref_category === 'Lanceur' && ref_name === 'Lance-flammes'`) | **Remplacé au segment 0b** par `ref_equipment.aoe_profile.mechanic === 'flamethrower'` — plus de nom en dur (§1.6 pt 1) |
| Géométrie `cone` | `shared/world/aoeShapes.js` (`normalizeAoeShape` shape `cone` = `amplitudeM` longueur + `angleDeg`, `isPointInAoeShape`) | Couche 1 — rien à écrire, juste paramétrer |
| LOS couches 2+3 | `worldVisibilityService.js#evaluateAoeVisibility` | Inchangé (même appel que le fusil à pompe) |
| Jet Phase A | `socketCombatHelpers.js#resolveAoeAttackRoll` | UN seul Test de tir pour l'action, la marge module le dégât |
| Résolution par cible | `damageService.resolveTargetHit({ …, armorReductionFactor, chocDsl })` | `armorReductionFactor: 0.5` = "protections simples ÷2" (le param existe déjà, RAW Chute l'utilise) ; `chocDsl` = Choc arme |
| **Feu continu** | `environmentalHazardService.js#exposeToHazard(io,db,cId,tokenId,'burning',{formula,locations,forcedLocation})` + tick automatique à `startResolutionPhase` (Fatigue&Dommages Lot 3, clos) | Poser `burning` sur chaque cible touchée. ⚠️ `exposeToHazard` fixe `expiresAtTurn: null` — **à étendre** (§1.4 pt 4) |
| Persistance | migration `317_combat_action_targets` | Une ligne par cible, `outcome` écrit inline |
| Payload | `aoe: { direction }` (`socketCombatAnnouncement.js`, étape 6b) | Déjà accepté — le lance-flammes vise une direction comme le fusil à pompe |
| Fenêtre-reçu PJ | `COMBAT_ATTACK_PLAYER_RESULT { hit, roll, seuil, targets: [...] }` (AOE étape 10) + liste `CombatModifiersWindow` | Réutilisée telle quelle |

### 1.2bis Tour de vérification code (2026-09-03) — 3 inconnues levées

- **#1 `armorReductionFactor: 0.5` — OK, décision D implémentable telle quelle.** `etq` (`damageService.js`)
  = armure portée sur la Localisation touchée, **soustraite** ; `rd` = `calcResistanceDommages(FOR, CON,
  mutations, avantages)`, un modificateur de robustesse corporelle (LdB p.114), **ajouté** — ce n'est
  **pas** une armure. `armorReductionFactor: 0.5` ne multiplie que `etq` ([:396](server/src/lib/damageService.js#L396))
  → « protections simples ÷2 » = exactement ça. `rd` correctement intouché. Appliqué **uniquement dans
  la branche `normal`** (cible à fiche) ; exo/drone ne passent pas par `resolveTargetHit` → épargnés
  gratuitement. ✓
- **#2 Choc 2D6 — NÉCESSITE UNE MIGRATION (périmètre non prévu).** `_weaponShockDsl` **refuse** de
  dériver le Choc de la seule colonne `ref_equipment.shock` — il exige `shock_mechanism` non-null
  (commentaire explicite : colonne `shock` encore peuplée pour des armes hors scope). La ligne
  Lance-flammes a `shock: '2D6'` mais `shock_mechanism: null` → **Choc non câblé**. Fix : migration
  `shock_mechanism = 'pure'` sur la ligne Lance-flammes (Choc quelle que soit la Localisation — même
  valeur que les Stun/soniques, vérifié dans le seed : deux valeurs existent, `'tete_gated'` pour les
  armes contondantes, `'pure'` pour les armes à choc). Une fois câblé, `getEffectiveWeaponDamage().choc`
  renvoie le DSL → passé comme `chocDsl` à `resolveTargetHit` **exactement comme le ferait le fusil à
  pompe** — pas de `chocDsl` construit à la main. `shock_reduced_by_armor` : la ligne vaut `true` (la
  norme ; seule la « Dague neurale Brain » est `false`) — le Choc est alors réduit par `prt`
  (protection_shock), **indépendamment** du ÷2 sur `etq`. **[À TRANCHER Saar]** : « protections ÷2 »
  réduit-il aussi `prt` (le Choc) ? Défaut proposé : non — « ÷2 » lu comme l'armure physique seule.
- **#3 Le tireur dans son propre cône — BUG CONFIRMÉ, exclusion explicite requise.**
  `queryTokensInShape` n'exclut **pas** le token du tireur (seuls `layer='gm'` et positions legacy).
  Le fusil à pompe (`ray`) inclut géométriquement le tireur mais `resolveShotgunSpread(0 m)` →
  bout_portant → `widthM: null` → `continue` : exclusion **accidentelle**. Le `cone` renvoie
  explicitement `true` pour un point à l'origine (`isPointInAoeShape` : « l'origine est toujours dans
  son propre cône ») et la branche lance-flammes n'a **pas** ce filtre bout-portant → **le tireur
  serait touché par son propre lance-flammes**. Fix : la branche lance-flammes filtre
  `candidate.tokenId === action.token_id` ; la décision B (auto-éclaboussure < 3 m) est un contrôle
  **séparé et délibéré** sur la proximité des **autres** cibles. + ajouter l'exclusion explicite du
  tireur au tronc commun (segment 0) — l'exclusion accidentelle du fusil à pompe est fragile.

### 1.3 Ce qui manque (synthèse — détail opératoire en §1.4)

- **Éligibilité UI** : la déclaration « Viser une zone » est gatée par `isShotgunSpreadWeapon`
  (`name === 'Klauss'`) dans `AssaultRangedPanel.jsx` / `CombatActionWindow.jsx:443` /
  `CombatGmDeclareWindow.jsx:339`. → remplacé par `isAoeWeapon(w) = w.aoe_profile != null` (segment 0b).
- **Aperçu de ciblage cône** : `aoePreviewShape.js` ne produit qu'un `ray` → variante `cone`
  (segment 1 pt 4).
- **Résolution serveur** : `resolveAoeAssaultAction` rejette tout ce qui n'est pas Klauss (`:3500`) →
  après le socle, `resolveFlamethrowerTargets` (fonction pure, segment 1 pt 5).
- **Feu continu** : `exposeToHazard` fixe `expiresAtTurn: null` → param optionnel (segment 1 pt 3).
- **Choc 2D6** : non câblé (`shock_mechanism: null`) → migration `= 'pure'` (segment 1 pt 2, #2).

### 1.4 Ordre de construction

**Le Lot 1 est précédé d'un socle** (§1.6, analyse critique 2026-09-03) : sans lui, chaque arme AOE
re-paie la dette (identification par nom, god-file, agrégat trop étroit, zéro test). Référence pro :
Foundry VTT **dnd5e** — la zone d'effet est une donnée (`target.template = { type, size, width, units }`
résolu via `CONFIG.areaTargetTypes`), jamais un `if` dans le code de résolution.

#### Segment 0 — Socle de résolution AOE (aggradation, prépare lance-flammes + grenades + suppression)

- **0a. Extraction `server/src/socket/socketCombatAoe.js`** — déplacer `resolveAoeAssaultAction` +
  `resolveAoeAttackRoll` (+ helpers AOE-only) dans un module dédié (miroir `socketCombatExo.js`).
  **Graphe d'import vérifié acyclique** : le module importe lib/services + 3 utilitaires de
  `socketCombatHelpers.js` (`fetchAssaultWeaponAndMods`, `resolveDroneIntegrityLoss`, …), jamais
  l'inverse. **Pur déplacement, zéro changement de comportement.** `node --check` + `node --test` +
  `npm run build`.
- **0b. Colonne `ref_equipment.aoe_profile` JSONB nullable** (migration ALTER + migration data par clé
  métier `name`, jamais `id` — core.md). Klauss `{ "shape": "ray", "mechanic": "shotgun_spread" }`.
  Bascule : `isAoeWeapon(w) = w.aoe_profile != null` (nouveau `shared/combatAoe.js`), consommé par les
  3 fenêtres de déclaration (remplace `isShotgunSpreadWeapon(ref_name)`) **et**
  `combatExclusiveActions.js` (teste `aoe_profile.mechanic`, plus `ref_name ===`) **et** le resolver
  (lit `aoe_profile.shape`/`.mechanic`). `aoe_profile` ajouté aux payloads arme (`inventoryService`,
  `/combat-equipment`). `isShotgunSpreadWeapon` retiré une fois tous les appelants migrés (pas laissé
  en doublon). Tests : `isAoeWeapon` pur ; `isExclusiveDeclaration` sur `mechanic`.
- **0c. `combat_action_targets.damage_modifier` → nullable** (migration) — chaque mécanisme y met ce
  qui a du sens, `null` accepté. (Le fusil à pompe continue d'y écrire `{ band, damageDice }`.)
- **0d. Refactor du corps de `resolveAoeAssaultAction`** en tronc + résolution par arme :
  - tronc : `resolveAoePhaseA` (jet + munitions + `DICE_RESULT` + catastrophe), `insertAoeTargetRows`,
    **exclusion explicite du tireur** des candidats (#3), `finalizeAoeResults` ;
  - **contrat de résolution par arme = FONCTION PURE** `resolveShotgunTargets(candidates, ctx) → perTargetResults[]`
    — `ctx` porte les données déjà fetchées (candidats, arme, metrics, settings, mr) ; **aucune
    écriture DB ni émission dedans** (tout dans le tronc). Testable avec fixtures, sans base (#5) ;
  - forme unifiée `perTargetResult = { tokenId, targetRowId, cibleType, band|null, results: [{ localisation|null, degautsBruts, degatsNets, severity|null, shockResult|null }] }` (décision F) ;
  - `finalizeAoeResults` : `outcome` = JSON `results` ; un `COMBAT_ATTACK_RESULT` par entrée `results`
    (MJ/PNJ, `isPnj: isPnjResult`) ; **un** `COMBAT_ATTACK_PLAYER_RESULT { targets: [{ name, band, results }] }`
    (PJ) — **refonte de l'agrégat de l'étape 10** + `CombatModifiersWindow` en boucle imbriquée.
  - **Tests unitaires `resolveShotgunTargets`** (nouveaux, fixtures). `node --test` + `eslint` +
    `npm run build` + **session Saar de non-régression fusil à pompe (PNJ + PJ)** — dégâts + liste
    identiques.
- **0e. Primitive `resolveTargetLocations(ctx, n) → results[]`** — fetch du contexte cible (armure/
  mutations/avantages/NA) **une seule fois**, boucle `n` jets de Localisation (#6). Le fusil à pompe
  bascule dessus avec `n = 1` (prouvé avant que le lance-flammes l'utilise avec `n = 1D3`). `node --test`.

*(0d/0e ne touchent PAS `resolveAssaultAction`/`resolveMeleeAction` — code humain le plus testé — ni la
dette §5 du dispatch drone. Périmètre = tronc AOE seul.)*

#### Segment 1+ — Lance-flammes (petit une fois le socle posé)

1. **Ligne de seed `aoe_profile`** pour Lance-flammes : `{ "shape": "cone", "angleDeg": 30, "mechanic": "flamethrower" }`
   (longueur = portée extrême du catalogue, lue par le resolver — §1.5-A). Migration data par clé métier.
2. **Migration `shock_mechanism = 'pure'`** sur la ligne Lance-flammes (#2).
3. **`exposeToHazard` : param `expiresAtTurn`** optionnel (défaut `null`). `exposeToHazard` lit l'expiry
   existant et pose `max(existant, currentTurn + roll('2D6') + 1)` (décision G). Contenu au service
   danger. Test : ticke N fois puis expire à N+1 ; re-exposer → durée = max, jamais raccourcie.
4. **Aperçu cône** — `aoePreviewShape.js` variante `cone` + `Canvas3D.jsx` (garde-fous perf/`key`
   comme l'aperçu ray). Validation navigateur Saar.
5. **`resolveFlamethrowerTargets(candidates, ctx)`** (fonction pure, ~40 lignes) : cône
   (`aoe_profile.angleDeg`, longueur = portée catalogue), **pas de dégression par portée**,
   `resolveTargetLocations(ctx, roll('1D3'))` par cible, `armorReductionFactor: 0.5` branche `normal`
   seule, `chocDsl` depuis `getEffectiveWeaponDamage().choc`. Effets de bord (feu continu, notice B1,
   auto-éclaboussure B2) posés par le tronc à partir du `perTargetResult`. `node --test` (fixtures) +
   session réelle.
6. Doc : décisions §1.5 A-G + E dans `JOURNAL8.md` ; `docs/SYSTEME/COMBAT.md` (nouveau § résolution
   AOE — le socle est durable, ce PLAN ne l'est pas — Règle 10) ; `client/public/CHANGELOG.md`.

*(Extinction du feu : rien à coder dans ce Lot — le MJ retire déjà le statut `burning` via la gestion
générique des statuts. Sous-lot différé « fenêtre personnage en feu » : §1.5-B2.)*

### 1.5 Décisions (tranchées avec Saar 2026-09-03 sauf mention — écart RAW = JOURNAL8)

- **A. Dimensions du cône — TRANCHÉ.** Principe Saar : le RAW a toujours raison, on n'ajuste que ce
  qu'il ne dit pas. Le RAW **donne la portée** (`range` catalogue `3/7/15/30 (40)`, transcrit du stat
  block LdB) — on ne la touche pas : **longueur du cône = 40 m** (portée extrême). "Portée
  relativement réduite" (`REGLEBOUCLIER.md:133`) est une comparaison aux armes à feu (portées en
  centaines de m), pas une affirmation que la flamme s'arrête avant 40 m. Le RAW **ne dit rien de
  l'angle** → seul paramètre libre : **30°** (±15° autour de la visée), choisi pour le réalisme (un
  lance-flammes projette un jet qui s'évase peu, pas un éventail). Rien dans le RAW n'est contredit.
- **B. Distance minimale / auto-éclaboussure — TRANCHÉ.** Si une cible touchée est à < 3 m du tireur,
  le tireur subit lui-même 1 hit `resolveTargetHit` + le feu continu (cohérent avec l'auto-ciblage
  AOE §5.5). **Exige un message explicatif clair** (Saar) : le tireur doit comprendre *pourquoi* il
  se prend des dégâts (« Tir en cône à moins de 3 m — le liquide enflammé vous a éclaboussé »).
  - **B1. Message d'entrée en feu — TRANCHÉ.** À l'application de `burning`, un `COMBAT_SYSTEM_NOTICE`
    (system + i18nKey) à la cible + MJ : dégâts par Tour, durée, « ou jusqu'à extinction ».
  - **B2. Extinction — le RAW ne dit RIEN du mécanisme — TRANCHÉ.** RAW : *"un feu très difficile à
    étouffer"* (`REGLEBLESSURES.md:654`) + durée 2D6 Tours même sans intervention. **Immédiat : rien à
    coder.** Le MJ retire déjà le statut `burning` via la gestion générique des statuts de token
    (déjà codée, déjà active) — pas de bouton dédié « Éteindre ».
    **Sous-lot ultérieur (accord Saar, à cadrer séparément)** : un personnage en feu voit son
    interface d'action normale (Déplacement/Tir/CaC…) **remplacée** par une fenêtre dédiée à **une
    seule action** « Se jeter au sol pour éteindre le feu » + **Test de Coordination**. Difficulté
    **décroissante à chaque Tour**, débute à un modificateur type « Difficile » (Saar : **+5** — valeur
    et convention de signe à confirmer contre l'échelle de Difficulté RAW au cadrage du sous-lot).
    Décision de conception, `JOURNAL8.md` le jour où le sous-lot se fait.
- **C. Choc 2D6 — TRANCHÉ.** Toutes les cibles du cône sont "directement aspergées" → Choc appliqué à
  toutes, **impact initial uniquement** (le feu continu n'inflige pas de Choc, RAW).
- **D. "Protections simples ÷2" — TRANCHÉ.** Lecture Saar : *simple = tout sauf exo-armure* (débat de
  jeu assumé, `JOURNAL8.md`). Concrètement : `armorReductionFactor: 0.5` **uniquement dans la branche
  `normal`** de la boucle (armure de fiche, `resolveTargetHit`). **Branche exo inchangée** (elle passe
  par `resolveExoDamage`, `resolveTargetHit` retourne déjà `null` pour une cible exo). **Branche drone
  aussi inchangée** — Saar : « le drone est comme l'exo-armure » (`calcDroneDegatsNets` sans facteur).
  **[À VÉRIFIER en codant]** si `ref_equipment` distingue quand même une armure "simple" d'une
  composite — si oui, affiner ; sinon la règle Saar (÷2 sur toute armure de fiche) est la référence.
- **E. Choc réduit par l'armure — TRANCHÉ (Saar : non).** Le ÷2 « protections simples » réduit `etq`
  (armure physique) **uniquement**. `prt` (protection_shock) reste plein — le Choc est amorti
  normalement par `prt`, indépendamment du ÷2.
- **F. Localisations multiples — forme de l'agrégat — TRANCHÉ (délégué, choix structurel).**
  Modèle unifié : **toute touche AOE affecte 1 à N Localisations du corps**. Le fusil à pompe est le
  cas N=1, le lance-flammes N=1D3. Une seule forme de donnée, pas un cas spécial : la résolution par
  arme renvoie, par cible, `{ tokenId, targetRowId, cibleType, results: [{ localisation|null,
  degautsBruts, degatsNets, severity|null, shockResult|null }] }` — drone/exo ont `results.length===1`
  avec `localisation: null`, fusil à pompe `results.length===1`, lance-flammes `1D3`. Le tronc commun
  (segment 0) : écrit `combat_action_targets.outcome` (JSON du tableau `results`), émet **un
  `COMBAT_ATTACK_RESULT` par entrée `results`** (MJ, PNJ) et **un** `COMBAT_ATTACK_PLAYER_RESULT
  { targets: [{ name, band, results: [...] }] }` (PJ). **Refonte de l'agrégat de l'étape 10** vers
  cette forme générale + `CombatModifiersWindow` en boucle imbriquée — refactor assumé (segment 0),
  pas un ajout bolt-on. Non-régression fusil à pompe = session Saar.
- **G. Cible déjà en feu — TRANCHÉ (Saar : remise au max).** **Correction du diagnostic** :
  `applyModStatus` fait **déjà** `.onConflict(['token_id','status_code']).merge()` (upsert) — le vrai
  risque n'est pas « la 2ᵉ brûlure est ignorée » mais « la 2ᵉ brûlure **remplace** `expires_at_turn`,
  donc un `roll('2D6')` faible peut *raccourcir* un feu qui avait plus longtemps à courir ». Fix
  contenu au service danger (pas de blanket change) : `exposeToHazard` lit la ligne existante et pose
  `expires_at_turn = max(expiry_existant, currentTurn + roll('2D6') + 1)` — « on ne peut que rendre le
  feu pire ». Un vrai *stacking* (plusieurs feux → double-tick) serait une refonte du système de
  dangers — hors périmètre, chantier propre si le besoin se confirme (noté, pas fait).

### 1.6 Socle de résolution AOE — analyse critique (2026-09-03, soutenue par Saar)

Le chantier AOE (fusil à pompe PNJ puis PJ) a laissé 5 dettes structurelles. Sans les résorber avant
d'ajouter la 2ᵉ arme AOE, chacune des 3 armes restantes (lance-flammes, grenades, suppression) re-paie
la même dette.

1. **L'AOE-ness est dans le code, pas dans la donnée.** `SHOTGUN_SPREAD_WEAPON_NAMES = Set(['Klauss'])`
   + `ref_name === 'Lance-flammes'` répétés dans `combatExclusiveActions.js`, les 3 fenêtres de
   déclaration, bientôt le resolver. Un renommage catalogue casse tout. **Foundry dnd5e** met la zone
   d'effet en donnée (`target.template = { type, size, width, units }`, résolu via
   `CONFIG.areaTargetTypes`). → colonne `ref_equipment.aoe_profile` JSONB nullable
   `{ shape, mechanic, params }` (segment 0b). Ajouter une arme AOE = une ligne de seed.
2. **`socketCombatHelpers.js` = god-file (3700+ l.).** Graphe d'import vérifié acyclique → extraire
   `socketCombatAoe.js` (miroir `socketCombatExo.js`, segment 0a).
3. **`combat_action_targets.damage_modifier notNullable` shotgun-shaped** → nullable (segment 0c).
4. **Zéro test DB sur la résolution AOE.** → contrat de résolution par arme = fonction pure
   `(candidates, ctx) → results[]`, DB/emit dans le tronc, testable avec fixtures (segment 0d).
5. **`resolveTargetHit` re-fetch le contexte cible à chaque appel** → × 1D3 pour le lance-flammes.
   Primitive `resolveTargetLocations(ctx, n)` : contexte fetché 1×, boucle `n` Localisations
   (segment 0e).

Le fusil à pompe (chemin le plus testé de l'AOE) est refactoré **à comportement identique** — chaque
segment 0a/0d clôturé par une session Saar de non-régression.

---

## 2. Lot 2 — Grenades et mines (partiellement bloqué)

### 2.1 RAW rencontrée [VÉRIFIÉ — transcription dans PLAN_AOE.md §1]

- Une grenade est **amorcée puis lancée** : 1 Tour de combat + **Test de Coordination**, Difficulté =
  modificateurs des Tests de tir liés à la taille de la cible/zone visée.
- Échec → la grenade atterrit à `modificateur d'échec` mètres du point visé, **direction aléatoire
  1D6** par rapport au centre.
- **Explosion au Tour suivant, au rang d'Initiative normal du lanceur.**
- Dégression par distance au point d'explosion (diamètre de zone) : centre <2 m → 1D3 Localisations,
  +1D10 ; courte 2-5 m → normal ; moyenne 5-10 m → -1D10 ; longue 10-20 m → -2D10 + Test de Chance ;
  extrême 20-30 m → -3D10 + Test de Chance (+5). **La réduction s'applique aussi aux Dommages de Choc.**
- Protections individuelles : normales. Couverture totale (résistante) → protège entièrement.
  Couverture partielle → -1 à -2D10 selon la protection.
- **Mines** : mêmes règles ; mine **enterrée** → portée ÷2 ; activée en marchant dessus → 1ère
  Localisation = **Jambe**. Compétence **Pièges** pour poser/camoufler.

### 2.2 Bloqué par

1. **Migration catalogue (§6c PLAN_AOE)** — les ~15 lignes `ref_equipment` category Grenade portent
   leur zone d'effet en **texte libre** dans `description`. Il faut des colonnes structurées (forme,
   amplitude, dégression standard vs rayon fixe) — audit ligne par ligne + migration.
2. **Champ payload `intendedOrigin`** — le lanceur vise un **POINT**, pas une direction (contrairement
   au fusil à pompe / lance-flammes). Nouveau champ dans `COMBAT_ACTION_DECLARE` (`aoe.intendedOrigin`)
   + déviation serveur (1D6 direction × marge d'échec du Test de Coordination) + **explosion différée**
   (nouveau : une action qui se résout au Tour *suivant*, au rang d'Ini du lanceur — pas d'infra
   d'action différée inter-tours à ce jour).
3. **RAW manquant** — 2 types de grenade (**neuro-charge**, **sonique**) n'ont **aucune donnée de
   zone** dans le RAW transcrit. **Pages du Livre de Base à fournir par Saar** avant cadrage complet.

### 2.3 Pas bloqué (utilisable dès la migration catalogue faite)

- Géométrie `circle` (`aoeShapes.js`) + `distanceBands` (`shared/world/distanceBands.js`, la
  dégression par palier existe déjà, écrite pour le fusil à pompe).
- Résolution par cible : `resolveTargetHit` (protections normales — pas de `armorReductionFactor`).
- 7 grenades à **nuage volumétrique** (fumigène, gaz…) = **hors scope v1** (PLAN_AOE §10 — persistance
  de zone, pas une explosion ponctuelle).

### 2.4 Mines — sous-lot séparé, hors scope v1

Dépend d'un système d'**entité-piège** (placement via Compétence Pièges, déclenchement au passage) qui
n'existe pas — proche des `entity_blueprints` / interactions d'entité mais pas identique. À cadrer
après le Lot 2 grenades.

---

## 3. Hors scope (tous lots)

- Test de Chance (grenades longue/extrême portée, comme le fusil à pompe) — aucune colonne Chance dans
  le schéma, chantier Chance différé (`ROADMAP.md` §4, `PLAN_AOE.md` §5.2).
- Nuages volumétriques / persistance de zone inter-tours (fumigène, gaz, et le « tir de suppression »
  de l'AOE) — même blocage, même report.
- Pénétration / bonus de protection +3 pare-balles du fusil à pompe (déjà noté hors scope AOE §12).

---

## 4. Plan de tests (Lot 1)

- `isAoeWeapon` / `isFlamethrower` : purs, `node --test` — Klauss + Lance-flammes éligibles, reste non.
- `exposeToHazard({ expiresAtTurn })` : `node --test` intégration — ticke N Tours puis le statut
  disparaît (purge de fin de Tour `expires_at_turn <= newTurn`).
- Non-régression fusil à pompe : le resolver partagé, `socketCombatHelpers.test.mjs` + suite complète.
- **Session réelle Saar** : PJ tire au lance-flammes → cône affiché, 2 cibles, chacune 1D3
  Localisations, Choc appliqué, armure ÷2 vérifiée sur une cible protégée, **feu continu qui ticke
  aux Tours suivants** puis s'éteint (2D6 Tours) ou est éteint manuellement (`clearHazard`) ; une cible
  à < 3 m → tireur touché (si décision B-ii). Cas 0 cible dans le cône.

---

## 5. Fouets et chaînes — hors périmètre de ce plan

`REGLES_ARMES_SPECIALES.md:3-17` : mécanique de **saisie** (Test de compétence -5 à -7 pour accrocher
cou/bras/jambe/arme), puis attirer / faire chuter / désarmer (Test de Force en opposition, malus -5/-7
si jambe(s) saisie(s)), se libérer par un Test de Coordination réussi chaque Tour. **Aucun rapport
avec l'AOE** — c'est du corps à corps avancé, rejoint le chantier **Arts martiaux / CaC avancé**
(`docs/REGLES/REGLECACARTMARTIAUX.md`, `ROADMAP.md` §2). Retiré du titre effectif de ce plan.

---

## 6. État d'implémentation

| Lot | Statut |
|---|---|
| **Segment 0 — Socle AOE** (§1.4/§1.6) | **Cadré (2026-09-03, analyse critique soutenue par Saar). Pas commencé.** 0a extraction `socketCombatAoe.js` · 0b `ref_equipment.aoe_profile` data-driven · 0c `damage_modifier` nullable · 0d tronc + résolution par arme (fonction pure) + agrégat étape 10 + tests · 0e primitive `resolveTargetLocations`. Non-régression fusil à pompe (PNJ+PJ) = sessions Saar. |
| Lot 1 — lance-flammes | **Cadré, décisions A-G tranchées. Bloqué par le segment 0.** Après socle : ligne de seed `aoe_profile` + migration `shock_mechanism='pure'` + `exposeToHazard` param + aperçu cône + `resolveFlamethrowerTargets` (fonction pure ~40 l.). |
| Lot 2 — grenades | Bloqué : migration catalogue + `intendedOrigin` + action différée inter-tours + 2 pages RAW (Saar). |
| Mines | Hors scope v1 (système entité-piège). |
| Fouets/chaînes | Hors périmètre (→ Arts martiaux). |
