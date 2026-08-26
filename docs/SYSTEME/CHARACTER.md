# CHARACTER.md — Documentation technique du domaine Character
> Domaine : Fiche personnage Polaris & modules joueur
> Dernière mise à jour : 2026-08-16 — Clôture `docs/PLANS/PLAN_WIZARD_MATERIEL_GAUGES.md` :
> ressource `char_gauges` (jauges de matériel, gérées MJ) + validation MJ item par item de l'inventaire
> (`char_inventory.validated_by_gm`), §3/§4/§5/§7 revus.
>
> Audit de compréhension approfondie 2026-08-26 (suite) : 2 références de migration encore stales
> corrigées (`validated_by_gm`, `char_gauges` — toutes deux citaient "242", en réalité
> `15_char_inventory.js`/`13_char_gauges.js`) ; routes mutations et toggle-learned confirmées ligne à
> ligne (`char-sheet.js:792-859`, `:394-428`) ; séquence de seed `char_gauges` (`ON CONFLICT ...
> ignore()`, agrégation multi-carrières) confirmée contre `creationService.js`. Trouvaille non
> documentée avant ce jour : l'exception `isVaultOwner` sur les routes "GM uniquement" (§1).
> Statut : Modules 1–6 + Module XP + Blessures + Armures + Inventaire + Jauges de matériel — 52
> migrations appliquées

---

## Sommaire

1. [Contexte et périmètre](#1-contexte-et-périmètre)
2. [Structure des fichiers](#2-structure-des-fichiers)
3. [Schéma SQL — domaine Character](#3-schéma-sql--domaine-character)
4. [Routes API](#4-routes-api)
5. [Flux de données — composants](#5-flux-de-données--composants)
6. [Logique métier — règles de calcul](#6-logique-métier--règles-de-calcul)
7. [Composants React](#7-composants-react)
8. [Conventions et règles du domaine](#8-conventions-et-règles-du-domaine)
9. [Pièges PC1–PC24](#9-pièges-pc1pc24)

---

## 1. Contexte et périmètre

### Rôle du domaine

Gère la fiche personnage Polaris et tous les modules joueur associés (compétences, mutations, pouvoirs Polaris, inventaire futur, bourse future…). Remplace l'ancien écosystème Google Sheets.

### ⚠️ Tables hors-scope de ce document

Les tables suivantes appartiennent au domaine **VTT** et sont documentées dans `docs/ASBUILT.md` et `docs/SYSTEME/` :

`users` · `campaigns` · `campaign_members` · `battlemaps` · `tokens` · `characters` · `dice_rolls` · `player_locations` · `documents` · `walls` · `zones` · `texture_packs` · `texture_pack_categories` · `voxel_textures` · `battlemap_texture_usage`

Le seul point de contact avec le domaine VTT est :
```
characters.id (UUID) ←── char_sheet.character_id (FK ON DELETE CASCADE)
```
Supprimer un `character` VTT supprime automatiquement toute sa fiche Polaris.

### Ownership et accès

> **Toutes les routes : joueur propriétaire (`characters.user_id === req.user.id`) OU rôle GM de la campagne.**

**Ajouté (audit 2026-08-26) — exception `isVaultOwner` non documentée avant ce jour.** Sur un
personnage Coffre (`campaign_id NULL`, voir `docs/VOCABULARY.md` "Coffre (compte)"), il n'existe
aucun GM de campagne : `router.param('characterId')` (`char-sheet.js` ~ligne 100-111) pose alors
`req.isVaultOwner = true` pour son propriétaire, qui obtient exactement les mêmes droits qu'un GM
sur cette fiche précise. Toutes les routes marquées **GM uniquement** dans ce document (attributs
`char-sheet.js:279`, skills `:435`, XP `:507`, mutations POST/DELETE `:827`/`:847`, augmentation de
sols `:1053`) testent en réalité `!req.isGm && !req.isVaultOwner`, jamais `!req.isGm` seul — vérifié
sur les 6 occurrences du fichier. Ne pas confondre avec un simple `isOwner` (PC6) : un joueur
propriétaire d'un personnage de campagne normal n'a toujours pas ces droits.

---

## 2. Structure des fichiers

```
server/src/routes/character/
  char-sheet.js       — routes fiche personnage (corrigé 2026-08-26 : 2625 lignes / ~78 routes
                        aujourd'hui, plus 22 — drone/exo/macros/moding/mutations/fatigue/clone-to-vault
                        ajoutés depuis)
  ref.js              — 4 routes données de référence (genotypes/skills/mutations/advantages —
                        corrigé 2026-08-26, GET /advantages ajouté depuis, plus 3)

client/src/character/
  CharacterWindow.jsx  — fenêtre flottante drag+resize — 4 onglets : Fiche/Bio/Matériel/Paramètres.
                         Porte le DndContext unique de l'onglet Matériel (drag & drop inventaire,
                         docs/Old/PLAN_INVENTORY_UX.md) — un DndContext par fenêtre de personnage,
                         donc pas de drag & drop possible entre deux CharacterWindow différentes.
  CharacterSheet.jsx   — orchestrateur Modules 1–6 + effectiveMalus + Initiative (session 52)
  SkillsPanel.jsx      — Module 5 Compétences (arborescence CHC session 4)
  AdvantagesPanel.jsx  — Module 6 Avantages & Désavantages (lift-state-up session 50)
  ArmorWoundPanel.jsx  — orchestrateur onglet Matériel, colonne blessures/armures : localisations +
                         silhouette uniquement (Sac/Ceinture/Coffre déplacés vers WeaponPanel.jsx,
                         chantier UX Matériel 2026-08-05/06)
  WeaponPanel.jsx      — armes équipées (MG/MD/2M/Tr) + section "Conteneurs portés" (Sac/Ceinture via
                         ContainerPanel.jsx) + bouton Customisation (moding)
  InventoryBanner.jsx  — bandeau poids/sols toujours visible (même inventaire replié) — jauge de poids,
                         sols éditables avec asymétrie MJ/joueur
  InventoryPanel.jsx   — inventaire (Sac/Ceinture/Coffre) + catalogue GM filtré/paginé + drag & drop
  GaugesPanel.jsx       — jauges de matériel (char_gauges), onglet Matériel, stepper +/- MJ only
                          (`docs/PLANS/PLAN_WIZARD_MATERIEL_GAUGES.md`)
  LocationPanel.jsx    — une localisation (Tête/Corps/Bras/Jambe) : multi-couches + grille blessures
  ContainerPanel.jsx   — Sac/Ceinture/Coffre : équipement conteneur (monté dans WeaponPanel.jsx)
  SilhouettePanel.jsx  — SVG silhouette, colorée par pire blessure par localisation

client/src/lib/
  useInventoryData.js    — sélecteur characterStore.inventoryByCharId + fetch initial dédupliqué
  inventoryMutations.js  — setItemSlot/setItemContainer/deleteItem, mutations réseau+store partagées
                            entre les `<select>`/boutons et le drag & drop
  inventoryDataSync.js   — refreshDerivedTotals (poids/seuil recalculés après mutation locale)
  useGaugesData.js       — sélecteur characterStore.gaugesByCharId + fetch initial dédupliqué (même
                            patron que useInventoryData), consommé par GaugesPanel.jsx ET
                            StepMaterielEtBiens.jsx (Wizard Step6)
  gaugesDataSync.js      — populateGauges(characterId), dédup par characterId, appelable hors composant
  gaugesMutations.js     — adjustGauge (PATCH .../gauges/:categoryKey + écriture store), MJ only côté
                            serveur

shared/
  woundConstants.js    — WOUND_LOCATIONS / SEVERITIES / MAX_COUNTS / PENALTIES / SEVERITY_COLORS
  armorConstants.js    — ARMOR_CATEGORY_MALUS / LOCATION_TO_SLOT / SLOT_TO_REF_LOCATION / LOCATION_TO_SVG / LOCATION_LABELS
  inventoryMath.js     — computeTotalWeight, autorité unique client/serveur du poids porté

server/src/db/migrations/ — **corrigé (audit 2026-08-26)** : tous les numéros ci-dessous étaient ceux
d'avant la refonte migrations (2026-08-22, `PLAN_MIGRATIONS_REFONTE.md`) — les anciens fichiers
vivent désormais dans `migrations_archive/` sous ces mêmes numéros, réattribués dans le dépôt actif à
des tables sans rapport. Un fichier de création + un fichier de seed par table, aujourd'hui :
  72_ref_genotypes.js (+ seed 282)              — ref_genotypes
  80_ref_skills.js (+ seed 283)                 — ref_skills
  79_ref_skill_requirements.js (+ seed 284)     — ref_skill_requirements
  22_char_sheet.js                              — char_sheet
  9_char_advantages.js                          — char_advantages (schéma revu, voir §3bis plus bas)
  27_character_wounds.js                        — character_wounds
  15_char_inventory.js                          — char_inventory
  13_char_gauges.js                             — char_gauges
  18_char_mutations.js                          — char_mutations (nouvelle table, absente de la version précédente de ce document, voir §3bis)

scripts SQL correctifs (appliqués manuellement, hors migrations Knex) :
  fix_ref_skills.sql                — parents fantômes, markers, typos
  fix_special_skills_markers.sql    — markers S→(X) sur MUTATION_* et POUVOIRS_POLARIS_*
  fix_polaris_requirements.sql      — prérequis muta_029 sur Maîtrises Polaris
```

### Montage dans index.js

```js
import charSheetRouter from './routes/character/char-sheet.js'
import charRefRouter   from './routes/character/ref.js'
app.use('/api/char-sheet', charSheetRouter)
app.use('/api/char-ref',   charRefRouter)
```

---

## 3. Schéma SQL — domaine Character

### Tables de référence (statiques — jamais modifiées par le jeu)

#### `ref_genotypes`
4 lignes. PK = `id TEXT`. Seedée migration 33.

| Colonne | Type | Contrainte | Notes |
|---|---|---|---|
| id | TEXT | PK NOT NULL | `HUMAIN`, `HYB_NAT`, `TEC_HYB`, `GEN_HYB` |
| label | TEXT | NOT NULL | Nom affiché |
| mod_for … mod_pre | INT | DEFAULT 0 | Modificateur pour chaque attribut (8 colonnes) |

---

#### `ref_skills`
248 lignes (compétences jouables + groupes structurels). PK = `id TEXT`. Seedée migration 37 + correctifs + migration 44.

| Colonne | Type | Contrainte | Notes |
|---|---|---|---|
| id | TEXT | PK NOT NULL | Ex: `ACROBATIE_EQUILIBRE`, `ARTS_MARTIAUX_LUTTE` |
| family | TEXT | NOT NULL | Famille d'affichage (ex: `Aptitudes physiques`) |
| label | TEXT | NOT NULL | Nom affiché sur la fiche |
| parent | TEXT | nullable | ID du groupe parent — NULL si racine |
| attr_1 | TEXT | NOT NULL | Code attribut. **`'CHC'` = groupe structurel (PC13)** |
| attr_2 | TEXT | nullable | NULL → attr_1 utilisé ×2 pour Base (PC4) |
| marker | TEXT | nullable | Voir tableau markers ci-dessous |
| description | TEXT | nullable | Tooltip fiche |

**Valeurs de `marker` :**

| Valeur | Signification | Comportement dans SkillsPanel |
|---|---|---|
| `NULL` | Standard | Toujours visible (si prérequis `SKILL_MIN` satisfaits — évalué uniquement si `settings.skill_prerequisites` actif, OPT-07, défaut OFF, Session 141) |
| `'(-3)'` | Difficile | Malus -3 au niveau de base |
| `'(X)'` | Réservée | Masquée sauf `is_learned=true` OU mutation débloquante active (PC15) |
| `'PN'` | Progression Naturelle | Bonus immersion automatique (max +5) |
| `'PREREQ'` | Prérequis (†) | Groupe avec prérequis — affiché comme sous-en-tête avec `†` |
| `'S'` | Spécialisation | **Ne jamais utiliser** sur MUTATION_* ou POUVOIRS_POLARIS_* (PC17) |

**Convention `attr_1 = 'CHC'`** : groupe visuel pur. Jamais calculé. Affiché comme sous-en-tête non-jouable dans SkillsPanel si au moins un enfant est visible (PC13). 10 groupes CHC : `ARME_SPECIALE_CONTACT`, `ARME_SPECIALE_DISTANCE`, `EXPRESSION_ARTISTIQUE`, `COMMERCE_TRAFIC`, `SCIENCES_CONNAISANCES_SPECIALISEES`, `TACTIQUE`, `MANOEUVRE_DARMURE`, `CONNAISSANCE_MILIEU_NATUREL`, `GENIE_TECHNIQUE`, `MUTATION`, `POUVOIRS_POLARIS`, `LANGUE_ETRANGERE`, `LANGUE_ANCIENNE`, `LANGAGES_SPECIFIQUES`, `CONTROLE_DES_MUTATIONS`.

**Arts martiaux** (`attr_1='COO'`) : compétence jouable normale avec enfants indentés — pas un groupe CHC.

---

#### `ref_skill_requirements`
PK composite `(skill_id, type, value)`. FK `skill_id → ref_skills.id`.

| Colonne | Type | Contrainte | Notes |
|---|---|---|---|
| skill_id | TEXT | PK FK NOT NULL | Compétence concernée |
| type | TEXT | PK NOT NULL | `'SKILL_MIN'`, `'MUTATION'`, `'GENOTYPE'` |
| value | TEXT | PK NOT NULL | Ex: `'INFORMATIQUE'`, `'muta_026'`, `'HYB_NAT'` |
| threshold | INT | DEFAULT 1 | Seuil minimum — utilisé uniquement pour `SKILL_MIN` |

---

#### `ref_mutations` — **schéma entièrement remplacé, corrigé (audit 2026-08-26)**

> Ce que ce document décrivait (PK `muta_numero TEXT`, colonnes `nom`/`mod_for`/`res_armure`/
> `stack_mod_val`...) n'existe plus. Schéma réel vérifié dans `server/src/db/migrations/77_ref_mutations.js` :

| Colonne | Type | Notes |
|---|---|---|
| mutation_id | INTEGER | PK, séquence (`ref_mutations_mutation_id_seq`) — plus `muta_numero TEXT` |
| name | VARCHAR(100) | Nom affiché (anciennement `nom`) |
| subtype, has_subtable | VARCHAR / BOOLEAN | Sous-types (table séparée `ref_mutation_subtypes`), ex. Parasite(s) |
| cost_pc | INTEGER | Coût en PC, peut être négatif (désavantage) |
| is_unique, is_stackable, stack_limit, stack_effect, stack_deltas | — | Cumul (`stack_deltas` JSONB) |
| mod_FOR…mod_PRE | INTEGER | Modificateurs d'attributs (6 colonnes, casse majuscule réelle) |
| mod_res_damage/shock/drugs/disease/poison/radiation | INTEGER | Résistances (anciennement `res_armure…res_radiation`) |
| natural_armor, natural_weapon_formula, natural_weapon_choc_formula, natural_weapon_requires_grapple | — | Arme/armure naturelle |
| d100_range_start/end | INTEGER | Tirage aléatoire (méthode "Tirage aléatoire" Step3 Wizard) |
| ldb_page, description | — | Référence RAW |

Le lien vers une Compétence débloquée (ancien `linked_skill_id`) n'est plus une colonne sur
`ref_mutations` — vérifier `ref_skill_requirements` au moment du besoin plutôt que de se fier à cette
table périmée pour la liste des 9 mutations concernées.

#### `char_mutations` — table dynamique des mutations d'un personnage (n'existait pas dans ce document)

| Colonne | Type | Notes |
|---|---|---|
| id | UUID | PK |
| char_sheet_id | UUID | FK |
| mutation_id | INTEGER | FK → `ref_mutations.mutation_id` |
| subtype_id | INTEGER nullable | FK → `ref_mutation_subtypes` |
| source | TEXT, défaut `'chosen'` | `'chosen'` / `'random'` (Step3) / `'revers'` (Step4, WIZ46) |
| status | TEXT, défaut `'active'` | |
| count | INTEGER, défaut 1 | Nombre de fois choisie (ex. Parasite×N, Caractère génétique animal) |

Routes : `GET/POST/DELETE /char-sheet/:characterId/mutations` (`char-sheet.js:792-859`, POST/DELETE
**GM uniquement**) — confirmées exactes par `docs/SYSTEME/PERSONNAGE_API.md`, plus fiable que ce
document sur ce périmètre.

---

### Tables dynamiques (une entrée par personnage)

#### `char_sheet` — table pivot

| Colonne | Type | Contrainte | Notes |
|---|---|---|---|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| character_id | UUID | FK→characters.id ON DELETE CASCADE | |
| chc | INT | DEFAULT 11 | Chance (1–20) |
| xp_total | INT | NOT NULL DEFAULT 0 | XP reçus cumulés — lecture seule, jamais éditable directement |
| xp_available | INT | NOT NULL DEFAULT 0 | XP disponibles à dépenser — éditable GM uniquement |
| sols | INT | NOT NULL DEFAULT 0 | Solde en sols — éditable GM ou owner via PUT /sols |
| created_at | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | |

---

#### `char_identity`
PK = `char_sheet_id UUID`. FK → `char_sheet.id ON DELETE CASCADE`.

Colonnes : `player_name`, `char_name`, `height NUMERIC`, `weight NUMERIC`, `skin`, `eyes`, `hair`, `build`, `distinctive_signs`, `hand_pref` — toutes nullable.

> **PC1** : `char_name` ≠ `characters.name` — deux champs indépendants, jamais synchroniser.

---

#### `char_archetype`
PK = `char_sheet_id UUID`. FK → `char_sheet.id CASCADE` + `genotype_id → ref_genotypes.id`.

Colonnes : `genotype_id`, `age INT`, `sex`, `is_fertile BOOLEAN DEFAULT false`, `origin_geo`, `origin_soc`, `training_base`, `higher_ed` — toutes nullable sauf `is_fertile`.

---

#### `char_attributes`
PK composite `(char_sheet_id, attr_id)`. FK `char_sheet_id → char_sheet.id CASCADE`.

| Colonne | Type | Contrainte |
|---|---|---|
| char_sheet_id | UUID | PK FK NOT NULL |
| attr_id | TEXT | PK NOT NULL — `FOR`,`CON`,`COO`,`ADA`,`PER`,`INT`,`VOL`,`PRE` |
| base_level | INT | NOT NULL DEFAULT 7 |
| pc_modifier | INT | DEFAULT 0 |

> `pc_modifier` est une valeur agrégée en V1. Historique XP = module futur.

---

#### `char_skills`
PK composite `(char_sheet_id, skill_id)`. FK `char_sheet_id → char_sheet.id CASCADE` + `skill_id → ref_skills.id`.

| Colonne | Type | Contrainte |
|---|---|---|
| char_sheet_id | UUID | PK FK NOT NULL |
| skill_id | TEXT | PK FK NOT NULL |
| mastery | INT | DEFAULT 0 — ≥ 0, sauf compétence (X) débloquée : plancher -3 (PC11) |
| is_learned | BOOLEAN | DEFAULT false |

`is_learned = true` : débloque les compétences `(X)` Réservées ET les pouvoirs Polaris sélectionnés via AdvantagesPanel.

---

#### `character_wounds`
PK = `id UUID`. FK `char_sheet_id → char_sheet.id ON DELETE CASCADE`. Migration 49.

| Colonne | Type | Contrainte | Notes |
|---|---|---|---|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| char_sheet_id | UUID | FK NOT NULL | cascade delete |
| location | TEXT | NOT NULL CHECK | valeurs : `WOUND_LOCATIONS` de woundConstants.js |
| severity | TEXT | NOT NULL CHECK | `'legere'`, `'moyenne'`, `'grave'`, `'critique'`, `'mortelle'` |
| is_stabilized | BOOLEAN | NOT NULL DEFAULT false | |
| idx | INTEGER | NOT NULL | position dans la ligne (0-based) |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

Règle de promotion : si une ligne de sévérité se remplit → `resolveWoundInsertion()` supprime la ligne entière et insère 1 case à la sévérité suivante (récursif).

---

#### `char_inventory`
PK = `id UUID`. FK `character_id → characters.id ON DELETE CASCADE`. FK `equipment_id → ref_equipment.id ON DELETE SET NULL`. Migration 50.

| Colonne | Type | Contrainte | Notes |
|---|---|---|---|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| character_id | UUID | FK NOT NULL | vers `characters`, pas `char_sheet` |
| equipment_id | UUID | FK nullable | null pour items saisis manuellement |
| container | TEXT | NOT NULL | `'Coffre'`, `'Sac'`, `'Ceinture'` |
| slot | TEXT | nullable | localisation équipée — mono : `'T'`/`'C'`/`'BG'`/`'BD'`/`'JG'`/`'JD'`/`'D'`/`'Ce'` — multi : `'BG/BD'` |
| quantity | INTEGER | NOT NULL DEFAULT 1 | |
| custom_props | JSONB | nullable | propriétés libres (items manuels) |
| validated_by_gm | BOOLEAN | NOT NULL DEFAULT false | Colonne de `15_char_inventory.js` (corrigé 2026-08-26, "migration 242" pointe aujourd'hui vers `242_legacy_zones_foreign_keys.js`, sans rapport). Dérivé serveur uniquement (`req.isGm` à l'insertion/fusion de stack), jamais accepté du payload client — sinon un joueur s'auto-valide par un simple PUT. Bloque la progression du joueur en Wizard Step6 tant qu'il reste un item `false` (§5) |
| created_at | TIMESTAMPTZ | DEFAULT now() | |
| updated_at | TIMESTAMPTZ | DEFAULT now() | |

> **Règle PI8 :** le serveur utilise `LIKE '%/CODE/%'` pour les queries multi-slot, jamais `WHERE slot = code`.

---

#### `char_gauges`
PK composite `(char_sheet_id, category_key)`. FK `char_sheet_id → char_sheet.id ON DELETE CASCADE`. Table créée dans `13_char_gauges.js` (corrigé 2026-08-26, cohérent avec §2 — "migration 242" était faux ici aussi, même dérive que §2 avant sa propre correction). Ressource de personnage indépendante — jamais recalculée/écrasée par le cycle de réconciliation Wizard Step1-5, contrairement à `char_traits`/`gauge_delta` ou `char_pc_ledger`.

| Colonne | Type | Contrainte | Notes |
|---|---|---|---|
| char_sheet_id | UUID | PK FK NOT NULL | |
| category_key | TEXT | PK NOT NULL | Clé de catégorie Pro-Avantage normalisée (`shared/proAdvCategoryRuleKeys.js`, même normalisation client/serveur) |
| value | INT | NOT NULL DEFAULT 0 CHECK ≥ 0 | Backstop DB — le clamp normal se fait côté route (`GREATEST(0, value + delta)`, §4) |

Seedée une fois par catégorie (upsert `ON CONFLICT DO NOTHING`, `server/src/services/creationService.js`, cycle de réconciliation Wizard Step4/Avantages) : valeur de départ = total théorique des Pro-Avantages professionnels agrégé sur toutes les carrières du personnage. Une catégorie déjà vue n'est plus jamais retouchée par le seed, même si le joueur modifie ses carrières ensuite — ensuite entièrement gérée par le MJ (+/-, §4).

---

#### `char_advantages`
**Schéma entièrement remplacé, corrigé (audit 2026-08-26)** — ce document décrivait `type`
(`'MUTATION'`/`'OTHER'`), `muta_numero`, `level` : périmé, les mutations vivent désormais dans une
table séparée `char_mutations` (voir §3 `ref_mutations` ci-dessus), `char_advantages` ne porte plus
que les avantages/désavantages du catalogue `ref_advantages` (migration 53), avec soft-delete.
Schéma réel vérifié dans `server/src/db/migrations/9_char_advantages.js` :

| Colonne | Type | Contrainte | Notes |
|---|---|---|---|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| char_sheet_id | UUID | FK NOT NULL | |
| advantage_id | TEXT | NOT NULL | FK logique vers `ref_advantages` |
| snapshot_data | JSONB | NOT NULL | Copie des valeurs au moment de l'acquisition (le catalogue peut changer sans affecter les personnages déjà créés) |
| acquired_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| acquired_during | TEXT | NOT NULL | Contexte d'acquisition (ex. étape Wizard) |
| removed_at | TIMESTAMPTZ | nullable | Soft-delete — jamais un DELETE réel |
| removal_reason | TEXT | nullable | |

---

## 4. Routes API

### `/api/char-ref/`

| Méthode | Route | Description |
|---|---|---|
| GET | `/genotypes` | Liste des 4 génotypes |
| GET | `/skills` | Catalogue complet ref_skills + requirements imbriqués |
| GET | `/mutations` | Catalogue complet ref_mutations (corrigé 2026-08-26 : trié par `mutation_id`, plus `muta_numero`) |

### `/api/char-sheet/`

#### Fiche de base

| Méthode | Route | Description |
|---|---|---|
| POST | `/:characterId` | Créer une fiche vierge |
| GET | `/:characterId` | Charger sheet + identity + archetype + attributes + skills |
| PUT | `/:characterId/identity` | Sauvegarder identité (patch partiel) |
| PUT | `/:characterId/archetype` | Sauvegarder archétype (patch partiel) |
| PUT | `/:characterId/attributes` | Sauvegarder attributs (bulk UPSERT) |
| PUT | `/:characterId/chc` | Sauvegarder score de chance |
| PUT | `/:characterId/skills` | Sauvegarder maîtrises (bulk UPSERT) — **GM uniquement** |
| PUT | `/:characterId/skills/toggle-learned` | Toggler `is_learned` (owner ou GM) — **Fix PC22 session 50** |
| PUT | `/:characterId/xp` | Modifier `xp_total` et/ou `xp_available` — **GM uniquement** |
| POST | `/:characterId/skills/buy` | Dépenser XP pour augmenter une compétence — owner ou GM |
| GET | `/:characterId/advantages` | Liste avantages/désavantages |
| POST | `/:characterId/advantages` | Ajouter mutation ou texte libre |
| DELETE | `/:characterId/advantages/:id` | Supprimer ou décrémenter level |

#### Blessures (session 49)

Ownership : owner ou GM. `router.param('characterId')` pré-charge le character.

| Méthode | Route | Description |
|---|---|---|
| GET | `/:characterId/wounds` | `{ wounds[], wound_penalty }` — wound_penalty calculé serveur via `calcWoundPenalty` |
| POST | `/:characterId/wounds` | Ajoute une blessure — `resolveWoundInsertion()` gère la promotion, broadcast WOUND_ADDED |
| PUT | `/:characterId/wounds/:woundId/stabilize` | Stabilise une blessure active, broadcast WOUND_UPDATED |
| DELETE | `/:characterId/wounds/:woundId` | Guérison (suppression), broadcast WOUND_REMOVED |

#### Inventaire (session 51)

| Méthode | Route | Description |
|---|---|---|
| GET | `/:characterId/inventory` | `{ items[], sols, total_weight, threshold }` |
| POST | `/:characterId/inventory` | Ajoute item — vérifie `isContainerAvailable()` pour Sac/Ceinture (PI1/PI2), broadcast INVENTORY_ADDED. `validated_by_gm = req.isGm` à l'insertion ; même règle à la fusion de stack (item déjà existant même équipement/container/slot) — reflète toujours le rôle du dernier auteur |
| PUT | `/:characterId/inventory/:itemId` | Modifie slot/container/quantité — LIKE query multi-slot (PI8), broadcast INVENTORY_UPDATED. Rejette `validated_by_gm` dans le payload si `!req.isGm` (403) — seul le MJ peut faire passer un item à `true` |
| DELETE | `/:characterId/inventory/:itemId` | Supprime item, broadcast INVENTORY_REMOVED |
| PUT | `/:characterId/sols` | Modifie solde sols (GM ou owner), broadcast SOLS_UPDATED |

#### Jauges de matériel (`docs/PLANS/PLAN_WIZARD_MATERIEL_GAUGES.md`, partagées Wizard Step6 + fiche permanente)

| Méthode | Route | Description |
|---|---|---|
| GET | `/:characterId/gauges` | `{ gauges: [{ category_key, value }] }` — owner ou GM |
| PATCH | `/:characterId/gauges/:categoryKey` | `{ delta }` — **MJ only**. Clamp serveur `GREATEST(0, value + delta)` (jamais bloquant pour un MJ qui descend sous 0, cf. `CHECK` §3), broadcast GAUGE_UPDATED sur `resolveInventoryBroadcastRoom(characterId, campaignId)` — même helper que les routes inventaire, pour ne pas révéler l'existence d'un brouillon Wizard à toute la room de campagne |

---

## 5. Flux de données — composants

### Chargement initial (CharacterSheet)

```
useEffect([characterId]) → Promise.all([
    GET /char-ref/genotypes   → setGenotypes
    GET /char-ref/skills      → setRefSkills
  ])
  ├── GET /char-sheet/:id         → sheet, identity, archetype, attributes, skills
  │     └── si sheet null → POST /char-sheet/:id puis rechargement
  └── GET /char-sheet/:id/advantages → setCharAdvantages  ← appel séparé, non bloquant
```

### Propagation des props

```
CharacterSheet
  ├── SkillsPanel
  │     props: refSkills, charSkills, charAdvantages, anMap,
  │            characterId, isGm, canEdit, genotypeId, onSaved,
  │            progressionMode, xpAvailable, onSkillBought
  │     state local: localMastery, collapsedFamilies
  │     sauvegarde: PUT /skills (debounce 500ms par skill_id) — GM uniquement
  │
  └── AdvantagesPanel
        props: characterId, charAdvantages, onAdvantagesChange,
               canEdit, onSaved
        state local: refMutations (chargé au montage),
                     refSkillsPolaris + charSkillsPolaris (chargés à l'ouverture modale)
        sauvegarde: POST/DELETE /advantages, PUT /skills (toggle Force Polaris)
```

### Mise à jour réactive après ajout d'une mutation

```
AdvantagesPanel.handleAddMutation(muta_numero)
  → POST /advantages
  → enrichit réponse avec refMutations local (mutation_nom, linked_skill_id)  ← PC16
  → onAdvantagesChange(newList)               ← remonte vers CharacterSheet
  → CharacterSheet.setCharAdvantages(newList) ← prop descendante vers SkillsPanel
  → SkillsPanel.activeMutations recalculé     ← useMemo([charAdvantages])
  → isVisible() réévalue toutes les compétences immédiatement
```

### Toggle pouvoir Polaris

```
AdvantagesPanel.handleTogglePolaris(skillId)
  → PUT /skills { skill_id: skillId, is_learned: !current }
  → setCharSkillsPolaris(updated)  ← state LOCAL à AdvantagesPanel
  ⚠️ NE remonte PAS vers CharacterSheet.charSkills
     → SkillsPanel ne voit pas le changement immédiatement
  PC22 corrigé (session 50, confirmé §4) : PUT /skills/toggle-learned, owner ou GM — plus de 403 joueur
```

### Onglet Matériel — inventaire (source unique de vérité, docs/Old/PLAN_INVENTORY_UX.md Étape 0)

`characterStore.js` porte `inventoryByCharId`/`thresholdByCharId`/`solsByCharId` par personnage, avec
une garde `inventoryFetchEpoch` : une réponse de fetch périmée (un upsert WS plus récent a déjà eu
lieu) est ignorée au lieu d'écraser le store.

```
useInventoryData(characterId)  (lib/useInventoryData.js)
  → si inventoryByCharId[characterId] absent : GET /:id/inventory → store.setInventory (1 fois)
  → sélecteur réactif sur le store pour ArmorWoundPanel/WeaponPanel/InventoryBanner/InventoryPanel/
    StepMaterielEtBiens (Wizard) — plus de fetch local par panneau, plus de reloadKey.

Mutation (auteur) :
  <select>/bouton/drag → inventoryMutations.js (setItemSlot/setItemContainer/deleteItem)
    → PUT/DELETE /:id/inventory/:itemId → réponse HTTP déjà autoritaire → store.upsert/removeInventoryItem
    → refreshDerivedTotals(characterId) (inventoryDataSync.js) recalcule poids/seuil affichés
  Pas d'écriture spéculative : l'auteur attend la réponse HTTP, jamais l'écho WS.

Autres clients connectés :
  useCharacterSocket.js écoute INVENTORY_ADDED/UPDATED/REMOVED/SOLS_UPDATED
    → écrit directement dans le store (upsert/remove), idempotent avec l'écriture de l'auteur.

ModingWindow.jsx reste hors du store (forme de donnée différente, /moding/state) — son propre hook
local écoute les mêmes events WS, filtré par characterId, pour se rafraîchir indépendamment.
```

Drag & drop (`@dnd-kit/core`, DndContext unique dans `CharacterWindow.jsx` pour tout l'onglet Matériel,
`InteractiveAwarePointerSensor` filtre l'activation sur les `<select>`/`<input>`/`<button>` imbriqués) :
chaque zone cible (LocationPanel, WeaponPanel, InventoryPanel Sac/Ceinture/Coffre) fournit son
`data.onDrop`, routé par `CharacterWindow.handleItemDragEnd` — aucune logique dupliquée, chaque zone
garde sa propre résolution (slot composite, conflit main/2M → confirmation sur 409).

### Jauges de matériel (char_gauges, même patron que l'inventaire)

`characterStore.js` porte `gaugesByCharId` par personnage (`{ [charId]: { [categoryKey]: value } }`).

```
useGaugesData(characterId)  (lib/useGaugesData.js)
  → si gaugesByCharId[characterId] absent : GET /:id/gauges → store.setGauges (1 fois)
  → sélecteur réactif pour GaugesPanel.jsx (fiche permanente) ET StepMaterielEtBiens.jsx (Wizard
    Step6) — même hook, deux points de montage.

Mutation (auteur, MJ only) :
  Stepper +/- → gaugesMutations.js (adjustGauge)
    → PATCH /:id/gauges/:categoryKey → réponse HTTP déjà autoritaire → store.setGauge

Autres clients connectés :
  useCharacterSocket.js (fiche permanente) ET useWizardInventorySync.js (Wizard, indépendant du
  premier) écoutent tous les deux GAUGE_UPDATED → écriture directe dans le store, sans refetch —
  nécessaire séparément dans les deux hooks car les jauges sont éditables dès le Wizard Step6.
```

Onglet Matériel (fiche permanente) : `GaugesPanel.jsx` reste compact (pas de grille 2 colonnes,
cf. §7 note historique) — masqué (`return null`) si le personnage n'a aucune jauge semée.

### Distribution XP — GM (CharacterSheet)

```
onChange(xpAvailable, val)
  → setXpAvailable(val)
  → clearTimeout + setTimeout 500ms (xpDebounceTimer)
       PUT /xp { xp_available: val }   ← jamais xp_total depuis le client
       → onSaved?.()
```

### Achat compétence — Mode Progression (SkillsPanel)

```
SkillsPanel.handleBuy(skill)
  → if (isBuyingRef.current) return     ← guard synchrone (PC21)
  → if (xpAvailable < cout) return      ← guard client
  → isBuyingRef.current = true
  → setBuyingSkillId(skill.id)          ← affichage UI bouton '…'
  → POST /char-sheet/:characterId/skills/buy { skill_id }
       → onSkillBought?.(res.data)
            → CharacterSheet.handleSkillBought({ skill_id, mastery, is_learned, xp_available })
                 → setCharSkills (map si existant, push si nouvelle entrée)
                 → setXpAvailable(xp_available)
                 → onSaved?.()
  finally: isBuyingRef.current = false, setBuyingSkillId(null)
```

---

## 6. Logique métier — règles de calcul

**Tout côté client JS pour l'affichage. Le serveur recalcule indépendamment via `server/src/lib/charStats.js` pour toute résolution mécanique (jets de dés, interactions entités).** Corrigé 2026-08-26 —
citait `polaris.js`, fichier inexistant (`server/src/lib/polaris.js` : zéro occurrence), et se
contredisait déjà avec son propre PC20 (§9) qui cite correctement `charStats.js`. Trouvé en
confrontant `PERSONNAGE_CALCULS.md`, qui a toujours cité le bon fichier.

**Règle :** le client calcule pour la réactivité de l'UI (fiche personnage, totaux affichés). Le serveur est source de vérité pour toutes les valeurs utilisées dans une résolution mécanique. Les deux calculent indépendamment — le serveur ne fait jamais confiance au client pour une valeur mécanique.

### Attributs primaires

```
na = max(3, base_level + pc_modifier + mod_genotype)
AN = table na→AN (voir tableau)
```

| na | 3 | 4 | 5 | 6-7 | 8-9 | 10-12 | 13-15 | 16-18 | 19-21 | 22-24 | 25+ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| AN | -4 | -3 | -2 | -1 | 0 | +1 | +2 | +3 | +4 | +5 | +6 |

**Arrondi Polaris** : `Math.floor(x + 0.4)` — 0.5 arrondi vers le bas (PC3).

### Attributs secondaires

| Attribut | Formule |
|---|---|
| REA | `arrondi((ADA_na + PER_na) / 2)` |
| Initiative | `REA` |
| Seuil Étourdissement | `arrondi((FOR_na + CON_na + VOL_na) / 3)` |
| Seuil Inconscience | `Seuil_Étour + 10` |
| Vitesse Marche | `arrondi((FOR_na + COO_na + ADA_na) / 3)` |
| Vitesse Course | `Marche × 2` |
| Mod_Dom | table fixe si FOR_na ≤ 21, sinon `5 + floor((FOR_na - 21) / 2)` |

Mod_Dom table fixe :

| FOR_na | 1-2 | 3-4 | 5-6 | 7-8 | 9-11 | 12-13 | 14-15 | 16-17 | 18-19 | 20-21 |
|---|---|---|---|---|---|---|---|---|---|---|
| Mod_Dom | -6 | -4 | -2 | -1 | 0 | +1 | +2 | +3 | +4 | +5 |

### Compétences

```
Base  = AN(attr_1) + AN(attr_2)    — si attr_2 null : AN(attr_1) × 2 (PC4)
Total = Base + mastery              — jamais clampé, peut être négatif (PC11)
```

### Mille-feuille armure (calcMillefeuille — client uniquement)

```javascript
// LocationPanel.jsx — multi-couches sur une localisation
const vals = equippedItems.map(i => i.protection)
const max  = Math.max(...vals)
const rest = vals.reduce((s, v) => s + v, 0) - max
return max + rest / 2
// ⚠️ Arbitrage Math.ceil en attente de vérification LdB — actuel = sans arrondi
```

### Malus blessures + encombrement (charStats.js)

```javascript
// calcWoundPenalty(wounds) → entier ≤ 0 — pire blessure seule (LdB p.236, non-cumulatif)
// calcEncumbrancePenalty(totalWeight, forValue) → entier ≥ 0 — règle maison, cumulatif
effectiveMalus = calcWoundPenalty(wounds) - calcEncumbrancePenalty(weight, FOR)
chancesDeReussite = mechanicalTotal + totalDiffMod + effectiveMalus
```

### Barème XP — dépense de compétences (LdB)

Utilisé par `charStats.js` côté serveur (source de vérité) et en miroir dans `SkillsPanel.jsx` côté client (affichage uniquement).

| Niveau visé (mastery + 1) | Coût en PE |
|---|---|
| 1 à 5 | 1 |
| 6 à 10 | 2 |
| 11 | 3 |
| 12 | 5 |
| 13 | 7 |
| 14 | 9 |
| 15 | 11 |
| > 15 | 11 (dernier palier LdB) |

Déblocage compétence `(X)` : coût fixe **3 PE** — `mastery` reste 0, `is_learned → true`.

### Algorithme de visibilité (SkillsPanel.isVisible)

```
1. attr_1 === 'CHC'                           → false (groupe structurel, PC13)
2. Pré-calcul mutationsSatisfied :
   mutationReqs = requirements.filter(MUTATION)
   mutationsSatisfied = length > 0 AND every(r => activeMutations.has(r.value))
3. marker === '(X)' AND NOT learnedSet AND NOT mutationsSatisfied :
   - si !progressionMode → false (PC15)
   - si progressionMode  → continue (prérequis SKILL_MIN évalués normalement)
4. Pour chaque prérequis :
   SKILL_MIN  → si skillPrerequisitesEnabled === true ET calcTotal(prereq) < threshold → false
   MUTATION   → !activeMutations.has(value)    → false
   GENOTYPE   → genotypeId !== value           → false
5. → true (visible)
```

**OPT-07 (`settings.skill_prerequisites`, défaut OFF, câblée Session 141)** : seul le type `SKILL_MIN` est concerné — `MUTATION`/`GENOTYPE` restent des restrictions biologiques toujours actives, jamais optionnelles. Prop `skillPrerequisitesEnabled` transmise par `CharacterSheet.jsx` (lu depuis `GET /char-sheet/:characterId` → `settings`, merge défauts via `getCampaignSettings`). Revalidé indépendamment côté serveur dans `POST /skills/buy` (jamais fait confiance à un état client) via `calcSkillTotal` (`server/src/lib/charStats.js`, même fonction que le combat). Le marqueur `†` (`marker==='PREREQ'`, sous-en-tête de groupe) reste affiché quel que soit l'état de l'option — purement informatif, non lié à l'application réelle de la règle.

**Comportement mode Progression :** les compétences `(X)` non apprises deviennent visibles si leurs prérequis SKILL_MIN sont satisfaits (ou si l'option est désactivée) — permettant le déblocage via achat XP (3 PE). Les compétences `(X)` à prérequis MUTATION restent masquées (filtrées à l'étape 4). Les `(X)` sans prérequis (Langue étrangère, Survie…) deviennent visibles — cohérent avec la fiction (accord MJ implicite via distribution XP).

`activeMutations` = Set des `muta_numero` présents dans `charAdvantages` (type=MUTATION).

### Groupement hiérarchique SkillsPanel (session 4)

```
families useMemo → Map<family, bloc[]>
  bloc { type: 'group', group: skillCHC, children: skillJouable[] }
    → affiché comme <tr> sous-en-tête si children.length > 0
  bloc { type: 'skill', skill: skillJouable }
    → affiché comme <tr> normale

Arts martiaux (attr_1='COO') : bloc 'skill' avec enfants indentés (paddingLeft 14px)
Groupes CHC : jamais dans isVisible — visibles si ≥ 1 enfant visible
```

---

## 7. Composants React

### `CharacterWindow.jsx`
Fenêtre flottante drag+resize. Dimensions : 720×600 init, 500×400 min. Centrée au montage, clampée dans le viewport. Onglets : **Fiche / Bio & Info / Matériel / Paramètres**. Feedback ✓ vert 1s après save.

Onglet Matériel : empilement vertical (une grille 2 colonnes a été codée puis annulée après test,
bloc trop massif). Porte le `DndContext` unique (drag & drop inventaire, §5) englobant ArmorWoundPanel/
WeaponPanel/InventoryBanner/InventoryPanel — `InteractiveAwarePointerSensor` (défini dans ce fichier)
ignore l'activation du drag sur les éléments interactifs imbriqués dans une ligne draggable.

**Props :** `{ character, isGm, onClose, forceReadOnly }`
**isOwner :** `character.user_id != null && character.user_id === character._currentUserId` (PC6)

**Routes VTT utilisées (domaine VTT — pas des routes Character) :**
- `PUT /characters/:id` — renommer, toggle visible (GM), description, gmNotes, assignation propriétaire
- `POST /characters/:id/portrait` — upload portrait (isGm || isOwner)
- `POST /characters/:id/glb` — upload GLB (GM uniquement)
- `DELETE /characters/:id` — suppression (GM uniquement)

**Sync WS :** useEffect sur `character.name`, `character.description`, `character.gm_notes` — mise à jour automatique si CHARACTER_UPDATED reçu depuis le store.

### `CharacterSheet.jsx`
Orchestrateur Modules 1–6 + Module XP. Charge tout au montage. Gère : genotypes, refSkills, tous les states fiche, charAdvantages, xpTotal, xpAvailable, progressionMode. Section Expérience entre en-tête et description : `xp_total` lecture seule pour tous, `xp_available` éditable GM uniquement, bouton toggle "Mode Progression". `handleSkillBought` met à jour `charSkills` et `xpAvailable` localement après achat (pas de rechargement réseau). Passe anMap (mémoïsé) à SkillsPanel et charAdvantages aux deux panneaux. Debounce 500ms sur attributs et chc (PC12). Refs miroirs `attrsRef`, `chcRef` mis à jour synchroniquement dans onChange.

### `SkillsPanel.jsx`
Module 5 — Compétences. Groupement hiérarchique par famille (session 4) : groupes CHC affichés comme sous-en-têtes, enfants indentés. Accordéon par famille (Langues replié par défaut). State `localMastery` réactif pilote visibilité SKILL_MIN. Debounce 500ms par skill_id dans onChange (PC12). `Fragment` avec `key` utilisé pour les blocs groupe (PC19).

**Props :** `refSkills`, `charSkills`, `charAdvantages`, `anMap`, `characterId`, `isGm`, `canEdit`, `genotypeId`, `onSaved`, `progressionMode`, `xpAvailable`, `onSkillBought`

**Comportement maîtrise selon rôle :**
- GM : input numérique éditable (debounce 500ms → `PUT /skills` GM uniquement)
- Joueur : `<span>` readonly avec signe explicite (`+N`)

**Comportement visibilité `(X)` :** hors mode Progression, toute compétence `(X)` non apprise est masquée. En mode Progression, elle est révélée si ses prérequis SKILL_MIN sont satisfaits — permettant le déblocage (3 PE). Les `(X)` à prérequis MUTATION restent masquées sans la mutation active.

### `AdvantagesPanel.jsx`
Module 6 — Avantages & Désavantages. Liste chronologique + bouton +. Modale 3 étapes :
- Étape 1 : choix type [Mutations] [Force Polaris*] [Autres] (*grisé si muta_029 absente)
- Étape 2A : liste ref_mutations scrollable (mutations existantes = orange, re-sélectionnable pour incrément level)
- Étape 2B : liste POUVOIRS_POLARIS — toggle is_learned dans char_skills (PC22 corrigé, voir §4/§9)
- Étape 2C : textarea 255 chars

**Liste affichée :** badge `MUT` (orange) pour les mutations | badge `ATR` (gris) pour les textes libres. Les pouvoirs Polaris sont dans `char_skills` (is_learned=true), **pas** dans `char_advantages` — ils n'apparaissent pas dans cette liste.

`refMutations` chargé au montage (PC16). `refSkillsPolaris` + `charSkillsPolaris` chargés à l'ouverture de la modale (guard : chargé une seule fois).

### `ArmorWoundPanel.jsx` / `WeaponPanel.jsx` / `InventoryBanner.jsx` / `InventoryPanel.jsx`
Onglet Matériel — quatre panneaux lisant `characterStore` par sélecteur (§5), plus de fetch local.

- **ArmorWoundPanel.jsx** : localisations (LocationPanel × 6) + silhouette (SilhouettePanel), colorée
  par pire blessure. Ne porte plus les conteneurs (déplacés vers WeaponPanel).
- **WeaponPanel.jsx** : armes équipées (affichage contextuel Dir/Sec ou 2M/Tr selon `resolveTargetSlot`),
  puis en dessous, pour limiter la verticalité (demande directe Saar 2026-08-06, réutilise le pattern
  grid 2 colonnes déjà en place pour Dir/Sec) : section "Conteneurs portés" (ContainerPanel × Sac/
  Ceinture) sur une rangée, puis jauge (`InventoryBanner`, prop `inventoryBanner` — reçue en élément
  React tout fait depuis `CharacterWindow.jsx`, qui ne la rend plus en sibling séparé) et bouton
  Customisation (`onOpenModing`, ouvre `ModingWindow.jsx`) sur la rangée suivante.
- **InventoryBanner.jsx** : jauge de poids (barre + %, couleur selon ratio — indépendante de
  `SEVERITY_COLORS` des blessures) + solde en sols, éditable inline si `canEdit` avec asymétrie
  MJ/joueur (un non-GM ne peut que diminuer, borné côté client, 403 déjà renvoyé côté serveur sinon).
  Composant autonome (aucune connaissance de son emplacement) — c'est WeaponPanel qui décide de sa
  position via la prop `inventoryBanner`.
- **InventoryPanel.jsx** : accordéon Sac/Ceinture (message explicite si non équipé), Coffre séparé
  visuellement (tooltip "Stockage distant" — à ne pas confondre avec le Coffre de compte,
  `docs/VOCABULARY.md`), catalogue GM filtré (famille/catégorie/rareté/poids max) + paginé (20/page),
  confirmation avant suppression. Boutons "Sac"/"Coffre" et zones de drop symétriques pour les
  déplacements entre les trois conteneurs (le Coffre reste toujours rendu, même vide, pour offrir une
  cible de drop).

**Props communes :** `characterId`, `canEdit` (`isGm || isOwner`) ; `WeaponPanel` reçoit en plus
`onOpenModing` ; `InventoryPanel`/`InventoryBanner` reçoivent aussi `isGm` (catalogue, édition sols).

**Bouton "Validé" (`InventoryPanel.jsx`)** : visible MJ only, seulement sur les items
`validated_by_gm=false` — un item déjà validé affiche un badge statique, pas un bouton actionnable.
Désaccord MJ = suppression directe, pas de troisième état "refusé" (cohérent avec la philosophie
"le jeu de rôle se joue sur la confiance" déjà en place pour l'inventaire).

### `GaugesPanel.jsx`
Onglet Matériel, fiche permanente — affiche les jauges `char_gauges` (§3), stepper +/- MJ only.
Rester compact : une grille 2 colonnes a déjà été tentée et rejetée sur ce même onglet ("bloc trop
massif, silhouette écrasée"). Masqué si le personnage n'a aucune jauge semée.

**Props :** `characterId`, `isGm`.

---

## 8. Conventions et règles du domaine

- Tables : préfixe `char_` (données personnage), `ref_` (références statiques)
- Routes : `/api/char-sheet/` et `/api/char-ref/`
- Fichiers serveur : `server/src/routes/character/`
- Fichiers client : `client/src/character/`
- **Jamais hardcoder** des données qui existent en BDD
- **Le client calcule pour l'affichage** — réactivité UI, fiche personnage, totaux
- **Le serveur recalcule via `polaris.js`** pour toute résolution mécanique — source de vérité
- **UPSERT** pour les saves bulk — jamais DELETE+INSERT
- **Debounce 500ms** sur tous les champs numériques — jamais `onBlur` sur `<input type="number">` (PC12)
- **`onSaved?.()` toujours optionnel** — pattern `?.()` partout
- **Seeds UTF-8** : toujours vérifier les labels accentués après migration (PC18)
- **Fragment React dans .map()** : toujours `<Fragment key={...}>` — jamais `<>` (PC19)

---

## 9. Pièges PC1–PC24

**PC1** — `char_name` ≠ `characters.name`. Ne jamais synchroniser.

**PC2** — `TOTAL_MALUS = 0` en V1. Passer `0` explicitement dans `calcNA()`.

**PC3** — Arrondi Polaris : `Math.floor(x + 0.4)`. Jamais `Math.round()`.

**PC4** — AN doublé si `attr_2 = NULL` : `Base = AN(attr_1) + AN(attr_1)`.

**PC5** — Seed `ref_skills` avant toute route skills.

**PC6** — `isOwner` via `_currentUserId` injecté par SessionPage dans l'objet character.

**PC7** — IDs `ref_skills` : jamais de `_` final. Corrigé migration 37 v4.

**PC8** — `MAJ.js` invalide — ne jamais utiliser. Source de vérité : `ExtractSKILL.xlsx` colonne F.

**PC9** — Prérequis MUTATION activés en Session 3 (PC9 levé). `activeMutations` depuis `charAdvantages`.

**PC10** — Visibilité SKILL_MIN évalue le Total (Base + localMastery), pas la Base seule.

**PC11** — `mastery >= 0` sauf compétence `(X)` débloquée : plancher `-3` (REGLECOMPETENCE.md:22-25 — "acheter un niveau ... nouveau niveau -3", `getCoutDeblocageX()`/`SkillsPanel.jsx` input GM). Total peut être négatif. Ne jamais clamp le Total.

**PC12** — Debounce 500ms sur numériques, onBlur sur texte. Refs miroirs mis à jour synchroniquement dans onChange.

**PC13** — `attr_1 = 'CHC'` = groupe structurel. Guard `if (skill.attr_1 === 'CHC') return false` en tête de `isVisible`. Ne jamais calculer Base sur ces entrées. Affiché comme sous-en-tête non-jouable dans SkillsPanel si ≥ 1 enfant visible.

**PC14** — muta_029 débloque deux compétences Polaris. `linked_skill_id = 'MAITRISE_DE_LA_FORCE_POLARIS'` en BDD. `MAITRISE_DE_LECHO_POLARIS` débloquée par même prérequis `muta_029` dans `ref_skill_requirements` — pas de colonne array nécessaire.

**PC15** — Règle 1 `(X)` et mutations : ordre d'évaluation. Pré-calculer `mutationsSatisfied` AVANT d'évaluer le marker `(X)`. Une compétence `(X)` avec toutes ses mutations débloquantes actives est visible sans `is_learned`.

**PC16** — `refMutations` chargé au montage de `AdvantagesPanel`, pas à l'ouverture de la modale. Nécessaire pour enrichir la réponse POST avec `mutation_nom` dès le premier ajout.

**PC17** — Ne jamais seeder `MUTATION_*` ou `POUVOIRS_POLARIS_*` avec `marker = 'S'`. Doit être `'(X)'`. `'S'` n'est jamais testé dans `isVisible` → ces compétences seraient toujours visibles.

**PC18** — Encodage UTF-8 des seeds : toujours vérifier les labels accentués après migration avec `SELECT label FROM ref_skills WHERE label LIKE '%??%'`. Correction via migration UPDATE ciblés (migration 44).

**PC19** — `Fragment` React sans `key` dans `.map()` génère un warning. Toujours utiliser `import { Fragment } from 'react'` et `<Fragment key={...}>` quand le fragment est racine d'un `.map()`. Jamais `<>` dans ce contexte.

**PC20** — `charStats.js` existait avant le chantier XP. Contenait `calcSkillTotal`, `calcAttributeAN`, `getGenotypeModForAttr`, `ATTR_LABELS` utilisés par `socket/index.js`. Ne jamais produire ce fichier comme "nouveau" sans l'avoir lu. Toujours demander le fichier existant et fusionner.

**PC21** — Guard synchrone sur achat XP. `setBuyingSkillId` est asynchrone (React batch) — ne jamais l'utiliser comme guard contre les double-clics. Pattern correct : `const isBuyingRef = useRef(false)` + `isBuyingRef.current = true` avant le try, `false` dans le finally. `buyingSkillId` reste uniquement pour l'affichage UI (bouton `…` + disabled).

**PC22** — **Corrigé (session 50), confirmé par l'audit 2026-08-26** : `handleTogglePolaris` appelle
désormais `PUT /skills/toggle-learned` (owner ou GM, aucune garde `isGm` — vérifié `char-sheet.js:394-428`).
Cette entrée décrivait encore le bug d'origine (403 joueur, "fix prévu session 5") — périmée, la route
dédiée décrite comme solution a bien été créée.

**PC23** — `char_inventory.validated_by_gm` ne doit jamais être accepté tel quel depuis le payload client (POST/PUT). Toujours dérivé serveur (`req.isGm`) — sinon un joueur s'auto-valide par un simple appel réseau, la route n'ayant sinon aucune garde `isGm` dessus. Même règle à la fusion de stack (`inventoryService.js`, item déjà existant même équipement/container/slot) : sans elle, un joueur peut ajouter une quantité arbitraire sur une ligne déjà validée sans repasser par le MJ.

**PC24** — `char_gauges`/`char_traits`(`gauge_delta`)/`char_pc_ledger` ne sont pas interchangeables malgré des noms voisins : les deux derniers sont vidés et recalculés en bloc à chaque réconciliation Wizard Step1-5 (aucune persistance incrémentale), donc impropres à porter un ajustement MJ post-création qui doit survivre à un retour du joueur sur ces étapes. `char_gauges` est volontairement hors de ce cycle — seedée une fois par catégorie (`ON CONFLICT DO NOTHING`), jamais réécrite ensuite par `creationService.js`.