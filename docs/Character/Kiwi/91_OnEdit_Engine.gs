/**
 * ============================================================
 * 91_OnEdit_Engine.gs — Moteur onEdit (Personnage)
 * - Blessures cascade + malus BD46 (couleur rouge si <0, sinon noir)
 * - Armures : radio + prerequis force + recalcul AK8/BD37
 * - Armes   : radio + prerequis force + sortie init AD15
 * - Verrou munitions AO65:AO69 si AY non vide
 *
 * PATCH :
 * - Si la plage nommée "ArmesObj1" existe :
 *   => désactive toute la vieille logique ARMOR / WEAPONS
 *   => désactive aussi le verrou munitions
 *   => force le refresh de Arme1ModeTirSel quand ArmesObj1 change
 *   => stocke ET recharge la munition équipée + l'état du chargeur
 *      sur la ligne inventaire de l'arme
 *   => sur changement d'arme :
 *        1) écrit l'ancienne arme
 *        2) lit la nouvelle arme
 * - Toute la logique MODS a été retirée de ce onEdit
 * - Sinon : comportement inchangé
 * ============================================================
 */

/* =======================
   CONFIG (reprend ta fiche)
   ======================= */

// Blessures
const CENTRAL_BLESSURES_TOP = 46;
const CENTRAL_MALUS_CELL = "BD46";
const CENTRAL_INJ_MATRIX = "AF46:BB51";

// Armures (checkbox groups) + noms en W37..W42
const CENTRAL_ARMOR_GROUPS = [
  "AF37:AF42","AJ37:AJ42","AN37:AN42",
  "AR37:AR42","AV37:AV42","AZ37:AZ42"
];
const CENTRAL_ARMOR_NAME_COL = 23; // W
const CENTRAL_ARMOR_ROWS = { start: 37, end: 42 };

// Protections (BDD locale dans la fiche)
const CENTRAL_PROTECTIONS_SHEET = "Protections";
const CENTRAL_PROT_CAT_IDX = 7;       // H (0-based)
const CENTRAL_PROT_REQFORCE_IDX = 8;  // I (0-based)

// Groupes exclusifs "radio"
const CENTRAL_GROUPS = [
  { type: "ARMOR",  a1: ["AF37:AF42"] },
  { type: "ARMOR",  a1: ["AJ37:AJ42"] },
  { type: "ARMOR",  a1: ["AN37:AN42"] },
  { type: "ARMOR",  a1: ["AR37:AR42"] },
  { type: "ARMOR",  a1: ["AV37:AV42"] },
  { type: "ARMOR",  a1: ["AZ37:AZ37"], _fix:"noop" },
  { type: "ARMOR",  a1: ["AZ37:AZ42"] },
  { type: "OTHER",  a1: ["J21","F21"] },
  { type: "WEAPONS",a1: ["P20:P25","P29:P33"] }
];

// Armes
const CENTRAL_WEAPON_CONTACT_ROWS = { start: 20, end: 25 };
const CENTRAL_WEAPON_DIST_ROWS    = { start: 29, end: 33 };
const CENTRAL_WEAPON_NAME_COL     = 17; // Q
const CENTRAL_FORCE_CELL          = "AE9";
const CENTRAL_WEAPON_INIT_OUT     = "AD15";

// Tables armes dans la fiche
const CENTRAL_WEAPONS_CONTACT_SHEET = "Armes de contact";
const CENTRAL_WEAPONS_DIST_SHEET    = "Armes à distances";

// Verrou munitions
const CENTRAL_MUN_LOCK_COL = 41; // AO
const CENTRAL_MUN_LOCK_ROW = { start: 65, end: 69 };
const CENTRAL_MUN_LOCK_CHECK_COL = 51; // AY

// Détection nouvelle structure
const CENTRAL_DISABLE_LEGACY_EQUIP_NAMED_RANGE = "ArmesObj1";

// Chargeur / munitions installées (nouvelle structure)
const CENTRAL_WEAPON1_NAME_NAME       = "ArmesObj1";
const CENTRAL_WEAPON1_ID_NAME         = "ArmesObj1ID";
const CENTRAL_WEAPON1_AMMO_USED_NAME  = "MunitionsEquipées";
const CENTRAL_WEAPON1_MAG_REMAIN_NAME = "Armes1ChargeurBallesRestantes";

const CENTRAL_INV_ID_NAME             = "InventaireIDObj";
const CENTRAL_INV_NAME_NAME           = "InventaireNomObj";
const CENTRAL_INV_AMMO_USED_NAME      = "InventaireMunInstalles";
const CENTRAL_INV_MAG_REMAIN_NAME     = "InventaireChargeurBallesRestantes";

// Mémoire dernière arme active
const CENTRAL_LAST_WEAPON_ID_PROP_PREFIX = "CENTRAL_LAST_WEAPON_ID_";

/* =======================
   ENGINE
   ======================= */

function _centralEngine_onEdit_(e, sheet) {
  const editedCell = e.range;
  const row = editedCell.getRow();
  const col = editedCell.getColumn();
  const newValue = editedCell.getValue();
  const ss = sheet.getParent();

  const cache = {
    forceAE9: null,
    protInfoMap: null,
    contactWeaponMap: null,
    distWeaponMap: null,
    legacyEquipDisabled: null
  };

  const legacyEquipDisabled = _central_isLegacyEquipDisabled_(ss, cache);

  // ---------- 0bis) Nouvelle structure uniquement ----------
  if (legacyEquipDisabled) {
    _central_refreshModeTirSel_ifWeaponChanged_(ss, editedCell);
    _central_syncWeaponLoadedStateNamed_(e, ss);
  }

  // ---------- 0) VERROU MUNITIONS (AO65..AO69 si AY non vide) ----------
  if (!legacyEquipDisabled &&
      col === CENTRAL_MUN_LOCK_COL &&
      row >= CENTRAL_MUN_LOCK_ROW.start &&
      row <= CENTRAL_MUN_LOCK_ROW.end) {

    const lockValue = String(sheet.getRange(row, CENTRAL_MUN_LOCK_CHECK_COL).getDisplayValue() || "").trim();
    if (lockValue !== "") {
      const oldValue = (e.oldValue !== undefined) ? e.oldValue : "";
      editedCell.setValue(oldValue);
      try { editedCell.setNote("🔒 Munition verrouillée (AY non vide)"); } catch(_) {}
      return;
    }
  }

  // ---------- 1) Blessures cascade + malus ----------
  _central_handleBlessures_batch_(editedCell, sheet);

  // ---------- 2) Groupe exclusif ? ----------
  const groupInfo = _central_findGroup_(editedCell, sheet, legacyEquipDisabled);
  if (!groupInfo) return;

  const targetRanges = groupInfo.ranges;
  const type = groupInfo.type;

  function safeSetValue(range, value) {
    const dv = range.getDataValidation();
    try {
      if (dv) range.clearDataValidations();
      range.setValue(value);
    } finally {
      if (dv) range.setDataValidation(dv);
    }
  }
  function safeSetNote(range, note) {
    try { range.setNote(note); } catch (_) {}
  }

  // ---------- 3) ARMOR ----------
  if (type === "ARMOR") {
    if (newValue !== true) {
      _central_recalcAK8_batch_(ss, cache);
      return;
    }

    const armorName = String(sheet.getRange(row, CENTRAL_ARMOR_NAME_COL).getValue() || "").trim();
    if (!armorName) {
      safeSetValue(editedCell, false);
      safeSetNote(editedCell, "Aucune armure");
      _central_toastOnce_(e, "armor_none", "Aucune armure sur cette ligne.", 2);
      _central_recalcAK8_batch_(ss, cache);
      return;
    }

    const ae9 = _central_getForceAE9_(sheet, cache);
    const protMap = _central_getProtectionsInfoMap_(ss, cache);
    const info = protMap.get(_central_norm_(armorName)) || null;

    if (!info) {
      safeSetValue(editedCell, false);
      safeSetNote(editedCell, "Armure invalide");
      _central_toastOnce_(e, "armor_invalid", "Armure introuvable dans Protections.", 3);
      _central_recalcAK8_batch_(ss, cache);
      return;
    }

    const req = _central_num_(info.reqForce);
    if (req > 0 && ae9 < req) {
      safeSetValue(editedCell, false);
      safeSetNote(editedCell, "Force insuffisante (req " + req + ", AE9=" + ae9 + ")");
      _central_toastOnce_(e, "armor_force", "Force insuffisante pour équiper cette armure.", 3);
      _central_recalcAK8_batch_(ss, cache);
      return;
    }

    _central_uncheckOthersInGroup_batch_(targetRanges, editedCell);
    _central_recalcAK8_batch_(ss, cache);
    safeSetNote(editedCell, "");
    return;
  }

  // ---------- 4) WEAPONS ----------
  if (type === "WEAPONS") {
    if (newValue === false) {
      sheet.getRange(CENTRAL_WEAPON_INIT_OUT).clearContent();
      ["P20:P25", "P29:P33"].forEach(function(zone){ sheet.getRange(zone).clearNote(); });
      return;
    }

    const weaponName = sheet.getRange(row, CENTRAL_WEAPON_NAME_COL).getValue();
    if (!weaponName) {
      safeSetValue(editedCell, false);
      safeSetNote(editedCell, "Aucune arme");
      sheet.getRange(CENTRAL_WEAPON_INIT_OUT).clearContent();
      _central_toastOnce_(e, "weapon_none", "Aucune arme sur cette ligne.", 2);
      return;
    }

    const ae9 = _central_getForceAE9_(sheet, cache);

    const isContact = (row >= CENTRAL_WEAPON_CONTACT_ROWS.start && row <= CENTRAL_WEAPON_CONTACT_ROWS.end);
    const isDist    = (row >= CENTRAL_WEAPON_DIST_ROWS.start && row <= CENTRAL_WEAPON_DIST_ROWS.end);

    let found = null;
    if (isContact) {
      found = _central_getContactWeaponMap_(ss, cache).get(_central_norm_(weaponName)) || null;
    } else if (isDist) {
      found = _central_getDistWeaponMap_(ss, cache).get(_central_norm_(weaponName)) || null;
    }

    if (!found) {
      safeSetValue(editedCell, false);
      safeSetNote(editedCell, "Arme invalide");
      sheet.getRange(CENTRAL_WEAPON_INIT_OUT).clearContent();
      _central_toastOnce_(e, "weapon_invalid", "Arme introuvable dans la table.", 3);
      return;
    }

    const requiredForce = _central_num_(found.req);
    const initVal = _central_num_(found.ini);

    if (requiredForce > 0 && ae9 < requiredForce) {
      safeSetValue(editedCell, false);
      safeSetNote(editedCell, "Force insuffisante (req " + requiredForce + ", AE9=" + ae9 + ")");
      sheet.getRange(CENTRAL_WEAPON_INIT_OUT).clearContent();
      _central_toastOnce_(e, "weapon_force", "Force insuffisante pour utiliser cette arme.", 3);
      return;
    }

    sheet.getRange(CENTRAL_WEAPON_INIT_OUT).setValue(initVal);
    safeSetNote(editedCell, "");

    _central_uncheckOthersInGroup_batch_(targetRanges, editedCell);
    return;
  }

  // ---------- 5) OTHER ----------
  if (newValue === true) {
    _central_uncheckOthersInGroup_batch_(targetRanges, editedCell);
  }
}

/* =======================
   Parsing numbers robust
   ======================= */
function _central_num_(v){
  const s = String(v == null ? "" : v).trim().replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/* =======================
   Détection désactivation logique legacy
   ======================= */
function _central_isLegacyEquipDisabled_(ss, cache) {
  if (cache && cache.legacyEquipDisabled !== null && cache.legacyEquipDisabled !== undefined) {
    return cache.legacyEquipDisabled;
  }

  let disabled = false;
  try {
    disabled = !!ss.getRangeByName(CENTRAL_DISABLE_LEGACY_EQUIP_NAMED_RANGE);
  } catch (_) {
    disabled = false;
  }

  if (cache) cache.legacyEquipDisabled = disabled;
  return disabled;
}

/* =======================
   Refresh mode de tir
   ======================= */
function _central_refreshModeTirSel_ifWeaponChanged_(ss, editedCell) {
  try {
    const weaponCell = ss.getRangeByName("ArmesObj1");
    const modeSelCell = ss.getRangeByName("Arme1ModeTirSel");

    if (!weaponCell || !modeSelCell) return;
    if (!_central_isSameSingleCell_(weaponCell, editedCell)) return;

    modeSelCell.clearContent();
  } catch (_) {}
}

function _central_getWeaponInventoryContext_(ss) {
  try {
    const weaponIdCell = ss.getRangeByName(CENTRAL_WEAPON1_ID_NAME);
    const invIdsRange = _central_getNamedDataRange_(ss, CENTRAL_INV_ID_NAME);

    if (!weaponIdCell) return { ok:false, error:"Plage nommée introuvable : " + CENTRAL_WEAPON1_ID_NAME };
    if (!invIdsRange) return { ok:false, error:"Plage nommée introuvable : " + CENTRAL_INV_ID_NAME };

    const weaponId = _central_num_(weaponIdCell.getValue());
    if (!weaponId) return { ok:false, error:"ArmesObj1ID vide ou invalide." };

    const invIds = invIdsRange.getValues().flat().map(function(v){ return _central_num_(v); });
    const weaponIdx = invIds.findIndex(function(id){ return id === weaponId; });
    if (weaponIdx === -1) {
      return { ok:false, error:"Arme 1 introuvable dans InventaireIDObj (ID=" + weaponId + ")." };
    }

    return {
      ok: true,
      weaponId: weaponId,
      weaponIdx: weaponIdx,
      invIdsRange: invIdsRange,
      invIds: invIds,
      inventorySheet: invIdsRange.getSheet()
    };

  } catch (err) {
    return { ok:false, error:String((err && err.message) || err) };
  }
}

/* =======================
   Sync munitions / chargeur
   - Si edit ArmesObj1  :
       1) écrit l'ancienne arme
       2) lit la nouvelle arme
   - Si edit munition/chargeur :
       => sauvegarde arme courante
   ======================= */
function _central_syncWeaponLoadedStateNamed_(e, ss) {
  try {
    const editedCell = e.range;

    const weaponCell    = ss.getRangeByName(CENTRAL_WEAPON1_NAME_NAME);
    const ammoUsedCell  = ss.getRangeByName(CENTRAL_WEAPON1_AMMO_USED_NAME);
    const magRemainCell = ss.getRangeByName(CENTRAL_WEAPON1_MAG_REMAIN_NAME);

    if (!weaponCell) return false;

    const isWeaponEdit = _central_isSameSingleCell_(weaponCell, editedCell);
    const isAmmoEdit   = _central_isSameSingleCell_(ammoUsedCell, editedCell);
    const isMagEdit    = _central_isSameSingleCell_(magRemainCell, editedCell);

    if (!isWeaponEdit && !isAmmoEdit && !isMagEdit) return false;

    // -------- changement d'arme --------
    if (isWeaponEdit) {
      const oldWeaponId = _central_getLastWeaponId_(ss);
      const oldAmmoValue = ammoUsedCell ? ammoUsedCell.getValue() : "";
      const oldMagValue = magRemainCell ? magRemainCell.getValue() : "";

      if (oldWeaponId) {
        _central_writeWeaponLoadedStateById_(ss, oldWeaponId, oldAmmoValue, oldMagValue);
      } else {
        const oldWeaponName = (e.oldValue !== undefined && e.oldValue !== null) ? String(e.oldValue).trim() : "";
        if (oldWeaponName) {
          _central_writeWeaponLoadedStateByName_(ss, oldWeaponName, oldAmmoValue, oldMagValue);
        }
      }

      let newCtx = null;
      for (let i = 0; i < 6; i++) {
        SpreadsheetApp.flush();
        newCtx = _central_getWeaponLoadedStateContext_(ss);
        if (newCtx && newCtx.ok) break;
        Utilities.sleep(100);
      }

      if (!newCtx || !newCtx.ok) {
        _central_clearWeaponLoadedStateCells_(ss);
        _central_clearLastWeaponId_(ss);
        return false;
      }

      if (ammoUsedCell)  ammoUsedCell.setValue(newCtx.ammoValue);
      if (magRemainCell) magRemainCell.setValue(newCtx.magValue);

      _central_setLastWeaponId_(ss, newCtx.weaponId);
      return true;
    }

    // -------- édition manuelle munition/chargeur --------
    const currentCtx = _central_getWeaponLoadedStateContext_(ss);
    if (!currentCtx || !currentCtx.ok) return false;

    const currentAmmoValue = ammoUsedCell ? ammoUsedCell.getValue() : "";
    const currentMagValue  = magRemainCell ? magRemainCell.getValue() : "";

    _central_writeWeaponLoadedStateById_(ss, currentCtx.weaponId, currentAmmoValue, currentMagValue);
    _central_setLastWeaponId_(ss, currentCtx.weaponId);
    return true;

  } catch (err) {
    Logger.log("central syncWeaponLoadedStateNamed error: " + (err && err.stack || err));
    return false;
  }
}

function _central_getWeaponLoadedStateContext_(ss) {
  try {
    const baseCtx = _central_getWeaponInventoryContext_(ss);
    if (!baseCtx.ok) return baseCtx;

    const invAmmoRange = _central_getNamedDataRange_(ss, CENTRAL_INV_AMMO_USED_NAME);
    const invMagRange  = _central_getNamedDataRange_(ss, CENTRAL_INV_MAG_REMAIN_NAME);

    if (!invAmmoRange) return { ok:false, error:"Plage nommée introuvable : " + CENTRAL_INV_AMMO_USED_NAME };
    if (!invMagRange)  return { ok:false, error:"Plage nommée introuvable : " + CENTRAL_INV_MAG_REMAIN_NAME };

    const ammoValue = invAmmoRange.getCell(baseCtx.weaponIdx + 1, 1).getValue();
    const magValue  = invMagRange.getCell(baseCtx.weaponIdx + 1, 1).getValue();

    return Object.assign({}, baseCtx, {
      invAmmoRange: invAmmoRange,
      invMagRange: invMagRange,
      ammoValue: ammoValue,
      magValue: magValue
    });

  } catch (err) {
    return { ok:false, error:String((err && err.message) || err) };
  }
}

function _central_writeWeaponLoadedStateById_(ss, weaponId, ammoValue, magValue) {
  try {
    const ctx = _central_getWeaponInventoryContextById_(ss, weaponId);
    if (!ctx || !ctx.ok) return false;

    const invAmmoRange = _central_getNamedDataRange_(ss, CENTRAL_INV_AMMO_USED_NAME);
    const invMagRange  = _central_getNamedDataRange_(ss, CENTRAL_INV_MAG_REMAIN_NAME);

    if (!invAmmoRange || !invMagRange) return false;
    if (invAmmoRange.getNumRows() !== ctx.invIdsRange.getNumRows()) return false;
    if (invMagRange.getNumRows() !== ctx.invIdsRange.getNumRows()) return false;

    invAmmoRange.getCell(ctx.weaponIdx + 1, 1).setValue(ammoValue);
    invMagRange.getCell(ctx.weaponIdx + 1, 1).setValue(magValue);
    return true;

  } catch (err) {
    Logger.log("central writeWeaponLoadedStateById error: " + (err && err.stack || err));
    return false;
  }
}

function _central_writeWeaponLoadedStateByName_(ss, weaponName, ammoValue, magValue) {
  try {
    const ctx = _central_getWeaponInventoryContextByName_(ss, weaponName);
    if (!ctx || !ctx.ok) return false;

    const invAmmoRange = _central_getNamedDataRange_(ss, CENTRAL_INV_AMMO_USED_NAME);
    const invMagRange  = _central_getNamedDataRange_(ss, CENTRAL_INV_MAG_REMAIN_NAME);

    if (!invAmmoRange || !invMagRange) return false;
    if (invAmmoRange.getNumRows() !== ctx.invIdsRange.getNumRows()) return false;
    if (invMagRange.getNumRows() !== ctx.invIdsRange.getNumRows()) return false;

    invAmmoRange.getCell(ctx.weaponIdx + 1, 1).setValue(ammoValue);
    invMagRange.getCell(ctx.weaponIdx + 1, 1).setValue(magValue);
    return true;

  } catch (err) {
    Logger.log("central writeWeaponLoadedStateByName error: " + (err && err.stack || err));
    return false;
  }
}

function _central_getWeaponInventoryContextById_(ss, weaponId) {
  try {
    const invIdsRange = _central_getNamedDataRange_(ss, CENTRAL_INV_ID_NAME);
    if (!invIdsRange) return { ok:false, error:"Plage nommée introuvable : " + CENTRAL_INV_ID_NAME };

    const idNum = _central_num_(weaponId);
    if (!idNum) return { ok:false, error:"weaponId invalide." };

    const invIds = invIdsRange.getValues().flat().map(function(v){ return _central_num_(v); });
    const weaponIdx = invIds.findIndex(function(id){ return id === idNum; });
    if (weaponIdx === -1) {
      return { ok:false, error:"Arme introuvable dans InventaireIDObj (ID=" + idNum + ")." };
    }

    return {
      ok: true,
      weaponId: idNum,
      weaponIdx: weaponIdx,
      invIdsRange: invIdsRange,
      invIds: invIds,
      inventorySheet: invIdsRange.getSheet()
    };

  } catch (err) {
    return { ok:false, error:String((err && err.message) || err) };
  }
}

function _central_getWeaponInventoryContextByName_(ss, weaponName) {
  try {
    const invIdsRange   = _central_getNamedDataRange_(ss, CENTRAL_INV_ID_NAME);
    const invNamesRange = _central_getNamedDataRange_(ss, CENTRAL_INV_NAME_NAME);

    if (!invIdsRange) return { ok:false, error:"Plage nommée introuvable : " + CENTRAL_INV_ID_NAME };
    if (!invNamesRange) return { ok:false, error:"Plage nommée introuvable : " + CENTRAL_INV_NAME_NAME };

    const target = _central_norm_(weaponName);
    if (!target) return { ok:false, error:"weaponName vide." };

    const invIds = invIdsRange.getValues().flat().map(function(v){ return _central_num_(v); });
    const invNames = invNamesRange.getValues().flat().map(function(v){ return String(v || "").trim(); });

    const weaponIdx = invNames.findIndex(function(name){
      return _central_norm_(name) === target;
    });

    if (weaponIdx === -1) {
      return { ok:false, error:"Arme introuvable dans InventaireNomObj (nom=" + weaponName + ")." };
    }

    return {
      ok: true,
      weaponId: invIds[weaponIdx],
      weaponIdx: weaponIdx,
      invIdsRange: invIdsRange,
      invIds: invIds,
      inventorySheet: invIdsRange.getSheet()
    };

  } catch (err) {
    return { ok:false, error:String((err && err.message) || err) };
  }
}

function _central_clearWeaponLoadedStateCells_(ss) {
  try {
    const ammoUsedCell  = ss.getRangeByName(CENTRAL_WEAPON1_AMMO_USED_NAME);
    const magRemainCell = ss.getRangeByName(CENTRAL_WEAPON1_MAG_REMAIN_NAME);

    if (ammoUsedCell)  ammoUsedCell.clearContent();
    if (magRemainCell) magRemainCell.clearContent();
  } catch (_) {}
}

/* =======================
   Mémoire dernière arme active
   ======================= */
function _central_getLastWeaponIdPropKey_(ss) {
  return CENTRAL_LAST_WEAPON_ID_PROP_PREFIX + String(ss.getId() || "");
}

function _central_getLastWeaponId_(ss) {
  try {
    const key = _central_getLastWeaponIdPropKey_(ss);
    const v = PropertiesService.getScriptProperties().getProperty(key);
    return _central_num_(v);
  } catch (_) {
    return 0;
  }
}

function _central_setLastWeaponId_(ss, weaponId) {
  try {
    const key = _central_getLastWeaponIdPropKey_(ss);
    const idNum = _central_num_(weaponId);
    if (idNum > 0) {
      PropertiesService.getScriptProperties().setProperty(key, String(idNum));
    } else {
      PropertiesService.getScriptProperties().deleteProperty(key);
    }
  } catch (_) {}
}

function _central_clearLastWeaponId_(ss) {
  try {
    const key = _central_getLastWeaponIdPropKey_(ss);
    PropertiesService.getScriptProperties().deleteProperty(key);
  } catch (_) {}
}

function _central_getNamedDataRange_(ss, name) {
  try {
    const rg = ss.getRangeByName(name);
    if (!rg) return null;

    // Convention : 1re ligne = en-tête
    if (rg.getNumRows() > 1) {
      return rg.offset(1, 0, rg.getNumRows() - 1, rg.getNumColumns());
    }
    return rg;
  } catch (_) {
    return null;
  }
}

/* =======================
   Toast anti-spam
   ======================= */
function _central_toastOnce_(e, key, msg, seconds) {
  try {
    const k = "CENTRAL_TOAST_" + String(key || "x");
    const cache = CacheService.getScriptCache();
    if (cache.get(k)) return;
    cache.put(k, "1", 3);

    const s = Number(seconds || 3);
    if (e && e.source && typeof e.source.toast === "function") {
      e.source.toast(String(msg || ""), "Polaris", s);
      return;
    }
    SpreadsheetApp.getActive().toast(String(msg || ""), "Polaris", s);
  } catch (_) {}
}

/* =======================
   Utils
   ======================= */
function _central_isInAnyA1_(cell, sheet, a1List) {
  const r = cell.getRow();
  const c = cell.getColumn();
  for (let i = 0; i < a1List.length; i++) {
    const a1 = a1List[i];
    const rg = sheet.getRange(a1);
    const r0 = rg.getRow(), c0 = rg.getColumn();
    const r1 = r0 + rg.getNumRows() - 1;
    const c1 = c0 + rg.getNumColumns() - 1;
    if (r >= r0 && r <= r1 && c >= c0 && c <= c1) return true;
  }
  return false;
}

function _central_isSameSingleCell_(rangeA, rangeB) {
  try {
    if (!rangeA || !rangeB) return false;
    return (
      rangeA.getSheet().getSheetId() === rangeB.getSheet().getSheetId() &&
      rangeA.getNumRows() === 1 &&
      rangeA.getNumColumns() === 1 &&
      rangeB.getNumRows() === 1 &&
      rangeB.getNumColumns() === 1 &&
      rangeA.getRow() === rangeB.getRow() &&
      rangeA.getColumn() === rangeB.getColumn()
    );
  } catch (_) {
    return false;
  }
}

function _central_findGroup_(editedCell, sheet, legacyEquipDisabled) {
  const r = editedCell.getRow();
  const c = editedCell.getColumn();

  for (let i = 0; i < CENTRAL_GROUPS.length; i++) {
    const g = CENTRAL_GROUPS[i];

    if (legacyEquipDisabled && (g.type === "ARMOR" || g.type === "WEAPONS")) {
      continue;
    }

    const ranges = g.a1.map(function(a1){ return sheet.getRange(a1); });
    for (let j = 0; j < ranges.length; j++) {
      const rg = ranges[j];
      const r0 = rg.getRow(), c0 = rg.getColumn();
      const r1 = r0 + rg.getNumRows() - 1;
      const c1 = c0 + rg.getNumColumns() - 1;
      if (r >= r0 && r <= r1 && c >= c0 && c <= c1) {
        return { ranges: ranges, type: g.type };
      }
    }
  }
  return null;
}

/* =======================
   Batch: uncheck others
   ======================= */
function _central_uncheckOthersInGroup_batch_(ranges, editedCell) {
  const editedA1 = editedCell.getA1Notation();

  ranges.forEach(function(range) {
    const nr = range.getNumRows();
    const nc = range.getNumColumns();

    const vals = range.getValues();
    const notes = range.getNotes();

    for (let r = 0; r < nr; r++) {
      for (let c = 0; c < nc; c++) {
        const cellA1 = range.getCell(r + 1, c + 1).getA1Notation();
        if (cellA1 !== editedA1) {
          vals[r][c] = false;
          notes[r][c] = "";
        }
      }
    }

    range.setValues(vals);
    try { range.setNotes(notes); } catch (_) {}
  });
}

/* =======================
   Blessures: cascade + malus
   ======================= */
function _central_handleBlessures_batch_(editedCell, sheet) {
  try {
    const TOP = CENTRAL_BLESSURES_TOP;

    const ZONES = {
      Tete:   { startCol: 32, widths: [3,3,2,2,1,0] },
      Corps:  { startCol: 36, widths: [4,3,3,2,2,0] },
      BrasD:  { startCol: 40, widths: [3,3,2,2,1,1] },
      BrasG:  { startCol: 44, widths: [3,3,2,2,1,1] },
      JambeD: { startCol: 48, widths: [3,3,2,2,1,1] },
      JambeG: { startCol: 52, widths: [3,3,2,2,1,1] }
    };

    const LEVELS = 6;

    let editedInInjuries = false;

    for (const zoneName in ZONES) {
      const zone = ZONES[zoneName];
      const maxW = Math.max.apply(null, zone.widths);

      const rEdit = editedCell.getRow() - TOP;
      const cEdit = editedCell.getColumn() - zone.startCol;

      const inThisZone =
        rEdit >= 0 && rEdit < LEVELS &&
        cEdit >= 0 && cEdit < (zone.widths[rEdit] || 0);

      if (!inThisZone) continue;

      editedInInjuries = true;

      const blockRange = sheet.getRange(TOP, zone.startCol, LEVELS, maxW);
      const block = blockRange.getValues();

      const isRowFull = function(ri) {
        const w = zone.widths[ri] || 0;
        if (w <= 1) return false;
        for (let c = 0; c < w; c++) if (block[ri][c] !== true) return false;
        return true;
      };

      const clearRow = function(ri) {
        const w = zone.widths[ri] || 0;
        for (let c = 0; c < w; c++) block[ri][c] = false;
      };

      const addOneToNextRow = function(ri) {
        const next = ri + 1;
        const w = zone.widths[next] || 0;
        if (w <= 0) return;
        for (let c = 0; c < w; c++) {
          if (block[next][c] !== true) {
            block[next][c] = true;
            return;
          }
        }
      };

      let ri = rEdit;
      while (ri < LEVELS - 1 && isRowFull(ri)) {
        clearRow(ri);
        addOneToNextRow(ri);
        ri++;
      }

      blockRange.setValues(block);
      break;
    }

    if (!editedInInjuries) return;

    const inj = sheet.getRange(CENTRAL_INJ_MATRIX).getValues();
    const niveaux = [
      { idx: 5, malus: -10 },
      { idx: 4, malus: -10 },
      { idx: 3, malus: -10 },
      { idx: 2, malus: -5  },
      { idx: 1, malus: -3  },
      { idx: 0, malus: -1  }
    ];

    let malus = 0;
    for (let i = 0; i < niveaux.length; i++) {
      const n = niveaux[i];
      if (inj[n.idx].some(function(v){ return v === true; })) { malus = n.malus; break; }
    }

    const malusOut = sheet.getRange(CENTRAL_MALUS_CELL);
    malusOut.setValue(malus);
    malusOut.setFontColor(malus < 0 ? "red" : "black");

  } catch (err) {
    Logger.log("central handleBlessures error: " + (err && err.stack || err));
  }
}

/* =======================
   Recalc armure (AK8 + BD37)
   ======================= */
function _central_recalcAK8_batch_(ss, cache) {
  if (_central_isLegacyEquipDisabled_(ss, cache)) return;

  const sheet = ss.getSheetByName("Personnage");
  const protSheet = ss.getSheetByName(CENTRAL_PROTECTIONS_SHEET);
  if (!sheet || !protSheet) return;

  function penaltyFromH(hVal) {
    const v = String(hVal || "").trim().toUpperCase();
    if (v === "A") return -2;
    if (v === "B") return -3;
    if (v === "C") return -4;
    if (v === "C**") return -5;
    if (v === "D") return -6;
    return 0;
  }

  const protMap = _central_getProtectionsInfoMap_(ss, cache);

  const armorNames = sheet.getRange(CENTRAL_ARMOR_ROWS.start, CENTRAL_ARMOR_NAME_COL, 6, 1)
    .getValues().flat().map(function(v){ return String(v || "").trim(); });

  let best = 0, bestCat = "", found = false;

  for (let i = 0; i < CENTRAL_ARMOR_GROUPS.length; i++) {
    const groupRange = CENTRAL_ARMOR_GROUPS[i];
    const range = sheet.getRange(groupRange);
    const values = range.getValues();

    for (let r = 0; r < values.length; r++) {
      if (!values[r].some(function(v){ return v === true; })) continue;

      found = true;
      const armorName = armorNames[r];
      if (!armorName) continue;

      const info = protMap.get(_central_norm_(armorName));
      const cat = info ? info.cat : "";
      const pen = penaltyFromH(cat);

      if (pen < best) { best = pen; bestCat = cat || ""; }
    }
  }

  if (found) {
    sheet.getRange("AK8").setValue(best);
    sheet.getRange("BD37").setValue(bestCat + "\n" + best);
  } else {
    sheet.getRange("AK8").setValue(0);
    sheet.getRange("BD37").setValue("");
  }
}

/* =======================
   Lookups / maps
   ======================= */
function _central_norm_(s) {
  return (s || "")
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function _central_getForceAE9_(sheet, cache) {
  if (cache.forceAE9 !== null && cache.forceAE9 !== undefined) return cache.forceAE9;
  const v = _central_num_(sheet.getRange(CENTRAL_FORCE_CELL).getValue());
  cache.forceAE9 = v;
  return cache.forceAE9;
}

function _central_getProtectionsInfoMap_(ss, cache) {
  if (_central_isLegacyEquipDisabled_(ss, cache)) {
    const m = new Map();
    cache.protInfoMap = m;
    return m;
  }

  if (cache.protInfoMap) return cache.protInfoMap;

  const protSheet = ss.getSheetByName(CENTRAL_PROTECTIONS_SHEET);
  const m = new Map();
  if (!protSheet) { cache.protInfoMap = m; return m; }

  const lastRow = protSheet.getLastRow();
  if (lastRow < 2) { cache.protInfoMap = m; return m; }

  const data = protSheet.getRange(2, 1, lastRow - 1, 11).getValues();
  data.forEach(function(r) {
    const name = String(r[0] || "").trim();
    if (!name) return;

    const cat = (r[CENTRAL_PROT_CAT_IDX] || "");
    const reqForce = _central_num_(r[CENTRAL_PROT_REQFORCE_IDX]);

    m.set(_central_norm_(name), { cat: cat, reqForce: reqForce });
  });

  cache.protInfoMap = m;
  return m;
}

function _central_getContactWeaponMap_(ss, cache) {
  if (_central_isLegacyEquipDisabled_(ss, cache)) {
    const m = new Map();
    cache.contactWeaponMap = m;
    return m;
  }

  if (cache.contactWeaponMap) return cache.contactWeaponMap;

  const sh = ss.getSheetByName(CENTRAL_WEAPONS_CONTACT_SHEET);
  const m = new Map();
  if (!sh) { cache.contactWeaponMap = m; return m; }

  const data = sh.getRange("A1:J50").getValues();
  data.forEach(function(r) {
    const name = String(r[0] || "").trim();
    if (!name) return;
    m.set(_central_norm_(name), { req: r[3], ini: r[4] });
  });

  cache.contactWeaponMap = m;
  return m;
}

function _central_getDistWeaponMap_(ss, cache) {
  if (_central_isLegacyEquipDisabled_(ss, cache)) {
    const m = new Map();
    cache.distWeaponMap = m;
    return m;
  }

  if (cache.distWeaponMap) return cache.distWeaponMap;

  const sh = ss.getSheetByName(CENTRAL_WEAPONS_DIST_SHEET);
  const m = new Map();
  if (!sh) { cache.distWeaponMap = m; return m; }

  const data = sh.getRange("A1:J200").getValues();
  data.forEach(function(r) {
    const name = String(r[1] || "").trim();
    if (!name) return;
    m.set(_central_norm_(name), { req: r[5], ini: r[6] });
  });

  cache.distWeaponMap = m;
  return m;
}