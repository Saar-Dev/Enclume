# PLAN_PURGE_VOXEL.md — Faire disparaître ce qui subsiste du voxel

> **Cadrage clos — 2026-10-13.** Décision de Saar (2026-09-26, en cadrant l'export de carte) : « tout ce qui subsiste de la version Voxel
> doit disparaître ». Stub initial périmé (disait encore « zéro code » — `ROADMAP.md` l'avait déjà signalé) : le Lot 1 (isolement,
> §7) est clos depuis le 2026-09-30, et le cadrage (§4, §8-§10 ci-dessous) est clos le 2026-10-13, analyse à charge fichier par fichier
> faite (pas par recherche de texte — voir §9). Lien : `docs/PLANS/PLAN_EXPORT_CARTE.md` §11 (S0 n'en dépend pas, et est de toute façon
> EN PAUSE depuis le 2026-09-27 pour une raison sans rapport — aucun conflit d'ordre actuel). Historique du voxel :
> `docs/Old/PLAN_VOXELS.md`, `docs/SYSTEME/VOXELS.md`, `.claude/rules/voxels.md`.
>
> `[VÉRIFIÉ]` = lecture directe du code ou requête en base ; `[HYPOTHÈSE]`/`[INCONNU]` sinon — appliqué strictement à partir du §8
> (incident de méthode du 2026-10-13 : une affirmation de risque non vérifiée avait été écrite comme un fait, voir mémoire
> `feedback_verify_before_asserting`). Le recensement du §2 (2026-09-26, par recherche de texte) ne fait plus foi seul : chaque ligne
> y est retracée à sa condition de déclenchement réelle dans les sections suivantes avant toute décision de suppression.

## 0. Garde-fous non négociables (Saar, 2026-09-26)

Saar a **très peur** de cette purge — c'est pour cela qu'elle n'a jamais été faite — par crainte de perdre des données ou de casser
quelque chose de fonctionnel. Cette crainte fixe la méthode :
- **Aucune donnée n'est supprimée** tant que Saar ne l'a pas demandé explicitement, colonne par colonne. Les colonnes `voxel_*` peuvent
  rester en base, inertes, aussi longtemps qu'il le souhaite : retirer le code et l'interface n'exige pas de toucher aux données.
- **Rien d'irréversible sans sauvegarde vérifiée** (dump de la base et, une fois disponible, export de carte de S0) et sans accord.
- **Étapes réversibles et petites**, chacune validée par Saar avant la suivante ; d'abord ce qui est déjà inerte et prouvé (code qu'aucun
  chemin ne peut plus atteindre), ensuite seulement le reste.
- **Preuve avant suppression** : pour chaque élément retiré, la démonstration écrite qu'aucun flux fonctionnel (surfaces, entités,
  textures, ateliers) ne le lit ; le catalogue de textures (`voxel_textures`) n'est jamais traité comme du voxel sans preuve.
- Un lot de purge ne se mêle jamais à un lot fonctionnel.

## 1. Constat

- **Le voxel n'est plus un mode utilisable** : `docs/SYSTEME/EDITEUR.md` et le ticket `VOXEL-SAVE-INERT1` (statut `new`) établissent que
  plus aucun chemin d'interface ne peut modifier `voxel_data` (la fonction d'édition voxel n'était plus rendue, elle a été supprimée
  comme code mort) ; l'auto-sauvegarde voxel de l'éditeur ne peut plus se déclencher. `.claude/rules/voxels.md` : le voxel ne contraint
  jamais le monde canonique.
- `[VÉRIFIÉ en base]` la seule carte locale n'a pas de `voxel_data` (`null`). `[INCONNU]` l'état des autres instances (jamais Kiwi sans
  demande de Saar) : une suppression de colonne est **irréversible**.

## 2. Ce qui subsiste (recensement à confirmer)

| Zone | Éléments constatés |
|---|---|
| Base | colonnes `battlemaps.voxel_data`, `voxel_revision`, `voxel_scale` ; table `voxel_textures` et `battlemap_texture_usage` (clé étrangère vers `voxel_textures.id`) |
| Serveur | `PUT /api/battlemaps/:id/voxels` (`battlemaps.js` ~l.889-930) ; `voxel_data` copié par « Dupliquer » et pris en compte dans `syncBattlemapTextureUsage` ; `routes/voxel-textures.js`, `lib/voxelTextures.js` |
| Client, rendu | `CulledVoxelScene.jsx` (monté par `Canvas3D.jsx` et `Editor3D.jsx`) ; ~32 occurrences dans `Canvas3D.jsx`, ~48 dans `Editor3D.jsx` (files de sauvegarde voxel, révisions, chargement des textures voxel) |
| Client, ateliers | `Voxel.jsx` (utilisé par `TexturePacksPage.jsx`), `VoxelBuilderTab.jsx` (onglet de `WorkshopPage.jsx`) |
| Docs et règles | `docs/SYSTEME/VOXELS.md`, `.claude/rules/voxels.md`, plans archivés |

## 3. Le piège de vocabulaire (à trancher en premier)

La table et les routes nommées **`voxel_textures`** ne sont pas seulement du voxel : `[VÉRIFIÉ]` `surface_data` référence ses textures par
`voxel_textures.id` (`floorTex`, `ceilingTex`, `wallInteriorTex`…), et `EntityBuilderTab.jsx`, `MaterialGeneratorTab.jsx`,
`TexturePacksPage.jsx` et la palette de l'éditeur de surface s'en servent. C'est le **catalogue de textures de l'application**, nommé
d'après son origine voxel. Supprimer « tout le voxel » ne peut donc pas vouloir dire supprimer ce catalogue : la question est de
**séparer** (a) le format de carte voxel (`voxel_data` et tout ce qui le lit ou l'écrit) et (b) le catalogue de textures, éventuellement
**renommé** (migration de données, à cadrer). `[INCONNU]` ce que fait exactement `VoxelBuilderTab.jsx`.

## 4. Questions pour Saar (au cadrage)

1. Le catalogue de textures (et les packs) est-il **à conserver** — renommé pour perdre le mot « voxel », ou laissé tel quel ?
2. Faut-il supprimer aussi les **colonnes** en base (`voxel_data`, `voxel_revision`, `voxel_scale`), donc une migration destructive et
   irréversible, ou seulement le code et l'interface ?
3. Existe-t-il des cartes à voxels sur d'autres instances (à protéger avant suppression) ?
4. `VoxelBuilderTab` et `Voxel.jsx` : qu'est-ce que tu utilises encore dans l'atelier ?
5. Priorité relative : avant ou après l'export de carte ? Recommandation de Claude : **après** S0 (cadré, besoin de sauvegarde urgent) ;
   la purge retirera ensuite les règles de refus voxel de l'export et une colonne de « Dupliquer ».

## 5. Méthode prévue

Cadrage → analyse à charge (lecture seule) → plan exact (fichiers, invariant, hors-périmètre) → lots séparés : code mort d'abord
(client, route), puis données (migration seulement après sauvegarde vérifiée et ton accord), puis documentation (`VOXELS.md`,
`rules/voxels.md` à supprimer ou archiver, Règle 10). Migrations : `.claude/rules/migrations.md` (nodemon applique une migration dès
l'écriture du fichier ; vérifier `knex_migrations`).

## 6. Système de matériau procédural — répertorié le 2026-09-27 (pas un doublon, un pipeline à deux étages)

Contexte : en réorganisant la sidebar Structure, la grille de textures pré-faites (§2, `voxel_textures`)
et le système « Matière + Motif » (procédural) ont d'abord semblé deux mécaniques concurrentes.
`[VÉRIFIÉ]` lecture de code + requête en base le 2026-09-27 : ce n'est pas le cas — deux étages d'un
même pipeline.

**Étage 1 — moteur procédural, vivant** : `client/src/lib/proceduralMaterials.js` génère en direct
(canvas 2D, par surface) une texture albedo + une normal map, à partir de :
- 4 matières (Acier, Plastique, Bois, Béton), chacune avec son propre bruit procédural (grain du bois,
  mouchetures du béton, brossé de l'acier) ;
- 5 motifs (Aucun, Plaques rivetées, Dalles jointes, Planches, Tôle striée), chacun avec son propre
  relief simulé (fonctions `applyX`/`sampleXHeight` séparées) ;
- Usure : rayures + éclats de peinture (révèle le substrat) + **simulation de rouille dédiée à
  l'acier**, concentrée près des arêtes/rivets ;
- Saleté : accumulation près des bords, traînées de coulure façon ruissellement, mouchetures de
  poussière ;
- **Relief réel** (`realRelief`) : pas un simple normal map cosmétique — `client/src/lib/reliefGeometry.js`
  transforme la hauteur procédurale en vraie géométrie de mesh (déplacement réel, confirmé par grep) ;
- Variation par graine (`seed`/`autoVariants`) : chaque surface obtient une variante reproductible,
  jamais un copier-coller visuel identique.

Exposé aujourd'hui via `SurfaceMaterialEditor.jsx` (composant partagé, utilisé par
`SurfaceRoomPanel.jsx`/`SurfaceWallPanel.jsx`) ET, en double, ré-implémenté à la main dans
`SurfaceEditorPanel.jsx` (mode Salle) — mêmes six champs, code dupliqué, non signalé au moment de la
refonte de la sidebar (Structure/Objets 3D/Zones dangereuses) — à corriger un jour, hors périmètre de
cette session-ci.

**Étage 2 — le catalogue (`voxel_textures`, §2/§3), un four de cuisson optionnel** :
`MaterialGeneratorTab.jsx` (atelier, onglet « Générateur de matériau ») appelle **la même fonction**
(`generateProceduralMaterialTexture`), prévisualise, puis **cuit** le résultat (PNG albedo + PNG
normal) et l'enregistre via `POST /voxel-textures/from-paths`. `[VÉRIFIÉ en base]` `voxel_textures`
contient 0 ligne localement (2026-09-27) — la grille de textures pré-faites de l'éditeur de surface
n'est donc jamais vide par bug : elle est vide parce que ce four n'a encore jamais servi.

**Conclusion pour ce chantier** : pas un doublon à trancher (garder l'un, jeter l'autre) — un moteur
vivant (édition par surface, toujours à jour) et un four de cuisson optionnel (fige un résultat en
texture réutilisable ailleurs, catalogue partagé avec `EntityBuilderTab.jsx`/`TexturePacksPage.jsx`).
Décision de Saar (2026-09-27) : garder l'option de peupler `voxel_textures` via l'atelier **sous le
coude** — répertorié ici, **rien à coder ni migrer maintenant**.

**Lien avec `PLAN_DECALS.md`** : plan distinct, cadré (stratégie de rendu tranchée le 2026-09-16 : quad
simple sur mur plan, `THREE.DecalGeometry` sur mur courbe/profilé) mais **non implémenté (0 code)**.
Une décoration murale (câble, panneau, affiche) y est un **objet ponctuel positionné sur le mur**,
indépendant du matériau de base — les deux systèmes coexistent sur le même mur, ne se recouvrent pas
(ambiguïté déjà tranchée dans `docs/VOCABULARY.md`, citée en tête de ce plan). Sa section « Documentation
dont j'ai besoin » liste le système de matériaux comme prérequis non lu — ce §6 y répond désormais.

## 7. Lot 1 — isolement (pas suppression) du code voxel côté client, `Editor3D.jsx` uniquement (2026-09-30)

Premier code écrit sur ce plan depuis sa création. Déclenché par la surprise de Saar en apprenant, en
plein chantier `PLAN_WORLD_BUILDER_REWORK.md` §16 (décomposition d'`Editor3D.jsx`), qu'il restait du
voxel dans l'éditeur — recherche faite avant toute décision (`Agent` en lecture seule, rapport complet
transmis à Saar), confirmant le constat du §1 sans rien de nouveau. Stratégie explicite de Saar : **isoler
avant de supprimer** — « au pire si erreur, il n'est pas supprimé ; au mieux, tout fonctionne et il ne
reste qu'à supprimer le dossier ». Conforme à la méthode du §5 (« code mort d'abord, côté client ») et au
garde-fou du §0 (« d'abord ce qui est déjà inerte et prouvé »).

**Fait** : nouveau dossier `client/src/legacyVoxel/`, nommé explicitement pour signaler un candidat à
suppression (pas une convention d'architecture à garder). `useLegacyVoxelState.js` — état `voxels`,
chargement depuis `battlemap.voxel_data`, `voxelsRef`, et la sauvegarde `isDirty`/`voxelSaveQueueRef`/
`voxelSaveRevisionRef`/la fonction fire-and-forget — confirmée morte au §1 (ticket `VOXEL-SAVE-INERT1`,
`isDirty` jamais mis à `true`). Relocalisation strictement à l'identique, aucune ligne de logique changée
(vérifié par lecture avant/après) ; seuls deux points corrigés pour l'outillage : un `eslint-disable`
justifié (`react-hooks/set-state-in-effect`, règle qui cible spécifiquement les fichiers `useXxx.js`,
déjà rencontrée au §16.10 de `PLAN_WORLD_BUILDER_REWORK.md`) et l'ajout de `voxelsRef` aux dépendances de
2 `useEffect` dans `Editor3D.jsx` (une ref est stable par nature, ajout sans effet de bord, juste pour
que `eslint` ne signale plus une dépendance manquante apparue en sortant la ref de son hook).
`Editor3D.jsx` : 1418 → 1348 lignes (`wc -l`). `eslint`/`build` propres.

**Explicitement PAS fait, hors périmètre de ce lot** (cohérent avec « lots séparés, chacun petit ») :
- `Canvas3D.jsx` (rendu joueur, ~32 occurrences recensées au §2) — zone différente, plus sensible
  (visible par les joueurs, pas seulement le MJ en édition), son propre lot le jour venu.
- La logique de repli voxel dans `EntityEditorScene` (`calcEntityPos`/`columnTops`/`raycastVoxels`,
  toujours dans `Editor3D.jsx`) — celle-ci reste **fonctionnellement active** (pose d'entité sur un
  battlemap sans `surface_data`), pas confirmée morte comme la sauvegarde ; l'isoler mélangerait du code
  mort et du code vivant dans le même lot. Toujours lue depuis `Editor3D.jsx`, comportement inchangé.
- `Voxel.jsx`/`VoxelBuilderTab.jsx` (ateliers), routes serveur, colonnes base — questions ouvertes du §4,
  pas concernées par un lot purement client.

**Reste à tester par Saar** : édition Salle/Mur/Connecteur/Zones dangereuses en session (ce lot ne
change que l'endroit où vit du code déjà mort ou déjà lu à l'identique — aucun comportement visible
attendu, mais un test reste dû comme pour tout le reste de ce chantier).

## 8. Réponses de Saar au §4 (2026-10-13)

1. Catalogue (`voxel_textures`) : **gardé, renommé** (inopérant comme mode voxel, mais réellement utilisé par
   `surface_data` et son atelier — confirmé §9, pas du code mort).
2. Colonnes base (`voxel_data`/`voxel_revision`/`voxel_scale`) : **migration destructive prévue**, pas un maintien
   indéfini — reste soumise au garde-fou §0 (sauvegarde vérifiée + accord avant exécution).
3. Aucune carte à voxels n'existe sur aucune instance — le `[INCONNU]` du §1 est levé.
4. Vérifié en détail au §9 : `VoxelBuilderTab.jsx`/`Voxel.jsx` ne sont pas morts.
5. L'export de carte ne concerne pas des cartes à voxels (il n'en existe plus) ; le lien avec ce plan n'est que du
   code de garde référençant les colonnes voxel (refus si `voxel_data` non vide, etc.), qui deviendra lui-même mort
   une fois les colonnes supprimées — pas une dépendance qui bloque l'ordre des lots. `PLAN_EXPORT_CARTE.md` est de
   toute façon EN PAUSE (raison sans rapport, stabilisation de la forme des salles) : aucun conflit aujourd'hui.

## 9. Analyse à charge — condition réelle de déclenchement, pas le nom (2026-10-13)

Méthode appliquée après une dérive repérée par Saar en séance : classer par recherche du mot « voxel » (ce que fait
le §2) confond deux choses très différentes — un symbole qui s'appelle voxel, et un mécanisme réellement mort.
Chaque ligne ci-dessous est retracée à sa condition de déclenchement réelle, par lecture directe, avant toute
décision. Trois catégories en sont sorties, pas une liste unique « à retirer ».

### Catégorie A — inatteignable (zéro appelant, pas seulement donnée vide)

- `[VÉRIFIÉ]` `isDirty.current` ([useLegacyVoxelState.js:16-90](../../client/src/legacyVoxel/useLegacyVoxelState.js))
  n'est jamais mis à `true` nulle part dans `client/src` (recherche globale faite) — confirmé par le ticket déjà
  ouvert `VOXEL-SAVE-INERT1` (2026-08-26, statut `new`), pas une découverte de cette session. `saveVoxelsFireAndForget`
  fait donc toujours un early-return avant son `fetch`.
- `[VÉRIFIÉ]` Conséquence : `PUT /battlemaps/:id/voxels` ([battlemaps.js:935-981](../../server/src/routes/battlemaps.js))
  n'a plus aucun appelant client (recherche confirmée : un seul `fetch(.../voxels)` dans tout le client, celui
  ci-dessus, mort).
- `[VÉRIFIÉ]` `voxel_scale` : un seul site de lecture en production, [battlemaps.js:1130](../../server/src/routes/battlemaps.js)
  (`/duplicate`, simple copie de colonne, aucun calcul). Tout calcul de distance qui aurait dû le consommer est
  hardcodé à `1.0` (`CombatModifiersWindow.jsx:241`, commentaire « voxel_scale = 1.0 (PC35) ») — l'UI GM qui devait
  le rendre réglable (« Sprint ScaleMap ») n'a jamais été construite (`docs/Old/PLAN_11_SYSCOMBAT.md`). Colonne
  jamais consommée pour une vraie valeur.

### Catégorie B — atteignable, mais toujours sur donnée vide (prouvé par lecture, pas supposé)

- `[VÉRIFIÉ]` [Editor3D.jsx:236-249](../../client/src/components/Editor3D.jsx) : `raycastVoxels` reçoit
  `(x,y,z) => !!voxels[...]`, toujours `false` sur `voxels = {}` → cette branche n'est jamais prise ; le fallback
  qui s'exécute réellement est l'intersection avec le plan Y=0 (lignes 251-258), sans rapport avec le voxel.
- `[VÉRIFIÉ]` `columnTops` ([Editor3D.jsx:148-156](../../client/src/components/Editor3D.jsx)), calculé depuis
  `voxels` toujours `{}` → ses deux lectures (ligne 248 et ligne 398-399) valent toujours leur repli par défaut.
- `[VÉRIFIÉ]` [Editor3D.jsx:692-704](../../client/src/components/Editor3D.jsx) et
  [Canvas3D.jsx:1517-1533](../../client/src/components/Canvas3D.jsx) : la branche `else` de `hasSurfaceContent(surfaceData)`
  — exercée sur **toute carte 3D neuve** (`surface_data` non écrit à la création, [battlemaps.js:212-238](../../server/src/routes/battlemaps.js),
  confirmé en base, 1 carte locale, `surface_data` non vide) — rend `<CulledVoxelScene>` (MJ) / `<DungeonTerrainScene>`
  (joueur, `USE_DIORAMA_TERRAIN = true` codé en dur ligne 49 → `<CulledVoxelScene>` côté joueur est en fait
  **statiquement mort**, jamais pris). Les deux composants réellement atteints prennent `voxels` toujours `{}` →
  rendent une scène sans géométrie. Le `<Grid>` ([Canvas3D.jsx:1509-1515](../../client/src/components/Canvas3D.jsx))
  est rendu AVANT cette branche, inconditionnellement — repère visuel déjà garanti sans le moteur voxel.

### Catégorie C — vivant, à garder et renommer, jamais à purger

- `[VÉRIFIÉ]` `VoxelBuilderTab.jsx` est l'éditeur actif du catalogue (`POST /voxel-textures/from-paths`,
  `PUT /voxel-textures/:id`), rendu dans l'Atelier ([WorkshopPage.jsx:244](../../client/src/pages/WorkshopPage.jsx)).
- `[VÉRIFIÉ]` `Voxel.jsx` est **partagé** : aperçu catalogue (`VoxelBuilderTab`, à garder) ET rendu de carte voxel
  (`CulledVoxelScene`, mort) — ne jamais le supprimer en bloc, seulement son usage côté catégorie B.
- `[VÉRIFIÉ]` `syncBattlemapTextureUsage`/`collectBattlemapTextureIds` ([battlemapWorldPersistence.js:15-37](../../server/src/services/battlemapWorldPersistence.js))
  sont appelés par les routes `/surface` (ligne 1055) et `/duplicate` (ligne 1136) — vivants, fusionnent les ids
  voxel (toujours vide) et surface (réels). Seul `collectVoxelTextureIds`/le paramètre `voxelData` devient superflu
  une fois la colonne retirée ; la fonction reste.
- `[VÉRIFIÉ]` `routes/voxel-textures.js`/`lib/voxelTextures.js` : aucune occurrence de `voxel_data` dedans
  (recherche faite) — purement catalogue.

## 10bis. Analyse à charge DU PLAN (2026-10-13, demandée par Saar) — 4 trous trouvés et corrigés

Relecture volontairement critique du §10 avant tout code, pas une confirmation de confort.

1. `[VÉRIFIÉ]` `server/src/services/battlemapWorldPersistence.test.mjs` vérifie `voxel_revision` dans
   `BATTLEMAP_DOCUMENT_REVISION_COLUMNS` ET teste `collectBattlemapTextureIds` avec des données voxel
   fictives — les deux tests cassent avec les Lots 2/3 si non mis à jour. Ajouté aux lots concernés.
2. `fast-voxel-raycast` (dépendance npm) n'a plus qu'un seul site d'usage, celui que le Lot 3 retire
   (`Editor3D.jsx`) — à retirer de `client/package.json` dans le même lot, pas laissée orpheline.
3. `[VÉRIFIÉ]` [Canvas3D.jsx:991-1001/1623](../../client/src/components/Canvas3D.jsx) : un deuxième site
   de la catégorie B, raté au §9 — `colTopSurface` (bâti depuis `voxels`, toujours vide) positionne le
   marqueur fantôme de la prévisualisation de déplacement en combat. Sans rapport avec le repli
   « carte sans surface_data » du Lot 3 initial — fonctionnalité différente, même preuve (`?? 0` toujours
   pris). Ajouté au Lot 3.
4. **Le vrai trou, sous-estimé au premier passage : la documentation.** `docs/SYSTEME/VOXELS.md` ne
   décrit pas seulement le format mort — PE14 (conversion base↔Three.js, **toutes** entités/tokens) et
   PE34 (altitude des pieds d'un token, `tokenFeetPoint`) y sont archivés mais s'appliquent à du code qui
   reste vivant. `CONVENTIONS.md` (index-maître P/PE/PC/PI, AGENTS.md §Autorités) renvoie vers `VOXELS.md`
   pour 6 règles (P17/P22/P26/P32/PE14/PE34). `EDITEUR.md` et `MOTEUR_MONDE.md` décrivent en détail le
   pipeline de sauvegarde/révision voxel que les Lots 2-3 retirent. Nouveau Lot documentaire ajouté
   (Lot 6) plutôt qu'une ligne vague dans le Lot 4 — relocaliser avant de supprimer, jamais les deux
   dans le même geste.

## 10. Plan exact de lots (2026-10-13)

Patrons pros appliqués, cherchés avant d'écrire ce plan (pas codé de zéro) :
- **Expand/contract** (Fowler, repris par Prisma/Liquibase) pour les colonnes base : retirer tout code qui lit/écrit
  une colonne, déployer, et seulement ensuite la dropper dans une migration séparée — jamais l'inverse (dropper
  avant que le code ait cessé de l'utiliser est explicitement l'anti-patron cité par ces sources). C'est exactement
  la méthode déjà imposée par le garde-fou §0 de Saar, avant même cette recherche.
- **Strangler fig / dead-code decommission** : pour un code sans aucun appelant (catégorie A), une suppression
  directe est le patron recommandé (pas besoin de routage/flag) ; pour un code atteint mais qui doit changer de
  comportement visible (catégorie B), remplacer par un comportement équivalent vérifié avant/après, jamais couper
  sans remplacement vérifié.

**Lot 1 — isolement, CLOS** (§7, 2026-09-30, commit `3c44b792`).

**Lot 2 — CLOS le 2026-10-14** (confirmation navigateur de Saar, commit `562aa219`).

**Lot 3 — CODÉ le 2026-10-14, ⚠️ clos partiel (validation navigateur de Saar manquante, pas commité).**
Fichiers touchés : `Canvas3D.jsx` (branche `<CulledVoxelScene>` statiquement morte retirée sans filet ;
`<DungeonTerrainScene>` remplacé par un rendu vide explicite — le `<Grid>` déjà rendu avant suffit, prouvé
au §9 ; `colTopSurface`/`getVoxelSurfaceTop` retirés, `y` du marqueur fantôme simplifié en `0.05` direct ;
état `voxels`/init depuis `battlemap.voxel_data` retiré ; fusion `voxelTexIds` dans le chargement de
textures simplifiée en `surfaceTexIds` seul) ; `Editor3D.jsx` (même branche de repli retirée ; `calcEntityPos`
réduit au seul fallback plan Y=0 prouvé actif, `columnTops` et l'import `fast-voxel-raycast` retirés ;
prop `voxels` retirée d'`EntityEditorScene` ; hook `useLegacyVoxelState` plus appelé) ; suppression de
`client/src/legacyVoxel/useLegacyVoxelState.js` (dossier entier, devenu orphelin, conformément à la
prédiction du Lot 1 §7), `CulledVoxelScene.jsx`, `DungeonTerrainScene.jsx`, `buildCulledMesh.js`,
`buildDungeonTerrainMesh.js` (plus aucun appelant, vérifié) ; dépendance npm `fast-voxel-raycast` retirée
(`client/package.json`) ; `battlemapWorldPersistence.js` (`collectVoxelTextureIds` retiré,
`collectBattlemapTextureIds`/`syncBattlemapTextureUsage` n'acceptent plus de `voxelData`) et les 2 appelants
dans `battlemaps.js` (`/surface`, `/duplicate`) mis à jour en conséquence ; test correspondant mis à jour.
Testé : `node --check` propre ; `eslint` ciblé sur `Canvas3D.jsx`/`Editor3D.jsx` — **comparé ligne à ligne
avec la version HEAD d'avant ce lot** (pas une simple lecture du compte total, qui aurait pu induire en
erreur par un décalage de numéros de ligne) : zéro nouvelle erreur/warning introduite, un pré-existant
(`voxelsRef.current = voxels`, catégorie `react-hooks/refs`) authentiquement supprimé ; `node --test
battlemapWorldPersistence.test.mjs` 3/3 vert ; `npm run build` client propre (bundle légèrement plus léger).
Non testé : comportement réel en navigateur — carte neuve sans salles dessinées (MJ et joueur), et la
prévisualisation de déplacement en combat (marqueur fantôme). Aucune régression attendue (code retiré
prouvé sans effet observable, §9), mais dû comme pour tout ce chantier (§0). Hors périmètre, pas touché :
`Voxel.jsx` (catégorie C, partagé avec `VoxelBuilderTab.jsx`).
Fichiers touchés : route `PUT /:id/voxels` retirée (`server/src/routes/battlemaps.js`) ; `voxel_revision`
retiré de `BATTLEMAP_DOCUMENT_REVISION_COLUMNS` (`battlemapWorldPersistence.js` + test correspondant) ;
`saveVoxelsFireAndForget`/`voxelSaveQueueRef`/`voxelSaveRevisionRef`/`isDirty`/`voxelsRef` retirés de
`client/src/legacyVoxel/useLegacyVoxelState.js` (signature simplifiée : `useLegacyVoxelState(battlemap)` →
`{ voxels }` seul) ; `Editor3D.jsx` mis à jour en conséquence (2 effets de sauvegarde ne portent plus que
`saveSurfaceFireAndForget`). Testé : `node --check` (3 fichiers serveur) propre ; `eslint` ciblé (2 fichiers
client) 0 erreur, 0 nouveau warning (les 7 warnings restants sont pré-existants, vérifiés non liés à ce
lot) ; `node --test battlemapWorldPersistence.test.mjs` 3/3 vert ; `npm run build` client propre. Non testé :
comportement réel en navigateur (édition Salle/Mur/Connecteur, auto-save 60s, retour mode jeu) — le code
retiré ne faisait jamais rien d'observable (prouvé au §9), donc aucune régression attendue, mais un test
reste dû comme pour tout ce chantier (§0). Script de clôture écrit (`server/src/scripts/
resolve_ticket_voxel_save_inert1.js`) mais **pas lancé** — règle AGENTS.md : seuls les scripts
`create_tickets_*.js` sont lancés par l'agent, tout autre script qui écrit en base reste à lancer par Saar.
Pas commité (attend confirmation de Saar, §0/méthode de travail). Coordination faite avec la session
« Correction de bug » (ListAgents/SendMessage, 2026-10-14) : aucun chevauchement de fichiers confirmé des
deux côtés avant de coder.

**Lot 2 — pipeline de sauvegarde voxel mort (catégorie A, zéro remplacement nécessaire)**
- Fichiers : route `PUT /:id/voxels` (`server/src/routes/battlemaps.js`) ; `saveVoxelsFireAndForget`/
  `voxelSaveQueueRef`/`voxelSaveRevisionRef`/`isDirty` dans `client/src/legacyVoxel/useLegacyVoxelState.js`.
- Retirer `voxel_revision` de `BATTLEMAP_DOCUMENT_REVISION_COLUMNS` (`battlemapWorldPersistence.js`) et mettre à
  jour l'assertion correspondante dans `battlemapWorldPersistence.test.mjs` (§10bis.1) — la colonne elle-même ne
  disparaît qu'au Lot 5 (expand/contract), mais plus aucun code n'y réfère après ce lot.
- Invariant : après coup, un grep de tout le dépôt sur `/voxels` (route) ne doit plus trouver aucun appelant —
  vérification mécanique, pas une relecture visuelle.
- Hors périmètre : la lecture de `voxel_data` (state `voxels`, catégorie B), les colonnes base, le catalogue.
- Clôture documentaire : ticket `VOXEL-SAVE-INERT1` passe de `new` à résolu, avec le lien vers ce lot.

**Lot 3 — repli de rendu/placement sur donnée vide (catégorie B, remplacement vérifié, pas suppression sèche)**
- `Editor3D.jsx` : remplacer la branche `<CulledVoxelScene voxels={voxels} .../>` par un rendu vide explicite
  (comportement observable identique, prouvé au §9 — la scène ne produit déjà aucune géométrie) ; dans
  `calcEntityPos`, retirer le raycast voxel (lignes 230-249) et ne garder que le fallback plan Y=0, seul
  comportement réellement actif ; retirer `columnTops` si ses deux lectures restantes se simplifient vers leur
  repli par défaut sans lui.
- `Canvas3D.jsx` : retirer la branche `<CulledVoxelScene>` (statiquement morte, `USE_DIORAMA_TERRAIN` toujours
  `true`) sans filet ; remplacer `<DungeonTerrainScene voxels={voxels} .../>` par rien d'explicite (le `<Grid>`
  déjà rendu avant suffit, prouvé au §9) ; retirer l'init `voxels` depuis `battlemap.voxel_data` (lignes
  1961/2070-2079) une fois ses deux consommateurs retirés.
- Retirer en cascade, seulement si plus aucun appelant après coup (à revérifier, pas supposé) :
  `CulledVoxelScene.jsx`, `DungeonTerrainScene.jsx`, `buildCulledMesh.js`, `buildDungeonTerrainMesh.js`.
- `[VÉRIFIÉ, §10bis.3]` `Canvas3D.jsx:991-1001/1623` : `colTopSurface`/`getVoxelSurfaceTop` (positionnement du
  marqueur fantôme de prévisualisation de déplacement en combat — fonctionnalité distincte du repli
  « carte neuve ») — simplifier `colTopSurface[clé] ?? 0` en `0` direct, retirer l'index et `getVoxelSurfaceTop`.
- Retirer la dépendance npm `fast-voxel-raycast` de `client/package.json` une fois son seul site d'usage
  (`Editor3D.jsx`) retiré (§10bis.2).
- Mettre à jour `battlemapWorldPersistence.test.mjs` (§10bis.1) : le test de `collectBattlemapTextureIds` ne doit
  plus fournir de données voxel factices une fois `collectVoxelTextureIds` retiré de la fonction.
- Invariant : rendu d'une carte sans `surface_data` visuellement identique avant/après (grille visible, rien
  d'autre), ET la prévisualisation de déplacement en combat identique (marqueur fantôme à la même hauteur) —
  vérifié par Saar en navigateur, pas seulement `eslint`/build (patron déjà coûteux une fois, mémoire
  `feedback_verify_before_asserting`, épisode du 2026-09-30).
- Hors périmètre : `Voxel.jsx` (catégorie C, ne pas toucher ici).

**Lot 4 — renommage du catalogue (catégorie C, décision d'architecture prise par Claude)**
- Nom retenu : `voxel_textures` → **`surface_textures`** (et `battlemap_texture_usage.voxel_texture_id` →
  `surface_texture_id`). Raison : le nom doit refléter QUI s'en sert (`surface_data`), pas son origine historique ;
  j'écarte `material_textures` pour éviter une collision conceptuelle avec le moteur procédural
  (`proceduralMaterials.js`, « Matière + Motif », chantier parallèle [[project_materiaux_nt_chantier]] en mémoire) —
  deux pipelines déjà distingués au §6, un nom partagé les re-confondrait.
- Fichiers — liste complète, 2ᵉ analyse à charge du 2026-10-13 (la première listait seulement 2 fichiers client
  et 2 serveur, incomplet) : migration renommant table + FK ; `routes/voxel-textures.js` →
  `routes/surface-textures.js` ; `routes/texture-packs.js` (`[VÉRIFIÉ]` ~15 références, dont l'export/import ZIP —
  le `manifest.json` exporté utilise la clé `textures`, jamais `voxel_textures`, donc aucun pack déjà exporté
  n'est affecté) ; `lib/voxelTextures.js` → `lib/surfaceTextures.js` ; client :  `VoxelBuilderTab.jsx` (nom sans
  « voxel »), `Editor3D.jsx`, `Canvas3D.jsx`, `MaterialGeneratorTab.jsx`, `EntityBuilderTab.jsx` ; vérifier les
  clés i18n visibles utilisateur avant clôture (`client/src/locales/*.json`, règle `.claude/rules/i18n.md`).
- `[VÉRIFIÉ]` 2026-10-14, 3ᵉ analyse à charge : `server/src/lib/voxelTextures.js` est un **doublon complet
  et mort** de `server/src/routes/voxel-textures.js` (même CRUD GET/POST/PUT/DELETE, même table) — zéro
  importeur nulle part (`server/src/index.js` ne monte que `routes/voxel-textures.js`). À supprimer dans ce
  lot, pas à renommer (sinon le doublon survit sous un nom à jour, pire qu'avant).
- `[VÉRIFIÉ]` La recherche exhaustive (tout le dépôt, pas juste client/server/src) trouve aussi
  `docs/SYSTEME/CHARACTER.md`, `ENTITES.md`, `ASSETS.md`, `TRADE.md` mentionnant `voxel_textures` — pas vus
  aux 2 passes précédentes. Ajoutés au périmètre du Lot 6 (doc), pas traités ici.
- **Décidé par Claude (délégation explicite de Saar) : renommage complet et cohérent** — base, chemin d'API
  (`/api/voxel-textures` → `/api/surface-textures`), fichiers serveur et client, pas seulement la colonne.

## Lot 4 — CLOS le 2026-10-14 (migration déjà appliquée, détail ci-dessous)

**Incident opérationnel, résolu** : en écrivant la migration 386, `nodemon` (le serveur de Saar tournait
réellement — nécessaire pour ses tests navigateur des Lots 2-3) l'a auto-appliquée immédiatement, avant que
le code consommateur ne soit mis à jour — exactement le piège documenté par `.claude/rules/migrations.md`
(« écrire un fichier sous `server/` auto-applique les migrations en attente »), que j'avais lu mais pas
anticipé pour UNE migration en particulier pendant que je rédigeais le reste du Lot. Fenêtre d'inconsistance
brève (quelques minutes), corrigée en enchaînant immédiatement la mise à jour de tout le code serveur/client
plutôt que de revenir en arrière. **Leçon retenue** : sur ce chantier, considérer TOUTE écriture de fichier
de migration comme une action en production immédiate, pas une étape qu'on peut préparer puis tester à
tête reposée.

**Deuxième ajustement en route** : la séquence `voxel_textures_id_seq` associée à la table ne se renomme pas
automatiquement avec `RENAME TABLE` — ajoutée à la migration 386 par une édition suivante, mais celle-ci
avait déjà été auto-appliquée sans cette ligne (nodemon ne rejoue jamais une migration déjà dans
`knex_migrations`, correctement — rejouer `up()` aurait été l'erreur documentée par le garde-fou des
migrations). Migration 387 séparée créée pour ce seul renommage cosmétique, 386 corrigée pour refléter ce
qui s'est réellement exécuté (pas ce qui était prévu).

**Correction de périmètre, pas une indécision** : en lisant `EntityBuilderTab.jsx` pour la mise à jour des
imports, découverte que `appearance: 'voxel'` (apparence d'entité : bloc texturé vs modèle GLB, avec clés
i18n `builder.appearanceVoxel`/`appearanceGlb` bien vivantes) et `usage_hint: 'voxel'` (déjà vu au Lot 4)
sont un vocabulaire de domaine **retenu et légitime** (« voxel » = forme cubique/bloc), distinct du format de
carte voxel mort. **`VoxelBuilderTab.jsx` n'est donc PAS renommé** — contrairement à ce qui était annoncé
plus haut dans ce document : son nom reste cohérent avec ce vocabulaire retenu. Seuls les imports/chemins
d'API qu'il consomme (fichier lib déplacé, route renommée) sont mis à jour.

**Fichiers touchés** :
- Migrations `386_rename_voxel_textures_to_surface_textures.js` / `387_surface_textures_id_seq_rename.js`.
- `server/src/lib/voxelTextures.js` **supprimé** : doublon complet et mort de `routes/voxel-textures.js`,
  zéro importeur (trouvaille de cette 3ᵉ passe).
- `server/src/routes/voxel-textures.js` → `server/src/routes/surface-textures.js` (contenu : table/colonnes
  renommées, chemins d'API dans les commentaires).
- `server/src/routes/texture-packs.js` : toutes les références à la table renommées (liste, détail, création,
  suppression, export/import ZIP, fichiers).
- `server/src/index.js` : import + montage de route (`/api/surface-textures`).
- `server/src/services/battlemapWorldPersistence.js` : colonne d'insertion renommée.
- Client : `lib/voxelTextures.js` → `lib/surfaceTextures.js` (fonction `loadVoxelTextures` →
  `loadSurfaceTextures`) ; importeurs mis à jour (`Canvas3D.jsx`, `Editor3D.jsx`, `VoxelBuilderTab.jsx` —
  pas renommé, voir plus haut —, `MaterialGeneratorTab.jsx`, `EntityBuilderTab.jsx`).
- `client/src/pages/TexturePacksPage.jsx` **supprimé** : page orpheline confirmée (zéro import nulle part),
  remplacée par `WorkshopPage.jsx` depuis longtemps sans avoir été retirée.
- **Volontairement non touché** : `usage_hint`/`appearance` valeur `'voxel'` (vocabulaire de domaine
  légitime, pas le format de carte) ; toute la documentation (`VOXELS.md`, `CONVENTIONS.md`, etc. — Lot 6,
  séparé).

**Testé** : `node --check` sur tous les fichiers serveur touchés ; `eslint` ciblé sur tous les fichiers
client touchés — comparé ligne à ligne, zéro nouvelle erreur/warning ; `node --test
battlemapWorldPersistence.test.mjs` 3/3 vert ; `npm run build` client propre ; requête directe en base
confirmant le schéma final (table `surface_textures`, colonne `surface_texture_id`, séquence
`surface_textures_id_seq`) cohérent avec le code. Recherche exhaustive finale (tout le dépôt) : zéro
référence vivante restante à `voxel_textures`/`voxel-textures`/`loadVoxelTextures` hors migrations déjà
appliquées (jamais retouchées) et scripts de ticket historiques (jamais réécrits, règle du projet).
**Navigateur non pertinent ici** (information de Saar, 2026-10-14) : l'Atelier actuel n'est pas câblé pour
l'import de textures — coquille vide gardée pour une remise en service future, indépendamment de ce lot.
Aucun comportement réel à valider visuellement ; les vérifications automatisées ci-dessus font foi. Lot
considéré CLOS, pas partiel.
- `[VÉRIFIÉ]` `TexturePacksPage.jsx` est une **page orpheline** : aucun import nulle part dans `client/src`
  (remplacée par `WorkshopPage.jsx`, jamais retirée), référence pourtant `voxel-textures` abondamment. Sans
  rapport direct avec la purge voxel — question séparée pour Saar : la supprimer dans ce lot (mécanique, bas
  risque, zéro appelant) ou la laisser, hors périmètre pour l'instant ?
- Invariant : un seul commit atomique pour le renommage complet — contrairement à l'expand/contract des données
  (plusieurs instances à faire cohabiter), un renommage de code dans CE dépôt n'a pas besoin d'étapes intermédiaires.
- Hors périmètre : toute évolution de comportement du catalogue.

**Lot 5 — migration destructive des colonnes (dernier, après sauvegarde vérifiée)**
- Condition stricte : Lots 2 et 3 clos, zéro lecture/écriture de `voxel_data`/`voxel_revision`/`voxel_scale`
  (grep final), ET dump de base vérifié + accord explicite de Saar (§0).
- Fichiers : migration Knex `DROP COLUMN voxel_data, voxel_revision, voxel_scale` sur `battlemaps` ; retirer leur
  copie résiduelle dans `/duplicate` ([battlemaps.js:1130-1131](../../server/src/routes/battlemaps.js)) ; retirer
  les règles de garde devenues mortes dans `PLAN_EXPORT_CARTE.md` (lignes 82-88, refus si `voxel_data` non vide).
- Invariant : migration testée sur un dump réel en local avant toute autre instance (jamais laisser `nodemon`
  l'appliquer seul — `.claude/rules/migrations.md`).
- Hors périmètre : toute autre colonne de `battlemaps`.

**Lot 5 — CLOS le 2026-10-14.** Accord explicite de Saar, sans sauvegarde préalable (garde-fou §0 levé
par lui pour cette étape précise — « Go lot 5. Accord explicite pour supprimer ces lignes. Pas de
save. »). Migration 388 : `DROP COLUMN voxel_data/voxel_revision/voxel_scale` sur `battlemaps`
(appliquée immédiatement par nodemon, serveur de Saar en marche). Code nettoyé AVANT l'écriture de la
migration (ordre volontaire, pour qu'aucun code ne référence une colonne absente même un instant) :
`battlemaps.js` — `voxel_revision` retiré du `SELECT` de la liste des cartes ; `voxel_scale`/`voxel_data`
retirés de l'INSERT de `/duplicate`. `Voxel.jsx` : commentaire d'en-tête corrigé (ne décrivait plus la
réalité depuis le Lot 3 — plus importé par Canvas3D/Editor3D, seul VoxelBuilderTab.jsx le fait ;
`geometry` ne vient plus de `voxel_data.geo`, mort, mais de l'entrée catalogue éditée). Vérifié avant
d'écrire la migration : recherche exhaustive (`client/src`, `server/src`, `shared/`) — zéro référence
vivante aux 3 colonnes hors scripts de ticket historiques (jamais réécrits) et commentaires inertes
(`shared/events.js`, `CombatModifiersWindow.jsx` — constante déjà hardcodée à 1.0, sans rapport avec la
colonne). Testé après coup : requête directe en base confirmant le schéma (3 colonnes absentes,
21 colonnes restantes cohérentes) ; `node --check`/`eslint` propres ; `node --test
battlemapWorldPersistence.test.mjs` 3/3 vert ; `npm run build` client propre. Test archivé laissé en
l'état (`migrations_archive/250_battlemaps_voxel_data_drop_default.test.mjs` — échec attendu, convention
du projet, jamais corrigé).

**CHANTIER CLOS — les 6 lots sont terminés.** Plus aucune trace vivante du format de carte voxel ; le
catalogue de textures (ex-voxel_textures) est renommé et conservé ; la documentation technique reflète
l'état réel du code.

**Lot 6 — documentation (relocaliser avant de supprimer, trouvé au §10bis.4)**
- `docs/SYSTEME/VOXELS.md` : séparer son contenu avant de le retirer — PE14 (conversion base↔Three.js, toutes
  entités/tokens) et PE34 (`tokenFeetPoint`, altitude des pieds d'un token) sont des conventions **vivantes**,
  mal rangées sous « voxel » par accident historique → à déplacer vers `CONVENTIONS.md`/`MOTEUR_MONDE.md` (à
  trancher à l'écriture du lot, pas ici). Le reste (format `voxel_data`, P17/P22/P26/P32, section Collision déjà
  marquée SUPPRIMÉ) part avec le fichier une fois les Lots 2-3-5 clos.
- `CONVENTIONS.md` §19 (index P/PE/PC/PI) : mettre à jour les 6 renvois vers `VOXELS.md` (P17/P22/P26/P32/PE14/
  PE34) vers leur nouvelle source ; P22 (`voxel_textures.id` = integer) devient `surface_textures.id` après le
  Lot 4.
- `docs/SYSTEME/EDITEUR.md` et `MOTEUR_MONDE.md` : sections décrivant le pipeline de sauvegarde/révision voxel
  (`voxelSaveQueueRef`, `isDirty`/voxels, l'union voxel+surface de `syncBattlemapTextureUsage`, `GET
  /voxel-textures`) à corriger pour refléter l'état après Lots 2-4, pas une suppression en bloc du fichier.
- `.claude/rules/voxels.md` : son `paths:` cible des noms de fichiers qui disparaissent (Lots 3-4) — à retirer
  ou réduire à ce qui reste pertinent (le peu qui concernerait encore `Voxel.jsx`, catégorie C).
- Invariant : aucune règle `P*`/`PE*` ne doit pointer vers un document qui n'existe plus après ce lot — vérifié
  par grep sur `VOXELS.md` dans tout `docs/`, pas par relecture visuelle seule.
- Hors périmètre : `docs/Old/PLAN_VOXELS.md` (archive historique, ne se corrige jamais).

**Lot 6 — CLOS le 2026-10-14.** `VOXELS.md` réécrit (garde P22/P26/P32, encore utiles pour `Voxel.jsx` ;
PE14/PE34 relocalisés vers `ENTITES.md`/`MOTEUR_MONDE.md` avec leur formule complète ; le reste — format
`voxel_data`, P17 — condensé en un historique court). `CONVENTIONS.md` §18-19 : 6 pointeurs corrigés (P17
retiré, P22/PEF6 renommés, PE14/PE34 redirigés). `EDITEUR.md`, `MOTEUR_MONDE.md`, `SURFACES_SALLES.md` :
sections décrivant le pipeline double (voxel+surface) corrigées pour refléter le pipeline unique actuel.
`ASSETS.md`, `ENTITES.md`, `MATERIAUX.md`, `CHARACTER.md` : table/route/fichier renommés, mécanisme
`voxel_data[key].tex` (mort) retiré de l'exemple. `.claude/rules/voxels.md` : `paths:` réduit à `Voxel.jsx`
(les fichiers qu'il visait sous `*voxel*.js`/`voxelTextures*` sont renommés ou supprimés), contenu recentré
sur le rendu de bloc texturé. **Trouvaille en cours de route** : `createReliefGeometryFromQuadData` et ses
4 helpers exclusifs (`reliefGeometry.js`) étaient devenus orphelins après la suppression de
`CulledVoxelScene`/`DungeonTerrainScene` au Lot 3 — retirés ici (vérifié : `applyProceduralReliefToGeometry`,
sans appelant lui aussi, est un cas distinct et sans rapport, laissé en l'état, hors périmètre). `TRADE.md`,
`COMBAT_FLUX.md`, `ARCHITECTURE_SOCKET.md` : mentions laissées telles quelles, exactes comme récits
historiques d'un système déjà disparu avant ce chantier. Testé : `eslint`/`node --check` propres sur
`reliefGeometry.js`, `npm run build` propre. Pas de script/commande dédiée pour « tester » de la
documentation — relecture croisée seule.

## Historique

- **2026-10-14 — Lot 5 clos, CHANTIER TERMINÉ** : accord explicite de Saar, migration 388 appliquée
  (colonnes `voxel_data`/`voxel_revision`/`voxel_scale` supprimées de `battlemaps`), code résiduel
  nettoyé avant l'écriture de la migration. Les 6 lots de ce plan sont clos.
- **2026-10-14 — Lot 6 clos** : documentation corrigée (`VOXELS.md` réécrit, `CONVENTIONS.md`/`EDITEUR.md`/
  `MOTEUR_MONDE.md`/`SURFACES_SALLES.md`/`ASSETS.md`/`ENTITES.md`/`MATERIAUX.md`/`CHARACTER.md`/
  `.claude/rules/voxels.md` mis à jour) ; trouvaille en route : `createReliefGeometryFromQuadData` et ses
  helpers (`reliefGeometry.js`) étaient orphelins depuis le Lot 3, retirés. Ne reste que le Lot 5
  (migration destructive des colonnes `battlemaps`, après sauvegarde vérifiée — accord explicite de Saar
  requis avant exécution).
- **2026-10-14 — Lot 4 codé et clos** : renommage complet `voxel_textures`→`surface_textures` (base, API,
  fichiers), doublon mort supprimé, page orpheline supprimée, `VoxelBuilderTab.jsx` délibérément pas renommé
  (vocabulaire de domaine légitime découvert en route). Incident nodemon/migration auto-appliquée documenté
  et corrigé. Reste Lot 5 (colonnes `battlemaps`) et Lot 6 (documentation).
- **2026-10-13 (2ᵉ analyse à charge, sur demande de Saar)** — Lot 4 (renommage catalogue) incomplet au premier
  passage : ne listait que 2 fichiers client / 2 serveur. Recherche exhaustive trouve 7 fichiers client, 3
  serveur — dont `routes/texture-packs.js` (~15 références, export/import ZIP) entièrement oublié. Vérifié que
  le format ZIP exporté (`manifest.json`, clé `textures`) n'est pas affecté par le renommage de la table.
  Trouvaille annexe : `TexturePacksPage.jsx` est une page orpheline (remplacée par `WorkshopPage.jsx`, jamais
  retirée) — question ouverte à Saar, pas décidée ici.
- **2026-10-13 (analyse à charge du plan)** — §10bis ajouté sur demande explicite de Saar : relecture critique
  du plan de lots avant tout code. 4 trous trouvés et corrigés : 2 tests qui casseraient sans mise à jour
  (`battlemapWorldPersistence.test.mjs`), une dépendance npm orpheline (`fast-voxel-raycast`), un deuxième site
  catégorie B raté (`colTopSurface`, Canvas3D.jsx — prévisualisation de déplacement combat, pas la carte neuve),
  et un Lot 6 documentaire ajouté (VOXELS.md contient des conventions PE14/PE34 vivantes, mal rangées, à
  relocaliser avant suppression — pas vu dans le premier passage).
- **2026-10-13** — Cadrage clos : §4 répondu par Saar (§8), analyse à charge fichier par fichier (§9, corrige une
  première tentative de classement par nom plutôt que par condition réelle de déclenchement), plan exact de 4 lots
  restants (§10). Décisions prises par Claude (nom du catalogue renommé, ordre et contenu des lots), validées par
  délégation explicite de Saar (« je n'ai pas le niveau technique », décide architecture/périmètre). Zéro code
  touché dans cette session — uniquement de la documentation.
- **2026-09-30** — §7 ajouté : premier code de ce plan (isolement, pas suppression, voir §7).
- **2026-09-27** — §6 ajouté : système de matériau procédural répertorié en détail (capacités réelles,
  pipeline moteur→catalogue via l'atelier, lien avec `PLAN_DECALS.md`) sur demande de Saar, qui
  découvrait mal l'étendue de « Matière + Motif ». Documentation seule, aucun code touché.
- **2026-09-26** — stub créé sur décision de Saar ; inventaire par recherche de texte, à confirmer.
