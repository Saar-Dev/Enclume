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

**PE32 — DiceMesh useMemo : deps obligatoires**
`[geoDef.type, color, dieType]` — `dieType` obligatoire.
Oublier `dieType` → D10 jamais rendu correctement.

**PE33 — D10 Html overlay : position fixe**
`position=[0,0,0]` — ne pas déplacer.
L'overlay est calculé depuis la géométrie, pas depuis la position du mesh.

**Architecture dés (Session 44)**
- DiceRoller monté dans Canvas3D — même contexte WebGL, pas d'overlay HTML séparé.
- DICE_RESULT consommé deux fois en parallèle : chat (Sidebar) + animation (DiceRoller).
- Animation déclenchée uniquement si `!skillLabel` (jets normaux, pas jets entités).
- `seed` du payload initialise le PRNG déterministe de l'animation.

**D12 atlas — fillText centroïde**
`fillText` à `atlasSize * 0.397` — valeur calculée expérimentalement, ne pas modifier.

**D20 — normales Blender**
`D20_GLB_NORMALS` : 20 normales exactes, clés = numéros réels du dé (remapping test visuel + validation antipodal).
