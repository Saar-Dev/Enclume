/**
 * ============================================================
 * 20_Initiative_AllV3.gs — Initiative (Moteur V3 + API compat init_*)
 * - Un seul fichier
 * - Stockage unique : CINITV3_* (V3)
 * - MJ UI (combat_init_mj_*) / PJ UI (combat_init_player_*)
 * - Retarde son action :
 *    - stocké sur la soumission (sub.delayed = true)
 *    - EXCLU de l’ordre verrouillé (PLAY)
 *    - visible côté MJ (delayedPlayers)
 *
 * Patch important:
 * - IniModMalActions = modificateur initiative issu du HTML joueur (total)
 * - ActionModMalCombat = malus d’action (actionMalus == attackMalus) (somme)
 * - Se précipiter peut générer un malus d’action (-5) => inclus dans ActionModMalCombat
 * ============================================================
 */

/* ============================================================
   V3 — Keys / helpers
============================================================ */
const CINIT_PREFIX = "CINITV3_";

const CINIT_ACTIVE_BY_MID = (mid) => `${CINIT_PREFIX}ACTIVE_FOR_MID_${String(mid || "").trim()}`;
const CINIT_ACTIVE_BY_FID = (fid) => `${CINIT_PREFIX}ACTIVE_FOR_FID_${String(fid || "").trim()}`;
const CINIT_COMBAT_KEY    = (cid) => `${CINIT_PREFIX}COMBAT_${String(cid || "").trim()}`;

// Réfs fiche joueur (nom de plage ou A1)
const INIT_PLAYER_MOD_ACTIONS_CELL = "IniModMalActions";
const INIT_PLAYER_ACTION_MALUS_CELL = "ActionModMalCombat";

function _cinit_props_(){ return PropertiesService.getScriptProperties(); }
function _cinit_lock_(){ return LockService.getScriptLock(); }

function _cinit_uid_(){
  try{ if (typeof _uid_ === "function") return _uid_(); }catch(_){}
  return "CI_" + Utilities.getUuid().replace(/-/g,"").slice(0,12);
}
function _cinit_nowIso_(){
  try{ if (typeof _nowIso_ === "function") return _nowIso_(); }catch(_){}
  return new Date().toISOString();
}
function _cinit_safeJsonParse_(txt, fallback){
  try{ if (typeof _safeJsonParse_ === "function") return _safeJsonParse_(txt, fallback); }catch(_){}
  try{ return JSON.parse(txt); }catch(_){ return fallback; }
}

function _cinit_readCombat_(combatId){
  const raw = _cinit_props_().getProperty(CINIT_COMBAT_KEY(combatId));
  if (!raw) return null;
  return _cinit_safeJsonParse_(raw, null);
}
function _cinit_writeCombat_(combat){
  _cinit_props_().setProperty(CINIT_COMBAT_KEY(combat.id), JSON.stringify(combat));
}
function _cinit_clearCombat_(combat){
  if (!combat) return;

  const mid = String(combat.mid || "").trim();
  if (mid) _cinit_props_().deleteProperty(CINIT_ACTIVE_BY_MID(mid));

  const players = Array.isArray(combat.players) ? combat.players : [];
  players.forEach(p=>{
    const fid = String(p?.fid || "").trim();
    if (fid) _cinit_props_().deleteProperty(CINIT_ACTIVE_BY_FID(fid));
  });

  if (combat.id) _cinit_props_().deleteProperty(CINIT_COMBAT_KEY(combat.id));
}

/* ============================================================
   Compat “MJ sheet” (optionnel)
============================================================ */
function _openMjSheet_() { return SpreadsheetApp.openById(INIT_MJ_SHEET_ID); }

function _getMjTab_() {
  const ss = _openMjSheet_();
  let sh = ss.getSheetByName(INIT_MJ_TAB_NAME);
  if (!sh) sh = ss.insertSheet(INIT_MJ_TAB_NAME);

  sh.getRange(1, MJ_COL_NAME).setValue("Nom");
  sh.getRange(1, MJ_COL_SCORE).setValue("Score");
  sh.getRange(1, MJ_COL_SIDE).setValue("Camp");
  sh.getRange(1, MJ_COL_DETAIL).setValue("Détails");
  sh.getRange(1, MJ_COL_TS).setValue("Maj");

  return sh;
}

function _upsertMjRow_(name, score, camp, detail) {
  const sh = _getMjTab_();
  const lastRow = Math.max(2, sh.getLastRow());
  const colNames = sh.getRange(2, MJ_COL_NAME, lastRow - 1, 1)
    .getValues()
    .map(r => String(r[0] || "").trim());

  let row = colNames.findIndex(v => v === name);
  row = (row === -1) ? -1 : (row + 2);

  if (row === -1) {
    const empty = colNames.findIndex(v => v === "");
    row = (empty === -1) ? (lastRow + 1) : (empty + 2);
  }

  sh.getRange(row, MJ_COL_NAME).setValue(name);
  sh.getRange(row, MJ_COL_SCORE).setValue(Number(score) || 0);
  sh.getRange(row, MJ_COL_SIDE).setValue(String(camp || ""));
  sh.getRange(row, MJ_COL_DETAIL).setValue(String(detail || ""));
  sh.getRange(row, MJ_COL_TS).setValue(new Date());
}

/* ============================================================
   Lecture identité PJ (plages nommées OU refs A1)
============================================================ */
function _cinit_getPlayerRange_(ss, sh, refOrName){
  const key = String(refOrName || "").trim();
  if (!key) throw new Error("Référence de cellule/plage manquante.");

  const named = ss.getRangeByName(key);
  if (named) return named;

  try{
    return sh.getRange(key);
  }catch(_){}

  throw new Error(`Référence introuvable dans la fiche joueur : ${key}`);
}

function _readPlayerIdentity_(fid) {
  const ss = SpreadsheetApp.openById(fid);
  const sh = ss.getSheetByName(INIT_PLAYER_SHEET);
  if (!sh) throw new Error("Onglet Personnage introuvable dans la fiche joueur.");

  const perso = String(_cinit_getPlayerRange_(ss, sh, INIT_PLAYER_NAME_CELL).getDisplayValue() || "").trim();
  const joueur = String(_cinit_getPlayerRange_(ss, sh, INIT_PLAYER_JOUEUR_CELL).getDisplayValue() || "").trim();
  const baseInit = Number(_cinit_getPlayerRange_(ss, sh, INIT_PLAYER_BASEINIT_CELL).getValue() || 0) || 0;

  const label = [perso, joueur].filter(Boolean).join(" - ") || "(Sans nom)";
  return { fid, perso, joueur, label, baseInit };
}

/* ============================================================
   BEST weapon mod hook (si ton module Combat MJ le fournit)
============================================================ */
function _cinit_bestWeaponMod_(mid, entityId){
  try{
    if (typeof combat_mj_getBestWeaponMod === "function"){
      return Number(combat_mj_getBestWeaponMod(mid, entityId) || 0) || 0;
    }
  }catch(_){}
  return 0;
}

/* ============================================================
   Roster / players build
============================================================ */
function _cinit_normCamp_(camp){
  const s = String(camp || "").trim();
  const sl = s.toLowerCase();
  if (sl.includes("alli")) return "Allié";
  if (sl.includes("ennem")) return "Ennemi";
  return s || "Ennemi";
}

function _cinit_buildRosterPnjs_(mid){
  if (typeof reg_getNpcRoster !== "function") throw new Error("reg_getNpcRoster introuvable.");

  const r = reg_getNpcRoster(String(mid||"").trim());
  const roster = (r && Array.isArray(r.roster)) ? r.roster : [];

  return roster.map(n=>{
    const id = String(n?.id || "").trim();
    if (!id) return null;

    return {
      id,
      name: String(n?.name || "PNJ").trim(),
      camp: _cinit_normCamp_(n?.camp),
      baseInit: Number(n?.baseInit || 0) || 0,
      source: String(n?.source || "PNJ"),
      templateKey: String(n?.templateKey || ""),
      fid: String(n?.fid || "").trim()
    };
  }).filter(Boolean);
}

function _cinit_buildPlayers_(mid, selectedFids){
  if (typeof reg_getPlayers !== "function") throw new Error("reg_getPlayers introuvable.");

  const r = reg_getPlayers(String(mid||"").trim());
  const arr = (r && Array.isArray(r.players)) ? r.players : [];

  const wanted = new Set(
    (Array.isArray(selectedFids) ? selectedFids : [])
      .map(x=>String(x||"").trim())
      .filter(Boolean)
  );
  const useFilter = wanted.size > 0;

  return arr
    .map(p=>{
      const fid = String(p?.fid || "").trim();
      if (!fid) return null;
      if (useFilter && !wanted.has(fid)) return null;

      try{
        const info = _readPlayerIdentity_(fid);
        return {
          fid: info.fid,
          label: info.label || p.label || fid,
          perso: info.perso || "",
          joueur: info.joueur || "",
          baseInit: Number(info.baseInit || 0) || 0,
          camp: "Joueur"
        };
      }catch(e){
        return {
          fid,
          label: p.label || "⚠️ Erreur lecture",
          perso: "",
          joueur: "",
          baseInit: 0,
          camp: "Joueur",
          error: String(e?.message || e)
        };
      }
    })
    .filter(Boolean);
}

function _cinit_rosterHash_(pnjs){
  const a = (Array.isArray(pnjs) ? pnjs : []).map(n=>[
    String(n?.id || ""),
    String(n?.name || ""),
    String(n?.camp || ""),
    String(n?.source || ""),
    String(Number(n?.baseInit || 0))
  ]);

  a.sort((x,y)=> (x[0]<y[0]?-1:x[0]>y[0]?1:0));
  return JSON.stringify(a);
}

/* ============================================================
   Retard — détection STRICTE (pas de regex/keywords)
   ✅ Supporte le contrat Player HTML: choices[].flag === "DELAY_ACTION"
============================================================ */
function _cinit_isDelayedPayload_(payload){
  const p = payload || {};

  if (p.delayed === true) return true;
  if (p.delay === true) return true;
  if (p.retarde === true) return true;
  if (p.retardeAction === true) return true;

  {
    const f = String(p.flag || "").trim().toUpperCase();
    if (f === "DELAY_ACTION") return true;
  }

  const choices = Array.isArray(p.choices) ? p.choices : [];
  for (const c of choices){
    if (!c) continue;

    if (c.delayed === true) return true;
    if (c.delay === true) return true;
    if (c.retarde === true) return true;
    if (c.retardeAction === true) return true;

    const cf = String(c.flag || "").trim().toUpperCase();
    if (cf === "DELAY_ACTION") return true;

    const mf = String(c.meta && c.meta.flag ? c.meta.flag : "").trim().toUpperCase();
    if (mf === "DELAY_ACTION") return true;
  }

  return false;
}

/* ============================================================
   Attaque multiple — lecture STRICTE
   Contrat Player HTML:
   choices[] contient { flag:"MULTI_ATTACK", count:2|3, actionMalus:-5|-7 }
============================================================ */
function _cinit_getMultiAttackCount_(choices){
  const arr = Array.isArray(choices) ? choices : [];
  let best = 1;
  for (const c of arr){
    const f = String(c?.flag || c?.meta?.flag || "").trim().toUpperCase();
    if (f !== "MULTI_ATTACK") continue;

    const n = Number(c?.count ?? c?.meta?.count);
    if (n === 2 || n === 3) best = Math.max(best, n);
  }
  return best;
}

function _cinit_stripMultiAttackChoices_(choices){
  const arr = Array.isArray(choices) ? choices : [];
  return arr.filter(c => String(c?.flag || c?.meta?.flag || "").trim().toUpperCase() !== "MULTI_ATTACK");
}

function _cinit_delayedFidsFromCombat_(combat){
  const subs = combat?.submissions || {};
  const out = [];
  Object.keys(subs).forEach(fid=>{
    const sub = subs[fid];
    if (sub && sub.delayed === true) out.push(String(fid||"").trim());
  });
  return out.filter(Boolean);
}

/* ============================================================
   Build Order (scores)
============================================================ */
function _cinit_applyDisplayNumbering_(rows){
  const bestRows = rows.filter(r =>
    String(r?.kind || "") === "PNJ" &&
    String(r?.source || "").toUpperCase() === "BEST"
  );

  const groups = Object.create(null);

  bestRows.forEach(r=>{
    const name = String(r?.name || "").trim();
    if (!groups[name]) groups[name] = [];
    groups[name].push(r);
  });

  Object.keys(groups).forEach(k=>{
    const g = groups[k] || [];
    if (g.length <= 1) return;

    const already = g.every(x => /\s#\d+\s*$/i.test(String(x?.name || "")));
    if (already) return;

    g.forEach((x,i)=>{
      x.name = String(x.name || k).trim() + " #" + (i+1);
    });
  });
}

function _cinit_buildOrder_(combat){
  const rows = [];

  const delayedSet = new Set(
    Array.isArray(combat?.delayedFids) ? combat.delayedFids.map(x=>String(x||"").trim()).filter(Boolean)
    : _cinit_delayedFidsFromCombat_(combat)
  );

  // Players
  (combat.players || []).forEach(p=>{
    const fid = String(p?.fid || "").trim();
    const sub = (combat.submissions && fid) ? (combat.submissions[fid] || null) : null;

    if (fid && delayedSet.has(fid)) return;

    const baseInit = Number(p?.baseInit || 0) || 0;
    const total = sub ? (Number(sub.total || 0) || 0) : 0;
    const final = baseInit + total;

    const baseDetail = sub
      ? (Array.isArray(sub.options) ? sub.options.join(" | ") : "")
      : "⏳ pas répondu";

    const choices = sub ? (sub.choices || []) : [];

    const multi = sub ? _cinit_getMultiAttackCount_(choices) : 1;

    rows.push({
      kind: "PLAYER",
      id: fid,
      name: p?.label || fid,
      camp: "Joueur",
      score: final,
      detail: baseDetail,
      choices
    });

    if (sub && (multi === 2 || multi === 3)){
      for (let i = 2; i <= multi; i++){
        const delta = (i - 1) * 5;
        rows.push({
          kind: "PLAYER",
          id: fid,
          name: (p?.label || fid) + " (Attaque " + i + "/" + multi + ")",
          camp: "Joueur",
          score: final - delta,
          detail: (baseDetail ? (baseDetail + " | ") : "") + ("Attaque " + i + "/" + multi),
          choices
        });
      }
    }
  });

  // PNJs
  (combat.pnjs || []).forEach(n=>{
    const src = String(n?.source || "PNJ").toUpperCase();
    let score = Number(n?.baseInit || 0) || 0;

    if (src === "BEST"){
      score += _cinit_bestWeaponMod_(String(combat.mid||"").trim(), String(n?.id||"").trim());
    }

    rows.push({
      kind: "PNJ",
      id: String(n?.id || ""),
      name: n?.name || "PNJ",
      camp: n?.camp || "Ennemi",
      score,
      detail: (src === "BEST") ? "Bestiaire" : "PNJ",
      choices: [],
      source: src
    });
  });

  rows.sort((a,b)=> Number(b.score||0) - Number(a.score||0));
  _cinit_applyDisplayNumbering_(rows);
  return rows;
}

/* ============================================================
   Sanitize combat vs current roster (pnjs changes)
============================================================ */
function _cinit_sanitizeCombat_(combat, rosterNow){
  let changed = false;

  const roster = Array.isArray(rosterNow) ? rosterNow : [];
  const byId = Object.create(null);
  roster.forEach(n=>{
    const id = String(n?.id || "").trim();
    if (id) byId[id] = n;
  });

  const phase = String(combat.status || "COLLECT").toUpperCase();

  if (phase === "COLLECT"){
    combat.pnjs = roster.slice();
    changed = true;
  } else {
    const before = Array.isArray(combat.pnjs) ? combat.pnjs : [];
    const after = [];

    before.forEach(n=>{
      const id = String(n?.id || "").trim();
      const live = id ? (byId[id] || null) : null;
      if (!live){ changed = true; return; }

      const merged = {
        id,
        name: String(live.name || n.name || "PNJ").trim(),
        camp: _cinit_normCamp_(live.camp || n.camp),
        baseInit: Number((live.baseInit ?? n.baseInit) || 0) || 0,
        source: String(live.source || n.source || "PNJ"),
        templateKey: String(live.templateKey || n.templateKey || ""),
        fid: String(live.fid || n.fid || "").trim()
      };

      if (merged.name !== n.name ||
          merged.camp !== n.camp ||
          Number(merged.baseInit) !== Number(n.baseInit) ||
          merged.source !== n.source){
        changed = true;
      }

      after.push(merged);
    });

    combat.pnjs = after;
  }

  const order = Array.isArray(combat.order) ? combat.order : [];
  if (order.length){
    const allowedPnjIds = new Set((combat.pnjs||[]).map(x=>String(x?.id||"").trim()).filter(Boolean));
    const playerFids = new Set((combat.players||[]).map(p=>String(p?.fid||"").trim()).filter(Boolean));

    const newOrder = [];

    order.forEach(it=>{
      const kind = String(it?.kind||"").toUpperCase();
      const id = String(it?.id||"").trim();

      if (kind === "PLAYER"){
        if (!playerFids.has(id)){ changed = true; return; }
        newOrder.push(it);
        return;
      }

      if (!allowedPnjIds.has(id)){ changed = true; return; }

      const live = (combat.pnjs||[]).find(x=>String(x?.id||"").trim() === id) || null;

      if (live){
        const src = String(live.source || "PNJ").toUpperCase();
        let score = Number(live.baseInit || 0) || 0;
        if (src === "BEST"){
          score += _cinit_bestWeaponMod_(String(combat.mid||"").trim(), id);
        }

        const upd = {
          kind: it.kind,
          id: it.id,
          name: String(live.name || it.name || "PNJ").trim(),
          camp: _cinit_normCamp_(live.camp || it.camp),
          score,
          detail: (src === "BEST") ? "Bestiaire" : "PNJ",
          choices: it.choices || [],
          source: src
        };

        if (upd.name !== it.name || upd.camp !== it.camp || Number(upd.score) !== Number(it.score) || upd.detail !== it.detail){
          changed = true;
        }

        newOrder.push(upd);
      } else {
        newOrder.push(it);
      }
    });

    combat.order = newOrder;

    const maxIdx = Math.max(0, newOrder.length - 1);
    const oldIdx = Number(combat.focusIndex || 0) || 0;
    const newIdx = Math.min(maxIdx, Math.max(0, oldIdx));
    if (newIdx !== oldIdx){ combat.focusIndex = newIdx; changed = true; }
  }

  const newHash = _cinit_rosterHash_(combat.pnjs || []);
  if (combat.rosterHash !== newHash){
    combat.rosterHash = newHash;
    changed = true;
  }

  return changed;
}

/* ============================================================
   V3 — MJ API
============================================================ */
function combat_init_mj_getState(mid){
  mid = String(mid || "").trim();
  if (!mid) throw new Error("MID manquant");

  const combatId = _cinit_props_().getProperty(CINIT_ACTIVE_BY_MID(mid));
  if (!combatId) return { ok:true, active:false, phase:"IDLE" };

  let combat = _cinit_readCombat_(combatId);
  if (!combat){
    _cinit_props_().deleteProperty(CINIT_ACTIVE_BY_MID(mid));
    return { ok:true, active:false, phase:"IDLE" };
  }

  try{
    const rosterNow = _cinit_buildRosterPnjs_(mid);
    const hashNow = _cinit_rosterHash_(rosterNow);
    if (combat.rosterHash !== hashNow){
      const lock = _cinit_lock_();
      if (lock.tryLock(1500)){
        try{
          const fresh = _cinit_readCombat_(combatId);
          if (fresh){
            const roster2 = _cinit_buildRosterPnjs_(mid);
            const changed = _cinit_sanitizeCombat_(fresh, roster2);
            if (changed){
              fresh.updatedAt = _cinit_nowIso_();
              _cinit_writeCombat_(fresh);
            }
            combat = fresh;
          }
        } finally {
          try{ lock.releaseLock(); }catch(_){}
        }
      }
    }
  }catch(_){}

  const phase = String(combat.status || "COLLECT").toUpperCase();
  const round = Number(combat.round || 1) || 1;

  const players = Array.isArray(combat.players) ? combat.players : [];
  const subs = combat.submissions || {};

  const playerStatus = players.map(p=>{
    const fid = String(p?.fid || "").trim();
    const sub = fid ? (subs[fid] || null) : null;

    return {
      fid,
      name: p?.label || fid,
      baseInit: Number(p?.baseInit || 0) || 0,
      submitted: !!sub,
      delayed: !!(sub && sub.delayed === true),
      ts: sub ? (sub.ts || null) : null,
      final: sub ? (sub.final ?? null) : null
    };
  });

  const delayedFids = Array.isArray(combat.delayedFids)
    ? combat.delayedFids.map(x=>String(x||"").trim()).filter(Boolean)
    : _cinit_delayedFidsFromCombat_(combat);

  const delayedPlayers = playerStatus.filter(x=>x.delayed);

  const order = Array.isArray(combat.order) ? combat.order : [];
  const focusIndex = Number(combat.focusIndex || 0) || 0;

  return {
    ok:true,
    active:true,
    phase,
    round,
    combatId: combat.id,
    players: playerStatus,
    responded: playerStatus.filter(x=>x.submitted).length,
    totalPlayers: playerStatus.length,
    delayedFids,
    delayedPlayers,
    order,
    focusIndex,
    focus: order[focusIndex] || null
  };
}

function combat_init_mj_start(mid, selectedFids){
  mid = String(mid || "").trim();
  if (!mid) throw new Error("MID manquant");

  const lock = _cinit_lock_();
  lock.waitLock(8000);
  try{
    const prevId = _cinit_props_().getProperty(CINIT_ACTIVE_BY_MID(mid));
    if (prevId){
      const prev = _cinit_readCombat_(prevId);
      if (prev) _cinit_clearCombat_(prev);
      else _cinit_props_().deleteProperty(CINIT_ACTIVE_BY_MID(mid));
    }

    const players = _cinit_buildPlayers_(mid, selectedFids);
    const pnjs = _cinit_buildRosterPnjs_(mid);

    const combat = {
      id: _cinit_uid_(),
      mid,
      status: "COLLECT",
      createdAt: _cinit_nowIso_(),
      updatedAt: _cinit_nowIso_(),
      round: 1,
      focusIndex: 0,
      players,
      pnjs,
      submissions: {},
      order: [],
      delayedFids: [],
      rosterHash: _cinit_rosterHash_(pnjs)
    };

    _cinit_props_().setProperty(CINIT_ACTIVE_BY_MID(mid), combat.id);
    players.forEach(p=>{ if (p?.fid) _cinit_props_().setProperty(CINIT_ACTIVE_BY_FID(p.fid), combat.id); });

    _cinit_writeCombat_(combat);

    try{
      const sh = _getMjTab_();
      sh.getRange("B2:F").clearContent();
      (pnjs || []).forEach(n=>_upsertMjRow_(n.name, n.baseInit, n.camp, (String(n.source||"").toUpperCase()==="BEST"?"Bestiaire":"PNJ")));
    }catch(_){}

    return combat_init_mj_getState(mid);
  } finally {
    try{ lock.releaseLock(); }catch(_){}
  }
}

function combat_init_mj_end(mid){
  mid = String(mid || "").trim();
  if (!mid) throw new Error("MID manquant");

  const lock = _cinit_lock_();
  lock.waitLock(8000);
  try{
    const cid = _cinit_props_().getProperty(CINIT_ACTIVE_BY_MID(mid));
    if (!cid) return { ok:true, active:false, phase:"IDLE" };

    const combat = _cinit_readCombat_(cid);

    // ✅ Clear IniModMalActions / ActionModMalCombat sur toutes les fiches PJ
    if (combat && Array.isArray(combat.players)){
      combat.players.forEach(p=>{
        const fid = String(p?.fid || "").trim();
        if (!fid) return;

        try{
          const ss = SpreadsheetApp.openById(fid);
          const sh = ss.getSheetByName(INIT_PLAYER_SHEET);
          if (!sh) return;

          _cinit_getPlayerRange_(ss, sh, INIT_PLAYER_MOD_ACTIONS_CELL).clearContent();
          _cinit_getPlayerRange_(ss, sh, INIT_PLAYER_ACTION_MALUS_CELL).clearContent();
        }catch(_){
          // on n'empêche pas la fin du combat si une fiche est inaccessible
        }
      });
    }

    // purge état combat (props + combat)
    if (combat) _cinit_clearCombat_(combat);
    else _cinit_props_().deleteProperty(CINIT_ACTIVE_BY_MID(mid));

    return { ok:true, active:false, phase:"IDLE" };
  } finally {
    try{ lock.releaseLock(); }catch(_){}
  }
}

function combat_init_mj_lockRound(mid){
  mid = String(mid || "").trim();
  if (!mid) throw new Error("MID manquant");

  const lock = _cinit_lock_();
  lock.waitLock(8000);
  try{
    const st = combat_init_mj_getState(mid);
    if (!st.active) throw new Error("Aucun combat actif.");
    if (String(st.phase||"") !== "COLLECT") throw new Error("Le tour est déjà validé (phase PLAY).");

    const combat = _cinit_readCombat_(st.combatId);
    if (!combat) throw new Error("Combat introuvable.");

    const rosterNow = _cinit_buildRosterPnjs_(mid);
    _cinit_sanitizeCombat_(combat, rosterNow);

    combat.delayedFids = _cinit_delayedFidsFromCombat_(combat);

    combat.order = _cinit_buildOrder_(combat);
    combat.focusIndex = 0;
    combat.status = "PLAY";
    combat.updatedAt = _cinit_nowIso_();

    _cinit_writeCombat_(combat);
    return combat_init_mj_getState(mid);

  } finally {
    try{ lock.releaseLock(); }catch(_){}
  }
}

function combat_init_mj_next(mid){
  mid = String(mid || "").trim();
  if (!mid) throw new Error("MID manquant");

  const lock = _cinit_lock_();
  lock.waitLock(8000);
  try{
    const st = combat_init_mj_getState(mid);
    if (!st.active) throw new Error("Aucun combat actif.");
    if (String(st.phase||"") !== "PLAY") throw new Error("Ordre non validé. (phase COLLECT)");

    const combat = _cinit_readCombat_(st.combatId);
    if (!combat) throw new Error("Combat introuvable.");

    const order = Array.isArray(combat.order) ? combat.order : [];
    if (!order.length) throw new Error("Ordre vide.");

    const idx = Number(combat.focusIndex || 0) || 0;

    if (idx >= order.length - 1){
      combat.round = (Number(combat.round || 1) || 1) + 1;
      combat.status = "COLLECT";
      combat.focusIndex = 0;
      combat.order = [];
      combat.submissions = {};
      combat.delayedFids = [];

      const rosterNow = _cinit_buildRosterPnjs_(mid);
      combat.pnjs = rosterNow.slice();
      combat.rosterHash = _cinit_rosterHash_(combat.pnjs);

      combat.updatedAt = _cinit_nowIso_();
      _cinit_writeCombat_(combat);

      const out = combat_init_mj_getState(mid);
      out.openedNewRound = true;
      return out;
    }

    combat.focusIndex = idx + 1;
    combat.updatedAt = _cinit_nowIso_();
    _cinit_writeCombat_(combat);

    return combat_init_mj_getState(mid);

  } finally {
    try{ lock.releaseLock(); }catch(_){}
  }
}

function combat_init_mj_forceNewRound(mid){
  mid = String(mid || "").trim();
  if (!mid) throw new Error("MID manquant");

  const lock = _cinit_lock_();
  lock.waitLock(8000);
  try{
    const st = combat_init_mj_getState(mid);
    if (!st.active) throw new Error("Aucun combat actif.");

    const combat = _cinit_readCombat_(st.combatId);
    if (!combat) throw new Error("Combat introuvable.");

    combat.round = (Number(combat.round || 1) || 1) + 1;
    combat.status = "COLLECT";
    combat.focusIndex = 0;
    combat.order = [];
    combat.submissions = {};
    combat.delayedFids = [];

    const rosterNow = _cinit_buildRosterPnjs_(mid);
    combat.pnjs = rosterNow.slice();
    combat.rosterHash = _cinit_rosterHash_(combat.pnjs);

    combat.updatedAt = _cinit_nowIso_();
    _cinit_writeCombat_(combat);

    const out = combat_init_mj_getState(mid);
    out.openedNewRound = true;
    return out;
  } finally {
    try{ lock.releaseLock(); }catch(_){}
  }
}

/* ============================================================
   V3 — Player API (inclut écriture IniModMalActions / ActionModMalCombat)
============================================================ */
function combat_init_player_getState(fid){
  fid = String(fid || "").trim();
  if (!fid) throw new Error("FID manquant.");

  const info = _readPlayerIdentity_(fid);

  const combatId = _cinit_props_().getProperty(CINIT_ACTIVE_BY_FID(fid));
  if (!combatId) return { ok:true, active:false, identity: info, phase:"IDLE", round:null };

  const combat = _cinit_readCombat_(combatId);
  if (!combat){
    _cinit_props_().deleteProperty(CINIT_ACTIVE_BY_FID(fid));
    return { ok:true, active:false, identity: info, phase:"IDLE", round:null };
  }

  const phase = String(combat.status || "COLLECT").toUpperCase();
  const round = Number(combat.round || 1) || 1;

  const sub = (combat.submissions && combat.submissions[fid]) ? combat.submissions[fid] : null;

  return {
    ok:true,
    active:true,
    combatId,
    phase,
    round,
    identity: info,
    alreadySubmitted: !!sub,
    submission: sub || null
  };
}

function combat_init_player_submit(fid, payload){
  fid = String(fid || "").trim();
  if (!fid) throw new Error("FID manquant.");

  const combatId = _cinit_props_().getProperty(CINIT_ACTIVE_BY_FID(fid));
  if (!combatId) throw new Error("Aucun combat actif pour ce joueur.");

  const lock = _cinit_lock_();
  lock.waitLock(8000);
  try{
    const combat = _cinit_readCombat_(combatId);
    if (!combat) throw new Error("Combat introuvable.");
    if (String(combat.status||"").toUpperCase() !== "COLLECT"){
      throw new Error("Tour déjà validé (phase PLAY) — soumission refusée.");
    }

    const info = _readPlayerIdentity_(fid);

    const total = Number(payload?.total || 0) || 0;
    const options = Array.isArray(payload?.options) ? payload.options.map(String) : [];
    const choices = Array.isArray(payload?.choices) ? payload.choices : [];

    const delayed = _cinit_isDelayedPayload_(payload);

    let cleanChoices = Array.isArray(choices) ? choices : [];
    if (delayed){
      cleanChoices = _cinit_stripMultiAttackChoices_(cleanChoices);
    }

    // ✅ actionMalus == attackMalus (fallback)
    const actionMalusSum = (cleanChoices || []).reduce((acc, c) => {
      if (!c) return acc;

      const v1 = Number(c?.actionMalus);
      if (Number.isFinite(v1)) return acc + v1;

      const v2 = Number(c?.attackMalus);
      if (Number.isFinite(v2)) return acc + v2;

      return acc;
    }, 0);

    // écriture fiche PJ : IniModMalActions / ActionModMalCombat
    {
      const ss = SpreadsheetApp.openById(fid);
      const sh = ss.getSheetByName(INIT_PLAYER_SHEET);
      if (!sh) throw new Error("Onglet Personnage introuvable dans la fiche joueur.");

      _cinit_getPlayerRange_(ss, sh, INIT_PLAYER_MOD_ACTIONS_CELL).setValue(total);

      if (actionMalusSum) _cinit_getPlayerRange_(ss, sh, INIT_PLAYER_ACTION_MALUS_CELL).setValue(actionMalusSum);
      else _cinit_getPlayerRange_(ss, sh, INIT_PLAYER_ACTION_MALUS_CELL).clearContent();
    }

    const baseInit = Number(info.baseInit || 0) || 0;
    const finalScore = baseInit + total;

    combat.submissions = combat.submissions || {};
    combat.submissions[fid] = {
      total,
      options,
      choices: cleanChoices,
      baseInit,
      final: finalScore,
      delayed: !!delayed,
      ts: _cinit_nowIso_()
    };

    combat.updatedAt = _cinit_nowIso_();
    _cinit_writeCombat_(combat);

    try{
      const detail = (delayed ? "Retarde son action" : options.join(" | "));
      _upsertMjRow_(info.label, finalScore, "Joueur", detail);
    }catch(_){}

    return {
      ok:true,
      combatId,
      phase:"COLLECT",
      round: Number(combat.round || 1) || 1,
      usedTotal: total,
      baseInit,
      final: finalScore,
      delayed: !!delayed
    };

  } finally {
    try{ lock.releaseLock(); }catch(_){}
  }
}

/* ============================================================
   API COMPAT — celles que tes HTML appellent déjà (init_*)
============================================================ */
function init_mj_getPlayers(mid) { return reg_getPlayers(mid); }
function init_mj_addPlayer(mid, linkOrId) { return reg_addPlayer(mid, linkOrId, {}); }
function init_mj_removePlayer(mid, index) { return reg_removePlayer(mid, index); }

function init_mj_getPnjs(mid) {
  mid = String(mid || "").trim() || INIT_MJ_SHEET_ID;
  const r = reg_getNpcRoster(mid);
  return { ok: true, active: false, pnjs: r.roster || [] };
}
function init_mj_setPnjs(mid, pnjList) {
  mid = String(mid || "").trim() || INIT_MJ_SHEET_ID;

  const clean = (Array.isArray(pnjList) ? pnjList : []).map(p => ({
    id: String(p?.id || "").trim() || ("PNJ_" + _cinit_uid_()),
    name: String(p?.name || "PNJ").trim(),
    camp: (String(p?.camp || "").toLowerCase().includes("alli")) ? "Allié" : "Ennemi",
    baseInit: Number(p?.baseInit || 0) || 0,
    source: String(p?.source || "").trim() || "PNJ",
    templateKey: String(p?.templateKey || "").trim(),
    fid: String(p?.fid || "").trim()
  })).filter(x => x.id && x.name);

  reg_setNpcRoster(mid, clean);
  return { ok: true, active: false, pnjs: clean };
}

function init_mj_startCombat(mid, pnjList, selectedFids) {
  mid = String(mid || "").trim() || INIT_MJ_SHEET_ID;
  if (pnjList) init_mj_setPnjs(mid, pnjList);
  const st = combat_init_mj_start(mid, selectedFids);
  return { ok:true, combatId: st.combatId || null, combat: st };
}
function init_mj_endCombat(mid) {
  mid = String(mid || "").trim() || INIT_MJ_SHEET_ID;
  return combat_init_mj_end(mid);
}
function init_mj_lockOrder(mid) {
  mid = String(mid || "").trim() || INIT_MJ_SHEET_ID;
  const st = combat_init_mj_lockRound(mid);
  return { ok:true, order: st.order || [], focusIndex: Number(st.focusIndex||0), round: Number(st.round||1) };
}
function init_mj_getFocus(mid) {
  mid = String(mid || "").trim() || INIT_MJ_SHEET_ID;
  const st = combat_init_mj_getState(mid);
  if (!st.active) return { ok:true, active:false };
  return {
    ok:true,
    active:true,
    round: Number(st.round||1),
    focusIndex: Number(st.focusIndex||0),
    focus: st.focus || null,
    order: st.order || []
  };
}
function init_mj_next(mid) {
  mid = String(mid || "").trim() || INIT_MJ_SHEET_ID;
  const st = combat_init_mj_next(mid);
  return {
    ok:true,
    active: !!st.active,
    round: Number(st.round||1),
    focusIndex: Number(st.focusIndex||0),
    focus: st.focus || null,
    order: st.order || []
  };
}
function init_mj_newRound(mid) {
  mid = String(mid || "").trim() || INIT_MJ_SHEET_ID;
  const st = combat_init_mj_forceNewRound(mid);
  return { ok:true, combat: st };
}

function init_player_getState(fid){ return combat_init_player_getState(fid); }
function init_player_submit(fid, payload){ return combat_init_player_submit(fid, payload); }

function init_pingForFid(fid){
  const st = combat_init_player_getState(fid);
  return { ok:true, active: !!st.active, round: st.round || null, combatId: st.combatId || null, phase: st.phase || null };
}
## 9. Découvertes Clés (Suite)

### 9.1. Système d'Initiative Simplifié (`14_WebApp_InitiativeSimple.gs`)

- **Rôle** : Gestion basique de l'initiative avec des **modificateurs d'actions**.
- **Fonctions Clés** :
  - `**applyInitiativeDelta(fid, delta)**` :
    - Applique un modificateur d'initiative (`delta`) à un personnage (`fid`).
    - **Cellule cible** : `AD16` (onglet `Personnage`).
    - **Intégration Enclume** :
      - **Backend** : Route `POST /api/characters/:id/initiative/delta` → Met à jour `characters.initiative_delta`.
      - **Frontend** : Boutons dans `CombatTurnPanel.jsx` pour appliquer des modificateurs.
      - **WebSocket** : Événement `INITIATIVE_DELTA_APPLIED`.
  - `**getBaseInitiative(fid)**` :
    - Récupère la valeur de base de l'initiative depuis `AD16`.
    - **Intégration Enclume** :
      - **Backend** : Route `GET /api/characters/:id/initiative/base` → Retourne `characters.initiative_delta`.
      - **Frontend** : Affichage dans `CombatTurnPanel.jsx`.
  - `**getActionsInitiative()**` :
    - Retourne une liste d'actions avec leurs modificateurs.
    - **Types d'actions** :

      | `kind`  | Description                        | Exemple             | Intégration Enclume   |
      | ------- | ---------------------------------- | ------------------- | --------------------- |
      | `fixed` | Modificateur fixe.                 | `mod: -5`           | Bouton cliquable.     |
      | `info`  | Information (pas de modificateur). | `label: "Observer"` | Tooltip/notification. |
      | `range` | Modificateur variable (plage).     | `min: -10, max: -5` | Sélecteur (slider).   |

    - **Intégration Enclume** :
      - **Backend** : Table `initiative_actions` + route `GET /api/initiative/actions`.
      - **Frontend** : Composant `InitiativeActionsPanel.jsx`.
- **Cellule `AD16` (Initiative)** :
  - **Code externe** : Stocke le modificateur d'initiative (`delta`).
  - **Enclume** :
    - **Champ** : `characters.initiative_delta` (INTEGER, default 0).
    - **Calcul de l'initiative totale** :
      ```js
      initiativeScore = baseInitiative (REA) + initiative_delta + effectiveMalus;
      ```
      - `baseInitiative` : `REA` (depuis `char_attributes`).
      - `initiative_delta` : Modificateur (ex: `-5` pour "Avancer prudemment").
      - `effectiveMalus` : Malus santé + encombrement (P51).
- **Actions d'Initiative** :
  - **Liste statique** dans le code externe :
    ```js
    [
      { id: 1, cat: "Mouvement", label: "Avancer prudemment", kind: "fixed", mod: -5 },
      { id: 2, cat: "Mouvement", label: "Se précipiter", kind: "fixed", mod: +5 },
      { id: 3, cat: "Observation", label: "Observer les alentours", kind: "info5" },
      { id: 4, cat: "Combat", label: "Prendre une garde défensive", kind: "range", min: -10, max: -5, step: 1 }
    ]
    ```
  - **Intégration Enclume** :
    - **Table `initiative_actions**` :
      ```sql
      CREATE TABLE initiative_actions (
        id SERIAL PRIMARY KEY,
        category VARCHAR(50) NOT NULL,
        label VARCHAR(255) NOT NULL,
        kind VARCHAR(20) NOT NULL, -- "fixed", "info", "range"
        mod INTEGER,               -- Pour "fixed"
        min_mod INTEGER,          -- Pour "range"
        max_mod INTEGER,          -- Pour "range"
        step INTEGER DEFAULT 1,   -- Pour "range"
        created_at TIMESTAMP DEFAULT NOW()
      );
      ```
    - **Seed initial** :
      ```sql
      INSERT INTO initiative_actions (category, label, kind, mod, min_mod, max_mod) VALUES
      ('Mouvement', 'Avancer prudemment', 'fixed', -5, NULL, NULL),
      ('Mouvement', 'Se précipiter', 'fixed', +5, NULL, NULL),
      ('Observation', 'Observer les alentours', 'info', NULL, NULL, NULL),
      ('Combat', 'Prendre une garde défensive', 'range', NULL, -10, -5);
      ```
    - **Frontend** : Composant `InitiativeActionsPanel.jsx` (boutons, sélecteurs, tooltips).

---

### 9.2. Système d'Initiative Avancé (`20_Initiative_Core.gs`)

- **Rôle** : Moteur complet pour la gestion des **tours de combat**, **soumissions des joueurs**, et **ordre des entités**.
- **Architecture V3** :
  - **Stockage** : `PropertiesService` (Google Apps Script) → **Équivalent Enclume** : PostgreSQL (`combat_sessions`, `combat_entities`) + Redis (temporaire).
  - **Clés** :
    - `CINITV3_ACTIVE_FOR_MID_{mid}` → Combat actif pour un MJ.
    - `CINITV3_ACTIVE_FOR_FID_{fid}` → Combat actif pour un joueur.
    - `CINITV3_COMBAT_{combatId}` → Données du combat (JSON).
  - **Phases** :
    - `COLLECT` : Les joueurs soumettent leur initiative.
    - `PLAY` : L'ordre est verrouillé, les actions sont résolues.
    - `IDLE` : Aucun combat actif.
- **Structure d'un Combat** :
  ```js
  {
    id: string,               // ID unique
    mid: string,              // ID du MJ
    status: "COLLECT" | "PLAY", // Phase
    round: number,            // Tour actuel
    focusIndex: number,       // Index de l'entité active
    players: [{ fid, label, perso, joueur, baseInit, camp: "Joueur" }],
    pnjs: [{ id, name, camp, baseInit, source, templateKey, fid }],
    submissions: { [fid]: { total, options, choices, baseInit, final, delayed, ts } },
    order: [{ kind, id, name, camp, score, detail, choices, source }],
    delayedFids: string[],    // Joueurs ayant retardé leur action
    rosterHash: string        // Hash du roster des PNJ
  }
  ```
  - **Équivalent Enclume** :
    ```sql
    -- combat_sessions
    CREATE TABLE combat_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL CHECK (status IN ('COLLECT', 'PLAY', 'IDLE')),
      round INTEGER NOT NULL DEFAULT 1,
      focus_index INTEGER NOT NULL DEFAULT 0,
      order JSONB, -- Ordre des entités
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- combat_entities
    CREATE TABLE combat_entities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      combat_id UUID NOT NULL REFERENCES combat_sessions(id) ON DELETE CASCADE,
      character_id UUID REFERENCES characters(id) ON DELETE CASCADE, -- NULL pour PNJ
      npc_id UUID REFERENCES npcs(id) ON DELETE CASCADE, -- NULL pour joueurs
      entity_type VARCHAR(10) NOT NULL CHECK (entity_type IN ('PLAYER', 'PNJ')),
      base_init INTEGER NOT NULL DEFAULT 0,
      final_init INTEGER,
      camp VARCHAR(20) NOT NULL CHECK (camp IN ('Joueur', 'Allié', 'Ennemi')),
      is_delayed BOOLEAN DEFAULT false,
      submission JSONB, -- { total, options, choices, ts }
      order_index INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    ```
- **Fonctions Clés (API MJ)** :
  - `**combat_init_mj_getState(mid)**` :
    - Récupère l'état du combat pour un MJ.
    - **Intégration** : `GET /api/combat/:campaignId/state`.
  - `**combat_init_mj_start(mid, selectedFids)**` :
    - Démarre un nouveau combat.
    - **Intégration** : `POST /api/combat/start`.
  - `**combat_init_mj_lockRound(mid)**` :
    - Verrouille l'ordre des tours (COLLECT → PLAY).
    - **Intégration** : `POST /api/combat/:campaignId/lock-round`.
  - `**combat_init_mj_next(mid)**` :
    - Passe au tour suivant.
    - **Intégration** : `POST /api/combat/:campaignId/next`.
  - `**combat_init_mj_end(mid)**` :
    - Termine le combat.
    - **Intégration** : `POST /api/combat/:campaignId/end`.
- **Fonctions Clés (API Joueur)** :
  - `**combat_init_player_getState(fid)**` :
    - Récupère l'état du combat pour un joueur.
    - **Intégration** : `GET /api/combat/player/:characterId/state`.
  - `**combat_init_player_submit(fid, payload)**` :
    - Soumet l'initiative et les actions d'un joueur.
    - **Payload** : `{ total, options, choices }`.
    - **Intégration** : `POST /api/combat/player/:characterId/submit`.
- **Gestion des Actions Spéciales** :
  - **Actions Retardées** (`_cinit_isDelayedPayload_`) :
    - Détecte si un joueur a retardé son action (via `payload.delayed`, `payload.flag === "DELAY_ACTION"`, etc.).
    - **Intégration** : Champ `is_delayed` dans `combat_entities`.
  - **Attaques Multiples** (`_cinit_getMultiAttackCount_`) :
    - Détecte si un joueur a sélectionné `MULTI_ATTACK` (2 ou 3 attaques).
    - **Intégration** : Ajoute des entrées supplémentaires dans `order` avec malus cumulatif (`-5` par attaque supplémentaire).
- **Compatibilité avec l'Ancienne API** :
  - Les fonctions `init_*` (ex: `init_mj_startCombat`, `init_player_submit`) sont des **wrappers** vers les nouvelles fonctions `combat_init_*`.
  - **Exemple** :
    - `init_mj_startCombat(mid, pnjs, fids)` → `combat_init_mj_start(mid, fids)`.
    - `init_pingForFid(fid)` → `combat_init_player_getState(fid)`.
- **Cellules Clés dans les Fiches Joueur** :
  - `**IniModMalActions**` : Stocke le modificateur total (`total`).
    - **Équivalent Enclume** : `characters.initiative_delta`.
  - `**ActionModMalCombat**` : Stocke la somme des malus d'action (`actionMalusSum`).
    - **Équivalent Enclume** : À stocker dans `combat_entities.submission` (JSONB).

---

## 10. Questions Techniques (Suite)

- **Q11** : La cellule `**AD16**` est-elle **la seule source de vérité** pour les modificateurs d'initiative ?
  - **Impact** : Si oui → Stocker `initiative_delta` dans `characters`. Si non → Vérifier d'autres cellules/plages.
- **Q12** : Les **actions d'initiative** (`getActionsInitiative`) sont-elles **fixes** ou **configurables** ?
  - **Impact** : Si configurables → Ajouter une interface admin pour les modifier.
- **Q13** : Comment sont gérées les **actions personnalisées** (ex: "Utiliser un objet") ?
  - **Impact** : Si elles existent → Ajouter un champ `is_custom` dans `initiative_actions`.
- **Q14** : Comment sont gérés les **bonus du bestiaire** (`_cinit_bestWeaponMod_`) ?
  - **Impact** : À implémenter via un champ `best_weapon_mod` dans `npcs` ou une fonction de calcul.
- **Q15** : Comment sont gérés les **registres des joueurs et PNJ** (`reg_getPlayers`, `reg_getNpcRoster`) ?
  - **Impact** : Ces fonctions sont dans d'autres fichiers `.gs` (non encore reçus).
- **Q16** : Comment sont stockées les **feuilles MJ** (`INIT_MJ_SHEET_ID`) ?
  - **Impact** : À mapper sur `campaigns.id` dans Enclume.

---

## 11. Décisions en Attente (Suite)

- **D11** : Faut-il **stocker `initiative_delta` dans `characters**` ou dans une table dédiée ?
  - **Proposition** : **Dans `characters**` (attribut simple du personnage).
- **D12** : Faut-il **rendre les actions d'initiative configurables** par le MJ ?
  - **Proposition** :
    - **Phase 1** : Actions fixes (seed initial).
    - **Phase 2** : Interface admin pour ajouter/modifier des actions.
- **D13** : Faut-il **créer une table `npcs**` pour gérer les PNJ/bestiaires ?
  - **Proposition** : **Oui** (pour isoler la logique des PNJ).
- **D14** : Comment gérer les **bonus du bestiaire** ?
  - **Proposition** : Ajouter un champ `best_weapon_mod` dans `npcs`.
- **D15** : Faut-il **stocker `order` dans `combat_sessions**` (JSONB) ou dans une table dédiée ?
  - **Proposition** : **Dans `combat_sessions**` (JSONB) pour simplifier les requêtes.
- **D16** : Comment gérer les **soumissions des joueurs** (`submissions`) ?
  - **Proposition** : Stocker dans `combat_entities.submission` (JSONB).

---

## 12. Tables SQL à Créer/Modifier

### 12.1. `combat_sessions`

```sql
CREATE TABLE combat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('COLLECT', 'PLAY', 'IDLE')),
  round INTEGER NOT NULL DEFAULT 1,
  focus_index INTEGER NOT NULL DEFAULT 0,
  order JSONB, -- Ordre des entités pour le tour
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 12.2. `combat_entities`

```sql
CREATE TABLE combat_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combat_id UUID NOT NULL REFERENCES combat_sessions(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id) ON DELETE CASCADE, -- NULL pour PNJ
  npc_id UUID REFERENCES npcs(id) ON DELETE CASCADE, -- NULL pour joueurs
  entity_type VARCHAR(10) NOT NULL CHECK (entity_type IN ('PLAYER', 'PNJ')),
  base_init INTEGER NOT NULL DEFAULT 0,
  final_init INTEGER, -- Score final (base_init + total)
  camp VARCHAR(20) NOT NULL CHECK (camp IN ('Joueur', 'Allié', 'Ennemi')),
  is_delayed BOOLEAN DEFAULT false,
  submission JSONB, -- { total, options, choices, ts }
  order_index INTEGER, -- Position dans l'ordre du tour
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 12.3. `npcs`

```sql
CREATE TABLE npcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  base_init INTEGER NOT NULL DEFAULT 0,
  camp VARCHAR(20) NOT NULL CHECK (camp IN ('Allié', 'Ennemi')),
  source VARCHAR(20) NOT NULL CHECK (source IN ('PNJ', 'Bestiaire')),
  best_weapon_mod INTEGER DEFAULT 0, -- Bonus du bestiaire
  template_key VARCHAR(255),
  fid VARCHAR(255), -- ID de la fiche (optionnel)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 12.4. `initiative_actions`

```sql
CREATE TABLE initiative_actions (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  label VARCHAR(255) NOT NULL,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('fixed', 'info', 'range')),
  mod INTEGER, -- Pour "fixed"
  min_mod INTEGER, -- Pour "range"
  max_mod INTEGER, -- Pour "range"
  step INTEGER DEFAULT 1, -- Pour "range"
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 12.5. Modification de `characters`

```sql
ALTER TABLE characters ADD COLUMN IF NOT EXISTS initiative_delta INTEGER DEFAULT 0;
```

---

## 13. Routes Backend à Implémenter


| Route                                    | Méthode | Description                                  | Fonction Externe              |
| ---------------------------------------- | ------- | -------------------------------------------- | ----------------------------- |
| `/api/combat/start`                      | POST    | Démarre un nouveau combat.                   | `combat_init_mj_start`        |
| `/api/combat/:campaignId/state`          | GET     | Récupère l'état du combat pour un MJ.        | `combat_init_mj_getState`     |
| `/api/combat/:campaignId/lock-round`     | POST    | Verrouille l'ordre des tours.                | `combat_init_mj_lockRound`    |
| `/api/combat/:campaignId/next`           | POST    | Passe au tour suivant.                       | `combat_init_mj_next`         |
| `/api/combat/:campaignId/end`            | POST    | Termine le combat.                           | `combat_init_mj_end`          |
| `/api/combat/player/:characterId/state`  | GET     | Récupère l'état du combat pour un joueur.    | `combat_init_player_getState` |
| `/api/combat/player/:characterId/submit` | POST    | Soumet l'initiative et les actions.          | `combat_init_player_submit`   |
| `/api/combat/ping`                       | GET     | Vérifie si un personnage est dans un combat. | `init_pingForFid`             |
| `/api/characters/:id/initiative/delta`   | POST    | Applique un modificateur d'initiative.       | `applyInitiativeDelta`        |
| `/api/characters/:id/initiative/base`    | GET     | Récupère la valeur de base de l'initiative.  | `getBaseInitiative`           |
| `/api/initiative/actions`                | GET     | Récupère la liste des actions d'initiative.  | `getActionsInitiative`        |


---

## 14. Événements WebSocket à Implémenter


| Événement                  | Payload                             | Description                         | Quand ?                     |
| -------------------------- | ----------------------------------- | ----------------------------------- | --------------------------- |
| `COMBAT_STARTED`           | `{ campaignId, combatId, round }`   | Nouveau combat démarré.             | `combat_init_mj_start`      |
| `COMBAT_STATE_UPDATE`      | `{ campaignId, state }`             | État du combat mis à jour.          | Toute modification.         |
| `COMBAT_ROUND_LOCKED`      | `{ campaignId, order, focusIndex }` | Ordre des tours verrouillé.         | `combat_init_mj_lockRound`  |
| `COMBAT_TURN_NEXT`         | `{ campaignId, focusIndex, focus }` | Passage au tour suivant.            | `combat_init_mj_next`       |
| `COMBAT_ENDED`             | `{ campaignId }`                    | Combat terminé.                     | `combat_init_mj_end`        |
| `COMBAT_SUBMISSION`        | `{ characterId, submission }`       | Joueur a soumis son initiative.     | `combat_init_player_submit` |
| `INITIATIVE_DELTA_APPLIED` | `{ characterId, delta }`            | Modificateur d'initiative appliqué. | `applyInitiativeDelta`      |


---

## 15. Composants Frontend à Créer


| Composant                | Description                                   | Fichier                      | Dépendances                          |
| ------------------------ | --------------------------------------------- | ---------------------------- | ------------------------------------ |
| `CombatTurnPanel`        | Affiche l'ordre des tours et le focus actuel. | `CombatTurnPanel.jsx`        | `combat_sessions`, `combat_entities` |
| `InitiativeSubmitPanel`  | Formulaire pour soumettre son initiative.     | `InitiativeSubmitPanel.jsx`  | `initiative_actions`                 |
| `InitiativeActionsPanel` | Affiche les actions disponibles.              | `InitiativeActionsPanel.jsx` | `initiative_actions`                 |
| `CombatPanel`            | Interface MJ pour gérer le combat.            | `CombatPanel.jsx`            | `combat_sessions`                    |


---

## 16. Historique des Ajouts

- **2026-05-10** : Création du fichier. Contexte, objectifs, et structure initiale définis.
- **2026-05-10** : Ajout analyse détaillée de `00_Config.gs` (BDD, initiative, commerce, plages nommées).
- **2026-05-10** : Ajout analyse détaillée de `01_Routers.gs` (endpoints JSON, pages HTML, mapping vers Enclume).
- **2026-05-10** : Ajout analyse détaillée de `02_Utils.gs` (helpers, constantes, registre PNJ/armes).
- **2026-05-10** : Ajout analyse détaillée de `12_WebApp_Combat.gs` (système de combat, armes, munitions, drones).
- **2026-05-10** : Ajout analyse détaillée de `13_SyncBDD.gs` (synchronisation BDD → fiche, onglets, alignement SQL).
- **2026-05-10** : Ajout analyse détaillée de `14_WebApp_InitiativeSimple.gs` (initiative simplifiée, actions, modificateurs).
- **2026-05-10** : Ajout analyse détaillée de `20_Initiative_Core.gs` (moteur d'initiative V3, tours, soumissions, PNJ).