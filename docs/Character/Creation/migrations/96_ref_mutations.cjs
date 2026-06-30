-- ============================================================
-- Migration 096 — ref_mutations v2
-- Remplace l'ancienne table ref_mutations par une version
-- normalisée, typée, avec tables de jointure.
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- TABLE PRINCIPALE
-- ════════════════════════════════════════════════════════════
CREATE TABLE ref_mutations (
    mutation_id         INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    
    name                VARCHAR(100) NOT NULL UNIQUE,
    subtype             VARCHAR(50) CHECK (
        subtype IS NULL 
        OR subtype IN ('minor', 'major', 
                       'taste', 'smell', 'touch', 'hearing', 'sight',
                       'fire', 'cold', 'drugs', 'disease', 'poison', 'radiation')
    ),
    has_subtable        BOOLEAN NOT NULL DEFAULT FALSE,
    
    cost_pc             INTEGER NOT NULL DEFAULT 0,
    is_unique           BOOLEAN NOT NULL DEFAULT FALSE,
    is_stackable        BOOLEAN NOT NULL DEFAULT FALSE,
    stack_limit         INTEGER,
    stack_effect        VARCHAR(100),
    
    -- Attributs primaires
    mod_FOR INTEGER NOT NULL DEFAULT 0,
    mod_CON INTEGER NOT NULL DEFAULT 0,
    mod_COO INTEGER NOT NULL DEFAULT 0,
    mod_INT INTEGER NOT NULL DEFAULT 0,
    mod_VOL INTEGER NOT NULL DEFAULT 0,
    mod_PRE INTEGER NOT NULL DEFAULT 0,
    
    -- Résistances (9999 = immunité)
    mod_res_damage      INTEGER NOT NULL DEFAULT 0,
    mod_res_shock       INTEGER NOT NULL DEFAULT 0,
    mod_res_drugs       INTEGER NOT NULL DEFAULT 0,
    mod_res_disease     INTEGER NOT NULL DEFAULT 0,
    mod_res_poison      INTEGER NOT NULL DEFAULT 0,
    mod_res_radiation   INTEGER NOT NULL DEFAULT 0,
    
    -- Armure
    natural_armor       INTEGER NOT NULL DEFAULT 0,
    
    -- Sexe / fertilité
    mod_sex             VARCHAR(20) CHECK (mod_sex IS NULL OR mod_sex IN ('androgyne', 'asexue')),
    mod_fertility       VARCHAR(20) CHECK (mod_fertility IS NULL OR mod_fertility IN ('sterile', 'self_fertile')),
    
    -- Cumul
    max_cumul_group     VARCHAR(50),
    max_cumul_limit     INTEGER,
    
    -- Effets non modélisables en colonne
    special_effect      TEXT,
    
    -- Métadonnées LdB
    d100_range_start    INTEGER,
    d100_range_end      INTEGER,
    ldb_page            INTEGER,
    description         TEXT NOT NULL,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- SOUS-TYPES (Caractère génétique animal uniquement)
-- ════════════════════════════════════════════════════════════
CREATE TABLE ref_mutation_subtypes (
    subtype_id      INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    mutation_id     INTEGER NOT NULL REFERENCES ref_mutations(mutation_id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    d4_roll         INTEGER NOT NULL CHECK (d4_roll BETWEEN 1 AND 4),
    
    mod_FOR INTEGER NOT NULL DEFAULT 0,
    mod_CON INTEGER NOT NULL DEFAULT 0,
    mod_COO INTEGER NOT NULL DEFAULT 0,
    mod_INT INTEGER NOT NULL DEFAULT 0,
    mod_VOL INTEGER NOT NULL DEFAULT 0,
    mod_PRE INTEGER NOT NULL DEFAULT 0,
    
    skill_bonus     TEXT,
    immunity        TEXT,
    special_trait   TEXT,
    
    UNIQUE(mutation_id, d4_roll)
);

-- ════════════════════════════════════════════════════════════
-- COMPÉTENCES DÉBLOQUÉES (→ future FK ref_skills)
-- ════════════════════════════════════════════════════════════
CREATE TABLE ref_mutation_skills (
    mutation_id     INTEGER NOT NULL REFERENCES ref_mutations(mutation_id) ON DELETE CASCADE,
    skill_name      VARCHAR(100) NOT NULL,
    skill_attrs     VARCHAR(10) NOT NULL,
    skill_base      INTEGER NOT NULL,          -- -3 = normale, -4 = réservée (X)
    cost_mult       DECIMAL(3,1) NOT NULL DEFAULT 1.0,
    PRIMARY KEY (mutation_id, skill_name)
);

-- ════════════════════════════════════════════════════════════
-- RÉDUCTIONS / GRATUITÉS ENTRE MUTATIONS
-- ════════════════════════════════════════════════════════════
CREATE TABLE ref_mutation_discounts (
    mutation_id         INTEGER NOT NULL REFERENCES ref_mutations(mutation_id) ON DELETE CASCADE,
    target_mutation_id  INTEGER NOT NULL REFERENCES ref_mutations(mutation_id) ON DELETE CASCADE,
    discount_amount     INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (mutation_id, target_mutation_id)
);

-- ════════════════════════════════════════════════════════════
-- INCOMPATIBILITÉS ENTRE MUTATIONS
-- ════════════════════════════════════════════════════════════
CREATE TABLE ref_mutation_incompatibilities (
    mutation_id_a   INTEGER NOT NULL REFERENCES ref_mutations(mutation_id) ON DELETE CASCADE,
    mutation_id_b   INTEGER NOT NULL REFERENCES ref_mutations(mutation_id) ON DELETE CASCADE,
    PRIMARY KEY (mutation_id_a, mutation_id_b),
    CHECK (mutation_id_a < mutation_id_b)
);

-- ============================================================
-- SEED
-- ============================================================

-- 01-06 : Adaptation extérieure
INSERT INTO ref_mutations (name, cost_pc, is_unique, special_effect, d100_range_start, d100_range_end, description) VALUES (
    'Adaptation extérieure', 3, TRUE,
    'Heures dehors = niveau de compétence. Récupération = 3× durée exposition.',
    1, 6,
    'Le personnage possède une résistance aux effets néfastes de la Surface (radiations, acidité de l''air, altération moléculaire…).'
);
INSERT INTO ref_mutation_skills (mutation_id, skill_name, skill_attrs, skill_base, cost_mult)
VALUES (currval(pg_get_serial_sequence('ref_mutations', 'mutation_id')), 'Adaptation extérieure', 'CON/CON', -3, 1.0);

-- 07-10 : Amphibie
INSERT INTO ref_mutations (name, cost_pc, is_unique, special_effect, d100_range_start, d100_range_end, description) VALUES (
    'Amphibie', 2, TRUE,
    'Max niveau +0. Profondeur max = niveau×500m. Ne peut dépasser CON en mètres si niveau < 1.',
    7, 10,
    'Le personnage est doté d''une mutation similaire à celle des hybrides naturels, mais imparfaitement développée. Respire sous l''eau.'
);
INSERT INTO ref_mutation_skills (mutation_id, skill_name, skill_attrs, skill_base, cost_mult)
VALUES (currval(pg_get_serial_sequence('ref_mutations', 'mutation_id')), 'Hybride', 'CON/COO', -3, 1.0);

-- 11-13 : Androgyne
INSERT INTO ref_mutations (name, cost_pc, is_unique, mod_sex, d100_range_start, d100_range_end, description) VALUES (
    'Androgyne', 0, TRUE, 'androgyne', 11, 13,
    'Physiquement, le personnage tient des deux sexes.'
);

-- 14-16 : Asexué
INSERT INTO ref_mutations (name, cost_pc, is_unique, mod_sex, mod_fertility, d100_range_start, d100_range_end, description) VALUES (
    'Asexué', 0, TRUE, 'asexue', 'sterile', 14, 16,
    'Le personnage est né sans sexe. Il est donc stérile.'
);

-- 17-19 : Autofécondation
INSERT INTO ref_mutations (name, cost_pc, is_unique, mod_sex, mod_fertility, d100_range_start, d100_range_end, description) VALUES (
    'Autofécondation', 0, TRUE, 'asexue', 'self_fertile', 17, 19,
    'Le personnage ne possède pas d''organes reproducteurs mais peut s''autoféconder et mettre un enfant au monde.'
);

-- 20-23 : Caractère génétique animal
INSERT INTO ref_mutations (name, cost_pc, is_unique, has_subtable, d100_range_start, d100_range_end, description) VALUES (
    'Caractère génétique animal', 2, TRUE, TRUE, 20, 23,
    'Le personnage présente un fort caractère génétique animal. Morphologie altérée, fourrure, écailles, traits animaux. Lancez 1D4.'
);
INSERT INTO ref_mutation_subtypes (mutation_id, name, d4_roll, mod_COO, skill_bonus, immunity)
VALUES (currval(pg_get_serial_sequence('ref_mutations', 'mutation_id')), 'Caractère félin', 1, 2, 'Acrobatie/Équilibre:+3', 'vertige');
INSERT INTO ref_mutation_subtypes (mutation_id, name, d4_roll, mod_CON, skill_bonus)
VALUES (currval(pg_get_serial_sequence('ref_mutations', 'mutation_id')), 'Caractère canin', 2, 1, 'Perception(odorat):+3');
INSERT INTO ref_mutation_subtypes (mutation_id, name, d4_roll, mod_COO, skill_bonus, special_trait)
VALUES (currval(pg_get_serial_sequence('ref_mutations', 'mutation_id')), 'Caractère reptilien', 3, 1, 'Perception(odorat):+3;Évasion:+3', 'Se faufiler dans espaces étroits');
INSERT INTO ref_mutation_subtypes (mutation_id, name, d4_roll, mod_FOR, mod_COO, skill_bonus)
VALUES (currval(pg_get_serial_sequence('ref_mutations', 'mutation_id')), 'Caractère simiesque', 4, 1, 1, 'Escalade:+3');

-- 24-25 : Contact corrosif
INSERT INTO ref_mutations (name, cost_pc, is_stackable, stack_effect, special_effect, d100_range_start, d100_range_end, description) VALUES (
    'Contact corrosif', 3, TRUE, '+3 dégâts par stack',
    '1D10 dégâts base. Continue 3D6 rounds tant que non nettoyé (eau). Dégâts indépendants de toute autre action.',
    24, 25,
    'La peau du personnage sécrète à volonté une substance corrosive.'
);

-- 26-27 : Contagion
INSERT INTO ref_mutations (name, cost_pc, is_unique, mod_res_disease, special_effect, d100_range_start, d100_range_end, description) VALUES (
    'Contagion', 3, TRUE, 9999,
    'Contagion passive permanente (Grippe bleue contact peau). Contrôle: Test Contagion. Virulence: +0→1D6, -3→2D6, -5→3D6, -7→4D6, -10→5D6. Victime développe maladie en 2D6h - MR.',
    26, 27,
    'Le personnage est nourri des bactéries qui vivent en symbiose avec lui. Immunisé aux maladies. Contagion invisible (contrairement à Purulence).'
);
INSERT INTO ref_mutation_skills (mutation_id, skill_name, skill_attrs, skill_base, cost_mult)
VALUES (currval(pg_get_serial_sequence('ref_mutations', 'mutation_id')), 'Contagion', 'CON/VOL', -4, 2.0);

-- 28-30 : Corne
INSERT INTO ref_mutations (name, cost_pc, is_unique, special_effect, d100_range_start, d100_range_end, description) VALUES (
    'Corne', 1, TRUE,
    'Après saisie: 1D10 + mod CaC. Si tête: +1D6 Choc.',
    28, 30,
    'Le personnage est doté d''une petite corne sur le front.'
);

-- 31-35 : Crocs
INSERT INTO ref_mutations (name, cost_pc, is_unique, special_effect, d100_range_start, d100_range_end, description) VALUES (
    'Crocs', 1, TRUE,
    'Après saisie: 1D10+3 + mod CaC.',
    31, 35,
    'Le personnage est doté de crocs ou ses dents sont extrêmement tranchantes.'
);

-- 36-40 : Difformités légères
INSERT INTO ref_mutations (name, subtype, cost_pc, is_stackable, mod_PRE, d100_range_start, d100_range_end, description) VALUES (
    'Difformités', 'minor', 1, TRUE, -1, 36, 40,
    'Difformité légère. Présence -1. Cumulable avec d''autres difformités.'
);

-- 41-43 : Difformités importantes
INSERT INTO ref_mutations (name, subtype, cost_pc, is_stackable, mod_PRE, d100_range_start, d100_range_end, description) VALUES (
    'Difformités', 'major', 3, TRUE, -2, 41, 43,
    'Difformité importante. Présence -2. Cumulable avec d''autres difformités.'
);

-- 44-46 : Empathie
INSERT INTO ref_mutations (name, cost_pc, is_unique, special_effect, d100_range_start, d100_range_end, description) VALUES (
    'Empathie', 4, TRUE,
    'Communication corail (-7), animaux (-3). Émotions individus: malus VOL cible/2. Modification: Test opposé VOL, MR = rounds. Échec critique: cible alertée. Progression par étapes. Lieux imprégnés (-13).',
    44, 46,
    'Cette mutation donne accès à la Compétence spéciale Empathie. Permet de ressentir et modifier les émotions.'
);
INSERT INTO ref_mutation_skills (mutation_id, skill_name, skill_attrs, skill_base, cost_mult)
VALUES (currval(pg_get_serial_sequence('ref_mutations', 'mutation_id')), 'Empathie', 'VOL/PRE', -3, 2.0);

-- 47-49 : Excroissance osseuse rétractable
INSERT INTO ref_mutations (name, cost_pc, is_unique, special_effect, d100_range_start, d100_range_end, description) VALUES (
    'Excroissance osseuse rétractable', 3, TRUE,
    'Arme: Combat à mains nues, 2D10 + mod CaC.',
    47, 49,
    'Le personnage peut faire jaillir d''un de ses avant-bras une excroissance osseuse.'
);

-- 50-52 : Griffes
INSERT INTO ref_mutations (name, cost_pc, is_unique, special_effect, d100_range_start, d100_range_end, description) VALUES (
    'Griffes', 2, TRUE,
    'Dégâts: 1D10+3 + mod CaC. Bonus: Escalade +3 (si griffes utilisables). Malus: dextérité manuelle -3.',
    50, 52,
    'Le personnage est doté de griffes.'
);

-- 53 : Instabilité moléculaire
INSERT INTO ref_mutations (name, cost_pc, is_unique, special_effect, d100_range_start, d100_range_end, description) VALUES (
    'Instabilité moléculaire', 4, TRUE,
    'Transformation volontaire: 2D10 rounds. Organes: auditif -3, visuel -5, tentacule -7 (FOR 3). Reprise: -3 (≤10min), -7 (≤1h), -1/h supp. Échec reprise: difficulté +1 cumulatif. Échec impossible: FOR ou CON -1 définitif. Stress → Test involontaire.',
    53, 53,
    'La structure moléculaire du personnage peut être modifiée, volontairement ou involontairement.'
);
INSERT INTO ref_mutation_skills (mutation_id, skill_name, skill_attrs, skill_base, cost_mult)
VALUES (currval(pg_get_serial_sequence('ref_mutations', 'mutation_id')), 'Contrôle moléculaire', 'CON/VOL', -4, 2.0);

-- 54-56 : Métamorphe
INSERT INTO ref_mutations (name, cost_pc, is_unique, special_effect, d100_range_start, d100_range_end, description) VALUES (
    'Métamorphe', 4, TRUE,
    'Apparence physique seulement. Manières: Test Déguisement/Imitation avec bonus MR. Forme humanoïde uniquement. Attributs/compétences inchangés.',
    54, 56,
    'Cette mutation permet de prendre l''apparence physique d''un individu.'
);
INSERT INTO ref_mutation_skills (mutation_id, skill_name, skill_attrs, skill_base, cost_mult)
VALUES (currval(pg_get_serial_sequence('ref_mutations', 'mutation_id')), 'Métamorphose', 'CON/VOL', -3, 2.0);

-- 57-58 : Organe sensoriel manquant (5 sous-types)
INSERT INTO ref_mutations (name, subtype, cost_pc, is_unique, special_effect, d100_range_start, d100_range_end, description) VALUES
('Organe sensoriel manquant', 'taste',   0, TRUE, 'Sens diminué -5. Cumulable avec Désavantage Sens diminué.', 57, 58, 'Papilles gustatives atrophiées.'),
('Organe sensoriel manquant', 'smell',   0, TRUE, 'Sens diminué -5. Cumulable avec Désavantage Sens diminué.', 57, 58, 'Nez atrophié.'),
('Organe sensoriel manquant', 'touch',   0, TRUE, 'Sens diminué -5. Cumulable avec Désavantage Sens diminué.', 57, 58, 'Sens du toucher atrophié.'),
('Organe sensoriel manquant', 'hearing', 1, TRUE, 'Sens diminué -5. Cumulable avec Désavantage Sens diminué.', 57, 58, 'Oreille manquante.'),
('Organe sensoriel manquant', 'sight',   2, TRUE, 'Sens diminué -5. Cumulable avec Désavantage Sens diminué.', 57, 58, 'Œil manquant.');

-- 59-60 : Organe sensoriel supplémentaire ou amélioré (5 sous-types)
INSERT INTO ref_mutations (name, subtype, cost_pc, is_unique, special_effect, d100_range_start, d100_range_end, description) VALUES
('Organe sensoriel supplémentaire ou amélioré', 'taste',   0, TRUE, 'Sens développé +5. Cumulable avec Avantage Sens développé.', 59, 60, 'Goût amélioré.'),
('Organe sensoriel supplémentaire ou amélioré', 'smell',   1, TRUE, 'Sens développé +5. Cumulable avec Avantage Sens développé.', 59, 60, 'Odorat amélioré.'),
('Organe sensoriel supplémentaire ou amélioré', 'touch',   1, TRUE, 'Sens développé +5. Cumulable avec Avantage Sens développé.', 59, 60, 'Toucher amélioré.'),
('Organe sensoriel supplémentaire ou amélioré', 'hearing', 2, TRUE, 'Sens développé +5. Cumulable avec Avantage Sens développé.', 59, 60, 'Oreille supplémentaire.'),
('Organe sensoriel supplémentaire ou amélioré', 'sight',   2, TRUE, 'Sens développé +5. Cumulable avec Avantage Sens développé.', 59, 60, 'Œil supplémentaire.');

-- 61 : Parasite
INSERT INTO ref_mutations (name, cost_pc, is_unique, max_cumul_group, max_cumul_limit, special_effect, d100_range_start, d100_range_end, description) VALUES (
    'Parasite', 1, TRUE, 'parasite_symbiote_regen', 2,
    '1D4 parasites. Résistance dommages -1 par 2 parasites. Attaque 1D10+N parasites/semaine (ou si pas assez nourri). Nourriture ×2. Retrait: CON -1 par 2 parasites. Tirage mutation bonus aléatoire (excluant: Tentacule rétractable, Symbiote, Queue, Parasite, Organe sensoriel manquant, Instabilité moléculaire, Griffes, Excroissance osseuse, Difformités, Crocs, Corne, Asexué, Androgyne).',
    61, 61,
    'Le personnage abrite 1D4 parasites. Il doit manger et boire deux fois plus.'
);

-- 62-66 : Peau renforcée
INSERT INTO ref_mutations (name, cost_pc, is_stackable, stack_effect, natural_armor, d100_range_start, d100_range_end, description) VALUES (
    'Peau renforcée', 2, TRUE, '+2 armure naturelle par stack', 3, 62, 66,
    'La peau du personnage, sombre et râpeuse, lui confère une armure naturelle de 3 points.'
);

-- 67 : Purulence
INSERT INTO ref_mutations (name, cost_pc, is_stackable, stack_effect, mod_PRE, mod_res_disease, special_effect, d100_range_start, d100_range_end, description) VALUES (
    'Purulence', -2, TRUE, 'PRE -1, Résistance maladies +2 par stack', -2, 3,
    'Social -5 si apparence visible. Contagion 1 sem/3 mois (Grippe bleue). Contrôle: Test Purulence/jour, malus -1 cumulatif/jour. Attaque: contact peau, opp CON cible, 3D10+MR. Cadavre contagieux.',
    67, 67,
    'La peau de l''individu est couverte de pustules. Présence réduite de 2 (minimum 3).'
);
INSERT INTO ref_mutation_skills (mutation_id, skill_name, skill_attrs, skill_base, cost_mult)
VALUES (currval(pg_get_serial_sequence('ref_mutations', 'mutation_id')), 'Purulence', 'CON/VOL', -4, 1.0);

-- 68-70 : Queue
INSERT INTO ref_mutations (name, cost_pc, is_unique, special_effect, d100_range_start, d100_range_end, description) VALUES (
    'Queue', 1, TRUE,
    'Compétence limitative: Acrobatie/Équilibre, Armes de poing (petites), Combat armé (petites armes, pas mod CaC), Combat à mains nues (1D10/2 + mod CaC).',
    68, 70,
    'Le personnage est doté d''une queue. Il peut apprendre à manipuler des objets avec.'
);
INSERT INTO ref_mutation_skills (mutation_id, skill_name, skill_attrs, skill_base, cost_mult)
VALUES (currval(pg_get_serial_sequence('ref_mutations', 'mutation_id')), 'Agilité caudale', 'COO/COO', -4, 1.0);

-- 71 : Radiation
INSERT INTO ref_mutations (name, cost_pc, is_stackable, stack_effect, special_effect, d100_range_start, d100_range_end, description) VALUES (
    'Radiation', 3, TRUE, '+3 irradiation par stack',
    '2D6 irradiation + MR au contact.',
    71, 71,
    'Cette mutation permet de libérer un flot de radiations dans l''organisme d''une victime par simple contact. Offre gratuitement Résistance naturelle (radiation).'
);
INSERT INTO ref_mutation_skills (mutation_id, skill_name, skill_attrs, skill_base, cost_mult)
VALUES (currval(pg_get_serial_sequence('ref_mutations', 'mutation_id')), 'Radiations', 'CON/VOL', -3, 2.0);

-- 72-75 : Régénération
INSERT INTO ref_mutations (name, cost_pc, is_stackable, stack_effect, max_cumul_group, max_cumul_limit, special_effect, d100_range_start, d100_range_end, description) VALUES (
    'Régénération', 2, TRUE, 'Bonus stabilisation +1, guérison ÷3 (au lieu de ÷2)', 'parasite_symbiote_regen', 2,
    'Stabilisation +2, infection +3, guérison ÷2. Nourriture ×2 sinon 1D10+3/jour.',
    72, 75,
    'Le personnage régénère plus rapidement ses blessures. Ne permet pas de récupérer un membre ou un organe détruit.'
);

-- 76-80 : Résistance naturelle (6 sous-types)
INSERT INTO ref_mutations (name, subtype, cost_pc, is_stackable, stack_effect, mod_res_damage, mod_res_drugs, mod_res_disease, mod_res_poison, mod_res_radiation, special_effect, d100_range_start, d100_range_end, description) VALUES
('Résistance naturelle', 'fire',      1, TRUE, '+3 réduction feu par stack',       3, 0, 0, 0, 0, 'Immunisé chaleur.',                       76, 80, 'Résistance au feu. Réduit les dommages de feu de 3 points. Insensible à la chaleur.'),
('Résistance naturelle', 'cold',      1, TRUE, '+3 réduction froid par stack',      3, 0, 0, 0, 0, 'Immunisé froid jusqu''à -10°C.',            76, 80, 'Résistance au froid. Réduit les dommages de froid de 3 points.'),
('Résistance naturelle', 'drugs',     1, TRUE, '+1 Résistance drogues par stack',   0, 3, 0, 0, 0, NULL,                                       76, 80, 'Résistance aux drogues augmentée de 3 points.'),
('Résistance naturelle', 'disease',   1, TRUE, '+1 Résistance maladies par stack',  0, 0, 3, 0, 0, NULL,                                       76, 80, 'Résistance aux maladies augmentée de 3 points.'),
('Résistance naturelle', 'poison',    1, TRUE, '+1 Résistance poison par stack',    0, 0, 0, 3, 0, NULL,                                       76, 80, 'Résistance au poison augmentée de 3 points.'),
('Résistance naturelle', 'radiation', 1, TRUE, '+1 Résistance radiations par stack',0, 0, 0, 0, 3, NULL,                                       76, 80, 'Résistance aux radiations augmentée de 3 points.');

-- 81-85 : Sixième sens
INSERT INTO ref_mutations (name, cost_pc, is_unique, special_effect, d100_range_start, d100_range_end, description) VALUES (
    'Sixième sens', 1, TRUE,
    'Bonus +3 Tests de Réaction en cas de Surprise.',
    81, 85,
    'Le personnage bénéficie d''un bonus de +3 à ses Tests de Réaction en cas de Surprise.'
);

-- 86-88 : Sonar
INSERT INTO ref_mutations (name, cost_pc, is_unique, special_effect, d100_range_start, d100_range_end, description) VALUES (
    'Sonar', 3, TRUE,
    'Portée = INT mètres. Onde sonique: 2D10, modificateurs combat distance.',
    86, 88,
    'Le personnage est doté d''une sorte de sonar pour repérer des obstacles sous l''eau ou dans le noir.'
);
INSERT INTO ref_mutation_skills (mutation_id, skill_name, skill_attrs, skill_base, cost_mult)
VALUES (currval(pg_get_serial_sequence('ref_mutations', 'mutation_id')), 'Sonar', 'PER/PER', -4, 1.0);

-- 89 : Squelette renforcé
INSERT INTO ref_mutations (name, cost_pc, is_stackable, stack_effect, mod_res_damage, mod_res_shock, d100_range_start, d100_range_end, description) VALUES (
    'Squelette renforcé', 3, TRUE, '+1 Résistance dommages, +1 Résistance Choc par stack', 2, 3, 89, 89,
    'La Résistance aux dommages du personnage est augmentée de 2 points, et sa Résistance au Choc de 3 points.'
);

-- 90-92 : Symbiote
INSERT INTO ref_mutations (name, cost_pc, is_unique, max_cumul_group, max_cumul_limit, special_effect, d100_range_start, d100_range_end, description) VALUES (
    'Symbiote', 3, TRUE, 'parasite_symbiote_regen', 2,
    '1D4 symbiotes. Nourriture ×2 sinon 1D10+N/jour. Choix par symbiote: +2 Résistance naturelle OU mutation aléatoire (excluant: Tentacule rétractable, Symbiote, Queue, Parasite, Organe sensoriel manquant, Instabilité moléculaire, Griffes, Excroissance osseuse, Difformités, Crocs, Corne, Asexué, Androgyne). Retrait: CON -1 par 2 symbiotes.',
    90, 92,
    'Le corps du personnage abrite 1D4 symbiotes.'
);

-- 93-95 : Tentacule rétractable
INSERT INTO ref_mutations (name, cost_pc, is_unique, special_effect, d100_range_start, d100_range_end, description) VALUES (
    'Tentacule rétractable', 1, TRUE,
    'Peut faire jaillir un tentacule utilisable comme membre normal.',
    93, 95,
    'Le personnage peut faire jaillir de son organisme un tentacule dont il peut se servir comme d''un nouveau membre.'
);

-- 96-00 : Vision nocturne
INSERT INTO ref_mutations (name, cost_pc, is_unique, special_effect, d100_range_start, d100_range_end, description) VALUES (
    'Vision nocturne', 3, TRUE,
    'Vision nocturne parfaite si source lumineuse présente. Ténèbres totales: aveugle.',
    96, 100,
    'Le personnage voit parfaitement bien la nuit, tant qu''il existe une quelconque source lumineuse.'
);

-- ============================================================
-- DISCOUNTS
-- ============================================================

-- Radiation → Résistance naturelle (radiation) gratuit
INSERT INTO ref_mutation_discounts (mutation_id, target_mutation_id, discount_amount)
SELECT r1.mutation_id, r2.mutation_id, 1
FROM ref_mutations r1, ref_mutations r2
WHERE r1.name = 'Radiation'
  AND r2.name = 'Résistance naturelle' AND r2.subtype = 'radiation';

-- Caractère félin → Griffes (-1 PC), Vision nocturne (gratuit = 3 PC)
INSERT INTO ref_mutation_discounts (mutation_id, target_mutation_id, discount_amount)
SELECT sub.mutation_id, tgt.mutation_id, 1
FROM ref_mutation_subtypes sub, ref_mutations tgt
WHERE sub.name = 'Caractère félin' AND tgt.name = 'Griffes';

INSERT INTO ref_mutation_discounts (mutation_id, target_mutation_id, discount_amount)
SELECT sub.mutation_id, tgt.mutation_id, 3
FROM ref_mutation_subtypes sub, ref_mutations tgt
WHERE sub.name = 'Caractère félin' AND tgt.name = 'Vision nocturne';

-- Caractère canin → Crocs (gratuit = 1 PC)
INSERT INTO ref_mutation_discounts (mutation_id, target_mutation_id, discount_amount)
SELECT sub.mutation_id, tgt.mutation_id, 1
FROM ref_mutation_subtypes sub, ref_mutations tgt
WHERE sub.name = 'Caractère canin' AND tgt.name = 'Crocs';

-- Caractère simiesque → Queue (gratuit = 1 PC)
INSERT INTO ref_mutation_discounts (mutation_id, target_mutation_id, discount_amount)
SELECT sub.mutation_id, tgt.mutation_id, 1
FROM ref_mutation_subtypes sub, ref_mutations tgt
WHERE sub.name = 'Caractère simiesque' AND tgt.name = 'Queue';

-- ============================================================
-- INCOMPATIBILITIES
-- ============================================================

INSERT INTO ref_mutation_incompatibilities (mutation_id_a, mutation_id_b)
SELECT r1.mutation_id, r2.mutation_id
FROM ref_mutations r1, ref_mutations r2
WHERE r1.name = 'Parasite' AND r2.name = 'Symbiote';

INSERT INTO ref_mutation_incompatibilities (mutation_id_a, mutation_id_b)
SELECT r1.mutation_id, r2.mutation_id
FROM ref_mutations r1, ref_mutations r2
WHERE r1.name = 'Parasite' AND r2.name = 'Régénération';

INSERT INTO ref_mutation_incompatibilities (mutation_id_a, mutation_id_b)
SELECT r1.mutation_id, r2.mutation_id
FROM ref_mutations r1, ref_mutations r2
WHERE r1.name = 'Symbiote' AND r2.name = 'Régénération';