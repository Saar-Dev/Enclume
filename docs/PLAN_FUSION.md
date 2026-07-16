# PLAN_FUSION.md — Intégration du moteur de monde Kiwi
> Créé Session 142 (suite) — 2026-07-15

---

## Contexte

Kiwi (serveur distant) a développé en parallèle, sur sa propre branche `dev/cousin`
(47 commits), un moteur de monde complet remplaçant le système voxel legacy : salles,
murs courbes, portes, plafonds, multi-étages, ascenseurs, mouvement/portée/LOS
recalculés sur géométrie réelle au lieu d'une grille de voxels.

Ce travail a été consolidé en un seul commit propre **"Fusion Kiwi"** (`caaf1af`),
poussé sur `origin/fusion-kiwi-v2`. Base : `master` (`bad0190`, "Dernier pub avant la
fin du monde"). 328 fichiers, 40 454 insertions, 1 947 suppressions.

**Ce plan ne couvre pas la reconstruction du moteur** (déjà fait par Kiwi) — il couvre
la vérification et la réconciliation nécessaires avant d'intégrer `fusion-kiwi-v2` dans
`master`.

Notre propre tentative de fusion (branche `fusion-kiwi`, destruction du système voxel +
fix perf `useMemo` sur `Canvas3D.jsx`) est **abandonnée/obsolète** : le moteur de Kiwi
va plus loin (texture packages, variantes de sol, salles réelles) que ce que nous avions
commencé à reconstruire. Elle reste poussée sur `origin/fusion-kiwi` pour mémoire, non
fusionnée.

---

## État vérifié avant tout code (audit Session 142 suite, `git diff master fusion-kiwi-v2`)

**Intact, byte-identique entre `master` et `fusion-kiwi-v2`** — aucun risque de régression
sur le moteur de règles Polaris :
`shared/combatExclusiveActions.js`, `shared/naturalWeapons.js`, `shared/armorConstants.js`,
`shared/polarisUtils.js`, `shared/careerSkills.js`, `shared/careerAdvantages.js`,
`shared/careerSetbacks.js`, `shared/careerEligibility.js`, `shared/skillRequirements.js`,
`shared/autodidacte.js`, `server/src/services/mutationService.js`,
`server/src/services/modingService.js`, `server/src/lib/damageService.js`,
`server/src/routes/char-sheet.js`.

Kiwi a construit son moteur **par-dessus** l'état actuel de `master`, pas depuis un fork
ancien — confirmé par comparaison directe, pas supposé.

---

## Lots de réconciliation

### Lot 1 — Dépendances Redis / collision voxel

**Constat vérifié** : `server/src/lib/redis.js` (8 importeurs sur master),
`shared/losUtils.js`, `client/src/lib/pathfinder.js`, `server/src/socket/socketVoxel.js`
sont supprimés dans `fusion-kiwi-v2`. Remplacés par
`server/src/services/worldSpatialQueryService.js`,
`server/src/services/worldMovementService.js`,
`server/src/services/movementBudgetService.js`,
`server/src/services/worldVisibilityService.js` — vérifié que les 8 fichiers importeurs
de `lib/redis.js` sur master ne référencent plus `redis` du tout côté `fusion-kiwi-v2`
(remplacement complet, pas un trou).

`ioredis` reste listé dans `server/package.json` alors que **plus aucun fichier ne
l'importe** (vérifié par grep exhaustif sur `server/src`) — dépendance morte.

**À faire :**
- [ ] Confirmer que le conteneur Docker `redis:7-alpine` (remote) devient inutile —
      vérifier qu'aucun autre usage (session store, présence socket.io) ne dépend encore
      de Redis ailleurs que dans les fichiers déjà migrés.
- [ ] Si confirmé : retirer `ioredis` de `server/package.json`, retirer le service Redis
      du docker-compose distant.
- [ ] Si un usage caché est trouvé (ex. adapter socket.io multi-instance) : documenter
      avant de couper.

### Lot 2 — Migrations : numérotation et contenu

**Constat vérifié** : `fusion-kiwi-v2` introduit un nouveau chargeur de migrations
(`server/src/db/naturalMigrationSource.cjs`) qui corrige définitivement le bug **P52**
(tri lexical knex, documenté `CLAUDE.md`) — tri numérique réel + exclusion des
`*.test.mjs` co-localisées (fichiers de test des migrations, pas des migrations).
`server/src/db/knex.js` pointe désormais vers ce chargeur au lieu de `directory:`.

Les migrations 75-83 de `fusion-kiwi-v2` sont des **stubs de compatibilité no-op**
(vérifié par diff direct : `up`/`down` vides) pour d'anciens environnements ayant déjà
appliqué ces numéros chez Kiwi — la version réelle vit en 143-157. Sur une base fraîche
(notre master, arrêté à la migration 142), les stubs ne font rien puis 143+ s'appliquent
normalement. Pas de collision.

**Point réel à trancher** : nos anciennes migrations 143-149 (branche `fusion-kiwi`
abandonnée, `battlemaps.surface_data` minimal + suppression `voxel_data`) ne doivent
**jamais** être appliquées en parallèle de celles de Kiwi — même numérotation, contenu
différent et incompatible. Comme master n'a jamais dépassé 142, ce risque n'existe que
si quelqu'un rejoue la branche `fusion-kiwi` sur une base qui a déjà les migrations de
Kiwi (ou l'inverse).

**À faire :**
- [ ] Ne jamais merger `fusion-kiwi` (notre branche) après `fusion-kiwi-v2` — la
      considérer comme close/obsolète une fois ce plan terminé.
- [ ] Round-trip complet des migrations 143-157 de `fusion-kiwi-v2` sur une copie de la
      DB locale avant tout merge réel (P53/P54 — vérifier `knex_migrations` avant tout
      appel manuel, ne jamais enchaîner deux `up()`).
- [ ] Vérifier qu'aucune migration future (post-157, si des sessions parallèles en ont
      créé sur `master` entre-temps) ne re-collisionne numériquement.

### Lot 3 — Dépendances npm

**Constat vérifié** (diff `package.json` racine + `server/package.json`) :
- Nouvelles : `image-size`, `jszip`, `polygon-clipping` (racine),
  `image-size`, `jszip` (déjà présents racine, dupliqués côté serveur — à vérifier),
  `@playwright/test` (devDependency, tests e2e).
- Bump : `knex` `^3.2.7` → `^3.2.10`.
- `server/package.json` script `dev` : `nodemon --exec 'node --env-file=../.env
  --es-module-specifier-resolution=node' src/index.js` (chargement explicite de `.env`,
  différent du `nodemon src/index.js` actuel).
- `shared/package.json` (nouveau) : déclare `shared/` comme module ESM autonome
  (`"type": "module"`, aucune dépendance propre) — à vérifier que ça n'entre pas en
  conflit avec la façon dont `shared/` est actuellement importé (chemins relatifs directs
  depuis `client/`/`server/`, pas de résolution de package npm).

**À faire :**
- [ ] `npm install` complet racine + `server/` sur une copie de travail, vérifier
      qu'aucun conflit de version n'apparaît avec nos dépendances actuelles.
- [ ] Vérifier que `shared/package.json` ne casse pas les imports relatifs existants
      (`../../../shared/xxx.js` depuis `server/src/socket/*`).
- [ ] Tester `npm run test:world` (nouveau script, `shared/world/*.test.mjs` +
      `server/src/services/*.test.mjs`) une fois les dépendances installées.

### Lot 4 — Services systemd distants ✅ CLOS

**Constat initial** (doublon supposé) : `deploy/enclume-codex-{client,server}.service` +
`deploy/enclume-fusion-{client,server}.service` — 4 fichiers, alors que le serveur
distant tournait à l'époque sous d'anciens noms `enclume-server.service`/
`enclume-client.service`.

**Vérifié Session 142 suite (Claude) + confirmé indépendamment par Codex** : ce n'est pas
un doublon. Les 4 fichiers ciblent deux environnements distincts et légitimes, cohérents
avec le tableau `CLAUDE.md` §3 : `enclume-codex-*` → `/home/codex/Enclume-integrated`,
port 8293 (instance Saar/Codex) ; `enclume-fusion-*` → `/home/codex/Enclume-fusion`,
port 8393 (instance `integration`). Aucun service ne dispute le même port — le troisième
environnement (cousin, 8193/8194) est géré hors de ce dépôt par Kiwi. Les deux paires
sont actives et activées au démarrage (`docs/JOURNAL6.md` "Intégration commune —
2026-07-15"). Lot fermé, aucune action de code ou de renommage requise.

### Lot 5 — Scripts Python (pipeline d'assets) ✅ CLOS

**Constat** : `tools/generate_futuristic_hydroponics.py`,
`tools/render_algae_key_models.py`, `tools/validate_hydroponics_geometry.py` — génération/
validation de modèles GLB via Blender, hors stack Node/JS du projet.

**Vérifié Session 142 suite (Claude) + confirmé indépendamment par Codex** : outils
ponctuels dev-only, zéro référence dans `package.json`/CI/déploiement/runtime (grep
exhaustif). Les GLB générés sont déjà commités sous `output/futuristic_hydroponics/` et
sont consommés en production par le scanner générique
`server/src/lib/builtinModelCatalog.js` (scan de tout `output/*/manifest.json`) — Python/
Blender n'est pas requis côté serveur de production, seulement pour régénérer les assets
en amont si besoin. Lot fermé.

### Lot 6 — Combat : mouvement et portée

**Constat vérifié** : `shared/combatMovement.js`, `shared/combatRange.js` (nouveaux,
non présents sur master) — importés par `server/src/socket/socketCombatHelpers.js`
(`resolveWeaponRangeBand` depuis `combatRange.js`) sans casser les imports Polaris
existants (vérifié : le fichier importe aussi bien `combatExclusiveActions.js` que
`combatRange.js` côte à côte).

Ces fichiers touchent directement le mouvement/la portée en combat — intersection avec
nos règles Polaris (Seuil, ETQ, actions exclusives, Tir visé). Le fait qu'ils coexistent
sans supprimer nos imports est rassurant mais ne remplace pas une relecture ciblée.

**À faire :**
- [ ] Lecture complète de `shared/combatMovement.js`/`combatRange.js` avant tout test
      fonctionnel de combat post-fusion — vérifier qu'aucune règle Polaris n'est
      recalculée différemment (portée d'arme, malus de mouvement) par rapport à
      `docs/REGLES/REGLESYSCOMBAT.md`.
- [ ] Scénario de test dédié : un assaut à distance avec Tir visé + déplacement, avant/
      après fusion, comparer les résultats.

### Lot 7 — LOS (Line of Sight)

**Constat vérifié** : `server/src/lib/losService.js` divergent (74 insertions / 80
suppressions) — passe du calcul basé voxel/grille au calcul basé géométrie réelle
(`worldVisibilityService.js`). Lève potentiellement la dette `[SURF-COLLISION]` déjà
documentée (`docs/EN_COURS.md`).

**À faire :**
- [ ] Relecture complète de la nouvelle implémentation avant test.
- [ ] Scénario de test : LOS bloqué par un mur réel (pas une colonne de voxels) en
      combat, confirmer comportement correct.
- [ ] Si validé : fermer `[SURF-COLLISION]` dans `CLAUDE.md`/`EN_COURS.md`.

### Lot 8 — Interface jouable (front-end)

Audit indépendant demandé par Saar (Session 142), délibérément mené sans relire ce
plan avant conclusion, pour éviter tout biais d'ancrage sur un plan déjà écrit par un
autre agent. Moteur mouvement/collision/portée relu en entier (`shared/world/
navigation.js`, `spatialIndex.js`, `worldMovementService.js`) + `npm run test:world`
exécuté dans un worktree isolé (`../Enclume-fk2-worktree`, 124/124 tests passés),
`vite build` et `eslint` du client passés en comparaison directe avec `master` (pas de
régression de lint introduite par la fusion). Conclusion : le moteur lui-même est
solide, pas le risque principal — les points ci-dessous sont les trous concrets
trouvés, orientés raccordement/UX plutôt que reconstruction.

**Constat vérifié central** : `compileBattlemapWorld` (`server/src/services/
worldService.js`) ne compile que depuis `battlemap.surface_data` — `voxel_data`
n'est jamais lu par le moteur physique (seulement par le rendu de secours `Dungeon
TerrainScene`/diorama). Vérifié en base réelle (lecture seule, `vtt@localhost:5432`) :
campagne "Camp LOCALE" (81 personnages, 3 battlemaps, 5 membres) — zéro colonne
`surface_data` en base, 100% des cartes en voxel legacy. Sur une carte sans
`surface_data`, `world-move` renvoie systématiquement "unreachable" (graphe de
navigation vide) — seul le MJ peut encore déplacer un token, via `teleport`. Aucun
outil de conversion voxel→surface trouvé (recherche exhaustive). Campagne "La Forêt
Maudite" non concernée (1 personnage, 0 battlemap).

#### 8.A — Repartir propre plutôt que migrer (décision Saar) ✅ CODÉ, MIGRATION APPLIQUÉE, EXÉCUTÉ
Plutôt que reconstruire les 3 cartes à la main, décision Saar : supprimer la campagne
"Camp LOCALE" et repartir sur une campagne neuve pour bâtir des cartes propres dans
le nouvel éditeur. **Rayon d'action confirmé par Saar** : suppression de campagne
complète, pas seulement des battlemaps — `campaign_id` est en `CASCADE` sur
`characters`, `combat_*`, `documents`, `trade_*`, `dice_rolls`, `player_locations`
(vérifié sur les contraintes FK réelles) → les 81 personnages et tout leur historique
partent avec.

**Correction d'audit (2ᵉ et 3ᵉ)** : la recherche initiale ("aucune route, aucune UI")
était fausse sur les deux plans.
- Serveur : `DELETE /api/campaigns/:id` existe déjà (`server/src/routes/
  campaigns.js:249-281`) — `requireRole('gm')`, transaction (coupe la référence
  circulaire `default_battlemap_id` avant delete, cascade FK fait le reste),
  nettoyage MinIO best-effort. Absent de `master` (ajouté par Kiwi dans la fusion).
  Ma recherche initiale avait un regex trop strict (`"router.delete.*campaign"` —
  aucune ligne de code ne contient littéralement le mot "campaign" à cet endroit).
- Client : bouton déjà présent, mais sur **`DashboardPage.jsx`** (pas
  `CampaignSettingsPage.jsx` comme supposé) — `handleDeleteCampaign` (ligne 120),
  bouton visible uniquement si `campaign.role === 'gm'` (ligne 311), confirmation via
  `window.confirm(t('settings.deleteCampaignConfirm', { name }))`, état de
  chargement, gestion d'erreur. Clés `fr.json`/`en.json` déjà peuplées
  (`settings.deleteCampaign*`).

**Bug réel trouvé à l'exécution (pas juste à la lecture)** : la suppression a
d'abord échoué — `battlemap_texture_usage.battlemap_id` référence `battlemaps.id`
sans `ON DELETE CASCADE` (contrairement aux ~15 autres tables enfants d'une
campagne). Table toujours active côté nouveau moteur aussi (`battlemapWorldPersistence.js`
`syncBattlemapTextureUsage`), pas une relique — juste une règle de suppression
manquante. **Migration 158 créée, testée en round-trip réel, appliquée, commit isolé
fait** (`92cd8a4`). Suppression de "Camp LOCALE" réexécutée avec succès ensuite :
0 personnage/battlemap orphelin, "La Forêt Maudite" intacte.
Nettoyage MinIO (assets stockés) volontairement non répliqué — best-effort dans la
route réelle, jugé sans conséquence pour une campagne abandonnée (dette mineure,
objets orphelins possibles sous `campaigns/0010b982.../` dans MinIO local).

**Précision Saar (bouton)** : le bouton visible sur le **serveur distant** (pas
`master` local) est mal positionné (derrière les cartes, non cliquable) — à déplacer
de `DashboardPage.jsx` vers `CampaignSettingsPage.jsx` (nouvelle section "Zone de
danger"), en le retirant du Dashboard pour ne pas dupliquer.

**À faire :**
- [x] Migration CASCADE — codée, testée, appliquée, commitée.
- [x] Suppression réelle de "Camp LOCALE" — exécutée avec succès.
- [x] Bouton de suppression déplacé : nouvelle section "Zone de danger"
      (`SectionDanger.jsx`, NOUVEAU) dans `CampaignSettingsPage.jsx`, réutilise
      `handleDeleteCampaign`/clés i18n déjà existantes (`settings.deleteCampaign*`,
      `settings.dangerTitle`) ; retiré de `DashboardPage.jsx` (state
      `deletingCampaignId`, handler, bouton, style `cardDeleteBtn`).
- [ ] Créer une campagne neuve, construire au moins une battlemap de test dans le
      nouvel éditeur pour valider que `world-move` fonctionne de bout en bout
      (aucune carte avec `surface_data` n'a jamais été testée en conditions réelles).

**Testé** : `eslint` sur les 3 fichiers touchés (0 erreur/warning), `eslint` complet
client (113 problèmes, identique aux points de contrôle précédents — 0 régression),
`vite build` propre, `fr.json` valide, grep de sweep (aucune référence résiduelle).
**Non testé** : parcours navigateur réel du nouveau bouton dans "Zone de danger"
(logique identique à l'ancien bouton déjà utilisé avec succès par Kiwi en
production, donc risque jugé faible).

#### 8.B — Feedback d'échec de déplacement joueur ✅ CLOS SANS CODE
**Constat vérifié** : `world-move` renvoie 409 (`Destination unreachable`) — le
client (`Canvas3D.jsx:951`) se contente d'un `console.error`.

**Décision Saar (rappel du principe two-phase combat)** : Phase 1 Annonce = le joueur
annonce même l'impossible, aucune vérification ; Phase 2 Résolution = les règles
contraignent. Hors combat, un déplacement impossible ne doit produire **aucun**
message joueur — juste un log serveur.

**Vérifié après coup, aucun code nécessaire** : le client fait déjà exactement ça.
`setDragState(null)` (`Canvas3D.jsx`, `handlePointerUp`) s'exécute de façon
synchrone **avant** l'appel API — `TokenMesh` retombe donc instantanément sur la
dernière position confirmée par le store, avec le lerp existant qui lisse le retour,
que l'appel réussisse ou échoue. Le "log serveur clair" existe aussi déjà :
`server/src/middleware/errorHandler.js` logge chaque échec
(`[409] POST .../world-move — Destination unreachable`). Nuance identifiée et
acceptée (pas un blocage) : une collision d'occupation en temps réel (deux joueurs
dropent au même endroit à quelques ms d'écart) peut sembler un bug plutôt qu'une
règle — jugé trop rare pour justifier un traitement UI dédié.

#### 8.C — Placement libre MJ en drag (masquer/planquer des tokens) ✅ CODÉ
**Constat vérifié** : le drag (ghost pendant déplacement) ne distingue pas MJ/joueur
— les deux raycastent uniquement sur `userData.worldSupport` (sol/marches/échelles,
jamais les murs/plafonds — vérifié dans `SurfaceDungeonScene.jsx`). Si le curseur ne
survole aucun support, `raycastWorldSupport()` renvoie `null` et le déplacement
s'arrête net (`if (!destination) return`, `Canvas3D.jsx`) — y compris pour le MJ.

**Décision Saar** : le MJ doit pouvoir poser un token n'importe où, y compris hors de
toute géométrie construite, sans aucun raycast — cas d'usage : masquer/planquer un
token hors du plateau visible. Confirmé côté serveur : `teleport` n'impose déjà
aucune borne (`worldPointToDbPosition`/`normalizeWorldPoint` acceptent tout nombre
fini) — le blocage est uniquement client.

**Changement retenu** : réutiliser `raycastGround()` (plan Y=0 infini), déjà défini
et déjà utilisé ailleurs dans `Canvas3D.jsx` (ghost de poussée d'entité) — aucune
nouvelle géométrie. Dans `handlePointerMove` (branche de drag token normal, hors
combat, hors mode visée entité) :
```js
let destination = raycastWorldSupport(e.clientX, e.clientY)
if (!destination && isGm) destination = raycastGround(e.clientX, e.clientY)
if (!destination) return
```
Portée MJ uniquement — comportement joueur inchangé (raycast sol strict, cohérent
avec 8.A). Le fallback ne s'active que quand le raycast sol échoue ; quand un sol
existe sous le curseur, l'accroche précise actuelle reste prioritaire.

**À faire :**
- [x] Coder le changement ci-dessus.
- [ ] Scénario de test : MJ drag un token hors de toute géométrie (zone vide au-delà
      des murs construits) → le token doit suivre le curseur et se poser au sol Y=0 à
      cet endroit ; un joueur faisant la même chose doit voir le drag s'arrêter net
      comme aujourd'hui. (reporté à 8.F, nécessite une carte réelle)

**Testé** : `eslint` (0 nouvelle erreur/warning près des lignes touchées), `eslint`
complet client (113 problèmes, identique au point de contrôle 8.D — aucune
régression), `vite build` propre. `raycastGround`/`isGm` déjà présents dans le
tableau de dépendances de `handlePointerMove`, aucun ajustement nécessaire.
**Non testé** : parcours navigateur réel (scénario prévu dans 8.F, nécessite une
battlemap avec `surface_data`, donc après 8.A).

#### 8.D — Nettoyage props mortes `Canvas3D.jsx` — décision : supprimer les 4 ✅ CODÉ
**Constat vérifié** : `onTokenRotate`, `moveLabels`, `announcementMarker` déclarés
jamais utilisés dans `Scene()`, `yToLevel` importé jamais utilisé. 3 des 4 sont
antérieurs à la fusion (déjà morts sur `master`, pas une régression Kiwi) —
`yToLevel` est le seul introduit par la fusion (import copié depuis `Editor3D.jsx`).

**Décision Saar** :
- `onTokenRotate` — piste initiale (RadialMenu) vérifiée et écartée : le point central
  du `TokenRadialMenu.jsx:161` utilise en réalité `TOKEN_SET_ROTATION` (même
  mécanisme que `onTokenSetRotation`, déjà vivant via la caméra 3ᵃ personne), pas
  `TOKEN_ROTATE`. Serveur : `socketToken.js:93` gère toujours `WS.TOKEN_ROTATE`
  (rotation par pas de 45°, tag `9F-A`) mais plus aucun client ne l'émet — dead côté
  client uniquement, handler serveur laissé en l'état (hors scope de ce nettoyage).
- `moveLabels` — couleur du ghost jugée suffisante.
- `announcementMarker` — supersédé par `announcedActions` (gère déjà tous les
  déclarants ; `onActionDeclared` alimente les deux, `announcementMarker` ne retient
  que le dernier).
- `yToLevel` — import mort, aucun usage.

**À faire :**
- [x] Supprimer `onTokenRotate` : prop + destructuring (`Canvas3D.jsx` export et
      `Scene()`), `handleTokenRotate` (`SessionPage.jsx`).
- [x] Supprimer `moveLabels` : calcul (`useTranslation`) + prop + destructuring
      (`Canvas3D.jsx`) ; clés `fr.json` (`movePush`/`movePull`/`moveImpossible`)
      laissées telles quelles, hors scope de ce nettoyage.
- [x] Supprimer `announcementMarker` : état + setter (`useCombatSocket.js`), prop
      (`Canvas3D.jsx`/`SessionPage.jsx`).
- [x] Supprimer l'import `yToLevel` (`Canvas3D.jsx`).
- [x] `eslint` après coup — 4 des 5 erreurs `no-unused-vars` visées ont disparu
      (`yToLevel`/`onTokenRotate`/`moveLabels`/`announcementMarker`) ; la 5ᵉ (`t`
      inutilisé dans `Scene()`, ligne ~518) était déjà hors scope de ce point.

**Testé** : `eslint` sur les 3 fichiers touchés (0 nouvelle erreur), `eslint` complet
client (117→113 problèmes, exactement -4 erreurs, 0 changement de warnings — aucune
régression ailleurs), `vite build` (compile propre), grep de sweep (aucune référence
résiduelle aux 4 identifiants supprimés). Codé dans le worktree `../Enclume-fk2-
worktree` (branche `fusion-kiwi-v2` réelle), commit à faire.
**Non testé** : parcours navigateur réel (suppression de code mort sans changement de
comportement visible — risque jugé faible, mais pas confirmé humainement).

**Point d'étape Codex** : chargement visuel confirmé d'une carte multi-étages et du
combat sur l'instance `integration` (8393) — mais le scénario exact ci-dessous (8.F) pas
rejoué pas à pas.

#### 8.E — Indicateur visuel de blocage des entités — reporté, pas de code
**Constat vérifié** : `EntityMesh.jsx` ne rend aucun indicateur visuel du champ
`is_blocking` (utilisé côté serveur par `dynamicOccupantsFromRows` pour
l'occupation) — ni dans le Builder ni en session. Risque théorique identifié : une
entité multi-états dont le blocage change (ex. porte détruite `is_blocking:false`)
ne donne aucun repère visuel confirmant que le changement d'état a bien changé le
blocage réel.

**Décision Saar** : jamais rencontré ce problème en pratique à ce jour — pas de code
dans l'immédiat. Lacune connue mais non prioritaire, pas fermée par une vérification
(contrairement à 8.B) — à réévaluer si un cas concret apparaît en jeu.

**À faire :** aucun pour l'instant.

#### 8.F — Validation par scénario de test manuel (décision Saar) — 🔓 OUVERT, seul point bloquant restant du plan
**Constat vérifié** : le seul test automatique existant (`tests/e2e/smoke.spec.mjs`)
est un smoke test générique (page charge sans exception JS) — il ne teste rien du
déplacement/de la collision. Écrire un test Playwright dédié serait disproportionné
(aucune autre fonctionnalité du projet n'a ce niveau de couverture automatique).
**Décision Saar** : validation par scénario manuel, comme pour le reste du projet.

**Scénario de test (à exécuter une fois 8.A, 8.C, 8.D codés)** :
1. MJ supprime la campagne "Camp LOCALE" (8.A), crée une campagne neuve.
2. MJ construit une salle simple dans le nouvel éditeur (`SurfaceRoomPanel`/
   `SurfaceWallPanel`) — 2 pièces reliées par une porte, murs extérieurs fermés.
3. MJ place un token joueur dans la salle.
4. Joueur glisse son token à l'intérieur de la salle → déplacement normal, s'arrête
   au mur (ne le traverse pas).
5. Joueur glisse son token vers une destination hors de la salle (à travers un mur,
   ou dans le vide hors de toute géométrie construite) → le token reste/revient à sa
   position, aucun message d'erreur affiché (8.B), un log apparaît côté serveur.
6. MJ glisse un token vers une zone hors de toute géométrie construite → le token
   suit le curseur et se pose au sol (8.C) — comportement différent du joueur à
   l'étape 5, confirmé visuellement.
7. Vérifier au passage (8.D) qu'aucune erreur console liée aux props supprimées
   n'apparaît pendant tout le scénario.

---

## Ordre de traitement proposé

Un lot à la fois, chacun confirmé fonctionnel avant le suivant (protocole habituel) :

1. Lot 3 (dépendances) — préalable technique, rien ne tourne sans ça.
2. Lot 2 (migrations) — round-trip complet avant de toucher au code applicatif.
3. Lot 1 (Redis) — confirmation/nettoyage, faible risque.
4. Lot 7 (LOS) puis Lot 6 (mouvement/portée combat) — cœur du gameplay, tests dédiés.
5. Lot 4 (services distants) et Lot 5 (scripts Python) — opérationnel, indépendant du
   reste, peut être fait en parallèle par Kiwi/Saar.
6. Lot 8 (interface jouable) — 8.A peut démarrer immédiatement, en parallèle du
   reste (indépendant, mais prérequis pour tout test réel en jeu, y compris 8.F) ;
   8.B à 8.F suivent le Lot 6/7 (nécessitent une carte réelle en `surface_data` pour
   être testés).

Une fois les 8 lots clos : merge de `fusion-kiwi-v2` dans `master`, tag de sauvegarde
avant merge, mise à jour `ASBUILT.md`/`CLAUDE.md`/`EN_COURS.md`, archivage de ce plan
selon `docs/RegleDocumentaire.md` Règle 10.

---

## Hors scope de ce plan

- Reconstruction du moteur de monde lui-même (fait par Kiwi, `fusion-kiwi-v2`).
- Notre branche `fusion-kiwi` (destruction voxel + fix perf `Canvas3D.jsx`) — obsolète,
  non reprise, conservée sur `origin/fusion-kiwi` pour mémoire uniquement.
