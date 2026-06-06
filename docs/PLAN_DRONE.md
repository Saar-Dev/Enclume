# PLAN — Sprint Drones
> Rédigé : 2026-06-05 Session 82
> Mis à jour : 2026-06-06 Session 82bis
> Statut : **Sprint 1 codé — migrations 71+72 — non validé fonctionnellement / Sprint 2 planifié**

---

## Vision

Les drones sont des entités de type `characters` au même titre que les PJ/PNJ.
Ils apparaissent dans l'onglet "Personnages" de la Sidebar (même onglet, section distincte
ou filtrée). Cliquer sur un drone ouvre `DroneWindow`.

Les drones participent au combat via la mécanique "Armes automatisées" (LdB p.320) :
séquence Détection → Analyse → Tir, chaque étape étant un Test sur le programme concerné.
Quand télépiloté, l'initiative = celle du pilote (son action ce tour = l'action du drone).

**Source de vérité règles : `docs/REGLEDRONE.md` (LdB + Guide Technique)**

---

## Règles LdB confirmées (source : REGLEDRONE.md)

### Intégrité & dommages
- Un drone a **une seule localisation** (LdB p.319 — sauf exception MJ)
- Les cases de dommages référencent le tableau personnage (`WOUND_MAX_COUNTS`)
  - Drone de combat → `corps` : légère×4 / moyenne×3 / grave×3 / critique×2 / mortelle×2
  - Drone-sabre → `bras` : légère×3 / moyenne×3 / grave×2 / critique×2 / mortelle×1
  - Le GM choisit la référence à la création (`localisation_ref`)
- `blindage` = armure simple (soustrait des dommages physiques reçus)
- `blindage_iem` = résistance attaque IEM

### Programmes
- Valeur du programme = niveau de compétence directe (pas d'AN/maîtrise)
- Programmes modifiables par le MJ
- Ordinateur interne contraint les programmes :
  - Niveau max individuel = `ordinateur_gen + (2 × ordinateur_nt)`
  - Potentiel total = `10 + (ordinateur_gen × ordinateur_nt) × 2`
  - Gestion systèmes = `10 + (ordinateur_gen × ordinateur_nt)`
- `ref_equipment` (family='Logiciels') est le catalogue de référence — même table que les armes

### Mécanique "Armes automatisées" (LdB p.320)
Séquence en combat pour un drone autonome :
1. **Acquisition** → Test programme `category='detection'`
   - Échec → recommencer 5 rangs d'initiative plus tard
2. **Analyse** (conditionnel) → Test programme `category='ami_ennemi'`
3. **Attaque** → Test programme `category='armement'` comme Compétence
4. **Esquive** → Test programme `category='esquive'` si attaqué au contact

**Le serveur doit pouvoir requêter :** `WHERE character_id = X AND category = 'detection'` → `level`

### Initiative
- Autonome : INI 12 (source : "Armes automatisées" LdB p.320)
- Télépiloté : INI du pilote (son action ce tour = l'action du drone)

### Taille cible (modificateur combat à distance)
| Catégorie | Modificateur |
|---|---|
| minuscule (~30 cm) | -10 |
| tres_petite (~50 cm) | -5 |
| petite (~1 m) | -3 |
| moyenne (taille humaine) | +0 |
| grande (~3 m) | +3 |
| tres_grande (~5 m) | +5 |
| enorme (~7 m) | +10 |
| gigantesque (10 m+) | +15 |

---

## Architecture technique

### Migration 71 — `71_drone_sheet.js` ✅ appliquée

**1. Étendre `characters.type` CHECK :**
```sql
ALTER TABLE characters DROP CONSTRAINT chk_character_type;
ALTER TABLE characters ADD CONSTRAINT chk_character_type
  CHECK (type IN ('pj', 'pnj', 'drone'));
```

**2. Table `drone_sheet` :**
```sql
CREATE TABLE drone_sheet (
  character_id        UUID PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,

  -- Stats descriptives (source : REGLEDRONE.md)
  taille              INTEGER,        -- cm — taille_cible dérivée via getTailleCible()
  poids               INTEGER,        -- kg
  vitesse             INTEGER,        -- m/Tour
  nt                  TEXT,           -- 'I' à 'VI'
  source_energie      TEXT,           -- 'batterie' | 'ombilical' | 'emission'
  autonomie           TEXT,           -- ex: '12h'
  mode_deplacement    TEXT,
  profondeur_max      TEXT,           -- ex: '8 000 m' — ajouté migration 72
  disponibilite       TEXT,           -- ex: '-5 (1)' — ajouté migration 72

  -- Défense
  blindage            INTEGER DEFAULT 0,
  blindage_iem        INTEGER DEFAULT 0,
  armure_materiau     TEXT,           -- label UI : "Armure" (ex: 'Nano-alliage de titane')

  -- Ordinateur embarqué (LdB Informatique — contraint les programmes)
  ordinateur_gen      SMALLINT,       -- Génération (1-10)
  ordinateur_nt       SMALLINT,       -- Niveau technologique (1-6)
  -- niveau_max_programme = ordinateur_gen + (2 × ordinateur_nt) — calculé client
  -- potentiel_total = 10 + (ordinateur_gen × ordinateur_nt) × 2 — calculé client

  -- Guide Technique
  echelle             TEXT DEFAULT 'H',  -- 'H' | 'V-' | 'V'

  -- Intégrité (1 localisation, read-only après création)
  localisation_ref    TEXT DEFAULT 'corps',
  integrite_max       INTEGER DEFAULT 15,
  integrite_actuelle  INTEGER DEFAULT 15,
  damages             JSONB NOT NULL DEFAULT '{}',

  -- Divers
  equip_special       TEXT,
  notes_gm            TEXT
);
```

**Champs supprimés par rapport au plan original (migration 72) :**
| Champ | Raison |
|---|---|
| `iv` | Inventé — absent du LdB et du Guide Technique |
| `survie_iem` | Absent LdB base — présent uniquement pour robots/androïdes (Guide Technique) |
| `resistance_dommages` | Calculé dynamiquement (`integrite_actuelle × 2` + tableau p.112) — pas stocké |
| `architecture` | Pas d'effet mécanique en session |
| `structure_materiau` | Pas d'effet mécanique en session |

**3. Table `drone_programs` — schéma INITIAL (migration 71, remplacé par migration 73) :**
```sql
-- OBSOLÈTE — voir migration 73
id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
character_id  UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
label         TEXT NOT NULL,
level         INTEGER NOT NULL CHECK (level BETWEEN 0 AND 30),
sort_order    SMALLINT DEFAULT 0
```

**4. Table `drone_weapons` (remplace char_inventory pour les drones) :**
```sql
CREATE TABLE drone_weapons (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id        UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  equipment_id        UUID NOT NULL REFERENCES ref_equipment(id),
  contenance_chargeur INTEGER NOT NULL DEFAULT 0,
  ammo_restant        INTEGER,
  sort_order          SMALLINT DEFAULT 0,
  label_override      TEXT
);
```

### Migration 72 — `72_drone_sheet_fix.js` ✅ appliquée

Supprime les 5 champs erronés, ajoute `profondeur_max` et `disponibilite`.

### Migration 73 — `73_drone_programs_catalog.js` À CODER

**Décision : pas de nouvelle table `ref_programs`.**
Les logiciels sont des équipements (`ref_equipment`, `family='Logiciels'`).
`ref_equipment` a déjà : `family`, `category`, `name`, `description`, `tech_level`, `max_level`, `rarity`, `price`, `price_modifier`. Aucune modification de schéma ref_equipment.

**Partie 1 — Modifier `drone_programs` (table vide — safe) :**
```sql
ALTER TABLE drone_programs
  DROP COLUMN label,
  ADD COLUMN equipment_id UUID REFERENCES ref_equipment(id) ON DELETE RESTRICT,
  ADD COLUMN label_override TEXT,
  ADD COLUMN category TEXT NOT NULL;

ALTER TABLE drone_programs
  ADD CONSTRAINT chk_dp_source
    CHECK (equipment_id IS NOT NULL OR label_override IS NOT NULL);
```

**Partie 2 — Seed `ref_equipment` (INSERT uniquement — données existantes intactes) :**
`family='Logiciels'`, `category` = rôle mécanique, `description` = source tooltip UI.

Catalogue LdB p.281-282 + exemples drones :

| name | category | cost_formula |
|---|---|---|
| Détection / Détection visuelle-infrarouge | detection | 500 × cumul |
| Ami/ennemi | ami_ennemi | 400 × cumul |
| Contrôle armement | armement | 1600 × cumul |
| Tir / Attaque / Bombardement | armement | 1600 × cumul |
| Esquive | esquive | — |
| Sécurité | securite | 1200 × cumul |
| Offensif | offensif | 1200 × cumul |
| Contre-attaque | contre_attaque | 1200 × cumul |
| Rempart | rempart | 1000 × cumul |
| Pilotage / Dissimulation / Interception | pilotage | — |
| Analyse senseurs/sonars/radars | analyse | 400 × cumul |
| Analyse sonar | analyse | — |
| Premiers soins / Chirurgie / Analyse médicale | medical | — |
| Communication / Multi-langages | communication | 300 × cumul |
| Topographique | specialise | 800 × cumul |
| Données | specialise | 1000 × niv² |
| Gestion d'appareils | specialise | 400 × cumul |
| Cryptage / Décryptage | specialise | 1200-1600 × cumul |
| Brise-code | specialise | 1500 × cumul |
| Viral autonome / Espion / Anti-espion | specialise | 2200-2800 × cumul |
| Programmes spécialisés (Extraction, Sciences…) | specialise | 1600 × cumul |

**Règle serveur (POST /drone/programs) :** si `equipment_id` fourni, le serveur fetch `ref_equipment.category` et l'écrit lui-même dans `drone_programs.category` — jamais confiance au client pour la catégorie d'un programme catalogue.

### `shared/droneConstants.js` ✅

Exports : `DAMAGES_THRESHOLDS`, `initDamages(localisationRef, woundMaxCounts)`,
`TAILLE_CIBLE_MODS`, `getTailleCible(tailleCm)`, `DRONE_LOCALISATION_LABELS`.

### Routes API (montées sous `/api/char-sheet`) — état cible après migration 73

| Méthode | Route | Guard | Action |
|---|---|---|---|
| GET | `/:charId/drone` | tout membre | drone_sheet + programs (LEFT JOIN ref_equipment → name, description) |
| PUT | `/:charId/drone` | GM | stats drone — champs valides : taille, poids, vitesse, nt, source_energie, autonomie, mode_deplacement, **profondeur_max**, **disponibilite**, blindage, blindage_iem, armure_materiau, ordinateur_gen, ordinateur_nt, echelle, integrite_max, equip_special, notes_gm |
| PUT | `/:charId/drone/integrity` | GM | integrite_actuelle + damages JSONB |
| POST | `/:charId/drone/programs` | GM | equipment_id? + label_override? + level — validation ordinateur |
| PUT | `/:charId/drone/programs/:id` | GM | level + sort_order uniquement (equipment_id/label_override/category immuables) |
| DELETE | `/:charId/drone/programs/:id` | GM | supprimer programme |
| GET | `/:charId/drone/weapons` | tout membre | liste armes + JOIN ref_equipment |
| POST | `/:charId/drone/weapons` | GM | ajouter arme + resolveDroneAmmoInit |
| PUT | `/:charId/drone/weapons/:id` | GM ou owner | contenance_chargeur / ammo_restant / label_override |
| DELETE | `/:charId/drone/weapons/:id` | GM | supprimer arme |

**Bug actif PUT /drone :** destructure encore `iv, survie_iem, resistance_dommages, architecture, structure_materiau` (colonnes droppées mig 72). Si le GM modifie ces champs → erreur DB. À corriger dans migration 73.

**Validation ordinateur (POST /drone/programs) :**
```js
const droneSheet = await db('drone_sheet').where({ character_id }).first()
const niveauMax = droneSheet.ordinateur_gen + 2 * droneSheet.ordinateur_nt
const potentiel = 10 + (droneSheet.ordinateur_gen * droneSheet.ordinateur_nt) * 2
const existingTotal = await db('drone_programs')
  .where({ character_id }).sum('level as total').first()
// Valider : level ≤ niveauMax ET existingTotal.total + level ≤ potentiel
```

**Filtre sélection arme/programme :**
- Armes : `GET /api/equipment?family=Armes`
- Programmes : `GET /api/equipment?family=Logiciels`
- Route existante (`equipment.js` ligne 62) — filtre `req.query.family` déjà implémenté ✅

---

## UI — état cible après migration 73

### Sidebar.jsx ✅ (Sprint 1 — inchangé)

### SessionPage.jsx ✅ (Sprint 1 — inchangé)

### DroneWindow.jsx (`client/src/character/`) ✅ (Sprint 1 — inchangé)
- Drag custom pointerdown/pointermove/pointerup sur document (même pattern que `CharacterWindow`)
- 4 onglets : **Fiche** / **Armes** / **Notes** / **Paramètres**
- Fetch au montage : GET /drone + GET /drone/weapons (Promise.all)

### DroneSheet.jsx — corrections à apporter (migration 73)

**StatField grid — supprimer :**
`iv`, `survie_iem`, `resistance_dommages`, `architecture`, `structure_materiau`

**StatField grid — ajouter :**
`profondeur_max` (`t('drone.fieldProfondeur')`), `disponibilite` (`t('drone.fieldDisponibilite')`)

**IntegritySection :**
- `integrite_actuelle` : actuellement texte fixe → input éditable (blur → PUT /drone/integrity avec `{ integrite_actuelle }`)

**ProgramsSection — refactor complet :**
- Fetch catalogue au montage : `GET /api/equipment?family=Logiciels` → state `catalog`
- Affichage programme :
  - Nom : `p.program_name || p.label_override`
  - Badge catégorie : `t('drone.category.' + p.category)`
  - Niveau : input numérique (blur → PUT /drone/programs/:id `{ level }`)
  - **Tooltip hover** : `p.program_description` — pattern `SecondaryField` de CharacterSheet.jsx (fixed div, `useState(null)`, mouseEnter/Leave) — version simplifiée sans i18n
- Formulaire ajout (GM) — 2 modes :
  - Mode catalogue : `<select>` depuis `catalog` (options groupées par catégorie) → POST avec `{ equipment_id, level }`
  - Mode custom : toggle → inputs `label_override` + `<select>` catégorie + `level` → POST avec `{ label_override, category, level }`

### Onglet Armes (inline dans DroneWindow) ✅ (Sprint 1 — inchangé)

### Onglet Paramètres (SettingsTab dans DroneWindow) ✅ (Sprint 1 — inchangé)

---

## fr.json — changements à apporter (migration 73)

**Supprimer :** `drone.fieldIv`, `drone.fieldSurvieIem`, `drone.fieldResistanceDmg`, `drone.fieldArchitecture`, `drone.fieldStructure`

**Ajouter :**
```json
"fieldProfondeur": "Profondeur max.",
"fieldDisponibilite": "Disponibilité (M. noir)",
"programCatalog": "Catalogue",
"programCustom": "Personnalisé",
"programCustomLabel": "Nom du programme",
"programCategory": "Catégorie",
"category": {
  "detection": "Détection",
  "ami_ennemi": "Ami/Ennemi",
  "armement": "Armement",
  "esquive": "Esquive",
  "securite": "Sécurité",
  "offensif": "Offensif",
  "contre_attaque": "Contre-attaque",
  "rempart": "Rempart",
  "pilotage": "Pilotage",
  "analyse": "Analyse",
  "medical": "Médical",
  "communication": "Communication",
  "specialise": "Spécialisé"
}
```

---

## Sprints

### Sprint Drones 1 — Fiche statique
**Statut : codé (migrations 71+72), non validé fonctionnellement**
Bugs actifs dans le code actuel (à corriger dans migration 73) :
- DroneSheet.jsx : 5 StatFields référencent des colonnes droppées
- char-sheet.js PUT /drone : destructure des colonnes droppées
- fr.json : contient encore les mauvaises clés

### Sprint Drones 1bis — Correction catalogue programmes (migration 73)
**Statut : planifié — prêt à coder**
- Migration 73 : drone_programs ALTER + ref_equipment seed
- char-sheet.js : 4 routes modifiées (GET/POST/PUT /drone/programs + PUT /drone)
- DroneSheet.jsx : StatFields + IntegritySection + ProgramsSection
- fr.json : nettoyage + nouvelles clés

### Sprint Drones 2 — Combat (sprint futur)
- Initiative INI 12 dans COMBAT_START
- Jets de programme (remplace calcSkillTotal) — query par `category`
- Dommages intégrité (remplace character_wounds)
- `TAILLE_CIBLE_MODS` appliqué dans resolveAssaultAction
- `resistance_dommages` : calcul dynamique `integrite_actuelle × 2` + tableau p.112

### Sprint Drones 3 — Télépilotage (sprint futur)
- Lier un drone à un PJ pilote
- Initiative drone = INI pilote quand lié
- Compétence Télépilotage comme compétence limitative
