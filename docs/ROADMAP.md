# ROADMAP — Projet Enclume
> Dernière mise à jour : 2026-08-06 — **Revue de dépendances inter-chantiers (Saar)**, deux erreurs
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
> **Bugs et dettes techniques** : voir le registre unique `docs/BUGIDENTIFIE.md`.

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
- Upload screenshot éditeur → MinIO — 🔲
- Jets Favoris : drag‑to‑reorder macros (UI) — 🔲
- Paramètre campagne GM entity move mode (reporté) — 🔲
- Commande de chat MJ `/healall` — réinitialise les blessures de tous les tokens du playground — 🔲

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
  fusionné dedans et supprimé (2026-08-06)
- Armes spéciales (fouets/chaînes, fusil à pompe, lance-flammes...) — `docs/PLANS/PLAN_ARMES_SPECIALES.md`
  (stub) + `docs/REGLES/REGLES_ARMES_SPECIALES.md` (RAW transcrit). Les mécaniques de gerbe/saisie/AoE
  sont autonomes et cadrables dès maintenant ; seule la partie "explosion si Intégrité≤0" de la
  Catastrophe #7 dépend d'Usure/Intégrité ci-dessus
- Objets au sol (nouvelle entité interactive, pour représenter un item lâché ou une arme inutilisable
  après Catastrophe #2) → Ramasser un item au sol (dépend directement du premier). Dépend de la
  confirmation que la pose libre d'entité (`docs/SYSTEME/ENTITES.md`, palette éditeur) est toujours
  fonctionnelle après la refonte du moteur monde — aucun bug ouvert ni route morte trouvés en vérifiant
  le code (2026-08-06), mais non testé en navigateur ; vérification rapide à faire avant de cadrer ce
  chantier
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
- Exo-armures (`docs/PLANS/PLAN_EXOARMURE.md`, plan en 8 lots + Lot 2bis, Lot 0 cadrage clos — **Lot 1
  (Fondations) ✅ codé, non testé navigateur** ; **Lot 2 (Substitution d'attributs) resserré** :
  mouvement (VIT) ✅ codé, plafond de Compétence + "1 seule Attaque/Tour" ⏸️ bloqués en attendant le
  refactor du couplage `char_sheet` en dur dans `socketCombatHelpers.js` — **désormais cadré**,
  `docs/PLANS/PLAN_COMBATANT_CONTEXT.md` (2026-08-06, Lots A-G, prêt à coder). **Corrigé 2026-08-06** :
  dépend de `docs/PLANS/PLAN_RW_SYSCOMBAT.md` Lots 5-7 (voir ci-dessous, `resolveDroneAssaultAction`
  partagée) — coder RW_SYSCOMBAT 5-7 d'abord, COMBATANT_CONTEXT ensuite, sinon le dispatch exo est écrit
  contre du code que RW_SYSCOMBAT va réextraire juste après ; voir EXOARM-COMBATFILE `docs/EN_COURS.md` ;
  Lot 3 défini mais pas encore rédigé en détail ; indépendants de `PLAN_TEST_CRITIQUE.md`, seul le Lot 8
  en dépend)
- `socketCombatHelpers.js` — découpage structurel (`docs/PLANS/PLAN_RW_SYSCOMBAT.md`, chantier créé
  2026-07-25, Lots 0-4 ✅ clos 2026-07-28 : noyau `computeAttackRoll` pur, dédup `armAwaitingDamage`,
  branchements défenseur CaC et attaquant Tir extraits en fonctions sœurs. **Rouvert 2026-08-06** :
  Lots 5-7 planifiés, aucun code écrit — dédup calcul dégâts bruts CaC (5 sites), découpage
  `resolveDroneAssaultAction` (branchement cible) et `confirmMeleeDefense` (branchement post-hit).
  Lot 8 (`confirmDamage`, jamais traité) identifié mais pas encore cadré. **Corrigé 2026-08-06 : ce
  chantier est un prérequis d'Exo-armures**, pas un chantier indépendant — Lot 6 touche
  `resolveDroneAssaultAction`, la même fonction que 2 des 7 sites `char_sheet` de
  `PLAN_COMBATANT_CONTEXT.md`. À coder avant COMBATANT_CONTEXT)
- Retrait du `<select>` de Slot dans `InventoryPanel.jsx` (décision Saar 2026-08-05 : redondant une
  fois le drag & drop en place) — **différé** : nécessite d'abord un `KeyboardSensor` `@dnd-kit` pour
  ne pas régresser l'accessibilité clavier exigée par `docs/Old/PLAN_INVENTORY_UX.md` §5.5 (dnd-kit ne
  supporte actuellement que la souris/tactile dans cette interface, `PointerSensor` seul). Option
  alternative : accepter explicitement le compromis d'accessibilité si le clavier n'est pas un besoin
  réel pour ce groupe de jeu. Le `<select>` de container (Sac/Coffre) a lui été retiré 2026-08-05
  (demande directe Saar, même compromis d'accessibilité accepté pour ce select-là) — boutons
  "Sac"/"Coffre" ajoutés en compensation fonctionnelle, et une zone de drop Coffre a été ajoutée
  2026-08-06 (manquait à la clôture du chantier, `docs/ASBUILT.md`)
- Tourelles / armes lourdes fixes (entités interactives)
- Moding Groupe 4 (slot logiciel) — chantier clos (Session 167, architecture `docs/SYSTEME/MODING.md`, Phases 1/3/4 codées et testées) ; 4 dettes résiduelles `docs/BUGIDENTIFIE.md` (`MODING4-*`) ; migration Groupe 1/2 (Phase 2) reportée (Strangler Fig)
- Ergonomie et pédagogie des règles (explication proactive des bonus/malus ; besoin concret noté
  2026-07-30 en cadrant `docs/Old/PLAN_BLESSURES_GUERISON.md` — afficher les règles de Guérison/Infection
  dans l'UI, tooltips envisagés, pas encore cadré)
- Export PDF fiche personnage
- Wizard création à deux (GM + joueur)
- Matériel → objets réels (conversion dans inventaire)
- Chat persistant (historique)
- Chat MP (messagerie privée)
- Mode spectateur
- Sauvegarde/export carte 3D
- Battlemap 2D (illustration ou tokens sur fond 2D) — `docs/PLAN_BATTLEMAP2D.md`, plan en 4 lots, Lot 0 (cadrage) clos, aucun code
- Spotlight / bibliothèque de présentation (personnage, document, indice) — besoin identifié pendant le cadrage Battlemap 2D, plan encore à écrire
- Eau structurelle authorée (lacs, sas et calles sèches de navires, ponts d'arrimage) — nécessite un outil d'édition dédié + compilation serveur dans le `WorldSnapshot`, pas une reconstruction géométrique côté client. Option différée de la dette `docs/BUGIDENTIFIE.md` EAU1 ; v2, décision Saar 2026-07-29 ("peut largement attendre")

---

## Hors scope V1
- Fog of war
- Webcam / audio / vidéo
- Sources lumineuses dynamiques