# FUSION — Session 163 monde

> État : déployée sur l'instance Codex `8293/8294`, prête pour recette visuelle puis fusion.
>
> Source : tag `handoff/world-session163-20260722` sur `dev/monde`.
>
> Base : `77ecaa7`, après le lot Session 162 documenté par `handoff/world-session162-20260722`.

## Contenu du lot

Cette livraison conserve l'intégralité des Sessions 159 à 162 et étend l'ascenseur de Phase 6 :

- route ordonnée dont chaque tronçon est strictement aligné sur X, Y ou Z ;
- changement de direction uniquement à un arrêt, sans segment diagonal ;
- gaine étanche générée autour de chaque tronçon vertical ou horizontal, y compris dans le vide
  extérieur entre deux salles ;
- arrêt autorisé seulement si toute son empreinte appartient à une même salle fermée ;
- orientation de porte indépendante à chaque palier ;
- cabine et passagers réellement interpolés en X/Y/Z, sans téléportation ;
- huit modèles distincts : industriel et vitré en 1x1, 1x2, 2x1 et 2x2.

Le commit fonctionnel est `1c54e61`. Il n'ajoute ni migration SQL ni dépendance npm. Il ajoute le
générateur `tools/generate_elevator_transit.py`, huit GLB, leur manifeste et le fichier Blender
source. Les gaines restent des segments simples côté moteur/rendu : elles ne créent pas un objet par
case parcourue.

## Validation effectuée

- `npm run test:world` : 149/149 ;
- tests client `client/src/lib/*.test.mjs` : 98/98 ;
- `npm run test:server-config` : 3/3 ;
- `validate-3d-manifest` : 8/8 assets, zéro erreur et zéro avertissement ;
- ESLint ciblé : zéro erreur, 16 avertissements React Hooks préexistants ;
- build Vite réussi ;
- health API `8294`, client `8293`, plus gros GLB et smoke Chromium distant réussis ;
- catalogue serveur passé de 100 à 108 modèles ;
- recette API réelle : route à trois arrêts, déplacement vertical puis horizontal et arrivée exacte
  en `[4,2.625,0]` ; les données de test ont été supprimées et contrôlées à zéro ;
- catalogue distant vérifié : les huit couples style/empreinte existent séparément, notamment 1x2
  et 2x1.

## Contrat de reprise

1. Fusionner le tag de handoff, jamais la branche temporaire de déploiement.
2. Conserver l'ordre des `stops` : il définit la polyligne et ses changements de direction.
3. Refuser un segment qui modifie plus d'un axe et un arrêt dont l'empreinte n'est pas entièrement
   contenue dans une même salle fermée.
4. Conserver `positionX`, `positionY`, `positionZ`, `movementFrom` et `movementPath` dans l'état
   runtime ; les anciens champs Y ne servent qu'à normaliser une fixture verticale existante.
5. Ne pas transformer la gaine en une collection d'objets par case. Les barrières et meshes restent
   compilés par segment droit.
6. Conserver la différence physique du verre : LOS ouverte, mais mouvement, eau et gaz bloqués.
7. Garder quatre GLB par style. Ne pas dédupliquer 1x2 et 2x1 par rotation.
8. Déployer d'abord sur `8393/8394`, exécuter la recette commune, puis synchroniser les branches.

## Retour arrière

Le tag `backup/pre-session163-elevator-route-20260722` pointe sur `77ecaa7`. Aucune base de données
ne nécessite de rollback ; le code et les huit assets sont restaurés par Git.

## Conflits de fusion

La simulation `git merge-tree --write-tree kiwi/integration HEAD`, contre `kiwi/integration` à
`355e388`, signale les huit conflits documentaires déjà connus :

- `CLAUDE.md` ;
- `client/public/CHANGELOG.md` ;
- `docs/ASBUILT.md` ;
- `docs/EN_COURS.md` ;
- `docs/FUSION_PROJET_COUSIN.md` ;
- `docs/JOURNAL6.md` ;
- `docs/Old/PLAN_LOS.md` ;
- `docs/VOCABULARY.md`.

Les fichiers fonctionnels de la route d'ascenseur, du compilateur, du renderer, de l'éditeur, du
catalogue et des huit assets ne sont pas en conflit. Pour les documents partagés, conserver les
apports des deux branches dans leur ordre chronologique, sans remplacer en bloc les contrats
règles/combat de Saar ni les sections monde des Sessions 159 à 163.
