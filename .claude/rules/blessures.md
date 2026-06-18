---
paths:
  - "server/src/lib/woundService.js"
  - "server/src/lib/woundUtils.js"
  - "server/src/lib/charStats.js"
  - "server/src/lib/damageService.js"
  - "shared/woundConstants.js"
  - "shared/armorConstants.js"
  - "client/src/character/ArmorWoundPanel.jsx"
  - "client/src/character/SilhouettePanel.jsx"
  - "client/src/character/LocationPanel.jsx"
---
# Domaine : Blessures & Armures

**Spec technique → `docs/SYSTEME/BLESSURES.md`**
**Règles armures → `docs/REGLEARMURE.md`**

## Pièges critiques

**P49 — Promotion blessures : toujours GET /wounds**
Si `promoted === true` dans le retour → GET /wounds complet côté client.
Ne jamais ajouter la wound localement — la promotion peut avoir changé la sévérité.

**PI11 — polarisRound : source unique**
`shared/polarisUtils.js` — jamais redéfini localement dans un composant ou service.

**calcWoundPenalty — non-cumulatif (LdB p.236)**
Pire blessure seule retenue. `calcEncumbrancePenalty` est cumulatif (règle maison).
`effectiveMalus = calcWoundPenalty - calcEncumbrancePenalty` (≤ 0)

**calcCarenceArmure — retourne ≥ 0 (déficit positif, pas un malus signé)**
Utilisation : `skillTotal - calcCarenceArmure(equippedItems, forNA)`.
`max(0, worstMinStr - forNA)` — à soustraire, pas à additionner.

**Mille-feuille ETQ/PRT — calcResistanceArmure**
max + reste/2 par slot. Filtrer les items par slot = localisation touchée uniquement.
`{ etq, prt }` retournés en minuscules, null si pas d'armure équipée sur ce slot.

**WOUND_SEVERITIES — ordre**
`['legere', 'moyenne', 'grave', 'critique', 'mortelle']` — ascendant.
`getWorstWoundSeverity` utilise `.slice().reverse()` pour parcourir du pire au mieux.
