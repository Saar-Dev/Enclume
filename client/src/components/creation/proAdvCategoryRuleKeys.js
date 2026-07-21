// Correspondance entre le libellé brut de ref_career_point_categories.category (server) et la clé
// de règle step4.pro_adv_rules.<key> (creation.json). Plusieurs libellés en base pointent vers la
// même règle LdB (variantes de formulation entre lots de seed : "Cache/Planque" et "Planque/Cache",
// singulier/pluriel, etc.).
//
// Catégories rencontrées en base SANS règle correspondante ici (volontairement absentes — aucune
// source RAW documentée sous docs/REGLES/ pour ces libellés, ne pas inventer de contenu) :
// Accessoires pour armes, Bouclier, Charges électriques (confirmé erreur de copié-collé dans le
// seed, Saar), Influence (source RAW à fournir),
// + les catégories militaires en snake_case (armement, armement_contact, armement_distance,
// pilotage, detection, esquive, contre_attaque, rempart, securite, specialise, communication,
// analyse, medical, general, ami_ennemi, offensif) — système de points distinct des Avantages
// professionnels, non couvert par docs/REGLES/AVANTAGES PROFESSIONNELS.md.
export const PRO_ADV_CATEGORY_RULE_KEYS = {
  'Art/Artisanat': 'artisanat',
  'Artisanat': 'artisanat',
  'Atelier': 'ateliers',
  'Ateliers': 'ateliers',
  'Assemblage': 'assemblage',
  'Bases de données': 'bases_donnees',
  'Base de données médicales': 'bases_donnees',
  'Bars': 'bars',
  'Cabine privée': 'cabine_privee',
  'Cabinet médical': 'cabinets_medicaux',
  'Cabinets médicaux': 'cabinets_medicaux',
  'Concession': 'concessions_minieres',
  'Concessions minières': 'concessions_minieres',
  'Corruption/Chantage': 'corruption_chantage',
  'Célébrité': 'celebrite',
  'Étal/Boutique': 'etal_boutique',
  'Étal/Petite boutique': 'etal_boutique',
  'Falsification': 'falsification',
  'Fausse identité': 'fausses_identites',
  'Fausses identités': 'fausses_identites',
  'Matériel': 'materiel',
  'Parcelle/Ferme': 'parcelles_elevage_cultures',
  'Pharmacie personnelle': 'pharmacie_personnelle',
  'Cache/Planque': 'planque_cache',
  'Planque/Cache': 'planque_cache',
  'Réseau de contrebande': 'reseau_contrebande',
  'Relations': 'relations',
  'Stock de marchandises': 'stock_marchandises',
  'Unité': 'unite',
}
