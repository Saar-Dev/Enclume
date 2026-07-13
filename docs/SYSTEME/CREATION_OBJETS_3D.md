# Créer et intégrer un objet 3D

Ce document est le contrat de fabrication des GLB intégrés à Enclume. Il couvre les objets libres, prépare les objets fixés à un mur et distingue les connecteurs structurels comme les portes.

Le modèle prêt à copier se trouve dans `docs/SYSTEME/MANIFESTE_OBJETS_3D.example.json`.

## Choisir le bon type

| Type | Usage | Stockage | Effet sur une salle |
|---|---|---|---|
| `free` | caisse, table, chaise, machine, décoration | entité 3D | aucun |
| `wall` | écran, applique, armoire murale, décoration fixée | entité 3D attachée à un mur | aucun trou |
| `connector` | porte, escalier, futur ascenseur | connecteur de salle | peut découper ou relier la structure |

`placement_mode: "wall"` est le contrat des objets muraux. Le serveur l'importe dans le blueprint et l'éditeur impose alors un accrochage sur une vraie face de mur, avec orientation automatique. Une porte ne doit jamais être déclarée comme simple objet mural : elle reste un connecteur.

## Repère, taille et pivot du GLB

- Y est l'axe vertical.
- X est la largeur, Z est la profondeur.
- La face avant doit regarder vers +Z ; le dos d'un objet mural est donc côté -Z.
- Exporter sans caméra ni lumière.
- Appliquer les transformations avant export : échelle `1,1,1` et rotation propre.
- Garder le modèle à sa taille finale. Enclume ne doit pas l'étirer pour le faire entrer dans son empreinte.
- Objet libre : pivot au centre horizontal, posé au niveau Y=0 (`floor-center`).
- Objet mural : pivot au centre du dos, sur le plan du mur (`wall-back-center`). Y=0 correspond au bas de l'objet. Le boîtier peut dépasser devant le mur, pas derrière le plan d'ancrage.

Attention à l'échelle actuelle : une grande case visible vaut une unité Three.js et représente 1,5 m dans les règles. Les champs historiques sont nommés `*_m`, mais le catalogue les consomme actuellement 1:1 comme unités de scène. Pour qu'un meuble occupe exactement une grande case, son GLB et son empreinte doivent donc mesurer `1.0` unité dans l'état actuel du moteur. Ne pas ajouter de correction d'échelle objet par objet : la conversion globale sera traitée séparément.

## Structure d'un pack intégré

```text
output/
└── mon_pack/
    ├── manifest.json
    └── glb/
        ├── Console murale.glb
        └── Caisse technique.glb
```

Au démarrage, le serveur lit chaque `output/<pack>/manifest.json`. Chaque asset dont le GLB existe est créé ou mis à jour dans `entity_blueprints` avec la clé stable `<pack>/<asset.name>`. Un GLB remplacé garde donc ses instances existantes et reçoit automatiquement une nouvelle URL de cache.

Règles de stabilité :

- le nom du dossier de pack et `asset.name` sont des identifiants ; ne pas les renommer après publication ;
- `catalog_file` doit correspondre exactement au nom du fichier dans `glb/` ;
- `label` est le nom visible et peut changer ;
- le chemin absolu `glb` présent dans certains anciens manifests est ignoré et ne doit plus être ajouté ;
- les champs `features`, `animation` et `color_slots` des anciens packs sont actuellement ignorés par le catalogue.

## Manifeste canonique

Champs nécessaires pour un objet libre :

```json
{
  "format_version": 1,
  "unit": "enclume_world_unit",
  "placement_mode_default": "free",
  "origin_default": "floor-center",
  "assets": [
    {
      "name": "01_technical_crate",
      "label": "Caisse technique",
      "catalog_file": "Caisse technique.glb",
      "category": "storage",
      "placement_mode": "free",
      "origin": "floor-center",
      "footprint_width_m": 1.0,
      "footprint_depth_m": 1.0,
      "height_m": 0.8,
      "editor_color_slots": []
    }
  ]
}
```

Les champs `category`, `placement_mode` et `origin` expriment le contrat de l'asset. `placement_mode_default` et `origin_default` évitent de répéter ces valeurs sur tous les objets homogènes d'un pack ; une valeur portée par un asset reste prioritaire. Le serveur classe actuellement le blueprint avec le nom du dossier de pack.

Pour un objet mural, utiliser :

```json
{
  "placement_mode": "wall",
  "origin": "wall-back-center",
  "wall_mount": {
    "default_bottom_height": 1.0,
    "allow_interior": true,
    "allow_exterior": true
  }
}
```

`default_bottom_height` est une hauteur conseillée en unités de scène. Le placement définitif devra être stocké relativement au panneau de mur : identifiant du mur, face intérieure/extérieure, position le long du mur et hauteur. Il ne faut pas enregistrer un objet mural comme une simple position flottante.

## Couleurs configurables

`editor_color_slots` est le format canonique du panneau de couleurs. Le catalogue convertit aussi l'ancien champ `color_slots` lorsqu'il contient des noms de matériaux, afin que les packs existants restent recolorables ; ne plus utiliser cet ancien format pour un nouveau modèle.

Nom recommandé des matériaux dans Blender :

```text
01_technical_crate__SLOT_01__Primary_Painted_Metal
01_technical_crate__SLOT_02__Secondary_Panels
01_technical_crate__FIXED__Control_Screen
```

Manifest correspondant :

```json
{
  "id": "primary_paint",
  "code": "SLOT_01",
  "label": "Peinture principale",
  "default_hex": "#14596B",
  "transparent": false,
  "material_names": [
    "01_technical_crate__SLOT_01__Primary_Painted_Metal"
  ]
}
```

- un slot peut viser plusieurs matériaux ; les lister tous dans `material_names` ;
- les codes sont stables et uniques dans l'asset : `SLOT_01`, `SLOT_02`, etc. ;
- `default_hex` doit être une couleur `#RRGGBB` ;
- `transparent: true` autorise le réglage d'opacité ;
- un matériau `__FIXED__` n'est jamais recoloré ;
- éviter de partager une même instance de matériau entre une zone recolorable et une zone fixe ;
- textures, normales et propriétés PBR sont conservées lors d'un changement de couleur.

## Géométrie et performances

- Un GLB par objet sélectionnable. Ne pas assembler des dizaines d'entités dans l'éditeur pour fabriquer un meuble.
- Fusionner les meshes statiques qui partagent un matériau lorsque cela ne gêne pas les futurs éléments animés.
- Réutiliser les matériaux au lieu de créer un matériau par primitive.
- Éviter les subdivisions invisibles et les faces internes.
- Les textures doivent être embarquées dans le GLB ou utiliser des URI valides ; l'embarqué est préférable pour un pack intégré.
- Prévoir des mipmaps avec des dimensions de texture en puissance de deux lorsque possible.
- Garder séparées les pièces qui devront être animées : porte de meuble, tiroir, levier, écran mobile.
- Donner des noms stables aux nodes animables et aux matériaux. Ne pas dépendre de noms automatiques comme `Cube.017`.

Le moteur charge le vrai GLB pour l'aperçu, la pose et l'instance. Les dimensions du manifeste servent à l'empreinte, au panneau et à la future collision ; elles doivent couvrir le corps utile du modèle. Les petits éléments décoratifs qui dépassent peuvent être exclus de l'empreinte, mais jamais un pied ou une partie bloquante.

## Eau et fluides animés

Le rendu d'eau est créé au runtime par Enclume. Le GLB fournit la géométrie support et des extras sur le node concerné :

```text
editor_water_role = surface | flow | contained
editor_water_medium = water | algae
```

- `surface` : surface libre horizontale. Le moteur la remplace par un plan subdivisé animé ; son empreinte doit rester à l'intérieur des parois du bac.
- `flow` : cascade ou nappe en mouvement. La géométrie subdivisée et son inclinaison sont conservées par le moteur ; elle doit donc suivre réellement le trajet entre le déversoir et le niveau inférieur.
- `contained` : fluide visible derrière une fenêtre ou dans un tube fermé, avec une déformation presque nulle.
- Ne pas modéliser une cascade avec une succession de cubes ou de cylindres.
- Ne pas superposer un volume transparent complet sous une surface libre : le shader de surface fournit déjà la profondeur visuelle et les volumes superposés provoquent des artefacts de transparence.
- Le nom du node doit rester explicite (`Water_Surface`, `Waterfall_Flow_Sheet`, `Fluid_Window`) pour la compatibilité avec les anciens modèles, mais les extras constituent le contrat prioritaire.

## Animations

Les anciens manifests décrivent parfois `animation` et des numéros de frames, mais le catalogue intégré ne les exploite pas encore. Pour préparer correctement un modèle :

- exporter les animations comme clips glTF nommés (`open`, `close`, `idle`, etc.) ;
- conserver un état fermé propre à la frame initiale ;
- ne pas cuire une translation globale de l'objet dans le clip ;
- documenter les clips dans `animations`, sans supposer qu'ils seront joués avant l'implémentation du contrôleur.

## Cas particulier des connecteurs

Les portes existantes utilisent en plus :

```json
{
  "door_panel_width_m": 1.5,
  "door_panel_height_m": 2.0,
  "wall_cut_width_m": 1.5,
  "wall_cut_height_m": 2.0
}
```

Le cadre statique doit rester dans `wall_cut_width_m`. Les boîtiers de commande peuvent dépasser : ils ne doivent pas élargir le trou. Le modèle conserve son échelle d'origine et le mur est découpé selon les dimensions déclarées.

Escaliers et ascenseurs devront avoir leurs propres métadonnées de liaison d'étages ; ne pas les introduire comme objets `free` ou `wall`.

## Validation et intégration

Depuis la racine du projet :

```powershell
node tools/validate-3d-manifest.mjs output/mon_pack/manifest.json
```

Le validateur contrôle le JSON, les champs obligatoires, les identifiants, les dimensions, la structure des GLB, les modes de pose et les slots de couleur. Il vérifie notamment que chaque nom de `material_names` existe réellement dans le GLB et signale les anciens `color_slots` qui ne sont pas éditables.

Checklist avant transfert :

1. Vérifier le sens avant/arrière et le pivot dans Blender.
2. Appliquer les transformations et exporter un GLB par objet.
3. Mesurer les dimensions réelles du GLB et renseigner l'empreinte sans étirer le modèle.
4. Vérifier les noms de matériaux et `editor_color_slots`.
5. Lancer le validateur sans erreur.
6. Copier le dossier complet sous `output/` sur le serveur.
7. Redémarrer le serveur pour exécuter `syncBuiltinModels()`.
8. Tester l'aperçu, les couleurs, la rotation, la hauteur au sol et la sélection dans l'éditeur.

## Limites connues à ne pas contourner dans les assets

- Un objet mural est enregistré avec le mur, la face intérieure/extérieure, sa position le long du mur et sa hauteur. Ne pas simuler cet ancrage en décalant le pivot au hasard.
- Le constructeur d'entités de l'Atelier expose `free` et `wall` et conserve les métadonnées avancées déjà présentes. Les packs système intégrés restent toutefois pilotés par leur manifeste.
- Le système d'unités règle/Three.js doit être unifié globalement. Ne pas créer des facteurs d'échelle particuliers à chaque modèle.
- Les clips d'animation ne sont pas encore commandés par les états d'entité.
