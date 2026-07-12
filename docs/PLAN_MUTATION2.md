# PLAN_MUTATION2 — Effets mécaniques des Mutations et Avantages jamais appliqués
> Session 141 (suite 25) — 2026-07-12 (Lot 4 : plan complet écrit, aucun code — Lot 3 clos suite 23,
> Lot 2 clos suite 6/RESNAT, Lot 1 clos suite 13, voir aussi suite 10, diagnostic/architecture initiale)
> Statut : **DIAGNOSTIC + ARCHITECTURE**. Lots 1-3 codés et clos, fonctionnels confirmés Saar. **Lot 4
> planifié** (2 sous-lots, 3 décisions d'architecture actées avec Saar — voir section Lot 4), prêt
> pour code à la prochaine reprise. Découpé en 7 lots (mécanique visée, pas catalogue source). Chaque
> lot est détaillé ligne-à-ligne au moment de l'attaquer (règle "un sujet à la fois") — les lots non
> encore attaqués ne fixent que le périmètre et l'ordre.

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
| `socketCombatHelpers.js` | 410-419 | attaquant CaC — `for_na_attaquant` déjà calculé via `calcAttributeNA` en 416 (pour `modDom`), juste après le `forValue` brut (411) — **lignes décalées depuis, `calcCarenceArmure` effacée session 141 suite 16, revérifier les numéros avant exécution** | réordonner : calculer `for_na_attaquant` en premier, réutiliser pour `calcEncumbrancePenalty`, supprimer le calcul brut séparé |
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
- **Pathfinder 2e (Foundry) — `StatisticModifier`/`ModifierPF2e`** ([source `modifiers.ts`](https://github.com/foundryvtt/pf2e/blob/master/src/module/actor/modifiers.ts)) :
  le système de RPG le plus abouti sur Foundry pour ce problème précis. Chaque modificateur y porte
  `{label, type, modifier, enabled, source, predicate}` (pas juste un nombre), et
  `applyStackingRules()` **ne fait pas une simple somme** : par `type` (`circumstance`/`item`/
  `status`/`untyped`/...), un seul bonus (le plus élevé) et un seul malus (le plus bas) s'appliquent
  — seuls les modificateurs `untyped` s'additionnent librement. Objectivement une architecture plus
  aboutie qu'une somme brute. **Vérifié contre la source de vérité avant d'adopter quoi que ce soit
  de ce pattern** : recherche `[VÉRIFIÉ]` dans `docs/SYSTEME/REGLES_LdB.md`/
  `docs/REGLES/REGLECOMPETENCE.md`/`REGLEARMURE.md`/`REGLEDRONE.md` (tous les fichiers `REGLE*.md`
  mentionnant "cumul") — **aucune notion de catégorie de bonus n'existe dans Polaris LdB**, chaque
  occurrence de "se cumule(nt)" trouvée est une règle narrative isolée et spécifique (malus de
  précipitation + Attaques multiples, Tests de Choc répétés, bonus de respiration +1/tentative),
  jamais un système générique de types de bonus qui s'excluent. Adopter `StatisticModifier` ici
  résoudrait un problème que **ce jeu de règles n'a pas** — la vraie robustesse consiste à ne pas
  importer une complexité non justifiée par la source de vérité, pas à copier le système le plus
  sophistiqué trouvé. Le champ `source`/`label` du modèle PF2e reste néanmoins une bonne idée de
  traçabilité pour un usage futur (ex. tooltip "Réaction +3 grâce à Bons réflexes") — **pas besoin
  de l'ajouter à `getAdvantageModForAttr` pour ça** : la donnée source (`advantageRows`, avec `name`)
  est déjà entièrement disponible chez l'appelant (`charAdvantages` en `CharacterSheet.jsx`), qui
  peut filtrer lui-même par `mod_attribute` s'il a un jour besoin d'un détail — pas de redesign
  nécessaire pour garder cette porte ouverte.
- **Conséquence directe sur la conception** : mode `ADD` uniquement (somme simple, sans catégorie de
  type) est le bon choix — pas un raccourci, une conclusion vérifiée contre la source de vérité des
  règles, pas seulement contre la donnée actuelle du catalogue. Les 3 lignes concernées sont toutes
  des bonus/malus plats ("+3 à sa Réaction", "-3 à sa Réaction", "+10 à son Attribut Souffle", texte
  LdB `92_ref_advantages.js`). Un champ `mode` générique (ADD/OVERRIDE/MULTIPLY, comme Foundry
  Active Effects) **n'est pas construit maintenant** — prématuré : la seule donnée déjà connue qui
  ne serait pas un ADD est `mod_identity` (Lot 6, `{hand_pref:"A"}` — une **assignation**, pas une
  accumulation numérique), catégorie différente à concevoir quand le Lot 6 sera détaillé à son tour
  (jamais deux lots à la fois). Corrobore la décision déjà prise dans `docs/PLAN_TIRVISE.md`
  (session parallèle, même raisonnement appliqué à un autre sous-système) : un moteur de règles
  généraliste façon PF2e "Rule Elements" ne se justifie que pour de l'authoring homebrew
  non-développeur — pas notre cas, catalogue fixe et fermé (76 lignes, jamais écrites par un joueur).

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

export function getAdvantageModForAttr(advantageRows, attrKey) {
  return sumModByKey(advantageRows, 'mod_attribute', 'mod_value', attrKey)
}
```
**Piège explicite (trouvé en analyse à charge, avant tout code)** : `mod_value` porte déjà son
signe (`adv_006` type `advantage` → `+3`, `adv_058` type `disadvantage` → `-3`, `adv_021` type
`advantage` → `+10`, `[VÉRIFIÉ]` `92_ref_advantages.js`) — `sumModByKey`/`getAdvantageModForAttr` ne
doivent **jamais** inspecter `type` pour inverser un signe. Une implémentation qui ferait
`type === 'disadvantage' ? -mod_value : mod_value` doublerait silencieusement le malus de
`adv_058` (`-3` → `+3`). Aucun test unitaire ne l'aurait révélé sans un scénario dédié — couvert en
section G ci-dessous.

`calcREA` **déménage ici** (actuellement dupliqué : `charStats.js:205-207` côté serveur ET en dur
dans `calcSecondary` de `CharacterSheet.jsx:90` côté client — même dette que `calcNA` au Lot 1 ;
nécessaire ici, pas cosmétique : sans ça la fiche client n'afficherait jamais le bonus d'avantage,
seule la résolution serveur en bénéficierait) :
```js
export function calcREA(ada_na, per_na, mod_advantage) {
  return polarisRound((ada_na + per_na) / 2) + (mod_advantage ?? 0)
}
```
**Ordre addition/arrondi — vérifié non-ambigu (run à vide)** : le bonus est ajouté *après*
`polarisRound`, pas dans la moyenne avant arrondi. Mathématiquement équivalent uniquement parce que
`mod_value` est garanti **entier** par le schéma (`table.integer('mod_value')`, migration 92 ligne
1135 — `floor(x + entier) = floor(x) + entier`, toujours vrai). Cette garantie vient du type de
colonne DB, pas d'une propriété de `polarisRound` elle-même — à revérifier si une future donnée
`mod_value` décimale apparaissait un jour (aucune actuellement).

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
| `char-sheet.js` | 1642-1658 (`POST /macro-preview`) | `rea`/`souffle` via `secondaryValue()` | Ajoute `getAdvantages(sheet.id)` au `Promise.all` (déjà importée ligne 42) ; nouvel import `getAdvantageModForAttr` depuis `shared/polarisUtils.js` (absent aujourd'hui) ; passe `getAdvantageModForAttr(advantages,'reaction'/'breath')` |
| `socketDice.js` | 99-116 (jet macro) | idem, duplique le pattern | Idem : nouvel import `getAdvantages` (`advantageService.js`, absent) + `getAdvantageModForAttr` (`shared/polarisUtils.js`, absent) dans le `Promise.all` existant |
| `socketCombatState.js` | 66-80 (`COMBAT_START`, `base_ini` par token) | `calcREA(ada_na, per_na)` | Ajoute `getAdvantages(cs.id)` dans le même bloc que `attrs`/`archetype` (seulement si `cs` existe — même garde que l'existant) ; passe le mod à `calcREA` |
| `battlemaps.js` | 66-80 (`GET /:id/combat-ini`, aperçu `CombatRosterWindow`) | idem | Même changement — nouvel import `getAdvantages` (seul `calcAttributeNA`/`calcREA` importés aujourd'hui) |

**Limite connue et acceptée (run à vide)** : `socketCombatState.js` boucle sur les tokens en
`await` séquentiel (pas de parallélisation), déjà 2 requêtes par token (`attrs`, `archetype`) avant
ce lot. Ajouter `getAdvantages` en fait 3 — latence de `COMBAT_START` en légère hausse pour un
roster nombreux (linéaire au nombre de tokens, pas une nouvelle classe de problème, juste plus de
la même chose qui existait déjà). Non bloquant, pas retenu comme un défaut à corriger dans ce lot —
noté explicitement pour que ce ne soit pas une surprise si `COMBAT_START` est chronométré plus tard.

Point de vigilance identique au Lot 1 : oublier un site ne fait rien planter — juste un REA/Souffle
silencieusement non boosté à cet endroit précis. Le plan de test (section G) compare les 4 sites
entre eux pour un même personnage, pas seulement chacun isolément.

**E. Client — `CharacterSheet.jsx`**
- Import `calcREA`/`getAdvantageModForAttr` depuis `shared/polarisUtils.js` (déjà importé ligne 34
  pour `calcNA`/`calcAN`/`getGenotypeModForAttr`/`getMutationModForAttr` — même ligne étendue).
- `calcSecondary(naMap)` (83-97) → `calcSecondary(naMap, charAdvantages)` : remplace
  `const rea = polarisRound((ADA + PER) / 2)` par
  `const rea = calcREA(ADA, PER, getAdvantageModForAttr(charAdvantages, 'reaction'))`.
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
- Personnage sans avantage actif → `getAdvantageModForAttr([], 'reaction') = 0` → REA/Souffle
  identiques à avant (non-régression) aux 4 sites serveur + fiche client.
- `adv_006` seul (+3 reaction) → REA/initiative +3 partout, Souffle inchangé.
- `adv_058` seul (-3 reaction) → REA **-3 exactement** (pas +3 — vérifie explicitement l'absence de
  double-inversion de signe via `type`, cf. piège explicité en section A).
- `adv_006` + `adv_058` en même temps (pas de contrainte qui l'empêche, vérifié) → somme algébrique
  0 (comportement "addition simple" assumé, cf. recherche Foundry ci-dessus).
- `adv_021` seul (+10 breath) → Souffle +10, REA inchangé (colonnes filtrées indépendamment par clé).
- Retrait d'un avantage via `AdvantagesPanel` → REA redescend immédiatement sur la fiche (pas de
  rechargement nécessaire, `charAdvantages` déjà dans les deps du `useMemo`).
- Fiche (`CharacterSheet.jsx`) et résolution combat (`socketCombatState.js`/`battlemaps.js`)
  doivent produire le même REA pour un même personnage.
- Non-régression : `getAdvantages()` avec les 2 colonnes en plus ne casse pas `AdvantagesPanel.jsx`
  (champs additionnels ignorés par l'affichage, pas de select strict côté composant).

**H. Analyse à charge (2026-07-11, avant tout code) — 3 risques vérifiés, plan confirmé**
1. `adv_006`+`adv_058` réellement cumulables ? Vérifié contre `advantageConstraints.js` (non lu
   avant la rédaction initiale du plan) : aucune des 6 contraintes (`unique_absolute`,
   `family_limit`, etc.) ne les lie — `family: null` sur les deux. Hypothèse confirmée.
2. `CombatRosterWindow.jsx` a-t-il son propre calcul REA dupliqué (3ᵉ duplicata caché, en plus de
   `charStats.js`/`CharacterSheet.jsx`) ? Vérifié : composant 100% lecture seule, affiche `base_ini`
   reçu de `GET /combat-ini` (`battlemaps.js`, déjà dans le tableau D). Pas de site caché.
3. Un renfort rejoignant un combat déjà démarré recalcule-t-il l'initiative ailleurs qu'à
   `COMBAT_START` ? Grep exhaustif `server/src/socket/` : `calcREA`/`base_ini =` n'apparaît qu'une
   fois, dans `socketCombatState.js:79`. Tableau D confirmé exhaustif (4 sites, pas 5).
Aucune correction nécessaire suite à cette analyse — un seul point implicite rendu explicite (signe
déjà porté par `mod_value`, piège documenté en section A + test dédié en section G).

**I. Run à vide (2026-07-11, réflexion libre, avant tout code) — 3 points trouvés, tous corrigés
dans le document** :
1. Incohérence de nommage : `getAdvantageAttrMod` ne suivait pas le gabarit `get[Source]ModForAttr`
   déjà posé par le Lot 1 (`getMutationModForAttr`/`getGenotypeModForAttr`) — renommé
   `getAdvantageModForAttr` partout dans ce document avant que le Lot 3 ne copie le mauvais gabarit.
2. Ordre addition/arrondi dans `calcREA` (bonus après `polarisRound`, pas dans la moyenne avant
   arrondi) — vérifié mathématiquement neutre uniquement parce que `mod_value` est un entier garanti
   par le schéma DB (section A) ; explicité pour ne pas laisser un futur lecteur se poser la question.
3. Coût supplémentaire dans la boucle séquentielle de `COMBAT_START` (3ᵉ requête par token) — pas un
   bug, mais une limite de performance connue et acceptée, désormais écrite noir sur blanc (section D)
   plutôt que découverte plus tard sur un roster nombreux.
Statut Lot 2 : **plan complet, corrigé deux fois (analyse à charge + run à vide), toujours aucun
code écrit.**

**J. Instrumentation base réelle (2026-07-11) — les `[VÉRIFIÉ]` ci-dessus reposaient sur la
lecture des migrations, pas sur une exécution réelle (`CLAUDE.md` DÉTECTEUR DE DÉRIVE : "Lire =
`[HYPOTHÈSE]`. `[VÉRIFIÉ]` = instrumenté + observé en exécution"). Corrigé par requêtes read-only
sur la vraie base de dev (`node --input-type=module -e`, aucune écriture, P53/P54 respectés) :**
- `ref_advantages` interrogée en direct : **exactement 3 lignes** `mod_attribute` non-null en base
  réelle, valeurs identiques à la migration (`adv_006` reaction +3, `adv_058` reaction -3, `adv_021`
  breath +10) — aucune migration postérieure à la 92 ne les touche (`[VÉRIFIÉ]` grep migrations).
  Plus une `[HYPOTHÈSE]` : `[VÉRIFIÉ]` pour de vrai.
- `information_schema.columns` : `ref_advantages.mod_value` est bien `data_type: integer` en base
  réelle (pas juste déclaré ainsi dans le fichier de migration) — confirme la neutralité de l'ordre
  addition/arrondi (point I.2).
- `pg_indexes` sur `char_advantages` : l'index unique partiel `(char_sheet_id, advantage_id) WHERE
  removed_at IS NULL` existe réellement en base — confirme le choix "pas de stacking, pas de VIEW
  SQL" (section C) sur la vraie contrainte, pas sur la lecture du code qui la crée.
- Simulation réelle de la requête `getAdvantages()` étendue (`mod_attribute`/`mod_value` ajoutés au
  `.select()`) exécutée contre un `char_sheet_id` réel existant : **0 erreur SQL**, résultat cohérent
  (`adv_002` Ambidextre, `mod_attribute: null` — comportement attendu pour un avantage hors
  périmètre de ce lot).
- **Point pratique trouvé pour le plan de test** : aucun personnage réel en base ne détient
  actuellement `adv_006`/`adv_058`/`adv_021` — le scénario de test fonctionnel (section G) devra
  passer par un octroi de test via l'UI (Wizard Step5 ou `AdvantagesPanel`), pas par un personnage
  existant déjà pourvu de l'un de ces avantages.

**K. Codé (2026-07-11)** — sections A-E appliquées exactement comme documenté, un écart trouvé et
corrigé en cours de code (non anticipé par le plan écrit) : `calcREA` déménagé vers
`shared/polarisUtils.js` n'était plus utilisé nulle part en interne dans `charStats.js` une fois
son import ajouté là — import mort. Corrigé en important `calcREA` **directement depuis
`shared/polarisUtils.js`** aux 4 sites serveur (`char-sheet.js`, `socketDice.js`,
`socketCombatState.js`, `battlemaps.js`) au lieu de le faire transiter par `charStats.js` — cohérent
avec le client (section E), qui l'importait déjà directement depuis `shared/`.
- **Testé** : `node --check` 0 erreur sur les 7 fichiers serveur/partagés touchés ; ESLint client
  0 nouvelle erreur (`CharacterSheet.jsx` — 2 erreurs/1 warning préexistants confirmés déjà présents
  dans `HEAD` via `git show HEAD:...` avant tout changement de ce lot, sans lien avec Lot 2) ;
  6 scénarios unitaires purs (`getAdvantageModForAttr`/`calcREA`, aucun avantage / `adv_006` seul /
  `adv_058` seul / les deux / `adv_021` sur la mauvaise clé / avantage sans `mod_attribute`) ; test
  bout-en-bout en base réelle (transaction annulée, jamais committée) : insertion temporaire de
  `adv_006`+`adv_021` sur un `char_sheet_id` réel, requête identique à `getAdvantages()` étendue,
  `getAdvantageModForAttr`→`calcREA`/`calcSouffle` corrects (REA 10→13, Souffle 10→20), rollback
  vérifié effectif (0 ligne résiduelle après coup).
- **Non testé** : parcours navigateur (octroi réel via `AdvantagesPanel`/Wizard Step5, affichage
  fiche + `COMBAT_START` + `CombatRosterWindow`) — confirmation fonctionnelle Saar requise avant de
  considérer ce lot clos, cf. protocole. `encumbrance_*`/PI4 non concernés par ce lot (Lot 1 déjà clos).
- **Incident de session sans rapport avec le code** : une collision `git stash`/`git stash pop`
  s'est produite en cours de vérification (session parallèle active sur le même dépôt au même
  moment). Aucune perte de données — `git stash list` vide après coup, `git diff` sur chaque fichier
  du Lot 2 relu intégralement et confirmé ne contenir que les changements prévus. Aucune action
  destructive (`reset`/`checkout`/`clean`) tentée.

### Lot 3 — Résistances (recoupement réel mutations + avantages)

**Ouverture du lot (2026-07-11) — scope corrigé + `[INCONNU]` confirmé, pas encore détaillable
ligne-à-ligne.**

- **Erreur de scope héritée corrigée** : le stub disait `ref_advantages.mod_resistance ∈
  {"damage","shock"}` — **faux**, `[VÉRIFIÉ]` par lecture complète de `92_ref_advantages.js` :
  `mod_resistance` prend en réalité **6 valeurs** — `"damage"` (1 ligne), `"shock"` (1 ligne,
  `adv_030` "Résistance à la douleur"), et surtout `"poison"`/`"disease"`/`"radiation"`/`"drug"`
  (`adv_031-034` "Résistance naturelle augmentée" +2, `adv_051-054` "Faiblesse naturelle" +2 aussi
  — **désavantage avec un `mod_res_value` positif**, signe non trivial à interpréter, cf. point
  ouvert ci-dessous). Source : `ref_mutations.mod_res_damage/shock/drugs/disease/poison/radiation`
  reste correcte côté mutations.
**Clarification Saar (LdB p.114, liste officielle des ATTRIBUTS SECONDAIRES + extrait texte) —
débloque une partie du lot, en confirme une autre comme hors scope :**

Liste canonique des 7 attributs secondaires : Choc (→ Seuil étourdissement + Seuil inconscience),
Modif. de dommage au contact (→ `getModDom`), Réaction (→ Lot 2, clos), Résistance aux dommages,
Résistances naturelles (Drogues / Maladies+poisons+radiations — **un seul sous-attribut pour les
3**, pas 3 séparés), Souffle (→ Lot 2, clos).

- **"Choc" `[RÉSOLU]`** — ce n'est PAS une mécanique séparée introuvable : "Choc" **est** le Seuil
  d'étourdissement/inconscience (`calcSeuils`), déjà pleinement actif dans `resolveShockTest`.
  `adv_030` "+2 Résistance au Choc" se branche donc très probablement sur `calcSeuils` (+2 aux deux
  seuils) — même gap que Lot 2 avant correction : `calcSeuils` n'a aujourd'hui **aucun paramètre
  modificateur**. Sous-lot bien défini, à détailler.
- **"Résistance aux Dommages" `[VÉRIFIÉ]` solide** — formule LdB p.114 (FOR+CON, table à 10 paliers
  puis -1/4 niveaux) correspond **exactement** à `calcResistanceDommages(for_na, con_na)`/`RD_TABLE`
  déjà codée. Confirmé activement consommée en combat réel : `socketCombatHelpers.js:708` et
  `damageService.js:43`. Sous-lot le plus propre du lot, même forme que Lot 2.
- **"Résistances naturelles" (drogues/maladies+poisons+radiations) — confirmé `[INCONNU]` par
  validation croisée indépendante, PAS un manque de recherche.** Un second agent, sur une session
  distincte (audit `ref_equipment_skill_assoc`, sans rapport avec ce chantier), est arrivé
  indépendamment aux mêmes 3 constats (`calcSeuils` sans modificateur — désormais résolu ci-dessus ;
  `calcResistanceNaturelle`/`RES_NAT_TABLE` jamais appelés ; poison/maladie/radiation absents du
  code) et conclut à un `[INCONNU]` documentaire réel, "en attente d'arbitrage du MJ" — même
  conclusion atteinte indépendamment, sans avoir vu ce document. Décision Saar (ce jour) :
  **"Résistances naturelles" devient un chantier distinct, hors du Lot 3** — pas de code ici tant
  que la mécanique exacte (quel Test consomme le modificateur RES_NAT_TABLE une fois calculé) n'est
  pas tranchée. `resistance_drogues` (macro existante) reste tel quel pour l'instant (bug
  pré-existant plus large que ce lot — expose la valeur brute CON+VOL/2 sans jamais l'avoir passée
  par `RES_NAT_TABLE`, gap dans l'attribut lui-même, pas seulement dans le branchement
  mutations/avantages — hors périmètre "effets jamais appliqués" de ce document).
- **Signe non trivial resté ouvert, à trancher pour les 2 sous-lots retenus** : `adv_051-054`
  "Faiblesse naturelle" (désavantage) a `mod_res_value: 2` — positif, comme l'avantage équivalent.
  Contrairement à `reaction`/`breath` (Lot 2, signe déjà correct dans `mod_value`), le signe ici
  semble dépendre de `type` (`advantage` vs `disadvantage`). **Ne pas réutiliser
  `getAdvantageModForAttr` tel quel sans vérifier ce point pour "Résistance aux Dommages"/"Choc"** —
  à vérifier ligne par ligne sur les lignes réellement concernées (`adv_030` seule pour `shock` ;
  chercher les lignes `mod_resistance:"damage"` pour ce point).

**Conclusion d'ouverture** : Lot 3 **recentré sur "Résistance aux Dommages" + "Choc"** — les deux
mécaniques confirmées vivantes et bien comprises, prêtes à détailler ligne-à-ligne. "Résistances
naturelles" extrait en chantier séparé, en attente d'arbitrage Saar sur la mécanique LdB — ne
bloque plus l'avancement de ce lot.

**Lot 3 ✅ CLOS — Session 141 (suite 23) (2026-07-12), fonctionnel confirmé Saar en navigateur.**
Bug préalable trouvé et corrigé en
ouvrant ce lot : `degatsNets` soustrayait RD au lieu de l'ajouter (suite 22, `[VÉRIFIÉ]` par
exécution réelle, corrigé aux 2 sites réels avant tout code de mods). Codé : `getMutationModForResistance`
(symétrique à `getAdvantageModForResistance`), `calcResistanceDommages`/`calcSeuils` étendues (2 params,
addition directe), `damageService.resolveTargetHit` devient le seul point d'insertion (fetch
mutations/avantages cible, réutilisé par les 4 appelants réels). **Consolidation trouvée avant de
coder** (analyse critique demandée par Saar) : la branche PNJ auto-résolution CaC dupliquait
`resolveTargetHit` presque à l'identique — remplacée par un seul appel plutôt que d'y dupliquer une
2ᵉ fois le fetch mutations/avantages. Macros `seuil_etourdi`/`seuil_incons` complétées + nouvelle
macro `resistance_dommages`. `CharacterSheet.jsx` rebranchée dans la même passe (fiche = résolution
combat, plus d'écart). **Testé** : 11 scénarios purs, `node --check`, ESLint 0 nouvelle erreur, grep
de sweep, vérification en base réelle (personnage réel "Squelette renforcé", delta +2 RD/+3 seuil
confirmé), SR. **Testé en navigateur, fonctionnel confirmé Saar.** Détail complet :
`docs/JOURNAL6.md` "Session 141 (suite 23)".

### Lot 4 — Armure naturelle → Résistance aux dommages + Arme naturelle (mutations uniquement)

**Ouverture du lot (Session 141 suite 25, 2026-07-12) — 2 sous-lots indépendants, décisions Saar
actées avant détail ligne-à-ligne, plan complet ci-dessous, aucun code écrit.**

#### Sous-lot A — Armure naturelle → Résistance aux dommages

**Décision Saar** : `natural_armor` n'est **pas** une pièce d'armure de plus dans le mille-feuille
`max + reste/2` de `calcResistanceArmure` — c'est une **constante toujours active**, indépendante
de l'armure portée (aucun conflit/stacking avec elle), qui modifie directement l'attribut
secondaire **Résistance aux dommages** (RD), pas l'ETQ. Décision qui évite d'inventer une règle de
cumul armure naturelle/portée non sourcée (aucune trouvée dans `REGLEARMURE.md`/`REGLESYSCOMBAT.md`
— seule occurrence hors sujet, un implant qui exclut la carapace d'un seuil NT).

`[VÉRIFIÉ]` : `natural_armor` déjà agrégé + stické correctement par `char_mutation_effects_view`
depuis le Lot 1/migration 109 (`Peau renforcée` base 3, `stack_deltas:{natural_armor:2}` par stack
supplémentaire) — **aucune migration nécessaire pour ce sous-lot**, seulement du câblage.

**A. `shared/polarisUtils.js`** — nouveau résolveur, symétrique aux autres `get*Mod*` du fichier :
```js
export function getNaturalArmorMod(mutationEffectsRow) {
  return mutationEffectsRow?.natural_armor ?? 0
}
```
Pas fusionné dans `getMutationModForResistance` (qui reste générique par clé `mod_res_*`) —
`natural_armor` est une colonne à part, distincte de `mod_res_damage` : un personnage avec "Peau
renforcée" **et** "Squelette renforcé" doit cumuler les deux sources dans le même total RD, pas
que l'une masque l'autre.

**B. 4 sites à rebrancher** (tous les appelants actuels de `calcResistanceDommages`, `[VÉRIFIÉ]`
grep exhaustif — aucun autre site n'existe hors `Enclume-codex/` qui est un submodule séparé, non
concerné) :

| Fichier | Ligne | Contexte |
|---|---|---|
| `server/src/lib/damageService.js` | 58-62 | `resolveTargetHit` — seul point d'insertion combat (Lot 3) |
| `server/src/socket/socketDice.js` | 120 | macro `resistance_dommages` |
| `server/src/routes/character/char-sheet.js` | 1176 | `POST /macro-preview`, même macro |
| `client/src/character/CharacterSheet.jsx` | 103, 150 | `calcSecondary` (fiche) + `rdBase` (tooltip détail, item 66) |

Chaque site : `getMutationModForResistance(mutationEffects, 'damage')` devient
`getMutationModForResistance(mutationEffects, 'damage') + getNaturalArmorMod(mutationEffects)`. Le
tooltip (`CharacterSheet.jsx:157`, item 66 déjà codé et clos) n'a rien à changer structurellement —
`natural_armor` rejoint simplement le total "Mutations" déjà affiché en agrégat (décision item 66,
cohérente avec celle-ci).

**C. Cas limites à tester**
- "Peau renforcée" seule (`natural_armor=3`) → RD +3 aux 4 sites, sans armure portée.
- "Peau renforcée" ×2 stack (+2 via `stack_deltas`, total `natural_armor=5`) → RD +5.
- "Peau renforcée" + armure portée équipée → RD +3 (natural_armor) **et** ETQ inchangée par ce lot
  (les deux mécanismes ne se touchent pas — décision Saar : constante indépendante).
- "Peau renforcée" + "Squelette renforcé" (`mod_res_damage`) simultanés → somme des deux sources
  correcte, pas d'écrasement mutuel.
- Non-régression : personnage sans mutation → comportement identique à avant (Lot 3), aux 4 sites.

#### Sous-lot B — Arme naturelle

**Décisions Saar actées** :
1. Colonnes structurées sur `ref_mutations` (migration) — pas de texte libre `special_effect`
   parsé à la volée, cohérence avec le reste du schéma mutations.
2. Le gate "après saisie" (Crocs/Corne) réutilise le statut `grappled` déjà existant et **pleinement
   fonctionnel** (`token_statuses`, `TOKEN_STATUS_TOGGLE` — `socketToken.js:100-134` —,
   `TokenStatusPanel.jsx`, `fr.json:702` "Saisi") — lecture DB réelle sur le token **cible** (celui
   qui subit la saisie, sens confirmé par le libellé), pas de confiance narrative. Ce lot ne
   construit pas le Test d'opposition Lutte qui pose ce statut automatiquement (reste manuel,
   MJ/joueur via l'UI de statuts existante) — même limite de portée que Lot 3/Résistances
   naturelles : la brique de lecture est prête, le Test qui l'alimente reste un chantier séparé.
   Limite acceptée : pas de traçage de *qui* a saisi, seulement *si* la cible est saisie (correct en
   1 contre 1, ambigu en mêlée à plusieurs — non bloquant pour ce lot).
3. Sélection de l'arme naturelle = option radio de plus dans le sélecteur d'arme CaC existant
   (`MeleeCombatPanel.jsx`), gratuite comme "Mains nues"/armes d'inventaire — `[VÉRIFIÉ]` le choix
   d'arme au CaC est déjà sans coût d'Initiative, resélectionnable à chaque déclaration
   (`MeleeCombatPanel.jsx:118-152`). Le seul coût existant (`isWeaponDrawn`, −3/−5 Init) concerne le
   dégainer d'une arme d'inventaire pas encore au clair — aucune des 4 mutations n'a de coût de
   préparation dans le texte LdB. Pas de nouveau mécanisme "changer d'arme, action complète".

**Périmètre confirmé `[VÉRIFIÉ]`** (`docs/Character/Creation/REGLE_MUTATION.md`) — 4 mutations,
aucune autre n'a de texte de dégâts structuré :

| Mutation | Formule dégâts | Compétence | Précondition |
|---|---|---|---|
| Griffes | `1D10+3` | `COMBAT_A_MAINS_NUES` (déjà le skill par défaut mains nues — inchangé) | aucune |
| Excroissance osseuse rétractable | `2D10` | `COMBAT_A_MAINS_NUES` (explicite dans le texte LdB) | aucune |
| Crocs | `1D10+3` | `COMBAT_A_MAINS_NUES` | cible doit porter le statut `grappled` |
| Corne | `1D10` | `COMBAT_A_MAINS_NUES` | cible doit porter le statut `grappled` |

**Point vérifié avant d'écrire ce tableau** : le Modificateur de dommages au corps à corps
(`modDom`/`getModDom(for_na)`) est déjà ajouté automatiquement et uniformément à **tout** dégât de
corps à corps par le pipeline existant (`socketCombatHelpers.js:421,690,743` —
`degautsBruts = rawDice + (modDom ?? 0) + combatModeBonus`) — les formules ci-dessus n'incluent donc
**pas** modCaC (il ne doit jamais être doublé dans la donnée stockée), exactement comme
`ref_equipment.damage_h` pour les armes normales aujourd'hui. Le "+3" de Griffes/Crocs est un bonus
fixe propre à la mutation, distinct de modCaC.

**Gap trouvé en vérifiant Corne, explicitement hors périmètre de ce lot** : le texte LdB donne un
bonus "+1D6 dommages de Choc si le coup porte à la tête". `[VÉRIFIÉ]` par lecture :
`calcResistanceArmure` (`charStats.js:290-299`) calcule déjà un `prt` (protection_shock) en plus de
`etq`, mais `damageService.js:50` ne déstructure et n'utilise **que** `etq` — `prt` est calculé puis
jeté, aucune notion de "dommages de Choc" distincte des dégâts physiques n'existe nulle part dans
le pipeline de résolution actuel. Câbler le bonus de Corne proprement demanderait d'abord de brancher
ce pool de Choc, chantier séparé et non trivial, hors scope. **Décision de scope** : Corne est
câblée dans ce lot pour ses dégâts physiques de base (`1D10`) uniquement ; le bonus "+1D6 Choc si
tête" est documenté comme gap différé (nouvelle dette **`[CHOC1]`**), pas silencieusement perdu.

**Analyse critique (2026-07-12, avant tout code) — recherche externe demandée par Saar, 4 sources,
confirme 3 décisions et en corrige 1 :**
- **PF2e (Foundry)** — [issue #14837](https://github.com/foundryvtt/pf2e/issues/14837) : mains
  nues/armes naturelles et armes tenues partagent la **même** structure "Strike" (formule de
  dégâts + stat d'attaque), jamais deux mécanismes parallèles — confirme le choix de garder
  `skillId` inchangé et de ne faire varier que la formule. Leur bug documenté : référencer les
  Strikes par **position dans un tableau** casse dès que l'équipement change ; ils demandent un
  identifiant stable à la place. `natural_weapon_char_mutation_id` (id de ligne `char_mutations`,
  jamais une position) évite déjà cet écueil — confirmé, pas fortuit.
- **Open5e** (schéma d'attaques de créatures D&D5e) : `damage_dice` est une **chaîne plate**
  (`"2d4"`), pas une structure décomposée — confirme `natural_weapon_formula VARCHAR` au lieu d'un
  format éclaté, cohérent avec `ref_equipment.damage_h` déjà en place.
- **D&D5e/PF2e — saisie** : dans les deux références, "Grappled" est une simple condition
  booléenne sur la cible, jamais un lien "saisi par tel token précis" — le choix de réutiliser le
  statut `grappled` existant (sans tracer qui a saisi) est le standard de l'industrie, pas un
  raccourci de scope.
- **Correction trouvée** : le plan initial mettait le gate "cible saisie" en booléens inline dans
  `resolveMeleeAction`. Ce projet a déjà le bon patron pour "action éligible seulement si condition
  X" — `shared/combatExclusiveActions.js` (Tir visé) : `get<Action>IneligibilityReasons(...) →
  string[]` (source unique, alimente tooltip client **et** rejet serveur) dont
  `is<Action>Eligible()` dérive. Réinventer une paire de booléens ad hoc aurait dupliqué une
  architecture déjà validée. Section D/E ci-dessous corrigées en conséquence.

**Vérification finale demandée par Saar ("sûr à 100%, aucune zone d'ombre") — tracé du pipeline
déclaration→persistance→résolution avant tout code, un vrai trou trouvé** : `weapon_inv_id` n'est
**pas** transmis en direct à `resolveMeleeAction` — c'est une colonne réelle de `combat_actions`
(`54_combat.js:55-56`, FK vers `char_inventory`), écrite en Phase 1 (déclaration) par
`socketCombatAnnouncement.js:271-283` depuis `mapActions.melee[].weaponInvId` (payload client,
`CombatActionWindow.jsx:535-539`/`CombatGmDeclareWindow.jsx` côté MJ), puis relue en Phase 2 pour
alimenter `action.weapon_inv_id` dans `resolveMeleeAction`. Le plan initial ("Nouveau champ
`action.natural_weapon_char_mutation_id`") sautait cette chaîne à 4 maillons — corrigé ci-dessous,
**une 3ᵉ colonne** est nécessaire (pas seulement les 2 sur `ref_mutations`).

**A. Migration `138_ref_mutations_natural_weapon.js`** (NOUVEAU — prochain numéro libre, vérifié
`ls server/src/db/migrations` avant d'écrire ce chiffre, 136/137 déjà pris par une session
parallèle, cf. P53) — 3 colonnes, 2 tables :
```js
// ref_mutations
table.string('natural_weapon_formula', 20).nullable()        // '1D10+3' | '2D10' | '1D10' — NULL = pas une arme naturelle
table.boolean('natural_weapon_requires_grapple').notNullable().defaultTo(false)

// combat_actions — même rôle que weapon_inv_id (54_combat.js:55-56) / aim_bonus_comp (migration 134)
table.uuid('natural_weapon_char_mutation_id').nullable()
  .references('id').inTable('char_mutations').onDelete('SET NULL')
```
Backfill des 4 lignes `ref_mutations` par `name` (Griffes / Excroissance osseuse rétractable /
Crocs / Corne) selon le tableau ci-dessus. `down()` : `dropColumn` des trois colonnes — aucune
donnée préexistante à préserver (colonnes nouvelles).

**B. `server/src/services/mutationService.js`** — `getMutations(sheetId)` (lignes 20-30) : ajoute
`'rm.natural_weapon_formula', 'rm.natural_weapon_requires_grapple'` au `.select()`. Un seul point de
lecture, réutilisé par le client (liste des armes naturelles actives) **et** par la validation
serveur (point D) — pas de nouvelle fonction.

**C. `GET /char-sheet/:characterId/mutations`** (route déjà existante, Lot D `AdvantagesPanel.jsx`)
— aucun changement de route nécessaire, les 2 nouvelles colonnes transitent automatiquement via B.

**D. `shared/naturalWeapons.js`** (NOUVEAU) — même patron que `combatExclusiveActions.js`
(évaluateur pur, importé identique client + serveur, pattern `shared/careerEligibility.js`) :
```js
export function getNaturalWeaponIneligibilityReasons({ mutation, targetIsGrappled }) {
  const reasons = []
  if (mutation?.natural_weapon_requires_grapple && !targetIsGrappled) reasons.push('cible non saisie')
  return reasons
}
export function isNaturalWeaponEligible(args) {
  return getNaturalWeaponIneligibilityReasons(args).length === 0
}
```
Pas de registre `isExclusiveDeclaration` à étendre — vérifié `[VÉRIFIÉ]` : aucune des 4 mutations
n'est une action exclusive au sens LdB (contrairement à Charge/Rafale longue), une arme naturelle
est une simple option d'attaque parmi d'autres, compatible avec Attaques multiples comme n'importe
quelle arme.

**E. Pipeline déclaration → persistance (les 3 maillons trouvés au tracé) :**
1. **`client/src/components/CombatActionWindow.jsx`** — nouveau `useEffect` (miroir exact de celui
   de `allInventoryItems`, lignes 241-249) : `GET /char-sheet/:charId/mutations` (route existante) →
   `setNaturalWeapons(res.data.filter(m => m.natural_weapon_formula != null))`. Nouvel état
   `selectedMeleeNaturalWeaponId` (même convention `undefined`/`null`/`id` que
   `selectedMeleeWeaponId`, ligne 375-379) ; sélectionner une arme naturelle réinitialise
   `selectedMeleeWeaponId` à `null` et réciproquement (mutuellement exclusifs, comme "Mains nues"
   remet déjà `weaponInvId` à `null` aujourd'hui). Emit (ligne 535-540) :
   `melee: meleePendingTokenIds.slice(0, effectiveMeleeCount).map(id => ({ targetTokenId: id,
   weaponInvId: effectiveMeleeWeaponId, naturalWeaponCharMutationId: effectiveMeleeNaturalWeaponId }))`.
2. **`client/src/components/CombatGmDeclareWindow.jsx`** — symétrique côté MJ/PNJ : `[VÉRIFIÉ]` un
   PNJ peut porter une mutation au même titre qu'un PJ (`char_mutations`/`ref_mutations` ne
   distinguent pas le type de personnage) — pas de raison de limiter ce lot aux PJ. **Architecture
   différente du point 1, trouvée en traçant le fetch existant** : ce composant ne fait pas un fetch
   par personnage — il charge `GET /battlemaps/:id/combat-equipment` (`useEffect` ligne 150-156) en
   un seul appel batché pour **tous** les tokens du roster (`equipment[token.id]`, construit par
   `server/src/routes/battlemaps.js:96-136`), consommé ensuite par token actif (`meleeWeaponAvailable`,
   ligne 251). Ajouter un fetch séparé par PNJ aurait réintroduit le N+1 que ce batch évite déjà.
   **Extension cohérente** : `battlemaps.js` (route `/combat-equipment`) gagne, par token, une
   requête `char_mutations JOIN char_sheet JOIN ref_mutations WHERE char_sheet.character_id =
   token.character_id AND cm.status='active' AND rm.natural_weapon_formula IS NOT NULL` → nouveau
   champ `naturalWeapons: [...]` dans `equipment[token.id]` (même niveau que `weapon`/`armorPieces`
   existants). `CombatGmDeclareWindow.jsx` dérive `meleeNaturalWeaponsAvailable =
   equipment[activeTokenId]?.naturalWeapons ?? []`, même niveau que `meleeWeaponAvailable`
   (ligne 251). Même champ `naturalWeaponCharMutationId` dans l'emit que le point 1.
3. **`server/src/socket/socketCombatAnnouncement.js`** (271-283, `mapActions.melee` loop) :
   destructure `naturalWeaponCharMutationId` en plus de `weaponInvId`/`droneWeaponInvId` ; ajoute
   `natural_weapon_char_mutation_id: meleeDroneWeaponId ? null : (meleeNaturalWeaponId ?? null)` à
   la ligne insérée dans `combat_actions` (même garde "drone toujours null" que `weapon_inv_id`
   aujourd'hui — un drone n'a pas de mutations).

**F. `server/src/socket/socketCombatHelpers.js` — `resolveMeleeAction`** (324-370) — lit
`action.natural_weapon_char_mutation_id` directement depuis la ligne `combat_actions` relue en
Phase 2 (même mécanisme que `action.weapon_inv_id` aujourd'hui, désormais alimenté par le point E) :
- Si présent : requête `char_mutations JOIN ref_mutations WHERE char_mutations.id = ... AND
  char_sheet_id = sheetAttaquant.id AND status = 'active'` (revalidation serveur — ne jamais faire
  confiance au client sur l'appartenance de la mutation, même principe que tout autre payload
  d'action). `targetIsGrappled` résolu par lecture `token_statuses` de `targetTokenId`
  (`status_code = 'grappled'`), puis `isNaturalWeaponEligible({ mutation, targetIsGrappled })` —
  sinon rejet `COMBAT_DECLARE_ERROR` (même pattern que Tir visé, message construit depuis
  `getNaturalWeaponIneligibilityReasons` : *"Action impossible car — cible non saisie"*). Comme
  `resolveMeleeAction` est appelée une fois par cible déclarée (une ligne `combat_actions` par
  cible, boucle côté point E.3), l'éligibilité est revalidée **cible par cible** — pas de risque
  qu'une cible non saisie profite d'une autre cible saisie dans la même déclaration multi-attaque.
- `damageFormula = mutation.natural_weapon_formula` (remplace le `'1D4'` par défaut au point
  `336-345`). `skillId` reste `'COMBAT_A_MAINS_NUES'` — **aucun changement** à cette variable (déjà
  la valeur par défaut mains nues, cf. tableau ci-dessus, les 4 mutations confirmées utilisent ce
  skill — cohérent avec le modèle "Strike" unifié PF2e ci-dessus).

**G. Client — `MeleeCombatPanel.jsx`** :
- Nouvelle prop `naturalWeapons` (liste `naturalWeapons` du point E.1/E.2, filtrée
  `natural_weapon_formula != null` en amont — passée telle quelle, même niveau que
  `availableWeapons` aujourd'hui).
- Rendu : même bloc radio que les armes d'inventaire (117-152), juste après "Mains nues" — grisé si
  `!isNaturalWeaponEligible({ mutation: item, targetIsGrappled })` (import direct de
  `shared/naturalWeapons.js`, même fonction que le serveur — pas de logique dupliquée),
  `targetIsGrappled` dérivé côté appelant via `tokens.find(t => t.id === <cible sélectionnée>)
  ?.statuses?.includes('grappled')` — même pattern déjà utilisé pour `isStunned`
  (`CombatActionWindow.jsx:87`), aucune nouvelle plomberie de statuts à construire. Multi-cibles :
  vérifié contre la **première** cible sélectionnée (`meleePendingTokenIds[0]`) pour le retour
  visuel — le serveur (point F) revalide chaque cible individuellement, ce raccourci client est
  purement un indicateur, jamais la source de vérité. Tooltip listant
  `getNaturalWeaponIneligibilityReasons(...)` (même patron d'affichage que Tir visé "Action
  impossible car - X").
- `onWeaponChange` doit distinguer 3 cas (mains nues `null` / arme d'inventaire `weapon_inv_id` /
  arme naturelle `natural_weapon_char_mutation_id`) — un seul sélectionné à la fois, radio group déjà
  exclusif par construction, juste étendre l'union de types portée par `selectedWeaponId`.

**H. Cas limites à tester**
- Griffes seules, pas de saisie nécessaire → dégâts `1D10+3+modCaC` corrects, skill mains nues
  inchangé.
- Round-trip complet déclaration → `combat_actions.natural_weapon_char_mutation_id` peuplé → lu par
  `resolveMeleeAction` (vérifié en base réelle, pas seulement par lecture de code — cf. P54/piège
  "lire = hypothèse").
- PNJ avec mutation Griffes déclaré par le MJ (`CombatGmDeclareWindow.jsx`) → même résolution que
  côté PJ, formule correcte.
- `getNaturalWeaponIneligibilityReasons` pur (`node -e`) : sans grapple requis → toujours éligible ;
  grapple requis + `targetIsGrappled=false` → `['cible non saisie']` ; grapple requis +
  `targetIsGrappled=true` → `[]`.
- Crocs sans cible saisie → rejet serveur `COMBAT_DECLARE_ERROR`, même si sélectionné côté client
  (revalidation, pas de confiance client — le client et le serveur appellent la même fonction pure,
  mais le serveur ne fait jamais confiance à l'état client).
- Crocs avec cible réellement saisie (`token_statuses` vérifié en base) → attaque résolue
  normalement.
- Personnage avec Griffes **et** Excroissance osseuse simultanément → 2 options radio distinctes,
  formule associée à chacune correcte (pas de confusion d'ID).
- Personnage sans mutation d'arme naturelle → liste `naturalWeapons` vide, aucun changement visuel
  (non-régression Mains nues/armes d'inventaire).
- `natural_weapon_char_mutation_id` forgé côté client pour une mutation appartenant à un **autre**
  personnage → rejet serveur (vérification `char_sheet_id` au point F).
- Non-régression : `deuxArmesBonus`/multi-armes (`socketCombatHelpers.js:443-444`) ne voit pas les
  armes naturelles (elles ne sont pas dans `char_inventory`) — comportement inchangé, pas de bonus
  "deux armes" avec une arme naturelle dans ce lot (non sourcé, pas traité).

**Lot 4 ✅ CLOS — Session 141 (suite 25), fonctionnel confirmé Saar en navigateur.** Codé exactement
comme détaillé ci-dessus (aucun écart
trouvé en codant, plan tracé jusqu'au bout avant tout code). Sous-lot A : `getNaturalArmorMod` +
4 sites RD rebranchés. Sous-lot B : migration `138` (2 colonnes `ref_mutations` + 1 colonne
`combat_actions`, miroir `aim_bonus_comp`), `shared/naturalWeapons.js` (nouveau, pattern
`combatExclusiveActions.js`), `mutationService.getMutations()` étendu, `battlemaps.js`
(`/combat-equipment` gagne `naturalWeapons` par token — évite le N+1 qu'aurait introduit un fetch
par PNJ), `resolveMeleeAction` (gate + formule), `socketCombatAnnouncement.js` (persistance),
`CombatActionWindow.jsx`/`CombatGmDeclareWindow.jsx` (fetch + état + emit, PJ et MJ/PNJ),
`MeleeCombatPanel.jsx` (radios + tooltip).
**Testé** : `node --check` 0 erreur (10 fichiers serveur/partagés) ; ESLint client 0 nouvelle erreur
(`git stash` avant/après — 10 erreurs/8 warnings préexistants confirmés identiques, +1 warning
`exhaustive-deps` sur le nouveau fetch mutations, même classe que 5 warnings déjà existants sur le
fetch inventaire jumeau, pas une nouvelle catégorie) ; round-trip migration 138 réel (`down`→0
colonne→`up`→3 colonnes + 4 lignes backfillées, byte-identique, P53 respecté — nodemon avait déjà
auto-appliqué avant le test manuel) ; 8 scénarios purs (`getNaturalWeaponIneligibilityReasons`/
`isNaturalWeaponEligible`/`getNaturalArmorMod`/non-régression `calcResistanceDommages`) ; 3 scénarios
en base réelle transaction annulée (shape `getMutations()`/requête `battlemaps.js` sur une vraie
mutation Griffes insérée temporairement, gate ownership `resolveMeleeAction` avec **rejet confirmé**
sur un `char_sheet_id` forgé, lecture `token_statuses` réelle) ; SR (`/api/health` 200, serveur
resté up tout du long malgré les redémarrages nodemon successifs).
**SR + parcours navigateur confirmé fonctionnel par Saar** (scénario proposé : Griffes utilisables
librement, Crocs grisées tant que la cible n'a pas le statut "Saisi" puis débloquées une fois posé,
Résistance aux dommages +3 sur la fiche avec "Peau renforcée", vérifié côté PJ et côté MJ/PNJ).
**Point de règle soulevé par Saar en cours de validation, tranché** : le texte LdB (`REGLE_MUTATION.
md`) conditionne explicitement Corne/Crocs à *"après avoir effectué une saisie"* — aucune autre
mécanique d'usage n'est décrite pour ces deux mutations dans le texte source, contrairement à
Griffes/Excroissance osseuse (aucune précondition). Lecture RAW confirmée correcte et conservée
telle quelle (pas de house-rule demandée).
**Non testé** : les 6 cas limites listés en section H un par un (validation donnée sur le parcours
global, pas listée point par point) ; bonus "deux armes"/Attaques multiples avec une arme naturelle
en conditions réelles (couvert par construction, pas re-testé manuellement).

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

**Lot 1 ✅ CLOS — Session 141 (suite 13)** / **Lot 2 ✅ CLOS — Session 141 (suite 6/RESNAT)** /
**Lot 3 ✅ CLOS — Session 141 (suite 23)** / **Lot 4 ✅ CLOS — Session 141 (suite 25), fonctionnel
confirmé Saar en navigateur** (voir détail de clôture en fin de section Lot 4 ci-dessus). Gap
différé documenté en cours de route : **`[CHOC1]`** (bonus Choc de Corne si tête — pool de dommages
de Choc `prt` jamais consommé, hors scope de ce lot). **Lot 5 (Déblocage de compétences, `[CS7]`) à
détailler avec Saar quand il voudra enchaîner** — même méthode (plan ligne-à-ligne, analyse à
charge, vérification instrumentée avant tout code).
