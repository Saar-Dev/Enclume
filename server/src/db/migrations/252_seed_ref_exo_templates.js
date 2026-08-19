/**
 * Migration 252 — seed des 16 armures RAW prémade dans ref_exo_templates
 *
 * Transcrit depuis `docs/REGLES/SEEDEXO.md` (RAW complet, lignes 852-1709), lu intégralement et
 * recoupé ligne à ligne — pas de valeur devinée. Un seul bloc "Attributs" par armure alimente les
 * colonnes déjà en place (migrations 233+243) : aucune colonne ajoutée ici.
 *
 * Volontairement absent de ce seed (PLAN_EXOARMURE.md §12.2, points non tranchés) :
 *   - Le loadout par défaut (Systèmes auxiliaires / Armement listés par armure) — le lien
 *     template ↔ ref_exo_equipment n'est pas encore décidé (jonction FK vs copie ponctuelle à la
 *     création d'un exo_sheet). Ce seed ne porte que les statistiques de la fiche (RD/ModDom
 *     restent dérivés via computeExoStats, jamais stockés).
 *   - Le ModDom "à l'échelle des Véhicules légers" affiché sur 7 armures (EXF≥50) — exclusion déjà
 *     actée §2.1 (Lot 2), dépend d'un système de dégâts massifs/véhicules qui n'existe pas encore.
 *
 * `speeds_extra` (jsonb, narratif, non consommé par movementBudgetService — cf. commentaire
 * migration 243) : forme `{ mode, environment, value? , note? }` par entrée secondaire.
 *
 * id laissés à gen_random_uuid() (table jamais référencée par id ailleurs) — cf. `.claude/rules/
 * core.md` : les seeds ne garantissent l'idempotence que par clé métier (`name`), jamais par id.
 */

const TEMPLATES = [
  {
    name: 'Explora',
    category: 'exo-alpha',
    environment: 'hybrid',
    depth_operational: 4000, depth_limit: 4800, depth_crush: 6000,
    base_exoforce: 25, base_blindage: 15,
    malus_init_underwater: 0, malus_init_surface: 0,
    base_speed_underwater: 10, underwater_movement_mode: 'vit',
    base_speed_surface: null, surface_movement_mode: 'pilot',
    speeds_extra: [],
    manufacturer: 'Explora Industries (Tyr)', price: 53000, rarity: '10 (15)', tech_level: 'III',
    autonomy: '40 heures (batterie très haute capacité)',
  },
  {
    name: 'Typhon',
    category: 'exo-alpha',
    environment: 'hybrid',
    depth_operational: 7000, depth_limit: 8400, depth_crush: 10500,
    base_exoforce: 30, base_blindage: 17,
    malus_init_underwater: 0, malus_init_surface: 0,
    base_speed_underwater: 10, underwater_movement_mode: 'vit',
    base_speed_surface: 10, surface_movement_mode: 'vit',
    speeds_extra: [{ mode: 'propulseur', environment: 'underwater', value: 20 }],
    manufacturer: 'Melian OP (Ligue rouge)', price: 200000, rarity: '5 (10)', tech_level: 'III',
    autonomy: 'en années (micro-moteur à fusion ou générateur thermoélectrique à radio-isotope)',
  },
  {
    name: 'Nymph 1-A',
    category: 'exo-0',
    environment: 'submarine',
    depth_operational: 8000, depth_limit: 9600, depth_crush: 12000,
    base_exoforce: 37, base_blindage: 21,
    malus_init_underwater: -2, malus_init_surface: -4,
    base_speed_underwater: 10, underwater_movement_mode: 'vit',
    base_speed_surface: 5, surface_movement_mode: 'vit',
    speeds_extra: [{ mode: 'propulseur', environment: 'underwater', value: 20 }],
    manufacturer: 'Gladius', price: 78000, rarity: '10 (15)', tech_level: 'III',
    autonomy: 'plusieurs années (générateur thermoélectrique à radio-isotope)',
  },
  {
    name: 'Série A',
    category: 'exo-0',
    environment: 'submarine',
    depth_operational: 2000, depth_limit: 2400, depth_crush: 3000,
    base_exoforce: 35, base_blindage: 20,
    malus_init_underwater: -2, malus_init_surface: -4,
    base_speed_underwater: 10, underwater_movement_mode: 'vit',
    base_speed_surface: 5, surface_movement_mode: 'vit',
    speeds_extra: [],
    manufacturer: "Indus Conglomérat (Royaume de l'Indus)", price: 40000, rarity: '10 (15)', tech_level: 'III',
    autonomy: '12 heures (batterie très haute capacité)',
  },
  {
    name: 'Vanguard',
    category: 'exo-1',
    environment: 'hybrid',
    depth_operational: 4000, depth_limit: 4800, depth_crush: 6000,
    base_exoforce: 45, base_blindage: 23,
    malus_init_underwater: -2, malus_init_surface: -4,
    base_speed_underwater: 5, underwater_movement_mode: 'vit',
    base_speed_surface: 10, surface_movement_mode: 'vit',
    speeds_extra: [{ mode: 'propulseur', environment: 'underwater', value: 20 }],
    manufacturer: 'Alliance Azur', price: 100000, rarity: '10 (15)', tech_level: 'III-IV',
    autonomy: "plusieurs dizaines d'années (micro-réacteur à fusion azuréen)",
  },
  {
    name: 'Sylph 56',
    category: 'exo-1',
    environment: 'hybrid',
    depth_operational: 10000, depth_limit: 13000, depth_crush: 15000,
    base_exoforce: 45, base_blindage: 25,
    malus_init_underwater: -2, malus_init_surface: -4,
    base_speed_underwater: 5, underwater_movement_mode: 'vit',
    base_speed_surface: 10, surface_movement_mode: 'vit',
    speeds_extra: [{ mode: 'propulseur', environment: 'underwater', value: 18 }],
    manufacturer: 'Millénium (Union Méditerranéenne)', price: 600000, rarity: '1 (5)', tech_level: 'III',
    autonomy: "plusieurs dizaines d'années (micro-réacteur à fusion azuréen)",
  },
  {
    name: 'Vauban',
    category: 'exo-1',
    environment: 'surface',
    depth_operational: null, depth_limit: null, depth_crush: null,
    base_exoforce: 45, base_blindage: 23,
    malus_init_underwater: 0, malus_init_surface: -2,
    base_speed_underwater: null, underwater_movement_mode: 'vit',
    base_speed_surface: 20, surface_movement_mode: 'vit',
    speeds_extra: [],
    manufacturer: 'Empire des Généticiens', price: 100000, rarity: '10 (15)', tech_level: 'IV',
    autonomy: "plusieurs dizaines d'années (micro-réacteur à fusion azuréen)",
  },
  {
    name: 'Condor',
    category: 'exo-1',
    environment: 'surface',
    depth_operational: null, depth_limit: null, depth_crush: null,
    base_exoforce: 42, base_blindage: 23,
    malus_init_underwater: 0, malus_init_surface: -2,
    base_speed_underwater: null, underwater_movement_mode: 'vit',
    base_speed_surface: 20, surface_movement_mode: 'vit',
    speeds_extra: [],
    manufacturer: 'Gladius', price: 495000, rarity: '1 (5)', tech_level: 'III',
    autonomy: "plusieurs dizaines d'années (micro-réacteur à fusion azuréen)",
  },
  {
    name: 'Cougar',
    category: 'exo-2',
    environment: 'surface',
    depth_operational: null, depth_limit: null, depth_crush: null,
    base_exoforce: 45, base_blindage: 23,
    malus_init_underwater: 0, malus_init_surface: -4,
    base_speed_underwater: null, underwater_movement_mode: 'vit',
    base_speed_surface: 13, surface_movement_mode: 'vit',
    speeds_extra: [{ mode: 'réacteur dorsal', environment: 'surface', note: "saut d'une centaine de mètres" }],
    manufacturer: 'Melian OP (Ligue rouge)', price: 300000, rarity: '5 (10)', tech_level: 'III',
    autonomy: "plusieurs dizaines d'années (micro-réacteur à fusion azuréen)",
  },
  {
    name: 'Mentor',
    category: 'exo-2',
    environment: 'submarine',
    depth_operational: 9000, depth_limit: 11000, depth_crush: 12000,
    base_exoforce: 50, base_blindage: 25,
    malus_init_underwater: -3, malus_init_surface: -6,
    base_speed_underwater: 10, underwater_movement_mode: 'vit',
    base_speed_surface: 7, surface_movement_mode: 'vit',
    speeds_extra: [{ mode: 'propulseur', environment: 'underwater', value: 15 }],
    manufacturer: 'Meklar Industrie (Hégémonie)', price: 350000, rarity: '5 (10)', tech_level: 'III',
    autonomy: 'plusieurs années (générateur thermoélectrique à radio-isotope)',
  },
  {
    name: 'Heimdall-Pyrelia',
    category: 'exo-2',
    environment: 'hybrid',
    depth_operational: 6000, depth_limit: 8000, depth_crush: 10000,
    base_exoforce: 55, base_blindage: 25,
    malus_init_underwater: -3, malus_init_surface: -6,
    base_speed_underwater: 10, underwater_movement_mode: 'vit',
    base_speed_surface: 10, surface_movement_mode: 'vit',
    speeds_extra: [{ mode: 'propulseur', environment: 'underwater', value: 17 }],
    manufacturer: 'Pyrelia Industries (République du Corail)', price: 398000, rarity: '5 (10)', tech_level: 'III',
    autonomy: 'plusieurs années (générateur thermoélectrique à radio-isotope)',
  },
  {
    name: 'Ouraken',
    category: 'exo-2',
    environment: 'submarine',
    depth_operational: 9000, depth_limit: 11000, depth_crush: 12000,
    base_exoforce: 57, base_blindage: 26,
    malus_init_underwater: -3, malus_init_surface: -6,
    base_speed_underwater: 10, underwater_movement_mode: 'vit',
    base_speed_surface: 5, surface_movement_mode: 'vit',
    speeds_extra: [{ mode: 'propulseur', environment: 'underwater', value: 15 }],
    manufacturer: 'Gladius', price: 695000, rarity: '1 (5)', tech_level: 'III-IV',
    autonomy: 'plusieurs années (générateur thermoélectrique à radio-isotope)',
  },
  {
    name: 'Odin',
    category: 'exo-3',
    environment: 'submarine',
    depth_operational: 14000, depth_limit: 16000, depth_crush: 18000,
    base_exoforce: 60, base_blindage: 27,
    malus_init_underwater: -4, malus_init_surface: -8,
    base_speed_underwater: 12, underwater_movement_mode: 'vit',
    base_speed_surface: 5, surface_movement_mode: 'vit',
    speeds_extra: [],
    manufacturer: 'Odin Industries', price: 789000, rarity: '1 (5)', tech_level: 'III',
    autonomy: 'plusieurs années (générateur thermoélectrique à radio-isotope)',
  },
  {
    name: 'Vulcain',
    category: 'exo-3',
    environment: 'submarine',
    depth_operational: 12000, depth_limit: 15600, depth_crush: 21600,
    base_exoforce: 62, base_blindage: 29,
    malus_init_underwater: -5, malus_init_surface: -10,
    base_speed_underwater: 5, underwater_movement_mode: 'vit',
    base_speed_surface: null, surface_movement_mode: 'blocked',
    speeds_extra: [],
    manufacturer: 'Odin Industries', price: 1450000, rarity: '5 (10)', tech_level: 'III',
    autonomy: 'plusieurs années (générateur thermoélectrique à radio-isotope). Certains modèles '
      + "recyclés sont équipés de batteries très haute capacité (autonomie 24 h), d'autres utilisent "
      + 'un simple câble d\'alimentation relié à un générateur.',
  },
  {
    name: 'Moloch',
    category: 'exo-4',
    environment: 'submarine',
    depth_operational: 15000, depth_limit: 17000, depth_crush: 19000,
    base_exoforce: 68, base_blindage: 32,
    malus_init_underwater: -5, malus_init_surface: -10,
    base_speed_underwater: 5, underwater_movement_mode: 'vit',
    base_speed_surface: 3, surface_movement_mode: 'vit',
    speeds_extra: [],
    manufacturer: 'Odin Industries', price: 3995000, rarity: '-5 (1)', tech_level: 'III-IV',
    autonomy: 'plusieurs années (générateur thermoélectrique à radio-isotope)',
  },
  {
    name: 'Orka',
    category: 'exo-4',
    environment: 'submarine',
    depth_operational: 20000, depth_limit: 26000, depth_crush: 36000,
    base_exoforce: 68, base_blindage: 34,
    malus_init_underwater: -5, malus_init_surface: -10,
    base_speed_underwater: 5, underwater_movement_mode: 'vit',
    base_speed_surface: 3, surface_movement_mode: 'vit',
    speeds_extra: [],
    manufacturer: 'Odin Industries', price: 13526000, rarity: '-5 (1)', tech_level: 'III',
    autonomy: 'plusieurs années (générateur thermoélectrique à radio-isotope)',
  },
]

export const up = async (knex) => {
  await knex('ref_exo_templates').insert(
    TEMPLATES.map((t) => ({ ...t, speeds_extra: JSON.stringify(t.speeds_extra) }))
  )
}

export const down = async (knex) => {
  await knex('ref_exo_templates').whereIn('name', TEMPLATES.map((t) => t.name)).delete()
}
