# EN COURS — Dettes actives et prochaine étape

> **Discipline obligatoire (tout agent)** : ce fichier ne contient QUE ce qui est réellement actif — dettes ouvertes, chantier en cours, points de vigilance permanents. Aucun historique de session ne s'accumule ici, jamais.
>
> À la clôture d'un chantier (✅ confirmé, ou ⚠️ clos partiel devenu confirmé sans reste à tester) :
> 1. Retirer sa ligne/son bloc de ce fichier (Dettes actives / Prochaine étape / Roadmap).
> 2. Écrire le compte-rendu détaillé (contexte, décisions, fichiers touchés, **Testé / Non testé /
>    Données / Retour arrière**) dans `docs/JOURNAL8.md`, format `## Session N (Dev) — Date — Titre`.
> 3. Ne laisser ici que ce qui reste vraiment ouvert — un `⚠️ clos partiel` (code fait, navigateur non testé) reste une ligne active tant que Saar ne l'a pas confirmé en jeu.
> 4. Le détail technique d'un bug suivi par le système de tickets vit dans `bug_tickets` (autorité
>    unique, écran `/admin/tickets`) — ne pas le dupliquer ici au-delà d'une ligne de suivi (ID,
>    description courte, priorité) pour ce qui n'y est pas encore. `docs/BUGIDENTIFIE.md` est archivé
>    (`docs/Old/`, 2026-08-12) : son contenu a été importé en base, voir `docs/SYSTEME/TICKETS.md`.
>
> Cette règle existe parce que ce fichier a grossi jusqu'à 386 Ko / 4083 lignes avant nettoyage
---

## ⚡ PROCHAINE ÉTAPE EXACTE

**TEST_CRITIQUE Lot 3** (tooltips degré + popup Réussite critique/Catastrophe) ✅ codé
(2026-08-04), **non testé en navigateur** — détail `docs/Old/PLAN_TEST_CRITIQUE.md` §11 (archivé,
Règle 10 — contenu durable transféré dans `docs/SYSTEME/COMBAT.md` §"Résolution des Tests"). Prochaine
étape : validation par Saar (tooltip au survol des badges de résultat, popup en combat et via macro).

---

🔒 En cours (Saar) : `docs/PLANS/PLAN_FICHE_HORSLIGNE.md` — fiche personnage utilisable hors
connexion. Deux tentatives précédentes abandonnées (export Excel, puis fichier HTML autonome — voir
`docs/Old/[OBSOLETE]` pour l'historique) après des défauts structurels de format/plateforme
(styles détruits, commentaires/cases à cocher/fonctions modernes mal traduits par Excel ; page web
incapable de réécrire son propre fichier sans l'API File System Access, limitée à Chrome/Edge).
Décision finale actée : transformer Enclume en PWA (`vite-plugin-pwa`, rien d'existant aujourd'hui) —
la fiche personnage vivante reste l'unique source, mise en cache pour consultation hors-ligne,
file d'écriture locale (IndexedDB) pour blessures/équipement/expérience rejouée au retour réseau,
dernier arrivé écrase (décision explicite de Saar, pas de gestion de conflit). Impression via feuille
de style dédiée. **Aucun nouveau design à produire** : le design, c'est `char_sheet` (`CharacterSheet.jsx`)
déjà existant, réutilisé tel quel (structure fonctionnelle croisée avec la fiche officielle Polaris,
aucune lacune). Analyse à charge du plan faite (2 passes) : correction actée sur la vue d'impression
(`CharacterWindow.jsx` ne monte que l'onglet actif — une vraie vue dédiée à composer, pas du CSS pur),
sur l'autorisation hors-ligne (le serveur garde ses contrôles de droits au rejeu, jamais désactivés),
et découverte que `client/src/pages/VaultCharacterPage.jsx` fournit déjà le patron de route "hors
session" réutilisable pour Lot B/D — mais uniquement pour le Coffre : creusé plus loin, aucune route
légère n'existait pour un personnage de **campagne** (seule voie d'accès à `CharacterWindow` :
`SessionPage.jsx`, session VTT complète). **Lot A fait et vérifié (2026-08-16)** : code Excel abandonné
retiré (writer/assembleur/outil, gabarit `.xlsx`, route, bouton, clés i18n, dépendances
`xlsx-populate`/`jszip` racine), migration de nettoyage MinIO `246` appliquée (objet confirmé absent).
**Lot B0 fait et vérifié (2026-08-16)** : nouvelle route `/campaigns/:campaignId/characters/:characterId/sheet`
(`CampaignCharacterSheetPage.jsx`), `isGm` calculé depuis l'appartenance réelle à la campagne (pas figé
à `false`, différence assumée avec le patron Coffre), `char-sheet.js` étend sa réponse GET avec
`character` (ajout pur). Build client + lint (zéro problème introduit) + démarrage serveur vérifiés.
`characterExportService.js` conservé pour un usage futur éventuel. **Lot B fait et vérifié
(2026-08-16)** : `vite-plugin-pwa` configuré (`client/vite.config.js`), mise en cache par préfixe
d'URL (`char-sheet`/`char-ref`/`equipment`/`campaigns`/`characters`, tracé depuis les appels réels de
`CharacterSheet.jsx` et panneaux — pas une liste figée), stratégie `NetworkFirst`. Bundle client
(~4 Mo) dépassait la limite de précache Workbox par défaut (2 Mio) — `maximumFileSizeToCacheInBytes`
relevé à 5 Mo (le vrai découpage du bundle est un chantier à part, hors périmètre). **Correction
(analyse à charge, 2e passe)** : `navigateFallback` non activé par défaut par `generateSW` (vérifié
types `workbox-build`) — sans lui, une navigation directe hors-ligne (favori, rafraîchissement) vers
une route React Router comme celle du Lot B0 échouait, rendant toute la mise en cache API inutile
(la page elle-même ne chargeait jamais). Corrigé : `navigateFallback: '/index.html'` +
`navigateFallbackDenylist: [/^\/api\//]`, vérifié présent dans le `sw.js` généré. Vérifié : build
prod (précache 6 entrées, `sw.js`/manifeste générés) + dev server (mêmes artefacts) + lint propre.
`client/.gitignore` : `dev-dist` ajouté. **Lot C fait et vérifié (2026-08-16)** : pas de file
IndexedDB maison — `workbox-background-sync` (déjà transitif via le Lot B) fait ça nativement, 5
routes `runtimeCaching` dédiées (une par action réelle : ajout/stabilisation/suppression de blessure,
équipement, achat de compétence — endpoints tracés depuis `LocationPanel.jsx`/`inventoryMutations.js`/
`SkillsPanel.jsx`), `NetworkOnly` + `backgroundSync`, rejeu FIFO au retour réseau (dégradation
gracieuse Safari/Firefox vérifiée dans le code source, pas la doc). Problème trouvé et corrigé : même
mise en file réussie, `NetworkOnly` relance toujours une erreur à la page (vérifié dans le code source
Workbox) — sans correctif, `LocationPanel.jsx` aurait affiché un faux message d'échec pour une action
équipement en réalité acceptée. Ajouté `isOfflineQueuedError()` (`client/src/lib/api.js`) pour un
message honnête à la place. Build + lint propres, dev server OK. **Non testé : navigateur réel**
(couper le réseau, agir, rétablir, confirmer le rejeu). **Lot D fait et vérifié (2026-08-16)** :
nouvelle route `/characters/:characterId/print` (`CharacterPrintPage.jsx`, indépendante de
`campaignId` — sert aussi bien un personnage de campagne que du Coffre), nouveau composant
`CharacterPrintView.jsx` composant `CharacterSheet` + panneaux Matériel l'un sous l'autre (pas le
chrome de `CharacterWindow.jsx`, qui ne monte qu'un onglet à la fois). Lecture seule via
`isGm={false}`/`isOwner={false}` — état déjà exercé (vue d'un personnage tiers en jeu), pas un
nouveau mode. Feuille de style `@media print` (`index.css`) + lien "Imprimer" câblé dans
`CharacterWindow.jsx` (pas encore sur les pages Coffre/campagne — accessible par URL directe en
attendant). Build + lint propres sur les 5 fichiers touchés.

Premier test réel par Saar (2026-08-16) sur la vue d'impression : fonctionnelle, deux retours
corrigés — (1) thème sombre illisible même à l'écran (`.print-white-theme` dans `index.css`, fond
blanc/texte noir forcés via `!important` sur toute la vue, couleurs de sévérité des blessures
explicitement préservées via `--severity-bg`, ajout pur dans `LocationPanel.jsx`) ; (2) disposition
Armure/Arme demandée en deux colonnes (`CharacterPrintView.jsx` restructuré). Build + lint propres.

**Les 5 lots du plan (A/B0/B/C/D) sont codés et vérifiés (build/lint/serveur). Reste la validation
en navigateur réel par Saar** (nouvel aperçu après ces deux correctifs, mode hors-ligne effectif,
rejeu au retour réseau) avant de considérer le chantier clos et de committer.

---

## État global

- Phase 0 ✅ / Phase 1 ✅ / Phase 2 ✅ (`PLAN_MIGRATIONS_REFONTE.md`, clos et archivé 2026-08-22)
- **Refonte complète des migrations close (2026-08-22)** : les ~260 fichiers historiques (Phase 1
  `ref_equipment` + le reste du projet) remplacés par 310 fichiers consolidés (une création + un
  seed par table, `server/src/db/migrations/`) — anciens fichiers archivés (pas supprimés,
  `server/src/db/migrations_archive/`). Nouvelle base **`enclumeBD`** (créée depuis les migrations
  seules, aucune donnée manuelle reprise sauf le compte admin et les 57 tickets de suivi de bugs) —
  `.env` de travail y pointe désormais durablement. `vtt` conservée en réserve, non supprimée.
  Validé par Saar en usage réel. Détail complet, méthode et décisions : `docs/JOURNAL8.md`
  (session de clôture), invariant durable dans `docs/SYSTEME/CORE.md`.
- Distant (Kiwi) reste sur l'ancien jeu de migrations tant qu'un déploiement n'a pas repris ce
  nouveau dossier — hors périmètre de cette session, à traiter au prochain déploiement
  (`docs/SERVEURDISTANTKIWI.md`).

---

## Dettes actives

> Détail technique des bugs suivis en base → écran admin `/admin/tickets` (`bug_tickets`,
> `docs/SYSTEME/TICKETS.md`). **Migration complète effectuée le 2026-08-22** (constat Saar : la table
> ci-dessous s'était accumulée sans jamais migrer, contrairement à l'intention documentée ici) —
> `server/src/scripts/importEnCoursDettes.js`, 75 tickets créés (idempotent par `linked_bug_code`,
> même patron que `importBugIdentifie.js`). Ce tableau ne garde plus que : (1) les dettes déjà
> résolues avec leur historique (valeur de référence, pas des tickets ouverts), et (2) 3 lignes
> explicitement exclues de la migration (décisions assumées ou tâches continues, pas des bugs).
> **Tout nouveau bug/dette va directement dans `/admin/tickets`, plus dans cette table.**

| ID | Description | Priorité |
|---|---|---|
| ~~**ELEV-PERF1**~~ | ~~`reconcileBattlemapElevators` appelé en boucle pendant un combat réel — transactions/verrous lents~~ | ✅ Résolu — cause racine : `reconcileBattlemapElevators` ouvrait une transaction + verrou pessimiste (`forUpdate` sur `battlemaps`) à chaque appel, y compris pour une carte sans aucun ascenseur (cas de `battlemap:8f8d7184-...` au moment du signalement — 0 connecteur elevator ; confirmé qu'aucune battlemap de la base n'en avait alors, tous les appelants payaient ce coût inutilement). Correctif : lecture non verrouillée + `elevatorDefinitionsFromBattlemap` avant d'entrer en transaction, retour immédiat si la liste est vide ; chemin "≥1 ascenseur" inchangé. Vérifié contre la base réelle sur les deux chemins (sans ascenseur : 9-12ms en régime stable vs 100-350ms/jusqu'à 1,3s avant ; avec ascenseur, après ajout d'un ascenseur de test sur cette même battlemap : reconciliation correcte, cabine niveau 0 porte ouverte). `server/src/services/worldElevatorService.js` |
| ~~**COM26**~~ | ~~2 munitions catalogue (`Darts 7.62mm ST - Projectile SAP`, `Flèche - Projectile IEM`) portent le DSL Assommante par erreur de copié-collé~~ | ✅ Déjà résolu (constaté 2026-08-22, revérifié en base) — les deux lignes ont un `ammo_effects` cohérent avec leur description, plus aucune trace d'Assommante. Corrigé par une session antérieure sans mise à jour de ce ticket |
| ~~**CHAT-SCROLL1**~~ | ~~Scroll infini chat construit mais pas câblé à un `IntersectionObserver`~~ | ⚠️ clos partiel Session (Saar, 2026-08-22) — sentinelle + `IntersectionObserver` câblés dans `SidebarChatTab.jsx` (`loadOlderMessages`/`hasMore`/`loadingOlder` threadés depuis `Sidebar.jsx`, un seul appel du hook), auto-scroll vers le bas corrigé pour ne plus se déclencher sur un préfixage d'historique. Détail `docs/SYSTEME/CHAT.md` §10, `docs/JOURNAL8.md`. Build/lint propres — scénario réel navigateur non testé (scroller au-delà de 50 messages, confirmer l'absence de saut visuel) |
| ~~**CSPLAYERSTAB**~~ | ~~`CampaignSettingsPage.jsx` — avertissement React mélange `background`/`backgroundColor`~~ | ✅ Déjà résolu (vérifié 2026-08-22) — `s.navItem`/`s.navItemActive` n'existent plus du tout dans ce fichier (refactor incidentel non documenté), plus aucune occurrence de `background:` |
| ~~TC1~~ | ~~`.gitattributes:3` — attribut invalide~~ | ✅ Déjà résolu (vérifié 2026-08-22, `git log` : corrigé commit `264281f`, 2026-05-10, lignes parasites retirées) |
| ~~DCO1~~ | ~~`onTokenRotate` dead code Canvas3D/Scene~~ | ✅ Déjà résolu (vérifié 2026-08-22 — confirmé aussi par `bug_tickets`/`admin_notes` : code supprimé Session 142, 2026-07-15, un mois avant l'import du ticket) |
| VX1 | `getVoxelSurfaceTop` (`Canvas3D.jsx`, preview de rendu uniquement, pas d'autorité collision — `.claude/rules/world.md`/`voxels.md`) — pas de cas slope/wedge | Très basse — **clarifié 2026-08-22** : `slope`/`wedge` sont des placeholders cube en attendant leur vraie géométrie V2 (`Voxel.jsx:47-49`, "affinement V2" jamais fait) — rendu réel = cube plein aujourd'hui, donc `getVoxelSurfaceTop` renvoie déjà la bonne valeur pour ce qui s'affiche. Rien à corriger avant que la vraie géométrie V2 existe ; les deux devront être faits ensemble |
| — | Logs debug `index.js` — conservés volontairement (décision assumée, pas un bug) | Infra |
| ~~**COM20**~~ | ~~Phase 1 : afficher arme (munitions + type)~~ | ✅ Déjà résolu (vérifié 2026-08-22, `git log`/JOURNAL6 Session 148 : ✅ CLOS 2026-07-16) — `CombatGmDeclareWindow.jsx:672-678` affiche déjà munitions/type via `weaponAmmoStatus` |
| ~~**COM21**~~ | ~~Collision tokens : deuxième bloqué~~ | ✅ Déjà résolu (marqué ✅ JOURNAL5 Session 127, 2026-06-27) — mécanisme d'origine (`isCellFree`) absorbé par la refonte du moteur monde depuis (occupation gérée par `worldSpatialQueryService.js`/`shared/world/spatialIndex.js`), fonctionnellement toujours couvert |
| ~~**WIZ6**~~ | ~~Finalisation : compétences remises à zéro — écho `WIZARD_STATE_SYNC` auto-diffusé à l'émetteur avec `skillAllocations: {}` (getStep4State), réinjecté par `openPeek`/`handleTerminate`~~ | ✅ Résolu — persistance brute `char_pc_ledger.skill_allocations`/`autodidacte_allocations` (migration 236), confirmé en navigateur par Saar (2026-08-12, triage ticket BETA-13 sur `/admin/tickets`). Détail `docs/JOURNAL8.md` |
| ~~**WIZ27**~~ | ~~`docs/BUG WIZARD.md` #18 (+ #27 dépendant) : aucun texte de tutoriel en haut de chaque étape du Wizard — textes déjà rédigés par Saar, composant `StepTutorial` restait à créer~~ | ✅ Résolu — `StepTutorial.jsx` créé, un seul point d'intégration dans `WizardCreation.jsx` (pas de duplication dans les 7 composants d'étape comme le suggérait le doc). Steps 0/1/2/3/4/5/7 couverts, confirmé en navigateur par Saar (2026-08-12, triage ticket BETA-1 sur `/admin/tickets`). Step 6 (Matériel et biens, step ajouté après la rédaction du bug #18, absent de son périmètre d'origine) reste sans texte — composant tolère l'absence de clé (rendu `null`), à compléter séparément quand Saar aura rédigé le texte. `en.json` non touché (anglais gelé). Détail `docs/JOURNAL8.md` |
| **WIZLOCK1** | 2 fiches trouvées `creation_state='complete'` mais `wizard_locked_at` jamais posé, avant le correctif d'atomicité Session 141 (suite 14) — `handleTerminate` faisait 2 appels réseau séparés (`reconcile` puis `lock`), toute coupure entre les deux laissait la fiche bloquée. Corrigé pour les finalisations futures ; dette documente seulement l'historique | Basse — historique, pas un risque actif |
| **DOC1** | `docs/VOCABULARY.md` était un squelette vide depuis sa création, jamais réellement adopté par le protocole. Peuplé Session 141 (suite 18) avec un premier seed réel — reste à enrichir au fil des sessions | Basse — enrichissement continu |
| ~~**WIZ28**~~ | ~~Wizard Coffre-native (`/vault/creation`, sans campagne) : `SESSION_JOIN` avec `campaignId` absent ne posait jamais de handler `DICE_ROLL` (`server/src/socket/index.js`, branche solo) — jets émis dans le vide par `ProAdvantagesAndSetbacks.jsx` (tirage 1D10 avantages pro / 1D100 Revers), aucun `DICE_RESULT` ne revenait jamais. Symptômes : bouton bloqué sur "Jet en cours...", pied de page affichant à tort "Il reste des tranches de Revers obligatoires à jouer" (c'est `busy`, pas un vrai Revers en attente, qui déclenche ce texte)~~ | ✅ Résolu — confirmé par Saar en navigateur (log serveur : `dice:roll — Joueur 3 : d10 = 10` puis reconcile `diffusion=step4` réussi). `DICE_ROLL` extrait dans sa propre fonction `registerDiceRollHandler` (`socketDice.js`), seule posée pour un socket solo (`index.js`) — délibérément pas le reste de `registerDiceHandlers` (`MACRO_ROLL`/`WOUND_INFECTION_ROLL`/`CHAT_MESSAGE`/`CHARACTER_UPDATED`, aucun sens hors campagne, chacun sa propre garde `campaignId` conçue pour un contexte de campagne) — évite de faire reposer un socket solo sur des gardes défensives d'autres handlers plutôt que sur une surface exposée volontairement minimale. `registerDiceHandlers` (mode campagne) rappelle `registerDiceRollHandler` en interne, comportement strictement inchangé pour ce cas |
| ~~**WIZ43**~~ | ~~Step6 Matériel — prix des objets jamais affiché~~ | ✅ Résolu Session (Saar, 2026-08-22) — affiché aux 3 endroits (`ItemRow`, catalogue, panneau de confirmation). Correction du diagnostic en cours de route : `ref_price` était déjà renvoyé par `getInventory()` pour les objets possédés, mais `GET /api/equipment` (`equipment.js:68`) ne sélectionnait pas `price` pour le catalogue/la confirmation — ajouté (ajout pur, aucun champ retiré). Build/lint propres, serveur dev rechargé sans régression. Scénario réel navigateur non testé |
| ~~**ADMIN-LOGS1**~~ | ~~Suggestion de Saar : interface admin qui affiche/mémorise les logs serveur, pour pallier l'absence d'accès SSH au serveur distant pendant un test avec le beta-testeur (motivé directement par le ticket COM-RESO1, `/admin/tickets`, injouable à diagnostiquer sans logs)~~ | ⚠️ clos partiel Session (Saar, 2026-08-22) — écran `/admin/logs` codé : `server/src/routes/adminLogs.js` (`journalctl -u <service>` via `execFile`, whitelist stricte, sortie JSON), `AdminLogsPage.jsx`. journald reste l'autorité des logs (pas de stockage dupliqué côté Node). Permission `didier`/`journalctl` confirmée en réel par Saar avant code. Détail complet `docs/JOURNAL8.md` — codé, build/lint propres, **scénario réel navigateur non testé** (tuile Admin → écran de logs) |
| ~~**INV4**~~ | ~~Playground — Revente : vend/supprime TOUJOURS le stack entier, jamais une quantité partielle~~ — **diagnostic périmé, revérifié contre le code réel (2026-08-22)** : `executeSell` (`tradeService.js:319`) appelle déjà `removeItem(offer.from_char_id, item.char_inventory_id, item.qty ?? 1, trx)` (décrément partiel, pas de `.delete()` brut) — corrigé par une session antérieure sans que ce ticket ait été mis à jour, aucune perte de données active. Reste réel trouvé : `toggleSellItem` (`TradeWindow.jsx`) figeait `qty:1` sans aucun contrôle pour proposer plus d'une unité d'un stack (contrairement au côté achat, qui a déjà `cart`/`addToCart`/`removeFromCart`) | ✅ Résolu Session (Saar, 2026-08-22) — contrôle +/- ajouté au sélecteur de revente (réutilise le patron `qtyRow`/`qtyBtn` déjà existant côté achat), plafonné par `item.quantity`, quantité affichée dans le récap d'offre. Build/lint propres (6 erreurs pré-existantes non liées confirmées par stash/lint comparatif). Scénario réel navigateur non testé |
| ~~**INV5**~~ | ~~Playground — Revente : après un achat, le nouvel objet n'apparaît pas dans l'onglet Revente tant que la fenêtre n'est pas refermée puis rouverte~~ | ✅ Déjà résolu (vérifié 2026-08-22) — `handleCheckout` (`TradeWindow.jsx:223`) appelle déjà `loadInventory()` après un achat réussi (ajouté par une session antérieure, `git log -S`, avant la refonte migrations), corrigé exactement comme le ticket le recommandait |

---

## Roadmap

Chantiers prospectifs : voir le foyer unique `docs/ROADMAP.md` (section migrée ici le 2026-08-12,
contenu fusionné là-bas pour ne plus dupliquer les dettes entre les deux documents, §10 CLAUDE.md).

---

## Points de vigilance permanents

- "La Forêt Maudite" — pas de default_battlemap_id → ne jamais utiliser pour les tests
- token.owner_id — mort → toujours character_id → characters.user_id
- socket dans dependency arrays — tout useCallback qui émet doit inclure socket (P3)
- ordre déclaration React — callback A qui appelle B doit être déclaré APRÈS B (P4)
- coordonnées voxel — données brutes en base, +0.5 uniquement dans le rendu visuel
- reconnectTrigger — ne jamais appeler socket.disconnect/connect depuis Sidebar
- PE14 pos_y/pos_z — pos_y base = Z Three.js, pos_z base = Y Three.js
- charStats.js — fonctions pures, jamais d'accès DB dans ce fichier
- redis.js — maintenance Redis dans REST (POST/DELETE), pas dans handlers WS reliques (PE25)
- resolveEntityState — returning doit inclure battlemap_id (PE26)
- collisionMoveToken — hdel systématique ancienne case, hset conditionnel layer (PE24)
- PE27 moveType — calculé client (feedback) ET recalculé serveur (validation). Si discordance → refus silencieux
- Token GM sans char_sheet → ENTITY_MOVE_REQUEST ignoré silencieusement — comportement documenté V1
- Lerp EntityMesh — useFrame dans sous-composants (pas EntityMesh parent) — règle des hooks
- DiceMesh useMemo — deps [geoDef.type, color, dieType] — dieType obligatoire pour D10 (PE32)
- D10 Html overlay — position=[0,0,0] — ne pas déplacer (PE33)
- P49 — promotion blessures : always GET /wounds si promoted === true (ne pas ajouter wound localement)
- PI11 — polarisRound : source unique `shared/polarisUtils.js` — jamais redéfini localement
- PC41 — Express 5 : routes sans `/` initial → 404 silencieux — toujours `'/:id/foo'`
- PC42 — `WHERE NOT col = 'val'` exclut les NULL en PostgreSQL → toujours `(col IS NULL OR col != 'val')`
- PC43 — `orderByRaw('CASE WHEN ? IS NOT NULL ...')` : PostgreSQL ne peut pas inférer le type UUID sans cast → éviter pour les UUID, préférer le JS post-fetch
- PC44 — `io.fetchSockets()` nécessaire quand le GM clique Agir pour un slot joueur (socket ≠ joueur)
- PC45 — `combat_actions.type` (serveur, valeur brute) ≠ `action_key` (client, clé UI) — deux colonnes distinctes, valeurs identiques pour 'melee'. Confondre les deux → 0 résultat sur les queries
- PC46 — `meleePrecheckId` dans `CombatOverlay` : `activeMeleeAction?.id ?? playerActiveMeleeAction?.id ?? null` — stable en RESOLUTION. `useEffect` doit inclure `[meleePrecheckId, socket]` — re-tourne à chaque reconnexion (SocketProvider crée nouvelle instance)
- PC47 — Nouvelle page React : ne jamais styler les boutons en inline (`style={{backgroundColor...}}`) — toujours `className="btn"`/`.btn-ghost`/`.btn-danger` (`.claude/rules/react.md`, déjà écrit, pas suivi une première fois sur `VaultPage.jsx`/`VaultCharacterPage.jsx`/`EquipmentCatalogPage.jsx`). Fond de page : comparer avec une page sœur existante (`DashboardPage.jsx` porte `className="app-shell"` — dégradé + halo animé, "réutilisable (skin Wizard)", `index.css:508`) avant d'inventer un `backgroundColor` plat — sinon la nouvelle page détonne visuellement, trouvé seulement après coup par Saar en navigateur
- PL-Q1 — `getSemanticHTML()` Quill 2.0 retourne vide — utiliser `querySelector('.ql-editor').innerHTML`
- PL-Q2 — Quill insère la toolbar comme `previousElementSibling`, pas à l'intérieur du container — guard `classList.contains('ql-container')`
- PL-Q3 — `containerRef.current` peut être null dans le cleanup React 19 — toujours capturer en variable locale en début d'effect
- PL-Q4 — `editor.destroy()` n'existe pas en Quill 2.0 public API
- P53 — nodemon auto-applique les migrations dès l'écriture du fichier + numéro "disponible" d'`EN_COURS.md` peut être obsolète (travail parallèle non resynchronisé) — détail complet dans `docs/SYSTEME/CORE.md`
- P54 — ne jamais rappeler `mig.up(knex)` manuellement sans vérifier `knex_migrations` au préalable (nodemon peut l'avoir déjà appliquée) — un second appel traite des données déjà correctes comme corrompues et peut les détruire silencieusement — détail complet dans `docs/SYSTEME/CORE.md`
- P55 — une table = une migration de création + une migration de contraintes/index + (si besoin) une migration de seed, jamais de patch empilé ; auditer par clé naturelle contre `vtt` avant de figer un seed, jamais un rejeu neuf seul comme vérité aveugle — détail complet dans `docs/SYSTEME/CORE.md`
- P56 — `node --test` sans argument parcourt aussi `migrations_archive/` et exécute ses tests obsolètes — vérifier le chemin de chaque échec avant de conclure à une régression réelle — détail complet dans `docs/SYSTEME/CORE.md`
- P56 — `DICE_RESULT` (socketDice.js) n'inclut jamais `dieType` dans son payload — tout composant qui anime un jet hors `SessionPage` doit le fournir lui-même (constante si formule fixe) sous peine de retomber sur un D6 par défaut — détail complet dans `docs/SYSTEME/DICE.md`
- PC48 — `errorHandler.js` renvoie `{ error: { status, message, i18nKey } }` (un objet, pas une string) — tout `catch` REST doit lire `err.response?.data?.error?.message`, jamais `err.response?.data?.error` seul (sinon `[object Object]` affiché au joueur, vécu INV1/INV7 2026-08-22). Corrigé dans `LocationPanel.jsx`/`InventoryPanel.jsx`/`ContainerPanel.jsx` (pattern copié depuis du code déjà buggé). **Non corrigés, trouvés en passant, hors périmètre** : `DocumentModal.jsx`, `VoxelBuilderTab.jsx`, `MaterialGeneratorTab.jsx`, `EntityBuilderTab.jsx`, `MerchantsPage.jsx`, `TexturePacksPage.jsx` (partiel), `WorkshopPage.jsx` (a un repli `err.message` qui masque le symptôme sans le corriger)
- PC49 — `creationRoundTrip.test.mjs:98` (`a8ac107b-c12e-426c-9e2a-1f162b3b3142`) code en dur un `id` de `ref_careers` qui n'existe que sur l'instance locale déjà seedée — trouvé en rejouant la chaîne complète de migrations sur une base strictement vide (Lot B `PLAN_EXOEQ_FUSION.md`, 2026-08-22) : `ref_careers` n'a pas d'`id` portable comme `ref_equipment` (48b, SEED-ID-DETERM déjà corrigé pour ce cluster). Test unique concerné, 322/323 verts sinon — non corrigé (hors périmètre de la fusion exo), mais confirme que le défaut SEED-ID-DETERM existe aussi sur `ref_careers`
