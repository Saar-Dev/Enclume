/*******************************************************
 * 02_Utils.gs — helpers génériques + constantes projet
 *******************************************************/

// ---------- Properties helpers ----------
function _initProps_() {
  return PropertiesService.getScriptProperties();
}

// ---------- Generic helpers ----------
function _nowIso_() {
  return new Date().toISOString();
}
function _uid_() {
  return Utilities.getUuid();
}
function _safeJsonParse_(s, fallback) {
  try { return JSON.parse(s); } catch (e) { return fallback; }
}

/**
 * Extrait un fileId depuis:
 * - un ID direct
 * - une URL Google Sheets / Drive (y compris dossiers)
 */
function _extractFileId_(urlOrId) {
  if (!urlOrId) throw new Error("Lien/ID vide.");
  const s = String(urlOrId).trim();

  // ID brut
  if (/^[a-zA-Z0-9-_]{20,}$/.test(s) && !s.includes("http")) return s;

  // /spreadsheets/d/<id>
  let m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];

  // /folders/<id>
  m = s.match(/\/folders\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];

  // /d/<id>
  m = s.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];

  // id=<id>
  m = s.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  if (m) return m[1];

  throw new Error("Lien Google invalide (ID introuvable).");
}

// ---------- Sheets helpers ----------
function openFiche_(fid) {
  if (!fid) throw new Error("FID manquant");
  return SpreadsheetApp.openById(String(fid).trim());
}

function getSheet_(fid, name) {
  const ss = openFiche_(fid);
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error(`Onglet introuvable : ${name}`);
  return { ss, sh };
}

/**
 * Identité standard (PJ/PNJ fiche identique)
 * - Personnage!B3 = joueur
 * - Personnage!B6 = perso
 */
function getIdentity(fid) {
  fid = String(fid || "").trim();
  if (!fid) return { joueur: "", perso: "", label: "—" };

  const ss = SpreadsheetApp.openById(fid);
  const sh = ss.getSheetByName("Personnage");
  if (!sh) return { joueur: "", perso: "", label: "Personnage introuvable" };

  const joueur = String(sh.getRange("B3").getDisplayValue() || "").trim();
  const perso  = String(sh.getRange("B6").getDisplayValue() || "").trim();

  const label = [perso, joueur].filter(Boolean).join(" - ") || ss.getName() || "—";
  return { joueur, perso, label };
}

function ensureSheetSize_(sheet, minRows, minCols) {
  const curRows = sheet.getMaxRows();
  const curCols = sheet.getMaxColumns();
  if (curRows < minRows) sheet.insertRowsAfter(curRows, minRows - curRows);
  if (curCols < minCols) sheet.insertColumnsAfter(curCols, minCols - curCols);
}

// ---------- small numeric helpers ----------
function _parseLeadingInt_(s) {
  const m = String(s || '').match(/-?\d+/);
  return m ? Number(m[0]) : NaN;
}
function _toNumberOrZero_(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ---------- normalization / bool / num ----------
function _normKey_(s){
  return (s ?? "")
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function _bool_(v){
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return false;
  return ["1","true","vrai","yes","y","ok","oui","x"].includes(s);
}

function _num_(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Colonne "Actif" : on veut un comportement pratique :
 * - FALSE => inactif
 * - vide => actif
 * - sinon => bool
 */
function _isActiveCell_(v){
  if (v === false) return false;
  if (v === "" || v == null) return true;
  return _bool_(v);
}

/**
 * Lecture safe d'un named range (displayValue).
 * names = tableau de noms candidats (ex: ["BASE_INIT","BASEINIT"])
 */
function _tryNamedRangeDisplayValue_(ss, names){
  for (const n of (names || [])){
    try{
      const r = ss.getRangeByName(n);
      if (r) {
        const dv = r.getDisplayValue();
        if (dv !== "" && dv != null) return dv;
      }
    } catch(_){}
  }
  return "";
}

/* ============================================================
   CONSTANTES PARTAGEES — Registry NPC
============================================================ */

const REG_NPC_PNJ_FOLDER_NAME = "PNJs";

// Aliases dossier PNJ
const REG_NPC_PNJ_FOLDER_ALIASES = ["PNJs", "PNJ", "PNJS", "PNJ NOMMES", "PNJ NOMMÉS"];

// Aliases onglet bestiaire
const REG_NPC_BEST_TAB_ALIASES = ["Bestiaires", "Bestiaire", "BESTIAIRES", "BESTIAIRE"];

// Cache catalogue PNJ/Bestiaire
const REG_NPC_CATALOG_CACHE_TTL_SEC = 300; // 5 min

// Defaults camps
const REG_NPC_DEFAULT_CAMP_PNJ  = "Allié";
const REG_NPC_DEFAULT_CAMP_BEST = "Ennemi";

// Named ranges recommandés dans les fiches PNJ (et PJ si tu veux)
const REG_NPC_NAMEDRANGE_BASEINIT = ["BASE_INIT", "BASEINIT", "INIT_BASE", "INITBASE"];
const REG_NPC_NAMEDRANGE_CAMP     = ["CAMP", "FACTION", "SIDE"];

// Override folder ID pour PNJs (indispensable si parents=[] / fichier orphelin)
const REG_NPC_PNJ_FOLDER_ID_PROP_KEY = (mid) =>
  `REG_NPC_PNJ_FOLDER_ID_V3_${String(mid || "").trim() || "DEFAULT"}`;

/* ============================================================
   CONSTANTES PARTAGEES — Registry Weapons (BDD Polaris)
============================================================ */

const POLARIS_BDD_ID = "12msJt6Mzpx9f-Kj9Y-2_CpQ7ZSsuC78SNI6WX1h0ob0";

const BDD_TAB_WEAP_RANGED = "Armes à distances";
const BDD_TAB_WEAP_MELEE  = "Armes de contact";

const REG_WEAP_CACHE_TTL_SEC = 300; // 5 min

function _tryExtractFileId_(urlOrId){
  try { return _extractFileId_(urlOrId); } catch(_) { return ""; }
}

/**
 * Renvoie un ID Google “valide” en priorisant value, sinon fallback.
 * Ne throw QUE si les deux sont impossibles.
 */
function _coerceFileId_(value, fallback){
  const a = _tryExtractFileId_(value);
  if (a) return a;

  const b = _tryExtractFileId_(fallback);
  if (b) return b;

  // dernier filet : si fallback est déjà un ID brut
  const s = String(fallback || "").trim();
  if (/^[a-zA-Z0-9-_]{20,}$/.test(s)) return s;

  throw new Error("Aucun ID Google valide (value=" + String(value) + ").");
}
