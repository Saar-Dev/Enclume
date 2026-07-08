# PLAN — Dice Rework 3 : Recalibration D10 / D100
> Session 141 (suite 5) — 2026-07-08 — Statut : ✅ TERMINÉ — SR + fonctionnel confirmé Saar

**Résultat final** — valeurs réelles calibrées via harnais `/dev/dice-calibration` (Lot 2, retiré au
Lot 4) :
```
D10_GLB_NORMALS (d10, 1-10) : voir client/src/lib/diceMath.js
D10T_FACE_GLB   (d10_tens, 0-90) : voir client/src/lib/diceMath.js
```
**Testé :** dérivation `d10_units` (référence stricte vs `d10`), bijection 0-9 vérifiée des deux
côtés, ESLint 0 erreur introduite sur les 3 fichiers touchés (2 warnings préexistants confirmés via
`git stash`), SR + jet D100 réel en session confirmé fonctionnel par Saar.
**Non testé :** scénarios limites détaillés un par un (00/100, doublons), retrait de dé en cours
d'animation, D12/D20 (hors scope, non retouchés).

---

## Contexte

Signalement Saar : le D100 (percentile) n'a jamais été correctement affiché dans l'animation 3D —
faces non alignées, et le résultat serveur ne correspond pas au résultat affiché par l'animation
(exemple vécu : serveur roll=1 → affiché "30 + 7"). Le dé des unités est également décrit comme
visuellement cassé.

**Rework 1** (`docs/Old/Dice rework.md`) et **Rework 2** (`docs/Old/Planification DiceRewok2/`) ont
posé l'architecture actuelle (backtracking déterministe, `.glb` pré-texturés, `FACE_NORMALS` par
dé). Ce rework 3 ne touche pas cette architecture — il corrige une calibration de données.

---

## Diagnostic [VÉRIFIÉ] — instrumenté avant tout code

Méthode : exécution réelle de `tools/inspect-glb.js` sur les fichiers `.glb` actuellement commités
(`client/public/models/*.glb`) — calcul des normales géométriques réelles par triangle (K-means) +
extraction de la texture atlas baked, comparé aux tables `FACE_NORMALS` de `client/src/lib/diceMath.js`.

| Dé | Table code | Résultat vérifié |
|---|---|---|
| D4 | `D4_GLB_NORMALS` | ✅ Matche exactement le fichier réel |
| D6 | `D6_FACE_NORMALS` | ✅ Matche exactement (axes propres) |
| D8 | `D8_GLB_NORMALS` | ✅ Matche (arrondi près) |
| D10 / D10_units | `D10_FACE_GLB` / `D10U_FACE_GLB` | ❌ Aucune correspondance avec `D10.glb` réel |
| D10_tens (D100) | `D10T_FACE_GLB` | ❌ Jamais calibré indépendamment — copie de `D10U_FACE_GLB` ×10 |
| D12 | `D12_GLB_NORMALS` | Hors scope — confirmé fonctionnel en usage réel par Saar (affichage = serveur, face alignée caméra), malgré un écart apparent en inspection offline (résultat offline non fiable ici, pas d'action) |
| D20 | `D20_GLB_NORMALS` | Hors scope — calibré manuellement Session 65, fonctionne, **on n'y touche pas** |

`git log` confirme `D10.glb`/`D100.glb` inchangés depuis leur ajout (Session 65, commit `3c2842f`,
même commit qui a introduit les tables actuelles) — donc pas un fichier remplacé après coup : la
calibration d'origine était fausse dès sa création pour ces deux fichiers.

---

## Problème d'architecture (relevé par Saar)

`GLB_PATHS.d10` et `GLB_PATHS.d10_units` pointent **vers le même fichier** `D10.glb` — c'est
littéralement le même dé physique. Le code actuel maintient pourtant **deux tables séparées et
dupliquées à la main** (`D10_FACE_GLB` clés 1-10, `D10U_FACE_GLB` clés 0-9, mêmes normales
recopiées) : deux endroits à maintenir pour une seule géométrie, donc deux occasions de diverger.

`D10T_FACE_GLB` (D100.glb, dizaines) est un **fichier différent** — même géométrie sous-jacente
(vérifié : normales identiques entre `D10.glb` et `D100.glb`), mais sérigraphie indépendante. Le
code actuel dérive `D10T_FACE_GLB` de `D10U_FACE_GLB` par simple ×10 — hypothèse jamais vérifiée.

---

## Recherche — bonnes pratiques (avant de coder from scratch)

Demande explicite Saar : ne pas recoder à l'aveugle, s'appuyer sur l'expérience de libs pro.

- **[byWulf/threejs-dice](https://github.com/byWulf/threejs-dice)** (fork maintenu de la lib
  historique threejs-dice/cannon.js) — lu le code source réel (`lib/dice.js`). Leur algorithme de
  détection de face ("upside value") : pour chaque face, normale calculée **génériquement depuis la
  géométrie** (`cross(cb, ab)` sur les vertices du triangle), puis à l'exécution ils cherchent la
  normale la plus proche du vecteur "haut" via `.angleTo()` (= le même principe que notre
  `setFromUnitVectors` dans `DiceMesh.jsx`, juste inversé : eux détectent la face après une vraie
  simulation physique, nous forçons la face avant via SLERP/backtracking). **Confirmation utile** :
  notre architecture de rendu (normale de face → orientation caméra) est déjà le pattern standard de
  l'industrie. Le bug n'est pas dans `DiceMesh.jsx`/`DiceRoller.jsx`, uniquement dans la donnée
  (quelle normale correspond à quelle valeur) — aucun changement d'architecture de rendu à prévoir.
  Différence clé avec nous : leur mapping face→valeur est **assigné au moment de la construction
  procédurale de la géométrie** (le même code qui construit la face i lui assigne `materialIndex = i`),
  donc jamais besoin de "deviner" après coup. Ce n'est **pas directement applicable** à nos dés
  D10/D100 : ce sont des `.glb` opaques peints par un artiste 3D (vérifié : un seul mesh nommé
  `Конус.023`, un seul matériau `Dice_bloodybone`, **aucune métadonnée par face** dans le glTF —
  contrôlé directement dans le fichier binaire, pas supposé). On ne peut pas éviter une calibration
  a posteriori pour un asset externe non structuré — mais on peut la rendre fiable (voir méthode
  ci-dessous) au lieu de deviner sur une image plate.
- **[3d-dice/dice-box](https://github.com/3d-dice/dice-box)** — README consulté : le mapping
  face→valeur pour les modèles externes n'est pas documenté publiquement (renvoie à leurs thèmes
  CC0 et à une doc externe non accessible ici). Pas d'enseignement exploitable trouvé.
- **Piste vérifiée et écartée** : les fichiers `.glb` embarquent une rotation sur le node
  (`D10.glb`/`D100.glb` ont un `node.rotation` non nul dans le JSON glTF — vérifié par lecture
  binaire directe). Hypothèse initiale : notre code ignore cette rotation (`DiceMeshGlb` ne prend
  que `meshNode.geometry`, jamais la transform du node). **Écartée** : `D8.glb` a aussi un
  `node.rotation` non nul et sa table (`D8_GLB_NORMALS`) matche pourtant parfaitement le fichier
  réel — donc cette rotation est ignorée de façon cohérente pour tous les dés (calibration et rendu
  utilisent tous les deux l'espace local brut), ça ne joue pas ici. Pas une piste à creuser.
- **Source de vérité secondaire disponible si ambiguïté pendant la calibration** :
  `Ressources/Dice Set/1k/Dice.blend` et `4k/Dice.blend` (fichiers Blender d'origine, commités
  Session 65) — permettent de lire une face directement dans Blender si un chiffre reste ambigu au
  rendu (cursive, rotation serrée). Pas la méthode principale (évite de rouvrir Blender pour 20
  valeurs), mais dispo en filet de sécurité.
- **[Dice So Nice!](https://gitlab.com/riccisi/foundryvtt-dice-so-nice)** (module Foundry VTT de
  référence pour les dés 3D animés déterministes — le cas d'usage le plus proche du nôtre, TTRPG +
  D100 = 2×D10). Code source réel lu (`module/DiceModels.js`) : leur D10 assigne les valeurs
  directement dans le fichier de construction géométrique —
  `"faceValues":[1,2,5,10,7,4,3,8,9,6]` — au même endroit que l'ordre des faces. Confirme que
  **le D100 n'existe pas comme modèle à part chez eux non plus** (absent de `DiceModels.js` — seuls
  d2/d4/d6/d8/d10/d12/d20) : un jet percentile = 2 jets de d10, exactement notre architecture
  (`decomposeDice` en `d10_tens`+`d10_units`).
  **Piste écartée par Saar (décision définitive, pas à rouvrir)** : leur pattern "valeurs assignées
  à la construction" ressemble à notre code mort `createD10Geometry()`/`D10_KITE_VALUES` — j'avais
  proposé de le réactiver (dés procéduraux) au lieu de recalibrer les `.glb`. **Rejeté par Saar,
  raisons concrètes** : les dés générés procéduralement sont visuellement médiocres et non
  personnalisables, et le D20 procédural s'était avéré **impossible à texturer proprement**
  (contrainte de table UV) — c'est très probablement la raison même du passage aux `.glb` en
  Session 65 (`docs/ASBUILT.md`, tableau "Dice Rework", confirme que D4/D6/D8/D12/D10 étaient encore
  procéduraux avant cette session). On reste définitivement sur `.glb` pour tous les dés — le code
  mort D10 procédural est purement à supprimer (Lot 1bis), pas à réactiver.
- **Dette de documentation trouvée en marge** : le tableau "Dice Rework" de `docs/ASBUILT.md`
  (~ligne 426-432) est **obsolète** — il décrit encore D4/D6/D8/D12 en géométrie procédurale et
  D10/D100 en "Trapezohedron custom, Html overlay V1", alors que `GLB_PATHS` couvre aujourd'hui tous
  les dieType sans exception. Jamais mis à jour après la bascule complète vers les `.glb`. Hors
  scope du bug actuel — à corriger en fin de chantier (voir section finale).

---

## Scope

**Inclus** : `d10` (jet seul), `d10_units` + `d10_tens` (composants d'un jet `d100`).
**Exclu** : D12, D20 (fonctionnels, confirmés par Saar / déjà calibrés manuellement — on n'y touche
pas dans ce chantier).

---

## Architecture cible

1. **Table canonique unique pour `D10.glb`** — une seule source de vérité, `D10_GLB_NORMALS` (clés
   1-10, valeur physique imprimée sur le dé), remplace `D10_FACE_GLB` + `D10U_FACE_GLB`.
   Mécanisme retenu (tranché) : une table dérivée **calculée une fois au chargement du module**
   (pas un cas spécial dans `getFaceNormal`) —
   ```js
   const D10_UNITS_DERIVED = Object.fromEntries(
     Object.entries(D10_GLB_NORMALS).map(([k, v]) => [k === '10' ? '0' : k, v])
   )
   ```
   `FACE_NORMALS['d10'] = D10_GLB_NORMALS`, `FACE_NORMALS['d10_units'] = D10_UNITS_DERIVED` —
   `getFaceNormal()` reste inchangée (lookup générique), aucun cas spécial ajouté.
   **Testable indépendamment du Lot 3** : `getFaceNormal('d10_units', 0)` doit être strictement
   égal (référence, même array) à `getFaceNormal('d10', 10)` — vérifiable avant même d'avoir les
   vraies normales calibrées (sépare le risque "mécanique de dérivation" du risque "valeurs
   correctes"). `diceMath.js` est ESM (`export`) : le test isolé se fait via `import()` dynamique,
   pas `node -e` + `require`.
2. **Table indépendante pour `D100.glb`** (`D10T_FACE_GLB`) — calibrée séparément sur son propre
   fichier, pas dérivée par hypothèse de `D10.glb`.
3. Zéro changement sur `DiceMesh.jsx`/`DiceRoller.jsx`/`decomposeDice` — le bug est une donnée de
   calibration, pas un problème de pipeline (le pipeline decompose/orchestration a été relu et est
   correct : `decomposeDice` calcule bien tens=0/units=1 pour un roll serveur de 1 ; confirmé aussi
   par la recherche ci-dessus — notre algorithme de rendu suit le même principe que les libs pro).

---

## Méthode de calibration — éviter le travail "à la main" laborieux (retour D20 Session 65)

`inspect-glb.js` donne déjà, de façon déterministe et reproductible, les 10 normales de cluster
réelles de `D10.glb` (identiques pour `D100.glb`). Le seul inconnu est **quelle valeur imprimée**
correspond à quelle normale — et ça, ça ne se devine pas de façon fiable depuis un crop PNG de
chiffres cursifs pivotés (testé, ambigu 6/9 notamment).

**Vecteurs verrouillés** (figés dans cette session, ne pas relancer `inspect-glb.js` pour le Lot 2 —
l'ordre des clusters n'est pas stable d'un run à l'autre, seul l'ensemble des 10 vecteurs l'est) :

```
N1  [-0.4955, -0.5381,  0.6819]     N6  [ 0.8017, -0.5381, -0.2604]
N2  [ 0.4955,  0.5381, -0.6819]     N7  [ 0.4954, -0.5381,  0.6819]
N3  [ 0.0000,  0.5381,  0.8429]     N8  [-0.4954,  0.5381, -0.6819]
N4  [ 0.0000, -0.5381, -0.8429]     N9  [-0.8016, -0.5381, -0.2605]
N5  [-0.8017,  0.5381,  0.2604]     N10 [ 0.8016,  0.5381,  0.2605]
```
(Identiques pour `D10.glb` et `D100.glb` — géométrie confirmée identique entre les deux fichiers.)

Proposition : un composant de calibration **autonome** (pas `DiceMesh` — on ne veut pas dépendre de
la couche `getFaceNormal`/`FACE_NORMALS`/animation qu'on ne calibre pas encore) : charge le `.glb`
via `useGLTF`, prend une normale brute en prop, applique directement
`setFromUnitVectors(normal, camDir.negate())` en **pose statique immédiate** (pas de SLERP/bounce —
inutile pour lire un chiffre), affiche "N3/10" à l'écran. Pas de formulaire de saisie — Saar lit le
chiffre réellement rendu par Three.js et le dicte dans le chat, j'écris la table. Deux passes : `d10`
(10 valeurs) puis `d100`/`d10_tens` (10 valeurs, mêmes N1-N10, texture différente).

**Limite honnête** : `setFromUnitVectors` ne contraint que l'axe de la normale, pas la rotation
autour (le "clocking") — un chiffre peut apparaître tourné/peu lisible selon l'angle obtenu. Le
harnais reproduit fidèlement ce qu'un joueur verrait (donc pas un problème caché), mais ça ne
garantit pas une lecture instantanée à 100% pour les 20 valeurs — si un chiffre reste ambigu,
pivoter temporairement la caméra du harnais pour le lire, ou recouper avec `Ressources/Dice Set/
*/Dice.blend`. Toujours plus rapide et plus fiable que la lecture sur crop PNG plat (testé, source
d'erreurs 6/9 notamment) ou que la procédure Blender manuelle complète du D20.

---

## Lots

### Lot 1 — Consolidation architecture (table unique D10.glb)
- `client/src/lib/diceMath.js` : fusionner `D10_FACE_GLB`/`D10U_FACE_GLB` en `D10_GLB_NORMALS` +
  `D10_UNITS_DERIVED` calculée au chargement du module (voir mécanisme figé ci-dessus).
  **Valeurs de normales encore fausses à ce stade** — lot purement structurel, zéro changement de
  comportement visuel attendu tant que le Lot 3 n'est pas fait.
- Vérification isolée (avant Lot 3) : `node -e` confirmant `getFaceNormal('d10_units', 0) ===
  getFaceNormal('d10', 10)` (référence stricte) sur les valeurs actuelles (fausses mais peu importe
  ici — seule la mécanique de dérivation est testée).
- Fichiers touchés : `client/src/lib/diceMath.js` uniquement.

### Lot 1bis — Nettoyage code mort D10 procédural (tranché : suppression, on reste sur `.glb`)
- `client/src/lib/diceMath.js` : suppression `D10_KITE_NORMALS`/`D10_KITE_VALUES`/
  `D10_FACE_VALUES`/`D10_UNITS_FACE_VALUES`/`D10_TENS_FACE_VALUES` et leurs exports — jamais appelés
  depuis que `GLB_PATHS` couvre `d10`/`d10_units`/`d10_tens` (le routeur `DiceMesh` choisit toujours
  `DiceMeshGlb`, jamais `DiceMeshProcedural`, pour ces trois dieType).
- `DiceMesh.jsx` : suppression de la branche `dieType === 'd10' || 'd10_units' || 'd10_tens'` dans
  `DiceMeshProcedural` (même raison — code inatteignable) + `createD10Geometry()` si plus référencée
  ailleurs après ce retrait (à vérifier lors du lot, y compris l'overlay Html D10 devenu obsolète).
- Fait après le Lot 3 (calibration réelle validée), pas avant — garde un filet de repli exploitable
  tant que la recalibration `.glb` n'est pas confirmée fonctionnelle par Saar.
- Fichiers touchés : `client/src/lib/diceMath.js`, `client/src/components/DiceMesh.jsx`.

### Lot 2 — Harnais de calibration temporaire
- Nouvelle route temporaire (ex. `/dev/dice-calibration`, `ProtectedRoute` comme le reste de
  `App.jsx`) montant un `<Canvas>` — **doit reproduire la caméra et l'éclairage réels de
  `Canvas3D.jsx`** (`camera={{position:[15,15,15], fov:60}}`, `ambientLight intensity=0.8` +
  `hemisphereLight` + 2 `directionalLight`), pas les défauts R3F — sinon le "clocking" lu pendant la
  calibration ne correspondrait pas à ce que les joueurs voient réellement en jeu.
- **Composant de calibration dédié, autonome** (pas `DiceMesh`/`getFaceNormal` — voir méthode
  ci-dessus) : `useGLTF('/models/D10.glb')` ou `D100.glb`, normale reçue en prop, pose statique
  immédiate via `setFromUnitVectors`. Cycle manuel ou automatique sur les 10 vecteurs verrouillés.
  Zéro dépendance sur `diceMath.js` — fichier 100% nouveau et isolé.
- Fichiers touchés (temporaires, tous retirés au Lot 4) : `App.jsx` (route), 1 nouveau composant de
  page dev, 1 nouveau composant de calibration.

### Lot 3 — Calibration réelle + écriture des tables
- Saar lit les 20 valeurs (10 pour `D10.glb`, 10 pour `D100.glb`) via le harnais Lot 2.
- Écriture des tables finales corrigées dans `diceMath.js`.

### Lot 4 — Nettoyage + tests
- Suppression du harnais de calibration (Lot 2) + route temporaire `App.jsx`.
- Exécution du Lot 1bis (suppression code mort D10 procédural), maintenant que la recalibration
  `.glb` est confirmée fonctionnelle.
- Scénarios de test (voir ci-dessous).

---

## Scénario de test (à valider après Lot 4)

- Jet `d10` seul × plusieurs valeurs (1, 5, 10) → face affichée = valeur serveur (chat).
- Jet `d100` × plusieurs valeurs couvrant les cas limites (1 → "01", 100 → "00", 45, 70) → tens +
  units affichés = décomposition exacte du total serveur.
- Confirmation visuelle navigateur Saar.

---

## Non concerné par ce plan

- D12, D20 : hors scope (voir section Scope).
- Bug UI3 (`docs/BUGIDENTIFIE.md`, affichage chat D100) : à re-vérifier une fois la calibration 3D
  faite — peut se résorber de lui-même ou être un bug distinct (chat ≠ animation), à traiter après
  ce chantier si encore présent.
- **Dette doc** `docs/ASBUILT.md` tableau "Dice Rework" (~ligne 426-432) obsolète depuis la bascule
  complète vers `.glb` — à mettre à jour en fin de chantier (fin de session, comme tout `.md`
  modifié/concerné, règle CLAUDE.md).
