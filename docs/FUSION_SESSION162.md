# FUSION — Session 162 monde

> État : déployée sur l'instance Codex `8293/8294`, prête pour recette utilisateur puis fusion.
>
> Source : tag `handoff/world-session162-20260722` sur `dev/monde`.
>
> Base : `ff66e61`, tag `handoff/world-session161-20260722`.

## Contenu du lot

La livraison conserve l'intégralité des Sessions 159 à 161 et corrige le rendu des accès verticaux :

- une échelle sans trappe dépasse le palier supérieur de 0,75 unité ;
- une échelle avec trappe s'arrête exactement à `hatch.y`, sans traverser le GLB ni créer de segment
  résiduel à l'étage haut ;
- les panneaux des quatre trappes coulissantes descendent de 0,16 unité dans une poche de plancher et
  sont masqués par la dalle une fois escamotés.

Le commit fonctionnel est `e999448`. Il n'ajoute ni migration SQL ni dépendance npm. Il modifie quatre
GLB existants, leurs previews, leur manifeste et leur fichier Blender source.

## Validation effectuée

- `npm run test:world` : 146/146 ;
- tests client `client/src/lib/*.test.mjs` : 95/95 ;
- `npm run test:server-config` : 3/3 ;
- `validate-3d-manifest` : 8/8 assets, zéro erreur et zéro avertissement ;
- ESLint ciblé sans erreur et build Vite réussi ;
- previews Blender fermée/ouverte inspectées ;
- pistes de translation GLB bipartites et tripartites relues à `-0.16` vertical ;
- health API, client HTTP et smoke Chromium distant réussis après synchronisation des 100 modèles.

## Contrat de reprise

1. Fusionner le tag de handoff, jamais la branche temporaire de déploiement.
2. Conserver `ladderVisualRange` comme autorité du rendu de l'échelle ; la traversée et les ancrages
   physiques restent produits par `WorldSnapshot`.
3. Ne pas réintroduire de marge fixe entre `ladder.topY` et la trappe : `linkedHatch.y` est la
   sous-face visuelle autoritaire.
4. Conserver `floor-pocketed-panels` et la descente de 0,16 unité lors de toute régénération du pack.
5. Déployer d'abord sur `8393/8394`, exécuter la recette commune, puis synchroniser les branches.

## Retour arrière

Le tag `backup/pre-session162-ladder-hatch-20260722` pointe sur `ff66e61`. Aucune base de données ne
nécessite de rollback ; les quatre anciens GLB sont restaurés par Git.

## Conflits de fusion

La liste exacte sera complétée par `git merge-tree` contre `kiwi/integration` avant le tag final.
