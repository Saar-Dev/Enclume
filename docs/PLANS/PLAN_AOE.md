# PLAN_AOE.md — Résolution de zone d'effet (AOE)

> Version 11 — 2026-09-03 (Claude/Saar). **Statut : étape 9 (UI de ciblage) close, confirmée par Saar
> en session réelle.** §12 (État d'implémentation, en pied de document) tient la liste vivante de ce
> qui est codé/testé/en attente — ne pas laisser diverger, c'est la source de vérité de l'avancement
> réel, pas cette bannière.
>
> **v9 → v10 — 2 bugs trouvés en test réel, dont une prémisse fausse de v9 corrigée par un retour
> arrière assumé.**
> 1. **Bug de donnée, pas de logique** : `/combat-equipment` (fenêtre MJ) ne sélectionnait jamais
>    `ref_name`/`ref_range` (seul `name`, sans alias, l'était) — `isShotgunSpreadWeapon(weapon?.ref_name)`
>    valait donc toujours faux pour un PNJ, quelle que soit l'arme. "Viser une zone" n'apparaissait
>    jamais. Corrigé en ajoutant les deux alias (additif, même convention que `inventoryService.js`
>    côté PJ qui les avait déjà). Effet de bord positif confirmé : la détection de palier de portée du
>    clic-attaque ambiant PNJ, qui lisait la même donnée manquante, est réparée du même coup.
> 2. **`CombatModifiersWindow.jsx` bloquait la résolution d'une action de zone** : la case Portée se
>    pré-remplit depuis la distance tireur→cible, or une zone n'a pas de cible unique — case vide,
>    "Lancer" refusait de partir sans sélection manuelle. Vérifié : `resolveAoeAssaultAction` ne lit
>    de toute façon jamais `confirmedModifiers.portee` (recalculée par cible touchée). Section masquée
>    et gate levée pour une action de zone, rien d'autre touché.
> 3. **Prémisse fausse de v9, corrigée par retrait plutôt que complétée** : v9 traitait Zone d'effet
>    comme un raffinement de tir optionnel, exclusif avec Tir Multi/Tir visé au même titre que
>    dual-wield/localisation (bouton grisé + raisons, `getAoeTargetingIneligibilityReasons`). Faux —
>    confirmé par Saar et par le code serveur déjà écrit (étape 8 : bout portant "ne touche personne
>    en v1", jamais "cible unique normale") : le Klauss n'a **aucun** mode de tir normal, la dispersion
>    est obligatoire à chaque tir. Ce n'est pas une exclusivité à arbitrer, c'est une arme qui n'offre
>    tout simplement pas les autres sections. Retiré (pas laissé en dead code) : `getAoeTargetingIneligibilityReasons`/
>    `isAoeTargetingEligible` et le paramètre `isAoeMode` de `getMultiShotIneligibilityReasons`
>    (`shared/combatExclusiveActions.js`), la prop `aoeIneligibilityReasons` et son calcul dans les deux
>    fenêtres. Gardé : `isAoeMode` sur `getAimIneligibilityReasons` **côté serveur seulement**
>    (défense en profondeur contre un client forgé, indépendante de l'UI affichée). `AssaultRangedPanel.jsx`
>    bascule maintenant en un `if (isAoeEligible) return <section Zone d'effet seule>` avant le rendu
>    normal — Tir Multi/Type de tir/détail CC-RC-RL/Localisation visée ne s'affichent simplement plus
>    pour cette arme.
>
> **v8 → v9 — étape 9 (UI de ciblage) démarrée, 4 corrections de Saar sur un premier plan trop prudent.**
> Le plan initial (MJ/PNJ seulement, cône visuel, survol+Valider en deux temps) a été présenté puis
> corrigé point par point avant tout code :
> 1. **Restriction PJ/MJ infondée** — relecture de la bannière v7→v8 ci-dessus : le rejet "tireur PJ"
>    ne concerne QUE la résolution (fenêtres `confirmedModifiers`/`armAwaitingDamage` à reworker,
>    ci-dessus) — la DÉCLARATION est une fenêtre différente, explicitement dite indépendante ("rien
>    n'empêche de l'avancer en parallèle"). `CombatActionWindow.jsx` (PJ) est donc câblé en même temps
>    que `CombatGmDeclareWindow.jsx` — le rejet serveur au clic sur "Valider" (déjà codé, message clair)
>    reste le seul garde-fou tant que la résolution PJ n'existe pas, même patron que Tir de
>    suppression/Lance-flammes déjà en prod.
> 2. **Cône rejeté aussi côté aperçu client, pas seulement côté résolution** — la RAW est un palier
>    discret (1/2/3/3m, `SHOTGUN_SPREAD_BY_BAND`), un cône à angle fixe (continu, proportionnel à la
>    distance) la représenterait mal dans les deux sens (sous- ou sur-estimation selon le point de
>    calibration). Retenu : aperçu en rectangles empilés, un par palier RAW (`aoePreviewShape.js`,
>    nouveau, testé), même formule géométrique que `isPointInAoeShape` (branche `ray`) — l'aperçu montre
>    exactement ce que la résolution va tester.
> 3. **Interaction simplifiée à un clic** — un survol continu + bouton "Valider" séparé (calqué à tort
>    sur `combatTargetMode`) est remplacé par un clic direct (sol ou token, sans distinction — le
>    listener `pointerup` du canvas est natif, tourne toujours quel que soit ce qu'un `pointerdown` de
>    token a intercepté en amont, vérifié) qui commet la direction, mirroir `combatMoveMode` en plus
>    simple (aucun budget à porter).
> 4. **"Tout token dans la zone résout, allié compris"** — déjà vrai, vérifié dans le code déjà livré
>    (étape 4/8) : `queryTokensInShape` ne filtre par aucune allégeance (seuls les tokens MJ-marqueur et
>    les positions legacy sont exclus). Aucun code à ajouter pour ce point.
>
> **Trouvailles en cours de code, non anticipées par le plan :** (a) `weapon.ref_name !== 'Klauss'`
> n'existait qu'en un seul endroit (`socketCombatHelpers.js`) — extrait en `isShotgunSpreadWeapon`
> (`shared/combatRange.js`), seule autorité, consommée par le serveur ET les deux fenêtres de
> déclaration (CLAUDE.md §3 — pas de logique dupliquée client/serveur) ; (b) `AssaultRangedPanel.jsx`
> est déjà le composant Tir partagé PJ/MJ (pas dupliqué) — le markup "zone d'effet" n'existe donc qu'à
> UN endroit, pas deux ; (c) `CombatGmDeclareWindow.jsx#assaultCheck` calculait `targetsFilled`/
> `targetsNeeded` sans connaître le mode zone — sans correctif, poser une direction n'aurait jamais
> débloqué "Valider" (corrigé, réutilise `assaultDecl.isAoeMode`) ; (d) `Canvas3D.jsx` échouait déjà
> `npx eslint` avant cette session (12 erreurs `react-hooks/refs` sur le patron "P40" pré-existant,
> vérifié par diff contre HEAD) — non corrigé (hors périmètre AOE), mais la nouvelle ref
> `combatAoeTargetModeRef` utilise un `useEffect` plutôt que de reproduire le patron flagué.
>
> **Toujours hors périmètre de cette tranche, gaps connus et non comblés à ce stade** : `declareChecks.js`
> ne gate pas encore l'exclusivité Zone d'effet ⊕ Tir Multi/Tir visé (le bouton reste visible même
> combiné) ; `buildDeclarePayload.js` ne construit encore aucun `aoe.direction` — même une fois la
> fenêtre PJ et le threading `SessionPage` posés, "Valider" n'enverra pas encore la direction au
> serveur tant que ce fichier n'est pas touché.
>
> **v7 → v8 — Phase B (couche 4) codée pour le fusil à pompe, tireur PNJ uniquement.** Trois
> trouvailles en cours de route, toutes documentées à leur site de code plutôt que seulement ici :
> 1. **Un refactor concurrent (chantier EXO-ARMURE, commit `d06d41c`) a extrait un patron de dispatch
>    par TYPE DE CIBLE déjà généralisé** (`resolveAttackHit{Drone,Exo,Pnj,Pj}` pour les tireurs
>    drone/exo, `resolveAssaultHit{Pj,PnjDrone,PnjNormal}` pour les tireurs humanoïdes) — ctx assemblé
>    par l'appelant, aucune des deux familles ne dépend de l'identité de l'attaquant au-delà du ctx.
>    Confirme et durcit le choix déjà pris en §5.1/§7 (réutiliser l'existant, jamais un pipeline de
>    dégâts dupliqué) mais change le point d'accroche exact : la Phase B ci-dessous appelle directement
>    `damageService.resolveTargetHit`/`exoAvarieService.resolveExoDamage`/`resolveDroneIntegrityLoss`
>    en boucle (même niveau que ces fonctions-feuilles), pas les 2 "sites d'appel `getEffectiveWeaponDamage`"
>    envisagés en v1-v7 — plus proche du code réel une fois lu.
> 2. **RAW relu intégralement** (`docs/REGLES/REGLES_ARMES_SPECIALES.md:18-52`, jamais fait avant
>    aujourd'hui — seul un extrait partiel circulait depuis le début de ce chantier) : (a) un fusil à
>    pompe n'a **aucune branche "raté"** — même un Test de tir raté touche toutes les cibles de la zone,
>    seule la marge module les dégâts (§5.2 : le §12 avait déjà anticipé "auto-touché pour tous" mais
>    sans la citation RAW exacte) ; (b) **aucune colonne "Chance" n'existe dans le schéma** (grep sur
>    toutes les migrations, zéro résultat) — le "Test de Chance" RAW à longue/extrême portée ne peut donc
>    pas être auto-résolu par un jet fabriqué sans seuil réel ; la décision v4 (§5.2, "le serveur résout
>    automatiquement") est affinée : en v1, "automatique" veut dire **ignoré**, pas un faux jet — écart
>    RAW explicite (CLAUDE.md §1.9), détail en §5.2 corrigé ci-dessous ; (c) bonus de protection +3
>    (gilet pare-balles/couverture légère face à un fusil à pompe précisément) et blocage par une cible
>    interposée : non modélisés, gap RAW connu et documenté, hors scope (nuance d'armure/occlusion, pas
>    une question de géométrie AOE).
> 3. **La géométrie couche 1 (`cone`/`ray` à angle ou largeur FIXE) ne modélise pas exactement une
>    largeur qui croît par PALIERS discrets** (1m/2m/3m/3m RAW) — approximation retenue : couche 2
>    interroge avec le couloir le PLUS LARGE possible (sur-inclusif, filtre grossier), puis chaque
>    candidat est retesté avec la largeur RÉELLE de son propre palier (deux passes géométriques,
>    `isPointInAoeShape` appelé deux fois par candidat, jamais une nouvelle forme dans `aoeShapes.js` —
>    couche 1 reste inchangée, §2/§6 toujours à jour tels quels).
>
> **Périmètre volontairement réduit de cette tranche** (un problème à la fois, CLAUDE.md §6.8) :
> tireur PJ explicitement rejeté avec message clair (le pipeline PJ différé `armAwaitingDamage`/
> `confirmDamage` est le code le plus partagé de `socketCombatHelpers.js` — y porter le modificateur de
> dispersion mérite son propre petit ajout additif isolé, pas un bricolage sous cette même tranche) ;
>
> **Décision de séquencement (Saar, 2026-08-27)** : un chantier de rework est en cours de planification
> pour séparer les fenêtres de modificateurs/confirmation par type de combattant (DRONE/HUMAN/
> EXO-ARMURE), aujourd'hui partagées. Ce tuyau (`confirmedModifiers`, `armAwaitingDamage`/
> `confirmDamage`) est exactement celui que la tranche tireur PJ ci-dessus doit étendre — la coder
> avant ce rework risquerait d'être immédiatement à refaire une fois la séparation posée. **Le reste-à-
> faire "tireur PJ" attend donc ce rework, pas l'inverse.** Le reste du chantier AOE n'est pas concerné
> (l'UI de ciblage à la Déclaration, étape 9, est une fenêtre différente de celle visée par ce
> rework — rien n'empêche de l'avancer en parallèle) ;
> tir de suppression et lance-flammes rejetés avec message clair (aucune table de dégât RAW extraite
> pour eux, contrairement au fusil à pompe) ; dual-wield ignoré pour l'AOE (cas RAW marginal). Détail
> complet en §12, ligne étape 8.
>
> **v6 → v7 — correction du "de-risking" annoncé en v6, en partie faux.** Lecture directe du catalogue
> réel (`303_ref_equipment_seed.js`) plutôt que de la RAW seule : il existe **8 types de grenades**
> distincts dans `ref_equipment` (concussion, incendiaire, étourdissante, assommante, à énergie,
> fumigène, à gaz, sonique), chacun avec sa propre zone d'effet **décrite en texte libre dans
> `description`**, jamais dans une colonne structurée. Conséquences :
> - Le tableau RAW à paliers (2/5/10/20/30m, dégression) extrait de `REGLES_ARMES_SPECIALES.md` ne
>   s'applique vraisemblablement qu'à la grenade "à concussion" (fragmentation standard) — les autres
>   ont un **rayon fixe unique, sans dégression** (ex. incendiaire "5m de diamètre", étourdissante
>   "20m"), lu dans leur description, jamais dans une donnée exploitable par le serveur.
> - Le "c'est probablement une constante de code" de la v6 était donc incomplet pour les grenades : il
>   faut de vraies colonnes structurées dans `ref_equipment` (forme + amplitude AOE par ligne) — un
>   vrai travail de catalogue (migration + saisie), pas une constante écrite une fois. Reste vrai pour
>   le fusil à pompe (`resolveWeaponRangeBand`/`ref_range` déjà exploitable tel quel, voir §4).
> - **Fumigène et "à gaz" sont hors scope du module AOE** — confirmé par Saar : leur zone ("30 mètres
>   cube") n'est pas un rayon/cône/couloir géométrique, c'est un nuage qui se propage par compartiments,
>   déjà couvert par le mécanisme existant `worldEffects.js`/`propagateEffectThroughCompartments`. Ces
>   deux grenades ne passeront jamais par `aoeShapes.js` — retirées du périmètre, pas juste différées.
>
> **v5 → v6** — début du codage (étapes 2-6a du §8), deux trouvailles en cours de route :
> (1) `shared/combatRange.js#resolveWeaponRangeBand` existait déjà et fait presque exactement ce que
> `resolveDistanceBand` (§4) fait pour l'AOE — même algorithme, mêmes 5 noms de palier RAW
> (`bout_portant/courte/moyenne/longue/extreme`), volontairement pas fusionnés (tolérance aux données
> dégénérées différente, cross-référencés dans les deux fichiers). Aurait dû être trouvé avant d'écrire
> §4 — pas trouvé par la recherche initiale, seulement en recreusant suite à une question de Saar sur
> la correspondance RAW zone-d'effet/portée ; (2) conséquence directe : le "catalogue de dégression"
> annoncé comme point ouvert (§6.2/§10) est très probablement plus léger que prévu — pour le fusil à
> pompe, le classement par palier réutilise déjà `ref_equipment.ref_range` via `resolveWeaponRangeBand`
> (zéro nouvelle colonne), et les tables RAW (largeur de zone, modificateur) sont vraisemblablement des
> constantes fixes (comme `RANGE_BANDS` l'est déjà) plutôt que du catalogue par arme — à confirmer une
> fois la question grenades (types à rayon variable ou non, recherche Saar en cours) tranchée.
>
> **v4 → v5** — 3ᵉ analyse à charge, cette fois centrée sur l'auto-cohérence du document et sur les
> réutilisations affirmées sans être vérifiées jusqu'au bout. Trouvailles : (1) deux renvois internes
> cassés par les éditions précédentes (§5.1 pointait vers l'ancien §6.2 devenu autre chose ; §11
> pointait vers l'ancien §5.3 devenu autre chose) — corrigés ; (2) la comparaison Foundry (modèle de
> confiance client vs serveur) n'avait jamais été écrite dans le document, seulement dite en
> conversation — ajoutée en §2.3 (Règle 2 `RegleDocumentaire.md` : une décision non écrite n'est pas
> vraiment prise) ; (3) auto-ciblage du lanceur par sa propre AOE — cas RAW réel (distance minimale
> lance-flammes, dispersion grenade), jamais traité avant cette version — §5.5 ; (4) l'amplitude d'un
> pouvoir Force Polaris **dépend du résultat du jet** (RAW : *"Zone d'effet : 5m +/- modif. de
> réussite"*), ce n'est pas une constante à clamper comme pour les armes — §6.2 recorrigé, deux régimes
> distincts ; (5) `isExclusiveDeclaration` ne couvre **pas encore** les actions AOE — son propre
> commentaire de code le dit — la v3/v4 avait présenté ça comme une réutilisation gratuite, c'est en
> fait du code neuf (petit) — §1/§7/§8 corrigés. Même défaut de sur-confiance que la première correction
> SHRAPNEL (v2) : trouver qu'une fonction existe (`grep`) n'est pas la même chose que vérifier qu'elle
> couvre le cas visé (lire le corps de la fonction).
>
> **v3 → v4** — décisions de Saar sur les 4 derniers points ouverts : (1) direction de dispersion
> confirmée alignée avec la lecture du schéma RAW (§6.1, résolu) ; (2) mécanique de point de Chance
> reconnue comme un chantier séparé (bouton PJ "Utiliser sa Chance" transversal, pas propre à l'AOE),
> reportée en backlog non urgent (`ROADMAP.md` §4) — la simplification v1 (Test de Chance auto-résolu
> côté serveur) est actée, plus une hypothèse (§5.2) ; (3) override MJ recadré : résolution automatique
> par défaut, correction a posteriori via la capacité MJ déjà existante d'éditer une fiche (`isGm`,
> `char-sheet.js`) — pas de nouvelle file de confirmation à construire (§5.3, simplifié) ; (4) risque de
> tour bloqué résolu par réutilisation d'un mécanisme déjà codé et déjà générique
> (`COMBAT_SKIP_PLAYER` → `confirmDamage(..., forced=true)`, `socketCombatHelpers.js:555-561`) — zéro
> code neuf pour ce cas précis (§5.4) ; (5) politique `ON DELETE` : pas une décision produit, alignée
> sur le précédent déjà en base (`combat_actions.target_token_id` → `ON DELETE SET NULL`, migration
> 224) sans redemander à Saar (§3).
>
> **v2 → v3** — 2ᵉ analyse à charge (comparaison Foundry VTT approfondie, recherche de tout ce qui
> pourrait casser, recherche d'optimisation). Corrections : (1) timing de calcul de
> `combat_action_targets` précisé — RÉSOLUTION uniquement, jamais figé à l'ANNONCE (§3, contredisait
> sinon un invariant déjà écrit dans `.claude/rules/combat.md`) ; (2) idempotence par cible rendue
> concrète (garde atomique, §3) ; (3) `target_token_id` rendu polymorphe (token OU entité, cohérent
> avec le précédent `worldSpatialQueryService.js`, §3) ; (4) réutilisation du registre "Action
> exclusive" (`shared/combatExclusiveActions.js`) explicitée (§2) ; (5) validation serveur de
> l'amplitude/angle contre l'arme réellement équipée, absente jusqu'ici (§6) ; (6) proposition d'un
> override MJ sur la liste de cibles calculée, inspirée de la comparaison Foundry et du patron déjà
> existant `CatastropheReviewQueue.jsx` (§5.3) ; (7) correction de performance vérifiée dans le code
> réel : couche 3 doit réutiliser `evaluateWorldVisibility` (la fonction pure, déjà batch-ready) et non
> boucler `evaluateBattlemapVisibility` (qui recharge tout à chaque appel) — §2.2 et §7.
>
> **v1 → v2** (résumé, détail dans l'historique de conversation) : reclassement `SYSTEME` → `PLANS`
> (invariant du corpus documentaire cassé sinon) ; schéma de persistance ajouté (`target_token_id`
> scalaire découvert insuffisant pour le multi-cibles) ; dégression corrigée (pas de réutilisation
> littérale du dispatch SHRAPNEL, primitive générique `resolveDistanceBand` à la place) ; fan-out
> PJ/PNJ explicité ; table de dispersion 1D6 et mécanique de point de Chance signalées comme gaps
> réels (RAW manquant / jamais codé, pas des dettes créées par l'AOE).
>
> Marquage (`METHODO_PLAN.md`) : **[VÉRIFIÉ]** = lu dans le code cette session, **[CIBLE]** =
> architecture proposée, rien codé, **[OUVERT]** = décision non tranchée.

---

## 0. Responsabilité unique

Déterminer, à partir d'une origine, d'une forme et d'une amplitude, **quelles cibles sont affectées
et à quelle distance du centre** — indépendamment de l'arme ou du pouvoir qui invoque le calcul, et
indépendamment des dégâts/effets qui en résultent (couche 4, voir §2).

Prérequis technique explicite de : Armes spéciales (fusil à pompe, lance-flammes, grenades/mines),
Tir de suppression, Force Polaris Lot 2+ (pouvoirs à zone). Détail RAW : `docs/REGLES/
REGLES_ARMES_SPECIALES.md`, `docs/REGLES/REGLESYSCOMBAT.md` (tir de suppression), `docs/REGLES/
REGLEPOLARIS.md`. Ce document ne recopie pas ces règles, il en extrait la structure commune.

---

## 1. Formes RAW rencontrées [VÉRIFIÉ]

| Patron | Source RAW | Forme | Dégression |
|---|---|---|---|
| Cône par bande de portée | Fusil à pompe | cône, largeur croît avec la portée | dégâts baissent avec la portée (+1D10 → -3D10) |
| Zone fixe, tout ce qui est exposé | Lance-flammes | pas de forme géométrique précise | aucune (persistant : brûlure 2D6 tours) |
| Anneaux concentriques depuis un point d'impact, dispersion sur échec | Grenade "à concussion" (règle générique RAW) | cercles de diamètre croissant | dégâts baissent avec la distance au centre, Test de Chance au-delà de 10m |
| Couloir de tir soutenu | Tir de suppression | couloir ~3m, extensible par tranche de 5 balles | pas de dégât direct — Test de Chance par cible dans/traversant la zone |
| Cercle/sphère centré sur un point choisi dans une portée max | Force Polaris (majorité des ~40 pouvoirs) | cercle/sphère, sans dispersion sur échec | variable selon le pouvoir |

**Corrigé v7** : "Grenades/mines" n'est pas une catégorie homogène — le catalogue réel (`ref_equipment`)
contient 8 types de grenades distincts, dont 4 (incendiaire, étourdissante, assommante, à énergie)
n'ont **aucune dégression** RAW (rayon fixe, effet uniforme dedans/dehors) et 2 (fumigène, à gaz) ne
sont pas géométriques du tout (nuage volumétrique, hors périmètre de ce module — §10). Seule la
grenade "à concussion" suit le patron de la ligne ci-dessus. Détail complet : §6.2bis.

Toutes ces actions sont RAW "Action exclusive" (fusil à pompe en rafale, lance-flammes en tir continu,
grenade, tir de suppression). **Précision v5, après lecture directe du code** (v3/v4 surestimait la
réutilisation, même défaut que la première correction SHRAPNEL) : `isExclusiveDeclaration`
(`shared/combatExclusiveActions.js:146-149`) ne couvre aujourd'hui que le Tir visé — son propre
commentaire de code le dit explicitement : *"Charge/Rafale longue/Tir de suppression rejoindront cette
fonction dans leurs propres sessions dédiées, pas ici."* Le **patron** (liste de raisons, vide =
éligible) est bien la bonne extension à utiliser, mais ajouter les cas AOE à `isExclusiveDeclaration`
est du **code neuf réel**, pas un enregistrement gratuit — petit, mais à compter comme tel dans l'ordre
de construction (§8).

---

## 2. Architecture en couches [CIBLE]

```
Couche 1 — Géométrie pure          shared/world/aoeShapes.js [CIBLE, nouveau]
Couche 2 — Requête spatiale monde  worldSpatialQueryService.js [CIBLE, extension — §2.1]
Couche 3 — LOS/couverture/cible    worldVisibilityService.js [VÉRIFIÉ, existe déjà — §2.2 sur le coût réel]
Couche 4 — Résolution par cible    orchestration nouvelle, appelle l'EXISTANT par cible [CIBLE — §4/§5]
```

### 2.1 Couche 2 — requête bulk, pas une boucle pairwise

`worldSpatialQueryService.js` n'a aujourd'hui que des requêtes pairwise (`measureBattlemapTokenDistance`,
`measureBattlemapTokenEntityDistance`), chacune avec sa propre réconciliation ascenseur. Une requête
AOE charge **tous** les tokens d'une battlemap une fois, teste chacun contre la figure :

```js
queryTokensInShape({ battlemapId, shape, database })
// réconciliation ascenseur d'abord (obligatoire — voir §6.3), puis
// database('tokens').where({ battlemap_id }) une seule requête, filtrée en mémoire par la figure
→ [{ tokenId, distanceToOriginM, position }]
```

**Exigence dure, pas une note** [ajouté v3] : `reconcileBattlemapElevators` doit être appelé **avant**
de charger les positions, exactement comme le fait déjà `measureBattlemapTokenDistance` (dont le
commentaire de code prévient explicitement : *"une cabine en mouvement ne laisse donc jamais le combat
travailler sur une position perimée"*). L'oublier dans la version bulk réintroduirait le bug que ce
code existant a été écrit pour éviter.

### 2.2 Couche 3 — la vraie primitive à réutiliser n'est pas celle qu'on croit [CIBLE, corrigé v3]

Vérifié en relisant `worldVisibilityService.js:133-178` : `evaluateBattlemapVisibility` (la fonction
exportée qu'on aurait naturellement appelée "par cible" en boucle) recharge **tout** à chaque appel —
réconciliation ascenseur, tous les tokens de la battlemap, toutes les entités jointes à leurs
blueprints, et le runtime context complet. L'appeler N fois pour N cibles d'une même AOE rechargerait
N fois des données identiques.

La primitive réellement adaptée est `evaluateWorldVisibility` (fonction pure interne, déjà appelée par
`evaluateBattlemapVisibility` après son chargement) : elle prend `tokens`/`entities`/`effectRegions`/
`snapshot` **déjà chargés** en paramètres. Couche 2 et couche 3 partagent donc **un seul** chargement
(réconciliation + tokens + entités + runtimeContext), puis couche 3 appelle `evaluateWorldVisibility`
en pur N fois sur ces données partagées. Un chargement, N tests — pas N chargements complets.

### 2.3 Modèle de confiance — pourquoi Foundry VTT n'est qu'une source d'idées de forme, jamais de flux [VÉRIFIÉ, ajouté v5 — contenu déplacé depuis la conversation, absent du document jusqu'ici]

| | Foundry VTT | Enclume |
|---|---|---|
| Autorité | Le client calcule la forme (gabarit) et peut auto-cibler ; le système de jeu (plugin) décide s'il fait confiance à ce calcul | Serveur seul autoritaire (`world.md` : *"le client envoie une intention, serveur et FSM décident du résultat"*) — jamais un calcul client accepté tel quel |
| Ciblage | Souvent en cases de grille ("grid highlighting") | Test géométrique continu en mètres (`world.md` : *"la grille est une aide de saisie"*) |
| Durée de vie | Gabarit persistant, déplaçable, réutilisable, découplé d'un jet précis | Éphémère, résolu avec l'action qui l'a créé — simplification délibérée, aucune règle RAW Polaris v1 n'exige un gabarit persistant |
| Override manuel | Le MJ peut ajouter/retirer une cible de la liste auto-calculée avant de résoudre | Non retenu tel quel — Saar a préféré la résolution automatique + correction a posteriori via l'édition de fiche existante (§5.3) |

Seule l'idée de **forme de la commande d'entrée** (origine/direction/forme/amplitude, §6) est
transposable depuis Foundry — jamais le flux de confiance, incompatible avec l'autorité serveur du
projet. Cette comparaison n'existait que dans la conversation jusqu'à cette version ; absente d'un
document, une décision d'architecture n'est pas vraiment prise (Règle 2 `RegleDocumentaire.md`).

---

## 3. Persistance [CIBLE, corrigé v3 — timing, idempotence, polymorphisme]

`combat_actions.target_token_id` (`server/src/db/migrations/30_combat_actions.js:9`) est une colonne
UUID scalaire, avec une FK (`224_combat_actions_foreign_keys.js`). Elle reste intouchée pour les
actions cible unique existantes — une action AOE la laisse `NULL` et utilise une nouvelle table.

```
combat_action_targets
- id uuid pk
- action_id uuid FK → combat_actions.id
- target_token_id uuid nullable FK → tokens.id
- target_entity_id uuid nullable FK → entities.id   -- polymorphe, cohérent avec le précédent
                                                       -- worldSpatialQueryService.js qui traite déjà
                                                       -- tokens ET entités en parallèle ; entités hors
                                                       -- scope fonctionnel v1 (§10) mais la colonne
                                                       -- existe pour éviter une 2ᵉ migration
- distance_m numeric
- has_line_of_sight boolean
- damage_modifier jsonb        -- le modificateur RÉELLEMENT appliqué (valeur, pas un index de palier
                                -- opaque — une table de dégression qui change dans le temps rendrait
                                -- un simple band_index ambigu à la relecture)
- outcome jsonb nullable       -- rempli une fois la cible résolue, sous garde atomique (voir ci-dessous)
```

**Timing — correction v3, contredisait sinon un invariant déjà écrit** : `.claude/rules/combat.md`
(chargé cette session) est explicite — *"Seule la phase RÉSOLUTION vérifie ce qui est réellement
possible, au moment de l'exécution"*, avec recalcul de distance/LOS/couverture "depuis la position
réellement atteinte". Les lignes `combat_action_targets` sont donc **écrites à la RÉSOLUTION**, jamais
figées à l'ANNONCE — une cible qui bouge entre les deux phases ne doit jamais garder une distance/LOS
périmée. La v2 ne le précisait pas.

**Idempotence — correction v3, concrète au lieu de "boucler et appliquer"** : chaque confirmation de
cible (PJ ou PNJ, §4) applique son résultat via une mise à jour conditionnelle :
`UPDATE combat_action_targets SET outcome = ? WHERE id = ? AND outcome IS NULL`. Un double clic ou un
retry réseau sur la même ligne ne peut donc jamais appliquer le dégât deux fois — cohérent avec
`core.md` ("transitions idempotentes sous répétition réseau"), qui ne précisait pas de mécanisme pour
ce cas précis.

**FK vers un token supprimé en cours de résolution** [résolu v4] : si un personnage est supprimé ou un
token nettoyé entre l'ANNONCE d'une AOE à confirmations multiples et sa RÉSOLUTION complète, la ligne
`combat_action_targets` doit survivre (c'est un historique de résolution, pas juste un pointeur vif) —
`target_token_id` passe à `NULL`, le reste de la ligne (distance, dégât appliqué) reste lisible. Pas
une décision produit à poser à Saar : c'est exactement la politique déjà choisie pour la colonne
analogue existante (`combat_actions.target_token_id` → `ON DELETE SET NULL`, `migrations/
224_combat_actions_foreign_keys.js:12`) — une seule autorité pour ce choix, pas une politique
différente pour la nouvelle table.

Numéro de migration réel à prendre au moment de coder (audit `knex_migrations` + fichiers présents,
CLAUDE.md §5) — non fixé ici.

---

## 4. Couche 4 — dégression : primitive partagée, pas réutilisation littérale [CIBLE]

Vérifié : `resolveMechanicDamageFormula(weaponFormula, mechanic, rangeBand)` (`shared/
weaponAmmoDsl.js:166`) indexe `mechanic.dmgDropoffByRange` par un nom de bande (BP/C/M/L/E, calé sur
des portées d'armes à feu). Les bandes grenades (0-2m/2-5m/5-10m/10-20m/20-30m, diamètre depuis le
point d'impact) n'ont ni les mêmes seuils ni la même sémantique — réutiliser le dispatch existant tel
quel appliquerait silencieusement les mauvais paliers.

**Correction** : extraire l'algorithme (pas la donnée) dans une primitive neuve et générique :

```js
// shared/world/distanceBands.js [CIBLE, nouveau]
resolveDistanceBand(distanceM, bands)
// bands = [{ maxDistanceM, ...payload }] triés croissant
// → premier palier où distanceM <= maxDistanceM, sinon le dernier (portée extrême)
```

La migration du dispatch munitions existant vers cette même primitive est un nice-to-have, pas un
prérequis v1 — le code SHRAPNEL fonctionne et est testé ; le retoucher sans besoin réel violerait
CLAUDE.md §7 ("ne pas réécrire un fichier entier inutilement"). Scan linéaire sur une poignée de
paliers : déjà optimal en l'état, aucune optimisation supplémentaire nécessaire.

**Précision v7** : `resolveDistanceBand` ne sert que pour les armes/pouvoirs à **dégression par
palier** (fusil à pompe, tir de suppression, grenade "à concussion"). Une arme à **rayon fixe sans
dégression** (4 des 8 grenades du catalogue, §6.2bis) n'en a pas besoin du tout — la couche 1
(`isPointInAoeShape`, un simple test d'appartenance au cercle) détermine déjà tout : dans la zone =
effet plein, hors zone = rien. La couche 4 doit donc savoir distinguer les deux régimes par arme, pas
appliquer `resolveDistanceBand` partout par défaut.

**Trouvaille v6** : `shared/combatRange.js#resolveWeaponRangeBand` fait déjà ce même algorithme pour
les armes à feu, avec les 5 mêmes noms de palier RAW. Pas fusionné avec `resolveDistanceBand`
(tolérance aux seuils dégénérés différente, détail en tête de `distanceBands.js`), mais ça change
directement le §6.2/§10 : pour le fusil à pompe, `resolveWeaponRangeBand(distanceM, weapon.ref_range)`
classe déjà la distance sans rien ajouter au catalogue — seule la table RAW fixe (largeur de zone +
modificateur par palier) reste à écrire, probablement comme constante de code plutôt que comme donnée
`ref_equipment`. **Ce raisonnement reste valable pour le fusil à pompe uniquement — corrigé v7 pour les
grenades, voir bannière de tête et §6.2bis** : le catalogue réel montre 8 types de grenades à rayon
variable, décrit en texte libre, pas en donnée structurée — la table de dégression standard
(2/5/10/20/30m) ne couvre que la grenade "à concussion", les autres ont un rayon fixe propre à chaque
ligne `ref_equipment`, qui doit devenir une vraie colonne catalogue.

---

## 5. Couche 4 — fan-out PJ/PNJ, Test de Chance, override MJ

### 5.1 PJ/PNJ — orchestration, pas un nouveau pipeline de dégâts [CIBLE]

Deux sites d'appel distincts existants à `getEffectiveWeaponDamage` (`socketCombatHelpers.js`) : PNJ
résolu immédiatement côté serveur, PJ différé via `COMBAT_DAMAGE_PROMPT`/`CONFIRM`. La couche 4 AOE
boucle sur `combat_action_targets` (une fois peuplée à la RÉSOLUTION, §3) et appelle, par cible, le
site qui existe déjà pour son type — jamais un pipeline dupliqué.
- **PNJ** → résolution immédiate, formule modifiée par `damage_modifier` (§4).
- **PJ** → un `COMBAT_DAMAGE_PROMPT` par cible, payload étendu avec `actionId` + l'id de la ligne
  `combat_action_targets`. Les N prompts partent **en parallèle** [précisé v3] — pas de raison
  d'attendre la réponse du PJ n avant de solliciter le PJ n+1, ils sont indépendants.

L'action AOE reste "en cours" tant que tous les PJ touchés n'ont pas répondu — voir §5.4 pour le risque
de blocage de tour associé.

### 5.2 Test de Chance — décidé v4 : chantier séparé, reporté

Recherche faite : aucune mécanique de dépense d'un point de Chance n'existe dans le code, même pour un
Test cible unique. RAW : *"Un PJ à découvert... peut toujours dépenser un point de Chance pour réussir
ce Test"* — et plus largement (`REGLEARMURE.md`), dépenser 1-2 points de Chance réduit aussi la gravité
des Dommages d'armure. C'est une ressource de personnage transversale, pas une règle propre à l'AOE.

**Décision Saar (2026-08-26)** : la mécanique de point de Chance est un chantier à part — un bouton PJ
"Utiliser sa Chance" à ajouter à plusieurs endroits (relancer un jet, modifier un résultat), pas
compliqué en soi mais transversal. **Reporté, non urgent** — ajouté au backlog (`ROADMAP.md` §4).

Conséquence pour l'AOE v1 : le serveur résout le Test de Chance automatiquement, sans option de
dépense — écart RAW explicite et documenté (CLAUDE.md §1.9), à lever quand le chantier Chance sera
construit pour lui-même. Ce n'est plus une simplification "en attente d'arbitrage", c'est la décision
actée.

**Affiné v8, en codant l'étape 8** : "résout automatiquement" présupposait un score de Chance déjà
modélisé quelque part. Vérifié en codant — **aucune colonne "Chance" n'existe dans le schéma**
(`char_sheet` ou ailleurs, grep sur toutes les migrations, zéro résultat). Sans seuil réel à tester, un
"jet automatique" serait un jet fabriqué contre un nombre inventé — exactement le genre de correctif
non instrumenté que CLAUDE.md §6 interdit. La décision reste la même dans son intention (pas de Test de
Chance fonctionnel en v1) mais sa mise en œuvre concrète est : **le Test de Chance RAW à longue/extrême
portée est ignoré**, les cibles à ces paliers subissent le dégât réduit (-2D10/-3D10) sans aucune
chance d'éviter complètement le tir — écart RAW explicite, à lever avec le chantier Chance
(`docs/ROADMAP.md` §4).

### 5.3 Correction MJ après résolution — recadré v4, plus simple que prévu

Question posée à Saar : faut-il une étape de validation MJ **avant** que la couche 4 applique les
dégâts (comme la file `CatastropheReviewQueue.jsx`) ? **Réponse : non** — *"fonctionnement normal sans
nécessité du MJ, mais toujours laisser la possibilité au MJ d'intervenir et de corriger/modifier."*

Ça change la proposition v3 : pas de nouvelle file de confirmation à construire. La couche 4 s'exécute
automatiquement, sans étape bloquante. La correction a posteriori du MJ n'est pas une brique neuve à
ajouter — elle passe par la capacité déjà existante d'un MJ à éditer directement la fiche de n'importe
quel personnage de sa campagne (routes gardées `isGm`, `char-sheet.js` — vérifié cette session). Rien
à construire ici : l'AOE résout automatiquement, et "corriger" un résultat d'AOE, c'est éditer les
Dommages/l'état du personnage comme le MJ le ferait pour n'importe quelle autre cause en jeu.

### 5.4 Round bloqué par un PJ qui ne répond pas — décidé v4, réutilise un mécanisme déjà codé

Risque identifié en analyse à charge (v2/v3) : une AOE avec confirmations PJ multiples pourrait laisser
le tour du lanceur bloqué si un PJ touché ne confirme jamais son dégât.

**Décision Saar** : *"Comme pour toute action PJ, le MJ peut reprendre la main (action Agir déjà
implanté) + option Timer de tour."*

Vérifié : le mécanisme de reprise de main existe déjà et est **déjà générique**, pas à écrire pour
l'AOE. `COMBAT_SKIP_PLAYER` (`shared/events.js:140` zone voisine) déclenche `confirmDamage(io,
campaignId, tokenId, pendingMaps, socket, { forced: true })` — commentaire du code lui-même :
*"appelable aussi depuis le déclenchement générique MJ (COMBAT_SKIP_PLAYER, « le serveur lance les dés
à sa place — il devient PNJ pour le Tour ») sans dupliquer le moindre calcul"* (`socketCombatHelpers.
js:555-561`). Une confirmation AOE en attente pour un PJ n'est qu'un `COMBAT_DAMAGE_CONFIRM` de plus —
le même chemin `forced=true` s'applique sans modification. **Zéro code neuf pour la reprise MJ.**

Le "Timer de tour" mentionné par Saar, en revanche, **n'existe pas encore dans le code** (recherché
cette session, aucune occurrence) — ce serait une fonctionnalité transversale nouvelle (auto-reprise
après un délai), pas un prérequis de l'AOE. Hors scope de ce plan (§10) ; à cadrer séparément si Saar
le souhaite.

### 5.5 Auto-ciblage par le lanceur — cas RAW réel, jamais traité avant v5 [CIBLE, ajouté v5]

Le RAW prévoit explicitement que le lanceur d'une AOE peut être touché par sa propre attaque : le
lance-flammes impose *"une distance minimale d'environ 3 mètres, sous peine de risquer d'être
lui-même éclaboussé par le liquide enflammé"*, et une grenade qui dévie sur échec (§6.1) peut
parfaitement retomber près du lanceur. Aucune version précédente de ce plan n'en parlait.

Conséquence pour la couche 2 : `queryTokensInShape` ne doit **jamais exclure le token du lanceur** par
construction — s'il est géométriquement dans la figure, il fait partie du résultat, exactement comme
n'importe quelle autre cible. La couche 4 (§5.1) le traite alors comme une cible normale : PNJ →
résolution immédiate, PJ → un `COMBAT_DAMAGE_PROMPT`, y compris si ce PJ est celui qui vient de
déclarer l'action. Fonctionnellement correct par construction (pas de garde spéciale nécessaire) — le
seul point à vérifier au moment de coder l'UI (§8 étape 9) est que recevoir un prompt de dégât sur sa
propre action ne produise pas une séquence déroutante côté client (ex. la fenêtre de confirmation de
l'action ET le prompt de dégât s'affichant simultanément) — un test UX à ajouter, pas un changement
d'architecture.

---

## 6. Contrat d'entrée couche 1+2 [CIBLE]

```js
{
  battlemapId,
  origin: { x, y, z },              // point de départ RÉEL (post-dispersion si échec, §6.1)
  direction,                        // degrés, ignoré pour 'circle'
  shape: 'circle' | 'cone' | 'ray', // 'rect' (Foundry) omis — aucun besoin RAW Polaris identifié
  amplitude,                        // rayon/longueur en m — voir §6.2, validation serveur obligatoire
  angle, width,                     // cône / rayon seulement — même validation
  losSource: 'caster' | 'origin',   // §6.4
}
→ { targets: [{ tokenId, distanceToOriginM, position, hasLineOfSight }] }
```

### 6.1 Dispersion sur échec — résolu v4

`resolveScatter(intendedOrigin, failureMargin) → effectiveOrigin`. Saar a fourni le schéma manquant
(diagramme à 6 branches, 1D6). Lecture retenue, confirmée alignée avec Saar : direction relative à
l'axe lanceur→point visé — **1** = déviation plus loin (surshoot), **4** = déviation en deçà
(undershoot), **2/6** = déviation diagonale avant droite/gauche, **3/5** = déviation latérale
droite/gauche. Distance de déviation = marge d'échec en mètres (RAW, inchangé). Plus bloquant pour
l'étape 2 du §8.

### 6.2 Validation serveur de l'amplitude/angle — deux régimes distincts, pas un seul [CIBLE, corrigé v5]

Rien n'empêche aujourd'hui, tel que le contrat était écrit, qu'un client déclare une `amplitude`
arbitraire — le serveur doit toujours en être l'autorité finale (`core.md` : "le serveur valide... les
données avant toute mutation"). Mais la v3/v4 traitait ça comme un seul cas ("clamper aux valeurs de
l'arme/du pouvoir") — **faux pour Force Polaris**, vérifié en relisant le RAW déjà extrait
(`REGLEPOLARIS.md`) : *"Zone d'effet : 5 mètres de diamètre +/- modif. de réussite"*. La taille de la
zone d'un pouvoir **dépend du résultat du jet**, elle n'existe pas avant que le Test soit résolu. Deux
régimes, pas un :
- **Armes** (fusil à pompe, lance-flammes, grenades) : `amplitude` a une valeur fixe ou bornée par un
  choix joueur borné (nombre de balles pour la rafale/suppression) connue **avant** le jet — le serveur
  clampe la valeur reçue contre cette borne, comme prévu en v3/v4.
- **Pouvoirs Force Polaris** : `amplitude` n'est **jamais un paramètre d'entrée client** — le serveur
  la calcule lui-même, après résolution du Test, à partir de la formule RAW du pouvoir et du modificateur
  de réussite obtenu. Le contrat couche 1+2 (§6) reste identique en sortie, mais pour ce cas l'origine
  de la valeur change de sens : dérivée, jamais reçue puis validée.

### 6.2bis Catalogue AOE — colonnes manquantes, confirmé v7 [CIBLE, nouveau v7]

Le "borné par une valeur connue avant le jet" du §6.2 suppose que cette valeur existe côté serveur.
Vérifié sur le catalogue réel (`303_ref_equipment_seed.js`) : **elle n'existe nulle part en donnée
structurée pour les grenades** — 8 lignes `ref_equipment` de `category: 'Grenade'`, chacune avec sa
zone d'effet écrite en texte libre dans `description` (ex. "5 mètres de diamètre", "20 mètres de
diamètre", "Rien d'autre n'est affecté au-delà de cette zone") — jamais dans une colonne exploitable.

Deux profils RAW distincts identifiés en relisant ces descriptions, pas un seul :
- **Dégression standard** (probablement la seule à suivre le tableau 2/5/10/20/30m de
  `REGLES_ARMES_SPECIALES.md`) — a priori la grenade "à concussion" seulement.
- **Rayon fixe, effet uniforme, sans dégression** — incendiaire, étourdissante, assommante, à énergie :
  la description ne mentionne jamais de réduction de dégâts par distance, juste une zone et un effet
  binaire dedans/dehors.

**Conséquence concrète** : au moins une colonne structurée `ref_equipment` (forme AOE, amplitude en
mètres, indicateur "suit la dégression standard" vs "rayon fixe") doit être ajoutée avant de brancher
les grenades — un vrai travail de catalogue (migration + saisie des 6 valeurs concernées, fumigène et
à gaz exclues). Précision (corrige une formulation ambiguë de la première rédaction) : le fusil à
pompe et les grenades ne "partageront" jamais la même donnée catalogue — le premier lit `ref_range`
via `resolveWeaponRangeBand` (§4/§7), les grenades liront ces nouvelles colonnes dédiées. Ce qu'ils
partagent, c'est l'architecture (couches 1-4, `isPointInAoeShape`/`resolveDistanceBand`), pas la source
de la donnée.

Détail des colonnes exactes (noms, format) non tranché ici — à faire avant de coder cette partie du §8,
pas avant.

### 6.3 Réconciliation ascenseur — voir §2.1, exigence dure.

### 6.4 Source de LOS [CIBLE, inchangé]
`losSource: 'caster'` pour les armes à trajectoire directe (fusil à pompe), `'origin'` pour les
explosions/pouvoirs à zone. Paramètre de l'appelant, jamais une constante du module.

---

## 7. Ce qui existe déjà et sera réutilisé, jamais dupliqué [VÉRIFIÉ]

| Brique | Fichier | Rôle réutilisé |
|---|---|---|
| Distance 3D et horizontale (ignore la hauteur) | `worldMetrics.js` | Base couche 1 |
| Mesure token↔token/entité, réconciliation ascenseur | `worldSpatialQueryService.js` | Fichier hôte, chemin bulk ajouté (§2.1) |
| LOS pure, batch-ready | `worldVisibilityService.js` (`evaluateWorldVisibility`, **pas** `evaluateBattlemapVisibility` — §2.2) | Couche 3, un chargement partagé avec couche 2, N appels purs |
| Résolution de Test générique | `shared/polarisTestResolution.js` (`resolveTestOutcome`) | Calcul brut du Test de Chance — l'orchestration autour (§5.2) manque, pas le calcul |
| Classification de palier par arme (fusil à pompe uniquement) | `shared/combatRange.js` (`resolveWeaponRangeBand`, données `ref_equipment.ref_range`) | Trouvaille v6 — classe déjà une distance en `bout_portant/courte/moyenne/longue/extreme` pour toute arme à feu, zéro nouvelle colonne (§4). Ne couvre pas les grenades (§6.2bis) |
| Résolution dégât PNJ immédiat / PJ différé | `socketCombatHelpers.js` (2 sites `getEffectiveWeaponDamage`) | Appelés en boucle par cible (§5.1) |
| Patron Action exclusive (liste de raisons, vide = éligible) | `shared/combatExclusiveActions.js` (`isExclusiveDeclaration`) | **Pattern** réutilisé, pas le code lui-même — extension réelle nécessaire (§1, corrigé v5) |
| Reprise MJ générique sur une confirmation en attente | `COMBAT_SKIP_PLAYER` → `confirmDamage(..., forced: true)` (`socketCombatHelpers.js:555-561`) | Couvre le risque de round bloqué (§5.4) — zéro code neuf |
| Édition de fiche par le MJ (correction a posteriori) | Routes `isGm` (`char-sheet.js`) | Couvre la "correction MJ après coup" (§5.3) — pas de nouvelle file de confirmation |
| Déclaration/résolution en deux temps | `COMBAT_ACTION_DECLARE`/`CONFIRM` | Protocole conservé, payload étendu (§6) |

---

## 8. Ordre de construction [CIBLE]

**Corrigé v7 — la mention "plus aucune étape bloquante" (v4) n'est plus exacte.** Elle l'était pour
l'architecture (couches 1-4, protocole, orchestration) — elle ne l'est plus pour le contenu grenades :
l'étape 6c (catalogue, nouvelle en v7) bloque la partie grenades de l'étape 6b. Le fusil à pompe, lui,
n'a aucune étape bloquante.

1. `docs/VOCABULARY.md` — entrée "Zone d'effet (AOE)" (fait).
2. `shared/world/aoeShapes.js` — géométrie pure + `resolveScatter` (dispersion, §6.1, résolu). **Codé.**
3. `shared/world/distanceBands.js` — primitive de palier générique (§4). **Codé.** Ne concerne que les
   armes/pouvoirs à dégression par palier (fusil à pompe, tir de suppression, grenade "à concussion")
   — les grenades à rayon fixe sans dégression (§6.2bis) n'en ont pas besoin, la couche 1 seule suffit.
4. Extension `worldSpatialQueryService.js` — `queryTokensInShape`, réconciliation ascenseur obligatoire (§2.1). **Codé.**
5. Composition couche 2+3 : un seul chargement partagé, `evaluateWorldVisibility` en pur par cible (§2.2), `losSource` paramétrable. **Codé.**
6. Schéma `combat_action_targets` (§3, peuplé à la RÉSOLUTION, garde d'idempotence, `ON DELETE SET NULL`) — **codé et appliqué** — puis extension payload `COMBAT_ACTION_DECLARE` — **codée** pour fusil à pompe/suppression (`socketCombatAnnouncement.js`, `aoe: { direction }` dans `modifiers`, validation d'amplitude différée à la RÉSOLUTION comme partout ailleurs dans ce fichier) ; grenades toujours bloquées sur 6c.
6c. **[Nouveau v7]** Catalogue AOE `ref_equipment` pour les grenades (§6.2bis) — colonnes structurées (forme, amplitude, dégression standard vs rayon fixe), saisie des 8 lignes existantes depuis leur `description` texte libre. Prérequis de la partie grenades de l'étape 6, pas du fusil à pompe.
7. Extension réelle de `isExclusiveDeclaration` pour les 4 actions AOE (§1) — petit mais pas gratuit, corrigé v5.
8. Orchestration couche 4 : fan-out PNJ immédiat / PJ différé en parallèle, y compris auto-ciblage du lanceur (§5.1/§5.5), Test de Chance simplifié en v1 (§5.2, définitif), reprise MJ via le chemin `forced=true` déjà existant (§5.4) — aucune nouvelle file de confirmation (§5.3).
9. UI de ciblage : mode "placer un point" et mode "choisir une direction/cône" — vérifier le cas auto-ciblage (§5.5) ne produit pas une séquence déroutante côté client.

---

## 9. Plan de tests [CIBLE]

- Couche 1 (géométrie) : tests unitaires purs — cercle/cône/ray, cas limites (amplitude 0, angle
  0/360), dispersion (marge d'échec 0 vs importante).
- Couche 2 (requête spatiale) : scénario monde réel — plusieurs tokens dont certains hors de la
  figure, **ascenseur en mouvement pendant la requête** (régression directe si l'exigence §2.1 est
  oubliée), aucun faux positif/négatif.
- Couche 3 (LOS) : cible dans le rayon mais derrière un mur — non touchée ; `losSource` caster vs
  origin donnant des résultats différents sur le même scénario ; **un seul chargement mesuré** (pas de
  requête DB redondante par cible — test de non-régression sur l'optimisation §2.2).
- Couche 4 : scénario mixte PJ+PNJ dans une même explosion — PNJ résolus tout de suite, PJ reçoivent
  chacun leur prompt en parallèle ; **double confirmation réseau sur une même cible** → dégât appliqué
  une seule fois (test direct de la garde d'idempotence §3).
- Validation serveur : amplitude/angle client falsifiés au-delà de ce que l'arme équipée autorise →
  rejetés/clampés ; pour un pouvoir Force Polaris, une `amplitude` envoyée par le client est ignorée —
  seule la valeur calculée serveur depuis le modificateur de réussite compte (§6.2, deux régimes).
- Auto-ciblage : lanceur géométriquement dans sa propre zone (lance-flammes trop proche, grenade qui
  dévie vers lui) → traité comme une cible normale, pas d'exclusion silencieuse (§5.5).
- Deux régimes de grenade (§6.2bis) : une grenade "à concussion" (dégression par palier) et une
  grenade à rayon fixe (ex. incendiaire) dans le même scénario multi-cibles → dégâts corrects dans
  chaque cas, pas d'application accidentelle de `resolveDistanceBand` sur une arme qui n'en a pas
  besoin (§4).
- Transport réel : payload `COMBAT_ACTION_DECLARE` avec `aoe`, répétition réseau, reconnexion d'un PJ
  avec une confirmation AOE en attente.

---

## 10. Hors scope v1 [CIBLE]

- Placement du centre (UI, droits) — dépend du câblage par action/pouvoir, compatible avec le calcul
  automatique déjà décidé pour Shrapnel (cases adjacentes).
- Forme `rect` — aucun besoin RAW Polaris identifié.
- Persistance des zones après l'impact (gaz, feu, brûlure lance-flammes) — couverte par
  `BUILTIN_WORLD_EFFECTS`/`worldEffects.js` existant.
- Entités libres comme cibles fonctionnelles AOE — colonne `target_entity_id` prévue au schéma (§3)
  mais non exploitée en v1 ; aucune règle RAW connue ne l'exige pour l'AOE spécifiquement.
- Mécanique de dépense de point de Chance — chantier séparé, transversal (bouton PJ "Utiliser sa
  Chance"), reporté en backlog non urgent (`ROADMAP.md` §4, ajouté v4). Pas propre à l'AOE : touche
  aussi la réduction de gravité des Dommages d'armure (§5.2).
- Fusil à pompe en tir à répétition — compatible sans changement de couche 1 : l'amplitude est
  calculée en amont par la logique de rafale existante.
- "Timer de tour" (auto-reprise après un délai) — n'existe pas dans le code (recherché, zéro
  occurrence), fonctionnalité transversale à cadrer séparément si Saar le souhaite, pas un prérequis
  de l'AOE (§5.4 — la reprise manuelle MJ, elle, est déjà couverte par l'existant).
- **Grenade fumigène et grenade à gaz (suffocants)** — confirmé v7 (Saar) : leur zone d'effet ("30
  mètres cube") est un nuage volumétrique, pas une forme géométrique circle/cône/rayon. Ne passeront
  jamais par `aoeShapes.js` — couvertes par le mécanisme existant `worldEffects.js`/
  `propagateEffectThroughCompartments` (propagation par compartiments), hors périmètre de ce module.

---

## 11. Sources externes consultées [VÉRIFIÉ]

- [MeasuredTemplate API v12/v13 — Foundry VTT](https://foundryvtt.com/api/v12/classes/client.MeasuredTemplate.html) —
  le cœur de Foundry VTT est un logiciel commercial fermé (confirmé par recherche ; seul un tracker
  d'issues existe sur GitHub, pas le code) — la documentation d'API publique était le plafond réel de
  cette piste. Comparaison de modèle de confiance détaillée en §2.3 (ajoutée v5 — n'existait qu'en
  conversation jusque-là).
- [fvtt-walled-templates — GitHub](https://github.com/caewok/fvtt-walled-templates) — open source, README
  lu, code réel non atteint (chemin essayé introuvable, non retenté davantage).
- [Damage Over Distance — falloff FPS](https://zekevirant.medium.com/a-comparison-of-damage-falloff-in-pvp-fpss-7be74fbb131),
  [Damage Falloff — Warframe Wiki](https://wiki.warframe.com/w/Damage_Falloff) — pattern générique,
  indépendant de tout moteur VTT.
- Triangulation interne : le découpage requête-spatiale/LOS existe déjà dans le code du projet
  (`worldSpatialQueryService.js` vs `worldVisibilityService.js`), et le patron d'override MJ proposé
  en §5.3 s'appuie sur `CatastropheReviewQueue.jsx`, déjà en production — deux corroborations
  indépendantes de toute source externe.
- **Système `dnd5e` pour Foundry VTT** (2026-08-27, `github.com/foundryvtt/dnd5e`) — contrairement au
  cœur de Foundry (fermé), ce système de jeu officiel est réellement open source. Confirme la
  séparation jet unique / application par cible pour une AOE : `AttackActivity` fait un seul jet,
  `DamageApplication` (composant de chat séparé) l'applique ensuite à chaque cible sélectionnée avec
  ses propres résistances/immunités — architecture directement transposée en couche 4 §8 étape 8
  (`resolveAoeAttackRoll` = l'équivalent d'`AttackActivity`, la boucle par cible à venir =
  l'équivalent de `DamageApplication`).

---

## 12. État d'implémentation — source de vérité de l'avancement (à tenir à jour, pas la bannière de tête)

> **Analyse à charge du code déjà écrit (2026-08-26, après étape 6a)** — 3 vrais bugs trouvés en
> relisant à froid, corrigés dans la foulée (pas juste notés) :
> 1. `queryTokensInShape` ne filtrait pas les tokens `layer === 'gm'` — un repère MJ (jamais un
>    combattant réel) aurait pu devenir une cible AOE valide. `visibilityActorsFromTokens` exclut déjà
>    ce cas pour les interceptors LOS ; même filtre ajouté ici.
> 2. `evaluateAoeVisibility` ne validait pas `casterToken.position_space` en amont — un lanceur en
>    position legacy aurait silencieusement produit `hasLineOfSight: false` sur CHAQUE cible, sans
>    statut clair, contrairement au reste de ce fichier. Vérifié une fois, en tête, statut net.
> 3. `resolveDistanceBand` faisait confiance à un tableau déjà normalisé sans le vérifier — un tableau
>    construit à la main et non trié aurait donné un résultat FAUX en silence (`Array#find` retourne
>    la première correspondance dans l'ordre du tableau, pas la plus proche). Marqueur non énumérable
>    posé par `normalizeDistanceBands`, vérifié par `resolveDistanceBand` — refus net sinon.
>
> Deux décisions de conception jamais écrites nulle part avant maintenant, à valider :
> - **Convention d'angle `direction`** (`aoeShapes.js`) : 0° = axe +X, sens trigonométrique vers +Z
>   (`atan2(dz, dx)`). Aucune convention existante trouvée à respecter (les entités utilisent des
>   quarts de tour discrets pour une rotation figée à la grille, pas un cap continu) — c'est donc une
>   convention nouvelle qui devient la référence. Le futur code de déclaration (UI de ciblage, §9) devra
>   convertir vers celle-ci explicitement, quel que soit l'angle fourni par le client.
> - **Empreinte des cibles** : la géométrie AOE teste le centre du token, jamais son rayon physique
>   (`navigation.js` modélise un `actorProfile.radius`, ~0,35m par défaut, ignoré ici). Simplification
>   assumée — le RAW raisonne en Localisations/zones, pas en centimètres de bord de token — mais jamais
>   dite explicitement jusqu'à cette relecture.

| Étape (§8) | Fichier(s) | Statut | Testé |
|---|---|---|---|
| 1. VOCABULARY.md | `docs/VOCABULARY.md` | Fait | — |
| 2. Géométrie pure + dispersion | `shared/world/aoeShapes.js` | Codé | `node --test` 10/10, suite `shared/world/*` 125/125 sans régression |
| 3. Primitive de palier générique | `shared/world/distanceBands.js` | Codé, durci (garde de normalisation) | `node --test` 9/9, suite `shared/world/*` 125/125 sans régression |
| 4. Requête spatiale en lot | `worldSpatialQueryService.js#queryTokensInShape` | Codé, corrigé (filtre `layer='gm'`) | Import à blanc seulement (syntaxe/chemins) — aucune DB dans cette session, pas de scénario réel exécuté |
| 5. Composition LOS | `worldVisibilityService.js#evaluateAoeVisibility` | Codé, corrigé (statut net si casterToken invalide) | Import à blanc seulement, même limite que l'étape 4 |
| 6a. Schéma `combat_action_targets` | migration `317_combat_action_targets.js` | Codé et **appliqué** (confirmé par Saar : redémarrage serveur, "Migrations à jour") | Application réelle confirmée ; pas de test de contenu (aucune ligne insérée encore, rien ne l'utilise) |
| 6b. Extension payload `COMBAT_ACTION_DECLARE` (fusil à pompe/suppression) | `server/src/socket/socketCombatAnnouncement.js` | **Codé et testé en session — fonctionnel** (Saar, 2026-08-26 : "Testé et fonctionnelle"). Boucle `mapActions.attack` : accepte une entrée `{ aoe: { direction } }` sans `targetTokenId` (garde mise à jour), validation structurelle minimale (`direction` = nombre fini, rejet net sinon) — **volontairement pas de clamp d'amplitude ici**, ça reste un travail de RÉSOLUTION. `origin`/`amplitude` jamais envoyés par le client. Stocké dans `combat_actions.modifiers.aoe` (JSONB existant, pas de nouvelle colonne). Guard "au moins une cible" mis à jour pour accepter `aoe` en alternative à `targetTokenId`. **Contexte de test** : validé en même temps qu'une série de correctifs avec l'agent en charge d'Exo-armures (même fichier, travail concurrent) — un bug trouvé pendant cette session appartenait à l'interface Exo-armures, pas à l'AOE | Déclaration normale (cible unique) confirmée sans régression + chemin AOE (fusil à pompe/suppression) confirmé fonctionnel, en session réelle contre PostgreSQL |
| 6b-grenades | `server/src/socket/socketCombatAnnouncement.js` | Bloqué sur §6.2bis (catalogue), + besoin d'un champ `intendedOrigin` que fusil à pompe/suppression n'ont pas | — |
| 6c. Catalogue AOE `ref_equipment` (grenades **+ identification fusil à pompe**) | migration à écrire | **Élargi lors de l'étape 7** : au-delà des colonnes de forme/amplitude pour les 6 grenades concernées, doit aussi permettre d'identifier un fusil à pompe (aucune category dédiée aujourd'hui, découvert en tentant de câbler son exclusivité RAW conditionnelle à l'étape 7) — sinon son Action exclusive en rafale ne peut jamais être détectée serveur. Fumigène/à gaz exclues (§10) | — |
| 7. Extension `isExclusiveDeclaration` | `shared/combatExclusiveActions.js` (+ appel réel dans `socketCombatAnnouncement.js`, premier branchement — la fonction n'était appelée nulle part avant) | **Codé pour Tir de suppression et Lance-flammes.** Nouveau champ `aoe.mode: 'suppression'` (déclaré par le client, aucune propriété d'arme ne permet de le déduire). Lance-flammes identifié sans ambiguïté (`ref_category === 'Lanceur'`, `ref_name === 'Lance-flammes'`, vérifié sur le catalogue réel). Interprétation stricte de l'exclusivité tranchée par Saar (2026-08-26) : bloque tout le reste du tour (déplacement, actions rapides, transitions d'état, Tir Multi), alignée sur le Tir visé déjà codé — la RAW générale (`REGLESYSCOMBAT.md:707-710`) est en fait plus étroite ("n'autorise pas d'autres Attaques" seulement), décision produit documentée, pas une lecture littérale. **Fusil à pompe en rafale reste hors scope** — aucune donnée catalogue ne permet d'identifier un fusil à pompe (pas de category dédiée, vérifié), rejoint le travail catalogue de 6c | `node --test shared/combatExclusiveActions.test.mjs` 14/14 (dont 8 nouveaux). Import à blanc de `socketCombatAnnouncement.js` propre. Pas de scénario réel (aucune UI n'envoie encore `aoe.mode`, étape 9) |
| 8. Orchestration couche 4 | `socketCombatHelpers.js#resolveAoeAttackRoll` (phase A) + `#resolveAoeAssaultAction` (phase B) + `shared/combatRange.js#resolveShotgunSpread`/`SHOTGUN_SPREAD_BY_BAND` (table RAW) + `worldVisibilityService.js#evaluateAoeVisibility` (étendue : renvoie désormais `metrics`) | **Phase A + Phase B codées et testées pour le fusil à pompe, tireur PNJ.** Phase A inchangée depuis v7 (UN Test de tir par action AOE, aucune contribution propre à une cible). Phase B (`resolveAoeAssaultAction`, nouveau, ~branché dans `socketCombatResolution.js` avant le dispatch exo/humanoïde existant, jamais dedans) : (1) identifie l'arme par nom (`ref_name === 'Klauss'`, même patron que le lance-flammes — "Arme d'épaule" est partagée par tous les fusils du catalogue, pas un identifiant fiable, §6.2bis) ; (2) construit un `aoeShape` de type `ray` avec le couloir le PLUS LARGE (3m) depuis la position réelle du tireur (couche 1, deux passes géométriques — v8, voir bannière) ; (3) appelle `evaluateAoeVisibility` (couche 2+3, déjà codée v7, étendue pour exposer `metrics`) ; (4) retest chaque candidat contre la largeur RÉELLE de son propre palier RAW (bout portant exclu — "ne touche qu'une cible", pas de zone géométrique, décision documentée) ; (5) UN seul jet (Phase A), jamais de branche "raté" (RAW relu : un fusil à pompe touche toujours tout le monde dans la zone, la marge module seulement le dégât) ; (6) insère les lignes `combat_action_targets` (§3, à la RÉSOLUTION) ; (7) boucle par cible et appelle directement `damageService.resolveTargetHit`/`exoAvarieService.resolveExoDamage`/`resolveDroneIntegrityLoss` selon le type de cible (même niveau que les fonctions-feuilles `resolveAssaultHit*`, jamais un second pipeline de dégâts) ; (8) écrit `outcome` par ligne sous garde idempotente (`WHERE outcome IS NULL`). **Scope volontairement réduit à cette tranche** (bannière de tête) : tireur PJ, tir de suppression et lance-flammes rejetés avec un message clair (pas un no-op silencieux) ; dual-wield ignoré. **Tireur PJ séquencé APRÈS le rework de séparation des fenêtres DRONE/HUMAN/EXO-ARMURE** (décision Saar 2026-08-27, en cours de planification — bannière de tête) : ce rework touche exactement `confirmedModifiers`/`armAwaitingDamage`/`confirmDamage`, le coder avant serait à refaire. Test de Chance (longue/extrême) : ignoré en v1, aucune colonne Chance dans le schéma (§5.2 affiné) — dégât réduit appliqué sans aucune chance d'esquive complète | `node --test` — suite complète 603/603 exécutables (299 tests DB-intégration existants restent `skip` sans `DATABASE_URL`, aucun rapport avec ce chantier), 0 échec, aucune régression. `node --check` + import ESM réel (`socketCombatResolution.js`) propres sur les 3 fichiers touchés. **Aucun scénario réel exécuté contre PostgreSQL** (pas de `DATABASE_URL` dans cette session) — voir note ci-dessous |
| 9. UI de ciblage | `assaultDeclaration.js` (+hook) + `shared/combatRange.js#isShotgunSpreadWeapon` + `client/src/lib/aoePreviewShape.js` (nouveau) + `useCombatUIState.js` + `Canvas3D.jsx` + `AssaultRangedPanel.jsx` + `CombatGmDeclareWindow.jsx` + `CombatActionWindow.jsx` + `CombatOverlay.jsx` + `SessionPage.jsx` + `buildDeclarePayload.js` + `shared/combatExclusiveActions.js` (+serveur `socketCombatAnnouncement.js`) + `server/src/routes/battlemaps.js` (fix données) + `CombatModifiersWindow.jsx` (fix résolution + bug `canRoll` dupliqué 3×) | **Validé en session réelle de bout en bout par Saar — combat complet, 3 cibles touchées (dégâts transmis) pour le fusil à pompe, tireur PNJ.** Bug d'éligibilité (donnée manquante `/combat-equipment`), gate Portée bloquant "Lancer" (dupliqué 3× dans `CombatModifiersWindow.jsx` — `disabled`/`opacity`/`handleLancer`, unifié en une seule variable `canRoll`, équivalence vérifiée par De Morgan pour le Tir normal), et redesign zone-only (le Klauss n'a aucun mode de tir normal, RAW — mécanisme d'exclusivité v9 retiré, pas laissé en dead code) : tous corrigés et confirmés. Diagnostic géométrique confirmé par log réel (`hitTargets.length:3`, LOS et couloir corrects) avant retrait des logs temporaires | `node --test` : 117/117. `npx eslint`/`npm run build`/`node --check` propres. **Historique de l'aperçu 3D, 3 itérations avant la bonne** : (1) survol passif seul — mode armé pour l'ancien PNJ restait vivant après un changement de slot, un clic pour le nouveau token committait une direction calculée depuis la position de l'ancien tireur ; corrigé (`CombatGmDeclareWindow.jsx`/`CombatActionWindow.jsx` annulent tout mode de visée résiduel dans leur effet de reset déjà existant au changement de token). (2) clic-glisser-relâcher (mirroir Foundry VTT — [Measurement and Templates](https://foundryvtt.com/article/measurement/)) — le rendu fonctionnait (confirmé par logs `[DBG]` temporaires), mais Saar l'a jugé peu naturel ("pas naturel de maintenir un clic pour sélectionner une cible") et la zone ne suivait pas un ajustement de souris pendant le maintien. (3) même patron que `combatTargetMode`/`pendingTargetId` retenu (survol continu, un clic fige, recap Valider/Changer dans `CombatOverlay.jsx`) — mais le survol restait figé à sa position initiale, jamais mis à jour ("stop approximation et bricolage", Saar). **Cause racine** : le suivi de souris reposait sur un `pointermove` DOM géré à la main (`addEventListener`) plutôt que sur le raycaster que React Three Fiber maintient déjà en interne. Corrigé en adoptant le patron officiel R3F ([How does it work?](https://r3f.docs.pmnd.rs/tutorials/how-it-works), [discussion pmndrs/react-three-fiber #3321](https://github.com/pmndrs/react-three-fiber/discussions/3321)) : `useFrame` lit `state.raycaster` (repositionné par R3F à chaque déplacement de souris) au lieu d'un listener maison — logique de détection de surface factorisée (`findWorldSupportHit`) entre le clic (`raycastWorldSupport`) et cette boucle, une seule implémentation. Le clic pour figer reste un listener natif `pointerup` (déjà fiable ailleurs dans ce fichier), inchangé. **(4) bug persistant après (3)** signalé par Saar : "l'AOE est posée dès le clic sur CIBLE" et "Changer sans effet". Diagnostic (lecture seule, sans code, présenté et validé avant correctif) : au clic sur "Viser une zone"/"Changer" (bouton du panneau latéral, donc hors du `<canvas>`), `state.raycaster` de R3F n'a pas encore reçu de nouveau `pointermove` — il reste positionné sur le dernier survol réel du canvas, souvent bien antérieur à l'ouverture du panneau (ex. le clic ayant sélectionné le token). `useFrame` tournait bien à chaque image mais recalculait inlassablement le même angle à partir de ce rayon obsolète, d'où une zone qui semblait « déjà posée » et ne bougeait plus tant que la souris n'était pas physiquement repassée sur la carte — et "Changer" (qui réarme exactement le même mécanisme) semblait sans effet pour la même raison. Corrigé par un garde-fou `aoeArmedMovedRef` (`Canvas3D.jsx`) : `false` à chaque réarmement (`combatAoeTargetMode.armSeq`, nouvel identifiant d'armement ajouté dans `useCombatUIState.js`, distinct de `pendingDirectionDeg`), posé à `true` par le `pointermove` natif déjà existant sur le canvas dès le premier mouvement réel depuis cet armement ; `useFrame` n'affiche l'aperçu qu'une fois ce flag vrai — aucun aperçu tant que la souris n'est pas physiquement revenue sur la carte, conforme à l'intention initiale de Saar ("la zone apparait sous le curseur", pas sous une position obsolète). `node --test` 117/117, `eslint`/`npm run build` propres (baseline lint inchangée). **(5) le correctif (4) n'a rien changé** (serveur et navigateur relancés à froid par Saar, même symptôme) : logs `[DBG]` temporaires posés à 5 points (armement, premier `pointermove`, angle calculé dans `useFrame`, `onPendingDirection`, `onDirectionSelected`) → **l'état se mettait à jour parfaitement** (l'angle loggé suivait la souris en continu, de 100° à 222°, `onPendingDirection`/`onDirectionSelected` corrects) mais **rien ne changeait visuellement à l'écran**. Cause racine confirmée en lisant directement `applyProps` dans le code source installé de `@react-three/fiber` (`node_modules/@react-three/fiber/dist/events-*.cjs.dev.js`) plutôt qu'en supposant : réaffecter la prop `array` d'un `<bufferAttribute>` déjà monté (même clé JSX à travers les rendus) remplace bien `.array` en JS mais ne déclenche jamais `.needsUpdate = true` sur l'attribut — ni `applyProps` (branches "Copy"/"Set array types"/"Set literal types" ne matchent pas un `Float32Array`, retombe sur une simple réaffectation `root[key] = value`) ni R3F ne le font automatiquement pour ce cas. Le tampon envoyé au GPU restait donc celui du tout premier rendu, gelé, alors que le JS recalculait bien un angle correct à chaque frame. Confirmé par la doc officielle R3F (tutoriel "Basic animations" : mutation directe + `needsUpdate = true` dans `useFrame`, jamais un simple prop React, pour ce genre de mise à jour). Corrigé en incluant l'angle (précision 0,1°, même granularité que le garde-fou perf existant) dans la `key` du `<mesh>` : force un remontage complet de `bufferGeometry`/`bufferAttribute` à chaque mise à jour réelle plutôt qu'une mutation en place — un remontage (au lieu d'un `ref`+`needsUpdate` par quad) est sans risque ici car la cadence est déjà limitée par ce même garde-fou (mouvement de souris réel, jamais 60 im/s constant). `node --test` 117/117, `eslint`/`npm run build` propres (baseline inchangée), logs `[DBG]` retirés après diagnostic confirmé. **Confirmé par Saar en session réelle (2026-09-03)** : log serveur complet d'un combat de bout en bout avec Tir en zone au Klauss — `PRECHECK assault ... ok:true`, `resolveAoeAssaultAction` exécuté, `COMBAT_ACTION_CONFIRM` résolu sans erreur, combat terminé normalement (`endTurn` puis `FIN COMBAT`). **Étape 9 (UI de ciblage) close.** |

**Non testé, à ne pas perdre de vue** : la chaîne ANNONCE (6b, fusil à pompe/suppression) est confirmée
en session réelle (session précédente). La chaîne RÉSOLUTION (couches 2-4, étape 8) est codée, testée
au niveau unitaire/import et sans régression sur la suite existante, **mais jamais exécutée contre une
vraie battlemap PostgreSQL** — aucune session réelle depuis l'ajout de `resolveAoeAssaultAction`. Un
scénario de bout en bout reste à faire (déclarer un Klauss en zone, PNJ tireur, plusieurs cibles à des
paliers différents, une hors LOS, dégâts corrects par cible) avant de considérer le fusil à pompe
fonctionnellement clos — validation groupée en session réelle, préférence connue de Saar, pas un test
isolé par sous-étape. Tireur PJ, tir de suppression, lance-flammes et grenades restent chacun un
blocage explicite et documenté, pas un oubli.
