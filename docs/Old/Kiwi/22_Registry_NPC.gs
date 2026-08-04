/**
 * ============================================================
 * 22_RegistryNPC.gs — Registry PNJ + Bestiaire (V4 clean-mid)
 * - Bestiaire: onglet Bestiaire(s) du fichier MJ
 * - PNJ nommés: dossier "PNJs" (ou aliases) à côté du fichier MJ
 *   + OVERRIDE possible via ScriptProperties (si Drive parents foireux)
 * - Roster: ScriptProperties (source unique)
 * - Cache: CacheService
 *
 * Dépendances attendues (02_Utils.gs):
 * - _initProps_()  _safeJsonParse_()  _uid_()  _normKey_()
 * - _bool_() _num_() _isActiveCell_()
 * - _extractFileId_() _coerceFileId_() (si dispo)
 * - _tryNamedRangeDisplayValue_()
 * - getIdentity()
 * - REG_NPC_* constants (aliases, defaults, named ranges, TTL, prop key builder)
 * - INIT_MJ_SHEET_ID défini ailleurs
 *
 * ============================================================
 */

/* ============================================================
   MID — normalisation (id/url/"id"/'id')
============================================================ */

function _reg_midClean_(mid){
  // si util dispo => source de vérité
  if (typeof _coerceFileId_ === "function") return _coerceFileId_(mid, INIT_MJ_SHEET_ID);

  let s = String(mid ?? "").trim() || INIT_MJ_SHEET_ID;
  for (let i=0;i<3;i++){
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))){
      s = s.slice(1,-1).trim();
      continue;
    }
    break;
  }
  return s || INIT_MJ_SHEET_ID;
}

/** Alias conservé (certains modules l’appellent) */
function _reg_mjId_(mid){
  return _reg_midClean_(mid);
}

/* ============================================================
   Keys (props/cache) — MID clean + migration legacy
============================================================ */

const REG_NPC_CATALOG_CACHE_KEY = (mid) =>
  `REG_NPC_CATALOG_V4_${_reg_midClean_(mid)}`;

const REG_NPC_ROSTER_KEY_CLEAN = (mid) =>
  `REG_NPC_ROSTER_V4_${_reg_midClean_(mid)}`;

/** Legacy keys qu’on a déjà vus passer */
function _reg_rosterKeyCandidates_(midRaw){
  const raw = String(midRaw ?? "").trim() || INIT_MJ_SHEET_ID;
  const clean = _reg_midClean_(raw);

  return [
    // new
    REG_NPC_ROSTER_KEY_CLEAN(clean),

    // legacy possibles
    `REG_NPC_ROSTER_V3_${raw}`,
    `REG_NPC_ROSTER_V3_${clean}`,
    `REG_NPC_ROSTER_V3_"${clean}"`,
    `REG_NPC_ROSTER_V3_'${clean}'`,
    `REG_NPC_ROSTER_V3_"${raw}"`,
    `REG_NPC_ROSTER_V3_'${raw}'`,
  ];
}

/** Lit roster en migrant automatiquement vers la clé clean */
function _reg_readRosterRaw_(mid){
  const props = (typeof _initProps_ === "function")
    ? _initProps_()
    : PropertiesService.getScriptProperties();

  const candidates = _reg_rosterKeyCandidates_(mid);
  const keyClean = REG_NPC_ROSTER_KEY_CLEAN(mid);

  for (const k of candidates){
    const v = props.getProperty(k);
    if (v){
      // migrate -> clean
      if (k !== keyClean){
        props.setProperty(keyClean, v);
        // on nettoie un peu (sans tout casser si tu reviens en arrière)
        try { props.deleteProperty(k); } catch(_){}
      }
      return v;
    }
  }
  return "";
}

/* ============================================================
   Open MJ Sheet SAFE
============================================================ */

function _reg_openMjCatalogSs_(mid){
  const id = _reg_midClean_(mid);
  try{
    return SpreadsheetApp.openById(id);
  }catch(e){
    if (id !== INIT_MJ_SHEET_ID){
      return SpreadsheetApp.openById(INIT_MJ_SHEET_ID);
    }
    throw e;
  }
}

/* ============================================================
   BESTIAIRE — lecture onglet (header auto-detect)
============================================================ */

function _reg_headerIndex_(headers){
  const map = Object.create(null);
  (headers || []).forEach((h, i)=>{
    const k = _normKey_(h);
    if (k && map[k] == null) map[k] = i;
  });
  return map;
}

function _reg_pickCol_(hmap, aliases){
  for (const a of (aliases || [])){
    const k = _normKey_(a);
    if (hmap[k] != null) return hmap[k];
  }
  return null;
}

function _reg_findBestiarySheet_(ss){
  // 1) alias exact
  for (const name of (REG_NPC_BEST_TAB_ALIASES || [REG_NPC_TAB_BEST])){
    const sh = ss.getSheetByName(name);
    if (sh) return sh;
  }
  // 2) contains BESTIAIRES
  for (const sh of ss.getSheets()){
    if (_normKey_(sh.getName()).includes("BESTIAIRES")) return sh;
  }
  // 3) contains BESTIAIRE
  for (const sh of ss.getSheets()){
    if (_normKey_(sh.getName()).includes("BESTIAIRE")) return sh;
  }
  return null;
}

function _reg_detectHeaderRow_(sh, lastCol){
  const probeRows = Math.min(30, sh.getLastRow());
  if (probeRows < 1) return null;

  const probe = sh.getRange(1, 1, probeRows, lastCol).getValues();
  for (let i=0; i<probe.length; i++){
    const hmap = _reg_headerIndex_(probe[i] || []);
    const colName = _reg_pickCol_(hmap, ["Nom","Name"]);
    if (colName != null) return { headerRow: i+1 };
  }
  return null;
}

function _reg_readBestiaryTab_(mid){
  const ss = _reg_openMjCatalogSs_(mid);
  const sh = _reg_findBestiarySheet_(ss);
  if (!sh) return [];

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 2) return [];

  const hdr = _reg_detectHeaderRow_(sh, lastCol);
  if (!hdr) return [];

  const values = sh.getRange(hdr.headerRow, 1, lastRow - hdr.headerRow + 1, lastCol).getValues();
  const headers = values[0] || [];
  const hmap = _reg_headerIndex_(headers);

  const colActive = _reg_pickCol_(hmap, ["Actif","Active","Enable","Enabled","On"]);
  const colName   = _reg_pickCol_(hmap, ["Nom","Name"]);
  const colIni    = _reg_pickCol_(hmap, ["INI","Init","Initiative","BaseInit"]);
  const colCamp   = _reg_pickCol_(hmap, ["Camp","Side","Faction"]);

  if (colName == null) return [];

  const out = [];
  for (let r=1; r<values.length; r++){
    const row = values[r];
    const name = String(row[colName] ?? "").trim();
    if (!name) continue;

    // ✅ blanc = actif ; FALSE = inactif
    const active = (colActive == null) ? true : _isActiveCell_(row[colActive]);
    if (!active) continue;

    const baseInit = (colIni == null) ? 0 : _num_(row[colIni]);
    const campRaw = (colCamp == null) ? "" : String(row[colCamp] ?? "").trim();

    const camp = campRaw
      ? (campRaw.toLowerCase().includes("alli") ? "Allié" : "Ennemi")
      : REG_NPC_DEFAULT_CAMP_BEST;

    out.push({
      source: "BEST",
      key: `BEST::${_normKey_(name)}`,
      name,
      camp,
      baseInit
    });
  }

  out.sort((a,b)=> String(a.name||"").localeCompare(String(b.name||""), "fr"));
  return out;
}

/* ============================================================
   PNJ NOMMÉS — dossier Drive
============================================================ */

function _reg_listParentFolders_(fileId){
  const f = DriveApp.getFileById(String(fileId).trim());
  const it = f.getParents();
  const out = [];
  while (it.hasNext()) out.push(it.next());
  return out;
}

function _reg_findSiblingFolderByAliases_(fileId, folderAliases){
  const parents = _reg_listParentFolders_(fileId);
  if (!parents.length) return null;

  const targets = (folderAliases || []).map(_normKey_);

  for (const p of parents){
    // exact normalized
    let it = p.getFolders();
    while (it.hasNext()){
      const fol = it.next();
      if (targets.includes(_normKey_(fol.getName()))) return fol;
    }
    // contains
    it = p.getFolders();
    while (it.hasNext()){
      const fol = it.next();
      const n = _normKey_(fol.getName());
      if (targets.some(t => n.includes(t))) return fol;
    }
  }
  return null;
}

function _reg_searchAnyFolderByAliases_(folderAliases){
  // fallback global Drive search (si sibling impossible)
  for (const a of (folderAliases || [])){
    const q1 = `title = "${String(a).replace(/"/g,'\\"')}" and trashed = false`;
    const it1 = DriveApp.searchFolders(q1);
    if (it1.hasNext()) return it1.next();
  }
  for (const a of (folderAliases || [])){
    const q2 = `title contains "${String(a).replace(/"/g,'\\"')}" and trashed = false`;
    const it2 = DriveApp.searchFolders(q2);
    if (it2.hasNext()) return it2.next();
  }
  return null;
}

function _reg_resolvePnjFolder_(mid){
  const mjId = _reg_midClean_(mid);

  // 1) override explicite
  const props = (typeof _initProps_ === "function")
    ? _initProps_()
    : PropertiesService.getScriptProperties();

  const overrideKey = REG_NPC_PNJ_FOLDER_ID_PROP_KEY(mjId);
  const overrideId = String(props.getProperty(overrideKey) || "").trim();
  if (overrideId){
    try { return DriveApp.getFolderById(overrideId); }
    catch(_){ /* continue */ }
  }

  // 2) sibling
  const sibling = _reg_findSiblingFolderByAliases_(mjId, REG_NPC_PNJ_FOLDER_ALIASES || [REG_NPC_PNJ_FOLDER_NAME]);
  if (sibling) return sibling;

  // 3) recherche globale
  const any = _reg_searchAnyFolderByAliases_(REG_NPC_PNJ_FOLDER_ALIASES || [REG_NPC_PNJ_FOLDER_NAME]);
  if (any) return any;

  return null;
}

function _reg_readPnjFicheMeta_(fid){
  const ss = SpreadsheetApp.openById(String(fid).trim());

  const id = getIdentity(fid);
  const name = (id && id.label) ? id.label : (ss.getName() || "PNJ");

  const baseInitRaw = _tryNamedRangeDisplayValue_(ss, REG_NPC_NAMEDRANGE_BASEINIT);
  const baseInit = _num_(baseInitRaw);

  const campRaw = String(_tryNamedRangeDisplayValue_(ss, REG_NPC_NAMEDRANGE_CAMP) || "").trim();
  const camp = campRaw
    ? (campRaw.toLowerCase().includes("alli") ? "Allié" : "Ennemi")
    : REG_NPC_DEFAULT_CAMP_PNJ;

  return { name, baseInit, camp };
}

function _reg_readPnjFolderCatalog_(mid){
  const folder = _reg_resolvePnjFolder_(mid);
  if (!folder) {
    throw new Error(
      "Dossier PNJ introuvable.\n" +
      "➡️ Lance reg_setPnjFolder(mid, urlDossierPNJs) une fois."
    );
  }

  const out = [];
  const it = folder.getFilesByType(MimeType.GOOGLE_SHEETS);

  while (it.hasNext()){
    const f = it.next();
    const fid = f.getId();
    try{
      const meta = _reg_readPnjFicheMeta_(fid);
      out.push({
        source: "PNJ",
        key: `PNJFID::${fid}`,
        fid,
        name: meta.name,
        camp: meta.camp,
        baseInit: meta.baseInit
      });
    }catch(e){
      Logger.log("[PNJ SKIP] file=" + f.getName() + " id=" + fid + " err=" + String(e && e.message ? e.message : e));
    }
  }

  out.sort((a,b)=> String(a.name||"").localeCompare(String(b.name||""), "fr"));
  return out;
}

/* ============================================================
   PUBLIC — CATALOG (cache)
============================================================ */

function reg_getNpcCatalog(mid){
  try{
    mid = _reg_midClean_(mid);

    const cache = CacheService.getScriptCache();
    const ckey = REG_NPC_CATALOG_CACHE_KEY(mid);
    const hit = cache.get(ckey);
    if (hit){
      try { return { ok:true, mid, ...JSON.parse(hit), cached:true }; } catch(_){}
    }

    const pnjs = _reg_readPnjFolderCatalog_(mid);
    const best = _reg_readBestiaryTab_(mid);

    const payload = { pnjs, best };
    cache.put(ckey, JSON.stringify(payload), REG_NPC_CATALOG_CACHE_TTL_SEC);

    return { ok:true, mid, pnjs, best, cached:false };
  }catch(e){
    return { ok:false, mid: String(mid||""), message: String(e && e.message ? e.message : e) };
  }
}

function reg_purgeNpcCache(mid){
  mid = _reg_midClean_(mid);
  CacheService.getScriptCache().remove(REG_NPC_CATALOG_CACHE_KEY(mid));
  return { ok:true, mid };
}

/* ============================================================
   Bind folder PNJs (override)
============================================================ */

function reg_setPnjFolder(mid, folderUrlOrId){
  mid = _reg_midClean_(mid);
  const folderId = _extractFileId_(folderUrlOrId);

  DriveApp.getFolderById(folderId);

  const props = (typeof _initProps_ === "function")
    ? _initProps_()
    : PropertiesService.getScriptProperties();

  props.setProperty(REG_NPC_PNJ_FOLDER_ID_PROP_KEY(mid), folderId);
  reg_purgeNpcCache(mid);
  return { ok:true, mid, folderId };
}

function reg_clearPnjFolder(mid){
  mid = _reg_midClean_(mid);

  const props = (typeof _initProps_ === "function")
    ? _initProps_()
    : PropertiesService.getScriptProperties();

  props.deleteProperty(REG_NPC_PNJ_FOLDER_ID_PROP_KEY(mid));
  reg_purgeNpcCache(mid);
  return { ok:true, mid };
}

/* ============================================================
   ROSTER (instances actives) — props (clean + migration)
============================================================ */

function _reg_readNpcRoster_(mid){
  mid = _reg_midClean_(mid);

  const raw = _reg_readRosterRaw_(mid);
  const arr = raw ? _safeJsonParse_(raw, []) : [];
  const list = Array.isArray(arr) ? arr : [];

  return list.map(x => ({
    id: String(x?.id || "").trim(),
    name: String(x?.name || "").trim() || "PNJ",
    camp: (String(x?.camp || "").toLowerCase().includes("alli")) ? "Allié" : "Ennemi",
    baseInit: _num_(x?.baseInit),
    source: String(x?.source || "").trim(),            // "PNJ" | "BEST"
    templateKey: String(x?.templateKey || "").trim(),  // PNJFID::... | BEST::...
    fid: String(x?.fid || "").trim(),
    weaponKey: String(x?.weaponKey || "").trim(),
    weaponName: String(x?.weaponName || "").trim()
  })).filter(x => x.id && x.name);
}

function _reg_writeNpcRoster_(mid, roster){
  mid = _reg_midClean_(mid);

  const props = (typeof _initProps_ === "function")
    ? _initProps_()
    : PropertiesService.getScriptProperties();

  props.setProperty(REG_NPC_ROSTER_KEY_CLEAN(mid), JSON.stringify(roster || []));
}

function reg_getNpcRoster(mid){
  mid = _reg_midClean_(mid);
  return { ok:true, mid, roster: _reg_readNpcRoster_(mid) };
}

function reg_setNpcRoster(mid, roster){
  mid = _reg_midClean_(mid);
  _reg_writeNpcRoster_(mid, Array.isArray(roster) ? roster : []);
  return { ok:true, mid };
}

/**
 * Ajoute au roster depuis catalogue
 * @param {"PNJ"|"BEST"} sourceTag
 * @param {string} templateKey "PNJFID::<fid>" ou "BEST::..."
 * @param {number} count (BEST uniquement)
 */
function reg_addNpcFromCatalog(mid, sourceTag, templateKey, count){
  mid = _reg_midClean_(mid);
  sourceTag = String(sourceTag || "").trim().toUpperCase();
  templateKey = String(templateKey || "").trim();
  count = Math.max(1, Math.min(20, Number(count || 1)));

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try{
    const cat = reg_getNpcCatalog(mid);
    if (!cat || cat.ok === false) return { ok:false, message: cat?.message || "Catalogue indisponible." };

    const pool = (sourceTag === "PNJ") ? (cat.pnjs || []) : (cat.best || []);
    const tpl = pool.find(x => String(x.key) === templateKey);
    if (!tpl) return { ok:false, message:"Template introuvable (catalogue)." };

    const roster = _reg_readNpcRoster_(mid);

    if (sourceTag === "PNJ"){
      const stableId = templateKey; // PNJFID::<fid>
      if (roster.some(x => x.id === stableId)){
        return { ok:false, message:"Déjà présent dans le roster." };
      }

      roster.push({
        id: stableId,
        name: tpl.name,
        camp: tpl.camp,
        baseInit: tpl.baseInit,
        source: "PNJ",
        templateKey,
        fid: tpl.fid || templateKey.replace(/^PNJFID::/, "")
      });

      _reg_writeNpcRoster_(mid, roster);
      return { ok:true, mid, roster };
    }

    for (let i=0; i<count; i++){
      const id = `BESTINST::${_uid_()}`;
      roster.push({
        id,
        name: tpl.name,
        camp: tpl.camp,
        baseInit: tpl.baseInit,
        source: "BEST",
        templateKey,
        weaponKey: "",
        weaponName: ""
      });
    }

    _reg_writeNpcRoster_(mid, roster);
    return { ok:true, mid, roster };

  } finally {
    lock.releaseLock();
  }
}

function reg_removeNpc(mid, id){
  mid = _reg_midClean_(mid);
  id = String(id || "").trim();
  if (!id) throw new Error("ID manquant.");

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try{
    const roster = _reg_readNpcRoster_(mid);
    const next = roster.filter(x => x.id !== id);
    _reg_writeNpcRoster_(mid, next);
    return { ok:true, mid, roster: next };
  } finally {
    lock.releaseLock();
  }
}

function reg_updateNpc(mid, id, patch){
  mid = _reg_midClean_(mid);
  id = String(id || "").trim();
  if (!id) throw new Error("ID manquant.");

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try{
    const roster = _reg_readNpcRoster_(mid);
    const idx = roster.findIndex(x => x.id === id);
    if (idx === -1) throw new Error("PNJ introuvable.");

    const cur = roster[idx];
    const next = {
      ...cur,
      name: (patch?.name != null) ? String(patch.name).trim() : cur.name,
      camp: (patch?.camp != null)
        ? (String(patch.camp).toLowerCase().includes("alli") ? "Allié" : "Ennemi")
        : cur.camp,
      baseInit: (patch?.baseInit != null) ? _num_(patch.baseInit) : cur.baseInit,
      weaponKey: (patch?.weaponKey != null) ? String(patch.weaponKey).trim() : cur.weaponKey,
      weaponName: (patch?.weaponName != null) ? String(patch.weaponName).trim() : cur.weaponName
    };

    roster[idx] = next;
    _reg_writeNpcRoster_(mid, roster);
    return { ok:true, mid, roster, npc: next };
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================
   DEBUG
============================================================ */

function reg_debugNpcCatalog(mid){
  mid = _reg_midClean_(mid);

  const info = {
    mid,
    mjId: mid,
    parents: [],
    overrideFolderId: "",
    pnjFolderFound: false,
    pnjFolderName: "",
    pnjFilesCount: 0,
    bestSheetFound: false,
    bestSheetName: "",
    bestLastRow: 0,
    bestLastCol: 0,
    bestHeaderRow: 0,
    rosterKey: REG_NPC_ROSTER_KEY_CLEAN(mid),
    rosterRawExists: false
  };

  try{
    const parents = _reg_listParentFolders_(mid);
    info.parents = parents.map(p => ({ name: p.getName(), id: p.getId() }));
  }catch(e){
    info.parents = [];
  }

  try{
    const props = (typeof _initProps_ === "function")
      ? _initProps_()
      : PropertiesService.getScriptProperties();

    info.overrideFolderId = String(props.getProperty(REG_NPC_PNJ_FOLDER_ID_PROP_KEY(mid)) || "");
    info.rosterRawExists = !!_reg_readRosterRaw_(mid);
  }catch(_){}

  const folder = _reg_resolvePnjFolder_(mid);
  if (folder){
    info.pnjFolderFound = true;
    info.pnjFolderName = folder.getName();

    let count = 0;
    const it = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
    while (it.hasNext()){ it.next(); count++; }
    info.pnjFilesCount = count;
  }

  const ss = _reg_openMjCatalogSs_(mid);
  const sh = _reg_findBestiarySheet_(ss);
  if (sh){
    info.bestSheetFound = true;
    info.bestSheetName = sh.getName();
    info.bestLastRow = sh.getLastRow();
    info.bestLastCol = sh.getLastColumn();
    const hdr = _reg_detectHeaderRow_(sh, info.bestLastCol);
    info.bestHeaderRow = hdr ? hdr.headerRow : 0;
  }

  Logger.log(JSON.stringify(info, null, 2));
  return info;
}

function reg_debugPnjFolder(mid){
  mid = _reg_midClean_(mid);

  const folder = _reg_resolvePnjFolder_(mid);
  if (!folder) throw new Error("Folder PNJs introuvable.");

  const out = {
    mid,
    folderName: folder.getName(),
    folderId: folder.getId(),
    files: []
  };

  const it = folder.getFiles();
  while (it.hasNext()){
    const f = it.next();
    const fid = f.getId();
    const mime = f.getMimeType();

    let ok = true, label = "", err = "";
    try{
      const id = getIdentity(fid);
      label = id?.label || "";
    }catch(e){
      ok = false;
      err = String(e && e.message ? e.message : e);
    }

    out.files.push({ name: f.getName(), id: fid, mime, ok, label, err });
  }

  Logger.log(JSON.stringify(out, null, 2));
  return out;
}
