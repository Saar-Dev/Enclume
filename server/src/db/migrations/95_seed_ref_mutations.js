// 95_seed_ref_mutations.js
// Seed des 50 mutations Polaris dans les tables créées par 95_new_ref_mutations.js.
// Source : docs/Character/Creation/migrations/96_ref_mutations.cjs (SQL brut converti en Knex JS).

exports.up = async (knex) => {
  const ids = {}

  async function ins(data) {
    const [{ mutation_id }] = await knex('ref_mutations').insert(data).returning('mutation_id')
    const key = data.name + (data.subtype ? '.' + data.subtype : '')
    ids[key] = mutation_id
    return mutation_id
  }

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const adExt = await ins({
    name: 'Adaptation extérieure', cost_pc: 3, is_unique: true,
    d100_range_start: 1, d100_range_end: 6,
    special_effect: "Heures dehors = niveau de compétence. Récupération = 3× durée exposition.",
    description: "Le personnage possède une résistance aux effets néfastes de la Surface (radiations, acidité de l'air, altération moléculaire…).",
  })

  const amphibie = await ins({
    name: 'Amphibie', cost_pc: 2, is_unique: true,
    d100_range_start: 7, d100_range_end: 10,
    special_effect: 'Max niveau +0. Profondeur max = niveau×500m. Ne peut dépasser CON en mètres si niveau < 1.',
    description: "Le personnage est doté d'une mutation similaire à celle des hybrides naturels, mais imparfaitement développée. Respire sous l'eau.",
  })

  await ins({
    name: 'Androgyne', cost_pc: 0, is_unique: true, mod_sex: 'androgyne',
    d100_range_start: 11, d100_range_end: 13,
    description: 'Physiquement, le personnage tient des deux sexes.',
  })

  await ins({
    name: 'Asexué', cost_pc: 0, is_unique: true, mod_sex: 'asexue', mod_fertility: 'sterile',
    d100_range_start: 14, d100_range_end: 16,
    description: 'Le personnage est né sans sexe. Il est donc stérile.',
  })

  await ins({
    name: 'Autofécondation', cost_pc: 0, is_unique: true, mod_sex: 'asexue', mod_fertility: 'self_fertile',
    d100_range_start: 17, d100_range_end: 19,
    description: "Le personnage ne possède pas d'organes reproducteurs mais peut s'autoféconder et mettre un enfant au monde.",
  })

  const cga = await ins({
    name: 'Caractère génétique animal', cost_pc: 2, is_unique: true, has_subtable: true,
    d100_range_start: 20, d100_range_end: 23,
    description: 'Le personnage présente un fort caractère génétique animal. Morphologie altérée, fourrure, écailles, traits animaux. Lancez 1D4.',
  })

  await ins({
    name: 'Contact corrosif', cost_pc: 3, is_stackable: true, stack_effect: '+3 dégâts par stack',
    d100_range_start: 24, d100_range_end: 25,
    special_effect: '1D10 dégâts base. Continue 3D6 rounds tant que non nettoyé (eau). Dégâts indépendants de toute autre action.',
    description: "La peau du personnage sécrète à volonté une substance corrosive.",
  })

  const contagion = await ins({
    name: 'Contagion', cost_pc: 3, is_unique: true, mod_res_disease: 9999,
    d100_range_start: 26, d100_range_end: 27,
    special_effect: 'Contagion passive permanente (Grippe bleue contact peau). Contrôle: Test Contagion. Virulence: +0→1D6, -3→2D6, -5→3D6, -7→4D6, -10→5D6. Victime développe maladie en 2D6h - MR.',
    description: "Le personnage est nourri des bactéries qui vivent en symbiose avec lui. Immunisé aux maladies. Contagion invisible (contrairement à Purulence).",
  })

  await ins({
    name: 'Corne', cost_pc: 1, is_unique: true,
    d100_range_start: 28, d100_range_end: 30,
    special_effect: 'Après saisie: 1D10 + mod CaC. Si tête: +1D6 Choc.',
    description: "Le personnage est doté d'une petite corne sur le front.",
  })

  await ins({
    name: 'Crocs', cost_pc: 1, is_unique: true,
    d100_range_start: 31, d100_range_end: 35,
    special_effect: 'Après saisie: 1D10+3 + mod CaC.',
    description: "Le personnage est doté de crocs ou ses dents sont extrêmement tranchantes.",
  })

  await ins({
    name: 'Difformités', subtype: 'minor', cost_pc: 1, is_stackable: true, mod_PRE: -1,
    d100_range_start: 36, d100_range_end: 40,
    description: "Difformité légère. Présence -1. Cumulable avec d'autres difformités.",
  })

  await ins({
    name: 'Difformités', subtype: 'major', cost_pc: 3, is_stackable: true, mod_PRE: -2,
    d100_range_start: 41, d100_range_end: 43,
    description: "Difformité importante. Présence -2. Cumulable avec d'autres difformités.",
  })

  const empathie = await ins({
    name: 'Empathie', cost_pc: 4, is_unique: true,
    d100_range_start: 44, d100_range_end: 46,
    special_effect: 'Communication corail (-7), animaux (-3). Émotions individus: malus VOL cible/2. Modification: Test opposé VOL, MR = rounds. Échec critique: cible alertée. Progression par étapes. Lieux imprégnés (-13).',
    description: "Cette mutation donne accès à la Compétence spéciale Empathie. Permet de ressentir et modifier les émotions.",
  })

  await ins({
    name: 'Excroissance osseuse rétractable', cost_pc: 3, is_unique: true,
    d100_range_start: 47, d100_range_end: 49,
    special_effect: 'Arme: Combat à mains nues, 2D10 + mod CaC.',
    description: "Le personnage peut faire jaillir d'un de ses avant-bras une excroissance osseuse.",
  })

  await ins({
    name: 'Griffes', cost_pc: 2, is_unique: true,
    d100_range_start: 50, d100_range_end: 52,
    special_effect: 'Dégâts: 1D10+3 + mod CaC. Bonus: Escalade +3 (si griffes utilisables). Malus: dextérité manuelle -3.',
    description: "Le personnage est doté de griffes.",
  })

  const instab = await ins({
    name: 'Instabilité moléculaire', cost_pc: 4, is_unique: true,
    d100_range_start: 53, d100_range_end: 53,
    special_effect: 'Transformation volontaire: 2D10 rounds. Organes: auditif -3, visuel -5, tentacule -7 (FOR 3). Reprise: -3 (≤10min), -7 (≤1h), -1/h supp. Échec reprise: difficulté +1 cumulatif. Échec impossible: FOR ou CON -1 définitif. Stress → Test involontaire.',
    description: "La structure moléculaire du personnage peut être modifiée, volontairement ou involontairement.",
  })

  const metamorphe = await ins({
    name: 'Métamorphe', cost_pc: 4, is_unique: true,
    d100_range_start: 54, d100_range_end: 56,
    special_effect: "Apparence physique seulement. Manières: Test Déguisement/Imitation avec bonus MR. Forme humanoïde uniquement. Attributs/compétences inchangés.",
    description: "Cette mutation permet de prendre l'apparence physique d'un individu.",
  })

  for (const [subtype, cost_pc, description] of [
    ['taste',   0, 'Papilles gustatives atrophiées.'],
    ['smell',   0, 'Nez atrophié.'],
    ['touch',   0, 'Sens du toucher atrophié.'],
    ['hearing', 1, 'Oreille manquante.'],
    ['sight',   2, 'Œil manquant.'],
  ]) {
    await ins({
      name: 'Organe sensoriel manquant', subtype, cost_pc, is_unique: true,
      d100_range_start: 57, d100_range_end: 58,
      special_effect: 'Sens diminué -5. Cumulable avec Désavantage Sens diminué.',
      description,
    })
  }

  for (const [subtype, cost_pc, description] of [
    ['taste',   0, 'Goût amélioré.'],
    ['smell',   1, 'Odorat amélioré.'],
    ['touch',   1, 'Toucher amélioré.'],
    ['hearing', 2, 'Oreille supplémentaire.'],
    ['sight',   2, 'Œil supplémentaire.'],
  ]) {
    await ins({
      name: 'Organe sensoriel supplémentaire ou amélioré', subtype, cost_pc, is_unique: true,
      d100_range_start: 59, d100_range_end: 60,
      special_effect: 'Sens développé +5. Cumulable avec Avantage Sens développé.',
      description,
    })
  }

  const parasite = await ins({
    name: 'Parasite', cost_pc: 1, is_unique: true,
    max_cumul_group: 'parasite_symbiote_regen', max_cumul_limit: 2,
    d100_range_start: 61, d100_range_end: 61,
    special_effect: '1D4 parasites. Résistance dommages -1 par 2 parasites. Attaque 1D10+N parasites/semaine (ou si pas assez nourri). Nourriture ×2. Retrait: CON -1 par 2 parasites. Tirage mutation bonus aléatoire.',
    description: "Le personnage abrite 1D4 parasites. Il doit manger et boire deux fois plus.",
  })

  await ins({
    name: 'Peau renforcée', cost_pc: 2, is_stackable: true,
    stack_effect: '+2 armure naturelle par stack', natural_armor: 3,
    d100_range_start: 62, d100_range_end: 66,
    description: "La peau du personnage, sombre et râpeuse, lui confère une armure naturelle de 3 points.",
  })

  const purulence = await ins({
    name: 'Purulence', cost_pc: -2, is_stackable: true,
    stack_effect: 'PRE -1, Résistance maladies +2 par stack',
    mod_PRE: -2, mod_res_disease: 3,
    d100_range_start: 67, d100_range_end: 67,
    special_effect: 'Social -5 si apparence visible. Contagion 1 sem/3 mois (Grippe bleue). Contrôle: Test Purulence/jour, malus -1 cumulatif/jour. Attaque: contact peau, opp CON cible, 3D10+MR. Cadavre contagieux.',
    description: "La peau de l'individu est couverte de pustules. Présence réduite de 2 (minimum 3).",
  })

  const queue = await ins({
    name: 'Queue', cost_pc: 1, is_unique: true,
    d100_range_start: 68, d100_range_end: 70,
    special_effect: 'Compétence limitative: Acrobatie/Équilibre, Armes de poing (petites), Combat armé (petites armes, pas mod CaC), Combat à mains nues (1D10/2 + mod CaC).',
    description: "Le personnage est doté d'une queue. Il peut apprendre à manipuler des objets avec.",
  })

  const radiation = await ins({
    name: 'Radiation', cost_pc: 3, is_stackable: true, stack_effect: '+3 irradiation par stack',
    d100_range_start: 71, d100_range_end: 71,
    special_effect: '2D6 irradiation + MR au contact.',
    description: "Cette mutation permet de libérer un flot de radiations dans l'organisme d'une victime par simple contact. Offre gratuitement Résistance naturelle (radiation).",
  })

  const regen = await ins({
    name: 'Régénération', cost_pc: 2, is_stackable: true,
    stack_effect: 'Bonus stabilisation +1, guérison ÷3 (au lieu de ÷2)',
    max_cumul_group: 'parasite_symbiote_regen', max_cumul_limit: 2,
    d100_range_start: 72, d100_range_end: 75,
    special_effect: 'Stabilisation +2, infection +3, guérison ÷2. Nourriture ×2 sinon 1D10+3/jour.',
    description: "Le personnage régénère plus rapidement ses blessures. Ne permet pas de récupérer un membre ou un organe détruit.",
  })

  for (const [subtype, mod_res_damage, mod_res_drugs, mod_res_disease, mod_res_poison, mod_res_radiation, special_effect, description] of [
    ['fire',      3, 0, 0, 0, 0, 'Immunisé chaleur.',               'Résistance au feu. Réduit les dommages de feu de 3 points. Insensible à la chaleur.'],
    ['cold',      3, 0, 0, 0, 0, "Immunisé froid jusqu'à -10°C.",   'Résistance au froid. Réduit les dommages de froid de 3 points.'],
    ['drugs',     0, 3, 0, 0, 0, null,                               'Résistance aux drogues augmentée de 3 points.'],
    ['disease',   0, 0, 3, 0, 0, null,                               'Résistance aux maladies augmentée de 3 points.'],
    ['poison',    0, 0, 0, 3, 0, null,                               'Résistance au poison augmentée de 3 points.'],
    ['radiation', 0, 0, 0, 0, 3, null,                               'Résistance aux radiations augmentée de 3 points.'],
  ]) {
    await ins({
      name: 'Résistance naturelle', subtype, cost_pc: 1, is_stackable: true,
      stack_effect: `+1 Résistance ${subtype} par stack`,
      mod_res_damage, mod_res_drugs, mod_res_disease, mod_res_poison, mod_res_radiation,
      special_effect,
      d100_range_start: 76, d100_range_end: 80,
      description,
    })
  }

  await ins({
    name: 'Sixième sens', cost_pc: 1, is_unique: true,
    d100_range_start: 81, d100_range_end: 85,
    special_effect: 'Bonus +3 Tests de Réaction en cas de Surprise.',
    description: "Le personnage bénéficie d'un bonus de +3 à ses Tests de Réaction en cas de Surprise.",
  })

  const sonar = await ins({
    name: 'Sonar', cost_pc: 3, is_unique: true,
    d100_range_start: 86, d100_range_end: 88,
    special_effect: 'Portée = INT mètres. Onde sonique: 2D10, modificateurs combat distance.',
    description: "Le personnage est doté d'une sorte de sonar pour repérer des obstacles sous l'eau ou dans le noir.",
  })

  await ins({
    name: 'Squelette renforcé', cost_pc: 3, is_stackable: true,
    stack_effect: '+1 Résistance dommages, +1 Résistance Choc par stack',
    mod_res_damage: 2, mod_res_shock: 3,
    d100_range_start: 89, d100_range_end: 89,
    description: "La Résistance aux dommages du personnage est augmentée de 2 points, et sa Résistance au Choc de 3 points.",
  })

  const symbiote = await ins({
    name: 'Symbiote', cost_pc: 3, is_unique: true,
    max_cumul_group: 'parasite_symbiote_regen', max_cumul_limit: 2,
    d100_range_start: 90, d100_range_end: 92,
    special_effect: '1D4 symbiotes. Nourriture ×2 sinon 1D10+N/jour. Choix par symbiote: +2 Résistance naturelle OU mutation aléatoire. Retrait: CON -1 par 2 symbiotes.',
    description: "Le corps du personnage abrite 1D4 symbiotes.",
  })

  await ins({
    name: 'Tentacule rétractable', cost_pc: 1, is_unique: true,
    d100_range_start: 93, d100_range_end: 95,
    special_effect: 'Peut faire jaillir un tentacule utilisable comme membre normal.',
    description: "Le personnage peut faire jaillir de son organisme un tentacule dont il peut se servir comme d'un nouveau membre.",
  })

  const visionNoc = await ins({
    name: 'Vision nocturne', cost_pc: 3, is_unique: true,
    d100_range_start: 96, d100_range_end: 100,
    special_effect: 'Vision nocturne parfaite si source lumineuse présente. Ténèbres totales: aveugle.',
    description: "Le personnage voit parfaitement bien la nuit, tant qu'il existe une quelconque source lumineuse.",
  })

  // ─── Skills ─────────────────────────────────────────────────────────────────

  await knex('ref_mutation_skills').insert([
    { mutation_id: adExt,      skill_name: 'Adaptation extérieure', skill_attrs: 'CON/CON', skill_base: -3, cost_mult: 1.0 },
    { mutation_id: amphibie,   skill_name: 'Hybride',               skill_attrs: 'CON/COO', skill_base: -3, cost_mult: 1.0 },
    { mutation_id: contagion,  skill_name: 'Contagion',             skill_attrs: 'CON/VOL', skill_base: -4, cost_mult: 2.0 },
    { mutation_id: empathie,   skill_name: 'Empathie',              skill_attrs: 'VOL/PRE', skill_base: -3, cost_mult: 2.0 },
    { mutation_id: instab,     skill_name: 'Contrôle moléculaire',  skill_attrs: 'CON/VOL', skill_base: -4, cost_mult: 2.0 },
    { mutation_id: metamorphe, skill_name: 'Métamorphose',          skill_attrs: 'CON/VOL', skill_base: -3, cost_mult: 2.0 },
    { mutation_id: purulence,  skill_name: 'Purulence',             skill_attrs: 'CON/VOL', skill_base: -4, cost_mult: 1.0 },
    { mutation_id: queue,      skill_name: 'Agilité caudale',       skill_attrs: 'COO/COO', skill_base: -4, cost_mult: 1.0 },
    { mutation_id: radiation,  skill_name: 'Radiations',            skill_attrs: 'CON/VOL', skill_base: -3, cost_mult: 2.0 },
    { mutation_id: sonar,      skill_name: 'Sonar',                 skill_attrs: 'PER/PER', skill_base: -4, cost_mult: 1.0 },
  ])

  // ─── Subtypes (Caractère génétique animal uniquement) ────────────────────────

  await knex('ref_mutation_subtypes').insert([
    { mutation_id: cga, name: 'Caractère félin',     d4_roll: 1, mod_COO: 2, skill_bonus: 'Acrobatie/Équilibre:+3', immunity: 'vertige' },
    { mutation_id: cga, name: 'Caractère canin',     d4_roll: 2, mod_CON: 1, skill_bonus: 'Perception(odorat):+3' },
    { mutation_id: cga, name: 'Caractère reptilien', d4_roll: 3, mod_COO: 1, skill_bonus: 'Perception(odorat):+3;Évasion:+3', special_trait: 'Se faufiler dans espaces étroits' },
    { mutation_id: cga, name: 'Caractère simiesque', d4_roll: 4, mod_FOR: 1, mod_COO: 1, skill_bonus: 'Escalade:+3' },
  ])

  // ─── Discounts ───────────────────────────────────────────────────────────────
  // Source discount : la mutation parente (CGA) → cible discount
  // (Toutes les remises CGA utilisent l'ID de CGA, pas celui du sous-type)

  await knex('ref_mutation_discounts').insert([
    { mutation_id: cga,       target_mutation_id: ids['Griffes'],                        discount_amount: 1 },
    { mutation_id: cga,       target_mutation_id: visionNoc,                             discount_amount: 3 },
    { mutation_id: cga,       target_mutation_id: ids['Crocs'],                          discount_amount: 1 },
    { mutation_id: cga,       target_mutation_id: queue,                                 discount_amount: 1 },
    { mutation_id: radiation, target_mutation_id: ids['Résistance naturelle.radiation'], discount_amount: 1 },
  ])

  // ─── Incompatibilities ───────────────────────────────────────────────────────
  // mutation_id_a < mutation_id_b requis par contrainte chk_inc_order

  await knex('ref_mutation_incompatibilities').insert(
    [
      [parasite, symbiote],
      [parasite, regen],
      [symbiote, regen],
    ].map(([a, b]) => ({
      mutation_id_a: Math.min(a, b),
      mutation_id_b: Math.max(a, b),
    }))
  )
}

exports.down = async (knex) => {
  await knex('ref_mutation_incompatibilities').del()
  await knex('ref_mutation_discounts').del()
  await knex('ref_mutation_skills').del()
  await knex('ref_mutation_subtypes').del()
  await knex('ref_mutations').del()
}
