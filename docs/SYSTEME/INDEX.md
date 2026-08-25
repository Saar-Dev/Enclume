# INDEX.md — Carte documentaire d’Enclume

> Version : 2026-08-25 — section PLANS ajoutée (§6, pointeur vers docs/ROADMAP.md pour le statut),
> entrée FOUNDATION.md rafraîchie (n'est plus un squelette), hiérarchie de chargement alignée sur
> RegleDocumentaire.md §12/CLAUDE.md §1. Précédent : 2026-08-12 — ajout SYSTEME/ADMIN.md (rôle
> administrateur, page /admin) et SYSTEME/TICKETS.md (système de tickets, remplace BUGIDENTIFIE.md
> archivé).
> Statut : Document de navigation pour humains et agents IA.
> Lire ceci en premier pour savoir où trouver une information.

---

## Mission

Ce document est le **point d’entrée unique** de la documentation du projet.
Il liste chaque document avec sa responsabilité unique, sa couche dans la hiérarchie
de chargement, et les conditions dans lesquelles un agent doit le lire.

**Hiérarchie de chargement (pour IA) :**
Livre de Base Polaris → FOUNDATION → VOCABULARY → SYSTEME → REGLES → MANUEL → PLAN
(chaque couche peut faire référence aux suivantes, jamais l'inverse — même hiérarchie que
`docs/RegleDocumentaire.md` §12 et `CLAUDE.md` §1, à ne pas faire diverger).

---

## 1. FOUNDATION — Principes immuables

| Document | Responsabilité | Statut |
|----------|----------------|--------|
| `FOUNDATION.md` | Mission, versions (v1-vX), invariant RAW, hiérarchies, orientation documentaire | ✅ Vérifié (2026-08-25) |

---

## 2. VOCABULARY — Glossaire officiel

| Document | Responsabilité | Statut |
|----------|----------------|--------|
| `VOCABULARY.md` | Définitions des termes Polaris et Enclume, acronymes, levée d’ambiguïtés | À jour |

---

## 3. SYSTEME — Architecture technique

> **Légende :** ✅ = vérifié par lecture complète en session.
> Les dates indiquées sont celles de dernière modification du fichier.

### 3.1 Moteur monde & spatial
| Document | Responsabilité | Statut |
|----------|----------------|--------|
| `SYSTEME/MOTEUR_MONDE.md` | Compilation, navigation, collision, LOS, WorldSnapshot | ✅ Vérifié (2026-07-29) |
| `SYSTEME/SURFACES_SALLES.md` | Éditeur de surface, salles, murs, connecteurs, profils, eau | ✅ Vérifié (2026-07-29) |
| `SYSTEME/VOXELS.md` | Conventions de coordonnées 3D (PE14, PE34), pièges voxels | ✅ Vérifié (2026-05-25) |

### 3.2 Combat
| Document | Responsabilité | Statut |
|----------|----------------|--------|
| `SYSTEME/COMBAT.md` | Architecture de combat, intégration avec le moteur monde | ✅ Vérifié (2026-08-23) |
| `SYSTEME/COMBAT REFERENCE.md` | Source de vérité unique — règles LdB + implémentation, pipelines, écarts, matrice de régression, drones | ✅ Vérifié (2026-07-19) |
| `SYSTEME/COMBAT_FLUX.md` | Flux de combat : initiative, tours, résolution | À jour (2026-07-20) |
| `SYSTEME/SERVICES_COMBAT.md` | Services backend pour le combat | ✅ Vérifié (2026-07-21) |
| `SYSTEME/DOMMAGES.md` | Distinction dommages physiques/Choc, autorités de résolution | ✅ Vérifié (2026-07-22) |
| `SYSTEME/BLESSURES.md` | Gestion des blessures, armures, malus, inventaire médical | ✅ Vérifié (2026-05-25) |
| `SYSTEME/DICE.md` | Flux des dés, animation 3D, payload DICE_RESULT | ✅ Vérifié (2026-07-16) |

### 3.3 Personnage
| Document | Responsabilité | Statut |
|----------|----------------|--------|
| `SYSTEME/CHARACTER.md` | Architecture complète : schéma SQL, API, flux, logique métier, composants React, pièges PC1–PC22 | ✅ Vérifié (2026-07-16) |
| `SYSTEME/CHARACTER_FLUX.md` | Flux de données, dépendances composants, synchronisation UI/API | ✅ Vérifié (2026-05-09) |
| `SYSTEME/PERSONNAGE_API.md` | API serveur pour les personnages : routes, droits, événements WS | ✅ Vérifié (2026-07-19) |
| `SYSTEME/PERSONNAGE_CALCULS.md` | Chaîne de calcul des attributs, compétences, seuils et résistances | ✅ Vérifié (2026-07-19) |
| `SYSTEME/PERSONNAGE_WIZARD.md` | Assistant de création de personnage en 6 étapes, architecture client-primary, collaboration temps réel MJ/joueur | ✅ Vérifié (2026-08-23) |

### 3.4 Infrastructure
| Document | Responsabilité | Statut |
|----------|----------------|--------|
| `SYSTEME/CORE.md` | Auth, stores, WebSocket, migrations | ✅ Vérifié (2026-07-16) |
| `SYSTEME/ADMIN.md` | Rôle administrateur global, page `/admin`, garde dernier admin, outils gérés | ✅ Vérifié (2026-08-12) |
| `SYSTEME/TICKETS.md` | Système de tickets (`bug_tickets`), formulaire `/tickets/new`, triage `/admin/tickets`, méthodologie | ✅ Vérifié (2026-08-12) |
| `SYSTEME/CONVENTIONS.md` | Règles immuables et pièges actifs (codes P/PE/PI/PEF) | ✅ Vérifié (2026-07-29) |
| `SYSTEME/ARCHITECTURE_SOCKET.md` | Architecture modulaire des WebSockets, coordinateur, hooks client | ✅ Vérifié (2026-07-20) |
| `SYSTEME/REACT.md` | Conventions React : hooks, dependency arrays, patterns, raccourcis clavier | ✅ Vérifié (2026-07-29) |
| `SYSTEME/MODING.md` | Système de mods d'armes : deux générations coexistantes, registre à hooks | ✅ Vérifié (2026-07-21) |
| `SYSTEME/CHAT.md` | Système de chat : architecture, flux, types de messages, événements WS | ✅ Vérifié (2026-08-04) |
| `SYSTEME/ASSETS.md` | MinIO, textures, Atelier GM, uploads, chemins assets | ✅ Vérifié (2026-07-15) |
| `SYSTEME/MATERIAUX.md` | Pipeline de matériaux procédural : génération, cache, flux de données | ✅ Vérifié (2026-08-02) |
| `SYSTEME/LOCALISATION.md` | Système d'internationalisation (i18n), namespaces, pattern serveur de traduction | ✅ Vérifié (2026-07-23) |
| `SYSTEME/MANIFESTE_OBJETS_3D.example.json` | Exemple de manifeste d'asset 3D (non .md) | Référence |

### 3.5 Marchands & Échange
| Document | Responsabilité | Statut |
|----------|----------------|--------|
| `SYSTEME/TRADE.md` | Marchands (catalogue, achat), échange PJ↔PJ, revente PJ→GM, transfert direct | ✅ Vérifié (2026-08-07) |

### 3.6 Exo-armures
| Document | Responsabilité | Statut |
|----------|----------------|--------|
| `SYSTEME/EXOARMURE.md` | Schéma catalogue/instance, source exclusive d'équipement, services (applyExoTemplate, exoAvarieService, computeExoStats), routes, illustration | ✅ Vérifié (2026-08-21) |

### 3.7 Éditeur & création
| Document | Responsabilité | Statut |
|----------|----------------|--------|
| `SYSTEME/EDITEUR.md` | Infrastructure de l'éditeur : onglets, undo/redo, sauvegarde, chargement textures | ✅ Vérifié (2026-08-02) |
| `SYSTEME/CREATION_OBJETS_3D.md` | Guide de fabrication des GLB et rédaction du manifeste | ✅ Vérifié (2026-08-03) |
| `SYSTEME/ENTITES.md` | Entités libres : cycle de vie, blueprints, placement, rendu, persistance | ✅ Vérifié v2.1 (2026-08-02) |

---

## 4. REGLES — Règles RAW du Livre de Base Polaris

> **Statut des REGLES :** Source de vérité brute extraite du Livre de Base.
> Pour l'implémentation, **privilégier le MANUEL correspondant s'il existe**.
> Les dates indiquées sont celles du fichier.

### 4.1 Règles générales
| Document | Responsabilité | Date |
|----------|----------------|------|
| `REGLES/REGLEPOLARIS.md` | Règles de base de Polaris (synthèse) | 2026-07-18 |
| `REGLES/ATTRIBUTS.md` | Caractéristiques et attributs des personnages | 2026-07-21 |
| `REGLES/REGLECOMPETENCE.md` | Compétences et spécialisations | 2026-07-02 |
| `REGLES/REGLEREVERS.md` | Revers (handicaps, défauts) | 2026-07-09 |
| `REGLES/REVERS PROFESSIONNELS.md` | Revers propres à chaque profession | 2026-07-21 |
| `REGLES/AVANTAGES ALEATOIRE.md` | Table des avantages aléatoires | 2026-07-21 |
| `REGLES/AVANTAGES PROFESSIONNELS.md` | Avantages liés aux professions | 2026-07-21 |
| `REGLES/REGLECACARTMARTIAUX.md` | Arts martiaux et combat rapproché | 2026-07-20 |

### 4.2 Combat et équipement
| Document | Responsabilité | Date |
|----------|----------------|------|
| `REGLES/REGLESYSCOMBAT.md` | Système de combat complet (tours, actions, dégâts) | 2026-06-08 |
| `REGLES/REGLESMUNITIONS.md` | Munitions spéciales (Choc, etc.) | 2026-07-16 |
| `REGLES/REGLEARMURE.md` | Règles d'armure, bouclier, exo-armure — **voir aussi MANUELEXOARMURE.md** | 2026-06-12 |
| `REGLES/REGLEBOUCLIER.md` | Règles spécifiques du bouclier | 2026-07-18 |
| `REGLES/REGLEDRONE.md` | Règles des drones (autonomie, programmes) | 2026-06-05 |
| `REGLES/REGLE_USURE&INTEGRITE.md` | Équipement général, NT, Intégrité, Tests de panne, usure, réparation | 2026-08-06 |

### 4.3 Blessures et fatigue
| Document | Responsabilité | Date |
|----------|----------------|------|
| `REGLES/REGLEBLESSURES.md` | Règles des blessures, guérison | 2026-07-30 |
| `REGLES/FATIGUE&DOMMAGES.md` | Règles de fatigue et dommages | 2026-07-22 |

### 4.4 Création de personnage
| Document | Responsabilité | Date |
|----------|----------------|------|
| `REGLES/REGLE_AVANTAGES.md` | Avantages et désavantages à la création | 2026-06-25 |
| `REGLES/REGLE_CREATION.md` | Procédure complète de création de personnage | 2026-06-28 |
| `REGLES/REGLE_MUTATION.md` | Règles de mutations | 2026-06-28 |
| `REGLES/REGLE_PROFESSION.md` | Choix de la profession, compétences associées | 2026-06-28 |

---

## 5. MANUEL — Règles traduites en logique de jeu

| Document | Responsabilité | Statut |
|----------|----------------|--------|
| `MANUELEXOARMURE.md` | Logique de l'exo-armure (traduction des règles RAW) | À jour |

*(Section à développer avec d'autres manuels similaires si nécessaire)*

---

## 6. PLANS — Spécifications de chantier (temporaires, Règle 10)

> `docs/PLANS/*.md` — un fichier par chantier, archivé ou supprimé une fois la fonctionnalité livrée
> (contenu durable transféré au DOMAIN/SYSTEM concerné). **Le statut courant de chaque plan (prêt à
> coder, à cadrer, bloqué, périmé) vit dans `docs/ROADMAP.md`, jamais dupliqué ici** — cette liste
> n'indique que l'existence et le sujet du fichier.

| Document | Sujet |
|----------|-------|
| `PLANS/PLAN_EXOARMURE.md` | Exo-armures (v2) |
| `PLANS/PLAN_ENVIRONNEMENT_MILIEUX.md` | Milieu (submarine/surface/atmo/spatial) par pièce, moteur monde |
| `PLANS/PLAN_LOCALISATION.md` | Résorption du texte en dur (i18n), client et données `ref_*` |
| `PLANS/PLAN_FATIGUE_DOMMAGES.md` | Fatigue, blessures, dangers environnementaux, horloge de campagne |
| `PLANS/PLAN_ARMES_SPECIALES.md` | Fouets/chaînes, fusil à pompe, lance-flammes, grenades/mines |
| `PLANS/PLAN_DECALS.md` | Décorations murales placées (câbles, panneaux) |
| `PLANS/PLAN_RW_MATERIAUX.md` | Rework matériaux/textures (base PBR + procédural) |
| `PLANS/PLAN_USURE&INTEGRITE.md` | Usure/Intégrité du matériel, Tests de panne |
| `PLANS/PLAN_MORAL.md` | Règle optionnelle du Moral |
| `PLANS/PLAN_INTERACTIONS_CONNECTEURS.md` | Interaction joueur porte/échelle en session |
| `PLANS/PLAN_RW_TOKEN.md` | Animations squelettiques de tokens (en-tête réel : `PLAN_ANIMATIONS.md`) |
| `PLANS/PLAN_ADMIN_BACKUP.md` | Sauvegarde automatique de l'instance |
| `PLANS/PLAN_BATTLEMAP2D.md` | Battlemap en illustration/tokens 2D |

---

## 7. META — Documentation du projet lui-même

| Document | Responsabilité | Statut |
|----------|----------------|--------|
| `RegleDocumentaire.md` | Règles de classement et d'écriture de la documentation | Invariant |
| `ASBUILT.md` | Ce qui est déployé et stable | Vivant |
| `EN_COURS.md` | Dettes actives et prochaine étape | Vivant |
| `ROADMAP.md` | Planification des sprints futurs | Vivant |
| `JOURNAL8.md` | Décisions et validations durables de la session | Vivant |
| `AUDIT.md` | Audit du projet | Référence |
| `SERVEURDISTANTKIWI.md` | Configuration du serveur distant (Kiwi) | Utilitaire |
| `METHODO_PLAN.md` | Méthodologie de conception des PLANS | Guide |
| `OPTIONS_CAMPAGNE.md` | Options de campagne pour le MJ | Référence |
| `JOURNALTEMP.md` | Notes temporaires (non partagé) | Éphémère |

---

## Utilisation pour un agent IA

1. **Au chargement d'une session** : lire `FOUNDATION.md`, puis `VOCABULARY.md`, puis cet index.
2. **Pour savoir ce qui est actif/à faire** : `docs/ROADMAP.md` (chantiers) et `docs/EN_COURS.md`
   (dettes/points de vigilance) — les bugs suivis vivent dans `bug_tickets` (`/admin/tickets`), pas
   dans ces deux fichiers.
3. **Lorsqu'un domaine est abordé** (ex: combat) : se référer à la section SYSTEME correspondante, puis aux REGLES associées, puis au MANUEL si applicable.
4. **Pour une nouvelle fonctionnalité** : consulter d'abord les REGLES brutes, puis le MANUEL associé,
   puis le PLAN s'il existe déjà (§6) et son statut dans `docs/ROADMAP.md`, avant de coder.