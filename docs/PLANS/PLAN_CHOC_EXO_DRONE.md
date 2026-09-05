# PLAN_CHOC_EXO_DRONE.md — Choc d'arme absent pour un tireur exo-armure ou drone

> Rédigé 2026-09-05 (Claude/Saar), issu de l'audit « projection des capacités d'arme »
> (`ref_equipment` → points de lecture combat, 2026-09-05). **Révisé le même jour après analyse à
> charge** — le tracé complet du chemin de données a débusqué un bug indépendant du Choc, déjà en
> production, plus grave que ce que ce plan corrige (§2.2, Palier 0 — ticket
> `EXODRONE-CONFIRMDAMAGE-CRASH`), et a révélé que le threading initialement prévu (Paliers B/D)
> était incomplet de plusieurs points de contact. Étend au tireur exo-armure et drone la mécanique
> de Choc d'arme déjà posée pour l'humanoïde par **CHOC1** (`docs/Old/PLAN_CHOC1.md`, migration
> 190, archivé — chantier clos et intégré). **Autorité : Livre de Base Polaris p.243 (déjà transcrit
> et validé par CHOC1) > ce plan.** Aucune nouvelle règle de jeu ici — uniquement la réparation d'un
> branchement technique qui a laissé filer une mécanique déjà tranchée.
>
> Cadrage strict, une seule responsabilité : le Choc d'arme (`ref_equipment.shock` +
> `shock_mechanism` + `shock_reduced_by_armor`) porté par un tireur exo-armure ou drone. Ne traite
> **pas** la dette de dispatch combat plus large (`docs/ROADMAP.md` §5) ni l'AOE tireur drone
> (`PLAN_ARMES_SPECIALES.md` Segment 2b) — voir §3 Hors périmètre. Le Palier 0 (§2.2) est un
> correctif de robustesse strictement nécessaire pour que le reste du plan soit vérifiable — pas une
> extension de périmètre.

---

## 1. Constat [VÉRIFIÉ]

### 1.1 Le bug

Trois (quatre en comptant l'AOE) points de lecture ne sélectionnent jamais `shock`,
`shock_mechanism` ni `shock_reduced_by_armor` sur `ref_equipment`, alors que ces colonnes existent
et sont peuplées pour 19 lignes du catalogue (Lance-flammes, Fusils choc Stun/Stun II, Dague
neurale Brain, Poing choc, Masse, Hache(s), Massues, Bâton/Canne de combat, Batte Dicta, Matraque
Mao, Électro-fouet, Gant énergétique, 2 fusils soniques) :

| Site | Fichier:ligne | Fonction |
|---|---|---|
| Tir exo | [socketCombatExo.js:59-73](../../server/src/socket/socketCombatExo.js#L59-L73) | `fetchExoWeapon` |
| CaC exo | [socketCombatExo.js:277-287](../../server/src/socket/socketCombatExo.js#L277-L287) | requête inline `resolveExoMeleeAction` |
| Tir + CaC drone | [socketCombatHelpers.js:2467-2476](../../server/src/socket/socketCombatHelpers.js#L2467-L2476) | requête inline `resolveDroneAssaultAction` |
| AOE tireur exo (Lance-flammes monté sur exo, déjà testé en session réelle par Saar) | [socketCombatAoe.js:519-524](../../server/src/socket/socketCombatAoe.js#L519-L524) | branche `!isHumanoidShooter` de `resolveAoeAssaultAction` |

Le 4ᵉ site partage en réalité la même donnée que le 1ᵉʳ (`fetchAoeShooterWeapon` appelle
`fetchExoWeapon`, `socketCombatAoe.js:152`) — corriger le site 1 corrige aussi la moitié du site 4 ;
il manque encore le branchement `chocDsl` côté tronc AOE (§2.4 Palier B, étape 5).

### 1.2 Cause racine exacte — pas « colonnes oubliées », un couplage involontaire

`getEffectiveWeaponDamage` (`damageService.js:67-138`) fait **deux choses à la fois** :
1. composer la formule de dégât effective à partir de la munition chargée (DSL `ammo_effects`,
   `char_inventory`-only par construction — `_fetchWeaponAndAmmo` joint `char_inventory` ⋈
   `ref_equipment`) ;
2. dériver le Choc de l'arme (`_weaponShockDsl`, lignes 44-52 — pure fonction de
   `{shock, shock_mechanism, shock_reduced_by_armor}`, **indépendante de la munition**).

Un tireur exo ou drone n'a ni munitions ni mods au sens de ce DSL (`exo_weapons`/`drone_weapons`
n'ont pas de `char_inventory` ni de `current_ammo`) — c'est un fait déjà vérifié et documenté
(`socketCombatAoe.js:514-518`, `socketCombatExo.js` en-tête). Chaque appelant a donc, à raison,
décidé de ne jamais appeler `getEffectiveWeaponDamage` pour ces tireurs. Mais en sautant la fonction
entière, il jette aussi le Choc — qui n'a pourtant **aucun rapport** avec la munition. Personne n'a
remarqué que ces deux préoccupations étaient couplées dans une seule fonction : c'est la cause
racine, pas un simple oubli de colonnes.

### 1.3 Second fork, découvert en creusant le premier

Le tireur exo/drone ne partage pas non plus les fonctions de résolution « toucher la cible » du
tireur humanoïde. Deux familles parallèles existent dans `socketCombatHelpers.js` :

| | Tireur humanoïde (`resolveAssaultAction`) | Tireur exo/drone (`resolveExoAssaultAction`/`resolveDroneAssaultAction`) |
|---|---|---|
| Fonctions cible | `resolveAssaultHitPj`/`resolveAssaultHitPnjDrone`/`resolveAssaultHitPnjNormal` (:3249-3402) | `resolveAttackHitDrone`/`resolveAttackHitExo`/`resolveAttackHitPnj`/`resolveAttackHitPj` (:2658-2843), **partagées** entre exo et drone |
| `chocDsl` transmis à `resolveTargetHit` | ✅ (`resolveAssaultHitPnjNormal:3363`) | ❌ — absent de la signature de `resolveAttackHitPnj`/`resolveAttackHitPj`, jamais construit dans `ctx` |

Concrètement : `resolveAttackHitPnj` (:2717-2773) appelle bien `damageService.resolveTargetHit(...)`
mais sans clé `chocDsl` dans l'objet passé — la fonction ne sait même pas que ce paramètre existe.
`resolveAttackHitDrone`/`resolveAttackHitExo` (cible drone/exo) n'ont pas ce problème : elles
n'appellent jamais `resolveTargetHit` (le Choc RAW ne s'applique qu'à un corps vivant, jamais à un
blindage — cohérent avec `resolveTargetHit` qui renvoie `null` pour `cibleType` drone/exo). Le
manque touche donc précisément et uniquement le cas *tireur exo/drone → cible humanoïde (PJ/PNJ)*.

### 1.4 Effet observable

Un PJ/PNJ touché par une exo ou un drone armé d'une des 19 armes à Choc reçoit ses dégâts physiques
normalement, mais perd :
- le total de dégâts additionnel du Choc (ex. +2D6 pour le Lance-flammes) ;
- le Test de Choc combiné physique+Choc (LdB p.243) — `resolveTargetHit` retombe sur un Test basé
  sur la sévérité physique seule, jamais la sévérité combinée qui gouverne RAW l'étourdissement.

Identique tirée par un humanoïde, l'arme applique correctement les deux (`damageService.js`,
chemin déjà complet). Aucune erreur, aucun log — silencieux, exactement comme le gap `aoe_profile`
trouvé et corrigé au Segment 2a (`PLAN_ARMES_SPECIALES.md` §1.4bis). **Mais §1.4 ne décrit que le
cas où la cible est un PNJ (auto-résolution immédiate) — le cas cible PJ est pire, voir Palier 0.**

---

## 2. Architecture cible — réutiliser, jamais dupliquer

### 2.1 Ce qui existe déjà et sera réutilisé

| Brique | Où | Réutilisation |
|---|---|---|
| `_weaponShockDsl(row)` | `damageService.js:44-52` — pure, déjà l'unique dérivation `{shock,shock_mechanism,shock_reduced_by_armor} → chocDsl` | **Exportée** sous une forme normalisée (§2.3) — devient l'autorité appelable indépendamment de `getEffectiveWeaponDamage` |
| `getEffectiveMeleeDamage` | `damageService.js:195-244` | Déjà appelée par les fonctions défenseur CaC (§2.6) — étendue d'un paramètre, pas remplacée |
| `resolveDefenselessTarget`/`resolveMeleeDefensePnj`/`resolveMeleeDefenseDrone`/`resolveMeleeDefensePj` | `socketCombatHelpers.js:1860/1939/2081/2120` | **Déjà partagées** entre CaC humanoïde et CaC exo (confirmé `socketCombatExo.js:251-254`, « Option B » Saar 2026-08-26) — un seul point à étendre profite aux deux |
| `confirmMeleeDefense`/`resolveMeleeDefenseHitAttackerPnj` | `socketCombatHelpers.js:586-730`/`792-` | **Déjà partagées** — relais du CaC exo vers un défenseur PJ actif (§2.6, trouvé lors de l'analyse à charge, absent du plan initial) |
| `confirmDamage` | `socketCombatHelpers.js:868-981` | Point de résolution différé unique (PJ cible) pour Tir ET CaC — à étendre en Paliers 0 et B/D, jamais dupliqué |
| `fetchExoWeapon` | `socketCombatExo.js:59-73` | **Déjà partagée** Tir exo + AOE tireur exo (`socketCombatAoe.js:152`) — une seule correction profite aux deux |
| `resolveAttackHitPnj`/`resolveAttackHitPj` | `socketCombatHelpers.js:2717/2776` | **Déjà partagées** entre tireur exo et tireur drone — un seul point à étendre profite aux deux |

Aucune nouvelle table de colonnes, aucun nouveau service : chaque palier ci-dessous *étend* une
fonction qui joue déjà ce rôle pour un autre appelant, jamais une 2ᵉ copie.

### 2.2 Palier 0 — Correctif préalable : crash `confirmDamage` (bug indépendant du Choc)

**Trouvé pendant l'analyse à charge de ce plan, pas dans l'audit initial.** `confirmDamage`,
branche `assault` (`socketCombatHelpers.js:936`), appelle sans garde
`damageService.getEffectiveWeaponDamage(db, weaponInvId, ...)`. Testé empiriquement (Knex 3.2.10,
query builder seul) : `.where({ id: undefined })` **lève une exception** à la construction de la
requête (« Undefined binding(s) detected »).

`resolveAttackHitPj` (`socketCombatHelpers.js:2787-2802`) — utilisée par Tir exo, Tir drone **et**
CaC drone (`resolveDroneAssaultAction` route les deux vers le même dispatch final) — arme son
`combat_pending` **sans jamais fournir `weaponInvId`**. Résultat : quand un de ces trois tireurs
touche un **PJ** et que ce PJ confirme ses dégâts, `confirmDamage` plante dans son propre
`try/catch` (ligne 911-980) — le `combat_pending` est déjà supprimé et `advanceTimeline()` déjà
appelé *avant* le `try` (lignes 882-899), donc la partie continue sans que personne ne le remarque.
**Le PJ ne prend jamais de dégât d'un Tir exo, d'un Tir drone, ou d'un CaC drone.** Seul CaC exo y
échappe (chemin `getEffectiveMeleeDamage`, déjà gardé par `if (weaponInvId)`).

Bug **totalement indépendant du Choc** — présent que `shock_mechanism` soit câblé ou non. Mais sans
le corriger, aucun scénario de test « exo/drone tire sur un PJ » du §4 ne peut aller au bout : la
Résolution ne finit jamais. Ticketé séparément (`EXODRONE-CONFIRMDAMAGE-CRASH`, `status: triaged`,
`priority: high`) — reproduction en session réelle requise avant correctif (méthodologie
`docs/SYSTEME/TICKETS.md` §4), mais le corriger comme préalable de ce plan est la voie la moins
coûteuse : ce plan touche déjà `confirmDamage` pour une autre raison (Palier B ci-dessous).

**Correctif** :
```js
// confirmDamage, branche assault (au lieu de l'appel non gardé actuel)
const effectiveDamage = weaponInvId
  ? await damageService.getEffectiveWeaponDamage(db, weaponInvId, { rangeBand: portee })
  : null
...
effectiveChocDsl = effectiveDamage ? effectiveDamage.choc : (pending.chocDsl ?? null)
```
`pending.chocDsl` : nouveau champ, posé par le Palier B (§2.4) — sans lui, ce correctif seul
enlève le crash mais laisse le Choc à `null` pour un tireur exo/drone (repli sur la formule brute
stockée, comportement dégradé mais sûr — c'était déjà le comportement de fait pour un PNJ cible).

### 2.3 Palier A — Primitive Choc indépendante, contrat normalisé

Exporter `buildWeaponShockDsl` (renommage de `_weaponShockDsl`) — **mais avec une signature
normalisée**, pas la signature actuelle qui lit des noms de colonnes figés (`row.weapon_shock`,
`row.weapon_shock_mechanism`, `row.weapon_shock_reduced_by_armor`). Risque identifié en analyse à
charge : si les 3 nouvelles requêtes (Palier B/D) aliasent leurs colonnes différemment — probable,
chaque fichier a déjà ses propres conventions (`ref_range`, `ref_aoe_profile`…) — la fonction ne
plante pas, elle **retourne silencieusement `null`**, donnant l'illusion d'un fix qui ne fait rien.
Nouvelle signature :
```js
export function buildWeaponShockDsl({ shock, shockMechanism, reducedByArmor }) {
  if (!shockMechanism || !shock) return null
  return { action: 'SET', value: shock, gateLocation: shockMechanism === 'tete_gated' ? 'tete' : null, reducedByArmor }
}
```
Chaque appelant (interne à `damageService.js` inclus, pour rester cohérent) fait le mapping
explicite depuis SES propres alias à l'appel — un mismatch devient un `undefined` visible dans un
objet littéral local, pas une valeur `null` qui se propage sans bruit à trois fichiers de distance.
`getEffectiveWeaponDamage`/`getEffectiveMeleeDamage` sont mis à jour pour appeler la nouvelle forme
avec leurs alias existants — comportement strictement inchangé pour elles (pur renommage +
indirection).

### 2.4 Palier B — Tir (exo + drone), cible humanoïde

1. `fetchExoWeapon` (`socketCombatExo.js:59-73`) : ajoute `ref_equipment.shock`,
   `shock_mechanism`, `shock_reduced_by_armor` au `SELECT`.
2. Requête inline drone (`socketCombatHelpers.js:2467-2476`) : mêmes 3 colonnes + `ref_equipment.id`
   (absent aujourd'hui, nécessaire au Palier D).
3. `resolveExoAssaultAction`/`resolveDroneAssaultAction` : construisent
   `chocDsl = buildWeaponShockDsl({ shock: weapon.shock, shockMechanism: weapon.shock_mechanism,
   reducedByArmor: weapon.shock_reduced_by_armor })` et l'ajoutent à `ctx` (déjà `{ action,
   cibleCharacter, formula, mr, portee, tireurUsername, tireurColor, userId, now }` — additif).
4. `resolveAttackHitPnj`/`resolveAttackHitPj` (`socketCombatHelpers.js:2717/2776`) : ajoutent
   `chocDsl` à la déstructuration de `ctx`.
   - `resolveAttackHitPnj` (cible PNJ, auto-résolution immédiate) : transmet directement à
     `resolveTargetHit` (même clé que `resolveAssaultHitPnjNormal:3363`) — **suffisant, aucun autre
     hop**.
   - `resolveAttackHitPj` (cible PJ, résolution différée) : **ajoute `chocDsl` au payload
     `armAwaitingDamage`** (`socketCombatHelpers.js:2787-2802`, absent aujourd'hui) — nécessaire
     pour que le correctif du Palier 0 (`pending.chocDsl ?? null`) trouve une valeur.
   - `resolveAttackHitDrone`/`resolveAttackHitExo` **inchangées** — cible drone/exo n'utilise jamais
     `resolveTargetHit`, donc jamais `chocDsl` (§1.3).
5. Tronc AOE (`socketCombatAoe.js:519-530`) : la branche `!isHumanoidShooter` calcule aujourd'hui
   `baseRaw` depuis `weapon.ref_damage_h` sans jamais construire de `chocDsl`. `fetchAoeShooterWeapon`
   (`socketCombatAoe.js:154-158`) normalise déjà la forme retournée pour un tireur exo — y ajouter
   `ref_shock`/`ref_shock_mechanism`/`ref_shock_reduced_by_armor`, puis calculer
   `chocDsl = weapon.equipment_id ? buildWeaponShockDsl({ shock: weapon.ref_shock, shockMechanism: weapon.ref_shock_mechanism, reducedByArmor: weapon.ref_shock_reduced_by_armor }) : null`
   et le faire circuler jusqu'à `resolveAoeTargetDamage`/`mech.computeTargetDamage` exactement comme
   `effectiveDamage.choc` pour un tireur humanoïde (même decision F de `PLAN_ARMES_SPECIALES.md`
   §1.5 — « un seul Choc par cible touchée », déjà géré par le tronc, ligne 275, aucun changement à
   cette règle). L'AOE tireur exo touche toujours un PNJ/décor à ce jour côté résolution immédiate —
   pas de round-trip PJ différé connu sur ce chemin, donc pas de Palier-0-bis nécessaire ici ; **à
   vérifier explicitement au codage** (le tronc AOE ne semble jamais suspendre pour un PJ cible,
   mais ce plan ne l'a pas tracé aussi loin que Tir/CaC classiques — si un round-trip existe, il
   faudra le même correctif que le Palier 0).

### 2.5 Palier C — Munitions/mods exo/drone : non concernés, à ne pas toucher

`ammoFx`/`getEffectiveWeaponDamage` restent strictement `char_inventory`-only (invariant déjà
documenté et vérifié, §1.2) — ce plan ne leur ajoute rien pour l'exo/le drone. Seul le Choc, propriété
de l'arme elle-même et non de la munition, est concerné.

### 2.6 Palier D — CaC (exo + drone), cible humanoïde

`getEffectiveMeleeDamage(db, { weaponInvId, naturalWeaponCharMutationId, charSheetId,
fallbackFormula })` (`damageService.js:195-244`) gagne un **5ᵉ paramètre optionnel `weaponRefId`**
(`ref_equipment.id`, jamais un `char_inventory.id`) :
```js
} else if (weaponRefId) {
  // Arme exo/drone (hors char_inventory) — Choc dérivé directement du catalogue, formule déjà
  // résolue par l'appelant (fallbackFormula). Distinct de la branche "mains nues" ci-dessous :
  // fallbackFormula peut être légitimement null ici (arme Choc pur, ex. Dague neurale Brain montée
  // sur exo — vérifié en base, cette ligne existe) — ne JAMAIS retomber sur '1D4' dans ce cas.
  const row = await db('ref_equipment').where({ id: weaponRefId })
    .select('shock', 'shock_mechanism', 'shock_reduced_by_armor', 'name').first()
  formula = fallbackFormula ?? null
  producer = 'arme exo/drone'
  weaponName = row?.name ?? null
  choc = row ? buildWeaponShockDsl({ shock: row.shock, shockMechanism: row.shock_mechanism, reducedByArmor: row.shock_reduced_by_armor }) : null
} else {
  formula = fallbackFormula ?? '1D4'   // vraies mains nues uniquement — inchangé
  producer = 'mains nues'
}
```
**Trouvaille en base (analyse à charge)** : `ref_equipment` contient réellement une arme de contact
Choc-pur, catégorie `Arme de contact` — **Dague neurale Brain** (`damage_h: null`, `shock: '3D10'`,
`shock_mechanism: 'pure'`). Sans la distinction ci-dessus, si cette arme est un jour montée sur une
exo/un drone, le code retomberait sur `'1D4'` (dégât « mains nues ») au lieu de 0 — le Choc serait
corrigé mais la formule physique resterait fausse. Peu de risque pratique aujourd'hui (le Choc
n'ayant jamais marché, personne n'a de raison d'avoir monté cette arme sur une exo), corrigé en
même temps que la branche est de toute façon touchée.

**Chaîne complète de threading — 7 points de contact, pas 4** (le plan initial n'en listait que 4,
corrigé après avoir tracé le chemin réel « CaC exo → PJ qui se défend activement et se fait quand
même toucher ») :

1. `resolveExoMeleeAction` (`socketCombatExo.js:445-471`, `commonPending`) : ajoute
   `weaponRefId: weapon.equipment_id`.
2. `resolveMeleeDefensePj` (`socketCombatHelpers.js:2120-2143`) : stocke tout `ctx` (=
   `commonPending`) tel quel dans `combat_pending` (`payload: ctx`) — **rien à changer ici**,
   `weaponRefId` survit automatiquement.
3. `confirmMeleeDefense` (`socketCombatHelpers.js:603-615`) : la déstructuration de `pending`
   n'inclut pas `weaponRefId` — **à ajouter**.
4. `confirmMeleeDefense` (`socketCombatHelpers.js:703-710`) : le `ctx` reconstruit pour
   `resolveMeleeDefenseHitAttackerPj`/`Pnj` n'inclut pas `weaponRefId` — **à ajouter**.
5. `resolveMeleeDefenseHitAttackerPnj` (`socketCombatHelpers.js:792-`) — c'est cette branche, pas
   `resolveMeleeDefenseHitAttackerPj`, qui traite un attaquant exo (`attackerCharacter.type` n'est
   jamais `'pj'` pour une exo) : déstructuration à étendre + `weaponRefId` à passer dans le nouveau
   `armAwaitingDamage(type: 'melee', ...)` qu'elle arme.
6. `confirmDamage` (`socketCombatHelpers.js:902-909`), branche `melee` (ligne 922) : la
   déstructuration de `pending` n'inclut pas `weaponRefId` — **à ajouter**, puis le passer à
   `getEffectiveMeleeDamage({ weaponInvId, weaponRefId, fallbackFormula: formula })`.
7. `resolveDefenselessTarget`/`resolveMeleeDefensePnj`/`resolveMeleeDefenseDrone`
   (`socketCombatHelpers.js:1860/1939/2081`) — les 3 branches à résolution **immédiate** (pas de
   round-trip défense active) : ajoutent `weaponRefId` à leur déstructuration de `ctx` et à leur
   appel `getEffectiveMeleeDamage` existant (patron déjà présent, ex.
   `resolveDefenselessTarget:1876-1878`).

Le CaC drone n'emprunte aucun de ces 7 points — il reste entièrement couvert par le Palier B (§1.3,
§2.4), aucun travail Palier D supplémentaire pour le drone.

**Note adjacente, hors périmètre de ce plan** : en traçant les points 3-4-5, `naturalWeaponCharMutationId`
(mutation à arme naturelle, ex. Corne +1D6 Choc si tête) a **exactement le même trou** — absent de
ces mêmes listes, indépendamment de l'exo/du drone. Un attaquant humanoïde avec une mutation à arme
naturelle qui touche un défenseur PJ actif perd déjà son Choc de mutation aujourd'hui. Bug réel,
distinct de celui-ci, **non corrigé par ce plan** (périmètre = Choc exo/drone uniquement — corriger
`naturalWeaponCharMutationId` au passage mélangerait deux causes racines dans un même chantier).
À ticketer séparément si Saar veut le garder tracé.

### 2.7 Ce que ce plan ne construit pas

Aucune nouvelle mécanique de jeu. Le RAW du Choc (catégories 1/2, LdB p.243) est déjà transcrit et
tranché par CHOC1 (archivé) — ce plan répare uniquement son branchement pour deux tireurs qui
avaient été oubliés, plus un correctif de robustesse préalable (Palier 0) sans rapport avec le Choc.

---

## 3. Hors périmètre (délibéré, avec la raison de chaque exclusion)

- **Dispatch de résolution combat** (`docs/ROADMAP.md` §5 — fork `resolveAttackHit*` /
  `resolveAssaultHit*`, `resolveDroneAssaultAction` qui mélange encore Tir/CaC). Décision déjà prise
  par Saar le 2026-08-26 : rework ciblé séparé, jamais mélangé à un ajout/correctif fonctionnel. Ce
  plan **étend** les fonctions existantes sans les fusionner ni les réorganiser — la duplication
  structurelle documentée en §1.3 reste, volontairement, pour ce chantier.
- **Le pattern de relais par listes de champs recopiées à la main** (`commonPending` → `confirmMeleeDefense`
  ×2 → `resolveMeleeDefenseHitAttacker*` → `confirmDamage`, §2.6) — c'est la même maladie
  structurelle que l'audit original (pas d'autorité unique), appliquée aux champs d'un payload
  plutôt qu'aux colonnes `ref_equipment`. Preuve concrète que ce n'est pas hypothétique :
  `naturalWeaponCharMutationId` a déjà ce trou aujourd'hui (§2.6, note adjacente), indépendamment de
  ce plan. Non corrigé ici — rejoindrait la dette `ROADMAP.md` §5 que Saar a déjà décidé de traiter
  à part, pas dans un correctif ponctuel.
- **AOE tireur drone** (`PLAN_ARMES_SPECIALES.md` Segment 2b, non câblé — `fetchAoeShooterWeapon`
  renvoie `null` pour `character.type === 'drone'`). Reste hors scope ici. **Point de vigilance pour
  le jour où 2b sera fait** : la future requête arme drone-AOE devra inclure les 3 colonnes shock
  dès sa première version — ne pas répéter l'oubli.
- **Mods/munitions exo/drone** (gap de schéma déjà connu et assumé, `ROADMAP.md`/`PLAN_ARMES_SPECIALES.md`) — aucun changement.
- **Affichage client du Choc sur la fiche exo** — vérifié par grep (`ref_shock` n'est lu que par
  `InventoryPanel.jsx`/`damageTypeBadges.js`, tous deux côté inventaire humanoïde ; aucun composant
  exo ne lit `ref_shock` aujourd'hui). Pas de correction d'affichage requise dans ce lot — si un futur
  composant expose le Choc d'une arme exo, il devra lire `shock_mechanism` en même temps que
  `ref_shock` (rappel, pas une tâche ouverte de ce plan).
- **Décision de jeu/équilibrage** — ce plan restaure un comportement RAW déjà tranché, il ne
  réévalue pas si le Choc doit s'appliquer. **Point à signaler à Saar avant codage** (§5) : si un
  combat a déjà été mené/équilibré en supposant le Choc exo/drone absent, le corriger change l'issue
  de futurs combats similaires — décision de Saar, pas de ce plan.

---

## 4. Plan de tests

- `buildWeaponShockDsl({ shock, shockMechanism, reducedByArmor })` : cas nominal (mechanism
  non-null → dsl construit), cas garde (`shock`/`shockMechanism` manquant → `null`), `node --test`.
  Non-régression : `getEffectiveWeaponDamage`/`getEffectiveMeleeDamage` doivent produire exactement
  les mêmes résultats qu'avant le renommage (mêmes fixtures existantes).
- `getEffectiveMeleeDamage({ weaponRefId })` : nouveau cas, `node --test` — arme à
  `shock_mechanism` non-null via `weaponRefId` seul (weaponInvId/naturalWeaponCharMutationId null)
  → `choc` non-null ; **cas Dague neurale Brain** (`weaponRefId` fourni, `fallbackFormula: null`) →
  `total: 0`, jamais `'1D4'` ; `weaponRefId` absent → comportement identique à aujourd'hui
  (non-régression, vraies mains nues toujours `'1D4'`).
- **Palier 0, avant tout le reste** : reproduire le crash actuel en session réelle (exo ou drone
  tire sur un PJ, PJ clique « confirmer les dégâts ») → observer l'absence de résultat +
  `[WS] confirmDamage error` dans les logs serveur, PUIS vérifier que le correctif (garde
  `weaponInvId` + repli `pending.chocDsl`) fait disparaître le crash **avant** de valider le Choc
  lui-même — sans ce préalable, aucun test « cible PJ » ci-dessous n'est significatif.
- Non-régression Tir/CaC humanoïde : suite existante `socketCombatHelpers.test.mjs` — aucun appelant
  humanoïde ne passe les nouveaux paramètres, chemins existants inchangés par construction.
- **Session réelle Saar**, seule validation qui compte pour la mécanique de jeu (`.claude/rules`,
  aucune Blessure/Test de Choc ne se valide par script) :
  - Exo tir avec Lance-flammes sur un **PNJ** → Choc 2D6 appliqué (chemin simple, Palier B point 4
    seul).
  - Exo tir avec Lance-flammes sur un **PJ** → Choc 2D6 appliqué **et** confirmation de dégâts
    aboutit (valide Palier 0 + Palier B point 4 ensemble).
  - Exo CaC avec une arme à Choc (ex. Masse) sur un PNJ (chemin immédiat, Palier D point 7 seul) et
    sur un PJ qui se défend activement et se fait quand même toucher (chemin complet, Palier D
    points 1-6).
  - Drone tir avec une arme à Choc montée, sur PNJ et sur PJ.
  - AOE lance-flammes tiré par une exo → refaire le scénario déjà validé au Segment 2a (sans Choc),
    vérifier cette fois le Choc appliqué à chaque cible touchée.
  - Non-régression : Tir/CaC humanoïde avec la même arme (Lance-flammes en main, déjà validé
    Segment 1) — comportement strictement identique.

---

## 5. Décisions (tranchées avec Saar, 2026-09-05)

- **Régression de comportement / combat déjà équilibré sur l'absence de Choc exo/drone** —
  **TRANCHÉ (Saar : non, rien remarqué).** Aucune séance ne s'est appuyée sur ce manque. Le
  rework peut restaurer le comportement RAW sans réserve.
- **Palier 0 (correctif du crash `confirmDamage`, sans rapport direct avec le Choc) codé dans ce
  même chantier plutôt qu'en aval** — **TRANCHÉ (Saar : même chantier).**
- **Ticket `EXODRONE-CONFIRMDAMAGE-CRASH`** — créé en base 2026-09-05
  (`id: c8aba856-8826-43d9-83ff-902a15a8e9f1`, `status: triaged`, `priority: high`), vérifié.
- **Ticket `NATWEAPON-CHOC-DEFENSE-GAP`** (note adjacente §2.6, mutation à arme naturelle) —
  **TRANCHÉ (Saar : ticket séparé)**, script prêt
  (`server/src/scripts/create_ticket_natweapon_choc_defense_gap.js`), à lancer par Saar.
- **Reproduction en session réelle du crash `EXODRONE-CONFIRMDAMAGE-CRASH`** — **CONFIRMÉE (Saar,
  2026-09-05)** : Drone armé du Fusil Gauss, Tir sur un PJ, le PJ confirme ses dégâts → aucun
  dégât appliqué. Correspond exactement au mécanisme prédit par lecture de code (§2.2). Méthodologie
  `docs/SYSTEME/TICKETS.md` §4 étape 2 satisfaite — le Palier 0 peut être codé. Pas de paramètre de
  compatibilité à construire (`AGENTS.md` interdit les rustines/flags de repli) — une seule vérité
  désormais, comme pour l'humanoïde.

---

## 6. État d'implémentation

| Palier | Statut |
|---|---|
| 0 — correctif crash `confirmDamage` (bug indépendant, ticket `EXODRONE-CONFIRMDAMAGE-CRASH`) | Ticketé (`triaged`), pas codé — reproduction session réelle requise avant correctif |
| A — export `buildWeaponShockDsl` (signature normalisée) | Cadré, pas codé |
| B — Tir exo/drone (+ AOE tireur exo) | Cadré, pas codé — dépend du Palier 0 pour le sous-cas cible PJ |
| C — munitions/mods exo/drone | Non concerné (rappel de périmètre) |
| D — CaC exo (7 points de contact, drone déjà couvert par B) | Cadré, pas codé |
| Tests + session réelle | Non commencés |
