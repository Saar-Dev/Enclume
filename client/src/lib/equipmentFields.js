// client/src/lib/equipmentFields.js
// Libellés et ordre d'affichage des champs de ref_equipment — repris tels quels de
// server/src/admin/ref-equipment-tool.html (seule source de terminologie FR pour ces champs,
// EquipmentCatalogPage.jsx avant extraction). Autorité unique : toute vue qui affiche le détail
// d'un objet (catalogue en lecture seule, catalogue d'achat Marchand, future fiche) lit cette liste
// plutôt que d'en recopier un sous-ensemble localement — ajouter un champ ici le rend visible partout
// d'un coup, le retirer d'un champ obsolète aussi.
export const EQUIPMENT_FIELD_ORDER = [
  'description',
  'price', 'price_modifier', 'rarity',
  'weight', 'manufacturer', 'nation', 'max_level', 'bonus', 'generation',
  'damage_h', 'damage_v_low', 'damage_v_high', 'shock', 'range',
  'min_str', 'init_mod', 'fire_mode', 'ammo_count', 'ammo_cost', 'caliber', 'linked_attr',
  'protection', 'protection_modifier', 'protection_shock', 'location', 'malus_cat',
  'capacity', 'waterproof',
  'ammo_effects',
]

export const EQUIPMENT_FIELD_LABELS = {
  description: 'Description',
  price: 'Prix (créd.)',
  price_modifier: 'Modificateur prix',
  rarity: 'Rareté',
  weight: 'Poids (kg)',
  manufacturer: 'Fabricant',
  nation: 'Nation / Faction',
  max_level: 'Niveau max',
  bonus: 'Bonus',
  generation: 'Génération',
  damage_h: 'Dommage (H)',
  damage_v_low: 'Dommage (V-)',
  damage_v_high: 'Dommage (V+)',
  shock: 'Choc',
  range: 'Portée',
  min_str: 'FOR min requise',
  init_mod: 'Modif. Initiative',
  fire_mode: 'Mode de tir',
  ammo_count: 'Mun. — Quantité chargeur',
  ammo_cost: 'Mun. — Coût ravitaillement',
  caliber: 'Calibre',
  linked_attr: 'Attribut lié',
  protection: 'Protection',
  protection_modifier: 'Modif. Protection',
  protection_shock: 'Protection Choc',
  location: 'Localisation',
  malus_cat: 'Catégorie de malus',
  capacity: 'Contenance (unités)',
  waterproof: 'Étanche',
  ammo_effects: 'Effets spéciaux munitions',
}

// equipmentDisplayFields — champs réellement renseignés d'un objet, dans l'ordre thématique
// ci-dessus, prêts à être rendus (label + valeur affichable). `description` en est exclue par
// défaut : avis UX (2026-10-08) — un nom/prix doit rester la première chose lue dans une liste
// d'objets (ce qui pilote la décision), la description est un texte de contexte à afficher à part,
// jamais mêlée en tête d'une grille de statistiques. Chaque appelant (TradeWindow, MerchantsPage,
// EquipmentCatalogPage) affiche donc `item.description` lui-même, à l'endroit qui lui convient.
// `excludeKeys` retire en plus des champs déjà montrés ailleurs par l'appelant (ex. TradeWindow
// affiche son propre prix catalogue, pas price brut).
export function equipmentDisplayFields(item, excludeKeys = []) {
  if (!item) return []
  const excluded = new Set(['description', ...excludeKeys])
  return EQUIPMENT_FIELD_ORDER
    .filter(key => !excluded.has(key) && item[key] !== null && item[key] !== undefined && item[key] !== '')
    .map(key => ({
      key,
      label: EQUIPMENT_FIELD_LABELS[key],
      value: typeof item[key] === 'boolean' ? (item[key] ? '✓' : '—') : String(item[key]),
    }))
}
