# PLAN_FORMES_ENTITES.md — Rampe, Slope, Porte (Atelier du GM)
> Rédigé session 138 — 2026-07-06

---

## Contexte

Demande Saar : ajouter au Playground trois formes géométriques manquantes — **slope**, **ramp**
(vocabulaire anglais approximatif, clarifié ci-dessous) et **porte** (hauteur 2, épaisseur 0 ou 0.1,
largeur 1).

**Clarifications obtenues (session 138) :**
- Périmètre = **entité uniquement** (Atelier du GM). Le système voxel (`block_types`) n'est pas
  concerné — ses valeurs `slope`/`wedge` existantes (placeholders cube, voir `Voxel.jsx`) restent
  un chantier strictement séparé, déjà documenté dans `ROADMAP.md` ("Géométrie slope et wedge custom").
- "Rampe" = forme **triangle** (plan incliné droit). "Slope" = forme **arrondie/courbe**. Aucune des
  deux n'existe nulle part dans le projet aujourd'hui (contrairement à une lecture initiale erronée
  qui aurait pu confondre avec l'enum voxel `slope`/`wedge` — sans rapport, vocabulaire coïncident).
- Pas d'escalier — la demi-dalle (`slab_bottom`) couvre déjà le besoin de palier.
- Clause GM : si une des trois formes s'avère trop complexe à l'usage, elle part en chantier séparé
  plutôt que de bloquer les deux autres.

**Lecture effectuée avant ce document** : `server/src/db/migrations/41_entity_blueprints.js`,
`client/src/components/EntityMesh.jsx`, `client/src/components/EntityBuilderTab.jsx`,
`server/src/routes/entity-blueprints.js`, `client/src/components/GeometryIcon.jsx`,
`docs/Old/PLAN_WORKSHOP.md`, `docs/ROADMAP.md`, `.claude/rules/entities.md`.

**État actuel du système entité (constat de lecture) :**
- `entity_blueprints.geometry` (JSONB) = `{ width, height, depth, faces: {top,bottom,north,south,east,west} }`
  — aucun concept de "forme" (shape) : la géométrie visuelle est **toujours** un `BoxGeometry(width,height,depth)`
  côté `EntityMeshVoxel` ([EntityMesh.jsx:235-236](client/src/components/EntityMesh.jsx#L235-L236)),
  sauf apparence GLB (modèle custom uploadé).
- Aucune validation serveur sur `geometry` — la route `entity-blueprints.js` stocke le JSONB tel
  quel ([entity-blueprints.js:72](server/src/routes/entity-blueprints.js#L72)). La seule contrainte
  vient du formulaire client : `min="1" max="10" step="1"` sur width/height/depth
  ([EntityBuilderTab.jsx:478](client/src/components/EntityBuilderTab.jsx#L478)) — entiers ≥ 1
  uniquement, ce qui bloque une épaisseur 0 ou 0.1 aujourd'hui.

---

## Recherche — solution technique retenue

Recherche effectuée (docs officielles Three.js + forum + issues GitHub `mrdoob/three.js`) avant
toute décision d'architecture, conformément à la consigne de ne jamais bricoler une géométrie
maison quand une primitive éprouvée existe.

**Écartés :**
- **BufferGeometry manuelle** (vertices/UV/normales à la main, comme `buildCulledMesh.js` le fait
  pour les cubes) : viable pour un prisme simple, mais dupliquerait pour la Rampe un travail que
  Three.js fournit déjà nativement — non retenu par souci de robustesse et de maintenabilité.
- **CSG booléen** (`three-bvh-csg`, lib maintenue par gkjohnson, la référence actuelle pour les
  opérations booléennes rapides en Three.js) : outil pertinent pour soustraire/combiner des solides
  indépendants (ex. découpe d'un trou dans un mur), mais surdimensionné ici — on ne combine rien,
  on veut juste un prisme à section personnalisée. Ajouterait une dépendance lourde
  (`three-mesh-bvh` + construction BVH) sans bénéfice, à éviter sur cible Raspberry Pi 4.

**Retenu : `THREE.Shape` + `THREE.ExtrudeGeometry` avec `UVGenerator` custom.**
- Primitive **native** Three.js, documentée, conçue exactement pour ce besoin : un profil 2D
  (`THREE.Shape`) extrudé le long d'un axe droit.
- Le même profil peut être **droit** (`.lineTo()` — donne la Rampe/triangle) ou **courbe**
  (`.absarc()` / `.quadraticCurveTo()` — donne le Slope arrondi), avec `extrudeSettings.curveSegments`
  pour régler la finesse de la courbe. **Une seule technique, un seul composant paramétrable, pour
  les deux formes** — pas deux implémentations distinctes à maintenir.
- Le mapping UV par défaut d'`ExtrudeGeometry` est connu pour être imprécis sur les faces latérales
  (confirmé par plusieurs issues ouvertes sur `mrdoob/three.js`, ex. #31312, #4994) — Three.js expose
  précisément pour cela le hook documenté `extrudeSettings.UVGenerator` (voir aussi le pattern
  communautaire "Shape Based UVGenerator for ExtrudeGeometry"), qui permet de générer un UV 0-1 par
  face selon sa bounding box — identique dans l'esprit au tiling déjà utilisé pour les faces du cube
  (`EntityMeshVoxel`/`Voxel.jsx`, P32). C'est l'approche que ce plan retient : pas de mapping par
  défaut, un `UVGenerator` dédié écrit pour ce projet.
- Groupement multi-matériaux : `BufferGeometry.addGroup` (mécanisme natif, celui qu'utilise déjà
  `BoxGeometry` en interne pour ses 6 faces) isolera chaque face droite (bas, dos, flancs/capuchons)
  comme groupe distinct ; la face courbe du Slope reste un groupe unique malgré sa subdivision interne
  en plusieurs quads (un seul matériau/texture étiré sur toute la courbe, cohérent avec un rendu
  "rampe incurvée" continu).

Sources consultées : [ExtrudeGeometry — docs officielles](https://threejs.org/docs/#api/en/geometries/ExtrudeGeometry),
[UV Mapping Options for ExtrudeGeometry — issue #1396](https://github.com/mrdoob/three.js/issues/1396),
[ExtrudeGeometry custom UV — issue #31312](https://github.com/mrdoob/three.js/issues/31312),
[Shape Based UVGenerator for ExtrudeGeometry — CodePen](https://codepen.io/novogrammer/pen/mOrBLe),
[three-bvh-csg — gkjohnson](https://github.com/gkjohnson/three-bvh-csg).

---

## Décisions architecture

### Modèle de données
- Nouveau champ JSONB `blueprint.geometry.shape` : `'box'` (défaut — rétrocompatible avec tous les
  blueprints existants, absent = box), `'ramp'`, `'slope'`.
- **Aucune migration SQL** : `geometry` est déjà un JSONB libre (migration 41) ; le serveur ne valide
  rien dessus (constat ci-dessus) — ajouter la clé ne casse rien côté existant.
- Faces exposées par forme (adaptation du formulaire, `FACE_NAMES` devient dépendant de `shape`) :
  - `box` (existant) : `top, bottom, north, south, east, west` — inchangé.
  - `ramp` / `slope` (5 faces au lieu de 6) : `bottom` (base), `back` (face verticale, remplace
    `north`), `slope` (face inclinée/courbe, remplace `top`), `east`, `west` (flancs/capuchons de
    l'extrusion). `south` n'existe pas pour ces formes — masqué dans le formulaire, jamais envoyé.
- Orientation de la pente : réutilise `entity.r` (rotation existante 0-3, déjà gérée par
  `EntityMesh`/`EntityInstancePanel`) — pas de nouveau champ.

### Rendu (`EntityMesh.jsx`)
- Nouveau sous-composant `EntityMeshExtruded` (nom à confirmer au moment du code), sélectionné dans
  `EntityMesh` quand `blueprint.geometry.shape` ∈ `{'ramp','slope'}`, sinon `EntityMeshVoxel` inchangé.
- Géométrie construite une fois par `useMemo([width,height,depth,shape])` — coût de génération payé
  à la création/au changement de dimensions, pas par frame (`useFrame` ne fait que le lerp de
  position, comme aujourd'hui).
- Hitbox : conserve le pattern existant (boîte englobante invisible pour le raycasting/hover, cf.
  `P23` voxel — même principe déjà appliqué aux entités GLB) — pas de hitbox "collée" à la forme
  réelle, cohérence avec le reste du projet.

### Porte
- **Aucune nouvelle géométrie** : `BoxGeometry(width,height,depth)` existant suffit. Seul changement :
  assouplir l'input `depth` du formulaire (`step="0.1"`, `min="0"`) — `width`/`height` restent des
  entiers ≥ 1 (pas de cas d'usage identifié pour les fractionner).
- Point de vigilance à vérifier en pratique (pas une hypothèse bloquante, juste un test visuel à
  faire pendant le "run à vide") : rendu d'un `BoxGeometry` avec une dimension à 0 — les deux faces
  coïncidentes (avant/arrière) doivent s'afficher sans z-fighting (un seul plan, normales opposées,
  pas de recouvrement de deux polygones distincts).

---

## Phasage (un livrable validé avant le suivant — protocole séquentiel)

1. **Porte** — le plus simple, valide le point d'ouverture `depth` avant de toucher au reste.
2. **Rampe** (triangle, profil droit) — introduit `shape`, `UVGenerator`, `EntityMeshExtruded`,
   adaptation du formulaire (faces conditionnelles). Sert de base testée avant la forme courbe.
3. **Slope** (arrondi, profil courbe) — réutilise le même composant/`UVGenerator` que la Rampe avec
   un profil `.absarc()` au lieu de `.lineTo()` ; seul risque réel = le découpage en groupes de
   matériaux sur la portion courbe (à valider à l'usage — c'est le candidat le plus probable pour la
   clause "chantier à part" si la subdivision s'avère plus complexe que prévu).

---

## Fichiers concernés (relecture complète obligatoire au moment de chaque "Je code ?", par phase)

| Fichier | Rôle dans le chantier |
|---|---|
| `client/src/components/EntityBuilderTab.jsx` | Formulaire : sélecteur `shape`, dimensions (`depth` assoupli), faces conditionnelles, aperçu 3D (`RotatingEntity`) |
| `client/src/components/EntityMesh.jsx` | Rendu : nouveau `EntityMeshExtruded`, dispatch selon `shape` |
| `server/src/routes/entity-blueprints.js` | Aucun changement attendu (JSONB libre) — à reconfirmer en lisant le fichier en entier au moment du code |
| `client/src/locales/fr.json` / `en.json` | Nouvelles clés : labels formes (`builder.geometries.ramp/slope`), labels faces `back`/`slope` |
| `.claude/rules/entities.md` | Nouveaux pièges si découverts (ex. UVGenerator, groupes de matériaux) |
| `docs/ROADMAP.md` | Mise à jour statut une fois chaque phase livrée |

---

## Questions ouvertes à trancher au moment du code (pas bloquantes pour ce document)

- Nom exact des clés (`shape` retenu ici par défaut, à reconfirmer) et des faces `back`/`slope` dans
  `fr.json`.
- Détail du découpage `addGroup` pour la face courbe du Slope (un seul groupe visuel vs plusieurs
  segments internes — impact uniquement technique, pas visible pour l'utilisateur final).
