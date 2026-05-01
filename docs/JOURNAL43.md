# JOURNAL43.md — Session 43 — Mémoire externe vérifiée
> Créé au fil de la lecture des fichiers. Mis à jour après chaque vérification.
> Règle : rien n'entre ici sans avoir été lu dans le fichier réel cette session.

---

## Fichiers lus et vérifiés

### 1. index.js (server/src/socket/index.js) — LU INTÉGRALEMENT ✅

**Ce qui est présent et correct :**
- isDiagonal + validation géométrie (l.900-901) ✅
- Validation corners D&D dans la boucle si isDiagonal (l.1033-1045) ✅
- isSuccess = diceRoll <= chancesDeReussite (l.946) ✅
- mr = chancesDeReussite - diceRoll (l.947) ✅
- dmax = isSuccess ? getDmax(mrTable, mr) : 0 (l.949) — PAS de +1, conforme décision finale ✅
- guard stepsCompleted === 0 (l.1060-1071) ✅
- interactionType: 'displacement' dans broadcast DICE_RESULT (l.977) ✅
- getMrTable() / getDmax() corrects (l.35-47) ✅
- PE2 respecté : socket.data.role stocké au SESSION_JOIN (l.79) ✅
- PE12 respecté : clearTimeout + delete dans ENTITY_ACTION_RESOLVE (l.602-603) ✅
- PE22 respecté : excludeIds = [tokenId, entityId] (l.1005) ✅
- PE26 respecté : resolveEntityState returning inclut battlemap_id (l.1191) ✅
- pendingEntityActions : Map déclarée hors initSocket (l.29) ✅
- Guard double-soumission entityId (l.842-844) ✅
- dmax_override appliqué après calcul (l.952-954) ✅

**CE QUI EST CASSÉ — CONFIRMÉ :**
- Bloc Tchebychev TOUJOURS PRÉSENT (l.1047-1053) ← CAUSE DU BUG
  ```js
  const distTchebychev = Math.max(
    Math.abs(nextEntityPosX - nextActorPosX),
    Math.abs(nextEntityPosY - nextActorPosY),
  )
  if (distTchebychev > 1) break
  ```
  Cette vérification est incorrecte : entité et acteur avancent ENSEMBLE (même dirPosX/dirPosY),
  donc la distance entre eux = constante = distance initiale.
  Si distance initiale > 1 → break au premier pas de TOUTES les réussites.
  À SUPPRIMER entièrement.

**Autres observations :**
- ENTITY:MOVED handler (l.813-820) : broadcast simple, GM uniquement — pas de lien avec le déplacement joueur
- resolveEntityState (l.1174-1205) : correcte, indépendante du mouvement

---

### 2. Canvas3D.jsx (client/src/components/Canvas3D.jsx) — LU INTÉGRALEMENT ✅

**Ce qui est présent et correct :**
- threeToDb() défini (l.38-40) ✅
- TokenRing avec useFrame — pattern existant pour Lerp futur ✅
- PE21 : rotationY = (token.r ?? 0) * Math.PI / 4 (l.99) ✅
- PE16 : e.code AltLeft/AltRight (l.629-632) ✅
- P40 : ghostRef + tokensRef pattern (l.218-220) ✅
- Ghost PlaneGeometry(1,1) wireframe (l.570-574) ✅
- Couleur ghost : vert si dotResult !== 0, rouge si = 0 (l.566) ✅
- Ghost hauteur : getColumnTopY(x,z) + 1 + 0.05 (l.567) ✅
- handlePointerUp : emit ENTITY_MOVE_REQUEST avec destZ = gp.z (l.410-418) ✅
- PE14 respecté dans handlePointerMove : pos_y base = Z Three.js (l.338) ✅
- socket dans deps de handlePointerUp (l.470) ✅

**CE QUI N'EST PAS FAIT — CONFIRMÉ :**
- Snap toujours 4 axes orthogonaux (l.341-347) — PAS de diagonal 8 axes
  ```js
  if (Math.abs(dPosX) >= Math.abs(dPosZ)) {
    snapX = Math.round(worldPos.x)
    snapZ = moveTarget.entity.pos_y   // fixé sur Z de l'entité
  } else {
    snapX = moveTarget.entity.pos_x   // fixé sur X de l'entité
    snapZ = Math.round(worldPos.z)
  }
  ```
  À remplacer par snap 8 axes avec ratio 2:1 (PLAN_ENTITY.md §9).

- Lerp : ABSENT. TokenMesh et EntityMesh reçoivent des positions fixes, pas d'animation.
  TokenMesh (l.81-187) : position calculée statiquement depuis token.pos_x/y/z.
  Aucun useFrame de Lerp. À implémenter.

**Observations importantes pour le Lerp futur :**
- TokenMesh reçoit `token` en prop et calcule baseX/Y/Z directement (l.85-87)
- dragState est un state React qui overrride la position (l.90-92)
- useFrame existe dans TokenRing (l.50-64) — le pattern est là
- Pour le Lerp : pattern = ref pour position animée, state seulement à la fin (Risque 1 CONSEILS 9F-C)

---

### 3. Sidebar.jsx (client/src/components/Sidebar.jsx) — LU INTÉGRALEMENT ✅

**Ce qui est présent et correct :**
- Bifurcation displacement/skillcheck confirmée (l.904) ✅
  - `if (msg.interactionType === 'displacement')` → rendu "Jet de Force : X"
  - Sinon → rendu skillcheck standard
- `t('sidebar.displacementJet', { attr: msg.skillLabel })` (l.917) ✅
- `t('sidebar.displacementDetail', { dif, seuil })` (l.922) ✅
- Badge SUCCÈS/ÉCHEC présent dans la branche displacement (après l.922) ✅
- handleConfigSave correcte (l.475-500) ✅
- Aucune modification de Sidebar nécessaire pour 9F-C ✅

---

## Fichiers restant à lire

- [x] client/src/pages/SessionPage.jsx ✅
- [x] client/src/locales/fr/translation.json ✅

---

## Décisions confirmées pour cette session

| Décision | Source |
|---|---|
| dmax = getDmax(mrTable, mr) — PAS de +1 | JOURNALTEMP confirmé + code vérifié |
| Bloc Tchebychev à supprimer de index.js | JOURNALTEMP + analyse code |
| Snap 4 axes → 8 axes dans Canvas3D | PLAN_ENTITY.md §9 + code vérifié |
| Lerp 300ms absent — à implémenter | Code vérifié |
| Sidebar ne nécessite pas de modification | Code vérifié |

---

### 4. SessionPage.jsx — LU INTÉGRALEMENT ✅

**Ce qui est présent et correct :**
- `moveTarget` state : `null | { entity, interaction, tokenId }` (l.73) ✅
- `handleEntityMove` : trouve actorToken, setMoveTarget, setRadialMenu(null) (l.517-527) ✅
- `handleMoveCancel` : `useCallback(deps [])` stable — ne se recrée jamais (l.572-574) ✅
- `handleTokenRotate` : émet TOKEN_ROTATE avec socket dans deps (l.566-568) ✅
- `ENTITY_MOVE_RESULT` listener (l.417-427) :
  - `setMoveTarget(null)` ✅
  - `addMessage` système ✅
  - Destructure : `{ mr, dmax, success }` ✅
- `interactionType` correctement destructuré dans DICE_RESULT handler (l.342) ✅
- `interactionType` propagé dans addMessage (l.360) ✅
- `handleEntityClick` déclaré APRÈS `handleEntityMove` et `handleEntityAction` (l.533) — P4 respecté ✅
- P7 respecté : reconnectTrigger pattern présent (l.695) ✅
- `handleMoveCancel` passé à Canvas3D (l.643) ✅
- `moveTarget` passé à Canvas3D (l.642) ✅

**Observations :**
- `actorToken` recherché via `characters.find(c => c.id === t.character_id && c.user_id === user?.id)` (l.853-855) — même logique dans handleEntityMove (l.518-520) — cohérent
- Le handler `ENTITY_MOVE_RESULT` ne reçoit pas `finalEntityPos` / `finalActorPos` — pas utilisés pour le Lerp depuis SessionPage. Le Lerp sera déclenché par `ENTITY_MOVED` et `TOKEN_MOVED` dans Canvas3D (listeners l.268-284 de Canvas3D). C'est le bon endroit.
- SessionPage ne nécessite AUCUNE modification pour 9F-C ✅

---

### 5. fr.json (client/src/locales/fr/translation.json) — LU INTÉGRALEMENT ✅

**Ce qui est présent et correct :**
- `sidebar.displacementJet` : `"Jet de {{attr}} :"` ✅
- `sidebar.displacementDetail` : `"Difficulté {{dif}} · Seuil : {{seuil}}"` ✅
- `sidebar.entityActionSuccess` : `"SUCCÈS"` ✅
- `sidebar.entityActionFail` : `"ÉCHEC"` ✅
- `entity.movePush` : `"Pousser"` ✅
- `entity.movePull` : `"Tirer"` ✅
- `entity.moveImpossible` : `"Impossible"` ✅
- `entity.moveSuccess` : `"Déplacement réussi (MR {{mr}}, {{dmax}} case(s))"` ✅
- `entity.moveFail` : `"Déplacement échoué (MR {{mr}})"` ✅

**fr.json ne nécessite AUCUNE modification pour 9F-C ✅**

---

### 6. EntityMesh.jsx — LU INTÉGRALEMENT ✅

**Architecture critique pour le Lerp :**
- `EntityMesh` reçoit `entity` en prop (l.35)
- `posX/posY/posZ` calculés depuis `entity.pos_x/pos_y/pos_z` directement dans le composant (l.51-53) :
  ```js
  const posX = (entity.pos_x ?? 0) + width  / 2
  const posY = (entity.pos_z ?? 0) + height / 2   // PE14
  const posZ = (entity.pos_y ?? 0) + depth  / 2   // PE14
  ```
- Ces valeurs sont passées aux sous-composants `EntityMeshVoxel` et `EntityMeshGlb`
- Le `<group position={[posX, posY, posZ]}>` est dans les sous-composants

**Conclusion pour le Lerp entité :**
`EntityMesh` n'a pas de `useFrame`. La position Three.js est calculée statiquement
depuis `entity.pos_x/y/z` à chaque render. Quand `ENTITY_MOVED` arrive → store mis à jour →
`entity` prop change → nouveau render → téléportation instantanée.
Pour le Lerp, deux options :
- **Option A** : ajouter un `useFrame` dans `EntityMeshVoxel`/`EntityMeshGlb` avec une ref cible
- **Option B** : ajouter le Lerp dans `EntityMesh` lui-même via un wrapper group + ref

**Option B préférable** : modifier `EntityMesh` uniquement, pas les deux sous-composants.
La position Three.js finale sera pilotée par une ref animée, `posX/posY/posZ` deviennent
la cible du Lerp — pas la position rendue.

**`useFrame` non importé dans EntityMesh.jsx** — il faudra l'ajouter à l'import (l.1).
Import actuel : `import React, { useState, useMemo, useRef, useEffect } from 'react'`
+ `import { useGLTF, Html } from '@react-three/drei'`
Il faudra ajouter : `import { useFrame } from '@react-three/fiber'`

**Autres observations :**
- PE11 respecté (l.42-43) ✅
- PE14 respecté (l.51-53) ✅
- PE4 respecté (l.156-163) ✅
- P23 adapté — hitbox élargie (l.183-188) ✅
- P20 respecté dans EntityMeshGlb (l.242) ✅
- HoverIcon toujours montée — pattern correct (l.319) ✅

---

## Analyse pattern Lerp — résultat run à vide

### Pattern useFrame existant (TokenRing)
`useFrame` mute directement `ringRef.current.position.y` — pas de re-render React.
C'est exactement le pattern à suivre pour le Lerp.

### Problème identifié sur TokenMesh

`TokenMesh` a un `dragState` qui override la position :
```js
const x = isDragging ? dragState.x + 0.5 : baseX + 0.5
const y = isDragging ? dragState.y        : baseY + 0.5
const z = isDragging ? dragState.z + 0.5  : baseZ + 0.5
```
La position `[x, y, z]` est passée directement au `<group position={[x, y, z]}>`.

Pour le Lerp, je ne peux PAS simplement ajouter un `useFrame` qui mute
`groupRef.current.position` car :
- React re-écrit `position` à chaque render via la prop `position={[x, y, z]}`
- Si le token est en drag, la position doit être celle du drag (pas celle du Lerp)
- Si le token vient de recevoir `TOKEN_MOVED`, la position cible change

**Solution correcte :**
- Ajouter `groupRef` sur le `<group>`
- Retirer la prop `position` du `<group>` (ne plus la passer via JSX)
- Maintenir une ref `lerpPos` = position Three.js animée courante
- Maintenir une ref `targetPos` = position cible (baseX/Y/Z ou dragState)
- `useFrame` : si isDragging → position = dragState (snap immédiat), sinon → Lerp vers targetPos
- Initialiser `lerpPos` à la position actuelle au montage (sinon le token part de [0,0,0])

### Problème identifié sur EntityMesh

`EntityMesh` bifurque vers `EntityMeshVoxel` ou `EntityMeshGlb`.
Ces sous-composants ont chacun leur `<group position={[posX, posY, posZ]}>`.
Je ne peux pas ajouter le Lerp dans `EntityMesh` seul sans wrapper group
car la position est dans les sous-composants.

**Solution correcte :**
Ajouter un `<group>` wrapper dans `EntityMesh` (avant la bifurcation),
le Lerp anime ce wrapper. Les sous-composants reçoivent `posX=0 posY=0 posZ=0`
(position relative au wrapper). 

MAIS — cela oblige à modifier les deux sous-composants pour passer position 0.
C'est invasif.

**Solution alternative plus propre :**
Ajouter `useFrame` + `groupRef` directement dans `EntityMeshVoxel` ET `EntityMeshGlb`
séparément — les deux utilisent le même pattern. Moins élégant mais chirurgical,
sans risque de casser la bifurcation.

**Décision finale Lerp EntityMesh — après analyse règle des hooks :**
- Le guard `if (!blueprint) return null` (l.34) est AVANT tout hook possible dans `EntityMesh`
- Impossible d'appeler `useFrame` dans `EntityMesh` sans violer la règle des hooks
- Approche wrapper dans `EntityMesh` = INVALIDE
- **Solution retenue : Lerp dans `EntityMeshVoxel` ET `EntityMeshGlb` séparément**
  - Les deux reçoivent `posX/posY/posZ` en props = cibles du Lerp
  - Ajouter `groupRef` + `lerpPos` ref + `useFrame` dans chacun
  - Retirer `position={[posX, posY, posZ]}` du `<group>` JSX dans chacun
  - Piloter la position via `groupRef.current.position.set(...)` dans `useFrame`
  - Pattern identique dans les deux — duplication acceptable, correcte, sans risque

**Piège hooks confirmé :**
`useFrame` doit être appelé inconditionnellement — jamais après un `return null`.
Le composant qui porte `useFrame` doit être garanti non-null au montage.

### Initialisation du Lerp — piège critique

Au montage, `lerpPos` doit être initialisée à la position actuelle du token/entité.
Sinon au premier render, le Lerp part de [0,0,0] vers la vraie position → animation parasite.
Solution : `useRef({ x: baseX+0.5, y: baseY+0.5, z: baseZ+0.5 })` directement.

### Constante LERP_DURATION

Objectif : animation visuellement terminée en ~300ms.
Lerp exponentiel : `alpha = 1 - Math.exp(-delta / tau)`
- tau = 0.1 → 95% en 300ms (3*tau) ✅ CORRECT
- tau = 0.3 → 95% en 900ms ❌ TROP LENT
**tau = 0.1 retenu.**

1. **SessionPage.jsx non encore lu** — impossible de valider l'état de interactionType côté client
2. **fr/translation.json non encore lu** — impossible de valider les clés i18n displacement

---

## Pièges actifs pour ce chantier

- P40 : Lerp → ref pour position animée, JAMAIS state dans useFrame
- PE14 : ENTITY_MOVED reçu du serveur = coords base → conversion Three.js avant Lerp
- P3 : tout useCallback qui émet via socket → socket dans deps
- PE21 : r tokens = 0-7, rotation.y = r * Math.PI / 4
- Risque 3 (CONSEILS 9F-C) : si Lerp en cours et nouveau ENTITY_MOVED arrive → source de vérité = store, pas position animée

---

## Plan de code final — vérifié, documenté, prêt à exécuter

### Fichier 1 — index.js — str_replace unique

Supprimer exactement ces 7 lignes (bloc Tchebychev) :
```
      // Adjacence Tchebychev — l'entité doit rester à ≤ 1 case de l'acteur après chaque pas
      // (PLAN_ENTITY.md §9 — stop at k-1 si distance > 1)
      const distTchebychev = Math.max(
        Math.abs(nextEntityPosX - nextActorPosX),
        Math.abs(nextEntityPosY - nextActorPosY),
      )
      if (distTchebychev > 1) break
```
Remplacer par : rien (suppression pure).

---

### Fichier 2 — Canvas3D.jsx — 2 str_replace

**str_replace 1 : snap 8 axes**
old : bloc if/else 2 branches (ratio absolu)
new : bloc if/else-if/else 3 branches (ratio 2:1)

**str_replace 2 : Lerp TokenMesh**
- Ajouter après `const rotationY = ...` :
  - groupRef, lerpPos, targetRef, isDraggingRef
  - useFrame avec logique drag/lerp
- Modifier <group> : retirer position={[x,y,z]}, ajouter ref={groupRef}

---

### Fichier 3 — EntityMesh.jsx — 3 str_replace

**str_replace 1 : import useFrame**
Ajouter `import { useFrame } from '@react-three/fiber'` avant drei

**str_replace 2 : Lerp dans EntityMeshVoxel**
- Ajouter après leaveTimerRef : groupRef, lerpPos, targetRef, useFrame
- Modifier <group> : retirer position, ajouter ref

**str_replace 3 : Lerp dans EntityMeshGlb**
- Pattern identique à EntityMeshVoxel
- Même modifications JSX

---

### Pièges confirmés et leurs solutions — liste définitive

| Piège | Solution |
|---|---|
| Closure useFrame sur x/y/z | targetRef.current = { x, y, z } mis à jour à chaque render |
| Closure useFrame sur isDragging | isDraggingRef.current = isDragging mis à jour à chaque render |
| lerpPos initialisé à zéro | useRef({ x: baseX+0.5, y: baseY+0.5, z: baseZ+0.5 }) au montage |
| prop position écrasée par React | Retirée du JSX — position via useFrame uniquement |
| useFrame après return null (hooks) | Lerp dans sous-composants — pas dans EntityMesh |
| useFrame absent dans EntityMesh.jsx | import { useFrame } from '@react-three/fiber' |
| tau incorrect | tau = 0.1 → 95% en 300ms |
| Drag + Lerp simultanés | isDraggingRef → snap immédiat + reset lerpPos |


---

## Correction critique — hooks avant return null dans TokenMesh

Ligne 135 de Canvas3D.jsx : `if (!clonedScene) return null`
→ Tout hook (useRef, useFrame) doit être déclaré AVANT cette ligne.

Placement correct des refs Lerp dans TokenMesh :
- APRÈS `const rotationY = ...` (l.99)
- AVANT `const { scene: gltfScene } = useGLTF(glbUrl)` (l.102)

Ordre final dans TokenMesh :
```
l.99  const rotationY = ...
      // ── Lerp refs ──
      const groupRef = useRef()
      const lerpPos = useRef({ x: baseX+0.5, y: baseY+0.5, z: baseZ+0.5 })
      const targetRef = useRef({ x, y, z })
      targetRef.current = { x, y, z }
      const isDraggingRef = useRef(isDragging)
      isDraggingRef.current = isDragging
      useFrame(...)
      // ── fin Lerp refs ──
l.102 const { scene: gltfScene } = useGLTF(glbUrl)
```

Même contrainte vérifiée pour EntityMeshVoxel et EntityMeshGlb :
- leaveTimerRef est déclaré avant tout return → refs Lerp après leaveTimerRef = correct ✅
- Pas de return conditionnel avant le JSX dans les sous-composants ✅

---

## Correction critique 2 — hooks avant return null dans EntityMeshGlb

EntityMeshGlb ligne 271 : `if (!clonedScene) return null`
→ Refs Lerp et useFrame doivent être placés AVANT cette ligne.

Placement correct dans EntityMeshGlb :
- APRÈS useEffect (l.243)
- AVANT useGLTF (l.244) ? NON — useGLTF est un hook, il doit rester en premier.
- APRÈS useMemo (l.269) et AVANT if (!clonedScene) return null (l.271) ✅

Ordre final dans EntityMeshGlb :
```
l.243  useEffect(cleanup leaveTimerRef)
l.244  const { scene: gltfScene } = useGLTF(glbUrl)      ← hook, ne pas déplacer
l.246  const clonedScene = useMemo(...)                   ← hook, ne pas déplacer
l.269  }) fin useMemo
l.270  // ── Lerp refs ──
       const groupRef = useRef()
       const lerpPos = useRef({ x: posX, y: posY, z: posZ })
       const targetRef = useRef({ x: posX, y: posY, z: posZ })
       targetRef.current = { x: posX, y: posY, z: posZ }
       useFrame(...)
       // ── fin Lerp refs ──
l.271  if (!clonedScene) return null   ← APRÈS les hooks
```

EntityMeshVoxel : pas de return conditionnel avant JSX → placement après useEffect (l.117) correct ✅
EntityMeshGlb : return null l.271 → placement entre useMemo et return null ✅
TokenMesh : return null l.135 → placement entre rotationY et useGLTF ✅

Tous les pièges hooks identifiés et résolus.

---

## Tâches confirmées fonctionnelles — Session 43

### ✅ Fix Tchebychev (index.js)
Suppression bloc Tchebychev (l.1047-1053) — déplacement orthogonal fonctionnel.
Fichier : server/src/socket/index.js

### ✅ Marge de réussite dans le badge displacement
4 fichiers modifiés :
- index.js : mr ajouté dans broadcast DICE_RESULT
- SessionPage.jsx : mr ajouté dans destructuration + addMessage
- fr.json : clés displacementSuccess / displacementFail ajoutées
- Sidebar.jsx : badge displacement → "RÉUSSITE — Marge : X" / "ÉCHEC — Marge : X"
Badge skillcheck inchangé (entityActionSuccess / entityActionFail).

### 🔲 Restant à faire (9F-C)
1. Canvas3D.jsx — snap diagonal 8 axes (ratio 2:1)
2. Canvas3D.jsx — Lerp 300ms TokenMesh
3. EntityMesh.jsx — Lerp 300ms EntityMeshVoxel + EntityMeshGlb

---

## Run à vide Canvas3D.jsx — résultats

### Snap 8 axes — vérification PLAN_ENTITY.md §9
Ratio 2:1 confirmé dans le doc :
- dx > 2*dz → axe X pur
- dz > 2*dx → axe Z pur
- else → diagonal 45°
Zone diagonale : 26.6°-63.4° de chaque axe. Conforme. ✅

### Lerp TokenMesh — simulation complète

**str_replace 1 (snap) :**
old : if/else 2 branches (ratio absolu >=)
new : if/else-if/else 3 branches (ratio 2:1)
Cas limites vérifiés : axe pur X, axe pur Z, diagonal 45°, cas 30°. ✅

**str_replace 2 (refs Lerp) :**
Placement : APRÈS rotationY (l.99), AVANT useGLTF (l.102)
→ avant tout return conditionnel (if (!clonedScene) return null l.135) ✅
Refs : groupRef, lerpPos (initialisé baseX+0.5/baseY+0.5/baseZ+0.5), targetRef, isDraggingRef
targetRef.current et isDraggingRef.current mis à jour à chaque render → pas de closure stale ✅
useFrame : drag → snap immédiat + reset lerpPos. Sinon → Lerp exponentiel tau=0.1 ✅

**str_replace 3 (JSX group) :**
old : `position={[x, y, z]}` + ligne suivante
new : `ref={groupRef}` + ligne suivante (position retirée)
userData intact, rotation intact, onPointerDown intact, onDoubleClick intact ✅
useFrame gère position, React gère rotation → pas de conflit ✅
userData raycasting non affecté ✅
TokenMesh dans Scene dans Canvas → useFrame valide ✅

### Ordre des str_replace dans Canvas3D.jsx
1. Snap (handlePointerMove l.340-347) — indépendant du Lerp
2. Ajout refs Lerp après rotationY
3. Modification JSX group (retrait position, ajout ref)


---

## Bug collision map — voxels non détectés (stepsCompleted = 0 faux positif)

### Symptôme
`stepsCompleted = 0` sur réussite avec MR positive → message "Déplacement échoué" alors que le jet a réussi.

### Cause identifiée — inversion y/z dans les clés voxel Redis

`buildCollisionMap` stocke les voxels avec la clé issue de `voxel_data` :
```
voxelKey = "x:y_altitude:z_profondeur"   ← convention Three.js/voxel
```

`isCaseOccupied` dans le step-by-step cherche avec :
```
`${nextEntityPosX}:${nextEntityPosY}:${entity.pos_z}`
= "x:pos_y_profondeur:pos_z_altitude"    ← convention base PE14
```

Les entités et tokens sont stockés et cherchés avec la même convention PE14 → ils se trouvent mutuellement ✅

Les voxels sont stockés en convention Three.js mais cherchés en convention PE14 → JAMAIS TROUVÉS ✅... 

WAIT — si les voxels ne sont jamais trouvés, l'entité passerait À TRAVERS les murs, pas être bloquée.

### Révision — le vrai problème

Si `stepsCompleted = 0` systématiquement même sur terrain dégagé, ce n'est pas les voxels manquants (qui causeraient le contraire — passage à travers les murs).

Le blocage immédiat suggère que la POSITION ACTUELLE de l'entité ou du token est dans la collision map, et que `excludeIds` ne les exclut pas correctement.

### Hypothèse à vérifier

`excludeIds = [tokenId, entityId]` — les IDs sont des UUIDs strings.
Dans Redis, `cell.id` pour une entité = `entity.id` (UUID). Pour un token = `token.id` (UUID).
`excludeIds.includes(cell.id)` — comparaison string. Devrait fonctionner.

MAIS — la position initiale de l'entité est dans la collision map.
Au premier pas k=1 : on vérifie `nextEntityPosX = entity.pos_x + dirPosX`.
Si dirPosX = 0 et dirPosY = 0 → nextEntityPos = entityPos → collision avec elle-même.

→ **Est-ce que dirPosX et dirPosY sont bien calculés ?**

### À vérifier dans index.js — calcul de dirPosX/dirPosY


---

## Analyse bugs step-by-step — résultats logs

### Bug 1 — entityBlocked à (13,0,1) — NORD/SUD bloqué à k=2

La case (pos_x=13, pos_y=0, pos_z=1) est occupée dans Redis.
pos_y=0 = profondeur 0 = bord de carte.
Cause probable : token ou entité stocké à pos_y=0 dans la collision map.
OU voxel de sol avec inversion y/z (voxel_data "x:altitude:profondeur" vs isCaseOccupied "x:profondeur:altitude").
→ À confirmer en inspectant Redis directement.

### Bug 2 — Pull rouge : aucun log, pas même le premier [DBG]

Le premier console.log est ligne 836 — si absent, le handler n'est PAS exécuté.
Mais le payload est bien reçu côté client (le mode visée s'annule).
Cause : guard `alreadyPending` (pendingEntityActions Map) bloque la 2ème soumission.
Le premier essai push a créé une entrée dans pendingEntityActions — si elle n'est pas nettoyée
(clearTimeout + delete manquants), tous les essais suivants sont ignorés silencieusement.
→ Vérifier PE12 : clearTimeout + pendingEntityActions.delete() à la résolution.

### Bug 3 — Cases rouge pull : aucun jet, aucun log

Différent du bug 2 (qui survient après un push). Les cases rouge = dot=0 côté client.
Mais côté serveur, pour un pull valide, dot devrait être négatif.
Le client calcule dot(AE, AD) depuis les positions actuelles du token et de l'entité.
Si AE et AD sont perpendiculaires → dot=0 → ghost rouge → clic ignoré côté client.
Ce n'est pas un bug serveur — c'est le comportement attendu (PE27).
MAIS si le ghost est rouge sur des cases qui devraient être atteignables → bug client snap/dot.


---

## Mise à jour état investigation bugs — après logs step-by-step

### Bug collision "nord/sud bloqué à k=2" — RÉSOLU (pas un bug)

entityBlocked à (13,0,1) = voxel sol réel confirmé en base :
```
SELECT voxel_data->'13:0:1' → {"r": 0, "geo": "cube", "tex": 33}
```
y=0 dans voxel_data = sol réel (pas vide). La carte limite physiquement le déplacement.
Collision map correcte. Step-by-step correct. Comportement attendu. ✅

### Inversion y/z voxels Redis — INFIRMÉE

Les voxels sont stockés avec leur clé voxel_data "x:y:z" directement.
isCaseOccupied cherche "x:pos_y:pos_z" (profondeur:altitude en base).
Dans ce cas : voxel "13:0:1" = x=13, y=0 (altitude voxel), z=1 (profondeur voxel).
isCaseOccupied cherche "13:0:1" = x=13, pos_y=0 (profondeur base), pos_z=1 (altitude base).
Les deux conventions donnent la même clé par coïncidence sur ce cas.
⚠ La question de l'inversion y/z reste ouverte pour des cas non-symétriques.
À documenter comme dette technique — pas bloquant actuellement.

### Bug 1 — Cases rouge pull : aucun log serveur

Symptôme : clic sur case rouge (dot=0 côté client) → mode visée s'annule → aucun log.
Cause : le client ne fait pas d'émission si dr === 0 (ligne 443 Canvas3D.jsx) :
```js
if (dr !== 0 && gp) { socket.emit(...) }
```
C'est le comportement attendu — les cases rouges = dot=0 = ambiguïté push/pull → pas d'émission.
Ce n'est PAS un bug serveur. ✅

### Bug 2 — Ghost rouge sur cases inattendues

Symptôme : le ghost s'affiche rouge sur des cases qui devraient être atteignables.
Cause probable : dot(AE, AD) = 0 côté client pour des positions où AE ⊥ AD.
À investiguer dans handlePointerMove Canvas3D.jsx.

### Bugs confirmés ouverts

1. Ghost rouge inattendu — à investiguer
2. pendingEntityActions potentiellement non nettoyé — à vérifier

### État général du chantier 9F-C

✅ Déplacement orthogonal est/ouest fonctionnel (steps:2 confirmé)
✅ Déplacement orthogonal nord/sud fonctionnel (steps:1 limité par géographie)
✅ Collision map correcte
✅ Badge displacement avec MR
🔲 Ghost rouge inattendu à investiguer
🔲 Lerp EntityMesh pas encore codé
🔲 Logs debug à retirer avant livraison finale


---

## ✅ Snap 8 axes + couleurs ghost — confirmé fonctionnel

### Modifications Canvas3D.jsx
- Snap contraint sur les 8 axes exacts depuis l'entité (plus de cases parasites)
  - Axe X pur : `entity.pos_x + Math.round(dPosX)`
  - Axe Z pur : `entity.pos_y + Math.round(dPosZ)`
  - Diagonal : `dist = Math.round((|dPosX|+|dPosZ|)/2)` + sign
- Couleurs : bleu=push (#2563eb), orange=pull (#f97316), rouge=impossible (#ef4444)

### État 9F-C
✅ Fix Tchebychev index.js
✅ Badge MR displacement (4 fichiers)
✅ Snap 8 axes contraint depuis entité
✅ Couleurs ghost bleu/orange/rouge
✅ Lerp TokenMesh Canvas3D.jsx
✅ Déplacement est/ouest + nord/sud fonctionnel
🔲 Lerp EntityMesh (EntityMesh.jsx) — prochain
🔲 Logs debug à retirer (index.js)


---

## ✅ Lerp EntityMesh — confirmé fonctionnel

### Modifications EntityMesh.jsx
- Import `useFrame` depuis `@react-three/fiber` ajouté
- Lerp 300ms dans `EntityMeshVoxel` — après useEffect, avant JSX
- Lerp 300ms dans `EntityMeshGlb` — après useMemo, avant guard `if (!clonedScene) return null`
- `position={[posX, posY, posZ]}` retiré des deux `<group>`
- `ref={groupRef}` ajouté sur les deux `<group>`
- Pattern : targetRef.current mis à jour à chaque render → pas de closure stale
- tau = 0.1 → 95% en ~300ms

### Correction bug préexistant EntityEditor.jsx
- `textureMaterials` → `entityTextureMaterials` sur la prop passée à EntityMesh (ligne 214)

---

## État final 9F-C — Session 43

✅ Fix Tchebychev (index.js) — déplacement débloqué
✅ Badge MR displacement (index.js, SessionPage.jsx, fr.json, Sidebar.jsx)
✅ Snap 8 axes contraint depuis l'entité (Canvas3D.jsx)
✅ Couleurs ghost bleu=push / orange=pull / rouge=impossible (Canvas3D.jsx)
✅ Lerp 300ms TokenMesh (Canvas3D.jsx)
✅ Lerp 300ms EntityMesh (EntityMesh.jsx — voxel + GLB)
✅ Correction prop entityTextureMaterials (EntityEditor.jsx)
⚠️  Logs debug conservés dans index.js (décision dev — utiles pour la suite)

### Fichiers modifiés cette session
| Fichier | Modifications |
|---|---|
| `server/src/socket/index.js` | Fix Tchebychev, mr dans DICE_RESULT, logs debug step-by-step |
| `client/src/pages/SessionPage.jsx` | mr dans destructuration + addMessage |
| `client/src/locales/fr/translation.json` | displacementSuccess + displacementFail |
| `client/src/components/Sidebar.jsx` | Badge displacement avec MR |
| `client/src/components/Canvas3D.jsx` | Snap 8 axes contraint, couleurs ghost, Lerp TokenMesh |
| `client/src/components/EntityMesh.jsx` | Lerp 300ms EntityMeshVoxel + EntityMeshGlb |
| `client/src/components/EntityEditor.jsx` | Correction prop entityTextureMaterials |

