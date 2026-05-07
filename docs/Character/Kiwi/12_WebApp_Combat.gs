
/**
 * ============================================================
 * 12_WebApp_Combat.gs — Combat (webapp, fid)
 *
 * Refacto 2026-04 :
 * - ajout d'une architecture MODERN basée sur plages nommées
 * - fallback automatique vers l'architecture LEGACY si les plages
 *   nommées requises sont absentes
 * - la logique DRONE reste volontairement en LEGACY pour l'instant
 *
 * IMPORTANT
 * - Public API conservée pour le HTML :
 *   - getCombatContext(fid)
 *   - getSkillsForNames(fid, names)
 *   - getDroneSkillsForNames(fid, names)
 *   - getAmmoStatus(fid, kind)
 *   - applyBulletsToSelectedWeapon(fid, bulletsUsed, kind)
 *   - reload_weapon(fid)
 *   - reload_drone(fid)
 *
 * Source de vérité MODERN :
 * - arme active : ArmesObj1 / ArmesObj1Nom / ArmesObj1ID
 * - données arme : Inventaire via plages nommées
 * - compétences : CompNom / CompTotal
 * ============================================================
 */

// ============================================================
// ARCHITECTURE
// ============================================================
const POLARIS_COMBAT_ARCH_MODE = 'AUTO'; // AUTO | MODERN | LEGACY

const COMBAT_MODERN_RANGES = {
  selectedWeapon:             'ArmesObj1',
  selectedWeaponName:         'ArmesObj1Nom',
  selectedWeaponId:           'ArmesObj1ID',
  selectedWeaponSkill:        'ArmesCompLiee1',
  weaponModeSelected:         'Arme1ModeTirSel',
  weaponCaliber:              'Arme1Cal',
  weaponMagazineMax:          'Armes1Chargeur',
  weaponMagazineRemain:       'Armes1ChargeurBallesRestantes',
  equippedAmmoName:           'MunitionsEquipées',

  invIds:                     'InventaireIDObj',
  invNames:                   'InventaireNomObj',
  invModes:                   'InventaireObjModedeTir',
  invAmmoNames:               'InventaireObjMun',
  invCalibers:                'InventaireObjCAL',
  invQty:                     'InventaireQteObj',

  compNames:                  'CompNom',
  compTotals:                 'CompTotal'
};

const COMBAT_MODERN_REQUIRED = [
  COMBAT_MODERN_RANGES.selectedWeapon,
  COMBAT_MODERN_RANGES.selectedWeaponName,
  COMBAT_MODERN_RANGES.selectedWeaponId,
  COMBAT_MODERN_RANGES.selectedWeaponSkill,
  COMBAT_MODERN_RANGES.weaponCaliber,
  COMBAT_MODERN_RANGES.weaponMagazineMax,
  COMBAT_MODERN_RANGES.weaponMagazineRemain,
  COMBAT_MODERN_RANGES.equippedAmmoName,
  COMBAT_MODERN_RANGES.invIds,
  COMBAT_MODERN_RANGES.invNames,
  COMBAT_MODERN_RANGES.invModes,
  COMBAT_MODERN_RANGES.invAmmoNames,
  COMBAT_MODERN_RANGES.invCalibers,
  COMBAT_MODERN_RANGES.invQty,
  COMBAT_MODERN_RANGES.compNames,
  COMBAT_MODERN_RANGES.compTotals
];

// ============================================================
// LEGACY — regroupé ici pour nettoyage futur
// ============================================================
const LEGACY_COMBAT = {
  DIST_CHECK_RANGE: 'P29:P33',
  DIST_ROW_START: 29,
  DIST_WEAPON_NAME_COL: 17, // Q

  CONTACT_CHECK_RANGE: 'P20:P24',
  CONTACT_ROW_START: 20,
  CONTACT_WEAPON_NAME_COL: 17, // Q

  SHEET_WEAPONS_RANGED: 'Armes à distances',
  SHEET_WEAPONS_CONTACT: 'Armes de contact',

  AMMO_COL: 43, // AQ (chargeur actuel sur la ligne arme P29..P33)
  WEAPON_ROW_START: 29,

  // calibre arme équipée : AS29..AS33
  WEAPON_CALIBER_COL: 45, // AS

  // stock munitions : calibres en AO65..AO69
  AMMO_KEY_RANGE: 'AO65:AO69',
  AMMO_KEY_ROW_START: 65,

  AMMO_STOCK_COL: 50, // AX
  AMMO_CAPA_COL: 55,  // BC

  // DRONE
  DRONE_FLAG_ROW: 71, // AO71
  DRONE_FLAG_COL: 41, // AO
  DRONE_FLAG_KEY: 'DRONES_',

  DRONE_WEAPON_ROW: 80, // AS80
  DRONE_WEAPON_COL: 45, // AS

  DRONE_AMMO_ROW: 82,     // BA82
  DRONE_AMMO_COL: 53,     // BA
  DRONE_AMMO_MAX_ROW: 82, // AW82
  DRONE_AMMO_MAX_COL: 49, // AW
  DRONE_CALIBER_ROW: 82,  // AY82
  DRONE_CALIBER_COL: 51,  // AY

  DRONE_SKILLS_ROW_START: 91, // AP91..AP96
  DRONE_SKILLS_ROWS: 6,
  DRONE_SKILL_NAME_COL: 42,   // AP
  DRONE_SKILL_SCORE_COL: 48   // AV
};

// ============================================================
// HELPERS FALLBACK
// ============================================================
if (typeof _toNumberOrZero_ !== 'function') {
  function _toNumberOrZero_(v){
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
}

if (typeof _parseLeadingInt_ !== 'function') {
  function _parseLeadingInt_(s){
    const txt = String(s || '').trim();
    const m = txt.match(/^\s*(-?\d+)/);
    return m ? Number(m[1]) : NaN;
  }
}

// ============================================================
// PUBLIC API
// ============================================================
function getCombatContext(fid) {
  const { ss, sh } = getSheet_(fid, 'Personnage');
  const arch = _combat_getArchitecture_(ss);

  if (arch.mode === 'MODERN') {
    return _combat_getContext_modern_(ss, sh);
  }
  return _combat_getContext_legacy_(ss, sh);
}

function getSkillsForNames(fid, names) {
  const wanted = Array.isArray(names) ? names : [];
  if (!wanted.length) return [];

  const { ss, sh } = getSheet_(fid, 'Personnage');
  const arch = _combat_getArchitecture_(ss);

  if (arch.mode === 'MODERN') {
    return _combat_getSkillsForNames_modern_(ss, wanted);
  }
  return _combat_getSkillsForNames_legacy_(sh, wanted);
}

/**
 * Drone skills = volontairement legacy pour l'instant
 */
function getDroneSkillsForNames(fid, names) {
  const { sh } = getSheet_(fid, 'Personnage');
  if (!_combat_isDroneActive_legacy_(sh)) return [];
  return _combat_getDroneSkillsList_legacy_(sh, names);
}

function getAmmoStatus(fid, kind) {
  return _combat_getSelectedAmmo_(fid, kind);
}

function applyBulletsToSelectedWeapon(fid, bulletsUsed, kind) {
  try {
    const n = Number(bulletsUsed);
    if (!Number.isFinite(n) || n <= 0) {
      return { ok: false, reason: 'INVALID_BULLETS', bulletsUsed: bulletsUsed };
    }

    const { ss, sh } = getSheet_(fid, 'Personnage');
    const arch = _combat_getArchitecture_(ss);

    let lock = null;
    try { lock = LockService.getDocumentLock(); } catch (e) { lock = null; }
    if (!lock) lock = LockService.getScriptLock();

    lock.waitLock(5000);
    try {
      if (arch.mode === 'MODERN') {
        return _combat_applyBullets_modern_(ss, sh, n, kind);
      }
      return _combat_applyBullets_legacy_(sh, n, kind);
    } finally {
      try { lock.releaseLock(); } catch (_) {}
    }
  } catch (e) {
    return {
      ok: false,
      reason: 'EXCEPTION',
      message: e && e.message ? e.message : String(e),
      stack: e && e.stack ? String(e.stack) : ''
    };
  }
}

function reload_weapon(fid) {
  try {
    fid = String(fid || '').trim();
    if (!fid) return { ok: false, error: 'FID manquant.' };

    const ss = SpreadsheetApp.openById(fid);
    const arch = _combat_getArchitecture_(ss);

    if (arch.mode === 'MODERN') {
      return _combat_reloadWeapon_modern_(ss);
    }
    return _combat_reloadWeapon_legacy_(fid);

  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

// wrappers conservés pour compatibilité externe éventuelle
function reload_weapon_named_(fid) {
  const ss = SpreadsheetApp.openById(String(fid || '').trim());
  return _combat_reloadWeapon_modern_(ss);
}

function reload_weapon_legacy_(fid) {
  return _combat_reloadWeapon_legacy_(fid);
}

function reload_drone(fid) {
  return _combat_reloadDrone_legacy_(fid);
}

// ============================================================
// ARCHITECTURE HELPERS
// ============================================================
function _combat_getArchitecture_(ss) {
  const forced = String(POLARIS_COMBAT_ARCH_MODE || 'AUTO').trim().toUpperCase();
  if (forced === 'MODERN') {
    return {
      mode: 'MODERN',
      missing: _combat_getMissingNamedRanges_(ss, COMBAT_MODERN_REQUIRED)
    };
  }
  if (forced === 'LEGACY') {
    return { mode: 'LEGACY', missing: [] };
  }

  const missing = _combat_getMissingNamedRanges_(ss, COMBAT_MODERN_REQUIRED);
  return {
    mode: missing.length ? 'LEGACY' : 'MODERN',
    missing: missing
  };
}

function _combat_getMissingNamedRanges_(ss, names) {
  const missing = [];
  for (let i = 0; i < names.length; i++) {
    if (!_combat_namedRangeExists_(ss, names[i])) missing.push(names[i]);
  }
  return missing;
}

function _combat_namedRangeExists_(ss, name) {
  try {
    return !!ss.getRangeByName(name);
  } catch (_) {
    return false;
  }
}

function _combat_getNamedRangeStrict_(ss, name) {
  const r = ss.getRangeByName(name);
  if (!r) throw new Error('Plage nommée introuvable : ' + name);
  return r;
}

function _combat_getNamedDisplayValue_(ss, name) {
  const r = _combat_getNamedRangeStrict_(ss, name);
  return String(r.getDisplayValue() || r.getValue() || '').trim();
}

function _combat_getNamedRawValue_(ss, name) {
  const r = _combat_getNamedRangeStrict_(ss, name);
  return r.getValue();
}

function _combat_getNamedValues1D_(ss, name, asDisplay) {
  const r = _combat_getNamedRangeStrict_(ss, name);
  const vals = asDisplay ? r.getDisplayValues() : r.getValues();
  return vals.flat();
}

function _combat_getNamedValues1DAsStrings_(ss, name, asDisplay) {
  return _combat_getNamedValues1D_(ss, name, asDisplay).map(function(v){
    return String(v == null ? '' : v).trim();
  });
}

function _combat_readCountFromRange_(range) {
  const raw = range.getValue();
  const display = String(range.getDisplayValue() || raw || '').trim();
  let count = Number(raw);
  if (!Number.isFinite(count)) count = _parseLeadingInt_(display);
  if (!Number.isFinite(count)) count = 0;
  return { count: count, raw: raw, display: display };
}

// ============================================================
// MODERN — contexte / compétences / ammo / reload
// ============================================================
function _combat_getContext_modern_(ss, sh) {
  const primary = _combat_buildPrimaryContext_modern_(ss);

  // drone volontairement inchangé : on le lit avec le legacy existant
  const drone = _combat_buildDroneContext_legacy_(ss, sh);

  const hasWeapon = !!(primary && primary.ok && primary.type && primary.weaponName);
  const isDronePrimary = (!hasWeapon && drone.active);

  if (isDronePrimary) {
    return {
      ok: true,
      type: 'DISTANCE',
      weaponName: drone.weaponName || '',
      skillsWanted: [],
      allowCC: !!drone.allowCC,
      allowAuto: !!drone.allowAuto,
      rawModes: drone.rawModes || '',
      hasDrone: true,
      drone: drone,
      isDronePrimary: true
    };
  }

  return Object.assign({}, primary, {
    hasDrone: !!drone.active,
    drone: drone,
    isDronePrimary: false
  });
}

function _combat_buildPrimaryContext_modern_(ss) {
  const snap = _combat_getModernWeaponSnapshot_(ss);
  if (!snap.ok) {
    return {
      ok: true,
      type: null,
      weaponName: '',
      skillsWanted: [],
      allowCC: false,
      allowAuto: false,
      rawModes: ''
    };
  }

  const skillsWanted = [];
  if (snap.skillName) skillsWanted.push(snap.skillName);

  const allowAuto = snap.modeTokens.includes('RC') || snap.modeTokens.includes('RL');
  if (allowAuto) skillsWanted.push('Tir automatiques *');

  return {
    ok: true,
    type: snap.type,
    weaponName: snap.weaponName || '',
    skillsWanted: skillsWanted,
    allowCC: snap.modeTokens.includes('CC'),
    allowAuto: allowAuto,
    rawModes: snap.rawModes || ''
  };
}

function _combat_getSkillsForNames_modern_(ss, wanted) {
  const compNames = _combat_getNamedValues1DAsStrings_(ss, COMBAT_MODERN_RANGES.compNames, false);
  const compTotals = _combat_getNamedValues1D_(ss, COMBAT_MODERN_RANGES.compTotals, false);

  const len = Math.min(compNames.length, compTotals.length);
  const found = new Map();

  for (let i = 0; i < len; i++) {
    const name = String(compNames[i] || '').trim();
    if (!name) continue;
    found.set(normalizeKey__(name), compTotals[i]);
  }

  return wanted.map(function(n){
    const key = normalizeKey__(n);
    return { name: n, sub: '', value: found.has(key) ? found.get(key) : '' };
  });
}

function _combat_getSelectedAmmo_(fid, kind) {
  const { ss, sh } = getSheet_(fid, 'Personnage');
  const arch = _combat_getArchitecture_(ss);

  if (arch.mode === 'MODERN') {
    return _combat_getSelectedAmmo_modern_(ss, sh, kind);
  }
  return _combat_getSelectedAmmo_legacy_(sh, kind);
}

function _combat_getSelectedAmmo_modern_(ss, sh, kind) {
  const k = String(kind || 'AUTO').trim().toUpperCase();
  const snap = _combat_getModernWeaponSnapshot_(ss);

  if (k === 'DRONE') {
    return _combat_getSelectedAmmo_droneLegacyOnly_(sh);
  }

  if ((k === 'WEAPON' || k === 'AUTO') && snap.ok && snap.type === 'DISTANCE') {
    const ammoCell = _combat_getNamedRangeStrict_(ss, COMBAT_MODERN_RANGES.weaponMagazineRemain);
    const ammoInfo = _combat_readCountFromRange_(ammoCell);
    return {
      ok: true,
      kind: 'WEAPON',
      row: null,
      ammo: ammoInfo.count,
      ammoRaw: ammoInfo.raw,
      ammoDisplay: ammoInfo.display
    };
  }

  if (k === 'WEAPON') {
    return { ok: false, reason: 'NO_SELECTION', want: 'WEAPON' };
  }

  // AUTO : si pas d'arme distance moderne, on laisse le drone legacy prendre la main si présent
  const droneSel = _combat_getSelectedAmmo_droneLegacyOnly_(sh);
  if (droneSel.ok) return droneSel;

  return { ok: false, reason: 'NO_SELECTION' };
}

function _combat_applyBullets_modern_(ss, sh, bulletsUsed, kind) {
  const k = String(kind || 'AUTO').trim().toUpperCase();

  if (k === 'DRONE') {
    return _combat_applyBullets_droneLegacyOnly_(sh, bulletsUsed);
  }

  const snap = _combat_getModernWeaponSnapshot_(ss);
  if (snap.ok && snap.type === 'DISTANCE') {
    const ammoCell = _combat_getNamedRangeStrict_(ss, COMBAT_MODERN_RANGES.weaponMagazineRemain);
    const ammoInfo = _combat_readCountFromRange_(ammoCell);
    const ammo = ammoInfo.count;

    if (ammo < bulletsUsed) {
      return {
        ok: false,
        reason: 'NOT_ENOUGH_AMMO',
        kind: 'WEAPON',
        row: null,
        ammo: ammo,
        need: bulletsUsed
      };
    }

    const newAmmo = ammo - bulletsUsed;
    ammoCell.setValue(newAmmo);

    return {
      ok: true,
      kind: 'WEAPON',
      row: null,
      ammoBefore: ammo,
      ammoAfter: newAmmo,
      used: bulletsUsed
    };
  }

  if (k === 'WEAPON') {
    return { ok: false, reason: 'NO_SELECTION', want: 'WEAPON' };
  }

  // AUTO : si pas d'arme distance moderne, on tente le drone legacy
  if (_combat_isDroneActive_legacy_(sh)) {
    return _combat_applyBullets_droneLegacyOnly_(sh, bulletsUsed);
  }

  return { ok: false, reason: 'NO_SELECTION' };
}

function _combat_reloadWeapon_modern_(ss) {
  try {
    const lock = LockService.getScriptLock();
    lock.waitLock(5000);

    try {
      const snap = _combat_getModernWeaponSnapshot_(ss);
      if (!snap.ok) {
        return { ok: false, error: 'Aucune arme sélectionnée dans ArmesObj1.' };
      }
      if (snap.type !== 'DISTANCE') {
        return { ok: false, error: 'L’arme sélectionnée n’utilise pas de munitions.' };
      }

      const weaponName = snap.weaponName || '';
      const weaponIdRaw = snap.weaponIdRaw;
      const calibre = _combat_getNamedDisplayValue_(ss, COMBAT_MODERN_RANGES.weaponCaliber);
      const equippedAmmoName = _combat_getNamedDisplayValue_(ss, COMBAT_MODERN_RANGES.equippedAmmoName);

      if (!equippedAmmoName) {
        return { ok: false, error: 'Aucune munition équipée dans MunitionsEquipées.' };
      }

      const chargeurRestantCell = _combat_getNamedRangeStrict_(ss, COMBAT_MODERN_RANGES.weaponMagazineRemain);
      const chargeurMaxCell = _combat_getNamedRangeStrict_(ss, COMBAT_MODERN_RANGES.weaponMagazineMax);
      const invIdsRange = _combat_getNamedRangeStrict_(ss, COMBAT_MODERN_RANGES.invIds);
      const invNames = _combat_getNamedValues1DAsStrings_(ss, COMBAT_MODERN_RANGES.invNames, false);
      const invQtyRange = _combat_getNamedRangeStrict_(ss, COMBAT_MODERN_RANGES.invQty);

      const Y = _toNumberOrZero_(chargeurRestantCell.getValue());
      const chargeurMaxRaw = String(chargeurMaxCell.getDisplayValue() || chargeurMaxCell.getValue() || '').trim();
      const X = _parseLeadingInt_(chargeurMaxRaw);

      if (!Number.isFinite(X) || X <= 0) {
        return {
          ok: false,
          error: 'Impossible d’extraire la capacité max depuis Armes1Chargeur (valeur: ' + chargeurMaxRaw + ').'
        };
      }

      const invIds = invIdsRange.getDisplayValues().flat().map(function(v){ return String(v || '').trim(); });
      if (invIds.length !== invNames.length || invIds.length !== invQtyRange.getNumRows()) {
        return {
          ok: false,
          error: 'InventaireIDObj, InventaireNomObj et InventaireQteObj n’ont pas la même hauteur.'
        };
      }

      const weaponInvIdx = _combat_findInventoryIndex_(invIds, invNames, weaponIdRaw, weaponName);
      if (weaponInvIdx === -1) {
        return {
          ok: false,
          error: 'Objet arme introuvable dans l’inventaire pour ID=' + weaponIdRaw + ' / Nom=' + weaponName
        };
      }

      const ammoNameKey = normalizeKey__(equippedAmmoName);
      const ammoInvIdx = invNames.findIndex(function(name){
        return normalizeKey__(name) === ammoNameKey;
      });
      if (ammoInvIdx === -1) {
        return { ok: false, error: 'Munition introuvable dans l’inventaire : ' + equippedAmmoName };
      }

      const Z = X - Y;
      const ammoQtyBefore = _toNumberOrZero_(invQtyRange.getCell(ammoInvIdx + 1, 1).getValue());

      if (Z > 0) {
        if (ammoQtyBefore < Z) {
          return {
            ok: false,
            error:
              'Stock insuffisant.\n' +
              'Arme: ' + weaponName + '\n' +
              'ID arme: ' + weaponIdRaw + '\n' +
              'Calibre: ' + (calibre || '—') + '\n' +
              'Munition: ' + equippedAmmoName + '\n' +
              'Quantité inventaire = ' + ammoQtyBefore + '\n' +
              'Besoin = ' + Z + ' (X ' + X + ' - Y ' + Y + ')'
          };
        }
        invQtyRange.getCell(ammoInvIdx + 1, 1).setValue(ammoQtyBefore - Z);
      }

      chargeurRestantCell.setValue(X);
      SpreadsheetApp.flush();

      return {
        ok: true,
        weaponName: weaponName,
        weaponId: weaponIdRaw,
        calibre: calibre,
        ammoName: equippedAmmoName,
        before: {
          chargeur: Y,
          ammoQty: ammoQtyBefore
        },
        after: {
          chargeur: X,
          ammoQty: (Z > 0 ? ammoQtyBefore - Z : ammoQtyBefore)
        },
        usedFromStock: (Z > 0 ? Z : 0),
        weaponInventoryIndex: weaponInvIdx + 1,
        ammoInventoryIndex: ammoInvIdx + 1,
        mode: 'modern'
      };

    } finally {
      try { lock.releaseLock(); } catch (_) {}
    }
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

function _combat_getModernWeaponSnapshot_(ss) {
  try {
    const selectedRaw = _combat_getNamedDisplayValue_(ss, COMBAT_MODERN_RANGES.selectedWeapon);
    const weaponName = _combat_getNamedDisplayValue_(ss, COMBAT_MODERN_RANGES.selectedWeaponName) || selectedRaw;
    const weaponIdRaw = _combat_getNamedDisplayValue_(ss, COMBAT_MODERN_RANGES.selectedWeaponId);
    const skillName = _combat_getNamedDisplayValue_(ss, COMBAT_MODERN_RANGES.selectedWeaponSkill);
    const namedCaliber = _combat_getNamedDisplayValue_(ss, COMBAT_MODERN_RANGES.weaponCaliber);
    const namedAmmo = _combat_getNamedDisplayValue_(ss, COMBAT_MODERN_RANGES.equippedAmmoName);
    const namedMagMaxRaw = _combat_getNamedDisplayValue_(ss, COMBAT_MODERN_RANGES.weaponMagazineMax);

    if (!selectedRaw && !weaponName && !weaponIdRaw) {
      return { ok: false, reason: 'NO_SELECTION' };
    }

    const invIds = _combat_getNamedValues1DAsStrings_(ss, COMBAT_MODERN_RANGES.invIds, true);
    const invNames = _combat_getNamedValues1DAsStrings_(ss, COMBAT_MODERN_RANGES.invNames, false);
    const invModes = _combat_getNamedValues1DAsStrings_(ss, COMBAT_MODERN_RANGES.invModes, false);
    const invAmmoNames = _combat_getNamedValues1DAsStrings_(ss, COMBAT_MODERN_RANGES.invAmmoNames, false);
    const invCalibers = _combat_getNamedValues1DAsStrings_(ss, COMBAT_MODERN_RANGES.invCalibers, false);

    const len = Math.min(invIds.length, invNames.length, invModes.length, invAmmoNames.length, invCalibers.length);
    const idx = _combat_findInventoryIndex_(
      invIds.slice(0, len),
      invNames.slice(0, len),
      weaponIdRaw,
      weaponName
    );

    if (idx === -1) {
      return {
        ok: false,
        reason: 'WEAPON_NOT_FOUND',
        weaponName: weaponName,
        weaponId: weaponIdRaw
      };
    }

    const rawModes = String(invModes[idx] || '').trim();
    const ammoName = String(invAmmoNames[idx] || '').trim();
    const caliber = String(invCalibers[idx] || '').trim();
    const modeTokens = _combat_parseModeTokens_(rawModes);
    const magMax = _parseLeadingInt_(namedMagMaxRaw);

    const type = _combat_inferWeaponType_(rawModes, ammoName || namedAmmo, caliber || namedCaliber, magMax);

    return {
      ok: true,
      inventoryIndex: idx,
      weaponName: weaponName,
      weaponIdRaw: weaponIdRaw,
      skillName: skillName,
      rawModes: rawModes,
      modeTokens: modeTokens,
      ammoName: ammoName || namedAmmo,
      caliber: caliber || namedCaliber,
      magazineMax: Number.isFinite(magMax) ? magMax : 0,
      type: type
    };
  } catch (e) {
    return {
      ok: false,
      reason: 'EXCEPTION',
      message: e && e.message ? e.message : String(e)
    };
  }
}

function _combat_findInventoryIndex_(invIds, invNames, weaponIdRaw, weaponName) {
  const idKey = String(weaponIdRaw || '').trim();
  const nameKey = normalizeKey__(weaponName);

  let idx = -1;
  if (idKey) {
    idx = invIds.findIndex(function(id, i){
      return _combat_idsMatch_(id, idKey) &&
        (!nameKey || normalizeKey__(invNames[i]) === nameKey);
    });
    if (idx === -1) {
      idx = invIds.findIndex(function(id){ return _combat_idsMatch_(id, idKey); });
    }
  }
  if (idx === -1 && nameKey) {
    idx = invNames.findIndex(function(name){ return normalizeKey__(name) === nameKey; });
  }
  return idx;
}

function _combat_idsMatch_(a, b) {
  const sa = String(a == null ? '' : a).trim();
  const sb = String(b == null ? '' : b).trim();
  if (!sa || !sb) return false;
  if (sa === sb) return true;

  const na = Number(sa);
  const nb = Number(sb);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;

  return normalizeKey__(sa) === normalizeKey__(sb);
}

function _combat_parseModeTokens_(rawModes) {
  return String(rawModes || '')
    .split(/[\/,;|]+/)
    .map(function(s){ return String(s || '').trim().toUpperCase(); })
    .filter(Boolean);
}

function _combat_inferWeaponType_(rawModes, ammoName, caliber, magazineMax) {
  const tokens = _combat_parseModeTokens_(rawModes);
  const hasRangedModes = tokens.includes('RC') || tokens.includes('RL');
  const hasAmmo = !!String(ammoName || '').trim();
  const hasCal = !!String(caliber || '').trim();
  const hasMag = Number.isFinite(Number(magazineMax)) && Number(magazineMax) > 0;

  if (hasRangedModes || hasAmmo || hasCal || hasMag) return 'DISTANCE';
  return 'CONTACT';
}

// ============================================================
// LEGACY — contexte / compétences / ammo / référentiels / drone
// ============================================================
function _combat_getContext_legacy_(ss, sh) {
  const droneActive = _combat_isDroneActive_legacy_(sh);

  const distSel = _combat_findCheckedRow_legacy_(sh, LEGACY_COMBAT.DIST_CHECK_RANGE, LEGACY_COMBAT.DIST_ROW_START);
  const contSel = _combat_findCheckedRow_legacy_(sh, LEGACY_COMBAT.CONTACT_CHECK_RANGE, LEGACY_COMBAT.CONTACT_ROW_START);

  let primary = { ok:true, type:null, weaponName:'', skillsWanted:[], allowCC:false, allowAuto:false, rawModes:'' };

  if (distSel.row != null) {
    const weaponName = _combat_getCellString_legacy_(sh, distSel.row, LEGACY_COMBAT.DIST_WEAPON_NAME_COL);
    if (!weaponName) {
      primary = { ok:false, reason:'NO_WEAPON_NAME', type:'DISTANCE' };
    } else {
      const rangedInfo = _combat_lookupRangedWeaponInfo_legacy_(ss, weaponName);
      if (!rangedInfo.ok) {
        primary = rangedInfo;
      } else {
        const skillsWanted = [];
        if (rangedInfo.competence) skillsWanted.push(rangedInfo.competence);

        const allowAuto = rangedInfo.modes.includes('RC') || rangedInfo.modes.includes('RL');
        if (allowAuto) skillsWanted.push('Tir automatiques *');

        const allowCC = rangedInfo.modes.includes('CC');

        primary = {
          ok: true,
          type: 'DISTANCE',
          weaponName: weaponName,
          skillsWanted: skillsWanted,
          allowCC: allowCC,
          allowAuto: allowAuto,
          rawModes: rangedInfo.rawModes
        };
      }
    }
  } else if (contSel.row != null) {
    const weaponName = _combat_getCellString_legacy_(sh, contSel.row, LEGACY_COMBAT.CONTACT_WEAPON_NAME_COL);
    if (!weaponName) {
      primary = { ok:false, reason:'NO_WEAPON_NAME', type:'CONTACT' };
    } else {
      const contInfo = _combat_lookupContactWeaponInfo_legacy_(ss, weaponName);
      if (!contInfo.ok) {
        primary = contInfo;
      } else {
        const skillsWanted = [];
        if (contInfo.competence) skillsWanted.push(contInfo.competence);

        primary = {
          ok: true,
          type: 'CONTACT',
          weaponName: weaponName,
          skillsWanted: skillsWanted
        };
      }
    }
  }

  const drone = _combat_buildDroneContext_legacy_(ss, sh);

  const hasWeapon = !!(primary && primary.ok && primary.type && primary.weaponName);
  const isDronePrimary = (!hasWeapon && drone.active);

  if (isDronePrimary) {
    primary = {
      ok: true,
      type: 'DISTANCE',
      weaponName: drone.weaponName || '',
      skillsWanted: [],
      allowCC: !!drone.allowCC,
      allowAuto: !!drone.allowAuto,
      rawModes: drone.rawModes
    };
  }

  return Object.assign({}, primary, {
    hasDrone: !!drone.active,
    drone: drone,
    isDronePrimary: !!isDronePrimary
  });
}

function _combat_getSkillsForNames_legacy_(sh, wanted) {
  const wantedMap = new Map(wanted.map(function(s){ return [normalizeKey__(s), s]; }));

  const startRow = 40;
  const maxRows = 250;
  const rows = sh.getRange(startRow, 3, maxRows, 18).getValues(); // C..T

  const found = new Map();
  for (let i = 0; i < rows.length; i++) {
    const name = (rows[i][0] ?? '').toString().trim(); // C
    if (!name) continue;
    const key = normalizeKey__(name);
    if (wantedMap.has(key)) found.set(key, rows[i][17] ?? ''); // T
  }

  return wanted.map(function(n){
    const key = normalizeKey__(n);
    return { name: n, sub: '', value: found.has(key) ? found.get(key) : '' };
  });
}

function _combat_getSelectedAmmo_legacy_(sh, kind) {
  const k = String(kind || 'AUTO').trim().toUpperCase();

  if (k === 'WEAPON') {
    const checks = sh.getRange(LEGACY_COMBAT.DIST_CHECK_RANGE).getValues().flat();
    let row = null;
    for (let i = 0; i < checks.length; i++) {
      if (checks[i] === true) { row = LEGACY_COMBAT.WEAPON_ROW_START + i; break; }
    }
    if (row == null) return { ok:false, reason:'NO_SELECTION', want:'WEAPON' };

    const ammoCell = sh.getRange(row, LEGACY_COMBAT.AMMO_COL);
    const ammoInfo = _combat_readCountFromRange_(ammoCell);
    return { ok:true, kind:'WEAPON', row:row, ammo:ammoInfo.count, ammoRaw:ammoInfo.raw, ammoDisplay:ammoInfo.display };
  }

  if (k === 'DRONE') {
    return _combat_getSelectedAmmo_droneLegacyOnly_(sh);
  }

  const checks = sh.getRange(LEGACY_COMBAT.DIST_CHECK_RANGE).getValues().flat();
  let row = null;
  for (let i = 0; i < checks.length; i++) {
    if (checks[i] === true) { row = LEGACY_COMBAT.WEAPON_ROW_START + i; break; }
  }
  if (row != null) {
    const ammoCell = sh.getRange(row, LEGACY_COMBAT.AMMO_COL);
    const ammoInfo = _combat_readCountFromRange_(ammoCell);
    return { ok:true, kind:'WEAPON', row:row, ammo:ammoInfo.count, ammoRaw:ammoInfo.raw, ammoDisplay:ammoInfo.display };
  }

  return _combat_getSelectedAmmo_droneLegacyOnly_(sh);
}

function _combat_applyBullets_legacy_(sh, bulletsUsed, kind) {
  const sel = _combat_getSelectedAmmo_legacy_(sh, kind);
  if (!sel.ok) return sel;

  if (sel.kind === 'DRONE') {
    return _combat_applyBullets_droneLegacyOnly_(sh, bulletsUsed);
  }

  const ammoCell = sh.getRange(sel.row, LEGACY_COMBAT.AMMO_COL);
  const ammoInfo = _combat_readCountFromRange_(ammoCell);
  const ammo = ammoInfo.count;

  if (ammo < bulletsUsed) {
    return { ok: false, reason: 'NOT_ENOUGH_AMMO', kind:'WEAPON', row: sel.row, ammo: ammo, need: bulletsUsed };
  }

  const newAmmo = ammo - bulletsUsed;
  ammoCell.setValue(newAmmo);

  return { ok: true, kind:'WEAPON', row: sel.row, ammoBefore: ammo, ammoAfter: newAmmo, used: bulletsUsed };
}

function _combat_findCheckedRow_legacy_(sh, a1, rowStart) {
  const vals = sh.getRange(a1).getValues().flat();
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] === true) return { row: rowStart + i };
  }
  return { row: null };
}

function _combat_getCellString_legacy_(sh, row, col) {
  return String(sh.getRange(row, col).getValue() ?? '').trim();
}

function _combat_lookupRangedWeaponInfo_legacy_(ss, weaponName) {
  const ws = ss.getSheetByName(LEGACY_COMBAT.SHEET_WEAPONS_RANGED);
  if (!ws) return { ok: false, reason: 'SHEET_MISSING', sheet: LEGACY_COMBAT.SHEET_WEAPONS_RANGED };

  const nameKey = normalizeKey__(weaponName);
  const lastRow = ws.getLastRow();
  const h = Math.max(2, lastRow);
  const data = ws.getRange(1, 1, h, 13).getValues(); // A..M

  for (let i = 0; i < data.length; i++) {
    const n = String(data[i][1] ?? '').trim(); // B
    if (!n) continue;

    if (normalizeKey__(n) === nameKey) {
      const comp = String(data[i][12] ?? '').trim(); // M
      const raw = String(data[i][7] ?? '').trim();   // H
      const list = _combat_parseModeTokens_(raw);
      return { ok: true, competence: comp, rawModes: raw, modes: list };
    }
  }
  return { ok: false, reason: 'WEAPON_NOT_FOUND', type: 'DISTANCE', weaponName: weaponName };
}

function _combat_lookupContactWeaponInfo_legacy_(ss, weaponName) {
  const ws = ss.getSheetByName(LEGACY_COMBAT.SHEET_WEAPONS_CONTACT);
  if (!ws) return { ok: false, reason: 'SHEET_MISSING', sheet: LEGACY_COMBAT.SHEET_WEAPONS_CONTACT };

  const nameKey = normalizeKey__(weaponName);
  const lastRow = ws.getLastRow();
  const h = Math.max(2, lastRow);
  const data = ws.getRange(1, 1, h, 11).getValues(); // A..K

  for (let i = 0; i < data.length; i++) {
    const n = String(data[i][0] ?? '').trim(); // A
    if (!n) continue;

    if (normalizeKey__(n) === nameKey) {
      const comp = String(data[i][10] ?? '').trim(); // K
      return { ok: true, competence: comp };
    }
  }
  return { ok: false, reason: 'WEAPON_NOT_FOUND', type: 'CONTACT', weaponName: weaponName };
}

// ============================================================
// LEGACY — drone (inchangé volontairement)
// ============================================================
function _combat_isDroneActive_legacy_(sh){
  const cell = sh.getRange(LEGACY_COMBAT.DRONE_FLAG_ROW, LEGACY_COMBAT.DRONE_FLAG_COL);
  const raw = String(cell.getDisplayValue() || cell.getValue() || '').trim();
  const k = normalizeKey__(raw);
  return (k === LEGACY_COMBAT.DRONE_FLAG_KEY) || k.startsWith(LEGACY_COMBAT.DRONE_FLAG_KEY);
}

function _combat_getDroneSkillsList_legacy_(sh, names){
  const width = (LEGACY_COMBAT.DRONE_SKILL_SCORE_COL - LEGACY_COMBAT.DRONE_SKILL_NAME_COL) + 1; // AP..AV
  const rows = sh.getRange(
    LEGACY_COMBAT.DRONE_SKILLS_ROW_START,
    LEGACY_COMBAT.DRONE_SKILL_NAME_COL,
    LEGACY_COMBAT.DRONE_SKILLS_ROWS,
    width
  ).getValues();

  const outAll = [];
  for (let i = 0; i < rows.length; i++){
    const name = String(rows[i][0] ?? '').trim(); // AP
    if (!name) continue;
    const score = rows[i][width - 1];             // AV
    outAll.push({ name: name, sub: '', value: (score ?? '') });
  }

  const wanted = Array.isArray(names) ? names.map(function(v){ return String(v || '').trim(); }).filter(Boolean) : [];
  if (!wanted.length) return outAll;

  const found = new Map(outAll.map(function(it){ return [normalizeKey__(it.name), it.value]; }));
  return wanted.map(function(n){
    return { name: n, sub: '', value: found.get(normalizeKey__(n)) ?? '' };
  });
}

function _combat_buildDroneContext_legacy_(ss, sh) {
  if (!_combat_isDroneActive_legacy_(sh)) return { active:false };

  const droneWeaponName = _combat_getCellString_legacy_(sh, LEGACY_COMBAT.DRONE_WEAPON_ROW, LEGACY_COMBAT.DRONE_WEAPON_COL);

  let droneAllowAuto = true;
  let droneAllowCC = true;
  let droneRawModes = '';
  let droneSkillsWanted = [];

  if (droneWeaponName) {
    const info = _combat_lookupRangedWeaponInfo_legacy_(ss, droneWeaponName);
    if (info && info.ok) {
      droneRawModes = info.rawModes || '';
      const modes = Array.isArray(info.modes) ? info.modes : [];
      droneAllowAuto = modes.includes('RC') || modes.includes('RL');
      droneAllowCC = modes.includes('CC');

      if (info.competence) droneSkillsWanted.push(info.competence);
      if (droneAllowAuto) droneSkillsWanted.push('Tir automatiques *');
    }
  }

  return {
    active: true,
    weaponName: droneWeaponName || '',
    skillsWanted: droneSkillsWanted,
    allowAuto: !!droneAllowAuto,
    allowCC: !!droneAllowCC,
    rawModes: droneRawModes
  };
}

function _combat_getSelectedAmmo_droneLegacyOnly_(sh) {
  if (!_combat_isDroneActive_legacy_(sh)) return { ok:false, reason:'NO_SELECTION', want:'DRONE' };

  const cell = sh.getRange(LEGACY_COMBAT.DRONE_AMMO_ROW, LEGACY_COMBAT.DRONE_AMMO_COL);
  const ammoInfo = _combat_readCountFromRange_(cell);
  return { ok:true, kind:'DRONE', row:null, ammo:ammoInfo.count, ammoRaw:ammoInfo.raw, ammoDisplay:ammoInfo.display };
}

function _combat_applyBullets_droneLegacyOnly_(sh, bulletsUsed) {
  const ammoCell = sh.getRange(LEGACY_COMBAT.DRONE_AMMO_ROW, LEGACY_COMBAT.DRONE_AMMO_COL);
  const ammoInfo = _combat_readCountFromRange_(ammoCell);
  const ammo = ammoInfo.count;

  if (ammo < bulletsUsed) {
    return { ok: false, reason: 'NOT_ENOUGH_AMMO', kind: 'DRONE', ammo: ammo, need: bulletsUsed };
  }

  const newAmmo = ammo - bulletsUsed;
  ammoCell.setValue(newAmmo);

  return { ok: true, kind: 'DRONE', ammoBefore: ammo, ammoAfter: newAmmo, used: bulletsUsed };
}

function _combat_reloadWeapon_legacy_(fid) {
  try {
    fid = String(fid || '').trim();
    if (!fid) return { ok: false, error: 'FID manquant.' };

    const { sh } = getSheet_(fid, 'Personnage');

    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      const checks = sh.getRange(LEGACY_COMBAT.DIST_CHECK_RANGE).getValues().flat();
      const idx = checks.findIndex(function(v){ return v === true; });
      if (idx === -1) return { ok: false, error: 'Aucune arme cochée dans ' + LEGACY_COMBAT.DIST_CHECK_RANGE + '.' };

      const weaponRow = LEGACY_COMBAT.DIST_ROW_START + idx;
      const weaponName = String(sh.getRange(weaponRow, LEGACY_COMBAT.DIST_WEAPON_NAME_COL).getValue() || '').trim();

      const calibreCell = sh.getRange(weaponRow, LEGACY_COMBAT.WEAPON_CALIBER_COL);
      const calibre = String(calibreCell.getDisplayValue() || calibreCell.getValue() || '').trim();
      if (!calibre) return { ok: false, error: 'Calibre vide en AS' + weaponRow + '.' };

      const Y = _toNumberOrZero_(sh.getRange(weaponRow, LEGACY_COMBAT.AMMO_COL).getValue());

      const auCell = sh.getRange(weaponRow, 47);
      const auRaw = String(auCell.getDisplayValue() || auCell.getValue() || '').trim();
      const X = _parseLeadingInt_(auRaw);
      if (!Number.isFinite(X) || X <= 0) {
        return { ok: false, error: 'Impossible d’extraire X depuis AU' + weaponRow + ' (valeur: ' + auRaw + ').' };
      }

      const stockCals = sh.getRange(LEGACY_COMBAT.AMMO_KEY_RANGE).getValues().flat().map(function(v){ return String(v || '').trim(); });
      const key = normalizeKey__(calibre);
      const sIdx = stockCals.findIndex(function(c){ return normalizeKey__(c) === key; });
      if (sIdx === -1) {
        return { ok: false, error: 'Calibre introuvable dans le stock (' + LEGACY_COMBAT.AMMO_KEY_RANGE + ') : ' + calibre };
      }
      const stockRow = LEGACY_COMBAT.AMMO_KEY_ROW_START + sIdx;

      const Z = X - Y;
      if (Z > 0) {
        const axCell = sh.getRange(stockRow, LEGACY_COMBAT.AMMO_STOCK_COL);
        const stock = _toNumberOrZero_(axCell.getValue());

        if (stock < Z) {
          return {
            ok: false,
            error:
              'Stock insuffisant.\n' +
              'Arme: ' + (weaponName || '—') + '\n' +
              'Calibre: ' + calibre + '\n' +
              'AX' + stockRow + ' = ' + stock + '\n' +
              'Besoin Z = ' + Z + ' (X ' + X + ' - Y ' + Y + ')'
          };
        }
        axCell.setValue(stock - Z);
      }

      sh.getRange(weaponRow, LEGACY_COMBAT.AMMO_COL).setValue(X);

      return {
        ok: true,
        weaponName: weaponName,
        calibre: calibre,
        weaponRow: weaponRow,
        stockRow: stockRow,
        before: { chargeur: Y },
        after: { chargeur: X },
        usedFromStock: (Z > 0 ? Z : 0)
      };

    } finally {
      try { lock.releaseLock(); } catch (_) {}
    }

  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

function _combat_reloadDrone_legacy_(fid) {
  try {
    fid = String(fid || '').trim();
    if (!fid) return { ok: false, error: 'FID manquant.' };

    const { sh } = getSheet_(fid, 'Personnage');

    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      const calibre = String(
        sh.getRange(LEGACY_COMBAT.DRONE_CALIBER_ROW, LEGACY_COMBAT.DRONE_CALIBER_COL).getDisplayValue()
        || sh.getRange(LEGACY_COMBAT.DRONE_CALIBER_ROW, LEGACY_COMBAT.DRONE_CALIBER_COL).getValue()
        || ''
      ).trim();
      if (!calibre) return { ok:false, error:'Calibre drone vide en AY82.' };

      const Y = _toNumberOrZero_(sh.getRange(LEGACY_COMBAT.DRONE_AMMO_ROW, LEGACY_COMBAT.DRONE_AMMO_COL).getValue());

      const awRaw = String(
        sh.getRange(LEGACY_COMBAT.DRONE_AMMO_MAX_ROW, LEGACY_COMBAT.DRONE_AMMO_MAX_COL).getDisplayValue()
        || sh.getRange(LEGACY_COMBAT.DRONE_AMMO_MAX_ROW, LEGACY_COMBAT.DRONE_AMMO_MAX_COL).getValue()
        || ''
      ).trim();
      const X = _parseLeadingInt_(awRaw);
      if (!Number.isFinite(X) || X <= 0) return { ok:false, error:'Capacité drone invalide en AW82 (valeur: ' + awRaw + ').' };

      const stockCals = sh.getRange(LEGACY_COMBAT.AMMO_KEY_RANGE).getValues().flat().map(function(v){ return String(v || '').trim(); });
      const key = normalizeKey__(calibre);
      const sIdx = stockCals.findIndex(function(c){ return normalizeKey__(c) === key; });
      if (sIdx === -1) return { ok:false, error:'Calibre drone introuvable dans le stock (' + LEGACY_COMBAT.AMMO_KEY_RANGE + ') : ' + calibre };

      const stockRow = LEGACY_COMBAT.AMMO_KEY_ROW_START + sIdx;

      const Z = X - Y;
      if (Z > 0) {
        const axCell = sh.getRange(stockRow, LEGACY_COMBAT.AMMO_STOCK_COL);
        const stock = _toNumberOrZero_(axCell.getValue());
        if (stock < Z) {
          return {
            ok:false,
            error:
              'Stock insuffisant.\n' +
              'Drone calibre: ' + calibre + '\n' +
              'AX' + stockRow + ' = ' + stock + '\n' +
              'Besoin Z = ' + Z + ' (X ' + X + ' - Y ' + Y + ')'
          };
        }
        axCell.setValue(stock - Z);
      }

      sh.getRange(LEGACY_COMBAT.DRONE_AMMO_ROW, LEGACY_COMBAT.DRONE_AMMO_COL).setValue(X);

      return {
        ok:true,
        calibre: calibre,
        stockRow: stockRow,
        before:{ chargeur:Y },
        after:{ chargeur:X },
        usedFromStock:(Z > 0 ? Z : 0)
      };

    } finally {
      try { lock.releaseLock(); } catch (_) {}
    }

  } catch(e) {
    return { ok:false, error:String(e && e.message ? e.message : e) };
  }
}

// ============================================================
// UTILS
// ============================================================
function normalizeKey__(s) {
  return (s ?? '')
    .toString()
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
