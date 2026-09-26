# PLAN_PURGE_VOXEL.md — Faire disparaître ce qui subsiste du voxel

> **Stub — 2026-09-26.** Décision de Saar (2026-09-26, en cadrant l'export de carte) : « tout ce qui subsiste de la version Voxel doit
> disparaître ». **Cadrage non commencé, zéro code.** Ce document ne fait que consigner l'inventaire constaté et les questions, pour que
> la conversation de cadrage démarre ancrée. Lien : `docs/PLANS/PLAN_EXPORT_CARTE.md` §11 (S0 n'en dépend pas ; la purge en simplifiera
> les règles de refus). Historique du voxel : `docs/Old/PLAN_VOXELS.md`, `docs/SYSTEME/VOXELS.md`, `.claude/rules/voxels.md`.
>
> `[VÉRIFIÉ]` = lecture du code ou de la base le 2026-09-26 (recensement par recherche de texte : **à refaire fichier par fichier au
> cadrage**, il ne remplace pas la lecture).

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

## Historique

- **2026-09-26** — stub créé sur décision de Saar ; inventaire par recherche de texte, à confirmer.
