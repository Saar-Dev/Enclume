# STATUTS_TOKEN — Statuts de token (`token_statuses`) et registre unique

> Créé 2026-09-24, mis à jour 2026-09-24 (Lot 1c : blocage proactif) (chantier `docs/PLANS/PLAN_BLESSURE_SIXIEME_LIGNE.md`, Lot 1a). Décrit le mécanisme
> transversal « un token porte des statuts » : où ils vivent, qui les pose, comment le code sait ce qu'un
> statut implique. Les règles Polaris (Choc, Fatigue, Froid…) restent dans leurs documents ; les effets de
> chaque statut sur le combat sont dans `COMBAT.md` / `COMBAT_FLUX.md`.

## 1. Deux choses distinctes

- **Les instances** — table `token_statuses` : une ligne = « ce token porte ce statut ». Colonnes :
  `token_id`, `status_code` (texte libre, **aucun CHECK, aucune table catalogue** — vérifié en base),
  `expires_at_turn` (NULL = jamais purgé par `endTurn`), `data` (jsonb, ex. formule d'un danger),
  `applied_by`, `applied_at`. Unicité `(token_id, status_code)`. Les statuts sont **par token**, alors que
  les blessures sont **par fiche** (`char_sheet`).
- **Le vocabulaire** — `shared/tokenStatusRegistry.js`, **autorité unique** : quels codes existent et
  ce que chacun implique. Ajouter un statut = ajouter une entrée dans ce fichier (+ icône
  `client/public/assets/status/<code>.svg` + clé i18n `status.<code>`), jamais une copie de liste ailleurs.

Pourquoi un registre en code plutôt qu'une table catalogue : un statut porte un *comportement* (bloque
la déclaration, sans défense…) qui est du code ; les autres listes qui pilotent du comportement
(`environmentalHazardRegistry`, `echeanceTypeRegistry`, `weaponModRegistry`) sont déjà des registres partagés
; un registre se teste sans base. Évolution possible (statuts créés par le MJ) : alimenter le registre
depuis la base sans changer ses consommateurs.

## 2. Forme d'une entrée

`{ code, category, ...drapeaux }` — un drapeau absent vaut `false`.

| Drapeau | Sens | Consommé par |
|---|---|---|
| `category` | catégorie de couleur du badge/panneau (`TOKEN_STATUS_CATEGORY_COLORS`) | `TokenStatusPanel.jsx`, `TokenPresentation.jsx` |
| `manualToggle` | accepté par `TOKEN_STATUS_TOGGLE` (bascule manuelle) | `socketToken.js` |
| `inPanel` | affiché dans la grille du panneau (ordre du registre = ordre d'affichage) | `TokenStatusPanel.jsx` |
| `blocksDeclaration` | le token ne peut plus agir : le MOTEUR de tour le passe avant d'ouvrir sa fenêtre (§ Blocage proactif) | `combatTurnEngine.js` (`getDeclarationBlockedTokens`), gardes de `socketCombatResolution.js` en filet |
| `defenseless` | la cible ne peut pas se défendre activement (DEF5) | `socketCombatHelpers.js` (`isTargetDefenseless`) |
| `clearedAtCombatEnd` | retiré à la fin du combat | `socketCombatState.js` |
| `gmOnly` | seul le MJ le pose/retire, quelle que soit l'option `players_edit_statuses` (dangers, froid, `dead`) | `canEditTokenStatus` → `socketToken.js` (autorité) et `TokenStatusPanel.jsx` (aperçu) |

Structures dérivées exportées (tableaux, pour `whereIn`) : `MANUAL_TOGGLE_STATUS_CODES`, `PANEL_STATUSES`,
`DECLARATION_BLOCKING_STATUS_CODES`, `DEFENSELESS_STATUS_CODES`, `COMBAT_END_CLEARED_STATUS_CODES`.
`GM_ONLY_STATUS_CODES` complète la liste. `findTokenStatus(code)` est **tolérant** : code inconnu → `undefined`,
jamais une erreur.

**Droits** — `canEditTokenStatus(code, { isGm, isOwner, playersEditStatuses })` est l'**unique** règle, appelée
par le serveur (autorité) et le panneau (aperçu) : code hors registre → refus pour tous ; MJ → autorisé ;
`gmOnly` → MJ seul ; sinon le propriétaire si l'option de campagne `players_edit_statuses` (défaut `true`)
l'autorise. Elle ne dit rien de la *manière* de poser (bascule nue = `manualToggle`, ou formulaire dédié).

**Statut `dead` (« Mort »)** — `gmOnly`, `blocksDeclaration`, `defenseless`, sans expiration et **jamais**
`clearedAtCombatEnd` : seul le MJ le retire (bascule ou `/heal`). Pour l'instant posé à la main ; il sera posé
par la blessure « Mort » du compteur (`PLAN_BLESSURE_SIXIEME_LIGNE.md` Lot 2). Un token mort garde son tour
d'initiative, mais le moteur le **passe automatiquement** sans ouvrir de fenêtre (Lot 1c, ci-dessous) ;
`combat_roster.status` `active`/`done` reste inutilisé (aucun code ne pose `done`).

**Blocage proactif (Lot 1c)** — « ce token peut-il agir ? » se décide là où le moteur CHOISIT le prochain
acteur, pas après l'ouverture de la fenêtre. Autorité unique : `getDeclarationBlockedTokens(campaignId,
tokenIds, settings)` (`combatTurnEngine.js`) → `Map(tokenId → code)` = statuts `blocksDeclaration` du registre
+ étourdissement en attente (`combat_pending` `stun`), **uniquement** en mode `status_effects_mode = 'enforced'`.
Deux points d'application : (1) ANNONCE — `advanceAnnouncementQueue` passe le token bloqué par `skipPlayer`
(« X a été passé ») avant tout test de Surprise ; (2) RÉSOLUTION — `advanceTimeline` clôt son pas par
`forfeitToken` sans `SLOT_ACTIVE` (message « X a été passé » omis s'il a déjà été passé à l'annonce), y compris
pour le tour obligatoire d'un retardataire. **Garde-fou anti-boucle** : on ne passe automatiquement que s'il reste
un acteur non bloqué (les drones en `ordres_permanents` n'en sont pas) ; si TOUS sont bloqués, comportement
historique (fenêtre + garde réactive). Toute erreur de lecture → le token n'est pas passé (fenêtre normale). Les
deux gardes des handlers (PRECHECK/CONFIRM) restent en filet — statut posé entre le choix du pas et le clic — et
appellent la même fonction. Un statut posé EN COURS de Tour prend effet au prochain pas de ce token.

## 3. Invariants

1. Une propriété de statut se lit dans le registre, **jamais** par un littéral `'stunned'`/`'unconscious'`
   comparé ailleurs (leçon FoundryVTT #9245 : la chaîne en dur casse dès qu'un code est renommé).
2. Les dangers environnementaux (`burning`, `acid`, `decompression`) ne sont **pas** `manualToggle` : la
   bascule nue écraserait la `data` posée par `exposeToHazard`. Ils passent par `exposeToHazard`/`clearHazard`.
3. `expires_at_turn` NULL = jamais purgé par la purge universelle de `endTurn` ; un statut qui ne doit pas
   disparaître seul (`dead`) ne porte pas d'expiration et n'est pas `clearedAtCombatEnd`.
4b. Les droits de pose passent TOUJOURS par `canEditTokenStatus` — jamais une comparaison `isGm`/`isOwner`
   recopiée dans un handler ou un composant.
5. « Peut-il agir ? » se lit dans `getDeclarationBlockedTokens`, jamais recopié : ni requête `token_statuses`
   ni test de statut ajoutés dans un handler pour décider d'un blocage.
4. Le test `shared/tokenStatusRegistry.test.mjs` fige (instantané historique) les ensembles dérivés : un
   nouveau statut modifie ces attentes **dans le diff qui l'ajoute**, jamais en silence.

## 4. Hors registre (dette connue)

Posés par leur propriétaire, sans entrée dans le registre ni icône/i18n : `iem_survival`
(`iemSurvivalService.js`), `ati_offensive`/`ati_defensive` (`weaponModRegistry.js` `statusCodes`, posés via
`combatTurnEngine.js`). Le registre les tolère ; les y intégrer est un chantier ultérieur.
Ensembles à sémantique propre volontairement **non** dérivés : événement d'expiration d'étourdissement
(`combatTurnEngine.js`), exclusion mutuelle `stunned`/`unconscious`/`evanoui` (`statusService.js`), garde
d'annonce `stunned` seul (`socketCombatAnnouncement.js`).

Constaté (voir le plan) : `evanoui` n'a pas de clé i18n `status.*` ni d'entrée de panneau (posé par la
Fatigue seulement). Le test `tokenStatusRegistry.test.mjs` exige icône SVG et clé `status.<code>` pour tout
statut affiché au panneau ou bloquant — `evanoui` n'en fait pas partie, un futur statut oui.
Limites connues : `TokenStatusBadges` n'affiche que 3 badges au-delà de 4 statuts (un `dead` tardif peut ne
pas se voir sur le token) ; le message de refus dit « vous êtes mort/étourdi/inconscient » même quand le MJ
déclare pour un PNJ ; un token mort qui porte encore un danger (`burning`…) continue d'en subir les ticks.

Documents associés : `docs/PLANS/PLAN_BLESSURE_SIXIEME_LIGNE.md` ; `MODING.md` (statuts de mods) ;
`INFORMATIQUE.md` (`iem_survival`) ; `COMBAT_FLUX.md` (gardes STUN2/DEF5).
