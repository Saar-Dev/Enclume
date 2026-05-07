/**
 * ============================================================
 * Crafting_WebApp.gs — Polaris
 * - Liste toutes les armes du perso
 * - Liste les mods installables depuis l'inventaire
 * - Affiche les mods déjà installés sur l'arme sélectionnée
 * - Installe un mod sur une arme
 * - Supprime physiquement le mod de l'inventaire
 *
 * Règles :
 * - Arme = InventaireFamObj = "Armes"
 *          ET InventaireCATObj != "Accessoires pour armes"
 * - Mod installable = InventaireCATObj = "Accessoires pour armes"
 * - Clé unique = InventaireIDObj♦InventaireNomObj
 * - Stockage sur l'arme = 1 mod par ligne dans InventaireModInstalles
 * ============================================================
 */

/* =======================
   CONFIG
   ======================= */

const CRAFTING_INV_ID_NAME   = "InventaireIDObj";
const CRAFTING_INV_NAME_NAME = "InventaireNomObj";
const CRAFTING_INV_CAT_NAME  = "InventaireCATObj";
const CRAFTING_INV_FAM_NAME  = "InventaireFamObj";
const CRAFTING_INV_MODS_NAME = "InventaireModInstalles";

const CRAFTING_MOD_CATEGORY  = "Accessoires pour armes";
const CRAFTING_WEAPON_FAMILY = "Armes";
const CRAFTING_KEY_SEP       = "♦";
const CRAFTING_LINE_SEP      = "\n";

/* =======================
   API HTML
   ======================= */

function crafting_getState(fid) {
  try {
    const ss = _crafting_openSpreadsheet_(fid);
    const ctx = _crafting_getInventoryContext_(ss);
    if (!ctx.ok) return ctx;

    return _crafting_buildStateFromContext_(ctx);

  } catch (err) {
    return {
      ok: false,
      error: "Erreur crafting_getState : " + String((err && err.message) || err)
    };
  }
}

function crafting_installMod(fid, weaponKey, modKey) {
  try {
    const ss = _crafting_openSpreadsheet_(fid);
    const ctx = _crafting_getInventoryContext_(ss);
    if (!ctx.ok) return ctx;

    const weaponParsed = _crafting_parseKey_(weaponKey);
    const modParsed = _crafting_parseKey_(modKey);

    if (!weaponParsed) {
      return { ok: false, error: "Arme invalide." };
    }
    if (!modParsed) {
      return { ok: false, error: "Mod invalide." };
    }

    const weaponIdx = _crafting_findRowIndexByKey_(ctx, weaponKey);
    if (weaponIdx === -1) {
      return { ok: false, error: "Arme introuvable dans l'inventaire." };
    }

    const modIdx = _crafting_findRowIndexByKey_(ctx, modKey);
    if (modIdx === -1) {
      return { ok: false, error: "Mod introuvable dans l'inventaire." };
    }

    const weaponIsValid =
      _crafting_norm_(ctx.fams[weaponIdx]) === _crafting_norm_(CRAFTING_WEAPON_FAMILY) &&
      _crafting_norm_(ctx.cats[weaponIdx]) !== _crafting_norm_(CRAFTING_MOD_CATEGORY);

    if (!weaponIsValid) {
      return { ok: false, error: "La cible choisie n'est pas une arme valide." };
    }

    const modIsValid =
      _crafting_norm_(ctx.cats[modIdx]) === _crafting_norm_(CRAFTING_MOD_CATEGORY);

    if (!modIsValid) {
      return { ok: false, error: "L'objet choisi n'est pas un mod d'arme valide." };
    }

    if (weaponIdx === modIdx) {
      return { ok: false, error: "Impossible d'installer un objet sur lui-même." };
    }

    const currentRaw = String(ctx.mods[weaponIdx] || "").trim();
    const currentTokens = _crafting_splitTokens_(currentRaw);

    if (currentTokens.indexOf(modKey) !== -1) {
      return { ok: false, error: "Ce mod est déjà installé sur cette arme." };
    }

    const nextTokens = currentTokens.slice();
    nextTokens.push(modKey);
    const nextRaw = nextTokens.join(CRAFTING_LINE_SEP);

    // 1) Écriture sur l'arme avant suppression
    if (!_crafting_setWeaponModsByKey_(ss, weaponKey, nextRaw)) {
      return { ok: false, error: "Impossible d'écrire les mods sur l'arme." };
    }
    SpreadsheetApp.flush();

    // 2) Suppression physique de la ligne du mod
    const deleteRow = ctx.invIdsRange.getRow() + modIdx;
    ctx.inventorySheet.deleteRow(deleteRow);
    SpreadsheetApp.flush();

    // 3) Réécriture de sécurité après deleteRow
    if (!_crafting_setWeaponModsByKey_(ss, weaponKey, nextRaw)) {
      return {
        ok: false,
        error: "Le mod a été supprimé de l'inventaire, mais la réécriture finale sur l'arme a échoué."
      };
    }
    SpreadsheetApp.flush();

    const refreshed = crafting_getState(fid);
    if (!refreshed || refreshed.ok !== true) {
      return {
        ok: true,
        message: "Mod installé, mais refresh incomplet.",
        selectedWeaponKey: weaponKey
      };
    }

    refreshed.message = "Mod installé avec succès.";
    refreshed.selectedWeaponKey = weaponKey;
    return refreshed;

  } catch (err) {
    return {
      ok: false,
      error: "Erreur crafting_installMod : " + String((err && err.message) || err)
    };
  }
}

/* =======================
   Construction état
   ======================= */

function _crafting_buildStateFromContext_(ctx) {
  const weapons = [];
  const installableMods = [];

  for (let i = 0; i < ctx.ids.length; i++) {
    const id = ctx.ids[i];
    const name = ctx.names[i];
    const cat = ctx.cats[i];
    const fam = ctx.fams[i];
    const modsRaw = String(ctx.mods[i] || "").trim();
    const key = _crafting_makeKey_(id, name);

    if (!id || !name) continue;

    const famNorm = _crafting_norm_(fam);
    const catNorm = _crafting_norm_(cat);

    const isWeapon =
      famNorm === _crafting_norm_(CRAFTING_WEAPON_FAMILY) &&
      catNorm !== _crafting_norm_(CRAFTING_MOD_CATEGORY);

    const isInstallableMod =
      catNorm === _crafting_norm_(CRAFTING_MOD_CATEGORY);

    if (isWeapon) {
      const installedTokens = _crafting_splitTokens_(modsRaw);
      const installedMods = installedTokens
        .map(_crafting_parseKey_)
        .filter(Boolean)
        .map(function(parsed) {
          return {
            key: parsed.key,
            id: parsed.id,
            name: parsed.name
          };
        });

      weapons.push({
        key: key,
        id: id,
        name: name,
        family: fam,
        category: cat,
        installedMods: installedMods
      });
    }

    if (isInstallableMod) {
      installableMods.push({
        key: key,
        id: id,
        name: name,
        category: cat
      });
    }
  }

  weapons.sort(function(a, b) {
    return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
  });

  installableMods.sort(function(a, b) {
    return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
  });

  return {
    ok: true,
    weapons: weapons,
    installableMods: installableMods,
    counts: {
      weapons: weapons.length,
      installableMods: installableMods.length
    }
  };
}

/* =======================
   Inventory context
   ======================= */

function _crafting_openSpreadsheet_(fid) {
  const id = String(fid || "").trim();
  if (!id) throw new Error("FID manquant.");
  return SpreadsheetApp.openById(id);
}

function _crafting_getInventoryContext_(ss) {
  try {
    const invIdsRange   = _crafting_getNamedDataRange_(ss, CRAFTING_INV_ID_NAME);
    const invNamesRange = _crafting_getNamedDataRange_(ss, CRAFTING_INV_NAME_NAME);
    const invCatsRange  = _crafting_getNamedDataRange_(ss, CRAFTING_INV_CAT_NAME);
    const invFamsRange  = _crafting_getNamedDataRange_(ss, CRAFTING_INV_FAM_NAME);
    const invModsRange  = _crafting_getNamedDataRange_(ss, CRAFTING_INV_MODS_NAME);

    if (!invIdsRange)   return { ok:false, error:"Plage nommée introuvable : " + CRAFTING_INV_ID_NAME };
    if (!invNamesRange) return { ok:false, error:"Plage nommée introuvable : " + CRAFTING_INV_NAME_NAME };
    if (!invCatsRange)  return { ok:false, error:"Plage nommée introuvable : " + CRAFTING_INV_CAT_NAME };
    if (!invFamsRange)  return { ok:false, error:"Plage nommée introuvable : " + CRAFTING_INV_FAM_NAME };
    if (!invModsRange)  return { ok:false, error:"Plage nommée introuvable : " + CRAFTING_INV_MODS_NAME };

    const n = invIdsRange.getNumRows();
    if (
      invNamesRange.getNumRows() !== n ||
      invCatsRange.getNumRows() !== n ||
      invFamsRange.getNumRows() !== n ||
      invModsRange.getNumRows() !== n
    ) {
      return {
        ok: false,
        error: "Les plages inventaire n'ont pas toutes la même hauteur."
      };
    }

    return {
      ok: true,
      invIdsRange: invIdsRange,
      invNamesRange: invNamesRange,
      invCatsRange: invCatsRange,
      invFamsRange: invFamsRange,
      invModsRange: invModsRange,
      inventorySheet: invIdsRange.getSheet(),

      ids: invIdsRange.getValues().flat().map(function(v){ return _crafting_num_(v); }),
      names: invNamesRange.getValues().flat().map(function(v){ return String(v || "").trim(); }),
      cats: invCatsRange.getValues().flat().map(function(v){ return String(v || "").trim(); }),
      fams: invFamsRange.getValues().flat().map(function(v){ return String(v || "").trim(); }),
      mods: invModsRange.getValues().flat().map(function(v){ return String(v || "").trim(); })
    };

  } catch (err) {
    return { ok:false, error:String((err && err.message) || err) };
  }
}

/* =======================
   Helpers écriture / lookup
   ======================= */

function _crafting_setWeaponModsByKey_(ss, weaponKey, rawMods) {
  try {
    const ctx = _crafting_getInventoryContext_(ss);
    if (!ctx || !ctx.ok) return false;

    const weaponIdx = _crafting_findRowIndexByKey_(ctx, weaponKey);
    if (weaponIdx === -1) return false;

    ctx.invModsRange.getCell(weaponIdx + 1, 1).setValue(String(rawMods || ""));
    return true;

  } catch (err) {
    Logger.log("crafting setWeaponModsByKey error: " + (err && err.stack || err));
    return false;
  }
}

function _crafting_findRowIndexByKey_(ctx, key) {
  const target = String(key || "").trim();
  if (!target) return -1;

  for (let i = 0; i < ctx.ids.length; i++) {
    const rowKey = _crafting_makeKey_(ctx.ids[i], ctx.names[i]);
    if (rowKey === target) return i;
  }
  return -1;
}

/* =======================
   Generic helpers
   ======================= */

function _crafting_getNamedDataRange_(ss, name) {
  try {
    const rg = ss.getRangeByName(name);
    if (!rg) return null;

    // Convention : première ligne = en-tête
    if (rg.getNumRows() > 1) {
      return rg.offset(1, 0, rg.getNumRows() - 1, rg.getNumColumns());
    }
    return rg;
  } catch (_) {
    return null;
  }
}

function _crafting_num_(v) {
  const s = String(v == null ? "" : v).trim().replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function _crafting_norm_(s) {
  return String(s || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function _crafting_makeKey_(id, name) {
  const idNum = _crafting_num_(id);
  const cleanName = String(name || "").trim();
  if (!idNum || !cleanName) return "";
  return String(idNum) + CRAFTING_KEY_SEP + cleanName;
}

function _crafting_parseKey_(raw) {
  const txt = String(raw || "").trim();
  if (!txt) return null;

  const p = txt.indexOf(CRAFTING_KEY_SEP);
  if (p === -1) return null;

  const id = _crafting_num_(txt.slice(0, p));
  const name = String(txt.slice(p + CRAFTING_KEY_SEP.length) || "").trim();

  if (!id || !name) return null;

  return {
    key: txt,
    id: id,
    name: name
  };
}

function _crafting_splitTokens_(raw) {
  return String(raw || "")
    .replace(/\r/g, "")
    .split(/\n+/)
    .map(function(s){ return String(s || "").trim(); })
    .filter(Boolean);
}