# SYSTEME/DICE.md — Flux dés, animation, DICE_RESULT
> Source : SYSTEME.md §10
> Lire pour : tout code touchant les jets de dés (DICE_ROLL, DICE_RESULT, animation 3D, DiceRoller)

---

## Flux dés

```
DicePanel ou Sidebar (/r) → socket.emit(DICE_ROLL, { formula })
Serveur : parseDice(formula) → lookup dice_config → isCriticalSuccess/Fail
  → io.to(campaignId).emit(DICE_RESULT, { userId, username, color, formula, rolls, total, seed, ... })
SessionPage handler DICE_RESULT → double consommation (session 44) :
  1. addMessage({ type: 'dice', ... })         → chat Sidebar (tous les jets)
  2. if (!skillLabel) setLastDiceRoll(payload) → animation 3D (jets normaux uniquement)
```

## Dice Rework — Animation 3D (session 44)
```
lastDiceRoll state (SessionPage) → prop dicePayload → Canvas3D → DiceRoller (R3F)
DiceRoller : decomposeDice(rolls, dieType, seed) → N DiceMesh dans N lanes
DiceMesh : animation SLERP quaternion 1.8-2.5s → face résultat vers caméra → figé
Clic n'importe où → onDiceDone() → lastDiceRoll = null → DiceRoller démonté

Filtrage : jets d'entité (skillLabel défini) → pas d'animation
Couleur : color du payload DICE_RESULT → matériau/texture du dé

Dés V1 avec face texturée : D6, D4, D8, D20, D12 (atlas)
Dés V1 Html overlay : D10, D10_tens, D10_units (UV kite = V2 Blender)
```

## Payload DICE_RESULT — champs complets
```javascript
{
  userId, username, color,
  formula, rolls, total,
  isCriticalSuccess, isCriticalFail,
  seed,               // XOR rolls — initialisé PRNG animation
  timestamp,
  // Jets de compétence :
  skillLabel,         // défini → pas d'animation 3D (jets entité/combat)
  mechanicalTotal,    // total brut avant modificateurs
  chancesDeReussite,  // CDR = skillTotal + mods + malus
  diffLabel,          // label difficulté (string)
  isSuccess,          // bool — jet réussi
  effectiveMalus,     // woundPenalty − encumbrancePenalty
  mr,                 // marge de réussite = CDR − roll
  // Jets combat_damage :
  interactionType,    // 'combat_damage' pour les jets de dégâts
  targetName,         // nom de la cible
  localisation,       // label localisation (ex. 'Corps')
  severity,           // 'legere' | 'moyenne' | 'grave' | 'critique' | 'mortelle'
  severityColor,      // hex string
}
// Champs optionnels selon le contexte — undefined si non applicable.
```

## Pièges dés

**PE32 — DiceMesh useMemo deps : dieType obligatoire**
`[geoDef.type, color, dieType]` — D10 a 3 types (`d10`, `d10_units`, `d10_tens`) avec matériaux différents.

**PE33 — D10 UV kite = V2 Blender uniquement**
Ne pas tenter de calculer les UVs kite en code pur. V1 = Html overlay `position={[0,0,0]}` — ne pas déplacer.

## Jets de combat (intégration DICE_RESULT)
Les jets de résolution d'assaut (attaque + dégâts) émettent aussi `DICE_RESULT` vers la room.
`skillLabel` absent → animation 3D déclenchée pour tous les participants.
Champs supplémentaires possibles dans le payload selon `interactionType` :
- `interactionType: 'combat_damage'` → `localisation`, `severity`, `severityColor` dans le chat Sidebar
