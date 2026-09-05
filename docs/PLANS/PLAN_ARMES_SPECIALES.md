# PLAN_ARMES_SPECIALES.md — Armes spéciales (lance-flammes, grenades/mines, fouets/chaînes)

> Rédigé 2026-09-03, révisé 2026-09-05 (plan détaillé Segment 2b, §1.4bis) (Claude/Saar). Débloqué par le pipeline AOE (`PLAN_AOE.md`, fusil à pompe clos
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
- **0d. Refactor du corps de `resolveAoeAssaultAction`** (267 → ~110 l.) — tronc mince + une fonction
  pure de ciblage par mécanisme + helpers génériques. **PAS un framework à hooks** (2 mécanismes, on
  ne spécule pas) : le tronc garde un petit bloc `if (mechanic === 'shotgun_spread')` pour les 5 axes
  spécifiques (forme, filtre, `degautsBruts` avec dé de dispersion, `damage_modifier` de ligne, 1 Loc,
  facteur d'armure 1). Le lance-flammes (segment 1) ajoute son bloc frère.
  - **`filterShotgunHitTargets({ visibilityTargets, shooterTokenId, origin, directionDeg, refRange, amplitudeM, metrics }) → hitTargets[]`**
    — **FONCTION PURE** (le vrai livrable testable) : 2 passes géométriques (couloir large en amont,
    largeur réelle du palier par candidat), bout portant exclu (RAW), **tireur exclu explicitement**
    (#3, plus par accident via le filtre bout-portant). Aucune DB, aucune émission. Tests avec
    fixtures (`createWorldMetrics({ metersPerCell: 1, worldUnitsPerCell: 1 })`, candidats mock) :
    tireur exclu, sans-LOS exclu, bout portant exclu, dans le couloir large mais hors largeur de son
    palier exclu, en-palier inclus avec `band`/`spread` corrects.
  - **helpers génériques du tronc** : `runAoePhaseA({ db, character, weapon, confirmedModifiers, action })`
    (jet + `isTestBlockingWound` + `DICE_RESULT` + catastrophe → `{ rollResult, emissions, tireur… }`
    ou `{ blocked }`) · `decrementAoeAmmo(…)` · `insertAoeTargetRows({ db, actionId, hitTargets, modifierFn })`
    (`modifierFn(ht) → damage_modifier | null`) · `resolveAoeTargetDamage(io, db, campaignId, { ht, degautsBruts, locationsCount, armorReductionFactor, chocDsl, ammoFx })`
    (dispatch drone/exo/normal, garde `emitShockDiceResult`/`applyStun`, renvoie le `perTargetResult`
    normalisé) · `finalizeAoeResults({ perTargetResults, isPnjResult, rollResult, action })`.
  - **forme unifiée** `perTargetResult = { tokenId, targetRowId, cibleType, band|null, name, results: [{ localisation|null, degautsBruts, degatsNets, severity|null, is_lethal, shockResult|null }] }`
    (décision F). Fusil à pompe : `results.length === 1`. Drone/exo : 1 entrée, `localisation: null`.
  - `finalizeAoeResults` : `combat_action_targets.outcome` = JSON du tableau `results` ; **un
    `COMBAT_ATTACK_RESULT` par entrée `results`** (`isPnj: isPnjResult`) ; **un**
    `COMBAT_ATTACK_PLAYER_RESULT { hit, roll, seuil, tireurTokenId, cibleTokenId: null, targets: [{ name, band, results }] }`
    (PJ) — **refonte de l'agrégat de l'étape 10**.
  - **`CombatModifiersWindow`** : `attackResult.targets` → boucle imbriquée (nom + palier en tête,
    sous-lignes par entrée `results` : Localisation · nets · gravité). Réutilise `LOC`/`SEVERITY`
    (`shared/combatResultLabels.js`). Clés i18n `modifiers.aoeResult.*` adaptées.
  - **Non-régression fusil à pompe (PNJ + PJ)** : mêmes cibles touchées, mêmes dégâts, même liste
    affichée — **session Saar** en clôture. `node --test` (filterShotgunHitTargets + suite) + `eslint`
    client + `npm run build`.
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

### 1.4bis — Segment 1 codé + validé (2026-09-04) : CHANTIER FONCTIONNELLEMENT CLOS

**Codé, commité et poussé `dev/Saar` (`21fb40e`), validé en session réelle** (lance-flammes en main,
PJ/PNJ) : `a02fffc` 1a (`aoe_profile` cône) · `11ca524` 1b (`shock_mechanism='pure'`) · `63c0ce7` 1c
(`exposeToHazard({ durationDice })`) · `45e69db` 1d (aperçu cône, 12 tests) · `77ca97c` 1e (branche
mécanisme `flamethrower`) · `7130303` PC23 (armes spéciales exemptées de Tir Automatique) ·
`5c8a021`/`1f77116`/`21fb40e` — 3 correctifs trouvés en session réelle, détail `JOURNAL8.md`
§« Lance-flammes (main) » : `hasVariant`/`aimActive` non neutralisés en zone d'effet,
« changement de mode de tir » faux positif pour une arme à mode unique (`getStateTransitionReasons`),
Choc évalué par Localisation au lieu d'une fois par cible (`resolveAoeTargetDamage`, `i === 0`).

**Exo/drone confirmé sans UI de déclaration AOE** (les deux, pas seulement l'exo — vérifié
2026-09-04, voir Segment 2 ci-dessous).

**Dette structurelle introduite par 1e (à résorber au Segment 1.5 avant tout ajout) :**
- `resolveAoeAssaultAction` porte **6 branches `mechanic === 'flamethrower'`** dispersées (géométrie,
  ciblage, auto-éclaboussure, `modifierFn`, `degautsBruts`, feu continu). Le plan §1.4-0d prévoyait
  « un petit bloc » — devenu six. Insoutenable avec grenades (`circle`) + suppression + tireur exo.
- Hack : la pseudo-cible `isSelfSplash` injectée dans `resolveTargets` (le tireur devient une ligne
  `combat_action_targets` de sa propre action).
- Le `+ roll + 1` de purge de fin de Tour est maintenant **dupliqué** entre `clearHazard` (linger) et
  `exposeToHazard` — un seul fait, deux encodages.

#### Segment 1.5 — Registre de mécanismes AOE — CODÉ + VALIDÉ (2026-09-04), CHANTIER FONCTIONNELLEMENT CLOS

Modèle : **Foundry VTT dnd5e** — la résolution n'est jamais un `switch` sur le type ; une `Activity`
est polymorphe, la forme de zone est une donnée (`CONFIG.areaTargetTypes`). Précédent maison :
`combatantContextService.js` (Strangler Fig, `docs/Old/PLAN_COMBATANT_CONTEXT.md`) + `weaponModService`
(registre à hooks, `shared/weaponModRegistry.js`). Objet stratégie par mécanisme, `server/src/lib/
aoeMechanisms/{shotgunSpread,flamethrower}.js` + `registry.js` (`findAoeMechanismEntry`) :
`{ buildShape(ctx), filterTargets(ctx, visTargets), extraTargets(ctx, hitTargets),
targetRowModifier(ht), computeTargetDamage(ctx, ht, {effectiveDamage, baseRaw}), postResolve(io,
campaignId, ctx, perTargetResults) }`. Le tronc (`socketCombatAoe.js`) dispatche exclusivement via
`findAoeMechanismEntry`, **zéro `if mechanic`**. `buildShape(ctx)` décide sa propre origine (position
tireur pour cône/rayon) plutôt que de la recevoir imposée par le tronc — élargissement délibéré du
contrat (discuté avec Saar avant code) pour qu'un futur mécanisme `circle` lancé (grenade, Segment 3)
s'ajoute comme une entrée de registre sans nouveau refactor du tronc, via
`shared/world/aoeShapes.js#resolveScatter` (déjà écrit, jamais câblé). `ctx` immuable (spread à chaque
étape, jamais muté en place — correctif trouvé en analyse à charge du plan, avant tout code). Résorbe
aussi le hack pseudo-cible (`extraTargets`, self-splash lance-flammes) et la primitive `turnsFromNow()`
partagée (`environmentalHazardService.js`, commit séparé — cause racine distincte) pour le `+1` de
purge dupliqué entre `exposeToHazard`/`clearHazard`.

**Commité `dev/Saar`** : `1999ab4` (registre + tronc réécrit + `registry.test.mjs` 7 tests + imports
`socketCombatAoe.test.mjs` mis à jour, 27/27) · `9256e01` (`turnsFromNow`). **Aucun changement de
comportement visé (refactor pur)** — non-régression confirmée en session réelle par Saar sur les deux
armes (fusil à pompe + lance-flammes, PJ/PNJ) après le rebranchement du tronc.

#### Segment 2a — AOE tireur exo — CODÉ + VALIDÉ (2026-09-04), CHANTIER FONCTIONNELLEMENT CLOS

`resolveAoeAssaultAction` lisait `action.weapon_inv_id` (inventaire humain) → `if (!weapon_inv_id)
return` baillait pour tout tireur non-humanoïde. Adaptateur direct dans le tronc
(`fetchAoeShooterWeapon`/`decrementAoeShooterAmmo`, `socketCombatAoe.js`), même patron guard-clauses
que `combatantContextService.js#resolveCombatantTestContext` — dispatch pj/pnj/exo, drone → `null`
explicite (Segment 2b). `fetchExoWeapon` extraite/exportée depuis `socketCombatExo.js` (partagée avec
`resolveExoAssaultAction`, jamais une 2ᵉ copie de la jointure `exo_weapons ⋈ ref_equipment`).
`getEffectiveWeaponDamage` (ammo/mods-aware) reste strictement réservé à pj/pnj — `char_inventory`-only
par construction, exo/drone n'ont ni munitions ni mods dans ce sens (déjà vrai pour leur Tir/CaC
non-AOE). Côté client : `useExoDeclare.js` (état `aoeDirection`, pas de reducer — exclusivité
maintenue manuellement) + `CombatExoActionWindow.jsx` (section « Zone d'effet » si
`isAoeWeapon(selectedExoWeapon.ref_aoe_profile)`) + `buildExoMapActions` (branche `aoe.direction`) +
`CombatOverlay.jsx` (relais `onEnterAoeTargetMode`).

**3 bugs réels trouvés en session de validation Saar** (aucun dans le plan initial) :
1. `GET /:characterId/exo/weapons` (`char-sheet.js#selectExoWeaponFields`) ne sélectionnait pas
   `ref_equipment.aoe_profile` — sans elle le client ne peut jamais savoir qu'une arme exo est une
   arme de zone. Colonne ajoutée.
2. `combat.json#aimAoeButton` codait en dur « (fusil à pompe) » — déjà faux pour le lance-flammes
   humanoïde depuis le Segment 1 (jamais remarqué), encore plus faux pour l'exo. Généralisé en
   « Viser une zone », 3ᵉ consommateur désormais cohérent.
3. **`useAutoMoveMode` (survol de déplacement ambiant) jamais désarmé pendant la visée** —
   `CombatExoActionWindow.jsx` violait le contrat documenté par le hook lui-même (« `enabled` doit
   être faux tant qu'un autre mode exclusif utilise la carte »). Invisible pour le ciblage d'entité
   normal (surfaces de clic différentes — le survol déplacement n'écoute que le sol) mais en
   collision directe avec la visée de zone (même surface : le clic au sol). Symptôme réel : bouton
   « VISER UNE ZONE » affiché correctement, clic au sol sans effet, la fenêtre attendait une cible
   d'entité. Fix : `exoDeclare.isSelectingTarget` exposé, `useAutoMoveMode` gaté dessus (ordre d'appel
   des 2 hooks inversé pour permettre la dépendance, toujours inconditionnel — règle des Hooks
   respectée).

**Commité `dev/Saar`** : `183177e` (adaptateur serveur) · `a9cf858` (payload/endpoint/état) ·
`e5dbd9e` (UI) · `f9484f3` (fix useAutoMoveMode). Non-régression Tir/CaC exo classique confirmée
(chemin non-AOE inchangé, `fetchExoWeapon` partagée sans changement de comportement).

#### Segment 2b — AOE tireur drone — PLAN DÉTAILLÉ (2026-09-05, avant code — amendé après analyse à charge)

> Rédigé après lecture complète des chemins 2a (exo) et drone (déclaration + résolution) + du graphe
> de dispatch réel. Réplique du patron 2a. Débloque du même coup le **fusil à pompe monté sur drone**
> (tronc AOE déjà agnostique au mécanisme depuis le Segment 1.5).
>
> **Amendements de l'analyse à charge (2026-09-05)** — 4 points sous-spécifiés/faux dans la 1ʳᵉ rédaction :
> 1. Le câblage client touche **DEUX** hôtes (`CombatActionWindow` **et** `CombatGmDeclareWindow` —
>    drone géré MJ), pas un. Même piège que l'exo (`9a4d4b3`, fix MJ séparé).
> 2. L'exclusivité d'une Action de zone n'est câblée qu'à 1 des 3 sites de l'ANNONCE (humanoïde) —
>    tranché : la brancher aussi drone + exo (C4, bloc dédié en fin de section).
> 3. Dispatch de résolution vérifié bon, mais pour une autre raison qu'écrite : `resolveAoeAssaultAction`
>    est intercepté par `socketCombatResolution.js:403` **avant** la délégation interne de
>    `resolveAssaultAction` (`character.type === 'drone'`, `socketCombatHelpers.js:2921`).
> 4. Munition drone : grep exhaustif serveur → **aucun** décrément `ammo_restant` nulle part → no-op
>    confirmé cohérent (le plan avait raison sur le comportement, faux sur la cause « aucune colonne »).

**Périmètre.** Tireur drone d'une arme de zone (lance-flammes ou fusil à pompe montés sur
`drone_weapons`) : déclaration (« Viser une zone » dans le panneau drone, hôte joueur **et** hôte MJ)
+ résolution (le tronc `resolveAoeAssaultAction` cesse de bâiller sur `character.type === 'drone'`).
**Hors périmètre** : Segment 3 (grenades), tir de suppression, suivi de munition drone (dette
pré-existante), Choc d'arme sur cible (déjà générique dans le tronc). L'exclusivité d'une Action de
zone drone/exo **est** dans le périmètre (C4, tranché — bloc dédié ci-dessous).

**Invariant.** Une propriété métier = une autorité unique (AGENTS.md #3). La jointure
`drone_weapons ⋈ ref_equipment` de résolution ne doit exister **qu'une fois** — comme 2a l'a fait pour
l'exo (`fetchExoWeapon` extraite/partagée), 2b extrait `fetchDroneWeapon` de `resolveDroneAssaultAction`
et la partage avec le tronc AOE. Jamais une 2ᵉ copie.

**Serveur** (`socketCombatHelpers.js` + `socketCombatAoe.js`) :
1. **Extraire `fetchDroneWeapon(droneWeaponInvId)`** de `resolveDroneAssaultAction`
   (`socketCombatHelpers.js:2520-2532`) — exportée, mirror exact de `fetchExoWeapon`
   (`socketCombatExo.js:63`). Ajouter au SELECT `ref_equipment.id as equipment_id` (le tronc lit
   `weapon.equipment_id` pour la garde Choc, `socketCombatAoe.js:541`) et
   `ref_equipment.aoe_profile as ref_aoe_profile` (jamais lu par `resolveDroneAssaultAction` — additif,
   comportement Tir/CaC drone inchangé, même justification qu'en 2a). `resolveDroneAssaultAction`
   consomme désormais cette fonction (aucun changement de comportement — mêmes colonnes).
2. **`fetchAoeShooterWeapon` (`socketCombatAoe.js:149`)** : remplacer `if (character.type === 'drone')
   return null` (ligne 164) par une branche qui appelle `fetchDroneWeapon(action.drone_weapon_inv_id)`
   et normalise vers la forme que le tronc consomme :
   `{ equipment_id, ref_range, ref_damage_h: effective_formula, ref_aoe_profile, ref_name, display_name,
   ammo_remaining: null, ref_shock, ref_shock_mechanism, ref_shock_reduced_by_armor }`.
   `ammo_remaining: null` explicite (pas de suivi — cf. point 2 des vérifications). `null` si
   `!action.drone_weapon_inv_id` ou arme introuvable (même contrat que la branche exo).
3. **`decrementAoeShooterAmmo` (`socketCombatAoe.js:179`)** : la branche drone `if (character.type ===
   'drone') return` reste, mais **corriger le commentaire périmé** — `drone_weapons.ammo_restant`
   *existe* (`39_drone_weapons.js`), simplement le chemin Tir/CaC drone (`resolveDroneAssaultAction`)
   ne la décrémente pas non plus. No-op = cohérence avec l'existant, pas un gap propre à l'AOE.
   Harmoniser le suivi de munition drone est une dette distincte (`ROADMAP.md`).
4. **Endpoint `GET /:characterId/drone/weapons` (`char-sheet.js:1775`)** : ajouter
   `'ref_equipment.aoe_profile as ref_aoe_profile'` au SELECT (le seul champ manquant — `ref_range`,
   `ref_category`, `ref_fire_mode` sont déjà là, contrairement à l'exo avant 2a). Sans elle, le client
   ne peut jamais savoir qu'une arme drone est une arme de zone (`shared/combatAoe.js#isAoeWeapon`).
   *Opportuniste (pas requis)* : les 3 SELECT `drone_weapons` (GET/POST/PUT) sont recopiés à la main —
   les factoriser en `selectDroneWeaponFields` comme `selectExoWeaponFields`. À faire seulement si
   propre ; sinon GET seul (c'est lui que la fenêtre lit à l'ouverture).

**Client** — mirror `useExoDeclare`/`CombatExoActionWindow`, mais **DEUX fenêtres hôtes** montent
`useDroneDeclare` (vérifié) : `CombatActionWindow.jsx:168` (drone joueur) **et**
`CombatGmDeclareWindow.jsx:215` (drone géré MJ, `type === 'drone' && !user_id`). Les deux reçoivent
déjà `onEnterAoeTargetMode`/`combatAoeTargetMode` en prop (`CombatOverlay.jsx:233` et :278) et rendent
toutes deux `DroneDeclareSection` → `DroneWeaponPanel` (partagé — la section AOE elle-même n'est écrite
qu'une fois).
5. **`useDroneDeclare.js`** : nouvelle prop `onEnterAoeTargetMode` ; état `aoeDirection` (à plat, pas de
   reducer — comme l'exo) reset au changement de slot (`useEffect [tokenId]`, `:38`) et à la sélection
   d'arme ; `handleStartAoeDirection` (mirror `useExoDeclare.js:108`) — pose `setIsSelectingTarget(true)`
   puis `onEnterAoeTargetMode(tokenId, tokenPos, weapon?.ref_range, weapon?.ref_aoe_profile, onDir, onCancel)`.
   Les points qui posent `assaultTargetId` (`onMeleeTarget`/`onAssaultTarget`, `handleChooseTarget`)
   effacent `aoeDirection` et réciproquement (exclusivité manuelle, comme l'exo).
   `canDeclare`/`buildMapActions` intègrent `aoeDirection` comme cible valide.
   **Nettoyage du mode résiduel** : l'`useEffect [tokenId]` de reset doit aussi annuler un
   `combatAoeTargetMode` encore armé pour l'ancien slot — footgun connu (PLAN_AOE §12 étape 9 bug 1 :
   « mode armé pour l'ancien PNJ restait vivant après un changement de slot »). L'exo/humanoïde le font
   dans leur effet de reset ; le drone n'a pas ce garde aujourd'hui — soit `useDroneDeclare` reçoit
   `combatAoeTargetMode` pour l'annuler, soit chaque fenêtre hôte le fait dans son propre reset
   (aligner sur ce que fait déjà `CombatActionWindow`/`CombatGmDeclareWindow` pour `combatTargetMode`).
6. **`useAutoMoveMode` / `useCombatClickAttack` drone** : déjà gatés sur `!isSelectingTarget`
   (`useDroneDeclare.js:52,78`) — `handleStartAoeDirection` posant ce flag, les deux hooks ambiants se
   désarment **sans changement de structure** (contrairement à l'exo, qui a dû inverser l'ordre des
   hooks en 2a). Confirmé par lecture ; reste à valider en session.
7. **`buildDroneMapActions` (`buildDeclarePayload.js:274`)** : mirror `buildExoMapActions:315` — si
   `aoeDirection != null` et arme non-CaC → `{ attack: [{ droneWeaponInvId, targetTokenId: null,
   aoe: { direction } }] }`. Golden-master tests mis à jour.
8. **`DroneWeaponPanel.jsx` + `DroneDeclareSection.jsx`** : la section « cible » bascule en « Viser une
   zone » quand `isAoeWeapon(selectedWeapon?.ref_aoe_profile)` — mirror `AssaultRangedPanel.jsx:142` /
   `CombatExoActionWindow.jsx:330`. `DroneDeclareSection` propage les nouvelles props
   (`aoeDirection`, `onStartAoeDirection`, l'arme sélectionnée pour `isAoeWeapon`) de la fenêtre vers
   `DroneWeaponPanel`. Clés i18n partagées (`combat.json` : `assaultPanel.aoeSection`,
   `assaultPanel.aimAoeButton`, `assaultPanel.aoeDirectionValue`, `common.changeButton`) — aucune clé
   neuve *a priori*. **Style** : `DroneWeaponPanel` utilise des styles inline (thème teal, antérieur à
   la migration `.btn-*`) — garder le style local du panneau pour le bouton, pas y importer
   `.btn-tac-ghost` (cohérence visuelle interne du panneau ; seule l'i18n est partagée).
9. **`CombatActionWindow.jsx` ET `CombatGmDeclareWindow.jsx`** : chacune threade `onEnterAoeTargetMode`
   (déjà reçu en prop) dans son appel `useDroneDeclare`, et passe `aoeDirection`/`handleStartAoeDirection`
   + l'arme sélectionnée à `DroneDeclareSection`. `isHidden`/`opacity` de chaque fenêtre : déjà dérivés
   de `combatAoeTargetMode?.tokenId === <token>` (`CombatActionWindow.jsx:981`,
   `CombatGmDeclareWindow.jsx:679/682`, agnostiques au type de tireur) — rien à ajouter.

**Séquençage (commits isolés, un invariant à la fois) :**
- **C1 — refactor pur** : extraire `fetchDroneWeapon` de `resolveDroneAssaultAction` (+ `equipment_id`
  + `aoe_profile` au SELECT), re-câbler `resolveDroneAssaultAction` dessus. 0 changement de
  comportement. Test : non-régression Tir/CaC drone (`node --test`, import ESM), scénario réel drone
  classique en session.
- **C2 — serveur AOE drone** : branche drone de `fetchAoeShooterWeapon` + `decrementAoeShooterAmmo`
  (commentaire) + endpoint `aoe_profile`. Test : `socketCombatAoe.test.mjs`.
- **C3 — client 2 fenêtres + panneau partagé** : points 5-9. Test : `buildDeclarePayload.test.mjs`,
  lint, build, session réelle Saar (drone joueur **et** drone MJ, lance-flammes **et** fusil à pompe).
- **C4 — exclusivité au bon niveau d'autorité** (voir bloc ci-dessous) : câbler
  `isExclusiveDeclaration`/`getAoeExclusiveIneligibilityReasons` aux branches drone **et** exo de
  `socketCombatAnnouncement.js` (aujourd'hui humanoïde-only). Ajoute `ref_equipment.aoe_profile as
  ref_aoe_profile` (+ `ref_fire_mode` pour le drone) aux 2 requêtes d'arme de l'ANNONCE, puis le même
  garde que la branche humanoïde (`:460-479`). Note RAW en `JOURNAL8.md`. Test : `combatExclusiveActions.test.mjs`
  (déjà agnostique), scénario session (drone lance-flammes + déplacement → refusé).

**Points de vérification AVANT code (à trancher au tour suivant, pas pendant) :**
1. **Chemin de déclaration MJ du drone** — confirmer que `CombatGmDeclareWindow` est bien le seul autre
   hôte (pas un 3ᵉ chemin), et que son `DroneDeclareSection` rend le même `DroneWeaponPanel` sans
   surcouche (vérifié : `:770`, `onChooseTarget` déjà câblé — la visée de zone s'ajoute au même
   endroit).
2. **Nettoyage `combatAoeTargetMode` résiduel** au changement de slot — décider où (dans le hook ou
   dans chaque fenêtre) en s'alignant sur le traitement existant de `combatTargetMode`.
3. **Arme drone « maison »** (`label_override` sans `equipment_id`) — `ref_aoe_profile` nul →
   `isAoeWeapon(null) === false` → jamais proposée en zone. Correct par construction, à confirmer.
4. **Preview `Canvas3D`** — `combatAoeTargetMode` + `aoePreviewShape.js` sont shooter-agnostiques
   (lisent `tokenPos`/`ref_range`/`aoe_profile`), le drone en hérite. Le garde de fraîcheur
   `aoeArmedMovedRef` (PLAN_AOE §12 étape 9 bug 5) aussi. Rien à coder, à confirmer.

**Exclusivité d'une Action de zone sur plateforme non-humanoïde — TRANCHÉ (2026-09-05, jugement délégué par Saar : « le plus robuste / pérenne / adaptatif »).**

Constat d'architecture : `isExclusiveDeclaration`/`getAoeExclusiveIneligibilityReasons`
(`shared/combatExclusiveActions.js`) sont **déjà une autorité unique, pure, agnostique au type de
tireur** (clé = `aoe_profile.mechanic`). Le défaut n'est pas dans la décision — il est dans son
**enforcement** : le garde n'est appelé qu'à **un** des trois sites de l'ANNONCE
(`socketCombatAnnouncement.js:460`, branche `else` humanoïde). Drone et exo déclarent aujourd'hui un
lance-flammes sans que personne n'interroge l'autorité (gap 2a déjà livré pour l'exo, jamais comblé).

Décision : **câbler le garde aux 3 sites** (C4). Raisons :
- *Une mécanique = une autorité unique* (AGENTS.md #3). Un lance-flammes est un lance-flammes : le coût
  tactique (balayer un cône de liquide enflammé = l'action du Tour) ne dépend pas du châssis qui le
  porte. Le RAW est **muet** sur les armes de zone montées → le défaut sain est « la règle de l'arme
  s'applique », jamais « elle ne s'applique pas parce qu'on a oublié de la brancher ».
- *Adaptatif* : quand une grenade lancée ou le tir de suppression arrivera sur drone/exo, le même site
  les couvre sans nouveau code.
- *Pérenne* : l'option inverse (« lance-flammes exclusif, sauf sur drone ») crée une divergence
  permanente que chaque futur dev doit mémoriser et qui contredit la fonction pure centrale.
- Impact réel étroit : seules les armes de zone sont concernées (rares sur drone/exo) ; une arme drone
  normale est inchangée. Le drone perd son déplacement **uniquement** le Tour où il tire au
  lance-flammes — c'est le compromis voulu, identique à l'humanoïde.

Écart RAW à écrire en `JOURNAL8.md` : le RAW lie « Action exclusive » au *tir continu* (zone élargie),
l'implémentation traite déjà **toute** gerbe lance-flammes comme exclusive pour l'humanoïde
(simplification produit tranchée Saar 2026-08-26, §1.5) — C4 étend cette même simplification, cohérente,
à drone + exo, plutôt que d'introduire une 3ᵉ lecture.

Non bloquant pour C1-C3 : l'ordre reste C1 → C2 → C3 → C4, chacun validé avant le suivant.

**Tests :**
- `buildDeclarePayload.test.mjs` — golden master `buildDroneMapActions` avec `aoeDirection`.
- `socketCombatAoe.test.mjs` — `fetchAoeShooterWeapon` renvoie une arme normalisée pour un tireur
  drone (aujourd'hui `null`).
- `node --check` serveur, `node --test 'shared/**'`, `cd client && npm run lint && npm run build`.
- Session réelle Saar : drone avec lance-flammes **et** drone avec fusil à pompe montés → « Viser une
  zone », 2-3 cibles à paliers différents, dégâts + feu continu (lance-flammes) corrects, combat se
  termine ; non-régression Tir/CaC drone classique.

#### Segment 3 — Grenades

Un objet mécanisme `circle` sur le registre du Segment 1.5 (+ le reste des blocages §2 ci-dessous).

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
| **Segment 0 — Socle AOE** (§1.4/§1.6) | **Codé + validé en session (2026-09-04).** 0a extraction `socketCombatAoe.js` (`8d86090`) · 0b-B `shared/combatAoe.js` (`5df482f`) · 0c+0b-A migrations `aoe_profile`/`damage_modifier` (`0a35245`) · 0b-C bascule identification data-driven (`b87aa1a`) · 0d-1 `filterShotgunHitTargets` pure + 9 tests (`11f6997`) · 0d-2 refactor tronc + forme `results` 1..N Loc + refonte agrégat + `CombatModifiersWindow` imbriqué (`830f229`) · cas 0 cible (`1613467`). **0e** (fetch-once) = perf, différé. |
| **Segment 1 — lance-flammes (main)** | **Codé + VALIDÉ en session réelle (2026-09-04), poussé `dev/Saar` (`21fb40e`). CHANTIER FONCTIONNELLEMENT CLOS** — détail complet `JOURNAL8.md` §« Lance-flammes (main) ». 4 bugs réels trouvés et corrigés en session (`hasVariant`/`aimActive` non neutralisés en AOE, PC23 armes spéciales, « changement de mode de tir » faux positif arme à mode unique, Choc évalué par Localisation au lieu d'une fois par cible) + Catastrophe ×4 investigué (non-bug, Seuil PNJ bas). |
| **Segment 1.5 — registre de mécanismes AOE** | **Codé + VALIDÉ en session réelle (2026-09-04), poussé `dev/Saar` (`1999ab4`, `9256e01`). CHANTIER FONCTIONNELLEMENT CLOS.** Refactor pur (objet stratégie par mécanisme, zéro `if mechanic` dans le tronc) — résorbe les 6 branches + le hack pseudo-cible + le `+1` de purge dupliqué. Non-régression fusil à pompe + lance-flammes confirmée par Saar. Détail §1.4bis. |
| **Segment 2a — AOE tireur exo** | **Codé + VALIDÉ en session réelle (2026-09-04), poussé `dev/Saar` (`183177e`..`f9484f3`). CHANTIER FONCTIONNELLEMENT CLOS.** Adaptateur serveur (`fetchAoeShooterWeapon`/`decrementAoeShooterAmmo`) + UI `CombatExoActionWindow`/`useExoDeclare`. 3 bugs réels trouvés en session (colonne `ref_aoe_profile` manquante côté endpoint, libellé bouton codé en dur, `useAutoMoveMode` jamais désarmé pendant la visée — collision avec le clic au sol de l'AOE). Détail §1.4bis. |
| **Segment 2b — AOE tireur drone** | **Prochain — plan détaillé + analyse à charge faits (2026-09-05, §1.4bis).** 3 commits isolés : C1 refactor `fetchDroneWeapon` (extraction de `resolveDroneAssaultAction`, 0 comportement), C2 serveur AOE drone (branche `fetchAoeShooterWeapon` + endpoint `aoe_profile`), C3 client **2 fenêtres hôtes** (`CombatActionWindow` joueur + `CombatGmDeclareWindow` MJ) + `DroneWeaponPanel` partagé ; C4 câble l'exclusivité d'une Action de zone aux branches drone + exo de l'ANNONCE (aujourd'hui humanoïde-only — autorité pure déjà agnostique, seul l'enforcement manquait). Dispatch résolution vérifié (interception `socketCombatResolution.js:403`). Débloque aussi le fusil à pompe monté sur drone. |
| Segment 3 — grenades | Un objet mécanisme `circle` sur le registre 1.5. Reste bloqué par : migration catalogue + `intendedOrigin` + action différée inter-tours + 2 pages RAW (Saar). |
| Mines | Hors scope v1 (système entité-piège). |
| Fouets/chaînes | Hors périmètre (→ Arts martiaux). |
