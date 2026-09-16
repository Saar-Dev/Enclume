// 346_ref_equipment_is_electronic.js — docs/PLANS/PLAN_INFORMATIQUE.md §4 Lot 1, item 1
//
// `is_electronic` : propriété fixe du modèle catalogue, sensibilité aux impulsions électromagnétiques
// (MANUEL_INFORMATIQUE.md §2.3, « Tout objet — pas seulement un ordinateur — peut être sensible »).
// Additive pure, même patron que `has_integrity` (migration 329) : ADD COLUMN NOT NULL DEFAULT false,
// backfill par clé métier (family/category/name), jamais par id (SEED-ID-DETERM, rules/core.md).
//
// Curation — recherche externe faite (compendiums pro PF2e/Foundry, cf. PLAN §4 Lot 1) : un trait
// d'objet n'est jamais déduit par heuristique à l'exécution, il est saisi une fois à la main depuis
// le RAW. Deux niveaux :
//   1. Familles/catégories sans ambiguïté (100 % électronique ou 100 % non) — bascule en masse par
//      family+category.
//   2. Catégories mixtes (revues ligne par ligne, description RAW lue en entier pour chacune,
//      2026-09-15) — bascule par nom exact (matché en LIKE avec un joker sur l'apostrophe typographique
//      ’, pour ne pas dépendre de la reproduction exacte d'un caractère Unicode dans ce fichier).
//
// Catégories automatiques (aucune ambiguïté, requête directe 2026-09-15) :
//   - Equipement Général / Équipement électronique (14)
//   - Equipement Général / Communication (8)
//   - Équipement informatique et logiciels / Ordinateur (6)
//   - Exo-systeme / Systèmes électroniques et informatiques (26)
//   - Armes / Arme à énergie + Exo-arme / Arme à énergie (14) : toutes ces armes fonctionnent par
//     génération/décharge d'énergie (arc, faisceau, plasma, batterie — ex. Oxyma « Batterie spéciale »,
//     canon à neutrons exo « Doit charger avant de tirer ») — à la différence d'une arme à poudre,
//     leur fonctionnement dépend intrinsèquement d'un système technologique embarqué. Revu ligne par
//     ligne (13+1 items), aucune exception trouvée : famille homogène, bascule en masse légitime.
//
// Catégories mixtes, revue individuelle (RAW lu en entier par ligne, 2026-09-15) :
//   - Armes / Accessoires pour armes (25 lignes, 12 électroniques) : visières/afficheurs connectés,
//     implants, calculateurs/lasers de télémétrie, systèmes de reconnaissance et de mémoire de
//     cibles → électronique. Lunettes de visée (10 niveaux, optique pur, aucune mention de composant
//     actif), silencieux, trépied, harnais mécanisé → mécanique/optique pur, non électronique.
//   - Equipement Général / Sécurité (21 lignes, 9 électroniques) : serrures électroniques/
//     intelligentes, brise-codes, détecteurs de mouvement, scanner de faux documents, mallette avec
//     serrure électronique embarquée (RAW : « le modèle décrit... n'est doté que d'une serrure
//     électronique simple »), collier d'inhibition (décharge électrique), camouflage intelligent
//     (« s'adapte automatiquement ») et manteau thermo-optique (« dispositif... qui courbe les ondes
//     lumineuses ») → électronique/actif. Capsules d'encre, menottes, faux documents/matériel de
//     faux, combinaison thermonile (matériau passif, aucune mention de système actif) → non
//     électronique.
//
// Hors périmètre (reste `false` par défaut, aucune action) : `family='Logiciels'` et
// `Équipement informatique et logiciels'/category='Programmes'` — un programme est un logiciel
// installé sur un ordinateur, pas un objet physique distinct exposé à l'IEM (MANUEL §2.3).
//
// Idempotent : `ADD COLUMN IF NOT EXISTS` + tous les `UPDATE` gardés `WHERE is_electronic = false`.
// Garde de structure : vérifie les familles/catégories attendues avant tout backfill (seed divergent
// → throw, jamais un backfill silencieusement faux, P55) ; assertion finale sur le total de lignes
// basculées (89, cf. décompte ci-dessus, vérifié par requête directe avant l'écriture de ce fichier).
// `down()` = DROP — rétro-compatible, aucun code ne lit encore cette colonne (Lot 2 pas encore écrit).

const AUTO_FAMILY_CATEGORY = [
  ['Equipement Général', 'Équipement électronique'],
  ['Equipement Général', 'Communication'],
  ['Équipement informatique et logiciels', 'Ordinateur'],
  ['Exo-systeme', 'Systèmes électroniques et informatiques'],
]

const ENERGY_FAMILY_CATEGORY = [
  ['Armes', 'Arme à énergie'],
  ['Exo-arme', 'Arme à énergie'],
]

const ACCESSOIRES_LIKE_PATTERNS = [
  'Analyseur tactique individuel%',
  'Mémoire de cibles%',
  'Poignée d%identification',
  'Projecteur de mouvement',
  'Système de tir assisté :%',
  'Système réactif autonome :%',
  'Système%aide à la visée : Calculateur laser',
  'Système%aide à la visée : Visée laser',
]

const SECURITE_LIKE_PATTERNS = [
  'Brise-codes Picklock',
  'Détecteurs de mouvements AshVS%',
  'Mallette sécurisée',
  'Scans Securit 200',
  'Serrure électronique',
  'Serrures intelligentes',
  'Système d%inhibition Coria XV',
  'Vêtements de camouflage - Camouflage intelligent',
  'Vêtements de camouflage - Manteau thermo-optique',
]

const EXPECTED_TOTAL = 89

export const up = async (knex) => {
  await knex.raw('ALTER TABLE ref_equipment ADD COLUMN IF NOT EXISTS is_electronic boolean NOT NULL DEFAULT false')

  // Garde de structure : le seed a-t-il bougé sous nos pieds ?
  for (const [family, category] of [...AUTO_FAMILY_CATEGORY, ...ENERGY_FAMILY_CATEGORY]) {
    const { n } = await knex('ref_equipment').where({ family, category }).count('* as n').first()
    if (Number(n) === 0) {
      throw new Error(`346 backfill : aucune ligne pour family="${family}" category="${category}" — seed divergent, vérifier avant de figer`)
    }
  }
  const { n: nAccessoires } = await knex('ref_equipment')
    .where({ family: 'Armes', category: 'Accessoires pour armes' }).count('* as n').first()
  if (Number(nAccessoires) === 0) {
    throw new Error('346 backfill : "Armes"/"Accessoires pour armes" introuvable — seed divergent')
  }
  const { n: nSecurite } = await knex('ref_equipment')
    .where({ family: 'Equipement Général', category: 'Sécurité' }).count('* as n').first()
  if (Number(nSecurite) === 0) {
    throw new Error('346 backfill : "Equipement Général"/"Sécurité" introuvable — seed divergent')
  }

  let total = 0

  for (const [family, category] of AUTO_FAMILY_CATEGORY) {
    total += await knex('ref_equipment')
      .where({ family, category, is_electronic: false })
      .update({ is_electronic: true })
  }

  for (const [family, category] of ENERGY_FAMILY_CATEGORY) {
    total += await knex('ref_equipment')
      .where({ family, category, is_electronic: false })
      .update({ is_electronic: true })
  }

  for (const pattern of ACCESSOIRES_LIKE_PATTERNS) {
    total += await knex('ref_equipment')
      .where({ family: 'Armes', category: 'Accessoires pour armes', is_electronic: false })
      .where('name', 'like', pattern)
      .update({ is_electronic: true })
  }

  for (const pattern of SECURITE_LIKE_PATTERNS) {
    total += await knex('ref_equipment')
      .where({ family: 'Equipement Général', category: 'Sécurité', is_electronic: false })
      .where('name', 'like', pattern)
      .update({ is_electronic: true })
  }

  const { n: nTrue } = await knex('ref_equipment').where({ is_electronic: true }).count('* as n').first()
  if (Number(nTrue) !== EXPECTED_TOTAL) {
    throw new Error(`346 backfill : ${nTrue} ligne(s) is_electronic=true, attendu ${EXPECTED_TOTAL} — vérifier les patrons avant de continuer`)
  }

  console.log(`[346_ref_equipment_is_electronic] is_electronic=true sur ${nTrue} ligne(s) (${total} mise(s) à jour cette exécution)`)
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE ref_equipment DROP COLUMN IF EXISTS is_electronic')
}
