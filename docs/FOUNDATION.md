# FOUNDATION.md — Principes fondateurs d'Enclume

## 1. Mission

Enclume est un VTT (Virtual TableTop) en 3D dédié au jeu de rôle **Polaris**.
Il automatise les mécaniques complexes du système : combat, matériel et compétences.

### Objectifs par version

| Version | Contenu | Statut |
|---|---|---|
| v1 | VTT permettant de combattre et de suivre une campagne de Polaris | Atteint à 99 % |
| v2 | Système d'exo-armure | Prochaine étape |
| v3 | Exploration et combat sous-marins (abysses) | Planifié |
| vX | Ouverture au public | Futur |

### Projet 2 — Jeu vidéo tactique

Un projet distinct, dérivé du VTT : jeu multijoueur de batailles tactiques en équipe (style X-COM).

## 2. Invariant absolu

**Les règles du Livre de Base Polaris priment toujours.**
Toute simplification, adaptation ou écart par rapport au RAW est une décision explicite,
discutée et documentée — jamais un raccourci silencieux.

## 3. Hiérarchie des sources de vérité

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

- `INDEX.md` — carte complète de la documentation.
- `VOCABULARY.md` — définitions des termes Polaris et Enclume.
- `docs/SYSTEME/` — architecture technique du projet.
- `docs/REGLES/` — règles brutes extraites du Livre de Base.

## 5. Hors scope

- Supporter d'autres jeux de rôle que Polaris.
- Remplacer le Livre de Base — Enclume est un outil, pas une encyclopédie des règles.