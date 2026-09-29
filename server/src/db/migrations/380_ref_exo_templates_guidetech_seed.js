// 380_ref_exo_templates_guidetech_seed.js — docs/PLANS/PLAN_EXOGT.md
//
// Première passe de peuplement du Guide Technique dans ref_exo_templates (source_id =
// 'guide_technique'). Ne contient QUE les champs transcrits sans la moindre ambiguïté depuis
// docs/REGLES/GUIDE_TECHNIQUE_ARMURES.md — 26 des 36 fiches du Guide. Les 10 fiches exclues
// (catégorie hors énumération existante, ou Exo-Force non numérique) et tous les champs laissés
// de côté sur les 26 insérées (vitesses, modes de déplacement, malus d'initiative non désambiguïsés,
// armement/systèmes) sont documentés en détail dans docs/PLANS/PLAN_EXOGT.md — jamais devinés ici.
//
// Profondeurs en mètres, valeur absolue (même convention que 307_ref_exo_templates_seed.js).
// Prix en sols, entier (« 8,7 millions » → 8700000, virgule = séparateur décimal français).
// tech_level : « / » normalisé en « - » pour matcher la convention déjà en place (ex. « III-IV »).
// underwater_movement_mode / surface_movement_mode : laissés au défaut schéma ('vit') — PAS
// vérifiés contre la source (la notation vitesse du Guide Technique n'est pas encore décodée,
// PLAN_EXOGT.md). base_speed_underwater / base_speed_surface : volontairement NULL, même raison.
//
// Idempotent par clé naturelle (name, source_id) — cf. UNIQUE posée par 373/379 — pas d'onConflict
// nécessaire ici puisque cette migration ne s'exécute qu'une fois (jamais rejouée après application).

export const up = async (knex) => {
  const source = await knex('ref_sources').where({ code: 'guide_technique' }).first()
  if (!source) throw new Error('[380] ref_sources.code = \'guide_technique\' introuvable — migration 377 doit être appliquée avant celle-ci')

  const rows = [
    // ─── Sous-marines (9/12 — Moloch, Oméga, Orka exclues, cf. PLAN_EXOGT.md) ──────────────────
    { name: 'Faust', category: 'exo-4', environment: 'submarine', depth_operational: 17500, depth_limit: 21000, depth_crush: 26250, base_exoforce: 91, base_blindage: 6, manufacturer: 'Meklar Industrie (Hégémonie)', price: 8833000, rarity: '-5 (1)', tech_level: 'IV', autonomy: 'RTGc (en années)', malus_init_underwater: -5, malus_init_surface: -10 },
    { name: 'Mentor', category: 'exo-2', environment: 'submarine', depth_operational: 12000, depth_limit: 14400, depth_crush: 18000, base_exoforce: 68, base_blindage: 37, manufacturer: 'Meklar Industrie (Hégémonie)', price: 1750000, rarity: '5 (10)', tech_level: 'III', autonomy: 'RTGc (en années)', malus_init_underwater: -3, malus_init_surface: -6 },
    { name: 'Noelid', category: 'exo-1', environment: 'submarine', depth_operational: 12000, depth_limit: 14400, depth_crush: 18000, base_exoforce: 62, base_blindage: 44, manufacturer: 'Meklar Industrie (Hégémonie)', price: 2860000, rarity: '-5 (1)', tech_level: 'IV', autonomy: 'RTGc NT IV (plusieurs années)', malus_init_underwater: -2, malus_init_surface: -4 },
    { name: 'Nymph 1-A', category: 'exo-0', environment: 'submarine', depth_operational: 8000, depth_limit: 9600, depth_crush: 12000, base_exoforce: 51, base_blindage: 22, manufacturer: 'Gladius (Culte du Trident/Veilleurs)', price: 420000, rarity: '10 (15)', tech_level: 'III', autonomy: 'THCc (13 heures)', malus_init_underwater: -2, malus_init_surface: -4 },
    { name: 'Odin', category: 'exo-3', environment: 'submarine', depth_operational: 18000, depth_limit: 21600, depth_crush: 27000, base_exoforce: 77, base_blindage: 4, manufacturer: 'Odin Industrie (Indépendant)', price: 20000000, rarity: '1 (5)', tech_level: 'III', autonomy: 'en années (RTGc)', malus_init_underwater: -4, malus_init_surface: -8 },
    { name: 'Série A', category: 'exo-0', environment: 'submarine', depth_operational: 2000, depth_limit: 2400, depth_crush: 3000, base_exoforce: 51, base_blindage: 16, manufacturer: 'Indus Conglomérat (Royaume de l\'Indus)', price: 40113, rarity: '10 (15)', tech_level: 'II', autonomy: '12 heures (THCc)', malus_init_underwater: -2, malus_init_surface: -4 },
    // Sirya IV : malus d'initiative donné en une seule valeur non étiquetée (« -2 ») — laissé à 0/0, cf. PLAN_EXOGT.md.
    { name: 'Sirya IV', category: 'exo-0', environment: 'submarine', depth_operational: 14600, depth_limit: 17520, depth_crush: 21900, base_exoforce: 51, base_blindage: 37, manufacturer: 'Varan Technologie (Ligue Rouge)', price: 238000, rarity: '5 (10)', tech_level: 'III', autonomy: 'THCc pour 8 heures' },
    // Syd : même cas que Sirya IV (« -3 » non étiqueté).
    { name: 'Syd', category: 'exo-2', environment: 'submarine', depth_operational: 14000, depth_limit: 16800, depth_crush: 21000, base_exoforce: 68, base_blindage: 42, manufacturer: 'Varan Technologie (Ligue Rouge)', price: 2435000, rarity: '1 (5)', tech_level: 'III', autonomy: 'RTGc (en années)' },
    { name: 'Vulcain', category: 'exo-3', environment: 'submarine', depth_operational: 12000, depth_limit: 16800, depth_crush: 18000, base_exoforce: 77, base_blindage: 6, manufacturer: 'Odin Industrie (Indépendant)', price: 2450000, rarity: '5 (10)', tech_level: 'III', autonomy: 'en années (RTGc) ou 24 heures (THCc) ou câble', malus_init_underwater: -5, malus_init_surface: -10 },

    // ─── Terrestres (9/12 — Condor, Enigma, Exo-Sol exclues, cf. PLAN_EXOGT.md) ────────────────
    { name: 'Bulldog', category: 'exo-1', environment: 'surface', base_exoforce: 79, base_blindage: 23, manufacturer: 'Inconnu', price: null, rarity: 'Introuvable', tech_level: 'II', autonomy: 'moteur diesel de type inconnu pour 12 heures', malus_init_underwater: 0, malus_init_surface: -2 },
    { name: 'Cobalt', category: 'exo-alpha', environment: 'surface', base_exoforce: 43, base_blindage: 25, manufacturer: 'Inconnu (Légion du Cobalt)', price: null, rarity: 'Introuvable', tech_level: 'II-III', autonomy: 'batterie THC (12h + capteurs solaires)', malus_init_underwater: 0, malus_init_surface: -4 },
    { name: 'Cougar', category: 'exo-2', environment: 'surface', depth_operational: 100, depth_limit: 120, depth_crush: 150, base_exoforce: 43, base_blindage: 12, manufacturer: 'Melian OP (Ligue rouge)', price: 270910, rarity: '5 (10)', tech_level: 'III', autonomy: 'micro-réacteur à fusion azuréen pressurisé (95 ans) ou RTG NT III', malus_init_underwater: 0, malus_init_surface: 0 },
    // Éclipse : profondeur donnée malgré la section Terrestres (armure amphibie) — malus d'initiative
    // (« -2 » non étiqueté) laissé à 0/0, ambigu du fait de cette capacité de plongée, cf. PLAN_EXOGT.md.
    { name: 'Éclipse', category: 'exo-0', environment: 'surface', depth_operational: 200, depth_limit: 240, depth_crush: 300, base_exoforce: 40, base_blindage: 21, manufacturer: 'Gladius (Culte du Trident)', price: 2300000, rarity: '-15 (-10)', tech_level: 'IV', autonomy: 'PACAR (32 heures)' },
    // Endoval Mrk II : une seule profondeur donnée (« 100 m »), pas de triplet — limite/écrasement
    // laissés NULL plutôt que déduits d'un ratio (le ratio x1,2/x1,5 vu ailleurs n'est pas universel,
    // cf. Assassin ci-dessous). Malus (« -2 » non étiqueté) laissé à 0/0, même raison qu'Éclipse.
    { name: 'Endoval Mrk II', category: 'exo-0', environment: 'surface', depth_operational: 100, base_exoforce: 49, base_blindage: 32, manufacturer: 'Varan Technologie (Ligue Rouge)', price: 750000, rarity: '1 (5)', tech_level: 'III', autonomy: 'THC/9 heures (batterie rechargeable par capteurs solaires)' },
    { name: 'Jaguar', category: 'exo-0', environment: 'surface', depth_operational: 500, depth_limit: 600, depth_crush: 750, base_exoforce: 47, base_blindage: 24, manufacturer: 'Meklar Industrie (Hégémonie)', price: 408000, rarity: '-5 (1)', tech_level: 'III', autonomy: 'PE Généticien / 24 heures (capteurs solaires régénèrent 1 minute en 10 minutes)', malus_init_underwater: 0, malus_init_surface: 0 },
    { name: 'Solar 1', category: 'exo-0', environment: 'surface', depth_operational: 100, base_exoforce: 46, base_blindage: 36, manufacturer: 'Meklar Industrie (Hégémonie)', price: 3800000, rarity: '-10 (1)', tech_level: 'III-IV', autonomy: 'PE Généticien (9 heures)', malus_init_underwater: 0, malus_init_surface: 0 },
    // Varan : « Modificateur d'initiative : +1 » — un BONUS, pas un malus, nom de champ différent de
    // toutes les autres fiches. Aucune colonne malus_init ne correspond proprement à un bonus positif
    // sans convention confirmée (−1 pour représenter un bonus de +1 ?) — laissé à 0/0, cf. PLAN_EXOGT.md.
    { name: 'Varan', category: 'exo-alpha', environment: 'surface', depth_operational: 500, depth_limit: 550, depth_crush: 750, base_exoforce: 34, base_blindage: 17, manufacturer: 'Melian OP (Ligue rouge)', price: 267410, rarity: '-10 (5)', tech_level: 'III', autonomy: 'PACAR (6h à 41 km/h ou 16 heures à 26 km/h)' },
    { name: 'Vauban', category: 'exo-1', environment: 'surface', depth_operational: 100, depth_limit: 120, depth_crush: 150, base_exoforce: 41, base_blindage: 17, manufacturer: 'Empire des Généticiens', price: 750000, rarity: '10 (15)', tech_level: 'IV', autonomy: '30 ans (micro-réacteur à fusion pressurisé généticien)', malus_init_underwater: 0, malus_init_surface: -2 },

    // ─── Hybrides (8/12 — Explora, Pirate Classique, Sylaco, Sylph 56 exclues, cf. PLAN_EXOGT.md) ─
    { name: 'Assassin', category: 'exo-alpha', environment: 'hybrid', depth_operational: 17000, depth_limit: 17000, depth_crush: 25500, base_exoforce: 29, base_blindage: 17, manufacturer: 'Inconnu (Hégémonie)', price: 3100000, rarity: '-10 (-1)', tech_level: 'VI', autonomy: 'PE Généticien (13,5 heures avec PIT)', malus_init_underwater: 0, malus_init_surface: 0 },
    { name: 'Heimdall-Pyrelia', category: 'exo-2', environment: 'hybrid', depth_operational: 10000, depth_limit: 12000, depth_crush: 15000, base_exoforce: 68, base_blindage: 33, manufacturer: 'Pyrelia Industrie (République du Corail)', price: 1600000, rarity: '5 (10)', tech_level: 'III', autonomy: '3 heures (batteries THCc)', malus_init_underwater: -3, malus_init_surface: -6 },
    { name: 'Impériale', category: 'exo-0', environment: 'hybrid', depth_operational: 20000, depth_limit: 24000, depth_crush: 30000, base_exoforce: 51, base_blindage: 73, manufacturer: 'Empire Généticien (Hégémonie)', price: 8700000, rarity: 'Introuvable', tech_level: 'VI', autonomy: 'générateur à fusion pressurisé généticien / 250 ans', malus_init_underwater: -1, malus_init_surface: -2 },
    { name: 'Ouraken', category: 'exo-2', environment: 'hybrid', depth_operational: 12080, depth_limit: 14500, depth_crush: 18120, base_exoforce: 71, base_blindage: 39, manufacturer: 'Gladius (Culte du Trident/Veilleurs)', price: 6000000, rarity: '1 (5)', tech_level: 'III-IV', autonomy: 'en années (RTGc NT IV)', malus_init_underwater: -3, malus_init_surface: -6 },
    { name: 'Overlord', category: 'exo-1', environment: 'hybrid', depth_operational: 20000, depth_limit: 24000, depth_crush: 30000, base_exoforce: 62, base_blindage: 46, manufacturer: 'Empire des Généticiens', price: null, rarity: 'Introuvable', tech_level: 'V-VI', autonomy: '300 ans (micro-moteur à fusion pressurisé généticien)', malus_init_underwater: 0, malus_init_surface: 0 },
    { name: 'Pirate (Lourde)', category: 'exo-alpha', environment: 'hybrid', depth_operational: 10160, depth_limit: 10160, depth_crush: 15240, base_exoforce: 29, base_blindage: 14, manufacturer: 'Pirates', price: 120000, rarity: '-5 (1)', tech_level: 'III', autonomy: '12 heures (THCc) ou 3 heures avec un PIT', malus_init_underwater: 0, malus_init_surface: 0 },
    { name: 'Typhon', category: 'exo-alpha', environment: 'hybrid', depth_operational: 7000, depth_limit: 8400, depth_crush: 10500, base_exoforce: 30, base_blindage: 15, manufacturer: 'Melian OP (Ligue rouge)', price: 300000, rarity: '5 (10)', tech_level: 'III', autonomy: '100 ans (micro-réacteur à fusion pressurisé azuréen) ou RTGc', malus_init_underwater: 0, malus_init_surface: 0 },
    { name: 'Vanguard', category: 'exo-1', environment: 'hybrid', depth_operational: 4000, depth_limit: 4800, depth_crush: 6000, base_exoforce: 62, base_blindage: 16, manufacturer: 'Alliance Azur', price: 3400000, rarity: '10 (15)', tech_level: 'III-IV', autonomy: '150 ans (micro-réacteur à fusion pressurisé azuréen)', malus_init_underwater: -2, malus_init_surface: -4 },
  ]

  await knex('ref_exo_templates').insert(rows.map(row => ({ ...row, source_id: source.id })))
  console.log(`[380] ${rows.length} fiches Guide Technique insérées dans ref_exo_templates (source_id = guide_technique)`)
}

export const down = async (knex) => {
  const source = await knex('ref_sources').where({ code: 'guide_technique' }).first()
  if (!source) return
  await knex('ref_exo_templates').where({ source_id: source.id }).delete()
}
