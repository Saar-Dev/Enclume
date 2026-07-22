# Objets 3D libres et visibilité caméra

> Mis à jour : 2026-07-22 — occupation snapshot et coupe par volume/façade.

Ce document décrit le contrat actuel du placement des objets 3D génériques et de l'affichage par étage. Les portes et ascenseurs restent des connecteurs de salle dans `surface_data.connectors` et ne suivent pas ce flux.

Pour fabriquer un GLB, choisir son mode de pose et écrire son manifeste, voir `docs/SYSTEME/CREATION_OBJETS_3D.md`.

## Placement précis

- `blueprint.geometry.placementMode = "free"` utilise la pose sur dalle ; `"wall"` interdit toute pose hors d'une face de mur ; `"connector"` est exclu de la palette des objets génériques.
- `entities.pos_x`, `pos_y` et `pos_z` sont des `double precision` depuis la migration 83.
- La sous-grille de pose vaut `1 / SURFACE_FINE`, soit un quart de case.
- Pour un blueprint avec `geometry.origin = "floor-center"`, `pos_x` et `pos_y` désignent le centre horizontal réel du modèle. `pos_z` désigne son plan de support.
- Le plan de support d'une salle est la face supérieure de sa dalle : `baseY + floorThickness / 2`. Le centre de la dalle ne doit jamais servir d'altitude de pose.
- Les blueprints sans origine `floor-center` gardent la convention du coin minimal de leur footprint.
- L'occupation runtime reprend le point monde de l'instance et son empreinte mise à l'échelle ; elle
  est vérifiée par `WorldSnapshot`, `createSpatialIndex()` et `createOccupancyIndex()`. Aucune
  quantification Redis par case ne subsiste.

## Aperçu, sélection et modification

- Le fantôme de pose charge le vrai GLB avec sa rotation et ses couleurs ; il est semi-transparent et exclu du raycast.
- Après une pose réussie, le blueprint actif est automatiquement désélectionné : une nouvelle pose exige un nouveau choix explicite dans la palette.
- Un clic sur le modèle sélectionne l'instance, même si elle n'a aucune interaction de jeu.
- Les meshes GLB portent `userData.isEntity` et `entityId` pour le raycaster de l'éditeur.
- Le panneau d'instance expose les couleurs, les coordonnées et la rotation 0/90/180/270 degrés.
- Une instance sélectionnée se déplace par glisser-déposer. Un seul `PUT /api/entities/:id` est envoyé au relâchement.
- Pour une instance murale, ce déplacement cherche obligatoirement un nouveau mur. La rotation est calculée depuis la normale de la face et ne se règle pas manuellement.
- `entities.state.placement` conserve `wallId`, les panneaux contigus, l'axe, la face, le rôle intérieur/extérieur, la position le long du mur et la hauteur basse.

## Affichage par étage

Le sélecteur d'étage est une règle de visibilité, pas un simple réglage d'opacité.

- Une salle, une dalle, un mur, un connecteur, un objet ou un token dont l'étage propriétaire est supérieur à `displayLevel` est retiré du rendu.
- Un plafond est filtré selon sa hauteur physique. S'il se trouve au-dessus de `displayLevel`, il est totalement absent du rendu, comme tous les autres éléments d'un étage supérieur.
- Les eaux calculées sur des étages supérieurs sont filtrées.
- La grille, la cible des contrôles et la caméra se décalent ensemble de `STORY_HEIGHT` lors d'un changement d'étage.
- Une porte ne découpe que les panneaux dont l'étage correspond exactement à `connector.level` (ou à `connector.y` pour une donnée sans niveau explicite).

## Occlusion des murs par la caméra

La coupe caméra raisonne par volume de salle et par façade complète, y compris pour les murs courbes
ou découpés en plusieurs panneaux.

1. Le volume regardé est déterminé à partir de l'ancre explicite de contexte, puis de la cible des
   `MapControls`. La position de la caméra ne sert que de secours si aucune cible n'existe.
2. Le point de focus est testé dans l'empreinte multipolygone de la salle à `displayLevel`; la salle
   reste donc stable pendant une orbite autour de la cible.
3. Les panneaux partageant un `facadeId` sont regroupés. `interiorNormalSignsByRoom` donne le vrai
   côté intérieur du volume actif pour chaque portion droite ou courbe.
4. Toute façade placée entre la caméra et ce volume passe à une opacité fixe de `0.18`; les autres
   façades restent opaques.

Le calcul est limité à un passage toutes les 80 ms et n'échantillonne plus les cases derrière chaque
panneau. Un mur estompé ne projette plus d'ombre opaque et ses rivets sont masqués pour éviter des
éléments suspendus devant la pièce.
