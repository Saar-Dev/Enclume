/**
 * Migration 91 — char : ref_mutations v2 (partie 1/3)
 *
 * Crée la table ref_mutations avec la structure enrichie et fusionnée :
 *   - mod_sens JSONB (modificateurs conditionnels fusionnés)
 *   - immunites TEXT[] (immunités fusionnées)
 *   - Dégâts en TEXT (standard du projet)
 *
 * Partie 1/3 : structure + mutations muta_001 à muta_017
 */

const MUTATIONS_PART1 = [
  // ─── muta_001 : Adaptation extérieure ───
  {
    muta_numero: "muta_001",
    nom: "Adaptation extérieure",
    description: "Résistance aux effets néfastes de la Surface (radiations, acidité de l'air, altération moléculaire…). Le niveau de la compétence indique le nombre d'heures d'exposition possible. Après exposition, nécessite un repos de 3x la durée passée à l'extérieur.",
    categorie: "pouvoir",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: "Adaptation extérieure", skill_attributs: null, skill_depart: "X",
    skill_cout: "normal", skill_plafond: null,
    skill_description: "Le niveau indique le nombre d'heures d'exposition possible à la Surface.",
    capacite_speciale: null,
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: null, est_officiel: true
  },

  // ─── muta_002 : Amphibie ───
  {
    muta_numero: "muta_002",
    nom: "Amphibie",
    description: "Respiration sous-marine. Supporte pression et froid sous-marins. Profondeur max : (niveau Hybride) × 500 m. Ne peut dépasser Constitution en mètres de profondeur si niveau Hybride < 1. Maîtrise limitée au niveau +0.",
    categorie: "physique",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: ["froid", "pression"],
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: "Hybride", skill_attributs: "CON/COO", skill_depart: "-3",
    skill_cout: "normal", skill_plafond: "+0",
    skill_description: "Respiration sous-marine, supporte pression et froid. Profondeur max = niveau × 500 m. Limité à Constitution en mètres si niveau < 1.",
    capacite_speciale: "Respiration sous-marine",
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 126, est_officiel: true
  },

  // ─── muta_003 : Androgyne ───
  {
    muta_numero: "muta_003",
    nom: "Androgyne",
    description: "Physiquement, le personnage tient des deux sexes.",
    categorie: "physique",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: null,
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 126, est_officiel: true
  },

  // ─── muta_004 : Asexué ───
  {
    muta_numero: "muta_004",
    nom: "Asexué",
    description: "Le personnage est né sans sexe. Le personnage est donc stérile.",
    categorie: "physique",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: "Stérile",
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 126, est_officiel: true
  },

  // ─── muta_005 : Autofécondation ───
  {
    muta_numero: "muta_005",
    nom: "Autofécondation",
    description: "Le personnage ne possède pas d'organes reproducteurs mais peut s'autoféconder et mettre un enfant au monde.",
    categorie: "physique",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: "Autofécondation",
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 126, est_officiel: true
  },

  // ─── muta_006 : Caractère félin ───
  {
    muta_numero: "muta_006",
    nom: "Caractère félin",
    description: "Aspect animal félin : morphologie altérée, fourrure légère, traits félins. COO +2, immunité au vertige, +3 Acrobatie/Équilibre. Griffes et Vision nocturne à -1 PC.",
    categorie: "physique",
    mod_for: 0, mod_coo: 2, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 3, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: ["vertige"],
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: "Caractère génétique animal (félin).",
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: "caractere_animal", conditions_achat: null,
    reduction_achat_cible: ["muta_018", "muta_021"], reduction_achat_valeur: -1,
    tirage_exclusion: null,
    source_livre_page: 126, est_officiel: true
  },

  // ─── muta_007 : Caractère canin ───
  {
    muta_numero: "muta_007",
    nom: "Caractère canin",
    description: "Aspect animal canin : morphologie altérée, fourrure légère, traits canins. CON +1, +3 Perception (odorat). Accès libre à la mutation Crocs.",
    categorie: "physique",
    mod_for: 0, mod_coo: 0, mod_con: 1, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: { odorat: 3 },
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: "Caractère génétique animal (canin). Accès libre à Crocs.",
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: "caractere_animal", conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 126, est_officiel: true
  },

  // ─── muta_008 : Caractère reptilien ───
  {
    muta_numero: "muta_008",
    nom: "Caractère reptilien",
    description: "Aspect animal reptilien : peau écailleuse, traits reptiliens. COO +1, +3 Perception (odorat via langue bifide), +3 Évasion. Se faufile dans les espaces étroits.",
    categorie: "physique",
    mod_for: 0, mod_coo: 1, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 3, mod_discretion: 0,
    mod_sens: { odorat: 3 },
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: "Caractère génétique animal (reptilien). Se faufile dans les espaces étroits.",
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: "caractere_animal", conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 126, est_officiel: true
  },

  // ─── muta_009 : Caractère simiesque ───
  {
    muta_numero: "muta_009",
    nom: "Caractère simiesque",
    description: "Aspect animal simiesque : morphologie altérée, pilosité accrue, traits simiesques. FOR +1, COO +1, +3 Escalade. Accès libre à la mutation Queue.",
    categorie: "physique",
    mod_for: 1, mod_coo: 1, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 3, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: "Caractère génétique animal (simiesque). Accès libre à Queue.",
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: "caractere_animal", conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 126, est_officiel: true
  },

  // ─── muta_010 : Contact corrosif ───
  {
    muta_numero: "muta_010",
    nom: "Contact corrosif",
    description: "La peau sécrète à volonté une substance corrosive qui inflige 1D10 points de Dommages à tout ce qui entre en contact avec elle. +3 dégâts par prise supplémentaire. La substance continue d'infliger des dommages pendant 3D6 Tours de combat, tant qu'elle n'est pas nettoyée (eau ou substance neutralisante). Les dommages sont indépendants de toute autre action offensive.",
    categorie: "combat",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: "Contact corrosif", arme_degats_base: "1D10", arme_degats_choc: null,
    arme_portee: "contact", arme_condition: "À volonté. Dure 3D6 tours sauf si nettoyé (eau ou substance neutralisante).", arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: "Dégâts indépendants de toute autre action offensive.",
    stackable: true, stack_mod_valeur: 3, stack_cibles: ["arme_degats_base"],
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 126, est_officiel: true
  },

  // ─── muta_011 : Contagion ───
  {
    muta_numero: "muta_011",
    nom: "Contagion",
    description: "Le personnage est nourri des bactéries qui vivent en symbiose avec lui. Il est totalement immunisé contre les maladies. La contagion est invisible (contrairement à Purulence). Si non contrôlée, tout contact avec la peau transmet la Grippe bleue. Virulence selon la Difficulté du Test : +0 (1D6), -3 (2D6), -5 (3D6), -7 (4D6), -10 (5D6). La victime développe la maladie en 2D6 heures (moins le MR).",
    categorie: "pouvoir",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 3, res_drogue: 3, res_radiation: 0,
    immunites: ["maladies"],
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: "Contagion", skill_attributs: "CON/VOL", skill_depart: "X",
    skill_cout: "double", skill_plafond: null,
    skill_description: "Permet de contrôler la contamination. Si le Test est réussi, le personnage peut choisir de contaminer ou non. Virulence : voir description.",
    capacite_speciale: "Porteur sain de maladies. Immunisé aux maladies. Contagion invisible et permanente si non contrôlée.",
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 126, est_officiel: true
  },

  // ─── muta_012 : Corne ───
  {
    muta_numero: "muta_012",
    nom: "Corne",
    description: "Petite corne sur le front. Lors d'un combat au corps à corps, après avoir effectué une saisie, le personnage peut donner un coup de tête infligeant 1D10 points de dommage de base (plus le Modificateur de dommages en corps à corps), plus 1D6 points de dommages additionnels de Choc si le coup porte à la tête.",
    categorie: "combat",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: "Corne", arme_degats_base: "1D10", arme_degats_choc: "1D6",
    arme_portee: "contact", arme_condition: "Après une saisie réussie. Le Choc s'applique si le coup porte à la tête.", arme_competence_associee: "Combat à mains nues",
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: null,
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 126, est_officiel: true
  },

  // ─── muta_013 : Crocs ───
  {
    muta_numero: "muta_013",
    nom: "Crocs",
    description: "Le personnage est doté de crocs ou ses dents sont extrêmement tranchantes. Lors d'un combat au corps à corps, après avoir effectué une saisie, il peut mordre son adversaire en infligeant 1D10+3 points de dommage de base (plus le Modificateur de dommages en corps à corps).",
    categorie: "combat",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: "Crocs", arme_degats_base: "1D10+3", arme_degats_choc: null,
    arme_portee: "contact", arme_condition: "Après une saisie réussie.", arme_competence_associee: "Combat à mains nues",
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: null,
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 126, est_officiel: true
  },

  // ─── muta_014 : Difformité légère ───
  {
    muta_numero: "muta_014",
    nom: "Difformité légère",
    description: "Difformité physique légère au choix du joueur et du MJ. Présence -1. Les malus sont cumulatifs si le personnage possède plusieurs difformités.",
    categorie: "handicap",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: -1, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: "Au choix du joueur et du MJ.",
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 126, est_officiel: true
  },

  // ─── muta_015 : Difformité importante ───
  {
    muta_numero: "muta_015",
    nom: "Difformité importante",
    description: "Difformité physique importante au choix du joueur et du MJ. Présence -2. Les malus sont cumulatifs si le personnage possède plusieurs difformités.",
    categorie: "handicap",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: -2, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: "Au choix du joueur et du MJ.",
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 126, est_officiel: true
  },

  // ─── muta_016 : Empathie ───
  {
    muta_numero: "muta_016",
    nom: "Empathie",
    description: "Accès à la Compétence spéciale Empathie (VOL/PRE, -3) à coût doublé. Permet de communiquer avec des créatures empathiques comme le corail (Très difficile, -7) et de ressentir les émotions des animaux (Assez difficile, -3). Pour ressentir les émotions d'un individu, Test avec un malus égal à la Volonté de la cible divisée par deux. Peut tenter de modifier les émotions via un Test d'opposition contre la Volonté de la cible. La Marge de réussite indique le nombre de Tours de combat. En cas d'échec critique, la cible détecte l'intrusion. Émotions modifiées étape par étape, sans interruption. Lieux imprégnés : Presque impossible (-13).",
    categorie: "pouvoir",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: "Empathie", skill_attributs: "VOL/PRE", skill_depart: "-3",
    skill_cout: "double", skill_plafond: null,
    skill_description: "Ressentir/modifier les émotions. Corail -7, Animaux -3, Humains (VOL cible / 2). Modification : Test opposé VOL. Échec critique → cible alertée.",
    capacite_speciale: "Ne pas confondre avec la Compétence Analyse empathique (accessible à tous).",
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 126, est_officiel: true
  },

  // ─── muta_017 : Excroissance osseuse rétractable ───
  {
    muta_numero: "muta_017",
    nom: "Excroissance osseuse rétractable",
    description: "Le personnage peut faire jaillir d'un de ses avant-bras une excroissance osseuse. L'arme s'utilise avec la Compétence Combat à mains nues et inflige 2D10 points de dommages de base (plus le modificateur de dommages au corps à corps).",
    categorie: "combat",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: "Excroissance osseuse", arme_degats_base: "2D10", arme_degats_choc: null,
    arme_portee: "contact", arme_condition: "Jaillit de l'avant-bras à volonté.", arme_competence_associee: "Combat à mains nues",
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: "Arme rétractable.",
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 126, est_officiel: true
  }
];

export const up = async (knex) => {
  await knex.schema.dropTableIfExists('ref_mutations');

  await knex.schema.createTable('ref_mutations', (table) => {
    table.text('muta_numero').primary();
    table.text('nom').notNullable();
    table.text('description').defaultTo(null);
    table.text('categorie').defaultTo(null);
    table.integer('mod_for').defaultTo(0);
    table.integer('mod_coo').defaultTo(0);
    table.integer('mod_con').defaultTo(0);
    table.integer('mod_pre').defaultTo(0);
    table.integer('mod_vol').defaultTo(0);
    table.integer('mod_per').defaultTo(0);
    table.integer('mod_acrobatie').defaultTo(0);
    table.integer('mod_escalade').defaultTo(0);
    table.integer('mod_evasion').defaultTo(0);
    table.integer('mod_discretion').defaultTo(0);
    table.jsonb('mod_sens').defaultTo(null);
    table.integer('res_armure').defaultTo(0);
    table.integer('res_choc').defaultTo(0);
    table.integer('res_feu').defaultTo(0);
    table.integer('res_froid').defaultTo(0);
    table.integer('res_poison').defaultTo(0);
    table.integer('res_maladie').defaultTo(0);
    table.integer('res_drogue').defaultTo(0);
    table.integer('res_radiation').defaultTo(0);
    table.specificType('immunites', 'text[]').defaultTo(null);
    table.text('arme_nom').defaultTo(null);
    table.text('arme_degats_base').defaultTo(null);
    table.text('arme_degats_choc').defaultTo(null);
    table.text('arme_portee').defaultTo(null);
    table.text('arme_condition').defaultTo(null);
    table.text('arme_competence_associee').defaultTo(null);
    table.text('skill_nom').defaultTo(null);
    table.text('skill_attributs').defaultTo(null);
    table.text('skill_depart').defaultTo(null);
    table.text('skill_cout').defaultTo(null);
    table.text('skill_plafond').defaultTo(null);
    table.text('skill_description').defaultTo(null);
    table.text('capacite_speciale').defaultTo(null);
    table.boolean('stackable').defaultTo(false);
    table.integer('stack_mod_valeur').defaultTo(null);
    table.specificType('stack_cibles', 'text[]').defaultTo(null);
    table.text('groupe_exclusion').defaultTo(null);
    table.text('conditions_achat').defaultTo(null);
    table.specificType('reduction_achat_cible', 'text[]').defaultTo(null);
    table.integer('reduction_achat_valeur').defaultTo(null);
    table.specificType('tirage_exclusion', 'text[]').defaultTo(null);
    table.integer('source_livre_page').defaultTo(null);
    table.boolean('est_officiel').defaultTo(true);
  });

  await knex('ref_mutations').insert(MUTATIONS_PART1);
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('ref_mutations');
};

const MUTATIONS_PART2 = [
  // ─── muta_018 : Griffes ───
  {
    muta_numero: "muta_018",
    nom: "Griffes",
    description: "Le personnage est doté de griffes. Il peut attaquer avec et infliger 1D10+3 points de dommages de base (plus le modificateur de dommages au corps à corps). Bonus de +3 en Escalade quand il peut utiliser ses griffes. Malus de -3 lors des Tests impliquant une certaine dextérité manuelle (crocheter une porte, voler un portefeuille, etc.).",
    categorie: "combat",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: { escalade: 3, dexterite_manuelle: -3 },
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: "Griffes", arme_degats_base: "1D10+3", arme_degats_choc: null,
    arme_portee: "contact", arme_condition: null, arme_competence_associee: "Combat à mains nues",
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: "Bonus Escalade conditionnel (griffes utilisables). Malus dextérité manuelle.",
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 127, est_officiel: true
  },

  // ─── muta_019 : Instabilité moléculaire ───
  {
    muta_numero: "muta_019",
    nom: "Instabilité moléculaire",
    description: "Accès à la Compétence spéciale Contrôle moléculaire (CON/VOL) à coût doublé. Permet de se transformer en magma de matière informe (masse équivalente). Transformation : 2D10 Tours de combat. Peut se déplacer lentement, glisser sous des portes, conscient via le toucher. Création d'organes : auditif (-3), visuel (-5), tentacule (-7, FOR 3, manipulation uniquement). Sous l'eau : pas d'effet de la pression. Reprise de forme : ≤10 min (-3), ≤1h (-7), +1/h suppl. (-1). Le MR de transformation réduit ces malus. Échec : difficulté +1, si impossible → perte définitive de 1 FOR ou CON, puis nouvelle tentative comme <10 min. Stress important : Test ou transformation involontaire.",
    categorie: "pouvoir",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: ["pression"],
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: "Contrôle moléculaire", skill_attributs: "CON/VOL", skill_depart: "X",
    skill_cout: "double", skill_plafond: null,
    skill_description: "Transformation en magma. Création d'organes : auditif -3, visuel -5, tentacule -7. Reprise de forme : voir description.",
    capacite_speciale: "Transformation en magma. Immunisé à la pression sous l'eau sous forme de magma.",
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 127, est_officiel: true
  },

  // ─── muta_020 : Métamorphe ───
  {
    muta_numero: "muta_020",
    nom: "Métamorphe",
    description: "Accès à la Compétence spéciale Métamorphose (CON/VOL, -3) à coût doublé. Permet de prendre l'apparence physique d'un individu (apparence seulement, pas les Attributs ni Compétences). Pour reproduire les manières (démarche, gestes, timbre de voix), Test de Déguisement/Imitation avec le Bonus de réussite du Test de Métamorphose. Ne peut pas prendre une forme non humanoïde. Ne peut pas s'approprier les Attributs et Compétences du personnage imité.",
    categorie: "pouvoir",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: "Métamorphose", skill_attributs: "CON/VOL", skill_depart: "-3",
    skill_cout: "double", skill_plafond: null,
    skill_description: "Prendre l'apparence physique d'un humanoïde. Les manières nécessitent un Test de Déguisement/Imitation avec le Bonus de réussite de Métamorphose.",
    capacite_speciale: "Apparence physique uniquement. Forme humanoïde obligatoire. Attributs et Compétences inchangés.",
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 127, est_officiel: true
  },

  // ─── muta_021 : Vision nocturne ───
  {
    muta_numero: "muta_021",
    nom: "Vision nocturne",
    description: "Le personnage voit parfaitement bien la nuit, tant qu'il existe une quelconque source lumineuse, aussi faible soit-elle. Par contre, il ne voit rien dans les ténèbres totales.",
    categorie: "sensorielle",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: "Vision nocturne si une source lumineuse existe. Aveugle dans le noir total.",
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 128, est_officiel: true
  },

  // ─── muta_022 : Ouïe fine ───
  {
    muta_numero: "muta_022",
    nom: "Ouïe fine",
    description: "Le personnage entend des sons inaudibles pour les autres. Bonus de +3 aux tests de Perception basés sur l'ouïe.",
    categorie: "sensorielle",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: { ouie: 3 },
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: null,
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 128, est_officiel: true
  },

  // ─── muta_023 : Peau renforcée ───
  {
    muta_numero: "muta_023",
    nom: "Peau renforcée",
    description: "La peau du personnage, sombre et râpeuse, lui permet de bénéficier d'une armure naturelle égale à 3 points. Il peut ajouter 2 points supplémentaires à chaque fois qu'il subit de nouveau cette mutation.",
    categorie: "physique",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 3, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: "Armure naturelle.",
    stackable: true, stack_mod_valeur: 2, stack_cibles: ["res_armure"],
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 127, est_officiel: true
  },

  // ─── muta_024 : Peau visqueuse ───
  {
    muta_numero: "muta_024",
    nom: "Peau visqueuse",
    description: "La peau sécrète un mucus glissant. Bonus de +3 pour se libérer d'une saisie ou se faufiler.",
    categorie: "physique",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 3, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: null,
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 128, est_officiel: true
  },

  // ─── muta_025 : Purulence ───
  {
    muta_numero: "muta_025",
    nom: "Purulence",
    description: "La peau est couverte de pustules. Le personnage est en permanence rongé par des maladies et des parasites. Présence -2. Malus de -5 aux Tests d'interactions sociales si l'apparence est visible. Résistance aux maladies +3. Contagieux une semaine tous les trois mois (Grippe bleue). Si reprise : Présence -1 supplémentaire, Résistance maladies +2. Peut être maîtrisée via la Compétence Purulence (CON/VOL, X, coût normal). Utilisable comme arme : Test de Purulence vs Constitution cible, 3D10 Dommages physiques + MR. Si la cible survit, risque de Grippe bleue. Si elle meurt, cadavre contagieux.",
    categorie: "handicap",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: -2, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: { interaction_sociale: -5 },
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 3, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: "Purulence", arme_degats_base: "3D10", arme_degats_choc: null,
    arme_portee: "contact", arme_condition: "Contact peau à peau. Test de Purulence vs Constitution cible. La cible risque la Grippe bleue si elle survit.", arme_competence_associee: null,
    skill_nom: "Purulence", skill_attributs: "CON/VOL", skill_depart: "X",
    skill_cout: "normal", skill_plafond: null,
    skill_description: "Contrôler les périodes de contamination. Un Test/jour, malus cumulatif de -1 par jour sans contagion. Utilisable comme arme (3D10 + MR).",
    capacite_speciale: "Contagieux par périodes (1 semaine / 3 mois). Apparence masquée recommandée.",
    stackable: true, stack_mod_valeur: null, stack_cibles: ["mod_pre", "res_maladie"],
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 127, est_officiel: true
  },

  // ─── muta_026 : Queue ───
  {
    muta_numero: "muta_026",
    nom: "Queue",
    description: "Le personnage est doté d'une queue. Il peut apprendre à manipuler des objets avec sa queue et même à attaquer avec ou à s'en servir comme d'un membre normal. La Compétence Agilité caudale (COO/COO, coût normal) agit comme une Compétence limitative pour : Acrobatie/Équilibre, Armes de poing (petites armes), Combat armé (petites armes blanches, sans modificateur de dommages), Combat à mains nues (1D10/2 + modificateur).",
    categorie: "physique",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 3, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: "Queue", arme_degats_base: "1D10/2", arme_degats_choc: null,
    arme_portee: "contact", arme_condition: "Nécessite la Compétence Agilité caudale.", arme_competence_associee: "Agilité caudale",
    skill_nom: "Agilité caudale", skill_attributs: "COO/COO", skill_depart: "X",
    skill_cout: "normal", skill_plafond: null,
    skill_description: "Compétence limitative pour Acrobatie/Équilibre, Armes de poing, Combat armé (petites armes), Combat à mains nues (queue : 1D10/2).",
    capacite_speciale: "Manipulation d'objets avec la queue. Peut servir de membre normal.",
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 128, est_officiel: true
  },

  // ─── muta_027 : Régénération ───
  {
    muta_numero: "muta_027",
    nom: "Régénération",
    description: "Le personnage régénère plus rapidement ses blessures (ne permet pas de récupérer un membre ou un organe détruit). Bonus de +2 aux Tests de stabilisation des blessures (pour le soigneur). Bonus de +3 aux Tests contre l'infection. Durée de guérison divisée par deux. Si reprise : bonus +1 supplémentaire, durée de guérison divisée par trois. Doit manger et boire deux fois plus qu'un individu normal, sinon 1D10+3 points de Dommages physiques en fin de journée.",
    categorie: "physique",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 3, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: "Bonus stabilisation +2, bonus infection +3, guérison ÷2. Mange/boit 2x plus. Cumulable : bonus +1, guérison ÷3. Ne récupère pas les membres/organes détruits.",
    stackable: true, stack_mod_valeur: 1, stack_cibles: ["res_maladie"],
    groupe_exclusion: "parasite_symbiote_regen",
    conditions_achat: "Maximum 2 mutations parmi Parasite, Symbiote et Régénération.",
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 128, est_officiel: true
  },

  // ─── muta_028 : Résistance au feu ───
  {
    muta_numero: "muta_028",
    nom: "Résistance au feu",
    description: "Réduit de 3 points les Dommages physiques dus au feu. Insensible aux effets de la chaleur. +3 par prise supplémentaire.",
    categorie: "physique",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 3, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: ["chaleur"],
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: "Insensible à la chaleur.",
    stackable: true, stack_mod_valeur: 3, stack_cibles: ["res_feu"],
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 128, est_officiel: true
  },

  // ─── muta_028b : Résistance au froid ───
  {
    muta_numero: "muta_028b",
    nom: "Résistance au froid",
    description: "Réduit de 3 points les Dommages physiques dus au froid. Insensible aux effets du froid jusqu'à -10°C. +3 par prise supplémentaire.",
    categorie: "physique",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 3,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: ["froid"],
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: "Insensible au froid jusqu'à -10°C.",
    stackable: true, stack_mod_valeur: 3, stack_cibles: ["res_froid"],
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 128, est_officiel: true
  },

  // ─── muta_028c : Résistance aux drogues ───
  {
    muta_numero: "muta_028c",
    nom: "Résistance aux drogues",
    description: "La Résistance aux drogues du personnage est augmentée de 3 points. +1 par prise supplémentaire.",
    categorie: "physique",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 3, res_radiation: 0,
    immunites: null,
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: null,
    stackable: true, stack_mod_valeur: 1, stack_cibles: ["res_drogue"],
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 128, est_officiel: true
  },

  // ─── muta_028d : Résistance aux maladies ───
  {
    muta_numero: "muta_028d",
    nom: "Résistance aux maladies",
    description: "La Résistance aux maladies du personnage est augmentée de 3 points. +1 par prise supplémentaire.",
    categorie: "physique",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 3, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: null,
    stackable: true, stack_mod_valeur: 1, stack_cibles: ["res_maladie"],
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 128, est_officiel: true
  },

  // ─── muta_028e : Résistance aux poisons ───
  {
    muta_numero: "muta_028e",
    nom: "Résistance aux poisons",
    description: "La Résistance au poison du personnage est augmentée de 3 points. +1 par prise supplémentaire.",
    categorie: "physique",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 3, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: null,
    stackable: true, stack_mod_valeur: 1, stack_cibles: ["res_poison"],
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 128, est_officiel: true
  },

  // ─── muta_028f : Résistance aux radiations ───
  {
    muta_numero: "muta_028f",
    nom: "Résistance aux radiations",
    description: "La Résistance aux radiations du personnage est augmentée de 3 points. +1 par prise supplémentaire.",
    categorie: "physique",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 3,
    immunites: null,
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: null,
    stackable: true, stack_mod_valeur: 1, stack_cibles: ["res_radiation"],
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 128, est_officiel: true
  },

  // ─── muta_030 : Sixième sens ───
  {
    muta_numero: "muta_030",
    nom: "Sixième sens",
    description: "Le personnage bénéficie d'un bonus de +3 à ses Tests de Réaction, en cas de Surprise. Le personnage ne peut jamais être surpris.",
    categorie: "sensorielle",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: { reaction_surprise: 3 },
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: ["surprise"],
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: null,
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 128, est_officiel: true
  },

  // ─── muta_031 : Sonar ───
  {
    muta_numero: "muta_031",
    nom: "Sonar",
    description: "Le personnage est doté d'une sorte de sonar qui lui permet de repérer des obstacles sous l'eau ou dans le noir. Portée = Intelligence en mètres. Peut libérer une onde sonique utilisable comme arme (2D10, modificateurs du combat à distance), aussi bien sous l'eau qu'à l'air libre.",
    categorie: "sensorielle",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: "Sonar", skill_attributs: "PER/PER", skill_depart: "X",
    skill_cout: "normal", skill_plafond: null,
    skill_description: "Portée = INT en mètres. Onde sonique : 2D10, modificateurs du combat à distance. DEV : l'onde sonique doit créer un emplacement d'arme sur la fiche personnage.",
    capacite_speciale: "Repérage des obstacles dans le noir ou sous l'eau.",
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 128, est_officiel: true
  }
];

export const up = async (knex) => {
  await knex('ref_mutations').insert(MUTATIONS_PART2);
};

export const down = async (knex) => {
  await knex('ref_mutations')
    .whereIn('muta_numero', MUTATIONS_PART2.map(m => m.muta_numero))
    .delete();
};

const MUTATIONS_PART3 = [
  // ─── muta_032 : Squelette renforcé ───
  {
    muta_numero: "muta_032",
    nom: "Squelette renforcé",
    description: "La Résistance aux dommages du personnage est augmentée de 2 points, et sa Résistance au Choc de 3 points. +1 à chaque résistance par prise supplémentaire.",
    categorie: "physique",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 2, res_choc: 3, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: null,
    stackable: true, stack_mod_valeur: 1, stack_cibles: ["res_armure", "res_choc"],
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 128, est_officiel: true
  },

  // ─── muta_033 : Radiation ───
  {
    muta_numero: "muta_033",
    nom: "Radiation",
    description: "Accès à la Compétence spéciale Radiations (CON/VOL, -3) à coût doublé. Permet de libérer un flot de radiations dans l'organisme d'une victime par simple contact. Intensité : 2D6 points d'irradiation (plus le modificateur de réussite). +3 points par prise supplémentaire. Offre gratuitement la mutation Résistance aux radiations.",
    categorie: "pouvoir",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: "Radiations", arme_degats_base: "2D6", arme_degats_choc: null,
    arme_portee: "contact", arme_condition: "Irradiation. Test de Radiations.", arme_competence_associee: "Radiations",
    skill_nom: "Radiations", skill_attributs: "CON/VOL", skill_depart: "-3",
    skill_cout: "double", skill_plafond: null,
    skill_description: "Libérer un flot de radiations par contact. Intensité : 2D6 + MR. +3 par prise supplémentaire.",
    capacite_speciale: "Offre gratuitement la mutation Résistance aux radiations (muta_028f).",
    stackable: true, stack_mod_valeur: 3, stack_cibles: ["arme_degats_base"],
    groupe_exclusion: null,
    conditions_achat: "Offre gratuitement la mutation Résistance aux radiations (muta_028f).",
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 127, est_officiel: true
  },

  // ─── muta_034 : Organe sensoriel manquant ───
  {
    muta_numero: "muta_034",
    nom: "Organe sensoriel manquant",
    description: "Le personnage est né avec un organe sensoriel en moins. Les effets sont semblables à ceux du Désavantage inné Sens diminué, mais la pénalité est de -5 (au lieu de -3). Si le personnage est affligé à la fois de cette mutation et du Désavantage Sens diminué, les pénalités se cumulent.",
    categorie: "handicap",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: { sens: -5 },
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: "Organe sensoriel manquant au choix du joueur/MJ. Cumulable avec Sens diminué.",
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 127, est_officiel: true
  },

  // ─── muta_035 : Organe sensoriel supplémentaire ou amélioré ───
  {
    muta_numero: "muta_035",
    nom: "Organe sensoriel supplémentaire ou amélioré",
    description: "Le personnage est né avec un organe sensoriel en plus ou des capacités sensorielles améliorées. Les effets sont semblables à ceux de l'Avantage inné Sens développé, mais le bonus est de +5 (au lieu de +3). Si le personnage possède à la fois cette mutation et l'Avantage Sens développé, les bonus se cumulent.",
    categorie: "sensorielle",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: { sens: 5 },
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: "Organe sensoriel supplémentaire ou amélioré au choix du joueur/MJ. Cumulable avec Sens développé.",
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 127, est_officiel: true
  },

  // ─── muta_036 : Parasite ───
  {
    muta_numero: "muta_036",
    nom: "Parasite",
    description: "Le personnage abrite 1D4 parasites. Il doit boire et manger deux fois plus qu'un individu normal. Les parasites réduisent sa résistance aux Dommages physiques de 1 point tous les deux parasites. Une fois par semaine (ou par aventure), il subit 1D10 + (nombre de parasites) points de Dommages (aussi s'il ne mange pas assez). Chaque parasite octroie une mutation supplémentaire aléatoire (voir tirage_exclusion). Retrait : -1 Constitution définitive tous les deux parasites enlevés. Maximum 2 mutations parmi Parasite, Symbiote et Régénération.",
    categorie: "handicap",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: "1D4 parasites. Mange/boit 2x plus. -1 résistance Dommages / 2 parasites. Attaque 1D10+N / semaine. Chaque parasite → 1 mutation aléatoire. Retrait → -1 CON / 2 parasites.",
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: "parasite_symbiote_regen",
    conditions_achat: "Maximum 2 mutations parmi Parasite, Symbiote et Régénération.",
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: [
      "muta_038", "muta_037", "muta_026", "muta_036",
      "muta_034", "muta_019", "muta_018", "muta_017",
      "muta_014", "muta_015", "muta_013", "muta_012",
      "muta_004", "muta_003"
    ],
    source_livre_page: 127, est_officiel: true
  },

  // ─── muta_037 : Symbiote ───
  {
    muta_numero: "muta_037",
    nom: "Symbiote",
    description: "Le corps du personnage abrite 1D4 symbiotes. Il doit se nourrir et boire deux fois plus qu'un individu normal, sinon 1D10 + (nombre de symbiotes) points de Dommages en fin de journée. Chaque symbiote offre au choix : +2 dans une Résistance naturelle OU une mutation supplémentaire aléatoire (voir tirage_exclusion). Retrait : -1 Constitution définitive tous les deux symbiotes enlevés. Maximum 2 mutations parmi Parasite, Symbiote et Régénération.",
    categorie: "physique",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: "1D4 symbiotes. Mange/boit 2x plus. Attaque 1D10+N / jour si pas assez mangé. Chaque symbiote → +2 Résistance naturelle (au choix) OU 1 mutation aléatoire. Retrait → -1 CON / 2 symbiotes.",
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: "parasite_symbiote_regen",
    conditions_achat: "Maximum 2 mutations parmi Parasite, Symbiote et Régénération.",
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: [
      "muta_038", "muta_037", "muta_026", "muta_036",
      "muta_034", "muta_019", "muta_018", "muta_017",
      "muta_014", "muta_015", "muta_013", "muta_012",
      "muta_004", "muta_003"
    ],
    source_livre_page: 128, est_officiel: true
  },

  // ─── muta_038 : Tentacule rétractable ───
  {
    muta_numero: "muta_038",
    nom: "Tentacule rétractable",
    description: "Le personnage peut faire jaillir de son organisme un tentacule dont il peut se servir comme d'un nouveau membre.",
    categorie: "physique",
    mod_for: 0, mod_coo: 0, mod_con: 0, mod_pre: 0, mod_vol: 0, mod_per: 0,
    mod_acrobatie: 0, mod_escalade: 0, mod_evasion: 0, mod_discretion: 0,
    mod_sens: null,
    res_armure: 0, res_choc: 0, res_feu: 0, res_froid: 0,
    res_poison: 0, res_maladie: 0, res_drogue: 0, res_radiation: 0,
    immunites: null,
    arme_nom: null, arme_degats_base: null, arme_degats_choc: null,
    arme_portee: null, arme_condition: null, arme_competence_associee: null,
    skill_nom: null, skill_attributs: null, skill_depart: null,
    skill_cout: null, skill_plafond: null, skill_description: null,
    capacite_speciale: "Tentacule utilisable comme un nouveau membre. DEV : détails et statistiques gérés par le backend.",
    stackable: false, stack_mod_valeur: null, stack_cibles: null,
    groupe_exclusion: null, conditions_achat: null,
    reduction_achat_cible: null, reduction_achat_valeur: null,
    tirage_exclusion: null,
    source_livre_page: 128, est_officiel: true
  }
];

export const up = async (knex) => {
  await knex('ref_mutations').insert(MUTATIONS_PART3);
};

export const down = async (knex) => {
  await knex('ref_mutations')
    .whereIn('muta_numero', MUTATIONS_PART3.map(m => m.muta_numero))
    .delete();
};