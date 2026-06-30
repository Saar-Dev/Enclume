// 95_seed_ref_mutations.js
// Seed des 50 mutations Polaris dans les tables crÃ©Ã©es par 95_new_ref_mutations.js.
// Source : docs/Character/Creation/migrations/96_ref_mutations.cjs (SQL brut converti en Knex JS).

export const up = async (knex) => {
  const ids = {}

  async function ins(data) {
    const [{ mutation_id }] = await knex('ref_mutations').insert(data).returning('mutation_id')
    const key = data.name + (data.subtype ? '.' + data.subtype : '')
    ids[key] = mutation_id
    return mutation_id
  }

  // â”€â”€â”€ Mutations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const adExt = await ins({
    name: 'Adaptation extÃ©rieure', cost_pc: 3, is_unique: true,
    d100_range_start: 1, d100_range_end: 6,
    special_effect: "Heures dehors = niveau de compÃ©tence. RÃ©cupÃ©ration = 3Ã— durÃ©e exposition.",
    description: "Le personnage possÃ¨de une rÃ©sistance aux effets nÃ©fastes de la Surface (radiations, aciditÃ© de l'air, altÃ©ration molÃ©culaireâ€¦).",
  })

  const amphibie = await ins({
    name: 'Amphibie', cost_pc: 2, is_unique: true,
    d100_range_start: 7, d100_range_end: 10,
    special_effect: 'Max niveau +0. Profondeur max = niveauÃ—500m. Ne peut dÃ©passer CON en mÃ¨tres si niveau < 1.',
    description: "Le personnage est dotÃ© d'une mutation similaire Ã  celle des hybrides naturels, mais imparfaitement dÃ©veloppÃ©e. Respire sous l'eau.",
  })

  await ins({
    name: 'Androgyne', cost_pc: 0, is_unique: true, mod_sex: 'androgyne',
    d100_range_start: 11, d100_range_end: 13,
    description: 'Physiquement, le personnage tient des deux sexes.',
  })

  await ins({
    name: 'AsexuÃ©', cost_pc: 0, is_unique: true, mod_sex: 'asexue', mod_fertility: 'sterile',
    d100_range_start: 14, d100_range_end: 16,
    description: 'Le personnage est nÃ© sans sexe. Il est donc stÃ©rile.',
  })

  await ins({
    name: 'AutofÃ©condation', cost_pc: 0, is_unique: true, mod_sex: 'asexue', mod_fertility: 'self_fertile',
    d100_range_start: 17, d100_range_end: 19,
    description: "Le personnage ne possÃ¨de pas d'organes reproducteurs mais peut s'autofÃ©conder et mettre un enfant au monde.",
  })

  const cga = await ins({
    name: 'CaractÃ¨re gÃ©nÃ©tique animal', cost_pc: 2, is_unique: true, has_subtable: true,
    d100_range_start: 20, d100_range_end: 23,
    description: 'Le personnage prÃ©sente un fort caractÃ¨re gÃ©nÃ©tique animal. Morphologie altÃ©rÃ©e, fourrure, Ã©cailles, traits animaux. Lancez 1D4.',
  })

  await ins({
    name: 'Contact corrosif', cost_pc: 3, is_stackable: true, stack_effect: '+3 dÃ©gÃ¢ts par stack',
    d100_range_start: 24, d100_range_end: 25,
    special_effect: '1D10 dÃ©gÃ¢ts base. Continue 3D6 rounds tant que non nettoyÃ© (eau). DÃ©gÃ¢ts indÃ©pendants de toute autre action.',
    description: "La peau du personnage sÃ©crÃ¨te Ã  volontÃ© une substance corrosive.",
  })

  const contagion = await ins({
    name: 'Contagion', cost_pc: 3, is_unique: true, mod_res_disease: 9999,
    d100_range_start: 26, d100_range_end: 27,
    special_effect: 'Contagion passive permanente (Grippe bleue contact peau). ContrÃ´le: Test Contagion. Virulence: +0â†’1D6, -3â†’2D6, -5â†’3D6, -7â†’4D6, -10â†’5D6. Victime dÃ©veloppe maladie en 2D6h - MR.',
    description: "Le personnage est nourri des bactÃ©ries qui vivent en symbiose avec lui. ImmunisÃ© aux maladies. Contagion invisible (contrairement Ã  Purulence).",
  })

  await ins({
    name: 'Corne', cost_pc: 1, is_unique: true,
    d100_range_start: 28, d100_range_end: 30,
    special_effect: 'AprÃ¨s saisie: 1D10 + mod CaC. Si tÃªte: +1D6 Choc.',
    description: "Le personnage est dotÃ© d'une petite corne sur le front.",
  })

  await ins({
    name: 'Crocs', cost_pc: 1, is_unique: true,
    d100_range_start: 31, d100_range_end: 35,
    special_effect: 'AprÃ¨s saisie: 1D10+3 + mod CaC.',
    description: "Le personnage est dotÃ© de crocs ou ses dents sont extrÃªmement tranchantes.",
  })

  await ins({
    name: 'DifformitÃ©s', subtype: 'minor', cost_pc: 1, is_stackable: true, mod_PRE: -1,
    d100_range_start: 36, d100_range_end: 40,
    description: "DifformitÃ© lÃ©gÃ¨re. PrÃ©sence -1. Cumulable avec d'autres difformitÃ©s.",
  })

  await ins({
    name: 'DifformitÃ©s', subtype: 'major', cost_pc: 3, is_stackable: true, mod_PRE: -2,
    d100_range_start: 41, d100_range_end: 43,
    description: "DifformitÃ© importante. PrÃ©sence -2. Cumulable avec d'autres difformitÃ©s.",
  })

  const empathie = await ins({
    name: 'Empathie', cost_pc: 4, is_unique: true,
    d100_range_start: 44, d100_range_end: 46,
    special_effect: 'Communication corail (-7), animaux (-3). Ã‰motions individus: malus VOL cible/2. Modification: Test opposÃ© VOL, MR = rounds. Ã‰chec critique: cible alertÃ©e. Progression par Ã©tapes. Lieux imprÃ©gnÃ©s (-13).',
    description: "Cette mutation donne accÃ¨s Ã  la CompÃ©tence spÃ©ciale Empathie. Permet de ressentir et modifier les Ã©motions.",
  })

  await ins({
    name: 'Excroissance osseuse rÃ©tractable', cost_pc: 3, is_unique: true,
    d100_range_start: 47, d100_range_end: 49,
    special_effect: 'Arme: Combat Ã  mains nues, 2D10 + mod CaC.',
    description: "Le personnage peut faire jaillir d'un de ses avant-bras une excroissance osseuse.",
  })

  await ins({
    name: 'Griffes', cost_pc: 2, is_unique: true,
    d100_range_start: 50, d100_range_end: 52,
    special_effect: 'DÃ©gÃ¢ts: 1D10+3 + mod CaC. Bonus: Escalade +3 (si griffes utilisables). Malus: dextÃ©ritÃ© manuelle -3.',
    description: "Le personnage est dotÃ© de griffes.",
  })

  const instab = await ins({
    name: 'InstabilitÃ© molÃ©culaire', cost_pc: 4, is_unique: true,
    d100_range_start: 53, d100_range_end: 53,
    special_effect: 'Transformation volontaire: 2D10 rounds. Organes: auditif -3, visuel -5, tentacule -7 (FOR 3). Reprise: -3 (â‰¤10min), -7 (â‰¤1h), -1/h supp. Ã‰chec reprise: difficultÃ© +1 cumulatif. Ã‰chec impossible: FOR ou CON -1 dÃ©finitif. Stress â†’ Test involontaire.',
    description: "La structure molÃ©culaire du personnage peut Ãªtre modifiÃ©e, volontairement ou involontairement.",
  })

  const metamorphe = await ins({
    name: 'MÃ©tamorphe', cost_pc: 4, is_unique: true,
    d100_range_start: 54, d100_range_end: 56,
    special_effect: "Apparence physique seulement. ManiÃ¨res: Test DÃ©guisement/Imitation avec bonus MR. Forme humanoÃ¯de uniquement. Attributs/compÃ©tences inchangÃ©s.",
    description: "Cette mutation permet de prendre l'apparence physique d'un individu.",
  })

  for (const [subtype, cost_pc, description] of [
    ['taste',   0, 'Papilles gustatives atrophiÃ©es.'],
    ['smell',   0, 'Nez atrophiÃ©.'],
    ['touch',   0, 'Sens du toucher atrophiÃ©.'],
    ['hearing', 1, 'Oreille manquante.'],
    ['sight',   2, 'Å’il manquant.'],
  ]) {
    await ins({
      name: 'Organe sensoriel manquant', subtype, cost_pc, is_unique: true,
      d100_range_start: 57, d100_range_end: 58,
      special_effect: 'Sens diminuÃ© -5. Cumulable avec DÃ©savantage Sens diminuÃ©.',
      description,
    })
  }

  for (const [subtype, cost_pc, description] of [
    ['taste',   0, 'GoÃ»t amÃ©liorÃ©.'],
    ['smell',   1, 'Odorat amÃ©liorÃ©.'],
    ['touch',   1, 'Toucher amÃ©liorÃ©.'],
    ['hearing', 2, 'Oreille supplÃ©mentaire.'],
    ['sight',   2, 'Å’il supplÃ©mentaire.'],
  ]) {
    await ins({
      name: 'Organe sensoriel supplÃ©mentaire ou amÃ©liorÃ©', subtype, cost_pc, is_unique: true,
      d100_range_start: 59, d100_range_end: 60,
      special_effect: 'Sens dÃ©veloppÃ© +5. Cumulable avec Avantage Sens dÃ©veloppÃ©.',
      description,
    })
  }

  const parasite = await ins({
    name: 'Parasite', cost_pc: 1, is_unique: true,
    max_cumul_group: 'parasite_symbiote_regen', max_cumul_limit: 2,
    d100_range_start: 61, d100_range_end: 61,
    special_effect: '1D4 parasites. RÃ©sistance dommages -1 par 2 parasites. Attaque 1D10+N parasites/semaine (ou si pas assez nourri). Nourriture Ã—2. Retrait: CON -1 par 2 parasites. Tirage mutation bonus alÃ©atoire.',
    description: "Le personnage abrite 1D4 parasites. Il doit manger et boire deux fois plus.",
  })

  await ins({
    name: 'Peau renforcÃ©e', cost_pc: 2, is_stackable: true,
    stack_effect: '+2 armure naturelle par stack', natural_armor: 3,
    d100_range_start: 62, d100_range_end: 66,
    description: "La peau du personnage, sombre et rÃ¢peuse, lui confÃ¨re une armure naturelle de 3 points.",
  })

  const purulence = await ins({
    name: 'Purulence', cost_pc: -2, is_stackable: true,
    stack_effect: 'PRE -1, RÃ©sistance maladies +2 par stack',
    mod_PRE: -2, mod_res_disease: 3,
    d100_range_start: 67, d100_range_end: 67,
    special_effect: 'Social -5 si apparence visible. Contagion 1 sem/3 mois (Grippe bleue). ContrÃ´le: Test Purulence/jour, malus -1 cumulatif/jour. Attaque: contact peau, opp CON cible, 3D10+MR. Cadavre contagieux.',
    description: "La peau de l'individu est couverte de pustules. PrÃ©sence rÃ©duite de 2 (minimum 3).",
  })

  const queue = await ins({
    name: 'Queue', cost_pc: 1, is_unique: true,
    d100_range_start: 68, d100_range_end: 70,
    special_effect: 'CompÃ©tence limitative: Acrobatie/Ã‰quilibre, Armes de poing (petites), Combat armÃ© (petites armes, pas mod CaC), Combat Ã  mains nues (1D10/2 + mod CaC).',
    description: "Le personnage est dotÃ© d'une queue. Il peut apprendre Ã  manipuler des objets avec.",
  })

  const radiation = await ins({
    name: 'Radiation', cost_pc: 3, is_stackable: true, stack_effect: '+3 irradiation par stack',
    d100_range_start: 71, d100_range_end: 71,
    special_effect: '2D6 irradiation + MR au contact.',
    description: "Cette mutation permet de libÃ©rer un flot de radiations dans l'organisme d'une victime par simple contact. Offre gratuitement RÃ©sistance naturelle (radiation).",
  })

  const regen = await ins({
    name: 'RÃ©gÃ©nÃ©ration', cost_pc: 2, is_stackable: true,
    stack_effect: 'Bonus stabilisation +1, guÃ©rison Ã·3 (au lieu de Ã·2)',
    max_cumul_group: 'parasite_symbiote_regen', max_cumul_limit: 2,
    d100_range_start: 72, d100_range_end: 75,
    special_effect: 'Stabilisation +2, infection +3, guÃ©rison Ã·2. Nourriture Ã—2 sinon 1D10+3/jour.',
    description: "Le personnage rÃ©gÃ©nÃ¨re plus rapidement ses blessures. Ne permet pas de rÃ©cupÃ©rer un membre ou un organe dÃ©truit.",
  })

  for (const [subtype, mod_res_damage, mod_res_drugs, mod_res_disease, mod_res_poison, mod_res_radiation, special_effect, description] of [
    ['fire',      3, 0, 0, 0, 0, 'ImmunisÃ© chaleur.',               'RÃ©sistance au feu. RÃ©duit les dommages de feu de 3 points. Insensible Ã  la chaleur.'],
    ['cold',      3, 0, 0, 0, 0, "ImmunisÃ© froid jusqu'Ã  -10Â°C.",   'RÃ©sistance au froid. RÃ©duit les dommages de froid de 3 points.'],
    ['drugs',     0, 3, 0, 0, 0, null,                               'RÃ©sistance aux drogues augmentÃ©e de 3 points.'],
    ['disease',   0, 0, 3, 0, 0, null,                               'RÃ©sistance aux maladies augmentÃ©e de 3 points.'],
    ['poison',    0, 0, 0, 3, 0, null,                               'RÃ©sistance au poison augmentÃ©e de 3 points.'],
    ['radiation', 0, 0, 0, 0, 3, null,                               'RÃ©sistance aux radiations augmentÃ©e de 3 points.'],
  ]) {
    await ins({
      name: 'RÃ©sistance naturelle', subtype, cost_pc: 1, is_stackable: true,
      stack_effect: `+1 RÃ©sistance ${subtype} par stack`,
      mod_res_damage, mod_res_drugs, mod_res_disease, mod_res_poison, mod_res_radiation,
      special_effect,
      d100_range_start: 76, d100_range_end: 80,
      description,
    })
  }

  await ins({
    name: 'SixiÃ¨me sens', cost_pc: 1, is_unique: true,
    d100_range_start: 81, d100_range_end: 85,
    special_effect: 'Bonus +3 Tests de RÃ©action en cas de Surprise.',
    description: "Le personnage bÃ©nÃ©ficie d'un bonus de +3 Ã  ses Tests de RÃ©action en cas de Surprise.",
  })

  const sonar = await ins({
    name: 'Sonar', cost_pc: 3, is_unique: true,
    d100_range_start: 86, d100_range_end: 88,
    special_effect: 'PortÃ©e = INT mÃ¨tres. Onde sonique: 2D10, modificateurs combat distance.',
    description: "Le personnage est dotÃ© d'une sorte de sonar pour repÃ©rer des obstacles sous l'eau ou dans le noir.",
  })

  await ins({
    name: 'Squelette renforcÃ©', cost_pc: 3, is_stackable: true,
    stack_effect: '+1 RÃ©sistance dommages, +1 RÃ©sistance Choc par stack',
    mod_res_damage: 2, mod_res_shock: 3,
    d100_range_start: 89, d100_range_end: 89,
    description: "La RÃ©sistance aux dommages du personnage est augmentÃ©e de 2 points, et sa RÃ©sistance au Choc de 3 points.",
  })

  const symbiote = await ins({
    name: 'Symbiote', cost_pc: 3, is_unique: true,
    max_cumul_group: 'parasite_symbiote_regen', max_cumul_limit: 2,
    d100_range_start: 90, d100_range_end: 92,
    special_effect: '1D4 symbiotes. Nourriture Ã—2 sinon 1D10+N/jour. Choix par symbiote: +2 RÃ©sistance naturelle OU mutation alÃ©atoire. Retrait: CON -1 par 2 symbiotes.',
    description: "Le corps du personnage abrite 1D4 symbiotes.",
  })

  await ins({
    name: 'Tentacule rÃ©tractable', cost_pc: 1, is_unique: true,
    d100_range_start: 93, d100_range_end: 95,
    special_effect: 'Peut faire jaillir un tentacule utilisable comme membre normal.',
    description: "Le personnage peut faire jaillir de son organisme un tentacule dont il peut se servir comme d'un nouveau membre.",
  })

  const visionNoc = await ins({
    name: 'Vision nocturne', cost_pc: 3, is_unique: true,
    d100_range_start: 96, d100_range_end: 100,
    special_effect: 'Vision nocturne parfaite si source lumineuse prÃ©sente. TÃ©nÃ¨bres totales: aveugle.',
    description: "Le personnage voit parfaitement bien la nuit, tant qu'il existe une quelconque source lumineuse.",
  })

  // â”€â”€â”€ Skills â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  await knex('ref_mutation_skills').insert([
    { mutation_id: adExt,      skill_name: 'Adaptation extÃ©rieure', skill_attrs: 'CON/CON', skill_base: -3, cost_mult: 1.0 },
    { mutation_id: amphibie,   skill_name: 'Hybride',               skill_attrs: 'CON/COO', skill_base: -3, cost_mult: 1.0 },
    { mutation_id: contagion,  skill_name: 'Contagion',             skill_attrs: 'CON/VOL', skill_base: -4, cost_mult: 2.0 },
    { mutation_id: empathie,   skill_name: 'Empathie',              skill_attrs: 'VOL/PRE', skill_base: -3, cost_mult: 2.0 },
    { mutation_id: instab,     skill_name: 'ContrÃ´le molÃ©culaire',  skill_attrs: 'CON/VOL', skill_base: -4, cost_mult: 2.0 },
    { mutation_id: metamorphe, skill_name: 'MÃ©tamorphose',          skill_attrs: 'CON/VOL', skill_base: -3, cost_mult: 2.0 },
    { mutation_id: purulence,  skill_name: 'Purulence',             skill_attrs: 'CON/VOL', skill_base: -4, cost_mult: 1.0 },
    { mutation_id: queue,      skill_name: 'AgilitÃ© caudale',       skill_attrs: 'COO/COO', skill_base: -4, cost_mult: 1.0 },
    { mutation_id: radiation,  skill_name: 'Radiations',            skill_attrs: 'CON/VOL', skill_base: -3, cost_mult: 2.0 },
    { mutation_id: sonar,      skill_name: 'Sonar',                 skill_attrs: 'PER/PER', skill_base: -4, cost_mult: 1.0 },
  ])

  // â”€â”€â”€ Subtypes (CaractÃ¨re gÃ©nÃ©tique animal uniquement) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  await knex('ref_mutation_subtypes').insert([
    { mutation_id: cga, name: 'CaractÃ¨re fÃ©lin',     d4_roll: 1, mod_COO: 2, skill_bonus: 'Acrobatie/Ã‰quilibre:+3', immunity: 'vertige' },
    { mutation_id: cga, name: 'CaractÃ¨re canin',     d4_roll: 2, mod_CON: 1, skill_bonus: 'Perception(odorat):+3' },
    { mutation_id: cga, name: 'CaractÃ¨re reptilien', d4_roll: 3, mod_COO: 1, skill_bonus: 'Perception(odorat):+3;Ã‰vasion:+3', special_trait: 'Se faufiler dans espaces Ã©troits' },
    { mutation_id: cga, name: 'CaractÃ¨re simiesque', d4_roll: 4, mod_FOR: 1, mod_COO: 1, skill_bonus: 'Escalade:+3' },
  ])

  // â”€â”€â”€ Discounts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Source discount : la mutation parente (CGA) â†’ cible discount
  // (Toutes les remises CGA utilisent l'ID de CGA, pas celui du sous-type)

  await knex('ref_mutation_discounts').insert([
    { mutation_id: cga,       target_mutation_id: ids['Griffes'],                        discount_amount: 1 },
    { mutation_id: cga,       target_mutation_id: visionNoc,                             discount_amount: 3 },
    { mutation_id: cga,       target_mutation_id: ids['Crocs'],                          discount_amount: 1 },
    { mutation_id: cga,       target_mutation_id: queue,                                 discount_amount: 1 },
    { mutation_id: radiation, target_mutation_id: ids['RÃ©sistance naturelle.radiation'], discount_amount: 1 },
  ])

  // â”€â”€â”€ Incompatibilities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

export const down = async (knex) => {
  await knex('ref_mutation_incompatibilities').del()
  await knex('ref_mutation_discounts').del()
  await knex('ref_mutation_skills').del()
  await knex('ref_mutation_subtypes').del()
  await knex('ref_mutations').del()
}
