# ROADMAP — Projet Enclume

> **Rôle de ce document** : planification prospective — quoi reste à faire, ce qui est cadré ou pas,
> ce qui bloque. Ce n'est **pas** un historique : les décisions déjà prises, le détail de ce qui est
> clos et les comptes-rendus de session vivent dans `docs/JOURNAL8.md` (décisions/validations
> durables) et `docs/ASBUILT.md` (ce qui est réellement déployé et stable). **Un chantier clos est
> retiré d'ici**, jamais laissé en `~~barré~~` — s'il faut le retrouver, il est dans JOURNAL8/ASBUILT.
> Les bugs actifs vivent dans `bug_tickets` (`/admin/tickets`, `docs/SYSTEME/TICKETS.md`), jamais ici.
>
> **Carte complète de la documentation** : `docs/SYSTEME/INDEX.md`. **Vision produit et versions
> (v1/v2/v3/vX)** : `docs/FOUNDATION.md`. **État RAW chapitre par chapitre, avec ordre de
> dépendances proposé pour le backend restant** : `docs/SYSTEME/COUVERTURE_RAW.md`. Les trois se
> référencent mutuellement, aucun ne duplique le contenu d'un autre (Règle 2, `docs/RegleDocumentaire.md`).
>
> **Philosophie actée (Saar, 2026-08-25)** : couverture RAW complète (backend) avant esthétique/
> frontend, tant que des mécaniques entières manquent encore côté serveur (`docs/FOUNDATION.md` §2).
>
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
| Exo-armures (v2) | `PLANS/PLAN_EXOARMURE.md` | Lots 1-4 + 2bis codés et testés (Node/PostgreSQL). §16.2.1 (plafond Manœuvre d'armure généralisé), §16.2.2 (armures assistées) et §16.2.5 (milieu hybride manuel, sans repli automatique) codés et testés le 2026-08-25 (39/39 + 336/336, contre PostgreSQL réel). `ExoSheetWindow.jsx` existe et fonctionne (ticket `ARMORWINDOW-MISSING1` fermé — était périmé, la fiche existe depuis le commit `40c8231`) | §16.3 Étape A (déplacement combat exo) et §16.4 Étape B (attaque Tir/CaC) — dépendent de §16.2.3 (migration `exo_weapons.ammo_remaining`) et §16.2.4 (seed `skill_id`/`ammo_count`, 13 armes), deux tâches indépendantes, faisables en parallèle |
| Silhouette d'avaries exo (UI) | — (pas de PLAN écrit) | Saar a produit `docs/PLANS/exo03.svg` (silhouette 6 zones, même découpage que le wound panel char_sheet). `client/src/components/BodySilhouetteSvg.jsx` existe déjà (mêmes 6 zones, `fillFor`/`strokeFor`/`onClickLocation` génériques), consommé par `SilhouettePanel.jsx` (onglet Matériel char_sheet) | À l'occasion (Saar) — voie naturelle : composant frère type `ExoAvariesPanel.jsx` réutilisant le patron `fillFor`/`strokeFor` de `BodySilhouetteSvg.jsx` avec les paths d'`exo03.svg`, pas un nouveau pattern |
| Milieu par pièce (moteur monde) | `PLANS/PLAN_ENVIRONNEMENT_MILIEUX.md` | Architecture tranchée (Option A — `room.environment` statique, repli `battlemaps.default_environment`, 2026-08-24). Planification pure, rien codé | Implémenter §4 (schéma `surface_data`, compilateur, requête `getEnvironmentAtPosition`, éditeur Surface). Débloque la résolution propre du milieu hybride exo (§16.2.5 ci-dessus) **et** prépare v3 (sous-marin/abysses, `docs/FOUNDATION.md`) |
| i18n Lots 1-4 (Combat/Équipement/Builder/Dés) | `PLANS/PLAN_LOCALISATION.md` §2-6 | Codés et commités, zéro texte en dur restant (vérifié par script de résolution i18next à chaque fichier) | Session de test navigateur groupée (décision Saar : pas de validation fichier par fichier) — puis archiver le plan dans `docs/ASBUILT.md` |
| i18n Lot 5 (texte de catalogue `ref_*`, ~1519 lignes / 10 tables) | `PLANS/PLAN_LOCALISATION.md` §7 | Architecture tranchée (colonnes JSONB `<champ>_i18n` par table, 2026-08-11), exécution non commencée | Écrire l'audit de lots détaillé (ordre des 10 tables, quel champ en premier) puis exécuter. Ne dépend d'aucune validation produit — exécutable en autonomie |
| Fatigue & Dommages | `PLANS/PLAN_FATIGUE_DOMMAGES.md` | Lots 0-3 clos et confirmés en navigateur (horloge de campagne, Blessures/Guérison, Chute/Acide/Décompression/Feu) | Lot 4 (Fatigue), indépendant du reste. Lot 6 (Noyade/Asphyxie) cadré (§12) mais **décision en attente** : déclenchement automatique par une Catastrophe (Usure/Intégrité) ou toujours volontaire ? |

## 1bis. Cadré, différé (priorité basse — philosophie backend-first)

| Chantier | Doc | Pourquoi différé |
|---|---|---|
| Animations squelettiques de tokens | `PLANS/PLAN_RW_TOKEN.md` (en-tête réel : `PLAN_ANIMATIONS.md`, nom de fichier trompeur — confirmé toujours d'actualité par Saar 2026-08-25 ; référencé par 7 fichiers dont 1 fichier de code réel, à mettre à jour si renommage) | Chantier esthétique/frontend — plan complet (8 phases, ~490 lignes), aucun code écrit. Reste valide mais non prioritaire tant que des mécaniques RAW entières manquent côté serveur (`docs/FOUNDATION.md` §2). **Pas totalement isolé** (trouvé 2026-08-25, analyse à charge) : `server/src/lib/characterStateShadowCheck.js` et `docs/SYSTEME/ETATS_PERSONNAGE.md` reportent volontairement un nettoyage (Lot 2c, colonnes legacy `combat_roster.state_position`/`state_weapon`) jusqu'à la Phase 7 de ce plan — urgence faible (le doc dit lui-même "plus d'urgence fusion" depuis le départ de Kiwi), mais pas zéro dette en attente |

## 2. Chantiers à cadrer avant tout code

> Voir `docs/SYSTEME/COUVERTURE_RAW.md` pour l'ordre de dépendances techniques proposé entre ces
> chantiers (non encore validé par Saar) — Usure/Intégrité et la résolution de zone d'effet (AOE)
> conditionnent plusieurs des lignes ci-dessous.

| Chantier | Doc(s) | Ce qui manque |
|---|---|---|
| Armes spéciales (fouets/chaînes, fusil à pompe, lance-flammes, grenades/mines) | `PLANS/PLAN_ARMES_SPECIALES.md` | Le fichier est une ligne (`Lire @REGLE_AMRES_SPECIALES.md` — typo dans le nom, le vrai fichier est `REGLES/REGLES_ARMES_SPECIALES.md`). RAW transcrite, zéro recherche code. Prérequis confirmé : la résolution de zone d'effet (AOE) — voir ligne dédiée ci-dessous, n'existe pas encore dans le pipeline de combat |
| Résolution de zone d'effet (AOE) | — (aucun PLAN, brique d'infrastructure transversale) | N'existe pas dans le pipeline de combat actuel (vérifié par recherche, 2026-08-25). Prérequis partagé par Armes spéciales, Force Polaris et Tir de suppression/couverture (§9, `COUVERTURE_RAW.md`) — à construire une fois plutôt que trois |
| Corps à corps avancé / Arts martiaux (techniques offensives/défensives, Saisie/Lutte) | — (RAW transcrite : `REGLES/REGLECACARTMARTIAUX.md`, **aucun PLAN écrit**, gap trouvé 2026-08-25) | Rien cadré. Indépendant d'AOE/Usure — peut être cadré en parallèle |
| Force Polaris (pouvoirs) | — (aucun PLAN écrit, absent de ce document jusqu'au 2026-08-25) | Chapitre entier non entamé, ~40 pouvoirs RAW nommés (détail `COUVERTURE_RAW.md` §4). **[HYPOTHÈSE, non vérifiée]** dépendrait en partie de la résolution AOE ci-dessus — déduit des noms de pouvoirs (Barrière, Onde de choc, Champ...), le texte RAW réel de ce chapitre n'a pas été lu. À vérifier avant de cadrer. Décision de scope nécessaire dans tous les cas (chapitre entier ou sous-ensemble prioritaire) |
| Décorations murales (décals) | `PLANS/PLAN_DECALS.md` **+** `PLANS/PLAN_RW_MATERIAUX.md` Lot 3 | **Chevauchement réel non résolu** (trouvé 2026-08-25) : Lot 3 de RW_MATERIAUX traite les décals comme motifs cuits dans la texture procédurale (`PATTERN_PRESETS`, uniforme ou en masque) ; `PLAN_DECALS.md` les traite comme objets placés individuellement (position/rotation/taille propres, clic pour poser). Deux réponses concurrentes à la même question. **À trancher avec Saar** avant de cadrer l'un ou l'autre : l'un remplace l'autre, ou les deux coexistent comme deux sous-lots complémentaires — puis fusionner les deux documents (Règle 11, une info = un endroit). Actuellement en analyse par un agent parallèle (2026-08-25) |
| Rework matériaux/textures (texture de base + PBR + procédural par-dessus) | `PLANS/PLAN_RW_MATERIAUX.md` | Spécification complète (Lots 0-4, dont Lot 3 = décals ci-dessus), aucune trace de code démarré malgré une spec détaillée et datée (2026-08-02). Chantier esthétique — cohérent avec la philosophie backend-first, à cadrer mais pas prioritaire |
| Usure & Intégrité du matériel | `PLANS/PLAN_USURE&INTEGRITE.md` | Stub (`Lire @MANUEL_USURE.md`). Tête de chaîne du cluster Catastrophe/Matériel (mécanise 3 entrées de la table Catastrophe combat sans rien inventer côté RAW) — **prérequis explicite d'Exo-armures** (Saar, 2026-08-25) et de "Tests critiques/Catastrophe par marge" (§3). Proposé comme premier chantier à cadrer dans `COUVERTURE_RAW.md` (débloque le plus de choses) |
| Informatique et pannes (systèmes électroniques exo) | — (RAW transcrite : `REGLES/REGLE_ORDINATEUR.md`, **aucun PLAN écrit**, gap trouvé 2026-08-25) | Rien cadré. Dépendance explicite d'Exo-armures (Saar) et d'Usure/Intégrité (même famille de mécanique — Test de panne) |
| Moral | `PLANS/PLAN_MORAL.md` | Stub (`Lire @REGLE_MORAL.md`). Règle RAW optionnelle, aucune dépendance technique identifiée — priorité basse, à caser selon préférence produit plutôt que contrainte |
| Interactions porte/échelle en session | `PLANS/PLAN_INTERACTIONS_CONNECTEURS.md` | N'est pas un plan — une base de recherche (état du code, fichiers concernés, l'ascenseur comme seule référence fonctionnelle) en attente que Saar rédige le vrai plan à partir de ça. Origine : ticket `ENTITYCLICK1`. **Nuance (2026-08-25)** : le reste du bucket "interactions environnement" cité par Saar n'est pas un gap uniforme — la couverture (se cacher derrière un mur) est déjà largement implémentée (`state_cover`/`coverageModifier`), l'inondation a une infrastructure partielle (`BUILTIN_WORLD_EFFECTS`, propagation par compartiments) — détail `COUVERTURE_RAW.md` §8 |

## 3. Bloqués

| Chantier | Doc | Bloqué par |
|---|---|---|
| Sauvegarde automatique de l'instance | `PLANS/PLAN_ADMIN_BACKUP.md` | Lots 1-3 prêts à déployer, Lots 4-5 spécifiés pour activation future — attend le remplacement du serveur distant Kiwi par une instance stable (confirmé Saar, 2026-08-25) |
| Battlemap 2D (illustration/tokens sur fond 2D) | `PLANS/PLAN_BATTLEMAP2D.md` | Lot 0 (cadrage) clos, aucun code. Non urgent, peu pertinent actuellement (confirmé Saar, 2026-08-25) |
| Résolution des Tests critiques/Catastrophe par marge (pas par valeur de dé) | `Old/PLAN_TEST_CRITIQUE.md` | Cadrage v1 en pause côté Saar — doit revenir avec la lecture RAW exacte de la table de marge avant de trancher. Bloque uniquement le Lot 8 (Réparation) d'Exo-armures, aucune autre dépendance active |

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

## 5. Dettes ponctuelles ouvertes (non couvertes par un PLAN)

- Module Blessures — animation Tests de Choc restante (l'apparition des badges de statut est faite)
- Options de campagne à finir : `revers`, `skill_natural_prog`, `celebrity`
- Membres détruits (distinction Mortelle vs Membre détruit) — différé (Saar 2026-07-29), la gravité Mortelle couvre Bras/Jambes comme Tête/Corps tant que cette option n'existe pas
- Retrait du `<select>` de Slot dans `InventoryPanel.jsx` (redondant depuis le drag & drop) — différé : nécessite un `KeyboardSensor` `@dnd-kit` d'abord pour ne pas régresser l'accessibilité clavier (`PointerSensor` seul aujourd'hui), sauf si le compromis d'accessibilité est explicitement accepté
- Upload screenshot éditeur → MinIO
- Jets Favoris : drag-to-reorder macros (UI)
- Paramètre campagne GM entity move mode (reporté)
- Commande de chat MJ `/healall`
- Sprint Drones 2d/2e/3 (auto-annonce, `resolveDroneAutoAction`, télépilotage)
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
