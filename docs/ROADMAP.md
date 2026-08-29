# ROADMAP — Projet Enclume

> **Rôle de ce document** : planification prospective — quoi reste à faire, ce qui est cadré ou pas,
> ce qui bloque. Ce n'est **pas** un historique : les décisions déjà prises, le détail de ce qui est
> clos et les comptes-rendus de session vivent dans `docs/JOURNAL8.md` (décisions/validations
> durables) et `docs/ASBUILT.md` (ce qui est réellement déployé et stable). **Un chantier clos est
> retiré d'ici**, jamais laissé en `~~barré~~` — s'il faut le retrouver, il est dans JOURNAL8/ASBUILT.
> Les bugs actifs vivent dans `bug_tickets` (`/admin/tickets`, `docs/SYSTEME/TICKETS.md`), jamais ici.
>
> **Carte complète de la documentation** : `docs/SYSTEME/INDEX.md`. **Vision produit et versions
> (v1/v2/v3/vX)** : `docs/FOUNDATION.md`. **État RAW chapitre par chapitre** : `docs/SYSTEME/COUVERTURE_RAW.md`.
> Les trois se référencent mutuellement, aucun ne duplique le contenu d'un autre (Règle 2, `docs/RegleDocumentaire.md`).
>
> **Approche actuelle de Saar (2026-08-25, peut évoluer)** : couverture RAW complète (backend) avant
> esthétique/frontend, tant que des mécaniques entières manquent encore côté serveur — **pas un
> invariant** (retiré de `docs/FOUNDATION.md` pour cette raison), une priorité de travail assumée.
>
> **Ordre établi avec Saar (2026-08-26)** — remplace la correction du 25 ci-dessous (conservée pour
> l'historique de pourquoi un premier ordre déduit seul avait été retiré) : **AOE → Portes → Exo
> Étape A/B → Usure/Intégrité + Informatique/pannes exo → Drones (télépilotage etc.) → Armes spéciales
> + Tir de suppression (débloqués par l'AOE) → Force Polaris (Lot 1 : cœur + pouvoirs à cible unique)
> → Arts martiaux/Moral (sans contrainte d'ordre entre eux)**. AOE en tête sur préférence explicite de
> Saar (meilleur rendement : débloque 3 chantiers de contenu en une seule brique). Portes et Exo
> restent mutuellement indépendants d'AOE — l'ordre entre les trois est un choix de priorité assumé,
> pas une dépendance technique. **Hors de cette séquence, casables en parallèle sans dépendance** :
> Milieu par pièce, Silhouette exo UI, i18n Lot 5, Fatigue Lot 4 (tous déjà "prêts" en §1 ci-dessous,
> omis une première fois de la discussion de séquence — analyse à charge du 2026-08-26). Détail des
> dépendances réelles vs priorités : `docs/SYSTEME/COUVERTURE_RAW.md` (section "Ordre").
>
> **Correction (2026-08-25, analyse à charge, historique)** : l'ordre de séquencement proposé plus bas
> (Usure/Intégrité → AOE → Armes spéciales → ...) avait été retiré une première fois — construit par
> déduction de dépendances techniques (grep, fichiers qui se référencent), pas par une compréhension
> réelle du jeu ni de ce qui compte pour Saar. L'ordre ci-dessus, du 26, a été établi différemment :
> discuté explicitement avec Saar, dépendances réelles vérifiées par lecture RAW directe (AOE↔Force
> Polaris confirmé, pas déduit d'un nom de sommaire) plutôt que par grep de code.
> **Refondu le 2026-08-25** (Claude/Saar) — l'ancienne version accumulait un historique daté en tête
> (2026-07-15 → 2026-08-23, ~110 lignes de blockquotes) jamais purgé, et **8 des 15 fichiers
> `docs/PLANS/*.md` n'y apparaissaient nulle part** (`PLAN_ADMIN_BACKUP`, `PLAN_COMBAT_MODE_AMBIANT`,
> `PLAN_DECALS`, `PLAN_ENVIRONNEMENT_MILIEUX`, `PLAN_INTERACTIONS_CONNECTEURS`, `PLAN_RW_EXPORT`,
> `PLAN_RW_MATERIAUX`, `PLAN_RW_TOKEN`). Historique préservé, mais **pas uniquement dans
> `docs/JOURNAL8.md`** comme annoncé initialement ici (correction, 2026-08-25 : vérifié après coup —
> ex. le détail des 5 Lots de la PWA fiche hors-ligne a 0 occurrence dans JOURNAL8.md ; il vit dans
> le PLAN archivé lui-même, `docs/Old/PLAN_FICHE_HORSLIGNE.md`, comme le veut la Règle 10). La bonne
> formulation : l'historique vit dans JOURNAL8.md **et/ou** dans le PLAN archivé concerné — jamais
> perdu, mais pas dans un seul endroit prévisible. Ce document ne garde désormais que l'état courant,
> un chantier = une ligne ou un bloc, jamais un journal de qui a décidé quoi et quand.
>
> **Correction le jour même** : `PLAN_COMBAT_MODE_AMBIANT.md`, listé ci-dessus comme absent de ce
> document, était en fait un plan déjà entièrement implémenté et confirmé en jeu (4 bugs clos entre
> le 2026-08-04 et le 2026-08-22) — sa présence dans `docs/PLANS/` était elle-même l'anomalie, pas son
> absence d'ici. Archivé vers `docs/Old/` (Règle 10), commit `d653313`. Ne figure donc plus au §1
> ci-dessous.

---

## 1. Chantiers actifs — prêts à reprendre sans cadrage supplémentaire

| Chantier | Doc | État | Prochaine étape |
|---|---|---|---|
| Exo-armures (v2) | `PLANS/PLAN_EXOARMURE.md` | **§16.3 Étape A (déplacement) et §16.4 Étape B (Tir/CaC) codés et validés en combat réel le 2026-08-27** — premier combat exo-armure fonctionnel du projet (Tir qui touche, résolution complète, étourdissement de la cible, échange normal dans les deux sens). Détail mécanique : `docs/SYSTEME/EXOARMURE.md` §5. Lots 1-4 + 2bis + §16.2.1/2.2/2.5 déjà codés et testés antérieurement. `ExoSheetWindow.jsx` fonctionne | Points ouverts, non bloquants pour jouer : (1) **[FAIT 2026-08-27]** Compétence Tir Automatique (PC23) exo RC/RL — règle identique à l'humanoïde, gate + message explicite dans `socketCombatAnnouncement.js` branche `isExo`, cf. `docs/SYSTEME/EXOARMURE.md` §5 ; (2) **[FAIT 2026-08-28]** Initiative projetée près de DÉCLARER — pastille `CombatDeclareIniWidget`, calcul partagé `shared/combatIniCost.js` (chantier RW fenêtres de déclaration, clos, `docs/JOURNAL8.md`) ; (3) combat drone jamais retesté en jeu réel depuis le refactor DRY de `resolveDroneAssaultAction` (2026-08-26, extraction pure non prouvée) — Saar teste ; (4) **statuts d'état exo** (arme rangée/au clair, position accroupi/genou) : la brique existe (`CombatDeclareStateChip`/`CombatDeclareStateSelector`, API `stateKey`), reste à câbler dans `CombatExoActionWindow` + le serveur — chantier propre, non cadré |
| Silhouette d'avaries exo (UI) | — (pas de PLAN écrit) | Saar a produit `docs/PLANS/exo03.svg` (silhouette 6 zones, même découpage que le wound panel char_sheet). `client/src/components/BodySilhouetteSvg.jsx` existe déjà (mêmes 6 zones, `fillFor`/`strokeFor`/`onClickLocation` génériques), consommé par `SilhouettePanel.jsx` (onglet Matériel char_sheet) | À l'occasion (Saar) — voie naturelle : composant frère type `ExoAvariesPanel.jsx` réutilisant le patron `fillFor`/`strokeFor` de `BodySilhouetteSvg.jsx` avec les paths d'`exo03.svg`, pas un nouveau pattern |
| Interactions d'entité (mobilité carte : portes/ascenseurs/déplacer un objet pour se couvrir) | — (pas de PLAN — moteur déjà construit) | **Re-vérifié le 2026-08-25 sur demande de Saar — le moteur générique est déjà entièrement construit et câblé**, contrairement à ce que suggérait l'entrée précédente de ce document. Confirmé par lecture directe : `server/src/socket/socketEntity.js` (`ENTITY_ACTION_REQUEST`/`ENTITY_ACTION_RESOLVE` — interaction avec Test de compétence, confirmation MJ, jet de dé, bonus critique ; `ENTITY_MOVE_REQUEST` — pousser/tirer un objet avec validation de portée, direction et sens serveur, PE27), `client/src/pages/SessionPage.jsx` (`handleEntityAction`/`handleEntityMove`, menu radial au clic sur une entité), `client/src/components/EntityBuilderTab.jsx` (éditeur complet pour définir états/interactions sur un blueprint, i18n fini). Ascenseur déjà fonctionnel (système dédié séparé, `worldElevatorService.js`). **Le seul vrai manque : le contenu**, `SELECT` sur `entity_blueprints` confirme **zéro** blueprint avec une interaction définie en base à ce jour — le moteur n'a jamais été utilisé | Créer un blueprint "caisse" (interaction `move_type`) et vérifier en jeu réel que déplacer l'objet affecte bien la couverture/LOS (`state_cover`) — win rapide, contenu seul |
| Portes (connecteurs) | `PLANS/PLAN_INTERACTIONS_CONNECTEURS.md` | Architecture tranchée (2026-08-25, vérifiée par lecture directe, pas déduite) : `world_feature_states` est déjà la table générique prévue pour ça (`setWorldFeatureState`, `worldEffectService.js`, déjà utilisée par l'ascenseur), le compilateur (`doorGeometry`, `worldCompiler.js`) attend déjà cet état runtime par porte. Handler dédié léger à écrire, qui réutilise le patron d'arbitrage `ENTITY_ACTION_REQUEST` (Test optionnel → confirmation MJ → jet → état → broadcast) sans la complexité passagers/cinématique de l'ascenseur. Reste ouvert : quelles portes nécessitent un Test RAW (verrouillée) vs action libre | Écrire le plan réel à partir de `PLANS/PLAN_INTERACTIONS_CONNECTEURS.md` (base de recherche + architecture, prêt), puis coder |
| Milieu par pièce (moteur monde) | `PLANS/PLAN_ENVIRONNEMENT_MILIEUX.md` | Architecture tranchée (Option A — `room.environment` statique, repli `battlemaps.default_environment`, 2026-08-24). Planification pure, rien codé | Implémenter §4 (schéma `surface_data`, compilateur, requête `getEnvironmentAtPosition`, éditeur Surface). Débloque la résolution propre du milieu hybride exo (§16.2.5 ci-dessus) **et** prépare v3 (sous-marin/abysses, `docs/FOUNDATION.md`) |
| i18n Lots 1-4 (Combat/Équipement/Builder/Dés) | `PLANS/PLAN_LOCALISATION.md` §2-6 | Codés et commités, zéro texte en dur restant (vérifié par script de résolution i18next à chaque fichier) | Session de test navigateur groupée (décision Saar : pas de validation fichier par fichier) — puis archiver le plan dans `docs/ASBUILT.md` |
| i18n Lot 5 (texte de catalogue `ref_*`, ~1519 lignes / 10 tables) | `PLANS/PLAN_LOCALISATION.md` §7 | Architecture tranchée (colonnes JSONB `<champ>_i18n` par table, 2026-08-11), exécution non commencée | Écrire l'audit de lots détaillé (ordre des 10 tables, quel champ en premier) puis exécuter. Ne dépend d'aucune validation produit — exécutable en autonomie |
| Fatigue & Dommages | `PLANS/PLAN_FATIGUE_DOMMAGES.md` | Lots 0-3 clos et confirmés en navigateur (horloge de campagne, Blessures/Guérison, Chute/Acide/Décompression/Feu) | Lot 4 (Fatigue), indépendant du reste. Lot 6 (Noyade/Asphyxie) cadré (§12) mais **décision en attente** : déclenchement automatique par une Catastrophe (Usure/Intégrité) ou toujours volontaire ? |
| Refonte des fenêtres de déclaration de combat (design + technique associée) | `PLANS/PLAN_RW_DECLARE_DESIGN.md` (tableau de bord §0) | **Codé + committé** (non poussé) : Lot B (i18n + terminologie Tir/CaC + pastille INI), B5 (« Passer le tour » mécanisme), module 0 M0.0-M0.3 (`buildDeclarePayload` + 51 tests). **Cadré + analyse à charge** : modules 2 (châssis `CombatDeclareFrame`), 3 (satellite d'état), M0.4 (hooks `useAssaultDeclaration`/`useMeleeDeclaration`), 4 (liste d'action « l'arme EST l'action »), 5 (pied). Prototype D5 validé (`claude.ai/code/artifact/afcd5e28-341b-40ee-b109-30e69d9597fc`). Teinte Wizard (P7). Analyse à charge profonde faite (§19, R1-R8 tranchés) | **Coder** (conversation à part) : M-E2E (test Playwright du parcours de déclaration, R1) → module 2 → 3 → M0.4 → 4 (4a-4e) → 5. Validation navigateur Saar après **chaque sous-module** (R2). Détail : plan §0 |
| Fenêtres de RÉSOLUTION combat — passe esthétique (couleurs) | — | Non commencé. Suite de la teinte Wizard des fenêtres de déclaration (`PLAN_RW_DECLARE_DESIGN` P7 / R4, 2026-08-29). `CombatModifiersWindow` / `CombatDamageWindow` / `CombatCacModifiersWindow` / `CombatStunWindow` sont sur `--bg-session-*` + ~60 hex en dur + accent doré — pas `--combat-*` | Passe CSS pure (convertir les hex, aligner sur la teinte Wizard, garder ou non le doré) — aucune logique, fastidieux. À faire après le chantier déclaration |

## 1bis. Cadré, différé (priorité basse — philosophie backend-first)

| Chantier | Doc | Pourquoi différé |
|---|---|---|
| Animations squelettiques de tokens | `PLANS/PLAN_RW_TOKEN.md` (en-tête réel : `PLAN_ANIMATIONS.md`, nom de fichier trompeur — référencé par 7 fichiers dont 1 fichier de code réel) | Chantier esthétique/frontend, non prioritaire tant que des mécaniques RAW entières manquent côté serveur (approche actuelle de Saar, peut évoluer — voir banner en tête de ce document). **Pas totalement isolé** : `server/src/lib/characterStateShadowCheck.js`/`docs/SYSTEME/ETATS_PERSONNAGE.md` reportent un nettoyage jusqu'à la Phase 7 de ce plan (urgence faible). **Décalage trouvé (2026-08-25)** : le plan écrit démarre directement par le rig squelettique complet (Mixamo, Phase 1) — Saar décrit la séquence réellement voulue comme (1) animations spécifiques liées aux actions des tokens d'abord, (2) rig/masque squelettique ensuite pour l'animation continue. **Le document ne reflète pas cet ordre voulu** — à recadrer avant de le renommer ou d'y toucher, pas juste un problème de nom de fichier |

## 2. Chantiers à cadrer avant tout code

| Chantier | Doc(s) | Ce qui manque |
|---|---|---|
| Armes spéciales (fouets/chaînes, fusil à pompe, lance-flammes, grenades/mines) | `PLANS/PLAN_ARMES_SPECIALES.md` | Le fichier est une ligne (`Lire @REGLE_AMRES_SPECIALES.md` — typo dans le nom, le vrai fichier est `REGLES/REGLES_ARMES_SPECIALES.md`). RAW transcrite, zéro recherche code. Prérequis confirmé : la résolution de zone d'effet (AOE) — voir ligne dédiée ci-dessous, n'existe pas encore dans le pipeline de combat |
| **Résolution de zone d'effet (AOE) — priorité #1 (ordre du 2026-08-26)** | `PLANS/PLAN_AOE.md` (v7, 2026-08-26 — implémentation démarrée, §12 du doc tient l'avancement réel à jour) | **En cours de code.** Fait et testé : géométrie pure (`aoeShapes.js`), primitive de palier générique (`distanceBands.js`), requête spatiale en lot (`queryTokensInShape`), composition LOS (`evaluateAoeVisibility`), migration `317_combat_action_targets` appliquée — 3 bugs trouvés et corrigés en relecture (token MJ filtré des cibles, statut clair si lanceur invalide, garde anti-table-non-triée). En pause : branchement du payload `COMBAT_ACTION_DECLARE` (`socketCombatAnnouncement.js`). Catalogue de dégression **partiellement de-risqué seulement** : viable pour le fusil à pompe (`resolveWeaponRangeBand`/`ref_range` déjà exploitables), mais **8 types de grenades réels dans `ref_equipment` ont chacun une zone d'effet différente écrite en texte libre** (pas en donnée structurée) — nouvelle colonne catalogue nécessaire avant de brancher les grenades. Fumigène/à gaz confirmées hors périmètre AOE (relèvent de `worldEffects.js`/propagation par compartiments, pas d'une forme géométrique). | Architecture en couches actée (géométrie pure → requête spatiale monde → LOS par cible → résolution/dégression par arme), plus aucun point bloquant : dispersion 1D6 résolue (schéma fourni par Saar), mécanique de point de Chance reportée en backlog (ligne dédiée ci-dessous), correction MJ post-résolution ramenée à l'édition de fiche déjà existante (pas de nouvelle file de confirmation), risque de round bloqué couvert par un mécanisme déjà codé et générique (`COMBAT_SKIP_PLAYER`/`confirmDamage forced=true`), politique `ON DELETE` alignée sur le précédent déjà en base. Prêt pour le passage au code. Prérequis confirmé pour Armes spéciales, Tir de suppression/couverture, et Force Polaris — débloque 3 chantiers de contenu en une seule brique |
| Corps à corps avancé / Arts martiaux (techniques offensives/défensives, Saisie/Lutte) | — (RAW transcrite : `REGLES/REGLECACARTMARTIAUX.md`, **aucun PLAN écrit**, gap trouvé 2026-08-25) | Rien cadré. Indépendant d'AOE/Usure — peut être cadré en parallèle |
| Force Polaris (pouvoirs) | — (aucun PLAN écrit, absent de ce document jusqu'au 2026-08-25) | Chapitre entier non entamé, ~40 pouvoirs RAW nommés (détail `COUVERTURE_RAW.md` §4). **[VÉRIFIÉ] 2026-08-26** — `docs/REGLES/REGLEPOLARIS.md` existe et a été lu directement (la note du 25 cherchait le mauvais nom de fichier) : le cœur du mécanisme (Maîtriser/Libérer/Contrôler, Choc Polaris, Incidents 1D100) est indépendant de l'AOE et codable seul ; la majorité des pouvoirs ont réellement un paramètre Zone d'effet (confirmé, pas déduit) ; un sous-ensemble à cible unique (Contrôle mental confirmé, Dague psychique probable) ne dépend pas de l'AOE. **Premier lot réaliste sans attendre l'AOE** : cœur du mécanisme + pouvoirs à cible unique. Reste à faire avant cadrage complet : cataloguer les ~40 pouvoirs un par un (zone vs cible unique), pas fait en entier |
| Décorations murales (décals) | `PLANS/PLAN_DECALS.md` **+** `PLANS/PLAN_RW_MATERIAUX.md` Lot 3 | **Chevauchement réel non résolu** (trouvé 2026-08-25) : Lot 3 de RW_MATERIAUX traite les décals comme motifs cuits dans la texture procédurale (`PATTERN_PRESETS`, uniforme ou en masque) ; `PLAN_DECALS.md` les traite comme objets placés individuellement (position/rotation/taille propres, clic pour poser). Deux réponses concurrentes à la même question. **À trancher avec Saar** avant de cadrer l'un ou l'autre : l'un remplace l'autre, ou les deux coexistent comme deux sous-lots complémentaires — puis fusionner les deux documents (Règle 11, une info = un endroit). Actuellement en analyse par un agent parallèle (2026-08-25) |
| Rework matériaux/textures (texture de base + PBR + procédural par-dessus) | `PLANS/PLAN_RW_MATERIAUX.md` | Spécification complète (Lots 0-4, dont Lot 3 = décals ci-dessus), aucune trace de code démarré malgré une spec détaillée et datée (2026-08-02). Chantier esthétique — cohérent avec la philosophie backend-first, à cadrer mais pas prioritaire |
| Usure & Intégrité du matériel | `PLANS/PLAN_USURE&INTEGRITE.md` | Stub (`Lire @MANUEL_USURE.md`, jamais lu à ce jour). Tête de chaîne du cluster Catastrophe/Matériel (mécanise 3 entrées de la table Catastrophe combat sans rien inventer côté RAW) — **confirmé par Saar (2026-08-25) : nécessaire pour finir Exo-armures**, avec Informatique/pannes ci-dessous |
| Informatique et pannes (systèmes électroniques exo) | — (RAW transcrite : `REGLES/REGLE_ORDINATEUR.md`, **aucun PLAN écrit**, gap trouvé 2026-08-25) | Rien cadré. **Confirmé par Saar (2026-08-25) : nécessaire pour finir Exo-armures**, avec Usure/Intégrité ci-dessus |
| Moral | `PLANS/PLAN_MORAL.md` | Stub (`Lire @REGLE_MORAL.md`). Règle RAW optionnelle, aucune dépendance technique identifiée — priorité basse, à caser selon préférence produit plutôt que contrainte |

## 3. Bloqués

| Chantier | Doc | Bloqué par |
|---|---|---|
| Sauvegarde automatique de l'instance | `PLANS/PLAN_ADMIN_BACKUP.md` | Lots 1-3 prêts à déployer, Lots 4-5 spécifiés pour activation future — attend le remplacement du serveur distant Kiwi par une instance stable (confirmé Saar, 2026-08-25) |
| Battlemap 2D (illustration/tokens sur fond 2D) | `PLANS/PLAN_BATTLEMAP2D.md` | Lot 0 (cadrage) clos, aucun code. Non urgent, peu pertinent actuellement (confirmé Saar, 2026-08-25) |

## 4. Backlog — idée retenue, aucun PLAN écrit

- **Export Google Sheets (fiche personnage)** — décision Saar 2026-08-23, remplace le chantier PWA fiche hors-ligne abandonné (`docs/Old/PLAN_FICHE_HORSLIGNE.md`, code des 5 lots resté commité mais déprioritisé ; `docs/Old/PLAN_RW_EXPORT.md`, rework de cette même PWA, périmé par le même abandon, archivé le 2026-08-25). Scope exact (lecture seule vs édition, quelles données, authentification Google) à définir avant de coder
- LOS & Raycast (replanifier — dépôt Kiwi/dev-monde arrêté depuis le 2026-08-04, voir `CLAUDE.md` §3)
- Fenêtre d'affichage/édition pour une exo-armure custom du Coffre (`VaultCharacterPage.jsx` affiche un placeholder, l'illustration hérite déjà de `characters.portrait_url` — seul l'écran manque). Pas prioritaire (Saar, 2026-08-21)
- Tourelles / armes lourdes fixes (entités interactives)
- Ergonomie et pédagogie des règles (explication proactive des bonus/malus en UI — tooltips envisagés, pas cadré)
- Chat persistant (historique), Chat MP, Chat multi-canal (backend `chat_messages.channel_id`/`whisper` déjà partiel, dépend de `docs/Old/PLAN_CHAT.md` Phase 3/4 non reprise)
- Mode spectateur
- Sauvegarde/export carte 3D
- Spotlight / bibliothèque de présentation (personnage, document, indice) — besoin identifié en cadrant Battlemap 2D
- Eau structurelle authorée (lacs, sas/calles sèches de navires, ponts d'arrimage) — nécessite un outil d'édition dédié + compilation serveur (`WorldSnapshot`), pas une reconstruction géométrique client. Différé (Saar, 2026-07-29 : "peut largement attendre")
- Mutations & Avantages, narratif/économie (`docs/Old/PLAN_MUTATION2.md` Lot 7) — priorité basse
- **Mécanique de point de Chance** (décision Saar, 2026-08-26, cadrage `PLANS/PLAN_AOE.md` §5.2) —
  ressource RAW transversale (relancer un jet, réduire la gravité d'une Blessure ou de Dommages
  d'armure, forcer un Test de Chance) : bouton PJ "Utiliser sa Chance" à ajouter à plusieurs endroits.
  Pas complexe en soi mais transversal — non urgent, aucun PLAN écrit. Tant que ce chantier n'est pas
  fait, l'AOE (et tout Test de Chance en général) se résout sans option de dépense côté serveur, écart
  RAW assumé

## 5. Dettes ponctuelles ouvertes (non couvertes par un PLAN)

- **Audit de compréhension approfondie des 31 docs `docs/SYSTEME/*.md` (2026-08-26) — CLOS**, les
  31 en statut 🔎 dans `INDEX.md` (upgrade depuis le premier passage ✅ plus superficiel du même jour,
  25/33 par sondage d'agents). Deuxième passage : lecture intégrale de chaque doc par moi-même,
  confrontation directe au code (pas de confiance aveugle dans un rapport d'agent), un fichier à la
  fois. Trouvailles les plus significatives, au-delà des ~50 numéros de migration périmés (refonte
  2026-08-22) déjà corrigés : `CHARACTER_FLUX.md` décrivait une architecture d'inventaire (`reloadKey`)
  remplacée par `characterStore` sans que le doc ait suivi ; `COMBAT REFERENCE.md` §6.3 décrivait les
  Attaques Multiples comme non construites alors qu'elles le sont depuis la Session 165 ; deux dettes
  documentées comme actives (STUN2, RW17-1) se sont révélées déjà résolues ; `CONVENTIONS.md`
  contenait une collision de code non résolue (PC28 utilisé pour 3 significations distinctes) ;
  `EXOARMURE.md` citait une route/fichier `exo-equipment`/`exoEquipment.js` inexistants (le catalogue
  passe par `/api/equipment`) — pertinent pour l'Étape B ci-dessus. Un vrai bug de code trouvé au
  passage (pas juste un problème de doc) : ticket `bug_tickets`/`AUDIT-SYSTEME` ("VOXEL_ADD/REMOVE/
  UPDATE et MAP_SWITCH/MAP_VIEWPORT — client émet, aucun handler serveur"), **résolu depuis** (code
  mort supprimé, `MAP_SWITCH` recréé dans `socketBattlemap.js`). `docs/SYSTEME/INDEX.md` §8 (nouvelle
  section) indexe les couplages inter-systèmes trouvés en route (Entités/Tokens ↔ Moteur monde, Coffre
  ↔ Character) — alimentée au fil de l'eau, pas une carte de dépendances exhaustive dédiée (décision
  explicite : le risque de péremption d'une carte sans déclencheur de mise à jour naturel dépasse sa
  valeur, voir discussion 2026-08-26).
- **Dispatch de résolution combat (Tir/CaC × PJ/PNJ/Drone/Exo) — architecture incohérente, trouvé en
  écrivant l'Exo-CaC (2026-08-26)**. Deux problèmes distincts, tous deux dans
  `server/src/socket/socketCombatHelpers.js`/`socketCombatResolution.js`/`socketCombatExo.js` :
  1. `resolveDroneAssaultAction` mélange encore Drone-Tir ET Drone-CaC dans une seule fonction
     (branchement interne `isCaCWeapon`) — c'est la seule des 6 combinaisons type×action qui ne soit
     pas déjà scindée (Humain-Tir/Humain-CaC/Exo-Tir/Exo-CaC le sont chacune, cf. `resolveAssaultAction`/
     `resolveMeleeAction`/`socketCombatExo.js`).
  2. Le point de dispatch (quelle fonction appeler selon `character.type` × `action.type`) est éclaté à
     deux endroits avec deux styles différents : pour `'assault'`, le redirect drone vit *dans*
     `resolveAssaultAction` elle-même (`character.type==='drone'` interne), alors que le redirect exo
     vit *dans* `socketCombatResolution.js` (évite un import circulaire avec `socketCombatExo.js`,
     qui importe déjà des helpers de `socketCombatHelpers.js`) ; pour `'melee'`, drone ET exo sont
     tous deux routés depuis `socketCombatResolution.js`. Trois styles pour la même décision.

  **Rework ciblé recommandé** (pas les 6 cases — voir ci-dessous) : scinder `resolveDroneAssaultAction`
  en `resolveDroneAssaultAction`(Tir)/`resolveDroneMeleeAction`(CaC), et unifier tout le dispatch en un
  seul endroit dans `socketCombatResolution.js` (une table `{characterType, actionType} → resolver`),
  jamais un redirect caché à l'intérieur d'un résolveur humain. **Ne pas toucher**
  `resolveAssaultAction`/`resolveMeleeAction` (le contenu humain lui-même, hors leur redirect drone à
  retirer) — code le plus testé/joué du projet, aucun besoin fonctionnel de le réécrire, uniquement du
  risque. Décision Saar (2026-08-26) : rework ciblé plutôt que les 6 modules complets, pas mélangé à
  l'ajout de fonctionnalité — chantier à part, pas cadré plus finement à ce jour.
- **Badge de type exo « PJ » au lieu de « EXO »** (`CombatRosterWindow.jsx:224-226`, signalé Saar 2026-08-28) — la logique `isDrone ? 'drone' : isPnj ? 'pnj' : 'pj'` fait tomber `charType === 'exo'` dans le défaut `'pj'`. Fix : `isExo` + classe `combat-badge-exo` (`index.css`) + clé `rosterWindow.typeBadge.exo` (`combat.json:148`) + grep du même patron `? 'pj'` / `? 'pnj'` ailleurs (même famille que `feedback_exo_pilot_routing_bug`). Correctif isolé, hors chantier `PLAN_RW_DECLARE_WINDOWS`
- Module Blessures — animation Tests de Choc restante (l'apparition des badges de statut est faite)
- Options de campagne à finir : `revers`, `skill_natural_prog`, `celebrity`
- Membres détruits (distinction Mortelle vs Membre détruit) — différé (Saar 2026-07-29), la gravité Mortelle couvre Bras/Jambes comme Tête/Corps tant que cette option n'existe pas
- Retrait du `<select>` de Slot dans `InventoryPanel.jsx` (redondant depuis le drag & drop) — différé : nécessite un `KeyboardSensor` `@dnd-kit` d'abord pour ne pas régresser l'accessibilité clavier (`PointerSensor` seul aujourd'hui), sauf si le compromis d'accessibilité est explicitement accepté
- Upload screenshot éditeur → MinIO
- Jets Favoris : drag-to-reorder macros (UI)
- Paramètre campagne GM entity move mode (reporté)
- Commande de chat MJ `/healall`
- Sprint Drones 2d/2e/3 (auto-annonce, `resolveDroneAutoAction`, télépilotage). **+ 2 bugs pré-existants trouvés en test 2026-08-28, ticketés** : (1) `getCharacterMovementBudget` (`movementBudgetService.js:34-41`) sans branche `drone` → `world-path-preview` 500 en boucle pour un token drone, latent aussi dans `planCombatWorldMovement` — fix = `getDroneMovementBudget` lisant `drone_sheet.vitesse`, bloqué sur le mapping `vitesse` (entier) → allures (RAW) ; (2) bloc melee de l'annonce (`socketCombatAnnouncement.js:627-704`) sans branche `isDrone` → CaC drone sans programme `armement_contact` accepté puis dissous en silence à la résolution
- Sprint CaC 4b — validation fonctionnelle requise avant
- Sprint Annonce v2 — actions précédentes en lecture seule
- Sprint Tooltips Compétences (`SkillsPanel` bouton ⓘ)
- Sprint Waypoints — déplacement par points intermédiaires
- Sprint Page Santé Serveur — `/api/health/detailed`
- Moding Groupe 1/2 (slot logiciel legacy) — migration vers l'architecture Groupe 4 reportée (Strangler Fig), 4 dettes résiduelles suivies via `bug_tickets` (`MODING4-*`)
- Avatars utilisateur, optimisation voxel face culling, persistance viewport caméra, reconnexion WebSocket, favicon application (Phase 3 — Polish + assets)

---

## Hors scope V1

- Fog of war
- Webcam / audio / vidéo
