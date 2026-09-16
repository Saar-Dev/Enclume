# PLAN_CAISSES_INTERACTIVES.md — Ouverture/fermeture des caisses et coffres (futuristic_crates_chests)

> Statut : CLOS 2026-09-16, validé jeu réel, commité `dev/Saar` (`eece01e`), **pas poussé**.
> Contenu durable transféré vers `docs/SYSTEME/ENTITES.md` §5.4, `docs/SYSTEME/ASSETS.md`,
> `docs/SYSTEME/CREATION_OBJETS_3D.md`, `docs/JOURNAL8.md`, `docs/ROADMAP.md` §1/§2 (trouvaille
> portes). Archivé ici (Règle 10) — document figé, ne plus éditer.
> Document temporaire (Règle 10, `docs/RegleDocumentaire.md`).
> Suite de `docs/Old/PLAN_ASSETS_3D_BUILTIN.md` (rangement du catalogue, clos).

## 1. Objectif

Câbler les 10 assets de `futuristic_crates_chests` comme entités interactives ouvrables/
fermables. Le moteur serveur (`socketEntity.js` : `ENTITY_ACTION_REQUEST`, arbitrage MJ,
`resolveEntityState`) est déjà générique sur `entity_blueprints.states`/`interactions` — aucun
changement serveur sur la FSM d'interaction elle-même.

## 2. Hors périmètre (explicitement exclu)

- **Verrous électroniques** (`docs/REGLES/REGLE_SERRURE.md`, RAW) — dépendent du Duel
  d'ordinateurs / neutralisation (`REGLE_ORDINATEUR.md`), donc du chantier Informatique en
  cours (Lots 2-4 non commencés, cf. mémoire projet). Un coffre "sécurisé" (`06_chest_compact_lockbox`)
  reste ouvrable librement dans ce lot. Le verrou sera un incrément séparé, après le chantier
  Informatique.
- Aucun test de compétence/attribut à l'ouverture (`skill_id`/`attribute_id` absents → résolution
  directe sans arbitrage MJ, comme prévu par `socketEntity.js`).
- ~~Pas de filtrage "interaction visible seulement depuis tel état"~~ **Corrigé après test réel** :
  le champ existe (`interaction.required_state_ids`), consommé par `SessionPage.jsx` — je ne
  l'avais pas vu lors de l'exploration initiale (grep incomplet sur `EntityBuilderTab.jsx`).
  "Ouvrir" (`required_state_ids:[0]`) et "Fermer" (`required_state_ids:[1]`) ne s'affichent donc
  que depuis l'état pertinent.

## 3. Constats de l'exploration

- Les 10 GLB contiennent chacun un seul clip d'animation nommé génériquement "Animation" (export
  Blender par défaut). Convention retenue : **temps 0 du clip = fermé, fin du clip = ouvert**.
- Aucune lecture d'animation glTF n'existe dans le code actuel (`EntityMesh.jsx` ne gère que
  `visual_override.opacity`/`materialOverrides`) — nouvelle capacité, pas un simple branchement.
- Les blueprints builtin ont `created_by: null` ; la route `PUT /api/entity-blueprints/:id`
  refuse toute édition (`null !== req.user.id`). Décision : ne pas toucher cette autorisation,
  tout déclarer dans le manifest (source unique, régénérable), comme le reste du catalogue.
- `syncBuiltinModels()` n'inclut pas `states`/`interactions` dans son `insert` ni son
  `onConflict(...).merge(...)` — à corriger, sinon les 10 blueprints déjà synchronisés (states
  vides) ne se mettraient jamais à jour depuis le manifest.
- Les 10 assets sont tous des conteneurs à couvercle réel (vérifié `animation`/`features` de
  chacun) — traitement uniforme, aucune exception.

## 4. Schéma retenu

Par asset, dans `output/futuristic_crates_chests/manifest.json` :

```json
"states": [
  { "id": 0, "name": "closed", "visual_override": { "animationProgress": 0 } },
  { "id": 1, "name": "open", "visual_override": { "animationProgress": 1 } }
],
"interactions": [
  { "id": "open", "action_label": "Ouvrir", "required_state_ids": [0], "target_state_id": 1 },
  { "id": "close", "action_label": "Fermer", "required_state_ids": [1], "target_state_id": 0 }
]
```

## 7. Incident de test réel (2026-09-16)

Premier test : bouton d'interaction visible mais aucune option au clic hors éditeur. Cause :
`SessionPage.jsx` (`handleEntityClick` et le rendu du `RadialMenu`) fait
`i.required_state_ids.includes(currentStateId)` **sans garde** — champ absent de mes interactions
écrites à la main (jamais vu lors de l'exploration : présent dans `EntityBuilderTab.jsx` et le
commentaire de la migration `41_entity_blueprints.js`, mais hors de mon grep initial). Pas un bug
latent du moteur : l'Atelier garantit toujours ce champ (`required_state_ids || []`) pour toute
interaction créée via l'UI — uniquement une interaction écrite hors UI (comme ici, dans le
manifest builtin) peut l'omettre. Corrigé en ajoutant le champ (§6). Leçon : pour tout nouveau
champ JSON écrit à la main hors de l'UI qui le génère normalement, lire le code de sauvegarde de
cette UI en entier, pas seulement les champs du formulaire visible.

## 5. Fichiers touchés

- `output/futuristic_crates_chests/manifest.json` — states/interactions sur les 10 assets.
- `server/src/lib/builtinModelCatalog.js` — `readBuiltinModels()` lit `states`/`interactions` du
  manifest ; `syncBuiltinModels()` les inclut dans l'insert et le merge.
- `client/src/components/EntityMesh.jsx` — `EntityMeshGlb` construit un `THREE.AnimationMixer`
  sur la scène clonée, joue l'action en pause, et interpole `action.time` vers la valeur cible
  (`animationProgress * duration`) au changement d'état — même patron de lerp déjà utilisé pour
  la position (P40). Snap instantané au montage (pas d'animation rejouée à chaque chargement de
  carte), lerp uniquement sur une transition vécue.
- Aucun changement serveur sur la FSM d'interaction, aucun changement sur les 62 autres assets
  builtin (states vides inchangés, donc aucune régression possible sur eux).

## 6. Validation prévue

- `node tools/validate-3d-manifest.mjs output/futuristic_crates_chests/manifest.json` (le champ
  `states`/`interactions` n'est pas vérifié par l'outil, ne doit provoquer aucune erreur).
- `node --check server/src/lib/builtinModelCatalog.js`.
- Rafraîchissement du catalogue par Saar (bouton dans l'éditeur ou redémarrage serveur), puis
  test réel : poser une caisse, ouvrir, fermer, recharger la carte pour vérifier que l'état
  persiste visuellement sans rejouer l'animation depuis fermé.
