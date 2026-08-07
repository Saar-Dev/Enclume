# PLAN_RW_SYSCOMBAT.md — Découpage structurel de `socketCombatHelpers.js`

> Créé : 2026-07-25 (dev/Saar). Lots 0-4 : **✅ clos** (2026-07-25 → 2026-07-28, committés
> `4ec91b3`…`41b9632`, cf. §3).
> **Rouvert 2026-08-06 (dev/Saar)** : Lots 5-7 ajoutés en continuité directe de ce même chantier
> (décision Saar — "c'est la continuité de ce chantier tout simplement"), méthodologie
> `docs/METHODO_PLAN.md` appliquée pour le cadrage. Statut Lots 5-7 : **planification uniquement,
> aucun code écrit.** Le document n'est donc pas archivé vers `docs/Old/` — le chantier reste actif.
> Document temporaire (`docs/RegleDocumentaire.md` Règle 10) — à archiver dans `docs/Old/` une fois
> **tous** les lots (0-7, et tout lot ultérieur) clos, contenu durable (nouvelle convention de fichier)
> transféré vers `docs/SYSTEME/COMBAT.md`.
> Responsabilité unique de ce document : planifier le découpage structurel de ces fonctions.
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

### 2.6 Architecture retenue — Lot 4 (branchement attaquant de `resolveAssaultAction`)

> **Corrigée le 2026-07-28 après analyse à charge** — la version précédente de cette section avait une
> erreur de conception (point b, la garde drone imbriquée) et une affirmation trompeuse (point c,
> « aucun lecteur externe »). Les deux sont corrigées ci-dessous plutôt que réécrites en silence, même
> discipline que la correction du Lot 2 (§2.4).

Complète la symétrie annoncée §3.1 : Lot 2 a extrait le branchement **défenseur** de
`resolveMeleeAction` ; `resolveAssaultAction` n'a pas d'équivalent CaC (pas de jet de défense opposé en
Tir, RAW) mais a son propre branchement, sur le type de l'**attaquant** — jamais touché jusqu'ici. Même
méthode que Lot 2 (guard clauses, §2.4.c, Fowler) : pas de recherche supplémentaire nécessaire, le motif
est déjà validé sur ce projet.

**a) Les branches réelles `[VÉRIFIÉ]` par lecture post-Lot 3 (lignes à jour).** Le branchement croise en
réalité deux axes — résultat du jet (`isSuccess`) et type de l'attaquant (`character.type`) — pas un
simple `pj`/`pnj` :
1. **Touche + attaquant PJ** (L.2734-2792) — dégâts différés au joueur (`armAwaitingDamage`, Lot 3),
   `return { suspend: true, emissions }`.
2. **Touche + attaquant PNJ, préparation commune** (L.2793-2812 : `mrTable`, `modDomAttaque`,
   `isShortRange`, `modDegatsMode`, `effectiveDamage`, `rawDice`, `degautsBruts`) — calculée une seule
   fois, **identique** que la cible soit un drone ou non (`[VÉRIFIÉ]` par lecture : `degautsBruts` est
   utilisé tel quel par les deux sous-cas ci-dessous, aucune divergence avant ce point).
2a. **Touche + attaquant PNJ + cible drone** (L.2815-2829) — `resolveDroneIntegrityLoss`, `return` propre.
2b. **Touche + attaquant PNJ + cible normale** (L.2831-2868) — `damageService.resolveTargetHit`.
3. **Raté + attaquant PJ** (L.2870-2877) — 8 lignes, un seul emit `COMBAT_ATTACK_PLAYER_RESULT`.
4. **Raté + attaquant PNJ** (L.2878-2892) — 15 lignes, un seul emit `COMBAT_ATTACK_RESULT`.

**b) Ce qui est réellement extrait — et ce qui ne l'est pas (corrigé).** Trois fonctions-feuilles, pas
deux : `resolveAssaultHitPj(io, campaignId, ctx, emissions)`, `resolveAssaultHitPnjDrone(...)`,
`resolveAssaultHitPnjNormal(...)` — dispatch direct par guard clauses dans la coquille, **aucune
fonction-type qui re-branche elle-même**. C'est le même principe que le Lot 2 (§2.4.c : `resolveMeleeDefenseDrone`
est déjà un frère de `resolveMeleeDefensePnj`, jamais imbriqué dedans) — la version précédente de cette
section proposait une seule `resolveAssaultHitPnj(ctx)` gardant le sous-cas drone imbriqué à l'intérieur,
ce qui aurait cassé cette cohérence sans raison valable : le calcul commun (point a.2, ~18 lignes)
remonte dans la coquille (calculé une fois, juste avant le guard-clause final sur `cibleCharacter?.type`),
transmis aux deux fonctions-feuilles via `ctx.degautsBruts` — aucune duplication introduite par cette
correction. Les branches 3 et 4 restent inline dans la coquille — même raison que le « cas décor » de
Lot 2 (§2.4.a) : un seul `emissions.push`, extraire coûterait plus de lignes (signature + appel) que ça
n'en économise, contraire au principe « ne pas designer pour un besoin hypothétique ».

**c) Contexte à transporter — champ par champ, et un lecteur externe existe bien (corrigé).**
Contrairement à Lot 2 (`commonPending` déjà existant, persisté en base), il n'existe aucun objet de
contexte préexistant ici — la préparation commune (L.2705-2732, fetch `cibleToken`/`cibleCharacter`/
`char_sheet_id_cible`/`for_na_cible`/`con_na_cible`/`vol_na_cible`/`targetName`) est assemblée par la
coquille et transportée dans un objet `ctx` construit pour l'occasion, sur le même principe que §2.1
(liste de contributions plutôt que paramètres scalaires) : un objet unique, pas une signature à 15
paramètres positionnels. Champs supplémentaires selon la branche : `rollAttaque`, `chancesDeReussite`,
`mr` (3 sorties distinctes du noyau Lot 1 — la version précédente de cette section les confondait dans
une parenthèse ambiguë), `authoritativeRangeBand`, `effectiveWeaponInvId`, `weapon`, `aimedLocationKey`,
`action`, `character`, `tireurUsername`, `tireurColor`, `targetName`, et pour les deux fonctions PNJ
uniquement : `degautsBruts` (point a.2) + `effectiveDamage` (choc/munition, `resolveAssaultHitPnjNormal`
seulement — la branche drone ne s'en sert pas). `io`/`campaignId`/`emissions` restent des paramètres de
fonction séparés, **pas** des champs de `ctx` — c'est la convention réellement utilisée par les 4
fonctions déjà extraites au Lot 2 (`async function resolveMeleeDefensePnj(io, campaignId, ctx, emissions)`),
la version précédente de cette section proposait à tort de les nicher dans `ctx`, inconsistant avec ce
précédent.

**Correctif de fond** : `ctx` lui-même n'a effectivement aucun lecteur externe (c'est un objet inventé
pour ce refactor, jamais sérialisé) — mais l'affirmation « aucun lecteur externe » de la version
précédente s'appliquait implicitement aussi au **payload construit à l'intérieur de
`resolveAssaultHitPj`** pour `armAwaitingDamage` (L.2750-2770), et *celui-là* a bien un lecteur externe
par nom : `confirmDamage` (L.771-778, destructuring `campaignId, targetTokenId, characterIdCible,
cibleType, char_sheet_id_cible, mr, portee, fire_mode_bonus_dmg, formula, weaponInvId, for_na_cible,
con_na_cible, vol_na_cible, tireurUsername, tireurColor, userId, targetName, type, modDom,
combatModeBonus, aimedLocation, treatAsContact`) — exactement le même risque que `commonPending`/
`confirmMeleeDefense` au Lot 2 (§2.4.b). Aucune clé de ce payload ne doit être renommée ni ajoutée
pendant l'extraction. Point d'attention distinct, à ne pas « corriger » au passage : ce payload Tir/PJ
direct n'a **pas** de clé `type`/`modDom`/`combatModeBonus` (contrairement au payload CaC de
`confirmMeleeDefense` qui a `type:'melee'`, et au payload drone-cible de `resolveDroneAssaultAction` qui
a `type:'assault'`) — asymétrie déjà existante `[VÉRIFIÉ]`, inoffensive aujourd'hui (`confirmDamage` ne
teste que `pendingType === 'melee'`, tout le reste, `'assault'` ou `undefined`, emprunte la même branche),
mais qu'une extraction « propre » pourrait être tentée d'harmoniser en ajoutant `type:'assault'` par
souci de cohérence — un changement de payload non demandé, hors périmètre de ce Lot.

**d) Contrat à préserver.** Même contrat que Lot 2 (§2.4.e) : `resolveAssaultAction` n'a qu'un appelant
externe `[VÉRIFIÉ]` par grep (`socketCombatResolution.js:343`), plus son propre rappel récursif pour
l'interception LOS (L.2418, hors périmètre, déjà existant). Chaque fonction extraite retourne exactement
`{ suspend, emissions }`, la coquille les appelle et retransmet le retour tel quel. Aucune fonction
extraite ne gagne de `try/catch` propre (même invariant que §2.4.k) — la propagation d'erreur remonte au
catch unique de la coquille (L.2895). **Ajout (trouvé en analyse à charge, absent de la version
précédente)** : aucune transaction ne protège ces écritures (`[VÉRIFIÉ]` par grep, une seule
`db.transaction(` dans tout le fichier, sans rapport, même constat que §2.4.j) — l'extraction doit
préserver le même ordre exact d'`await` (fetch cible → calcul dégâts → écriture DB → émission), pas
seulement les mêmes appels.

**e) Edge case pré-existant à documenter, pas à corriger (trouvé en analyse à charge).** Si
`cibleCharacter?.type === 'drone'` mais qu'aucune ligne `drone_sheet` n'existe pour ce personnage
(`droneSheet` falsy, L.2817), le code actuel ne fait **strictement rien** au-delà du `return { suspend:
false, emissions }` — aucun appel à `resolveDroneIntegrityLoss`, aucune émission de résultat de tir :
silence total côté client sur l'issue de l'attaque. Comportement pré-existant (pas introduit par ce
Lot) à préserver identique dans `resolveAssaultHitPnjDrone` — pas un bug de ce chantier, mais un piège
si quelqu'un remarque le silence en testant et « corrige » au passage.

**f) Vérification — pas de shadow-mode, fixture jetable comme Lot 2.** Les branches extraites écrivent
en base (`armAwaitingDamage`/Lot 3, `resolveDroneIntegrityLoss`, `damageService.resolveTargetHit`) et
émettent des événements — les rejouer deux fois doublerait dégâts et jets, même raison qu'au Lot 2
(§2.4.f). Scénarios minimaux :
1. Touche, attaquant PJ → dégâts différés (prompt émis, `suspend:true`).
2. Touche, attaquant PNJ, cible non-drone → dégâts auto-résolus.
3. Touche, attaquant PNJ, cible drone (avec `drone_sheet`) → intégrité décrémentée.
4. Touche, attaquant PNJ, cible drone **sans** `drone_sheet` → aucune régression sur le silence
   pré-existant (§e), pas une émission qui apparaîtrait par erreur.
5. Raté, attaquant PJ → feedback joueur seul (pas de régression sur les branches courtes non extraites).
6. Raté, attaquant PNJ → feedback room seul.

Plus une session de jeu réelle Saar (Tir PJ touche/rate, Tir PNJ touche une cible normale et une cible
drone) avant clôture, comme aux Lots précédents.

---

## 2.7 Architecture retenue — Lot 5 (`computeMeleeRawDamage`, dédup du calcul brut CaC)

> Cadrage 2026-08-06, méthode `docs/METHODO_PLAN.md`. Trouvaille faite en relisant le fichier à jour
> (post Lots 0-4, pas l'audit `docs/PLANS/REFACTOR_GLOBAL.md` du 2026-08-05 qui l'avait déjà signalée
> sans le vérifier sur le code réel) : la duplication existe toujours, elle n'a jamais été dans le
> périmètre des Lots 0-4 (§0.2 exclut `damageService.js`, cette duplication vit côté appelant, pas
> dans ce fichier).
>
> **Lignes réactualisées 2026-08-06** (2ᵉ passe, après le Lot 7) — la session parallèle
> `docs/PLANS/PLAN_CATASTROPHE_RISK.md` Lot 1 (**clos et committé depuis**, `d496481` — non committée
> au moment de cette réactualisation) a inséré `maybeTriggerCatastrophe(...)` à plusieurs endroits du
> fichier depuis la première rédaction de cette section ; les 5 sites ci-dessous ont été relus
> intégralement à nouveau, pas seulement décalés par calcul, puis re-vérifiés identiques après la
> clôture du chantier Catastrophe (aucune dérive supplémentaire au commit final). Aucun changement
> d'architecture — uniquement les numéros de ligne.

**a) Les 5 sites `[VÉRIFIÉ]` par lecture directe (pas seulement grep) — même formule, deux variantes
de contexte.** Tous calculent `degautsBruts = rawDice + getMrModifier(mr) + modDom + combatModeBonus`
juste après un appel à `damageService.getEffectiveMeleeDamage`, mais avec deux formes de garde
différentes, à préserver à l'identique — **ne pas les uniformiser silencieusement** :

| # | Site | Appel `getEffectiveMeleeDamage` | Formule `degautsBruts` |
|---|---|---|---|
| 1 | `resolveDefenselessTarget` L.1715-1720 | `{ weaponInvId, naturalWeaponCharMutationId, charSheetId: attackerSheetId, fallbackFormula }` | `rawDice + modDomAttaque + (modDom ?? 0) + combatModeBonus` |
| 2 | `resolveMeleeDefensePnj` L.1854-1859 | idem #1 | idem #1 |
| 3 | `resolveMeleeDefenseDrone` L.1913-1920 | idem #1 | idem #1 |
| 4 | `confirmMeleeDefense` L.715-721 | `{ weaponInvId, fallbackFormula }` (**sans** `naturalWeaponCharMutationId`/`charSheetId` — §2.4.b, formule mutation déjà figée) | `rawDice + modDomAttaque + (modDom ?? 0) + (combatModeBonus ?? 0)` |
| 5 | `confirmDamage` L.833-842 (branche `melee`) | idem #4 | idem #4 |

**Nuance à préserver, pas une incohérence à corriger** : les sites 1-3 (même tick que la Déclaration)
n'ont jamais besoin de `combatModeBonus ?? 0` — la valeur vient de `commonPending.combatModeBonus`,
toujours un nombre (`resolveMeleeAction` L.1423, était L.1417 : `combatModeAtk === 'charge' ? 3 : 0`), jamais
`null`/`undefined`. Les sites 4-5 (chemin différé, valeur relue depuis `combat_pending.payload` en
base) le sécurisent par prudence défensive. Le noyau extrait sécurise systématiquement les deux (`??
0` sur les deux paramètres numériques) — comportement identique aux 5 sites (le garde ne change jamais
rien pour les sites 1-3, il était déjà toujours un nombre), donc aucune régression, juste une garde
uniforme au lieu d'une garde à deux vitesses.

**b) Le noyau — pure, même famille que `computeAttackRoll` mais un objet différent (dégât, pas Seuil).**
Ne fait **que**
la somme finale ; l'appel `getEffectiveMeleeDamage` (DB) reste dans chaque coquille, avec ses propres
paramètres propres à chaque site (point a, pas unifié — la fenêtre de péremption arme diffère
réellement entre sites immédiats et différés, RW_SYSCOMBAT §2.4.b déjà documenté).

```js
// server/src/lib/combatAttackRoll.js — voisinage de computeAttackRoll (même famille : noyau pur de
// résolution combat, jet d'attaque ET dégât brut — en-tête du fichier à élargir d'une phrase).
// Fonction PURE — aucun accès DB. Le caller fournit rawDice déjà lancé et mr déjà résolu
// (bonus Réussite critique inclus, cf. resolveMeleeAction).
export function computeMeleeRawDamage({ rawDice, mr, modDom, combatModeBonus }) {
  return rawDice + getMrModifier(mr) + (modDom ?? 0) + (combatModeBonus ?? 0)
}
```

**Placement — corrigé après analyse à charge (2026-08-06), erreur de la version précédente de cette
section trouvée en vérifiant plutôt que supposée.** Cette section recommandait `damageService.js`
avec pour justification *« `getMrModifier` y est déjà importé »* — **faux, vérifié par grep** :
`damageService.js` n'importe rien de `shared/polarisTestResolution.js` (`getMrModifier`, `MR_TABLE`,
`resolveTestOutcome` en sont absents). C'est `combatAttackRoll.js` qui importe déjà ce module partagé
(`resolveTestOutcome`, ligne 1) — ajouter `computeMeleeRawDamage` là revient à ajouter un seul nom à un
import déjà ouvert, plutôt que d'introduire une dépendance nouvelle dans `damageService.js`. Second
argument : le contrat « Fonction PURE » de `combatAttackRoll.js` est déjà déclaré et testé
(`combatAttackRoll.test.mjs`), un terrain plus sûr qu'un fichier qui mélange déjà des fonctions async à
DB (`getEffectiveMeleeDamage`, `resolveTargetHit`). **Recommandation corrigée : `combatAttackRoll.js`**
— coût : élargir sa phrase d'en-tête ("jet d'attaque" → "jet d'attaque et dégât brut CaC") et son import
`shared/polarisTestResolution.js` (ajouter `getMrModifier` à la liste déjà importée). `damageService.js`
reste une option défendable (colocalisation avec `getEffectiveMeleeDamage`, qui produit `rawDice`) mais
n'est plus le choix "déjà câblé" que cette section affirmait à tort — décision finale laissée à Saar.
Aucun changement à `getEffectiveMeleeDamage`/`resolveTargetHit` dans les deux cas — la frontière §0.2
n'est pas rouverte.

**Trouvaille annexe en creusant ce point (hors périmètre du Lot 5, signalée pas corrigée)** :
`docs/SYSTEME/SERVICES_COMBAT.md` §5 documente `server/src/lib/mrTable.js` (`getMrTable()`,
singleton-promise, piège A13 "mrTablePromise peut cacher une Promise rejetée") — **ce fichier n'existe
plus dans le dépôt** `[VÉRIFIÉ]` (absent de `server/src/lib/`, aucune référence restante à `getMrTable`/
`mrTablePromise` dans `server/`). Le mécanisme a été remplacé à un moment par la table statique
`MR_TABLE` (`shared/polarisTestResolution.js`, "ex-migration 46 `polaris_mr`") sans que la doc système
soit mise à jour. Documentation obsolète, sans rapport avec ce chantier — à corriger séparément
(`docs/SYSTEME/SERVICES_COMBAT.md`), pas dans ce Lot.

**c) Vérification — shadow-mode possible, contrairement aux Lots 2-4.** `computeMeleeRawDamage` est
pure (aucune DB, aucun emit) : contrairement aux branches défenseur/attaquant, elle peut être vérifiée
par calcul en parallèle sans risque de doubler un effet de bord réel — même méthode que le Lot 1
(Scientist), mais proportionnée à la taille réelle du problème (4 termes, pas 24 spread-conditionnels) :
1. Test unitaire dédié — **corrigé avec le placement (ci-dessus)** : `combatAttackRoll.test.mjs`
   existe déjà (Lot 1) et couvre déjà `computeAttackRoll` selon le modèle RV4 (§7) ; y ajouter un bloc
   `describe('computeMeleeRawDamage', ...)` plutôt que créer un nouveau fichier — cas bornes (`modDom`/
   `combatModeBonus` à 0, `null`, `undefined`), `mr` positif/négatif/nul, au moins un cas réaliste par
   site (CaC PJ normal, CaC PNJ normal, drone, sans-défense).
2. Script d'équivalence (sans DB, comme Lot 2 §7) : ancienne formule inline vs `computeMeleeRawDamage`
   sur un jeu de valeurs représentatif des 5 sites.
3. Session de jeu réelle Saar couvrant au moins 3 des 5 chemins (ex. CaC PNJ auto-résolution, CaC
   défenseur PJ après confirmation, cible sans défense) — les 2 restants (drone, PJ attaquant via
   `confirmDamage`) confirmés par relecture du diff si non exercés en jeu, comme le Lot 4 l'a accepté
   pour ses cas non couverts individuellement.

**d) Contrat à préserver.** Aucune fonction extraite ne gagne de logique conditionnelle nouvelle — les
5 sites gardent chacun leur propre appel `getEffectiveMeleeDamage` (paramètres différents, préservés
tels quels, point a) et n'échangent que la ligne finale de calcul contre un appel au noyau. Risque
faible : pas d'écriture DB, pas d'émission déplacée, la seule chose qui change est l'endroit où
`rawDice + getMrModifier(mr) + modDom + combatModeBonus` est écrit (5 fois → 1 fois).

---

## 2.8 Architecture retenue — Lot 6 (`resolveDroneAssaultAction`, branchement cible)

> Cadrage 2026-08-06. Ne touche pas à l'invariant F2 (`docs/SYSTEME/SERVICES_COMBAT.md` §8) : F2
> interdit de **fusionner** les branches Pj/Pnj/Drone **entre elles** (attaquant humanoïde vs drone vs
> défenseur), pas d'extraire les branches **internes** à `resolveDroneAssaultAction` elle-même — exactement
> ce que les Lots 2 et 4 ont déjà fait ailleurs dans ce fichier (`resolveMeleeDefensePnj`/`Drone`/`Pj`,
> `resolveAssaultHitPj`/`PnjDrone`/`PnjNormal`), jamais appliqué ici jusqu'à présent.
>
> **Lignes réactualisées 2026-08-06** (2ᵉ passe, même raison que §2.7 — chantier Catastrophe **clos et
> committé depuis**, `d496481`, lignes re-vérifiées stables après coup) — `maybeTriggerCatastrophe(io,
> campaignId, action.token_id, droneOutcome.catastropheRisk, ...)` est désormais insérée L.2277-2280,
> juste avant le guard `!isSuccess` : confirme, sur un 4ᵉ site, que ces insertions restent chaque fois
> dans la coquille, jamais dans une branche extraite (même constat que §2.7, §2.9). Fonction déplacée à
> L.2103 (était L.2089).

**a) Les 3 branches réelles `[VÉRIFIÉ]` par lecture intégrale (état actuel, relu une 2ᵉ fois après
l'insertion Catastrophe).** Toutes mutuellement exclusives par `return` précoce, après le jet et le
guard `!isSuccess` (L.2282-2289, laissé inline — 8 lignes, même raison que les branches "raté" du
Lot 4, extraction plus coûteuse que le gain) :
1. **Cible drone** (L.2304-2331, 28 l.) — `parseDice` direct sur `weapon.effective_formula`,
   `getMrModifier(mr)`, `calcDroneDegatsNets`, `resolveDroneIntegrityLoss`, 2 émissions.
2. **Cible PNJ ou décor** (L.2334-2385, 52 l.) — `fetchCibleNA`, `parseDice`, `damageService.resolveTargetHit`,
   3 émissions, `applyStun` conditionnel.
3. **Cible PJ** (L.2387-2420, 34 l.) — `fetchCibleNA`, `armAwaitingDamage` (Lot 3), prompt conditionnel,
   `return { suspend: true, emissions }` (seule branche qui suspend — les deux autres retournent
   implicitement en fin de fonction avec `suspend: false`, cohérent avec le contrat déjà établi).

**b) Dispatch — guard clauses, pas de table, même style que Lot 2/4 (`docs/SYSTEME/SERVICES_COMBAT.md`
§8, catalogue Fowler « guard clauses »).** 3 fonctions sœurs, aucune ne se re-branche elle-même :
`resolveDroneAssaultHitDrone`, `resolveDroneAssaultHitPnj`, `resolveDroneAssaultHitPj`
(`io, campaignId, ctx, emissions`), voisinage immédiat de `resolveDroneAssaultAction` (même patron que
Lot 2/4 : fonctions extraites juste après leur coquille appelante).

**c) Contexte à transporter — champ par champ, corrigé après analyse à charge (2026-08-06).**
Contrairement à Lot 2 (`commonPending` déjà persisté), aucun objet de contexte préexistant ici (même
situation que Lot 4, §2.6.c). `ctx` assemblé par la coquille juste avant le dispatch (après le calcul
de `formula`, L.2296) : `{ action, cibleCharacter, formula, mr, portee, tireurUsername, tireurColor,
userId, now }`. **`cibleToken` retiré de la version précédente de cette section** — vérifié champ par
champ dans les 3 branches (pas seulement supposé) : aucune des trois ne lit `cibleToken` directement,
il ne sert qu'à dériver `cibleCharacter` **avant** le dispatch (L.2292-2295, reste dans la coquille) —
l'inclure dans `ctx` n'aurait rien cassé (champ mort, pas un bug) mais contredit le principe déjà
énoncé §2.6.c/§0.3 (charStats.js) de ne transporter que ce qui est réellement lu. Chaque branche
utilise des sous-ensembles différents (`portee` uniquement lu par la branche PJ, `now` non lu par la
branche PJ) — cohérent avec Lot 2/4, qui transportent déjà des champs non utilisés par toutes les
branches. `fetchCibleNA` (fermeture locale L.2301) **ne voyage pas dans `ctx`** — chaque fonction
extraite appelle directement `damageService.fetchCibleNA(db, charId, sheetId)` (déjà importé au niveau
module, aucune fermeture à transporter, `[VÉRIFIÉ]` export réel à `damageService.js:251`) : cohérent
avec la convention déjà en place, `ctx` reste un objet de données pur, jamais de fonction, dans les 7
fonctions déjà extraites aux Lots 2 et 4. `io`/`campaignId`/`emissions` restent des paramètres séparés
(même convention que Lot 2 §2.4.c, Lot 4 §2.6.c).

**d) Contrat à préserver — appelant vérifié `[VÉRIFIÉ]` par grep, re-confirmé 2ᵉ passe.**
`resolveDroneAssaultAction` a 2 appelants : `socketCombatResolution.js:372` (externe, fichier non
touché par le travail parallèle Catastrophe, `[VÉRIFIÉ]` `git diff --stat` vide sur ce fichier) et
`resolveAssaultAction:2457` (dispatch attaquant drone, était L.2439) — plus son propre rappel récursif
pour l'interception LOS (L.2194, était L.2180, hors périmètre, déjà existant, ne traverse jamais les 3
branches cible). Extraire les branches cible ne change ni la signature ni le contrat
`{ suspend, emissions }` de `resolveDroneAssaultAction` elle-même — les deux appelants externes ne
voient aucune différence. Aucune fonction extraite ne gagne de `try/catch` propre — même invariant que
§2.4.k/§2.6.d, la propagation remonte au catch unique de la coquille (L.2422, était L.2404).
**Ajout (analyse à charge, absent de la version précédente)** : aucune transaction ne protège ces
écritures — `[VÉRIFIÉ]` par lecture de la fonction entière, aucun `db.transaction(` ici (même constat
que §2.4.j/§2.6.d pour le reste du fichier) — l'extraction doit préserver le même ordre exact d'`await`
dans chaque branche (fetch cible → jet dégâts → écriture DB → émission), pas seulement les mêmes appels.

**e) Vérification — fixture jetable, pas de shadow-mode (écritures DB + émissions), même méthode que
Lots 2/4.** Scénarios minimaux, **6 pas 5** (un scénario ajouté en analyse à charge) :
1. Cible drone, avec `drone_sheet` → intégrité décrémentée.
2. Cible drone, **sans** `drone_sheet` → aucune émission (comportement actuel L.2306 `if (!droneSheet)
   return`, était L.2288, silence total — à documenter comme pré-existant si conservé, même piège que
   §2.6.e).
3. Cible PNJ → dégâts auto-résolus + localisation + shock si déclenché.
4. Cible décor (`!cibleCharacter`) → même chemin que PNJ (branche b actuelle teste `!cibleCharacter ||
   type==='pnj'` ensemble, à préserver).
5. Cible PJ → prompt émis (`suspend:true`).
6. ~~Cible PNJ/décor, `damageService.resolveTargetHit` renvoie `null`~~ — **corrigé après vérification
   au codage (2026-08-06/07)** : `[VÉRIFIÉ]` par lecture intégrale de `resolveTargetHit`
   (`damageService.js:296-310`), le seul `return null` de cette fonction est `if (cibleType ===
   'drone') return null` (L.310) — or `resolveDroneAssaultHitPnj` n'est jamais dispatchée avec
   `cibleType: 'drone'` (le guard `cibleCharacter?.type === 'drone'` de la coquille intercepte ce cas
   avant, vers `resolveDroneAssaultHitDrone`). Ce chemin est donc **structurellement inatteignable**
   aujourd'hui — le garde `if (hitResult === null) return` reste du code mort défensif via cet appelant
   précis (pas une invitation à le retirer : `resolveTargetHit` est appelée par 3 autres sites qui,
   eux, passent parfois `cibleType: 'drone'`— cf. `resolveMeleeDefensePnj`/`confirmMeleeDefense`/
   `confirmDamage`). Correction de la première rédaction de cette section, qui affirmait ce scénario
   testable sans l'avoir vérifié contre le corps réel de `resolveTargetHit`.

Les 5 scénarios restants **exécutés en fixture jetable réelle (2026-08-07)** — campagne/battlemap
(surface vide, mêmes modalités que `worldService.test.mjs`)/personnages/tokens construits à la main,
`resolveDroneAssaultAction` appelée pour de vrai (io mocké `to().emit()` uniquement, `programme.level:
20` pour garantir `isSuccess` sur tout jet 1d20 possible), cleanup vérifié 0 résidu :
1. Cible drone avec `drone_sheet` → intégrité décrémentée en base (15 → 14), émission `cardType:
   'drone_damage'` confirmée.
2. Cible drone sans `drone_sheet` → 1 seule émission (le jet d'attaque), silence confirmé sur la suite.
3. Cible PNJ → émissions Localisation + Dégâts + `COMBAT_ATTACK_RESULT` confirmées.
4. Cible décor (`!cibleCharacter`) → même chemin que PNJ confirmé (émission Localisation présente).
5. Cible PJ → `suspend:true`, prompt `COMBAT_DAMAGE_PROMPT` dans `emissions`, ligne `combat_pending`
   (`type:'damage'`, `payload.type:'assault'`) vérifiée en base.

**Piège méthodologique rencontré et corrigé avant de conclure** : le premier passage du script
signalait un échec silencieux d'`applyWound` (`condition_type "wound_healing_check" absent de
shared/echeanceTypeRegistry.js`) sur le scénario 3 — pas un bug du Lot 6 ni du serveur réel :
`shared/echeanceTypeRegistry.js` est peuplé par effet de bord via l'import de
`server/src/lib/echeanceHandlerRegistrations.js` dans `server/src/index.js`, jamais exécuté par un
script isolé qui n'importe que `socketCombatHelpers.js`. Ajouté cet import au script de fixture — les
5 scénarios passent alors sans aucune erreur. Signalé ici pour que quiconque écrit un futur fixture
jetable sur du code touchant les blessures sache reproduire cet import, pas pour rouvrir un faux bug.

**Durcissement demandé par Saar après relecture critique (2026-08-07), une fois sa propre session de
jeu confirmée fonctionnelle — aucune correction sur le code livré, uniquement sur la rigueur du
script de vérification** :
- Assertions resserrées : valeur exacte (`-1` d'intégrité, pas un `|| === 0` de repli inutile ici vu
  l'arme utilisée) et vérification du **nom d'event** (`e.event === WS.COMBAT_DAMAGE_PROMPT`), pas
  seulement de la forme du payload comme dans la première version du script.
- Scénario supplémentaire — **cible PNJ avec armure sur les 6 slots réels**
  (`shared/armorConstants.js` LOC_TABLE : T/C/BD/BG/JD/JG) : la première version du fixture ne testait
  jamais la branche `armorQuery` de `damageService.resolveTargetHit` avec une armure réellement
  présente (`etq` restait toujours `null`, code pré-existant non touché par ce Lot mais jamais
  réellement exercé par la vérification). Confirmé : `diffLabel` porte bien `Armure:3` quand l'armure
  est en place.
- **20 passes** de la suite complète (jets de dés réels `parseDice`, non mockés — la première version
  n'avait tourné qu'une fois) : 420 assertions, 0 échec.
- **Résidu trouvé et nettoyé, hors du fixture lui-même** : les 2 tout premiers essais du script
  (avant la découverte des contraintes `chk_dp_source`/`drone_programs_level_check` sur
  `drone_programs`, §ci-dessus) avaient échoué **avant** l'entrée dans le bloc `try/finally` — 2
  campagnes de test orphelines (et leurs personnages/battlemaps en cascade) sont restées en base.
  Repérées par une vérification de résidu élargie (recherche par nom/email, pas seulement l'ID de la
  dernière passe) et supprimées explicitement, cascade FK vérifiée (`characters`/`battlemaps` →
  `campaigns` = `ON DELETE CASCADE`, confirmé par `pg_constraint`) — 0 résidu confirmé après coup sur
  les 4 tables concernées. Aucune de ces 2 campagnes n'a jamais été exposée à `resolveDroneAssaultAction`
  (échec avant leur création complète) — sans rapport avec la validité des résultats du Lot 6.

Plus une session de jeu réelle Saar (au moins tir drone → PNJ et drone → PJ) avant clôture — **faite et
confirmée fonctionnelle (2026-08-07)**.

---

## 2.9 Architecture retenue — Lot 7 (`confirmMeleeDefense`, branchement post-hit attaquant)

> Cadrage 2026-08-06. `docs/PLANS/PLAN_RW_SYSCOMBAT.md` §5 (version d'origine) listait déjà
> `confirmMeleeDefense`/`confirmDamage` comme « autres monolithes... à planifier séparément si
> souhaité » — ce Lot couvre la partie `confirmMeleeDefense` de cette dette annoncée. `confirmDamage`
> reste hors périmètre de ce Lot (voir §3.2, analyse dédiée nécessaire avant de le détailler).
>
> **Lignes réactualisées après analyse à charge (2026-08-06)** — une session parallèle a inséré
> `maybeTriggerCatastrophe(...)` (`docs/PLANS/PLAN_CATASTROPHE_RISK.md` Lot 1, **clos et committé
> depuis**, `d496481` — en cours, non committé au moment de la rédaction initiale de cette section)
> juste avant ce bloc (L.651-655) : les numéros de ligne ci-dessous sont ceux de l'état actuel du
> fichier, re-lus pour cette analyse, pas ceux de la première rédaction de cette section (qui datent
> d'avant cette insertion). L'insertion tombe entièrement dans la coquille (avant `if (hit)`), aucun
> impact sur l'architecture ou le contrat de ce Lot — seulement sur les numéros de ligne cités.

**a) La branche réelle `[VÉRIFIÉ]` par lecture intégrale de l'état actuel — L.669-757, 89 lignes, un
seul axe (type de l'attaquant), pas de sous-branche cachée.** Après résolution de l'opposition (jet
défense + `computeAttackRoll`, déjà propre, non touché ici) :
1. **Attaquant PJ** (L.670-708) — `armAwaitingDamage` (Lot 3) + recherche du socket attaquant +
   émission du prompt (`fetchSockets`, pattern différent des autres sites : cherche le socket par
   `user?.id`, pas par room), `suspendForDamage = true` (variable locale de la coquille, lue après le
   bloc `if(hit)`, doit rester lisible par la coquille — voir point c). `socket` peut être `null`
   (appelant `forceAdvanceResolution`, L.1034 — `[VÉRIFIÉ]` par grep, voir point e) : le repli
   `else if (socket)` ne s'exécute alors simplement pas, comportement déjà existant à préserver tel
   quel, pas une nouvelle garde à ajouter.
2. **Attaquant PNJ** (L.709-756) — `getEffectiveMeleeDamage` + `computeMeleeRawDamage` (Lot 5, codé et
   clos) + `damageService.resolveTargetHit` + émission + `applyStun` conditionnel.
   ~~Retour silencieux préexistant : `if (hitResult === null) return`~~ — **corrigé après vérification
   au cadrage du Lot 6 (2026-08-07), même piège que son scénario 6** : `[VÉRIFIÉ]` par lecture intégrale
   de `resolveTargetHit` (`damageService.js:296-310`), son seul `return null` est
   `if (cibleType === 'drone') return null` — or l'appel ici (L.722) passe `cibleType: 'pj'` en
   **littéral codé en dur**, jamais une variable, jamais `'drone'`. Le garde `if (hitResult === null)
   return` (L.728) est donc structurellement inatteignable par ce chemin, comme le scénario 6 du Lot 6
   l'était pour `resolveDroneAssaultHitPnj` — non détecté à la rédaction initiale de cette section car
   la même vérification (lire le corps entier de `resolveTargetHit`) n'avait pas été refaite ici,
   pourtant c'est la même fonction. **Erreur additionnelle et indépendante trouvée dans la version
   précédente de ce point** : même *si* ce chemin était atteignable, l'affirmation du point (f.4)
   ci-dessous (« `advanceTimeline` quand même appelé ensuite ») serait fausse — ce `return` est nu, à
   l'intérieur du `try` de `confirmMeleeDefense` elle-même, il sort de **toute la fonction**
   immédiatement, sautant l'étape 5 (`advanceTimeline`, L.763-765) qui vient après. Sans conséquence
   pratique tant que le chemin reste inatteignable, mais la description du comportement était
   erronée dans les deux sens (atteignabilité ET conséquence).

**b) Dispatch — guard clause simple, 2 branches seulement (pas de table).** Fonctions sœurs
`resolveMeleeDefenseHitAttackerPj(io, campaignId, ctx, emissions)` (retourne `{ suspendForDamage:
bool }`, seule fonction de ce Lot qui a besoin de retourner autre chose que rien, puisque
`confirmMeleeDefense` doit savoir si elle appelle `advanceTimeline` ensuite — point c) et
`resolveMeleeDefenseHitAttackerPnj(io, campaignId, ctx, emissions)` (void, comme les branches PNJ des
Lots 2/4). **Exhaustivité du binaire PJ/PNJ vérifiée à la source (analyse à charge)** : un attaquant
drone ne peut jamais atteindre `confirmMeleeDefense` — `socketCombatResolution.js:371` route déjà
`character.type === 'drone'` vers `resolveDroneAssaultAction`, jamais vers `resolveMeleeAction` (donc
jamais vers ce défenseur-PJ-suspend, `[VÉRIFIÉ]` par lecture directe du dispatcher, pas juste inféré de
`COMBAT_FLUX.md`). Limite pré-existante à noter, pas à corriger ici : `characters.type` est un enum
« extensible » (PC27, `docs/SYSTEME/COMBAT.md`) — un futur type `'vehicle'` tomberait dans la branche
`else` (PNJ) par défaut, comme c'est déjà le cas aujourd'hui avec ce binaire non exhaustif sur le
papier ; ce Lot préserve ce comportement existant à l'identique, n'introduit aucune régression.

**c) Différence de contrat avec Lots 2/4/6 — `suspendForDamage` doit remonter à la coquille, pas
seulement `{ suspend, emissions }`.** Contrairement aux fonctions extraites aux Lots 2/4/6 (retour
uniforme `{ suspend, emissions }` immédiatement consommé par l'appelant externe de la coquille),
`confirmMeleeDefense` n'est **pas** elle-même une branche qu'un autre appelant consomme de cette
façon — elle a sa propre logique après le bloc `if(hit)` (L.758 : `if (!suspendForDamage) { await
advanceTimeline(...) }`). La fonction sœur PJ doit donc retourner `{ suspendForDamage: true }`,
consommé explicitement par la coquille avant sa propre décision d'appeler `advanceTimeline`. Ne pas
copier aveuglément le contrat `{ suspend, emissions }` des Lots précédents ici — ce serait un mauvais
transfert de convention entre deux formes de fonction différentes (point relevé en analyse à charge
avant de figer cette section, pour ne pas répéter l'erreur déjà corrigée 2 fois dans ce document aux
§2.4/§2.6).

**d) Contexte à transporter — vérifié champ par champ contre l'usage réel des deux branches (analyse à
charge, aucun champ mort trouvé cette fois, contrairement au Lot 6).** `ctx` = sous-ensemble de
`pending` (déjà destructuré en tête de `confirmMeleeDefense`, L.569-581) + les valeurs calculées
localement nécessaires aux deux branches : `attackerTokenId, attackerCharacter, attackerUsername,
attackerColor, rollAttaque, chancesAttaque, mrAttaque, damageFormula, weaponInvId, modDom,
combatModeBonus, characterIdCible, char_sheet_id_cible, for_na_cible, con_na_cible, vol_na_cible,
targetName, userId, tokenId, meleeCampaignId` (renommage local de `campaignId` déjà présent dans la
fonction actuelle) + `socket` (fallback prompt PJ, point a — peut être `null`, préserver tel quel).
`rollAttaque`/`chancesAttaque` ne sont lus que par la branche PNJ (champ `roll`/`chancesDeReussite` de
`COMBAT_ATTACK_RESULT`) — présents dans `ctx` quand même, même convention que les Lots précédents (un
`ctx` partagé ne veut pas dire que chaque champ sert à chaque branche). Aucune clé de `pending` n'est
renommée — même règle que tous les lots précédents (payload persisté, §2.4.b).

**e) Contrat à préserver — 2 appelants re-vérifiés `[VÉRIFIÉ]` par grep cette session (pas seulement
hérités de §2.4.e comme l'affirmait la version précédente de ce point) :**
`socketCombatResolution.js:426` (handler `COMBAT_MELEE_DEFENSE_CONFIRM`) et
`socketCombatHelpers.js:1034` (`forceAdvanceResolution`, `forced:true`, `socket:null` — cohérent avec
le point a). Aucun des deux n'est affecté par une extraction interne à cette fonction (le Lot 7 ne
change ni sa signature ni son contrat externe). Aucune fonction extraite ne gagne de `try/catch` propre
(même invariant que §2.4.k/§2.6.d) — la propagation remonte au catch unique de `confirmMeleeDefense`
(L.767). **Ajout (analyse à charge, absent de la version précédente)** : aucune transaction ne protège
ces écritures — `[VÉRIFIÉ]`, même constat que §2.4.j/§2.6.d/§2.8.d (une seule `db.transaction(` dans
tout le fichier, sans rapport) — préserver le même ordre exact d'`await` dans chaque branche.

**f) Vérification — fixture jetable, même méthode que Lots 2/4/6.** Scénarios minimaux, **3** (le 4ᵉ de
la version précédente est retiré — corrigé 2026-08-07, voir point a.2 : `resolveTargetHit` ne peut pas
renvoyer `null` via ce chemin, `cibleType: 'pj'` y est un littéral codé en dur, pas une variable ;
construire un fixture pour ce scénario serait soit impossible sans trafiquer artificiellement le code
testé, soit trompeur — même conclusion que le Lot 6 scénario 6) :
1. Défenseur PJ confirme sa défense, touché par un attaquant PJ → prompt de dégâts émis,
   `suspendForDamage:true`, `advanceTimeline` **non** appelé par la coquille.
2. Défenseur PJ confirme sa défense, touché par un attaquant PNJ → dégâts auto-résolus,
   `advanceTimeline` appelé.
3. Défenseur PJ confirme sa défense, raté → aucune des deux branches, `advanceTimeline` appelé
   directement (déjà couvert par la coquille non modifiée).

Plus une session de jeu réelle Saar (au moins un cas attaquant PJ et un cas attaquant PNJ après
confirmation de défense) avant clôture.

**g) Recommandation de séquençage — Lot 5 avant Lots 6-7, sans être bloquant.** Si le Lot 5
(`computeMeleeRawDamage`) est codé en premier, les branches PNJ des Lots 6 (drone→PNJ, formule plus
simple, sans `modDom`/`combatModeBonus`, pas concernée par Lot 5) et 7 (attaquant PNJ, §2.9.b) naissent
directement sur le noyau au lieu d'une formule inline à corriger ensuite. Pas un blocage dur — si l'ordre
inverse est préféré, le Lot 5 devra juste relire l'emplacement à jour du site #4 (§2.7.a) après
extraction du Lot 7, pas un problème structurel, juste une note pour qui code.

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
| **Lot 4** | Branchement attaquant de `resolveAssaultAction` (§2.6) — extraction `resolveAssaultHitPj`/`resolveAssaultHitPnjDrone`/`resolveAssaultHitPnjNormal` (3 fonctions-feuilles sœurs, calcul commun `degautsBruts` remonté en coquille, §2.6.b) ; branches "raté" (PJ/PNJ) laissées inline (§2.6.b) | Moyen — écritures DB (`armAwaitingDamage`, `resolveDroneIntegrityLoss`, `damageService.resolveTargetHit`) et émissions `COMBAT_ATTACK_RESULT`/`COMBAT_ATTACK_PLAYER_RESULT`/`DICE_RESULT` ; vérification par fixture jetable (6 scénarios, §2.6.f), pas de shadow-mode possible | **✅ Clos (2026-07-28)** — diff relu ligne à ligne (code déplacé à l'identique, aucune clé renommée), `node --check` propre, 9 tests Lot 1 toujours au vert, puis confirmé en jeu par Saar (Tir PNJ touche une cible normale observé dans le log serveur, reste des scénarios confirmé globalement par Saar sans détail par cas) — committé. Trouvé en testant, sans rapport avec ce Lot : MELEE-ATKNAME (`docs/BUGIDENTIFIE.md`, fenêtre défense CaC affiche le nom du compte au lieu du personnage) |
| **Lot 5** | `computeMeleeRawDamage` (§2.7) — noyau pur dédupliquant `degautsBruts = rawDice + MR + modDom + combatModeBonus`, présent à 5 sites confirmés (`resolveDefenselessTarget`, `resolveMeleeDefensePnj`, `resolveMeleeDefenseDrone`, `confirmMeleeDefense`, `confirmDamage`) | Faible — comportement identique bit-à-bit (garde `?? 0` déjà toujours vraie aux 3 sites qui ne l'avaient pas, §2.7.a), pas d'écriture DB ni d'émission touchée, shadow-mode possible (fonction pure) | **✅ Clos (2026-08-06)** — 18 tests unitaires OK (`combatAttackRoll.test.mjs`), `node --check` propre, diff relu ligne à ligne (aucune clé renommée, import `getMrModifier` toujours utilisé par la branche Tir hors périmètre), session de jeu réelle Saar confirmée (« Enclume fonctionne, combat validé ») |
| **Lot 6** | Branchement cible de `resolveDroneAssaultAction` (§2.8) — extraction `resolveDroneAssaultHitDrone`/`resolveDroneAssaultHitPnj`/`resolveDroneAssaultHitPj`, même patron que Lots 2/4, ne viole pas F2 (extraction interne, pas de fusion inter-branches) | Moyen — écritures DB + émissions, vérification par fixture jetable (5 scénarios, §2.8.e), pas de shadow-mode possible | **✅ Clos (2026-08-07)** — `node --check` propre, 18 tests Lot 1/5 toujours au vert, diff relu ligne à ligne, fixture jetable durcie (6 scénarios dont 1 armure ajouté, 20 passes, 420 assertions, 0 échec, 0 résidu confirmé y compris nettoyage a posteriori de 2 campagnes orphelines d'essais antérieurs), session de jeu réelle Saar confirmée fonctionnelle |
| **Lot 7** | Branchement post-hit de `confirmMeleeDefense` (§2.9) — extraction `resolveMeleeDefenseHitAttackerPj`/`resolveMeleeDefenseHitAttackerPnj`, contrat de retour différent des Lots précédents (`suspendForDamage` remonté explicitement, §2.9.c) | Moyen — écritures DB + émissions, vérification par fixture jetable (3 scénarios, §2.9.f), pas de shadow-mode possible | **Planifié (2026-08-06), non codé** |

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
pas mélangé ici (`CLAUDE.md` §13, un plan = un problème). **Repris par le Lot 4 (§2.6, 2026-07-28).**

### 3.2 Ce que les Lots 5-7 ne résolvent pas — `confirmDamage` reste entièrement ouvert

`confirmDamage` (`socketCombatHelpers.js`, 247 lignes, jamais touchée par aucun lot) est la fonction la
plus dense des 5 relues le 2026-08-06 (`docs/JOURNALTEMP.md`, chantier réouvert) : FIFO dequeue
(`combat_pending`, plusieurs entrées possibles pour le même token) + branchement `pendingType ===
'melee'` vs `'assault'` (calcul de dégâts distinct par branche, formule Tir avec `modDegatsMode` au lieu
de `modDom`/`combatModeBonus` — pas la même duplication que le Lot 5, qui ne couvre que la branche
`melee` de cette fonction, §2.7.a site #5) + branchement cible drone/non-drone + jusqu'à 6 émissions WS
distinctes (localisation, Test de Chance bouclier, dégâts, message narratif, résultat final). **Pas de
découpage proposé ici** — mériterait sa propre analyse à charge (Phase 1/2 `METHODO_PLAN.md` dédiée)
avant de figer une architecture, plutôt qu'un découpage improvisé en fin de session sur les 3 lots
précédents. Candidate naturelle pour un **Lot 8**, à cadrer séparément quand Saar voudra enchaîner —
non bloquant pour les Lots 5-7 ci-dessus, qui ne touchent pas `confirmDamage` (sauf la branche `melee`
de son calcul de dégâts, couverte par le Lot 5 seul, §2.7.a).

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
  ~213/~261 lignes) — **mis à jour 2026-08-06** : `COMBAT_MELEE_DEFENSE_CONFIRM`
  (`confirmMeleeDefense`) désormais couvert par le Lot 7 (§2.9, branchement post-hit uniquement — le
  reste de la fonction, jet de défense + `computeAttackRoll`, était déjà propre). `COMBAT_DAMAGE_CONFIRM`
  (`confirmDamage`) reste entièrement hors périmètre — voir §3.2, candidate Lot 8 à cadrer séparément.
- INFRA-2 (généralisation du pattern `emissions[]`) — recoupe le Lot 3, décision à prendre à ce
  moment-là, pas ici. Toujours hors périmètre des Lots 5-7 (aucun ne touche à la forme des émissions,
  seulement au calcul de dégâts et au dispatch de branches déjà émettrices).
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
- **Testé (Lot 4)** : `node --check` propre, 9 tests Lot 1 toujours au vert, diff relu ligne à ligne
  (code déplacé à l'identique, aucune clé renommée) ; en jeu, le scénario « Tir attaquant PNJ touche
  une cible normale » est confirmé par le log serveur (§2.6.f cas 2) — les autres cas (§2.6.f 1, 3-6)
  n'ont pas de trace individuelle dans le log fourni, confirmés par Saar de façon globale (« ça a l'air
  bien ») sans détail scénario par scénario. Trouvé en testant, sans rapport avec ce Lot : MELEE-ATKNAME
  (`docs/BUGIDENTIFIE.md`).
- **Données** : aucune migration, aucun effet runtime en dehors du code déplacé.
- **Retour arrière** : chaque Lot est un commit isolé — `git revert` suffit, aucune donnée vivante
  affectée.

Les 4 lots de ce plan sont maintenant clos — tout gap architectural restant sur `resolveMeleeAction`/
`resolveAssaultAction` (INFRA-2, COM27, `COMBAT_DAMAGE_CONFIRM`/`COMBAT_MELEE_DEFENSE_CONFIRM`) reste
documenté §5, hors périmètre de ce document.

**Testé (Lot 5)** : 9 nouveaux tests ajoutés au bloc existant `combatAttackRoll.test.mjs` (bornes
`modDom`/`combatModeBonus` à 0/null/undefined, `mr` couvrant toute la table `MR_TABLE` de héroïque à
catastrophique, un cas réaliste par site) + `node --check` propre sur les 2 fichiers serveur touchés +
diff relu ligne à ligne (les 5 sites ne changent que leur ligne finale de calcul, aucune clé renommée,
`getEffectiveMeleeDamage` non touché) + session de jeu réelle Saar confirmée (2026-08-06, « Enclume
fonctionne, combat validé »). Placement `combatAttackRoll.js` confirmé (§2.7.b). **Nuance de méthode
notée en clôture** : le script d'équivalence jetable (5 sites, sans DB) réimplémente l'ancienne formule
en local plutôt que d'appeler le code réellement retiré (déjà supprimé au moment du script) — sa valeur
probante est plus faible que celle des tests unitaires et de la relecture du diff, qui restent la
vraie garantie de non-régression de ce Lot.

**Testé (Lot 6)** : `node --check` propre, diff relu ligne à ligne (aucune clé `ctx` renommée), fixture
jetable en base réelle durcie après relecture critique — 6 scénarios (5 prévus §2.8.e + 1 cible armurée
ajoutée), 20 passes avec vrais jets de dés, 420 assertions, 0 échec, 0 résidu (y compris nettoyage a
posteriori de résidu d'essais antérieurs au fixture final, sans rapport avec la validité du code) + jets
de dés couvrant naturellement l'éventail des scénarios sur 20 passes + session de jeu réelle Saar
confirmée fonctionnelle (tir drone → PNJ et → PJ).

**À valider à la clôture (Lot 7, §2.9)** : `node --check` propre, diff relu ligne à ligne, attention
particulière au contrat de retour `{ suspendForDamage }` (§2.9.c, différent des Lots précédents) — un
test manuel explicite que `advanceTimeline` n'est PAS appelé quand l'attaquant est un PJ (sinon
régression silencieuse du sous-état `AWAITING_DAMAGE`, même famille de bug que le correctif Session 165
déjà documenté §"Bug réel" de `docs/SYSTEME/COMBAT.md`) + 3 scénarios de fixture jetable (§2.9.f) +
session de jeu réelle (au moins un attaquant PJ et un attaquant PNJ après confirmation de défense).

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
