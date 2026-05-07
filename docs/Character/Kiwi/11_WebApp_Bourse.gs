/**
 * ============================================================
 * 11_WebApp_Bourse.gs — Bourse / Journaux financiers
 * ============================================================
 * Source de vérité :
 * - Groupe  : fichier central Bourse (BourseGroupeSolde)
 * - Perso   : plages nommées sur la fiche joueur
 *            * InvArgentPerso
 *            * InvArgentPersoCoffre
 *
 * Journaux :
 * - Central : plages BourseJournal*
 * - Local   : plages Bourses* sur chaque fiche perso
 * ============================================================
 */

const BOURSE_LOCAL_NR = Object.freeze({
  opId:             "BoursesOpId",
  dateHeure:        "BoursesDateHeure",
  typeOp:           "BoursesTypeOp",
  montantTotal:     "BoursesMontantTotal",
  deltaPersoSurSoi: "BoursesDeltaPersoSurSoi",
  deltaPersoCoffre: "BoursesDeltaPersoCoffre",
  deltaGroupe:      "BoursesDeltaGroupe",
  pocheSource:      "BoursesPocheSource",
  pocheDestination: "BoursesPocheDestination",
  marchandId:       "BoursesMarchandId",
  marchandNom:      "BoursesMarchandNom",
  objetKey:         "BoursesObjetKey",
  objetNom:         "BoursesObjetNom",
  quantite:         "BoursesQuantite",
  prixUnitaire:     "BoursesPrixUnitaire",
  prixTotal:        "BoursesPrixTotal",
  destFid:          "BoursesDestFid",
  destLabel:        "BoursesDestLabel",
  note:             "BoursesNote",
  auteur:           "BoursesAuteur",
  soldePersoAvant:  "BoursesSoldePersoAvant",
  soldePersoApres:  "BoursesSoldePersoApres",
  soldeCoffreAvant: "BoursesSoldeCoffreAvant",
  soldeCoffreApres: "BoursesSoldeCoffreApres"
});

const BOURSE_GROUP_NR = Object.freeze({
  solde:            "BourseGroupeSolde",
  opId:             "BourseJournalOpId",
  dateHeure:        "BourseJournalDateHeure",
  typeOp:           "BourseJournalTypeOp",
  montantTotal:     "BourseJournalMontantTotal",
  deltaGroupe:      "BourseJournalDeltaGroupe",
  pocheSource:      "BourseJournalPocheSource",
  pocheDestination: "BourseJournalPocheDestination",
  fidSource:        "BourseJournalFidSource",
  labelSource:      "BourseJournalLabelSource",
  fidDest:          "BourseJournalFidDest",
  labelDest:        "BourseJournalLabelDest",
  marchandId:       "BourseJournalMarchandId",
  marchandNom:      "BourseJournalMarchandNom",
  objetKey:         "BourseJournalObjetKey",
  objetNom:         "BourseJournalObjetNom",
  quantite:         "BourseJournalQuantite",
  prixUnitaire:     "BourseJournalPrixUnitaire",
  prixTotal:        "BourseJournalPrixTotal",
  note:             "BourseJournalNote",
  auteur:           "BourseJournalAuteur",
  soldeAvant:       "BourseJournalSoldeAvant",
  soldeApres:       "BourseJournalSoldeApres"
});

const BOURSE_GROUP_JOURNAL_NR = Object.freeze({
  opId:             BOURSE_GROUP_NR.opId,
  dateHeure:        BOURSE_GROUP_NR.dateHeure,
  typeOp:           BOURSE_GROUP_NR.typeOp,
  montantTotal:     BOURSE_GROUP_NR.montantTotal,
  deltaGroupe:      BOURSE_GROUP_NR.deltaGroupe,
  pocheSource:      BOURSE_GROUP_NR.pocheSource,
  pocheDestination: BOURSE_GROUP_NR.pocheDestination,
  fidSource:        BOURSE_GROUP_NR.fidSource,
  labelSource:      BOURSE_GROUP_NR.labelSource,
  fidDest:          BOURSE_GROUP_NR.fidDest,
  labelDest:        BOURSE_GROUP_NR.labelDest,
  marchandId:       BOURSE_GROUP_NR.marchandId,
  marchandNom:      BOURSE_GROUP_NR.marchandNom,
  objetKey:         BOURSE_GROUP_NR.objetKey,
  objetNom:         BOURSE_GROUP_NR.objetNom,
  quantite:         BOURSE_GROUP_NR.quantite,
  prixUnitaire:     BOURSE_GROUP_NR.prixUnitaire,
  prixTotal:        BOURSE_GROUP_NR.prixTotal,
  note:             BOURSE_GROUP_NR.note,
  auteur:           BOURSE_GROUP_NR.auteur,
  soldeAvant:       BOURSE_GROUP_NR.soldeAvant,
  soldeApres:       BOURSE_GROUP_NR.soldeApres
});

const BOURSE_MONEY_NR = Object.freeze({
  perso:  "InvArgentPerso",
  coffre: "InvArgentPersoCoffre",
  groupe: "InvArgentGroupe"
});

const BOURSE_POCKET = Object.freeze({
  GROUPE: "GROUPE",
  PERSO_SUR_SOI: "PERSO_SUR_SOI",
  PERSO_COFFRE: "PERSO_COFFRE",
  MIXTE: "MIXTE"
});

function bourse_openGroupSpreadsheet_() {
  if (typeof BOURSE_SHEET_URL === "undefined" || !String(BOURSE_SHEET_URL || "").trim()) {
    throw new Error("BOURSE_SHEET_URL manquant dans la configuration.");
  }
  return SpreadsheetApp.openByUrl(BOURSE_SHEET_URL);
}

function bourse_groupSheetName_() {
  return (typeof SHEET_NAME !== "undefined" && String(SHEET_NAME || "").trim()) ? String(SHEET_NAME).trim() : "";
}

function bourse_num_(v) {
  if (v === "" || v === null || v === undefined) return 0;
  const s = String(v).trim().replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function bourse_round2_(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

function bourse_safeString_(v) {
  return String(v == null ? "" : v).trim();
}

function bourse_getNamedRangeOrThrow_(ss, rangeName) {
  const rg = ss.getRangeByName(String(rangeName || "").trim());
  if (!rg) throw new Error("Plage nommée introuvable : " + rangeName);
  if (rg.getNumColumns() !== 1) throw new Error('La plage nommée "' + rangeName + '" doit faire une seule colonne.');
  return rg;
}

function bourse_getNamedRangeOptional_(ss, rangeName) {
  try {
    const rg = ss.getRangeByName(String(rangeName || "").trim());
    if (!rg || rg.getNumColumns() !== 1) return null;
    return rg;
  } catch (_) {
    return null;
  }
}

function bourse_getJournalContext_(ss, map) {
  const keys = Object.keys(map || {});
  if (!keys.length) throw new Error("Aucune plage de journal définie.");

  const full = {};
  keys.forEach(k => { full[k] = bourse_getNamedRangeOrThrow_(ss, map[k]); });

  const first = full[keys[0]];
  const sh = first.getSheet();
  const row = first.getRow();
  const numRows = first.getNumRows();

  keys.forEach(k => {
    const rg = full[k];
    if (rg.getSheet().getSheetId() !== sh.getSheetId()) {
      throw new Error("Toutes les plages de journal doivent être sur la même feuille (" + map[k] + ").");
    }
    if (rg.getRow() !== row) {
      throw new Error("Toutes les plages de journal doivent commencer sur la même ligne (" + map[k] + ").");
    }
    if (rg.getNumRows() !== numRows) {
      throw new Error("Toutes les plages de journal doivent avoir la même hauteur (" + map[k] + ").");
    }
  });

  if (numRows < 2) throw new Error("Le journal doit contenir au moins une ligne d'en-tête et une ligne de données.");

  const data = {};
  keys.forEach(k => { data[k] = full[k].offset(1, 0, numRows - 1, 1); });

  return { sheet: sh, full, data, dataNumRows: numRows - 1 };
}

function bourse_findAppendIndex_(ctx, keyName) {
  const rg = ctx.data[keyName];
  if (!rg) throw new Error("Plage de recherche introuvable : " + keyName);
  const vals = rg.getValues();
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i][0];
    if (v === "" || v === null || v === undefined) return i;
  }
  throw new Error("Aucune ligne libre disponible dans le journal.");
}

function bourse_appendJournalEntry_(ss, map, entry) {
  const ctx = bourse_getJournalContext_(ss, map);
  const idx = bourse_findAppendIndex_(ctx, "opId");
  Object.keys(map).forEach(k => {
    const value = Object.prototype.hasOwnProperty.call(entry, k) ? entry[k] : "";
    ctx.data[k].getCell(idx + 1, 1).setValue(value);
  });
  return { rowIndex: idx, rowNumber: ctx.data.opId.getRow() + idx };
}

function bourse_getIdentitySafe_(fid) {
  const cleanFid = bourse_safeString_(fid);
  let idt = {};
  try {
    if (typeof getIdentity === "function") {
      idt = getIdentity(cleanFid) || {};
    }
  } catch (_) {}

  if (idt && typeof idt === "object") {
    const joueur = bourse_safeString_(idt.joueur || idt.player || "");
    const perso  = bourse_safeString_(idt.perso || idt.character || "");
    const label  = bourse_safeString_(idt.label || [joueur, perso].filter(Boolean).join(" — "));
    return { fid: cleanFid, joueur, perso, label: label || cleanFid };
  }

  return { fid: cleanFid, joueur: "", perso: "", label: cleanFid };
}

function bourse_guessLabelForFid_(fid) {
  const idt = bourse_getIdentitySafe_(fid);
  if (idt.label) return idt.label;
  return bourse_safeString_(fid);
}

function bourse_getPlayerMoneyCell_(ss, key) {
  const name = BOURSE_MONEY_NR[key];
  if (!name) throw new Error("Clé de bourse perso inconnue : " + key);
  return bourse_getNamedRangeOrThrow_(ss, name);
}

function bourse_getPlayerMoneyCellOptional_(ss, key) {
  const name = BOURSE_MONEY_NR[key];
  if (!name) return null;
  return bourse_getNamedRangeOptional_(ss, name);
}

function bourse_getPlayerBalances_(fid) {
  const ss = SpreadsheetApp.openById(String(fid || "").trim());
  const perso = bourse_num_(bourse_getPlayerMoneyCell_(ss, "perso").getValue());
  const coffre = bourse_num_(bourse_getPlayerMoneyCell_(ss, "coffre").getValue());
  return {
    fid: bourse_safeString_(fid),
    persoSurSoi: perso,
    persoCoffre: coffre
  };
}

function bourse_setPlayerBalances_(fid, next) {
  const ss = SpreadsheetApp.openById(String(fid || "").trim());
  if (Object.prototype.hasOwnProperty.call(next, "persoSurSoi")) {
    bourse_getPlayerMoneyCell_(ss, "perso").setValue(bourse_round2_(next.persoSurSoi));
  }
  if (Object.prototype.hasOwnProperty.call(next, "persoCoffre")) {
    bourse_getPlayerMoneyCell_(ss, "coffre").setValue(bourse_round2_(next.persoCoffre));
  }
}

function bourse_getGroupBalance_() {
  const ss = bourse_openGroupSpreadsheet_();
  const cell = bourse_getNamedRangeOrThrow_(ss, BOURSE_GROUP_NR.solde);
  return bourse_num_(cell.getValue());
}

function bourse_setGroupBalance_(value) {
  const ss = bourse_openGroupSpreadsheet_();
  const cell = bourse_getNamedRangeOrThrow_(ss, BOURSE_GROUP_NR.solde);
  cell.setValue(bourse_round2_(value));
}

function bourse_syncLocalGroupMirror_(fid, groupBalance) {
  try {
    const ss = SpreadsheetApp.openById(String(fid || "").trim());
    const cell = bourse_getPlayerMoneyCellOptional_(ss, "groupe");
    if (cell) cell.setValue(bourse_round2_(groupBalance));
  } catch (_) {}
}

function bourse_listMidPlayers_(mid, currentFid) {
  const cleanMid = bourse_safeString_(mid);
  const current = bourse_safeString_(currentFid);
  const out = [];
  const seen = Object.create(null);

  function pushOne(fid, label) {
    const cleanFid = bourse_safeString_(fid);
    if (!cleanFid || seen[cleanFid]) return;
    seen[cleanFid] = true;
    out.push({ fid: cleanFid, label: bourse_safeString_(label) || bourse_guessLabelForFid_(cleanFid) });
  }

  if (cleanMid && typeof reg_getPlayers === "function") {
    try {
      const reg = reg_getPlayers(cleanMid) || {};
      const arr = Array.isArray(reg.players) ? reg.players : [];
      arr.forEach(p => {
        const fid = p && (p.fid || p.fileId || p.spreadsheetId || p.id || "");
        const label = p && (p.label || p.name || [p.joueur || p.player || "", p.perso || p.character || ""].filter(Boolean).join(" — "));
        pushOne(fid, label);
      });
    } catch (_) {}
  }

  if (current && !seen[current]) pushOne(current, bourse_guessLabelForFid_(current));

  out.sort((a, b) => String(a.label || a.fid).localeCompare(String(b.label || b.fid), "fr", { sensitivity: "base" }));
  return out;
}

function bourse_syncGroupMirrorForMid_(mid, groupBalance) {
  const players = bourse_listMidPlayers_(mid, "");
  players.forEach(p => bourse_syncLocalGroupMirror_(p.fid, groupBalance));
}

function bourse_makeLocalJournalEntry_(payload) {
  return {
    opId:             payload.opId || "",
    dateHeure:        payload.dateHeure || new Date(),
    typeOp:           payload.typeOp || "",
    montantTotal:     bourse_round2_(payload.montantTotal || 0),
    deltaPersoSurSoi: bourse_round2_(payload.deltaPersoSurSoi || 0),
    deltaPersoCoffre: bourse_round2_(payload.deltaPersoCoffre || 0),
    deltaGroupe:      bourse_round2_(payload.deltaGroupe || 0),
    pocheSource:      payload.pocheSource || "",
    pocheDestination: payload.pocheDestination || "",
    marchandId:       payload.marchandId || "",
    marchandNom:      payload.marchandNom || "",
    objetKey:         payload.objetKey || "",
    objetNom:         payload.objetNom || "",
    quantite:         payload.quantite || "",
    prixUnitaire:     payload.prixUnitaire || "",
    prixTotal:        payload.prixTotal || "",
    destFid:          payload.destFid || "",
    destLabel:        payload.destLabel || "",
    note:             payload.note || "",
    auteur:           payload.auteur || "",
    soldePersoAvant:  payload.soldePersoAvant || 0,
    soldePersoApres:  payload.soldePersoApres || 0,
    soldeCoffreAvant: payload.soldeCoffreAvant || 0,
    soldeCoffreApres: payload.soldeCoffreApres || 0
  };
}

function bourse_makeGroupJournalEntry_(payload) {
  return {
    opId:             payload.opId || "",
    dateHeure:        payload.dateHeure || new Date(),
    typeOp:           payload.typeOp || "",
    montantTotal:     bourse_round2_(payload.montantTotal || 0),
    deltaGroupe:      bourse_round2_(payload.deltaGroupe || 0),
    pocheSource:      payload.pocheSource || "",
    pocheDestination: payload.pocheDestination || "",
    fidSource:        payload.fidSource || "",
    labelSource:      payload.labelSource || "",
    fidDest:          payload.fidDest || "",
    labelDest:        payload.labelDest || "",
    marchandId:       payload.marchandId || "",
    marchandNom:      payload.marchandNom || "",
    objetKey:         payload.objetKey || "",
    objetNom:         payload.objetNom || "",
    quantite:         payload.quantite || "",
    prixUnitaire:     payload.prixUnitaire || "",
    prixTotal:        payload.prixTotal || "",
    note:             payload.note || "",
    auteur:           payload.auteur || "",
    soldeAvant:       payload.soldeAvant || 0,
    soldeApres:       payload.soldeApres || 0
  };
}

function bourse_getRecentLocalTransactions_(fid, limit) {
  const ss = SpreadsheetApp.openById(String(fid || "").trim());
  const ctx = bourse_getJournalContext_(ss, BOURSE_LOCAL_NR);
  const lim = Math.max(1, Math.min(50, Number(limit) || 15));

  const vals = {};
  Object.keys(BOURSE_LOCAL_NR).forEach(k => { vals[k] = ctx.data[k].getValues(); });

  const items = [];
  for (let i = ctx.dataNumRows - 1; i >= 0 && items.length < lim; i--) {
    const opId = bourse_safeString_(vals.opId[i][0]);
    if (!opId) continue;
    const amount = bourse_num_(vals.montantTotal[i][0]);
    const labelPieces = [bourse_safeString_(vals.typeOp[i][0]), bourse_safeString_(vals.note[i][0])].filter(Boolean);
    items.push({
      opId,
      dateHeure: vals.dateHeure[i][0] || "",
      typeOp: bourse_safeString_(vals.typeOp[i][0]),
      amount,
      label: labelPieces.join(" — "),
      note: bourse_safeString_(vals.note[i][0]),
      deltaPersoSurSoi: bourse_num_(vals.deltaPersoSurSoi[i][0]),
      deltaPersoCoffre: bourse_num_(vals.deltaPersoCoffre[i][0]),
      deltaGroupe: bourse_num_(vals.deltaGroupe[i][0]),
      auteur: bourse_safeString_(vals.auteur[i][0]),
      destLabel: bourse_safeString_(vals.destLabel[i][0]),
      objetNom: bourse_safeString_(vals.objetNom[i][0])
    });
  }
  return { items };
}

function bourse_getRecentGroupTransactions_(limit) {
  const ss = bourse_openGroupSpreadsheet_();
  const ctx = bourse_getJournalContext_(ss, BOURSE_GROUP_JOURNAL_NR);
  const lim = Math.max(1, Math.min(50, Number(limit) || 15));

  const vals = {};
  Object.keys(BOURSE_GROUP_NR).forEach(k => {
    if (k === "solde") return;
    vals[k] = ctx.data[k].getValues();
  });

  const items = [];
  for (let i = ctx.dataNumRows - 1; i >= 0 && items.length < lim; i--) {
    const opId = bourse_safeString_(vals.opId[i][0]);
    if (!opId) continue;
    const amount = bourse_num_(vals.montantTotal[i][0]);
    const labelPieces = [bourse_safeString_(vals.typeOp[i][0]), bourse_safeString_(vals.note[i][0])].filter(Boolean);
    items.push({
      opId,
      dateHeure: vals.dateHeure[i][0] || "",
      typeOp: bourse_safeString_(vals.typeOp[i][0]),
      amount,
      label: labelPieces.join(" — "),
      note: bourse_safeString_(vals.note[i][0]),
      deltaGroupe: bourse_num_(vals.deltaGroupe[i][0]),
      auteur: bourse_safeString_(vals.auteur[i][0]),
      sourceLabel: bourse_safeString_(vals.labelSource[i][0]),
      destLabel: bourse_safeString_(vals.labelDest[i][0]),
      objetNom: bourse_safeString_(vals.objetNom[i][0]),
      marchandNom: bourse_safeString_(vals.marchandNom[i][0])
    });
  }
  return { items };
}

function bourse_compactObjectLabel_(lines) {
  const arr = Array.isArray(lines) ? lines : [];
  if (!arr.length) return { key: "", name: "", qty: "", unit: "", total: "" };
  if (arr.length === 1) {
    const l = arr[0] || {};
    return {
      key: bourse_safeString_(l.key || ""),
      name: bourse_safeString_(l.displayName || l.name || ""),
      qty: Number(l.qty || 0) || "",
      unit: bourse_round2_(Number(l.unitFinal || l.unitPrice || 0)),
      total: bourse_round2_(Number(l.total || 0))
    };
  }
  const totalQty = arr.reduce((acc, l) => acc + (Number(l && l.qty || 0) || 0), 0);
  const total = arr.reduce((acc, l) => acc + (Number(l && l.total || 0) || 0), 0);
  return {
    key: "",
    name: "Achat multiple (" + arr.length + " lignes)",
    qty: totalQty || "",
    unit: "",
    total: bourse_round2_(total)
  };
}

function bourse_validatePocket_(pocket) {
  const p = bourse_safeString_(pocket).toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(BOURSE_POCKET, p)) throw new Error("Poche invalide : " + pocket);
  return p;
}

function bourse_applyDeltaToState_(state, pocket, delta) {
  const d = bourse_round2_(delta || 0);
  if (!d) return;

  if (pocket === BOURSE_POCKET.PERSO_SUR_SOI) state.persoAfter = bourse_round2_(state.persoAfter + d);
  else if (pocket === BOURSE_POCKET.PERSO_COFFRE) state.coffreAfter = bourse_round2_(state.coffreAfter + d);
  else if (pocket === BOURSE_POCKET.GROUPE) state.groupAfter = bourse_round2_(state.groupAfter + d);
  else throw new Error("Poche non gérée : " + pocket);
}

function bourse_assertNonNegativeState_(state) {
  if (state.persoAfter < 0) throw new Error("Fonds perso sur soi insuffisants.");
  if (state.coffreAfter < 0) throw new Error("Fonds perso coffre insuffisants.");
  if (state.groupAfter < 0) throw new Error("Fonds du groupe insuffisants.");
}

function bourse_writeState_(state, syncMid) {
  bourse_setPlayerBalances_(state.fid, {
    persoSurSoi: state.persoAfter,
    persoCoffre: state.coffreAfter
  });

  if (state.groupTouched) {
    bourse_setGroupBalance_(state.groupAfter);
    bourse_syncLocalGroupMirror_(state.fid, state.groupAfter);
    if (syncMid) bourse_syncGroupMirrorForMid_(syncMid, state.groupAfter);
  }
}

function bourse_submitOperation(fid, payload) {
  const cleanFid = bourse_safeString_(fid);
  if (!cleanFid) throw new Error("FID manquant.");

  payload = payload || {};
  const typeOp = bourse_safeString_(payload.type || payload.typeOp).toLowerCase();
  const note = bourse_safeString_(payload.note || payload.intitule || "");
  const mid = bourse_safeString_(payload.mid || "");
  const idt = bourse_getIdentitySafe_(cleanFid);

  const balances = bourse_getPlayerBalances_(cleanFid);
  const groupBefore = bourse_getGroupBalance_();
  const state = {
    fid: cleanFid,
    persoBefore: balances.persoSurSoi,
    coffreBefore: balances.persoCoffre,
    groupBefore,
    persoAfter: balances.persoSurSoi,
    coffreAfter: balances.persoCoffre,
    groupAfter: groupBefore,
    groupTouched: false
  };

  let deltaPersoSurSoi = 0;
  let deltaPersoCoffre = 0;
  let deltaGroupe = 0;
  let montantTotal = 0;
  let pocheSource = "";
  let pocheDestination = "";

  if (typeOp === "gain" || typeOp === "depense") {
    const pocket = bourse_validatePocket_(payload.pocket || payload.targetPocket || payload.poche);
    const amount = Math.abs(bourse_num_(payload.amount));
    if (!(amount > 0)) throw new Error("Montant invalide.");

    const signed = typeOp === "gain" ? amount : -amount;
    montantTotal = amount;

    if (pocket === BOURSE_POCKET.PERSO_SUR_SOI) deltaPersoSurSoi = signed;
    if (pocket === BOURSE_POCKET.PERSO_COFFRE)  deltaPersoCoffre = signed;
    if (pocket === BOURSE_POCKET.GROUPE)        deltaGroupe = signed;

    pocheSource = typeOp === "depense" ? pocket : "";
    pocheDestination = typeOp === "gain" ? pocket : "";
  } else if (typeOp === "transfert") {
    const src = bourse_validatePocket_(payload.sourcePocket || payload.pocheSource);
    const dst = bourse_validatePocket_(payload.destPocket || payload.pocheDestination);
    const amount = Math.abs(bourse_num_(payload.amount));
    if (!(amount > 0)) throw new Error("Montant invalide.");
    if (src === dst) throw new Error("La poche source et la poche destination doivent être différentes.");

    montantTotal = amount;
    pocheSource = src;
    pocheDestination = dst;

    if (src === BOURSE_POCKET.PERSO_SUR_SOI) deltaPersoSurSoi -= amount;
    if (src === BOURSE_POCKET.PERSO_COFFRE)  deltaPersoCoffre -= amount;
    if (src === BOURSE_POCKET.GROUPE)        deltaGroupe -= amount;

    if (dst === BOURSE_POCKET.PERSO_SUR_SOI) deltaPersoSurSoi += amount;
    if (dst === BOURSE_POCKET.PERSO_COFFRE)  deltaPersoCoffre += amount;
    if (dst === BOURSE_POCKET.GROUPE)        deltaGroupe += amount;
  } else if (typeOp === "correction") {
    const pocket = bourse_validatePocket_(payload.pocket || payload.targetPocket || payload.poche);
    const signed = bourse_num_(payload.amount);
    if (!signed) throw new Error("Montant invalide.");
    montantTotal = Math.abs(signed);

    if (pocket === BOURSE_POCKET.PERSO_SUR_SOI) deltaPersoSurSoi = signed;
    if (pocket === BOURSE_POCKET.PERSO_COFFRE)  deltaPersoCoffre = signed;
    if (pocket === BOURSE_POCKET.GROUPE)        deltaGroupe = signed;

    if (signed > 0) pocheDestination = pocket;
    if (signed < 0) pocheSource = pocket;
  } else {
    throw new Error("Type d'opération non supporté : " + typeOp);
  }

  bourse_applyDeltaToState_(state, BOURSE_POCKET.PERSO_SUR_SOI, deltaPersoSurSoi);
  bourse_applyDeltaToState_(state, BOURSE_POCKET.PERSO_COFFRE, deltaPersoCoffre);
  bourse_applyDeltaToState_(state, BOURSE_POCKET.GROUPE, deltaGroupe);
  state.groupTouched = !!deltaGroupe;
  bourse_assertNonNegativeState_(state);

  const opId = "op_" + Utilities.getUuid().replace(/-/g, "").slice(0, 16);
  const dateHeure = new Date();
  const auteur = idt.label || cleanFid;

  bourse_writeState_(state, mid);

  const localEntry = bourse_makeLocalJournalEntry_({
    opId,
    dateHeure,
    typeOp,
    montantTotal,
    deltaPersoSurSoi,
    deltaPersoCoffre,
    deltaGroupe,
    pocheSource,
    pocheDestination,
    note,
    auteur,
    soldePersoAvant: state.persoBefore,
    soldePersoApres: state.persoAfter,
    soldeCoffreAvant: state.coffreBefore,
    soldeCoffreApres: state.coffreAfter
  });
  bourse_appendJournalEntry_(SpreadsheetApp.openById(cleanFid), BOURSE_LOCAL_NR, localEntry);

  if (deltaGroupe) {
    const groupEntry = bourse_makeGroupJournalEntry_({
      opId,
      dateHeure,
      typeOp,
      montantTotal,
      deltaGroupe,
      pocheSource,
      pocheDestination,
      fidSource: cleanFid,
      labelSource: idt.label || cleanFid,
      fidDest: cleanFid,
      labelDest: idt.label || cleanFid,
      note,
      auteur,
      soldeAvant: state.groupBefore,
      soldeApres: state.groupAfter
    });
    bourse_appendJournalEntry_(bourse_openGroupSpreadsheet_(), BOURSE_GROUP_JOURNAL_NR, groupEntry);
  }

  return bourse_getContext(cleanFid, mid, 15);
}

function bourse_applyMerchantPurchase_(payload) {
  payload = payload || {};

  const sourceFid = bourse_safeString_(payload.sourceFid || payload.fid || "");
  const destFid = bourse_safeString_(payload.destFid || sourceFid);
  const mid = bourse_safeString_(payload.mid || "");
  if (!sourceFid) throw new Error("sourceFid manquant.");

  const idtSource = bourse_getIdentitySafe_(sourceFid);
  const idtDest = bourse_getIdentitySafe_(destFid);

  const persoAmount = bourse_round2_(Math.max(0, bourse_num_(payload.persoAmount)));
  const groupAmount = bourse_round2_(Math.max(0, bourse_num_(payload.groupAmount)));
  const total = bourse_round2_(Math.max(0, bourse_num_(payload.total || (persoAmount + groupAmount))));
  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  const note = bourse_safeString_(payload.note || "");
  const merchantId = bourse_safeString_(payload.merchantId || "");
  const merchantNom = bourse_safeString_(payload.merchantNom || "");
  if (!(total > 0)) throw new Error("Total d'achat invalide.");
  if (bourse_round2_(persoAmount + groupAmount) !== total) {
    throw new Error("La répartition perso/groupe ne correspond pas au total.");
  }
  if (groupAmount > 0 && !destFid) {
    throw new Error("Le destinataire est obligatoire dès que le groupe paie.");
  }

  const balances = bourse_getPlayerBalances_(sourceFid);
  const groupBefore = bourse_getGroupBalance_();
  if (balances.persoSurSoi < persoAmount) throw new Error("Fonds perso sur soi insuffisants.");
  if (groupBefore < groupAmount) throw new Error("Fonds du groupe insuffisants.");

  const groupAfter = bourse_round2_(groupBefore - groupAmount);
  const persoAfter = bourse_round2_(balances.persoSurSoi - persoAmount);
  const coffreAfter = balances.persoCoffre;

  bourse_setPlayerBalances_(sourceFid, { persoSurSoi: persoAfter, persoCoffre: coffreAfter });
  if (groupAmount > 0) {
    bourse_setGroupBalance_(groupAfter);
    bourse_syncLocalGroupMirror_(sourceFid, groupAfter);
    if (destFid && destFid !== sourceFid) bourse_syncLocalGroupMirror_(destFid, groupAfter);
    if (mid) bourse_syncGroupMirrorForMid_(mid, groupAfter);
  }

  const opId = "buy_" + Utilities.getUuid().replace(/-/g, "").slice(0, 16);
  const dateHeure = new Date();
  const auteur = idtSource.label || sourceFid;
  const compact = bourse_compactObjectLabel_(lines);

  const localEntry = bourse_makeLocalJournalEntry_({
    opId,
    dateHeure,
    typeOp: "achat_marchand",
    montantTotal: total,
    deltaPersoSurSoi: -persoAmount,
    deltaPersoCoffre: 0,
    deltaGroupe: -groupAmount,
    pocheSource: (persoAmount > 0 && groupAmount > 0) ? BOURSE_POCKET.MIXTE : (groupAmount > 0 ? BOURSE_POCKET.GROUPE : BOURSE_POCKET.PERSO_SUR_SOI),
    pocheDestination: "",
    marchandId: merchantId,
    marchandNom: merchantNom,
    objetKey: compact.key,
    objetNom: compact.name,
    quantite: compact.qty,
    prixUnitaire: compact.unit,
    prixTotal: compact.total || total,
    destFid: groupAmount > 0 ? destFid : sourceFid,
    destLabel: groupAmount > 0 ? (idtDest.label || destFid) : (idtSource.label || sourceFid),
    note,
    auteur,
    soldePersoAvant: balances.persoSurSoi,
    soldePersoApres: persoAfter,
    soldeCoffreAvant: balances.persoCoffre,
    soldeCoffreApres: coffreAfter
  });
  bourse_appendJournalEntry_(SpreadsheetApp.openById(sourceFid), BOURSE_LOCAL_NR, localEntry);

  if (groupAmount > 0) {
    const groupEntry = bourse_makeGroupJournalEntry_({
      opId,
      dateHeure,
      typeOp: "achat_marchand",
      montantTotal: total,
      deltaGroupe: -groupAmount,
      pocheSource: (persoAmount > 0 && groupAmount > 0) ? BOURSE_POCKET.MIXTE : BOURSE_POCKET.GROUPE,
      pocheDestination: "",
      fidSource: sourceFid,
      labelSource: idtSource.label || sourceFid,
      fidDest: destFid,
      labelDest: idtDest.label || destFid,
      marchandId: merchantId,
      marchandNom: merchantNom,
      objetKey: compact.key,
      objetNom: compact.name,
      quantite: compact.qty,
      prixUnitaire: compact.unit,
      prixTotal: compact.total || total,
      note,
      auteur,
      soldeAvant: groupBefore,
      soldeApres: groupAfter
    });
    bourse_appendJournalEntry_(bourse_openGroupSpreadsheet_(), BOURSE_GROUP_JOURNAL_NR, groupEntry);
  }

  return {
    ok: true,
    opId,
    balances: {
      persoSurSoiBefore: balances.persoSurSoi,
      persoSurSoiAfter: persoAfter,
      persoCoffreBefore: balances.persoCoffre,
      persoCoffreAfter: coffreAfter,
      groupeBefore: groupBefore,
      groupeAfter: groupAfter
    }
  };
}

function bourse_getContext(fid, mid, limit) {
  const cleanFid = bourse_safeString_(fid);
  const idt = bourse_getIdentitySafe_(cleanFid);
  const balances = cleanFid ? bourse_getPlayerBalances_(cleanFid) : { persoSurSoi: 0, persoCoffre: 0 };
  const groupBalance = bourse_getGroupBalance_();
  const lim = Math.max(1, Math.min(50, Number(limit) || 12));

  if (cleanFid) bourse_syncLocalGroupMirror_(cleanFid, groupBalance);

  return {
    identity: idt,
    balances: {
      persoSurSoi: balances.persoSurSoi,
      persoCoffre: balances.persoCoffre,
      groupe: groupBalance
    },
    allowedPockets: [BOURSE_POCKET.PERSO_SUR_SOI, BOURSE_POCKET.PERSO_COFFRE, BOURSE_POCKET.GROUPE],
    groupDestinations: bourse_listMidPlayers_(mid, cleanFid),
    localRecent: cleanFid ? bourse_getRecentLocalTransactions_(cleanFid, lim).items : [],
    groupRecent: bourse_getRecentGroupTransactions_(lim).items,
    bourseUrl: getBourseUrl()
  };
}

function getTotal() {
  return bourse_getGroupBalance_();
}

function ajouterTransaction(fid, montant, intitule) {
  return bourse_submitOperation(fid, {
    type: "correction",
    pocket: BOURSE_POCKET.GROUPE,
    amount: bourse_num_(montant),
    note: intitule || ""
  });
}

function OuvrirGestionDesFondsDuGroupe() {
  return getBourseUrl();
}

function getBourseUrl() {
  return String(BOURSE_SHEET_URL || "");
}

function getRecentTransactions(limit) {
  return bourse_getRecentGroupTransactions_(limit);
}
