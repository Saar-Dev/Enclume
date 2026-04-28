INSERT INTO mutations (
    muta_numero, 
    nom, 
    description, 
    linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_001', 
    'Adaptation extérieure', 
    'Le personnage possède une résistance aux effets néfastes de la Surface (radiations, acidité de l’air, altération moléculaire…). Le niveau de la compétence indique le nombre d’heures d’exposition possible. Après exposition, nécessite un repos de 3x la durée passée à l’extérieur.', 
    'Adaptation extérieure', 
    0, 0, 0, 0, 0, 0, -- Pas de modificateurs d'attributs
    0, 0, 0, 0,       -- Pas de bonus compétences standards
    0, 0, 0, 0, 0, 0, -- Pas de résistances fixes (géré par la compétence)
    NULL, NULL, NULL, -- Pas d'arme naturelle
    NULL, NULL        -- Pas de règle de cumul spécifiée
);
-- Amphibie
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_002', 
    'Amphibie', 
    'Respiration sous-marine. Supporte pression et froid. Profondeur max : (niveau Hybride) x 500m. Max Constitution mètres si niveau < 1. Maîtrise limitée au niveau +0.', 
    'Hybride', 
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, NULL, NULL, NULL, NULL, NULL
);

-- Androgyne
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_003', 
    'Androgyne', 
    'Physiquement, le personnage tient des deux sexes.', 
    NULL, 
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, NULL, NULL, NULL, NULL, NULL
);

-- Asexué
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_004', 
    'Asexué', 
    'Le personnage est né sans sexe. Le personnage est donc stérile.', 
    NULL, 
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, NULL, NULL, NULL, NULL, NULL
);

-- Autofécondation
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_005', 
    'Autofécondation', 
    'Le personnage ne possède pas d’organes reproducteurs mais peut s’autoféconder et mettre un enfant au monde.', 
    NULL, 
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, NULL, NULL, NULL, NULL, NULL
);
-- Caractère félin
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_006', 
    'Caractère félin', 
    'Aspect animal. Pas de vertige. Bonus de 1 PC sur Griffes et Vision nocturne.', 
    NULL, 
    0, 2, 0, 0, 0, 0, -- COO +2
    3, 0, 0, 0,       -- Acrobatie +3
    0, 0, 0, 0, 0, 0, 
    NULL, NULL, NULL, NULL, NULL
);

-- Caractère canin
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_007', 
    'Caractère canin', 
    'Aspect animal. Bonus de +3 Perception (odorat). Accès libre à la mutation Crocs.', 
    NULL, 
    0, 0, 1, 0, 0, 0, -- CON +1
    0, 0, 0, 0,       
    0, 0, 0, 0, 0, 0, 
    NULL, NULL, NULL, NULL, NULL
);

-- Caractère reptilien
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_008', 
    'Caractère reptilien', 
    'Aspect animal. Bonus de +3 Perception (odorat via langue bifide). Capacité à se faufiler.', 
    NULL, 
    0, 1, 0, 0, 0, 0, -- COO +1
    0, 0, 3, 0,       -- Evasion +3
    0, 0, 0, 0, 0, 0, 
    NULL, NULL, NULL, NULL, NULL
);

-- Caractère simiesque
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_009', 
    'Caractère simiesque', 
    'Aspect animal. Accès libre à la mutation Queue.', 
    NULL, 
    1, 1, 0, 0, 0, 0, -- FOR +1, COO +1
    0, 3, 0, 0,       -- Escalade +3
    0, 0, 0, 0, 0, 0, 
    NULL, NULL, NULL, NULL, NULL
);
-- Contact corrosif
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_010', 
    'Contact corrosif', 
    'Sécrétion corrosive (1D10 dégâts). Dure 3D6 tours sauf si nettoyé. Indépendant des autres actions.', 
    NULL, 
    0, 0, 0, 0, 0, 0, 
    0, 0, 0, 0, 
    0, 0, 0, 0, 0, 0, 
    'Contact corrosif', '1D10', NULL, 
    3, 'degats_physiques' -- Ajoute +3 aux dégâts à chaque nouveau niveau
);

-- Contagion
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_011', 
    'Contagion', 
    'Porteur sain de maladies (Grippe bleue). Immunité totale aux maladies. Virulence selon difficulté : +0 (1D6), -3 (2D6), -5 (3D6), -7 (4D6), -10 (5D6).', 
    'Contagion', 
    0, 0, 0, 0, 0, 0, 
    0, 0, 0, 0, 
    0, 0, 0, 0, 3, 0, -- Bonus de +3 (ou immunité) en Résistance Maladie
    NULL, NULL, NULL, 
    NULL, NULL
);
-- Corne
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_012', 
    'Corne', 
    'Petite corne frontale. Utilisable après une saisie. +1D6 Choc si le coup porte à la tête.', 
    NULL, 
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 
    'Corne', '1D10', '1D6', 
    NULL, NULL
);

-- Crocs
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_013', 
    'Crocs', 
    'Dents tranchantes. Utilisable après une saisie.', 
    NULL, 
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 
    'Crocs', '1D10+3', NULL, 
    NULL, NULL
);
-- Difformité légère
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_014', 
    'Difformité légère', 
    'Difformité physique au choix du joueur et du MJ. Malus cumulatif.', 
    NULL, 
    0, 0, 0, -1, 0, 0, -- PRE -1
    0, 0, 0, 0, 
    0, 0, 0, 0, 0, 0, 
    NULL, NULL, NULL, 
    NULL, NULL
);

-- Difformité importante
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_015', 
    'Difformité importante', 
    'Difformité physique majeure au choix du joueur et du MJ. Malus cumulatif.', 
    NULL, 
    0, 0, 0, -2, 0, 0, -- PRE -2
    0, 0, 0, 0, 
    0, 0, 0, 0, 0, 0, 
    NULL, NULL, NULL, 
    NULL, NULL
);

-- Empathie
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_016', 
    'Empathie', 
    'Accès à la compétence Empathie (VOL/PRE). Permet de ressentir/modifier les émotions. Portée : Corail (-7), Animaux (-3), Humains (Volonté cible / 2).', 
    'Empathie', 
    0, 0, 0, 0, 0, 0, 
    0, 0, 0, 0, 
    0, 0, 0, 0, 0, 0, 
    NULL, NULL, NULL, 
    NULL, NULL
);
-- Excroissance osseuse rétractable
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_017', 
    'Excroissance osseuse rétractable', 
    'Une lame osseuse jaillit de l’avant-bras. S’utilise avec la compétence Combat à mains nues.', 
    NULL, 
    0, 0, 0, 0, 0, 0, 
    0, 0, 0, 0, 
    0, 0, 0, 0, 0, 0, 
    'Excroissance osseuse', '2D10', NULL, 
    NULL, NULL
);

-- Griffes
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_018', 
    'Griffes', 
    'Armes naturelles. Malus de -3 pour les tests impliquant une dextérité manuelle (crochetage, vol, etc.).', 
    NULL, 
    0, 0, 0, 0, 0, 0, 
    0, 3, 0, 0,       -- Escalade +3
    0, 0, 0, 0, 0, 0, 
    'Griffes', '1D10+3', NULL, 
    NULL, NULL
);
-- Instabilité moléculaire
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_019', 
    'Instabilité moléculaire', 
    'En cas d’échec critique (96-00), le personnage se dématérialise pendant 1D10 min. Il ne peut plus agir ni subir de dégâts physiques, mais peut subir des attaques mentales/Polaris.', 
    NULL, 
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 
    NULL, NULL, NULL, 
    NULL, NULL
);

-- Métamorphe
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_020', 
    'Métamorphe', 
    'Peut modifier son apparence et sa structure. Permet de déplacer jusqu’à 2 points d’Attributs (ex: -1 FOR / +1 COO). Nécessite 1D10 tours de concentration.', 
    'Métamorphe', 
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 
    NULL, NULL, NULL, 
    NULL, NULL
);
-- Nictope
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_021', 
    'Nictope', 
    'Le personnage voit parfaitement dans le noir. En revanche, il est ébloui par toute lumière vive (malus de -5 à toutes ses actions).', 
    NULL, 
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 
    NULL, NULL, NULL, 
    NULL, NULL
);

-- Ouïe fine
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_022', 
    'Ouïe fine', 
    'Le personnage entend des sons inaudibles pour les autres. Bonus de +3 aux tests de Perception basés sur l’ouïe.', 
    NULL, 
    0, 0, 0, 0, 0, 0, -- Bonus de perception situationnel, donc en description
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 
    NULL, NULL, NULL, 
    NULL, NULL
);

-- Peau renforcée
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_023', 
    'Peau renforcée', 
    'La peau est couverte de plaques cornées ou d’écailles. Offre une protection naturelle. Cumulable : chaque sélection supplémentaire ajoute +2 à l’armure.', 
    NULL, 
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 
    3, 0, 0, 0, 0, 0, -- Base : Armure +3
    NULL, NULL, NULL, 
    2, 'res_armure'   -- Stack : +2 en Armure si reprise
);

-- Peau visqueuse
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_024', 
    'Peau visqueuse', 
    'La peau sécrète un mucus glissant. Bonus de +3 pour se libérer d’une saisie ou se faufiler.', 
    NULL, 
    0, 0, 0, 0, 0, 0, 
    0, 0, 3, 0, -- Bonus Évasion +3
    0, 0, 0, 0, 0, 0, 
    NULL, NULL, NULL, 
    NULL, NULL
);
-- Purulence
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_025', 
    'Purulence', 
    'Peau couverte de bubons et plaies suintantes. Très contagieux. Bonus de +3 en Résistance aux maladies.', 
    NULL, 
    0, 0, 0, -2, 0, 0, -- PRE -2
    0, 0, 0, 0, 
    0, 0, 0, 0, 3, 0,  -- Résistance Maladies +3
    NULL, NULL, NULL, 
    NULL, NULL
);

-- Queue
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_026', 
    'Queue', 
    'Queue d’environ 1m. Améliore l’équilibre. Peut être utilisée pour saisir un objet léger.', 
    NULL, 
    0, 0, 0, 0, 0, 0, 
    3, 0, 0, 0,       -- Acrobatie/Équilibre +3
    0, 0, 0, 0, 0, 0, 
    NULL, NULL, NULL, 
    NULL, NULL
);

-- Régénération
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_027', 
    'Régénération', 
    'Récupération de 1 pt de Vie / heure. Bonus de +3 aux tests de résistance contre l’infection. Les membres perdus repoussent en 1D10 semaines.', 
    NULL, 
    0, 0, 0, 0, 0, 0, 
    0, 0, 0, 0, 
    0, 0, 0, 0, 0, 0, 
    NULL, NULL, NULL, 
    NULL, NULL
);

-- Résistance naturelle
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_028', 
    'Résistance naturelle', 
    'Résistance accrue à un élément spécifique (Feu, Froid, Drogues, etc.). Bonus de +3 à chaque sélection.', 
    NULL, 
    0, 0, 0, 0, 0, 0, 
    0, 0, 0, 0, 
    0, 0, 0, 0, 0, 0, 
    NULL, NULL, NULL, 
    3, NULL -- Stack de +3, mais la colonne cible dépend du choix du joueur (Feu, Froid, etc.)
);
-- Sensibilité au Polaris
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_029', 
    'Sensibilité au Polaris', 
    'Débloque l’accès aux pouvoirs du Polaris. Permet l’achat de toute compétence liée à la Force ou à l’Écho Polaris.', 
    'Maîtrise de l’Écho Polaris, Maîtrise de la Force Polaris', 
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 
    NULL, NULL, NULL, 
    NULL, NULL
);

-- Sixième sens
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_030', 
    'Sixième sens', 
    'Le personnage ne peut jamais être surpris. Il ressent le danger imminent.', 
    NULL, 
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 
    NULL, NULL, NULL, 
    NULL, NULL
);

-- Sonar
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_031', 
    'Sonar', 
    'Émission d’ultrasons permettant de repérer les formes et les volumes, même dans le noir total ou l’eau trouble. Portée : 100m (air) / 500m (eau).', 
    'Sonar', 
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 
    NULL, NULL, NULL, 
    NULL, NULL
);

-- Squelette renforcé
INSERT INTO mutations (
    muta_numero, nom, description, linked_skill, 
    mod_for, mod_coo, mod_con, mod_pre, mod_vol, mod_per,
    mod_acrobatie, mod_escalade, mod_evasion, mod_discretion,
    res_armure, res_choc, res_feu, res_froid, res_drogue_maladie, res_radiation,
    nom_arme_naturelle, degats_physiques, degats_choc,
    stack_mod_val, stack_target_col
) VALUES (
    'muta_032', 
    'Squelette renforcé', 
    'Les os sont plus denses ou doublés de métal/cartilage. Bonus de +2 en Résistance Dommages et +3 en Résistance Choc. Cumulable : +1 à chaque résistance par sélection supplémentaire.', 
    NULL, 
    0, 0, 0, 0, 0, 0, 
    0, 0, 0, 0, 
    2, 3, 0, 0, 0, 0, -- Res_Armure +2, Res_Choc +3
    'Coup de poing renforcé', '1D6', '1D10', -- Arme naturelle implicite (os plus durs)
    1, 'MULTI' -- Cas spécial : stack de +1 sur plusieurs colonnes
);