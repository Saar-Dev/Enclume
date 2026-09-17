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

→ **Lot 1 = (a) seul.** Objectif : une seule autorité de priorité pour tokens + entités (2
variantes) + connecteurs, en mode jeu uniquement. Design détaillé et vérifié au §7 (remplace une
première version écartée — voir §7.0).

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

## 11. Régression trouvée en jeu réel — `aimModeActive` trop large `[CORRIGÉ 2026-09-17]`

Après clôture des Lots 1+2, test en combat réel par Saar : les caisses/éléments de décor
devenaient inutilisables pendant **tout son tour**, pas seulement pendant un clic de visée
ponctuel. Cause root : `combatMoveMode` (survol de déplacement ambiant, armé par défaut pour toute
la durée du tour via `useAutoMoveMode`/COMBAT-DEPLACEMENT-HOVER, jamais un geste ponctuel) avait
été inclus dans `aimModeActive` par symétrie avec les 4 autres modes (§7.1), sans revérifier que
le bug confirmé qui motivait ce garde ne concernait QUE tir/CaC/zone d'effet/LOS/déplacer-une-
entité — jamais le survol ambiant. Périmètre trop large dès l'écriture du Lot 1, pas une régression
du Lot 2.

**Correctif** : chaque entrée de `aimModes` porte désormais un champ `blocksEntityClick` explicite
(`Canvas3D.jsx`, définition de `aimModes`) — `true` pour les 4 modes de visée ponctuels, `false`
pour `combatMoveMode` seul. `aimModeActive = aimModes.some(m => m.active && m.blocksEntityClick)`.
Curseur et annulation Échap restent inchangés (toujours basés sur `active` seul, indépendant de ce
nouveau champ) — seul le clic entité est concerné.

## 7. Lot 1 — design vérifié `[VÉRIFIÉ 2026-09-17]`

### 7.0. Piste écartée : registre + raycast fait main

Première idée : sortir entités/connecteurs du système R3F déclaratif, les enregistrer dans un
registre partagé (ref miroir), et faire un `raycaster.intersectObjects(registre, true)` manuel
dans `handlePointerUp` pour retrouver « qui a été cliqué », trié par distance.

**Écartée après vérification** — trois faits, trouvés en lisant la doc R3F
([r3f.docs.pmnd.rs/api/events](https://r3f.docs.pmnd.rs/api/events)) et le code déjà présent :
1. R3F fait déjà exactement ça en interne : raycaster partagé, distribution du plus proche vers le
   plus loin, et `stopPropagation()` empêche la distribution aux objets plus lointains — le
   comportement recherché existe déjà, nativement, pour tout mesh avec un `onClick`.
2. `raycastGround`/`raycastWorldSupport` (`Canvas3D.jsx:821,833`) réutilisent déjà le `raycaster`
   fourni par `useThree()` — **pas un second raycaster** comme supposé au §3 initial ; la boucle
   manuelle et R3F partagent déjà la même instance.
3. Un registre fait main aurait dupliqué ce que R3F fournit gratuitement — contraire à l'invariant
   « ne jamais coder de zéro » : plus de code, plus de risque de régression sur les 6 packs
   d'assets, pour un résultat déjà obtenu par le mécanisme natif.

### 7.1. Root cause réelle, confirmée par relecture (pas supposée)

Le clic « caisse au lieu du token » (déclencheur du chantier) était déjà corrigé correctement par
le correctif intérimaire du 17/09 : le token a maintenant un `onClick` qui appelle
`stopPropagation()`, et R3F distribue nativement au plus proche d'abord — donc quand le token est
la géométrie la plus proche du rayon, son `onClick` gagne et bloque l'entité. **Ce correctif n'est
pas une rustine à défaire, c'est déjà la bonne mécanique.**

Ce qui reste réellement cassé, trouvé en vérifiant `handleEntityClick`
(`SessionPage.jsx:566-580`) contre les 5 modes de visée : **seul `moveTarget` est gardé** (ligne
567-571, `if (moveTarget) { setMoveTarget(null); return }`). Les 4 modes combat
(`combatMoveMode`/`combatTargetMode`/`combatAoeTargetMode`/`losMode`) n'ont **aucune** garde côté
entité — cliquer sur une caisse pendant un ciblage zone d'effet/CaC/tir/LOS ouvrirait quand même
son menu radial ou déclencherait son interaction, en plus (pas à la place) de ce que fait la boucle
manuelle pour ce mode. C'est une duplication de la même nature que celle déjà documentée au §2
(chaque consommateur recopie sa propre liste des 5 modes) — ici une copie **incomplète** (1 mode
sur 5), dans un fichier différent (`SessionPage.jsx`) de celui qui gère les 4 autres
(`Canvas3D.jsx`).

### 7.2. Design retenu — aligner les handlers déclaratifs sur l'autorité déjà existante

Pas de nouveau système : le point de vérité « un mode de visée est actif » existe déjà
(`useSceneCursor.js`, `Canvas3D.jsx:766`) sous forme de recopie. Lot 1 lui donne une seule
définition (`aimModeActive`, calculée une fois dans `Canvas3D.jsx` à partir des 5 états) et la
distribue :

1. **`EntityMesh.jsx`** : `onClick={!isPreview && !aimModeActive && onEntityClick ? ... : undefined}`
   (nouvelle prop `aimModeActive`, même garde que `isPreview` déjà en place ligne 344/492) —
   remplace le garde incomplet et mal placé de `SessionPage.jsx:567-571`, qui est supprimé.
2. **`ConnectorSegment`** (`SurfaceDungeonScene.jsx:1588`) : passage de `onPointerDown` à `onClick`
   — aligne sur le patron déjà utilisé par `EntityMesh` (un clic explicite, pas la phase descendante
   d'un geste qui pourrait devenir un pan/drag caméra) et ajoute la même garde `aimModeActive`.
   N'élimine pas, à lui seul, le bug documenté du `click` natif remontant au `<Canvas>` racine — voir
   point 3, gardé par prudence.
5. **`HoverIcon`** (`EntityMesh.jsx:545-580`) : même garde `aimModeActive` sur son `onClick` — sans
   ça, l'icône ⚙ resterait un deuxième chemin pour déclencher `onEntityClick` pendant un mode de
   visée, contournant la garde du point 1.
3. **`justSelectedRef` et `<Canvas onClick={handleCanvasClick}>` : conservés tels quels, pas
   touchés dans ce lot.** Écarté après vérification — j'avais d'abord proposé de les supprimer en
   supposant que le passage `onPointerDown`→`onClick` sur `ConnectorSegment` suffirait à empêcher le
   `click` natif de remonter jusqu'au `<Canvas>` racine. Impossible à garantir sans test en jeu réel
   (aucune trace, dans la doc R3F ou le code, de ce que `stopPropagation()` sur un événement
   synthétique R3F empêche réellement côté `click` natif délégué par React — la seule preuve
   observée dans ce fichier concerne `onPointerDown`, où ça NE marche PAS, d'où `justSelectedRef`).
   Le fait qu'`EntityMesh` n'ait jamais eu besoin de `justSelectedRef` ne prouve rien : son clic
   n'affecte jamais `surfaceConnectorPanel`, un bug identique y serait resté invisible. Sans pouvoir
   tester dans le navigateur (hors périmètre Claude), je garde le garde-fou existant — coûte zéro
   risque, la suppression n'aurait été qu'un gain cosmétique non vérifiable.
4. **Comportement « clic sur entité annule `moveTarget` » — vérifié déjà préservé sans code
   supplémentaire.** Relecture de la branche `moveTarget` de `handlePointerUp`
   (`Canvas3D.jsx:1213-1231`) : elle s'exécute sur **tout** clic pendant `moveTarget` (le raycast
   sol qu'elle utilise ignore l'occlusion par un mesh d'entité) et appelle déjà
   `onMoveCancel?.()` inconditionnellement. Le garde `if (moveTarget)` dans
   `handleEntityClick` (`SessionPage.jsx:568-570`) ne faisait donc qu'annuler une deuxième fois,
   en redondance — sa suppression (conséquence directe de la garde `aimModeActive`) ne change aucun
   comportement observable.

### 7.3. Ce que ce lot ne fait pas (et pourquoi)

- Le survol (`onPointerEnter`/`onPointerLeave` d'`EntityMesh`, icône ⚙) : aucune collision
  constatée avec un autre système, aucun bénéfice identifié à le toucher — laissé identique.
- Le token : son `onClick` (correctif du 17/09) reste tel quel, déjà correct (§7.1).
- Tout raycast/registre nouveau : inutile, R3F fait déjà le travail (§7.0).

### 7.4. Statut

**Codé et VALIDÉ EN JEU RÉEL 2026-09-17** (`Canvas3D.jsx`, `EntityMesh.jsx`,
`SurfaceDungeonScene.jsx`, `SessionPage.jsx`) selon le design ci-dessus, avec les corrections des
points 3/4 (§7.2). Vérifié : `npx eslint` sur les 4 fichiers → même total qu'avant modification (24
problèmes, 14 erreurs/10 avertissements, dette préexistante déjà documentée dans `Canvas3D.jsx`,
aucun nouveau) ; `npm run build` côté client → succès ; scénario de test §7.4bis rejoué par Saar →
« Fonctionnel ». **Lot 1 clos.**

Lot 2 (cycle de vie des modes de visée — curseur/Échap, §5) : cadrage non commencé, attend son
propre tour dédié, pas enchaîné à la suite de cette clôture.

### 7.4bis. Validation prévue

- Rejouer précisément le cas déclencheur (token proche d'une caisse, clic exact sur le token, clic
  exact sur la caisse) sur au moins 2 packs d'assets différents (pas seulement
  `futuristic_crates_chests`).
- Rejouer le cas nouvellement trouvé (§7.1) : ouvrir une caisse pendant chacun des 4 modes combat +
  `moveTarget` → doit être sans effet (mode prioritaire inchangé), pas une double action.
- Rejouer l'ouverture/fermeture d'une porte et d'un ascenseur (clic connecteur, clic dans le vide
  pour fermer le panneau) — cas exact du bug déjà documenté.
- Rejouer l'annulation de `moveTarget` par clic sur une entité (§7.2 point 4) — pas seulement par
  Échap.

## 9. Lot 2 — recensement et design `[VÉRIFIÉ 2026-09-17]`

### 9.0. Recensement précis (relecture, pas la mémoire de la session)

- **Curseur** (`useSceneCursor.js`, hook dédié, 1 seul appelant : `Canvas3D.jsx:1803`) : un
  `if/else` qui recopie les 5 états — déjà oublié une fois pour `moveTarget` (§2, corrigé en
  intérimaire).
- **Annulation Échap** (`Canvas3D.jsx:1848-1894`, dans le composant `Canvas3D` externe — pas
  `Scene`, le composant interne où vit `aimModeActive` du Lot 1) : 5 `useEffect` quasi identiques,
  un par mode, chacun son propre `document.addEventListener('keydown', ...)`.
- **`aimModeActive` (Lot 1)** vit dans `Scene` (interne, rendu dans le `<Canvas>` R3F) —
  **troisième copie indépendante** de la même union de 5 états, dans un composant différent des
  deux premières. Trois copies au lieu d'une, pas deux.
- **Asymétrie de forme entre les 5 « modes »** : `combatMoveMode`/`combatTargetMode`/
  `combatAoeTargetMode` portent leur propre méthode `.onCancel()` ; `moveTarget`/`losMode` non —
  leur annulation passe par un callback externe séparé (`onMoveCancel`, `onLosCancel`). Pas
  normalisé dans ce lot (toucherait la construction de ces objets dans `SessionPage.jsx`, hors
  gain réel) — un adaptateur trivial à la construction du tableau suffit.
- **« Mise en évidence de la cible » — vérifié, PAS une duplication à corriger.** Relecture des 4
  modes combat : chacun a déjà son propre retour visuel, différent par nature (ligne
  attaquant→cible pour `combatTargetMode`, `losLine` pour `losMode`, cône/cercle/segments pour
  `combatAoeTargetMode`, chemin surligné pour `combatMoveMode`) — parce qu'ils ciblent un
  **token/une position**, jamais une entité. `EntitySelectionHalo` est spécifique aux entités
  (caisses, portes) et n'a de sens que pour `moveTarget`, qui est le seul des 5 à viser une entité.
  Rien à unifier ici : le point « surbrillance » du stub (§2/§3) était une lecture prématurée —
  **retiré du périmètre du Lot 2**.
- **Hors périmètre, confirmé distinct** : l'Échap de `selectedTokenId` (`Canvas3D.jsx:1900-1905`,
  désélection — volontairement pas un mode de visée, patron RTS déjà tranché,
  [[project_selection_mj_acteur_entites]]) et l'Échap de `freeCameraOverride` (`:1832-1846`,
  caméra). Pas touchés.

### 9.1. Design — un tableau, pas un automate

Pas de classe FSM/pushdown automaton (le stub le suggérait comme référence, mais un automate serait
disproportionné pour 5 entrées déjà mutuellement exclusives en pratique — même leçon que le Lot 1 :
réutiliser le plus petit primitif correct). Un seul tableau ordonné, construit une fois dans le
composant `Canvas3D` externe (là où vivent déjà `useSceneCursor` et les 5 `useEffect`) :

```js
const aimModes = [
  { key: 'combatTargetMode',    active: !!combatTargetMode,          cursor: 'cible', onCancel: () => combatTargetMode.onCancel() },
  { key: 'combatAoeTargetMode', active: !!combatAoeTargetMode,       cursor: 'cible', onCancel: () => combatAoeTargetMode.onCancel() },
  { key: 'losMode',             active: !!losMode?.active,           cursor: 'cible', onCancel: () => onLosCancel?.() },
  { key: 'combatMoveMode',      active: !!combatMoveMode,            cursor: 'case',  onCancel: () => combatMoveMode.onCancel() },
  { key: 'moveTarget',          active: !!moveTarget,                cursor: 'case',  onCancel: () => onMoveCancel?.() },
]
```

Trois consommateurs, une seule définition :
1. **`aimModeActive`** = `aimModes.some(m => m.active)` — remplace la copie locale de `Scene`
   (Lot 1) ET la condition interne de `useSceneCursor.js`. Passé en prop à `<Scene
   aimModeActive={aimModeActive} .../>` au lieu d'être recalculé dedans.
2. **Curseur** : `useSceneCursor(aimModes)` — signature changée (prend le tableau, plus les 5 props
   nommées) ; garde le même ordre de priorité qu'aujourd'hui (`cible` avant `case` — les 3
   premières entrées du tableau) — pas un scan brut dans l'ordre du tableau, un groupement explicite
   par `cursor` pour rester auditable plutôt que de dépendre implicitement de l'ordre.
3. **Échap** : un seul `useEffect`, qui sur Échap appelle `onCancel()` de **chaque** entrée
   actuellement active (`aimModes.filter(m => m.active).forEach(m => m.onCancel())`) — reproduit
   exactement le comportement actuel (5 listeners indépendants sur `document`, qui se
   déclencheraient tous les 5 si, anormalement, plusieurs modes étaient actifs en même temps),
   plutôt que de n'en annuler qu'un seul par une supposition de priorité non vérifiée.

### 9.2. Ce que ce lot ne fait pas

- Pas de fusion avec l'arbitrage de clic du Lot 1 (déjà fait, déjà validé — ce tableau est
  nouveau et distinct, même s'il partage la même liste de 5 états).
- Pas de retour sur la « surbrillance » (§9.0 — vérifié non nécessaire).
- Pas de normalisation de la forme `.onCancel()` vs callback externe (§9.0 — gain nul, risque nul
  à laisser tel quel derrière l'adaptateur du tableau).

### 9.3. Validation prévue

- Rejouer Échap sur chacun des 5 modes séparément (annulation effective, pas de régression).
- Vérifier le curseur affiché pour chaque mode (`cible` pour cible/AOE/LOS, `case` pour déplacement
  combat/déplacement d'entité) — inchangé visuellement.
- `npx eslint` + `npm run build` avant de rendre la main.

### 9.4. Statut

**Codé, lint/build vérifiés, commité et poussé** (`b373410`, `dev/Saar`) 2026-09-17, avec la
correction `blocksEntityClick` du §11 dans le même commit (les deux modifient le même tableau
`aimModes`, non séparables sans coût disproportionné).

**Validation réelle partielle** — le détour de session (fenêtres de déclaration coincées derrière la
timeline, déplacement combat cassé, occupation circulaire côté moteur monde — bugs sans rapport
avec ce plan, cf. mémoire `project_combat_window_drag_handle`) a exercé en profondeur Échap/curseur
pour `combatMoveMode`
(désarmement/réarmement observé des dizaines de fois dans les logs BUG-DEPLACEMENT1) et la garde
`blocksEntityClick` (caisses utilisables pendant le tour, confirmé). **Non rejoué explicitement** :
Échap + curseur pour `combatTargetMode`, `combatAoeTargetMode`, `losMode`, `moveTarget` — la
checklist §9.3 pour ces 4 modes reste à cocher en jeu réel avant de considérer le chantier
entièrement clos, même si le code est identique en nature à ce qui a déjà été exercé pour
`combatMoveMode`.

## 10. Note annexe — fichier parasite trouvé pendant le recensement

`client/src/components/EntityMesh jsx.md` (espace dans le nom, extension `.md`) : semble être une
copie ancienne d'`EntityMesh.jsx` collée dans un fichier Markdown, jamais importée nulle part
(vérifié : aucune référence dans le code). Housekeeping, hors périmètre de ce chantier — à
supprimer à l'occasion, signalé ici pour ne pas le perdre.
