# PLAN_WORLD_BUILDER_REWORK.md — Rework de l'édition de forme des salles

> **Stub — 2026-09-10.** Chantier identifié, **cadrage non commencé**. Ce document ne pré-cadre
> rien : il capture le déclencheur, l'état connu et la contrainte inter-chantiers, pour que la
> conversation de cadrage dédiée démarre avec un ancrage.
>
> **Autorité** : *Livre de Base Polaris* n'a rien à dire ici (pur outillage) → `docs/SYSTEME/EDITEUR.md`
> + `docs/SYSTEME/SURFACES_SALLES.md` + `.claude/rules/world.md`.

---

## 1. Déclencheur (Saar, 2026-09-10)

> « Le world builder actuel ne me satisfait pas : uniquement des salles purement rectangulaires. Je
> compte le rework pour adopter la logique : **dessiner un volume rectangulaire et le modifier en
> ajoutant des arêtes et en redimensionnant les arêtes.** »

L'inspiration vient de la recherche faite pour l'éditeur de zones dangereuses (Foundry Scene Regions,
Owlbear Fog) : primitives (rectangle / ellipse) + **polygone éditable par poignées** (déplacer une
arête, ajouter un sommet), formes ordonnées combinées en booléen (ajout / trou), « tracer depuis les
murs ».

## 2. État connu `[VÉRIFIÉ code + docs, 2026-09-10 — à re-vérifier au cadrage]`

- **Le modèle de données de salle n'est PAS rectangulaire** : `surface_data.rooms[].verticalProfile.slices[]`
  porte un **multipolygone `footprint`** + `wallPaths` canoniques ; `boundaryArcs` (arrondis) ;
  `geometryClipRoomIds` (soustraction booléenne entre salles) ; `openWallEdgeKeys` ; `wallElevationProfiles`.
  Le compilateur (`shared/world/worldCompiler.js`) extrude déjà « le contour effectif exact, trous et
  polygones disjoints compris » (`SURFACES_SALLES.md` §Formes).
- **C'est l'UX d'édition qui est pauvre** : `SurfaceEditorScene.jsx` peint des **cases de grille**
  (`applyFloorSelection` → `cells` en clés `x:z`) ; `worldCompiler.js` construit le `footprint` depuis
  ces cases. Les formes riches (arcs, clips, profils de mur) sont éditées par des panneaux annexes, pas
  au tracé direct. **Aucun éditeur de sommets / d'arêtes de contour n'existe.**
- `shared/world/aoeShapes.js` = `circle` / `cone` / `ray` horizontales transitoires (combat) — **pas**
  une bibliothèque de géométrie 2D d'édition.

## 3. Ce que le cadrage devra faire

- **Recenser l'existant avant de dessiner** : `boundaryArcs`, `geometryClipRoomIds`, `wallPaths`,
  `verticalProfile.slices` — le rework outille un modèle déjà riche, il ne le refait pas. Le risque
  est de construire un second modèle de contour à côté du multipolygone canonique (invariant 2).
- Définir le **primitif d'édition 2D partagé** dans `shared/world/` : représentation d'un contour
  éditable (sommets ordonnés + arêtes + arcs), opérations (déplacer une arête, insérer/retirer un
  sommet, ajout/trou), test point-dans-contour. **Autorité unique**, réutilisée par le compilateur,
  la requête spatiale et les éditeurs.
- Interaction canvas : poignées, snap-grille togglable, aperçu réversible jusqu'à confirmation serveur
  (`.claude/rules/world.md` : client = intention, serveur = autorité).
- Migration des salles existantes (empreintes de cases → contours) — ou coexistence.

## 4. Contrainte inter-chantiers — **l'éditeur de zones dangereuses E-v2 en dépend**

`PLAN_ZONES_DANGER.md` §7.3 + §12 : le **sculpteur de volume de danger** (polygone / ellipse /
poignées) consomme **ce même primitif d'édition 2D**. Le construire deux fois = deux moteurs
d'édition de forme (invariant 2). Séquencement (`PLAN_ZONES_DANGER.md` §12) :

1. Zones dangereuses noyau Z0→Z5 + éditeur danger **E-v1** (rectangle + « remplir un compartiment ») — sans dépendance.
2. **Ce chantier** — parallélisable avec 1.
3. Éditeur danger **E-v2** — après 2, consomme le primitif livré ici.

Le primitif d'édition 2D livré ici doit donc être **agnostique du domaine** : une salle et un volume
de danger sont deux consommateurs d'un même contour éditable.

## 5. Hors périmètre (à confirmer au cadrage)

Rendu 3D des murs / profils verticaux (déjà en place) ; connecteurs ; matériaux ; le mode voxel.

---

## Historique

- **2026-09-10** — stub créé depuis la conversation de cadrage des zones dangereuses (la recherche
  éditeurs de région pro a mis en évidence que le primitif d'édition 2D est partagé). Cadrage à faire.
