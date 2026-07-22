# FUSION — Session 164 monde

> État : déployée sur l'instance Codex `8293/8294`, prête pour recette visuelle puis fusion.
>
> Source : tag `handoff/world-session164-20260722` sur `dev/monde`.
>
> Base : `6c772cf`, issue du tag `handoff/world-session163-20260722`.

## Contenu du lot

Cette livraison conserve l'intégralité des Sessions 159 à 163 et corrige le parcours d'utilisation
des ascenseurs :

- **Ouvrir** inverse une fermeture en cours au lieu de rester sans effet ;
- le clic 3D résout le palier d'interaction le plus proche ;
- cabine absente : **Appeler l'ascenseur** demande ce palier ;
- cabine présente : **Utiliser** ouvre, place le token actif dans la cabine et crée son attachement
  durable ;
- un joueur ne peut embarquer que son token possédé ; le MJ peut choisir un token sélectionné ;
- une fois à bord, les autres arrêts deviennent les destinations et le token suit la cabine en
  X/Y/Z.

Le commit fonctionnel est `9436514`. Il n'ajoute ni migration SQL, ni dépendance npm, ni événement
WebSocket : la table de passagers de la migration 155 et les événements runtime existants restent
les autorités.

## Validation effectuée

- `npm run test:world` : 152/152 ;
- tests client `client/src/lib/*.test.mjs` : 101/101 ;
- `npm run test:server-config` : 3/3 ;
- build Vite réussi ;
- ESLint ciblé : zéro erreur, trois avertissements React Hooks préexistants dans `Canvas3D.jsx` ;
- health API `8294`, client `8293` et smoke Chromium distant réussis ;
- recette REST réelle : fermeture, inversion par **Ouvrir**, embarquement durable, trajet vertical et
  arrivée conjointe cabine/token au palier haut ;
- données temporaires supprimées et contrôlées à zéro.

## Contrat de reprise

1. Fusionner le tag de handoff, jamais la branche temporaire de déploiement.
2. Conserver **Appeler** comme une simple demande d'arrêt ; cette action n'embarque aucun token.
3. Conserver **Utiliser** comme mutation serveur atomique : validation du palier et des droits,
   ouverture, positionnement puis écriture de `world_elevator_passengers`.
4. Ne pas déduire un passager du seul rendu ou d'une boîte Three.js. La ligne PostgreSQL et sa
   position locale sont l'autorité durable.
5. Publier les positions déplacées avec les événements runtime/token existants, sans nouveau canal.
6. Déployer d'abord sur `8393/8394`, exécuter la recette commune, puis synchroniser les branches.

## Retour arrière

Le tag `backup/pre-session164-elevator-use-20260722` pointe sur `6c772cf`. Aucune migration ni donnée
de catalogue ne nécessite de rollback.

## Conflits de fusion

La simulation contre `kiwi/integration` à `355e388` signale les huit conflits documentaires déjà
connus : `CLAUDE.md`, `client/public/CHANGELOG.md`, `docs/ASBUILT.md`, `docs/EN_COURS.md`,
`docs/FUSION_PROJET_COUSIN.md`, `docs/JOURNAL6.md`, `docs/Old/PLAN_LOS.md` et `docs/VOCABULARY.md`.

Les fichiers fonctionnels de l'automate, du service, de la route, du panneau, du contexte de clic et
des traductions ne sont pas en conflit. Conserver les apports des deux branches dans leur ordre
chronologique pour les documents partagés.
