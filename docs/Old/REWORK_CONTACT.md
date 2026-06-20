# REWORK_CONTACT.md — Sprint CaC : plan de travail
> Créé Session 92bis — 2026-06-12
> Source : analyse code Session 92bis + MANUELSYSCOMBAT.md §6.2

---

## 1. Bugfixes obligatoires (bloquants)

### B1 — Compétence défenseur hardcodée `COMBAT_A_MAINS_NUES`

**Fichier :** `server/src/socket/index.js` — `resolveMeleeAction` ligne ~3318

**Problème :** le défenseur utilise toujours `COMBAT_A_MAINS_NUES` même s'il a une arme de contact équipée (slot MG/MD/2M, category='Arme de contact'). Un défenseur avec une épée (`COMBAT_ARME`) se défend avec la mauvaise compétence.

**Fix :** même pattern que l'attaquant — si l'arme équipée a un `ref_equipment_skill_assoc`, utiliser ce skill_id pour le défenseur. Sinon fallback `COMBAT_A_MAINS_NUES`.

```js
// Pattern à réutiliser (déjà dans resolveMeleeAction pour l'attaquant) :
// weapon_inv_id → char_inventory.equipment_id → ref_equipment_skill_assoc WHERE item_id = equipment_id → skill_id
```

**Note :** le défenseur n'a pas forcément sa "meilleure arme" en main. Utiliser l'arme équipée en slot prioritaire (MG ou MD, en cas de double arme : la première trouvée).

---

### B2 — Guard Charge distance minimum manquant (PC-CaC7)

**Fichier :** `server/src/socket/index.js` — `resolveMeleeAction` juste après la validation distance

**Problème :** une Charge déclarée alors que l'attaquant est déjà à ≤ 3m de sa cible est valide côté serveur. La règle LdB exige un élan depuis > 3m.

**Fix :** après le calcul `dist2dChk`, ajouter :
```js
const rosterAtk = await db('combat_roster').where({ campaign_id: campaignId, token_id: action.token_id }).first()
if ((rosterAtk?.state_combat_mode === 'charge') && dist2dChk <= 3) {
  socket.emit(WS.COMBAT_DECLARE_ERROR, { message: 'Charge impossible — déjà engagé au contact (≤ 3m)' })
  return false
}
```

---

### B3 — DC3 — `bout_portant` +5 illégitime sur `armement_contact` drone

**Fichier :** `server/src/socket/index.js` — `resolveDroneAssaultAction` ligne ~3732

**Problème :** `PORTEE_MOD_COMP['bout_portant']` = +5 appliqué à tort pour `armement_contact`. Contact physique = portée satisfaite par définition, modificateur = 0.

**Fix — 1 seule ligne (ligne 3732 uniquement) :**
```js
// Avant (bug) :
const portee = (category === 'armement_contact') ? 'bout_portant' : (confirmedModifiers?.portee ?? 'courte')
let totalModComp = PORTEE_MOD_COMP[portee] ?? 0

// Après (1 ligne changée — ligne 3732 uniquement) :
const portee = category !== 'armement_contact' ? (confirmedModifiers?.portee ?? 'courte') : null
let totalModComp = PORTEE_MOD_COMP[portee] ?? 0   // inchangé : PORTEE_MOD_COMP[null] ?? 0 = 0 ✅
```
`porteeModDrone` (ligne 3752) = `PORTEE_MOD_COMP[null] ?? 0 = 0` → condition `porteeModDrone !== 0` → faux → `PORTEE_LABELS[null]` jamais évalué.
**Lignes 3733 et 3752 : inchangées.**

---

### B4 — DC1 — Flow drone CaC incorrect (`armement_contact`)

**Fichier :** `client/src/components/CombatOverlay.jsx` + `server/src/socket/index.js` — `resolveDroneAssaultAction`

**Problème :** un drone déclarant `armement_contact` déclenche `CombatModifiersWindow` (fenêtre portée distance) au lieu d'un flow adapté. §7.4 : test simple D20 ≤ niveau programme, pas de test d'opposition, pas de fenêtre portée.

**Fix client :** `isDroneCaC = activeAssaultAction?.fire_mode === 'cc' && character.type === 'drone'`. Afficher "Agir" direct (pas de modifier portée). Afficher la fenêtre mods CaC drone (couverture, obscurité, taille — pas de portée, pas de situation attaquant).

**Fix serveur :** `resolveDroneAssaultAction` branche `armement_contact` → test simple uniquement, pas d'opposition, portée = 0 (voir B3), situation mods = taille + couverture + obscurité uniquement.

---

### B5 — DC2 — Mods de situation drone jamais appliqués

**Fichier :** `server/src/socket/index.js` — `resolveDroneAssaultAction`

**Problème :** `confirmedModifiers.situation` est un tableau de clés, mais l'ancien code lisait des propriétés directes (`confirmedModifiers?.[k]`).

**Fix (déjà documenté, non validé) :**
```js
const situationMods = confirmedModifiers?.situation ?? []
totalModComp += situationMods.reduce((sum, k) => sum + (SITUATION_MODS[k] ?? 0), 0)
```

---

### B6 — Bug Loc-Drone — jet D20 localisation incorrect pour cible drone

**Fichier :** `server/src/socket/index.js` — `resolveDroneAssaultAction` branche `isDroneTarget`

**Problème :** jet D20 de localisation exécuté sur une cible drone. §7.6 : drone = une seule zone fixe `drone_sheet.localisation_ref`. Pas de D20.

**Fix :** remplacer le jet D20 par lecture directe `drone_sheet.localisation_ref` :
```js
const droneSheet = await db('drone_sheet').where({ character_id: targetCharacter.id }).first()
const localisation = droneSheet?.localisation_ref ?? 'corps'
// Pas de LOC_TABLE, pas de rollLoc
```

---

### B7 — Bug Dmg-Drone — dégâts non enregistrés sur drone cible

> ⚠️ **CODE CI-DESSOUS OBSOLÈTE** — voir `CORR-B7` dans l'AUDIT POST-CODE. Ne pas implémenter ce bloc. Utiliser `calcDroneRD(integrite)` + `resolveDroneIntegrityLoss(...)` qui existent déjà dans le fichier.

**Fichier :** `server/src/socket/index.js` — `resolveDroneAssaultAction` branche `isDroneTarget`

**Problème :** aucune modification de `integrite_actuelle` ni de `drone_sheet.damages` après un tir réussi sur un drone.

**Fix — formule §7.6 :**
```js
const blindage = droneSheet.blindage ?? 0
const rdInput  = (droneSheet.integrite_actuelle ?? 1) * 2  // → table RD_TABLE
const rd       = calcResistanceDommages_fromValue(rdInput)  // fonction à créer ou adapter
const degatsNets = Math.max(0, degautsBruts - blindage - rd)

// Enregistrement :
const newDamages = { ...(droneSheet.damages ?? {}), [localisation]: (droneSheet.damages?.[localisation] ?? 0) + degatsNets }
const newIntegrite = Math.max(0, droneSheet.integrite_actuelle - degatsNets)
await db('drone_sheet').where({ character_id: targetCharacter.id }).update({
  integrite_actuelle: newIntegrite,
  damages: JSON.stringify(newDamages),
})
// Broadcast DRONE_SHEET_UPDATED → room
// Si integrite_actuelle <= 0 → retrait roster + broadcast DRONE_DESTROYED
```

**Note :** pas de `character_wounds`, pas de Test de Choc pour les drones.

---

## 2. Validations fonctionnelles (jamais testées)

| Test | Chemin | Bloquant |
|---|---|---|
| CaC PJ attaque PNJ | ANNOUNCE → CONFIRM → `resolveMeleeAction` branche PNJ auto | ✅ Critique |
| CaC PNJ attaque PJ | ANNOUNCE → CONFIRM → DEFENSE_PROMPT → DEFENSE_CONFIRM (branche PNJ dmg) | ✅ Critique |
| CaC PJ attaque PJ | ANNOUNCE → CONFIRM → DEFENSE_PROMPT → DEFENSE_CONFIRM → DAMAGE_PROMPT → DAMAGE_CONFIRM | ✅ Critique |
| Multi-attaque CaC 4b | `meleeCount=2`, deux cibles, `remainingMeleeActions` | Haute |
| Charge → élan + bonus | mode='charge', dist > 3m, déplacement court gratuit, +3 att +3 dmg | Haute |
| Mode défensif/retraite PJ | bonus défense +3/+5 dans DEFENSE_CONFIRM | Haute |
| B2 guard Charge | dist ≤ 3m + mode='charge' → DECLARE_ERROR | Haute |

---

## 3. Nouvelle fonctionnalité — Fenêtre modificateurs de situation CaC

### Principe

Modèle : `CombatModifiersWindow.jsx` — sections COUVERTURE et OBSCURITÉ + section SITUATION CaC.

**Qui voit la fenêtre :**
- PJ attaquant CaC → le joueur voit sa propre fenêtre (même modèle que le tir)
- PNJ attaquant CaC → le GM voit la fenêtre
- Drone CaC → GM voit une fenêtre réduite (taille + obscurité + couverture, pas de situation attaquant)

**Quand :** Phase RESOLUTION, slot actif = melee action (même timing que CombatModifiersWindow ranged).

**Flow :** identique au tir distance — le bouton "Agir" ouvre/met en avant la fenêtre, "Lancer les dés" émet `COMBAT_ACTION_CONFIRM` avec `confirmedModifiers` CaC.

---

### Modificateurs applicables au CaC (§6.2)

#### Section SITUATION (nouveau — spécifique CaC)

| Key | Label | Mod |
|---|---|---|
| `cac_attaquant_cote` | Attaque par le côté | −3 |
| `cac_attaquant_au_sol` | Attaquant au sol | −5 |
| `cac_espace_confine` | Espace confiné | −3 |
| `cac_espace_tres_confine` | Espace très confiné | −5 |
| `cac_position_avantageuse` | Position avantageuse (surélevé) | +3 |
| `cac_main_non_directrice` | Main non directrice | −5 |
| `cac_terrain_instable` | Terrain instable | *(compétence limitative — voir §CORR-TERRAIN)* |

**`cac_terrain_instable` — compétence limitative** (LdB §6.2 "limite par Acrobatie/Équilibre") :
Ce n'est PAS un modificateur fixe. Le skill effectif de l'attaquant = `min(skillCombat, skillAcrobatie)`.
Implémentation serveur : si `cac_terrain_instable` coché → fetch `ACROBATIE_EQUILIBRE` → `Math.min(0, acrobatieTotal - attackerSkillTotal)`.
Voir CORR-TERRAIN_INSTABLE dans l'audit post-code.

#### Section COUVERTURE (réutilisée depuis le tir — applicable CaC)

| Key | Label | Mod |
|---|---|---|
| `couverture_partielle` | Couverture partielle (50%) | −3 |
| `couverture_importante` | Couverture importante (75%) | −5 |

#### Section OBSCURITÉ (réutilisée — applicable CaC)

| Key | Label | Mod |
|---|---|---|
| `obscurite_legere` | Obscurité légère | −3 |
| `obscurite_importante` | Obscurité importante | −5 |
| `obscurite_totale` | Obscurité totale (impossible) | −99 |

#### Section TAILLE CIBLE (réutilisée — applicable CaC)

Même table TAILLES que le tir distance.

---

### Payload `confirmedModifiers` CaC

```js
// Pas de `portee` (CaC = portée satisfaite)
confirmedModifiers: {
  situation: string[],   // keys situation + couverture + obscurite sélectionnées
  taille: string,        // 'minuscule'|'tres_petite'|'petite'|'moyenne'|'grande'|'tres_grande'|'enorme'|'gigantesque'
}
```

---

### Modifications serveur requises

**`resolveMeleeAction` — ajout des mods CaC :**
```js
// Recevoir confirmedModifiers depuis COMBAT_ACTION_CONFIRM (déjà passé)
const situationMods = (confirmedModifiers?.situation ?? []).filter(k => k !== 'cac_terrain_instable')
const situationModComp = situationMods.reduce((sum, k) => sum + (SITUATION_MODS[k] ?? 0), 0)
const tailleMod = TAILLE_MODS[confirmedModifiers?.taille ?? 'moyenne'] ?? 0

// Terrain instable — compétence limitative ACROBATIE_EQUILIBRE
let terrainInstableMod = 0
if (confirmedModifiers?.situation?.includes('cac_terrain_instable')) {
  const acrobatieRefSkill  = await db('ref_skills').where({ id: 'ACROBATIE_EQUILIBRE' }).first()
  const acrobatieCharSkill = await db('char_skills').where({ char_sheet_id: sheetAttaquant.id, skill_id: 'ACROBATIE_EQUILIBRE' }).first()
  const acrobatieTotal = acrobatieRefSkill
    ? calcSkillTotal(attrsAttaquant, acrobatieCharSkill, acrobatieRefSkill, genoAttaquant)
    : attackerSkillTotal  // ref_skill absent (impossible en pratique) → pas de malus
  terrainInstableMod = Math.min(0, acrobatieTotal - attackerSkillTotal)
}

// Intégrer dans chancesAttaque :
const chancesAttaque = ... + situationModComp + tailleMod + terrainInstableMod
```

`SITUATION_MODS` = objet existant (ligne ~91 index.js). Pas de nouvel objet. Les keys CaC portent le préfixe `cac_` pour éviter toute collision avec les keys ranged.

`hasCacImpossible` = `situation.includes('obscurite_totale')` → désactive "Lancer les dés".

---

### Composant — option A : nouveau composant `CombatCacModifiersWindow.jsx`

Composant autonome (~200 lignes), structure identique à `CombatModifiersWindow` mais :
- Sans section PORTÉE
- Sans section ALLURE tireur/cible
- Avec section SITUATION CaC (checkboxes)
- Avec section COUVERTURE (checkboxes — réutilisées)
- Avec section OBSCURITÉ (checkboxes — réutilisées)
- Avec section TAILLE (select — réutilisé)

Affiché dans `CombatOverlay` aux mêmes conditions que `CombatModifiersWindow` mais pour les melee actions.

### Composant — option B : généraliser `CombatModifiersWindow`

Ajouter un prop `mode: 'ranged' | 'melee'` et conditionner les sections selon le mode. Moins de duplication mais plus de complexité dans un composant déjà dense (~420 lignes).

**Recommandation : Option A** — nouveau composant isolé. `CombatModifiersWindow` est déjà complexe et les deux contextes ont des règles différentes. Le risque de régression sur le tir est nul.

---

### NOUVEAU-I18N — Clés `fr.json` à créer avant le composant

Observer les conventions de nommage dans `fr.json` + `CombatModifiersWindow.jsx` AVANT d'écrire (section `combat.modifiers.*` ? `combatModifiers.*` ? autre ?). Ne pas créer de section orpheline.

Libellés nécessaires :
- Section SITUATION attaquant : Attaque par le côté / Attaquant au sol / Espace confiné / Espace très confiné / Position avantageuse (surélevé) / Main non directrice / Terrain instable
- Section SITUATION défenseur : Terrain instable (seul item V1)
- Label dynamique terrain instable : doit inclure le score Acrobatie calculé — ex. `"Terrain instable (Acrobatie/Équilibre : 12)"`
- Titre de la fenêtre / bouton "Lancer les dés"

---

## 4. Fonctionnalités hors-scope Sprint CaC (dettes futures)

| Fonctionnalité | Règle | Sprint |
|---|---|---|
| Cible sans défense (surprised/stunned → test simple +5) | §6.2 | Sprint stunned_until_turn |
| Allonge bonus compétence serveur (`allonge_lui - allonge_adv`) | §6.2 | Sprint CaC v2 |
| Arts Martiaux (techniques offensives/défensives) | §6.9 | Sprint futur |
| Saisie/Lutte −3 INI | §6.6 | Sprint futur |

---

---

## AUDIT POST-CODE — Session 92bis (2026-06-12)

> Corrections et nouvelles zones identifiées après lecture du code source.
> Appender progressivement. Ne pas consolider avant fin de session.

---

### CORR-B1 — `hand_pref` + `sheetCible` déjà disponible

`char_sheet.hand_pref` — valeurs `'R'` (défaut) / `'L'` / `'A'` (ambidextre — migration 36 ligne 49).

Bonne nouvelle : `sheetCible` est **déjà fetchée** à la ligne 3308 avant le Promise.all défenseur.
`sheetCible.hand_pref` est donc disponible sans requête supplémentaire.

Slot priority :
- `hand_pref === 'L'` → MG en premier, puis MD, puis 2M
- Sinon (R ou A) → MD en premier, puis MG, puis 2M — `'A'` tombe dans le défaut, aucune gestion spéciale ✅
- Fallback aucun slot occupé avec arme de contact → `COMBAT_A_MAINS_NUES`

Architecture **3 rounds parallèles** (amélioration vs. plan original qui ajoutait 2 séquentielles avant le Promise.all) :

**Round 1 (parallèle) — intégrer `defContactWeapons` dans le Promise.all existant, retirer `charSkillDef`/`refSkillDef` :**
5 branches : `attrsCible`, `archetypeCible`, `woundsCible`, `invCible`, `defContactWeapons`

**JS (0 DB) — tri + détermination `defSkillId` :**
```js
const slotPriority = (sheetCible.hand_pref ?? 'R') === 'L' ? ['MG', 'MD', '2M'] : ['MD', 'MG', '2M']
const defWeapon = slotPriority.map(s => defContactWeapons.find(w => w.slot === s)).find(w => w != null) ?? null
let defSkillId = 'COMBAT_A_MAINS_NUES'
```

**Round 2 (séquentiel conditionnel) — seulement si `defWeapon` existe :**
```js
if (defWeapon?.equipment_id) {
  const assoc = await db('ref_equipment_skill_assoc').where({ item_id: defWeapon.equipment_id }).first()
  if (assoc) defSkillId = assoc.skill_id
}
```

**Round 3 (parallèle) — `charSkillDef`, `refSkillDef`, `genoCible` :**
```js
const [charSkillDef, refSkillDef, genoCible] = await Promise.all([
  db('char_skills').where({ char_sheet_id: sheetCible.id, skill_id: defSkillId }).first(),
  db('ref_skills').where({ id: defSkillId }).first(),
  archetypeCible?.genotype_id ? db('ref_genotypes').where({ id: archetypeCible.genotype_id }).first() : Promise.resolve(null),
])
```

3 rounds DB max (vs. 4 avec le plan initial). La variable `genoCible` rejoint le Round 3 (parallèle) au lieu d'être séquentielle post-Promise.all.

---

### CORR-B2 — `rosterAttaquant` déjà fetché ligne 3233

`rosterAttaquant` est fetché à la ligne 3233 (après le Promise.all, avant les calculs).
Le guard Charge s'insère à la **ligne 3234** — aucune requête supplémentaire.

```js
// Ligne 3234 — après rosterAttaquant
if (rosterAttaquant?.state_combat_mode === 'charge' && dist2dChk <= 3) {
  socket.emit(WS.COMBAT_DECLARE_ERROR, {
    message: 'Charge impossible — distance ≤ 3m (élan insuffisant)',
  })
  return false
}
```

`COMBAT_DECLARE_ERROR` confirmé correct : défini dans `shared/events.js` ligne 106, émis dans `resolveMeleeAction` ligne 3172 (hors portée), écouté dans `CombatActionWindow` et `CombatGmDeclareWindow`.

**`COMBAT_DECLARE_ERROR` en RESOLUTION confirmé** — listener dans `CombatActionWindow` lignes 222–231 : `useEffect([socket])` non scopé à une phase, actif durant toute la vie du composant ✅

---

### CORR-B7 — `calcDroneRD` et `resolveDroneIntegrityLoss` existent déjà

**`calcDroneRD(integrite)`** — ligne 4307 : `integrite × 2 → lookupTable(RD_TABLE, ...)`. Existe.
**`resolveDroneIntegrityLoss(io, campaignId, characterId, tokenId, droneSheet, degatsNets)`** — ligne 4314 : gère déjà `integrite_actuelle`, JSONB `damages`, broadcast, destruction. Existe.

**Signatures confirmées (lecture lignes 4307–4354) :**
- `calcDroneRD(integrite)` — un seul argument : la valeur numérique d'intégrité (pas le droneSheet entier) ✅
- `resolveDroneIntegrityLoss(io, campaignId, characterId, tokenId, droneSheet, degatsNets)` — signature du plan correcte ✅

**⚠️ Comportement critique de `resolveDroneIntegrityLoss` :** `degatsNets` détermine la SÉVÉRITÉ (paliers 5/10/15/20/25/30+) mais N'EST PAS soustrait directement à l'intégrité. L'intégrité diminue TOUJOURS de 1 par hit (LdB p.82 "1 hit = 1 case"). Exception : `degatsNets >= 30` → `severity = 'detruit'` → intégrité = 0. La fonction émet `WS.DRONE_INTEGRITY_UPDATED` avec `{ integrite_actuelle, damages, detruit }` — PAS un event `DRONE_DESTROYED` séparé.

Le code B7 dans la section §1 ci-dessus est **erroné** — il réimplémente ce qui existe.

Fix réel : appeler les fonctions existantes, même pattern que lignes 2404-2407 :
```js
const etqDrone  = droneSheet.blindage ?? 0
const rdDrone   = calcDroneRD(droneSheet.integrite_actuelle)
const degatsNetsDrone = Math.max(0, degautsBruts - etqDrone - rdDrone)
await resolveDroneIntegrityLoss(io, campaignId, cibleCharacter.id, targetTokenId, droneSheet, degatsNetsDrone)
```

---

### CORR-B5 — DC2 probablement déjà corrigé côté serveur

Ligne 3735-3736 dans `resolveDroneAssaultAction` :
```js
const situationMods = confirmedModifiers?.situation ?? []
totalModComp += situationMods.reduce((sum, k) => sum + (SITUATION_MODS[k] ?? 0), 0)
```

Le code lit déjà `confirmedModifiers.situation` comme tableau — pattern correct.
Le bug DC2 était réel à un moment mais semble **déjà corrigé**. Depuis que `confirmedModifiers` est `undefined` (pas de fenêtre mods pour drone CaC), `situationMods = []` par défaut.

**Conséquence :** B5 n'est plus un fix serveur autonome. C'est une conséquence de B4.
Une fois B4 résolu (fenêtre mods + `confirmedModifiers` rempli), le code existant lira les mods correctement.

---

### NOUVEAU-B8 — Humanoïde attaque Drone en CaC

**Problème non documenté** : quand un PJ/PNJ attaque un drone au corps à corps via `resolveMeleeAction` :

1. `sheetCible = null` (drones n'ont pas de `char_sheet`) → `defenderSkillTotal = 0` → défense échoue systématiquement → attaquant touche si son propre jet réussit.
   - Accidentellement correct selon §7.4 : sans programme `esquive`, le drone ne peut pas se défendre.
   - Confirmé (ligne 3309) : `let defenderSkillTotal = 0` initialisé avant le bloc `if (sheetCible)`, reste 0 si drone. Aucun crash ✅

2. **Problème réel — calcul des dégâts** : la branche PNJ auto-résolution (ligne ~3440) passe par `calcResistanceDommages(for_na_cible, con_na_cible)` → faux pour un drone (RD = `integrite × 2`, pas `FOR + CON`).

3. Idem dans `COMBAT_MELEE_DEFENSE_CONFIRM` branche PNJ attaquant (ligne ~2698) — même formule incorrecte pour drone défenseur.

4. La branche PJ attaquant → DAMAGE_CONFIRM a déjà un `cibleType === 'drone'` guard (ligne 2401 ff) qui appelle `calcDroneRD` + `resolveDroneIntegrityLoss` — **celle-là est correcte**.

**Fix requis** : ajouter `cibleType === 'drone'` guard dans :
- `resolveMeleeAction` branche PNJ auto-résolution (avant `calcResistanceDommages`)
- `COMBAT_MELEE_DEFENSE_CONFIRM` branche PNJ attaquant (avant `calcResistanceDommages`)

Pattern à réutiliser : ligne 2401-2408 (déjà dans COMBAT_DAMAGE_CONFIRM).

---

### NOUVEAU — `confirmedModifiers` non threadé vers `resolveMeleeAction`

Handler `COMBAT_ACTION_CONFIRM` (ligne 2253) reçoit `confirmedModifiers` mais **ne le passe pas** à `resolveMeleeAction` (ligne 2334). Uniquement passé à `resolveAssaultAction` (ligne 2318).

Trois emplacements à modifier pour Étape 3 :
1. Signature `resolveMeleeAction` ligne 3139 : ajouter param `confirmedModifiers = null`
2. Appel ligne 2334 : passer `confirmedModifiers`
3. Appels récursifs lignes 2779 et 3505 : passer `confirmedModifiers`

Et dans `commonPending` (ligne 3346) : ajouter `confirmedModifiers` — **obligatoire** pour que la ligne 2779 (multi-attaque) propage les mods à toutes les attaques de la série.

---

### NOUVEAU — `SITUATION_MODS` et `TAILLE_MODS` existent déjà

`SITUATION_MODS` — ligne 91 : contient déjà `couverture_partielle`, `couverture_importante`, `obscurite_*`, allures.
`TAILLE_MODS` — ligne 98 : table complète.

**Décision architecture** : ne pas créer `SITUATION_MODS_CAC`. Ajouter les clés CaC spécifiques directement dans `SITUATION_MODS` existant (ligne ~91). Les préfixes `cac_` évitent les collisions avec les keys ranged.

```js
// Ajouts à SITUATION_MODS (ligne ~91) :
cac_attaquant_cote:       -3,
cac_attaquant_au_sol:     -5,
cac_espace_confine:       -3,   // espace confiné (fourchette LdB −3 à −5 → deux options UI)
cac_espace_tres_confine:  -5,   // espace très confiné
cac_position_avantageuse:  3,
cac_main_non_directrice:  -5,
// cac_terrain_instable : PAS dans SITUATION_MODS — compétence limitative (ACROBATIE_EQUILIBRE)
// Traitement séparé : Math.min(0, acrobatieTotal - attackerSkillTotal)
```

Total : 6 keys dans SITUATION_MODS + 1 traitée séparément (terrain_instable).

---

### CORR-B8 — Localisation exacte du guard drone (RÉÉCRITURE)

**Erreur de plan corrigée** : l'emplacement 2 (MELEE_DEFENSE_CONFIRM) était FAUX.

**Pourquoi :** `COMBAT_MELEE_DEFENSE_CONFIRM` n'est déclenché que lorsqu'un PJ clique "Se défendre". Un drone n'a pas de socket joueur → ne clique jamais → ne passe jamais par MELEE_DEFENSE_CONFIRM. `cibleType` dans ce contexte = toujours `'pj'`. Guard drone = dead code.

**Vrai problème :** sans garde, un drone défenseur tombe dans le bloc PJ (ligne 3514) :
- `pendingMeleeDefense.set(targetTokenId, commonPending)` → stockage
- DEFENSE_PROMPT broadcasté à la room entière (drone n'a pas de socket)
- `return true` → **slot bloqué indéfiniment**

**Emplacement unique — `resolveMeleeAction` entre ligne 3512 et 3514 :**
Ajouter un `else if` au même niveau que le bloc PNJ (ligne 3376) :

**Variables disponibles au point d'insertion — CONFIRMÉES (lecture code) :**
- `defenderCharacter` — nom confirmé ligne 3296 ✅
- `damageFormula` — ligne 3150, avant le if/else (`let damageFormula = '1D4'`) ✅
- `modDom` — ligne 3231, avant le if/else ✅
- `parseDice` — utilisé ligne 3251, retourne `{ total, rolls, seed }` → `{ total: rawDice }` dans CORR-B8 correct ✅
- `combatModeBonus` — ligne 3237, avant le if/else : `const combatModeBonus = combatModeAtk === 'charge' ? 3 : 0` ✅ (PAS dans le bloc PNJ — concern levé)
- `rollAttaque` — ligne 3251, avant le if/else ✅
- `remainingMeleeActions`, `totalMeleeCount`, `character` — paramètres de `resolveMeleeAction` ✅

**Payload `COMBAT_ATTACK_RESULT` confirmé** (lecture ligne 3495) : `{ tireurId, cibleId, localisation, degautsBruts, degatsNets, severity, is_lethal, isSuccess, isPnj, roll, chancesDeReussite, shockResult }`. Shape du plan correcte ✅ — `null` pour `localisation`/`severity`/`shockResult` est la bonne approche pour un drone (pas de blessure, pas de choc).

```js
// Après la fermeture du bloc PNJ (ligne 3512 — return false):
} else if (defenderCharacter.type === 'drone') {
  // §7.4 : sans programme esquive, le drone ne peut pas se défendre — test simple
  const hit = rollAttaque <= chancesAttaque
  io.to(campaignId).emit(WS.COMBAT_MELEE_RESULT, {
    attaquantId: action.token_id, defenseurId: targetTokenId,
    rollAttaque, chancesAttaque, rollDefense: null, chanceDefense: null, hit,
    multiMalusAttaquant,
  })
  if (hit) {
    const droneSheet = await db('drone_sheet').where({ character_id: defenderCharacter.id }).first()
    if (droneSheet) {
      const { total: rawDice } = await parseDice(damageFormula.replace(/\s/g, ''))
      const degautsBruts = rawDice + (modDom ?? 0) + combatModeBonus
      const etqDrone = droneSheet.blindage ?? 0
      const rdDrone  = calcDroneRD(droneSheet.integrite_actuelle)
      const degatsNetsDrone = Math.max(0, degautsBruts - etqDrone - rdDrone)
      await resolveDroneIntegrityLoss(io, campaignId, defenderCharacter.id, targetTokenId, droneSheet, degatsNetsDrone)
      io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, {
        tireurId: action.token_id, cibleId: targetTokenId,
        localisation: null, degautsBruts, degatsNets: degatsNetsDrone,
        severity: null, is_lethal: false, isSuccess: true, isPnj: true,
        roll: rollAttaque, chancesDeReussite: chancesAttaque, shockResult: null,
      })
    }
  }
  if (remainingMeleeActions.length > 0) {
    // ⚠️ Étape 1 : confirmedModifiers absent — à passer en Étape 3 (4e call site). Mods situation absents pour cibles suivantes jusqu'à Étape 3.
    return await resolveMeleeAction(io, socket, campaignId,
      remainingMeleeActions[0], character, remainingMeleeActions.slice(1), totalMeleeCount)
  }
  return false
}
```

**Pas de `degautsBruts` déclaré avant le bloc `if (hit)`** — contrairement à la branche PNJ, `degautsBruts` est calculé à l'intérieur du `if (hit)` pour le drone. Le dice roll de dégâts n'a lieu que si touché.

**`pendingMeleeDefense` :** `set()` confirmé à la ligne 3515 (bloc PJ uniquement). CORR-B8 retourne `false` avant d'y arriver — aucune entrée créée pour le drone. Non-problématique ✅

---

### NOUVEAU — Flow "Agir" UI : état exact

**GM — PNJ melee :**
- `CombatModifiersWindow` n'est affiché que si `activeAssaultAction && !isDroneCaC` (ligne 148 CombatOverlay)
- Pour une action melee PNJ : `activeAssaultAction = null` → `CombatModifiersWindow` absent → bouton "Agir" bare (ligne 129) → `COMBAT_ACTION_CONFIRM` sans `confirmedModifiers`

**GM — Drone CaC :**
- `isDroneCaC` détecté ligne 45 CombatOverlay : `activeAssaultAction?.drone_weapon_inv_id && fire_mode === 'cc'`
- `CombatModifiersWindow` déjà exclu pour drone CaC (condition `!isDroneCaC`) ✅
- Actuellement : "Agir" bare → sans mods

**PJ — melee :**
- `playerActiveAssaultAction` = null pour les actions melee (cherche `action_key === 'assault'`)
- CombatActionWindow montré pendant RESOLUTION
- Footer de CombatActionWindow ligne 620-628 : si `!myAssaultAction && !myReloadAction` → bouton "Agir" bare → `COMBAT_ACTION_CONFIRM` sans `confirmedModifiers`

**Pour Étape 3 — ce qui change dans CombatOverlay :**
- Ajouter `playerActiveMeleeAction` (calque de `playerActiveAssaultAction` mais `action_key === 'melee'`)
- Condition CombatActionWindow : ajouter `&& !playerActiveMeleeAction` (masque pendant melee RESOLUTION, comme pour l'assaut)
- Ajouter `CombatCacModifiersWindow` pour PJ melee (calque de CombatModifiersWindow PJ)
- Ajouter `CombatCacModifiersWindow` pour GM melee PNJ (à la place du "Agir" bare)
- Ajouter `CombatCacModifiersWindow` pour GM drone CaC (variante sans SITUATION)

---

### NOUVEAU — Architecture CombatCacModifiersWindow : décisions

**Composant** : `CombatCacModifiersWindow.jsx` (Option A confirmée — composant isolé).
Prop `isDrone` (bool) : masque la section SITUATION humanoïde (couverture + obscurité + taille uniquement pour drones).

**`action_key === 'melee'` confirmé** (ligne 2085 socket/index.js) : `action_key: 'melee', type: 'melee'` ✅ — les `.find(a => a.action_key === 'melee')` ci-dessous sont corrects.

**Détection côté CombatOverlay — ce qui change :**
```js
// Ajouter (calque de playerActiveAssaultAction) :
const playerActiveMeleeAction = (phase === 'RESOLUTION' && sortedRoster[activeSlotIdx]?.token_id === playerToken?.id)
  ? actions.find(a => a.token_id === playerToken?.id && a.action_key === 'melee')
  : null

// Ajouter (calque de activeAssaultAction pour GM) :
const activeMeleeAction = gmActiveEntry
  ? actions.find(a => a.token_id === gmActiveEntry.token_id && a.action_key === 'melee')
  : null
```

**Masquage CombatActionWindow PJ :** ligne 107 → ajouter `&& !playerActiveMeleeAction`.

**"Agir" GM :** le bouton bare (ligne 129) doit être masqué pour `activeMeleeAction` et `isDroneCaC`. Reste visible pour reload et actions sans assaut ni melee.

**Affichages à ajouter dans CombatOverlay :**
1. `isGm && activeMeleeAction && gmActiveCharacter?.type !== 'pj'` → `<CombatCacModifiersWindow isDrone={false} />`
2. `isGm && isDroneCaC` → `<CombatCacModifiersWindow isDrone={true} />`
3. `!isGm && playerActiveMeleeAction` → `<CombatCacModifiersWindow isDrone={false} />`

**Pattern data flow confirmé** (lecture CombatModifiersWindow.jsx ligne 215) : `CombatCacModifiersWindow` émet lui-même `COMBAT_ACTION_CONFIRM` avec `confirmedModifiers` au clic "Lancer les dés". CombatOverlay ne collecte rien — il monte/démonte le composant. Même pattern que ranged ✅

**Props à passer à `CombatCacModifiersWindow`** (calque CombatModifiersWindow lignes 138–154) :
```jsx
{/* PJ CaC */}
<CombatCacModifiersWindow socket={socket} activeRosterEntry={playerRosterEntry} isDrone={false} />

{/* GM PNJ CaC */}
<CombatCacModifiersWindow socket={socket} activeRosterEntry={gmActiveEntry} isDrone={false} />

{/* GM Drone CaC */}
<CombatCacModifiersWindow socket={socket} activeRosterEntry={gmActiveEntry} isDrone={true} />
```
`attackResult` / `onAttackConfirmed` = spécifiques au flow assaut distance — ne pas inclure.
`gmActiveEntry` = `sortedRoster[activeSlotIdx]` (ligne 38) — objet roster avec `token_id` ✅
`playerRosterEntry` = `sortedRoster.find(e => e.token_id === playerToken.id)` (ligne 50) ✅

**`CombatGmDeclareWindow` confirmé ANNOUNCEMENT-only** (lignes 93–103) — non monté en RESOLUTION. Pas de bouton "Agir" à masquer dans ce composant ✅

**Conditions de rendu à modifier dans CombatOverlay (lecture lignes 107–154 + analyse) :**

Ligne 107 — `CombatActionWindow` PJ :
```jsx
// Avant :
!isGm && (phase === 'ANNOUNCEMENT' || (phase === 'RESOLUTION' && !playerActiveAssaultAction && !attackResult))
// Après :
!isGm && (phase === 'ANNOUNCEMENT' || (phase === 'RESOLUTION' && !playerActiveAssaultAction && !playerActiveMeleeAction && !attackResult))
```

Ligne 120 — bouton "Agir" bare GM :
```jsx
// Avant :
isGm && phase === 'RESOLUTION' && gmActiveEntry && (!activeAssaultAction || isDroneCaC)
// Après (simplifié) :
isGm && phase === 'RESOLUTION' && gmActiveEntry && !activeAssaultAction && !activeMeleeAction
// Raisonnement : isDroneCaC implique activeAssaultAction ≠ null → !activeAssaultAction l'exclut déjà.
// isDroneCaC prendra son propre rendu CombatCacModifiersWindow isDrone={true}.
```

**`confirmedModifiers` extraction serveur confirmée** (ligne 2253) : `socket.on(WS.COMBAT_ACTION_CONFIRM, async ({ tokenId, confirmedModifiers }) => {` — destructuré directement, prêt à passer à `resolveMeleeAction` sans transformation ✅

**SITUATION_MODS** : ajouter 6 clés CaC dans l'objet existant ligne ~91 (pas de nouvel objet). `cac_terrain_instable` est traité séparément — compétence limitative, pas dans SITUATION_MODS.

**i18n** : nouveau composant = nouvelles clés fr.json (green field — pas de rétrofit). Hors moratorium des 12 composants existants.

---

### NOUVEAU — confirmedModifiers dans chancesAttaque : formule complète

Après threading, `resolveMeleeAction` reçoit `confirmedModifiers = null`. À calculer :
```js
// Keys fixes (dans SITUATION_MODS)
const situationMods = (confirmedModifiers?.situation ?? []).filter(k => k !== 'cac_terrain_instable')
const situationModComp = situationMods.reduce((sum, k) => sum + (SITUATION_MODS[k] ?? 0), 0)
const tailleMod = TAILLE_MODS[confirmedModifiers?.taille ?? 'moyenne'] ?? 0

// Terrain instable — compétence limitative (fetch conditionnel)
// terrainInstableMod = Math.min(0, acrobatieTotal - attackerSkillTotal)  [calculé séparément — voir CORR-TERRAIN_INSTABLE]

// Deux armes — auto-détecté depuis invAttaquant (ref_category)
// deuxArmesBonus = deuxArmesSlots.length >= 2 ? 3 : 0  [calculé séparément — voir NOUVEAU-DEUX_ARMES]

const chancesAttaque = ... + situationModComp + tailleMod + terrainInstableMod + deuxArmesBonus
```

**Format `breakdownAtk` confirmé** (lignes 3260–3269) : `{ label: string, value: number, type: 'base'|'bonus'|'malus'|'total' }` ✅ — pattern spread conditionnel `...(val !== 0 ? [{ label, value, type }] : [])` à réutiliser.

Ajouter dans `breakdownAtk` si non nuls (même pattern que autres modificateurs).
`confirmedModifiers` **doit être dans `commonPending`** — la ligne 2779 (récursif MELEE_DEFENSE_CONFIRM, multi-attaque) n'y a pas accès autrement. `chancesAttaque` intègre déjà les mods de l'attaque courante, mais les appels récursifs recalculent `chancesAttaque` depuis zéro → `confirmedModifiers` doit être dans `commonPending` pour propager les mods situation à toutes les attaques de la série.

---

## 5. Ordre de travail — RESEQUENCÉ (post-audit)

```
Étape 1 — Bugfixes serveur CaC humanoïde (B1, B2, B8, B9)
  B1  : compétence défenseur → hand_pref → JS post-sort (3 rounds parallèles, PAS orderByRaw — voir CORR-B1 architecture)
  B2  : Charge guard → ligne 3234, rosterAttaquant existant
  B8  : drone défenseur → nouveau bloc `else if (type === 'drone')` entre ligne 3512 et 3514
        (test simple, damage auto pipeline drone, NO guard dans MELEE_DEFENSE_CONFIRM)
  B9  : test d'opposition → hit = attackSuccess && (!defenseSuccess || mrAttaque > mrDefense)
        → 2 emplacements : ligne 3388 (resolveMeleeAction PNJ auto) + ligne 2605 (MELEE_DEFENSE_CONFIRM)
  LOC : LOC_TABLE_CONTACT créée ligne ~57 + remplacée en 3 emplacements (3423, 2680, 2370 conditionnel)
  → Validation : CaC PJ→PNJ, PNJ→PJ, PJ→Drone (CaC) + modes combat + MR tie-break
  Note : sans CombatCacModifiersWindow (Étape 3), le bouton "Agir" bare émet COMBAT_ACTION_CONFIRM sans confirmedModifiers → serveur reçoit undefined → mods = 0. C'est le comportement attendu pour Étape 1.

Étape 2 — Bugfixes serveur Drone assault (B3, B6, B7)
  B3 : portée armement_contact → porteeModComp = 0
  B6 : isDroneTarget → loc = drone_sheet.localisation_ref (pas de D20)
  B7 : isDroneTarget → calcDroneRD + resolveDroneIntegrityLoss (fonctions existantes)
  → Validation : drone attaque humanoïde + drone attaque drone

Étape 3 — Fenêtre mods situation CaC + wiring (B4, B5)
  Prérequis serveur (dans resolveMeleeAction — avant le composant) :
  - invAttaquant.select += ref_category (ligne 3195) → auto-détection deux armes MD+MG → deuxArmesBonus
  - fetch conditionnel ACROBATIE_EQUILIBRE → terrainInstableMod (attaquant) + terrainInstableModDef (défenseur)
  - SITUATION_MODS : +6 clés CaC (ligne ~91 — cac_terrain_instable hors SITUATION_MODS)
  - threading confirmedModifiers : 4 sites (ligne 2334 + récursifs 2779/3505 + CORR-B8)
  - chancesAttaque += situationModComp + tailleMod + terrainInstableMod + deuxArmesBonus
  Composant :
  - ⚠️ Créer clés fr.json AVANT d'écrire le composant (voir NOUVEAU-I18N dans §3)
  - ⚠️ Vérifier action_key melee AVANT les détections CombatOverlay (voir §Architecture)
  - CombatCacModifiersWindow.jsx (nouveau, prop isDrone)
  - Ajouts CombatOverlay : playerActiveMeleeAction, activeMeleeAction, 3 affichages
  - B4 : isDroneCaC → CombatCacModifiersWindow isDrone (B5 résolu par B4)
  → Validation : mods situation humanoid CaC + drone CaC avec mods

Étape 4 — Validation multi-attaque 4b (aucun fix — validation seulement)
```

---

### CORR-TERRAIN_INSTABLE — Compétence limitative, pas un modificateur fixe

**Règle LdB §6.2 :** "Terrain instable — limite par Acrobatie/Équilibre."
Ce n'est pas un malus chiffré fixe : le skill effectif de l'attaquant est limité par son niveau `ACROBATIE_EQUILIBRE`.

**Skill ID :** `ACROBATIE_EQUILIBRE` (migration 74 — corrige typo `ACCROBATIE_EQUILIBRE`).

**Mécanique :**
- `calcSkillTotal(attrsAttaquant, acrobatieCharSkill, acrobatieRefSkill, genoAttaquant)` → `acrobatieTotal`
- Si le personnage n'a pas levelé la compétence : `acrobatieCharSkill = null` → calcSkillTotal retourne quand même le score attribut de base (pas 0).
- `terrainInstableMod = Math.min(0, acrobatieTotal - attackerSkillTotal)` — peut seulement réduire.

**Impact :** la checkbox `cac_terrain_instable` dans `CombatCacModifiersWindow` déclenche côté serveur un fetch conditionnel de `ACROBATIE_EQUILIBRE`. Aucun calcul côté client — le serveur l'ajoute dans `breakdownAtk`.

**Requêtes supplémentaires :** 2 (ref_skills + char_skills ACROBATIE_EQUILIBRE) — déclenchées seulement si `cac_terrain_instable` est coché. En dehors du Promise.all existant (fetch conditionnel après).

---

### NOUVEAU-LOC_TABLE_CONTACT — Constante manquante

**Règle LdB §6.2 :** "1D20 → table localisation (colonne 'Contact' optionnelle du LdB)."
Le LdB fournit une table Contact séparée de la table Distance. Distribution identique à LOC_TABLE actuelle, mais doit exister comme constante propre pour respecter la règle et permettre une correction future sans chasse aux hardcodes.

**Constante à créer** (ligne ~57 index.js, après LOC_TABLE) :
```js
const LOC_TABLE_CONTACT = [
  { max: 2,  slot: 'T'  },
  { max: 8,  slot: 'C'  },
  { max: 11, slot: 'BD' },
  { max: 14, slot: 'BG' },
  { max: 17, slot: 'JD' },
  { max: 20, slot: 'JG' },
]
```

**Usage — 3 emplacements confirmés par lecture du code :**

1. `resolveMeleeAction` ligne 3423 — branche PNJ auto-résolution. Remplacer `LOC_TABLE` → `LOC_TABLE_CONTACT`.

2. `COMBAT_MELEE_DEFENSE_CONFIRM` ligne 2680 — branche PNJ attaquant (PNJ auto-dégâts sur PJ défenseur). Confirmé : `LOC_TABLE.find(...)`. Remplacer → `LOC_TABLE_CONTACT`.

3. `COMBAT_DAMAGE_CONFIRM` ligne 2370 — sert **les deux** (melee PJ→PJ ET ranged assault). Même instruction pour les deux. Fix conditionnel :
```js
// Ligne 2370 — remplacer :
const slotCode = (LOC_TABLE.find(r => rollLoc <= r.max) ?? LOC_TABLE[LOC_TABLE.length - 1]).slot
// Par :
const locTable = pendingType === 'melee' ? LOC_TABLE_CONTACT : LOC_TABLE  // pendingType confirmé ligne 2364 : `type: pendingType` destructuré depuis pending ✅
const slotCode = (locTable.find(r => rollLoc <= r.max) ?? locTable[locTable.length - 1]).slot
```

`LOC_TABLE` (distance) reste inchangé — utilisé uniquement par `resolveAssaultAction` et `resolveDroneAssaultAction`.

---

### NOUVEAU-DEUX_ARMES — Auto-détection, pas une checkbox

**Règle LdB §6.2 :** "Deux armes CaC : Attaquant +3 au Test de combat au contact."
Condition : les slots MD ET MG sont tous deux occupés par une arme de catégorie `'Arme de contact'`.

**Ce n'est pas un modificateur UI** — auto-détecté côté serveur, aucune checkbox. Le GM ne peut pas oublier de le cocher.

**Fix requis :** ajouter `ref_equipment.category as ref_category` dans le select de `invAttaquant` (ligne 3195) :
```js
.select('char_inventory.container', 'char_inventory.slot', 'char_inventory.quantity',
        'ref_equipment.weight as ref_weight', 'ref_equipment.min_str as ref_min_str',
        'ref_equipment.category as ref_category')   // ADD — requis pour deux armes
```

**Calcul** (après loading invAttaquant) :
```js
const deuxArmesSlots = invAttaquant.filter(i =>
  ['MD', 'MG'].includes(i.slot) && i.ref_category === 'Arme de contact'
)
const deuxArmesBonus = deuxArmesSlots.length >= 2 ? 3 : 0
```

Ajouter dans `chancesAttaque` et dans `breakdownAtk` (si `deuxArmesBonus !== 0`).

**Note défense :** +3 en défense pour deux armes = techniquement Arts Martiaux uniquement (§6.9). Hors scope Sprint CaC.

---

### B9 — TEST D'OPPOSITION INCOMPLET : "les deux réussissent"

**Bug critique — jamais documenté.**

**Code actuel (lignes 3386–3388) :**
```js
const attackSuccess  = rollAttaque  <= chancesAttaque
const defenseSuccess = rollDefense  <= chanceDefense
const hit = attackSuccess && !defenseSuccess
```

**Cas non géré :** `attackSuccess = true` ET `defenseSuccess = true` → `hit = false` → rien ne se passe.

**Règle LdB §6.2 :**
> "Les deux réussissent → Meilleure MR l'emporte. Égalité = rien."

`MR = Seuil − Jet`. Meilleur MR = plus grande valeur. Si `mrAttaque > mrDefense` → hit. Si `mrAttaque === mrDefense` → rien.

**Fix :**
```js
const mrAttaque  = chancesAttaque - rollAttaque    // MR attaquant (positif si succès)
const mrDefense  = chanceDefense  - rollDefense    // MR défenseur (positif si succès)
const hit = attackSuccess && (!defenseSuccess || mrAttaque > mrDefense)
// Égalité succès/succès → hit = false ✅
// Deux échecs → hit = false ✅
// Attaque réussit seul → hit = true ✅
// Défense réussit seule → hit = false ✅
// Les deux réussissent → MR attaque > MR défense → hit ✅
```

**Emplacements :** deux endroits dans le code :
1. `resolveMeleeAction` branche PNJ auto-résolution (ligne 3388)
2. `COMBAT_MELEE_DEFENSE_CONFIRM` (ligne 2605)

**`hit` déclaré `const` aux deux emplacements** (lignes 3388 et 2605 confirmées) — réécriture obligatoire avec `let` + déclaration des deux MR. Patch direct impossible aux deux endroits.

**Priorité :** Étape 1 — même criticité que B1. Sans ce fix, le CaC est fondamentalement incorrect.

---

### CORR-B1 — Tri arme défenseur : JS post-sort, pas orderByRaw

**PC43 :** "préférer le JS post-fetch". Même si les slots sont TEXT (pas UUID), le tri SQL avec `orderByRaw` est moins robuste que le sort JS. Approche correcte :

```js
// Fetch toutes les armes de contact des slots MD/MG/2M en UNE requête
const defWeaponsAll = await db('char_inventory')
  .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
  .where({ 'char_inventory.character_id': defenderCharacter.id })
  .whereIn('char_inventory.slot', ['MD', 'MG', '2M'])
  .where('ref_equipment.category', 'Arme de contact')
  .select('char_inventory.slot', 'char_inventory.equipment_id')

const slotPriority = (sheetCible.hand_pref ?? 'R') === 'L' ? ['MG', 'MD', '2M'] : ['MD', 'MG', '2M']
const defWeapon = slotPriority
  .map(s => defWeaponsAll.find(w => w.slot === s))
  .find(w => w != null) ?? null
// Si defWeapon === null → defSkillId reste 'COMBAT_A_MAINS_NUES'
```

Puis sequentiellement : `ref_equipment_skill_assoc WHERE item_id = defWeapon.equipment_id`.

**2 queries séquentielles** avant le Promise.all défenseur (ligne 3315). Acceptable.

---

### CORR-TERRAIN_INSTABLE — Design deux cases indépendantes

**Terrain instable n'est pas partagé automatiquement.** C'est un modificateur à cocher indépendamment pour l'attaquant ET pour le défenseur. Le terrain peut être instable pour l'un sans l'être pour l'autre (l'un sur une passerelle, l'autre au sol ferme).

**Design retenu :**
- `CombatCacModifiersWindow` contient une section "Attaquant" et une section "Défenseur"
- La case "Terrain instable" apparaît dans les deux sections — deux checkboxes indépendants
- Payload étendu :
```js
confirmedModifiers: {
  situation:    string[],  // attaquant — inclut éventuellement 'cac_terrain_instable'
  situationDef: string[],  // défenseur — inclut éventuellement 'cac_terrain_instable'
  taille: string,
}
```

**Côté serveur :**
- `terrainInstableMod` (attaquant) : calculé depuis `situation` → limite `chancesAttaque`
- `terrainInstableModDef` (défenseur) : calculé depuis `situationDef` → limite `chanceDefense`
  - En auto-défense PNJ (resolveMeleeAction) : appliqué directement
  - En MELEE_DEFENSE_CONFIRM (PJ défenseur) : `pending.situationDef` doit être stocké dans `commonPending`

**`commonPending` — ajout :**
```js
situationDef: confirmedModifiers?.situationDef ?? [],
confirmedModifiers,   // requis pour récursif ligne 2779 (multi-attaque MELEE_DEFENSE_CONFIRM)
```

**Calcul terrainInstableModDef (même pattern que attaquant) :**
```js
let terrainInstableModDef = 0
if ((confirmedModifiers?.situationDef ?? []).includes('cac_terrain_instable')) {
  const acrobatieRefDef  = await db('ref_skills').where({ id: 'ACROBATIE_EQUILIBRE' }).first()
  const acrobatieCharDef = await db('char_skills').where({ char_sheet_id: sheetCible.id, skill_id: 'ACROBATIE_EQUILIBRE' }).first()
  const acrobatieDefTotal = acrobatieRefDef
    ? calcSkillTotal(attrsCible, acrobatieCharDef, acrobatieRefDef, genoCible)
    : defenderSkillTotal
  terrainInstableModDef = Math.min(0, acrobatieDefTotal - defenderSkillTotal)
}
chanceDefense += terrainInstableModDef
```

**Section "Défenseur" dans CombatCacModifiersWindow** : pour l'instant, une seule case — `cac_terrain_instable`. D'autres mods défenseur pourraient être ajoutés dans un sprint futur.

**⚠️ Dans MELEE_DEFENSE_CONFIRM (Étape 3) :** `attrsCible` et `genoCible` sont absents — doivent être fetchés. `char_sheet_id_cible` est disponible dans `commonPending` ✅. Séquence requise :
```js
const [attrsCible, archetypeCible, acrobatieCharDef, acrobatieRefDef] = await Promise.all([
  db('char_attributes').where({ char_sheet_id: char_sheet_id_cible }),
  db('char_archetype').where({ char_sheet_id: char_sheet_id_cible }).first(),
  db('char_skills').where({ char_sheet_id: char_sheet_id_cible, skill_id: 'ACROBATIE_EQUILIBRE' }).first(),
  db('ref_skills').where({ id: 'ACROBATIE_EQUILIBRE' }).first(),
])
const genoCible = archetypeCible?.genotype_id
  ? await db('ref_genotypes').where({ id: archetypeCible.genotype_id }).first() : null
```
Déclencher ce fetch uniquement si `(common.situationDef ?? []).includes('cac_terrain_instable')` — conditionnel, même pattern que l'attaquant.

---

### VÉRIFICATION — MELEE_DEFENSE_CONFIRM : combat mode PJ défenseur

**Statut : ✅ CONFIRMÉ correct** (lecture code lignes 2594–2600).
`rosterDef.state_combat_mode` est fetchée et appliquée : `offensif` → −5, `charge` → −7, `defensif` → +3, `retraite` → +5.

---

### DÉTAIL — `breakdownAtk` label terrain_instable

Le modifier terrain_instable est dynamique (dépend de `acrobatieTotal`). Le label doit l'afficher :
```js
...(terrainInstableMod !== 0 ? [{
  label: `Terrain instable (Acrobatie/Équilibre: ${acrobatieTotal})`,
  value: terrainInstableMod,
  type: 'malus',
}] : []),
```
Même pattern pour le défenseur si Option A retenue pour commonPending.

---

## AUDIT SESSION 92-4 — Corrections supplémentaires identifiées en run à vide

> Appender progressivement. Source : run à vide exhaustif du plan Étape 3 (lecture code + analyse scoping).

---

### CORR-S15 — Terrain instable DEF branche PNJ auto : `attrsCible`/`genoCible` hors scope

**Problème identifié :** `attrsCible`, `archetypeCible` et `genoCible` sont déclarés avec `const` à l'intérieur du bloc `if (sheetCible)` (lignes 3333–3366). Le bloc PNJ auto (`if (defenderCharacter.type === 'pnj')`) est au même niveau lexical → ces variables ne sont **pas accessibles** dans le bloc PNJ.

**Conséquence :** il n'est PAS possible de réutiliser `attrsCible`/`genoCible` pour le fetch terrain instable DEF dans la branche PNJ auto. Il faut un re-fetch.

**Fix — à insérer après ligne 3422 (fin des ajustements chanceDefense mode combat), avant ligne 3423 (`mrAttaque`) :**
```js
// Terrain instable DEF — PNJ auto
// attrsCible/genoCible hors scope → re-fetch conditionnel (char_sheet_id_cible disponible)
let terrainInstableModDef = 0, acrobatieDefTotal = defenderSkillTotal
if ((confirmedModifiers?.situationDef ?? []).includes('cac_terrain_instable') && char_sheet_id_cible) {
  const [attrsDef, archetypeDef, acrobatieCharDef, acrobatieRefDef] = await Promise.all([
    db('char_attributes').where({ char_sheet_id: char_sheet_id_cible }),
    db('char_archetype').where({ char_sheet_id: char_sheet_id_cible }).first(),
    db('char_skills').where({ char_sheet_id: char_sheet_id_cible, skill_id: 'ACROBATIE_EQUILIBRE' }).first(),
    db('ref_skills').where({ id: 'ACROBATIE_EQUILIBRE' }).first(),
  ])
  const genoDef = archetypeDef?.genotype_id
    ? await db('ref_genotypes').where({ id: archetypeDef.genotype_id }).first() : null
  acrobatieDefTotal = acrobatieRefDef
    ? calcSkillTotal(attrsDef, acrobatieCharDef, acrobatieRefDef, genoDef)
    : defenderSkillTotal
  terrainInstableModDef = Math.min(0, acrobatieDefTotal - defenderSkillTotal)
  chanceDefense += terrainInstableModDef
}
// mrAttaque, mrDefense (utilisent chanceDefense final) — ligne 3423 inchangée
```

**Variables disponibles au point d'insertion :**
- `confirmedModifiers` — paramètre de `resolveMeleeAction` (après S2) ✓
- `char_sheet_id_cible` — `let` déclaré avant `if (sheetCible)`, ligne 3327 ✓
- `defenderSkillTotal` — `let` déclaré avant `if (sheetCible)` ✓

**Nb queries (conditionnel) :** 4 parallèles + 1 séquentielle (genotype). Déclenché uniquement si `cac_terrain_instable` est coché pour le défenseur.

---

### CORR-S16 — `breakdownDef` PNJ auto : entrée terrain instable DEF

Après CORR-S15, `terrainInstableModDef` et `acrobatieDefTotal` sont en scope (hoistés en `let`).
Ajouter dans `breakdownDef` (ligne 3430–3436), avant `{ label: 'Seuil', ... }` :

```js
...(terrainInstableModDef !== 0 ? [{
  label: `Terrain instable (Acrobatie/Équilibre: ${acrobatieDefTotal})`,
  value: terrainInstableModDef,
  type: 'malus',
}] : []),
```

Le `{ label: 'Seuil', value: chanceDefense, type: 'total' }` utilise déjà le `chanceDefense` final (modifié par `+= terrainInstableModDef`). Aucun autre changement à `breakdownDef`. ✓

Même pattern à ajouter dans `breakdownDefPj` (MELEE_DEFENSE_CONFIRM, ligne 2623-2624), avec `acrobatieDefTotal` hoistée en `let` avant le bloc conditionnel S10.

---

### CORR-DRONE-LOOKUP — `CombatCacModifiersWindow` : lookup action incorrect pour drone CaC

**Problème :** le drone CaC a `action_key === 'assault'` (pas `'melee'`). Un lookup `actions.find(a => a.action_key === 'melee')` retourne `null` pour le drone → header `? — Corps à corps — ?`, `target_token_id` absent.

**Cause :** le drone CaC passe par `resolveAssaultAction`/`resolveDroneAssaultAction`, pas `resolveMeleeAction`. L'action déclarée reste de type `assault` avec `drone_weapon_inv_id` et `fire_mode === 'cc'`.

**Confirmation :** `fire_mode` est disponible dans le store `actions` — déjà utilisé ligne 45 CombatOverlay : `activeAssaultAction?.fire_mode === 'cc'`. ✓

**Fix — lookup conditionnel selon `isDrone` dans `CombatCacModifiersWindow` :**
```js
const meleeOrAssaultAction = useMemo(() => {
  if (!activeRosterEntry) return null
  if (isDrone) {
    return actions.find(a =>
      a.token_id === activeRosterEntry.token_id &&
      a.action_key === 'assault' && a.fire_mode === 'cc'
    ) ?? null
  }
  return actions.find(a =>
    a.token_id === activeRosterEntry.token_id && a.action_key === 'melee'
  ) ?? null
}, [actions, activeRosterEntry, isDrone])
```

Remplacer toutes les références à `meleeAction` dans le composant par `meleeOrAssaultAction`.

---

### RÉCAPITULATIF — Plan Étape 3 corrigé (16 S + 1 client fix)

Plan serveur final : S1–S16 (S15 et S16 nouveaux — terrain instable DEF branche PNJ).
Plan client final : CombatCacModifiersWindow (+ CORR-DRONE-LOOKUP), CombatOverlay C1–C6.

**Ordre de travail inchangé** — S15/S16 s'insèrent naturellement dans le bloc PNJ déjà visité.
`i18n` : aucune clé fr.json à créer — `CombatModifiersWindow.jsx` ne l'utilise pas, même pattern pour le nouveau composant.
