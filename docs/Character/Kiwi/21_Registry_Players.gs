/**
 * ============================================================
 * 21_Registry_Players.gs — Registry Players (source unique INIT_PLAYERS_KEY)
 * - Stockage: ScriptProperties
 * - Clé: INIT_PLAYERS_KEY(mid) (mid normalisé)
 * - Compat: lit aussi une éventuelle clé legacy (mid non normalisé)
 * ============================================================
 */

const REG_PLAYERS_KEY = (mid) => INIT_PLAYERS_KEY(mid);

function _regProps_() {
  return PropertiesService.getScriptProperties();
}

// Normalise MID (id/url/"id")
function _reg_mjId_(mid){
  if (typeof _coerceFileId_ === "function"){
    return _coerceFileId_(mid, INIT_MJ_SHEET_ID);
  }
  return String(mid || "").trim().replace(/^["']+|["']+$/g, "") || INIT_MJ_SHEET_ID;
}

function _reg_readIds_(mid) {
  const rawMid = String(mid || "").trim() || INIT_MJ_SHEET_ID;
  const cleanMid = _reg_mjId_(rawMid);

  const keys = [REG_PLAYERS_KEY(cleanMid)];
  if (rawMid !== cleanMid) keys.push(REG_PLAYERS_KEY(rawMid)); // legacy possible

  const all = [];
  for (const k of keys){
    const raw = _regProps_().getProperty(k);
    const arr = raw ? _safeJsonParse_(raw, []) : [];
    const ids = (Array.isArray(arr) ? arr : [])
      .map(x => {
        if (typeof x === "string") return x;
        if (x && typeof x === "object" && x.fid) return String(x.fid);
        return "";
      })
      .map(s => String(s || "").trim())
      .filter(Boolean);

    all.push(...ids);
  }

  // dedupe en conservant l’ordre
  const seen = new Set();
  const uniq = all.filter(fid => (seen.has(fid) ? false : (seen.add(fid), true)));

  // ✅ migration auto si on a trouvé des IDs via la clé legacy
  // (on écrit tout dans la clé clean, et on supprime l’ancienne)
  if (rawMid !== cleanMid){
    const legacyKey = REG_PLAYERS_KEY(rawMid);
    const cleanKey  = REG_PLAYERS_KEY(cleanMid);
    const legacyRaw = _regProps_().getProperty(legacyKey);

    if (legacyRaw && legacyKey !== cleanKey){
      _regProps_().setProperty(cleanKey, JSON.stringify(uniq));
      _regProps_().deleteProperty(legacyKey);
    }
  }

  return uniq;
}

function _reg_writeIds_(mid, ids) {
  const cleanMid = _reg_mjId_(mid);
  _regProps_().setProperty(REG_PLAYERS_KEY(cleanMid), JSON.stringify(ids || []));
}

function reg_getPlayers(mid) {
  const cleanMid = _reg_mjId_(mid);
  const ids = _reg_readIds_(cleanMid);

  const players = ids.map(fid => {
    const sheetPerso = INIT_PLAYER_SHEET || "Personnage";
    try {
      const info = _readPlayerIdentity_(fid);
      return {
        fid,
        active: true,
        sheetPerso,
        label: info.label,
        joueur: info.joueur,
        perso: info.perso,
        baseInit: info.baseInit
      };
    } catch (e) {
      return {
        fid,
        active: true,
        sheetPerso,
        label: "⚠️ Erreur lecture",
        joueur: "",
        perso: "",
        baseInit: 0,
        error: String(e?.message || e)
      };
    }
  });

  return { mid: cleanMid, players };
}

function reg_addPlayer(mid, linkOrId /*, meta */) {
  const cleanMid = _reg_mjId_(mid);

  const fid = _extractFileId_(linkOrId);
  const ids = _reg_readIds_(cleanMid);

  if (ids.includes(fid)) return { ok: false, message: "Déjà dans la liste." };

  _readPlayerIdentity_(fid);

  try { _installOnEditTriggerForFid_(fid); } catch (e) {}

  ids.push(fid);
  _reg_writeIds_(cleanMid, ids);

  return { ok: true };
}

function reg_removePlayer(mid, index) {
  const cleanMid = _reg_mjId_(mid);

  const i = Number(index);
  const ids = _reg_readIds_(cleanMid);

  if (!Number.isFinite(i) || i < 0 || i >= ids.length) {
    throw new Error("Index invalide.");
  }

  ids.splice(i, 1);
  _reg_writeIds_(cleanMid, ids);

  return { ok: true };
}

function reg_setActive(mid, index, active) {
  return {
    ok: false,
    message: "Mode source unique: 'active' n'est pas stocké. (Implémentable via une clé séparée si tu veux.)"
  };
}
