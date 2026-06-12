// App.jsx — orchestrates the click-through: login → dashboard → live session.
const { useState, useCallback } = React;

let _id = 100;
function rollDice(formula, mod) {
  // fake roll: sum of d20-style; return a total + threshold + success
  const map = { d20:20, d12:12, d10:10, d8:8, d6:6, d4:4, d100:100 };
  let total = mod;
  for (const [k,n] of Object.entries(formula)) for (let i=0;i<n;i++) total += 1+Math.floor(Math.random()*map[k]);
  return total;
}

function GmBar({ maps, active, onPick, combat, onCombat }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px', background:'#0c0c16',
      borderBottom:`1px solid ${ENC.border}`, zIndex:100, flexShrink:0 }}>
      <Eyebrow color={ENC.blue} style={{ letterSpacing:'.1em' }}>Cartes</Eyebrow>
      <div style={{ display:'flex', gap:6, flex:1, overflowX:'auto' }}>
        {maps.map(m=>(
          <button key={m} onClick={()=>onPick(m)} style={{ background: m===active?'rgba(91,141,238,.15)':'none',
            border:`1px solid ${m===active?ENC.blue:ENC.border2}`, borderRadius:4, padding:'5px 11px', whiteSpace:'nowrap',
            color: m===active?ENC.blue:'#8888a8', font:"12px 'Inter'", cursor:'pointer' }}>{m}</button>
        ))}
      </div>
      <button onClick={onCombat} style={{ display:'flex', alignItems:'center', gap:6, background: combat?'rgba(224,91,91,.12)':'none',
        border:`1px solid ${combat?ENC.red:ENC.border2}`, borderRadius:4, padding:'5px 12px',
        color: combat?ENC.red:'#8888a8', font:"600 12px 'Inter'", cursor:'pointer' }}>
        {combat ? <><IconX size={13}/> Combat</> : <><IconSword size={14}/> Combat</>}
      </button>
    </div>
  );
}

function FloatingRoster({ mode }) {
  const { pos, onDrag } = useDrag({ x: window.innerWidth - 600, y: 96 });
  return <RosterWindow pos={pos} onDrag={onDrag} mode={mode} />;
}
function FloatingDeclare({ onClose }) {
  const { pos, onDrag } = useDrag({ x: 48, y: 150 });
  return <DeclareWindow pos={pos} onDrag={onDrag} onClose={onClose} />;
}

function Session({ campaign, onLeave }) {
  const [sidebar, setSidebar] = useState(true);
  const [diceOpen, setDiceOpen] = useState(false);
  const [combat, setCombat] = useState(false);
  // combat sub-phase: 'pre' (roster pré-combat) → 'declare' (Phase 1) 
  const [phase, setPhase] = useState('pre');
  const [activeMap, setActiveMap] = useState('Place du marché');
  const [msgs, setMsgs] = useState([
    { id:1, system:true, text:'Brann le Sourd a rejoint la session.', time:'20:58' },
    { id:2, who:'Léa', color:'#FFD700', time:'21:01', text:'On pousse la porte de la taverne ?' },
    { id:3, type:'dice', who:'Kaelen', color:ENC.green, time:'21:04', label:'Jet de Discrétion', total:17, seuil:12, success:true, mr:5 },
    { id:4, type:'dice', who:'Esquive rapide', color:ENC.goldMuted, time:'21:05', label:'', total:3, seuil:12, success:false, mr:9, fav:true, secret:true },
  ]);

  const send = useCallback((text) => {
    const m = text.match(/^\/(d\d+)(?:\+(\d+))?/i);
    if (m) {
      const k = m[1].toLowerCase(), mod = m[2]?parseInt(m[2]):0;
      const total = rollDice({ [k]: 1 }, mod), seuil = 12;
      setMsgs(p=>[...p, { id:++_id, type:'dice', who:'toi', color:ENC.green, time:'21:06',
        label:`Jet ${k}${mod?'+'+mod:''}`, total, seuil, success: total>=seuil, mr: Math.abs(total-seuil), crit: total>=seuil+8 }]);
    } else {
      setMsgs(p=>[...p, { id:++_id, who:'toi', color:ENC.green, time:'21:06', text }]);
    }
  }, []);

  const handleTrayRoll = useCallback((f, mod) => {
    const total = rollDice(f, mod), seuil = 12;
    const label = Object.entries(f).filter(([,n])=>n>0).map(([k,n])=>`${n}${k}`).join('+') + (mod?(mod>0?`+${mod}`:mod):'');
    setMsgs(p=>[...p, { id:++_id, type:'dice', who:'toi', color:ENC.green, time:'21:07', label:`Jet ${label}`, total, seuil, success: total>=seuil, mr: Math.abs(total-seuil), crit: total>=seuil+8 }]);
    setDiceOpen(false);
  }, []);

  const toggleCombat = () => { const n=!combat; setCombat(n); setPhase('pre'); };

  return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', background:'#0a0a0f' }}>
      <GmBar maps={['Place du marché','Taverne du Norhont','Souterrains']} active={activeMap} onPick={setActiveMap} combat={combat} onCombat={toggleCombat} />
      <div style={{ flex:1, display:'flex', minHeight:0 }}>
        <div style={{ position:'relative', flex:1, minWidth:0 }}>
          <MapBackdrop />
          {combat && phase==='declare' && <TimelineBar />}
          {/* floating combat windows — draggable */}
          {combat && phase==='pre' && <FloatingRoster mode="pre" />}
          {combat && phase==='declare' && <FloatingDeclare onClose={()=>setCombat(false)} />}

          {/* combat phase stepper (stands in for the GM flow) */}
          {combat && (
            <div style={{ position:'absolute', top:phase==='declare'?130:14, left:'50%', transform:'translateX(-50%)', display:'flex', gap:8, zIndex:38 }}>
              <button onClick={()=>setPhase('pre')} style={{ ...phaseChip, ...(phase==='pre'?phaseChipOn:{}) }}>Pré-combat</button>
              <span style={{ color:'#3a4658', alignSelf:'center' }}>→</span>
              <button onClick={()=>setPhase('declare')} style={{ ...phaseChip, ...(phase==='declare'?phaseChipOn:{}) }}>Déclaration</button>
            </div>
          )}

          {/* floating dice tray */}
          {diceOpen && <div style={{ position:'absolute', right:18, bottom:78, zIndex:35 }}><DiceTray color={ENC.green} onRoll={handleTrayRoll} /></div>}

          {/* bottom-left toolbelt */}
          <div style={{ position:'absolute', left:14, bottom:14, display:'flex', gap:8, zIndex:20 }}>
            <button onClick={onLeave} title="Quitter" style={belt}>← Quitter</button>
          </div>
          {/* bottom-right controls */}
          <div style={{ position:'absolute', right:18, bottom:18, display:'flex', gap:8, zIndex:36 }}>
            <button onClick={()=>setDiceOpen(o=>!o)} title="Dés" style={{ ...beltRound, ...(diceOpen?beltActive:{}) }}><IconDice size={20}/></button>
            {!sidebar && <button onClick={()=>setSidebar(true)} style={beltRound}>☰</button>}
          </div>
        </div>
        {sidebar && <SessionSidebar width={300} messages={msgs} onSend={send} onClose={()=>setSidebar(false)} />}
      </div>
    </div>
  );
}
const belt = { background:'rgba(15,15,26,.85)', border:`1px solid ${ENC.border2}`, borderRadius:6, padding:'7px 12px', color:ENC.txtMid, font:"12px 'Inter'", cursor:'pointer' };
const beltRound = { width:42, height:42, borderRadius:10, background:'rgba(15,15,26,.9)', border:`1px solid ${ENC.border2}`, color:ENC.txtMid, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', font:"18px 'Inter'" };
const beltActive = { background:'rgba(76,175,119,.18)', borderColor:ENC.greenSoft, color:ENC.greenSoft };
const phaseChip = { background:'rgba(13,15,24,.9)', border:`1px solid ${ENC.winBorder}`, borderRadius:4, padding:'5px 12px', color:'#7c8aa0', font:"600 11px 'Inter'", letterSpacing:'.06em', cursor:'pointer' };
const phaseChipOn = { background:'rgba(58,138,170,.15)', borderColor:'#3a8aaa', color:'#3a8aaa' };

function App() {
  const [screen, setScreen] = useState('login'); // login | dashboard | session
  const [campaign, setCampaign] = useState(null);
  return (
    <>
      {screen==='login' && <Login onLogin={()=>setScreen('dashboard')} />}
      {screen==='dashboard' && <Dashboard onPlay={(c)=>{ setCampaign(c); setScreen('session'); }} onLogout={()=>setScreen('login')} />}
      {screen==='session' && <Session campaign={campaign} onLeave={()=>setScreen('dashboard')} />}
    </>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
