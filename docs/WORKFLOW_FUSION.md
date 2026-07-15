# WORKFLOW_FUSION.md — espaces de développement et instance commune

> Dernière mise à jour : 2026-07-15.
>
> But : permettre aux deux développeurs de travailler indépendamment, puis de valider ensemble une
> fusion déployée sans écraser leurs dépôts, leurs bases de données ou leurs états de partie.

## 1. Topologie officielle

| Rôle | Dépôt serveur | Branche | Client/API | PostgreSQL | Services |
|---|---|---|---|---|---|
| Projet du cousin | `/home/didier/Enclume` | `master` | `8193/8194` | `vtt` | `enclume-client`, `enclume-server` |
| Projet moteur monde | `/home/codex/Enclume-integrated` | `codex/world-engine-integration` | `8293/8294` | `vtt_codex` | `enclume-codex-client`, `enclume-codex-server` |
| Intégration commune | `/home/codex/Enclume-fusion` | `integration` | `8393/8394` | `vtt_fusion` | `enclume-fusion-client`, `enclume-fusion-server` |

Les trois copies utilisent le dépôt distant `https://github.com/Saar-Dev/Enclume.git`, mais aucun
développeur ne travaille directement dans le dépôt de l'autre. L'instance `8393/8394` est un sas de
validation commun, pas un troisième espace de développement fonctionnel.

## 2. Isolation des données

- chaque instance possède sa propre base PostgreSQL et applique ses migrations uniquement à cette
  base ;
- l'intégration utilise la base logique Redis `2` ou, si ce mécanisme change, un préfixe exclusivement
  réservé à `fusion` ;
- l'intégration utilise le bucket MinIO `enclume-assets-fusion` ;
- une copie initiale peut être produite depuis l'environnement monde, mais les écritures ultérieures
  ne doivent pas revenir vers `vtt_codex` ou son bucket ;
- Redis n'est jamais une sauvegarde durable. Les états durables restent dans PostgreSQL.

Les environnements historiques `8193` et `8293` ne sont pas reconfigurés lors de la création de
l'intégration. Leur partage historique éventuel de Redis ou d'assets ne doit pas être reproduit par
le nouvel environnement.

## 3. Cycle de travail

1. Le cousin développe et commit sur sa branche, depuis `/home/didier/Enclume`.
2. Le moteur monde développe et commit sur sa branche, depuis `/home/codex/Enclume-integrated`.
3. Avant fusion, noter les deux commits de tête et créer un tag de restauration sur la tête monde.
4. Sauvegarder le code, PostgreSQL et MinIO de la source choisie pour initialiser l'intégration.
5. Dans `/home/codex/Enclume-fusion`, mettre `integration` à jour depuis la dernière intégration
   validée, puis importer la nouvelle tête avec `git merge --no-commit --no-ff`.
6. Résoudre selon `docs/FUSION_PROJET_COUSIN.md`, en conservant l'autorité monde pour tout calcul
   spatial et l'autorité combat pour les règles non spatiales.
7. Exécuter les tests, le build, le lint ciblé et les scénarios navigateur avant de committer.
8. Déployer le commit validé sur `8393/8394`. Ne jamais déployer un index en conflit ou un worktree
   sale.
9. Publier `integration` sur le dépôt distant afin que les deux développeurs repartent du même commit.
10. Promouvoir ensuite un commit validé vers `master` uniquement lorsqu'il devient la référence du
    projet, sans transformer l'instance commune en environnement de développement direct.

## 4. Règles de fusion

- ne jamais fusionner `origin/fusion-kiwi` dans le moteur v12 : cette branche contient l'ancien
  éditeur Surface v2 et supprimerait des collections canoniques lors d'une sauvegarde ;
- importer les nouvelles versions du cousin depuis sa branche active `master` ou depuis une branche
  explicitement annoncée comme sa nouvelle tête ;
- ne jamais résoudre un conflit spatial en réintroduisant le pathfinder, les collisions ou la LOS
  voxel ;
- les migrations sont résolues avant le serveur, puis le client et enfin la documentation ;
- la documentation fusionnée doit toujours donner les commits source, le point de restauration, les
  ports, la base et le statut réel de la validation ;
- aucun redémarrage de `8193/8194` ou `8293/8294` n'est requis pour livrer `8393/8394`.

## 5. Première intégration

- tête moteur monde : `92ae9a9` (`codex/world-engine-integration`) ;
- tête cousin importée : `bad0190` (`origin/master`) ;
- branche historique explicitement exclue : `37703bf` (`origin/fusion-kiwi`) ;
- tag de restauration : `backup/pre-fusion-20260715-110349` ;
- sauvegarde : `/home/codex/backups/enclume-pre-fusion-20260715-110349` ;
- worktree commun : `/home/codex/Enclume-fusion` ;
- branche commune : `integration`.

Cette première fusion importe le reskin et les réglages de campagne récents du cousin. Le moteur
monde v12, ses routes de persistance, ses migrations et ses services spatiaux restent l'autorité.
La résolution initiale conserve aussi la suppression du gitlink historique `Enclume-codex` et
écarte `.obsidian/workspace.json`, qui est un état de poste personnel et non un livrable partagé.

## 6. Validation et retour arrière

Une livraison commune doit au minimum réussir :

```bash
npm run test:world
node --test client/src/lib/surfaceData.test.mjs
cd client && npm run build
```

Elle doit ensuite être vérifiée sur `8393` avec une carte v12 multi-étages et une vraie session de
combat. En cas d'échec, arrêter uniquement les unités `enclume-fusion-*`, restaurer `vtt_fusion` et
le bucket de fusion, puis replacer `integration` sur le dernier commit validé. Les deux espaces de
développement restent intacts.
