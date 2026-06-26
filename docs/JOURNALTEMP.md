# JOURNALTEMP — Scratch pad analytique
> Contenu périssable — ne jamais inclure dans la lecture obligatoire. Consolider vers JOURNAL5.md en fin de session.

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

