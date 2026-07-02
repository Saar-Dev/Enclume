# Journal COUCHE 4 — Wizard création personnage
> Créé : 2026-07-02 — Session 131
> Règle absolue : tout ce qui figure ici a été vérifié dans le code source dans la session indiquée.
> [HYPOTHÈSE] = lu dans le code mais non observé en exécution. [VÉRIFIÉ] = instrumenté + observé.

---

## MISSION SUIVANTE — Migration 104

**Objectif :** Écrire `server/src/db/migrations/104_seed_ref_careers_remaining.js` — 32 carrières lots 2-6.

**Fichiers obligatoires à lire avant de coder (jamais de mémoire) :**
1. `server/src/db/migrations/100_seed_ref_careers.js` — pattern exact du seed (structure up/down, onConflict, order d'insertion)
2. `docs/Character/Creation/migrations/93_seed_ref_careers_lot2.cjs` à `lot6.cjs` — contenu exact par carrière
3. `server/src/db/migrations/37_char_seed_skills.js` — **vérifier les IDs exacts PILOTAGE/MANOEUVRE_DARMURE** (double ou simple underscore — voir POINT CRITIQUE ci-dessous)

**Point critique à lever AVANT d'écrire quoi que ce soit :**
> Dans migration 37, PILOTAGE et MANOEUVRE_DARMURE utilisent-ils `PILOTAGE__NAVIRES_LEGERS` (double underscore) ou `PILOTAGE_NAVIRES_LEGERS` (simple) ?
> MECANIQUE utilise le simple underscore (`MECANIQUE_EXO_ARMURES`). Vérifier si PILOTAGE/MANOEUVRE suivent le même pattern ou non.
> Ne pas écrire migration 104 avant cette vérification — les IDs seront silencieusement faux sinon (pas de FK).

**3 questions ouvertes à résoudre depuis les fichiers lot :**
1. `pirate` → PILOTAGE : LdB ne liste pas explicitement — vérifier lot4b
2. `hybride_trident` → CONNAISSANCE_MILIEU_NATUREL : non listé dans LdB — vérifier lot2
3. `pilote_chasse_sous_marin` → CONNAISSANCE_MILIEU_NATUREL : non listé dans LdB — vérifier lot4b

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

> ⚠️ PILOTAGE, MANOEUVRE_DARMURE, COMMERCE_TRAFIC = double underscore. Les autres = simple.
> **À VÉRIFIER dans migration 37 avant d'écrire migration 104.**

### PIÈGE 3 — Renommages requis (13 IDs)

| ID lot source | ID correct ref_skills |
|---|---|
| `acrobatie_equilibre` | `ACCROBATIE_EQUILIBRE` (typo DB : double C) |
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
Cible : `export const up/down` avec `onConflict().ignore()`.
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
| medecin_chirurgien (lot3) | MEDECINE + BIOLOGIE_PHYSIOLOGIE + PSYCHOLOGIE |
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
| pirate (lot4b) | **[VÉRIFIER lot4b]** |
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

### CONNAISSANCE_MILIEU_NATUREL

IDs DB : `CONNAISSANCE_MILIEU_NATUREL_OCEANS`, `_SOUTERRAINS`, `_SURFACE`

| Carrière | ID |
|---|---|
| cultivateur_eleveur (lot2) | CONNAISSANCE_MILIEU_NATUREL_OCEANS |
| hybride_trident (lot2) | **[VÉRIFIER lot2]** |
| mineur (lot3) | OCEANS + SOUTERRAINS |
| officier_naval_civil (lot4a) | OCEANS |
| officier_naval_militaire (lot4a) | OCEANS |
| officier_militaire_souterrain (lot4a) | OCEANS + SOUTERRAINS |
| officier_militaire_surface (lot4a) | OCEANS + SURFACE |
| pilote_chasse_atmospherique (lot4b) | SURFACE |
| pilote_chasse_sous_marin (lot4b) | **[VÉRIFIER lot4b]** |
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
| marchand (lot3) | DENREES_ALIMENTAIRES + MATIERES_PREMIERES |
| marchand_itinerant (lot3) | MATIERES_PREMIERES |
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
