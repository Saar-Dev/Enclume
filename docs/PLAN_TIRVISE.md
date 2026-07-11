# PLAN_TIRVISE.md — Action "Tir visé" + framework Actions Exclusives
> Rédaction initiale — 2026-07-10. Session de planification pure, aucun code écrit.
> Suite d'une discussion directe avec Saar (pas de questionnaire structuré) + recherche externe.

---

## Objectif

Implémenter l'action **Tir visé** (LdB p.227-228), actuellement absente du code (confirmé absent de
`MANUELSYSCOMBAT.md`, `docs/REGLES/REGLESYSCOMBAT.md` transcrit mais jamais câblé, et de tout le code
serveur/client). Au passage, construire un **framework générique "Action exclusive"** — décision de
Saar, motivée par le fait que Charge et Rafale longue ont été mal implémentées à l'origine (lecture
incomplète de la règle : leurs bonus existent, mais rien n'empêche aujourd'hui de les cumuler avec une
autre attaque le même tour) et que Tir de suppression en aura besoin quand il sera construit.

**Portée de ce plan** : le framework générique (Step 1) + l'action Tir visé qui l'utilise (Step 2).
**Hors scope explicite** (voir section dédiée) : câbler Charge/Rafale longue sur ce framework
(chacun sa session dédiée — un seul sujet à la fois), construire Tir de suppression (fonctionnalité
complète absente, pas juste un flag d'exclusivité), Tir de précision/snipers (pas de règle fixe dans
le LdB), corriger `dual_wield_bonus_comp` jamais relu en résolution (bug trouvé en chemin, signalé,
agent dédié déjà lancé dessus par Saar).

---

## Recherche préalable (2026-07-10) — pourquoi cette architecture

Demande explicite de Saar : ne pas coder de zéro, s'appuyer sur les bonnes pratiques et l'expérience
de projets pro avant de figer l'architecture.

- **Bob Nystrom (*Game Programming Patterns*), [*A Turn-Based Game Loop*](https://journal.stuffwithstuff.com/2014/07/15/a-turn-based-game-loop/)** :
  la légalité d'une action doit être encapsulée **dans la définition de l'action elle-même**, pas
  dispersée dans le moteur/UI — *"game mechanics belong in the engine. In particular, most of them
  belong in actions"*, *"keep all of the code for a single mechanic, including validation, in one
  place"*. Traduit chez nous : une fonction pure qui sait dire si une déclaration est "exclusive",
  pas un `if` de plus éparpillé dans `socketCombatAnnouncement.js`.
- **Pathfinder 2e (Foundry VTT)**, trait **["Flourish"](https://2e.aonprd.com/Traits.aspx?ID=606&Redirected=1)** :
  *"one action with the flourish trait per turn"* — exactement notre mécanique (Charge/Tir
  visé/Rafale longue/Tir de suppression = actions "Flourish" du LdB Polaris). Confirme qu'un
  tag/trait simple est la solution standard de l'industrie pour ce problème précis, pas un moteur
  de règles.
- **Mais** : PF2e a en réalité un moteur bien plus lourd derrière ses traits (["Rule
  Elements"](https://github.com/foundryvtt/pf2e/wiki/Quickstart-guide-for-rule-elements), JSON
  déclaratif attaché aux objets) — vérifié *pourquoi* : *"Rule elements... do not require hard
  coding into the actual system code"*, **spécifiquement pour supporter du contenu
  homebrew/communautaire non-développeur**. Ce n'est pas notre cas : nos actions exclusives sont un
  ensemble **fixe et fermé** (4-5 actions du LdB, jamais authored par un joueur). Reproduire un
  moteur de règles ici résoudrait un problème qu'on n'a pas — confirme, avec une source externe
  cette fois (pas seulement la décision interne déjà prise sur `json-rules-engine` pour
  l'éligibilité carrières), qu'un registre léger est le bon dimensionnement.
- **Conséquence directe** : évaluateur pur dans `shared/`, pattern déjà éprouvé du projet
  (`shared/careerEligibility.js`) — une seule source de vérité, importée identique côté client
  (retour UI immédiat) et côté serveur (rejet autoritaire), pas un nouveau paradigme.

---

## Règle LdB (source de vérité — `docs/REGLES/REGLESYSCOMBAT.md:1487-1492, 1580, 1554-1565`)

**Tir visé (action exclusive)** :
- Le personnage prend le temps d'ajuster son tir, au détriment de son Initiative.
- **Une seule balle**, doit être **immobile**.
- Principe des "Actions retardées" : pour chaque tranche de **2 points d'Initiative sacrifiés**, le
  personnage gagne **+1 au Test de tir** (bonus maximum **+5**, donc jusqu'à **10 INI sacrifiés**).
- **Impossible à deux armes** ("Tirer avec deux armes", note p.228).

**Hors scope (confirmé avec Saar) :**
- **Tir de précision (snipers, p.228)** : *"le tir de précision échappe en fait aux règles
  habituelles... Le MJ est seul juge"* — pas de formule fixe, non mécanisable proprement.
- **"Viser avec une arme automatique" (optionnel, p.228)** : le LdB permet au MJ d'étendre Tir visé
  aux RC/RL, mais ce n'est pas la règle de base. Saar confirme : RC/RL ont déjà leur propre mécanique
  de précision (plus de balles ⇒ bonus croissant, `FIRE_MODE_VARIANTS`), pas besoin d'y ajouter Tir
  visé — resterait limité au tir simple (coup par coup, 1 balle).

---

## Architecture actuelle (vérifiée par lecture de code, pas de mémoire)

### Le Seuil d'assaut à distance (`server/src/socket/socketCombatHelpers.js:1238-1360`, `resolveAssaultAction`)

```js
totalModComp    = porteeModComp + situationModComp + tailleModComp + isRushedMod + fireModeComp
chancesDeReussite = skillTotal + totalModComp + effectiveMalus - carenceArmure + coverageModifier
```

`fireModeComp = action.fire_mode_bonus_comp ?? 0` (ligne 1336) — colonne réelle sur `combat_actions`,
**relue** en résolution. C'est le point d'accroche pour le bonus de Tir visé : un terme de plus dans
`totalModComp`, même famille que `fireModeComp`.

### Le coût INI — jamais confiance au client (`server/src/socket/socketCombatAnnouncement.js:174-204`)

Une matrice `STATE_COSTS` miroir de `STATE_DEFS` (`client/src/components/combatSections.js`)
recalcule `iniDelta` côté serveur pour toute transition d'état + chaque `mapAction` (move/melee/
cover_shot/quick actions). **Aucune valeur de coût n'est jamais prise telle quelle depuis le client.**
Tir visé doit suivre exactement ce principe pour son coût variable (2/4/6/8/10 selon tranches
choisies par le joueur).

### Aucune notion d'"action exclusive" nulle part (vérifié, grep vide sur `EXCLUSIVE`/`exclusive`)

- **Charge** : bonus déjà implémentés — `attackModeBonus +3` (ligne 433), `combatModeBonus +3
  dégâts` (ligne 434), pénalité défense `-7` (lignes 628, 656), garde de distance `>3m` (lignes
  427-428). **Seule l'exclusivité manque** — rien n'empêche aujourd'hui de charger ET de tirer à
  distance le même tour.
- **Rafale longue** : bonus déjà implémentés via `FIRE_MODE_VARIANTS.RL` (`combatSections.js`,
  bonusComp/bonusDmg par palier de 5 balles). **Seule l'exclusivité manque**, même constat.
- **Tir de suppression** : introuvable dans tout le code (`server/src` et `client/src` grepés) —
  aucune UI, aucun mécanisme de zone, aucun Test de Chance. Pas juste un flag manquant : la
  fonctionnalité entière est absente (ciblage de zone, LdB p.228) — chantier séparé, hors scope ici.
- `MAP_ACTIONS.multi` ("Attaque multiple") est **désactivé côté UI** (`active: false`,
  `combatSections.js:125`) — aujourd'hui un seul `mapActions.attack` possible par déclaration, donc
  la seule combinaison réelle à bloquer pour Tir visé est **attaque distance + CaC** (`mapActions.
  melee`). Le garde générique doit rester extensible à une 2ᵉ attaque le jour où le multi-attaque
  sera câblé, sans avoir besoin de le coder maintenant.

### Bug trouvé en chemin, hors scope (agent dédié déjà lancé par Saar)

`dualWieldBonusComp` est stocké dans `modifiers` JSONB à la déclaration
(`socketCombatAnnouncement.js:242`) mais **jamais relu** dans `resolveAssaultAction` — le bonus
double-arme à distance ne s'applique donc jamais en résolution. **Conséquence pour ce plan** : ne pas
reproduire ce même angle mort pour `aim_bonus_comp` — colonne réelle (comme `fire_mode_bonus_comp`),
pas JSONB `modifiers`.

---

## Décisions actées (2026-07-09/10, avec Saar)

1. **Construire le framework "Action exclusive" maintenant** (Step 1), pas seulement un garde ad hoc
   pour Tir visé — motivé par un besoin réel déjà identifié par Saar (Charge/Rafale longue mal
   implémentées à l'origine, Tir de suppression en aura besoin), pas une anticipation spéculative.
2. **Exclusivité ≠ immobilité.** Ce sont deux gardes séparés : "exclusive" (générique) = au maximum
   une seule Attaque déclarée ce tour (bloque la combinaison avec CaC, et plus tard avec une 2ᵉ
   attaque). "Immobile" est une contrainte **propre à Tir visé** — Charge *exige* un déplacement, un
   flag générique "exclusive ⇒ pas de move" casserait Charge le jour où on la corrigera.
3. **RC/RL hors scope** — déjà couverts par leur propre mécanique de précision (`FIRE_MODE_VARIANTS`).
   Tir visé reste limité à `fire_mode === 'cc'` + `bulletCount === 1` (variante `cc_1`, tir simple).
4. **Sniper hors scope** — pas de règle fixe dans le LdB.
5. **Tir visé limité à** : pas de move déclaré, pas de CaC déclaré (⇒ exclusive), pas dual-wield,
   1 balle (tir simple).
6. **Recalcul serveur systématique** du coût INI et du bonus — jamais confiance au client, même
   principe que le reste du syscombat (confirmé, pas une nouveauté à inventer).
7. **Un seul registre, pas trois.** Pas de taxonomie `ACTIONS_EXCLUSIVES`/`ACTIONS_NON_EXCLUSIVES`/
   `ACTIONS_GRATUITES` — un registre d'exclusion unique (tout ce qui n'y figure pas est non-exclusif
   par défaut, pas besoin d'énumérer l'inverse). "Actions gratuites" (LdB p.217, crier un mot, lâcher
   un objet) hors scope : zéro effet mécanique aujourd'hui, rien à construire.
8. **Architecture : évaluateur pur `shared/`**, pas de moteur de règles générique façon PF2e Rule
   Elements (justifié par la recherche ci-dessus — notre ensemble d'actions exclusives est fixe et
   développeur-authored, pas communautaire).

---

## Architecture cible

### `shared/combatExclusiveActions.js` (NOUVEAU) — évaluateur pur, importé identique client + serveur

```js
export const AIM_MAX_TRANCHES = 5        // bonus max +5
export const AIM_INI_PER_TRANCHE = -2    // 2 INI sacrifiés par tranche

// Bonus au Test de tir pour N tranches (clampé 0-5)
export function getAimBonusComp(aimTranches) {
  return Math.max(0, Math.min(AIM_MAX_TRANCHES, Math.floor(aimTranches ?? 0)))
}

// Coût INI correspondant (toujours négatif ou nul)
export function getAimIniCost(aimTranches) {
  return getAimBonusComp(aimTranches) * AIM_INI_PER_TRANCHE
}

// Tir visé éligible : "tu ne vises que si tu ne fais que ça" (règle Saar, tranchée 2026-07-10).
// Position, arme, mode de tir, couverture et vitesse sont tous des ÉTATS au même titre (state_*
// sur combat_roster) — dégainer son arme (holstered/ready → drawn) est une transition tout autant
// qu'un déplacement, et "viser ET dégainer" n'est pas cohérent (la préparation de la visée suppose
// une arme déjà en main). Donc : AUCUNE transition d'état ce tour (l'arme doit déjà être `drawn`
// depuis le tour précédent) ET aucune autre mapAction/quick action. Cette règle unique résout
// mécaniquement, sans cas particuliers séparés : immobilité (pas de move), incompatibilité avec
// Précipiter (vitesse doit rester inchangée), incompatibilité avec Rechargement (aucune autre
// mapAction). `entry` = ligne `combat_roster` AVANT cette déclaration (état persisté, jamais le
// payload client) — c'est elle qui fait foi pour "aucun changement".
export function isAimEligible({ mapActions, state, quick, entry, isDualWield, bulletCount }) {
  if (state?.fire_mode !== 'cc') return false
  if (bulletCount !== 1) return false
  if (isDualWield) return false
  if (entry?.state_weapon !== 'drawn') return false          // arme déjà au clair, pas de dégainer ce tour
  if (state?.position !== entry?.state_position) return false
  if (state?.weapon   !== entry?.state_weapon)   return false
  if (state?.cover    !== entry?.state_cover)    return false
  if (state?.vitesse  !== entry?.state_vitesse)  return false // exclut Précipiter de facto
  if (mapActions?.move)     return false
  if (mapActions?.interact) return false
  if (mapActions?.reload)   return false                      // exclut Rechargement de facto
  if (Array.isArray(mapActions?.melee) && mapActions.melee.length > 0) return false
  if ((quick?.observer ?? 0) > 0 || (quick?.reperer ?? 0) > 0 || quick?.phrase) return false
  return true
}

// Déclaration exclusive ? (registre — Charge/Rafale longue/Tir de suppression rejoindront cette
// fonction dans leurs propres sessions dédiées, pas ici). Responsabilité distincte de
// isAimEligible : ici on vérifie la combinaison avec D'AUTRES attaques ce tour (CaC aujourd'hui,
// 2ᵉ/3ᵉ attaque distance le jour où le multi-attaque sera câblé) — pas la légalité intrinsèque de
// l'action elle-même. Pour Tir visé spécifiquement, `isAimEligible` (règle "rien d'autre ce tour")
// bloque déjà le CaC — le check melee ici est donc redondant en défense-en-profondeur pour Tir visé,
// mais reste la SEULE garde pour les futures actions exclusives dont l'éligibilité sera plus
// permissive (ex. Charge exige un déplacement, ne pourra jamais utiliser la règle stricte
// d'isAimEligible).
export function isExclusiveDeclaration({ mapActions }) {
  if ((mapActions?.attack?.aimTranches ?? 0) > 0) return { exclusive: true, reason: 'tir_vise' }
  return { exclusive: false, reason: null }
}
```

### Migration (NOUVEAU, numéro à reconfirmer — voir Piège P1)

```js
export const up = async (knex) => {
  await knex.schema.alterTable('combat_actions', (table) => {
    table.integer('aim_bonus_comp')   // miroir fire_mode_bonus_comp — nullable, pas de backfill
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('combat_actions', (table) => {
    table.dropColumn('aim_bonus_comp')
  })
}
```
`down()` trivial — colonne nullable pure ajout, aucune donnée existante à préserver (contrairement à
la migration 126 Revers qui restructurait des colonnes existantes).

### `server/src/socket/socketCombatAnnouncement.js` — bloc `mapActions?.attack` (autour de la ligne 230)

- Lire `aimTranches` depuis `mapActions.attack.aimTranches`.
- `entry` (ligne `combat_roster` déjà chargée plus haut dans le handler, ligne 62-64) est passée
  telle quelle à `isAimEligible` — c'est elle qui fait foi pour "aucune transition d'état", jamais
  un état reconstruit depuis le payload client.
- **Ordre de vérification fixé** (les deux gardes ont des responsabilités disjointes depuis la
  correction ci-dessus, mais l'ordre reste déterministe pour un message d'erreur prévisible) :
  1. Si `aimTranches > 0` : valider `isAimEligible({ mapActions, state, quick, entry, isDualWield,
     bulletCount })` en premier (légalité intrinsèque — recalculé serveur, jamais un booléen envoyé
     par le client) — sinon `COMBAT_DECLARE_ERROR` ("Tir visé : aucune autre action ni transition
     d'état ce tour, arme déjà au clair, tir simple, une seule arme requis").
  2. Puis, seulement si (1) passe : garde exclusivité générale `isExclusiveDeclaration(...)` → si
     exclusive et `mapActions.melee?.length > 0`, `COMBAT_DECLARE_ERROR` ("Action exclusive : pas de
     corps à corps ce tour"). **Doit s'exécuter avant l'insertion des `actionRows`** (Piège P3).
     Redondant avec (1) pour Tir visé (voir note dans le code ci-dessus), conservé pour la future
     extensibilité (Charge/Rafale longue).
- `aimBonusComp = getAimBonusComp(aimTranches)`, ajouté à `iniDelta` via `getAimIniCost(aimTranches)`.
- Stocké sur la ligne `combat_actions` (assault) : `aim_bonus_comp: aimBonusComp || null`.

### `server/src/socket/socketCombatHelpers.js` — `resolveAssaultAction` (autour de la ligne 1336)

```js
const aimBonusComp = action.aim_bonus_comp ?? 0
const totalModComp = porteeModComp + situationModComp + tailleModComp + isRushedMod + fireModeComp + aimBonusComp
```
+ ligne `breakdown` : `{ label: 'Tir visé', value: aimBonusComp, type: 'bonus' }` si non nul.

### Client — `combatSections.js`

- Ré-exporte (ou importe directement) `isAimEligible`/`isExclusiveDeclaration`/`getAimBonusComp`/
  `getAimIniCost` depuis `shared/combatExclusiveActions.js` — pas de duplication de la règle.
- `calcIniBreakdown` : ligne "Tir visé" informative si `aimTranches > 0` (pattern déjà utilisé pour
  `observer`/`reperer`).

### Client — `CombatActionWindow.jsx`

- Nouveau contrôle stepper (0 à `AIM_MAX_TRANCHES`), pattern `QUICK_ACTIONS` incrémental — visible
  seulement si `attackSelected && isAimEligible(...)` avec l'état courant. `entry` côté client =
  `initialStates.current` (objet déjà présent, ligne ~151, qui capture l'état `combat_roster` au
  début de la déclaration — même rôle que `entry` côté serveur, une seule vérité pour les deux).
- Retour visuel croisé immédiat (même évaluateur `shared/` réutilisé) : dès que `aimTranches > 0`,
  griser tout changement d'état (position/arme/couverture/vitesse), le déplacement, le CaC, le
  rechargement et les actions rapides ; à l'inverse, dès qu'un de ces éléments est modifié, griser
  le stepper Tir visé. Pas d'attente d'un aller-retour serveur pour ce feedback (même confort UX que
  `careerEligibility.js` côté Wizard).
- Payload envoyé : `mapActions.attack.aimTranches`.

### i18n (`fr.json`, namespace combat)

Nouvelles clés : label du stepper, tooltip (texte de règle résumé), message d'erreur exclusivité.

---

## Priorités d'implémentation

| Étape | Contenu | Dépendance |
|---|---|---|
| 0 | `shared/combatExclusiveActions.js` — évaluateur pur (`isExclusiveDeclaration`, `isAimEligible`, `getAimBonusComp`, `getAimIniCost`) | — |
| 1 | Migration — `combat_actions.aim_bonus_comp` | — |
| 2 | `socketCombatAnnouncement.js` — validation `aimTranches` + garde exclusivité (melee) + `iniDelta` + insert `aim_bonus_comp` | Étapes 0+1 |
| 3 | `resolveAssaultAction` (`socketCombatHelpers.js`) — lecture `aim_bonus_comp`, ajout au Seuil + breakdown | Étape 2 |
| 4 | `combatSections.js` — réexport évaluateur + `calcIniBreakdown` (affichage informatif) | Étape 0 |
| 5 | `CombatActionWindow.jsx` — stepper UI + désactivation croisée move/melee | Étapes 0+4 |
| 6 | i18n `fr.json` | Étape 5 |

---

## Pièges à anticiper

- **P1** : numéro de migration à reconfirmer via `ls server/src/db/migrations/` au moment de coder,
  pas depuis ce plan — **126** déjà pris (chantier Revers en cours, voir `EN_COURS.md`). Prochain
  numéro probable au 2026-07-10 : **127**, à revérifier (P53 — nodemon peut avoir fait avancer la
  numérotation entre-temps).
- **P2** : ne jamais faire confiance à `aimTranches` envoyé par le client pour le bonus final —
  toujours revalider `Number.isInteger` + clamp 0-5 côté serveur avant tout calcul.
- **P3** : la garde exclusivité (rejet si CaC + Tir visé combinés) doit s'exécuter **avant**
  l'insertion des `actionRows` — sinon une ligne `melee` et une ligne `assault` Tir visé pourraient
  coexister en base malgré le rejet.
- **P4** : ne **pas** coder les déclencheurs Charge/Rafale longue/Tir de suppression dans
  `isExclusiveDeclaration` dans ce chantier — décision Saar de scope, chacun sa session dédiée
  (leurs bonus mécaniques existent déjà, seule l'entrée dans le registre manquera, une ligne
  chacun le moment venu).
- **P5** : `dual_wield_bonus_comp` jamais relu en résolution est un bug pré-existant, agent dédié en
  cours ailleurs — ne pas y toucher ici. Vérifier simplement que `aim_bonus_comp` (colonne réelle,
  pas JSONB) n'a pas le même angle mort une fois codé.
- **P6** : `bulletCount === 1` doit être vérifié sur la variante **effective** issue de
  `computeFireVariant` (`combatSections.js`), pas en supposant un défaut implicite. **Vérifié** :
  `CombatActionWindow.jsx:336` passe déjà `{ defaultCcCount: 1 }`, donc un tir simple standard
  envoie bien `bulletCount: 1` (pas `null`) — le scénario de confusion initialement redouté ne se
  produit pas dans le cas par défaut. Le principe (revalider la variante effective côté serveur,
  jamais confiance au champ brut) reste la bonne pratique de défense en profondeur, appliquée dans
  tous les cas.
- **P7 (trouvé en analyse critique, non corrigé ici)** : Tir visé peut sacrifier jusqu'à **10 INI**
  en un coup — plus qu'aucune Préparation existante aujourd'hui. Le LdB (`REGLESYSCOMBAT.md:354-357`)
  prévoit explicitement ce cas : *"si une Préparation réduit l'Initiative du personnage à 0 ou moins,
  l'Action... est reportée au Tour suivant"*. `MANUELSYSCOMBAT.md` §3 documente déjà ce gap comme
  **non implémenté côté serveur**, pour toute action confondue — Tir visé ne fait qu'augmenter la
  probabilité de le déclencher, il n'en est pas la cause. **Comportement actuel si `initiative`
  tombe ≤ 0 via Tir visé : `[INCONNU]`, non instrumenté.** Hors scope de corriger ce gap systémique
  dans ce chantier (règle "un sujet à la fois"), mais à signaler explicitement à Saar avant le
  codage — voir "Questions ouvertes" ci-dessous.

---

## Décisions actées (2026-07-10, suite analyse critique)

9. **Règle unifiée "tu ne vises que si tu ne fais que ça"** (tranche les points 1-3 de l'analyse
   critique d'un coup, pas trois règles séparées) : Tir visé exige **zéro transition d'état** ce
   tour (position/arme/couverture/vitesse doivent rester identiques à `combat_roster` avant la
   déclaration, arme déjà `drawn`) **et zéro autre mapAction/quick action**. Dégainer son arme est
   une transition au même titre qu'un déplacement — "viser ET dégainer" n'est pas cohérent
   (Saar). Résout mécaniquement, sans code séparé : immobilité (déplacement = transition interdite),
   incompatibilité avec Précipiter (vitesse doit rester inchangée), incompatibilité avec
   Rechargement (aucune autre mapAction autorisée).
10. **Gap INI ≤ 0** — documenté comme dette séparée **`docs/BUGIDENTIFIE.md` — Dette INI3** (cluster
    H), en plus du Piège P7 ci-dessous dans ce plan. Pas de correctif dans ce chantier ; investigation
    à programmer avant ou en parallèle du codage de Tir visé (à décider par Saar au moment de
    planifier l'étape 2).

---

## Hors scope (rappel, à planifier séparément)

- **Tir de précision (snipers)** — pas de règle fixe dans le LdB, "le MJ est seul juge".
- **Viser avec arme automatique (RC/RL)** — option non retenue, les bonus de rafale existants
  couvrent déjà l'augmentation de précision.
- **Charge / Rafale longue** — leurs bonus mécaniques sont déjà implémentés ; seule leur entrée dans
  `isExclusiveDeclaration` manquera, à ajouter lors de **leurs propres sessions dédiées** (règle "un
  sujet à la fois") — pas une refonte du framework, juste peupler le registre.
- **Tir de suppression** — fonctionnalité complète absente (ciblage de zone, Test de Chance par
  cible dans la zone) — chantier à part entière, pas juste un flag d'exclusivité.
- **Fix `dual_wield_bonus_comp` jamais relu** — bug trouvé en chemin, agent dédié déjà lancé par
  Saar sur ce sujet, non touché ici.
- **Framework "Actions gratuites"** — zéro effet mécanique aujourd'hui (LdB p.217 : crier un mot,
  lâcher un objet), rien à construire tant qu'aucun besoin mécanique ne se présente.

---

## Historique des révisions

- **2026-07-10** — rédaction initiale à partir d'une discussion directe avec Saar (pas de
  questionnaire structuré) : règle LdB relue (`docs/REGLES/REGLESYSCOMBAT.md`), architecture actuelle
  du Seuil d'assaut et du recalcul INI serveur vérifiée par lecture de code, absence totale
  d'exclusivité confirmée (Charge/Rafale longue ont leurs bonus mais pas le garde-fou, Tir de
  suppression totalement absent), bug `dual_wield_bonus_comp` trouvé et signalé (hors scope, agent
  dédié). Recherche externe (Nystrom, PF2e "Flourish"/"Rule Elements") ayant confirmé le
  dimensionnement (évaluateur `shared/` léger, pas de moteur de règles générique). Décisions actées :
  framework générique construit maintenant mais peuplé pour Tir visé seul, exclusivité et immobilité
  gardées séparées, RC/RL et sniper hors scope, registre unique (pas de triptyque
  exclusives/non-exclusives/gratuites). Aucun code écrit — session de planification pure.
- **2026-07-10 (analyse critique)** — 7 points trouvés en auto-critique du plan initial, corrigés
  ou documentés : **(1)** `isAimEligible` dupliquait le check CaC déjà couvert par
  `isExclusiveDeclaration` — responsabilités séparées (légalité intrinsèque vs combinaison avec
  d'autres attaques), ordre de vérification serveur fixé explicitement. **(2)** `down()` de la
  migration détaillé (trivial). **(3)** Piège P6 reformulé après vérification réelle
  (`CombatActionWindow.jsx:336`, `defaultCcCount:1` confirme qu'un tir simple envoie bien
  `bulletCount:1`, pas `null` — le risque redouté initialement ne se produit pas dans le cas par
  défaut). **(4)** Nouveau Piège P7 : interaction avec le gap systémique "INI ≤ 0 non implémenté"
  (`MANUELSYSCOMBAT.md` §3) — Tir visé (jusqu'à -10 INI) augmente la probabilité de le déclencher,
  documenté mais non corrigé ici. **(5-7)** 3 questions ouvertes ajoutées (périmètre "immobile" vs
  changement de posture, combinaison avec Précipiter, combinaison avec Rechargement) — marquées
  `[HYPOTHÈSE]` plutôt que tranchées silencieusement. Aucun code écrit.
- **2026-07-10 (réponses de Saar aux questions ouvertes)** — Décision 9 : les 3 questions ouvertes
  (immobile/Précipiter/Rechargement) tranchées par UNE règle unique plutôt que trois réponses
  séparées — "tu ne vises que si tu ne fais que ça" (Saar) : aucune transition d'état (position/
  arme/couverture/vitesse doivent rester identiques à `combat_roster`, arme déjà `drawn`), aucune
  autre mapAction/quick action. `isAimEligible` réécrite en conséquence (gagne `quick`/`entry` en
  paramètres). Décision 10 : le gap INI ≤ 0 devient une dette tracée séparément
  (`docs/BUGIDENTIFIE.md` — Dette INI3, cluster H), en plus du Piège P7 de ce plan — pas de
  correctif ici, investigation à programmer au moment de planifier le codage. Aucun code écrit.
