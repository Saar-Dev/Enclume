# PLAN_TIRVISE v2.md — Viser une Localisation précise (`COM9`), même patron que Tir visé ✅ CLOS — Session 155 (Saar)

> Rédaction — 2026-07-17. Statut : **✅ CLOS — codé, testé, parcours navigateur confirmé fonctionnel
> par Saar (2026-07-17).** `MANUELSYSCOMBAT.md` §6.10 ajouté (contenu durable). Archivé dans
> `docs/Old/` conformément à `docs/RegleDocumentaire.md` Règle 10 (un PLAN est temporaire).
> Suite directe de `docs/Old/PLAN_TIRVISE.md` (v1, ✅ clos Session 141 suite 17) — v1 avait déjà
> repéré cette règle en clôturant sa session ("Suite possible, non tranchée : `COM9`") sans la coder.
> Discussion directe avec Saar (pas de questionnaire structuré), plusieurs corrections de trajectoire
> pendant la discussion — voir "Historique des révisions".

---

## 0. Cadrage — ce qui est réellement vrai aujourd'hui

**`COM9` = "Viser une Localisation précise"** (`docs/BUGIDENTIFIE.md:156-166`), **distinct** de "Tir
visé" (bonus au Test via sacrifice d'Initiative, ✅ déjà codé) et de "Changer le mode de tir" (dette
non implémentée, non touchée ici) — trois mécaniques voisines mais différentes, déjà confondues deux
fois en session (`docs/VOCABULARY.md:75`).

**Absence confirmée `[VÉRIFIÉ]`** :
- `docs/MANUELSYSCOMBAT.md` (SSOT technique) ne mentionne cette règle **nulle part** — son §6
  ("Règles Omises") couvre portée/CaC/multi-attaques/actions exclusives/drones, mais pas Localisation
  précise. C'est un vrai trou du SSOT, pas seulement un oubli de code.
- `damageService.resolveTargetHit` (`server/src/lib/damageService.js:107-110`) tire **toujours**
  `1d20` pour la localisation — seul point d'autorité, confirmé par lecture, aucun bypass existant.
- Grep exhaustif `aimedLocation`/`aimed_location`/`AIMED_LOCATION` sur `server/src` et `client/src` :
  aucune occurrence, rien à réutiliser d'un chantier antérieur.

**Ce que ce plan couvre** : uniquement le combat à distance (assault), PJ **et** PNJ humanoïdes,
tireur et cible. **Hors scope explicite** : corps-à-corps, drones tireurs, 4ᵉ palier LdB (zone très
spécifique) — voir §7 "Hors scope".

---

## 1. Règle LdB (source de vérité — `docs/REGLES/REGLESYSCOMBAT.md:1754-1765`)

> « Viser une Localisation précise — Il est en général difficile de viser une Localisation précise,
> car le combat est surtout une affaire d'opportunité : les combattants touchent là où ils peuvent…
> Si un combattant décide de toucher un endroit précis sur le corps de leur adversaire, appliquez les
> malus suivants :
> • Corps : -3
> • Jambes : -5
> • Tête/Bras : -7
> • Un endroit bien spécifique du corps (épaule, ventre, main, genou, etc.) : -7 à -10
> Tous ces malus ne sont là qu'à titre indicatif et devront être adaptés selon la situation. »

Contrairement à Tir visé, cette règle **ne coûte aucune Initiative** et n'impose **aucune contrainte
d'immobilité ni d'exclusivité** — un malus de Test pur, appliqué en échange d'un choix de zone garanti
au lieu du 1D20 aléatoire.

**4ᵉ palier ("un endroit bien spécifique… épaule, ventre, main, genou") — décision Saar (2026-07-17) :
non géré.** Le système de blessures (`shared/armorConstants.js:26-30`, `SLOT_TO_WOUND_LOCATION`) ne
connaît que 6 zones générales (Tête/Corps/Bras D/Bras G/Jambe D/Jambe G) — "épaule" ou "genou"
n'existent pas comme localisation de blessure et ne seront pas ajoutés ici. Reste à la discrétion
narrative du MJ, jamais codé.

---

## 1bis. Recherche & inspiration (avant codage — demande explicite Saar, 2026-07-17)

**Validation de la règle LdB par un système comparable** : Pathfinder ("Called Shots",
[d20pfsrd](https://www.d20pfsrd.com/gamemastering/other-rules/called-shots/),
[Archive of Nethys — legacy](https://legacy.aonprd.com/ultimateCombat/variants/calledShots.html)) a
une structure à 3 paliers de malus croissant avec la précision de la zone : zones larges **−2**,
zones difficiles (main, tête) **−5**, zones très petites (yeux, gorge) **−10** — même *design shape*
que Corps −3/Jambes −5/Tête+Bras −7/zone très spécifique −7 à −10 du LdB Polaris. Confirme que le 4ᵉ
palier "zone très spécifique" n'est pas une bizarrerie isolée du LdB Polaris : c'est la norme du
genre pour ce type de règle. Renforce la Décision 6 (§3) — le documenter comme non géré plutôt que de
l'inventer approximativement, puisqu'un système pro sérieux le traite comme un cas à part avec son
propre système de conséquences (pas juste un chiffre de malus), hors de portée de ce chantier.

**Architecture comparable — Cyberpunk RED** (FoundryVTT, code réel lu via l'API GitLab publique,
`gitlab.com/cyberpunk-red-team/fvtt-cyberpunk-red-core`, `src/modules/rolls/cpr-modifiers.js`) : leur
"Aimed Shot" est un **sous-type de Roll** (`CPRAimedAttackRoll`) qui déclenche l'ajout de clés de
bonus (`bonuses.aimedShot`, `bonuses.singleShot`) sommées par un système générique de modificateurs
(`CPRMod`, qui encapsule des `ActiveEffect` Foundry). C'est structurellement **le même patron** que
notre `aim_bonus_comp` existant (terme additif nommé dans `totalModComp`) — en POO/ActiveEffects chez
eux, en fonctions JS + colonne DB chez nous. **Aucune divergence d'architecture à corriger** : notre
approche flat/fonctionnelle est cohérente avec l'équivalent professionnel, adaptée à notre stack
existante (même conclusion que le plan v1 sur PF2e Rule Elements — pas de moteur générique
disproportionné pour un ensemble fixe et développeur-authored).

**Limite honnête de cette recherche** : le cœur des règles Cyberpunk RED **ne modélise pas de table
de localisation aléatoire à bypasser** (pas d'équivalent à notre "1D20 → zone") — leur "Aimed Shot"
est donc plus proche mécaniquement de notre "Tir visé" (bonus au Test) que de "Viser une Localisation
précise" (override d'un jet de zone). Aucun système open-source avec code inspectable combinant les
deux (table de localisation aléatoire *et* override manuel) n'a été trouvé pendant cette recherche —
les systèmes qui ont nativement des tables de localisation (GURPS, Rolemaster, Traveller) ont des
implémentations Foundry fermées ou peu inspectables. Le point d'autorité unique déjà identifié dans ce
plan (`damageService.resolveTargetHit`, §0/§2) reste donc une conception maison pour cette partie
précise — cohérente avec le reste de l'architecture combat du projet, mais pas calquée sur un
précédent externe direct pour le bypass lui-même.

**3 points trouvés en relisant le code réel pendant cette recherche** (pas dans la conversation
initiale) — corrections appliquées dans ce document :
1. L'énumération "3 sites à garder" (§2 ancienne version) confondait deux choses différentes — corrigé.
2. Une rafale (RC/RL) n'appelle `resolveTargetHit` qu'une fois, jamais en boucle par balle — vérifié,
   aucun risque (Piège P6, §6).
3. L'interception LOS peut rediriger le tir vers une cible différente de celle visée — `aimed_location`
   s'applique alors à la nouvelle cible ; comportement par défaut proposé mais pas tranché en silence
   (Piège P7, §6).

---

## 2. Architecture actuelle observée — patron Tir visé à répliquer

**`[VÉRIFIÉ]` par lecture de code (pas de mémoire)** — pipeline complet de Tir visé, à répliquer à
l'identique pour Localisation précise (Décision 1, §4) :

1. **Déclaration (ANNONCE)** — `AssaultRangedPanel.jsx` (composant partagé PJ + MJ/PNJ) : état local
   `aimTranches`, inclus dans `mapActions.attack` envoyé via `COMBAT_ACTION_DECLARE`.
2. **Serveur ANNONCE** (`socketCombatAnnouncement.js:229-316`) : lit `mapActions.attack.aimTranches`,
   valide (`isAimEligible`), calcule `iniDelta`, **stocke** `aim_bonus_comp` sur la ligne
   `combat_actions` (colonne réelle, migration 134 — *pas* JSONB `modifiers`, angle mort déjà identifié
   sur `dual_wield_bonus_comp` à ne pas reproduire).
3. **Résolution PNJ immédiat** (`socketCombatHelpers.js:1420` `resolveAssaultAction`) : relit
   `action.aim_bonus_comp`, l'**affine** avec les conditions réelles (`getEffectiveAimBonus`, plafonné
   par Lunette/portée désormais connues), l'ajoute à `totalModComp`/`chancesDeReussite`.
4. **Résolution PJ différée** (`COMBAT_DAMAGE_CONFIRM`, `socketCombatResolution.js`) : le bonus est
   déjà consommé dans le jet d'attaque avant ce point — pas rebesoin de `aim_bonus_comp` à ce stade
   pour Tir visé. **Différence clé pour Localisation précise** : la zone touchée, elle, n'est
   déterminée qu'à *cette* étape (`resolveTargetHit`, appelé ici) — donc `aimed_location` doit
   voyager jusqu'ici via le `payload` du `combat_pending` type `'damage'`
   (`socketCombatHelpers.js:1521-1533`, qui transporte déjà `mr`/`portee`/`char_sheet_id_cible` par
   ce même mécanisme).

**Correction (2026-07-17, relecture ligne à ligne avant codage) — la version précédente de ce plan
comptait "3 sites à garder" de façon incorrecte, en confondant "appelle `resolveTargetHit`" et
"émet une carte `DICE_RESULT` Localisation".** Il y a bien 3 sites qui appellent `resolveTargetHit`
pour une cible humanoïde à distance, mais **un seul** émet une carte `DICE_RESULT` "Localisation — …"
séparée (`formula:'1d20', rolls: locRolls, total: rollLoc`) qui nécessiterait une garde :

- `socketCombatHelpers.js:1201-1207` (`resolveDroneAssaultAction`, §"8b. Cible = PNJ") — **tireur
  drone, hors scope (Décision 4)**. Émet bien une carte "Localisation — Drone" (lignes 1216-1223),
  mais ce site ne recevra **jamais** `forcedSlotCode` (le tireur est un drone, jamais un `aimed_location`
  à lire) — `rollLoc` y sera donc toujours non nul, **aucune garde nécessaire ici**, pas parce qu'elle
  est déjà posée mais parce que ce chemin est structurellement inatteignable avec une zone forcée.
- `socketCombatHelpers.js:1606-1613` (`resolveAssaultAction`, §"PNJ — calcul complet immédiat") —
  tireur humanoïde **dans le scope**, mais `[VÉRIFIÉ]` **aucune carte `DICE_RESULT` "Localisation"
  n'existe à ce site** : la zone touchée n'est exposée que via `COMBAT_ATTACK_RESULT` (lignes
  1621-1634, champ `localisation`), jamais via une carte de jet 1D20 séparée. Rien à garder ici non
  plus — juste `forcedSlotCode` à passer à l'appel `resolveTargetHit`.
- `socketCombatResolution.js:426` (`COMBAT_DAMAGE_CONFIRM`, PJ différé) — **seul site réel** avec une
  carte "Localisation — Distance" séparée (lignes 463-472, `rolls: locRolls, total: rollLoc`). **C'est
  le seul endroit où la garde `if (rollLoc !== null)` a un effet réel.**

**Conséquence directe** : Piège P2 (§6, version précédente) était surdimensionné — corrigé ci-dessous.

---

## 3. Décisions actées (2026-07-17, discussion Saar)

1. **Même patron que Tir visé, pas une architecture différente.** Déclaration en phase ANNONCE
   (comme `aimTranches`), affinement/application en phase RÉSOLUTION (comme `aim_bonus_comp`). Rejet
   explicite d'une première proposition (fenêtre de Résolution seule, `CombatModifiersWindow.jsx`) —
   corrigée par Saar : *« dans tous les cas, c'est une annonce… en phase 2 on utilise les conditions
   réelles pour calculer ces bonus/malus (on affine le calcul) »*. Cohérent avec le principe déjà en
   place partout ailleurs dans le syscombat (recalcul serveur systématique, jamais confiance au
   client pour la valeur finale).
2. **Cumul avec Tir visé autorisé, à tester.** Les deux modificateurs restent additifs et
   indépendants (aucune garde d'exclusivité entre eux) — thématiquement cohérent (deux prix
   différents, Initiative *et* précision, pour un seul bénéfice : garantir la zone). Si les tests en
   jeu révèlent un déséquilibre, ajustement ultérieur — pas un blocage pour ce chantier.
3. **Fenêtres séparées, pas fusionnées.** Tir visé reste dans `AssaultRangedPanel.jsx`/déclaration
   (coût Initiative, doit être fixé avant l'ordre de résolution) ; Localisation précise **rejoint la
   même fenêtre de déclaration** (même composant, nouvelle section) plutôt que `CombatModifiersWindow`
   — décidé après correction du point 1, les deux vivent maintenant à la **même phase**, donc la
   question "même interface ?" est résolue : oui, même fenêtre de déclaration, sections distinctes
   (l'une coûte de l'Initiative, l'autre non — pas de fusion des deux contrôles en un seul).
4. **Drones tireurs exclus** — `MANUELSYSCOMBAT.md` §7.3 liste explicitement les modificateurs
   standard applicables aux drones (portée, taille, obscurité, couverture) et n'inclut pas
   Localisation précise. `resolveDroneAssaultAction` non touché.
5. **Corps-à-corps exclu** — fenêtre différente (`CombatGmDeclareWindow.jsx` pour le CaC MJ,
   `resolveMeleeAction`), non mentionnée dans le ticket `COM9` original. Futur sprint séparé si besoin.
6. **4ᵉ palier LdB non géré** — voir §1, non modélisable sans étendre le système de blessures.
7. **UI — carte de localisation cliquable, réutilisant la silhouette existante.** Plutôt qu'un
   `<select>` textuel : extraire la géométrie SVG de `SilhouettePanel.jsx` (`client/src/character/
   SilhouettePanel.jsx`, onglet MATERIEL fiche perso, affichage lecture-seule des blessures) dans un
   composant partagé, consommé en lecture-seule par `SilhouettePanel.jsx` (inchangé fonctionnellement)
   et en mode interactif (clic = sélection zone) par le nouveau picker de `AssaultRangedPanel.jsx`.
   Réutilise `LOCATION_TO_SVG`/`LOCATION_LABELS` déjà existants (`shared/armorConstants.js`) — pas de
   nouvelle géométrie à dessiner.

---

## 4. Architecture cible

### `shared/armorConstants.js` (MODIFIÉ) — nouvelle table, seule autorité du malus

```js
// Viser une Localisation précise (LdB p.229-230, docs/BUGIDENTIFIE.md COM9) — malus au Test pour
// choisir la zone touchée au lieu du 1D20 aléatoire. Clés = mêmes que SLOT_TO_WOUND_LOCATION/
// LOCATION_TO_SLOT/LOCATION_LABELS (réutilisés tels quels, pas de nouvelle table de zones).
export const AIMED_LOCATION_MALUS = {
  tete: -7, corps: -3,
  bras_droit: -7, bras_gauche: -7,
  jambe_droite: -5, jambe_gauche: -5,
}
```

Le slot (`LOCATION_TO_SLOT[key]`) et le libellé (`LOCATION_LABELS[key]`) existent déjà — aucune
duplication, une seule clé (`aimed_location`) suffit à dériver malus + slot + libellé partout où
c'est nécessaire.

### Migration `164_combat_actions_aimed_location.js` — `combat_actions.aimed_location`

`[VÉRIFIÉ]` (audit direct 2026-07-17, `npx knex --knexfile knexfile.cjs migrate:status` depuis
`server/`) : 174 migrations complétées, **0 en attente** — base synchronisée avec le disque.
**Correction de parité** : la règle CLAUDE.md associe pair/impair au **développeur**, pas à l'outil —
`Saar/Codex` = pair, `Kiwi` = impair. Cette session travaille pour Saar (`dev/Saar`, commits "Session
### (Saar)") ; `159`/`161` sont les trous réservés à Kiwi (jamais créés dans ce dépôt), `158`/`160`/
`162` sont déjà les migrations de Saar. Numéro retenu : **164** (pair, suite de `162`), pas un
impair comme proposé initialement par erreur.

```js
// 164_combat_actions_aimed_location.js
export const up = async (knex) => {
  await knex.schema.alterTable('combat_actions', (table) => {
    table.text('aimed_location').nullable()   // miroir convention fire_mode (57_combat_v3.js) —
                                                // text nullable, pas de CHECK, validation applicative
                                                // via AIMED_LOCATION_MALUS (même précédent que fire_mode)
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('combat_actions', (table) => {
    table.dropColumn('aimed_location')
  })
}
```

`down()` trivial — colonne nullable pure ajout, aucune donnée existante à préserver (même cas que la
migration 134).

### `server/src/socket/socketCombatAnnouncement.js` — bloc `mapActions?.attack` (près de la ligne 304-320)

- Lire `mapActions.attack.aimedLocation` (clé ou `null`).
- **Pas de coût Initiative** — contrairement à `aimTranches`, aucune ligne à ajouter dans `iniDelta`.
- Validation serveur : `aimedLocation` doit être une clé de `AIMED_LOCATION_MALUS` ou `null` — sinon
  ignoré silencieusement (`null`), jamais un `throw` qui bloque l'annonce (même défense en profondeur
  que le reste du fichier : jamais confiance brute au client, mais jamais un tour de combat cassé pour
  une valeur invalide).
- Stocké sur la ligne `combat_actions` (assault) : `aimed_location: aimedLocation ?? null`.

### `server/src/socket/socketCombatHelpers.js` — `resolveAssaultAction` (près de la ligne 1420-1425)

```js
const aimedLocationKey  = action.aimed_location ?? null
const aimedLocationMalus = AIMED_LOCATION_MALUS[aimedLocationKey] ?? 0
const totalModComp = porteeModComp + situationModComp + tailleModComp + isRushedMod + fireModeComp
                    + aimBonusComp + weaponModComp + aimedLocationMalus
```

+ ligne `breakdown` : `{ label: `Visée ${LOCATION_LABELS[aimedLocationKey]}`, value: aimedLocationMalus, type: 'malus' }` si `aimedLocationKey` non nul.

Puis, aux **deux** sites d'appel de `resolveTargetHit` dans ce fichier concernés par un tireur PJ/PNJ
humanoïde (ligne ~1201 exclue — drone tireur, hors scope ; ligne ~1593 PNJ immédiat) :

```js
const hitResult = await damageService.resolveTargetHit(io, db, campaignId, {
  // ...params existants inchangés...
  forcedSlotCode: aimedLocationKey ? LOCATION_TO_SLOT[aimedLocationKey] : null,
})
```

Et dans le `combat_pending` type `'damage'` inséré pour le flux PJ différé (ligne ~1521-1533) :
ajouter `aimedLocation: aimedLocationKey` au `payload`.

### `server/src/socket/socketCombatResolution.js` — `COMBAT_DAMAGE_CONFIRM` (près de la ligne 426)

```js
const hitResult = await damageService.resolveTargetHit(io, db, pendingCampaignId, {
  // ...params existants inchangés...
  forcedSlotCode: payload.aimedLocation ? LOCATION_TO_SLOT[payload.aimedLocation] : null,
})
```

### `server/src/lib/damageService.js` — `resolveTargetHit` (lignes 95-110)

```js
export async function resolveTargetHit(io, db, campaignId, {
  degautsBruts, characterIdCible, cibleType, char_sheet_id_cible,
  for_na_cible, con_na_cible, vol_na_cible, chocDsl = null,
  forcedSlotCode = null,   // NOUVEAU — COM9, bypass du jet quand une zone a été annoncée
}) {
  if (cibleType === 'drone') return null

  // 1. Localisation — visée (COM9) ou D20 aléatoire (comportement historique inchangé)
  let rollLoc = null, locRolls = null, locSeed = null, slotCode
  if (forcedSlotCode) {
    slotCode = forcedSlotCode
  } else {
    const rolled = await parseDice('1d20')
    rollLoc = rolled.total; locRolls = rolled.rolls; locSeed = rolled.seed
    slotCode = (LOC_TABLE.find(r => rollLoc <= r.max) ?? LOC_TABLE[LOC_TABLE.length - 1]).slot
  }
  const localisation = SLOT_TO_WOUND_LOCATION[slotCode] ?? 'corps'
  // ... reste de la fonction strictement inchangé (armure/RD/dégâts/sévérité/blessure/Choc) ...
}
```

`rollLoc`/`locRolls`/`locSeed` restent `null` quand visée — jamais un jet gaspillé pour l'affichage
(convention déjà en place ailleurs dans ce fichier, cf. `getEffectiveWeaponFormulaPreview`).

### 1 émission `DICE_RESULT` "Localisation — Distance" — garde `rollLoc !== null`

**Corrigé (§2)** : un seul site réel, `socketCombatResolution.js:463-472`. Entourer cette émission
(`formula:'1d20', rolls: locRolls, total: rollLoc`) d'un `if (rollLoc !== null)`. Quand visée, cette
carte n'a plus de sens (pas de jet à afficher) — l'émission `COMBAT_ATTACK_RESULT`, elle, reste
inchangée (utilise `localisation`, jamais `rollLoc`). Les 2 autres sites (`resolveDroneAssaultAction`
tireur drone, `resolveAssaultAction` PNJ immédiat) n'ont rien à garder (§2).

### Client — composant partagé silhouette

- Extraire les 6 `<path>` de `SilhouettePanel.jsx` dans un nouveau `BodySilhouetteSvg.jsx` (props :
  `fillFor(loc)`, `onClickLocation?(loc)`) — `SilhouettePanel.jsx` devient un consommateur fin
  (`fillFor` = sévérité blessure, pas de `onClickLocation`), comportement strictement inchangé.
- Nouveau picker interactif consommant `BodySilhouetteSvg` avec `onClickLocation` = sélection
  `aimedLocation`, `fillFor` = surbrillance zone sélectionnée + couleur par malus (réutilise la
  palette existante, pas de nouvelle charte).

### Client — `AssaultRangedPanel.jsx` (composant partagé PJ + MJ/PNJ)

Même patron que Tir visé (`docs/Old/PLAN_TIRVISE.md` §"AssaultRangedPanel.jsx") :
- Nouvel état local `aimedLocation` (×2 fichiers : `CombatActionWindow.jsx` et
  `CombatGmDeclareWindow.jsx`, comme `aimTranches` l'est déjà aux deux endroits — `[VÉRIFIÉ]`
  `CombatGmDeclareWindow.jsx:15,110,449,869,887` importe et câble `AssaultRangedPanel` à l'identique
  du côté joueur).
- Nouvelle section "Viser une localisation" (picker silhouette + bouton "Aucune" pour désélectionner),
  affichage du malus de la zone survolée/sélectionnée.
- **Pas de grisage/éligibilité** — contrairement à Tir visé, aucune condition d'éligibilité (pas
  d'immobilité, pas d'exclusivité) : toujours sélectionnable indépendamment du reste de la
  déclaration.
- Payload (×2 fichiers) : ajout de `aimedLocation` dans l'objet `attack: {...}`.
- Reset à `null` avec les autres états locaux à l'ouverture d'une nouvelle déclaration.

### Optionnel (non bloquant) — `CombatModifiersWindow.jsx`

Afficher en lecture seule, dans le pill d'en-tête ou l'`infoBlock`, "Visée : {zone} ({malus})" si
`assaultAction.aimed_location` est renseigné — cohérence visuelle avant le lancer. **Non fait pour
Tir visé aujourd'hui** (`aim_bonus_comp` n'est pas prévisualisé dans cette fenêtre non plus, gap
préexistant) — donc pas une régression si omis ici ; à ajouter seulement si Saar le juge utile après
un premier test.

---

## 5. Priorités d'implémentation

| Étape | Contenu | Dépendance |
|---|---|---|
| 0 | `shared/armorConstants.js` — `AIMED_LOCATION_MALUS` | — |
| 1 | Migration — `combat_actions.aimed_location` (numéro confirmé par Saar) | — |
| 2 | `BodySilhouetteSvg.jsx` (extraction depuis `SilhouettePanel.jsx`, comportement fiche perso inchangé) | — |
| 3 | `socketCombatAnnouncement.js` — lecture `aimedLocation`, validation, insert colonne (sans coût INI) | Étapes 0+1 |
| 4 | `damageService.resolveTargetHit` — paramètre `forcedSlotCode` | — |
| 5 | `resolveAssaultAction` (`socketCombatHelpers.js`) — malus + breakdown + `forcedSlotCode` (1 site, `resolveDroneAssaultAction` non touché — §2) + `payload.aimedLocation` sur `combat_pending` | Étapes 3+4 |
| 6 | `COMBAT_DAMAGE_CONFIRM` (`socketCombatResolution.js`) — `forcedSlotCode` depuis `payload.aimedLocation` | Étapes 4+5 |
| 7 | Garde `rollLoc !== null` sur l'unique émission `DICE_RESULT` "Localisation — Distance" (`socketCombatResolution.js`, §2) | Étape 4 |
| 8 | Picker silhouette interactif (consomme étape 2) | Étape 2 |
| 9 | `AssaultRangedPanel.jsx` — section "Viser une localisation" | Étapes 0+8 |
| 10 | `CombatActionWindow.jsx` **et** `CombatGmDeclareWindow.jsx` — état `aimedLocation`, payload, reset (×2, PJ et MJ/PNJ) | Étape 9 |

---

## 6. Pièges à anticiper

- **P1** : ne pas oublier le site `combat_pending` (type `'damage'`) — sans `payload.aimedLocation`,
  le flux PJ différé perdrait silencieusement la visée entre l'annonce et la résolution des dégâts
  (même classe de bug que l'angle mort `dual_wield_bonus_comp` déjà identifié dans le plan v1, à ne
  pas reproduire ici).
- **P2 — CORRIGÉ (2026-07-17)** : la version précédente demandait la garde `rollLoc !== null` sur
  "3 sites" — faux, un seul site en a besoin (`socketCombatResolution.js:463-472`, §2/§4). Ne pas
  ajouter cette garde ailleurs "par symétrie" — les 2 autres sites n'ont pas de carte à protéger.
- **P3** : valider `aimedLocation` côté serveur contre les clés réelles de `AIMED_LOCATION_MALUS`
  avant tout usage — jamais un slot forcé depuis une clé arbitraire envoyée par le client
  (`LOCATION_TO_SLOT[clé_invalide]` → `undefined` → comportement `[INCONNU]` dans
  `resolveTargetHit` si non gardé).
- **P4** : `resolveDroneAssaultAction` (ligne ~1201, drone **tireur**) ne doit **pas** recevoir
  `forcedSlotCode` — Décision 4. Vérifier qu'aucune modification n'y est appliquée par erreur en
  copiant le bloc du PNJ immédiat.
- **P5 — RÉSOLU** : migration auditée directement (`npx knex migrate:status`, §4) — `164` confirmé,
  base synchronisée, aucune surprise.
- **P6 — vérifié, non-risque** `[VÉRIFIÉ]` : une rafale (RC/RL, `bullet_count > 1`) n'appelle
  `resolveTargetHit` **qu'une seule fois** par action d'assaut — `bullet_count` n'influence que le
  bonus de Test/dégâts (`fireModeComp`, ligne 1445) et la décrémentation munitions (ligne 1489),
  jamais une boucle de résolution par balle. `aimed_location` s'applique donc uniformément, quel que
  soit le mode de tir — pas de risque de "N zones différentes pour N balles" à gérer.
- **P7 — jugement à trancher, pas une correction** : en cas d'interception LOS (`checkCombatLOS`,
  le tir est redirigé vers un token différent de la cible initialement déclarée), `forcedSlotCode`
  s'appliquera à la nouvelle cible, pas à la cible visée à l'origine — la zone reste "forcée" même si
  la cible change. Comportement par défaut proposé : **conservé tel quel** (le tireur visait cette
  trajectoire précise, pas ce personnage précis — cohérent avec l'esprit de l'interception, qui
  redirige déjà tout le reste du jet sans distinction). Signalé explicitement plutôt que tranché en
  silence — à confirmer avec Saar si le comportement en jeu semble contre-intuitif après un premier
  test.

---

## 7. Hors scope (rappel)

- **Corps-à-corps** (`resolveMeleeAction`) — fenêtre différente, pas dans le ticket `COM9` original.
- **Drones tireurs** (`resolveDroneAssaultAction`) — non listé dans les modificateurs standard drone
  (`MANUELSYSCOMBAT.md` §7.3).
- **4ᵉ palier LdB** (zone très spécifique, épaule/ventre/main/genou, -7 à -10) — non modélisable sans
  étendre le système de blessures à 6 zones ; discrétion MJ.
- **"Changer le mode de tir"** — dette distincte (`docs/EN_COURS.md`), non touchée ici.
- **Prévisualisation dans `CombatModifiersWindow.jsx`** — nice-to-have optionnel (§4), pas requis pour
  la clôture de ce chantier (cohérent avec l'absence de prévisualisation de `aim_bonus_comp`
  aujourd'hui).
- **Documentation `MANUELSYSCOMBAT.md`** — nouvelle sous-section §6.x à ajouter à la clôture (le SSOT
  ne couvre pas cette règle aujourd'hui, cf. §0), pas pendant le codage.

---

## 8. Questions ouvertes

Aucune — numéro de migration tranché (`164`, §4).

---

## Historique des révisions

- **2026-07-17 (proposition initiale)** — Ciblage `COM9` confirmé par Saar depuis `docs/EN_COURS.md`
  (dépendance bloquant la validation navigateur du Lot B, `docs/PLAN_ARMES_DSL.md`). Règle LdB relue
  (`REGLESYSCOMBAT.md:1754-1765`), point d'autorité unique identifié (`damageService.resolveTargetHit`).
  Première proposition : ajout dans `CombatModifiersWindow.jsx` (phase RÉSOLUTION uniquement),
  cumul avec Tir visé jugé prudent à vérifier, drones tireurs et corps-à-corps proposés hors scope.
- **2026-07-17 (retour Saar — UI/UX + cumul + phase)** — 4 points : (1) carte de localisation
  cliquable proposée, réutilisant la silhouette de l'onglet MATERIEL — retenu, extraction d'un
  composant partagé. (2) Cumul avec Tir visé : accepté "à tester" après explication (les deux tirent
  en sens opposé sur le même Test, pas un cumul de puissance). (3) Corps-à-corps confirmé hors scope.
  (4) Demande de clarification sur le "4ᵉ palier" (jamais explicité clairement) + relecture demandée
  de `REGLESYSCOMBAT.md`/`MANUELSYSCOMBAT.md` — faite, absence confirmée du second (trou du SSOT).
  Drones tireurs : exclusion proposée (non listés `MANUELSYSCOMBAT.md` §7.3), pas encore confirmée à
  ce stade.
- **2026-07-17 (correction architecture — Saar)** — **Désaccord tranché sur la phase** : Saar corrige
  l'analyse initiale — Tir visé *et* Localisation précise sont tous deux des annonces de phase 1,
  affinées avec les conditions réelles en phase 2 ("on affine le calcul"), exactement le patron déjà
  utilisé pour `aim_bonus_comp`. Vérification du pipeline réel de Tir visé
  (`socketCombatAnnouncement.js`→`combat_actions.aim_bonus_comp`→`socketCombatHelpers.js`) confirmant
  que ce patron est directement réplicable (colonne réelle, pas de coût INI cette fois). 4ᵉ palier
  clarifié par citation directe du texte LdB — décision "simple" de Saar : non géré. Drones tireurs :
  exclusion confirmée. Plan réécrit en conséquence (déclaration dans `AssaultRangedPanel.jsx`, pas
  `CombatModifiersWindow.jsx`), incluant la propagation `combat_pending` nécessaire pour le flux PJ
  différé (angle mort à ne pas reproduire, cf. `dual_wield_bonus_comp` dans le plan v1). Aucun code
  écrit — session de planification pure.
- **2026-07-17 (audit migration)** — `npx knex --knexfile knexfile.cjs migrate:status` exécuté
  directement (174 migrations complétées, 0 en attente, base synchronisée). Erreur de parité
  corrigée en cours de route : la règle pair/impair suit le **développeur**, pas l'outil IA — cette
  session travaillant pour Saar (`dev/Saar`), le numéro doit être **pair** (`164`), pas impair comme
  proposé initialement. Question ouverte fermée.
- **2026-07-17 (analyse critique + recherche externe, demande explicite Saar)** — Recherche menée
  avant de figer le codage (§1bis) : règle LdB validée par comparaison à Pathfinder "Called Shots"
  (même structure à paliers croissants) ; architecture validée par lecture réelle du code Cyberpunk
  RED (`cpr-modifiers.js` via l'API GitLab publique) — patron additif identique au nôtre
  (`aim_bonus_comp`), aucune divergence à corriger, mais aucun précédent externe trouvé pour le
  bypass d'une table de localisation aléatoire spécifiquement (limite honnête documentée). En
  relisant le code réel pendant cette recherche, 3 erreurs trouvées et corrigées dans ce document :
  (1) l'énumération "3 sites à garder" (§2) confondait les sites appelant `resolveTargetHit` et ceux
  émettant une carte `DICE_RESULT` "Localisation" — un seul site réel a besoin de la garde
  (`socketCombatResolution.js`), Piège P2 corrigé en conséquence. (2) Vérifié : une rafale (RC/RL) ne
  boucle pas sur `resolveTargetHit` par balle — aucun risque (nouveau Piège P6). (3) Trouvé et
  documenté sans le trancher en silence : l'interception LOS peut rediriger `forcedSlotCode` vers une
  cible différente de celle visée à l'origine (nouveau Piège P7, comportement par défaut proposé,
  pas imposé). Aucun code écrit — session de relecture critique et de recherche, pas de codage.
- **2026-07-17 (codage)** — Plan implémenté intégralement, dans l'ordre du §5 : `shared/
  armorConstants.js` (`AIMED_LOCATION_MALUS`) ; migration `164_combat_actions_aimed_location.js` ;
  `BodySilhouetteSvg.jsx` (extraction depuis `SilhouettePanel.jsx`, comportement fiche perso
  inchangé) + `AimedLocationPicker.jsx` (nouveau, picker interactif) ; `damageService.resolveTargetHit`
  (`forcedSlotCode`) ; `socketCombatAnnouncement.js`/`socketCombatHelpers.js`/
  `socketCombatResolution.js` (déclaration → malus/breakdown → bypass → propagation `combat_pending`
  → garde `rollLoc !== null`) ; `AssaultRangedPanel.jsx` (section dédiée) ; `CombatActionWindow.jsx` +
  `CombatGmDeclareWindow.jsx` (état, payload, reset — miroir exact du patron `aimTranches`, y compris
  les points de reset propres à chaque fichier). **Testé** : `node --check` (4 fichiers serveur, 0
  erreur) ; ESLint client sur les 6 fichiers touchés + 2 nouveaux (0 nouvelle erreur/warning vs
  baseline `git stash`, vérifié fichier par fichier) ; test réel `resolveTargetHit` (`forcedSlotCode`
  → bypass confirmé, `rollLoc` null, zone forcée correcte ; sans `forcedSlotCode` → 20 tirages
  couvrant les 6 zones, non-régression du hasard) — side-effect-free (`degautsBruts:0` → `severity`
  null → `applyWound` no-op, aucune écriture DB) ; migration `164` appliquée et vérifiée par requête
  SQL directe (colonne réelle + ligne `knex_migrations`) ; cohérence `AIMED_LOCATION_MALUS`/
  `LOCATION_TO_SLOT`/`SLOT_TO_WOUND_LOCATION` vérifiée par round-trip sur les 6 clés (aucun
  mismatch). **Non testé** : parcours navigateur réel (déclarer une visée, confirmer le malus affiché
  au Seuil avant de lancer les dés, vérifier le coup garanti en jeu) — à faire par Saar. Combinaison
  Tir visé + Localisation précise en conditions réelles — couverte par construction (additive, pas de
  garde d'exclusivité) mais pas rejouée manuellement. **Incident signalé en cours de route** : un
  `migrate:down` sans cible lancé pour tester la migration 164 a rollback par erreur la migration
  `166_char_inventory_drop_slot.js` d'un autre agent travaillant en parallèle sur le chantier
  Bouclier (batch le plus récent, pas forcément le mien) — corrigé immédiatement (`migrate:latest`),
  aucune perte de donnée (`down()` de 166 reconstruit `char_inventory.slot` depuis `char_inventory_slots`,
  jamais touchée). Leçon retenue : ne plus utiliser `migrate:down` sans cible explicite en contexte de
  travail concurrent — un test direct de la fonction (comme fait ici) suffit, pas besoin de rollback
  réel. Documentation mise à jour à la clôture : `docs/BUGIDENTIFIE.md` (COM9 clos), `docs/EN_COURS.md`
  (blocage Lot B levé, dette COM9 barrée), `docs/ROADMAP.md` (2 mentions), `docs/MANUELSYSCOMBAT.md`
  (nouvelle sous-section §6.10, comble le trou du SSOT identifié en §0), `docs/VOCABULARY.md`
  (nouvelle entrée "Localisation précise"), `client/public/CHANGELOG.md` (v190, entrée joueur).
- **2026-07-17 (clôture) — ✅ CLOS.** Parcours navigateur rejoué et confirmé fonctionnel par Saar
  ("Fonctionnel."). Mentions "parcours navigateur non testé/en pause" retirées de `BUGIDENTIFIE.md`,
  `EN_COURS.md` et `ROADMAP.md`. Document archivé dans `docs/Old/` (Règle 10) — contenu durable déjà
  transféré dans `MANUELSYSCOMBAT.md` §6.10.
