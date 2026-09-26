# PLAN_EXPORT_CARTE.md — Segment S0 : export / import de carte

> Rédigé 2026-09-26 (Claude, avec les décisions de Saar), recadré en v1 « la carte seule », **réécrit après l'analyse à
> charge** (quatre analyses en lecture seule — sécurité, format et méthode, interface, intégrité serveur — dont les points
> décisifs ont été revérifiés dans le code). **Plan validé par Saar le 2026-09-26** ; le plan exact de chaque lot est présenté et validé avant son code (méthode AGENTS.md).
> Segment S0 du chantier global `docs/PLANS/PLAN_EDITEUR_CARTE.md` (ordre, dépendances, acquis §7 : non recopiés ici).
> Temporaire (Règle 10) : à la clôture, le format passe dans `docs/SYSTEME/EXPORT_CARTE.md` (responsabilité propre :
> le conteneur) et les règles de migration de `surface_data` dans `docs/SYSTEME/SURFACES_SALLES.md`.
>
> Autorité : `.claude/rules/world.md`, `.claude/rules/core.md`, `.claude/rules/i18n.md`, `.claude/rules/react.md`,
> `docs/SYSTEME/SURFACES_SALLES.md` (contrat de sauvegarde), `docs/SYSTEME/EDITEUR.md`.
> `[VÉRIFIÉ]` = lecture du code ou de la base le 2026-09-26 ; `[MESURÉ]` = mesure en mémoire faite par un agent ;
> le reste est une **proposition**.

## 1. Objet et décisions de Saar (2026-09-26)

Exporter une carte dans un fichier et l'importer sur n'importe quelle campagne ou instance. Deux besoins : se protéger
de la perte de la base ; partager une même carte entre campagnes et entre MJ.

**Progression par versions (décision Saar)** :
- **v1 — la carte seule** : sa structure (salles, murs, sols, plafonds, escaliers, échelles, ascenseurs, portes) et ses
  réglages. **Ni objets posés (entités), ni effets, ni jetons.**
- **v2a entités interactives → v2b effets monde → v3 assets** (plans à part, §9).

Décisions valables en v1 :
- **Aucun fichier manipulé à la main**, manifest compris : tout passe par l'interface, le fichier est généré et vérifié
  par la machine (condition de validation de Saar).
- **La carte telle que construite**, pas la partie en cours.
- **Import : toujours une nouvelle carte**, jamais un remplacement ; nom suffixé en cas de collision (`Nom (importée)`,
  puis `Nom (importée 2)`… — interprétation de « suffixé pour éviter les erreurs », à corriger si Saar veut un suffixe
  systématique).
- **Aperçu avant import** : récapitulatif à confirmer ; rien n'est écrit avant la confirmation.
- **Fichier d'une version plus récente** : refusé avec un message clair si une fonctionnalité exigée est inconnue ; un
  modèle de porte inconnu n'empêche pas l'import (il est listé dans l'aperçu).
- **Auteur et description** saisis à l'export, affichés à l'aperçu d'import.
- **Interface** : bouton « EXPORTER / IMPORTER » à côté de « MODE JEU » dans la barre latérale, **visible de tout MJ en
  mode édition uniquement**.
- **Cartes 2D hors périmètre** ; textures de pack et objets personnalisés non exportables (refus explicite) ;
  « Dupliquer » reste une action à part (seul le chemin de copie interne est partagé).
- **Extension `.enclumemap`**, nom de fichier = nom de la carte.
- Reportés en v2 : les deux profils (sauvegarde complète / partage sans notes MJ ni objets cachés), le champ `source` des
  effets.

**Limite à afficher dans l'interface** : une sauvegarde v1 protège la structure de la carte, **pas les objets posés**
(« objets, effets et jetons non inclus »), pour ne pas donner un faux sentiment de sécurité.

## 2. Contenu d'un export v1

| Élément | À l'export | À l'import |
|---|---|---|
| Réglages : nom, grille (taille, activation, opacité, décalage X/Y), `scale_label` | oui (liste blanche unique, §5) | nouvelle carte à la racine ; validés |
| `surface_data` : salles, sols, murs, plafonds, escaliers, connecteurs (portes, échelles, ascenseurs) | oui, tel que stocké | migré, validé, `worldId` réattribués, compilé |
| Modèle 3D d'un connecteur intégré | **clé naturelle seule** (`modelBuiltinKey`) | `modelGlbUrl` et `modelBlueprintId` **reconstruits** depuis le catalogue local |
| Auteur, description, date, version d'Enclume | oui (enveloppe) | affichés à l'aperçu |

`[VÉRIFIÉ]` Un connecteur porte `modelBlueprintId` (UUID propre à la base, **écrit mais jamais relu**), `modelBuiltinKey`
(lue au rendu), `modelGlbUrl` (chemin avec suffixe `?v=<date-taille>` propre à l'instance, `builtinModelCatalog.js:113-118`),
`modelGeometry` (**consommée par la physique** : `doorGeometry`, `worldCompiler.js:457-464`, ouverture, découpe, hauteur),
`modelMaterialOverrides`, `modelLabel`, `modelCategory`. Les ascenseurs et échelles génériques portent la valeur
sentinelle `modelBlueprintId: '__generic_elevator__' | '__generic_ladder__'` sans clé ni URL (`SurfaceEditorPanel.jsx`).

**Règles de modèle** :
- Export : pour un connecteur avec `modelBuiltinKey`, l'URL et l'identifiant UUID local sont **retirés** du fichier ; les
  sentinelles `__generic_*` sont conservées ; un modèle ni intégré ni sentinelle (personnalisé) → **refus** de l'export.
- Import : `modelGlbUrl` et `modelBlueprintId` **du fichier sont toujours ignorés**. Clé connue (résolue par
  `entity_blueprints.builtin_key`, non dépréciée) → URL et id locaux. Clé inconnue ou champs `model*` sans clé →
  `modelGlbUrl = null` (le rendu affiche alors la boîte de repli, `DoorConnectorFallback`), connecteur conservé,
  modèle listé à l'aperçu. `modelGeometry` est **conservée** (jamais recalculée : elle a déjà fixé `x0/x1` et la
  collision à la pose) mais **validée** (nombres finis, bornes).
- Raison de sécurité : le client charge aujourd'hui toute URL `http(s)` de `modelGlbUrl` (ticket
  `CONNECTOR-MODEL-URL-ABSOLUTE`) ; un fichier tiers ne doit jamais l'atteindre.

**Refus, à l'export comme à l'import** : toute référence de texture non vide (`collectSurfaceTextureIds`, qui vit déjà
dans `shared/world`) — `voxel_textures.id` est propre à la base (une texture inconnue fait échouer l'insertion, une
texture homonyme serait une autre) ; toute carte `render_mode: '2d'` ; à l'export, une carte dont `voxel_data` est non
vide (ancien format voxel, non exporté). Une carte vide (`surface_data` `{}`) est exportable ; l'aperçu l'indique.

**Jamais exporté** : entités, jetons et statuts, effets, `combat_state`, `player_locations`, `world_feature_states`,
passagers d'ascenseur, révisions, `battlemap_texture_usage` (se reconstruit), identifiants d'instance, `viewport_state`,
`voxel_scale`, `image_url`, `voxel_data`.

`[VÉRIFIÉ]` Rien de propre à l'instance ou à la campagne dans `surface_data` (aucun id d'utilisateur, campagne, entité,
jeton, effet ; seule chaîne UUID hors `worldId` sur la carte réelle : `modelBlueprintId`). `[INCONNU]` la carte réelle ne
contient ni escalier, mur, sol, plafond, arc ni courbe : pour ces collections c'est une lecture de code, pas une
observation — les fixtures de test devront les couvrir.

## 3. Format du fichier

**Un JSON unique enveloppé, sans compression ni archive** (remplace l'archive ZIP proposée d'abord : un ZIP n'apporte rien
sans assets et ajoute des risques réels — JSZip décompresse en mémoire sans plafond, entrées cachées, chemins ;
`[VÉRIFIÉ]` `compressedObject.js:36-38`). Le fichier est lisible pour un diagnostic, mais l'utilisateur n'a jamais à
l'ouvrir. Un futur conteneur ZIP (v3, assets) sera un changement majeur de `formatVersion`, détecté par les premiers
octets du fichier.

```
{ "format": "enclumemap", "formatVersion": 1, "generator": "enclume", "enclumeVersion": "…",
  "surfaceDataVersion": 12, "createdAt": "…", "author": "…", "description": "…",
  "requiredFeatures": [],
  "map": { "settings": { … }, "surface": { … } } }
```

- `formatVersion` : entier unique (enveloppe uniquement) ; `surfaceDataVersion` : version du document, pilote la
  migration ; `requiredFeatures` : chaînes, une fonctionnalité inconnue = refus (mécanisme de glTF).
- **Lecteur tolérant** : un champ inconnu de l'enveloppe est ignoré (avec avertissement), seul un `requiredFeatures` inconnu
  bloque. Les champs `profile`, `assets`, `entities`, `effects` seront **ajoutés** par les versions suivantes, sans rupture.
- **Aucun résumé ni empreinte dans le fichier** : l'aperçu est **recalculé par le serveur** depuis `map` (nombre de salles,
  connecteurs, modèles), jamais lu de l'enveloppe. Un `sha256` ne protégerait pas contre une falsification.
- **Un fichier = une carte.** Auteur et description : longueur bornée, caractères de contrôle refusés.

**Migration de version** : `[VÉRIFIÉ]` aucune chaîne n'existe — `validateSurfaceData` accepte `version` 1..12 et
`normalizeSurfaceDataDocument` réécrit `version: 12` (`surfaceDocument.js:411-414`, `:477-490`). Elle appartient au module qui
porte `SURFACE_DATA_VERSION`, pas au conteneur (pratique Foundry : `migrateData` dans le modèle). Lot L1b : un **point
d'entrée unique** `migrateSurfaceData` (identité en v12 ; version plus récente → refus avec un code traduisible), utilisé par
l'import et par le chargement normal. Les étapes 12→13 viendront de S2. Des **fixtures d'export v12 générées** (sans binaire)
servent de garde pour que S2 continue d'importer les exports v1.

## 4. Parcours

**Export** — `GET /api/battlemaps/:id/export?expectedRevision=…` (MJ de la campagne **propriétaire** de la carte ; carte
inconnue et carte d'une autre campagne → le même refus). `[VÉRIFIÉ]` un seul `SELECT` est déjà atomique (`PUT /surface` remplace
document et révisions en un `UPDATE`) : pas de transaction. `expectedRevision` (`parseExpectedRevision` /
`hasRevisionConflict` existent) garantit que l'export porte l'état que l'éditeur vient d'enregistrer. Nom de fichier :
`filename*=UTF-8''` + repli ASCII assaini (`[HYPOTHÈSE]` un nom hors latin-1 fait lever Node, cf.
`TEXTUREPACKS-IMPORT-ERROR-OBJECT`).

**Vidange de l'éditeur** — `[VÉRIFIÉ]` l'éditeur envoie la surface à **chaque modification** (`Editor3D.jsx:1099-1112` ; les
60 s et le démontage ne sont que des filets) et sa file de sauvegarde ne rejette jamais (le succès se lit sur
`isSurfaceDirty`). L'export doit donc **d'abord** demander à l'éditeur de finir d'enregistrer, puis lire l'état persisté
(jamais l'état du client : invariant 3). Mécanisme : `registerFlush`, une fonction asynchrone enregistrée par l'éditeur
(un compteur de requête ne renvoie ni fin ni échec) ; elle attend la file, relance une sauvegarde si l'état est sale, et
renvoie `{ ok, battlemapId, surfaceRevision }` ou un code d'échec (jamais un message brut). L'export utilise l'id et la
révision renvoyés. Raccourcis Ctrl+Z/Ctrl+Y : vidanger juste avant la requête, pas seulement à l'ouverture.

**Import** — `POST /api/campaigns/:id/battlemaps/import` (montage campagne, `requireRole('gm')` comme la création ; route
statique déclarée avant les routes paramétrées). Un **multer dédié** (mémoire, un fichier, 5 Mo, extension `.enclumemap` —
le type MIME n'est qu'un pré-filtre ; `multerUpload` refuse tout hors image). Une seule fonction `prepareImport` partagée par
les deux passes :
1. **Aperçu** (`dryRun`) et 2. **Confirmation** exécutent la même chaîne : scan itératif (profondeur, nombre de nœuds, clés
   dangereuses, caractères de contrôle dont NUL — PostgreSQL rejette `\u0000` dans un jsonb, `[VÉRIFIÉ]`) → enveloppe et
   `requiredFeatures` → `migrateSurfaceData` → validation stricte (types, bornes, plafonds §6) → refus des textures et de
   `2d` → remappage des modèles → `prepareSurfaceData(…, { battlemapId: nouvel id, reseedWorldIds: true })` →
   `compileSurfaceWorld` (**avant** la transaction ; une erreur de compilation est convertie en refus 400 avec code :
   `[VÉRIFIÉ]` aujourd'hui elle part en 500). L'aperçu renvoie le résumé recalculé, les modèles inconnus, le nom final
   prévisible (il peut différer du nom réel) et l'**empreinte sha256** du fichier reçu.
3. La confirmation renvoie le même fichier avec `expectedSha256` (comparée) puis, dans **une transaction** : lecture des noms de la
   campagne (suffixe choisi côté application, pas de `LIKE`), insertion (`insertBattlemapFromSurface`, §7),
   `syncBattlemapTextureUsage`. Révisions : valeurs par défaut 0 ; le snapshot déjà compilé est mis en cache
   (`cacheBattlemapWorldSnapshot`, optimisation, id neuf donc aucune entrée périmée). `[VÉRIFIÉ]` aucune unicité de nom en
   base (clé primaire et 3 clés étrangères seulement) : le suffixe est cosmétique. Aucun événement socket n'est émis
   (création et duplication non plus : les autres fenêtres MJ ne voient la carte qu'après rechargement, limite existante).
   Réponse : la ligne « liste » de la carte (sans `surface_data`) + le rapport (modèles inconnus, nom final).
- **Limiteur de fréquence** par utilisateur (~10 par heure, aperçu compris : il décompresse, valide et compile) ; plafond
  de cartes par campagne : non prévu (décision produit non prise).

**Erreurs traduisibles** — `[VÉRIFIÉ]` `AppError` ne porte qu'une `i18nKey`, `errorHandler` renvoie
`error: { status, message, i18nKey? }` : aucun `params`. Extension rétrocompatible d'`AppError` et d'`errorHandler`
(`params` optionnel) — petit changement transverse, à annoncer. Le serveur n'émet jamais de texte FR destiné à l'utilisateur.

**Interface** :
- Bouton dans `Sidebar.jsx`, rangée d'outils, juste après « MODE JEU » : `isGm && mode === 'edit' && !renderMode2D`
  (`[VÉRIFIÉ]` `mode` reste `'edit'` ~300 ms quand on charge une carte 2D depuis l'éditeur, `SessionPage.jsx:119-141`).
  Une seule prop `onOpenMapTransfer`, patron de l'encyclopédie ; libellé par `t()`.
- Fenêtre modale `MapTransferWindow` (`client/src/components/mapTransfer/`) montée dans `SessionPage`, deux onglets.
  Export : auteur, description, rappel « objets, effets et jetons non inclus », bouton (désactivé sans carte ou sans éditeur
  monté). Import : choix du fichier, carte d'aperçu, Confirmer / Annuler, puis « Ouvrir la carte » = **ouverture locale du MJ**
  (comme le sélecteur ; jamais le déplacement du groupe, qui persiste `current_battlemap_id`). Import à la racine.
- Logique réseau dans un hook `useMapTransfer` (téléchargement en `blob`, **lecture d'un corps d'erreur JSON sous `blob`**,
  aperçu, confirmation, traduction des codes en clés) ; namespace i18n dédié `mapTransfer` ; jamais de `err.message` brut.
- Ne pas copier le précédent des packs de textures (`TexturePacksPage.jsx` rend l'objet d'erreur comme un texte).

## 5. Réglages de carte

Une **constante unique** `BATTLEMAP_SETTINGS_FIELDS` (avec validateurs), utilisée par l'export, l'import et le chemin de copie
partagé avec « Dupliquer » : aujourd'hui la liste des colonnes copiées existe en plusieurs endroits et diverge. Validations :
nom 1..100 sans caractère de contrôle ; `grid_size` entier 8..512 ; `grid_enabled` booléen ; `grid_opacity` 0..1 ;
`grid_offset_x/y` entiers bornés (`[VÉRIFIÉ]` colonnes `integer` : `1.5` fait échouer l'insertion) ; `render_mode` = `'3d'`.
`scale_label` est copiée telle quelle mais **n'est pas une échelle** : `[VÉRIFIÉ]` personne ne la lit, l'autorité du moteur est
`surface_data.metersPerCell` (jamais persisté par l'éditeur, qui le supprime) — ticket `MAP-SCALE-NO-AUTHORITY`. L'export ne crée
pas de seconde autorité ; `metersPerCell`, s'il existe, voyage avec `surface_data`.

## 6. Sécurité et plafonds (fichier tiers = entrée hostile)

Aucun contenu du fichier n'est cru. Ce que le validateur actuel **ne garantit pas** (`[VÉRIFIÉ]`) : il n'a aucun plafond, accepte
`null`/`""`/`true` dans un champ numérique, ne plafonne pas ses erreurs, ne contrôle pas les champs `model*`.
Prévu, dans le cœur pur (L1a) :
- Scan itératif **avant** toute validation récursive (`cloneValue` et `deepFreeze` sont récursifs) : profondeur ≤ 32, nœuds
  ≤ 1 000 000, chaîne ≤ 4 096 (noms ≤ 100), clé ≤ 128 ; clés `__proto__`, `constructor`, `prototype` refusées.
- Types **stricts** (`typeof number`) pour l'import ; erreurs renvoyées ≤ 20.
- Plafonds structurels : salles, cases, murs, connecteurs, points par anneau, tranches, coordonnées, **regroupés dans un module
  unique de constantes (`MAP_LIMITS`), documenté et modifiable** (décision Saar : « modifiable à terme, faire des tests de
  performance, débuter petit »). **Départ v1 (décision Saar, 2026-09-26, après mesure) : étendue maximale 30×30 cases et surface totale ≤ 900 cases** (toutes salles et tous
  niveaux), à affiner par le banc d'essai de L1a.
  `[MESURÉ, reproduit par Claude le 2026-09-26]` `compileSurfaceWorld`, synchrone, pour **une** salle carrée : 10×10 = 66 ms,
  20×20 = 270 ms, 30×30 = 1,1 s, 40×40 = 3,1 s, **50×50 = 6,6 s** (croissance plus rapide que la surface). Même à 50×50, un import
  gèle donc le serveur ~7 s (**~14 s** pour une salle décrite par ses cases comme l'éditeur la produit : `tools/bench-compile.mjs`, L1a-1, mesure reproduite deux fois) ; les mêmes coûts s'appliquent à chaque `PUT /surface` de l'éditeur (ticket
  `WORLD-COMPILE-SUPERLINEAR`). Le banc d'essai (script hors `npm test`) fixe les valeurs et tranche entre plafonds seuls et
  compilation d'essai dans un `worker_thread` avec délai. Les chiffres 5 Mo / 500 salles / 250 000 cases de l'analyse sécurité sont
  **écartés** (bien trop généreux au vu de la mesure).
- **Politique des clés inconnues dans `surface_data`** : `[VÉRIFIÉ]` le validateur ne les rejette pas et elles arrivent jusqu'en
  base et aux clients. Liste blanche à énumérer depuis l'éditeur (garde : la carte réelle et les fixtures ne doivent pas être
  rejetées), sinon rejet des clés de premier niveau inconnues plus plafonds. À trancher en L1a.
- Aucun texte du fichier n'est rendu comme HTML (`[VÉRIFIÉ]` aucun `dangerouslySetInnerHTML` lié à la carte) ; noms, auteur et
  description bornés et nettoyés (pas de contrôle ni de caractères bidirectionnels).
- Tickets pour les défauts existants que l'import rend exploitables : `CONNECTOR-MODEL-URL-ABSOLUTE`, `SURFACE-DOC-NO-BOUNDS`,
  `ASSETS-ROUTE-NO-AUTH`.

## 7. Chemin de copie partagé avec « Dupliquer »

`[VÉRIFIÉ]` Aucun test ne protège `duplicate` ni `reseedWorldIds` ; `duplicate` ne copie ni `render_mode`, `grid_offset_x/y`,
`voxel_scale`, `viewport_state`, `image_url` (ticket `BATTLEMAP-DUPLICATE-INCOMPLETE`), ne convertit pas `SurfaceDocumentError`
en 400. Ne pas y toucher recréerait le défaut du ticket (deux listes de champs divergentes) ; y toucher sans test est risqué.
Décision proposée : dans `battlemapWorldPersistence.js` (déjà l'hôte de `syncBattlemapTextureUsage`), une fonction
`insertBattlemapFromSurface(trx, { id, campaignId, settings, surfaceData })` (INSERT d'une liste blanche puis synchronisation de
l'usage des textures) ; l'appelant génère l'id avant (le reseed en dépend). **D'abord un test avec base sur cette fonction, ensuite**
« Dupliquer » en devient un appelant qui conserve **exactement** sa liste de champs actuelle (aucune correction glissée) ; corriger
le ticket ne sera plus qu'une modification de liste, validée à part. Les routes ne sont pas unifiées.

## 8. Tests et validation

- **Purs** (`node --test`, sans base) : enveloppe, `requiredFeatures`, migration (identité v12, refus des versions futures),
  règles de modèle (clé connue, inconnue, sentinelle, sans clé, modèle personnalisé), refus des textures et de `2d`, plafonds,
  scan itératif, clés dangereuses, types stricts.
- **Fixtures** : module `shared/world/testFixtures.mjs` (nom sans `.test.mjs`, constructeurs purs, aucun binaire commité) ;
  `[VÉRIFIÉ]` les fixtures existantes sont privées à chaque fichier de test. Cas : carte vide, multi-niveaux, salle arrondie,
  profil vertical, salles fusionnées avec découpes, porte sur arc, ascenseur, échelle, passerelle, mur ouvert. Les formes
  produites par les opérations d'édition client se fabriquent dans un test côté `client/src/lib/` (qui peut importer `shared/`).
- **Fixtures hostiles** générées en mémoire : entrées absurdes (JSON profond, bornes énormes, NUL, `__proto__`, URL de modèle,
  clés inconnues, noms piégés, millions d'erreurs, taille excessive), jamais commitées en binaire.
- **Aller-retour** : `stripWorldIds(exporté)` égal à `stripWorldIds(importé)` — suppression de la seule clé `worldId` des 6
  collections ; clés legacy (`rooms['room:…']`), `boundaryArcs[].id`, `curveId`, `geometryClipRoomIds` restent **identiques**
  (`[VÉRIFIÉ]` `withWorldIds` ne réattribue que `worldId` ; `[VÉRIFIÉ, exécuté en mémoire]` égalité obtenue sur la carte réelle).
  Champs remappés (`modelGlbUrl`, `modelBlueprintId`) exclus ou comparés à part ; comparer l'export à
  `prepareSurfaceData(source, { reseedWorldIds: false })`, pas à la source brute.
- **Snapshot compilé** : `[VÉRIFIÉ]` les ids du snapshot dérivent aussi de `battlemapId` et l'ordre change (tri par id) : une
  correspondance ancien→nouveau des `worldId` **échoue**. Comparer un snapshot canonique (UUID et `battlemapId` masqués,
  tableaux spatiaux triés : supports, barrières, colliders, occluders, traversées, compartiments, métriques — identiques sur
  la carte réelle) et des **sondes de comportement** (chemin, LOS, support en un point, état d'une barrière de porte).
  Garde : aucune chaîne UUID hors `worldId` dans le document importé.
- **Avec base** (chemins explicites, lancés par l'agent) : non-MJ et MJ d'une autre campagne refusés, carte inconnue = carte
  d'une autre campagne (même réponse), `expectedSha256` différent refusé, échec de compilation → aucune ligne insérée, collision
  de nom, aller-retour complet, non-régression de « Dupliquer ».
- **Client** : lint et build ; validation visuelle de Saar (export, aperçu, import, ouverture).
- **Clôture de chaque lot** : *Testé / Non testé / Données / Retour arrière*. Données : **aucune migration de base**.
  Retour arrière : export = lecture seule ; import = suppression de la carte créée.

## 9. Lots (un à la fois, chacun validé avant le suivant — **ordre d'exécution : voir `PLAN_EDITEUR_CARTE.md` §2.2**)

- **L0 — serveur, prérequis** : `BATTLEMAP_SETTINGS_FIELDS` et `insertBattlemapFromSurface` + test avec base + « Dupliquer » comme
  appelant (comportement inchangé) ; `AppError` / `errorHandler` avec `params` optionnel.
- **L1a — cœur pur** (`shared/`, sans dépendance nouvelle ; `[VÉRIFIÉ]` `shared/world` importe déjà `polygon-clipping`, dépendance
  de la racine) : banc d'essai de compilation → plafonds ; enveloppe, validation stricte, scan, règles de modèle (résolveur
  injecté), refus, aperçu recalculé ; fixtures ; tests purs.
- **L1b — migration** : point d'entrée `migrateSurfaceData` dans `surfaceDocument.js` ; tests ; fixtures d'export v12.
- **L2 — export serveur** : route, refus, nom de fichier, `expectedRevision` ; tests avec base.
- **L3 — import serveur** : `prepareImport`, multer dédié, limiteur, deux passes, transaction, rapport ; tests avec base.
- **L4a** — `registerFlush` dans l'éditeur ; **L4b** — `useMapTransfer` + namespace `mapTransfer` ; **L4c** — fenêtre, bouton,
  branchement `SessionPage` ; validation de Saar.
- **L5 — clôture** : `docs/SYSTEME/EXPORT_CARTE.md`, migration dans `SURFACES_SALLES.md`, `LOCALISATION.md` §2.1, ROADMAP,
  JOURNAL8, CHANGELOG.

**Sortis de S0 (tickets)** : correction de la liste de champs de « Dupliquer » (après L0), collecteur d'ids de textures côté client
(`SURFACE-TEXTURE-COLLECTORS-DIVERGE` : le collecteur serveur suffit à l'export), défauts existants trouvés (§6).

## 10. Versions suivantes (différées, un plan chacune)

- **v2a — entités interactives** : service partagé de création d'entité (`[VÉRIFIÉ]` la logique vit inline dans `routes/entities.js`,
  avec ancrage mural et occupation), références par `builtin_key`, ancrage mural : `[VÉRIFIÉ]` `state.placement.wallId` dérive des **coordonnées** du panneau de mur (`room-wall:x:…`), il survit donc à l'import ; S2 devra le migrer (`PLAN_EDITEUR_CARTE.md` §2.4), **deux profils** (complète / partage sans
  notes MJ ni objets cachés).
- **v2b — effets monde** : tout effet de la carte inclus ; cibles remappées (compartiments = `worldId`, entités) ; définitions
  personnalisées emportées (réutilisées si identiques, sinon renommées et signalées) ; `source` vidé au partage ; le serveur ne
  contrôle pas `source` (`[VÉRIFIÉ]`).
- **v3 — assets** : textures de pack, objets personnalisés, image de fond 2D : nouveau conteneur (`formatVersion` majeur).

## 11. Décisions de fin de cadrage (Saar, 2026-09-26) et questions restantes

- **Format : JSON unique** (§3) — validé.
- **Plafonds** : modifiables à terme, tests de performance ; **départ v1 abaissé à 30×30** (§6, mesure L1a-1 : une salle 50×50 gèle le serveur ~14 s) — validé.
- **Ancien format voxel : l'export d'une carte qui contient encore des voxels est refusé** ; et, plus généralement, **tout ce
  qui subsiste du voxel doit disparaître** (décision Saar) : chantier séparé, `PLAN_PURGE_VOXEL.md` (stub). S0 n'en dépend pas ;
  quand le voxel aura disparu, les règles de refus ci-dessus (`voxel_data` non vide, `voxel_data` dans la liste « jamais
  exporté », colonnes de `duplicate`) disparaissent avec lui.
- **Ordre confirmé (Saar, 2026-09-26) : S0 d'abord ; le plan est validé.** La purge du voxel vient plus tard, avec ses propres garde-fous (voir `PLAN_PURGE_VOXEL.md` §0).

Techniques (décidées par Claude, à contester si besoin) : politique des clés inconnues (L1a) ; `worker_thread` ou plafonds
seuls (L1a, par mesure) ; `AppError.params` ; placement documentaire.

## 12. Plan exact de L1a (présenté le 2026-09-26 — à valider avant tout code)

**Constat de lecture (`[VÉRIFIÉ]`)** qui impose l'ordre des contrôles : `validateSurfaceData` appelle déjà `roomBoundaryEdges` et
`selectedRoomBoundaryChain` (`surfaceDocument.js`, contrôles de `openWallEdgeKeys` et `boundaryArcs`), donc des fonctions qui énumèrent
toutes les cases d'une salle. Un document non borné peut donc **bloquer le validateur avant même la compilation**. Les contrôles de
taille doivent s'exécuter **avant** `validateSurfaceData`, en arithmétique pure, sans appeler la géométrie.

L1a est découpé en quatre sous-lots, chacun validé avant le suivant. **Tous ne sont pas certains à 100 %** : la certitude est indiquée.

### L1a-1 — Limites et banc d'essai (certitude : complète) — **FAIT le 2026-09-26, en attente de validation**
**Résultat** : trois fichiers créés, aucun fichier existant modifié. Test pur : 4/4. Banc d'essai (salle carrée N×N décrite par ses
cases, machine de dev) : 10×10 = 74 ms ; 20×20 = 427 ms ; 30×30 = 1,6 s ; 40×40 = 5,8 s ; **50×50 = 14 à 14,5 s** (deux mesures) ; validation
≤ 5 ms ; JSON 19 Ko à 50×50 (les cases seules ; le document réel ajoute des chemins de murs). **Conséquences à décider avec Saar** :
(1) une salle 50×50 gèle le serveur ~14 s — **décision de Saar : départ v1 à 30×30** (~1 à 1,7 s, les mesures varient d'un lancement à l'autre, facteur ~2) ; (2) le plafond de fichier de 2 Mo est
très généreux au regard de 19 Ko ; (3) c'est le temps de compilation, pas la taille, qui borne la carte : piste `worker_thread` / délai, ou
départ plus bas (30×30 = 1,6 s) et relèvement quand la compilation sera améliorée (ticket `WORLD-COMPILE-SUPERLINEAR`).
- **Crée** `shared/world/mapLimits.js` (`MAP_LIMITS`, objet gelé, valeurs de départ ci-dessous), `shared/world/mapLimits.test.mjs`,
  `tools/bench-compile.mjs` (script manuel, hors `npm test`, mesure temps de compilation et taille du document pour des salles N×N
  décrites par leurs cases, comme l'éditeur les produit).
- **Ne modifie aucun fichier existant** et n'est importé par aucun code existant : aucun effet en production.
- **Valeurs de départ (proposition, modifiables, à confirmer par le banc d'essai)** : étendue 30×30 cases ; surface totale 900 cases (**décision Saar, 2026-09-26**) ;
  salles ≤ 100 ; murs ≤ 2 000 ; connecteurs ≤ 200 ; escaliers ≤ 200 ; sols et plafonds ≤ 900 ; points par anneau ≤ 2 000 ; tranches
  verticales ≤ 20 ; |coordonnée| ≤ 200 cases ; fichier ≤ 2 Mo ; profondeur JSON ≤ 32 ; nœuds ≤ 200 000 ; chaîne ≤ 4 096 ; nom ≤ 100 ;
  clé ≤ 128 ; erreurs renvoyées ≤ 20.
- **Tests** : `node --test shared/world/mapLimits.test.mjs` (objet gelé, entiers positifs, cohérence entre valeurs) ; `node --check` ;
  lancement manuel du banc d'essai ; `git diff --check`. **Hors périmètre** : aucune validation, aucun branchement.

### L1a-2 — Garde structurelle avant validation (certitude : forte sur la conception ; les seuils viennent de L1a-1)
- **Crée** `shared/world/importGuard.js` et son test : `scanJsonStructure(value, limits)` (parcours **itératif** : profondeur, nombre de
  nœuds, longueur des chaînes et des clés, clés interdites `__proto__`/`constructor`/`prototype`, caractères de contrôle dont NUL) et
  `checkSurfaceLimits(surface, limits)` (comptes par collection ; par salle : bornes de type nombre, étendue, longueur de `cells`, total
  de cases ; points d'anneau, tranches, |coordonnée|).
- **Erreurs** : objets `{ code, params }` à codes stables (jamais de texte FR, pour la traduction plus tard), plafonnés à `maxErrors`.
- **Invariants** : fonctions pures, aucun import de la géométrie, `validateSurfaceData` **non modifié**.
- **Tests** : fixtures hostiles générées en mémoire (JSON de 100 000 niveaux construit sans récursion, `__proto__`, NUL, salle aux bornes
  ±1e6 sans cases, 5 001 salles, chaîne de 10 Mo…) et carte saine construite à la main ; module de fixtures sans suffixe `.test.mjs`.

### L1a-3 — Types stricts pour un fichier importé (**certitude : NON, exploration d'abord**)
- Problème `[VÉRIFIÉ]` : le validateur accepte `null`, `""`, `true` comme nombre (`Number(x)` fini) et certaines données historiques en
  dépendent peut-être (coordonnées de sols lues dans des clés textuelles). Le durcir dans le validateur de production risque de rejeter
  une carte légitime.
- Pistes : (a) option `strict` passée au validateur ; (b) liste partagée des champs numériques ; (c) contrôle limité aux collections
  modernes. **Choix après** dénombrement des sites d'appel et essai contre la carte réelle : ce sous-lot se re-présentera avant tout code.

### L1a-4 — Enveloppe, réglages, règles de modèle, refus, aperçu (certitude : bonne ; dépend de L1a-2)
- **Crée** `shared/world/mapSettings.js` (`BATTLEMAP_SETTINGS_FIELDS` et leurs validateurs — **source unique**, ensuite consommée aussi
  par L0a et « Dupliquer » : c'est ici, dans `shared/`, et non dans un fichier serveur), `shared/world/mapContainer.js` (`buildEnvelope`,
  `readEnvelope`, `remapConnectorModels(surface, resolver)` avec résolveur **injecté**, refus des textures et des cartes 2D, résumé
  recalculé, assainissement des textes), et leurs tests. Pas d'ajout au barrel `shared/world/index.js` (le client n'en a pas besoin).
- **Invariants** : le fichier ne transporte jamais `modelGlbUrl` ni l'identifiant UUID local ; `modelGeometry` conservée mais validée.

**Ce que L1a ne fait pas** : aucune route, aucune interface, aucune migration de base, aucune modification de « Dupliquer ».
**Clôture de chaque sous-lot** : Testé / Non testé / Données (aucune) / Retour arrière (suppression des fichiers créés).

## Historique

- **2026-09-26** — cadrage rédigé après les analyses A→E et les décisions de Saar ; recadré en v1 « la carte seule » sur
  proposition de Saar.
- **2026-09-26** — analyse à charge (sécurité, format, interface, serveur) : plan réécrit d'un seul tenant (format JSON unique, plafonds
  mesurés, migration à créer, règles de modèle de connecteur, vidange asynchrone, `AppError.params`, chemin de copie partagé testé
  d'abord) ; 10 tickets de défauts et dettes créés au total.
- **2026-09-26** — décisions de fin de cadrage : JSON validé ; plafonds modifiables, départ 50×50, mesure de compilation reproduite (6,6 s) ; refus des cartes à voxels et purge du voxel décidée (plan à part).
- **2026-09-26** — plan exact de L1a présenté (§12), découpé en quatre sous-lots ; L1a-3 (types stricts) jugé non certain, exploration d'abord.
- **2026-09-26** — L1a-1 codé ; mesure : 50×50 = ~14 s ; **départ v1 abaissé à 30×30 sur décision de Saar** (constantes `MAP_LIMITS` : étendue 30, surface 900).
