// SessionSidebar.jsx — the in-game right sidebar: Chat (with dice rolls), Persos, Joueurs.
const { useState, useRef, useEffect } = React;

function DiceMsg({ m }) {
  const ok = m.success;
  const tint = ok ? 'rgba(76,175,119,' : 'rgba(224,92,92,';
  return (
    <div style={{ background: tint+'.07)', border:`1px solid ${tint}.2)`, borderRadius:8, padding:'8px 10px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:3 }}>
        <span style={{ color: m.color, display:'flex' }}>{m.fav ? <span style={{fontSize:13}}>★</span> : <IconDice />}</span>
        <span style={{ font:"500 12px 'Inter'", color:m.color }}>{m.who}</span>
        <span style={{ font:"10px 'Inter'", color:ENC.txtLo }}> · {m.time}</span>
        {m.secret && <span style={{ fontSize:9, marginLeft:2 }}>🔒</span>}
      </div>
      <div style={{ display:'flex', alignItems:'baseline', gap:8, paddingLeft:2 }}>
        <span style={{ font:"14px 'Inter'", color:ENC.txtMid }}>{m.label}</span>
        <span style={{ font:"700 20px 'Share Tech Mono'", color:'#dde7ee', fontVariantNumeric:'tabular-nums' }}>{m.total}</span>
        <span style={{ font:"10px 'Inter'", color:'#456575' }}>/ {m.seuil}</span>
      </div>
      <span style={{ display:'inline-block', marginTop:4, font:"600 11px 'Inter'", padding:'2px 8px', borderRadius:4,
        background: tint+'.15)', border:`1px solid ${tint}.4)`, color: ok?ENC.greenSoft:ENC.red }}>
        {ok ? `Marge de réussite +${m.mr}` : `Marge d'échec −${m.mr}`}{m.crit ? (ok?' ✦ Critique':' ✦ Maladresse') : ''}
      </span>
    </div>
  );
}

function PlainMsg({ m }) {
  if (m.system) return (
    <div style={{ display:'flex', justifyContent:'center', gap:6, alignItems:'center' }}>
      <span style={{ font:"italic 11px 'Inter'", color:ENC.txtLo }}>{m.text}</span>
      <span style={{ font:"10px 'Inter'", color:ENC.txtLo }}>{m.time}</span>
    </div>
  );
  return (
    <div style={{ display:'flex', flexWrap:'wrap', alignItems:'baseline', gap:4 }}>
      <span style={{ font:"500 12px 'Inter'", color:m.color }}>{m.who}</span>
      <span style={{ font:"10px 'Inter'", color:ENC.txtLo }}>· {m.time}</span>
      <span style={{ width:'100%', font:"13px/1.4 'Inter'", color:ENC.txtHi, wordBreak:'break-word' }}>{m.text}</span>
    </div>
  );
}

function SessionSidebar({ width, messages, onSend, onClose }) {
  const [tab, setTab] = useState('chat');
  const [draft, setDraft] = useState('');
  const scroller = useRef(null);
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }, [messages, tab]);

  const tabs = [['chat','Chat'],['persos','Persos'],['joueurs','Joueurs'],['biblio','Biblio'],['config','Config']];
  const personnages = [
    { n:'Kaelen Vorne', o:'toi', c:ENC.green },
    { n:'Maître Orsa', o:'Léa', c:'#FFD700' },
    { n:'Brann le Sourd', o:'Théo', c:ENC.gold },
  ];
  const joueurs = [
    { n:'toi', gm:true, on:true, ch:'Kaelen Vorne', c:ENC.green },
    { n:'Léa', gm:false, on:true, ch:'Maître Orsa', c:'#FFD700' },
    { n:'Théo', gm:false, on:false, ch:'Brann le Sourd', c:ENC.gold },
  ];

  return (
    <div style={{ position:'relative', height:'100%', width, background:ENC.bgSession, borderLeft:`1px solid ${ENC.border}`,
      display:'flex', flexDirection:'column', flexShrink:0, userSelect:'none' }}>
      <div style={{ position:'absolute', left:-3, top:0, width:6, height:'100%', cursor:'col-resize', zIndex:20 }} />
      <button onClick={onClose} title="Fermer" style={{ position:'absolute', top:8, right:8, background:'none', border:'none',
        color:ENC.txtLo, cursor:'pointer', padding:'2px 6px', borderRadius:4, display:'flex', zIndex:10 }}><IconX /></button>

      {/* tabs */}
      <div style={{ display:'flex', borderBottom:`1px solid ${ENC.border}`, flexShrink:0, paddingTop:6 }}>
        {tabs.map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k)} style={{ flex:1, padding:'8px 0', background:'none', border:'none',
            borderBottom:`2px solid ${tab===k?ENC.blue:'transparent'}`, color:tab===k?ENC.txtMid:ENC.txtLo,
            cursor:'pointer', font:"600 10px 'Inter'", letterSpacing:'.5px', textTransform:'uppercase' }}>{l}</button>
        ))}
      </div>

      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {tab==='chat' && (<>
          <div ref={scroller} style={{ flex:1, overflowY:'auto', padding:'8px 12px', display:'flex', flexDirection:'column', gap:6 }}>
            {messages.map(m => m.type==='dice' ? <DiceMsg key={m.id} m={m} /> : <PlainMsg key={m.id} m={m} />)}
          </div>
          <form onSubmit={e=>{e.preventDefault(); if(draft.trim()){onSend(draft.trim()); setDraft('');}}}
            style={{ display:'flex', gap:6, padding:'8px 12px', borderTop:`1px solid ${ENC.border}`, flexShrink:0 }}>
            <input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Message ou /d20+3…"
              style={{ flex:1, background:ENC.bgRaised, border:`1px solid ${ENC.border}`, borderRadius:6, padding:'6px 10px',
                color:ENC.txtHi, font:"12px 'Inter'", outline:'none' }} />
            <button type="submit" style={{ background:'none', border:'none', color:ENC.blue, cursor:'pointer', display:'flex', alignItems:'center', padding:'4px 6px' }}><IconSend /></button>
          </form>
        </>)}

        {tab==='persos' && (
          <div style={{ display:'flex', flexDirection:'column', gap:4, padding:'8px 12px' }}>
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:4 }}>
              <button style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(91,141,238,.1)',
                border:'1px solid rgba(91,141,238,.3)', borderRadius:6, color:ENC.blue, font:"11px 'Inter'", padding:'5px 10px', cursor:'pointer' }}><IconPlus size={12}/> Nouveau perso</button>
            </div>
            {personnages.map(p=>(
              <div key={p.n} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:ENC.bgRaised,
                border:`1px solid ${ENC.border}`, borderRadius:6, cursor:'grab' }}>
                <span style={{ width:10, height:10, borderRadius:'50%', background:p.c, flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ font:"13px 'Inter'", color:ENC.txtHi, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.n}</div>
                  <div style={{ font:"10px 'Inter'", color:ENC.txtLo }}>{p.o}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab==='joueurs' && (
          <div style={{ display:'flex', flexDirection:'column', gap:4, padding:'8px 12px' }}>
            {joueurs.map(p=>(
              <div key={p.n} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:ENC.bgRaised, border:`1px solid ${ENC.border}`, borderRadius:6 }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background:p.on?ENC.green:ENC.txtLo, flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ font:"13px 'Inter'", color:ENC.txtHi }}>{p.n}</span>
                    <span style={{ font:"9px 'Inter'", letterSpacing:'.5px', textTransform:'uppercase', padding:'1px 4px', borderRadius:3,
                      ...(p.gm ? {color:ENC.blue, background:'rgba(91,141,238,.15)', border:'1px solid rgba(91,141,238,.3)'} : {color:ENC.txtLo, background:'rgba(74,74,96,.2)', border:'1px solid rgba(74,74,96,.3)'}) }}>{p.gm?'MJ':'PJ'}</span>
                  </div>
                  <div style={{ font:"11px 'Inter'", color:ENC.txtLo, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.ch}</div>
                </div>
                <span style={{ font:"10px 'Inter'", color:p.on?ENC.greenSoft:ENC.txtLo }}>{p.on?'en ligne':'absent'}</span>
              </div>
            ))}
          </div>
        )}

        {tab==='biblio' && <p style={{ font:"italic 12px 'Inter'", color:ENC.txtLo, textAlign:'center', padding:'24px 12px' }}>Bibliothèque — bientôt.</p>}
        {tab==='config' && (
          <div style={{ padding:'14px 14px', display:'flex', flexDirection:'column', gap:12 }}>
            <Eyebrow>Profil</Eyebrow>
            <div><label style={{ font:"12px 'Inter'", color:ENC.txtMid, display:'block', marginBottom:4 }}>Pseudo</label>
              <input defaultValue="toi" style={{ width:'100%', boxSizing:'border-box', background:ENC.bgRaised, border:`1px solid ${ENC.border}`, borderRadius:6, padding:'6px 10px', color:ENC.txtHi, font:"13px 'Inter'", outline:'none' }} /></div>
            <div><label style={{ font:"12px 'Inter'", color:ENC.txtMid, display:'block', marginBottom:6 }}>Couleur</label>
              <div style={{ display:'flex', gap:8 }}>{['#4caf77','#5b8dee','#FFD700','#e05b5b','#aa3bff'].map(c=>
                <span key={c} style={{ width:24, height:24, borderRadius:6, background:c, cursor:'pointer', border: c==='#4caf77'?'2px solid #fff':'2px solid transparent' }} />)}</div></div>
          </div>
        )}
      </div>
    </div>
  );
}
window.SessionSidebar = SessionSidebar;
