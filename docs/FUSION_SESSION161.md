# FUSION — Session 161 monde

> État : déployée sur l'instance Codex `8293/8294`, prête pour recette utilisateur puis fusion.
>
> Source : tag `handoff/world-session161-20260722` sur `dev/monde`.
>
> Base corrigée : `23949e4`, tag `handoff/world-session160-corrected-20260722`.

## Contenu du lot

Cette livraison inclut les Sessions 159 et 160 corrigées, puis ajoute deux garanties d'éditeur :

- catalogues strictement contextuels — portes sans trappes, accès vertical avec les huit seules
  trappes après **Échelle + Trappe** ;
- placement sticky des objets 3D libres contre les murs, structures, voxels legacy et autres objets,
  sans fantôme rouge ni traversée possible lors d'un saut du pointeur.

Le lot ne contient aucune migration SQL, nouvelle dépendance npm ni nouvel asset binaire par rapport
à la Session 160 corrigée.

## Commits propres à la Session 161

- `9811ca4` — collisions de placement et catalogues contextuels ;
- `b7167b6` — balayage et glissement sticky sans état rouge ;
- `dc01bc2` — maintien du sélecteur de composition dans la palette d'accès vertical ;
- `0d74a41` — filtre des portes extrait, renforcé et testé.

Les commits de documentation qui ferment la livraison suivent ces changements fonctionnels dans le
tag de handoff.

## Validation effectuée

- `npm run test:world` : 144/144 ;
- tests client `client/src/lib/*.test.mjs` : 95/95 ;
- `npm run test:server-config` : 3/3 ;
- build Vite réussi ;
- ESLint ciblé sans erreur ;
- smoke Chromium distant réussi ;
- recette Chromium connectée sur `8293` : sélecteur de composition présent, huit seules trappes,
  bibliothèque générale restaurée en **Échelle seule**, traversée d'un mur refusée même lors d'un
  saut direct du pointeur ;
- données temporaires de recette supprimées et contrôlées à zéro.

## Contrat de reprise

1. Fusionner le tag, jamais un état de travail non étiqueté.
2. Conserver `geometry.connectorType` comme autorité prioritaire du catalogue ; le fallback par pack
   et mots-clés ne sert qu'aux blueprints legacy sans type explicite.
3. Conserver `WorldSnapshot` comme autorité physique à l'exécution. Le sticky est un garde UX de
   l'éditeur, pas un remplacement des collisions serveur ou du graphe spatial.
4. Ne pas réintroduire un fantôme rouge : une cible invalide doit être masquée ou résolue vers la
   dernière position valide.
5. Déployer d'abord sur `8393/8394`, exécuter la recette commune, puis seulement synchroniser les
   branches de travail.

## Retour arrière

Le tag `backup/pre-session161-placement-collision-20260722` pointe sur `23949e4`, juste avant les
changements de la Session 161. Les bases de données ne nécessitent aucun rollback.

## Conflits de fusion

La liste exacte est complétée à partir d'un `git merge-tree` contre `kiwi/integration` avant la
création du tag final.
