/**
 * Migration 24 — seed pack "structure-station"
 *
 * Pack de démarrage pour l'univers Polaris (hard-SF sous-marine).
 * UUID fixe — stable entre environnements.
 * Tous les blocs : geometry 'cube' en V1.
 * Chemins textures relatifs au pack : "sol/metal_plate_top.png"
 *   → MinIO : textures/structure-station/sol/metal_plate_top.png
 *
 * IDs auto-incrémentés depuis 1 — garantis par l'ordre d'insertion
 * et table block_types vide au moment du seed.
 */

const PACK_UUID = 'b4e8f2a1-9c3d-4e7f-8b2a-1d5e9f3c7b4e'

export const up = async (knex) => {
  // 1. Insérer le pack
  await knex('texture_packs').insert({
    id: PACK_UUID,
    name: 'structure-station',
    label: 'Structure de station',
    description: 'Stations sous-marines Polaris — sols, murs, fenêtres, équipements',
    tile_size: 128,
  })

  // 2. Insérer les catégories — récupérer leurs UUIDs pour les blocs
  const catIds = {}
  const categories = [
    { label: 'Sol',     sort_order: 0 },
    { label: 'Mur',     sort_order: 1 },
    { label: 'Fenêtre', sort_order: 2 },
    { label: 'Bloc',    sort_order: 3 },
  ]
  for (const cat of categories) {
    const [inserted] = await knex('texture_pack_categories')
      .insert({ pack_id: PACK_UUID, ...cat })
      .returning('id')
    catIds[cat.label] = inserted.id
  }

  // 3. Insérer les blocs — IDs auto-incrémentés depuis 1
  await knex('block_types').insert([

    // ── SOL ────────────────────────────────────────────────────────────────
    { pack_id: PACK_UUID, label: 'Plaque métal',          geometry: 'cube',
      textures: JSON.stringify({ top: 'sol/metal_plate_top.png', side: 'sol/metal_plate_side.png' }),
      category_id: catIds['Sol'], sort_order: 0 },

    { pack_id: PACK_UUID, label: 'Grille métal',          geometry: 'cube',
      textures: JSON.stringify({ all: 'sol/metal_grid.png' }),
      category_id: catIds['Sol'], sort_order: 1 },

    { pack_id: PACK_UUID, label: 'Caillebotis 1',         geometry: 'cube',
      textures: JSON.stringify({ all: 'sol/grating01.png' }),
      category_id: catIds['Sol'], sort_order: 2 },

    { pack_id: PACK_UUID, label: 'Caillebotis 2',         geometry: 'cube',
      textures: JSON.stringify({ all: 'sol/grating02.png' }),
      category_id: catIds['Sol'], sort_order: 3 },

    { pack_id: PACK_UUID, label: 'Caillebotis 3',         geometry: 'cube',
      textures: JSON.stringify({ all: 'sol/grating03.png' }),
      category_id: catIds['Sol'], sort_order: 4 },

    { pack_id: PACK_UUID, label: 'Caillebotis 4',         geometry: 'cube',
      textures: JSON.stringify({ all: 'sol/grating04.png' }),
      category_id: catIds['Sol'], sort_order: 5 },

    { pack_id: PACK_UUID, label: 'Passerelle',            geometry: 'cube',
      textures: JSON.stringify({ all: 'sol/footbridge01.png' }),
      category_id: catIds['Sol'], sort_order: 6 },

    { pack_id: PACK_UUID, label: 'Béton',                 geometry: 'cube',
      textures: JSON.stringify({ all: 'sol/concrete.png' }),
      category_id: catIds['Sol'], sort_order: 7 },

    { pack_id: PACK_UUID, label: 'Béton vert',            geometry: 'cube',
      textures: JSON.stringify({ all: 'sol/concrete_green.png' }),
      category_id: catIds['Sol'], sort_order: 8 },

    { pack_id: PACK_UUID, label: 'Béton rouillé',         geometry: 'cube',
      textures: JSON.stringify({ all: 'sol/concrete_rusty.png' }),
      category_id: catIds['Sol'], sort_order: 9 },

    { pack_id: PACK_UUID, label: 'Béton armé',            geometry: 'cube',
      textures: JSON.stringify({ all: 'sol/reinforced_concrete.png' }),
      category_id: catIds['Sol'], sort_order: 10 },

    { pack_id: PACK_UUID, label: 'Panneau blanc',         geometry: 'cube',
      textures: JSON.stringify({ all: 'sol/white_panel.png' }),
      category_id: catIds['Sol'], sort_order: 11 },

    { pack_id: PACK_UUID, label: 'Marquage jaune',        geometry: 'cube',
      textures: JSON.stringify({ all: 'sol/marking_yellow.png' }),
      category_id: catIds['Sol'], sort_order: 12 },

    { pack_id: PACK_UUID, label: 'Danger noir/jaune 1',   geometry: 'cube',
      textures: JSON.stringify({ all: 'sol/hazard_stripe_black_yellow01.png' }),
      category_id: catIds['Sol'], sort_order: 13 },

    { pack_id: PACK_UUID, label: 'Danger noir/jaune 2',   geometry: 'cube',
      textures: JSON.stringify({ all: 'sol/hazard_stripe_black_yellow02.png' }),
      category_id: catIds['Sol'], sort_order: 14 },

    { pack_id: PACK_UUID, label: 'Danger noir/vert',      geometry: 'cube',
      textures: JSON.stringify({ all: 'sol/hazard_stripe_black_green.png' }),
      category_id: catIds['Sol'], sort_order: 15 },

    { pack_id: PACK_UUID, label: 'Trappe',                geometry: 'cube',
      textures: JSON.stringify({ all: 'sol/trapdoor01.png' }),
      category_id: catIds['Sol'], sort_order: 16 },

    // ── MUR ────────────────────────────────────────────────────────────────
    { pack_id: PACK_UUID, label: 'Panneau métal 1',       geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/panel_metal01.png' }),
      category_id: catIds['Mur'], sort_order: 0 },

    { pack_id: PACK_UUID, label: 'Panneau métal 2',       geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/panel_metal02.png' }),
      category_id: catIds['Mur'], sort_order: 1 },

    { pack_id: PACK_UUID, label: 'Panneau métal 3',       geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/panel_metal03.png' }),
      category_id: catIds['Mur'], sort_order: 2 },

    { pack_id: PACK_UUID, label: 'Panneau blanc',         geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/white_panel.png' }),
      category_id: catIds['Mur'], sort_order: 3 },

    { pack_id: PACK_UUID, label: 'Prismarine 1',          geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/prismarine_wall01.png' }),
      category_id: catIds['Mur'], sort_order: 4 },

    { pack_id: PACK_UUID, label: 'Prismarine 2',          geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/prismarine_wall02.png' }),
      category_id: catIds['Mur'], sort_order: 5 },

    { pack_id: PACK_UUID, label: 'Roche andesite',        geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/rock_andesite.png' }),
      category_id: catIds['Mur'], sort_order: 6 },

    { pack_id: PACK_UUID, label: 'Roche brute',           geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/rock_brut.png' }),
      category_id: catIds['Mur'], sort_order: 7 },

    { pack_id: PACK_UUID, label: 'Roche granite',         geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/rock_granite.png' }),
      category_id: catIds['Mur'], sort_order: 8 },

    { pack_id: PACK_UUID, label: 'Roche polie',           geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/rock_polish.png' }),
      category_id: catIds['Mur'], sort_order: 9 },

    { pack_id: PACK_UUID, label: 'Roche pierre',          geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/rock_stone.png' }),
      category_id: catIds['Mur'], sort_order: 10 },

    { pack_id: PACK_UUID, label: 'Électronique 1',        geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/electronic01.png' }),
      category_id: catIds['Mur'], sort_order: 11 },

    { pack_id: PACK_UUID, label: 'Électronique 2',        geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/electronic02.png' }),
      category_id: catIds['Mur'], sort_order: 12 },

    { pack_id: PACK_UUID, label: 'Électronique 3',        geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/electronic03.png' }),
      category_id: catIds['Mur'], sort_order: 13 },

    { pack_id: PACK_UUID, label: 'Électronique 4',        geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/electronic04.png' }),
      category_id: catIds['Mur'], sort_order: 14 },

    { pack_id: PACK_UUID, label: 'Électronique 5',        geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/electronic05.png' }),
      category_id: catIds['Mur'], sort_order: 15 },

    { pack_id: PACK_UUID, label: 'Tech 1',                geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/tech01.png' }),
      category_id: catIds['Mur'], sort_order: 16 },

    { pack_id: PACK_UUID, label: 'Tech 2',                geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/tech02.png' }),
      category_id: catIds['Mur'], sort_order: 17 },

    { pack_id: PACK_UUID, label: 'Tech 3',                geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/tech03.png' }),
      category_id: catIds['Mur'], sort_order: 18 },

    { pack_id: PACK_UUID, label: 'Tech 4',                geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/tech04.png' }),
      category_id: catIds['Mur'], sort_order: 19 },

    { pack_id: PACK_UUID, label: 'Technique 1',           geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/technical01.png' }),
      category_id: catIds['Mur'], sort_order: 20 },

    { pack_id: PACK_UUID, label: 'Technique 2',           geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/technical02.png' }),
      category_id: catIds['Mur'], sort_order: 21 },

    { pack_id: PACK_UUID, label: 'Technique 3',           geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/technical03.png' }),
      category_id: catIds['Mur'], sort_order: 22 },

    { pack_id: PACK_UUID, label: 'Technique 4',           geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/technical04.png' }),
      category_id: catIds['Mur'], sort_order: 23 },

    { pack_id: PACK_UUID, label: 'Technique 5',           geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/technical05.png' }),
      category_id: catIds['Mur'], sort_order: 24 },

    { pack_id: PACK_UUID, label: 'Mur technique',         geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/technical_wall.png' }),
      category_id: catIds['Mur'], sort_order: 25 },

    { pack_id: PACK_UUID, label: 'Mur technique 2',       geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/technical_wall02.png' }),
      category_id: catIds['Mur'], sort_order: 26 },

    { pack_id: PACK_UUID, label: 'Mur technique 3',       geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/technical_wall03.png' }),
      category_id: catIds['Mur'], sort_order: 27 },

    { pack_id: PACK_UUID, label: 'Mur technique 4',       geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/technical_wall04.png' }),
      category_id: catIds['Mur'], sort_order: 28 },

    { pack_id: PACK_UUID, label: 'Mur technique 5',       geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/technical_wall05.png' }),
      category_id: catIds['Mur'], sort_order: 29 },

    { pack_id: PACK_UUID, label: 'Ventilation',           geometry: 'cube',
      textures: JSON.stringify({ all: 'mur/vent01.png' }),
      category_id: catIds['Mur'], sort_order: 30 },

    // ── FENÊTRE ────────────────────────────────────────────────────────────
    { pack_id: PACK_UUID, label: 'Verre',                 geometry: 'cube',
      textures: JSON.stringify({ all: 'fenetre/glass.png' }),
      category_id: catIds['Fenêtre'], sort_order: 0 },

    { pack_id: PACK_UUID, label: 'Verre jaune',           geometry: 'cube',
      textures: JSON.stringify({ all: 'fenetre/glass_pane_yellow.png' }),
      category_id: catIds['Fenêtre'], sort_order: 1 },

    { pack_id: PACK_UUID, label: 'Verre gris',            geometry: 'cube',
      textures: JSON.stringify({ all: 'fenetre/gray_stained_glass.png' }),
      category_id: catIds['Fenêtre'], sort_order: 2 },

    { pack_id: PACK_UUID, label: 'Verre gris clair',      geometry: 'cube',
      textures: JSON.stringify({ all: 'fenetre/light_gray_stained_glass.png' }),
      category_id: catIds['Fenêtre'], sort_order: 3 },

    { pack_id: PACK_UUID, label: 'Verre magenta',         geometry: 'cube',
      textures: JSON.stringify({ all: 'fenetre/magenta_stained_glass.png' }),
      category_id: catIds['Fenêtre'], sort_order: 4 },

    { pack_id: PACK_UUID, label: 'Hublot blindé',         geometry: 'cube',
      textures: JSON.stringify({ all: 'fenetre/porthole_armored.png' }),
      category_id: catIds['Fenêtre'], sort_order: 5 },

    { pack_id: PACK_UUID, label: 'Hublot rond',           geometry: 'cube',
      textures: JSON.stringify({ all: 'fenetre/porthole_round.png' }),
      category_id: catIds['Fenêtre'], sort_order: 6 },

    { pack_id: PACK_UUID, label: 'Baie vitrée',           geometry: 'cube',
      textures: JSON.stringify({ all: 'fenetre/viewport.png' }),
      category_id: catIds['Fenêtre'], sort_order: 7 },

    { pack_id: PACK_UUID, label: 'Baie blanche',          geometry: 'cube',
      textures: JSON.stringify({ all: 'fenetre/viewport_white.png' }),
      category_id: catIds['Fenêtre'], sort_order: 8 },

    { pack_id: PACK_UUID, label: 'Baie jaune',            geometry: 'cube',
      textures: JSON.stringify({ all: 'fenetre/viewport_yellow.png' }),
      category_id: catIds['Fenêtre'], sort_order: 9 },

    // ── BLOC ───────────────────────────────────────────────────────────────
    { pack_id: PACK_UUID, label: 'Baril 1',               geometry: 'cube',
      textures: JSON.stringify({ top: 'bloc/barrel01_top.png', side: 'bloc/barrel01_side.png' }),
      category_id: catIds['Bloc'], sort_order: 0 },

    { pack_id: PACK_UUID, label: 'Baril 2',               geometry: 'cube',
      textures: JSON.stringify({ top: 'bloc/barrel02_top.png', side: 'bloc/barrel02_side.png' }),
      category_id: catIds['Bloc'], sort_order: 1 },

    { pack_id: PACK_UUID, label: 'Panneau bloc',          geometry: 'cube',
      textures: JSON.stringify({ top: 'bloc/block_panel_top.png', side: 'bloc/block_panel_side.png' }),
      category_id: catIds['Bloc'], sort_order: 2 },

    { pack_id: PACK_UUID, label: 'Catalyseur',            geometry: 'cube',
      textures: JSON.stringify({ top: 'bloc/catalyst_top.png', side: 'bloc/catalyst_side.png' }),
      category_id: catIds['Bloc'], sort_order: 3 },

    { pack_id: PACK_UUID, label: 'Console 1',             geometry: 'cube',
      textures: JSON.stringify({ top: 'bloc/console01_top.png', side: 'bloc/console01_side.png' }),
      category_id: catIds['Bloc'], sort_order: 4 },

    { pack_id: PACK_UUID, label: 'Console 2',             geometry: 'cube',
      textures: JSON.stringify({ top: 'bloc/console02_top.png', side: 'bloc/console02_side.png' }),
      category_id: catIds['Bloc'], sort_order: 5 },

    { pack_id: PACK_UUID, label: 'Caisse A',              geometry: 'cube',
      textures: JSON.stringify({ top: 'bloc/crate_top01.png', side: 'bloc/crate_side.png' }),
      category_id: catIds['Bloc'], sort_order: 6 },

    { pack_id: PACK_UUID, label: 'Caisse B',              geometry: 'cube',
      textures: JSON.stringify({ top: 'bloc/crate_top02.png', side: 'bloc/crate_side.png' }),
      category_id: catIds['Bloc'], sort_order: 7 },

    { pack_id: PACK_UUID, label: 'Fournaise',             geometry: 'cube',
      textures: JSON.stringify({ top: 'bloc/furnace_top.png', side: 'bloc/furnace_side.png' }),
      category_id: catIds['Bloc'], sort_order: 8 },

    { pack_id: PACK_UUID, label: 'Pylône cuivre',         geometry: 'cube',
      textures: JSON.stringify({ top: 'bloc/pylon_copper_top.png', side: 'bloc/pylon_copper_side.png' }),
      category_id: catIds['Bloc'], sort_order: 9 },

    { pack_id: PACK_UUID, label: 'Pylône rose',           geometry: 'cube',
      textures: JSON.stringify({ top: 'bloc/pylon_pink_top.png', side: 'bloc/pylon_pink_side.png' }),
      category_id: catIds['Bloc'], sort_order: 10 },

    { pack_id: PACK_UUID, label: 'Pylône quartz',         geometry: 'cube',
      textures: JSON.stringify({ top: 'bloc/pylon_quartz_top.png', side: 'bloc/pylon_quartz_side.png' }),
      category_id: catIds['Bloc'], sort_order: 11 },

    { pack_id: PACK_UUID, label: 'Pylône quartz 2',       geometry: 'cube',
      textures: JSON.stringify({ top: 'bloc/pylon_quartz02_top.png', side: 'bloc/pylon_quartz02_side.png' }),
      category_id: catIds['Bloc'], sort_order: 12 },

    { pack_id: PACK_UUID, label: 'Pylône acier',          geometry: 'cube',
      textures: JSON.stringify({ top: 'bloc/pylon_steel_top.png', side: 'bloc/pylon_steel_side.png' }),
      category_id: catIds['Bloc'], sort_order: 13 },

    { pack_id: PACK_UUID, label: 'Pylône standard',       geometry: 'cube',
      textures: JSON.stringify({ top: 'bloc/pylon_top.png', side: 'bloc/pylon_side.png' }),
      category_id: catIds['Bloc'], sort_order: 14 },

    { pack_id: PACK_UUID, label: 'Bloc rouillé',          geometry: 'cube',
      textures: JSON.stringify({ top: 'bloc/rusty_block_top.png', side: 'bloc/rusty_block_side.png' }),
      category_id: catIds['Bloc'], sort_order: 15 },

    { pack_id: PACK_UUID, label: 'Étagère',               geometry: 'cube',
      textures: JSON.stringify({ top: 'bloc/shelf_top.png', side: 'bloc/shelf_side.png' }),
      category_id: catIds['Bloc'], sort_order: 16 },

    { pack_id: PACK_UUID, label: 'Table forgeron',        geometry: 'cube',
      textures: JSON.stringify({ top: 'bloc/smithing_table_top.png', side: 'bloc/smithing_table_side.png' }),
      category_id: catIds['Bloc'], sort_order: 17 },

    { pack_id: PACK_UUID, label: 'Panneau acier',         geometry: 'cube',
      textures: JSON.stringify({ top: 'bloc/steel_panel_top.png', side: 'bloc/steel_panel_side.png' }),
      category_id: catIds['Bloc'], sort_order: 18 },

    { pack_id: PACK_UUID, label: 'Grillage',              geometry: 'cube',
      textures: JSON.stringify({ all: 'bloc/wire_mesh.png' }),
      category_id: catIds['Bloc'], sort_order: 19 },
  ])
}

export const down = async (knex) => {
  await knex('block_types').where({ pack_id: PACK_UUID }).delete()
  await knex('texture_pack_categories').where({ pack_id: PACK_UUID }).delete()
  await knex('texture_packs').where({ id: PACK_UUID }).delete()
}
