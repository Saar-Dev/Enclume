# PLAN_MUTATION2 — Effets mécaniques des Mutations et Avantages jamais appliqués
> Session 141 (suite 14) — 2026-07-11 (Lot 2 détaillé ligne-à-ligne, pas encore codé — Lot 1 clos
> Session 141 suite 13, voir aussi suite 10, diagnostic/architecture initiale)
> Statut : **DIAGNOSTIC + ARCHITECTURE**. Lot 1 codé et clos. Lot 2 planifié en détail (recherche
> Foundry VTT Active Effects à l'appui), **pas de code écrit**. Découpé en 7 lots (mécanique visée,
> pas catalogue source). Chaque lot est détaillé ligne-à-ligne au moment de l'attaquer (règle "un
> sujet à la fois") — les lots non encore attaqués ne fixent que le périmètre et l'ordre.

---

## Contexte

En validant le Lot D d'`AdvantagesPanel.jsx` (MJ octroie une mutation à un personnage déjà
verrouillé), Saar a demandé : *"ajouter une mutation implique forcément d'appliquer les EFFETS de
la mutation (accès à une compétence, perte ou gain de statistiques, etc...). Est-ce qu'on le gère
dans le Wizard ça ?"*

Réponse vérifiée `[VÉRIFIÉ]` par recherche exhaustive dans le code (pas une supposition) : **non,
le Wizard ne le gère pas non plus.** Gap architectural pré-existant, jamais comblé depuis la
création de `ref_mutations` (migration 95) et `ref_advantages` (migration 92). Même diagnostic
demandé et confirmé pour les Avantages — situation identique, plus large en surface (76 lignes
`ref_advantages` concernées contre 33 `ref_mutations`).

**Décision Saar (cette session) : mutations et avantages sont la même famille de problème et
partagent la même mécanique sous-jacente — un seul plan, un seul moteur d'application, découpé en
lots par TYPE D'EFFET (attributs, résistances, etc.), pas par catalogue d'origine.** On avance pas
à pas : chaque lot reste un morceau isolé, jamais tout d'un coup.

---

## Diagnostic `[VÉRIFIÉ]`

### Mutations
- `char_mutation_effects_view` (créée migration 96, réécrite migration 109) agrège déjà
  `mod_FOR/CON/COO/INT/VOL/PRE` + résistances (`mod_res_damage/shock/drugs/disease/poison/radiation`)
  + `natural_armor` de toutes les mutations `status='active'` d'un personnage. **Recherche
  exhaustive (`grep` server + client) : cette vue n'est interrogée nulle part.** Vue morte depuis sa
  création.
- `calcNA(base_level, pc_modifier, mod_genotype)` (`server/src/lib/charStats.js:195`) — la fonction
  qui calcule le niveau final d'un attribut primaire — **n'a que 3 paramètres**. Aucune place prévue
  pour un modificateur de mutation (ni d'avantage).
- Conséquence concrète : un personnage avec "Caractère félin" (`mod_COO: 2`) n'a jamais eu ce bonus
  appliqué à sa fiche, qu'il l'ait choisie au Wizard Step3 ou reçue en jeu via le Lot D.
- Compétences débloquées par une mutation (ex. Maîtrise de la Force Polaris) : dette **`[CS7]`**,
  transférée ici depuis `docs/PLAN_ADVANTAGESPANEL.md` Lot E — même famille, détail Lot 5 ci-dessous.

### Avantages
- `ref_advantages` a 12 colonnes de modificateurs potentiels. Recherche exhaustive (`grep` server +
  client) sur ces colonnes : **aucune n'est lue en dehors des migrations qui les créent**, à une
  exception près.
- **Seule exception trouvée** : `adv_076` (Fécondité) → `char_archetype.is_fertile`, et `adv_002`
  "Ambidextre" → jamais appliqué en fait (colonne `mod_identity` lue nulle part) — les deux sont
  gérés (ou pas) via `if (advantageId === 'adv_076')` codé en dur dans `advantageService.js`, pas
  une lecture générique de `mod_identity`.
- Sur 76 lignes `ref_advantages`, ~74 ont leurs effets mécaniques déclarés en base mais **jamais
  appliqués**.

### Recoupement réel entre les deux catalogues `[VÉRIFIÉ]` (lecture directe `92_ref_advantages.js`)
Point clé qui structure les lots ci-dessous : **le recoupement mutations/avantages est partiel, pas
total.**
- `ref_advantages.mod_attribute` ne cible **jamais** un attribut primaire — seulement `"reaction"`
  (REA, `calcREA`) et `"breath"` (Souffle, `calcSouffle`), des **attributs secondaires dérivés**.
  Les mutations ne touchent, elles, que les attributs **primaires** (`mod_FOR..PRE`). → **Aucun
  recoupement** sur ce point : "attributs primaires" reste mutations-only, "attributs secondaires"
  reste avantages-only, en l'état actuel des données.
- `ref_advantages.mod_resistance` cible uniquement `"damage"` et `"shock"` — ça, ça recoupe
  vraiment `mod_res_damage`/`mod_res_shock` des mutations (même stat cible, deux sources). Les 4
  autres résistances mutation (`drugs`/`disease`/`poison`/`radiation`) n'ont aucun équivalent
  avantage.
- `natural_armor` (mutations) et le déblocage de compétence (les deux catalogues) n'ont pas
  d'équivalent croisé direct mais partagent le même besoin d'un point d'application unique.
- `mod_savings`/`mod_monthly_income`/`mod_gauges`/`mod_conditions`/`mod_skill_points`/`mod_age` :
  100% avantages, aucun équivalent mutation.

---

## Décision d'architecture

**Un seul moteur d'application, deux sources de données normalisées vers la même forme.**

1. **Nouvelle fonction serveur d'agrégation** (accès DB — vit à côté de `mutationService.js`/
   `advantageService.js`, pas dans `charStats.js` qui est explicitement "fonctions pures, aucun
   accès DB"). Rôle : lire `char_mutations` JOIN `ref_mutations` + `char_advantages` JOIN
   `ref_advantages`, normaliser chaque source vers la même forme (`{FOR, CON, ..., res_damage,
   res_shock, ..., reaction, breath, natural_armor, identity: {...}, ...}`), fusionner (addition
   simple — pas de risque de double-application, lecture pure à chaque appel, même convention que
   les ~15 sites qui appellent déjà `calcAttributeNA` aujourd'hui : refetch + recalcul, jamais de
   cache). Nom/emplacement exact à trancher au moment du Lot 1 (candidat : nouveau fichier dédié,
   pas une extension de `mutationService.js` ou `advantageService.js` pris isolément, puisque les
   deux sources y contribuent).
2. **`charStats.js` reste le point de calcul unique** ("source de vérité mécanique" déjà déclarée
   dans son docstring) : `calcNA`/`calcREA`/`calcSouffle`/`calcResistanceDommages` etc. gagnent
   chacun un paramètre modificateur supplémentaire, alimenté par l'agrégat du point 1.
3. **Piste B (application à l'écriture) reste écartée** : fragile (annuler exactement le bon delta
   au retrait, risque de double-application si rejoué), et va à l'encontre du pattern "recompute à
   la lecture" déjà en place pour `calcAttributeNA`/`calcSkillTotal` partout ailleurs.
   - Nuance trouvée en creusant `getAgeEffects()` (souvent cité comme précédent "recompute
     absolu") : ce n'est **pas** le même pattern. Il est appliqué **à l'écriture**, une seule fois
     par `reconcileCreation` (Wizard uniquement), et baké dans `char_attributes.pc_modifier` — pas
     un paramètre de lecture. Réutiliser `pc_modifier` pour mutations/avantages entrerait en
     collision avec l'effet d'âge déjà stocké dans la même colonne, et rien n'existe côté "en jeu"
     (Lot D) pour rejouer une reconciliation équivalente. D'où le choix d'un vrai paramètre de
     lecture (point 2), pas d'une écriture supplémentaire dans `pc_modifier`.
4. **Client** : `CharacterSheet.jsx` a sa propre réimplémentation locale de `calcNA` (pas un import
   de `charStats.js`/`shared/polarisUtils.js`) — dette préexistante, non traitée ici sauf si un lot
   la touche directement (Lot 1 la touchera nécessairement).

**Ampleur du rebranchement (tous lots confondus, `[VÉRIFIÉ]` par grep)** : `calcAttributeAN`/
`calcAttributeNA` sont appelés à ~15 endroits — `char-sheet.js` (4), `socketEntity.js` (2),
`socketCombatHelpers.js` (7+), `socketCombatState.js` (1), `socketDice.js` (1), + le mirroir client
`CharacterSheet.jsx`/`CombatActionWindow.jsx`. Chaque lot qui touche un attribut primaire ou
secondaire doit rebrancher **tous** les sites pertinents dans la même passe — sinon un bonus visible
sur la fiche n'aurait aucun effet en résolution de combat (ou l'inverse), ce qui serait pire que le
statu quo. Ce n'est pas une raison de tout faire d'un coup, mais chaque lot doit être complet sur
son propre périmètre avant d'être considéré clos.

---

## Lots (ordre proposé : du plus mécanique/combat vers le plus narratif)

### Lot 1 — Attributs primaires : détail ligne-à-ligne

**Périmètre** : `ref_mutations.mod_FOR/CON/COO/INT/VOL/PRE` uniquement (aucun avantage n'en cible —
`ADA`/`PER` ne sont ciblés par aucune mutation non plus, ils resteront toujours à modificateur 0).
`char_mutation_effects_view` (migration 109) fait déjà la somme + le stacking correctement — ce lot
ne construit aucun moteur, juste une requête sur cette vue + un paramètre de plus dans `calcNA`.

**Décisions Saar (2026-07-10) — pas de bricolage, on corrige les deux gaps trouvés en profondeur** :
1. La convention PI4 (FOR d'encombrement qui ignore génotype/mutations) est un **vrai gap** — on le
   corrige, on ne se contente pas de documenter l'exclusion.
2. La duplication de calcul sur 3 sites (serveur + 2 client) est **anormale** — on consolide vers
   une implémentation unique (Option B), pas de réimplémentation locale supplémentaire.
Ces deux décisions élargissent le Lot 1 (ce n'est plus seulement "ajouter un paramètre") mais
restent une seule mécanique : "l'attribut FOR/CON/COO/INT/VOL/PRE effectif d'un personnage doit se
calculer à un seul endroit, et partout où il est utilisé".

**A. Consolidation — `shared/polarisUtils.js` devient le point de calcul unique**

Recherche complémentaire en préparant cette section : `shared/polarisUtils.js` a déjà **sa propre**
copie de `AN_TABLE`/`calcAN` (lignes 7-24), strictement équivalente mais distincte de celle de
`server/src/lib/charStats.js` (lignes 62-75, 200-203) — **une 3ᵉ duplication silencieuse trouvée**,
même famille que celle que Saar vient de signaler pour `calcNA`. Elle rentre dans la même
correction : `charStats.js` doit importer `AN_TABLE`/`calcAN` depuis `shared/polarisUtils.js` au
lieu d'en garder une copie.

```js
// shared/polarisUtils.js — AJOUTS (AN_TABLE/calcAN déjà présents, inchangés)

export const ATTR_TO_GENOTYPE_MOD = { FOR: 'mod_for', CON: 'mod_con', COO: 'mod_coo', ADA: 'mod_ada', PER: 'mod_per', INT: 'mod_int', VOL: 'mod_vol', PRE: 'mod_pre' }
export const ATTR_TO_MUTATION_MOD = { FOR: 'mod_FOR', CON: 'mod_CON', COO: 'mod_COO', INT: 'mod_INT', VOL: 'mod_VOL', PRE: 'mod_PRE' }  // ADA/PER absents exprès

export function getGenotypeModForAttr(genotypeRow, attrId) {
  if (!genotypeRow) return 0
  const col = ATTR_TO_GENOTYPE_MOD[attrId]
  return col ? (genotypeRow[col] ?? 0) : 0
}

export function getMutationModForAttr(mutationEffectsRow, attrId) {
  if (!mutationEffectsRow) return 0   // aucune mutation active → ligne absente de la vue
  const col = ATTR_TO_MUTATION_MOD[attrId]
  return col ? (mutationEffectsRow[col] ?? 0) : 0
}

// TOTAL_MALUS déménage ici avec calcNA (actuellement constante module-locale de charStats.js,
// toujours 0 en V1 — historique XP non implémenté)
const TOTAL_MALUS = 0

export function calcNA(base_level, pc_modifier, mod_genotype, mod_mutation) {
  const raw = (base_level ?? 7) + (pc_modifier ?? 0) + (mod_genotype ?? 0) + (mod_mutation ?? 0) - TOTAL_MALUS
  return Math.max(3, raw)
}
```

`server/src/lib/charStats.js` — **supprime** ses définitions locales de `AN_TABLE` (62-75),
`ATTR_TO_GENOTYPE_MOD` (50-59), `getGenotypeModForAttr` (188-193), `calcNA` (195-198), `calcAN`
(200-203) ; **importe** les 5 depuis `shared/polarisUtils.js` (déjà importé pour `polarisRound`,
ligne 15 — même import étendu). `calcAttributeAN`/`calcAttributeNA` (205-218) restent dans
`charStats.js` (elles font le lookup dans le tableau `attrs` — forme de donnée propre au serveur) ;
gagnent un 4ᵉ paramètre `mutationEffectsRow`, résolu via `getMutationModForAttr` importé.
`calcSkillTotal` (222) gagne un 5ᵉ paramètre `mutationEffectsRow`, propagé aux 2 appels internes.

**Question laissée ouverte, à trancher séparément si besoin** : `calcAttributeAN`/`calcAttributeNA`
elles-mêmes ne sont pas consolidées avec le client dans ce lot — le client représente ses attributs
en objet (`attrs.FOR.base`) alors que le serveur utilise un tableau de lignes DB
(`attrs.find(a => a.attr_id === attrId)`). Consolider ce niveau-là impliquerait de réécrire la forme
de state de `CharacterSheet.jsx` (tous les inputs d'attributs), un chantier plus large que "un seul
calcul". Ce lot consolide **le calcul pur** (`calcNA`/`calcAN`/les résolveurs de modificateur) —
plus rien n'est dupliqué à l'arithmétique près — sans toucher à la forme des données de chaque
côté. À signaler explicitement plutôt qu'à trancher silencieusement.

**B. `server/src/services/mutationService.js`** — nouvelle fonction (accès DB, ne bouge pas dans
`shared/` qui reste sans accès DB) :
```js
export async function getMutationEffects(sheetId) {
  return (await db('char_mutation_effects_view').where({ char_sheet_id: sheetId }).first()) ?? null
}
```
Nommage générique (pas `...AttributeMods`) car la ligne retournée contient aussi
résistances/identité, consommées par les Lots 3/6 sans réinventer une fonction quasi identique.

**C. Sites serveur à rebrancher** — chacun ajoute `getMutationEffects(sheetId)` juste après
son fetch existant de `genotypeRow`, puis passe le résultat en dernier argument :

| Fichier | Lignes | Contexte actuel | Personnage(s) concerné(s) |
|---|---|---|---|
| `char-sheet.js` | 480-493 | `POST /skills/buy` — validation prérequis `SKILL_MIN` (`calcSkillTotal`) | le personnage lui-même |
| `char-sheet.js` | 968-978 | `GET /:characterId/weapon-skill/:weaponInvId` (`calcSkillTotal`) | le personnage lui-même |
| `char-sheet.js` | 1566-1597 | `POST /:characterId/macro-preview` (`na()`/`calcAttributeNA` + `calcSkillTotal`) | le personnage lui-même |
| `socketEntity.js` | 222-243 | résolution jet déplacement (`calcSkillTotal`/`calcAttributeAN`) | le personnage du jeton déplacé |
| `socketEntity.js` | 525-535 | interaction (`calcAttributeNA`) | le personnage du jeton |
| `socketCombatHelpers.js` | 404-419 | attaquant CaC (`calcSkillTotal` + `calcAttributeNA` FOR) | attaquant |
| `socketCombatHelpers.js` | 447-456 | sous-jet Acrobatie/Équilibre attaquant (terrain instable, `calcSkillTotal`) — réutilise `genoAttaquant` déjà fetché en 404-419, pas de nouvelle requête | attaquant |
| `socketCombatHelpers.js` | 558-571 | défenseur CaC (`calcAttributeNA` FOR/CON/VOL + `calcSkillTotal`) | défenseur |
| `socketCombatHelpers.js` | 624-639 | sous-jet Acrobatie/Équilibre défenseur (terrain instable, `calcSkillTotal`) — réutilise `genoDef` déjà fetché en 628-635 (re-fetch conditionnel existant, même bloc) | défenseur |
| `socketCombatHelpers.js` | 1096-1110 | `fetchCibleNA(charId, sheetId)` — helper réutilisé plusieurs fois (tir vs cible) | cible (via helper, un seul point à modifier) |
| `socketCombatHelpers.js` | 1305-1328 | tireur (`calcSkillTotal` + `calcAttributeNA` FOR) | tireur |
| `socketCombatHelpers.js` | 1412-1421 | cible (bloc inline dupliqué de `fetchCibleNA`, pas le même endroit) | cible |
| `socketCombatResolution.js` | 512-518 | sous-jet Acrobatie/Équilibre défenseur (`calcSkillTotal`), fetch `genoCibleDef` propre (512-516) | cible/défenseur |
| `socketCombatState.js` | 70-79 | initiative (`calcAttributeNA` ADA/PER uniquement) | **différé** — ADA/PER jamais ciblés par une mutation, aucun effet observable dans ce lot ; à revisiter seulement si un lot futur touche ADA/PER |
| `socketDice.js` | 98-129 | jet macro (`na()`/`calcAttributeNA` + `calcSkillTotal`) — duplique le pattern de `char-sheet.js` macro-preview (dette préexistante, pas traitée dans ce lot) | le personnage lui-même |

**Point de vigilance** : comme `mutationEffectsRow` est nullish-safe (`?? 0`), oublier un site ne
fait rien planter — le bonus reste silencieusement non appliqué à cet endroit précis (même pattern
que P54/P56 dans `CLAUDE.md`). Le plan de test (section G) compare l'AN calculé sur la fiche et
l'AN calculé en résolution de combat pour un même personnage/attribut, pas seulement chaque site
isolément.

**D. Encombrement (PI4) — gap corrigé, pas documenté comme exclusion**

**Table corrigée après vérification exhaustive (2 sites manqués au premier passage — grep initial
limité aux 3 endroits déjà repérés au lieu de chercher tous les appelants de
`calcEncumbrancePenalty`/toutes les occurrences de `forValue`)**. 5 sites au total calculent
aujourd'hui `forValue = base_level + pc_modifier` en contournant `calcAttributeNA` :

| Fichier | Lignes | Contexte | Correction |
|---|---|---|---|
| `char-sheet.js` | 882-885, 930-931 | `GET /:characterId/inventory` — `forValue`, `threshold = forValue*3`, `iniPenalty` | route ne fetch aujourd'hui ni `archetype` ni mutations ni `settings` — ajouter les 3 fetch, remplacer `forValue` brut par `calcAttributeNA(attrs, 'FOR', genotypeRow, mutationEffects)` |
| `socketCombatHelpers.js` | 410-419 | attaquant CaC — `for_na_attaquant` déjà calculé via `calcAttributeNA` en 416 (pour `modDom`/`carenceArmure`), juste après le `forValue` brut (411) | réordonner : calculer `for_na_attaquant` en premier, réutiliser pour `calcEncumbrancePenalty`, supprimer le calcul brut séparé |
| `socketCombatHelpers.js` | 573-580 | **trouvé en revérification** — défenseur CaC (`forValueDef`/`defenderEffectiveMalus`), aucun `calcAttributeNA` FOR équivalent déjà calculé juste à côté ici (contrairement à l'attaquant) | ajouter `calcAttributeNA(attrsCible, 'FOR', genoCible, mutationEffectsCible)` (genoCible déjà disponible dans ce bloc, cf. tableau C) à la place de `forValueDef` brut |
| `socketCombatHelpers.js` | 1317-1329 | tireur — `for_na_tireur` déjà calculé via `calcAttributeNA` en 1326, juste après le `forValue` brut (1319, commenté `// PI4`) | même réordonnancement que l'attaquant CaC |
| `socketEntity.js` | 246-266 | **trouvé en revérification** — résolution d'action (déplacement/interaction), `forAttr`/`forValue` bruts, aucun fetch `genotypeRow`/mutations dans ce bloc actuellement | ajouter fetch `archetype`/`genotypeRow`/`getMutationEffects`, remplacer par `calcAttributeNA` |

**Vérifié en même temps** : aucun calcul client équivalent — `InventoryPanel.jsx` et
`ArmorWoundPanel.jsx` affichent `total_weight`/`threshold`/`ini_penalty` reçus tels quels du
serveur (`GET /inventory`), sans recalcul local. La correction du serveur suffit, aucun fichier
client à toucher pour l'encombrement.

**Option de campagne associée (demande Saar)** — nouvelle entrée dans
`server/src/lib/campaignSettingsService.js` `SETTINGS_SCHEMA` :
```js
encumbrance_enabled:    { type: 'boolean', default: true },   // true = comportement actuel préservé
encumbrance_multiplier: { type: 'number',  default: 3 },      // formule actuelle : FOR × 3
```
Défauts à `true`/`3` : la mécanique est **déjà active sans aucun gate aujourd'hui** — un défaut
différent changerait silencieusement le comportement de toutes les campagnes existantes (même
raisonnement que `pnj_unlimited_ammo`/`shock_auto_stun`, déjà `true` par défaut dans ce même schéma
pour la même raison). `routes/campaigns.js` (validation `PUT /:id`, ligne 204 pattern
`action_timer_sec`) : ajouter une borne `encumbrance_multiplier > 0`. `calcEncumbrancePenalty
(totalWeight, forValue, multiplier = 3)` (`charStats.js`) gagne un 3ᵉ paramètre ; `char-sheet.js`
calcule aussi `threshold = forValue * multiplier` (même variable `multiplier`, pas un 2ᵉ magic
number local) ; chaque site du tableau ci-dessus lit `settings.encumbrance_enabled` (skip le malus
— et éventuellement le fetch mutations/genotype si non nécessaire ailleurs — si `false`) et passe
`settings.encumbrance_multiplier`. `socketCombatHelpers.js` importe déjà `getCampaignSettings`
(utilisé ailleurs dans le fichier pour `reload_mode`/`pnj_unlimited_ammo`, pas dans ces 3 blocs) —
`socketEntity.js` ne l'importe pas du tout, à ajouter. UI : `client/src/components/
campaignSettings/SectionGameRules.jsx` — même pattern que `action_timer_sec` (checkbox + input
number), clés i18n `settings.encumbranceEnabledLabel/Hint` + `settings.encumbranceMultiplierLabel/
Hint`.

**E. Client**
- `server/src/routes/character/char-sheet.js` lignes 93-108 (`GET /:characterId`) : ajouter
  `db('char_mutation_effects_view').where({ char_sheet_id: sheet.id }).first()` au `Promise.all`
  existant, exposer `mutationEffects: mutationEffects || null` dans la réponse JSON. Un seul point
  d'entrée pour tout le client — pas de nouvel endpoint.
- `client/src/character/CharacterSheet.jsx` : **supprime** `calcNA` local (ligne 72), importe
  `calcNA`/`getGenotypeModForAttr`/`getMutationModForAttr` depuis `shared/polarisUtils.js` (déjà
  importé pour `calcAN`/`polarisRound`/etc., même ligne 34). `getModGen` (174-177, actuellement
  `genotypeData[`mod_${attrId.toLowerCase()}`] || 0`, une 4ᵉ variante ad-hoc du même mapping) →
  remplacé par `getGenotypeModForAttr(genotypeData, attrId)`. `naMap` (179-184) ajoute le terme
  mutation via `getMutationModForAttr(mutationEffects, id)`. Nouvel état `mutationEffects` chargé
  avec le reste du sheet (254-259).
- `client/src/components/CombatActionWindow.jsx` lignes 175-190 : **supprime** le `calcNA` local
  (closure inline), importe les mêmes fonctions partagées ; `sheetRes.data.mutationEffects`
  désormais disponible (même route).

**F. Ce qui ne change PAS**
- `char_attributes` (`base_level`/`pc_modifier`) : aucune écriture, lecture seule ajoutée ailleurs.
- Compétences secondaires (REA/Seuils/Souffle) : inchangées dans ce lot (Lot 2/3).
- `mutationService.js` add/remove/get existants : aucune modification, juste une fonction en plus.
- `socketCombatState.js` (initiative) : différé, cf. tableau C.
- Forme du state attributs côté client (objet vs tableau serveur) : non unifiée, cf. question
  ouverte en fin de section A.

**G. Cas limites à tester**
- Personnage sans mutation active → `mutationEffectsRow = null` partout → comportement strictement
  identique à aujourd'hui pour les attributs (non-régression).
- Mutation stackée (ex. "Peau renforcée" ×2, "Caractère félin" seul suffit pour COO+2) → vérifier
  que la vue retourne déjà la valeur cumulée correcte (pas recalculée côté appelant).
- Combat CaC/tir avec attaquant ET cible ayant des mutations différentes → les deux
  `mutationEffectsRow` récupérés séparément par `char_sheet_id`, jamais confondus.
- Mutation octroyée en jeu (Lot D, `source='campaign'`) vs choisie au Wizard (`source='chosen'`) :
  la vue ne distingue pas la source → doit fonctionner identiquement pour les deux.
- Fiche (`CharacterSheet.jsx`) et résolution de combat (`socketCombatHelpers.js`) doivent produire
  le **même** AN pour un même personnage/attribut après ce lot.
- `encumbrance_enabled = false` → aucun malus d'encombrement nulle part (3 sites), quel que soit le
  poids porté. `encumbrance_enabled = true` (défaut) + mutation FOR+X → seuil de charge augmenté en
  conséquence (le gap PI4 est réellement corrigé, pas juste déplacé).
- Non-régression `AN_TABLE`/`calcAN` : les deux tables (désormais unifiées) doivent produire
  exactement les mêmes valeurs qu'avant sur toute la plage -∞..25+ (vérifiable par un test croisé
  avant suppression de la copie `charStats.js`).

**Lot 1 ✅ CLOS — Session 141 (suite 13) (2026-07-10).** Codé comme détaillé ci-dessus (consolidation
`shared/polarisUtils.js`, PI4 corrigé sur les 5 sites réels, option `encumbrance_enabled`/
`_multiplier`, ~20 sites serveur+client rebranchés). **4 bugs supplémentaires trouvés en testant
avec Saar, tous corrigés dans la foulée (même chantier, cause commune : mutations à sous-table
jamais branchées de bout en bout)** :
- **Vue aveugle aux sous-types** — `char_mutation_effects_view` ne lisait que `ref_mutations`,
  jamais `ref_mutation_subtypes` : "Caractère génétique animal" (seule mutation `has_subtable`,
  migration 95) porte tous ses `mod_FOR..PRE` sur la table enfant, pas la ligne parente (à 0 par
  défaut) — la vue retournait donc toujours 0 pour cette mutation, quel que soit le sous-type
  choisi. Migration `127_char_mutation_effects_view_subtypes.js` (`LEFT JOIN
  ref_mutation_subtypes`).
- **Sélecteur de sous-type manquant côté Lot D** — `AdvantagesPanel.jsx` n'avait jamais eu de
  sélecteur de sous-type (`handleAddMutation` n'envoyait aucun `subtype_id`). Ajout d'une étape de
  drill-down (`step: 'mutation-subtype'`) + `mutationService.addMutation(sheetId, mutationId,
  subtypeId)` (upsert sur le bon index partiel selon présence du sous-type — deux arbiters
  distincts, Postgres l'exige) + `ref.js`/`getMutations()` exposent désormais `subtable`/
  `subtype_name`.
- **État client jamais rafraîchi** — `AdvantagesPanel` notifiait `onSaved` (simple ✓ visuel dans
  `CharacterWindow.jsx`, ne recharge rien) après un ajout/retrait de mutation — `CharacterSheet.jsx`
  ne redemandait jamais `mutationEffects`, resté figé jusqu'à fermeture/réouverture complète.
  Nouvelle route légère `GET /char-sheet/:characterId/mutation-effects` + callback dédié
  `onMutationsChanged` (distinct d'`onSaved`) appelé après ajout/retrait.
- **Bug le plus sérieux — `bigint` retourné comme `string` par `node-pg`** : `SUM()` sur une colonne
  `integer` produit un `bigint` en PostgreSQL, que le driver parse en **chaîne JS** (pas un nombre),
  latent dans la vue depuis sa création (jamais consommée avant ce lot). `calcNA` faisait
  `10 + 0 + 0 + '2'` → concaténation de chaîne (`'102'`) au lieu d'une addition (`12`) — cause exacte
  du "COO Niveau Actuel = 110" signalé par Saar. **Erreur de vérification de ma part** : j'avais vu
  `mod_COO: '2'` entre guillemets dans mes propres tests et ne l'avais pas identifié comme un
  problème de type. Migration `128_char_mutation_effects_view_int_cast.js` (cast `::integer` sur
  les 13 colonnes numériques — `CREATE OR REPLACE VIEW` refuse de changer un type de colonne
  existant, `DROP`+`CREATE` obligatoire, piège Postgres documenté dans la migration). Audit du reste
  du code pour le même risque : un seul autre endroit trouvé (`char-sheet.js` potentiel drone),
  déjà protégé correctement (`Number(row.total)`) — pas d'autre cas caché.
- **Testé** : `node --check` 0 erreur sur tous les fichiers serveur/partagés touchés, ESLint 0
  nouvelle erreur (client, confirmé `git stash` avant/après sur chaque fichier), `fr.json` valide,
  scénarios `node -e` (non-régression `calcAN`/`calcNA`, `calcEncumbrancePenalty` avec/sans
  multiplicateur), **plusieurs vérifications instrumentées en base réelle en transaction annulée**
  (jamais de donnée réelle modifiée hors du flux normal de l'app) confirmant chaque correctif avant
  et après (vue sans/avec sous-type, type `bigint`→`integer`, upsert sous-type). **SR + parcours
  navigateur confirmé fonctionnel par Saar** (Lot D avec sélection de sous-type, effet COO+2 visible
  immédiatement sur la fiche sans rechargement).
- **Non testé** : effet en résolution de combat réelle (jet de compétence COO reflétant le bonus,
  vérifié seulement par lecture/scénarios `node -e`, pas par un jet réel en session) ; bascule
  `encumbrance_enabled`/`encumbrance_multiplier` en navigateur ; aperçu Wizard ("peek") après
  fermeture/réouverture explicite (hypothèse : même cause que le Lot D, non confirmée par Saar) ;
  les 6 autres attributs primaires avec une mutation autre que "Caractère félin".
- Détail complet : `docs/JOURNAL6.md` "Session 141 (suite 13)".

---

## Bilan / run à vide — 2026-07-11

État consolidé après clôture du Lot 1, avant d'attaquer le Lot 2.

**Non testé du Lot 1 — reste ouvert, à garder à l'esprit** (repris de la clôture ci-dessus, pas
retesté depuis) : effet en résolution de combat réelle (jet de compétence, vérifié seulement par
`node -e`) ; bascule `encumbrance_enabled`/`encumbrance_multiplier` en navigateur ; **aperçu Wizard
("peek") après fermeture/réouverture explicite — hypothèse posée (même cause que le bug de
rafraîchissement client) mais jamais confirmée par un test dédié de Saar**, à vérifier avant de
considérer le sujet clos plutôt que de le découvrir en plein Lot 3/4 ; les 6 autres attributs
primaires avec une mutation autre que "Caractère félin" ; retrait d'une mutation stackée (`count`
> 1) en conditions réelles.

**Piège à ne pas répéter, valable pour tous les lots suivants** : toute nouvelle requête `SUM()`/
agrégat SQL (vue ou requête directe) doit être castée `::integer` (ou vérifiée par `typeof` en
sortie) avant d'être consommée en arithmétique JS — c'est le bug le plus coûteux du Lot 1
(`bigint`→string node-pg→concaténation silencieuse), resté invisible jusqu'à la première vraie
consommation. Vérifier ce point systématiquement dès qu'un Lot introduit un nouvel agrégat.

### Lot 2 — Attributs secondaires (avantages uniquement en pratique) : détail ligne-à-ligne

**Périmètre exact `[VÉRIFIÉ]`** — lecture exhaustive des 76 lignes `92_ref_advantages.js`, aucune
supposition : seulement **3 lignes** ont `mod_attribute` non-null, aucune autre variante n'existe.

| `advantage_id` | Nom | `mod_attribute` | `mod_value` | `family_limit` |
|---|---|---|---|---|
| `adv_006` | Bons réflexes | `"reaction"` | `+3` | `null` |
| `adv_058` | Lent à réagir | `"reaction"` | `-3` | `null` |
| `adv_021` | Homo delphinus | `"breath"` | `+10` | `null` |

Aucune n'est liée par `family_limit` — rien n'empêche mécaniquement `adv_006`+`adv_058`
simultanément (contradictoire narrativement, mais pas interdit en base) : la somme algébrique doit
rester correcte dans ce cas plutôt que de nécessiter une exclusion mutuelle ad hoc.
Calculs visés : `calcREA` (reaction), `calcSouffle` (breath). **Aucune migration nécessaire** —
les colonnes existent depuis la migration 92. Prochain numéro libre si besoin futur : **134**
(129-133 déjà consommés par une session parallèle sur `docs/PLAN_VAULT.md`, vérifié `ls` avant
d'écrire ce chiffre — jamais se fier à `EN_COURS.md` seul, cf. P53).

**Recherche préalable (2026-07-11)** — demande explicite Saar : ne pas inventer d'architecture
maison pour agréger des modificateurs génériques `{cible, valeur}`, vérifier comment un projet pro
résout exactement ce problème avant de coder.
- **Foundry VTT — système "Active Effects"** ([doc officielle](https://foundryvtt.com/article/active-effects/),
  [API v14](https://foundryvtt.com/api/classes/foundry.documents.ActiveEffect.html)) : standard de
  facto des VTT pour appliquer des bonus provenant de sources multiples (objets, dons, conditions)
  à une statistique dérivée. Modèle exact : chaque effet déclare un triplet **`{key, mode, value}`**
  — `key` = chemin de la statistique cible, `mode` = comment combiner (`ADD` le plus courant),
  `value` = le nombre. *"Adds the provided value to a number... used to both add and subtract from
  a particular value."* Le moteur applique tous les effets actifs sur la donnée dérivée, jamais sur
  la donnée de base (pas de mutation destructive — cohérent avec le pattern déjà en place ici,
  "recompute à la lecture", jamais d'écriture, cf. section "Décision d'architecture" plus haut).
- **Wiki `foundryvtt/dnd5e`** ([Active Effect Guide](https://github.com/foundryvtt/dnd5e/wiki/Active-Effect-Guide)) :
  exemples concrets pour un bonus d'Initiative (`system.attributes.init.bonus`, mode `Add`,
  formule/valeur) — structurellement identique à `mod_attribute:"reaction"` / `mod_value`. Le wiki
  formule explicitement la raison de ce choix : *"Rather than building custom logic per feature,
  creators define which stat to modify and by how much, allowing the engine to handle application
  uniformly across all items and effects."* — **exactement l'architecture déjà retenue dans
  `ref_advantages`** (paire clé/valeur générique plutôt qu'une colonne par avantage). Confirme que
  la forme choisie il y a longtemps dans ce projet suit déjà le pattern standard, sans le savoir —
  ce lot ne fait qu'écrire le moteur d'application qui manquait encore.
- **Conséquence directe sur la conception** : mode `ADD` uniquement (somme simple) est le bon choix
  par défaut pour ce lot — les 3 lignes ci-dessus sont toutes des bonus/malus plats ("+3 à sa
  Réaction", "-3 à sa Réaction", "+10 à son Attribut Souffle", texte LdB `92_ref_advantages.js`).
  Un champ `mode` générique (ADD/OVERRIDE/MULTIPLY, comme Foundry) **n'est pas construit
  maintenant** — prématuré : la seule donnée déjà connue qui ne serait pas un ADD est `mod_identity`
  (Lot 6, `{hand_pref:"A"}` — une **assignation**, pas une accumulation numérique), catégorie
  différente à concevoir quand le Lot 6 sera détaillé à son tour (jamais deux lots à la fois).
  Corrobore la décision déjà prise dans `docs/PLAN_TIRVISE.md` (session parallèle, même
  raisonnement appliqué à un autre sous-système) : un moteur de règles généraliste façon PF2e
  "Rule Elements" ne se justifie que pour de l'authoring homebrew non-développeur — pas notre cas,
  catalogue fixe et fermé (76 lignes, jamais écrites par un joueur).

**A. `shared/polarisUtils.js` — résolveur générique + consolidation `calcREA`**

Forme différente de `getMutationModForAttr` (Lot 1) : les mutations ont des **colonnes fixes**
(`mod_FOR`, `mod_COO`...) sur une ligne agrégée par vue SQL ; les avantages stockent leur cible via
une **paire générique** (`mod_attribute` texte + `mod_value` nombre) sur une liste de lignes actives
— il faut filtrer/réduire côté JS, pas indexer une colonne. Petit factoring interne pour éviter de
dupliquer le même `reduce` deux fois (ce lot + Lot 3 `mod_resistance`/`mod_res_value`, forme
identique déjà visible dans le schéma actuel — pas une extrapolation hypothétique) :
```js
function sumModByKey(rows, keyField, valueField, targetKey) {
  if (!rows || !rows.length) return 0
  return rows.reduce((sum, r) => r[keyField] === targetKey ? sum + (r[valueField] ?? 0) : sum, 0)
}

export function getAdvantageAttrMod(advantageRows, attrKey) {
  return sumModByKey(advantageRows, 'mod_attribute', 'mod_value', attrKey)
}
```
`calcREA` **déménage ici** (actuellement dupliqué : `charStats.js:205-207` côté serveur ET en dur
dans `calcSecondary` de `CharacterSheet.jsx:90` côté client — même dette que `calcNA` au Lot 1 ;
nécessaire ici, pas cosmétique : sans ça la fiche client n'afficherait jamais le bonus d'avantage,
seule la résolution serveur en bénéficierait) :
```js
export function calcREA(ada_na, per_na, mod_advantage) {
  return polarisRound((ada_na + per_na) / 2) + (mod_advantage ?? 0)
}
```
`calcSouffle` **reste dans `charStats.js`** — pas de duplicata client à corriger, "Souffle" n'est
affiché nulle part sur la fiche aujourd'hui (`[VÉRIFIÉ]` grep), seulement consommé par les macros
serveur. Gagne juste un 3ᵉ paramètre sur place, aucun déménagement à faire.

**B. `server/src/lib/charStats.js`**
- Supprime la définition locale de `calcREA` (205-207), l'importe depuis `shared/polarisUtils.js`
  (déjà importé lignes 16-17 pour `calcNA`/`calcAN` — même import étendu).
- `calcSouffle(con_na, vol_na, mod_advantage)` (258-260) : `+ (mod_advantage ?? 0)`.
- `calcSeuils`/`getModDom` : **inchangés** — aucun avantage ne cible FOR/CON/VOL de cette façon
  (`[VÉRIFIÉ]` sur les 76 lignes), hors périmètre de ce lot.

**C. `server/src/services/advantageService.js`**
- `getAdvantages(sheetId)` (12-22) : ajoute `'ra.mod_attribute', 'ra.mod_value'` au `.select(...)`.
  Une ligne. Cette fonction sert déjà l'affichage `AdvantagesPanel` (champs ignorés côté UI) — elle
  sert désormais aussi la résolution mécanique aux 4 sites du tableau D, pas de nouvelle fonction.
- **Choix délibéré : pas de VIEW SQL dédiée façon `char_mutation_effects_view`.** Les mutations ont
  une vue parce qu'elles **stackent** (colonne `count`, `stack_deltas`) — l'agrégation doit se faire
  côté SQL pour rester correcte. Les avantages **ne stackent jamais** (contrainte unique partielle
  `char_sheet_id`+`advantage_id` sur les lignes actives, `[VÉRIFIÉ]` `advantageService.js`) : une
  poignée de lignes (`~10` au grand maximum pour un personnage), réduction en JS strictement
  équivalente et plus simple — pas un raccourci, une vraie différence de forme de données entre les
  deux catalogues (déjà notée dans "Recoupement réel" en tête de ce document).

**D. Sites serveur à rebrancher (4, tous `[VÉRIFIÉ]` par lecture — aucun ne fetch les avantages
aujourd'hui, aucun n'importe encore `shared/polarisUtils.js` directement)**

| Fichier | Lignes | Contexte | Changement |
|---|---|---|---|
| `char-sheet.js` | 1642-1658 (`POST /macro-preview`) | `rea`/`souffle` via `secondaryValue()` | Ajoute `getAdvantages(sheet.id)` au `Promise.all` (déjà importée ligne 42) ; nouvel import `getAdvantageAttrMod` depuis `shared/polarisUtils.js` (absent aujourd'hui) ; passe `getAdvantageAttrMod(advantages,'reaction'/'breath')` |
| `socketDice.js` | 99-116 (jet macro) | idem, duplique le pattern | Idem : nouvel import `getAdvantages` (`advantageService.js`, absent) + `getAdvantageAttrMod` (`shared/polarisUtils.js`, absent) dans le `Promise.all` existant |
| `socketCombatState.js` | 66-80 (`COMBAT_START`, `base_ini` par token) | `calcREA(ada_na, per_na)` | Ajoute `getAdvantages(cs.id)` dans le même bloc que `attrs`/`archetype` (seulement si `cs` existe — même garde que l'existant) ; passe le mod à `calcREA` |
| `battlemaps.js` | 66-80 (`GET /:id/combat-ini`, aperçu `CombatRosterWindow`) | idem | Même changement — nouvel import `getAdvantages` (seul `calcAttributeNA`/`calcREA` importés aujourd'hui) |

Point de vigilance identique au Lot 1 : oublier un site ne fait rien planter — juste un REA/Souffle
silencieusement non boosté à cet endroit précis. Le plan de test (section G) compare les 4 sites
entre eux pour un même personnage, pas seulement chacun isolément.

**E. Client — `CharacterSheet.jsx`**
- Import `calcREA`/`getAdvantageAttrMod` depuis `shared/polarisUtils.js` (déjà importé ligne 34
  pour `calcNA`/`calcAN`/`getGenotypeModForAttr`/`getMutationModForAttr` — même ligne étendue).
- `calcSecondary(naMap)` (83-97) → `calcSecondary(naMap, charAdvantages)` : remplace
  `const rea = polarisRound((ADA + PER) / 2)` par
  `const rea = calcREA(ADA, PER, getAdvantageAttrMod(charAdvantages, 'reaction'))`.
  `initiative = rea` inchangé (déjà aliasé, aucun changement séparé nécessaire).
- Call site ligne 203 : `useMemo(() => calcSecondary(naMap, charAdvantages), [naMap, charAdvantages])`.
- Aucun nouveau fetch : `charAdvantages` déjà chargé (lignes 325-326) — contiendra
  `mod_attribute`/`mod_value` dès que le point C est fait côté serveur.
- `calcModDom` (77-81, doublon local de `getModDom` serveur — même famille de dette que `calcREA`
  avant ce lot) : **non touché**, hors périmètre (aucun avantage ne le cible, vérifié).

**F. Ce qui ne change PAS**
- `char_advantages`/`ref_advantages` : aucune écriture, lecture seule ajoutée.
- `AdvantagesPanel.jsx` `handleRemove` : filtre déjà `charAdvantages` côté client sans re-fetch — la
  fiche recalculera automatiquement REA via le nouveau `useMemo` (dépendance `charAdvantages`),
  rien à changer dans ce fichier.
- Wizard (`Step5Advantages.jsx`/`WizardReview.jsx`) : ne calcule/affiche REA ni Souffle nulle part,
  `[VÉRIFIÉ]` grep — rien à toucher.
- `CombatActionWindow.jsx` : ne consomme pas REA/Souffle, `[VÉRIFIÉ]` grep.
- Drones (INI fixe 12, branche dédiée `socketCombatState.js:60-64`) : aucun `char_sheet`, donc
  aucun avantage à fetcher — chemin déjà exclu du calcul REA, inchangé.

**G. Cas limites à tester**
- Personnage sans avantage actif → `getAdvantageAttrMod([], 'reaction') = 0` → REA/Souffle
  identiques à avant (non-régression) aux 4 sites serveur + fiche client.
- `adv_006` seul (+3 reaction) → REA/initiative +3 partout, Souffle inchangé.
- `adv_058` seul (-3 reaction) → REA -3.
- `adv_006` + `adv_058` en même temps (pas de contrainte qui l'empêche, vérifié) → somme algébrique
  0 (comportement "addition simple" assumé, cf. recherche Foundry ci-dessus).
- `adv_021` seul (+10 breath) → Souffle +10, REA inchangé (colonnes filtrées indépendamment par clé).
- Retrait d'un avantage via `AdvantagesPanel` → REA redescend immédiatement sur la fiche (pas de
  rechargement nécessaire, `charAdvantages` déjà dans les deps du `useMemo`).
- Fiche (`CharacterSheet.jsx`) et résolution combat (`socketCombatState.js`/`battlemaps.js`)
  doivent produire le même REA pour un même personnage.
- Non-régression : `getAdvantages()` avec les 2 colonnes en plus ne casse pas `AdvantagesPanel.jsx`
  (champs additionnels ignorés par l'affichage, pas de select strict côté composant).

### Lot 3 — Résistances (recoupement réel mutations + avantages)
- Source : `ref_mutations.mod_res_damage/shock/drugs/disease/poison/radiation` **et**
  `ref_advantages.mod_resistance ∈ {"damage","shock"}` / `mod_res_value`.
- Calcul visé : `calcResistanceDommages(for_na, con_na)` (table lookup — ajouter un bonus plat
  post-lookup) ; `res_shock`/"Résistance Choc" à vérifier `[INCONNU]` **avant de coder** — recherche
  exhaustive faite cette session : `calcResistanceNaturelle()` existe dans `charStats.js` mais
  n'est appelé **nulle part** en combat, et `mod_res_shock`/`res_shock` n'apparaissent que dans les
  migrations, jamais dans la résolution de combat. Il est possible que "Résistance Choc" soit un
  concept mort mécaniquement, pas seulement débranché des mutations/avantages — à confirmer contre
  `docs/REGLESYSCOMBAT.md`/`docs/REGLEARMURE.md` avant de coder ce lot. **Toujours non tranché au
  bilan du 2026-07-11** — reste la première chose à faire à l'ouverture de ce lot.
- `drugs`/`disease`/`poison`/`radiation` (mutations uniquement) : aucune résolution de jet
  correspondante trouvée non plus (`resistance_drogues` existe côté macro/dé mais calcule un seuil
  brut CON/VOL, sans bonus de résistance) — même vérification requise.

### Lot 4 — Armure naturelle + arme naturelle (mutations uniquement — nouveau mécanisme combat)
- `natural_armor` : colonne structurée (entier), utilisable en théorie pour s'ajouter à
  `calcResistanceArmure`/l'armure portée — mais **aucune stacking rule armure naturelle + portée
  n'existe actuellement**, à concevoir.
- **Arme naturelle — écart trouvé cette session, plus large que prévu** : contrairement à l'ancien
  schéma V1 (migration 38, `nom_arme_naturelle`/`degats_physiques`/`degats_choc`), le schéma V2
  actuel (migration 95) **n'a aucune colonne structurée pour les dégâts d'arme naturelle**. Les
  dégâts ("Griffes" : *"Dégâts: 1D10+3 + mod CaC..."*) sont entièrement en texte libre dans
  `special_effect`. Utiliser une arme naturelle en combat (Griffes/Crocs/Corne/Excroissance
  osseuse) nécessiterait soit une nouvelle migration (colonnes structurées, réintroduisant l'info
  perdue à la migration 94), soit un nouveau mécanisme combat pour un "type d'attaque" jamais prévu
  aujourd'hui (`ref_equipment`/`ref_equipment_skill_assoc` sont pensés pour du matériel, pas des
  attributs de personnage). **Lot le plus lourd du plan** — à confirmer en priorité basse.

### Lot 5 — Déblocage de compétences (`[CS7]` mutations + généralisation avantages)
- Mutations : `SkillsPanel.jsx:135-141` (`activeMutations`) lit `charAdvantages.type==='MUTATION'`/
  `.muta_numero` — champs qui n'existent dans aucune ligne V2 réelle (`char_advantages` n'a jamais
  eu ces colonnes depuis la migration 99) → Set **toujours vide**, 10 compétences structurellement
  invisibles (`ref_skill_requirements where type='MUTATION'`, 10 lignes, dont
  `MAITRISE_DE_LA_FORCE_POLARIS`/`MAITRISE_DE_LECHO_POLARIS`).
- **Écart supplémentaire trouvé cette session** : `ref_skill_requirements.value` pour ces 10 lignes
  utilise encore les **anciens identifiants V1** (`muta_011`, `muta_016`, `muta_019`, `muta_020`,
  `muta_025`, `muta_026`, `muta_029`, `muta_031`, `muta_033` — table `ref_mutations` V1, migration
  38, supprimée par la migration 94). Le fix ne peut donc pas se contenter de changer la source de
  lecture (`char_advantages` → `char_mutations`) : il faut aussi établir la correspondance
  `muta_XXX` (V1) → `mutation_id`/`name` (V2), par exemple via une table de correspondance ou en
  réécrivant `ref_skill_requirements.value` avec les vrais `mutation_id` V2 (migration dédiée).
- **Interaction à surveiller avec `AdvantagesPanel.jsx` Lot A** : `MAITRISE_DE_LA_FORCE_POLARIS`/
  `MAITRISE_DE_LECHO_POLARIS` ont un prérequis `type:'MUTATION', value:'muta_029'` — un gate
  distinct de celui d'`AdvantagesPanel.jsx` (`adv_079` "Force Polaris"), actuellement inopérant
  (Set toujours vide) mais qui redeviendrait un vrai blocage contradictoire si ce lot est corrigé
  sans revoir ce prérequis (un personnage avec `adv_079` mais sans la mutation `muta_029` resterait
  bloqué). À trancher dans le détail ligne-à-ligne de ce lot.
- Avantages : généraliser le gate actuellement câblé en dur sur `adv_079` (`hasForcePolaris` dans
  `AdvantagesPanel.jsx`) — mécanisme de satisfaction de prérequis, pas de modification de stat,
  distinct des Lots 1-3 mais même famille de bug (donnée jamais lue génériquement).

### Lot 6 — Identité (`mod_sex`/`mod_fertility` mutations vs `mod_identity` avantages)
- Mutations : **déjà câblé** (`mutationService.js`/`creationService.js` STEP3, override
  `sex`/`is_fertile` à l'ajout) — rien à faire ici, juste noté pour mémoire de cohérence.
- Avantages : `mod_identity` toujours lu en dur par ID (`adv_076`→`is_fertile`, `adv_002` jamais
  appliqué malgré `mod_identity: {hand_pref: "A"}` déclaré) — généraliser vers une lecture générique
  de la colonne JSONB, cohérente avec ce que les mutations font déjà.

### Lot 7 — Narratif / économie (avantages uniquement, priorité basse)
- `mod_savings`, `mod_monthly_income`/`mod_monthly_income_formula`, `mod_gauges`, `mod_conditions`,
  `mod_skill_points`, `mod_age` — aucun équivalent mutation, aucun impact combat/jet direct. Reste
  gérable manuellement par le MJ sans bloquer le jeu (cohérent avec l'ancienne "Piste C" : narratif
  après mécanique).

---

## Impact / risque si on ne fait rien

Aucune régression introduite par le Lot D — ce gap existait déjà pour tout personnage créé par le
Wizard, silencieusement, depuis le début du projet. Pas d'urgence technique — manque de
fonctionnalité, pas un bug qui casse quelque chose de fonctionnel.

## Prochaine étape

**Lot 1 ✅ CLOS — Session 141 (suite 13), fonctionnel confirmé Saar** (voir détail de clôture en fin
de section Lot 1 ci-dessus). **Lot 2 (Attributs secondaires) à détailler ligne-à-ligne avec Saar
quand il voudra enchaîner** — même méthode que le Lot 1 (plan écrit, analyse à charge, vérification
instrumentée en base réelle avant tout code, jamais deux lots à la fois).
