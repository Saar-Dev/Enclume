/**
 * Migration 259 — ref_careers.illustration : noms de fichiers harmonisés en anglais
 *
 * `client/public/assets/s4_*.webp` renommés en `career_<anglais>.webp` (git mv) à la demande de
 * Saar (2026-08-21), harmonisation de la casse/langue des noms de fichiers du dossier assets.
 * `ref_careers.illustration` (peuplé par les migrations 107/109/112-116) doit suivre le même
 * renommage — c'est la seule source du chemin consommé par `CareersAllocator.jsx`
 * (`src={`/${career.illustration}`}`), aucune route d'édition n'existe pour cette colonne.
 */

const RENAMES = {
  artisan_artiste: ['assets/s4_artisan.webp', 'assets/career_artisan.webp'],
  assassin: ['assets/s4_assassin.webp', 'assets/career_assassin.webp'],
  barman: ['assets/s4_barman.webp', 'assets/career_bartender.webp'],
  chasseur_primes: ['assets/s4_chasseurprime.webp', 'assets/career_bounty_hunter.webp'],
  contrebandier: ['assets/s4_contrebandier.webp', 'assets/career_smuggler.webp'],
  cultivateur_eleveur: ['assets/s4_eleveur.webp', 'assets/career_farmer.webp'],
  diplomate: ['assets/s4_diplomate.webp', 'assets/career_diplomat.webp'],
  erudit_archeologue: ['assets/s4_archeologue.webp', 'assets/career_archaeologist.webp'],
  espion: ['assets/s4_espion.webp', 'assets/career_spy.webp'],
  hybride_trident: ['assets/s4_hybride.webp', 'assets/career_trident_hybrid.webp'],
  marchand: ['assets/s4_marchand.webp', 'assets/career_merchant.webp'],
  marchand_itinerant: ['assets/s4_marchanditinerant.webp', 'assets/career_traveling_merchant.webp'],
  medecin_chirurgien: ['assets/s4_medecin.webp', 'assets/career_physician.webp'],
  mercenaire: ['assets/s4_mercenaire.webp', 'assets/career_mercenary.webp'],
  mineur: ['assets/s4_mineur.webp', 'assets/career_miner.webp'],
  officier_militaire_souterrain: ['assets/s4_officier_militaire_souterrain.webp', 'assets/career_military_officer_underground.webp'],
  officier_militaire_surface: ['assets/s4_officier_militaire_surface.webp', 'assets/career_military_officer_surface.webp'],
  officier_naval_civil: ['assets/s4_officier_naval_civil.webp', 'assets/career_naval_officer_civilian.webp'],
  officier_naval_militaire: ['assets/s4_officier_naval_militaire.webp', 'assets/career_naval_officer_military.webp'],
  ouvrier_docker: ['assets/s4_docker.webp', 'assets/career_dockworker.webp'],
  pilote_chasse_atmospherique: ['assets/s4_pilote_atmospherique.webp', 'assets/career_atmospheric_fighter_pilot.webp'],
  pilote_chasse_sous_marin: ['assets/s4_pilote_chasse_sous_marin.webp', 'assets/career_submarine_fighter_pilot.webp'],
  pirate: ['assets/s4_pirate.webp', 'assets/career_pirate.webp'],
  policier_enqueteur: ['assets/s4_enqueteur.webp', 'assets/career_investigator.webp'],
  pretre_trident: ['assets/s4_pretretrident.webp', 'assets/career_trident_priest.webp'],
  prostitue: ['assets/s4_prostitue.webp', 'assets/career_prostitute.webp'],
  scientifique_ingenieur: ['assets/s4_scientifique.webp', 'assets/career_scientist.webp'],
  soldat_elite_commando_marin: ['assets/s4_soldat_elite_commando_marin.webp', 'assets/career_elite_naval_commando.webp'],
  soldat_elite_commando_souterrain: ['assets/s4_soldat_elite_commando_souterrain.webp', 'assets/career_elite_underground_commando.webp'],
  soldat_elite_commando_surface: ['assets/s4_soldat_elite_commando_surface.webp', 'assets/career_elite_surface_commando.webp'],
  soldat_elite_forces_speciales: ['assets/s4_soldat_elite_forces_speciales.webp', 'assets/career_elite_special_forces.webp'],
  soldat_milicien: ['assets/s4_soldat.webp', 'assets/career_soldier.webp'],
  sous_marinier: ['assets/s4_sousmarinier.webp', 'assets/career_submariner.webp'],
  technicien_mecanicien: ['assets/s4_technicien.webp', 'assets/career_technician.webp'],
  techno_hybride: ['assets/s4_technohybride.webp', 'assets/career_technohybrid.webp'],
  veilleur: ['assets/s4_veilleur.webp', 'assets/career_watcher.webp'],
  voleur_criminel: ['assets/s4_voleur.webp', 'assets/career_thief.webp'],
}

export const up = async (knex) => {
  for (const [code, [, next]] of Object.entries(RENAMES)) {
    const updated = await knex('ref_careers').where({ code }).update({ illustration: next })
    if (updated !== 1) throw new Error(`Carrière introuvable ou dupliquée : ${code}`)
  }
}

export const down = async (knex) => {
  for (const [code, [previous]] of Object.entries(RENAMES)) {
    const updated = await knex('ref_careers').where({ code }).update({ illustration: previous })
    if (updated !== 1) throw new Error(`Carrière introuvable ou dupliquée : ${code}`)
  }
}
