// shared/exoSystemsCapacity.js — Auto-déconnexion des systèmes d'exo-armure par capacité de
// gestion de l'ordinateur (PLAN_INFORMATIQUE.md §4 Lot 4)
//
// Fonction pure, aucun accès DB — même famille que computerStats.js/exoStats.js.
//
// RAW littéral (docs/REGLES/REGLE_ORDINATEUR.md:11-15) : « Gestion systèmes : 10 + (Gén. x NT).
// C'est le nombre de systèmes que peut gérer simultanément un ordinateur (un appareil, drone ou
// autre, compte comme un système). Un système non géré par ordinateur ne peut être activé que
// manuellement. Si un ordinateur ne peut gérer tous les systèmes, il déconnecte automatiquement les
// systèmes les moins importants. » — un COMPTE de systèmes, jamais une somme pondérée de niveaux
// (contrairement au Potentiel, computerStats.js#computeOrdinateurStats).
//
// « Moins importants » = ordre `sort_order` croissant = ordre d'insertion par défaut (« premier
// branché, premier débranché », décision Saar 2026-09-15) ; le joueur réordonne à la main (boutons
// ↑/↓, ExoSystemsPanel.jsx) pour changer cet ordre. Calculé à la volée, jamais stocké sur
// `exo_systems` — un basculement d'ordinateur actif (principal→secours, resolveActiveComputer)
// doit recalculer immédiatement, jamais se synchroniser après coup (même doctrine que
// resolveActiveComputer lui-même, computerStats.js).

/**
 * Partitionne les systèmes d'une exo-armure entre ceux gérés par l'ordinateur actif et ceux
 * automatiquement déconnectés par manque de capacité.
 *
 * @param {{gestionSystemes: number|null, systems: Array<{id: string, sort_order: number}>}} params
 *   `gestionSystemes` — capacité de l'ordinateur ACTIF (computerStats.js#computeOrdinateurStats),
 *   `null` si aucun ordinateur n'est fonctionnel.
 * @returns {{active: Array, disconnected: Array}} mêmes objets d'entrée, partitionnés triés par
 *   `sort_order` croissant (égalité départagée par `id`) — jamais mutés. Si `gestionSystemes` est
 *   `null`, tout est déconnecté (RAW : aucun système n'est géré sans ordinateur fonctionnel).
 */
export function selectDisconnectedSystems({ gestionSystemes, systems = [] } = {}) {
  const sorted = [...systems].sort((a, b) =>
    (a.sort_order - b.sort_order) || String(a.id).localeCompare(String(b.id)))

  if (gestionSystemes == null) return { active: [], disconnected: sorted }

  return {
    active: sorted.slice(0, gestionSystemes),
    disconnected: sorted.slice(gestionSystemes),
  }
}
