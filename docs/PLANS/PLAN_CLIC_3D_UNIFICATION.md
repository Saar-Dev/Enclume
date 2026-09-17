# PLAN_CLIC_3D_UNIFICATION.md — Unifier le cycle de vie des modes de visée 3D (clic, curseur, annulation)

> **Stub — 2026-09-17, élargi le même jour.** Chantier identifié pendant le durcissement de la
> sélection MJ pour les interactions d'entité, puis élargi en corrigeant l'absence de retour visuel
> sur le mode « Déplacer une caisse » (Lot A2) : la duplication ne concerne pas que l'arbitrage de
> clic, mais tout le cycle de vie d'un « mode de visée » (curseur, annulation Échap, priorité).
> Cadrage détaillé **non commencé** — ce document capture le déclencheur, l'état connu et les
> correctifs intérimaires déjà en place, pour que la conversation de cadrage dédiée démarre avec un
> ancrage, sans redécouvrir ce qui a déjà été vérifié.
>
> **Révisé 2026-09-17 (recensement complet + découpage, §2bis et §5)** : le stub initial comptait 2
> systèmes de clic connus + connecteurs/voxels « à recenser ». Lecture complète du code : **6**
> systèmes indépendants, dont un non soupçonné (`Editor3D.jsx`). Périmètre découpé en 2 lots
> distincts (§5) ; `Editor3D.jsx` explicitement exclu de ce chantier et rattaché à
> `docs/PLAN_WORLD_BUILDER_REWORK.md`. Décision prise sans validation préalable de Saar
> (délégation explicite du périmètre, 2026-09-17) — documentée ici pour traçabilité.
>
> **Autorité** : pur outillage client (aucune règle Polaris) → `.claude/rules/react.md`,
> `docs/SYSTEME/ENTITES.md`.

---

## 1. Déclencheur (2026-09-17)

En testant la sélection MJ pour les interactions d'entité (Ouvrir/Déplacer une caisse), Saar a
trouvé qu'un token proche d'une caisse recevait le clic de la caisse **même en cliquant exactement
sur le token**. Diagnostic : deux systèmes de détection de clic totalement indépendants coexistent
dans le rendu 3D, sans arbitrage entre eux.

Saar, après analyse à charge : « je m'en fous que ce soit disproportionné si ça aggrade
l'architecture du projet — si ça permet une architecture adaptative/évolutive, la question mérite
d'être posée. » Décision : correctif ciblé immédiat (fermer le trou précis), fusion complète
ouverte comme chantier séparé — pas improvisée dans le fil de débogage en cours.

## 2. État connu `[VÉRIFIÉ code, 2026-09-17]`

- **Deux systèmes de détection de clic coexistent, sans lien entre eux** :
  1. **Boucle manuelle** (`client/src/components/Canvas3D.jsx`, `handlePointerDown/Move/Up`,
     écouteurs bruts posés sur `gl.domElement`) — gère déjà, avec un ordre de priorité explicite :
     visée zone d'effet (AOE), déplacement combat + clic-attaque ambiant, mode visée d'entité
     (`moveTarget`, déplacement de caisse), drag de token. Nécessaire pour le drag (suivi continu
     du pointeur, seuil de mouvement, aperçu, snap) — ne se prête pas à un simple `onClick`.
  2. **Système d'événements intégré de React Three Fiber** (`onClick` posé directement sur le mesh,
     `client/src/components/EntityMesh.jsx`, deux variantes : GLB et voxel) — gère le clic sur une
     entité (caisse, porte, etc.), complètement à côté de l'arbitrage de la boucle manuelle.
- Le token n'avait **aucun** gestionnaire `onClick`/`onPointerUp` déclaré côté R3F — invisible pour
  l'arbitrage interne de R3F (plus proche intersection gagne), qui ne connaissait donc que les
  entités comme candidats au clic.
- **Correctif intérimaire déjà appliqué** (`Canvas3D.jsx`, token `<group>`) : un gestionnaire
  `onClick` vide (juste `e.stopPropagation()`) fait désormais participer le token à l'arbitrage de
  R3F, sans toucher à la boucle manuelle ni à `EntityMesh.jsx`. Ferme le trou précis observé ; ne
  fusionne pas les deux systèmes.
- **Non vérifié à ce stade** : si les connecteurs de surface (`onSurfaceConnectorSelect`, murs/
  portes en mode éditeur) constituent un troisième système indépendant — à recenser au cadrage.

- **Élargissement du 2026-09-17** : les 5 « modes de visée » du fichier (`combatMoveMode`,
  `combatTargetMode`, `combatAoeTargetMode`, `losMode`, `moveTarget`) sont déjà traités comme une
  même famille par au moins un effet du code (`Canvas3D.jsx:761-773`, nettoyage du survol ambiant
  dès que l'un d'eux devient actif), mais **sans aucune autorité unique** : chaque consommateur
  recopie sa propre liste des 5, à la main, à chaque nouveau mode ajouté —
  - **Curseur** (`useSceneCursor.js`) : `moveTarget` avait été oublié depuis l'introduction de la
    mécanique (Lot A2) — corrigé aujourd'hui en l'ajoutant à la branche `'case'` existante (même
    sémantique que `combatMoveMode` : désigner une case de destination, jamais un token/une
    entité — distinct de `'cible'`, réservé à désigner un token/une entité).
  - **Annulation Échap** (`Canvas3D.jsx`) : 5 blocs `useEffect` quasi identiques, un par mode,
    jamais consolidés.
  - **Mise en évidence de la cible** : `EntitySelectionHalo` (`EntityMesh.jsx`, halo doré déjà
    utilisé dans l'éditeur GM, `Editor3D.jsx:754`) n'était jamais câblé en mode jeu — corrigé
    aujourd'hui pour `moveTarget` uniquement (`isSelected={moveTarget?.entity?.id === entity.id}`
    sur l'appel `<EntityMesh>` de `Canvas3D.jsx`), sans toucher aux 4 autres modes.
  - Référence pour le futur cadrage : *Game Programming Patterns* (Robert Nystrom), chapitre State
    — un pushdown automaton à un seul « mode actif », chaque mode portant lui-même son curseur/son
    annulation/sa priorité, plutôt que N booléens indépendants recopiés dans chaque consommateur.
  - **Décision du 2026-09-17** : ne pas migrer les 4 modes combat existants vers ce patron
    maintenant — ils sont déjà validés en jeu réel sur de nombreuses sessions, sans suite de tests
    automatisés pour absorber une régression ; les retoucher à l'occasion d'un correctif sur
    `moveTarget` (à peine testé) aurait été le risque non maîtrisé que ce projet refuse
    explicitement. Les deux correctifs posés aujourd'hui suivent la convention actuelle à
    l'identique (aucune duplication nouvelle ajoutée), sans la remplacer.

## 2bis. Recensement complet `[VÉRIFIÉ code, 2026-09-17]` — 6 systèmes, pas 2

Lecture complète des fichiers concernés (pas d'hypothèse). Chaque système est indépendant des
autres — aucun ne connaît l'existence des 5 autres.

1. **Boucle manuelle jeu** (`Canvas3D.jsx`, listeners `pointerdown/move/up` posés sur
   `gl.domElement`) — raycast manuel `raycastGround`/`raycastWorldSupport` (`Canvas3D.jsx:821,833`),
   **sol et voxels uniquement, jamais les meshes d'entité**. Contient déjà un arbitrage de priorité
   explicite et fonctionnel (`handlePointerUp`, ~L1155-1279) : zone d'effet (AOE) > déplacement
   combat/clic-attaque ambiant > mode visée entité (`moveTarget`) > drag/sélection token.
2. **`onClick` déclaratif R3F sur `EntityMesh.jsx`** (2 variantes GLB/voxel, `emitEntityClick`,
   L26-35) — arbitrage interne de React Three Fiber (plus proche intersection gagne), totalement
   étanche au système 1. Le token a reçu un `onClick` vide (`Canvas3D.jsx:417-420`, correctif ciblé
   du 17/09) pour participer à cet arbitrage sans le piloter.
3. **`onPointerDown` déclaratif sur `ConnectorSegment`** (`SurfaceDungeonScene.jsx:1588-1597`,
   portes/ascenseurs) — un troisième mécanisme, différent des deux premiers (pointerdown, pas
   click). Bug déjà documenté dans le code lui-même (`Canvas3D.jsx:2001-2005`) : le `click` natif du
   DOM remonte quand même jusqu'au `<Canvas>` racine après ce `stopPropagation()`.
4. **`<Canvas onClick={handleCanvasClick}>`** (`Canvas3D.jsx:2053-2063`) — point d'écoute racine,
   catch-all, qui referme le panneau connecteur si rien n'a positionné `justSelectedRef`. Cette ref
   mutable est **partagée entre deux fonctionnalités sans rapport** (sélection de token,
   `Canvas3D.jsx:1255` ; sélection de connecteur, `Canvas3D.jsx:2006`) — un couplage caché entre
   systèmes 1 et 3/4, pas juste un détail d'implémentation.
5. **Icône `⚙` en overlay HTML** (`HoverIcon`, `EntityMesh.jsx:545-580`, `<Html>` de drei) — un
   vrai `onClick` DOM, entièrement hors raycasting 3D (5ᵉ mécanisme).
6. **`Editor3D.jsx`** — raycasting manuel *séparé* (`fast-voxel-raycast` pour les voxels +
   `THREE.Raycaster.intersectPlane/intersectBox/intersectObjects` pour supports/objets,
   `Editor3D.jsx` ~L128-490) — réimplémentation indépendante de la boucle du mode jeu, pour le mode
   édition. Ne partage aucun code avec les 5 systèmes ci-dessus. **Non soupçonné au moment du stub
   initial.**

## 3. Ce que le cadrage devra faire

- **Recenser tous les types d'objets cliquables avant de dessiner** : tokens, entités (2 variantes
  de rendu), connecteurs de surface, voxels (mode édition/combat) — lister leur système de
  détection actuel un par un, ne pas supposer.
- **Un seul raycast, une seule liste de candidats, un seul ordre de priorité** — cohérent avec le
  patron déjà existant et validé dans la boucle manuelle (AOE > déplacement combat > mode visée
  entité > drag token) ; les entités et connecteurs viendraient s'y insérer plutôt que de garder
  leur système déclaratif séparé.
- **Migration à risque identifié** : sortir la détection de clic de `EntityMesh.jsx` implique de
  reconstruire, dans la boucle manuelle, la capacité à raycaster contre les meshes d'entités (elle
  ne raycaste aujourd'hui que le sol/les voxels via `raycastGround`/`raycastWorldSupport`) — et de
  préserver sans régression le survol (icône ⚙, `hovered`), l'aperçu (mode `isPreview`), et le
  comportement pour les 6 packs d'assets déjà livrés (pas seulement les caisses testées cette
  session). Prévoir une passe de test dédiée sur chaque pack, pas seulement `futuristic_crates_chests`.
- **Décision à trancher au cadrage** : fusion complète immédiate, ou étapes intermédiaires (ex.
  d'abord unifier tokens+entités, connecteurs dans un second temps) ?
- **Étendre le périmètre au cycle de vie complet d'un mode de visée**, pas seulement au clic
  (élargissement du 2026-09-17, §2) : concevoir la même autorité unique pour le curseur
  (`useSceneCursor.js`) et l'annulation Échap (5 `useEffect` dupliqués dans `Canvas3D.jsx`) que
  pour l'arbitrage de clic — les trois partagent exactement les 5 mêmes états
  (`combatMoveMode`/`combatTargetMode`/`combatAoeTargetMode`/`losMode`/`moveTarget`), donc une seule
  conception (probablement un pushdown automaton à un « mode actif », cf. §2) devrait couvrir les
  trois plutôt que d'être cadrée trois fois séparément.
- **Migration à haut risque, à séquencer avec prudence** : contrairement au correctif ciblé du
  2026-09-17 (additif, zéro régression possible), une vraie fusion toucherait 4 modes de combat déjà
  validés en jeu réel sans suite de tests automatisés — prévoir une repasse manuelle complète de
  chaque mode (déplacement combat, ciblage CaC/tir, zone d'effet, LOS) après migration, pas seulement
  le mode entité qui a déclenché ce chantier.

## 4. Hors périmètre de ce document

Aucune implémentation ici — ce stub ferme la boucle de traçabilité (le correctif intérimaire
référence ce fichier) sans présumer des choix du cadrage détaillé à venir.

## 5. Décision de périmètre et découpage `[DÉCIDÉ 2026-09-17]`

Deux problèmes de nature différente étaient mélangés dans les §2/§3 initiaux — risques et fichiers
touchés n'ont rien à voir :

- **(a) Arbitrage de clic** (systèmes 1-2-3-4-5 du §2bis) — c'est le bug réel qui a déclenché le
  chantier. Contenu au mode jeu (`Canvas3D.jsx` + `EntityMesh.jsx` + `SurfaceDungeonScene.jsx`
  côté connecteurs), zéro dépendance sur le code combat.
- **(b) Cycle de vie d'un mode de visée** (curseur `useSceneCursor.js` + 5 `useEffect` Échap
  dupliqués + surbrillance) — orthogonal à (a) : touche directement les 4 modes de combat déjà
  validés en jeu réel, sans suite de tests automatisés (risque explicitement signalé au §3).

→ **Lot 1 = (a) seul.** Objectif : un seul raycast/une seule liste de candidats pour tokens +
entités (2 variantes) + connecteurs, en mode jeu uniquement, réutilisant l'ordre de priorité déjà
validé de la boucle manuelle (`handlePointerUp`) plutôt que d'inventer une nouvelle architecture.
Supprime au passage le couplage `justSelectedRef` (système 4) en le remplaçant par la même autorité
de priorité que le reste. Cadrage et code de ce lot uniquement, dans un tour dédié séparé de
celui-ci — pas dans la continuité de ce document de recensement.

→ **Lot 2 = (b), après le Lot 1 codé et confirmé en jeu réel.** Ne commence pas avant, pour ne
jamais mélanger une régression possible sur les modes de combat avec le lot qui vient de sortir.
Design cible probable (à confirmer au cadrage du Lot 2, pas ici) : une autorité unique « mode de
visée actif » façon pushdown automaton (*Game Programming Patterns*, chapitre State — déjà cité
§2), dont chaque mode porte son propre curseur/son annulation/sa priorité, remplaçant les 5
`useEffect` et la recopie manuelle des 5 états dans chaque consommateur.

## 6. `Editor3D.jsx` — explicitement hors des Lots 1 et 2

Le système 6 du §2bis (raycasting manuel séparé, `fast-voxel-raycast` + `THREE.Raycaster`) n'entre
dans aucun des deux lots ci-dessus :

- Il ne partage aucun code avec la boucle manuelle du mode jeu — le fusionner exigerait de refondre
  le raycasting du mode édition lui-même, un chantier distinct par nature (rendu, outils de pose,
  snapping grille), pas une extension de l'arbitrage de clic du mode jeu.
- Ce chantier existe déjà, cadré séparément : `docs/PLAN_WORLD_BUILDER_REWORK.md` (stub, cadrage
  non commencé). C'est là que toute unification du raycasting éditeur devra être conçue, pas ici —
  éviter que ce document ne redéfinisse un périmètre déjà possédé ailleurs.
- Ce n'est pas un report vague : si une unification mode jeu / mode édition s'avère un jour
  souhaitable, elle appartient au cadrage de `PLAN_WORLD_BUILDER_REWORK.md`, à faire pointer vers
  ce document (§2bis) pour l'état des lieux du côté mode jeu.
