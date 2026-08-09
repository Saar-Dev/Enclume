# EN COURS — Dettes actives et prochaine étape

> **Discipline obligatoire (tout agent)** : ce fichier ne contient QUE ce qui est réellement actif — dettes ouvertes, chantier en cours, points de vigilance permanents. Aucun historique de session ne s'accumule ici, jamais.
>
> À la clôture d'un chantier (✅ confirmé, ou ⚠️ clos partiel devenu confirmé sans reste à tester) :
> 1. Retirer sa ligne/son bloc de ce fichier (Dettes actives / Prochaine étape / Roadmap).
> 2. Écrire le compte-rendu détaillé (contexte, décisions, fichiers touchés, **Testé / Non testé /
>    Données / Retour arrière**) dans `docs/JOURNAL8.md`, format `## Session N (Dev) — Date — Titre`.
> 3. Ne laisser ici que ce qui reste vraiment ouvert — un `⚠️ clos partiel` (code fait, navigateur non testé) reste une ligne active tant que Saar ne l'a pas confirmé en jeu.
> 4. Le détail technique d'un bug reste dans `docs/BUGIDENTIFIE.md` (autorité unique) — ne pas le dupliquer ici au-delà d'une ligne de suivi (ID, description courte, priorité).
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

> Détail technique de chaque bug → [`docs/BUGIDENTIFIE.md`](BUGIDENTIFIE.md)

| ID | Description | Priorité |
|---|---|---|
| **MONDEVALID1** | Moteur de monde (fusion Kiwi/Codex 2026-07-15, `caaf1af`, `shared/world/`, doc canonique `docs/SYSTEME/MOTEUR_MONDE.md`) : fondation active de tous les chantiers Étages/Ascenseur/Déplacement depuis — jamais validé en jeu réel sur une carte multi-étages complète (Playwright + manuel), seulement par tests Node (77+) et par l'usage indirect au fil des sessions | Moyenne — rien de cassé observé à ce jour, mais aucune validation end-to-end dédiée |
| **COM26** | 2 munitions catalogue (`Darts 7.62mm ST - Projectile SAP`, `Flèche - Projectile IEM`) portent le DSL Assommante par erreur de copié-collé — `description` et `ammo_effects` incohérents. Trouvé en corrigeant Lot B (migration 160) `docs/PLAN_ARMES_DSL.md` | Basse — à refaire lors de C1/C2 |
| **SEED-ID-DETERM** | `server/src/db/seeds/2_seed_equipment.js` laisse PostgreSQL générer l'`id` de `ref_equipment` à l'insertion (idempotence garantie par `name` seul, pas par `id`) — deux instances seedées séparément ont des `id` différents pour la même ligne. Découvert via migration 209 (`id` codé en dur valide en local, absent sur Kiwi) — invariant ajouté à `.claude/rules/core.md` pour éviter la récidive côté migrations, mais la cause à la racine (seed non-déterministe) reste non traitée : un `id` stable (dérivé de la source Excel, ex. UUID v5 sur une clé source) rendrait `id` portable comme `name` l'est déjà | Basse — pas bloquant tant que les migrations matchent par `name`, confort/robustesse à terme |
| **ASCENSEUR1** | World builder : fenêtre de propriétés d'un ascenseur s'ouvre puis se ferme aussitôt (spécifique ascenseur, pas porte/échelle). Suspendu — non reproductible au moment du signalement suivant, détail `docs/BUGIDENTIFIE.md` | En attente d'une nouvelle occurrence |
| **HORLOGE1** | Horloge de campagne (`GameTimeWidget`, Sidebar.jsx) codée pour être masquée en mode Combat et Édition (`Sidebar.jsx`, gate sur `mode`) | En attente de validation en jeu par Saar |
| **HORLOGE-TEST1** | `adjustGameTime` (Lot 1, `gameTimeService.js`) sans aucun test automatisé — seule la projection pure `shared/gameTime.js` est testée, trouvé en analyse à charge avant le Lot 2, détail `docs/BUGIDENTIFIE.md` | À faire avant/pendant le Lot 2 |
| EQSKILLS1 | `ref_equipment_skills` ("compétences boostées/requises") jamais consommée en jeu — seulement écrite/relue par l'API admin `routes/equipment.js`, aucun calcul ne la lit. ~~1 item (TMP II) avait une entrée erronée (`ANALYSE_EMPATHIQUE`)~~ — supprimée 2026-08-08 (Lot A `PLAN_MIGRATIONS_REFONTE.md`, décision Saar), table à 31 lignes cohérentes. Fusion avec `ref_equipment_skill_assoc` possible mais non prioritaire | Basse |
| **CHAT-SCROLL1** | Scroll infini chat construit (`loadOlderMessages`/`hasMore`, `useChatSocket.js`) mais pas câblé à un `IntersectionObserver` dans `Sidebar.jsx` — au-delà de 50 messages, l'historique le plus ancien reste inaccessible depuis l'UI. Détail `docs/SYSTEME/CHAT.md` §10 | Basse — Phase 4 `PLAN_CHAT.md` (archivé `docs/Old/`), pas commencée |
| COM27 | CaC multi-attaque : jet de défense semble se lancer avant le jet d'attaque — mécanisme causal identifié 2026-08-05 (`broadcastCurrentSubPhase` émet `COMBAT_TIMELINE_UPDATED` avant le flush du `DICE_RESULT` d'attaque, bandeau MJ `CombatOverlay.jsx:275` réagit en premier), `[HYPOTHÈSE forte]` non instrumentée, détail `docs/BUGIDENTIFIE.md` | En attente de décision Saar (coder le correctif ou attendre confirmation) |
| FEAT4 | Aura de portée CaC (3m + allonge arme) autour du personnage actif | Basse — sprint futur |
| — | "Changer le mode de tir" — non implémenté | Moyenne — sprint futur |
| — | Sprint Annonce v2 — actions en lecture seule | Moyenne — sprint futur |
| DR2 | Drone : déplacement absent | Basse — sprint futur |
| **CSPLAYERSTAB** | `CampaignSettingsPage.jsx` — avertissement React (mélange `background`/`backgroundColor` entre `s.navItem`/`s.navItemActive`) sur les onglets de réglages campagne — préexistant, repéré en testant `docs/PLAN_VAULT.md` Lot 4 (onglet "Joueurs"). Cosmétique, aucun impact fonctionnel | Très basse |
| **CHARSTORE-NULLISH1** | `characterStore.js:15` — `?? false` mort après un `===` (ESLint `no-constant-binary-expression`), préexistant, repéré en clôturant CHARMODAL-DEAD1. Détail `docs/BUGIDENTIFIE.md` | Très basse — cosmétique lint, aucun impact fonctionnel |
| **EAU1** | Nappe d'eau ambiante `computeSurfaceWaterCells`/`WaterSheets` retirée (improvisation client hors autorité serveur, décision Saar 2026-07-29) — eau en jeu recentrée sur l'effet runtime "inondation" déjà câblé (compartiments + `runtimeEffectRegions`). Codé, tests/build/lint OK | Basse — validation en jeu par Saar avant clôture |
| **CURSEUR-DEFAUT1** | `CURSEUR.svg` (flèche) — curseur natif (`cursor: url()`, PAS overlay DOM, choix motivé par la précision du hotspot, cf. `SceneCursorOverlay.jsx`) par défaut hors combat, jamais pendant un combat (`combatStore.phase`), et jamais hors du canvas 3D (retour Sidebar au curseur système = comportement attendu, portée volontairement limitée au playground). Taille 32×29 + hotspot `7 2` (retour Saar 2026-08-08, taille initiale 40×36 jugée trop grosse vs curseur système ~32px), calculé par lecture du path source, non vérifié visuellement. Fond opaque du SVG source retiré (jugé non intentionnel). Codé, build OK | Basse — validation en jeu par Saar (précision du clic sur la pointe, taille, fond transparent voulu) avant clôture |
| **DEPLACEMENT3** | Latence résiduelle ~0,5-1s au premier "Déplacement" après un déplacement validé — confirme la piste notée dans DEPLACEMENT1 (`runtime_revision` bump sur simple déplacement de token invalide aussi le cache structurel) | Très basse — "rien de gênant" (Saar) |
| **TOURTRANSITION1** | Latence + message "En attente de {{nom}}" en chaînant plusieurs actions de PNJ (`CombatActionWindow.jsx:772-782`) — non instrumenté | Très basse — "rien de gênant" (Saar) |
| **PLAN_RW_SYSCOMBAT Lot 7** | `confirmMeleeDefense` branchement post-hit codé + fixture jetable validée (10 passes) + confirmé en jeu pour l'attaquant PNJ. Chemin attaquant PJ (`resolveMeleeDefenseHitAttackerPj`) non testé en jeu (Saar ne peut pas reproduire ce cas actuellement) — reste couvert par fixture seulement. Détail `docs/JOURNAL8.md` | ⚠️ clos partiel — confirmation PJ vs PJ en attente |
| **ANNONCE-PRECHECK-STALE1** | "Action non autorisée dans cet état de combat (phase:ANNOUNCEMENT, sous-état:?)" en fin de combat — pattern déjà connu (JOURNAL5) potentiellement pas entièrement corrigé, `[HYPOTHÈSE]` non instrumentée. Détail `docs/BUGIDENTIFIE.md` | Basse — repro précise à obtenir de Saar avant d'instrumenter |
| **CATASTROPHE-SCOPE1** | Une Catastrophe semble affecter deux protagonistes au lieu du seul lanceur de dé — `[INCONNU]`, hypothèse la plus probable : deux jets de Catastrophe indépendants (attaquant+défenseur) mal présentés dans la file MJ, pas un vrai partage d'effet. Détail `docs/BUGIDENTIFIE.md` | Basse — investigation dédiée, hors périmètre RW_SYSCOMBAT |
| INI1 | Surprise critique (roll=1) → initiative=1 | Basse |
| INI2 | Initiative non recalculée après blessure en combat | Basse — post-REWORK-08 |
| AU1 | `useDiceAudio.js` — sons dés | Basse |
| TC1 | `.gitattributes:3` — attribut invalide | Très basse |
| DCO1 | `onTokenRotate` dead code Canvas3D/Scene | Très basse |
| VX1 | `getVoxelSurfaceTop` — pas de cas slope/wedge | Très basse |
| — | Kiwi P-SRV-5 — ports Docker non restreints | Infra |
| — | Logs debug `index.js` — conservés volontairement | Infra |
| **CS4** | Catégorie "Techniques" + liste compétences | Moyenne — Cluster O |
| **CS5** | Compétence réservée (X) : ouverture 1 XP, reste -3 | Moyenne — Cluster O |
| **MUT3** | Effets mécaniques des mutations et avantages — Lots 1-6 (attributs, résistances, armure/arme naturelle, déblocage de compétences, identité sex/is_fertile/hand_pref) ✅ clos et fonctionnels. Reste Lot 7 (Narratif/économie, priorité basse) — `docs/Old/PLAN_MUTATION2.md` (archivé, chantier clos) | Lot 7 à détailler quand Saar voudra enchaîner |
| **COM20** | Phase 1 : afficher arme (munitions + type) | Moyenne — Cluster N |
| **COM21** | Collision tokens : deuxième bloqué | Moyenne — Cluster N |
| **UI2** | Alignement dés | Basse — Cluster Q |
| **UI3** | Dé 100 : affichage chat | Basse — Cluster Q |
| **WIZ-2** | Deux compteurs PC (header store vs CareersAllocator local) | Basse — cosmétique |
| **WIZ-3** | Formation "apprentissage_technique" → choix de spécialité non implémenté | Moyenne — COUCHE 4c |
| **CAR1** | Mécanisme "au choix" (`conditional:true`) non implémenté — 34 occurrences lots 2-6 | Moyenne — Step4 UI |
| **CAR2** | `ref_background_skills.skill_id` sans FK vers `ref_skills.id` (même défaut que `ref_career_skills` avant migration 111) | Basse — pas de bug connu, préventif |
| **CAR3** | Prérequis carrières (espion, soldat_elite_*, officier_militaire_souterrain, etc.) non insérés dans `ref_career_prerequisites` | Moyenne — migration dédiée post lots 2-6 |
| **DBG-C1** | `character.user_id` null quand GM crée pour joueur absent (steps 1-3) | Moyenne — sprint futur |
| **OPT-W1** | 3/11 options de campagne (revers, skill_natural_prog, celebrity) sans effet mécanique branché — `ambiance` ✅ Session 132 suite, `random_mutations` ✅ Session 136, `feminin_bonus` ✅ Session 137, `random_pro_advantages`/`skill_prerequisites` ✅ Session 141, `skill_max_level` ✅ Session 141 (suite 2), `young_penalty` ✅ Session 141 (suite 4), `polaris_latent` ✅ Session 141 (suite 6) | Moyenne — en cours un par un |
| **OPT-W2** | `style={}` visuel dans les 7 fichiers `client/src/components/campaignSettings/*` (convention CSS) | Basse |
| **MUT1** | `Purulence` (`mutation_id` 30) — `cost_pc = -2` en base, incohérent avec la convention positive des autres mutations "Désavantage" (Difformités) ; `Step3Mutations.jsx:254` (`cost_pc >= 0`) pourrait l'exclure de la liste achetable | Basse — à investiguer |
| **ADV3** | Bénéfices de carrière débloquant l'accès à une compétence (mutation/compétence "développée automatiquement" via tirage) — non géré, aucun câblage vers `char_skills`/`char_mutations` | Moyenne — roadmap Session 141 suite 12 |
| **WIZ4** | `Step4Experience.jsx` — le mini-stepper (`isClickable`) ne revalide jamais les blocages durs de la sous-step quittée (ex. retirer sa seule carrière puis cliquer directement sur une sous-step déjà "reachable"). Filet serveur (`reconcileCreation` STEP4) empêche toute donnée invalide persistée — juste un rejet tardif au lieu d'un blocage immédiat | Basse — architecture navigation mini-stepper |
| **WIZLOCK1** | 2 fiches trouvées `creation_state='complete'` mais `wizard_locked_at` jamais posé, avant le correctif d'atomicité Session 141 (suite 14) — `handleTerminate` faisait 2 appels réseau séparés (`reconcile` puis `lock`), toute coupure entre les deux laissait la fiche bloquée. Corrigé pour les finalisations futures ; dette documente seulement l'historique | Basse — historique, pas un risque actif |
| **DOC1** | `docs/VOCABULARY.md` était un squelette vide depuis sa création, jamais réellement adopté par le protocole. Peuplé Session 141 (suite 18) avec un premier seed réel — reste à enrichir au fil des sessions | Basse — enrichissement continu |
| **DOC2** | `docs/SYSTEME/REGLES_LdB.md` — dump brut d'extraction LdB, encodage mojibake par endroits, mal placé selon `RegleDocumentaire.md` Règle 8 (devrait être dans `REGLES/`), doublon probable avec `docs/REGLES/REGLESYSCOMBAT.md`. Bandeau d'avertissement ajouté ; vérification/déplacement à faire en session dédiée | Basse — session dédiée à planifier |
| **GEOM1** | `docs/PLAN_GEOMETRIE.md` (Rampe/Slope/Porte, Atelier du GM) jamais codé, obsolète depuis le nouveau builder (Kiwi) selon Saar — **question posée à Codex** : des fragments (recherche `THREE.ExtrudeGeometry`/`UVGenerator`, décisions d'architecture) sont-ils réutilisables avant archivage/suppression du plan ? Archiver vers `docs/Old/` ou supprimer dès réponse de Codex (Session 149) | En attente réponse Codex |
| ~~**INI4**~~ | ~~`initiative` jamais remise à `base_ini` en fin de tour~~ | ⚠️ clos partiel Session 166 (Saar), item 96 — codé, scénario réel navigateur non testé |
| ~~**INI5**~~ | ~~CaC : forfait Initiative de déclaration (-3/-5) doublon sans base RAW avec le décalage de phase~~ | ⚠️ clos partiel Session 176 (Saar), item 111 — audit tranché, retiré, scénario réel navigateur non testé |
| ~~**COM24**~~ | ~~Bonus "deux armes" (+3 CaC) déconnecté de l'arme réellement déclarée~~ | ⚠️ clos partiel Session 176 (Saar), item 112 — codé (mécanisme complet, miroir Tir), scénario réel navigateur non testé |
| **RELOAD-INHAND** | `resolveReload` (weapon_inv_id fourni) ne vérifie pas `char_inventory_slots` — trouvé en clôturant MELEE-INHAND. Détail `docs/BUGIDENTIFIE.md` | Très basse — impact quasi nul, Tir exige déjà l'en-main |
| **ASSAULT-CATEGORY** | Tir : aucune vérification de catégorie sur l'arme, contrairement au CaC — trouvé en clôturant ASSAULT-INHAND-RESOLUTION. Détail `docs/BUGIDENTIFIE.md` | Basse — comportement historique, décision Saar à prendre |
| ~~**MELEE-MR**~~ | ~~Dégâts CaC calculés sans le MR (dette Session 67)~~ | ⚠️ clos partiel Session 166 (Saar), item 97 — codé, scénario réel navigateur non testé |
| ~~**DEF5**~~ | ~~« Cible sans défense » (+5, pas d'opposition) absent en tir ET en CaC~~ | ⚠️ clos partiel Session 166 (Saar), item 98 — codé, scénario réel navigateur non testé ; tir de drone non couvert |
| ~~**SURPRISE1**~~ | ~~`is_surprised` jamais remis à `false` après `COMBAT_START`~~ | ⚠️ clos partiel Session 176 (Saar), item 110 — codé, scénario réel navigateur non testé |
| ~~**TIRIMP**~~ | ~~Garde serveur absent sur « Tir impossible »~~ | ⚠️ clos partiel Session 166 (Saar), item 99 — codé, scénario réel navigateur non testé |
| **COUVERTURE_TOTALE** | « Couverture totale » (tir) n'existe nulle part, ni client ni serveur — trouvé en clôturant TIRIMP. Détail `BUGIDENTIFIE.md` | Basse — à regrouper avec le futur chantier Tir en aveugle |
| ~~**WNDMORT**~~ | ~~Malus blessure « mortelle » codé -20 fixe au lieu de bloquer les Tests~~ | ⚠️ clos partiel Session 166 (Saar), item 100 — codé, scénario réel navigateur non testé |
| **WNDMORT-UI** | Fenêtre de déclaration sans repli visuel pour Blessure mortelle — le serveur rejette déjà, l'UI ne prévient pas avant. Détail `BUGIDENTIFIE.md` | ⚠️ clos partiel — Session (Saar, 2026-08-01, décision Saar : validé) : bandeau d'avertissement + tuiles grisées codés, scénario réel navigateur non testé |
| **WNDMORT-HORSCOMBAT** | Test générique hors-combat (`socketEntity.js`) non gardé pour Blessure mortelle. Détail `BUGIDENTIFIE.md` | ⚠️ clos partiel — Session (Saar, 2026-08-01, décision Saar : bandeau centré) : garde + bandeau centré codés, scénario réel navigateur non testé |
| **EXOARM-COMBATFILE** | Chantier Exo-armures (`docs/PLANS/PLAN_EXOARMURE.md`) Lot 1 codé (non testé navigateur), Lot 2 resserré : mouvement (VIT) codé, plafond de Compétence (Manœuvre d'armure) et "1 seule Attaque/Tour" bloqués — `socketCombatHelpers.js` fait 7 fetchs `char_sheet` directs (pas ~8, recompté), avec garde bloquante pour un pilote d'exo (pas les drones — vérifié, `resolveDroneAssaultAction` ne passe jamais par `char_sheet`, `drone_programs.level` sert directement de Seuil, correctif de cette ligne). Refactor planifié : `docs/PLANS/PLAN_COMBATANT_CONTEXT.md` (2026-08-06, Lots A-G, recherche Lancer/Starfinder) | Planifié, prêt à coder (Lot A) |
| **ETATSPERS-LOT2C** | `combat_roster.state_position`/`state_weapon` non retirées — `entry` (`socketCombatAnnouncement.js:139`, coût d'Initiative + validation Tir Visé) toujours lu directement depuis `combat_roster`, pas encore migré vers `characterStateService`. Détail `docs/SYSTEME/ETATS_PERSONNAGE.md` | Basse — différé volontairement (Codex/Kiwi hors projet, plus d'urgence fusion) ; clôture alignée sur `docs/PLANS/PLAN_RW_TOKEN.md` (Phase 7) quand ce chantier reprendra |
| **CATASTROPHE-L1** | Catastrophe automatique en combat — chantier arrêté après le moteur (décision Saar 2026-08-06, `docs/Old/PLAN_CATASTROPHE_RISK.md`, archivé) : jet 1D10 + validation MJ codés et testés (8 tests Node, PostgreSQL réel), les 10 conséquences restent définitivement narratives (MJ applique à la main, aucune mécanisation prévue). Scénario réel navigateur non testé (déclenchement en combat, fenêtre `CatastropheReviewQueue.jsx`, resync MJ à la reconnexion) | ⚠️ clos partiel — validation navigateur par Saar |
| **SECU-EMAIL1** | Le serveur de déploiement actuel n'a aucune mécanique d'envoi d'email — bloque toute fonctionnalité qui en dépendrait (vérification d'adresse à l'inscription, notification de blocage SECU-1, reset de mot de passe par email). Signalé par Saar 2026-08-07, hors périmètre du correctif SECU-1 en cours | Basse — infra manquante, à noter pour plus tard |

---

## Roadmap

- **Sprint Drones 2d** — auto-announcement drone → voir `docs/Old/PLAN_DRONESYSCOMBAT.md`
- **Sprint Drones 2e** — resolveDroneAutoAction
- **Sprint Drones 3** — Télépilotage (drone lié à PJ pilote)
- **Sprint CaC 4b** — validation fonctionnelle requise avant
- **Sprint Annonce v2** — actions précédentes en lecture seule (GmDeclareWindow + ActionWindow)
- **Sprint Tooltips Compétences** — SkillsPanel bouton ⓘ (déjà codé Session 73)
- **Sprint Waypoints** — déplacement points intermédiaires (déclaration serveur, alt+clic)
- **Sprint Page Santé Serveur** — `/api/health/detailed` (mémoire, uptime, températures)
- **D2 Jets Favoris** — drag-to-reorder macros (sort_order UI)
- **i18n équipement/builder/dés** — Lot 1 (Combat) clos item 108, reste Lots 2-4, voir
  `docs/PLAN_LOCALISATION.md` (norme : `docs/SYSTEME/LOCALISATION.md`)
- **Usure/Intégrité du matériel + Test de panne** — idée Saar 2026-08-06, née de l'analyse
  préliminaire post-clôture de `docs/Old/PLAN_CATASTROPHE_RISK.md` (§ ci-dessous). RAW complet et déjà
  transcrit : `docs/REGLES/REGLE_USURE&INTEGRITE.md` p.273-274 (Intégrité 0-25, malus par palier,
  Test de panne 1D20 sous l'Intégrité, **et surtout : sur une Catastrophe au Test de panne, l'objet
  perd 1D6 ITG et s'arrête de fonctionner jusqu'à réparation par un technicien expert — "une arme peut
  même exploser" si Intégrité ≤ 0**). Cette mécanique RAW existante unifie nativement 3 entrées de la
  table Catastrophe combat plutôt que de les traiter séparément : #2 Arme inutilisable, #7 Boum
  (explosion si ITG≤0), #8 Panne d'un système — construire ce chantier EN PREMIER rendrait les 3
  mécanisables sans rien inventer côté RAW, contrairement à l'hypothèse initiale d'un "Échec critique
  maison" pour #8. Plan stub déjà créé par Saar : `docs/PLANS/PLAN_USURE&INTEGRITE.md`. **Doublon de
  documentation résolu (2026-08-06)** : `REGLEMATERIEL.md` et `REGLE_USURE&INTEGRITE.md` fusionnés en
  un seul document (`REGLE_USURE&INTEGRITE.md`, doublons/sections mêlées de l'extraction PDF
  recomposés) — `REGLEMATERIEL.md` supprimé, citations mises à jour dans `SYSTEME/INDEX.md`,
  `SYSTEME/COMBAT.md`, `MANUELS/MANUEL_EXOARMURE.md`. **Restent à mettre à jour, hors worktree** :
  `docs/PLANS/PLAN_EXOARMURE.md:64` cite encore `REGLEMATERIEL.md` — fichier activement modifié par
  l'autre agent, non touché ici, à signaler.
- **Catastrophe #1 Maladresse — décalage temporel avec `is_surprised`** — vérifié contre RAW
  (`REGLESYSCOMBAT.md:186-188`) et le code (`socketCombatHelpers.js:1206-1208`) : Surprise RAW bloque
  le Tour **en cours** puis libère le suivant, Maladresse bloque le Tour **suivant** (l'inverse) — pas
  un simple alias de `is_surprised`, à cadrer (décaler la pose du flag ou statut dédié) si ce
  sous-chantier est repris.
- **Catastrophe #3 Mauvaise cible** — cadrage numérique manquant : "la plus proche" n'a pas de rayon
  défini, et Saar penche pour un tirage aléatoire parmi les cibles proches plutôt que strictement la
  plus proche au sens géométrique. `measureBattlemapTokenDistance` (`worldSpatialQueryService.js`)
  déjà confirmé réutilisable pour la mesure elle-même (analyse à charge `PLAN_CATASTROPHE_RISK.md`
  §9.5) — reste le seuil "proche" à définir.
- **Catastrophe #5 Position désavantageuse** — modificateur temporaire +5 pour toucher, durée 1 Tour
  (précisé par Saar, RAW ne donnait pas de durée explicite). Nouveau statut sibling à `isTargetDefenseless`
  (DEF5), jamais fusionné avec lui (effet RAW différent — voir analyse à charge `PLAN_CATASTROPHE_RISK.md`
  §9.3).
- **Catastrophe #7 Boum / armes spéciales / grenades** — dépend du chantier Usure/Intégrité ci-dessus
  pour la partie "explosion si Intégrité ≤ 0". Plan stub déjà créé par Saar :
  `docs/PLANS/PLAN_ARMES_SPECIALES.md` (pointe vers `docs/REGLES/REGLES_ARMES_SPECIALES.md`, pas encore lu).
- **Objets au sol** (chantier neuf, pas de plan existant) — un item d'inventaire peut se retrouver au
  sol sur la battlemap, volontairement (drag&drop ou bouton "lâcher") ou involontairement (Catastrophe
  #2). Nécessite une nouvelle Entité Interactive (apparence 3D/token générique, à concevoir) pour le
  représenter dans le monde.
- **Ramasser un item au sol** (dépend d'"Objets au sol" ci-dessus) — symétrique à "Interagir avec une
  entité", **vérifié toujours actif aujourd'hui** (pas mort depuis le rework du World Builder) :
  `SessionPage.jsx` (`handleEntityAction:476`, appelé en 546/1175, flux GM-direct vs arbitrage joueur
  via `ENTITY_ACTION_REQUEST`) → `socketEntity.js:64` (`ENTITY_ACTION_REQUEST` serveur). Base technique
  réutilisable confirmée, pas juste supposée.
- **Chat multi-canal (optionnel)** — idée Saar 2026-08-05 : bouton bascule "classique / multi-canal"
  dans l'onglet Profil de la Sidebar. Backend déjà prêt pour partie (`chat_messages.channel_id`,
  `whisper` déjà fonctionnel) — dépend de la Phase 3/4 de `docs/PLANS/PLAN_CHAT.md` (client
  "conscient des canaux") posée d'abord. Pas obligatoire, PLAN dédié à écrire si repris.

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
- PL-Q1 — `getSemanticHTML()` Quill 2.0 retourne vide — utiliser `querySelector('.ql-editor').innerHTML`
- PL-Q2 — Quill insère la toolbar comme `previousElementSibling`, pas à l'intérieur du container — guard `classList.contains('ql-container')`
- PL-Q3 — `containerRef.current` peut être null dans le cleanup React 19 — toujours capturer en variable locale en début d'effect
- PL-Q4 — `editor.destroy()` n'existe pas en Quill 2.0 public API
- P53 — nodemon auto-applique les migrations dès l'écriture du fichier + numéro "disponible" d'`EN_COURS.md` peut être obsolète (travail parallèle non resynchronisé) — détail complet dans `docs/SYSTEME/CORE.md`
- P54 — ne jamais rappeler `mig.up(knex)` manuellement sans vérifier `knex_migrations` au préalable (nodemon peut l'avoir déjà appliquée) — un second appel traite des données déjà correctes comme corrompues et peut les détruire silencieusement — détail complet dans `docs/SYSTEME/CORE.md`
- P56 — `DICE_RESULT` (socketDice.js) n'inclut jamais `dieType` dans son payload — tout composant qui anime un jet hors `SessionPage` doit le fournir lui-même (constante si formule fixe) sous peine de retomber sur un D6 par défaut — détail complet dans `docs/SYSTEME/DICE.md`
