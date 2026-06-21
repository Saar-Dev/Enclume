# PLAN_REWORK06.md — declarationReducer (reducer partagé déclaration combat)
> Session 113 — 2026-06-21 | Rédigé après recherche documentée

---

## ⚠️ INSTRUCTIONS DE RÉCUPÉRATION POST-COMPACT

Si tu reprends depuis un résumé ou un compact :
1. Lire `CLAUDE.md` (instructions + méthode de travail)
2. Lire `docs/ARCHI_REWORK.md` §REWORK-06 (quand la spec y sera intégrée)
3. Lire ce fichier en entier
4. Aller à la section **REPRENDRE ICI** en bas → étape courante + fichiers à lire
5. NE PAS re-planifier. NE PAS poser de questions. Coder directement après "Je code ?".

---

## CONTEXTE

### Problème

`CombatGmDeclareWindow.jsx` et `CombatActionWindow.jsx` ont chacun ~20 `useState` locaux pour
gérer l'état de déclaration en cours d'élaboration. Les états tactiques communs (`position`,
`weapon`, `fire_mode`, `cover`, `vitesse`, `combatMode`, `quick`) sont dupliqués avec des
noms légèrement différents (`localStates` vs `states`, `localQuick` vs `quick`).

Conséquences directes :
- **Reset dupliqué** : 12 lignes de `setXxx(default)` dans chaque composant → 2 blocs
  quasi-identiques, désynchronisés si on en modifie un sans l'autre.
- **Auto-draw divergent** : GM auto-draw partiel (L.519 de GmDeclareWindow), Player bloque
  l'assaut tant que weapon !== 'drawn' (L.879 de ActionWindow) — deux comportements
  différents pour le même règle jeu.
- **Mains nues non respectées** : ActionWindow auto-sélectionne la première arme de contact
  (L.260–264) → null = mains nues impossible à imposer sans modifier ce code.
- **Non testable** : la logique de transition (auto-draw, reset, mains nues) est enfouie dans
  les render functions des composants — aucun test unitaire possible.

### Décision architecturale (documentée)

**`useReducer` avec reducer partagé** — pas un store Zustand global.

Recherche réalisée Session 113 :
- **tkdodo.eu** (auteur TanStack Query) : "If it's per-component and ephemeral, keep it local."
  Le store Zustand global est fait pour l'état partagé à travers l'appli. La déclaration est
  éphémère (reset après chaque déclaration) et locale (un seul composant actif par rôle).
- **React docs officielles** : `useReducer` recommandé quand plusieurs champs se mettent à
  jour simultanément depuis différentes actions (reset, auto-draw, mains nues).
- **Foundry VTT** (référence industrielle VTT) : architecture "Buffer State" = `pendingChanges`
  en local React state — pas de store global pour le staging avant soumission.
- **pmndrs/zustand #2496** : stores séparés pour données orthogonales — mais l'état de décla-
  ration n'est pas de la domain state, c'est de l'UI state éphémère.

Le nom `combatDeclarationStore` dans la table ARCHI_REWORK.md était un concept, pas une
prescription Zustand. **REWORK-06 crée `declarationReducer.js`**, pas un store.

### Alternatives écartées

- **Store Zustand global** : surdimensionné — l'état n'est pas partagé entre composants
  distincts, reset via store nécessiterait un `useEffect` pour synchroniser le changement
  de slot. Overhead inutile pour de l'UI state éphémère.
- **Custom hook `useDeclarationState` avec useState** : améliore l'encapsulation mais ne
  centralise pas les règles de transition — auto-draw resterait du code ad-hoc dispersé.
- **Garder les useState actuels + fonctions reset partagées** : ne résout pas l'auto-draw
  ni les mains nues (comportements divergents restent divergents).

### Prérequis

Aucun. REWORK-06 est **indépendant de REWORK-15/11/12/13** — il ne touche pas au socket,
pas à SessionPage, pas aux stores existants. Peut être livré avant ou après les autres.

---

## ÉTAT ACTUEL (lu Session 113 — fichiers source)

### États communs actuels — CombatGmDeclareWindow.jsx

```js
// L.80 — états tactiques PNJ actif
const [localStates, setLocalStates] = useState({ ...STATE_DEFAULTS })
// STATE_DEFAULTS = { position: 'standing', weapon: 'holstered', fire_mode: 'cc',
//                    cover: 'exposed', vitesse: 'normal' }

// L.81 — actions rapides
const [localQuick, setLocalQuick] = useState({ observer: 0, reperer: 0, phrase: false })

// L.83 — mode de combat
const [combatMode, setCombatMode] = useState('normal')

// Reset complet L.107–124 (useEffect([activeTokenId])) :
setLocalStates({ ...initialStates })
setLocalQuick({ observer: 0, reperer: 0, phrase: false })
setMapAction(null)         // reste local
setCombatMode('normal')
setMeleeAttackCount(1)     // reste local
setMeleePendingMode(false) // reste local
setPendingMove(null)       // reste local
setAssaultTarget(null)     // reste local
setMeleeTargets([])        // reste local
setChargeSelection(null)   // reste local
setAssaultBulletCount(null)// reste local
setAssaultVariantAB('A')   // reste local
setSelectedGmMeleeWeaponId(null) // reste local
setSelectedDroneWeaponId(null)   // reste local
setDroneWeapons([])              // reste local
setIsSelectingOnMap(false)       // reste local

// Auto-draw partiel L.519 (dans le onClick de "attack") :
setLocalStates(prev => ({ ...prev, weapon: 'drawn' }))
```

### États communs actuels — CombatActionWindow.jsx

```js
// L.85–91 — états tactiques PJ actif
const [states, setStates] = useState({
  position: 'standing', weapon: 'holstered', fire_mode: 'cc',
  cover: 'exposed',     vitesse: 'normal',
})

// L.111 — actions rapides (même structure que localQuick GM)
const [quick, setQuick] = useState({ observer: 0, reperer: 0, phrase: false })

// L.134 — mode de combat
const [combatMode, setCombatMode] = useState('normal')

// Reset 1 — L.156–180 (useEffect([rosterEntry?.token_id])) :
setStates({ ...snap })          // snap = rosterEntry states
setQuick({ observer: 0, reperer: 0, phrase: false })
setCombatMode('normal')
// + autres états locaux (restent locaux)

// Reset 2 — L.225–245 (useEffect([rosterEntry?.has_announced])) :
// ⚠️ NE remet PAS states (position/weapon/etc.) — uniquement quick + combatMode + états locaux
setQuick({ observer: 0, reperer: 0, phrase: false })
setCombatMode('normal')
// + setMapSelected(new Set()), setAssaultPendingTokenId(null), etc. (restent locaux)

// Auto-sélection arme CaC L.260–264 (useEffect([isDrone, playerToken?.id, phase])) :
const firstMeleeWeapon = items.find(item =>
  (item.slot === 'MG' || item.slot === 'MD' || item.slot === '2M') &&
  item.ref_category === 'Arme de contact'
)
if (firstMeleeWeapon) setSelectedMeleeWeaponId(firstMeleeWeapon.id)
// → SUPPRIMÉ dans REWORK-06 (null = mains nues explicite)

// Block assaut si weapon !== 'drawn' L.879–886 :
if ((a.k === 'attack' || a.k === 'melee') && states.weapon !== 'drawn' && !isDrone) {
  return <div style={W.itemGreyed}>…</div>
}
// → REMPLACÉ par auto-draw via SELECT_ATTACK dans REWORK-06
```

### États qui restent locaux dans les deux composants (hors périmètre)

| Composant | État local (hors périmètre) |
|---|---|
| GM | `declareError`, `equipment`, `rosterOpen`, `mapAction`, `meleeAttackCount`, `meleePendingMode`, `pendingMove`, `assaultTarget`, `meleeTargets`, `chargeSelection`, `assaultBulletCount`, `assaultVariantAB`, `selectedGmMeleeWeaponId`, `selectedDroneWeaponId`, `droneWeapons`, `isSelectingOnMap` |
| Player | `declareError`, `mapSelected`, `allures`, `assaultWeapons`, `allInventoryItems`, `selectedAmmoId`, `assaultPendingTokenId`, `assaultBulletCount`, `assaultVariantAB`, `isDualWield`, `inMoveMode`, `droneWeapons`, `selectedDroneWeaponId`, `inTargetMode`, `moveSelection`, `meleePendingTokenIds`, `meleeCount`, `selectedMeleeWeaponId`, `inMeleeTargetMode`, `rosterOpen` |

---

## INTERFACE CIBLE

### `client/src/lib/declarationReducer.js` (nouveau)

```js
// Reducer pur — zéro import React, zéro effet de bord.
// Partagé par CombatGmDeclareWindow et CombatActionWindow.

export const DECLARATION_INITIAL = {
  position:    'standing',
  weapon:      'holstered',
  fire_mode:   'cc',
  cover:       'exposed',
  vitesse:     'normal',
  combatMode:  'normal',
  quick: { observer: 0, reperer: 0, phrase: false },
}

/**
 * @param {object} state
 * @param {{ type: string, [key: string]: any }} action
 * @returns {object}
 */
export function declarationReducer(state, action) {
  switch (action.type) {
    // Modification d'un seul champ tactique (position/weapon/fire_mode/cover/vitesse)
    case 'SET_FIELD':
      return { ...state, [action.key]: action.value }

    // Mode de combat (normal/offensif/charge/defensif/retraite)
    case 'SET_COMBAT_MODE':
      return { ...state, combatMode: action.mode }

    // Action rapide (observer/reperer/phrase)
    case 'SET_QUICK':
      return { ...state, quick: { ...state.quick, [action.key]: action.value } }

    // Auto-draw : sélectionner assaut force weapon → 'drawn' atomiquement
    // Remplace le code ad-hoc dans GM (L.519) et lève le blocage Player (L.879)
    case 'SELECT_ATTACK':
      return { ...state, weapon: 'drawn' }

    // Reset complet sur changement de slot.
    // action.payload = { position, weapon, fire_mode, cover, vitesse } depuis rosterEntry.
    // Fusionne avec DECLARATION_INITIAL pour remettre combatMode et quick à zéro.
    case 'RESET':
      return { ...DECLARATION_INITIAL, ...action.payload }

    // Reset partiel nouveau tour (has_announced → false sans changement de token_id).
    // Remet uniquement quick + combatMode à zéro — NE touche PAS position/weapon/etc.
    // Comportement fidèle à l'actuel setCombatMode('normal') + setQuick({...}) de Reset 2.
    case 'RESET_NEW_TURN':
      return { ...state, combatMode: 'normal', quick: { observer: 0, reperer: 0, phrase: false } }

    default:
      return state
  }
}
```

### Usage dans CombatGmDeclareWindow (après migration)

```js
import { useReducer } from 'react'
import { declarationReducer, DECLARATION_INITIAL } from '../lib/declarationReducer'

// AVANT (3 useState) :
const [localStates, setLocalStates] = useState({ ...STATE_DEFAULTS })
const [localQuick,  setLocalQuick]  = useState({ observer: 0, reperer: 0, phrase: false })
const [combatMode,  setCombatMode]  = useState('normal')

// APRÈS (1 useReducer) :
const [decl, dispatch] = useReducer(declarationReducer, DECLARATION_INITIAL)
// Accès : decl.position, decl.weapon, decl.fire_mode, decl.cover, decl.vitesse
//         decl.combatMode, decl.quick.observer, decl.quick.reperer, decl.quick.phrase

// Reset (useEffect([activeTokenId])) — AVANT (12 lignes) :
setLocalStates({ ...initialStates })
setLocalQuick({ observer: 0, reperer: 0, phrase: false })
setCombatMode('normal')
// → APRÈS (1 ligne) :
dispatch({ type: 'RESET', payload: { ...initialStates } })

// Auto-draw (onClick attack) — AVANT :
setLocalStates(prev => ({ ...prev, weapon: 'drawn' }))
// → APRÈS :
dispatch({ type: 'SELECT_ATTACK' })

// Modification état tactique — AVANT :
setLocalStates(s => ({ ...s, position: v }))
// → APRÈS :
dispatch({ type: 'SET_FIELD', key: 'position', value: v })

// Modification fire_mode + reset variant — AVANT :
setLocalStates(s => ({ ...s, fire_mode: v }))
setAssaultBulletCount(null)
setAssaultVariantAB('A')
// → APRÈS (setAssaultBulletCount et setAssaultVariantAB restent locaux) :
dispatch({ type: 'SET_FIELD', key: 'fire_mode', value: v })
setAssaultBulletCount(null)
setAssaultVariantAB('A')

// Mode combat — AVANT :
setCombatMode(mode)
// → APRÈS :
dispatch({ type: 'SET_COMBAT_MODE', mode })

// Action rapide — AVANT :
setLocalQuick(q => ({ ...q, observer: val }))
// → APRÈS :
dispatch({ type: 'SET_QUICK', key: 'observer', value: val })
```

### Usage dans CombatActionWindow (après migration)

```js
import { useReducer } from 'react'
import { declarationReducer, DECLARATION_INITIAL } from '../lib/declarationReducer'

// AVANT (3 useState) :
const [states,     setStates]     = useState({ position: 'standing', ... })
const [quick,      setQuick]      = useState({ observer: 0, reperer: 0, phrase: false })
const [combatMode, setCombatMode] = useState('normal')

// APRÈS (1 useReducer) :
const [decl, dispatch] = useReducer(declarationReducer, DECLARATION_INITIAL)

// Refs initialStates (useRef) — inchangées. initialStates.current garde le même rôle.
// Seul setStates({...snap}) dans le useEffect([rosterEntry?.token_id]) devient :
dispatch({ type: 'RESET', payload: { ...snap } })
// (snap = { position, weapon, fire_mode, cover, vitesse } depuis rosterEntry)
// combatMode + quick remis à zéro automatiquement par RESET.

// Reset 2 — useEffect([rosterEntry?.has_announced]) :
// AVANT (wasAnnounced && !isAnnounced) :
// setQuick({ observer: 0, reperer: 0, phrase: false })
// setCombatMode('normal')
// (PAS de setStates — comportement actuel confirmé à la lecture du fichier)
// → APRÈS : RESET_NEW_TURN remet uniquement quick + combatMode, ne touche pas decl.position etc.
dispatch({ type: 'RESET_NEW_TURN' })
// Les autres setters locaux (setAssaultPendingTokenId, etc.) restent inchangés.

// Auto-draw — AVANT : bouton assaut bloqué si weapon !== 'drawn' (L.879).
// → APRÈS : le blocage est retiré. Cliquer "Assaut" appelle handleMapToggle('attack').
// handleMapToggle doit dispatcher SELECT_ATTACK si 'attack' pas encore dans mapSelected :
const handleMapToggle = (k) => {
  setMapSelected(prev => {
    const next = new Set(prev)
    if (next.has(k)) {
      next.delete(k)
      if (k === 'attack') {
        setAssaultPendingTokenId(null)
        setAssaultBulletCount(null)
        setAssaultVariantAB('A')
        setIsDualWield(false)
        setInTargetMode(false)
      }
      // ...
    } else {
      next.add(k)
      if (k === 'attack') dispatch({ type: 'SELECT_ATTACK' }) // ← AJOUT
    }
    return next
  })
}

// Mains nues — SUPPRESSION L.260–264 (useEffect auto-sélection arme) :
// AVANT :
// const firstMeleeWeapon = items.find(...)
// if (firstMeleeWeapon) setSelectedMeleeWeaponId(firstMeleeWeapon.id)
// → APRÈS : ligne supprimée. null = mains nues par défaut.
// (selectedMeleeWeaponId reste un useState local — la suppression est dans le useEffect)

// Lecture états dans le JSX — AVANT :
// states.position, states.weapon, states.fire_mode, states.cover, states.vitesse
// combatMode, quick.observer, quick.reperer, quick.phrase
// → APRÈS : decl.position, decl.weapon, ... decl.combatMode, decl.quick.observer, ...

// initialStates.current — inchangé (useRef, comparé contre decl pour stateChanged)
// AVANT : Object.keys(states).some(k => states[k] !== initialStates.current[k])
// → APRÈS : Object.keys(initialStates.current).some(k => decl[k] !== initialStates.current[k])
// (fire_mode + vitesse + position + weapon + cover — pas combatMode, pas quick)
```

---

## PIÈGES IDENTIFIÉS (run à vide)

**P-R06-1 — `initialStates` dans CombatActionWindow est un `useRef`, pas un useState**
`const initialStates = useRef({ position: 'standing', ... })` — L.149.
Il est setté via `initialStates.current = snap` dans `useEffect([rosterEntry?.token_id])`.
Ne pas le confondre avec `decl` (le state du reducer). `initialStates.current` reste
en `useRef` — il n'est PAS migré dans le reducer. Il sert uniquement à calculer
`stateChanged` (diff entre initial de tour et courant).

**P-R06-2 — CombatGmDeclareWindow a `initialStates` en variable dérivée (pas un ref)**
```js
// L.128–136 — dérivé du rosterEntry à chaque render (pas un useRef)
const initialStates = activePnjEntry
  ? { position: activePnjEntry.state_position ?? 'standing', ... }
  : { ...STATE_DEFAULTS }
```
Le `dispatch({ type: 'RESET', payload: { ...initialStates } })` dans le useEffect
doit utiliser CETTE variable (pas un ref). Ordre de déclaration : `initialStates`
(variable dérivée) doit rester AVANT le `useEffect([activeTokenId])` — vérifier
post-migration.

**P-R06-3 — `combatMode` lu dans le payload `handleDeclare`**
Dans les deux composants, `combatMode` est envoyé via socket dans `state.combat_mode`.
Après migration : `decl.combatMode` remplace `combatMode` dans le payload — vérifier
TOUTES les références à `combatMode` dans `handleDeclare` des deux composants.

**P-R06-4 — Reset 2 de CombatActionWindow ne doit PAS dispatche RESET**
Reset 2 (L.225–245) remet uniquement `quick` et `combatMode` — PAS `states`.
Utiliser `RESET_NEW_TURN` (fidèle) et non `RESET` (changerait aussi position/weapon/etc.).
Vérifier : après Reset 2, `decl.position` doit garder sa valeur du tour courant.

**P-R06-5 — Auto-draw Player : `states.weapon` utilisé dans `stateChanged` et `canDeclare`**
Après `SELECT_ATTACK`, `decl.weapon === 'drawn'` alors que `initialStates.current.weapon`
peut être `'holstered'`. `stateChanged` devient `true` → attendu (l'arme a changé).
`canDeclare` : `hasAnyAction || stateChanged` → toujours `true` après auto-draw → attendu.

**P-R06-6 — Mains nues : comportement visible dans le JSX**
Supprimer L.260–264 signifie que `selectedMeleeWeaponId` reste `null` après fetch inventaire.
Dans `MeleeCombatPanel`, `selectedWeaponId={selectedMeleeWeaponId}` = null.
Vérifier que `MeleeCombatPanel` affiche correctement "Mains nues" quand `selectedWeaponId = null`
avant de valider.

**P-R06-7 — `decl` doit être mentionné dans les deps des useCallback qui lisent ses champs**
Partout où un `useCallback` lit `decl.weapon`, `decl.combatMode`, etc., ajouter `decl`
aux deps. Zustand avait P3 pour socket — `useReducer` a le même problème pour les closures.

**P-R06-8 — `fire_mode` reset dans `CombatGmDeclareWindow` useEffect([activeTokenId, equipment])**
L.185–191 reset `fire_mode` si l'arme chargée ne supporte pas le mode courant :
```js
setLocalStates(s => ({ ...s, fire_mode: modes[0] }))
```
→ `dispatch({ type: 'SET_FIELD', key: 'fire_mode', value: modes[0] })`
Même chose dans CombatActionWindow L.269–280.

**P-R06-9 — CombatActionWindow : deux effets sur `rosterEntry?.token_id` — l'un doit être supprimé**
Il existe un PREMIER `useEffect([rosterEntry?.token_id])` à L.96–105 qui fait uniquement
`setStates({...})`. Il est redondant avec l'effet principal L.156–180 qui fait la même chose
plus complètement (`initialStates.current`, tous les resets locaux).
→ **Supprimer l'effet L.96–105 entier** lors de l'Étape 3b. Garder uniquement L.156–180.
Si on laisse L.96–105 sans le migrer, `setStates` n'existe plus → erreur de compilation.

**P-R06-11 — `stateChanged` GM (L.271) — même piège que Player : `Object.keys(decl)` → TOUJOURS true**
```js
// ACTUEL L.271 :
const stateChanged = isActivePnj && Object.keys(localStates).some(k => localStates[k] !== initialStates[k])
// `localStates` a 5 clés → correct.
// APRÈS migration naïve (Object.keys(decl)) :
// decl a 7 clés (+ combatMode, quick) → initialStates.combatMode = undefined → toujours true.
// → canDeclare TOUJOURS true → joueur peut déclarer même sans avoir rien changé. Bug gameplay.
// CORRECT :
const stateChanged = isActivePnj && Object.keys(initialStates).some(k => decl[k] !== initialStates[k])
```

**P-R06-12 — `handleDeclare` GM (L.398) spread `{ ...localStates }` — E8 confirmé**
```js
// ACTUEL L.398 :
state: { ...localStates, combat_mode: combatMode },
// `localStates` a 5 champs tactiques → propre.
// APRÈS migration naïve ({ ...decl, combat_mode: decl.combatMode }) :
// decl a 7 champs → le serveur reçoit `combatMode` et `quick` dans `state` → champs parasites.
// CORRECT (remplacer par les 5 champs explicites) :
state: {
  position:    decl.position,
  weapon:      decl.weapon,
  fire_mode:   decl.fire_mode,
  cover:       decl.cover,
  vitesse:     decl.vitesse,
  combat_mode: decl.combatMode,
},
// L.415 : quick: { ...localQuick } → quick: { ...decl.quick } — pas un spread de decl complet.
```

**P-R06-13 — `handleStartCharge` GM (L.343–366) : deux `setCombatMode('normal')` dans des callbacks**
```js
// L.345 : setCombatMode('charge')          → dispatch({ type: 'SET_COMBAT_MODE', mode: 'charge' })
// L.361 : setCombatMode('normal')           → dispatch({ type: 'SET_COMBAT_MODE', mode: 'normal' })
// L.365 : setCombatMode('normal')           → dispatch({ type: 'SET_COMBAT_MODE', mode: 'normal' })
// Ces deux derniers sont dans des callbacks passés à onEnterMoveMode/onEnterTargetMode.
// dispatch est stable (garanti par useReducer) → pas besoin d'inclure dans les deps.
```

**P-R06-10 — `combatMode` dans les deps de l'effet COMBAT_ANNOUNCE_PREVIEW (L.315)**
L'effet `useEffect` qui émet `COMBAT_ANNOUNCE_PREVIEW` a `combatMode` dans son tableau de deps
à L.315 (deps gérées manuellement — `// eslint-disable-next-line react-hooks/exhaustive-deps`).
Après migration : remplacer `combatMode` par `decl.combatMode` dans les deps ET dans le payload
L.310. Sans cette correction, l'effet ne se re-déclenche plus quand le mode change.

---

## PÉRIMÈTRE

**Fichiers touchés :**
- `client/src/lib/declarationReducer.js` — **créé** (reducer pur, exporté)
- `client/src/components/CombatGmDeclareWindow.jsx` :
  - `useState(localStates)`, `useState(localQuick)`, `useState(combatMode)` → `useReducer`
  - Reset L.107–124 → `dispatch({ type: 'RESET', payload: initialStates })`
  - Auto-draw L.519 → `dispatch({ type: 'SELECT_ATTACK' })`
  - Toutes les références `localStates.x`, `localQuick.x`, `combatMode` → `decl.x`, `decl.quick.x`, `decl.combatMode`
  - fire_mode reset L.188 → `dispatch({ type: 'SET_FIELD', key: 'fire_mode', value: modes[0] })`
- `client/src/components/CombatActionWindow.jsx` :
  - `useState(states)`, `useState(quick)`, `useState(combatMode)` → `useReducer`
  - Effet L.96–105 (`setStates` seul) → **supprimé** (redondant avec L.156–180)
  - Reset 1 (L.156–180, token_id) → `dispatch({ type: 'RESET', payload: snap })`
  - Reset 2 (L.225–245, has_announced) → `dispatch({ type: 'RESET_NEW_TURN' })` ← PAS RESET
  - Auto-sélection arme CaC L.260–264 → **supprimé**
  - Blocage assaut L.879–886 → **supprimé** (auto-draw via `SELECT_ATTACK` dans `handleMapToggle`)
  - `handleMapToggle` : ajout `dispatch({ type: 'SELECT_ATTACK' })` quand `k === 'attack'` ajouté
  - Toutes les références `states.x`, `quick.x`, `combatMode` → `decl.x`, `decl.quick.x`, `decl.combatMode`
  - fire_mode reset L.272 → `dispatch({ type: 'SET_FIELD', key: 'fire_mode', value: modes[0] })`

**Fichiers NON touchés :**
- `client/src/stores/combatStore.js` — non modifié
- `shared/events.js` — aucun event nouveau
- `client/src/components/combatSections.js` — non touché
- `client/src/components/AssaultRangedPanel.jsx`, `MeleeCombatPanel.jsx`, `DroneWeaponPanel.jsx` — non touchés
- `client/src/components/CombatDeclareLog.jsx` — non touché
- Tout le code serveur — non touché
- `SessionPage.jsx`, `CombatOverlay.jsx` — non touchés (props inchangées)

---

## PLAN D'IMPLÉMENTATION

> Étapes 1–3 doivent être faites en séquence. Relire les fichiers avant chaque étape.

### Étape 1 — Créer `client/src/lib/declarationReducer.js`

Contenu exactement conforme à l'interface cible §declarationReducer.
Aucun fichier existant modifié à cette étape.
Run à vide : `npm run build` client — zéro erreur.

---

### Étape 2 — Migrer `CombatGmDeclareWindow.jsx`

**Lire `CombatGmDeclareWindow.jsx` avant de coder — vérifier les lignes exactes.**

**2a — Import** (en tête du fichier, après les imports existants) :
```js
import { useReducer } from 'react'
import { declarationReducer, DECLARATION_INITIAL } from '../lib/declarationReducer'
```
Retirer `useState` de l'import React si plus utilisé après migration (vérifier — `declareError`,
`equipment`, `rosterOpen` etc. restent en useState, donc `useState` reste dans l'import).

**2b — Remplacer les 3 useState par useReducer** (chercher par contenu) :
```js
// SUPPRIMER :
const [localStates, setLocalStates] = useState({ ...STATE_DEFAULTS })
const [localQuick,  setLocalQuick]  = useState({ observer: 0, reperer: 0, phrase: false })
const [combatMode,  setCombatMode]  = useState('normal')
// AJOUTER (à la même position) :
const [decl, dispatch] = useReducer(declarationReducer, DECLARATION_INITIAL)
```

**2c — Reset useEffect([activeTokenId])** — remplacer les 3 setters par 1 dispatch :
```js
// SUPPRIMER (dans le useEffect) :
setLocalStates({ ...initialStates })
setLocalQuick({ observer: 0, reperer: 0, phrase: false })
setCombatMode('normal')
// AJOUTER (à la place) :
dispatch({ type: 'RESET', payload: { ...initialStates } })
```
⚠️ P-R06-2 : `initialStates` est déclaré APRÈS le useEffect dans le code actuel (L.128) —
c'est une variable dérivée du render, pas un hook. Vérifier que `initialStates` est toujours
lisible dans l'effet (il l'est : les effets React capturent les variables du render courant).

**2d — Auto-draw** (dans le onClick du bouton attack, actuellement L.519) :
```js
// AVANT :
setLocalStates(prev => ({ ...prev, weapon: 'drawn' }))
// APRÈS :
dispatch({ type: 'SELECT_ATTACK' })
```

**2e — fire_mode reset useEffect([activeTokenId, equipment])** (L.188) :
```js
// AVANT :
setLocalStates(s => ({ ...s, fire_mode: modes[0] }))
// APRÈS :
dispatch({ type: 'SET_FIELD', key: 'fire_mode', value: modes[0] })
```

**2f — InlineChip onChange** — toutes les occurrences de `setLocalStates` dans les chips :
```js
// AVANT :
onChange={v => setLocalStates(s => ({ ...s, [k]: v }))}
// APRÈS :
onChange={v => dispatch({ type: 'SET_FIELD', key: k, value: v })}
```
Pour fire_mode spécifiquement (avec reset variant) :
```js
// AVANT :
onChange={v => {
  setLocalStates(s => ({ ...s, [k]: v }))
  if (k === 'fire_mode') { setAssaultBulletCount(null); setAssaultVariantAB('A') }
}}
// APRÈS :
onChange={v => {
  dispatch({ type: 'SET_FIELD', key: k, value: v })
  if (k === 'fire_mode') { setAssaultBulletCount(null); setAssaultVariantAB('A') }
}}
```

**2g — setCombatMode** — toutes les occurrences :
```js
// AVANT : setCombatMode(mode) ou setCombatMode('normal') ou setCombatMode('charge')
// APRÈS : dispatch({ type: 'SET_COMBAT_MODE', mode })
// Grep : setCombatMode dans CombatGmDeclareWindow — confirmer toutes les occurrences
```

**2h — setLocalQuick** — toutes les occurrences :
```js
// AVANT : setLocalQuick(q => ({ ...q, [qa.k]: val }))
// APRÈS : dispatch({ type: 'SET_QUICK', key: qa.k, value: val })
```

**2i — Inventaire exhaustif GM (grep confirmé Session 113)** :
```js
// Dérivées (render body) :
// L.189 : localStates.fire_mode (fire_mode reset effect)             → decl.fire_mode
// L.236 : calcIniDelta(initialStates, localStates, {...}, localQuick)
//         → calcIniDelta(initialStates, decl, {...}, decl.quick)
//         ✓ SAFE : calcIniDelta boucle sur liste fixe ['position','weapon',...] — pas Object.keys
// L.247 : combatMode === 'defensif' || combatMode === 'retraite'      → decl.combatMode
// L.248 : combatMode === 'charge' ? 1 : ...                          → decl.combatMode
// L.260 : localStates.fire_mode.toUpperCase()                        → decl.fire_mode
// L.271 : Object.keys(localStates).some(k => localStates[k] !== initialStates[k])
//         → Object.keys(initialStates).some(k => decl[k] !== initialStates[k])
//         ⚠️ P-R06-11 : Object.keys(decl) inclut combatMode + quick → toujours true sinon
// L.279 : combatMode !== 'normal'                                     → decl.combatMode
// L.280 : localQuick.observer > 0 || localQuick.reperer > 0 || localQuick.phrase
//         → decl.quick.observer > 0 || decl.quick.reperer > 0 || decl.quick.phrase

// handleStartCharge callbacks (L.343–366) :
// L.345 : setCombatMode('charge')   → dispatch({ type: 'SET_COMBAT_MODE', mode: 'charge' })
// L.361 : setCombatMode('normal')   → dispatch({ type: 'SET_COMBAT_MODE', mode: 'normal' })
// L.365 : setCombatMode('normal')   → dispatch({ type: 'SET_COMBAT_MODE', mode: 'normal' })

// Chips TACTIQUE (L.455–461) :
// L.458 : current={localStates[k]}                                   → current={decl[k]}
// L.459 : setLocalStates(s => ({ ...s, [k]: v }))                   → dispatch(SET_FIELD, k, v)

// Chips ARMEMENT (L.468–477) :
// L.471 : current={localStates[k]}                                   → current={decl[k]}
// L.474 : setLocalStates(s => ({ ...s, [k]: v }))                   → dispatch(SET_FIELD, k, v)
// L.475 : if (k === 'fire_mode') { setAssaultBulletCount(null); ... } → inchangé (local)

// ACTION grid onClick (L.504–531) :
// L.487 : localStates.weapon !== 'drawn' (weaponNotDrawn var)        → decl.weapon
// L.516 : if (localStates.weapon !== 'drawn')                        → decl.weapon
// L.517 : setLocalStates(prev => ({ ...prev, weapon: 'drawn' }))    → dispatch({ type: 'SELECT_ATTACK' })
//         Garder le if : if (decl.weapon !== 'drawn') dispatch(SELECT_ATTACK)
// L.525 : setCombatMode('normal')  (melee deselect)                  → dispatch(SET_COMBAT_MODE 'normal')

// ACTIONS RAPIDES (L.569–602) :
// L.571 : localQuick[qa.k]                                           → decl.quick[qa.k]
// L.576 : setLocalQuick(q => ({ ...q, [qa.k]: 1 }))                → dispatch(SET_QUICK, qa.k, 1)
// L.583 : setLocalQuick(q => ({ ...q, [qa.k]: Number(...) }))       → dispatch(SET_QUICK, qa.k, Number(...))
// L.591 : localQuick[qa.k]                                           → decl.quick[qa.k]
// L.596 : setLocalQuick(q => ({ ...q, [qa.k]: !q[qa.k] }))         → dispatch(SET_QUICK, qa.k, !decl.quick[qa.k])

// PANNEAU DROIT — onWeaponChange MeleeCombatPanel (L.771–778) :
// L.773 : localStates.weapon !== 'drawn'                             → decl.weapon
// L.774 : setLocalStates(prev => ({ ...prev, weapon: 'drawn' }))    → dispatch(SET_FIELD, 'weapon', 'drawn')
// L.775 : localStates.weapon !== 'holstered'                         → decl.weapon
// L.776 : setLocalStates(prev => ({ ...prev, weapon: 'holstered' })) → dispatch(SET_FIELD, 'weapon', 'holstered')

// PANNEAU DROIT — MeleeCombatPanel props (L.779–783) :
// L.779 : combatMode={combatMode}                                    → combatMode={decl.combatMode}
// L.781 : setCombatMode(mode)   (onModeChange)                       → dispatch(SET_COMBAT_MODE, mode)
```

**2j — handleDeclare payload** (L.396–416) — ⚠️ P-R06-12 — NE PAS spreader `decl` :
```js
// ACTUEL L.398 :
state: { ...localStates, combat_mode: combatMode },
// APRÈS migration (5 champs explicites — pas { ...decl }) :
state: {
  position:    decl.position,
  weapon:      decl.weapon,
  fire_mode:   decl.fire_mode,
  cover:       decl.cover,
  vitesse:     decl.vitesse,
  combat_mode: decl.combatMode,
},
// L.415 :
quick: { ...localQuick },   →   quick: { ...decl.quick }
```

Run à vide : `npm run build` client — zéro erreur.

---

### Étape 3 — Migrer `CombatActionWindow.jsx`

**Lire `CombatActionWindow.jsx` avant de coder — vérifier les lignes exactes.**

**3a — Import** :
```js
import { useReducer } from 'react'
import { declarationReducer, DECLARATION_INITIAL } from '../lib/declarationReducer'
```

**3b — Remplacer les 3 useState par useReducer** :
```js
// SUPPRIMER :
const [states,     setStates]     = useState({ position: 'standing', ... })
const [quick,      setQuick]      = useState({ observer: 0, reperer: 0, phrase: false })
const [combatMode, setCombatMode] = useState('normal')
// AJOUTER (même position, après prevHasAnnouncedRef et declareError) :
const [decl, dispatch] = useReducer(declarationReducer, DECLARATION_INITIAL)
```
⚠️ Règle TDZ : `useReducer` est un hook — le placer avec les autres hooks, pas entre des
variables dérivées.

**3c — Supprimer l'effet redondant L.96–105** (⚠️ P-R06-9) :
Il existe un premier `useEffect([rosterEntry?.token_id])` à L.96–105 qui fait uniquement
`setStates({...})`. Il est rendu obsolète par l'effet principal ci-dessous. **Supprimer ce
bloc entier** — sinon `setStates` n'existe plus après l'Étape 3b → erreur de compilation.

**3c-bis — Reset 1 useEffect([rosterEntry?.token_id])** (L.156–180) :
```js
// Dans l'effet existant, REMPLACER :
setStates({ ...snap })
setQuick({ observer: 0, reperer: 0, phrase: false })
setCombatMode('normal')
// PAR :
dispatch({ type: 'RESET', payload: { ...snap } })
// snap est déjà construit dans l'effet : { position, weapon, fire_mode, cover, vitesse }
// RESET fusionne snap avec DECLARATION_INITIAL → quick + combatMode remis à zéro aussi.
```
Les autres setters (`setAssaultPendingTokenId(null)`, `setMapSelected(new Set())`, etc.) restent inchangés.

**3d — Reset 2 useEffect([rosterEntry?.has_announced])** (L.225–245) :
```js
// DANS le if (wasAnnounced && !isAnnounced), REMPLACER :
setQuick({ observer: 0, reperer: 0, phrase: false })
setCombatMode('normal')
// PAR (⚠️ P-R06-4 — RESET_NEW_TURN, pas RESET — ne pas reset states) :
dispatch({ type: 'RESET_NEW_TURN' })
```
Les autres setters locaux (`setMapSelected(new Set())`, `setAssaultPendingTokenId(null)`, etc.)
restent inchangés — ils ne font pas partie du reducer.

**3e — Supprimer auto-sélection arme CaC** (L.260–264, dans le useEffect inventaire) :
```js
// SUPPRIMER ces lignes :
const firstMeleeWeapon = items.find(item =>
  (item.slot === 'MG' || item.slot === 'MD' || item.slot === '2M') &&
  item.ref_category === 'Arme de contact'
)
if (firstMeleeWeapon) setSelectedMeleeWeaponId(firstMeleeWeapon.id)
```
`selectedMeleeWeaponId` reste `null` après fetch → mains nues par défaut (P-R06-6).

**3e-bis — COMBAT_ANNOUNCE_PREVIEW effect** (L.297–315) — ⚠️ P-R06-10 :
```js
// Payload L.310 :
// AVANT : combatMode,
// APRÈS : combatMode: decl.combatMode,

// Deps L.315 (gérées manuellement — eslint-disable déjà présent) :
// AVANT : [..., combatMode]
// APRÈS : [..., decl.combatMode]
```
Ne pas ajouter `decl` entier aux deps — déclenche le preview sur TOUS les changements
de `decl` (position, weapon, etc.), ce qui n'est pas le comportement actuel.
Garder uniquement `decl.combatMode` pour reproduire le comportement de `combatMode`.

**3f — Auto-draw + deselect melee dans handleMapToggle** (L.412–442) :
```js
// SÉLECTION (branche else) — ajouter après next.add(k) :
if (k === 'attack') dispatch({ type: 'SELECT_ATTACK' })
// Note : SELECT_ATTACK uniquement pour 'attack' (assaut distant).
// 'melee' (CaC) ne requiert pas de dégainage — mains nues toujours disponibles.

// DÉSELECTION melee (branche if next.has(k), L.426–433) :
// AVANT :
// setCombatMode('normal')
// APRÈS :
dispatch({ type: 'SET_COMBAT_MODE', mode: 'normal' })
// Les autres setters (setMeleePendingTokenIds, setMeleeCount, etc.) restent locaux.
```

**3g — Supprimer le blocage assaut** (L.879–886) :
```js
// SUPPRIMER ce bloc entier :
if ((a.k === 'attack' || a.k === 'melee') && states.weapon !== 'drawn' && !isDrone) {
  return (
    <div key={a.k} title="Arme non au clair — dégainez d'abord (section ARMEMENT)" style={{ ...W.itemGreyed, ...span2 }}>
      <span style={W.itemLabel}>{a.l}</span>
    </div>
  )
}
```
Le StateSelector ARMEMENT reste (le joueur peut toujours changer weapon manuellement).
L'auto-draw via SELECT_ATTACK se déclenche en plus quand le joueur clique Assaut.

**3h — fire_mode reset useEffect([assaultWeapons])** (L.269–280) :
```js
// AVANT :
setStates(s => ({ ...s, fire_mode: modes[0] }))
// APRÈS :
dispatch({ type: 'SET_FIELD', key: 'fire_mode', value: modes[0] })
```

**3i — setStates / setQuick / setCombatMode** — toutes occurrences restantes :
```js
// setStates(s => ({ ...s, position: v }))  → dispatch({ type: 'SET_FIELD', key: 'position', value: v })
// setStates(s => ({ ...s, fire_mode: v })) → dispatch({ type: 'SET_FIELD', key: 'fire_mode', value: v })
// setStates(s => ({ ...s, cover: v }))     → dispatch({ type: 'SET_FIELD', key: 'cover', value: v })
// setStates(s => ({ ...s, vitesse: v }))   → dispatch({ type: 'SET_FIELD', key: 'vitesse', value: v })
// setStates(s => ({ ...s, weapon: v }))    → dispatch({ type: 'SET_FIELD', key: 'weapon', value: v })
// setCombatMode(mode)  → dispatch({ type: 'SET_COMBAT_MODE', mode })
// setQuick(q => ...)   → dispatch({ type: 'SET_QUICK', key: ..., value: ... })
```

**3j — Lectures dans le JSX et les dérivées — inventaire exhaustif (grep confirmé)** :
```js
// Variables dérivées (render body) :
// L.358 : const fireModeUpper = states.fire_mode.toUpperCase()      → decl.fire_mode
// L.391 : const meleeDefensif = combatMode === 'defensif' || ...    → decl.combatMode
// L.473 : mapActionsObj move ini_mod (combatMode)                   → decl.combatMode
// L.474 : mapActionsObj attack cover_shot (states.cover)            → decl.cover
// L.478 : Array(combatMode === 'charge' ? 1 : ...)                  → decl.combatMode
// L.492 : effectiveMeleeCount (combatMode === 'charge')             → decl.combatMode
// L.495 : canDeclare melee (combatMode !== 'charge')                → decl.combatMode
// L.502 : stateChanged — Object.keys(initialStates.current).some(k => states[k] !== ...)
//         → Object.keys(initialStates.current).some(k => decl[k] !== initialStates.current[k])

// handleDeclare payload (L.508–540) :
// L.513–518 : states.position/weapon/fire_mode/cover/vitesse        → decl.*
// L.518 :     combat_mode: combatMode                               → decl.combatMode
// L.525 :     ini_mod (combatMode)                                  → decl.combatMode
// L.531, 540: cover_shot (states.cover)                             → decl.cover

// JSX direct :
// L.811 : StateSelector current={states.position}                   → decl.position
// L.817 : StateSelector current={states.cover}                      → decl.cover
// L.823 : StateSelector current={states.vitesse}                    → decl.vitesse
// L.835 : StateSelector current={states.weapon}                     → decl.weapon
// L.838 : highlightKey={states.weapon !== 'drawn' ? 'drawn' : ...}  → decl.weapon
// L.842 : StateSelector current={states.fire_mode}                  → decl.fire_mode
// L.879 : states.weapon !== 'drawn' (le bloc — SUPPRIMÉ en 3g)      → n/a
// L.945 : combatMode === 'charge' || combatMode === 'retraite'       → decl.combatMode
// L.978 : attackSelected && states.cover !== 'exposed'               → decl.cover
// L.991 : states.cover === 'important' ? '-5' : '-3'                 → decl.cover

// Props vers MeleeCombatPanel (L.1112–1135) :
// L.1120 : isWeaponDrawn={states.weapon === 'drawn'}                 → decl.weapon
// L.1123 : combatMode={combatMode}                                   → decl.combatMode
// L.1124 : onModeChange={(mode) => { setCombatMode(mode) ... }}
//          → dispatch({ type: 'SET_COMBAT_MODE', mode })
// L.1128 : if (combatMode === 'charge')                              → decl.combatMode
// L.1131 : if (combatMode === 'charge')                              → decl.combatMode

// handleChargeFlow (L.744–773) :
// L.745 : setCombatMode('charge')  → dispatch({ type: 'SET_COMBAT_MODE', mode: 'charge' })
// L.771 : setCombatMode('normal')  → dispatch({ type: 'SET_COMBAT_MODE', mode: 'normal' })
//         (callback onCancel de onEnterMoveMode — dispatch stable, pas de deps à ajouter)

// StateSelector onChange (L.812–843) :
// L.812 : setStates(s => ({...s, position: v}))   → dispatch(SET_FIELD, 'position', v)
// L.818 : setStates(s => ({...s, cover: v}))       → dispatch(SET_FIELD, 'cover', v)
// L.824 : setStates(s => ({...s, vitesse: v}))     → dispatch(SET_FIELD, 'vitesse', v)
// L.836 : setStates(s => ({...s, weapon: v}))      → dispatch(SET_FIELD, 'weapon', v)
// L.843 : setStates(s => ({...s, fire_mode: v}))   → dispatch(SET_FIELD, 'fire_mode', v)

// quick (ACTIONS RAPIDES + dérivées) :
// L.481 : calcIniDelta(initialStates.current, states, mapActionsObj, quick)
//         → calcIniDelta(initialStates.current, decl, mapActionsObj, decl.quick)
//         ✓ SAFE : même raison qu'en GM — boucle sur liste fixe de 5 clés
// L.498 : quick.observer > 0 || quick.reperer > 0 || quick.phrase (hasAnyAction)
//         → decl.quick.observer > 0 || decl.quick.reperer > 0 || decl.quick.phrase
// L.1003 : quick.phrase / quick[a.k]                                 → decl.quick.phrase / decl.quick[a.k]
// L.1012 : setQuick(q => ({ ...q, phrase: !q.phrase }))
//          → dispatch({ type: 'SET_QUICK', key: 'phrase', value: !decl.quick.phrase })
// L.1014 : setQuick(q => ({ ...q, [a.k]: q[a.k] > 0 ? 0 : 1 }))
//          → dispatch({ type: 'SET_QUICK', key: a.k, value: decl.quick[a.k] > 0 ? 0 : 1 })
// L.1033 : setQuick(q => ({ ...q, [a.k]: parseInt(e.target.value) }))
//          → dispatch({ type: 'SET_QUICK', key: a.k, value: parseInt(e.target.value) })
```
`initialStates.current` reste inchangé (useRef).

**3k — handleDeclare payload** (L.508–558) :
```js
// state : déjà en champs explicites dans Player (pas de spread) — substitution directe :
state: {
  position:    decl.position,    // L.513
  weapon:      decl.weapon,      // L.514
  fire_mode:   decl.fire_mode,   // L.515
  cover:       decl.cover,       // L.516
  vitesse:     decl.vitesse,     // L.517
  combat_mode: decl.combatMode,  // L.518
},
// mapActions : cover_shot lu depuis states.cover (L.531 + L.540) → decl.cover
// ini_mod (L.525) : combatMode → decl.combatMode
// quick : Player envoie aussi quick (L.553–557)
quick: {
  observer: decl.quick.observer,
  reperer:  decl.quick.reperer,
  phrase:   decl.quick.phrase,
},
```

Run à vide : SR + `npm run build` — ouvrir une session, entrer en combat, phase ANNOUNCEMENT.

---

## VALIDATION

| # | Scénario | Résultat attendu |
|---|---|---|
| V1 | Phase ANNOUNCEMENT — GM, slot PNJ actif | Fenêtre GM affiche états tactiques corrects (depuis rosterEntry) |
| V2 | GM change position/cover/vitesse via InlineChip | `decl.position` etc. mis à jour, `iniDelta` recalculé |
| V3 | GM clique "Assaut" (arme distante) | Weapon auto-passe à 'drawn' **atomiquement**, bouton actif |
| V4 | GM clique "CaC" | Panneau CaC s'ouvre, weapon reste inchangé (pas de SELECT_ATTACK) |
| V5 | Slot GM change (slot suivant) | Reset complet — tous champs revenus à initial rosterEntry |
| V6 | Phase ANNOUNCEMENT — Player, slot PJ actif | Fenêtre Player affiche états tactiques corrects |
| V7 | Player clique "Assaut" | Weapon auto-passe à 'drawn', panneau assaut s'ouvre |
| V8 | Player clique "CaC" sans arme équipée | Panneau CaC s'ouvre, `selectedMeleeWeaponId = null` = mains nues |
| V9 | Player clique "CaC" avec arme de contact | Panel CaC s'ouvre, `selectedMeleeWeaponId = null` (pas d'auto-sélection) |
| V10 | Player change fire_mode | `decl.fire_mode` mis à jour, StateSelector reflète le changement |
| V11 | Player déclare l'action | Payload socket correct : `state.weapon`, `state.combat_mode`, `quick` conformes |
| V12 | GM déclare l'action | Payload socket correct : `state.combat_mode`, arme et états inclus |
| V13 | Nouveau tour (has_announced true → false) | `decl.combatMode === 'normal'`, `decl.quick` remis à zéro — `decl.position/weapon` inchangés |
| V14 | Mode CaC — defensif | `decl.combatMode === 'defensif'`, `meleeDefensif === true` |
| V15 | `npm run build` | Zéro erreur, zéro warning TypeScript |

---

## DEFINITION OF DONE

### declarationReducer.js

- [ ] `client/src/lib/declarationReducer.js` créé — `DECLARATION_INITIAL` + `declarationReducer` exportés
- [ ] Actions : `SET_FIELD`, `SET_COMBAT_MODE`, `SET_QUICK`, `SELECT_ATTACK`, `RESET`, `RESET_NEW_TURN`
- [ ] `SELECT_ATTACK` : uniquement `weapon → 'drawn'` — n'affecte pas `combatMode` ni `quick`
- [ ] `RESET` : merge `DECLARATION_INITIAL` + payload — `combatMode` et `quick` remis à zéro systématiquement
- [ ] `RESET_NEW_TURN` : remet uniquement `combatMode → 'normal'` + `quick → {0,0,false}` — NE touche PAS position/weapon/fire_mode/cover/vitesse
- [ ] Aucun import React, aucun effet de bord — reducer pur testable en isolation

### CombatGmDeclareWindow.jsx

- [ ] `useState(localStates)`, `useState(localQuick)`, `useState(combatMode)` supprimés
- [ ] `useReducer(declarationReducer, DECLARATION_INITIAL)` ajouté
- [ ] Reset useEffect([activeTokenId]) → `dispatch({ type: 'RESET', payload: { ...initialStates } })`
- [ ] `stateChanged` L.271 : `Object.keys(initialStates).some(k => decl[k] !== initialStates[k])` (P-R06-11)
- [ ] Auto-draw L.516–517 : `if (decl.weapon !== 'drawn') dispatch({ type: 'SELECT_ATTACK' })`
- [ ] fire_mode reset useEffect L.190 → `dispatch({ type: 'SET_FIELD', key: 'fire_mode', value: modes[0] })`
- [ ] Chips TACTIQUE L.459 + ARMEMENT L.474 → `dispatch({ type: 'SET_FIELD', key: k, value: v })`
- [ ] handleStartCharge L.345/361/365 : `setCombatMode` → `dispatch(SET_COMBAT_MODE)`
- [ ] Melee deselect L.525 : `setCombatMode('normal')` → `dispatch(SET_COMBAT_MODE 'normal')`
- [ ] Actions rapides L.576/583/596 : `setLocalQuick` → `dispatch(SET_QUICK)`
- [ ] onWeaponChange MeleeCombatPanel L.773–776 : `localStates.weapon` → `decl.weapon`, setters → `dispatch(SET_FIELD)`
- [ ] onModeChange MeleeCombatPanel L.781 : `setCombatMode(mode)` → `dispatch(SET_COMBAT_MODE, mode)`
- [ ] `combatMode` prop MeleeCombatPanel L.779 → `decl.combatMode`
- [ ] `calcIniDelta(initialStates, decl, {...}, decl.quick)` L.236–244
- [ ] `handleDeclare` L.398 : 5 champs explicites + `combat_mode: decl.combatMode` — PAS `{ ...decl }` (P-R06-12)
- [ ] `handleDeclare` L.415 : `quick: { ...decl.quick }`
- [ ] `npm run build` — zéro erreur

### CombatActionWindow.jsx

- [ ] `useState(states)`, `useState(quick)`, `useState(combatMode)` supprimés
- [ ] `useReducer(declarationReducer, DECLARATION_INITIAL)` ajouté
- [ ] Effet L.96–105 (`setStates` seul) **supprimé** (redondant avec L.156–180)
- [ ] Reset 1 (L.156–180, token_id) → `dispatch({ type: 'RESET', payload: snap })`
- [ ] Reset 2 (L.225–245, has_announced) → `dispatch({ type: 'RESET_NEW_TURN' })`
- [ ] COMBAT_ANNOUNCE_PREVIEW effect L.310/L.315 : `combatMode` → `decl.combatMode` (payload + deps)
- [ ] Auto-sélection arme CaC L.259–263 **supprimée**
- [ ] Blocage assaut weapon !== 'drawn' L.879–886 **supprimé**
- [ ] `handleMapToggle` : `dispatch({ type: 'SELECT_ATTACK' })` ajouté quand `k === 'attack'` sélectionné
- [ ] fire_mode reset useEffect → `dispatch({ type: 'SET_FIELD', key: 'fire_mode', value: ... })`
- [ ] Toutes les références `states.x`, `quick.x`, `combatMode` → `decl.x`, `decl.quick.x`, `decl.combatMode`
- [ ] `stateChanged` : `Object.keys(initialStates.current).some(k => decl[k] !== initialStates.current[k])`
- [ ] `handleDeclare` payload (L.508–558) : `states.*` → `decl.*`, `combatMode` → `decl.combatMode`, `quick.*` → `decl.quick.*`
- [ ] `initialStates` (useRef) inchangé — non migré dans le reducer
- [ ] `npm run build` — zéro erreur

### Documentation

- [ ] Scénarios V1–V15 validés
- [ ] `docs/ARCHI_REWORK.md` — entrée REWORK-06 mise à jour dans "Prochains reworks" + "Reworks achevés" après clos
- [ ] `docs/JOURNAL5.md` appended

---

## REPRENDRE ICI — POST-COMPACT

**État courant : Session 113 — plan rédigé complet. En attente de "Je code ?".**

Fichiers lus en session 113 :
- `client/src/components/CombatGmDeclareWindow.jsx` — 975L — lu intégralement
- `client/src/components/CombatActionWindow.jsx` — 1474L — lu intégralement
- `client/src/stores/combatStore.js` — 61L — lu intégralement
- Recherche documentée : tkdodo.eu, pmndrs/zustand #2496, #954, React docs, Foundry VTT

Décision architecturale : `useReducer` avec reducer partagé (PAS un store Zustand global).
Justification documentée dans §CONTEXTE §Décision architecturale.

Prochaine étape : **"Je code ?" → Étape 1 (créer declarationReducer.js)**
→ Lire CombatGmDeclareWindow.jsx avant Étape 2.
→ Lire CombatActionWindow.jsx avant Étape 3.
→ Vérifier P-R06-1 à P-R06-13 avant chaque étape.
