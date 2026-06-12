// CombatWindows.jsx — initiative timeline bar + shared drag hook for floating windows.
const { useState: useStateC, useRef: useRefC, useEffect: useEffectC } = React;

// Shared draggable-window hook: returns {pos, onDrag} — mirrors the app's useDraggable.
function useDrag(initial) {
  const [pos, setPos] = useStateC(initial);
  const ref = useRefC(null);
  const onDrag = e => { ref.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }; document.body.style.userSelect = 'none'; };
  useEffectC(() => {
    const mv = e => { if (ref.current) setPos({ x: e.clientX - ref.current.dx, y: e.clientY - ref.current.dy }); };
    const up = () => { ref.current = null; document.body.style.userSelect = ''; };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
  }, [pos]);
  return { pos, onDrag };
}

function TimelineBar({ turn = 3, phase = 'ANNOUNCEMENT', timer = 22 }) {
  const cards = [
    { l:'Kaelen', ini:14, sev:null, color:ENC.green, active:false, done:true },
    { l:'Maître Orsa', ini:12, sev:'legere', active:false, done:true, status:'hypothermia' },
    { l:'Brann', ini:11, sev:'grave', active:true, done:false, status:'stunned' },
    { l:'Sicaire', ini:9, sev:null, active:false, done:false, npc:true },
    { l:'Rôdeur', ini:6, sev:'moyenne', active:false, done:false, npc:true, status:'burning' },
  ];
  const isAnn = phase==='ANNOUNCEMENT';
  const tColor = timer>11?ENC.green: timer>6?ENC.amber:ENC.red;
  return (
    <div style={{ position:'absolute', top:0, left:0, right:0, display:'flex', alignItems:'flex-end', gap:10,
      padding:'10px 14px', background:'rgba(10,10,20,0.88)', borderBottom:`1px solid ${ENC.border2}`, zIndex:30 }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, paddingBottom:4, flexShrink:0 }}>
        <span style={{ font:"700 22px 'Share Tech Mono'", color:tColor, lineHeight:1, fontVariantNumeric:'tabular-nums' }}>{timer}</span>
        <Eyebrow color="#55558a">Tour {turn}</Eyebrow>
      </div>
      <div style={{ display:'flex', alignItems:'flex-end', gap:5, flex:1 }}>
        {cards.map(c=>{
          const w=c.active?72:54, h=c.active?100:76, bc = c.sev? ENC.wound[c.sev] : 'rgba(255,255,255,.12)';
          return (
            <div key={c.l} style={{ position:'relative', width:w, height:h, borderRadius:6, overflow:'hidden',
              border:`2px solid ${bc}`, flexShrink:0, boxShadow: c.active?'0 0 12px rgba(245,197,66,.35)':'none' }}>
              <div style={{ position:'absolute', inset:0, background: c.npc?'linear-gradient(160deg,#2e1a1a,#4e2a2a)':'linear-gradient(160deg,#1a1a2e,#2a2a4e)',
                display:'flex', alignItems:'center', justifyContent:'center', font:`700 ${c.active?26:20}px 'Inter'`, color: c.npc?'#aa5555':'#5555aa' }}>{c.l[0]}</div>
              <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'linear-gradient(transparent,rgba(0,0,0,.88))', padding:'14px 4px 4px', textAlign:'center' }}>
                <div style={{ font:"700 9px 'Inter'", color:c.active?ENC.gold:'#e0e0f0', textShadow:'0 1px 3px #000', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.l}</div>
                <div style={{ font:"600 8px 'Share Tech Mono'", color:ENC.blue }}>{c.ini}</div>
              </div>
              {c.done && <span style={{ position:'absolute', top:3, right:4, font:"700 10px 'Inter'", color:ENC.green, textShadow:'0 1px 3px #000' }}>✓</span>}
              {c.status && <img src={`../../assets/status/${c.status}.svg`} width={c.active?22:18} height={c.active?22:18}
                style={{ position:'absolute', top:3, left:3, filter:'drop-shadow(0 1px 2px #000)' }} alt={c.status} />}
            </div>
          );
        })}
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2, paddingBottom:6, flexShrink:0 }}>
        <Eyebrow color="#55558a">{isAnn?'Annonce':'Résolution'}</Eyebrow>
        <span style={{ font:"700 18px 'Inter'", color:isAnn?ENC.amber:ENC.green, lineHeight:1 }}>{isAnn?'←':'→'}</span>
      </div>
    </div>
  );
}

Object.assign(window, { TimelineBar, useDrag });
