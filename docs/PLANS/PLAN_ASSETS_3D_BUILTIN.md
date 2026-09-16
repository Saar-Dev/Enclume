# PLAN_ASSETS_3D_BUILTIN.md — Rangement du catalogue 3D intégré (`output/`)

> Statut : exécuté 2026-09-16 (72 renommages glb, 51 déplacements, 0 suppression). Validation
> `tools/validate-3d-manifest.mjs` : 0 erreur sur les 7 packs. En attente de la validation
> fonctionnelle de Saar (redémarrage serveur, `syncBuiltinModels()`) avant commit.
> Document temporaire (Règle 10, `docs/RegleDocumentaire.md`) — à archiver/supprimer une fois le
> chantier clos, contenu définitif à reporter dans `docs/SYSTEME/CREATION_OBJETS_3D.md` si une
> convention change durablement.

## 1. Déclencheur

Saar veut câbler les caisses/coffres de `output/futuristic_crates_chests/` comme entités
interactives (moteur déjà prêt côté `entity_blueprints`/`socketEntity.js`/`RadialMenu.jsx` —
voir `docs/SYSTEME/ENTITES.md`). Avant d'ajouter du contenu, le dossier source doit être propre :
mélange de fichiers FR/EN, doublons accent/non-accent, artefacts Blender committés, chemins
absolus morts dans les manifests.

## 2. Lecture préalable (sources d'autorité, déjà faites)

- `docs/SYSTEME/CREATION_OBJETS_3D.md` — contrat de fabrication, structure de pack canonique,
  fallback `catalog_file → ${name}.glb`, champ `glb` absolu déclaré obsolète.
- `docs/SYSTEME/ASSETS.md` — sert `builtin-models/` par `express.static`, **pas MinIO** ; choix
  audité le 2026-08-26, confirmé exact. Ne pas remettre en cause dans ce chantier.
- `tools/validate-3d-manifest.mjs` — validateur existant, fait autorité sur ce qui est bien
  formé ; `name` doit matcher `^[a-z0-9][a-z0-9_-]*$`, `catalog_file` optionnel avec le même
  fallback que le code serveur.
- `server/src/lib/builtinModelCatalog.js` — lecture réelle du disque, clé stable
  `builtin_key = <pack>/<asset.name>` (le nom de dossier de pack et `asset.name` ne changent
  jamais après publication).
- Vérifié en plus (analyse à charge) : le monde/connecteurs (`connectors.js`,
  `SurfaceDungeonScene.jsx`, `SurfaceEditorPanel.jsx`, code de Kiwi) matche `builtin_key`/
  `category` par sous-chaîne (`futuristic_doors`, `02_airlock`, `06_large_hangar`...) — jamais
  sur un nom de fichier `.glb`. Ce chantier ne touchant ni les noms de dossier de pack ni
  `asset.name`, ce couplage reste intact. Fragile et non documenté ailleurs que dans ce code :
  un futur renommage de `asset.name` casserait silencieusement le calcul de bordure des portes.
  Hors périmètre ici, à garder en tête pour la suite.

## 3. Hors périmètre (explicitement exclu de ce chantier)

- **Pas de renommage de la racine `output/` ni des sous-dossiers de pack.** Ce sont des
  identifiants documentés (`builtin_key`, doc de fabrication, aide du validateur). Aucun
  bénéfice à les renommer, coût de désynchronisation doc/outil certain.
- **Pas de migration vers MinIO.** Décision déjà auditée et confirmée dans `ASSETS.md`
  (contenu système versionné avec le repo, distinct des uploads utilisateurs). Sujet à rouvrir
  séparément si un vrai problème apparaît un jour, pas ici.
- **Pas de câblage des interactions** (états, animations) — chantier suivant, après ce rangement.

## 4. Règles de transformation

### 4.1 Fichiers `.glb`

- Un asset référencé garde son fichier, **renommé vers `<pack>/glb/<asset.name>.glb`**
  (le slug ASCII déjà validé par `tools/validate-3d-manifest.mjs`, jamais le `label` FR).
- Un fichier `.glb` présent dans `glb/` mais non résolu par aucun asset du manifest (ni via
  `catalog_file`, ni via le fallback `${name}.glb`) est un **fichier non catalogué**.
  **Vérifié par taille+hash SHA1 (§5.1) : ce ne sont PAS des doublons du fichier référencé
  homologue — tailles et hash tous différents, sans exception.** Ce sont des modèles distincts
  (variantes jamais ajoutées au manifest, ou itérations abandonnées) : **jamais de `git rm`
  automatique**. Ils sont déplacés (quarantaine, §4.3) pour revue par Saar — promotion en
  nouvelle entrée de catalogue ou suppression volontaire, décision asset par asset.
- Le GLB "pack combiné" (`submarine_postapo_*_pack.glb`, jamais référencé individuellement par
  un asset) → déplacé, pas supprimé (voir §4.3).

### 4.2 Champs de manifeste

Racine du manifest — **supprimés** (bookkeeping pipeline, jamais lus par le code, absents du
manifeste canonique de `CREATION_OBJETS_3D.md`) : `blend`, `combined_glb`, `preview_png`,
`open_preview_png`, `basin_preview_png`, `algae_preview_png`, `quality_rules`, `pack`.
Rien n'est perdu : le `manifest.json` avant édition reste récupérable via l'historique git
(`git log --follow`, §8), pas besoin d'une copie séparée.

Par asset — **supprimés** : `catalog_file` (redondant une fois le fichier renommé vers
`${name}.glb`, le fallback déjà codé s'applique), `glb` (chemin absolu, déclaré obsolète par
`CREATION_OBJETS_3D.md`).

Par asset — **conservés** (données de jeu potentiellement utiles au chantier interactions
suivant, non dépréciées par la doc, seulement "pas encore consommées") : `features`,
`animation`, `animation_frame_closed`, `animation_frame_open`, `interior`, `capacity_liters`,
`color_slots` / `editor_color_slots`, `fixed_materials`, `category`, `size_class`, `format`,
toutes les dimensions, `label`.

### 4.3 Fichiers hors contrat (pipeline Blender) et quarantaine

Le schéma canonique d'un pack (`CREATION_OBJETS_3D.md` §"Structure d'un pack intégré") ne
contient que `manifest.json` + `glb/`. Tout le reste (`.blend`, `.blend1`, PNG preview/diagnostic,
`README.md`, `validation.json`, `import_validation.json`, GLB combiné) part vers
`docs/AssetsSource/<pack>/` — zone de transit pour extraction manuelle par Saar, hors du dossier
servi par `express.static`. Pas de copie de sécurité du manifest original : le `git mv` + édition
dans le même historique le rend déjà récupérable (`git log --follow`, §8) — une archive en plus
serait du bruit, pas une sécurité réelle.

Les fichiers `.glb` non catalogués (§4.1) vont dans un sous-dossier séparé et clairement
distinct : `docs/AssetsSource/<pack>/non-catalogues/` — pas mélangés avec les artefacts
pipeline purs, puisqu'ils restent des candidats potentiels à une future entrée de catalogue.

## 5. État des lieux détaillé par pack

### 5.1 Vérification taille+hash des fichiers non catalogués

Avant d'écrire ce plan, chaque fichier non catalogué a été comparé (taille + SHA1) à son
homologue référencé le plus proche par le nom. **Résultat : les 17 paires ont des tailles et
des hash différents, sans exception** — ce ne sont pas des doublons, ce sont des modèles
distincts. Aucune suppression automatique n'est donc prévue (voir §4.1) ; ils sont mis en
quarantaine dans `docs/AssetsSource/<pack>/non-catalogues/` pour revue par Saar.

### `futuristic_crates_chests` (10 assets référencés)
- Non catalogués → quarantaine (6) : `Bac à petites pièces.glb`, `Caisse moyenne empilable.glb`,
  `Coffre compact sécurisé.glb`, `Coffre à outils renforcé.glb`, `Lot de caisses assorties.glb`,
  `Malle longue renforcée.glb`
- Combiné à déplacer : `submarine_postapo_crates_chests_pack.glb`
- Pas de fichiers hors-contrat au niveau racine du pack (déjà propre à ce niveau).

### `futuristic_doors` (8 assets référencés)
- Aucun fichier non catalogué.
- Combiné à déplacer : `submarine_postapo_futuristic_doors_pack.glb`
- Hors-contrat à déplacer : `README.md`, `control_block_back_detail_preview.png`,
  `control_block_detail_preview.png`, `submarine_postapo_futuristic_doors_pack.blend`,
  `.blend1`, `submarine_postapo_futuristic_doors_preview.png`,
  `three_part_triangular_closed.png`, `three_part_triangular_open.png`

### `futuristic_furniture` (7 assets référencés)
- Aucun fichier non catalogué.
- Combiné à déplacer : `submarine_postapo_futuristic_furniture_pack.glb`
- Pas de fichiers hors-contrat.

### `futuristic_hydroponics` (23 assets référencés)
- Non catalogués → quarantaine (2) : `Bac moyen aéré pour algues.glb`,
  `Grand bac industriel pour algues.glb`
- Combiné à déplacer : `submarine_postapo_futuristic_hydroponics_pack.glb`
- Hors-contrat à déplacer : `README.md`, `algae_cascade_diagnostic.png`,
  `algae_uv_vat_diagnostic.png`, `contact_audit_01_08.png`, `contact_audit_09_15.png`,
  `contact_audit_16_23.png`, `culture_tables_containment_diagnostic.png`,
  `harvest_bench_support_diagnostic.png`, `hydro_basins_bottom_diagnostic.png`,
  `hydroponic_rack_roof_diagnostic.png`, `import_validation.json`,
  `sealed_grow_cabinet_opening_diagnostic.png`, `submarine_postapo_algae_culture_vats_preview.png`,
  `submarine_postapo_futuristic_hydroponics_open.png`,
  `submarine_postapo_futuristic_hydroponics_pack.blend`, `.blend1`,
  `submarine_postapo_futuristic_hydroponics_preview.png`,
  `submarine_postapo_hydroponic_basins_preview.png`, `validation.json`

### `futuristic_kitchen` (9 assets référencés)
- Non catalogués → quarantaine (9) : `Armoire de réserve étanche.glb`,
  `Chariot de service de cuisine.glb`, `Comptoir de préparation modulaire.glb`,
  `Congélateur coffre blindé.glb`, `Fourneau industriel avec four.glb`,
  `Hotte aspirante murale.glb`, `Lave vaisselle industriel à capot.glb`,
  `Réfrigérateur vertical.glb`, `Îlot central de préparation.glb`
- Combiné à déplacer : `submarine_postapo_futuristic_kitchen_pack.glb`
- Pas de fichiers hors-contrat au niveau racine du pack.
- Note : les noms d'assets sautent de 06 à 09 dans le manifest, cohérent avec des itérations
  abandonnées — mais comme ce ne sont pas des doublons confirmés (§5.1), ils partent en
  quarantaine comme les autres, pas en suppression.

### `futuristic_tables_chairs` (6 assets référencés)
- Aucun fichier non catalogué.
- Combiné à déplacer : `submarine_postapo_tables_chairs_pack.glb`
- Pas de fichiers hors-contrat.

### `technical_blocks` (9 assets référencés)
- Aucun fichier non catalogué.
- Combiné à déplacer : `submarine_postapo_technical_blocks_pack.glb`
- Pas de fichiers hors-contrat.

**Total** : 17 fichiers `.glb` non catalogués mis en quarantaine (aucune suppression), 7 GLB
combinés déplacés, 27 fichiers pipeline (README/preview/diagnostic/blend/validation) déplacés
depuis `futuristic_doors` et `futuristic_hydroponics`. **Ce rangement ne réduit pas la taille de
`.git`** (206 Mo actuels d'historique) : rien n'est purgé de l'historique, seulement du
répertoire de travail à partir de ce commit.

## 6. Procédure d'exécution

Un script Node (pas de boucle bash — les noms de fichiers accentués s'encodent mal côté
Windows/Git Bash, confirmé sur ce chantier) qui, pour chaque pack :

1. Lit `manifest.json`, résout `fileName = asset.catalog_file || `${asset.name}.glb`` pour
   chaque asset.
2. `git mv` chaque fichier référencé vers `<pack>/glb/<asset.name>.glb`, via
   `spawnSync('git', ['mv', src, dest])` (tableau d'arguments — jamais une commande shell
   interpolée, pour éviter la corruption des noms accentués déjà observée dans cette session).
3. `git mv` chaque fichier hors-contrat (§5) vers `docs/AssetsSource/<pack>/`.
4. `git mv` chaque fichier non catalogué (§5) vers `docs/AssetsSource/<pack>/non-catalogues/`
   — jamais `git rm` (§4.1 : ce ne sont pas des doublons vérifiés).
5. Réécrit `manifest.json` : par asset, retire `catalog_file` et `glb` ; à la racine, retire les
   champs listés en §4.2.
6. Re-vérifie `git status --short` avant tout commit (une édition après `git mv` doit être
   re-stagée — piège connu sur ce projet).

## 7. Validation

- `node tools/validate-3d-manifest.mjs output/<pack>/manifest.json` sur les 7 packs → 0 erreur
  attendu (les avertissements existants sur les animations/color_slots legacy peuvent rester,
  ils ne bloquent pas).
- `node --check server/src/lib/builtinModelCatalog.js` (aucune modification prévue sur ce
  fichier dans ce chantier — le fallback `catalog_file → ${name}.glb` y est déjà codé).
- Redémarrage serveur par Saar : `syncBuiltinModels()` doit retrouver tous les blueprints par
  `builtin_key` inchangé, aucune régression sur les entités déjà posées sur une battlemap.
- `git diff --check` avant tout commit.

## 8. Réversibilité

Aucune suppression dans ce chantier : tous les mouvements de fichiers se font via `git mv`
(historique préservé, `git log --follow` retrouve chaque fichier, y compris les 17 fichiers
non catalogués mis en quarantaine). Seule l'édition des `manifest.json` modifie du contenu ;
elle reste diffable et revertable comme n'importe quel commit.

## 9. Suite (hors périmètre de ce document)

Une fois ce rangement validé par Saar (serveur relancé, aucune régression) : chantier séparé pour
câbler `futuristic_crates_chests` en entités interactives (states/interactions sur les
blueprints, extension du contrat `states` pour une pose "ouvert" — actuellement seul
`visual_override.opacity`/`face_overrides` existe, cf. `EntityMesh.jsx`).
