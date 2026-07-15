# Paquet de contrat Enclume

Ce dossier est une proposition locale. Sa création n'a modifié aucun serveur.

## Contenu

- `CLAUDE.md` : contrat commun concis chargé par Claude.
- `AGENTS.md` : chargeur et contrat équivalent pour Codex.
- `.claude/rules/*.md` : règles spécialisées routées par chemins.

## Installation proposée

Après validation par les deux développeurs, depuis la racine du dépôt cible :

1. vérifier `git status --short --branch` et préserver les changements présents;
2. comparer les fichiers existants avec cette proposition;
3. sauvegarder les anciennes versions dans un emplacement local hors dépôt si nécessaire;
4. copier `CLAUDE.md`, `AGENTS.md` et le dossier `.claude/rules` à la racine;
5. ne copier ni `.env`, ni `.claude/settings.local.json`, ni cache, secret ou configuration machine;
6. relire le diff et valider ensemble avant commit sur la branche de travail appropriée.

Claude applique automatiquement les règles dont le frontmatter `paths` correspond aux fichiers.
Codex suit `AGENTS.md`, lit `conventions.md`, puis effectue lui-même le même routage avant d'agir.

## Limite volontaire

Ce paquet ne contient aucun état courant détaillé du projet. Branches, prochaine tâche, dettes et
déploiements restent dans les documents autoritaires du dépôt afin d'éviter une copie périmée.
