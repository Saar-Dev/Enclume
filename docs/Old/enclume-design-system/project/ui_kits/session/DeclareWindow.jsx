// DeclareWindow.jsx — faithful recreation of CombatActionWindow Phase 1 (Déclaration).
// Sections: TACTIQUE / ARMEMENT / ACTION / ACTIONS RAPIDES / ROSTER. Tactical-HUD palette.
const { useState: useStateD, useRef: useRefD, useEffect: useEffectD } = React;

const STATE_DEFS = {
  position: { label:'POSTURE', states:[['standing','Debout'],['crouching','Accroupi'],['prone','Couché']], cost:{ standing:{crouching:-3,prone:-5}, crouching:{standing:-3,prone:-5}, prone:{standing:-10,crouching:-10} } },
  cover:    { label:'COUVERTURE', states:[['exposed','Découvert'],['partial','Partielle'],['important','Importante']], cost:{} },
  vitesse:  { label:'VITESSE', states:[['delayed','Retardée'],['normal','Normale'],['rushed','Précipitée']], cost:{ delayed:{normal:0,rushed:3}, normal:{delayed:0,rushed:3}, rushed:{delayed:0,normal:0} } },
  weapon:   { label:'ARME', states:[['holstered','Rangée'],['ready',"Main sur l'arme"],['drawn','Au clair']], cost:{ holstered:{ready:-3,drawn:-5}, ready:{holstered:-5,drawn:-3}, drawn:{holstered:-10,ready:-3} } },
  fire_mode:{ label:'MODE DE TIR', states:[['cc','Coup par coup'],['rc','Rafale courte'],['rl','Rafale longue']], cost:{ cc:{rc:-3,rl:-3}, rc:{cc:-3,rl:-3}, rl:{cc:-3,rc:-3} } },
};
const MAP_ACTIONS = [
  { k:'move', l:'Déplacement', span2:true, hint:'cliquer destination' },
  { k:'attack', l:'Assaut (tir)', hint:'cliquer cible', sub:'cible hors portée' },
  { k:'melee', l:'Corps à corps', ini:-3, hint:'cliquer adversaire' },
  { k:'reload', l:'Rechargement', span2:true },
  { k:'multi', l:'Attaque multiple', ini:-5 },
  { k:'interact', l:'Interagir' },
];
const QUICK = [
  { k:'observer', l:'Observer le combat', kind:'inc', max:6 },
  { k:'reperer', l:'Repérer (obj., personne, lieu…)', kind:'inc', max:6 },
  { k:'phrase', l:'Prononcer une phrase', kind:'fixed', ini:-3 },
];
const ROSTER = [
  { id:'fddfg', tag:'RC', tagColor:'#3a8aaa', ini:7 },
  { id:'Deep', tag:'DST', tagColor:'#5b8dee', ini:7 },
  { id:'Civil', tag:'CTC', tagColor:'#c8a030', ini:7 },
  { id:'Thug', tag:'CTC', tagColor:'#c8a030', ini:7 },
  { id:'Soleil', tag:'DST', tagColor:'#5b8dee', ini:11 },
];
const cost = (def,from,to)=> from===to?0:(def.cost?.[from]?.[to] ?? 0);

function StateSelector({ def, value, initial, onChange }) {
  return (
    <div style={DS.ssRow}>
      <span style={DS.ssLabel}>{def.label}</span>
      <div style={DS.seg}>
        {def.states.map(([k,l]) => {
          const isActive = k===value;
          const c = cost(def, initial, k);
          const cStr = c===0?null:(c>0?`+${c}`:`${c}`);
          return (
            <div key={k} onClick={()=>!isActive&&onChange(k)} style={{ ...DS.segOpt, ...(isActive?DS.segOptActive:{}) }}>
              <span style={DS.segOptLabel}>{l}</span>
              {cStr && !isActive && <span style={{ ...DS.segCost, color:c>0?'#3aaa6a':'#c86030' }}>{cStr}</span>}
              {isActive && k===initial && <span style={DS.segCostCur}>actuel</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DeclareWindow({ pos, onDrag, onClose }) {
  const [states, setStates] = useStateD({ position:'standing', cover:'exposed', vitesse:'normal', weapon:'holstered', fire_mode:'cc' });
  const initial = { position:'standing', cover:'exposed', vitesse:'normal', weapon:'holstered', fire_mode:'cc' };
  const [sel, setSel] = useStateD(new Set());
  const [quick, setQuick] = useStateD({ observer:0, reperer:0, phrase:false });
  const [checked, setChecked] = useStateD({});
  const set = (k,v)=>setStates(s=>({ ...s, [k]:v }));
  const toggle = k => setSel(p=>{ const n=new Set(p); n.has(k)?n.delete(k):n.add(k); return n; });

  const declaredCount = Object.values(checked).filter(Boolean).length;

  return (
    <div style={{ ...DS.window, left:pos.x, top:pos.y }}>
      <div style={DS.header} onMouseDown={onDrag}>
        <span style={DS.title}>PHASE 1 — DÉCLARATION</span>
        <span style={DS.declared}>{declaredCount}/5 déclarés</span>
      </div>

      <div style={DS.body}>
        {/* TACTIQUE */}
        <div style={DS.section}>
          <div style={DS.sectionTitle}>TACTIQUE</div>
          <StateSelector def={STATE_DEFS.position} value={states.position} initial={initial.position} onChange={v=>set('position',v)} />
          <StateSelector def={STATE_DEFS.cover} value={states.cover} initial={initial.cover} onChange={v=>set('cover',v)} />
          <StateSelector def={STATE_DEFS.vitesse} value={states.vitesse} initial={initial.vitesse} onChange={v=>set('vitesse',v)} />
        </div>

        {/* ARMEMENT */}
        <div style={DS.section}>
          <div style={DS.sectionTitle}>ARMEMENT</div>
          <StateSelector def={STATE_DEFS.weapon} value={states.weapon} initial={initial.weapon} onChange={v=>set('weapon',v)} />
          <StateSelector def={STATE_DEFS.fire_mode} value={states.fire_mode} initial={initial.fire_mode} onChange={v=>set('fire_mode',v)} />
        </div>

        {/* ACTION */}
        <div style={DS.section}>
          <div style={DS.sectionTitle}>ACTION</div>
          <div style={DS.itemsGrid}>
            {MAP_ACTIONS.map(a => {
              const on = sel.has(a.k);
              return (
                <div key={a.k} onClick={()=>toggle(a.k)} style={{ ...DS.item, ...(a.span2?{ gridColumn:'1 / -1' }:{}), ...(on?DS.itemOn:{}) }}>
                  <span style={DS.itemLabel}>{a.l}</span>
                  <span style={DS.itemMeta}>{a.sub && on ? <span style={DS.itemSub}>{a.sub}</span> : null}{a.ini!=null && <span style={DS.itemIni}>{a.ini}</span>}{a.hint && on && <span style={DS.itemHint}>{a.hint}</span>}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ACTIONS RAPIDES */}
        <div style={DS.section}>
          <div style={DS.sectionTitle}>ACTIONS RAPIDES</div>
          {QUICK.map(a => (
            <div key={a.k} style={DS.quickRow}>
              <span style={DS.quickLabel}>{a.l}</span>
              {a.kind==='inc' ? (
                <div style={DS.quickCtl}>
                  <span style={DS.quickMin}>1</span>
                  <input type="range" min={1} max={a.max} value={Math.max(1,quick[a.k])} onChange={e=>setQuick(q=>({ ...q, [a.k]:+e.target.value }))} style={{ flex:1, accentColor:'#3a8aaa' }} />
                  <span style={DS.quickMin}>{a.max}</span>
                  <span style={DS.quickVal}>{quick[a.k]? -5*quick[a.k] : '–'}</span>
                </div>
              ) : (
                <span style={{ ...DS.itemIni, marginLeft:'auto' }}>{a.ini}</span>
              )}
            </div>
          ))}
        </div>

        {/* ROSTER */}
        <div style={{ ...DS.section, borderBottom:'none' }}>
          <div style={DS.rosterHead}>
            <span style={DS.sectionTitleInline}>ROSTER — 5 PNJs</span>
            <button style={DS.rosterAll}>tout</button>
          </div>
          {ROSTER.map(r => (
            <label key={r.id} style={DS.rosterRow}>
              <input type="checkbox" checked={!!checked[r.id]} onChange={()=>setChecked(c=>({ ...c, [r.id]:!c[r.id] }))} style={{ accentColor:'#3a8aaa', cursor:'pointer' }} />
              <span style={DS.rosterDot}>○</span>
              <span style={DS.rosterName}>{r.id}</span>
              <span style={{ ...DS.rosterTag, color:r.tagColor, borderColor:r.tagColor+'66' }}>{r.tag}</span>
              <span style={DS.rosterIni}>INI {r.ini}</span>
            </label>
          ))}
        </div>
      </div>

      <button style={DS.declareBtn}>DÉCLARER</button>
    </div>
  );
}

const DS = {
  window: { position:'absolute', width:360, background:'#0d0f18', border:'1px solid #1e2435', borderRadius:6, boxShadow:'0 8px 32px rgba(0,0,0,0.7)', maxHeight:'calc(100% - 90px)', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:"'Inter', system-ui", zIndex:43 },
  header: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 14px', borderBottom:'1px solid #2a2a3e', background:'#080a12', cursor:'grab', userSelect:'none' },
  title: { fontSize:11, fontWeight:700, letterSpacing:'0.12em', color:'#3a8aaa' },
  declared: { fontSize:10, color:'#456575', fontFamily:"'Share Tech Mono'" },
  body: { overflowY:'auto', minHeight:0 },
  section: { borderBottom:'1px solid #1e1e2e', paddingBottom:4 },
  sectionTitle: { padding:'7px 10px 3px', fontSize:8, fontWeight:700, color:'#5a8aaa', textTransform:'uppercase', letterSpacing:'0.12em' },
  sectionTitleInline: { fontSize:8, fontWeight:700, color:'#5a8aaa', textTransform:'uppercase', letterSpacing:'0.12em' },
  // StateSelector
  ssRow: { display:'flex', alignItems:'center', padding:'3px 10px', gap:6 },
  ssLabel: { fontSize:8, color:'#456575', letterSpacing:'0.1em', textTransform:'uppercase', width:76, flexShrink:0 },
  seg: { display:'flex', flex:1, background:'#0a1018', border:'1px solid #15212e' },
  segOpt: { flex:1, padding:'4px 6px', textAlign:'center', cursor:'pointer', border:'1px solid transparent' },
  segOptActive: { background:'#162028', borderColor:'#3a8aaa66' },
  segOptLabel: { fontSize:9, color:'#dde7ee', display:'block' },
  segCost: { fontSize:7, display:'block', marginTop:1 },
  segCostCur: { fontSize:7, color:'#3a8aaa', display:'block', marginTop:1 },
  // action grid
  itemsGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', padding:'0 4px' },
  item: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 8px', margin:'1px 2px', borderRadius:3, cursor:'pointer', background:'rgba(255,255,255,0.02)', border:'1px solid transparent' },
  itemOn: { background:'rgba(58,138,170,0.12)', borderColor:'#3a8aaa66' },
  itemLabel: { fontSize:11, color:'#c0c0d0' },
  itemMeta: { display:'flex', alignItems:'center', gap:6 },
  itemIni: { fontSize:9, color:'#c86030', fontFamily:"'Share Tech Mono'" },
  itemSub: { fontSize:9, color:'#e07070' },
  itemHint: { fontSize:8, color:'#456575', fontStyle:'italic' },
  // quick
  quickRow: { display:'flex', alignItems:'center', gap:8, padding:'5px 12px' },
  quickLabel: { fontSize:11, color:'#c0c0d0', flexShrink:0 },
  quickCtl: { display:'flex', alignItems:'center', gap:6, flex:1, marginLeft:'auto', maxWidth:160 },
  quickMin: { fontSize:9, color:'#456575' },
  quickVal: { fontSize:10, fontWeight:600, color:'#3a8aaa', minWidth:22, textAlign:'right', fontFamily:"'Share Tech Mono'" },
  // roster
  rosterHead: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 12px 3px' },
  rosterAll: { background:'none', border:'none', color:'#5a8aaa', fontSize:9, letterSpacing:'0.08em', cursor:'pointer', textTransform:'lowercase' },
  rosterRow: { display:'flex', alignItems:'center', gap:8, padding:'5px 12px', cursor:'pointer' },
  rosterDot: { fontSize:8, color:'#3a8aaa' },
  rosterName: { fontSize:11, color:'#c0c0d0', fontWeight:600 },
  rosterTag: { fontSize:8, fontWeight:700, letterSpacing:'0.05em', padding:'1px 5px', borderRadius:2, border:'1px solid', marginLeft:'auto', fontFamily:"'Share Tech Mono'" },
  rosterIni: { fontSize:9, color:'#456575', fontFamily:"'Share Tech Mono'", width:42, textAlign:'right' },
  declareBtn: { display:'block', width:'100%', padding:'11px 14px', background:'rgba(58,138,170,0.08)', border:'none', borderTop:'1px solid #1e2435', color:'#3a8aaa', fontSize:11, fontWeight:700, letterSpacing:'0.12em', cursor:'pointer' },
};
window.DeclareWindow = DeclareWindow;
