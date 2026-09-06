# PLAN_CHANCE.md — Mécanique de dépense de points de Chance

> Cadrage 2026-09-05 (Claude/Saar). Chantier **transversal** : débloque le Test de Chance de l'AOE
> (fusil à pompe / grenades longue-extrême portée, aujourd'hui ignoré — écart RAW), le **tir de
> suppression** (toute sa résolution en dépend), la réduction de gravité des Dommages d'armure et des
> Blessures, et la relance de jet générique. **Autorité : Livre de Base Polaris.**
>
> ## ⚠️ Bloqué en amont — RAW à fournir par Saar
>
> Le cœur des règles de Chance est, selon le LdB lui-même (`docs/REGLES/ATTRIBUTS.md:31-33` : « Les
> règles de Chance sont amplement détaillées dans le chapitre consacré au système de jeu »,
> `REGLEARMURE.md:446` : « Voir la section Chance, dans le chapitre Tests et actions »), dans **un
> chapitre non transcrit** dans `docs/REGLES/`. Il manque :
> 1. **Combien de points dépensables** un personnage a, et **comment ils se régénèrent** (par
>    séance ? par aventure ? repos ? jamais ?). Le *score* de Chance (`chc`, niveau sur 20) existe ;
>    la *réserve dépensable* est une autre notion.
> 2. **Le coût exact** de chaque usage (relance = 1 pt ? réduction de gravité = 1-2 pts, ça c'est
>    connu `REGLEARMURE.md:443-446` ; forcer un Test de Chance = ?).
> 3. **Ce qu'un Test de Chance teste précisément** : `1D20 ≤ chc` modifié par le bonus/malus (c'est
>    la lecture actuelle, `damageService.js:404`), ou une autre échelle.
> 4. Les usages hors combat (« indices et petits bonus du MJ », `ATTRIBUTS.md:36`) — probablement
>    hors périmètre v1, à confirmer.
>
> **→ Fournir la ou les pages « Chance » du chapitre système de jeu avant le cadrage détaillé.** Ce
> document liste ce qui est déjà en place et tous les points d'intégration, pour qu'ils soient prêts
> dès que le RAW arrive.

---

## 1. Ce qui existe déjà [VÉRIFIÉ dans le code, 2026-09-05]

**Correction d'une affirmation fausse répétée** : plusieurs docs et commentaires
(`PLAN_AOE.md` §5.2, `PLAN_ARMES_SPECIALES.md` §3, `socketCombatAoe.js:388-393`, `JOURNAL8.md`
§« AOE Segment 8 »/§« 2b ») affirment « aucune colonne Chance n'existe dans le schéma, grep zéro
résultat char_sheet ». **Faux** — le grep cherchait `chance`, la colonne s'appelle `chc` :

| Brique | Où | État |
|---|---|---|
| **Score de Chance** `char_sheet.chc` | migration `22_char_sheet.js:7` (`integer default 11`, borné 1-20) | ✅ existe |
| Édition MJ/joueur du score | `PUT /api/char-sheet/:characterId/chc` (`char-sheet.js:480`) + `CharacterSheet.jsx:258-260,588` (champ éditable) | ✅ câblé |
| **Test de Chance déjà résolu** (Petit bouclier) | `damageService.js:398-405` — `1d20 ≤ (sheetCible.chc ?? 11)`, émis en `DICE_RESULT` (`skillLabel: 'Test de Chance — Bouclier'`, `socketCombatHelpers.js:1157-1168`) | ✅ 1 cas réel, **pas encore de modificateur bonus/malus appliqué** |
| Valeur de départ RAW | Réaliste 11 / Intermédiaire 13 / Héroïque 15 (`REGLE_CREATION.md:273-278`) | à câbler en création si pas déjà (à vérifier) |

Donc le chantier **n'est pas « créer le stockage »** — le score est là. Ce qui manque : la **réserve
dépensable**, le **geste de dépense** (relance / réduction de gravité / forçage), et son **UI**.

---

## 2. Points d'intégration — tous recensés (RAW combat déjà transcrit)

### 2.1 Test de Chance « pour éviter d'être touché » — AOE (aujourd'hui *ignoré*)

- **Fusil à pompe** longue portée : « les cibles ont droit à un Test de Chance pour éviter d'être
  touchées » ; extrême : « Test de Chance avec un bonus de +5 » (`REGLES_ARMES_SPECIALES.md:36,39`).
- **Grenades** longue portée : idem ; extrême : « + un bonus de +5 » (`REGLES_ARMES_SPECIALES.md:100,103`).
- État actuel : `socketCombatAoe.js` documente explicitement l'écart — les cibles à ces paliers
  subissent le dégât réduit **sans aucune chance d'esquive**. Une fois `resolveChanceTest` disponible :
  la couche 4 AOE (par cible, à partir de `ht.band`) appelle le Test ; sur réussite, la cible est
  retirée de `resolveTargets`. Le modificateur = « bonus de réussite / malus d'échec du Test de tir »
  (`REGLES_ARMES_SPECIALES.md` + `REGLESYSCOMBAT.md:1407`), + `+5` au palier extrême.

### 2.2 Tir de suppression — *toute* la résolution en dépend

`PLAN_AOE.md` §1 (couloir ~3 m) : « pas de dégât direct — **Test de Chance par cible dans/traversant
la zone** ». `REGLESYSCOMBAT.md:1545-1550` : le personnage qui traverse une zone de tir de barrage
fait un Test de Chance ; **un bonus de réussite du tireur *réduit* le niveau de Chance de la cible,
un malus d'échec l'*augmente* (inversé par rapport à l'habitude)** ; couverture partielle / obscurité
/ gaz → +3 à +10 au gré du MJ ; **un PJ à découvert peut toujours dépenser un point de Chance pour
réussir ce Test** (`:1550`). C'est le cas d'usage « forçage » le plus net.
→ Ne pas démarrer le tir de suppression avant ce chantier (déjà acté, `ROADMAP.md`).

### 2.3 Réduction de gravité — Dommages d'armure et Blessures

- **Dommages d'armure** : `REGLEARMURE.md:442-446` — « dépenser des points de Chance pour réduire le
  niveau de Dommages d'un ou deux degrés » (1 pt → -1 degré, 2 pts → -2). Point d'accroche :
  après résolution d'un Dommage d'armure, avant écriture définitive de la gravité.
- **Blessures** : `ATTRIBUTS.md:35` — « réduire la gravité de certaines blessures ». Formulation
  vague (« certaines ») → **RAW précis nécessaire** (quelles blessures, quel coût). Point d'accroche :
  `damageService.resolveTargetHit` / la file de confirmation de dégât PJ (`COMBAT_DAMAGE_PROMPT` /
  `CombatDamageWindow`), après le calcul de `finalSeverity`, avant persistance.

### 2.4 Relance de jet générique

`ATTRIBUTS.md:34` — « relancer des dés lors de tests malchanceux ». Miroir du flux d'auto-relance sur
échec critique déjà en place (`shared/polarisTestResolution.js#applyCriticalFailReroll`,
`resolveCriticalFailReroll`) — mais **déclenché par le joueur**, sur un échec simple, contre 1 point.
Point d'accroche : `CombatModifiersWindow` (jet de tir/CaC), fenêtre de résultat de Test générique.

### 2.5 Autres mentions combat (à cadrer avec le RAW)

- Tir furtif : « en cas de réussite du Test de tir, il doit enfin réussir un Test de Chance »
  (`REGLESYSCOMBAT.md:1405-1408`).
- Événement malheureux / catastrophe : Test de Chance « avec les modificateurs que le MJ estime
  nécessaires » (`REGLESYSCOMBAT.md:1660-1665`) — recoupe le Lot 1 Catastrophe (file MJ, `mechanized:false`).

---

## 3. Architecture cible [CIBLE — à valider avec le RAW]

### 3.1 Stockage

- **Score** : `char_sheet.chc` — **inchangé**, déjà là.
- **Réserve dépensable** : nouvelle colonne `char_sheet.chc_points` (integer, nullable ou default =
  valeur RAW). Régénération : **règle RAW**. Édition MJ : même route/UI que `chc` (ajouter le champ,
  pas une route neuve — `PUT /chc` accepte déjà un body, l'étendre en `{ chc, chc_points }` ou une
  route sœur selon la convention `char-sheet.js`). Migration `NNN_char_sheet_chc_points.js` (structure)
  — numéro réel au moment de coder (`rules/migrations.md`).

### 3.2 Primitive partagée

`shared/polarisTestResolution.js` (ou un nouveau `shared/chanceTest.js` si le fichier grossit) :

```js
// resolveChanceTest(chc, { modifier = 0 }) → { roll, threshold, success }
// 1D20 ≤ chc + modifier. Le SENS du modificateur est RAW-spécifique (cf. §2.2 : inversé pour le
// barrage). L'appelant fournit le modificateur signé, cette primitive ne connaît pas le contexte.
```

`damageService.js:398-405` (Petit bouclier) **bascule dessus** — aujourd'hui il fait le jet à la
main sans modificateur ; c'est le premier consommateur, prouvé avant les autres (même discipline que
`resolveTargetLocations` pour l'AOE).

### 3.3 Geste de dépense

Un seul point d'autorité serveur : `chanceService.spendChancePoints(db, charSheetId, n, { reason })`
— décrémente `chc_points` sous garde (`>= n`, transaction), émet l'événement de mise à jour fiche,
refuse si insuffisant. Trois déclencheurs :
1. **Forçage d'un Test de Chance** (barrage `:1550`, AOE longue/extrême) : avant/à la place du jet,
   « réussite automatique » contre le coût RAW.
2. **Relance d'un jet** (§2.4) : re-`parseDice` du même type, garde le meilleur (ou le nouveau — RAW).
3. **Réduction de gravité** (§2.3) : `finalSeverity` descend de `n` degrés (borné), `n ∈ {1,2}`.

### 3.4 UI — bouton « Utiliser sa Chance »

Transversal, **jamais** un composant par site. Un `<ChanceSpendButton>` réutilisable (affiché si
`chc_points > 0` et le contexte l'autorise), branché dans :
- `CombatModifiersWindow` (relance du jet de tir/CaC),
- la fenêtre de confirmation de dégât PJ (`CombatDamageWindow` — réduction de gravité),
- une éventuelle fenêtre de Test de Chance dédiée (barrage / AOE — la cible PJ décide).
Reset/verrou : un point dépensé est confirmé serveur avant de disparaître de l'UI (pas d'optimisme).

---

## 4. Séquençage proposé [CIBLE]

1. **Migration `chc_points`** + édition MJ (route + `CharacterSheet.jsx`) + valeur de départ en
   création. Isolé, testable seul.
2. **`resolveChanceTest` partagée** + bascule du Petit bouclier dessus (0 changement de comportement,
   prouvé avant les autres consommateurs). `node --test`.
3. **`chanceService.spendChancePoints`** + événement fiche + garde transactionnelle. Tests DB.
4. **UI `<ChanceSpendButton>`** + branchement relance de jet (le cas le plus simple, 1 pt, pas de
   file). Session Saar.
5. **Réduction de gravité** (Dommages d'armure d'abord — coût RAW connu 1-2 pts ; Blessures ensuite si
   le RAW le précise). Session Saar.
6. **Wiring AOE** : Test de Chance fusil à pompe / grenades longue-extrême (retire la cible de
   `resolveTargets` sur réussite ; forçage possible). Lève l'écart RAW documenté dans
   `socketCombatAoe.js` + `JOURNAL8.md`. Session Saar.
7. **Débloque le tir de suppression** — chantier séparé (`PLAN_AOE.md`), qui devient faisable.

---

## 5. Hors périmètre

- Usages narratifs hors combat (« indices et bonus du MJ ») — v2, à cadrer si besoin.
- La **zone persistante inter-tours** du tir de suppression (couloir qui contraint le déplacement
  d'un Tour à l'autre) — c'est l'*autre* blocage du tir de suppression, indépendant de la Chance
  (objet zone vivante dans l'état de combat que `planCombatWorldMovement` consulte). Chantier distinct.

---

## 6. État d'implémentation

| Étape | Statut |
|---|---|
| Cadrage | Rédigé 2026-09-05 — **bloqué sur RAW** (chapitre système de jeu, section Chance) |
| Correction docs (« aucune colonne `chc` » → faux) | À faire : `PLAN_AOE.md` §5.2, `PLAN_ARMES_SPECIALES.md` §3, `socketCombatAoe.js` commentaire, `JOURNAL8.md` |
| 1-7 | Non commencé |
