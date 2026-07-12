# PLAN_RESNAT — Résistances naturelles (poison / maladie / radiation / drogue)
> Session 141 (suite 18) — 2026-07-12
> Statut : **PLAN COMPLET (v2, révisé après analyse critique + recherche pro), aucun code écrit.**
> Chantier distinct de `docs/PLAN_MUTATION2.md` (carve-out décidé en session précédente).

---

## Contexte / décision Saar

On implémente maintenant **le calcul mécanique correct** de la Résistance naturelle (attribut +
mutations + avantages) — "les premières briques", rattachées à la création de personnage. **Le Test de
jeu qui consomme ce modificateur est explicitement différé** (chantier séparé, plus tard) : le MJ
déclare une Intensité ad hoc, jet 1d20, `Seuil = Intensité − Modificateur`, d20 < Seuil = réussite
(résiste) — confirmé par Saar. Aucun mécanisme de "Test MJ hors combat" n'existe dans le code
aujourd'hui (vérifié exhaustivement session précédente) — construire ce sous-système est un chantier à
part, hors scope ici (section H).

**Consigne explicite Saar (cette session) avant de coder quoi que ce soit** : rechercher les bonnes
pratiques pro, s'inspirer de dépôts GitHub sérieux, ne jamais bricoler même temporairement, prendre le
temps de valider une architecture robuste et adaptative. Cette passe a changé le plan en profondeur —
v1 avait un vrai bug de conception (section "Historique" en bas de fichier).

---

## Diagnostic `[VÉRIFIÉ]` — lecture directe du code + requêtes réelles en base (lecture seule)

- `calcResistanceNaturelle(result_na)` + `RES_NAT_TABLE` (LdB p.114) déjà codés
  (`server/src/lib/charStats.js:90-102,245-251`), exportés, **jamais appelés nulle part**.
- `calcResistanceDroguesInput(con_na, vol_na)` (`charStats.js:253-255`) = `(CON+VOL)/2` arrondi —
  **bug confirmé** : consommé par la macro `resistance_drogues` (`char-sheet.js:1661`,
  `socketDice.js:120`) mais **jamais passé dans `RES_NAT_TABLE`**.
- Poison / maladie / radiation : zéro trace de calcul dans le code applicatif (statuts visuels
  cosmétiques uniquement sur les tokens, sans consommation mécanique).
- `getAdvantages()` (`advantageService.js:17-21`) ne sélectionne pas encore `mod_resistance`/
  `mod_res_value` (seuls `mod_attribute`/`mod_value` du Lot 2 y figurent).

### Bug de données trouvé en base réelle `[VÉRIFIÉ par requête directe + croisement texte LdB]`

Recherche pro faite avant de conclure (demande Saar) : le système **IWR** de Pathfinder 2e/Foundry
([Quickstart guide rule elements](https://github.com/foundryvtt/pf2e/wiki/Quickstart-guide-for-rule-elements))
encode Résistance/Faiblesse comme `{ key: "IWR", type: "resistance"|"weakness", value: <toujours positif> }`
— la **direction** (aide ou pénalise) vient d'un champ `type` fixe et le moteur applique une logique
dédiée par type, jamais une inversion de signe calculée sur une donnée générique à la volée. Autre
angle, même conclusion : le modèle **ActiveEffect** de Foundry (déjà cité au Lot 2) stocke une valeur
qui porte déjà son signe final, prête à être additionnée telle quelle. Les deux sources convergent sur
le même principe déjà appliqué dans ce projet (`shared/polarisUtils.js`, commentaire Lot 2 : *"mod_value
porte déjà son signe, jamais inspecter type pour l'inverser"*).

En vérifiant si `ref_advantages`/`ref_mutations` respectent bien ce principe pour la famille
poison/maladie/radiation/drogue (requêtes réelles ci-dessous, croisées avec le texte LdB exact,
`docs/Character/Creation/REGLE_MUTATION.md`), **6 lignes le violent** :

| Table | Ligne(s) | Texte LdB | Valeur stockée | Effet réel avec `Seuil = Intensité − Modificateur` |
|---|---|---|---|---|
| `ref_advantages` | `adv_031-034` "Résistance naturelle augmentée" | *"améliorée de 2 points"* | `mod_res_value: +2` | **Dégrade** le Seuil de 2 au lieu de l'améliorer |
| `ref_mutations` | id 36-39 "Résistance naturelle" (poison/maladie/radiation/drogue) | *"augmentée de 3 points"*, stack *"+1... par stack"* | `mod_res_X: +3`, `stack_deltas: +1` | Dégrade le Seuil au lieu de l'améliorer |
| `ref_mutations` | id 30 "Purulence" | *"Résistance aux maladies... augmentée de 3 points"*, 2ᵉ fois *"+2 points supplémentaires"* | `mod_res_disease: +3`, `stack_deltas: +2` | Dégrade au lieu d'améliorer |
| `ref_mutations` | id 8 "Contagion" | *"totalement immunisé contre les maladies"* | `mod_res_disease: +9999` (sentinelle "auto-réussite") | **Cas le plus parlant** : `Seuil = Intensité − 9999` = toujours très négatif → un personnage "immunisé" **échouerait systématiquement**, l'exact opposé de l'intention |

**Lignes déjà correctes, vérifiées par le même croisement texte↔valeur, non touchées** :
`adv_051-054` "Faiblesse naturelle" (+2, texte *"le personnage souffre d'un modificateur de +2"* —
déjà littéral, cohérent) ; `adv_018`/`adv_030`/`adv_060` et la mutation "Squelette renforcé"
(domaine Dommages/Choc — application **directe**, sans la soustraction Intensité−Modificateur, donc
pas concernés par cette inversion — confirmé en lisant leurs textes : *"-1 à sa Résistance aux
Dommages"*, *"+2 Résistance au Choc"*, tous déjà littéraux et cohérents).

**Portée de l'impact réel** `[VÉRIFIÉ]` : requête `char_advantages`/`char_mutations` en base — **aucun
personnage n'a jamais acquis une seule de ces lignes** (0 ligne trouvée). Aucun code applicatif ne lit
ces colonnes (confirmé session précédente, grep exhaustif). **Zéro régression possible** — c'est le bon
moment pour corriger la donnée, avant tout premier consommateur.

### Piège de nommage — divergence de clé `[VÉRIFIÉ]`
`ref_advantages` utilise la clé `"drug"` (singulier, lignes `adv_034`/`adv_054`) alors que
`ref_mutations`/`char_mutation_effects_view` utilisent `mod_res_drugs` (pluriel). Corrigé dans la même
migration (normalisation `"drug"` → `"drugs"` sur `mod_resistance` **et** `subtype` — colonne `subtype`
vérifiée non consommée ailleurs dans le code, `grep` exhaustif `advantageConstraints.js` et le reste de
`server/src`, sans risque).

---

## Décision d'architecture (v2) — corriger la donnée, pas le code

**Principe validé par la recherche (IWR PF2e + ActiveEffect Foundry) et déjà en vigueur dans ce
projet (Lot 2)** : une valeur de modificateur doit porter son signe final dans la donnée. Le moteur
applicatif reste une addition pure, générique, sans inspection de `type` — jamais de logique spéciale
"si avantage alors inverser" dispersée dans le code (c'est exactement ce genre de rustine que la v1 de
ce plan proposait, et que Saar a demandé de bannir explicitement).

### A. Migration `136_fix_ref_resistance_naturelle_sign.js` (NOUVEAU)
Corrige les 6 lignes identifiées ci-dessus (signe) + normalise `"drug"`→`"drugs"` (2 lignes,
`mod_resistance` et `subtype`). `down()` restaure exactement les valeurs actuelles (symétrique).

```js
// up()
await knex('ref_advantages').whereIn('advantage_id', ['adv_031','adv_032','adv_033','adv_034'])
  .update({ mod_res_value: -2 })
await knex('ref_advantages').whereIn('advantage_id', ['adv_034','adv_054'])
  .update({ mod_resistance: 'drugs', subtype: 'drugs' })

await knex('ref_mutations').where({ mutation_id: 30 })  // Purulence
  .update({ mod_res_disease: -3, stack_deltas: JSON.stringify({ mod_PRE: -1, mod_res_disease: -2 }) })
await knex('ref_mutations').where({ mutation_id: 8 })   // Contagion
  .update({ mod_res_disease: -9999 })
await knex('ref_mutations').where({ name: 'Résistance naturelle', subtype: 'drugs' })
  .update({ mod_res_drugs: -3, stack_deltas: JSON.stringify({ mod_res_drugs: -1 }) })
await knex('ref_mutations').where({ name: 'Résistance naturelle', subtype: 'disease' })
  .update({ mod_res_disease: -3, stack_deltas: JSON.stringify({ mod_res_disease: -1 }) })
await knex('ref_mutations').where({ name: 'Résistance naturelle', subtype: 'poison' })
  .update({ mod_res_poison: -3, stack_deltas: JSON.stringify({ mod_res_poison: -1 }) })
await knex('ref_mutations').where({ name: 'Résistance naturelle', subtype: 'radiation' })
  .update({ mod_res_radiation: -3, stack_deltas: JSON.stringify({ mod_res_radiation: -1 }) })
```
`down()` : mêmes `.update(...)` avec les valeurs actuelles (+2/+3/+9999/+1/+2, `mod_resistance`/
`subtype` remis à `'drug'` pour les 2 lignes concernées).

### B. `shared/polarisUtils.js` — résolveur générique (symétrique à `getAdvantageModForAttr`)
Aucune inspection de `type` — la donnée porte déjà son signe correct après la migration A.
```js
export function getAdvantageModForResistance(advantageRows, resistanceKey) {
  return sumModByKey(advantageRows, 'mod_resistance', 'mod_res_value', resistanceKey)
}
```
(`sumModByKey` déjà privée dans ce fichier depuis le Lot 2 — réutilisée telle quelle, aucune
duplication.) Cette fonction est désormais **safe à réutiliser pour damage/shock** aussi (contrairement
à la v1 qui l'interdisait explicitement) — la donnée étant maintenant correcte partout, plus besoin de
cas particulier. Pas fait dans ce chantier (hors scope, Lot 3 recentré de `PLAN_MUTATION2.md` s'en
chargera), mais la fonction n'a plus besoin d'avertissement "ne pas réutiliser ailleurs".

### C. `server/src/services/advantageService.js`
`getAdvantages()` (ligne 17-21) : ajoute `'ra.mod_resistance', 'ra.mod_res_value'` au `.select(...)`.

### D. `server/src/lib/charStats.js`
Rien à modifier — `calcResistanceNaturelle`/`RES_NAT_TABLE` restent ici (pas de duplicata client,
comme `calcSouffle` au Lot 2).

### E. Sites à rebrancher (2 fichiers, structure dupliquée à l'identique — inchangé vs v1)

| Fichier | Lignes | Changement |
|---|---|---|
| `char-sheet.js` | 40 (import) | ajoute `calcResistanceNaturelle` depuis `charStats.js` |
| `char-sheet.js` | 41 (import) | ajoute `getAdvantageModForResistance` depuis `shared/polarisUtils.js` |
| `char-sheet.js` | 1620-1626 (liste `secondary`) | 3 nouvelles entrées : `resistance_poison`, `resistance_maladie`, `resistance_radiation` |
| `char-sheet.js` | 1655-1664 (`secondaryValue`) | fix `resistance_drogues` + 3 nouveaux cases |
| `socketDice.js` | 5-9 (imports) | idem |
| `socketDice.js` | 114-123 (`secondaryValue`) | même fix + mêmes 3 cases |

Contenu identique aux 2 sites (pure addition, aucune inspection de `type`) :
```js
case 'resistance_drogues':   return calcResistanceNaturelle(calcResistanceDroguesInput(na('CON'), na('VOL'))) + (mutationEffects?.mod_res_drugs ?? 0) + getAdvantageModForResistance(advantages, 'drugs')
case 'resistance_poison':    return calcResistanceNaturelle(na('CON')) + (mutationEffects?.mod_res_poison ?? 0) + getAdvantageModForResistance(advantages, 'poison')
case 'resistance_maladie':   return calcResistanceNaturelle(na('CON')) + (mutationEffects?.mod_res_disease ?? 0) + getAdvantageModForResistance(advantages, 'disease')
case 'resistance_radiation': return calcResistanceNaturelle(na('CON')) + (mutationEffects?.mod_res_radiation ?? 0) + getAdvantageModForResistance(advantages, 'radiation')
```
`mutationEffects`/`advantages`/`na()` déjà disponibles aux 2 sites (même `Promise.all` existant).

### F. Ce qui ne change PAS
- `damageService.js`/`calcResistanceDommages`/`calcSeuils`/`adv_018`/`adv_030`/`adv_060`/
  "Squelette renforcé" : hors scope, non touchés (déjà corrects).
- Aucun nouvel event socket, aucune UI nouvelle, aucun duplicata client (comme Souffle au Lot 2).
- `char_mutation_effects_view` : aucun changement de définition, elle agrège déjà correctement
  (`SUM`), c'est la donnée en amont qui était fausse, pas la vue.

### G. Cas limites à tester
- Personnage sans mutation/avantage → 4 valeurs = `calcResistanceNaturelle` brut (attribut seul).
- Mutation "Résistance naturelle (poison)" seule → Seuil **augmente** de 3 (pas diminue) sur un
  exemple concret CON connue.
- Mutation "Résistance naturelle (poison)" acquise 2× (stack) → +3 puis +1 supplémentaire (total +4),
  toujours dans le sens de l'amélioration.
- `adv_031` (poison, avantage) seul → Seuil **+2**.
- `adv_051` (poison, désavantage) seul → Seuil **-2**.
- `adv_034`/`adv_054` (clé normalisée `"drugs"`) → doivent matcher `resistance_drogues`.
- Mutation "Contagion" → Modificateur si grand qu'aucune Intensité réaliste ne peut jamais faire
  échouer le Test (vérification arithmétique, pas de Test réel à ce stade).
- Non-régression : `resistance_drogues` change de valeur avant/après (preuve du fix du bug initial).
- `getAdvantages()` avec 2 colonnes en plus ne casse pas `AdvantagesPanel.jsx`.
- Round-trip migration 136 : `down()`→valeurs actuelles→`up()`→valeurs corrigées, byte-identique
  (P52 : appel direct des fonctions du module, jamais la CLI knex brute).

### H. Explicitement hors scope (décision Saar, chantier futur)
Le Test de jeu lui-même (MJ déclare Intensité, jet 1d20, résultat automatique) — nouveau sous-système
"Test MJ hors combat", aucun précédent dans le code. À planifier séparément.

---

## Historique — pourquoi ce plan a une v2

La v1 (session précédente) avait détecté le même problème de signe mais l'avait résolu par un
résolveur runtime inversant le signe selon `type` (`type==='advantage' ? -x : x`), avec un commentaire
explicite "ne jamais réutiliser pour damage/shock". Cette solution fonctionnait mais était fragile :
logique spéciale non documentée dans la donnée elle-même, risque de mauvaise réutilisation future,
incohérente avec le principe déjà établi au Lot 2. Sur demande explicite de Saar (recherche pro
obligatoire, jamais de bricolage même temporaire), la v1 a été entièrement revue : le vrai problème est
un **bug de saisie dans les données sources** (6 lignes, confirmé par croisement systématique avec le
texte LdB et une requête base réelle), pas quelque chose à compenser côté code. La v2 corrige la
donnée une fois pour toutes (migration) et le code redevient une pure addition générique, sans aucun
cas particulier — plus robuste, plus simple, et réutilisable sans risque pour d'éventuels futurs lots
(Résistance aux Dommages/Choc).

---

## Codé (2026-07-12)
Sections A-E appliquées exactement comme documenté. Migration `136_fix_ref_resistance_naturelle_sign.js`
(NOUVEAU), `shared/polarisUtils.js` (`getAdvantageModForResistance`), `advantageService.js`
(`getAdvantages` étendu), `char-sheet.js`/`socketDice.js` (imports + liste `secondary` + 4 cases
`secondaryValue`, aux 2 sites identiques).

**Testé** :
- `node --check` 0 erreur sur les 5 fichiers touchés.
- Round-trip migration réel (`down()`→valeurs originales confirmées `+2/+3/+9999/+1/+2, "drug"`→`up()`
  →valeurs corrigées confirmées `-2/-3/-9999/-1/-2, "drugs"`), byte-identique, via appel direct des
  fonctions du module (P52).
- 9 scénarios unitaires purs (`node -e`) : table `RES_NAT_TABLE` aux bornes, avantage seul (-2),
  désavantage seul (+2), les deux ensemble (0, non-régression signe), clé normalisée `drugs` ne
  matche plus jamais `drug` (collision éliminée), bug `resistance_drogues` reproduit avant/après fix,
  non-régression `getAdvantageModForAttr` (Lot 2, signature distincte inchangée).
- **Test bout-en-bout en base réelle** (personnage existant réel, transaction annulée, jamais
  committée) : mutation "Résistance naturelle (poison)" (-3) + avantage `adv_031` (-2) insérés
  temporairement → Modificateur final = base(+1, CON faible) -3 -2 = **-4** (donc Seuil **+4** par
  rapport à la base — l'amélioration attendue, pas une dégradation) ; stacking testé (count 2 →
  mod_res_poison -4 = -3 + 1×delta(-1), formule `SUM` de la vue confirmée correcte avec des deltas
  négatifs) ; `mutationEffects.mod_res_poison` bien un `number` JS (cast `::integer` migration 128
  toujours actif) ; rollback vérifié, **0 résidu** en base après coup.
- ESLint : sans objet — aucun fichier client touché (comme prévu, exposition macro-only, précédent
  Souffle du Lot 2), `shared/polarisUtils.js` hors du périmètre de config ESLint client (vérifié —
  avertissement "outside of base path", pas une erreur).

**Non testé** : parcours navigateur réel (créer une macro personnage avec source "Résistance aux
poisons"/"aux maladies"/"aux radiations"/"aux drogues", vérifier le seuil affiché en aperçu live
`/macro-preview` puis lancer réellement la macro `MACRO_ROLL`) — confirmation fonctionnelle Saar
requise avant de considérer ce chantier clos, cf. protocole.

## Addendum — Attributs secondaires manquants sur la fiche personnage (2026-07-12)
Signalé par Saar (table LdB p.114) : le BLOC 4 "Attributs secondaires" de `CharacterSheet.jsx`
n'affichait que Réaction/Initiative/Choc/Allures/Mod. Dommages — Résistance aux dommages,
Résistances naturelles (×4) et Souffle en étaient totalement absents côté client.

**Consolidation** : `RD_TABLE`/`calcResistanceDommages`, `RES_NAT_TABLE`/`calcResistanceNaturelle`,
`calcResistanceDroguesInput`, `calcSeuils`, `calcSouffle` déménagées de `charStats.js` (serveur
uniquement) vers `shared/polarisUtils.js` — même principe que `calcREA` au Lot 2 (source de calcul
unique, désormais consommées des deux côtés). Tous les appelants serveur existants
(`statusService.js`, `damageService.js`, `socketCombatHelpers.js`, `char-sheet.js`, `socketDice.js`)
redirigés pour importer directement depuis `shared/` (jamais via `charStats.js`, leçon Lot 2 section K
— import mort sinon). `charStats.js` ne garde que ce qu'il utilise en interne (`RD_TABLE` pour
`calcDroneRD`).

**Décision de scope (délibérée, pas un oubli)** : "Résistance aux dommages" affiche la valeur **de
base uniquement** (FOR+CON), sans mutation/avantage — contrairement aux Résistances naturelles.
Raison : `resolveTargetHit`/`resolveMeleeAction` (résolution réelle des dégâts en combat) n'appellent
`calcResistanceDommages` qu'avec 2 arguments aujourd'hui (Lot 3 de `docs/PLAN_MUTATION2.md`, non
codé) — inclure mutation/avantage seulement côté fiche aurait affiché un nombre jamais appliqué en
jeu. Idem pour "Choc" (Seuils) : `adv_030`/`adv_060` toujours non câblés, décision confirmée avec
Saar de ne pas y toucher ici. Les Résistances naturelles n'ont pas ce problème : aucune résolution de
combat ne les consomme encore (Test différé), donc l'affichage complet (attribut+mutation+avantage)
ne contredit aucune résolution réelle existante.

`CharacterSheet.jsx` : `calcSecondary` gagne un 3ᵉ paramètre (`mutationEffects`, déjà chargé) et
calcule 6 valeurs supplémentaires ; 6 nouveaux `<SecondaryField>` ajoutés **après** Mod. Dommages
(aucun champ existant retiré, conforme à la consigne Saar) ; `fr.json` +6 clés `secondary`/+6
`tooltip`.

**Testé** : `node --check` sur tous les fichiers serveur touchés, ESLint client 0 nouvelle erreur
(3 problèmes pré-existants confirmés identiques via `git stash`), non-régression numérique des 5
fonctions déplacées (valeurs identiques à l'ancienne implémentation `charStats.js`, vérifié `node -e`),
`calcDroneRD` (seul consommateur restant de `RD_TABLE` côté serveur) revérifié fonctionnel, SR
(`/api/health` 200 après redémarrage nodemon).

**Non testé** : parcours navigateur réel (affichage des 6 nouveaux champs sur une fiche, valeurs
cohérentes avec un personnage réel ayant mutation/avantage) — confirmation Saar requise.

**Passe UI/UX (même session, après confirmation fonctionnelle)** : Saar juge le rendu "fonctionnel
mais moche" (grille plate) et fournit la fiche papier officielle comme inspiration. 2 pistes proposées
via Artifact (cartes groupées vs liste dense), Saar choisit un hybride : Réaction/Initiative en
cartes, liste dense pour Choc/Dommages/Résistances naturelles/Souffle (sous-lignes indentées pour
Choc et Résistances naturelles), Allures en cartes en bas. `SecondaryField` (cartes) et nouveau
`SecondaryListRow` (liste) partagent leur logique de tooltip via un hook extrait `useSecondaryTooltip`
(évite la duplication). Styles ajoutés à l'objet `s` existant (convention déjà en place dans ce
fichier, pas de classe `index.css` introduite — cohérence locale). Testé : ESLint 0 nouvelle erreur
(3 pré-existants confirmés `git stash`), `fr.json` valide. Non testé : rendu navigateur.

## ✅ CLOS — 2026-07-12
**Testé** : tout ce qui précède (round-trip migration, scénarios unitaires, test bout-en-bout base
réelle, non-régression numérique, ESLint/`node --check`) + **parcours navigateur confirmé fonctionnel
par Saar** (capture d'écran fiche personnage réelle — 6 nouveaux champs affichés dans "ATTRIBUTS
SECONDAIRES", valeurs cohérentes : Résistance dommages -1, Résistances poison/maladie/radiation -2,
drogue -1, Souffle 12, pour un personnage avec CON=10/VOL=14).
**Non testé** : parcours navigateur des macros (`resistance_poison`/etc. via `/macro-preview` et
`MACRO_ROLL` réel) — la fiche uniquement a été vérifiée visuellement, pas le flux macro dédié.
**Suite immédiate (même session)** : Saar demande une passe UI/UX sur le bloc "ATTRIBUTS SECONDAIRES"
(actuel = grille plate non groupée, "fonctionnel mais moche"), en s'inspirant du regroupement de la
fiche papier officielle (Choc/Résistances naturelles en sous-groupes). Traité séparément (question de
design, pas un bug).

## Passe UI/UX — accordéon + regroupement Attributs secondaires ✅ CLOS — 2026-07-12

**Itération 1** : mockup interactif (Artifact) proposant 2 pistes (cartes groupées / liste dense).
Saar choisit un hybride : Réaction/Initiative en cartes, liste dense pour Choc/Dommages/Résistances
naturelles/Souffle, Allures en cartes en bas. `SecondaryField`/nouveau `SecondaryListRow` partagent
leur logique de tooltip via un hook extrait `useSecondaryTooltip` (évite la duplication).

**Itération 2** : après capture d'écran de la fiche réelle complète, Saar signale qu'elle est "encore
plus massive" avec les nouveaux champs — vraie cause identifiée : le bloc Compétences (~60 lignes),
pas les Attributs secondaires. Décision : **accordéon sur 6 blocs** (XP, Description, Attributs,
Attributs secondaires, Compétences, Avantages — "En-tête" reste toujours visible, ancre non repliée)
+ **mémorisation par TYPE de fiche** (`localStorage` clés `charSheetAccordion:owned`/`:other`,
sélectionnées via la prop `isOwner` déjà disponible — pas par personnage, demande explicite : "mes
fiches perso ne s'affichent pas pareil que les autres") + **Attributs secondaires en 2 colonnes** pour
la partie liste (gauche : Choc + Dommages ; droite : Résistances naturelles + Souffle — deux listes
indépendantes et sémantiquement cohérentes, écart assumé par rapport à la maquette qui entrelaçait les
lignes une à une, jugé moins lisible). Nouveau composant `CollapsibleBlock` (en-tête cliquable +
chevron rotatif). `blockOpen` rechargé via `useEffect([isOwner, characterId])` — le composant ne
remonte pas entre deux personnages (dette connue depuis Session 141 suite 9), sans quoi l'accordéon
resterait figé sur le premier profil chargé au montage.

**Itération 3** : Saar demande de regrouper les Allures avec Réaction/Initiative dans la même rangée
de cartes ("gagner un max de place"), avec un séparateur discret entre les deux groupes. Nouveau prop
`separator` sur `SecondaryField` (trait vertical + marge, attaché à la carte "Allure lente" plutôt
qu'un élément flex autonome — reste correct même si `flexWrap` renvoie la carte à la ligne).

**Testé (les 3 itérations)** : ESLint 0 nouvelle erreur à chaque étape (3 problèmes pré-existants
confirmés identiques via `git stash`), `fr.json` valide, serveur sain (`/api/health` 200, changements
client uniquement). **Parcours navigateur confirmé fonctionnel par Saar à chaque itération**
("Presque parfait" → "Conforme" final).
**Non testé** : bascule effective entre profil `owned`/`other` sur deux personnages réels différents
en conditions live (mécanisme confirmé fonctionnel en général, pas vérifié spécifiquement
personnage-par-personnage avec capture) ; comportement en fenêtre très étroite (le `flexWrap` de la
rangée de cartes Réaction/Initiative/Allures n'a pas été testé à une largeur extrême) ; parcours
navigateur des macros `resistance_poison`/etc. (seule la fiche a été vérifiée visuellement, jamais
`/macro-preview`/`MACRO_ROLL`).

## Chantier suivant

`docs/PLAN_MUTATION2.md` **Lot 3** (Résistance aux Dommages + Choc) reste ouvert — scope déjà
recentré (section "Ouverture du lot"), pas encore détaillé ligne à ligne. Rappel du point de vigilance
posé pendant ce chantier (section F ci-dessus) : "Résistance aux dommages" et "Choc" affichés sur la
fiche en valeur de base seulement (sans mutation/avantage) précisément parce que ce Lot 3 n'est pas
codé — le coder complètera à la fois le calcul ET l'affichage déjà en place, sans nouveau chantier
fiche séparé.
