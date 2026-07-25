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
- **`docs/AUDIT_FABLE.md` RC1/INFRA-1** (2026-07-25) : `[VÉRIFIÉ]` re-mesuré à `resolveMeleeAction`
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

---

## 3. Découpage en lots — un seul problème par lot, validé avant le suivant

**Prérequis à tous les lots (§0.5)** : travail Session 176 validé en jeu et committé (ou mis de côté
par décision explicite de Saar). Worktree propre au démarrage de chaque lot.

| Lot | Contenu | Risque | Statut |
|---|---|---|---|
| **Lot 0** | Tables CaC/taille/portée → `shared/combatSituationMods.js` étendu (§2.1.a) : 3 sites serveur (melee/assault/drone) + 2 fenêtres client basculés, copies locales supprimées | Faible — valeurs inchangées, invariant « autorité unique des tables », vérifiable par simple comparaison des constantes | **Codé (2026-07-25)** — 23 valeurs vérifiées conformes par script, build Vite OK, syntaxe serveur OK ; ⚠️ en attente : vérif visuelle Saar des 2 fenêtres + démarrage serveur réel + décision commit (Session 176 toujours non committée sur le même fichier, §0.5) |
| **Lot 1** | Noyau `computeAttackRoll` (§2.1.b-d) + assemblage contributions dans les deux fonctions + shadow-mode (§2.3) + tests unitaires (§2.2) | Faible — comportement identique bit-à-bit, aucune écriture DB ni émission déplacée | Proposé, après Lot 0 |
| **Lot 2** | Extraire le branchement défenseur (PNJ auto-résolution CaC / drone / PJ sans-défense) en fonctions dédiées | Moyen — touche à des `await db(...)` et à la construction des émissions `COMBAT_MELEE_RESULT`/`COMBAT_ATTACK_RESULT` | Non commencé, à planifier après le Lot 1 |
| **Lot 3** | Orchestration DB/socket restante (`combat_pending`, `setFSMSubPhase`, `broadcastCurrentSubPhase`) | Élevé — recoupe RC2/BUG-1 (`docs/AUDIT_FABLE.md`), la cause probable du bug COM27 déjà documenté | Non commencé — **à ne jamais mélanger avec un correctif fonctionnel de COM27** ; si COM27 est corrigé avant ce Lot, ce Lot devra repartir du code déjà corrigé, pas l'inverse |

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
- **Non testé** : ce qui reste après le Lot en cours (Lots suivants du tableau §3) — marquer
  `⚠️ clos partiel` tant que les 4 Lots ne sont pas tous fermés.
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
