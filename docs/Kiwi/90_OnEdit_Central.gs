/**
 * ============================================================
 * 90_OnEdit_Central.gs — Centralisation onEdit (PJ + PNJ)
 * - Install/audit triggers
 * - Handler central_onEdit -> délègue au moteur (91)
 * - PNJ: installe trigger uniquement si fiche (fid) et source != BEST
 * ============================================================
 */

function _listProjectTriggers_() {
  return ScriptApp.getProjectTriggers();
}

function _looksLikeSpreadsheetId_(s){
  const id = String(s || "").trim();
  // Un ID de spreadsheet ressemble à ça : 1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  // On accepte large (Apps Script ID/Drive ID): 20+ chars base64-ish
  return /^[a-zA-Z0-9-_]{20,}$/.test(id);
}

function _hasOnEditTriggerForFid_(fid) {
  const fidStr = String(fid || "").trim();
  if (!fidStr) return false;

  return _listProjectTriggers_().some(t => {
    try {
      return (
        t.getHandlerFunction() === "central_onEdit" &&
        t.getEventType() === ScriptApp.EventType.ON_EDIT &&
        t.getTriggerSourceId() === fidStr
      );
    } catch (_) {
      return false;
    }
  });
}

function _installOnEditTriggerForFid_(fid) {
  fid = String(fid || "").trim();
  if (!fid) throw new Error("FID manquant");

  if (_hasOnEditTriggerForFid_(fid)) return { ok: true, created: false, fid };

  // ✅ Ne pas openById ici : pas nécessaire, et ça peut planter si droits / latence.
  ScriptApp.newTrigger("central_onEdit")
    .forSpreadsheet(fid) // accepte l'ID
    .onEdit()
    .create();

  return { ok: true, created: true, fid };
}

/**
 * Installe triggers onEdit pour tous les joueurs du MID.
 * ✅ IMPORTANT: ne dépend PAS de _readPlayerIdentity_
 */
function init_mj_installOnEditForPlayers(mid) {
  mid = String(mid || "").trim() || INIT_MJ_SHEET_ID;

  let ids = [];
  try {
    if (typeof _reg_readIds_ === "function") ids = _reg_readIds_(mid);
    else if (typeof reg_getPlayers === "function") ids = (reg_getPlayers(mid)?.players || []).map(p => p.fid);
  } catch (e) {
    ids = [];
  }

  ids = (Array.isArray(ids) ? ids : [])
    .map(x => String(x || "").trim())
    .filter(Boolean);

  const report = [];
  ids.forEach(fid => {
    try {
      const r = _installOnEditTriggerForFid_(fid);
      report.push(`✅ PJ ${fid} : ${r.created ? "trigger créé" : "déjà présent"}`);
    } catch (e) {
      report.push(`❌ PJ ${fid} : ${String(e?.message || e)}`);
    }
  });

  return { ok: true, mid, count: ids.length, report };
}

/**
 * Installe triggers onEdit pour tous les PNJ "fichés" du MID.
 * - source=BEST => skip (pas de trigger)
 * - utilise n.fid si présent
 * - fallback: si n.id ressemble à un SpreadsheetId, l'utilise
 */
function init_mj_installOnEditForNpcs(mid){
  mid = String(mid || "").trim() || INIT_MJ_SHEET_ID;

  let roster = [];
  try {
    roster = (reg_getNpcRoster(mid)?.roster || []);
  } catch (e) {
    roster = [];
  }

  roster = Array.isArray(roster) ? roster : [];

  const report = [];
  let count = 0;

  roster.forEach(n => {
    const source = String(n?.source || "PNJ").toUpperCase();
    const name = String(n?.name || n?.id || "PNJ").trim();

    if (source === "BEST"){
      report.push(`⏭️ PNJ ${name} : BEST (skip trigger)`);
      return;
    }

    const fid = String(n?.fid || "").trim();
    const id  = String(n?.id  || "").trim();
    const sid = fid || (_looksLikeSpreadsheetId_(id) ? id : "");

    if (!sid){
      report.push(`⚠️ PNJ ${name} : pas de fid exploitable`);
      return;
    }

    try{
      const r = _installOnEditTriggerForFid_(sid);
      report.push(`✅ PNJ ${name} : ${r.created ? "trigger créé" : "déjà présent"}`);
      count++;
    } catch(e){
      report.push(`❌ PNJ ${name} : ${String(e?.message || e)}`);
    }
  });

  return { ok:true, mid, count, report };
}

/**
 * Installe triggers PJ + PNJ en une seule commande.
 */
function init_mj_installOnEditForAll(mid){
  mid = String(mid || "").trim() || INIT_MJ_SHEET_ID;
  const pj  = init_mj_installOnEditForPlayers(mid);
  const pnj = init_mj_installOnEditForNpcs(mid);
  return { ok:true, mid, players: pj, npcs: pnj };
}

function init_mj_auditOnEditTriggers(mid) {
  mid = String(mid || "").trim() || INIT_MJ_SHEET_ID;

  // PJ ids
  let pjIds = [];
  try {
    if (typeof _reg_readIds_ === "function") pjIds = _reg_readIds_(mid);
    else if (typeof reg_getPlayers === "function") pjIds = (reg_getPlayers(mid)?.players || []).map(p => p.fid);
  } catch (e) {
    pjIds = [];
  }
  pjIds = (Array.isArray(pjIds) ? pjIds : []).map(x => String(x||"").trim()).filter(Boolean);

  // PNJ ids (hors BEST)
  let roster = [];
  try { roster = (reg_getNpcRoster(mid)?.roster || []); } catch(e){ roster = []; }
  roster = Array.isArray(roster) ? roster : [];

  const pnjIds = roster
    .filter(n => String(n?.source || "PNJ").toUpperCase() !== "BEST")
    .map(n => String(n?.fid || "").trim() || ( _looksLikeSpreadsheetId_(n?.id) ? String(n.id).trim() : "" ))
    .filter(Boolean);

  // Triggers installés
  const installed = new Set(
    _listProjectTriggers_()
      .filter(t => {
        try {
          return t.getHandlerFunction() === "central_onEdit" &&
                 t.getEventType() === ScriptApp.EventType.ON_EDIT &&
                 !!t.getTriggerSourceId();
        } catch (_) { return false; }
      })
      .map(t => {
        try { return t.getTriggerSourceId(); } catch (_) { return ""; }
      })
      .filter(Boolean)
  );

  const pjMissing  = pjIds.filter(fid => !installed.has(fid));
  const pnjMissing = pnjIds.filter(fid => !installed.has(fid));

  return {
    ok:true,
    mid,
    players: { total: pjIds.length, missing: pjMissing },
    npcs:    { total: pnjIds.length, missing: pnjMissing },
    installed: Array.from(installed)
  };
}

/**
 * Handler onEdit installable
 * - se déclenche uniquement sur édition manuelle
 * - délègue au moteur (91)
 */
function central_onEdit(e) {
  try {
    if (!e || !e.range) return;

    const range = e.range;
    const sheet = range.getSheet();
    if (!sheet) return;

    // ✅ uniquement Personnage
    if (sheet.getName() !== "Personnage") return;

    // ✅ 1 cellule uniquement
    if (range.getNumRows() !== 1 || range.getNumColumns() !== 1) return;

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(800)) return;

    try {
      _centralEngine_onEdit_(e, sheet);
    } finally {
      try { lock.releaseLock(); } catch (_) {}
    }

  } catch (err) {
    try {
      const ss = e?.range?.getSheet()?.getParent?.();
      if (ss && typeof ss.toast === "function") {
        ss.toast("Erreur onEdit: " + String(err?.message || err), "Polaris", 5);
      }
    } catch (_) {}
  }
}
