/**
 * ============================================================
 * 32_CombatMJ_Weapons.gs — MJ module "Combat" (armes BEST)
 * - Source : BDD Polaris
 *    - Onglet "Armes à distances" : Cat(A), Nom(B), Dégâts(C), Choc(D), Portée(E), ModIni(G)
 *    - Onglet "Armes de contact"  : Nom(A), Dégâts(C), Choc(D), ModIni(E), Allonge(F)
 *
 * - UI (Combat MJ HTML) :
 *    - dropdown par entité BEST (id roster)
 *    - affichage infos : Dégâts, Choc, Portée/Allonge (petit, non gras)
 *    - mod ini : appliqué dans Initiative V3 (lockRound + sanitize order)
 *
 * - Stockage :
 *    - ScriptProperties map par MID : { entityId -> weaponKey }
 *
 * Expose :
 *  - combat_mj_getWeaponsBulk(mid)
 *  - combat_mj_setBestWeapon(mid, entityId, weaponKey)
 *  - combat_mj_getBestWeaponMod(mid, entityId)
 * ============================================================
 */

const CWEAP_PREFIX = "CWEAP_";
const CWEAP_SEL_KEY = (mid) => `${CWEAP_PREFIX}SEL_BY_MID_${String(mid || "").trim()}`;
const CWEAP_CACHE_KEY = `${CWEAP_PREFIX}CATALOG_V1`;

function _cweap_props_(){ return PropertiesService.getScriptProperties(); }
function _cweap_cache_(){ return CacheService.getScriptCache(); }
function _cweap_lock_(){ return LockService.getScriptLock(); }

function _cweap_safeJsonParse_(s, fallback){
  try{ if (typeof _safeJsonParse_ === "function") return _safeJsonParse_(s, fallback); }catch(_){}
  try{ return JSON.parse(s); }catch(_){ return fallback; }
}
function _cweap_normKey_(s){
  try{ if (typeof _normKey_ === "function") return _normKey_(s); }catch(_){}
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
function _cweap_parseInt_(v){
  const m = String(v ?? "").match(/[+-]?\d+/);
  return m ? (Number(m[0]) || 0) : 0;
}

function _cweap_bddId_(){
  try{
    if (typeof BDD_POLARIS_ID !== "undefined" && String(BDD_POLARIS_ID).trim()) return String(BDD_POLARIS_ID).trim();
  }catch(_){}
  try{
    if (typeof POLARIS_BDD_ID !== "undefined" && String(POLARIS_BDD_ID).trim()) return String(POLARIS_BDD_ID).trim();
  }catch(_){}
  return "12msJt6Mzpx9f-Kj9Y-2_CpQ7ZSsuC78SNI6WX1h0ob0";
}
function _cweap_tabRanged_(){
  try{ if (typeof BDD_TAB_WEAP_RANGED !== "undefined" && String(BDD_TAB_WEAP_RANGED).trim()) return String(BDD_TAB_WEAP_RANGED).trim(); }catch(_){}
  return "Armes à distances";
}
function _cweap_tabMelee_(){
  try{ if (typeof BDD_TAB_WEAP_MELEE !== "undefined" && String(BDD_TAB_WEAP_MELEE).trim()) return String(BDD_TAB_WEAP_MELEE).trim(); }catch(_){}
  return "Armes de contact";
}
function _cweap_ttl_(){
  try{
    if (typeof REG_WEAP_CACHE_TTL_SEC !== "undefined" && Number(REG_WEAP_CACHE_TTL_SEC) > 0){
      return Number(REG_WEAP_CACHE_TTL_SEC);
    }
  }catch(_){}
  return 300;
}

function _cweap_openBdd_(){
  const id = _cweap_bddId_();
  return SpreadsheetApp.openById(id);
}

/* =========================
   Catalog build
========================= */

function _cweap_buildCatalog_(){
  const bdd = _cweap_openBdd_();

  const out = [];
  const seen = new Set();

  const START_ROW = 2; // ✅ entête en ligne 1

  // ---------- RANGED ----------
  const shR = bdd.getSheetByName(_cweap_tabRanged_());
  if (shR){
    const last = shR.getLastRow();
    if (last >= START_ROW){
      // A..G
      const numRows = last - START_ROW + 1;
      const rows = shR.getRange(START_ROW, 1, numRows, 7).getDisplayValues();

      for (let i=0;i<rows.length;i++){
        const cat  = String(rows[i][0]||"").trim(); // A
        const name = String(rows[i][1]||"").trim(); // B
        if (!name) continue;

        const dmg   = String(rows[i][2]||"").trim(); // C
        const shock = String(rows[i][3]||"").trim(); // D
        const range = String(rows[i][4]||"").trim(); // E
        const mod   = String(rows[i][6]||"").trim(); // G

        const key = `R|${_cweap_normKey_(cat || "—")}|${_cweap_normKey_(name)}`;
        if (!key || seen.has(key)) continue;
        seen.add(key);

        out.push({
          key,
          kind: "ranged",
          group: cat || "—",
          name,
          dmg: dmg || "—",
          shock: shock || "—",
          reach: range || "—",
          modIni: _cweap_parseInt_(mod)
        });
      }
    }
  }

  // ---------- MELEE ----------
  // ✅ RÈGLE: mêlée n'a PAS les mêmes colonnes que distance
  // Nom = A
  // Dégâts = B
  // Choc = C
  // Mod = E (si vide, fallback D)
  // Allonge = F (si vide, fallback E)
  // + fallback silencieux ancien format (Dégâts=C, Choc=D) si B/C incohérents
  const shM = bdd.getSheetByName(_cweap_tabMelee_());
  if (shM){
    const last = shM.getLastRow();
    if (last >= START_ROW){
      // A..F
      const numRows = last - START_ROW + 1;
      const rows = shM.getRange(START_ROW, 1, numRows, 6).getDisplayValues();

      const hasAnyNumber = (s)=>{
        s = String(s||"").trim();
        return /[0-9]/.test(s) || /d\d+/i.test(s);
      };
      const looksDice = (s)=>{
        s = String(s||"").trim();
        return /d\d+/i.test(s);
      };

      for (let i=0;i<rows.length;i++){
        const name = String(rows[i][0]||"").trim(); // A
        if (!name) continue;

        // mapping principal (B/C)
        let dmg   = String(rows[i][1]||"").trim(); // B
        let shock = String(rows[i][2]||"").trim(); // C

        let mod = String(rows[i][4]||"").trim();   // E
        let allonge = String(rows[i][5]||"").trim(); // F

        // fallbacks mod/allonge si ta feuille est décalée
        if (!mod) mod = String(rows[i][3]||"").trim();      // D fallback
        if (!allonge) allonge = String(rows[i][4]||"").trim(); // E fallback

        // ✅ fallback ancien format (C/D) seulement si B/C ne ressemblent pas à dégâts/choc
        // cas typique: B vide, ou B non-numérique alors que C/D contiennent des valeurs
        const c = String(rows[i][2]||"").trim(); // C
        const d = String(rows[i][3]||"").trim(); // D
        const useOld =
          (!hasAnyNumber(dmg) && (hasAnyNumber(c) || hasAnyNumber(d))) ||
          (looksDice(c) && !looksDice(dmg)); // si le "dX" est en C, c'est probablement les dégâts

        if (useOld){
          const dmgOld = String(rows[i][2]||"").trim();   // C
          const shockOld = String(rows[i][3]||"").trim(); // D
          if (dmgOld) dmg = dmgOld;
          if (shockOld) shock = shockOld;
        }

        const key = `M|${_cweap_normKey_(name)}`;
        if (!key || seen.has(key)) continue;
        seen.add(key);

        out.push({
          key,
          kind: "melee",
          group: "Mêlée",
          name,
          dmg: dmg || "—",
          shock: shock || "—",
          reach: allonge || "—",
          modIni: _cweap_parseInt_(mod)
        });
      }
    }
  }

  // tri sympa : melee en bas, ranged par groupe+nom
  out.sort((a,b)=>{
    const ak = a.kind === "melee" ? "Z" : "A";
    const bk = b.kind === "melee" ? "Z" : "A";
    if (ak !== bk) return ak < bk ? -1 : 1;
    const ga = String(a.group||"");
    const gb = String(b.group||"");
    if (ga !== gb) return ga < gb ? -1 : 1;
    const na = String(a.name||"");
    const nb = String(b.name||"");
    return na < nb ? -1 : (na > nb ? 1 : 0);
  });

  return out;
}



function _cweap_getCatalog_(){
  const cache = _cweap_cache_();
  const hit = cache.get(CWEAP_CACHE_KEY);
  if (hit){
    const obj = _cweap_safeJsonParse_(hit, null);
    if (obj && Array.isArray(obj.weapons)) return obj.weapons;
  }

  const weapons = _cweap_buildCatalog_();
  cache.put(CWEAP_CACHE_KEY, JSON.stringify({ weapons }), _cweap_ttl_());
  return weapons;
}

/* =========================
   Selection state
========================= */

function _cweap_readSelMap_(mid){
  const raw = _cweap_props_().getProperty(CWEAP_SEL_KEY(mid));
  const obj = raw ? _cweap_safeJsonParse_(raw, null) : null;
  if (!obj || typeof obj !== "object") return Object.create(null);
  return obj;
}
function _cweap_writeSelMap_(mid, map){
  _cweap_props_().setProperty(CWEAP_SEL_KEY(mid), JSON.stringify(map || {}));
}

/* =========================
   Public API
========================= */

function combat_mj_getWeaponsBulk(mid){
  mid = (typeof _coerceFileId_ === "function")
    ? _coerceFileId_(mid, INIT_MJ_SHEET_ID)
    : String(mid || "").trim();

  const weapons = _cweap_getCatalog_();
  const byEntityId = _cweap_readSelMap_(mid);

  return { ok:true, mid, weapons, byEntityId };
}

function combat_mj_setBestWeapon(mid, entityId, weaponKey){
  mid = (typeof _coerceFileId_ === "function")
    ? _coerceFileId_(mid, INIT_MJ_SHEET_ID)
    : String(mid || "").trim();

  entityId = String(entityId || "").trim();
  weaponKey = String(weaponKey || "").trim();

  if (!mid) return { ok:false, message:"MID manquant" };
  if (!entityId) return { ok:false, message:"entityId manquant" };

  const lock = _cweap_lock_();
  lock.waitLock(5000);
  try{
    const map = _cweap_readSelMap_(mid);

    if (!weaponKey){
      delete map[entityId];
    } else {
      map[entityId] = weaponKey;
    }

    _cweap_writeSelMap_(mid, map);

    // renvoie le mod appliqué (pratique côté UI)
    let modIni = 0;
    try{
      const cat = _cweap_getCatalog_();
      const w = cat.find(x => String(x.key||"") === weaponKey) || null;
      modIni = Number(w?.modIni || 0) || 0;
    }catch(_){}

    return { ok:true, mid, entityId, weaponKey, modIni };
  } finally {
    try{ lock.releaseLock(); }catch(_){}
  }
}

/**
 * Utilisé par Initiative V3 : renvoie le mod ini de l'arme choisie pour cette entité BEST.
 * (0 si pas d'arme, ou si inconnue)
 */
function combat_mj_getBestWeaponMod(mid, entityId){
  try{
    mid = String(mid || "").trim();
    entityId = String(entityId || "").trim();
    if (!mid || !entityId) return 0;

    const map = _cweap_readSelMap_(mid);
    const key = String(map[entityId] || "").trim();
    if (!key) return 0;

    const weapons = _cweap_getCatalog_();
    const w = weapons.find(x => String(x.key||"") === key) || null;
    return Number(w?.modIni || 0) || 0;
  }catch(_){
    return 0;
  }
}
