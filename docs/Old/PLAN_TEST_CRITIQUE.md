# PLAN — Résolution des Tests : Réussite/Échec critique par marge (pas par valeur de dé)

> Statut (2026-08-04) : **Lot 1 (RAW everywhere, refonte architecturale) ✅ clos, confirmé fonctionnel
> en jeu par Saar** — détail §9. **Lot 2 (bonus de maîtrise/moitié d'AN sur Réussite critique) ✅ codé,
> non testé en navigateur** — détail §10. **Lot 3 (tooltips explicatifs + popup Réussite
> critique/Catastrophe) ✅ codé, non testé en navigateur** — détail §11. Décision de principe (§4) :
> **règle RAW partout, pas de toggle de campagne** — l'hypothèse du toggle `marge`/`fixe` envisagée en
> cadrage v1 est abandonnée.
> Document temporaire (`docs/RegleDocumentaire.md` Règle 10) — à archiver dans `docs/Old/` une fois
> les Lots 2/3 clos ou explicitement abandonnés, contenu durable à transférer vers
> `docs/SYSTEME/COMBAT.md` à ce moment-là.
> Source : Livre de Base Polaris p.203-204, table "Marges & modificateurs de réussite et d'échec"
> (§2, table confirmée par capture d'écran fournie par Saar le 2026-07-30) et prose p.204-205
> ("Réussites et échecs critiques", "Catastrophes (optionnel)", "Chances de réussite supérieures à 20").

---

## 1. Origine et périmètre

Trouvé en codant `wound_infection_check` (Blessures) : `server/src/lib/polarisTestService.js`
(`resolvePolarisTest`, clos "✅" plus tôt dans la même session) définit la réussite critique comme
`roll === 1` et la Catastrophe comme `roll === 20` — une règle **extraite telle quelle** de
`MACRO_ROLL`/`socketDice.js`, présentée comme "la règle absolue Polaris" sans avoir été vérifiée
contre le Livre de Base à ce moment-là.

Saar (2026-07-30) : *"une catastrophe n'est PAS un 20 sur un d20 mais une marge de réussite"* — la
vraie règle RAW détermine réussite/échec critique par la **marge** (écart entre le jet et le Seuil),
pas par la valeur brute du dé. Un jet de 20 contre un Seuil élevé peut n'être qu'un échec ordinaire ;
un jet bien inférieur à 20 peut être catastrophique si le Seuil visé était bas.

**Ce n'est pas une correction locale.** `roll === 1`/`roll === 20` est le patron déjà en place dans
le combat livré et testé, pas une invention de cette session — trouvé en au moins 6 fichiers
(§3). Périmètre réel : refonte de la résolution des Tests critiques dans tout le projet, avec un
garde-fou de compatibilité (§4, toggle de campagne) pour ne pas casser le combat existant pendant la
transition.

**Hors périmètre de ce document** : tout le reste de `docs/PLAN_BLESSURES_GUERISON.md`/
`PLAN_FATIGUE_DOMMAGES.md` continue en parallèle ou en pause selon décision de Saar (§7) —
`wound_infection_check` consomme `resolvePolarisTest` comme une boîte noire (seuil en entrée,
`isSuccess`/`isCriticalSuccess`/`isCriticalFail` en sortie) et héritera de la correction sans rien
changer de son côté, tant que la signature de la fonction reste stable.

---

## 2. La table RAW — confirmée (LdB p.203-204)

Deux captures fournies par Saar (2026-07-30, table complète + prose environnante) — plus aucune
valeur incertaine.

**MARGES & MODIFICATEURS DE RÉUSSITE ET D'ÉCHEC**

| Marge | Degré de réussite | Mod. réussite | Degré d'échec | Mod. échec |
|---|---|---|---|---|
| 1-2 | De justesse | +0 | De justesse | +0 |
| 3-4 | Correct | +1 | Médiocre | -1 |
| 5-6 | Assez bon | +2 | Assez mauvais | -2 |
| 7-9 | Bon | +3 | Mauvais | -3 |
| 10-12 | Très bon | +4 | Très mauvais | -4 |
| 13-14 | Excellent | +5 | Exécrable | -5 |
| 15-19 | Parfait | +6 | Catastrophique * | -6 |
| 20-24 | Extraordinaire | +7 | Catastrophique * | -7 |
| 25-34 | Héroïque | +8 | Catastrophique * | -8 |
| 35+ | Légendaire | +9 | Catastrophique * | -9 |

`* Risque de Catastrophe` — confirmé non automatique (§ "CATASTROPHES (OPTIONNEL)", p.204) : décision
MJ, jamais forcée par le moteur.

**Sens de la marge, confirmé par le texte (p.203), pas symétrique** :
- **Marge de réussite = le résultat du dé, lu directement** ("il faut donc obtenir le jet de dé le
  plus haut possible, en dessous de ses chances de réussite"). **Pas** `seuil − roll`.
- **Marge d'échec = roll − seuil** (le nombre de points au-dessus du Seuil). Celle-là était déjà
  juste dans le code existant.

Implémenté dans `shared/polarisTestResolution.js` (`resolveTestOutcome`), seule autorité — voir §9.
L'ancien `mr: seuil - rollAttaque` de `combatAttackRoll.js` (préexistant, nommé "MR") appliquait la
formule d'échec aux deux côtés — juste par coïncidence pour l'échec, faux pour la réussite. C'est la
cause racine du chantier (§1).

---

## 3. Fondations et casse existante

| Élément | Rôle | Fichier |
|---|---|---|
| `resolvePolarisTest(threshold)` | Résolveur de Test générique — à corriger, actuellement `roll===1`/`roll===20`. Point d'entrée déjà partagé par `MACRO_ROLL` et par le futur `wound_infection_check`. | `server/src/lib/polarisTestService.js` |
| `computeAttackRoll` | Noyau pur du jet d'attaque combat — calcule déjà `mr: seuil - rollAttaque` (marge), mais ne s'en sert pas pour déterminer critique/Catastrophe, seulement `isSuccess`. | `server/src/lib/combatAttackRoll.js` |
| `dice_config` (campagne) | Réglage existant de plages critiques **par valeur brute de dé** (`{success:{min,max}, fail:{min,max}}` par type de dé) — précédent de "réglage de campagne pour la résolution des critiques", mais structurellement incompatible avec une règle par marge (la marge dépend du Seuil visé, pas seulement du dé). Ne pas réutiliser tel quel — nouveau réglage nécessaire (§4). | `server/src/routes/campaigns.js` (`validateDiceConfig`), consommé par `socketDice.js` (`DICE_ROLL`, pas `MACRO_ROLL`) |
| Patron `roll === 1`/`roll === 20` déjà en production | Trouvé par grep, liste non exhaustive — chaque site à auditer avant migration, pas à tout changer d'un coup (`CLAUDE.md` §6.8, un problème à la fois une fois qu'on sait ce qu'on corrige). | `socketCombatHelpers.js` (au moins L.609, 1471, 1759), `socketDice.js`, `socketEntity.js`, `losService.js`, `statusService.js`, `socketCombatState.js` |

---

## 4. Décision finale (2026-07-30) — RAW partout, pas de toggle

Le cadrage v1 envisageait un réglage de campagne à deux valeurs (`marge` RAW / `fixe` héritage) pour
ne pas casser le combat existant. **Tranché par Saar une fois la vraie règle confirmée : RAW partout,
sans toggle.** Aucun réglage de campagne ajouté — `roll===1`/`roll===20` est retiré partout, pas
seulement rendu optionnel.

---

## 5. Modèle de données — implémenté (§9)

- Table de marge → `shared/polarisTestResolution.js` (`MR_TABLE`), pas `polarisUtils.js` — nouveau
  fichier dédié plutôt qu'ajout au fichier générique existant, le domaine "Résolution des Tests"
  (RAW p.201-205) étant assez dense pour mériter sa propre responsabilité unique.
- **`polaris_mr` (DB, migration 46) retirée de la lecture runtime** — donnée RAW statique jamais
  éditée en jeu (aucune route ne l'exposait), même statut que `AN_TABLE`/`RD_TABLE` déjà en constante
  pure. Élimine au passage le cache de promesse fragile (`mrTable.js`, limitation connue A13) et le
  round-trip DB à chaque résolution de dégâts/déplacement. Table DB laissée en place, inerte (pas de
  migration de suppression dans ce Lot — prudence fusion, retrait différé).
- Pas de réglage de campagne (§4) : `resolveTestOutcome(roll, seuil)` reste une fonction pure sans
  paramètre de configuration.

---

## 6. Points ouverts — tous répondus (2026-07-30)

1. **Tranche de Catastrophe** — ≥15 (marge d'échec), jamais automatique (décision MJ). Réponse : §2.
2. **Jet naturel de 1** — aucun statut spécial. Réussite critique = `roll === seuil final` (ou
   `roll === 20` si `seuil ≥ 20`, cas spécial p.205). Implémenté dans `resolveTestOutcome`.
3. **Sens de la marge** — pas symétrique : réussite = `roll` direct, échec = `roll - seuil`. Réponse
   détaillée en §2 (confirmé faux dans ma première hypothèse, l'écart avec `mr` existant était la
   cause racine).
4. **Cases vides** — complétées, table §2.
5. **Portée de la refonte** — tranchée par Saar (audit demandé) : les 6 sites combat identifiés + tout
   ce qui existait (Test de Choc exclu après lecture — mécanique à 2 seuils graduée, structurellement
   différente, §7 ; programmes drone inclus ; `dice_config`/`DICE_ROLL` laissé en l'état, mécanique
   distincte des Tests contre un Seuil). Détail complet de l'audit et de l'implémentation en §9.
6. **Toggle de campagne** — abandonné, RAW partout (§4).
7. **`docs/VOCABULARY.md`** — entrée ajoutée (§9).

---

## 7. Séquencement avec Blessures

`docs/PLAN_BLESSURES_GUERISON.md` (Lot 2 + handlers `wound_healing_check`/`wound_infection_check`)
n'est **pas bloqué** par ce chantier : `wound_healing_check` (codé, testé, ne jette jamais de dé —
discrétion MJ pure, §3.2 du plan Blessures) est indépendant. `wound_infection_check` (pas encore codé)
appelle `resolvePolarisTest(threshold)` sans connaître son fonctionnement interne — il héritera de la
correction automatiquement, sans modification de son côté, une fois ce chantier clos. Saar tranche
librement s'il veut reprendre Blessures en parallèle ou attendre — aucune dépendance technique dans un
sens ou dans l'autre.

---

## 8. Validation — réalisée (§9)

Voir §9 pour le détail Testé/Non testé. Le scénario navigateur réel reste à faire par Saar (non testé
côté agent, pas d'accès navigateur).

## 9. Clôture Lot 1 (2026-07-30)

**Architecture** — nouveau noyau pur partagé `shared/polarisTestResolution.js` :
`resolveTestOutcome(roll, seuil)` (marge/critique/Catastrophe, autorité unique), `applyCriticalFailReroll`
(retest d'Échec critique — le noyau ne peut pas le faire lui-même, pas d'I/O dans une fonction pure),
`MR_TABLE`/`getMrModifier` (ex-DB `polaris_mr`, désormais constante statique). `combatAttackRoll.js`
et `polarisTestService.js` délèguent tous les deux à ce noyau — plus aucune copie locale de la règle.

**Sites corrigés** : `polarisTestService.js` (`resolvePolarisTest`, consommé par `MACRO_ROLL` et le
futur `wound_infection_check`) ; les 4 sites combat CaC/Tir de `socketCombatHelpers.js`
(`resolveMeleeAction`, `confirmMeleeDefense`, `resolveMeleeDefensePnj`, `resolveAssaultAction`) et
leurs branches associées (`resolveDefenselessTarget`, `resolveMeleeDefenseDrone`, `confirmDamage`) ;
`resolveDroneAssaultAction` (programmes drone, intégré sur demande explicite de Saar) ; `socketEntity.js`
(poussée/traction — seule la formule de marge corrigée, aucune règle de critique ajoutée, aucune
décision prise en ce sens). Import mort `getMrTable`/`getModifier` retiré de `socketCombatResolution.js`
au passage (jamais appelé dans ce fichier).

**Exclu explicitement** : Test de Choc (`statusService.js:resolveShockTest`) — mécanique à deux seuils
graduée (ok/étourdi/inconscient), pas un Test binaire contre un seuil unique, le concept de marge/
critique ne s'y applique pas structurellement. `dice_config`/`DICE_ROLL` (jets libres non liés à un
Seuil) — mécanique distincte, hors périmètre RAW de ce chantier.

**Trouvaille non traitée, notée pour triage** : `resolveTargetHit`/`confirmDamage` a un Test de Chance
(Petit bouclier, `rollChance`/`chanceThreshold`) avec `isCriticalSuccess/isCriticalFail` figés à `false`
— structurellement un vrai Test binaire (candidat à `resolveTestOutcome`), découvert en implémentant,
non ouvert dans cette session (pas dans le périmètre discuté avec Saar) — à ajouter à
`docs/BUGIDENTIFIE.md` ou trancher séparément.

**Testé** : `node --check` propre sur les 8 fichiers touchés ; `shared/polarisTestResolution.test.mjs`
(13 tests, bornes marge/critique/Catastrophe/seuil≥20/retest), `combatAttackRoll.test.mjs` (9 tests,
réécrit), `polarisTestService.test.mjs` (8 tests, réécrit) — 29/29 verts ; suite de régression complète
`shared/*.test.mjs` (347/347) et `server/src/lib`+`server/src/services` sans dépendance DB (44/44)
toujours verts après la refonte — aucune régression détectée en dehors du périmètre attendu.

**Scénario réel en navigateur confirmé fonctionnel par Saar** (2026-07-30) — combat CaC/Tir/drone,
dégâts, Réussite/Échec critique. **Non testé** : suites `*.test.mjs` nécessitant une DB
(echeanceService, gameTimeService, woundEvolutionService, woundUtils, migrations) non relancées —
aucune dépendance avec ce chantier, hors périmètre.

**Données** : aucune migration. `polaris_mr` (DB, migration 46) laissée en place mais plus lue par le
code — retrait de la table différé à un cleanup séparé, par prudence de fusion.

**Retour arrière** : purement additif/substitutif sur du code non encore committé cette session
(`mrTable.js` supprimé, mais rien d'autre supprimé) — `git diff`/`git checkout` suffisent, pas de tag
nécessaire avant le premier commit de ce chantier.

**Prochaine étape** : validation navigateur par Saar, puis Lot 2 (bonus de maîtrise/moitié d'Attribut
sur Réussite critique) ou Lot 3 (tooltips) selon décision de Saar.

---

## 10. Clôture Lot 2 (2026-07-31) — bonus de maîtrise/moitié d'AN sur Réussite critique

**RAW (p.204, "RÉUSSITE CRITIQUE")** : sur une Réussite critique (roll===seuil final), on ajoute à la
Marge de réussite le niveau de maîtrise de la Compétence testée (« et non le niveau global ») ; pour
un Test d'Attribut seul (« qui n'a pas de niveau de maîtrise »), on ajoute la moitié du niveau de
l'Attribut testé. Augmente uniquement la Marge de réussite, jamais le résultat du dé ni le fait que le
Test soit réussi. Application automatique décidée avec Saar (2026-07-31) — rien dans le texte
n'indique une option MJ, contrairement aux Catastrophes (encadré "OPTIONNEL" explicite).

**« Moitié de l'Attribut »** : aucune règle RAW écrite pour départager AN (Aptitude naturelle, table
p.114) vs NA (niveau brut). Décision Saar/Claude (2026-07-31, vérifiée contre `docs/REGLES/ATTRIBUTS.md`
avant de trancher) : **AN**, seule conversion RAW confirmée d'un Attribut en score de Test (base d'une
Compétence = AN1+AN2) — un demi-NA (6-7 pour un FOR 13) dépasserait l'échelle de la table de marge,
un demi-AN (1-3) y reste cohérent.

**Architecture** — autorité unique centralisée dans `shared/polarisTestResolution.js` :
`getCriticalSuccessBonus({ masteryLevel, attributeAN })` (choisit la formule RAW selon le type de Test
reçu) + `applyCriticalSuccessBonus(outcome, bonus)` (applique le bonus déjà résolu au `mr`). Aucun site
appelant ne recalcule `Math.floor(AN/2)` ou ne lit `.mastery` pour en décider lui-même — même principe
que `resolveTestOutcome`/`MR_TABLE` au Lot 1.

**Sites branchés** :
- `socketEntity.js` push/pull (`ENTITY_MOVE_REQUEST`) — corrige au passage une divergence RAW
  préexistante (Session 40-43) : le seuil utilisait le NA brut de l'Attribut, pas l'AN. Aucune règle
  RAW dédiée à la poussée/traction (confirmé par Saar) : suit la logique générale du LdB plutôt qu'une
  échelle inventée.
- `socketEntity.js` `ENTITY_ACTION_RESOLVE` (interactions génériques Compétence/Attribut) — ce site
  n'avait **jamais** eu de détection Réussite/Échec critique (hors périmètre de l'audit Lot 1, isSuccess
  calculé à la main). Amené au même niveau RAW que le reste du projet dans le même geste (retest
  d'Échec critique inclus), pas seulement le bonus du Lot 2.
- `socketCombatHelpers.js` — CaC (`resolveMeleeAction` + 4 branches défenseur : PJ synchrone, PJ
  asynchrone via `combat_pending`, PNJ, drone) et Tir (`resolveAssaultAction`). Trouvaille structurelle
  en cours de route : `mrAttaque` était recalculé à neuf (`resolveTestOutcome(rollAttaque,
  chancesAttaque)`) dans 4 fonctions en aval de l'attaque CaC (dégâts + comparaison Attaque/Défense) —
  un bonus appliqué seulement au jet initial n'aurait jamais atteint ni les dégâts ni la comparaison.
  Corrigé en threadant `mrAttaque` (déjà résolu, bonus inclus) via `commonPending`, plus aucun recalcul
  aval. Même chose pour la maîtrise du défenseur (`defenderMastery`, threadée jusqu'à
  `confirmMeleeDefense`). Le Tir n'avait pas ce problème (architecture déjà centralisée sur un seul
  `mr`).
- `resolveDroneAssaultAction` — décision Saar : `programme.level` (seule valeur du drone, pas de
  Compétence/Attribut RAW pour ce type de personnage) tient lieu de niveau de maîtrise.
- `polarisTestService.js` (`resolvePolarisTest`) — nouveau paramètre optionnel `criticalSuccessBonus`
  (défaut 0, aucun changement de comportement pour les appelants qui ne le passent pas :
  `WOUND_INFECTION_ROLL`, `fallDamageService.js`, `fatigueService.js`, `campaigns.js` — Tests
  environnementaux sans Compétence/Attribut identifiable, hors périmètre de ce Lot).
- `socketDice.js` (`MACRO_ROLL`) — bonus appliqué seulement si la macro se réduit à exactement une
  source Compétence (xor) une source Attribut (décision Saar 2026-07-31) : une macro perso peut
  cumuler jusqu'à 3 sources libres (`DicePanel.jsx`) sans que cela corresponde à un vrai Test RAW à
  Compétence/Attribut unique — aucune règle de cumul inventée pour les macros composites, elles restent
  simplement sans bonus. Corrige au passage la même divergence NA/AN que push/pull : une source de type
  `attribute` utilisait `calcAttributeNA` au lieu de `calcAttributeAN` comme seuil direct (les formules
  dérivées `secondaryValue` — REA, Seuils, Résistances — restent sur NA, RAW explicite sur ce point,
  `ATTRIBUTS.md:101`).

**Testé** : `node --test shared/*.test.mjs` (254/254, dont 15 nouveaux/modifiés sur
`polarisTestResolution.test.mjs`), `node --test server/src/lib/*.test.mjs` (38/38 hors 60 skip DB,
inchangé), `node --check` propre sur les 6 fichiers serveur touchés.
**Non testé** : scénario réel en navigateur (CaC/Tir/drone/push-pull/interactions/macro avec Réussite
critique) — à la charge de Saar.
**Données** : aucune migration.
**Retour arrière** : purement additif/substitutif, rien encore committé — `git diff`/`git checkout`
suffisent.
**Prochaine étape** : Saar teste en navigateur (viser un jet dont le résultat tombe pile sur le seuil,
via macro ou en ajustant temporairement les stats, pour provoquer une Réussite critique observable) ;
puis Lot 3 (tooltips) ou clôture du chantier.

---

## 11. Clôture Lot 3 (2026-08-04) — tooltips explicatifs + popup Réussite critique/Catastrophe

**Tooltips degré (LdB p.203-204)** : `MR_TABLE` (`shared/polarisTestResolution.js`) porte désormais une
`key` par palier (pas de texte — `deJustesse`, `correct`, `assezBon`, `bon`, `tresBon`, `excellent`,
`parfait`, `extraordinaire`, `heroique`, `legendaire` côté réussite ; `deJustesse`, `mediocre`,
`assezMauvais`, `mauvais`, `tresMauvais`, `execrable`, `catastrophique` côté échec — `deJustesse`
partagé, même mot des deux côtés). Nouvelle fonction `getMrDegreeKey(mr)`, même pattern que
`getMrModifier`. Résolu en FR uniquement côté client (`combat.json` §`degree.*`), le serveur continue
de ne transmettre que `mr` brut (déjà présent dans les payloads `DICE_RESULT` avant ce Lot, jamais lu
côté client jusqu'ici). `Sidebar.jsx` : `title=` (tooltip natif, même pattern que les boutons
"Détail du calcul"/"Jet au MJ" déjà présents) sur le badge de résultat "déplacement" et le badge
"skillcheck"/combat générique, format `Degré (+modificateur)`. Exclu : Test de Choc (`cardType ===
'shock_test'`, mécanique à deux seuils, pas de degré RAW applicable — §9), macros (le serveur
n'envoie pas `mr` pour `MACRO_ROLL_RESULT`) et `/roll` libre (hors périmètre RAW du chantier entier,
§9).

**Trouvaille en cours de route** : `cardType` (envoyé par le serveur pour `shock_test`/`drone_damage`,
`statusService.js:229` et `socketCombatHelpers.js:2304`) n'était jamais forwardé par
`onDiceResult` (`useSessionSocket.js`) vers le message stocké, alors que `Sidebar.jsx` le lisait déjà
(`msg.cardType`) pour choisir le libellé de détail — dead code silencieux préexistant, pas introduit
par ce Lot. Corrigé au passage (même destructure que l'ajout de `catastropheRisk`) : condition
nécessaire pour que la garde `shock_test` du tooltip fonctionne réellement.

**Popup Réussite critique/Catastrophe** — décision Saar (2026-08-04) : texte seul pour l'instant
("Réussite critique" / "Catastrophe"), architecture pensée pour qu'un futur vrai effet visuel ne
remplace que le rendu, jamais le déclenchement. `sessionStore.js` porte l'état (`criticalEffect:
{ kind, id }`, un seul à la fois v1) + actions `triggerCriticalEffect`/`clearCriticalEffect`.
`useSessionSocket.js` déclenche sur `isCriticalSuccess` (`onDiceResult` ET `onMacroRollResult`, cette
dernière n'ayant pas `catastropheRisk` côté serveur — Catastrophe non câblée sur les macros, non
demandé) ou `catastropheRisk` (`onDiceResult` uniquement, priorité à la Réussite critique si les deux
étaient vrais — structurellement exclusif, `resolveTestOutcome` ne renvoie jamais isSuccess et
!isSuccess ensemble). Nouveau `CriticalEffectOverlay.jsx`, monté une fois dans `SessionPage.jsx`
(bannière plein écran, ~2,2s, `prefers-reduced-motion` respecté). Libellé "Catastrophe" choisi par
Saar en connaissance de cause — signalé avant codage que le RAW p.204 ("CATASTROPHES (OPTIONNEL)")
traite la Catastrophe comme une décision MJ, jamais automatique ; le popup se déclenche en réalité sur
`catastropheRisk` (le risque existe), pas sur une Catastrophe confirmée par le MJ.

**Testé** : `node --test shared/polarisTestResolution.test.mjs` (20/20, dont les 8 nouveaux cas
`getMrDegreeKey`) ; `node --check` sur `polarisTestResolution.js` ; `combat.json` validé JSON ;
`eslint` propre (0 erreur) sur les 5 fichiers `.jsx`/`.js` client touchés — seuls avertissements
`react-hooks/exhaustive-deps` déjà présents avant ce Lot (dépendances manquantes préexistantes dans
`useSessionSocket.js`/`SessionPage.jsx`, non retouchées, hors périmètre) ; `vite build` complet sans
erreur.
**Non testé** : scénario réel en navigateur (tooltip au survol, popup Réussite critique/Catastrophe en
combat et via macro) — à la charge de Saar.
**Données** : aucune migration.
**Retour arrière** : purement additif, rien encore committé — `git diff`/`git checkout` suffisent.
**Prochaine étape** : Saar valide en navigateur ; si confirmé, clôturer le chantier entier (archiver ce
document vers `docs/Old/`, transférer le contenu durable vers `docs/SYSTEME/COMBAT.md`, retirer la
Règle 10 temporaire de `docs/RegleDocumentaire.md`).
