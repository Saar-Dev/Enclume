> Base de travail pour le futur plan (Saar rédige le plan à partir de ceci). Pas un plan — uniquement
> ce qui est su par lecture de code + les fichiers concernés. Origine : `docs/BUGIDENTIFIE.md`
> ENTITYCLICK1 (porte/échelle sans interaction joueur en session).

## Contexte

Porte, échelle et ascenseur sont tous les trois des **connecteurs** (`docs/VOCABULARY.md` : « élément
structurel lié à une salle... stocké dans `surface_data.connectors` »). Seul l'ascenseur a une
interaction joueur fonctionnelle aujourd'hui. Porte et échelle n'ont d'interaction que côté éditeur
(MJ, hors session) — cliquer dessus en jeu ne fait rien.

## Ascenseur — seul connecteur avec interaction joueur (référence)

- Clic → `Canvas3D.jsx:1570` `handleSurfaceConnectorSelect` → ouvre `SurfaceConnectorPanel.jsx`
  (`canEdit={false}` en session) → `ElevatorRuntimeControls` (`SurfaceConnectorPanel.jsx:59-108`,
  inconditionnel à `canEdit` — boutons d'appel de cabine toujours actifs pour un joueur, boutons admin
  bloquer/débloquer/ouvrir/fermer réservés à `canAdminElevator`/MJ).
- Commande → `POST /battlemaps/:id/world-elevators/:elevatorId/commands` (`server/src/routes/
  battlemaps.js:578`) → `commandBattlemapElevator` (`server/src/services/worldElevatorService.js:233`).
- État runtime : table `world_elevator_passengers` (Postgres) + `battlemaps.runtime_revision` bumpé à
  chaque commande pour invalider le cache et forcer une recompilation du `WorldSnapshot`
  (`reconcileBattlemapElevators`, ligne 192).
- Sync client : store dédié `runtimeElevatorStates` (`client/src/lib/useWorldRuntimeSync.js`), rafraîchi
  après chaque commande (`Canvas3D.jsx` `handleElevatorCommand` → `refreshRuntimeElevators`).
- Diffusion temps réel : `emitElevatorRuntime` (`server/src/routes/battlemaps.js:116`) — événement WS
  dédié (à identifier précisément dans `shared/events.js` si besoin pour le plan).

## Porte — état actuel

- Type `connector.type === 'door'`, champ statique `connector.state` (`closed`/`open`/`locked`),
  modifiable uniquement dans l'éditeur MJ (`SurfaceConnectorPanel.jsx:178-187`, `<select>` gardé par
  `canEdit && connector.type === 'door'` — jamais affiché en session, `canEdit={false}` à
  `Canvas3D.jsx:1655`).
- Clic en session : `ConnectorSegment` (`SurfaceDungeonScene.jsx:1589-1594`) remonte bien l'événement,
  mais `handleSurfaceConnectorSelect` (`Canvas3D.jsx:1571`) l'ignore : `if (connector?.type !==
  'elevator') return`.
- **Le compilateur du monde a déjà le crochet pour un état runtime de porte**, jamais utilisé :
  `doorGeometry(connector, surface, runtimeState)` (`shared/world/worldCompiler.js:455-466`) —
  `const state = runtimeState?.state || connector.state || 'closed'` — et `addWallsAndDoors`
  (ligne 841-870) applique déjà les conséquences collision/LOS/eau/gaz selon cet état (`isOpen`,
  ligne 867-870). Seul `connector.state` (statique) alimente ce calcul aujourd'hui ; aucun code ne
  peuple jamais `runtimeState` pour une porte (contrairement à l'ascenseur, qui a son propre store
  `runtimeElevatorStates`).
- Aucune route serveur équivalente à `/world-elevators` n'existe pour les portes (recherché, absent).
- Fichiers concernés : `client/src/components/Canvas3D.jsx`, `client/src/components/
  SurfaceDungeonScene.jsx` (`ConnectorSegment`, rendu porte), `client/src/components/
  SurfaceConnectorPanel.jsx`, `client/src/lib/useWorldRuntimeSync.js` (pattern à répliquer),
  `shared/world/worldCompiler.js` (`doorGeometry`, `addWallsAndDoors`), `server/src/routes/
  battlemaps.js` (pattern `/world-elevators` à répliquer), `server/src/services/
  worldElevatorService.js` (pattern service à répliquer), migrations Postgres si un état runtime
  persistant est nécessaire (voir `world_elevator_passengers` comme référence de table dédiée).

## Échelle — état actuel

- Type `connector.type === 'ladder'`. Encore moins construit que la porte : pas de champ `state` dans
  `SurfaceConnectorPanel.jsx` (seulement listée dans `connectorTypeLabel`, ligne 46, et dans
  `connectorBlockingForState`, ligne 24-32, qui la traite comme un connecteur non-bloquant fixe —
  `blocksSight: false, blocksMovement: false` toujours, pas d'état ouverte/fermée à faire varier).
- Rendu 3D : `SurfaceDungeonScene.jsx:1638` (`connector.type === 'ladder'`) — support de traversée
  verticale, déjà fonctionnel pour le déplacement (navigation `shared/world/navigation.js`, hors
  périmètre de ce document).
- Ce qui manque n'est probablement pas un état ouvert/fermé (une échelle ne se verrouille pas au sens
  RAW) mais une action joueur explicite (monter/descendre), si le déplacement automatique par pathfinding
  ne suffit pas déjà — à clarifier : `[INCONNU]`, le mécanisme de déplacement vertical existant
  (navigation) n'a pas été vérifié pour savoir s'il couvre déjà l'usage sans clic dédié.
- Fichiers concernés : mêmes fichiers que porte pour le clic/panel (`Canvas3D.jsx`,
  `SurfaceDungeonScene.jsx`, `SurfaceConnectorPanel.jsx`) + `shared/world/navigation.js` (à vérifier
  avant de conclure qu'une interaction dédiée est nécessaire).

## Fichiers concernés (récapitulatif)

**Client** : `Canvas3D.jsx`, `SurfaceDungeonScene.jsx`, `SurfaceConnectorPanel.jsx`,
`useWorldRuntimeSync.js`, `Editor3D.jsx` (pour comparaison avec le mode édition, ne pas modifier sans
raison).
**Partagé** : `shared/world/worldCompiler.js`, `shared/world/navigation.js`, `shared/events.js`
(registre WS).
**Serveur** : `server/src/routes/battlemaps.js`, `server/src/services/worldElevatorService.js`
(référence de pattern).
**Données** : `surface_data.connectors` (document statique), table `world_elevator_passengers`
(référence pour une éventuelle table équivalente porte si un état persistant au-delà de
`connector.state` s'avère nécessaire).
