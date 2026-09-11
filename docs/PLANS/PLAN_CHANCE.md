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
socket** — l'appelant émet après succès, cf. `.claude/rules/core.md`). **Codé 2026-09-11** —
signature corrigée par rapport au pseudocode initial ci-dessous, alignée sur le patron réel
observé dans `integrityService.js`/`advantageService.js`/`mutationService.js` : `db` importé une
fois en haut du fichier (jamais passé en paramètre), `trxOpt` optionnel en dernier argument,
`sheetId` (pas `charSheetId`, seul nom utilisé ailleurs dans le projet).

```js
// spendChancePoints(sheetId, n, { reason }, trxOpt) → { chc, reason }
// Garde : chc - n >= 3 (RAW : "descendu à 3 ne peut plus dépenser"). Rejette sinon (AppError 400).
// Décrémente char_sheet.chc directement, sous transaction, verrou .forUpdate() (dépense concurrente
// sérialisée sur la ligne, patron pessimiste établi du projet — cf. integrityService.js).
// n ∈ {1, 2} selon l'appelant — le service ne connaît pas la raison métier du montant.
```

Tests DB écrits (`server/src/services/chanceService.test.mjs`, patron `advantageService.test.mjs`) :
dépense simple, garde refusée sous le plancher, dépense concurrente sérialisée. Lancés par Saar
(`node --env-file=... --test server/src/services/chanceService.test.mjs`) — pas encore exécutés.

---

## 5. L3 — Service régénération Catastrophe (sous-découpé 2026-09-11)

**Correction du postulat initial (exploration Explore agent, 2026-09-11)** : ce PLAN supposait
*"même pattern UI que le reroll déjà en place sur échec critique"* (ancienne version de ce §, cf.
git). Vérifié faux : `applyCriticalFailReroll` est appliqué **automatiquement côté serveur**, sans
aucune fenêtre de décision joueur (`polarisTestService.js:23-27`, `gmArbitratedTestService.js:
179-182`, `socketCombatHelpers.js:95`). Il n'existe **aucune fenêtre de décision synchrone joueur**
nulle part dans le projet actuel — la Catastrophe combat (`catastropheService.js`,
`maybeTriggerCatastrophe`) est arbitrée **MJ**, pas joueur, et gardée `isCombatActive` (donc
inutilisable telle quelle pour un hook système entier). Le choix RAW « gagner 1 Chance vs
relancer » est une **brique d'architecture neuve**, pas un branchement sur un patron existant —
d'où le sous-découpage ci-dessous (L3d isolé, seul morceau réellement nouveau).

| Sous-lot | Contenu | Dépend de |
|---|---|---|
| **L3a — codé 2026-09-11** | `chanceService.grantChancePoint` + `cancelChanceGrant` (patron `spendChancePoints`, DB pure, testée) | L2 |
| L3b | `chanceService.handleCatastropheRegen` (plafond RAW 15) | L3a |
| L3c | Carte MJ `chance_catastrophe_regen` (composant + `MessageRendererRegistry` + endpoint annulation), patron `RepairRequestCard.jsx` | L3b |
| L3d | Fenêtre de décision joueur (gagner/relancer), timeout → Test normal — **brique neuve**. **Décision Saar 2026-09-11 : la fenêtre se pose AVANT toute résolution/émission** (jet → si Catastrophe, pause → choix → un seul résultat final émis) — RAW "refaire son Test" (`MANUEL_CHANCE.md:141-142`) est un second jet complet qui remplace le premier, jamais un correctif après-coup visible par la table. Restructure le flux des 3 sites socket (aujourd'hui : jet → emit immédiat), pas un simple ajout. | indépendant |
| **L3e-1 — codé 2026-09-11** | Machinerie générique : table `pending_chance_choices` + `openChanceChoice`/`resolveChanceChoice` (patron `pending_catastrophes`/`resolvePendingCatastrophe`, idempotent `UPDATE...WHERE resolved_at IS NULL`, timeout détaché type `combatTurnEngine`) + carte PJ (filtre propriété, patron `repair_request`) + file MJ (copie `CatastropheReviewQueue.jsx`). `handleCatastropheRegen` (L3b) codé au passage — bloquant pour L3e-1, pas encore fait. Migration 336-338 appliquée (Saar, nodemon). 15/15 tests DB verts. `SITE_HANDLERS` vide (aucun site réel câblé, comportement existant inchangé). | L3d + L3b |
| **L3e-2 — codé 2026-09-11** | ~~`gmArbitratedTestService.js`~~ → **`socketEntity.js` poussée/traction** (revu après lecture réelle : `gmArbitratedTestService.js` est appelé depuis un second handler déjà en attente GM, imbriquer une 2e attente aurait été plus risqué). Refactor deux-phases : `finalizeEntityDisplacement` extraite (autorité unique, appelée immédiate OU différée), `SITE_HANDLERS.entity_displacement` enregistré au chargement du module. `ENTITY_MOVE_RESULT` ciblé via `io.to(socketId)` (pas `socket.emit`, le socket d'origine peut ne plus exister). Guard double-soumission ajouté (`context->>'entityId'`, patron `combat_pending`). **Validation navigateur bloquée** (2026-09-11, Saar) : impossible de placer des « Entités interactives » dans le world builder actuel — régression d'un chantier parallèle (world builder rework), pas liée à ce lot. Non re-testable tant que ce blocage externe n'est pas levé — décision Saar : laisser courir tel quel, priorité à L3e-4. | L3e-1 |
| **L3e-4a — codé 2026-09-11** | `socketCombatHelpers.js` / `resolveExoStandUpAction` (site combat le plus simple, cf. exploration ci-dessous — pas `AWAITING_CHANCE_CHOICE` finalement, `suspend:true` + timeout déjà existant suffit). `finalizeExoStandUp` + `SITE_HANDLERS.exo_stand_up`. Refactor annexe : `combatTimers`/`combatPreviews` déplacés de `socket/index.js` vers `combatTurnEngine.js` (cycle d'import évité). 22/22 tests DB verts. | L3e-1 |
| **L3e-4b — codé 2026-09-11** | ~~`resolveDroneAssaultAction`~~ → **`socketCombatExo.js` / `resolveExoAssaultAction`** (Tir exo, revu en cours de test : 2 sites hors inventaire initial découverts dans ce fichier, exploration précédente scopée à tort à `socketCombatHelpers.js` seul — `exo_melee` reste à faire). Munitions décomptées avant le choix (immédiat, comme convenu). `finalizeExoAssault` + `SITE_HANDLERS.exo_assault`. Nouveau helper partagé `flushDeferredEmissions` (`socketCombatHelpers.js`, exporté) — cible un joueur par recherche de socket (`userId`), pas un `socket.id` figé (`resolveExoAssaultAction` ne reçoit même pas `socket`) ; réutilisable par tout futur site combat. 39/39 tests DB verts. | L3e-4a |
| **L3e-4b-fusion — codé 2026-09-11** | **Fusion UI Catastrophe/Chance** (retour Saar après test réel : "aucun intérêt d'avoir deux fenêtres différentes" — `CatastropheReviewQueue.jsx` + `ChanceGmChoiceQueue.jsx` faisaient doublon côté MJ pour un PNJ). Migration 339 (`pending_chance_choices.linked_catastrophe_id`, FK → `pending_catastrophes`), `openChanceChoice` accepte `linkedCatastropheId`, les 2 sites déjà câblés (exo_stand_up, exo_assault) capturent le retour de `maybeTriggerCatastrophe` et le transmettent. Nouveau `CatastropheChoiceQueue.jsx` (remplace les 2 anciens, fusion dérivée au rendu par `linkedCatastropheId`, aucun état de "résolution partielle" à maintenir). `ChancePlayerChoiceCard.jsx` (PJ) inchangé — pas de doublon côté joueur (audiences déjà distinctes). 39/39 tests DB, build client OK. | L3e-4a/b |
| **L3e-4b-correctifs — codé 2026-09-11** | Deux bugs trouvés en test réel (post-fusion). **(a)** « Relancer » ne retirait pas la Catastrophe combat d'origine (RAW : "refaire son Test" remplace intégralement le Test, sa Catastrophe ne tient plus) — nouvelle `withdrawPendingCatastrophe` (`catastropheService.js`, patron `resolvePendingCatastrophe` sans appliquer d'effet), appelée automatiquement dans `resolveChanceChoice` quand `choice==='reroll'` et `linked_catastrophe_id` présent — un seul point central, pas dupliqué par site. **(b)** Timeout 45s "semblait arbitraire" (aucune indication visuelle) — migration 340 (`timeout_ms` persisté), `useChanceCountdown.js` (hook partagé), décompte affiché sur les deux cartes. 43/43 tests DB (dont 4 nouveaux), build client OK. | L3e-4b-fusion |
| L3e-4b-bis | `socketCombatExo.js` / `resolveExoMeleeAction` (CaC exo) — même fichier, même patron que exo_assault (+ capturer/transmettre `linkedCatastropheId`) | L3e-4b-fusion |
| L3e-4c | `socketCombatHelpers.js` / `resolveDroneAssaultAction` + `resolveAssaultAction` (tir humanoïde/drone) — munitions/panne d'arme restent immédiates, bifurcation PJ/PNJ après le jet à reproduire | L3e-4a |
| L3e-4d/e | `melee_defense` (`confirmMeleeDefense`) + `melee_attack` (`resolveMeleeAction`, ~570 lignes après le jet) — les deux plus gros, session dédiée probable | L3e-4c |

**L3f retiré (décision Saar, 2026-09-11) : pas de Catastrophe sur un Test de Chance, par
principe.** Annule la lecture RAW littérale ci-dessous ("un Test de Chance est lui-même un Test
aléatoire, donc `resolveChanceTest` doit recevoir le même hook") — `resolveChanceTest` (Petit
bouclier L1, futur Test de Chance AOE L4) ne déclenche jamais la régénération Catastrophe. Détail
§12.

Note hors-scope : `socketEntity.js` (poussée/traction) n'a aujourd'hui même pas le hook Catastrophe
combat (`maybeTriggerCatastrophe`) câblé — gap préexistant, séparé de ce chantier, non traité ici.

### L3a — codé et testé (`node --check` OK, tests DB écrits, exécution par Saar en attente)

```js
// grantChancePoint(sheetId, n = 1, trxOpt) → { chc }
// Inverse de spendChancePoints — plafond min(chc + n, CHC_CEIL=20). Clampe, ne rejette jamais.

// cancelChanceGrant(sheetId, n, trxOpt) → { chc }
// Revert MJ d'un grantChancePoint automatique. Clampe sur le même plancher RAW que
// spendChancePoints (CHC_FLOOR=3) mais NE REJETTE JAMAIS (spendChancePoints rejette parce que
// c'est un choix joueur refusable ; cancelChanceGrant est une correction MJ, toujours appliquée).
```

**Décision tranchée (Saar, 2026-09-11) : câblage système entier.** Une mécanique de Chance qui
ne fonctionnerait que « parfois » (uniquement en combat) serait incohérente en termes de game
design — soit elle s'implante partout où le RAW la prévoit, soit elle ne s'implante pas
(`MANUEL_CHANCE.md` §4.1). Le RAW du régénérateur « Être malchanceux » se déclenche sur **toute
Catastrophe (Marge d'échec ≥ 15) lors d'un Test aléatoire**.

Surface réelle, vérifiée : `resolveTestOutcome` a **5 points d'appel directs** côté serveur —
`combatAttackRoll.js`, `polarisTestService.js`, `socketCombatHelpers.js`, `socketEntity.js`,
`gmArbitratedTestService.js`. **Ne s'y ajoute PAS la primitive L1** : bien qu'un Test de Chance
soit un Test aléatoire au sens RAW (`REGLE_CHANCE.md`), Saar tranche par principe qu'aucune
Catastrophe ne se déclenche sur un Test de Chance — pas de récursivité mécanique (un Test qui
pourrait se regagner lui-même). `resolveChanceTest` (Petit bouclier L1, Test de Chance AOE L4)
reste donc hors du câblage L3. Décision §12.

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
1. **(L3d)** Propose le choix RAW au joueur : gagner 1 point de Chance **ou** relancer le Test à
   la place (mutuellement exclusif) — brique neuve, aucun patron UI existant à réutiliser (cf.
   correction en tête de §5). Comportement par défaut si le joueur ne répond pas dans la fenêtre :
   timeout → Test normal, pas de forçage silencieux (cohérent avec L4 §6).
2. **(L3b)** Si le joueur choisit le point : `chanceService.handleCatastropheRegen(sheetId, {
   testLabel }, trxOpt)` :

```js
// handleCatastropheRegen(sheetId, { testLabel }, trxOpt) :
// - si chc >= 15 : rien (RAW, pas de regain)
// - sinon : grantChancePoint(sheetId, 1, trxOpt), puis le caller (L3c) poste la carte MJ
// Le choix joueur (étape 1 ci-dessus) a déjà eu lieu avant cet appel : cette fonction ne fait
// que le grant, jamais la relance — point d'entrée unique pour les 7 sites, logique de garde
// écrite une seule fois. Ne poste pas la carte elle-même (L3c, côté appelant socket qui a `io`).
```

**(L3c) Garde-fou MJ (décision Saar) — réutilise un patron déjà construit et validé.** Le chantier
Usure & Intégrité a déjà livré exactement ce mécanisme pour la réparation (L6c, validé jeu réel
2026-09-10) : une carte d'action dans le chat du MJ, enregistrée par type de message dans le
`MessageRendererRegistry` (`repair_request: (msg, ctx) => <RepairRequestCard msg={msg}
ctx={ctx} .../>`, `client/src/components/RepairRequestCard.jsx`). Même patron ici : nouveau type
de message (ex. `chance_catastrophe_regen`), nouveau composant sur ce modèle (`useState` local,
gate `ctx.isGm`, un bouton **Annuler**). L'action cible l'événement précis (idempotente — pas un
décrément aveugle, au cas où plusieurs regains s'enchaînent) et appelle :

```js
// cancelChanceGrant(sheetId, n, trxOpt) → { chc }
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
- **Pas de Catastrophe sur un Test de Chance, par principe** (Saar, 2026-09-11) — annule la
  lecture RAW littérale initiale de L3 (§5). Retire le sous-lot L3f : `resolveChanceTest` (Petit
  bouclier L1, Test de Chance AOE L4) ne déclenche jamais `handleCatastropheRegen`. Seuls les 5
  points d'appel directs de `resolveTestOutcome` portent le hook (L3e).
- **Plancher Chance = 3, contrainte unique** (Saar, 2026-09-11) — pas de plancher distinct pour
  l'annulation MJ. `spendChancePoints` REJETTE (choix joueur refusable) ; `cancelChanceGrant`
  CLAMPE sur le même plancher sans jamais rejeter (correction MJ, toujours appliquée). §5/L3a.
