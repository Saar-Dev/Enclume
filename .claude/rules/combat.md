---
paths:
  - "server/src/socket/index.js"
  - "server/src/lib/damageService.js"
  - "server/src/lib/woundService.js"
  - "server/src/lib/woundUtils.js"
  - "server/src/lib/statusService.js"
  - "server/src/lib/charStats.js"
  - "server/src/lib/socketUtils.js"
  - "client/src/components/Combat*.jsx"
  - "client/src/components/MeleeCombatPanel.jsx"
  - "client/src/components/AssaultRangedPanel.jsx"
  - "client/src/components/DroneWeaponPanel.jsx"
  - "client/src/components/combatSections.js"
  - "client/src/lib/useCombatSocket.js"
  - "client/src/stores/combatStore.js"
  - "shared/armorConstants.js"
  - "shared/woundConstants.js"
  - "shared/polarisUtils.js"
---
# Domaine : Combat

**Spec technique → `docs/SYSTEME/COMBAT.md`**
**Règles mécaniques (source absolue) → `docs/REGLESYSCOMBAT.md`**
**Synthèse technique séquences/pipeline → `docs/MANUELSYSCOMBAT.md`**
**Reworks en cours (REWORK-08 prochain) → `docs/ARCHI_REWORK.md`**
**Reworks achevés (01/02/03/05/07/09) → `docs/ARCHI_REWORK_DONE.md`**
**Bugs identifiés → `docs/BUGIDENTIFIE.md`**

## Pièges critiques

**BUG C — weapon_inv_id ≠ item_id**
`weapon_inv_id → char_inventory.equipment_id → ref_equipment_skill_assoc WHERE item_id = equipment_id`
(`ref_equipment_skill_assoc.item_id` FK → `ref_equipment.id`, pas `char_inventory.id`)
Erreur → skillTotal = 0, assaut toujours raté.

**P51 — effectiveMalus formule exacte**
```js
effectiveMalus = calcWoundPenalty(wounds) - calcEncumbrancePenalty(weight, FOR)  // ≤ 0
chancesDeReussite = skillTotal + totalDiffMod + effectiveMalus
```

**PC27 — Entité ≠ PNJ**
`!token.character_id` = entité de décor — jamais un PNJ.
PNJ = `character.type === 'pnj'`. Entité exclue du combat.

**PC39 — state_character JSONB : merge obligatoire**
`db.raw('state_character || ?::jsonb', [JSON.stringify({ is_stunned: true })])`
Jamais `UPDATE SET state_character = '{"is_stunned":true}'` — écrase tous les autres flags.

**PC28 — state_character : source correcte**
Lire depuis `combat_roster`, jamais depuis `combat_actions`.

**PC29 — activeSlotIdx indexe le roster trié**
`const sortedRoster = [...roster].sort((a, b) => b.initiative - a.initiative)`
`activeSlotIdx` indexe ce roster TRIÉ — pas le roster brut.

**fire_mode_bonus_dmg — portée courte seulement**
`fire_mode_bonus_dmg` appliqué uniquement si portée ∈ `{bout_portant, courte}`, sinon 0.

**PC-CaC1 — skill mains nues**
`COMBAT_A_MAINS_NUES` (FOR/COO) — jamais `COMBAT_CONTACT` (n'existe pas dans ref_skills).

**Implémenter mécanique combat → STOP. `docs/REGLESYSCOMBAT.md` lu dans cette session ?**
