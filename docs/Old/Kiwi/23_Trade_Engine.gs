
/*************************************************************
 * Trade_Engine.gs ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Polaris Marchands
 * Stockage V2 :
 * - 1 ligne = 1 marchand
 * - 1 JSON complet par marchand
 * - suppression physique (deleteRow)
 *
 * + Catalogue MJ
 * + PARAM rules
 * + UI joueur / panier / checkout Inventaire via plages nommÃƒÆ’Ã‚Â©es
 *
 * DÃƒÆ’Ã‚Â©pendances attendues :
 * - 00_Config.gs
 * - 02_Utils.gs
 *************************************************************/

/* ============================================================
   STOCKAGE MARCHANDS ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â V2 (1 JSON complet par ligne)
============================================================ */

const TRADE_JSON_HEADERS = [
  "MerchantId",
  "Name",
  "Status",
  "Allowed",
  "UpdatedAt",
  "PayloadJson"
];

const TRADE_JSON_COL = {
  id: 1,
  name: 2,
  status: 3,
  allowed: 4,
  updatedAt: 5,
  payload: 6
};

/* ============================================================
   Helpers plages nommÃƒÆ’Ã‚Â©es / registre
============================================================ */

function trade_nr_name_(key, fallback){
  try{
    if (typeof TRADE_NR !== "undefined" && TRADE_NR && Object.prototype.hasOwnProperty.call(TRADE_NR, key)){
      const v = String(TRADE_NR[key] || "").trim();
      if (v) return v;
    }
  }catch(_){}
  return String(fallback || key || "").trim();
}

const TRADE_NR_INV = Object.freeze({
  id:    trade_nr_name_("InventaireIDObj", "InventaireIDObj"),
  name:  trade_nr_name_("InventaireNomObj", "InventaireNomObj"),
  fam:   trade_nr_name_("InventaireFamObj", "InventaireFamObj"),
  cat:   trade_nr_name_("InventaireCATObj", "InventaireCATObj"),
  empl:  trade_nr_name_("InventaireEmplObj", "InventaireEmplObj"),
  wgt:   trade_nr_name_("InventairePoidsObj", "InventairePoidsObj"),
  desc:  trade_nr_name_("InventaireDescriptionObj", "InventaireDescriptionObj"),
  qty:   trade_nr_name_("InventaireQteObj", "InventaireQteObj"),
  notes: trade_nr_name_("InventaireObjNotes", "InventaireObjNotes")
});

const TRADE_NR_EQUIP = Object.freeze({
  name:         trade_nr_name_("EquipNom", "EquipNom"),
  fam:          trade_nr_name_("EquipFam", "EquipFam"),
  cat:          trade_nr_name_("EquipCAT", "EquipCAT"),
  desc:         trade_nr_name_("EquipDescription", "EquipDescription"),
  price:        trade_nr_name_("EquipPrix", "EquipPrix"),
  wgt:          trade_nr_name_("EquipPoids", "EquipPoids"),
  nt:           trade_nr_name_("EquipNT", "EquipNT"),
  statModMax:   trade_nr_name_("EquipStatModMax", "EquipStatModMax"),
  fabricant:    trade_nr_name_("EquipFabricant", "EquipFabricant"),
  nation:       trade_nr_name_("EquipNation", "EquipNation"),
  armeDom:      trade_nr_name_("EquipArmeDom", "EquipArmeDom"),
  armeChoc:     trade_nr_name_("EquipArmeChoc", "EquipArmeChoc"),
  armePortee:   trade_nr_name_("EquipArmePortee", "EquipArmePortee"),
  armeFOR:      trade_nr_name_("EquipArmeFORPreReq", "EquipArmeFORPreReq"),
  armeINI:      trade_nr_name_("EquipArmeINIMod", "EquipArmeINIMod"),
  armeModeTir:  trade_nr_name_("EquipArmeModeTir", "EquipArmeModeTir"),
  armeMun:      trade_nr_name_("EquipArmeMunition", "EquipArmeMunition"),
  armeCAL:      trade_nr_name_("EquipArmeCAL", "EquipArmeCAL"),
  dispo:        trade_nr_name_("EquipDispo", "EquipDispo"),
  armureProt:   trade_nr_name_("EquipArmureProt", "EquipArmureProt"),
  armureChoc:   trade_nr_name_("EquipArmureChoc", "EquipArmureChoc"),
  armureLoc:    trade_nr_name_("EquipArmureLoc", "EquipArmureLoc"),
  armureMal:    trade_nr_name_("EquipArmureMal", "EquipArmureMal"),
  objCont:      trade_nr_name_("EquipObjContenance", "EquipObjContenance"),
  objEtanche:   trade_nr_name_("EquipObjEtancheite", "EquipObjEtancheite")
});

function trade_getNamedRangeOrThrow_(ss, rangeName, label){
  const r = ss.getRangeByName(String(rangeName || "").trim());
  if (!r){
    throw new Error(`Plage nommÃƒÆ’Ã‚Â©e introuvable: ${label || rangeName}`);
  }
  if (r.getNumColumns() !== 1){
    throw new Error(`La plage nommÃƒÆ’Ã‚Â©e "${label || rangeName}" doit faire 1 seule colonne.`);
  }
  return r;
}

function trade_getNamedRangeOptional_(ss, rangeName, numRows){
  try{
    const r = ss.getRangeByName(String(rangeName || "").trim());
    if (!r || r.getNumColumns() !== 1 || r.getNumRows() !== numRows) return null;
    return r;
  }catch(_){ return null; }
}

function trade_optValVals_(ss, rangeName, numRows){
  const r = trade_getNamedRangeOptional_(ss, rangeName, numRows);
  return r ? r.getDisplayValues() : null;
}

function trade_optVal_(vals, i){
  if (!vals) return "";
  return String((vals[i] && vals[i][0]) || "").trim();
}

function trade_assertAlignedNamedRanges_(map, groupLabel){
  const keys = Object.keys(map || {});
  if (!keys.length) throw new Error(`Aucune plage fournie pour ${groupLabel || "groupe"}.`);

  const first = map[keys[0]];
  const sh = first.getSheet();
  const row = first.getRow();
  const numRows = first.getNumRows();

  keys.forEach(k => {
    const r = map[k];
    if (r.getSheet().getSheetId() !== sh.getSheetId()){
      throw new Error(`Toutes les plages nommÃƒÆ’Ã‚Â©es ${groupLabel || ""} doivent ÃƒÆ’Ã‚Âªtre sur la mÃƒÆ’Ã‚Âªme feuille (problÃƒÆ’Ã‚Â¨me: ${k}).`);
    }
    if (r.getRow() !== row){
      throw new Error(`Toutes les plages nommÃƒÆ’Ã‚Â©es ${groupLabel || ""} doivent commencer ÃƒÆ’Ã‚Â  la mÃƒÆ’Ã‚Âªme ligne (problÃƒÆ’Ã‚Â¨me: ${k}).`);
    }
    if (r.getNumRows() !== numRows){
      throw new Error(`Toutes les plages nommÃƒÆ’Ã‚Â©es ${groupLabel || ""} doivent avoir la mÃƒÆ’Ã‚Âªme hauteur (problÃƒÆ’Ã‚Â¨me: ${k}).`);
    }
  });

  return { sh, row, numRows };
}

function trade_uniqueNonEmptyStrings_(list){
  const out = [];
  const seen = Object.create(null);

  (list || []).forEach(v => {
    const s = String(v == null ? "" : v).trim();
    if (!s) return;
    const k = s.toLowerCase();
    if (seen[k]) return;
    seen[k] = true;
    out.push(s);
  });

  return out;
}

function trade_catalogLooksLikeHeaderRow_(row){
  const fam  = String(row && row.fam || "").trim().toLowerCase();
  const cat  = String(row && row.cat || "").trim().toLowerCase();
  const name = String(row && row.name || "").trim().toLowerCase();

  if (!fam && !cat && !name) return false;

  return (
    /fam/.test(fam) &&
    /cat/.test(cat) &&
    /nom/.test(name)
  );
}

/* ============================================================
   JOUEUR ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â inventaire / argent
============================================================ */

const TRADE_PLAYER_MONEY_TAB = TRADE_PLAYER_SHEET_PERSONNAGE;
const TRADE_PLAYER_MONEY_A1 = TRADE_PLAYER_MONEY_CELL;
const TRADE_CHECKOUT_DRAFT_TTL_SEC = 30 * 60;

function trade_openById_(id){
  return SpreadsheetApp.openById(String(id).trim());
}

function trade_json_openMidSheet_(mid){
  const ss = trade_openById_(mid);
  let sh = ss.getSheetByName(TRADE_MJ_SHEET_MERCHANTS);
  if (!sh) sh = ss.insertSheet(TRADE_MJ_SHEET_MERCHANTS);
  return { ss, sh };
}

function trade_store_headerOk_(sh){
  try{
    const row = sh.getRange(1, 1, 1, TRADE_JSON_HEADERS.length)
      .getDisplayValues()[0]
      .map(x => String(x || "").trim());
    for (let i = 0; i < TRADE_JSON_HEADERS.length; i++){
      if (row[i] !== TRADE_JSON_HEADERS[i]) return false;
    }
    return true;
  }catch(_){
    return false;
  }
}

function trade_store_ensure_(mid){
  const { sh } = trade_json_openMidSheet_(mid);

  const needCols = TRADE_JSON_HEADERS.length;
  const curCols = sh.getMaxColumns();
  if (curCols < needCols) sh.insertColumnsAfter(curCols, needCols - curCols);

  const lastRow = Number(sh.getLastRow() || 0);

  if (lastRow === 0){
    sh.getRange(1, 1, 1, TRADE_JSON_HEADERS.length).setValues([TRADE_JSON_HEADERS]);
    sh.setFrozenRows(1);
    return;
  }

  if (trade_store_headerOk_(sh)){
    sh.setFrozenRows(1);
    return;
  }

  const row1 = sh.getRange(1, 1, 1, TRADE_JSON_HEADERS.length).getDisplayValues()[0]
    .map(x => String(x || "").trim());
  const row1Empty = row1.every(x => x === "");

  if (row1Empty && lastRow <= 1){
    sh.getRange(1, 1, 1, TRADE_JSON_HEADERS.length).setValues([TRADE_JSON_HEADERS]);
    sh.setFrozenRows(1);
    return;
  }

  throw new Error(
    'Onglet "' + TRADE_MJ_SHEET_MERCHANTS + '" avec en-tÃƒÆ’Ã‚Âªtes inattendus. ' +
    'Aucune donnÃƒÆ’Ã‚Â©e nÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢a ÃƒÆ’Ã‚Â©tÃƒÆ’Ã‚Â© modifiÃƒÆ’Ã‚Â©e automatiquement pour ÃƒÆ’Ã‚Â©viter tout effacement.'
  );
}

function trade_json_ensure_(mid){ trade_store_ensure_(mid); }

function trade_json_dataLastRow_(sh){
  return Math.max(1, Number((sh && sh.getLastRow()) || 1));
}

function trade_numOrDefault_(v, dflt){
  if (v === "" || v === null || v === undefined) return dflt;
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

function trade_clampInt_(v, min, max, dflt){
  const n = Math.floor(trade_numOrDefault_(v, dflt));
  return Math.max(min, Math.min(max, n));
}

function trade_ruleNumOrBlank_(v){
  if (v === "" || v === null || v === undefined) return "";
  const n = trade_parseNumberLoose_(v);
  return Number.isFinite(n) ? n : "";
}

function trade_hasFiniteNumber_(v){
  if (v === "" || v === null || v === undefined) return false;
  const n = Number(v);
  return Number.isFinite(n);
}

function trade_store_normalizeMerchant_(merchant, fallbackId){
  const allowedIds = Array.from(new Set([
    ...(Array.isArray(merchant && merchant.allowedIds) ? merchant.allowedIds : []),
    ...trade_splitAllowed_(merchant && merchant.allowed)
  ].map(x => String(x || "").trim()).filter(Boolean)));

  const id = String((merchant && merchant.id) || fallbackId || "").trim();
  const statusRaw = String((merchant && merchant.status) || "CLOSED").trim().toUpperCase();

  return {
    id,
    name: String((merchant && merchant.name) || id || "Nouveau marchand").trim(),
    status: statusRaw === "OPEN" ? "OPEN" : "CLOSED",
    allowedIds,
    allowed: allowedIds.join(","),
    modGlobal: trade_numOrDefault_(merchant && merchant.modGlobal, 0),
    ntMax: trade_clampInt_(merchant && merchant.ntMax, 1, TRADE_MAX_NT, TRADE_MAX_NT),
    nivMax: trade_clampInt_(merchant && merchant.nivMax, 1, TRADE_MAX_NIV, TRADE_DEFAULT_NIV_MAX),
    genMax: trade_clampInt_(merchant && merchant.genMax, 1, TRADE_MAX_GEN, TRADE_MAX_GEN),
    dispoMin: trade_ruleNumOrBlank_(merchant && merchant.dispoMin),
    cDevice: trade_numOrDefault_(merchant && merchant.cDevice, 0)
  };
}

function trade_store_normalizeRule_(r){
  const modeRaw = String((r && r.mode) || "INCLUDE").trim().toUpperCase();
  let mode = "INCLUDE";
  if (modeRaw === "EXCLUDE") mode = "EXCLUDE";
  else if (modeRaw === "PARAM" || modeRaw === "OVERRIDE") mode = "PARAM";

  const levelRaw = String((r && r.level) || "FAM").trim().toUpperCase();
  const level = (levelRaw === "ITEM" || levelRaw === "CAT") ? levelRaw : "FAM";

  return {
    mode,
    level,
    fam: String((r && r.fam) || "").trim(),
    cat: String((r && r.cat) || "").trim(),
    name: String((r && r.name) || "").trim(),
    modPct: trade_ruleNumOrBlank_(r && r.modPct),
    ntMax: trade_ruleNumOrBlank_(r && r.ntMax),
    nivMax: trade_ruleNumOrBlank_(r && r.nivMax),
    genMax: trade_ruleNumOrBlank_(r && r.genMax),
    sellNT: trade_ruleNumOrBlank_(r && r.sellNT),
    sellNiv: trade_ruleNumOrBlank_(r && r.sellNiv),
    sellGen: trade_ruleNumOrBlank_(r && r.sellGen),
    sellLoc: trade_ruleNumOrBlank_(r && r.sellLoc),
    dispoMin: trade_ruleNumOrBlank_(r && r.dispoMin)
  };
}

function trade_store_normalizeRules_(rules){
  const arr = Array.isArray(rules) ? rules : [];
  const map = new Map();

  for (const raw of arr){
    const r = trade_store_normalizeRule_(raw);
    const key = [r.mode, r.level, r.fam, r.cat, r.name].join("Ãƒâ€šÃ‚Â§");
    map.set(key, r);
  }

  return Array.from(map.values());
}

function trade_store_makePayload_(merchant, rules){
  const m = trade_store_normalizeMerchant_(merchant);
  if (!m.id) throw new Error("merchant.id manquant");

  return {
    version: 1,
    merchant: {
      id: m.id,
      name: m.name,
      status: m.status,
      allowedIds: m.allowedIds,
      modGlobal: m.modGlobal,
      ntMax: m.ntMax,
      nivMax: m.nivMax,
      genMax: m.genMax,
      dispoMin: m.dispoMin,
      cDevice: m.cDevice
    },
    rules: trade_store_normalizeRules_(rules)
  };
}

function trade_store_parsePayload_(raw, fallbackId){
  const s = String(raw || "").trim();
  if (!s) throw new Error("Payload marchand vide.");

  let obj;
  try{ obj = JSON.parse(s); } catch(e){ throw new Error("JSON marchand invalide: " + String(e && e.message ? e.message : e)); }
  if (!obj || typeof obj !== "object") throw new Error("Payload marchand invalide.");

  const m = trade_store_normalizeMerchant_(obj.merchant || {}, fallbackId);
  const rules = trade_store_normalizeRules_(obj.rules);

  return {
    version: trade_numOrDefault_(obj.version, 1),
    merchant: {
      id: m.id,
      name: m.name,
      status: m.status,
      allowedIds: m.allowedIds,
      modGlobal: m.modGlobal,
      ntMax: m.ntMax,
      nivMax: m.nivMax,
      genMax: m.genMax,
      dispoMin: m.dispoMin,
      cDevice: m.cDevice
    },
    rules
  };
}

function trade_store_summaryFromPayload_(payload, updatedAt){
  const m = trade_store_normalizeMerchant_(payload && payload.merchant);
  return {
    id: m.id,
    name: m.name,
    status: m.status,
    allowed: m.allowed,
    modGlobal: m.modGlobal,
    ntMax: m.ntMax,
    nivMax: m.nivMax,
    genMax: m.genMax,
    dispoMin: m.dispoMin,
    cDevice: m.cDevice,
    updatedAt: String(updatedAt || "").trim()
  };
}

function trade_store_rowValues_(payload, updatedAt){
  const m = trade_store_normalizeMerchant_(payload && payload.merchant);
  return [[
    m.id,
    m.name,
    m.status,
    m.allowed,
    updatedAt || new Date(),
    JSON.stringify(payload)
  ]];
}

function trade_store_findMerchantRow_(mid, merchantId){
  merchantId = String(merchantId || "").trim();
  if (!merchantId) return 0;

  trade_store_ensure_(mid);
  const { sh } = trade_json_openMidSheet_(mid);
  const last = trade_json_dataLastRow_(sh);
  if (last < 2) return 0;

  const ids = sh.getRange(2, TRADE_JSON_COL.id, last - 1, 1).getDisplayValues();
  for (let i = 0; i < ids.length; i++){
    if (String(ids[i][0] || "").trim() === merchantId) return i + 2;
  }
  return 0;
}

function trade_json_findMerchantRow_(mid, merchantId){ return trade_store_findMerchantRow_(mid, merchantId); }

/* ============================================================
   MARCHANDS ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â CRUD
============================================================ */

function trade_listMerchants_(mid){
  trade_store_ensure_(mid);
  const { sh } = trade_json_openMidSheet_(mid);

  const last = trade_json_dataLastRow_(sh);
  if (last < 2) return [];

  const rows = sh.getRange(2, 1, last - 1, TRADE_JSON_HEADERS.length).getDisplayValues();
  const out = [];

  for (const row of rows){
    const id = String(row[TRADE_JSON_COL.id - 1] || "").trim();
    if (!id) continue;

    const name = String(row[TRADE_JSON_COL.name - 1] || "").trim();
    const status = String(row[TRADE_JSON_COL.status - 1] || "").trim().toUpperCase() || "CLOSED";
    const allowed = String(row[TRADE_JSON_COL.allowed - 1] || "").trim();
    const updatedAt = String(row[TRADE_JSON_COL.updatedAt - 1] || "").trim();
    const raw = String(row[TRADE_JSON_COL.payload - 1] || "").trim();

    let summary = {
      id,
      name: name || id,
      status: status === "OPEN" ? "OPEN" : "CLOSED",
      allowed,
      modGlobal: 0,
      ntMax: TRADE_MAX_NT,
      nivMax: TRADE_DEFAULT_NIV_MAX,
      genMax: TRADE_MAX_GEN,
      dispoMin: "",
      cDevice: 0,
      updatedAt
    };

    if (raw){
      try{
        const payload = trade_store_parsePayload_(raw, id);
        summary = trade_store_summaryFromPayload_(payload, updatedAt);
      }catch(_){}
    }

    out.push(summary);
  }

  return out;
}

function trade_getMerchant_(mid, merchantId){
  trade_store_ensure_(mid);
  const { sh } = trade_json_openMidSheet_(mid);

  const row = trade_store_findMerchantRow_(mid, merchantId);
  if (!row) throw new Error("Marchand introuvable: " + merchantId);

  const vals = sh.getRange(row, 1, 1, TRADE_JSON_HEADERS.length).getDisplayValues()[0];
  const id = String(vals[TRADE_JSON_COL.id - 1] || "").trim();
  const name = String(vals[TRADE_JSON_COL.name - 1] || "").trim();
  const status = String(vals[TRADE_JSON_COL.status - 1] || "").trim().toUpperCase() || "CLOSED";
  const allowed = String(vals[TRADE_JSON_COL.allowed - 1] || "").trim();
  const updatedAt = String(vals[TRADE_JSON_COL.updatedAt - 1] || "").trim();
  const raw = String(vals[TRADE_JSON_COL.payload - 1] || "").trim();

  if (!raw){
    const m = trade_store_normalizeMerchant_({
      id,
      name: name || id,
      status,
      allowed,
      modGlobal: 0,
      ntMax: TRADE_MAX_NT,
      nivMax: TRADE_DEFAULT_NIV_MAX,
      genMax: TRADE_MAX_GEN,
      dispoMin: "",
      cDevice: 0
    }, id);
    return Object.assign({}, m, { updatedAt });
  }

  const payload = trade_store_parsePayload_(raw, id);
  const summary = trade_store_summaryFromPayload_(payload, updatedAt);

  return {
    id: summary.id,
    name: summary.name,
    status: summary.status,
    allowed: summary.allowed,
    modGlobal: summary.modGlobal,
    ntMax: summary.ntMax,
    nivMax: summary.nivMax,
    genMax: summary.genMax,
    dispoMin: summary.dispoMin,
    cDevice: summary.cDevice,
    updatedAt: summary.updatedAt
  };
}

function trade_listRules_(mid, merchantId){
  trade_store_ensure_(mid);
  const { sh } = trade_json_openMidSheet_(mid);

  const row = trade_store_findMerchantRow_(mid, merchantId);
  if (!row) return [];

  const raw = String(sh.getRange(row, TRADE_JSON_COL.payload, 1, 1).getDisplayValue() || "").trim();
  if (!raw) return [];

  const payload = trade_store_parsePayload_(raw, merchantId);
  return (payload.rules || []).map(r => Object.assign({ merchantId: String(merchantId) }, r));
}

function trade_json_createMerchant_(mid, name){
  trade_store_ensure_(mid);
  const { sh } = trade_json_openMidSheet_(mid);

  const id = "m_" + Utilities.getUuid().replace(/-/g, "").slice(0, 10);
  const payload = trade_store_makePayload_({
    id,
    name: String(name || "Nouveau marchand").trim() || "Nouveau marchand",
    status: "CLOSED",
    allowed: "",
    modGlobal: 0,
    ntMax: TRADE_MAX_NT,
    nivMax: TRADE_DEFAULT_NIV_MAX,
    genMax: TRADE_MAX_GEN,
    dispoMin: "",
    cDevice: 0
  }, []);

  const row = trade_json_dataLastRow_(sh) + 1;
  sh.getRange(row, 1, 1, TRADE_JSON_HEADERS.length).setValues(trade_store_rowValues_(payload, new Date()));

  return { ok: true, id, merchant: trade_store_summaryFromPayload_(payload, "") };
}

function trade_json_deleteMerchant_(mid, merchantId){
  trade_store_ensure_(mid);
  const { sh } = trade_json_openMidSheet_(mid);

  const row = trade_store_findMerchantRow_(mid, merchantId);
  if (!row) return { ok: true };

  sh.deleteRow(row);
  return { ok: true };
}

function trade_json_upsertMerchant_(mid, payloadMerchant, rules){
  trade_store_ensure_(mid);
  const { sh } = trade_json_openMidSheet_(mid);

  const payload = trade_store_makePayload_(payloadMerchant, rules);
  const merchantId = String(payload.merchant.id || "").trim();
  if (!merchantId) throw new Error("merchant.id manquant");

  let row = trade_store_findMerchantRow_(mid, merchantId);
  if (!row) row = trade_json_dataLastRow_(sh) + 1;

  sh.getRange(row, 1, 1, TRADE_JSON_HEADERS.length).setValues(trade_store_rowValues_(payload, new Date()));

  return { ok: true, row, merchant: trade_store_summaryFromPayload_(payload, "") };
}

/* ============================================================
   Cache / BDD Equipements
============================================================ */

function trade_cache_(){ return CacheService.getScriptCache(); }

function trade_cacheGetLarge_(key){
  const cache = trade_cache_();
  const metaRaw = cache.get(key + "_meta");
  if (metaRaw){
    try{
      const meta = JSON.parse(metaRaw);
      const n = Number(meta && meta.parts || 0);
      if (!n) return null;
      let s = "";
      for (let i = 1; i <= n; i++){
        const part = cache.get(`${key}_p${i}`);
        if (part === null) return null;
        s += part;
      }
      return s;
    }catch(_){ return null; }
  }
  return cache.get(key);
}

function trade_cachePutLarge_(key, value, ttlSec){
  const cache = trade_cache_();
  const MAX = 90000;
  const s = String(value || "");

  try{
    const oldMeta = cache.get(key + "_meta");
    if (oldMeta){
      const m = JSON.parse(oldMeta);
      const oldParts = Number(m && m.parts || 0);
      if (oldParts > 0){
        const rm = [];
        for (let i = 1; i <= oldParts; i++) rm.push(`${key}_p${i}`);
        rm.push(key + "_meta");
        cache.removeAll(rm);
      }
    }
  }catch(_){}

  if (s.length <= MAX){
    cache.put(key, s, ttlSec);
    cache.put(key + "_meta", "", 1);
    return;
  }

  const parts = [];
  for (let i = 0; i < s.length; i += MAX) parts.push(s.slice(i, i + MAX));

  cache.put(key + "_meta", JSON.stringify({ parts: parts.length }), ttlSec);
  for (let i = 0; i < parts.length; i++){
    cache.put(`${key}_p${i + 1}`, parts[i], ttlSec);
  }
}

function trade_cacheRemoveLarge_(key){
  const cache = trade_cache_();
  const rm = [key, key + "_meta"];

  try{
    const metaRaw = cache.get(key + "_meta");
    if (metaRaw){
      const meta = JSON.parse(metaRaw);
      const n = Number(meta && meta.parts || 0);
      for (let i = 1; i <= n; i++) rm.push(`${key}_p${i}`);
    }
  }catch(_){}

  cache.removeAll(rm);
}

function trade_loadEquipements_(){
  const key = "TRADE_EQUIP_V7_NAMED_RANGES";
  const cached = trade_cacheGetLarge_(key);

  if (cached){
    try{
      const data = JSON.parse(cached);
      const rows = Array.isArray(data && data.rows) ? data.rows : [];
      const byKey = {};
      for (const r of rows){
        if (r && r.key) byKey[r.key] = r;
      }
      return { rows, byKey };
    }catch(_){}
  }

  const bdd = trade_openById_(BDD_POLARIS_ID);

  const full = {
    fam:    trade_getNamedRangeOrThrow_(bdd, TRADE_NR_EQUIP.fam, "EquipFam"),
    cat:    trade_getNamedRangeOrThrow_(bdd, TRADE_NR_EQUIP.cat, "EquipCAT"),
    name:   trade_getNamedRangeOrThrow_(bdd, TRADE_NR_EQUIP.name, "EquipNom"),
    desc:   trade_getNamedRangeOrThrow_(bdd, TRADE_NR_EQUIP.desc, "EquipDescription"),
    price:  trade_getNamedRangeOrThrow_(bdd, TRADE_NR_EQUIP.price, "EquipPrix"),
    wgt:    trade_getNamedRangeOrThrow_(bdd, TRADE_NR_EQUIP.wgt, "EquipPoids"),
    nt:          trade_getNamedRangeOrThrow_(bdd, TRADE_NR_EQUIP.nt, "EquipNT"),
    nivMax:      trade_getNamedRangeOrThrow_(bdd, TRADE_NR_EQUIP.statModMax, "EquipStatModMax"),
    dispo:       trade_getNamedRangeOrThrow_(bdd, TRADE_NR_EQUIP.dispo, "EquipDispo"),
  };

  const aligned = trade_assertAlignedNamedRanges_(full, "catalogue ÃƒÆ’Ã‚Â©quipement");
  const numRows = aligned.numRows;

  const famVals    = full.fam.getDisplayValues();
  const catVals    = full.cat.getDisplayValues();
  const nameVals   = full.name.getDisplayValues();
  const descVals   = full.desc.getDisplayValues();
  const priceVals  = full.price.getDisplayValues();
  const wgtVals    = full.wgt.getDisplayValues();
  const ntVals     = full.nt.getDisplayValues();
  const nivMaxVals = full.nivMax.getDisplayValues();
  const dispoVals      = full.dispo.getDisplayValues();
  const fabricantVals  = trade_optValVals_(bdd, TRADE_NR_EQUIP.fabricant,   numRows);
  const nationVals     = trade_optValVals_(bdd, TRADE_NR_EQUIP.nation,      numRows);
  const armeDomVals    = trade_optValVals_(bdd, TRADE_NR_EQUIP.armeDom,     numRows);
  const armeChocVals   = trade_optValVals_(bdd, TRADE_NR_EQUIP.armeChoc,    numRows);
  const armePorteeVals = trade_optValVals_(bdd, TRADE_NR_EQUIP.armePortee,  numRows);
  const armeFORVals    = trade_optValVals_(bdd, TRADE_NR_EQUIP.armeFOR,     numRows);
  const armeINIVals    = trade_optValVals_(bdd, TRADE_NR_EQUIP.armeINI,     numRows);
  const armeModeTirVals= trade_optValVals_(bdd, TRADE_NR_EQUIP.armeModeTir, numRows);
  const armeMunVals    = trade_optValVals_(bdd, TRADE_NR_EQUIP.armeMun,     numRows);
  const armeCALVals    = trade_optValVals_(bdd, TRADE_NR_EQUIP.armeCAL,     numRows);
  const armureProtVals = trade_optValVals_(bdd, TRADE_NR_EQUIP.armureProt,  numRows);
  const armureChocVals = trade_optValVals_(bdd, TRADE_NR_EQUIP.armureChoc,  numRows);
  const armureLocVals  = trade_optValVals_(bdd, TRADE_NR_EQUIP.armureLoc,   numRows);
  const armureMalVals  = trade_optValVals_(bdd, TRADE_NR_EQUIP.armureMal,   numRows);
  const objContVals    = trade_optValVals_(bdd, TRADE_NR_EQUIP.objCont,     numRows);
  const objEtancheVals = trade_optValVals_(bdd, TRADE_NR_EQUIP.objEtanche,  numRows);

  const rawRows = [];
  for (let i = 0; i < numRows; i++){
    rawRows.push({
      fam:       String(famVals[i][0] || "").trim(),
      cat:       String(catVals[i][0] || "").trim(),
      name:      String(nameVals[i][0] || "").trim(),
      desc:      String(descVals[i][0] || "").trim(),
      priceRaw:  String(priceVals[i][0] || "").trim(),
      weightRaw: String(wgtVals[i][0] || "").trim(),
      ntRaw:     String(ntVals[i][0] || "").trim(),
      nivMaxRaw: String(nivMaxVals[i][0] || "").trim(),
      dispoRaw:       String(dispoVals[i][0] || "").trim(),
      fabricantRaw:   trade_optVal_(fabricantVals,   i),
      nationRaw:      trade_optVal_(nationVals,      i),
      armeDomRaw:     trade_optVal_(armeDomVals,     i),
      armeChocRaw:    trade_optVal_(armeChocVals,    i),
      armePorteeRaw:  trade_optVal_(armePorteeVals,  i),
      armeFORRaw:     trade_optVal_(armeFORVals,     i),
      armeINIRaw:     trade_optVal_(armeINIVals,     i),
      armeModeTirRaw: trade_optVal_(armeModeTirVals, i),
      armeMunRaw:     trade_optVal_(armeMunVals,     i),
      armeCALRaw:     trade_optVal_(armeCALVals,     i),
      armureProtRaw:  trade_optVal_(armureProtVals,  i),
      armureChocRaw:  trade_optVal_(armureChocVals,  i),
      armureLocRaw:   trade_optVal_(armureLocVals,   i),
      armureMalRaw:   trade_optVal_(armureMalVals,   i),
      objContRaw:     trade_optVal_(objContVals,     i),
      objEtancheRaw:  trade_optVal_(objEtancheVals,  i),
      rowNum:         full.name.getRow() + i
    });
  }

  let startIdx = 0;
  if (rawRows.length && trade_catalogLooksLikeHeaderRow_(rawRows[0])) startIdx = 1;

  const rows = [];
  const byKey = {};

  for (let i = startIdx; i < rawRows.length; i++){
    const r = rawRows[i];
    const fam = String(r.fam || "").trim();
    const cat = String(r.cat || "").trim();
    const name = String(r.name || "").trim();
    if (!fam && !cat && !name) continue;

    const item = {
      fam,
      cat,
      name,
      desc: String(r.desc || "").trim(),
      priceRaw: String(r.priceRaw || "").trim(),
      weightRaw: String(r.weightRaw || "").trim(),
      ntRaw: String(r.ntRaw || "").trim(),
      nivMaxRaw: String(r.nivMaxRaw || "").trim(),
      dispo:       String(r.dispoRaw || "").trim(),
      fabricant:   String(r.fabricantRaw || "").trim(),
      nation:      String(r.nationRaw || "").trim(),
      armeDom:     String(r.armeDomRaw || "").trim(),
      armeChoc:    String(r.armeChocRaw || "").trim(),
      armePortee:  String(r.armePorteeRaw || "").trim(),
      armeFOR:     String(r.armeFORRaw || "").trim(),
      armeINI:     String(r.armeINIRaw || "").trim(),
      armeModeTir: String(r.armeModeTirRaw || "").trim(),
      armeMun:     String(r.armeMunRaw || "").trim(),
      armeCAL:     String(r.armeCALRaw || "").trim(),
      armureProt:  String(r.armureProtRaw || "").trim(),
      armureChoc:  String(r.armureChocRaw || "").trim(),
      armureLoc:   String(r.armureLocRaw || "").trim(),
      armureMal:   String(r.armureMalRaw || "").trim(),
      objCont:     String(r.objContRaw || "").trim(),
      objEtanche:  String(r.objEtancheRaw || "").trim(),
      rowNum:      Number(r.rowNum || 0)
    };

    item.nt = trade_parseNTCell_(item.ntRaw);
    item.nivMax = trade_parseNumberLoose_(item.nivMaxRaw);
    if (!Number.isFinite(item.nivMax)) item.nivMax = NaN;
    item.key = trade_normKey_(fam, cat, name);

    rows.push(item);
    byKey[item.key] = item;
  }

  try{ trade_cachePutLarge_(key, JSON.stringify({ rows }), 6 * 3600); }catch(_){}
  return { rows, byKey };
}

function trade_fetchDescriptionsByKeys_(keys){
  const uniq = Array.from(new Set((keys || []).map(String))).filter(Boolean);
  if (!uniq.length) return {};
  const eq = trade_loadEquipements_();
  const out = {};
  for (const k of uniq){
    const it = eq.byKey[k];
    out[k] = String(it && it.desc || "").trim();
  }
  return out;
}

/* ============================================================
   Catalogue MJ (equipRef)
============================================================ */

function trade_mj_exprInfo_(raw){
  const fixed = trade_parseNumberLoose_(raw);
  if (isFinite(fixed)){
    return { isFixed:true, expr:String(fixed), needsNT:false, needsNiv:false, needsGen:false, needsLoc:false };
  }

  let expr = "";
  try{ expr = trade_normalizeExpr_(raw); }catch(_){ expr = String(raw || ""); }

  const hasToken = (token) => {
    try{ return trade_exprNeeds_(expr, token); }
    catch(_){ return new RegExp(`\\b${token}\\b`, "i").test(String(raw || "")); }
  };

  return {
    isFixed:false,
    expr,
    needsNT:hasToken("NT"),
    needsNiv:hasToken("niv"),
    needsGen:hasToken("gen"),
    needsLoc:hasToken("loc")
  };
}

function trade_mj_itemToEquipRef_(item){
  const fam = String(item && item.fam || "").trim();
  const cat = String(item && item.cat || "").trim();
  const name = String(item && item.name || "").trim();
  const key = String(item && item.key || "").trim();

  const priceRaw = String(item && item.priceRaw || "").trim();
  const ntRaw = String(item && item.ntRaw || "").trim();
  const nivMaxRaw = String(item && item.nivMaxRaw || "").trim();

  const nt = item && item.nt ? item.nt : trade_parseNTCell_(ntRaw);
  const priceInfo = trade_mj_exprInfo_(priceRaw);
  const isComputer = !!trade_detectComputerType_(fam, cat, name);

  let ntKind = "none";
  let ntFixed = "";
  let ntRangeMin = "";
  let ntRangeMax = "";

  if (nt && nt.kind === "fixed"){
    ntKind = "fixed";
    ntFixed = Number(nt.min || 0) || "";
  } else if (nt && nt.kind === "range"){
    ntKind = "range";
    ntRangeMin = Number(nt.min || 0) || "";
    ntRangeMax = Number(nt.max || 0) || "";
  }

  const needsNT = (ntKind === "range") && (priceInfo.needsNT || isComputer);
  const needsNiv = !!priceInfo.needsNiv;
  const needsGen = !!priceInfo.needsGen || isComputer;

  return {
    fam, cat, name, key,
    priceRaw, ntRaw, nivMaxRaw,
    dispo: String(item && item.dispo || "").trim(),
    rowNum: Number(item && item.rowNum || 0) || 0,
    ntKind, ntFixed, ntRangeMin, ntRangeMax,
    needsNT, needsNiv, needsGen, needsLoc: !!priceInfo.needsLoc,
    isComputer
  };
}

function trade_mj_loadEquipRef_(){
  const eq = trade_loadEquipements_();
  const rows = Array.isArray(eq && eq.rows) ? eq.rows : [];

  const out = rows
    .filter(it => !!(String(it && it.fam || "").trim() || String(it && it.cat || "").trim() || String(it && it.name || "").trim()))
    .map(trade_mj_itemToEquipRef_);

  out.sort((a,b) => {
    if (String(a.fam || "") !== String(b.fam || "")) return String(a.fam || "").localeCompare(String(b.fam || ""));
    if (String(a.cat || "") !== String(b.cat || "")) return String(a.cat || "").localeCompare(String(b.cat || ""));
    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  return out;
}

/* ============================================================
   Expressions prix/poids
============================================================ */

function trade_normalizeExpr_(raw){
  let s = String(raw || "").trim();
  if (!s) return "";
  // Traiter tout ce qui n'est que tirets/placeholders comme vide
  if (/^[Ã¢â‚¬â€Ã¢â‚¬â€œÃ¢â‚¬â€™Ã¢â‚¬â€¢Ã‚Â­-]+$/.test(s)) return "";

  s = s.replace(/\u00A0/g, " ");
  s = s.replace(/(\d)\s+(\d)/g, "$1$2");
  s = s.replace(/,/g, ".");
  s = s.replace(/\bkg\b/ig, "");
  s = s.replace(/\bsols?\b/ig, "");
  s = s.replace(/(\d+(?:\.\d+)?)\s*%\s*du\s*prix\s*de\s*l[ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢']appareil/ig, "($1/100)*C");
  s = s.replace(/prix\s*de\s*l[ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢']appareil/ig, "C");
  s = s.replace(/NT\s*[xÃƒÆ’Ã¢â‚¬â€]\s*NT/ig, "NT*NT");
  s = s.replace(/niv\s*[xÃƒÆ’Ã¢â‚¬â€]\s*niv/ig, "niv*niv");
  s = s.replace(/gen\s*[xÃƒÆ’Ã¢â‚¬â€]\s*NT/ig, "gen*NT");
  s = s.replace(/NT\s*[xÃƒÆ’Ã¢â‚¬â€]\s*gen/ig, "NT*gen");
  s = s.replace(/[ÃƒÆ’Ã¢â‚¬â€]/g, "*");
  s = s.replace(/(\d|\)|[A-Za-z_])\s*[xX]\s*(\d|\(|[A-Za-z_])/g, "$1*$2");
  s = s.replace(/\s+/g, "");

  const stripped = s.replace(/NT|niv|gen|loc|C/ig, "");
  if (/[^0-9.+\-*/()]/.test(stripped)) throw new Error("Expression invalide: " + raw);
  return s;
}

function trade_evalExpr_(expr, vars){
  if (!expr) return NaN;
  const f = new Function("NT", "niv", "gen", "loc", "C", `"use strict"; return (${expr});`);
  const v = Number(f(vars.NT, vars.niv, vars.gen, vars.loc, vars.C));
  return Number.isFinite(v) ? v : NaN;
}

function trade_exprNeeds_(expr, token){
  if (!expr) return false;
  return new RegExp(`\\b${token}\\b`, "i").test(expr);
}

function trade_parsePercentRatio_(raw){
  const s = String(raw || "").trim();
  if (!s) return NaN;
  const m = s.match(/(-?\d+(?:[.,]\d+)?)\s*%/);
  if (!m) return NaN;
  const v = trade_parseNumberLoose_(m[1]);
  return Number.isFinite(v) ? (v / 100) : NaN;
}

/* ============================================================
   Inclusion / exclusion
============================================================ */

function trade_itemIsIncluded_(rules, item){
  const fam = item.fam, cat = item.cat, name = item.name;
  const includes = rules.filter(r => String(r.mode || "").toUpperCase() === "INCLUDE");
  if (!includes.length) return false;

  return includes.some(r => {
    const L = String(r.level || "").toUpperCase();
    if (L === "FAM")  return r.fam === fam;
    if (L === "CAT")  return r.fam === fam && r.cat === cat;
    if (L === "ITEM") return r.fam === fam && r.cat === cat && r.name === name;
    return false;
  });
}

function trade_itemIsExcluded_(rules, item, merchant){
  const fam = item.fam, cat = item.cat, name = item.name;
  const modeOf = (r) => String(r.mode || "").toUpperCase();
  const levOf  = (r) => String(r.level || "").toUpperCase();

  const hasIncludeItem = rules.some(r => modeOf(r) === "INCLUDE" && levOf(r) === "ITEM" && r.fam === fam && r.cat === cat && r.name === name);
  const hasIncludeCat = rules.some(r => modeOf(r) === "INCLUDE" && levOf(r) === "CAT" && r.fam === fam && r.cat === cat);

  if (rules.some(r => modeOf(r) === "EXCLUDE" && levOf(r) === "ITEM" && r.fam === fam && r.cat === cat && r.name === name)) return true;

  const exCat = rules.some(r => modeOf(r) === "EXCLUDE" && levOf(r) === "CAT" && r.fam === fam && r.cat === cat);
  if (exCat && !hasIncludeItem) return true;

  const exFam = rules.some(r => modeOf(r) === "EXCLUDE" && levOf(r) === "FAM" && r.fam === fam);
  if (exFam && !(hasIncludeCat || hasIncludeItem)) return true;

  // Exclure si la dispo de l'item est infÃƒÂ©rieure au seuil minimum de la rÃƒÂ¨gle la plus restrictive
  const dispoRules = rules.filter(r => {
    const M = String(r.mode||'').toUpperCase();
    const L = String(r.level||'').toUpperCase();
    if (!(M === 'INCLUDE' || M === 'PARAM')) return false;
    if (!trade_hasFiniteNumber_(r.dispoMin)) return false;
    if (L === 'FAM') return String(r.fam||'') === fam;
    if (L === 'CAT') return String(r.fam||'') === fam && String(r.cat||'') === cat;
    if (L === 'ITEM') return String(r.fam||'') === fam && String(r.cat||'') === cat && String(r.name||'') === name;
    return false;
  });
  const merchantDispoMin = trade_hasFiniteNumber_(merchant && merchant.dispoMin)
    ? Number(merchant.dispoMin)
    : NaN;

  if (dispoRules.length > 0 || Number.isFinite(merchantDispoMin)){
    const thresholds = dispoRules.map(r => Number(r.dispoMin)).filter(Number.isFinite);
    if (Number.isFinite(merchantDispoMin)) thresholds.push(merchantDispoMin);
    const minThreshold = thresholds.length ? Math.max(...thresholds) : NaN;
    const itemDispo = String(item.dispo || '').trim();
    const itemDispoN = itemDispo ? (() => { const m = itemDispo.match(/-?\d+/); return m ? Number(m[0]) : null; })() : null;
    const effectiveDispo = (itemDispoN !== null) ? itemDispoN : 999;
    if (Number.isFinite(minThreshold) && effectiveDispo < minThreshold) return true;
  }
  return false;
}

/* ============================================================
   RÃƒÆ’Ã‚Â¨gles effectives
============================================================ */

function trade_mergeRuleFields_(paramRule, includeRule){
  const out = { modPct:"", ntMax:"", nivMax:"", genMax:"", sellNT:"", sellNiv:"", sellGen:"", sellLoc:"", dispoMin:"" };
  const apply = (r) => {
    if (!r) return;
    Object.keys(out).forEach(k => {
      if (r[k] !== "" && r[k] != null) out[k] = r[k];
    });
  };
  apply(paramRule);
  apply(includeRule);
  return out;
}

function trade_findMergedRuleAtLevel_(rules, level, fam, cat, name){
  const match = (r) => {
    const L = String(r.level || "").toUpperCase();
    const M = String(r.mode || "").toUpperCase();
    if (!(M === "INCLUDE" || M === "PARAM")) return false;
    if (L !== level) return false;
    if (level === "FAM") return r.fam === fam;
    if (level === "CAT") return r.fam === fam && r.cat === cat;
    return r.fam === fam && r.cat === cat && r.name === name;
  };

  const levelRules = rules.filter(match);
  const paramRule = levelRules.find(r => String(r.mode || "").toUpperCase() === "PARAM") || null;
  const includeRule = levelRules.find(r => String(r.mode || "").toUpperCase() === "INCLUDE") || null;

  return trade_mergeRuleFields_(paramRule, includeRule);
}

function trade_effectiveRule_(merchant, rules, item){
  const fam = item.fam, cat = item.cat, name = item.name;

  const rItem = trade_findMergedRuleAtLevel_(rules, "ITEM", fam, cat, name);
  const rCat  = trade_findMergedRuleAtLevel_(rules, "CAT", fam, cat, name);
  const rFam  = trade_findMergedRuleAtLevel_(rules, "FAM", fam, cat, name);

  const eff = { modPct:NaN, ntMax:NaN, nivMax:NaN, genMax:NaN, sellNT:NaN, sellNiv:NaN, sellGen:NaN, sellLoc:NaN, dispoMin:NaN };

  const assign = (r) => {
    if (!r) return;
    if (trade_hasFiniteNumber_(r.modPct))  eff.modPct  = Number(r.modPct);
    if (trade_hasFiniteNumber_(r.ntMax))   eff.ntMax   = Number(r.ntMax);
    if (trade_hasFiniteNumber_(r.nivMax))  eff.nivMax  = Number(r.nivMax);
    if (trade_hasFiniteNumber_(r.genMax))  eff.genMax  = Number(r.genMax);
    if (trade_hasFiniteNumber_(r.sellNT))   eff.sellNT   = Number(r.sellNT);
    if (trade_hasFiniteNumber_(r.sellNiv))  eff.sellNiv  = Number(r.sellNiv);
    if (trade_hasFiniteNumber_(r.sellGen))  eff.sellGen  = Number(r.sellGen);
    if (trade_hasFiniteNumber_(r.sellLoc))  eff.sellLoc  = Number(r.sellLoc);
    if (trade_hasFiniteNumber_(r.dispoMin)) eff.dispoMin = Number(r.dispoMin);
  };

  assign(rItem); assign(rCat); assign(rFam);

  if (!Number.isFinite(eff.modPct)) eff.modPct = trade_numOrDefault_(merchant.modGlobal, 0);
  if (!Number.isFinite(eff.ntMax))  eff.ntMax  = trade_clampInt_(merchant.ntMax, 1, TRADE_MAX_NT, TRADE_MAX_NT);
  if (!Number.isFinite(eff.nivMax)) eff.nivMax = trade_clampInt_(merchant.nivMax, 1, TRADE_MAX_NIV, TRADE_DEFAULT_NIV_MAX);
  if (!Number.isFinite(eff.genMax)) eff.genMax = trade_clampInt_(merchant.genMax, 1, TRADE_MAX_GEN, TRADE_MAX_GEN);
  if (!Number.isFinite(eff.dispoMin) && trade_hasFiniteNumber_(merchant && merchant.dispoMin)) eff.dispoMin = Number(merchant.dispoMin);

  eff.ntMax  = Math.max(1, Math.min(TRADE_MAX_NT, Math.floor(eff.ntMax)));
  eff.nivMax = Math.max(1, Math.min(TRADE_MAX_NIV, Math.floor(eff.nivMax)));
  eff.genMax = Math.max(1, Math.min(TRADE_MAX_GEN, Math.floor(eff.genMax)));

  return eff;
}

function trade_buildOptions_(merchant, rules, item){
  const eff = trade_effectiveRule_(merchant, rules, item);

  const priceExpr = (() => {
    const raw = String(item.priceRaw || "").trim().replace(/^[Ã¢â‚¬â€Ã¢â‚¬â€œ\-]+$/, "");
    if (!raw) return "";
    const n = trade_parseNumberLoose_(raw);
    if (Number.isFinite(n)) return String(n);
    return trade_normalizeExpr_(raw);
  })();

  const weightExpr = (() => {
    const raw = String(item.weightRaw || "").trim().replace(/^[Ã¢â‚¬â€Ã¢â‚¬â€œ\-]+$/, "");
    if (!raw) return "";
    const n = trade_parseNumberLoose_(raw);
    if (Number.isFinite(n)) return String(n);
    return trade_normalizeExpr_(raw);
  })();

  const needsNTExpr  = trade_exprNeeds_(priceExpr, "NT");
  const needsNivExpr = trade_exprNeeds_(priceExpr, "niv");
  const needsGenExpr = trade_exprNeeds_(priceExpr, "gen");
  const needsLocExpr = trade_exprNeeds_(priceExpr, "loc");

  const ctype = trade_isComputerCat_(item.cat) ? trade_detectComputerType_(item.fam, item.cat, item.name) : null;
  const isComputer = !!ctype;

  const ntMode = (item.nt && (item.nt.kind === "fixed" || item.nt.kind === "range")) ? item.nt.kind : "none";
  let ntList = [], ntFixed = 0, blocked = false, blockReason = "";

  if (ntMode === "fixed"){
    ntFixed = Number(item.nt.min || 0);
  } else if (ntMode === "range"){
    const min = Number(item.nt.min || 0);
    const hardMax = Number(item.nt.max || 0);
    let max = Math.min(hardMax, eff.ntMax);

    if (!(min >= 1) || !(hardMax >= 1) || hardMax < min){
      blocked = true;
      blockReason = "Aucune valeur NT dispo (fourchette invalide).";
    } else if (max < min){
      max = hardMax;
      for (let n = min; n <= max; n++) ntList.push(n);
    } else {
      for (let n = min; n <= max; n++) ntList.push(n);
    }
  }

  if (!blocked && needsNTExpr && ntMode === "none"){
    blocked = true;
    blockReason = "Prix dÃƒÆ’Ã‚Â©pend de NT mais NT absent en base.";
  }

  let nivMax = eff.nivMax;
  if (Number.isFinite(item.nivMax)) nivMax = Math.min(nivMax, Math.floor(item.nivMax));
  nivMax = Math.max(1, Math.min(TRADE_MAX_NIV, nivMax));

  let genMax = eff.genMax;
  if (isComputer && ctype && ctype.restricted){
    const constraint = Math.min(TRADE_MAX_GEN, ctype.baseMaxGenNT1 + (eff.ntMax - 1));
    genMax = Math.min(genMax, constraint);
  }
  genMax = Math.max(1, Math.min(TRADE_MAX_GEN, Math.floor(genMax)));

  const needsNT  = (ntMode === "range") && (needsNTExpr || isComputer);
  const needsGen = isComputer || needsGenExpr;

  const sell = { NT:NaN, niv:NaN, gen:NaN, loc:NaN };
  const locked = { NT:false, niv:false, gen:false, loc:false };

  if (ntMode === "range" && Number.isFinite(eff.sellNT)){
    const v0 = Math.floor(eff.sellNT);
    if (ntList.includes(v0)){
      sell.NT = v0;
      locked.NT = true;
    } else if (ntList.length){
      sell.NT = ntList[0];
      locked.NT = true;
    }
  }

  if (needsNivExpr && Number.isFinite(eff.sellNiv)){
    sell.niv = Math.max(1, Math.min(nivMax, Math.floor(eff.sellNiv)));
    locked.niv = true;
  }

  if (needsGen && Number.isFinite(eff.sellGen)){
    sell.gen = Math.max(1, Math.min(genMax, Math.floor(eff.sellGen)));
    locked.gen = true;
  }

  if (needsLocExpr && Number.isFinite(eff.sellLoc)){
    sell.loc = Math.max(1, Math.min(TRADE_MAX_LOC, Math.floor(eff.sellLoc)));
    locked.loc = true;
  }

  return {
    priceExpr, weightExpr,
    needs: { NT: needsNT, niv: needsNivExpr, gen: needsGen, loc: needsLocExpr },
    ntMode, ntFixed, ntList,
    blocked, blockReason,
    nivMax, genMax, locMax: TRADE_MAX_LOC,
    eff, isComputer, sell, locked
  };
}

/* ============================================================
   Player helpers
============================================================ */

function trade_roundMaybeWeight_(x){
  const n = Number(x);
  if (!Number.isFinite(n)) return "";
  return Math.round(n * 100) / 100;
}

function trade_player_getBalance_(fid){
  const ss = trade_openById_(fid);
  const sh = ss.getSheetByName(TRADE_PLAYER_MONEY_TAB);
  if (!sh) throw new Error(`Fiche joueur: onglet introuvable "${TRADE_PLAYER_MONEY_TAB}"`);
  return Number(sh.getRange(TRADE_PLAYER_MONEY_A1).getValue()) || 0;
}

function trade_player_getInventoryRanges_(fid){
  const ss = trade_openById_(fid);

  const full = {
    id:   trade_getNamedRangeOrThrow_(ss, TRADE_NR_INV.id,   "InventaireIDObj"),
    fam:  trade_getNamedRangeOrThrow_(ss, TRADE_NR_INV.fam,  "InventaireFamObj"),
    name: trade_getNamedRangeOrThrow_(ss, TRADE_NR_INV.name, "InventaireNomObj"),
    cat:  trade_getNamedRangeOrThrow_(ss, TRADE_NR_INV.cat,  "InventaireCATObj"),
    empl: trade_getNamedRangeOrThrow_(ss, TRADE_NR_INV.empl, "InventaireEmplObj"),
    wgt:  trade_getNamedRangeOrThrow_(ss, TRADE_NR_INV.wgt,  "InventairePoidsObj"),
    desc: trade_getNamedRangeOrThrow_(ss, TRADE_NR_INV.desc, "InventaireDescriptionObj"),
    qty:  trade_getNamedRangeOrThrow_(ss, TRADE_NR_INV.qty,  "InventaireQteObj")
  };

  const aligned = trade_assertAlignedNamedRanges_(full, "inventaire");
  if (aligned.numRows < 2){
    throw new Error("Les plages nommÃƒÆ’Ã‚Â©es inventaire doivent contenir au moins 1 ligne d'en-tÃƒÆ’Ã‚Âªte + 1 ligne de donnÃƒÆ’Ã‚Â©es.");
  }

  const dataNumRows = aligned.numRows - 1;

  return {
    ss,
    sh: aligned.sh,
    dataStartRow: aligned.row + 1,
    dataNumRows,
    data: {
      id:   full.id.offset(1, 0, dataNumRows, 1),
      fam:  full.fam.offset(1, 0, dataNumRows, 1),
      name: full.name.offset(1, 0, dataNumRows, 1),
      cat:  full.cat.offset(1, 0, dataNumRows, 1),
      empl: full.empl.offset(1, 0, dataNumRows, 1),
      wgt:  full.wgt.offset(1, 0, dataNumRows, 1),
      desc: full.desc.offset(1, 0, dataNumRows, 1),
      qty:  full.qty.offset(1, 0, dataNumRows, 1)
    }
  };
}

function trade_player_getStorageOptions_(fid){
  const inv = trade_player_getInventoryRanges_(fid);
  const emplVals = inv.data.empl.getDisplayValues();
  const list = emplVals.map(r => String(r[0] || "").trim());
  const out = trade_uniqueNonEmptyStrings_(list);
  return out.length ? out : ["Coffre"];
}

function trade_player_resolveStorageChoice_(fid, value){
  const allowed = trade_player_getStorageOptions_(fid);
  const wanted = String(value || "").trim();
  if (!wanted) throw new Error("Choix dÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢emplacement manquant.");
  if (!allowed.includes(wanted)) throw new Error("Emplacement invalide: " + wanted);
  return wanted;
}

function trade_inventory_findFirstFreeId_(nameVals, idVals){
  const used = new Set();
  for (let i = 0; i < Math.max(nameVals.length, idVals.length); i++){
    const obj = String((nameVals[i] && nameVals[i][0]) || "").trim();
    if (!obj) continue;
    const rawId = (idVals[i] && idVals[i][0]) || "";
    const n = trade_parseNumberLoose_(rawId);
    if (Number.isFinite(n)){
      const id = Math.floor(n);
      if (id >= 1) used.add(id);
    }
  }
  let next = 1;
  while (used.has(next)) next++;
  return next;
}

function trade_inventory_buildRowIndexByKey_(nameVals, catVals){
  const rowIndexByKey = {};
  for (let i = 0; i < nameVals.length; i++){
    const obj = String(nameVals[i][0] || "").trim();
    const cat = String(catVals[i][0] || "").trim();
    if (!obj) continue;
    rowIndexByKey[[obj, cat].join("Ãƒâ€šÃ‚Â§")] = i;
  }
  return rowIndexByKey;
}

function trade_checkoutDraftCacheKey_(token){ return "TRADE_CHECKOUT_DRAFT_" + String(token || "").trim(); }
function trade_checkoutDraftPut_(token, obj){ trade_cachePutLarge_(trade_checkoutDraftCacheKey_(token), JSON.stringify(obj || {}), TRADE_CHECKOUT_DRAFT_TTL_SEC); }
function trade_checkoutDraftGet_(token){
  const raw = trade_cacheGetLarge_(trade_checkoutDraftCacheKey_(token));
  if (!raw) return null;
  try{ return JSON.parse(raw); }catch(_){ return null; }
}
function trade_checkoutDraftDelete_(token){ trade_cacheRemoveLarge_(trade_checkoutDraftCacheKey_(token)); }

/* ============================================================
   Calcul ligne
============================================================ */

function trade_calcLine_(mid, merchantId, itemKey, opts){
  const eq = trade_loadEquipements_();
  const item = eq.byKey[String(itemKey)];
  if (!item) throw new Error("Item introuvable: " + itemKey);

  const merchant = trade_getMerchant_(mid, merchantId);
  const rules = trade_listRules_(mid, merchantId);

  if (!trade_itemIsIncluded_(rules, item) || trade_itemIsExcluded_(rules, item, merchant)){
    throw new Error("Cet item n'est pas disponible chez ce marchand.");
  }

  const o = trade_buildOptions_(merchant, rules, item);
  if (o.blocked) throw new Error(o.blockReason || "Item indisponible.");

  const qty = Math.max(1, Math.floor(Number((opts && opts.qty) || 1)));

  let NT  = Number((opts && opts.NT) || 0);
  let niv = Number((opts && opts.niv) || 1);
  let gen = Number((opts && opts.gen) || 1);
  let loc = Number((opts && opts.loc) || 1);

  if (o.locked && o.locked.NT)  NT  = o.sell.NT;
  if (o.locked && o.locked.niv) niv = o.sell.niv;
  if (o.locked && o.locked.gen) gen = o.sell.gen;
  if (o.locked && o.locked.loc) loc = o.sell.loc;

  loc = Math.max(1, Math.min(TRADE_MAX_LOC, Math.floor(loc)));

  if (o.ntMode === "fixed"){
    NT = o.ntFixed;
  } else if (o.ntMode === "range"){
    if (!o.ntList.length) throw new Error("NT requis mais aucune valeur disponible.");
    if (!o.ntList.includes(NT)) NT = o.ntList[o.ntList.length - 1];
  } else {
    NT = 0;
  }

  if (o.needs.niv) niv = Math.max(1, Math.min(o.nivMax, Math.floor(niv)));
  else niv = 1;

  if (o.needs.gen){
    let genMax = o.genMax;
    const ctype = trade_isComputerCat_(item.cat) ? trade_detectComputerType_(item.fam, item.cat, item.name) : null;
    if (ctype && ctype.restricted && NT >= 1){
      const cmax = Math.min(TRADE_MAX_GEN, ctype.baseMaxGenNT1 + (NT - 1));
      genMax = Math.min(genMax, cmax);
    }
    gen = Math.max(1, Math.min(genMax, Math.floor(gen)));
  } else {
    gen = 1;
  }

  const C = Number.isFinite(Number(merchant.cDevice)) ? Number(merchant.cDevice) : 0;

  let unitBase = 0;
  const nFixed = trade_parseNumberLoose_(item.priceRaw);
  if (Number.isFinite(nFixed)){
    unitBase = nFixed;
  } else {
    unitBase = trade_evalExpr_(o.priceExpr, { NT, niv, gen, loc, C });
    if (!Number.isFinite(unitBase)) throw new Error("Prix non calculable: " + item.priceRaw);
  }

  const modPct = Number(o.eff.modPct || 0);
  let unitFinal = unitBase * (1 + (modPct / 100));
  unitFinal = trade_roundToHalf_(unitFinal);
  const total = trade_roundToHalf_(unitFinal * qty);

  let unitW = 0;
  if (trade_isComputerCat_(item.cat)){
    const base = (TRADE_PC_WEIGHT_TABLE[gen] && TRADE_PC_WEIGHT_TABLE[gen][NT]) ? TRADE_PC_WEIGHT_TABLE[gen][NT] : 0;
    const pct = trade_parsePercentRatio_(item.weightRaw);
    const mult = Number.isFinite(pct) ? pct : 1;
    unitW = base * mult;
  } else {
    const wFixed = trade_parseNumberLoose_(item.weightRaw);
    if (Number.isFinite(wFixed)){
      unitW = wFixed;
    } else {
      const exprW = o.weightExpr;
      if (exprW){
        unitW = trade_evalExpr_(exprW, { NT, niv, gen, loc, C });
        if (!Number.isFinite(unitW)) unitW = 0;
      } else {
        unitW = 0;
      }
    }
  }

  const totalW = Number(unitW) * qty;

  const suffixes = [];
  if (o.ntMode === "range"){
    const rn = trade_toRomanNT_(NT);
    if (rn) suffixes.push("NT" + rn);
  }
  if (o.needs.niv) suffixes.push("+" + String(niv));
  if (o.needs.gen && trade_isComputerCat_(item.cat)){
    const rg = trade_toRomanGen_(gen);
    if (rg) suffixes.push("Gen" + rg);
  }

  const finalName = suffixes.length ? `${item.name} ${suffixes.join(" ")}` : item.name;

  return {
    key: item.key,
    fam: item.fam,
    cat: item.cat,
    name: item.name,
    displayName: finalName,
    desc: "",
    qty,
    chosen: { NT, niv, gen, loc },
    unitBase,
    modPct,
    unitFinal,
    total,
    unitWeight: unitW,
    totalWeight: totalW,
    ntMode: o.ntMode,
    ntFixed: o.ntFixed,
    ntList: o.ntList,
    isComputer: !!o.isComputer,
    needs: o.needs,
    locked: o.locked,
    limits: { nivMax: o.nivMax, genMax: o.genMax, locMax: o.locMax }
  };
}

/* ============================================================
   Catalogue joueur ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â accÃƒÆ’Ã‚Â¨s / arbre / catÃƒÆ’Ã‚Â©gorie
============================================================ */

function trade_isOpen_(merchant){
  return String((merchant && merchant.status) || "").toUpperCase() === "OPEN";
}

function trade_splitAllowed_(s){
  s = String(s || "").trim();
  if (!s) return [];
  return s.split(/[,;\n]+/g).map(x => x.trim()).filter(Boolean);
}

function trade_isPlayerAllowed_(merchant, fid, label){
  const list = trade_splitAllowed_(merchant && merchant.allowed);
  if (!list.length) return false;
  fid = String(fid || "").trim();
  label = String(label || "").trim();
  return list.includes(fid) || (label && list.includes(label));
}

function trade_assertPlayerMerchantAccess_(fid, mid, merchantId){
  fid = String(fid || "").trim();
  mid = String(mid || "").trim();
  merchantId = String(merchantId || "").trim();
  if (!fid || !mid || !merchantId) throw new Error("ParamÃƒÆ’Ã‚Â¨tres manquants (fid/mid/merchantId).");

  const merchant = trade_getMerchant_(mid, merchantId);
  if (!trade_isOpen_(merchant)) throw new Error("Marchand fermÃƒÆ’Ã‚Â©.");

  const idt = getIdentity(fid);
  if (!trade_isPlayerAllowed_(merchant, fid, idt.label || "")){
    throw new Error("Vous n'ÃƒÆ’Ã‚Âªtes pas autorisÃƒÆ’Ã‚Â© ÃƒÆ’Ã‚Â  accÃƒÆ’Ã‚Â©der ÃƒÆ’Ã‚Â  ce marchand.");
  }

  const rules = trade_listRules_(mid, merchantId);
  return { merchant, rules, idt };
}

function trade_itemMatchesQuery_(item, query){
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const hay = [
    item && item.fam,
    item && item.cat,
    item && item.name
  ].map(v => String(v || "").trim().toLowerCase()).join(" ");
  return hay.indexOf(q) !== -1;
}

function trade_previewPriceForTree_(merchant, item, options){
  const o = options || trade_buildOptions_(merchant, [], item);
  try{
    const NT = (o.ntMode === "fixed")
      ? o.ntFixed
      : (o.ntMode === "range" ? (o.ntList[o.ntList.length - 1] || 0) : 0);

    const niv = 1;
    const gen = 1;
    const loc = 1;
    const C = Number.isFinite(Number(merchant.cDevice)) ? Number(merchant.cDevice) : 0;

    const nFixed = trade_parseNumberLoose_(item.priceRaw);
    let unitBase = 0;
    if (Number.isFinite(nFixed)) unitBase = nFixed;
    else unitBase = trade_evalExpr_(o.priceExpr, { NT, niv, gen, loc, C });

    if (!Number.isFinite(unitBase)) return 0;
    const modPct = Number(o.eff.modPct || 0);
    return trade_roundToHalf_(unitBase * (1 + (modPct / 100)));
  }catch(_){
    return 0;
  }
}

function trade_buildCategoryPreview_(merchant, item, o){
  return {
    key: item.key,
    fam: item.fam,
    cat: item.cat,
    name: item.name,
    dispo:       String(item.dispo || "").trim(),
    fabricant:   String(item.fabricant || "").trim(),
    nation:      String(item.nation || "").trim(),
    armeDom:     String(item.armeDom || "").trim(),
    armeChoc:    String(item.armeChoc || "").trim(),
    armePortee:  String(item.armePortee || "").trim(),
    armeFOR:     String(item.armeFOR || "").trim(),
    armeINI:     String(item.armeINI || "").trim(),
    armeModeTir: String(item.armeModeTir || "").trim(),
    armeMun:     String(item.armeMun || "").trim(),
    armeCAL:     String(item.armeCAL || "").trim(),
    armureProt:  String(item.armureProt || "").trim(),
    armureChoc:  String(item.armureChoc || "").trim(),
    armureLoc:   String(item.armureLoc || "").trim(),
    armureMal:   String(item.armureMal || "").trim(),
    objCont:     String(item.objCont || "").trim(),
    objEtanche:  String(item.objEtanche || "").trim(),
    pricePreview: trade_previewPriceForTree_(merchant, item, o),
    ntRaw: item.ntRaw,
    ntMode: o.ntMode,
    ntFixed: o.ntFixed,
    ntList: o.ntList,
    isComputer: !!o.isComputer,
    needs: o.needs,
    limits: { nivMax: o.nivMax, genMax: o.genMax, locMax: o.locMax }
  };
}

function trade_getCatalogTree_(fid, mid, merchantId, query){
  const access = trade_assertPlayerMerchantAccess_(fid, mid, merchantId);
  const merchant = access.merchant;
  const rules = access.rules;
  const eq = trade_loadEquipements_();

  const famMap = new Map();

  for (const item of eq.rows){
    if (!trade_itemIsIncluded_(rules, item)) continue;
    if (trade_itemIsExcluded_(rules, item, merchant)) continue;
    if (!trade_itemMatchesQuery_(item, query)) continue;

    const o = trade_buildOptions_(merchant, rules, item);
    if (o.blocked) continue;

    const fam = String(item.fam || "").trim() || "Sans famille";
    const cat = String(item.cat || "").trim() || "Sans catÃƒÆ’Ã‚Â©gorie";

    if (!famMap.has(fam)){
      famMap.set(fam, {
        fam,
        count: 0,
        categories: new Map()
      });
    }

    const famNode = famMap.get(fam);
    famNode.count += 1;

    if (!famNode.categories.has(cat)){
      famNode.categories.set(cat, {
        cat,
        count: 0
      });
    }

    famNode.categories.get(cat).count += 1;
  }

  const tree = Array.from(famMap.values())
    .map(f => ({
      fam: f.fam,
      count: f.count,
      categories: Array.from(f.categories.values())
        .sort((a,b) => String(a.cat || "").localeCompare(String(b.cat || ""), "fr", { sensitivity:"base" }))
    }))
    .sort((a,b) => String(a.fam || "").localeCompare(String(b.fam || ""), "fr", { sensitivity:"base" }));

  return tree;
}

function trade_getCategoryItems_(fid, mid, merchantId, fam, cat, query, limit){
  const access = trade_assertPlayerMerchantAccess_(fid, mid, merchantId);
  const merchant = access.merchant;
  const rules = access.rules;
  const eq = trade_loadEquipements_();

  fam = String(fam || "").trim();
  cat = String(cat || "").trim();
  limit = Math.max(1, Math.min(500, Number(limit || 200)));

  const out = [];
  for (const item of eq.rows){
    if (fam && String(item.fam || "").trim() !== fam) continue;
    if (cat && String(item.cat || "").trim() !== cat) continue;
    if (!trade_itemIsIncluded_(rules, item)) continue;
    if (trade_itemIsExcluded_(rules, item, merchant)) continue;
    if (!trade_itemMatchesQuery_(item, query)) continue;

    const o = trade_buildOptions_(merchant, rules, item);
    if (o.blocked) continue;

    out.push(trade_buildCategoryPreview_(merchant, item, o));
    if (out.length >= limit) break;
  }

  out.sort((a,b) => String(a.name || "").localeCompare(String(b.name || ""), "fr", { sensitivity:"base" }));
  return out;
}

/* ============================================================
   Search / context joueur
============================================================ */

function trade_player_getContext_(fid, mid, playerLabel){
  const idt = getIdentity(fid);
  const label = playerLabel || idt.label || "";

  const merchants = trade_listMerchants_(mid)
    .filter(trade_isOpen_)
    .filter(m => trade_isPlayerAllowed_(m, fid, label))
    .map(m => ({ id:m.id, name:m.name }));

  const balance = trade_player_getBalance_(fid);
  const storageOptions = trade_player_getStorageOptions_(fid);

  return {
    merchants,
    balance,
    storageOptions,
    player: {
      fid: String(fid || "").trim(),
      label,
      perso: idt.perso || "",
      joueur: idt.joueur || ""
    }
  };
}

/* ============================================================
   Checkout en 2 temps
============================================================ */

function trade_checkout_prepare_(fid, mid, merchantId, cart){
  fid = String(fid || "").trim();
  mid = String(mid || "").trim();
  merchantId = String(merchantId || "").trim();
  if (!fid || !mid || !merchantId) throw new Error("ParamÃƒÆ’Ã‚Â¨tres manquants (fid/mid/merchantId)");

  const merchant = trade_getMerchant_(mid, merchantId);
  if (!trade_isOpen_(merchant)) throw new Error("Marchand fermÃƒÆ’Ã‚Â©.");

  const idt = getIdentity(fid);
  if (!trade_isPlayerAllowed_(merchant, fid, idt.label || "")){
    throw new Error("Vous n'ÃƒÆ’Ã‚Âªtes pas autorisÃƒÆ’Ã‚Â© ÃƒÆ’Ã‚Â  accÃƒÆ’Ã‚Â©der ÃƒÆ’Ã‚Â  ce marchand.");
  }

  const items = Array.isArray(cart) ? cart : [];
  if (!items.length){
    return {
      ok:true,
      draftToken:"",
      total:0,
      totalWeight:0,
      balanceBefore:null,
      balanceAfter:null,
      pendingStorage:[],
      storageOptions:trade_player_getStorageOptions_(fid)
    };
  }

  const lineMap = new Map();
  for (const it of items){
    const qty = Math.max(1, Math.floor(Number(it && it.opts && it.opts.qty || 1)));
    const line = trade_calcLine_(mid, merchantId, it.key, Object.assign({}, it.opts || {}, { qty }));
    const mergeKey = [String(line.displayName || "").trim(), String(line.cat || "").trim()].join("Ãƒâ€šÃ‚Â§");

    if (!lineMap.has(mergeKey)){
      lineMap.set(mergeKey, Object.assign({}, line));
    } else {
      const prev = lineMap.get(mergeKey);
      prev.qty += line.qty;
      prev.total = trade_roundToHalf_(prev.total + line.total);
      prev.totalWeight = trade_roundMaybeWeight_(prev.totalWeight + line.totalWeight);
      lineMap.set(mergeKey, prev);
    }
  }

  const lines = Array.from(lineMap.values());

  let total = 0;
  let totalW = 0;
  for (const l of lines){
    total += l.total;
    totalW += Number(l.totalWeight || 0);
  }
  total = trade_roundToHalf_(total);
  totalW = trade_roundMaybeWeight_(totalW);

  const descMap = trade_fetchDescriptionsByKeys_(lines.map(l => l.key));
  for (const l of lines){
    l.desc = String(descMap[l.key] || "").trim();
  }

  const balanceBefore = trade_player_getBalance_(fid);
  if (balanceBefore < total){
    throw new Error(`Fonds insuffisants: ${balanceBefore} < ${total}`);
  }

  const inv = trade_player_getInventoryRanges_(fid);
  const nameVals = inv.data.name.getValues();
  const catVals  = inv.data.cat.getValues();
  const emplVals = inv.data.empl.getValues();
  const rowIndexByKey = trade_inventory_buildRowIndexByKey_(nameVals, catVals);

  const pendingStorage = [];
  const draftLines = [];

  for (const l of lines){
    const mergeKey = [String(l.displayName || "").trim(), String(l.cat || "").trim()].join("Ãƒâ€šÃ‚Â§");
    const existingIdx = Object.prototype.hasOwnProperty.call(rowIndexByKey, mergeKey) ? rowIndexByKey[mergeKey] : -1;
    const existingStorage = existingIdx >= 0 ? String(emplVals[existingIdx][0] || "").trim() : "";

    let pendingId = "";
    if (!existingStorage){
      pendingId = "p_" + String(pendingStorage.length + 1);
      pendingStorage.push({
        pendingId,
        name: l.displayName,
        cat: l.cat,
        fam: l.fam,
        qty: l.qty
      });
    }

    draftLines.push({
      mergeKey,
      key: l.key,
      fam: l.fam,
      cat: l.cat,
      displayName: l.displayName,
      qty: l.qty,
      desc: l.desc || "",
      unitWeight: Number(l.unitWeight || 0),
      total: Number(l.total || 0),
      existingStorage,
      pendingId
    });
  }

  const draftToken = Utilities.getUuid().replace(/-/g, "");
  trade_checkoutDraftPut_(draftToken, {
    version: 1,
    fid,
    mid,
    merchantId,
    total,
    totalWeight: totalW,
    lines: draftLines,
    createdAt: new Date().toISOString()
  });

  return {
    ok:true,
    draftToken,
    total,
    totalWeight: totalW,
    balanceBefore,
    balanceAfter: trade_roundToHalf_(balanceBefore - total),
    pendingStorage,
    storageOptions: trade_player_getStorageOptions_(fid),
    lines: draftLines.map(l => ({
      name: l.displayName,
      cat: l.cat,
      fam: l.fam,
      qty: l.qty,
      total: l.total
    }))
  };
}

function trade_checkout_commit_(fid, draftToken, storageAssignments){
  fid = String(fid || "").trim();
  draftToken = String(draftToken || "").trim();
  if (!fid || !draftToken) throw new Error("ParamÃƒÆ’Ã‚Â¨tres manquants (fid/draftToken).");

  const draft = trade_checkoutDraftGet_(draftToken);
  if (!draft) throw new Error("Draft d'achat introuvable ou expirÃƒÆ’Ã‚Â©.");
  if (String(draft.fid || "").trim() !== fid) throw new Error("Ce draft n'appartient pas ÃƒÆ’Ã‚Â  cette fiche.");

  const assignmentMap = (storageAssignments && typeof storageAssignments === "object") ? storageAssignments : {};

  const total = trade_roundToHalf_(Number(draft.total || 0));
  const balanceBefore = trade_player_getBalance_(fid);
  if (balanceBefore < total){
    throw new Error(`Fonds insuffisants au moment de la validation: ${balanceBefore} < ${total}`);
  }

  const inv = trade_player_getInventoryRanges_(fid);

  const idVals   = inv.data.id.getValues();
  const famVals  = inv.data.fam.getValues();
  const nameVals = inv.data.name.getValues();
  const catVals  = inv.data.cat.getValues();
  const emplVals = inv.data.empl.getValues();
  const wgtVals  = inv.data.wgt.getValues();
  const descVals = inv.data.desc.getValues();
  const qtyVals  = inv.data.qty.getValues();

  const rowIndexByKey = trade_inventory_buildRowIndexByKey_(nameVals, catVals);
  const lines = Array.isArray(draft.lines) ? draft.lines : [];
  const resolvedStorageByLine = {};

  for (const l of lines){
    const existingIdx = Object.prototype.hasOwnProperty.call(rowIndexByKey, l.mergeKey) ? rowIndexByKey[l.mergeKey] : -1;
    const currentStorage = existingIdx >= 0 ? String(emplVals[existingIdx][0] || "").trim() : "";
    let storage = currentStorage || String(l.existingStorage || "").trim();
    if (!storage){
      if (l.pendingId && assignmentMap[l.pendingId]){
        storage = trade_player_resolveStorageChoice_(fid, assignmentMap[l.pendingId]);
      } else {
        // Aucun emplacement connu : prendre le premier disponible
        const opts = trade_player_getStorageOptions_(fid);
        storage = opts[0] || "Coffre";
      }
    }
    resolvedStorageByLine[l.mergeKey] = storage;
  }

  for (const l of lines){
    const invKey = l.mergeKey;
    const existingIdx = Object.prototype.hasOwnProperty.call(rowIndexByKey, invKey) ? rowIndexByKey[invKey] : -1;

    if (existingIdx >= 0){
      const curQty = trade_parseNumberLoose_(qtyVals[existingIdx][0]);
      const nextQty = Math.max(0, Math.floor((Number.isFinite(curQty) ? curQty : 0) + Number(l.qty || 0)));

      let curId = trade_parseNumberLoose_(idVals[existingIdx][0]);
      if (!(Number.isFinite(curId) && Math.floor(curId) >= 1)){
        curId = trade_inventory_findFirstFreeId_(nameVals, idVals);
        idVals[existingIdx][0] = curId;
      }

      famVals[existingIdx][0] = l.fam;
      wgtVals[existingIdx][0] = trade_roundMaybeWeight_(l.unitWeight);
      qtyVals[existingIdx][0] = nextQty;

      if (String(descVals[existingIdx][0] || "").trim() === "" && String(l.desc || "").trim() !== ""){
        descVals[existingIdx][0] = l.desc;
      }

      if (String(emplVals[existingIdx][0] || "").trim() === ""){
        emplVals[existingIdx][0] = resolvedStorageByLine[invKey];
      }
    } else {
      const emptyIdx = nameVals.findIndex(r => !String(r[0] || "").trim());
      if (emptyIdx < 0){
        throw new Error("Inventaire plein (aucune ligne vide dans la plage InventaireNomObj).");
      }

      const newId = trade_inventory_findFirstFreeId_(nameVals, idVals);

      idVals[emptyIdx][0]    = newId;
      famVals[emptyIdx][0]   = l.fam;
      nameVals[emptyIdx][0]  = l.displayName;
      catVals[emptyIdx][0]   = l.cat;
      emplVals[emptyIdx][0]  = resolvedStorageByLine[invKey];
      wgtVals[emptyIdx][0]   = trade_roundMaybeWeight_(l.unitWeight);
      descVals[emptyIdx][0]  = l.desc || "";
      qtyVals[emptyIdx][0]   = Number(l.qty || 0);

      rowIndexByKey[invKey] = emptyIdx;
    }
  }

  inv.data.id.setValues(idVals);
  inv.data.fam.setValues(famVals);
  inv.data.name.setValues(nameVals);
  inv.data.cat.setValues(catVals);
  inv.data.empl.setValues(emplVals);
  inv.data.wgt.setValues(wgtVals);
  inv.data.desc.setValues(descVals);
  inv.data.qty.setValues(qtyVals);

  const moneySh = trade_openById_(fid).getSheetByName(TRADE_PLAYER_MONEY_TAB);
  const balanceAfter = trade_roundToHalf_(balanceBefore - total);
  moneySh.getRange(TRADE_PLAYER_MONEY_A1).setValue(balanceAfter);

  trade_checkoutDraftDelete_(draftToken);

  return {
    ok:true,
    total,
    totalWeight: Number(draft.totalWeight || 0),
    balanceBefore,
    balanceAfter,
    lines: lines.map(l => ({
      name: l.displayName,
      cat: l.cat,
      fam: l.fam,
      qty: l.qty,
      total: l.total
    }))
  };
}

function trade_checkout_(fid, mid, merchantId, cart){
  return trade_checkout_prepare_(fid, mid, merchantId, cart);
}

function trade_previewLineDraft_(draft, itemKey, opts){
  itemKey = String(itemKey || "").trim();
  if (!itemKey) return { ok:false, error:"itemKey manquant" };

  const eq = trade_loadEquipements_();
  const item = eq.byKey[itemKey];
  if (!item) return { ok:false, error:"Item introuvable: " + itemKey };

  const merchant = (draft && draft.merchant) || {};
  const rules = Array.isArray(draft && draft.rules) ? draft.rules : [];
  return trade_previewLineFrom_(merchant, rules, item, opts || {});
}


/* ============================================================
   OVERRIDES V4 — Bourse / paiements mixtes / MID destinations
============================================================ */

function trade_player_getBalance_(fid){
  try{
    if (typeof bourse_getPlayerBalances_ === "function"){
      const b = bourse_getPlayerBalances_(fid);
      return Number(b && b.persoSurSoi || 0);
    }
  }catch(_){}
  const ss = trade_openById_(fid);
  const sh = ss.getSheetByName(TRADE_PLAYER_MONEY_TAB);
  if (!sh) throw new Error(`Fiche joueur: onglet introuvable "${TRADE_PLAYER_MONEY_TAB}"`);
  return Number(sh.getRange(TRADE_PLAYER_MONEY_A1).getValue()) || 0;
}

function trade_player_getBalances_(fid){
  if (typeof bourse_getPlayerBalances_ === "function"){
    const b = bourse_getPlayerBalances_(fid);
    return {
      persoSurSoi: Number(b && b.persoSurSoi || 0),
      persoCoffre: Number(b && b.persoCoffre || 0)
    };
  }
  return {
    persoSurSoi: trade_player_getBalance_(fid),
    persoCoffre: 0
  };
}

function trade_player_getGroupBalanceSafe_(){
  try{
    if (typeof bourse_getGroupBalance_ === "function") return Number(bourse_getGroupBalance_() || 0);
  }catch(_){}
  return 0;
}

function trade_guessLabelForFid_(fid){
  try{
    if (typeof bourse_guessLabelForFid_ === "function") return bourse_guessLabelForFid_(fid);
  }catch(_){}
  try{
    const idt = getIdentity(fid) || {};
    return String(idt.label || [idt.joueur || "", idt.perso || ""].filter(Boolean).join(" — ") || fid).trim();
  }catch(_){}
  return String(fid || "").trim();
}

function trade_listMidPlayers_(mid, currentFid){
  const cleanMid = String(mid || "").trim();
  const current = String(currentFid || "").trim();
  const out = [];
  const seen = Object.create(null);

  function pushOne(fid, label){
    const cleanFid = String(fid || "").trim();
    if (!cleanFid || seen[cleanFid]) return;
    seen[cleanFid] = true;
    out.push({ fid: cleanFid, label: String(label || "").trim() || trade_guessLabelForFid_(cleanFid) });
  }

  if (cleanMid && typeof reg_getPlayers === "function"){
    try{
      const reg = reg_getPlayers(cleanMid) || {};
      const arr = Array.isArray(reg.players) ? reg.players : [];
      arr.forEach(p => {
        const fid = p && (p.fid || p.fileId || p.spreadsheetId || "");
        const label = p && (p.label || p.name || [p.joueur || p.player || "", p.perso || p.character || ""].filter(Boolean).join(" — "));
        pushOne(fid, label);
      });
    }catch(_){}
  }

  if (current) pushOne(current, trade_guessLabelForFid_(current));

  out.sort((a,b) => String(a.label || a.fid || "").localeCompare(String(b.label || b.fid || ""), "fr", { sensitivity:"base" }));
  return out;
}

function trade_player_getContext_(fid, mid, playerLabel){
  const idt = getIdentity(fid);
  const label = playerLabel || idt.label || "";

  const merchants = trade_listMerchants_(mid)
    .filter(trade_isOpen_)
    .filter(m => trade_isPlayerAllowed_(m, fid, label))
    .map(m => ({ id:m.id, name:m.name }));

  const balances = trade_player_getBalances_(fid);
  const storageOptions = trade_player_getStorageOptions_(fid);

  return {
    merchants,
    balance: balances.persoSurSoi,
    balances: {
      persoSurSoi: balances.persoSurSoi,
      persoCoffre: balances.persoCoffre,
      groupe: trade_player_getGroupBalanceSafe_()
    },
    storageOptions,
    groupDestinations: trade_listMidPlayers_(mid, fid),
    player: {
      fid: String(fid || "").trim(),
      label,
      perso: idt.perso || "",
      joueur: idt.joueur || ""
    }
  };
}

function trade_checkout_parseRequest_(fid, mid, cartOrPayload, total){
  let items = [];
  let payment = {};
  let note = "";

  if (Array.isArray(cartOrPayload)){
    items = cartOrPayload;
  } else if (cartOrPayload && typeof cartOrPayload === "object"){
    items = Array.isArray(cartOrPayload.items) ? cartOrPayload.items : [];
    payment = (cartOrPayload.payment && typeof cartOrPayload.payment === "object") ? cartOrPayload.payment : {};
    note = String(cartOrPayload.note || "").trim();
  }

  const roundedTotal = trade_roundToHalf_(Number(total || 0));
  let mode = String(payment.mode || "").trim().toUpperCase();
  let persoAmount = Number(payment.persoAmount);
  let groupAmount = Number(payment.groupAmount);

  if (!Number.isFinite(persoAmount)) persoAmount = NaN;
  if (!Number.isFinite(groupAmount)) groupAmount = NaN;

  if (!mode){
    if (Number.isFinite(persoAmount) || Number.isFinite(groupAmount)) mode = "MIXTE";
    else mode = "PERSO_SUR_SOI";
  }

  if (mode === "GROUPE"){
    groupAmount = roundedTotal;
    persoAmount = 0;
  } else if (mode === "PERSO_SUR_SOI"){
    persoAmount = roundedTotal;
    groupAmount = 0;
  } else {
    persoAmount = Number.isFinite(persoAmount) ? trade_roundToHalf_(persoAmount) : 0;
    groupAmount = Number.isFinite(groupAmount) ? trade_roundToHalf_(groupAmount) : 0;
  }

  persoAmount = trade_roundToHalf_(Math.max(0, persoAmount));
  groupAmount = trade_roundToHalf_(Math.max(0, groupAmount));

  if (trade_roundToHalf_(persoAmount + groupAmount) !== roundedTotal){
    throw new Error("La répartition perso/groupe doit correspondre exactement au total.");
  }

  const destFidRaw = String(payment.destFid || cartOrPayload && cartOrPayload.destFid || "").trim();
  const destFid = groupAmount > 0 ? destFidRaw : String(fid || "").trim();
  if (groupAmount > 0 && !destFid){
    throw new Error("Le destinataire est obligatoire dès que le groupe paie.");
  }

  return {
    items,
    note,
    payment: {
      mode: (persoAmount > 0 && groupAmount > 0) ? "MIXTE" : (groupAmount > 0 ? "GROUPE" : "PERSO_SUR_SOI"),
      persoAmount,
      groupAmount,
      destFid: destFid || String(fid || "").trim(),
      destLabel: trade_guessLabelForFid_(destFid || fid)
    }
  };
}

function trade_checkout_buildMergedLines_(mid, merchantId, items){
  const lineMap = new Map();

  for (const it of (Array.isArray(items) ? items : [])){
    const qty = Math.max(1, Math.floor(Number(it && it.opts && it.opts.qty || 1)));
    const line = trade_calcLine_(mid, merchantId, it.key, Object.assign({}, it.opts || {}, { qty }));
    const mergeKey = [String(line.displayName || "").trim(), String(line.cat || "").trim()].join("§");

    if (!lineMap.has(mergeKey)){
      lineMap.set(mergeKey, Object.assign({}, line));
    } else {
      const prev = lineMap.get(mergeKey);
      prev.qty += line.qty;
      prev.total = trade_roundToHalf_(prev.total + line.total);
      prev.totalWeight = trade_roundMaybeWeight_(prev.totalWeight + line.totalWeight);
      lineMap.set(mergeKey, prev);
    }
  }

  return Array.from(lineMap.values());
}

function trade_prepareDraftInventoryForTarget_(targetFid, lines){
  const descMap = trade_fetchDescriptionsByKeys_(lines.map(l => l.key));
  lines.forEach(l => { l.desc = String(descMap[l.key] || "").trim(); });

  const inv = trade_player_getInventoryRanges_(targetFid);
  const nameVals = inv.data.name.getValues();
  const catVals  = inv.data.cat.getValues();
  const emplVals = inv.data.empl.getValues();
  const rowIndexByKey = trade_inventory_buildRowIndexByKey_(nameVals, catVals);

  const pendingStorage = [];
  const draftLines = [];

  for (const l of lines){
    const mergeKey = [String(l.displayName || "").trim(), String(l.cat || "").trim()].join("§");
    const existingIdx = Object.prototype.hasOwnProperty.call(rowIndexByKey, mergeKey) ? rowIndexByKey[mergeKey] : -1;
    const existingStorage = existingIdx >= 0 ? String(emplVals[existingIdx][0] || "").trim() : "";

    let pendingId = "";
    if (!existingStorage){
      pendingId = "p_" + String(pendingStorage.length + 1);
      pendingStorage.push({
        pendingId,
        name: l.displayName,
        cat: l.cat,
        fam: l.fam,
        qty: l.qty
      });
    }

    draftLines.push({
      mergeKey,
      key: l.key,
      fam: l.fam,
      cat: l.cat,
      displayName: l.displayName,
      qty: l.qty,
      desc: l.desc || "",
      unitWeight: Number(l.unitWeight || 0),
      unitFinal: Number(l.unitFinal || 0),
      total: Number(l.total || 0),
      existingStorage,
      pendingId
    });
  }

  return {
    draftLines,
    pendingStorage,
    storageOptions: trade_player_getStorageOptions_(targetFid)
  };
}

function trade_writeDraftLinesToInventory_(targetFid, lines, storageAssignments){
  const inv = trade_player_getInventoryRanges_(targetFid);
  const idVals   = inv.data.id.getValues();
  const famVals  = inv.data.fam.getValues();
  const nameVals = inv.data.name.getValues();
  const catVals  = inv.data.cat.getValues();
  const emplVals = inv.data.empl.getValues();
  const wgtVals  = inv.data.wgt.getValues();
  const descVals = inv.data.desc.getValues();
  const qtyVals  = inv.data.qty.getValues();

  const rowIndexByKey = trade_inventory_buildRowIndexByKey_(nameVals, catVals);
  const resolvedStorageByLine = {};
  const assignmentMap = (storageAssignments && typeof storageAssignments === "object")
    ? (storageAssignments.storageAssignments || storageAssignments)
    : {};

  for (const l of lines){
    const existingIdx = Object.prototype.hasOwnProperty.call(rowIndexByKey, l.mergeKey) ? rowIndexByKey[l.mergeKey] : -1;
    const currentStorage = existingIdx >= 0 ? String(emplVals[existingIdx][0] || "").trim() : "";
    let storage = currentStorage || String(l.existingStorage || "").trim();

    if (!storage){
      if (l.pendingId && assignmentMap[l.pendingId]){
        storage = trade_player_resolveStorageChoice_(targetFid, assignmentMap[l.pendingId]);
      } else {
        const opts = trade_player_getStorageOptions_(targetFid);
        storage = opts[0] || "Coffre";
      }
    }
    resolvedStorageByLine[l.mergeKey] = storage;
  }

  for (const l of lines){
    const invKey = l.mergeKey;
    const existingIdx = Object.prototype.hasOwnProperty.call(rowIndexByKey, invKey) ? rowIndexByKey[invKey] : -1;

    if (existingIdx >= 0){
      const curQty = trade_parseNumberLoose_(qtyVals[existingIdx][0]);
      const nextQty = Math.max(0, Math.floor((Number.isFinite(curQty) ? curQty : 0) + Number(l.qty || 0)));

      let curId = trade_parseNumberLoose_(idVals[existingIdx][0]);
      if (!(Number.isFinite(curId) && Math.floor(curId) >= 1)){
        curId = trade_inventory_findFirstFreeId_(nameVals, idVals);
        idVals[existingIdx][0] = curId;
      }

      famVals[existingIdx][0] = l.fam;
      wgtVals[existingIdx][0] = trade_roundMaybeWeight_(l.unitWeight);
      qtyVals[existingIdx][0] = nextQty;

      if (String(descVals[existingIdx][0] || "").trim() === "" && String(l.desc || "").trim() !== ""){
        descVals[existingIdx][0] = l.desc;
      }

      if (String(emplVals[existingIdx][0] || "").trim() === ""){
        emplVals[existingIdx][0] = resolvedStorageByLine[invKey];
      }
    } else {
      const emptyIdx = nameVals.findIndex(r => !String(r[0] || "").trim());
      if (emptyIdx < 0){
        throw new Error("Inventaire plein (aucune ligne vide dans la plage InventaireNomObj).");
      }

      const newId = trade_inventory_findFirstFreeId_(nameVals, idVals);

      idVals[emptyIdx][0]    = newId;
      famVals[emptyIdx][0]   = l.fam;
      nameVals[emptyIdx][0]  = l.displayName;
      catVals[emptyIdx][0]   = l.cat;
      emplVals[emptyIdx][0]  = resolvedStorageByLine[invKey];
      wgtVals[emptyIdx][0]   = trade_roundMaybeWeight_(l.unitWeight);
      descVals[emptyIdx][0]  = l.desc || "";
      qtyVals[emptyIdx][0]   = Number(l.qty || 0);

      rowIndexByKey[invKey] = emptyIdx;
    }
  }

  inv.data.id.setValues(idVals);
  inv.data.fam.setValues(famVals);
  inv.data.name.setValues(nameVals);
  inv.data.cat.setValues(catVals);
  inv.data.empl.setValues(emplVals);
  inv.data.wgt.setValues(wgtVals);
  inv.data.desc.setValues(descVals);
  inv.data.qty.setValues(qtyVals);
}

function trade_checkout_prepare_(fid, mid, merchantId, cartOrPayload){
  fid = String(fid || "").trim();
  mid = String(mid || "").trim();
  merchantId = String(merchantId || "").trim();
  if (!fid || !mid || !merchantId) throw new Error("Paramètres manquants (fid/mid/merchantId)");

  const merchant = trade_getMerchant_(mid, merchantId);
  if (!trade_isOpen_(merchant)) throw new Error("Marchand fermé.");

  const idt = getIdentity(fid);
  if (!trade_isPlayerAllowed_(merchant, fid, idt.label || "")){
    throw new Error("Vous n'êtes pas autorisé à accéder à ce marchand.");
  }

  const request = trade_checkout_parseRequest_(fid, mid, cartOrPayload, 0);
  const items = request.items || [];
  if (!items.length){
    return {
      ok:true,
      draftToken:"",
      total:0,
      totalWeight:0,
      balanceBefore:null,
      balanceAfter:null,
      balancesBefore:null,
      balancesAfter:null,
      pendingStorage:[],
      storageOptions:trade_player_getStorageOptions_(fid),
      payment: request.payment,
      groupDestinations: trade_listMidPlayers_(mid, fid)
    };
  }

  const lines = trade_checkout_buildMergedLines_(mid, merchantId, items);

  let total = 0;
  let totalWeight = 0;
  for (const l of lines){
    total += Number(l.total || 0);
    totalWeight += Number(l.totalWeight || 0);
  }
  total = trade_roundToHalf_(total);
  totalWeight = trade_roundMaybeWeight_(totalWeight);

  const normalized = trade_checkout_parseRequest_(fid, mid, cartOrPayload, total);
  const payment = normalized.payment;

  const balances = trade_player_getBalances_(fid);
  const groupBefore = trade_player_getGroupBalanceSafe_();
  if (balances.persoSurSoi < payment.persoAmount){
    throw new Error(`Fonds perso insuffisants: ${balances.persoSurSoi} < ${payment.persoAmount}`);
  }
  if (groupBefore < payment.groupAmount){
    throw new Error(`Fonds du groupe insuffisants: ${groupBefore} < ${payment.groupAmount}`);
  }

  const targetFid = payment.destFid || fid;
  const inventoryPrep = trade_prepareDraftInventoryForTarget_(targetFid, lines);

  const draftToken = Utilities.getUuid().replace(/-/g, "");
  trade_checkoutDraftPut_(draftToken, {
    version: 2,
    fid,
    mid,
    merchantId,
    merchantName: String(merchant && merchant.name || "").trim(),
    total,
    totalWeight,
    payment,
    targetFid,
    targetLabel: trade_guessLabelForFid_(targetFid),
    lines: inventoryPrep.draftLines,
    createdAt: new Date().toISOString()
  });

  return {
    ok:true,
    draftToken,
    total,
    totalWeight,
    balanceBefore: balances.persoSurSoi,
    balanceAfter: trade_roundToHalf_(balances.persoSurSoi - payment.persoAmount),
    balancesBefore: {
      persoSurSoi: balances.persoSurSoi,
      persoCoffre: balances.persoCoffre,
      groupe: groupBefore
    },
    balancesAfter: {
      persoSurSoi: trade_roundToHalf_(balances.persoSurSoi - payment.persoAmount),
      persoCoffre: balances.persoCoffre,
      groupe: trade_roundToHalf_(groupBefore - payment.groupAmount)
    },
    payment: {
      mode: payment.mode,
      persoAmount: payment.persoAmount,
      groupAmount: payment.groupAmount,
      destFid: targetFid,
      destLabel: trade_guessLabelForFid_(targetFid)
    },
    pendingStorage: inventoryPrep.pendingStorage,
    storageOptions: inventoryPrep.storageOptions,
    groupDestinations: trade_listMidPlayers_(mid, fid),
    lines: inventoryPrep.draftLines.map(l => ({
      name: l.displayName,
      cat: l.cat,
      fam: l.fam,
      qty: l.qty,
      total: l.total
    }))
  };
}

function trade_checkout_commit_(fid, draftToken, storageAssignmentsOrPayload){
  fid = String(fid || "").trim();
  draftToken = String(draftToken || "").trim();
  if (!fid || !draftToken) throw new Error("Paramètres manquants (fid/draftToken).");

  const draft = trade_checkoutDraftGet_(draftToken);
  if (!draft) throw new Error("Draft d'achat introuvable ou expiré.");
  if (String(draft.fid || "").trim() !== fid) throw new Error("Ce draft n'appartient pas à cette fiche.");

  const payment = draft.payment || {};
  const lines = Array.isArray(draft.lines) ? draft.lines : [];
  const targetFid = String(draft.targetFid || payment.destFid || fid).trim() || fid;
  const targetLabel = String(draft.targetLabel || trade_guessLabelForFid_(targetFid)).trim();

  const balances = trade_player_getBalances_(fid);
  const groupBefore = trade_player_getGroupBalanceSafe_();
  if (balances.persoSurSoi < Number(payment.persoAmount || 0)){
    throw new Error(`Fonds perso insuffisants au moment de la validation: ${balances.persoSurSoi} < ${payment.persoAmount}`);
  }
  if (groupBefore < Number(payment.groupAmount || 0)){
    throw new Error(`Fonds du groupe insuffisants au moment de la validation: ${groupBefore} < ${payment.groupAmount}`);
  }

  trade_writeDraftLinesToInventory_(targetFid, lines, storageAssignmentsOrPayload);
  SpreadsheetApp.flush();

  let financeResult = null;
  if (typeof bourse_applyMerchantPurchase_ === "function"){
    financeResult = bourse_applyMerchantPurchase_({
      sourceFid: fid,
      destFid: targetFid,
      mid: String(draft.mid || "").trim(),
      persoAmount: Number(payment.persoAmount || 0),
      groupAmount: Number(payment.groupAmount || 0),
      total: Number(draft.total || 0),
      merchantId: String(draft.merchantId || "").trim(),
      merchantNom: String(draft.merchantName || "").trim(),
      lines,
      note: ""
    });
  } else {
    throw new Error("bourse_applyMerchantPurchase_ introuvable.");
  }

  trade_checkoutDraftDelete_(draftToken);

  return {
    ok:true,
    total: Number(draft.total || 0),
    totalWeight: Number(draft.totalWeight || 0),
    balanceBefore: balances.persoSurSoi,
    balanceAfter: financeResult && financeResult.balances ? financeResult.balances.persoSurSoiAfter : trade_roundToHalf_(balances.persoSurSoi - Number(payment.persoAmount || 0)),
    balancesBefore: {
      persoSurSoi: balances.persoSurSoi,
      persoCoffre: balances.persoCoffre,
      groupe: groupBefore
    },
    balancesAfter: financeResult && financeResult.balances ? {
      persoSurSoi: financeResult.balances.persoSurSoiAfter,
      persoCoffre: financeResult.balances.persoCoffreAfter,
      groupe: financeResult.balances.groupeAfter
    } : {
      persoSurSoi: trade_roundToHalf_(balances.persoSurSoi - Number(payment.persoAmount || 0)),
      persoCoffre: balances.persoCoffre,
      groupe: trade_roundToHalf_(groupBefore - Number(payment.groupAmount || 0))
    },
    payment: payment,
    targetFid,
    targetLabel,
    lines: lines.map(l => ({
      name: l.displayName,
      cat: l.cat,
      fam: l.fam,
      qty: l.qty,
      total: l.total
    }))
  };
}

function trade_checkout_(fid, mid, merchantId, cartOrPayload){
  return trade_checkout_prepare_(fid, mid, merchantId, cartOrPayload);
}
