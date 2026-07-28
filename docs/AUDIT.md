# AUDIT_FABLE.md — Audit technique complet (architecture, sécurité, bugs)

> Auteur : Claude Sonnet (revue autonome, sur demande explicite de Saar 2026-07-25).
> Méthode : cartographie (6 explorations parallèles read-only) → compréhension → validation ciblée
> (lecture directe des fichiers cités, pas seulement les rapports de cartographie) → synthèse.
> Portée couverte : `server/`, `client/`, `shared/`, migrations DB, sécurité applicative.
> Portée **non** couverte en profondeur (déclaré, pas audité) : `client/src/components/Editor3D.jsx`
> et le pipeline voxel legacy (survolés, pas lus intégralement) ; performance réseau/latence en usage
> réel (aucune mesure runtime, seulement analyse statique) ; dépendances npm (pas d'audit CVE lancé,
> voir §Sécu-5).
>
> Étiquettes utilisées : `[VÉRIFIÉ]` = lu directement dans le code cité ; `[HYPOTHÈSE]` = inféré par
> lecture, non instrumenté en exécution ; `[INCONNU]` = signalé mais non tranché.
>
> Objectif de cet audit : ne pas maximiser le nombre de constats, mais identifier le plus petit
> ensemble de **causes racines** expliquant le plus de symptômes. Voir §Synthèse finale.

---

## Sommaire

- [A. Causes racines transverses](#a-causes-racines-transverses) — à lire en premier
- [B. Architecture / Qualité / Performance / Scalabilité / Maintenabilité](#b-architecture)
- [C. Sécurité](#c-sécurité)
- [D. Bugs nouvellement identifiés (hors registre existant)](#d-bugs-nouvellement-identifiés)
- [E. Synthèse finale — corrélations et priorités](#e-synthèse-finale)

---

## A. Causes racines transverses

Cinq causes racines expliquent la majorité des constats détaillés en §B/§C/§D. Ce sont les seules
choses qui, si elles étaient traitées, feraient disparaître plusieurs lignes d'un coup.

| ID | Cause racine | Symptômes qu'elle explique |
|---|---|---|
| **RC1** | `resolveMeleeAction`/`resolveAssaultAction` sont des monolithes qui n'ont jamais été découpés malgré un constat explicite datant de Session 95-3 (`docs/BUGIDENTIFIE.md` "AUDIT ARCHITECTURAL") — et qui ont **grossi** depuis (507→635 lignes, 367→523 lignes) | INFRA-1, INFRA-2, BUG-1 (COM27), MELEE-INHAND (déjà connu), coût élevé de MODING4-INTEGRATION (déjà connu) |
| **RC2** | Le pattern `emissions[]` + `flushEmissions` (différé, ordonné) n'a été appliqué qu'à 3 points d'appel ; le reste du sous-système combat émet en direct (`io.emit`/`socket.emit`) sans passer par ce tampon | BUG-1 (COM27), INFRA-3 |
| **RC3** | Aucune bibliothèque de validation de schéma ; chaque route revalide « à la main », de façon non uniforme | SECU-3, SECU-4, INFRA-6, TRADE1 (déjà connu — même racine) |
| **RC4** | `rate-limiter-flexible` est une dépendance déjà installée et déjà utilisée sur un seul flux (`socketTrade.js`), mais jamais étendu aux routes à plus forte valeur (`/api/auth/*`) | SECU-1, SECU-2 |
| **RC5** | La convention de numérotation des migrations (pair/impair par développeur) est une discipline sociale sans garde-fou outillé | INFRA-9 |

---

## B. Architecture

### INFRA-1 — `resolveMeleeAction`/`resolveAssaultAction` : monolithes en croissance, jamais refactorés

**Gravité** : Élevée · **Confiance** : `[VÉRIFIÉ]`

**Fichiers/fonctions** : `server/src/socket/socketCombatHelpers.js` — `resolveMeleeAction` (lignes
1214-1848, **635 lignes**, 42 branches if/else/switch), `resolveAssaultAction` (lignes 2357-2879,
**523 lignes**, 35 branches). Fichier total : 2921 lignes, 17 fonctions exportées.

**Description** : Chaque fonction traite en un seul bloc : validation, résolution d'arme/mods,
distinction PJ/PNJ/drone, jets de dés, calcul de dégâts, écritures DB, et construction des émissions
socket. `docs/BUGIDENTIFIE.md` (audit Session 95-3, 2026-06-15) avait déjà identifié ces deux
fonctions comme `🟡 TECH DEBT` à ~507/~367 lignes, avec la note « ne pas bloquer les corrections
actuelles », et proposait `resolveDamage.js`/`resolveMelee.js` comme sprint dédié post-V1. Ce sprint
n'a jamais eu lieu — au contraire, les fonctions ont grossi de 25-40 % (nouvelles features CaC deux-
armes COM24, drones, MR-table CHOC1, etc. toutes ajoutées inline).

**Cause racine** : décision explicite documentée de différer le découpage (« non bloquant V1 ») sans
qu'un point de re-décision n'ait jamais été fixé — la dette s'accumule silencieusement à chaque
feature combat ajoutée.

**Conséquences** : coût croissant de toute nouvelle feature combat (visible dans MODING4-INTEGRATION,
qui documente elle-même devoir insérer un appel dans ce même monolithe) ; risque de régression accru
à chaque modification (42+35 = 77 branches conditionnelles à tenir en tête) ; c'est la cause racine
structurelle de BUG-1 ci-dessous (RC1+RC2).

**Recommandation** : ne pas réécrire à chaud. Sprint dédié, découpage incrémental par extraction pure
(Strangler Fig, cohérent avec le principe déjà appliqué pour MODING4) : extraire d'abord les segments
sans effet de bord (résolution d'arme, calcul MR/dégâts) avant de toucher à l'orchestration DB/socket.

**Priorité** : Moyenne (pas bloquant, mais le coût ne fera qu'augmenter — chaque sprint combat futur
paiera l'intérêt de cette dette).

---

### INFRA-2 — Pattern d'émission incohérent au sein du même sous-système

**Gravité** : Moyenne · **Confiance** : `[VÉRIFIÉ]`

**Fichiers** : `server/src/socket/socketCombatResolution.js` (pattern `emissions[]`/`flushEmissions`,
lignes 25-44, appelé seulement lignes 346/358/364) vs. `socketCombatState.js` (émission directe
exclusivement, ex. lignes 140/147/239/269/280/323/362-373/411), `socketCombatAnnouncement.js` (émission
directe partout, aucun usage de `emissions.push`), et `socketCombatHelpers.js:1824,776`
(`broadcastCurrentSubPhase` appelé en direct **à l'intérieur** de `resolveMeleeAction`/`confirmDamage`,
qui par ailleurs alimentent activement le tableau `emissions`).

**Description** : Le tampon ordonné `emissions[]` semble avoir été introduit pour garantir un ordre
d'émission déterministe sur le chemin `COMBAT_ACTION_CONFIRM` → résolution. Mais son adoption est
partielle : à l'intérieur même des fonctions qui l'utilisent, un appel direct
(`broadcastCurrentSubPhase`) contourne le tampon et part immédiatement sur le réseau, avant que le
contenu du tableau ne soit vidé par `flushEmissions` (appelé après le retour de la fonction, donc
strictement plus tard).

**Cause racine [HYPOTHÈSE]** : refactor partiel — le tampon a été ajouté à un moment donné pour
résoudre un problème d'ordre, sans qu'un audit complet des émissions existantes dans le même chemin
d'exécution ne soit fait pour vérifier qu'aucune émission directe ne subsistait en amont.

**Conséquences** : voir **BUG-1** ci-dessous — c'est le mécanisme concret qui explique la dette
**COM27**, actuellement « en pause, reproduction non confirmée » dans `docs/BUGIDENTIFIE.md`.

**Recommandation** : soit généraliser `emissions[]`/`flushEmissions` à tout `broadcastCurrentSubPhase`
appelé depuis un chemin qui alimente déjà ce tableau, soit documenter explicitement (commentaire au
point d'appel) pourquoi telle émission doit rester immédiate — actuellement rien ne distingue une
émission directe volontaire d'un oubli.

**Priorité** : Haute — c'est la cause racine probable d'un bug déjà signalé par Saar deux fois.

---

### INFRA-3 — N+1 / requêtes en boucle non batchées

**Gravité** : Faible à Moyenne · **Confiance** : `[VÉRIFIÉ]` (présence du pattern), impact réel non mesuré

**Fichiers** :
- `server/src/socket/socketCombatHelpers.js:86-89` — pour chaque entrée de roster au démarrage d'un
  combat, 2 lookups séquentiels (`tokens` puis `characters`) au lieu d'un batch `whereIn`.
- `server/src/socket/socketCombatHelpers.js:2660-2663` — update par item d'arme tirée au lieu d'un
  update batché.
- `server/src/socket/socketTrade.js:169-172,389-392` — lookup/update par item dans une boucle
  d'échange.
- `server/src/services/creationService.js:131-133,683-686,927-928` — lookups référentiels
  (`ref_careers`, `ref_mutations`) par itération dans le wizard de création.

**Cause racine** : pattern de requête écrit item-par-item plutôt que batché ; le même fichier
(`creationService.js`) montre par ailleurs un usage correct de `whereIn` ailleurs (lignes 336-338,
571-573) — donc pas une méconnaissance de l'outil, plutôt un oubli localisé à chaque nouveau point
d'écriture.

**Conséquences** : à l'échelle actuelle (groupes de jeu de table, quelques joueurs par campagne), ce
n'est probablement pas mesurable. Le nombre de tokens en combat / items en échange reste petit
(dizaine, pas centaines) — impact réel `[INCONNU]`, non mesuré en charge. Le classer comme
scalabilité-latente plutôt qu'urgent.

**Recommandation** : pas de correctif isolé à chaud (violerait « pas de bricole » sur du code qui
fonctionne). À corriger opportunistement au moment où `socketCombatHelpers.js`/`creationService.js`
sont de toute façon retouchés pour une autre raison.

**Priorité** : Basse.

---

### INFRA-4 — Fichiers client volumineux (maintenabilité)

**Gravité** : Faible · **Confiance** : `[VÉRIFIÉ]`

**Fichiers** : `client/src/components/Sidebar.jsx` (3737 lignes), `client/src/lib/surfaceData.js`
(3370 lignes), `client/src/components/SurfaceDungeonScene.jsx` (2258 lignes),
`client/src/components/Editor3D.jsx` (1970 lignes), `client/src/components/Canvas3D.jsx` (1647
lignes) ; côté combat, `CombatActionWindow.jsx` (1612), `CombatGmDeclareWindow.jsx` (1202).

**Description** : Ces 5-7 fichiers concentrent une part disproportionnée de la surface de
modification du client. `Sidebar.jsx` en particulier mélange plusieurs domaines (renommage
personnage, effets de monde, etc. — visible dans la cartographie i18n où ses textes FR en dur
cohabitent avec des `t()`).

**Cause racine [HYPOTHÈSE]** : accrétion organique — pas de règle de découpage par domaine appliquée
à ces composants au fil des sessions.

**Conséquences** : coût de lecture/modification élevé (chaque changement dans `Sidebar.jsx` oblige à
naviguer 3700+ lignes) ; risque accru de collision entre chantiers parallèles (dev/Saar vs dev/monde)
sur un même fichier géant.

**Recommandation** : pas de découpage rétroactif proactif (violerait YAGNI si rien ne le demande
aujourd'hui). À surveiller : si `Sidebar.jsx` doit être retouché pour un prochain chantier i18n ou
fonctionnel, c'est l'occasion d'extraire les sous-domaines déjà visuellement séparables (effets de
monde vs gestion personnages).

**Priorité** : Basse.

---

### INFRA-5 — Socket client dispersé hors du hub central

**Gravité** : Faible · **Confiance** : `[VÉRIFIÉ]`

**Fichiers** : 17 fichiers hors `client/src/lib/` appellent `socket.on`/`.emit` directement au lieu de
passer par les hooks centraux (`useCombatSocket.js`, `useEntitySocket.js`, etc.) — liste complète :
`DroneWindow.jsx`, `Canvas3D.jsx`, `CombatActionWindow.jsx`, `CombatGmDeclareWindow.jsx`,
`CombatInitStateWindow.jsx`, `CombatOverlay.jsx`, `CombatRosterWindow.jsx`,
`ProAdvantagesAndSetbacks.jsx`, `Step3Mutations.jsx`, `WizardLockSync.jsx`, `DicePanel.jsx`,
`Editor3D.jsx`, `EntityEditor.jsx`, `ExchangeWindow.jsx`, `Sidebar.jsx`, `TradeWindow.jsx`,
`SessionPage.jsx`.

**Description** : Le projet a manifestement une intention de centralisation (8 hooks dédiés
existent), mais elle n'est pas systématique. Pas un problème en soi si chaque écoute est justifiée
localement (ex. un composant qui a besoin d'un event ponctuel et local), mais aucune règle écrite ne
distingue « doit passer par le hub » de « peut écouter localement ».

**Cause racine [INCONNU]** : pas d'investigation par fichier pour savoir si chaque cas est justifié
ou est un oubli de centralisation.

**Conséquences** : difficulté à auditer exhaustivement « qui écoute quel event » (pertinent pour
diagnostiquer un futur bug d'ordre d'événements, type COM27) — la centralisation partielle est
précisément ce qui a rendu la recherche du « composant responsable » de COM27 difficile initialement.

**Recommandation** : aucune action corrective immédiate recommandée (pas de règle explicite
CLAUDE.md/`.claude/rules/react.md` violée, sous réserve de vérification de ce fichier non lu ici).
À mentionner si un futur audit React est fait.

**Priorité** : Basse — observation, pas un défaut confirmé.

---

### INFRA-6 — Validation d'entrée manuelle et non uniforme

**Gravité** : Moyenne · **Confiance** : `[VÉRIFIÉ]`

**Fichiers** : aucune bibliothèque de schéma (zod/joi/yup/ajv/express-validator) en dépendance
serveur. Exemple concret : `server/src/routes/tokens.js:28-44` — `width`, `height`, `z_index`,
`color` etc. sont insérés en DB depuis `req.body` avec des valeurs par défaut mais sans validation de
type/plage.

**Description** : Chaque route réinvente sa propre validation ad hoc (présence de champs, regex
ponctuelles). Fonctionnellement, cela n'a pas produit de faille d'injection identifiée (voir SECU —
tous les accès DB passent par le query-builder Knex paramétré ou des `db.raw` à bindings, aucune
concaténation de chaîne trouvée). C'est un problème de robustesse/cohérence, pas une vulnérabilité
directe confirmée.

**Cause racine [HYPOTHÈSE]** : pas de convention posée dès le départ ; RC3.

**Conséquences** : une route mal validée peut accepter des valeurs absurdes (ex. `z_index` négatif
extrême, `color` non hex) qui provoquent des erreurs de rendu client plutôt qu'un crash serveur (Knex
lèvera une erreur de type SQL si incompatible) — nuisance, pas un risque de sécurité par lui-même.

**Recommandation** : pas de sprint dédié à froid (VOLUME trop large — 30+ routes). Appliquer
opportunistement une validation stricte aux routes déjà en cours de retouche.

**Priorité** : Basse.

---

### INFRA-7 — Migrations irréversibles non signalées comme telles au niveau du registre

**Gravité** : Faible · **Confiance** : `[VÉRIFIÉ]`

**Fichier** : `server/src/db/migrations/94_drop_and_cleanup.js` — `down()` existe syntaxiquement mais
son propre commentaire dit explicitement que la reconstruction n'est pas possible (données
irrécupérables en rollback partiel).

**Description** : Cas isolé, correctement documenté *dans le fichier*, mais aucune trace de ce cas
particulier dans `docs/WORKFLOW_FUSION.md` (retour arrière) — si une fusion future doit reculer au-delà
de cette migration, la personne qui exécute le rollback ne le découvre qu'en lisant le fichier lui-même.

**Cause racine** : documentation inline correcte, mais pas remontée au niveau du document qui gère
les procédures de retour arrière.

**Conséquences** : risque faible (cas unique connu), mais silencieux — un rollback multi-migrations
scripté pourrait ne pas s'arrêter sur ce cas particulier.

**Recommandation** : ajouter une ligne dans `docs/WORKFLOW_FUSION.md` référençant ce cas comme borne
connue de rollback partiel.

**Priorité** : Basse.

---

### INFRA-8 — Cache `WorldSnapshot` en mémoire de processus, sans invalidation inter-instance

**Gravité** : Faible (aujourd'hui) · **Confiance** : `[VÉRIFIÉ]` structure, `[INCONNU]` impact réel

**Fichier** : `server/src/services/worldService.js` — `snapshotCache = new Map()`, cache local au
process Node, capé à 32 entrées, invalidé sur écriture via `cacheBattlemapWorldSnapshot`/
`invalidateBattlemapWorld`.

**Description** : Fonctionne correctement en mono-instance (le cas actuel, confirmé par l'absence de
Redis/orchestrateur multi-instance trouvée). Si l'application était un jour déployée derrière
plusieurs instances Node (scale horizontal), ce cache deviendrait incohérent entre instances (une
écriture sur l'instance A n'invaliderait pas le cache de l'instance B).

**Cause racine** : conforme à l'architecture actuelle documentée (`docs/SYSTEME/MOTEUR_MONDE.md`
affirme explicitement l'absence de cache spatial Redis, cohérent avec `.claude/rules/core.md` : « ne
pas créer de stockage spatial Redis »). Ce n'est **pas un défaut** au regard du contrat actuel — c'est
une limite de scalabilité horizontale documentée par omission.

**Conséquences** : aucune tant que le déploiement reste mono-instance (cas actuel confirmé, cf. §3
CLAUDE.md — chaque dev a son propre process/port).

**Recommandation** : aucune action — à noter uniquement si un jour une exigence de scale horizontal
apparaît. Ne pas résoudre un problème qui n'existe pas (YAGNI).

**Priorité** : Aucune (observation informative uniquement).

---

### INFRA-9 — Collisions de numérotation de migrations malgré la convention pair/impair

**Gravité** : Moyenne · **Confiance** : `[VÉRIFIÉ]`

**Fichiers** : 12 numéros en doublon confirmés dans `server/src/db/migrations/` : 44, 45, 75, 76, 79,
80, 81, 82, 83, 95, 108, 109 (chacun avec deux fichiers distincts). Cas documenté explicitement :
`141_ref_equipment_mod_slots.js:1-4` — commentaire in-file décrivant une collision avec le numéro 140
« déjà pris entre-temps par une session parallèle », renommé après coup, `knex_migrations` corrigé
manuellement. Au-delà de 158, les numéros pairs sont quasi tous absents sur cette branche (dev/Saar)
— cohérent avec la convention (pairs = Codex, sur une autre branche), mais confirme que les deux
lignées divergent fortement en numérotation avant fusion.

**Description** : La convention CLAUDE.md §2 (pair=Codex, impair=Claude) est une règle sociale, sans
vérification automatisée (pas de hook/CI trouvé qui rejetterait un numéro déjà pris). Les 12 collisions
trouvées montrent que la discipline seule ne suffit pas à éviter les chevauchements avant
synchronisation.

**Cause racine [HYPOTHÈSE]** : deux branches de travail indépendantes (`dev/Saar`, `dev/monde`)
choisissent chacune le prochain numéro disponible localement, sans se synchroniser avant de committer
— une collision n'est visible qu'au moment de la fusion.

**Conséquences** : renommage manuel post-hoc nécessaire (déjà vécu au moins une fois, documenté), et
le risque existe à chaque nouvelle migration tant qu'aucun garde-fou outillé n'existe.

**Recommandation** : pas un correctif de code — un garde-fou de process léger suffirait (ex. un
script `check-migration-numbers.js` lancé en pré-commit qui liste les numéros pris sur les deux
branches via `git show dev/monde:server/src/db/migrations` avant de proposer le prochain numéro
impair libre). Décision produit/process, pas une modification fonctionnelle — à proposer, pas à coder
sans validation de Saar.

**Priorité** : Basse à Moyenne (le coût de collision est faible mais récurrent).

---

## C. Sécurité

### SECU-1 — Aucun rate limiting sur `/api/auth/login` et `/api/auth/register`

**Gravité** : Élevée · **Confiance** : `[VÉRIFIÉ]`

**Fichiers** : `server/src/routes/auth.js` (routes `POST /login` lignes 83-108, `POST /register`
lignes 38-80) ; `server/src/socket/socketTrade.js:1,11` est le seul consommateur de
`rate-limiter-flexible` dans tout le projet (`RateLimiterMemory({ points: 3, duration: 60 })`).

**Description** : `/api/auth/login` accepte un nombre illimité de tentatives par IP/compte. Aucun
verrou de compte, aucun throttling, aucun CAPTCHA. `rate-limiter-flexible` est déjà une dépendance
installée et déjà utilisée avec succès ailleurs dans le projet — l'outil existe, il n'a simplement
jamais été appliqué à la route la plus sensible de l'application.

**Cause** : RC4 — extension de l'outil existant jamais faite au-delà de son premier usage (échange
marchand).

**Scénario d'exploitation** : un attaquant avec une liste d'emails (ex. fuite externe) peut faire du
credential stuffing ou du brute-force par dictionnaire contre `/api/auth/login` sans aucune
limitation, à la vitesse du réseau. bcrypt (12 rounds) ralentit chaque tentative côté serveur mais ne
bloque rien structurellement.

**Impact** : compromission de compte(s) joueur/MJ, incluant potentiellement des comptes GM avec accès
à des campagnes entières (personnages, inventaires, contenu de session).

**Correctif recommandé** : appliquer `RateLimiterMemory` (même pattern que `socketTrade.js`) sur
`/api/auth/login` (par IP **et** par email pour limiter aussi le credential stuffing distribué) et sur
`/api/auth/register`. Pas de nouvelle dépendance nécessaire.

**Priorité** : Haute.

---

### SECU-2 — Énumération d'emails via `/api/auth/register`

**Gravité** : Faible à Moyenne · **Confiance** : `[VÉRIFIÉ]`

**Fichier** : `server/src/routes/auth.js:60-63` — `if (existing) { throw new AppError(409, 'Email
already in use') }`.

**Description** : Contrairement à `/login` qui renvoie un message générique (`Invalid credentials`)
sans distinguer email inexistant / mot de passe faux, `/register` confirme explicitement si un email
est déjà enregistré. Combiné à SECU-1 (pas de rate limit), un attaquant peut cribler une liste
d'emails pour savoir lesquels ont un compte sur la plateforme.

**Cause** : message d'erreur informatif choisi sans considération du risque d'énumération — cas
classique, généralement accepté comme risque mineur pour une appli non publique à fort trafic, mais à
noter.

**Scénario d'exploitation** : requêtes répétées à `/register` avec des emails candidats ; le code 409
confirme l'existence du compte sans nécessiter de mot de passe.

**Impact** : divulgation d'information (qui a un compte), utile en reconnaissance avant une autre
attaque (ex. phishing ciblé, ou brute-force ciblé une fois SECU-1 exploité).

**Correctif recommandé** : réponse générique côté client indépendamment du cas (« Si cet email est
valide, un compte a été créé » ou équivalent) — mais **attention** : le flux actuel a besoin du 409
pour le retour utilisateur normal (formulaire d'inscription) ; à trancher avec Saar si le compromis
UX/sécu vaut le changement, vu le contexte (accès invité par `REGISTRATION_CODE`, pas une inscription
ouverte au public).

**Priorité** : Basse (le `REGISTRATION_CODE` obligatoire réduit déjà fortement la surface
d'exploitation réelle — seul quelqu'un possédant déjà le code d'invitation peut tester cette route).

---

### SECU-3 — Upload GLB : type MIME accepté sans vérification de contenu réel

**Gravité** : Moyenne · **Confiance** : `[VÉRIFIÉ]` mécanisme, `[HYPOTHÈSE]` exploitabilité réelle
(dépend de la configuration MinIO/headers de réponse, non auditée)

**Fichiers** : `server/src/middleware/upload.js:17-20` (`ALLOWED_GLB_MIME_TYPES` inclut
`application/octet-stream`, un type MIME générique) ; `fileFilter`/`glbFileFilter`
(lignes 28-42) ne vérifient que `file.mimetype`, un en-tête **déclaré par le client**, jamais les
octets réels du fichier (pas de "magic bytes"/signature check) ; `generateObjectName` (lignes 58-62)
ne conserve que l'extension du nom de fichier original, pas de validation de cohérence
extension/contenu ; `server/src/lib/minio.js:73-79` stocke l'objet avec
`Content-Type: req.file.mimetype` — c'est-à-dire la valeur déclarée par le client, telle quelle.

**Description** : `file.mimetype` est un en-tête HTTP fourni par le client lors de l'upload
(`multipart/form-data`), trivialement falsifiable. Le filtre accepte tout fichier dont le client
déclare `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `model/gltf-binary`, ou le générique
`application/octet-stream` — sans jamais inspecter les octets réels. Le fichier est ensuite stocké
dans MinIO avec ce même Content-Type déclaré, et servi tel quel via `getFileUrl` (URL MinIO directe,
`server/src/lib/minio.js:5-7`).

**Cause** : RC3 (pas de validation de contenu, seulement de métadonnée déclarée) — pattern classique
de confusion entre "type déclaré" et "type réel".

**Scénario d'exploitation** : un attaquant authentifié (upload nécessite d'être connecté — pas un
endpoint public, réduit le risque) uploade un fichier dont le contenu réel diffère du type déclaré
(ex. contenu HTML/SVG avec script, déclaré comme `image/jpeg`). Si MinIO sert la réponse avec le
Content-Type stocké sans `X-Content-Type-Options: nosniff`, un navigateur qui accède **directement** à
l'URL MinIO (pas via une balise `<img>` du site, qui ne rendrait pas le contenu comme HTML) pourrait,
selon la politique de sniffing du navigateur, interpréter le contenu réel plutôt que le Content-Type
déclaré. **Non vérifié ici** : la configuration réelle des en-têtes de réponse MinIO (bucket policy,
headers `nosniff`) n'a pas été auditée — c'est le facteur qui déterminerait si ce scénario est
réellement exploitable ou seulement théorique.

**Impact** : potentiellement XSS stocké si le scénario ci-dessus se vérifie, mais MinIO tourne
probablement sur une origine distincte (`MINIO_ENDPOINT:MINIO_PORT`, séparé du client) — un XSS sur
cette origine ne volerait pas directement les cookies `httpOnly` du domaine applicatif (origines
différentes), ce qui limite fortement l'impact réel même si le scénario se confirme.

**Correctif recommandé** : vérifier les octets réels (magic bytes) au lieu du `mimetype` déclaré pour
au moins les images (librairie légère type `file-type`), et/ou forcer
`Content-Disposition: attachment` + `X-Content-Type-Options: nosniff` sur les objets servis par MinIO
si ce n'est pas déjà le cas (à vérifier — non auditée ici).

**Priorité** : Moyenne — vérifier d'abord la configuration MinIO réelle avant de prioriser un
correctif applicatif (le facteur limitant n'est peut-être pas dans ce code).

---

### SECU-4 — Pas de vérification d'appartenance sur `TRADE_TRANSFER_DECLINED` (déjà connu)

Déjà documenté comme **dette TRADE1** dans `docs/BUGIDENTIFIE.md` — confirmé ici par lecture
indépendante de `server/src/socket/socketTrade.js`, même constat, même cause racine (RC3), sévérité
jugée faible par l'audit initial (pas de perte de données/gain matériel, juste un déni de service
局所 sur une offre ciblée). Pas de nouvelle information à ajouter — mentionné ici uniquement pour
confirmer la cohérence entre cet audit et le registre existant (pas une redite indépendante).

---

### SECU-5 — Dépendances npm : audit CVE non effectué dans le cadre de cette revue

**Gravité** : `[INCONNU]` · **Confiance** : n/a — action non réalisée

Conformément à la contrainte CLAUDE.md « ne pas corriger automatiquement les vulnérabilités npm avec
`--force` », et parce que cet audit est une revue de code statique et non une revue de chaîne
d'approvisionnement, `npm audit` n'a pas été exécuté dans le cadre de cette session. À signaler comme
action complémentaire distincte si souhaitée — hors périmètre de cet audit de code.

---

### SECU-6 — Points vérifiés et jugés conformes (pour mémoire, pas des findings)

Pour éviter de laisser croire à une inspection incomplète, les points suivants ont été **vérifiés et
jugés sans anomalie** :

- **CORS** (`server/src/lib/clientOrigins.js:34-43`) — allowlist stricte par égalité exacte d'origine
  (`Set.has(origin)`), pas de regex permissive, pas de reflect-any-origin. Conforme.
- **Cookies d'auth** — `httpOnly: true`, `sameSite: 'lax'`, `secure` conditionné à `NODE_ENV`
  (`server/src/routes/auth.js:11-16`). Conforme à `.claude/rules/core.md`.
- **Mots de passe** — bcrypt, 12 rounds, comparaison via `bcrypt.compare` (pas de comparaison en
  clair). Conforme.
- **Code d'inscription** — comparé via `crypto.timingSafeEqual` (pas de comparaison sensible au
  timing). Conforme.
- **SQL** — aucune interpolation de chaîne d'entrée utilisateur dans un `db.raw`/`whereRaw` trouvée
  sur l'ensemble de `server/src` (24 usages de `db.raw` audités, tous soit statiques soit à bindings
  paramétrés `?`). Pas d'injection SQL identifiée.
- **Path traversal upload** — le nom de fichier original n'est jamais réutilisé tel quel (seule
  l'extension, via `path.extname`, est reprise ; le nom de stockage est un UUID généré serveur).
  Conforme.
- **Autorisation** — aucune route mutante examinée n'accède à une ressource sans vérification
  d'appartenance/rôle (échantillon : `tokens.js`, `documents.js`, `vault.js`, `entities.js`,
  `socketTrade.js`), à l'exception déjà connue de SECU-4/TRADE1.
- **Secrets** — aucun secret par défaut codé en dur trouvé (`JWT_SECRET` n'a aucun fallback ; le seul
  fallback trouvé concerne un nom de bucket MinIO, pas un secret).

---

## D. Bugs nouvellement identifiés

### BUG-1 — Mécanisme concret probable de la dette COM27 (défense affichée avant l'attaque)

**Gravité** : Moyenne · **Confiance** : `[HYPOTHÈSE]` forte, non instrumentée — voir note finale

**Ce que le système est censé faire** : en CaC, le jet d'attaque doit être visible/résolu avant que
l'interface du défenseur ne bascule en mode défense (ordre logique attaque → défense).

**Ce qu'il fait réellement (mécanisme identifié)** :

1. `resolveMeleeAction` empile le jet d'attaque dans le tableau `emissions[]` (poussé plus tôt dans la
   fonction, ~ligne 1464 — confirmé par cartographie, non re-vérifié ligne par ligne ici).
2. Pour un défenseur PJ, la fonction insère `combat_pending`, appelle `setFSMSubPhase(...,
   'AWAITING_DEFENSE')`, **puis appelle directement `broadcastCurrentSubPhase(io, campaignId)`**
   (`socketCombatHelpers.js:1822-1824`) — cette émission part **immédiatement** sur le réseau, elle ne
   passe pas par `emissions[]`.
3. Le prompt de défense (`COMBAT_MELEE_DEFENSE_PROMPT`, contenant `rollAttaque`/`chancesAttaque`) est
   ensuite poussé dans `emissions[]` (`socketCombatHelpers.js:1837`).
4. `resolveMeleeAction` retourne ; **seulement à ce moment**, l'appelant (`socketCombatResolution.js:364`)
   appelle `flushEmissions(...)`, qui vide enfin le tableau et émet le jet d'attaque **et** le prompt
   de défense — mais **après** l'émission directe de l'étape 2.
5. Côté client, `COMBAT_TIMELINE_UPDATED` est écouté par
   `client/src/lib/useCombatSocket.js:112,179` (`onTimelineUpdated = (payload) =>
   setTimelineState(payload)`), qui met à jour `combatStore` — donc l'échelle de résolution/l'état de
   sous-phase change **avant** que le jet d'attaque n'ait été reçu par le client.

**Conditions de reproduction** : tout échange CaC où le défenseur est un PJ (le cas PNJ/drone ne passe
pas par cette branche — voir `socketCombatHelpers.js:1673-1819`, résolution auto sans
`combat_pending`).

**Chemin d'exécution** : `COMBAT_ACTION_CONFIRM` (`socketCombatResolution.js:361-366`) →
`resolveMeleeAction` (`socketCombatHelpers.js:1214-1848`) → émission directe ligne 1824 → retour →
`flushEmissions` ligne 364.

**Fonctions impliquées** : `resolveMeleeAction`, `broadcastCurrentSubPhase`, `flushEmissions`,
`onTimelineUpdated` (client).

**Cause racine** : RC2 — le pattern d'émission ordonnée n'a pas été appliqué de façon exhaustive au
sein de la fonction qui l'utilise déjà par ailleurs. C'est exactement le « point d'attention non
tranché » que la précédente investigation de COM27 (documentée dans `docs/BUGIDENTIFIE.md`,
2026-07-24) avait identifié sans trouver le composant client responsable — **ce composant est
maintenant identifié** : `useCombatSocket.js:112` (`onTimelineUpdated`).

**Ce qui reste non vérifié** : je n'ai pas tracé si le changement de `timelineState` déclenché par
`onTimelineUpdated` produit un effet visuel perceptible **avant** l'affichage du résultat du jet
d'attaque dans l'UI réelle (ex. `CombatTimeline.jsx` ou un composant consommant `currentStep`) — cette
dernière étape nécessiterait soit une lecture de `CombatTimeline.jsx` (non faite dans cet audit), soit
une instrumentation en jeu réel, conformément à la méthode du projet
(`docs/BUGIDENTIFIE.md` §MÉTHODE : « Sans reproduction confirmée, aucune analyse n'est valide »).

**Conséquences** : si confirmé, corrige un bug non résolu depuis plusieurs sessions ; si infirmé (le
changement de `timelineState` ne produit aucun effet visible avant flush), élimine une piste et permet
de fermer définitivement l'hypothèse « émission directe » pour COM27 et de chercher ailleurs.

**Correctif recommandé (si confirmé)** : différer l'appel `broadcastCurrentSubPhase` à l'intérieur de
`resolveMeleeAction`/`confirmDamage` en le poussant dans `emissions[]` au lieu de l'exécuter en
direct, pour qu'il soit flush dans le même ordre que le jet d'attaque.

**Priorité** : Haute — action recommandée immédiate : instrumenter (`[DBG-COM27]` déjà prévu dans le
dossier existant) sur les 2 points d'émission identifiés ici précisément (ligne 1824 vs. flush 364)
plutôt que sur des points génériques, ce qui devrait trancher la question en une seule séance de jeu
de test.

---

### BUG-2 — Filtre MIME d'upload accepte un type générique sans vérification de contenu

Voir **SECU-3** ci-dessus — classé comme finding sécurité plutôt que bug fonctionnel, mais listé ici
par recoupement car il s'agit aussi d'un écart entre comportement attendu (« seuls GLB/images
autorisés ») et réel (« tout contenu déclaré comme tel est accepté »).

---

## E. Synthèse finale

### Quelles décisions d'architecture sont responsables de plusieurs problèmes

1. **Différer le découpage de `resolveMeleeAction`/`resolveAssaultAction` "pour V1"** (Session 95-3)
   sans jamais fixer de point de re-décision est la cause racine la plus rentable à traiter : elle
   explique à la fois un coût de maintenance croissant (INFRA-1), le mécanisme le plus probable d'un
   bug non résolu depuis des sessions (BUG-1/COM27, via INFRA-2), et le coût déjà documenté de
   MODING4-INTEGRATION.
2. **L'introduction partielle du pattern `emissions[]`** sans audit exhaustif des émissions directes
   préexistantes dans le même chemin d'exécution (INFRA-2) est la cause racine technique immédiate de
   BUG-1.
3. **Un outil de protection déjà en place mais jamais étendu** (`rate-limiter-flexible`, RC4) explique
   à lui seul SECU-1 — le coût de correction est trivial (le pattern existe déjà dans le code, copier-
   coller adapté), ce qui en fait la meilleure priorité de correction rapportée à l'effort.

### Quels problèmes partagent la même cause racine

- SECU-4 (TRADE1, déjà connu) et INFRA-6 partagent RC3 (validation ad hoc, pas de convention centrale).
- SECU-1 et l'absence de protection équivalente ailleurs partagent RC4.
- BUG-1 et le coût de MODING4-INTEGRATION partagent RC1 (même fichier monolithique).

### Corrections offrant le meilleur retour sur investissement

Par coût de correction croissant :

1. **SECU-1** (rate limiting login/register) — le pattern existe déjà dans le code (`socketTrade.js`),
   coût de portage minimal, gravité élevée. **Meilleur ROI de tout l'audit.**
2. **BUG-1/COM27** — instrumentation déjà prévue par le projet, il ne manquait que la localisation
   précise des deux points à comparer ; cet audit la fournit. Coût : une session d'instrumentation +
   validation en jeu.
3. **INFRA-9** (garde-fou numérotation migrations) — script léger, évite une classe entière de
   collisions récurrentes à faible coût de développement.
4. **INFRA-1** (découpage des monolithes combat) — ROI réel mais coût élevé (sprint dédié) ; à ne pas
   traiter à chaud, mais à replanifier explicitement plutôt que laisser la dette continuer de croître
   silencieusement.

### Actions à réaliser en priorité (ordre recommandé)

1. Rate limiting sur `/api/auth/login` + `/api/auth/register` (SECU-1) — correctif ciblé, sécurité.
2. Instrumentation `[DBG-COM27]` aux deux points précis identifiés en BUG-1, validation en jeu réel
   avant tout correctif de code (méthode du projet : reproduction avant analyse).
3. Vérification de la configuration réelle des en-têtes de réponse MinIO (SECU-3) — détermine si un
   correctif applicatif est réellement nécessaire ou si le facteur limitant est déjà couvert côté
   infra.
4. Décision produit sur INFRA-9 (script de garde-fou migrations) — process, pas du code, à valider
   avec Saar avant implémentation.

Tout le reste (§B/§C restants) est classé Basse priorité — observations utiles pour la prochaine fois
qu'un fichier concerné est de toute façon retouché, mais ne justifie pas un chantier dédié à froid.
