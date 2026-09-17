# INDEX.md — Carte documentaire d’Enclume

> Version : 2026-09-11 — §5 (MANUEL) et §6 (PLAN) complétés par relecture directe de `docs/MANUELS/`
> et `docs/PLANS/` (9 MANUEL et 24 PLAN, contre 1 et 15 précédemment listés — les deux sections
> avaient divergé du contenu réel des dossiers sans qu'aucun mécanisme ne le signale). Colonne
> Couverture enrichie d'une phrase par document plutôt qu'un simple sujet, à la demande de Saar.
> Précédent : 2026-08-26 — §8 Carte de dépendances ajoutée (couplages inter-systèmes confirmés par
> lecture de code, alimentée au fil de l'audit de compréhension approfondie) ; légende étendue avec
> le statut 🔎 (distinct de ✅, voir §8). Avant : 2026-08-25 — section PLANS ajoutée (§6, pointeur
> vers docs/ROADMAP.md pour le statut), entrée FOUNDATION.md rafraîchie (n'est plus un squelette),
> hiérarchie de chargement alignée sur RegleDocumentaire.md §12/CLAUDE.md §1. 2026-08-12 — ajout
> SYSTEME/ADMIN.md et SYSTEME/TICKETS.md.
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
`docs/RegleDocumentaire.md` §12 et `AGENTS.md` § Autorités & routage, à ne pas faire diverger).

---

## 1. FOUNDATION — Principes immuables

| Document | Responsabilité | Statut |
|----------|----------------|--------|
| `FOUNDATION.md` | Mission, versions (v1-vX), invariant RAW, hiérarchies, orientation documentaire | ✅ Vérifié (2026-08-25) |
| `SYSTEME/COUVERTURE_RAW.md` | État d'implémentation du Livre de Base, chapitre par chapitre — opérationnalise le principe "backend avant frontend" de FOUNDATION.md §2 | ✅ Créé (2026-08-25) |

---

## 2. VOCABULARY — Glossaire officiel

| Document | Responsabilité | Statut |
|----------|----------------|--------|
| `VOCABULARY.md` | Définitions des termes Polaris et Enclume, acronymes, levée d’ambiguïtés | À jour |

---

## 3. SYSTEME — Architecture technique

> **Légende :** ✅ = vérifié par lecture complète en session (fact-check ponctuel : numéros de
> migration, noms de table, code cité). 🔎 = analysé en profondeur (doc confronté au code source
> réel, dépendances vers d'autres systèmes tracées explicitement — voir §8 Carte de dépendances).
> Les dates indiquées sont celles de dernière modification du fichier.

### 3.1 Moteur monde & spatial
| Document | Responsabilité | Statut |
|----------|----------------|--------|
| `SYSTEME/MOTEUR_MONDE.md` | Compilation, navigation, collision, LOS, WorldSnapshot | 🔎 Analysé en profondeur (2026-08-26) |
| `SYSTEME/SURFACES_SALLES.md` | Éditeur de surface, salles, murs, connecteurs, profils, eau | 🔎 Analysé en profondeur (2026-08-26) |
| `SYSTEME/VOXELS.md` | Conventions de coordonnées 3D (PE14, PE34), pièges voxels | 🔎 Analysé en profondeur (2026-08-26) |

### 3.2 Combat
| Document | Responsabilité | Statut |
|----------|----------------|--------|
| `SYSTEME/COMBAT.md` | Architecture de combat, intégration avec le moteur monde | 🔎 Analysé en profondeur (2026-08-26) |
| `SYSTEME/COMBAT REFERENCE.md` | Source de vérité unique — règles LdB + implémentation, pipelines, écarts, matrice de régression, drones | 🔎 Analysé en profondeur (2026-08-26) |
| `SYSTEME/COMBAT_FLUX.md` | Flux de combat : initiative, tours, résolution | 🔎 Analysé en profondeur (2026-08-26) |
| `SYSTEME/SERVICES_COMBAT.md` | Services backend pour le combat | 🔎 Analysé en profondeur (2026-08-26) |
| `SYSTEME/DOMMAGES.md` | Distinction dommages physiques/Choc, autorités de résolution | 🔎 Analysé en profondeur (2026-08-26) |
| `SYSTEME/TAILLE.md` | Palier de taille d'un combattant : cascade explicite→dérivée, modificateur de combat, édition MJ | ✅ Créé (2026-09-08) |
| `SYSTEME/BLESSURES.md` | Gestion des blessures, armures, malus, inventaire médical | 🔎 Analysé en profondeur (2026-08-26) |
| `SYSTEME/DICE.md` | Flux des dés, animation 3D, payload DICE_RESULT | 🔎 Analysé en profondeur (2026-08-26) |

### 3.3 Personnage
| Document | Responsabilité | Statut |
|----------|----------------|--------|
| `SYSTEME/CHARACTER.md` | Architecture complète : schéma SQL, API, flux, logique métier, composants React, pièges PC1–PC24 (corrigé 2026-08-26, était PC22) | 🔎 Analysé en profondeur (2026-08-26) |
| `SYSTEME/CHARACTER_FLUX.md` | Flux de données, dépendances composants, synchronisation UI/API | 🔎 Analysé en profondeur (2026-08-26) — moitié inventaire/blessures périmée, voir bannière |
| `SYSTEME/PERSONNAGE_API.md` | API serveur pour les personnages : routes, droits, événements WS | 🔎 Analysé en profondeur (2026-08-26) |
| `SYSTEME/PERSONNAGE_CALCULS.md` | Chaîne de calcul des attributs, compétences, seuils et résistances | 🔎 Analysé en profondeur (2026-08-26) |
| `SYSTEME/PERSONNAGE_WIZARD.md` | Assistant de création de personnage en 6 étapes, architecture client-primary, collaboration temps réel MJ/joueur | 🔎 Analysé en profondeur (2026-08-26) |

### 3.4 Infrastructure
| Document | Responsabilité | Statut |
|----------|----------------|--------|
| `SYSTEME/CORE.md` | Auth, stores, WebSocket, migrations | 🔎 Analysé en profondeur (2026-08-26) |
| `SYSTEME/ADMIN.md` | Rôle administrateur global, page `/admin`, garde dernier admin, outils gérés | 🔎 Analysé en profondeur (2026-08-26) |
| `SYSTEME/TICKETS.md` | Système de tickets (`bug_tickets`), formulaire `/tickets/new`, triage `/admin/tickets`, méthodologie | 🔎 Analysé en profondeur (2026-08-26) |
| `SYSTEME/CONVENTIONS.md` | Règles immuables et pièges actifs (codes P/PE/PI/PEF) | 🔎 Analysé en profondeur (2026-08-26) |
| `SYSTEME/ARCHITECTURE_SOCKET.md` | Architecture modulaire des WebSockets, coordinateur, hooks client | 🔎 Analysé en profondeur (2026-08-26) |
| `SYSTEME/REACT.md` | Conventions React : hooks, dependency arrays, patterns, raccourcis clavier | 🔎 Analysé en profondeur (2026-08-26) |
| `SYSTEME/MODING.md` | Système de mods d'armes : deux générations coexistantes, registre à hooks | 🔎 Analysé en profondeur (2026-08-26) |
| `SYSTEME/CHAT.md` | Système de chat : architecture, flux, types de messages, événements WS | 🔎 Analysé en profondeur (2026-08-26) |
| `SYSTEME/ASSETS.md` | MinIO, textures, Atelier GM, uploads, chemins assets | 🔎 Analysé en profondeur (2026-08-26) |
| `SYSTEME/MATERIAUX.md` | Pipeline de matériaux procédural : génération, cache, flux de données | 🔎 Analysé en profondeur (2026-08-26) |
| `SYSTEME/LOCALISATION.md` | Système d'internationalisation (i18n), namespaces, pattern serveur de traduction | 🔎 Analysé en profondeur (2026-08-26) |
| `SYSTEME/MANIFESTE_OBJETS_3D.example.json` | Exemple de manifeste d'asset 3D (non .md) | Référence |

### 3.5 Marchands & Échange
| Document | Responsabilité | Statut |
|----------|----------------|--------|
| `SYSTEME/TRADE.md` | Marchands (catalogue, achat), échange PJ↔PJ, revente PJ→GM, transfert direct | 🔎 Analysé en profondeur (2026-08-26) |

### 3.6 Exo-armures et Informatique (ordinateurs, IEM)
| Document | Responsabilité | Statut |
|----------|----------------|--------|
| `SYSTEME/EXOARMURE.md` | Schéma catalogue/instance, source exclusive d'équipement, services (applyExoTemplate, exoAvarieService, computeExoStats), routes, illustration | 🔎 Analysé en profondeur (2026-08-26) |
| `SYSTEME/INFORMATIQUE.md` | Ordinateurs (schéma/formules), catalogue de programmes, Test de panne générique et IEM (Repository pattern), machine à états Survie I.E.M., auto-désactivation Gestion systèmes | Créé 2026-09-16, chantier `PLAN_INFORMATIQUE.md` (couches 1-2) clos et archivé (`docs/Old/`) |

### 3.7 Éditeur & création
| Document | Responsabilité | Statut |
|----------|----------------|--------|
| `SYSTEME/EDITEUR.md` | Infrastructure de l'éditeur : onglets, undo/redo, sauvegarde, chargement textures | 🔎 Analysé en profondeur (2026-08-26) |
| `SYSTEME/CREATION_OBJETS_3D.md` | Guide de fabrication des GLB et rédaction du manifeste | 🔎 Analysé en profondeur (2026-08-26) |
| `SYSTEME/ENTITES.md` | Entités libres : cycle de vie, blueprints, placement, rendu, persistance | 🔎 Analysé en profondeur (2026-08-26) |

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

> `docs/MANUELS/*.md` — traduit une RAW en logique de jeu (quoi faire, jamais comment), pont entre
> REGLES et PLAN (`GABARIT_MANUEL.md` fixe le patron). Cycle de vie : Rédaction → Validation Saar →
> Passage au PLAN → Archivage — un MANUEL n'est plus modifié une fois le PLAN démarré (toute évolution
> ultérieure est un nouveau MANUEL, ex. `MANUEL_EXOARMURE_V2.md`).

| Document | Couverture | Statut |
|----------|------------|--------|
| `MANUELS/GABARIT_MANUEL.md` | Modèle/gabarit à suivre pour tout MANUEL — pas un chantier | Référence |
| `MANUELS/MANUEL_CREATION_CHAPEAU.md` | Document chapeau « Création de personnage » : articulation des 5 étapes, budget de Points de Création, vocabulaire commun | Rédigé 2026-08-04 |
| `MANUELS/MANUEL_CREATION_ETAPE1_ATTRIBUTS.md` | Étape 1 : Attributs principaux (valeur de base, coûts progressifs) + Chance de base | Rédigé 2026-08-04 |
| `MANUELS/MANUEL_CREATION_ETAPE2_GENETIQUE.md` | Étape 2 : type génétique (humain normal, hybride naturel, géno-hybride, techno-hybride) | Rédigé 2026-08-04 |
| `MANUELS/MANUEL_CREATION_ETAPE3_CAPACITES.md` | Étape 3 : mutations (achat/tirage), Force Polaris latente/maîtrisée | Rédigé 2026-08-04 |
| `MANUELS/MANUEL_EXOARMURE.md` | Armures mécanisées : types/catégories, combat en armure, gestion des dommages (Avaries, incidents) | Réécrit 2026-08-04 — **partiel** : ne couvre pas Lot C (ordinateurs/programmes, `PLAN_EXOARMURE.md` §13.4) |
| `MANUELS/MANUEL_USURE.md` | Usure & Intégrité du matériel : qualité/ITG, Tests de panne, réparation | v1.5 — V1 (L0-L7) close et validée en jeu réel |
| `MANUELS/MANUEL_INFORMATIQUE.md` | Ordinateurs (capacités/couche 1) + catalogue de programmes (couche 2) ; IEM/pannes électroniques | Réécrit 2026-09-11 (conformité gabarit) — couches 1-2 codées et closes, architecture dans `SYSTEME/INFORMATIQUE.md` ; couches 3-5 (piratage/conception/virus) pas encore écrites |
| `MANUELS/MANUEL_CHANCE.md` | Dépense de points de Chance : Test de Chance, effets, régénération | v1.0 — rédigé 2026-09-11, RAW fournie par Saar |

---

## 6. PLANS — Spécifications de chantier (temporaires, Règle 10)

> `docs/PLANS/*.md` — un fichier par chantier, archivé ou supprimé une fois la fonctionnalité livrée
> (contenu durable transféré au DOMAIN/SYSTEM concerné). **Le statut détaillé et à jour de chaque
> plan vit dans `docs/ROADMAP.md`, jamais dupliqué ici** — la colonne Couverture explique le
> *périmètre* du document (pour savoir s'il faut l'ouvrir), pas son avancement précis. Mise à jour
> 2026-09-11 : les 24 fichiers présents dans `docs/PLANS/` au moment de l'audit sont listés (9
> absents de la version précédente de cette table).

| Document | Couverture | Repère d'état |
|----------|------------|---------------|
| `PLANS/PLAN_EXOARMURE.md` | Exo-armures (v2) — fondations combat (mouvement, substitution d'attributs, Choc, initiative, posture à terre), **Lot C** (ordinateurs/programmes/systèmes/armement/catalogue de modèles) | Lots 0-3 + 2bis + Lot C codés ; aucune exo réelle testée en navigateur à ce jour |
| `PLANS/PLAN_ENVIRONNEMENT_MILIEUX.md` | Milieu (sous-marin/surface/atmosphérique/spatial) porté par pièce, moteur monde — débloque le milieu hybride exo | Cadrage pur (architecture Option A tranchée), aucun code |
| `PLANS/PLAN_LOCALISATION.md` | i18n : texte en dur (client) puis contenu de catalogue `ref_*` en base | Lots 1-4 (interface) codés ; Lot 5 (catalogue, 10 tables) en cours, Phase A/B partielles |
| `PLANS/PLAN_FATIGUE_DOMMAGES.md` | Horloge de campagne, moteur générique d'échéances (`game_echeances`), Blessures/Guérison, dangers environnementaux (Chute/Acide/Décompression/Feu) | Lots 0-3 clos et confirmés ; Lot 4 (Fatigue) et Lot 6 (Noyade) restants |
| `PLANS/PLAN_ARMES_SPECIALES.md` | Armes spéciales — lance-flammes (Lot 1), fouets/chaînes (hors périmètre → Arts martiaux) | Lot 1 clos ; Lot 2 (grenades) extrait vers `PLAN_GRENADES.md` |
| `PLANS/PLAN_DECALS.md` | Décorations murales posées sur une face de mur (câbles, panneaux, affiches), sans nouveau GLB | Étude du modèle existant + stratégie de rendu tranchée (2026-09-16, recherche pro) — chevauchement avec `PLAN_RW_MATERIAUX.md` Lot 3 résolu (deux concepts distincts, `docs/VOCABULARY.md` « Ambiguïtés connues »), cadrage détaillé restant à écrire |
| `PLANS/PLAN_RW_MATERIAUX.md` | Rework matériaux/textures : base + PBR + procédural par-dessus, Lots 0-4 | Spécifié en détail, aucun code démarré |
| `PLANS/PLAN_USURE&INTEGRITE.md` | Usure/Intégrité du matériel — qualité, ITG, Tests de panne, réparation | V1 (L0-L7) close et validée en jeu réel ; Lot 2 (pièces détachées, entrées Catastrophe #2/#8) restant |
| `PLANS/PLAN_MORAL.md` | Règle optionnelle du Moral | Stub (renvoi RAW seul), rien cadré |
| `PLANS/PLAN_RW_TOKEN.md` | Animations squelettiques de tokens indépendantes du maillage, hitboxes par os (en-tête réel : `PLAN_ANIMATIONS.md`, nom de fichier trompeur) | Différé (philosophie backend-first) ; séquence voulue par Saar pas encore reflétée dans le doc |
| `PLANS/PLAN_ADMIN_BACKUP.md` | Sauvegarde automatique quotidienne de l'instance (PostgreSQL + MinIO, cohérence sans transaction distribuée) | Lots 1-3 prêts à déployer ; Lots 4-5 spécifiés, attend le remplacement du serveur distant Kiwi |
| `PLANS/PLAN_BATTLEMAP2D.md` | Battlemap 2D (illustration pure ou fond d'image + tokens), distinct du Spotlight | Cadrage clos (Lot 0), aucun code, non prioritaire |
| `PLANS/PLAN_AOE.md` | Résolution de zone d'effet (AOE) — socle générique (formes, distance, ciblage, persistance, fan-out PJ/PNJ) | Socle clos et validé ; avancement par arme délégué à `PLAN_ARMES_SPECIALES.md`/`PLAN_GRENADES.md` |
| `PLANS/PLAN_ZONES_DANGER.md` | Fondation « zones dangereuses persistantes » — comment une zone d'effet runtime est résolue tour par tour ; registre `effectLineResolverRegistry` + `dangerCatalog.js` | Cadrage terminé (réécrit propre 2026-09-10), aucun code — prêt à coder Z0 |
| `PLANS/PLAN_WORLD_BUILDER_REWORK.md` | Rework de l'édition de forme des salles (dessiner un volume + éditer les arêtes) ; primitif d'édition 2D partagé avec l'éditeur de zones dangereuses (E-v2) | Direction technique confirmée par recherche pro (2026-09-16, édition de sommets/arêtes sans CSG) ; point UI/UX explicitement ouvert ; cadrage détaillé toujours pas démarré |
| `PLANS/PLAN_CLIC_3D_UNIFICATION.md` | Unifier le cycle de vie des 5 modes de visée 3D (clic, curseur, annulation Échap) — `combatMoveMode`/`combatTargetMode`/`combatAoeTargetMode`/`losMode`/`moveTarget` sont recopiés à la main dans chaque consommateur, sans autorité unique | Stub 2026-09-17, élargi le même jour (curseur + halo de cible câblés pour `moveTarget` seul, patron State/pushdown automaton identifié pour le cadrage), cadrage détaillé non commencé |
| `PLANS/PLAN_AUTORITE_PERSONNAGE_SERVEUR.md` | Unifier « qui peut agir au nom d'un personnage » côté serveur — au moins 3 philosophies de contournement MJ coexistent dans 8+ handlers socket, sans autorité unique | Stub 2026-09-17, correctif ciblé posé (`canActAsCharacter`, `socketUtils.js`, câblé sur `ENTITY_MOVE_REQUEST` seul), cadrage détaillé non commencé |
| `PLANS/PLAN_DIFFICULTE_INTERACTIONS_ENTITES.md` | Difficulté (Test de Poussée/Traction) et surcharge MJ des interactions d'entité — 15 % de réussite avec l'Attribut humain maximal, Difficulté 0 non documentée comme un choix, aucune interface MJ pour la corriger au cas par cas | Stub 2026-09-17, cadrage détaillé non commencé — bloquant réel avant toute utilisation en jeu de Lot A2 |
| `PLANS/PLAN_GRENADES.md` | Grenades et capsules à explosion (Segment 3 des armes de zone) — amorçage, dispersion, explosion différée, dégression par palier, catalogue | Frag + percussion/minuterie clos et validés ; types « à statut »/« à zone » restants, chantier gelé à un point de pause propre |
| `PLANS/PLAN_NUAGE.md` | Armes à nuage volumétrique (fumigènes, gaz de combat) — propagation par compartiments, distinct d'une explosion géométrique | Bloqué/non cadré, attend la fondation zones dangereuses |
| `PLANS/PLAN_KIWI_BASCULE.md` | Bascule de la base `vtt` vers `enclumeBD` sur le serveur distant Kiwi (stratégie A : base neuve + report des données réelles) | En cours — diagnostic fait (`vtt` distant arrêté avant la refonte migrations) |
| `PLANS/PLAN_NATWEAPON_CHOC_DEFENSE.md` | Bug ciblé : Choc de mutation à arme naturelle perdu sur la 4ᵉ branche défenseur PJ en défense active (les 3 autres branches sont correctes) | Cadré, cause identifiée, correctif isolé non encore livré |
| `PLANS/PLAN_CHANCE.md` | Mécanique de dépense de points de Chance — architecture technique (le MANUEL porte la règle métier) | v2.0 réécrite 2026-09-11 (RAW fournie par Saar le jour même) — **cadrage terminé, prêt à coder** |
| `PLANS/PLAN_ENTITES_INTERACTIVES_ROADMAP.md` | Document de séquencement (pas un chantier détaillé) — ordonne les prochains incréments du fil entités interactives ouvert par les caisses (quarantaine, preuve `move_type`, extension à d'autres packs, rendu 3D des portes) | Créé 2026-09-16, Lot A (quick wins) prêt à démarrer, Lots B/C non cadrés en détail |

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

## 8. Carte de dépendances entre systèmes

> Construite au fil de l'audit de compréhension approfondie (🔎, démarré 2026-08-26). Ne liste que
> des couplages **confirmés par lecture de code**, pas des suppositions d'architecture. Chaque ligne
> pointe vers le détail dans le SYSTEME concerné — cette table ne duplique pas l'explication, elle
> sert d'index pour ne pas reperdre un couplage trouvé dans une session antérieure.

| Système A | Système B | Nature du couplage | Détaillé dans |
|---|---|---|---|
| Entités (`socketEntity.js`, `entities.js`) | Moteur monde | Appelle directement `bumpBattlemapRuntimeRevision` (`worldRuntimeService.js`) pour invalider le cache runtime du snapshot | `MOTEUR_MONDE.md` §2.2 |
| Tokens (`tokens.js`, `tokenLifecycle.js`) | Moteur monde | Idem — même helper, même mécanisme | `MOTEUR_MONDE.md` §2.2 |
| Coffre de compte (`vaultService.js`, `vault.js`) | Character (`char-sheet.js`) | Un personnage Coffre (`campaign_id NULL`) n'a pas de GM de campagne : son propriétaire reçoit `req.isVaultOwner = true`, qui ouvre exactement les routes marquées « GM uniquement » (attributs, skills, XP, mutations, sols) sur cette fiche précise | `CHARACTER.md` §1 |

*(Table à compléter à chaque système 🔎 analysé — ne pas la laisser diverger du contenu réel des
docs qu'elle indexe.)*

---

## Utilisation pour un agent IA

1. **Au chargement d'une session** : lire `FOUNDATION.md`, puis `VOCABULARY.md`, puis cet index.
2. **Pour savoir ce qui est actif/à faire** : `docs/ROADMAP.md` (chantiers) et `docs/EN_COURS.md`
   (dettes/points de vigilance) — les bugs suivis vivent dans `bug_tickets` (`/admin/tickets`), pas
   dans ces deux fichiers.
3. **Lorsqu'un domaine est abordé** (ex: combat) : se référer à la section SYSTEME correspondante, puis aux REGLES associées, puis au MANUEL si applicable.
4. **Pour une nouvelle fonctionnalité** : consulter d'abord les REGLES brutes, puis le MANUEL associé,
   puis le PLAN s'il existe déjà (§6) et son statut dans `docs/ROADMAP.md`, avant de coder.