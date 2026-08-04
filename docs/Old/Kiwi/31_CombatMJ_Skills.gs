// ===============================
// 31_CombatMJ_Skills.gs
// ===============================
/**
 * ============================================================
 * 31_CombatMJ_Skills.gs — MJ module "Combat" (skills bulk) — CLEAN
 * - Source skills: BDD Polaris (sheet Compétences) => colonnes A,B,C (+ D optionnel)
 * - PJ/PNJ sheets: Personnage (Cat=B, Nom=C, SousNom=D, Score=T)
 * - Bestiaire: MJ sheet "Bestiaires"
 *    - nom monstre: col B
 *    - skills: colonnes AB:BG (headers = "Cat_ - Nom - SousNom")
 *
 * Contrat de sortie:
 *  - skills   : [{key,label,full}]
 *  - entities : mêmes entités que combat_mj_getEntities + sid injecté (+ bestRow)
 *  - bySid    : { sid -> { skillKey -> scoreTxt } }
 *  - byId     : compat { entity.id -> same map } + alias BEST_<row>
 * ============================================================
 */

const COMBATSK_PREFIX = "COMBATSK_";
const COMBATSK_CACHE_SKILLS_KEY = `${COMBATSK_PREFIX}SKILLS_V6`;
const COMBATSK_CACHE_TTL = 600; // 10 min

// BDD Polaris (fallback)
const COMBATSK_BDD_ID_FALLBACK = "12msJt6Mzpx9f-Kj9Y-2_CpQ7ZSsuC78SNI6WX1h0ob0";
const COMBATSK_BDD_SHEET_FALLBACK = "Compétences";

const COMBATSK_PERSO_SHEET = "Personnage";

// Table skills dans Personnage
const COMBATSK_PERSO_START_ROW = 34;
const COMBATSK_PERSO_OVERLAP_ROWS = 10;
const COMBATSK_PERSO_MAX_ROWS = 900;

// B..T => 19 colonnes (B=2, T=20)
const COMBATSK_PERSO_START_COL = 2; // B
const COMBATSK_PERSO_COLS = 19;

// Indexes dans B..T (0-based)
const IDX_CAT   = 0;   // B
const IDX_NAME  = 1;   // C
const IDX_SUB   = 2;   // D
const IDX_SCORE = 18;  // T

// Bestiaire
const COMBATSK_BEST_SHEET = "Bestiaires";
const COMBATSK_BEST_NAME_COL = 2;          // B
const COMBATSK_BEST_SKILLS_START_COL = 28; // AB
const COMBATSK_BEST_SKILLS_COLS = 32;      // AB..BG

/* =======================
   Helpers
======================= */
function _combatsk_cleanId_(s){
  s = String(s ?? "").trim();

  // retire les guillemets englobants (1 à 3 fois au cas où "\"...\"" etc)
  for (let i = 0; i < 3; i++){
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))){
      s = s.slice(1, -1).trim();
      continue;
    }
    break;
  }
  return s;
}

function _combatsk_safeJsonParse_(txt, fallback){
  try { return JSON.parse(txt); } catch(_) { return fallback; }
}
function _combatsk_jsonParse_(txt, fallback){
  if (typeof _safeJsonParse_ === "function") return _safeJsonParse_(txt, fallback);
  return _combatsk_safeJsonParse_(txt, fallback);
}

function _combatsk_bddId_(){
  try{
    if (typeof BDD_POLARIS_ID !== "undefined" && String(BDD_POLARIS_ID).trim()){
      return String(BDD_POLARIS_ID).trim();
    }
  }catch(_){}
  return COMBATSK_BDD_ID_FALLBACK;
}
function _combatsk_bddSheet_(){
  try{
    if (typeof BDD_COMPETENCES_SHEET !== "undefined" && String(BDD_COMPETENCES_SHEET).trim()){
      return String(BDD_COMPETENCES_SHEET).trim();
    }
  }catch(_){}
  return COMBATSK_BDD_SHEET_FALLBACK;
}

function _combatsk_normKey_(s){
  // Normalisation "hard" (MAIS on garde "_" "*" etc)
  return (s ?? "")
    .toString()
    .replace(/\u00A0/g, " ")                 // NBSP -> space
    .replace(/[’‘‛`´]/g, "'")                // apostrophes typographiques -> '
    .replace(/[–—]/g, "-")                   // tirets longs -> -
    .replace(/\s*\/\s*/g, "/")               // espaces autour /
    .replace(/\s*-\s*/g, " - ")              // uniformise séparateur
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")         // accents
    .replace(/\s+/g, " ")
    .trim();
}

function _combatsk_join_(cat, name, sub){
  const parts = [];
  if (cat)  parts.push(String(cat).trim());
  if (name) parts.push(String(name).trim());
  if (sub)  parts.push(String(sub).trim());
  return parts.filter(Boolean).join(" - ");
}

function _combatsk_isProbablySpreadsheetId_(s){
  const id = _combatsk_cleanId_(s);
  return /^[a-zA-Z0-9-_]{20,}$/.test(id);
}

function _combatsk_openByIdSafe_(id, label, ssCache){
  const sid = _combatsk_cleanId_(id);
  if (!sid) throw new Error(`ID Spreadsheet manquant (${label || "?"})`);
  if (ssCache && ssCache.has(sid)) return ssCache.get(sid);

  for (let attempt=1; attempt<=2; attempt++){
    try{
      const ss = SpreadsheetApp.openById(sid);
      if (ssCache) ssCache.set(sid, ss);
      return ss;
    }catch(err){
      if (attempt === 2) throw new Error(`ID Spreadsheet invalide: "${sid}"`);
      try{ Utilities.sleep(120); }catch(_){}
    }
  }
  throw new Error(`ID Spreadsheet invalide: "${sid}"`);
}

function _combatsk_getSheetById_(sid, sheetName, ssCache){
  const ss = _combatsk_openByIdSafe_(sid, sheetName, ssCache);
  const sh = ss.getSheetByName(String(sheetName || "").trim());
  if (!sh) throw new Error(`Onglet introuvable "${sheetName}"`);
  return sh;
}

/* =======================
   BEST entity helpers
======================= */

function _combatsk_isBestEntity_(e){
  const source = String(e?.source || "").toUpperCase();
  if (source === "BEST") return true;

  const id = String(e?.id || "");
  if (/^BESTINST::/i.test(id)) return true;

  const tk = String(e?.templateKey || "");
  if (/^BEST::/i.test(tk)) return true;

  return false;
}

function _combatsk_cleanBestName_(s){
  s = String(s||"").trim();
  s = s.replace(/^BEST::/i, "").trim();

  // décorations fréquentes
  s = s.replace(/\s*\([^)]*\)\s*$/g, "").trim();        // (x2)
  s = s.replace(/\s*\[[^\]]*\]\s*$/g, "").trim();       // [..]
  s = s.replace(/\s*(?:#|×|x)\s*\d+\s*$/i, "").trim();  // #2 / x2 / ×2
  s = s.replace(/\s*[-–—]\s*.*$/g, "").trim();          // " - ..." / " — ..."
  return s;
}

function _combatsk_extractSidFromId_(id){
  id = String(id||"").trim();
  // PNJFID::<sheetId>
  const m1 = id.match(/^[A-Z]+FID::([a-zA-Z0-9-_]{20,})$/);
  if (m1 && m1[1]) return m1[1];
  return "";
}

function _combatsk_findBestRowLoose_(ctx, raw){
  if (!ctx || !ctx.rowByName) return 0;

  const tryOne = (name)=>{
    const k = _combatsk_normKey_(name);
    return (k && ctx.rowByName[k]) ? Number(ctx.rowByName[k]) : 0;
  };

  // 1) exact
  let row = tryOne(raw);
  if (row) return row;

  // 2) nettoyé
  const cleaned = _combatsk_cleanBestName_(raw);
  if (cleaned && cleaned !== raw){
    row = tryOne(cleaned);
    if (row) return row;
  }

  // 3) préfixe (pour noms décorés)
  const tgt = _combatsk_normKey_(cleaned || raw);
  if (!tgt) return 0;

  let bestRow = 0;
  let bestLen = 0;

  for (const kk in ctx.rowByName){
    if (!kk) continue;
    if (tgt.startsWith(kk) || kk.startsWith(tgt)){
      const len = Math.min(kk.length, tgt.length);
      if (len > bestLen){
        bestLen = len;
        bestRow = Number(ctx.rowByName[kk]) || 0;
      }
    }
  }
  return bestRow;
}

function _combatsk_bestRowFromEntity_(e, ctx){
  // priorité à bestRow si fourni
  const br = Number(e?.bestRow || 0);
  if (br > 0) return br;

  const candidates = [
    e?.bestName,
    e?.monsterName,
    e?.templateName,
    e?.templateKey,
    e?.name
  ].map(x => String(x||"").trim()).filter(Boolean);

  for (const c of candidates){
    const row = _combatsk_findBestRowLoose_(ctx, c);
    if (row > 0) return row;
  }
  return 0;
}

function _combatsk_computeSid_(e, bestRow, isBest){
  const kind = String(e?.kind || "").toUpperCase();
  const id = String(e?.id || "").trim();

  if (kind === "PJ"){
    return id; // fid
  }

  if (isBest){
    if (bestRow > 0) return `BEST_${bestRow}`;
    const nm = String(e?.name || "").trim();
    return nm ? `BEST_${_combatsk_normKey_(_combatsk_cleanBestName_(nm))}` : "BEST_?";
  }

  // PNJ fiche
  const fid = String(e?.fid || e?.sheetId || "").trim();
  if (fid) return fid;

  const extracted = _combatsk_extractSidFromId_(id);
  return extracted || id;
}

/* =======================
   Skills list (BDD)
======================= */

function _combatsk_getSkillsFromBDD_(){
  const cache = CacheService.getScriptCache();
  const hit = cache.get(COMBATSK_CACHE_SKILLS_KEY);
  if (hit){
    const obj = _combatsk_jsonParse_(hit, null);
    if (obj && Array.isArray(obj.skills)) return obj.skills;
  }

  const bddId = _combatsk_bddId_();
  const sheetName = _combatsk_bddSheet_();

  const bdd = SpreadsheetApp.openById(bddId);
  const sh = bdd.getSheetByName(sheetName);
  if (!sh) throw new Error(`BDD: onglet introuvable "${sheetName}"`);

  const lastRow = sh.getLastRow();
  if (lastRow < 1) return [];

  // A,B,C (+D possible)
  const data = sh.getRange(1, 1, lastRow, 4).getDisplayValues();
  const out = [];
  const seen = new Set();

  for (let i=0; i<data.length; i++){
    const cat  = String(data[i][0]||"").trim();
    const name = String(data[i][1]||"").trim();
    const sub  = String(data[i][2]||"").trim();

    // skip header row if present
    if (i === 0 && /cat/i.test(cat) && /nom|comp/i.test(name)) continue;
    if (!cat || !name) continue;

    const full = _combatsk_join_(cat, name, sub);
    const key  = _combatsk_normKey_(full);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    out.push({ key, label: sub || name, full });
  }

  cache.put(COMBATSK_CACHE_SKILLS_KEY, JSON.stringify({ skills: out }), COMBATSK_CACHE_TTL);
  return out;
}

/* =======================
   Personnage -> map(key -> scoreTxt)
======================= */

function _combatsk_readPersoSkillMap_(fid, ssCache){
  fid = String(fid || "").trim();
  if (!fid) return Object.create(null);
  if (!_combatsk_isProbablySpreadsheetId_(fid)) throw new Error(`FID invalide: "${fid}"`);

  const sh = _combatsk_getSheetById_(fid, COMBATSK_PERSO_SHEET, ssCache);

  const lastRow = sh.getLastRow();
  if (lastRow < 1) return Object.create(null);

  const startRow = Math.max(1, COMBATSK_PERSO_START_ROW - COMBATSK_PERSO_OVERLAP_ROWS);
  const rowsCount = Math.min(COMBATSK_PERSO_MAX_ROWS, Math.max(0, lastRow - startRow + 1));
  if (rowsCount <= 0) return Object.create(null);

  const rg = sh.getRange(startRow, COMBATSK_PERSO_START_COL, rowsCount, COMBATSK_PERSO_COLS);
  const disp = rg.getDisplayValues();

  let curCat = "";
  let curName = "";

  const map = Object.create(null);

  for (let i=0; i<disp.length; i++){
    const cat  = String(disp[i][IDX_CAT]  || "").trim();
    const name = String(disp[i][IDX_NAME] || "").trim();
    const sub  = String(disp[i][IDX_SUB]  || "").trim();
    const scoreTxt = String(disp[i][IDX_SCORE] ?? "").trim();

    if (cat) {
      curCat = cat;
      if (!name && !sub) curName = "";
    }
    if (name) curName = name;

    let full = "";
    if (sub){
      if (!curCat || !curName) continue;
      full = _combatsk_join_(curCat, curName, sub);
    } else if (name){
      if (!curCat) continue;
      full = _combatsk_join_(curCat, name, "");
    } else {
      continue;
    }

    const key = _combatsk_normKey_(full);
    if (!key) continue;

    if (scoreTxt === "") continue; // vide => pas stocké
    map[key] = scoreTxt;
  }

  return map;
}

/* =======================
   Bestiaire (context)
======================= */

function _combatsk_detectBestiaryHeaderRow_(sh){
  const maxProbe = Math.min(30, sh.getLastRow());
  if (maxProbe < 1) return 1;

  let bestRow = 1;
  let bestHits = -1;

  for (let r = 1; r <= maxProbe; r++){
    const vals = sh
      .getRange(r, COMBATSK_BEST_SKILLS_START_COL, 1, COMBATSK_BEST_SKILLS_COLS)
      .getDisplayValues()[0];

    let hits = 0;
    for (let i = 0; i < vals.length; i++){
      const t = String(vals[i] || "").trim();
      if (!t) continue;
      if (t.includes(" - ") && /[A-Za-zÀ-ÿ]/.test(t)) hits++;
    }
    if (hits > bestHits){
      bestHits = hits;
      bestRow = r;
    }
  }
  return bestRow;
}

function _combatsk_getBestiaryContext_(mid, ssCache){
  const ss = _combatsk_openByIdSafe_(mid, "MJ", ssCache);
  const sh = ss.getSheetByName(COMBATSK_BEST_SHEET);
  if (!sh) return null;

  const headerRow = _combatsk_detectBestiaryHeaderRow_(sh);

  const headers = sh
    .getRange(headerRow, COMBATSK_BEST_SKILLS_START_COL, 1, COMBATSK_BEST_SKILLS_COLS)
    .getDisplayValues()[0];

  const headerKeys = headers.map(h => {
    const hh = String(h || "").trim();
    return hh ? _combatsk_normKey_(hh) : "";
  });

  // noms = ligne juste après header
  const startRow = headerRow + 1;

  const last = sh.getLastRow();
  const rowByName = Object.create(null);

  if (last >= startRow){
    const names = sh.getRange(startRow, COMBATSK_BEST_NAME_COL, last - startRow + 1, 1).getDisplayValues();
    for (let i=0;i<names.length;i++){
      const nm = String(names[i][0] || "").trim();
      if (!nm) continue;
      const k = _combatsk_normKey_(nm);
      if (!k) continue;
      if (!rowByName[k]) rowByName[k] = startRow + i;
    }
  }

  return { sh, headerRow, startRow, headerKeys, rowByName };
}

function _combatsk_readBestiarySkillMapByRow_(ctx, row){
  if (!ctx || !ctx.sh) return Object.create(null);
  row = Number(row || 0);
  if (row <= 0) return Object.create(null);

  const values = ctx.sh
    .getRange(row, COMBATSK_BEST_SKILLS_START_COL, 1, COMBATSK_BEST_SKILLS_COLS)
    .getDisplayValues()[0];

  const map = Object.create(null);
  for (let i=0;i<ctx.headerKeys.length;i++){
    const key = ctx.headerKeys[i];
    if (!key) continue;
    const v = String(values[i] ?? "").trim();
    if (v === "") continue;
    map[key] = v;
  }
  return map;
}

function _combatsk_readBestiarySkillMapFromName_(ctx, monsterName){
  if (!ctx || !ctx.sh) return Object.create(null);
  const nm = String(monsterName||"").trim();
  if (!nm) return Object.create(null);

  const row = ctx.rowByName[_combatsk_normKey_(nm)] || 0;
  if (!row) return Object.create(null);

  return _combatsk_readBestiarySkillMapByRow_(ctx, row);
}

/* =======================
   Public API
======================= */

function combat_mj_getSkillsBulk(mid){
  mid = _combatsk_cleanId_(mid || (typeof INIT_MJ_SHEET_ID !== "undefined" ? INIT_MJ_SHEET_ID : ""));
  if (!mid) throw new Error("MID manquant");

  const skills = _combatsk_getSkillsFromBDD_();

  const entRes = combat_mj_getEntities(mid);
  if (!entRes || entRes.ok !== true) throw new Error(entRes?.message || "combat_mj_getEntities failed");
  const entities0 = Array.isArray(entRes.entities) ? entRes.entities : [];

  const ssCache = new Map();
  let bestCtx = null;
  const ensureBestCtx = () => {
    if (bestCtx !== null) return bestCtx;
    bestCtx = _combatsk_getBestiaryContext_(mid, ssCache);
    return bestCtx;
  };

  // enrich entities with sid (+ bestRow robuste)
  const entities = entities0.map(e => {
    const isBest = _combatsk_isBestEntity_(e);
    let bestRow = 0;

    if (isBest){
      const ctx = ensureBestCtx();
      bestRow = _combatsk_bestRowFromEntity_(e, ctx);
    }

    const sid = _combatsk_computeSid_(e, bestRow, isBest);
    return { ...e, sid, bestRow };
  });

  const bySid = Object.create(null);
  const byId  = Object.create(null);
  const failed = [];

  for (const e of entities){
    const kind = String(e.kind||"").toUpperCase();
    const id = String(e.id||"").trim();
    const sid = String(e.sid||"").trim();
    if (!id) continue;

    try{
      let map = Object.create(null);

      if (kind === "PJ"){
        map = _combatsk_readPersoSkillMap_(id, ssCache);

      } else if (_combatsk_isBestEntity_(e)){
        const ctx = ensureBestCtx();
        const row = Number(e.bestRow || 0) || _combatsk_bestRowFromEntity_(e, ctx);
        map = (row > 0)
          ? _combatsk_readBestiarySkillMapByRow_(ctx, row)
          : _combatsk_readBestiarySkillMapFromName_(ctx, _combatsk_cleanBestName_(e.name || ""));

      } else {
        const fid = String(e.fid || e.sheetId || "").trim() || (_combatsk_isProbablySpreadsheetId_(id) ? id : "");
        map = fid ? _combatsk_readPersoSkillMap_(fid, ssCache) : Object.create(null);
      }

      // stockage stable
      if (sid) bySid[sid] = map;

      // compat: id -> map
      byId[id] = map;

      // alias BEST_<row> si dispo (pour tests console + compat)
      const br = Number(e.bestRow || 0);
      if (br > 0){
        const alias = `BEST_${br}`;
        if (!bySid[alias]) bySid[alias] = map;
        if (!byId[alias])  byId[alias]  = map;
      }

    }catch(err){
      failed.push({ id, sid, kind, name: e.name || id, error: String(err?.message || err) });
      const empty = Object.create(null);
      if (sid) bySid[sid] = empty;
      byId[id] = empty;
    }
  }

  return { ok:true, mid, skills, entities, bySid, byId, failed };
}

// compat HTML existant
function combat_mj_getAllSkillScores(mid){
  const bulk = combat_mj_getSkillsBulk(mid);
  return {
    ok: true,
    mid: bulk.mid,
    skills: bulk.skills,
    players: bulk.entities,
    byFid: bulk.byId,
    failed: bulk.failed
  };
}
