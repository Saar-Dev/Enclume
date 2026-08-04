# WORKFLOW_FUSION.md — espaces de développement et instance commune

> Dernière mise à jour : 2026-07-15.
>
> But : permettre aux deux développeurs de travailler indépendamment, puis de valider ensemble une
> fusion déployée sans écraser leurs dépôts, leurs bases de données ou leurs états de partie.

## 1. Topologie officielle

| Rôle | Dépôt serveur | Branche | Client/API | PostgreSQL | Services |
|---|---|---|---|---|---|
| Travail règles / Claude | `/home/didier/Enclume` | `dev/Saar` | `8193/8194` | `vtt` | `enclume-client`, `enclume-server` |
| Travail moteur monde | `/home/codex/Enclume-integrated` | `dev/monde` | `8293/8294` | `vtt_codex` | `enclume-codex-client`, `enclume-codex-server` |
| Intégration commune | `/home/codex/Enclume-fusion` | `integration` | `8393/8394` | `vtt_fusion` | `enclume-fusion-client`, `enclume-fusion-server` |

Les trois copies utilisent le dépôt distant `https://github.com/Saar-Dev/Enclume.git`, mais aucun
développeur ne travaille directement dans le dépôt de l'autre. L'instance `8393/8394` est un sas de
validation commun, pas un troisième espace de développement fonctionnel.

Après chaque intégration validée, `dev/Saar` et `dev/monde` doivent repartir du même commit
`integration`. La synchronisation porte sur l'historique Git et les fichiers versionnés seulement :
elle ne copie jamais les `.env`, bases PostgreSQL, états Redis, buckets MinIO ou `node_modules`.

Le pare-feu UFW autorise publiquement `8393/tcp` et `8394/tcp`. La box redirige ces ports vers le
serveur et l'instance utilise `http://89.92.219.211:8393` comme origine client et
`http://89.92.219.211:8394` comme API. Les deux services doivent rester protégés par les contrôles
d'authentification applicatifs ; l'ouverture UFW ne remplace jamais ces contrôles.

`CLIENT_URLS` contient explicitement les deux origines autorisées : l'adresse publique et
`http://192.168.1.46:8393`. `server/src/lib/clientOrigins.js` valide et déduplique cette liste pour
Express et Socket.IO. Ne pas remplacer cette liste par `*` : les cookies d'authentification exigent
des origines explicites avec `credentials: true`.

Le client n'encode aucune adresse API pour l'instance de fusion : `VITE_API_URL` est vide. Vite
relaie `/api` et `/socket.io` vers `API_PROXY_TARGET=http://127.0.0.1:8394`. Le navigateur reste donc
sur le même hôte et le même port que la page, que celle-ci soit ouverte par l'adresse LAN ou
publique. Cette règle évite les cookies cross-site et constitue aussi le contrat attendu d'un futur
reverse proxy de production.

## 2. Isolation des données

- chaque instance possède sa propre base PostgreSQL et applique ses migrations uniquement à cette
  base ;
- le cousin utilise exclusivement le bucket `enclume-assets-cousin` ;
- le moteur monde utilise exclusivement le bucket `enclume-assets-monde` ;
- l'intégration utilise la base logique Redis `2` ou, si ce mécanisme change, un préfixe exclusivement
  réservé à `fusion` ;
- l'intégration utilise le bucket MinIO `enclume-assets-fusion` ;
- une copie initiale peut être produite depuis l'environnement monde, mais les écritures ultérieures
  ne doivent pas revenir vers `vtt_codex` ou son bucket ;
- Redis n'est jamais une sauvegarde durable. Les états durables restent dans PostgreSQL.

Le bucket historique `enclume-assets` n'est plus utilisé en écriture par une instance active. Son
contenu initial a été cloné vers les deux buckets de développement lors de la première remise à
niveau commune. Il reste une source de restauration historique, pas un espace de travail partagé.

La fusion du code ne fusionne pas automatiquement les données vivantes des deux bases. La première
`vtt_fusion` a été restaurée depuis `vtt_codex`. Les créations effectuées uniquement dans `vtt`
après leur divergence nécessitent un import de données explicite, avec contrôle des UUID et des
relations de campagne.

## 3. Cycle de travail

1. Claude / règles développe et commit sur `dev/Saar`, depuis `/home/didier/Enclume`.
2. Le moteur monde développe et commit sur `dev/monde`, depuis `/home/codex/Enclume-integrated`.
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
10. Une fois toutes les contributions absorbées et validées, replacer `dev/Saar` et `dev/monde`
    sur ce commit exact. Créer d'abord un tag de restauration pour chaque ancienne tête ; ne jamais
    réinitialiser une branche contenant encore un commit non fusionné.
11. Promouvoir ensuite un commit validé vers `master` uniquement lorsqu'il devient la référence du
    projet, sans transformer l'instance commune en environnement de développement direct.

## 3.1. Remise à niveau des espaces après une fusion

La remise à niveau n'est pas une copie de répertoire (`cp`, `rsync`, archive extraite). Procédure :

1. vérifier que les trois worktrees sont propres et que les deux têtes de travail sont ancêtres de
   `integration`, ou fusionner d'abord leurs commits manquants ;
2. créer les tags et bundles de restauration, puis sauvegarder les trois bases et les buckets ;
3. créer les nouvelles branches de travail depuis le tag commun validé ;
4. conserver les `.env` propres à `8193/8194`, `8293/8294` et `8393/8394` ;
5. exécuter `npm ci` dans chaque espace, redémarrer uniquement ses services et valider son health
   check, son client et ses migrations ;
6. commencer seulement ensuite les deux développements parallèles.

Le tag `baseline/common-20260715` marque la première base commune issue de la fusion initiale. Les
anciennes têtes restent accessibles par `backup/pre-common-baseline-cousin-20260715-125308` et
`backup/pre-common-baseline-world-20260715-125308`. L'archive complète correspondante est
`/home/codex/backups/enclume-common-baseline-20260715-125308`.

## 4. Règles de fusion

- ne jamais fusionner `origin/fusion-kiwi` dans le moteur v12 : cette branche contient l'ancien
  éditeur Surface v2 et supprimerait des collections canoniques lors d'une sauvegarde ;
- importer les nouvelles versions des règles depuis `dev/Saar` ou depuis une branche explicitement
  annoncée comme sa nouvelle tête ;
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
- premier merge commun : `1f048cd` ;
- déploiement : services `enclume-fusion-*` actifs, smoke Chromium validé sur `8393`.
- publication distante : en attente d'une authentification GitHub pour le compte système `codex` ;
  la branche `integration` existe actuellement sur le serveur mais pas encore sur `origin`.

Cette première fusion importe le reskin et les réglages de campagne récents du cousin. Le moteur
monde v12, ses routes de persistance, ses migrations et ses services spatiaux restent l'autorité.
La résolution initiale conserve aussi la suppression du gitlink historique `Enclume-codex` et
écarte `.obsidian/workspace.json`, qui est un état de poste personnel et non un livrable partagé.

## 6. Validation et retour arrière

Une livraison commune doit au minimum réussir :

```bash
npm run test:world
npm run test:server-config
node --test client/src/lib/surfaceData.test.mjs
cd client && npm run build
```

Elle doit ensuite être vérifiée sur `8393` avec une carte v12 multi-étages et une vraie session de
combat. En cas d'échec, arrêter uniquement les unités `enclume-fusion-*`, restaurer `vtt_fusion` et
le bucket de fusion, puis replacer `integration` sur le dernier commit validé. Les deux espaces de
développement restent intacts.
