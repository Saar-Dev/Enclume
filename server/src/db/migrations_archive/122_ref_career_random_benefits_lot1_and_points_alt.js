// Migration 122 — Wizard Step4 Lot 6 (tirage 1D10)
// 1) ref_career_random_benefits.points_alt (nouvelle colonne) — le serveur relit cette valeur pour
//    recalculer le budget d'Avantages pro quand le joueur choisit "points" sur un résultat roll=10,
//    jamais envoyée par le client (cf. shared/careerAdvantages.js computeRandomBudgetDelta).
//    Backfill à 7 sur les 32 lignes roll=10 déjà seedées (migrations 108/112-116) — texte vérifié
//    strictement identique sur les 32/32 lignes (requête réelle Session 140, corrige le "22/22"
//    initialement supposé dans PLAN_REWORKFINAL.md §8.2).
// 2) Insert des 50 lignes manquantes (5 carrières du Lot 1 × 10) — jamais seedées à l'origine
//    (100_seed_ref_careers.js n'a aucun insert sur cette table, même angle mort que la migration 106/120).
//    Texte repris de docs/Character/Creation/migrations/93_seed_ref_careers_lot1.cjs (fichier de
//    référence pré-migration, jamais transcrit dans la vraie migration), cross-vérifié mot pour mot
//    contre docs/Character/Creation/REGLE_PROFESSION.md (lignes 96-119, 157-180, 207-228, 231-289,
//    291-351) — 50/50 lignes conformes, même style condensé que les 32 déjà en base (vérifié contre
//    mercenaire).
// chasseur_primes n'a pas de ref_career_point_categories (cf. migration 120) — la table des avantages
// aléatoires existe pourtant pour ce métier (imprimée dans la LdB) : le jet reste possible, seule la
// bascule "convertir en points" est inopérante pour ce métier (aucun budget où les allouer) — géré
// côté shared/careerAdvantages.js et creationService.js, pas ici.

const RANDOM_BENEFITS = {
  artisan_artiste: [
    'Attribut augmenté : Intelligence +1',
    'Prestation : travail remarqué. Points de Compétence +1, Art/Artisanat +2, Célébrité +2.',
    'Hautes sphères : travail pour un personnage haut placé. Salaire doublé pour l\'année, Célébrité +4, points de Compétence +2, Art/Artisanat +2, Relations +1.',
    'Guilde/Compagnie : engagé par la Guilde. Salaire +10% à partir de cette année, Célébrité +2, Étal/Boutique +2, Relations +1.',
    'Protecteur/Mécène : protégé par un puissant personnage. Célébrité +4, Art/Artisanat +6, revenus +20% à partir de cette année, Étal/Boutique +1, Allié +1.',
    'Chef-d\'œuvre : création d\'un chef-d\'œuvre. Célébrité +6, revenus triplés pour l\'année, points de compétence +4, Relations +2.',
    'Contrat : contrat avec une société. Célébrité +4, Art/Artisanat +6, revenus +10% à partir de cette année, Contact +1.',
    'Renommée : excellente réputation. Célébrité +8, revenus +50% à partir de cette année, points de compétence +2.',
    'Année faste : paye triplée pour l\'année, Art/Artisanat +4.',
    'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.',
  ],
  assassin: [
    'Attribut augmenté : Adaptation +1',
    'Prestation : travail remarqué. Points de compétence +1, Célébrité +2, Falsification +2, Corruption/Chantage +2.',
    'Secret : le personnage a appris un secret intéressant.',
    'Corruption : Corruption/Chantage +6.',
    'Coup d\'éclat : assassinat d\'une personnalité importante. Points de compétence +2, Célébrité +4, Falsification +4, Corruption/Chantage +4.',
    'Falsification : Falsification +6.',
    'Fausse identité : Fausse identité +6.',
    'Contrat : contrat auprès d\'un groupe important. Célébrité +5, revenus +10% à partir de cette année, Relations +2, Allié ou Fournisseur +1.',
    'Réseau : Relations +6.',
    'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.',
  ],
  barman: [
    'Attribut augmenté : Volonté +1',
    'Prestation : le barman est particulièrement apprécié de sa clientèle. Points de compétence +2, Célébrité +1, Bar +2.',
    'Protection : le barman est protégé par un groupe (gang, contrebandiers, pirates, police) auquel il peut faire appel en cas de coup dur. L\'un de ses Alliés acquiert gratuitement l\'amélioration Groupe/Gang.',
    'Clientèle prestigieuse : un ou plusieurs clients du bar sont connus, Célébrité +4, Relations +2, Allié +1, revenus augmentés de 10% à partir de cette année.',
    'Année faste : bonne année pour le barman, la paye est doublée, Bar +1.',
    'Dépôt de marchandises : le barman peut stocker des marchandises mises en dépôt par des clients. Stock de marchandises +4, Relations +1, revenus augmentés de 10% à partir de cette année.',
    'Réseau : le barman connaît vraiment beaucoup de monde… Relations +8.',
    'Trafic de marchandises : le bar sert de plaque tournante pour des trafics divers. Revenus augmentés de +20% à partir de cette année, Relations +2, Stock de marchandises +3.',
    'Secret : le Barman connaît un secret qu\'un de ses clients lui a confié un soir de beuverie. Le personnage pourra éventuellement monnayer cette information s\'il le souhaite.',
    'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.',
  ],
  chasseur_primes: [
    'Attribut augmenté : Adaptation +1.',
    'Prestation : travail remarqué. Points de compétence +2, Célébrité +2, Matériel +1.',
    'Guilde : engagé par une Guilde de Mercenaires spécialisée dans la traque de fugitifs. Salaire +10% à partir de cette année, Célébrité +4, Matériel +2.',
    'Grande société : contacté par une grande société de chasseurs de primes, comme Limier. Salaire +20%, Célébrité +4, Points de compétence +4.',
    'Action d\'éclat : interpellation d\'un personnage important. Points de compétence +4, Célébrité +4, revenu doublé pour l\'année.',
    'Réseau : réseau d\'informateurs. Célébrité +2, Relations +8.',
    'Dépôt d\'armes : Matériel +6.',
    'Camarades de combat : l\'un de ses Alliés acquiert gratuitement l\'amélioration Groupe/Gang.',
    'Année faste : paie doublée, Célébrité +2, Matériel +2.',
    'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.',
  ],
  contrebandier: [
    'Attribut augmenté : Adaptation +1',
    'Prestation : travail remarqué. Points de compétence +1, Célébrité +2, Stock de marchandises +2.',
    'Coup d\'éclat : gros coup dans le milieu de la contrebande. Points de compétence +2, Célébrité +4, Stock de marchandises +4, Argent doublé pour l\'année.',
    'Contrat : contrat avec une organisation, un groupe ou un personnage. Célébrité +2, Revenus +10% à partir de cette année, Relations +3.',
    'Exclusivité : contrat exclusif. Célébrité +4, Revenus +20% à partir de cette année, Relations +5, Allié +1.',
    'Corruption : aide de membres des autorités. Relations +1, Corruption/Chantage +4, Planque/Cache +1.',
    'Falsification : aide d\'un membre de l\'administration. Relations +1, Falsification +4.',
    'Réseau : Relations +6.',
    'Caches et planques : Cache à marchandises +4, Planque/Cache +4.',
    'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.',
  ],
}

export async function up(knex) {
  await knex.schema.alterTable('ref_career_random_benefits', (t) => {
    t.integer('points_alt').nullable()
  })

  await knex('ref_career_random_benefits').where({ roll: 10 }).update({ points_alt: 7 })

  const codes = Object.keys(RANDOM_BENEFITS)
  const careers = await knex('ref_careers').whereIn('code', codes).select('id', 'code')
  const careerIdByCode = new Map(careers.map(c => [c.code, c.id]))

  const rows = []
  for (const code of codes) {
    const careerId = careerIdByCode.get(code)
    if (!careerId) throw new Error(`Carrière inconnue : ${code}`)
    RANDOM_BENEFITS[code].forEach((description, i) => {
      const roll = i + 1
      rows.push({ career_id: careerId, roll, description, points_alt: roll === 10 ? 7 : null })
    })
  }

  await knex('ref_career_random_benefits').insert(rows)
}

export async function down(knex) {
  const codes = Object.keys(RANDOM_BENEFITS)
  const careerIds = await knex('ref_careers').whereIn('code', codes).pluck('id')
  await knex('ref_career_random_benefits').whereIn('career_id', careerIds).del()

  await knex('ref_career_random_benefits').update({ points_alt: null })

  await knex.schema.alterTable('ref_career_random_benefits', (t) => {
    t.dropColumn('points_alt')
  })
}
