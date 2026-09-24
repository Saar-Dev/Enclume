# STATUTS_TOKEN — Statuts de token (`token_statuses`), registre unique et cadavre

> Créé 2026-09-24 ; réécrit à la clôture du chantier « Statut Mort » (2026-09-24). Décrit le mécanisme
> transversal « un token porte des statuts » : où ils vivent, qui les pose, ce que chacun implique, ce qu'il
> advient d'un token mort. Les règles Polaris (Choc, Fatigue, Froid…) restent dans leurs documents ; les
> effets d'un statut sur le déroulé d'un combat sont dans `COMBAT.md` / `COMBAT_FLUX.md`. Historique et décisions :
> `docs/Old/PLAN_STATUT_MORT.md` (archivé).

## 1. Deux choses distinctes

- **Les instances** — table `token_statuses` : une ligne = « ce token porte ce statut ». Colonnes :
  `token_id`, `status_code` (texte libre, **aucun CHECK, aucune table catalogue** — vérifié en base),
  `expires_at_turn` (NULL = jamais purgé par `endTurn`), `data` (jsonb, ex. formule d'un danger),
  `applied_by`, `applied_at`. Unicité `(token_id, status_code)`. Les statuts sont **par token**, alors que
  les blessures sont **par fiche** (`char_sheet`) : voir §6 pour la lecture « au niveau du personnage ».
  Toute modification est diffusée par `emitTokenStatusUpdated` (`TOKEN_STATUS_UPDATED`).
- **Le vocabulaire** — `shared/tokenStatusRegistry.js`, **autorité unique** : quels codes existent et
  ce que chacun implique. Ajouter un statut = ajouter une entrée dans ce fichier (+ icône
  `client/public/assets/status/<code>.svg` + clé i18n `status.<code>`), jamais une copie de liste ailleurs.

Pourquoi un registre en code plutôt qu'une table catalogue : un statut porte un *comportement* (bloque
la déclaration, sans défense…) qui est du code — une ligne en base sans code serait un statut sans effet ; les autres
listes qui pilotent du comportement (`environmentalHazardRegistry`, `echeanceTypeRegistry`, `weaponModRegistry`)
sont déjà des registres partagés ; un registre se teste sans base. Évolution possible (statuts créés par le MJ) :
alimenter le registre depuis la base sans changer ses consommateurs.

## 2. Le registre

Forme d'une entrée : `{ code, category, ...drapeaux }` — un drapeau absent vaut `false`.

| Drapeau | Sens | Consommé par |
|---|---|---|
| `category` | catégorie de couleur du badge/panneau (`TOKEN_STATUS_CATEGORY_COLORS`) | `TokenStatusPanel.jsx`, `TokenPresentation.jsx` |
| `manualToggle` | accepté par `TOKEN_STATUS_TOGGLE` (bascule manuelle) | `socketToken.js` |
| `inPanel` | affiché dans la grille du panneau (ordre du registre = ordre d'affichage) | `TokenStatusPanel.jsx` |
| `blocksDeclaration` | le token ne peut plus agir : le moteur de tour le passe avant d'ouvrir sa fenêtre (§5) | `combatTurnEngine.js` (`getDeclarationBlockedTokens`) ; gardes de `socketCombatResolution.js` en filet |
| `defenseless` | la cible ne peut pas se défendre activement (DEF5) | `socketCombatHelpers.js` (`isTargetDefenseless`) |
| `clearedAtCombatEnd` | retiré à la fin du combat | `socketCombatState.js` |
| `gmOnly` | seul le MJ le pose/retire, quelle que soit l'option `players_edit_statuses` | `canEditTokenStatus` → `socketToken.js` (autorité) et `TokenStatusPanel.jsx` (aperçu) |
| `isDeath` | le statut fait du token un cadavre (§6) | `deathStateService.js` |
| `incompatibleWithDeath` | état d'un corps qui fonctionne : interdit sur un cadavre, retiré à la mort (§6) | `statusService.js`, `canEditTokenStatus` |

Les 16 codes (l'ordre est celui du panneau) :

| Code | Libellé | Catégorie | Bascule nue | Bloque | Sans défense | Fin de combat | MJ seul | Interdit sur mort |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| `grappled` | Saisi | entrave | ✔ | | | | | |
| `restrained` | Entravé | entrave | ✔ | | | | | ✔ |
| `off_balance` | Déséquilibré | entrave | ✔ | | | | | ✔ |
| `burning` | Enflammé | dot | formulaire | | | | ✔ | |
| `acid` | Corrodé | dot | formulaire | | | | ✔ | |
| `asphyxia` | Asphyxie | dot | ✔ | | | | | ✔ |
| `decompression` | Décompression | dot | formulaire | | | | ✔ | |
| `electrocuted` | Électrocuté | dot | ✔ | | | | | |
| `stunned` | Étourdi | sens | ✔ | ✔ | ✔ | ✔ | | ✔ |
| `unconscious` | Inconscient | sens | ✔ | ✔ | ✔ | ✔ | | ✔ |
| `blinded` | Aveuglé | sens | ✔ | | ✔ | | | ✔ |
| `evanoui` | Évanoui | sens | (Fatigue) | | | | | ✔ |
| `hypothermia` | Hypothermie | chronique | formulaire | | | | ✔ | ✔ |
| `infected` | Infecté | chronique | ✔ | | | | | |
| `poisoned` | Empoisonné | chronique | ✔ | | | | | |
| `irradiated` | Irradié | chronique | ✔ | | | | | |
| `dead` | Mort | mort | ✔ | ✔ | ✔ | | ✔ | (est `isDeath`) |

Structures dérivées exportées (tableaux, pour `whereIn`) : `MANUAL_TOGGLE_STATUS_CODES`, `PANEL_STATUSES`,
`DECLARATION_BLOCKING_STATUS_CODES`, `DEFENSELESS_STATUS_CODES`, `COMBAT_END_CLEARED_STATUS_CODES`,
`GM_ONLY_STATUS_CODES`, `DEATH_STATUS_CODES`, `DEATH_INCOMPATIBLE_STATUS_CODES`. `findTokenStatus(code)` est
**tolérant** : code inconnu → `undefined`, jamais une erreur. Les dangers environnementaux (`burning`, `acid`,
`decompression`) passent par `exposeToHazard`/`clearHazard` (leur `data` — formule, localisation — ne doit pas être
écrasée par une bascule nue) ; l'hypothermie par le formulaire Froid (la bascule nue reste acceptée du MJ seul, `gmOnly`) ; `evanoui` n'est posé que par la Fatigue.

## 3. Options de campagne

Deux réglages de `campaigns.settings` (`SETTINGS_SCHEMA`, `campaignSettingsService.js` ; case dans la section « Règles
de jeu » de la fenêtre de campagne) :

- **`status_effects_mode`** (« Statuts des tokens ») — `off` (« Désactivé » : ni badges ni menu Statuts),
  `icon_only` (« Visuel seul » : menu et badges, **aucun effet mécanique**), `enforced` (« Appliqué », défaut). Toute
  règle mécanique de ce document (blocage de déclaration, sans défense, cadavre) n'agit **qu'en `enforced`**.
- **`players_edit_statuses`** (« Les joueurs gèrent les statuts de leur token », défaut `true`) — le propriétaire
  non-MJ peut-il poser/retirer les statuts de son token. Désactivé : panneau en lecture seule pour les joueurs.

**Droits** — `canEditTokenStatus(code, { isGm, isOwner, playersEditStatuses, targetIsDead })` est l'**unique**
règle, appelée par le serveur (autorité, `socketToken.js`) et le panneau (aperçu) : code hors registre → refus pour
tous ; MJ → toujours autorisé ; `gmOnly` → MJ seul ; sur un cadavre (`targetIsDead`), un statut
`incompatibleWithDeath` est refusé au joueur ; sinon le propriétaire si `players_edit_statuses` l'autorise. Elle ne dit
rien de la *manière* de poser (bascule nue = `manualToggle`, ou formulaire dédié).

## 4. Qui pose, qui retire

| Acteur | Écrit | Où |
|---|---|---|
| MJ ou propriétaire (bascule) | les statuts `manualToggle` | `socketToken.js` (`TOKEN_STATUS_TOGGLE`) |
| MJ (formulaires du panneau) | dangers (`exposeToHazard`/`clearHazard`, routes REST), froid/hypothermie (`coldExposureService.js`) | `environmentalHazardService.js`, `coldExposureService.js` |
| Choc, Fatigue, froid (automatique) | `stunned` / `unconscious` / `evanoui` | **`applyStunWithDuration`** (`statusService.js`) — unique écrivain automatique de cette famille (exclusion mutuelle) |
| MJ (étourdissement manuel avec durée) | idem | `COMBAT_APPLY_STUN` → `applyStunWithDuration(…, { gmOverride: true })` |
| Mods d'arme, `iem_survival` | statuts propres (voir §8) | `applyModStatus` |
| Purge | statuts expirés (`expires_at_turn ≤ tour`) à `endTurn` ; statuts `clearedAtCombatEnd` à la fin du combat ; **tous** les statuts à `/heal` (résurrection voulue) | `combatTurnEngine.js`, `socketCombatState.js`, `woundService.js` |

## 5. Blocage proactif : « ce token peut-il agir ? »

La question se décide là où le moteur **choisit** le prochain acteur, pas après l'ouverture de la fenêtre. Autorité
unique : `getDeclarationBlockedTokens(campaignId, tokenIds, settings)` (`combatTurnEngine.js`) → `Map(tokenId → code)` =
statuts `blocksDeclaration` du registre + étourdissement en attente (`combat_pending` `stun`, D6 de durée pas encore
lancé), **uniquement** en `enforced`. Deux points d'application :

1. **ANNONCE** — `advanceAnnouncementQueue` passe le token bloqué par `skipPlayer` (action `skip`, « X a été
   passé »), avant tout test de Surprise ; filet : si `skipPlayer` échoue (il avale ses erreurs), le slot est présenté
   normalement — jamais une file figée en silence.
2. **RÉSOLUTION** — `advanceTimeline` clôt le pas du token par `forfeitToken` sans `SLOT_ACTIVE`, **avant** la
   branche des entrées autonomes (un drone « mort » ne tire pas) et aussi pour le tour obligatoire d'un
   retardataire ; « X a été passé » n'est émis que s'il n'a pas déjà été passé à l'annonce ce Tour.

**Garde-fou anti-boucle** : on ne passe automatiquement que s'il reste au moins un acteur non bloqué (fonction pure
`hasActionableToken` ; les drones à action `drone_auto` de ce Tour n'en sont pas). Si TOUS sont bloqués, comportement
historique (fenêtre + garde réactive), sinon `endTurn → annonce → résolution → endTurn` tournerait sans fin. Toute
erreur de lecture → le token n'est pas passé (fenêtre normale). Les deux gardes des handlers (`socketCombatResolution.js`,
PRECHECK/CONFIRM — STUN2) restent en **filet** (statut posé entre le choix du pas et le clic) et appellent la même
fonction ; un statut posé EN COURS de Tour prend effet au prochain pas de ce token. `stunned` et `unconscious`
bénéficient du même comportement que `dead`. `combat_roster.status` `active`/`done` reste inutilisé (aucun code ne
pose `done`).

## 6. Le cadavre (statut `dead`)

`dead` : `gmOnly`, `blocksDeclaration`, `defenseless`, `isDeath`, sans expiration, **jamais** `clearedAtCombatEnd` —
seul le MJ le pose ou le retire (bascule ou `/heal`). Pour l'instant posé à la main ; la blessure « Mort » du compteur
(`PLAN_BLESSURE_SIXIEME_LIGNE.md`, Lot 2) le posera. **Règle de Saar : le cadavre reste là et prend des blessures**
(des technologies de résurrection existent) — il reste une cible (aucun filtrage des zones d'effet) mais ne peut **ni
esquiver ni dépenser de Chance**.

**Lecture au niveau du personnage** — `deathStateService.js` (module feuille) : `isCharacterDead(db, campaignId,
characterId)` = un token du personnage porte un statut `isDeath` ; `isTokenDead` part d'un token. Uniquement en
`enforced`. Même lecture que `/heal` (la Chance vit sur la fiche, le statut sur le token).

Conséquences (toutes en `enforced`) :

1. **Pas de fenêtre de Chance** — `resolveChanceRecipientCharacterId(db, campaignId, characterId, type)`
   (`exoPilotService.js`, feuille) renvoie `null` (même contrat que le drone : l'appelant n'ouvre aucune fenêtre) ;
   exo-armure : l'exo OU son pilote mort. Sites couverts : esquive de zone (`socketCombatAoe.js`), réduction de
   gravité (`woundService.js`), Catastrophe de défense au contact (`socketCombatHelpers.js`). Non couvertes (un mort
   n'agit plus) : les Chances de l'ACTEUR (test d'attaque, manœuvre d'exo, interaction d'entité).
2. **Statuts interdits** (`incompatibleWithDeath`, 8) : Entravé, Déséquilibré, Étourdi, Inconscient, Asphyxie, Aveuglé,
   Hypothermie, Évanoui — états d'un corps qui fonctionne. **Autorisés** : Enflammé, Corrodé, Irradié, Saisi,
   Électrocuté, Infecté, Empoisonné, Décompression — processus qui agissent sur un corps, ou saisie ; un mort qui porte un
   danger en subit encore les ticks (voulu).
3. **Barrière automatique** — `applyStunWithDuration` refuse sur un cadavre, sans rien écrire ni effacer.
4. **Choc coupé** — `resolveTargetHit` (`damageService.js`, **seul** site de tirage du test de Choc) ne lance ni test de
   Choc ni D6 de durée pour un cadavre : la blessure est appliquée, `shockResult` reste `null`, donc aucun des 7 appels
   `applyStun` en aval n'est atteint.
5. **Purge à la mort** — `applyDeathConsequences(io, db, campaignId, characterId)` (`statusService.js`) retire les
   états interdits de TOUS les tokens du personnage et l'étourdissement en attente (`combat_pending`) ; appelée par la
   bascule `dead` de `socketToken.js` (et par le Lot 2 pour la blessure « Mort »). Ne retire jamais un état compatible.
6. **Droits** — un joueur ne pose pas un état interdit sur son token mort (`canEditTokenStatus`, `targetIsDead`).

**Le MJ reste libre** : bascule manuelle, formulaires danger/froid et `COMBAT_APPLY_STUN` (`gmOverride`) ne sont jamais
refusés. Il peut donc reposer à la main ce qu'il veut après la purge.

## 7. Invariants

1. Une propriété de statut se lit dans le registre, **jamais** par un littéral `'stunned'`/`'unconscious'`/`'dead'`
   comparé ailleurs (leçon FoundryVTT #9245 : la chaîne en dur casse dès qu'un code est renommé).
2. Les dangers environnementaux ne sont **pas** `manualToggle` (une bascule nue écraserait leur `data`).
3. `expires_at_turn` NULL = jamais purgé par `endTurn` ; un statut qui ne doit pas disparaître seul (`dead`) ne porte
   pas d'expiration et n'est pas `clearedAtCombatEnd`.
4. Les droits de pose passent TOUJOURS par `canEditTokenStatus` — jamais une comparaison `isGm`/`isOwner` recopiée dans
   un handler ou un composant.
5. « Peut-il agir ? » se lit dans `getDeclarationBlockedTokens` ; « est-il un cadavre ? » dans `deathStateService.js` ;
   « à qui ouvrir une fenêtre de Chance ? » dans `resolveChanceRecipientCharacterId` — jamais recopiés (ni requête
   `token_statuses` ni test de statut ajoutés dans un handler pour décider d'un blocage).
6. Une écriture **automatique** de la famille étourdi/inconscient/évanoui passe par `applyStunWithDuration` (barrière
   du cadavre) ; seul le chemin manuel du MJ passe `gmOverride`.
7. Le test `shared/tokenStatusRegistry.test.mjs` fige (instantané historique) les ensembles dérivés : un nouveau statut
   modifie ces attentes **dans le diff qui l'ajoute**, jamais en silence ; il exige aussi icône SVG et clé
   `status.<code>` pour tout statut affiché au panneau ou bloquant.

## 8. Hors registre et limites connues

- **Hors registre** (posés par leur propriétaire, sans entrée ici ni icône/i18n) : `iem_survival`
  (`iemSurvivalService.js`), `ati_offensive`/`ati_defensive` (`weaponModRegistry.js` `statusCodes`). Le registre les
  tolère ; les y intégrer est un chantier ultérieur. Ensembles à sémantique propre volontairement **non** dérivés :
  événement d'expiration d'étourdissement (`combatTurnEngine.js`), exclusion mutuelle `stunned`/`unconscious`/
  `evanoui` (`statusService.js`), garde d'annonce `stunned` seul (`socketCombatAnnouncement.js`).
- **Limites** (suivies en tickets) : `evanoui` sans clé i18n ni entrée de panneau ; `TokenStatusBadges` n'affiche que 3
  badges au-delà de 4 statuts (un `dead` tardif peut ne pas se voir) ; le message de refus dit « vous êtes mort/
  étourdi/inconscient » même quand le MJ déclare pour un PNJ ; un choix d'étourdissement déjà ouvert chez un joueur à
  la mort reste affiché (sa confirmation est ignorée) ; un combat composé uniquement de drones en `ordres_permanents`
  boucle (préexistant) ; parité pour l'exo piloté : les statuts sont lus sur le token de l'exo, pas sur le pilote.

Documents associés : `docs/Old/PLAN_STATUT_MORT.md` (historique) ; `docs/PLANS/PLAN_BLESSURE_SIXIEME_LIGNE.md` (Lots
2-4 : la 6ᵉ ligne du compteur) ; `MODING.md` (statuts de mods) ; `INFORMATIQUE.md` (`iem_survival`) ;
`COMBAT_FLUX.md` (gardes STUN2/DEF5, file d'annonce) ; `BLESSURES.md` (compteur de blessures).
