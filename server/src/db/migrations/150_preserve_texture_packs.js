/**
 * Migration 150 — conservation des packs de textures existants.
 *
 * L'ancien moteur de surfaces supprimait tous les packs à l'exception de deux
 * packs de sol de station. Cette politique n'est plus compatible avec un monde
 * partagé : une intégration ne doit jamais effacer les textures, catégories ou
 * associations de cartes créées par une autre branche du projet.
 *
 * Les migrations 144 à 148 ajoutent ou mettent à jour les packs nécessaires au
 * moteur de surfaces de façon idempotente. Cette migration reste volontairement
 * non destructive afin de préserver l'historique Knex des environnements où
 * l'ancienne migration 82 avait déjà été appliquée.
 */
export const up = async () => {
  console.log('[Migration 150] Packs de textures existants conserves')
}

export const down = async () => {
  console.log('[Migration 150] down() sans effet')
}
