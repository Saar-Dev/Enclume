/* @ds-bundle: {"format":4,"namespace":"EnclumeDesignSystem_4ac51c","components":[],"sourceHashes":{"preview/tweaks-panel.jsx":"6591467622ed","ui_kits/session/App.jsx":"b3e84081097b","ui_kits/session/CombatWindows.jsx":"134613ee5bff","ui_kits/session/DeclareWindow.jsx":"287112b59300","ui_kits/session/DiceTray.jsx":"4278cf106491","ui_kits/session/EncUI.jsx":"4cc3ba4f8d84","ui_kits/session/RosterWindow.jsx":"a9468c8fe4b8","ui_kits/session/SessionApp.jsx":"26b597c2f20d","ui_kits/session/SessionSidebar.jsx":"80f532209cd8"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.EnclumeDesignSystem_4ac51c = window.EnclumeDesignSystem_4ac51c || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// preview/tweaks-panel.jsx
try { (() => {
// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)

/* BEGIN USAGE */
// tweaks-panel.jsx
// Reusable Tweaks shell + form-control helpers.
// Exports (to window): useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider,
//   TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
//
// Usage (in an HTML file that loads React + Babel):
//
//   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
//     "primaryColor": "#D97757",
//     "palette": ["#D97757", "#29261b", "#f6f4ef"],
//     "fontSize": 16,
//     "density": "regular",
//     "dark": false
//   }/*EDITMODE-END*/;
//
//   function App() {
//     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
//     return (
//       <div style={{ fontSize: t.fontSize, color: t.primaryColor }}>
//         Hello
//         <TweaksPanel>
//           <TweakSection label="Typography" />
//           <TweakSlider label="Font size" value={t.fontSize} min={10} max={32} unit="px"
//                        onChange={(v) => setTweak('fontSize', v)} />
//           <TweakRadio  label="Density" value={t.density}
//                        options={['compact', 'regular', 'comfy']}
//                        onChange={(v) => setTweak('density', v)} />
//           <TweakSection label="Theme" />
//           <TweakColor  label="Primary" value={t.primaryColor}
//                        options={['#D97757', '#2A6FDB', '#1F8A5B', '#7A5AE0']}
//                        onChange={(v) => setTweak('primaryColor', v)} />
//           <TweakColor  label="Palette" value={t.palette}
//                        options={[['#D97757', '#29261b', '#f6f4ef'],
//                                  ['#475569', '#0f172a', '#f1f5f9']]}
//                        onChange={(v) => setTweak('palette', v)} />
//           <TweakToggle label="Dark mode" value={t.dark}
//                        onChange={(v) => setTweak('dark', v)} />
//         </TweaksPanel>
//       </div>
//     );
//   }
//
// TweakRadio is the segmented control for 2–3 short options (auto-falls-back to
// TweakSelect past ~16/~10 chars per label); reach for TweakSelect directly when
// options are many or long. For color tweaks always curate 3-4 options rather than
// a free picker; an option can also be a whole 2–5 color palette (the stored value
// is the array). The Tweak* controls are a floor, not a ceiling — build custom
// controls inside the panel if a tweak calls for UI they don't cover.
/* END USAGE */
// ─────────────────────────────────────────────────────────────────────────────

const __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;box-sizing:border-box;width:100%;min-width:0;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;box-sizing:border-box;min-width:0;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);
    box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),
    0 2px 6px rgba(0,0,0,.15)}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;
    display:flex;flex-direction:column;box-shadow:-1px 0 0 rgba(0,0,0,.1)}
  .twk-chip>span>i{flex:1;box-shadow:0 -1px 0 rgba(0,0,0,.1)}
  .twk-chip>span>i:first-child{box-shadow:none}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
`;

// ── useTweaks ───────────────────────────────────────────────────────────────
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null ? keyOrEdits : {
      [keyOrEdits]: val
    };
    setValues(prev => ({
      ...prev,
      ...edits
    }));
    window.parent.postMessage({
      type: '__edit_mode_set_keys',
      edits
    }, '*');
    // Same-window signal so in-page listeners (deck-stage rail thumbnails)
    // can react — the parent message only reaches the host, not peers.
    window.dispatchEvent(new CustomEvent('tweakchange', {
      detail: edits
    }));
  }, []);
  return [values, setTweak];
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
// Floating shell. Registers the protocol listener BEFORE announcing
// availability — if the announce ran first, the host's activate could land
// before our handler exists and the toolbar toggle would silently no-op.
// The close button posts __edit_mode_dismissed so the host's toolbar toggle
// flips off in lockstep; the host echoes __deactivate_edit_mode back which
// is what actually hides the panel.
function TweaksPanel({
  title = 'Tweaks',
  children
}) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef(null);
  const offsetRef = React.useRef({
    x: 16,
    y: 16
  });
  const PAD = 16;
  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth,
      h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y))
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);
  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);
  React.useEffect(() => {
    const onMsg = e => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({
      type: '__edit_mode_available'
    }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);
  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({
      type: '__edit_mode_dismissed'
    }, '*');
  };
  const onDragStart = e => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX,
      sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = ev => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy)
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  if (!open) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("style", null, __TWEAKS_STYLE), /*#__PURE__*/React.createElement("div", {
    ref: dragRef,
    className: "twk-panel",
    "data-omelette-chrome": "",
    style: {
      right: offsetRef.current.x,
      bottom: offsetRef.current.y
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-hd",
    onMouseDown: onDragStart
  }, /*#__PURE__*/React.createElement("b", null, title), /*#__PURE__*/React.createElement("button", {
    className: "twk-x",
    "aria-label": "Close tweaks",
    onMouseDown: e => e.stopPropagation(),
    onClick: dismiss
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "twk-body"
  }, children)));
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function TweakSection({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "twk-sect"
  }, label), children);
}
function TweakRow({
  label,
  value,
  children,
  inline = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: inline ? 'twk-row twk-row-h' : 'twk-row'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label), value != null && /*#__PURE__*/React.createElement("span", {
    className: "twk-val"
  }, value)), children);
}

// ── Controls ────────────────────────────────────────────────────────────────

function TweakSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label,
    value: `${value}${unit}`
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "twk-slider",
    min: min,
    max: max,
    step: step,
    value: value,
    onChange: e => onChange(Number(e.target.value))
  }));
}
function TweakToggle({
  label,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-row twk-row-h"
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "twk-toggle",
    "data-on": value ? '1' : '0',
    role: "switch",
    "aria-checked": !!value,
    onClick: () => onChange(!value)
  }, /*#__PURE__*/React.createElement("i", null)));
}
function TweakRadio({
  label,
  value,
  options,
  onChange
}) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag — ref it so a stale closure doesn't fire onChange for every move.
  const valueRef = React.useRef(value);
  valueRef.current = value;

  // Segments wrap mid-word once per-segment width runs out. The track is
  // ~248px (280 panel − 28 body pad − 4 seg pad), each button loses 12px
  // to its own padding, and 11.5px system-ui averages ~6.3px/char — so 2
  // options fit ~16 chars each, 3 fit ~10. Past that (or >3 options), fall
  // back to a dropdown rather than wrap.
  const labelLen = o => String(typeof o === 'object' ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments = maxLen <= ({
    2: 16,
    3: 10
  }[options.length] ?? 0);
  if (!fitsAsSegments) {
    // <select> emits strings — map back to the original option value so the
    // fallback stays type-preserving (numbers, booleans) like the segment path.
    const resolve = s => {
      const m = options.find(o => String(typeof o === 'object' ? o.value : o) === s);
      return m === undefined ? s : typeof m === 'object' ? m.value : m;
    };
    return /*#__PURE__*/React.createElement(TweakSelect, {
      label: label,
      value: value,
      options: options,
      onChange: s => onChange(resolve(s))
    });
  }
  const opts = options.map(o => typeof o === 'object' ? o : {
    value: o,
    label: o
  });
  const idx = Math.max(0, opts.findIndex(o => o.value === value));
  const n = opts.length;
  const segAt = clientX => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor((clientX - r.left - 2) / inner * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };
  const onPointerDown = e => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = ev => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    ref: trackRef,
    role: "radiogroup",
    onPointerDown: onPointerDown,
    className: dragging ? 'twk-seg dragging' : 'twk-seg'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-seg-thumb",
    style: {
      left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
      width: `calc((100% - 4px) / ${n})`
    }
  }), opts.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.value,
    type: "button",
    role: "radio",
    "aria-checked": o.value === value
  }, o.label))));
}
function TweakSelect({
  label,
  value,
  options,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("select", {
    className: "twk-field",
    value: value,
    onChange: e => onChange(e.target.value)
  }, options.map(o => {
    const v = typeof o === 'object' ? o.value : o;
    const l = typeof o === 'object' ? o.label : o;
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, l);
  })));
}
function TweakText({
  label,
  value,
  placeholder,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("input", {
    className: "twk-field",
    type: "text",
    value: value,
    placeholder: placeholder,
    onChange: e => onChange(e.target.value)
  }));
}
function TweakNumber({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange
}) {
  const clamp = n => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({
    x: 0,
    val: 0
  });
  const onScrubStart = e => {
    e.preventDefault();
    startRef.current = {
      x: e.clientX,
      val: value
    };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = ev => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-num"
  }, /*#__PURE__*/React.createElement("span", {
    className: "twk-num-lbl",
    onPointerDown: onScrubStart
  }, label), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: value,
    min: min,
    max: max,
    step: step,
    onChange: e => onChange(clamp(Number(e.target.value)))
  }), unit && /*#__PURE__*/React.createElement("span", {
    className: "twk-num-unit"
  }, unit));
}

// Relative-luminance contrast pick — checkmarks drawn over a swatch need to
// read on both #111 and #fafafa without per-option configuration. Hex input
// only (#rgb / #rrggbb); named or rgb()/hsl() colors fall through to "light".
function __twkIsLight(hex) {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, c => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = n >> 16 & 255,
    g = n >> 8 & 255,
    b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}
const __TwkCheck = ({
  light
}) => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 14 14",
  "aria-hidden": "true"
}, /*#__PURE__*/React.createElement("path", {
  d: "M3 7.2 5.8 10 11 4.2",
  fill: "none",
  strokeWidth: "2.2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  stroke: light ? 'rgba(0,0,0,.78)' : '#fff'
}));

// TweakColor — curated color/palette picker. Each option is either a single
// hex string or an array of 1-5 hex strings; the card adapts — a lone color
// renders solid, a palette renders colors[0] as the hero (left ~2/3) with the
// rest stacked in a sharp column on the right. onChange emits the
// option in the shape it was passed (string stays string, array stays array).
// Without options it falls back to the native color input for back-compat.
function TweakColor({
  label,
  value,
  options,
  onChange
}) {
  if (!options || !options.length) {
    return /*#__PURE__*/React.createElement("div", {
      className: "twk-row twk-row-h"
    }, /*#__PURE__*/React.createElement("div", {
      className: "twk-lbl"
    }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("input", {
      type: "color",
      className: "twk-swatch",
      value: value,
      onChange: e => onChange(e.target.value)
    }));
  }
  // Native <input type=color> emits lowercase hex per the HTML spec, so
  // compare case-insensitively. String() guards JSON.stringify(undefined),
  // which returns the primitive undefined (no .toLowerCase).
  const key = o => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-chips",
    role: "radiogroup"
  }, options.map((o, i) => {
    const colors = Array.isArray(o) ? o : [o];
    const [hero, ...rest] = colors;
    const sup = rest.slice(0, 4);
    const on = key(o) === cur;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      type: "button",
      className: "twk-chip",
      role: "radio",
      "aria-checked": on,
      "data-on": on ? '1' : '0',
      "aria-label": colors.join(', '),
      title: colors.join(' · '),
      style: {
        background: hero
      },
      onClick: () => onChange(o)
    }, sup.length > 0 && /*#__PURE__*/React.createElement("span", null, sup.map((c, j) => /*#__PURE__*/React.createElement("i", {
      key: j,
      style: {
        background: c
      }
    }))), on && /*#__PURE__*/React.createElement(__TwkCheck, {
      light: __twkIsLight(hero)
    }));
  })));
}
function TweakButton({
  label,
  onClick,
  secondary = false
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: secondary ? 'twk-btn secondary' : 'twk-btn',
    onClick: onClick
  }, label);
}
Object.assign(window, {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakRow,
  TweakSlider,
  TweakToggle,
  TweakRadio,
  TweakSelect,
  TweakText,
  TweakNumber,
  TweakColor,
  TweakButton
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "preview/tweaks-panel.jsx", error: String((e && e.message) || e) }); }

// ui_kits/session/App.jsx
try { (() => {
// App.jsx — orchestrates the click-through: login → dashboard → live session.
const {
  useState,
  useCallback
} = React;
let _id = 100;
function rollDice(formula, mod) {
  // fake roll: sum of d20-style; return a total + threshold + success
  const map = {
    d20: 20,
    d12: 12,
    d10: 10,
    d8: 8,
    d6: 6,
    d4: 4,
    d100: 100
  };
  let total = mod;
  for (const [k, n] of Object.entries(formula)) for (let i = 0; i < n; i++) total += 1 + Math.floor(Math.random() * map[k]);
  return total;
}
function GmBar({
  maps,
  active,
  onPick,
  combat,
  onCombat
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 14px',
      background: '#0c0c16',
      borderBottom: `1px solid ${ENC.border}`,
      zIndex: 100,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    color: ENC.blue,
    style: {
      letterSpacing: '.1em'
    }
  }, "Cartes"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flex: 1,
      overflowX: 'auto'
    }
  }, maps.map(m => /*#__PURE__*/React.createElement("button", {
    key: m,
    onClick: () => onPick(m),
    style: {
      background: m === active ? 'rgba(91,141,238,.15)' : 'none',
      border: `1px solid ${m === active ? ENC.blue : ENC.border2}`,
      borderRadius: 4,
      padding: '5px 11px',
      whiteSpace: 'nowrap',
      color: m === active ? ENC.blue : '#8888a8',
      font: "12px 'Inter'",
      cursor: 'pointer'
    }
  }, m))), /*#__PURE__*/React.createElement("button", {
    onClick: onCombat,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: combat ? 'rgba(224,91,91,.12)' : 'none',
      border: `1px solid ${combat ? ENC.red : ENC.border2}`,
      borderRadius: 4,
      padding: '5px 12px',
      color: combat ? ENC.red : '#8888a8',
      font: "600 12px 'Inter'",
      cursor: 'pointer'
    }
  }, combat ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(IconX, {
    size: 13
  }), " Combat") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(IconSword, {
    size: 14
  }), " Combat")));
}
function FloatingRoster({
  mode
}) {
  const {
    pos,
    onDrag
  } = useDrag({
    x: window.innerWidth - 600,
    y: 96
  });
  return /*#__PURE__*/React.createElement(RosterWindow, {
    pos: pos,
    onDrag: onDrag,
    mode: mode
  });
}
function FloatingDeclare({
  onClose
}) {
  const {
    pos,
    onDrag
  } = useDrag({
    x: 48,
    y: 150
  });
  return /*#__PURE__*/React.createElement(DeclareWindow, {
    pos: pos,
    onDrag: onDrag,
    onClose: onClose
  });
}
function Session({
  campaign,
  onLeave
}) {
  const [sidebar, setSidebar] = useState(true);
  const [diceOpen, setDiceOpen] = useState(false);
  const [combat, setCombat] = useState(false);
  // combat sub-phase: 'pre' (roster pré-combat) → 'declare' (Phase 1) 
  const [phase, setPhase] = useState('pre');
  const [activeMap, setActiveMap] = useState('Place du marché');
  const [msgs, setMsgs] = useState([{
    id: 1,
    system: true,
    text: 'Brann le Sourd a rejoint la session.',
    time: '20:58'
  }, {
    id: 2,
    who: 'Léa',
    color: '#FFD700',
    time: '21:01',
    text: 'On pousse la porte de la taverne ?'
  }, {
    id: 3,
    type: 'dice',
    who: 'Kaelen',
    color: ENC.green,
    time: '21:04',
    label: 'Jet de Discrétion',
    total: 17,
    seuil: 12,
    success: true,
    mr: 5
  }, {
    id: 4,
    type: 'dice',
    who: 'Esquive rapide',
    color: ENC.goldMuted,
    time: '21:05',
    label: '',
    total: 3,
    seuil: 12,
    success: false,
    mr: 9,
    fav: true,
    secret: true
  }]);
  const send = useCallback(text => {
    const m = text.match(/^\/(d\d+)(?:\+(\d+))?/i);
    if (m) {
      const k = m[1].toLowerCase(),
        mod = m[2] ? parseInt(m[2]) : 0;
      const total = rollDice({
          [k]: 1
        }, mod),
        seuil = 12;
      setMsgs(p => [...p, {
        id: ++_id,
        type: 'dice',
        who: 'toi',
        color: ENC.green,
        time: '21:06',
        label: `Jet ${k}${mod ? '+' + mod : ''}`,
        total,
        seuil,
        success: total >= seuil,
        mr: Math.abs(total - seuil),
        crit: total >= seuil + 8
      }]);
    } else {
      setMsgs(p => [...p, {
        id: ++_id,
        who: 'toi',
        color: ENC.green,
        time: '21:06',
        text
      }]);
    }
  }, []);
  const handleTrayRoll = useCallback((f, mod) => {
    const total = rollDice(f, mod),
      seuil = 12;
    const label = Object.entries(f).filter(([, n]) => n > 0).map(([k, n]) => `${n}${k}`).join('+') + (mod ? mod > 0 ? `+${mod}` : mod : '');
    setMsgs(p => [...p, {
      id: ++_id,
      type: 'dice',
      who: 'toi',
      color: ENC.green,
      time: '21:07',
      label: `Jet ${label}`,
      total,
      seuil,
      success: total >= seuil,
      mr: Math.abs(total - seuil),
      crit: total >= seuil + 8
    }]);
    setDiceOpen(false);
  }, []);
  const toggleCombat = () => {
    const n = !combat;
    setCombat(n);
    setPhase('pre');
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      background: '#0a0a0f'
    }
  }, /*#__PURE__*/React.createElement(GmBar, {
    maps: ['Place du marché', 'Taverne du Norhont', 'Souterrains'],
    active: activeMap,
    onPick: setActiveMap,
    combat: combat,
    onCombat: toggleCombat
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(MapBackdrop, null), combat && phase === 'declare' && /*#__PURE__*/React.createElement(TimelineBar, null), combat && phase === 'pre' && /*#__PURE__*/React.createElement(FloatingRoster, {
    mode: "pre"
  }), combat && phase === 'declare' && /*#__PURE__*/React.createElement(FloatingDeclare, {
    onClose: () => setCombat(false)
  }), combat && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: phase === 'declare' ? 130 : 14,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: 8,
      zIndex: 38
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setPhase('pre'),
    style: {
      ...phaseChip,
      ...(phase === 'pre' ? phaseChipOn : {})
    }
  }, "Pr\xE9-combat"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#3a4658',
      alignSelf: 'center'
    }
  }, "\u2192"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setPhase('declare'),
    style: {
      ...phaseChip,
      ...(phase === 'declare' ? phaseChipOn : {})
    }
  }, "D\xE9claration")), diceOpen && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 18,
      bottom: 78,
      zIndex: 35
    }
  }, /*#__PURE__*/React.createElement(DiceTray, {
    color: ENC.green,
    onRoll: handleTrayRoll
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 14,
      bottom: 14,
      display: 'flex',
      gap: 8,
      zIndex: 20
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onLeave,
    title: "Quitter",
    style: belt
  }, "\u2190 Quitter")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 18,
      bottom: 18,
      display: 'flex',
      gap: 8,
      zIndex: 36
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setDiceOpen(o => !o),
    title: "D\xE9s",
    style: {
      ...beltRound,
      ...(diceOpen ? beltActive : {})
    }
  }, /*#__PURE__*/React.createElement(IconDice, {
    size: 20
  })), !sidebar && /*#__PURE__*/React.createElement("button", {
    onClick: () => setSidebar(true),
    style: beltRound
  }, "\u2630"))), sidebar && /*#__PURE__*/React.createElement(SessionSidebar, {
    width: 300,
    messages: msgs,
    onSend: send,
    onClose: () => setSidebar(false)
  })));
}
const belt = {
  background: 'rgba(15,15,26,.85)',
  border: `1px solid ${ENC.border2}`,
  borderRadius: 6,
  padding: '7px 12px',
  color: ENC.txtMid,
  font: "12px 'Inter'",
  cursor: 'pointer'
};
const beltRound = {
  width: 42,
  height: 42,
  borderRadius: 10,
  background: 'rgba(15,15,26,.9)',
  border: `1px solid ${ENC.border2}`,
  color: ENC.txtMid,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  font: "18px 'Inter'"
};
const beltActive = {
  background: 'rgba(76,175,119,.18)',
  borderColor: ENC.greenSoft,
  color: ENC.greenSoft
};
const phaseChip = {
  background: 'rgba(13,15,24,.9)',
  border: `1px solid ${ENC.winBorder}`,
  borderRadius: 4,
  padding: '5px 12px',
  color: '#7c8aa0',
  font: "600 11px 'Inter'",
  letterSpacing: '.06em',
  cursor: 'pointer'
};
const phaseChipOn = {
  background: 'rgba(58,138,170,.15)',
  borderColor: '#3a8aaa',
  color: '#3a8aaa'
};
function App() {
  const [screen, setScreen] = useState('login'); // login | dashboard | session
  const [campaign, setCampaign] = useState(null);
  return /*#__PURE__*/React.createElement(React.Fragment, null, screen === 'login' && /*#__PURE__*/React.createElement(Login, {
    onLogin: () => setScreen('dashboard')
  }), screen === 'dashboard' && /*#__PURE__*/React.createElement(Dashboard, {
    onPlay: c => {
      setCampaign(c);
      setScreen('session');
    },
    onLogout: () => setScreen('login')
  }), screen === 'session' && /*#__PURE__*/React.createElement(Session, {
    campaign: campaign,
    onLeave: () => setScreen('dashboard')
  }));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/session/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/session/CombatWindows.jsx
try { (() => {
// CombatWindows.jsx — initiative timeline bar + shared drag hook for floating windows.
const {
  useState: useStateC,
  useRef: useRefC,
  useEffect: useEffectC
} = React;

// Shared draggable-window hook: returns {pos, onDrag} — mirrors the app's useDraggable.
function useDrag(initial) {
  const [pos, setPos] = useStateC(initial);
  const ref = useRefC(null);
  const onDrag = e => {
    ref.current = {
      dx: e.clientX - pos.x,
      dy: e.clientY - pos.y
    };
    document.body.style.userSelect = 'none';
  };
  useEffectC(() => {
    const mv = e => {
      if (ref.current) setPos({
        x: e.clientX - ref.current.dx,
        y: e.clientY - ref.current.dy
      });
    };
    const up = () => {
      ref.current = null;
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', mv);
      window.removeEventListener('mouseup', up);
    };
  }, [pos]);
  return {
    pos,
    onDrag
  };
}
function TimelineBar({
  turn = 3,
  phase = 'ANNOUNCEMENT',
  timer = 22
}) {
  const cards = [{
    l: 'Kaelen',
    ini: 14,
    sev: null,
    color: ENC.green,
    active: false,
    done: true
  }, {
    l: 'Maître Orsa',
    ini: 12,
    sev: 'legere',
    active: false,
    done: true,
    status: 'hypothermia'
  }, {
    l: 'Brann',
    ini: 11,
    sev: 'grave',
    active: true,
    done: false,
    status: 'stunned'
  }, {
    l: 'Sicaire',
    ini: 9,
    sev: null,
    active: false,
    done: false,
    npc: true
  }, {
    l: 'Rôdeur',
    ini: 6,
    sev: 'moyenne',
    active: false,
    done: false,
    npc: true,
    status: 'burning'
  }];
  const isAnn = phase === 'ANNOUNCEMENT';
  const tColor = timer > 11 ? ENC.green : timer > 6 ? ENC.amber : ENC.red;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      display: 'flex',
      alignItems: 'flex-end',
      gap: 10,
      padding: '10px 14px',
      background: 'rgba(10,10,20,0.88)',
      borderBottom: `1px solid ${ENC.border2}`,
      zIndex: 30
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2,
      paddingBottom: 4,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "700 22px 'Share Tech Mono'",
      color: tColor,
      lineHeight: 1,
      fontVariantNumeric: 'tabular-nums'
    }
  }, timer), /*#__PURE__*/React.createElement(Eyebrow, {
    color: "#55558a"
  }, "Tour ", turn)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 5,
      flex: 1
    }
  }, cards.map(c => {
    const w = c.active ? 72 : 54,
      h = c.active ? 100 : 76,
      bc = c.sev ? ENC.wound[c.sev] : 'rgba(255,255,255,.12)';
    return /*#__PURE__*/React.createElement("div", {
      key: c.l,
      style: {
        position: 'relative',
        width: w,
        height: h,
        borderRadius: 6,
        overflow: 'hidden',
        border: `2px solid ${bc}`,
        flexShrink: 0,
        boxShadow: c.active ? '0 0 12px rgba(245,197,66,.35)' : 'none'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        inset: 0,
        background: c.npc ? 'linear-gradient(160deg,#2e1a1a,#4e2a2a)' : 'linear-gradient(160deg,#1a1a2e,#2a2a4e)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        font: `700 ${c.active ? 26 : 20}px 'Inter'`,
        color: c.npc ? '#aa5555' : '#5555aa'
      }
    }, c.l[0]), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(transparent,rgba(0,0,0,.88))',
        padding: '14px 4px 4px',
        textAlign: 'center'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: "700 9px 'Inter'",
        color: c.active ? ENC.gold : '#e0e0f0',
        textShadow: '0 1px 3px #000',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, c.l), /*#__PURE__*/React.createElement("div", {
      style: {
        font: "600 8px 'Share Tech Mono'",
        color: ENC.blue
      }
    }, c.ini)), c.done && /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: 3,
        right: 4,
        font: "700 10px 'Inter'",
        color: ENC.green,
        textShadow: '0 1px 3px #000'
      }
    }, "\u2713"), c.status && /*#__PURE__*/React.createElement("img", {
      src: `../../assets/status/${c.status}.svg`,
      width: c.active ? 22 : 18,
      height: c.active ? 22 : 18,
      style: {
        position: 'absolute',
        top: 3,
        left: 3,
        filter: 'drop-shadow(0 1px 2px #000)'
      },
      alt: c.status
    }));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 2,
      paddingBottom: 6,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    color: "#55558a"
  }, isAnn ? 'Annonce' : 'Résolution'), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "700 18px 'Inter'",
      color: isAnn ? ENC.amber : ENC.green,
      lineHeight: 1
    }
  }, isAnn ? '←' : '→')));
}
Object.assign(window, {
  TimelineBar,
  useDrag
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/session/CombatWindows.jsx", error: String((e && e.message) || e) }); }

// ui_kits/session/DeclareWindow.jsx
try { (() => {
// DeclareWindow.jsx — faithful recreation of CombatActionWindow Phase 1 (Déclaration).
// Sections: TACTIQUE / ARMEMENT / ACTION / ACTIONS RAPIDES / ROSTER. Tactical-HUD palette.
const {
  useState: useStateD,
  useRef: useRefD,
  useEffect: useEffectD
} = React;
const STATE_DEFS = {
  position: {
    label: 'POSTURE',
    states: [['standing', 'Debout'], ['crouching', 'Accroupi'], ['prone', 'Couché']],
    cost: {
      standing: {
        crouching: -3,
        prone: -5
      },
      crouching: {
        standing: -3,
        prone: -5
      },
      prone: {
        standing: -10,
        crouching: -10
      }
    }
  },
  cover: {
    label: 'COUVERTURE',
    states: [['exposed', 'Découvert'], ['partial', 'Partielle'], ['important', 'Importante']],
    cost: {}
  },
  vitesse: {
    label: 'VITESSE',
    states: [['delayed', 'Retardée'], ['normal', 'Normale'], ['rushed', 'Précipitée']],
    cost: {
      delayed: {
        normal: 0,
        rushed: 3
      },
      normal: {
        delayed: 0,
        rushed: 3
      },
      rushed: {
        delayed: 0,
        normal: 0
      }
    }
  },
  weapon: {
    label: 'ARME',
    states: [['holstered', 'Rangée'], ['ready', "Main sur l'arme"], ['drawn', 'Au clair']],
    cost: {
      holstered: {
        ready: -3,
        drawn: -5
      },
      ready: {
        holstered: -5,
        drawn: -3
      },
      drawn: {
        holstered: -10,
        ready: -3
      }
    }
  },
  fire_mode: {
    label: 'MODE DE TIR',
    states: [['cc', 'Coup par coup'], ['rc', 'Rafale courte'], ['rl', 'Rafale longue']],
    cost: {
      cc: {
        rc: -3,
        rl: -3
      },
      rc: {
        cc: -3,
        rl: -3
      },
      rl: {
        cc: -3,
        rc: -3
      }
    }
  }
};
const MAP_ACTIONS = [{
  k: 'move',
  l: 'Déplacement',
  span2: true,
  hint: 'cliquer destination'
}, {
  k: 'attack',
  l: 'Assaut (tir)',
  hint: 'cliquer cible',
  sub: 'cible hors portée'
}, {
  k: 'melee',
  l: 'Corps à corps',
  ini: -3,
  hint: 'cliquer adversaire'
}, {
  k: 'reload',
  l: 'Rechargement',
  span2: true
}, {
  k: 'multi',
  l: 'Attaque multiple',
  ini: -5
}, {
  k: 'interact',
  l: 'Interagir'
}];
const QUICK = [{
  k: 'observer',
  l: 'Observer le combat',
  kind: 'inc',
  max: 6
}, {
  k: 'reperer',
  l: 'Repérer (obj., personne, lieu…)',
  kind: 'inc',
  max: 6
}, {
  k: 'phrase',
  l: 'Prononcer une phrase',
  kind: 'fixed',
  ini: -3
}];
const ROSTER = [{
  id: 'fddfg',
  tag: 'RC',
  tagColor: '#3a8aaa',
  ini: 7
}, {
  id: 'Deep',
  tag: 'DST',
  tagColor: '#5b8dee',
  ini: 7
}, {
  id: 'Civil',
  tag: 'CTC',
  tagColor: '#c8a030',
  ini: 7
}, {
  id: 'Thug',
  tag: 'CTC',
  tagColor: '#c8a030',
  ini: 7
}, {
  id: 'Soleil',
  tag: 'DST',
  tagColor: '#5b8dee',
  ini: 11
}];
const cost = (def, from, to) => from === to ? 0 : def.cost?.[from]?.[to] ?? 0;
function StateSelector({
  def,
  value,
  initial,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: DS.ssRow
  }, /*#__PURE__*/React.createElement("span", {
    style: DS.ssLabel
  }, def.label), /*#__PURE__*/React.createElement("div", {
    style: DS.seg
  }, def.states.map(([k, l]) => {
    const isActive = k === value;
    const c = cost(def, initial, k);
    const cStr = c === 0 ? null : c > 0 ? `+${c}` : `${c}`;
    return /*#__PURE__*/React.createElement("div", {
      key: k,
      onClick: () => !isActive && onChange(k),
      style: {
        ...DS.segOpt,
        ...(isActive ? DS.segOptActive : {})
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: DS.segOptLabel
    }, l), cStr && !isActive && /*#__PURE__*/React.createElement("span", {
      style: {
        ...DS.segCost,
        color: c > 0 ? '#3aaa6a' : '#c86030'
      }
    }, cStr), isActive && k === initial && /*#__PURE__*/React.createElement("span", {
      style: DS.segCostCur
    }, "actuel"));
  })));
}
function DeclareWindow({
  pos,
  onDrag,
  onClose
}) {
  const [states, setStates] = useStateD({
    position: 'standing',
    cover: 'exposed',
    vitesse: 'normal',
    weapon: 'holstered',
    fire_mode: 'cc'
  });
  const initial = {
    position: 'standing',
    cover: 'exposed',
    vitesse: 'normal',
    weapon: 'holstered',
    fire_mode: 'cc'
  };
  const [sel, setSel] = useStateD(new Set());
  const [quick, setQuick] = useStateD({
    observer: 0,
    reperer: 0,
    phrase: false
  });
  const [checked, setChecked] = useStateD({});
  const set = (k, v) => setStates(s => ({
    ...s,
    [k]: v
  }));
  const toggle = k => setSel(p => {
    const n = new Set(p);
    n.has(k) ? n.delete(k) : n.add(k);
    return n;
  });
  const declaredCount = Object.values(checked).filter(Boolean).length;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...DS.window,
      left: pos.x,
      top: pos.y
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: DS.header,
    onMouseDown: onDrag
  }, /*#__PURE__*/React.createElement("span", {
    style: DS.title
  }, "PHASE 1 \u2014 D\xC9CLARATION"), /*#__PURE__*/React.createElement("span", {
    style: DS.declared
  }, declaredCount, "/5 d\xE9clar\xE9s")), /*#__PURE__*/React.createElement("div", {
    style: DS.body
  }, /*#__PURE__*/React.createElement("div", {
    style: DS.section
  }, /*#__PURE__*/React.createElement("div", {
    style: DS.sectionTitle
  }, "TACTIQUE"), /*#__PURE__*/React.createElement(StateSelector, {
    def: STATE_DEFS.position,
    value: states.position,
    initial: initial.position,
    onChange: v => set('position', v)
  }), /*#__PURE__*/React.createElement(StateSelector, {
    def: STATE_DEFS.cover,
    value: states.cover,
    initial: initial.cover,
    onChange: v => set('cover', v)
  }), /*#__PURE__*/React.createElement(StateSelector, {
    def: STATE_DEFS.vitesse,
    value: states.vitesse,
    initial: initial.vitesse,
    onChange: v => set('vitesse', v)
  })), /*#__PURE__*/React.createElement("div", {
    style: DS.section
  }, /*#__PURE__*/React.createElement("div", {
    style: DS.sectionTitle
  }, "ARMEMENT"), /*#__PURE__*/React.createElement(StateSelector, {
    def: STATE_DEFS.weapon,
    value: states.weapon,
    initial: initial.weapon,
    onChange: v => set('weapon', v)
  }), /*#__PURE__*/React.createElement(StateSelector, {
    def: STATE_DEFS.fire_mode,
    value: states.fire_mode,
    initial: initial.fire_mode,
    onChange: v => set('fire_mode', v)
  })), /*#__PURE__*/React.createElement("div", {
    style: DS.section
  }, /*#__PURE__*/React.createElement("div", {
    style: DS.sectionTitle
  }, "ACTION"), /*#__PURE__*/React.createElement("div", {
    style: DS.itemsGrid
  }, MAP_ACTIONS.map(a => {
    const on = sel.has(a.k);
    return /*#__PURE__*/React.createElement("div", {
      key: a.k,
      onClick: () => toggle(a.k),
      style: {
        ...DS.item,
        ...(a.span2 ? {
          gridColumn: '1 / -1'
        } : {}),
        ...(on ? DS.itemOn : {})
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: DS.itemLabel
    }, a.l), /*#__PURE__*/React.createElement("span", {
      style: DS.itemMeta
    }, a.sub && on ? /*#__PURE__*/React.createElement("span", {
      style: DS.itemSub
    }, a.sub) : null, a.ini != null && /*#__PURE__*/React.createElement("span", {
      style: DS.itemIni
    }, a.ini), a.hint && on && /*#__PURE__*/React.createElement("span", {
      style: DS.itemHint
    }, a.hint)));
  }))), /*#__PURE__*/React.createElement("div", {
    style: DS.section
  }, /*#__PURE__*/React.createElement("div", {
    style: DS.sectionTitle
  }, "ACTIONS RAPIDES"), QUICK.map(a => /*#__PURE__*/React.createElement("div", {
    key: a.k,
    style: DS.quickRow
  }, /*#__PURE__*/React.createElement("span", {
    style: DS.quickLabel
  }, a.l), a.kind === 'inc' ? /*#__PURE__*/React.createElement("div", {
    style: DS.quickCtl
  }, /*#__PURE__*/React.createElement("span", {
    style: DS.quickMin
  }, "1"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: 1,
    max: a.max,
    value: Math.max(1, quick[a.k]),
    onChange: e => setQuick(q => ({
      ...q,
      [a.k]: +e.target.value
    })),
    style: {
      flex: 1,
      accentColor: '#3a8aaa'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: DS.quickMin
  }, a.max), /*#__PURE__*/React.createElement("span", {
    style: DS.quickVal
  }, quick[a.k] ? -5 * quick[a.k] : '–')) : /*#__PURE__*/React.createElement("span", {
    style: {
      ...DS.itemIni,
      marginLeft: 'auto'
    }
  }, a.ini)))), /*#__PURE__*/React.createElement("div", {
    style: {
      ...DS.section,
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: DS.rosterHead
  }, /*#__PURE__*/React.createElement("span", {
    style: DS.sectionTitleInline
  }, "ROSTER \u2014 5 PNJs"), /*#__PURE__*/React.createElement("button", {
    style: DS.rosterAll
  }, "tout")), ROSTER.map(r => /*#__PURE__*/React.createElement("label", {
    key: r.id,
    style: DS.rosterRow
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !!checked[r.id],
    onChange: () => setChecked(c => ({
      ...c,
      [r.id]: !c[r.id]
    })),
    style: {
      accentColor: '#3a8aaa',
      cursor: 'pointer'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: DS.rosterDot
  }, "\u25CB"), /*#__PURE__*/React.createElement("span", {
    style: DS.rosterName
  }, r.id), /*#__PURE__*/React.createElement("span", {
    style: {
      ...DS.rosterTag,
      color: r.tagColor,
      borderColor: r.tagColor + '66'
    }
  }, r.tag), /*#__PURE__*/React.createElement("span", {
    style: DS.rosterIni
  }, "INI ", r.ini))))), /*#__PURE__*/React.createElement("button", {
    style: DS.declareBtn
  }, "D\xC9CLARER"));
}
const DS = {
  window: {
    position: 'absolute',
    width: 360,
    background: '#0d0f18',
    border: '1px solid #1e2435',
    borderRadius: 6,
    boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
    maxHeight: 'calc(100% - 90px)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: "'Inter', system-ui",
    zIndex: 43
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 14px',
    borderBottom: '1px solid #2a2a3e',
    background: '#080a12',
    cursor: 'grab',
    userSelect: 'none'
  },
  title: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: '#3a8aaa'
  },
  declared: {
    fontSize: 10,
    color: '#456575',
    fontFamily: "'Share Tech Mono'"
  },
  body: {
    overflowY: 'auto',
    minHeight: 0
  },
  section: {
    borderBottom: '1px solid #1e1e2e',
    paddingBottom: 4
  },
  sectionTitle: {
    padding: '7px 10px 3px',
    fontSize: 8,
    fontWeight: 700,
    color: '#5a8aaa',
    textTransform: 'uppercase',
    letterSpacing: '0.12em'
  },
  sectionTitleInline: {
    fontSize: 8,
    fontWeight: 700,
    color: '#5a8aaa',
    textTransform: 'uppercase',
    letterSpacing: '0.12em'
  },
  // StateSelector
  ssRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '3px 10px',
    gap: 6
  },
  ssLabel: {
    fontSize: 8,
    color: '#456575',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    width: 76,
    flexShrink: 0
  },
  seg: {
    display: 'flex',
    flex: 1,
    background: '#0a1018',
    border: '1px solid #15212e'
  },
  segOpt: {
    flex: 1,
    padding: '4px 6px',
    textAlign: 'center',
    cursor: 'pointer',
    border: '1px solid transparent'
  },
  segOptActive: {
    background: '#162028',
    borderColor: '#3a8aaa66'
  },
  segOptLabel: {
    fontSize: 9,
    color: '#dde7ee',
    display: 'block'
  },
  segCost: {
    fontSize: 7,
    display: 'block',
    marginTop: 1
  },
  segCostCur: {
    fontSize: 7,
    color: '#3a8aaa',
    display: 'block',
    marginTop: 1
  },
  // action grid
  itemsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    padding: '0 4px'
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '5px 8px',
    margin: '1px 2px',
    borderRadius: 3,
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid transparent'
  },
  itemOn: {
    background: 'rgba(58,138,170,0.12)',
    borderColor: '#3a8aaa66'
  },
  itemLabel: {
    fontSize: 11,
    color: '#c0c0d0'
  },
  itemMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6
  },
  itemIni: {
    fontSize: 9,
    color: '#c86030',
    fontFamily: "'Share Tech Mono'"
  },
  itemSub: {
    fontSize: 9,
    color: '#e07070'
  },
  itemHint: {
    fontSize: 8,
    color: '#456575',
    fontStyle: 'italic'
  },
  // quick
  quickRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 12px'
  },
  quickLabel: {
    fontSize: 11,
    color: '#c0c0d0',
    flexShrink: 0
  },
  quickCtl: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginLeft: 'auto',
    maxWidth: 160
  },
  quickMin: {
    fontSize: 9,
    color: '#456575'
  },
  quickVal: {
    fontSize: 10,
    fontWeight: 600,
    color: '#3a8aaa',
    minWidth: 22,
    textAlign: 'right',
    fontFamily: "'Share Tech Mono'"
  },
  // roster
  rosterHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '7px 12px 3px'
  },
  rosterAll: {
    background: 'none',
    border: 'none',
    color: '#5a8aaa',
    fontSize: 9,
    letterSpacing: '0.08em',
    cursor: 'pointer',
    textTransform: 'lowercase'
  },
  rosterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 12px',
    cursor: 'pointer'
  },
  rosterDot: {
    fontSize: 8,
    color: '#3a8aaa'
  },
  rosterName: {
    fontSize: 11,
    color: '#c0c0d0',
    fontWeight: 600
  },
  rosterTag: {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: '0.05em',
    padding: '1px 5px',
    borderRadius: 2,
    border: '1px solid',
    marginLeft: 'auto',
    fontFamily: "'Share Tech Mono'"
  },
  rosterIni: {
    fontSize: 9,
    color: '#456575',
    fontFamily: "'Share Tech Mono'",
    width: 42,
    textAlign: 'right'
  },
  declareBtn: {
    display: 'block',
    width: '100%',
    padding: '11px 14px',
    background: 'rgba(58,138,170,0.08)',
    border: 'none',
    borderTop: '1px solid #1e2435',
    color: '#3a8aaa',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.12em',
    cursor: 'pointer'
  }
};
window.DeclareWindow = DeclareWindow;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/session/DeclareWindow.jsx", error: String((e && e.message) || e) }); }

// ui_kits/session/DiceTray.jsx
try { (() => {
// DiceTray.jsx — the radial dice selector (d20 center, others around) + roll bar.
const {
  useState: useStateD
} = React;
function Die({
  k,
  size,
  color,
  count,
  center,
  onAdd,
  onRemove
}) {
  const s = size,
    cx = s / 2,
    cy = s / 2;
  const fillOp = count > 0 ? 0.22 : 0.06;
  const stroke = count > 0 ? color : '#3a3a52';
  let shape,
    label = k.toUpperCase().replace('D', 'd');
  if (k === 'd6') {
    const r = s * 0.42;
    shape = /*#__PURE__*/React.createElement("rect", {
      x: cx - r,
      y: cy - r,
      width: r * 2,
      height: r * 2,
      rx: s * 0.06,
      fill: color,
      fillOpacity: fillOp,
      stroke: stroke,
      strokeWidth: "1.5"
    });
  } else if (k === 'd4') {
    const r = s * 0.5;
    shape = /*#__PURE__*/React.createElement("polygon", {
      points: `${cx},${cy - r} ${cx + r * 0.87},${cy + r * 0.5} ${cx - r * 0.87},${cy + r * 0.5}`,
      fill: color,
      fillOpacity: fillOp,
      stroke: stroke,
      strokeWidth: "1.5"
    });
  } else if (k === 'd20') {
    const r = s * 0.46;
    shape = /*#__PURE__*/React.createElement("polygon", {
      points: `${cx},${cy - r} ${cx + r * 0.85},${cy - r * 0.5} ${cx + r * 0.85},${cy + r * 0.5} ${cx},${cy + r} ${cx - r * 0.85},${cy + r * 0.5} ${cx - r * 0.85},${cy - r * 0.5}`,
      fill: color,
      fillOpacity: fillOp,
      stroke: stroke,
      strokeWidth: "1.5"
    });
  } else {
    // d8 d10 d12 d100 — diamond
    const r = s * 0.48;
    shape = /*#__PURE__*/React.createElement("polygon", {
      points: `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`,
      fill: color,
      fillOpacity: fillOp,
      stroke: stroke,
      strokeWidth: "1.5"
    });
  }
  return /*#__PURE__*/React.createElement("button", {
    onClick: () => onAdd(k),
    onContextMenu: e => {
      e.preventDefault();
      onRemove(k);
    },
    title: "Clic: +1 \xB7 Clic droit: \u22121",
    style: {
      position: 'relative',
      width: s,
      height: s,
      padding: 0,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: s,
    height: s
  }, shape, /*#__PURE__*/React.createElement("text", {
    x: cx,
    y: cy + (k === 'd4' ? s * 0.18 : s * 0.07),
    textAnchor: "middle",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: s * 0.24,
    fill: count > 0 ? '#dde7ee' : '#6b7280'
  }, label.replace('d', ''))), count > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: -2,
      right: -2,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      background: color,
      color: '#0d0f18',
      font: "700 10px 'Share Tech Mono'",
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 3px'
    }
  }, count));
}
function DiceTray({
  color = '#5b8dee',
  onRoll
}) {
  const [f, setF] = useStateD({
    d20: 0,
    d12: 0,
    d10: 0,
    d8: 0,
    d6: 0,
    d4: 0,
    d100: 0
  });
  const [mod, setMod] = useStateD(0);
  const add = k => setF(p => ({
    ...p,
    [k]: p[k] + 1
  }));
  const rem = k => setF(p => ({
    ...p,
    [k]: Math.max(0, p[k] - 1)
  }));
  const total = Object.values(f).reduce((a, b) => a + b, 0);
  const ring = [['d12', 0], ['d10', 60], ['d8', 120], ['d6', 180], ['d4', 240], ['d100', 300]];
  const R = 78,
    C = 230;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 300,
      background: ENC.bgSession,
      border: `1px solid ${ENC.border}`,
      borderRadius: 10,
      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 14px',
      borderBottom: `1px solid ${ENC.border}`,
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color,
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(IconDice, {
    size: 15
  })), /*#__PURE__*/React.createElement(Eyebrow, {
    color: ENC.txtMid
  }, "Lancer de d\xE9s")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: C,
      height: C,
      margin: '8px auto'
    }
  }, ring.map(([k, ang]) => {
    const rad = ang * Math.PI / 180,
      x = C / 2 + R * Math.cos(rad) - 26,
      y = C / 2 + R * Math.sin(rad) - 26;
    return /*#__PURE__*/React.createElement("div", {
      key: k,
      style: {
        position: 'absolute',
        left: x,
        top: y
      }
    }, /*#__PURE__*/React.createElement(Die, {
      k: k,
      size: 52,
      color: color,
      count: f[k],
      onAdd: add,
      onRemove: rem
    }));
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: C / 2 - 38,
      top: C / 2 - 38
    }
  }, /*#__PURE__*/React.createElement(Die, {
    k: "d20",
    size: 76,
    color: color,
    count: f.d20,
    center: true,
    onAdd: add,
    onRemove: rem
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '0 14px 10px'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    color: ENC.txtLo
  }, "Mod"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setMod(m => m - 1),
    style: modBtn
  }, "\u2212"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "700 14px 'Share Tech Mono'",
      color: ENC.txtHi,
      width: 30,
      textAlign: 'center'
    }
  }, mod >= 0 ? '+' : '', mod), /*#__PURE__*/React.createElement("button", {
    onClick: () => setMod(m => m + 1),
    style: modBtn
  }, "+"))), /*#__PURE__*/React.createElement("button", {
    disabled: total === 0,
    onClick: () => {
      onRoll && onRoll(f, mod);
      setF({
        d20: 0,
        d12: 0,
        d10: 0,
        d8: 0,
        d6: 0,
        d4: 0,
        d100: 0
      });
    },
    style: {
      display: 'block',
      width: '100%',
      padding: '11px',
      background: total ? 'rgba(91,141,238,.15)' : 'transparent',
      border: 'none',
      borderTop: `1px solid ${ENC.border}`,
      color: total ? ENC.blue : ENC.txtLo,
      font: "700 12px 'Inter'",
      letterSpacing: '.05em',
      textTransform: 'uppercase',
      cursor: total ? 'pointer' : 'not-allowed'
    }
  }, total ? `Lancer ${total} dé${total > 1 ? 's' : ''}` : 'Choisis un dé'));
}
const modBtn = {
  width: 22,
  height: 22,
  borderRadius: 4,
  background: ENC.bgRaised,
  border: `1px solid ${ENC.border}`,
  color: ENC.txtMid,
  font: "14px 'Inter'",
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0
};
window.DiceTray = DiceTray;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/session/DiceTray.jsx", error: String((e && e.message) || e) }); }

// ui_kits/session/EncUI.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// EncUI.jsx — shared primitives for the Enclume session UI kit
// Inline stroke SVG icons (Feather/Lucide-style, 24-grid, 2px) — the real app pattern.

const ENC = {
  // surfaces
  bgApp: '#0f1115',
  bgSession: '#0f0f1a',
  bgRaised: '#16162a',
  border: '#1e1e2e',
  border2: '#2a2a3e',
  // combat-window (tactical HUD) surfaces
  winBody: '#0d0f18',
  winHeader: '#080a12',
  winBorder: '#1e2435',
  // accents
  blue: '#5b8dee',
  cyan: '#3a8aaa',
  green: '#50c878',
  greenSoft: '#4caf77',
  red: '#e05b5b',
  amber: '#e0a050',
  gold: '#f5c542',
  goldMuted: '#aa8a30',
  // text
  txtHi: '#c0c0d0',
  txtMid: '#9090a8',
  txtLo: '#4a4a60',
  // wounds
  wound: {
    legere: '#FFD700',
    moyenne: '#FFA500',
    grave: '#FF6B6B',
    critique: '#FF0000',
    mortelle: '#8B0000'
  }
};
const Svg = ({
  size = 16,
  children,
  stroke = 'currentColor',
  sw = 2,
  ...p
}) => /*#__PURE__*/React.createElement("svg", _extends({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: stroke,
  strokeWidth: sw,
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, p), children);

// The imposed DicePanel model: a d20 (20-sided) as a faceted hexagon with "20".
const IconDice = ({
  size = 16,
  color = 'currentColor'
}) => {
  const s = size,
    cx = s / 2,
    cy = s / 2,
    r = s * 0.46;
  const pts = `${cx},${cy - r} ${cx + r * 0.85},${cy - r * 0.5} ${cx + r * 0.85},${cy + r * 0.5} ${cx},${cy + r} ${cx - r * 0.85},${cy + r * 0.5} ${cx - r * 0.85},${cy - r * 0.5}`;
  return /*#__PURE__*/React.createElement("svg", {
    width: s,
    height: s,
    viewBox: `0 0 ${s} ${s}`,
    style: {
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("polygon", {
    points: pts,
    fill: color,
    fillOpacity: "0.18",
    stroke: color,
    strokeWidth: "1.5",
    strokeLinejoin: "round"
  }), /*#__PURE__*/React.createElement("line", {
    x1: cx - r * 0.85,
    y1: cy - r * 0.5,
    x2: cx,
    y2: cy + r * 0.34,
    stroke: color,
    strokeWidth: "1",
    opacity: "0.5"
  }), /*#__PURE__*/React.createElement("line", {
    x1: cx + r * 0.85,
    y1: cy - r * 0.5,
    x2: cx,
    y2: cy + r * 0.34,
    stroke: color,
    strokeWidth: "1",
    opacity: "0.5"
  }), /*#__PURE__*/React.createElement("line", {
    x1: cx,
    y1: cy - r,
    x2: cx,
    y2: cy + r * 0.34,
    stroke: color,
    strokeWidth: "1",
    opacity: "0.5"
  }), /*#__PURE__*/React.createElement("text", {
    x: cx,
    y: cy + s * 0.07,
    textAnchor: "middle",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: s * 0.26,
    fill: color
  }, "20"));
};
const IconRuler = ({
  size = 16
}) => /*#__PURE__*/React.createElement(Svg, {
  size: size
}, /*#__PURE__*/React.createElement("path", {
  d: "M21.3 8.7L8.7 21.3a2.12 2.12 0 0 1-3 0L2.7 18.3a2.12 2.12 0 0 1 0-3L15.3 2.7a2.12 2.12 0 0 1 3 0l3 3a2.12 2.12 0 0 1 0 3z"
}), /*#__PURE__*/React.createElement("line", {
  x1: "7.5",
  y1: "10.5",
  x2: "10",
  y2: "13"
}), /*#__PURE__*/React.createElement("line", {
  x1: "10.5",
  y1: "7.5",
  x2: "13",
  y2: "10"
}), /*#__PURE__*/React.createElement("line", {
  x1: "13.5",
  y1: "4.5",
  x2: "16",
  y2: "7"
}));
const IconPen = ({
  size = 13
}) => /*#__PURE__*/React.createElement(Svg, {
  size: size
}, /*#__PURE__*/React.createElement("path", {
  d: "M12 20h9"
}), /*#__PURE__*/React.createElement("path", {
  d: "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
}));
const IconPlus = ({
  size = 14
}) => /*#__PURE__*/React.createElement(Svg, {
  size: size
}, /*#__PURE__*/React.createElement("line", {
  x1: "12",
  y1: "5",
  x2: "12",
  y2: "19"
}), /*#__PURE__*/React.createElement("line", {
  x1: "5",
  y1: "12",
  x2: "19",
  y2: "12"
}));
const IconX = ({
  size = 16
}) => /*#__PURE__*/React.createElement(Svg, {
  size: size
}, /*#__PURE__*/React.createElement("line", {
  x1: "18",
  y1: "6",
  x2: "6",
  y2: "18"
}), /*#__PURE__*/React.createElement("line", {
  x1: "6",
  y1: "6",
  x2: "18",
  y2: "18"
}));
const IconSend = ({
  size = 16
}) => /*#__PURE__*/React.createElement(Svg, {
  size: size
}, /*#__PURE__*/React.createElement("line", {
  x1: "22",
  y1: "2",
  x2: "11",
  y2: "13"
}), /*#__PURE__*/React.createElement("polygon", {
  points: "22 2 15 22 11 13 2 9 22 2",
  fill: "currentColor",
  stroke: "none"
}));
const IconSword = ({
  size = 15
}) => /*#__PURE__*/React.createElement(Svg, {
  size: size
}, /*#__PURE__*/React.createElement("polyline", {
  points: "14.5 17.5 3 6 3 3 6 3 17.5 14.5"
}), /*#__PURE__*/React.createElement("line", {
  x1: "13",
  y1: "19",
  x2: "19",
  y2: "13"
}), /*#__PURE__*/React.createElement("line", {
  x1: "16",
  y1: "16",
  x2: "20",
  y2: "20"
}), /*#__PURE__*/React.createElement("line", {
  x1: "19",
  y1: "21",
  x2: "21",
  y2: "19"
}));

// The anvil logo — gem = currentColor (color), body = --icon-secondary.
const AnvilLogo = ({
  h = 28,
  color = '#e8eef7',
  body = '#5b8dee'
}) => /*#__PURE__*/React.createElement("span", {
  style: {
    display: 'inline-block',
    width: h * 0.71,
    height: h,
    color,
    ['--icon-secondary']: body
  },
  dangerouslySetInnerHTML: {
    __html: window.__ENCLUME_LOGO__ || ''
  }
});

// micro all-caps eyebrow label
const Eyebrow = ({
  children,
  color = ENC.txtLo,
  style
}) => /*#__PURE__*/React.createElement("span", {
  style: {
    font: "600 10px/1.2 'Inter'",
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    color,
    ...style
  }
}, children);
Object.assign(window, {
  ENC,
  Svg,
  IconDice,
  IconRuler,
  IconPen,
  IconPlus,
  IconX,
  IconSend,
  IconSword,
  AnvilLogo,
  Eyebrow
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/session/EncUI.jsx", error: String((e && e.message) || e) }); }

// ui_kits/session/RosterWindow.jsx
try { (() => {
// RosterWindow.jsx — faithful recreation of CombatRosterWindow (tactical HUD).
// Two modes: PRÉ-COMBAT (arme/armure/surpris/inclus) and ROSTER (ini order).
const {
  useState: useStateR
} = React;
const ARMOR_CHIPS = ['T', 'C', 'B', 'J'];
function ArmorChips({
  coverage,
  kind
}) {
  // kind: 'pj' | 'pnj'
  return /*#__PURE__*/React.createElement("div", {
    style: RS.chips
  }, ARMOR_CHIPS.map(chip => {
    const on = coverage.includes(chip);
    const st = kind === 'pj' ? on ? RS.chipPjFilled : RS.chipPjEmpty : on ? RS.chipPnjFilled : RS.chipPnjGap;
    return /*#__PURE__*/React.createElement("span", {
      key: chip,
      style: {
        ...RS.chip,
        ...st
      }
    }, chip);
  }));
}
function RosterWindow({
  pos,
  onDrag,
  mode = 'pre'
}) {
  // demo data mirroring the screenshots
  const [surprised, setSurprised] = useStateR({});
  const [excluded, setExcluded] = useStateR({});
  const rows = [{
    id: 'deep',
    t: 'pnj',
    label: 'Deep',
    ini: 7,
    weapon: {
      name: 'Breather',
      slot: 'MD'
    },
    armor: ['T', 'C', 'B', 'J']
  }, {
    id: 'soleil',
    t: 'pnj',
    label: 'Soleil',
    ini: 11,
    weapon: {
      name: 'Breather',
      slot: '2M'
    },
    armor: ['T', 'C', 'B', 'J']
  }, {
    id: 'fddfg',
    t: 'pnj',
    label: 'fddfg',
    ini: 7,
    weapon: null,
    armor: ['T', 'C', 'B', 'J']
  }, {
    id: 'gfdgfd',
    t: 'pj',
    label: 'gfdgfd',
    ini: 12,
    weapon: null,
    armor: []
  }, {
    id: 'civil',
    t: 'pnj',
    label: 'Civil',
    ini: 7,
    weapon: {
      name: 'Bâton de combat',
      slot: 'MD'
    },
    armor: ['T', 'C', 'B', 'J']
  }, {
    id: 'thug',
    t: 'pnj',
    label: 'Thug',
    ini: 7,
    weapon: {
      name: 'Bâton de combat',
      slot: 'MD'
    },
    armor: ['T', 'C', 'B', 'J']
  }, {
    id: 'jon',
    t: null,
    label: 'Jon',
    ini: 0,
    weapon: null,
    armor: null
  }];
  const active = rows.filter(r => !excluded[r.id]);
  const noWeapon = active.filter(r => r.t === 'pnj' && !r.weapon).length;
  const noArmor = active.filter(r => r.t === 'pnj' && (!r.armor || r.armor.length === 0)).length;

  // ROSTER mode = ini-sorted, fewer columns
  const rosterRows = [...rows].filter(r => !excluded[r.id]).sort((a, b) => b.ini - a.ini);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...RS.window,
      left: pos.x,
      top: pos.y
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: RS.header,
    onMouseDown: onDrag
  }, /*#__PURE__*/React.createElement("div", {
    style: RS.headerLeft
  }, /*#__PURE__*/React.createElement("span", {
    style: RS.title
  }, "ROSTER COMBAT"), mode === 'pre' ? /*#__PURE__*/React.createElement("span", {
    style: RS.badge
  }, "PR\xC9-COMBAT") : /*#__PURE__*/React.createElement("span", {
    style: {
      ...RS.badge,
      background: '#1a2a1a',
      color: '#50c878',
      borderColor: '#50c878'
    }
  }, "ROSTER"), /*#__PURE__*/React.createElement(AnvilLogo, {
    h: 16,
    color: "#e05b5b",
    body: "#e05b5b"
  })), /*#__PURE__*/React.createElement("span", {
    style: RS.count
  }, mode === 'pre' ? active.length : rosterRows.length, " participants")), mode === 'pre' && (noWeapon > 0 || noArmor > 0) && /*#__PURE__*/React.createElement("div", {
    style: RS.alert
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: '#c86030'
    }
  }, "\u26A0"), /*#__PURE__*/React.createElement("span", {
    style: RS.alertLabel
  }, "AVANT D\xC9MARRAGE"), noWeapon > 0 && /*#__PURE__*/React.createElement("span", {
    style: RS.alertItem
  }, noWeapon, " PNJ", noWeapon > 1 ? 's' : '', " sans arme"), noArmor > 0 && /*#__PURE__*/React.createElement("span", {
    style: RS.alertItem
  }, noArmor, " PNJ", noArmor > 1 ? 's' : '', " non prot\xE9g\xE9", noArmor > 1 ? 's' : '')), /*#__PURE__*/React.createElement("div", {
    style: RS.tableWrap
  }, /*#__PURE__*/React.createElement("table", {
    style: RS.table
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    style: RS.th
  }, "TOKEN"), /*#__PURE__*/React.createElement("th", {
    style: {
      ...RS.th,
      textAlign: 'center'
    }
  }, "INI"), mode === 'pre' && /*#__PURE__*/React.createElement("th", {
    style: RS.th
  }, "ARME"), mode === 'pre' && /*#__PURE__*/React.createElement("th", {
    style: RS.th
  }, "ARMURE"), mode === 'roster' && /*#__PURE__*/React.createElement("th", {
    style: {
      ...RS.th,
      textAlign: 'center'
    }
  }, "\xC9TAT INIT"), /*#__PURE__*/React.createElement("th", {
    style: {
      ...RS.th,
      textAlign: 'center'
    }
  }, "SURPRIS"), mode === 'pre' && /*#__PURE__*/React.createElement("th", {
    style: {
      ...RS.th,
      textAlign: 'center'
    }
  }, "INCLUS"))), /*#__PURE__*/React.createElement("tbody", null, (mode === 'pre' ? active : rosterRows).map(r => /*#__PURE__*/React.createElement("tr", {
    key: r.id
  }, /*#__PURE__*/React.createElement("td", {
    style: RS.td
  }, /*#__PURE__*/React.createElement("div", {
    style: RS.tokenCell
  }, r.t && /*#__PURE__*/React.createElement("span", {
    style: {
      ...RS.tbadge,
      ...(r.t === 'pnj' ? RS.badgePnj : RS.badgePj)
    }
  }, r.t === 'pnj' ? 'PN' : 'PJ'), /*#__PURE__*/React.createElement("span", {
    style: RS.tokenLabel
  }, r.label))), /*#__PURE__*/React.createElement("td", {
    style: {
      ...RS.td,
      textAlign: 'center',
      fontFamily: "'Share Tech Mono'",
      fontWeight: 600,
      color: '#dde7ee'
    }
  }, r.ini != null ? r.ini : '—'), mode === 'pre' && /*#__PURE__*/React.createElement("td", {
    style: RS.td
  }, !r.t ? null : r.t === 'pj' ? /*#__PURE__*/React.createElement("span", {
    style: RS.equippedText
  }, r.weapon ? `${r.weapon.name} [${r.weapon.slot}]` : '— sans arme') : r.weapon ? /*#__PURE__*/React.createElement("span", {
    style: RS.equippedGreen
  }, /*#__PURE__*/React.createElement("span", {
    style: RS.dot
  }, "\u25CF"), r.weapon.name, " ", /*#__PURE__*/React.createElement("span", {
    style: RS.slotTag
  }, "[", r.weapon.slot, "]")) : /*#__PURE__*/React.createElement("span", {
    style: RS.selectDanger
  }, "\u26A0 Choisir une arme ", /*#__PURE__*/React.createElement("span", {
    style: RS.caret
  }, "\u25BE"))), mode === 'pre' && /*#__PURE__*/React.createElement("td", {
    style: RS.td
  }, !r.t ? null : r.t === 'pj' ? /*#__PURE__*/React.createElement(ArmorChips, {
    coverage: r.armor,
    kind: "pj"
  }) : r.armor.length === 0 ? /*#__PURE__*/React.createElement("span", {
    style: RS.selectWarn
  }, "\u26A0 T C B J ", /*#__PURE__*/React.createElement("span", {
    style: RS.caret
  }, "\u25BE")) : /*#__PURE__*/React.createElement("span", {
    style: RS.selectWarn
  }, "\u26A0 T C B J ", /*#__PURE__*/React.createElement("span", {
    style: RS.caret
  }, "\u25BE"))), mode === 'roster' && /*#__PURE__*/React.createElement("td", {
    style: {
      ...RS.td,
      textAlign: 'center'
    }
  }, r.t === 'pj' ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#3a4a5a',
      fontSize: 16,
      lineHeight: 1
    }
  }, "\xB7") : /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#2a3a4a'
    }
  }, "\u2014")), /*#__PURE__*/React.createElement("td", {
    style: {
      ...RS.td,
      textAlign: 'center'
    }
  }, mode === 'roster' ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#2a3a4a'
    }
  }, "\u2014") : /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !!surprised[r.id],
    onChange: () => setSurprised(s => ({
      ...s,
      [r.id]: !s[r.id]
    })),
    style: {
      cursor: 'pointer',
      accentColor: '#c86030'
    }
  })), mode === 'pre' && /*#__PURE__*/React.createElement("td", {
    style: {
      ...RS.td,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !excluded[r.id],
    onChange: () => setExcluded(e => ({
      ...e,
      [r.id]: !e[r.id]
    })),
    style: {
      cursor: 'pointer',
      accentColor: '#5b8dee'
    }
  }))))))), mode === 'pre' ? /*#__PURE__*/React.createElement("button", {
    style: RS.btnStart
  }, "D\xC9MARRER LE COMBAT (", active.length, ")") : /*#__PURE__*/React.createElement("button", {
    style: RS.btnAnnounce
  }, "Passer en Annonce \u2192"));
}
const RS = {
  window: {
    position: 'absolute',
    width: 560,
    background: '#0d0f18',
    border: '1px solid #1e2435',
    borderRadius: 6,
    boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
    maxHeight: 'calc(100% - 90px)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: "'Inter', system-ui",
    zIndex: 42
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderBottom: '1px solid #1e2435',
    background: '#080a12',
    cursor: 'grab',
    userSelect: 'none'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  title: {
    fontSize: 11,
    letterSpacing: '0.15em',
    fontWeight: 700,
    color: '#3a8aaa'
  },
  badge: {
    fontSize: 9,
    letterSpacing: '0.08em',
    padding: '2px 6px',
    borderRadius: 2,
    border: '1px solid #aa6030',
    color: '#e8a060',
    background: '#1a1008',
    fontWeight: 600
  },
  count: {
    fontSize: 10,
    color: '#3a4a5a',
    fontFamily: "'Share Tech Mono'",
    fontStyle: 'italic'
  },
  alert: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '7px 14px',
    background: '#1a1008',
    borderBottom: '1px solid #aa6030'
  },
  alertLabel: {
    fontSize: 9,
    letterSpacing: '0.12em',
    color: '#6a4a20',
    fontWeight: 700
  },
  alertItem: {
    fontSize: 10,
    color: '#e8a060',
    fontWeight: 600
  },
  tableWrap: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    padding: '6px 10px',
    fontSize: 9,
    color: '#3a8aaa',
    letterSpacing: '0.1em',
    textAlign: 'left',
    borderBottom: '1px solid #1e2435',
    background: '#080a12',
    position: 'sticky',
    top: 0,
    whiteSpace: 'nowrap'
  },
  td: {
    padding: '6px 10px',
    fontSize: 11,
    color: '#c0c8d0',
    borderBottom: '1px solid #10141e',
    verticalAlign: 'middle'
  },
  tokenCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 6
  },
  tbadge: {
    fontSize: 9,
    letterSpacing: '0.05em',
    padding: '2px 6px',
    borderRadius: 2,
    border: '1px solid',
    fontWeight: 600
  },
  badgePj: {
    background: '#0a1a0a',
    color: '#50c878',
    borderColor: '#50c878'
  },
  badgePnj: {
    background: '#1a0a08',
    color: '#c86030',
    borderColor: '#c86030'
  },
  tokenLabel: {
    fontSize: 11,
    color: '#c0c8d0'
  },
  equippedText: {
    fontSize: 10,
    color: '#4a5a6a',
    fontStyle: 'italic'
  },
  equippedGreen: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 10,
    color: '#90c090'
  },
  dot: {
    color: '#50c878',
    fontSize: 8
  },
  slotTag: {
    color: '#4a6a4a',
    fontSize: 9
  },
  selectDanger: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'space-between',
    width: 160,
    padding: '3px 6px',
    fontSize: 10,
    background: '#1a0808',
    border: '1px solid #aa3030',
    borderRadius: 2,
    color: '#e08080'
  },
  selectWarn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    width: 96,
    padding: '3px 6px',
    fontSize: 10,
    background: '#1a1208',
    border: '1px solid #aa6030',
    borderRadius: 2,
    color: '#e0a060',
    letterSpacing: '0.08em'
  },
  caret: {
    marginLeft: 'auto',
    opacity: .7
  },
  chips: {
    display: 'flex',
    gap: 3,
    alignItems: 'center'
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    fontSize: 9,
    fontWeight: 700,
    borderRadius: 2,
    fontFamily: "'Share Tech Mono'"
  },
  chipPjFilled: {
    background: '#1a2030',
    color: '#5a6a7a',
    border: '1px solid #2a3a4a'
  },
  chipPjEmpty: {
    background: 'transparent',
    color: '#2a3a4a',
    border: '1px solid #1a2030'
  },
  chipPnjFilled: {
    background: '#0a2010',
    color: '#50c878',
    border: '1px solid #2a6040'
  },
  chipPnjGap: {
    background: 'transparent',
    color: '#4a2020',
    border: '1px solid #6a2020'
  },
  btnStart: {
    display: 'block',
    width: '100%',
    padding: '11px 14px',
    background: 'rgba(58,138,170,0.1)',
    border: 'none',
    borderTop: '1px solid #1e2435',
    color: '#3a8aaa',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.1em'
  },
  btnAnnounce: {
    display: 'block',
    width: '100%',
    padding: '11px 14px',
    background: 'rgba(80,200,120,0.1)',
    border: 'none',
    borderTop: '1px solid #1e2435',
    color: '#50c878',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.1em'
  }
};
window.RosterWindow = RosterWindow;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/session/RosterWindow.jsx", error: String((e && e.message) || e) }); }

// ui_kits/session/SessionApp.jsx
try { (() => {
// SessionApp.jsx — pre-game (login, dashboard) + the live session shell. Click-through flow.
const {
  useState: useStateA
} = React;

/* ---------------- LOGIN ---------------- */
function Login({
  onLogin
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 20% 20%, #1a2340 0%, transparent 40%), radial-gradient(circle at 80% 80%, #0b0e14 0%, transparent 50%), #0f1115'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      opacity: .10,
      filter: 'invert(1)',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      backgroundSize: '500px',
      backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(window.__ENCLUME_LOGO_RAW__ || '')}")`,
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 340,
      background: 'linear-gradient(180deg,#151923,#10131b)',
      border: '1px solid #252b3a',
      borderRadius: 14,
      padding: 20,
      boxShadow: '0 10px 30px rgba(0,0,0,.35)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      font: "400 34px 'Venus Rising',sans-serif",
      color: '#e8eef7',
      letterSpacing: '.01em'
    }
  }, "Enclume"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '4px 0 0',
      font: "13px 'Inter'",
      color: '#9aa4b2'
    }
  }, "VTT pour Polaris \xB7 sessions priv\xE9es")), /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      onLogin();
    },
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: lbl
  }, "Email"), /*#__PURE__*/React.createElement("input", {
    defaultValue: "mj@enclume.fr",
    style: inp
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: lbl
  }, "Mot de passe"), /*#__PURE__*/React.createElement("input", {
    type: "password",
    defaultValue: "forgeron",
    style: inp
  })), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    style: {
      width: '100%',
      marginTop: 8,
      background: '#5b8dee',
      border: 'none',
      color: '#fff',
      borderRadius: 12,
      padding: '9px',
      font: "600 14px 'Inter'",
      cursor: 'pointer'
    }
  }, "Se connecter")), /*#__PURE__*/React.createElement("p", {
    style: {
      textAlign: 'center',
      marginTop: 12,
      font: "13px 'Inter'"
    }
  }, /*#__PURE__*/React.createElement("a", {
    style: {
      color: '#5b8dee',
      textDecoration: 'none'
    }
  }, "Cr\xE9er un compte"))));
}
const lbl = {
  font: "12px 'Inter'",
  color: '#9aa4b2',
  display: 'block',
  marginBottom: 4
};
const inp = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#0c0f16',
  color: '#e8eef7',
  border: '1px solid #252b3a',
  borderRadius: 12,
  padding: '8px 10px',
  font: "14px 'Inter'",
  outline: 'none'
};

/* ---------------- DASHBOARD ---------------- */
function Dashboard({
  onPlay,
  onLogout
}) {
  const camps = [{
    n: 'Les Cendres de Kanaan',
    role: 'gm',
    code: 'X7K2-9QP',
    cover: 'linear-gradient(135deg,#3a2618,#1a0e08)'
  }, {
    n: 'La Dérive du Norhont',
    role: 'gm',
    code: 'B4M1-2RT',
    cover: 'linear-gradient(135deg,#16263a,#0a1018)'
  }, {
    n: 'Convoi 17',
    role: 'player',
    code: 'K9PL-3XZ',
    cover: 'linear-gradient(135deg,#2a163a,#120a18)'
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      background: '#0f1115'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      height: 56,
      flexShrink: 0,
      background: '#10131b',
      borderBottom: '1px solid #252b3a'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(AnvilLogo, {
    h: 26,
    body: "#5b8dee"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "500 16px 'Inter'",
      color: '#e8eef7'
    }
  }, "Enclume")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "13px 'Inter'",
      color: '#9aa4b2'
    }
  }, "Atelier du MJ"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "14px 'Inter'",
      color: '#e8eef7'
    }
  }, "toi"), /*#__PURE__*/React.createElement("button", {
    onClick: onLogout,
    style: {
      background: 'none',
      border: '1px solid #252b3a',
      borderRadius: 6,
      padding: '6px 12px',
      color: '#9aa4b2',
      font: "13px 'Inter'",
      cursor: 'pointer'
    }
  }, "D\xE9connexion"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 900,
      margin: '0 auto',
      padding: '40px 32px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))',
      gap: 12
    }
  }, camps.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.n,
    onClick: () => onPlay(c.n),
    style: {
      background: 'linear-gradient(180deg,#151923,#10131b)',
      border: '1px solid #252b3a',
      borderRadius: 14,
      padding: 12,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 110,
      borderRadius: 12,
      background: c.cover,
      marginBottom: 10
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "500 15px 'Inter'",
      color: '#e8eef7'
    }
  }, c.n), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "11px 'Inter'",
      padding: '3px 8px',
      borderRadius: 6,
      ...(c.role === 'gm' ? {
        background: 'rgba(91,141,238,.2)',
        color: '#5b8dee'
      } : {
        background: 'rgba(76,175,119,.2)',
        color: '#4caf77'
      })
    }
  }, c.role === 'gm' ? 'MJ' : 'Joueur')), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "12px 'Share Tech Mono'",
      color: '#6b7280'
    }
  }, "#", c.code), /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      onPlay(c.n);
    },
    style: {
      background: '#5b8dee',
      color: '#fff',
      border: 'none',
      borderRadius: 6,
      padding: '8px 16px',
      font: "13px 'Inter'",
      cursor: 'pointer'
    }
  }, "Jouer")))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 180,
      background: 'linear-gradient(180deg,#151923,#10131b)',
      border: '1px solid #252b3a',
      borderRadius: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: "900 160px 'Inter'",
      color: 'rgba(255,255,255,.04)',
      pointerEvents: 'none'
    }
  }, "\u2192"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 1,
      font: "13px 'Inter'",
      color: '#9aa4b2',
      marginBottom: 12
    }
  }, "Rejoindre une campagne"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      width: '80%'
    }
  }, /*#__PURE__*/React.createElement("input", {
    placeholder: "#code-invitation",
    style: {
      ...inp,
      background: '#0f1115',
      borderRadius: 6,
      padding: '8px 12px',
      font: "13px 'Inter'"
    }
  }), /*#__PURE__*/React.createElement("button", {
    style: {
      background: '#5b8dee',
      color: '#fff',
      border: 'none',
      borderRadius: 6,
      padding: '8px',
      font: "13px 'Inter'",
      cursor: 'pointer'
    }
  }, "Rejoindre")))))));
}

/* ---------------- 3D MAP PLACEHOLDER ---------------- */
function MapBackdrop() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      overflow: 'hidden',
      background: 'radial-gradient(circle at 30% 25%, #1a2340 0%, transparent 45%), radial-gradient(circle at 75% 80%, #160e22 0%, transparent 50%), #0a0a0f'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      opacity: .05,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center 46%',
      backgroundSize: '560px',
      backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(window.__ENCLUME_LOGO_RAW__ || '')}")`
    }
  }), /*#__PURE__*/React.createElement("svg", {
    style: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      opacity: .5
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("pattern", {
    id: "iso",
    width: "56",
    height: "32",
    patternTransform: "skewX(-30)",
    patternUnits: "userSpaceOnUse"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M0 0 H56 M0 0 V32",
    stroke: "#1c2336",
    strokeWidth: "1",
    fill: "none"
  }))), /*#__PURE__*/React.createElement("rect", {
    x: "-200",
    y: "40%",
    width: "160%",
    height: "60%",
    fill: "url(#iso)"
  })), [['Kaelen', ENC.green, '46%', '58%'], ['Orsa', '#FFD700', '54%', '52%'], ['Brann', ENC.gold, '50%', '64%'], ['Sicaire', ENC.red, '62%', '60%']].map(([n, c, l, t]) => /*#__PURE__*/React.createElement("div", {
    key: n,
    style: {
      position: 'absolute',
      left: l,
      top: t,
      transform: 'translate(-50%,-50%)',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 34,
      height: 34,
      borderRadius: '50%',
      background: `radial-gradient(circle at 35% 30%, ${c}, ${c}66)`,
      border: `2px solid ${c}`,
      boxShadow: `0 4px 10px rgba(0,0,0,.6), 0 0 0 4px ${c}1a`
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "600 9px 'Inter'",
      color: '#cdd3e0',
      marginTop: 3,
      textShadow: '0 1px 3px #000'
    }
  }, n))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 12,
      left: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 9px',
      background: 'rgba(10,10,20,.7)',
      border: `1px solid ${ENC.border}`,
      borderRadius: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: ENC.green
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "10px 'Share Tech Mono'",
      color: ENC.txtMid
    }
  }, "carte 3D \xB7 react-three-fiber")));
}
Object.assign(window, {
  Login,
  Dashboard,
  MapBackdrop
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/session/SessionApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/session/SessionSidebar.jsx
try { (() => {
// SessionSidebar.jsx — the in-game right sidebar: Chat (with dice rolls), Persos, Joueurs.
const {
  useState,
  useRef,
  useEffect
} = React;
function DiceMsg({
  m
}) {
  const ok = m.success;
  const tint = ok ? 'rgba(76,175,119,' : 'rgba(224,92,92,';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: tint + '.07)',
      border: `1px solid ${tint}.2)`,
      borderRadius: 8,
      padding: '8px 10px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      marginBottom: 3
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: m.color,
      display: 'flex'
    }
  }, m.fav ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13
    }
  }, "\u2605") : /*#__PURE__*/React.createElement(IconDice, null)), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "500 12px 'Inter'",
      color: m.color
    }
  }, m.who), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "10px 'Inter'",
      color: ENC.txtLo
    }
  }, " \xB7 ", m.time), m.secret && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      marginLeft: 2
    }
  }, "\uD83D\uDD12")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8,
      paddingLeft: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "14px 'Inter'",
      color: ENC.txtMid
    }
  }, m.label), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "700 20px 'Share Tech Mono'",
      color: '#dde7ee',
      fontVariantNumeric: 'tabular-nums'
    }
  }, m.total), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "10px 'Inter'",
      color: '#456575'
    }
  }, "/ ", m.seuil)), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-block',
      marginTop: 4,
      font: "600 11px 'Inter'",
      padding: '2px 8px',
      borderRadius: 4,
      background: tint + '.15)',
      border: `1px solid ${tint}.4)`,
      color: ok ? ENC.greenSoft : ENC.red
    }
  }, ok ? `Marge de réussite +${m.mr}` : `Marge d'échec −${m.mr}`, m.crit ? ok ? ' ✦ Critique' : ' ✦ Maladresse' : ''));
}
function PlainMsg({
  m
}) {
  if (m.system) return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      gap: 6,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "italic 11px 'Inter'",
      color: ENC.txtLo
    }
  }, m.text), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "10px 'Inter'",
      color: ENC.txtLo
    }
  }, m.time));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "500 12px 'Inter'",
      color: m.color
    }
  }, m.who), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "10px 'Inter'",
      color: ENC.txtLo
    }
  }, "\xB7 ", m.time), /*#__PURE__*/React.createElement("span", {
    style: {
      width: '100%',
      font: "13px/1.4 'Inter'",
      color: ENC.txtHi,
      wordBreak: 'break-word'
    }
  }, m.text));
}
function SessionSidebar({
  width,
  messages,
  onSend,
  onClose
}) {
  const [tab, setTab] = useState('chat');
  const [draft, setDraft] = useState('');
  const scroller = useRef(null);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages, tab]);
  const tabs = [['chat', 'Chat'], ['persos', 'Persos'], ['joueurs', 'Joueurs'], ['biblio', 'Biblio'], ['config', 'Config']];
  const personnages = [{
    n: 'Kaelen Vorne',
    o: 'toi',
    c: ENC.green
  }, {
    n: 'Maître Orsa',
    o: 'Léa',
    c: '#FFD700'
  }, {
    n: 'Brann le Sourd',
    o: 'Théo',
    c: ENC.gold
  }];
  const joueurs = [{
    n: 'toi',
    gm: true,
    on: true,
    ch: 'Kaelen Vorne',
    c: ENC.green
  }, {
    n: 'Léa',
    gm: false,
    on: true,
    ch: 'Maître Orsa',
    c: '#FFD700'
  }, {
    n: 'Théo',
    gm: false,
    on: false,
    ch: 'Brann le Sourd',
    c: ENC.gold
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: '100%',
      width,
      background: ENC.bgSession,
      borderLeft: `1px solid ${ENC.border}`,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      userSelect: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: -3,
      top: 0,
      width: 6,
      height: '100%',
      cursor: 'col-resize',
      zIndex: 20
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    title: "Fermer",
    style: {
      position: 'absolute',
      top: 8,
      right: 8,
      background: 'none',
      border: 'none',
      color: ENC.txtLo,
      cursor: 'pointer',
      padding: '2px 6px',
      borderRadius: 4,
      display: 'flex',
      zIndex: 10
    }
  }, /*#__PURE__*/React.createElement(IconX, null)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      borderBottom: `1px solid ${ENC.border}`,
      flexShrink: 0,
      paddingTop: 6
    }
  }, tabs.map(([k, l]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setTab(k),
    style: {
      flex: 1,
      padding: '8px 0',
      background: 'none',
      border: 'none',
      borderBottom: `2px solid ${tab === k ? ENC.blue : 'transparent'}`,
      color: tab === k ? ENC.txtMid : ENC.txtLo,
      cursor: 'pointer',
      font: "600 10px 'Inter'",
      letterSpacing: '.5px',
      textTransform: 'uppercase'
    }
  }, l))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }
  }, tab === 'chat' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    ref: scroller,
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '8px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, messages.map(m => m.type === 'dice' ? /*#__PURE__*/React.createElement(DiceMsg, {
    key: m.id,
    m: m
  }) : /*#__PURE__*/React.createElement(PlainMsg, {
    key: m.id,
    m: m
  }))), /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      if (draft.trim()) {
        onSend(draft.trim());
        setDraft('');
      }
    },
    style: {
      display: 'flex',
      gap: 6,
      padding: '8px 12px',
      borderTop: `1px solid ${ENC.border}`,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: draft,
    onChange: e => setDraft(e.target.value),
    placeholder: "Message ou /d20+3\u2026",
    style: {
      flex: 1,
      background: ENC.bgRaised,
      border: `1px solid ${ENC.border}`,
      borderRadius: 6,
      padding: '6px 10px',
      color: ENC.txtHi,
      font: "12px 'Inter'",
      outline: 'none'
    }
  }), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    style: {
      background: 'none',
      border: 'none',
      color: ENC.blue,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      padding: '4px 6px'
    }
  }, /*#__PURE__*/React.createElement(IconSend, null)))), tab === 'persos' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      padding: '8px 12px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      background: 'rgba(91,141,238,.1)',
      border: '1px solid rgba(91,141,238,.3)',
      borderRadius: 6,
      color: ENC.blue,
      font: "11px 'Inter'",
      padding: '5px 10px',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(IconPlus, {
    size: 12
  }), " Nouveau perso")), personnages.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.n,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 10px',
      background: ENC.bgRaised,
      border: `1px solid ${ENC.border}`,
      borderRadius: 6,
      cursor: 'grab'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: '50%',
      background: p.c,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "13px 'Inter'",
      color: ENC.txtHi,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, p.n), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "10px 'Inter'",
      color: ENC.txtLo
    }
  }, p.o))))), tab === 'joueurs' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      padding: '8px 12px'
    }
  }, joueurs.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.n,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 10px',
      background: ENC.bgRaised,
      border: `1px solid ${ENC.border}`,
      borderRadius: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: p.on ? ENC.green : ENC.txtLo,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "13px 'Inter'",
      color: ENC.txtHi
    }
  }, p.n), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "9px 'Inter'",
      letterSpacing: '.5px',
      textTransform: 'uppercase',
      padding: '1px 4px',
      borderRadius: 3,
      ...(p.gm ? {
        color: ENC.blue,
        background: 'rgba(91,141,238,.15)',
        border: '1px solid rgba(91,141,238,.3)'
      } : {
        color: ENC.txtLo,
        background: 'rgba(74,74,96,.2)',
        border: '1px solid rgba(74,74,96,.3)'
      })
    }
  }, p.gm ? 'MJ' : 'PJ')), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "11px 'Inter'",
      color: ENC.txtLo,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, p.ch)), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "10px 'Inter'",
      color: p.on ? ENC.greenSoft : ENC.txtLo
    }
  }, p.on ? 'en ligne' : 'absent')))), tab === 'biblio' && /*#__PURE__*/React.createElement("p", {
    style: {
      font: "italic 12px 'Inter'",
      color: ENC.txtLo,
      textAlign: 'center',
      padding: '24px 12px'
    }
  }, "Biblioth\xE8que \u2014 bient\xF4t."), tab === 'config' && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Profil"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      font: "12px 'Inter'",
      color: ENC.txtMid,
      display: 'block',
      marginBottom: 4
    }
  }, "Pseudo"), /*#__PURE__*/React.createElement("input", {
    defaultValue: "toi",
    style: {
      width: '100%',
      boxSizing: 'border-box',
      background: ENC.bgRaised,
      border: `1px solid ${ENC.border}`,
      borderRadius: 6,
      padding: '6px 10px',
      color: ENC.txtHi,
      font: "13px 'Inter'",
      outline: 'none'
    }
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      font: "12px 'Inter'",
      color: ENC.txtMid,
      display: 'block',
      marginBottom: 6
    }
  }, "Couleur"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, ['#4caf77', '#5b8dee', '#FFD700', '#e05b5b', '#aa3bff'].map(c => /*#__PURE__*/React.createElement("span", {
    key: c,
    style: {
      width: 24,
      height: 24,
      borderRadius: 6,
      background: c,
      cursor: 'pointer',
      border: c === '#4caf77' ? '2px solid #fff' : '2px solid transparent'
    }
  })))))));
}
window.SessionSidebar = SessionSidebar;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/session/SessionSidebar.jsx", error: String((e && e.message) || e) }); }

})();
