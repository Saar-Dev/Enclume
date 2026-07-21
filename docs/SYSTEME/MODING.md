SYSTEME/MODING.md — Système de mods d'armes

    Dernière mise à jour : 2026-07-21 — Session 167 (Phases 1/3/4 codées et testées).

    Lire pour : comment un accessoire d'arme (mod) modifie une résolution de combat, exclusivité de
    slot à l'installation, architecture à hooks du Groupe 4.

    Source : docs/Old/[HISTORIQUE] PLAN_MODING_PHASEB.md (Groupe 1/2, shippé), docs/Old/[HISTORIQUE]
    PLAN_MODDING_REFONTE.md (Groupe 4, socle + mécaniques shippés, historique complet des 3 passages
    d'analyse à charge), migrations 137/141/142/180/182/184. Ces deux PLAN sont archivés (Règle 10,
    docs/RegleDocumentaire.md) — ce document est désormais l'unique référence active.

    > Voir aussi : @SERVICES_COMBAT (services `server/src/lib/`), @COMBAT_FLUX (déroulement d'un tour).

---

## 1. Vue d'ensemble — deux mécanismes coexistent, par choix (Strangler Fig)

Le projet a **deux générations de mécanisme de mod** actives simultanément dans le code, pas une
dette d'incohérence :

- **Groupe 1/2** (bonus optique fixe, Lunette de visée) — fonctions dédiées
  (`modingService.calcWeaponModBonus`, `shared/combatExclusiveActions.js`), appelées directement par
  `socketCombatAnnouncement.js`/`socketCombatHelpers.js`. Codé et confirmé fonctionnel en navigateur
  (`docs/Old/[HISTORIQUE] PLAN_MODING_PHASEB.md`).
- **Groupe 4** (ATI, Mémoire de cibles, Projecteur de mouvement) — registre générique à hooks
  (`shared/weaponModRegistry.js` + `server/src/services/weaponModService.js`). Codé et testé en
  isolation (`docs/Old/[HISTORIQUE] PLAN_MODDING_REFONTE.md`), **pas encore câblé** dans la résolution
  de combat réelle (voir §5).

La migration de Groupe 1/2 vers le registre générique (Phase 2 du plan) est **différée
volontairement** (pattern Strangler Fig — Fowler) : Groupe 1/2 fonctionne et est testé, le réécrire
n'apporte aucun comportement nouveau et n'aurait de sens que si le registre prouve sa valeur sur
Groupe 4 d'abord. Ne pas essayer d'unifier les deux avant que cette migration soit explicitement
relancée.

---

## 2. Modèle de données

```
ref_equipment.mod_slot          TEXT nullable   -- 'optique' | 'logiciel' | 'canon' | 'poignee' | NULL
ref_equipment.mod_requires_aim  BOOLEAN NOT NULL DEFAULT false  -- true uniquement pour la Lunette
ref_equipment.mod_key           TEXT nullable   -- routage registre Groupe 4 : 'ati'|'memoire'|'projecteur'|NULL

char_inventory_mods.mod_slot    TEXT nullable   -- snapshot de ref_equipment.mod_slot à l'installation
char_inventory_mods.state       JSONB nullable  -- état persistant par mod installé (Groupe 4 uniquement)

UNIQUE (weapon_inv_id, mod_slot) WHERE mod_slot IS NOT NULL   -- garde-fou d'exclusivité (migration 141)
```

Trois axes orthogonaux, décidés séparément :
- `mod_slot` : quel emplacement physique exclusif l'item occupe (bloque l'installation croisée).
- `mod_requires_aim` : comment le bonus optique se calcule (plat vs conditionné à un Tir visé).
- `mod_key` : quel handler du registre Groupe 4 traite ce mod (`NULL` = jamais dans le registre,
  comportement neutre — Groupe 1/2 n'a pas de `mod_key`, ils ne passent jamais par le registre).

`mod_key` est une **donnée catalogue**, jamais une liste d'`equipment_id` codée en dur dans un
fichier JS (précédent : PF2e Rule Elements, Foundry VTT — le type de comportement est une donnée sur
l'item, pas une liste d'ID en code). Ajouter un futur item au même comportement ne touche qu'une
migration, jamais `shared/weaponModRegistry.js`.

---

## 3. Exclusivité de slot — réglée à l'installation, jamais au calcul

`modingService.installMod` : au plus un item actif par `mod_slot` sur une arme donnée. Installer un
2ᵉ item du même slot **remplace automatiquement** l'ancien — la ligne `char_inventory_mods` de
l'ancien occupant est **supprimée** (`DELETE`, pas un flag de statut) et l'objet physique revient en
inventaire via une ligne `char_inventory` séparée. Un `state` (Groupe 4) sur la ligne supprimée
disparaît avec elle — aucun état fantôme possible par construction.

La contrainte `UNIQUE(weapon_inv_id, mod_slot)` est la vraie garde contre la course (deux
installations concurrentes) ; le check applicatif dans `installMod` n'est qu'une optimisation du cas
normal.

Le calcul de combat n'a donc jamais besoin de choisir entre plusieurs candidats du même slot : il ne
peut jamais y en avoir qu'un.

---

## 4. Architecture à hooks (Groupe 4)

### 4.1 Registre unique — `shared/weaponModRegistry.js`

```js
{ key, priority, hooks, statusCodes? }
```
- `key` : correspond à `ref_equipment.mod_key`.
- `priority` : ordre d'exécution explicite quand plusieurs mods s'appliquent au même hook (plus
  petit = en premier) — jamais dérivé d'un ordre d'installation (instable si l'item est réinstallé).
- `hooks` : les fonctions du handler pour ce mod (voir §4.2).
- `statusCodes` (optionnel) : codes `token_statuses` que ce mod peut poser via `onTurnStart` (ex.
  `['ati_offensive', 'ati_defensive']`) — lu par `getAllModStatusCodes()` pour le nettoyage
  `COMBAT_END`. Un mod qui pose un badge sans déclarer son code ici fuira au combat suivant.

Entrées réelles aujourd'hui : `ati`, `memoire`, `projecteur` (tous trois slot `logiciel`, mutuellement
exclusifs entre eux — jamais deux actifs simultanément pour une même arme).

### 4.2 Les quatre hooks

| Hook | Appelé dans | Rôle |
|---|---|---|
| `onDeclare` | `socketCombatAnnouncement.js` (Phase 1 Déclaration) | Coût INI + bonus stocké — **câblé pour Groupe 1/2 seulement aujourd'hui** (`getAimIniCost`/`getAimBonusComp`), pas encore pour un mod du registre. |
| `onTurnStart` | `startResolutionPhase` (`socketCombatHelpers.js`) | Tick de début de tour pour les mods à état (ex. ATI). **Câblé et actif** — boucle sans effet tant qu'aucun mod actif n'a de `state` réel (voir §5). |
| `onBeforeAttack` | `resolveAssaultAction`/`resolveMeleeAction` | Interruption (`blocked`) + modificateurs ajustés. **Handlers codés, appel pas encore câblé** (§5). |
| `onCalculateModifiers` | `resolveAssaultAction`/`resolveMeleeAction` | Bonus/malus au Test. **Câblé pour Groupe 1/2 seulement** (`calcWeaponModBonus`/`getEffectiveAimBonus`), pas encore pour le registre. |

### 4.3 Service de résolution — `server/src/services/weaponModService.js`

`resolveModHooks(mods, hookName, context)` — point d'entrée unique :
- Filtre les mods dont `mod_key` a une entrée registre pour ce hook, trie par `priority` croissante.
- **`modLevel` est injecté par mod** (`mod.bonus`, colonne `ref_equipment.bonus`), jamais un champ
  global du contexte — deux mods actifs simultanément (slots orthogonaux) ont chacun leur propre
  niveau.
- **`rollDice`** est injecté automatiquement (basé sur `parseDice`, async) — aucun appelant n'a à s'en
  souvenir.
- `onCalculateModifiers` : chaque handler ne voit que son propre `modState` (isolation), les
  bonus/malus sont additionnés indépendamment.
- `onBeforeAttack` : le contexte est **enchaîné** dans l'ordre de `priority` — un `adjustedModifiers`
  retourné par un mod est visible par le suivant avant que celui-ci ne décide `blocked`. Arrêt
  immédiat sur `blocked: true`, aucun handler suivant appelé.
- `onTurnStart` : un état par mod, jamais fusionné — le résultat est un tableau, l'appelant persiste
  chaque état sur sa propre ligne `char_inventory_mods`.

`getAllCombatMods(campaignId)` : tous les mods installés sur toute arme de chaque personnage en lice
dans un combat (pas seulement l'arme d'une action précise) — nécessaire pour qu'un mod à état (ATI)
tique chaque tour indépendamment de l'arme effectivement utilisée.

`getAllModStatusCodes()` : union des `statusCodes` déclarés par le registre — lue à `COMBAT_END`
(`socketCombatState.js`) pour nettoyer `token_statuses` sans jamais lister de code en dur ailleurs
que dans le registre.

### 4.4 Cycle de vie d'un mod à état

```
[Installation] → [Chaque tour]      → [Résolution]           → [Fin de combat]
                   onTurnStart         onBeforeAttack            COMBAT_END
                                       onCalculateModifiers
                   char_inventory_     token_statuses            reset state
                   mods.state=...      (effets tour, cosmétique) = null
```

`token_statuses` reste un **badge cosmétique** — la magnitude réelle d'un mod (ex. bonus croissant de
l'ATI) vit uniquement dans `char_inventory_mods.state`, jamais recalculée depuis `token_statuses`.
Écriture via `statusService.applyModStatus`/`clearModStatus` (upsert sur la contrainte UNIQUE de
`token_statuses`, migration 68) — jamais un insert ad-hoc ailleurs.

---

## 5. Mécaniques Groupe 4 — codées, pas câblées en résolution live

`shared/mods/ati.js`, `memoire.js`, `projecteur.js` : handlers purs (sauf `rollDice`, injecté),
fidèles au texte RAW (`docs/Old/script Extraction Excel/equipement/STEP1_cleaned_data.js`
EQ_00001/00002/00005), testés unitairement (18 scénarios + 4 tests d'intégration sur le registre
réel).

**`resolveAssaultAction`/`resolveMeleeAction` n'appellent pas encore
`resolveModHooks(..., 'onBeforeAttack'/'onCalculateModifiers', ...)` pour ces mods** — ils restent
inertes en combat réel. Trois causes distinctes, **pas un oubli technique** :

1. **ATI** — aucune interface ne permet au joueur de choisir mode/cible (décision produit).
2. **Mémoire** — aucune interface ne permet d'enregistrer des cibles (décision produit).
3. **Projecteur** — `targetIsMoving`/`targetMovementMalus` sont déjà dérivables de
   `confirmedModifiers.situation` (existant) ; seul `targetMovementIsErratic` (zigzag) n'existe nulle
   part (ni `shared/combatSituationMods.js` ni `CombatModifiersWindow.jsx`) — nécessite une nouvelle
   option de situation (produit + UI).

Détail et prochaine étape de chacune : `docs/BUGIDENTIFIE.md` — `MODING4-ATI`, `MODING4-MEMOIRE`,
`MODING4-PROJECTEUR`, `MODING4-INTEGRATION` (câblage final, mécanique et court une fois une des 3
décisions prises).

---

## 6. Points de câblage — état exact au 2026-07-21

| Fichier | Câblé aujourd'hui |
|---|---|
| `socketCombatAnnouncement.js` (Déclaration) | Groupe 1/2 (`getAimIniCost`/`getAimBonusComp`) uniquement |
| `resolveAssaultAction` (`socketCombatHelpers.js`) | Groupe 1/2 (`calcWeaponModBonus`/`getEffectiveAimBonus`) uniquement |
| `startResolutionPhase` (`socketCombatHelpers.js`) | `onTurnStart` Groupe 4 — câblé, boucle neutre tant qu'aucun mod n'a d'état réel actif (§5) |
| `socketCombatState.js` (`COMBAT_END`) | Nettoyage `state`/`token_statuses` Groupe 4 — câblé, neutre tant que rien n'écrit dedans |
| `resolveMeleeAction` | N'utilise aucune fonction de mod, Groupe 1/2 ou 4 (armes à distance uniquement à ce jour) |
