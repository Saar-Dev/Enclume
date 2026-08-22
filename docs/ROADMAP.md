# ROADMAP — Projet Enclume
> 2026-08-22 — **Rattrapage ciblé (Claude/Saar)** : deux entrées manquantes/périmées ajoutées à jour
> de session — `PLAN_FICHE_HORSLIGNE.md` (PWA fiche hors-ligne, absent de ce document jusqu'ici) sous
> "Autres chantiers immédiats", et l'entrée Exo-armures ci-dessous (§ Chantiers futurs) rafraîchie
> (Lots 1-4/2bis + A-D réellement codés depuis, périmée depuis longtemps). Le reste du document n'a
> **pas** été audité ligne à ligne cette session (RW_SYSCOMBAT/COMBATANT_CONTEXT/Sidebar notamment
> datent toujours du 2026-08-06/12) — ne pas le considérer à jour au-delà de ces deux entrées.
>
> Dernière mise à jour : 2026-08-12 — **Point de situation (Saar)**, synchronisation avec l'état réel
> du projet (dernière mise à jour datait du 2026-08-06, plusieurs chantiers avancés depuis sans y être
> reflétés). Registre de bugs migré : `docs/BUGIDENTIFIE.md` **archivé** (`docs/Old/`, 2026-08-12),
> source unique désormais la table `bug_tickets` / écran `/admin/tickets` (`docs/SYSTEME/TICKETS.md`)
> — toute référence à `BUGIDENTIFIE.md` plus bas dans ce document est obsolète. Rôle administrateur +
> page `/admin` construits et confirmés en navigateur en local (rien poussé à ce stade). Triage Wizard
> (2026-08-11/12, `docs/BUG WIZARD.md`) : une quinzaine de bugs (WIZ5 à WIZ29) codés, la plupart
> `⚠️ clos partiel` (codé, scénario réel navigateur non testé) — WIZ6/27/28/29 seuls confirmés
> fonctionnels en navigateur par Saar ; détail complet `docs/JOURNAL8.md` (sessions 2026-08-11 et
> 2026-08-12), non repris ligne à ligne ici (bugs suivis par ticket, pas chantiers prospectifs).
> **Chantier non tracé jusqu'ici, ajouté ci-dessous** : Jauges de Matériel
> (`docs/PLANS/PLAN_WIZARD_MATERIEL_GAUGES.md`) — codé de bout en bout (worktree actuel, non
> committé), non testé en navigateur ; répond partiellement à la dette "Matériel → objets réels"
> déjà listée plus bas. `docs/PLANS/PLAN_RW_SYSCOMBAT.md` a avancé au-delà du Lot 7 déjà noté plus
> bas : Lot 8a codé et testé (unitaire + diff), en attente de validation en jeu ; Lot 8b abandonné
> (absorbé par le Lot 8c après analyse à charge) ; Lot 8c codé (diff relu), en attente fixture jetable
> ET session de jeu réelle — aucune des deux faite, ne pas considérer ce lot clos.
>
> 2026-08-06 — **Revue de dépendances inter-chantiers (Saar)**, deux erreurs
> corrigées dans ce document. (1) **RW_SYSCOMBAT Lots 5-7 et COMBATANT_CONTEXT ne sont pas
> indépendants**, contrairement à ce qu'affirmait l'entrée ci-dessous : `resolveDroneAssaultAction` est
> édité par les deux (sites #4/#5 du couplage `char_sheet` chez COMBATANT_CONTEXT = exactement la
> fonction que RW_SYSCOMBAT Lot 6 restructure). Ordre correct : **RW_SYSCOMBAT 5-7 avant
> COMBATANT_CONTEXT** — greffer le dispatch exo sur une fonction qui va être réextraite juste après
> double le travail. (2) `docs/PLANS/PLAN_REFACTOR_SIDEBAR.md` (chantier actif, Lots 1-4c clos, Lot 4d
> prêt à reprendre sans blocage, Lot 5 bloqué sur une décision `Editor3D.jsx` distincte —
> `REFACTOR_GLOBAL.md` §3) manquait entièrement de ce document, ajouté ci-dessous. Trois nouveaux stubs
> pas encore intégrés à la prospective avant aujourd'hui, ajoutés ci-dessous : `PLAN_USURE&INTEGRITE.md`
> (RAW transcrit, tête de chaîne du cluster Catastrophe/Matériel), `PLAN_ARMES_SPECIALES.md` (RAW
> transcrit, dépend partiellement d'Usure/Intégrité), `PLAN_MORAL.md` (règle RAW optionnelle, aucune
> dépendance, priorité basse). Fatigue Lot 6 (Noyade/Asphyxie, `PLAN_FATIGUE_DOMMAGES.md` §12) : le
> cadrage actuel exclut explicitement le déclenchement automatique — si une Catastrophe (panne
> d'équipement de plongée via Usure/Intégrité) doit pouvoir déclencher l'état automatiquement, c'est un
> changement de périmètre du lot, pas encore tranché par Saar.
>
> 2026-08-06 — **`docs/PLANS/PLAN_COMBATANT_CONTEXT.md` créé** : cadrage complet
> du refactor attendu par EXOARM-COMBATFILE (`docs/EN_COURS.md`) — recherche externe (Lancer VTT
> `flow_api.md`, Starfinder crew skills, étend `PLAN_EXOARMURE.md` §4 sans la refaire), 7 sites
> `char_sheet` en dur recensés par lecture intégrale (pas ~8, l'estimation initiale — et 1 seul des 7
> bloque vraiment l'action, les 6 autres dégradent silencieusement vers un Seuil de 0 plutôt que de
> planter). Architecture retenue : point de couture unique `resolveCombatantTestContext` (nouveau
> `server/src/lib/combatantContextService.js`), dispatch par guard clauses (`pj`/`pnj` inchangés,
> `exo` nouveau), jamais de duplication de stats pilote↔exo. Découpage en 7 lots (A-G), Lots A-F
> migrent le chemin humain sans changement de comportement, Lot G ajoute le squelette exo (ne débloque
> pas encore EXOARM-COMBATFILE à lui seul — dépend aussi du détail RAW dans `PLAN_EXOARMURE.md` Lot 2).
>
> `docs/PLANS/PLAN_RW_SYSCOMBAT.md` **rouvert** le même jour (Lots 0-4 clos depuis le 2026-07-28,
> continuité du même chantier décidée par Saar) : Lots 5-7 planifiés (aucun code écrit) — Lot 5 dédup du
> calcul de dégâts bruts CaC (5 sites), Lot 6 découpage du branchement cible de
> `resolveDroneAssaultAction`, Lot 7 découpage du branchement post-hit de `confirmMeleeDefense`.
> Analyse à charge du Lot 5 faite : une erreur de placement corrigée (`combatAttackRoll.js`, pas
> `damageService.js` comme écrit d'abord), une dette documentaire annexe trouvée et signalée
> (`docs/SYSTEME/SERVICES_COMBAT.md` §5 décrit un fichier `mrTable.js` qui n'existe plus). **Corrigé
> 2026-08-06 (revue de dépendances) : ce chantier n'est pas distinct de `PLAN_COMBATANT_CONTEXT.md`
> ci-dessus** — Lot 6 restructure `resolveDroneAssaultAction`, exactement la fonction que
> COMBATANT_CONTEXT édite à ses sites #4/#5. À séquencer RW_SYSCOMBAT 5-7 puis COMBATANT_CONTEXT.
> 2026-08-06 — Exo-armures : Lot 1 (Fondations) ✅ codé, non testé navigateur ;
> Lot 2 (Substitution d'attributs) resserré — mouvement (VIT) ✅ codé, plafond de Compétence (Manœuvre
> d'armure) et "1 seule Attaque/Tour" **⏸️ bloqués** (dépendent d'un refactor de
> `socketCombatHelpers.js`, mis en pause, chantier séparé à planifier — détail `docs/EN_COURS.md`
> item EXOARM-COMBATFILE). En vérifiant la stockabilité de 16 armures RAW réelles contre le schéma :
> schéma `ref_exo_templates` étendu (modes de mouvement, champs descriptif/commerce) + bug trouvé et
> corrigé dans `getModDom()` (`charStats.js`, extrapolation au-delà de FOR_na 21 — affecte tous les
> personnages, pas seulement les exo-armures). Détail complet `docs/PLANS/PLAN_EXOARMURE.md` §6-§7.
> 2026-08-06 — Refonte UX Matériel (`docs/Old/PLAN_INVENTORY_UX.md`) **clôturée**,
> Étapes 0-9 confirmées fonctionnelles en navigateur par Saar. Dernier fix trouvé en clôturant : la
> zone de drop Coffre manquait côté `InventoryPanel.jsx` (seul le sens Coffre→Sac/Ceinture avait une
> cible, `useDroppable` ajoutée pour Sac/Ceinture→Coffre, Coffre toujours rendu même vide). Contenu
> durable transféré vers `docs/SYSTEME/CHARACTER.md` et `docs/ASBUILT.md`. Reste différé (suivi
> séparément ci-dessous) : retrait du `<select>` de Slot, accessibilité clavier `KeyboardSensor` à
> traiter d'abord.
> 2026-08-06 — Blessures : Guérison/Infection
> (`docs/Old/PLAN_BLESSURES_GUERISON.md`) clos, confirmé fonctionnel par Saar en navigateur ;
> contenu durable transféré vers `docs/SYSTEME/BLESSURES.md`. Chantier 11 (Module Blessures) : badges
> de statut — animation d'apparition ajoutée, confirmée fonctionnelle (détail `docs/JOURNAL8.md`).
> 2026-07-30 — Fatigue & Dommages : Lot 3 clos (Chute/Acide/Décompression/Feu,
> `docs/PLAN_FATIGUE_DOMMAGES.md` §9), confirmé fonctionnel par Saar en navigateur. Prochaine étape du
> chantier : Lot 4 (Fatigue).
> 2026-07-30 — Exo-armures : Lot 0 clos, Lot 1 rédigé et prêt à coder
> (`docs/PLAN_EXOARMURE.md`) ; entrée "Catastrophes" remplacée par le chantier formel
> `docs/PLAN_TEST_CRITIQUE.md` (cadrage en pause côté Saar).
> 2026-07-30 — précision sur "Ergonomie et pédagogie des règles" (besoin concret
> noté en tranchant `docs/Old/PLAN_BLESSURES_GUERISON.md` §8, affichage UI des règles de Guérison/Infection).
> 2026-07-29 — ajout "Membres détruits" (Option de campagne, `docs/Old/PLAN_BLESSURES_GUERISON.md`, décision Saar de différer plutôt que de trancher la modélisation en base maintenant) ; ST1 (Badges statut token) clos en correctif ponctuel (28×28px taille écran fixe), retiré de "chantier UI/UX" ; ajout "Eau structurelle authorée" (v2, décision Saar suite dette EAU1) ; 2026-07-24 — Dette INI5 (forfait Initiative CaC) close, retirée (voir `docs/EN_COURS.md` item 111) ; 2026-07-21 — Moding Groupe 4 : chantier clos (Phases 1/3/4 codées et testées, dettes résiduelles dans `docs/BUGIDENTIFIE.md`).
> Ce document est prospectif. L’historique complet est dans `docs/ASBUILT.md` et `docs/JOURNAL8.md`.
> **Bugs et dettes techniques** : voir le registre unique `bug_tickets` / écran `/admin/tickets`
> (`docs/SYSTEME/TICKETS.md`) — `docs/BUGIDENTIFIE.md` est archivé depuis le 2026-08-12.

---

## Phase 2 — Battlemap 3D + session de jeu (en cours)

### Chantier 11 — Module Blessures
- Étape 4 : Polish — animation Tests de Choc restante (apparition des badges de statut faite,
  `docs/JOURNAL8.md`) — 🔲

### Chantier `PLAN_MUTATION2.md` — Mutations & Avantages
- Lot 7 : Narratif/économie (priorité basse) — 🔲

### Options de campagne
- `revers` — 🔲
- `skill_natural_prog` — 🔲
- `celebrity` — 🔲
- Membres détruits (distinction Mortelle vs Membre détruit, `docs/Old/PLAN_BLESSURES_GUERISON.md` §3.2/§8
  — décision Saar 2026-07-29 : différé, la gravité Mortelle couvre Bras/Jambes comme Tête/Corps tant
  que cette option n'existe pas) — 🔲

### Autres chantiers immédiats
- **Jauges de Matériel & liste d'attente Wizard** (`docs/PLANS/PLAN_WIZARD_MATERIEL_GAUGES.md`, cadré
  et codé le 2026-08-12) — droits joueur sur `InventoryPanel` en Step6, validation MJ item par item,
  jauges (`char_gauges`) qui passent de calcul en lecture seule à ressource de personnage persistante
  gérée par le MJ, visible Wizard + fiche permanente (`GaugesPanel.jsx`). **Codé de bout en bout,
  non committé, non testé en navigateur** — prochaine étape : validation par Saar. Répond en partie à
  la dette "Matériel → objets réels" ci-dessous (§ Chantiers futurs) sans la clore entièrement (le
  transfert catalogue ↔ inventaire réel reste hors périmètre de ce plan, cf. son §9)
- **Fiche personnage hors-ligne (PWA)** (`docs/PLANS/PLAN_FICHE_HORSLIGNE.md`, cadré et codé
  2026-08-16) — `vite-plugin-pwa` (cache réseau-first des routes fiche/campagne/équipement),
  file d'écriture locale (`workbox-background-sync`, rejeu FIFO au retour réseau pour
  blessure/équipement/achat compétence), vue d'impression dédiée (`CharacterPrintPage.jsx`). **5 lots
  (A/B0/B/C/D) codés et vérifiés (build/lint/serveur)** — prochaine étape : validation navigateur
  réelle du mode hors-ligne effectif (couper le réseau, agir, rétablir, confirmer le rejeu) et de
  l'impression, avant de considérer le chantier clos
- Upload screenshot éditeur → MinIO — 🔲
- Jets Favoris : drag‑to‑reorder macros (UI) — 🔲
- Paramètre campagne GM entity move mode (reporté) — 🔲
- Commande de chat MJ `/healall` — réinitialise les blessures de tous les tokens du playground — 🔲
- Sprint Drones 2d — auto-announcement drone → voir `docs/Old/PLAN_DRONESYSCOMBAT.md` — 🔲
- Sprint Drones 2e — `resolveDroneAutoAction` — 🔲
- Sprint Drones 3 — Télépilotage (drone lié à PJ pilote) — 🔲
- Sprint CaC 4b — validation fonctionnelle requise avant — 🔲
- Sprint Annonce v2 — actions précédentes en lecture seule (`GmDeclareWindow` + `ActionWindow`) — 🔲
  *(migré depuis `docs/EN_COURS.md`, doublon retiré de là-bas)*
- Sprint Tooltips Compétences — `SkillsPanel` bouton ⓘ (déjà codé Session 73) — 🔲
- Sprint Waypoints — déplacement points intermédiaires (déclaration serveur, alt+clic) — 🔲
- Sprint Page Santé Serveur — `/api/health/detailed` (mémoire, uptime, températures) — 🔲
- i18n équipement/builder/dés — Lot 1 (Combat) clos, reste Lots 2-4 — voir `docs/PLAN_LOCALISATION.md`
  (norme : `docs/SYSTEME/LOCALISATION.md`) — 🔲

---

## Phase 3 — Polish + assets
- Avatars utilisateur
- Optimisation voxel face culling
- Persistance viewport caméra
- Reconnexion WebSocket
- Favicon application

---

## Chantiers futurs — à planifier
- Arts Martiaux (techniques offensives/défensives, Saisie/Lutte)
- LOS & Raycast (replanifier avec Kiwi)
- Résolution des Tests critiques/Catastrophe par marge, pas par valeur de dé (`docs/PLAN_TEST_CRITIQUE.md`,
  cadrage v1 **en pause côté Saar** — doit revenir avec la lecture RAW exacte de la table de marge
  avant de trancher) — bloque uniquement le Lot 8 (Réparation) d'Exo-armures, aucune autre dépendance
- Fatigue, Maladies/Poisons, Drogues, Irradiations, Faim/soif, dangers environnementaux (Froid/Noyade), horloge de campagne — `docs/PLANS/PLAN_FATIGUE_DOMMAGES.md`, plan en 10 lots. **Lots 0-3 clos et codés** (horloge de campagne, moteur d'échéances, Blessures/Guérison, Chute/Acide/Décompression/Feu — confirmés fonctionnels par Saar). Prochaine étape : Lot 4 (Fatigue), indépendant du reste. **Lot 6 (Noyade/Asphyxie)** cadré en détail (§12, 2026-08-06) mais **décision en attente** : le cadrage actuel exclut le déclenchement automatique (toujours volontaire, joueur/MJ) — si une Catastrophe (panne d'équipement de plongée via Usure/Intégrité, ci-dessous) doit pouvoir le déclencher, c'est un changement de périmètre à trancher avant de coder ce lot, pas juste une dépendance d'ordre
- Usure/Intégrité du matériel + Test de panne — `docs/PLANS/PLAN_USURE&INTEGRITE.md` (stub) +
  `docs/REGLES/REGLE_USURE&INTEGRITE.md` (RAW transcrit p.273-274). Justifié seul par RAW (acquisition/
  gestion d'équipement), et tête de chaîne du cluster Catastrophe/Matériel : mécanise gratuitement 3
  entrées de la table Catastrophe combat (#2 Arme inutilisable, #7 Boum si Intégrité≤0, #8 Panne) sans
  rien inventer côté RAW — à construire en premier dans ce cluster. `docs/REGLES/REGLEMATERIEL.md`
  fusionné dedans et supprimé (2026-08-06) — reste une citation obsolète non corrigée,
  `docs/PLANS/PLAN_EXOARMURE.md:64` pointe encore vers ce fichier supprimé
- Armes spéciales (fouets/chaînes, fusil à pompe, lance-flammes...) — `docs/PLANS/PLAN_ARMES_SPECIALES.md`
  (stub) + `docs/REGLES/REGLES_ARMES_SPECIALES.md` (RAW transcrit). Les mécaniques de gerbe/saisie/AoE
  sont autonomes et cadrables dès maintenant ; seule la partie "explosion si Intégrité≤0" de la
  Catastrophe #7 dépend d'Usure/Intégrité ci-dessus
- Catastrophe #1 Maladresse — décalage temporel avec `is_surprised` : vérifié contre RAW
  (`REGLESYSCOMBAT.md:186-188`) et le code (`socketCombatHelpers.js:1206-1208`) — Surprise RAW bloque
  le Tour **en cours** puis libère le suivant, Maladresse bloque le Tour **suivant** (l'inverse) — pas
  un simple alias de `is_surprised`, à cadrer (décaler la pose du flag ou statut dédié) si ce
  sous-chantier est repris. Migré depuis `docs/EN_COURS.md`
- Catastrophe #3 Mauvaise cible — cadrage numérique manquant : "la plus proche" n'a pas de rayon
  défini, Saar penche pour un tirage aléatoire parmi les cibles proches plutôt que strictement la plus
  proche au sens géométrique. `measureBattlemapTokenDistance` (`worldSpatialQueryService.js`) déjà
  confirmé réutilisable pour la mesure elle-même — reste le seuil "proche" à définir. Migré depuis
  `docs/EN_COURS.md`
- Catastrophe #5 Position désavantageuse — modificateur temporaire +5 pour toucher, durée 1 Tour
  (précisé par Saar, RAW ne donnait pas de durée explicite). Nouveau statut sibling à
  `isTargetDefenseless` (DEF5), jamais fusionné avec lui (effet RAW différent). Migré depuis
  `docs/EN_COURS.md`
- Objets au sol (nouvelle entité interactive, pour représenter un item lâché ou une arme inutilisable
  après Catastrophe #2) → Ramasser un item au sol (dépend directement du premier). Base technique
  **vérifiée réutilisable, pas juste supposée** : `SessionPage.jsx` (`handleEntityAction:476`, appelé
  en 546/1175, flux GM-direct vs arbitrage joueur via `ENTITY_ACTION_REQUEST`) →
  `socketEntity.js:64` (`ENTITY_ACTION_REQUEST` serveur), toujours actif aujourd'hui (pas mort depuis
  le rework du World Builder) — symétrique à "Interagir avec une entité"
- `Sidebar.jsx` — découpage structurel (`docs/PLANS/PLAN_REFACTOR_SIDEBAR.md`, créé 2026-08-05, Lots
  1-4c ✅ clos et confirmés. **Lot 4d** ✅ codé 2026-08-06 (extraction `SidebarChatTab.jsx` + hooks
  `useDiceBreakdownPopover`/`useSidebarPendingActionsBadge`), rendu général confirmé par Saar en
  navigateur, un seul scénario précis non rejoué (`⚠️ clos partiel`, détail dans le PLAN). **Lot 5**
  (`SurfaceEditorPanel.jsx`) bloquait sur une dépendance résolue depuis : `docs/Old/PLAN_WORLD_RUNTIME_EFFECTS_STORE.md`
  (store `worldRuntimeStore.js` + hook `useWorldRuntimeSync.js` partagés, correctif serveur de
  l'émission manquante) **clos et confirmé fonctionnel en navigateur par Saar (2026-08-06)** —
  `SurfaceEditorPanel.jsx` peut maintenant être extrait, devenu trivial (lit le store directement,
  comme `Sidebar.jsx` déjà migré). Reste à faire : l'extraction elle-même, pas encore commencée)
- Moral (règle avancée, explicitement optionnelle au RAW) — `docs/PLANS/PLAN_MORAL.md` (stub) +
  `docs/REGLES/REGLE_MORAL.md` (RAW transcrit). Aucune dépendance technique identifiée avec le reste de
  la roadmap — priorité basse, à caser selon préférence produit plutôt que contrainte
- Exo-armures (`docs/PLANS/PLAN_EXOARMURE.md`, plan en 8 lots + Lot 2bis — **entrée périmée depuis le
  2026-08-06, rafraîchie 2026-08-22** : Lots 1-4, 2bis (armure à terre + fenêtre UI dédiée
  `CombatExoActionWindow.jsx`), catalogue `ref_exo_equipment`/seed des 16 armures RAW, ainsi que
  `PLAN_COMBATANT_CONTEXT.md` Lots A-G (dispatcher `resolveCombatantTestContext`/
  `resolveExoTestContext`, Seuil de Test dérivé du pilote avec l'EXF à la place de la Force) sont
  **tous codés et testés (Node/PostgreSQL réel)**, détail complet `docs/JOURNAL8.md` (sessions
  2026-08-13 à 2026-08-20). **Aucune exo-armure jouée de bout en bout en combat réel à ce jour** —
  seul reste ouvert, suivi comme ticket `EXOARM-COMBATFILE` (`bug_tickets`) plutôt que dupliqué ici :
  validation en jeu réel (attaque CaC, initiative, prone/relever, pipeline de dégâts, plafond
  Compétence/1 attaque-tour). `PLAN_RW_SYSCOMBAT.md` Lots 5-7 (dépendance documentée ci-dessous) sont
  également clos depuis, cette dépendance n'est donc plus bloquante)
- `socketCombatHelpers.js` — découpage structurel (`docs/PLANS/PLAN_RW_SYSCOMBAT.md`, chantier créé
  2026-07-25, Lots 0-4 ✅ clos 2026-07-28 : noyau `computeAttackRoll` pur, dédup `armAwaitingDamage`,
  branchements défenseur CaC et attaquant Tir extraits en fonctions sœurs. **Rouvert 2026-08-06** :
  Lots 5-6 ✅ clos (dédup calcul dégâts bruts CaC, découpage `resolveDroneAssaultAction`). Lot 7
  ⚠️ clos partiel (`confirmMeleeDefense`, branchement post-hit) — codé, confirmé en jeu pour
  l'attaquant PNJ seulement, chemin attaquant PJ non reproductible par Saar à ce jour, couvert par
  fixture seule. **Rouvert 2026-08-11** : Lot 8 (`confirmDamage`) cadré — Lot 8a (noyau pur
  `computeAssaultRawDamage`) codé et testé (11 tests unitaires, diff relu), en attente de validation
  en jeu ; Lot 8b abandonné (absorbé par le Lot 8c après analyse à charge) ; Lot 8c (branchement cible
  drone/non-drone) codé, diff relu, **aucune fixture jetable ni session de jeu réelle faite** — ne pas
  considérer ce lot clos. **Corrigé 2026-08-06 : ce chantier est un prérequis d'Exo-armures**, pas un
  chantier indépendant — Lot 6 touche `resolveDroneAssaultAction`, la même fonction que 2 des 7 sites
  `char_sheet` de `PLAN_COMBATANT_CONTEXT.md`. À coder avant COMBATANT_CONTEXT)
- Retrait du `<select>` de Slot dans `InventoryPanel.jsx` (décision Saar 2026-08-05 : redondant une
  fois le drag & drop en place) — **différé** : nécessite d'abord un `KeyboardSensor` `@dnd-kit` pour
  ne pas régresser l'accessibilité clavier exigée par `docs/Old/PLAN_INVENTORY_UX.md` §5.5 (dnd-kit ne
  supporte actuellement que la souris/tactile dans cette interface, `PointerSensor` seul). Option
  alternative : accepter explicitement le compromis d'accessibilité si le clavier n'est pas un besoin
  réel pour ce groupe de jeu. Le `<select>` de container (Sac/Coffre) a lui été retiré 2026-08-05
  (demande directe Saar, même compromis d'accessibilité accepté pour ce select-là) — boutons
  "Sac"/"Coffre" ajoutés en compensation fonctionnelle, et une zone de drop Coffre a été ajoutée
  2026-08-06 (manquait à la clôture du chantier, `docs/ASBUILT.md`)
- Fenêtre d'affichage/édition pour une exo-armure custom du Coffre (`type='exo'`, créée via
  `VaultPage.jsx`/`vault.js` — `VaultCharacterPage.jsx` affiche aujourd'hui un placeholder, l'écran
  ("ExoWindow") n'a jamais été construit). Trouvé en clôturant le chantier illustration exo-armures
  (`docs/PLANS/PLAN_EXOARMURE.md` §15, 2026-08-21) : une exo custom hérite déjà de
  `characters.portrait_url` (upload MinIO fonctionnel, même mécanisme qu'un personnage classique) —
  rien à construire côté illustration, seulement l'écran lui-même n'existe pas pour l'afficher. Pas
  prioritaire (Saar, 2026-08-21).
- Tourelles / armes lourdes fixes (entités interactives)
- Moding Groupe 4 (slot logiciel) — chantier clos (Session 167, architecture `docs/SYSTEME/MODING.md`, Phases 1/3/4 codées et testées) ; 4 dettes résiduelles suivies via `bug_tickets`/`/admin/tickets` (`MODING4-*`) ; migration Groupe 1/2 (Phase 2) reportée (Strangler Fig)
- Ergonomie et pédagogie des règles (explication proactive des bonus/malus ; besoin concret noté
  2026-07-30 en cadrant `docs/Old/PLAN_BLESSURES_GUERISON.md` — afficher les règles de Guérison/Infection
  dans l'UI, tooltips envisagés, pas encore cadré)
- Export PDF fiche personnage
- Wizard création à deux (GM + joueur)
- Matériel → objets réels (conversion dans inventaire) — partiellement couvert par le chantier Jauges
  de Matériel ci-dessus (§ Autres chantiers immédiats), qui ne traite pas le transfert catalogue ↔
  inventaire réel lui-même
- Chat persistant (historique)
- Chat MP (messagerie privée)
- Chat multi-canal (optionnel) — idée Saar 2026-08-05 : bouton bascule "classique / multi-canal" dans
  l'onglet Profil de la Sidebar. Backend déjà prêt en partie (`chat_messages.channel_id`, `whisper`
  déjà fonctionnel) — dépend de la Phase 3/4 de `docs/PLANS/PLAN_CHAT.md` (client "conscient des
  canaux") posée d'abord. Pas obligatoire, PLAN dédié à écrire si repris. Migré depuis `docs/EN_COURS.md`
- Mode spectateur
- Sauvegarde/export carte 3D
- Battlemap 2D (illustration ou tokens sur fond 2D) — `docs/PLAN_BATTLEMAP2D.md`, plan en 4 lots, Lot 0 (cadrage) clos, aucun code
- Spotlight / bibliothèque de présentation (personnage, document, indice) — besoin identifié pendant le cadrage Battlemap 2D, plan encore à écrire
- Eau structurelle authorée (lacs, sas et calles sèches de navires, ponts d'arrimage) — nécessite un outil d'édition dédié + compilation serveur dans le `WorldSnapshot`, pas une reconstruction géométrique côté client. Option différée de la dette EAU1 (`docs/EN_COURS.md`) ; v2, décision Saar 2026-07-29 ("peut largement attendre")

---

## Hors scope V1
- Fog of war
- Webcam / audio / vidéo
- Sources lumineuses dynamiques