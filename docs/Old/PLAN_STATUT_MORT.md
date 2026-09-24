# PLAN_STATUT_MORT — Statut de token « Mort » et conséquences d'un cadavre

> **Statut : ✅ CLOS et ARCHIVÉ (2026-09-24, Règle 10 de `docs/RegleDocumentaire.md`).** Tous les lots sont
> commités et validés en jeu par Saar (lots 0, 1a, 1b, 1d déjà poussés sur `origin` ; **1c, 1e, 1f commités mais pas encore poussés**). **Documentation définitive :
> `docs/SYSTEME/STATUTS_TOKEN.md`** (registre, règles, mécanismes) — ce plan n'en est que l'historique.
>
> **Rédigé à la clôture.** Le chantier est né d'un audit sur la 6ᵉ ligne du compteur de blessures
> (`PLAN_BLESSURE_SIXIEME_LIGNE.md`, toujours actif pour les Lots 2-4) et s'est déroulé lot par lot ; son détail
> vivait dans ce plan-là (§4 « Lot 1 »). Il a été extrait ici pour que chaque plan garde UNE responsabilité
> (Règle 1) : le présent plan = *la mort comme statut de token et ses conséquences* ; l'autre = *la 6ᵉ ligne du
> compteur RAW dans le moteur*. Le lien entre les deux : au Lot 2, la blessure « Mort » posera ce statut via
> `applyDeathConsequences` / `isCharacterDead` (déjà livrés ici).

---

## 1. Origine et problème

Audit de Saar (2026-09-23) : le RAW porte une 6ᵉ ligne « Mort subite / Membre détruit » (seuil 30) que le moteur
n'a pas. Constat vérifié : **aucun état « mort » n'existait** — seuls `stunned` / `unconscious` / `evanoui`
(`REGLEBLESSURES.md`). Décision de Saar : *la mort doit être un statut de token, quel que soit le sort des
membres détruits.* Le vocabulaire des statuts était en outre **dupliqué** dans 3 fichiers (liste serveur, liste
client, table de catégories) et les ensembles de comportement (« bloque la déclaration », « sans défense »,
« nettoyé en fin de combat ») étaient des tableaux littéraux dispersés : ajouter `dead` comme un littéral de plus
aurait reproduit le défaut.

## 2. Décisions de Saar (chronologie)

| Date | Décision |
|---|---|
| 2026-09-23 | La mort = statut de token `dead`. La 6ᵉ ligne du compteur = UNE case affichée comme un mot (« Mort » / « Membre détruit ») — voir l'autre plan. |
| 2026-09-24 | `dead` **réservé au MJ**, quelle que soit l'option de campagne. |
| 2026-09-24 | **Option de campagne** (défaut : autorisé) : le MJ décide si les joueurs peuvent modifier les statuts de leur token. |
| 2026-09-24 | Retour du test de « Mort » : fenêtres de confirmation inutiles au retrait de statuts ; « le blocage n'est pas au bon endroit » (la fenêtre d'action du mort s'ouvre PUIS répond « vous êtes mort »). |
| 2026-09-24 | Le mort **ne peut ni esquiver ni dépenser de Chance** (« ça c'est sûr »). Mais des technologies de résurrection existent : **le cadavre reste là et prend des blessures**, point — donc aucun filtrage des cibles d'une zone, seulement plus de fenêtre de Chance. |
| 2026-09-24 | Statuts **interdits** sur un mort (8) : Entravé, Déséquilibré, Étourdi, Inconscient, Asphyxie, Aveuglé, Hypothermie, Évanoui. **Autorisés** : Enflammé, Corrodé, Irradié, Saisi, Électrocuté, Infecté, Empoisonné, Décompression. |
| 2026-09-24 | Test de Choc et durée d'étourdissement **coupés** pour un mort. **Le MJ reste libre** de tout poser à la main. À la mort, tous les statuts interdits sont **retirés**. |

## 3. Architecture retenue

- **Un registre unique** `shared/tokenStatusRegistry.js` : une entrée par code, avec des *drapeaux de comportement*
  (`manualToggle`, `inPanel`, `blocksDeclaration`, `defenseless`, `clearedAtCombatEnd`, `gmOnly`, `isDeath`,
  `incompatibleWithDeath`) ; toutes les listes utiles en sont **dérivées**, jamais recopiées. Une règle de droits
  unique `canEditTokenStatus`, appelée par le serveur (autorité) et le panneau (aperçu).
- **Pas de table SQL « catalogue »** (question de Saar) : `token_statuses` ne stocke que les *instances*
  (`status_code` en texte libre, aucun CHECK — vérifié en base) ; un statut porte un *comportement* qui est du
  code (une ligne en base sans code = un statut sans effet) ; les autres listes qui pilotent du comportement
  (`environmentalHazardRegistry`, `echeanceTypeRegistry`, `weaponModRegistry`) sont déjà des registres partagés ; un
  registre se teste sans base. **V2 possible** : alimenter le registre depuis la base si le MJ doit créer ses
  propres statuts, sans changer les consommateurs. → **aucune migration dans ce chantier.**
- **Le moteur de tour décide « qui peut agir »** (`combatTurnEngine.js`), au moment où il CHOISIT le prochain
  acteur, pas après l'ouverture de la fenêtre.
- **Un module feuille `deathStateService.js`** : « ce personnage est-il un cadavre ? » (niveau personnage, mode
  `enforced`), lu par la Chance, le Choc et la barrière d'étourdissement.
- **Modèle « immunités aux états »** : la cible reste visée, seul l'effet n'est pas appliqué (dnd5e `traits.ci`,
  immunités PF2e).

**Alternatives écartées** : table SQL catalogue (ci-dessus) ; filtrer le cadavre hors des cibles de zone (contredit
« il reste là et prend des blessures ») ; sortir le mort de la file d'initiative via `combat_roster.status = 'done'`
(aucun code ne pose `done`, `advanceAnnouncementQueue` ne filtre pas ce champ — concept à compléter d'abord,
inutile ici puisque le moteur passe le token bloqué) ; barrière d'état dans `applyModStatus` (aurait borné aussi les
actions manuelles du MJ).

## 4. Lots (un commit par cause racine)

| Lot | Commit | Cause racine → ce qui change |
|---|---|---|
| **0** Option de campagne | `df7dcce` | Un propriétaire pouvait basculer n'importe quel statut de son token, sans réglage. → `players_edit_statuses` dans `SETTINGS_SCHEMA` (défaut `true`), case dans la section « Règles de jeu », panneau en lecture seule quand refusé. |
| **1a** Registre unique | `845412d` | Vocabulaire dupliqué dans 3 fichiers + ensembles de comportement littéraux. → registre `shared/tokenStatusRegistry.js` (16 codes) + `docs/SYSTEME/STATUTS_TOKEN.md`. **Zéro changement de comportement** ; filet : test « instantané » qui compare chaque ensemble dérivé à l'ancien littéral. |
| **1b** Statut `dead` | `c30ce5b` | Aucun état « mort ». → entrée `dead` (catégorie `mort`, `gmOnly`, `blocksDeclaration`, `defenseless`, jamais nettoyé en fin de combat), icône crâne, i18n, drapeau `gmOnly` + `canEditTokenStatus` (ferme aussi un défaut de droits : un joueur pouvait forger la bascule nue d'`hypothermia`) ; message de refus dérivé de `status.<code>`. |
| **1d** Retrait direct | `65dc133` | Fenêtres de confirmation inutiles au retrait d'Enflammé / Décompression. → retrait en un clic ; Corrodé (choix RAW « persiste 1D6 tours ») et Hypothermie (modification de tranche) gardent leur formulaire ; drapeau `lingersOnClear` dans `environmentalHazardRegistry`. |
| **1c** Blocage proactif | `b443c4c` | Blocage *réactif* (2 gardes copiées dans les handlers, APRÈS l'ouverture de la fenêtre). → `getDeclarationBlockedTokens` (autorité unique) ; `advanceAnnouncementQueue` passe le token par `skipPlayer`, `advanceTimeline` clôt son pas par `forfeitToken` sans `SLOT_ACTIVE` (tour obligatoire des retardataires compris) ; garde-fou anti-boucle ; les 2 gardes restent en filet. Bénéficient aussi à `stunned` / `unconscious`. |
| **1e** Chance | `35a5197` | Un mort recevait « Éviter la zone d'effet » d'une grenade, la réduction de gravité et la Catastrophe de défense. → `isCharacterDead` ; `resolveChanceRecipientCharacterId` (contrat « `null` = aucune fenêtre ») renvoie `null` pour un cadavre (exo : exo OU pilote mort) ; `campaignId` ajouté à sa signature (3 appelants). |
| **1f** Statuts du cadavre | `26543f6` | Un tir sur le mort lançait le test de Choc puis lui posait « étourdi ». → `incompatibleWithDeath` (8 codes) ; barrière dans `applyStunWithDuration` (seul écrivain automatique de ces états ; `gmOverride` pour `COMBAT_APPLY_STUN`) ; Choc coupé dans `resolveTargetHit` (seul site de tirage) ; `applyDeathConsequences` (purge à la mort) ; `canEditTokenStatus(…, { targetIsDead })`. |

## 5. Recherches externes

- **FoundryVTT** : un rôle sémantique passe par une table de configuration (`CONFIG.specialStatusEffects.DEFEATED`),
  jamais par une chaîne en dur ; le ticket `foundryvtt#9245` documente le bug du cas inverse (comparaison à
  `"blind"` cassée dès qu'un système renomme le code) ; Foundry sépare le statut « dead » du drapeau
  `Combatant.defeated` (réglage « Skip Defeated » du suivi de combat).
- **dnd5e** : statuts construits depuis une configuration unique (`CONFIG.DND5E.conditionTypes`) dont les structures
  dérivées sont calculées ; « immunités aux états » (`traits.ci`) = modèle du cadavre (1e/1f).
- **Pathfinder 2e** : immunités — la cible peut être visée sans recevoir l'état.

## 6. Analyses à charge (une par lot, étape distincte du plan)

- **1a** : codes hors registre (`iem_survival`, `ati_*`) tolérés (recherche « code inconnu → `undefined` ») ; profil des
  16 entrées transcrit tel quel ; `gmOnly` et le formulaire du panneau reportés en 1b.
- **1b** : test « chaque statut affiché ou bloquant a son icône ET sa clé `status.<code>` » (aurait attrapé le manque
  d'`evanoui`) ; code inconnu ⇒ refus pour tous ; clé i18n ajoutée en fin de bloc (fichier partagé avec une autre session).
- **1c** : tous les chemins de la file d'annonce passent par `advanceAnnouncementQueue` (une insertion suffit) ; filet si
  `skipPlayer` échoue (il avale ses erreurs) ; blocage vérifié AVANT la branche autonome ; message « X a été passé »
  sans doublon ; **garde-fou anti-boucle** (si tous les acteurs sont bloqués, `endTurn → annonce → résolution →
  endTurn` tournerait sans fin) ; précision au codage : les drones `drone_auto` ne comptent pas comme acteurs.
- **1e/1f** : tous les écrivains de statuts relus (`statusService.js:40/178`, `socketToken.js`) ; l'hypothermie n'est posée
  que par le formulaire du MJ (libre) ; un seul site de tirage du Choc ; la barrière vit dans le service, pas dans
  chaque appelant.

## 7. Tests

- Purs : `shared/tokenStatusRegistry.test.mjs` (18 tests : instantanés historiques, règle de droits, `isDeath`,
  `incompatibleWithDeath`, garde-fou icône + i18n), `shared/environmentalHazardRegistry.test.mjs`,
  `server/src/lib/campaignSettingsService.test.mjs` ; `node --test 'shared/**/*.test.mjs'` : 674/674.
- Intégration (base locale, **lancés par Saar**, `--env-file=.env`) : `combatTurnEngine.test.mjs` 40/40 (dont 12 pour le
  lot 1c) ; `deathStateService.test.mjs` 8/8 (Chance, `isTokenDead`, barrière d'étourdissement, purge à la mort).
- En jeu (Saar) : icône et rôle du statut, `/heal`, retrait direct, mort passé sans fenêtre à l'annonce et à la
  résolution, plus de fenêtre de Chance ni de Choc sur le mort, purge à la mort.

## 8. Limites connues et constats (non traités — tickets)

1. Un choix d'étourdissement déjà ouvert chez un joueur au moment de la mort reste affiché ; sa confirmation est ignorée.
2. `TokenStatusBadges` n'affiche que 3 badges au-delà de 4 statuts : un `dead` tardif peut ne pas se voir sur le token.
3. Le message de refus dit « vous êtes mort/étourdi/inconscient » même quand le MJ déclare pour un PNJ.
4. `evanoui` n'a ni clé i18n `status.*` ni entrée de panneau (badge seul, posé par la Fatigue).
5. Le client d'un joueur demande les blessures d'un PNJ qui agit (`CombatActionWindow.jsx`) : 403 inoffensif dans les logs.
6. Un combat composé uniquement de drones en `ordres_permanents` boucle (Tour entièrement pré-annoncé) — préexistant, non
   aggravé ; parité avec les anciennes gardes pour l'exo piloté (statuts lus sur le token de l'exo, pas sur le pilote).
7. Statuts hors registre (`iem_survival`, `ati_offensive/defensive`) : sans icône ni i18n — chantier ultérieur.
8. Le tour d'initiative d'un mort n'est pas retiré de la file : il est *passé* (le moteur le saute à chaque Tour).

## 9. Suite

`PLAN_BLESSURE_SIXIEME_LIGNE.md`, Lots 2-4 : la 6ᵉ ligne dans le moteur (migration `chk_wounds_severity`, retrait de
`is_lethal`, seuils uniques, débordement de la ligne Mortelle) ; la blessure « Mort » posera le statut `dead` puis
appellera `applyDeathConsequences` ; le rachat en Critique par la Chance (Lot 3) devra retirer `dead` ; « le cadavre
prend des blessures jusqu'à ce que sa ligne soit pleine » dépend du Lot 2 (aujourd'hui `applyWound` avale l'erreur
d'une ligne Mortelle pleine).
