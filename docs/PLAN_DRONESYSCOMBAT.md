# PLAN — Drones : Intégration Combat
> Rédigé : 2026-06-10 Session 87
> Statut : **Compréhension complète — prêt à planifier les sprints**
> Prérequis : migrations 71+72+73 appliquées ✅ (Sprint 1 + Sprint 1bis terminés)

**Sources règles :** `docs/REGLEDRONE.md` (LdB p.319-320 + Guide Technique p.245-253)
**Spec technique drones :** `docs/MANUELSYSCOMBAT.md §7` — SOURCE DE VÉRITÉ pour toute mécanique drone
**Architecture combat :** `docs/SYSTEME/COMBAT.md`

---

## Vision

Les drones participent au combat **sans modifier le path humanoïde** (PJ/PNJ). Tous les branchements sont sur `character.type === 'drone'`.

Deux modes de contrôle. `state_control_mode` = état **persistant** sur la ligne drone du `combat_roster`. Défini en phase Roster, modifiable via l'action **"Télépiloter"** du character propriétaire (toggle).

| Mode | INI | Compétence d'attaque | CaC | Joueur |
|---|---|---|---|---|
| **`autonome`** | 12 (fixe, immuable) | `programme_armement_distance.level` (ou `armement_contact` si `fire_mode='cc'`) | Joueur déplace le drone (2e entité) — attaque auto-résolue | Contrôle character + drone indépendamment |
| **`télépiloté`** | INI du character propriétaire | `min(programme_armement_drone, TELEPILOTAGE_proprio)` | Character déplace + attaque auto-résolue | Character consomme son tour |

---

## Différences mécaniques drone vs humanoïde

| Aspect | Humanoïde | Drone |
|---|---|---|
| **Initiative base** | `calcREA(ada_na, per_na)` | 12 fixe (LdB p.320) |
| **Skill total attaquant** | `calcSkillTotal(...)` | `programme_armement_distance.level` (autonome ranged) — `min(programme.level, TELEPILOTAGE_proprio)` (télépiloté) |
| **Malus blessures / encombrement** | Oui | Aucun |
| **Carence armure** | `calcCarenceArmure(...)` | Aucun |
| **Arme** | `char_inventory` | `drone_weapons` |
| **Localisation touché** | D20 → `LOC_TABLE` (6 zones) | Fixe : `drone_sheet.localisation_ref` |
| **Armure cible** | `calcResistanceArmure(slots)` | `drone_sheet.blindage` (valeur directe) |
| **Résistance dommages** | `calcResistanceDommages(for_na, con_na)` | `calcDroneRD(integrite_actuelle)` = `integrite × 2` → table RD LdB p.112 |
| **Enregistrement blessures** | `character_wounds` | `drone_sheet.damages` JSONB + `integrite_actuelle` |
| **Test de Choc** | Oui | Aucun |
| **Dégâts PJ** | `COMBAT_DAMAGE_PROMPT` → joueur lance | `COMBAT_DAMAGE_PROMPT` → joueur lance → `COMBAT_DAMAGE_CONFIRM` → defenses drone |
| **Allures** | `calcAllures(coo_na, athletisme)` | `drone_sheet.vitesse` (m/Tour) |

---

## Zéro régression — règle absolue

- `resolveAssaultAction` : branchement **uniquement en entrée** sur `character.type` — les 350+ lignes du path PJ/PNJ restent intactes.
- `COMBAT_START` : un seul `if (character.type === 'drone')` avant le bloc REA existant.
- Toutes les colonnes `state_*` de `combat_roster` restent — ignorées pour les drones, pas supprimées.

---

## Migration 76 — `76_combat_actions_drone.js`

```sql
ALTER TABLE combat_actions
  ADD COLUMN drone_weapon_inv_id UUID REFERENCES drone_weapons(id) ON DELETE SET NULL,
  ADD CONSTRAINT chk_weapon_xor
    CHECK (weapon_inv_id IS NULL OR drone_weapon_inv_id IS NULL);
```

`weapon_inv_id` FK → `char_inventory` (humanoïdes). `drone_weapon_inv_id` FK → `drone_weapons` (drones). La contrainte XOR empêche les deux non-nuls simultanément en DB.

---

## Sprint Drones 2a — COMBAT_START + base_initiative (micro)

**Scope :** drone apparaît dans la timeline à INI 12. Rien d'autre.

### server/src/socket/index.js — COMBAT_START (~ligne 1467)

```js
character = await db('characters').where({ id: token.character_id }).first()

if (character?.type === 'drone') {
  rosterData.push({ token, base_initiative: 12, character, is_pnj: false, forcedNotSurprised: true })  // base_initiative (pas base_ini)
  continue  // pas de char_sheet, pas de calcREA
}
// Note : dans rosterRows.map, forcer is_surprised = false si forcedNotSurprised
// (drones ont INI 12 fixe — la surprise ne les affecte pas)

// Path humanoïde existant inchangé :
const cs = await db('char_sheet')...
```

### COMBAT_ACTION_DECLARE (~ligne 1815)

```js
// Guard GM — étendre à 'drone' :
if (character.type === 'pnj' || character.type === 'drone') {
```

### INI delta pour drone

Dans le calcul `iniDelta` : aucun `transitionCost` pour les drones.

```js
const isDrone = character.type === 'drone'
const positionCost = isDrone ? 0 : transitionCost('position', ...)
const weaponCost   = isDrone ? 0 : transitionCost('weapon',   ...)
const fireModeCost = isDrone ? 0 : transitionCost('fire_mode', ...)
```

**Smoke test :** un drone apparaît dans la CombatTimeline à initiative 12.

---

## Sprint Drones 2b — Drone comme cible

**Scope :** un humanoïde (PJ ou PNJ) attaque un drone. Intégrité décrémentée, broadcast reçu.

### Deux branchements selon l'attaquant

**Cas A — PNJ attaquant un drone** : branchement dans `resolveAssaultAction`, section auto-résolution PNJ (après calcul de `degautsBruts`). `degautsBruts` est déjà calculé avec `modDegatsMode` inclus à ce stade.

```js
// APRÈS le calcul commun de degautsBruts (qui inclut modDegatsMode pour le ranged)
if (cibleCharacter.type === 'drone') {
  const droneSheet = await db('drone_sheet').where({ character_id: cibleCharacter.id }).first()
  const etq  = droneSheet.blindage ?? 0
  const rd   = calcDroneRD(droneSheet.integrite_actuelle)
  const degatsNets = Math.max(0, degautsBruts - etq - rd)
  await resolveDroneIntegrityLoss(io, campaignId, cibleCharacter.id, cibleTokenId, droneSheet, degatsNets)
  // Pas de Test de Choc, pas de wound insertion
  return
}
```

**Cas B — PJ attaquant un drone** : PJ passe par `COMBAT_DAMAGE_PROMPT` (identique au flow PNJ) → `COMBAT_DAMAGE_CONFIRM`. Dans `COMBAT_DAMAGE_CONFIRM`, après le calcul commun de `degautsBruts` (~ligne 2263-2271) :

```js
// APRÈS le calcul commun de degautsBruts (branche melee ou ranged déjà traitée)
if (cibleCharacter.type === 'drone') {
  const droneSheet = await db('drone_sheet').where({ character_id: cibleCharacter.id }).first()
  const etq  = droneSheet.blindage ?? 0
  const rd   = calcDroneRD(droneSheet.integrite_actuelle)
  const degatsNets = Math.max(0, degautsBruts - etq - rd)
  await resolveDroneIntegrityLoss(io, campaignId, cibleCharacter.id, cibleTokenId, droneSheet, degatsNets)
  // Pas de Test de Choc, pas de wound insertion
  return
}
```

### Nouvelle fonction `calcDroneRD(integrite)`

```js
// ⚠️ PD3 : exporter lookupTable + RD_TABLE depuis charStats.js avant d'utiliser cette fonction.
// RD_TABLE = [{ min, max, rd }, ...] — lookup par range, PAS par index entier.
// Input = integrite_actuelle × 2 (LdB p.88 : "en multipliant l'Intégrité actuelle par deux").
// Comportement intentionnel : drone sain (intégrité haute) → rd négatif → soustrait moins → plus vulnérable.
//   Drone endommagé (intégrité basse) → rd positif → soustrait plus → plus résistant (noyau durci).
//   Source : LdB p.88 — validé Session 88.
function calcDroneRD(integrite) {
  const rdInput = (integrite ?? 0) * 2
  return lookupTable(RD_TABLE, rdInput, 'rd') ?? 0
}
```

⚠️ **PD3** : exporter `RD_TABLE` et `lookupTable` depuis `charStats.js`. Ces deux symboles sont actuellement `const` internes non exportés. Ajouter `export` devant les deux déclarations. Pas de calcul `for_na + con_na` — input direct.

### Nouvelle fonction `resolveDroneIntegrityLoss`

```js
// tokenId passé en paramètre (drone_sheet n'a pas de colonne token_id — résolu PD8)
async function resolveDroneIntegrityLoss(io, campaignId, characterId, tokenId, droneSheet, degatsNets) {
  const damages = { ...droneSheet.damages }  // PD4 — copier avant mutation

  let severity = null
  if      (degatsNets >= 30) severity = 'detruit'
  else if (degatsNets >= 25) severity = 'mortelle'
  else if (degatsNets >= 20) severity = 'critique'
  else if (degatsNets >= 15) severity = 'grave'
  else if (degatsNets >= 10) severity = 'moyenne'
  else if (degatsNets >=  5) severity = 'legere'

  if (severity && severity !== 'detruit' && Array.isArray(damages[severity])) {
    const idx = damages[severity].indexOf(false)
    if (idx !== -1) {
      damages[severity] = [...damages[severity]]
      damages[severity][idx] = true
    }
    // TODO B4 overflow — si idx === -1 (toutes cases pleines pour ce niveau),
    // déborder vers la gravité suivante (comportement à confirmer LdB)
  }
  // Note : si severity === null (degatsNets < 5), aucune case cochée mais integrite -= 1 quand même.
  // Décalage visible dans DroneWindow (B4/B5) — comportement V1 acceptable.

  // LdB : 1 case de blessure = 1 point d'intégrité. 1 hit = 1 case.
  // 'detruit' (degatsNets ≥ 30) → destruction immédiate
  const newIntegrite = severity === 'detruit' ? 0 : Math.max(0, droneSheet.integrite_actuelle - 1)
  const detruit = newIntegrite <= 0

  if (detruit) damages.detruit = true  // mettre à jour le JSONB avant l'UPDATE

  await db('drone_sheet').where({ character_id: characterId }).update({
    damages: JSON.stringify(damages),
    integrite_actuelle: newIntegrite,
  })

  if (detruit) {
    // Retrait du roster uniquement — token reste sur carte comme épave (suppression manuelle GM)
    await db('combat_roster').where({ campaign_id: campaignId, token_id: tokenId }).delete()
  }

  io.to(campaignId).emit(WS.DRONE_INTEGRITY_UPDATED, {
    characterId,
    integrite_actuelle: newIntegrite,
    damages,
    detruit,
  })
}
```

### shared/events.js

```js
DRONE_INTEGRITY_UPDATED: 'drone:integrity_updated',
```

⚠️ Confirmé absent de `shared/events.js` (Session 88) — à ajouter avant Sprint 2b.

**Smoke test A (PNJ→drone) :** PNJ attaque drone → auto-résolution dans `resolveAssaultAction` → intégrité décrémentée → `DRONE_INTEGRITY_UPDATED` broadcast.
**Smoke test B (PJ→drone) :** PJ attaque drone → `COMBAT_DAMAGE_PROMPT` → joueur lance les dés → `COMBAT_DAMAGE_CONFIRM` → intégrité décrémentée → `DRONE_INTEGRITY_UPDATED` broadcast.
Dans les deux cas : `DroneWindow.jsx` reçoit l'événement et met à jour l'affichage.

⚠️ `DroneWindow.jsx` doit s'abonner à `DRONE_INTEGRITY_UPDATED` pour la mise à jour temps réel (PD5).

---

## Sprint Drones 2c — Déclaration GM pour drone (client)

**Scope :** le GM sélectionne une arme du drone et une cible. Le tir est résolu via `programme_armement.level`.

### CombatGmDeclareWindow.jsx

Le sélecteur d'arme actuel lit `char_inventory`. Bifurcation sur `character.type === 'drone'` :

```js
// Données nécessaires pour drone (déjà disponibles — Sprint 1) :
// GET /api/char-sheet/:charId/drone/weapons → droneWeapons
// GET /api/char-sheet/:charId/drone → dronePrograms (via drone.programs)

// Payload COMBAT_ACTION_DECLARE pour drone :
{
  tokenId,
  state: { position: 'standing', weapon: 'drawn', fire_mode: 'cc', cover: 'exposed', vitesse: 'normal' },
  // state_* ignorés côté serveur pour les drones (isDrone → iniDelta = 0)
  mapActions: {
    move: null,
    attack: null,
    droneWeaponInvId: selectedDroneWeaponId,  // nouveau champ
    targetTokenId,
    melee: false,
    multi: false,
  },
  quick: { observer: 0, reperer: 0, phrase: false },
}
```

Le serveur lit `mapActions.droneWeaponInvId` → stocke dans `combat_actions.drone_weapon_inv_id`.

⚠️ **SIM-A7 — COMBAT_ACTION_DECLARE handler (~ligne 1815)** : le handler existant ne connaît pas `droneWeaponInvId`. Ajouter dans la section INSERT de `combat_actions` :
```js
drone_weapon_inv_id: mapActions?.droneWeaponInvId ?? null,
```
Guard XOR déjà garanti en DB (migration 76) — pas de vérification applicative requise.

### server/src/socket/index.js — resolveDroneAssaultAction (attaquant drone)

```js
async function resolveAssaultAction(...) {
  if (character.type === 'drone') {
    return resolveDroneAssaultAction(io, socket, campaignId, action, confirmedModifiers, character)
  }
  // Path humanoïde inchangé...
}

async function resolveDroneAssaultAction(...) {
  // [1] Arme via drone_weapon_inv_id → drone_weapons (champs libres : damage_formula, fire_mode)
  // [2] Programme armement → drone_programs WHERE character_id
  //       AND category = (weapon.fire_mode === 'cc') ? 'armement_contact' : 'armement_distance'
  //       ORDER BY level DESC LIMIT 1
  //     skillTotal = program?.level ?? 0
  //     Si mode télépiloté : skillTotal = min(program.level, TELEPILOTAGE_proprio)
  // [3] Modificateurs confirmedModifiers identiques humanoïdes
  //     chancesDeReussite = skillTotal + totalModComp
  //     (pas de isRushedMod — drones ne peuvent pas se précipiter)
  //     (pas de effectiveMalus ni carenceArmure)
  // [4] Roll 1d20 → broadcast DICE_RESULT (même format)
  // [5] Si raté → return (TODO B6 — ammo_restant hors scope V1)
  // [6] Si touché → branche sur type de la CIBLE (humanoïde ou drone)
}
```

### CombatModifiersWindow.jsx — pré-sélection taille cible drone

```js
// Quand assaultAction.target_token_id change et que cible est un drone :
// fetcher drone_sheet.taille → getTailleCible(taille) → pré-sélectionner
// L'utilisateur peut overrider
```

**Smoke test :** GM déclare attaque pour drone → programme armement comme skill → COMBAT_ATTACK_RESULT.

---

## Sprint Drones 2d — Séquence autonome (auto-announcement)

**Scope :** en mode autonome, le serveur auto-valide la déclaration du drone et exécute la séquence Détection → Ami/Ennemi → Armement sans intervention GM.

### Migration 76b — `acquired_target_token_id` sur `combat_roster`

```sql
ALTER TABLE combat_roster
  ADD COLUMN acquired_target_token_id UUID REFERENCES tokens(id) ON DELETE SET NULL;
```

`ON DELETE SET NULL` : si le token cible est retiré (mort, fin de combat), la cible est automatiquement désacquise — aucun code supplémentaire requis.

### Phase ANNOUNCEMENT

**En fin de phase ANNOUNCEMENT** (pas au début), le serveur scanne les drones du roster :
- `character.type = 'drone'` ET `has_announced = false` → auto-valide (`has_announced = true`) ET insère un row `combat_actions`
- Pas de filtre `state_control_mode` — tous les drones sont autonomes par défaut avant Sprint 3. Le filtre sera ajouté lors de la création de la colonne en Sprint 3.
- Si le GM a déjà déclaré manuellement pour ce drone → pas d'auto-déclaration

```js
// En fin d'ANNOUNCEMENT (après que tous les joueurs ont pu déclarer) :
// JOIN nécessaire — combat_roster n'a pas de character_type (V18)
const autonomousDrones = await db('combat_roster as r')
  .join('tokens as t', 't.id', 'r.token_id')
  .join('characters as c', 'c.id', 't.character_id')
  .where({ 'r.campaign_id': campaignId, 'r.has_announced': false, 'r.status': 'active' })
  .where('c.type', 'drone')
  .select('r.*', 'c.id as character_id')
// Pas de filtre state_control_mode — Sprint 3 ajoutera la colonne + le filtre

for (const drone of autonomousDrones) {
  await db('combat_roster').where({ id: drone.id }).update({ has_announced: true })
  await db('combat_actions').insert({
    campaign_id: campaignId,          // NOT NULL — requis (SIM-B4)
    token_id: drone.token_id,         // FK → tokens.id (pas roster_id — V11)
    action_key: 'drone_auto',
    sequence: 3,                      // assaut, sans déplacement préalable (V19)
    target_token_id: drone.acquired_target_token_id ?? null,
  })
}
// ⚠️ Broadcaster COMBAT_ACTION_DECLARED pour chaque drone auto-annoncé
//    afin que la timeline client se mette à jour (SIM-A5) :
// io.to(campaignId).emit(WS.COMBAT_ACTION_DECLARED, { tokenId: drone.token_id, ... })
```

### Phase RESOLUTION — séquence autonome à INI 12

Quand le slot INI 12 est traité et que l'action est `action_key = 'drone_auto'` :

**Cas A — pas de cible acquise (`acquired_target_token_id = null`) :**
```
INI 12 → Test Détection → [succès] → Test Ami/Ennemi → [succès] → Test Armement → tir
                        → [échec]  → INI 7 → re-Test Détection → [succès] → Test Ami/Ennemi → ...
                                            → [échec]          → INI 2 → re-Test Détection → ...
```

**Cas B — cible déjà acquise :**
```
INI 12 → Test Armement → tir
```

**Mécanisme Option rows (SIM-A6) :** les retries INI 7 et INI 2 ne sont pas pré-insérés. Ils sont insérés **dynamiquement** lors du traitement du slot courant si la Détection échoue. Les retries se traitent **dans le même slot de résolution** que l'action initiale (sous-séquences dans le tour INI 12 du drone), pas dans des slots INI séparés. INI 7 et INI 2 sont les noms de sous-étapes, pas de vrais slots roster.

⚠️ **Ambiguïté à résoudre au moment de l'implémentation** : comment `advanceSlot` sait-il qu'un row `drone_auto_retry` appartient au slot INI 12 et pas au slot INI 7 réel ? Options :
- **Option a** (recommandée) : les retries sont traités en cascade dans `resolveDroneAutoAction` — pas de rows supplémentaires en DB, la boucle Détection→Ami/Ennemi→Armement se fait en mémoire avec 3 passes max.
- **Option b** : rows supplémentaires avec `sequence = 4` (retry INI 7) et `sequence = 5` (retry INI 2), traités quand `advanceSlot` traite le token à INI 12 (tous les rows `combat_actions` pour ce token dans cet ordre).
- **Option c** : colonne `scheduled_ini INTEGER` sur `combat_actions` pour déclencher au bon slot — schema change requis.

```js
// Squelette Option a (recommandée — pas de rows supplémentaires) :
async function resolveDroneAutoAction(io, campaignId, action) {
  // ...
  // Cas A — pas de cible acquise : jusqu'à 3 tentatives (INI 12, 7, 2)
  const retryINIs = [12, 7, 2]
  for (const retryINI of retryINIs) {
    const detectionOk = await rollTest(/* programme Détection */)
    io.to(campaignId).emit(WS.DICE_RESULT, { label: `Détection INI ${retryINI}`, ... })
    if (!detectionOk) continue  // échec → prochaine tentative
    const amiEnnemyOk = await rollTest(/* programme Ami/Ennemi */)
    io.to(campaignId).emit(WS.DICE_RESULT, { label: `Ami/Ennemi INI ${retryINI}`, ... })
    if (!amiEnnemyOk) continue
    // Cible acquise → UPDATE acquired_target_token_id → passer à l'Armement
    await executeArmement(io, campaignId, action, droneSheet)
    return
  }
  // 3 échecs → drone ne tire pas ce tour
}
```

Chaque appel `rollTest` émet un `DICE_RESULT` broadcast pour la timeline client.

**Mise à jour `acquired_target_token_id` :** après succès Détection → `UPDATE combat_roster SET acquired_target_token_id = tokenId WHERE id = droneRosterId`.
**Perte de cible :** GM marque manuellement (met `acquired_target_token_id = null`) → retour Cas A tour suivant.

---

## Sprint Drones 3 — Télépilotage

**Scope :** lien drone → propriétaire, `state_control_mode` persistant, action "Télépiloter", compétence limitative TELEPILOTAGE.

### Migration 77 — lien drone → propriétaire

```sql
ALTER TABLE drone_sheet
  ADD COLUMN owner_character_id UUID REFERENCES characters(id) ON DELETE SET NULL;
```

Nullable : un drone sans propriétaire est GM-contrôlé. Lien optionnel.

### Migration 77b — `state_control_mode` sur `combat_roster`

```sql
ALTER TABLE combat_roster
  ADD COLUMN state_control_mode TEXT NOT NULL DEFAULT 'autonome',
  ADD CONSTRAINT chk_state_control_mode
    CHECK (state_control_mode IN ('autonome', 'telepilote'));
```

`DEFAULT 'autonome'` : tous les drones existants restent autonomes après la migration. Sprint 2d ne filtre pas sur cette colonne — ajouter le filtre uniquement après cette migration.

### `state_control_mode` — état persistant sur la ligne drone

**Champ :** `combat_roster.state_control_mode TEXT NOT NULL DEFAULT 'autonome'` — `'autonome'` | `'telepilote'`

**Phase Roster :** la fenêtre d'état initial (existante pour les humanoïdes) inclut une ligne drone pour les joueurs propriétaires de drones : "Mode initial : Autonome / Télépiloté". Défaut = `'autonome'`.

**Phase ANNOUNCEMENT — action "Télépiloter" (Option C) :** le character propriétaire déclare "Télépiloter" via `COMBAT_ACTION_DECLARE`. Son `combat_actions` reçoit `drone_weapon_inv_id` (sans `weapon_inv_id`). Simultanément :

- Le drone dans `combat_roster` → `has_announced = true, status = 'done'` (pas de slot propre ce round)
- `state_control_mode = 'telepilote'` mis à jour sur le roster du drone
- Le propriétaire agit pour le drone à son propre INI dans la timeline de résolution

Enforcement structurel : `has_announced = true` bloque toute nouvelle déclaration du propriétaire ce round (guard COMBAT_ACTION_DECLARE ~ligne 1826). Le drone simultanément marqué `status = 'done'` ne peut plus agir de son côté.

**Mode persistant :** `state_control_mode = 'telepilote'` sur `combat_roster` persiste d'un tour à l'autre (pas de reset automatique). Toggle retour = UPDATE `state_control_mode = 'autonome'`.

**Drone non assigné (`owner_character_id = null`) :** le GM gère le toggle depuis `CombatGmDeclareWindow`.

### Compétence d'attaque en mode télépiloté (LdB p.319)

```
skillTotal = min(programme_armement_drone.level, TELEPILOTAGE_proprio)
```

- Le **programme du drone** reste la base (le drone doit avoir le programme)
- `TELEPILOTAGE` du character propriétaire est le **plafond** (compétence limitative)
- Le character ne contribue pas avec sa propre compétence d'arme

Fetch : `drone_programs WHERE character_id = drone.id AND category IN ('armement_distance', 'armement_contact')` + `char_sheet + ref_skills WHERE character_id = proprio.id AND skill_key = 'TELEPILOTAGE'`.

### Mode télépiloté — séquence (Option C)

- Pas de Détection, pas d'Ami/Ennemi — le propriétaire désigne sa cible directement
- INI = INI du character propriétaire (son slot dans la timeline)
- Le character **consomme son tour** : `has_announced = true` dès la déclaration "Télépiloter"
- Le drone n'apparaît pas dans la timeline de résolution ce round (`status = 'done'`)
- Résolution : `advanceSlot` lit `combat_actions.drone_weapon_inv_id` → path télépilotage → `skillTotal = min(program.level, TELEPILOTAGE_proprio)`
- Déplacement du drone : move action séparé déclaré par le propriétaire (standard)

### Interception — autonome uniquement

En mode télépiloté, le programme `interception` n'est pas actif — l'ordinateur n'exécute pas de comportements réactifs automatiques.

---

## Ce qui NE change PAS (humanoid path)

| Composant | Inchangé |
|---|---|
| `resolveMeleeAction` | Pas de CaC drone autonome — uniquement télépiloté (Sprint 3) |
| `resolveWoundInsertion` | Humanoïdes uniquement |
| `calcSkillTotal`, `calcWoundPenalty`, `calcEncumbrancePenalty` | Fonctions pures — non touchées |
| `COMBAT_DAMAGE_PROMPT` / `CombatDamageWindow` | PJ — déclenchement uniquement, humanoïdes et cibles drone |
| `COMBAT_DAMAGE_CONFIRM` | Sprint 2b ajoute branche `cible.type === 'drone'` — path humanoïde inchangé |
| `COMBAT_MELEE_DEFENSE_PROMPT` / `COMBAT_MELEE_DEFENSE_CONFIRM` | CaC humanoïde uniquement |
| `LOC_TABLE` et localisation D20 | Humanoïdes uniquement |
| `character_wounds` | Humanoïdes uniquement |
| Toutes les colonnes `state_*` combat_roster | Ignorées pour les drones, pas supprimées |
| `pendingDamageActions` Map | PJ humanoïde uniquement |

---

## Matrice de régression

| Scénario | Vérifier |
|---|---|
| PJ humanoïde attaque PNJ humanoïde | Zéro delta — path inchangé |
| PNJ humanoïde attaque PJ humanoïde | Zéro delta |
| Drone dans COMBAT_START | `base_initiative = 12`, `char_sheet` non fetchée |
| GM déclare pour drone | `combat_actions.drone_weapon_inv_id` non null, `weapon_inv_id` null |
| Drone attaque PNJ humanoïde | Skill = programme armement, localisation D20, wound insertion normale |
| Drone attaque PJ humanoïde | `COMBAT_DAMAGE_PROMPT` PJ normalement |
| PNJ attaque drone | Localisation fixe, blindage, `resolveDroneIntegrityLoss` |
| PJ attaque drone | `COMBAT_DAMAGE_PROMPT` → `COMBAT_DAMAGE_CONFIRM` → `resolveDroneIntegrityLoss` |
| Drone détruit (`integrite <= 0`) | Retrait roster, `DRONE_INTEGRITY_UPDATED { detruit: true }` |
| Multi-adversaires melee | `atkEnemyType` correct pour drone (`type === 'drone'` → target `'pj'`) |

---

## Points de vigilance spécifiques drones

**PD1 — `char_sheet` absent pour `type='drone'`**
`COMBAT_START` fetchait `char_sheet` pour tout token avec `character_id`. Un drone n'a pas de `char_sheet`. Le `continue` après détection du type drone évite l'erreur.

**PD2 — Guard ligne ~3443 bloque `drone_auto` avant résolution**
Guard actuel : `if (!action.weapon_inv_id || !action.target_token_id) return`
Un `drone_auto` a `weapon_inv_id = null` ET `target_token_id = null` (Cas A sans cible) → double vrai → return silencieux.
Fix : dériver `drone_auto` **avant** ce guard, pas modifier le guard :
```js
if (action.action_key === 'drone_auto') {
  await resolveDroneAutoAction(io, campaignId, action)
  return
}
if (!action.weapon_inv_id || !action.target_token_id) return  // inchangé
```
`resolveDroneAutoAction` gère le cas sans cible (Détection) en interne.

**PD3 — `calcDroneRD` : input = `integrite × 2`, pas des NA**
Ne pas appeler `calcResistanceDommages(integrite, 0)` — la sémantique est différente (for_na + con_na vs. valeur directe). Lire `RD_TABLE` directement avec `integrite × 2` comme clé.

**PD4 — `damages` JSONB : toujours copier avant mutation**
```js
const damages = { ...droneSheet.damages }
// Mutation sur damages uniquement, pas sur droneSheet.damages directement
```

**PD5 — `DroneWindow.jsx` doit écouter `DRONE_INTEGRITY_UPDATED`**
Sans cet abonnement, la fiche drone n'est pas mise à jour en temps réel pendant le combat.

**PD6 — `state_control_mode` : état persistant sur la ligne DRONE, pas per-turn**
Le mode est stocké sur `combat_roster` de la ligne drone. Il persiste d'un tour à l'autre. Pas de reset automatique en début de tour. Changement uniquement via l'action "Télépiloter" du character propriétaire en ANNOUNCEMENT. Ne pas stocker sur la ligne du propriétaire.

**PD7 — Télépilotage : TELEPILOTAGE est plafond sur le PROGRAMME DU DRONE, pas compétence d'arme**
`skillTotal = min(programme_armement_drone.level, TELEPILOTAGE_proprio)` — le programme du drone reste la base. `TELEPILOTAGE` du character est le plafond (compétence limitative, LdB p.319). Ne pas utiliser la compétence d'arme du pilote. Toujours lire `drone_programs` pour le niveau de base.

**PD8 — `resolveDroneIntegrityLoss` : token_id requis pour suppression roster** ✅ RÉSOLU
`drone_sheet` n'a pas de colonne `token_id` (confirmé migrations 71-73). Solution retenue : passer `tokenId` en paramètre supplémentaire. `token_id` est toujours disponible dans le contexte appelant (token déjà fetchée pour vérifier `character.type`). Signature : `resolveDroneIntegrityLoss(io, campaignId, characterId, tokenId, droneSheet, degatsNets)`.

**PD9 — Catégories programmes : migration 73 a seedé `category='armement'` (34 programmes)**
La migration qui split en `armement_distance` / `armement_contact` est requise avant Sprint 2c. Sans elle, le fetch `WHERE category = 'armement_distance'` retourne 0 résultat pour tous les drones.

---

## Migration 76c — Reconciliation schéma `drone_weapons` (SIM-B1)

⚠️ **Problème :** Migration 71 a créé `drone_weapons` avec le schéma Sprint 1 (lié à `ref_equipment`, champs catalogue). Option A (champs libres) est incompatible avec ce schéma existant.

**Schéma actuel migration 71 :**
- `equipment_id UUID NOT NULL FK` (NOT NULL — incompatible Option A)
- `contenance_chargeur INTEGER NOT NULL DEFAULT 0`
- `ammo_restant INTEGER`
- `sort_order SMALLINT`
- `label_override TEXT`
- Pas de `character_id`, `name`, `damage_formula`, `portee`, `fire_mode`

**Migration 76c — `76c_drone_weapons_option_a.js` :**
```sql
ALTER TABLE drone_weapons
  ADD COLUMN character_id  UUID REFERENCES characters(id) ON DELETE CASCADE,
  ADD COLUMN name          TEXT,
  ADD COLUMN damage_formula TEXT,
  ADD COLUMN portee        TEXT,
  ADD COLUMN fire_mode     TEXT NOT NULL DEFAULT 'rc' CHECK (fire_mode IN ('cc', 'rc', 'rl')),
  ADD COLUMN notes         TEXT,
  ALTER COLUMN equipment_id DROP NOT NULL;

-- Backfill character_id depuis char_inventory (armes associées à un character)
-- Si rows existants : requiert UPDATE manuel ou script de migration de données
-- En V1 : table vide en pratique → backfill non requis
```

Colonnes migration 71 conservées (rétrocompatibilité) : `contenance_chargeur`, `ammo_restant` (sera utilisé en B6), `sort_order`, `label_override`. La migration 76c les laisse en place.

---

## drone_weapons — Schéma retenu (Option A)

Champs libres sans référence `ref_equipment`. Le GM ou le propriétaire saisit les stats manuellement.

```sql
CREATE TABLE drone_weapons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id  UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  equipment_id  UUID REFERENCES ref_equipment(id) ON DELETE SET NULL,  -- nullable, arme standard optionnelle
  name          TEXT NOT NULL,
  damage_formula TEXT NOT NULL,   -- format libre : "2d6+3", "3d6"
  portee        TEXT,             -- format libre : "10/20/40/80 (160)"
  fire_mode     TEXT NOT NULL DEFAULT 'rc' CHECK (fire_mode IN ('cc', 'rc', 'rl')),
  notes         TEXT
);
```

- `equipment_id` nullable : permet de référencer une arme standard existante OU de créer une arme custom (equipment_id = null)
- `fire_mode` : `cc` = corps à corps, `rc` = rafale courte, `rl` = rafale longue
- `damage_formula` / `portee` : TEXT libre pour couvrir tous les formats Polaris sans contrainte de schéma

---

## TODO — Recherche et sprints futurs

**B3 — flag `is_drone_pnj`**
Différencier les drones PNJ (GM) des drones PJ. Ajouter colonne `is_drone_pnj BOOLEAN DEFAULT false` sur `drone_sheet` ou `characters`. Sprint dédié.

**B4 — overflow cases `damages` JSONB** *(formule de base résolue — V3)*
Formule de décrémentation résolue (V3 — LdB p.82-88 : 1 hit = 1 case = `integrite -= 1`). Point ouvert : si `damages[severity].indexOf(false) === -1` (toutes les cases pleines pour ce niveau de gravité), doit-on déborder vers la gravité suivante ? Comportement V1 : case non cochée, `integrite` décrémentée quand même (décalage acceptable en fin de vie). Sprint dédié pour normaliser.

**B5 — overflow JSONB `damages`**
Si une case est déjà cochée et qu'un nouveau dommage tombe dans le même seuil, risque d'overflow. Définir le comportement : cascade vers seuil suivant ? Refus ? Recherche + sprint dédié. *(Voir aussi B4 pour le cas lié à integrite_actuelle.)*

**B6 — `ammo_restant` sur `drone_weapons`**
LdB : armes drone ont des munitions (ex: lance dard 70 munitions). Hors scope V1. Ajout requis : colonne `ammo_remaining INTEGER` nullable sur `drone_weapons` + décrémentation dans `resolveDroneAssaultAction` si applicable.

**C1 — Migration split catégories programmes** *(décisions validées Session 88)*
Migration 73 a seedé des programmes avec `category='armement'`. Décisions de migration confirmées :

| Programme | Action | Nouvelle catégorie |
|---|---|---|
| **Tir** | UPDATE | `armement_distance` |
| **Bombardement** | UPDATE | `armement_distance` |
| **Attaque** | UPDATE | `armement_contact` |
| **Contre-attaque** | Inchangé | `contre_attaque` (déjà correct, cyber) |
| **Contrôle armement** | DELETE | — (supprimé) |

```sql
-- Migration 76d — split catégories programmes drones
UPDATE drone_programs SET category = 'armement_distance' WHERE name IN ('Tir', 'Bombardement');
UPDATE drone_programs SET category = 'armement_contact'  WHERE name = 'Attaque';
DELETE FROM drone_programs WHERE name = 'Contrôle armement';
```
Requis **avant Sprint 2c** — sans cette migration, fetch `WHERE category = 'armement_distance'` retourne 0.
