# AUDIT REF_SKILLS vs REGLECOMPETENCE.md
> Session 132 — 2026-07-03 — TEMPORAIRE (périssable)

## Méthode
- Source vérité : REGLECOMPETENCE.md (lu en session)
- Source DB : migration 37_char_seed_skills.js (lu par chunks)
- Bugs notés : manquant | attributs | marker | family | parent | label

## Légende
- ❌ MANQUANT — dans LdB, absent de ref_skills
- ⚠️ ATTRIBUT — attr_1/attr_2 incorrect vs LdB
- ⚠️ MARKER — marqueur (X/-3/•) incorrect vs LdB
- ⚠️ FAMILY — famille incorrecte
- ⚠️ PARENT — parent incorrect ou manquant
- ⚠️ LABEL — label incorrect (encodage, typo)
- ℹ️ EXTRA — dans ref_skills mais absent du LdB (à vérifier intention)

## LdB — Référentiel complet (extrait REGLECOMPETENCE.md)

### Aptitudes physiques
- ACROBATIE_EQUILIBRE : COO/COO, marker=S (limitative), pas de malus
- ATHLETISME : FOR/COO, marker=rien
- ENDURANCE : CON/VOL, marker=S (limitative)
- ESCALADE : FOR/COO, marker=rien
- MANOEUVRES_0G : COO/ADA, marker=S (limitative)
- MANOEUVRES_SOUS_MARINES : FOR/COO, marker=S (limitative)
- RESPIRATION_FOE : CON/VOL, marker=R (réservée, -3 départ)

### Combat contact
- ARMES_LOURDES_CONTACT : FOR/FOR
- ARMES_SPECIALES_CONTACT : variable [...] réservée possible
- ARTS_MARTIAUX parent (COO/ADA) — enfants :
  - __LUTTE : COO/ADA, marker=X (-3)
  - __TECHNIQUES_DEFENSIVES : COO/ADA, marker=X (-3)
  - __TECHNIQUES_OFFENSIVES : COO/ADA, marker=X (-3)
- COMBAT_ARME : FOR/COO
- COMBAT_A_MAINS_NUES : FOR/COO

### Combat tir
- ARMES_DE_JET : COO/PER, marker=X (-3)
- ARMES_LOURDES_TIR : COO/PER, marker=X (-3)
- ARMES_DE_POING : COO/PER
- ARMES_SOUS_MARINES : COO/PER
- ARMES_SPECIALES_TIR : variable [...]
- ARMES_DE_TRAIT : COO/PER, marker=X (-3)
- FUSIL_ARMES_DEPAULE : COO/PER [Fusils/Armes d'épaule]
- TIR_AUTOMATIQUE : FOR/PER, marker=S (limitative)
- TIR_PRECISION : PER/VOL, marker=S+X (-3, limitative)

### Communication / Relations sociales
- ANALYSE_EMPATHIQUE : INT/PER, marker=X (-3)
- COMMANDEMENT : VOL/PRE
- ELOQUENCE_PERSUASION : INT/PRE (†)
- ENTREGENT_SEDUCTION : PRE/PRE
- EXPRESSION_ARTISTIQUE parent — enfants :
  - __CHANT : INT/PRE, marker=X (-3)
  - __COMEDIE_CONTE : ADA/PRE, marker=X (-3)
  - __DANSE : COO/PRE, marker=X (-3)
  - __INSTRUMENT_MUSIQUE : COO/PER, marker=R (réservée X)
- INTIMIDATION : VOL/PRE

### Connaissances
- BUREAUCRATIE : INT/INT (†, prereq Éducation 5)
- CARTOGRAPHIE : INT/INT (†, X)
- COMMERCE_TRAFIC parent (INT/PRE, †) — enfants listés LdB :
  - __ARMES : marker=X
  - __DENREES_ALIMENTAIRES : marker=-3
  - __DROGUES : marker=X
  - __INFORMATIONS : marker=-3
  - __MATERIEL_MEDICAL : marker=-3
  - __MATIERES_PREMIERES : marker=-3
  - __VEHICULES : marker=-3
  - [+ ARTISANAT, OEUVRES_DART absents du LdB mais référencés carrières — à vérifier]
- CONNAISSANCE_NATIONS_ORGANISATIONS : INT/INT (•, PN) — enfants = nations
- CRYPTOGRAPHIE : INT/INT (†, X)
- EDUCATION_CULTURE_GENERALE : INT/INT (-3)
- JEU : INT/VOL
- NAVIGATION : INT/INT (†, X)
- RECHERCHE_INFORMATIONS : INT/INT (†, -3)
- SCIENCES_CONNAISANCES_SPECIALISEES parent — enfants (tous X) :
  - _ADMINISTRATION_GESTION
  - _ARMES_SYSTEMES_ARMEMENT
  - _ASTROPHYSIQUE_ASTRONOMIE
  - _BIOLOGIE_PHYSIOLOGIE
  - _BOTANIQUE
  - _CRIMINALISTIQUE
  - _DROIT_LEGISLATIONS
  - _FINANCES
  - _ECONOMIE
  - _GEOLOGIE
  - _GEOGRAPHIE
  - _HISTOIRE_ARCHEOLOGIE
  - _MEDECINE
  - _PHARMACOLOGIE
  - _PHYSIQUE_CHIMIE
  - _PSYCHOLOGIE
  - _SCIENCES_POLITIQUES
  - _SOCIOLOGIE
  - _ZOOLOGIE
- STRATEGIE : INT/INT (†, -3)
- TACTIQUE parent (INT/ADA) — enfants :
  - __COMBAT_NAVAL : -3
  - __COMBAT_SOUTERRAIN : rien
  - __COMBAT_TERRESTRE : rien
  - __OPERATIONS_COMMANDO : rien

### Furtivité / Subterfuge
- CAMOUFLAGE_DISSIMULATION : PER/ADA (-3)
- DEGUISEMENT_IMITATION : ADA/PRE (-3)
- DISCRETION_FILATURE : PER/ADA
- EVASION : COO/VOL (X)
- FURTIVITE_DEPLACEMENT_SILENCIEUX : PER/ADA (•)
- PICKPOCKET : COO/ADA (-3)

### Langues / Langages
Langues étrangères (INT/INT, PN, X chacune) :
  AMENEEN, AZRAN, GASHKLAR, ISITAC, LESARACH, LEXZION,
  NEO_AZURAN, NEZRAIS, OCEANE, OLAKAR, OLOSAK, OSSYRIEN,
  RENAREAN, TERNASET, TRASHAN
Langues anciennes (INT/INT, X) :
  ARKONIEN, AZURAN, AZUREEN, GATEEN
Langages spécifiques (INT/INT, PN) :
  ABSOLAN (X), ENEFID (X), EXON (X), FOREUR (X), INESIS (X),
  ITHRAXIEN (X), KLAN (X), LANGAGE_DES_SIGNES (pas X noté),
  LEVEAN (X), METALAN (X), NEOLAN (X), SIRS (pas X noté), SOLEEN (X)

### Pilotage
- MANOEUVRE_DARMURE parent (COO/ADA, •) — enfants :
  - __ARMURES_ATMOSPHERIQUES : X
  - __ARMURES_EXTERNES : rien
  - __ARMURES_SOUS_MARINES : rien
  - __ARMURES_SPATIALES : -3
- PILOTAGE parent — enfants :
  - __CHASSEURS_SOUS_MARINS : INT/ADA, X (†)
  - __CHASSEURS_ATMOSPHERIQUES : INT/ADA, X (†)
  - __NAVIRES_LEGERS : INT/INT, X (†)
  - __NAVIRES_LOURDS : INT/INT, X (†)
  - __ENGINS_SPATIAUX : INT/INT, X (†)
  - __VEHICULES_SOUTERRAINS : INT/ADA, X
  - __VEHICULES_DE_SOL : PER/ADA
  - __SCOOTERS_SOUS_MARINS : PER/ADA
- TELEPILOTAGE : INT/ADA (-3)

### Survie / Extérieur
- CHASSE_PISTAGE : PER/ADA (X)
- CONNAISSANCE_MILIEU_NATUREL parent (INT/ADA, •) — enfants :
  - __OCEANS : -3
  - __SOUTERRAINS : -3
  - __SURFACE : X
- OBSERVATION : PER/VOL
- ORIENTATION : PER/ADA
- SURVIE : ADA/VOL (X)

### Techniques
- ANALYSE_SONSCANS : INT/ADA (X)
- ARMES_EMBARQUES_ARTILLERIE : INT/INT (X)
- ARMURERIE : INT/INT (X)
- AQUACULTURE_ELEVAGE : INT/INT (X)
- ART_ARTISANAT parent (INT/PER, X) — enfants = catégories libres
- CHIRURGIE : INT/INT (†, X)
- DRESSAGE : VOL/PRE (-3)
- ELECTRONIQUE : INT/INT (†, X)
- ESPIONNAGE_SURVEILLANCE : INT/INT (X)
- EXPLOSIFS : INT/VOL (X)
- FALSIFICATION : INT/PER (†, X)
- GENIE_TECHNIQUE parent (INT/INT, †, X) — enfants :
  - __ARCHITECTURE_GENIE_CIVIL
  - __ARCHITECTURE_NAVALE
  - __BIONIQUE_CYBERTECHNOLOGIE
  - __BIOTECHNOLOGIE_GENIE_GENETIQUE
  - __ELECTRONIQUE_INFORMATIQUE
  - __LOGICIELS
  - __NANOTECHNOLOGIE
  - __ROBOTIQUE
  - __TELECOMMUNICATIONS
- INFORMATIQUE : INT/INT (†, -3)
- MECANIQUE parent (INT/INT) — enfants :
  - __EXOARMURES
  - __NAVIRES_CHASSEURS_SOUS_MARINS
  - __CHASSEURS_ATMOSPHERIQUES
  - __VEHICULES_SOUTERRAINS
  - __VEHICULES_DE_SOL
  - __GENERATEURS_SYSTEME_DE_SURVIE
- PIEGES : INT/PER (-3)
- PIRATAGE_INFORMATIQUE : (†, X)
- PREMIERS_SOINS : INT/ADA (-3)
- SYSTEMES_DE_SECURITE : INT/INT (X)

### Compétences spéciales
- ABSENCE : ADA/VOL (X)
- BOUCLIER_MENTAL : VOL/VOL (X)
- CONTROLE_CORPOREL : CON/VOL (X)
- CONTROLE_DES_MUTATIONS : X — enfants = une par mutation
- HYBRIDE : CON/COO
- HYPNOSE : VOL/PRE (X)
- MAITRISE_ECHO_POLARIS : INT/VOL (X)
- MAITRISE_FORCE_POLARIS : VOL/VOL (X)
- MEDITATION : VOL/VOL (X)
- POUVOIRS_POLARIS : INT/VOL (X)

---

## RÉSULTATS AUDIT — par chunk

### Chunk 1 (lignes 1-150 migration 37)
Migration déclarée : 231 compétences.

| ID | Trouvé | Bug |
|---|---|---|
| ATHLETISME | FOR/COO, null | ✅ LdB FOR/COO |
| ENDURANCE | FOR/COO, null | ⚠️ ATTRIBUT — LdB dit CON/VOL |
| ESCALADE | FOR/COO, null | ✅ LdB FOR/COO |
| MANOEUVRES_0G | COO/ADA, null | ✅ LdB COO/ADA |
| MANOEUVRES_SOUS_MARINES | FOR/COO, null | ✅ LdB FOR/COO |
| RESPIRATION_FOE | CON/VOL, (-3) | ✅ LdB CON/VOL, -3 |
| ARMES_LOURDES_CONTACT | FOR/null, null | ⚠️ ATTRIBUT — LdB dit FOR/FOR, attr_2 manquant |
| ARMES_SPECIALES_CONTACT_FORCE_COORDINATION | FOR/COO, S | ✅ (enfant spécialisation) |
| ARMES_SPECIALES_CONTACT_COORDINATION_COORDINATION | COO/null, S | ℹ️ attr_2 null — LdB dit COO/COO possible |
| ARTS_MARTIAUX_LUTTE | COO/ADA, S | ⚠️ MARKER — LdB dit (-3), DB dit S (perd le malus) |
| ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES | COO/ADA, S | ⚠️ MARKER — LdB dit (-3), DB dit S |
| ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES | COO/ADA, S | ⚠️ MARKER — LdB dit (-3), DB dit S |
| COMBAT_ARME | ? (coupé) | à confirmer chunk 2 |

**Non vus (Aptitudes physiques) :** ACROBATIE_EQUILIBRE — à chercher chunk suivant.
**Parents virtuels confirmés (pas de row propre) :** ARTS_MARTIAUX, ARMES_SPECIALES_CONTACT

**Bug critique noté :**
- B1 : ENDURANCE attr CON/VOL → FOR/COO en base
- B2 : ARMES_LOURDES_CONTACT attr_2 null → devrait être FOR

### Chunk 2 (lignes 149-299 migration 37)

| ID | Trouvé | Bug |
|---|---|---|
| COMBAT_ARME | FOR/COO, null | ✅ |
| COMBAT_A_MAINS_NUES | FOR/COO, null | ✅ |
| ARMES_DE_JET | COO/PER, (-3) | ✅ |
| ARMES_LOURDES | COO/PER, (-3) | ⚠️ ID — LdB "Armes lourdes (tir)" → devrait être ARMES_LOURDES_TIR (contact = ARMES_LOURDES_CONTACT, tir = ARMES_LOURDES — asymétrie) |
| ARMES_DE_POING | COO/PER, null | ✅ |
| ARMES_SOUS_MARINES | COO/PER, null | ✅ |
| ARMES_SPECIALES_DISTANCE_* | FOR/COO et COO/PER, S | ✅ (enfants spécialisation) |
| ARMES_DE_TRAIT | COO/PER, (-3) | ✅ |
| FUSIL_ARMES_DEPAULES | COO/PER, null | ⚠️ LABEL — DB "Fusil/Armes d'épaules" vs LdB "Fusils/Armes d'épaule" (Fusil→Fusils, épaules→épaule) |
| TIR_AUTOMATIQUES | FOR/PER, null | ⚠️ ID+LABEL — DB "TIR_AUTOMATIQUES" / "Tir automatiques" (pluriel) vs LdB "Tir automatique" singulier + marker null mais LdB montre compétence standard → OK |
| TIR_DE_PRECISION | PER/VOL, (-3) | ✅ |
| ANALYSE_EMPATHIQUE | INT/PRE, (-3) | ⚠️ ATTRIBUT — LdB dit INT/PER (Perception), DB dit INT/PRE (Présence) |
| COMMANDEMENT | VOL/PRE, null | ✅ |
| ELOQUENCE_PERSUASION | INT/PRE, null | ✅ |

**ACROBATIE_EQUILIBRE** : toujours pas vu — absent des aptitudes physiques en début de liste ?

### Chunk 3 (lignes 298-447)

| ID | Trouvé | Bug |
|---|---|---|
| ENTREGENT_SEDUCTION | PRE/null, null | ⚠️ ATTRIBUT — LdB dit PRE/PRE, attr_2 manquant |
| EXPRESSION_ARTISTIQUE_CHANT | INT/PRE, S | ⚠️ MARKER systémique — LdB dit (-3), S écrase le malus |
| EXPRESSION_ARTISTIQUE_COMEDIE_CONTE | ADA/PRE, S | ⚠️ MARKER systémique — LdB dit (-3) |
| EXPRESSION_ARTISTIQUE_DANSE | COO/PRE, S | ⚠️ MARKER systémique — LdB dit (-3) |
| EXPRESSION_ARTISTIQUE_INSTRUMENT_DE_MUSIQUE | COO/PER, S | ⚠️ MARKER — LdB dit (X) réservée, DB dit S |
| INTIMIDATION | VOL/PRE, null | ✅ (description tronquée mais non bloquant) |
| BUREAUCRATIE | INT/null, null | ⚠️ ATTRIBUT — LdB dit INT/INT, attr_2 manquant |
| CARTOGRAPHIE | INT/null, null | ⚠️ ATTRIBUT + MARKER — LdB INT/INT, attr_2 manquant + LdB (X) réservée, marker null |
| COMMERCE_TRAFIC__ARMES | INT/PRE, S | ⚠️ MARKER systémique — LdB dit (X), DB dit S |
| COMMERCE_TRAFIC__DENREES_ALIMENTAIRES | INT/PRE, S | ⚠️ MARKER systémique — LdB dit (-3) |
| COMMERCE_TRAFIC__DROGUES | INT/PRE, S | ⚠️ MARKER systémique — LdB dit (X) |
| COMMERCE_TRAFIC__INFORMATIONS | INT/PRE, S | ⚠️ MARKER systémique — LdB dit (-3) |
| COMMERCE_TRAFIC__MATERIEL_MEDICAL | INT/PRE, S | ⚠️ MARKER systémique — LdB dit (-3) |
| COMMERCE_TRAFIC__MATIERES_PREMIERES | INT/PRE, S | ⚠️ MARKER systémique — LdB dit (-3) |
| COMMERCE_TRAFIC__VEHICULES | INT/PRE, S | ⚠️ MARKER systémique — LdB dit (-3) |

**Note architecture :** Le marker "S" (Spécialisation) est utilisé pour TOUS les enfants de groupe, écrasant systématiquement le marqueur de difficulté individuel du LdB (-3 ou X). Ceci est une limitation de modèle (champ marker = 1 valeur). Impact : perte de l'info réservée vs difficile pour les spécialisations.

**Bugs cumulés :**
- B1 : ENDURANCE : attr CON/VOL → FOR/COO en base
- B2 : ARMES_LOURDES_CONTACT : attr_2 null → FOR
- B3 : ARMES_LOURDES : ID asymétrique (tir sans suffixe _TIR)
- B4 : TIR_AUTOMATIQUES : ID/label au pluriel → TIR_AUTOMATIQUE
- B5 : ANALYSE_EMPATHIQUE : attr_2 PRE → PER
- B6 : FUSIL_ARMES_DEPAULES : label "Fusil/Armes d'épaules" → "Fusils/Armes d'épaule"
- B7 : ENTREGENT_SEDUCTION : attr_2 null → PRE
- B8 : EXPRESSION_ARTISTIQUE_INSTRUMENT_DE_MUSIQUE : marker S → (X)
- B9 : BUREAUCRATIE : attr_2 null → INT
- B10 : CARTOGRAPHIE : attr_2 null → INT, marker null → (X)
- B11 [SYSTÉMIQUE] : enfants de groupe (COMMERCE_TRAFIC, EXPRESSION_ARTISTIQUE, ARTS_MARTIAUX…) → marker "S" écrase les marqueurs LdB individuels

### Chunk 4 (lignes 447-596)

| ID | Trouvé | Bug |
|---|---|---|
| EDUCATION_CULTURE_GENERALE | INT/null, (-3) | ⚠️ ATTRIBUT — LdB INT/INT, attr_2 manquant |
| JEU | INT/VOL, null | ✅ |
| CONNAISSANCE_DES_NATIONS_ORGANISATIONS | INT/null, PN | ⚠️ ATTRIBUT — LdB INT/INT, attr_2 manquant (marker PN ✅) |
| CRYPTOGRAPHIE | INT/null, (X) | ⚠️ ATTRIBUT — LdB INT/INT, attr_2 manquant (marker X ✅) |
| NAVIGATION | INT/null, (X) | ⚠️ ATTRIBUT — LdB INT/INT, attr_2 manquant |
| RECHERCHE_DINFORMATIONS | INT/null, (-3) | ⚠️ ATTRIBUT — LdB INT/INT, attr_2 manquant; ID contraction "D'" notable mais cohérent |
| SCIENCES_* enfants (x7 vus) | INT/null, S | ⚠️ ATTRIBUT+MARKER systémique — LdB INT/INT (x tous) + LdB (X) réservée (x tous) |

**Pattern systémique B17 : attr_2=null pour toutes les compétences INT/INT**
Migration 37 utilise attr_2=null comme raccourci pour "même attribut que attr_1". Mais les LdB montrent INT/INT explicitement (deux fois l'attribut). Impact sur affichage et calcul de base selon l'implémentation frontend.

**Bugs cumulés :**
- B1 : ENDURANCE : attr CON/VOL → FOR/COO en base
- B2 : ARMES_LOURDES_CONTACT : attr_2 null → FOR
- B3 : ARMES_LOURDES : ID asymétrique (tir sans suffixe _TIR)
- B4 : TIR_AUTOMATIQUES : ID/label au pluriel → TIR_AUTOMATIQUE
- B5 : ANALYSE_EMPATHIQUE : attr_2 PRE → PER
- B6 : FUSIL_ARMES_DEPAULES : label "Fusil/Armes d'épaules" → "Fusils/Armes d'épaule"
- B7 : ENTREGENT_SEDUCTION : attr_2 null → PRE
- B8 : EXPRESSION_ARTISTIQUE_INSTRUMENT_DE_MUSIQUE : marker S → (X)
- B9 : BUREAUCRATIE : attr_2 null → INT
- B10 : CARTOGRAPHIE : attr_2 null → INT, marker null → (X)
- B11 [SYSTÉMIQUE] : enfants de groupe → marker "S" écrase marqueurs LdB individuels (-3 ou X)
- B12 : EDUCATION_CULTURE_GENERALE : attr_2 null → INT
- B13 : CONNAISSANCE_DES_NATIONS_ORGANISATIONS : attr_2 null → INT
- B14 : CRYPTOGRAPHIE : attr_2 null → INT
- B15 : NAVIGATION : attr_2 null → INT
- B16 : RECHERCHE_DINFORMATIONS : attr_2 null → INT
- B17 [SYSTÉMIQUE] : SCIENCES_* enfants : attr_2 null → INT + marker S → (X)

### Chunk 5 (lignes 596-745)
| ID | Trouvé | Bug |
|---|---|---|
| SCIENCES_* enfants (×12 restants) | INT/null, S | ⚠️ B17 systémique confirmé sur tous |
| STRATEGIE | INT/null, (-3) | ⚠️ ATTRIBUT — LdB INT/INT, attr_2 manquant |
| TACTIQUE_COMBAT_NAVAL | INT/ADA, S | ⚠️ MARKER — LdB dit (-3) pour le Combat naval spécifiquement, S écrase |
| TACTIQUE_COMBAT_SOUTERRAIN | INT/ADA, S | ✅ (pas de malus LdB pour souterrain) |
| TACTIQUE_COMBAT_TERRESTRE | INT/ADA, S | ✅ (pas de malus LdB pour terrestre) |
| TACTIQUE_OPERATIONS_COMMANDO | INT/ADA, S | ✅ |

- B18 : STRATEGIE : attr_2 null → INT
- B19 : TACTIQUE_COMBAT_NAVAL : marker S → (-3)

### Chunk 6 (lignes 745-894)

| ID | Trouvé | Bug |
|---|---|---|
| CAMOUFLAGE_DISSIMULATION | ADA/PER, (-3) | ⚠️ ATTRIBUT ordre inversé — LdB PER/ADA (cosmétique, calcul identique) |
| DEGUISEMENT_IMITATION | ADA/PER, (-3) | ⚠️ ATTRIBUT — LdB dit ADA/PRE (Présence), DB dit ADA/PER (Perception) |
| DISCRETION_FILATURE | ADA/PER, null | ⚠️ ATTRIBUT ordre inversé — LdB PER/ADA |
| EVASION | COO/VOL, null | ⚠️ MARKER — LdB dit (X) réservée, DB null |
| FURTIVITE_DEPLACEMENT_SILENCIEUX | ADA/PER, null | ⚠️ ATTRIBUT ordre inversé — LdB PER/ADA |
| PICKPOCKET | COO/ADA, (-3) | ✅ |
| LANGUE_ETRANGERE_* (×8 vus) | INT/null, S | ⚠️ ATTRIBUT+MARKER — LdB INT/INT et (X) PN pour chacune, DB null et S |

- B20 : CAMOUFLAGE_DISSIMULATION, DISCRETION_FILATURE, FURTIVITE_DEPLACEMENT_SILENCIEUX : ordre attr inversé vs LdB (cosmétique)
- B21 : DEGUISEMENT_IMITATION : attr_2 PER → PRE (Présence ≠ Perception — bug fonctionnel)
- B22 : EVASION : marker null → (X)
- B24 [SYSTÉMIQUE] : Langues (étrangères/anciennes/spécifiques) : attr_2 null → INT, marker S → (X) ou PN

### Chunk 8 (lignes 1043-1192)
| ID | Trouvé | Bug |
|---|---|---|
| LANGAGES_SPECIFIQUES_* restants (×8) | INT/null, S | ⚠️ B24 systémique confirmé |
| MANOEUVRE_DARMURE__ARMURES_ATMOSPHERIQUES | COO/ADA, S | ⚠️ MARKER — LdB (X), DB S |
| MANOEUVRE_DARMURE__ARMURES_EXTERNES | COO/ADA, S | ✅ pas de marker spécial LdB |
| MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES | COO/ADA, S | ✅ pas de marker spécial LdB |
| MANOEUVRE_DARMURE__ARMURES_SPATIALES | COO/ADA, S | ⚠️ MARKER — LdB (-3), DB S |
| PILOTAGE__CHASSEURS_SOUS_MARINS | INT/ADA, S | ⚠️ MARKER — LdB (X), DB S |
| PILOTAGE__CHASSEURS_ATMOSPHERIQUES | INT/ADA, S | ⚠️ MARKER — LdB (X), DB S |

Note : SOLEEN ✅ bien dans LANGAGES_SPECIFIQUES (LdB confirmé).
ACROBATIE_EQUILIBRE : TOUJOURS ABSENT à la ligne 1192 sur 2345.

- B25 : MANOEUVRE_DARMURE__ARMURES_ATMOSPHERIQUES : marker S → (X)
- B26 : MANOEUVRE_DARMURE__ARMURES_SPATIALES : marker S → (-3)
- B27 : PILOTAGE__CHASSEURS_SOUS_MARINS : marker S → (X)
- B28 : PILOTAGE__CHASSEURS_ATMOSPHERIQUES : marker S → (X)

### Chunk 9 (lignes 1192-1341)
| ID | Trouvé | Bug |
|---|---|---|
| PILOTAGE__NAVIRES_LEGERS | INT/null, S | ⚠️ ATTRIBUT — LdB INT/INT, attr_2 manquant |
| PILOTAGE__NAVIRES_LOURDS | INT/null, S | ⚠️ ATTRIBUT — LdB INT/INT, attr_2 manquant |
| PILOTAGE__ENGINS_SPATIAUX | INT/null, S | ⚠️ ATTRIBUT — LdB INT/INT, attr_2 manquant |
| PILOTAGE__VEHICULES_SOUTERRAINS | INT/ADA, S | ✅ (pas de marker spécial LdB) |
| PILOTAGE__VEHICULES_DE_SOL | PER/ADA, S | ✅ |
| PILOTAGE__SCOOTERS_SOUS_MARINS | PER/ADA, S | ✅ |
| TELEPILOTAGE | ADA/INT, (-3) | ⚠️ ATTRIBUT ordre inversé — LdB INT/ADA (cosmétique) |
| CHASSE_PISTAGE | PER/ADA, (X) | ✅ |
| CONNAISSANCE_MILIEU_NATUREL_OCEANS | ADA/INT, S | ⚠️ ATTRIBUT ordre inversé + MARKER — LdB INT/ADA, (-3) |
| CONNAISSANCE_MILIEU_NATUREL_SOUTERRAINS | ADA/INT, S | ⚠️ ATTRIBUT ordre inversé + MARKER — LdB INT/ADA, (-3) |
| CONNAISSANCE_MILIEU_NATUREL_SURFACE | ADA/INT, S | ⚠️ ATTRIBUT ordre inversé + MARKER — LdB INT/ADA, (X) |
| OBSERVATION | PER/VOL, null | ✅ |
| ORIENTATION | PER/ADA, null | ✅ |
| SURVIE | ADA/VOL, (X) | ✅ |
| ANALYSES_SONSCANS | ADA/INT, (X) | ⚠️ ID pluriel → LdB "Analyse sonscans" singulier + attr ordre ADA/INT vs LdB INT/ADA |

- B29 : PILOTAGE__NAVIRES_LEGERS/LOURDS/ENGINS_SPATIAUX : attr_2 null → INT
- B32 : TELEPILOTAGE : attr ordre ADA/INT vs INT/ADA (cosmétique)
- B33 : CONNAISSANCE_MILIEU_NATUREL_* : attr ordre ADA/INT vs INT/ADA + markers OCEANS=(-3) SOUTERRAINS=(-3) SURFACE=(X) écrasés par S
- B34 : ANALYSES_SONSCANS : ID singulier + attr ordre
**ACROBATIE_EQUILIBRE : toujours ABSENTE à ligne 1341 (60% du fichier). Suspicion : compétence MANQUANTE.**

### Chunk 10 (lignes 1341-1490)
| ID | Trouvé | Bug |
|---|---|---|
| ARMES_EMBARQUEES_ARTILLERIE | INT/null, (X) | ⚠️ ATTRIBUT — LdB INT/INT |
| ARMURERIE | INT/null, (X) | ⚠️ ATTRIBUT — LdB INT/INT |
| AQUACULTURE_ELEVAGE | INT/null, (X) | ⚠️ ATTRIBUT — LdB INT/INT + LABEL "Elevage" → "Élevage" (accent manquant) |
| ART_ARTISANAT | INT/null, (X) | ⚠️ ATTRIBUT — LdB INT/PER (Perception), attr_2 null → PER (attributs différents, pas INT/INT) |
| CHIRURGIE | INT/null, (X) | ⚠️ ATTRIBUT — LdB INT/INT |
| DRESSAGE | VOL/PRE, (-3) | ✅ |
| ELECTRONIQUE | INT/null, (X) | ⚠️ ATTRIBUT — LdB INT/INT |
| ESPIONNAGE_SURVEILLANCE | INT/null, (X) | ⚠️ ATTRIBUT — LdB INT/INT |
| EXPLOSIFS | INT/VOL, (X) | ✅ |
| FALSIFICATION | INT/PER, (X) | ✅ |
| GENIE_TECHNIQUE_* enfants (×5 vus) | INT/null, S | ⚠️ ATTRIBUT+MARKER systémique — LdB INT/INT et (X) pour tous |

- B35-B41 [SYSTÉMIQUE] : Techniques INT/INT → attr_2 null dans DB (ARMES_EMBARQUEES, ARMURERIE, AQUACULTURE, CHIRURGIE, ELECTRONIQUE, ESPIONNAGE)
- B38 : ART_ARTISANAT : attr_2 null → PER (LdB dit INT/PER, deux attributs différents)
- B42 : AQUACULTURE_ELEVAGE : label accent manquant "Élevage"

### Chunk 11 (lignes 1490-1639)
| ID | Trouvé | Bug |
|---|---|---|
| GENIE_TECHNIQUE_* restants (×4) | INT/null, S | ⚠️ B42 systémique confirmé |
| INFORMATIQUE | INT/null, (-3) | ⚠️ ATTRIBUT — LdB INT/INT, attr_2 manquant |
| MECANIQUE | INT/null, (-3) | ⚠️ MARKER — LdB pas de (-3) pour MECANIQUE parent, marker incorrect |
| MECANIQUE_* enfants (×6) | INT/null, S | ⚠️ systémique (attr_2 null) |
| PIEGES | INT/PER, (-3) | ✅ |
| PIRATAGE_INFORMATIQUE | INT/null, (X) | ℹ️ LdB ne spécifie pas d'attributs pour cette compétence |
| PREMIER_SOINS | ADA/INT, (-3) | ⚠️ ID+LABEL singulier → "PREMIERS_SOINS"/"Premiers soins" + attr ordre ADA/INT vs LdB INT/ADA |

- B43 : INFORMATIQUE : attr_2 null → INT
- B44 : MECANIQUE : marker (-3) → null (LdB n'indique pas de malus pour le parent)
- B46 : PREMIER_SOINS : ID/label singulier → pluriel + attr ordre inversé

### Chunk 12 (lignes 1638-1787)
| ID | Trouvé | Bug |
|---|---|---|
| SYSTEMES_DE_SECURITE | INT/null, (X) | ⚠️ ATTRIBUT — LdB INT/INT, attr_2 manquant |
| ABSENCE | ADA/VOL, (X) | ✅ |
| BOUCLIER_MENTAL | VOL/null, (X) | ⚠️ ATTRIBUT — LdB VOL/VOL, attr_2 manquant |
| CONTROLE_CORPOREL | CON/VOL, (X) | ✅ |
| **ACCROBATIE_EQUILIBRE** | COO/PER, (-3) | 🚨 TRIPLE BUG : (1) ID typo ACCROBATIE → ACROBATIE (double C) (2) attr_2 PER → COO (LdB COO/COO) (3) marker (-3) → null (LdB pas de malus) |
| HYBRIDE | CON/COO, (X) | ℹ️ LdB n'indique pas (X) explicitement mais skill restrictif — interprétation défendable |
| HYPNOSE | VOL/PRE, (X) | ✅ |
| MAITRISE_DE_LECHO_POLARIS | INT/VOL, (X) | ✅ |
| MAITRISE_DE_LA_FORCE_POLARIS | VOL/null, (X) | ⚠️ ATTRIBUT — LdB VOL/VOL, attr_2 manquant |
| MEDITATION | VOL/null, (X) | ⚠️ ATTRIBUT — LdB VOL/VOL, attr_2 manquant |
| MUTATION_AGILITE_CAUDALE | COO/null, S | ⚠️ ATTRIBUT — description dit COO/COO, attr_2 manquant |
| MUTATION_CONTAGION | CON/VOL, S | ✅ (CON/VOL per description) |
| MUTATION_CONTROLE_MOLECULAIRE | CON/VOL, S | ✅ |
| MUTATION_EMPATHIE | VOL/PRE, S | ✅ (VOL/PRE per description) |
| MUTATION_METAMORPHOSE | CON/VOL, S | ✅ |

- B47 : SYSTEMES_DE_SECURITE : attr_2 null → INT
- B48 : BOUCLIER_MENTAL : attr_2 null → VOL
- **B49 [CRITIQUE] : ACCROBATIE_EQUILIBRE : ID typo double C + attr_2 PER → COO + marker (-3) → null**
- B50 : MAITRISE_DE_LA_FORCE_POLARIS : attr_2 null → VOL
- B51 : MEDITATION : attr_2 null → VOL
- B52 : MUTATION_SONAR : attr_2 null → PER (description dit PER/PER)

### Chunks 13-15 (lignes 1787-2337 — fin)
POUVOIRS_POLARIS : 25 pouvoirs, tous INT/VOL, S → systémique B11 uniquement, pas de nouveaux bugs individuels.
MUTATION_PURULENCE/RADIATIONS : CON/VOL ✅

---

## SYNTHÈSE FINALE — Bugs ref_skills (audit complet)

### BUGS CRITIQUES — impact gameplay/calcul

| # | ID en base | Problème | LdB attendu |
|---|---|---|---|
| B49 | ACCROBATIE_EQUILIBRE | TRIPLE : ID typo (double C) + attr COO/PER → COO/COO + marker (-3) → null | ACROBATIE_EQUILIBRE, COO/COO, null |
| B1 | ENDURANCE | Attributs faux — CON/VOL | FOR/COO en base |
| B5 | ANALYSE_EMPATHIQUE | attr_2 PRE (Présence) → PER (Perception) | INT/PER |
| B21 | DEGUISEMENT_IMITATION | attr_2 PER (Perception) → PRE (Présence) | ADA/PRE |
| B7 | ENTREGENT_SEDUCTION | attr_2 manquant (PRE/PRE) | PRE/PRE |
| B2 | ARMES_LOURDES_CONTACT | attr_2 null (FOR/FOR) | FOR/FOR |
| B38 | ART_ARTISANAT | attr_2 null → PER (≠ null, deux attributs différents) | INT/PER |
| B10 | CARTOGRAPHIE | attr_2 null + marker null | INT/INT, (X) |
| B22 | EVASION | marker null | COO/VOL, (X) |
| B8 | EXPRESSION_ARTISTIQUE_INSTRUMENT_DE_MUSIQUE | marker S → (X) réservée | COO/PER, (X) |
| B44 | MECANIQUE | marker (-3) inventé, absent LdB | null |
| B46 | PREMIER_SOINS | ID/label singulier + attr ADA/INT | PREMIERS_SOINS, INT/ADA |

### BUGS SYSTÉMIQUES — touchent de nombreuses entrées

**B-SYS1 : attr_2=null pour les compétences à double attribut identique**
Convention erronée : null utilisé quand les deux attributs sont identiques.
- Skills INT/INT concernés (toutes → attr_2 null→INT) : BUREAUCRATIE, CARTOGRAPHIE, CONNAISSANCE_DES_NATIONS_ORGANISATIONS, CRYPTOGRAPHIE, EDUCATION_CULTURE_GENERALE, NAVIGATION, RECHERCHE_DINFORMATIONS, STRATEGIE + 19 SCIENCES + ARMES_EMBARQUEES, ARMURERIE, AQUACULTURE, CHIRURGIE, ELECTRONIQUE, ESPIONNAGE, INFORMATIQUE, SYSTEMES_DE_SECURITE + 9 GENIE_TECHNIQUE + 6 MECANIQUE + 3 PILOTAGE (NAVIRES_LEGERS/LOURDS, ENGINS_SPATIAUX) + PILOTAGE__NAVIRES_*
- Skills VOL/VOL concernés : BOUCLIER_MENTAL, MAITRISE_DE_LA_FORCE_POLARIS, MEDITATION
- Skills COO/COO concernés : MUTATION_AGILITE_CAUDALE

**B-SYS2 : marker "S" écrase les marqueurs LdB individuels pour tous les enfants de groupe**
Groupes + markers LdB perdus :
- ARTS_MARTIAUX_* : tous (-3)
- COMMERCE_TRAFIC__ARMES/DROGUES : (X) ; reste : (-3)
- EXPRESSION_ARTISTIQUE_* : (-3) sauf INSTRUMENT→(X)
- SCIENCES_* : tous (X)
- TACTIQUE_COMBAT_NAVAL : (-3)
- MANOEUVRE_DARMURE__ATMOSPHERIQUES : (X) ; SPATIALES : (-3)
- PILOTAGE__CHASSEURS_* : (X) ; NAVIRES_* : (X)
- LANGUE_ETRANGERE_* : (X)+PN
- LANGAGES_SPECIFIQUES_* : (X) pour la plupart
- CONNAISSANCE_MILIEU_NATUREL__OCEANS/SOUTERRAINS : (-3) ; SURFACE : (X)

### BUGS ID/LABEL

| ID actuel | Correction | Type |
|---|---|---|
| ACCROBATIE_EQUILIBRE | ACROBATIE_EQUILIBRE | Typo double C |
| TIR_AUTOMATIQUES | TIR_AUTOMATIQUE | Pluriel superflu |
| ANALYSES_SONSCANS | ANALYSE_SONSCANS | Pluriel superflu |
| PREMIER_SOINS | PREMIERS_SOINS | Singulier → pluriel |
| ARMES_LOURDES | ARMES_LOURDES_TIR | Asymétrie vs _CONTACT |
| label "Fusil/Armes d'épaules" | "Fusils/Armes d'épaule" | Inversion pluriel/singulier |
| label "Aquaculture/Elevage" | "Aquaculture/Élevage" | Accent manquant |

### BUGS ORDRE ATTRIBUT (cosmétiques — calcul identique)
CAMOUFLAGE_DISSIMULATION, DISCRETION_FILATURE, FURTIVITE_DEPLACEMENT_SILENCIEUX : ADA/PER → PER/ADA
TELEPILOTAGE, ANALYSES_SONSCANS, PREMIER_SOINS : ordre inversé vs LdB
CONNAISSANCE_MILIEU_NATUREL_* : ADA/INT → INT/ADA

### COMPÉTENCES MANQUANTES
- COMMERCE_TRAFIC__ARTISANAT — absent (référencé carrières artisan)
- COMMERCE_TRAFIC__OEUVRES_DART — absent (référencé carrières artisan)

### OBSERVATION STRUCTURELLE
ACCROBATIE_EQUILIBRE est placée ligne 1678, entre Compétences Spéciales, alors que sa famille est "Aptitudes physiques". Insertion hors-ordre typique d'un patch tardif mal positionné.

