# Code de référence — Panneau assaut version dropdown (GM/PNJ)
> Extrait de CombatActionWindow.jsx Session 64 — À réutiliser pour l'interface GM

Ce code implémente la sélection d'arme et de cible par dropdowns.
Correct pour le panneau GM/PNJ (vue tableau), mauvais UX pour le joueur.

---

## Fetch armes équipées (MG/MD)

```jsx
// Fetch armes équipées (MG/MD) pour le sous-panneau assaut
useEffect(() => {
  if (!playerChar?.id) return
  let cancelled = false
  api.get(`/char-sheet/${playerChar.id}/inventory`).then(res => {
    if (cancelled) return
    const weapons = (res.data.items || []).filter(
      item => (item.slot === 'MG' || item.slot === 'MD') && item.ref_fire_mode
    )
    setAssaultWeapons(weapons)
  }).catch(() => {})
  return () => { cancelled = true }
}, [playerChar?.id])
```

## Calcul des cibles valides (roster × tokenStore)

```jsx
// Cibles valides : participants au combat sur la même carte, hors token joueur
const rosterTokenIds = new Set(roster.map(r => r.token_id))
const targetTokens = tokens.filter(t =>
  t.battlemap_id === playerToken.battlemap_id &&
  t.id !== playerToken.id &&
  t.character_id != null &&
  rosterTokenIds.has(t.id)
)
```

⚠️ Bug observé : `targetTokens` était vide — les tokens du store n'ont probablement pas `battlemap_id`.
À débugger avant réutilisation GM. Alternative : filtrer uniquement par `rosterTokenIds.has(t.id)`.

## JSX — Dropdown Arme

```jsx
{/* Arme */}
<div style={styles.assaultRow}>
  <span style={styles.assaultLabel}>Arme</span>
  <select
    style={styles.assaultSelect}
    value={assaultWeaponId ?? ''}
    onChange={e => setAssaultWeaponId(Number(e.target.value) || null)}
  >
    <option value="">— Choisir —</option>
    {assaultWeapons.map(w => (
      <option key={w.id} value={w.id}>
        {w.custom_name || w.ref_name || 'Arme'} ({w.slot})
      </option>
    ))}
  </select>
</div>
```

## JSX — Dropdown Cible

```jsx
{/* Cible */}
<div style={styles.assaultRow}>
  <span style={styles.assaultLabel}>Cible</span>
  <select
    style={styles.assaultSelect}
    value={assaultTargetId ?? ''}
    onChange={e => setAssaultTargetId(Number(e.target.value) || null)}
  >
    <option value="">— Choisir —</option>
    {targetTokens.map(t => (
      <option key={t.id} value={t.id}>{t.name}</option>
    ))}
  </select>
</div>
```

## JSX — Mode de tir (CC/RC/RL) — inchangé pour GM

```jsx
{/* Mode de tir — affiché si une arme est choisie */}
{assaultWeaponId && selectedWeapon && (
  <div style={styles.assaultRow}>
    <span style={styles.assaultLabel}>Mode</span>
    <div style={{ display: 'flex', gap: 4 }}>
      {selectedWeapon.ref_fire_mode?.includes('CC') && (
        <button
          style={{ ...styles.modeBtn, ...(assaultFireMode === 'CC' ? styles.modeBtnActive : {}) }}
          onClick={() => setAssaultFireMode('CC')}
        >CC</button>
      )}
      {selectedWeapon.ref_fire_mode?.includes('RC') && (
        <button
          style={{ ...styles.modeBtn, ...(assaultFireMode === 'RC' ? styles.modeBtnActive : {}) }}
          onClick={() => setAssaultFireMode('RC')}
        >RC</button>
      )}
      {selectedWeapon.ref_fire_mode?.includes('RL') && (
        <button
          style={{ ...styles.modeBtn, ...(assaultFireMode === 'RL' ? styles.modeBtnActive : {}) }}
          onClick={() => setAssaultFireMode('RL')}
        >RL</button>
      )}
    </div>
  </div>
)}
```

## FIRE_MODE_VARIANTS (valeur correcte, identique joueur et GM)

```js
const FIRE_MODE_VARIANTS = {
  CC: [
    { id: 'cc_1',   label: '1b',       bulletCount: 1,  bonusComp: 0, bonusDmg: 0 },
    { id: 'cc_2',   label: '2b',       bulletCount: 2,  bonusComp: 1, bonusDmg: 0 },
    { id: 'cc_3',   label: '3b',       bulletCount: 3,  bonusComp: 2, bonusDmg: 0 },
    { id: 'cc_4',   label: '4b',       bulletCount: 4,  bonusComp: 3, bonusDmg: 0 },
    { id: 'cc_7a',  label: '7b (A)',   bulletCount: 7,  bonusComp: 4, bonusDmg: 0 },
    { id: 'cc_7b',  label: '7b (B)',   bulletCount: 7,  bonusComp: 3, bonusDmg: 3 },
    { id: 'cc_10a', label: '10b (A)',  bulletCount: 10, bonusComp: 5, bonusDmg: 0 },
    { id: 'cc_10b', label: '10b (B)',  bulletCount: 10, bonusComp: 4, bonusDmg: 3 },
  ],
  RC: [
    { id: 'rc_3',   label: 'Rafale courte (3b)', bulletCount: 3,  bonusComp: 3, bonusDmg: 5 },
  ],
  RL: [
    { id: 'rl_5',   label: '5b',    bulletCount: 5,  bonusComp: 2, bonusDmg: 2 },
    { id: 'rl_10',  label: '10b',   bulletCount: 10, bonusComp: 4, bonusDmg: 4 },
    { id: 'rl_15',  label: '15b',   bulletCount: 15, bonusComp: 6, bonusDmg: 6 },
    { id: 'rl_20',  label: '20b',   bulletCount: 20, bonusComp: 8, bonusDmg: 8 },
    { id: 'rl_mc',  label: 'Multi', bulletCount: 5,  bonusComp: 0, bonusDmg: 0 },
  ],
}
```

## Styles assaut (réutilisables GM)

```js
assaultPanel: {
  borderTop: '1px solid #2a2a3e',
  padding: '8px 14px',
  background: 'rgba(180,80,80,0.06)',
  display: 'flex', flexDirection: 'column', gap: 8,
},
assaultRow: { display: 'flex', alignItems: 'center', gap: 8 },
assaultLabel: {
  fontSize: 10, fontWeight: 700, color: '#5b5b7a',
  textTransform: 'uppercase', letterSpacing: '0.06em',
  minWidth: 56, flexShrink: 0,
},
assaultSelect: {
  flex: 1, background: '#0e0e1a', border: '1px solid #2a2a3e',
  borderRadius: 4, color: '#c0c0d0', fontSize: 11, padding: '3px 6px',
},
modeBtn: {
  padding: '3px 10px', background: 'rgba(255,255,255,0.04)',
  border: '1px solid #2a2a3e', borderRadius: 4,
  color: '#8888a8', fontSize: 11, fontWeight: 600, cursor: 'pointer',
},
modeBtnActive: {
  background: 'rgba(180,80,80,0.2)', borderColor: '#c05050', color: '#e07070',
},
variantBtn: {
  padding: '3px 8px', background: 'rgba(255,255,255,0.04)',
  border: '1px solid #2a2a3e', borderRadius: 4,
  color: '#8888a8', fontSize: 10, cursor: 'pointer',
},
variantBtnActive: {
  background: 'rgba(180,80,80,0.2)', borderColor: '#c05050', color: '#e07070',
},
assaultSummary: {
  fontSize: 10, color: '#c05050', fontWeight: 600,
  textAlign: 'right', opacity: 0.85,
},
```
