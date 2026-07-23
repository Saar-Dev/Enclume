SYSTEME/PERSONNAGE_CALCULS.md — Chaîne de calcul des personnages

    Dernière mise à jour : 2026-07-19
    Sources : shared/polarisUtils.js, server/src/lib/charStats.js
    Lire pour : comprendre où sont les calculs d'attributs, compétences, seuils et résistances.
    Voir aussi : @PERSONNAGE_API pour les routes, @BLESSURES pour les blessures, @SERVICES_COMBAT pour les dégâts.

1. Où sont les calculs ?

Deux fichiers, un point d'entrée unique.
text

shared/polarisUtils.js        ← Calculs purs, partagés client/serveur. Source de vérité.
    ├── calcNA, calcAN, polarisRound
    ├── calcREA, calcSeuils, calcSouffle
    ├── calcResistanceDommages, calcResistanceNaturelle
    ├── calcAllures
    └── Création : calcSkillCost, calcAttributCost, getAgeEffects, etc.
    
server/src/lib/charStats.js   ← Couche serveur. Utilise polarisUtils.js en interne.
    ├── calcAttributeNA, calcAttributeAN (fetch les attr, appelle polarisUtils)
    ├── calcSkillTotal (idem)
    ├── calcResistanceArmure (mille-feuille ETQ/PRT)
    ├── calcWoundPenalty, calcEncumbrancePenalty
    ├── getShockMalus, getModDom
    ├── calcDroneRD, calcDroneDegatsNets
    └── Constantes : ATTR_LABELS, MOD_DOM_TABLE, etc.

Règle : polarisUtils.js = fonctions mathématiques pures. charStats.js = fonctions qui agrègent les données (fetch des attributs, lookup tables) avant d'appeler polarisUtils. Si une fonction existe dans les deux, polarisUtils est la source.
2. Hiérarchie des appels
text

Attributs :
  char_attributes (base_level, pc_modifier)
    → getGenotypeModForAttr(ref_genotypes)
    → getMutationModForAttr(char_mutation_effects_view)
    → calcNA → calcAN
    → calcAttributeNA / calcAttributeAN (charStats.js, wrapper serveur)

Compétences :
  char_skills (mastery) + ref_skills (attr_1, attr_2)
    → calcAttributeAN ×2 + mastery
    → calcSkillTotal (charStats.js)

Dérivées :
  NA × plusieurs → calcREA, calcSeuils, calcSouffle, etc.
  → polarisUtils.js uniquement, pas de wrapper charStats (import direct)

3. Exemple concret : calculer le total de Piratage
js

// 1. Fetch des données (responsabilité du caller)
const attrs     = await db('char_attributes').where({ char_sheet_id }).select('*')
const charSkill = await db('char_skills').where({ char_sheet_id, skill_id: 'PIRATAGE' }).first()
const refSkill  = await db('ref_skills').where({ id: 'PIRATAGE' }).first()
const archetype = await db('char_archetype').where({ char_sheet_id }).first()
const genotype  = await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
const mutEff    = await getMutationEffects(sheetId)

// 2. Calcul (charStats.js)
const total = calcSkillTotal(attrs, charSkill, refSkill, genotype, mutEff)
// → AN(attr_1) + AN(attr_2) + mastery

Piège : calcSkillTotal attend attrs (tableau), charSkillRow (objet ou null), refSkill (objet), genotypeRow (objet ou null), mutationEffectsRow (objet ou null). Cinq sources de données différentes. Si l'une est manquante, le calcul est faux silencieusement. Le caller est responsable du fetch complet.
4. Fonctions clés par domaine
Attributs
Fonction	Fichier	Rôle
calcNA(base, pc, mod_gen, mod_mut)	polarisUtils	Niveau d'Attribut (plancher 3)
calcAN(na)	polarisUtils	Aptitude Naturelle (table AN_TABLE)
calcAttributeNA(attrs, id, geno, mut)	charStats	Wrapper serveur : fetch attr + appel calcNA
getGenotypeModForAttr(row, id)	polarisUtils	Modificateur de génotype
getMutationModForAttr(row, id)	polarisUtils	Modificateur de mutation
getAdvantageModForAttr(rows, key)	polarisUtils	Modificateur d'avantage (paires clé/valeur)
Compétences
Fonction	Fichier	Rôle
calcSkillTotal(attrs, charSkill, refSkill, geno, mut)	charStats	Total de compétence
calcSkillCost(id, current, target, isPro, isLearned, refs)	polarisUtils	Coût XP pour monter une compétence
getCoutAugmentation(current)	charStats	Coût pour +1 niveau
getCoutDeblocageX()	charStats	Coût déblocage compétence (X)
Dérivées
Fonction	Fichier	Rôle
calcREA(ada, per, mod_adv)	polarisUtils	Réactivité
calcSeuils(for, con, vol, mod_mut, mod_adv)	polarisUtils	Étourdissement / Inconscience
calcSouffle(con, vol, mod_adv)	polarisUtils	Souffle
calcResistanceDommages(for, con, mod_mut, mod_adv)	polarisUtils	RD (positif = faible)
calcResistanceNaturelle(result_na)	polarisUtils	Résistance naturelle
calcAllures(coo, athletisme)	charStats	Allures de déplacement
Combat
Fonction	Fichier	Rôle
calcResistanceArmure(items)	charStats	Mille-feuille ETQ/PRT
getModDom(for_na)	charStats	Modificateur de dommages CaC
getShockMalus(severity, location, is_lethal)	charStats	Malus au Test de Choc
calcWoundPenalty(wounds)	charStats	Malus blessures (pire seule)
calcEncumbrancePenalty(weight, for, mult)	charStats	Malus encombrement
5. Pièges
Code	Description
P-NA	calcNA a un plancher 3. Ne pas faire base_level + pc_modifier sans passer par cette fonction.
P-AN	calcAN utilise polarisRound (arrondi 0.4). Ne pas confondre avec Math.round.
P-MUT	Les mutations utilisent des colonnes fixes (mod_FOR). Les avantages utilisent des paires mod_attribute/mod_value. Systèmes différents.
P-ADV	mod_value des avantages porte déjà son signe. Ne pas inspecter type pour l'inverser.
P-RD	calcResistanceDommages retourne une valeur à ajouter aux dégâts (positif = faiblesse). Ne pas soustraire.
P-RD-DRONE	calcDroneRD utilise integrite × 2 comme entrée. Haute intégrité → RD négatif → plus vulnérable. Contre-intuitif.
P-MILLE	calcResistanceArmure = max + reste/2. Plusieurs couches sur le même slot ne s'additionnent pas.
P-SKILL	calcSkillTotal nécessite 5 sources de données. Un fetch incomplet → calcul faux silencieux.
P-WOUND	Blessures : seule la pire est retenue (LdB p.236). calcWoundPenalty applique cette règle.
P-ENCUM	Encombrement : seuls les items hors Coffre comptent. calcEncumbrancePenalty ne filtre pas — le caller doit exclure le Coffre avant.