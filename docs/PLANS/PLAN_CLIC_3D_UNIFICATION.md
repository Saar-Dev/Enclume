# PLAN_CLIC_3D_UNIFICATION.md — Fusion de la détection de clic 3D (tokens / entités / connecteurs)

> **Stub — 2026-09-17.** Chantier identifié pendant le durcissement de la sélection MJ pour les
> interactions d'entité. Cadrage détaillé **non commencé** — ce document capture le déclencheur,
> l'état connu et le correctif intérimaire déjà en place, pour que la conversation de cadrage
> dédiée démarre avec un ancrage, sans redécouvrir ce qui a déjà été vérifié.
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

## 4. Hors périmètre de ce document

Aucune implémentation ici — ce stub ferme la boucle de traçabilité (le correctif intérimaire
référence ce fichier) sans présumer des choix du cadrage détaillé à venir.
