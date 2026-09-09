# PLAN_USURE&INTEGRITE.md — Plan technique : usure et intégrité du matériel

> Statut : **rédigé le 2026-09-09**, non commencé. Squelette + décisions D1-D7 validés Saar (§13).
> Révisé le 2026-09-09 après analyse à charge : gaps G1-G4 et précisions M1-M7 intégrés (voir §14).
> Le « L5-pre » (rework dispatch combat) a été inscrit puis **retiré** après vérification (§7.0) — les
> points d'insertion combat sont propres sans lui.
> Autorité de logique de jeu : `docs/MANUELS/MANUEL_USURE.md` v1.5 (ne pas dupliquer les règles ici — y renvoyer).
> Autorité RAW : `docs/REGLES/REGLE_USURE&INTEGRITE.md`.
> Ce PLAN décrit **migrations, services, composants**. Il est temporaire (RegleDocumentaire Règle 10) :
> à la clôture, la doc définitive va dans `SYSTEME/CHARACTER.md` (inventaire) et `SYSTEME/COMBAT.md`
> (modificateur/panne d'arme).

---

## 1. Vue d'ensemble

### Périmètre V1 (lots L0 → L7) — aucune dépendance externe
Le cœur : une pièce d'équipement porte une ITG (courante / max), un test de panne branché sur le moteur
de Test du projet, un modificateur automatique en combat, une réparation validée par le MJ, et des
champs éditables pour l'usure manuelle.

### Lot 2 (L8 → L9) — post-V1, dépendances
- **L8** « MAIS TU VAS MARCHER » + pièces détachées → dépend du helper `resolveChanceTest` (`PLAN_CHANCE.md`).
- **L9** entrées #2/#8 de la table CATASTROPHES EN COMBAT → `EFFECT_HANDLERS` dans `catastropheService.js`.

### Hors-scope (renvois)
| Sujet | Où |
|---|---|
| Exo-armures / drones (Intégrité propre) | `MANUEL_EXOARMURE.md`, `/drone/integrity` |
| Attaques IEM + flag `is_electronic` | `PLAN_INFORMATIQUE.md` |
| Usure automatique (perte au fil des utilisations), perte définitive automatique | `MANUEL_USURE.md` §9 — optionnel, non implémenté |
| Réparation en atelier automatisée (`'critical'`) | `MANUEL_USURE.md` §5.3 — MJ manuel en V1 |

### Autorités (invariant #3)
| Responsabilité | Autorité |
|---|---|
| Interprétation ITG (palier ↔ modificateur, math des pertes, formules qualité) | `shared/integrityRules.js` (**neuf, pur**) |
| Le jet (réussite / échec / Catastrophe + retest sur 20) | `shared/polarisTestResolution.js` via `resolvePolarisTest` (existant) |
| Mutation `char_inventory` + événements | `server/src/lib/integrityService.js` (**neuf**) |
| Règles de jeu | `MANUEL_USURE.md` (jamais recopiées ici) |

---

## 2. L0 — Schéma

> Numéros de migration : **329+** au moment de coder (328 pris par le chantier Taille le 2026-09-09).
> Prendre le prochain numéro libre après un `ls server/src/db/migrations/`.

### 2.1 `ref_equipment` (+2 colonnes)
Migration additive, pattern `321_ref_equipment_aoe_profile.js` (`ADD COLUMN IF NOT EXISTS`, backfill
matché par **clé métier**, jamais par `id` — `.claude/rules/core.md` ; `down()` = `DROP COLUMN`).
Le backfill ne s'exécute **qu'une fois** (tracé dans `knex_migrations`) ; les bascules MJ ultérieures
d'`has_integrity` survivent (ne jamais rappeler `up()` — `.claude/rules/migrations.md`).

| Colonne | Type | Contrainte |
|---|---|---|
| `has_integrity` | `boolean not null default false` | — |
| `quality` | `text` nullable | CHECK `quality IN ('bas_cout','bon_marche','standard','bonne_qualite','excellente')` |

**Backfill `has_integrity`** (règle par défaut, validée Saar 2026-09-09) :
```sql
UPDATE ref_equipment SET has_integrity = true WHERE
  (family IN ('Armes', 'Protections', 'Équipement informatique et logiciels')
     AND (tech_level IS NULL OR tech_level >= 2))          -- exclut les armes NT I (silex, gourdin…)
  OR (tech_level >= 4 AND family NOT IN
      ('Munitions','Logiciels','Vie quotidienne','Exo-systeme','Exo-arme'));
```
→ armes / armures / ordinateurs NT II+ toujours suivis ; tout objet rare (NT IV+) aussi ; NT I
primitif, consommables, quotidien, logiciels, exo jamais. Le MJ bascule ensuite au cas par cas (cf. L4).
`tech_level` est nullable dans le seed — `NULL` compte comme « pas NT I » pour la branche famille
(une arme sans NT reste une arme), et comme « pas NT IV+ » pour la branche rareté.

**Backfill `quality`** : `bonne_qualite` pour toute ligne `has_integrity` (le RAW indique que les valeurs
d'ITG de référence correspondent à de la « bonne qualité », `MANUEL_USURE.md` §3.1). Le MJ / le
catalogue Marchand affine ensuite.

> Vérifier les `family` réelles avant de figer le `WHERE` (garde `throw` si une famille attendue est
> absente — le seed a évolué). Valeurs observées 2026-09-09 : `Armes`, `Protections`, `Munitions`,
> `Vie quotidienne`, `Equipement Général`, `Exo-systeme`, `Exo-arme`, `Équipement médical`, `Logiciels`,
> `Équipement informatique et logiciels`.

### 2.2 `char_inventory` (+3 colonnes)
| Colonne | Type | Contrainte |
|---|---|---|
| `integrity_current` | `integer` nullable | CHECK `integrity_current >= 0` |
| `integrity_max` | `integer` nullable | CHECK `integrity_max BETWEEN 1 AND 25` |
| `malfunction_severity` | `text` nullable | CHECK `malfunction_severity IN ('simple','critical')` |

Contraintes de cohérence :
- `CHECK ((integrity_current IS NULL) = (integrity_max IS NULL))` — les deux ou aucun.
- `CHECK (integrity_current IS NULL OR integrity_current <= integrity_max)` — jamais au-dessus du max
  (`MANUEL_USURE.md` §3.4).

> **M7 — colonnes dédiées, pas `custom_props` jsonb** : L6 filtre `integrity_current < integrity_max`
> et L4 trie par palier — besoin d'un `WHERE` / index indexable, pas d'un champ JSON.

### 2.3 Réinitialisation des inventaires (décision D1, Saar 2026-09-09)
On est en développement, aucune donnée de production à préserver.

> **M1 — pas dans une migration.** Un `DELETE FROM char_inventory` dans une migration rejouerait sur
> tout déploiement neuf (Kiwi) et son `down()` ne restaurerait rien. → **script one-shot**
> `server/src/scripts/wipe_inventories_for_integrity.js`, lancé **par Saar** une seule fois, après la
> migration de colonnes L0. Il purge aussi `combat_state` de la campagne de test au préalable (sinon
> une arme `SET NULL` en plein combat, cf. FK `combat_actions.weapon_inv_id`).

FK vers `char_inventory` vérifiées (2026-09-09) — le vidage est sûr : `char_inventory_mods` et
`char_inventory_slots` → `ON DELETE CASCADE` ; `combat_actions.weapon_inv_id` /
`.offhand_weapon_inv_id` → `ON DELETE SET NULL`. Aucune autre FK.

Conséquences : aucun backfill d'ITG sur lignes existantes, aucun éclatement de stacks legacy ; les
personnages de test se rééquipent (Wizard / MJ / Marchands), les nouveaux items reçoivent leur ITG par
L3. `AGENTS.md` Clôture / « Données » : à signaler dans le récap de lot.

### 2.4 `merchants` (+1 colonne, décision D2)
`merchants.is_black_market` (`boolean not null default false`). Aucun flag « marché noir » n'existe
aujourd'hui (`merchants`, `tradeService.js`, `TRADE.md` — vérifié). Un Marchand marqué `is_black_market`
vend du **neuf** (ITG courante = ITG max) ; les autres vendent de l'**occasion** (formule de qualité).

---

## 3. L1 — Non-stacking des items `has_integrity`

`server/src/lib/inventoryRules.js` — ajouter, **sans** modifier `isEquippableLocation` (encore utilisé
pour la logique de slot) :
```js
// Un item ne peut partager une ligne (quantity>1) que s'il n'est ni équipable ni soumis à l'ITG.
export function canStack(ref) {
  return !isEquippableLocation(ref?.location ?? null) && !ref?.has_integrity
}
```

Sites à basculer sur `canStack` **au point de décision de fusion de stack uniquement** (garder
`isEquippableLocation` partout ailleurs) :
- `inventoryService.js:~402` (`addItem` — fusion vs insertion) ;
- `inventoryService.js:~719-723` (garde `PUT` inventory : `quantity !== 1` interdit) ;
- `tradeService.js:~205` (achat).

Les `ref` passés à ces sites doivent désormais `SELECT` aussi `has_integrity` (aujourd'hui ils ne
prennent que `location`/`price`/…).

---

## 4. L2 — Primitive ITG partagée (`shared/integrityRules.js`, neuf, pur, testé)

Aucun I/O, aucun jet de dé. Testé par `shared/integrityRules.test.mjs` (patron
`polarisTestResolution.test.mjs`).

| Fonction | Rôle | Renvoie |
|---|---|---|
| `getIntegrityTier(current)` | palier d'état | `{ key, min, max, modifier }` — `key` ∈ `excellent`/`bon`/`moyen`/`usage`/`endommage`/`horsdusage` |
| `getIntegrityModifier(current)` | modificateur de combat/usage (`MANUEL_USURE.md` §3.3) | `+2` / `0` / `-3` / `-5` / `null` (hors d'usage) |
| `QUALITY_TABLE` | `{ key → { itgMax:int, occasionFormula:string } }` (`MANUEL_USURE.md` §3.1) | données statiques |
| `applyTemporaryLoss(current, max, loss)` | applique une perte temporaire + calcule la perte **définitive** de max (`MANUEL_USURE.md` §3.4 : **max des deux pénalités**, palier franchi vs perte ≥ 5, jamais la somme) ; **`newCurrent` inclut le clamp** si le nouveau max passe sous la courante | `{ newCurrent, newMax, definitiveLoss, tiersCrossed }` |
| `applyRepair(current, max, points)` | ajoute des points, plafonné au max | `newCurrent` |
| `interpretPanneOutcome(outcome)` | lit **uniquement** `outcome.isSuccess` et `outcome.catastropheRisk` (jamais `isCriticalSuccess`/`mr` — `MANUEL_USURE.md` §4.1) | `'ok'` / `'simple'` / `'critical'` |

> **G4 — split `shared/` ↔ serveur pour les dés.** `shared/integrityRules.js` est pur : `QUALITY_TABLE`
> fournit la **formule string** (`'2D6+3'`, `'1D4+1'`…). Le rouleur appelle `parseDice`
> (`server/src/lib/diceParser.js`) — `tradeService` / route « Lancer ITG occasion » pour l'occasion,
> `integrityService` pour le `-1D6` d'une panne critique. `applyTemporaryLoss` reçoit un `loss` déjà
> tiré (entier), jamais une formule.

> **M4 — cas de test `applyTemporaryLoss` (à couvrir dans `integrityRules.test.mjs`)** :
> perte < 5 sans franchir de palier (0 définitif) ; perte ≥ 5 sans franchir de palier (−1) ; perte
> franchissant 1 palier avec perte < 5 (−1) ; perte franchissant 2 paliers avec perte ≥ 5 (−2 = max,
> pas −3 = somme — exemple `MANUEL_USURE.md` §3.4) ; perte définitive qui ramène `max` sous `current`
> (clamp de `newCurrent`) ; `-1D6` critique = 6 franchissant un palier (−1 définitif).

Le **jet** de test de panne reste côté serveur (`integrityService.js`) via `resolvePolarisTest(current)`
— qui fait déjà `resolveTestOutcome` + `applyCriticalFailReroll` sur un 20 naturel.

`server/src/lib/integrityService.js` (neuf) — couche jet + mutation + événement :
- `runPanneTest(trx, invRow, { reason })` : `resolvePolarisTest(invRow.integrity_current)` →
  `interpretPanneOutcome` → applique (`-1` simple / `-1D6` critical, via `applyTemporaryLoss`) → set
  `malfunction_severity` → renvoie le détail pour l'événement.
- `applyPanneSystematic(trx, invRow)` : cas ITG ≤ 5 + usage intensif (`MANUEL_USURE.md` §4.2) —
  `malfunction_severity='simple'`, `-1` sans jet.
- `adjustIntegrity(trx, invRow, { current?, max?, malfunction? })` : édition MJ (L4).
- REST et socket appellent **ce service**, jamais `char_inventory` en direct (`core.md` : REST +
  socket partagent le service métier).

> **M5 — concurrence.** Édition MJ de l'ITG + test de panne concurrents (autre onglet, co-MJ, panne
> combat pendant une édition). Chaque écriture d'`integrityService` est gardée : `UPDATE … WHERE
> id = ? AND updated_at = ?` (jeton lu à la lecture), aucune ligne touchée = rejet silencieux —
> patron « corrections de concurrence » du système Blessures (`woundEvolutionService.js`).

---

## 5. L3 — ITG à l'acquisition

### 5.1 Achat chez un Marchand (`tradeService.js`)
Point d'accroche (vérifié 2026-09-09) : `tradeService.js` construit `rows` puis `await
trx('char_inventory').insert(rows)` (~l.200-216), en transaction, `eq` (ligne catalogue) déjà chargé.
Pour chaque `row` où `eq.has_integrity` :
- `integrity_max` ← `QUALITY_TABLE[eq.quality].itgMax` (`eq.quality` défaut `bonne_qualite`) ;
- `integrity_current` ← Marchand `is_black_market = false` (légal) : jet `occasionFormula` via
  `parseDice` (plafonné au max) ; `is_black_market = true` : `= integrity_max` (neuf). (D2, cf. §2.4.)

`eq` doit désormais `SELECT` `has_integrity`, `quality`. La revente PJ→GM (`tradeService`, offres SELL)
ne touche à rien : l'ITG voyage sur la ligne `char_inventory` et disparaît avec elle à la suppression
(pas de restock marchand en V1).

### 5.2 Découverte / don du MJ
Item ajouté par le MJ (`quick-equip`, `POST inventory` GM) : `integrity_max = integrity_current = 15`
par défaut (`MANUEL_USURE.md` §3.2), ajustables (L4).

### 5.3 Bouton « Lancer ITG occasion »
`POST /api/char-sheet/:characterId/inventory/:itemId/roll-integrity` (GM) → jet `occasionFormula` de la
qualité (défaut `2D6+6` si `quality` NULL) → set `integrity_current` (≤ max). Émet `INVENTORY_UPDATED`.

---

## 6. L4 — Interface d'inventaire

`client/src/character/InventoryPanel.jsx` / `InventoryBanner.jsx` (+ `lib/useInventoryData.js`,
`lib/inventoryMutations.js`) :
- Pour chaque item `has_integrity` : **fraction `courante/max`** + **pastille de couleur** du palier
  (`getIntegrityTier`) + tooltip du modificateur (`getIntegrityModifier`). Si `malfunction_severity`
  non NULL : badge « En panne » / « Atelier » **prioritaire** sur la pastille.
- Champs éditables **par le MJ et le propriétaire** (D3) : `integrity_current`, `integrity_max`,
  bascule `malfunction_severity` (`Opérationnel / Réparation simple / Réparation en atelier`).
- Route : étendre le `PUT /api/char-sheet/:characterId/inventory/:itemId` existant (`char-sheet.js`,
  `inventoryService.updateItem`) pour accepter les 3 champs → délègue à `integrityService.adjustIntegrity`.

Classes CSS : réutiliser les badges/pastilles existants (`.badge …`, `index.css`) — ne pas créer de
style inline (`.claude/rules/react.md`). Relire une pastille sœur avant d'écrire du CSS neuf.

---

## 7. L5 — Combat (modificateur + porte de panne + test de panne d'arme)

**Périmètre : humanoïde PJ + PNJ.** Exo/drone = Intégrité propre, hors-scope.

### 7.0 Points d'insertion — vérifiés propres (2026-09-09)

Contrairement à une première lecture, **le rework de dispatch (ROADMAP §5) n'est PAS un prérequis** :
- **Melee** : dispatch **externe** (`socketCombatResolution.js:523-539` : `if drone… else if exo… else
  resolveMeleeAction`). `resolveMeleeAction` ne reçoit que de l'humanoïde — insertion libre.
- **Assault** : **seul le drone** a un redirect interne, et c'est un **early `return` propre**
  (`socketCombatHelpers.js:2364-2366`) ; l'exo est routé **en amont** dans `socketCombatResolution.js`
  (commenté l.2359-2363 : routage interne = import circulaire, écarté). Donc au point d'assemblage des
  `contributions` (l.~2394+), `character.type` est déjà garanti humanoïde — **aucun garde à ajouter**.

Le rework ROADMAP §5 reste souhaitable **pour lui-même** (dette dispatch), mais le coupler à Usure
augmenterait le risque d'Usure (bloquer un modificateur d'une ligne derrière un refactor du code le
plus joué) au lieu de le réduire. → chantier indépendant.

**Chargement de l'arme (G2)** : `resolveMeleeAction` charge via **`getOwnedHandWeapon`**
(`inventoryService.js`) — autorité unique ownership + en-main + catégorie, **réutilisée par la
Déclaration ET la Résolution ET Tir ET CaC**. → étendre `getOwnedHandWeapon` pour retourner
`integrity_current`, `malfunction_severity`, `has_integrity` : sert les 4 sites d'un coup, dont la
garde de déclaration (§7.1.a). `resolveAssaultAction` a son loader propre (join direct,
`socketCombatHelpers.js:~2394`) — à étendre aussi.

### 7.1 Intégration

#### 7.1.a Deux gardes, à la **déclaration** ET à la résolution
`socketCombatAnnouncement.js` (validation de la déclaration — même `getOwnedHandWeapon`) **et** début
de `resolveMeleeAction`/`resolveAssaultAction` :
1. `malfunction_severity` non NULL → action refusée (« arme en panne, réparation requise »).
2. sinon `has_integrity && integrity_current === 0` → refusée (« arme hors d'usage »).

Message système via `system: true` + `i18nKey` (`.claude/rules/i18n.md`), jamais de FR figé serveur.
Côté client : la fenêtre de déclaration désactive/grise l'arme concernée (l'inventaire porte déjà
`malfunction_severity` et `integrity_current`).

#### 7.1.b Modificateur d'attaque
Si `has_integrity && integrity_current >= 1` : `mod = getIntegrityModifier(integrity_current)` →
pousser `{ label: 'État de l'arme', value: mod, type: mod < 0 ? 'malus' : 'bonus' }` dans le tableau
`contributions` (~`socketCombatHelpers.js:1097`), **avant** l'appel au noyau pur `combatAttackRoll`
(qui somme, filtre les zéros, assemble le breakdown affiché). Cumulable avec tout le reste
(`MANUEL_USURE.md` §7.1).

> **G1 — affichage AVANT le jet.** Le serveur ne calcule `contributions` qu'à la résolution ; le
> MANUEL §7.1 veut le modificateur visible dans le récapitulatif de déclaration. → le **client**
> l'affiche, calculé via `shared/integrityRules.getIntegrityModifier(weapon.integrity_current)`
> (module `shared/` importable client, l'inventaire porte `integrity_current`), dans
> `CombatModifiersWindow`. Le serveur reste l'autorité sur la valeur réellement appliquée.

> **M6 — arme en panne + `reload` / `moding`.** `POST /inventory/:itemId/reload` et
> `POST /moding/install` sur une arme `malfunction_severity` non NULL : autorisés (on peut recharger /
> moder une arme enrayée, ça ne la débloque pas) — mais la garde §7.1.a bloque toujours l'**attaque**.
> Décision de cadrage L5, à confirmer en lisant les deux routes.

#### 7.1.c Test de panne d'arme sur échec simple à ITG ≤ 5
Après la résolution du jet d'attaque (`resolveTestOutcome`), si
`!isSuccess && !catastropheRisk && has_integrity && integrity_current ∈ [1,5]` :
`integrityService.runPanneTest(trx, weaponRow, { reason: 'combat_low_itg' })` puis émission du
résultat (réutiliser `DICE_RESULT`, patron `WOUND_INFECTION_ROLL`, `socketDice.js:321`). N'annule pas
l'attaque déjà résolue — la panne prend effet pour la suite. La résolution de combat n'étant pas
enveloppée dans une transaction unique (vérifié : mutations incrémentales + émissions), `runPanneTest`
ouvre sa propre petite transaction ou écrit directement — cohérent avec « la panne est une conséquence
postérieure, elle n'annule rien ».

#### 7.1.d Tests hors combat (`MANUEL_USURE.md` §7.2)
**Aucune automatisation en V1** — le joueur ajoute le malus à la main via le champ « Modificateur ».
L4 rend le palier lisible sur chaque item.

---

## 8. L6 — Réparation complète (le plus gros lot)

Sous-système d'échéance. **Presque tout existe déjà** (G3, vérifié 2026-09-09) :
- `game_echeances.status` CHECK inclut `pending_mj_review` et `awaiting_player_roll` ;
- la transition **`pending_mj_review → awaiting_player_roll` est déjà codée** : route `infection-mode`
  (`campaigns.js:453`) — le MJ choisit un mode, l'échéance passe en attente de jet joueur. Le flux
  réparation est calqué dessus (le MJ approuve → attente de jet), **pas une séquence d'états neuve** ;
- `shared/echeanceTypeRegistry.js` + `echeanceService.js` (`createEcheance` / `resolveEcheanceNow`) ;
- côté joueur : `my-pending-rolls` + `PendingRollsPanel.jsx` (vérifier le dispatch par type — M2).

Ce qui est réellement neuf : la route de création (`repair-request`), la route d'approbation qui peut
**éditer `payload.skillId`** (l'`infection-mode` ne mute pas le payload) + son variant « refuser »,
l'entrée de registre `equipment_repair`, le handler, et l'enrichissement GM (ci-dessous).

### 8.1 Type d'échéance
`shared/echeanceTypeRegistry.js` — nouvelle entrée `{ key: 'equipment_repair', interactive: true, handler }`.

### 8.2 Flux
| Étape | Acteur | Action |
|---|---|---|
| 1 | Joueur | `POST /api/char-sheet/:characterId/inventory/:itemId/repair-request` → `createEcheance` : `condition_type='equipment_repair'`, `status='pending_mj_review'`, `payload:{ itemId, suggestedSkillId, ntMalus }`. Refusé d'emblée si `tech_level >= 7` (non réparable) ou `malfunction_severity='critical'` (atelier, hors V1). |
| 2 | MJ | Panneau de revue → **approuver** (option : changer `payload.skillId`) → `status='awaiting_player_roll'` ; ou **refuser** → `status='cancelled'` (temps/outillage/pièces manquants, `MANUEL_USURE.md` §5.1). |
| 3 | Joueur | Socket `EQUIPMENT_REPAIR_ROLL { echeanceId }` (patron `WOUND_INFECTION_ROLL`, `socketDice.js:283`) → `resolveEcheanceNow` → handler. |
| 4 | handler | `resolvePolarisTest(skillTotal + ntMalus)` — Réussite : `mr` = points d'ITG récupérés (`applyRepair`), efface `malfunction_severity='simple'` ; Échec simple : rien ; **Catastrophe** : `integrity_max -= 1` définitif (`MANUEL_USURE.md` §5.1). |

`ntMalus` : `tech_level >= 6 → -7` ; `>= 5 → -5` ; sinon `0`.

### 8.3 Compétence de réparation suggérée (D4 — [INFÉRÉ], pas une table RAW)
Le RAW liste des **exemples** de compétences de réparation (`REGLE_USURE&INTEGRITE.md` l.165, l.110 :
« Armurerie, Artisanat, Mécanique, Électronique ») mais **aucune table `famille → compétence`**. Le
mapping ci-dessous est une inférence, de toute façon surchargeable par le MJ à l'étape d'approbation :

| `family` | Compétence suggérée |
|---|---|
| `Armes`, `Protections` | `ARMURERIE` |
| `Équipement informatique et logiciels` | `ELECTRONIQUE` (matériel) |
| `Équipement médical`, `Equipement Général`, `Vie quotidienne` | `ART_ARTISANAT` |
| (objet mécanique lourd, véhicule) | `MECANIQUE` |

Table dans `shared/integrityRules.js`. Distincte de la compétence **d'usage**
(`ref_equipment_skill_assoc`) qui sert au bricolage en combat (§10.1-a), pas à la réparation complète.

### 8.4 Enrichissement GM + composants client (D5 — généralisation)

**Serveur** : `getPendingReviewForGm` (`woundReviewService.js`, derrière `GET …/pending-review`)
enrichit aujourd'hui **spécifiquement** avec les données de blessure. → ajouter une **branche
d'enrichissement par `condition_type`** (`equipment_repair` → nom de l'item, `integrity_current/max`,
compétence suggérée), ou déplacer l'enrichissement dans le consommateur de chaque type. À trancher en
lisant `woundReviewService.js`.

**Client GM** : `BlessuresReviewPanel.jsx` (180 l.) est **déjà ~80 % générique** — l'endpoint et le
câblage socket (`onResolved`, `CAMPAIGN_ADVANCE_PENDING`) sont agnostiques ; seuls le titre et les
*rows* (`HealingRow` / `InfectionRow`, dispatch par `e.conditionType`) sont wound-spécifiques. →
**généraliser en place** : `RepairRow` + cas `equipment_repair` au dispatch, titre par section.
Renommage `GmReviewPanel.jsx` optionnel (touche les imports).

**Client joueur** : `PendingRollsPanel.jsx` — vérifier qu'il dispatche par type ou l'étendre (M2).

---

## 9. L7 — Usure manuelle + « Usage intensif »

- **Usure / perte définitive manuelle** : couvert par L4 (champs éditables). Le système ne détecte
  rien automatiquement (`MANUEL_USURE.md` §6).
- **Bouton « Usage intensif »** (GM, sur un item) :
  `POST /api/char-sheet/:characterId/inventory/:itemId/panne-test` →
  `integrity_current <= 5` → `integrityService.applyPanneSystematic` (systématique, sans jet) ;
  sinon → `integrityService.runPanneTest(reason:'intensive')`.

---

## 10. Lot 2 (post-V1)

### 10.1 L8 — « MAIS TU VAS MARCHER » + pièces détachées
Dépend du helper `resolveChanceTest(chc, modificateur)` (`PLAN_CHANCE.md` §2.1) + confirmation RAW de
l'échelle du Test de Chance.
- **a) Bricolage en combat** (`MANUEL_USURE.md` §5.2a) : action de combat, Test de compétence **d'usage**
  (`ref_equipment_skill_assoc`). Débloque `malfunction_severity='simple'`. Durée RAW ambiguë (1D6 Tours
  `REGLE_USURE` l.106 vs 3 Tours `REGLESYSCOMBAT` #2) — à trancher au cadrage. Pas de malus RAW.
- **b) Taper dessus** (`MANUEL_USURE.md` §5.2b) : Test de Chance, malus = pts d'ITG perdus, `-1` ITG
  garanti, marge = tours de fonctionnement.
- **Pièces détachées** (`MANUEL_USURE.md` §9) : Test de Chance sur objet hors d'usage, `-1D6` à la
  source sur réussite.

### 10.2 L9 — entrées #2/#8 de la table CATASTROPHES EN COMBAT
`server/src/lib/catastropheService.js` — peupler `EFFECT_HANDLERS` (aujourd'hui `{}`, « peuplé lot par
lot ») pour les clés `armeInutilisable` (#2) et `panneSysteme` (#8) de `shared/catastropheEffectTable.js`.

**#2 « Arme inutilisable » — événement branché, pas un nombre (D6).** Le RAW
(`REGLESYSCOMBAT.md:721-728`) : *« l'arme tombe au sol (armes blanches), s'enraye (armes à feu), ou se
casse (armes de mauvaise qualité, cordes d'arc/arbalète). Le personnage peut aussi perdre son
bouclier. Note : réparer une arme à feu enrayée est une Action complexe de 3 Tours de combat,
nécessitant un Test réussi avec la Compétence d'arme correspondante. »* Aucun chiffre d'ITG. Le handler
présente **au MJ** les branches ; seules deux touchent le système matériel :
- *s'enraye* → `malfunction_severity = 'simple'` (débloque par le bricolage §10.1-a, 3 Tours, Compétence d'usage) ;
- *se casse* (mauvaise qualité) → destruction ou grosse perte d'ITG, au jugement du MJ.
« Tombe au sol » / « perd son bouclier » sont spatiaux/narratifs — hors système ITG.

**#8 « Panne d'un système ».** Le RAW ne donne qu'une ligne. Handler → `integrityService.runPanneTest`
sur un équipement du personnage choisi par le MJ (ciblage « électronique » automatique : attend
`is_electronic` du `PLAN_INFORMATIQUE`).

Prérequis doc : corriger `COMBAT.md` (« conséquences narratives en permanence » périmé) et
`ROADMAP.md:98`.

> **Écart RAW à tracer dans le MANUEL** : le délai de déblocage d'une arme enrayée diffère selon la
> source — `REGLE_USURE&INTEGRITE.md` l.106 dit « 1D6 Tours pour une arme », `REGLESYSCOMBAT.md` #2 dit
> « Action complexe, 3 Tours ». `MANUEL_USURE.md` §5.2a à préciser (v1.6).

---

## 11. Invariants respectés

| Invariant | Comment |
|---|---|
| #2 pas de 2ᵉ moteur | Le test de panne = `resolvePolarisTest` (moteur unique). Aucun jet maison. |
| #3 une propriété = une autorité | `shared/integrityRules.js` interprète ; serveur autoritaire sur les valeurs ; client affiche. |
| #3 REST + socket = même service | Tout passe par `integrityService.js`. |
| #5 coller au RAW | `MANUEL_USURE.md` est l'autorité de jeu ; écarts déjà écrits (§3.2 marché noir, §3.4 cumul, §4.1 Catastrophe). |
| i18n | Messages serveur `system:true`+`i18nKey` ; textes client via `t()`. |
| migrations | Additives, `IF NOT EXISTS`, backfill par clé métier `name`, `nodemon` applique à l'écriture. |

---

## 12. Ordre d'implémentation recommandé

`L0 → L1 → L2 (+ tests purs) → L4 → L3 → L7 → L5 → L6`
→ **validation V1 en jeu (Saar)** → `L8 / L9`.

Raisons :
- **L2** prouvé pur en premier (tests `node --test`, aucun risque).
- **L4** tôt : rend l'ITG inspectable/éditable manuellement (M3 — L4 n'a besoin que de L0+L2 ; sans L3,
  les champs MJ suffisent à peupler l'ITG pour tester L4/L7).
- **L5 / L6** en dernier (intégration la plus lourde) ; L6 est le plus gros et se valide seul.

Validation proportionnée (`AGENTS.md`) : L0/L1/L2 → `node --check` + `node --test shared/…` ; L3/L4/L7
→ + scénario inventaire ; **L5 → + scénario combat réel PJ/PNJ (Tir et CaC) + `vite build`** ; L6 →
+ cycle réparation complet en navigateur.

---

## 13. Décisions tranchées (Saar, 2026-09-09)

| # | Question | Décision |
|---|---|---|
| **D1** | Backfill ITG des lignes `char_inventory` existantes | **Réinitialisation des inventaires** (dev, aucune donnée à préserver). La migration L0 vide `char_inventory`. Aucun backfill, aucun stack legacy. Voir §2.3. |
| **D2** | Marché légal / marché noir | Nouvelle colonne `merchants.is_black_market` (bool, défaut `false`). Voir §2.4 / §5.1. |
| **D3** | Droits d'édition ITG en inventaire | **MJ et propriétaire**. (Le flux de réparation validé reste la voie normale ; les champs éditables sont un raccourci assumé.) Voir §6. |
| **D4** | Table `family → compétence de réparation` | Mapping [INFÉRÉ] (le RAW ne donne pas de table), MJ-surchargeable. Voir §8.3. |
| **D5** | Panneau de revue MJ dédié ou généralisé | **Généralisé** — `BlessuresReviewPanel` est déjà 80 % générique. Voir §8.4. |
| **D6** | Catastrophe #2 « Arme inutilisable » | Le RAW en fait un **événement branché** (tombe / s'enraye / se casse / perd le bouclier), aucun chiffre d'ITG. Seuls « s'enraye » (`'simple'`) et « se casse » touchent l'ITG. Voir §10.2. |
| **D7** | Événements WS | **Réutiliser** `INVENTORY_UPDATED` (mutation `char_inventory`) et `DICE_RESULT` (jets de panne, patron `WOUND_INFECTION_ROLL`). Pas d'événement dédié tant qu'aucun client n'a besoin de réagir spécifiquement à « une panne » vs « l'inventaire a changé ». |

### Points laissés au cadrage de chaque lot (pas des bloquants)
- Durée du bricolage en combat (1D6 vs 3 Tours — écart RAW, §10.1-a).
- Sélection exacte de l'objet pour l'entrée Catastrophe #8 (§10.2).
- Renommage éventuel `BlessuresReviewPanel` → `GmReviewPanel` (§8.4).

---

## 14. Suites d'analyse à charge (2026-09-09) — intégrées

| Réf | Sujet | Où c'est traité |
|---|---|---|
| **S1** | Première lecture : « redirect interne exo **et** drone → rework dispatch prérequis ». **Corrigé après vérification** : seul le drone a un redirect interne (early `return` propre) ; l'exo est routé en amont. Le rework ROADMAP §5 n'est **pas** un prérequis → « L5-pre » retiré. | §7.0 |
| **G1** | Affichage du modificateur d'ITG côté client avant le jet | §7.1.b (encadré) |
| **G2** | Chargement de l'arme via `getOwnedHandWeapon` (4 sites d'un coup) | §7.1 |
| **G3** | Flux réparation : transition `pending_mj_review → awaiting_player_roll` existe déjà (`infection-mode`) ; `getPendingReviewForGm` à brancher par type | §8 intro, §8.4 |
| **G4** | Split `shared/` (formule string) ↔ serveur (`parseDice`) pour les dés | §4 (encadré) |
| **M1** | Vidage des inventaires = script one-shot, pas une migration ; purger `combat_state` avant | §2.3 |
| **M2** | `PendingRollsPanel` / `my-pending-rolls` : vérifier dispatch par type | §8.4 |
| **M3** | L4 avant L3 : L4 n'a besoin que de L0+L2 | §12 |
| **M4** | Cas de test `applyTemporaryLoss` énumérés | §4 (encadré) |
| **M5** | Concurrence édition MJ / panne → guards optimistes (patron Blessures) | §4 (encadré) |
| **M6** | Arme en panne + `reload`/`moding` : autorisés, l'attaque reste bloquée | §7.1.b (encadré) |
| **M7** | Colonnes dédiées, pas `custom_props` jsonb (L6 filtre `current < max`) | §2.2 (encadré) |

### Vérifié solide (analyse à charge)
`resolvePolarisTest(integrity_current)` correct sur tous les bords ; `contributions` = patron établi ;
hook `tradeService.js:200-216` propre ; 4 FK vers `char_inventory` sûres pour le vidage ; dispatch
melee déjà externe. Aucun mur.
