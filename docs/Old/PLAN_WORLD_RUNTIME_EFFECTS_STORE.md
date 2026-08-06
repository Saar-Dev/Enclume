# PLAN_WORLD_RUNTIME_EFFECTS_STORE — Autorité unique pour les effets/ascenseurs runtime

> **ARCHIVÉ 2026-08-06 (`docs/RegleDocumentaire.md` Règle 10) — chantier clos, Lots A-C confirmés
> fonctionnels en navigateur par Saar (régions d'effets 3D, transition d'ascenseur, bascule
> édition/jeu, panneau MJ, propagation de l'émission corrigée entre plusieurs clients). Contenu
> durable transféré vers `docs/SYSTEME/EDITEUR.md` §7 et `docs/ASBUILT.md`. Débloque le Lot 5 de
> `docs/PLANS/PLAN_REFACTOR_SIDEBAR.md` (reste : extraction de `SurfaceEditorPanel.jsx`).**

> Statut : clos. Créé 2026-08-06 (Saar + Claude), extrait de la décision d'architecture bloquant
> `docs/PLANS/PLAN_REFACTOR_SIDEBAR.md` Lot 5 (`REFACTOR_GLOBAL.md` §3). Responsabilité unique
> (`RegleDocumentaire.md` Règle 1) : ce PLAN ne traite que la synchronisation des effets/ascenseurs
> runtime — pas la décomposition plus large d'`Editor3D.jsx` (5 responsabilités documentées dans
> `docs/SYSTEME/EDITEUR.md`), ni l'extraction de `SurfaceEditorPanel.jsx` (reste le Lot 5 de
> `PLAN_REFACTOR_SIDEBAR.md`, débloqué une fois ce PLAN clos).

---

## 1. Constat vérifié (lecture intégrale des 3 fichiers + routes serveur)

`GET /battlemaps/:id/world-effects` et `GET /battlemaps/:id/world-elevators` sont chacun appelés
indépendamment par **3 fichiers**, pas 2 comme l'estimation initiale de `REFACTOR_GLOBAL.md` §1/§3 le
laissait penser :

| Fichier | Monté quand | Fetch effets | Fetch ascenseurs | Filtrage `WORLD_RUNTIME_UPDATED` |
|---|---|---|---|---|
| `Sidebar.jsx` | toujours (session entière) | oui (`definitions`+`instances`, panneau MJ) | non | **aucun** — tout événement matching `battlemapId` redéclenche un fetch, y compris hors mode édition où le panneau n'est même pas affiché |
| `Editor3D.jsx` | `mode === 'edit'` (cartes 3D) | oui (`regions` seulement) | oui + poll 300ms si transition | correct — ignore `elevator-*` pour les effets, ignore `elevator-clock` pour les ascenseurs |
| `Canvas3D.jsx` | `mode !== 'edit'` (cartes 3D) | oui (`regions` seulement) | oui + poll 300ms si transition | identique à `Editor3D.jsx`, dupliqué à l'identique |

`Editor3D.jsx` et `Canvas3D.jsx` sont mutuellement exclusifs (`SessionPage.jsx` : ternaire sur `mode`,
jamais montés ensemble). `Sidebar.jsx` est monté en permanence mais son panneau de gestion des effets
(`worldEffects`, `createCustomEffect`, `deleteRuntimeEffect`) n'est rendu que dans le bloc
`{mode === 'edit' && (...)}` — donc uniquement pendant qu'`Editor3D.jsx` est également monté (vérifié :
le bouton de bascule Édition/Jeu est lui-même masqué sur les cartes 2D, `renderMode2D` →
`isGm && !renderMode2D`, et `SessionPage.jsx` force `mode` hors édition si la carte est 2D — donc ce
panneau ne peut jamais être visible sans qu'`Editor3D.jsx` soit monté).

**Conséquence concrète, pas seulement un doublon de code** : à tout instant où l'utilisateur a une
session ouverte, `Sidebar.jsx` interroge `/world-effects` en parallèle d'`Editor3D.jsx` OU de
`Canvas3D.jsx` — deux requêtes réseau et deux listeners socket pour la même donnée — et **hors mode
édition, `Sidebar.jsx` continue de fetcher/écouter pour un panneau qui n'est jamais affiché**.
`Editor3D.jsx`/`Canvas3D.jsx` re-fetchent inutilement les ascenseurs à chaque tick d'horloge pendant
qu'une transition est en cours ET republient un poll 300ms local — dupliqué sans coordination entre les
deux (bénin car mutuellement exclusifs, mais même code copié-collé deux fois).

Violation directe de la priorité #4 du contrat (« une propriété métier ou physique possède une autorité
unique ») et de `react.md` (« Les stores contiennent l'état partagé; éviter une seconde copie locale
divergente »).

**Bug serveur trouvé en vérifiant les émissions `WS.WORLD_RUNTIME_UPDATED`** (`server/src/routes/battlemaps.js`) :
`POST /:id/world-effects/definitions` (création d'un effet personnalisé MJ) est la **seule** mutation du
cluster `world-effects` qui n'émet **aucun** `WORLD_RUNTIME_UPDATED` — toutes les routes soeurs
(instances create/update/delete/propagate) l'émettent. Violation de `core.md` (« Une action mutante
émet après succès l'événement nécessaire aux autres clients »). Sans ce correctif, un store centralisé
ne serait notifié de la création d'un effet personnalisé par aucun canal — `Sidebar.jsx` masque
aujourd'hui ce bug en rappelant `refreshWorldEffects()` localement après son propre `POST`, ce qui ne
fonctionne que pour l'auteur de l'action, jamais pour les autres clients connectés à la même campagne.

---

## 2. Architecture retenue

Recherche externe (déjà citée dans `REFACTOR_GLOBAL.md` §1, approfondie ici) : `pascalorg/editor`
(21k★, éditeur React Three Fiber cité comme référence du projet) gère état partagé et undo/redo via des
stores Zustand dédiés, jamais via des refs/état local dupliqués par composant consommateur — confirme la
direction plutôt qu'elle ne l'invente : `react.md` demandait déjà « Les stores contiennent l'état
partagé ».

- **`client/src/stores/worldRuntimeStore.js`** (nouveau) — store Zustand : `battlemapId`, `worldEffects`
  (`{ definitions, instances, regions, featureStates }`, forme exacte déjà renvoyée par
  `listBattlemapWorldEffects` côté serveur — vérifié, aucune projection à inventer), `runtimeElevatorStates`,
  plus les actions `fetchWorldEffects(battlemapId)` / `fetchRuntimeElevators(battlemapId)` (le fetch et
  la mise à jour du store vivent ensemble, appelables aussi bien depuis le hook de synchronisation que
  ponctuellement depuis `Sidebar.jsx` après une mutation qu'elle déclenche elle-même).
- **`client/src/lib/useWorldRuntimeSync.js`** (nouveau hook) — possède le cycle de vie complet
  aujourd'hui dupliqué dans `Editor3D.jsx`/`Canvas3D.jsx` : fetch initial, poll 300ms pendant une
  transition d'ascenseur, écoute `WORLD_RUNTIME_UPDATED` avec le filtrage déjà correct d'`Editor3D.jsx`
  (repris tel quel, pas réinventé). Appelé **une seule fois par rendu de session**, depuis
  `Editor3D.jsx` OU `Canvas3D.jsx` selon lequel est monté (mutuellement exclusifs — jamais un double
  abonnement).
- **`Sidebar.jsx`** ne fetch plus rien : lit `worldEffects` directement depuis le store
  (`useWorldRuntimeStore`), ce qui est toujours sûr car son panneau n'est visible que lorsqu'`Editor3D.jsx`
  est monté et synchronise déjà le store. Ses handlers de mutation (`createCustomEffect`,
  `deleteRuntimeEffect`) appellent l'action `fetchWorldEffects` du store directement après leur propre
  requête, pour un retour visuel immédiat sans dépendre du round-trip socket — mais ne portent plus
  aucun abonnement/poll.
- **`server/src/routes/battlemaps.js`** : ajoute l'émission `WORLD_RUNTIME_UPDATED`
  (`kind: 'effect-definition-created'`) manquante sur `POST /:id/world-effects/definitions`, alignée sur
  le patron des 4 routes soeurs. Corrige le bug §1 pour tous les clients, pas seulement l'auteur.

## 3. Hors périmètre

- La décomposition plus large d'`Editor3D.jsx` (sauvegarde, undo/redo, textures, panneaux flottants —
  4 des 5 responsabilités de `docs/SYSTEME/EDITEUR.md`, seule la 5ᵉ — effets runtime/ascenseurs — est
  traitée ici). Reste un chantier à cadrer séparément si retenu.
- `SurfaceEditorPanel.jsx` (extraction de la palette hors de `Sidebar.jsx`) — Lot 5 de
  `PLAN_REFACTOR_SIDEBAR.md`, débloqué mais pas fait par ce PLAN.
- Tout changement de comportement du filtrage `WORLD_RUNTIME_UPDATED` au-delà de la réutilisation
  verbatim de la version déjà correcte (`Editor3D.jsx`) — pas de nouvelle règle de filtrage inventée ici.

---

## 4. Suivi des lots

### Lot A — Store + hook de synchronisation + branchement `Editor3D.jsx`/`Canvas3D.jsx` — ✅ codé (2026-08-06)
Fichiers : `client/src/stores/worldRuntimeStore.js` (nouveau, 39 l.), `client/src/lib/useWorldRuntimeSync.js`
(nouveau, 44 l.), `client/src/components/Editor3D.jsx`, `client/src/components/Canvas3D.jsx`.
Invariant respecté : comportement de rendu strictement inchangé (mêmes props `runtimeEffectRegions`/
`runtimeElevatorStates` transmises aux scènes, même filtrage `WORLD_RUNTIME_UPDATED` repris verbatim
d'`Editor3D.jsx`) — seule la source de la donnée change.

**Vérification anti-régression** (au-delà du build) : les deux fichiers modifiés contenaient déjà des
erreurs/avertissements `eslint` préexistants sans rapport avec ce lot (13 erreurs `react-hooks/refs` +
3 avertissements dans `Canvas3D.jsx`, 9 avertissements `exhaustive-deps` dans `Editor3D.jsx`). Relint de
la version `git show HEAD:...` de chaque fichier pour confirmer un compte **strictement identique**
avant/après (mêmes règles, même nombre, lignes décalées uniquement par les lignes retirées/ajoutées) —
aucune régression, aucune dette préexistante masquée par ce lot.

**Testé** : `eslint` sur les 4 fichiers (0 nouvelle erreur/avertissement introduit — voir vérification
ci-dessus), `npm run build` (client, propre — même avertissement préexistant de taille de chunk).
Reconfirmé indépendamment le 2026-08-06 après coup (relecture de session) : relint des 5 fichiers du
chantier (0 erreur/warning nouveau, mêmes 13 erreurs + 3 warnings préexistants dans `Canvas3D.jsx`,
mêmes 9 warnings dans `Editor3D.jsx`), `npm run build` propre.
**Non testé** : rendu réel en navigateur (régions d'effets visibles en 3D, transition d'ascenseur avec
poll 300ms, bascule mode édition/jeu).
**Données** : aucune.
**Retour arrière** : commit `5e3dc84` (fusionné avec les lots B et C — voir §5).

### Lot B — `Sidebar.jsx` lit le store, plus de fetch local — ✅ codé (2026-08-06)
Fichiers : `client/src/components/Sidebar.jsx`.
Invariant respecté : panneau de gestion des effets MJ identique à l'utilisateur (mêmes lectures
`worldEffects.definitions`/`.instances`), sans fetch/listener propre — `createCustomEffect`/
`deleteRuntimeEffect` appellent directement l'action `fetchWorldEffects` du store après leur requête,
pour un retour visuel immédiat identique à avant. Import `useCallback` devenu inutile, retiré.

**Testé** : `eslint` (0 erreur, 0 warning), `npm run build` (propre). Reconfirmé indépendamment
le 2026-08-06 (relecture de session) : mêmes résultats.
**Non testé** : rendu réel en navigateur (panneau effets MJ en mode édition — liste, création,
suppression).
**Données** : aucune.
**Retour arrière** : commit `5e3dc84` (fusionné avec les lots A et C — voir §5).

### Lot C — Correctif serveur (émission manquante) — ✅ codé (2026-08-06)
Fichier : `server/src/routes/battlemaps.js` — `POST /:id/world-effects/definitions` émet désormais
`WS.WORLD_RUNTIME_UPDATED` (`kind: 'effect-definition-created'`), aligné sur le patron des 4 routes
sœurs (`effect-created`/`-updated`/`-deleted`/`-propagated`). `runtimeRevision` : cette route ne fait
aucune mutation sur `battlemap.runtime_revision` (contrairement aux routes d'instances) — valeur
actuelle du battlemap réémise telle quelle, pas de nouvelle incrémentation inventée. Vérifié qu'aucun
code client ne compare `runtimeRevision` pour une logique de conflit (contrairement à
`voxel_revision`/`surface_revision`, un système de révision différent et sans rapport) — purement
informatif ici, aucun risque à le réémettre inchangé.

**Non fait dans ce lot** : test automatisé — aucun fichier de test n'existe pour les routes
`world-effects` de `battlemaps.js` (vérifié, aucun `*worldEffect*.test.mjs`), et ce correctif est une
ligne mécaniquement identique aux 4 routes sœurs déjà en production. Risque jugé proportionnellement
faible pour ne pas justifier de bâtir l'infrastructure de test HTTP/socket de ce fichier pour une seule
ligne — à réévaluer si `battlemaps.js` reçoit un jour une suite de tests plus large.

**Testé** : `node --check` (syntaxe valide). Reconfirmé indépendamment le 2026-08-06 (relecture de
session) : même résultat.
**Non testé** : scénario réel (GM crée un effet personnalisé, un autre client connecté à la même
campagne voit sa liste d'effets se rafraîchir sans action de sa part — c'est précisément le
comportement que ce correctif ajoute, invisible pour l'auteur de l'action qui avait déjà son rappel
local).
**Données** : aucune.
**Retour arrière** : commit `5e3dc84` (fusionné avec les lots A et B — voir §5).

---

## 5. Commits

Un commit par lot, testé et rapporté (Testé/Non testé) avant le suivant était le principe annoncé —
**non tenu en pratique** : les lots A, B et C ont été committés ensemble en un seul commit
(`5e3dc84`, 2026-08-06), les diffs des trois lots s'étant imbriqués sur la même session sans point
de coupure propre entre eux (même précédent documenté pour les lots 2/3a/3b de
`PLAN_REFACTOR_SIDEBAR.md` §5). Rapport Testé/Non testé conservé séparément par lot ci-dessus malgré
le commit unique, pour ne pas perdre la granularité de ce qui a été vérifié pour chacun.

---

## 6. Statut réel (relecture de session, 2026-08-06)

Les trois lots sont codés, committés et déjà publiés (`5e3dc84`, `dev/Saar` à jour avec
`origin/dev/Saar` — vérifié par `git log origin/dev/Saar..dev/Saar`, aucun commit local non publié).
Vérification indépendante (au-delà du commit) : lecture des 5 fichiers modifiés
confirmant le comportement décrit dans chaque lot, relint (mêmes 13 erreurs + 12 warnings
préexistants, 0 nouveau), rebuild client propre, `node --check` sur la route serveur — tout conforme
aux affirmations du commit.

**Clôture (2026-08-06)** : les 5 scénarios navigateur soumis à Saar sont tous confirmés (régions
d'effets 3D, création/suppression d'effet personnalisé dans le panneau MJ, bascule édition/jeu,
transition d'ascenseur avec poll 300ms, propagation de l'émission serveur corrigée entre plusieurs
clients connectés à la même campagne). PLAN archivé (`docs/RegleDocumentaire.md` Règle 10), contenu
durable transféré vers `docs/SYSTEME/EDITEUR.md` §7 et `docs/ASBUILT.md`.
