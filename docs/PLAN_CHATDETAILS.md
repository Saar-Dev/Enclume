# PLAN_CHATDETAILS.md — Breakdown détaillé des jets de dé dans le chat
> Créé Session 94 — 2026-06-12
> Statut : PRÊT À IMPLÉMENTER

---

## Objectif

Afficher un bouton ⊞ dans chaque carte de jet de dé du chat Sidebar.
Clic → popover avec le détail complet des modificateurs qui ont produit le Seuil.

**Terminologie UI :** toujours "Seuil" (jamais "CDR"). D20 ≤ Seuil = réussite.

---

## Architecture retenue

### Payload DICE_RESULT — enrichissement
Champ optionnel `breakdown` ajouté côté serveur. Undefined si pas de contexte (jets /r génériques).

```js
breakdown: [
  { label: string, value: number, type: 'base'|'bonus'|'malus'|'neutral'|'total' }
]
```

- `base`    → bleu       — compétence/attribut brut
- `bonus`   → vert       — modificateur positif
- `malus`   → rouge      — modificateur négatif
- `neutral` → gris       — info, valeur = 0 explicitement affiché
- `total`   → gold/bold  — ligne "Seuil" (dernière entrée)

Entrées à `value = 0` : omises sauf si `type = 'neutral'`.

### Composant client
`DiceBreakdownPopover` — inline dans `Sidebar.jsx`, aucun fichier nouveau.

Pattern : état `breakdownPopover = null | { msgId, breakdown, rect, ... }`.
Fermeture : click-outside (`mousedown`) + touche Escape.
Position : `position: fixed`, calculée via `getBoundingClientRect()` du bouton.
Accessibilité : `role="dialog"`, `e.stopPropagation()` interne.

---

## Périmètre V1 / V2

| Jet | Handler serveur | V |
|---|---|---|
| Assault distance | `resolveAssaultAction` | **V1** |
| CaC — attaquant | `resolveMeleeAction` | **V1** |
| CaC — défenseur | `COMBAT_MELEE_DEFENSE_CONFIRM` | **V1** |
| Entité / déplacement | `ENTITY_ACTION_RESOLVE` | **V1** |
| Macro | `MACRO_ROLL` handler | V2 |
| Dégâts (loc + dmg) | `COMBAT_DAMAGE_CONFIRM` | V2 |
| `/r` générique | `DICE_ROLL` handler | — (formule = breakdown) |

---

## Plan exact — Serveur

### Fichier : `server/src/socket/index.js`

#### A. Module-level — constantes à ajouter (après les tables SEVERITY_COLORS existantes)

```js
// Breakdown — labels lisibles pour les modificateurs situationnels
const SITUATION_LABELS = {
  cible_immobile:        'Cible immobile',
  cible_allure_moyenne:  'Cible allure moyenne',
  cible_allure_rapide:   'Cible allure rapide',
  cible_allure_maximale: 'Cible allure maximale',
  tireur_allure_lente:   'Tireur allure lente',
  tireur_allure_moyenne: 'Tireur allure moyenne',
  tireur_allure_rapide:  'Tireur allure rapide',
  couverture_partielle:  'Couverture partielle (50%)',
  couverture_importante: 'Couverture importante (75%)',
  obscurite_legere:      'Obscurité légère',
  obscurite_importante:  'Obscurité importante',
}

const PORTEE_LABELS = {
  bout_portant: 'À bout portant', courte: 'Portée courte',
  moyenne: 'Portée moyenne',      longue: 'Portée longue', extreme: 'Portée extrême',
}

const TAILLE_LABELS = {
  minuscule: 'Cible minuscule (~30cm)', tres_petite: 'Cible très petite (~50cm)',
  petite: 'Cible petite (~1m)',         moyenne: 'Cible taille humaine',
  grande: 'Cible grande (~3m)',         tres_grande: 'Cible très grande (~5m)',
  enorme: 'Cible énorme (~7m)',         gigantesque: 'Cible gigantesque (10m+)',
}

// Helper — construit un breakdown entry si value ≠ 0
function breakdownEntry(label, value) {
  if (value === 0) return null
  return { label, value, type: value > 0 ? 'bonus' : 'malus' }
}
```

---

#### B. `resolveAssaultAction` — Point 1

**Localisation :** entre `const mr = chancesDeReussite - rollAttaque` et `io.to(campaignId).emit(WS.DICE_RESULT, {`

**Insérer :**
```js
const breakdown = [
  { label: 'Compétence', value: skillTotal, type: 'base' },
  ...(porteeModComp !== 0 ? [{ label: PORTEE_LABELS[confirmedModifiers.portee] ?? confirmedModifiers.portee, value: porteeModComp, type: porteeModComp > 0 ? 'bonus' : 'malus' }] : []),
  ...(fireModeComp !== 0 ? [{ label: `Mode de tir (×${action.bullet_count ?? 1})`, value: fireModeComp, type: 'bonus' }] : []),
  ...((confirmedModifiers.situation ?? []).map(k => breakdownEntry(SITUATION_LABELS[k] ?? k, SITUATION_MODS[k] ?? 0)).filter(Boolean)),
  ...(tailleModComp !== 0 ? [{ label: TAILLE_LABELS[confirmedModifiers.taille] ?? confirmedModifiers.taille, value: tailleModComp, type: tailleModComp > 0 ? 'bonus' : 'malus' }] : []),
  ...(isRushedMod !== 0 ? [{ label: 'Précipitation', value: isRushedMod, type: 'malus' }] : []),
  ...(effectiveMalus !== 0 ? [{ label: 'Malus santé / encombrement', value: effectiveMalus, type: 'malus' }] : []),
  ...(carenceArmure !== 0 ? [{ label: 'Carence armure', value: -carenceArmure, type: 'malus' }] : []),
  { label: 'Seuil', value: chancesDeReussite, type: 'total' },
]
```

**Ajouter dans le payload emit :** `breakdown,`

---

#### C. `resolveMeleeAction` — attaquant — Point 2

**Localisation :** DICE_RESULT emit `'Jet pour toucher (contact)'` (~ligne 3188).
Variables disponibles dans scope : `attackerSkillTotal`, `effectiveMalusAttaquant`, `carenceAttaquant`, `isRushedMod`, `attackModeBonus`, `multiMalusAttaquant`, `multiAttackMalus`, `chancesAttaque`.

**Insérer avant emit :**
```js
const breakdownMeleeAtk = [
  { label: 'Compétence (Contact)', value: attackerSkillTotal, type: 'base' },
  ...(attackModeBonus !== 0 ? [{ label: 'Mode de combat', value: attackModeBonus, type: attackModeBonus > 0 ? 'bonus' : 'malus' }] : []),
  ...(multiMalusAttaquant !== 0 ? [{ label: 'Multi-adversaires', value: multiMalusAttaquant, type: 'malus' }] : []),
  ...(multiAttackMalus !== 0 ? [{ label: 'Attaque multiple', value: multiAttackMalus, type: 'malus' }] : []),
  ...(isRushedMod !== 0 ? [{ label: 'Précipitation', value: isRushedMod, type: 'malus' }] : []),
  ...(effectiveMalusAttaquant !== 0 ? [{ label: 'Malus santé / encombrement', value: effectiveMalusAttaquant, type: 'malus' }] : []),
  ...(carenceAttaquant !== 0 ? [{ label: 'Carence armure', value: -carenceAttaquant, type: 'malus' }] : []),
  { label: 'Seuil', value: chancesAttaque, type: 'total' },
]
```

**Ajouter dans payload :** `breakdown: breakdownMeleeAtk,`

---

#### D. `COMBAT_MELEE_DEFENSE_CONFIRM` — défenseur — Point 3

**Deux points d'émission :** (a) résolution PNJ auto (~ligne 3308), (b) résolution PJ via CONFIRM (~ligne 2547).
Variables : `defenderSkillTotal`, `defenderEffectiveMalus`, `modeDefenseBonus` ou variable équivalente, `multiMalusDefenseur`, `chanceDefense`.

**Insérer avant chaque emit :**
```js
const breakdownMeleeDef = [
  { label: 'Compétence (Contact)', value: defenderSkillTotal, type: 'base' },
  ...(/* mode défensif/retraite */ modeDefenseBonus !== 0 ? [{ label: 'Mode défensif', value: modeDefenseBonus, type: modeDefenseBonus > 0 ? 'bonus' : 'malus' }] : []),
  ...(multiMalusDefenseur !== 0 ? [{ label: 'Multi-adversaires', value: multiMalusDefenseur, type: 'malus' }] : []),
  ...(defenderEffectiveMalus !== 0 ? [{ label: 'Malus santé / encombrement', value: defenderEffectiveMalus, type: 'malus' }] : []),
  { label: 'Seuil', value: chanceDefense, type: 'total' },
]
```

**Ajouter dans payload :** `breakdown: breakdownMeleeDef,`

⚠️ Identifier les noms exacts de variables à la lecture du code avant codage.

---

#### E. `ENTITY_ACTION_RESOLVE` — Point 4

**Localisation :** ~ligne 972, emit DICE_RESULT avec `skillLabel`, `mechanicalTotal`, `chancesDeReussite`, `effectiveMalus`.
Variable `totalDiffMod` disponible (= `chancesDeReussite - mechanicalTotal - effectiveMalus`).

**Insérer avant emit :**
```js
const diffMod = chancesDeReussite - mechanicalTotal - effectiveMalus
const breakdownEntity = [
  { label: formulaLabel ?? 'Compétence', value: mechanicalTotal, type: 'base' },
  ...(diffMod !== 0 ? [{ label: 'Modificateur difficulté', value: diffMod, type: diffMod > 0 ? 'bonus' : 'malus' }] : []),
  ...(effectiveMalus !== 0 ? [{ label: 'Malus santé / encombrement', value: effectiveMalus, type: 'malus' }] : []),
  { label: 'Seuil', value: chancesDeReussite, type: 'total' },
]
```

**Ajouter dans payload :** `breakdown: breakdownEntity,`

---

## Plan exact — Client

### Fichier : `client/src/components/Sidebar.jsx`

#### A. État + ref (après useState animatingDiceId, ~ligne 474)
```js
const [breakdownPopover, setBreakdownPopover] = useState(null)
const popoverRef = useRef(null)
```

#### B. useEffect click-outside + Escape (après useEffect animatingDiceId, ~ligne 570)
```js
useEffect(() => {
  if (!breakdownPopover) return
  const onMouse = (e) => { if (!popoverRef.current?.contains(e.target)) setBreakdownPopover(null) }
  const onKey = (e) => { if (e.key === 'Escape') setBreakdownPopover(null) }
  document.addEventListener('mousedown', onMouse)
  document.addEventListener('keydown', onKey)
  return () => {
    document.removeEventListener('mousedown', onMouse)
    document.removeEventListener('keydown', onKey)
  }
}, [breakdownPopover])
```

#### C. handleOpenBreakdown (avant le return, dans les callbacks)
```js
const handleOpenBreakdown = useCallback((e, msg) => {
  e.stopPropagation()
  if (breakdownPopover?.msgId === msg.id) { setBreakdownPopover(null); return }
  const rect = e.currentTarget.getBoundingClientRect()
  setBreakdownPopover({
    msgId: msg.id,
    breakdown: msg.breakdown,
    rect,
    skillLabel: msg.skillLabel,
    total: msg.total,
    chancesDeReussite: msg.chancesDeReussite,
    isSuccess: msg.isSuccess,
    mr: msg.mr,
  })
}, [breakdownPopover])
```

#### D. DiceBreakdownPopover — composant inline (avant Sidebar, après IconPen)

```jsx
function DiceBreakdownPopover({ popover, popoverRef }) {
  if (!popover) return null
  const { rect, breakdown, skillLabel, total, chancesDeReussite, isSuccess, mr } = popover

  // Position : au-dessus du bouton si trop bas, en dessous sinon
  const spaceBelow = window.innerHeight - rect.bottom
  const top = spaceBelow > 160
    ? rect.bottom + 6
    : rect.top - 6   // sera ajusté avec translateY(-100%)
  const right = window.innerWidth - rect.right + 4

  const TYPE_COLOR = { base: '#5b8dee', bonus: '#4caf77', malus: '#e05c5c', neutral: '#64748b', total: '#c4972f' }

  return (
    <div
      ref={popoverRef}
      role="dialog"
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: spaceBelow > 160 ? top : undefined,
        bottom: spaceBelow <= 160 ? window.innerHeight - rect.top + 6 : undefined,
        right,
        width: '220px',
        background: '#12122a',
        border: '1px solid #2a2a4a',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
        zIndex: 9999,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '8px 10px 6px', borderBottom: '1px solid #1e1e36', fontSize: '10px', color: '#5b8dee', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {skillLabel}
      </div>
      {/* Lignes breakdown */}
      <div style={{ padding: '6px 10px' }}>
        {(breakdown ?? []).map((entry, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', borderTop: entry.type === 'total' ? '1px solid #2a2a4a' : 'none', marginTop: entry.type === 'total' ? '4px' : 0, paddingTop: entry.type === 'total' ? '6px' : '2px' }}>
            <span style={{ fontSize: '11px', color: entry.type === 'total' ? '#c4972f' : '#9090a8' }}>
              {entry.label}
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: entry.type === 'total' ? 700 : 400, color: TYPE_COLOR[entry.type] ?? '#c0c0d0' }}>
              {entry.value > 0 && entry.type !== 'base' && entry.type !== 'total' ? `+${entry.value}` : entry.value}
            </span>
          </div>
        ))}
      </div>
      {/* Résultat */}
      <div style={{ padding: '6px 10px 8px', borderTop: '1px solid #1e1e36', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '13px', color: '#c0c0d0' }}>D20 → {total}</span>
        <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>/ {chancesDeReussite}</span>
        <span className={isSuccess ? 'badge badge-success' : 'badge badge-fail'} style={{ marginLeft: 'auto' }}>
          {isSuccess ? `✓ MR+${mr}` : `✗ MR${mr}`}
        </span>
      </div>
    </div>
  )
}
```

#### E. Montage du popover dans le return de Sidebar (avant la fermeture du `<div style={styles.sidebar}>`)
```jsx
<DiceBreakdownPopover popover={breakdownPopover} popoverRef={popoverRef} />
```

#### F. Bouton dans les cartes dé

**Dans `diceHeader` de la branche skillcheck** (~ligne 1025) :
```jsx
{msg.breakdown && (
  <button className="btn-icon" onClick={(e) => handleOpenBreakdown(e, msg)}
    title="Détail du calcul"
    style={{ marginLeft: 'auto', fontSize: '11px', lineHeight: 1, opacity: breakdownPopover?.msgId === msg.id ? 1 : 0.5 }}>
    ⊞
  </button>
)}
```

**Idem dans `diceHeader` de la branche displacement** (~ligne 987).

**Pas de bouton** dans : normal `/r`, `combat_damage` (pas de seuil, que des dégâts), `macro_result` (V2).

---

## Pièges identifiés

- **`SITUATION_MODS` défini à l'intérieur de `resolveAssaultAction`** → déplacer en module-level ou extraire les valeurs depuis la map locale pour construire le breakdown (ne pas dupliquer la map).
- **Variables défense melee** : vérifier les noms exacts avant codage (lire le scope de `COMBAT_MELEE_DEFENSE_CONFIRM` et de `resolveMeleeAction` PNJ auto).
- **`formulaLabel`** dans ENTITY_ACTION_RESOLVE : vérifier le nom exact de la variable dans le scope (~ligne 960–972).
- **Position popover** : le popover est `position: fixed` — il échappe au `overflow: hidden` de la Sidebar. Correct et voulu.
- **`breakdownPopover` dans deps de `handleOpenBreakdown`** : déclenche re-render à chaque ouverture. Acceptable — le composant est léger.

---

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `server/src/socket/index.js` | +4 blocs breakdown + SITUATION_LABELS/PORTEE_LABELS/TAILLE_LABELS + helper `breakdownEntry` module-level |
| `client/src/components/Sidebar.jsx` | +état +ref +2 useEffect +callback +composant +bouton ×2 |
| `client/src/locales/fr.json` | Aucun ajout (labels en français dans le payload serveur) |

**Pas de :** event WS nouveau, migration DB, nouveau fichier composant, dépendance externe.

---

## Ordre d'implémentation

1. Serveur — constantes module-level + helper `breakdownEntry`
2. Serveur — `resolveAssaultAction` breakdown (Point A — le plus complet)
3. Client — `DiceBreakdownPopover` + état + handlers
4. Test assault distance → valider affichage
5. Serveur — `resolveMeleeAction` + `COMBAT_MELEE_DEFENSE_CONFIRM` (Points B+C)
6. Serveur — `ENTITY_ACTION_RESOLVE` (Point D)
7. Test tous les jets V1
