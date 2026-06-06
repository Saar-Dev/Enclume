// SessionApp.jsx — pre-game (login, dashboard) + the live session shell. Click-through flow.
const { useState: useStateA } = React;

/* ---------------- LOGIN ---------------- */
function Login({ onLogin }) {
  return (
    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
      background:'radial-gradient(circle at 20% 20%, #1a2340 0%, transparent 40%), radial-gradient(circle at 80% 80%, #0b0e14 0%, transparent 50%), #0f1115' }}>
      <div style={{ position:'absolute', inset:0, opacity:.10, filter:'invert(1)', backgroundRepeat:'no-repeat', backgroundPosition:'center', backgroundSize:'500px',
        backgroundImage:`url("data:image/svg+xml;utf8,${encodeURIComponent(window.__ENCLUME_LOGO_RAW__||'')}")`, pointerEvents:'none' }} />
      <div style={{ position:'relative', width:340, background:'linear-gradient(180deg,#151923,#10131b)', border:'1px solid #252b3a',
        borderRadius:14, padding:20, boxShadow:'0 10px 30px rgba(0,0,0,.35)' }}>
        <div style={{ textAlign:'center', marginBottom:18 }}>
          <h1 style={{ margin:0, font:"400 34px 'Venus Rising',sans-serif", color:'#e8eef7', letterSpacing:'.01em' }}>Enclume</h1>
          <p style={{ margin:'4px 0 0', font:"13px 'Inter'", color:'#9aa4b2' }}>VTT pour Polaris · sessions privées</p>
        </div>
        <form onSubmit={e=>{e.preventDefault(); onLogin();}} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div><label style={lbl}>Email</label><input defaultValue="mj@enclume.fr" style={inp} /></div>
          <div><label style={lbl}>Mot de passe</label><input type="password" defaultValue="forgeron" style={inp} /></div>
          <button type="submit" style={{ width:'100%', marginTop:8, background:'#5b8dee', border:'none', color:'#fff', borderRadius:12, padding:'9px', font:"600 14px 'Inter'", cursor:'pointer' }}>Se connecter</button>
        </form>
        <p style={{ textAlign:'center', marginTop:12, font:"13px 'Inter'" }}><a style={{ color:'#5b8dee', textDecoration:'none' }}>Créer un compte</a></p>
      </div>
    </div>
  );
}
const lbl = { font:"12px 'Inter'", color:'#9aa4b2', display:'block', marginBottom:4 };
const inp = { width:'100%', boxSizing:'border-box', background:'#0c0f16', color:'#e8eef7', border:'1px solid #252b3a', borderRadius:12, padding:'8px 10px', font:"14px 'Inter'", outline:'none' };

/* ---------------- DASHBOARD ---------------- */
function Dashboard({ onPlay, onLogout }) {
  const camps = [
    { n:'Les Cendres de Kanaan', role:'gm', code:'X7K2-9QP', cover:'linear-gradient(135deg,#3a2618,#1a0e08)' },
    { n:'La Dérive du Norhont', role:'gm', code:'B4M1-2RT', cover:'linear-gradient(135deg,#16263a,#0a1018)' },
    { n:'Convoi 17', role:'player', code:'K9PL-3XZ', cover:'linear-gradient(135deg,#2a163a,#120a18)' },
  ];
  return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', background:'#0f1115' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 32px', height:56, flexShrink:0, background:'#10131b', borderBottom:'1px solid #252b3a' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <AnvilLogo h={26} body="#5b8dee" />
          <span style={{ font:"500 16px 'Inter'", color:'#e8eef7' }}>Enclume</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <span style={{ font:"13px 'Inter'", color:'#9aa4b2' }}>Atelier du MJ</span>
          <span style={{ font:"14px 'Inter'", color:'#e8eef7' }}>toi</span>
          <button onClick={onLogout} style={{ background:'none', border:'1px solid #252b3a', borderRadius:6, padding:'6px 12px', color:'#9aa4b2', font:"13px 'Inter'", cursor:'pointer' }}>Déconnexion</button>
        </div>
      </div>
      <div style={{ flex:1, overflowY:'auto' }}>
        <div style={{ maxWidth:900, margin:'0 auto', padding:'40px 32px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12 }}>
            {camps.map(c=>(
              <div key={c.n} onClick={()=>onPlay(c.n)} style={{ background:'linear-gradient(180deg,#151923,#10131b)', border:'1px solid #252b3a', borderRadius:14, padding:12, cursor:'pointer' }}>
                <div style={{ height:110, borderRadius:12, background:c.cover, marginBottom:10 }} />
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ font:"500 15px 'Inter'", color:'#e8eef7' }}>{c.n}</span>
                  <span style={{ font:"11px 'Inter'", padding:'3px 8px', borderRadius:6, ...(c.role==='gm'?{background:'rgba(91,141,238,.2)', color:'#5b8dee'}:{background:'rgba(76,175,119,.2)', color:'#4caf77'}) }}>{c.role==='gm'?'MJ':'Joueur'}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10 }}>
                  <span style={{ font:"12px 'Share Tech Mono'", color:'#6b7280' }}>#{c.code}</span>
                  <button onClick={e=>{e.stopPropagation(); onPlay(c.n);}} style={{ background:'#5b8dee', color:'#fff', border:'none', borderRadius:6, padding:'8px 16px', font:"13px 'Inter'", cursor:'pointer' }}>Jouer</button>
                </div>
              </div>
            ))}
            {/* join + create cards */}
            <div style={{ position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:180,
              background:'linear-gradient(180deg,#151923,#10131b)', border:'1px solid #252b3a', borderRadius:14 }}>
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', font:"900 160px 'Inter'", color:'rgba(255,255,255,.04)', pointerEvents:'none' }}>→</div>
              <div style={{ position:'relative', zIndex:1, font:"13px 'Inter'", color:'#9aa4b2', marginBottom:12 }}>Rejoindre une campagne</div>
              <div style={{ position:'relative', zIndex:1, display:'flex', flexDirection:'column', gap:8, width:'80%' }}>
                <input placeholder="#code-invitation" style={{ ...inp, background:'#0f1115', borderRadius:6, padding:'8px 12px', font:"13px 'Inter'" }} />
                <button style={{ background:'#5b8dee', color:'#fff', border:'none', borderRadius:6, padding:'8px', font:"13px 'Inter'", cursor:'pointer' }}>Rejoindre</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 3D MAP PLACEHOLDER ---------------- */
function MapBackdrop() {
  return (
    <div style={{ position:'absolute', inset:0, overflow:'hidden',
      background:'radial-gradient(circle at 30% 25%, #1a2340 0%, transparent 45%), radial-gradient(circle at 75% 80%, #160e22 0%, transparent 50%), #0a0a0f' }}>
      <div style={{ position:'absolute', inset:0, opacity:.05, backgroundRepeat:'no-repeat', backgroundPosition:'center 46%', backgroundSize:'560px',
        backgroundImage:`url("data:image/svg+xml;utf8,${encodeURIComponent(window.__ENCLUME_LOGO_RAW__||'')}")` }} />
      {/* faux iso grid */}
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:.5 }}>
        <defs><pattern id="iso" width="56" height="32" patternTransform="skewX(-30)" patternUnits="userSpaceOnUse">
          <path d="M0 0 H56 M0 0 V32" stroke="#1c2336" strokeWidth="1" fill="none"/></pattern></defs>
        <rect x="-200" y="40%" width="160%" height="60%" fill="url(#iso)" />
      </svg>
      {/* tokens on the map */}
      {[['Kaelen',ENC.green,'46%','58%'],['Orsa','#FFD700','54%','52%'],['Brann',ENC.gold,'50%','64%'],['Sicaire',ENC.red,'62%','60%']].map(([n,c,l,t])=>(
        <div key={n} style={{ position:'absolute', left:l, top:t, transform:'translate(-50%,-50%)', textAlign:'center' }}>
          <div style={{ width:34, height:34, borderRadius:'50%', background:`radial-gradient(circle at 35% 30%, ${c}, ${c}66)`, border:`2px solid ${c}`, boxShadow:`0 4px 10px rgba(0,0,0,.6), 0 0 0 4px ${c}1a` }} />
          <div style={{ font:"600 9px 'Inter'", color:'#cdd3e0', marginTop:3, textShadow:'0 1px 3px #000' }}>{n}</div>
        </div>
      ))}
      <div style={{ position:'absolute', bottom:12, left:12, display:'flex', alignItems:'center', gap:6, padding:'4px 9px', background:'rgba(10,10,20,.7)', border:`1px solid ${ENC.border}`, borderRadius:6 }}>
        <span style={{ width:6, height:6, borderRadius:'50%', background:ENC.green }} />
        <span style={{ font:"10px 'Share Tech Mono'", color:ENC.txtMid }}>carte 3D · react-three-fiber</span>
      </div>
    </div>
  );
}
Object.assign(window, { Login, Dashboard, MapBackdrop });
