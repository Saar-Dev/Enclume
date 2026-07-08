---
paths:
  - "server/src/lib/diceParser.js"
  - "server/src/routes/dice.js"
  - "client/src/components/DiceRoller.jsx"
  - "client/src/components/DicePanel.jsx"
  - "client/src/components/DiceMesh.jsx"
  - "client/src/lib/diceMath.js"
---
# Domaine : Dés & Animations

**Spec technique → `docs/SYSTEME/DICE.md`**

## Pièges critiques

**PE32 — DiceMesh useMemo deps (obsolète Session 141)**
`dieType` dans les deps de `material` (`DiceMeshProcedural`) n'est plus utilisé dans ce useMemo
depuis la suppression du code mort D10 procédural (PLAN_DICEREWORK3) — warning ESLint connu, sans
impact (chemin mort : tous les dieType ont une entrée `GLB_PATHS`, `DiceMeshProcedural` n'est plus
jamais rendu).

**D10/D10_units/D10_tens — normales GLB (recalibrées Session 141)**
`D10_GLB_NORMALS`/`D10T_FACE_GLB` (`diceMath.js`) — calibrées via `/dev/dice-calibration`. Les
valeurs introduites Session 65 (en même temps que les `.glb`) ne correspondaient à aucune face
réelle — jamais recalculées correctement avant PLAN_DICEREWORK3. Toujours vérifier avec
`tools/inspect-glb.js` avant de retoucher ces tables (voir `docs/PLAN_DICEREWORK3.md`).

**Outil dev permanent `/dev/dice-calibration` (Session 141)**
Route `App.jsx` — vérifie/calibre les 7 dieType (k-means à la volée depuis la géométrie chargée,
`client/src/lib/devFaceClusters.js`, zéro vecteur transcrit à la main) + `getClosestFaceValue()`
(`diceMath.js`) affiche "le code prévoit : X" à côté de chaque face. **Limite connue** : affiche
parfois une arête/pointe (pas une face) sur D8/D20 — confirmé Session 141 comme un artefact propre
à l'outil (absent en jeu réel), pas un bug de calibration. Ne pas re-diagnostiquer sans nouvelle
information (déjà vérifié : clustering via le vrai `GLTFLoader`, maths de rotation).

**Architecture dés (Session 44)**
- DiceRoller monté dans Canvas3D — même contexte WebGL, pas d'overlay HTML séparé.
- DICE_RESULT consommé deux fois en parallèle : chat (Sidebar) + animation (DiceRoller).
- Animation déclenchée uniquement si `!skillLabel` (jets normaux, pas jets entités).
- `seed` du payload initialise le PRNG déterministe de l'animation.

**D12 atlas — fillText centroïde**
`fillText` à `atlasSize * 0.397` — valeur calculée expérimentalement, ne pas modifier.

**D20 — normales Blender**
`D20_GLB_NORMALS` : 20 normales exactes, clés = numéros réels du dé (remapping test visuel + validation antipodal).
