const P = {
  section: {
    padding: '8px 14px',
    borderBottom: '1px solid #1e1e2e',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: '#30aaaa',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 0',
    userSelect: 'none',
    borderBottom: '1px solid #1e1e2e',
  },
  optionLabel: { fontSize: 12, color: '#c0c0d0', fontWeight: 500 },
  optionSub:   { fontSize: 10, color: '#5b5b7a', marginTop: 2 },
  radio: {
    width: 14, height: 14,
    borderRadius: '50%',
    border: '2px solid #3a3a5a',
    flexShrink: 0,
    boxSizing: 'border-box',
    transition: 'border-color 0.1s, background 0.1s',
  },
  radioActive:  { borderColor: '#30aaaa', background: '#30aaaa' },
  targetName:   { fontSize: 12, color: '#30aaaa', fontWeight: 600, flex: 1 },
  chooseBtn: {
    padding: '6px 10px',
    background: 'rgba(48,170,170,0.1)',
    border: '1px solid #207070',
    borderRadius: 4,
    color: '#30aaaa',
    fontSize: 11,
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  },
  changeBtn: {
    padding: '3px 8px',
    background: 'none',
    border: '1px solid #3a3a5a',
    borderRadius: 4,
    color: '#7070a0',
    fontSize: 10,
    cursor: 'pointer',
    flexShrink: 0,
  },
  readyText: {
    fontSize: 11,
    color: '#30aaaa',
    fontWeight: 600,
    fontStyle: 'italic',
  },
}

export default function DroneWeaponPanel({
  droneWeapons,       // weapon[]
  selectedWeaponId,   // string | null
  assaultTargetId,    // string | null
  showReadyBadge,     // bool
  onWeaponSelect,     // (id) => void
  onChooseTarget,     // () => void
  getLabel,           // (tokenId) => string
}) {
  return (
    <>
      <div style={P.section}>
        <div style={P.sectionTitle}>Armement drone</div>
        {droneWeapons.length === 0 ? (
          <span style={{ color: '#607070', fontSize: 11 }}>Aucune arme configurée</span>
        ) : (
          droneWeapons.map(w => {
            const isSelected = w.id === selectedWeaponId
            const isEmpty    = w.ammo_restant !== null && w.ammo_restant !== undefined && w.ammo_restant <= 0
            return (
              <div
                key={w.id}
                onClick={() => !isEmpty && onWeaponSelect(w.id)}
                title={isEmpty ? 'Arme vide' : undefined}
                style={{ ...P.option, cursor: isEmpty ? 'not-allowed' : 'pointer', opacity: isEmpty ? 0.35 : 1 }}
              >
                <div style={{ flex: 1 }}>
                  <div style={P.optionLabel}>{w.display_name || w.ref_name || 'Arme'}</div>
                  <div style={P.optionSub}>
                    {(w.fire_mode || w.ref_fire_mode || '?').toUpperCase()} · {w.damage_formula || w.ref_damage_h || '—'}
                    {w.ammo_restant !== null && w.ammo_restant !== undefined
                      ? ` · ${w.ammo_restant} munitions`
                      : ''}
                  </div>
                </div>
                <div style={{ ...P.radio, ...(isSelected && !isEmpty ? P.radioActive : {}) }} />
              </div>
            )
          })
        )}
      </div>

      <div style={P.section}>
        <div style={P.sectionTitle}>Cible</div>
        {assaultTargetId ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={P.targetName}>→ {getLabel(assaultTargetId)}</span>
            <button style={P.changeBtn} onClick={onChooseTarget}>Changer</button>
          </div>
        ) : (
          <button style={P.chooseBtn} onClick={onChooseTarget}>Choisir une cible</button>
        )}
      </div>

      {showReadyBadge && (
        <div style={{ padding: '8px 14px' }}>
          <div style={P.readyText}>✓ Prêt à l&apos;assaut</div>
        </div>
      )}
    </>
  )
}
