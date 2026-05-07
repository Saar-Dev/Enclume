/**
 * ============================================================
 * Inventory_WebApp.gs — Polaris
 *
 * Ajustements :
 * - suppression d'objet (inventory_deleteItem)
 * - transfert d'objet entre fiches (inventory_transferItem)
 * - récupération optionnelle de cibles de transfert
 *   * via une fonction projet inventory_listTransferTargets(currentFid)
 *   * ou via la Script Property POLARIS_TRANSFER_TARGETS_JSON
 *   * ou via des plages nommées optionnelles de la fiche
 *
 * Remarque : si aucune source de cibles n'est disponible,
 * le HTML permet quand même la saisie manuelle d'un FID cible.
 *
 * Centralisation :
 * - les noms de plages nommées viennent de TRADE_NR (00_Config.gs)
 * - fallback sur les noms texte si TRADE_NR n'est pas disponible
 * ============================================================
 */

function inventory_nr_name_(key, fallback){
  try{
    if (typeof TRADE_NR !== "undefined" && TRADE_NR && Object.prototype.hasOwnProperty.call(TRADE_NR, key)){
      const v = String(TRADE_NR[key] || "").trim();
      if (v) return v;
    }
  }catch(_){}
  return String(fallback || key || "").trim();
}

const INV_ID_NAME           = inventory_nr_name_("InventaireIDObj", "InventaireIDObj");
const INV_NAME_NAME         = inventory_nr_name_("InventaireNomObj", "InventaireNomObj");
const INV_FAM_NAME          = inventory_nr_name_("InventaireFamObj", "InventaireFamObj");
const INV_CAT_NAME          = inventory_nr_name_("InventaireCATObj", "InventaireCATObj");
const INV_EMPL_NAME         = inventory_nr_name_("InventaireEmplObj", "InventaireEmplObj");
const INV_POIDS_NAME        = inventory_nr_name_("InventairePoidsObj", "InventairePoidsObj");
const INV_DESC_NAME         = inventory_nr_name_("InventaireDescriptionObj", "InventaireDescriptionObj");
const INV_QTE_NAME          = inventory_nr_name_("InventaireQteObj", "InventaireQteObj");
const INV_NOTES_NAME        = inventory_nr_name_("InventaireObjNotes", "InventaireObjNotes");
const INV_DEFAULT_CONTAINER = "Coffre";

const EQUIP_NOM_NAME        = inventory_nr_name_("EquipNom", "EquipNom");
const EQUIP_FAM_NAME        = inventory_nr_name_("EquipFam", "EquipFam");
const EQUIP_CAT_NAME        = inventory_nr_name_("EquipCAT", "EquipCAT");
const EQUIP_DESC_NAME       = inventory_nr_name_("EquipDescription", "EquipDescription");
const EQUIP_POIDS_NAME      = inventory_nr_name_("EquipPoids", "EquipPoids");

const INVENTORY_TRANSFER_RANGE_CANDIDATES = [
  "InventaireTransferTargets",
  "TransferTargets",
  "TransferTargetsFID"
];

const INVENTORY_TRANSFER_LABEL_RANGE_CANDIDATES = [
  "InventaireTransferTargetsLabel",
  "TransferTargetsLabel"
];

const INVENTORY_UNIQUE_STATS = [
  { key:"nt",            invName:inventory_nr_name_("InventaireObjNT",          "InventaireObjNT"),          equipName:inventory_nr_name_("EquipNT",                "EquipNT"),                itemProp:"catalogNT" },
  { key:"fabricant",     invName:inventory_nr_name_("InventaireObjFabricant",   "InventaireObjFabricant"),   equipName:inventory_nr_name_("EquipFabricant",         "EquipFabricant"),         itemProp:"catalogFabricant" },
  { key:"nation",        invName:inventory_nr_name_("InventaireObjNation",      "InventaireObjNation"),      equipName:inventory_nr_name_("EquipNation",            "EquipNation"),            itemProp:"catalogNation" },
  { key:"dom",           invName:inventory_nr_name_("InventaireObjDom",         "InventaireObjDom"),         equipName:inventory_nr_name_("EquipArmeDom",           "EquipArmeDom"),           itemProp:"catalogArmeDom" },
  { key:"choc",          invName:inventory_nr_name_("InventaireObjChoc",        "InventaireObjChoc"),        equipName:inventory_nr_name_("EquipArmeChoc",          "EquipArmeChoc"),          itemProp:"catalogArmeChoc" },
  { key:"portee",        invName:inventory_nr_name_("InventaireObjPortee",      "InventaireObjPortee"),      equipName:inventory_nr_name_("EquipArmePortee",        "EquipArmePortee"),        itemProp:"catalogArmePortee" },
  { key:"for",           invName:inventory_nr_name_("InventaireObjFOR",         "InventaireObjFOR"),         equipName:inventory_nr_name_("EquipArmeFORPreReq",     "EquipArmeFORPreReq"),     itemProp:"catalogArmeFOR" },
  { key:"init",          invName:inventory_nr_name_("InventaireObjInit",        "InventaireObjInit"),        equipName:inventory_nr_name_("EquipArmeINIMod",        "EquipArmeINIMod"),        itemProp:"catalogArmeInit" },
  { key:"modeTir",       invName:inventory_nr_name_("InventaireObjModedeTir",   "InventaireObjModedeTir"),   equipName:inventory_nr_name_("EquipArmeModeTir",       "EquipArmeModeTir"),       itemProp:"catalogArmeModeTir" },
  { key:"mun",           invName:inventory_nr_name_("InventaireObjMun",         "InventaireObjMun"),         equipName:inventory_nr_name_("EquipArmeMunition",      "EquipArmeMunition"),      itemProp:"catalogArmeMun" },
  { key:"cal",           invName:inventory_nr_name_("InventaireObjCAL",         "InventaireObjCAL"),         equipName:inventory_nr_name_("EquipArmeCAL",           "EquipArmeCAL"),           itemProp:"catalogArmeCAL" },
  { key:"dispo",         invName:inventory_nr_name_("InventaireObjDispo",       "InventaireObjDispo"),       equipName:inventory_nr_name_("EquipDispo",             "EquipDispo"),             itemProp:"dispo" },
  { key:"prot",          invName:inventory_nr_name_("InventaireObjProt",        "InventaireObjProt"),        equipName:inventory_nr_name_("EquipArmureProt",        "EquipArmureProt"),        itemProp:"catalogArmureProt" },
  { key:"protChoc",      invName:inventory_nr_name_("InventaireObjProtChoc",    "InventaireObjProtChoc"),    equipName:inventory_nr_name_("EquipArmureChoc",        "EquipArmureChoc"),        itemProp:"catalogArmureChoc" },
  { key:"loc",           invName:inventory_nr_name_("InventaireObjLoc",         "InventaireObjLoc"),         equipName:inventory_nr_name_("EquipArmureLoc",         "EquipArmureLoc"),         itemProp:"catalogArmureLoc" },
  { key:"armureMalus",   invName:inventory_nr_name_("InventaireObjArmureMalus", "InventaireObjArmureMalus"), equipName:inventory_nr_name_("EquipArmureMal",         "EquipArmureMal"),         itemProp:"catalogArmureMal" },
  { key:"contenance",    invName:inventory_nr_name_("InventaireObjContenance",  "InventaireObjContenance"),  equipName:inventory_nr_name_("EquipObjContenance",     "EquipObjContenance"),     itemProp:"catalogContenance" },
  { key:"etancheite",    invName:inventory_nr_name_("InventaireObjEtancheite",  "InventaireObjEtancheite"),  equipName:inventory_nr_name_("EquipObjEtancheite",     "EquipObjEtancheite"),     itemProp:"catalogEtancheite" }
];

/* =======================
   API HTML
   ======================= */

function inventory_getContext(fid) {
  try {
    const cleanFid = String(fid || "").trim();
    const ss = SpreadsheetApp.openById(cleanFid);
    const ctx = _inventory_getContext_(ss);
    if (!ctx.ok) return ctx;
    return _inventory_buildPayload_(ctx, cleanFid);
  } catch (err) {
    return { ok:false, error:"Erreur inventory_getContext : " + String((err && err.message) || err) };
  }
}

function inventory_moveItem(fid, itemId, newContainer) {
  try {
    const cleanFid = String(fid || "").trim();
    const ss = SpreadsheetApp.openById(cleanFid);
    const ctx = _inventory_getContext_(ss);
    if (!ctx.ok) return ctx;

    const idNum = _inventory_num_(itemId);
    const targetContainer = String(newContainer || "").trim();

    if (!idNum) return { ok:false, error:"ID d'objet invalide." };
    if (!targetContainer) return { ok:false, error:"Container cible vide." };

    const idx = ctx.ids.indexOf(idNum);
    if (idx === -1) return { ok:false, error:"Objet introuvable dans l'inventaire." };

    ctx.emplRange.getCell(idx + 1, 1).setValue(targetContainer);
    SpreadsheetApp.flush();

    const refreshed = _inventory_getContext_(ss);
    if (!refreshed.ok) return refreshed;
    const out = _inventory_buildPayload_(refreshed, cleanFid);
    out.message = "Objet déplacé.";
    out.selectedItemId = idNum;
    return out;

  } catch (err) {
    return { ok:false, error:"Erreur inventory_moveItem : " + String((err && err.message) || err) };
  }
}

function inventory_updateItemText(fid, itemId, fields) {
  try {
    const cleanFid = String(fid || "").trim();
    const ss = SpreadsheetApp.openById(cleanFid);
    const ctx = _inventory_getContext_(ss);
    if (!ctx.ok) return ctx;

    const idNum = _inventory_num_(itemId);
    if (!idNum) return { ok:false, error:"ID d'objet invalide." };

    const idx = ctx.ids.indexOf(idNum);
    if (idx === -1) return { ok:false, error:"Objet introuvable dans l'inventaire." };

    fields = fields || {};
    const currentNotes = ctx.notes[idx] || "";
    const currentDesc  = ctx.descriptions[idx] || "";

    const desiredNotes = Object.prototype.hasOwnProperty.call(fields, "notes")
      ? String(fields.notes || "") : currentNotes;
    const desiredDesc  = Object.prototype.hasOwnProperty.call(fields, "description")
      ? String(fields.description || "") : currentDesc;

    if (desiredNotes === currentNotes && desiredDesc === currentDesc) {
      const out = _inventory_buildPayload_(ctx, cleanFid);
      out.selectedItemId = idNum;
      out.message = "Aucun changement.";
      return out;
    }

    const equipMap = _inventory_buildEquipMap_(ctx);

    if (_inventory_num_(ctx.qtys[idx]) > 1) {
      const split = _inventory_splitRow_(ctx, idx, 1, { notes:desiredNotes, description:desiredDesc }, equipMap);
      if (!split.ok) return split;
      SpreadsheetApp.flush();
      const refreshed = _inventory_getContext_(ss);
      if (!refreshed.ok) return refreshed;
      const out = _inventory_buildPayload_(refreshed, cleanFid);
      out.selectedItemId = split.newId;
      out.message = "Pile scindée automatiquement : objet unique créé.";
      return out;
    }

    ctx.notesRange.getCell(idx + 1, 1).setValue(desiredNotes);
    ctx.descRange.getCell(idx + 1, 1).setValue(desiredDesc);

    const rowStats = _inventory_resolveStatsForRow_(ctx, idx, equipMap);
    _inventory_applyUniqueStatsToRow_(ctx, idx, rowStats);

    SpreadsheetApp.flush();

    const refreshed = _inventory_getContext_(ss);
    if (!refreshed.ok) return refreshed;
    const out = _inventory_buildPayload_(refreshed, cleanFid);
    out.message = "Texte mis à jour.";
    out.selectedItemId = idNum;
    return out;

  } catch (err) {
    return { ok:false, error:"Erreur inventory_updateItemText : " + String((err && err.message) || err) };
  }
}

function inventory_splitStack(fid, itemId, splitQty) {
  try {
    const cleanFid = String(fid || "").trim();
    const ss = SpreadsheetApp.openById(cleanFid);
    const ctx = _inventory_getContext_(ss);
    if (!ctx.ok) return ctx;

    const idNum      = _inventory_num_(itemId);
    const qtyToSplit = parseInt(String(splitQty || "1"), 10);

    if (!idNum) return { ok:false, error:"ID d'objet invalide." };
    if (!Number.isFinite(qtyToSplit) || qtyToSplit <= 0) return { ok:false, error:"Quantité à séparer invalide." };

    const idx = ctx.ids.indexOf(idNum);
    if (idx === -1) return { ok:false, error:"Objet introuvable dans l'inventaire." };

    const sourceQty = _inventory_num_(ctx.qtys[idx]);
    if (sourceQty <= 1)          return { ok:false, error:"Cette ligne ne contient pas de pile à séparer." };
    if (qtyToSplit >= sourceQty) return { ok:false, error:"La quantité à séparer doit être inférieure à la quantité actuelle." };

    const equipMap = _inventory_buildEquipMap_(ctx);
    const split    = _inventory_splitRow_(ctx, idx, qtyToSplit, null, equipMap);
    if (!split.ok) return split;

    SpreadsheetApp.flush();

    const refreshed = _inventory_getContext_(ss);
    if (!refreshed.ok) return refreshed;
    const out = _inventory_buildPayload_(refreshed, cleanFid);
    out.selectedItemId = split.newId;
    out.message = "Pile séparée.";
    return out;

  } catch (err) {
    return { ok:false, error:"Erreur inventory_splitStack : " + String((err && err.message) || err) };
  }
}

function inventory_addManualItem(fid, payload) {
  try {
    const cleanFid = String(fid || "").trim();
    const ss = SpreadsheetApp.openById(cleanFid);
    const ctx = _inventory_getContext_(ss);
    if (!ctx.ok) return ctx;

    payload = payload || {};
    const name  = String(payload.name  || "").trim();
    const fam   = String(payload.family || "").trim();
    const cat   = String(payload.category || "").trim();
    const empl  = String(payload.emplacement || "").trim() || INV_DEFAULT_CONTAINER;
    const poids = _inventory_num_(payload.weight);
    const desc  = String(payload.description || "").trim();
    const notes = String(payload.notes || "").trim();
    let   qty   = parseInt(String(payload.quantity || "1"), 10);

    if (!name) return { ok:false, error:"Le nom est obligatoire." };
    if (!fam)  return { ok:false, error:"La famille est obligatoire." };
    if (!cat)  return { ok:false, error:"La catégorie est obligatoire." };
    if (!Number.isFinite(qty) || qty <= 0) qty = 1;

    const equipMap = _inventory_buildEquipMap_(ctx);
    const stats    = _inventory_collectStatsFromPayload_(payload, ctx, name, equipMap);

    const dupIdx = _inventory_findDuplicateManualRow_(ctx, { name, family:fam, category:cat, emplacement:empl, weight:poids, description:desc, notes }, stats, equipMap);

    if (dupIdx !== -1) {
      const currentQty = _inventory_num_(ctx.qtys[dupIdx]);
      ctx.qtyRange.getCell(dupIdx + 1, 1).setValue(currentQty + qty);
      _inventory_applyUniqueStatsToRow_(ctx, dupIdx, stats);
      SpreadsheetApp.flush();

      const refreshed = _inventory_getContext_(ss);
      if (!refreshed.ok) return refreshed;
      const out = _inventory_buildPayload_(refreshed, cleanFid);
      out.message = "Objet déjà présent : quantité augmentée.";
      out.selectedItemId = refreshed.ids[dupIdx] || 0;
      return out;
    }

    const freeIdx = _inventory_findFirstEmptyRow_(ctx);
    if (freeIdx === -1) return { ok:false, error:"Aucune ligne libre disponible dans l'inventaire." };

    const newId = _inventory_nextId_(ctx);

    _inventory_writeBaseRow_(ctx, freeIdx, {
      id: newId, name, fam, cat, empl, poids, desc, qty, notes
    });
    _inventory_applyUniqueStatsToRow_(ctx, freeIdx, stats);

    SpreadsheetApp.flush();

    const refreshed = _inventory_getContext_(ss);
    if (!refreshed.ok) return refreshed;
    const out = _inventory_buildPayload_(refreshed, cleanFid);
    out.message = "Objet ajouté.";
    out.selectedItemId = newId;
    return out;

  } catch (err) {
    return { ok:false, error:"Erreur inventory_addManualItem : " + String((err && err.message) || err) };
  }
}

function inventory_deleteItem(fid, itemId, deleteQty) {
  try {
    const cleanFid = String(fid || "").trim();
    const ss = SpreadsheetApp.openById(cleanFid);
    const ctx = _inventory_getContext_(ss);
    if (!ctx.ok) return ctx;

    const idNum = _inventory_num_(itemId);
    if (!idNum) return { ok:false, error:"ID d'objet invalide." };

    const idx = ctx.ids.indexOf(idNum);
    if (idx === -1) return { ok:false, error:"Objet introuvable dans l'inventaire." };

    const sourceQty = _inventory_num_(ctx.qtys[idx]);
    const qtyToDelete = parseInt(String(deleteQty == null ? "1" : deleteQty), 10);

    if (!Number.isFinite(qtyToDelete) || qtyToDelete <= 0) return { ok:false, error:"Quantité à jeter invalide." };
    if (qtyToDelete > sourceQty) return { ok:false, error:"La quantité à jeter dépasse la quantité disponible." };

    if (qtyToDelete >= sourceQty) {
      _inventory_clearRow_(ctx, idx);
    } else {
      ctx.qtyRange.getCell(idx + 1, 1).setValue(sourceQty - qtyToDelete);
    }
    SpreadsheetApp.flush();

    const refreshed = _inventory_getContext_(ss);
    if (!refreshed.ok) return refreshed;
    const out = _inventory_buildPayload_(refreshed, cleanFid);
    out.message = qtyToDelete >= sourceQty ? "Objet supprimé." : ("Quantité jetée : " + qtyToDelete + ".");
    out.selectedItemId = qtyToDelete >= sourceQty ? 0 : idNum;
    return out;

  } catch (err) {
    return { ok:false, error:"Erreur inventory_deleteItem : " + String((err && err.message) || err) };
  }
}

function inventory_transferItem(fid, itemId, targetFid, transferQty) {
  try {
    const sourceFid = _inventory_extractSpreadsheetId_(fid);
    const destFid   = _inventory_extractSpreadsheetId_(targetFid);
    const idNum     = _inventory_num_(itemId);

    if (!sourceFid) return { ok:false, error:"FID source manquant." };
    if (!destFid)   return { ok:false, error:"FID cible manquant." };
    if (!idNum)     return { ok:false, error:"ID d'objet invalide." };
    if (sourceFid === destFid) return { ok:false, error:"La cible doit être différente de la source." };

    const sourceSs = SpreadsheetApp.openById(sourceFid);
    const targetSs = SpreadsheetApp.openById(destFid);

    const sourceCtx = _inventory_getContext_(sourceSs);
    if (!sourceCtx.ok) return sourceCtx;

    const targetCtx = _inventory_getContext_(targetSs);
    if (!targetCtx.ok) return { ok:false, error:"Fiche cible invalide : " + String(targetCtx.error || "plages introuvables") };

    const srcIdx = sourceCtx.ids.indexOf(idNum);
    if (srcIdx === -1) return { ok:false, error:"Objet introuvable dans l'inventaire source." };

    const sourceQty = _inventory_num_(sourceCtx.qtys[srcIdx]);
    const qtyToTransfer = parseInt(String(transferQty == null ? "1" : transferQty), 10);

    if (!Number.isFinite(qtyToTransfer) || qtyToTransfer <= 0) return { ok:false, error:"Quantité à transférer invalide." };
    if (qtyToTransfer > sourceQty) return { ok:false, error:"La quantité à transférer dépasse la quantité disponible." };

    const sourceEquipMap = _inventory_buildEquipMap_(sourceCtx);
    const targetEquipMap = _inventory_buildEquipMap_(targetCtx);

    const rowData = {
      name:        sourceCtx.names[srcIdx],
      family:      sourceCtx.fams[srcIdx],
      category:    sourceCtx.cats[srcIdx],
      emplacement: sourceCtx.emplacements[srcIdx] || INV_DEFAULT_CONTAINER,
      weight:      sourceCtx.poids[srcIdx],
      description: sourceCtx.descriptions[srcIdx],
      notes:       sourceCtx.notes[srcIdx],
      quantity:    qtyToTransfer
    };

    const rowStats = _inventory_resolveStatsForRow_(sourceCtx, srcIdx, sourceEquipMap);

    const dupIdx = _inventory_findDuplicateManualRow_(
      targetCtx,
      {
        name: rowData.name,
        family: rowData.family,
        category: rowData.category,
        emplacement: rowData.emplacement,
        weight: rowData.weight,
        description: rowData.description,
        notes: rowData.notes
      },
      rowStats,
      targetEquipMap
    );

    if (dupIdx !== -1) {
      const currentQty = _inventory_num_(targetCtx.qtys[dupIdx]);
      targetCtx.qtyRange.getCell(dupIdx + 1, 1).setValue(currentQty + rowData.quantity);
      _inventory_applyUniqueStatsToRow_(targetCtx, dupIdx, rowStats);
    } else {
      const freeIdx = _inventory_findFirstEmptyRow_(targetCtx);
      if (freeIdx === -1) return { ok:false, error:"Aucune ligne libre disponible dans l'inventaire cible." };

      const newId = _inventory_nextId_(targetCtx);
      _inventory_writeBaseRow_(targetCtx, freeIdx, {
        id:    newId,
        name:  rowData.name,
        fam:   rowData.family,
        cat:   rowData.category,
        empl:  rowData.emplacement,
        poids: rowData.weight,
        desc:  rowData.description,
        qty:   rowData.quantity,
        notes: rowData.notes
      });
      _inventory_applyUniqueStatsToRow_(targetCtx, freeIdx, rowStats);
    }

    if (qtyToTransfer >= sourceQty) {
      _inventory_clearRow_(sourceCtx, srcIdx);
    } else {
      sourceCtx.qtyRange.getCell(srcIdx + 1, 1).setValue(sourceQty - qtyToTransfer);
    }
    SpreadsheetApp.flush();

    const refreshedSource = _inventory_getContext_(sourceSs);
    if (!refreshedSource.ok) return refreshedSource;

    const out = _inventory_buildPayload_(refreshedSource, sourceFid);
    out.message = qtyToTransfer >= sourceQty ? "Objet transféré." : ("Transfert effectué : " + qtyToTransfer + ".");
    out.selectedItemId = qtyToTransfer >= sourceQty ? 0 : idNum;
    return out;

  } catch (err) {
    return { ok:false, error:"Erreur inventory_transferItem : " + String((err && err.message) || err) };
  }
}

function inventory_moveItemFast(fid, itemId, newContainer) {
  try {
    const cleanFid = String(fid || "").trim();
    const ss = SpreadsheetApp.openById(cleanFid);
    const ctx = _inventory_getContext_(ss);
    if (!ctx.ok) return ctx;

    const idNum = _inventory_num_(itemId);
    const targetContainer = String(newContainer || "").trim();

    if (!idNum) return { ok:false, error:"ID d'objet invalide." };
    if (!targetContainer) return { ok:false, error:"Container cible vide." };

    const idx = ctx.ids.indexOf(idNum);
    if (idx === -1) return { ok:false, error:"Objet introuvable dans l'inventaire." };

    if (String(ctx.emplacements[idx] || "").trim() === targetContainer) {
      return {
        ok:true,
        itemId:idNum,
        emplacement:targetContainer,
        selectedItemId:idNum,
        message:"Aucun changement."
      };
    }

    ctx.emplRange.getCell(idx + 1, 1).setValue(targetContainer);
    SpreadsheetApp.flush();

    return {
      ok:true,
      itemId:idNum,
      emplacement:targetContainer,
      selectedItemId:idNum,
      message:"Objet déplacé."
    };
  } catch (err) {
    return { ok:false, error:"Erreur inventory_moveItemFast : " + String((err && err.message) || err) };
  }
}

function inventory_deleteItemFast(fid, itemId, deleteQty) {
  try {
    const cleanFid = String(fid || "").trim();
    const ss = SpreadsheetApp.openById(cleanFid);
    const ctx = _inventory_getContext_(ss);
    if (!ctx.ok) return ctx;

    const idNum = _inventory_num_(itemId);
    if (!idNum) return { ok:false, error:"ID d'objet invalide." };

    const idx = ctx.ids.indexOf(idNum);
    if (idx === -1) return { ok:false, error:"Objet introuvable dans l'inventaire." };

    const sourceQty = _inventory_num_(ctx.qtys[idx]);
    const qtyToDelete = parseInt(String(deleteQty == null ? "1" : deleteQty), 10);

    if (!Number.isFinite(qtyToDelete) || qtyToDelete <= 0) return { ok:false, error:"Quantité à jeter invalide." };
    if (qtyToDelete > sourceQty) return { ok:false, error:"La quantité à jeter dépasse la quantité disponible." };

    const removed = qtyToDelete >= sourceQty;
    const remainingQty = removed ? 0 : (sourceQty - qtyToDelete);

    if (removed) _inventory_clearRow_(ctx, idx);
    else ctx.qtyRange.getCell(idx + 1, 1).setValue(remainingQty);

    SpreadsheetApp.flush();

    return {
      ok:true,
      itemId:idNum,
      deletedQty:qtyToDelete,
      removed:removed,
      remainingQty:remainingQty,
      selectedItemId: removed ? 0 : idNum,
      message: removed ? "Objet supprimé." : ("Quantité jetée : " + qtyToDelete + ".")
    };
  } catch (err) {
    return { ok:false, error:"Erreur inventory_deleteItemFast : " + String((err && err.message) || err) };
  }
}

function inventory_transferItemFast(fid, itemId, targetFid, transferQty) {
  try {
    const sourceFid = _inventory_extractSpreadsheetId_(fid);
    const destFid   = _inventory_extractSpreadsheetId_(targetFid);
    const idNum     = _inventory_num_(itemId);

    if (!sourceFid) return { ok:false, error:"FID source manquant." };
    if (!destFid)   return { ok:false, error:"FID cible manquant." };
    if (!idNum)     return { ok:false, error:"ID d'objet invalide." };
    if (sourceFid === destFid) return { ok:false, error:"La cible doit être différente de la source." };

    const sourceSs = SpreadsheetApp.openById(sourceFid);
    const targetSs = SpreadsheetApp.openById(destFid);

    const sourceCtx = _inventory_getContext_(sourceSs);
    if (!sourceCtx.ok) return sourceCtx;
    const targetCtx = _inventory_getContext_(targetSs);
    if (!targetCtx.ok) return { ok:false, error:"Fiche cible invalide : " + String(targetCtx.error || "plages introuvables") };

    const srcIdx = sourceCtx.ids.indexOf(idNum);
    if (srcIdx === -1) return { ok:false, error:"Objet introuvable dans l'inventaire source." };

    const sourceQty = _inventory_num_(sourceCtx.qtys[srcIdx]);
    const qtyToTransfer = parseInt(String(transferQty == null ? "1" : transferQty), 10);

    if (!Number.isFinite(qtyToTransfer) || qtyToTransfer <= 0) return { ok:false, error:"Quantité à transférer invalide." };
    if (qtyToTransfer > sourceQty) return { ok:false, error:"La quantité à transférer dépasse la quantité disponible." };

    const sourceEquipMap = _inventory_buildEquipMap_(sourceCtx);
    const targetEquipMap = _inventory_buildEquipMap_(targetCtx);
    const rowStats = _inventory_resolveStatsForRow_(sourceCtx, srcIdx, sourceEquipMap);

    const rowData = {
      name:        sourceCtx.names[srcIdx],
      family:      sourceCtx.fams[srcIdx],
      category:    sourceCtx.cats[srcIdx],
      emplacement: sourceCtx.emplacements[srcIdx] || INV_DEFAULT_CONTAINER,
      weight:      sourceCtx.poids[srcIdx],
      description: sourceCtx.descriptions[srcIdx],
      notes:       sourceCtx.notes[srcIdx],
      quantity:    qtyToTransfer
    };

    const dupIdx = _inventory_findDuplicateManualRow_(targetCtx, {
      name: rowData.name, family: rowData.family, category: rowData.category, emplacement: rowData.emplacement,
      weight: rowData.weight, description: rowData.description, notes: rowData.notes
    }, rowStats, targetEquipMap);

    if (dupIdx !== -1) {
      const currentQty = _inventory_num_(targetCtx.qtys[dupIdx]);
      targetCtx.qtyRange.getCell(dupIdx + 1, 1).setValue(currentQty + rowData.quantity);
      _inventory_applyUniqueStatsToRow_(targetCtx, dupIdx, rowStats);
    } else {
      const freeIdx = _inventory_findFirstEmptyRow_(targetCtx);
      if (freeIdx === -1) return { ok:false, error:"Aucune ligne libre disponible dans l'inventaire cible." };
      const newId = _inventory_nextId_(targetCtx);
      _inventory_writeBaseRow_(targetCtx, freeIdx, {
        id:newId, name:rowData.name, fam:rowData.family, cat:rowData.category, empl:rowData.emplacement,
        poids:rowData.weight, desc:rowData.description, qty:rowData.quantity, notes:rowData.notes
      });
      _inventory_applyUniqueStatsToRow_(targetCtx, freeIdx, rowStats);
    }

    const removed = qtyToTransfer >= sourceQty;
    const remainingQty = removed ? 0 : (sourceQty - qtyToTransfer);
    if (removed) _inventory_clearRow_(sourceCtx, srcIdx);
    else sourceCtx.qtyRange.getCell(srcIdx + 1, 1).setValue(remainingQty);

    SpreadsheetApp.flush();

    return {
      ok:true,
      itemId:idNum,
      transferredQty:qtyToTransfer,
      removed:removed,
      remainingQty:remainingQty,
      selectedItemId: removed ? 0 : idNum,
      message: removed ? "Objet transféré." : ("Transfert effectué : " + qtyToTransfer + ".")
    };
  } catch (err) {
    return { ok:false, error:"Erreur inventory_transferItemFast : " + String((err && err.message) || err) };
  }
}

function inventory_splitStackFast(fid, itemId, splitQty) {
  try {
    const cleanFid = String(fid || "").trim();
    const ss = SpreadsheetApp.openById(cleanFid);
    const ctx = _inventory_getContext_(ss);
    if (!ctx.ok) return ctx;

    const idNum      = _inventory_num_(itemId);
    const qtyToSplit = parseInt(String(splitQty || "1"), 10);

    if (!idNum) return { ok:false, error:"ID d'objet invalide." };
    if (!Number.isFinite(qtyToSplit) || qtyToSplit <= 0) return { ok:false, error:"Quantité à séparer invalide." };

    const idx = ctx.ids.indexOf(idNum);
    if (idx === -1) return { ok:false, error:"Objet introuvable dans l'inventaire." };

    const sourceQty = _inventory_num_(ctx.qtys[idx]);
    if (sourceQty <= 1) return { ok:false, error:"Cette ligne ne contient pas de pile à séparer." };
    if (qtyToSplit >= sourceQty) return { ok:false, error:"La quantité à séparer doit être inférieure à la quantité actuelle." };

    const equipMap = _inventory_buildEquipMap_(ctx);
    const split = _inventory_splitRow_(ctx, idx, qtyToSplit, null, equipMap);
    if (!split.ok) return split;

    SpreadsheetApp.flush();

    const rowStats = _inventory_resolveStatsForRow_(ctx, idx, equipMap);
    const newItem = _inventory_buildItemFromRowData_({
      name: ctx.names[idx],
      family: ctx.fams[idx],
      category: ctx.cats[idx],
      emplacement: ctx.emplacements[idx] || INV_DEFAULT_CONTAINER,
      weight: ctx.poids[idx],
      description: ctx.descriptions[idx],
      notes: ctx.notes[idx],
      quantity: qtyToSplit
    }, rowStats, split.newId);

    return {
      ok:true,
      itemId:idNum,
      remainingQty:sourceQty - qtyToSplit,
      newItem:newItem,
      selectedItemId:split.newId,
      message:"Pile séparée."
    };
  } catch (err) {
    return { ok:false, error:"Erreur inventory_splitStackFast : " + String((err && err.message) || err) };
  }
}

/* =======================
   Context — lecture groupée
   ======================= */

function _inventory_getContext_(ss) {
  try {
    const idRange    = _inventory_getNamedDataRange_(ss, INV_ID_NAME);
    const nameRange  = _inventory_getNamedDataRange_(ss, INV_NAME_NAME);
    const famRange   = _inventory_getNamedDataRange_(ss, INV_FAM_NAME);
    const catRange   = _inventory_getNamedDataRange_(ss, INV_CAT_NAME);
    const emplRange  = _inventory_getNamedDataRange_(ss, INV_EMPL_NAME);
    const poidsRange = _inventory_getNamedDataRange_(ss, INV_POIDS_NAME);
    const descRange  = _inventory_getNamedDataRange_(ss, INV_DESC_NAME);
    const qtyRange   = _inventory_getNamedDataRange_(ss, INV_QTE_NAME);
    const notesRange = _inventory_getNamedDataRange_(ss, INV_NOTES_NAME);

    if (!idRange)    return { ok:false, error:"Plage nommée introuvable : " + INV_ID_NAME };
    if (!nameRange)  return { ok:false, error:"Plage nommée introuvable : " + INV_NAME_NAME };
    if (!famRange)   return { ok:false, error:"Plage nommée introuvable : " + INV_FAM_NAME };
    if (!catRange)   return { ok:false, error:"Plage nommée introuvable : " + INV_CAT_NAME };
    if (!emplRange)  return { ok:false, error:"Plage nommée introuvable : " + INV_EMPL_NAME };
    if (!poidsRange) return { ok:false, error:"Plage nommée introuvable : " + INV_POIDS_NAME };
    if (!descRange)  return { ok:false, error:"Plage nommée introuvable : " + INV_DESC_NAME };
    if (!qtyRange)   return { ok:false, error:"Plage nommée introuvable : " + INV_QTE_NAME };
    if (!notesRange) return { ok:false, error:"Plage nommée introuvable : " + INV_NOTES_NAME };

    const n = idRange.getNumRows();

    const ids_raw    = idRange.getValues().flat();
    const names_raw  = nameRange.getValues().flat();
    const fams_raw   = famRange.getValues().flat();
    const cats_raw   = catRange.getValues().flat();
    const empl_raw   = emplRange.getValues().flat();
    const poids_raw  = poidsRange.getValues().flat();
    const desc_raw   = descRange.getValues().flat();
    const qty_raw    = qtyRange.getValues().flat();
    const notes_raw  = notesRange.getValues().flat();

    const equipNameRange = _inventory_getNamedDataRange_(ss, EQUIP_NOM_NAME);
    if (!equipNameRange) return { ok:false, error:"Plage nommée introuvable : " + EQUIP_NOM_NAME };

    const m = equipNameRange.getNumRows();
    const equipFamRange   = _inventory_getNamedDataRangeOptional_(ss, EQUIP_FAM_NAME);
    const equipCatRange   = _inventory_getNamedDataRangeOptional_(ss, EQUIP_CAT_NAME);
    const equipDescRange  = _inventory_getNamedDataRangeOptional_(ss, EQUIP_DESC_NAME);
    const equipPoidsRange = _inventory_getNamedDataRangeOptional_(ss, EQUIP_POIDS_NAME);

    const uniqueCtx = _inventory_loadUniqueFieldContext_(ss, n, m);
    if (!uniqueCtx.ok) return uniqueCtx;

    return {
      ok: true,
      sheet: idRange.getSheet(),
      ss: ss,
      idRange, nameRange, famRange, catRange, emplRange,
      poidsRange, descRange, qtyRange, notesRange,
      ids:          ids_raw.map(_inventory_num_),
      names:        names_raw.map(_inventory_str_),
      fams:         fams_raw.map(_inventory_str_),
      cats:         cats_raw.map(_inventory_str_),
      emplacements: empl_raw.map(_inventory_str_),
      poids:        poids_raw.map(_inventory_num_),
      descriptions: desc_raw.map(_inventory_str_),
      qtys:         qty_raw.map(_inventory_num_),
      notes:        notes_raw.map(_inventory_str_),
      uniqueInvRanges:  uniqueCtx.invRanges,
      uniqueInvValues:  uniqueCtx.invValues,
      uniqueEquipValues: uniqueCtx.equipValues,
      equipNames:        _inventory_strArray_(equipNameRange, m, EQUIP_NOM_NAME),
      equipFams:         _inventory_optionalValues_(equipFamRange,   m, _inventory_str_, "", EQUIP_FAM_NAME),
      equipCats:         _inventory_optionalValues_(equipCatRange,   m, _inventory_str_, "", EQUIP_CAT_NAME),
      equipDescriptions: _inventory_optionalValues_(equipDescRange,  m, _inventory_str_, "", EQUIP_DESC_NAME),
      equipPoids:        _inventory_optionalValues_(equipPoidsRange, m, _inventory_num_, 0,  EQUIP_POIDS_NAME)
    };

  } catch (err) {
    return { ok:false, error:String((err && err.message) || err) };
  }
}

function _inventory_loadUniqueFieldContext_(ss, invSize, equipSize) {
  try {
    const invRanges   = {};
    const invValues   = {};
    const equipValues = {};

    for (let i = 0; i < INVENTORY_UNIQUE_STATS.length; i++) {
      const def = INVENTORY_UNIQUE_STATS[i];

      const invRange = _inventory_getNamedDataRange_(ss, def.invName);
      if (!invRange) return { ok:false, error:"Plage nommée introuvable : " + def.invName };
      if (invRange.getNumRows() !== invSize) return { ok:false, error:"La plage " + def.invName + " n'a pas la même hauteur que l'inventaire." };

      invRanges[def.key] = invRange;
      invValues[def.key] = invRange.getValues().flat().map(_inventory_str_);

      const equipRange = _inventory_getNamedDataRangeOptional_(ss, def.equipName);
      equipValues[def.key] = _inventory_optionalValues_(equipRange, equipSize, _inventory_str_, "", def.equipName);
    }

    return { ok:true, invRanges, invValues, equipValues };

  } catch (err) {
    return { ok:false, error:String((err && err.message) || err) };
  }
}

function _inventory_buildPayload_(ctx, currentFid) {
  const items        = [];
  const equipMap     = _inventory_buildEquipMap_(ctx);
  const equipCatalog = _inventory_buildEquipCatalog_(ctx, equipMap);

  for (let i = 0; i < ctx.ids.length; i++) {
    const id   = ctx.ids[i];
    const name = ctx.names[i];
    if (!id && !name) continue;
    if (!name) continue;

    const resolvedStats = _inventory_resolveStatsForRow_(ctx, i, equipMap);

    const item = {
      id,
      key: String(id),
      name,
      displayName: _inventory_buildDisplayName_(name, ctx.notes[i]),
      family:      ctx.fams[i],
      category:    ctx.cats[i],
      emplacement: ctx.emplacements[i] || "",
      weight:      ctx.poids[i],
      description: ctx.descriptions[i],
      quantity:    ctx.qtys[i],
      notes:       ctx.notes[i]
    };

    for (let j = 0; j < INVENTORY_UNIQUE_STATS.length; j++) {
      const def = INVENTORY_UNIQUE_STATS[j];
      item[def.itemProp] = resolvedStats[def.key] || "";
    }

    items.push(item);
  }

  items.sort((a, b) => a.displayName.localeCompare(b.displayName, "fr", { sensitivity:"base" }));

  const containers      = _inventory_getContainersFromItems_(items);
  const calibers        = _inventory_uniqueNonEmptySorted_(equipCatalog.map(x => x.catalogArmeCAL || ""));
  const transferTargets = _inventory_getTransferTargets_(ctx.ss, currentFid);

  return {
    ok: true,
    items,
    containers,
    equipCatalog,
    calibers,
    transferTargets,
    counts: { items:items.length, containers:containers.length }
  };
}

function _inventory_buildItemFromRowData_(rowData, rowStats, id) {
  const item = {
    id: _inventory_num_(id),
    key: String(_inventory_num_(id)),
    name: String(rowData && rowData.name || "").trim(),
    displayName: _inventory_buildDisplayName_(rowData && rowData.name, rowData && rowData.notes),
    family: String(rowData && rowData.family || "").trim(),
    category: String(rowData && rowData.category || "").trim(),
    emplacement: String(rowData && rowData.emplacement || "").trim(),
    weight: _inventory_num_(rowData && rowData.weight),
    description: String(rowData && rowData.description || "").trim(),
    quantity: _inventory_num_(rowData && rowData.quantity),
    notes: String(rowData && rowData.notes || "").trim()
  };

  rowStats = rowStats || {};
  for (let j = 0; j < INVENTORY_UNIQUE_STATS.length; j++) {
    const def = INVENTORY_UNIQUE_STATS[j];
    item[def.itemProp] = String(rowStats[def.key] || "");
  }
  return item;
}

function _inventory_buildEquipMap_(ctx) {
  const map = new Map();
  for (let i = 0; i < ctx.equipNames.length; i++) {
    const name = String(ctx.equipNames[i] || "").trim();
    if (!name) continue;
    const key = _inventory_norm_(name);
    if (!key || map.has(key)) continue;

    const obj = { name, family:ctx.equipFams[i]||"", category:ctx.equipCats[i]||"", description:ctx.equipDescriptions[i]||"", weight:ctx.equipPoids[i]||0 };
    for (let j = 0; j < INVENTORY_UNIQUE_STATS.length; j++) {
      const def = INVENTORY_UNIQUE_STATS[j];
      obj[def.key] = ctx.uniqueEquipValues[def.key][i] || "";
    }
    map.set(key, obj);
  }
  return map;
}

function _inventory_buildEquipCatalog_(ctx, equipMap) {
  const out = [];
  equipMap.forEach(eq => {
    const row = { name:eq.name||"", family:eq.family||"", category:eq.category||"", description:eq.description||"", weight:eq.weight||0 };
    for (let j = 0; j < INVENTORY_UNIQUE_STATS.length; j++) {
      const def = INVENTORY_UNIQUE_STATS[j];
      row[def.itemProp] = eq[def.key] || "";
    }
    out.push(row);
  });
  out.sort((a, b) => String(a.name||"").localeCompare(String(b.name||""), "fr", { sensitivity:"base" }));
  return out;
}

/* =======================
   Unicisation / split
   ======================= */

function _inventory_splitRow_(ctx, srcIdx, qtyToSplit, overrideFields, equipMap) {
  overrideFields = overrideFields || {};

  const sourceQty = _inventory_num_(ctx.qtys[srcIdx]);
  if (!Number.isFinite(qtyToSplit) || qtyToSplit <= 0) return { ok:false, error:"Quantité de split invalide." };
  if (qtyToSplit >= sourceQty) return { ok:false, error:"La quantité à séparer doit être inférieure à la quantité source." };

  const freeIdx = _inventory_findFirstEmptyRow_(ctx);
  if (freeIdx === -1) return { ok:false, error:"Aucune ligne libre disponible dans l'inventaire." };

  const newId = _inventory_nextId_(ctx);
  const sourceStats = _inventory_resolveStatsForRow_(ctx, srcIdx, equipMap);
  if (Object.prototype.hasOwnProperty.call(overrideFields, "dispo")) {
    sourceStats.dispo = String(overrideFields.dispo || "");
  }

  const newDesc  = Object.prototype.hasOwnProperty.call(overrideFields, "description") ? String(overrideFields.description||"") : ctx.descriptions[srcIdx];
  const newNotes = Object.prototype.hasOwnProperty.call(overrideFields, "notes")       ? String(overrideFields.notes||"")       : ctx.notes[srcIdx];

  _inventory_writeBaseRow_(ctx, freeIdx, {
    id:    newId,
    name:  ctx.names[srcIdx],
    fam:   ctx.fams[srcIdx],
    cat:   ctx.cats[srcIdx],
    empl:  ctx.emplacements[srcIdx],
    poids: ctx.poids[srcIdx],
    desc:  newDesc,
    qty:   qtyToSplit,
    notes: newNotes
  });

  _inventory_applyUniqueStatsToRow_(ctx, freeIdx, sourceStats);
  ctx.qtyRange.getCell(srcIdx + 1, 1).setValue(sourceQty - qtyToSplit);

  return { ok:true, newId, newIdx:freeIdx };
}

function _inventory_writeBaseRow_(ctx, rowIdx, d) {
  const r = rowIdx + 1;
  ctx.idRange.getCell(r, 1).setValue(d.id != null ? d.id : "");
  ctx.nameRange.getCell(r, 1).setValue(d.name != null ? d.name : "");
  ctx.famRange.getCell(r, 1).setValue(d.fam != null ? d.fam : "");
  ctx.catRange.getCell(r, 1).setValue(d.cat != null ? d.cat : "");
  ctx.emplRange.getCell(r, 1).setValue(d.empl != null ? d.empl : "");
  ctx.poidsRange.getCell(r, 1).setValue(d.poids != null ? d.poids : 0);
  ctx.descRange.getCell(r, 1).setValue(d.desc != null ? d.desc : "");
  ctx.qtyRange.getCell(r, 1).setValue(d.qty != null ? d.qty : 1);
  ctx.notesRange.getCell(r, 1).setValue(d.notes != null ? d.notes : "");
}

function _inventory_clearRow_(ctx, rowIdx) {
  const r = rowIdx + 1;
  ctx.idRange.getCell(r, 1).clearContent();
  ctx.nameRange.getCell(r, 1).clearContent();
  ctx.famRange.getCell(r, 1).clearContent();
  ctx.catRange.getCell(r, 1).clearContent();
  ctx.emplRange.getCell(r, 1).clearContent();
  ctx.poidsRange.getCell(r, 1).clearContent();
  ctx.descRange.getCell(r, 1).clearContent();
  ctx.qtyRange.getCell(r, 1).clearContent();
  ctx.notesRange.getCell(r, 1).clearContent();

  for (let i = 0; i < INVENTORY_UNIQUE_STATS.length; i++) {
    const def = INVENTORY_UNIQUE_STATS[i];
    const rg = ctx.uniqueInvRanges[def.key];
    if (!rg) continue;
    rg.getCell(r, 1).clearContent();
  }
}

function _inventory_applyUniqueStatsToRow_(ctx, rowIdx, stats) {
  stats = stats || {};
  for (let i = 0; i < INVENTORY_UNIQUE_STATS.length; i++) {
    const def = INVENTORY_UNIQUE_STATS[i];
    const rg  = ctx.uniqueInvRanges[def.key];
    if (!rg) continue;
    rg.getCell(rowIdx + 1, 1).setValue(String(stats[def.key] || ""));
  }
}

function _inventory_resolveStatsForRow_(ctx, rowIdx, equipMap) {
  const out = {};
  const eq  = equipMap.get(_inventory_norm_(ctx.names[rowIdx])) || null;
  for (let i = 0; i < INVENTORY_UNIQUE_STATS.length; i++) {
    const def    = INVENTORY_UNIQUE_STATS[i];
    const invVal = ctx.uniqueInvValues[def.key][rowIdx];
    out[def.key] = _inventory_hasValue_(invVal) ? invVal : (eq ? (eq[def.key] || "") : "");
  }
  return out;
}

function _inventory_resolveStatsForName_(ctx, name, equipMap) {
  const out = {};
  const eq  = equipMap.get(_inventory_norm_(name)) || null;
  for (let i = 0; i < INVENTORY_UNIQUE_STATS.length; i++) {
    const def   = INVENTORY_UNIQUE_STATS[i];
    out[def.key] = eq ? (eq[def.key] || "") : "";
  }
  return out;
}

function _inventory_collectStatsFromPayload_(payload, ctx, name, equipMap) {
  const defaults = _inventory_resolveStatsForName_(ctx, name, equipMap);
  const out      = {};
  for (let i = 0; i < INVENTORY_UNIQUE_STATS.length; i++) {
    const def = INVENTORY_UNIQUE_STATS[i];
    const raw = Object.prototype.hasOwnProperty.call(payload, def.key) ? payload[def.key] : "";
    const txt = String(raw == null ? "" : raw).trim();
    out[def.key] = txt !== "" ? txt : (defaults[def.key] || "");
  }
  return out;
}

/* =======================
   Helpers métier
   ======================= */

function _inventory_getContainersFromItems_(items) {
  const set = new Set([INV_DEFAULT_CONTAINER]);
  (items || []).forEach(item => {
    const v = String(item && item.emplacement || "").trim();
    if (v) set.add(v);
  });
  return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), "fr", { sensitivity:"base" }));
}

function _inventory_findDuplicateManualRow_(ctx, obj, stats, equipMap) {
  const nameN  = _inventory_norm_(obj.name);
  const famN   = _inventory_norm_(obj.family);
  const catN   = _inventory_norm_(obj.category);
  const emplN  = _inventory_norm_(obj.emplacement);
  const descN  = _inventory_norm_(obj.description);
  const notesN = _inventory_norm_(obj.notes);
  const poidsN = _inventory_num_(obj.weight);

  for (let i = 0; i < ctx.names.length; i++) {
    if (!ctx.names[i]) continue;
    if (
      _inventory_norm_(ctx.names[i])        !== nameN  ||
      _inventory_norm_(ctx.fams[i])         !== famN   ||
      _inventory_norm_(ctx.cats[i])         !== catN   ||
      _inventory_norm_(ctx.emplacements[i]) !== emplN  ||
      _inventory_norm_(ctx.descriptions[i]) !== descN  ||
      _inventory_norm_(ctx.notes[i])        !== notesN ||
      _inventory_num_(ctx.poids[i])         !== poidsN
    ) continue;

    const rowStats  = _inventory_resolveStatsForRow_(ctx, i, equipMap);
    let   sameStats = true;
    for (let j = 0; j < INVENTORY_UNIQUE_STATS.length; j++) {
      const def = INVENTORY_UNIQUE_STATS[j];
      if (_inventory_norm_(rowStats[def.key]) !== _inventory_norm_(stats[def.key])) { sameStats = false; break; }
    }
    if (sameStats) return i;
  }
  return -1;
}

function _inventory_findFirstEmptyRow_(ctx) {
  for (let i = 0; i < ctx.names.length; i++) {
    if (!String(ctx.names[i] || "").trim() && !_inventory_num_(ctx.ids[i])) return i;
  }
  return -1;
}

function _inventory_nextId_(ctx) {
  let maxId = 0;
  ctx.ids.forEach(v => { const n = _inventory_num_(v); if (n > maxId) maxId = n; });
  return maxId + 1;
}

function _inventory_buildDisplayName_(name, notes) {
  const n = String(name  || "").trim();
  const x = String(notes || "").trim();
  return (n + (x ? " " + x : "")).trim();
}

function _inventory_uniqueNonEmptySorted_(arr) {
  const set = new Set();
  (arr || []).forEach(v => { const s = String(v||"").trim(); if (s) set.add(s); });
  return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), "fr", { sensitivity:"base" }));
}

function _inventory_getTransferTargets_(ss, currentFid) {
  const out = [];
  const seen = new Set();
  const current = String(currentFid || "").trim();

  function pushOne(fid, label) {
    const cleanFid = String(fid || "").trim();
    if (!cleanFid || cleanFid === current || seen.has(cleanFid)) return;
    seen.add(cleanFid);
    out.push({ fid: cleanFid, label: String(label || "").trim() || _inventory_guessTransferLabel_(cleanFid) });
  }

  try {
    if (typeof inventory_listTransferTargets === "function") {
      const list = inventory_listTransferTargets(current);
      if (Array.isArray(list)) {
        list.forEach(x => pushOne(x && x.fid, x && x.label));
      }
    }
  } catch (_) {}

  try {
    const raw = PropertiesService.getScriptProperties().getProperty("POLARIS_TRANSFER_TARGETS_JSON");
    if (raw) {
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.items) ? parsed.items : []);
      arr.forEach(x => pushOne(x && x.fid, x && x.label));
    }
  } catch (_) {}

  try {
    for (let i = 0; i < INVENTORY_TRANSFER_RANGE_CANDIDATES.length; i++) {
      const rg = ss.getRangeByName(INVENTORY_TRANSFER_RANGE_CANDIDATES[i]);
      if (!rg) continue;
      const vals = rg.getValues();
      if (!vals || !vals.length) continue;

      if (rg.getNumColumns() >= 2) {
        vals.forEach(row => pushOne(row[0], row[1]));
      } else {
        const labelRg = _inventory_firstExistingNamedRange_(ss, INVENTORY_TRANSFER_LABEL_RANGE_CANDIDATES);
        const labelVals = labelRg ? labelRg.getValues().flat() : [];
        vals.flat().forEach((fid, idx) => pushOne(fid, labelVals[idx]));
      }
      break;
    }
  } catch (_) {}

  out.sort((a, b) => String(a.label || a.fid || "").localeCompare(String(b.label || b.fid || ""), "fr", { sensitivity:"base" }));
  return out;
}

function _inventory_guessTransferLabel_(fid) {
  const cleanFid = String(fid || "").trim();
  if (!cleanFid) return "";

  try {
    if (typeof getIdentity === "function") {
      const id = getIdentity(cleanFid);
      if (id && typeof id === "object") {
        const parts = [id.player || id.joueur || "", id.character || id.personnage || id.label || ""].filter(Boolean);
        const lbl = parts.join(" — ").trim();
        if (lbl) return lbl;
      }
      if (id) return String(id);
    }
  } catch (_) {}

  try {
    const ss = SpreadsheetApp.openById(cleanFid);
    const sh = ss.getSheetByName("Personnage") || ss.getSheets()[0];
    if (sh) {
      const joueur = String(sh.getRange("B3").getDisplayValue() || "").trim();
      const perso  = String(sh.getRange("B6").getDisplayValue() || "").trim();
      const lbl = [joueur, perso].filter(Boolean).join(" — ").trim();
      if (lbl) return lbl;
    }
  } catch (_) {}

  return cleanFid;
}

function _inventory_firstExistingNamedRange_(ss, names) {
  for (let i = 0; i < names.length; i++) {
    try {
      const rg = ss.getRangeByName(names[i]);
      if (rg) return rg;
    } catch (_) {}
  }
  return null;
}

/* =======================
   Generic helpers
   ======================= */

function _inventory_getNamedDataRange_(ss, name) {
  try {
    const rg = ss.getRangeByName(name);
    if (!rg) return null;
    return rg.getNumRows() > 1 ? rg.offset(1, 0, rg.getNumRows() - 1, rg.getNumColumns()) : rg;
  } catch (_) { return null; }
}

function _inventory_getNamedDataRangeOptional_(ss, name) {
  try { return _inventory_getNamedDataRange_(ss, name); } catch (_) { return null; }
}

function _inventory_strArray_(rg, size, label) {
  if (!rg) throw new Error("Plage nommée introuvable : " + label);
  if (rg.getNumRows() !== size) throw new Error("La plage nommée " + label + " n'a pas la même hauteur.");
  return rg.getValues().flat().map(_inventory_str_);
}

function _inventory_optionalValues_(rg, size, mapper, defaultValue, label) {
  if (!rg) return Array.from({ length: size }, () => defaultValue);
  if (rg.getNumRows() !== size) throw new Error("La plage nommée " + label + " n'a pas la même hauteur.");
  return rg.getValues().flat().map(mapper);
}

function _inventory_str_(v)  { return String(v == null ? "" : v).trim(); }
function _inventory_num_(v)  { const s = String(v == null ? "" : v).trim().replace(",", "."); const n = Number(s); return Number.isFinite(n) ? n : 0; }
function _inventory_norm_(s) { return String(s||"").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function _inventory_hasValue_(v) { return String(v == null ? "" : v).trim() !== ""; }

function _inventory_extractSpreadsheetId_(raw) {
  const txt = String(raw == null ? "" : raw).trim();
  if (!txt) return "";
  const m = txt.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i);
  return m && m[1] ? String(m[1]).trim() : txt;
}


/* ============================================================
   OVERRIDES V2 — MID-aware transfer targets
============================================================ */

function inventory_getContext(fid, mid) {
  try {
    const cleanFid = String(fid || "").trim();
    const cleanMid = String(mid || "").trim();
    const ss = SpreadsheetApp.openById(cleanFid);
    const ctx = _inventory_getContext_(ss);
    if (!ctx.ok) return ctx;
    return _inventory_buildPayload_(ctx, cleanFid, cleanMid);
  } catch (err) {
    return { ok:false, error:"Erreur inventory_getContext : " + String((err && err.message) || err) };
  }
}

function _inventory_buildPayload_(ctx, currentFid, mid) {
  const items        = [];
  const equipMap     = _inventory_buildEquipMap_(ctx);
  const equipCatalog = _inventory_buildEquipCatalog_(ctx, equipMap);

  for (let i = 0; i < ctx.ids.length; i++) {
    const id   = ctx.ids[i];
    const name = ctx.names[i];
    if (!id && !name) continue;
    if (!name) continue;

    const resolvedStats = _inventory_resolveStatsForRow_(ctx, i, equipMap);

    const item = {
      id,
      key: String(id),
      name,
      displayName: _inventory_buildDisplayName_(name, ctx.notes[i]),
      family:      ctx.fams[i],
      category:    ctx.cats[i],
      emplacement: ctx.emplacements[i] || "",
      weight:      ctx.poids[i],
      description: ctx.descriptions[i],
      quantity:    ctx.qtys[i],
      notes:       ctx.notes[i]
    };

    for (let j = 0; j < INVENTORY_UNIQUE_STATS.length; j++) {
      const def = INVENTORY_UNIQUE_STATS[j];
      item[def.itemProp] = resolvedStats[def.key] || "";
    }

    items.push(item);
  }

  items.sort((a, b) => a.displayName.localeCompare(b.displayName, "fr", { sensitivity:"base" }));

  const containers      = _inventory_getContainersFromItems_(items);
  const calibers        = _inventory_uniqueNonEmptySorted_(equipCatalog.map(x => x.catalogArmeCAL || ""));
  const transferTargets = _inventory_getTransferTargets_(ctx.ss, currentFid, mid);

  return {
    ok: true,
    items,
    containers,
    equipCatalog,
    calibers,
    transferTargets,
    counts: { items:items.length, containers:containers.length }
  };
}

function _inventory_getTransferTargetsFromMid_(mid, currentFid) {
  const out = [];
  const seen = new Set();
  const cleanMid = String(mid || "").trim();
  const current = String(currentFid || "").trim();

  function pushOne(fid, label) {
    const cleanFid = String(fid || "").trim();
    if (!cleanFid || cleanFid === current || seen.has(cleanFid)) return;
    seen.add(cleanFid);
    out.push({ fid: cleanFid, label: String(label || "").trim() || _inventory_guessTransferLabel_(cleanFid) });
  }

  if (cleanMid && typeof reg_getPlayers === "function") {
    try {
      const reg = reg_getPlayers(cleanMid) || {};
      const arr = Array.isArray(reg.players) ? reg.players : [];
      arr.forEach(p => {
        const fid = p && (p.fid || p.fileId || p.spreadsheetId || "");
        const label = p && (p.label || p.name || [p.joueur || p.player || "", p.perso || p.character || ""].filter(Boolean).join(" — "));
        pushOne(fid, label);
      });
    } catch (_) {}
  }

  out.sort((a, b) => String(a.label || a.fid || "").localeCompare(String(b.label || b.fid || ""), "fr", { sensitivity:"base" }));
  return out;
}

function _inventory_getTransferTargets_(ss, currentFid, mid) {
  const out = [];
  const seen = new Set();
  const current = String(currentFid || "").trim();

  function pushOne(fid, label) {
    const cleanFid = String(fid || "").trim();
    if (!cleanFid || cleanFid === current || seen.has(cleanFid)) return;
    seen.add(cleanFid);
    out.push({ fid: cleanFid, label: String(label || "").trim() || _inventory_guessTransferLabel_(cleanFid) });
  }

  _inventory_getTransferTargetsFromMid_(mid, current).forEach(x => pushOne(x && x.fid, x && x.label));

  try {
    if (typeof inventory_listTransferTargets === "function") {
      const list = inventory_listTransferTargets(current);
      if (Array.isArray(list)) {
        list.forEach(x => pushOne(x && x.fid, x && x.label));
      }
    }
  } catch (_) {}

  try {
    const raw = PropertiesService.getScriptProperties().getProperty("POLARIS_TRANSFER_TARGETS_JSON");
    if (raw) {
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.items) ? parsed.items : []);
      arr.forEach(x => pushOne(x && x.fid, x && x.label));
    }
  } catch (_) {}

  try {
    for (let i = 0; i < INVENTORY_TRANSFER_RANGE_CANDIDATES.length; i++) {
      const rg = ss.getRangeByName(INVENTORY_TRANSFER_RANGE_CANDIDATES[i]);
      if (!rg) continue;
      const vals = rg.getValues();
      if (!vals || !vals.length) continue;

      if (rg.getNumColumns() >= 2) {
        vals.forEach(row => pushOne(row[0], row[1]));
      } else {
        const labelRg = _inventory_firstExistingNamedRange_(ss, INVENTORY_TRANSFER_LABEL_RANGE_CANDIDATES);
        const labelVals = labelRg ? labelRg.getValues().flat() : [];
        vals.flat().forEach((fid, idx) => pushOne(fid, labelVals[idx]));
      }
      break;
    }
  } catch (_) {}

  out.sort((a, b) => String(a.label || a.fid || "").localeCompare(String(b.label || b.fid || ""), "fr", { sensitivity:"base" }));
  return out;
}
