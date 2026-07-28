# PLAN_RW_SYSCOMBAT.md — Découpage de `resolveMeleeAction` / `resolveAssaultAction`

> Créé : 2026-07-25 (dev/Saar). Statut : **planification uniquement, aucun code écrit.**
> Document temporaire (`docs/RegleDocumentaire.md` Règle 10) — à archiver dans `docs/Old/` une fois le
> chantier clos, contenu durable (nouvelle convention de fichier) transféré vers
> `docs/SYSTEME/COMBAT.md`.
> Responsabilité unique de ce document : planifier le découpage structurel de ces deux fonctions.
> Aucune règle de jeu n'est modifiée par ce plan — pas un sujet RAW, un sujet d'architecture serveur.

---

## 0. Cadrage — ce qui est vrai aujourd'hui

### 0.1 Le constat, déjà posé deux fois

- **Session 95-3** (`docs/BUGIDENTIFIE.md:192-220`, 2026-06-15) : `resolveMeleeAction` (~507 lignes) et
  `resolveAssaultAction` (~367 lignes) classées `🟡 TECH DEBT — non bloquant V1`. Découpage proposé
  (`resolveDamage.js`/`resolveMelee.js`) mais différé « sprint dédié post-V1 », sans point de
  re-décision fixé.
- **`docs/AUDIT.md` RC1/INFRA-1** (2026-07-25, renommé depuis `AUDIT_FABLE.md` — le modèle Fable n'est
  pas à l'origine de cet audit) : `[VÉRIFIÉ]` re-mesuré à `resolveMeleeAction`
  (`server/src/socket/socketCombatHelpers.js:1214-1844`, 631 lignes, 42 branches) et
  `resolveAssaultAction` (`socketCombatHelpers.js:2357-2874`, 518 lignes, 35 branches) — **grossi de
  25-40 % depuis 2026-06-15** (COM24 deux-armes CaC, drones, MR-table CHOC1 ajoutés inline). Sans point
  de re-décision fixé, la dette continue de s'aggraver à chaque feature combat.
- **Aucun test automatisé n'existe** sur ces deux fonctions (`server/src/**/*.test.mjs` : 13 fichiers,
  aucun sur le combat de résolution). Tout le filet de sécurité actuel est la relecture + le test en
  jeu réel par Saar.

### 0.2 Ce qui est déjà bien découpé — ne pas retoucher

- **Résolution de dégâts** : `damageService.resolveTargetHit` / `getEffectiveMeleeDamage` /
  `getEffectiveWeaponDamage` (`server/src/lib/damageService.js`) — déjà extrait lors du chantier CHOC1,
  point de résolution unique, appelé identiquement par les deux fonctions. **Hors périmètre total de ce
  plan.**
- **Branche drone (Tir)** : déjà sa propre fonction, `resolveDroneAssaultAction`
  (`socketCombatHelpers.js`, appelée ligne 2363 avant le guard `weapon_inv_id`). Précédent local direct
  pour la méthode d'extraction (Strangler Fig déjà pratiqué une fois dans ce même fichier).
- **Convention "descripteur de statut"** déjà en place pour les fonctions quasi-pures qui font de la
  lecture DB : `measureBattlemapTokenDistance` (retourne `{ status: 'ok' | ... }`) et `checkCombatLOS`
  (retourne `{ result: 'blocked' | 'intercepted' | 'ok' }`). **Ce plan réutilise cette convention**,
  jamais un nouveau type `Result<T,E>` importé d'ailleurs (voir §1.3).

### 0.3 La règle déjà écrite dans ce projet — jamais appliquée à ces deux fonctions

`server/src/lib/charStats.js:1-9` et `docs/SYSTEME/COMBAT.md:74` (§"Fonctions charStats.js") énoncent
la même règle en toutes lettres, **déjà en vigueur, déjà documentée comme `SYSTEM`** (autorité
supérieure à ce `PLAN`, `CLAUDE.md` §1 hiérarchie documentaire) :

> « Fonctions PURES — aucun accès DB. Toutes les données sont passées en paramètre. Le caller […] est
> responsable des requêtes DB. »

`resolveMeleeAction`/`resolveAssaultAction` appellent déjà `calcSkillTotal`, `calcAttributeNA`,
`calcWoundPenalty`, `calcEncumbrancePenalty`, `getModDom` (tous purs, `charStats.js`) — puis
**retombent** dans le même bloc en mélangeant lecture DB, arithmétique de Seuil et construction du
`breakdown` d'affichage. Ce plan ne propose donc pas un nouveau paradigme : il propose d'étendre une
règle déjà écrite et déjà respectée ailleurs dans ce même fichier, aux deux endroits qui y échappent
encore.

### 0.4 Duplication client/serveur — elle existe, sur les tables, pas sur la somme `[VÉRIFIÉ]`

> **Correctif de la version précédente de ce plan**, qui affirmait « aucune duplication client » après
> avoir vérifié la mauvaise chose (la somme du Seuil, effectivement non recalculée côté client) en
> ratant les **tables de modificateurs**, bel et bien dupliquées :

- `CombatCacModifiersWindow.jsx:12-30` recopie les valeurs de `SITUATION_MODS` (cac_attaquant_cote -3,
  etc.) et de `TAILLE_MODS` (8 paliers, -10 à +15) du serveur (`socketCombatHelpers.js:37-49`) ;
- `CombatModifiersWindow.jsx:59-66` recopie la table taille une **troisième** fois (Tir), et calcule un
  sous-total de préveiw des modificateurs (L.204-205).

Le précédent interne existe déjà : les mods situation **Tir** ont été déplacés vers
`shared/combatSituationMods.js` en Session 166 (TIRIMP) exactement pour cette raison — le commentaire
serveur (`socketCombatHelpers.js:34-36`) dit « autorité unique client+serveur, plus de duplication ».
Les tables CaC et taille sont simplement restées en arrière. Conséquence pour ce plan : **les tables de
valeurs vont dans `shared/`** (mêmes modalités que `combatSituationMods.js`), sinon le nouveau fichier
serveur cimenterait une violation `CLAUDE.md` §7 déjà vivante. La *somme* du Seuil, elle, reste
serveur-only (`server/src/lib/`) — le client ne la recalcule pas, il attend `DICE_RESULT`, conforme à
`.claude/rules/combat.md` (« client prévisualise et envoie une intention »). Les labels restent par
côté : clés i18n côté client (`cacModifiers.tailles.*`, déjà en place), labels FR côté serveur (dette
i18n distincte, voir §5).

### 0.5 Prérequis d'ordonnancement — le worktree est sale sur le fichier cible `[VÉRIFIÉ 2026-07-25]`

`git diff` montre ~44 lignes non committées dans `socketCombatHelpers.js` : travail Session 176
(SURPRISE1 — codé, **non testé en jeu** selon `docs/EN_COURS.md` ; COM24 — dont le bloc `deuxArmesBonus`
qui appartient au segment visé par ce plan), plus des modifications client associées
(`CombatActionWindow.jsx`, `MeleeCombatPanel.jsx`, `combatSections.js`, `combat.json`...). Toutes les
références de lignes de ce plan décrivent **l'état non committé**.

**Aucun lot de ce plan ne démarre tant que le travail Session 176 n'est pas validé en jeu par Saar et
committé** (ou explicitement mis de côté par décision de Saar). Sinon : deux chantiers mélangés dans un
même diff (violation « commit isolé », §3), revert impropre, et collision de reprise si la validation
SURPRISE1/COM24 échoue.

---

## 1. Recherche — patterns étudiés

### 1.1 Functional Core, Imperative Shell — le nom académique de la règle §0.3

Pattern documenté (Gary Bernhardt, 2012) : tout le code à effet de bord (DB, réseau, I/O) migre vers la
« coquille » externe ; le « noyau » interne ne contient que des fonctions pures. La coquille lit les
données brutes, extrait des valeurs, les passe au noyau, puis applique les effets de bord sur le
résultat retourné. Confirmation indépendante que la convention déjà écrite dans `charStats.js` est une
pratique reconnue, pas une lubie locale.
Sources : [functional-architecture.org](https://functional-architecture.org/functional_core_imperative_shell/),
[Kenneth Lange — The Functional Core, Imperative Shell Pattern](https://kennethlange.com/functional-core-imperative-shell/),
[sleepyfox/fcis (kata GitHub)](https://github.com/sleepyfox/fcis).

### 1.2 Command / Strategy pattern (Game Programming Patterns, Bob Nystrom)

Pertinent pour le **branchement défenseur** (PNJ auto-résolution / drone / PJ suspendu) — chaque
branche pourrait devenir une stratégie interchangeable plutôt qu'un `if/else if` empilé. **Pas retenu
pour ce plan** (Lot 1 ne touche pas ce branchement, voir §3) — noté ici pour instruire un futur Lot 2,
pas pour trancher aujourd'hui une décision qui ne concerne pas encore le périmètre travaillé.
Source : [Game Programming Patterns — Command](https://gameprogrammingpatterns.com/command.html).

### 1.3 Railway-Oriented Programming (Result/Either) — étudié et écarté

ROP formalise le chemin d'erreur comme une seconde "voie" (`Result<Success, Failure>`), généralement via
une petite lib (`@railway-ts/pipelines` ou équivalent fp-ts). **Écarté pour ce projet** :
- Le projet n'a aucune dépendance FP existante et n'utilise que du JS (pas TypeScript) — importer un
  type `Result` générique serait un paradigme étranger pour un problème déjà résolu localement (§0.2,
  convention `{ status }`/`{ result }` déjà en place et déjà comprise par tout le fichier).
- Same critique que l'article [« Against Railway-Oriented Programming »](https://fsharpforfunandprofit.com/posts/against-railway-oriented-programming/)
  (F# for Fun and Profit, l'auteur qui a *inventé* le terme ROP) : le pattern brille pour des chaînes de
  validation homogènes, pas pour un flux métier avec des branches asymétriques (PJ/PNJ/drone,
  sans-défense, etc.) — imposer une chaîne `bind` uniforme ici ajouterait de l'indirection sans réduire
  la complexité réelle.
- Décision : continuer la convention descripteur `{ ok: false, code, message }` /
  `{ ok: true, ...data }` déjà implicite dans `measureBattlemapTokenDistance`/`checkCombatLOS`, en
  objets simples, sans nouvelle dépendance.

### 1.4 Foundry VTT (dnd5e) — observation, pas transposable telle quelle

Le workflow d'attaque de `dnd5e` découpe le jet en étapes avec hooks (`preRollAttack`,
`rollAttack`, `preCreateChatMessage`...) pour permettre aux modules tiers de s'y greffer. Architecture
à hooks non pertinente ici (Enclume n'a pas de système de plugins tiers) — mais confirme, dans un projet
mature et largement utilisé, que découper "résolution du jet" en étape isolée du reste de
l'orchestration est une pratique éprouvée, pas une sur-ingénierie du plan présent.
Source : modules `dnd5e` étudiés indirectement via [crash-rolls-5e](https://github.com/crash1115/crash-rolls-5e),
[Multiattack-5e](https://github.com/jessev14/Multiattack-5e).

### 1.5 Foundry VTT (pf2e) — le pattern retenu : liste de contributions (« modifier list »)

**La référence directe du domaine**, trouvée en cherchant comment les systèmes VTT professionnels
structurent exactement ce calcul : [foundryvtt/pf2e `src/module/actor/modifiers.ts`](https://github.com/foundryvtt/pf2e/blob/master/src/module/actor/modifiers.ts)
(système communautaire majeur, activement maintenu). Un `StatisticModifier` porte une **liste** d'objets
modificateurs `{ label, modifier, type, enabled }` ; le total est la somme de la liste ; le détail
affiché au joueur *est* la liste. Ajouter un modificateur au jeu = ajouter un élément à la liste,
jamais toucher à la fonction de somme.

Transposition ici : Enclume possède **déjà** cette structure de données — le `breakdown`
(`{ label, value, type }`) émis dans `DICE_RESULT`. Aujourd'hui c'est un sous-produit d'affichage
reconstruit à la main par 24 spread-conditionnels ; le pattern pf2e consiste à le promouvoir en **source
de vérité** : la coquille assemble la liste de contributions, le noyau la somme et la filtre. C'est la
décision structurante du §2.1 — voir là-bas pourquoi elle remplace la signature à ~19 paramètres scalaires
de la version précédente de ce plan.

### 2.1 Architecture retenue — liste de contributions (§1.5) + tables de valeurs dans `shared/`

> **Remplace la version précédente de ce plan** (deux fonctions à ~19 paramètres scalaires chacune),
> abandonnée après critique : chaque futur modificateur — le type de feature combat le plus fréquent de
> l'historique (bouclier, DEF5, deux-armes, tir visé, sans-défense, CHOC1...) — aurait modifié la
> signature en 3 endroits (appel coquille, noyau, tests), et le risque d'erreur de câblage (passer
> `multiMalusDefenseur` pour `multiMalusAttaquant`, coexistants dans le même scope) restait entier.

**a) Tables de valeurs → `shared/`.** **Trois** tables serveur (`socketCombatHelpers.js:31-49`) sont
dupliquées côté client (inventaire complet vérifié au run à vide, §7) : `SITUATION_MODS` (CaC),
`TAILLE_MODS` (utilisée par CaC + Tir + drone, recopiée 2× côté client) et `PORTEE_MOD_COMP` (recopiée
dans `CombatModifiersWindow.jsx:24`). Elles rejoignent le précédent Session 166 en **étendant
`shared/combatSituationMods.js`** (même responsabilité — modificateurs situationnels de combat — pas de
nouveau fichier ; en-tête à mettre à jour, il dit aujourd'hui « Combat à Distance ») : exports
`CAC_SITUATION_MODS`, `TAILLE_MODS`, `PORTEE_MOD_COMP`, structure `{ mod }` alignée sur
`RANGED_SITUATION_MODS`. `cac_terrain_instable` y figure comme `{ mod: 0, limitative: true }` — même
pattern « prédicat séparé de la valeur numérique » que `impossible: true`, documenté dans l'en-tête du
fichier lui-même (le serveur le pré-filtre déjà avant la somme, `mod: 0` le rend doublement inoffensif).
Consommateurs à basculer : serveur (`resolveMeleeAction`, `resolveAssaultAction`,
`resolveDroneAssaultAction` — L.2111/2133 aussi, relevé au run à vide) et client
(`CombatCacModifiersWindow.jsx`, `CombatModifiersWindow.jsx`) qui suppriment leurs copies locales mais
gardent leurs structures de présentation (ordre d'affichage, groupes, clés i18n) en référençant les clés.
Les labels ne bougent pas : clés i18n côté client (déjà en place), labels FR côté serveur (dette i18n
séparée, §5). Une correction de valeur (errata LdB) redevient un seul edit.

**b) Noyau pur — une seule fonction, `server/src/lib/combatAttackRoll.js`.** Placement : même dossier
que `charStats.js` (`[HYPOTHÈSE]` de convenance, pas convention ferme — `mrTable.js` y vit tout en
interrogeant la DB ; le voisinage avec `charStats.js`, dont la pureté est documentée règle
`docs/SYSTEME/COMBAT.md:74`, reste le meilleur argument). En-tête strict : « Fonction PURE — aucun accès
DB, aucune I/O (pas de `console.log`), aucun appel non déterministe. Toutes les données sont passées en
paramètre, y compris le jet de dé déjà effectué. »

```js
// server/src/lib/combatAttackRoll.js
// contributions : [{ label, value, type }] — assemblées par la coquille, ordre = ordre d'affichage.
// Le noyau ne connaît ni la DB, ni les events WS, ni le texte des labels : tous transmis par la
// coquille (skillLabel/totalLabel compris), il ne fait que sommer, filtrer et assembler.
export function computeAttackRoll({ skillLabel, skillTotal, contributions, totalLabel, rollAttaque }) {
  const kept = contributions.filter(c => c.value !== 0)
  const seuil = skillTotal + kept.reduce((sum, c) => sum + c.value, 0)
  return {
    seuil,                                     // = chancesAttaque (CaC) / chancesDeReussite (Tir)
    breakdown: [
      { label: skillLabel, value: skillTotal, type: 'base' },
      ...kept,
      { label: totalLabel, value: seuil, type: 'total' },   // 'Seuil' aujourd'hui, fourni par la coquille
    ],
    isSuccess: rollAttaque <= seuil,
    mr: seuil - rollAttaque,
  }
}
```

Propriétés de cette forme :
- **Une** fonction sert CaC et Tir — ils ne diffèrent que par les contributions que la coquille
  assemble (CaC agrège ses mods situation en une entrée, le Tir les détaille par clé : préservé à
  l'identique puisque la coquille décide de la granularité des contributions).
- Nouveau modificateur = une ligne dans la coquille, zéro changement de signature ni de tests noyau.
- L'erreur de câblage label/valeur disparaît par construction — ils voyagent dans le même objet.
- Le motif `...(x !== 0 ? [...] : [])` répété 24 fois disparaît — le filtre `value !== 0` est écrit une
  fois, dans le noyau (c'était le « helper partagé » de la version précédente ; il est devenu
  l'architecture elle-même).
- L'ordre du `breakdown` = l'ordre du littéral de contributions dans la coquille — explicite, relisible,
  et vérifiable par test.

**c) Le jet de dé reste en coquille.** `parseDice` (`server/src/lib/diceParser.js:1,22-51`) utilise
`crypto.randomInt` sans graine fournissable — l'appeler dans le noyau le rendrait non déterministe et
les tests §2.2 exigeraient de mocker `crypto`. La coquille lance le dé (comme aujourd'hui) et passe
`rollAttaque` en paramètre ; `attackRolls`/`attackSeed` ne traversent même pas (seule l'émission
`DICE_RESULT`, construite en coquille, en a besoin). Cohérent avec `.claude/rules/dice.md` (« le jet »
= responsabilité serveur distincte du calcul).

**d) Ce qui reste en coquille, inchangé dans ce Lot** — tout ce qui lit la DB ou émet : résolution
arme/arme naturelle, validation distance/portée/LOS, `Promise.all` de fetch, `computeMultiAttackMalus`,
résolution deux-armes, terrain instable/Acrobatie (requêtes conditionnelles), branchement défenseur
PNJ/drone/PJ, `combat_pending`, `setFSMSubPhase`, `broadcastCurrentSubPhase`, construction des payloads
WS, logs `[DBG]` (juste après l'appel au noyau, avec les valeurs retournées). La coquille assemble le
littéral `contributions` à partir de ces valeurs déjà résolues — c'est le seul code nouveau côté
coquille. Ce littéral n'est pas couvert par les tests unitaires du noyau : c'est précisément ce que la
vérification shadow-mode (§2.3) couvre pendant la transition.

Les plages de lignes exactes (état **post-commit Session 176**, voir §0.5) seront relevées au moment de
coder — les références actuelles bougeront au commit du travail en cours, les figer ici serait trompeur.

### 2.2 Nouveau fichier de test — `server/src/lib/combatAttackRoll.test.mjs`

Premier filet automatisé jamais posé sur ce calcul — rendu possible parce que le noyau est déterministe
(jet en paramètre, aucun mock). Avec la forme « liste de contributions », les tests couvrent **une fois**
la mécanique commune CaC/Tir : somme (contributions positives/négatives/mixtes), filtre des
contributions à zéro (absentes du `breakdown`, comptées pour 0 dans la somme), **ordre** des entrées
(`base` en tête, contributions dans l'ordre fourni, `total` en queue — le client affiche dans l'ordre
reçu, une somme correcte mais réordonnée casserait l'UI sans qu'un test de somme le voie), bornes
`isSuccess`/`mr` (`rollAttaque` égal, juste au-dessus, juste en dessous du Seuil), et `rollAttaque: 1`/
`rollAttaque: 20` (données des critiques, construits en coquille), et contributions **se compensant**
(deux entrées non nulles de somme nulle : le noyau les conserve toutes les deux — le masquage agrégé
éventuel est une responsabilité d'assemblage en coquille, voir RV2 §7). S'y ajoutent des cas
« réalistes » : une liste de contributions reproduisant un jet CaC complet observé en jeu et un jet Tir
complet, valeurs attendues calculées à la main depuis le LdB.

**Commande de lancement — précision absente de la version précédente** : `server/package.json` n'a
**aucun script `test`** (seulement `start`/`dev`) ; les 13 `.test.mjs` existants se lancent à la main.
Ce Lot fait pareil — `node --test server/src/lib/combatAttackRoll.test.mjs` — et n'ajoute **pas** de
script npm (élargissement de scope, à proposer séparément si souhaité, pas à glisser dans ce chantier).

### 2.3 Vérification au point de câblage — mode « Scientist » avant de retirer le code inline

Les tests noyau ne couvrent pas l'assemblage du littéral `contributions` en coquille (§2.1.d). La forme
« liste de contributions » élimine par construction la pire classe d'erreur de câblage (label/valeur
dépareillés), mais pas une valeur oubliée ou dupliquée dans le littéral. Ce projet n'a aucun test
d'intégration sur ces fonctions ; par la définition de Michael Feathers (*Working Effectively with
Legacy Code*), c'est du code legacy malgré son développement actif. Le pattern
[Scientist](https://github.blog/developer-skills/application-development/scientist/) (GitHub — comparer
ancien et nouveau chemin sur du trafic réel avant de couper l'ancien) s'applique directement, à coût
quasi nul :

1. Le bloc inline actuel reste en place. Juste après, appeler aussi `computeAttackRoll(...)` avec les
   contributions assemblées depuis les mêmes valeurs locales.
2. Comparer Seuil et `breakdown` (`JSON.stringify` suffit) entre les deux chemins. Sur écart, logger
   `[DBG-DECOUPLAGE]` avec le détail (jamais bloquant — le résultat inline reste seul utilisé en aval
   pendant cette phase).
3. Retirer le bloc inline **seulement** après une session de jeu réelle (Saar) sans aucun
   `[DBG-DECOUPLAGE]`, incluant au moins un combat à modificateurs cumulés actifs. Limite assumée : les
   modificateurs non exercés pendant cette session (ex. terrain instable) ne sont couverts que par la
   relecture du littéral — les lister dans le message de clôture du Lot (rubrique **Non testé**).
4. Dispositif temporaire — supprimé avec le bloc inline au commit qui clôture le Lot 1, jamais laissé en
   double-calcul permanent.

### 2.4 Architecture retenue — Lot 2 (branchement défenseur CaC + `confirmMeleeDefense`)

> **Corrigée le 2026-07-26 après analyse à charge** — la version précédente de cette section avait un
> angle mort (point h) et une erreur factuelle (point b). Les deux sont corrigés ci-dessous plutôt que
> réécrits en silence, pour garder la trace de ce qui a été trouvé et pourquoi.

Scope resserré après lecture du code réel (2026-07-26) : Lot 2 ne couvre que `resolveMeleeAction`.
`resolveAssaultAction` n'a **pas** de branchement défenseur symétrique — le Tir n'a pas de jet de
défense opposé (RAW : la défense est pliée dans le Seuil de l'attaquant), `[VÉRIFIÉ]` par grep, aucun
`AWAITING_DEFENSE`/`DEFENSE_PROMPT` côté Tir. Le branchement réel de `resolveAssaultAction` est sur le
type de l'**attaquant** (PJ diffère les dégâts au joueur / PNJ résout immédiatement, avec un sous-cas
cible-drone imbriqué, L.2784) — un axe différent, hors périmètre de ce Lot (voir §3.1).

**a) Les 4 branches à extraire (`resolveMeleeAction`, état post-Lot 1, `[VÉRIFIÉ]` par lecture).**
Correctif du tableau §3 : le texte « PJ sans-défense » d'une version antérieure de ce plan était
imprécis — la cible sans défense (DEF5) s'applique à n'importe quel type de défenseur, ce n'est pas la
branche PJ. Les 4 branches réelles, mutuellement exclusives :
1. `resolveDefenselessTarget` — cible sans défense (DEF5), tout type de défenseur, auto-résolution
   complète.
2. `resolveMeleeDefensePnj` — défenseur PNJ, jet de défense opposé réel.
3. `resolveMeleeDefenseDrone` — défenseur drone, pas de jet de défense (§7.4).
4. `resolveMeleeDefensePj` — défenseur PJ, suspend + prompt (`COMBAT_MELEE_DEFENSE_PROMPT`), résolu
   plus tard par `COMBAT_MELEE_DEFENSE_CONFIRM` (hors de cette fonction).

Le cas « décor » (`!targetToken?.character_id`) reste inline — 3 lignes, extraction inutile.

**b) Un objet de contexte à vérifier champ par champ, pas une réutilisation gratuite.** `[VÉRIFIÉ]`
correctif d'une erreur de la version précédente de cette section : `commonPending` n'est **aujourd'hui
consommé que par la branche PJ** (L.1814) — c'est le payload persisté en base (`combat_pending.payload`)
et relu par nom de champ dans `confirmMeleeDefense` (L.527-539, point h), pas un objet de contexte déjà
généraliste. L'étendre pour servir aussi aux branches 1-3 reste une bonne idée mais demande une
vérification champ par champ : `weaponInvId` et `damageFormula` y sont **déjà** présents (L.1581-1582,
inutile de les rajouter, contrairement à ce que disait la version précédente) ; le vrai manque est
`targetTokenId` (scalaire, utilisé par les 4 branches — pas `targetToken`, la ligne complète n'étant plus
nécessaire une fois `defenderCharacter`/`targetName` déjà résolus par la coquille), plus
`sheetAttaquant.id` et `naturalWeaponCharMutationId` (dégâts, branches 1-3 seulement). Contrainte
supplémentaire : aucune clé existante ne doit être renommée — `confirmMeleeDefense` les lit par nom sans
validation de schéma, un renommage silencieux casserait ce lecteur externe sans erreur visible avant le
prochain combat à défenseur PJ.

**c) Dispatch : suite de gardes, pas de table générique.** Seulement 3-4 cas mutuellement exclusifs sur
`defenderCharacter.type` — la doctrine standard (catalogue de refactoring Fowler, « guard clauses » vs
« dispatch table ») réserve la table de dispatch aux cas nombreux et homogènes ; une suite simple
`if (defenseless) return await resolveDefenselessTarget(...); if (type === 'pnj') return await
resolveMeleeDefensePnj(...); ...` reste la solution la plus simple, cohérente avec le style déjà en
place dans ce fichier (`resolveDroneAssaultAction` extrait de la même façon, pas de registre).

**d) Réutilisation gratuite du noyau Lot 1.** `breakdownDef` (défense PNJ, L.1702-1709) a exactement la
forme `{ label, value, type }` — `resolveMeleeDefensePnj` appelle `computeAttackRoll` pour ce jet de
défense au lieu de reconstruire le breakdown à la main (RV6, §7). Zéro nouveau code à valider : le
noyau est déjà testé et éprouvé en jeu par le Lot 1.

**e) Contrat à préserver — appelants vérifiés.** `resolveMeleeAction` n'est appelée que par
`socketCombatResolution.js:362` (`[VÉRIFIÉ]` par grep, aucun autre site) — chaque fonction extraite doit
retourner exactement `{ suspend, emissions }`, même contenu et même ordre d'émissions qu'aujourd'hui ; la
coquille assemble `commonPending`, appelle la bonne branche, et retransmet son retour tel quel.
`confirmMeleeDefense` (point h) a en revanche **deux** appelants `[VÉRIFIÉ]` par grep : le handler
`COMBAT_MELEE_DEFENSE_CONFIRM` (`socketCombatResolution.js:410`, joueur qui confirme sa défense) et
`forceAdvanceResolution` (`socketCombatHelpers.js:998`, MJ qui force la résolution à la place d'un joueur
absent, `forced:true`) — le correctif du breakdown doit rester correct dans les deux appels, pas
seulement le chemin joueur normalement testé.

**f) Vérification — pas de shadow-mode (contrairement au Lot 1), scénarios corrigés.** Les branches
écrivent en base (`combat_pending`, `resolveDroneIntegrityLoss`, `resolveTargetHit`) et émettent des
événements — les rejouer deux fois pour comparer doublerait les dégâts et les jets de dés, contrairement
au noyau pur du Lot 1. La vérification reprend la méthode déjà utilisée avec succès sur ce projet pour du
code touchant la DB (Tir visé, Moding Groupe 1, Lot B — `docs/EN_COURS.md`) : un script de fixture
jetable (campagne/tokens/personnages construits à la main), nettoyage vérifié 0 résidu, jamais commité
(`CLAUDE.md` §7 : test temporaire hors dépôt partagé). « Un scénario par branche » (4) sous-comptait :
la branche sans-défense se resépare elle-même en drone/non-drone (L.1620), et `confirmMeleeDefense`
(point h) ajoute son propre succès/échec de défense et son branchement attaquant PJ/PNJ après un hit.
Liste minimale :
1. Sans-défense, défenseur non-drone → touché.
2. Sans-défense, défenseur drone → touché.
3. PNJ défenseur → attaquant touche (défense ratée ou MR inférieur).
4. PNJ défenseur → défense réussie (pas de hit) — vérifie le noyau hors du seul cas « victoire ».
5. Drone défenseur → touché.
6. PJ défenseur → suspend + prompt émis (pas encore confirmé) — couvre aussi l'invariant d'ordre (i).
7. `confirmMeleeDefense` → défense réussie (miss).
8. `confirmMeleeDefense` → touché, attaquant PJ (dégâts différés au joueur).
9. `confirmMeleeDefense` → touché, attaquant PNJ (dégâts auto).

Plus une session de jeu réelle de Saar avant clôture, comme au Lot 1, couvrant au moins un défenseur PJ
réel (déclaration → défense confirmée → dégâts) en plus des cas PNJ/drone/sans-défense.

**g) Décision tranchée — le bloc PJ reste dans Lot 2.** La branche PJ (L.1813-1831) contient
`combat_pending`/`setFSMSubPhase`/`broadcastCurrentSubPhase` — primitives que le Lot 3 doit par ailleurs
traiter pour le reste de l'orchestration. Décision : ce bloc reste dans Lot 2 en tant que 4ᵉ branche
défenseur (cohésion du groupe) ; le Lot 3 ne touchera que l'orchestration qui n'est pas déjà rattachée à
une branche défenseur précise.

**h) `confirmMeleeDefense` entre dans le périmètre — même dette, deuxième copie (angle mort trouvé en
analyse à charge).** `resolveMeleeAction` ne fait que **suspendre** côté PJ (branche 4) — la vraie
résolution (jet de défense opposé, ajustement mode de combat/terrain instable, breakdown) vit dans
`confirmMeleeDefense` (`socketCombatHelpers.js:510-732`), la seule fonction qui relit `commonPending`
depuis la base. Cette fonction contient sa propre copie du calcul de défense — `chanceDefense`,
`breakdownDefPj` (L.580-587), `hit`, `mr` — miroir quasi identique de la branche PNJ (`breakdownDef`,
L.1702). RV6 (§7) ne visait que la branche PNJ ; sans ce point, la dette resterait à moitié réglée : la
deuxième copie continuerait d'exister côté PJ, exactement ce que ce chantier cherche à éliminer.
Correctif : `confirmMeleeDefense` appelle `computeAttackRoll` avec `rollAttaque: rollDefense` (le noyau
ne connaît qu'« un jet de D20 », peu importe s'il s'agit d'une attaque ou d'une défense — aucun
changement du noyau Lot 1, déjà testé et clos) et la même liste de contributions ordonnée que la branche
PNJ. `confirmMeleeDefense` reste par ailleurs une fonction à part entière déjà correctement isolée (pas
de duplication structurelle dans son branchement attaquant PJ/PNJ après le hit, L.621-718) — seul le
calcul de la défense elle-même bascule sur le noyau.

**i) Invariant d'ordre — à tester explicitement, pas seulement par relecture.** Le test « cible sans
défense » (DEF5) doit rester évalué **avant** le type de défenseur : un PNJ ou un PJ étourdi/inconscient
doit toujours passer par `resolveDefenselessTarget`, jamais par sa branche de type normale (sinon un
défenseur sans-défense relancerait un jet de défense actif, contraire au RAW,
`REGLESYSCOMBAT.md:1055-1057`, déjà cité §0). Cet ordre est correct dans le code actuel (L.1604 avant
L.1666/1779/1813) ; Lot 2 doit le préserver explicitement et le vérifier par un scénario dédié (f.6), pas
seulement par relecture du diff.

**j) Aucune transaction, aucun filet — l'ordre des `await` doit rester identique, pas seulement les
appels.** `[VÉRIFIÉ]` par grep : une seule `db.transaction(` dans tout le fichier (L.1952, sans rapport
avec cette résolution). Aucune des écritures de la résolution CaC (`combat_pending`, `resolveTargetHit`,
`resolveDroneIntegrityLoss`) n'est atomique aujourd'hui — un crash à mi-chemin peut déjà laisser un état
incohérent, sans rattrapage. Lot 2 ne doit pas seulement préserver les mêmes appels, mais le même ordre
exact d'`await`, faute de quoi un échec partiel laisserait un état différent d'aujourd'hui.

**k) Invariant de propagation d'erreur — aucune fonction extraite ne doit avoir son propre `try/catch`.**
`[VÉRIFIÉ]` : le catch unique de `resolveMeleeAction` (L.1832-1835) retourne `{ suspend: false, emissions:
[] }` sur toute exception — un tableau **vide**, pas le tableau `emissions` déjà rempli. Comportement
actuel : si une branche défenseur lève une exception après que le `DICE_RESULT` de l'attaque a déjà été
mis en file (toujours le cas, il est poussé avant le branchement), ce `DICE_RESULT` est silencieusement
perdu — pas un bug de ce chantier, mais un comportement à préserver à l'identique. Si une des 4 fonctions
extraites gagnait son propre `try/catch` local, elle pourrait retourner des émissions partielles au lieu
de rien, changeant ce comportement sans que personne ne le remarque avant un crash réel en jeu — donc
aucune fonction extraite ne doit attraper ses propres erreurs, elles remontent toutes au catch unique de
la coquille.

**l) `confirmMeleeDefense` a une sémantique d'échec différente — à ne pas harmoniser au passage.**
Contrairement à `resolveMeleeAction` (file `emissions[]`, flush différé par l'appelant), `confirmMeleeDefense`
émet directement et immédiatement (`io.to(...).emit(...)`, `[VÉRIFIÉ]` L.593, L.610) ; son catch (L.729)
ne fait que logger, sans rien annuler — un événement déjà émis avant une exception reste envoyé,
contrairement à `resolveMeleeAction` où tout serait perdu. Les deux fonctions ont donc deux comportements
différents face à une erreur en cours de route, aujourd'hui. Le point h) ne change que le calcul du
breakdown — il ne doit pas tenter d'unifier ces deux styles au passage (ce serait INFRA-2, §5, hors
périmètre, décision séparée).

### 2.5 Architecture retenue — Lot 3 (orchestration `AWAITING_DAMAGE` dupliquée)

> Recherche menée avant de figer cette architecture (consigne explicite de Saar, 2026-07-28 : s'appuyer
> sur l'expertise déjà publiée, ne jamais bricoler une solution locale quand un précédent pro existe).

**Sources** :
- [Fowler — « An example of preparatory refactoring »](https://martinfowler.com/articles/preparatory-refactoring-example.html) :
  cite Kent Beck, « make the change easy, then make the easy change ». Cadre exact de ce Lot — il ne
  résout pas RC2/COM27 (§5, hors périmètre), il rend son futur correctif bon marché.
- [Colyseus — Room / State Synchronization](https://docs.colyseus.io/room) : ce framework Node.js
  multijoueur de référence documente `afterNextPatch`, une option de broadcast qui ne part **qu'une
  fois l'état muté déjà appliqué** — reconnaissance, dans un projet de production du même domaine, du
  problème exact de BUG-1 (`docs/AUDIT.md`) : une notification de changement d'état qui part avant
  l'événement qui la justifie. Confirme que `emissions[]`/`flushEmissions` (déjà dans ce projet) est
  l'équivalent maison d'un problème déjà résolu ailleurs — pas une invention locale à remettre en
  cause à cette occasion.
- [Colyseus — The Command Pattern](https://docs.colyseus.io/best-practices/command-pattern) : confirme,
  par un framework en production, que « Dispatcher + Command » est la direction reconnue si ce projet
  généralise un jour `emissions[]` — corrobore indépendamment §1.2 (Game Programming Patterns, déjà
  noté « pas retenu pour ce plan », toujours vrai ici : direction pour un futur lot, pas pour celui-ci).
- Le nom générique du motif « file d'événements, publiée dans l'ordre après la mutation » est le
  *transactional outbox pattern* (distribué à l'origine) : l'enseignement qui s'applique ici est que la
  file existe déjà (`emissions[]`) — le vrai défaut (RC2) est qu'elle n'est pas appliquée partout, pas
  qu'elle serait mal conçue. Rien à réinventer.

**a) Constat `[VÉRIFIÉ]` par lecture post-Lot 2 (lignes à jour)** — un même bloc revient 3 fois, pas 1 :
insertion `combat_pending` (`type:'damage'`) → `setFSMSubPhase(db, campaignId, 'AWAITING_DAMAGE')` →
`broadcastCurrentSubPhase(io, campaignId)` (direct, identique dans les 3 cas) → comptage
`pendingDamageCount` → prompt émis seulement si `count === 1` :
1. `confirmMeleeDefense` L.624-665 (attaquant PJ CaC qui touche).
2. `resolveDroneAssaultAction` L.2325-2354 (drone qui touche une cible PJ).
3. `resolveAssaultAction` L.2751-2794 (attaquant PJ Tir qui touche).

Le 4ᵉ site structurellement voisin, `resolveMeleeDefensePj` (L.1859-1886, Lot 2), reste **hors
périmètre** : type `'melee_defense'`, sous-état `AWAITING_DEFENSE`, pas de comptage (un seul défenseur
possible) — décision déjà actée §2.4.g, pas la même duplication.

**b) Piège trouvé en comparant les 3, pas une extraction à l'aveugle** : elles ne sont **pas**
émission-identiques après le comptage. `confirmMeleeDefense` n'utilise **aucun** `emissions[]` — tout y
est émis en direct (`attackerSocket.emit(...)`, L.660-664 ; déjà noté §2.4.l comme volontaire, à ne pas
harmoniser). `resolveDroneAssaultAction`/`resolveAssaultAction` poussent leur prompt dans `emissions[]`
(`{ to: 'user'|'socket', ... }`, flush différé par l'appelant). Une extraction qui engloberait aussi
l'émission du prompt forcerait un style sur l'autre — changement de comportement non demandé, et
précisément le terrain de BUG-1/COM27 que ce Lot doit éviter (§5).

**c) Découpage retenu — extraire seulement la portion réellement identique.** Nouvelle fonction
`armAwaitingDamage(io, campaignId, tokenId, payload)` (voisinage `broadcastCurrentSubPhase`, même
fichier) : fait l'insert + `setFSMSubPhase` + `broadcastCurrentSubPhase` + le comptage, retourne
`pendingDamageCount`. Chaque site garde sa propre émission du prompt telle quelle :

```js
// server/src/socket/socketCombatHelpers.js — voisinage de broadcastCurrentSubPhase (L.362)
async function armAwaitingDamage(io, campaignId, tokenId, payload) {
  await db('combat_pending').insert({ campaign_id: campaignId, token_id: tokenId, type: 'damage', payload })
  await setFSMSubPhase(db, campaignId, 'AWAITING_DAMAGE')
  await broadcastCurrentSubPhase(io, campaignId)
  const [{ count }] = await db('combat_pending')
    .where({ campaign_id: campaignId, token_id: tokenId, type: 'damage' })
    .count('* as count')
  return parseInt(count, 10)
}
```

Chaque appelant devient : `const pendingDamageCount = await armAwaitingDamage(io, campaignId, tokenId,
payload); if (pendingDamageCount === 1) { /* émission du prompt, style propre au site, inchangé */ }`.
Payload construit par l'appelant comme aujourd'hui (les 3 payloads diffèrent réellement en contenu —
`melee`/`assault`/drone — la fonction ne les façonne pas, elle les transporte).

**d) Pourquoi c'est de la « preparatory refactoring » et pas une DRY cosmétique.** L'appel à
`broadcastCurrentSubPhase` est aujourd'hui identique (direct, immédiat) dans les 3 sites — regroupé en
un seul point d'appel, un futur correctif RC2/COM27 qui déciderait de le faire transiter par un
`emissions[]` (le style Colyseus `afterNextPatch`) n'aurait qu'**un** endroit à changer au lieu de 3.
Ce Lot ne fait pas ce changement — il le rend seulement moins coûteux le jour où il sera décidé
séparément (§5).

**e) `confirmDamage` — bloc voisin, forme différente, non inclus.** Le ré-armement FIFO de
`confirmDamage` (L.759-760 : `setFSMSubPhase` + `broadcastCurrentSubPhase` seuls, sans nouvel insert ni
comptage — une entrée suivante déjà existante est simplement re-signalée) n'a pas la même forme que le
bloc a) — 2 lignes, pas de payload à transporter, pas de comptage. L'extraire dans `armAwaitingDamage`
forcerait cette fonction à accepter un mode "sans insert", complexifiant sa signature pour un gain nul
(2 lignes économisées). Laissé tel quel, hors périmètre — cohérent avec le principe « ne pas designer
pour un besoin hypothétique » : rien n'indique aujourd'hui qu'un 4ᵉ site aurait cette forme.

**f) Contrat à préserver.** Les 3 appelants ne changent que leur bloc a) — payload, comptage et
condition `=== 1` identiques avant/après ; l'insert et le nom des colonnes ne bougent pas (autres
lecteurs de `combat_pending.payload` : `confirmDamage`, `forceAdvanceResolution`, non affectés, aucune
clé renommée). Aucune fonction extraite ne gagne de `try/catch` propre — même invariant que §2.4.k, la
propagation d'erreur remonte au catch de la coquille appelante inchangé.

---

## 3. Découpage en lots — un seul problème par lot, validé avant le suivant

**Prérequis à tous les lots (§0.5)** : travail Session 176 validé en jeu et committé (ou mis de côté
par décision explicite de Saar). Worktree propre au démarrage de chaque lot.

| Lot | Contenu | Risque | Statut |
|---|---|---|---|
| **Lot 0** | Tables CaC/taille/portée → `shared/combatSituationMods.js` étendu (§2.1.a) : 3 sites serveur (melee/assault/drone) + 2 fenêtres client basculés, copies locales supprimées | Faible — valeurs inchangées, invariant « autorité unique des tables », vérifiable par simple comparaison des constantes | **Codé (2026-07-25)** — 23 valeurs vérifiées conformes par script, build Vite OK, syntaxe serveur OK ; ⚠️ en attente : vérif visuelle Saar des 2 fenêtres + démarrage serveur réel + décision commit (Session 176 toujours non committée sur le même fichier, §0.5) |
| **Lot 1** | Noyau `computeAttackRoll` (§2.1.b-d) + assemblage contributions dans les deux fonctions + shadow-mode (§2.3) + tests unitaires (§2.2) | Faible — comportement identique bit-à-bit, aucune écriture DB ni émission déplacée | **✅ Clos (2026-07-25)** — 9 tests unitaires OK, fuzz 1000 tirages sans écart, session de jeu réelle Saar (CaC PJ/PNJ + Tir + attaque multiple + deux armes + mode offensif + Seuil négatif) sans aucun `[DBG-DECOUPLAGE]`, bloc inline + dispositif retirés, noyau autoritaire. Modificateurs non exercés en jeu (couverts par fuzz + tests seulement) : taille≠moyenne, terrain instable, bouclier, sans défense, précipitation, tir visé, visée localisation, dual-wield Tir, couverture, mods d'arme |
| **Lot 2** | `resolveMeleeAction` (4 branches défenseur) **+ `confirmMeleeDefense`** (même dette de breakdown dupliqué côté PJ, trouvée en analyse à charge, point h) — détail §2.4 | Moyen — touche à des `await db(...)` et à la construction des émissions `COMBAT_MELEE_RESULT`/`COMBAT_ATTACK_RESULT`/`DICE_RESULT` ; vérification par fixture jetable (9 scénarios, §2.4.f), pas de shadow-mode possible (effets de bord) | **✅ Clos (2026-07-27)** — `node --check` propre, 9 tests Lot 1 toujours au vert (noyau non touché), équivalence numérique ancienne formule/`computeAttackRoll` vérifiée sur 7 cas (script jetable, sans DB), 7 scénarios de fixture jetable en base réelle (0 résidu après coup), puis session de jeu réelle Saar (CaC PNJ auto-résolution + cible sans défense après étourdissement) confirmée sans régression — vérifié aussi en base (2 blessures correctement écrites, une par chemin de code touché). Alerte initiale de Saar (« résolutions manquantes ») retombée sur deux comportements corrects non liés au Lot 2 (attaque hors portée rejetée, PNJ étourdi auto-skip) |
| **Lot 3** | Extraction `armAwaitingDamage` (§2.5) : 3 sites dupliqués (`confirmMeleeDefense`, `resolveDroneAssaultAction`, `resolveAssaultAction`) fusionnés sur un seul point d'insert/FSM/broadcast/comptage ; émission du prompt inchangée par site (§2.5.b) | Faible — comportement identique bit-à-bit (même insert, même comptage, même condition d'émission) ; pas de changement d'ordre d'émission, donc pas un correctif de COM27 (§2.5.d le rend seulement moins coûteux plus tard) | **✅ Clos (2026-07-28)** — diff relu ligne à ligne (mêmes clés/valeurs de payload, mêmes `campaignId`/`tokenId` par site), `node --check` propre, 9 tests Lot 1 toujours au vert (fichier non touché), puis 3 scénarios de jeu réels confirmés par Saar (§6) — committé (`ef12136`) |

Chaque lot = un commit isolé sur `dev/Saar`, testé et confirmé par Saar avant le lot suivant
(`CLAUDE.md` §5, §11). Le Lot 0 est séparé du Lot 1 parce qu'il porte un invariant différent (autorité
unique des tables de valeurs vs pureté du calcul) et corrige une violation `CLAUDE.md` §7 existante —
pas une préparation cosmétique.

### 3.1 Ce que les Lots 0-1 ne résolvent pas — à dire explicitement pour ne pas créer une fausse impression

Sur les 42 branches recensées par l'audit dans `resolveMeleeAction`, une quinzaine seulement vivent dans
le segment visé par le Lot 1 (les spread-conditionnels du `breakdown`, remplacés par le littéral de
contributions). Toute la résolution arme/allonge/distance/arme-naturelle, la résolution bouclier, les
munitions, et l'intégralité du branchement PNJ/drone/PJ (la partie la plus dense des deux fonctions)
restent intactes après ces Lots — 631 lignes ne deviennent pas ~500, elles restent proches de 600. Les
Lots 0-1 sont des **lots de confiance à faible risque** (posent l'autorité unique des tables, la méthode
d'extraction, le premier test automatisé, la vérification shadow-mode — et rendent chaque futur
modificateur moins cher à ajouter) — pas la résolution de l'audit RC1/INFRA-1, qui reste entière tant
que les Lots 2 et 3 ne sont pas faits. Point secondaire d'honnêteté : la toute première proposition
orale de ce chantier incluait la résolution arme/distance dans un « Lot 1 » plus large — portée
resserrée après la lecture de `charStats.js` (§0.3), volontairement, pour respecter la pureté stricte
déjà en vigueur ailleurs dans le projet.

**Asymétrie CaC/Tir découverte en planifiant le Lot 2** : `resolveAssaultAction` n'a pas de branchement
défenseur au sens CaC — pas de jet de défense opposé en Tir (RAW), son branchement réel est sur le type
de l'**attaquant** (PJ diffère les dégâts / PNJ résout immédiatement, avec un sous-cas cible-drone
imbriqué). Hors périmètre du Lot 2 tel que planifié (§2.4) ; à traiter dans un lot séparé si souhaité,
pas mélangé ici (`CLAUDE.md` §13, un plan = un problème).

---

## 4. Invariant de ce chantier

- **Lot 0** : mêmes clés, mêmes valeurs de modificateurs, avant/après — seule l'autorité (le fichier qui
  les possède) change.
- **Lots 1-3** : comportement identique bit-à-bit avant/après extraction : mêmes requêtes DB (même
  nombre, même ordre), même valeur de `chancesAttaque`/`chancesDeReussite`, même contenu et même ordre
  de `breakdown`, même émission `DICE_RESULT`.

Aucune règle de jeu ne change. Aucune migration, aucun nouvel événement WS, aucun nouveau concept
`docs/VOCABULARY.md` (c'est un refactor de code, pas une mécanique).

---

## 5. Hors périmètre de ce plan

- Correctif fonctionnel de COM27 (`docs/BUGIDENTIFIE.md`) — sujet séparé, déjà instrumenté par
  ailleurs ; ne pas le résoudre incidemment "pendant qu'on y est" (`CLAUDE.md` §13, un plan = un
  problème).
- `COMBAT_DAMAGE_CONFIRM`/`COMBAT_MELEE_DEFENSE_CONFIRM` (autres monolithes notés Session 95-3,
  ~213/~261 lignes) — hors périmètre de ce document, à planifier séparément si souhaité.
- INFRA-2 (généralisation du pattern `emissions[]`) — recoupe le Lot 3, décision à prendre à ce
  moment-là, pas ici.
- **Dette i18n des labels de `breakdown`** : le serveur émet du FR figé (`'Compétence'`,
  `'Précipitation'`, `'Seuil'`...) dans `DICE_RESULT`, en tension avec `.claude/rules/i18n.md` (« le
  serveur n'émet jamais de texte FR figé destiné à l'utilisateur ») — dette **préexistante**, pas créée
  ni corrigée par ce chantier. À noter pour le futur lot i18n concerné : les clés client existent déjà
  pour les mêmes modificateurs (`cacModifiers.situationAtk.*`), et la forme « liste de contributions »
  (§2.1) rendra la conversion labels→clés triviale (un seul endroit d'assemblage par fonction). Ne pas
  la faire « au passage » ici.

---

## 6. Validation attendue à la clôture de chaque lot

- **Testé (Lot 0)** : comparaison des constantes avant/après (mêmes clés, mêmes valeurs), build Vite
  client (les deux fenêtres importent la table `shared/`), démarrage serveur — puis vérification visuelle
  rapide par Saar des deux fenêtres de modificateurs.
- **Testé (Lot 1)** : `node --test server/src/lib/combatAttackRoll.test.mjs` (tous les cas §2.2, y
  compris filtre des zéros et ordre du `breakdown` — aucun script npm `test` n'existe, lancement manuel
  comme les 13 tests existants) + démarrage serveur sans erreur + vérification shadow-mode (§2.3) sans
  aucun `[DBG-DECOUPLAGE]` sur au moins un combat CaC réel et un combat Tir réel en jeu par Saar, à
  modificateurs cumulés (ex. multi-adversaires + mode combat + deux armes) — puis retrait du bloc inline
  et du dispositif de comparaison une fois confirmé.
- **Testé (Lot 2)** : équivalence numérique ancienne formule/`computeAttackRoll` sur 7 cas (script pur,
  sans DB) + 7 scénarios de fixture jetable en base réelle (0 résidu, §2.4.f) + session de jeu réelle
  Saar (CaC PNJ auto-résolution, cible sans défense après étourdissement) + vérification directe en base
  des blessures écrites par les deux chemins de code touchés.
- **Testé (Lot 3)** : `node --check` propre, 9 tests Lot 1 toujours au vert (fichier non touché),
  relecture ligne à ligne du diff des 3 sites (mêmes clés/valeurs de payload, mêmes `campaignId`/
  `tokenId`, condition `pendingDamageCount === 1` préservée), puis 3 scénarios de jeu réels confirmés
  par Saar (CaC attaquant PJ touche, Tir attaquant PJ touche, drone touche une cible PJ) — prompt de
  dégâts reçu côté client concerné dans les 3 cas, aucune régression sur l'ordre déjà existant (ce Lot
  ne le change pas, §2.5.d).
- **Non testé** : Lot 4 (tableau §3, pas encore rédigé) — les 4 Lots ne sont pas tous fermés, `⚠️ clos
  partiel` au niveau du plan tant que Lot 4 n'existe pas.
- **Données** : aucune migration, aucun effet runtime en dehors du code déplacé.
- **Retour arrière** : chaque Lot est un commit isolé — `git revert` suffit, aucune donnée vivante
  affectée.

---

## 7. Run à vide (2026-07-25) — pièges relevés avant implantation

Déroulé mental des Lots 0-1 contre le code réel (lecture de `shared/combatSituationMods.js`, des 4 sites
serveur consommateurs, des fenêtres client, et d'un test existant comme modèle). Constats, tous
`[VÉRIFIÉ]` par lecture :

- **RV1 — Inventaire complet des duplications** : 3 tables (CaC situation, taille, portée), pas 2 comme
  au premier recensement — `PORTEE_MOD_COMP` est recopiée dans `CombatModifiersWindow.jsx:24`. Et
  `TAILLE_MODS` a un 4ᵉ consommateur serveur : `resolveDroneAssaultAction` (L.2111, 2133). Intégré au
  §2.1.a.
- **RV2 — Piège d'équivalence, condition agrégée vs filtre par entrée** : le filtre `value !== 0` du
  noyau n'est **pas** équivalent à toutes les conditions actuelles. Cas divergent :
  `weaponModBreakdown` (Tir, L.2594) est gardé par une condition sur le **total**
  (`weaponModComp !== 0 ? map : []`) — si deux mods d'arme se compensaient (+2/-2), l'actuel masque
  toutes les entrées, le filtre par entrée les montrerait. **La coquille doit conserver la condition
  agrégée à l'assemblage** (ne verser les contributions weaponMod que si leur total ≠ 0). Vérifié sans
  divergence pour les autres cas : « Mods situation » CaC (agrégé en une contribution → un 0 agrégé est
  filtré pareil), entrées situation Tir (déjà filtrées par entrée, identique).
- **RV3 — Confirmation a posteriori du choix §2.1** : l'ancienne signature scalaire de ce plan incluait
  `combatModeBonus` (le +3 **dégâts** de la Charge, qui n'entre pas dans le Seuil) parmi les paramètres
  du jet d'attaque — une erreur de câblage déjà présente *dans le plan lui-même*, disparue naturellement
  avec la liste de contributions. La classe d'erreur que le design élimine s'était déjà manifestée.
- **RV4 — Style de test à copier** : `weaponModService.test.mjs` — `node:test` + `assert/strict`,
  imports directs, aucun harnais maison. Le test §2.2 suit ce modèle tel quel.
- **RV5 — Hors périmètre confirmé, à connaître** : le `DICE_RESULT` drone (L.2146-2156) a ses propres
  écarts (`mechanicalTotal: roll`, criticals figés à `false`, base « Programme (niv. X) ») — si un jour
  `resolveDroneAssaultAction` bascule sur `computeAttackRoll`, ces écarts sont volontaires, ne pas les
  « corriger » au passage.
- **RV6 — Opportunité Lot 2** : le breakdown de défense PNJ (`breakdownDef`, L.1710-1717) a exactement
  la forme base + contributions + total — `computeAttackRoll` pourra le servir aussi au Lot 2 (jet de
  défense = même mécanique). Noté pour la planification du Lot 2, pas pour le Lot 1.
