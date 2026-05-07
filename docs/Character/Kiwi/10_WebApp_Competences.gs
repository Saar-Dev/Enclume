/**
 * ============================================================
 * 10_WebApp_Competences.gs — Compétences / Attributs / Points
 * - Compat auto : Named Ranges si présentes, sinon logique legacy A1
 * - Legacy regroupé en bas pour suppression facile plus tard
 * - Named mode : gestion complète via plages nommées
 * ============================================================
 */

// ------------------------------------------------------------
// Constantes — plages nommées Compétences / Attributs
// ------------------------------------------------------------

const COMP_NR = Object.freeze({
  XPDispo: "XPDispo",
  XPUtilises: "XPUtilises",
  Avantages: "Avantages",

  CompDescription: "CompDescription",            // A39:A1224 (optionnelle)
  CompCategories: "CompCategories",              // B39:B1224
  CompNom: "CompNom",                            // C39:C1224
  CompSousNom: "CompSousNom",                    // D39:D1224
  CompIndicateur: "CompIndicateur",              // L39:L1224
  CompAttributs: "CompAttributs",                // M39:M1224
  CompModificateur: "CompModificateur",          // O39:O1224
  CompBase: "CompBase",                          // P39:P1224
  CompMaitrise: "CompMaitrise",                  // R39:R1224
  CompTotal: "CompTotal",                        // T39:T1224

  CompetencesCAT: "CompetencesCAT",              // Compétences!A:A
  CompetencesNom: "CompetencesNom",              // Compétences!B:B
  CompetencesSousNom: "CompetencesSousNom",      // Compétences!C:C
  CompetencesMods: "CompetencesMods",            // Compétences!D:D
  CompetencesAttributs: "CompetencesAttributs",  // Compétences!E:E
  CompetencesPrerequis: "CompetencesPrérequis",  // Compétences!F:F
  CompetencesDescription: "CompetencesDescription" // Compétences!G:G
});

const ATTR_NR = Object.freeze([
  { key: "For", labelName: "ATTEnteteFor", valueName: "ATTMPCFor", fallbackCol: 31 },
  { key: "Con", labelName: "ATTEnteteCon", valueName: "ATTMPCCon", fallbackCol: 34 },
  { key: "Coo", labelName: "ATTEnteteCoo", valueName: "ATTMPCCoo", fallbackCol: 37 },
  { key: "Ada", labelName: "ATTEnteteAda", valueName: "ATTMPCAda", fallbackCol: 40 },
  { key: "Per", labelName: "ATTEntetePer", valueName: "ATTMPCPer", fallbackCol: 43 },
  { key: "Int", labelName: "ATTEnteteInt", valueName: "ATTMPCInt", fallbackCol: 46 },
  { key: "Vol", labelName: "ATTEnteteVol", valueName: "ATTMPCVol", fallbackCol: 49 },
  { key: "Pre", labelName: "ATTEntetePre", valueName: "ATTMPCPre", fallbackCol: 52 }
]);

// ------------------------------------------------------------
// Compat mode
// ------------------------------------------------------------

function comp_getRangeByNameOrNull_(ss, name) {
  try {
    return ss.getRangeByName(name) || null;
  } catch (e) {
    return null;
  }
}

function comp_getRangeByNameOrThrow_(ss, name) {
  const r = comp_getRangeByNameOrNull_(ss, name);
  if (!r) throw new Error(`Plage nommée introuvable : ${name}`);
  return r;
}

function comp_hasNamedRange_(ss, name) {
  return !!comp_getRangeByNameOrNull_(ss, name);
}

function comp_canUseNamedMode_(ss) {
  const required = [
    COMP_NR.XPDispo,
    COMP_NR.XPUtilises,
    COMP_NR.CompCategories,
    COMP_NR.CompNom,
    COMP_NR.CompSousNom,
    COMP_NR.CompMaitrise,
    COMP_NR.CompTotal,
    ...ATTR_NR.map(x => x.valueName)
  ];
  return required.every(name => comp_hasNamedRange_(ss, name));
}

function comp_getMode_(ss) {
  return comp_canUseNamedMode_(ss) ? "named" : "legacy";
}

function comp_altMode_(mode) {
  return mode === "named" ? "legacy" : "named";
}

function comp_dispatchReadByMode_(mode, namedFn, legacyFn) {
  return mode === "named" ? namedFn() : legacyFn();
}

function comp_safeReadDispatch_(ss, namedFn, legacyFn, validator) {
  const preferred = comp_getMode_(ss);
  const alternate = comp_altMode_(preferred);

  try {
    const res = comp_dispatchReadByMode_(preferred, namedFn, legacyFn);
    if (typeof validator === "function" && !validator(res)) throw new Error(`Résultat invalide en mode ${preferred}`);
    return res;
  } catch (err1) {
    try {
      const res2 = comp_dispatchReadByMode_(alternate, namedFn, legacyFn);
      if (typeof validator === "function" && !validator(res2)) throw new Error(`Résultat invalide en mode ${alternate}`);
      return res2;
    } catch (err2) {
      throw new Error(`Lecture compétences impossible. ${err1 && err1.message ? err1.message : err1} / fallback ${err2 && err2.message ? err2.message : err2}`);
    }
  }
}

function comp_getSpreadsheetFromAny_(ctx) {
  if (!ctx) throw new Error("Contexte Spreadsheet/Sheet manquant");
  if (typeof ctx.getRangeByName === "function" && typeof ctx.getSheetByName === "function") return ctx; // Spreadsheet
  if (typeof ctx.getParent === "function") return ctx.getParent(); // Sheet / Range
  throw new Error("Impossible de résoudre le Spreadsheet depuis le contexte fourni");
}

function comp_buildContiguousRangeFromAnchor_(anchorRange, numCols) {
  return anchorRange.getSheet().getRange(
    anchorRange.getRow(),
    anchorRange.getColumn(),
    anchorRange.getNumRows(),
    numCols
  );
}

function comp_getNamedColumnValues_(ss, name, startRow, numRows) {
  const rg = comp_getRangeByNameOrThrow_(ss, name);
  const sh = rg.getSheet();
  return sh.getRange(startRow, rg.getColumn(), numRows, 1).getValues().map(r => r[0]);
}

function comp_getSheetFromNamedRange_(ss, name) {
  return comp_getRangeByNameOrThrow_(ss, name).getSheet();
}

function comp_getLocalCompetencesSheetOrNull_(ss) {
  try {
    return ss.getSheetByName((typeof BDD_COMPETENCES_SHEET !== 'undefined' && BDD_COMPETENCES_SHEET) ? BDD_COMPETENCES_SHEET : "Compétences")
      || ss.getSheetByName("Compétences")
      || null;
  } catch (e) {
    return null;
  }
}

function comp_getBddCompetencesSheetOrNull_() {
  try {
    if (typeof BDD_POLARIS_ID === 'undefined' || !BDD_POLARIS_ID) return null;
    const bdd = SpreadsheetApp.openById(BDD_POLARIS_ID);
    const sheetName = (typeof BDD_COMPETENCES_SHEET !== 'undefined' && BDD_COMPETENCES_SHEET) ? BDD_COMPETENCES_SHEET : "Compétences";
    return bdd.getSheetByName(sheetName) || bdd.getSheetByName("Compétences") || null;
  } catch (e) {
    return null;
  }
}

function comp_getSourceCompetencesSheetOrThrow_(ss) {
  const local = comp_getLocalCompetencesSheetOrNull_(ss);
  if (local) return local;

  const bdd = comp_getBddCompetencesSheetOrNull_();
  if (bdd) return bdd;

  throw new Error('Source compétences introuvable (ni onglet local, ni BDD Polaris)');
}

function comp_readSourceCompetencesRows_(ss) {
  const namedLocalReady = [
    COMP_NR.CompetencesCAT,
    COMP_NR.CompetencesNom,
    COMP_NR.CompetencesSousNom,
    COMP_NR.CompetencesPrerequis,
    COMP_NR.CompetencesDescription
  ].every(name => comp_hasNamedRange_(ss, name));

  if (namedLocalReady) {
    const sheetComp = comp_getSheetFromNamedRange_(ss, COMP_NR.CompetencesCAT);
    const lastRowComp = sheetComp.getLastRow();
    const srcCat  = comp_getNamedColumnValues_(ss, COMP_NR.CompetencesCAT, 1, lastRowComp);
    const srcNom  = comp_getNamedColumnValues_(ss, COMP_NR.CompetencesNom, 1, lastRowComp);
    const srcSous = comp_getNamedColumnValues_(ss, COMP_NR.CompetencesSousNom, 1, lastRowComp);
    const srcMods = comp_hasNamedRange_(ss, COMP_NR.CompetencesMods)
      ? comp_getNamedColumnValues_(ss, COMP_NR.CompetencesMods, 1, lastRowComp)
      : Array.from({ length: lastRowComp }, () => "");
    const srcAttr = comp_hasNamedRange_(ss, COMP_NR.CompetencesAttributs)
      ? comp_getNamedColumnValues_(ss, COMP_NR.CompetencesAttributs, 1, lastRowComp)
      : Array.from({ length: lastRowComp }, () => "");
    const srcPre  = comp_getNamedColumnValues_(ss, COMP_NR.CompetencesPrerequis, 1, lastRowComp);
    const srcDesc = comp_getNamedColumnValues_(ss, COMP_NR.CompetencesDescription, 1, lastRowComp);

    const rows = [];
    for (let i = 0; i < lastRowComp; i++) {
      rows.push([srcCat[i] || "", srcNom[i] || "", srcSous[i] || "", srcMods[i] || "", srcAttr[i] || "", srcPre[i] || "", srcDesc[i] || ""]);
    }
    return rows;
  }

  const sheetComp = comp_getSourceCompetencesSheetOrThrow_(ss);
  const lastRowComp = sheetComp.getLastRow();
  if (lastRowComp <= 0) return [];
  return sheetComp.getRange(1, 1, lastRowComp, 7).getValues();
}

function comp_norm_(s) {
  if (s === undefined || s === null) return "";
  return s.toString().trim().replace(/_+$/, "").trim();
}

function comp_coalesceSkillAttributs_(persoAttr, sourceAttr) {
  const p = String(persoAttr || "").trim();
  const s = String(sourceAttr || "").trim();
  return p || s;
}

function comp_parseAttributeLabel_(header, fallback) {
  const raw = String(header || "").trim();
  if (!raw) return fallback || "";
  const parts = raw.split(/\s+/).filter(Boolean);
  return (parts[1] || parts[0] || fallback || "").toString();
}

function comp_readAttributeLabelNamed_(ss, def, shFallback) {
  const explicit = comp_getRangeByNameOrNull_(ss, def.labelName);
  if (explicit) return comp_parseAttributeLabel_(explicit.getDisplayValue(), def.key);
  return comp_parseAttributeLabel_(shFallback.getRange(3, def.fallbackCol).getDisplayValue(), def.key);
}

function comp_getDescriptionTargetRangeNamed_(ss) {
  const explicit = comp_getRangeByNameOrNull_(ss, COMP_NR.CompDescription);
  if (explicit) return explicit;

  const cat = comp_getRangeByNameOrThrow_(ss, COMP_NR.CompCategories);
  return cat.getSheet().getRange(
    cat.getRow(),
    Math.max(1, cat.getColumn() - 1),
    cat.getNumRows(),
    1
  );
}

// ------------------------------------------------------------
// API publique — dispatch compat
// ------------------------------------------------------------

function getPoints(fid) {
  const ss = openFiche_(fid);
  return comp_safeReadDispatch_(
    ss,
    () => comp_getPointsNamed_(ss),
    () => comp_getPointsLegacy_(ss),
    res => !!res && typeof res === "object" && "available" in res && "usedTotal" in res
  );
}

function getAttributs(fid) {
  const ss = openFiche_(fid);
  return comp_safeReadDispatch_(
    ss,
    () => comp_getAttributsNamed_(ss),
    () => comp_getAttributsLegacy_(ss),
    res => !!res && typeof res === "object" && Object.keys(res).length > 0
  );
}

function updateAttributes_(ctx, attrObj) {
  const ss = comp_getSpreadsheetFromAny_(ctx);
  return comp_getMode_(ss) === "named"
    ? comp_updateAttributesNamed_(ss, attrObj)
    : comp_updateAttributesLegacy_(ss.getSheetByName("Personnage"), attrObj);
}

function getAvantages(fid) {
  const ss = openFiche_(fid);
  return comp_safeReadDispatch_(
    ss,
    () => comp_getAvantagesNamed_(ss),
    () => comp_getAvantagesLegacy_(ss),
    res => Array.isArray(res)
  );
}

function getCompetencesAvecValeurs(fid) {
  const ss = openFiche_(fid);
  return comp_safeReadDispatch_(
    ss,
    () => comp_getCompetencesAvecValeursNamed_(ss),
    () => comp_getCompetencesAvecValeursLegacy_(ss),
    res => !!res && Array.isArray(res.categories) && res.categories.length > 0
  );
}

function updatePersonnageAvecExport_(ss, exportData) {
  return comp_getMode_(ss) === "named"
    ? comp_updatePersonnageAvecExportNamed_(ss, exportData)
    : comp_updatePersonnageAvecExportLegacy_(ss, exportData);
}

function majTooltipsCompetences_(ss) {
  return comp_getMode_(ss) === "named"
    ? comp_majTooltipsCompetencesNamed_(ss)
    : comp_majTooltipsCompetencesLegacy_(ss);
}

function majTooltipsCompetences(fid) {
  const ss = openFiche_(fid);
  majTooltipsCompetences_(ss);
  return true;
}

function applyAll(fid, exportData, attrObj, sessionUsed) {
  const ss = openFiche_(fid);
  return comp_getMode_(ss) === "named"
    ? comp_applyAllNamed_(ss, exportData, attrObj, sessionUsed)
    : comp_applyAllLegacy_(ss, exportData, attrObj, sessionUsed);
}

// ------------------------------------------------------------
// Named Ranges mode
// ------------------------------------------------------------

function comp_getPointsNamed_(ss) {
  const pointsADistribuer = Number(comp_getRangeByNameOrThrow_(ss, COMP_NR.XPDispo).getValue() || 0);
  const pointsUtilises = Number(comp_getRangeByNameOrThrow_(ss, COMP_NR.XPUtilises).getValue() || 0);
  return { available: pointsADistribuer, usedTotal: pointsUtilises };
}

function comp_getAttributsNamed_(ss) {
  const sh = comp_getSheetFromNamedRange_(ss, ATTR_NR[0].valueName);
  const res = {};

  ATTR_NR.forEach(def => {
    const label = comp_readAttributeLabelNamed_(ss, def, sh);
    const lvl = Number(comp_getRangeByNameOrThrow_(ss, def.valueName).getValue() || 0);
    res[label] = lvl;
  });

  return res;
}

function comp_updateAttributesNamed_(ss, attrObj) {
  if (!attrObj || typeof attrObj !== "object") return;

  const sh = comp_getSheetFromNamedRange_(ss, ATTR_NR[0].valueName);

  ATTR_NR.forEach(def => {
    const label = comp_readAttributeLabelNamed_(ss, def, sh);
    if (Object.prototype.hasOwnProperty.call(attrObj, label)) {
      comp_getRangeByNameOrThrow_(ss, def.valueName).setValue(attrObj[label]);
    }
  });
}

function comp_getAvantagesNamed_(ss) {
  const rg = comp_getRangeByNameOrNull_(ss, COMP_NR.Avantages);
  if (!rg) return [];

  return rg.getDisplayValues()
    .flat()
    .map(v => String(v || "").trim())
    .filter(Boolean);
}

function comp_getCompetencesAvecValeursNamed_(ss) {
  const sheetPerso = comp_getSheetFromNamedRange_(ss, COMP_NR.CompCategories);
  if (!sheetPerso) throw new Error("Onglet Personnage introuvable");

  const dataComp = comp_readSourceCompetencesRows_(ss);

  const rgCat = comp_getRangeByNameOrThrow_(ss, COMP_NR.CompCategories);
  const rowsPerso = rgCat.getNumRows();

  const persoCat  = comp_getNamedColumnValues_(ss, COMP_NR.CompCategories, rgCat.getRow(), rowsPerso);
  const persoNom  = comp_getNamedColumnValues_(ss, COMP_NR.CompNom, rgCat.getRow(), rowsPerso);
  const persoSous = comp_getNamedColumnValues_(ss, COMP_NR.CompSousNom, rgCat.getRow(), rowsPerso);
  const persoVal  = comp_getNamedColumnValues_(ss, COMP_NR.CompMaitrise, rgCat.getRow(), rowsPerso);
  const persoAttr = comp_hasNamedRange_(ss, COMP_NR.CompAttributs)
    ? comp_getNamedColumnValues_(ss, COMP_NR.CompAttributs, rgCat.getRow(), rowsPerso)
    : Array.from({ length: rowsPerso }, () => "");

  const persoMap = {};
  const persoAttrMap = {};
  let currentCat = "";
  let currentSkill = "";

  for (let i = 0; i < rowsPerso; i++) {
    const colB = persoCat[i] ? persoCat[i].toString().trim() : "";
    const colC = persoNom[i] ? persoNom[i].toString().trim() : "";
    const colD = persoSous[i] ? persoSous[i].toString().trim() : "";
    const valueR = persoVal[i] !== undefined ? persoVal[i] : "";

    if (colB && /_$/.test(colB)) currentCat = comp_norm_(colB);
    else if (colB) currentCat = comp_norm_(colB);

    if (colC) currentSkill = comp_norm_(colC);
    const subName = comp_norm_(colD || "");

    const key = `${currentCat}||${currentSkill}||${subName}`;
    persoMap[key] = valueR;
    persoAttrMap[key] = persoAttr[i] !== undefined ? persoAttr[i] : "";
  }

  const categories = {};
  dataComp.forEach(row => {
    const catNameRaw = row[0] || "(Sans catégorie)";
    const skillNameRaw = row[1] || "";
    const subNameRaw = row[2] || "";
    const attributs = row[4] || "";
    const prerequis = row[5] || "";
    const description = row[6] || "";

    const catName = comp_norm_(catNameRaw);
    const skillName = comp_norm_(skillNameRaw);
    const subName = comp_norm_(subNameRaw);

    if (!categories[catName]) categories[catName] = { name: catNameRaw || catName, skills: [] };

    const keyMain = `${catName}||${skillName}||`;
    const keySub = `${catName}||${skillName}||${subName}`;

    const skillValue = Object.prototype.hasOwnProperty.call(persoMap, keyMain) ? persoMap[keyMain] : "";
    const subValue = Object.prototype.hasOwnProperty.call(persoMap, keySub) ? persoMap[keySub] : "";
    const skillAttributs = comp_coalesceSkillAttributs_(persoAttrMap[keyMain], attributs);
    const subAttributs = comp_coalesceSkillAttributs_(persoAttrMap[keySub], attributs);

    let skillObj = categories[catName].skills.find(s => s.name === skillNameRaw);
    if (!skillObj) {
      skillObj = { name: skillNameRaw, value: skillValue, subs: [], attributs: skillAttributs, prerequis, description };
      categories[catName].skills.push(skillObj);
    } else if (!subName) {
      skillObj.value = skillValue;
      skillObj.attributs = skillAttributs;
      skillObj.prerequis = prerequis;
      skillObj.description = description;
    }

    if (subName) {
      skillObj.subs.push({ name: subNameRaw, value: subValue, attributs: subAttributs, prerequis, description });
    }
  });

  return { categories: Object.values(categories) };
}

function comp_updatePersonnageAvecExportNamed_(ss, exportData) {
  const sheetPerso = comp_getSheetFromNamedRange_(ss, COMP_NR.CompCategories);
  const sheetComp = comp_getSheetFromNamedRange_(ss, COMP_NR.CompetencesCAT);
  if (!sheetPerso || !sheetComp) throw new Error("Onglet Personnage/Compétences introuvable");

  const lastRowComp = sheetComp.getLastRow();
  const noms = comp_getNamedColumnValues_(ss, COMP_NR.CompetencesNom, 1, lastRowComp);
  const sousNoms = comp_getNamedColumnValues_(ss, COMP_NR.CompetencesSousNom, 1, lastRowComp);
  const indicateurs = comp_getNamedColumnValues_(ss, COMP_NR.CompetencesMods, 1, lastRowComp);

  const indicateursX = {};
  for (let i = 0; i < lastRowComp; i++) {
    const nom = String(noms[i] || "").trim();
    const sousNom = String(sousNoms[i] || "").trim();
    const indicateur = String(indicateurs[i] || "").trim();
    if (nom) indicateursX[nom] = (indicateur === "(X)");
    if (sousNom) indicateursX[sousNom] = (indicateur === "(X)");
  }

  const rgCat = comp_getRangeByNameOrThrow_(ss, COMP_NR.CompCategories);
  const rgR = comp_getRangeByNameOrThrow_(ss, COMP_NR.CompMaitrise);
  const rows = rgCat.getNumRows();

  const rgBK = comp_buildContiguousRangeFromAnchor_(rgCat, 10); // B:K
  rgBK.clearContent();
  rgR.clearContent();

  const gridBK = Array.from({ length: rows }, () => Array(10).fill(""));
  const colR = Array.from({ length: rows }, () => [""]);

  let lineIndex = 0;

  (exportData || []).forEach(cat => {
    if (lineIndex >= rows) return;

    const skillsSource = cat.skills || [];

    const skillsPrepared = skillsSource.map(skill => {
      const lvl = Number(skill.level || 0);
      const disabled = !!skill.disabled;
      const isX = !!indicateursX[skill.name];
      const mBlocked = !!skill.mBlocked;

      const hasSubs = Array.isArray(skill.subs) && skill.subs.length > 0;

      const subsToWrite = (hasSubs ? (skill.subs || []).filter(sub => {
        const subLvl = Number(sub.level || 0);
        const subDisabled = !!sub.disabled;
        const subIsX = !!indicateursX[sub.name];
        const subMBlocked = !!sub.mBlocked;

        if (subMBlocked) return false;
        if (!subDisabled || subLvl > 0) {
          if (!(subIsX && subLvl <= 0)) return true;
        }
        return false;
      }) : []);

      let shouldWriteParent = (!disabled || lvl > 0) && !(isX && lvl <= 0);
      if (mBlocked) shouldWriteParent = false;

      return {
        name: skill.name,
        level: lvl,
        hasSubs,
        subsToWrite,
        shouldWriteParent,
        writeAny: shouldWriteParent || subsToWrite.length > 0
      };
    }).filter(skill => skill.writeAny);

    if (!skillsPrepared.length) return;

    if (cat.name && lineIndex < rows) {
      gridBK[lineIndex][0] = cat.name; // B
      lineIndex++;
    }

    skillsPrepared.forEach(skill => {
      if (lineIndex >= rows) return;

      if (!skill.shouldWriteParent && skill.subsToWrite.length > 0) {
        if (lineIndex < rows) {
          gridBK[lineIndex][1] = skill.name; // C
          lineIndex++;
        }
      } else if (skill.shouldWriteParent) {
        if (lineIndex < rows) {
          gridBK[lineIndex][1] = skill.name; // C
          if (!skill.hasSubs) colR[lineIndex][0] = skill.level; // R
          lineIndex++;
        }
      }

      if (skill.subsToWrite.length > 0) {
        skill.subsToWrite.forEach(sub => {
          if (lineIndex >= rows) return;
          const subLvl = Number(sub.level || 0);
          gridBK[lineIndex][2] = sub.name; // D
          colR[lineIndex][0] = subLvl;     // R
          lineIndex++;
        });
      }
    });
  });

  rgBK.setValues(gridBK);
  rgR.setValues(colR);

  comp_applyEffectiveBgFromCompTotalToBRNamed_(ss);
}

function comp_applyEffectiveBgFromCompTotalToBRNamed_(ss) {
  const rgTotal = comp_getRangeByNameOrThrow_(ss, COMP_NR.CompTotal);
  const rgCat = comp_getRangeByNameOrThrow_(ss, COMP_NR.CompCategories);

  const sh = rgTotal.getSheet();
  const rows = rgTotal.getNumRows();
  const startRow = rgTotal.getRow();
  const startCol = rgCat.getColumn(); // B
  const numCols = 17;                 // B:R

  const ssId = ss.getId();
  const rangeT = `${sh.getName()}!${rgTotal.getA1Notation()}`;

  const resp = Sheets.Spreadsheets.get(ssId, {
    ranges: [rangeT],
    fields: "sheets(data(rowData(values(effectiveFormat(backgroundColor,backgroundColorStyle)))))"
  });

  const rowData = ((((resp || {}).sheets || [])[0] || {}).data || [])[0]?.rowData || [];

  const bgBR = Array.from({ length: rows }, (_, i) => {
    const eff = rowData[i]?.values?.[0]?.effectiveFormat || {};
    const hex = comp_effectiveBgToHex_(eff) || "#ffffff";
    return Array(numCols).fill(hex);
  });

  sh.getRange(startRow, startCol, rows, numCols).setBackgrounds(bgBR);
}

function comp_effectiveBgToHex_(eff) {
  const c = eff.backgroundColor || eff.backgroundColorStyle?.rgbColor;
  if (!c) return null;

  const r = Math.round(255 * (c.red ?? 0));
  const g = Math.round(255 * (c.green ?? 0));
  const b = Math.round(255 * (c.blue ?? 0));

  return comp_rgbToHex_(r, g, b);
}

function comp_rgbToHex_(r, g, b) {
  const to2 = (n) => {
    const x = Math.max(0, Math.min(255, Number(n) || 0));
    return x.toString(16).padStart(2, "0");
  };
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

function comp_majTooltipsCompetencesNamed_(ss) {
  const rgDescTarget = comp_getDescriptionTargetRangeNamed_(ss);
  const rgNom = comp_getRangeByNameOrThrow_(ss, COMP_NR.CompNom);
  const rgSous = comp_getRangeByNameOrThrow_(ss, COMP_NR.CompSousNom);

  const sheetComp = comp_getSheetFromNamedRange_(ss, COMP_NR.CompetencesCAT);
  const lastRowComp = sheetComp.getLastRow();

  const srcNom = comp_getNamedColumnValues_(ss, COMP_NR.CompetencesNom, 1, lastRowComp);
  const srcSous = comp_getNamedColumnValues_(ss, COMP_NR.CompetencesSousNom, 1, lastRowComp);
  const srcDesc = comp_getNamedColumnValues_(ss, COMP_NR.CompetencesDescription, 1, lastRowComp);

  const descMap = new Map();
  for (let i = 0; i < lastRowComp; i++) {
    const nom = String(srcNom[i] || "").trim();
    const sousnom = String(srcSous[i] || "").trim();
    const desc = srcDesc[i] ? String(srcDesc[i]).trim() : "";
    const key = sousnom || nom;
    if (desc) descMap.set(key, desc);
  }

  const rows = rgNom.getNumRows();
  const nomVals = rgNom.getDisplayValues();
  const sousVals = rgSous.getDisplayValues();

  for (let i = 0; i < rows; i++) {
    const rowTarget = rgDescTarget.getCell(i + 1, 1);
    const nom = nomVals[i][0] ? String(nomVals[i][0]).trim() : "";
    const sousnom = sousVals[i][0] ? String(sousVals[i][0]).trim() : "";

    rowTarget.setValue("");
    rowTarget.setComment("");

    const key = sousnom || nom;
    if (descMap.has(key)) {
      rowTarget.setValue("🛈");
      rowTarget.setComment(descMap.get(key));
    }
  }
}

function comp_applyAllNamed_(ss, exportData, attrObj, sessionUsed) {
  const usedRange = comp_getRangeByNameOrThrow_(ss, COMP_NR.XPUtilises);
  const dispoRange = comp_getRangeByNameOrThrow_(ss, COMP_NR.XPDispo);

  sessionUsed = Number(sessionUsed) || 0;

  usedRange.setValue(Number(usedRange.getValue() || 0) + sessionUsed);
  dispoRange.setValue(Math.max(0, Number(dispoRange.getValue() || 0) - sessionUsed));

  comp_updatePersonnageAvecExportNamed_(ss, exportData);
  comp_updateAttributesNamed_(ss, attrObj);
  comp_majTooltipsCompetencesNamed_(ss);

  return { newUsedTotal: Number(usedRange.getValue() || 0) };
}

// ------------------------------------------------------------
// Legacy A1 mode — REGROUPE ICI pour suppression facile
// ------------------------------------------------------------

function comp_getPointsLegacy_(ss) {
  const sh = ss.getSheetByName("Personnage");
  if (!sh) throw new Error('Onglet "Personnage" introuvable');

  const pointsADistribuer = Number(sh.getRange("U15").getValue() || 0);
  const pointsUtilises = Number(sh.getRange("Q15").getValue() || 0);
  return { available: pointsADistribuer, usedTotal: pointsUtilises };
}

function comp_getAttributsLegacy_(ss) {
  const sh = ss.getSheetByName("Personnage");
  if (!sh) throw new Error('Onglet "Personnage" introuvable');

  const attrCols = [31, 34, 37, 40, 43, 46, 49, 52]; // AE, AH, AK, AN, AQ, AT, AW, AZ
  const res = {};
  attrCols.forEach(col => {
    const header = sh.getRange(3, col).getDisplayValue() || "";
    const name = (header.split(/\s+/)[1] || header || ("ATTR" + col)).toString();
    const lvl = Number(sh.getRange(7, col).getValue() || 0);
    res[name] = lvl;
  });
  return res;
}

function comp_updateAttributesLegacy_(sh, attrObj) {
  if (!sh) throw new Error('Onglet "Personnage" introuvable');

  const attrCols = [31, 34, 37, 40, 43, 46, 49, 52];
  attrCols.forEach(col => {
    const header = sh.getRange(3, col).getDisplayValue() || "";
    const name = (header.split(/\s+/)[1] || header || ("ATTR" + col)).toString();
    if (attrObj && attrObj[name] !== undefined) {
      sh.getRange(7, col).setValue(attrObj[name]);
    }
  });
}

function comp_getAvantagesLegacy_(ss) {
  const rg = ss.getRangeByName("Avantages");
  if (!rg) return [];

  return rg.getDisplayValues()
    .flat()
    .map(v => String(v || "").trim())
    .filter(Boolean);
}

function comp_getCompetencesAvecValeursLegacy_(ss) {
  const sheetPerso = ss.getSheetByName("Personnage");
  if (!sheetPerso) throw new Error("Onglet Personnage introuvable");

  const dataComp = comp_readSourceCompetencesRows_(ss);
  const rangePerso = sheetPerso.getRange("B39:R1224").getValues(); // B à R

  const persoMap = {};
  const persoAttrMap = {};
  let currentCat = "", currentSkill = "";

  rangePerso.forEach(row => {
    const colB = row[0] ? row[0].toString().trim() : "";
    const colC = row[1] ? row[1].toString().trim() : "";
    const colD = row[2] ? row[2].toString().trim() : "";
    const valueR = row[16] !== undefined ? row[16] : ""; // R
    const valueM = row[11] !== undefined ? row[11] : ""; // M / attributs

    if (colB && /_$/.test(colB)) currentCat = comp_norm_(colB);
    else if (colB) currentCat = comp_norm_(colB);

    if (colC) currentSkill = comp_norm_(colC);
    const subName = comp_norm_(colD || "");

    const key = `${currentCat}||${currentSkill}||${subName}`;
    persoMap[key] = valueR;
    persoAttrMap[key] = valueM;
  });

  const categories = {};
  dataComp.forEach(row => {
    const catNameRaw = row[0] || "(Sans catégorie)";
    const skillNameRaw = row[1] || "";
    const subNameRaw = row[2] || "";
    const attributs = row[4] || "";
    const prerequis = row[5] || "";
    const description = row[6] || "";

    const catName = comp_norm_(catNameRaw);
    const skillName = comp_norm_(skillNameRaw);
    const subName = comp_norm_(subNameRaw);

    if (!categories[catName]) categories[catName] = { name: catNameRaw || catName, skills: [] };

    const keyMain = `${catName}||${skillName}||`;
    const keySub = `${catName}||${skillName}||${subName}`;

    const skillValue = Object.prototype.hasOwnProperty.call(persoMap, keyMain) ? persoMap[keyMain] : "";
    const subValue = Object.prototype.hasOwnProperty.call(persoMap, keySub) ? persoMap[keySub] : "";
    const skillAttributs = comp_coalesceSkillAttributs_(persoAttrMap[keyMain], attributs);
    const subAttributs = comp_coalesceSkillAttributs_(persoAttrMap[keySub], attributs);

    let skillObj = categories[catName].skills.find(s => s.name === skillNameRaw);
    if (!skillObj) {
      skillObj = { name: skillNameRaw, value: skillValue, subs: [], attributs: skillAttributs, prerequis, description };
      categories[catName].skills.push(skillObj);
    } else if (!subName) {
      skillObj.value = skillValue;
      skillObj.attributs = skillAttributs;
      skillObj.prerequis = prerequis;
      skillObj.description = description;
    }

    if (subName) {
      skillObj.subs.push({ name: subNameRaw, value: subValue, attributs: subAttributs, prerequis, description });
    }
  });

  return { categories: Object.values(categories) };
}

function comp_updatePersonnageAvecExportLegacy_(ss, exportData) {
  const sheetPerso = ss.getSheetByName("Personnage");
  const sheetComp = ss.getSheetByName("Compétences");
  if (!sheetPerso || !sheetComp) throw new Error("Onglet Personnage/Compétences introuvable");

  const dataComp = comp_readSourceCompetencesRows_(ss).map(r => [r[0], r[1], r[2], r[3]]);
  const indicateursX = {};
  dataComp.forEach(r => {
    const nom = (r[1] || "").toString().trim();
    const sousNom = (r[2] || "").toString().trim();
    const indicateur = (r[3] || "").toString().trim();
    if (nom) indicateursX[nom] = (indicateur === "(X)");
    if (sousNom) indicateursX[sousNom] = (indicateur === "(X)");
  });

  const START = 39, END = 147;
  const ROWS = END - START + 1;

  sheetPerso.getRange("B39:K147").clearContent();
  sheetPerso.getRange("R39:R147").clearContent();

  const gridBK = Array.from({ length: ROWS }, () => Array(10).fill(""));
  const colR  = Array.from({ length: ROWS }, () => [""]);

  let ligne = START;

  (exportData || []).forEach(cat => {
    if (ligne > END) return;

    const skillsSource = (cat.skills || []);

    const skillsPrepared = skillsSource.map(skill => {
      const lvl = Number(skill.level || 0);
      const disabled = !!skill.disabled;
      const isX = !!indicateursX[skill.name];
      const mBlocked = !!skill.mBlocked;

      const hasSubs = skill.subs && skill.subs.length > 0;

      const subsToWrite = (hasSubs ? (skill.subs || []).filter(sub => {
        const subLvl = Number(sub.level || 0);
        const subDisabled = !!sub.disabled;
        const subIsX = !!indicateursX[sub.name];
        const subMBlocked = !!sub.mBlocked;

        if (subMBlocked) return false;
        if (!subDisabled || subLvl > 0) {
          if (!(subIsX && subLvl <= 0)) return true;
        }
        return false;
      }) : []);

      let shouldWriteParent = (!disabled || lvl > 0) && !(isX && lvl <= 0);
      if (mBlocked) shouldWriteParent = false;

      return {
        name: skill.name,
        level: lvl,
        hasSubs,
        subsToWrite,
        shouldWriteParent,
        writeAny: shouldWriteParent || subsToWrite.length > 0
      };
    }).filter(skill => skill.writeAny);

    if (!skillsPrepared.length) return;

    if (cat.name) {
      gridBK[ligne - START][0] = cat.name;
      ligne++;
    }

    skillsPrepared.forEach(skill => {
      if (ligne > END) return;

      if (!skill.shouldWriteParent && skill.subsToWrite.length > 0) {
        if (ligne <= END) {
          gridBK[ligne - START][1] = skill.name;
          ligne++;
        }
      } else if (skill.shouldWriteParent) {
        if (ligne <= END) {
          gridBK[ligne - START][1] = skill.name;
          if (!skill.hasSubs) colR[ligne - START][0] = skill.level;
          ligne++;
        }
      }

      if (skill.subsToWrite.length > 0) {
        skill.subsToWrite.forEach(sub => {
          if (ligne > END) return;
          const subLvl = Number(sub.level || 0);
          gridBK[ligne - START][2] = sub.name;
          colR[ligne - START][0] = subLvl;
          ligne++;
        });
      }
    });
  });

  sheetPerso.getRange("B39:K147").setValues(gridBK);
  sheetPerso.getRange("R39:R147").setValues(colR);

  comp_applyEffectiveBgLegacy_(ss, sheetPerso, START, END);
}

function comp_applyEffectiveBgLegacy_(ss, sh, startRow, endRow) {
  const rows = endRow - startRow + 1;
  const sheetName = sh.getName();
  const ssId = ss.getId();

  const rangeT = `${sheetName}!T${startRow}:T${endRow}`;

  const resp = Sheets.Spreadsheets.get(ssId, {
    ranges: [rangeT],
    fields: "sheets(data(rowData(values(effectiveFormat(backgroundColor,backgroundColorStyle)))))"
  });

  const rowData = ((((resp || {}).sheets || [])[0] || {}).data || [])[0]?.rowData || [];

  const bgBR = Array.from({ length: rows }, (_, i) => {
    const eff = rowData[i]?.values?.[0]?.effectiveFormat || {};
    const hex = comp_effectiveBgToHex_(eff) || "#ffffff";
    return Array(17).fill(hex);
  });

  sh.getRange(startRow, 2, rows, 17).setBackgrounds(bgBR);
}

function comp_majTooltipsCompetencesLegacy_(ss) {
  const feuillePerso = ss.getSheetByName("Personnage");
  const feuilleComp = ss.getSheetByName("Compétences");
  if (!feuillePerso || !feuilleComp) return;

  const compData = feuilleComp.getRange("A1:G" + feuilleComp.getLastRow()).getValues()
    .filter(r => r[0] || r[1] || r[2]);

  const descMap = new Map();
  compData.forEach(r => {
    const nom = (r[1] || "").toString().trim();
    const sousnom = (r[2] || "").toString().trim();
    const desc = r[6] ? r[6].toString().trim() : "";
    const key = sousnom || nom;
    if (desc) descMap.set(key, desc);
  });

  const lastRow = feuillePerso.getLastRow();
  const persData = feuillePerso.getRange("B39:D" + lastRow).getValues();

  for (let i = 0; i < persData.length; i++) {
    const nom = persData[i][1] ? persData[i][1].toString().trim() : "";
    const sousnom = persData[i][2] ? persData[i][2].toString().trim() : "";

    feuillePerso.getRange(i + 39, 1).setValue("");
    feuillePerso.getRange(i + 39, 1).setComment("");

    const key = sousnom || nom;
    if (descMap.has(key)) {
      feuillePerso.getRange(i + 39, 1).setValue("🛈");
      feuillePerso.getRange(i + 39, 1).setComment(descMap.get(key));
    }
  }
}

function comp_applyAllLegacy_(ss, exportData, attrObj, sessionUsed) {
  const sh = ss.getSheetByName("Personnage");
  if (!sh) throw new Error('Onglet "Personnage" introuvable');

  sessionUsed = Number(sessionUsed) || 0;

  const qRange = sh.getRange("Q15");
  qRange.setValue(Number(qRange.getValue() || 0) + sessionUsed);

  const uRange = sh.getRange("U15");
  uRange.setValue(Math.max(0, Number(uRange.getValue() || 0) - sessionUsed));

  comp_updatePersonnageAvecExportLegacy_(ss, exportData);
  comp_updateAttributesLegacy_(sh, attrObj);
  comp_majTooltipsCompetencesLegacy_(ss);

  return { newUsedTotal: Number(qRange.getValue() || 0) };
}


function competences_debugSnapshot(fid) {
  const out = { fid: String(fid || ""), mode: null, namedReady: null, namedError: null, legacyError: null, named: null, legacy: null };
  try {
    const ss = openFiche_(fid);
    out.mode = comp_getMode_(ss);
    out.namedReady = comp_canUseNamedMode_(ss);

    try {
      const namedRes = comp_getCompetencesAvecValeursNamed_(ss);
      out.named = {
        categories: Array.isArray(namedRes && namedRes.categories) ? namedRes.categories.length : null,
        first: Array.isArray(namedRes && namedRes.categories) ? namedRes.categories.slice(0,5).map(c => c && c.name) : []
      };
    } catch (e) {
      out.namedError = e && e.message ? e.message : String(e);
    }

    try {
      const legacyRes = comp_getCompetencesAvecValeursLegacy_(ss);
      out.legacy = {
        categories: Array.isArray(legacyRes && legacyRes.categories) ? legacyRes.categories.length : null,
        first: Array.isArray(legacyRes && legacyRes.categories) ? legacyRes.categories.slice(0,5).map(c => c && c.name) : []
      };
    } catch (e) {
      out.legacyError = e && e.message ? e.message : String(e);
    }
  } catch (e) {
    out.fatal = e && e.message ? e.message : String(e);
  }
  return out;
}
