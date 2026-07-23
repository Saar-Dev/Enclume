# PLAN_ARMES_DSL.md — Chantier 11 (Blessures), Étape 2 : Module Armes DSL

> Créé : 2026-07-16 (dev/Saar). Statut : **Lot A codé et testé**. **Lot B codé et testé, correctif
> appliqué** (2026-07-17) — mécanique de gate initialement câblée sur la mauvaise règle (voir §Lot B
> ci-dessous), corrigée + migration `160` appliquée. **Lot C recadré** (2026-07-16) — plus un lot
> d'affichage seul, désormais 3 sous-lots mécaniques (C1 Pénétration/Armure, C2 Test de panne, C3 Zone
> d'effet Shrapnel), aucun codé, méthode pas-à-pas imposée par Saar : un sous-lot à la fois, code
> seulement une fois le sous-lot entièrement tranché.
> Voir `docs/VOCABULARY.md` "Dommages de Choc" pour la distinction à 3 catégories qui a révélé le bug B.
> Prérequis Chantier 10 sprint 4 : ✅ livré session 55.
> Document temporaire (`docs/RegleDocumentaire.md` Règle 10) — à archiver dans `docs/Old/` une fois
> le chantier clos, contenu durable transféré vers `docs/SYSTEME/BLESSURES.md`/`COMBAT.md`.

---

## 0. Cadrage — ce qui est réellement vrai aujourd'hui

**Correction terminologique** `[VÉRIFIÉ]` : `docs/ROADMAP.md` (ligne 233, avant mise à jour) décrit
la colonne comme `ref_equipment.effects`. La colonne réelle est **`ref_equipment.ammo_effects`**
(`server/src/db/migrations/48_ref_equipment.js:70`, confirmée `docs/Old/SCHEMA_EQUIPMENT.md:60`).

**Portée réelle** `[VÉRIFIÉ]` : dans `docs/Old/script Extraction Excel/equipement/STEP1_cleaned_data.js`,
`mod_ammo_eff` (→ `ammo_effects` au seed) n'apparaît que sur des lignes `base_family: "Munitions"`.
Le libellé ROADMAP "DSL effets **armes**/munitions" est donc imprécis : c'est un DSL de munitions
uniquement. Les armes elles-mêmes gardent leurs stats propres (`damage_h`, `shock`, `range`, déjà
utilisées) — rien dans les données observées ne porte ce DSL sur une ligne `family='Armes'`.

**État actuel** `[VÉRIFIÉ]` par lecture de `damageService.js`, `socketCombatHelpers.js`,
`socketCombatResolution.js` : le dégât d'un tir vient toujours de `ref_equipment.damage_h` de l'arme
(`weapon.ref_damage_h`), quelle que soit la munition chargée (`char_inventory.current_ammo`).
`ammo_effects` est stocké mais **jamais lu** par le pipeline de combat — charger une munition
différente n'a aujourd'hui aucun effet mécanique, seulement un effet de stock/affichage
(`WeaponPanel.jsx`).

`damageService.resolveTargetHit` (Étapes 1/1b/3, déjà livrées) reste le seul point d'insertion pour
localisation/armure/RD/sévérité/blessure/Test de Choc — ce chantier ne le duplique pas, il complète
uniquement ce qui alimente son paramètre `degautsBruts` en amont.

---

## 1. Vocabulaire DSL réel observé

Échantillon réel (`STEP1_cleaned_data.js`, dédupliqué) :

```
DMG=BASE
DMG=BASE;PEN=BASE
DMG=SET(1D6+2);CHOC=SET(BP:5D10,C:4D10,M:3D10,L:2D10,E:1D10);TXT=FX=ASSOMMANTE
DMG=SET(3D10+4);TXT=PEN=SET(15)|FX=APHC
DMG=SET(2D10+3);TXT=PEN=SET(5)|FX=SAP
DMG=MUL(0.5);TXT=FX=IEM(TEST_PANNE:-1/2D10_ARME)
DMG=ADD(1D10,+1/5D10_ARME);CHOC=ADD(1D10,+1/5D10_ARME);TXT=ARMOR=CHOC_IGNORE_SIMPLE|FX=EXPLOSIVE
DMG=BASE;RANGE=SHORT_10M,SHIFT_-1;TXT=PEN=SET(5)|DMG_DROP=-1D10/RANGE|AREA=CONE_3M|FX=SHRAPNEL
DMG=BASE;RANGE=AIR_X2;TXT=DEPTH=>500M_X0.5|DEPTH=>=1000M_DISABLE
```

Syntaxe : paires `TYPE=ACTION(VALEUR)` séparées par `;` ; `TXT=` regroupe des sous-tags séparés par
`|`. Actions observées : `BASE` (aucun changement), `SET(x)` (écrase), `ADD(x, scaling?)` (ajoute,
parfois avec un facteur d'échelle `+1/5D10_ARME` = "+1 par tranche de 5D10 dans la formule de
l'arme"), `MUL(x)` (multiplicateur sur le total, pas sur la formule).

**`CHOC=SET(BP:...,C:...,M:...,L:...,E:...)`** `[VÉRIFIÉ]` : les clés `BP/C/M/L/E` correspondent
exactement à `RANGE_BANDS` de `shared/combatRange.js` (`bout_portant/courte/moyenne/longue/extreme`),
déjà utilisé pour `authoritativeRangeBand` en résolution de combat — réutilisable directement, pas de
nouvelle table de portée à inventer.

**Description LdB confirmée** `[VÉRIFIÉ]` : `base_description` de la "Balle assommante" cite
textuellement la règle ("dommages physiques 1D6+2… Dommages de Choc de 5D10 à bout portant, puis
4D10 à courte portée…") — le DSL encode fidèlement une règle réelle du Livre de Base, pas une
invention de session. `docs/REGLES/REGLESYSCOMBAT.md` ne contient pas cette règle (extrait limité au
chapitre résolution, pas au catalogue équipement) — la source d'autorité pour chaque munition reste
sa propre colonne `description` en base, à relire au cas par cas avant de coder un Lot donné.

Tags `TXT=FX=` rencontrés : `ASSOMMANTE`, `APHC`, `SLAP`, `SAP`, `EXPLOSIVE`, `HP`, `SHRAPNEL`,
`IEM(TEST_PANNE:...)`. Sous-clés `TXT=` additionnelles : `PEN=`, `ARMOR=`, `RANGE=`, `DMG_DROP=`,
`AREA=`, `DEPTH=`.

---

## 1bis. Recherche & inspiration (avant conception — demande explicite Saar)

Aucune urgence sur ce chantier ; recherche menée avant de figer l'architecture, pas seulement une
implémentation "au fil de l'eau".

**Ce qui a été regardé :**
- [Foundry VTT — Active Effects](https://foundryvtt.com/article/active-effects/) : sépare toujours
  "donnée de base" (catalogue, jamais mutée) et "donnée dérivée" (recalculée à chaque résolution).
  Principe déjà respecté par `damageService.resolveTargetHit` existant — confirme qu'il ne faut
  jamais écrire un résultat de parsing DSL dans `ref_equipment` ou `char_inventory`.
- [PF2e (Foundry) — Rule Elements](https://github.com/foundryvtt/pf2e/wiki/Quickstart-guide-for-rule-elements) :
  précédent le plus directement comparable — un objet d'effet (chez eux JSON, chez nous une chaîne
  DSL) est identifié par une clé (`DMG`, `CHOC`, `ARMOR`, `RANGE`…), chaque clé dispatchée vers un
  handler dédié et interchangeable. C'est un projet communautaire mature (des milliers d'items), la
  preuve que ce pattern "registre de handlers par clé" tient à l'échelle plutôt qu'une chaîne
  `if/else`. Enclume n'a pas besoin de migrer vers du JSON (le texte `ammo_effects` est une donnée de
  catalogue déjà saisie pour des centaines d'items — migrer le format serait un chantier séparé, hors
  scope) : on adopte le **principe** (dispatch par clé, handlers isolés, extensible sans toucher le
  cœur du parseur), pas leur format de stockage.
- Recherche complémentaire sur les parseurs de petits DSL en JS : un parseur écrit à la main
  (tokenizer `split(';')`/regex) est le choix recommandé ici plutôt qu'un générateur de parseur
  (nearley/peggy/chevrotain) — la grammaire est plate (paires `CLE=ACTION(VALEUR)`, un seul niveau de
  sous-liste `TXT=...|...`, aucune récursion, aucune priorité d'opérateurs), et un parseur à la main
  donne des messages d'erreur spécifiques au domaine sans dépendance externe. Un générateur seraît
  une dépendance disproportionnée pour cette grammaire.
- Recherche sur les libs de dés RPG (npm) : **non retenu**. Le projet a déjà `server/src/lib/diceParser.js`
  (`parseDice`), utilisé partout en combat (`.claude/rules/dice.md` : autorité serveur, graine,
  reproductibilité). Introduire une 2ᵉ lib de dés dupliquerait une responsabilité déjà couverte (§7
  CLAUDE.md) — le DSL doit produire des formules que `parseDice` sait déjà lire, pas réimplémenter le
  lancer de dés.

**Constat technique important trouvé en relisant `diceParser.js` (pas une supposition — le code
fait foi)** : `parseDice` n'accepte qu'**un seul type de dé** par formule (regex
`^(\d+)?d(\d+)([+-]\d+)?$` — `NdX+M`, un seul `X`). Impossible de lui donner une formule composite du
type `3D10+1D10+4` (base arme + ajout munition, deux types de dés). Conséquence directe sur la
conception du Lot A ci-dessous : `ADD` ne peut pas être résolu par concaténation de chaînes, il doit
être résolu par **deux appels `parseDice` séparés, sommés côté serveur** (formule de base + formule
ajoutée). Vérifié en parallèle : les jets de dégâts émettent toujours `isCriticalSuccess:false` en dur
(aucun site de code trouvé conditionnant un critique sur `dieType` pour un jet de dégâts) — la règle
"critique valable seulement sur un jet à un seul type de dé" (`diceParser.js:14-16`) ne concerne que
le jet de touche, pas le dégât. Additionner deux jets de types différents pour le dégât est donc sûr.

---

## 2. Découpage en lots (validation Saar entre chaque lot, comme les chantiers précédents)

### Lot A — Parseur DSL + branchement DMG (cœur du chantier) — ✅ CODÉ ET TESTÉ (2026-07-16)

**Objectif** : charger une munition différente change réellement les dégâts. C'est le seul point qui
débloque la plainte réelle ("la munition n'a aucun effet").

**Livré** : `shared/weaponAmmoDsl.js` (NOUVEAU — `parseAmmoEffects`, registre `DMG_ACTIONS`,
`resolveDmgEffect`), `server/src/lib/damageService.js` (`getEffectiveWeaponDamage`, point de
résolution unique), rebranchement de `resolveAssaultAction` (PNJ immédiat) et de
`COMBAT_DAMAGE_CONFIRM` (PJ différé) — détail exact ci-dessous, conservé tel qu'écrit avant code.

**Écart découvert en codant, par rapport au plan initial** `[VÉRIFIÉ]` : `server/src/lib/diceParser.js`
(`parseDice`) n'accepte qu'**un seul type de dé par formule** (regex `^(\d+)?d(\d+)([+-]\d+)?$`) —
impossible de lui donner une formule composite `3D10+1D10+4`. Conséquence : le dégât effectif ne
peut **jamais** être précalculé en une chaîne unique à la Déclaration (Phase 1) pour le cas `ADD` — il
doit être résolu **au moment du jet réel**. Pour la branche PJ (stockage `combat_pending` puis
`COMBAT_DAMAGE_CONFIRM` différé), le payload stocke désormais `weaponInvId` (au lieu de ne compter
que sur `formula`, conservé uniquement pour l'aperçu non engageant `COMBAT_DAMAGE_PROMPT` et pour la
branche `melee`, hors scope) — `getEffectiveWeaponDamage` est rappelé côté serveur à la confirmation,
jamais fait confiance à une valeur calculée à la Déclaration. Cohérent avec `.claude/rules/combat.md`
("recalculer... depuis la position/l'état réellement atteint").

**Sites confirmés par lecture complète du code (pas par grep seul)** :
- ✅ Rebranchés : `resolveAssaultAction` (branche PNJ, `socketCombatHelpers.js`) et
  `COMBAT_DAMAGE_CONFIRM` (branche non-melee, `socketCombatResolution.js`) — les deux seuls chemins
  humanoïdes à munitions (PJ/PNJ, tir à distance).
- ❌ Confirmés hors scope, non touchés : `resolveMeleeAction` (CaC — `weapon.ref_damage_h`/arme
  naturelle, jamais de `current_ammo`), `resolveDroneAssaultAction` (armement drone —
  `drone_weapons`/`effective_formula`, système entièrement séparé de `char_inventory`), la branche
  melee de `COMBAT_DAMAGE_CONFIRM`, `resolveReloadAction` (écrit `current_ammo`, ne le consomme pas).

**Testé** :
- Parseur pur : 8 scénarios ciblés (`BASE`/`SET`/`ADD` simple/`MUL`/`ADD` avec scaling non supporté/
  DSL malformé/clé inconnue/`ammo_effects` null) — tous passés.
- Parseur rejoué sur les 26 chaînes DSL réelles uniques du catalogue (`ref_equipment.ammo_effects` en
  base locale, 101 lignes non-null confirmées peuplées) — **0 crash**, y compris sur une variante de
  syntaxe non documentée (`ARMOR=`/`FX=` en clauses top-niveau au lieu de `TXT=ARMOR=...|FX=...`),
  correctement absorbée dans `unknown`.
- Scénario réel en base (transaction annulée, 0 résidu vérifié après coup) : arme "Cougar" (`4D10`,
  calibre 7.62 mm) — sans munition → `4D10` (36 constaté) ; munition standard (`DMG=BASE`) → `4D10`
  identique (non-régression confirmée) ; munition SLAP (`DMG=SET(3D10+5)`) → `3D10+5` (24 constaté,
  dans la plage attendue [8,35]), `tags: {PEN:'SET(18)', FX:'SLAP'}` correctement exposés pour Lot C.
- `node --check` : 0 erreur sur les 4 fichiers touchés/créés.

**Non testé** : parcours navigateur réel (déclaration → résolution d'un tir avec munition chargée en
conditions de jeu), round-trip complet via de vrais événements Socket.IO (le test a appelé
`getEffectiveWeaponDamage` directement contre la vraie base, pas via le transport WS complet) — à
confirmer par Saar en navigateur avant clôture définitive.

**Correctifs post-livraison (2026-07-16, suite à l'analyse à charge round 2)** :
- **`MUL(0)` silencieusement corrompu en `×1`** — `Number(value) || 1` : `Number("0")` vaut `0`,
  falsy en JS, donc l'opérateur `||` retombait sur `1` au lieu de `0`. Une munition hypothétique
  `DMG=MUL(0)` (dégât annulé) aurait silencieusement infligé le dégât normal de l'arme au lieu de
  zéro. Aucune donnée réelle actuelle n'utilise `MUL(0)` (seul `MUL(0.5)` observé), donc pas
  déclenché en pratique, mais c'était un vrai défaut latent, non couvert par les tests initiaux (qui
  ne testaient que `MUL(0.5)`). Corrigé (`Number.isFinite(n) ? n : 1`) + 2 nouveaux scénarios de test
  (`MUL(0)` → `mulFactor:0` réel, `MUL(valeur non numérique)` → repli `1` sans `NaN`).

**Correctifs post-livraison (2026-07-16, suite à l'analyse à charge demandée par Saar)** :
- **Garde null manquante** — `getEffectiveWeaponDamage` peut renvoyer `null` (arme désequipée/
  transférée entre la Déclaration et `COMBAT_DAMAGE_CONFIRM`, fenêtre réelle côté PJ différé) ; ni
  `resolveAssaultAction` ni `COMBAT_DAMAGE_CONFIRM` ne vérifiaient ce cas avant `.total`/`.rolls` —
  échec muet (le `combat_pending` est supprimé et la FSM déjà repassée à `SLOT_ACTIVE` avant le bloc
  concerné, donc aucune fenêtre de dégâts n'apparaissait, sans erreur visible). Corrigé : repli sur
  `parseDice(weapon.ref_damage_h)` côté PNJ (fenêtre quasi nulle), repli sur la `formula` stockée à la
  Déclaration côté PJ différé (meilleure donnée disponible), log `console.warn` dans les deux cas.
  Testé en base réelle (`weaponInvId` invalide → `null` proprement renvoyé, pas de throw).
- **Aperçu `COMBAT_DAMAGE_PROMPT` incohérent** — affichait `weapon.ref_damage_h` brut avant le jet,
  différent du jet réel dès qu'une munition modifiait les dégâts (ex. montrait "4D10", le jet réel
  donnait "3D10+5"). Nouvelle fonction `getEffectiveWeaponFormulaPreview` (aucun `parseDice`, pure
  lecture + résolution DSL, pas de jet gaspillé pour un simple affichage) branchée sur le prompt PJ.
  Testé en base réelle : aperçu = "3D10+5" avec munition SLAP chargée, sans lancer de dé.

- **Nouveau `shared/weaponAmmoDsl.js`** (pur, sans DB — même convention que
  `shared/naturalWeapons.js`/`shared/combatExclusiveActions.js`, style du fichier existant confirmé
  par lecture : fonctions pures exportées, pas de classes, commentaires qui expliquent le "pourquoi").
  - **Tokenizer** : split top-niveau sur `;` → paires `CLE=RESTE` ; regex ciblée par clé pour extraire
    `ACTION(VALEUR)` ou le littéral `BASE`. Choix justifié en §1bis (grammaire plate, pas besoin d'un
    générateur de parseur).
  - **Registre de handlers par action** — inspiré du pattern "dispatch par clé" de PF2e (§1bis),
    exprimé dans l'idiome Enclume existant (objet littéral de fonctions pures, pas de classes — même
    forme que les tables `STATE_DEFS`/matrices de coût déjà en place ailleurs dans le combat) :
    ```js
    // Code réellement livré (shared/weaponAmmoDsl.js) — le registre résout uniquement l'action ;
    // resolveDmgEffect() fusionne ensuite avec weaponFormula (overrideFormula ?? weaponFormula).
    const DMG_ACTIONS = {
      BASE: ()      => ({ overrideFormula: null,  extraFormula: null,  mulFactor: 1 }),
      SET:  (value) => ({ overrideFormula: value, extraFormula: null,  mulFactor: 1 }),
      ADD:  (value) => ({ overrideFormula: null,  extraFormula: value, mulFactor: 1 }),
      MUL:  (value) => ({ overrideFormula: null,  extraFormula: null,  mulFactor: Number(value) || 1 }),
    }
    ```
    Ajouter une action plus tard (si jamais rencontrée) = ajouter une entrée, jamais toucher au
    dispatcher ni aux appelants — c'est le bénéfice concret du pattern, pas une abstraction gratuite :
    Lot C en aura besoin pour `PEN=`/`ARMOR=` si ces tags migrent un jour du texte vers une vraie
    mécanique.
  - `parseAmmoEffects(raw)` → `{ dmg: {action, value}|null, choc: {...}|null, tags: {...}, unknown: [] }`.
  - Fail-safe explicite (déjà annoncé par le ROADMAP d'origine) : clé/action inconnue → poussée dans
    `unknown`, jamais un throw. L'appelant serveur logue (`console.warn`) et retombe sur `DMG_ACTIONS.BASE`.
  - `resolveEffectiveDamage({ weaponFormula, ammoEffects })` → `{ baseFormula, extraFormula, mulFactor }`
    via `DMG_ACTIONS`. Résolution du total (côté serveur, pas dans `shared/`, car appelle `parseDice`
    qui utilise `crypto.randomInt`) : `total = round((await parseDice(baseFormula)).total +
    (extraFormula ? (await parseDice(extraFormula)).total : 0)) * mulFactor`. `MUL` s'applique donc
    toujours en dernier, sur la somme déjà obtenue — jamais sur une formule.
  - `ADD` **avec** scaling (`+1/5D10_ARME`) explicitement **hors scope Lot A** : nécessite de parser
    la formule de l'arme elle-même pour compter ses dés, ambigu sans exemple validé par Saar → traité
    comme `unknown`, log + ignoré proprement (repli sur `weaponFormula` seul, pas de blocage de tir).

- **Un seul point de résolution serveur**, réutilisé par tous les appelants (pas de 2ᵉ copie) :
  nouvelle fonction dans `server/src/lib/damageService.js` (ou nouveau fichier
  `server/src/lib/weaponDamageService.js` si la taille le justifie) : `getEffectiveWeaponDamage(db,
  weaponInvId)` → fetch `char_inventory` (+ `current_ammo`) + `ref_equipment` (arme) + `ref_equipment`
  (munition) en une passe, appelle `resolveEffectiveDamage`, retourne `{ total, rolls, tags }` prêt à
  remplacer `degautsBruts`.

- **Sites à rebrancher** (audit par grep `weapon.ref_damage_h`/`weapon.damage_h`/`ref_damage_h`,
  liste de départ à reconfirmer précisément en codant — plusieurs sont peut-être du code mort ou des
  branches PNJ/drone à exclure) :
  - `server/src/socket/socketCombatHelpers.js` ~1308-1333 (fetch arme, requête à étendre avec
    `char_inventory.current_ammo`), ~1552-1557 (résolution PNJ immédiate).
  - `server/src/socket/socketCombatHelpers.js` ~734-739 / ~787-793 / ~1165-1168 / ~1197-1200 — à
    vérifier laquelle concerne une arme à munitions (tir) vs CaC (jamais de munition, `ref_damage_h`
    reste tel quel) avant de toucher quoi que ce soit.
  - `server/src/socket/socketCombatResolution.js` ~351-359, ~638-655 (chemin de résolution différée
    côté PJ, `combat_pending`).
  - `server/src/routes/battlemaps.js` `/combat-equipment` — uniquement si la Phase 1 (Déclaration)
    doit prévisualiser le dégât effectif ; **prévisualisation client non engageante seulement**, le
    serveur reste la seule autorité en Phase 2 (`.claude/rules/combat.md`).

- **Migration** : aucune migration de schéma nécessaire (colonne déjà présente). Vérifier en base
  réelle (pas seulement dans le fichier d'extraction historique) que `ammo_effects` est bien peuplé
  avant de coder — sinon c'est un import de données à part, distinct de ce Lot.

- **Non-régression obligatoire** : arme sans munition chargée (`current_ammo IS NULL`) → comportement
  actuel inchangé (formule brute de l'arme). Armes CaC (jamais de munition) → chemin non touché.

### Lot B — CHOC (dégâts de Choc) — ferme la dette `[CHOC1]` (`docs/EN_COURS.md` item 67)

**Confirmé par Saar (2026-07-16)** — deux types de dégâts distincts et non convertibles l'un dans
l'autre :
1. **Blessures standards** → touchent les seuils de blessure par localisation (`character_wounds`,
   pipeline déjà livré Étapes 1/1b/3).
2. **Blessures de Choc** → ne créent **aucune blessure enregistrée** ; elles provoquent directement un
   Test d'Étourdissement/Inconscience contre les seuils déjà existants (attributs secondaires
   `seuil_etourdissement`/`seuil_inconscience`, `calcSeuils` dans `shared/polarisUtils.js`).

Ce que ça confirme dans le code déjà en place `[VÉRIFIÉ]` : `statusService.resolveShockTest` est déjà
**générique** — il prend `finalSeverity`/`localisation`/`is_lethal` en paramètres et ne dépend
d'aucune ligne `character_wounds` réellement stockée (`damageService.js` l'appelle après
`woundService.applyWound`, mais rien dans sa signature ne l'exige). Il est donc directement
réutilisable pour le Choc **à condition de lui fournir un équivalent de `finalSeverity`** dérivé du
total de dégâts de Choc plutôt que d'une blessure physique.

**Pièce manquante déjà à moitié câblée, trouvée en relisant le code** `[VÉRIFIÉ]` :
`charStats.calcResistanceArmure(equippedItems)` calcule déjà **`etq` ET `prt`** (mille-feuille de
`ref_protection` et `ref_protection_shock`), mais `damageService.resolveTargetHit:50` ne
destructure que `etq` — `prt` est calculé puis jeté. C'est exactement la valeur d'armure-choc dont ce
Lot a besoin (symétrique de `etq` pour le dégât physique).

**Mécanique sourcée `[VÉRIFIÉ]`** — texte intégral trouvé dans `docs/Character/Statuts/
REGLESTATUT.txt:90-121` ("Dommages étourdissants et assommants", p.243 du LdB, référencé depuis
`docs/REGLES/REGLESYSCOMBAT.md:1193` mais transcrit dans ce fichier-là, pas dans `REGLES/`). Procédure
exacte, citée :

1. Jet des dégâts physiques de l'arme → comparé **comme d'habitude** aux seuils de blessure (pipeline
   `resolveTargetHit` existant, **inchangé**, `etq` + RD + table 5/10/15/20/25/30) → blessure notée
   normalement.
2. Jet séparé des "Dommages additionnels de Choc" de l'arme, réduit par **deux résistances
   indépendantes**, symétriques du pipeline physique :
   - `prt` (`ref_equipment.protection_shock`, mille-feuille déjà calculé par `calcResistanceArmure`,
     actuellement jeté dans `damageService.js:50`) — **confirmé par Saar (2026-07-16)** : l'armure
     Choc ne bloque que le Choc, exactement comme l'armure standard (`etq`) ne bloque que le physique
     — deux pipelines de réduction parallèles, jamais mélangés.
   - RD (`calcResistanceDommages`) — **"la Résistance aux blessures du personnage s'applique"** (texte
     LdB) = RD s'applique aussi au Choc, avec la même fonction que pour le physique.
   - `chocDegatsNets = Math.max(0, chocDegatsBruts - prt + rd)`, miroir exact de
     `degatsNets = Math.max(0, degautsBruts - etq + rd)` (`damageService.js:63`).
3. `chocDegatsNets` (après `prt` et RD) est **ajouté au total de dégâts physiques déjà obtenu** (pas
   un pool comparé isolément) — nouveau total = `degatsNetsPhysique + chocDegatsNets`.
4. Ce total combiné est comparé **à la même table de sévérité que les blessures physiques**
   (5/10/15/20/25/30, `damageService.js:66-72` réutilisée telle quelle) — uniquement pour déterminer
   le palier qui pilote `getShockMalus`/`resolveShockTest` (déjà génériques, cf. ci-dessus).
   **Aucune blessure n'est créée par cette comparaison** — "Les Dommages de Choc ne sont que virtuels,
   ils ne causent pas de blessures physiques mais augmentent la Difficulté du Test de Choc."
5. **Restriction de localisation** : pour une arme "normale" (dégât physique principal + Choc
   additionnel — c'est le cas de la Balle assommante, `DMG=SET(1D6+2);CHOC=SET(...)`), le Choc
   additionnel **ne s'applique que si le coup touche la Tête** (`localisation === 'tete'`, réutilise
   le résultat du jet de localisation D20 déjà fait à l'étape 1 de `resolveTargetHit`). Pour une arme
   qui **ne cause que du Choc** (ex. arme électrique), aucune restriction de localisation — **mais ce
   cas est hors scope de ce Lot** (voir correction ci-dessous).

**Confirmé par Saar (2026-07-16)** : la restriction Tête n'est pas un bug de design — la pièce
manquante est **l'action "Tir visé sur localisation" (`COM9`, `docs/BUGIDENTIFIE.md`), jamais codée
et oubliée du `docs/ROADMAP.md` avant aujourd'hui (ajoutée)**. Avec cette action, un joueur équipé
d'une munition assommante peut viser délibérément la Tête (malus LdB Tête+Bras −7) pour déclencher le
Choc de façon fiable ; sans elle, le déclenchement reste soumis au hasard du D20 de localisation — ce
qui est acceptable pour livrer le Lot B, mais rend la fonctionnalité peu exploitable tant que COM9
n'est pas codé. Pas un blocage pour ce Lot, mais une dépendance de gameplay à garder en tête.

**Correction (point 2 de l'analyse à charge, confirmée)** : le cas "arme qui ne cause que du Choc"
(armes électriques) **n'est pas couvert par ce Lot**, ni par aucun Lot de ce plan. Ces armes portent
leur Choc sur `ref_equipment.shock` (colonne propre à l'ARME, déjà fetchée en `ref_shock` dans
`WeaponPanel.jsx` mais jamais consommée en résolution de combat) — un mécanisme entièrement distinct
du DSL `ammo_effects` (qui ne s'applique qu'aux munitions, cf. §0). Explicitement hors scope, pas une
dette silencieuse : à documenter comme un Lot séparé futur si Saar le souhaite, pas construit ici.

**Correction (point 3, confirmé par Saar)** : "la Résistance aux blessures du personnage" = **RD
(Résistance aux Dommages)**, confirmé — l'Attribut Secondaire déjà branché (`calcResistanceDommages`).
Plus une hypothèse, `[VÉRIFIÉ]`.

Le point `protection_shock`/`prt` reste tranché par la confirmation Saar du point 2 précédent (session
antérieure) : `prt` réduit le Choc, jamais le physique.

**Trous trouvés à l'analyse à charge round 2 (avant tout code Lot B) :**

- **Risque de double Test de Choc, non traité par la conception ci-dessus.** L'étape 1 (pipeline
  physique existant, inchangé) déclenche déjà `resolveShockTest` **de façon autonome** si le dégât
  physique **seul** atteint Grave(tête/corps)/Critique/Mortelle (`isShockTestRequired`, code actuel).
  L'étape 4 (nouveau, Lot B) déclenche un **second** `resolveShockTest` sur le total combiné
  physique+Choc. Avec les données réelles actuelles (`DMG=SET(1D6+2)`, 3 à 8 points), le physique seul
  n'atteint jamais ce seuil — donc pas de doublon observable aujourd'hui — mais l'architecture telle
  que décrite ci-dessus ne l'empêche pas structurellement : une future munition avec un `DMG` plus
  costaud **et** un `CHOC` déclencherait deux Tests de Choc pour un seul coup. **Invariant à ajouter
  avant de coder** : quand la munition chargée porte un `choc` (et que la restriction de localisation
  du point 5 s'applique), le Test de Choc de l'étape 1 doit être **sauté**, remplacé exclusivement par
  celui de l'étape 4 — un seul Test de Choc par coup, jamais deux.
- **Branche "arme pure Choc, pas de restriction tête" du point 5 : code mort dans le scope réel de ce
  Lot.** Vérifié en base réelle (pas seulement le fichier d'extraction) : sur les 101 lignes
  `ammo_effects` non-null / 25 valeurs uniques, les **5** qui portent un `CHOC=` portent **toutes**
  aussi un `DMG=SET(...)`/`DMG=ADD(...)` non-`BASE` — aucune munition avec `CHOC` et sans dégât
  physique propre n'existe dans les données actuelles. Combiné à la correction de scope ci-dessus
  (armes à Choc intrinsèque hors DSL munitions), la restriction "Tête uniquement" **s'applique donc
  toujours, sans exception, dans le scope réel de ce Lot** — la branche "sans restriction" n'a pas
  besoin d'exister dans le code, éviter de la construire pour un cas qui ne peut pas se produire ici.
- **`CHOC=ADD(...)` avec scaling (`+1/5D10_ARME`) non traité.** 2 des 5 valeurs `CHOC=` réelles sont
  `CHOC=ADD(1D10,+1/5D10_ARME)` (munitions explosives) — même ambiguïté de scaling que `DMG=ADD` en
  Lot A, jamais résolue. **Même traitement à prévoir** : détection par virgule dans la valeur → hors
  scope, repli (ici, pas de Choc additionnel plutôt qu'un blocage), pas une hypothèse à inventer au
  moment de coder.

**Le Lot B est spécifié et prêt à coder**, sous réserve du scope corrigé (munitions uniquement) et des
3 points ci-dessus à intégrer à la conception avant d'écrire le code (pas des blocages nécessitant
Saar — des précisions d'implémentation déjà tranchées par les données et les invariants existants).

### Lot B — ✅ CODÉ ET TESTÉ, CORRECTIF APPLIQUÉ (2026-07-16/17)

**Livré**, conforme à la conception verrouillée ci-dessous, avec un seul écart délibéré documenté :

- `shared/weaponAmmoDsl.js` : `resolveChocFormula(chocDsl, rangeBand)` + `RANGE_BAND_TO_CHOC_CODE`.
- `server/src/lib/damageService.js` : `getEffectiveWeaponDamage` expose désormais `choc: parsed.choc`
  (repli catch inclus). `resolveTargetHit` étendu avec `chocDsl`/`rangeBand` (défaut `null`), extrait
  `prt` de `calcResistanceArmure` (déjà calculé, aucune nouvelle query), nouvelle étape 3bis
  (`chocDegatsNets`), sévérité extraite dans `_severityForDamage(net)` (appelée pour le physique et,
  si Choc applicable, pour le total combiné), étape 5 restructurée en `if/else if` strictement
  mutuellement exclusif (Choc combiné **remplace** le test natif, jamais les deux). Retour étendu avec
  `prt` et `chocDegatsNets`.
- **Écart assumé par rapport à la conception initiale** : la conception prévoyait d'importer
  `isShockTestRequired` dans `damageService.js` pour pré-filtrer avant d'appeler `resolveShockTest`
  côté Choc. Code livré : appel direct à `statusService.resolveShockTest(...)` sans pré-check, comme le
  fait déjà la branche physique existante (inchangée) — `resolveShockTest` fait déjà ce gate en interne
  (`statusService.js:44`, `if (!isShockTestRequired(...)) return null`). Éviter la duplication de cette
  autorité (CLAUDE.md §1.4 "une propriété métier possède une autorité unique") plutôt que suivre le
  pseudo-code littéralement — comportement fonctionnellement identique, un import et une branche de
  moins.
- `server/src/socket/socketCombatHelpers.js:1593` (PNJ) et `server/src/socket/socketCombatResolution.js:423`
  (PJ différé) rebranchés avec `chocDsl`/`rangeBand`. Cas de repli `effectiveDamage null` (PJ) :
  `effectiveChocDsl` reste `null`, jamais reconstruit depuis une donnée partielle. `resolveMeleeAction`
  (2 sites) et `resolveDroneAssaultAction` (1 site) non touchés — paramètres optionnels par défaut.

**Testé** :
- Purs (`resolveChocFormula`, 6 scénarios) : table BP/C/M/L/E de la Balle assommante, aucun `choc` DSL,
  `rangeBand` inconnu/absent, `CHOC=ADD(...)` avec scaling (hors scope, doit rester `null`, pas de
  résolution partielle), `chocDsl` null, table malformée sans `:`.
- Non-régression parseur Lot A (10 scénarios) : rejoués sans modification, toujours 10/10.
- Réel en base (transaction annulée, résidu vérifié nul après coup — `current_ammo` retrouvé inchangé) :
  munition réelle "7.65 mm - Munition assommante" (`DMG=SET(1D6+2);CHOC=SET(BP:5D10,C:4D10,M:3D10,L:2D10,E:1D10)`)
  chargée sur une arme réelle en inventaire (Scorpion 3D10) :
  - Gate localisation : sur 40 tirs, Choc appliqué **uniquement** quand `localisation === 'tete'`,
    jamais en dehors (0 fuite constatée).
  - Décroissance par bande de portée : `chocDegatsNets` observé 24-25 à bout portant vs 2-9 à extrême
    (échantillon, RD/prt réels du personnage inclus) — cohérent avec la table 5D10→1D10.
  - Non-régression : arme sans munition Choc chargée → `chocDegatsNets` toujours `null`, même en tête
    (15 tirs, 0 fuite).
  - **Dommages virtuels confirmés** : cas observé `degatsNets` physique = 4 (`severity: null`, aucune
    blessure), `chocDegatsNets` = 31, `shockResult` non-null (Test de Choc déclenché par le total
    combiné) — compte `character_wounds` avant/après identique (5/5) : le Choc déclenche bien un Test
    sans jamais créer de blessure physique, conforme au texte LdB ("Les Dommages de Choc ne sont que
    virtuels").
  - `node --check` : 0 erreur sur les 4 fichiers touchés (`weaponAmmoDsl.js`, `damageService.js`,
    `socketCombatHelpers.js`, `socketCombatResolution.js`).

**Non testé** : parcours navigateur réel (déclaration → confirmation d'un tir en tête avec munition
assommante en conditions de jeu), round-trip Socket.IO complet (le test a appelé `resolveTargetHit`
directement contre la vraie base avec un `io` stub, pas via le transport WS complet), scénario
anti-double-Test-de-Choc observé en base réelle spécifiquement (garanti par construction du code —
`if/else if` mutuellement exclusif — mais pas exercé par un test dédié qui espionne le nombre d'appels
à `resolveShockTest`) — à confirmer par Saar en navigateur avant clôture définitive du Chantier.

#### Bug trouvé après livraison (2026-07-16) — mauvaise règle appliquée à la mauvaise donnée — ✅ corrigé

**Confirmé par Saar, `[VÉRIFIÉ]`** contre `docs/Character/Statuts/REGLESTATUT.txt:90-121` (LdB p.243) et
`docs/REGLES/REGLESMUNITIONS.md` : ces deux textes décrivent **deux mécaniques distinctes**, jamais
mentionné comme tel avant la conception de Lot B (voir `docs/VOCABULARY.md` "Dommages de Choc" pour la
définition officielle, 3 catégories) :

1. **Arme normale à `shock`** (lourde/contondante, `ref_equipment.shock`) — Choc **uniquement sur coup
   en Tête**, en plus du dégât physique. C'est la règle p.243 "arme normale".
2. **Arme à Choc pur** (électrique, `ref_equipment.shock`) — aucun dégât physique, Choc partout, aucun
   gate de localisation. Toujours p.243, "arme qui ne cause que du Choc".
3. **Munition spéciale** (Assommante/Explosive, `ammo_effects` DSL `CHOC=`) — Choc partout, **aucun
   gate de localisation**, valeurs fixes. C'est `REGLESMUNITIONS.md`, un texte séparé qui ne mentionne
   aucune restriction de Tête.

**Lot B, tel que codé, a implémenté la catégorie 3 (DSL munitions) avec le gate de localisation de la
catégorie 1** (règle p.243, "arme normale") — erreur de conception confirmée par Saar. La table par
bande de portée (5D10 bout portant → 1D10 extrême) utilisée par le code livré **n'existe dans aucun des
deux textes sources** ; elle provenait de la colonne `description` du catalogue (`ref_equipment`),
laquelle s'est révélée porter plusieurs formules inventées lors du peuplement (Shrapnel, HP, Explosive,
IEM — voir §Lot C ci-dessous) — cinquième cas du même type, pas une exception.

**Correction requise (non codée à ce stade)** :
- Retirer la restriction `localisation === 'tete'` du chemin munition (`resolveTargetHit`, étape 3bis).
- Remplacer `resolveChocFormula` (table par bande de portée) par les valeurs fixes de
  `REGLESMUNITIONS.md` : Assommante `+1D10+2`, Explosive `+1D10` (+ dégât physique `+1D10`, armure
  cible `×2` — relève en fait du sous-lot C1 "modification d'armure", voir plus bas — donc Explosive
  ne sera vraiment complet qu'une fois C1 câblé).
- La catégorie 1/2 (`ref_equipment.shock`, armes) reste un chantier séparé, non commencé — c'est elle
  qui fermera vraiment `[CHOC1]` (bonus Corne, catégorie 1) une fois construite. Le Lot B corrigé ne
  fermera que la partie munition de la dette, comme documenté dans `docs/EN_COURS.md`.
- Tests déjà écrits (scénarios purs + réel en base) à refaire : le gate localisation et la table de
  portée testés ne seront plus les bons comportements après correction.

#### Correctif Lot B — Conception verrouillée (2026-07-16, run à vide + analyse à charge, confirmée par Saar : "Oui c'est ça")

**Erreur corrigée en route** : une première version de cette conception (severité Choc indépendante,
"le pire des deux") s'est révélée fausse à l'analyse à charge — avec les vraies plages de dés
(Assommante Choc 3-12, jamais ≥15 "Grave"), un Choc jamais combiné au physique ne déclencherait
quasiment jamais de Test de Choc, ce qui viderait la munition de son intérêt. Saar a confirmé revenir à
la procédure p.243 littérale (jet physique + jet Choc **additionnés**, un seul total comparé une seule
fois), avec une seule différence par rapport à p.243 : le Choc n'est pas réduit par `prt`/RD avant
d'être additionné (`REGLESMUNITIONS.md` ne mentionne aucune réduction pour les munitions).

**Procédure verrouillée** :
1. **Dégât physique** : pipeline inchangé (`etq` + `rd` → `degatsNets`, blessure appliquée normalement
   via `woundService.applyWound`, `finalSeverity` post-promotion **utilisée uniquement pour la
   blessure**, jamais pour le Choc).
2. **Dégât Choc** : `chocTotal = (await parseDice(chocDsl.value)).total`, **brut, aucune réduction**
   (ni `etq`/`prt`, ni `rd`).
3. **Total combiné** (uniquement pour piloter le Test de Choc, jamais la blessure) :
   `combined = degatsNets + chocTotal` — nombres bruts, pas les sévérités.
4. **Une seule sévérité** pour le Choc : `_severityForDamage(combined)` (fonction déjà codée, table
   5/10/15/20/25/30 réutilisée telle quelle).
5. **Un seul `resolveShockTest`** : si `chocTotal !== null` → utilise la sévérité du total combiné
   (étape 4) ; sinon → comportement natif inchangé (sévérité post-promotion du physique seul, comme
   aujourd'hui). Jamais les deux appels pour un même coup.
6. **Gate de localisation** : supprimé côté munition — s'applique quelle que soit la localisation
   touchée (catégorie 3, aucune restriction dans `REGLESMUNITIONS.md`).
7. **`is_lethal`** : dérivé du total combiné comme aujourd'hui pour le physique seul — aucun changement
   de `resolveShockTest`/`getShockMalus` (code existant, testé, hors périmètre de ce correctif). Une
   éventuelle règle "on épargne le Test de Choc si `is_lethal`" reste une amélioration séparée, non
   traitée ici.
8. **`resolveChocFormula`** : simplifié — n'a plus besoin de `rangeBand` ni de table BP/C/M/L/E, lit
   directement `chocDsl.value` quand `action === 'SET'`.
9. **Donnée catalogue** : les 8 lignes "Munition assommante" (`ammo_effects`) corrigées de
   `CHOC=SET(BP:5D10,C:4D10,M:3D10,L:2D10,E:1D10)` vers `CHOC=SET(1D10+2)`. Explosive laissé de côté
   pour l'instant (son DSL réel utilise `ADD` avec scaling `_ARME` pour DMG et CHOC, plus son armure
   `×2` qui attend C1 — correction groupée avec C1, pas ici, pour ne pas laisser une munition
   à moitié corrigée).

Pseudo-code (`resolveTargetHit`, étapes 3bis/4/5) :
```js
// 3bis — Choc, brut, aucun gate de localisation
let chocTotal = null
if (chocDsl?.action === 'SET') {
  try { chocTotal = (await parseDice(chocDsl.value.replace(/\s/g, ''))).total }
  catch (err) { console.warn(...) }
}

// 4 — sévérité physique inchangée (pilote la blessure, jamais le Choc)
const { severity, is_lethal } = _severityForDamage(degatsNets)

// 5 — blessure (physique seul, inchangé) + Test de Choc unique
...woundService.applyWound comme aujourd'hui → finalSeverity post-promotion...
let shockResult = null
if (chocTotal !== null) {
  const { severity: combinedSeverity, is_lethal: combinedIsLethal } = _severityForDamage(degatsNets + chocTotal)
  shockResult = await statusService.resolveShockTest({ finalSeverity: combinedSeverity, localisation, is_lethal: combinedIsLethal, ... })
} else if (woundResult) {
  shockResult = await statusService.resolveShockTest({ finalSeverity, localisation, is_lethal, ... })
}
```

**✅ Codé et testé (2026-07-17)** :
- `shared/weaponAmmoDsl.js` : `resolveChocFormula(chocDsl)` simplifié (formule fixe, plus de table de
  portée/`RANGE_BAND_TO_CHOC_CODE`, plus de paramètre `rangeBand`).
- `server/src/lib/damageService.js` : `resolveTargetHit` — gate `localisation === 'tete'` retiré,
  extraction `prt` retirée (plus consommée), `chocTotal` brut (aucune réduction), total combiné
  `degatsNets + chocTotal` piloté par `_severityForDamage`, un seul `resolveShockTest` (combiné si
  Choc présent, natif sinon). Retour : `chocDegatsNets` renommé `chocTotal` (plus honnête — n'est plus
  "net" puisque non réduit), `prt` retiré du retour (inutilisé).
- `socketCombatHelpers.js`/`socketCombatResolution.js` : `rangeBand`/`portee` ne sont plus transmis à
  `resolveTargetHit` (paramètre supprimé, plus nécessaire).
- **Migration `160_fix_ref_equipment_choc_assommante.js`** (appliquée) : corrige `ammo_effects`
  (`CHOC=SET(BP:...)` → `CHOC=SET(1D10+2)`) et `description` sur les 12 munitions Assommante réelles
  du catalogue (10 calibres + 2 Darts). **2 items exclus** (`Darts 7.62mm ST - Projectile SAP`,
  `Flèche - Projectile IEM`) — même DSL par erreur de copié-collé mais description totalement
  différente, nouveau bug documenté `docs/BUGIDENTIFIE.md` COM26, pas corrigé ici (hors scope).

**Testé** :
- Purs (`resolveChocFormula` v2, 5 scénarios) : formule fixe, aucun choc, `chocDsl` null, `CHOC=ADD`
  hors scope, valeur vide.
- Non-régression Lot A (10/10).
- Réel en base (transaction annulée, migration 160 vérifiée appliquée puis rollback testé séparément
  sans résidu) : munition "7.65 mm - Munition assommante" corrigée (`CHOC=SET(1D10+2)` confirmé) sur
  une arme réelle en inventaire —
  - Choc appliqué **quelle que soit la localisation** (constaté en tête ET hors tête, gate bien retiré).
  - `chocTotal` toujours dans `[3,12]` (plage réelle de `1D10+2`), jamais réduit.
  - Non-régression sans munition Choc : `chocTotal` toujours `null` (15 tirs, 0 fuite).
  - **Scénario clé** : `degatsNets=4` (aucune blessure seule, `severity: null`) + `chocTotal=12` →
    total combiné 16 → `resolveShockTest` déclenché (`isShockTestRequired` faux pour le physique seul,
    vrai pour le combiné) — confirme que le Choc peut déclencher un Test que le physique seul n'aurait
    jamais déclenché, et qu'aucune `character_wounds` n'est créée par cette combinaison (delta wounds
    = uniquement ce que le physique seul aurait produit).
  - `node --check` : 0 erreur sur les 5 fichiers touchés (`weaponAmmoDsl.js`, `damageService.js`,
    `socketCombatHelpers.js`, `socketCombatResolution.js`, migration `160`).

**Non testé** : parcours navigateur réel (déclaration → confirmation d'un tir avec munition assommante
en conditions de jeu), round-trip Socket.IO complet — à confirmer par Saar en navigateur.

**Données** : migration `160` appliquée en base réelle (12 lignes `ref_equipment` corrigées, vérifiée
par requête directe après application). Bug de données séparé trouvé et documenté (`COM26`), pas
corrigé (hors scope).

### Lot B — Conception finale verrouillée (2026-07-16, avant code — zéro zone d'ombre restante)

Spécifiée jusqu'au niveau fonction pour qu'une session future (même après un compact) puisse coder
sans redécider quoi que ce soit. Vérifié contre le code réel de `damageService.js` ligne par ligne.

**1. `shared/weaponAmmoDsl.js` — nouvel export `resolveChocFormula(chocDsl, rangeBand)`** (pure) :
- N'implémente **que** le cas `CHOC=SET(BAND:FORMULE,...)` — 100% des données réelles "propres"
  (2 munitions ASSOMMANTE). `CHOC=ADD(...)` (2 munitions EXPLOSIVE, toujours avec scaling
  `+1/5D10_ARME`) → **toujours hors scope Lot B, jamais partiellement traité** : `chocDsl.action !==
  'SET'` → retourne `null` (aucun Choc), pas de détection de virgule ambiguë (une virgule dans un
  `SET` de Choc est **normale**, elle sépare les entrées de la table de portée — contrairement au
  `DMG=ADD` de Lot A où une virgule signale un scaling. Ne pas réutiliser la même heuristique.)
- Table de correspondance nouvelle : `RANGE_BAND_TO_CHOC_CODE = { bout_portant:'BP', courte:'C',
  moyenne:'M', longue:'L', extreme:'E' }`.
- Parsing : split `value` sur `,` → chaque segment split sur `:` → `{ BP:'5D10', C:'4D10', ... }`.
  Retourne `map[RANGE_BAND_TO_CHOC_CODE[rangeBand]] ?? null`. Fail-safe : `rangeBand` inconnu, `value`
  malformée (pas de `:`) ou table vide → `null`, jamais un throw.

**2. `damageService.getEffectiveWeaponDamage` — étendre le retour, aucune nouvelle query :**
`parsed.choc` (déjà calculé par `parseAmmoEffects`, actuellement jeté) devient un champ du retour :
`{ total, rolls, formula, tags, choc: parsed.choc }`. Le Choc n'est **jamais roulé ici** — seule la
formule de dégât physique l'est. Raison : rouler le Choc nécessite de connaître `localisation`, connue
seulement **après** l'étape 1 de `resolveTargetHit` ; le rouler ici gaspillerait un jet pour des coups
qui ne touchent pas la Tête (hygiène : ne jamais lancer un dé qui ne sera pas utilisé, `.claude/rules/dice.md`).

**3. `damageService.resolveTargetHit` — signature étendue, 2 nouveaux paramètres optionnels :**
`chocDsl = null` et `rangeBand = null` (les 2 callers concernés les passent ; `resolveMeleeAction` et
les branches drone ne les passent jamais → comportement strictement inchangé pour eux, `if (chocDsl
&& ...)` reste faux).

Modifications internes, dans l'ordre exact :
- **Étape 2 (armures)** — actuellement `etq = calcResistanceArmure(armuresSlot).etq` (jette `prt`).
  Devient `const { etq, prt } = calcResistanceArmure(armuresSlot)` — **aucune nouvelle query**,
  `ref_protection_shock` est déjà sélectionné dans le SELECT existant (`damageService.js:106`).
- **Nouvelle étape 3bis, après le calcul de `degatsNets` physique (étape 3), avant l'étape 4** :
  ```js
  let chocDegatsNets = null
  if (chocDsl && localisation === 'tete') {
    const chocFormula = resolveChocFormula(chocDsl, rangeBand)
    if (chocFormula) {
      try {
        const chocRoll = await parseDice(chocFormula.replace(/\s/g, ''))
        chocDegatsNets = Math.max(0, chocRoll.total - (prt ?? 0) + rd)
      } catch (err) {
        console.warn(`[damageService] resolveTargetHit — formule Choc invalide (${err.message}), Choc ignoré`)
      }
    }
  }
  ```
  `rd` déjà calculé à l'étape 3 (même valeur, aucune 2ᵉ résolution — RD est un attribut du
  personnage, indépendant du type de dégât).
- **Étape 4 (sévérité)** — extraire l'actuel `if/else` (5 branches, `damageService.js:130-135`) dans
  une fonction interne non exportée `_severityForDamage(net)` (même fichier, jamais dupliquée) qui
  retourne `{ severity, is_lethal }`. Appelée pour le physique (comme aujourd'hui, résultat inchangé)
  **et**, si `chocDegatsNets !== null`, une 2ᵉ fois sur `degatsNets + chocDegatsNets` →
  `{ severity: combinedSeverity, is_lethal: combinedIsLethal }`. Les deux appels restent
  **indépendants** — `combinedSeverity` ne remplace jamais `severity` (qui continue seul à piloter la
  blessure, étape 5 inchangée).
- **Étape 5 (blessure + shock)** — `woundService.applyWound` **inchangé**, reçoit toujours `severity`
  (physique seul, jamais le combiné — une blessure physique ne doit jamais refléter un total gonflé
  par du Choc virtuel). Le choix du shock test change :
  ```js
  let shockResult = null
  if (chocDegatsNets !== null) {
    // Choc applicable (Tête + munition Choc) — remplace tout test natif, jamais les deux
    // (invariant §3, round 2 de l'analyse à charge : un seul Test de Choc par coup).
    const { severity: combinedSeverity, is_lethal: combinedIsLethal } = _severityForDamage(degatsNets + chocDegatsNets)
    if (combinedSeverity && isShockTestRequired(combinedSeverity, localisation)) {
      shockResult = await statusService.resolveShockTest({
        finalSeverity: combinedSeverity, localisation, is_lethal: combinedIsLethal,
        for_na: for_na_cible, con_na: con_na_cible, vol_na: vol_na_cible,
        mod_mutation_shock:  getMutationModForResistance(mutationEffectsCible, 'shock'),
        mod_advantage_shock: getAdvantageModForResistance(advantagesCible, 'shock'),
      })
    }
  } else if (woundResult) {
    // Comportement actuel, strictement inchangé.
    finalSeverity = woundResult.finalSeverity
    shockResult   = await statusService.resolveShockTest({ finalSeverity, localisation, is_lethal, ...})
  }
  ```
  `isShockTestRequired` — **vérifié `[VÉRIFIÉ]`** : `damageService.js` ne l'importe pas actuellement
  (seuls `statusService.js`/`woundUtils.js` l'utilisent) ; ajouter
  `import { isShockTestRequired } from './woundUtils.js'` en tête de fichier (même dossier). Si le
  total combiné ne franchit
  même pas le seuil qui exige un test (rare mais possible à portée extrême, ex. 1D10 Choc + petit
  physique), aucun test n'est déclenché — cohérent avec le texte LdB.
- **Retour de `resolveTargetHit`** : ajouter `chocDegatsNets` (peut être `null`) à l'objet retourné,
  pour que l'appelant puisse l'exposer dans `COMBAT_ATTACK_RESULT`/`COMBAT_DAMAGE_RESULT` (affichage —
  Lot C ou finition ultérieure, pas structurant pour ce Lot).

**4. Callers (`resolveAssaultAction` PNJ + `COMBAT_DAMAGE_CONFIRM` PJ, les 2 mêmes sites que Lot A,
vérifiés par grep — `socketCombatHelpers.js:1593` et `socketCombatResolution.js:423` — sur les 5
appels totaux à `resolveTargetHit` du projet) :** passer `effectiveDamage.choc` et
`authoritativeRangeBand`/`portee` (déjà en scope dans les deux fonctions, aucune nouvelle donnée à
fetcher) aux 2 nouveaux paramètres de `resolveTargetHit`. `resolveMeleeAction` (CaC, 2 sites) et
`resolveDroneAssaultAction` (armement drone, 1 site) : **non touchés**, n'appellent pas
`getEffectiveWeaponDamage` donc n'ont pas de `choc` à transmettre — comportement strictement inchangé,
vérifié par construction (paramètres optionnels par défaut `null`). **Cas du repli `effectiveDamage
null`** (garde ajoutée en correctif Lot A, §Correctifs post-livraison) : le repli sur `formula` stockée
n'a pas de `.choc` disponible → passer `chocDsl: null` dans ce cas, jamais tenter de reconstruire un
Choc depuis une donnée partielle.

**5. Migration : toujours aucune** (même conclusion que Lot A — tout est déjà en base).

**Aucune décision restante.** Tout point encore ouvert à ce stade serait un point à découvrir en
codant (implémentation), pas une question de conception.

### Lot C — Effets mécaniques réels des tags qualitatifs (remplace l'ancien Lot C "affichage seul")

**Recadrage (2026-07-16)** : l'ancien Lot C ("juste afficher les tags, aucune mécanique") est abandonné.
Saar souhaite coder les effets réels autant que possible. Recherche menée le même jour : croisement de
`docs/REGLES/REGLESMUNITIONS.md` (extrait LdB, **source de vérité confirmée par Saar**) contre les 25
valeurs DSL uniques réellement présentes en catalogue (101 lignes `ref_equipment.family='Munitions'`)
et la colonne `description` de chaque item (déjà établie comme source la plus précise — voir §0 —
donne souvent une formule à l'échelle des dés de l'arme là où `REGLESMUNITIONS.md` résume en valeur
fixe générique ; les deux ne se contredisent pas dans ce cas, l'item est juste plus précis).

**Méthode imposée par Saar : pas à pas, un sous-lot à la fois, tout noté ici avant de coder.** Pas de
lot combiné, pas de code avant que le sous-lot en cours soit entièrement tranché.

**Correction de méthode (2026-07-16)** — la colonne `description`/`ammo_effects` du catalogue s'est
révélée peu fiable comme source de règle exacte : **5 cas confirmés** de formule inventée ou erronée
pendant cette seule session (Shrapnel — armure inversée ; HP, Explosive, IEM — mise à l'échelle `_ARME`
introuvable dans le LdB ; Assommante — gate de localisation + table de portée empruntés à la mauvaise
règle, voir §Lot B ci-dessus). **Décision : à partir de maintenant, `docs/REGLES/REGLESMUNITIONS.md`
est la seule source de règle pour le Lot C, la donnée catalogue est ignorée sauf pour les valeurs déjà
vérifiées cohérentes** (ex. `PEN=SET(n)` d'APHC/SAP/SLAP, correctement alignées une fois retraduites —
voir tableau ci-dessous).

**Confirmé hors scope définitivement** : obus anti-armures (uranium appauvri, canon d'assaut) —
**zéro munition seedée dans le catalogue, confirmé par Saar intentionnel** ("inutile actuellement, il
faut implanter exo-armure et navire pour les rendre utilisables"). Pas une dette, un vrai hors-scope
tant que ces deux systèmes n'existent pas.

#### Traduction complète de `REGLESMUNITIONS.md` (2026-07-16, source unique)

Notation : `degautsBruts` = jet brut, `etq`/`prt` = armure physique/Choc déjà calculées
(`calcResistanceArmure`), `rd` = Résistance aux Dommages (déjà ajoutée), `degatsNets = max(0,
degautsBruts - etq + rd)` = pipeline existant, inchangé sauf mention contraire.

| Munition | Dégâts | Armure cible | Autre effet |
|---|---|---|---|
| **Expansives (HP)** | `+5` fixe | `× 1.5` (arrondi inférieur) | — |
| **Assommantes** | `1D6+2` (déjà codé) | inchangée | Choc `+1D10+2` fixe, **aucun gate de localisation** (catégorie 3, `docs/VOCABULARY.md`) |
| **Explosives** | `+1D10` | `× 2` | Choc `+1D10` (nouveau jet), aucun gate de localisation mentionné |
| **IEM** | `× 0.5` (déjà codé) | inchangée | Test de panne, malus **-3** fixe, "équipements électroniques" |
| **Perforantes (APHC)** | inchangés | `× 2/3` (arrondi inférieur, "réduite d'un tiers") | — |
| **Perforantes à sabot (SAP/SLAP)** | **-1 dé** sur la formule de l'arme (4D10→3D10) | `× 0.5` (arrondi inférieur) | — |
| **Shrapnel** | bout portant inchangé, courte/moyenne `-1D10`, longue `-2D10`, extrême `-3D10` | `× 1.5` (`polarisRound`, voir D) | Zone cône 3m, multi-cibles |
| Uranium légère / obus canon d'assaut | — | — | **Hors scope confirmé** (exo-armure/navire non construits) |

**Décisions verrouillées par Saar (2026-07-16), les 3 points restés ouverts après la première
traduction** :
- **A. Ordre bonus/armure** `[VÉRIFIÉ]` : le bonus de dégât fixe (+5 HP, +1D10 Explosive) fait partie
  du jet brut, donc soumis à l'armure durcie — pas un ajout garanti après coup. Formule verrouillée :
  `degatsNets = max(0, (degautsBruts + bonus) - etq_effectif + rd)`. Cohérent avec le pattern déjà en
  place pour `rd` (ajouté dans le même `max()`) et avec la logique munition "soft target" (HP est
  justement mauvais contre une cible blindée).
- **B. Choc Assommante/Explosive = catégorie 3** `[VÉRIFIÉ]`, voir `docs/VOCABULARY.md` "Dommages de
  Choc" : aucun gate de localisation, valeurs fixes de `REGLESMUNITIONS.md`. Ferme le bug du §Lot B
  ci-dessus.
- **C. SAP/SLAP nécessite une transformation de formule** `[VÉRIFIÉ]`, confirmé morceau à part : lire
  `weapon_formula` (`NdX+M`), décrémenter `N` de 1, garder `X`/`M` inchangés — pas une opération sur un
  nombre, sur la formule elle-même. Nouvelle fonction pure à prévoir dans `shared/weaponAmmoDsl.js` ou
  `diceParser.js`.
- **D. Arrondi** `[VÉRIFIÉ]` : Perforantes/SAP/SLAP/HP/uranium ont un "arrondissez à l'inférieur"
  **explicite** dans le texte → `Math.floor()` pur, littéral. Shrapnel n'a aucune mention d'arrondi →
  Saar tranche : règle d'arrondi Polaris standard du projet, soit `polarisRound(x) = Math.floor(x +
  0.4)` (`shared/polarisUtils.js:2-4`, déjà utilisée pour le mille-feuille d'armure) — **différente**
  d'un floor pur au-delà de `x.5` (arrondit vers le haut à partir de `x.6`), ne pas confondre les deux
  formules en codant.

**Correction Choc, run à vide du 2026-07-16** `[VÉRIFIÉ]` : le Choc de munition (Assommante/Explosive)
**n'est réduit ni par `prt` ni par `rd`** — la mention "la Résistance aux blessures s'applique" venait
du texte p.243 (catégorie 1/2, armes), pas de `REGLESMUNITIONS.md`. Le Test de Choc est **indépendant**
du physique ("pur") : sévérité dérivée du Choc brut seul via `_severityForDamage` (déjà codé, table
5/10/15/20/25/30), jamais combinée au total physique. Un seul `resolveShockTest` par coup — le pire des
deux sévérités (physique post-promotion vs Choc pur) si les deux sont non-nulles. Détail complet et
pseudo-code : §"Correctif Lot B — Conception verrouillée" ci-dessus. `prt` reste donc sans usage réel
pour l'instant (l'hypothèse initiale du plan — `prt` réduit le Choc — est invalidée).

**Reste ouvert avant de coder quoi que ce soit** : `PEN=BASE` (Perforantes standards catalogue, sans
valeur chiffrée) — probablement neutre (`PEN=0`, dégâts et armure inchangés, cohérent avec "Les
Dommages sont normaux" + aucune mention de réduction pour la version "de base"), à confirmer en codant.

**Découpage en 3 sous-lots** (C1/C2/C3 — Saar n'a pas de préférence de priorité, mais impose l'ordre
séquentiel une fois choisi, un seul à la fois) :

#### Lot C1 — Modification d'armure (Perforantes/SAP/SLAP/HP/Explosive/Shrapnel) — ✅ CODÉ (2026-07-19)

Un seul point d'insertion technique (`etq`/`prt` dans `resolveTargetHit`, déjà étendu par Lot B) pour
6 munitions : `× 2/3` (APHC), `× 0.5` (SAP/SLAP, + transformation formule dégâts), `× 1.5` (HP, +
dégâts durs à l'armure), `× 2` (Explosive), `× 1.5` (Shrapnel — mais Shrapnel a aussi la zone d'effet,
donc son armure peut être câblée ici même si le ciblage de zone (C3) attend). Toutes les valeurs sont
désormais des **multiplicateurs** (`× fraction`), jamais un `PEN=` flat — la règle "1 point de
Pénétration = 1 point d'armure" du message précédent est **remplacée** par cette traduction directe de
`REGLESMUNITIONS.md`, plus fidèle. `PEN=BASE`/`PEN=SET(n)` du catalogue ne sont plus la source
numérique — seule la fraction du tableau ci-dessus l'est.

**Recherche menée avant conception (demande explicite Saar : documentation + inspiration pros avant
tout code)** : rule element `DamageDice` de PF2e/Foundry (déjà cité §1bis) — son objet `override`
(`diceNumber`/`dieSize`/`downgrade`) modifie un jet par une **transformation calculée**, jamais une
valeur pré-écrite par objet ; confirme que "-1 dé" (SAP/SLAP) doit être calculé depuis la formule
réelle de l'arme, pas lu depuis une chaîne catalogue par munition×arme. Recherche design RPG général
(dégâts par calibre + armor-piercing) confirme aussi que l'AP doit réduire l'armure de la cible plutôt
que gonfler le dé de dégât brut — valide la fraction déjà verrouillée ci-dessus plutôt qu'un flat.

**Écart découvert en codant `[VÉRIFIÉ]`** (relecture des vraies chaînes DSL du seed,
`STEP1_cleaned_data.js`, pas seulement le tableau LdB) : 3 des 6 familles ont un DSL catalogue
incompatible avec `REGLESMUNITIONS.md`, même famille de défaut que les 5 cas déjà confirmés fautifs
(dont Assommante/Choc, corrigé migration 160) :
- **HP** : `DMG=BASE;TXT=ARMOR=TARGET_PLUS(1+1/D10_ARME)|PASS=PLUS(2+1/D10_ARME)|FX=HP` — aucun bonus
  de dégât réel, `ARMOR=`/`PASS=` avec mise à l'échelle `_ARME` inventée.
- **EXPLOSIVE** : `DMG=ADD(1D10,+1/5D10_ARME)` — scaling, tombe dans le repli "hors scope" du Lot A
  (bonus ignoré silencieusement aujourd'hui, jamais +1D10 fixe).
- **SHRAPNEL** : `DMG_DROP=-1D10/RANGE` jamais parsé, `PEN=SET(5)` flat au lieu du `× 1.5` verrouillé.
- APHC/SAP/SLAP : `DMG=SET(...)` déjà littéral (pas de scaling), mais dépend d'une saisie manuelle
  correcte par arme — même fragilité de principe.

**Décision d'architecture (recherche + jugement technique, pas une question produit)** : plutôt que
corriger ces 3 familles par une nouvelle migration (qui devrait être répétée à chaque nouvelle
munition mal saisie — déjà arrivé 5 fois), le registre `AMMO_MECHANIC_ACTIONS`
(`shared/weaponAmmoDsl.js`) devient la **seule autorité** dès que `tags.FX` correspond à une des 6
familles — les clauses `DMG=`/`CHOC=`/`TXT=PEN=`/`ARMOR=`/`PASS=`/`DMG_DROP=` catalogue de ces lignes
deviennent cosmétiques, jamais lues pour le calcul. Une nouvelle munition SAP/HP/etc. ajoutée au
catalogue fonctionne automatiquement dès que `FX=` est posé, sans dépendre d'une valeur numérique
saisie à la main ni d'une migration de plus. Aucune migration de données nécessaire pour ce Lot.

**Codé** :
- `shared/weaponAmmoDsl.js` : `reduceDiceCount` (transformation pure `NdX+M` → `(N-1)dX+M`, jamais sous
  1 dé), `AMMO_MECHANIC_ACTIONS` (registre par FX), `resolveAmmoMechanic(fx)`, `resolveMechanicDamageFormula`.
- `server/src/lib/damageService.js` : `getEffectiveWeaponDamage`/`getEffectiveWeaponFormulaPreview`
  gagnent un paramètre `rangeBand` (uniquement pour la dégression Shrapnel — sans lien avec le Choc,
  qui n'en a plus besoin depuis le correctif Lot B) et dispatchent sur le registre quand `tags.FX` est
  connu, sinon comportement Lot A/B strictement inchangé. `resolveTargetHit` gagne `ammoFx` (défaut
  `null`) : armure de la cible multipliée par la fraction du registre (`Math.floor` ou `polarisRound`
  selon la famille), seulement si `etq` a pu être calculé.
- `server/src/socket/socketCombatHelpers.js` : les 2 sites déjà rebranchés Lot A/B (PNJ immédiat,
  PJ différé `COMBAT_DAMAGE_CONFIRM`) transmettent désormais `rangeBand`/`ammoFx` — `resolveMeleeAction`
  et les branches drone non touchés (paramètres optionnels, comportement inchangé par construction).

**Testé** : 16 scénarios purs (`shared/weaponAmmoDsl.test.mjs`, nouveau fichier — aucun test permanent
n'existait pour ce module avant cette session malgré les scénarios Lot A/B documentés plus haut) :
`reduceDiceCount` (décrément, plancher à 1 dé, formule mixte non reconnue inchangée), les 6 familles
`resolveAmmoMechanic`/`resolveMechanicDamageFormula` (APHC/SAP/SLAP/HP/EXPLOSIVE/SHRAPNEL par bande de
portée y compris bande inconnue), FX inconnu/absent → `null` (Assommante/IEM non affectés) ; suite
complète `shared/*.test.mjs` rejouée : 49/49, aucune régression (dual-wield, ammoRules, weaponSlots).
`node --check` propre sur les 3 fichiers touchés/créés.

**Non testé** : scénario réel en base (aucune connexion PostgreSQL disponible depuis cet
environnement — les scénarios "transaction annulée" des Lots précédents ont été exécutés ailleurs),
build Vite (aucun fichier client touché par ce Lot, scope strictement serveur/partagé), parcours
navigateur réel — **à la charge de Saar avant de considérer C1 clos**, notamment : vérifier que les
chaînes `FX=` réelles en base correspondent bien aux clés du registre (`APHC`/`SAP`/`SLAP`/`HP`/
`EXPLOSIVE`/`SHRAPNEL`, sensible à la casse), et qu'aucune variante orthographique inattendue n'existe
en base (le fichier d'extraction historique consulté peut différer de la base réellement seedée).

**Données** : aucune migration — décision explicite de ce Lot (voir ci-dessus), le registre code
contourne les valeurs catalogue plutôt que de les corriger.

**Hors scope de ce Lot (rappel)** : le ciblage de zone Shrapnel (cône 3m, multi-cibles) reste C3 ; le
dégât Shrapnel/l'armure calculés ici s'appliquent à la cible unique déjà gérée par `resolveTargetHit`,
sans boucle multi-cibles.

#### Lot C2 — Test de panne (munitions IEM)

Mi-dégâts (déjà codé `MUL(0.5)`) + malus **-3** fixe à un "Test de panne" sur "équipements
électroniques" — valeur maintenant confirmée par `REGLESMUNITIONS.md` (plus de mise à l'échelle
`_ARME`, c'était une invention catalogue). **Mécanique "Test de panne" elle-même inexistante dans le
code** (`grep` exhaustif, 0 résultat) : reste à savoir comment un Test de panne se résout (quel jet,
quel seuil, quel effet en cas d'échec) — Saar fournira ce complément le moment venu, pas nécessaire
tant que C1 n'est pas clos.

**Non commencé — bloqué sur C1 (ordre séquentiel) et sur la mécanique Test de panne elle-même.**

#### Lot C3 — Zone d'effet Shrapnel (cône 3m, multi-cibles)

Aucun ciblage de zone dans le pipeline combat actuel (cible unique partout). Le plus gros morceau des
3 — nouvelle UI de ciblage + nouvelle boucle serveur multi-cibles. L'armure Shrapnel (`× 1.5`) est
tranchée (tableau ci-dessus, confirmée par `REGLESMUNITIONS.md` — la donnée catalogue `PEN=SET(5)`
était fautive) ; ce qui reste réellement à concevoir pour C3 est uniquement le ciblage de zone et la
dégression de dégâts par portée, pas l'armure.

**Non commencé — bloqué sur C1 (ordre séquentiel).**

---

## 3. Invariants

- Le serveur reste la seule autorité de dégâts — un éventuel aperçu client en Phase 1 est non engageant
  (`.claude/rules/combat.md`).
- Un seul point de résolution (`getEffectiveWeaponDamage` ou équivalent), réutilisé par tous les
  sites identifiés au Lot A — jamais une 2ᵉ copie du parseur ou de la requête.
- Donnée de catalogue jamais mutée par la résolution (principe Active Effects, §1bis) : `ammo_effects`
  se relit et se re-parse à chaque résolution, rien n'est mis en cache en base.
- Fail-safe permanent : DSL malformé ou action/clé inconnue → log serveur + repli stats de base de
  l'arme, jamais une exception qui bloque un tour de combat.
- `shared/weaponAmmoDsl.js` reste pur (aucune query DB, aucun `parseDice` dedans — il retourne des
  formules, c'est l'appelant serveur qui les lance), testable en isolation.
- Nouvelle action DSL future (Lot C ou au-delà) = une entrée dans `DMG_ACTIONS` (ou son équivalent
  Choc), jamais une branche supplémentaire dans le dispatcher ou les appelants.
- Lot B (corrigé) : le Choc de munition n'est réduit **ni par `etq` ni par `prt` ni par `rd`** — brut,
  comparé tel quel. `prt`/`protection_shock` n'a, à ce stade, aucun usage réel dans le pipeline combat
  (invariant précédent invalidé par le run à vide du 2026-07-16, voir §Lot B correctif).
  Corollaire : la fraction "hors périmètre" du texte p.243 — armes qui causent leur Choc via
  `ref_equipment.shock` (catégories 1/2, `docs/VOCABULARY.md`) — est un chantier séparé, distinct de
  `ammo_effects`, et c'est probablement **elle** qui utilisera `prt` un jour.
- Lot B (corrigé) : un seul `resolveShockTest` par coup — si une munition Choc est chargée, la
  sévérité qui pilote le test vient du total combiné **brut** `degatsNets + chocTotal` (p.243, "Ajoutez
  ces Dommages additionnels au total de Dommages physiques obtenu précédemment"), jamais de deux
  sévérités séparées comparées entre elles. Sans munition Choc, comportement natif inchangé (sévérité
  physique post-promotion). Jamais deux Tests de Choc pour un seul coup. La blessure, elle, reste
  toujours basée sur `degatsNets` seul, jamais le total combiné.

## 4. Tests prévus

- **Lot A** : scénarios purs du parseur (`BASE`/`SET`/`ADD` simple/`MUL`/DSL malformé/action ou clé
  inconnue), scénario réel en base (même arme, deux munitions différentes chargées tour à tour → dégât
  constaté différent), non-régression arme sans munition chargée, non-régression armes CaC.
- **Lot B** : scénarios purs (résolution `chocDegatsNets` avec `prt`/RD, gate localisation tête),
  scénario réel en base "Balle assommante" bout portant vs extrême (dégât de Choc décroissant par
  bande de portée), scénario confirmant qu'aucune ligne `character_wounds` n'est créée par le Choc,
  scénario dédié anti-double-Test-de-Choc (dégât physique + Choc combinés franchissant un seuil →
  un seul `resolveShockTest` appelé, pas deux), scénario coup hors tête → aucun Choc appliqué.
- **Lot C** (tests à écrire une fois chaque sous-lot tranché, pas avant) : **C1** scénarios purs
  `etq_effectif = max(0, etq - PEN)`, non-régression munitions sans `PEN=`, scénario réel APHC/SAP/SLAP
  en base (armure réduite constatée, dégât inchangé) ; **C2** à définir une fois la règle LdB fournie ;
  **C3** à définir une fois le ciblage de zone conçu + la correction de données appliquée.

## 5. Hors périmètre de ce PLAN

- États santé / animations Test de Choc (Chantier 11 Étape 4 — chantier séparé, voir
  `docs/ROADMAP.md`).
- Accessoires d'arme (Silencieux, etc. — `mod_compat`, déjà noté hors scope dans `docs/Old/JARMES.md`).
- `damage_v_low`/`damage_v_high` (dégâts vs véhicules) — colonnes existantes séparées, hors sujet DSL
  munitions.
