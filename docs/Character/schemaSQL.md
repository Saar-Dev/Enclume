Schéma SQL — Fiche Personnage Polaris V1
Tables de référence (statiques, peuplées une fois)
ref_genotypes
id          TEXT PK        — 'HUMAIN', 'HYB_NAT', 'TEC_HYB', 'GEN_HYB'
label       TEXT           — nom affichage
mod_for     INT DEFAULT 0
mod_con     INT DEFAULT 0
mod_coo     INT DEFAULT 0
mod_ada     INT DEFAULT 0
mod_per     INT DEFAULT 0
mod_int     INT DEFAULT 0
mod_vol     INT DEFAULT 0
mod_pre     INT DEFAULT 0
ref_skills
id          TEXT PK        — ex: 'ACROBATIE', 'COMBAT_ARME'
family      TEXT           — 'Physique', 'Combat', 'Mental'...
label       TEXT           — nom affiché
parent      TEXT           — NULL si pas de parent, sinon ex: 'ARTS_MARTIAUX'
attr_1      TEXT           — 'FOR', 'COO'...
attr_2      TEXT           — NULL si attr_1 x2
marker      TEXT           — NULL, 'DIFF', 'RES_X', 'LIMIT', 'PN', 'PREREQ'
ref_skill_requirements
skill_id    TEXT FK→ref_skills.id
type        TEXT           — 'SKILL_MIN', 'MUTATION', 'GENOTYPE'
value       TEXT           — ex: 'ARTS_MARTIAUX' ou 'MUT_QUEUE'
threshold   INT            — valeur minimale requise
PK(skill_id, type, value)

Tables personnage (dynamiques, une entrée par personnage)
char_sheet — table pivot
id              UUID PK DEFAULT gen_random_uuid()
character_id    UUID FK→characters.id ON DELETE CASCADE  — lien Enclume
chc             INT DEFAULT 11     — Chance, 1-20, aucun calcul
created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
char_identity — description physique
char_sheet_id   UUID PK FK→char_sheet.id ON DELETE CASCADE
height          NUMERIC(4,1)   — taille en m
weight          NUMERIC(5,1)   — poids en kg
skin            TEXT
eyes            TEXT
hair            TEXT
build           TEXT           — corpulence
distinctive_signs TEXT
hand_pref       TEXT           — 'R', 'L', 'A'
player_name     TEXT
char_name       TEXT
char_archetype — génotype et biographie
char_sheet_id   UUID PK FK→char_sheet.id ON DELETE CASCADE
genotype_id     TEXT FK→ref_genotypes.id
age             INT
sex             TEXT
is_fertile      BOOLEAN DEFAULT FALSE
origin_geo      TEXT
origin_soc      TEXT
training_base   TEXT
higher_ed       TEXT
char_attributes — attributs primaires
char_sheet_id   UUID FK→char_sheet.id ON DELETE CASCADE
attr_id         TEXT           — 'FOR','CON','COO','ADA','PER','INT','VOL','PRE'
base_level      INT NOT NULL
pc_modifier     INT DEFAULT 0
PK(char_sheet_id, attr_id)
char_skills — maîtrise des compétences par personnage
char_sheet_id   UUID FK→char_sheet.id ON DELETE CASCADE
skill_id        TEXT FK→ref_skills.id
mastery         INT DEFAULT 0   — points de maîtrise saisis
is_learned      BOOLEAN DEFAULT FALSE  — pour débloquer les RES_X
PK(char_sheet_id, skill_id)

Ce qui n'existe pas en base (calculé côté JS uniquement)

Modificateur génotype → lu depuis ref_genotypes
Niveau actuel (na) → base_level + pc_modifier + mod_gen - TOTAL_MALUS
Aptitude Naturelle (AN) → table de correspondance objet JS
Score Base compétence → AN(attr_1) + AN(attr_2)
Total compétence → base + mastery
Tous les attributs secondaires (REA, Initiative, seuils, vitesses, Mod_Dom)