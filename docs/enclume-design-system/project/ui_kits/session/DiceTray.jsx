// DiceTray.jsx — the radial dice selector (d20 center, others around) + roll bar.
const { useState: useStateD } = React;

function Die({ k, size, color, count, center, onAdd, onRemove }) {
  const s = size, cx = s/2, cy = s/2;
  const fillOp = count > 0 ? 0.22 : 0.06;
  const stroke = count > 0 ? color : '#3a3a52';
  let shape, label = k.toUpperCase().replace('D','d');
  if (k==='d6') {
    const r=s*0.42; shape=<rect x={cx-r} y={cy-r} width={r*2} height={r*2} rx={s*0.06} fill={color} fillOpacity={fillOp} stroke={stroke} strokeWidth="1.5"/>;
  } else if (k==='d4') {
    const r=s*0.5; shape=<polygon points={`${cx},${cy-r} ${cx+r*0.87},${cy+r*0.5} ${cx-r*0.87},${cy+r*0.5}`} fill={color} fillOpacity={fillOp} stroke={stroke} strokeWidth="1.5"/>;
  } else if (k==='d20') {
    const r=s*0.46; shape=<polygon points={`${cx},${cy-r} ${cx+r*0.85},${cy-r*0.5} ${cx+r*0.85},${cy+r*0.5} ${cx},${cy+r} ${cx-r*0.85},${cy+r*0.5} ${cx-r*0.85},${cy-r*0.5}`} fill={color} fillOpacity={fillOp} stroke={stroke} strokeWidth="1.5"/>;
  } else { // d8 d10 d12 d100 — diamond
    const r=s*0.48; shape=<polygon points={`${cx},${cy-r} ${cx+r},${cy} ${cx},${cy+r} ${cx-r},${cy}`} fill={color} fillOpacity={fillOp} stroke={stroke} strokeWidth="1.5"/>;
  }
  return (
    <button onClick={()=>onAdd(k)} onContextMenu={e=>{e.preventDefault(); onRemove(k);}}
      title="Clic: +1 · Clic droit: −1"
      style={{ position:'relative', width:s, height:s, padding:0, background:'none', border:'none', cursor:'pointer', display:'flex' }}>
      <svg width={s} height={s}>
        {shape}
        <text x={cx} y={cy+ (k==='d4'? s*0.18 : s*0.07)} textAnchor="middle" fontFamily="'Share Tech Mono', monospace"
          fontSize={s*0.24} fill={count>0?'#dde7ee':'#6b7280'}>{label.replace('d','')}</text>
      </svg>
      {count>0 && <span style={{ position:'absolute', top:-2, right:-2, minWidth:16, height:16, borderRadius:8, background:color, color:'#0d0f18',
        font:"700 10px 'Share Tech Mono'", display:'flex', alignItems:'center', justifyContent:'center', padding:'0 3px' }}>{count}</span>}
    </button>
  );
}

function DiceTray({ color = '#5b8dee', onRoll }) {
  const [f, setF] = useStateD({ d20:0, d12:0, d10:0, d8:0, d6:0, d4:0, d100:0 });
  const [mod, setMod] = useStateD(0);
  const add = k => setF(p=>({ ...p, [k]: p[k]+1 }));
  const rem = k => setF(p=>({ ...p, [k]: Math.max(0, p[k]-1) }));
  const total = Object.values(f).reduce((a,b)=>a+b,0);
  const ring = [['d12',0],['d10',60],['d8',120],['d6',180],['d4',240],['d100',300]];
  const R = 78, C = 230;

  return (
    <div style={{ width:300, background:ENC.bgSession, border:`1px solid ${ENC.border}`, borderRadius:10,
      boxShadow:'0 4px 12px rgba(0,0,0,0.4)', overflow:'hidden' }}>
      <div style={{ padding:'10px 14px', borderBottom:`1px solid ${ENC.border}`, display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ color, display:'flex' }}><IconDice size={15}/></span>
        <Eyebrow color={ENC.txtMid}>Lancer de dés</Eyebrow>
      </div>
      <div style={{ position:'relative', width:C, height:C, margin:'8px auto' }}>
        {ring.map(([k,ang])=>{
          const rad = ang*Math.PI/180, x = C/2 + R*Math.cos(rad) - 26, y = C/2 + R*Math.sin(rad) - 26;
          return <div key={k} style={{ position:'absolute', left:x, top:y }}><Die k={k} size={52} color={color} count={f[k]} onAdd={add} onRemove={rem} /></div>;
        })}
        <div style={{ position:'absolute', left:C/2-38, top:C/2-38 }}><Die k="d20" size={76} color={color} count={f.d20} center onAdd={add} onRemove={rem} /></div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 14px 10px' }}>
        <Eyebrow color={ENC.txtLo}>Mod</Eyebrow>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <button onClick={()=>setMod(m=>m-1)} style={modBtn}>−</button>
          <span style={{ font:"700 14px 'Share Tech Mono'", color:ENC.txtHi, width:30, textAlign:'center' }}>{mod>=0?'+':''}{mod}</span>
          <button onClick={()=>setMod(m=>m+1)} style={modBtn}>+</button>
        </div>
      </div>
      <button disabled={total===0} onClick={()=>{ onRoll && onRoll(f, mod); setF({ d20:0,d12:0,d10:0,d8:0,d6:0,d4:0,d100:0 }); }}
        style={{ display:'block', width:'100%', padding:'11px', background: total? 'rgba(91,141,238,.15)':'transparent',
          border:'none', borderTop:`1px solid ${ENC.border}`, color: total?ENC.blue:ENC.txtLo, font:"700 12px 'Inter'",
          letterSpacing:'.05em', textTransform:'uppercase', cursor: total?'pointer':'not-allowed' }}>
        {total ? `Lancer ${total} dé${total>1?'s':''}` : 'Choisis un dé'}
      </button>
    </div>
  );
}
const modBtn = { width:22, height:22, borderRadius:4, background:ENC.bgRaised, border:`1px solid ${ENC.border}`, color:ENC.txtMid, font:"14px 'Inter'", cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0 };
window.DiceTray = DiceTray;
