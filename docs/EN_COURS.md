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

🔒 En cours (Saar) : `docs/PLANS/PLAN_MIGRATIONS_REFONTE.md` Phase 1 — Lot C (bascule locale) fait
et vérifié ; reste Lot C.5 (confirmation secondaire serveur distant) + validation module Arme en
jeu par Saar avant clôture

🔒 En cours (Saar) : Coffre — refonte page `/vault` (topbar illustrée, création directe pj/drone/exo,
catalogue équipement). **Codé, testé serveur, build client propre — navigateur pas encore validé de
bout en bout** (2 passages partiels de Saar ont déjà fait remonter et corriger 3 défauts, détail
ci-dessous). Interdiction formelle actée (inchangée) : jamais réutiliser `users.role='admin'` comme
raccourci d'autorisation (`.claude/rules/core.md`, `CLAUDE.md` §13).

**Philosophie produit actée** : le Coffre est un espace personnel — le propriétaire y expérimente
librement (personnages, drone, exo), sans plafond ni coût interne. Le contrôle se fait à la
frontière, au transfert vers une campagne : le MJ cible juge (approuve/refuse), pas un flag
technique côté Coffre.

**Serveur, testé (313/313, PostgreSQL réel)** :
- `char-sheet.js` — gel `wizard_locked_at` retiré sur la branche Coffre, nouveau `req.isVaultOwner`
  (accepté sur les routes de construction : attributs/compétences/XP/sols/mutations/avantages —
  jamais sur les routes de session réelle, fatigue/quick-equip/jauge, qui restent `isGm` strict).
- `vaultService.js` — `cloneCharacterDeep` n'exige plus `creation_state==='complete'` ;
  `VAULT-REGISTRY-DRIFT1` corrigé (6 tables non couvertes par le garde-fou anti-dérive, dont
  `exo_sheet` — jamais eu d'entrée — et `char_inventory_slots`, double FK, clonage dédié) ; nouveau
  test `vaultCloneRegistry.test.mjs`.
- `vault.js` — `POST /characters` (création directe pj/drone/exo, propriétaire seule autorité).
- `charSheetService.js` — `createCompanionSheet` extraite (branchement par type auparavant dupliqué,
  jamais testé, dans `routes/characters.js`) ; nouveau test `charSheetService.test.mjs`.
- `characters.js` (`actionsRouter`) — même correctif `isVaultOwner`-like (`req.isOwner`) sur
  `PUT /:id`/`POST /:id/portrait`/`PUT /:id/token-style`/`POST /:id/glb`, jamais retouché avant :
  `CharacterWindow.jsx` (réutilisée pour le Coffre) en dépend pour renommer/décrire/uploader un
  portrait. `DELETE /:id` reste GM strict (suppression Coffre = `vault.js` uniquement).
- Bugs trouvés et corrigés au passage : `PUT /sols` et `broadcastCharacterUpdate` émettaient
  `io.to(campaign_id)` sans garde (`null` pour un Coffre) — conditionné à `campaign_id` non nul.

**Client, build+eslint propres** :
- `VaultPage.jsx` — topbar `vault.webp` (`.vault-topbar`), 4 boutons de création, clic-ligne pour
  ouvrir, tags de type (`.badge-type-*`).
- `VaultCharacterPage.jsx` (nouveau, `/vault/characters/:id`) — dispatcher par type : `drone` →
  `DroneWindow`, `exo` → message explicite (fenêtre dédiée jamais construite, gap préexistant à tout
  le projet, ticket `ARMORWINDOW-MISSING1`), `pj`/`pnj` → `CharacterWindow`.
- `EquipmentCatalogPage.jsx` (nouveau, `/equipment`) — catalogue `ref_equipment` lecture seule,
  aucun travail serveur requis, libellés repris de `ref-equipment-tool.html`.
- Skin réel de l'appli repris sur les 3 pages (`className="app-shell"`, classes `.btn`/`.btn-ghost`/
  `.btn-danger`) après un premier jet en styles inline inventés, repéré par Saar — voir PC47
  ci-dessous.

**Tickets ouverts, différés (hors périmètre Coffre)** : `COFFRE-INVROOM1` (room socket inventaire
Wizard pour un Coffre-natif jamais verrouillé), `ARMORWINDOW-MISSING1` (fenêtre exo-armure,
chantier à part).

**Reste à faire** :
- Validation navigateur complète (créer drone/exo, uploader un portrait, demander un transfert,
  catalogue équipement, revoir le style corrigé) — rien cliqué depuis les derniers correctifs.
- Enrichir la vue MJ (`listPendingRequestsForCampaign`, `vaultService.js:274-291`) d'un vrai aperçu
  de fiche avant approbation (aujourd'hui : nom/type/demandeur seulement) — optionnel, mais c'est
  désormais le seul filtre du système.

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

- Phase 0 ✅ / Phase 1 ✅ / Phase 2 en cours
- Dernière migration appliquée : **234** (`234_pending_catastrophes.js`) — détail complet et
  historique des migrations : `docs/ASBUILT.md` § Base de données
- `PLAN_MIGRATIONS_REFONTE.md` Phase 1 (2026-08-08) : 18 migrations `ref_equipment*` (48→235) +
  seed hors chaîne archivées (`server/src/db/migrations_archive/`), remplacées par 3 fichiers
  consolidés (`48_ref_equipment.js`, `48b_ref_equipment_data.js`,
  `137b_ref_equipment_archive_side_effects.js`) — schéma+données testés bit-à-bit contre `vtt`,
  `knex_migrations` réconcilié (198 lignes, 0 pending). Bascule locale confirmée ; reste la
  confirmation secondaire distant + validation module Arme en jeu avant clôture complète.

---

## Dettes actives

> Détail technique des bugs suivis en base → écran admin `/admin/tickets` (`bug_tickets`,
> `docs/SYSTEME/TICKETS.md`). Une partie des dettes ci-dessous (ex-`BUGIDENTIFIE.md`) y vit
> désormais et n'apparaît plus ici — ce tableau garde ce qui n'a pas encore migré.

| ID | Description | Priorité |
|---|---|---|
| **MONDEVALID1** | Moteur de monde (fusion Kiwi/Codex 2026-07-15, `caaf1af`, `shared/world/`, doc canonique `docs/SYSTEME/MOTEUR_MONDE.md`) : fondation active de tous les chantiers Étages/Ascenseur/Déplacement depuis — jamais validé en jeu réel sur une carte multi-étages complète (Playwright + manuel), seulement par tests Node (77+) et par l'usage indirect au fil des sessions | Moyenne — rien de cassé observé à ce jour, mais aucune validation end-to-end dédiée |
| **COM26** | 2 munitions catalogue (`Darts 7.62mm ST - Projectile SAP`, `Flèche - Projectile IEM`) portent le DSL Assommante par erreur de copié-collé — `description` et `ammo_effects` incohérents. Trouvé en corrigeant Lot B (migration 160) `docs/PLAN_ARMES_DSL.md` | Basse — à refaire lors de C1/C2 |
| **SEED-ID-DETERM** | `server/src/db/seeds/2_seed_equipment.js` laisse PostgreSQL générer l'`id` de `ref_equipment` à l'insertion (idempotence garantie par `name` seul, pas par `id`) — deux instances seedées séparément ont des `id` différents pour la même ligne. Découvert via migration 209 (`id` codé en dur valide en local, absent sur Kiwi) — invariant ajouté à `.claude/rules/core.md` pour éviter la récidive côté migrations, mais la cause à la racine (seed non-déterministe) reste non traitée : un `id` stable (dérivé de la source Excel, ex. UUID v5 sur une clé source) rendrait `id` portable comme `name` l'est déjà | Basse — pas bloquant tant que les migrations matchent par `name`, confort/robustesse à terme |
| **HORLOGE1** | Horloge de campagne (`GameTimeWidget`, Sidebar.jsx) codée pour être masquée en mode Combat et Édition (`Sidebar.jsx`, gate sur `mode`) | En attente de validation en jeu par Saar |
| EQSKILLS1 | `ref_equipment_skills` ("compétences boostées/requises") jamais consommée en jeu — seulement écrite/relue par l'API admin `routes/equipment.js`, aucun calcul ne la lit. ~~1 item (TMP II) avait une entrée erronée (`ANALYSE_EMPATHIQUE`)~~ — supprimée 2026-08-08 (Lot A `PLAN_MIGRATIONS_REFONTE.md`, décision Saar), table à 31 lignes cohérentes. Fusion avec `ref_equipment_skill_assoc` possible mais non prioritaire | Basse |
| **CHAT-SCROLL1** | Scroll infini chat construit (`loadOlderMessages`/`hasMore`, `useChatSocket.js`) mais pas câblé à un `IntersectionObserver` dans `Sidebar.jsx` — au-delà de 50 messages, l'historique le plus ancien reste inaccessible depuis l'UI. Détail `docs/SYSTEME/CHAT.md` §10 | Basse — Phase 4 `PLAN_CHAT.md` (archivé `docs/Old/`), pas commencée |
| — | "Changer le mode de tir" — non implémenté | Moyenne — sprint futur |
| DR2 | Drone : déplacement absent | Basse — sprint futur |
| **CSPLAYERSTAB** | `CampaignSettingsPage.jsx` — avertissement React (mélange `background`/`backgroundColor` entre `s.navItem`/`s.navItemActive`) sur les onglets de réglages campagne — préexistant, repéré en testant `docs/PLAN_VAULT.md` Lot 4 (onglet "Joueurs"). Cosmétique, aucun impact fonctionnel | Très basse |
| **EAU1** | Nappe d'eau ambiante `computeSurfaceWaterCells`/`WaterSheets` retirée (improvisation client hors autorité serveur, décision Saar 2026-07-29) — eau en jeu recentrée sur l'effet runtime "inondation" déjà câblé (compartiments + `runtimeEffectRegions`). Codé, tests/build/lint OK | Basse — validation en jeu par Saar avant clôture |
| **CURSEUR-DEFAUT1** | `CURSEUR.svg` (flèche) — curseur natif (`cursor: url()`, PAS overlay DOM, choix motivé par la précision du hotspot, cf. `SceneCursorOverlay.jsx`) par défaut hors combat, jamais pendant un combat (`combatStore.phase`), et jamais hors du canvas 3D (retour Sidebar au curseur système = comportement attendu, portée volontairement limitée au playground). Taille 32×29 + hotspot `7 2` (retour Saar 2026-08-08, taille initiale 40×36 jugée trop grosse vs curseur système ~32px), calculé par lecture du path source, non vérifié visuellement. Fond opaque du SVG source retiré (jugé non intentionnel). Codé, build OK | Basse — validation en jeu par Saar (précision du clic sur la pointe, taille, fond transparent voulu) avant clôture |
| **PLAN_RW_SYSCOMBAT Lot 7** | `confirmMeleeDefense` branchement post-hit codé + fixture jetable validée (10 passes) + confirmé en jeu pour l'attaquant PNJ. Chemin attaquant PJ (`resolveMeleeDefenseHitAttackerPj`) non testé en jeu (Saar ne peut pas reproduire ce cas actuellement) — reste couvert par fixture seulement. Détail `docs/JOURNAL8.md` | ⚠️ clos partiel — confirmation PJ vs PJ en attente |
| INI1 | Surprise critique (roll=1) → initiative=1 | Basse |
| INI2 | Initiative non recalculée après blessure en combat | Basse — post-REWORK-08 |
| AU1 | `useDiceAudio.js` — sons dés | Basse |
| TC1 | `.gitattributes:3` — attribut invalide | Très basse |
| VX1 | `getVoxelSurfaceTop` — pas de cas slope/wedge | Très basse |
| — | Kiwi P-SRV-5 — ports Docker non restreints | Infra |
| — | Logs debug `index.js` — conservés volontairement | Infra |
| **CS4** | Catégorie "Techniques" + liste compétences | Moyenne — Cluster O |
| **CS5** | Compétence réservée (X) : ouverture 1 XP, reste -3 | Moyenne — Cluster O |
| **MUT3** | Effets mécaniques des mutations et avantages — Lots 1-6 (attributs, résistances, armure/arme naturelle, déblocage de compétences, identité sex/is_fertile/hand_pref) ✅ clos et fonctionnels. Reste Lot 7 (Narratif/économie, priorité basse) — `docs/Old/PLAN_MUTATION2.md` (archivé, chantier clos) | Lot 7 à détailler quand Saar voudra enchaîner |
| **COM20** | Phase 1 : afficher arme (munitions + type) | Moyenne — Cluster N |
| **COM21** | Collision tokens : deuxième bloqué | Moyenne — Cluster N |
| ~~**WIZ-2**~~ | ~~Deux compteurs PC (header store vs CareersAllocator local)~~ | ⚠️ clos partiel Session (Saar, 2026-08-11) — cause racine plus large que CareersAllocator seul (Step3Mutations/Step5Advantages aussi), `getStepBudget(excludeStep)` corrigé, `docs/BUG WIZARD.md` #4 — codé, scénario réel navigateur non testé |
| **WIZ-3** | Formation "apprentissage_technique" → choix de spécialité non implémenté | Moyenne — COUCHE 4c |
| ~~**WIZ6**~~ | ~~Finalisation : compétences remises à zéro — écho `WIZARD_STATE_SYNC` auto-diffusé à l'émetteur avec `skillAllocations: {}` (getStep4State), réinjecté par `openPeek`/`handleTerminate`~~ | ✅ Résolu — persistance brute `char_pc_ledger.skill_allocations`/`autodidacte_allocations` (migration 236), confirmé en navigateur par Saar (2026-08-12, triage ticket BETA-13 sur `/admin/tickets`). Détail `docs/JOURNAL8.md` |
| ~~**WIZ7**~~ | ~~Étape 7 : l'âge progresse à chaque test sans jamais régresser — `char_archetype.age` stocke l'âge final, `getStep4State` le renvoyait comme âge de base, cumul à chaque réhydratation~~ | ⚠️ clos partiel Session (Saar, 2026-08-11) — colonne `base_age` séparée (migration 237), détail `docs/JOURNAL8.md` — codé, scénario réel navigateur non testé ; personnages déjà en cours de création non réparés rétroactivement (`base_age` NULL → repli 16) |
| ~~**WIZ8**~~ | ~~Audit round-trip suite à la question de Saar sur l'architecture : `getStep3State`/`getStep5State` ne renvoyaient pas `mutationsMeta`/`advantagesMeta`/`pcNet`, consommés par `WizardReview.jsx` (Récap) et `creationStore.js` (budget PC) — effacés dès le premier écho `WIZARD_STATE_SYNC` (même mécanisme que #3). `getStep4State` manquait aussi `finalAge` (régression que le fix WIZ7 aurait introduite seule)~~ | ⚠️ clos partiel Session (Saar, 2026-08-11) — 4 champs ajoutés, requêtes vérifiées contre des fiches réelles en base (pas seulement lues statiquement), détail `docs/JOURNAL8.md` — codé, scénario réel navigateur non testé |
| ~~**WIZ27**~~ | ~~`docs/BUG WIZARD.md` #18 (+ #27 dépendant) : aucun texte de tutoriel en haut de chaque étape du Wizard — textes déjà rédigés par Saar, composant `StepTutorial` restait à créer~~ | ✅ Résolu — `StepTutorial.jsx` créé, un seul point d'intégration dans `WizardCreation.jsx` (pas de duplication dans les 7 composants d'étape comme le suggérait le doc). Steps 0/1/2/3/4/5/7 couverts, confirmé en navigateur par Saar (2026-08-12, triage ticket BETA-1 sur `/admin/tickets`). Step 6 (Matériel et biens, step ajouté après la rédaction du bug #18, absent de son périmètre d'origine) reste sans texte — composant tolère l'absence de clé (rendu `null`), à compléter séparément quand Saar aura rédigé le texte. `en.json` non touché (anglais gelé). Détail `docs/JOURNAL8.md` |
| ~~**WIZ22**~~ | ~~Step4 Profession : le bloc informatif "Compétences professionnelles" (métier survolé, pas forcément ajouté) et la grille "Répartition des points de compétence" (reflète les métiers réellement ajoutés) coexistaient sur le même écran, alors qu'ils peuvent porter sur des métiers différents — confusion signalée par Saar via capture d'écran (Sous-marinier survolé, grille reflétant Soldat/Milicien, seul ajouté)~~ | ⚠️ clos partiel Session (Saar, 2026-08-11) — **premier jet erroné** (suppression pure du bloc "Compétences professionnelles", perte de l'aperçu avant ajout — repéré par Saar en test réel via capture d'écran, écran vide sur un métier sans compétences au choix). Corrigé : bloc réintégré, conditionné à `!isAdded` (`CareersAllocator.jsx`) — visible tant que le métier n'est pas ajouté (rien d'autre ne le montre), masqué une fois ajouté (la grille prend le relais, en interactif). `groupedSkills`, CSS `.wiz4-groups`/`.wiz4-chips`/`.wiz4-chip`, clé i18n `career_skills_pro` restaurés. ESLint clean, build client OK — codé, scénario réel navigateur non testé |
| **WIZ-ROUNDTRIP-DEPWARN** | `server/src/services/creationRoundTrip.test.mjs` révèle un `DeprecationWarning` pg ("client already executing a query") lors du bloc STEP5 de `reconcileCreation` — `addAdvantage` lance un `Promise.all` de plusieurs requêtes sur la même transaction (connexion unique), pattern présent ailleurs dans `creationService.js`/`advantageService.js`. Aucune erreur, résultats corrects (test vert), mais deviendra un throw en pg 9 | Basse — pas bloquant aujourd'hui, refactor du pattern `Promise.all(trx(...))` à prévoir avant une future montée de version pg |
| ~~**WIZ13**~~ | ~~`select * from char_sheet where id = $1 ... invalid input syntax for type uuid: "null"` — puis reproduit précisément par Saar : Étape 1, "Suivant" → "Fiche introuvable" sur un NOUVEAU personnage. Cause racine trouvée grâce au log `[DBG-WIZNULL]` (WIZ13 1re passe) : l'effet "Hygiène de navigation" (`WizardCreation.jsx`) testait `isGmView` seul pour détecter "MJ qui revient de consulter le brouillon d'un autre" — mais `isGmView` a un double sens depuis l'ajout du rôle de campagne dans `startCreation` (commentaire déjà présent dans le code, jamais répercuté sur cet effet). Un MJ démarrant SON PROPRE personnage obtient aussi `isGmView=true`, déclenchant `resetCreation()` juste après la création de la fiche — `sheetId` effacé avant même que l'Étape 1 soumette~~ | ⚠️ clos partiel Session (Saar, 2026-08-11) — condition remplacée par `ownerUserId !== user.id` (`ownerUserId` n'a qu'un seul sens : propriétaire du dernier brouillon chargé via `loadExistingSheet`, jamais posé par `startCreation`) — distingue sans ambiguïté les deux cas. Garde-fou serveur (`resolveSheetAccess`, 1re passe) conservé en profondeur. ESLint clean, build client OK — codé, scénario réel navigateur non testé |
| ~~**WIZ12**~~ | ~~`docs/BUG WIZARD.md` #16 : `ref_advantages.name` contenait des termes anglais non traduits entre parenthèses (« Sens diminué (hearing) », « Faiblesse naturelle (drug) », etc.), affichés directement par `Step5Advantages.jsx` et `AdvantagesPanel.jsx` (aucune indirection i18n)~~ | ⚠️ clos partiel Session (Saar, 2026-08-11) — migration 239 : 14 lignes corrigées (vue/ouïe/odorat/toucher/goût, maladie, drogue) ; poison/radiation laissés (mots identiques en FR, RAW). Re-scan complet `name`+`description` : plus aucun résiduel. Suite 220/220 — codé, scénario réel navigateur non testé |
| ~~**WIZ11**~~ | ~~`docs/BUG WIZARD.md` #13/#14 : diffusion live vers le MJ (`Step4Experience.jsx`, sous-étape Avantages & Revers) — `useEffect` de diffusion appelait `buildPayload()` sans lister `proAdvantages`/`randomPicks` dans ses deps (liste manuellement dupliquée, non vérifiable par ESLint contre le corps réel de la fonction)~~ | ⚠️ clos partiel Session (Saar, 2026-08-11) — `buildPayload` passé en `useCallback` (sa propre liste de deps, vérifiable par lint), effet réduit à `[buildPayload, onLiveChange]` — élimine la classe de bug (dérive silencieuse à chaque futur champ ajouté), pas seulement l'instance. `npx eslint` : warning `react-hooks/exhaustive-deps` disparu, build client OK — codé, scénario réel navigateur (MJ observateur) non testé |
| ~~**WIZ10**~~ | ~~`docs/BUG WIZARD.md` #12 : mutation "Parasite" ("Lancez 1D4" — `REGLE_MUTATION.md:179`) n'avait aucun jet pour déterminer le nombre de parasites, ni en tirage aléatoire ni en achat délibéré~~ | ⚠️ clos partiel Session (Saar, 2026-08-11) — migration 238 : réutilise le mécanisme sous-type déjà en place pour "Caractère génétique animal" (même construction RAW "Lancez 1D4", mutation_id 6) — 4 sous-types "1 à 4 parasites" ajoutés en donnée, `has_subtable=true`. Zéro code client/serveur modifié (rollOneMutation, modal d'achat, getStep3State, WizardReview.jsx déjà génériques). Vérifié en base (GET /mutations + round-trip getStep3State réel), suite 220/220 — codé, scénario réel navigateur non testé |
| ~~**WIZ9**~~ | ~~`docs/BUG WIZARD.md` #7 : Playground — compétences à prérequis SKILL_MIN (marqueur † LdB p.190, 84 lignes réelles dans `ref_skill_requirements`) achetables sans vérification quand `settings.skill_prerequisites` est à `false`. Le mécanisme lui-même (route `POST /skills/buy`, `SkillsPanel.jsx`) était déjà correct et cohérent client/serveur — seul le défaut du schéma (`false`) contredisait le LdB, qui présente le prérequis comme la règle "NÉCESSAIRE (OPTIONNEL)", donc active par défaut~~ | ⚠️ clos partiel Session (Saar, 2026-08-11) — `SETTINGS_SCHEMA.skill_prerequisites.default` → `true` (`campaignSettingsService.js`), campagne réelle « La Forêt Maudite » (settings JSONB déjà explicite à `false`) basculée manuellement à `true` en base — sinon le défaut du schéma ne l'aurait pas atteinte. Suite 220/220 verte. Non testé : achat réel d'une compétence gated en mode Progression navigateur |
| **CAR1** | Mécanisme "au choix" (`conditional:true`) non implémenté — 34 occurrences lots 2-6 | Moyenne — Step4 UI |
| **CAR2** | `ref_background_skills.skill_id` sans FK vers `ref_skills.id` (même défaut que `ref_career_skills` avant migration 111) | Basse — pas de bug connu, préventif |
| **CAR3** | Prérequis carrières (espion, soldat_elite_*, officier_militaire_souterrain, etc.) non insérés dans `ref_career_prerequisites` | Moyenne — migration dédiée post lots 2-6 |
| **DBG-C1** | `character.user_id` null quand GM crée pour joueur absent (steps 1-3) | Moyenne — sprint futur |
| **OPT-W1** | 3/11 options de campagne (revers, skill_natural_prog, celebrity) sans effet mécanique branché — `ambiance` ✅ Session 132 suite, `random_mutations` ✅ Session 136, `feminin_bonus` ✅ Session 137, `random_pro_advantages`/`skill_prerequisites` ✅ Session 141, `skill_max_level` ✅ Session 141 (suite 2), `young_penalty` ✅ Session 141 (suite 4), `polaris_latent` ✅ Session 141 (suite 6) | Moyenne — en cours un par un |
| **OPT-W2** | `style={}` visuel dans les 7 fichiers `client/src/components/campaignSettings/*` (convention CSS) | Basse |
| ~~**MUT1**~~ | ~~`Purulence` (`mutation_id` 30) — `cost_pc = -2` en base, incohérent avec la convention positive des autres mutations "Désavantage" (Difformités) ; `Step3Mutations.jsx:254` (`cost_pc >= 0`) pourrait l'exclure de la liste achetable~~ | ⚠️ clos partiel Session (Saar, 2026-08-11) — confirmé réel (pas juste Purulence : Organe sensoriel manquant aussi), corrigé `docs/BUG WIZARD.md` #2 — codé, scénario réel navigateur non testé |
| **ADV3** | Bénéfices de carrière débloquant l'accès à une compétence (mutation/compétence "développée automatiquement" via tirage) — non géré, aucun câblage vers `char_skills`/`char_mutations` | Moyenne — roadmap Session 141 suite 12 |
| **WIZ4** | `Step4Experience.jsx` — le mini-stepper (`isClickable`) ne revalide jamais les blocages durs de la sous-step quittée (ex. retirer sa seule carrière puis cliquer directement sur une sous-step déjà "reachable"). Filet serveur (`reconcileCreation` STEP4) empêche toute donnée invalide persistée — juste un rejet tardif au lieu d'un blocage immédiat | Basse — architecture navigation mini-stepper |
| **WIZLOCK1** | 2 fiches trouvées `creation_state='complete'` mais `wizard_locked_at` jamais posé, avant le correctif d'atomicité Session 141 (suite 14) — `handleTerminate` faisait 2 appels réseau séparés (`reconcile` puis `lock`), toute coupure entre les deux laissait la fiche bloquée. Corrigé pour les finalisations futures ; dette documente seulement l'historique | Basse — historique, pas un risque actif |
| **DOC1** | `docs/VOCABULARY.md` était un squelette vide depuis sa création, jamais réellement adopté par le protocole. Peuplé Session 141 (suite 18) avec un premier seed réel — reste à enrichir au fil des sessions | Basse — enrichissement continu |
| **DOC2** | `docs/SYSTEME/REGLES_LdB.md` — dump brut d'extraction LdB, encodage mojibake par endroits, mal placé selon `RegleDocumentaire.md` Règle 8 (devrait être dans `REGLES/`), doublon probable avec `docs/REGLES/REGLESYSCOMBAT.md`. Bandeau d'avertissement ajouté ; vérification/déplacement à faire en session dédiée | Basse — session dédiée à planifier |
| **GEOM1** | `docs/PLAN_GEOMETRIE.md` (Rampe/Slope/Porte, Atelier du GM) jamais codé, obsolète depuis le nouveau builder (Kiwi) selon Saar — **question posée à Codex** : des fragments (recherche `THREE.ExtrudeGeometry`/`UVGenerator`, décisions d'architecture) sont-ils réutilisables avant archivage/suppression du plan ? Archiver vers `docs/Old/` ou supprimer dès réponse de Codex (Session 149) | En attente réponse Codex |
| ~~**INI4**~~ | ~~`initiative` jamais remise à `base_ini` en fin de tour~~ | ⚠️ clos partiel Session 166 (Saar), item 96 — codé, scénario réel navigateur non testé |
| ~~**INI5**~~ | ~~CaC : forfait Initiative de déclaration (-3/-5) doublon sans base RAW avec le décalage de phase~~ | ⚠️ clos partiel Session 176 (Saar), item 111 — audit tranché, retiré, scénario réel navigateur non testé |
| ~~**COM24**~~ | ~~Bonus "deux armes" (+3 CaC) déconnecté de l'arme réellement déclarée~~ | ⚠️ clos partiel Session 176 (Saar), item 112 — codé (mécanisme complet, miroir Tir), scénario réel navigateur non testé |
| ~~**MELEE-MR**~~ | ~~Dégâts CaC calculés sans le MR (dette Session 67)~~ | ⚠️ clos partiel Session 166 (Saar), item 97 — codé, scénario réel navigateur non testé |
| ~~**DEF5**~~ | ~~« Cible sans défense » (+5, pas d'opposition) absent en tir ET en CaC~~ | ⚠️ clos partiel Session 166 (Saar), item 98 — codé, scénario réel navigateur non testé ; tir de drone non couvert |
| ~~**SURPRISE1**~~ | ~~`is_surprised` jamais remis à `false` après `COMBAT_START`~~ | ⚠️ clos partiel Session 176 (Saar), item 110 — codé, scénario réel navigateur non testé |
| ~~**TIRIMP**~~ | ~~Garde serveur absent sur « Tir impossible »~~ | ⚠️ clos partiel Session 166 (Saar), item 99 — codé, scénario réel navigateur non testé |
| ~~**WNDMORT**~~ | ~~Malus blessure « mortelle » codé -20 fixe au lieu de bloquer les Tests~~ | ⚠️ clos partiel Session 166 (Saar), item 100 — codé, scénario réel navigateur non testé |
| **WNDMORT-UI** | Fenêtre de déclaration sans repli visuel pour Blessure mortelle — le serveur rejette déjà, l'UI ne prévient pas avant. Détail `BUGIDENTIFIE.md` | ⚠️ clos partiel — Session (Saar, 2026-08-01, décision Saar : validé) : bandeau d'avertissement + tuiles grisées codés, scénario réel navigateur non testé |
| **WNDMORT-HORSCOMBAT** | Test générique hors-combat (`socketEntity.js`) non gardé pour Blessure mortelle. Détail `BUGIDENTIFIE.md` | ⚠️ clos partiel — Session (Saar, 2026-08-01, décision Saar : bandeau centré) : garde + bandeau centré codés, scénario réel navigateur non testé |
| **EXOARM-COMBATFILE** | Chantier Exo-armures (`docs/PLANS/PLAN_EXOARMURE.md`) Lot 1 codé (non testé navigateur). `docs/Old/PLAN_COMBATANT_CONTEXT.md` (Lots A-G) ✅ intégralement clos. **Lots 2/2bis/3 intégralement codés (2026-08-18/19)** : plafond de Compétence, routage confirmation défense, Armure à terre (`resolveExoStandUpAction`, migration `249`, fenêtre dédiée `CombatExoActionWindow.jsx` joueur+MJ), Initiative (`min(Réaction, Manœuvre d'armure) − malus`, `COMBAT_START`) — seuil différé volontairement non géré (décision Saar). Même bug de routage (type/propriétaire brut de la fiche exo au lieu du pilote effectif) trouvé et corrigé 3 fois de suite (défense, permission de déclaration, Surprise/`is_pnj`) : à surveiller sur tout futur site touchant un exo. **Bug bloquant trouvé en testant (`openSheet`, `SessionPage.jsx`, aucun `case 'exo'`) → corrigé (2026-08-19)** : nouvelle fenêtre fiche standalone `ExoSheetWindow.jsx` (même patron que `DroneWindow.jsx`), découpée en onglets/panneaux comme `CharacterWindow.jsx` — un onglet par bloc de la fiche RAW officielle. Onglets **Identité** (Pilote, Modèle, EXF/BLD/RD dérivés via `computeExoStats`), **Intégrité** (3 jauges Structure/Exosquelette/Générateur) et **Bio/Réglages** (portrait, description, notes MJ, propriétaire, GLB, Coffre, suppression — champs `characters` génériques, aucune route nouvelle) câblés, nouvelle route `GET /api/exo-templates` (aucune liste n'existait). Onglets Avaries/Systèmes/Ordinateur restent en stub explicite par décision (2026-08-19, RAW vérifié `REGLEARMURE.md:303-468`) : Avaries/Incidents est un sous-système complet à seuils + jet de localisation + malus cumulatif + réparation, jamais instruit (Lot 5) ; Systèmes dépend de `hardpoints`/`equipped_systems` (Lot 5e, §8.4) ; Ordinateur n'a aucune colonne en base. Câbler l'un d'eux exige d'abord une session de planification dédiée à ce Lot, pas un sous-produit du découpage de fenêtre. Ceci referme le gap déjà connu ailleurs sous le nom `ARMORWINDOW-MISSING1`. Détail complet `docs/JOURNAL8.md`. Reste la validation en jeu réel (**`ref_exo_templates` toujours à 0 ligne** — aucun modèle seedé, blocage indépendant du code) : Lots 2/2bis/3 au complet, les 2 branches "terrain instable défenseur" déjà en attente, et les onglets exo restants. Token du pilote pendant qu'il pilote (`MANUEL_EXOARMURE.md` §6.3) reste géré à la table par décision actée, aucune mécanique serveur prévue | En attente — validation jeu réel (nécessite au moins un `ref_exo_templates` seedé) |
| **ETATSPERS-LOT2C** | `combat_roster.state_position`/`state_weapon` non retirées — `entry` (`socketCombatAnnouncement.js:139`, coût d'Initiative + validation Tir Visé) toujours lu directement depuis `combat_roster`, pas encore migré vers `characterStateService`. Détail `docs/SYSTEME/ETATS_PERSONNAGE.md` | Basse — différé volontairement (Codex/Kiwi hors projet, plus d'urgence fusion) ; clôture alignée sur `docs/PLANS/PLAN_RW_TOKEN.md` (Phase 7) quand ce chantier reprendra |
| **CATASTROPHE-L1** | Catastrophe automatique en combat — chantier arrêté après le moteur (décision Saar 2026-08-06, `docs/Old/PLAN_CATASTROPHE_RISK.md`, archivé) : jet 1D10 + validation MJ codés et testés (8 tests Node, PostgreSQL réel), les 10 conséquences restent définitivement narratives (MJ applique à la main, aucune mécanisation prévue). Scénario réel navigateur non testé (déclenchement en combat, fenêtre `CatastropheReviewQueue.jsx`, resync MJ à la reconnexion) | ⚠️ clos partiel — validation navigateur par Saar |
| **SECU-EMAIL1** | Le serveur de déploiement actuel n'a aucune mécanique d'envoi d'email — bloque toute fonctionnalité qui en dépendrait (vérification d'adresse à l'inscription, notification de blocage SECU-1, reset de mot de passe par email). Signalé par Saar 2026-08-07, hors périmètre du correctif SECU-1 en cours | Basse — infra manquante, à noter pour plus tard |
| ~~**WIZ28**~~ | ~~Wizard Coffre-native (`/vault/creation`, sans campagne) : `SESSION_JOIN` avec `campaignId` absent ne posait jamais de handler `DICE_ROLL` (`server/src/socket/index.js`, branche solo) — jets émis dans le vide par `ProAdvantagesAndSetbacks.jsx` (tirage 1D10 avantages pro / 1D100 Revers), aucun `DICE_RESULT` ne revenait jamais. Symptômes : bouton bloqué sur "Jet en cours...", pied de page affichant à tort "Il reste des tranches de Revers obligatoires à jouer" (c'est `busy`, pas un vrai Revers en attente, qui déclenche ce texte)~~ | ✅ Résolu — confirmé par Saar en navigateur (log serveur : `dice:roll — Joueur 3 : d10 = 10` puis reconcile `diffusion=step4` réussi). `DICE_ROLL` extrait dans sa propre fonction `registerDiceRollHandler` (`socketDice.js`), seule posée pour un socket solo (`index.js`) — délibérément pas le reste de `registerDiceHandlers` (`MACRO_ROLL`/`WOUND_INFECTION_ROLL`/`CHAT_MESSAGE`/`CHARACTER_UPDATED`, aucun sens hors campagne, chacun sa propre garde `campaignId` conçue pour un contexte de campagne) — évite de faire reposer un socket solo sur des gardes défensives d'autres handlers plutôt que sur une surface exposée volontairement minimale. `registerDiceHandlers` (mode campagne) rappelle `registerDiceRollHandler` en interne, comportement strictement inchangé pour ce cas |
| **WIZ29** | Wizard Step4 "Avantages & Revers" : écran blanc (React démonte l'arbre sur exception non catchée) puis retour à l'étape 0, signalé par Saar en testant une carrière à 5 ans (Marchand puis Cultivateur) — cause du plantage non identifiée en lecture statique (`blockCount`/`career.years`/`setbackBlockCount` sains dans ce scénario). Pas de repro fiable ni de stack trace disponible | En attente — filet `WizardStepErrorBoundary.jsx` posé autour du corps des étapes (`WizardCreation.jsx`, `key={step}`) pour logger `[DBG-WIZCRASH]` avec la stack complète au prochain plantage au lieu de l'écran blanc, sans rien réinitialiser côté store — reste à reproduire en navigateur par Saar pour lire la vraie cause |
| **EXOARM-MULTIADV1** | `atkEnemyType`/`defEnemyType` (comptage multi-adversaires, `socketCombatHelpers.js`, `resolveMeleeAction`) : `character.type === 'pj' ? 'pnj' : 'pj'` traite tout personnage `type='exo'` comme `'pj'` par défaut de code (jamais `'pnj'`), pas par décision — faux si le pilote est un PNJ. Trouvé en codant `PLAN_COMBATANT_CONTEXT.md` Lot G, hors périmètre de ce plan (question d'allégeance, pas de résolution de Test) | Basse — aucune exo-armure réelle en jeu à ce jour, à trancher avec `PLAN_EXOARMURE.md` Lot 2 |

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
- P56 — `DICE_RESULT` (socketDice.js) n'inclut jamais `dieType` dans son payload — tout composant qui anime un jet hors `SessionPage` doit le fournir lui-même (constante si formule fixe) sous peine de retomber sur un D6 par défaut — détail complet dans `docs/SYSTEME/DICE.md`
