---
description: Migrations Knex — numérotation, nodemon, rollback, seeds
paths:
  - "server/src/db/migrations/**"
  - "server/src/db/seeds/**"
  - "server/knexfile*"
  - "server/src/db/knex*"
---

# Migrations

**Lire `docs/SYSTEME/CORE.md` § « Migrations — pièges (P52-P56) » avant toute migration** —
détail vécu, procédures sûres et exemples d'incidents. Cette règle n'en est que le rappel rapide.

## Invariants

- Numérotation : prochain entier libre, vérifié à la fois sur `ls server/src/db/migrations/`
  **et** sur la table `knex_migrations` — jamais depuis `docs/EN_COURS.md` seul (peut être en
  retard sur un travail parallèle). Le tri lexical fait cohabiter `9_`, `98_`, `100_` : ne
  jamais s'y fier.
- `nodemon` watch tout `server/` et `server/src/index.js` appelle `db.migrate.latest()` au
  démarrage → **écrire un fichier sous `server/` auto-applique les migrations en attente**.
  Aucun fichier de test/scratch sous `server/` ; vérifications en `node -e` inline.
- Ne jamais rappeler `mig.up(knex)` / `mig.down(knex)` sans avoir `SELECT` la ligne dans
  `knex_migrations` d'abord (nodemon a pu l'appliquer entre-temps — un 2ᵉ `up()` corrompt des
  données déjà correctes, silencieusement).
- Tester un round-trip en important le module et en appelant `up()`/`down()` directement —
  **jamais la CLI knex brute** (`migrate:latest`/`:down` sans argument cible mal par tri lexical).
- Une migration est rétrocompatible avec le code encore déployé au moment où elle s'applique.
- Migration + test + éventuel script de réparation = un seul commit isolé sur la branche de
  travail ; ne pas pousser avant validation de la migration et du code consommateur.
- Une table = un fichier `NNN_table.js` (structure) + `NNN_table_constraints.js` (index / PK /
  UNIQUE / CHECK / FK) + si données de référence `NNN_table_seed.js`. Jamais de correction
  empilée sur une migration antérieure.
- Un seed / une migration ne référence jamais l'`id` UUID d'une ligne seedée : matcher par clé
  naturelle (`name`, …), cf. `SEED-ID-DETERM` dans `rules/core.md`. Auditer un seed figé depuis
  une base vivante par clé naturelle contre un rejeu neuf, jamais aveuglément.
- `node --test` sans argument découvre aussi `server/src/db/migrations_archive/*.test.mjs`
  (schémas retirés) : vérifier le chemin de chaque échec avant de conclure à une régression.
