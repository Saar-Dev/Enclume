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

**P57 — `seed` d'un jet à un seul dé = la valeur du résultat elle-même**
`server/src/lib/diceParser.js` : `seed = rolls.reduce((a,b) => a^b, 0)` — pour un seul dé, XOR d'un
seul élément = cet élément. **Ne jamais utiliser `seed` seul comme source de variation visuelle
qui doit différer entre deux jets tombant sur le même résultat** (ex. roulis aléatoire
`getRandomClockDeg`) — deux "7" auront toujours le même `seed`, donc le même rendu, même si ce sont
deux jets différents. Combiner avec `timestamp` (unique par jet, propagé `DiceRoller.jsx` →
`DiceMesh.jsx` → `DiceMeshGlb`, `Date.parse(timestamp) ^ seed`) pour une vraie variation par jet
tout en restant déterministe et partagé entre tous les clients qui regardent le même jet. Vécu
Session 141 (suite 8) : "aucun effet" du roulis aléatoire signalé par Saar en jeu réel.

**Corrections de roulis par face — `getFaceRollCorrection` (Session 141 suite 8)**
`FACE_ROLL_CORRECTIONS` (`diceMath.js`) — `setFromUnitVectors` seul ne garantit aucun contrôle du
roulis (l'axe est aligné, la rotation autour de cet axe est arbitraire). Actuellement : D4 face "4"
(`tiltDeg: -240`, inclinaison axe X écran — dévie volontairement du face→caméra exact, nécessaire
pour ce dé car chaque face porte les 3 AUTRES chiffres, jamais le sien). Si une face a une
correction ici, le roulis aléatoire (`getRandomClockDeg`) est désactivé pour elle dans
`DiceMeshGlb` (les deux rotations ne commutent pas — un roulis aléatoire casserait la correction
calibrée). Trouver de nouvelles corrections via `/dev/dice-calibration`, jamais à l'aveugle.

**Architecture dés (Session 44)**
- DiceRoller monté dans Canvas3D — même contexte WebGL, pas d'overlay HTML séparé.
- DICE_RESULT consommé deux fois en parallèle : chat (Sidebar) + animation (DiceRoller).
- Animation déclenchée uniquement si `!skillLabel` (jets normaux, pas jets entités).
- `seed` du payload initialise le PRNG déterministe de l'animation.

**D12 atlas — fillText centroïde**
`fillText` à `atlasSize * 0.397` — valeur calculée expérimentalement, ne pas modifier.

**D20 — normales Blender**
`D20_GLB_NORMALS` : 20 normales exactes, clés = numéros réels du dé (remapping test visuel + validation antipodal).
