// shared/careerRandomEffectsData.js — Lot 6 (PLAN_WIZARD_AVANTAGES_IMPLANTATION.md §5bis/§5quater) :
// traduction des tables "Avantages professionnels aléatoires" (docs/REGLES/AVANTAGES ALEATOIRE.md,
// 1D10 par métier) en effects[] JSONB (vocabulaire shared/careerAdvantages.js). Source unique —
// importée par la migration qui peuple ref_career_random_benefits.effects ET par
// shared/careerRandomEffectsData.test.mjs (aucune duplication entre migration et tests).
//
// `chasseur_primes` (migration 188) est déjà mécanisé — NE PAS le dupliquer ici, seul son résultat 4
// est corrigé séparément (migration dédiée, §5quater : le résultat était appliqué sans le choix
// accepte/refuse tranché depuis dans le plan).
//
// Convention de traduction (vérifiée ligne par ligne contre le texte RAW, pas seulement contre le
// résumé "effet en clair" du plan — deux erreurs de transcription trouvées ce faisant, cf. §5quater) :
//   - "doublé/triplé POUR l'année" (ponctuel) -> income_multiplier (value 2 ou 3, jamais permanent).
//   - "doublé/triplé/augmenté de X% À PARTIR DE cette année" (permanent) :
//     - un pourcentage explicite (10/20/50%) -> income_percent (additif, s'accumule).
//     - un multiplicateur explicite (doublé/triplé) -> income_multiplier_permanent (plafonné, ne se
//       recompose jamais) — 16 cas trouvés au total (15 déjà connus + Voleur/Criminel résultat 7,
//       "revenus doublés à partir de cette année", non catalogué jusqu'ici).
//   - "Allié ou Fournisseur +1" (Assassin résultat 8) : un seul trait_type 'ally' — "Fournisseur"
//     n'est qu'une variante narrative du même gain, jamais un type distinct (décision Saar 2026-07-23).
//   - "L'un de ses Alliés reçoit gratuitement Groupe/Gang" (Barman/3, Chasseur de primes/8) :
//     narratif seul, aucun effet chiffré (confirmé Saar).
//   - "Qu'il accepte ou non, mêmes effets chiffrés" (Hybride/4, Officier naval/3, Sous-marinier/3,
//     Docker/9) : implémenté comme un `choice` réel (même effets numériques dans les deux options,
//     seule la clé narrative diffère) — décision Saar 2026-07-23 : garder le choix pour la trace
//     narrative même si le résultat mécanique est identique.
//   - Technicien/Mécanicien résultat 5 ("Contact", grande entreprise) : le RAW ne répète pas
//     explicitement "sinon aucun effet" (contrairement aux 3 autres "grande société") — décision
//     Saar 2026-07-23 : effet appliqué à plat pour tous, jamais un choix inventé sans base textuelle.
//   - "Formation : ajoute une Compétence au choix" (20/37 métiers) -> `skill_choice` (nouveau,
//     Lot 6) — la liste des compétences éligibles vient de `ref_career_skills`, jamais figée ici.
//   - Prêtre du Trident résultat 4 ("Acrobatie/Équilibre, Combat armé" — RAW confirmé, "Combat au
//     contact" est ambigu mais Saar tranche `COMBAT_ARME`) -> `add_skill` (nouveau, Lot 6) : les 2
//     compétences sont FIXES, pas un choix joueur, contrairement à "Formation".
//   - Prêtre du Trident résultats 5/6, branche "accepte" : harmonisé avec les 15 (16) autres cas
//     `income_multiplier_permanent` (décision Saar 2026-07-23 — le RAW ne répète pas la clause "on ne
//     triple pas" ici, mais aucune raison de traiter ce cas différemment des autres).
//   - Pirate résultat 8 ("Transfert génétique") : le plan disait à tort "Groupe/Gang narratif" —
//     RAW réel = Célébrité +6, Relations +4, Allié +2 (aucun rapport, erreur de copier-coller
//     trouvée en relecture critique 2026-07-23).
//
// Catégories d'Avantages pro (`ref_career_point_categories.category`) : chaînes exactes vérifiées en
// base par métier (piège 3, PLAN_WIZARD_AVANTAGES_IMPLANTATION.md) — notamment "Cache/Planque"
// (Voleur/Criminel) ≠ "Planque/Cache" (Assassin/Contrebandier/Espion), jamais interchangées.

const ALLY = (value = 1, note) => ({ type: 'trait', trait_type: 'ally', op: 'gauge_delta', value, ...(note ? { note } : {}) })
const CONTACT = (value = 1) => ({ type: 'trait', trait_type: 'contact', op: 'gauge_delta', value })
const ENEMY = (value = 1, note) => ({ type: 'trait', trait_type: 'enemy', op: 'gauge_delta', value, ...(note ? { note } : {}) })
const OPPONENT = (value = 1) => ({ type: 'trait', trait_type: 'opponent', op: 'gauge_delta', value })
const CAT = (target, value) => ({ type: 'category', target, value })
const ATTR = (target, value = 1) => ({ type: 'attribute', target, value })
const SKP = (value) => ({ type: 'skill_points', value })
const CEL = (value) => ({ type: 'celebrity', value })
const PCT = (value) => ({ type: 'income_percent', value })
const MULT = (value) => ({ type: 'income_multiplier', value })
const PERM = (value) => ({ type: 'income_multiplier_permanent', value })
const NARR = (key) => ({ type: 'narrative', key })
const SKILL_CHOICE = () => ({ type: 'skill_choice' })

export const CAREER_RANDOM_EFFECTS_BY_CODE = {

  artisan_artiste: {
    1: [ATTR('INT')],
    2: [SKP(1), CAT('Art/Artisanat', 2), CEL(2)],
    3: [MULT(2), CEL(4), SKP(2), CAT('Art/Artisanat', 2), CAT('Relations', 1)],
    4: [PCT(10), CEL(2), CAT('Étal/Boutique', 2), CAT('Relations', 1)],
    5: [CEL(4), CAT('Art/Artisanat', 6), PCT(20), CAT('Étal/Boutique', 1), ALLY(1)],
    6: [MULT(3), CEL(6), SKP(4), CAT('Relations', 2)],
    7: [CEL(4), CAT('Art/Artisanat', 6), PCT(10), CONTACT(1)],
    8: [CEL(8), PCT(50), SKP(2)],
    9: [MULT(3), CAT('Art/Artisanat', 4)],
    10: [],
  },

  assassin: {
    1: [ATTR('ADA')],
    2: [SKP(1), CEL(2), CAT('Falsification', 2), CAT('Corruption/Chantage', 2)],
    3: [NARR('assassin.secret')],
    4: [CAT('Corruption/Chantage', 6)],
    5: [SKP(2), CEL(4), CAT('Falsification', 4), CAT('Corruption/Chantage', 4)],
    6: [CAT('Falsification', 6)],
    7: [CAT('Fausse identité', 6)],
    8: [CEL(5), PCT(10), CAT('Relations', 2), ALLY(1)],
    9: [CAT('Relations', 6)],
    10: [],
  },

  barman: {
    1: [ATTR('VOL')],
    2: [SKP(2), CEL(1), CAT('Bar', 2)],
    3: [NARR('barman.groupe_gang')],
    4: [CEL(4), CAT('Relations', 2), ALLY(1), PCT(10)],
    5: [MULT(2), CAT('Bar', 1)],
    6: [CAT('Stock de marchandises', 4), CAT('Relations', 1), PCT(10)],
    7: [CAT('Relations', 8)],
    8: [PCT(20), CAT('Relations', 2), CAT('Stock de marchandises', 3)],
    9: [NARR('barman.secret')],
    10: [],
  },

  contrebandier: {
    1: [ATTR('ADA')],
    2: [SKP(1), CEL(2), CAT('Stock de marchandises', 2)],
    3: [SKP(2), CEL(4), CAT('Stock de marchandises', 4), MULT(2)],
    4: [CEL(2), PCT(10), CAT('Relations', 3)],
    5: [CEL(4), PCT(20), CAT('Relations', 5), ALLY(1)],
    6: [CAT('Relations', 1), CAT('Corruption/Chantage', 4), CAT('Planque/Cache', 1)],
    7: [CAT('Relations', 1), CAT('Falsification', 4)],
    8: [CAT('Relations', 6)],
    9: [CAT('Cache à marchandises', 4), CAT('Planque/Cache', 4)],
    10: [],
  },

  cultivateur_eleveur: {
    1: [ATTR('CON')],
    2: [SKP(2), CEL(2), CAT('Parcelle/Ferme', 2)],
    3: [PCT(10), CEL(2), SKP(2), CAT('Parcelle/Ferme', 2)],
    4: [{ type: 'grant_mutation', mutation_id: 13, subtype_id: null }],
    5: [NARR('cultivateur_eleveur.dauphin')],
    6: [ALLY(1), CAT('Relations', 2), PCT(10)],
    7: [MULT(2), SKP(2), CAT('Parcelle/Ferme', 1)],
    8: [CAT('Parcelle/Ferme', 6), PCT(10)],
    9: [PCT(20), SKP(2), CEL(2), CAT('Parcelle/Ferme', 2)],
    10: [],
  },

  diplomate: {
    1: [ATTR('PRE')],
    2: [SKP(2), CEL(3), CAT('Corruption/Chantage', 2), CAT('Cabine privée', 1)],
    3: [SKP(4), CEL(4), ALLY(1), ENEMY(2), CAT('Relations', 2), CAT('Corruption/Chantage', 3)],
    4: [SKP(6), CEL(6), ALLY(1), ENEMY(2), CAT('Relations', 4), CAT('Corruption/Chantage', 2), CAT('Cabine privée', 2)],
    5: [{
      type: 'choice', key: 'diplomate_corruption',
      options: [
        { label: 'Refuser (incorruptible)', effects: [CEL(6), ALLY(2), CAT('Relations', 4), ENEMY(1)] },
        { label: 'Accepter', effects: [MULT(2), CAT('Relations', 2), CAT('Corruption/Chantage', 2), CAT('Cabine privée', 1)] },
      ],
    }],
    6: [CAT('Relations', 6)],
    7: [CAT('Cabine privée', 6)],
    8: [CEL(2), MULT(2), ALLY(1), CAT('Relations', 4)],
    9: [NARR('diplomate.secret')],
    10: [],
  },

  erudit_archeologue: {
    1: [ATTR('INT')],
    2: [SKP(2), CEL(3), CAT('Bases de données', 2)],
    3: [SKP(4), CEL(4), ALLY(1), ENEMY(2), CAT('Relations', 4), CAT('Bases de données', 4)],
    4: [{
      type: 'choice', key: 'erudit_opposants_ou_ennemi',
      options: [
        { label: '3 Opposants', effects: [SKP(6), CEL(6), ALLY(1), OPPONENT(3), CAT('Relations', 4), CAT('Bases de données', 6)] },
        { label: '1 Ennemi', effects: [SKP(6), CEL(6), ALLY(1), ENEMY(1), CAT('Relations', 4), CAT('Bases de données', 6)] },
      ],
    }],
    5: [SKP(2), CEL(2), ALLY(1), MULT(2), PCT(20), CAT('Bases de données', 4)],
    6: [SKP(3), CEL(4), ALLY(2), PCT(10), CAT('Bases de données', 6)],
    7: [CAT('Relations', 6)],
    8: [CAT('Cabine privée', 6)],
    9: [CAT('Bases de données', 8)],
    10: [],
  },

  espion: {
    1: [ATTR('ADA')],
    2: [NARR('espion.agent_double')],
    3: [NARR('espion.secret')],
    4: [CAT('Corruption/Chantage', 6)],
    5: [SKP(2), CEL(4), CAT('Falsification', 4), CAT('Corruption/Chantage', 4)],
    6: [CAT('Falsification', 6)],
    7: [CAT('Fausse identité', 6)],
    8: [SKP(1), CEL(2), CAT('Falsification', 2), CAT('Corruption/Chantage', 2)],
    9: [CAT('Relations', 6)],
    10: [],
  },

  hybride_trident: {
    1: [ATTR('COO')],
    2: [SKP(2), CEL(2)],
    3: [NARR('hybride_trident.mammifere_marin')],
    4: [{
      type: 'choice', key: 'hybride_trident_soleil_noir',
      options: [
        { label: 'Accepter le Soleil noir', effects: [NARR('hybride_trident.soleil_noir_accepte'), MULT(2), CAT('Relations', 2), ALLY(1), ENEMY(1)] },
        { label: 'Refuser', effects: [NARR('hybride_trident.soleil_noir_refuse'), MULT(2), CAT('Relations', 2), ALLY(1), ENEMY(1)] },
      ],
    }],
    5: [MULT(2), SKP(3), CEL(3)],
    6: [MULT(3), SKP(4), CEL(4)],
    7: [PERM(2), SKP(6), CEL(6)],
    8: [SKILL_CHOICE(), SKP(2), CAT('Relations', 1)],
    9: [ALLY(2), CAT('Relations', 4)],
    10: [],
  },

  marchand: {
    1: [ATTR('INT')],
    2: [SKP(2), CEL(2), CAT('Stock de marchandises', 2)],
    3: [PCT(10), CEL(2), CAT('Étal/Boutique', 2), CAT('Relations', 1)],
    4: [MULT(2), CEL(4), SKP(4), CAT('Stock de marchandises', 4)],
    5: [MULT(3), CAT('Stock de marchandises', 4)],
    6: [ALLY(1), CAT('Relations', 6)],
    7: [ALLY(1), CAT('Relations', 6), CAT('Stock de marchandises', 4)],
    8: [CAT('Stock de marchandises', 6)],
    9: [CAT('Étal/Boutique', 6), PCT(10)],
    10: [],
  },

  marchand_itinerant: {
    1: [ATTR('ADA')],
    2: [SKP(2), CEL(2), CAT('Stock de marchandises', 2)],
    3: [NARR('marchand_itinerant.secret')],
    4: [{ type: 'money_reward', die: '1d100', multiplier: 500 }],
    5: [ALLY(1), CEL(2), CAT('Relations', 4)],
    6: [MULT(3), CAT('Stock de marchandises', 4)],
    // RAW : "Réseau +6, Allié +1, Relation +2" — "Réseau" n'est pas une catégorie distincte pour ce
    // métier (DB : Stock de marchandises/Célébrité/Relations/Matériel), même correction que Voleur
    // résultat 4 : Réseau = Relations, cumulé avec le +2 explicite (total +8).
    7: [CAT('Relations', 8), ALLY(1)],
    8: [CAT('Stock de marchandises', 6)],
    9: [MULT(2), CEL(4), SKP(4), CAT('Stock de marchandises', 4)],
    10: [],
  },

  medecin_chirurgien: {
    1: [ATTR('INT')],
    2: [SKP(2), CEL(2), CAT('Pharmacie personnelle', 2)],
    3: [PCT(10), CEL(4), CAT('Cabinet médical', 2)],
    4: [{
      type: 'choice', key: 'medecin_grande_societe',
      options: [
        { label: 'Accepter', effects: [PCT(20), CEL(4), SKP(3), CAT('Cabinet médical', 2)] },
        { label: 'Refuser', effects: [NARR('medecin.grande_societe_refuse')] },
      ],
    }],
    5: [{
      type: 'choice', key: 'medecin_trafiquants',
      options: [
        { label: 'Accepter', effects: [MULT(4)] },
        { label: 'Refuser', effects: [NARR('medecin.trafiquants_refuse')] },
      ],
    }],
    6: [SKP(2), CEL(4), MULT(2), CAT('Cabinet médical', 2), ALLY(1), CAT('Relations', 2)],
    7: [PCT(10), CEL(6), CAT('Cabinet médical', 4), ALLY(1), CAT('Relations', 2)],
    8: [SKP(5), MULT(2), CAT('Pharmacie personnelle', 2)],
    9: [CAT('Pharmacie personnelle', 6), CAT('Base de données médicales', 4)],
    10: [],
  },

  mercenaire: {
    1: [ATTR('CON')],
    2: [SKP(2), CEL(2), CAT('Matériel', 1)],
    3: [PCT(10), CEL(4), CAT('Matériel', 2)],
    4: [{
      type: 'choice', key: 'mercenaire_grande_societe',
      options: [
        { label: 'Accepter', effects: [PCT(20), CEL(4), SKP(4)] },
        { label: 'Refuser', effects: [NARR('mercenaire.grande_societe_refuse')] },
      ],
    }],
    5: [SKP(4), CEL(4), MULT(2)],
    6: [CEL(2), CAT('Relations', 6)],
    7: [CAT('Matériel', 6)],
    8: [ALLY(1), CAT('Relations', 2)],
    9: [MULT(2), CEL(2), CAT('Matériel', 2)],
    10: [],
  },

  mineur: {
    1: [ATTR('FOR')],
    2: [NARR('mineur.concession_non_exploitee')],
    3: [SKP(2), CEL(2), CAT('Matériel', 2)],
    4: [PCT(10), CEL(4), CAT('Concession', 2)],
    5: [MULT(2), CEL(2), CAT('Matériel', 2)],
    6: [ALLY(2), CAT('Relations', 4)],
    7: [CAT('Matériel', 6), CAT('Concession', 2)],
    8: [PCT(20), CEL(2)],
    9: [CAT('Concession', 6)],
    10: [],
  },

  officier_naval_civil: {
    1: [ATTR('INT')],
    2: [MULT(2), SKP(3), CEL(3), CAT('Matériel', 2)],
    3: [{
      type: 'choice', key: 'officier_naval_confrerie',
      options: [
        { label: 'Rejoindre la confrérie pirate', effects: [NARR('officier_naval.confrerie_accepte'), SKP(3), CAT('Relations', 2), CEL(3)] },
        { label: 'Refuser', effects: [NARR('officier_naval.confrerie_refuse'), SKP(3), CAT('Relations', 2), CEL(3)] },
      ],
    }],
    4: [MULT(2), CEL(2), CAT('Matériel', 2)],
    5: [NARR('officier_naval.secret_carte')],
    6: [ALLY(2), CAT('Relations', 4)],
    7: [PCT(20), ALLY(1), CAT('Relations', 3), CAT('Matériel', 2)],
    8: [SKILL_CHOICE(), SKP(2), CAT('Relations', 1)],
    9: [ALLY(3), CAT('Relations', 6)],
    10: [],
  },

  officier_militaire_souterrain: {
    1: [ATTR('VOL')],
    2: [SKP(2), CEL(2), CAT('Matériel', 1)],
    3: [MULT(2), SKP(3), CEL(3), CAT('Matériel', 2)],
    4: [MULT(3), SKP(4), CEL(4), CAT('Matériel', 3)],
    5: [PERM(2), SKP(6), CEL(6), CAT('Matériel', 4)],
    6: [SKP(1), CEL(1)],
    7: [SKILL_CHOICE(), SKP(2), CAT('Relations', 1)],
    8: [ALLY(1), CAT('Relations', 2)],
    9: [ALLY(2), CAT('Relations', 4)],
    10: [],
  },

  ouvrier_docker: {
    1: [ATTR('FOR')],
    2: [SKP(2), CEL(2)],
    3: [PCT(10), CEL(4), CAT('Matériel', 2)],
    4: [ALLY(2), CAT('Relations', 4)],
    5: [MULT(2), CEL(2), CAT('Matériel', 2)],
    6: [CAT('Matériel', 6)],
    7: [PCT(20), CAT('Matériel', 2)],
    8: [SKILL_CHOICE(), SKP(2), CAT('Relations', 1)],
    9: [{
      type: 'choice', key: 'docker_pirates',
      options: [
        { label: 'Rejoindre les pirates', effects: [NARR('docker.pirates_accepte'), SKP(3), CAT('Relations', 2), CEL(3)] },
        { label: 'Refuser', effects: [NARR('docker.pirates_refuse'), SKP(3), CAT('Relations', 2), CEL(3)] },
      ],
    }],
    10: [],
  },

  pilote_chasse_sous_marin: {
    1: [ATTR('ADA')],
    2: [SKP(2), CEL(2), CAT('Matériel', 1)],
    3: [MULT(2), SKP(3), CEL(3), CAT('Matériel', 2)],
    4: [MULT(3), SKP(4), CEL(4), CAT('Matériel', 3)],
    5: [PERM(2), SKP(6), CEL(6), CAT('Matériel', 4)],
    6: [SKP(1), CEL(1)],
    7: [SKILL_CHOICE(), SKP(2), CAT('Relations', 1)],
    8: [ALLY(1), CAT('Relations', 2)],
    9: [ALLY(2), CAT('Relations', 4)],
    10: [],
  },

  pirate: {
    1: [ATTR('VOL')],
    2: [SKP(2), CEL(2), CAT('Matériel', 2), CAT('Corruption/Chantage', 2)],
    // `[CORRIGÉ 2026-07-23, 2e passe critique]` RAW : "100 x 1D10 sols supplémentaires, Célébrité +2,
    // Matériel +2" — CEL/Matériel manquants dans la 1ère traduction (seul le money_reward avait été
    // repris), trouvé en revérifiant chaque ligne à mécanisme spécial (money_reward/celebrity_reward/
    // grant_mutation/add_skill) contre le texte RAW plutôt que contre le résumé.
    3: [{ type: 'money_reward', die: '1d10', multiplier: 100 }, CEL(2), CAT('Matériel', 2)],
    4: [PERM(2), SKP(4), CEL(4), CAT('Matériel', 4)],
    5: [CEL(6), { type: 'celebrity_reward', multiplier: 1000 }],
    6: [NARR('pirate.carte')],
    7: [{
      type: 'choice', key: 'pirate_code',
      options: [
        { label: 'Respecter le code', effects: [NARR('pirate.code_respecte'), CEL(4), ALLY(1), CAT('Relations', 4)] },
        { label: 'Violer le code', effects: [NARR('pirate.code_viole'), CEL(4), ALLY(1), CAT('Relations', 4)] },
      ],
    }],
    // `[CORRIGÉ 2026-07-23]` "Transfert génétique" — le plan disait à tort "Groupe/Gang narratif"
    // (copié depuis Barman/3 ou Chasseur de primes/8), RAW réel sans rapport.
    8: [CEL(6), CAT('Relations', 4), ALLY(2)],
    9: [MULT(2), CEL(4), CAT('Matériel', 2)],
    10: [],
  },

  policier_enqueteur: {
    1: [ATTR('INT')],
    2: [MULT(2), SKP(3), CEL(3)],
    3: [SKP(1), CEL(1)],
    4: [MULT(3), SKP(4), CEL(4)],
    5: [PERM(2), SKP(6), CEL(6)],
    6: [CAT('Relations', 8)],
    7: [CAT('Corruption/Chantage', 4), MULT(2), ENEMY(1, 'abus_de_position')],
    8: [SKILL_CHOICE(), SKP(2), CAT('Relations', 1)],
    9: [ALLY(2), CAT('Relations', 4)],
    10: [],
  },

  pretre_trident: {
    1: [ATTR('VOL')],
    2: [SKP(2), CEL(2), CAT('Cabine privée', 2)],
    3: [SKP(4), CEL(4), CAT('Cabine privée', 4)],
    // "Combat au contact" (RAW littéral, ambigu) -> COMBAT_ARME (décision Saar 2026-07-23).
    4: [{ type: 'add_skill', skill_id: 'ACROBATIE_EQUILIBRE' }, { type: 'add_skill', skill_id: 'COMBAT_ARME' }, CEL(2), SKP(4)],
    5: [{
      type: 'choice', key: 'pretre_traitre',
      // Harmonisé avec les 15 (16) autres cas income_multiplier_permanent (décision Saar 2026-07-23) —
      // le RAW ne répète pas "on ne triple pas" ici mais aucune raison de traiter différemment.
      options: [
        { label: 'Accepter (travailler pour le traître)', effects: [PERM(2), CAT('Matériel', 4)] },
        { label: 'Refuser', effects: [MULT(2), CAT('Cabine privée', 2), CAT('Relations', 2), ALLY(1), ENEMY(1)] },
      ],
    }],
    // "Les effets sont similaires à Traître" (RAW littéral) — même structure que résultat 5.
    6: [{
      type: 'choice', key: 'pretre_soleil_noir',
      options: [
        { label: 'Rejoindre le Soleil noir', effects: [PERM(2), CAT('Matériel', 4)] },
        { label: 'Décliner', effects: [MULT(2), CAT('Cabine privée', 2), CAT('Relations', 2), ALLY(1), ENEMY(1)] },
      ],
    }],
    7: [CAT('Relations', 6)],
    8: [SKILL_CHOICE(), SKP(2), CAT('Relations', 1)],
    9: [SKP(2), CAT('Matériel', 4), CAT('Cabine privée', 4), MULT(2)],
    10: [],
  },

  prostitue: {
    1: [ATTR('PRE')],
    2: [SKP(2), CEL(2), CAT('Corruption/Chantage', 2)],
    3: [SKP(4), CAT('Cabine privée', 2), CEL(2), PCT(20)],
    4: [{
      type: 'choice', key: 'prostitue_espionnage',
      options: [
        { label: 'Accepter', effects: [PCT(10), SKP(2), CAT('Matériel', 4), CAT('Cabine privée', 4)] },
        { label: 'Refuser', effects: [NARR('prostitue.espionnage_refuse')] },
      ],
    }],
    5: [ALLY(1), CEL(4), CAT('Cabine privée', 4)],
    6: [PCT(50)],
    7: [MULT(2), CEL(1), SKP(2)],
    8: [NARR('prostitue.secret')],
    9: [ALLY(2), CAT('Relations', 4)],
    10: [],
  },

  scientifique_ingenieur: {
    1: [ATTR('INT')],
    2: [SKP(2), CEL(3), CAT('Bases de données', 2)],
    3: [SKP(4), CEL(4), ALLY(1), ENEMY(2), CAT('Relations', 4), CAT('Bases de données', 4)],
    4: [{
      type: 'choice', key: 'scientifique_opposants_ou_ennemi',
      options: [
        { label: '3 Opposants', effects: [SKP(6), CEL(6), ALLY(1), OPPONENT(3), CAT('Relations', 4), CAT('Bases de données', 6)] },
        { label: '1 Ennemi', effects: [SKP(6), CEL(6), ALLY(1), ENEMY(1), CAT('Relations', 4), CAT('Bases de données', 6)] },
      ],
    }],
    5: [SKP(2), CEL(2), ALLY(1), MULT(2), PCT(20), CAT('Bases de données', 4)],
    6: [SKP(3), CEL(4), ALLY(2), PCT(10), CAT('Bases de données', 6)],
    7: [CAT('Relations', 6)],
    8: [CAT('Cabine privée', 6)],
    9: [SKILL_CHOICE(), SKP(2), CAT('Relations', 1)],
    10: [],
  },

  soldat_milicien: {
    1: [ATTR('VOL')],
    2: [SKP(2), CEL(2), CAT('Matériel', 1)],
    3: [MULT(2), SKP(3), CEL(3), CAT('Matériel', 2)],
    4: [MULT(3), SKP(4), CEL(4), CAT('Matériel', 3)],
    5: [PERM(2), SKP(6), CEL(6), CAT('Matériel', 4)],
    6: [SKP(1), CEL(1)],
    7: [SKILL_CHOICE(), SKP(2), CAT('Relations', 1)],
    8: [ALLY(1), CAT('Relations', 2)],
    9: [ALLY(2), CAT('Relations', 4)],
    10: [],
  },

  soldat_elite_commando_marin: {
    1: [ATTR('VOL')],
    2: [SKP(2), CEL(2), CAT('Matériel', 1)],
    3: [MULT(2), SKP(3), CEL(3), CAT('Matériel', 2)],
    4: [MULT(3), SKP(4), CEL(4), CAT('Matériel', 3)],
    5: [PERM(2), SKP(6), CEL(6), CAT('Matériel', 4)],
    6: [SKP(1), CEL(1)],
    7: [SKILL_CHOICE(), SKP(2), CAT('Relations', 1)],
    8: [ALLY(1), CAT('Relations', 2)],
    9: [ALLY(2), CAT('Relations', 4)],
    10: [],
  },

  sous_marinier: {
    1: [ATTR('CON')],
    2: [SKP(2), CEL(2), CAT('Matériel', 1)],
    3: [{
      type: 'choice', key: 'sous_marinier_confrerie',
      options: [
        { label: 'Rejoindre la confrérie pirate', effects: [NARR('sous_marinier.confrerie_accepte'), SKP(3), CAT('Relations', 2), CEL(3)] },
        { label: 'Refuser', effects: [NARR('sous_marinier.confrerie_refuse'), SKP(3), CAT('Relations', 2), CEL(3)] },
      ],
    }],
    4: [MULT(2), CEL(2), CAT('Matériel', 2)],
    5: [PCT(10), CEL(3), CAT('Relations', 2)],
    6: [NARR('sous_marinier.secret_carte')],
    7: [ALLY(2), CAT('Relations', 4)],
    8: [PCT(20), ALLY(1), CAT('Relations', 3), CAT('Matériel', 2)],
    9: [ALLY(3), CAT('Relations', 6)],
    10: [],
  },

  technicien_mecanicien: {
    1: [ATTR('INT')],
    2: [SKP(2), CEL(2), CAT('Assemblage', 2), CAT('Matériel', 2)],
    3: [PCT(10), CAT('Atelier', 2), CEL(3), SKP(2), CAT('Matériel', 2)],
    4: [CEL(4), SKP(4), CAT('Assemblage', 4), CAT('Atelier', 4), CAT('Matériel', 4)],
    // RAW n'exclut pas explicitement l'effet en cas de refus (contrairement aux 3 autres "grande
    // société") — décision Saar 2026-07-23 : appliqué à plat, jamais un choix inventé sans base
    // textuelle.
    5: [NARR('technicien.contact_organisation'), CAT('Atelier', 2), CAT('Matériel', 4), CEL(3), SKP(2), CAT('Assemblage', 4)],
    6: [MULT(2), CAT('Matériel', 4), CAT('Atelier', 2)],
    7: [CAT('Matériel', 6), CAT('Atelier', 1)],
    8: [CEL(4), CAT('Assemblage', 6), PCT(20), CAT('Atelier', 1), ALLY(1)],
    9: [PCT(10), CAT('Matériel', 4), CAT('Assemblage', 4), CAT('Relations', 4), ALLY(2)],
    10: [],
  },

  techno_hybride: {
    1: [ATTR('CON')],
    2: [SKP(2), CEL(2), CAT('Matériel', 1)],
    // RAW dit "Stock de marchandises +2" — catégorie inexistante pour ce métier (DB : Relations/
    // Célébrité/Matériel), correction déjà silencieusement appliquée par le plan -> Matériel +2.
    3: [MULT(2), SKP(3), CEL(3), CAT('Matériel', 2)],
    4: [MULT(3), SKP(4), CEL(4), CAT('Matériel', 3)],
    5: [PERM(2), SKP(6), CEL(6), CAT('Matériel', 4)],
    6: [SKP(2), CEL(2)],
    7: [SKILL_CHOICE(), SKP(2), CAT('Relations', 1)],
    8: [ALLY(1), CAT('Relations', 2)],
    9: [ALLY(2), CAT('Relations', 4)],
    10: [],
  },

  veilleur: {
    1: [ATTR('VOL')],
    2: [SKP(2), CEL(2), CAT('Matériel', 1)],
    3: [MULT(2), SKP(3), CEL(3), CAT('Matériel', 2)],
    4: [MULT(3), SKP(4), CEL(4), CAT('Matériel', 3)],
    5: [PERM(2), SKP(6), CEL(6), CAT('Matériel', 4)],
    6: [CAT('Relations', 8)],
    7: [CAT('Matériel', 4), CAT('Corruption/Chantage', 4), MULT(2), ENEMY(1, 'abus_de_position')],
    8: [SKILL_CHOICE(), SKP(2), CAT('Relations', 1)],
    9: [ALLY(2), CAT('Relations', 4)],
    10: [],
  },

  voleur_criminel: {
    1: [ATTR('ADA')],
    2: [SKP(2), CEL(2), CAT('Matériel', 4)],
    3: [CEL(3), SKP(4), CAT('Relations', 2), ALLY(1)],
    // RAW : "Réseau +4" — pas de catégorie "Réseau" pour ce métier (DB : Relations/Célébrité/
    // Cache/Planque/Matériel), correction déjà actée par le plan -> Relations +4.
    4: [CEL(2), SKP(2), CAT('Matériel', 4), CAT('Relations', 4), PCT(10)],
    5: [CEL(4), { type: 'celebrity_reward', multiplier: 500 }],
    6: [MULT(2), CAT('Matériel', 4)],
    // `[CORRIGÉ 2026-07-23]` 16e cas income_multiplier_permanent, non catalogué par l'audit
    // précédent ("revenus doublés à partir de cette année" — même formulation que les 15 autres).
    7: [CEL(2), PERM(2), ALLY(1), ENEMY(1)],
    8: [NARR('voleur_criminel.animal_compagnie')],
    9: [CAT('Cache/Planque', 4), CAT('Matériel', 4)],
    10: [],
  },
}

// Métiers à table strictement identique (confirmé PLAN_WIZARD_AVANTAGES.md §6) — même objet
// JavaScript réutilisé, jamais une copie divergente possible.
CAREER_RANDOM_EFFECTS_BY_CODE.officier_naval_militaire = CAREER_RANDOM_EFFECTS_BY_CODE.officier_naval_civil
CAREER_RANDOM_EFFECTS_BY_CODE.officier_militaire_surface = CAREER_RANDOM_EFFECTS_BY_CODE.officier_militaire_souterrain
CAREER_RANDOM_EFFECTS_BY_CODE.pilote_chasse_atmospherique = CAREER_RANDOM_EFFECTS_BY_CODE.pilote_chasse_sous_marin
CAREER_RANDOM_EFFECTS_BY_CODE.soldat_elite_commando_souterrain = CAREER_RANDOM_EFFECTS_BY_CODE.soldat_elite_commando_marin
CAREER_RANDOM_EFFECTS_BY_CODE.soldat_elite_commando_surface = CAREER_RANDOM_EFFECTS_BY_CODE.soldat_elite_commando_marin
CAREER_RANDOM_EFFECTS_BY_CODE.soldat_elite_forces_speciales = CAREER_RANDOM_EFFECTS_BY_CODE.soldat_elite_commando_marin
