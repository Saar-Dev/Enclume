# PLAN_BLESSURE_SIXIEME_LIGNE — Compteur de blessures : la 6ᵉ ligne « Mort subite / Membre détruit »

> 2026-09-23 · Plan temporaire (Règle 10, `docs/RegleDocumentaire.md`) — sera archivé dans `docs/Old/` et
> fusionné dans `docs/SYSTEME/COMBAT.md` une fois clos.
> Statut : 🟡 **Lots 1a/1b/1d commités ; Lot 1c CODÉ 2026-09-24 (en attente des tests Saar : base + jeu) ; Lots 2-4 non commencés.**
> Décisions Saar du 2026-09-23 en §2. Points encore
> ouverts en §7. Un seul problème (Règle « un plan = un bug ») : la 6ᵉ ligne du compteur RAW n'existe pas
> dans le moteur.
> Hiérarchie : Livre de Base Polaris (`docs/REGLES/REGLEBLESSURES.md`) > ce plan.

---

## 1. Problème (cause racine unique)

Le compteur de blessures du RAW a **6 lignes** : Légères (5), Moyennes (10), Graves (15), Critiques (20),
Mortelles (25), **Mort subite / Membre détruit (30)** — `REGLEBLESSURES.md:20-26` (seuils) et `:135-149`
(compteur). Le moteur n'en implémente que 5 : `WOUND_SEVERITIES` (`shared/woundConstants.js:7`), contrainte SQL
`chk_wounds_severity` (migration 124), `WOUND_MAX_COUNTS`. La 6ᵉ ligne est à la fois :
- **la cible d'un coup ≥ 30** de dégâts nets ;
- **la cible du débordement de la ligne Mortelle** (même mécanisme de promotion que Légère → Moyenne → …).

Trois symptômes, une seule absence.

### 1.1 Constats (code réel, pas documentation)

| # | Constat | Statut |
|---|---|---|
| C1 | ≥ 30 net → `_severityForDamage` renvoie `mortelle` + `is_lethal: true` (`damageService.js:300`), même blessure qu'à 25. | [VÉRIFIÉ] lecture |
| C2 | `is_lethal` n'est pas persisté : `applyWound` ne le reçoit pas (`woundService.js:27`). Il ne sert qu'au malus de Choc (`charStats.js:351` : -10 sur un membre au lieu de -5) et à l'étiquette « LÉTAL » (`CombatResultPanels.jsx:83`). | [VÉRIFIÉ] lecture + exécution de `getShockMalus` |
| C3 | Tête/Corps à ≥ 30 : malus de Choc de Mortelle (-15/-10), personne ne meurt. Aucun état « mort » n'existe (grep `dead`/`mort` vide ; seuls `stunned`/`unconscious`/`evanoui`). La mort est « narrative » (`woundEvolutionService.js:198`). | [VÉRIFIÉ] |
| C4 | **Débordement muet** : `nextSeverity('mortelle') === null` (exécuté) ; capacité Mortelle = 1 (tête, bras, jambes), 2 (corps). Une 2ᵉ Mortelle sur la tête lève `AppError('Ligne pleine')` (`woundUtils.js:54`), `applyWound` l'avale et renvoie `null` : aucune blessure écrite, aucun Test de Choc. | [VÉRIFIÉ] `nextSeverity`/capacités exécutés ; la levée d'erreur elle-même lue, pas exécutée sur la base |
| C5 | Annexe, même racine : l'Infection d'une Mortelle (`infectsOnSuccess: true`) réinsère une Mortelle (`woundEvolutionService.js:194`), non rattrapé par le handler → lève sur les localisations à capacité 1. | [HYPOTHÈSE] lu, non exécuté |
| C6 | Route manuelle `POST /char-sheet/:id/wounds` (`char-sheet.js:927`) valide `WOUND_SEVERITIES` : le MJ ne peut pas non plus poser la 6ᵉ ligne à la main. | [VÉRIFIÉ] lecture |
| C7 | Le client boucle sur `WOUND_SEVERITIES` (`LocationPanel.jsx:266`) et indexe la « pire » blessure avec `indexOf` (`SilhouettePanel.jsx:21`) : une 6ᵉ valeur apparaît sans réécriture. | [VÉRIFIÉ] lecture |
| C8 | Chance : `CHANCE_ELIGIBLE_SEVERITIES` contient `mortelle` ; un coup ≥ 30 ouvre aujourd'hui les réductions d'une Mortelle (1-2 degrés). Le RAW prévoit explicitement le rachat d'une Mort subite en Critique (`REGLE_CHANCE.md:122-123`). | [VÉRIFIÉ] |

### 1.2 Texte RAW pertinent
- **Mort subite** : « le personnage meurt sur le coup » (`REGLEBLESSURES.md:164-167`). Aucun Test.
- **Membre détruit** (Bras/Jambe seulement, même seuil 30) : le membre est détruit, paralysie permanente ;
  stabilisation nécessaire, mort imminente ; **aucun Test possible** (`:174-179`) ; Choc -10 ;
  Jambes : déplacement impossible ; Bras : Allure lente. Guérison 3 semaines, Chirurgie + Médecine,
  difficulté -3 ; « un Membre détruit devient une Blessure critique » (`:368`).
- Les colonnes `membreDetruit` de `BLESSURE_EFFETS_TABLE`, `CHOC_DUREE_TABLE`, `DUREE_GUERISON_SOINS_TABLE`
  (`woundConstants.js`) existent déjà (Encyclopédie), sans consommation moteur.

## 2. Décisions Saar (2026-09-23)

1. **La mort est un statut de token** (`dead`), à mettre en place dans tous les cas, indépendamment du
   sort des membres détruits.
2. **Chance sur la 6ᵉ ligne : coût de 3 points** (le RAW ne chiffre pas ; 2 semblait « peu vu la
   blessure »). **Divergence RAW assumée** à inscrire dans `docs/JOURNAL8.md` (invariant 5). Elle dépasse
   aussi la limite générale de « 2 points d'un seul coup » (`REGLE_CHANCE.md:119`) : exception explicite
   à cette ligne. Résultat visé : une Blessure critique (RAW `:122-123`). *Lecture retenue : c'est le
   **coût** qui passe à 3, pas le nombre de degrés — à confirmer.*
3. **Rendu visuel d'un membre détruit** : barrer toutes les blessures du membre et les passer en gris.
4. **La 6ᵉ ligne = une seule case, pour les 6 localisations** (tranché 2026-09-23). Affichage : la case est
   masquée et remplacée par le mot « Mort » (Tête/Corps) ou « Membre détruit » (bras/jambes) — le mot
   dépend de la localisation, la gravité stockée est unique. **Une blessure « Mort » (Tête/Corps) active le
   statut `dead` sur le token.** Conséquence : la 6ᵉ gravité est une vraie ligne écrite partout (la
   `WOUND_OVERFLOW` par localisation du §3 devient inutile, `nextSeverity('mortelle')` suffit), et le
   statut `dead` est un *effet* de cette blessure, pas une seconde autorité.
   **Case masquée — comportement validé (2026-09-23) :** le mot est toujours visible (grisé si la blessure
   est absente, mis en évidence si active) et **cliquable** comme les autres cases (pose/retrait manuel MJ).
   **Chance : « 3 points de coût → Critique » confirmé** (§2.2).
5. Le report de 2026-07-29 (« Membre détruit = Option de campagne future ») était une décision de
   périmètre pour le lot Guérison, pas une affirmation du RAW (`docs/Old/PLAN_BLESSURES_GUERISON.md:226-244`).
   **Mort subite n'y a jamais été tranchée** (aucune occurrence dans ce plan) : elle est tombée dans le
   report sans décision. Ce plan lève le report.

## 3. Architecture retenue

Deux concepts que le RAW distingue :
- **La blessure aiguë** = la 6ᵉ ligne du compteur, avec ses propres paramètres (Effets, Choc, Guérison,
  Stabilisation).
- **L'état permanent du membre** (paralysie) : survit à la guérison de la blessure. *Le compteur papier ne
  le suit pas* — c'est la phrase du RAW « ne retrouvera plus l'usage » + le rendu voulu (§2.3) qui l'exigent.

| Élément | Choix |
|---|---|
| Blessure aiguë | Une 6ᵉ valeur dans `WOUND_SEVERITIES` (nom → §7), **capacité 1 sur les 6 localisations** (§2.4). Migration de `chk_wounds_severity` (règle `migrations.md`). |
| Débordement / ≥ 30 | Un seul chemin, la promotion existante : un coup ≥ 30 **ou** une ligne Mortelle pleine écrit la blessure 6ᵉ ligne (`nextSeverity`). Aucun cas particulier par localisation. |
| Statut `dead` | Effet de la blessure 6ᵉ ligne sur Tête/Corps, posé dans `applyWound` (une seule autorité, tous les chemins : combat, chute, froid, route manuelle MJ). **Retiré quand cette blessure disparaît** (Chance, `/heal`, suppression MJ) — sinon statut et blessure divergent. |
| Affichage | Case masquée, mot « Mort » / « Membre détruit » selon la localisation (§2.4). |
| `is_lethal` | **Supprimé** : la gravité elle-même porte l'information (une autorité, plus de drapeau parallèle). L'étiquette « LÉTAL » et le malus de Choc en dérivent. |
| Guérison | Table « cible de guérison » : la 6ᵉ valeur redescend vers `critique` (RAW `:368`), pas vers `mortelle`. |
| Interdiction de Test | La 6ᵉ valeur rejoint `TEST_BLOCKING_SEVERITIES` (RAW `:175`). |
| État permanent | Table `character_destroyed_limbs` (fiche, localisation ∈ bras/jambes, `destroyed_at_game_minutes`, UNIQUE), écrite dans la transaction d'insertion de la blessure. Le client en dérive barré + gris. |

**Alternatives écartées.**
- *Drapeau sur la Mortelle* : toutes les tables RAW sont indexées par gravité → un `if (drapeau)` dans
  chacune = second moteur ; ne résout pas le débordement.
- *Table d'état seule (sans 6ᵉ valeur)* : ne sait ni déborder, ni guérir en Critique, ni porter les malus.

## 4. Lots (ordre et dépendances)

- **Lot 1 — Statut `dead`.** Autonome, sans migration (`token_statuses.status_code` n'a aucun CHECK, seulement
  unique/PK/FK — vérifié). Sites exacts (relus 2026-09-23) :
  - serveur : `socketToken.js:160` (`VALID_STATUS_CODES` + **bascule réservée au MJ** — aujourd'hui le
    propriétaire du token peut basculer n'importe quel statut valide, `:152-153`) ;
    `socketCombatResolution.js:165` et `:353` (gardes assommé → `forfeitToken`, ajouter `dead`) ;
    `socketCombatState.js:302` **inchangé** (liste explicite `stunned`/`unconscious` : `dead` n'est déjà pas
    effacé à la fin du combat — à couvrir par un test) ; `/heal` l'efface déjà (tous statuts).
  - client : `TokenStatusPanel.jsx` (`STATUS_LIST`, couleur de catégorie, clic réservé MJ ; la grille 5
    colonnes passe à 4 lignes), `TokenPresentation.jsx` (`STATUS_CATEGORY`), icône
    `client/public/assets/status/dead.svg` (même gabarit hexagonal que les autres), `fr.json` `status.dead`,
    `useCombatSocket.js:175` (le message de refus ne connaît que « inconscient »/« étourdi »).
  - constaté, hors lot : la garde d'annonce (`socketCombatAnnouncement.js:259`) ne teste que `stunned`
    (pas `unconscious`) ; `dead` suit `unconscious`, pas d'extension ici.
- **Révision du Lot 1 (2026-09-24, après recherche — en attente de validation Saar).** Ajouter `dead`
  comme un littéral de plus dans chaque liste répéterait un défaut déjà présent : le vocabulaire des
  statuts est **dupliqué** — liste serveur `VALID_STATUS_CODES` (`socketToken.js:160`), liste client
  `STATUS_LIST` (`TokenStatusPanel.jsx:13`), table client `STATUS_CATEGORY` (`TokenPresentation.jsx:17`) —
  et les ensembles de comportement sont des tableaux littéraux dispersés (gardes de déclaration
  `socketCombatResolution.js:165/353` ; « sans défense » `socketCombatHelpers.js:996` ; nettoyage de fin
  de combat `socketCombatState.js:302/307`). Référence Foundry VTT : un rôle sémantique passe par une
  table de configuration (`CONFIG.specialStatusEffects.DEFEATED`), jamais par une chaîne en dur ; le
  ticket foundryvtt #9245 documente le bug du cas inverse (comparaison à `"blind"` cassée dès qu'un
  système renomme le code). Foundry sépare aussi le statut « dead » du drapeau `Combatant.defeated`
  (réglage « Skip Defeated » du suivi de combat).
  **Nouveau découpage, un commit par cause racine :**
  - **1a — Registre unique des statuts de token** (`shared/tokenStatusRegistry.js`) : refactor **sans
    changement de comportement**. Entrées `{ code, category, manualToggle, inPanel, gmOnly,
    blocksDeclaration, defenseless, clearedAtCombatEnd }` ; les listes/ensembles ci-dessus en sont
    dérivés. Filet : test « golden » qui fige chaque ensemble dérivé égal à l'ancien littéral.
  - **1b — Statut `dead`** : une entrée de registre (`gmOnly`, `blocksDeclaration`, `defenseless`, pas
    `clearedAtCombatEnd`) + icône + i18n + message de refus dérivé de `status.<code>` (remplace la
    branche codée en dur « inconscient »/« étourdi », `useCombatSocket.js:175`).
  - **Pourquoi pas une table SQL « catalogue des statuts » (question Saar, 2026-09-24).** Vérifié en base :
    `token_statuses` ne stocke que les *instances* (token, `status_code` en texte libre sans contrainte,
    expiration, `data`) ; il n'existe aucune table catalogue. Ajouter `dead` n'exige donc **aucune
    migration**. Un catalogue en base a été écarté : un statut porte un *comportement* (bloque la
    déclaration, sans défense, réservé MJ…) qui est du code — une ligne en base sans code serait un statut
    sans effet ; l'ajout d'un statut demande de toute façon icône, texte et comportement ; les autres
    listes qui pilotent du comportement (`environmentalHazardRegistry`, `echeanceTypeRegistry`,
    `weaponModRegistry`) sont déjà des registres partagés, pas des tables ; et un registre se teste sans
    base (`node --test shared/**`). **V2 possible** si un jour le MJ doit créer ses propres statuts sans
    développeur : le registre peut être alimenté par la base sans changer ses consommateurs.
  - **Inventaire exhaustif du vocabulaire de statuts (relu 2026-09-24)** — 3 copies de la *liste* :
    `socketToken.js:167-170` (12 codes basculables), `TokenStatusPanel.jsx:13-29` (15 codes, ordre du
    panneau), `TokenPresentation.jsx:17-22` (16 codes dont `evanoui`) ; + les 4 couleurs de catégorie
    copiées dans **deux** fichiers client (`TokenStatusPanel.jsx:31`, `TokenPresentation.jsx:11`) ; + les
    ensembles de comportement littéraux : déclaration bloquée `[stunned, unconscious]`
    (`socketCombatResolution.js:165/353`), sans défense `[unconscious, blinded, stunned]`
    (`socketCombatHelpers.js:996`), nettoyage fin de combat `[stunned, unconscious]`
    (`socketCombatState.js:302/307`). Volontairement **laissés tels quels** en 1a (sémantique propre,
    `dead` n'y entre pas) : `combatTurnEngine.js:809` (événement d'expiration d'étourdissement),
    `statusService.js:37` (exclusion mutuelle stunned/unconscious/evanoui), garde d'annonce
    `socketCombatAnnouncement.js:259` (`stunned` seul).
  - **Constatés, hors périmètre 1a (à traiter ou ticketer, jamais perdus)** : (i) le serveur accepte la
    bascule nue de `hypothermia` (`socketToken.js:170`) alors que le client ne l'envoie jamais (formulaire
    Froid dédié) — un joueur propriétaire (option `players_edit_statuses` activée) pourrait forger cet
    envoi ; (ii) `evanoui` n'a ni clé i18n `status.*` ni entrée de panneau (badge seul) ; (iii) `HAZARD_CODES`
    du panneau recopie `ENVIRONMENTAL_HAZARD_REGISTRY` (`shared/`) au lieu de le lire. (i) est un vrai
    défaut de droits : à corriger dans le commit 1b (un code `gmOnly` refusé côté serveur), pas en 1a.
  - **Analyse à charge de 1a (2026-09-24) — conclusion : le commit tient, périmètre précisé.**
    (1) *Codes hors registre* : d'autres services posent des statuts que les 3 listes ignorent —
    `iem_survival` (`iemSurvivalService.js`, constante locale), `ati_offensive`/`ati_defensive`
    (`weaponModRegistry.js` `statusCodes`, posés via `combatTurnEngine.js:294`) — sans icône
    `/assets/status/*.svg` ni clé i18n (défaut cosmétique préexistant, noté). Décision : le registre 1a
    couvre les **16 codes des 3 listes** ; ces codes restent déclarés par leur propriétaire, et toute
    recherche du registre est **tolérante** (code inconnu → valeurs par défaut, comme aujourd'hui
    `?? '#888'` dans `TokenPresentation.jsx:188`) ; test dédié. Les intégrer au registre = chantier
    ultérieur (`weaponModRegistry` fournirait alors ses codes au registre, sans double déclaration).
    (2) *Profil des 16 entrées* (à transcrire tel quel) : entrave = grappled, restrained, off_balance ;
    dot = burning, acid, decompression (`manualToggle:false`), asphyxia, electrocuted ; sens = stunned,
    unconscious (`blocksDeclaration`+`defenseless`+`clearedAtCombatEnd`), blinded (`defenseless` seul),
    evanoui (`manualToggle:false`, `inPanel:false`) ; chronique = hypothermia (`manualToggle:true` —
    préservé tel quel, voir constaté (i)), infected, poisoned, irradiated. Ordre du registre = ordre du
    panneau actuel.
    (3) `gmOnly` et le choix du formulaire du panneau (danger/froid) sont **reportés en 1b** (ils n'ont
    d'usage qu'avec `dead` et la correction de (i)) : 1a reste à zéro changement de comportement.
    (4) *Documentation de clôture* : aucun document SYSTEME ne décrit les statuts de token ;
    `VOCABULARY.md:140` affirme à tort que `status_code` « ne connaît que stunned/unconscious ». Clôture =
    nouveau `docs/SYSTEME/STATUTS_TOKEN.md` (une responsabilité, Règle 1) + ligne dans `INDEX.md` +
    correction de cette ligne de `VOCABULARY.md`. Pas dans `COMBAT.md` (déjà modifié par l'autre session).
    (5) *Validation prévue* : `node --check` ; `node --test shared/tokenStatusRegistry.test.mjs` ;
    `cd client && npx eslint <fichiers>` ; `cd client && npm run build` ; `git diff --check` ; puis test
    en jeu de Saar (panneau Statuts, étourdir un token, fin de combat).
    Référence externe corroborante : dnd5e (FoundryVTT) construit ses statuts depuis un objet de
    configuration unique (`CONFIG.DND5E.conditionTypes`, propriétés par condition) dont les structures
    dérivées sont calculées — même forme que le registre proposé.
  - **Constaté au test en jeu de 1a (2026-09-24), sans lien avec les statuts** : quand un PNJ agit, la
    fenêtre d'action d'un joueur demande les blessures de ce PNJ (`CombatActionWindow.jsx:384-392`,
    `playerToken.character_id`) et le serveur répond 403 « pas la permission » (fiche non possédée) ; le
    `.catch` masque l'erreur (`setMortallyWounded(false)`) — bruit de log inoffensif, code inchangé par
    1a. À ticketer si Saar le souhaite.
  - **Preuves du test en jeu de 1a** : log `[STUN2] PRECHECK … assommé — auto-skip` (garde de déclaration
    alimentée par `DECLARATION_BLOCKING_STATUS_CODES`) ; base après `FIN COMBAT` : la ligne `unconscious` a
    disparu, les lignes `burning` sont conservées (`clearedAtCombatEnd` correct) et `combat_roster` est vide.
  - **Conception exacte de 1b (2026-09-24, présentée à Saar en langage courant ; 1a commité `845412d`).**
    (a) *Registre* : entrée `dead` — catégorie nouvelle `mort` (gris sombre), `manualToggle`, `inPanel`
    (dernier du panneau), `blocksDeclaration`, `defenseless`, **pas** `clearedAtCombatEnd` ; nouveau drapeau
    `gmOnly` posé sur `burning`, `acid`, `decompression`, `hypothermia`, `dead` (dérivé `GM_ONLY_STATUS_CODES`).
    (b) *Une seule règle de droits, partagée serveur + client* : fonction pure
    `canEditTokenStatus(code, { isGm, isOwner, playersEditStatuses })` dans le registre — `gmOnly` ⇒ MJ seul ;
    sinon MJ, ou propriétaire si l'option `players_edit_statuses` l'autorise ; code inconnu ⇒ refus.
    `socketToken.js` l'appelle (ferme le constaté (i) : un joueur ne peut plus forger la bascule nue de
    `hypothermia`, ni poser/retirer `dead`) ; `TokenStatusPanel.jsx` l'appelle pour `clickable` et
    `handleToggle` (les sets HAZARD/CHRONIC ne servent plus qu'à choisir le formulaire).
    (c) *Message de refus* (`useCombatSocket.js:175`) : `t('status.' + statusCode).toLowerCase()` au lieu de
    la branche « inconscient »/« étourdi » — mêmes textes pour ces deux-là, « mort » pour `dead`.
    (d) *Assets/i18n* : `client/public/assets/status/dead.svg` (crâne, gabarit hexagonal) ; `fr.json`
    `status.dead` = « Mort » (fichier partagé avec la session drones : staging partiel).
    (e) *Test* : les attentes de l'instantané sont mises à jour **volontairement** (`dead` ajouté aux ensembles
    concernés) + tests de la règle de droits (MJ, propriétaire avec/sans option, `gmOnly`, code inconnu) +
    `dead` non nettoyé en fin de combat.
    (f) *Vérifié* : aucun autre site ne supprime `token_statuses` en bloc sauf `/heal` (`woundService.js:160`,
    tous statuts = résurrection MJ voulue) ; les boucles de début de tour (dangers, `iem_survival`, mods)
    filtrent par code précis → `dead` n'y a aucun effet ; purge d'expiration ignore `expires_at_turn` NULL.
    (g) *Hors 1b, noté* : un token mort qui porte encore `burning` continuerait de subir les ticks de danger à
    chaque tour (les boucles ignorent `dead`) — question de comportement à trancher avec le Lot 2 ou 1c.
  - **Analyse à charge de 1b (2026-09-24) — conclusion : le plan tient, 3 renforts + 2 limites assumées.**
    Renforts adoptés : (R1) test « chaque statut affiché au panneau ou bloquant a son icône
    `client/public/assets/status/<code>.svg` ET sa clé `status.<code>` de `fr.json` » — empêche `dead` (ou un
    futur statut) d'apparaître sans icône/texte et aurait attrapé le manque de `evanoui` ; (R2) règle de
    droits : code inconnu du registre ⇒ refus pour tous (le serveur exige en plus `manualToggle`) ;
    (R3) clé `status.dead` ajoutée en FIN de bloc `status` de `fr.json` : la copie de travail de ce fichier
    porte des hunks non commités d'un autre agent (réordonnancement de clés, dont les miennes, lignes
    ~682 et ~1078) — non sémantiques, à ne pas stager ; mon hunk reste distinct.
    Limites assumées (notées, hors 1b) : (L1) `TokenStatusBadges` n'affiche que 3 badges au-delà de 4
    statuts — un `dead` posé après 4 autres pourrait ne pas se voir sur le token ; (L2) le message de refus dit
    « vous êtes mort » même quand le MJ déclare pour un PNJ (déjà le cas pour « étourdi »).
    Effets de bord écartés par lecture : `applyStunWithDuration` ne supprime que la famille
    stunned/unconscious/evanoui (n'efface pas `dead`) ; un Choc sur un mort ajoute `unconscious`, inoffensif ;
    la grille passe à 4 lignes (5 colonnes fluides) sans changement de mise en page.
  - **Retours du test en jeu de 1b (Saar, 2026-09-24)** : icône « Mort » validée ; `/heal` retire bien le
    statut ; « fenêtre de confirmation parfois au retrait d'un statut, non nécessaire » = formulaires de
    retrait des dangers (`hazardPanel.clearTitle`/`clearButton`, `TokenStatusPanel.jsx:280/442`) et du froid
    (`coldExposurePanel.clearButton`, `:497`) — seuls Enflammé/Corrodé/Décompression/Hypothermie sont concernés,
    comportement préexistant (**1d, petit lot séparé à confirmer avec Saar** : retrait direct en un clic) ;
    **« le blocage n'est pas au bon endroit »** : la fenêtre d'action d'un token mort s'ouvre PUIS la garde
    répond « vous êtes mort » — même comportement pour `stunned`/`unconscious` (les gardes vivent dans les
    handlers de résolution, après l'ouverture de la fenêtre).
  - **Cadrage de 1c — blocage PROACTIF (2026-09-24, à présenter puis analyser avant tout code).** Cause
    racine : la vérification « ce token peut-il agir ? » est *réactive* (deux copies quasi identiques,
    `socketCombatResolution.js` PRECHECK ~157-180 et CONFIRM ~346-368) au lieu d'être posée là où le moteur
    CHOISIT le prochain acteur. Lecture du code : `advanceTimeline` (`combatTurnEngine.js:603`) est « le seul
    point d'entrée fais avancer la résolution » — il choisit le pas (`pickNextTimelineStep`) puis diffuse
    `SLOT_ACTIVE`, ce qui ouvre la fenêtre côté client ; il sait déjà résoudre des entrées autonomes puis se
    rappeler (récursion à terminaison garantie). Pattern voisin en ANNONCE : `skipPlayer` (`:239`,
    `has_announced`, action `skip`, `COMBAT_TURN_SKIPPED` → « X a été passé »). **Conception visée** :
    (a) UNE fonction d'autorité « bloc de déclaration » (statut du registre `blocksDeclaration` en mode
    `enforced` + stun en attente `combat_pending`) qui remplace les 2 copies ; (b) en RÉSOLUTION :
    `advanceTimeline` passe les pas d'un token bloqué (`forfeitToken` + `COMBAT_TURN_SKIPPED`) et se rappelle,
    sans ouvrir de fenêtre ; (c) en ANNONCE : `findNextAnnounceSlot`/file d'annonce saute un token bloqué via
    `skipPlayer` (à VÉRIFIER : Saar n'a pas dit si la fenêtre de déclaration s'ouvrait aussi) ; (d) les gardes
    des handlers restent en filet de sécurité (statut posé entre-temps). **Effet de bord voulu** :
    `stunned`/`unconscious` bénéficient du même comportement (plus de fenêtre, plus de message d'erreur).
    **Risque** : touche le moteur de tour (FSM) → commit isolé, tests de scénario (token bloqué en premier,
    au milieu, dernier ; tous bloqués ; stun en attente ; drone/exo ; mode `icon_only`/`off`), validation Saar
    en jeu réel. Remplace l'ancien « 1c différé » (sortie de la file d'initiative) : `combat_roster.status`
    `done` reste inutilisé.
  - **Lot 1c — CONCEPTION DÉTAILLÉE (2026-09-24, après lecture complète de `combatTurnEngine.js` ; Saar :
    « la fenêtre de déclaration s'affiche pour le mort » + « blocage au mauvais endroit »).**
    *Constat code* : ANNONCE — `advanceAnnouncementQueue` (`:97`) est le point central de la file (appelé par
    `endTurn:862`, `socketCombatState.js:445/561`, `socketCombatAnnouncement.js:1085`, `skipPlayer:251`) ; il
    émet `COMBAT_SLOT_ADVANCED`, ce qui ouvre la fenêtre de déclaration ; précédent d'auto-passage : le PNJ qui
    rate son test de Surprise (`:129-148`, `has_announced` + action `skip` + relance de la file) et `skipPlayer`
    (`:220`, + `COMBAT_TURN_SKIPPED`). RÉSOLUTION — `advanceTimeline` (`:603`) choisit le pas puis diffuse
    `SLOT_ACTIVE` (ouvre la fenêtre) ; un token qui a « passé » à l'annonce reste un pas `simple`
    (`has_resolved=false`) et son client confirme automatiquement (log `mods:null`). Les gardes actuelles
    (`socketCombatResolution.js` ~157-180 PRECHECK et ~346-368 CONFIRM) sont deux copies quasi identiques.
    *Conception* : (1) **une seule autorité**, dans `combatTurnEngine.js` :
    `getDeclarationBlockedTokens(campaignId, tokenIds, settings)` → `Map(tokenId → statusCode)` (statuts
    `blocksDeclaration` du registre, uniquement en mode `enforced`, + stun en attente `combat_pending`) ;
    les 2 gardes des handlers l'appellent (zéro changement de comportement de ces gardes, elles restent en filet).
    (2) **ANNONCE** : dans `advanceAnnouncementQueue`, juste après `nextSlot` (AVANT le test de Surprise), un token
    bloqué est passé par `skipPlayer` (déjà : `has_announced`, action `skip`, `COMBAT_TURN_SKIPPED`, relance de
    la file) — aucune fenêtre ne s'ouvre. (3) **RÉSOLUTION** : dans `advanceTimeline`, après le choix du pas
    (y compris le tour obligatoire des retardataires), un token bloqué est clôturé par `forfeitToken` et la
    fonction se rappelle, sans `SLOT_ACTIVE` ; `COMBAT_TURN_SKIPPED` n'est émis que si le token n'a PAS déjà été
    passé à l'annonce ce Tour (sinon message en double). (4) **Garde-fou anti-boucle (trouvaille)** : si TOUS les
    tokens actifs du roster sont bloqués, `endTurn → ANNONCE (tous passés) → RÉSOLUTION (rien) → endTurn` tournerait
    sans fin (Tours qui défilent seuls). Règle : on ne passe automatiquement que s'il reste au moins un token
    actif non bloqué ; sinon comportement actuel (fenêtre + garde). Fonction pure testable
    `hasActionableToken(blockedIds, activeIds)`. (5) `stunned`/`unconscious` en bénéficient (plus de fenêtre, plus
    de message d'erreur) ; un statut posé EN COURS de Tour (Choc pendant la résolution) prend effet au prochain
    pas de ce token, comme aujourd'hui.
    *Terminaison* : `forfeitToken` clôt les entrées `scheduled`/`delayed_waiting` du Tour et pose
    `has_resolved` (les seuls critères de `pickNextTimelineStep`) ; `skipPlayer` pose `has_announced` — chaque
    passage réduit strictement l'ensemble restant.
    *Tests* : fonction pure ; scénarios en jeu (Saar) : mort en 1ᵉʳ/milieu/dernier de l'ordre, mort + inconscient,
    PJ et PNJ, tous bloqués (comportement inchangé), mode `icon_only`/`off` (inchangé), stun en attente, statut
    posé pendant la résolution.
  - **Analyse à charge de 1c (2026-09-24) — conclusion : la conception tient, 5 renforts, aucune objection
    bloquante.** Vérifié : (a) TOUS les chemins de la file d'annonce passent par `advanceAnnouncementQueue`
    (`socketCombatState.js:445` début d'annonce, `:561` échec de Surprise PJ, `endTurn:862`,
    `socketCombatAnnouncement.js:1085`, `skipPlayer:251`) — une seule insertion suffit ;
    `socketCombatAnnouncement.js:173` ne fait que VALIDER qui a le droit de déclarer ; (b) côté client, en
    ANNONCE le token actif ne vient que de `COMBAT_SLOT_ADVANCED` (`onSlotAdvanced`) et, à la reconnexion, du
    roster (`onStateSync`, premier non-annoncé) — un token déjà passé côté serveur n'ouvre donc aucune
    fenêtre, et `COMBAT_PHASE_CHANGED` ne fixe pas `activeTokenId` (pas de clignotement) ; (c) l'ancien
    `endTurn` sait déjà enchaîner un Tour entièrement pré-annoncé.
    Renforts : (R1) **filet si `skipPlayer` échoue** (il avale ses erreurs) : relire la ligne roster ; si le token
    n'est toujours pas `has_announced`, présenter le slot normalement — jamais une file figée en silence ;
    (R2) en RÉSOLUTION, vérifier le blocage AVANT la branche des entrées autonomes (un drone « mort » ne tire
    pas) ; (R3) message `COMBAT_TURN_SKIPPED` omis en résolution si une action `skip` existe déjà pour ce token ce
    Tour ; (R4) lignes de log `[DBG]` explicites (annonce/résolution, token, statut) — serveur bavard par
    convention ; (R5) **vrais tests d'intégration** : `combatTurnEngine.test.mjs` possède déjà un fixture de
    base réelle isolé (`createCombatFixture` : utilisateur + campagne + tokens créés puis supprimés, `skip` sans
    `DATABASE_URL`) — ajouter les cas 1c (annonce : bloqué passé et slot suivant émis ; mode `icon_only` :
    inchangé ; tous bloqués : slot présenté ; résolution : pas bloqué suivant diffusé, pas de doublon de
    message). À LANCER PAR SAAR (écrit/supprime des lignes dans sa base locale) :
    `node --env-file=.env --test server/src/socket/combatTurnEngine.test.mjs` depuis la racine.
    Limites connues, non aggravées : parité avec les gardes actuelles pour l'exo piloté (statuts lus sur le
    token de l'exo, pas sur le pilote) ; un combat composé uniquement de drones en `ordres_permanents` boucle
    déjà aujourd'hui (Tour entièrement pré-annoncé) — le garde-fou anti-boucle de 1c ne le résout pas.
  - **Lot 1c — CODÉ (2026-09-24).** Implémenté comme conçu ci-dessus : `getDeclarationBlockedTokens` +
    `hasActionableToken` + `resolveAutoSkipStatus` (interne) dans `combatTurnEngine.js` ; insertions dans
    `advanceAnnouncementQueue` (avant le test de Surprise, filet si `skipPlayer` échoue), `advanceTimeline` (avant la
    branche autonome ET pour le tour obligatoire des retardataires) ; `autoSkipResolutionStep` (message sans
    doublon) ; les 2 gardes de `socketCombatResolution.js` appellent la même fonction. **Précision de la garde
    anti-boucle** (trouvée au codage) : les drones à action `drone_auto` de ce Tour ne comptent pas comme acteurs
    — sinon « mort + drone autonome » tournerait seul. 12 tests d'intégration (`combatTurnEngine.test.mjs`) +
    1 test pur. Reste : tests base + jeu par Saar, puis commit.
  - **Constat hors périmètre 1c (2026-09-24, rapporté par la session « drones » d'après un test de Saar)** : un token
    `dead` reste CIBLE d'une arme de zone (grenade à fragmentation : « Baboulinet — Éviter la zone d'effet — Échec
    14 ») et reçoit test/fenêtre de Chance. [VÉRIFIÉ par lecture, rapporté] `queryTokensInShape`
    (`worldSpatialQueryService.js:234-264`) ne filtre ni statut ni mort ; il alimente `evaluateAoeVisibility` →
    `resolveAoeAssaultAction`. [INCONNU] le mort a-t-il aussi encaissé des dégâts (base non lue) ; tirs simples et
    interception non examinés. Le moteur de tour, lui, respecte bien `dead` (logs du même test = 1c fonctionne).
    **Règle tranchée par Saar (2026-09-24)** : le mort ne peut NI esquiver NI dépenser de point de Chance (« ça c'est
    sûr ») ; en revanche des technologies de résurrection existent → **le décompte des blessures continue jusqu'à un
    corps totalement détruit** : un cadavre reste donc cible et encaisse les dégâts (option B). Conséquence : aucun
    filtrage des cibles ; il faut retirer les fenêtres de Chance d'un mort (chantier séparé, « un plan = un problème »)
    et le décompte « jusqu'au corps détruit » dépend du Lot 2 (aujourd'hui `applyWound` avale l'erreur d'une ligne
    Mortelle pleine).
  - **Suites de « mort » demandées par Saar (2026-09-24, non codées, un plan par problème)** — *1e* : un mort ne
    reçoit AUCUNE fenêtre de Chance (esquive de zone, réduction de gravité, Catastrophe) : `resolveChanceRecipientCharacterId`
    (contrat existant « null = aucune Chance possible ») + propriété de registre. *1f* : statuts incompatibles avec un mort
    (décision Saar, « ouvert à débat ») — INTERDITS : Entravé, Déséquilibré, Étourdi/Assommé, Inconscient, Asphyxie,
    Décompression, Aveuglé, Hypothermie ; AUTORISÉS : Enflammé, Corrodé, Irradié, Saisi, Électrocuté, Infecté,
    Empoisonné (les 15 codes du panneau sont couverts). Preuve au log du test : un tir sur le token mort a lancé le test
    de Choc puis `applyStunWithDuration … stunned` sur lui. Points d'écriture des statuts : `statusService.js:40`
    (`applyStunWithDuration`), `:178` (`applyModStatus`), `socketToken.js:178` (bascule manuelle) ; test de Choc :
    `damageService.js:479/486` (`resolveTargetHit`), en amont des 7 appels de `applyStun`. Précision de Saar : le corps
    « reste là et prend des blessures », point (pas de notion de destruction à ce stade).
  - **1e/1f — décisions finales de Saar (2026-09-24) + analyse à charge.** INTERDITS sur un mort (8) : Entravé,
    Déséquilibré, Étourdi, Inconscient, Asphyxie, Aveuglé, Hypothermie, **Évanoui** ; AUTORISÉS (7) : Enflammé,
    Corrodé, Irradié, Saisi, Électrocuté, Infecté, Empoisonné, **Décompression** (donc 8 interdits / 8 autorisés, `dead`
    à part). Test de Choc ET durée d'étourdissement coupés pour un mort. **Le MJ reste libre** (bascule manuelle, formulaire
    danger/froid, `COMBAT_APPLY_STUN` : jamais refusés). À la mort, tous les statuts interdits sont RETIRÉS (+ étourdissement en
    attente de `combat_pending`). Règle active en mode `enforced` seulement. Conception : propriété de registre
    `incompatibleWithDead` (ensemble dérivé) ; `isCharacterDead`/`isTokenDead` dans `statusService.js` (autorité de « mort »,
    modèle `traits.ci` de dnd5e / immunités PF2e : la cible reste visée, seul l'effet n'est pas appliqué) ;
    `applyStunWithDuration` refuse sur un mort sauf option `force` (chemin MJ) ; `resolveTargetHit` saute le test de Choc
    (seul site : `damageService.js:479/486`) ; `applyDeathConsequences(io, db, campaignId, tokenId)` appelée par la bascule
    `dead` (et par le Lot 2 pour la blessure Mort) ; `canEditTokenStatus` reçoit `targetIsDead` (joueur non-MJ refusé) ;
    1e : `resolveChanceRecipientCharacterId` reçoit `campaignId` et renvoie `null` pour un mort (exo : mort OU pilote mort).
    Limite connue : un choix d'étourdissement DÉJÀ ouvert chez un joueur au moment de la mort reste affiché (la ligne
    `combat_pending` disparaît, la confirmation est ignorée). Ordre : commit 1c → 1e → 1f.
  - **Lot 1e — CODÉ (2026-09-24, en attente des tests Saar).** Propriété `isDeath` du registre (`DEATH_STATUS_CODES`),
    `deathStateService.js:isCharacterDead`, `resolveChanceRecipientCharacterId` reçoit `campaignId` (2ᵉ paramètre, 3
    appelants mis à jour) et renvoie `null` pour un cadavre. 4 tests d'intégration + 1 test de registre.
  - **Filet de 1a** : test pur `shared/tokenStatusRegistry.test.mjs` — chaque ensemble dérivé est comparé
    à l'ancien littéral recopié dans le test (instantané historique) ; unicité des codes ; toute
    catégorie a sa couleur ; les codes de `ENVIRONMENTAL_HAZARD_REGISTRY` sont dans le registre.
  - **Points d'édition partagés avec l'autre session (interception drones, non commitée)** :
    `socketCombatResolution.js` (hunks en 13, 424-460 ; mes gardes en 165/353 — hors zone),
    `socketCombatHelpers.js` (hunks en 4, 119-121, 2893…3690 ; mon site en 996 + un import en tête, à
    côté de leur ligne 4 → staging partiel soigné), `fr.json` (inchangé en 1a).
  - **1c (différé, hors de ce plan tant que non cadré)** — sortir un token mort de la file
    d'initiative (équivalent de « Skip Defeated »). Le champ `combat_roster.status` (`active`/`done`)
    existe mais **aucun code ne pose `done`** (`socketCombatAnnouncement.js:1027`) et
    `advanceAnnouncementQueue` compte SANS filtrer `status` (`combatTurnEngine.js:97-100`) : l'utiliser
    demande d'abord de compléter ce concept. En attendant, `dead` se comporte comme `unconscious` (tour
    passé automatiquement par la garde, comportement déjà éprouvé en jeu).
  - Vérifié : `dead` (sans `expires_at_turn`) n'est jamais purgé par `endTurn` (`combatTurnEngine.js:804`,
    `whereNotNull('expires_at_turn')`).
- **Constaté 2026-09-24 — recoupement avec la session « interception des drones » (non commitée à ce
  jour)** : elle ajoute `woundSeverityForDamage(degatsNets)` dans `shared/woundConstants.js`, lecture de
  `BLESSURE_SEUILS_TABLE` (sans la 6ᵉ ligne), pour la gravité d'un coup sur un drone. Or
  `damageService.js` (`_severityForDamage`) recopie ces mêmes seuils pour l'humain. **Au Lot 2, une seule
  autorité des seuils** : `woundSeverityForDamage` (avec la 6ᵉ ligne) sert l'humain ET le drone, et
  `_severityForDamage` disparaît. À coordonner avec le commit de l'autre session avant de toucher ce fichier.
- **Lot 2 — La 6ᵉ ligne.** Migration `chk_wounds_severity` ; `WOUND_SEVERITIES`, `WOUND_MAX_COUNTS`,
  `WOUND_PENALTIES`, `SEVERITY_COLORS` (gris), `WOUND_HEALING`, `WOUND_INFECTION`, `TEST_BLOCKING_SEVERITIES` ;
  `nextSeverity`/`previousSeverity`/`getWorstWoundSeverity` ; `resolveWoundInsertion` (débordement →
  6ᵉ ligne ou `dead`) ; `_severityForDamage` (≥ 30) ; retrait de `is_lethal` (une cinquantaine d'occurrences dans
  `socketCombatHelpers.js`, `socketCombatAoe.js`, `coldExposureService`, `environmentalHazardService`,
  `fallDamageService`, panneaux client) ; Choc via la gravité ; route manuelle ; libellés i18n.
- **Lot 3 — Chance sur la 6ᵉ ligne.** Coût 3 → Critique (§2.2) ; `computeAvailableSeverityReductions`
  ne modélise que des degrés 1-2 : prévoir une option dédiée. Décider le moment de pose de `dead` (§7).
- **Lot 4 — État permanent du membre + rendu.** Table `character_destroyed_limbs`, broadcast, barré/gris
  dans `LocationPanel` et `SilhouettePanel`. Séparable : les Lots 1-3 livrent déjà le compteur RAW complet ;
  le Lot 4 ajoute la persistance de la paralysie.

Chaque lot : plan exact présenté avant code, analyse à charge distincte, validation Saar en jeu réel pour
les comportements visibles (invariant « clôture »).

## 5. Tests attendus (`.claude/rules/blessures.md`)

Seuils exacts : 24/25, 29/30 dégâts nets ; 2ᵉ Mortelle sur tête (→ `dead`), 3ᵉ sur corps ; 2ᵉ Mortelle sur
bras/jambe (→ 6ᵉ ligne) ; ≥ 30 sur tête/corps/membre ; promotion en cascade complète ; Choc -10 sur membre
via la gravité ; Test interdit ; guérison → `critique` ; Chance à 3 points (Chance insuffisante, timeout,
refus) ; `/heal` ; pas de régression sur les 5 lignes existantes. Transport réel du payload (`WOUND_ADDED`).

## 6. Hors périmètre

- Mécaniques d'usage d'un membre détruit (arme à deux mains, etc.) : le rendu et l'état suffisent ici.
- Séquelles de Membre détruit (`sequellesConstants.js`) : déjà des tables Encyclopédie, non branchées.
- Mise à jour documentaire de clôture (Règle 10) : `SYSTEME/COMBAT.md`, `ROADMAP.md:164`, `JOURNAL8.md`,
  Encyclopédie (`blessures-seuils.json:30`), commentaires `woundConstants.js:55,85` (l'affirmation
  « règle optionnelle » n'est pas prouvée), `charStats.js:347`, `CHANGELOG.md`.

## 7. Points ouverts

1. **Mort : par token ou par personnage ?** Statuts par token, blessures par fiche
   (`clearCharacterWoundsAndStatuses` traite déjà « tous les tokens du personnage »). À trancher au Lot 1.
2. **Moment de pose de `dead` vs choix de Chance.** `applyWound` corrige la gravité *après coup*
   (`woundService.js:94-132`, choix délibéré). `dead` étant dérivé de la blessure (§3), la voie naturelle
   est : poser, puis retirer si la Chance est dépensée (la blessure 6ᵉ ligne est remplacée par une Critique).
   Coût : un instant de « mort » visible avant le choix. Alternative : différer la pose jusqu'à la réponse.
   Décision au Lot 3.
7. ~~Case masquée~~ — **tranché** (§2.4). ~~Coût Chance~~ — **tranché** (§2.2).
3. **Infection d'une Mortelle** (C5) : une fois la 6ᵉ ligne existante, réinsérer une Mortelle infectée
   *promeut* vers Mort/Membre détruit, alors que la décision du 2026-07-30 est « délai de survie affiché,
   jamais appliqué » (`woundEvolutionService.js:198`). À trancher au Lot 2.
4. **Nom de la 6ᵉ valeur** : vérifier `docs/VOCABULARY.md` avant tout nouveau concept (AGENTS.md).
5. ~~Nombre de cases de la 6ᵉ ligne du compteur papier~~ — **tranché par Saar : une seule case** (§2.4).
   Écart éventuel avec le papier non vérifié [INCONNU] : sans conséquence, la mort est binaire.
6. **Coût Chance** : confirmer « 3 points de coût → Critique » (§2.2).
