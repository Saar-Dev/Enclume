# PLAN_ENTITES_INTERACTIVES_ROADMAP.md — Séquence du fil "entités interactives"

> Document de séquencement (pas un plan de chantier détaillé) — ordonne les prochains incréments du
> fil ouvert par le chantier caisses interactives (`docs/JOURNAL8.md` 2026-09-16) et explique
> pourquoi cet ordre, pas un autre. Chaque lot listé ici aura son propre `PLAN_XXX.md` détaillé au
> moment où il démarre, sauf les lots A (trop petits pour le justifier). Référencé depuis
> `docs/ROADMAP.md` §1/§2.

## Logique d'ensemble

1. **Lot A d'abord** : deux tâches indépendantes, sans risque d'architecture, qui ferment des
   dettes déjà identifiées ailleurs (quarantaine du rangement, dernière ligne ROADMAP non prouvée
   du moteur d'interactions). Aucune des deux ne bloque ni n'est bloquée par les lots suivants —
   ordre libre entre elles.
2. **Lot B ensuite** : multiplier le patron déjà prouvé (états ouvert/fermé + animation) sur
   d'autres packs candidats, mais seulement après une décision produit (quels packs, quels
   assets) — pas de travail à l'aveugle sur du contenu qui ne sera peut-être pas voulu.
3. **Lot C en dernier, volontairement** : le rendu 3D des portes. Techniquement indépendant des
   lots A/B (système des connecteurs, pas `entity_blueprints`), mais placé en dernier parce que
   c'est le seul morceau qui change de domaine (connecteurs/world builder, moins familier) et qui
   demande une vraie exploration avant tout code — les lots A/B consolident encore le patron
   existant pendant qu'aucune pression ne pousse à improviser sur un système qu'on connaît moins.

Rien n'empêche de réordonner si une urgence produit apparaît (ex. Saar veut voir les portes
d'abord) — cette séquence est une recommandation motivée, pas une contrainte.

## Lot A — Quick wins indépendants

### A1. Revue des 6 fichiers en quarantaine `futuristic_crates_chests` — CLOS 2026-09-16
- **Décision Saar** : 5 fichiers cataloguées avec ouverture/fermeture (patron déjà validé, assets
  11-15) ; le 6e (« Lot de caisses assorties », plusieurs sous-caisses assemblées dans un seul GLB)
  reste **purement décoratif** — aucun `states`/`interactions`, pas déplaçable.
- **Fait** : les 6 fichiers déplacés/renommés (`git mv`, ASCII) de
  `docs/AssetsSource/futuristic_crates_chests/non-catalogues/` vers
  `output/futuristic_crates_chests/glb/` (`11_crate_shallow_dual_bifold_bin` →
  `16_crate_pack_tarped_stack_decor`) ; 6 entrées ajoutées à `manifest.json` (dimensions mesurées
  sur la bounding box réelle du GLB, matériaux vérifiés un par un contre le GLB déplacé, pose de
  repos confirmée = état fermé par comparaison directe avec le premier keyframe de chaque canal
  d'animation). Zéro changement de code — `builtinModelCatalog.js` lit déjà `states`/`interactions`
  du manifest de façon générique. `node tools/validate-3d-manifest.mjs` : 0 erreur.
- **Validé en jeu réel le 2026-09-16** : les 5 assets ouvrables posés/ouverts/fermés sans
  anomalie, le lot décoratif (`16_crate_pack_tarped_stack_decor`) confirmé sans aucune option
  d'interaction. **A1 clos.**
- **Dépendance** : aucune.

### A2. Preuve du dernier sous-type d'interaction (`move_type`) — CLOS 2026-09-17, à l'état « mécanisme prouvé, pas prêt pour la table »
- **Quoi** : créer un blueprint avec une interaction de déplacement (pousser/tirer un objet pour
  la couverture) et valider en jeu réel que `state_cover`/LOS réagissent correctement.
- **Fait** : interaction `move`/`displacement` ajoutée aux 15 caisses/coffres déjà cataloguées
  (`required_state_ids: [0,1]`). Validateur (`tools/validate-3d-manifest.mjs`) durci pour rejeter la
  forme d'un incident rencontré en route (`required_state_ids` manquant, crash client). Le pipeline
  complet (résolution du token acteur, radial menu, jet FOR, Test de Chance, résolution) a tourné
  deux fois de bout en bout sans erreur technique — testé en jeu réel par Saar, GM pilotant le
  PNJ Baboulinet (FOR 18).
- **Pas fait, et ne sera pas fait dans ce lot** : les deux tests réels ont échoué (jets 4 et 10,
  15 % de chances de réussite) — **la caisse n'a jamais bougé, `state_cover`/LOS n'ont donc jamais
  été observés en conditions réelles**. Objectif initial du lot non atteint sur ce point précis.
- **Pourquoi clos maintenant plutôt que poursuivi** : trois problèmes distincts, plus profonds que
  le lot lui-même, ont été trouvés en le testant réellement — chacun mérite son propre cadrage,
  aucun n'est raisonnable à improviser dans la continuité de ce lot :
  1. **Détection de clic 3D** (un token proche d'une caisse recevait son clic) —
     `PLANS/PLAN_CLIC_3D_UNIFICATION.md` (stub, correctif ciblé posé).
  2. **Autorité serveur** (un MJ sans PJ propriétaire ne pouvait jamais agir via un PNJ) —
     `PLANS/PLAN_AUTORITE_PERSONNAGE_SERVEUR.md` (stub, correctif ciblé posé).
  3. **Difficulté du Test et absence de surcharge MJ** (15 % de réussite avec l'Attribut humain
     maximal, aucune interface pour l'ajuster) — `PLANS/PLAN_DIFFICULTE_INTERACTIONS_ENTITES.md`
     (stub, **bloquant réel avant toute utilisation en jeu**, rien codé).
- **Documentation durable** : le fonctionnement actuel du moteur d'interactions (schéma
  `states`/`interactions`, protocole `ENTITY_ACTION_REQUEST`/`ENTITY_MOVE_REQUEST`, règle
  d'ownership) est désormais décrit dans `docs/SYSTEME/ENTITES.md` §10 (Règle 10 — les faits
  durables sortent du PLAN une fois vérifiés, même si le lot n'est pas entièrement jouable).
- **Dépendance pour rouvrir ce sous-type** : cadrage de `PLAN_DIFFICULTE_INTERACTIONS_ENTITES.md`
  au minimum — inutile de reprendre le test en jeu tant que la Difficulté reste à 15 % non ajustable.

## Lot B — Extension du patron ouverture/fermeture

- **Quoi** : appliquer le même mécanisme (`states`/`interactions`/`animationProgress`) aux packs
  qui ont des assets à couvercle/porte animée — candidats identifiés : `futuristic_kitchen`
  (frigos, congélateur, armoires — 9 fichiers en quarantaine à vérifier d'abord, mêmes questions
  qu'A1 mais pour ce pack), `futuristic_hydroponics` (2 fichiers en quarantaine, armoires
  étanches). Zéro nouveau code moteur attendu — uniquement du contenu manifest, comme les caisses.
- **Pourquoi après le lot A** : pas la peine de rouvrir un pack et de trier sa quarantaine avant
  de savoir si Saar veut vraiment l'étendre — décision produit d'abord (quels packs, quels
  assets valent la peine), exécution ensuite.
- **Dépendance** : décision de Saar sur quels packs/assets, pas de dépendance technique aux lots A.
- **Non démarré** : pas de `PLAN_XXX.md` écrit — trop tôt tant que la liste des packs n'est pas
  choisie.

## Lot C — Rendu 3D des portes (connecteurs)

- **Quoi** : synchroniser le rendu GLB d'une porte avec son état runtime (`closed`/`open`/
  `locked`, déjà autoritaire côté serveur — collision/LOS déjà corrects, cf.
  `.claude/rules/world.md`). Contrôleur multi-clips nécessaire (battantes = 1 clip, coulissantes
  = 2 à synchroniser, triangulaire = 3) — pas une extension du contrôleur `EntityMesh.jsx`
  existant, qui ne gère qu'un clip par asset.
- **Pourquoi en dernier** : seul morceau du fil qui sort du domaine entités (`entity_blueprints`)
  pour entrer dans celui des connecteurs structurels (`surface_data.connectors`,
  `world_feature_states`) — domaine que Saar connaît moins bien (world builder, historiquement
  Kiwi) et qui mérite une exploration dédiée (identifier le composant de rendu réel, concevoir le
  contrôleur) avant tout code, pas un enchaînement improvisé après les caisses.
- **Dépendance** : aucune dépendance technique aux lots A/B — uniquement une question de
  séquencement délibéré (voir "Logique d'ensemble").
- **Non démarré** : nécessitera son propre `PLAN_XXX.md` détaillé (exploration du composant de
  rendu concerné, conception du contrôleur multi-clips) avant tout code — pas cadré ici.

## Suivi

Chaque lot fermé doit : mettre à jour ce document (statut du lot), retirer/mettre à jour la ligne
correspondante de `docs/ROADMAP.md`, journaliser dans `docs/JOURNAL8.md`. Ce document lui-même
suit la Règle 10 (temporaire) — à archiver une fois le lot C clos ou si la séquence est abandonnée.
