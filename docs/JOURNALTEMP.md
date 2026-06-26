# JOURNALTEMP — Scratch pad analytique
> Contenu périssable — ne jamais inclure dans la lecture obligatoire. Consolider vers JOURNAL5.md en fin de session.

---

## Session 127 — REWORK DR11 : DroneDeclareSection (refactor symétrie GM/PJ)

### Contexte
DR11 a révélé que CombatGmDeclareWindow et CombatActionWindow dupliquent la logique de déclaration drone (move + attaque). Fix DR11 appliqué en bricolage (bouton Move ajouté dans CombatGmDeclareWindow). Ce rework remplace ce bricolage par une architecture partagée.

### Analyse des deux composants (lus Session 127)

**CombatActionWindow — drone (état actuel) :**
- State : `droneWeapons`, `selectedDroneWeaponId`, `inTargetMode`, `moveSelection`
- Logic : `selectedDroneWeapon` dérivé, `droneAssaultValid = !attackSelected || (weapon && ammo && target)`, `handleZoneSelectClick`, `handleChooseTarget`
- UI : Move dans grille MAP_ACTIONS (filtrage `isDrone` sur melee/reload/multi/interact) + DroneWeaponPanel panneau droit si `attackSelected && isDrone`
- Payload : `move: moveSelection ? {...} : null` + `attack: { droneWeaponInvId, targetTokenId, cover_shot }`

**CombatGmDeclareWindow — drone après fix DR11 :**
- State : `droneWeapons`, `selectedDroneWeaponId`, `assaultTarget`, `pendingMove` (partagé avec le move PNJ)
- Logic : `canDeclareDrone = pendingMove || (weapon && target)`
- UI : section ACTION (Move bouton) + DroneWeaponPanel toujours visible
- Payload : `mapActions: { move: pendingMove ?? null, ...attackPayload }`

**Différences réelles :**
| | CombatActionWindow | CombatGmDeclareWindow |
|---|---|---|
| Allures move | Calculées depuis stats PJ | `DEFAULT_PNJ_ALLURES` |
| canDeclare | `!attackSelected \|\| (weapon && ammo && target)` | `pendingMove \|\| (weapon && target)` |
| Ammo check | Oui | Non (simplification GM) |
| Déclencheur move | grille MAP_ACTIONS → handleZoneSelectClick | bouton standalone → handleStartMove |
| DroneWeaponPanel | Panneau droit (conditionnel attackSelected) | Toujours visible |

### Architecture cible

```
useDroneDeclare(charId, tokenId, allures, onEnterMoveMode, onEnterTargetMode)
  → { droneWeapons, selectedDroneWeaponId, setSelectedDroneWeaponId,
      assaultTargetId, setAssaultTargetId,
      pendingMove, isSelectingOnMap,
      canDeclare, buildMapActions(),
      handleStartMove(activeToken), handleChooseTarget(activeToken) }

DroneDeclareSection (UI pure)
  Props: { pendingMove, onMoveToggle, droneWeapons, selectedWeaponId,
           onWeaponSelect, assaultTargetId, onChooseTarget, getLabel }
  Rendu: Move button + destination + DroneWeaponPanel
```

**CombatGmDeclareWindow** : branche `isActiveDrone` → hook + DroneDeclareSection
**CombatActionWindow** : branche `isDrone` → hook + DroneDeclareSection (remplace grille filtrée + panneau droit conditionnel)

### Plan exact — 4 étapes / 4 fichiers

---

#### Étape 1 — `client/src/lib/useDroneDeclare.js` (nouveau fichier)

**Conventions intégrées (recherche 2026-06-26) :**
- `useCallback` sur les callbacks retournés (évite stale closures si parent les met en dep array)
- `cancelled` flag (convention projet — voir CombatActionWindow L.256, pas AbortController)
- reset séparé du fetch (deux useEffect distincts, dépendances orthogonales)
- pas de Context Provider — `allures` passé en paramètre (prop-down = convention projet)

```js
import { useState, useEffect, useCallback } from 'react'
import api from './api.js'

export function useDroneDeclare({ charId, tokenId, allures, onEnterMoveMode, onEnterTargetMode }) {
  const [droneWeapons,          setDroneWeapons]          = useState([])
  const [selectedDroneWeaponId, setSelectedDroneWeaponId] = useState(null)
  const [assaultTargetId,       setAssaultTargetId]       = useState(null)
  const [pendingMove,           setPendingMove]           = useState(null)
  const [isSelectingOnMap,      setIsSelectingOnMap]      = useState(false)

  // Fetch armes drone quand le personnage change (cancelled flag = convention projet)
  useEffect(() => {
    if (!charId) return
    let cancelled = false
    api.get(`/char-sheet/${charId}/drone/weapons`)
      .then(r => {
        if (cancelled) return
        const weapons = r.data.weapons ?? []
        setDroneWeapons(weapons)
        if (weapons.length > 0) setSelectedDroneWeaponId(weapons[0].id)
      })
      .catch(() => { if (!cancelled) setDroneWeapons([]) })
    return () => { cancelled = true }
  }, [charId])

  // Reset état déclaration quand le slot actif change (séparé du fetch)
  useEffect(() => {
    setSelectedDroneWeaponId(null)
    setAssaultTargetId(null)
    setPendingMove(null)
    setDroneWeapons([])
    setIsSelectingOnMap(false)
  }, [tokenId])

  const canDeclare = !!pendingMove || (!!selectedDroneWeaponId && !!assaultTargetId)

  // useCallback : stable si parent utilise ces fonctions dans un dep array
  const handleStartMove = useCallback((activeToken) => {
    if (!onEnterMoveMode || !tokenId || !activeToken || !allures) return
    setIsSelectingOnMap(true)
    onEnterMoveMode(
      allures, tokenId,
      { x: activeToken.pos_x, z: activeToken.pos_y },
      (sel) => { setPendingMove(sel); setIsSelectingOnMap(false) },
      () => { setPendingMove(null); setIsSelectingOnMap(false) },
    )
  }, [allures, tokenId, onEnterMoveMode])

  const handleChooseTarget = useCallback((activeToken) => {
    if (!onEnterTargetMode || !tokenId || !activeToken) return
    setAssaultTargetId(null)
    setIsSelectingOnMap(true)
    onEnterTargetMode(
      tokenId,
      { x: activeToken.pos_x, z: activeToken.pos_y },
      (targetId) => { setAssaultTargetId(targetId); setIsSelectingOnMap(false) },
      () => { setIsSelectingOnMap(false) },
      'ranged',
    )
  }, [tokenId, onEnterTargetMode])

  const clearPendingMove = useCallback(() => setPendingMove(null), [])

  // Construit le fragment mapActions pour le payload COMBAT_ACTION_DECLARE
  // Appelé au moment du declare (lecture snapshot des states courants)
  const buildMapActions = useCallback(() => {
    const hasAttack = !!selectedDroneWeaponId && !!assaultTargetId
    const weapon = hasAttack ? droneWeapons.find(w => w.id === selectedDroneWeaponId) : null
    const explicitFm = weapon?.fire_mode
    const isCaC = explicitFm ? explicitFm === 'cc' : !weapon?.ref_fire_mode
    const stateFireMode = hasAttack ? (isCaC ? 'cc' : (explicitFm ?? 'rc').toLowerCase()) : 'cc'
    const attackPayload = hasAttack
      ? (isCaC
          ? { melee: [{ droneWeaponInvId: selectedDroneWeaponId, targetTokenId: assaultTargetId }] }
          : { attack: { droneWeaponInvId: selectedDroneWeaponId, targetTokenId: assaultTargetId } })
      : {}
    return {
      stateFireMode,
      mapActions: {
        move: pendingMove
          ? { targetPosX: pendingMove.targetPosX, targetPosY: pendingMove.targetPosY,
              targetPosZ: pendingMove.targetPosZ ?? 0, ini_mod: pendingMove.ini_mod ?? 0,
              action_key: pendingMove.action_key }
          : null,
        ...attackPayload,
      },
    }
  }, [selectedDroneWeaponId, assaultTargetId, droneWeapons, pendingMove])

  return {
    droneWeapons, selectedDroneWeaponId, setSelectedDroneWeaponId,
    assaultTargetId, pendingMove, isSelectingOnMap,
    canDeclare, buildMapActions, clearPendingMove,
    handleStartMove, handleChooseTarget,
  }
}
```

---

#### Étape 2 — `client/src/components/DroneDeclareSection.jsx` (nouveau fichier)

UI pure — Move toggle + destination + DroneWeaponPanel.

Props :
```js
{ pendingMove, onMoveToggle, droneWeapons, selectedWeaponId, onWeaponSelect,
  assaultTargetId, onChooseTarget, getLabel, style }
```

Rendu :
```jsx
<div style={style}>
  <div className="combat-win-section">
    <span className="combat-win-section-title" style={{ color: '#aa8a30' }}>ACTION</span>
    <div style={...actionGrid}>
      <div style={...moveBtn actif si pendingMove} onClick={onMoveToggle}>
        <span>Déplacement</span>
        <span>−INI</span>
      </div>
    </div>
    {pendingMove && <div>[{pendingMove.targetPosX}, {pendingMove.targetPosY}]</div>}
  </div>
  <DroneWeaponPanel
    droneWeapons={droneWeapons}
    selectedWeaponId={selectedWeaponId}
    assaultTargetId={assaultTargetId}
    showReadyBadge={false}
    onWeaponSelect={onWeaponSelect}
    onChooseTarget={onChooseTarget}
    getLabel={getLabel}
  />
</div>
```

Styles copiés de CombatGmDeclareWindow (S.actionGrid, S.actionBtn, S.actionBtnActive, S.actionIni, S.attackTargetRow) → styles locaux dans ce fichier.

---

#### Étape 3 — `CombatGmDeclareWindow.jsx`

**Supprimer :**
- `useState` : `droneWeapons`, `selectedDroneWeaponId` (→ hook)
- `useEffect` fetch drone weapons L.165-174 (→ hook)
- `activeDroneCharId` IIFE L.157-163 (→ remplacé par prop charId au hook)
- Bloc UI `isActiveDrone` actuel (move + DroneWeaponPanel inline) → `<DroneDeclareSection />`
- `canDeclareDrone` L.285 → `droneDeclare.canDeclare`
- Branche `isActiveDrone` dans `handleDeclare` → `droneDeclare.buildMapActions()`

**Ajouter :**
```js
import { useDroneDeclare } from '../lib/useDroneDeclare.js'
import DroneDeclareSection from './DroneDeclareSection.jsx'
import { DEFAULT_PNJ_ALLURES } from '../../../shared/polarisUtils.js'  // déjà importé

const droneDeclare = useDroneDeclare({
  charId:            activeDroneCharId,
  tokenId:           activeTokenId,
  allures:           DEFAULT_PNJ_ALLURES,
  onEnterMoveMode,
  onEnterTargetMode,
})
```

**`handleDeclare` branche drone :**
```js
if (isActiveDrone) {
  const { stateFireMode, mapActions } = droneDeclare.buildMapActions()
  socket.emit(WS.COMBAT_ACTION_DECLARE, {
    tokenId: activeTokenId,
    state: { position: 'standing', weapon: 'holstered', fire_mode: stateFireMode, cover: 'exposed', vitesse: 'normal' },
    mapActions,
  })
  return
}
```

**`canDeclare` L.286 :**
```js
const canDeclare = (isActivePnj && (stateChanged || hasAction) && assaultValid) || droneDeclare.canDeclare
```

**Bloc UI `isActiveDrone` :**
```jsx
{isActiveDrone && (
  <DroneDeclareSection
    pendingMove={droneDeclare.pendingMove}
    onMoveToggle={() => {
      if (droneDeclare.pendingMove) { /* setPendingMove(null) via hook */ }
      else droneDeclare.handleStartMove(activeToken)
    }}
    droneWeapons={droneDeclare.droneWeapons}
    selectedWeaponId={droneDeclare.selectedDroneWeaponId}
    onWeaponSelect={droneDeclare.setSelectedDroneWeaponId}
    assaultTargetId={droneDeclare.assaultTargetId}
    onChooseTarget={() => droneDeclare.handleChooseTarget(activeToken)}
    getLabel={getLabel}
    style={S.controls}
  />
)}
```

**`isSelectingOnMap` :** utiliser `droneDeclare.isSelectingOnMap || isSelectingOnMap` dans le style opacity du wrapper.

**`activeDroneCharId` :** garder l'IIFE (nécessaire pour passer au hook), ou déplacer la logique dans le hook si `tokens`/`characters` sont passés. Décision : garder l'IIFE, passer `charId`.

---

#### Étape 4 — `CombatActionWindow.jsx`

**Supprimer :**
- `useState` : `droneWeapons`, `selectedDroneWeaponId`, `inTargetMode` (→ hook)
- `useEffect` fetch drone weapons L.255-265 (→ hook)
- `selectedDroneWeapon` / `droneAssaultValid` dérivés (→ hook)
- Conditions `isDrone` dans MAP_ACTIONS (filtrage melee/reload/multi/interact) — remplacées par `DroneDeclareSection` hors grille
- Panneau droit drone `{showAssault && isDrone && <DroneWeaponPanel>}` — remplacé
- `canDeclare` branche drone → `droneDeclare.canDeclare`
- Payload drone dans `handleDeclare` → `droneDeclare.buildMapActions()`

**Ajouter :**
```js
import { useDroneDeclare } from '../lib/useDroneDeclare.js'
import DroneDeclareSection from './DroneDeclareSection.jsx'

const droneDeclare = useDroneDeclare({
  charId:            playerToken?.character_id ?? null,
  tokenId:           playerToken?.id ?? null,
  allures,           // allures calculées depuis stats PJ — ici l'asymétrie est légitime
  onEnterMoveMode,
  onEnterTargetMode,
})
```

**`canDeclare` :**
```js
const canDeclare = isDrone
  ? droneDeclare.canDeclare
  : ((hasAnyAction || stateChanged) && assaultValid && reloadValid && meleeValid)
```

**Section ACTION :** quand `isDrone`, ne pas itérer MAP_ACTIONS — rendre `<DroneDeclareSection>` à la place.

```jsx
{/* ACTION */}
<div className="combat-win-section">
  {isDrone
    ? <DroneDeclareSection
        pendingMove={droneDeclare.pendingMove}
        onMoveToggle={() => droneDeclare.pendingMove ? /* reset */ : droneDeclare.handleStartMove(playerToken)}
        ...
      />
    : <div style={W.itemsGrid}>{MAP_ACTIONS.map(...)}</div>
  }
</div>
```

**Panneau droit :** supprimer `{showAssault && isDrone && <DroneWeaponPanel>}` — DroneWeaponPanel est déjà dans DroneDeclareSection.

**`isSelectingOnMap` / `inMoveMode` :** utiliser `droneDeclare.isSelectingOnMap` pour le drone, `inMoveMode` pour le reste.

---

### Pièges critiques

**P1 — allures asymétrie légitime**
GM drone → `DEFAULT_PNJ_ALLURES` ; PJ drone → `allures` calculées depuis stats. C'est correct : le PJ drone a ses propres stats de déplacement. Le hook reçoit `allures` en param → aucun couplage.

**P2 — reset hook vs reset parent**
Le hook reset sur `tokenId` change. CombatGmDeclareWindow change d'`activeTokenId` → hook se reset automatiquement. CombatActionWindow : `playerToken?.id` change quand le slot avance → même comportement.

**P3 — moveToggle : le hook expose setPendingMove ?**
Non. Le hook expose `handleStartMove` (démarre sélection carte) et le toggle annulation se fait par un `clearPendingMove()` à exposer, ou en re-appelant `handleStartMove` avec un état déjà défini. Solution : exposer `clearPendingMove = () => setPendingMove(null)` depuis le hook.

**P4 — `isSelectingOnMap` combiné**
CombatGmDeclareWindow a son propre `isSelectingOnMap` (pour le PNJ). Pour le drone, utiliser `droneDeclare.isSelectingOnMap`. Le wrapper opacity doit combiner les deux : `isSelectingOnMap || droneDeclare.isSelectingOnMap`.

**P5 — `activeDroneCharId` doit être stable**
L'IIFE `activeDroneCharId` dans CombatGmDeclareWindow est recalculée à chaque render. Passer au hook → normal, le hook reçoit la valeur et useEffect dépend d'elle (stable si même valeur).

**P6 — DroneDeclareSection n'émet pas**
Le composant UI ne touche pas socket. Seul le parent émet via `handleDeclare`. Le hook fournit `buildMapActions()` → le parent construit et émet.

### Validation post-rework

**CombatGmDeclareWindow — drone PNJ :**
- V1 : section Déplacement visible ✅
- V2 : move seul → DÉCLARER activé ✅
- V3 : attack seule → DÉCLARER activé ✅
- V4 : move + attack → les deux dans payload ✅

**CombatActionWindow — drone PJ :**
- V5 : même UI que drone PNJ ✅
- V6 : move seul → DÉCLARER activé ✅
- V7 : attack seule → DÉCLARER activé ✅
- V8 : allures PJ (calculées) utilisées pour drone PJ ✅

**Régression humanoïde :**
- V9 : PNJ humanoïde CombatGmDeclareWindow inchangé ✅
- V10 : PJ humanoïde CombatActionWindow inchangé ✅

---

## Session 127 — DR7 : Propriétaire drone = mêmes droits que GM

### Fichiers lus
- `client/src/character/DroneWindow.jsx` ✅
- `client/src/character/DroneSheet.jsx` ✅
- `server/src/routes/character/char-sheet.js` (routes drone L.1540–1969) ✅
- `SessionPage.jsx` L.730–747 ✅ — `_currentUserId: user?.id` bien passé

### Diagnostic causes racines

**isOwner client** — calculé correctement L.44 DroneWindow :
```js
const isOwner = character.user_id != null && character.user_id === character._currentUserId
```
`_currentUserId` = `user?.id` passé depuis SessionPage L.742. ✅ La valeur est juste.

**Serveur — 7 routes bloquent l'owner :**
| Route | Ligne | Guard actuel |
|---|---|---|
| `PUT /drone` (stats + notes) | L.1591 | `if (!req.isGm)` |
| `PUT /drone/integrity` | L.1679 | `if (!req.isGm)` |
| `POST /drone/programs` | L.1702 | `if (!req.isGm)` |
| `PUT /drone/programs/:id` | L.1766 | `if (!req.isGm)` |
| `DELETE /drone/programs/:id` | L.1801 | `if (!req.isGm)` |
| `POST /drone/weapons` | L.1851 | `if (!req.isGm)` |
| `DELETE /drone/weapons/:id` | L.1957 | `if (!req.isGm)` |

`PUT /drone/weapons/:id` L.1915 → déjà `GM or owner` ✅

**Client — guards sur isGm :**
- `DroneSheet/StatField` L.23 : `{isGm ? <input> : <span>}` — toutes les stats
- `DroneSheet/ProgramsSection` L.151 : reçoit isGm seulement — level, delete, form add
- `DroneSheet/IntegritySection` L.56,83,110 : tout sur isGm
- `DroneWindow/WeaponsTab` L.451,513,562 : fetch, delete btn, add btn
- `DroneWindow/NotesTab` L.602,622 : handleBlur + readOnly equip_special
- `DroneWindow/SettingsTab` : visibility toggle, GLB upload, delete — rester GM-only

### Décision architecture

**Owner = même droits que GM sur son drone** (sauf SettingsTab + visibility qui restent GM-only).

**Pattern pro (RBAC+ABAC, recherche web 2024-06) :**
Extraire un helper pur `droneIsGmOrOwner(req)` — DRY, pas de répétition inline, testable.

```js
// Ajouté en tête de la section drone routes (L.1541)
const droneIsGmOrOwner = req =>
  req.isGm || !!(req.character.user_id && req.character.user_id === req.user.id)
```

**Client — pattern `canEdit = isGm || isOwner` :**
- Calculé dans DroneWindow puis passé à chaque composant enfant
- DroneSheet : `isGm={canEdit}` → toutes les StatField + ProgramsSection héritent sans changement interne
- IntegritySection : garde `isGm={isGm}` (état combat, GM seulement)
- SettingsTab : garde `isGm={isGm}` (GLB, delete, ownership)
- WeaponsTab : `isGm={canEdit}` — fetch, add btn, delete btn héritent
- NotesTab : `isGm={canEdit}` — handleBlur + equip_special read-only héritent ; notes_gm garde `{isGm && ...}` en interne

### Plan exact — 2 fichiers

#### `server/src/routes/character/char-sheet.js`

1. Ajouter helper avant `GET /:characterId/drone` (~L.1558) :
```js
const droneIsGmOrOwner = req =>
  req.isGm || !!(req.character.user_id && req.character.user_id === req.user.id)
```

2. Remplacer dans 7 routes :
```js
// Avant :
if (!req.isGm) throw new AppError(403, 'GM role required')
// Après :
if (!droneIsGmOrOwner(req)) throw new AppError(403, 'GM or owner required')
```
→ L.1591, L.1679, L.1702, L.1766, L.1801, L.1851, L.1957

#### `client/src/character/DroneWindow.jsx`

Dans `DroneWindow` composant principal, après L.44 :
```js
const canEdit = isGm || isOwner
```

Puis remplacer les props passées :
- `DroneSheet` L.265–276 : `isGm={canEdit}` (au lieu de `isGm={isGm}`)
- `WeaponsTab` L.280–286 : `isGm={canEdit}`
- `NotesTab` L.289–294 : `isGm={canEdit}`
- `SettingsTab` L.297–306 : `isGm={isGm}` (inchangé)

Visibility toggle header L.210 : `{isGm && ...}` → inchangé

#### `client/src/character/DroneSheet.jsx`

Aucun changement interne nécessaire — `canEdit` arrive via la prop `isGm` et tout s'hérite.
Sauf IntegritySection L.400–406 : garde `isGm={isGm}` séparément (prop supplémentaire à passer depuis DroneWindow ou extraire isGm original).

**Problème à résoudre** : DroneWindow passe `isGm={canEdit}` à DroneSheet, mais DroneSheet passe `isGm={isGm}` à IntegritySection. Si DroneWindow passe `canEdit` comme `isGm`, DroneSheet reçoit `isGm=canEdit`. Or DroneSheet passe ce même `isGm` à IntegritySection → IntegritySection recevrait `canEdit` au lieu de `isGm` → MAUVAIS.

**Solution** : DroneWindow passe les deux props séparément à DroneSheet :
```jsx
<DroneSheet
  isGm={isGm}          // pour IntegritySection
  canEdit={canEdit}    // pour StatField + ProgramsSection
  ...
/>
```

DroneSheet.jsx : ajouter `canEdit = false` dans la signature, passer `isGm={canEdit}` à StatField et ProgramsSection, garder `isGm={isGm}` pour IntegritySection.

### Ce qui ne change pas
- SettingsTab (GLB, delete drone, réassignation) → GM-only
- Visibility toggle header → GM-only
- IntegritySection (état combat) → GM-only
- `PUT /drone/weapons/:id` (déjà owner-ok) → inchangé
- `DELETE /drone/weapons/:id` → GM-only côté client même si owner peut (pas de bouton delete pour owner sur weapons? Non, WeaponsTab isGm → canEdit donc delete est visible pour owner) → OK

### Scénario de test (à faire après SR)
1. Joueur propriétaire ouvre DroneWindow → section Stats : inputs éditables ✅
2. Ajouter programme → bouton visible + requête acceptée ✅
3. Modifier niveau programme → input éditable ✅
4. Supprimer programme → bouton × visible ✅
5. Ajouter arme → bouton visible + picker ✅
6. Supprimer arme → bouton visible ✅
7. equip_special → éditable ✅
8. notes_gm → non visible (GM-only) ✅
9. Intégrité → readonly (GM-only) ✅
10. Visibility toggle → non visible (GM-only) ✅
11. Joueur NON-propriétaire → tout readonly (isOwner=false, isGm=false, canEdit=false) ✅



---

## Session 121 — COM22 : LOS bloquée Kiwi — diagnostic en cours

### Faits confirmés
- FEAT2-A (LOS client-side) : dégagé ✅ sur Kiwi, même battlemap
- Combat LOS (server-side) : bloqué ❌ sur Kiwi, même battlemap, mêmes positions
- Battlemap utilisée : `86fba530-...` length=8914 (a des voxels)
- Battlemap vide : `38fac583-...` length=2 (`{}`)

### Conclusion
Discordance client/serveur CONFIRMÉE. Client et serveur lisent des voxels différents, OU le serveur `checkLOS` reçoit des données corrompues/différentes depuis PostgreSQL.

### Prochain diagnostic (sans toucher au code)
Inspecter le contenu réel des voxels en DB :
```bash
docker exec enclume-postgres-1 psql -U vtt -d vtt -c \
  "SELECT substring(voxel_data::text, 1, 150) FROM battlemaps WHERE id = '86fba530-483d-4a7c-91b1-63a301170778';"
```
→ Révèle le format des clés (`:` vs `,` vs autre) et le contenu réel.

### Hypothèses restantes
A. DB a des voxels qui couvrent tout l'espace → LOS toujours bloquée (voxels mauvais/anciens)
B. Format clés DB ≠ format attendu par checkLOS → mais ça donnerait clear:true, pas false
C. Voxels sauvegardés depuis éditeur client jamais persistés correctement en DB Kiwi
D. `fast-voxel-raycast` comportement différent Node v24.15.0 (Kiwi) vs local

---

## Session 118 — COM17 : arme par défaut = Mains nues

### Analyse cause racine confirmée

`selectedMeleeWeaponId = null` joue deux rôles contradictoires :
- `null` = mains nues (choix explicite utilisateur)
- `null` = pas encore sélectionné (init/reset)

### Plan validé — 4 changements

**PJ `CombatActionWindow.jsx` :**
1. Fetch callback (L.234) : `setSelectedMeleeWeaponId(items.find(isMeleeCaC)?.id ?? null)` — slot change, données fraîches
2. Effet `has_announced` (L.217) : `setSelectedMeleeWeaponId(meleeWeapons[0]?.id ?? null)` — nouveau tour même token
3. Deselect melee (L.400) : idem — ré-ouverture mode CaC retrouve l'arme

**GM `CombatGmDeclareWindow.jsx` :**
4. L.178 : supprimer `&& initialStates.weapon === 'drawn'`

### Question ouverte — Généralisation Assault tir ?

**GM assault** : `weapon = equipment[activeTokenId]?.weapon ?? null` → DÉRIVÉ, pas useState → pas de problème init.

**PJ assault** : `assaultWeapons` useState (L.95), peuplé par même fetch que `allInventoryItems` (L.231).
- `selectedWeapon` / `selectedAssaultWeaponId` → À VÉRIFIER : même init-to-null ?
- Si oui → même fix dans le fetch callback

**Décision à prendre** : auditer `CombatActionWindow.jsx` section assault avant ou après COM17 CaC ?
- Recommandation : finir COM17 CaC en premier (cause confirmée, plan prêt), puis audit assault séparé.
- Risque si on regroupe : scope creep, contexte épuisé avant validation.

### État BUGIDENTIFIE.md
- DASH1 ✅ clos
- COM17 ✅ clos — pattern valeur dérivée (`undefined` sentinel)
- COM18 / COM15 / COM16 / D3 : à traiter

---

## Session 120 — Bug blessures combat : non rafraîchies dans ArmorWoundPanel

### Comportement confirmé
- Blessures combat (via WS) n'apparaissent qu'à la **réouverture** de la CharacterWindow.
- Blessures manuelles (clic) apparaissent **immédiatement**.

### Cause racine identifiée — deux chemins distincts

**Chemin manuel (`LocationPanel.handleBoxClick` L.93-112) :**
```
POST /wounds → réponse → onWoundsReload() → ArmorWoundPanel.handleWoundsReload()
  → GET /wounds → setWounds() → UI mise à jour directement
```
Pas de WS. Mise à jour directe dans le composant monté.

**Chemin combat (`woundService.applyWound` → `WOUND_ADDED`) :**
```
WOUND_ADDED (WS) → useCharacterSocket.woundVersions++ → SessionPage re-render
  → woundReloadKey prop → CharacterWindow.useEffect → bumpInventoryVersion()
  → ArmorWoundPanel.reloadKey → load()
```
Chain de 5 étapes — **ne fonctionne que si ArmorWoundPanel est monté** (onglet Matériel actif).

### Comportement observé (confirmé Saar)
- CharacterWindow fermée pendant le combat → onglet par défaut = `sheet` → ArmorWoundPanel pas monté
- Réouverture → montage → `load()` sur onglet `sheet` non déclenché (composant pas encore monté)
- Clic sur onglet Matériel → montage `ArmorWoundPanel` → `load()` → blessure apparaît ✓
- User perçoit : "j'ai dû rouvrir la fenêtre"

### Ce qui FONCTIONNE
- Rafraîchissement à l'ouverture onglet Matériel : ✅ (mount → load systématique)
- WS chain si ArmorWoundPanel déjà monté : ✅ en théorie (non invalidé par le test — Saar était sur onglet sheet)

### Pistes de correction à évaluer
**Option A** (fix léger) : Écouter `WOUND_ADDED` directement dans `ArmorWoundPanel` via `useSocket()`
  → `setWounds` immédiat sans dépendre de la chaîne parent — même pattern que `handleWoundsReload`
  → Ne nécessite pas que le parent reçoive/transmette le signal

**Option B** (statu quo) : Accepter le comportement — l'onglet Matériel affiche toujours les données fraîches à l'ouverture.
  → Pas de mise à jour "push" si fenêtre ouverte sur onglet sheet

### Fichiers concernés
- `client/src/character/ArmorWoundPanel.jsx` — candidat pour Option A
- `client/src/lib/useCharacterSocket.js` — source `woundVersions`
- `shared/events.js` — `WS.WOUND_ADDED`

---

## Session 121 — RW18-1 : analyse + architecture finale décidée

### Clarification périmètre

**RW18-1 (BUGIDENTIFIE.md)** = ordering regression serveur : WOUND_ADDED arrive avant DICE_RESULT.
**Problème réel Saar (JOURNALTEMP Session 120)** = blessures n'apparaissent pas du tout si CharacterWindow fermée.

Les deux sont distincts. La session attaque le problème "blessure ne s'affiche pas" — le ordering serveur reste hors périmètre.

### Proposition agent précédent — Analyse critique

Architecture : WS listener toujours monté → fetch REST → Zustand store → ArmorWoundPanel lit le store.
5 étapes / 5 fichiers.

**Validé** :
- Philosophie store Zustand ✅ — plus fiable que chaîne de props
- Étapes 1, 2, 3 ✅ avec corrections mineures (voir ci-dessous)
- Ciblage du vrai problème ✅

**Lacune critique identifiée — Étapes 4+5** :
La proposition supprime `useEffect([woundReloadKey, bumpInventoryVersion])` dans CharacterWindow + prop `woundReloadKey` dans SessionPage. Résultat : INVENTORY_* perd son chemin vers `bumpInventoryVersion → reloadKey → load()`. WeaponPanel/InventoryPanel ne rechargent plus sur INVENTORY_* events.

La proposition dit "INVENTORY_* continue via reloadKey directement depuis le store" mais ne fournit pas ce code.

### Architecture finale validée — 5 fichiers / 5 étapes

**Principe clé** : WOUND_* → store Zustand (via hook toujours monté). INVENTORY_* → chaîne existante renommée (inchangée fonctionnellement).

#### Étape 1 — characterStore.js
Ajouter après `upsertCharacter` :
```js
woundsByCharId: {},
setWounds: (charId, wounds) => set(state => ({
  woundsByCharId: { ...state.woundsByCharId, [charId]: wounds }
})),
```

#### Étape 2 — useCharacterSocket.js
```js
// Ajouter import api from './api.js'
// Ajouter selector (PAS destructuring brut) :
const setWounds = useCharacterStore(s => s.setWounds)

// WOUND_* handlers — SUPPRIMER le bump woundVersions, AJOUTER fetch store :
const onWoundAdded = ({ characterId, worst_wound_severity }) => {
  updateCharacter({ id: characterId, worst_wound_severity })
  api.get(`/char-sheet/${characterId}/wounds`)
    .then(res => setWounds(characterId, res.data.wounds || []))
    .catch(() => {})
}
// idem onWoundUpdated, onWoundRemoved (supprimer le bump, ajouter fetch store)

// INVENTORY_* handlers — INCHANGÉS (continuent de bumper woundVersions)
// Return inchangé : { woundVersions }
```

#### Étape 3 — ArmorWoundPanel.jsx
```js
// Ajouter après imports :
import { useCharacterStore } from '../stores/characterStore'

// Ajouter après les useState :
const setStoreWounds = useCharacterStore(s => s.setWounds)
const storeWounds    = useCharacterStore(s => s.woundsByCharId[characterId])

useEffect(() => {
  if (storeWounds !== undefined) setWounds(storeWounds)
}, [storeWounds])  // setWounds (useState setter) est stable — OK

// Dans load() : après setWounds(wRes.data.wounds || []) → ajouter :
setStoreWounds(characterId, wRes.data.wounds || [])
// Dans handleWoundsReload() : après setWounds(res.data.wounds || []) → ajouter :
setStoreWounds(characterId, res.data.wounds || [])

// Ajouter setStoreWounds aux deps de load() et handleWoundsReload()
// Aucun changement JSX
```

#### Étape 4 — CharacterWindow.jsx (renommage uniquement)
```js
// L.172 : prevWoundKeyRef → prevInventoryKeyRef
// L.173-178 : useEffect([woundReloadKey, ...]) → useEffect([inventoryReloadKey, ...])
// Prop reçue : woundReloadKey → inventoryReloadKey
// Sémantique correcte : cette clé ne pilote plus que les reloads INVENTORY_*
```

#### Étape 5 — SessionPage.jsx
```js
// woundReloadKey={woundVersions[selectedCharacter?.id] ?? 0}
// → inventoryReloadKey={woundVersions[selectedCharacter?.id] ?? 0}
```

### Ce que ça résout
- Blessure combat visible immédiatement dans ArmorWoundPanel même si CharacterWindow était fermée ✅
- Blessures manuelles (onWoundsReload) continuent de fonctionner ✅
- Reload inventaire sur INVENTORY_* : chaîne inchangée ✅
- WOUND_* ne passe plus par la chaîne fragile (ArmorWoundPanel doit être monté) ✅

### Ce que ça ne résout PAS
- RW18-1 ordering serveur (WOUND_ADDED avant DICE_RESULT) — imperceptible sur LAN local, sprint séparé si nécessaire

### Points de vigilance implémentation
- Étape 2 : NE PAS bumper woundVersions dans WOUND_* handlers (sinon double reload)
- Étape 3 : `setStoreWounds` dans deps de `load` et `handleWoundsReload` (Zustand action stable — pas de boucle mais ESLint correct)
- Étape 3 : double source temporaire (store + load REST) — le store arrive d'abord, load REST confirme. Pas de conflit visible.
- Étape 4 : renommage purement cosmétique — ne pas toucher la logique

