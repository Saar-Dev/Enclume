# PLAN_STEP4 — Mutations réelles dans le Wizard Step3
> Session 134 — 2026-07-05
> Statut : plan validé après analyse critique (4 décisions actées), code non démarré

---

## Contexte

`Step3Mutations.jsx` (Wizard création de personnage, étape 3 "Capacités spéciales") utilise
des données mockées (`MOCK_MUTATION_IDS`, `MOCK_SUBTYPES`, `MUTATION_META` — 6 mutations
sur 50) au lieu de la table réelle `ref_mutations` (migration 95, déjà seedée avec les 50
mutations Polaris + `ref_mutation_subtypes` + `ref_mutation_skills` + `ref_mutation_discounts`
+ `ref_mutation_incompatibilities`).

`finalizeCreation` (`creationService.js`, STEP 3) attend déjà le vrai schéma `mutation_id` —
la sauvegarde finale fonctionne. Seul l'écran d'achat/tirage aléatoire doit être reconnecté.

**Aucune nouvelle migration nécessaire.** Pour les 3 mutations dont plusieurs variantes
partagent la même plage D100 (Organe sensoriel manquant/supplémentaire : 1D6 avec relance
sur 6 ; Résistance naturelle : 1D6 sans relance), un tirage uniforme parmi les lignes DB
correspondantes est mathématiquement équivalent au sous-jet D6 de la table officielle
(`docs/Character/Creation/REGLE_CREATION.txt:810-898`) — pas besoin de stocker un numéro
d'ordre.

**Hors scope** : route `/api/char-ref/mutations` (`server/src/routes/character/ref.js:69-78`)
— cassée (`orderBy('muta_numero')`, colonne supprimée par la migration 95), utilisée par
`AdvantagesPanel.jsx` (fiche personnage, système `char_advantages.muta_numero` distinct de
`char_mutations.mutation_id`). Bug réel, déjà présent en prod, mais système parallèle non
touché par cette tâche.

---

## ⚠️ Dépendance bloquante découverte (run à vide, 2026-07-05) — plan séparé rédigé

`char_mutations` a un index unique partiel qui empêche toute mutation `is_stackable`
(Peau renforcée, Résistance naturelle, Squelette renforcé, Purulence, Difformités, Contact
corrosif, Radiation, Régénération) d'être achetée/tirée deux fois sans faire planter la
finalisation du personnage. Analyse complète, formule de correction et migration détaillées
dans [[docs/PLAN_MUTATION|PLAN_MUTATION]].

**`[HYPOTHÈSE]`** — déduit de la lecture du DDL + du code d'insertion, pas encore observé en
exécution. **Bug backend préexistant, distinct du sujet de ce plan** — à traiter avant ou avec
PLAN_STEP4 (voir ordre recommandé dans PLAN_MUTATION), sinon toute mutation stackable choisie
en Step3 fera planter la finalisation du personnage.

---

## Décisions issues de l'analyse critique (2026-07-05)

1. **Tirage aléatoire — mutation `is_unique` déjà obtenue dans le même lot** : aucune règle
   écrite ne couvre ce cas. Décision actée (hypothèse maison, pas une règle LdB) : on relance
   le D100 pour ce tirage jusqu'à obtenir une mutation valide — jamais on ne réduit
   silencieusement le nombre de résultats annoncé par le D20.
2. **Descriptions des sous-types (Caractère génétique animal)** : zéro texte généré, zéro
   texte en dur. Ajout d'une colonne `description` sur `ref_mutation_subtypes` (migration 106),
   backfill avec le texte déjà rédigé dans `creation.json` (celui du mock actuel) pour les
   4 sous-types. Le texte existe déjà, on le déplace en base, on n'en écrit pas de nouveau.
3. **Option de campagne `random_mutations`** (`campaignSettingsService.js:7`, jamais câblée)
   : à implanter. Même circuit que `ambiance` (seul réglage déjà câblé au wizard) —
   `startCreation()` la renvoie, `creationStore.js` la stocke, `WizardCreation.jsx` la
   transmet à `Step3Mutations`. Si désactivée, la carte "Tirage aléatoire" n'apparaît pas.
4. **Collision de nom `subtype`/`subtypes`** : sur le même objet mutation, `mut.subtype`
   (colonne DB, texte enum ex. `"fire"`) et un éventuel `mut.subtypes` (tableau des sous-choix
   de Caractère génétique animal) ne différeraient que d'un caractère — risque réel de faute
   de frappe silencieuse. Le tableau nesté est renommé `subtable` (écho à `has_subtable`) dans
   la réponse API et le code JS. Aucun renommage côté colonnes/tables DB.

---

## Backend

**Migration (numéro à confirmer à l'implémentation — voir `docs/EN_COURS.md` item "3.",
107 déjà réservé aux lots carrières) — `ref_mutation_subtypes` description**
- Ajouter colonne `description` (TEXT, nullable) sur `ref_mutation_subtypes`.
- Backfill des 4 lignes CGA avec le texte déjà rédigé dans `creation.json`
  (`step3.mutations.20.subtypes.*.desc`) — copié tel quel, pas de nouvelle rédaction.

**`server/src/services/creationService.js`**
- Ajouter `getStep3RefData()` (mirroring `getStep4RefData`/`getStep5RefData`) :
  `ref_mutations` + `ref_mutation_subtypes` (imbriqués par `mutation_id`, clé `subtable` —
  voir décision 4) + `ref_mutation_skills` (imbriqués par `mutation_id`, clé `skills`).
- `startCreation()` : ajouter `randomMutationsEnabled: settings.random_mutations` au retour
  (même endroit que `ambiance` est déjà extrait de `getCampaignSettings`).

**`server/src/routes/creation.js`**
- Ajouter `GET /:sheetId/step3/ref` (avant Step 4), import `getStep3RefData`.

---

## Frontend

**`creationStore.js`**
- Ajouter état `randomMutationsEnabled: null`, le récupérer dans `startCreation()` (comme
  `ambiance`), le remettre à `null` dans `resetCreation()`.

**`WizardCreation.jsx:141`**
- Ajouter `sheetId={sheetId}` et `randomMutationsEnabled` à `<Step3Mutations>`.

**`Step3Mutations.jsx`** — réécriture complète :
- Suppression `MOCK_MUTATION_IDS`, `MOCK_SUBTYPES`, `MUTATION_META`.
- `useEffect` fetch `/creation/${sheetId}/step3/ref` (pattern identique à `Step5Advantages.jsx`),
  état `loading`.
- `mutations.find(m => m.mutation_id === id)` remplace tous les lookups `MUTATION_META[id]`.
- Affichage direct des champs DB (`name`, `description`, `special_effect` en tooltip
  compétence) — plus de clés i18n par mutation, comme `Step5Advantages`.
- **Écran de choix de méthode** : carte "Tirage aléatoire" masquée si
  `randomMutationsEnabled === false`.
- **Achat** : filtre `cost_pc >= 0 && cost_pc <= pcLeft` inchangé (exclut Purulence, seule
  mutation à coût négatif).
- **Variantes** (Difformités, Organe manquant/suppl., Résistance naturelle — même `name`,
  `subtype` différent) : cartes distinctes, libellé `"{name} ({subtype traduit})"` via petite
  table i18n (13 codes).
- **Sous-table CGA** (`has_subtable`) : modal alimentée par les vraies lignes du champ
  `subtable` (renommé — décision 4), avec `description` désormais réelle (migration 106),
  plus aucun texte généré ni codé en dur.
- **Tirage aléatoire** : D20 inchangé (1-15/16-19/20 déjà conforme à la table). Pour chaque
  mutation : D100 réel → filtre les lignes dont la plage `d100_range_start`/`end` contient le
  résultat → si plusieurs lignes correspondent (les 3 groupes ci-dessus), tirage uniforme
  parmi elles (= équivalent exact du sous-D6). Si `has_subtable`, tirage D4 parmi `subtable`.
- Si le tirage retombe sur une mutation `is_unique` déjà présente dans `kept`/le lot en cours
  (décision 1) : on relance le D100 pour ce tirage, jusqu'à un résultat valide — jamais de
  réduction silencieuse du nombre de résultats promis par le D20.
- `handleSubmitChosen`/`handleSubmitRandom`/`handleNone` : construisent un `mutationsMeta`
  (`mutation_id`, `name`, `subtype_name`, `cost_pc`) envoyé dans le payload `onNext`, pour que
  `WizardReview` n'ait pas besoin d'accès DB.

**`WizardReview.jsx:74`**
- Remplace `t(\`step3.mutations.${m.mutation_id}.name\`)` par lecture directe de
  `step3Data.mutationsMeta`.

**`creation.json`**
- Suppression du bloc `step3.mutations.*` (obsolète).
- Ajout `step3.loading`.
- Ajout `step3.subtype_labels.*` (13 entrées : minor, major, taste, smell, touch, hearing,
  sight, fire, cold, drugs, disease, poison, radiation).
- Le tag "stackable" affiche désormais `stack_effect` (texte DB) au lieu du template
  `{{limit}}` (jamais rempli en base).

---

## Ce qui ne change pas

- `finalizeCreation` (déjà compatible avec le vrai schéma `mutation_id`).
- `/api/char-ref/mutations` / `AdvantagesPanel.jsx` (hors scope, dette existante signalée).
- Les autres options de campagne non câblées (`OPT-W1`, hors `random_mutations` désormais
  traité ici).

---

## Scénario de test (après implémentation)

1. Démarrer une création de personnage → arriver à l'étape 3.
2. **Achat** : vérifier que ~49 mutations réelles s'affichent (noms/descriptions Polaris),
   Purulence absente de la liste, variantes (Difformités, Organe sensoriel, Résistance
   naturelle) affichées comme cartes séparées avec libellé de variante, CGA ouvre bien la
   modale de sous-type avec les 4 vrais sous-types et leur vraie description.
3. Acheter deux fois la même mutation `is_stackable` (ex. Peau renforcée) → vérifier
   l'empilement correct. Acheter deux variantes différentes du même nom (ex. Résistance
   naturelle (feu) + (froid)) → vérifier qu'elles coexistent sans se bloquer mutuellement.
4. **Tirage aléatoire** : lancer le D20 plusieurs fois, vérifier que les résultats
   correspondent à des mutations réelles cohérentes avec la plage D100 tirée, et que le
   nombre de résultats affichés correspond toujours exactement au nombre annoncé par le D20
   (y compris en cas de doublon `is_unique` dans le même lot).
5. **Option de campagne** : désactiver `random_mutations` dans les options de campagne →
   vérifier que la carte "Tirage aléatoire" disparaît de l'étape 3.
6. Terminer le wizard (étape 6 récap + finalize) → vérifier que le nom de la mutation
   (y compris variante/sous-type CGA) s'affiche correctement dans `WizardReview`, et que
   `char_mutations` (avec `subtype_id` le cas échéant) est bien peuplée en base.
