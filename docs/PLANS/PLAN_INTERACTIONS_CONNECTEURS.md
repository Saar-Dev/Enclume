# PLAN_INTERACTIONS_CONNECTEURS.md — Interaction joueur avec les portes

> Version 1 — 2026-09-01 (Claude/Saar). Remplace la « base de travail » (2026-08-25) qui précédait
> cette version — contenu conservé, restructuré en plan réel (`ROADMAP.md` §1, prochaine étape :
> « écrire le plan réel... puis coder »). Origine : `docs/BUGIDENTIFIE.md` ENTITYCLICK1 (porte/échelle
> sans interaction joueur en session).
>
> Marquage (`METHODO_PLAN.md`) : **[VÉRIFIÉ]** = lu dans le code cette session, **[CIBLE]** =
> architecture proposée, rien codé, **[OUVERT]** = décision non tranchée.
>
> **Échelle explicitement hors périmètre de cette tranche** (un problème à la fois) : le doc de base
> notait `[INCONNU]` si le pathfinding existant (`shared/world/navigation.js`) couvre déjà la
> traversée verticale sans clic dédié — pas vérifié ici, à cadrer séparément. Ce plan ne couvre que la
> porte.

---

## 0. Responsabilité unique

Permettre à un joueur (et au MJ) d'agir sur une porte en session — l'ouvrir, la fermer, tenter de
crocheter une serrure — avec la même autorité serveur et le même patron d'arbitrage MJ que le reste du
projet, sans dupliquer la mécanique de l'ascenseur ni celle des entités libres.

---

## 1. RAW pertinent [VÉRIFIÉ]

- Une porte a 3 états : `closed` / `open` / `locked` (`surface_data.connectors[].state`, déjà dans le
  schéma v12, `shared/world/surfaceDocument.js:372-378`).
- Ouvrir une porte `closed` ou la refermer est une action libre, sans Test — aucune règle RAW ne
  l'exige.
- Une porte `locked` : `REGLECOMPETENCE.md:1093-1101` — la Compétence **Systèmes de sécurité (X)**
  couvre explicitement *« crocheter les serrures simples ou forcer les serrures électroniques. La
  Difficulté dépend de la complexité du système. »* Elle exige normalement un matériel adapté
  (rossignols / outils électroniques) — non modélisé ici, écart RAW assumé comme pour tout matériel
  non inventorié spécifiquement (cohérent avec le reste du projet, aucune règle d'inventaire de
  crochets n'existe).
- Aucune règle RAW ne borne la Difficulté d'une serrure à une valeur fixe : elle dépend de la
  "complexité du système", laissée à l'appréciation du MJ au cas par cas — d'où le champ d'autorat
  `lockDifficultyDc` par porte (§3).
- Convention de signe (vérifiée dans le code, pas déduite) : `defaultDifficulty` est un modificateur
  **signé** ajouté directement au Seuil (`socketEntity.js:322-323`,
  `chancesDeReussite = skillTotal + defaultDifficulty + gmModifier`) — positif = bonus (plus facile),
  négatif = malus (plus dur), cohérent avec le RAW (`REGLE_MUTATION.md:99` : *"Très difficile, -7"*).
  **Décision Saar (2026-09-01) : fallback `-5`** si `lockDifficultyDc` n'est pas renseigné (§6) — un
  malus, pas un bonus.

---

## 2. Ce qui existe déjà et sera réutilisé, jamais dupliqué [VÉRIFIÉ]

| Brique | Fichier | Rôle réutilisé |
|---|---|---|
| Table d'état runtime générique | `world_feature_states` (migration `97`, `battlemap_id`+`feature_id` UNIQUE, JSONB `state`, `version`) | Persistance porte, `feature_id` = `connector.worldId` — même table que l'ascenseur, zéro migration |
| Écriture transactionnelle versionnée | `setWorldFeatureState({ battlemapId, featureId, state, userId })` (`worldEffectService.js:164`) | Écrit l'état porte : verrou de ligne, version, `bumpRuntimeRevision` dans la même transaction |
| Lecture runtime déjà exposée au client | `listBattlemapWorldEffects` → `GET /battlemaps/:id/world-effects` (`worldEffectService.js:119-131`) renvoie déjà `featureStates` (TOUTES les lignes `world_feature_states`, générique) | Le client a déjà `worldEffects.featureStates` en store (`worldRuntimeStore.js`), jamais consommé pour une porte — **aucune nouvelle route REST nécessaire** |
| Compilateur — lecture de l'état runtime porte | `doorGeometry(connector, surface, runtimeState)` (`worldCompiler.js:455-466`), `addWallsAndDoors` (ligne 841-870) | Lit déjà `runtimeStates[connector.worldId]?.state`, applique déjà collision/LOS/eau/gaz selon l'état — **zéro changement compilateur** |
| Diffusion + re-fetch client déjà générique | `WORLD_RUNTIME_UPDATED` écouté par `useWorldRuntimeSync.js:35-44` : tout `kind` ne commençant pas par `elevator-` déclenche `refreshWorldEffects()` | Émettre l'event avec un `kind` dédié (ex. `door-state`) suffit à rafraîchir `featureStates` chez tous les clients — **zéro nouveau mécanisme de sync** |
| Patron d'arbitrage MJ (Test optionnel → confirmation → jet → état → broadcast) | `ENTITY_ACTION_REQUEST`/`RESOLVE` (`socketEntity.js:64-187, 192-...`) | Patron à répliquer pour `CONNECTOR_ACTION_REQUEST`/`RESOLVE` — timeout 60s, Map `pendingConnectorActions`, jet 1d20 + total compétence vs DC, bonus critique (`polarisTestResolution.js`) |
| Carte de chat GM "demande en attente" | `useEntitySocket.js:37-51` (`type: 'entity_action', gmOnly: true`) + rendu `MessageRendererRegistry.jsx` | Mirroir pour `type: 'connector_action'` — même mécanisme de notification, pas un nouveau canal |
| Composant runtime satellite du panel connecteur | `ElevatorRuntimeControls` (`SurfaceConnectorPanel.jsx:59-108`) | Mirroir `DoorRuntimeControls` — boutons Ouvrir/Fermer/Crocheter au lieu d'appel de cabine |

**Nouveau, pas de réutilisation possible** :
- Mesure de distance joueur↔porte — aucune fonction équivalente à
  `measureBattlemapTokenEntityDistance` n'existe pour un connecteur (les connecteurs sont statiques
  dans `surface_data`, jamais mesurés comme cible aujourd'hui). **Correction (analyse à charge
  2026-09-01)** : une porte n'a pas de point unique — `axis: 'x'|'z'` donne un **segment**
  (`x0,x1,z0,z1,y`, `surfaceDocument.js:376-377`), `axis: 'segment'` (mur courbe) donne un arc
  (`anchorX/anchorZ/tangentX/tangentZ/normalX/normalZ`, ligne 378-379). La fonction nouvelle doit
  projeter la position du token sur le segment le plus proche (`x`/`z`) ou sur la corde droite en
  approximation pour le cas courbe — jamais une distance à un point d'ancrage qui n'existe pas pour le
  cas `x`/`z`. **Précision (analyse critique 2026-09-02)** : vérifié, aucune primitive point→segment
  n'existe dans `shared/world/worldMetrics.js` — mais c'est là qu'elle doit vivre (géométrie pure),
  pas dans `worldSpatialQueryService.js` (qui fait déjà de la DB) : `worldSpatialQueryService.js`
  importe déjà ses calculs de distance depuis `worldMetrics.js` (vérifié, ligne 6) pour le cas
  token↔token/entité, jamais inline. Même split pour le connecteur : géométrie pure dans
  `worldMetrics.js`, orchestration (charger le token + le connecteur) dans
  `worldSpatialQueryService.js`.
- Champ d'autorat `lockDifficultyDc` (§3) — nouvelle clé JSON dans le schéma v12 `connectors`
  (`surfaceDocument.js`), pas une nouvelle table.

---

## 3. Persistance [CIBLE]

**Aucune migration.** Deux surfaces de données existantes suffisent :

- **Document statique** (`surface_data.connectors[id]`, déjà existant) — le MJ continue de fixer
  l'état *initial*/autoré (`state: 'closed'|'open'|'locked'`) via `SurfaceConnectorPanel.jsx` en mode
  éditeur (`canEdit`), inchangé. **Ajout** : quand `state === 'locked'`, un champ numérique
  `lockDifficultyDc` (Difficulté RAW du Test Systèmes de sécurité, §1) — validé dans
  `shared/world/surfaceDocument.js` (même bloc que `item.type === 'door'`, ligne ~375).
- **État runtime** (`world_feature_states`, `feature_id = connector.worldId`) — écrit uniquement une
  fois qu'un joueur ou le MJ agit en session. Tant qu'aucune ligne n'existe, `doorGeometry` retombe sur
  `connector.state` (comportement déjà en place, inchangé). Une fois écrite, la ligne runtime prend le
  dessus — exactement le même rapport document-statique/état-runtime que l'ascenseur
  (`.claude/rules/world.md`).

---

## 4. Contrat socket `CONNECTOR_ACTION_REQUEST` / `RESOLVE` [CIBLE]

```js
// Client → serveur
CONNECTOR_ACTION_REQUEST: { requestId, characterId, connectorId, battlemapId, action }
// Historique de cette décision (deux allers-retours, pour ne pas la refaire) :
// (1) v1 : branchait sur `isGm` seul.
// (2) v2 (analyse critique 2026-09-02, en codant l'étape 5) : correction vers `isGm && gmOverride`
//     (champ ajouté) — crainte qu'un PNJ piloté par le MJ (characterId présent) ouvre INSTANTANÉMENT
//     une porte verrouillée sans jet, par analogie avec ENTITY_ACTION_REQUEST qui ne distingue jamais
//     sur isGm pour cette raison précise.
// (3) v3 (retenue) : en câblant le clic réel, vérifié que le VRAI précédent pour un clic MJ sur un
//     objet du monde générique est `ENTITY_ACTION_GM_DIRECT` (`socketEntity.js:396-405`), pas
//     `ENTITY_ACTION_REQUEST` — ce handler est inconditionnel dès `isGm`, aucune notion de Test pour
//     un PNJ n'existe à travers CE clic (les Tests de PNJ passent par les fenêtres de combat dédiées,
//     jamais par un clic générique sur un connecteur). La peur de (2) protégeait un chemin qui
//     n'existe nulle part dans ce projet pour ce type d'interaction. Retour à `isGm` seul, sans champ
//     `gmOverride` — plus simple, fidèle au précédent réel, et évite un bloc UI admin dupliqué (§5).
// connectorId = connector.worldId, JAMAIS la clé d'objet de surface_data.connectors (legacy, ex.
// "door:3") — même identifiant que celui déjà envoyé par handleElevatorCommand (`connector.worldId
// || connector.id`, Canvas3D.jsx) et que le feature_id de world_feature_states (§3). Vérifié en
// codant l'étape 3 (§7) : prepareSurfaceData conserve les clés legacy telles quelles et n'attache le
// worldId déterministe qu'en propriété — un lookup par clé d'objet aurait raté silencieusement tout
// connecteur legacy (couvert par un test dédié, worldSpatialQueryService.test.mjs).
// action ∈ 'open' | 'close' — pas de 3e action 'unlock' (simplifié, analyse à charge 2026-09-01) :
// ouvrir une porte verrouillée EST une tentative de déverrouillage, le serveur le décide seul depuis
// l'état réel, jamais depuis ce que le client croit savoir.
// Le MJ peut en plus envoyer 'lock' (re-sécuriser une porte pendant la partie) — réservé à
// l'override MJ (point 0 ci-dessous), jamais accepté d'un payload joueur.

// Serveur → GM (si Test requis)
CONNECTOR_ACTION_PENDING: { requestId, playerName, characterName, connectorLabel, skillId, defaultDifficulty }
// skillId toujours 'SYSTEMES_DE_SECURITE' (§4/étape 4) — ajouté au payload pour réutiliser
// verbatim le bloc d'affichage Compétence/DC déjà existant côté client (renderEntityAction),
// jamais une présentation inventée pour ce cas.

// GM → serveur
CONNECTOR_ACTION_RESOLVE: { requestId, isApproved, autoSuccess, gmModifier }

// Serveur → joueur (et broadcast WORLD_RUNTIME_UPDATED{ kind:'door-state' } à toute la room)
CONNECTOR_ACTION_RESULT: { requestId, isApproved, reason? }
```

**Branchement serveur** (mirroir exact de `socketEntity.js:64-122`, un problème à la fois — ne pas
sur-généraliser au-delà de la porte pour cette tranche) :

0. **Override MJ** (décision Saar 2026-09-01 : *"le MJ doit toujours pouvoir intervenir"*, cohérent
   avec `PLAN_AOE.md` §5.3 et le précédent réel `ENTITY_ACTION_GM_DIRECT`, voir historique ci-dessus)
   — si `isGm` (contexte socket, jamais un flag du client) : ignore `characterId`, la distance (point 2)
   et la branche Test (point 6) — mirroir exact des boutons admin déjà en place pour l'ascenseur
   (`ElevatorRuntimeControls`, aucun `characterId`/portée requis). `setWorldFeatureState` direct quel
   que soit l'état demandé (`open`/`close`/`lock`), résultat immédiat, même émission
   `WORLD_RUNTIME_UPDATED` (point 7). Le verrou de ligne + version de `setWorldFeatureState` protège
   toujours contre une course avec une écriture joueur concurrente — aucune garantie perdue par le
   bypass. Pour tout le reste de ce contrat (points 1-7), le flux normal s'applique — **c'est le flux
   joueur**, pas le flux MJ.
1. **Validation payload** (mirroir `socketEntity.js:65-67`) : `campaignId`/`requestId`/`characterId`/
   `connectorId` présents, `characterId` appartient à l'émetteur, `connectorId` existe dans
   `surface_data.connectors` de la battlemap et `connector.type === 'door'` — sinon `return` +
   `socket.emit('error', ...)`, jamais un `CONNECTOR_ACTION_RESULT` (erreur de payload, pas un refus de
   règle du jeu).
2. Distance : nouvelle mesure joueur↔connecteur, point→segment (§2), portée par défaut ~1,5 m (mêmes
   valeurs que l'interaction d'entité) — hors portée → `CONNECTOR_ACTION_RESULT { reason: 'out_of_range' }`.
3. État effectif = `world_feature_states[connector.worldId]?.state || connector.state || 'closed'`.
4. **No-op légitime** (`action==='open'` sur porte déjà `open`, `action==='close'` sur porte déjà
   `closed`, ou `action==='close'` sur porte `locked` — une porte verrouillée est par définition
   fermée) : `CONNECTOR_ACTION_RESULT { isApproved: true }` immédiat, aucune écriture — pas une erreur,
   juste rien à faire.
5. **Branche libre** (`action==='open'` sur porte `closed`, ou `action==='close'` sur porte `open`) :
   `setWorldFeatureState` direct, pas de passage MJ, résultat immédiat — même logique que
   `resolveEntityState`/le raccourci "pas de mécanique" de `socketEntity.js:117-122`.
6. **Branche Test** (`action==='open'` sur porte `locked`) : passe par l'arbitration MJ complète (Map
   `pendingConnectorActions`, timeout 60s, jet 1d20 + Systèmes de sécurité vs
   `connector.lockDifficultyDc ?? -5` (fallback malus, décision Saar 2026-09-01, §1/§6), bonus critique
   `polarisTestResolution.js`) — succès → état passe à `open` (pas seulement "déverrouillé" : RAW ne
   distingue pas un état intermédiaire).
7. Toute mutation d'état émet `WORLD_RUNTIME_UPDATED { battlemapId, runtimeRevision, kind: 'door-state' }`
   (jamais `elevator-*`, pour que `useWorldRuntimeSync.js` rafraîchisse `featureStates` sans changement
   côté client).

**Idempotence** : `pendingConnectorActions` nettoyée par `requestId` à la résolution (timeout ou
réponse MJ), identique au patron entité — un double `RESOLVE` sur un `requestId` déjà consommé est un
no-op (`Map.get` renvoie `undefined`).

---

## 5. Client [CIBLE]

- `Canvas3D.jsx:1600-1608` (`handleSurfaceConnectorSelect`) — étendre le garde
  `connector?.type !== 'elevator'` pour accepter aussi `'door'`.
- `Canvas3D.jsx` — nouveau `handleDoorAction(connectorId, action)` : émet `CONNECTOR_ACTION_REQUEST`
  (mirroir de `handleElevatorCommand`, mais socket au lieu de REST — le flux MJ-arbitré est
  intrinsèquement asynchrone bidirectionnel, pas un simple PUT d'état).
- `SurfaceConnectorPanel.jsx` — nouveau `DoorRuntimeControls` (mirroir `ElevatorRuntimeControls:59-108`).
  **Fait, revu 2026-09-02** — pas de bloc admin séparé : les boutons Ouvrir/Fermer sont **partagés**
  joueur/MJ (le serveur les résout différemment selon `isGm`, jamais le client, §4 point 0/historique) ;
  `canAdmin` ajoute uniquement un 3ᵉ bouton Verrouiller, réservé au MJ (RAW : un joueur ne verrouille
  jamais lui-même). Lit `runtimeState` = `worldEffects.featureStates[connector.worldId]` (déjà dans le
  store, §2), le libellé du bouton Ouvrir devient "Crocheter" quand l'état est `locked` (même action,
  juste plus clair).
  - Bloc éditeur existant (`canEdit && type==='door'`, lignes 178-187) : ajouter le champ
    `lockDifficultyDc` (visible seulement si `state === 'locked'`), à côté du `<select>` d'état.
    **Fait.**
- **Précision trouvée en lisant le point d'usage réel (`Canvas3D.jsx:1682-1691`)** : le rendu actuel de
  `<SurfaceConnectorPanel>` calcule `runtimeState={runtimeElevatorStates[...] || null}` — un prop
  dédié à l'ascenseur (état enrichi : phase/arrêt/file, calculé par `worldElevatorService.js`, PAS le
  même objet que `world_feature_states` brut). Pour une porte, `runtimeState` doit venir de
  `worldEffects.featureStates[connector.worldId]` à la place — brancher par `connector.type`, ne pas
  réutiliser `runtimeElevatorStates` pour les deux (ce sont deux calculs différents sur la même table) :
  ```jsx
  runtimeState={
    selectedSurfaceConnector.type === 'elevator'
      ? runtimeElevatorStates[selectedSurfaceConnector.worldId || selectedSurfaceConnector.id] || null
      : selectedSurfaceConnector.type === 'door'
        ? worldEffects.featureStates[selectedSurfaceConnector.worldId] || null
        : null
  }
  ```
- `client/src/lib/useEntitySocket.js` (ou nouveau `useConnectorSocket.js`, à trancher au code — le
  fichier actuel est déjà dense, un fichier dédié est probablement plus propre) — écoute
  `CONNECTOR_ACTION_PENDING`/`RESULT`, mirroir `onEntityActionPending`/`onEntityActionResult`
  (`useEntitySocket.js:37-79`), pousse un message chat `type: 'connector_action', gmOnly: true`.
- `client/src/components/MessageRendererRegistry.jsx` — nouveau rendu pour
  `type === 'connector_action'`, mirroir du rendu `entity_action` (bouton Approuver/Refuser MJ).
- i18n (`.claude/rules/i18n.md`) : toutes les nouvelles chaînes (`surfaceConnectorPanel.doorRuntime.*`,
  labels de résultat) ajoutées à `client/src/locales/` avant usage — jamais de texte en dur.

---

## 6. Cas limites [CIBLE]

- **Double clic concurrent** (deux joueurs ouvrent la même porte en même temps) : couvert par le verrou
  de ligne + version dans `setWorldFeatureState` (transaction `forUpdate`), même garantie que
  l'ascenseur — pas de logique supplémentaire à écrire.
- **Porte verrouillée sans `lockDifficultyDc` renseigné** (MJ a mis `state: 'locked'` sans fixer de
  Difficulté, ancien connecteur créé avant ce chantier) : **fallback `-5`** (malus, décision Saar
  2026-09-01 — différent du cas "Chance" de l'AOE où aucune valeur n'existait nulle part dans le
  schéma ; ici la Difficulté est une donnée normalement autorée mais qui peut manquer par oubli, un
  défaut raisonnable est légitime). Le breakdown du jet affiche ce malus comme n'importe quel autre
  (`socketEntity.js:342`, ligne "Difficulté" déjà générique), jamais silencieux.
- **Personnage mortellement blessé** : même garde que `socketEntity.js:124-134`
  (`isTestBlockingWound`), reprise à l'identique pour la branche Test uniquement (une porte déjà
  ouverte/fermée sans Test reste une action libre, RAW ne la restreint pas).
- **Aucun MJ connecté** : même réponse que l'entité (`reason: 'no_gm'`), branche Test uniquement.
- **Deux joueurs tentent la même porte verrouillée en même temps** (analyse à charge 2026-09-01,
  vérifié) : pas de garde anti-double-soumission par connecteur dans ce plan — et le patron réutilisé
  (`ENTITY_ACTION_REQUEST`) n'en a pas non plus (le seul garde trouvé dans `socketEntity.js:511-514`
  est sur `ENTITY_MOVE_REQUEST`, un handler différent). Deux prompts MJ simultanés pour la même porte
  sont possibles — risque UX déjà accepté ailleurs dans le projet, pas une régression introduite ici,
  **pas corrigé dans cette tranche**.
- **MJ déconnecté pendant qu'une résolution est en attente** : dépend uniquement du timeout 60s
  (`pendingConnectorActions`), aucun nettoyage à la déconnexion — même limite que
  `pendingEntityActions`, héritée telle quelle, pas une régression.

---

## 7. Ordre de construction [CIBLE]

1. `shared/world/surfaceDocument.js` — validation `lockDifficultyDc` (connecteur porte, optionnel,
   nombre fini — négatif accepté, c'est un malus, §1). **Fait, testé (17/17)**, `surfaceDocument.test.mjs`.
2. `shared/events.js` — 4 nouveaux events (`CONNECTOR_ACTION_REQUEST/PENDING/RESOLVE/RESULT`).
   **Fait**, aucune collision de valeur avec l'existant (vérifié).
3. `shared/world/worldMetrics.js` — `distanceToSegmentM` (3D, altitude incluse — pas horizontale,
   corrigé en codant : ignorer l'altitude aurait permis d'interagir à travers un plancher) ; puis
   `worldSpatialQueryService.js` — `loadBattlemapDoorConnector` (lookup par `.worldId`, jamais par
   clé d'objet — legacy, voir §4) + `measureBattlemapTokenConnectorDistance` (même garanties que
   `measureBattlemapTokenEntityDistance` : réconciliation ascenseur, `position_space` vérifié).
   **Fait, testé** (`worldMetrics.test.mjs` 5/5, `worldSpatialQueryService.test.mjs` 3/3, imports réels
   vérifiés).
4. **[OUVERT — décision Saar requise avant de coder cette étape]** Le contrat §4 branche Test
   duplique, s'il est copié tel quel, ~150 lignes de calcul déjà en production dans
   `socketEntity.js` (RESOLVE : total compétence/attribut, malus santé/encombrement, jet + critique,
   breakdown, `DICE_RESULT`, déclenchement Catastrophe — `socketEntity.js:242-390`). Analyse critique
   2026-09-02 : dupliquer violerait l'autorité unique (`AGENTS.md` invariant 3) et reproduirait le
   risque de divergence déjà vécu ailleurs (PC28, dispatch drone). Deux options, détail dans le
   message de session du 2026-09-02 :
   - **A — retenue et faite** (Saar, 2026-09-02 : *"la question n'a pas lieu d'être si tu respectes
     les priorités du projet"*) : `server/src/services/gmArbitratedTestService.js` créé, extraction
     verbatim depuis `socketEntity.js` (diff relu ligne à ligne, `node --check` + import réel sur les
     deux fichiers, -174/+22 lignes). `socketEntity.js` et `socketConnector.js` l'appellent tous les
     deux. **Non testé** : aucun scénario réel (pas de `DATABASE_URL` dans cette session) — la
     non-régression sur une interaction d'entité existante (pas seulement la porte) reste à valider
     par Saar en session réelle.
   - B (non retenue) : dupliquer, consigner la dette — écartée, moins bonne architecture pour un coût
     de rework quasi nul.
5. `server/src/socket/socketConnector.js` — **fait, testé**. Handlers `CONNECTOR_ACTION_REQUEST`/
   `RESOLVE`, matrice de décision extraite en fonction pure testée séparément
   (`shared/world/connectorActions.js`, `resolveDoorActionOutcome`, 2/2). **Deux allers-retours sur
   l'override MJ, voir historique complet §4** : `isGm` seul (v1) → `isGm && gmOverride` (v2, crainte
   d'un PNJ-Test par analogie avec `ENTITY_ACTION_REQUEST`) → retour à `isGm` seul (v3, retenue —
   `ENTITY_ACTION_GM_DIRECT` est le vrai précédent pour un clic générique, toujours inconditionnel).
   Enregistré dans `server/src/socket/index.js` (`registerConnectorHandlers`, `pendingConnectorActions`
   — même patron que `pendingEntityActions`). `node --check` + import réel sur les 3 fichiers touchés
   (`socketConnector.js`, `index.js`, `connectorActions.js`), `connectorActions.test.mjs` 2/2. Requête
   DB redondante corrigée (analyse critique 2026-09-02) : `featureStates` vient désormais du retour de
   `measureBattlemapTokenConnectorDistance` (déjà chargé pour la distance), plus de 2ᵉ appel à
   `loadWorldFeatureStates`.
6. `SurfaceConnectorPanel.jsx` — **fait**. `DoorRuntimeControls` + champ `lockDifficultyDc` côté
   éditeur. i18n ajoutée avant usage (`builder.json` : `surfaceConnectorPanel.lockDifficulty*`,
   `doorRuntimeControls.*`), clé `adminSectionLabel` ajoutée puis retirée dans la même étape (bloc
   admin simplifié, voir §4/§5 historique). `npx eslint` propre.
7. `Canvas3D.jsx` — **fait**. Garde de sélection étendue à `'door'`, `handleDoorAction` (mirroir
   `handleEntityAction` de `SessionPage.jsx` pour la résolution `characterId`, mais défini localement
   ici — `characters`/`user`/`isGm` viennent de stores Zustand déjà accessibles dans `Canvas3D`, pas de
   nouveau prop à faire descendre de `SessionPage.jsx`). **Bug de portée trouvé par le lint, pas
   deviné** : `characters`/`user` existaient déjà dans le fichier mais dans le composant `Scene`
   (ligne 457-458), pas dans `Canvas3D` (ligne 1413) — corrigé en les redestructurant localement
   (`useCharacterStore`/`useAuthStore`, déjà importés). `runtimeState` branché par `connector.type`
   (précision de la session précédente). Baseline eslint identique avant/après (17 problèmes,
   pré-existants, vérifié par diff de comptage) — zéro régression introduite. `npm run build` propre.
8. **Fait.** `client/src/lib/useConnectorSocket.js` (nouveau fichier, `useEntitySocket.js` jugé trop
   dense) — écoute `CONNECTOR_ACTION_PENDING`/`RESULT` + filtre `DICE_RESULT.type==='connector_action'`
   pour lever `pendingConnectorId` (sessionStore, nouveau — mirroir `pendingEntityId`, nécessaire car
   `onCommand` n'est qu'un `socket.emit`, jamais une promesse réseau réellement attendue : un
   `useState` local dans `DoorRuntimeControls` se serait réinitialisé avant la vraie réponse). Enregistré
   dans `SessionPage.jsx` à côté de `useEntitySocket`. `MessageRendererRegistry.jsx` :
   `renderConnectorAction` mirroir quasi verbatim de `renderEntityAction` (même bloc Compétence/DC,
   `skillId` ajouté au payload `CONNECTOR_ACTION_PENDING` pour ça) — fil `onConnectorActionResolve`
   remonté `SessionPage.jsx` → `Sidebar.jsx` → `SidebarChatTab.jsx` → `ctx`, même chemin que
   `onEntityActionResolve`. `npx eslint` propre sur les 6 fichiers touchés (baseline `SessionPage.jsx`
   inchangée, 7 warnings pré-existants vérifiés par diff HEAD), `npm run build` propre.
9. i18n — clés avant usage, fait au fil des étapes 6-8 (pas une passe séparée) : `builder.json`
   (`surfaceConnectorPanel.lockDifficulty*`, `doorRuntimeControls.*`) et `fr.json`
   (`sidebar.connectorPickLockLabel`/`connectorDefaultLabel`, réutilisation de `sidebar.actionPending`/
   `actionOn`/`actionSkill`/`actionDC`/`actionAccept`/`actionAuto`/`actionRefuse` et `session.*` pour
   les raisons de refus — aucune clé dupliquée là où l'existant suffisait).

---

## 8. Plan de tests [CIBLE]

- Validation `surfaceDocument.js` : `lockDifficultyDc` absent sur porte non verrouillée → valide ;
  absent sur porte verrouillée → valide au niveau schéma (le fallback `-5` est une règle serveur au
  moment de l'action, pas une contrainte d'autorat) ; valeur non finie → invalide (négative acceptée,
  c'est un malus).
- Socket, branche Test : `lockDifficultyDc` absent → Seuil calculé avec `-5`, visible dans le
  breakdown envoyé au joueur/MJ (pas un malus caché).
- `setWorldFeatureState`/`doorGeometry` : porte sans ligne runtime → `connector.state` fait foi ; porte
  avec ligne runtime `open` → collision/LOS mise à jour (test déjà existant pour l'ascenseur à
  dupliquer pour une porte).
- Socket : branche libre (open/close) sans MJ connecté → résolution immédiate malgré `no_gm` (pas de
  Test requis, ne doit jamais passer par l'arbitration) ; branche Test avec MJ → jet, DC, bonus
  critique ; timeout 60s sans réponse MJ ; double `CONNECTOR_ACTION_RESOLVE` sur le même `requestId` →
  no-op ; hors portée → refus net.
- Override MJ : `isGm` sur une porte hors de toute portée/sans `characterId` → résolution immédiate,
  pas de passage par la Map `pendingConnectorActions` ; action `'lock'` refusée si elle vient d'un
  payload non-MJ.
- Scénario réel (session groupée, préférence connue de Saar) : porte `closed` → un PJ l'ouvre sans MJ
  requis ; porte `locked` avec `lockDifficultyDc` → tentative ratée puis réussie (MJ approuve, jet),
  LOS/collision qui changent bien en temps réel des deux côtés (2 clients) ; MJ verrouille une porte
  déjà ouverte via le bouton Verrouiller (résolution instantanée, sans Test), effet immédiat côté joueur.

---

## 9. Hors scope de cette tranche [CIBLE]

- Échelle (voir bannière de tête) — traversée verticale, `[INCONNU]` si déjà couverte par
  `navigation.js`, à vérifier séparément avant de cadrer quoi que ce soit.
- Matériel de crochetage (rossignols/outils électroniques) — RAW l'exige, non modélisé, écart assumé
  (§1), cohérent avec l'absence générale d'inventaire d'outils spécifiques dans le projet. **Analyse à
  charge du 2026-09-01, décision Saar : ne pas ajouter de champ `lockType` (électronique/mécanique)
  par anticipation** — la distinction existe bien en RAW (`REGLECOMPETENCE.md:1093-1101`, même
  Compétence mais outil différent selon le type de serrure) mais serait un champ mort en v1 (aucun
  consommateur), sans économie réelle (clé JSON sans migration, coût identique à l'ajouter plus tard),
  avec un risque de mauvaise forme : `REGLEARMURE.md:693-695` (réparation d'armure sans matériel
  adapté) suggère par analogie que le futur mécanisme serait plutôt un **malus sans l'outil requis
  (3 à 5 points RAW)** qu'un blocage binaire par type — à cadrer pour de vrai le jour où ce chantier
  est ouvert, pas deviné ici.
- Portes actionnées par un mécanisme externe (bouton, levier, panneau de contrôle à distance) — RAW
  possible mais non rencontré dans le contenu actuel, pas de connecteur de ce type authoré à ce jour.
- Verrouillage par un joueur depuis l'intérieur (fermer à clé une porte déjà ouverte) — pas demandé,
  RAW ne le détaille pas pour ce cas précis.

---

## 10. État d'implémentation

**Code complet (2026-09-02), §7 points 1-9 tous faits.** Serveur : validation `lockDifficultyDc`,
4 events socket, `distanceToSegmentM` + mesure joueur↔porte, service d'arbitrage partagé
(`gmArbitratedTestService.js`, réutilisé par `socketEntity.js` et `socketConnector.js`),
`socketConnector.js` (branches libre/no-op/Test/override MJ). Client : `DoorRuntimeControls`
(`SurfaceConnectorPanel.jsx`), câblage `Canvas3D.jsx` (`handleDoorAction`, `runtimeState` par type),
`pendingConnectorId` (sessionStore), `useConnectorSocket.js`, carte MJ (`MessageRendererRegistry.jsx`).
Trois allers-retours de conception documentés en route (override MJ §4, requête DB redondante §7
point 5, portée `characters`/`user` dans `Canvas3D.jsx`) — aucun deviné, tous trouvés en codant/lintant/
testant.

**Testé** : `node --test` 27/27 (`connectorActions`, `worldMetrics`, `surfaceDocument`,
`worldSpatialQueryService`), `node --check` + imports réels sur tous les fichiers serveur touchés,
`npx eslint` propre sur tous les fichiers client touchés (baseline `Canvas3D.jsx`/`SessionPage.jsx`
comparée à HEAD — 17/7 problèmes identiques avant/après, zéro régression), `npm run build` client
propre (×3, une fois par bug ci-dessous).

**Session réelle 2026-09-02 (Saar), 1er passage — 1 bug réel trouvé, corrigé** : le panneau porte
s'ouvrait au clic puis se refermait instantanément au relâchement de la souris.
Cause — `ConnectorSegment.handlePointerDown` (`SurfaceDungeonScene.jsx:1589-1594`) ouvre le panneau sur
**pointerdown**, `event.stopPropagation()` n'empêche jamais le "click" natif suivant sur le `<Canvas>`
DOM (événement séparé, pas le même que le pointerdown R3F) — `handleCanvasClick` refermait donc le
panneau à chaque fois, faute du même garde `justSelectedRef` déjà posé pour la sélection de token
(`Canvas3D.jsx:989`). **Bug partagé avec l'ascenseur** (même `handleSurfaceConnectorSelect` pour les
deux types, jamais un cas propre à la porte) — jamais remarqué avant faute d'un test aussi poussé du
clic connecteur. Corrigé en posant `justSelectedRef.current = true` dans `handleSurfaceConnectorSelect`,
mirroir exact du garde token. Corrige donc aussi un bug latent de l'ascenseur, pas seulement la porte.
`npx eslint`/`npm run build` propres après correction.

Signalé dans la même session : les libellés `doorRuntimeControls.*` s'affichaient en clé brute non
traduite — diagnostiqué comme un cache client (dev server/navigateur n'ayant pas rechargé
`builder.json`), pas un bug de code : structure JSON vérifiée correcte (`JSON.parse` + lecture directe),
clés déjà existantes du même fichier (`surfaceConnectorPanel.stateClosed`) s'affichaient bien dans la
même capture. À reconfirmer après rafraîchissement complet.

**Non testé** : aucun scénario réel (pas de `DATABASE_URL` dans cette session) — ni la porte de bout en
bout (déclarer, portée, Test, résolution, LOS/collision qui changent), ni la non-régression sur une
interaction d'entité existante (le refactor du service partagé touche `socketEntity.js`, en
production, sans fichier de test dédié). Les deux à valider par Saar en session réelle — c'est la
prochaine étape naturelle avant de considérer ce chantier clos.
