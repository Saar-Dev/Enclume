# WORKFLOW_FUSION.md — espaces de développement et instance commune

> Dernière mise à jour : 2026-07-16.
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

## 6. Intégration du 2026-07-16

Cette livraison réunit la dernière tête monde et la dernière tête règles disponible sans modifier
le worktree du cousin :

- tête moteur monde : `72743e8` (`dev/monde`, Session 150) ;
- tête règles lue depuis le dépôt distant : `1af7d78` (`origin/dev/Saar`, Session 146) ;
- dernier point sémantiquement commun côté cousin : `60056b3` ;
- merge monde : `3e337f1` ;
- merge règles : `eec54df` ;
- worktree et instance de validation : `/home/codex/Enclume-fusion`, `8393/8394`, `vtt_fusion`,
  bucket `enclume-assets-fusion`.

`dev/Saar` contenait encore dans son ascendance l'ancien Surface « Fusion Kiwi ». Un merge brut
aurait produit 31 conflits et réintroduit des fichiers monde obsolètes. L'intégration a donc
enregistré `1af7d78` comme parent Git, puis appliqué uniquement son delta règles postérieur à
`60056b3`. L'autorité monde de `72743e8` a été conservée intégralement. Aucun fichier Surface,
géométrie, caméra, persistance monde ou service spatial n'a été repris depuis l'ancienne branche.

Point de restauration complet :

- archive : `/home/codex/backups/enclume-pre-fusion-20260716-144903` ;
- tags : `backup/pre-fusion-integration-20260716-144903`,
  `backup/pre-fusion-world-20260716-144903` et `backup/pre-fusion-saar-20260716-144903` ;
- contenus vérifiés par SHA-256 : bundle Git, dump `vtt_fusion`, volume MinIO complet et
  configuration runtime.

Validation réellement exécutée : 131 tests monde/serveur, 3 tests de configuration, 59 tests
ciblés Surface/caméra/géométrie, lint ciblé, build Vite, smoke Playwright Chromium, health HTTP
du client et de l'API. Sur `8393`, un Chromium authentifié a chargé le dashboard puis une vraie
session avec carte 3D multi-étages et combat actif aux niveaux 0 et 1, sans erreur de page ni
requête échouée. Un PNJ temporaire a été créé par l'API : sa fiche atomique existait immédiatement,
le filet `POST /char-sheet/:id` a renvoyé la même fiche de façon idempotente, puis le personnage a
été supprimé ; une lecture directe de la base confirme zéro donnée de test restante.

La publication vers `origin` reste bloquée tant que le compte système `codex` ne possède pas une
authentification GitHub propre. Ne jamais employer les identifiants du cousin pour contourner ce
blocage. Le worktree `/home/didier/Enclume` et les services `8193/8194` n'ont pas été modifiés ; le
cousin devra faire repartir sa prochaine branche depuis la tête `integration` publiée.

Après cette validation, `/home/codex/Enclume-integrated` a été avancé sans réécriture de
`dev/monde` vers la tête finale `integration`. Les dépendances verrouillées ont été réinstallées,
les services `8293/8294` redémarrés, les migrations confirmées à jour et le smoke Chromium validé.
Les `.env`, `vtt_codex` et le bucket `enclume-assets-monde` sont restés propres à cette instance.

## 7. Intégration du 2026-07-18

Cette livraison part de `integration` `ee3302c` et réunit :

- `dev/monde` `1255b37` (Session 158, escaliers droits et en colimaçon validés) ;
- `origin/dev/Saar` `1733aaa` (Session 156, règles personnages/combat) ;
- merge monde intermédiaire `6b01220` ;
- merge règles et tête runtime validée `a8a8846` ;
- worktree cible `/home/codex/Enclume-fusion`, services `8393/8394`, base `vtt_fusion` et bucket
  `enclume-assets-fusion`.

Avant toute mutation, la sauvegarde `/home/codex/backups/enclume-pre-fusion-20260718-095537` a
été créée avec bundle Git, dump PostgreSQL, volume MinIO et configuration runtime. Les trois têtes
sont aussi protégées par `backup/pre-fusion-integration-20260718-095537`,
`backup/pre-fusion-world-20260718-095537` et `backup/pre-fusion-saar-20260718-095537`. Le fichier
`SHA256SUMS` a été vérifié intégralement.

Le worktree `/home/didier/Enclume` et les services `8193/8194` ne sont jamais modifiés. La branche
Saar fraîche est lue depuis `origin/dev/Saar`, car son worktree local peut être en retard. Les
conflits documentaires conservent les deux historiques ; `docs/Old/PLAN_FUSION.md` reste archivé
et clos. Le manifeste et le lockfile serveur retirent ensemble `ioredis`, absent du runtime.

Validation réellement exécutée : 138 tests monde/serveur, 3 tests de configuration, 78 tests client
ciblés, vérification syntaxique de tous les fichiers serveur, build Vite et smoke Playwright. Le
lint ciblé reproduit exactement le passif de la tête précédente (22 erreurs, 21 avertissements)
sans nouvelle erreur sur les lignes Saar. `a8a8846` est déployé sur `8393/8394`; les migrations
`160/162/164/166/168` sont inscrites dans `vtt_fusion` et les deux health checks répondent 200.

Dans le navigateur intégré authentifié, le dashboard affiche v201 puis la session
`7c585d1c-999c-42fc-8bb1-4fb31fbe0d1e` charge son canvas, son combat actif et les niveaux 0 et 1.
En mode édition, **Objets 3D** expose visuellement l'escalier droit paramétrique, le colimaçon
paramétrique et l'échelle structurelle. Aucune erreur navigateur n'est enregistrée. Les worktrees
`dev/monde` et `/home/didier/Enclume` restent volontairement intacts ; la prochaine remise à niveau
doit partir du tag commun validé, sans réécrire un travail local non publié.

La publication de `integration` et `baseline/common-20260718` a été tentée depuis le compte système
`codex`, puis refusée avant toute écriture distante : l'URL HTTPS GitHub n'a aucun identifiant
configuré. Le commit et le tag restent donc protégés localement sur le serveur ; ne jamais utiliser
les identifiants personnels de Saar pour contourner ce blocage.

## 8. Validation et retour arrière

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
