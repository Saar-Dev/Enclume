/**
 * ============================================================
 * 13_SyncBDD.gs — Sync BDD -> fiche (fid)
 * ============================================================
 */

function syncDepuisBDDPolaris(fid) {
  const fiche = openFiche_(fid);
  const bdd = SpreadsheetApp.openById(BDD_POLARIS_ID);

  const rapport = [];

  ONGLET_A_SYNCHRONISER.forEach(nomOnglet => {
    const source = bdd.getSheetByName(nomOnglet);
    if (!source) {
      rapport.push(`❌ "${nomOnglet}" introuvable dans la BDD`);
      return;
    }

    let cible = fiche.getSheetByName(nomOnglet);
    if (!cible) {
      cible = fiche.insertSheet(nomOnglet);
      rapport.push(`➕ "${nomOnglet}" créé`);
    }

    const lastRow = source.getLastRow();
    const lastCol = source.getLastColumn();
    if (lastRow === 0 || lastCol === 0) {
      rapport.push(`⚠️ "${nomOnglet}" vide (rien importé)`);
      return;
    }

    ensureSheetSize_(cible, lastRow, lastCol);

    const src = source.getRange(1, 1, lastRow, lastCol);
    const dst = cible.getRange(1, 1, lastRow, lastCol);

    dst.clearContent();
    dst.clearFormat();
    dst.clearDataValidations();

    dst.setValues(src.getValues());

    dst.setNumberFormats(src.getNumberFormats());
    dst.setBackgrounds(src.getBackgrounds());
    dst.setFontColors(src.getFontColors());
    dst.setFontFamilies(src.getFontFamilies());
    dst.setFontSizes(src.getFontSizes());
    dst.setFontWeights(src.getFontWeights());
    dst.setFontStyles(src.getFontStyles());
    dst.setHorizontalAlignments(src.getHorizontalAlignments());
    dst.setVerticalAlignments(src.getVerticalAlignments());
    dst.setWraps(src.getWraps());
    dst.setDataValidations(src.getDataValidations());

    for (let c = 1; c <= lastCol; c++) {
      cible.setColumnWidth(c, source.getColumnWidth(c));
    }

    rapport.push(`✅ "${nomOnglet}" importé : ${lastRow}×${lastCol}`);
  });

  return { ok: true, report: rapport };
}
