
/*************************************************************
 * Trade_WebApp.gs Ã¢â‚¬â€ Trade API V3
 * - navigation joueur en 2 temps (tree + catÃƒÂ©gorie)
 * - stockage marchand simplifiÃƒÂ©
 * - boot sans crÃƒÂ©ation implicite
 *************************************************************/

function trade_web_cleanId_(s){
  s = String(s || "").trim();
  for (let i = 0; i < 3; i++){
    s = s.replace(/^['"`]+/, "").replace(/['"`]+$/, "").trim();
  }
  return s;
}

function trade_web_isSpreadsheetId_(s){
  s = trade_web_cleanId_(s);
  if (!s) return false;
  if (s.indexOf(" ") >= 0) return false;
  return /^[a-zA-Z0-9-_]{25,}$/.test(s);
}

function trade_web_placeholderMerchant_(merchantId){
  return {
    id: String(merchantId || "").trim(),
    name: "",
    status: "CLOSED",
    allowed: "",
    modGlobal: 0,
    ntMax: TRADE_MAX_NT,
    nivMax: TRADE_DEFAULT_NIV_MAX,
    genMax: TRADE_MAX_GEN,
    dispoMin: "",
    cDevice: 0,
    updatedAt: ""
  };
}

function trade_web_safe_(fn){
  try{
    const out = fn();
    if (out === undefined || out === null){
      return { ok:false, error:"API a renvoyÃƒÂ© null/undefined (bug return)." };
    }
    return out;
  }catch(e){
    return { ok:false, error:String(e && e.message ? e.message : e) };
  }
}

/* =========================
 * API MJ
 * ========================= */

function trade_api_mj_boot(mid){
  return trade_web_safe_(() => {
    mid = trade_web_cleanId_(mid);

    if (!mid) return { ok:false, error:"MID manquant", merchants:[], players:[], equipRef:[] };
    if (!trade_web_isSpreadsheetId_(mid)) return { ok:false, error:"MID invalide", merchants:[], players:[], equipRef:[] };

    trade_json_ensure_(mid);

    const merchants = trade_listMerchants_(mid);
    const players =
      (typeof trade_mj_listPlayersDetailed_ === "function") ? trade_mj_listPlayersDetailed_(mid) :
      (typeof reg_getPlayers === "function" ? (((reg_getPlayers(mid) || {}).players) || []) : []);

    const equipRef =
      (typeof trade_mj_loadEquipRef_ === "function") ? trade_mj_loadEquipRef_() : [];

    return { ok:true, merchants, players, equipRef };
  });
}

function trade_api_mj_loadMerchant(mid, merchantId){
  return trade_web_safe_(() => {
    mid = trade_web_cleanId_(mid);
    merchantId = String(merchantId || "").trim();

    const placeholder = trade_web_placeholderMerchant_(merchantId);

    if (!mid) return { ok:false, error:"MID manquant", merchant:placeholder, rules:[] };
    if (!trade_web_isSpreadsheetId_(mid)) return { ok:false, error:"MID invalide", merchant:placeholder, rules:[] };
    if (!merchantId) return { ok:false, error:"merchantId manquant", merchant:placeholder, rules:[] };

    trade_json_ensure_(mid);

    const merchant = trade_getMerchant_(mid, merchantId);
    const rules = trade_listRules_(mid, merchantId);

    return {
      ok:true,
      merchant: merchant || placeholder,
      rules: Array.isArray(rules) ? rules : []
    };
  });
}

function trade_api_mj_getMerchant2(mid, merchantId){ return trade_api_mj_loadMerchant(mid, merchantId); }
function trade_api_mj_getMerchant(mid, merchantId){ return trade_api_mj_loadMerchant(mid, merchantId); }

function trade_api_mj_createMerchant(mid, name){
  return trade_web_safe_(() => {
    mid = trade_web_cleanId_(mid);
    if (!mid) return { ok:false, error:"MID manquant" };
    if (!trade_web_isSpreadsheetId_(mid)) return { ok:false, error:"MID invalide" };

    trade_json_ensure_(mid);
    return trade_json_createMerchant_(mid, name);
  });
}

function trade_api_mj_deleteMerchant(mid, merchantId){
  return trade_web_safe_(() => {
    mid = trade_web_cleanId_(mid);
    merchantId = String(merchantId || "").trim();

    if (!mid) return { ok:false, error:"MID manquant" };
    if (!trade_web_isSpreadsheetId_(mid)) return { ok:false, error:"MID invalide" };
    if (!merchantId) return { ok:false, error:"merchantId manquant" };

    trade_json_ensure_(mid);
    return trade_json_deleteMerchant_(mid, merchantId);
  });
}

function trade_api_mj_saveMerchant(mid, payload){
  return trade_web_safe_(() => {
    mid = trade_web_cleanId_(mid);

    if (!mid) return { ok:false, error:"MID manquant" };
    if (!trade_web_isSpreadsheetId_(mid)) return { ok:false, error:"MID invalide" };

    trade_json_ensure_(mid);

    const merchantId = String(payload && payload.merchant && payload.merchant.id || "").trim();
    if (!merchantId) return { ok:false, error:"merchant.id manquant" };

    const m = payload.merchant || {};
    const rules = Array.isArray(payload.rules) ? payload.rules : [];

    return trade_json_upsertMerchant_(mid, {
      id: merchantId,
      name: String(m.name || "").trim(),
      status: String(m.status || "CLOSED").toUpperCase(),
      allowed: String(m.allowed || "").trim(),
      modGlobal: m.modGlobal,
      ntMax: m.ntMax,
      nivMax: m.nivMax,
      genMax: m.genMax,
      dispoMin: m.dispoMin,
      cDevice: m.cDevice
    }, rules);
  });
}

function trade_api_mj_save(mid, payload){ return trade_api_mj_saveMerchant(mid, payload); }

function trade_api_mj_getItemDetails(mid, itemKey){
  return trade_web_safe_(() => {
    mid = trade_web_cleanId_(mid);
    itemKey = String(itemKey || "").trim();

    if (!mid) return { ok:false, error:"MID manquant", key:itemKey, desc:"" };
    if (!trade_web_isSpreadsheetId_(mid)) return { ok:false, error:"MID invalide", key:itemKey, desc:"" };
    if (!itemKey) return { ok:false, error:"itemKey manquant", key:itemKey, desc:"" };

    const map = trade_fetchDescriptionsByKeys_([itemKey]);
    return { ok:true, key:itemKey, desc:String(map[itemKey] || "").trim() };
  });
}

/* =========================
 * API JOUEUR
 * ========================= */

function trade_api_player_getContext(fid, mid){
  return trade_web_safe_(() =>
    trade_player_getContext_(trade_web_cleanId_(fid), trade_web_cleanId_(mid), "")
  );
}

function trade_api_player_getCatalogTree(fid, mid, merchantId, query){
  return trade_web_safe_(() => ({
    ok: true,
    tree: trade_getCatalogTree_(
      trade_web_cleanId_(fid),
      trade_web_cleanId_(mid),
      String(merchantId || "").trim(),
      query
    )
  }));
}

function trade_api_player_getCategoryItems(fid, mid, merchantId, fam, cat, query, limit){
  return trade_web_safe_(() => ({
    ok: true,
    items: trade_getCategoryItems_(
      trade_web_cleanId_(fid),
      trade_web_cleanId_(mid),
      String(merchantId || "").trim(),
      fam,
      cat,
      query,
      limit
    )
  }));
}

function trade_api_player_getLine(mid, merchantId, itemKey, opts){
  return trade_web_safe_(() =>
    trade_calcLine_(trade_web_cleanId_(mid), String(merchantId || "").trim(), itemKey, opts)
  );
}

function trade_api_player_prepareCheckout(fid, mid, merchantId, cart){
  return trade_web_safe_(() =>
    trade_checkout_prepare_(
      trade_web_cleanId_(fid),
      trade_web_cleanId_(mid),
      String(merchantId || "").trim(),
      cart
    )
  );
}

function trade_api_player_commitCheckout(fid, draftToken, storageAssignments){
  return trade_web_safe_(() =>
    trade_checkout_commit_(
      trade_web_cleanId_(fid),
      String(draftToken || "").trim(),
      storageAssignments || {}
    )
  );
}

function trade_api_player_getItemDetails(mid, itemKey){
  return trade_api_mj_getItemDetails(mid, itemKey);
}
