# STATUTS_TOKEN — Statuts de token (`token_statuses`) et registre unique

> Créé 2026-09-24 (chantier `docs/PLANS/PLAN_BLESSURE_SIXIEME_LIGNE.md`, Lot 1a). Décrit le mécanisme
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
| `blocksDeclaration` | le token ne peut plus déclarer : la garde de résolution passe son tour (STUN2) | `socketCombatResolution.js` |
| `defenseless` | la cible ne peut pas se défendre activement (DEF5) | `socketCombatHelpers.js` (`isTargetDefenseless`) |
| `clearedAtCombatEnd` | retiré à la fin du combat | `socketCombatState.js` |

Structures dérivées exportées (tableaux, pour `whereIn`) : `MANUAL_TOGGLE_STATUS_CODES`, `PANEL_STATUSES`,
`DECLARATION_BLOCKING_STATUS_CODES`, `DEFENSELESS_STATUS_CODES`, `COMBAT_END_CLEARED_STATUS_CODES`.
`findTokenStatus(code)` est **tolérant** : code inconnu → `undefined`, jamais une erreur.

## 3. Invariants

1. Une propriété de statut se lit dans le registre, **jamais** par un littéral `'stunned'`/`'unconscious'`
   comparé ailleurs (leçon FoundryVTT #9245 : la chaîne en dur casse dès qu'un code est renommé).
2. Les dangers environnementaux (`burning`, `acid`, `decompression`) ne sont **pas** `manualToggle` : la
   bascule nue écraserait la `data` posée par `exposeToHazard`. Ils passent par `exposeToHazard`/`clearHazard`.
3. `expires_at_turn` NULL = jamais purgé par la purge universelle de `endTurn` ; un statut qui ne doit pas
   disparaître seul (futur `dead`) ne porte pas d'expiration et n'est pas `clearedAtCombatEnd`.
4. Le test `shared/tokenStatusRegistry.test.mjs` fige (instantané historique) les ensembles dérivés : un
   nouveau statut modifie ces attentes **dans le diff qui l'ajoute**, jamais en silence.

## 4. Hors registre (dette connue)

Posés par leur propriétaire, sans entrée dans le registre ni icône/i18n : `iem_survival`
(`iemSurvivalService.js`), `ati_offensive`/`ati_defensive` (`weaponModRegistry.js` `statusCodes`, posés via
`combatTurnEngine.js`). Le registre les tolère ; les y intégrer est un chantier ultérieur.
Ensembles à sémantique propre volontairement **non** dérivés : événement d'expiration d'étourdissement
(`combatTurnEngine.js`), exclusion mutuelle `stunned`/`unconscious`/`evanoui` (`statusService.js`), garde
d'annonce `stunned` seul (`socketCombatAnnouncement.js`).

Constatés (voir le plan) : le serveur accepte la bascule nue de `hypothermia` (le client ne l'envoie
jamais — formulaire Froid dédié) ; `evanoui` n'a pas de clé i18n `status.*` ni d'entrée de panneau.

Documents associés : `docs/PLANS/PLAN_BLESSURE_SIXIEME_LIGNE.md` ; `MODING.md` (statuts de mods) ;
`INFORMATIQUE.md` (`iem_survival`) ; `COMBAT_FLUX.md` (gardes STUN2/DEF5).
