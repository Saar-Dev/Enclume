# Paquet de contrat Enclume

> **Archivé 2026-09-01** (`docs/PLANS/PLAN_CLAUDEMD_REFONTE.md` Lot 4.1) — le paquet de contrat
> est installé et la collaboration multi-agents (Codex) est terminée. Le contrat vit désormais
> dans `AGENTS.md` à la racine ; `CLAUDE.md` l'importe. Ce document ne décrit plus l'état courant.

Ce dossier est une proposition locale. Sa création n'a modifié aucun serveur.

## Contenu

- `AGENTS.md` : le contrat commun (tool-agnostique).
- `CLAUDE.md` : importe `AGENTS.md` (`@AGENTS.md`) + note sur le chargement auto des règles par Claude Code.
- `.claude/rules/*.md` : règles spécialisées routées par chemins (`paths:`).
- `.claude/hooks/` + `.claude/settings.json` : garde-fous partagés (hook `guard-git-push`, `deny`).

## Installation proposée

Après validation par les deux développeurs, depuis la racine du dépôt cible :

1. vérifier `git status --short --branch` et préserver les changements présents;
2. comparer les fichiers existants avec cette proposition;
3. sauvegarder les anciennes versions dans un emplacement local hors dépôt si nécessaire;
4. copier `AGENTS.md`, `CLAUDE.md`, `.claude/rules/`, `.claude/hooks/` et `.claude/settings.json` à la racine;
5. ne copier ni `.env`, ni `.claude/settings.local.json`, ni cache, secret ou configuration machine;
6. relire le diff et valider ensemble avant commit sur la branche de travail appropriée.

Claude Code applique automatiquement les règles dont le frontmatter `paths` correspond aux fichiers.
Un agent non-Claude lit `AGENTS.md` puis effectue lui-même le même routage de `.claude/rules/*` avant d'agir.

## Limite volontaire

Ce paquet ne contient aucun état courant détaillé du projet. Branches, prochaine tâche, dettes et
déploiements restent dans les documents autoritaires du dépôt afin d'éviter une copie périmée.
