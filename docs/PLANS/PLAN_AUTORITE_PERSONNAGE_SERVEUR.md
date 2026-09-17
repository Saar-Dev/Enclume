# PLAN_AUTORITE_PERSONNAGE_SERVEUR.md — Unifier « qui peut agir au nom d'un personnage » côté serveur

> **Stub — 2026-09-17.** Chantier identifié en corrigeant le bug MJ/`ENTITY_MOVE_REQUEST` (Lot A2,
> `docs/PLANS/PLAN_ENTITES_INTERACTIVES_ROADMAP.md`). Cadrage détaillé **non commencé** — ce document
> capture le déclencheur et l'inventaire brut des sites concernés, pour que la conversation de
> cadrage dédiée démarre avec un ancrage.
>
> **Autorité** : pur outillage serveur (aucune règle Polaris) → `.claude/rules/core.md`,
> `.claude/rules/combat.md`, `.claude/rules/entities.md`.

---

## 1. Déclencheur (2026-09-17)

En testant l'interaction « Déplacer » (Lot A2), un MJ sans PJ propriétaire ne pouvait jamais agir via
le token d'un PNJ — `ENTITY_MOVE_REQUEST` (`socketEntity.js`) vérifiait l'ownership avec
`character.user_id !== user.id`, **sans aucun repli MJ**, alors que ce repli existe déjà, sous forme
différente, dans au moins 8 autres endroits du serveur. Correctif immédiat posé : `canActAsCharacter()`
extraite dans `server/src/lib/socketUtils.js`, reprenant le patron déjà éprouvé de
`COMBAT_INIT_STATE` (MJ autorisé seulement sur un PNJ, jamais un PJ ni un drone), câblée uniquement
sur `ENTITY_MOVE_REQUEST`. Ce document ouvre la question plus large : cette règle métier (« qui peut
agir au nom de ce personnage ») n'a pas d'autorité unique côté serveur.

## 2. État connu `[VÉRIFIÉ code, 2026-09-17 — grep, pas une lecture ligne à ligne de chaque site]`

Au moins **trois philosophies de contournement MJ coexistent**, sans qu'on sache si les différences
sont des choix délibérés (selon la nature de l'action) ou une dérive de copier-coller :

- **MJ illimité** (agit sur n'importe quel personnage/token, PJ compris) : `checkTokenOwnership`
  (`socketUtils.js`, manipulation brute de token) et ses appelants `socketToken.js` (4 sites) ;
  `socketDice.js` (3 sites, même patron `!isOwner && !isGm`) ; `socketConnector.js:80` (à confirmer,
  `isGm` semble déjà géré en amont ligne 51) ; `socketChance.js:20` (`isGm` bypass un bloc entier).
- **MJ restreint aux PNJ** (jamais PJ, jamais drone) : `socketCombatState.js:419-423`
  (`COMBAT_INIT_STATE`, le patron copié pour le correctif d'aujourd'hui) ; à vérifier si
  `socketCombatState.js:464` suit la même règle ou n'a aucun repli MJ (gap potentiel non confirmé).
- **Pas de repli MJ du tout** (bug latent potentiel, à confirmer un par un) :
  `socketCombatAnnouncement.js:159` et `:1039` ; `socketCombatResolution.js:316` ; `socketEntity.js:205`
  (`ENTITY_ACTION_REQUEST` — **pas un bug aujourd'hui** car le client aiguille déjà le MJ vers
  `ENTITY_ACTION_GM_DIRECT`, un événement séparé sans personnage engagé — mais l'absence de repli reste
  structurellement identique aux autres cas, à trancher si ce site évolue).
- **Repli conditionné à `isGm` déjà géré en amont** (pas forcément un vrai 4e patron, à vérifier) :
  `socketCombatResolution.js:679`, `:706` (`!isGm && character.user_id !== user.id`).

Aucun de ces sites n'a été relu intégralement pour ce stub — seul un grep ciblé sur le motif
`character.user_id !== user.id` / `isOwner && isGm` a été fait. Le cadrage devra lire chaque site en
contexte avant de conclure quoi que ce soit.

## 3. Ce que le cadrage devra faire

- **Lire chaque site en entier**, pas seulement la ligne d'ownership — déterminer la nature réelle de
  l'action (manipulation brute vs conséquence de règle du jeu avec test/jet) pour savoir quelle
  philosophie s'applique légitimement, plutôt que de supposer qu'une seule règle doit toutes les
  remplacer.
- **Distinguer explicitement 3 catégories cibles**, probablement irréductibles à une seule fonction :
  1. Manipulation brute d'un token (position, rotation) → MJ illimité, `checkTokenOwnership` reste
     l'autorité.
  2. Conséquence de règle du jeu déclenchée « au nom » d'un personnage (test, jet, dégâts) → MJ
     restreint aux PNJ, `canActAsCharacter` — candidat pour remplacer les sites de la catégorie
     « pas de repli MJ » si l'audit confirme qu'ils devraient en avoir un.
  3. Action MJ directe sans personnage engagé (`ENTITY_ACTION_GM_DIRECT`) → hors périmètre de ce
     chantier, déjà correcte par construction.
- **Vérifier un par un** les 4 sites classés « pas de repli MJ du tout » ci-dessus : bug latent réel
  (MJ bloqué comme il l'était sur `ENTITY_MOVE_REQUEST`) ou absence de repli intentionnelle (le MJ n'a
  simplement jamais besoin d'émettre cet événement) ?
- **Décision à trancher au cadrage** : migrer les sites confirmés vers `canActAsCharacter`
  immédiatement, ou seulement documenter/couvrir de tests si le comportement actuel est correct ?
  Risque : toucher du code combat déjà stabilisé et validé en jeu réel — chaque migration exige son
  propre scénario de test, pas un renommage groupé.

## 4. Hors périmètre de ce document

Aucune implémentation ici au-delà du correctif déjà posé sur `ENTITY_MOVE_REQUEST`. Ce stub ferme la
boucle de traçabilité sans présumer des choix du cadrage détaillé à venir.
