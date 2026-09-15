# PLAN_INFORMATIQUE.md — Plan technique : ordinateurs, programmes, pannes électroniques

> Créé 2026-09-09, réécrit intégralement 2026-09-11 (`METHODO_PLAN.md` — conformité au livrable
> type et au marquage [VÉRIFIÉ]/[INFÉRÉ], après constat que la version précédente était restée un
> stub narratif malgré une matière technique abondante mal rangée dans le MANUEL).
> **Analyse à charge du PLAN, 2026-09-11** : quatre corrections après vérification directe — le
> chiffre « 8/8 tests » de `computerStats.js` (repris sans être rejoué) était faux, 16/16 en
> relançant réellement la suite ; `runCombatWeaponPanne` (lu ligne à ligne) teste l'arme de
> l'attaquant sur un tir raté, forme inverse du besoin IEM (matériel du défenseur sur un coup
> réussi) — le Lot 2 doit écrire une fonction sœur, pas réutiliser celle-ci ; une citation « MANUEL
> note ce cas comme rare » ne correspondait plus au MANUEL réécrit ; une contradiction Lot 1/Lot 2
> sur qui touche `damageService.js` a été précisée (§4, Lot 1/Lot 2).
>
> **Responsabilité unique** : architecture technique (fichiers, schéma, séquencement, tests). Ce
> document ne contient **aucune règle métier** — celles-ci sont entièrement dans
> `docs/MANUELS/MANUEL_INFORMATIQUE.md`. Toute question « pourquoi ce malus / ce seuil / cette
> formule » se répond dans le MANUEL, jamais ici (Règle 9/10, `docs/RegleDocumentaire.md`).
>
> Sources : `docs/MANUELS/MANUEL_INFORMATIQUE.md` (règles), `docs/PLANS/PLAN_EXOARMURE.md` §13.4
> (Lot C, architecture existante réutilisée), `shared/computerStats.js` (+ suite de tests relancée),
> `server/src/routes/character/char-sheet.js`, `server/src/socket/socketCombatHelpers.js`
> (`runCombatWeaponPanne`), `shared/weaponAmmoDsl.js`, `server/src/lib/damageService.js`,
> `server/src/db/migrations/{42,43,65,139,140,236,237,303}*`, requêtes directes sur `enclumeBD`
> (2026-09-11).
>
> Statut : couches 1-2 seulement (couches 3-5 n'ont pas encore de MANUEL, donc pas de PLAN).
> Cadrage terminé, exécution non commencée.

---

## 1. Objectif

Combler l'écart entre les règles posées dans `MANUEL_INFORMATIQUE.md` et l'état réel du code.
**L'essentiel de l'infrastructure existe déjà** (§2) — ce plan ne construit pas un chantier depuis
zéro, il documente précisément ce qui manque (§3) et séquence son implémentation (§4).

---

## 2. État de l'existant — [VÉRIFIÉ] par lecture de code et requête directe (2026-09-11)

### 2.1 Sous-système Exo-armures (Lot C, `PLAN_EXOARMURE.md` §13.4, codé et clos le 2026-08-21)

- **`exo_computers`** (migrations 42/139/236) : `character_id`, `role` (CHECK `principal`/`secours`),
  `gen`/`nt` (smallint NOT NULL), `blindage_iem` (integer nullable), `integrite_max`/
  `integrite_current`, `sort_order`.
- **`ref_exo_template_computers`** : même forme côté catalogue de modèles, utilisée par
  `applyExoTemplate` pour pré-remplir `exo_computers` à la sélection d'un modèle.
- **`exo_programs`** (migrations 43/140/237) : `character_id`, `equipment_id` (FK `ref_equipment`,
  catalogue `family='Logiciels'`), `label_override`, `category`, `level` (CHECK 0-30),
  `sort_order`, `exo_computer_id`.
- **`shared/computerStats.js`** : `computeOrdinateurStats({gen, nt})` (les 4 formules RAW du
  MANUEL §4.1), `computeBlindageIemCost(niv)`, `resolveOrdinateurIntegrityFormula(gen)` (MANUEL
  §4.2), `resolveActiveComputer(computers)` (bascule principal/secours, MANUEL §4.9 dernier
  paragraphe). **[VÉRIFIÉ] — corrigé (analyse à charge) : `node --test shared/computerStats.test.mjs`
  relancé directement le 2026-09-11, 16/16 verts**, pas 8/8 comme l'affirmait la citation reprise
  telle quelle de `PLAN_EXOARMURE.md` sans être rejouée (la suite a grandi depuis cette citation).
- **Contrainte de capacité déjà appliquée en écriture**, pas seulement calculée :
  `server/src/routes/character/char-sheet.js:2760-2764` (création d'un `exo_programs`) et
  `:2822-2829` (modification) lèvent une `AppError(400)` si le niveau dépasse le Niveau maximum de
  l'ordinateur porteur, ou si la somme dépasse son Potentiel — couvre exactement MANUEL §4.9 points
  1-2.
- Côté **drone**, contrainte de Potentiel équivalente et indépendante :
  `char-sheet.js:1877-1883`, calculée directement depuis `drone_sheet.ordinateur_gen`/
  `ordinateur_nt` (colonnes scalaires — pas de table `drone_computers`, cohérent avec un seul
  ordinateur par drone).

### 2.2 Catalogue de programmes (couche 2)

`ref_equipment` porte **34 lignes `family='Logiciels'`** (requête directe, 2026-09-11), couvrant la
quasi-totalité du RAW de base (Sécurité, Ami/ennemi, Analyse senseurs/sonars/radars, Topographique,
Détection, Données, Gestion d'appareils, Cryptage, Décryptage, Communication, Brise-code, Viral
autonome, Espion, Anti-espion, Rempart, Offensif, Contre-attaque — avec leurs `price_modifier` RAW
exacts, ex. `"1200 × cumul"`, `"1000 × niv²"`) et des programmes drone/exo hors RAW de base
(Contact, Balistique, Bombardement, Esquive, Pilotage, Dissimulation, Interception, Chirurgie,
Analyse médicale, Premiers soins, Multi-langages, Mécanique-électronique-informatique, Extraction,
Science botanique/agriculture).

### 2.3 Occupation réelle en base (requête directe, 2026-09-11)

| Table | Lignes | Note |
|---|---|---|
| `exo_computers` | 4 | 2 personnages réels, cohérent avec un principal + un secours chacun |
| `exo_systems` | 54 | — |
| `exo_weapons` | 10 | — |
| `ref_exo_template_computers` | 21 | proche des ~20 attendus pour 16 modèles RAW dont 4 à deux ordinateurs (écart de 1, [À VÉRIFIER] non bloquant) |
| `exo_programs` | **0** | **la contrainte de capacité est câblée et testée, mais aucun programme n'a jamais été installé en usage réel** — flux existant, non éprouvé en jeu |
| `ref_equipment` (`category='Ordinateur'`) | 6 | toutes ont `generation: NULL`, `tech_level: 1` uniforme — aucune ne peut recevoir d'ITG par la formule du MANUEL §4.2 tant que sa génération n'est pas renseignée |

### 2.4 Point d'intégration IEM — vérifié absent, et le candidat évident ne convient pas

`shared/weaponAmmoDsl.js#AMMO_MECHANIC_ACTIONS`/`resolveAmmoMechanic` traite déjà le tag `FX=IEM`
comme non reconnu (retourne `null`, comportement inchangé). **Ce registre n'est cependant pas le
bon point d'accroche** : il n'est consommé que par `server/src/lib/damageService.js`
(`:102`, `:160`, `:419-421`), un module de calcul de dégâts pur (facteur d'armure, Choc fixe,
dropoff par portée) — aucun effet de bord n'y transite jamais. Câbler l'IEM à cet endroit
produirait au mieux un modificateur de dégâts inerte, jamais un second Test de panne.

Le patron à suivre est celui déjà utilisé par la « porte de panne » du chantier Usure en combat.
**[VÉRIFIÉ] — lu directement (analyse à charge, 2026-09-11)** : `runCombatWeaponPanne`
(`server/src/socket/socketCombatHelpers.js:874`, appelée aux lignes 1241 et 2751, une fois par
pipeline melee/assaut) est bien un effet de bord post-résolution — jet + `DICE_RESULT` + message
`COMBAT_SYSTEM_NOTICE` (`combat:integrityPanne.*`), autour de la primitive `runPanneTest` (services
du chantier Usure).

**Mais la fonction elle-même n'est pas directement réutilisable telle quelle, seulement son
patron** : `runCombatWeaponPanne` teste l'**arme de l'attaquant**, déclenchée quand **son propre**
jet d'attaque a **échoué** (`!outcome.isSuccess`, ITG de l'arme entre 1 et 5) — c'est la « porte de
panne » historique de l'Usure (arme qui s'enraye sur un tir raté). Le déclencheur IEM a la forme
inverse : il doit tester le matériel du **défenseur**, quand l'attaque **a touché** — deux
conditions de déclenchement opposées, une cible différente (inventaire/`exo_computers` du
défenseur, pas l'arme de l'attaquant). **Conséquence pour le Lot 2** : écrire une fonction sœur sur
le même patron (jet + `DICE_RESULT` + notice), pas appeler `runCombatWeaponPanne` — à nommer et
positionner au moment de l'implémentation, probablement juste après confirmation d'un coup porté
plutôt qu'après un coup manqué.

### 2.5 Écart RAW confirmé sur le seed existant

La munition IEM seedée porte `FX=IEM(TEST_PANNE:-1/2D10_ARME)` — malus **−1** (MANUEL §4.5 : RAW
réel −3), dégâts `2D10_ARME` fixe (MANUEL §4.5 : RAW réel = moitié des dégâts normaux de l'arme).
Aucun consommateur actuel (`resolveAmmoMechanic` retourne `null`) — correction sans risque de
régression.

### 2.6 Gap confirmé — Gestion systèmes, aucune auto-désactivation codée

Recherche exhaustive (`grep` sur `server/`, 2026-09-11) : « gestionSystemes »/« Gestion systèmes »
n'apparaît que dans le texte descriptif d'un programme catalogue (`303_ref_equipment_seed.js`,
recopie du RAW) — **aucune occurrence dans un chemin d'exécution**. La formule existe
(`computeOrdinateurStats.gestionSystemes`) mais rien ne la compare au nombre de systèmes
réellement rattachés à un ordinateur, et aucune désactivation automatique n'existe. Distinct de la
contrainte Potentiel/Niveau max (§2.1), qui elle est confirmée codée.

---

## 3. Écart à combler — le périmètre technique réel restant

Six éléments, aucun autre, vérifiés par lecture directe :

1. Propriété catalogue `is_electronic` (n'existe pas) + curation des objets qui la portent.
2. Déclencheur de Test de panne sur attaque IEM (§2.4) — le seul vrai morceau de mécanique neuve.
3. Correction du seed Balles IEM (§2.5).
4. Colonne(s) et mécanisme de Survie I.E.M. (MANUEL §4.7) — absents de tout schéma actuel.
5. Auto-désactivation de Gestion systèmes (§2.6) — bloqué par l'absence de critère de
   hiérarchisation RAW (MANUEL §6/§8.1).
6. Seed des 7 programmes Guide Technique manquants (MANUEL §4.8).

---

## 4. Architecture cible, par lot

### Lot 1 — Contenu catalogue (risque faible, aucune dépendance)

- **Migration** : `ref_equipment.is_electronic boolean not null default false` — additive pure,
  patron identique à `has_integrity` (`MANUEL_USURE.md`/migration 329). Numéro de migration à
  vérifier au moment de l'écriture (`ls server/src/db/migrations/` + `knex_migrations`, jamais
  supposé — `.claude/rules/migrations.md`).
- **Curation** : marquer `is_electronic=true` sur les objets concernés — taille non estimée
  ([INFÉRÉ], comparable à la curation `has_integrity` de l'Usure L0, ~236 lignes revues).
- **Seed** : les 7 programmes Guide Technique (MANUEL §4.8) ajoutés à `ref_equipment`
  (`family='Logiciels'`), même forme que les 34 lignes existantes.
- **Correctif** : seed Balles IEM — malus `-1` → `-3`, remplacer `2D10_ARME` par la mécanique
  « moitié des dégâts normaux » ([À TRANCHER] : nouvelle primitive DSL dédiée aux dégâts réduits de
  moitié, ou paramètre existant à identifier dans `weaponAmmoDsl.js` — pas encore vérifié).
- **Tests** : `node --check` sur les migrations, script de vérification du nombre de lignes
  `family='Logiciels'` (41 attendu après seed : 34 + 7), non-régression du round-trip migration
  (`.claude/rules/migrations.md`).

### Lot 2 — Déclencheur de Test de panne par IEM

- **Site d'appel** : nouvelle fonction sœur de `runCombatWeaponPanne` (§2.4, [VÉRIFIÉ]), appelée au
  moment où un coup est confirmé porté sur le défenseur — à positionner précisément dans
  `socketCombatHelpers.js` au moment de l'implémentation (près des deux sites d'appel existants de
  `runCombatWeaponPanne`, lignes 1241/2751, sans en modifier le comportement).
- **Portée d'un hit** (combien d'objets testés) — dépend de la décision MANUEL §6/§8.1, à trancher
  avant d'écrire ce lot.
- **Primitive d'énumération** : filtrer `char_inventory` (jointure `ref_equipment`) par
  `is_electronic = true`, même garde `container !== 'Coffre'` que le calcul de poids porté
  (`gmArbitratedTestService.js`) — pour le cas générique. Pour exo, la cible directe est
  `exo_computers` (et son `blindage_iem`) plutôt qu'une énumération d'inventaire.
- **Événement WS** : réutiliser le patron déjà en place pour la panne d'Usure (`DICE_RESULT` +
  `COMBAT_SYSTEM_NOTICE` côté combat, `INVENTORY_UPDATED` côté `char_inventory` — §2.4) ; équivalent
  côté `exo_computers` — pas d'événement `EXO_UPDATED`/équivalent confirmé à ce jour, [À VÉRIFIER].
- **Aucune modification de `shared/integrityRules.js`** : le déclenchement IEM est un nouvel
  appelant de `interpretPanneOutcome`/`runPanneTest`, pas une nouvelle branche de calcul.
- **Frontière avec `damageService.js`/`weaponAmmoDsl.js` — précisée (analyse à charge)** : le Lot 1
  peut y toucher pour la réduction de dégâts des Balles IEM (moitié dégâts, un calcul de dégâts pur
  — sa place légitime). Le Lot 2 n'y touche **pas** : le déclenchement du Test de panne lui-même
  est un effet de bord de combat, jamais une entrée `AMMO_MECHANIC_ACTIONS`. Les deux lots peuvent
  toucher les mêmes munitions IEM, chacun sa moitié du problème, sans se chevaucher.
- **Tests** : scénario Balles IEM sur cible avec objet `is_electronic`, avec/sans Blindage IEM ;
  non-régression du pipeline de dégâts existant côté Lot 2 (la fonction sœur de
  `runCombatWeaponPanne` ne modifie aucun calcul de dégâts, seulement `damageService.js` du Lot 1
  le fait, pour la réduction de moitié — cf. ligne ci-dessus).

### Lot 3 — Blindage IEM (lecture) + Survie I.E.M.

- **Blindage IEM côté exo** : lire `exo_computers.blindage_iem` (colonne déjà présente) dans le
  calcul du Lot 2 — aucune migration.
- **Blindage IEM côté drone** : `drone_sheet` n'a pas de colonne équivalente ([VÉRIFIÉ],
  `38_drone_sheet.js` ne porte que `ordinateur_gen`/`ordinateur_nt`) — migration additive à
  prévoir si le cas drone est couvert en V1 ([À TRANCHER]).
- **Blindage IEM côté ordinateur générique** (`ref_equipment`) : aucune colonne — [À TRANCHER au
  Lot 3] si ce cas doit être couvert en V1. **Citation corrigée (analyse à charge)** : la version
  précédente de ce document attribuait au MANUEL la mention « cas rare » pour ce point précis — le
  MANUEL réécrit (§4.6) ne la fait plus ; le mot « rare » n'y qualifie que la Survie I.E.M. sur les
  drones (§4.7), pas le Blindage IEM générique. Question ouverte sans jugement de fréquence associé.
- **Survie I.E.M.** : nouvelle colonne sur `exo_computers` (cohérent avec `blindage_iem`, même
  table, même granularité par ordinateur) — **bloqué par la question de propriétaire** entre ce
  chantier et Exo-armures (MANUEL §3.2/§8.1) : à trancher avant d'écrire la migration, pour éviter
  qu'un autre agent modifie `exo_computers` en parallèle sans le savoir (risque déjà signalé,
  `PLAN_EXOARMURE.md` documente plusieurs corrections après-coup sur ce même Lot C).
- **Dépendance inter-lots (corrigé après analyse à charge du MANUEL, §4.7)** : la branche −2 de la
  Survie I.E.M. ne dépend pas du jet de l'attaquant mais du fait que **le Test de panne du
  défenseur lui-même (Lot 2) ait été un échec critique**. La fonction de Survie I.E.M. a donc
  besoin en entrée du résultat détaillé du Test de panne produit par le Lot 2 (pas seulement
  « succès/échec »), pas seulement du jet pair/impair qui lui est propre — à câbler dans cet ordre,
  pas les concevoir indépendamment.
- **Tests** : `computeSurvieIemOutcome`-style fonction pure (nom à définir), testée unitairement
  contre les trois issues RAW (panne évitée / malus −1 / malus −2 sur échec critique du Test de
  panne) et la dégradation par activation.

### Lot 4 — Auto-désactivation Gestion systèmes

**Bloqué** par l'absence de critère RAW de hiérarchisation (MANUEL §6/§8.1) — aucune architecture
proposée tant que ce point n'est pas tranché avec Saar. Piste non engagée : `sort_order` déjà
présent sur `exo_systems`/`exo_programs` comme proxy de priorité déclarative — à évaluer une fois
le critère confirmé.

---

## 5. Risques et dépendances de coordination

- **Propriété de `shared/computerStats.js`** — écrit par le chantier Exo-armures, référencé comme
  autorité par ce chantier (MANUEL §4.1/§4.2/§4.9), et cible d'un ajout potentiel au Lot 3
  (fonction Survie I.E.M.). Aucun des deux chantiers n'en est formellement propriétaire — à
  clarifier avant le Lot 3, risque de modification concurrente sinon.
- **`exo_computers`** — toute migration dessus (Lot 3) doit être vérifiée contre l'état réel de la
  table en base au moment de l'écriture, pas seulement contre les migrations telles que lues dans
  ce document (le Lot C source a lui-même été corrigé plusieurs fois en cours de route d'après
  `PLAN_EXOARMURE.md` — aucune raison que ce chantier-ci y échappe).
- **Ne pas toucher sans nécessité avérée** : `exo_programs`, `ref_exo_template_computers`, la
  contrainte de capacité déjà en place dans `char-sheet.js` — tout ça est construit et testé,
  référence pour ce chantier, pas cible de modification.

---

## 6. Hors-scope

Reprend intégralement `MANUEL_INFORMATIQUE.md` §7, plus les précisions techniques suivantes :
- Couches 3-5 : aucun PLAN tant que leur MANUEL respectif n'existe pas.
- Cas générique d'un ordinateur personnel avec programmes installés : aucune table équivalente à
  `exo_programs`/`drone_programs` n'existe pour ce cas et ne sera pas créée en V1.
- Toute modification du pipeline `damageService.js`/`weaponAmmoDsl.js` au-delà de la correction de
  seed (§4, Lot 1) — le déclencheur IEM ne doit pas y transiter (§2.4).
