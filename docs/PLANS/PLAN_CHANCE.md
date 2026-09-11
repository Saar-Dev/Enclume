# PLAN_CHANCE.md — Plan technique : mécanique de dépense de points de Chance

> Version 2.0 — 2026-09-11 (réécriture complète, RAW fourni par Saar). **Remplace intégralement
> la v1 (2026-09-05)**, dont l'hypothèse d'architecture centrale (une réserve `chc_points`
> séparée du score) s'est révélée fausse à la lecture du RAW — voir `MANUEL_CHANCE.md` §1.
> Statut : cadrage terminé, prêt à coder sur validation Saar.
>
> Responsabilité unique : architecture technique (fichiers, services, séquencement). Ce document
> ne contient aucune règle métier — celles-ci sont dans `docs/MANUELS/MANUEL_CHANCE.md`, sourcé
> lui-même sur `docs/REGLES/REGLE_CHANCE.md` (RAW). Toute question « pourquoi ce coût / cet
> effet » se répond dans le MANUEL, jamais ici (Règle 9/10, `docs/RegleDocumentaire.md`).

---

## 1. Vue d'ensemble

**Périmètre V1** (détail et raisons : `MANUEL_CHANCE.md` §5) :
- Test de Chance générique (formule + modificateur signé)
- Dépense — Événement favorable (forçage combat), Réduction de gravité (Blessures grave+),
  Indice / Événement favorable narratif (mécanique minimale, zéro résolution)
- Régénération — Catastrophe (auto + choix joueur), Bonne idée / Accomplissement scénario
  (zéro dev, édition `chc` déjà existante)

**Hors périmètre V1** (rappel, détail `MANUEL_CHANCE.md` §3.5, §3.2-3.3) :
- Coup de pouce (+5, marge forcée à 0) — reporté V2, pas abandonné
- Test de groupe, modificateurs narratifs MJ — aucun consommateur identifié
- Mort subite, Maladies/poisons/drogues/irradiations — dépendances externes non résolues
  (mécanique de mort et domaine « États de santé » absents du projet)

**Débloque** : tir de suppression (`PLAN_AOE.md`), Test de Chance AOE longue/extrême portée
(écart RAW documenté dans `socketCombatAoe.js`), Usure & Intégrité Lot 2 — L8 (`ROADMAP.md`,
dépend de `resolveChanceTest`).

**Autorités** (invariant #3, `AGENTS.md`) : Livre de Base Polaris > `REGLE_CHANCE.md` >
`MANUEL_CHANCE.md` > ce PLAN. Une divergence entre ce PLAN et le MANUEL est un bug de ce PLAN.

---

## 2. L0 — Schéma : **aucune migration**

`char_sheet.chc` (migration `22_char_sheet.js:7`, `integer default 11`) reste tel quel — c'est
déjà la réserve dépensable, pas seulement le score (`MANUEL_CHANCE.md` §1). Aucune colonne
nouvelle.

Contrainte existante : uniquement applicative, `PUT /api/char-sheet/:characterId/chc`
(`char-sheet.js:497`, `1 ≤ chc ≤ 20`) — pas de `CHECK` en base. Suffisant : les services L2/L3
appliquent leurs propres gardes (`chc − coût ≥ 3` en dépense, `min(chc + n, 20)` en
régénération) au niveau applicatif, cohérent avec la route MJ existante. Rien à changer ici.

---

## 3. L1 — Primitive `resolveChanceTest` (shared, pure, testée)

Le Livre de Base p.201-205 est déjà couvert par une autorité unique marge/critique/Catastrophe :
`shared/polarisTestResolution.js#resolveTestOutcome(roll, seuil)` — fonction pure, un jet déjà
effectué contre un Seuil déjà calculé, retourne `{ isSuccess, isCriticalSuccess, isCriticalFail,
mr, catastropheRisk }`. Un Test de Chance **est** un Test comme un autre au sens de cette
fonction : `seuil = chc + modificateur`.

```js
// shared/polarisTestResolution.js — ajout
// resolveChanceTest(chc, roll, { modifier = 0 } = {}) → resolveTestOutcome(roll, chc + modifier)
// Enveloppe nommée, pas de réimplémentation — expose isSuccess/mr/catastropheRisk gratuitement,
// y compris le hook de régénération L3 (catastropheRisk) sans code Chance-spécifique.
```

Pas de nouveau fichier : `polarisTestResolution.js` est déjà l'autorité déclarée pour ce type de
calcul, et reste de taille raisonnable après cet ajout.

Test unitaire : étendre `shared/polarisTestResolution.test.mjs` (cas Chance : succès/échec,
modificateur positif/négatif, seuil ≥ 20).

**Bascule du premier consommateur** — Petit bouclier (`damageService.js:398-407`) : remplace le
jet manuel (`rollChance <= chanceThreshold`, sans modificateur) par un appel à
`resolveChanceTest`. Comportement observable inchangé (aucun modificateur appliqué aujourd'hui à
ce site) — même discipline que `resolveTargetLocations` pour l'AOE : le premier consommateur
prouve la primitive avant les suivants.

---

## 4. L2 — Service `chanceService.spendChancePoints`

Fichier neuf : `server/src/services/chanceService.js`, sur le modèle de
`server/src/services/integrityService.js` (DB pure, transactionnel, **aucune émission
socket** — l'appelant émet après succès, cf. `.claude/rules/core.md`).

```js
// spendChancePoints(db, charSheetId, n, { reason }) → { chc: nouveauScore }
// Garde : chc - n >= 3 (RAW : "descendu à 3 ne peut plus dépenser"). Rejette sinon.
// Décrémente char_sheet.chc directement, sous transaction (verrou contre dépense concurrente).
// n ∈ {1, 2} selon l'appelant — le service ne connaît pas la raison métier du montant.
```

Tests DB (`node --test`, nécessite `--env-file`, lancés par Saar) : garde refusée sous le
plancher, dépense concurrente sérialisée correctement.

---

## 5. L3 — Service `chanceService.grantChancePoint` + hook régénération Catastrophe

```js
// grantChancePoint(db, charSheetId, n = 1) → { chc: nouveauScore }
// Inverse de spendChancePoints — plafond min(chc + n, 20), sous transaction.
```

**Décision tranchée (Saar, 2026-09-11) : câblage système entier.** Une mécanique de Chance qui
ne fonctionnerait que « parfois » (uniquement en combat) serait incohérente en termes de game
design — soit elle s'implante partout où le RAW la prévoit, soit elle ne s'implante pas
(`MANUEL_CHANCE.md` §4.1). Le RAW du régénérateur « Être malchanceux » se déclenche sur **toute
Catastrophe (Marge d'échec ≥ 15) lors d'un Test aléatoire**.

Surface réelle, vérifiée : `resolveTestOutcome` a **5 points d'appel directs** côté serveur —
`combatAttackRoll.js`, `polarisTestService.js`, `socketCombatHelpers.js`, `socketEntity.js`,
`gmArbitratedTestService.js`. **S'y ajoute la primitive L1** : un Test de Chance est lui-même un
Test aléatoire au sens RAW (`REGLE_CHANCE.md` : « le Test à effectuer est un Test aléatoire
normal »), donc `resolveChanceTest` (qui passe par `resolveTestOutcome`) doit recevoir le même
hook — sinon on recrée exactement l'incohérence « ça marche partout sauf là » qu'on vient
d'écarter pour le combat/narratif. Concrètement : la bascule Petit bouclier (L1) et le Test de
Chance AOE (L4) sont aussi des points d'entrée du hook. Câblage contenu malgré tout : 5 sites
directs + les 2 consommateurs de `resolveChanceTest`, pas un sprawl.

**Aucune distinction PJ/PNJ (décision Saar)** : même câblage pour tout `char_sheet` qui a un
`chc`, sans garde `character.type`. Plus simple (rien à filtrer) et sans conséquence — un PNJ
jetable qui finirait à 20 en Chance avant d'être jeté ne change rien au jeu.

`grantChancePoint` reste **générique** (§5 : `+n`, plafond 20, aucune connaissance de la raison
métier — même principe que `spendChancePoints`). Le plafond RAW `chc < 15` n'est **pas** une
règle générale de tout regain (les futures régénérations « bonne idée »/« accomplissement »
n'ont que le plafond 20, pas 15), donc il ne vit pas dans `grantChancePoint` mais dans un point
d'entrée dédié à cette seule source.

Chaque site (direct ou via `resolveChanceTest`), quand `outcome.catastropheRisk === true` sur le
Test d'un personnage :
1. Propose le choix RAW au joueur : gagner 1 point de Chance **ou** relancer le Test à la place
   (mutuellement exclusif) — même famille de mécanisme et même pattern UI que le reroll déjà en
   place sur échec critique (`applyCriticalFailReroll`). **À vérifier au moment de coder ce
   lot, site par site** : chacun des 5+2 points d'appel a-t-il déjà une fenêtre de résultat
   synchrone où poser ce choix, ou faut-il en construire une (comme la fenêtre de décision AOE
   du L4) ? Pas supposé résolu ici — ce lot peut se révéler aussi large que L4 pour cette raison.
2. Si le joueur choisit le point : `chanceService.handleCatastropheRegen(db, io, charSheetId, {
   testLabel })` :

```js
// chanceService.handleCatastropheRegen(db, io, charSheetId, { testLabel }) :
// - si chc >= 15 : rien (RAW, pas de regain)
// - sinon : grantChancePoint(db, charSheetId, 1), puis poste la carte MJ (ci-dessous)
// Le choix joueur (étape 1 ci-dessus) a déjà eu lieu avant cet appel : cette fonction ne fait
// que le grant + la carte, jamais la relance — point d'entrée unique pour les 7 sites, logique
// de garde/carte écrite une seule fois.
```

**Garde-fou MJ (décision Saar) — réutilise un patron déjà construit et validé.** Le chantier
Usure & Intégrité a déjà livré exactement ce mécanisme pour la réparation (L6c, validé jeu réel
2026-09-10) : une carte d'action dans le chat du MJ, enregistrée par type de message dans le
`MessageRendererRegistry` (`repair_request: (msg, ctx) => <RepairRequestCard msg={msg}
ctx={ctx} .../>`, `client/src/components/RepairRequestCard.jsx`). Même patron ici : nouveau type
de message (ex. `chance_catastrophe_regen`), nouveau composant sur ce modèle (`useState` local,
gate `ctx.isGm`, un bouton **Annuler**). L'action cible l'événement précis (idempotente — pas un
décrément aveugle, au cas où plusieurs regains s'enchaînent) et appelle :

```js
// chanceService.cancelChanceGrant(db, charSheetId, n) → { chc }
// Revert d'un grantChancePoint automatique, initié par le MJ. Décrémente sans garde de
// plancher (§4) — distinct de spendChancePoints, réservé aux dépenses joueur.
```

Le libellé du Test (« Test de tir », « Test de Coordination »...) transite déjà dans les
événements existants (`DICE_RESULT`/équivalents à chaque site) — à réutiliser pour la carte, pas
de nouveau texte à inventer par site.

**Propagation temps réel de `chc` (Saar : « il faudrait remonter en temps réel »)** : pas
d'événement générique `char_sheet` dans le projet (vérifié, `shared/events.js`) — le patron
existant est que chaque événement socket qui porte déjà le résultat d'une action mutante
embarque directement les deltas nécessaires (les stores client se mettent à jour depuis ce
payload, jamais un rebroadcast séparé). `chc` suit le même principe : le delta voyage dans le
payload de l'événement combat déjà émis par le site concerné (résultat d'attaque, résolution de
dégât), pas un nouvel événement générique.

---

## 6. L4 — Forçage combat : Événement favorable

Consommateur immédiat : Test de Chance AOE longue/extrême portée (fusil à pompe, grenades —
`socketCombatAoe.js`, écart RAW déjà documenté dans le code : ces cibles subissent aujourd'hui le
dégât réduit sans aucune chance d'esquive).

**Point d'attention vérifié avant d'écrire ce lot** : la boucle de résolution AOE
(`socketCombatAoe.js`, `for (const ht of resolveTargets)`, ~L753-781) est aujourd'hui
**synchrone et atomique** — aucune pause n'existe pour qu'une cible décide quoi que ce soit avant
résolution. Donner à chaque cible le choix « forcer / tenter le Test » exige donc d'introduire un
vrai point d'attente dans cette boucle, pas un simple branchement de primitive.

**Design retenu (Saar)** : une fenêtre de décision envoyée **simultanément à toutes les cibles**
de l'AOE avant résolution — chaque PJ touché reçoit son propre prompt (forcer / tenter le Test) ;
les PNJ touchés sont **groupés sous le MJ** en une liste qu'il valide en un clic, comme le fait
déjà un joueur pour son propre personnage. Un clic de plus par Tour, uniquement dans le cadre
précis d'une AOE — accepté comme complexité raisonnable, pas un red flag comparable au piège
« N `armAwaitingDamage` FIFO » déjà écarté sur le tireur PJ AOE (celui-ci corrompait l'UI en
prétendant gérer N cibles avec un pipeline pensé pour 1 ; ici la fenêtre groupée est conçue pour
N dès le départ).

Flux : la couche 4 AOE (par cible, à partir de `ht.band`) ouvre cette fenêtre. Si la cible force
(appel à `spendChancePoints(db, charSheetId, 1, { reason: 'forçage AOE' })`, RAW « Événement
favorable » — remplace le Test), elle est retirée de `resolveTargets` sans jet. Sinon, Test de
Chance via L1 avec le modificateur normal (bonus de réussite / malus d'échec du Test de tir, `+5`
au palier extrême, déjà transcrit `REGLES_ARMES_SPECIALES.md`).

Détail à cadrer au moment de coder ce lot (pas dans ce PLAN) : comportement par défaut si un
joueur ne répond pas dans la fenêtre (timeout → Test normal, pas de forçage silencieux, cohérent
avec « pas d'optimisme » déjà posé en L6).

Le tir de barrage (`PLAN_AOE.md`, hors ce chantier) devient faisable une fois L1-L4 livrés, mais
n'est pas construit ici.

---

## 7. L5 — Réduction de gravité (Blessures)

Point d'accroche : après calcul de `finalSeverity`, avant persistance — flux de confirmation de
dégât PJ (`COMBAT_DAMAGE_PROMPT` / `CombatDamageWindow`).

`spendChancePoints(db, charSheetId, n, { reason: 'réduction gravité' })`, `n ∈ {1, 2}`, fait
descendre `finalSeverity` de `n` crans sur l'échelle `WOUND_SEVERITIES`
(`shared/woundConstants.js` : `legere < moyenne < grave < critique < mortelle`).

Gardes côté appelant (pas dans `spendChancePoints`, qui reste agnostique du « pourquoi ») :
- Déclenchable uniquement sur Blessure **grave, critique ou mortelle** (RAW — pas légère/moyenne).
- Exception RAW du palier plein (`MANUEL_CHANCE.md` §3.2) : si le palier cible n'a plus de case
  disponible, continuer à dépenser au-delà du plafond normal de 2 points.
- **Hors scope de ce lot** : le cas « Mort subite » (§9) — pas de palier au-delà de `mortelle`
  dans le moteur actuel, dépendance externe non résolue.

---

## 8. L6 — UI `<ChanceSpendButton>` + fenêtre narrative

Composant React réutilisable, visible si `chc − coût ≥ 3`. Jamais un composant par site
d'intégration (transversal, cf. doctrine déjà posée en v1 §3.4).

Deux branchements :
- **Mécanique** (résolution réelle, effet immédiat) : fenêtre de forçage AOE (L4), fenêtre de
  confirmation de dégât PJ (L5).
- **Narrative** (`MANUEL_CHANCE.md` §3.4, zéro résolution automatisée) : bouton générique
  « Utiliser sa Chance » avec un champ texte libre optionnel, décrémente 1 point et poste une
  note à l'attention du MJ. Canal exact à identifier au moment du lot — réutiliser un mécanisme
  de message/notification MJ existant plutôt qu'en créer un nouveau (à vérifier, pas supposé ici).

Reset/verrou : une dépense n'disparaît de l'UI qu'une fois confirmée côté serveur — pas
d'optimisme (principe déjà posé en v1, conservé).

Vérification transverse (`MANUEL_CHANCE.md` §6) : `chc` devient une valeur qui varie en cours de
séance — revérifier `CharacterSheet.jsx` et tout affichage dérivé pour s'assurer qu'aucun ne le
traite comme une valeur figée d'Attribut.

---

## 9. Hors-scope V1 (rappel, détail `MANUEL_CHANCE.md` §3.2, §3.3, §3.5)

| Usage | Raison |
|---|---|
| Coup de pouce (+5, marge forcée à 0) | Touche potentiellement le moteur générique de marge (`polarisTestResolution.js`) sur tout Test de Compétence/Attribut — cadrage séparé nécessaire. Reporté, pas abandonné. |
| Test de groupe / modificateurs narratifs MJ | Aucun consommateur identifié parmi les chantiers en attente |
| Mort subite | RAW complet (`REGLEBLESSURES.md`, seuil 30) mais aucune mécanique de mort de personnage dans le projet |
| Maladies/poisons/drogues/irradiations | RAW complet (`FATIGUE&DOMMAGES.md` p.244-249, 3 sous-systèmes) mais aucun compteur runtime existant |

---

## 10. Ordre d'implémentation recommandé

L0 (vérification, aucun code) → **L1** (primitive + bascule Petit bouclier, `node --test`) →
**L2** (`spendChancePoints`, tests DB) → **L3** (`grantChancePoint`/`handleCatastropheRegen`/
`cancelChanceGrant` + choix joueur + hook Catastrophe sur les 7 points d'entrée, + carte MJ) →
**L4** (forçage AOE, débloque l'écart RAW documenté) → **L5** (réduction de gravité Blessures) →
**L6** (UI, session Saar).

L3 est le lot le plus large (7 points d'entrée à instrumenter, dont la vérification/construction
d'une fenêtre de choix synchrone par site) — candidat naturel à un sous-découpage par site si
besoin au moment de coder (toujours un fichier à la fois).

Un fichier/service à la fois, pause avant le suivant (segmentation par fichier, convention du
projet) — même sur un lot déjà approuvé dans son ensemble.

---

## 11. Invariants respectés

- **Une propriété métier = une autorité unique** (invariant #3) : `char_sheet.chc` reste l'unique
  source de vérité (score et réserve confondus) ; `chanceService` l'unique point d'écriture
  mutante sur cette valeur.
- **Pas de logique métier dupliquée client/serveur** : `spendChancePoints`/`grantChancePoint`
  autoritaires côté serveur ; le client affiche et propose, jamais ne décide.
- **RAW ou décision écrite, jamais un raccourci silencieux** (invariant #5) : chaque exclusion de
  périmètre a sa raison tracée (`MANUEL_CHANCE.md` §3.2-3.3, §6 ; ce PLAN §9).

---

## 12. Décisions tranchées (2026-09-11)

- **Pas de colonne `chc_points`** — corrige et remplace l'hypothèse d'architecture de la v1
  (§3.1, 2026-09-05), fausse à la lecture du RAW.
- **Coup de pouce** → V2, reporté explicitement (charge sur le moteur générique de marge).
- **Indice / Événement favorable narratif** → V1, mécanique minimale (décision Saar : « le
  narratif, c'est juste une fenêtre pour expliquer que l'option existe, aucune résolution »).
- **Réduction de gravité — Mort subite / Maladies-poisons-drogues-irradiations** → hors périmètre
  V1, dépendances externes non résolues (RAW complet, moteur absent).
- **Régénération Catastrophe — câblage système entier** (5 sites `resolveTestOutcome` directs +
  2 consommateurs de `resolveChanceTest`, un Test de Chance étant lui-même un Test aléatoire RAW),
  pas limité au combat — cohérence de game design. Aucune distinction PJ/PNJ (même câblage pour
  tous, plus simple, sans conséquence). Choix joueur préservé (gagner le point ou relancer,
  mutuellement exclusif) avant tout regain — à vérifier/construire site par site (§5). Garde-fou :
  carte d'annulation MJ dans le chat, sur le patron déjà validé de `RepairRequestCard.jsx` (§5).
- **Forçage AOE (L4)** — fenêtre de décision simultanée à toutes les cibles (PJ individuel, PNJ
  groupés sous le MJ), pas un branchement trivial — accepté comme complexité raisonnable (§6).
- **Propagation `chc` en temps réel** — pas de nouvel événement générique ; le delta voyage dans
  le payload des événements combat déjà émis (§5).
