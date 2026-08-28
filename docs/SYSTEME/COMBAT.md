# SYSTEME/COMBAT.md — Données personnage serveur, calculs combat, state_character
> Audit de compréhension approfondie 2026-08-26 : lu intégralement (1447 lignes) et confronté au code
> réel. Trouvaille principale : § « Rendu 3D combat — Canvas3D » décrivait un rendu par anneaux
> concentriques remplacé depuis le 2026-08-07 par un réticule par case de chemin serveur — corrigé,
> voir la sous-section concernée. Le reste du document (dispatcher combattant, échelle de phases,
> attaques multiples, DSL munitions, tables de résolution) confronté au code par sondage ciblé sans
> autre écart trouvé au-delà des migrations déjà corrigées plus tôt dans la session.
> Source : SYSTEME.md §17
> Lire pour : COMBAT_ACTION_CONFIRM, resolveAssaultAction, charStats.js, state_character
> Règles LdB complètes (actions, déplacements, CaC, tir) : voir `docs/SYSTEME/REGLES_LdB.md`
> Effet mécanique des mods d'armes (Lunette, ATI, Mémoire, Projecteur...) : voir `docs/SYSTEME/MODING.md`

---

## Tables impliquées

| Table | Contenu clé | Lien |
|---|---|---|
| `char_sheet` | `id` UUID, `chc`, `xp_total`, `xp_available` | `character_id → characters.id` |
| `char_attributes` | 8 lignes : `attr_id`, `base_level`, `pc_modifier` | `char_sheet_id` |
| `char_archetype` | `genotype_id` TEXT | `char_sheet_id` |
| `ref_genotypes` | `mod_for`, `mod_con`, `mod_coo`, `mod_ada`, `mod_per`, `mod_int`, `mod_vol`, `mod_pre` | `id` TEXT (ex. `'HUMAIN'`) |
| `char_skills` | `skill_id`, `mastery` INT, `is_learned` BOOL | `char_sheet_id` |
| `ref_skills` | `attr_1`, `attr_2` — attributs liés | `id` TEXT (ex. `'ARMES_POING'`) |

`GET /api/char-sheet/:characterId` retourne `{ sheet, archetype, attributes, skills }` en une requête parallèle (`char-sheet.js` ~ligne 79). **Aucune valeur pré-calculée en DB.** Les totaux sont toujours dérivés à la volée.

---

## Chaîne de calcul — skill total

```
na = calcNA(base_level, pc_modifier, mod_genotype)
   = max(3, base_level + pc_modifier + mod_genotype - TOTAL_MALUS)
   TOTAL_MALUS = 0 (historique XP non implémenté V1)
   Défaut base_level = 7 si null

an = calcAN(na)  ← table AN_TABLE ci-dessous

skillTotal = calcAN(na_attr1) + calcAN(na_attr2) + mastery
           = calcSkillTotal(attrs, charSkillRow, refSkill, genotypeRow)
```

### Table Aptitude Naturelle — AN_TABLE (LdB p.114)

| NA | AN |
|---|---|
| ≤ 3 | -4 |
| 4 | -3 |
| 5 | -2 |
| 6–7 | -1 |
| 8–9 | 0 |
| 10–12 | +1 |
| 13–15 | +2 |
| 16–18 | +3 |
| 19–21 | +4 |
| 22–24 | +5 |
| ≥ 25 | +6 |

## Résolution des Tests — marge/critique/Catastrophe (RAW p.201-205)

Autorité unique : `shared/polarisTestResolution.js` — `resolveTestOutcome(roll, seuil)`.
`combatAttackRoll.js` (combat) et `polarisTestService.js` (Tests génériques, `MACRO_ROLL`,
Blessures) délèguent tous les deux, aucune copie locale de la règle.

- **Marge de réussite** = résultat du dé lu directement (pas `seuil - roll`). **Marge d'échec** =
  `roll - seuil`. Asymétrique, confirmé par le texte RAW (p.203) — ne pas uniformiser les deux formules.
- **Réussite critique** = `roll === seuil`, sauf `seuil >= 20` où seul `roll === 20` compte (p.205).
  Bonus automatique (pas une option MJ) ajouté à la Marge de réussite uniquement, jamais au dé ni à
  `isSuccess` : niveau de maîtrise pour un Test de Compétence, moitié de l'AN (arrondi inférieur) pour
  un Test d'Attribut seul — `getCriticalSuccessBonus`/`applyCriticalSuccessBonus`.
- **Échec critique** = `roll === 20` sur un Test qui peut échouer (`seuil < 20`) — retest immédiat
  (`applyCriticalFailReroll`), cumulé sur la Marge d'échec.
- **Catastrophe** = `catastropheRisk` (Marge d'échec ≥15 en valeur absolue) déclenche en combat un
  **jet 1D10 automatique** sur la table RAW "CATASTROPHES EN COMBAT" (`REGLESYSCOMBAT.md:714-743`,
  p.219-220) — persisté (`pending_catastrophes`), présenté au MJ dans une file de validation
  (`CatastropheReviewQueue.jsx`). **Le jet est automatique, l'application ne l'est jamais** : le MJ
  confirme l'entrée tirée ou reprend la main (override, autre entrée 1-10), puis narre lui-même
  l'effet — aucune des 10 entrées n'est mécanisée (décision Saar 2026-08-06, chantier arrêté après le
  moteur : les conséquences restent narratives en permanence, pas une étape intermédiaire en attente
  d'un Lot 2). Hors combat, `catastropheRisk` reste un simple flag, sans jet ni file — décision MJ pure,
  RAW p.204 encadré "OPTIONNEL". `maybeTriggerCatastrophe`/`catastropheService.js` sont l'autorité
  unique du déclenchement (7 sites combat, `MACRO_ROLL` inclus sous garde combat actif).
- **Degré RAW** (`MR_TABLE`, p.203-204) — modificateur numérique + clé de degré (`getMrModifier`/
  `getMrDegreeKey`), résolue en FR uniquement côté client (`combat.json` §`degree.*`) : tooltip sur les
  badges de résultat (`Sidebar.jsx`).
- **Popup client** Réussite critique/Catastrophe (texte seul v1, `CriticalEffectOverlay.jsx`) —
  déclenché sur `isCriticalSuccess`/`catastropheRisk` (`sessionStore.js`/`useSessionSocket.js`),
  indépendant de la file de validation MJ ci-dessus (l'un informe tous les joueurs, l'autre ne sert
  qu'au MJ pour choisir la conséquence).
- **Exclu structurellement** : Test de Choc (`statusService.js`, deux seuils gradués ok/étourdi/
  inconscient, pas un Test binaire contre un seuil unique) ; `dice_config`/`DICE_ROLL` (jets libres non
  liés à un Seuil).

Historique de conception, audit des sites migrés et décisions détaillées : `docs/Old/PLAN_TEST_CRITIQUE.md`
(marge/critique) et `docs/Old/PLAN_CATASTROPHE_RISK.md` (jet automatique + file de validation MJ).

---

## Contexte de Test d'un combattant — resolveCombatantTestContext

Autorité unique pour résoudre le contexte de Test (Seuil, malus, ModDom) d'un combattant, **quel que
soit son type** : `server/src/lib/combatantContextService.js` —
`resolveCombatantTestContext(db, character, skillId)`. **Jamais** de fetch inline
`char_attributes`/`char_archetype`/`char_skills`/`ref_skills`/`character_wounds`/`char_inventory` →
`calcSkillTotal`/`calcAttributeNA`/`calcActiveMalus` recopié à la main dans un nouveau handler —
historique : cette chaîne a existé 7 fois avec des variations mineures dans `socketCombatHelpers.js`
avant unification (`docs/PLANS/PLAN_COMBATANT_CONTEXT.md`, archivé une fois le chantier clos, Lots A-G).
`socketCombatHelpers.js` n'appelle plus jamais `resolveHumanoidTestContext` directement — toujours ce
dispatcher, y compris pour un `pj`/`pnj` (branche identique à avant, juste indirecte).

Dispatcher, guard clauses (pas de table — 2 branches réelles) :
```js
export async function resolveCombatantTestContext(db, character, skillId) {
  if (character.type === 'exo') return resolveExoTestContext(db, character, skillId)
  return resolveHumanoidTestContext(db, character, skillId)
}
```
**Mis à jour (2026-08-25, `PLAN_EXOARMURE.md` §16.2.1/16.2.2/16.2.5)** — `meleeSkillCap` n'existe
plus, ni en paramètre du dispatcher ni côté appelants (`socketCombatHelpers.js`) : le plafond de
Compétence par Manœuvre d'armure (REGLECOMPETENCE.md:29-34, "Compétence limitative") est désormais
**inconditionnel pour tout `skillId`** côté exo — RAW ne distingue pas Tir/CaC (REGLEARMURE.md:202-207,
"toute autre Compétence servant à accomplir une action physique"), l'ancienne exclusion Tir/Acrobatie
était un bug latent jamais exercé en jeu réel. **Exception** : armures assistées (`exoSheet.category`
∈ `{'exo-alpha', 'exo-0'}`, REGLEARMURE.md "Armures assistées" p.325 — *"on n'utilise pas la
Compétence Manœuvre d'armure"*) ne sont jamais plafonnées, le pilote teste sa Compétence propre. Pour
le reste (`environment` fixe), résout la spécialité RAW depuis `exoSheet.environment` (mapping direct
submarine/surface/atmospheric/spatial ; `industrial` rejeté explicitement, décision Saar 2026-08-15 en
suspens — `resolveManeuverSkillId` lève, capturé en interne, retourne `null`/Test impossible, jamais
une exception qui remonte) puis plafonne `skillTotal` du pilote via `calcLimitedSkillTotal`
(`charStats.js`) — jamais `mastery` (le bonus de Réussite critique reste basé sur la maîtrise réelle).
**Milieu hybride (`environment==='hybrid'`)** : plus de repli automatique (l'ancienne heuristique
"replié sur Armures externes sauf `surface_movement_mode` bloqué" a été retirée le jour de son
introduction, avant tout usage réel — une armure hybride peut couvrir 2 à 4 milieux dans n'importe
quelle combinaison, RAW ne permet aucune déduction générique) : `exo_sheet.active_maneuver_environment`
(migration `313_exo_sheet_active_maneuver_environment.js`, nullable) doit être posé explicitement par
le pilote/MJ, sinon Test impossible. Testé 39/39 (`combatantContextService.test.mjs`) + 336/336 suite
serveur complète contre PostgreSQL réel (2026-08-25), aucune régression.

**Branche humanoïde (`resolveHumanoidTestContext`, `pj`/`pnj` traités identiquement)** — deux paliers
selon `skillId` :
- **`skillId` fourni** (acteur qui teste — attaquant CaC, tireur, défenseur CaC) : palier complet
  `{ skillTotal, effectiveMalus, modDom, for_na, con_na, vol_na, sheetId, mastery }`. Passer une
  chaîne vide `''` (jamais `null`) si le skillId n'est pas encore connu au moment de l'appel (ex.
  arme du catalogue sans `ref_equipment_skill_assoc`) — `null` route vers le palier NA seul
  ci-dessous et perdrait `effectiveMalus`/`for_na` pour un acteur actif.
- **`skillId=null`** (cible passive — ne teste jamais rien, seule sa résistance aux dégâts compte) :
  palier NA seul `{ for_na, con_na, vol_na, sheetId }`, sans fetch Compétence. Délègue en interne à
  `damageService.fetchCibleNA(db, characterId, charSheetId)` — autorité pré-existante (2026-07-30,
  `docs/PLAN_FATIGUE_DOMMAGES.md` §9), ne jamais la réimplémenter ni la contourner.

`null` (la fonction elle-même, pas le palier) si le personnage n'a pas de `char_sheet` — jamais
d'exception, comportement gracieux à gérer par l'appelant (retour anticipé ou repli selon le site).

**Branche exo (`resolveExoTestContext`, Lot G)** — un personnage `type='exo'` n'a jamais de
`char_sheet` propre (il a une `exo_sheet` — c'est un personnage séparé du pilote,
`MANUEL_EXOARMURE.md` §3.1, jamais fusionnés, jamais de stats copiées de l'un vers l'autre) :
1. `exo_sheet.pilot_character_id` → le pilote (`pj`/`pnj`), résolu via `resolveHumanoidTestContext`.
   `null` si aucun pilote assigné.
2. `exo_sheet.template_id` → `ref_exo_templates`, puis `computeExoStats(exoSheet)` (signature à un seul
   paramètre depuis le Lot B — le JOIN vers le template a été retiré, `exo_sheet` porte nativement ses
   propres stats de base, `base_exoforce`/`base_blindage` inclus directement dans la création
   consolidée `44_exo_sheet.js` depuis la refonte migrations 2026-08-22 — corrigé 2026-08-26, "migration
   254" pointait vers `ref_equipment_ammo_compat_foreign_keys.js`, sans rapport)
   (`shared/exoStats.js`, fonction pure, EXF/BLD/RD dérivés des
   paliers d'Intégrité courants, `MANUEL_EXOARMURE.md` §4.8, détail complet `docs/SYSTEME/EXOARMURE.md`).
   `null` si aucun template assigné ("armure non configurée", état valide
   depuis `PLAN_EXOARMURE.md` Lot 1 §6.5) — dans ce cas `resolveExoTestContext` retourne `null` plutôt
   que de laisser passer les stats du pilote sans l'override EXF.
3. Retour = contexte du pilote, avec `for_na`/`modDom` **recalculés** depuis l'EXF (pas simplement
   substitués après coup — `modDom = getModDom(exf)`, sinon la valeur déjà calculée avec la FOR du
   pilote resterait, bug réel trouvé en codant ce lot). `skillTotal`/`con_na`/`vol_na`/`mastery`/
   `sheetId` restent ceux du pilote, inchangés — seule substitution actée à ce jour
   (`MANUEL_EXOARMURE.md` §4.1 : *"La FOR du pilote est ignorée pour les dommages au contact et la
   capacité de port. On utilise l'EXF."*). `calcSkillTotal` recalcule l'Attribut testé directement
   depuis les `char_attributes` bruts du pilote, indépendamment de cette substitution — une Compétence
   qui testerait la FOR utilise donc la FOR *propre* du pilote, jamais l'EXF.

`resolveHumanoidTestContext(db, character, skillId, { forNAOverride })` : le 4ᵉ paramètre (interne,
réservé à `resolveExoTestContext`) porte cette substitution — `undefined` par défaut, aucun changement
pour un appelant humanoïde direct.

**Piège corrigé en codant le Lot G** : `char_sheet_id_cible`/`for_na_cible`/`con_na_cible`/
`vol_na_cible` (consommés par le pipeline de dégâts si l'attaque touche — `resolveTargetHit`/
`applyWound`, distinct du Test de défense lui-même) restent au repli neutre préexistant (8/8/8/`null`)
pour un défenseur `exo`, **jamais** dérivés du pilote : l'armure a son propre pipeline de dégâts
(Intégrité/Avaries/RD fixe par catégorie, `MANUEL_EXOARMURE.md` §4.6-4.7), pas encore construit
(`PLAN_EXOARMURE.md` Lot 4) — les y faire pointer vers le pilote écrirait une Blessure humaine en
contournant complètement l'armure.

**`resolveCombatantIdentity(db, character)`** → `{ sheetId, userId, effectiveType }` — identité de
l'acteur EFFECTIF derrière un combattant, sans le reste du contexte de Test. Pour un humain : ses
propres `sheetId`/`user_id`/`type`. Pour un exo-armure : ceux du **pilote** (jamais `'exo'` comme
`effectiveType` — pas une branche exploitable par un appelant qui dispatche pj/pnj/drone), avec repli
`{ sheetId: null, userId: null, effectiveType: 'pnj' }` si aucun pilote n'est assigné (auto-résolution,
jamais un blocage en attente d'une confirmation qui ne viendrait jamais). Deux usages : (1) savoir
« quelle fiche représente ce combattant » avant même de connaître le `skillId` à tester (ex. défenseur
CaC : la main directrice, lue sur cette fiche, détermine l'arme équipée donc la Compétence à tester —
ordre imposé) ; (2) router la confirmation de défense (`resolveMeleeAction`, ci-dessous) vers le bon
utilisateur et vers la bonne branche pj/pnj. Coût minimal pour un humain (1 requête, identique au fetch
`char_sheet` direct qu'il remplace) ; ne pas l'utiliser quand `skillId` est déjà connu,
`resolveCombatantTestContext` fait tout en un seul appel.

**Routage de la confirmation de défense pour un `type='exo'`** (`PLAN_EXOARMURE.md` Lot 2 §7.7,
2026-08-18) — `resolveMeleeAction` branche sur `defenderEffectiveType` (issu de
`resolveCombatantIdentity`), pas sur `defenderCharacter.type` : un exo piloté par un PNJ s'auto-résout
comme n'importe quel PNJ (`resolveMeleeDefensePnj`, le pilote ne "clique" jamais), un exo piloté par un
PJ prompt CE pilote (`defenderUserId` = `userId` du pilote, jamais le propriétaire brut de la fiche
exo). Les drones restent sur leur propre `defenderCharacter.type` — jamais pilotés, aucune indirection
(§3.5 ci-dessus).

**Hors périmètre de ce point de couture** (`PLAN_EXOARMURE.md`, pas ce fichier) : le comptage
multi-adversaires (`atkEnemyType`/`defEnemyType` traitent tout `exo` comme `'pj'` par défaut de code,
dette `EXOARM-MULTIADV1`, basse priorité) ; le pipeline de dégâts exo en tant que cible (ci-dessus,
Lot 4).

### Résolution d'arme — ownership + en-main + catégorie (MELEE-INHAND/ASSAULT-INHAND-RESOLUTION)

Toute résolution d'un `weaponInvId` reçu du client (Tir ou CaC, arme principale ou secondaire,
Déclaration ou Résolution) passe par `getOwnedHandWeapon(characterId, itemId, { slotCodes, category })`
(`server/src/services/inventoryService.js`) — **jamais** une requête `char_inventory` réécrite à la
main. Avant cette autorité (2026-08-05), 5 réimplémentations SQL divergentes coexistaient (Tir
Déclaration, CaC secondaire Déclaration+Résolution, Tir Résolution) et 2 sites n'avaient aucun
contrôle du tout (CaC principale, Tir Résolution) — cause racine de MELEE-INHAND et
ASSAULT-INHAND-RESOLUTION (`docs/BUGIDENTIFIE.md`).

`slotCodes` n'a pas de défaut implicite : chaque appelant énonce explicitement quels emplacements sont
légitimes pour son cas (`WEAPON_SLOTS` = `MG/MD/2M/Tr` pour une arme principale Tir ; `MG/MD/2M` pour
une arme principale CaC — jamais Tr, un trépied ne se manie pas au corps à corps ; `MG/MD` pour toute
arme secondaire — jamais 2M ni Tr, on ne peut pas tenir une arme à deux mains ou montée dans la main
non directrice). `category` est optionnel : `'Arme de contact'` pour le CaC, absent pour le Tir
(aucun contrôle de catégorie n'existait avant pour le Tir — préservé tel quel, pas une extension de
scope). Retourne `null` si l'objet n'existe pas ou n'appartient pas au personnage (indiscernable,
comme un objet inaccessible) ; sinon l'item complet enrichi de `inHand`/`categoryOk` — l'appelant
choisit s'il distingue les deux dans son message joueur.

---

## Fonctions charStats.js — référence complète

**Règle immuable :** fonctions pures — aucun accès DB. Le caller fournit toutes les données.

### Attributs

| Fonction | Paramètres | Retour | Notes |
|---|---|---|---|
| `calcNA(base_level, pc_modifier, mod_genotype)` | valeurs brutes | NA (entier ≥ 3) | Défaut base_level=7 si null |
| `calcAN(na)` | NA (entier) | AN (entier) | Table AN_TABLE (LdB p.114) |
| `calcAttributeNA(attrs, attrId, genotypeRow)` | données brutes | NA de l'attribut | Plancher 3 |
| `calcAttributeAN(attrs, attrId, genotypeRow)` | données brutes | AN de l'attribut | ≠ calcAttributeNA |
| `getGenotypeModForAttr(genotypeRow, attrId)` | ligne genotype + attrId | modificateur génotype (entier) | 0 si genotype null |

### Compétences

| Fonction | Paramètres | Retour |
|---|---|---|
| `calcSkillTotal(attrs, charSkillRow, refSkill, genotypeRow)` | données brutes | skill total (entier) |

### Attributs secondaires

| Fonction | Paramètres | Retour | Formule |
|---|---|---|---|
| `calcResistanceDommages(for_na, con_na)` | FOR_na + CON_na | RD (entier, peut être positif ou négatif) | Table RD_TABLE (LdB p.114) |
| `calcSeuils(for_na, con_na, vol_na)` | FOR + CON + VOL na | `{ etourdissement, inconscience }` | étourd. = round((F+C+V)/3), inconsc. = étourd.+10 |
| `calcREA(ada_na, per_na)` | ADA_na + PER_na | REA (entier) | round((ada+per)/2) |
| `getModDom(for_na)` | FOR_na | modificateur dommages CaC (entier) | Table MOD_DOM_TABLE (LdB p.113) |
| `calcResistanceNaturelle(result_na)` | NA d'un attribut | résistance naturelle | Table RES_NAT_TABLE (LdB p.114) |
| `calcResistanceDroguesInput(con_na, vol_na)` | CON + VOL na | résistance drogues | round((con+vol)/2) |
| `calcSouffle(con_na, vol_na)` | CON + VOL na | souffle | round((con+vol)/2) |
| `calcAllures(coo_na, athletisme_total)` | COO_na + total compétence Athlétisme | `{ lente, moyenne, rapide, max }` | moy = table COO, max = table Athlétisme ×4 |

### Armures

| Fonction | Paramètres | Retour | Notes |
|---|---|---|---|
| `calcResistanceArmure(equippedItems)` | items filtrés par slot | `{ etq, prt }` (minuscules, null si pas d'armure) | Mille-feuille : max + rest/2 |

### Blessures & encombrement

| Fonction | Paramètres | Retour |
|---|---|---|
| `calcWoundPenalty(wounds)` | tableau `character_wounds` | malus santé (≤ 0, pire seul) |
| `calcEncumbrancePenalty(totalWeight, forValue)` | poids total + FOR nette | malus encombrement (≥ 0) — seuil = FOR×3 |
| `getShockMalus(severity, location, is_lethal)` | gravité + wound_location + flag léthal | malus Test de Choc (≤ 0) |

### XP (Skills)

| Fonction | Paramètres | Retour |
|---|---|---|
| `getCoutAugmentation(currentMastery)` | maîtrise actuelle | coût en PE pour +1 niveau |
| `getCoutDeblocageX()` | — | 3 PE (coût fixe déblocage X) |
| `getCoutTotal(from, to)` | maîtrise départ + cible | coût total PE |

**Table coûts XP :**
```
Maîtrise cible 1–5 : 1 PE/niveau
Maîtrise cible 6–10 : 2 PE/niveau
Maîtrise cible 11 : 3 PE
Maîtrise cible 12 : 5 PE
Maîtrise cible 13 : 7 PE
Maîtrise cible 14 : 9 PE
Maîtrise cible 15 : 11 PE
```

---

## Compétences réservées (X) — accessibilité (P55)

`calcSkillCost` (`shared/polarisUtils.js`) bloque (`cost: Infinity`) toute compétence marquée `(X)` si
`!isLearned && target > 0`. `isLearned` doit couvrir **trois** cas, tous confirmés par la règle LdB
(`docs/REGLES/REGLECOMPETENCE.md` — « on ne peut apprendre une telle Compétence que par le biais d'une
Profession... ou d'une Formation ») :
1. `openedSkills.includes(skillId)` — déblocage explicite (Avantage Formation).
2. `(baseMastery[skillId] ?? 0) > 0` — un bonus d'origine positif prouve que le personnage la pratique déjà.
3. `isPro` — listée par une carrière retenue.

Oublier le cas (3) reproduit le bug Session 139 (Lot 2) : une `(X)` professionnelle sans bonus d'origine
plante en `-Infinity`. Le malus « base -3 » du premier point investi s'applique quand même dans les
trois cas — ce n'est pas un blocage, juste un coût de départ plus élevé (1pt pour atteindre -3, avant de
grimper normalement).

**Piège wiring associé** : `computeSkillAllocation` (`shared/careerSkills.js`) ne doit recevoir QUE les
`skill_id` réellement modifiés par le joueur — jamais un remplissage de toutes les compétences affichées
avec leur valeur de base, sinon le calcul est déclenché inutilement pour des compétences jamais touchées.
Le plafond d'une ligne non touchée se calcule séparément via `getSkillCap(skillId, ctx)`.

---

## Données nécessaires par rôle en combat

> Vue conceptuelle des données par rôle — l'implémentation réelle passe par `resolveCombatantTestContext`
> (Tireur/Défenseur, section ci-dessus) et `damageService.fetchCibleNA` (Cible), jamais un fetch ad hoc.

**Tireur :**
- `char_attributes` + `char_archetype → ref_genotypes` → pour `calcSkillTotal`
- Compétence arme :
  `weapon_inv_id → char_inventory.equipment_id → ref_equipment_skill_assoc WHERE item_id = equipment_id → skill_id`
  → `char_skills WHERE { char_sheet_id, skill_id }` + `ref_skills WHERE id = skill_id`
  **ATTENTION : `ref_equipment_skill_assoc.item_id` est FK vers `ref_equipment.id`, pas `char_inventory.id`**
- `char_inventory` :
  - arme snapshot (`ref_damage_h`, `ref_range`)
  - **TOUS les items `container != 'Coffre'`** → `totalWeight` pour `calcEncumbrancePenalty` (fetch séparé)
- `character_wounds` → pour `calcWoundPenalty`
- `combat_roster.state_vitesse === 'rushed'` pour le malus −5 Compétence — corrigé 2026-08-26, cette
  ligne citait encore `state_character.is_rushed`, contredisant §"state_character JSONB" du même
  document (`is_rushed` migré vers `state_vitesse`, voir plus bas)
  **PC28 :** lire l'état depuis `combat_roster`, jamais depuis `combat_actions` — les actions ne portent pas l'état courant du slot

**Cible :**
- `char_sheet WHERE character_id = X` → `char_sheet_id` (pour `resolveWoundInsertion`)
- `char_attributes` + `char_archetype → ref_genotypes` → FOR_na, CON_na, **VOL_na** → `calcResistanceDommages` + `calcSeuils`
- `char_inventory` (armures équipées, filtrées slot = localisation touchée) → pour `calcResistanceArmure`

---

## Mapping slotCode → wound_location (armorConstants.js)

`LOCATION_TO_SLOT` (existant) : `'tete' → 'T'`, `'bras_droit' → 'BD'`, etc.
`SLOT_TO_WOUND_LOCATION` (**déjà exporté** dans `armorConstants.js`) : sens inverse — `'T' → 'tete'`, `'BD' → 'bras_droit'`, etc.
Utilisé dans `COMBAT_ACTION_CONFIRM` pour convertir le slotCode issu du jet de localisation vers le format attendu par `resolveWoundInsertion` + `isShockTestRequired`.

---

## Colonnes état combat_roster — Persistance

Cinq colonnes TEXT enum sur `combat_roster`, toutes NOT NULL avec DEFAULT.

**Corrigé (audit 2026-08-26)** : les 5 colonnes sont créées directement dans `32_combat_roster.js`
(pas de migrations 56/58 séparées, réattribuées depuis à `ref_career_equipment.js`/
`ref_career_point_categories.js`) ; la contrainte `kneeling` vit dans `129_combat_roster_constraints.js`
(pas "migration 231", réattribuée à `drone_programs_foreign_keys.js`).

| Colonne | Migration | CHECK values | Default | Persistance | Reset endTurn |
|---|---|---|---|---|---|
| `state_position` | `32` (création), `129` (CHECK incl. `kneeling`) | `'standing'\|'crouching'\|'kneeling'\|'prone'` | `'standing'` | **combat** | inchangé (corrigé, voir note) |
| `state_weapon` | `32` | `'holstered'\|'ready'\|'drawn'` | `'holstered'` | **combat** | inchangé |
| `state_fire_mode` | `32` | `'cc'\|'rc'\|'rl'` | `'cc'` | **combat** | inchangé |
| `state_cover` | `32` | `'exposed'\|'partial'\|'important'` | `'exposed'` | **par tour** | → `'exposed'` |
| `state_vitesse` | `32` | `'normal'\|'delayed'\|'rushed'` | `'normal'` | **par tour** | → `'normal'` |

**Règle :** `state_position`, `state_weapon` et `state_fire_mode` survivent entre les tours (posture
réelle du personnage — changer de position a un coût d'Initiative dédié, REGLESYSCOMBAT.md, qui n'a de
sens que si la position obtenue persiste). `state_cover`, `state_vitesse` se réinitialisent à chaque
nouveau tour.

> **Correctif `state_position` (2026-08, `docs/PLANS/PLAN_CHARACTER_STATES.md` Lot 2b)** :
> `state_position` était à tort reset à `'standing'` dans `endTurn()` — corrigé. **Autorité du broadcast
> client** (ce que voit le joueur/MJ) déplacée vers une table dédiée `character_states`
> (`server/src/lib/characterStateService.js`), ancrée sur `token_id`. `combat_roster.state_position`/
> `state_weapon` restent la colonne écrite et restent l'autorité lue directement par
> `socketCombatAnnouncement.js` (`entry`, coût d'Initiative + validation Tir Visé) — leur retrait est
> différé (Lot 2c, `PLAN_CHARACTER_STATES.md` §3), pas encore fait.
>
> **`kneeling` — 4ᵉ position (2026-08, `docs/Old/PLAN_KNEELING_POSITION.md`, archivé)** : « à genou »
> (REGLESYSCOMBAT.md:929-930) manquait au code depuis toujours. Catalogue ajouté Lot 0 de
> `PLAN_CHARACTER_STATES.md`, réellement jouable depuis ce chantier — contrainte `chk_state_position`
> (`129_combat_roster_constraints.js`, corrigé 2026-08-26 : pas "migration 231", réattribuée depuis à
> `drone_programs_foreign_keys.js`), `VALID_POS` (`socketCombatState.js`, état initial) et `VALID_STATES.position`
> (`socketCombatAnnouncement.js:79`, déclaration de tour — deux verrous distincts, tous les deux
> corrigés). Coût d'Initiative : le LdB ne nomme aucune valeur pour `kneeling` — décision Saar, alias
> exact de `crouching` sur toute paire vers/depuis `standing`/`prone` ; transition directe
> `crouching↔kneeling` gratuite (postures mécaniquement équivalentes partout ailleurs dans le système).

**Labels UI (français) :**
- `state_position` : `'standing'`→ Debout, `'crouching'`→ Accroupi, `'kneeling'`→ À genou, `'prone'`→ Couché
- `state_weapon` : `'holstered'`→ Rangée, `'ready'`→ Main sur l'arme, `'drawn'`→ Au clair
- `state_fire_mode` : `'cc'`→ Coup par coup, `'rc'`→ Rafale courte, `'rl'`→ Rafale longue
- `state_cover` : `'exposed'`→ Découvert, `'partial'`→ Partielle (50%), `'important'`→ Importante (75%)
- `state_vitesse` : `'normal'`→ Normale, `'delayed'`→ Retardée, `'rushed'`→ Précipitée

**Matrices de transition INI :**
```
POSITION (autorité unique : shared/combatStatePositionCost.js, docs/Old/PLAN_KNEELING_POSITION.md) :
  standing  → { crouching: -3, kneeling: -3, prone: -5 }
  crouching → { standing:  -3, kneeling:  0, prone: -5 }
  kneeling  → { standing:  -3, crouching:  0, prone: -5 }  // alias crouching, sauf crouching↔kneeling (gratuit)
  prone     → { standing: -10, crouching: -10, kneeling: -10 }

WEAPON:
  holstered → { ready: -3, drawn: -5 }
  ready     → { holstered: -5, drawn: -3 }
  drawn     → { holstered: -10, ready: -3 }

FIRE_MODE: tout changement → -3

COVER: aucun coût INI (flag défensif pur, affecte les tireurs adverses en Phase 2)

VITESSE:
  delayed  → 0 (ordre spécial : résolution en fin de round)
  normal   → 0
  rushed   → +3 INI / −5 Modificateur de Compétence en Phase 2
```

**Effets Phase 2 :**
- `state_vitesse = 'rushed'` : +3 CDR à la déclaration, −5 à tous les tests d'action en résolution
- `state_vitesse = 'delayed'` : pas de modification INI, mais l'acteur est repoussé en fin d'ordre de résolution (logique custom endTurn V2)
- `state_cover != 'exposed'` : modificateur défensif appliqué aux jets des tireurs adverses (table COUVERTURES dans CombatModifiersWindow)

---

## state_character JSONB — combat_roster (corrigé 2026-08-26 : créé directement dans `32_combat_roster.js`, pas "migration 57" — ce numéro pointe aujourd'hui vers `ref_career_equipment.js`, sans rapport)

Colonne `JSONB NOT NULL DEFAULT '{}'` sur `combat_roster`. Flags booléens combinables pour statuts volatils.

**Flags définis :**
| Flag | Per-turn | Effet | Settable | Enforced |
|---|---|---|---|---|
| `is_stunned` | non (persistant) | −5 actions, allure moyenne max, ne peut pas attaquer | ✅ session 66 | ❌ sprint futur |
| `is_rooted` | non | déplacement impossible | ❌ | ❌ |

⚠️ **`is_rushed` supprimé** — migré vers `state_vitesse = 'rushed'` (colonne créée directement dans `32_combat_roster.js` depuis la refonte migrations, corrigé 2026-08-26 — "migration 58" pointe aujourd'hui vers `ref_career_point_categories.js`, sans rapport). Toute lecture `state_character?.is_rushed` → remplacer par `rosterEntry.state_vitesse === 'rushed'`.

**PC39 — Règles obligatoires :**
- Clé absente = `false`. **Ne jamais stocker `false` explicitement.**
- Merge : `db.raw('state_character || ?::jsonb', [JSON.stringify({ is_stunned: true })])`
- Suppression flag : `db.raw("state_character - 'is_stunned'")`
- **Jamais** `UPDATE SET state_character = '{"is_stunned":true}'` — écrase tous les autres flags.

**PC42 — `is_stunned` : enforced ✅ (PC42 réglé)**

`is_stunned` est posé automatiquement dans `state_character` après un Test de Choc (outcome `etourdi` ou `inconscient`) via `applyStunWithDuration` (helper dédié, `stunned_until_turn` stocké en JSONB).

**Enforcement dans `COMBAT_ACTION_DECLARE` (lignes 1928-1943) ✅ :**
- interdit `mapActions.attack` (assaut distance)
- interdit `mapActions.melee` (CaC)
- interdit `move_rapide` et `move_max`

**Purge / cycle de vie `is_stunned` :**
- Purge automatique dans `endTurn` quand `expires_at_turn <= current_turn` (`token_statuses`) → efface `is_stunned` + `stunned_until_turn` du JSONB + retire badge, émet `COMBAT_STUN_EXPIRED`.
- `COMBAT_APPLY_STUN` : handler GM pour application manuelle avec durée.

**`is_surprised` — lifecycle absent ⚠️**
- Colonne directe sur `combat_roster` (PAS dans `state_character` JSONB).
- Posée à COMBAT_START. **Jamais effacée** (`endTurn` ne la reset pas).
- Conséquence : si utilisée comme condition gameplay (ex. bypass défense), elle s'appliquerait tous les tours — incorrect pour une surprise premier tour uniquement.
- Fix requis : purge dans `endTurn` OU migration vers `token_statuses` avec `expires_at_turn`. Voir **PLAN 14** dans ROADMAP.md.

**Mots-clés :** `is_stunned`, `stunned`, `étourdi`, `inconscient`, `Test de Choc`, `shockResult`, `purge`, `clear`, `lifecycle`, `COMBAT_END`, `enforcement`, `COMBAT_ACTION_DECLARE`.

**endTurn :** reset colonnes per-turn + nettoyage JSONB :
```js
await db('combat_roster').where({ campaign_id, status: 'active' }).update({
  state_cover:    'exposed',
  state_vitesse:  'normal',
  // state_position, state_weapon, state_fire_mode : inchangés (persistent — voir note Lot 2b ci-dessus)
  // state_character : pas de flags per-turn définis en V1 — is_stunned persiste intentionnellement
})
```

---

## Transitions de phase — payloads WS

### COMBAT_PHASE_CHANGED — payloads selon la transition
```javascript
// ROSTER → ANNOUNCEMENT (COMBAT_ANNOUNCE_START)
{ phase: 'ANNOUNCEMENT' }  // pas de roster

// ANNOUNCEMENT → RESOLUTION (startResolutionPhase, auto quand tous déclarés)
{ phase: 'RESOLUTION', roster: RosterEntry[], actions: CombatAction[] }
// suivi immédiatement de COMBAT_TIMELINE_UPDATED (échelle de phases, cf. section dédiée ci-dessous) —
// COMBAT_SLOT_ADVANCED n'est plus émis à ce stade depuis la refonte Session 159.

// RESOLUTION → ANNOUNCEMENT (endTurn, échelle du Tour intégralement résolue)
{ phase: 'ANNOUNCEMENT', roster: RosterEntry[] }
```

### COMBAT_SLOT_ADVANCED payload — ANNOUNCEMENT uniquement
```javascript
{ activeSlotIdx: number, tokenId: string }
// Émis par : skipPlayer (phase ANNOUNCEMENT). Ne concerne jamais la RÉSOLUTION depuis la refonte
// Session 159 (échelle de phases, `combat_timeline_entries`) — la colonne `active_slot_idx` et la
// fonction `advanceSlot` ont été retirées (Session 159 — corrigé 2026-08-26 : la refonte migrations
// 2026-08-22 a recréé combat_state sans jamais réintroduire active_slot_idx, ce n'est pas une colonne
// retirée par un numéro de migration précis ; "migration 174" pointe aujourd'hui vers
// ref_mutations_constraints.js, sans rapport).
```

### endTurn — comportement serveur
```javascript
// 1. Reset roster (toutes les entrées status='active') :
await db('combat_roster').where({ campaign_id, status: 'active' }).update({
  has_announced:     false,
  has_resolved:      false,
  state_cover:       'exposed',    // per-turn
  state_vitesse:     'normal',     // per-turn (remplace l'ancien flag is_rushed dans state_character — colonne créée directement dans 32_combat_roster.js, corrigé 2026-08-26)
  state_combat_mode: 'normal',     // per-turn
  // state_position, state_weapon, state_fire_mode : inchangés (persistent combat — voir note Lot 2b ci-dessus)
  // state_character : is_stunned persiste intentionnellement (non per-turn)
})
// 2. combat_actions N'EST PLUS vidée (Session 159, §6bis point 5 du plan archivé) — chaque ligne porte
//    turn_number, la file « en cours » se filtre dessus ; suppression réelle seulement à COMBAT_START.
// 3. Incrémenter current_turn, sub_phase → null, phase='ANNOUNCEMENT'
// 4. Broadcast COMBAT_PHASE_CHANGED { phase: 'ANNOUNCEMENT', roster }
// 5. Émettre COMBAT_SLOT_ADVANCED { activeSlotIdx:0, tokenId: firstAnnounceSlot }
// 6. Relancer les timers auto-skip (startAnnouncementTimers)
```

---

## COMBAT_START / COMBAT_ANNOUNCE_START

```javascript
// COMBAT_START (GM → serveur)
socket.emit(WS.COMBAT_START, {
  battlemap_id: battlemapId,
  surprisedTokenIds: string[],   // tokenIds marqués surpris dans le roster
  excludedTokenIds: string[],    // tokenIds exclus du combat
})

// COMBAT_ANNOUNCE_START (GM → serveur, no payload)
socket.emit(WS.COMBAT_ANNOUNCE_START)

// Endpoint INI preview (avant COMBAT_START) :
GET /battlemaps/:battlemapId/combat-ini → { iniPreview: [{ token_id, base_ini }] }
```

### Logique COMBAT_START (serveur)

- **base_ini** = `calcREA(ada_na, per_na)` = `round((ADA + PER) / 2)`
- **Égalité d'initiative** → `Math.random()` (LdB : simultanéité)
- **PNJ surpris** → jet auto serveur `Math.ceil(Math.random() * 20)` ; initiative = `base_ini + roll`
- **PJ surpris** → `COMBAT_SURPRISE_ROLL` émis au socket joueur ; le joueur lance lui-même puis émet `COMBAT_SURPRISE_RESULT`
- **PC25** : `surprise_roll` n'est **jamais** dans le broadcast `COMBAT_STARTED` (roster sans ce champ)
- **Entités** (token sans `character_id`) → ignorées, jamais insérées en `combat_roster`
- **combat_state** insérée : `{ campaign_id, battlemap_id, phase: 'ROSTER', current_turn: 1, action_timer_sec: 0 }`
  (colonne `active_slot_idx` retirée à la refonte migrations 2026-08-22 (Session 159), pas par un
  numéro de migration précis — corrigé 2026-08-26 ; `sub_phase` nullable, non posé ici)

---

## Échelle de phases (Résolution) — combat_timeline_entries (Session 159)

Remplace le parcours `combat_roster` trié par `active_slot_idx` (retiré à la refonte migrations
2026-08-22, pas un numéro de migration précis — corrigé 2026-08-26). La Résolution
avance entrée par entrée sur une échelle de phases réelle (LdB p.212-219), pas une liste de personnages
parcourue une fois — un personnage avec une série d'attaques multiples occupe plusieurs entrées
entrelacées avec les autres, pas un bloc résolu d'un coup.

### Table `combat_timeline_entries`
```javascript
{
  id,
  campaign_id,
  turn_number,             // filtre la file « en cours » (historique conservé jusqu'à COMBAT_START)
  token_id,
  combat_action_id,        // FK combat_actions — jamais de duplication des données de l'action
  declaration_group_id,    // regroupe une série d'attaques multiples déclarée ensemble (recalcul du malus)
  phase_position,          // null tant que non positionnée (Retarder en attente) ; ×100 vs Initiative brute
  status,                  // 'delayed_waiting' | 'scheduled' | 'resolved' | 'lost' | 'skipped'
  resolved_at,
  resolution_snapshot,     // trace durable de ce qui a changé à la résolution
}
```
Une seule entrée par action complexe déclarée (`assault`/`melee`) — `move`/`reload`/`micro`/`skip` n'en
génèrent jamais, résolues via `combat_roster.has_resolved` au passage du premier pas du token ce Tour.

### Moteur — `pickNextTimelineStep` / `advanceTimeline` (`socketCombatHelpers.js`)
`pickNextTimelineStep(campaignId, turnNumber)` fusionne deux sources triées par position DESC : entrées
`scheduled` + membres du roster sans aucune entrée ce Tour (`has_resolved=false`). Retourne
`{kind:'entry', tokenId, entry, position}` | `{kind:'simple', tokenId, position}` | `null`.
`advanceTimeline(io, campaignId, pendingMaps)` — seul point d'entrée « fais avancer la résolution » :
présente le pas suivant (`sub_phase='SLOT_ACTIVE'`), ou le tour obligatoire s'il ne reste que des
personnages en délai (`{kind:'delayed_turn', tokenId, groupId}`), ou appelle `endTurn` si l'échelle est
intégralement résolue.

### Retarder son Action / Agir maintenant — RAW `docs/REGLES/REGLESYSCOMBAT.md:554-567`
Aucun minuteur (retiré Session 159 après 3 bugs réels causés par un sous-état FSM temporisé
`AWAITING_REACTION_WINDOW` — cf. `docs/EN_COURS.md` Item 88 pour l'historique). Règle unique :
- `state_vitesse='delayed'` à la déclaration → l'entrée est créée `phase_position:null`,
  `status:'delayed_waiting'`.
- `COMBAT_ACT_NOW` (`triggerActNow`) repositionne **toute** la série `delayed_waiting` du token
  au-dessus du pas normal courant (`referencePosition + 100 + initiative` — priorité RAW à Initiative
  égale/dépassée) — **valide à tout moment de `sub_phase='SLOT_ACTIVE'`, mais seulement une fois que le
  pas normal courant a atteint (ou dépassé) la propre phase d'Initiative d'origine du personnage**
  (`referenceStep.position <= rosterEntry.initiative * 100`, sinon rejet `'too_early'` avec message
  explicite) — un personnage retardé ne peut jamais agir plus tôt que sa propre Initiative, seulement
  plus tard (sinon ce serait Précipiter). Bloqué aussi si le pas courant est déjà en cours de résolution
  (`AWAITING_DEFENSE`/`AWAITING_DAMAGE`, dés déjà lancés).
- **Tour obligatoire de fin de Tour** (§6 point 2 du plan archivé) : une fois plus aucun pas normal,
  les personnages encore `delayed_waiting` sont présentés un par un, ordre croissant d'Initiative (le
  plus lent en premier) — réponse explicite requise, `COMBAT_ACT_NOW` ou `COMBAT_DELAYED_PASS`
  (`status:'skipped'`), jamais d'expiration silencieuse.
- **Précipiter son Action** (`vitesse='rushed'`, +3 Initiative / -5 Action) réutilise le mécanisme
  `iniDelta` préexistant (`combat_roster.initiative` ajusté à la déclaration, avant construction de
  l'échelle) — aucune construction dédiée, l'échelle en hérite via la position de base. RAW : une action
  précipitée ne peut jamais être retardée (guard à la déclaration).
- **CaC et Tir mutuellement exclusifs à la déclaration** (RAW « Types d'Actions », une seule Action de
  combat par Tour) — guard client (toggle) + serveur (`COMBAT_ACTION_DECLARE`).

### `COMBAT_TIMELINE_UPDATED` — payload (broadcast à chaque changement de l'échelle)
```javascript
{
  turnNumber,
  entries: TimelineEntry[],    // toutes les entrées du Tour en cours, triées phase_position DESC
  currentStep,                 // { kind:'entry'|'simple'|'delayed_turn', tokenId, ... } | null
  subPhase,                    // 'SLOT_ACTIVE' | 'AWAITING_DEFENSE' | 'AWAITING_DAMAGE' | null
}
```
`subPhase` est le seul canal qui pousse `combat_state.sub_phase` aux clients en jeu normal (aucun autre
événement ne le fait hors reconnexion, `COMBAT_STATE_SYNC`) — omettre ce champ dans un futur broadcast
casse silencieusement toute UI qui en dépend (piège réel rencontré Session 159).

### Lot D — outil MJ générique « Forcer » (`COMBAT_SKIP_PLAYER` en phase RESOLUTION)
Généralise le bouton déjà existant en ANNOUNCEMENT (`skipPlayer`) — même événement, comportement décidé
par `forceAdvanceResolution` selon `sub_phase` : `AWAITING_DEFENSE`/`AWAITING_DAMAGE` → le serveur lance
les dés à la place du joueur injoignable (réutilise `confirmMeleeDefense`/`confirmDamage`, `forced:true`,
identité affichée = celle du personnage, pas du MJ) ; `SLOT_ACTIVE` au tour obligatoire → équivaut à
`COMBAT_DELAYED_PASS` ; `SLOT_ACTIVE` sur un pas normal bloqué → marqué `skipped`, l'échelle avance.

---

## Découpage socketCombatHelpers.js — noyau pur / coquille (PLAN_RW_SYSCOMBAT.md, clos 2026-08-23)

Le calcul du jet d'attaque et du dégât brut (CaC + Tir) est extrait en noyau pur,
`server/src/lib/combatAttackRoll.js` — aucun accès DB/IO, jet de dé toujours passé en paramètre
(jamais lancé dans le noyau) :

```javascript
computeAttackRoll({ skillLabel, skillTotal, contributions, totalLabel, rollAttaque })
// contributions = [{ label, value, type }] assemblée par l'appelant (pattern "liste de contributions",
// même principe que le StatisticModifier de foundryvtt/pf2e) — un nouveau modificateur de jeu = une
// entrée ajoutée par l'appelant, jamais une modification de signature. Retourne
// { seuil, breakdown, isSuccess, mr }.

computeMeleeRawDamage({ rawDice, mr, modDom, combatModeBonus })
computeAssaultRawDamage({ rawDice, mr, portee, fireModeBonusDmg })
// Dégât brut CaC / Tir, dédupliqués — chacun était recalculé inline à plusieurs endroits avant ce
// chantier.
```

`socketCombatHelpers.js` reste la coquille : résolution arme/portée/LOS, accès DB, branchement par
type de combattant (PJ/PNJ/drone/exo), construction des payloads WS, logs `[DBG]`. Fonctions
principales — rôle inchangé, assemblent désormais les `contributions` passées au noyau :
- `resolveMeleeAction` / `resolveAssaultAction` — attaque CaC / Tir, branchement défenseur
- `resolveDroneAssaultAction` — même flux, branchement cible drone/non-drone
- `resolveExoAssaultAction` / `resolveExoMeleeAction` (`socketCombatExo.js`, module séparé — évite un
  import circulaire avec les helpers ci-dessus qu'il réutilise) — attaquant exo-armure, dispatché
  depuis `socketCombatResolution.js` par `character.type`, jamais un branchement interne aux
  résolveurs humains. Mécanique complète (arme/mode de tir/munitions/Initiative pilote) :
  `docs/SYSTEME/EXOARMURE.md` §5, pas dupliquée ici.
- `confirmMeleeDefense` — confirmation défenseur, branchement post-hit attaquant PJ/PNJ
- `confirmDamage` — confirmation dégâts (file FIFO partagée CaC/Tir), branchement drone/non-drone

Tables de valeurs partagées client/serveur (`shared/combatSituationMods.js`) : `RANGED_SITUATION_MODS`,
`CAC_SITUATION_MODS`, `TAILLE_MODS`, `PORTEE_MOD_COMP` — plus de copie locale dupliquée côté client,
une correction de valeur (errata LdB) devient un seul edit.

---

## Attaques multiples — CaC 4b et Tir Multi (Session 165)

RAW générique (LdB p.218-219, `docs/REGLES/REGLESYSCOMBAT.md:604-618`) : un personnage peut effectuer
jusqu'à 3 Attaques par Tour, malus -5 (2 attaques) ou -7 (3 attaques) à **toutes** les Attaques du Tour,
décalage de phase -5/-10 par attaque supplémentaire (seul coût RAW chiffré — pas de forfait Initiative de
déclaration séparé). Cibles distinctes non exigées par le texte. **Deux implémentations de la même
mécanique**, qui partagent désormais toute leur infrastructure (groupement d'échelle, calcul du malus) :
CaC 4b (`resolveMeleeAction`, en production depuis la Session 74) et Tir Multi (`resolveAssaultAction`,
Tir simple/Tir à répétition CC uniquement, PJ/PNJ humanoïde, jamais RC/RL ni tireur-drone — RAW muet sur
ces cas, exclu par défaut). CaC et Tir restent mutuellement exclusifs à la déclaration (une seule Action
de combat par Tour, cf. ci-dessus) — jamais les deux compteurs cumulés dans le même Tour.

**Déclaration** — `mapActions.attack` est un array (1 à 3 éléments), même contrat que `mapActions.melee` :
une seule arme pour toute la série (pas de changement d'arme entre deux tirs), cible par défaut identique
sur toute la série au premier choix (UX : un seul clic remplit les N slots, "Changer" par tir pour
diverger). Exclusifs avec Tir Multi dès que la série dépasse 1 tir (forcés à leur valeur neutre côté
serveur, jamais confiance au seul masquage UI) : Tir visé, Tir à deux armes, Viser une Localisation
précise — chacun exigerait soit l'exclusivité totale du Tour (Tir visé), soit dépasserait le plafond RAW
de 3 Attaques (dual-wield doublerait les Tests), soit n'a simplement pas de sens à varier par tir (D9/D10,
tranchés Saar). `socketCombatAnnouncement.js` : cap serveur à 3 (jamais eu d'équivalent côté CaC — dette
pré-existante, pas répliquée), munitions vérifiées sur le total de la série (`bulletCount × longueur`),
deux messages d'erreur distincts (`shared/ammoRules.js::parseAmmoCapacity`) : « Action impossible — la
capacité du chargeur ne permet pas ce tir » si la capacité MAX du chargeur ne suffirait même pas une fois
plein, « Munitions insuffisantes, recharger d'abord » sinon.

**Échelle de phases** — `buildTimelineEntries` groupe par `(token_id, type)` : CaC et Tir Multi partagent
la même fonction de groupement/étalement (`declaration_group_id` commun, positions étalées de 500 en 500
via `computeSeriesPositions`) — une seule implémentation, jamais deux copies divergentes.

**Résolution** — `computeMultiAttackMalus(actionId)` (fonction partagée) recompte les sœurs vivantes du
même `declaration_group_id` (une sœur `'lost'`/`'skipped'` ne compte plus) et retourne le malus RAW
(-5/-7). Câblée dans `resolveMeleeAction` (CaC, comportement inchangé) et `resolveAssaultAction` (Tir
Multi, nouveau — ligne de breakdown `'Attaque multiple'`, même patron que le CaC).

**Chaînage des dégâts** — aucune récursion : chaque tir de la série est sa propre `combat_timeline_entries`,
résolue individuellement par `advanceTimeline()`, potentiellement entrelacée avec d'autres combattants.
Un tireur PJ qui touche pose `AWAITING_DAMAGE` (sous-état FSM bloquant) et **suspend** la résolution
(`suspend:true` — comme `AWAITING_DEFENSE` côté CaC) ; `confirmDamage` (file FIFO partagée CaC/Tir,
`docs/Old/PLAN_COMBAT_ACTION_QUEUE.md` §3) appelle `advanceTimeline()` dès que sa file se vide, reprenant
proprement la Résolution sur le combattant suivant (ou `endTurn()` si plus rien ne reste). Voir
« Bug réel — AWAITING_DAMAGE écrasé » ci-dessous pour l'historique du correctif.

### Bug réel — `AWAITING_DAMAGE` écrasé par un `advanceTimeline()` inconditionnel (corrigé Session 165)

Défaut préexistant de la refonte de l'échelle de phases (Session 159), trouvé en validant Tir Multi mais
touchant aussi le CaC et les drones — pas spécifique à Tir Multi. Symptôme : un tireur PJ qui touche pose
`AWAITING_DAMAGE`, mais `advanceTimeline()`, appelé sans condition juste après dans 4 fonctions,
l'écrasait en `SLOT_ACTIVE` dès qu'un autre combattant avait un pas suivant — `COMBAT_DAMAGE_CONFIRM`
rejeté à jamais par le garde FSM (`combatFSM.js`). Corrigé en alignant les 4 endroits sur le patron déjà
en place pour `AWAITING_DEFENSE` (`suspend:true`, jamais un retour générique en fin de fonction) :
`resolveAssaultAction` (branche PJ-touche), `resolveDroneAssaultAction` (branche cible PJ),
`confirmMeleeDefense` (branche attaquant PJ-touche, flag local `suspendForDamage`), `confirmDamage`
(appelle désormais `advanceTimeline()` — pas un simple `setFSMSubPhase`+broadcast — quand sa file se
vide, sans quoi une confirmation de dégâts terminant le Tour n'aurait jamais déclenché `endTurn()`).
`socketCombatResolution.js` : `needsDefenseWait` renommé `resolutionSuspended` (couvre `AWAITING_DEFENSE`
et `AWAITING_DAMAGE`, plus seulement la défense CaC).

---

## combat_actions — shape complète (DB)

```javascript
{
  campaign_id,
  token_id,
  turn_number,           // Session 159 — filtre la file « en cours » ; combat_actions n'est plus vidée à endTurn
  action_key,           // 'assault' | 'melee' | 'move_lente' | 'move_moyenne' | 'rushed' | etc.
  type,                 // 'assault' | 'melee' | 'move_short' | 'move_long' | 'micro' | 'skip' | 'reload'
  sequence,             // 1=moves, 2=micro, 3=assault/melee — ordre d'exécution par slot
  weapon_inv_id,        // char_inventory.id (assault uniquement)
  target_token_id,      // token cible (assault/melee uniquement)
  fire_mode,            // 'CC' | 'RC' | 'RL'
  bullet_count,         // nombre de balles
  fire_mode_bonus_comp, // bonus Compétence mode de tir
  fire_mode_bonus_dmg,  // bonus Dommages mode de tir
  modifiers: {          // JSON parsé : ini_mod, ref_range (assault), dual_wield, dual_wield_bonus_comp
    ini_mod: 0,
    ref_range: string,  // ref_equipment.range de l'arme déclarée — utilisé par CombatModifiersWindow
    dual_wield: bool,
    dual_wield_bonus_comp: number,
  },
  status,               // 'pending' | 'resolved' | 'skipped'
}
```

**Type enum :** `move_lente` → `'move_short'`, toute autre `move_*` → `'move_long'`, autres → `'micro'`. **Melee** → `'melee'` (contrainte dans `127_combat_actions_constraints.js`, corrigé 2026-08-26 — "migration 63" pointe aujourd'hui vers `ref_careers.js`, sans rapport). CaC et Tir sont mutuellement exclusifs à la déclaration depuis Session 159 (`docs/REGLES/REGLESYSCOMBAT.md`, « Types d'Actions » — une seule Action de combat par Tour).
**Une action complexe (`assault`/`melee`) déclarée génère aussi une ligne `combat_timeline_entries`** — voir « Échelle de phases » ci-dessous ; `move`/`reload`/`micro`/`skip` n'en génèrent jamais.
**PC32 :** sequence attribuée serveur — jamais calculée côté client.
**PC22 :** arme assault doit être en slot `'MG'` ou `'MD'` — rejeté sinon.
**PC23 :** `'RC'` / `'RL'` nécessitent `is_learned=true` pour `TIR_AUTOMATIQUE`.
**PC33 :** coordonnées `moveAction` doivent être des entiers valides (coords DB PE14).

---

## Corps à Corps — Sprint CaC 1 (session 67)

### Flux complet

```
ANNOUNCEMENT : joueur déclare melee { targetTokenId, weaponInvId }
  → serveur valide distance ≤ 3 + allonge (PE14 — dist2D)
  → si hors portée : COMBAT_DECLARE_ERROR (message distance) → return (pas announced)
  → si OK : action melee stockée (type='melee', weapon_inv_id, target_token_id, modifiers:{ini_mod:-3})

RESOLUTION (COMBAT_ACTION_CONFIRM) :
  → resolveMeleeAction()
  → calcul skillTotal attaquant (weapon → ref_equipment_skill_assoc → skill_id, ou COMBAT_A_MAINS_NUES si mains nues)
  → roll D20 attaquant côté serveur
  → fetch skillTotal défenseur (toujours COMBAT_A_MAINS_NUES en V1)
  → défenseur PNJ → roll D20 auto → résolution → COMBAT_MELEE_RESULT → advanceTimeline (pas suivant de l'échelle)
  → défenseur PJ → stocke pendingMeleeDefense → COMBAT_MELEE_DEFENSE_PROMPT → sub_phase='AWAITING_DEFENSE' (pas BLOQUÉ)

COMBAT_MELEE_DEFENSE_CONFIRM (défenseur PJ clique "Défendre", ou MJ via confirmMeleeDefense forcé) :
  → roll D20 défenseur côté serveur
  → hit = (rollAtk ≤ CDRatk) AND NOT (rollDef ≤ CDRdef)
  → COMBAT_MELEE_RESULT → room
  → si hit + PJ attaquant → COMBAT_DAMAGE_PROMPT → PJ roule dégâts (CombatDamageWindow existant)
  → si hit + PNJ attaquant → auto dégâts → COMBAT_ATTACK_RESULT
  → sub_phase='SLOT_ACTIVE', advanceTimeline (pas suivant de l'échelle)
```

### Formules

```js
// Skill attaquant (ou défenseur)
skillTotal = calcAN(for_na) + calcAN(coo_na) + mastery  // COMBAT_A_MAINS_NUES / COMBAT_ARME : attr FOR+COO

// Chances de réussite attaque
chancesAttaque = skillTotal + effectiveMalus + isRushedMod

// Chances de réussite défense
chanceDefense = defenderSkillTotal + defenderEffectiveMalus

// Résolution opposition (Polaris LdB)
hit = (rollAttaque <= chancesAttaque) AND NOT (rollDefense <= chanceDefense)

// Dégâts bruts melee (dans COMBAT_DAMAGE_CONFIRM, type='melee')
degautsBruts = rawDice + getModDom(for_na_attaquant)   // pas de MR table, pas de fire_mode_bonus
```

### Filtrage armes de contact (client)

```js
// CORRECT : filtrer par category, pas par location + range IS NULL
item.ref_category === 'Arme de contact'
  && (item.slot === 'MG' || item.slot === 'MD' || item.slot === '2M')

// allonge : ref_equipment.range pour 'Arme de contact' = allonge en mètres (1/2/3), PAS portée de tir
// distance max = 3 + parseInt(weapon.ref_range || '0')
```

### Modes de combat — Sprint CaC 2 (session 68)

Implémentés : Normal, Offensif, Charge. En DB (prêts pour CaC3) : Défensif, Retraite.

| Mode | Effet attaque | Effet défense (si attaqué) | Contrainte |
|---|---|---|---|
| `normal` | ±0 | ±0 | — |
| `offensif` | +3 | −5 | — |
| `charge` | +3 + **+3 dégâts** | −7 | Doit être à > 3m, dépl. court gratuit |
| `defensif` | pas d'attaque | +3 | Retarde l'action (CaC3) |
| `retraite` | pas d'attaque | +5 | Retarde + recule (CaC3) |

**Stockage :** `combat_roster.state_combat_mode` — reset à 'normal' à chaque `endTurn`.

**Flux client (PJ) :**
```
Panneau melee → chips Normal/Offensif/Charge
Charge : handleChargeFlow() → onEnterMoveMode(chargeAllures=lente×4) → onMoveSelected
  → auto-enchaîne onEnterTargetMode → meleePendingTokenId
Payload : state.combat_mode + move.ini_mod=0 + melee.targetTokenId
```

**Flux client (GM) :**
```
Clic CaC → meleePendingMode=true → panneau droit 720px visible avec 3 chips
Normal/Offensif → handleStartMeleeQueue()
Charge → handleStartChargeQueue() : pour chaque PNJ → onEnterMoveMode → onEnterTargetMode
chargeSelections[tokenId] = { move: {...,ini_mod:0}, targetTokenId }
```

**Flux serveur :**
```
COMBAT_ACTION_DECLARE : state.combat_mode → UPDATE combat_roster.state_combat_mode
  move Charge : chargeMove = (combat_mode==='charge' && mapActions.move) → iniDelta += 0
  melee Phase 1 : aucune validation distance — intention libre

COMBAT_ACTION_CONFIRM (Phase 2) :
  move_short fires first → token moves in DB
  resolveMeleeAction fires → fetch token positions (post-move) → check dist ≤ 3+allonge
    read rosterAttaquant.state_combat_mode → attackModeBonus (+3 offensif/charge)
    read rosterDefendeur.state_combat_mode → chanceDefense ajustée
    combatModeBonus = charge ? 3 : 0 → stocké dans commonPending → combat_pending (table Postgres durable, voir §combat_pending)

COMBAT_DAMAGE_CONFIRM : degautsBruts = rawDice + modDom + combatModeBonus
```

**Batch GM — règle :** `toggleSelect` et `selectAll` = libres (tous PNJs ensemble). Filtre `isRanged` uniquement dans `handleStartAttackQueue().filter(isRanged)`. Ne jamais réintroduire le guard à la sélection.

---

### Pièges CaC

**PC-CaC1 — `COMBAT_CONTACT` n'existe pas dans `ref_skills`.**
Skill mains nues = `COMBAT_A_MAINS_NUES` (FOR/COO). Skill armes de contact = `COMBAT_ARME` (FOR/COO).
→ Si `refSkill = null`, `skillTotal = 0`, jamais de touche. Toujours vérifier l'existence du skill en DB.

**PC-CaC2 — `range` pour 'Arme de contact' = allonge, pas portée de tir.**
Lance (range=3) → peut attaquer à 3+3=6m. Couteau (range=null) → portée de base 3m.
Les armes à distance ont range en format `"10/50/100/200 (300)"` — le filtre `category='Arme de contact'` suffit.

**PC-CaC3 — Pas de l'échelle suspendu jusqu'à COMBAT_MELEE_DEFENSE_CONFIRM (défenseur PJ).**
`needsDefenseWait = true` → `advanceTimeline` non appelé dans COMBAT_ACTION_CONFIRM, `sub_phase='AWAITING_DEFENSE'`.
`advanceTimeline` appelé depuis `confirmMeleeDefense` (COMBAT_MELEE_DEFENSE_CONFIRM) uniquement.
**Résolu (Lot D, Session 159)** : un joueur injoignable ne bloque plus indéfiniment — le MJ dispose du
bouton générique « Forcer » (`COMBAT_SKIP_PLAYER` en Résolution → `forceAdvanceResolution`), qui lance
le jet à la place du défenseur (« il devient PNJ pour le Tour »).

**PC-CaC4 — `pendingMeleeDefense` keyed par `defenderTokenId` (pas attaquant).**
COMBAT_MELEE_DEFENSE_CONFIRM payload = `{ tokenId: defenderTokenId }`.

**PC-CaC5 — COMBAT_DECLARE_ERROR + `return` si hors portée (Phase 2).**
Émis depuis `resolveMeleeAction` si dist2d > 3+allonge à la résolution. Ne pas bloquer en Phase 1.

**PC-CaC6 — Distance melee validée Phase 2 uniquement (post-déplacement).**
`resolveMeleeAction` fetch les positions DB APRÈS que le `move_short` de la même boucle `COMBAT_ACTION_CONFIRM` a mis à jour les coordonnées. Phase 1 = intention libre, aucune validation.

**PC-CaC7 — Seuil Charge = 3m fixe (pas 3+allonge).**
"Engagé au contact" = ≤ 3m (LdB). L'allonge étend la portée d'attaque mais pas le seuil d'engagement. Guard Charge en Phase 2 : `dist2d > 3` (pas `> 3+allonge`).

**PC-CaC8 — Batch GM : type guard à la sélection = supprimé.**
`toggleSelect` et `selectAll` = libres. `handleStartAttackQueue` filtre `targetIds.filter(isRanged)`. Ne jamais réintroduire le guard dans toggleSelect/selectAll.

---

### Multi-adversaires — Sprint CaC 4a (session 72)

**Règle LdB p.224 :** un personnage confronté à plusieurs adversaires simultanés en CaC subit un malus à ses Tests d'opposition (attaque ET défense).

| Adversaires distincts | Malus |
|---|---|
| 2 | −5 |
| 3 | −7 |
| 4+ | −10 |

**Critère "confronté" :** tout token ennemi actif dans le roster dont la distance PE14 (positions post-déplacement) est ≤ `3 + allonge_max_de_l_adversaire`. L'allonge est celle de l'arme de contact équipée (slot MG/MD/2M, category='Arme de contact'). Si l'adversaire n'a pas d'arme de contact équipée, allonge = 0 → portée de base 3m.

**Implémentation :**
- Helper module-level `countAdversaires(tokenPos, rosterTokens, excludeId, enemyType)` — filtrage JS sur les données pré-fetchées.
- `rosterTokens` : requête unique dans le `Promise.all` de `resolveMeleeAction` (jointure `tokens → combat_roster → characters → char_inventory → ref_equipment`), groupée par token, avec `MAX(range::INTEGER)` comme allonge.
- `multiMalusAttaquant` appliqué à `chancesAttaque`.
- `multiMalusDefenseur` appliqué à `chanceDefense` dans les deux paths (PNJ auto-résolu + PJ via `commonPending → COMBAT_MELEE_DEFENSE_CONFIRM`).

**Choix V1 documenté :**
- `PNJ = ennemi du PJ`, `PJ = ennemi du PNJ` — proxy sur `character.type`.
- **Limitation** : un PNJ allié du groupe n'est pas distingué des PNJ ennemis → comptabilisé à tort comme adversaire du PJ. Cas rare en pratique (parties privées 4–8 joueurs sans PNJ alliés en roster). Résolution future : colonne `combat_roster.side` (non implémentée).

**Ne pas confondre avec PC-CaC7 :** le seuil d'engagement Charge reste 3m fixe. Le `3 + allonge` ici concerne uniquement le comptage des adversaires pour le malus, pas la validation de la Charge.

### Nouveaux events WS (session 67)

| Event | Direction | Description |
|---|---|---|
| `COMBAT_MELEE_DEFENSE_PROMPT` | serveur → socket défenseur PJ | Invite à lancer la défense |
| `COMBAT_MELEE_DEFENSE_CONFIRM` | défenseur PJ → serveur | Déclenche roll D20 serveur + résolution |
| `COMBAT_MELEE_RESULT` | serveur → room | Jets opposition + outcome (hit/esquive) |
| `COMBAT_DECLARE_ERROR` | serveur → socket | Validation déclaration échouée (hors portée, etc.) |

---

## COMBAT_ACTION_DECLARE — payload v2

⚠️ **Payload v2 (sprint Panel Joueur).** Payload v1 (`selectedKeys`) supprimé — pas de rétrocompat.

```javascript
socket.emit(WS.COMBAT_ACTION_DECLARE, {
  tokenId,        // token déclarant
  state: {
    position:  'standing'|'crouching'|'prone',
    weapon:    'holstered'|'ready'|'drawn',
    fire_mode: 'cc'|'rc'|'rl',
    cover:     'exposed'|'partial'|'important',
    vitesse:   'normal'|'delayed'|'rushed',
  },
  mapActions: {
    move:     { targetPosX, targetPosY, targetPosZ, ini_mod, action_key } | null,  // coords PE14
    attack:   {
      weaponInvId,         // char_inventory.id de l'arme (slot MG ou MD)
      targetTokenId,       // token cible
      bulletCount,         // nombre de balles (CC/RC/RL)
      fireModeBonusComp,   // bonus Compétence (calculé client — recalculé serveur)
      fireModeBonusDmg,    // bonus Dommages (calculé client — recalculé serveur)
      isDualWield,         // bool
      dualWieldBonusComp,  // bonus Comp dual wield (calculé client)
      cover_shot,          // bool — tirer depuis sa couverture (conditionnel : cover != 'exposed')
    } | null,
    melee:    bool,  // corps à corps (-3 INI serveur)
    multi:    bool,  // attaque multiple (-5 INI serveur) — V2
    interact: bool,  // interagir (pas de target_entity_id ce sprint — implémenté sprint suivant)
  },
  quick: {
    observer: number,  // tranches 0–6 (0 = non sélectionné)
    reperer:  number,  // tranches 0–6
    phrase:   bool,
  }
})
```

**Calcul INI serveur (recalcul strict) :**
```
iniDelta = transitionCost(state_position) + transitionCost(state_weapon)
         + transitionCost(state_fire_mode)
         + (state_vitesse === 'rushed' ? +3 : 0)
         + (mapActions.move ? ini_mod : 0)
         + (mapActions.melee ? -3 : 0)
         + (mapActions.multi ? -5 : 0)
         + (mapActions.attack?.cover_shot ? (cover==='partial' ? -3 : -5) : 0)
         + quick.observer * -5
         + quick.reperer * -5
         + (quick.phrase ? -3 : 0)
```
Le client affiche un breakdown INI indicatif — le serveur recalcule strictement, jamais trusted.

**PC28 :** les valeurs `state.*` du payload = nouvelles valeurs demandées (état cible). Le serveur UPDATE `combat_roster` avec ces valeurs + calcule l'iniDelta depuis les valeurs précédentes en DB.

### FIRE_MODE_VARIANTS — table complète (LdB p.227-228)

**CC (Coup par coup) :**
| id | bulletCount | bonusComp | bonusDmg |
|---|---|---|---|
| cc_1 | 1 | 0 | 0 |
| cc_2 | 2 | +1 | 0 |
| cc_3 | 3 | +2 | 0 |
| cc_4 | 4 | +3 | 0 |
| cc_7a | 7 | +4 | 0 |
| cc_7b | 7 | +3 | +3 |
| cc_10a | 10 | +5 | 0 |
| cc_10b | 10 | +4 | +3 |

**RC (Rafale courte) :** rc_3 — 3b, +3 comp, +5 dmg (unique option, auto-sélectionné)

**RL (Rafale longue) :**
| id | bulletCount | bonusComp | bonusDmg |
|---|---|---|---|
| rl_5 | 5 | +2 | +2 |
| rl_10 | 10 | +4 | +4 |
| rl_15 | 15 | +6 | +6 |
| rl_20 | 20 | +8 | +8 |
| rl_mc | 5 | 0 | 0 |

**Dual wield** — bonus Comp si 2 armes même mode : +3 (CC/RC), +5 (RL). Si modes différents → force CC.

### MOVE_ZONE_DEFS — allures de déplacement combat (combatSections.js)

| allureKey | action_key | ini_mod | couleur |
|---|---|---|---|
| `lente` | `move_lente` | -3 | bleu #3b82f6 |
| `moyenne` | `move_moyenne` | -5 | vert #22c55e |
| `rapide` | `move_rapide` | -7 | orange #f97316 |
| `max` | `move_max` | 0 | rouge #ef4444 |

Les couleurs et coûts d'initiative proviennent du registre partagé `shared/combatMovement.js`.
L'aperçu demande au serveur le chemin correspondant au budget calculé depuis la fiche ; un rayon
client ou une distance à vol d'oiseau n'est plus une autorité de déplacement.

## Autorité spatiale du combat — Moteur Monde Phase 7

- à la déclaration, le client choisit une destination, pas une position finale garantie ni une
  allure faisant foi ;
- le serveur planifie avec le coût réel des supports, escaliers, échelles et effets, puis choisit
  l'allure minimale suffisante autorisée pour le personnage ;
- `combat_actions` conserve `destination_world`, `world_plan`, `movement_gait`, les révisions monde
  et runtime planifiées et le budget en mètres ;
- à la résolution, le serveur réconcilie l'ascenseur, recompile/replanifie sous verrou et persiste le
  dernier point réellement atteignable. Un token peut donc finir son tour au milieu d'un parcours
  vertical ;
- contact, charge, adversaires proches, interactions et portées utilisent les mêmes positions
  canoniques et une distance 3D en mètres ;
- LOS et couverture sont fournies par `worldVisibilityService`, après le déplacement effectivement
  résolu ;
- `shared/combatRange.js` lit la portée de l'arme et en déduit la bande de portée. Une cible hors de
  la dernière bande est refusée ;
- les régions du monde portant un hook `traverse/test/balance` appliquent automatiquement la règle
  de terrain instable. L'option manuelle reste un override MJ ou un filet pour les effets
  personnalisés.

Les migrations 156 et 157 assument volontairement le nouveau contrat. Les anciens déplacements en
attente sont invalidés et les anciennes portées d'interaction sont converties en mètres ; aucune
rétrocompatibilité de carte n'est promise.

### Actions inactives (SECTIONS — non implémentées)
`active: false` → grayed out, non cliquable dans CombatActionWindow :
- `micro_delay` — Retarder son action (V2)
- `multi_attack` — Placeholder initial, désormais **dead** pour melee (remplacé par le count selector dans le panel melee, Sprint CaC 4b). À réutiliser pour le Sprint Tir Multi (attaques multiples de tir contre cibles différentes, LdB p.218).
- `change_fire_mode` — Changer le mode de tir (sprint futur)

## COMBAT_ACTION_CONFIRM — payload confirmedModifiers

```javascript
socket.emit(WS.COMBAT_ACTION_CONFIRM, {
  tokenId: activeRosterEntry.token_id,
  confirmedModifiers: {
    portee,     // 'bout_portant' | 'courte' | 'moyenne' | 'longue' | 'extreme'
    situation,  // string[] — sitKeys sélectionnés (voir tables ci-dessous)
    taille,     // 'minuscule' | 'tres_petite' | 'petite' | 'moyenne' | 'grande' | 'tres_grande' | 'enorme' | 'gigantesque'
  },
})
```

`confirmedModifiers.portee` est conservé dans le payload d'interface historique, mais est ignoré
par la résolution serveur. La bande appliquée aux chances et aux dégâts est recalculée depuis la
distance 3D réelle et `ref_equipment.range`. Les sélections situationnelles et de taille restent
des confirmations métier distinctes.

### Tables de modificateurs situationnels (CombatModifiersWindow)

**Portée :**
| Key | Mod Comp |
|---|---|
| `bout_portant` | +5 |
| `courte` | 0 |
| `moyenne` | -5 |
| `longue` | -10 |
| `extreme` | -15 |

**Allure tireur (sitKey / mod) :**
| val | sitKey | Mod |
|---|---|---|
| `immobile` | null | 0 |
| `tireur_allure_lente` | `tireur_allure_lente` | -3 |
| `tireur_allure_moyenne` | `tireur_allure_moyenne` | -5 |
| `tireur_allure_rapide` | `tireur_allure_rapide` | -7 |
| `tireur_allure_maximale` | `tireur_allure_maximale` | **-99 (impossible)** |

**Allure cible :**
| val | sitKey | Mod |
|---|---|---|
| `cible_immobile` | `cible_immobile` | +3 |
| `cible_lente` | null | 0 |
| `cible_allure_moyenne` | `cible_allure_moyenne` | -3 |
| `cible_allure_rapide` | `cible_allure_rapide` | -5 |
| `cible_allure_maximale` | `cible_allure_maximale` | -7 |

**Couverture :**
| key | Mod |
|---|---|
| `couverture_partielle` (50%) | -3 |
| `couverture_importante` (75%) | -5 |

**Obscurité :**
| key | Mod |
|---|---|
| `obscurite_legere` | -3 |
| `obscurite_importante` | -5 |
| `obscurite_totale` | **-99 (impossible)** |

**Taille cible :**
| key | Mod |
|---|---|
| `minuscule` (~30 cm) | -10 |
| `tres_petite` (~50 cm) | -5 |
| `petite` (~1 m) | -3 |
| `moyenne` (humaine) | 0 |
| `grande` (~3 m) | +3 |
| `tres_grande` (~5 m) | +5 |
| `enorme` (~7 m) | +10 |
| `gigantesque` (10 m+) | +15 |

**Détection allure auto :** si tireur/cible a une action `move_lente/move_moyenne/move_rapide/move_max` dans le store actions → allure pré-remplie. Les valeurs sont overridables manuellement.

**hasTirImpossible :** `tireurAllureMod === -99 || obscurites.includes('obscurite_totale')` — désactive le bouton "Lancer les dés".

### attackResult shape (COMBAT_ATTACK_PLAYER_RESULT → SessionPage → CombatModifiersWindow)
```javascript
{ hit: bool, roll: number, cdr: number, tireurTokenId: string, cibleTokenId: string }
```

### Endpoint weapon-skill
```
GET /char-sheet/:characterId/weapon-skill/:weaponInvId
→ { skillLabel, skillTotal }  // compétence liée à l'arme, total calculé serveur
```

---

## Vérification compétence limitative (PC23 — Tir Automatique)

```js
const tirAutoRow = await db('char_skills')
  .where({ char_sheet_id: sheet.id, skill_id: 'TIR_AUTOMATIQUE' }).first()
const hasTirAuto = tirAutoRow?.is_learned === true
// Guard COMBAT_ACTION_DECLARE : si AUTO sélectionné ET !hasTirAuto → reject
```

---

## Munitions — DSL effets (`ref_equipment.ammo_effects`)

> Chantier 11 Étape 2, clos 2026-07-19. Historique complet (recherche, écarts trouvés en codant,
> tests) archivé : `docs/Old/PLAN_ARMES_DSL.md`.

`ammo_effects` (colonne texte, munitions uniquement — jamais les armes elles-mêmes) porte un DSL
`CLE=ACTION(VALEUR)` séparé par `;`, ex. `DMG=SET(1D6+2);CHOC=SET(1D10+2);TXT=FX=ASSOMMANTE`.
Parseur pur : `shared/weaponAmmoDsl.js` (`parseAmmoEffects`, aucune query DB, aucun `parseDice`).
Point de résolution unique (fetch + jet réel) : `damageService.getEffectiveWeaponDamage(db,
weaponInvId, { rangeBand })`, consommé par `resolveTargetHit` — jamais une 2ᵉ copie du parseur ou
de la requête. `resolveMeleeAction` et les branches drone ne passent jamais ces paramètres
(comportement historique inchangé, armes CaC/drone hors DSL munitions).

**`DMG=`** (BASE/SET/ADD/MUL) : dégât effectif de l'arme. `ADD` avec scaling (virgule dans la
valeur, type `+1/5D10_ARME`) reste hors scope — repli sur la formule de base (2 jets de dés de types
différents impossibles à sommer via `diceParser.parseDice`, qui n'accepte qu'un seul type de dé par
formule).

**`CHOC=SET(FORMULE)`** : Dommages de Choc catégorie 3 (munition spéciale, `docs/VOCABULARY.md`) —
brut, **jamais réduit** (ni armure, ni RD), **aucun gate de localisation** (s'applique quelle que
soit la zone touchée). Un seul `resolveShockTest` par coup : si Choc présent, la sévérité qui pilote
le test vient du total combiné brut `degatsNets + chocTotal` ; sinon comportement natif (sévérité
physique seule). La blessure, elle, reste toujours basée sur `degatsNets` seul. `CHOC=ADD(...)`
(scaling) hors scope, `null`.

**Registre `AMMO_MECHANIC_ACTIONS`** (`shared/weaponAmmoDsl.js`) — dispatch sur `tags.FX`, seule
autorité pour 6 familles de munitions dont le catalogue s'est révélé peu fiable (valeurs inventées
type mise à l'échelle `_ARME` jamais présente au LdB — même défaut trouvé 5+ fois pendant ce
chantier) : pour ces lignes, `DMG=`/`CHOC=`/`TXT=PEN=`/`ARMOR=`/`PASS=`/`DMG_DROP=` du catalogue sont
cosmétiques, jamais lus pour le calcul.

| FX | Dégât | Armure cible (`etq`) | Autre |
|---|---|---|---|
| `APHC` | inchangé | `× 2/3` (floor) | — |
| `SAP` / `SLAP` | `-1 dé` sur la formule de l'arme (`reduceDiceCount`) | `× 0.5` (floor) | — |
| `HP` | `+5` fixe (jamais lancé) | `× 1.5` (floor) | — |
| `EXPLOSIVE` | `+1D10` (jet séparé) | `× 2` (floor) | Choc fixe `+1D10`, remplace le `CHOC=` catalogue |
| `SHRAPNEL` | dégression par bande de portée (BP inchangé, C/M `-1D10`, L `-2D10`, E `-3D10`) | `× 1.5` (`polarisRound`) | Zone cône 3m/multi-cibles **non câblée** (voir C3 ci-dessous) |

`resolveAmmoMechanic(fx)` retourne la config ou `null` (munition sans mécanique C1 : Assommante/IEM/
inconnu — comportement Lot A/B strictement inchangé). Armure : appliquée dans `resolveTargetHit`
juste après `etq = calcResistanceArmure(...).etq`, seulement si `etq` non nul. `rangeBand`
(uniquement pour la dégression Shrapnel — sans lien avec le Choc, qui n'en a plus besoin) est transmis
par les 2 sites `socketCombatHelpers.js` qui appellent `getEffectiveWeaponDamage` (PNJ immédiat,
PJ différé `COMBAT_DAMAGE_CONFIRM`).

**Hors scope, décisions actées (ne pas rouvrir sans nouvelle demande produit)** :
- **IEM / Test de panne** : le DSL `DMG=MUL(0.5)` (mi-dégâts) reste codé et actif. Le reste de l'effet
  IEM (malus -3 à un Test de panne sur "équipements électroniques") est **laissé narratif** — les
  munitions IEM ciblent des systèmes électroniques (exo-armure, vaisseaux) qui n'existent pas encore
  dans le projet ; construire le mécanisme maintenant reviendrait à câbler une brique sans aucun
  consommateur réel. Le Test de panne lui-même (1D20 sous l'Intégrité de l'objet, `docs/REGLES/
  REGLE_USURE&INTEGRITE.md` p.273-274) n'est toujours pas codé (aucun système d'Intégrité du matériel
  en base) — mais le seuil "Catastrophe" dont il dépend est désormais formalisé (§"Résolution des
  Tests" ci-dessus, Marge d'échec ≥15) : reste un chantier séparé (Usure/Intégrité, `docs/EN_COURS.md`
  Roadmap), plus bloqué par l'absence de seuil.
- **Shrapnel — zone d'effet** : armure/dégression par portée câblées (tableau ci-dessus), mais le
  ciblage multi-cibles (cône 3m) n'existe pas dans le pipeline combat (cible unique partout). Décision
  Saar : le ciblage se fera par cases adjacentes calculées par le futur builder monde, pas par
  sélection MJ — nécessite une collaboration avec Kiwi, hors périmètre d'une session solo.

---

## Résolution dégâts — tables serveur (resolveAssaultAction / COMBAT_DAMAGE_CONFIRM)

### LOC_TABLE — Localisation D20 (socket/index.js)
| D20 | SlotCode | Localisation |
|---|---|---|
| 1–2 | T | tete |
| 3–8 | C | corps |
| 9–11 | BD | bras_droit |
| 12–14 | BG | bras_gauche |
| 15–17 | JD | jambe_droite |
| 18–20 | JG | jambe_gauche |

### Seuils sévérité (dégâts nets)
| Dégâts nets | Sévérité | is_lethal |
|---|---|---|
| ≥ 30 | mortelle | true |
| 25–29 | mortelle | false |
| 20–24 | critique | false |
| 15–19 | grave | false |
| 10–14 | moyenne | false |
| 5–9 | légère | false |
| < 5 | null (pas de blessure) | false |

### Formule dégâts nets
```
degautsBruts = rawDice + modDomAttaque(mr) + modDegatsMode
modDegatsMode = fire_mode_bonus_dmg si portée ∈ {bout_portant, courte}, sinon 0
degatsNets = max(0, degautsBruts - etq + rd)
rd = calcResistanceDommages(for_na_cible, con_na_cible)
```
⚠️ **`fire_mode_bonus_dmg` n'est appliqué qu'en portée courte/bout portant.**

### COMBAT_ATTACK_RESULT payload (broadcast → room)
```javascript
{
  tireurId, cibleId,
  localisation,     // slug 'tete' | 'corps' | ...
  degautsBruts, degatsNets,
  severity,         // finalSeverity (après promotion P49)
  is_lethal,
  isSuccess,
  shockResult: null | {
    triggered: true,
    roll: number,
    outcome: 'ok' | 'etourdi' | 'inconscient',
    shockMalus: number,
  }
}
```

### combat_pending
> **Corrigé (2026-07-19, audit `docs/PLAN_TIRMULTI.md` §0.1)** : ce paragraphe décrivait à tort une
> Map in-memory (`pendingDamageActions`, `new Map()`). Grep exhaustif confirmé : ce nom n'existe nulle
> part dans le code actuel. Le mécanisme réel est **`combat_pending`, une table Postgres durable** —
> stocke les paramètres bruts entre COMBAT_ATTACK_PLAYER_RESULT et COMBAT_DAMAGE_CONFIRM (type
> `'damage'`) ainsi que la queue d'attaques CaC restantes entre jets de défense (type `'melee_defense'`).
> Ne perd pas son contenu à un redémarrage serveur, contrairement à ce qui était documenté ici.

---

## PC27 — Entité ≠ PNJ

`!token.character_id` = Entité de décor (porte, console) — **jamais un PNJ**.
PNJ = `character.type === 'pnj'`.
Entité exclue du combat (`continue` dans COMBAT_START).
`characters.type` enum `'pj'|'pnj'` — extensible (`'vehicle'`, `'drone'`). Source de vérité unique.

---

## Flux combat côté client — shapes SessionPage

### combatMoveMode
```javascript
// null | {
//   tokenId,         // token qui se déplace
//   zones,           // [{ radius, action_key, ini_mod, color, label }] — calculé dans CombatActionWindow
//   onMoveSelected,  // closure CombatActionWindow — appelée avec sel (pendingMoveSelection)
//   onCancel,        // closure CombatActionWindow
//   onPendingMove,   // (sel) => setPendingMoveSelection(sel) — survol zone
// }
```

### combatTargetMode
```javascript
// null | {
//   tokenId,           // token qui attaque
//   pendingTargetId,   // token survolé (null = aucun)
//   onTargetSelected,  // closure CombatActionWindow — appelée avec targetTokenId
//   onCancel,          // closure CombatActionWindow
//   onPendingTarget,   // (id) => setCombatTargetMode(prev => { ...prev, pendingTargetId: id })
// }
```

### damagePayload / damageResults
```javascript
// damagePayload — issu de COMBAT_DAMAGE_PROMPT :
{ tokenId, formula, targetName }

// damageResults — issu de COMBAT_DAMAGE_RESULT :
{
  rollLoc,       // résultat D20 localisation
  locLabel,      // label lisible (ex. 'Corps')
  degautsBruts,  // total dégâts bruts
  dmgRolls,      // number[] — résultats individuels des dés
  degatsNets,    // dégâts après armure
  severity,      // 'legere' | 'moyenne' | 'grave' | 'critique' | 'mortelle' | null
  severityColor, // hex string — couleur SEVERITY_COLORS[severity]
}
// Les deux sont clearés ensemble par onDamageConfirmed()

// COMBAT_DAMAGE_CONFIRM payload (PJ → serveur) :
socket.emit(WS.COMBAT_DAMAGE_CONFIRM, { tokenId: payload.tokenId })
```

### Props CombatOverlay (depuis SessionPage)
```javascript
<CombatOverlay
  socket={socket}
  battlemap={battlemap}
  isGm={isGm}
  user={user}
  characters={characters}
  // tokens={tokens}  ← passé mais IGNORÉ — CombatOverlay lit tokenStore directement
  pendingSurpriseRoll={pendingSurpriseRoll}     // null | { tokenId }
  onSurpriseRolled={handleSurpriseRolled}
  onEnterMoveMode={handleEnterMoveMode}
  combatMoveMode={combatMoveMode}
  pendingMoveSelection={pendingMoveSelection}
  onValidateMove={handleValidateMove}
  onCancelPendingMove={handleCancelPendingMove}
  combatTargetMode={combatTargetMode}
  onEnterTargetMode={handleEnterTargetMode}
  onValidateTarget={handleValidateTarget}
  damagePayload={damagePayload}
  damageResults={damageResults}
  onDamageConfirmed={() => { setDamagePayload(null); setDamageResults(null); setAttackResult(null) }}
  attackResult={attackResult}
  onAttackConfirmed={() => setAttackResult(null)}
/>
```

### sortedRoster — PC29
```javascript
// Dans CombatOverlay (et tout composant qui calcule le "slot actif") :
const sortedRoster = [...roster].sort((a, b) => b.initiative - a.initiative)
const activeEntry = sortedRoster[activeSlotIdx]
```
**`activeSlotIdx` indexe le roster TRIÉ par initiative décroissante, pas le roster brut.**
Toute dérivation du slot actif doit trier le roster avant d'appliquer l'index.

### Conditions de visibilité des sous-composants (CombatOverlay)

| Composant | Condition |
|---|---|
| `CombatTimeline` | `phase !== null` — tous |
| `CombatRosterWindow` | GM + `phase === null \|\| 'ROSTER'` |
| `CombatPnjPanel` | GM + `phase === 'ANNOUNCEMENT'` — toggle portrait |
| `CombatGmDeclareWindow` | GM + `phase === 'ANNOUNCEMENT'` |
| `CombatActionWindow` | PJ + `phase === 'ANNOUNCEMENT'` OU `phase === 'RESOLUTION' && !playerActiveAssaultAction && !attackResult` |
| Bouton "Agir" GM inline | GM + `phase === 'RESOLUTION' && !activeAssaultAction` |
| `CombatModifiersWindow` PJ | PJ + `phase === 'RESOLUTION' && (playerActiveAssaultAction \|\| attackResult)` |
| `CombatModifiersWindow` GM | GM + `phase === 'RESOLUTION' && activeAssaultAction && character.type === 'pnj'` |
| `CombatDamageWindow` | `damagePayload !== null` |
| Overlay visée cible | `combatTargetMode !== null` |
| Overlay déplacement | `combatMoveMode !== null` |

### Props sous-composants combat
```javascript
// CombatModifiersWindow
{ socket, assaultAction, activeRosterEntry, attackResult, onAttackConfirmed }

// CombatDamageWindow
{ payload: damagePayload, results: damageResults, socket, onConfirmed: onDamageConfirmed }

// CombatRosterWindow
{ socket, battlemapId: battlemap?.id }

// CombatActionWindow
{ socket, user, characters, pendingSurpriseRoll, onSurpriseRolled, onEnterMoveMode, onEnterTargetMode }
```

### Fenêtres de déclaration (phase ANNONCE) — briques partagées

3 orchestrateurs séparés (`CombatActionWindow` PJ/drone-PJ multi-phases, `CombatGmDeclareWindow` MJ,
`CombatExoActionWindow` exo) — fusion rejetée (REWORK-05). Détail du patron, des briques
`CombatDeclare*` et des règles : **`REACT.md` P58**.

Côté modèle / calcul (ce qui concerne ce document) :
- `client/src/components/combatSections.js` — `STATE_DEFS`, `nextKey`, `stateTransitionCost`,
  `calcIniDelta` / `calcIniBreakdown` (aperçu client), `MAP_ACTIONS`, `MOVE_ZONE_DEFS`,
  `FIRE_MODE_VARIANTS`, `computeFireVariant`.
- `shared/combatIniCost.js` — **autorité unique du coût d'Initiative d'une déclaration, client +
  serveur** (`computeIniDelta` / `iniDeltaBreakdown` / `projectedInitiative`). Détail des postes :
  `COMBAT_FLUX.md` § « Calcul delta initiative ». Le serveur (`socketCombatAnnouncement.js`) applique
  cette même fonction à `combat_roster.initiative` ; le client l'affiche dans la pastille
  « Initiative projetée » du pied (`CombatDeclareIniWidget`, rouge si projeté ≤ 0).

### PC36 — combatCameraCenter : centrage caméra sur token actif
```javascript
// Shape : { x, z } coords DB (PE14) | null
// Canvas3D useEffect([combatCameraCenter]) :
//   orbitRef.current.target.set(x + 0.5, 0, z + 0.5); orbitRef.update()
// Guard : null → return (caméra reste, annulation ne la déplace pas)
// Calculé dans SessionPage → CombatActionWindow → combatTokenPos
```

### Rendu 3D combat — Canvas3D

#### Chemin de déplacement combat — corrigé 2026-08-26, entièrement périmé

**Ce que décrivaient ces deux sous-sections (anneaux concentriques `zones[0]`/`zones[i>0]` en
`circleGeometry`/`ringGeometry`, offset `pos_z + 1.0 + 0.05`) n'existe plus** — remplacé le
2026-08-07 (retour Saar, commentaire explicite `Canvas3D.jsx:1273-1276`) par un réticule par case le
long du chemin réellement calculé par le serveur, cohérent avec la note déjà présente plus haut dans
ce même document (§ MOVE_ZONE_DEFS : *« un rayon client ou une distance à vol d'oiseau n'est plus
une autorité de déplacement »*) — contradiction interne non remarquée jusqu'à cet audit.

Flux réel :
- `requestWorldPathPreview` (`Canvas3D.jsx:656`) appelle `POST /battlemaps/:id/world-path-preview`
  (`MOTEUR_MONDE.md` §5.3 — aperçu serveur, jamais un rayon calculé côté client) avec le budget
  `combatMoveMode.allures.max` ; construit `currentPath` à partir de `result.plan.segments` (points
  déjà en espace monde canonique, mètres/pieds).
- Rendu : un `<GroundCursorReticule>` (`SceneReticules.jsx`) par case de `currentPath`, coloré par
  `getCombatPathColor(cell.spentM, combatMoveMode.allures)` (`shared/combatMovement.js`) — bleu/vert/
  orange/rouge selon l'allure requise pour atteindre cette case, pas un jeu d'anneaux de portée fixes.
- Case destination sélectionnée : surbrillance bleue à `pendingMoveSelection.targetPosZ + 0.06`
  (`#3b82f6`, `planeGeometry`), pas l'ancien offset `+1.0+0.05`.

#### Ligne de visée assaut (targetLinePoints)
- `useMemo([combatTargetMode?.pendingTargetId])`
- Guard : requiert `pendingTargetId` + `tokenId` + les deux tokens trouvés dans tokenStore
- Points : `Float32Array[6]` → `[myToken.pos_x+0.5, myToken.pos_z+1.5, myToken.pos_y+0.5, tgt.pos_x+0.5, tgt.pos_z+1.5, tgt.pos_y+0.5]`
- (PE14 + PE34 : altitude = pos_z+1.5, profondeur = pos_y)
- Rendu : `<line>` + `lineBasicMaterial color="#e07070"`
