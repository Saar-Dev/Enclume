PLAN — Décorations murales (Wall Decals)
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