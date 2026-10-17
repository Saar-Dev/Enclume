# Refactor « squash » des migrations — baseline unique

> Décision actée par Saar le 17/10/2026, dans le cadre de la préparation du déploiement
> Hammer (installation entièrement neuve, aucune donnée récupérée de Kiwi).

## Pourquoi

La chaîne historique compte 394 fichiers de migrations, hérités d'une consolidation
(22/08/2026) suivie de trois mois d'évolutions, dont un doublon de numérotation (328).
Le projet repart sur une architecture vierge (Hammer) : aucune base vivante n'est
attachée à la chaîne. C'est donc le moment idéal pour condenser l'historique en une
**migration de référence unique** (`000_baseline`), générée mécaniquement — jamais
écrite à la main — et de faire redémarrer la numérotation des évolutions à `001_`.

## Ce que fait l'outil

`tools/squash/run-squash.mjs` exécute en une commande :

1. **Test base vierge** : PostgreSQL 16 jetable (Docker, `127.0.0.1:55432`),
   la chaîne complète s'y joue intégralement — c'est la validation §6.1 de l'audit,
   industrialisée. Si la chaîne échoue, le squash s'arrête là et on corrige d'abord.
2. **Génération** : `pg_dump` de la base validée → `000_baseline.sql`
   (schéma + données de référence ; la table `knex_migrations` en est exclue).
   Le wrapper `000_baseline.js` (dans le dépôt) l'exécute via `knex.raw()`.
3. **Archivage** : les 394 fichiers historiques partent dans
   `server/src/db/migrations-archive/` via `git mv` (conservés pour l'histoire
   et la documentation, hors de la chaîne active).
4. **Preuve d'équivalence** : la baseline seule est rejouée sur une seconde base
   jetable ; les deux `pg_dump` sont comparés **mot à mot**. Diff nul = la baseline
   est rigoureusement identique à ce que produisait la chaîne complète.
   Sinon : **rollback automatique** et dumps conservés dans `tools/squash/last-run/`
   pour analyse. Rien n'est cassé.

## Prérequis

- Docker (Desktop) lancé
- Node 20+
- git
- `cd server && npm install` fait au moins une fois

⚠️ Le dépôt doit être **propre** (aucune modification non commitée) : c'est ce qui
garantit le rollback automatique. Le script le vérifie et refuse de démarrer sinon.

## Procédure (une seule commande)

```bash
node tools/squash/run-squash.mjs
```

En cas de succès, suivre les commandes affichées en fin d'exécution (commit du
résultat, push), puis ouvrir une PR vers `dev/Saar`, la relire (diff complet :
déplacements + `000_baseline.js` + `000_baseline.sql`) et fusionner uniquement
après relecture.

### Base de dev locale après le squash

La chaîne ayant changé, la base locale doit repartir de la baseline :

```bash
# (optionnel, pour garder tes données de test) sauvegarde d'abord :
docker exec <conteneur_pg> pg_dump -U <user> --inserts <db> > backup-avant-squash.sql

docker compose down -v && docker compose up -d   # base vide
# relancer le backend : migrate.latest() applique 000_baseline
```

### Kiwi

Sans objet : Kiwi est hors service et la décision de ne rien récupérer est prise.
Si un jour on veut des données de Kiwi, elles passeront par un dump/restore de
**données**, jamais par la chaîne de migrations.

## Règles à partir du squash (IMPORTANT — pour les humains ET les agents IA)

1. **`000_baseline.sql` est un artefact généré** : ne jamais l'éditer à la main.
   Toute évolution = une **nouvelle** migration `001_`, `002_`...
2. **Numérotation repart de 001** ; avant de committer une nouvelle migration,
   lancer `node tools/check-migration-duplicates.mjs` (échoue en cas de collision —
   c'est la garde qui empêche un nouveau « doublon 328 »).
3. **Format inchangé** : modules ESM (`export const up`, `export const down`),
   tri par `NaturalMigrationSource` (numéro, puis suffixe lettre, puis nom).
4. Les migrations historiques archivées ne sont **jamais** rechargées, renommées
   ni modifiées ; les docs et commits anciens qui y font référence restent valables
   historiquement.
5. Toute future migration qui dépend de données du référentiel les cible par
   **clé métier** (`name`, `family`...), pas par `id`, sauf ids déterministes
   figés dans la baseline (discipline héritée de la consolidation d'août).

## Retour arrière

- **Avant commit** : le script fait le rollback lui-même en cas d'échec de la
  preuve d'équivalence.
- **Après commit, avant fusion** : `git checkout dev/Saar && git branch -D refactor/squash-baseline`.
- **Après fusion** : `git revert` du commit de fusion sur `dev/Saar` (les fichiers
  historiques reviennent à leur place d'origine car tout est dans un seul commit).
