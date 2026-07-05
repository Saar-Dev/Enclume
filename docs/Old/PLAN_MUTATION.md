# PLAN_MUTATION — Stacking des mutations `is_stackable` : count réel + effets corrects
> Session 135 — 2026-07-05
> Statut : ✅ implémenté et testé — migration `109_mutation_stacking.js` + `creationService.js`
> Détail complet (formule, tests, incident lié) : `docs/JOURNAL6.md` "Session 135"
> Dépendance de [[docs/PLAN_STEP4|PLAN_STEP4]] — découvert lors du run à vide sur ce plan
> Archivé dans `docs/Old/` — contenu absorbé par la migration + le JOURNAL, PLAN_STEP4 reste actif

---

## Problème

`char_mutations` (`server/src/db/migrations/96_char_creation_tables.js:31-35`) a un index
unique partiel :
```sql
CREATE UNIQUE INDEX uq_char_mut_no_sub
  ON char_mutations (char_sheet_id, mutation_id)
  WHERE subtype_id IS NULL
```
Un personnage ne peut avoir qu'**une seule ligne** par `mutation_id` (hors mutations à
sous-type, type CGA). Or `finalizeCreation` (`creationService.js:246-258`) fait un `insert`
simple, sans `onConflict`, pour chaque mutation choisie. Acheter ou tirer deux fois une
mutation `is_stackable` **viole la contrainte et fait échouer toute la finalisation**.

La colonne `count` (défaut 1, déjà présente sur `char_mutations`) et le champ `stack_effect`
(texte libre, déjà rédigé en base pour chaque mutation stackable) montrent que le design
prévoyait un empilement par compteur — jamais implémenté, ni à l'insertion ni à la lecture
(`char_mutation_effects_view` fait un `SUM` par ligne jointe, sans tenir compte de `count`).

Jamais rencontré jusqu'ici : aucune mutation `is_stackable` n'existait dans le mock de
`Step3Mutations.jsx`. Redevient atteignable dès que [[docs/PLAN_STEP4|PLAN_STEP4]] branche
les 50 vraies mutations.

---

## Constat clé : l'incrément n'est pas linéaire

Vérification des 8 mutations `is_stackable` contre `docs/Character/Creation/REGLE_CREATION.txt`
et le seed (`95_seed_ref_mutations.js`) : la valeur ajoutée à **chaque rappel** n'est pas
toujours égale à la valeur de base. Une simple multiplication (`mod_FOR × count`) est fausse
dans 3 cas sur 8 :

| Mutation | Valeur de base (1ère fois) | Incrément par rappel | Linéaire ? |
|---|---|---|---|
| Difformités (légère/importante) | PRE -1 / -2 | idem (-1 / -2) | ✅ oui |
| Résistance naturelle (×6) | Résistance concernée +3 | **+1** | ❌ non |
| Peau renforcée | `natural_armor` +3 | **+2** | ❌ non |
| Squelette renforcé | Rés. dommages +2, Rés. Choc +3 | **+1 chacune** | ❌ non |
| Purulence | PRE -2, Rés. maladies +3 | **PRE -1, Rés. maladies +2** | ❌ non |
| Contact corrosif | 1D10 dégâts | +3 dégâts | narratif — aucune colonne calculée aujourd'hui |
| Radiation | 2D6 irradiation | +3 irradiation | narratif — idem |
| Régénération | Stabilisation +2, guérison ÷2 | Stabilisation +1, guérison ÷3 | narratif — idem |

Les 3 mutations narratives (Contact corrosif, Radiation, Régénération) n'ont aucune colonne
dans `char_mutation_effects_view` aujourd'hui (dégâts au contact, durée de guérison — jamais
calculés automatiquement, purement descriptif). Rien à corriger côté vue pour elles : `count`
suffit pour que le texte `stack_effect`/`special_effect` reste exploitable tel quel côté
affichage fiche personnage.

---

## Solution retenue

Formule générale unique, valable pour toutes les mutations (stackables ou non) :
```
valeur_effective = base + (count - 1) × COALESCE(delta_stack, base)
```
- Si aucun delta spécifique n'est défini → `delta_stack` retombe sur `base` → comportement
  linéaire par défaut (couvre Difformités et toute mutation non listée ci-dessous).
- Seules les 3 mutations à incrément asymétrique (Peau renforcée, Résistance naturelle,
  Squelette renforcé, Purulence — 4 en réalité, voir tableau) ont une exception explicite.

### Migration (numéro à confirmer au moment de l'implémentation)
- Ajouter colonne `stack_deltas` (JSONB, nullable) sur `ref_mutations`.
- Backfill, uniquement pour les lignes concernées :
  - Peau renforcée → `{"natural_armor": 2}`
  - Purulence → `{"mod_PRE": -1, "mod_res_disease": 2}`
  - Squelette renforcé → `{"mod_res_damage": 1, "mod_res_shock": 1}`
  - Résistance naturelle (chacune des 6 lignes) → `{"mod_res_<colonne concernée>": 1}`
- Toutes les autres lignes gardent `stack_deltas = NULL` (comportement linéaire par défaut).

### `server/src/services/creationService.js` — `finalizeCreation` STEP 3
- Remplacer l'`insert` simple par un upsert sur les mutations sans sous-type (`subtype_id`
  nul) : incrémente `count` si la ligne existe déjà pour ce `char_sheet_id`/`mutation_id`.
- Point technique à vérifier à l'implémentation : Postgres exige que la cible `ON CONFLICT`
  corresponde exactement à l'index partiel (`WHERE subtype_id IS NULL`) — un simple
  `.onConflict(['char_sheet_id', 'mutation_id'])` Knex risque de ne pas matcher l'index
  partiel et de lever "no unique or exclusion constraint matching the ON CONFLICT
  specification". Nécessite probablement `.onConflict(knex.raw('(char_sheet_id, mutation_id) WHERE subtype_id IS NULL'))` ou équivalent en SQL brut.
- Les mutations à sous-type (CGA, `subtype_id` non nul) restent en `insert` simple —
  `is_unique` les empêche déjà d'être choisies deux fois côté client, aucun empilement
  possible pour elles.

### `char_mutation_effects_view`
- Réécrire chaque `SUM(rm.mod_XXX)` en
  `SUM(rm.mod_XXX + (cm.count - 1) * COALESCE((rm.stack_deltas->>'mod_XXX')::int, rm.mod_XXX))`
  — 13 colonnes concernées (`mod_FOR/CON/COO/INT/VOL/PRE`, `mod_res_damage/shock/drugs/
  disease/poison/radiation`, `natural_armor`).
- Pour `count = 1` (cas normal, non stackable), la formule se réduit à `base` — aucun
  changement de comportement pour les 42 mutations non stackables.

---

## Ce qui ne change pas
- Les colonnes `ref_mutations` existantes (aucune renommée).
- Les mutations `is_unique` / non stackables — comportement identique.
- L'affichage narratif (`special_effect`, `stack_effect`) — reste du texte, pas de calcul
  automatique ajouté pour Contact corrosif/Radiation/Régénération.

---

## Ordre d'implémentation recommandé
Cette tâche doit être traitée **avant ou avec** [[docs/PLAN_STEP4|PLAN_STEP4]] : livrer
PLAN_STEP4 seul exposerait immédiatement le crash de finalisation dès qu'un joueur empile une
mutation réelle (chemin totalement inatteignable avec l'ancien mock).

---

## Scénario de test (après implémentation)

1. Créer un personnage, acheter deux fois **Peau renforcée** en étape 3 → finaliser → vérifier
   en base `char_mutations.count = 2` (une seule ligne, pas deux) et
   `char_mutation_effects_view.natural_armor = 5` (3 + 2, pas 6).
2. Acheter trois fois une **Résistance naturelle (feu)** → vérifier le résistance dommages
   feu = 3 + 1 + 1 = 5 (pas 9).
3. Acheter **Résistance naturelle (feu)** et **Résistance naturelle (froid)** (deux lignes
   distinctes, une fois chacune) → vérifier qu'elles s'additionnent normalement sans
   interférence.
4. Acheter deux fois une **Difformité légère** → vérifier PRE -2 (linéaire, comportement par
   défaut sans entrée `stack_deltas`).
5. Vérifier qu'une mutation non stackable achetée une seule fois garde exactement son
   comportement actuel (non-régression).
