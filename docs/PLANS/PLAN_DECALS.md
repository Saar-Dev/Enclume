PLAN — Décorations murales (Wall Decals)

> **2026-09-16** — Ambiguïté avec `PLAN_RW_MATERIAUX.md` Lot 3 résolue (voir `docs/VOCABULARY.md`
> « Ambiguïtés connues » — Décal). Les deux ne se recouvrent pas : Lot 3 = texture source d'un motif
> procédural appliqué à toute une surface (ingrédient du pipeline matériaux) ; ce document =
> objet décoratif ponctuel positionné à un endroit précis d'un mur, indépendant du matériau de base.
> Les deux peuvent coexister sur le même mur. Recherche pro (Three.js `DecalGeometry`, Unity Decal
> Projector, Unreal Decal Actor) faite le même jour pour trancher la stratégie de rendu — voir §4bis.
> **Reste hors de ce document** : l'outil d'édition de forme de salle (arêtes/sommets), traité par
> `PLAN_WORLD_BUILDER_REWORK.md` — sujet distinct malgré la même session de cadrage.

Objectif

Permettre au MJ d'appliquer instantanément une décoration (câbles, conduites, panneaux, affiches, etc.) sur une face intérieure de mur, sans créer de nouveau GLB ni modifier le matériau du mur.

Étape 1 — Étude du modèle existant

Objectif

Identifier l'autorité actuelle des matériaux et des apparences de murs.

À analyser :

format réel de surface_data
wallAppearanceProfiles
floorMaterial
ceilingMaterial
wallInteriorMaterial
UUID existants
normalisation
validation serveur

Livrable :

déterminer si une décoration appartient :

à un mur
à une salle
ou à une collection indépendante.
Étape 2 — Définition du concept métier

Créer un nouveau concept.

Exemple :

WallDecoration

Responsabilités :

texture
position
orientation
dimensions
couleur éventuelle

Pas de collision.
Pas de navigation.
Pas de LOS.
Pas de physique.
Uniquement de l'apparence.

Étape 3 — Intégration dans surface_data

Choisir son emplacement.

Deux possibilités seront évaluées :

surface_data.wallDecorations[]

ou

room.wallDecorations[]

Critères :

persistance
duplication
fusion de salles
suppression de murs
copie d'une salle
stabilité des UUID
Étape 4 — Rendu

Le renderer devra :

récupérer les décorations du mur
générer un quad projeté

ou

utiliser un DecalMesh

suivant les performances.

Le mesh du mur reste inchangé.

Étape 4bis — Stratégie de rendu tranchée par la recherche pro (2026-09-16)

Comparaison faite : `THREE.DecalGeometry` (exemple officiel three.js — projette un cube orienté,
clippe la géométrie cible contre ses 6 faces, épouse exactement une surface plane ou courbe, coûteux
si régénéré souvent, à calculer une fois à la pose) ; Unity Decal Projector (URP/HDRP — projection
planaire simple, mal adaptée à une surface non plane, limite documentée officiellement) ; Unreal
Decal Actor (projection volumique, gère mieux les surfaces courbes, beaucoup de decals simultanés
sans grosse perte de perf).

Décision : donnée déclarative uniquement dans `surface_data` (mur/segment cible, position relative,
normale, taille, texture) — seule autorité, jamais de coordonnées Three.js indépendantes stockées.
Au rendu :
- mur plan (cas par défaut) → simple quad plaqué avec léger offset, coût nul ;
- mur courbe ou profilé → vrai decal projeté (`DecalGeometry`), recalculé quand le mur change dans
  le `WorldSnapshot` — jamais l'inverse (le rendu ne redéfinit jamais le modèle canonique).

Ce choix répond aussi à la question ouverte "les décorations doivent-elles suivre les UV existants
du mur ou une projection indépendante ?" (§Questions ouvertes) : ni l'un ni l'autre — la projection
en cas de mur courbe rend la question des UV du mur sans objet pour la décoration elle-même.

Étape 5 — Outil d'édition

Workflow :
Sélection
↓
Décoration murale
↓
Choix du motif
↓
Survol du mur
↓
Prévisualisation
↓
Clic
↓
Placement

Étape 6 — Persistance

À vérifier :

sauvegarde
duplication de carte
world_revision
surface_revision

Les décorations étant purement visuelles, il faudra décider si elles influencent world_revision ou uniquement surface_revision. Intuitivement, elles ne devraient pas nécessiter une recompilation du WorldSnapshot, mais il faudra vérifier le contrat actuel de compilation.

Étape 7 — Édition

Fonctions :

sélectionner
déplacer
supprimer
changer de texture
rotation
miroir
ordre d'affichage si plusieurs décorations se superposent
Questions ouvertes (à trancher après lecture du code)
Les décorations suivent-elles les UV existants du mur ou utilisent-elles une projection indépendante ?
Les murs courbes utilisent-ils un UV continu sur toute leur longueur (ce que semble indiquer la documentation) ou des UV reconstruits par panneau ?
Le renderer accepte-t-il déjà plusieurs couches de matériau sur un mur ?
Les décorations doivent-elles pouvoir traverser une porte ou être automatiquement découpées par les ouvertures ?
Que devient une décoration lorsqu'un mur est fusionné, scindé ou supprimé ?
Documentation dont j'ai besoin

Pour éviter toute hypothèse, il me manque maintenant les documents (ou fichiers) suivants, par ordre de priorité :

Le schéma réel de surface_data (ou normalizeSurfaceData) : c'est la source de vérité pour savoir où intégrer le nouveau concept.
Le validateur serveur de surface_data (prepareSurfaceData, validation JSON ou équivalent) : il faudra y ajouter la nouvelle structure.
Le code de génération des murs (renderer) : le fichier qui transforme wallPaths / RoomVolume en meshes Three.js et génère les UV.
Le système de matériaux : où sont définis wallInteriorMaterial, les textures et leurs paramètres (usure, saleté, relief).
Le catalogue d'assets : comment sont enregistrés aujourd'hui les textures et les GLB (blueprints, manifest, base SQL, JSON, etc.), afin que les décorations réutilisent l'infrastructure existante plutôt que d'en créer une parallèle.

Avec ces éléments, on pourra rédiger une spécification qui respecte les invariants du moteur (autorité unique, absence de duplication de logique, compatibilité avec les murs droits, courbes et profilés) avant de passer à l'implémentation.