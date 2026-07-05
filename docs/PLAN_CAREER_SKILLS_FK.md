# PLAN_CAREER_SKILLS_FK — FK ref_career_skills.skill_id → ref_skills.id + suppression skill_group
> Session 134 (2026-07-05) — Statut : **en cours**

---

## Contexte

En codant le lot 2 (`108_seed_ref_careers_lot2.js`), une incohérence de libellé `skill_group`
a été trouvée en base (`Communication/Relations sociales` vs `Communications/Relations sociales`
— 16 vs 11 lignes). Investigation : `ref_career_skills.skill_group` est un **texte libre retapé
à la main** dans chaque migration de seed, sans aucun lien avec `ref_skills.family` (la vraie
catégorie canonique utilisée par `SkillsPanel.jsx`). Les deux vocabulaires ne se sont jamais
alignés (ex. `ref_skills.family` utilise des espaces autour du `/` : `"Communication / Relations
sociales"`, alors que `skill_group` n'en a jamais eu).

Par ailleurs `ref_career_skills.skill_id` n'a **aucune contrainte FK** vers `ref_skills.id`
(PIÈGE 1, déjà documenté) : une faute de frappe s'insère silencieusement sans erreur.

**Décision Saar** : toute compétence de `ref_career_skills` doit obligatoirement référencer un
skill existant dans `ref_skills` — c'est la seule raison d'être de cette colonne. Correction
robuste et pérenne exigée, pas de contournement.

## Vérification préalable (instrumentée)

`ref_career_skills` compte actuellement 208 lignes (lots 1+2 déjà appliqués). Requête de
vérification directe (LEFT JOIN `ref_skills`, `WHERE rs.id IS NULL`) : **0 orphelin**. La
contrainte FK peut donc être ajoutée sans échec ni perte de données.

## Décision d'architecture

1. **Ajouter une vraie contrainte FK** sur `ref_career_skills.skill_id → ref_skills.id`
   (`ON DELETE RESTRICT`, convention déjà utilisée dans `48_ref_equipment.js` pour ce type de
   référence). Toute future faute de frappe sera rejetée par la base au lieu de s'insérer
   silencieusement.
2. **Supprimer la colonne `skill_group`** (texte libre redondant, source du bug) — le
   regroupement UI se fera désormais via `ref_skills.family` (JOIN), une seule source de vérité.
3. **Hors scope, dette identique notée séparément** : `ref_background_skills.skill_id` a le même
   défaut (pas de FK) — table différente, pas touchée ici (`98_ref_backgrounds.js:49`).

## Fichiers touchés

**Nouvelle migration** : `server/src/db/migrations/111_ref_career_skills_fk.js`
- `up()` :
  1. `ALTER TABLE` → `table.foreign('skill_id').references('id').inTable('ref_skills').onDelete('RESTRICT')`
  2. `DROP COLUMN skill_group`
- `down()` : redonne la colonne `skill_group` (texte, nullable) + retire la contrainte FK

**Backend** — `server/src/services/creationService.js:133` (`getStep4RefData`) :
```js
// Avant
db('ref_career_skills').select('*'),
// Après
db('ref_career_skills as rcs').join('ref_skills as rs', 'rcs.skill_id', 'rs.id').select('rcs.*', 'rs.family'),
```
JOIN interne sûr désormais grâce à la FK (plus aucune ligne ne peut pointer vers un skill inexistant).

**Frontend** — `client/src/components/creation/CareersAllocator.jsx:44-46` :
```js
// Avant
if (!acc[sk.skill_group]) acc[sk.skill_group] = []
acc[sk.skill_group].push(sk)
// Après
if (!acc[sk.family]) acc[sk.family] = []
acc[sk.family].push(sk)
```
Seule ligne touchée — le reste du composant utilise déjà la variable `group` abstraite.

## Ce qui ne change pas

- Le vocabulaire affiché change de forme (`Communication/Relations sociales` →
  `Communication / Relations sociales`, version canonique `ref_skills.family`) — attendu.
- `ref_background_skills` non touché (dette séparée).
- Lots 3-6 (pas encore codés) : utiliseront directement ce JOIN, plus aucun risque de faute de
  frappe `skill_group` pour ces lots.

## Décision annexe (scope lots 3-6)

Audit de consommation réelle des tables enfants `ref_careers` :
- `ref_career_skills`, `ref_career_titles` : affichés dans `CareersAllocator.jsx` ✅
- `ref_career_education` : vérifiée dans `creationService.js:107` (`validateCareerEducation`) ✅
- `ref_career_point_categories` : fetchée par le backend (`getStep4RefData`) mais **jamais
  affichée côté frontend** — inerte pour l'instant
- `ref_career_equipment`, `ref_career_random_benefits` : **jamais lues nulle part**, ni backend
  ni frontend — données mortes depuis le lot 2

**Décision Saar (2026-07-05)** : continuer à peupler les 4 tables enfants complètes pour les lots
3-6 (comme au lot 2), malgré l'absence de consommation actuelle côté equipment/benefits/
point_categories — les données LdB sont prêtes dans les `.cjs` sources, éviter de les retraiter
plus tard. Le branchement UI de ces 3 tables reste un chantier séparé, non planifié ici.

## Test prévu

1. Round-trip `up`/`down`/`up` (comptage 208 lignes `ref_career_skills` inchangé)
2. Vérification FK active : tentative d'insert avec `skill_id` invalide doit échouer côté DB
3. Wizard Step4 : les groupes de compétences s'affichent avec le vocabulaire `ref_skills.family`
