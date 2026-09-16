// 347_ref_equipment_guidetech_programs_seed.js — docs/PLANS/PLAN_INFORMATIQUE.md §4 Lot 1, item 8
//
// Seed additif : les 7 programmes du supplément Guide Technique, manquants du catalogue de base
// (34 lignes family='Logiciels' issues du RAW de base, migration 303). Source RAW :
// docs/REGLES/ORDINATEUR_GUIDETECH.md (lu en entier 2026-09-15/16) — Alerte, Bouclier, Darter,
// Masque, Phalanx, Recherche, SkyMarshall. Ce document ne mécanise pas leur usage actif (duel,
// désactivation, infiltration — couches 3-5, MANUEL_INFORMATIQUE.md §4.8 note de bas de page) : ce
// lot ne fait qu'ajouter l'entrée catalogue, même responsabilité que le seed 303 dont il complète
// la famille.
//
// Coût : ORDINATEUR_GUIDETECH.md donne « Coût de base : X » pour chacun, même formulation que la
// table de coûts du RAW de base (REGLE_ORDINATEUR.md p.281-282, « Coût : X x (cumul des niveaux) »
// pour tous les programmes listés, sans exception hors le cas niv² de « Programmes de données »).
// Rien dans le supplément n'indique une règle de coût différente pour ces 7 programmes : appliquer
// la même convention par défaut (`price_modifier = "<base> × cumul"`, même format texte que les 27
// lignes existantes qui portent un coût RAW), plutôt que d'inventer une exception non écrite.
//
// Catégorie : `specialise` pour les 7 — aucune des catégories dédiées existantes (ami_ennemi,
// analyse, armement_contact/distance, communication, contre_attaque, detection, esquive, medical,
// offensif, pilotage, rempart, securite) ne correspond à leur fonction, `specialise` est déjà le
// panier générique du seed 303 pour ce cas (Anti-espion, Brise-code, Cryptage, Données, Décryptage,
// Espion, Extraction, Gestion d'appareils, Mécanique-électronique-informatique, Sciences,
// Topographique, Viral autonome). Darter/Phalanx/SkyMarshall sont des « programmes d'accès à un
// dispositif » (niveau 12 par défaut, RAW) — la nature exacte de ces dispositifs n'est décrite dans
// aucun document du dépôt ; `specialise` évite d'inventer une catégorie armement_* non étayée.
//
// `tech_level`/`generation`/`max_level` : mêmes valeurs uniformes que les 34 lignes existantes
// (tech_level=1, generation=NULL, max_level=NULL) — le seed de base ne les fait varier pour aucun
// programme, cf. PLAN §2.3.
//
// Idempotent : INSERT gardé par une vérification d'existence par `name` (clé métier, SEED-ID-
// DETERM, rules/core.md), pas de contrainte UNIQUE sur `ref_equipment.name` pour s'appuyer sur un
// `onConflict`. Assertion finale sur le total `family='Logiciels'` (41 = 34 + 7, cf. PLAN §4 Lot 1
// « Tests »). `down()` = DELETE par les 7 noms exacts, jamais par family/category (trop large).

const PROGRAMS = [
  {
    name: 'Alerte',
    description: "Gère des dispositifs physiques d'alarme (laser, gaz, sirène…), indépendant du programme de Sécurité. Peut être désactivé séparément par un pirate, avec un délai de réaction propre.",
    price_modifier: '600 × cumul',
  },
  {
    name: 'Bouclier',
    description: "Leurre sur lequel le programme de Sécurité adverse s'acharne en priorité lors d'une intrusion détectée. Un seul programme Bouclier actif à la fois.",
    price_modifier: '500 × cumul',
  },
  {
    name: 'Darter',
    description: 'Programme nécessaire pour utiliser un dispositif Darter. Niveau 12 par défaut ; il existe des variantes plus ou moins performantes.',
    price_modifier: '200 × cumul',
  },
  {
    name: 'Masque',
    description: "Permet à un intrus de s'introduire dans un système sans être repéré, tant qu'il ne s'attaque pas directement au programme de Sécurité (sinon, inopérant).",
    price_modifier: '600 × cumul',
  },
  {
    name: 'Phalanx',
    description: 'Programme nécessaire pour utiliser un dispositif Phalanx. Niveau 12 par défaut ; il existe des variantes plus ou moins performantes.',
    price_modifier: '200 × cumul',
  },
  {
    name: 'Recherche',
    description: "Recherche des données précises dans un système (localisation, horaires, informations ciblées…), au-delà d'une simple banque de données générale.",
    price_modifier: '400 × cumul',
  },
  {
    name: 'SkyMarshall',
    description: 'Programme nécessaire pour utiliser un dispositif SkyMarshall. Niveau 12 par défaut ; il existe des variantes plus ou moins performantes.',
    price_modifier: '200 × cumul',
  },
]

const EXPECTED_LOGICIELS_TOTAL = 41

export const up = async (knex) => {
  let inserted = 0
  for (const { name, description, price_modifier } of PROGRAMS) {
    const existing = await knex('ref_equipment').where({ name }).first()
    if (existing) continue
    await knex('ref_equipment').insert({
      family: 'Logiciels',
      category: 'specialise',
      name,
      description,
      price: null,
      price_modifier,
      tech_level: 1,
      generation: null,
      max_level: null,
    })
    inserted += 1
  }

  const { n } = await knex('ref_equipment').where({ family: 'Logiciels' }).count('* as n').first()
  if (Number(n) !== EXPECTED_LOGICIELS_TOTAL) {
    throw new Error(`347 seed : ${n} ligne(s) family='Logiciels', attendu ${EXPECTED_LOGICIELS_TOTAL} — vérifier avant de continuer`)
  }

  console.log(`[347_ref_equipment_guidetech_programs_seed] ${inserted} programme(s) inséré(s) (total Logiciels: ${n})`)
}

export const down = async (knex) => {
  await knex('ref_equipment').where({ family: 'Logiciels' }).whereIn('name', PROGRAMS.map((p) => p.name)).delete()
}
