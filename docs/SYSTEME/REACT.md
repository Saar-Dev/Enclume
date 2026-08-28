# SYSTEME/REACT.md — Règles React, dependency arrays, pièges hooks
> Audit de compréhension approfondie 2026-08-26 : `handleTokenRotate`/`TOKEN_ROTATE` corrigés en
> `handleTokenSetRotation`/`TOKEN_SET_ROTATION` (fonction/événement inexistants sous l'ancien nom,
> vérifié `SessionPage.jsx`) ; prop Canvas3D `onTokenRotate` corrigée en `onTokenSetRotation`, liste
> de props complétée ; table des handlers Échap complétée (5 réels, 3 documentés). `justSelectedRef`,
> P40/P50/P57 reconfirmés exacts.
> Source : SYSTEME.md §11–§14
> Lire pour : tout useCallback/useEffect/useRef, lock éditeur, ordre déclaration React

---

## Lock éditeur

```
POST /battlemaps/:id/editor-lock      → 200 { ok, lockedUntil } | 423 { lockedBy }
POST /battlemaps/:id/editor-heartbeat → renouvelle (toutes les 30s)
DELETE /battlemaps/:id/editor-lock    → libère au démontage
```

---

## Règles dependency arrays useCallback/useEffect (P3)

| Callback | Variable à inclure | Symptôme si absente |
|---|---|---|
| `handleContextMenuDelete` (SessionPage) | `socket` | socket?.emit() silencieux |
| `handleKeyDown` useEffect (Canvas3D) | `socket` | socket?.emit() silencieux |
| `handleCharacterDrop` (SessionPage) | `socket` | socket?.emit() silencieux |
| `handleDragStart` (Canvas3D) | `isGm`, `user`, `characters` | ownership check stale |
| raccourcis Digit1-5 (Editor3D) | `activeMaterial` | guard allowed_geometries stale |
| `handleEntityActionResolve` (SessionPage) | `socket` | ENTITY_ACTION_RESOLVE silencieux |
| `handleTokenSetRotation` (SessionPage) | `socket` | TOKEN_SET_ROTATION silencieux — corrigé 2026-08-26, cette ligne citait `handleTokenRotate`/`TOKEN_ROTATE`, qui n'existent pas sous ce nom dans `SessionPage.jsx` (vérifié `:565-567`) |
| `handlePointerUp` (Canvas3D) | `onTokenRotate`, `characters`, `user` | rotation impossible |

**Exception — actions Zustand :** stables par construction, pas besoin dans les deps.

---

## P3 — socket dans les dependency arrays
Tout `useCallback` qui émet via socket doit inclure `socket` dans ses deps.

## P4 — Ordre de déclaration React
Si callback A appelle callback B → A déclaré APRÈS B.
Violation → ReferenceError silencieux (hoisting pas disponible pour les const arrow functions).

## P50 — TDZ : hooks WS après tous les useState (SessionPage)
Tout appel de hook qui passe un setter `useState` directement en argument (ex. `useEntitySocket({ setRadialMenu, setMoveTarget })`) doit être déclaré APRÈS la déclaration `useState` correspondante.
Contrairement aux closures (corps de `useCallback`), les arguments sont évalués **immédiatement** → `ReferenceError: can't access lexical declaration before initialization` → écran noir.
**Règle SessionPage :** placer `useTokenSocket()`, `useEntitySocket(...)`, `useCombatSocket(...)` après l'ensemble des `useState` du composant.

## P40 — battlemapRef pattern
Ref miroir d'un state/prop pour lecture stable dans `useCallback`/`useFrame` sans l'inclure dans les deps.
```javascript
const battlemapRef = useRef(battlemap)
useEffect(() => { battlemapRef.current = battlemap }, [battlemap])
// Utilisé pour : tokensRef, ghostRef, targetRef, combatMoveModeRef, combatTargetModeRef
```

## PI11 — polarisRound : source unique
**Jamais redéfinir `polarisRound` localement. Import obligatoire : `'../../../shared/polarisUtils.js'`.**
Toute copie locale est une erreur de code.

```javascript
// Formule exacte (convention Polaris — LdB) :
export function polarisRound(x) {
  return Math.floor(x + 0.4)
}
// 0.5 arrondit vers le bas (≠ Math.round qui arrondit vers le haut)
// Exemples : polarisRound(2.5) = 2, polarisRound(2.6) = 3
// Utilisé dans : calcSeuils, calcREA, calcSouffle, calcResistanceDroguesInput, calcResistanceArmure
```

## P38 — Raccourcis clavier : `e.code` obligatoire
```javascript
// Correct : e.code = identifiant physique ('Digit1', 'KeyA', 'Space')
if (e.code === 'Digit1') { ... }

// Faux : e.key dépend du layout clavier (AZERTY/QWERTY)
if (e.key === '1') { ... }  // ✗ — 'Digit1' vs '&' selon layout
```
S'applique aussi aux raccourcis multi-modificateurs (Ctrl, Shift).

## P57 — WS live : hook dédié + store, jamais un `socket.on` local dans un composant leaf
Tout event WS qui doit mettre à jour l'UI en direct (pas juste une émission ponctuelle) passe par le
hook déjà actif au niveau page (`useSessionSocket.js` pour les events transverses campagne/chat/dés,
`useTokenSocket.js`/`useEntitySocket.js`/`useCombatSocket.js` pour leurs domaines), qui écrit dans le
store Zustand concerné (`campaignStore.updateCampaign(partial)`, `tokenStore`...). Le composant qui
affiche la donnée lit le store directement (`useCampaignStore()`), il n'ouvre pas son propre
`socket.on`/`socket.off`.
**Piège trouvé en codant (2026-07-29, `docs/PLAN_FATIGUE_DOMMAGES.md` §7)** : `campaign` a d'abord
été supposé être un `useState` local de `SessionPage.jsx` (ce que suggère son usage dans le JSX) —
c'est en fait `useCampaignStore()` (Zustand), déjà alimenté par un listener existant
(`onCampaignUpdated` dans `useSessionSocket.js`). Un nouvel event WS s'ajoute à ce hook existant
(une ligne `socket.on`/`socket.off` + un handler `updateCampaign({ champ: valeur })`), il ne justifie
jamais un nouveau `useEffect`/`socket.on` dans le composant d'affichage — même si ce composant reçoit
déjà `socket` en prop pour d'autres besoins (emit ponctuel), ça n'en fait pas le bon endroit pour un
abonnement live.

## PE16 — `e.code` pour la touche Alt
```javascript
// Correct :
if (e.code === 'AltLeft' || e.code === 'AltRight') { ... }
// ou tester e.altKey pour "Alt maintenu"

// Faux : e.key === 'Alt' a des variations selon OS/layout
```

## P58 — Briques de déclaration de combat (`CombatDeclare*`)

> Chantier `PLAN_RW_DECLARE_WINDOWS.md` (clos 2026-08-28, archivé `docs/Old/`). Finit REWORK-05.

Les **3 fenêtres de déclaration** (phase ANNONCE) restent des **orchestrateurs séparés** — la fusion
GM + Joueur est rejetée (REWORK-05 : navigation de slots, multi-phases, preview temps réel) :

| Fenêtre | Monte pour |
|---|---|
| `CombatActionWindow` | PJ + drone PJ ; **multi-phases** (ANNONCE + RÉSOLUTION + surprise + attente) |
| `CombatGmDeclareWindow` | MJ : PNJ + drone MJ ; ANNONCE seule, navigation séquentielle multi-PNJ |
| `CombatExoActionWindow` | exo-armure (joueur ou MJ) ; ANNONCE seule |

Leurs morceaux communs sont des **briques à plat** dans `client/src/components/CombatDeclare*.jsx`
(`export default function <Nom>` = fichier = nom d'usage) :

| Brique | Rôle |
|---|---|
| `CombatDeclareStateSelector` | segmented control d'un champ d'état (posture/arme/mode de tir/couverture/vitesse) + coût de transition INI par option |
| `CombatDeclareStateChip` | même concept, présentation compacte (puce click-to-cycle) — MJ, déclaration rapide multi-PNJ |
| `CombatDeclareIniWidget` | pastille « Initiative projetée » du pied (`current + delta`, rouge si ≤ 0), tooltip du détail |
| `CombatDeclareErrorBanner` | bannière transitoire de refus (`COMBAT_DECLARE_ERROR`) — dumb, lit `sessionStore.declareError` |
| `CombatDeclareLog` | log des déclarations du tour (lecture seule) |

**Règles** :
- **API unique** des sélecteurs d'état : `stateKey` (string) / `current` / `initial` / `onChange`
  (+ `disabled` / `highlightKey` / `availableKeys`). Ni `def={STATE_DEFS.X}` (le composant le dérive),
  ni un composant d'état défini **dans** une fenêtre.
- Le **calcul métier** vit dans le modèle, jamais dans une fenêtre : `combatSections.js` (`STATE_DEFS`,
  `nextKey`, `stateTransitionCost`, `calcIniDelta`/`calcIniBreakdown`) + **`shared/combatIniCost.js`**
  (autorité unique du coût d'Initiative d'une déclaration, **client + serveur** — cf. `COMBAT_FLUX.md`).
- Un **signal transitoire** (bannière de refus) passe par `sessionStore` + `useCombatSocket`
  (P57 — jamais un `socket.on` dans une fenêtre). Patron jumeau : `sessionStore.criticalEffect` /
  `CriticalEffectOverlay`.
- Une **nouvelle fenêtre de déclaration** (tourelle fixe, combattant « possédé »…) ou **section**
  (Intégrité/Avaries exo, statuts d'état exo accroupi/genou / arme rangée-au clair) **compose ces
  briques**, ne réécrit pas le châssis.
- Divergences **légitimes** conservées : allures (3 sources : fiche PJ / `DEFAULT_PNJ_ALLURES` /
  fetch serveur exo & drone) ; panneau droit 720 px (détail assaut/CaC) joueur + MJ seulement ;
  familles CSS `combat-float-*` (joueur/exo) vs `combat-win-*` (MJ) — non unifiées (chantier design
  séparé, module `CombatDeclareFrame` annulé).

---

## Interfaces composants majeurs

### Canvas3D — props (depuis SessionPage) — corrigé 2026-08-26, liste partielle et un nom faux
```javascript
<Canvas3D
  socket={socket}
  onTokenDoubleClick={handleTokenDoubleClick}
  onEntityClick={handleEntityClick}         // (entity, clientX, clientY)
  onTokenSetRotation={handleTokenSetRotation} // corrigé — le prop réel n'est PAS onTokenRotate
  moveTarget={moveTarget}                   // null | { entity, interaction, tokenId }
  onMoveCancel={handleMoveCancel}
  dicePayload={lastDiceRoll}                // résultat DICE_RESULT pour animation
  onDiceDone={handleDiceDone}
  combatCameraCenter={combatCameraCenter}   // null | { x, z } coords DB (PE14)
  combatMoveMode={combatMoveMode}           // voir COMBAT.md shapes
  combatTargetMode={combatTargetMode}       // voir COMBAT.md shapes
  // liste non exhaustive : mode, pendingMoveSelection, onAmbientTokenClick, losMode, onLosCancel,
  // onLosResult, defaultTokenGlbUrl(Drone/Exo), displayLevel, statusEffectsMode, onCharacterDrop
  // existent aussi (SessionPage.jsx:656-686) — ajouté 2026-08-26
/>
```

### Guard Q4 — moveTarget actif
Si `moveTarget` est non-null dans SessionPage, `handleEntityClick` annule le mode visée et retourne sans ouvrir de radial menu. Comportement intentionnel — clic pendant mode visée = annulation.

### justSelectedRef — anti-deselect immédiat
```javascript
// Canvas3D — evite dé-sélection immédiate après clic token (onClick Canvas bubbles up)
const justSelectedRef = useRef(false)
// Dans handlePointerUp (clic court) : justSelectedRef.current = true AVANT onTokenSelect
// Dans handleCanvasClick : if (justSelectedRef.current) { reset; return }
// Passé en prop à Scene (stable par useRef)
```

### Handlers Échap — 5 useEffects distincts (Canvas3D) — corrigé 2026-08-26, étaient 3 documentés
| Mode actif | Handler | Action |
|---|---|---|
| `moveTarget` (entité) | `e.key === 'Escape'` | `onMoveCancel?.()` |
| `combatMoveMode` | `e.key === 'Escape'` | `combatMoveMode.onCancel()` |
| `combatTargetMode` | `e.key === 'Escape'` | `combatTargetMode.onCancel()` |
| (caméra libre) | `e.key === 'Escape'` | `setFreeCameraOverride(true)` — manquait à cette table |
| `losMode` | `e.key === 'Escape'` | `onLosCancel?.()` — manquait à cette table |
Chaque useEffect guard `if (!mode) return` — n'enregistre le listener que quand le mode est actif.
