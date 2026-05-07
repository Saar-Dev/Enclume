// ===============================
// 30_CombatMJ_Injuries.gs  (V2 FIX BEST ARMOR)
// ===============================
/**
 * ============================================================
 * 30_CombatMJ_Injuries.gs — MJ module "Combat" (blessures + armures)
 *
 * ✅ FIX BEST ARMOR:
 * - BEST: on lit Armure Nom + Valeurs DIRECTEMENT par row si possible
 * - Détection row via:
 *   - entity.bestRow (si présent)
 *   - patterns id/templateKey: BEST_123, BESTINST::123, BEST::123, etc.
 *   - fallback: recherche nom normalisée en col B
 * - Support onglet: "Bestiaire" OU "Bestiaires"
 * - Valeurs armure en display: "5 / -", "1 / 15", etc. (0 conservé)
 *
 * PJ/PNJ:
 * - PJ: écriture checkbox -> appel direct moteur onEdit (91) => cascade+malus OK
 * - PNJ avec fiche (fid): idem
 * - BEST: blessures locales uniquement (pas d’écriture Sheets)
 * ============================================================
 */

const COMBATMJ_PREFIX = "COMBATMJ_";
const COMBATMJ_LEVELS = 6;

const COMBATMJ_PJ_TOP_ROW = 46;
const COMBATMJ_PJ_ZONE_A1 = "AF46:BB51";
const COMBATMJ_PJ_MALUS_A1 = "BD46";

const COMBATMJ_PNJ_INJ_KEY = (mid, npcId) =>
  `${COMBATMJ_PREFIX}PNJ_INJ_${String(mid || INIT_MJ_SHEET_ID).trim()}_${String(npcId || "").trim()}`;

// Layout FIXE
const COMBATMJ_ZONE_IDS = ["Tete","Corps","BrasD","BrasG","JambeD","JambeG"];
const COMBATMJ_ZONE_LABELS = {
  Tete:"Tête",
  Corps:"Corps",
  BrasD:"Bras droit",
  BrasG:"Bras gauche",
  JambeD:"Jambe droite",
  JambeG:"Jambe gauche"
};
const COMBATMJ_ZONES_CFG = {
  Tete:   { startCol: 32, widths: [3,3,2,2,1,0] },
  Corps:  { startCol: 36, widths: [4,3,3,2,2,0] },
  BrasD:  { startCol: 40, widths: [3,3,2,2,1,1] },
  BrasG:  { startCol: 44, widths: [3,3,2,2,1,1] },
  JambeD: { startCol: 48, widths: [3,3,2,2,1,1] },
  JambeG: { startCol: 52, widths: [3,3,2,2,1,1] }
};

// Armures PJ/PNJ (checkbox groups)
const COMBATMJ_ARMOR_GROUPS_A1 = {
  Tete:   "AF37:AF42",
  Corps:  "AJ37:AJ42",
  BrasD:  "AN37:AN42",
  BrasG:  "AR37:AR42",
  JambeD: "AV37:AV42",
  JambeG: "AZ37:AZ42"
};
const COMBATMJ_ARMOR_NAME_COL = 23; // W
const COMBATMJ_ARMOR_M32_A1 = "M32";

// Bestiaire armure (colonnes EXACTES)
const COMBATMJ_BEST_SHEET_PRIMARY = "Bestiaire";
const COMBATMJ_BEST_SHEET_ALT     = "Bestiaires";
const COMBATMJ_BEST_NAME_COL = 2;          // B
const COMBATMJ_BEST_ARMOR_NAME_COL = 20;   // T
const COMBATMJ_BEST_ARMOR_VAL_START_COL = 21; // U
const COMBATMJ_BEST_ARMOR_VAL_COLS = 6;    // U..Z

function _combatmj_props_(){ return PropertiesService.getScriptProperties(); }
function _combatmj_lock_(){ return LockService.getScriptLock(); }

function _combatmj_normType_(t){
  const s = String(t || "").toUpperCase().trim();
  if (s === "PNJ" || s === "NPC") return "PNJ";
  return "PJ";
}

function _combatmj_layout_(){
  return {
    zones: COMBATMJ_ZONE_IDS.map(id => ({
      id,
      label: COMBATMJ_ZONE_LABELS[id] || id,
      widths: (COMBATMJ_ZONES_CFG[id] ? COMBATMJ_ZONES_CFG[id].widths : Array.from({length:COMBATMJ_LEVELS}, ()=>0)),
      startCol: (COMBATMJ_ZONES_CFG[id] ? COMBATMJ_ZONES_CFG[id].startCol : 0)
    }))
  };
}

function _combatmj_emptyGridFromZones_(zones){
  const g = {};
  (zones||[]).forEach(z=>{
    const widths = Array.isArray(z.widths) ? z.widths : [];
    const maxW = Math.max(0, ...widths.map(n=>Number(n)||0));
    g[z.id] = Array.from({length:COMBATMJ_LEVELS}, ()=> Array.from({length:maxW}, ()=> false));
  });
  return g;
}

function _zoneRangeInfo_(){ return { startCol: 32, levels: COMBATMJ_LEVELS }; }

function _combatmj_gridFromMatrix_(matrix, zones){
  const out = _combatmj_emptyGridFromZones_(zones);
  const m = Array.isArray(matrix) ? matrix : [];
  const baseCol = _zoneRangeInfo_().startCol;

  (zones||[]).forEach(z=>{
    const cfg = COMBATMJ_ZONES_CFG[z.id];
    if (!cfg) return;

    const offset = cfg.startCol - baseCol;
    for (let r=0;r<COMBATMJ_LEVELS;r++){
      const w = Number(cfg.widths[r]||0)||0;
      for (let c=0;c<w;c++){
        const cell = (m[r] && m[r][offset + c] !== undefined) ? m[r][offset + c] : false;
        out[z.id][r][c] = (cell === true);
      }
    }
  });

  return { grid: out };
}

/* =======================
   Armures PJ/PNJ sheet
   ======================= */

function _combatmj_parseArmorX_(s){
  const t = String(s||"").trim();
  const m = t.match(/-?\d+/);
  return m ? Number(m[0]) : null;
}
function _combatmj_fmtArmor_(x){
  const n = Number(x);
  if (!Number.isFinite(n)) return "—";
  return `${n} / -`;
}

function _combatmj_readArmorByZoneFromPersonnageSheet_(sh){
  const m32 = Number(sh.getRange(COMBATMJ_ARMOR_M32_A1).getValue() || 0) || 0;
  const out = { _default: _combatmj_fmtArmor_(-m32) };

  for (const zoneId of COMBATMJ_ZONE_IDS){
    const a1 = COMBATMJ_ARMOR_GROUPS_A1[zoneId];
    const rg = sh.getRange(a1);
    const vals = rg.getValues(); // 6x1
    const baseRow = rg.getRow();
    const baseCol = rg.getColumn();

    let foundRow = -1;
    for (let i=0;i<vals.length;i++){
      if (vals[i] && vals[i][0] === true){ foundRow = i; break; }
    }

    if (foundRow < 0){
      out[zoneId] = { name:"Aucune armure", value:_combatmj_fmtArmor_(-m32), isDefault:true };
      continue;
    }

    const row = baseRow + foundRow;
    const armorName = String(sh.getRange(row, COMBATMJ_ARMOR_NAME_COL).getValue() || "").trim() || "Armure";
    const rawVal = sh.getRange(row, baseCol + 2).getValue(); // +2 colonnes
    const x = _combatmj_parseArmorX_(rawVal);

    if (x == null){
      out[zoneId] = { name: armorName, value:_combatmj_fmtArmor_(-m32), isDefault:false };
      continue;
    }

    const adjusted = x - m32;
    out[zoneId] = { name: armorName, value:_combatmj_fmtArmor_(adjusted), isDefault:false };
  }

  return out;
}

/* =======================
   BEST — helpers row + sheet
   ======================= */

function _combatmj_getBestSheet_(mid){
  const ss = SpreadsheetApp.openById(String(mid||"").trim());
  let sh = ss.getSheetByName(COMBATMJ_BEST_SHEET_PRIMARY);
  if (!sh) sh = ss.getSheetByName(COMBATMJ_BEST_SHEET_ALT);
  return { ss, sh };
}

function _combatmj_normNameKey_(s){
  return String(s||"")
    .trim()
    .replace(/\u00A0/g, " ")
    .replace(/[’‘‛`´]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function _combatmj_cleanBestName_(s){
  s = String(s||"").trim();
  s = s.replace(/^BEST::/i, "").trim();
  s = s.replace(/\s*\([^)]*\)\s*$/g, "").trim();
  s = s.replace(/\s*\[[^\]]*\]\s*$/g, "").trim();
  s = s.replace(/\s*(?:#|×|x)\s*\d+\s*$/i, "").trim();
  // ne coupe pas “ - ” si ton bestiaire utilise des tirets dans le nom
  return s;
}

function _combatmj_extractBestRow_(...candidates){
  // patterns stricts: BEST_123 / BESTINST::123 / BEST::123
  for (const c of candidates){
    const s = String(c||"").trim();
    if (!s) continue;

    let m = s.match(/^BEST_(\d+)$/i);
    if (m) return Number(m[1]) || 0;

    m = s.match(/^BESTINST::(\d+)$/i);
    if (m) return Number(m[1]) || 0;

    m = s.match(/^BEST::(\d+)$/i);
    if (m) return Number(m[1]) || 0;

    // pattern "BEST::<name> #123" (au cas où)
    m = s.match(/\bBEST\b.*?(\d{1,6})\b/i);
    if (m) return Number(m[1]) || 0;
  }
  return 0;
}

function _combatmj_findBestiaryRowByNameNormalized_(sh, monsterName){
  monsterName = String(monsterName||"").trim();
  if (!monsterName) return 0;

  const last = sh.getLastRow();
  if (last < 2) return 0;

  const target = _combatmj_normNameKey_(monsterName);
  if (!target) return 0;

  const col = sh
    .getRange(1, COMBATMJ_BEST_NAME_COL, last, 1)
    .getDisplayValues()
    .map(r => String(r?.[0] ?? "").trim());

  for (let i=0;i<col.length;i++){
    const nm = col[i];
    if (!nm) continue;
    if (_combatmj_normNameKey_(nm) === target) return i+1;
  }
  return 0;
}

function _combatmj_readArmorByZoneFromBestiaryRow_(sh, row){
  if (!sh || !row || row <= 0) return { _default:"—" };

  const armorName = String(sh.getRange(row, COMBATMJ_BEST_ARMOR_NAME_COL).getDisplayValue() ?? "").trim();

  const vals = sh
    .getRange(row, COMBATMJ_BEST_ARMOR_VAL_START_COL, 1, COMBATMJ_BEST_ARMOR_VAL_COLS)
    .getDisplayValues()[0];

  const zoneOrder = ["Tete","Corps","BrasD","BrasG","JambeD","JambeG"];
  const out = { _default:"—" };

  for (let i=0;i<zoneOrder.length;i++){
    const z = zoneOrder[i];
    const raw = (vals && vals[i] !== undefined) ? vals[i] : "";
    const v = String(raw ?? "").trim(); // "0" reste "0"
    out[z] = {
      name: armorName || "Aucune armure",
      value: v ? v : "—",
      isDefault: !armorName
    };
  }

  return out;
}

function _combatmj_readArmorByZoneFromBestiary_(mid, meta){
  const { sh } = _combatmj_getBestSheet_(mid);
  if (!sh) return { _default:"—" };

  // 1) priorité row (comme compétences)
  const row1 = Number(meta?.bestRow || 0) || 0;
  const row2 = _combatmj_extractBestRow_(meta?.id, meta?.templateKey, meta?.name);
  const row = row1 > 0 ? row1 : (row2 > 0 ? row2 : 0);
  if (row > 0){
    return _combatmj_readArmorByZoneFromBestiaryRow_(sh, row);
  }

  // 2) fallback recherche par nom normalisé
  const nmRaw = String(meta?.templateKey || meta?.name || "").trim();
  const nm = _combatmj_cleanBestName_(nmRaw);
  if (!nm) return { _default:"—" };

  let found = _combatmj_findBestiaryRowByNameNormalized_(sh, nmRaw);
  if (!found && nm !== nmRaw) found = _combatmj_findBestiaryRowByNameNormalized_(sh, nm);

  if (!found) return { _default:"—" };
  return _combatmj_readArmorByZoneFromBestiaryRow_(sh, found);
}

/* =======================
   Meta PNJ
   ======================= */

function _combatmj_getNpcMeta_(mid, npcId){
  const ro = reg_getNpcRoster(String(mid||"").trim());
  const roster = (ro && Array.isArray(ro.roster)) ? ro.roster : [];
  const id = String(npcId||"").trim();

  const n = roster.find(x => String(x.id||"").trim() === id) || null;
  if (!n) return { source:"PNJ", name:"", templateKey:"", fid:"", bestRow:0, id };

  return {
    source: String(n.source || "PNJ").toUpperCase(),
    name: String(n.name || "").trim(),
    templateKey: String(n.templateKey || "").trim(),
    fid: String(n.fid || "").trim(),
    bestRow: Number(n.bestRow || 0) || 0,
    id
  };
}

/* =======================
   IMPORTANT: exécuter le moteur onEdit blessure (91)
   ======================= */

function _combatmj_runCentralInjuryEngine_(ss, sh, editedRange, oldValue){
  const e = {
    range: editedRange,
    oldValue: oldValue,
    source: ss
  };
  _centralEngine_onEdit_(e, sh);
}

/* ============================================================
   API MJ — Entities
============================================================ */

function combat_mj_getEntities(mid){
  mid = (typeof _coerceFileId_ === "function")
    ? _coerceFileId_(mid, INIT_MJ_SHEET_ID)
    : String(mid || "").trim().replace(/^["']+|["']+$/g, "") || INIT_MJ_SHEET_ID;

  const layout = _combatmj_layout_();

  // ---------- PJ ----------
  const playersData = reg_getPlayers(mid);
  const pj = (playersData?.players || [])
    .map(p => ({
      kind: "PJ",
      id: String(p.fid || "").trim(),
      name: p.label || p.fid || "PJ"
    }))
    .filter(x => x.id);

  // ---------- PNJ ----------
  const rosterData = reg_getNpcRoster(mid);
  const pnj = (rosterData?.roster || [])
    .map(n => {
      const id = String(n.id || "").trim();
      const source = String(n.source || "PNJ").toUpperCase();
      const templateKey = String(n.templateKey || "").trim();

      // bestRow robuste
      let bestRow = Number(n.bestRow || 0) || 0;
      if (!bestRow){
        const m1 = id.match(/^BEST_(\d+)$/i);
        const m2 = id.match(/^BESTINST::(\d+)$/i);
        const m3 = templateKey.match(/^BEST::(\d+)$/i);
        bestRow = (m1 && Number(m1[1])) || (m2 && Number(m2[1])) || (m3 && Number(m3[1])) || 0;
      }

      return {
        kind: "PNJ",
        id,
        name: n.name || "PNJ",
        camp: n.camp || "Ennemi",
        baseInit: Number(n.baseInit || 0) || 0,
        source,
        templateKey,
        fid: String(n.fid || "").trim(),
        bestRow
      };
    })
    .filter(x => x.id);

  return {
    ok: true,
    mid,
    zones: layout.zones || [],
    entities: [...pj, ...pnj]
  };
}

/* ============================================================
   API MJ — getInjuries
============================================================ */

function combat_mj_getInjuries(mid, kind, id){
  mid = String(mid || INIT_MJ_SHEET_ID).trim();
  kind = _combatmj_normType_(kind);
  id = String(id || "").trim();
  if (!id) return { ok:false, message:"ID manquant" };

  const zones = (_combatmj_layout_().zones || []);

  if (kind === "PJ"){
    const ss = SpreadsheetApp.openById(id);
    const sh = ss.getSheetByName("Personnage");
    const matrix = sh.getRange(COMBATMJ_PJ_ZONE_A1).getValues();
    const malus = Number(sh.getRange(COMBATMJ_PJ_MALUS_A1).getValue() || 0) || 0;
    const grid = _combatmj_gridFromMatrix_(matrix, zones).grid;
    const armorByZone = _combatmj_readArmorByZoneFromPersonnageSheet_(sh);
    return { ok:true, mid, kind, id, grid, malus, armorByZone };
  }

  const meta = _combatmj_getNpcMeta_(mid, id);

  // BEST = lecture armure par row/nom (aucune blessure stockée)
  if (meta.source === "BEST"){
    return {
      ok:true, mid, kind, id,
      grid: _combatmj_emptyGridFromZones_(zones),
      malus: 0,
      armorByZone: _combatmj_readArmorByZoneFromBestiary_(mid, meta)
    };
  }

  // PNJ avec fiche
  if (meta.fid){
    const ss = SpreadsheetApp.openById(meta.fid);
    const sh = ss.getSheetByName("Personnage");
    const matrix = sh.getRange(COMBATMJ_PJ_ZONE_A1).getValues();
    const malus = Number(sh.getRange(COMBATMJ_PJ_MALUS_A1).getValue() || 0) || 0;
    const grid = _combatmj_gridFromMatrix_(matrix, zones).grid;
    const armorByZone = _combatmj_readArmorByZoneFromPersonnageSheet_(sh);
    return { ok:true, mid, kind, id, grid, malus, armorByZone };
  }

  // fallback legacy properties
  const raw = _combatmj_props_().getProperty(COMBATMJ_PNJ_INJ_KEY(mid, id));
  const obj = raw ? _safeJsonParse_(raw, null) : null;
  let grid = (obj && obj.grid) ? obj.grid : null;
  let malus = (obj && obj.malus != null) ? Number(obj.malus || 0) : 0;
  if (!grid) grid = _combatmj_emptyGridFromZones_(zones);

  return { ok:true, mid, kind, id, grid, malus, armorByZone:{ _default:"—" } };
}

/* ============================================================
   API MJ — setInjury
============================================================ */

function combat_mj_setInjury(mid, kind, id, zoneId, r, idx, checked){
  mid = String(mid || INIT_MJ_SHEET_ID).trim();
  kind = _combatmj_normType_(kind);
  id = String(id || "").trim();
  zoneId = String(zoneId || "").trim();
  r = Number(r);
  idx = Number(idx);
  checked = (checked === true);

  if (!id) return { ok:false, message:"ID manquant" };
  if (!zoneId) return { ok:false, message:"zoneId manquant" };
  if (!Number.isFinite(r) || r < 0 || r >= COMBATMJ_LEVELS) return { ok:false, message:"Niveau invalide" };
  if (!Number.isFinite(idx) || idx < 0) return { ok:false, message:"Index invalide" };

  const zones = (_combatmj_layout_().zones || []);
  const cfg = COMBATMJ_ZONES_CFG[zoneId];
  if (!cfg) return { ok:false, message:"Zone inconnue: " + zoneId };

  const w = Number((cfg.widths || [])[r] || 0) || 0;
  if (idx >= w){
    return combat_mj_getInjuries(mid, kind, id);
  }

  const lock = _combatmj_lock_();
  lock.waitLock(5000);
  try{
    if (kind === "PJ"){
      const ss = SpreadsheetApp.openById(id);
      const sh = ss.getSheetByName("Personnage");

      const row = COMBATMJ_PJ_TOP_ROW + r;
      const col = cfg.startCol + idx;

      const cell = sh.getRange(row, col);
      const oldVal = cell.getValue();

      if (typeof oldVal !== "boolean" && oldVal !== true && oldVal !== false){
        return combat_mj_getInjuries(mid, kind, id);
      }

      cell.setValue(checked);
      _combatmj_runCentralInjuryEngine_(ss, sh, cell, oldVal);

      const matrix = sh.getRange(COMBATMJ_PJ_ZONE_A1).getValues();
      const malus = Number(sh.getRange(COMBATMJ_PJ_MALUS_A1).getValue() || 0) || 0;
      const grid = _combatmj_gridFromMatrix_(matrix, zones).grid;
      const armorByZone = _combatmj_readArmorByZoneFromPersonnageSheet_(sh);

      return { ok:true, mid, kind, id, grid, malus, armorByZone };
    }

    const meta = _combatmj_getNpcMeta_(mid, id);

    // BEST: no-op (mais renvoie armure OK)
    if (meta.source === "BEST"){
      return {
        ok:true, mid, kind, id,
        grid: _combatmj_emptyGridFromZones_(zones),
        malus: 0,
        armorByZone: _combatmj_readArmorByZoneFromBestiary_(mid, meta)
      };
    }

    // PNJ fiche
    if (meta.fid){
      const ss = SpreadsheetApp.openById(meta.fid);
      const sh = ss.getSheetByName("Personnage");

      const row = COMBATMJ_PJ_TOP_ROW + r;
      const col = cfg.startCol + idx;

      const cell = sh.getRange(row, col);
      const oldVal = cell.getValue();

      if (typeof oldVal !== "boolean" && oldVal !== true && oldVal !== false){
        return combat_mj_getInjuries(mid, kind, id);
      }

      cell.setValue(checked);
      _combatmj_runCentralInjuryEngine_(ss, sh, cell, oldVal);

      const matrix = sh.getRange(COMBATMJ_PJ_ZONE_A1).getValues();
      const malus = Number(sh.getRange(COMBATMJ_PJ_MALUS_A1).getValue() || 0) || 0;
      const grid = _combatmj_gridFromMatrix_(matrix, zones).grid;
      const armorByZone = _combatmj_readArmorByZoneFromPersonnageSheet_(sh);

      return { ok:true, mid, kind, id, grid, malus, armorByZone };
    }

    // fallback properties
    const raw = _combatmj_props_().getProperty(COMBATMJ_PNJ_INJ_KEY(mid, id));
    const obj = raw ? _safeJsonParse_(raw, null) : null;

    let grid = (obj && obj.grid) ? obj.grid : _combatmj_emptyGridFromZones_(zones);
    let malus = (obj && obj.malus != null) ? Number(obj.malus || 0) : 0;

    if (!grid[zoneId]) grid[zoneId] = _combatmj_emptyGridFromZones_([{id:zoneId,widths:cfg.widths}])[zoneId];
    const maxW = Math.max(0, ...(cfg.widths||[]).map(n => Number(n)||0));
    while (grid[zoneId].length < COMBATMJ_LEVELS) grid[zoneId].push([]);

    for (let rr=0; rr<COMBATMJ_LEVELS; rr++){
      const arr = Array.isArray(grid[zoneId][rr]) ? grid[zoneId][rr] : [];
      while (arr.length < maxW) arr.push(false);
      grid[zoneId][rr] = arr;
    }
    grid[zoneId][r][idx] = checked;

    _combatmj_props_().setProperty(
      COMBATMJ_PNJ_INJ_KEY(mid, id),
      JSON.stringify({ grid, malus, updatedAt: _nowIso_() })
    );

    return { ok:true, mid, kind, id, grid, malus, armorByZone:{_default:"—"} };

  } finally {
    try{ lock.releaseLock(); }catch(_){}
  }
}
