/* Panneaux de résultat de combat — design Claude Design "VTT Enclume Combat Result"
   CombatResultGM   : vue GM, bottom-left, ton neutre
   CombatResultPlayer : vue Joueur, bottom-center, 2e personne dramatique
*/

const C = {
  bg:         '#16162a',
  bgInner:    '#0f0f20',
  border:     '#2a2a3e',
  text:       '#c0c0d0',
  textDim:    '#7a7a90',
  textBright: '#e8e8f5',
  gold:       '#f5c542',
  red:        '#c83030',
  green:      '#3aaa6a',
}

const SEVERITY = {
  legere:   { col: '#FFD700', label: 'Blessure légère'   },
  moyenne:  { col: '#FFA500', label: 'Blessure moyenne'  },
  grave:    { col: '#FF6B6B', label: 'Blessure grave'    },
  critique: { col: '#FF0000', label: 'Blessure critique' },
  mortelle: { col: '#8B0000', label: 'Blessure mortelle' },
}

const LOC = {
  tete:         'Tête',
  corps:        'Corps',
  bras_droit:   'Bras droit',
  bras_gauche:  'Bras gauche',
  jambe_droite: 'Jambe droite',
  jambe_gauche: 'Jambe gauche',
}

function RollSeuilLine({ roll, seuil, isSuccess }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 6,
      padding: '6px 10px',
      background: C.bgInner,
      border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${isSuccess ? C.green : C.red}`,
    }}>
      <span style={{ fontSize: 10, color: C.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>Jet</span>
      <span style={{ fontSize: 18, color: isSuccess ? C.green : C.red, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{roll}</span>
      <span style={{ fontSize: 11, color: C.textDim, margin: '0 2px' }}>/</span>
      <span style={{ fontSize: 10, color: C.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>Seuil</span>
      <span style={{ fontSize: 14, color: C.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{seuil}</span>
    </div>
  )
}

function DamageLine({ degatsBruts, degatsNets, localisation }) {
  const absorbed = (degatsBruts ?? 0) - (degatsNets ?? 0)
  return (
    <div style={{
      padding: '6px 10px',
      background: C.bgInner,
      border: `1px solid ${C.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: absorbed > 0 ? 3 : 0 }}>
        <span style={{ fontSize: 10, color: C.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>Dégâts</span>
        <span style={{ fontSize: 20, color: C.textBright, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{degatsNets ?? 0}</span>
        <span style={{ fontSize: 11, color: C.text, letterSpacing: '0.02em', marginLeft: 'auto' }}>
          {LOC[localisation] || localisation}
        </span>
      </div>
      {absorbed > 0 && (
        <div style={{ fontSize: 10, color: C.textDim, fontVariantNumeric: 'tabular-nums' }}>
          {degatsBruts} bruts − {absorbed} armure
        </div>
      )}
    </div>
  )
}

function SeverityBlock({ severity, is_lethal }) {
  const sev = SEVERITY[severity]
  if (!sev) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '5px 9px',
      background: sev.col + '14',
      border: `1px solid ${sev.col}66`,
      borderLeft: `3px solid ${sev.col}`,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: sev.col, flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: sev.col, fontWeight: 600, letterSpacing: '0.02em' }}>{sev.label}</span>
      {is_lethal && (
        <span style={{ fontSize: 9, color: C.red, marginLeft: 'auto', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Létal</span>
      )}
    </div>
  )
}

function ShockBlock({ shockResult }) {
  if (!shockResult?.triggered) return null
  const OUTCOME = {
    ok:          { label: 'Résistance',  col: '#3aaa6a' },
    etourdi:     { label: 'Étourdi',     col: '#f5c542' },
    inconscient: { label: 'Inconscient', col: '#c83030' },
  }
  const { label, col } = OUTCOME[shockResult.outcome] ?? { label: shockResult.outcome, col: C.textDim }
  return (
    <div style={{
      padding: '5px 9px',
      background: col + '14',
      border: `1px solid ${col}66`,
      borderLeft: `3px solid ${col}`,
    }}>
      <div style={{ fontSize: 9, color: C.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 3 }}>
        Test de Choc
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 16, color: col, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{shockResult.roll}</span>
        <span style={{ fontSize: 10, color: C.textDim }}>/ seuil {shockResult.seuilEtourdi}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: col, fontWeight: 600 }}>{label}</span>
      </div>
    </div>
  )
}

function CloseButton({ onClose }) {
  return (
    <div style={{ textAlign: 'center', marginTop: 10 }}>
      <button
        onClick={onClose}
        style={{
          background: 'transparent',
          border: `1px solid ${C.border}`,
          color: C.textDim,
          padding: '5px 18px',
          fontSize: 11,
          fontFamily: 'inherit',
          letterSpacing: '0.06em',
          cursor: 'pointer',
        }}
      >Fermer</button>
    </div>
  )
}

/* ── Vue GM — bottom-left, ton neutre, tireur → cible ──────────────────── */
export function CombatResultGM({ attaquant, cible, isSuccess, roll, seuil, localisation, degatsBruts, degatsNets, severity, is_lethal, shockResult, onClose }) {
  const sevData = severity ? SEVERITY[severity] : null
  const accent  = isSuccess ? (sevData?.col || C.gold) : C.textDim

  return (
    <div style={{
      position: 'absolute', bottom: 24, left: 24,
      width: 220,
      background: C.bg,
      border: `1px solid ${C.border}`,
      borderTop: `3px solid ${accent}`,
      padding: '12px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
      color: C.text,
      pointerEvents: 'auto',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 9, color: C.textDim, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 3 }}>
          Résolution du tir
        </div>
        <div style={{ fontSize: 13, color: C.textBright, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <span>{attaquant}</span>
          <span style={{ color: C.textDim, fontSize: 11 }}>→</span>
          <span>{cible}</span>
        </div>
      </div>

      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: isSuccess ? C.text : C.textDim, letterSpacing: '0.02em' }}>
        {isSuccess ? 'Touché' : 'Manqué'}
      </div>

      <div style={{ marginBottom: 8 }}>
        <RollSeuilLine roll={roll} seuil={seuil} isSuccess={isSuccess} />
      </div>

      {isSuccess && (
        <div style={{ marginBottom: 8 }}>
          <DamageLine degatsBruts={degatsBruts} degatsNets={degatsNets} localisation={localisation} />
        </div>
      )}

      {isSuccess && <SeverityBlock severity={severity} is_lethal={is_lethal} />}
      {isSuccess && <ShockBlock shockResult={shockResult} />}

      {onClose && <CloseButton onClose={onClose} />}
    </div>
  )
}

/* ── Vue Joueur — bottom-center, 2e personne, dramatique ───────────────── */
export function CombatResultPlayer({ attaquant, isSuccess, roll, seuil, localisation, degatsBruts, degatsNets, severity, is_lethal, shockResult, onClose }) {
  const sevData = severity ? SEVERITY[severity] : null
  const accent  = isSuccess ? (sevData?.col || C.red) : C.green

  return (
    <div style={{
      position: 'absolute', bottom: 24, left: '50%',
      transform: 'translateX(-50%)',
      width: 220,
      background: C.bg,
      border: `1px solid ${accent}55`,
      borderTop: `3px solid ${accent}`,
      padding: '14px 12px 12px',
      boxShadow: isSuccess
        ? `0 0 30px ${accent}44, 0 10px 30px rgba(0,0,0,0.6)`
        : '0 10px 30px rgba(0,0,0,0.6)',
      color: C.text,
      pointerEvents: 'auto',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: isSuccess ? accent : C.text, letterSpacing: '0.01em', lineHeight: 1.2 }}>
        {isSuccess
          ? (is_lethal ? 'Vous êtes mortellement touché' : 'Vous êtes touché')
          : 'Vous esquivez le tir'
        }
      </div>

      <div style={{ fontSize: 11, color: C.textDim, marginBottom: 10 }}>
        {isSuccess ? 'par ' : 'de '}
        <span style={{ color: C.text, fontWeight: 600 }}>{attaquant}</span>
      </div>

      <div style={{ marginBottom: 8 }}>
        <RollSeuilLine roll={roll} seuil={seuil} isSuccess={isSuccess} />
      </div>

      {isSuccess && (
        <div style={{ marginBottom: 8 }}>
          <DamageLine degatsBruts={degatsBruts} degatsNets={degatsNets} localisation={localisation} />
        </div>
      )}

      {isSuccess && <SeverityBlock severity={severity} is_lethal={is_lethal} />}
      {isSuccess && <ShockBlock shockResult={shockResult} />}

      {onClose && <CloseButton onClose={onClose} />}
    </div>
  )
}
