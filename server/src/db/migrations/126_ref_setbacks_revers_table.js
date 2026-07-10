// 126_ref_setbacks_revers_table.js
// OPT-06 (revers, défaut OFF) — Personnages expérimentés (REGLE_CREATION.txt:1190-1199).
//
// ref_setbacks existait depuis la migration 98 avec un schéma jamais exploité (roll exact 1-100,
// career_id nullable jamais peuplé) et 5 lignes placeholder ([DETTE-ETAPE4-5]). La vraie table
// (docs/REGLES/REGLEREVERS.md, LdB p.185+) est un jet 1D100 sur UNE table partagée (pas par
// carrière) avec des PLAGES de résultats (ex. 01-20), pas des valeurs exactes — d'où la
// restructuration roll -> roll_min/roll_max, et l'abandon de career_id/category (jamais corrects
// pour cette mécanique). "Narco-dommages" (texte présent dans la source, sans plage 1-100 associée)
// est une erreur connue du livre de base, confirmée par Saar sur l'exemplaire papier — volontairement
// absent des 27 lignes ci-dessous.
//
// char_archetype.setback_rolls (JSONB, nouveau) : le déclencheur d'OPT-06 porte sur le total
// d'années d'expérience CUMULÉES toutes carrières confondues (pas une carrière précise, à la
// différence du Tirage 1D10 d'OPT-05/Lot 6) — ne peut donc pas vivre sur une ligne char_careers.
// char_archetype est la table "un enregistrement par fiche, état global Step4" (origin_geo,
// training_base, higher_ed y vivent déjà).

const SETBACKS = [
  [1, 20, 'Incident mineur sans conséquence',
    "Un incident mineur survient, sans conséquence mécanique. Aucun effet particulier à appliquer."],
  [21, 25, 'Accident',
    "Le personnage a été victime d'un accident. Il perd 5 points de compétence pour cette année. " +
    "De plus, il y a 2 chances sur 10 (1-2 sur 1D10) pour qu'il subisse également les effets du Revers Blessure."],
  [26, 28, 'Attentat',
    "Le personnage a été l'une des victimes d'un attentat. Il perd 5 points de compétence pour cette année. " +
    "De plus, il se peut qu'il subisse les effets des Revers Mutilation (1-2 sur 1D10) et Deuil (1-5 sur 1D10). " +
    "C'est au MJ de déterminer qui est responsable de l'attentat. Le PJ peut développer une haine farouche à l'encontre des terroristes."],
  [29, 31, 'Bannissement',
    "Le personnage a été banni de sa communauté. Il peut continuer à exercer sa profession ailleurs. " +
    "Il perd tous ses points de compétence et toutes ses économies pour cette année. " +
    "Voir Perte de travail et changement de communauté (section Expérience préliminaire)."],
  [32, 36, 'Blessure',
    "Le personnage souffre des séquelles d'une blessure mal remise. Dans la plupart des cas, une opération " +
    "chirurgicale peut régler le problème (chirurgie réparatrice ou esthétique), mais ce sera une intervention " +
    "longue et coûteuse. Lancer 1D10 : 1 Force -1 ; 2 Constitution -1 ; 3 Coordination -1 ; " +
    "4 Adaptation -1 (traumatisme à la tête) ; 5 Perception -1 (traumatisme à la tête) ; " +
    "6 Intelligence -1 (traumatisme à la tête) ; 7 Volonté -1 (traumatisme à la tête) ; " +
    "8 Présence -1 (cicatrices, mâchoire brisée, oreille arrachée, etc.) ; " +
    "9 Jambe (déterminée au hasard) handicapée, déplacement réduit de 25% ; " +
    "10 Bras (déterminé au hasard) handicapé, toute action avec ce bras subit un malus de -5."],
  [37, 39, 'Catastrophe',
    "Une catastrophe majeure s'est abattue sur la communauté du personnage (tremblement de terre, explosion " +
    "d'un réacteur, glissement de terrain, etc.). La communauté peut être détruite. Dans ce cas, le personnage " +
    "est contraint de s'exiler : il perd 5 points de compétence et toutes ses économies pour cette année. " +
    "De plus, il est possible qu'il subisse les effets des Revers Blessure (1-4 sur 1D10), Deuil (1-8 sur 1D10) " +
    "et Mutilation (1-2 sur 1D10). S'il s'agit d'une communauté importante, la catastrophe est limitée à un " +
    "secteur particulier et le personnage peut y rester."],
  [40, 48, 'Choc psychologique',
    "À la suite d'un terrible drame (à définir par le MJ), le personnage souffre du Désavantage Phobie " +
    "(1D10 : 1-6) ou Déséquilibre mental (1D10 : 7-10). Il ne gagne, bien entendu, aucun point d'Avantage."],
  [49, 51, 'Complot',
    "Le personnage a été victime d'un complot ourdi par ses Opposants ou ses Ennemis, ou s'est retrouvé accusé " +
    "à tort. Lancer 1D10 : 1 Contrat ; 2 Bannissement ; 3-4 Emprisonnement ; 5 Fugitif ; " +
    "6-8 Mise à pied temporaire (perd points de compétence et économies pour l'année) ; 9 Renvoi ; " +
    "10 Deux jets sur cette table."],
  [52, 54, 'Contamination/Maladie',
    "À la suite d'un incident bactériologique ou d'une épidémie, le personnage est tombé malade. Lancer 1D10 : " +
    "1-3 Guérison (perd 5 points de compétence, mais s'en sort indemne) ; " +
    "4-5 Séquelles (subit les effets du Revers Blessure) ; " +
    "6-7 Virus latent (atteint d'un virus inconnu pouvant se réveiller n'importe quand, censé ne pas le savoir) ; " +
    "8-9 Maladie incurable non contagieuse (au choix du MJ ou du joueur) ; " +
    "10 Maladie incurable contagieuse (le MJ et le joueur doivent imaginer un moyen de la cacher)."],
  [55, 57, 'Contrat',
    "Après être intervenu (par erreur ou non) dans les affaires d'une organisation (généralement criminelle), " +
    "la tête du personnage a été mise à prix. Il gagne un Ennemi supplémentaire et le Désavantage Recherché " +
    "(il peut toutefois tenter de prouver son innocence). Ce Revers ne prendra effet qu'au début de la campagne."],
  [58, 60, 'Deuil',
    "Le personnage a perdu un membre de sa famille ou un ami très proche. Il perd 1 Allié."],
  [61, 62, 'Diffamation',
    "Le personnage est diffamé par un rival ou une organisation. Il perd un quart de sa Célébrité et de ses " +
    "Alliés, ainsi que la moitié de ses Contacts."],
  [63, 64, 'Enlèvement',
    "Le personnage a été enlevé par des terroristes, des boucaniers ou tout autre groupement au choix du MJ. " +
    "Il perd tous ses points de compétence ainsi que ses économies pour l'année. Il se peut qu'il ait subi le " +
    "Revers Mutilation (1-4 sur 1D10). On considère qu'il a réussi à fuir ou a été libéré par les autorités."],
  [65, 69, 'Emprisonnement',
    "Le personnage est emprisonné pour un délit, qu'il ait commis ou non. Il passe l'année suivante en prison " +
    "(il vieillit donc d'une année supplémentaire). Chaque année, il doit lancer 1D10 : sur un 10, il reste en " +
    "prison une année de plus ; de 1 à 9, il est libre. Un personnage peut refuser d'aller en prison mais " +
    "devient alors un fugitif (Désavantage Recherché, sans les points d'Avantages)."],
  [70, 74, 'Ennemi',
    "Le personnage s'est fait un Ennemi de plus."],
  [75, 79, 'Ennemi important',
    "Le personnage s'est fait un Ennemi de plus… mais celui-ci est soit une personnalité influente, soit un " +
    "groupe/gang (au choix du MJ)."],
  [80, 82, 'Faute lourde',
    "Le personnage a commis une grosse faute dans l'exercice de sa profession. Lancer 2D10 : " +
    "2-4 Amende (perd son argent pour l'année) ; 5 Bannissement ; 6-7 Emprisonnement ; 8-9 Ennemi ; " +
    "10-11 Ennemi important ; 12-15 Mise à pied temporaire (perd points de compétence et argent pour l'année) ; " +
    "16-18 Renvoi ; 19 Vendetta ; 20 Deux jets sur cette table."],
  [83, 86, 'Fugitif',
    "Le personnage est accusé (à tort ou à raison) d'un crime très grave. Il a réussi à fuir mais est désormais " +
    "traqué. S'il fait partie d'une petite communauté indépendante, il lui suffit de partir ; s'il fait partie " +
    "d'une grande nation, il devra quitter ce pays ou aller de station en station au risque d'être interpellé " +
    "(1 chance sur 10 d'être repéré la première année dans une nouvelle station, puis 2 sur 10 la deuxième " +
    "année, etc.). Il sera encore considéré comme fugitif au début de la campagne, et souvent recherché par " +
    "des chasseurs de primes. Il reçoit automatiquement le Désavantage Recherché (sans gagner de points " +
    "d'Avantage) et perd tout son argent et ses points de compétence pour l'année."],
  [87, 92, 'Mauvaise passe',
    "Le personnage a passé une mauvaise année. Ses revenus sont réduits de moitié et il perd 5 points de compétence."],
  [93, 93, 'Mutilation',
    "Le personnage subit une mutilation. Dans la plupart des cas, une opération chirurgicale peut régler le " +
    "problème (chirurgie réparatrice ou esthétique, implant cybernétique), mais ce sera une intervention " +
    "longue et coûteuse. Lancer 1D100 : 01-02 Perte d'un œil ; 03-04 Perte d'une main ; 05 Perte d'un bras ; " +
    "06 Perte d'une jambe ; 07-08 Bras paralysé ; 09-10 Jambe raide (vitesse réduite de moitié) ; " +
    "11-18 Vue réduite (comme le Désavantage Sens diminué) ; 19-30 Ouïe réduite (comme Sens diminué) ; " +
    "31-42 Odorat réduit (comme Sens diminué) ; 43-54 Toucher réduit (comme Sens diminué) ; " +
    "55-66 Rejet d'une substance (comme le Désavantage Allergie sévère) ; 67-78 Visage marqué (Présence -1) ; " +
    "79-90 Cerveau touché (Adaptation -1) ; 91-100 Tremblement nerveux (Coordination -1)."],
  [94, 94, 'Pillage',
    "Des pirates ont attaqué la communauté du personnage (ou le navire sur lequel il voyageait). Il perd tout " +
    "l'argent de l'année en cours et peut subir les effets des Revers Deuil (1-6 sur 1D10), Blessure " +
    "(1-3 sur 1D10) et Catastrophe (1 sur 1D10)."],
  [95, 95, 'Polaris',
    "Le personnage a été victime de la libération accidentelle d'un effet Polaris. Cela peut ne pas être grave " +
    "ou avoir de terribles conséquences. Il peut subir les effets des Revers Blessure (1-3 sur 1D10), " +
    "Mutilation (1 sur 1D10), Catastrophe (1-3 sur 1D10), Deuil (1-6 sur 1D10). Si le personnage est doté du " +
    "Polaris, il est responsable de l'accident : il peut subir les effets des Revers suivants : " +
    "Fugitif (1-2 sur 1D10), Ennemi important (1-6 sur 1D10), Bannissement (1-8 sur 1D10), Deuil (1-7 sur 1D10), " +
    "Culte du Trident (1-7 sur 1D10 — le personnage est remis au Culte du Trident ; il peut accepter et " +
    "embrasser la profession de prêtre, ou refuser et devenir un fugitif avec le Désavantage Recherché)."],
  [96, 96, 'Renvoi',
    "Le personnage perd son travail à la fin de l'année en cours. " +
    "Voir Perte de travail et changement de communauté (section Expérience préliminaire)."],
  [97, 97, 'Vendetta',
    "Le personnage (ou un membre de sa famille) s'est attiré les foudres d'un groupe, d'une famille ou d'un " +
    "syndicat du crime. Il gagne un Ennemi supplémentaire et le Désavantage Recherché."],
  [98, 98, 'Trahison',
    "Le personnage est trahi par ses proches. Il perd un quart de ses Alliés et la moitié de ses Contacts."],
  [99, 99, 'Irradiation',
    "Le personnage cumule 2D10 points d'Irradiation, qu'il conserve encore au début du jeu."],
  [100, 100, 'Relancer ou autre Revers au choix du MJ',
    "Relancer sur cette table, ou le MJ choisit directement un autre Revers de son choix."],
]

// Les 5 lignes placeholder d'origine (98_ref_backgrounds.js) — restaurées par down() pour un
// round-trip byte-identique (P53/P54).
const ORIGINAL_PLACEHOLDER_ROWS = [
  { roll: 1, description: "Perte d'emploi : le personnage perd son travail. L'année suivante ne donne que 5 pts de Compétence et 3 pts d'Avantages pro.", category: 'general' },
  { roll: 2, description: 'Blessure grave : le personnage garde une cicatrice ou un handicap permanent. -1 FOR ou CON (au choix).', category: 'general' },
  { roll: 3, description: "Dette : le personnage contracte une dette équivalente à 1 année de salaire.", category: 'general' },
  { roll: 4, description: 'Ennemi : le personnage se fait un ennemi influent.', category: 'general' },
  { roll: 5, description: "Problème judiciaire : le personnage est inquiété par les autorités locales.", category: 'general' },
]

export const up = async (knex) => {
  // ── ref_setbacks : roll exact -> plage (roll_min/roll_max), abandon career_id/category ──────
  await knex.schema.alterTable('ref_setbacks', (table) => {
    table.dropColumn('roll')
    table.dropColumn('category')
    table.dropColumn('career_id')
  })
  await knex.schema.alterTable('ref_setbacks', (table) => {
    table.integer('roll_min')
    table.integer('roll_max')
    table.text('name')
  })

  await knex('ref_setbacks').del()
  await knex('ref_setbacks').insert(
    SETBACKS.map(([roll_min, roll_max, name, description]) => ({ roll_min, roll_max, name, description }))
  )

  await knex.schema.alterTable('ref_setbacks', (table) => {
    table.integer('roll_min').notNullable().alter()
    table.integer('roll_max').notNullable().alter()
    table.text('name').notNullable().alter()
  })
  await knex.raw(`
    ALTER TABLE ref_setbacks
    ADD CONSTRAINT chk_ref_setbacks_roll_range
    CHECK (roll_min BETWEEN 1 AND 100 AND roll_max BETWEEN 1 AND 100 AND roll_min <= roll_max)
  `)

  // ── char_archetype.setback_rolls — jets Revers, total d'années cumulées (pas par carrière) ──
  await knex.schema.alterTable('char_archetype', (table) => {
    table.jsonb('setback_rolls')
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('char_archetype', (table) => {
    table.dropColumn('setback_rolls')
  })

  await knex.raw('ALTER TABLE ref_setbacks DROP CONSTRAINT chk_ref_setbacks_roll_range')
  await knex.schema.alterTable('ref_setbacks', (table) => {
    table.dropColumn('roll_min')
    table.dropColumn('roll_max')
    table.dropColumn('name')
  })
  await knex.schema.alterTable('ref_setbacks', (table) => {
    table.integer('roll').notNullable()
    table.text('category').defaultTo('general')
    table.uuid('career_id').references('id').inTable('ref_careers').onDelete('CASCADE')
  })
  await knex.raw('ALTER TABLE ref_setbacks ADD CONSTRAINT ref_setbacks_roll_check CHECK (roll BETWEEN 1 AND 100)')
  await knex.schema.alterTable('ref_setbacks', (table) => {
    table.index(['career_id'])
  })

  await knex('ref_setbacks').del()
  await knex('ref_setbacks').insert(ORIGINAL_PLACEHOLDER_ROWS)
}
