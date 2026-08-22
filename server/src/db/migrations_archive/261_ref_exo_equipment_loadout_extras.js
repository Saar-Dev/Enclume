/**
 * Migration 261 — extension du catalogue `ref_exo_equipment` (préparatoire à la transcription des
 * loadouts des 16 armures, PLAN_EXOARMURE.md §13.4.4 suite — décisions confirmées avec Saar,
 * 2026-08-21, détail complet et sources dans le plan)
 *
 * Contrairement à la première tentative (annulée, `git log` — migration écrite puis retirée sur
 * consigne explicite "noter, pas appliquer"), chaque ligne ci-dessous a été vérifiée individuellement
 * contre `ref_equipment` avant d'être ajoutée ici — règle posée pendant cette session : préférer un
 * lien `ref_equipment_id` (migration 260, exclusive arc) à une nouvelle ligne `ref_exo_equipment`
 * chaque fois qu'un équivalent existe déjà. Les dagues/pistolets/lance-harpons/mitrailleuse/canon
 * d'assaut/fusil sonique/lance-filet/lance-flammes ont tous trouvé un équivalent — aucune ligne pour
 * eux ici, seulement dans la migration de transcription elle-même (`ref_equipment_id`).
 *
 * Ce qui reste ici n'a *aucun* équivalent `ref_equipment` (Centre de commande de drones, Brouilleur
 * sonscans, Griffe mécanique, Torche de forage, Lance-torpilles/missiles) — ou correspond à un objet
 * "portable" dont l'usage reste possible sans exo-armure (station, équipement déporté) : ces 6 derniers
 * (Sonscan actif/passif, Radar, Caméra, Balise de détresse, Analyseur environnemental) sont un **clone
 * volontaire**, pas une redite accidentelle — un `ref_equipment_id` unique confondrait deux achats
 * indépendants (RAW confirme la distinction pour les Analyseurs : "à la différence des analyseurs
 * portables, les analyseurs pour armures peuvent étudier plusieurs cibles à la fois"). Chaque clone
 * cite sa source `ref_equipment` dans sa `description`, pour qu'une future correction de prix/stats
 * sur l'original pense à vérifier le clone (mitigation du risque de dérive plutôt que le nier).
 *
 * Analyseur sonscan/radar : pas de nouvelle ligne — les 16 fiches y référeront l'entrée déjà existante
 * "Analyseur • Sea-Star" (migration 253, niveau fixe 12, le moins cher des 3 candidats identiques
 * Sea-Star/Abyss/Delta Azur).
 *
 * Dagues (grille type × rétractable) : abandonnée — 4 correspondances exactes trouvées dans
 * `ref_equipment` (Dague Shark/thermique Thermo IV/moléc. Pulsar/neurale Brain), "rétractable" n'est
 * qu'un détail de montage sur l'armure (RAW : "la lame [Dague Shark] n'est pas rétractable" — confirme
 * que la version RAW-attestée "rétractable" des loadouts est un choix de montage, pas une arme
 * différente), donc aucune ligne dague ici — traité en `ref_equipment_id` dans la transcription.
 *
 * Lance-torpilles/Lance-missiles Taille 1/2/3 : stats de la table RAW "TAILLE, COÛT, DOMMAGES ET
 * PORTÉE DES TORPILLES" (donnée par Saar, pas de colonne NT dans cette table — `tech_level` laissé
 * NULL, cohérent avec plusieurs entrées déjà partiellement chiffrées de la migration 253). Représente
 * le tube intégré à l'armure (chargé), distinct des lanceurs "individuels" nommés du chapitre général
 * (Kelvin IV/Ourso/Éperon/Stellar II/Molle AV, `ref_equipment`) qui ne couvrent pas la Taille 3
 * nécessaire à Ouraken. Taille 1 ajoutée par extensibilité (jamais citée dans les 16 fiches, justifiée
 * par la table RAW "Armures (jusqu'à exo-4) : Taille 1 à 3", décision Saar). Missile et torpille
 * partagent les mêmes stats de dommages/coût/portée (confirmé par Saar après relecture RAW longue) —
 * deux lignes séparées quand même, le RAW les nomme différemment dans les loadouts (Ouraken/Moloch
 * "lance-torpilles", Cougar "lance-missiles"), jamais fusionnées en une seule ligne générique.
 *
 * Brouilleur sonscans (Actif/Passif/Actif et passif) : les 3 variantes sont une décision Saar
 * explicite, architecture adaptative — seule la 3e est attestée (Moloch, "niv. 3"), les 2 autres
 * ajoutées pour compléter la grille (même principe que les dagues avant leur abandon ci-dessus, mais
 * ici aucun équivalent `ref_equipment` n'existe pour retirer le besoin d'une ligne catalogue).
 *
 * id laissés à gen_random_uuid() (cf. `.claude/rules/core.md` — idempotence par `name` uniquement).
 */

const EQUIPMENT = [
  // ─── family=systeme, category=Systèmes électroniques et informatiques — clones d'un équivalent
  // "portable" ref_equipment (source citée dans chaque description) ───
  { family: 'systeme', category: 'Systèmes électroniques et informatiques', name: 'Sonscan actif directionnel', price: 14800, description: "Version intégrée à l'armure du Sonscan actif portable Crysta (ref_equipment) — sonar directionnel, portée 2 milles nautiques." },
  { family: 'systeme', category: 'Systèmes électroniques et informatiques', name: 'Sonscan passif', price: 16800, description: 'Version intégrée à l\'armure du Sonscan passif portable Lero (ref_equipment) — portée 7 milles nautiques.' },
  { family: 'systeme', category: 'Systèmes électroniques et informatiques', name: 'Radar', price: 1800, description: 'Version intégrée à l\'armure du Radar portable Oural (ref_equipment) — directionnel, portée 2 km.' },
  { family: 'systeme', category: 'Systèmes électroniques et informatiques', name: 'Caméra', price: 300, description: 'Version intégrée à l\'armure de la Caméra Triton 245 (ref_equipment) — utilisable jusqu\'à -6 000 m.' },
  { family: 'systeme', category: 'Systèmes électroniques et informatiques', name: 'Balise de détresse', price: 450, description: 'Version intégrée à l\'armure de la Balise de détresse portable Umar 57 (ref_equipment) — signal sous-marin repérable à plus de 10 milles nautiques.' },
  { family: 'systeme', category: 'Systèmes électroniques et informatiques', name: 'Analyseur environnemental', price: 6700, description: 'Version intégrée à l\'armure de l\'Analyseur environnemental Seryon P250 (ref_equipment) — atmosphère, agents toxiques/pathogènes, radiations.' },
  { family: 'systeme', category: 'Systèmes électroniques et informatiques', name: 'Centre de commande de drones', description: "Aucun équivalent ref_equipment — système propre aux armures (RAW : drones fixables sur des points d'attache dans le dos, inactifs)." },

  // ─── family=systeme, category=Systèmes furtifs — 3 variantes, décision Saar (architecture adaptative) ───
  { family: 'systeme', category: 'Systèmes furtifs', name: 'Brouilleur sonscans Actif', price_modifier: '/niv.', description: 'Brouille les sonscans actifs adverses. Seule la variante "Actif et passif" est attestée dans les 16 fiches RAW (Moloch) — celle-ci ajoutée par extensibilité (décision Saar).' },
  { family: 'systeme', category: 'Systèmes furtifs', name: 'Brouilleur sonscans Passif', price_modifier: '/niv.', description: 'Brouille les sonscans passifs adverses. Ajoutée par extensibilité (décision Saar) — non attestée seule dans les 16 fiches RAW.' },
  { family: 'systeme', category: 'Systèmes furtifs', name: 'Brouilleur sonscans Actif et passif', price_modifier: '/niv.', description: 'Brouille sonscans actifs ET passifs adverses. Attesté (Moloch, "niv. 3", SEEDEXO.md:1647).' },

  // ─── family=arme, category=Arme de contact — aucun équivalent ref_equipment ───
  { family: 'arme', category: 'Arme de contact', name: 'Griffe mécanique', damage: 'Spécial (ModDom)', price_modifier: 'Variable (selon Force)', rarity: '20 (20)', tech_level: 'II', description: "Dommages = Modificateur de Dommages de l'exosquelette (Force variable, ex. Force 80 sur l'Armure de forage Vulcain). Coût variable selon Force. Distincte de \"Pince/Griffe\" (migration 253, DIS 15(15)) — DIS différente ici (20(20)), pas le même objet." },
  { family: 'arme', category: 'Arme de contact', name: 'Torche de forage Hydra', damage: '5D10', init_mod: -7, price: 15000, ammo_cost: '1 heure (1 500)', rarity: '5 (5)', tech_level: 'III', description: "Outil énergétique portable, plus imposant que les foreuses habituelles. Mêlée : Compétence Armes lourdes (contact). Nécessite trépied/harnais hydraulique — sans lui, FOR min. +3, malus Init. +2, niveau de Compétence divisé par deux. FOR 15, Allonge +1." },

  // ─── family=arme, nouvelle catégorie Torpilles et missiles — tube intégré à l'armure ───
  { family: 'arme', category: 'Torpilles et missiles', name: 'Lance-torpilles Taille 1', damage: '6D10 (H)', range: 'Courte', price: 3000, rarity: '15 (20)', description: 'Taille 1 non attestée dans les 16 fiches — ajoutée par extensibilité (table RAW "Armures (jusqu\'à exo-4) : Taille 1 à 3", décision Saar).' },
  { family: 'arme', category: 'Torpilles et missiles', name: 'Lance-torpilles Taille 2', damage: '7D10 (H), 1D6 (V-)', range: 'Courte', price: 5000, rarity: '15 (20)', description: 'Attesté (Ouraken, Moloch).' },
  { family: 'arme', category: 'Torpilles et missiles', name: 'Lance-torpilles Taille 3', damage: '10D10 (H), 1D10 (V-)', range: 'Moyenne', price: 10000, rarity: '10 (15)', description: 'Attesté (Ouraken, "1 torpille Taille 3 chacun").' },
  { family: 'arme', category: 'Torpilles et missiles', name: 'Lance-missiles Taille 1', damage: '6D10 (H)', range: 'Courte', price: 3000, rarity: '15 (20)', description: 'Mêmes stats que le lance-torpilles équivalent (confirmé Saar : missile=torpille pour dommages/portée, RAW p.363). Taille 1 non attestée — ajoutée par extensibilité.' },
  { family: 'arme', category: 'Torpilles et missiles', name: 'Lance-missiles Taille 2', damage: '7D10 (H), 1D6 (V-)', range: 'Courte', price: 5000, rarity: '15 (20)', description: 'Mêmes stats que le lance-torpilles équivalent. Attesté (Cougar, "deux tubes lance-missiles taille 2").' },
  { family: 'arme', category: 'Torpilles et missiles', name: 'Lance-missiles Taille 3', damage: '10D10 (H), 1D10 (V-)', range: 'Moyenne', price: 10000, rarity: '10 (15)', description: 'Mêmes stats que le lance-torpilles équivalent. Non attestée dans les 16 fiches — ajoutée par cohérence de la grille Taille (décision Saar).' },
]

export const up = async (knex) => {
  await knex('ref_exo_equipment').insert(EQUIPMENT)
}

export const down = async (knex) => {
  await knex('ref_exo_equipment').whereIn('name', EQUIPMENT.map((e) => e.name)).delete()
}
