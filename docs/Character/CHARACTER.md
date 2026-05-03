# CHARACTER.md — Documentation technique du domaine Character
> Domaine : Fiche personnage Polaris & modules joueur
> Dernière mise à jour : 2026-05-02 — Session 45 (documentation exhaustive)
> Statut : Modules 1 à 6 + Module XP stables — 45 migrations appliquées

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
9. [Pièges PC1–PC19](#9-pièges-pc1pc19)

---

## 1. Contexte et périmètre

### Rôle du domaine

Gère la fiche personnage Polaris et tous les modules joueur associés (compétences, mutations, pouvoirs Polaris, inventaire futur, bourse future…). Remplace l'ancien écosystème Google Sheets.

### ⚠️ Tables hors-scope de ce document

Les tables suivantes appartiennent au domaine **VTT** et sont documentées dans `JOURNAL.md`, `ASBUILT.md`, `SYSTEME.md` :

`users` · `campaigns` · `campaign_members` · `battlemaps` · `tokens` · `characters` · `dice_rolls` · `player_locations` · `documents` · `walls` · `zones` · `texture_packs` · `texture_pack_categories` · `voxel_textures` · `battlemap_texture_usage`

Le seul point de contact avec le domaine VTT est :
```
characters.id (UUID) ←── char_sheet.character_id (FK ON DELETE CASCADE)
```
Supprimer un `character` VTT supprime automatiquement toute sa fiche Polaris.

### Ownership et accès

> **Toutes les routes : joueur propriétaire (`characters.user_id === req.user.id`) OU rôle GM de la campagne.**

---

## 2. Structure des fichiers

```
server/src/routes/character/
  char-sheet.js       — 12 routes fiche personnage
  ref.js              — 3 routes données de référence

client/src/character/
  CharacterWindow.jsx — fenêtre flottante déplaçable/redimensionnable
  CharacterSheet.jsx  — orchestrateur Modules 1-6
  SkillsPanel.jsx     — Module 5 Compétences (arborescence CHC session 4)
  AdvantagesPanel.jsx — Module 6 Avantages & Désavantages

server/src/db/migrations/
  33_char_ref_genotypes.js          — ref_genotypes + seed 4 génotypes
  34_char_ref_skills.js             — ref_skills (structure)
  35_char_ref_skill_requirements.js — ref_skill_requirements (structure)
  36_char_sheet.js                  — 5 tables dynamiques
  37_char_seed_skills.js            — seed ref_skills (247+ entrées)
  38_char_seed_skill_requirements.js — seed prérequis
  39_char_fix_ids.js                — corrections IDs corrompus
  40_char_advantages.js             — char_advantages + linked_skill_id sur ref_mutations
  44_char_fix_encoding.js           — correction encodage UTF-8 ref_skills (12 lignes)
  45_char_xp.js                     — xp_total + xp_available sur char_sheet

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
| `NULL` | Standard | Toujours visible (si prérequis satisfaits) |
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

#### `ref_mutations`
33 lignes. PK = `muta_numero TEXT`.

| Colonne | Type | Contrainte | Notes |
|---|---|---|---|
| muta_numero | TEXT | PK NOT NULL | `muta_001` … `muta_033` |
| nom | TEXT | NOT NULL | Nom affiché |
| description | TEXT | nullable | |
| linked_skill | TEXT | nullable | Label lisible de la compétence liée |
| linked_skill_id | TEXT | nullable | ID `ref_skills` de la compétence débloquée |
| mod_for … mod_per | INT | DEFAULT 0 | Modificateurs d'attributs (6 colonnes) |
| mod_acrobatie … mod_discretion | INT | DEFAULT 0 | Bonus compétences (4 colonnes) |
| res_armure … res_radiation | INT | DEFAULT 0 | Résistances (6 colonnes) |
| nom_arme_naturelle | TEXT | nullable | |
| degats_physiques / degats_choc | TEXT | nullable | Ex: `"2D10"` |
| stack_mod_val | INT | nullable | Valeur de cumul |
| stack_target_col | TEXT | nullable | Colonne cible du cumul |

**Liens `linked_skill_id` peuplés (9 mutations) :**

| muta_numero | linked_skill_id |
|---|---|
| muta_026 | MUTATION_AGILITE_CAUDALE |
| muta_011 | MUTATION_CONTAGION |
| muta_019 | MUTATION_CONTROLE_MOLECULAIRE |
| muta_016 | MUTATION_EMPATHIE |
| muta_020 | MUTATION_METAMORPHOSE |
| muta_025 | MUTATION_PURULENCE |
| muta_033 | MUTATION_RADIATIONS |
| muta_031 | MUTATION_SONAR |
| muta_029 | MAITRISE_DE_LA_FORCE_POLARIS |

muta_029 débloque aussi `MAITRISE_DE_LECHO_POLARIS` via `ref_skill_requirements` (même prérequis `muta_029`) — pas besoin de colonne array (PC14).

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
| mastery | INT | DEFAULT 0 — toujours ≥ 0 (PC11) |
| is_learned | BOOLEAN | DEFAULT false |

`is_learned = true` : débloque les compétences `(X)` Réservées ET les pouvoirs Polaris sélectionnés via AdvantagesPanel.

---

#### `char_advantages`
PK = `id UUID`. FK `char_sheet_id → char_sheet.id CASCADE`.

| Colonne | Type | Contrainte | Notes |
|---|---|---|---|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| char_sheet_id | UUID | FK NOT NULL | |
| type | TEXT | NOT NULL | `'MUTATION'` \| `'OTHER'` |
| muta_numero | TEXT | nullable | FK logique vers `ref_mutations.muta_numero` |
| level | INT | DEFAULT 1 | Niveau de la mutation (incrémenté si re-sélectionnée) |
| description | TEXT | nullable | Texte libre pour type `'OTHER'` |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

---

## 4. Routes API

### `/api/char-ref/`

| Méthode | Route | Description |
|---|---|---|
| GET | `/genotypes` | Liste des 4 génotypes |
| GET | `/skills` | Catalogue complet ref_skills + requirements imbriqués |
| GET | `/mutations` | Catalogue complet ref_mutations trié par muta_numero |

### `/api/char-sheet/`

| Méthode | Route | Description |
|---|---|---|
| POST | `/:characterId` | Créer une fiche vierge |
| GET | `/:characterId` | Charger sheet + identity + archetype + attributes + skills |
| PUT | `/:characterId/identity` | Sauvegarder identité (patch partiel) |
| PUT | `/:characterId/archetype` | Sauvegarder archétype (patch partiel) |
| PUT | `/:characterId/attributes` | Sauvegarder attributs (bulk UPSERT) |
| PUT | `/:characterId/chc` | Sauvegarder score de chance |
| PUT | `/:characterId/skills` | Sauvegarder maîtrises (bulk UPSERT) — **GM uniquement** |
| PUT | `/:characterId/xp` | Modifier `xp_total` et/ou `xp_available` — **GM uniquement** |
| POST | `/:characterId/skills/buy` | Dépenser XP pour augmenter une compétence — owner ou GM |
| GET | `/:characterId/advantages` | Liste avantages/désavantages |
| POST | `/:characterId/advantages` | Ajouter mutation ou texte libre |
| DELETE | `/:characterId/advantages/:id` | Supprimer ou décrémenter level |

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
  ⚠️ BUG PC22 : PUT /skills est GM uniquement — joueur reçoit 403
     → Fix prévu session 5
```

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

**Tout côté client JS pour l'affichage. Le serveur recalcule indépendamment via `server/src/lib/polaris.js` pour toute résolution mécanique (jets de dés, interactions entités).**

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
   SKILL_MIN  → calcTotal(prereq) < threshold  → false
   MUTATION   → !activeMutations.has(value)    → false
   GENOTYPE   → genotypeId !== value           → false
5. → true (visible)
```

**Comportement mode Progression :** les compétences `(X)` non apprises deviennent visibles si leurs prérequis SKILL_MIN sont satisfaits — permettant le déblocage via achat XP (3 PE). Les compétences `(X)` à prérequis MUTATION restent masquées (filtrées à l'étape 4). Les `(X)` sans prérequis (Langue étrangère, Survie…) deviennent visibles — cohérent avec la fiction (accord MJ implicite via distribution XP).

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
Fenêtre flottante drag+resize. Dimensions : 720×600 init, 500×400 min. Centrée au montage, clampée dans le viewport. Onglets : Fiche / Bio & Info / Paramètres. Feedback ✓ vert 1s après save.

**Props :** `{ character, isGm, onClose }`
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
- Étape 2B : liste POUVOIRS_POLARIS — toggle is_learned dans char_skills (⚠️ PC22 : 403 pour joueur)
- Étape 2C : textarea 255 chars

**Liste affichée :** badge `MUT` (orange) pour les mutations | badge `ATR` (gris) pour les textes libres. Les pouvoirs Polaris sont dans `char_skills` (is_learned=true), **pas** dans `char_advantages` — ils n'apparaissent pas dans cette liste.

`refMutations` chargé au montage (PC16). `refSkillsPolaris` + `charSkillsPolaris` chargés à l'ouverture de la modale (guard : chargé une seule fois).

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

## 9. Pièges PC1–PC22

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

**PC11** — `mastery >= 0` toujours. Total peut être négatif. Ne jamais clamp.

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

**PC22** — Bug Force Polaris : `handleTogglePolaris` appelle `PUT /skills` qui est **GM uniquement**. Un joueur possédant muta_029 peut voir les pouvoirs Polaris dans la modale mais reçoit 403 en tentant de les activer. Fix prévu session 5 : créer une route dédiée owner+GM pour toggler `is_learned` sur les pouvoirs Polaris uniquement.