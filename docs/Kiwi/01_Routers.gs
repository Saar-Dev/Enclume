/**
 * ============================================================
 * 01_Router.gs — Polaris WebApp Router
 * - doGet router (page + fid/mid)
 * - include()
 * ============================================================
 */

function doGet(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  const page = String(p.page || "home").toLowerCase().trim();

  const fid = String(p.fid || p.sid || "").trim();

  // ✅ auto-mid côté serveur pour les pages Trade
  let mid = String(p.mid || "").trim();
  if (!mid && (page === "trade_player" || page === "trade_mj")) {
    mid = String(TRADE_DEFAULT_MJ_ID || "").trim();
  }

  const tok = String(p.t || p.tok || "").trim();
  const raw = String(p.raw || "").trim();
  const debug = String(p.debug || "").trim();

  function _json_(obj, pretty) {
    return ContentService
      .createTextOutput(JSON.stringify(obj, null, pretty ? 2 : 0))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ==========================================================
  // ENDPOINTS JSON
  // ==========================================================
  if (page === "initiative_ping") {
    const fidPing = String(p.fid || "").trim();
    const out = init_pingForFid(fidPing);
    return _json_(out);
  }

  if (page === "init_install_triggers") {
    const midParam = String(p.mid || "").trim() || INIT_MJ_SHEET_ID;
    const out = init_mj_installOnEditForPlayers(midParam);
    return _json_(out);
  }

  if (page === "init_audit_triggers") {
    const midParam = String(p.mid || "").trim() || INIT_MJ_SHEET_ID;
    const out = init_mj_auditOnEditTriggers(midParam);
    return _json_(out);
  }

  if (page === "reload_weapon") {
    const fidParam = String(p.fid || p.sid || "").trim();
    if (!fidParam) return _json_({ ok: false, error: "FID manquant (?fid=...)" });
    const out = reload_weapon(fidParam);
    return _json_(out);
  }

  if (page === "reload_drone") {
    const fidParam = String(p.fid || p.sid || "").trim();
    if (!fidParam) return _json_({ ok: false, error: "FID manquant (?fid=...)" });
    const out = reload_drone(fidParam);
    return _json_(out);
  }

  if (page === "sync_bdd") {
    const fidParam = String(p.fid || p.sid || "").trim();
    if (!fidParam) return _json_({ ok: false, error: "FID manquant (?fid=...)" });
    const out = syncDepuisBDDPolaris(fidParam);
    return _json_(out);
  }

  if (page === "debug_npc_roster") {
    const midParam = String(p.mid || "").trim() || INIT_MJ_SHEET_ID;
    const out = combat_mj_debugNpcRoster(midParam);
    return _json_(out);
  }

  if (page === "debug_best_entity" || page === "debug_best_roster" || page === "debug_best_sheet") {
    const midParam = String(p.mid || "").trim() || INIT_MJ_SHEET_ID;
    const out = debug_best_router_(page, { mid: midParam });
    return _json_(out);
  }

  if (page === "debug_entities") {
    const midParam = String(p.mid || "").trim() || INIT_MJ_SHEET_ID;
    const out = combat_mj_getEntities(midParam);
    return _json_(out, true);
  }

  if (page === "debug_skills_best") {
    const midParam = String(p.mid || "").trim() || INIT_MJ_SHEET_ID;
    const name = String(p.name || "").trim();
    const out = combatsk_debugBest(midParam, name);
    return _json_(out, true);
  }

  // ==========================================================
  // PAGES HTML
  // ==========================================================
  const needsFid = ["competences", "bourse", "combat", "initiative_player", "trade_player", "crafting", "inventory"].includes(page);
  const needsMid = ["initiative_mj", "registry_mj", "combat_mj", "trade_mj", "trade_player"].includes(page);

  if (needsFid && !fid) return HtmlService.createHtmlOutput("FID manquant (?fid=...)");
  if (needsMid && !mid) return HtmlService.createHtmlOutput("MID manquant (?mid=...)");

  const file = routeToFile_(page);

  if (raw === "1") {
    const out = { page, fid, mid, tok, file, params: p };
    return _json_(out, true);
  }

  const t = HtmlService.createTemplateFromFile(file);
  t.page = page;
  t.fid  = fid;
  t.sid  = fid;
  t.mid  = mid;
  t.tok  = tok;

  t.__debug = (debug === "1")
    ? { page, fid, mid, tok, file, params: p }
    : null;

  return t.evaluate()
    .setTitle("Polaris — " + page)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function routeToFile_(page) {
  const map = {
    home: "Home",
    competences: "Competences",
    bourse: "Bourse",
    combat: "ModificateursCombat",

    initiative_mj: "InitiativeMJ",
    initiative_player: "InitiativePlayer",
    initiative_ping: "InitiativePing",

    registry_mj: "RegistryMJ",
    combat_mj: "CombatMJ",

    trade_mj: "TradeMJ",
    trade_player: "TradePlayer",

    crafting: "Crafting",
    inventory: "Inventory"
  };
  return map[page] || "Home";
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}