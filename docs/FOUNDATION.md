# FOUNDATION.md — Principes fondateurs d'Enclume

## 1. Mission

Enclume est un VTT (Virtual TableTop) en 3D dédié au jeu de rôle **Polaris**.
Il automatise les mécaniques complexes du système : combat, matériel et compétences.

### Objectifs par version

| Version | Contenu | Statut |
|---|---|---|
| v1 | VTT permettant de combattre et de suivre une campagne de Polaris | Moteur/boucle de jeu atteint à 99 % — la couverture RAW complète (armes spéciales, usure/intégrité, moral, etc.) reste un chantier continu, suivie dans `docs/ROADMAP.md`, pas un reste à faire pour clore v1 |
| v2 | Système d'exo-armure | En cours (`docs/PLANS/PLAN_EXOARMURE.md`) |
| v3 | Exploration et combat sous-marins (abysses) | Envisagé, non cadré — aucun PLAN écrit à ce jour ; `docs/PLANS/PLAN_ENVIRONNEMENT_MILIEUX.md` prépare l'infrastructure (détection de milieu) mais ne couvre pas le contenu v3 lui-même |
| vX | Ouverture au public | Futur |

### Projet 2 — Jeu vidéo tactique

Un projet distinct, dérivé du VTT : jeu multijoueur de batailles tactiques en équipe (style X-COM).
**Idée future, non cadrée** — aucun document, aucun développement prévu à court terme.

## 2. Invariant absolu

**Les règles du Livre de Base Polaris priment toujours.**
Toute simplification, adaptation ou écart par rapport au RAW est une décision explicite,
discutée et documentée — jamais un raccourci silencieux.

### Ordre de priorité : backend avant frontend (Saar, 2026-08-25)

Le système de règles Polaris est vaste — la couverture RAW complète du backend (Tests, Combat, États
de santé, Force Polaris, Équipement, Armures mécanisées) prime sur le travail purement esthétique/
frontend (silhouettes, animations, décors, polish visuel) tant qu'elle n'est pas achevée. État détaillé
chapitre par chapitre : `docs/SYSTEME/COUVERTURE_RAW.md`. Conséquence concrète : un chantier
esthétique (ex. `docs/PLANS/PLAN_RW_TOKEN.md`, animations de tokens) reste valide mais non prioritaire
tant que des mécaniques RAW entières manquent encore côté serveur.

## 3. Hiérarchie de fidélité d'une règle de jeu

> Cette hiérarchie répond à « à quel point ce que dit ce document/ce code est fidèle au Livre de
> Base ? ». Elle est **distincte** de la hiérarchie d'autorité documentaire (quel type de fichier
> l'emporte en cas de contradiction entre deux `.md`), définie dans `docs/RegleDocumentaire.md` §12
> et rappelée dans `CLAUDE.md` §1 — ne pas confondre les deux tables malgré le mot « hiérarchie »
> commun aux deux.

| Niveau | Rôle | Exemples |
|---|---|---|
| REGLES | Règles brutes du Livre de Base Polaris | `docs/REGLES/REGLESYSCOMBAT.md` |
| MANUEL | Règles traduites en logique de jeu exécutable | `docs/MANUELEXOARMURE.md` |
| CODE | Implémentation effective — ne contredit jamais le MANUEL | `server/src/lib/combat/` |
| PLAN | Spécifications d'une fonctionnalité à venir — périmées une fois implémentées | `docs/PLANS/PLAN_*.md` |
| HYPOTHESE | Notes temporaires, pistes non validées — ne jamais implémenter sans validation préalable | `docs/JOURNALTEMP.md` |

Un niveau ne peut jamais contredire un niveau supérieur.
Toute contradiction entre CODE et REGLES est un bug, pas une feature.

## 4. Orientation dans la documentation

Pour un agent qui découvre le projet, dans l'ordre :

- `docs/SYSTEME/INDEX.md` — carte complète de la documentation (malgré son emplacement sous
  `SYSTEME/`, c'est le point d'entrée pour tout le projet, pas seulement l'architecture technique).
- `docs/VOCABULARY.md` — définitions des termes Polaris et Enclume, à vérifier avant d'introduire un
  nouveau concept métier.
- `docs/SYSTEME/` — architecture technique du projet (un domaine/système par fichier).
- `docs/REGLES/` — règles brutes extraites du Livre de Base.
- `docs/ROADMAP.md` — planification prospective : quels chantiers sont actifs, à cadrer ou bloqués.
- `docs/EN_COURS.md` — dettes actives et point de vigilance courant (les bugs suivis vivent dans
  `bug_tickets`, écran `/admin/tickets`, `docs/SYSTEME/TICKETS.md` — pas dans ce fichier).
- `docs/PLANS/*.md` — spécification détaillée d'un chantier précis, temporaire (Règle 10) ; l'état de
  chacun (prêt, à cadrer, bloqué, périmé) est résumé dans `docs/ROADMAP.md`, pas dupliqué ici.

## 5. Hors scope

- Supporter d'autres jeux de rôle que Polaris.
- Remplacer le Livre de Base — Enclume est un outil, pas une encyclopédie des règles.