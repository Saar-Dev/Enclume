# JOURNALTEMP — Session Wizard (2026-06-30)
> Scratch pad périssable — consolider vers JOURNAL5.md en fin de session

---

## ⚡ PROCHAINE SESSION — Point d'entrée (2026-06-30)

**Migrations présentes dans `server/src/db/migrations/` :**

| Fichier | État | Contenu |
|---|---|---|
| `92_ref_advantages.js` | ✅ prêt | ref_advantages + 76 avantages/désavantages |
| `93_ref_careers.js` | ✅ prêt | ref_careers + 7 tables assoc. (ref_careers sera VIDE — seeds déférées) |
| `94_drop_and_cleanup.js` | ✅ prêt | DROP char_advantages + DROP old ref_mutations CASCADE |
| `95_new_ref_mutations.js` | ✅ prêt | 5 tables normalisées ref_mutations |
| `95_seed_ref_mutations.js` | ✅ prêt | 50 mutations Polaris (idMap pattern) |
| `96_char_creation_tables.js` | ✅ prêt | char_mutations UUID + char_polaris + char_careers + char_traits + vue |
| `97_char_creation_core.js` | ✅ prêt | campaigns.ambiance + campaign_rules + char_sheet.creation_state + char_pc_ledger + ref_genotypes enrichi |

**Migrations à écrire (prochaine session) :**

- `98_ref_backgrounds.js` — source : `docs/Character/Creation/PLAN_CREATION_E3.md` ou PLAN_E4 — lire avant de coder. Corriger BUG M4 (classes_moyennes 2e entrée sans skills).
- `99_char_advantages_v2.js` — source : `docs/Character/Creation/PLAN_CREATION_E5.md` (ou PLAN_E4 ?) — lire avant de coder.

**Après les deux migrations :**
```powershell
cd server
npx knex migrate:latest --knexfile knexfile.cjs
```
→ Vérifier 0 erreur. Si erreur → corriger avant de passer au backend.

**Pièges à ne pas oublier :**
- `ref_mutations.mod_for` etc. sont LOWERCASE dans ref_genotypes mais UPPERCASE dans ref_mutations (deux tables différentes, pas de conflit).
- Career seeds (`93_seed_ref_careers_lot*.cjs`) sont au format Knex seed, pas migration — ne pas les intégrer aux migrations. ref_careers sera vide.
- `knexfile.cjs` est à la racine de `server/` (`server/knexfile.cjs`). Commande depuis `Enclume/` : `cd server && npx knex migrate:latest --knexfile knexfile.cjs`.
- BUG M4 : dans PLAN_E4, la 2e insertion `classes_moyennes` (parent=grande_cite) n'a pas d'id stocké → skills non insérés. Corriger en stockant `const [cm2] = await knex(...).returning('id')` et en répliquant les inserts skills pour `cm2.id`.

**Lectures obligatoires avant backend (COUCHE 3, non terminée) :**
- `REGLE_CREATION.txt` lignes 1107–1352
- `REGLE_PROFESSION.md` lignes 1107–2383
- `server/src/routes/character/char-sheet.js` (routes existantes avant d'en ajouter)

---

---

## ÉTAT À LA SAUVEGARDE (13% contexte restant) — conservé pour historique

### ✅ B1 — CLOS
`Step3Mutations.jsx` ligne 282 : `.map(st => ...)` → `.map(sub => ...)` + 4 occurrences `st.subtype_id` → `sub.subtype_id` + `handleSelectSubtype(st)` → `handleSelectSubtype(sub)`.

### ✅ A3 — CLOS (résout aussi B2, B3, B4, B7 + bug non documenté Step1)
- `creationStore.js` CRÉÉ. `WizardCreation.jsx` RÉÉCRIT avec useCreationStore.
- `Step1Attributes.jsx` ligne 335 : `onClick={onNext}` → `onClick={() => onNext({ pcSpent: pcAlloues })}`.
- `Step4Experience.jsx` handleSubmit : `availablePC: remainingPC` → `pcSpent: totalPC`.
- `creation.json` : +sections `step5` + `wizard`.

### ✅ B5, B6, B8, B9, i18n, bouton Précédent Step3 — CLOS (session précédente)

### 🔴 EN COURS AVANT COUPURE : Step4Summary.jsx (écran blanc)
**Cause :** Step4Summary.jsx ne contient que des `export const` (données mock). Aucun `export default`. C'est une version enrichie de mockStep4Data.js (points_per_year: 10).
**Fix prévu :** Ajouter `export default function Step4Summary(props)` — composant récap + boutons Précédent/Valider.

---

## AUDIT COMPLET MIGRATIONS + ARCHITECTURE — 2026-06-30

> Réalisé après lecture de : JOURNALWIZARD.md, PLAN_E1+2.md, PLAN_E3.md, PLAN_E4.md, PLAN_E5.md,
> docs/Character/Creation/migrations/ (tous les fichiers), server/src/db/migrations/38_char_ref_mutations.js,
> server/src/db/migrations/40_char_advantages.js, server/src/db/migrations/33_char_ref_genotypes.js,
> server/knexfile.cjs, server/src/routes/

---

### DÉCOUVERTE #0 — Chemin réel des migrations

Le répertoire de migrations est `server/src/db/migrations/` (pas `server/migrations/`).
PLAN_E1+2.md cite le mauvais chemin. À corriger dans tous les plans.
Dernière migration appliquée : `91_drone_charge_utile.js`.

---

### DÉCOUVERTE #1 — ref_mutations existe déjà (migration 38)

**Migration 38** crée `ref_mutations` avec :
- PK = `muta_numero TEXT` (ex: 'muta_001')
- 33 mutations, colonnes : mod_for/coo/con/pre/vol/per, mod_acrobatie, etc.

**docs/96_ref_mutations.cjs** essaie de créer une NOUVELLE `ref_mutations` avec :
- PK = `mutation_id INTEGER`
- 50 mutations, colonnes différentes (mod_FOR, mod_CON majuscules, cost_pc, d100_range_start…)

→ `createTable('ref_mutations', ...)` échouera car la table existe déjà.

**Fix requis :** Ajouter `DROP TABLE IF EXISTS ref_mutations CASCADE` AVANT la création de la nouvelle table. Cette opération est safe uniquement APRÈS avoir supprimé `char_advantages` (qui a FK → ref_mutations.muta_numero).

**Migration 40 (`char_advantages`)** : Crée `char_advantages` avec FK → `ref_mutations.muta_numero`. Sera supprimée par docs/94. La cascade ensuite sur ref_mutations sera propre.

---

### DÉCOUVERTE #2 — Bug ordre migrations : vue créée avant la table qu'elle référence

**docs/95** crée `char_mutation_effects_view` qui fait :
```sql
JOIN ref_mutations rm ON rm.mutation_id = cm.mutation_id
```

**docs/96** crée la NOUVELLE `ref_mutations` avec la colonne `mutation_id`.

Si docs/95 tourne avant docs/96 :
- Ancienne ref_mutations existe (muta_numero TEXT, pas de colonne mutation_id)
- `CREATE VIEW` → ERREUR PostgreSQL : "column mutation_id does not exist"

**Fix requis :** Déplacer `CREATE VIEW char_mutation_effects_view` de docs/95 vers docs/96 (après la création de la nouvelle ref_mutations).

---

### DÉCOUVERTE #3 — char_mutations PK avec colonne nullable

Dans docs/95 :
```javascript
table.integer('subtype_id').references('subtype_id').inTable('ref_mutation_subtypes')
// pas de .notNullable()
table.primary(['char_sheet_id', 'mutation_id', 'subtype_id'])
```

En PostgreSQL, les colonnes d'une PRIMARY KEY sont implicitement NOT NULL.
→ `subtype_id` serait forcé NOT NULL par le PK, MAIS le service code utilise `subtype_id: null` pour les mutations sans sous-type.
→ INSERT échouerait sur toute mutation sans sous-type.

**Décision requise (avant code) :**
- Option A : Supprimer subtype_id du PK → PK = (char_sheet_id, mutation_id) + UNIQUE partielle pour les sous-types
- Option B : Utiliser un `id UUID PRIMARY` + UNIQUE sur (char_sheet_id, mutation_id) WHERE subtype_id IS NULL

**Recommandation :** Option B — UUID PK. Plus flexible, cohérent avec char_careers (qui a uuid PK). La vue et le service code doivent rester inchangés.

---

### DÉCOUVERTE #4 — ref_genotypes : colonnes lowercase

**Migration 33** crée ref_genotypes avec colonnes `mod_for, mod_con, mod_coo, mod_ada, mod_per, mod_int, mod_vol, mod_pre` (minuscules).

**PLAN_E1+2** enrichit ref_genotypes avec `illustration_url, description, pc_cost, has_deserter_option` — OK.

**Attention dans le service code** : PLAN_E1+2 lit les modificateurs via `g.mod_for` etc. (lowercase) et les mappe vers `{ FOR: g.mod_for, CON: g.mod_con, ... }` côté JS. C'est correct. Pas de bug, mais à documenter.

---

### DÉCOUVERTE #5 — Conflit numérotation migrations (le vrai)

| Numéro | docs/ prévoit | server/38+ a déjà |
|---|---|---|
| 038 | — | ref_mutations V1 (muta_numero TEXT) |
| 040 | — | char_advantages V1 |
| 092 | ref_advantages | — |
| 093 | ref_careers + seeds | — |
| 094 | drop char_advantages | — |
| 095 | char_mutations + view (BUG) | — |
| 096 | new ref_mutations | — |
| **096** | char_creation_core (PLAN_E1+2) | — |
| **097** | ref_backgrounds (PLAN_E4) | — |
| **097** | char_advantages V2 (PLAN_E5) | — |

→ 3 conflits de numérotation simultanés.

---

### TABLE DE RÉSOLUTION — Numérotation finale proposée

| N° final | Fichier cible | Contenu | Source | Modifications |
|---|---|---|---|---|
| 92 | `92_ref_advantages.cjs` | ref_advantages + seed (76 entrées) | docs/92 | aucune |
| 93 | `93_ref_careers.cjs` | ref_careers | docs/93 | aucune |
| `93_seed_*` | idem | seeds (6 fichiers, OK ordre alpha) | docs/93_seed_* | aucune |
| 94 | `94_drop_and_cleanup.cjs` | DROP char_advantages + DROP old ref_mutations CASCADE | docs/94 MODIFIÉ | + DROP ref_mutations CASCADE |
| 95 | `95_new_ref_mutations.cjs` | CREATE new ref_mutations + seed + CREATE VIEW | docs/96 RENOMMÉ + MODIFIÉ | déplacer view ici depuis docs/95 |
| 96 | `96_char_creation_tables.cjs` | char_mutations (PK uuid) + char_polaris + char_personal_advantages + char_careers + char_traits | docs/95 RENOMMÉ + MODIFIÉ | fix PK char_mutations, retirer view |
| 97 | `97_char_creation_core.cjs` | campaigns.ambiance + campaign_rules + char_pc_ledger + char_sheet.creation_state + ref_genotypes enrichment | PLAN_E1+2 — À CRÉER | — |
| 98 | `98_ref_backgrounds.cjs` | ref_backgrounds + ref_background_skills + ref_setbacks + char_creation_snapshot + seed | PLAN_E4 RENOMMÉ (était 097) | fix seed classes_moyennes (bug M4) |
| 99 | `99_char_advantages_v2.cjs` | char_advantages V2 (soft-delete, snapshot_data) + pc_postcreation | PLAN_E5 RENOMMÉ (était 097) | — |

**Clé :** docs/95 et docs/96 sont INVERSÉS dans le résultat final (95→96, 96→95 avec modifications).

---

### DÉCOUVERTE #6 — classes_moyennes seed incomplet dans PLAN_E4

Migration 98 (anciennement PLAN_E4 097) insère deux entrées `classes_moyennes` :
```javascript
const [classesMoy] = await knex('ref_backgrounds').insert({
  code: 'classes_moyennes', parent_code: 'station_moyenne', ...
}).returning('id')
await knex('ref_backgrounds').insert({     // ← pas de [id] = stocké
  code: 'classes_moyennes', parent_code: 'grande_cite', ...
})                                          // ← skills insérés uniquement pour classesMoy.id
```

La deuxième entrée (grande_cite) n'a aucun skill associé.

**Fix requis :** Stocker l'id de la 2e entrée et insérer les mêmes skills.

---

### BUG UI — Step4Summary.jsx

**Situation actuelle :** Step4Summary.jsx contient uniquement des `export const` (données de référence), pas de composant React. `export default` absent → écran blanc (`SyntaxError: doesn't provide an export named 'default'`).

**À corriger avant tout test de l'étape 4.**

---

## RECHERCHE PROFESSIONNELLE — Décisions tranchées (2026-06-30)

> Sources : PostgreSQL docs, iheavy.com, dbi-services.com, GitHub gists ibenitez + mhfs,
> MySQL-RPG-Schema (jgoodman), Knex.js official docs, oneuptime.com PostgreSQL NULLS NOT DISTINCT

### D1 ✅ — Numérotation migrations : CONFIRMÉE

La table 92→99 ci-dessus est correcte et conforme aux bonnes pratiques Knex :
- Knex trie les migrations par ordre alphabétique/numérique du nom de fichier
- Chaque migration a une responsabilité unique (Single Responsibility)
- Les parents avant les enfants (ref_mutations avant char_mutations qui l'utilise via vue)
- Jamais éditer une migration déjà appliquée → nouvelles migrations uniquement

**Décision finale :** docs/95 et docs/96 sont bien swappés dans le résultat (95→95_new_ref_mutations, 96→96_char_creation_tables), avec modifications de contenu.

---

### D2 ✅ — PK de char_mutations : UUID + INDEX PARTIELS

**Consensus professionnel clair :**
> "Including nullable columns in composite primary keys is generally not recommended due to potential complications in maintaining data integrity." — iheavy.com

> "Null values are not allowed in any column of a composite primary key." — PostgreSQL standard

**Solution retenue : UUID surrogate PK + deux index partiels**

Pattern confirmé par PostgreSQL docs + GitHub gists professionnels :

```sql
-- Migration 96 (char_creation_tables) — char_mutations
CREATE TABLE char_mutations (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  char_sheet_id INTEGER NOT NULL REFERENCES char_sheet(id) ON DELETE CASCADE,
  mutation_id   INTEGER NOT NULL,  -- pas de FK car ref_mutations peut avoir des lacunes
  subtype_id    INTEGER REFERENCES ref_mutation_subtypes(subtype_id),
  -- colonnes métier...
);

-- Index partiel 1 : unicité quand PAS de sous-type (subtype_id IS NULL)
CREATE UNIQUE INDEX uq_char_mut_no_sub
  ON char_mutations (char_sheet_id, mutation_id)
  WHERE subtype_id IS NULL;

-- Index partiel 2 : unicité quand sous-type présent
CREATE UNIQUE INDEX uq_char_mut_with_sub
  ON char_mutations (char_sheet_id, mutation_id, subtype_id)
  WHERE subtype_id IS NOT NULL;
```

**Pourquoi partial indexes et pas NULLS NOT DISTINCT ?**
`NULLS NOT DISTINCT` est PG 15+. La Raspberry Pi tourne probablement PG 13 ou 14 (Raspberry Pi OS Bullseye = PG 13). Les index partiels sont disponibles depuis PG 8. Solution universelle.

**Knex syntax dans la migration :**
```javascript
table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
table.integer('char_sheet_id').notNullable()
  .references('id').inTable('char_sheet').onDelete('CASCADE')
table.integer('mutation_id').notNullable()
table.integer('subtype_id').nullable()
  .references('subtype_id').inTable('ref_mutation_subtypes')
// après la table :
await knex.raw(`
  CREATE UNIQUE INDEX uq_char_mut_no_sub
    ON char_mutations (char_sheet_id, mutation_id) WHERE subtype_id IS NULL;
  CREATE UNIQUE INDEX uq_char_mut_with_sub
    ON char_mutations (char_sheet_id, mutation_id, subtype_id) WHERE subtype_id IS NOT NULL;
`)
```

**Service code (inchangé) :** `subtype_id: null` fonctionne. L'index partiel 1 garantit l'unicité.

---

### D3 ✅ — char_personal_advantages ≠ char_advantages V2

**Deux tables, deux rôles distincts :**

| Table | Rôle | Source |
|---|---|---|
| `char_personal_advantages` (migration 96) | Traits narratifs libres issus du background (Step 4) — texte libre, sans FK vers ref_advantages | docs/95 |
| `char_advantages` V2 (migration 99) | Avantages/désavantages formels Polaris — FK vers `ref_advantages`, soft-delete, constraint registry | PLAN_E5 |

Coexistence confirmée, pas de conflit de rôle.

---

## TODO LISTE — Pré-code (à traiter dans cet ordre)

### COUCHE 0 — Décisions d'architecture

- [x] **D1 ✅** — Numérotation 92→99 confirmée (voir table ci-dessus)
- [x] **D2 ✅** — PK char_mutations = UUID + index partiels (voir code ci-dessus)
- [x] **D3 ✅** — char_personal_advantages et char_advantages V2 : rôles distincts, coexistence OK

### COUCHE 1 — Fix UI bloquant

- [x] **U1 ✅ DÉJÀ FAIT** — Step4Summary.jsx a `export default function Step4Summary` ligne 6, styles complets, lookups fonctionnels. Basé sur une version antérieure dans le JOURNALTEMP précédent.

### COUCHE 2 — Migrations server/ ✅ (2026-06-30)

> Stratégie finale : docs/ = archives planification. Fichiers serveur écrits directement.

- [x] **M1 ✅** — docs/94 : `DROP TABLE IF EXISTS ref_mutations CASCADE` ajouté
- [x] **M2 ✅** — docs/96 (SQL brut) → réécrit JS Knex : `95_new_ref_mutations.js` (tables) + `95_seed_ref_mutations.js` (50 mutations, pattern idMap)
- [x] **M3 ✅** — docs/95 → réécrit : `96_char_creation_tables.js` (UUID PK + partial idx + vue EN DERNIER + knex.raw() correct)
- [ ] **M4** — PLAN_E4 seed classes_moyennes 2e entrée → à corriger lors écriture migration 98
- [x] **M5 ✅** — Chemin server/src/db/migrations/ correct dans toutes les migrations créées
- [x] **M6+M7 ✅** — Numéros 98/99 : seront corrects lors de l'écriture de ces migrations
- [x] **M8 ✅** — 92, 93, 94 convertis ESM→CJS (PowerShell -replace)
- [x] **⚠️ Career seeds DÉFÉRÉS** — `93_seed_*` = format Knex seed (export const seed), pas migration. Conversion en session dédiée. ref_careers sera vide — UI affiche liste vide, pas d'erreur.

**Fichiers dans `server/src/db/migrations/` (prêts pour knex migrate:latest) :**
`92_ref_advantages.js` | `93_ref_careers.js` | `94_drop_and_cleanup.js`
`95_new_ref_mutations.js` | `95_seed_ref_mutations.js` | `96_char_creation_tables.js`

### COUCHE 3 — Lecture obligatoire avant backend

- [x] **L1 ✅** — `93_ref_careers.cjs` lu : ref_careers.id = UUID, 8 tables associées
- [ ] **L2** — Lire `REGLE_CREATION.txt` lignes 1107–1352 (section finale non lue)
- [ ] **L2** — Lire `REGLE_CREATION.txt` lignes 1107–1352 (section finale non lue)
- [ ] **L3** — Lire `REGLE_PROFESSION.md` lignes 1107–2383 (12 professions non vérifiées)
- [ ] **L4** — Lire `server/src/db/migrations/36_char_sheet.js` — confirmer colonnes char_sheet existantes (creation_state absent ?)
- [ ] **L5** — Lire `server/src/routes/character/char-sheet.js` — confirmer routes existantes avant d'ajouter

### COUCHE 4 — Création migration 97 (char_creation_core) ✅ (2026-06-30)

- [x] **BE1 ✅** — `server/src/db/migrations/97_char_creation_core.js` CRÉÉ
  - `ALTER TABLE campaigns ADD COLUMN ambiance TEXT DEFAULT 'INTERMEDIAIRE'`
  - `CREATE TABLE campaign_rules` (campaign_id UUID PK → campaigns, 7 options booléennes)
  - `ALTER TABLE char_sheet ADD COLUMN creation_state TEXT DEFAULT NULL`
  - `DROP TABLE IF EXISTS char_pc_ledger` + `CREATE TABLE char_pc_ledger` (UUID PK, pc_total=20, pc_spent_step1-5, pc_gained_desavantages)
  - `ALTER TABLE ref_genotypes ADD COLUMN` × 5 : description, illustration_url, prereq_professions JSONB, pc_cost INTEGER, has_deserter_option BOOLEAN
  - Seeds : UPDATE 4 génotypes (HUMAIN/HYB_NAT/GEN_HYB/TEC_HYB) avec description + pc_cost + prereq_professions + has_deserter_option
  - Source : PLAN_E1+2.md §5, converti ESM → CJS

### COUCHE 5 — Migrations 98-99 + test DB

- [x] **BE2 ✅** — 92–96 déjà dans `server/src/db/migrations/` (couche 2)
- [ ] **BE3** — Créer `server/src/db/migrations/98_ref_backgrounds.js` (source : PLAN_E4, fix M4 classes_moyennes 2e entrée)
- [ ] **BE4** — Créer `server/src/db/migrations/99_char_advantages_v2.js` (source : PLAN_E5)
- [ ] **BE5** — `cd server && npx knex migrate:latest --knexfile src/db/knexfile.cjs` → vérifier 0 erreur

### COUCHE 6 — Backend wizard (après migrations validées)

- [ ] **BE6** — Créer `server/src/routes/creation.js`
- [ ] **BE7** — Créer `server/src/services/creationService.js` (phases 1–4 selon PLAN_E1+2 + E3 + E4)
- [ ] **BE8** — Ajouter fonctions wizard à `shared/polarisUtils.js` (getEffectiveAttributes, validateStep2Constraints, calcMutationsCost, etc.)
- [ ] **BE9** — Créer `server/src/services/advantageService.js` + `advantageConstraints.js`
- [ ] **BE10** — Monter route creation.js dans le serveur principal

### COUCHE 7 — Correction fidélité règles (après backend fonctionnel)

- [ ] **R1** — mockStep4Data.js : `points_per_year: 5` → `10`
- [ ] **A6** — career_id dans selectedCareers : passer UUID de DB, pas le code string
- [ ] **A7** — filteredCareers : filtrage par geo origin réel, pas juste restricted_geo présent/absent
- [ ] **A8** — education_scolaire : deux entrées dans mockStep4Data avec même code → gérer via allowed_parents (comme classes_moyennes déjà fait)
- [ ] **R3** — Décider : mutations coût négatif achetables ou aléatoire uniquement
- [ ] **R4** — Synchroniser âge minimum avec années de carrière
- [ ] **R5** — Ajouter years_added (études supérieures +2 ans) dans le calcul d'âge
- [ ] **R6** — Vérifier mod_ADA et mod_PER dans Step2Genotype.jsx (HYPOTHÈSE: absents)
- [ ] **R7** — Vérifier 12 professions non lues dans REGLE_PROFESSION.md
- [ ] **R8** — Lire section finale REGLE_CREATION.txt

### COUCHE 8 — Conventions (dernière priorité, avant livraison)

- [ ] **C1** — Remplacer styles inline par classes CSS (index.css Section 10) dans tous les composants creation/
- [ ] **C2** — Ajouter className="btn" sur tous les boutons
- [ ] **C3** — Strings hardcodées dans BackgroundSelector.jsx → i18n
- [ ] **C4** — Strings hardcodées dans CareersAllocator.jsx → i18n
- [ ] **C5** — Strings dans WizardCreation.jsx getInfos() → i18n
- [ ] **C6** — Step0Method.jsx URL MinIO localhost → `import.meta.env.VITE_MINIO_URL`

---

## POINTS POSITIFS (à conserver tels quels)

- `ref_advantages` (docs/92) : 76 entrées, schéma solide
- `ref_mutations` nouveau (docs/96) : 50 mutations, tables normalisées (subtypes, skills, discounts, incompatibilities, vue SQL)
- PLAN_E5 constraint registry : pattern professionnel, registre déclaratif des contraintes
- Step3Mutations.jsx : logique mock solide après corrections B1/B5/B6
- creationStore.js : pattern Zustand correct, dérivation getPcDispo()
- PLAN_E1+2 à E5 : documentation d'architecture complète, réutilisable

---

## FICHIERS NON LUS (à lire avant implémentation backend)

- `migrations/93_ref_careers.cjs` — structure ref_careers inconnue (UUID ? TEXT PK ?)
- `REGLE_CREATION.txt` lignes 1107–1352
- `REGLE_PROFESSION.md` lignes 1107–2383 (~12 professions)
- `server/src/db/migrations/36_char_sheet.js` — colonnes existantes
- `server/src/routes/character/char-sheet.js` — routes existantes

---

_Dernière mise à jour : 2026-06-30_
