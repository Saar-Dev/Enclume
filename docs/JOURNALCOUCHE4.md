# Journal COUCHE 4 — Wizard création personnage
> Créé : 2026-07-02 — Session 131 | Vérifications : Session 131 suite
> Règle absolue : tout ce qui figure ici a été vérifié dans le code source dans la session indiquée.
> [HYPOTHÈSE] = lu dans le code mais non observé en exécution. [VÉRIFIÉ] = instrumenté + observé.

---

## MISSION SUIVANTE — Migration 104

**Objectif :** Écrire `server/src/db/migrations/104_seed_ref_careers_remaining.js` — 32 carrières lots 2-6.

**Fichiers obligatoires à lire avant de coder (jamais de mémoire) :**
1. `server/src/db/migrations/100_seed_ref_careers.js` — pattern exact du seed (structure up/down, returning('id'), CASCADE down) ✅ LU
2. `docs/Character/Creation/migrations/93_seed_ref_careers_lot2.cjs` — ✅ LU  
   `93_seed_ref_careers_lot3.cjs` à `lot6.cjs` — contenu exact par carrière — ❌ NON LUS
3. `server/src/db/migrations/37_char_seed_skills.js` — IDs exacts PILOTAGE/MANOEUVRE_DARMURE ✅ LU

**Point critique ✅ LEVÉ — vérifié migration 37 :**
> PILOTAGE__ = **double underscore** ✅ (`PILOTAGE__NAVIRES_LEGERS`)
> MANOEUVRE_DARMURE__ = **double underscore** ✅ (`MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES`)
> COMMERCE_TRAFIC__ = **double underscore** ✅ (`COMMERCE_TRAFIC__ARMES`)
> MECANIQUE, TACTIQUE, CONNAISSANCE_MILIEU_NATUREL, ARTS_MARTIAUX = **simple underscore** ✅

**3 questions ouvertes → toutes résolues :**
1. `pirate` → PILOTAGE : **AUCUN** — LdB L.1478 : "Manœuvre d'armure (Armures sous-marines), Télépilotage" — pas de PILOTAGE__ pour le pirate. Bonus : pirate → MANOEUVRE_DARMURE = `MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES` ✅ (LdB L.1478)
2. `hybride_trident` → CONNAISSANCE_MILIEU_NATUREL : `CONNAISSANCE_MILIEU_NATUREL_OCEANS` ✅ (LdB L.670-671 : "Connaissance d'un milieu naturel (Océans)")
3. `pilote_chasse_sous_marin` → CONNAISSANCE_MILIEU_NATUREL : `CONNAISSANCE_MILIEU_NATUREL_OCEANS` ✅ (lot4b L.34 commentaire `// Océans`)

**Décisions finales (toutes résolues) :**

| ID lot source | ID DB à utiliser |
|---|---|
| `armes_embarquees` | `ARMES_EMBARQUEES_ARTILLERIE` |
| `armes_speciales` | `ARMES_SPECIALES_CONTACT_FORCE_COORDINATION` |
| `techniques_speciales` | `ARMES_SPECIALES_CONTACT_FORCE_COORDINATION` |
| `maitrise_polaris` | `MAITRISE_DE_LA_FORCE_POLARIS` + `conditional: true` |
| `armes_satellites` | `ARMES_SATELLITES` ✅ ajouté migration 103b |

---

## État migrations — vérifié Session 131

| Migration | Contenu | État |
|---|---|---|
| `93_ref_careers.js` | Schéma 8 tables (ref_careers, ref_career_skills, ref_career_titles, ref_career_prerequisites, ref_career_education, ref_career_random_benefits, ref_career_equipment, ref_career_point_categories) | ✅ |
| `100_seed_ref_careers.js` | 5 carrières lot1 : artisan_artiste, assassin, barman, chasseur_primes, contrebandier | ✅ |
| `101_fix_background_names_encoding.js` | Correction encodage noms backgrounds (mojibake) | ✅ |
| `102_wizard_client_primary.js` | DROP char_creation_snapshot — architecture client-primary | ✅ |
| `103_seed_missing_ref_skills.js` | +2 skills ref_skills : ENSEIGNEMENT + CONNAISSANCE_MILIEUX_SOCIAUX | ✅ |
| `103b_seed_armes_satellites.js` | +1 skill ref_skills : ARMES_SATELLITES — vérifié SELECT en base | ✅ |
| `104_seed_ref_careers_remaining.js` | 32 carrières lots 2-6 | ❌ **NON ÉCRIT** |

**Encodage à traiter après migration 104 :**
- `95_seed_ref_mutations.js` — caractères Ã (UTF-8 mal décodé en Latin-1) — labels mutations corrompus en base

**Compétences absentes de ref_skills — détectées audit seeds lot1 (Session 131 suite) :**
- `MANOEUVRE_DARMURE` — groupe parent absent. Migration 74 a ajouté `PILOTAGE`, `COMMERCE_TRAFIC`, `ARTS_MARTIAUX` etc. mais a omis `MANOEUVRE_DARMURE`. Les enfants (`MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES` etc.) existent mais le parent groupe non. → **Seeds corrigés pour référencer directement les enfants spécifiques** (ex: `MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES`).
- `TACTIQUE` — groupe parent absent. Migration 37 insère les 4 enfants (`TACTIQUE_COMBAT_NAVAL`, `_COMBAT_SOUTERRAIN`, `_COMBAT_TERRESTRE`, `_OPERATIONS_COMMANDO`) avec `parent: 'TACTIQUE'`, mais aucune migration n'insère la row `TACTIQUE` elle-même. Les seeds utilisent les enfants directs — pas de problème FK sur `ref_career_skills.skill_id`.

---

## Pièges critiques

### PIÈGE 1 — skill_ids : casse et mapping (BLOQUANT)

Fichiers sources lots 2-6 : IDs **minuscule et génériques** (`'pilotage'`, `'manoeuvre_armure'`).
`ref_skills` et migration 100 : IDs **UPPERCASE spécifiques** (`'PILOTAGE__NAVIRES_LEGERS'`).
`ref_career_skills.skill_id` est `text` sans FK. Insertion silencieuse avec mauvais ID → aucune erreur levée.

### PIÈGE 2 — IDs à double underscore vs simple underscore

D'après l'audit (session 131) :
- **PILOTAGE** : `PILOTAGE__NAVIRES_LEGERS` (double underscore)
- **MANOEUVRE_DARMURE** : `MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES` (double underscore)
- **MECANIQUE** : `MECANIQUE_VEHICULES_DE_SOL` (simple underscore)
- **TACTIQUE** : `TACTIQUE_COMBAT_NAVAL` (simple underscore)
- **CONNAISSANCE_MILIEU_NATUREL** : `CONNAISSANCE_MILIEU_NATUREL_OCEANS` (simple underscore)
- **ARTS_MARTIAUX** : `ARTS_MARTIAUX_LUTTE` (simple underscore)
- **COMMERCE_TRAFIC** : `COMMERCE_TRAFIC__ARMES` (double underscore)

> ✅ CONFIRMÉ dans migration 37 — PILOTAGE__, MANOEUVRE_DARMURE__, COMMERCE_TRAFIC__ = double underscore. Les autres = simple underscore.

### PIÈGE 3 — Renommages requis (13 IDs)

| ID lot source | ID correct ref_skills |
|---|---|
| `acrobatie_equilibre` | `ACROBATIE_EQUILIBRE` (simple C — migration 74 renomme ACCROBATIE → ACROBATIE) |
| `analyse_sonscans` | `ANALYSES_SONSCANS` |
| `armes_lourdes_tir` | `ARMES_LOURDES` |
| `armes_poing` | `ARMES_DE_POING` |
| `artisanat` | `ART_ARTISANAT` |
| `combat_mains_nues` | `COMBAT_A_MAINS_NUES` |
| `connaissance_nations` | `CONNAISSANCE_DES_NATIONS_ORGANISATIONS` |
| `fusils_armes_epaule` | `FUSIL_ARMES_DEPAULES` |
| `premiers_soins` | `PREMIER_SOINS` |
| `recherche_informations` | `RECHERCHE_DINFORMATIONS` |
| `systemes_securite` | `SYSTEMES_DE_SECURITE` |
| `tir_automatique` | `TIR_AUTOMATIQUES` |
| `tir_precision` | `TIR_DE_PRECISION` |

### PIÈGE 4 — Langues : préfixes requis (13 IDs)

| ID lot source | ID correct ref_skills |
|---|---|
| `absolan` | `LANGAGES_SPECIFIQUES_ABSOLAN` |
| `azuran` | `LANGUE_ANCIENNE_AZURAN` |
| `enefid` | `LANGAGES_SPECIFIQUES_ENEFID` |
| `exon` | `LANGAGES_SPECIFIQUES_EXON` |
| `inesis` | `LANGAGES_SPECIFIQUES_INESIS` |
| `ithraxien` | `LANGAGES_SPECIFIQUES_ITHRAXIEN` |
| `klan` | `LANGAGES_SPECIFIQUES_KLAN` |
| `langage_signes` | `LANGAGES_SPECIFIQUES_LANGAGE_DES_SIGNES` |
| `metalan` | `LANGAGES_SPECIFIQUES_METALAN` |
| `neolan` | `LANGAGES_SPECIFIQUES_NEOLAN` |
| `neo_azuran` | `LANGUE_ETRANGERE_NEO_AZURAN` |
| `sirs` | `LANGAGES_SPECIFIQUES_SIRS` |
| `soleen` | `LANGAGES_SPECIFIQUES_SOLEEN` |

### PIÈGE 5 — ref_career_point_categories absent de migration 100

Migration 100 (lot1) n'a pas inséré de `ref_career_point_categories`. Le lot2+ en contient.
`creationService.getStep4RefData` les fetche. Décision : compléter rétroactivement lot1 dans migration 104, ou laisser vide pour ces 5 carrières.

### PIÈGE 6 — Format .cjs → .js

Sources : `export const seed = async (knex)` + suppression globale.
Cible : `export const up/down` — **pas d'`onConflict`** (migration 100 = insert plain). `down` : `whereIn('code', codes).delete()` (CASCADE supprime skills + titles).
⚠️ Migration 104 doit inclure les tables absentes de migration 100 : `ref_career_point_categories`, `ref_career_equipment`, `ref_career_random_benefits`, `ref_career_education`.
Retourner `[{ id: careerId }]` (pattern migration 100), pas `cultivateur.id` (pattern lot source).

### PIÈGE 7 — Ordre d'insertion et prérequis

`validateCareerPrerequisites` dans `finalizeCreation` (creationService.js L.58-71).
Si des carrières des lots 2-6 ont des prérequis pointant vers d'autres carrières de ces lots, l'ordre d'insertion doit respecter les dépendances — vérifier dans les fichiers lot.

### PIÈGE 8 — SCIENCES : typo dans l'ID DB

Préfixe DB : `SCIENCES_CONNAISANCES_SPECIALISEES_*` (**CONNAISANCES** sans S — typo DB confirmée).
Toutes les insertions de sciences dans migration 104 doivent utiliser ce préfixe tel quel.

---

## Mapping final par carrière — source LdB (REGLE_PROFESSION.md)

> Lu en entier session 131. [HYPOTHÈSE] jusqu'à test en exécution.
> Scope : lots 2-6 uniquement.

### ARTS_MARTIAUX

IDs DB : `ARTS_MARTIAUX_LUTTE`, `ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES`, `ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES`

| Carrière | IDs à insérer |
|---|---|
| espion (lot2) | LUTTE + TECHNIQUES_DEFENSIVES + TECHNIQUES_OFFENSIVES |
| hybride_trident (lot2) | LUTTE |
| mercenaire (lot3) | LUTTE + TECHNIQUES_OFFENSIVES |
| pirate (lot4b) | TECHNIQUES_OFFENSIVES |
| policier_enqueteur (lot5) | LUTTE + TECHNIQUES_DEFENSIVES |
| soldat_milicien (lot5) | TECHNIQUES_OFFENSIVES (au choix → défaut) |
| soldat_elite_* (lot6) | TECHNIQUES_OFFENSIVES (au choix → défaut) |
| techno_hybride (lot6) | LUTTE |
| veilleur (lot6) | TECHNIQUES_DEFENSIVES + TECHNIQUES_OFFENSIVES |

### SCIENCES_CONNAISANCES_SPECIALISEES

Préfixe : `SCIENCES_CONNAISANCES_SPECIALISEES_` (typo, un seul S à CONNAISANCES)

| Carrière | Suffixes à insérer |
|---|---|
| cultivateur_eleveur (lot2) | BIOLOGIE_PHYSIOLOGIE + BOTANIQUE + ZOOLOGIE |
| diplomate (lot2) | SCIENCES_POLITIQUES |
| erudit_archeologue (lot2) | HISTOIRE_ARCHEOLOGIE + GEOGRAPHIE |
| marchand (lot3) | ADMINISTRATION_GESTION + ECONOMIE |
| medecin_chirurgien (lot3) | SCIENCES_CONNAISANCES_SPECIALISEES + conditional:true (LdB : "en fonction de la spécialité" — pas d'ID fixe) |
| policier_enqueteur (lot5) | PHARMACOLOGIE + DROIT_LEGISLATIONS |
| pretre_trident (lot5) | ADMINISTRATION_GESTION + MEDECINE + PSYCHOLOGIE + SCIENCES_POLITIQUES |
| prostitue (lot5) | PHARMACOLOGIE + PSYCHOLOGIE |
| scientifique_ingenieur (lot5) | PHYSIQUE_CHIMIE (au choix → défaut) |
| technicien_mecanicien (lot6) | PHYSIQUE_CHIMIE + GEOLOGIE |
| voleur_criminel (lot6) | PHARMACOLOGIE |

### TACTIQUE

IDs DB : `TACTIQUE_COMBAT_NAVAL`, `TACTIQUE_COMBAT_SOUTERRAIN`, `TACTIQUE_COMBAT_TERRESTRE`, `TACTIQUE_OPERATIONS_COMMANDO`

| Carrière | ID |
|---|---|
| hybride_trident (lot2) | TACTIQUE_OPERATIONS_COMMANDO |
| mercenaire (lot3) | TACTIQUE_OPERATIONS_COMMANDO |
| officier_naval_civil (lot4a) | TACTIQUE_COMBAT_NAVAL |
| officier_naval_militaire (lot4a) | TACTIQUE_COMBAT_NAVAL |
| officier_militaire_souterrain (lot4a) | TACTIQUE_COMBAT_TERRESTRE + TACTIQUE_OPERATIONS_COMMANDO |
| officier_militaire_surface (lot4a) | TACTIQUE_COMBAT_TERRESTRE + TACTIQUE_OPERATIONS_COMMANDO |
| pilote_chasse_atmospherique (lot4b) | TACTIQUE_COMBAT_TERRESTRE |
| pilote_chasse_sous_marin (lot4b) | TACTIQUE_COMBAT_NAVAL |
| pirate (lot4b) | TACTIQUE_OPERATIONS_COMMANDO |
| soldat_milicien (lot5) | TACTIQUE_OPERATIONS_COMMANDO |
| soldat_elite_* (lot6) | TACTIQUE_OPERATIONS_COMMANDO |
| techno_hybride (lot6) | TACTIQUE_OPERATIONS_COMMANDO |
| veilleur (lot6) | TACTIQUE_OPERATIONS_COMMANDO |

### PILOTAGE

Préfixe : `PILOTAGE__` (double underscore — **À VÉRIFIER dans migration 37**)

| Carrière | Suffixes |
|---|---|
| cultivateur_eleveur (lot2) | VEHICULES_DE_SOL + SCOOTERS_SOUS_MARINS |
| marchand_itinerant (lot3) | NAVIRES_LEGERS |
| mercenaire (lot3) | NAVIRES_LEGERS + SCOOTERS_SOUS_MARINS |
| mineur (lot3) | VEHICULES_DE_SOL + VEHICULES_SOUTERRAINS |
| officier_naval_civil (lot4a) | NAVIRES_LEGERS + NAVIRES_LOURDS + VEHICULES_DE_SOL |
| officier_naval_militaire (lot4a) | NAVIRES_LEGERS + NAVIRES_LOURDS + VEHICULES_DE_SOL |
| officier_militaire_souterrain (lot4a) | VEHICULES_DE_SOL + VEHICULES_SOUTERRAINS |
| officier_militaire_surface (lot4a) | VEHICULES_DE_SOL |
| pilote_chasse_atmospherique (lot4b) | CHASSEURS_ATMOSPHERIQUES |
| pilote_chasse_sous_marin (lot4b) | CHASSEURS_SOUS_MARINS + NAVIRES_LEGERS + VEHICULES_DE_SOL |
| pirate (lot4b) | N/A — pas de PILOTAGE__ (LdB L.1478 : Manœuvre d'armure + Télépilotage uniquement) |
| soldat_elite_commando_marin (lot6) | VEHICULES_DE_SOL |
| soldat_elite_commando_souterrain (lot6) | VEHICULES_SOUTERRAINS + VEHICULES_DE_SOL |
| soldat_elite_commando_surface (lot6) | VEHICULES_DE_SOL |
| sous_marinier (lot6) | NAVIRES_LEGERS + NAVIRES_LOURDS + SCOOTERS_SOUS_MARINS |

### MANOEUVRE_DARMURE

Préfixe : `MANOEUVRE_DARMURE__` (double underscore — **À VÉRIFIER dans migration 37**)

| Carrière | Suffixes |
|---|---|
| cultivateur_eleveur (lot2) | ARMURES_SOUS_MARINES |
| mercenaire (lot3) | ARMURES_SOUS_MARINES |
| mineur (lot3) | ARMURES_EXTERNES + ARMURES_SOUS_MARINES |
| officier_naval_civil (lot4a) | ARMURES_SOUS_MARINES |
| officier_naval_militaire (lot4a) | ARMURES_SOUS_MARINES |
| officier_militaire_souterrain (lot4a) | ARMURES_EXTERNES + ARMURES_SOUS_MARINES |
| officier_militaire_surface (lot4a) | ARMURES_EXTERNES + ARMURES_SOUS_MARINES |
| ouvrier_docker (lot4a) | ARMURES_EXTERNES + ARMURES_SOUS_MARINES |
| pilote_chasse_atmospherique (lot4b) | ARMURES_EXTERNES + ARMURES_ATMOSPHERIQUES |
| pilote_chasse_sous_marin (lot4b) | ARMURES_SOUS_MARINES |
| soldat_elite_commando_marin (lot6) | ARMURES_SOUS_MARINES |
| soldat_elite_commando_souterrain (lot6) | ARMURES_EXTERNES |
| soldat_elite_commando_surface (lot6) | ARMURES_EXTERNES + ARMURES_ATMOSPHERIQUES |
| sous_marinier (lot6) | ARMURES_SOUS_MARINES |
| pirate (lot4b) | ARMURES_SOUS_MARINES (LdB L.1478 : "Manœuvre d'armure (Armures sous-marines)") |

### CONNAISSANCE_MILIEU_NATUREL

IDs DB : `CONNAISSANCE_MILIEU_NATUREL_OCEANS`, `_SOUTERRAINS`, `_SURFACE`

| Carrière | ID |
|---|---|
| cultivateur_eleveur (lot2) | CONNAISSANCE_MILIEU_NATUREL_OCEANS |
| hybride_trident (lot2) | CONNAISSANCE_MILIEU_NATUREL_OCEANS (LdB L.670-671) |
| mineur (lot3) | OCEANS + SOUTERRAINS |
| officier_naval_civil (lot4a) | OCEANS |
| officier_naval_militaire (lot4a) | OCEANS |
| officier_militaire_souterrain (lot4a) | OCEANS + SOUTERRAINS |
| officier_militaire_surface (lot4a) | OCEANS + SURFACE |
| pilote_chasse_atmospherique (lot4b) | SURFACE |
| pilote_chasse_sous_marin (lot4b) | CONNAISSANCE_MILIEU_NATUREL_OCEANS (lot4b L.34 `// Océans`) |
| pirate (lot4b) | OCEANS |
| soldat_elite_commando_marin (lot6) | OCEANS |
| soldat_elite_commando_souterrain (lot6) | SOUTERRAINS |
| soldat_elite_commando_surface (lot6) | SURFACE |
| sous_marinier (lot6) | OCEANS |
| techno_hybride (lot6) | OCEANS |

### MECANIQUE

IDs DB (simple underscore) : `MECANIQUE_EXO_ARMURES`, `MECANIQUE_NAVIRES_CHASSEURS_SOUS_MARINS`, `MECANIQUE_CHASSEURS_ATMOSPHERIQUES`, `MECANIQUE_VEHICULES_SOUTERRAINS`, `MECANIQUE_VEHICULES_DE_SOL`, `MECANIQUE_GENERATEURS_SYSTEME_DE_SURVIE`

| Carrière | IDs |
|---|---|
| mineur (lot3) | MECANIQUE_VEHICULES_DE_SOL + MECANIQUE_VEHICULES_SOUTERRAINS |
| ouvrier_docker (lot4a) | MECANIQUE_GENERATEURS_SYSTEME_DE_SURVIE |
| pilote_chasse_atmospherique (lot4b) | MECANIQUE_CHASSEURS_ATMOSPHERIQUES |
| pilote_chasse_sous_marin (lot4b) | MECANIQUE_NAVIRES_CHASSEURS_SOUS_MARINS |
| soldat_elite_commando_surface (lot6) | MECANIQUE_VEHICULES_DE_SOL |
| technicien_mecanicien (lot6) | MECANIQUE_NAVIRES_CHASSEURS_SOUS_MARINS (au choix → défaut) |

### COMMERCE_TRAFIC

Préfixe : `COMMERCE_TRAFIC__` (double underscore — **À VÉRIFIER dans migration 37**)

| Carrière | Suffixes |
|---|---|
| marchand (lot3) | COMMERCE_TRAFIC + conditional:true (LdB : "(au choix)" sans enfant spécifié — EQUIPEMENTS_COURANTS absent de ref_skills) |
| marchand_itinerant (lot3) | COMMERCE_TRAFIC + conditional:true (LdB : "(au choix, en général Équipements courants)" — EQUIPEMENTS_COURANTS absent de ref_skills) |
| voleur_criminel (lot6) | DROGUES + ARMES |

### EXPRESSION_ARTISTIQUE

IDs DB : `EXPRESSION_ARTISTIQUE_CHANT`, `_COMEDIE_CONTE`, `_DANSE`, `_INSTRUMENT_DE_MUSIQUE`

| Carrière | ID |
|---|---|
| marchand_itinerant (lot3) | EXPRESSION_ARTISTIQUE_COMEDIE_CONTE |
| prostitue (lot5) | EXPRESSION_ARTISTIQUE_COMEDIE_CONTE (au choix → défaut) |

### GENIE_TECHNIQUE

IDs DB : `GENIE_TECHNIQUE_ARCHITECTURE_GENIE_CIVIL`, `_ARCHITECTURE_NAVALE`, `_BIONIQUE_CYBERTECHNOLOGIE`, `_BIOTECHNOLOGIE_GENIE_GENETIQUE`, `_ELECTRONIQUE_INFORMATIQUE`, `_LOGICIELS`, `_NANOTECHNOLOGIE`, `_ROBOTIQUE`, `_TELECOMMUNICATIONS`

| Carrière | ID |
|---|---|
| scientifique_ingenieur (lot5) | GENIE_TECHNIQUE_ELECTRONIQUE_INFORMATIQUE (au choix → défaut) |
| technicien_mecanicien (lot6) | **[VÉRIFIER lot6]** — LdB cite Électronique/Informatique/Mécanique, pas explicitement GENIE_TECHNIQUE |

### MAITRISE_POLARIS

| Carrière | ID | Condition |
|---|---|---|
| pretre_trident (lot5) | `MAITRISE_DE_LA_FORCE_POLARIS` | `conditional: true` (uniquement si capable Force Polaris) |

---

---

## Découvertes critiques — Session 132 suite (2026-07-03) — AVANT AUTOCOMPACT

### 🔴 CRITIQUE — COMMERCE_TRAFIC et SCIENCES_CONNAISANCES_SPECIALISEES : parents virtuels, PAS des skill_ids valides

Lu dans migration 37 (grep session courante) :
- `COMMERCE_TRAFIC` : n'existe PAS comme `"id"` dans ref_skills. Apparaît SEULEMENT comme valeur `"parent"` de ses enfants. Migration 37 header : "3 parents virtuels corrompus corrigés (COMMERCE_TRAFIC, MANOEUVRE_DARMURE, PILOTAGE)".
- `SCIENCES_CONNAISANCES_SPECIALISEES` : idem — n'existe PAS comme `"id"` standalone. Seulement comme `"parent"` de ses enfants.

**Impact PIÈGE 1 :** Insérer `COMMERCE_TRAFIC` ou `SCIENCES_CONNAISANCES_SPECIALISEES` dans `ref_career_skills.skill_id` = ID fantôme silencieux. Jamais d'erreur SQL (pas de FK), mais compétence orpheline en wizard step4.

**Impact sur lots 2-6 déjà corrigés :**
- Lot3 MARCHAND : `COMMERCE_TRAFIC + conditional:true` → ❌ FAUX — doit utiliser un enfant spécifique
- Lot3 MARCHAND_ITINÉRANT : même problème ❌
- Lot2 ERUDIT : `SCIENCES_CONNAISANCES_SPECIALISEES + conditional:true` → ❌ FAUX
- Lot3 MÉDECIN : idem ❌
→ À corriger dans migration 104 avant insertion.

**Enfants SCIENCES confirmés existants dans migration 37 :**
ADMINISTRATION_GESTION ✅, BIOLOGIE_PHYSIOLOGIE ✅, BOTANIQUE ✅, CRIMINALISTIQUE ✅, DROIT_LEGISLATIONS ✅, ECONOMIE ✅, FINANCES ✅, GEOGRAPHIE ✅, GEOLOGIE ✅, HISTOIRE_ARCHEOLOGIE ✅, MEDECINE ✅, PHARMACOLOGIE ✅, PHYSIQUE_CHIMIE ✅, PSYCHOLOGIE ✅, SCIENCES_POLITIQUES ✅, SOCIOLOGIE ✅, ZOOLOGIE ✅

**Enfants COMMERCE_TRAFIC confirmés existants dans migration 37 :**
ARMES ✅, DENREES_ALIMENTAIRES ✅, DROGUES ✅, INFORMATIONS ✅, MATERIEL_MEDICAL ✅, MATIERES_PREMIERES ✅, VEHICULES ✅
→ ARTISANAT et OEUVRES_DART : ABSENTS → à ajouter en ref_skills avant 103c

### ✅ CASCADE migration 93 — lu dans cette session

Toutes les 7 tables enfants ont `onDelete('CASCADE')` sur `ref_careers.id` :
ref_career_skills, ref_career_titles, ref_career_prerequisites, ref_career_education, ref_career_random_benefits, ref_career_equipment, ref_career_point_categories.
→ `DELETE FROM ref_careers WHERE code IN (...)` supprime en cascade TOUT. Stratégie 103c up() confirmée.
→ `illustration` : `table.text('illustration')` L.10 ✅ confirmé.

### ✅ getStep4RefData — impact multi-rows CONNAISSANCE — lu dans cette session

`creationService.js` L.145 : `for (const sk of careerSkills) careersMap.get(sk.career_id)?.skills.push(sk)`
→ Pas de déduplication. 4 rows identiques CONNAISSANCE_DES_NATIONS_ORGANISATIONS pour chasseur_primes = 4 entrées dans `career.skills[]` côté client.
→ Impact wizard : à vérifier côté frontend avant d'ajouter multi-rows.
→ **Décision conservatoire : NE PAS ajouter multi-rows dans 103c. Laisser 1 row par skill_id jusqu'à confirmation comportement frontend.**

### Plan 103c — état des décisions après lectures

**Artisan A1 (COMMERCE_TRAFIC__DENREES_ALIMENTAIRES → ?) :**
LdB : "Artisanat, Œuvres d'art" → aucun enfant existant ne correspond.
→ Option retenue : ajouter `COMMERCE_TRAFIC__ARTISANAT` + `COMMERCE_TRAFIC__OEUVRES_DART` en ref_skills DANS 103c avant l'insert career_skills. À confirmer par Saar.

**Artisan A2 (SCIENCES parent → ?) :**
LdB : "Botanique, Chimie" → `SCIENCES_CONNAISANCES_SPECIALISEES_BOTANIQUE` ✅ existe. Utiliser + conditional:true.

**Assassin B3 (SCIENCES HISTOIRE_ARCHEOLOGIE → ?) :**
LdB : "Connaissance des poisons" → `SCIENCES_CONNAISANCES_SPECIALISEES_PHARMACOLOGIE` ✅ confirmé.

**Barman C1 (SCIENCES HISTOIRE_ARCHEOLOGIE → ?) :**
LdB : "Administration/Gestion" → `SCIENCES_CONNAISANCES_SPECIALISEES_ADMINISTRATION_GESTION` ✅ confirmé.

**Stratégie 103c up() :**
1. (si besoin) INSERT ref_skills : COMMERCE_TRAFIC__ARTISANAT + COMMERCE_TRAFIC__OEUVRES_DART
2. Pour chaque carrière lot1 : DELETE FROM ref_careers WHERE code = x → CASCADE supprime tout
3. Re-INSERT ref_careers (avec illustration) + ref_career_skills (corrigés) + ref_career_titles (corrigés)

**Stratégie 103c down() :**
1. DELETE FROM ref_careers WHERE code IN (lot1) → CASCADE
2. Re-INSERT données ORIGINALES de migration 100 (état erroné)
3. DELETE FROM ref_skills WHERE id IN ('COMMERCE_TRAFIC__ARTISANAT', 'COMMERCE_TRAFIC__OEUVRES_DART') si ajoutés

---

## Plan d'attaque — lot-par-lot (acté session 132)

| Migration | Contenu | État |
|---|---|---|
| 104 | Lot2 — 5 carrières | ❌ |
| 105 | Lot3 — ~8 carrières | ❌ |
| 106 | Lot4a — ~5 carrières | ❌ |
| 107 | Lot4b — 3 carrières | ❌ |
| 108 | Lot5 — ~7 carrières | ❌ |
| 109 | Lot6 — ~6 carrières | ❌ |
| 110 | Prérequis (espion + tout autre) | ❌ |

**Workflow par lot :** lire → écrire migration → SR → confirmer → lot suivant.

### Avant de coder la migration 104 — lectures obligatoires

- [ ] `server/src/db/migrations/93_ref_careers.js` — schéma complet (CASCADE ? colonnes required_genotype / ally_type / enemy_rule / salary_formula ?)
- [ ] `server/src/db/migrations/37_char_seed_skills.js` — vérification ciblée : 11 IDs PIÈGE 3 + suffixes ARTS_MARTIAUX + suffixes SCIENCES

### Décision ouverte

**[CONFLIT LOT2]** hybride_trident → `manoeuvre_armure` : **LdB l'exclut** (L.657-672 — aucune mention), **lot2 L.190 l'inclut**.  
→ **[DÉCISION REQUISE]** de Saar avant écriture migration 104.

### Risques critiques identifiés — run à vide session 132

**R1 — PIÈGE 1 amplifié (BLOQUANT SILENCIEUX)**
`ref_career_skills.skill_id` sans FK → toute erreur d'ID insérée sans exception. Seule protection : vérifier chaque ID contre migration 37 avant d'écrire.

**R2 — IDs PIÈGE 3 non revérifiés dans cette session**
11 renommages dans PIÈGE 3 viennent de session 131 (compactée) — statut [HYPOTHÈSE], jamais revérifiés dans cette session contre migration 37.

**R3 — Suffixes ARTS_MARTIAUX et SCIENCES non vérifiés**
`ARTS_MARTIAUX_LUTTE`, `_TECHNIQUES_DEFENSIVES`, `_TECHNIQUES_OFFENSIVES` — jamais grep migration 37 dans cette session.
Tous les suffixes SCIENCES (BIOLOGIE_PHYSIOLOGIE, BOTANIQUE, ZOOLOGIE, SCIENCES_POLITIQUES, HISTOIRE_ARCHEOLOGIE, GEOGRAPHIE) — idem.

**R4 — Schema migration 93 inconnu dans cette session**
Colonnes `required_genotype`, `ally_type`, `enemy_rule`, `salary_formula` dans ref_careers : présentes ? CASCADE sur toutes les tables liées ? Si non → down() explose.

**R5 — Expansion 1→N (risque copier-coller)**
Les lots ont 1 row `pilotage` / `arts_martiaux` / `sciences` / `manoeuvre_armure`. Migration 104 doit les expander en N rows spécifiques. Si on copie sans expander → ID générique inséré silencieusement.

---

## Lot 2 — Lu ✅ — 5 carrières

> Session 131 suite (vérifications) + lecture complète session 132.

### Carrières lot2

| code | education | point_categories | notes |
|---|---|---|---|
| `cultivateur_eleveur` | aucune | 4 (Parcelle, Célébrité, Relations, Matériel) | — |
| `diplomate` | Droit + Sciences politiques | 5 (Célébrité, Relations, Corruption, Matériel, Cabine privée) | — |
| `erudit_archeologue` | Sciences/Sciences humaines | 5 (Relations, Célébrité, Cabine privée, Matériel, Bases de données) | restricted_geographic_origin |
| `espion` | aucune | 7 | prérequis LOT (voir ci-dessous) |
| `hybride_trident` | aucune | 3 (Célébrité, Relations, Matériel) | required_genotype = 'geno_hybride' |

### Résolutions appliquées (mapping déjà établi en session 131)

**cultivateur_eleveur :**
- `pilotage` → `PILOTAGE__VEHICULES_DE_SOL` + `PILOTAGE__SCOOTERS_SOUS_MARINS` (2 rows — mapping PILOTAGE table)
- `manoeuvre_armure` → `MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES` (mapping MANOEUVRE_DARMURE table)
- `connaissance_milieu_naturel` → `CONNAISSANCE_MILIEU_NATUREL_OCEANS` (mapping CMN table)
- `sciences_connaissances_specialisees` → `SCIENCES_CONNAISANCES_SPECIALISEES_BIOLOGIE_PHYSIOLOGIE` + `_BOTANIQUE` + `_ZOOLOGIE` (3 rows — SCIENCES mapping)
- `artisanat` → `ART_ARTISANAT` (PIÈGE 3)
- `premiers_soins` → `PREMIER_SOINS` (PIÈGE 3)

**diplomate :**
- `sciences_connaissances_specialisees` → `SCIENCES_CONNAISANCES_SPECIALISEES_SCIENCES_POLITIQUES` (1 row — SCIENCES mapping)

**erudit_archeologue :**
- `sciences_connaissances_specialisees` → `SCIENCES_CONNAISANCES_SPECIALISEES` + `conditional: true` (LdB L.513-514 : "au choix, en général Archéologie, Géographie, Histoire, etc." — pas 2 IDs fixes)
- `analyse_sonscans` → `ANALYSES_SONSCANS` (PIÈGE 3)

**espion :**
- `arts_martiaux` → `ARTS_MARTIAUX_LUTTE` + `ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES` + `ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES` (3 rows — ARTS_MARTIAUX mapping)
- `acrobatie_equilibre` → `ACROBATIE_EQUILIBRE` (simple C — post migration 74)
- `combat_mains_nues` → `COMBAT_A_MAINS_NUES` (PIÈGE 3)
- `fusils_armes_epaule` → `FUSIL_ARMES_DEPAULES` (PIÈGE 3)
- `systemes_securite` → `SYSTEMES_DE_SECURITE` (PIÈGE 3)

**hybride_trident :**
- `arts_martiaux` → `ARTS_MARTIAUX_LUTTE` (ARTS_MARTIAUX mapping)
- `connaissance_milieu_naturel` → `CONNAISSANCE_MILIEU_NATUREL_OCEANS` (mapping + LdB L.670-671)
- `tactique` → `TACTIQUE_OPERATIONS_COMMANDO` (TACTIQUE mapping — LdB L.666)
- `manoeuvres_sous_marines` → `MANOEUVRES_SOUS_MARINES` + `conditional: true` ✅

### [CONFLIT LOT2] hybride_trident → manoeuvre_armure

**Lot2 L.190 :** `{ skill_id: 'manoeuvre_armure', skill_group: 'Pilotage' }` — inclus dans le fichier.  
**LdB L.657-672 :** Aucune mention de Manœuvre d'armure dans la liste des compétences professionnelles hybride_trident.  
**Source absolue = LdB** (CLAUDE.md convention).

→ **✅ RÉSOLU** : exclu (LdB + logique métier : un hybride ne porte pas d'armure). Vérifié dans lot2 : `MANOEUVRE_DARMURE` absent du seed hybride_trident — correction déjà appliquée lors de la réécriture lot2.

### [PRÉREQUIS LOT2] espion

Lot2 L.279 (commentaire) : prérequis = `diplomate, mercenaire, policier_enqueteur, soldat_milicien, veilleur` — 3 ans d'exp.  
Table `ref_career_prerequisites` existe dans le schéma (migration 93_ref_careers).  
**Non inséré dans lot2** — le commentaire dit "sera lié après seed complet".  
→ Vérifier dans les autres lots si des prérequis sont insérés. Si jamais : migration 104 n'insère pas dans `ref_career_prerequisites`.

---

## Lot 3 — Lu ✅ — 5 carrières

> Session 132 suite (2026-07-03) — vérification CHAQUE MOT du LdB vs seed.

### Corrections appliquées (93_seed_ref_careers_lot3.cjs)

**MARCHAND** (13 → 16 lignes)
- Tous les skill_ids en UPPERCASE
- `commerce_trafic` → `COMMERCE_TRAFIC` + `conditional:true` (`EQUIPEMENTS_COURANTS` absent de ref_skills)
- `connaissance_nations` (1) → 3 lignes `CONNAISSANCE_DES_NATIONS_ORGANISATIONS` (communauté d'origine, d'accueil, Contrebandiers)
- `recherche_informations` → `RECHERCHE_DINFORMATIONS`
- `sciences_connaissances_specialisees` → 2 lignes : `SCIENCES_CONNAISANCES_SPECIALISEES_ADMINISTRATION_GESTION` + `SCIENCES_CONNAISANCES_SPECIALISEES_ECONOMIE`
- `neo_azuran` → `LANGUE_ETRANGERE_NEO_AZURAN`, `soleen` → `LANGAGES_SPECIFIQUES_SOLEEN`

**MARCHAND ITINÉRANT/CONTEUR** (19 → 19 lignes)
- Tous les skill_ids en UPPERCASE
- `expression_artistique` → `EXPRESSION_ARTISTIQUE_COMEDIE_CONTE` + `conditional:true`
- `commerce_trafic` → `COMMERCE_TRAFIC` + `conditional:true`
- `connaissance_nations` → `CONNAISSANCE_DES_NATIONS_ORGANISATIONS` + `conditional:true` (LdB : "au choix")
- `pilotage` → `PILOTAGE__NAVIRES_LEGERS` (LdB : "Pilotage (Navires légers)")
- `analyse_sonscans` → `ANALYSES_SONSCANS`
- `artisanat` → `ART_ARTISANAT`
- `premiers_soins` → `PREMIER_SOINS`
- `neo_azuran`/`soleen` → préfixes corrects

**MÉDECIN/CHIRURGIEN** (12 → 13 lignes)
- Tous les skill_ids en UPPERCASE
- `connaissance_nations` (1) → 2 lignes `CONNAISSANCE_DES_NATIONS_ORGANISATIONS` (communauté d'origine, communauté d'accueil)
- `recherche_informations` → `RECHERCHE_DINFORMATIONS`
- `sciences_connaissances_specialisees` → `SCIENCES_CONNAISANCES_SPECIALISEES` + `conditional:true` (LdB : "en fonction de la spécialité")
- `metalan` → `LANGAGES_SPECIFIQUES_METALAN`, `azuran` → `LANGUE_ANCIENNE_AZURAN`, `neo_azuran` → `LANGUE_ETRANGERE_NEO_AZURAN`
- `premiers_soins` → `PREMIER_SOINS`

**MERCENAIRE** (27 → 31 lignes)
- Tous les skill_ids en UPPERCASE
- `connaissance_nations` (1) → 3 lignes `CONNAISSANCE_DES_NATIONS_ORGANISATIONS` (communauté d'origine, d'accueil, Mercenaires)
- `tactique` → `TACTIQUE_OPERATIONS_COMMANDO` (LdB : "Tactique (Opérations commandos)")
- `arts_martiaux` (1) → 2 lignes : `ARTS_MARTIAUX_LUTTE` + `ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES` (LdB : "Lutte, Techniques offensives")
- `combat_mains_nues` → `COMBAT_A_MAINS_NUES`
- `armes_lourdes_tir` → `ARMES_LOURDES` (skill family = Combat (tir), distinct de ARMES_LOURDES_CONTACT)
- `armes_poing` → `ARMES_DE_POING`
- `fusils_armes_epaule` → `FUSIL_ARMES_DEPAULES`
- `tir_automatique` → `TIR_AUTOMATIQUES`
- `manoeuvre_armure` → `MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES`
- `pilotage` (1) → 2 lignes : `PILOTAGE__NAVIRES_LEGERS` + `PILOTAGE__SCOOTERS_SOUS_MARINS`
- `analyse_sonscans` → `ANALYSES_SONSCANS`
- `premiers_soins` → `PREMIER_SOINS`

**MINEUR** (15 → 19 lignes)
- Tous les skill_ids en UPPERCASE
- `klan` → `LANGAGES_SPECIFIQUES_KLAN`
- `manoeuvre_armure` (1) → 2 lignes : `MANOEUVRE_DARMURE__ARMURES_EXTERNES` + `MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES`
- `pilotage` (1) → 2 lignes : `PILOTAGE__VEHICULES_DE_SOL` + `PILOTAGE__VEHICULES_SOUTERRAINS`
- `connaissance_milieu_naturel` (1) → 2 lignes : `CONNAISSANCE_MILIEU_NATUREL_OCEANS` + `CONNAISSANCE_MILIEU_NATUREL_SOUTERRAINS`
- `mecanique` (1) → 2 lignes : `MECANIQUE_VEHICULES_DE_SOL` + `MECANIQUE_VEHICULES_SOUTERRAINS`

### Compétence absente de ref_skills — détectée lot 3

- `COMMERCE_TRAFIC__EQUIPEMENTS_COURANTS` — absent. LdB MARCHAND ITINÉRANT dit "(en général Équipements courants)". Les enfants existants de COMMERCE_TRAFIC : ARMES, DENREES_ALIMENTAIRES, DROGUES, INFORMATIONS, MATERIEL_MEDICAL, MATIERES_PREMIERES, VEHICULES. → Seeds utilisent le parent `COMMERCE_TRAFIC` + `conditional:true`.

---

## Lot 4a — Lu ✅ — 5 carrières

> Session 132 (2026-07-03) — vérification CHAQUE MOT du LdB vs seed.

### Corrections appliquées (93_seed_ref_careers_lot4a.cjs)

**OFFICIER NAVAL/NAVIGATEUR — civil + militaire** (18 → 20 lignes — navalSkills partagé)
- Tous les skill_ids en UPPERCASE
- `armes_poing` → `ARMES_DE_POING`
- `connaissance_nations` → `CONNAISSANCE_DES_NATIONS_ORGANISATIONS` + `conditional:true` (LdB : "(au choix)")
- `tactique` → `TACTIQUE_COMBAT_NAVAL` (LdB : "Tactique (combat naval)")
- `neo_azuran` → `LANGUE_ETRANGERE_NEO_AZURAN`
- `soleen` → `LANGAGES_SPECIFIQUES_SOLEEN`
- `manoeuvre_armure` → `MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES` (LdB : "(Armures sous-marines)")
- `pilotage` (1 ligne) → 3 lignes : `PILOTAGE__NAVIRES_LEGERS` + `PILOTAGE__NAVIRES_LOURDS` + `PILOTAGE__VEHICULES_DE_SOL`
- `connaissance_milieu_naturel` → `CONNAISSANCE_MILIEU_NATUREL_OCEANS`
- `analyse_sonscans` → `ANALYSES_SONSCANS`

**OFFICIER MILITAIRE — compétences communes** (27 → 29 lignes)
- Tous les skill_ids en UPPERCASE
- `combat_mains_nues` → `COMBAT_A_MAINS_NUES`
- `techniques_speciales` → `ARMES_SPECIALES_CONTACT_FORCE_COORDINATION` + `conditional:true` (LdB : "Techniques spéciales (au choix)")
- `armes_lourdes_tir` → `ARMES_LOURDES`
- `armes_poing` → `ARMES_DE_POING`
- `fusils_armes_epaule` → `FUSIL_ARMES_DEPAULES`
- `connaissance_nations` → `CONNAISSANCE_DES_NATIONS_ORGANISATIONS` + `conditional:true` (LdB : "(au choix)")
- `connaissance_milieux_sociaux` → `CONNAISSANCE_MILIEUX_SOCIAUX` (Cat1 — migration 103 ; "(Armée)" = descripteur LdB, pas un enfant DB)
- `tactique` (1 ligne) → 2 lignes : `TACTIQUE_COMBAT_TERRESTRE` + `TACTIQUE_OPERATIONS_COMMANDO` (LdB : "Combat terrestre, Combat sub-tactique")
- `manoeuvre_armure` (1 ligne) → 2 lignes : `MANOEUVRE_DARMURE__ARMURES_EXTERNES` + `MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES`
- `pilotage` (1 ligne) → `PILOTAGE__VEHICULES_DE_SOL` (1 ligne) — LdB "Véhicules terrestres et sous-marins" = 1 ID (description migration 37 : "capables d'évoluer sous l'eau ou à la surface")
- `connaissance_milieu_naturel` → `CONNAISSANCE_MILIEU_NATUREL_OCEANS`
- `analyse_sonscans` → `ANALYSES_SONSCANS`

**OFFICIER MILITAIRE SOUTERRAIN — skills spécifiques** (2 → 3 lignes)
- `pilotage` + conditional:true → `PILOTAGE__VEHICULES_SOUTERRAINS` (sans conditional — spécifique, pas au choix)
- `connaissance_milieu_naturel` + conditional:true → `CONNAISSANCE_MILIEU_NATUREL_SOUTERRAINS` (sans conditional)
- **AJOUT** : `CAMOUFLAGE_DISSIMULATION` — LdB L.1230-1231 "Opérations en milieu hostile : Camouflage" sans parenthèse Surface/Souterrains → s'applique aux deux spécialisations

**OFFICIER MILITAIRE SURFACE — skills spécifiques** (3 → 3 lignes)
- `camouflage_dissimulation` → `CAMOUFLAGE_DISSIMULATION` (Cat1)
- `armes_satellites` → `ARMES_SATELLITES` (Cat1 — migration 103b)
- `connaissance_milieu_naturel` + conditional:true → `CONNAISSANCE_MILIEU_NATUREL_SURFACE` (sans conditional — spécifique)

**OUVRIER/DOCKER** (9 → 11 lignes)
- Tous les skill_ids en UPPERCASE
- `combat_mains_nues` → `COMBAT_A_MAINS_NUES`
- `connaissance_nations` (1 ligne) → 2 lignes `CONNAISSANCE_DES_NATIONS_ORGANISATIONS` (communauté d'origine, communauté d'accueil) — LdB virgule = 2 rows
- `manoeuvre_armure` (1 ligne) → 2 lignes : `MANOEUVRE_DARMURE__ARMURES_EXTERNES` + `MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES`
- `mecanique` → `MECANIQUE_GENERATEURS_SYSTEME_DE_SURVIE` + `conditional:true` (LdB : "ou toute autre Compétence liée au domaine d'activité")

### Découverte technique — lot 4a

- `PILOTAGE__VEHICULES_DE_SOL` description migration 37 : "qu'ils soient capables d'évoluer sous l'eau ou à la surface" → couvre "Véhicules terrestres et sous-marins" (LdB) en un seul ID.

---

## Lot 4b — Lu ✅ — 3 carrières

> Session 132 suite (2026-07-03) — vérification CHAQUE MOT du LdB vs seed.

### Corrections appliquées (93_seed_ref_careers_lot4b.cjs)

**PILOTE DE CHASSE — piloteCommonSkills** (18 → 16 lignes)
- Tous les skill_ids en UPPERCASE
- `connaissance_nations` (1 ligne) → 2 lignes `CONNAISSANCE_DES_NATIONS_ORGANISATIONS` (communauté d'origine + communauté d'accueil) — LdB L.1392-1393
- `neo_azuran` → `LANGUE_ETRANGERE_NEO_AZURAN`
- `langage_signes` → `LANGAGES_SPECIFIQUES_LANGAGE_DES_SIGNES`
- `analyse_sonscans` → `ANALYSES_SONSCANS`
- **RETRAIT** : `manoeuvre_armure`, `pilotage`, `mecanique` retirés de common — ces 3 skills diffèrent entre SM et ATM, ils ne peuvent pas être communs
- **Non seedable** : "langue de la communauté d'accueil" — `LANGUE_ETRANGERE` n'existe pas comme skill_id standalone dans ref_skills (parent uniquement, sans entrée propre) → skill omis, commentaire conservé dans le fichier

**PILOTE DE CHASSE SOUS-MARIN — piloteSMSkills** (4 → 9 lignes)
- `respiration_foe` → `RESPIRATION_FOE`
- `armes_sous_marines` → `ARMES_SOUS_MARINES`
- `tactique` → `TACTIQUE_COMBAT_NAVAL` (LdB L.1395 : "Tactique (Combat naval)")
- `connaissance_milieu_naturel` → `CONNAISSANCE_MILIEU_NATUREL_OCEANS`
- **AJOUT** : `MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES` (LdB L.1400-1401)
- **AJOUT** : `PILOTAGE__CHASSEURS_SOUS_MARINS` (LdB L.1401)
- **AJOUT** : `PILOTAGE__NAVIRES_LEGERS` (LdB L.1401)
- **AJOUT** : `PILOTAGE__VEHICULES_DE_SOL` (LdB L.1401)
- **AJOUT** : `MECANIQUE_NAVIRES_CHASSEURS_SOUS_MARINS` (LdB L.1407 : "Mécanique (Chasseurs … sous-marins)")

**PILOTE DE CHASSE ATMOSPHÉRIQUE — piloteAtmSkills** (2 → 6 lignes)
- `tactique` → `TACTIQUE_COMBAT_TERRESTRE` (LdB L.1394 : "Tactique (Combat terrestre)")
- `connaissance_milieu_naturel` → `CONNAISSANCE_MILIEU_NATUREL_SURFACE`
- **AJOUT** : `MANOEUVRE_DARMURE__ARMURES_EXTERNES` (LdB L.1398-1399)
- **AJOUT** : `MANOEUVRE_DARMURE__ARMURES_ATMOSPHERIQUES` (LdB L.1398-1399)
- **AJOUT** : `PILOTAGE__CHASSEURS_ATMOSPHERIQUES` (LdB L.1399)
- **AJOUT** : `MECANIQUE_CHASSEURS_ATMOSPHERIQUES` (LdB L.1407 : "Mécanique (Chasseurs atmosphériques …)")

Note OCR LdB L.1403-1406 : deux lignes "Pilote de chasseur atmosphérique" pour Survie/Extérieur — la seconde (Océans) est une erreur OCR, elle devrait lire "Pilote de chasseur sous-marin". Corrigé par logique : ATM = Surface, SM = Océans.

**PIRATE** (21 → 21 lignes — 0 ajout, 0 suppression)
- `manoeuvres_sous_marines` → `MANOEUVRES_SOUS_MARINES`
- `arts_martiaux` → `ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES` (LdB L.1471 : "Techniques offensives")
- `combat_arme` → `COMBAT_ARME`
- `combat_mains_nues` → `COMBAT_A_MAINS_NUES`
- `armes_poing` → `ARMES_DE_POING`
- `armes_sous_marines` → `ARMES_SOUS_MARINES`
- `fusils_armes_epaule` → `FUSIL_ARMES_DEPAULES`
- `tir_automatique` → `TIR_AUTOMATIQUES` ⚠️ (S final — migration 37 L.248)
- `intimidation` → `INTIMIDATION`
- `connaissance_nations` → `CONNAISSANCE_DES_NATIONS_ORGANISATIONS`
- `jeu` → `JEU`
- `tactique` → `TACTIQUE_OPERATIONS_COMMANDO` (LdB L.1475 : "Tactique (Opérations commando)")
- `furtivite_deplacement_silencieux` → `FURTIVITE_DEPLACEMENT_SILENCIEUX`
- `neo_azuran` → `LANGUE_ETRANGERE_NEO_AZURAN`
- `ithraxien` → `LANGAGES_SPECIFIQUES_ITHRAXIEN` (migration 37 L.1048 — "Langue des pirates")
- `manoeuvre_armure` → `MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES` (LdB L.1478)
- `telepilotage` → `TELEPILOTAGE`
- `connaissance_milieu_naturel` → `CONNAISSANCE_MILIEU_NATUREL_OCEANS`
- `observation` → `OBSERVATION`
- `orientation` → `ORIENTATION`
- `survie` → `SURVIE`

Tout non-skill (descriptions, titres, avantages/désavantages, équipement, random benefits) vérifié mot à mot → aucune correction.

### Découverte technique — lot 4b

- `LANGUE_ETRANGERE` n'existe pas comme skill_id standalone dans migration 37 : c'est uniquement une valeur de champ `parent` pour ses enfants (LANGUE_ETRANGERE_NEO_AZURAN, etc.). Impossible de l'utiliser comme `skill_id` dans `ref_career_skills`. → Les skills "langue de la communauté d'accueil/d'origine" variables ne peuvent être seedés qu'en référençant un enfant spécifique ou sont omis (commentaire dans le fichier source).

---

## Lot 5 — Lu ✅ — 5 carrières

> Session 132 suite (2026-07-03) — vérification CHAQUE MOT du LdB vs seed.

### Corrections appliquées (93_seed_ref_careers_lot5.cjs)

**POLICIER/ENQUÊTEUR** (24 → 28 lignes)
- Tous les skill_ids en UPPERCASE
- `arts_martiaux` (1 ligne) → 2 lignes : `ARTS_MARTIAUX_LUTTE` + `ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES` (LdB L.1529-1530 : "Lutte, Techniques défensives")
- `combat_mains_nues` → `COMBAT_A_MAINS_NUES`
- `armes_poing` → `ARMES_DE_POING`
- `fusils_armes_epaule` → `FUSIL_ARMES_DEPAULES`
- `connaissance_nations` (1 ligne) → 3 lignes `CONNAISSANCE_DES_NATIONS_ORGANISATIONS` (communauté d'origine, communauté d'accueil, Crime organisé) — LdB L.1533-1534
- `recherche_informations` → `RECHERCHE_DINFORMATIONS`
- `sciences_connaissances_specialisees` (1 ligne) → 2 lignes : `SCIENCES_CONNAISANCES_SPECIALISEES_PHARMACOLOGIE` (drogues) + `SCIENCES_CONNAISANCES_SPECIALISEES_DROIT_LEGISLATIONS` (Droit) — LdB L.1534-1535
- `neo_azuran` → `LANGUE_ETRANGERE_NEO_AZURAN`
- `soleen` → `LANGAGES_SPECIFIQUES_SOLEEN` (migration 37 L.1118)
- `premiers_soins` → `PREMIER_SOINS` ⚠️ (PREMIER sans S — migration 37 L.1628)
- `systemes_securite` → `SYSTEMES_DE_SECURITE` (`_DE_` manquant)

**PRÊTRE DU TRIDENT** (15 → 17 lignes)
- Tous les skill_ids en UPPERCASE
- `connaissance_nations` (1 ligne) → 3 lignes `CONNAISSANCE_DES_NATIONS_ORGANISATIONS` (communauté d'origine, communauté d'accueil ou Équinoxe, Culte du Trident) — LdB L.1601-1604
- `sciences_connaissances_specialisees` → `SCIENCES_CONNAISANCES_SPECIALISEES_ADMINISTRATION_GESTION` + `conditional:true` (LdB L.1602-1604 : "selon spécialité, en général : Administration/Gestion, Médecine, Psychologie, Sciences politiques" = au choix 1 spécialité)
- `absolan` → `LANGAGES_SPECIFIQUES_ABSOLAN` (migration 37 L.998)
- `inesis` → `LANGAGES_SPECIFIQUES_INESIS` (migration 37 L.1038)
- `neo_azuran` → `LANGUE_ETRANGERE_NEO_AZURAN`
- `premiers_soins` → `PREMIER_SOINS`
- `maitrise_polaris` → `MAITRISE_DE_LA_FORCE_POLARIS` + `conditional:true` (migration 37 L.1718)
- **Non seedable** : "langue de la communauté d'accueil" — LANGUE_ETRANGERE parent seulement, commentaire conservé

**PROSTITUÉ(E)** (15 → 17 lignes)
- Tous les skill_ids en UPPERCASE
- `combat_mains_nues` → `COMBAT_A_MAINS_NUES`
- `armes_poing` → `ARMES_DE_POING`
- `expression_artistique` → `EXPRESSION_ARTISTIQUE_COMEDIE_CONTE` + `conditional:true` (LdB L.1678 : "au choix" — parent seulement)
- `connaissance_nations` (1 ligne) → 2 lignes `CONNAISSANCE_DES_NATIONS_ORGANISATIONS` (communauté d'origine, communauté d'accueil) — LdB L.1680-1681
- `sciences_connaissances_specialisees` (1 ligne) → 2 lignes : `SCIENCES_CONNAISANCES_SPECIALISEES_PHARMACOLOGIE` (drogues) + `SCIENCES_CONNAISANCES_SPECIALISEES_PSYCHOLOGIE` (Psychologie) — LdB L.1681
- `artisanat` → `ART_ARTISANAT` (migration 37 L.1368 — standalone, parent null)
- `premiers_soins` → `PREMIER_SOINS`
- **Non seedable** : "langue de la communauté d'accueil" + "une autre langue courante au choix" — commentaires conservés

**SCIENTIFIQUE/INGÉNIEUR** (14 → 14 lignes)
- Tous les skill_ids en UPPERCASE
- `connaissance_nations` → `CONNAISSANCE_DES_NATIONS_ORGANISATIONS` + `conditional:true` (LdB L.1745 : "au choix")
- `recherche_informations` → `RECHERCHE_DINFORMATIONS`
- `sciences_connaissances_specialisees` → `SCIENCES_CONNAISANCES_SPECIALISEES_PHYSIQUE_CHIMIE` + `conditional:true` (LdB L.1746 : "au choix selon domaine")
- `metalan` → `LANGAGES_SPECIFIQUES_METALAN` (migration 37 L.1088)
- `neo_azuran` → `LANGUE_ETRANGERE_NEO_AZURAN`
- `neolan` → `LANGAGES_SPECIFIQUES_NEOLAN` (migration 37 L.1098)
- `genie_technique` → `GENIE_TECHNIQUE_ELECTRONIQUE_INFORMATIQUE` + `conditional:true` (LdB L.1749 : "au choix selon domaine" — GENIE_TECHNIQUE parent seulement)

**SOLDAT/MILICIEN** (20 → 21 lignes)
- Tous les skill_ids en UPPERCASE
- `arts_martiaux` → `ARTS_MARTIAUX_LUTTE` + `conditional:true` (LdB L.1820 : "au choix" — parent seulement)
- `armes_speciales` → `ARMES_SPECIALES_CONTACT_FORCE_COORDINATION` + `conditional:true` (LdB L.1820 : "au choix" — ARMES_SPECIALES_CONTACT parent seulement)
- `combat_mains_nues` → `COMBAT_A_MAINS_NUES`
- `armes_lourdes_tir` → `ARMES_LOURDES` (migration 37 L.178 — pas de suffixe `_TIR`)
- `armes_poing` → `ARMES_DE_POING`
- `fusils_armes_epaule` → `FUSIL_ARMES_DEPAULES`
- `tir_automatique` → `TIR_AUTOMATIQUES` ⚠️ (S final)
- `connaissance_nations` (1 ligne) → 2 lignes `CONNAISSANCE_DES_NATIONS_ORGANISATIONS` (communauté d'origine, communauté d'accueil) — LdB L.1825-1826
- `tactique` → `TACTIQUE_OPERATIONS_COMMANDO` (LdB L.1827 : "Tactique (Opérations commando)")
- `premiers_soins` → `PREMIER_SOINS`
- **Note** : aucune compétence linguistique dans le LdB Soldat (L.1818-1830) — commentaire erroné supprimé du fichier

### Découvertes techniques — lot 5

- `PREMIER_SOINS` (migration 37 L.1628) — **PREMIER sans S**. Toutes les seeds lot 2-4 ont `premiers_soins` (avec S) → erreur silencieuse dans tous les lots précédents. À corriger dans lots 2, 3, 4a, 4b.
- `RECHERCHE_DINFORMATIONS` (migration 37 L.498) — apostrophe encodée dans l'ID. Seeds précédentes ont `recherche_informations` → erreur silencieuse dans lots 2-4.
- `MAITRISE_DE_LA_FORCE_POLARIS` (migration 37 L.1718) — ID complet (pas `MAITRISE_POLARIS`).
- `GENIE_TECHNIQUE` — parent seulement (pas de standalone). Sub-skills : `_ARCHITECTURE_GENIE_CIVIL`, `_ARCHITECTURE_NAVALE`, `_BIONIQUE_CYBERTECHNOLOGIE`, `_BIOTECHNOLOGIE_GENIE_GENETIQUE`, `_ELECTRONIQUE_INFORMATIQUE`, `_LOGICIELS`, `_NANOTECHNOLOGIE`, `_ROBOTIQUE`, `_TELECOMMUNICATIONS`.
- `EXPRESSION_ARTISTIQUE` — parent seulement. Sub-skills : `_CHANT`, `_COMEDIE_CONTE`, `_DANSE`, `_INSTRUMENT_DE_MUSIQUE`.
- `ARMES_SPECIALES_CONTACT` — parent seulement. Sub-skills : `_FORCE_COORDINATION`, `_COORDINATION_COORDINATION`.
- `LANGAGES_SPECIFIQUES_SOLEEN` (migration 37 L.1118) — confirmé.
- `SYSTEMES_DE_SECURITE` (migration 37 L.1638) — avec `_DE_`.

### Impact lots précédents — corrections à appliquer (lots 2-4)

Les lots 2-4 utilisent probablement `premiers_soins` et `recherche_informations` avec les mauvais IDs. À vérifier et corriger avant migration 104.

---

## Lot 6 — Lu ✅ — 9 carrières (4×Soldat d'élite, Sous-marinier, Technicien, Techno-hybride, Veilleur, Voleur)

> Session 132 suite (2026-07-03) — vérification CHAQUE MOT du LdB vs seed.

### Corrections appliquées (93_seed_ref_careers_lot6.cjs)

**SOLDAT D'ÉLITE COMMUN** (soldatEliteCommonSkills) — 24 → 25 lignes
- `arts_martiaux` → `ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES` + `conditional:true` (LdB L.1911 : "au choix")
- `armes_speciales` → `ARMES_SPECIALES_CONTACT_FORCE_COORDINATION` + `conditional:true`
- `combat_mains_nues` → `COMBAT_A_MAINS_NUES`
- `armes_lourdes_tir` → `ARMES_LOURDES`
- `armes_poing` → `ARMES_DE_POING`
- `fusils_armes_epaule` → `FUSIL_ARMES_DEPAULES`
- `tir_automatique` → `TIR_AUTOMATIQUES`
- `connaissance_nations` (1) → 2 lignes `CONNAISSANCE_DES_NATIONS_ORGANISATIONS` (d'origine + d'accueil) — LdB L.1919
- `tactique` → `TACTIQUE_OPERATIONS_COMMANDO` (LdB L.1919)
- `neo_azuran` → `LANGUE_ETRANGERE_NEO_AZURAN`
- `analyse_sonscans` → `ANALYSES_SONSCANS`
- `premiers_soins` → `PREMIER_SOINS`

**COMMANDO MARIN** — 10 → 10 lignes
- `langage_signes` → `LANGAGES_SPECIFIQUES_LANGAGE_DES_SIGNES`
- `manoeuvre_armure` → `MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES`
- `pilotage` → `PILOTAGE__VEHICULES_DE_SOL`
- `connaissance_milieu_naturel` → `CONNAISSANCE_MILIEU_NATUREL_OCEANS`

**COMMANDO SOUTERRAIN** — 6 → 7 lignes
- `manoeuvre_armure` → `MANOEUVRE_DARMURE__ARMURES_EXTERNES`
- `pilotage` (1) → 2 lignes : `PILOTAGE__VEHICULES_SOUTERRAINS` + `PILOTAGE__VEHICULES_DE_SOL` (LdB L.1925 : virgule = 2 IDs)
- `connaissance_milieu_naturel` → `CONNAISSANCE_MILIEU_NATUREL_SOUTERRAINS`

**COMMANDO DE SURFACE** — 8 → 9 lignes
- `tir_precision` → `TIR_DE_PRECISION`
- `manoeuvre_armure` (1) → 2 lignes : `MANOEUVRE_DARMURE__ARMURES_EXTERNES` + `MANOEUVRE_DARMURE__ARMURES_ATMOSPHERIQUES` (LdB L.1926 : virgule = 2 IDs)
- `pilotage` → `PILOTAGE__VEHICULES_DE_SOL`
- `connaissance_milieu_naturel` → `CONNAISSANCE_MILIEU_NATUREL_SURFACE`
- `mecanique` → `MECANIQUE_VEHICULES_DE_SOL`

**FORCES SPÉCIALES** — 3 → 3 lignes
- `tir_precision` → `TIR_DE_PRECISION`
- `systemes_securite` → `SYSTEMES_DE_SECURITE`

**SOUS-MARINIER** — 19 → 22 lignes
- `combat_mains_nues` → `COMBAT_A_MAINS_NUES`
- `connaissance_nations` (1) → 2 lignes (communauté d'origine + ports commerciaux) — LdB L.2031
- `neo_azuran` → `LANGUE_ETRANGERE_NEO_AZURAN`
- `soleen` → `LANGAGES_SPECIFIQUES_SOLEEN`
- `manoeuvre_armure` → `MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES`
- `pilotage` (1) → 3 lignes : `PILOTAGE__NAVIRES_LEGERS` + `PILOTAGE__NAVIRES_LOURDS` + `PILOTAGE__SCOOTERS_SOUS_MARINS` (LdB L.2034)
- `connaissance_milieu_naturel` → `CONNAISSANCE_MILIEU_NATUREL_OCEANS`
- `analyse_sonscans` → `ANALYSES_SONSCANS`
- `armes_embarquees` → `ARMES_EMBARQUEES_ARTILLERIE`

**TECHNICIEN/MÉCANICIEN** — 11 → 13 lignes
- `connaissance_nations` (1) → 2 lignes (communauté d'origine + communauté d'accueil) — LdB L.2105-2106
- `sciences_connaissances_specialisees` (1) → 2 lignes : `SCIENCES_CONNAISANCES_SPECIALISEES_PHYSIQUE_CHIMIE` + `SCIENCES_CONNAISANCES_SPECIALISEES_GEOLOGIE` (tous deux `conditional:true` — LdB L.2106-2108 : exemples, non fixe)
- `neolan` → `LANGAGES_SPECIFIQUES_NEOLAN`
- `systemes_securite` → `SYSTEMES_DE_SECURITE`
- `mecanique` → `MECANIQUE_NAVIRES_CHASSEURS_SOUS_MARINS` + `conditional:true` (LdB L.2113 : "au choix")

**TECHNO-HYBRIDE** — 19 → 20 lignes
- `arts_martiaux` → `ARTS_MARTIAUX_LUTTE` sans `conditional` (LdB L.2177 : "(Lutte)" — définitif)
- `combat_mains_nues` → `COMBAT_A_MAINS_NUES`
- `connaissance_nations` (1) → 2 lignes : Hégémonie + Armée hégémonienne (LdB L.2181-2182)
- `tactique` → `TACTIQUE_OPERATIONS_COMMANDO` (LdB L.2183)
- `langage_signes` → `LANGAGES_SPECIFIQUES_LANGAGE_DES_SIGNES`
- `neo_azuran` → `LANGUE_ETRANGERE_NEO_AZURAN`
- `exon` → `LANGAGES_SPECIFIQUES_EXON`
- `connaissance_milieu_naturel` → `CONNAISSANCE_MILIEU_NATUREL_OCEANS`

**VEILLEUR** — 19 → 24 lignes
- `arts_martiaux` (1) → 2 lignes : `ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES` + `ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES` (LdB L.2250-2251 : virgule = 2 définitifs, pas "au choix")
- `combat_mains_nues` → `COMBAT_A_MAINS_NUES`
- `armes_poing` → `ARMES_DE_POING`
- `fusils_armes_epaule` → `FUSIL_ARMES_DEPAULES`
- `tir_automatique` → `TIR_AUTOMATIQUES`
- `connaissance_nations` (1) → 5 lignes : d'origine, d'accueil, Équinoxe, Veilleurs, Culte du Trident (LdB L.2255-2257)
- `tactique` → `TACTIQUE_OPERATIONS_COMMANDO` (LdB L.2258)
- `neo_azuran` → `LANGUE_ETRANGERE_NEO_AZURAN`
- `premiers_soins` → `PREMIER_SOINS`

**VOLEUR/CRIMINEL** — 21 → 23 lignes
- `combat_mains_nues` → `COMBAT_A_MAINS_NUES`
- `armes_poing` → `ARMES_DE_POING`
- `commerce_trafic` (1) → 2 lignes : `COMMERCE_TRAFIC__DROGUES` + `COMMERCE_TRAFIC__ARMES` (LdB L.2324 : virgule = 2 IDs — migration 37 L.378+398)
- `connaissance_nations` (1) → 2 lignes : Contrebandiers + Crime organisé (LdB L.2325)
- `sciences_connaissances_specialisees` → `SCIENCES_CONNAISANCES_SPECIALISEES_PHARMACOLOGIE` (LdB L.2326 : "Connaissance des poisons")
- `neo_azuran` → `LANGUE_ETRANGERE_NEO_AZURAN`
- `sirs` → `LANGAGES_SPECIFIQUES_SIRS`
- `systemes_securite` → `SYSTEMES_DE_SECURITE`

### IDs vérifiés dans migration 37 — session 132 suite

- `ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES` ✅ (L.128)
- `ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES` ✅ (L.138)
- `COMMERCE_TRAFIC__ARMES` ✅ (L.378)
- `COMMERCE_TRAFIC__DROGUES` ✅ (L.398)
- `SCIENCES_CONNAISANCES_SPECIALISEES_GEOLOGIE` ✅ (L.598)

---

## État Lot 1 — Audit COMPLET [HYPOTHÈSE] — Session 132 (2026-07-03)

> Sources lues mot à mot dans cette session : `REGLE_PROFESSION.md` (L.1-289) + `100_seed_ref_careers.js` (L.1-212).
> IDs ref_skills confirmés depuis la session courante via PIÈGE 4, lot3, lot5, lot6 du présent journal.
> [HYPOTHÈSE] = lu dans le code, non observé en exécution.

---

### Tables non peuplées pour lot 1

Migration 100 n'insère que dans 3 tables sur 8 :
- ❌ `ref_career_point_categories` — vide pour les 5 carrières lot1
- ❌ `ref_career_education` — vide pour les 5 carrières lot1
- ❌ `ref_career_random_benefits` — vide pour les 5 carrières lot1
- ❌ `ref_career_equipment` — vide pour les 5 carrières lot1

---

### A — artisan_artiste

**Titres** : ✅ corrects (4 tranches, valeurs exactes)

**Skills — erreurs [HYPOTHÈSE] :**

| # | Ligne mig | ID actuel | Problème | Correction |
|---|---|---|---|---|
| A1 | L.16 | `COMMERCE_TRAFIC__DENREES_ALIMENTAIRES` | LdB L.77 : "Commerce/Trafic (Artisanat, Œuvres d'art…)" — DENREES_ALIMENTAIRES ne correspond pas. Enfant ARTISANAT absent de ref_skills. | `COMMERCE_TRAFIC` + `conditional:true` (même pattern marchand_itinerant lot3) |
| A2 | L.19 | `SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE` | LdB L.79-81 : "éventuellement Sciences/Connaissances spécialisées (en rapport avec l'artisanat, ex. Botanique, Chimie…)" — HISTOIRE_ARCHEOLOGIE ne correspond pas. Pas de sous-skill fixe. | `SCIENCES_CONNAISANCES_SPECIALISEES` + `conditional:true` (même pattern erudit_archeologue lot2) |
| A3 | — | manquant | LdB L.83 : "Langues : néo-azuran, soléen" — soléen absent | Ajouter `LANGAGES_SPECIFIQUES_SOLEEN` (migration 37 L.1118 ✅) |

---

### B — assassin

**Skills — erreurs [HYPOTHÈSE] :**

| # | Ligne mig | ID actuel | Problème | Correction |
|---|---|---|---|---|
| B1 | L.43 | `ARTS_MARTIAUX` | Parent-only. LdB L.131 : "Arts martiaux (Lutte, Techniques défensives, Techniques offensives)" — 3 sous-compétences nommées | `ARTS_MARTIAUX_LUTTE` + `ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES` + `ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES` (migration 37 ✅) |
| B2 | L.48 | `TIR_PRECISION` | ID incorrect. LdB L.133 : "Tir de précision" | `TIR_DE_PRECISION` (PIÈGE 3 ✅) |
| B3 | L.54 | `SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE` | LdB L.137-138 : "Sciences/Connaissances spécialisées (Connaissance des poisons)" — HISTOIRE_ARCHEOLOGIE ne correspond pas | `SCIENCES_CONNAISANCES_SPECIALISEES_PHARMACOLOGIE` (lot5 : "Connaissance des poisons" = PHARMACOLOGIE ✅) |
| B4 | — | manquant | LdB L.141 : "Langues : néo-azuran, soléen" — soléen absent | Ajouter `LANGAGES_SPECIFIQUES_SOLEEN` |

**Titres — erreurs [HYPOTHÈSE] :**

LdB L.146-151 liste 5 tranches. Migration 100 n'en a que 4.

| LdB | Migration 100 | Erreur |
|---|---|---|
| 1-3 / Tueur à gages / 500 | { 1, 3, 500 } ✅ | — |
| 4-7 / Assassin / 1 000 | { 4, **9**, 1000 } ❌ | max_years 9 au lieu de 7 |
| 8-9 / Assassin / 2 000 | **absent** ❌ | tranche entière manquante |
| 10-12 / Assassin / 4 000 | { 10, 12, 4000 } ✅ | — |
| 13+ / Nettoyeur / 6 000 | { 13, null, 6000 } ✅ | — |

→ Row `{ 4, 9, 1000 }` doit être scindé en `{ 4, 7, 1000 }` + `{ 8, 9, 2000 }`.

---

### C — barman

**Skills — erreurs [HYPOTHÈSE] :**

| # | Ligne mig | ID actuel | Problème | Correction |
|---|---|---|---|---|
| C1 | L.85 | `SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE` | LdB L.192 : "Sciences/Connaissances spécialisées (Administration/Gestion)" — HISTOIRE_ARCHEOLOGIE ne correspond pas | `SCIENCES_CONNAISANCES_SPECIALISEES_ADMINISTRATION_GESTION` (lot3 MARCHAND ✅) |
| C2 | — | manquant | LdB L.195 : "Langues : néo-azuran, soléen" — soléen absent | Ajouter `LANGAGES_SPECIFIQUES_SOLEEN` |
| C3 [HYP] | L.88-89 | `ARMES_DE_POING` cond:false + `FUSIL_ARMES_DEPAULES` cond:true | LdB L.194 : "Armes de poing **ou** Fusils/Armes d'épaule" = choix exclusif. Migration donne ARMES_DE_POING systématique + FUSIL optionnel. | Convention "ou" lot1 non établie — à confirmer. Option : les deux conditional:true. |

**Titres** : ✅ corrects (4 tranches, valeurs exactes).

---

### D — chasseur_primes

**Skills — erreurs [HYPOTHÈSE] :**

| # | Ligne mig | ID actuel | Problème | Correction |
|---|---|---|---|---|
| D1 | L.110 | `ARTS_MARTIAUX` | Parent-only. LdB L.243 : "Arts martiaux (une Compétence **au choix**)" | `ARTS_MARTIAUX_LUTTE` + `conditional:true` (même pattern soldat_milicien lot5) |
| D2 | — | manquant | LdB L.251 : "Pilotage (Navires légers, Scooters sous-marins)" — NAVIRES_LEGERS absent | Ajouter `PILOTAGE__NAVIRES_LEGERS` (lot3 MERCENAIRE + lot4b PILOTE ✅) |
| D3 | — | manquant | LdB L.249 : "Langues : néo-azuran, soléen" — soléen absent | Ajouter `LANGAGES_SPECIFIQUES_SOLEEN` |
| D4 | L.120 | `CONNAISSANCE_DES_NATIONS_ORGANISATIONS` × 1 | LdB L.247 : "(Crime organisé, Contrebandiers, Pirates, Police)" = 4 instances distinctes. Pattern lot3 MARCHAND : virgule = rows séparées. | 4 rows `CONNAISSANCE_DES_NATIONS_ORGANISATIONS` (Crime organisé, Contrebandiers, Pirates, Police) |

**Titres — erreurs [HYPOTHÈSE] :**

LdB L.255-261 liste 6 tranches. Migration 100 n'en a que 4.

| LdB | Migration 100 | Erreur |
|---|---|---|
| 1-6 / Apprenti / 500 | { 1, 6, 500 } ✅ | — |
| 7-8 / Chasseur / 1 000 | { 7, **10**, **2000** } ❌ | max_years et salary erronés |
| 9-10 / Chasseur / 2 000 | **absent** ❌ | tranche manquante |
| 11-14 / Chasseur / 6 000 | { 11, **18**, 6000 } ❌ | max_years erroné |
| 15-18 / Chasseur / 8 000 | **absent** ❌ | tranche entière manquante |
| 19+ / Chasseur / 12 000 | { 19, null, 12000 } ✅ | — |

→ Row `{ 7, 10, 2000 }` → `{ 7, 8, 1000 }` + `{ 9, 10, 2000 }`.
→ Row `{ 11, 18, 6000 }` → `{ 11, 14, 6000 }` + `{ 15, 18, 8000 }`.

---

### E — contrebandier

**Skills — erreurs [HYPOTHÈSE] :**

| # | Ligne mig | ID actuel | Problème | Correction |
|---|---|---|---|---|
| E1 | L.162 | `PILOTAGE__SCOOTERS_SOUS_MARINS` seul | LdB L.307 : "Pilotage (Navires légers, Scooters sous-marins)" — NAVIRES_LEGERS absent | Ajouter `PILOTAGE__NAVIRES_LEGERS` |
| E2 | — | manquant | LdB L.306 : "Langues : langue de la communauté d'accueil, néo-azuran, soléen" — soléen absent | Ajouter `LANGAGES_SPECIFIQUES_SOLEEN`. "Langue communauté d'accueil" = non-seedable (LANGUE_ETRANGERE parent-only, découverte lot4b) → omettre + commentaire |
| E3 | L.158 | `COMMERCE_TRAFIC__ARMES` cond:false | LdB L.302-304 : "Commerce/Trafic (**au choix**, en général des marchandises illégales…)" — "au choix" non respecté | `COMMERCE_TRAFIC` + `conditional:true` (cohérent avec marchand_itinerant lot3). ARMES reste valide mais doit être conditionnel |
| E4 | L.157 | `CONNAISSANCE_DES_NATIONS_ORGANISATIONS` × 1 | LdB L.302 : "(Contrebandiers, Crime organisé, Pirates)" = 3 instances. Pattern lot3 : virgule = rows séparées. | 3 rows `CONNAISSANCE_DES_NATIONS_ORGANISATIONS` (Contrebandiers, Crime organisé, Pirates) |

**Titres** : ✅ corrects (2 tranches, formules exactes).

---

### Récapitulatif — corrections à appliquer lot1

| Carrière | Type | Priorité |
|---|---|---|
| artisan | A1 : COMMERCE_TRAFIC__DENREES_ALIMENTAIRES → COMMERCE_TRAFIC + cond:true | 🔴 bloquant |
| artisan | A2 : SCIENCES…HISTOIRE_ARCHEOLOGIE → SCIENCES + cond:true | 🔴 bloquant |
| artisan | A3 : manque LANGAGES_SPECIFIQUES_SOLEEN | 🟡 données |
| assassin | B1 : ARTS_MARTIAUX → 3 sous-compétences | 🔴 bloquant |
| assassin | B2 : TIR_PRECISION → TIR_DE_PRECISION | 🔴 bloquant |
| assassin | B3 : SCIENCES…HISTOIRE_ARCHEOLOGIE → PHARMACOLOGIE | 🔴 bloquant |
| assassin | B4 : manque LANGAGES_SPECIFIQUES_SOLEEN | 🟡 données |
| assassin | B5 : titres 4-9/1000 → 4-7/1000 + 8-9/2000 | 🟡 données |
| barman | C1 : SCIENCES…HISTOIRE_ARCHEOLOGIE → ADMINISTRATION_GESTION | 🔴 bloquant |
| barman | C2 : manque LANGAGES_SPECIFIQUES_SOLEEN | 🟡 données |
| barman | C3 : convention "ou" pour armes (à décider) | ⬜ à décider |
| chasseur_primes | D1 : ARTS_MARTIAUX → ARTS_MARTIAUX_LUTTE + cond:true | 🔴 bloquant |
| chasseur_primes | D2 : manque PILOTAGE__NAVIRES_LEGERS | 🔴 bloquant |
| chasseur_primes | D3 : manque LANGAGES_SPECIFIQUES_SOLEEN | 🟡 données |
| chasseur_primes | D4 : CONNAISSANCE × 1 → × 4 | 🟡 données |
| chasseur_primes | D5 : titres 4 tranches → 6 tranches | 🟡 données |
| contrebandier | E1 : manque PILOTAGE__NAVIRES_LEGERS | 🔴 bloquant |
| contrebandier | E2 : manque LANGAGES_SPECIFIQUES_SOLEEN | 🟡 données |
| contrebandier | E3 : COMMERCE_TRAFIC__ARMES → COMMERCE_TRAFIC + cond:true | 🟡 données |
| contrebandier | E4 : CONNAISSANCE × 1 → × 3 | 🟡 données |

**🔴 Bloquant** = skill_id inexistant ou incorrect dans ref_skills → wizard step 4 cassé silencieusement.
**🟡 Données** = skill absent ou titre erroné → données incomplètes mais pas crash.
**⬜ À décider** = choix de conception (convention "ou").

**Fix :** corriger `100_seed_ref_careers.js` dans cette session, puis rollback/re-run migration 100 (ou migration 103c de patch).
Illustration `illustration` : non peuplée dans migration 100. À ajouter lors du fix lot1.

---

## Illustrations — Mapping MinIO

> Colonne `illustration` dans `ref_careers` (migration 93 L.10 — `table.text('illustration')`). ✅ Déjà dans le schéma.
> Bucket : `enclume-assets` | Dossier : `assets/`
> Format chemin : `assets/s4_xxx.webp` (chemin relatif dans le bucket)
> Migration 100 ne peuple pas `illustration` pour lot1 — à corriger lors de l'audit lot1.

| code | fichier | notes |
|---|---|---|
| **LOT 1** | | |
| `artisan_artiste` | `assets/s4_artisan.webp` | |
| `assassin` | `assets/s4_assassin.webp` | |
| `barman` | `assets/s4_barman.webp` | |
| `chasseur_primes` | `assets/s4_chasseurprime.webp` | |
| `contrebandier` | `assets/s4_contrebandier.webp` | |
| **LOT 2** | | |
| `cultivateur_eleveur` | `assets/s4_eleveur.webp` | |
| `diplomate` | `assets/s4_diplomate.webp` | |
| `erudit_archeologue` | `assets/s4_archeologue.webp` | |
| `espion` | `assets/s4_espion.webp` | |
| `hybride_trident` | `assets/s4_hybride.webp` | |
| **LOT 3** | | |
| `marchand` | `assets/s4_marchand.webp` | |
| `marchand_itinerant` | `assets/s4_marchanditinerant.webp` | |
| `medecin_chirurgien` | `assets/s4_medecin.webp` | |
| `mercenaire` | `assets/s4_mercenaire.webp` | |
| `mineur` | `assets/s4_mineur.webp` | |
| **LOT 4a** | | |
| `officier_naval_civil` | `assets/s4_officier_naval_civil.webp` | |
| `officier_naval_militaire` | `assets/s4_officier_naval_militaire.webp` | |
| `officier_militaire_souterrain` | `assets/s4_officier_militaire_souterrain.webp` | |
| `officier_militaire_surface` | `assets/s4_officier_militaire_surface.webp` | |
| `ouvrier_docker` | `assets/s4_docker.webp` | |
| **LOT 4b** | | |
| `pilote_chasse_atmospherique` | `assets/s4_pilote_atmospherique.webp` | |
| `pilote_chasse_sous_marin` | `assets/s4_pilote_chasse_sous_marin.webp` | |
| `pirate` | `assets/s4_pirate.webp` | |
| **LOT 5** | | |
| `policier_enqueteur` | `assets/s4_enqueteur.webp` | |
| `pretre_trident` | `assets/s4_pretretrident.webp` | |
| `prostitue` | `assets/s4_prostitue.webp` | |
| `scientifique_ingenieur` | `assets/s4_scientifique.webp` | |
| `soldat_milicien` | `assets/s4_soldat.webp` | |
| **LOT 6** | | |
| `soldat_elite_commando_marin` | `assets/s4_soldat_elite_commando_marin.webp` | |
| `soldat_elite_commando_souterrain` | `assets/s4_soldat_elite_commando_souterrain.webp` | |
| `soldat_elite_commando_surface` | `assets/s4_soldat_elite_commando_surface.webp` | |
| `soldat_elite_forces_speciales` | `assets/s4_soldat_elite_forces_speciales.webp` | |
| `sous_marinier` | `assets/s4_sousmarinier.webp` | |
| `technicien_mecanicien` | `assets/s4_technicien.webp` | |
| `techno_hybride` | `assets/s4_technohybride.webp` | |
| `veilleur` | `assets/s4_veilleur.webp` | |
| `voleur_criminel` | `assets/s4_voleur.webp` | |

**Résumé :** 37 images / 37 carrières — toutes uniques — couverture complète 37/37.

---

## ARCHIVE — NE PAS LIRE

> Données de travail de session 131 — superseded par le mapping final ci-dessus.
> Conservées pour traçabilité uniquement.

### [ARCHIVE] Ordre de travail initial Session 131

1. WIZ-1 ✅ — filtrer personnages incomplets dans la liste Dashboard
2. Test COUCHE 5 — flux complet wizard
3. Audit skill_ids lots 2-6 vs ref_skills
4. Migration 103b — skills manquants
5. Migration 104 — seed lots 2-6

### [ARCHIVE] Catégorie 1 — UPPERCASE direct (≈ 48 IDs corrects, session 131)

IDs dont la conversion est triviale (lowercase→UPPERCASE) — tous confirmés dans migration 37 :
`ENDURANCE`, `MANOEUVRES_SOUS_MARINES`, `ATHLETISME`, `ESCALADE`, `RESPIRATION_FOE`,
`ARMES_LOURDES_CONTACT`, `COMBAT_ARME`, `ARMES_SOUS_MARINES`, `TELEPILOTAGE`, `ORIENTATION`,
`AQUACULTURE_ELEVAGE`, `DRESSAGE`, `INFORMATIQUE`, `ANALYSE_EMPATHIQUE`, `BUREAUCRATIE`,
`SURVIE`, `OBSERVATION`, `ELOQUENCE_PERSUASION`, `ENSEIGNEMENT`, `ENTREGENT_SEDUCTION`,
`EDUCATION_CULTURE_GENERALE`, `ESPIONNAGE_SURVEILLANCE`, `BOUCLIER_MENTAL`, `CARTOGRAPHIE`,
`CRYPTOGRAPHIE`, `NAVIGATION`, `MEDITATION`, `CAMOUFLAGE_DISSIMULATION`, `DEGUISEMENT_IMITATION`,
`EVASION`, `FURTIVITE_DEPLACEMENT_SILENCIEUX`, `DISCRETION_FILATURE`, `PICKPOCKET`, `HYBRIDE`,
`FALSIFICATION`, `PIRATAGE_INFORMATIQUE`, `MECANIQUE`, `CHIRURGIE`, `EXPLOSIFS`, `PIEGES`,
`COMMANDEMENT`, `INTIMIDATION`, `JEU`, `STRATEGIE`, `CONNAISSANCE_MILIEUX_SOCIAUX`,
`CHASSE_PISTAGE`, `ELECTRONIQUE`, `CONTROLE_CORPOREL`

### [ARCHIVE] Anciennes tables Cat 4a-4d (avant lecture LdB — versions préliminaires)

Ces tables utilisaient une "Justification" par déduction sans LdB. Supersedées par les mappings finaux.

### [ARCHIVE] Anciennes décisions [DÉCISION REQUISE] (Cat 4e-4i)

4e ARTS_MARTIAUX — résolu : voir mapping final par carrière.
4f COMMERCE_TRAFIC — résolu.
4g GENIE_TECHNIQUE — résolu partiellement (technicien_mecanicien = vérifier lot6).
4h EXPRESSION_ARTISTIQUE — résolu.
4i SCIENCES — résolu : IDs leaf par carrière depuis LdB.

### [ARCHIVE] Catégorie 5 ancienne version (avant migration 103b)

`armes_satellites` était marqué ❌ ABSENT. Résolu : migration 103b ✅ appliquée.
