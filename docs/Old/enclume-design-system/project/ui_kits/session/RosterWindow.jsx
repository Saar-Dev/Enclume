// RosterWindow.jsx — faithful recreation of CombatRosterWindow (tactical HUD).
// Two modes: PRÉ-COMBAT (arme/armure/surpris/inclus) and ROSTER (ini order).
const { useState: useStateR } = React;

const ARMOR_CHIPS = ['T','C','B','J'];

function ArmorChips({ coverage, kind }) {
  // kind: 'pj' | 'pnj'
  return (
    <div style={RS.chips}>
      {ARMOR_CHIPS.map(chip => {
        const on = coverage.includes(chip);
        const st = kind==='pj'
          ? (on ? RS.chipPjFilled : RS.chipPjEmpty)
          : (on ? RS.chipPnjFilled : RS.chipPnjGap);
        return <span key={chip} style={{ ...RS.chip, ...st }}>{chip}</span>;
      })}
    </div>
  );
}

function RosterWindow({ pos, onDrag, mode='pre' }) {
  // demo data mirroring the screenshots
  const [surprised, setSurprised] = useStateR({});
  const [excluded, setExcluded] = useStateR({});
  const rows = [
    { id:'deep', t:'pnj', label:'Deep', ini:7, weapon:{name:'Breather', slot:'MD'}, armor:['T','C','B','J'] },
    { id:'soleil', t:'pnj', label:'Soleil', ini:11, weapon:{name:'Breather', slot:'2M'}, armor:['T','C','B','J'] },
    { id:'fddfg', t:'pnj', label:'fddfg', ini:7, weapon:null, armor:['T','C','B','J'] },
    { id:'gfdgfd', t:'pj', label:'gfdgfd', ini:12, weapon:null, armor:[] },
    { id:'civil', t:'pnj', label:'Civil', ini:7, weapon:{name:'Bâton de combat', slot:'MD'}, armor:['T','C','B','J'] },
    { id:'thug', t:'pnj', label:'Thug', ini:7, weapon:{name:'Bâton de combat', slot:'MD'}, armor:['T','C','B','J'] },
    { id:'jon', t:null, label:'Jon', ini:0, weapon:null, armor:null },
  ];
  const active = rows.filter(r => !excluded[r.id]);
  const noWeapon = active.filter(r => r.t==='pnj' && !r.weapon).length;
  const noArmor = active.filter(r => r.t==='pnj' && (!r.armor || r.armor.length===0)).length;

  // ROSTER mode = ini-sorted, fewer columns
  const rosterRows = [...rows].filter(r=>!excluded[r.id]).sort((a,b)=>b.ini-a.ini);

  return (
    <div style={{ ...RS.window, left: pos.x, top: pos.y }}>
      <div style={RS.header} onMouseDown={onDrag}>
        <div style={RS.headerLeft}>
          <span style={RS.title}>ROSTER COMBAT</span>
          {mode==='pre'
            ? <span style={RS.badge}>PRÉ-COMBAT</span>
            : <span style={{ ...RS.badge, background:'#1a2a1a', color:'#50c878', borderColor:'#50c878' }}>ROSTER</span>}
          <AnvilLogo h={16} color="#e05b5b" body="#e05b5b" />
        </div>
        <span style={RS.count}>{(mode==='pre'?active.length:rosterRows.length)} participants</span>
      </div>

      {mode==='pre' && (noWeapon>0 || noArmor>0) && (
        <div style={RS.alert}>
          <span style={{ fontSize:11, color:'#c86030' }}>⚠</span>
          <span style={RS.alertLabel}>AVANT DÉMARRAGE</span>
          {noWeapon>0 && <span style={RS.alertItem}>{noWeapon} PNJ{noWeapon>1?'s':''} sans arme</span>}
          {noArmor>0 && <span style={RS.alertItem}>{noArmor} PNJ{noArmor>1?'s':''} non protégé{noArmor>1?'s':''}</span>}
        </div>
      )}

      <div style={RS.tableWrap}>
        <table style={RS.table}>
          <thead><tr>
            <th style={RS.th}>TOKEN</th>
            <th style={{ ...RS.th, textAlign:'center' }}>INI</th>
            {mode==='pre' && <th style={RS.th}>ARME</th>}
            {mode==='pre' && <th style={RS.th}>ARMURE</th>}
            {mode==='roster' && <th style={{ ...RS.th, textAlign:'center' }}>ÉTAT INIT</th>}
            <th style={{ ...RS.th, textAlign:'center' }}>SURPRIS</th>
            {mode==='pre' && <th style={{ ...RS.th, textAlign:'center' }}>INCLUS</th>}
          </tr></thead>
          <tbody>
            {(mode==='pre'?active:rosterRows).map(r => (
              <tr key={r.id}>
                <td style={RS.td}>
                  <div style={RS.tokenCell}>
                    {r.t && <span style={{ ...RS.tbadge, ...(r.t==='pnj'?RS.badgePnj:RS.badgePj) }}>{r.t==='pnj'?'PN':'PJ'}</span>}
                    <span style={RS.tokenLabel}>{r.label}</span>
                  </div>
                </td>
                <td style={{ ...RS.td, textAlign:'center', fontFamily:"'Share Tech Mono'", fontWeight:600, color:'#dde7ee' }}>{r.ini!=null?r.ini:'—'}</td>
                {mode==='pre' && (
                  <td style={RS.td}>
                    {!r.t ? null : r.t==='pj'
                      ? <span style={RS.equippedText}>{r.weapon?`${r.weapon.name} [${r.weapon.slot}]`:'— sans arme'}</span>
                      : r.weapon
                        ? <span style={RS.equippedGreen}><span style={RS.dot}>●</span>{r.weapon.name} <span style={RS.slotTag}>[{r.weapon.slot}]</span></span>
                        : <span style={RS.selectDanger}>⚠ Choisir une arme <span style={RS.caret}>▾</span></span>}
                  </td>
                )}
                {mode==='pre' && (
                  <td style={RS.td}>
                    {!r.t ? null : r.t==='pj'
                      ? <ArmorChips coverage={r.armor} kind="pj" />
                      : (r.armor.length===0
                        ? <span style={RS.selectWarn}>⚠ T C B J <span style={RS.caret}>▾</span></span>
                        : <span style={RS.selectWarn}>⚠ T C B J <span style={RS.caret}>▾</span></span>)}
                  </td>
                )}
                {mode==='roster' && (
                  <td style={{ ...RS.td, textAlign:'center' }}>
                    {r.t==='pj' ? <span style={{ color:'#3a4a5a', fontSize:16, lineHeight:1 }}>·</span> : <span style={{ color:'#2a3a4a' }}>—</span>}
                  </td>
                )}
                <td style={{ ...RS.td, textAlign:'center' }}>
                  {mode==='roster'
                    ? <span style={{ color:'#2a3a4a' }}>—</span>
                    : <input type="checkbox" checked={!!surprised[r.id]} onChange={()=>setSurprised(s=>({ ...s, [r.id]:!s[r.id] }))} style={{ cursor:'pointer', accentColor:'#c86030' }} />}
                </td>
                {mode==='pre' && (
                  <td style={{ ...RS.td, textAlign:'center' }}>
                    <input type="checkbox" checked={!excluded[r.id]} onChange={()=>setExcluded(e=>({ ...e, [r.id]:!e[r.id] }))} style={{ cursor:'pointer', accentColor:'#5b8dee' }} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mode==='pre'
        ? <button style={RS.btnStart}>DÉMARRER LE COMBAT ({active.length})</button>
        : <button style={RS.btnAnnounce}>Passer en Annonce →</button>}
    </div>
  );
}

const RS = {
  window: { position:'absolute', width:560, background:'#0d0f18', border:'1px solid #1e2435', borderRadius:6, boxShadow:'0 8px 32px rgba(0,0,0,0.7)', maxHeight:'calc(100% - 90px)', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:"'Inter', system-ui", zIndex:42 },
  header: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderBottom:'1px solid #1e2435', background:'#080a12', cursor:'grab', userSelect:'none' },
  headerLeft: { display:'flex', alignItems:'center', gap:8 },
  title: { fontSize:11, letterSpacing:'0.15em', fontWeight:700, color:'#3a8aaa' },
  badge: { fontSize:9, letterSpacing:'0.08em', padding:'2px 6px', borderRadius:2, border:'1px solid #aa6030', color:'#e8a060', background:'#1a1008', fontWeight:600 },
  count: { fontSize:10, color:'#3a4a5a', fontFamily:"'Share Tech Mono'", fontStyle:'italic' },
  alert: { display:'flex', alignItems:'center', gap:10, padding:'7px 14px', background:'#1a1008', borderBottom:'1px solid #aa6030' },
  alertLabel: { fontSize:9, letterSpacing:'0.12em', color:'#6a4a20', fontWeight:700 },
  alertItem: { fontSize:10, color:'#e8a060', fontWeight:600 },
  tableWrap: { flex:1, overflowY:'auto', minHeight:0 },
  table: { width:'100%', borderCollapse:'collapse' },
  th: { padding:'6px 10px', fontSize:9, color:'#3a8aaa', letterSpacing:'0.1em', textAlign:'left', borderBottom:'1px solid #1e2435', background:'#080a12', position:'sticky', top:0, whiteSpace:'nowrap' },
  td: { padding:'6px 10px', fontSize:11, color:'#c0c8d0', borderBottom:'1px solid #10141e', verticalAlign:'middle' },
  tokenCell: { display:'flex', alignItems:'center', gap:6 },
  tbadge: { fontSize:9, letterSpacing:'0.05em', padding:'2px 6px', borderRadius:2, border:'1px solid', fontWeight:600 },
  badgePj: { background:'#0a1a0a', color:'#50c878', borderColor:'#50c878' },
  badgePnj: { background:'#1a0a08', color:'#c86030', borderColor:'#c86030' },
  tokenLabel: { fontSize:11, color:'#c0c8d0' },
  equippedText: { fontSize:10, color:'#4a5a6a', fontStyle:'italic' },
  equippedGreen: { display:'inline-flex', alignItems:'center', gap:4, fontSize:10, color:'#90c090' },
  dot: { color:'#50c878', fontSize:8 },
  slotTag: { color:'#4a6a4a', fontSize:9 },
  selectDanger: { display:'inline-flex', alignItems:'center', gap:6, justifyContent:'space-between', width:160, padding:'3px 6px', fontSize:10, background:'#1a0808', border:'1px solid #aa3030', borderRadius:2, color:'#e08080' },
  selectWarn: { display:'inline-flex', alignItems:'center', gap:8, width:96, padding:'3px 6px', fontSize:10, background:'#1a1208', border:'1px solid #aa6030', borderRadius:2, color:'#e0a060', letterSpacing:'0.08em' },
  caret: { marginLeft:'auto', opacity:.7 },
  chips: { display:'flex', gap:3, alignItems:'center' },
  chip: { display:'inline-flex', alignItems:'center', justifyContent:'center', width:18, height:18, fontSize:9, fontWeight:700, borderRadius:2, fontFamily:"'Share Tech Mono'" },
  chipPjFilled: { background:'#1a2030', color:'#5a6a7a', border:'1px solid #2a3a4a' },
  chipPjEmpty: { background:'transparent', color:'#2a3a4a', border:'1px solid #1a2030' },
  chipPnjFilled: { background:'#0a2010', color:'#50c878', border:'1px solid #2a6040' },
  chipPnjGap: { background:'transparent', color:'#4a2020', border:'1px solid #6a2020' },
  btnStart: { display:'block', width:'100%', padding:'11px 14px', background:'rgba(58,138,170,0.1)', border:'none', borderTop:'1px solid #1e2435', color:'#3a8aaa', fontSize:11, fontWeight:700, cursor:'pointer', letterSpacing:'0.1em' },
  btnAnnounce: { display:'block', width:'100%', padding:'11px 14px', background:'rgba(80,200,120,0.1)', border:'none', borderTop:'1px solid #1e2435', color:'#50c878', fontSize:11, fontWeight:700, cursor:'pointer', letterSpacing:'0.1em' },
};
window.RosterWindow = RosterWindow;
